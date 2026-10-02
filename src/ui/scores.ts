import { yaServerTime } from '../game/yandex';
import { storageGet, storageSet } from '../game/storage';

export type ScoreEntry = {
  name: string;
  score: number;
  blocks: number;
  tier: string;
  depth: number;
  combo: number;
  date: number;
  token: string;
  /** shift length in seconds */
  runTime?: number;
};

const KEY = 'orerush.highscores.v1';
const NAME_KEY = 'orerush.playername.v1';
const MAX = 8;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = storageGet(KEY);
    if (!raw) return seedScores();
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed) || !parsed.length) return seedScores();
    return parsed.slice(0, MAX);
  } catch {
    return seedScores();
  }
}

function seedScores(): ScoreEntry[] {
  const demo: Array<[string, number, number, string, number, number]> = [
    ['GPT-MINER', 4820, 214, 'DIAMOND', 31, 18],
    ['STEVE', 3160, 168, 'IRON', 27, 14],
    ['CLAUDE', 2240, 141, 'IRON', 24, 11],
    ['CREEPER', 1180, 96, 'STONE', 19, 9],
    ['NOTCH', 540, 61, 'STONE', 12, 6],
  ];
  const list: ScoreEntry[] = demo.map(([name, score, blocks, tier, depth, combo], i) => ({
    name,
    score,
    blocks,
    tier,
    depth,
    combo,
    date: yaServerTime() - i * 86400000,
    token: `seed-${i}`,
  }));
  saveScores(list);
  return list;
}

export function saveScores(list: ScoreEntry[]) {
  storageSet(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function submitScore(entry: ScoreEntry): ScoreEntry[] {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const next = list.slice(0, MAX);
  saveScores(next);
  return next;
}

export function updateName(token: string, name: string): ScoreEntry[] {
  const list = loadScores().map((e) => (e.token === token ? { ...e, name } : e));
  saveScores(list);
  return list;
}

export function loadPlayerName(): string {
  return storageGet(NAME_KEY) || 'MINER';
}

export function savePlayerName(name: string) {
  storageSet(NAME_KEY, name);
}
