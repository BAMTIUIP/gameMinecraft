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
 *    MAX_COMMITS) — a 20-minute shift stays around 60 KB;
 *  - start / pause of the replay follow `GameplayAPI.start()/stop()`, which the game already drives.
 *
 * Outside Yandex Games (dev builds, itch, own hosting) there is nothing to record and nobody to replay,
 * so the squad is filled with local teammates (`kind: 'bot'`) that wander around the player. Same
 * panel, same rigs, same gameplay — the feature stays playable, and the automated checks can drive it
 * without the platform.
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
/** ~70 bytes per transaction → 1500 commits stay far below the documented 200 KB per session. */
const MAX_COMMITS = 1_500;
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

type BotState = { id: string; nextMoveAt: number; blocks: number; seed: number };

type ActiveRound = {
  sink: CoopSink;
  members: SquadMember[];
  bots: BotState[];
  online: boolean;
  commits: number;
  lastCommitAt: number;
  lastPayloadKey: string;
  pushedCommits: number;
};

let active: ActiveRound | null = null;
let eventsBound = false;
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
  eventsBound = false;
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
    bots: [],
    online: false,
    commits: 0,
    lastCommitAt: 0,
    lastPayloadKey: '',
    pushedCommits: 0,
  };
  active = round;

  if (yaMultiplayerAvailable()) {
    await loadOpponents(round, wanted);
  } else {
    // offline squad: same rigs, same panel, no platform behind them
    const seeds = botSeeds(wanted);
    round.members = seeds.map((seed) => ({ id: seed.id, name: seed.name, avatar: null, kind: 'bot' as const, metaScore: null }));
    round.bots = seeds.map((seed, i) => ({ id: seed.id, nextMoveAt: 0, blocks: 0, seed: i + 1 }));
    sink.spawn(seeds);
  }

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
  if (!seeds.length) {
    // nobody to replay right now: the shift stays solo, but our own session is still recorded
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
    yaOnMultiplayer({
      transaction: (data) => applyTransactions(active, data.opponentId, data.transactions),
      finish: (opponentId) => {
        if (!active) return;
        active.sink.finish(opponentId);
      },
    });
  }
}

function botSeeds(count: number): CompanionSeed[] {
  const seeds: CompanionSeed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({ id: `bot-${i + 1}`, name: t('squadBotName').replace('{n}', String(i + 2)), color: `bot-${i}` });
  }
  return seeds;
}

/* ------------------------------- recording -------------------------------- */

/** Compact payload of one recorded moment; short keys keep the timeline far below 200 KB. */
type TimelinePayload = { x: number; y: number; z: number; yaw: number; health: number; blocks: number };

const round2 = (v: number) => Math.round(v * 100) / 100;

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
  if (round.commits >= MAX_COMMITS) {
    if (round.commits === MAX_COMMITS) {
      round.commits++; // log once, then stop asking the SDK
      console.warn('[multiplayer] timeline is full, the rest of the shift is not recorded');
    }
    return;
  }
  if (!yaMultiplayerCommit(payload)) return;
  round.commits += 1;
  round.lastCommitAt = now;
  round.lastPayloadKey = key;
}

/* --------------------------------- ticking -------------------------------- */

/**
 * Per-tick upkeep: the engine calls this with the current pose (from `onPose`). It keeps the local
 * teammates wandering around the player; opponent replay comes from the platform events.
 */
export function tickCoop(pose: PlayerPose) {
  const round = active;
  if (!round) return;
  recordPose(pose);

  const now = Date.now();
  for (const bot of round.bots) {
    if (now < bot.nextMoveAt) continue;
    bot.nextMoveAt = now + 2_200 + Math.random() * 2_600;
    const angle = Math.random() * Math.PI * 2;
    const radius = BOT_RADIUS_MIN + Math.random() * (BOT_RADIUS_MAX - BOT_RADIUS_MIN);
    bot.blocks += Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 2) : 0;
    round.sink.move(bot.id, {
      x: pose.x + Math.cos(angle) * radius,
      y: pose.y + (Math.random() - 0.5) * 2,
      z: pose.z + Math.sin(angle) * radius,
      yaw: angle + Math.PI, // walking away from the centre of the circle
      health: 70 + Math.round(Math.random() * 30),
      blocks: bot.blocks,
    });
  }
}

/* ------------------------------- finishing -------------------------------- */

/**
 * The shift is over: publish our timeline so other players can replay it. Called from the results
 * screen; the push happens only when the platform recorded something new, so reviving after a death
 * publishes the longer session instead of a duplicate.
 */
export function publishCoopSession(result?: { score?: number; depth?: number; blocks?: number }): boolean {
  const round = active;
  if (!round || !round.online) return false;
  if (round.commits < MIN_COMMITS_TO_PUSH || round.commits <= round.pushedCommits) return false;
  round.pushedCommits = round.commits;
  // push() needs at least one meta parameter; score, depth and blocks describe the shift best
  void yaMultiplayerPush({
    meta1: Math.max(0, Math.round(result?.score ?? 0)),
    meta2: Math.max(0, Math.round(result?.depth ?? 0)),
    meta3: Math.max(0, Math.round(result?.blocks ?? 0)),
  });
  return true;
}

/** End the round: stop recording, forget the squad. The rigs are removed by the engine. */
export function stopCoopRound() {
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
