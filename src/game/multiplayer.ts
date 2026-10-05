/**
 * Co-op survival through asynchronous multiplayer sessions
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-multiplayer-sessions).
 *
 * The platform has no live game servers for this: it records a **timeline of transactions** while a
 * player is in a shift (`sessions.commit()`), stores it when the shift ends (`sessions.push()`), and
 * replays someone else's timeline for the next squad through
 * `multiplayer-sessions-transaction` / `multiplayer-sessions-finish` events. The game draws those
 * teammates as ghost miners in the same world (the rigs live in src/game/engine.ts), which is exactly
 * the "co-op shift with up to five players" the game promises — without a single byte of own backend.
 *
 * Rules taken from the documentation and enforced here:
 *  - `init()` only loads sessions when `count > 0` **and** at least one `meta1..meta3` range is given;
 *    without them the SDK is initialised "for recording only";
 *  - `push()` needs at least one meta parameter, so the finished shift publishes score, depth and blocks;
 *  - one recorded session is limited to **200 KB**, so commits are sparse (≥2 s apart, and stops at
 *    MAX_SESSION_BYTES) — a 20-minute shift stays around 160 KB, under the documented 200 KB;
 *  - start / pause of the replay follow `GameplayAPI.start()/stop()`, which the game already drives.
 *
 * Outside Yandex Games there is nobody to replay, so the squad is filled with local teammates. On
 * Yandex they only fill vacant slots after real replay sessions are loaded. Local bots use randomized
 * skins from the character creator while keeping the same movement, panel and gameplay as before.
 */

import { flagBool, flagNumber } from './flags';
import { t } from './i18n';
import { getTotals } from './profile';
import {
  yaMultiplayerAvailable,
  yaMultiplayerCommit,
  yaMultiplayerInit,
  yaMultiplayerPush,
  yaOnMultiplayer,
  type YaMultiplayerSession,
  type YaSessionTransaction,
} from './yandex';
import type { CompanionPose, CompanionSeed, PlayerPose } from './engine';

/** Co-op cap for this game (the platform itself would allow up to 10 opponent sessions). */
export const MAX_SQUAD = 5;

/** Commits are throttled: the same 2 s the engine uses for its own sampling. */
const RECORD_INTERVAL_MS = 2_000;
/** ...but a big change (blocks mined, a long fall) is worth a transaction sooner than that. */
const MIN_RECORD_GAP_MS = 800;
const MAX_COMMITS = 1_500;
/**
 * The documented ceiling for one recorded session is 200 KB. Every transaction also carries the
 * `id` and `time` the SDK adds on top of the payload, so the budget is measured in real bytes with
 * headroom for that overhead instead of trusting a fixed commit count.
 */
const MAX_SESSION_BYTES = 160 * 1024;
/** Bytes the SDK itself adds per transaction (id, time, framing). */
const TRANSACTION_OVERHEAD_BYTES = 96;
/** A shift this short is not worth replaying for anyone else. */
const MIN_COMMITS_TO_PUSH = 2;

/** How far a local teammate wanders from the player, in blocks. */
const BOT_RADIUS_MIN = 3;
const BOT_RADIUS_MAX = 11;

export type SquadMember = {
  id: string;
  name: string;
  avatar: string | null;
  kind: 'remote' | 'bot';
  /** the opponent's own result from their session meta (score), when the platform sent one */
  metaScore: number | null;
};

/** The engine side of co-op: the module never touches three.js itself. */
export type CoopSink = {
  spawn(seeds: CompanionSeed[]): void;
  move(id: string, pose: CompanionPose): void;
  finish(id: string): void;
  clear(): void;
};

type BotActivity = 'walking' | 'mining' | 'fighting';
type BotState = {
  id: string;
  nextMoveAt: number;
  seed: number;
  activity: BotActivity;
  cycles: number;
  initialized: boolean;
  targetX: number;
  targetZ: number;
  yaw: number;
};

type ActiveRound = {
  sink: CoopSink;
  members: SquadMember[];
  seeds: CompanionSeed[];
  bots: BotState[];
  online: boolean;
  commits: number;
  /** approximate size of the recorded timeline, including SDK overhead */
  bytes: number;
  lastCommitAt: number;
  lastPayloadKey: string;
  pushedCommits: number;
  pushInFlight: Promise<boolean> | null;
  warnedFull: boolean;
};

let active: ActiveRound | null = null;
let eventsBound = false;
/** removes the SDK listeners of the current round (sdk-events: on/off come in pairs) */
let unbindEvents: (() => void) | null = null;
let notified: SquadMember[] = [];

export function coopEnabled(): boolean {
  return flagBool('multiplayer.enabled');
}

/** Total squad size (the player plus teammates), clamped to 1..MAX_SQUAD. */
export function coopSquadSize(): number {
  const raw = Math.round(flagNumber('multiplayer.maxPlayers', MAX_SQUAD));
  return Math.max(1, Math.min(MAX_SQUAD, raw));
}

/** The squad of the round that is running now (kept for the UI after the round ends). */
export function squadMembers(): SquadMember[] {
  return active?.members ?? notified;
}

export function coopActive(): boolean {
  return active !== null;
}

/** Test seam: forget the round without touching the platform. */
export function resetCoopState() {
  active = null;
  if (eventsBound) unbindEvents?.();
  eventsBound = false;
  unbindEvents = null;
  notified = [];
}

/* --------------------------------- start ---------------------------------- */

/**
 * Begin a co-op shift: load opponent sessions (or build a local squad outside Yandex) and hand the
 * teammates to the engine. Resolves with the squad so the UI can name it.
 */
export async function startCoopRound(sink: CoopSink): Promise<SquadMember[]> {
  stopCoopRound(); // a new shift never inherits the previous squad
  if (!coopEnabled()) return [];

  const wanted = coopSquadSize() - 1;
  if (wanted <= 0) return [];

  const round: ActiveRound = {
    sink,
    members: [],
    seeds: [],
    bots: [],
    online: false,
    commits: 0,
    bytes: 0,
    lastCommitAt: 0,
    lastPayloadKey: '',
    pushedCommits: 0,
    pushInFlight: null,
    warnedFull: false,
  };
  active = round;

  if (yaMultiplayerAvailable()) await loadOpponents(round, wanted);
  // Fill any empty squad slots with local bots. This also keeps survival readable when the SDK is
  // present but there are no replay sessions to show; live teammates still take priority.
  if (round.members.length < wanted) addLocalBots(round, wanted - round.members.length);

  notified = round.members;
  return round.members;
}

async function loadOpponents(round: ActiveRound, wanted: number) {
  const totals = getTotals();
  const best = Math.max(0, Math.floor(totals.bestScore ?? 0));
  const deepest = Math.max(0, Math.floor(totals.deepest ?? 0));
  const sessions = await yaMultiplayerInit({
    count: wanted,
    isEventBased: true, // the SDK replays transactions on its own timing
    maxOpponentTurnTime: 4_000, // a teammate who stood still for a minute catches up in 4 s
    // at least one range is required for the load to return anything at all
    meta: {
      meta1: { min: Math.floor(best * 0.5), max: best * 2 + 100 }, // score of a comparable shift
      meta2: { min: 0, max: Math.max(8, deepest + 4) }, // depth reached
    },
  });

  const seeds: CompanionSeed[] = [];
  for (const session of sessions.slice(0, wanted)) {
    const name = session.player?.name?.trim() || t('squadTeammate');
    seeds.push({ id: session.id, name, color: session.id });
    round.members.push({
      id: session.id,
      name,
      avatar: session.player?.avatar ?? null,
      kind: 'remote',
      metaScore: typeof session.meta?.meta1 === 'number' ? session.meta.meta1 : null,
    });
  }
  round.seeds.push(...seeds);
  if (!seeds.length) {
    // The player may still have local fallback teammates; own-session recording remains enabled.
    round.online = true;
    return;
  }

  round.online = true;
  round.sink.spawn(seeds);

  // Some platforms hand the first part of a timeline back from init() itself: replay it right away,
  // so a teammate is not standing still until their next event arrives.
  for (const session of sessions) {
    const rig = round.members.find((m) => m.id === session.id);
    if (!rig || !session.timeline?.length) continue;
    applyTransactions(round, session.id, session.timeline.slice(-2));
  }

  if (!eventsBound) {
    eventsBound = true;
    unbindEvents = yaOnMultiplayer({
      transaction: (data) => applyTransactions(active, data.opponentId, data.transactions),
      finish: (opponentId) => {
        if (!active) return;
        active.sink.finish(opponentId);
      },
    });
  }
}

function addLocalBots(round: ActiveRound, count: number) {
  const firstBot = round.bots.length;
  const seeds = botSeeds(count, firstBot, round.members.length);
  seeds.forEach((seed, index) => {
    round.members.push({ id: seed.id, name: seed.name, avatar: null, kind: 'bot', metaScore: null });
    round.bots.push({
      id: seed.id,
      nextMoveAt: 0,
      seed: firstBot + index + 1,
      activity: 'walking',
      cycles: 0,
      initialized: false,
      targetX: 0,
      targetZ: 0,
      yaw: 0,
    });
  });
  round.seeds.push(...seeds);
  // `spawn` is a set operation on the engine side, so include any replay teammates already loaded.
  round.sink.spawn(round.seeds);
}

function botSeeds(count: number, firstBot = 0, memberOffset = 0): CompanionSeed[] {
  const seeds: CompanionSeed[] = [];
  for (let i = 0; i < count; i++) {
    const index = firstBot + i;
    seeds.push({
      id: `local-bot-${index + 1}`,
      name: t('squadBotName').replace('{n}', String(memberOffset + i + 2)),
      color: `local-bot-${index}`,
      appearanceSeed: Math.floor(Math.random() * 0x1_0000_0000),
      localBot: true,
    });
  }
  return seeds;
}

/* ------------------------------- recording -------------------------------- */

/** Compact payload of one recorded moment; short keys keep the timeline far below 200 KB. */
type TimelinePayload = { x: number; y: number; z: number; yaw: number; health: number; blocks: number };

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Size one committed transaction adds to the timeline (payload plus the SDK's own fields). */
function approxTransactionBytes(payload: TimelinePayload): number {
  try {
    return JSON.stringify(payload).length + TRANSACTION_OVERHEAD_BYTES;
  } catch {
    return TRANSACTION_OVERHEAD_BYTES;
  }
}

function posePayload(pose: PlayerPose): TimelinePayload {
  return {
    x: round2(pose.x),
    y: round2(pose.y),
    z: round2(pose.z),
    yaw: round2(pose.yaw),
    health: Math.round(pose.health),
    blocks: Math.round(pose.blocks),
  };
}

/**
 * Called by the engine a few times per second while the player is in a shift. Commits are throttled
 * and stop at MAX_COMMITS, so the recorded session can never exceed the platform's 200 KB budget.
 */
export function recordPose(pose: PlayerPose) {
  const round = active;
  if (!round || !round.online) return;
  const now = Date.now();
  const payload = posePayload(pose);
  const key = `${Math.round(payload.x)}:${Math.round(payload.y)}:${Math.round(payload.z)}:${payload.blocks}`;
  const changed = key !== round.lastPayloadKey;
  const elapsed = now - round.lastCommitAt;
  if (!changed && elapsed < RECORD_INTERVAL_MS) return;
  if (elapsed < (changed ? MIN_RECORD_GAP_MS : RECORD_INTERVAL_MS)) return;
  if (round.commits >= MAX_COMMITS || round.bytes >= MAX_SESSION_BYTES) {
    if (!round.warnedFull) {
      round.warnedFull = true;
      console.warn('[multiplayer] timeline reached the documented session limit, the rest of the shift is not recorded');
    }
    return;
  }
  if (!yaMultiplayerCommit(payload)) return;
  round.commits += 1;
  round.bytes += approxTransactionBytes(payload);
  round.lastCommitAt = now;
  round.lastPayloadKey = key;
}

/* --------------------------------- ticking -------------------------------- */

function botRandom(bot: BotState) {
  // A small per-bot generator keeps fallback behaviour varied without making health, height or
  // movement jump unpredictably from one frame to the next.
  bot.seed = (Math.imul(bot.seed, 1_664_525) + 1_013_904_223) >>> 0;
  return bot.seed / 0x1_0000_0000;
}

function setBotWalkTarget(bot: BotState, pose: PlayerPose) {
  const angle = botRandom(bot) * Math.PI * 2;
  const radius = BOT_RADIUS_MIN + 1 + botRandom(bot) * Math.min(5, BOT_RADIUS_MAX - BOT_RADIUS_MIN - 1);
  bot.targetX = pose.x + Math.cos(angle) * radius;
  bot.targetZ = pose.z + Math.sin(angle) * radius;
  bot.yaw = Math.atan2(-(bot.targetX - pose.x), -(bot.targetZ - pose.z));
}

/**
 * Per-tick upkeep: the engine calls this with the current pose (from `onPose`). Local fallback
 * teammates receive steady ground-level destinations and a simple walk → mine → fight routine. Real
 * Yandex teammates remain replays of recorded sessions; these local bots are never sent to the SDK.
 */
export function tickCoop(pose: PlayerPose) {
  const round = active;
  if (!round) return;
  recordPose(pose);

  const now = Date.now();
  for (const bot of round.bots) {
    const distFromPlayer = bot.initialized ? Math.hypot(bot.targetX - pose.x, bot.targetZ - pose.z) : Infinity;
    if (now < bot.nextMoveAt && distFromPlayer < 16) continue;

    if (!bot.initialized || distFromPlayer >= 16 || bot.activity === 'fighting') {
      setBotWalkTarget(bot, pose);
      bot.activity = 'walking';
      bot.initialized = true;
      bot.nextMoveAt = now + 2_800 + botRandom(bot) * 1_500;
    } else if (bot.activity === 'walking') {
      // Pause at the new patch of ground and mine for a moment before setting off again.
      bot.activity = 'mining';
      bot.nextMoveAt = now + 1_900 + botRandom(bot) * 700;
    } else {
      bot.cycles += 1;
      // A brief fight attempt every few resource stops; the engine only engages an actual nearby
      // hostile, so an empty daytime world never gets imaginary combat.
      bot.activity = bot.cycles % 3 === 0 ? 'fighting' : 'walking';
      if (bot.activity === 'walking') setBotWalkTarget(bot, pose);
      bot.nextMoveAt = now + (bot.activity === 'fighting' ? 2_600 + botRandom(bot) * 800 : 2_800 + botRandom(bot) * 1_500);
    }

    round.sink.move(bot.id, {
      x: bot.targetX,
      y: pose.y,
      z: bot.targetZ,
      yaw: bot.yaw,
      activity: bot.activity,
    });
  }
}

/* ------------------------------- finishing -------------------------------- */

/**
 * The shift is over: publish our timeline so other players can replay it. Called from the results
 * screen; the push happens only when the platform recorded something new, so reviving after a death
 * publishes the longer session instead of a duplicate. Resolves true only after the SDK confirms the
 * push; a failed request remains eligible for another attempt.
 */
export async function publishCoopSession(result?: { score?: number; depth?: number; blocks?: number }): Promise<boolean> {
  const round = active;
  if (!round || !round.online) return false;
  if (round.pushInFlight) await round.pushInFlight;
  if (active !== round || !round.online) return false;
  if (round.commits < MIN_COMMITS_TO_PUSH || round.commits <= round.pushedCommits) return false;

  const committedCount = round.commits;
  // push() needs at least one meta parameter; score, depth and blocks describe the shift best.
  // Only mark these commits as published after the SDK confirms success, so a later finish can retry.
  const push = yaMultiplayerPush({
    meta1: Math.max(0, Math.round(result?.score ?? 0)),
    meta2: Math.max(0, Math.round(result?.depth ?? 0)),
    meta3: Math.max(0, Math.round(result?.blocks ?? 0)),
  }).then((sent) => {
    if (sent) round.pushedCommits = Math.max(round.pushedCommits, committedCount);
    return sent;
  });
  round.pushInFlight = push;
  try {
    return await push;
  } finally {
    if (round.pushInFlight === push) round.pushInFlight = null;
  }
}

/** End the round: stop recording, forget the squad. The rigs are removed by the engine. */
export function stopCoopRound() {
  if (eventsBound) {
    // the round is over: the SDK keeps no listeners of ours (sdk-events: on() and off() come in pairs)
    unbindEvents?.();
    eventsBound = false;
    unbindEvents = null;
  }
  if (!active) return;
  active.bots = [];
  active = null;
}

/* ------------------------------- payloads --------------------------------- */

/**
 * Turn a batch of recorded transactions into rig movement. The engine walks a rig to the target
 * instead of teleporting it, so applying the whole batch (the docs deliver a catch-up batch after a
 * frame drop) simply leaves the teammate where the recording ended.
 */
function applyTransactions(round: ActiveRound | null, opponentId: string, transactions: YaSessionTransaction[]) {
  if (!round) return;
  const member = round.members.find((m) => m.id === opponentId);
  if (!member) return; // a session we did not load (or already dropped)
  for (const transaction of transactions) {
    const pose = readPose(transaction?.payload);
    if (pose) round.sink.move(opponentId, pose);
  }
}

function readPose(payload: unknown): CompanionPose | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Partial<Record<keyof TimelinePayload, number>>;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
  const pose: CompanionPose = { x: Number(p.x), y: Number(p.y), z: Number(p.z) };
  if (Number.isFinite(p.yaw)) pose.yaw = Number(p.yaw);
  if (Number.isFinite(p.health)) pose.health = Number(p.health);
  if (Number.isFinite(p.blocks)) pose.blocks = Number(p.blocks);
  return pose;
}

/** Result of an opponent's session as the platform reports it in `meta`. */
export function sessionMeta(session: YaMultiplayerSession): { score: number | null; depth: number | null } {
  return {
    score: typeof session.meta?.meta1 === 'number' ? session.meta.meta1 : null,
    depth: typeof session.meta?.meta2 === 'number' ? session.meta.meta2 : null,
  };
}
