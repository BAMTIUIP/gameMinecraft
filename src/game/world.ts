import {
  AIR,
  GRASS,
  DIRT,
  STONE,
  COBBLE,
  COAL,
  IRON,
  GOLD,
  DIAMOND,
  LOG,
  LEAVES,
  SAND,
  BEDROCK,
  LAVA,
  PLANKS,
  GLASS,
  DOOR_WOOD,
  FENCE_STONE,
  FENCE_WOOD,
  TORCH,
  GOLD_BLOCK,
  WATER,
  FLOWER_RED,
  FLOWER_YELLOW,
  FLOWER_BLUE,
  SNOW_GRASS,
  ICE,
  SNOW_LEAVES,
  HIVE,
  NETHERITE_ORE,
  TALL_GRASS,
  FERN,
  DEAD_BUSH,
  CACTUS,
  CACTUS_PALE,
  BIRCH_LOG,
  BIRCH_LEAVES,
  APPLE_LEAVES,
} from './blocks';
import { fbm2, fbm3, mulberry32, noise3, seedNoise } from './noise';

/**
 * Streaming voxel world: chunks generate on demand as the player travels,
 * so the map never ends. Legacy WX/WZ mark the "starter" area only.
 */
export const WY = 48;
export const CHUNK = 16;
export const SEA = 12;
export const LAVA_LEVEL = 6;
// legacy constants — the pre-generated spawn region (8×8 chunks)
export const WX = 128;
export const WZ = 128;
export const CX = WX / CHUNK;
export const CZ = WZ / CHUNK;
/** world origin the spawn basin is carved around */
export const ORIGIN_X = 64;
export const ORIGIN_Z = 64;

const COFF = 2048; // chunk coordinate offset → supports ±2048 chunks (±32k blocks)
export function chunkKey(cx: number, cz: number) {
  return (cx + COFF) * 4096 + (cz + COFF);
}
export function keyToChunk(key: number): [number, number] {
  return [Math.floor(key / 4096) - COFF, (key % 4096) - COFF];
}

export type Chunk = {
  blocks: Uint8Array; // CHUNK * WY * CHUNK, index (y*CHUNK+lz)*CHUNK+lx
  height: Int16Array; // CHUNK * CHUNK ground height
  /** 0 = empty, 1 = terrain, 2 = decorated */
  state: number;
};

const cidx = (lx: number, y: number, lz: number) => (y * CHUNK + lz) * CHUNK + lx;

export class World {
  chunks = new Map<number, Chunk>();
  seed: number;
  /** castles & towers register here so the engine can post guards + traps */
  structureSites: Array<{ x: number; y: number; z: number; kind: 'tower' | 'cottage' }> = [];

  constructor(seed = 1337) {
    this.seed = seed;
  }

  reset(seed: number) {
    this.seed = seed;
    this.chunks.clear();
    this.structureSites.length = 0;
    seedNoise(seed);
  }

  /** nearest surface water within r blocks of (x,z), or null */
  findWaterNear(x: number, z: number, r: number): [number, number, number] | null {
    for (let i = 0; i < 14; i++) {
      const px = Math.floor(x + (Math.random() * 2 - 1) * r);
      const pz = Math.floor(z + (Math.random() * 2 - 1) * r);
      if (!this.hasColumn(px, pz)) continue;
      for (let y = SEA + 1; y >= 3; y--) {
        if (this.get(px, y, pz) === WATER) return [px + 0.5, y, pz + 0.5];
      }
    }
    return null;
  }

  chunkOf(x: number, z: number): [number, number] {
    return [Math.floor(x / CHUNK), Math.floor(z / CHUNK)];
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  hasTerrain(cx: number, cz: number) {
    return (this.getChunk(cx, cz)?.state ?? 0) >= 1;
  }
  isDecorated(cx: number, cz: number) {
    return (this.getChunk(cx, cz)?.state ?? 0) >= 2;
  }
  hasColumn(x: number, z: number) {
    return this.hasTerrain(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
  }

  inBounds(_x: number, y: number, _z: number) {
    return y >= 0 && y < WY;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= WY) return AIR;
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!c) return AIR;
    return c.blocks[cidx(((x % CHUNK) + CHUNK) % CHUNK, y, ((z % CHUNK) + CHUNK) % CHUNK)];
  }

  /** silently ignored when the chunk isn't generated yet */
  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= WY) return;
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!c) return;
    c.blocks[cidx(((x % CHUNK) + CHUNK) % CHUNK, y, ((z % CHUNK) + CHUNK) % CHUNK)] = id;
  }

  getHeight(x: number, z: number): number {
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!c) return this.heightAt(x, z);
    return c.height[(((z % CHUNK) + CHUNK) % CHUNK) * CHUNK + (((x % CHUNK) + CHUNK) % CHUNK)];
  }

  topSolidY(x: number, z: number) {
    for (let y = WY - 1; y >= 0; y--) {
      const b = this.get(x, y, z);
      if (b !== AIR && b !== LAVA) return y;
    }
    return 0;
  }

  /**
   * Climate: slow-rolling temperature noise splits the world into biomes.
   * < -0.18 → winter (snow, ice, frosted trees). Altitude cools things too.
   */
  /** raw climate noise; pass the known column height to avoid recomputing it */
  temperatureAt(x: number, z: number, h?: number) {
    let t = fbm2(x * 0.006 - 137.5, z * 0.006 + 89.2, 3);
    const hh = h ?? this.heightAt(x, z);
    if (hh > 26) t -= (hh - 26) * 0.025; // mountain tops freeze
    return t;
  }

  isWinter(x: number, z: number, h?: number) {
    return this.temperatureAt(x, z, h) < -0.18;
  }

  heightAt(x: number, z: number) {
    // Gentler, walkable terrain: lower amplitudes, soft-capped hills.
    const cont = fbm2(x * 0.0075 + 7.3, z * 0.0075 - 4.1, 3);
    const n1 = fbm2(x * 0.028, z * 0.028, 4);
    const n2 = fbm2(x * 0.09 + 40, z * 0.09 - 20, 3);
    let h = SEA + 6 + cont * 7 + n1 * 5 + n2 * 1.8;

    // rolling highlands instead of sheer plateaus: smoothstep ramp, capped rise
    const plateau = fbm2(x * 0.014 - 31, z * 0.014 + 18, 2);
    if (plateau > 0.24) {
      const t = Math.min(1, (plateau - 0.24) / 0.3);
      h += t * t * (3 - 2 * t) * 14; // smooth 0→14 gain, no cliffs
    }
    // shallow valleys for rivers — enough to flood, not canyon-deep
    const valley = Math.abs(fbm2(x * 0.019 + 61, z * 0.019 - 52, 3));
    if (valley < 0.1) h -= (0.1 - valley) * 30;

    // gentle basin around the spawn origin
    const dx = x - ORIGIN_X;
    const dz = z - ORIGIN_Z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 18) h -= (1 - dist / 18) * 2;

    return Math.max(4, Math.min(WY - 10, Math.round(h)));
  }

  /** stage 1: raw terrain, ores, caves, lava */
  genTerrain(cx: number, cz: number) {
    const key = chunkKey(cx, cz);
    if ((this.chunks.get(key)?.state ?? 0) >= 1) return;
    const chunk: Chunk = {
      blocks: new Uint8Array(CHUNK * WY * CHUNK),
      height: new Int16Array(CHUNK * CHUNK),
      state: 1,
    };
    this.chunks.set(key, chunk);
    const rand = mulberry32(this.seed ^ (cx * 73856093) ^ (cz * 19349663));

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const h = this.heightAt(x, z);
        chunk.height[lz * CHUNK + lx] = h;
        const winter = this.isWinter(x, z, h);

        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = BEDROCK;
          else if (y === h) {
            if (h > 30) id = winter ? SNOW_GRASS : STONE;
            else if (h <= SEA + 1) id = SAND;
            else id = winter ? SNOW_GRASS : GRASS;
          } else if (y > h - 4) id = h > 30 ? STONE : h <= SEA + 1 ? SAND : DIRT;
          else id = STONE;
          chunk.blocks[cidx(lx, y, lz)] = id;
        }

        for (let y = 2; y < h - 3; y++) {
          if (chunk.blocks[cidx(lx, y, lz)] !== STONE) continue;
          const depth = y / WY;
          const nA = noise3(x * 0.17 + 3.1, y * 0.26, z * 0.17 - 1.7);
          const nB = noise3(x * 0.19 - 21.4, y * 0.3 + 5, z * 0.19 + 8.2);
          const nC = noise3(x * 0.22 + 44.7, y * 0.34 - 12, z * 0.22 - 33.1);
          const nD = noise3(x * 0.26 - 61.2, y * 0.4 + 19, z * 0.26 + 51.9);
          const nE = noise3(x * 0.31 + 97.3, y * 0.5 - 41, z * 0.31 - 77.7);
          if (nE > 0.74 && y < 7) chunk.blocks[cidx(lx, y, lz)] = NETHERITE_ORE;
          else if (nD > 0.6 - depth * 0.24 && y < 12) chunk.blocks[cidx(lx, y, lz)] = DIAMOND;
          else if (nC > 0.58 - depth * 0.16 && y < 17) chunk.blocks[cidx(lx, y, lz)] = GOLD;
          else if (nB > 0.52 - depth * 0.1 && y < 26) chunk.blocks[cidx(lx, y, lz)] = IRON;
          else if (nA > 0.46 && y < 34) chunk.blocks[cidx(lx, y, lz)] = COAL;
        }

        for (let y = 2; y < h - 1; y++) {
          const cur = chunk.blocks[cidx(lx, y, lz)];
          if (cur === AIR || cur === BEDROCK) continue;
          const c1 = fbm3(x * 0.055, y * 0.085, z * 0.055, 3);
          const c2 = fbm3(x * 0.11 + 90, y * 0.14 - 40, z * 0.11 + 30, 2);
          const bias = y < 14 ? 0.05 : 0.0;
          if (c1 > 0.36 - bias || (c2 > 0.52 && y < 22)) chunk.blocks[cidx(lx, y, lz)] = AIR;
        }
        for (let y = 1; y <= LAVA_LEVEL; y++) {
          if (chunk.blocks[cidx(lx, y, lz)] === AIR) chunk.blocks[cidx(lx, y, lz)] = LAVA;
        }
        // lakes & rivers: any open air at/below sea level floods with water;
        // winter lakes freeze over with a walkable ice sheet
        if (h <= SEA) {
          for (let y = h + 1; y <= SEA; y++) {
            if (chunk.blocks[cidx(lx, y, lz)] === AIR) chunk.blocks[cidx(lx, y, lz)] = WATER;
          }
          if (winter && chunk.blocks[cidx(lx, SEA, lz)] === WATER) chunk.blocks[cidx(lx, SEA, lz)] = ICE;
        }
        if (rand() < 0.004) {
          const hy = Math.max(1, h - 1);
          chunk.blocks[cidx(lx, hy, lz)] = COBBLE;
        }
      }
    }
  }

  /**
   * stage 2: trees, surface ore, occasional structures.
   * Caller guarantees the 8 neighbours have terrain, so writes can spill over.
   */
  decorate(cx: number, cz: number) {
    const chunk = this.getChunk(cx, cz);
    if (!chunk || chunk.state >= 2) return;
    chunk.state = 2;
    const rand = mulberry32(this.seed * 31 + 7 + chunkKey(cx, cz) * 2654435761);

    // ---- diverse trees: oaks, bushy oaks, giants, birch, apple trees, spruce ----
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        if (rand() > 0.04) continue;
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const h = chunk.height[lz * CHUNK + lx];
        const top = this.get(x, h, z);
        const winter = top === SNOW_GRASS;
        if (top !== GRASS && !winter) continue;
        if (winter && rand() < 0.35) continue; // taiga
        if (h < SEA + 2 || h > (winter ? 34 : 30)) continue;
        let ok = true;
        for (let dz = -2; dz <= 2 && ok; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            const b = this.get(x + dx, h + 2, z + dz);
            if (b === LOG || b === BIRCH_LOG) {
              ok = false;
              break;
            }
          }
        if (!ok) continue;
        this.growDiverseTree(x, h + 1, z, rand, winter);
      }
    }

    // ---- cacti of various sizes and colors on sand ----
    for (let i = 0; i < 4; i++) {
      if (rand() > 0.6) continue;
      const x = cx * CHUNK + 1 + Math.floor(rand() * 14);
      const z = cz * CHUNK + 1 + Math.floor(rand() * 14);
      const h = this.getHeight(x, z);
      if (this.get(x, h, z) === SAND && this.get(x, h + 1, z) === AIR && h > SEA) {
        this.growCactus(x, h + 1, z, rand);
      }
    }

    // ---- tall grass & ferns on meadows ----
    for (let i = 0; i < 4; i++) {
      if (rand() > 0.8) continue;
      const gx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const gz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const plantId = rand() < 0.65 ? TALL_GRASS : FERN;
      for (let p = 0; p < 3 + Math.floor(rand() * 4); p++) {
        const px = gx + Math.floor(rand() * 5) - 2;
        const pz = gz + Math.floor(rand() * 5) - 2;
        const h = this.getHeight(px, pz);
        if (this.get(px, h, pz) === GRASS && this.get(px, h + 1, pz) === AIR) this.set(px, h + 1, pz, plantId);
      }
    }

    // ---- dead bushes on sand ----
    for (let i = 0; i < 3; i++) {
      if (rand() > 0.75) continue;
      const bx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const bz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const h = this.getHeight(bx, bz);
      if (this.get(bx, h, bz) === SAND && this.get(bx, h + 1, bz) === AIR) {
        this.set(bx, h + 1, bz, DEAD_BUSH);
      }
    }

    // ---- flowers: colourful patches on grass ----
    for (let i = 0; i < 3; i++) {
      if (rand() > 0.75) continue;
      const fx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const fz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const kind = [FLOWER_RED, FLOWER_YELLOW, FLOWER_BLUE][Math.floor(rand() * 3)];
      for (let p = 0; p < 4 + Math.floor(rand() * 4); p++) {
        const px = fx + Math.floor(rand() * 5) - 2;
        const pz = fz + Math.floor(rand() * 5) - 2;
        const h = this.getHeight(px, pz);
        if (this.get(px, h, pz) === GRASS && this.get(px, h + 1, pz) === AIR) this.set(px, h + 1, pz, kind);
      }
    }

    // ---- wild ground hives near flower patches (summer only, rare) ----
    if (rand() < 0.015) {
      const hx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const hz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const hh = this.getHeight(hx, hz);
      if (this.get(hx, hh, hz) === GRASS && this.get(hx, hh + 1, hz) === AIR) {
        // little post + hive on top, like an apiary stand
        this.set(hx, hh + 1, hz, FENCE_WOOD);
        this.set(hx, hh + 2, hz, HIVE);
      }
    }

    // ---- waterfall springs on tall cliffs ----
    if (rand() < 0.06) {
      const wx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const wz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const h = this.getHeight(wx, wz);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nh = this.getHeight(wx + dx, wz + dz);
        if (h - nh >= 6 && nh > LAVA_LEVEL + 1) {
          // a sheet of water pouring down the cliff face into a small plunge pool
          for (let y = h; y > nh; y--) {
            if (this.get(wx + dx, y, wz + dz) === AIR) this.set(wx + dx, y, wz + dz, WATER);
          }
          this.set(wx + dx, nh + 1, wz + dz, WATER);
          this.set(wx + dx * 2, nh + 1, wz + dz * 2, WATER);
          break;
        }
      }
    }

    // ---- surface ore pokes ----
    for (let i = 0; i < 4; i++) {
      if (rand() > 0.7) continue;
      const x = cx * CHUNK + 1 + Math.floor(rand() * 14);
      const z = cz * CHUNK + 1 + Math.floor(rand() * 14);
      const h = this.getHeight(x, z);
      const top = this.get(x, h, z);
      if (top !== GRASS && top !== STONE && top !== SAND) continue;
      const roll = rand();
      const kind = roll < 0.6 ? COAL : roll < 0.9 ? IRON : GOLD;
      this.placeOreColumn(x, z, kind, 1 + Math.floor(rand() * 2));
      if (rand() < 0.5) this.placeOreColumn(x + (rand() < 0.5 ? 1 : -1), z + (rand() < 0.5 ? 1 : -1), kind, 1);
    }

    // guaranteed starter vein in the spawn chunk area
    const scx = Math.floor(ORIGIN_X / CHUNK);
    const scz = Math.floor(ORIGIN_Z / CHUNK);
    if (Math.abs(cx - scx) <= 1 && Math.abs(cz - scz) <= 1) {
      for (let i = 0; i < 3; i++) {
        const x = cx * CHUNK + 2 + Math.floor(rand() * 12);
        const z = cz * CHUNK + 2 + Math.floor(rand() * 12);
        this.placeOreColumn(x, z, i < 2 ? COAL : IRON, 1 + (i % 2));
      }
    }

    // ---- structures (deterministic per chunk, rare) ----
    const sRand = mulberry32(this.seed * 101 + 41 + chunkKey(cx, cz) * 7919);
    const roll = sRand();
    // keep the spawn basin itself clear
    const nearSpawn = Math.abs(cx - scx) <= 1 && Math.abs(cz - scz) <= 1;
    if (!nearSpawn) {
      if (roll < 0.055) this.buildCottage(cx, cz, sRand);
      else if (roll < 0.085) this.buildTower(cx, cz, sRand);
      else if (roll < 0.105) this.buildRuinYard(cx, cz, sRand);
    }
  }

  private placeOreColumn(x: number, z: number, kind: number, depth: number) {
    const h = this.getHeight(x, z);
    const top = this.get(x, h, z);
    if (top === AIR || top === LEAVES) return;
    for (let i = 0; i < depth; i++) {
      if (h - i < 1) break;
      const cur = this.get(x, h - i, z);
      if (cur === AIR || cur === LAVA || cur === BEDROCK) break;
      this.set(x, h - i, z, kind);
    }
  }

  private growCactus(x: number, y: number, z: number, rand: () => number) {
    const block = rand() < 0.5 ? CACTUS : CACTUS_PALE;
    const h = 1 + Math.floor(rand() * 4); // 1 to 4 blocks tall
    for (let dy = 0; dy < h; dy++) {
      if (y + dy >= WY) break;
      this.set(x, y + dy, z, block);
    }
    // taller cacti can grow side arms
    if (h >= 3 && rand() < 0.45) {
      const armDirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const armDir = armDirs[Math.floor(rand() * armDirs.length)];
      const armY = y + 1 + Math.floor(rand() * Math.max(1, h - 2));
      if (this.get(x + armDir[0], armY, z + armDir[1]) === AIR) {
        this.set(x + armDir[0], armY, z + armDir[1], block);
        if (armY + 1 < WY) this.set(x + armDir[0], armY + 1, z + armDir[1], block);
      }
    }
    // 25% chance of flower blossom on top
    if (rand() < 0.25 && y + h < WY && this.get(x, y + h, z) === AIR) {
      this.set(x, y + h, z, rand() < 0.5 ? FLOWER_RED : FLOWER_YELLOW);
    }
  }

  private growDiverseTree(x: number, y: number, z: number, rand: () => number, winter = false) {
    if (winter) {
      if (rand() < 0.2) this.growBirch(x, y, z, rand, true);
      else this.growSpruce(x, y, z, rand);
      return;
    }
    const roll = rand();
    if (roll < 0.28) this.growStandardOak(x, y, z, rand);
    else if (roll < 0.48) this.growBushyOak(x, y, z, rand);
    else if (roll < 0.66) this.growBirch(x, y, z, rand, false);
    else if (roll < 0.82) this.growAppleTree(x, y, z, rand);
    else if (roll < 0.94) this.growGiantOak(x, y, z, rand);
    else this.growSmallBush(x, y, z, rand);

    // beehives on tree trunks (summer, 4.5% chance)
    if (rand() < 0.045) {
      for (const [hx, hz] of [
        [x + 1, z],
        [x - 1, z],
        [x, z + 1],
        [x, z - 1],
      ]) {
        const hy = y + 1 + Math.floor(rand() * 2);
        if (this.get(hx, hy, hz) === AIR) {
          this.set(hx, hy, hz, HIVE);
          break;
        }
      }
    }
  }

  private growSmallBush(x: number, y: number, z: number, rand: () => number) {
    const h = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < h; i++) this.set(x, y + i, z, LOG);
    const top = y + h;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && rand() < 0.5) continue;
        if (this.get(x + dx, top, z + dz) === AIR) this.set(x + dx, top, z + dz, LEAVES);
      }
    }
    this.set(x, top + 1, z, LEAVES);
  }

  private growStandardOak(x: number, y: number, z: number, rand: () => number) {
    const th = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const top = y + th;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy <= -1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() < 0.5) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, LEAVES);
        }
      }
    }
    if (top + 1 < WY) this.set(x, top + 1, z, LEAVES);
  }

  private growBushyOak(x: number, y: number, z: number, rand: () => number) {
    const th = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const top = y + th;
    for (let dy = -2; dy <= 2; dy++) {
      const r = dy === 0 ? 3 : Math.abs(dy) === 1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz > r * r + 0.5) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, LEAVES);
        }
      }
    }
    if (top + 2 < WY) this.set(x, top + 2, z, LEAVES);
  }

  private growGiantOak(x: number, y: number, z: number, rand: () => number) {
    const th = 8 + Math.floor(rand() * 5); // 8-12 blocks high
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    // branching arms
    const branchDirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
    ];
    const numBranches = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < numBranches; b++) {
      const dir = branchDirs[(b + Math.floor(rand() * 2)) % branchDirs.length];
      const by = y + 4 + Math.floor(rand() * Math.max(1, th - 5));
      const blen = 2 + Math.floor(rand() * 2);
      for (let step = 1; step <= blen; step++) {
        const bx = x + dir[0] * step;
        const bz = z + dir[1] * step;
        const curY = by + Math.floor(step / 2);
        if (curY < WY) this.set(bx, curY, bz, LOG);
        // leaf puff at branch end
        if (step === blen) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              for (let dz = -1; dz <= 1; dz++) {
                const ly = curY + dy;
                if (ly < WY && this.get(bx + dx, ly, bz + dz) === AIR) {
                  this.set(bx + dx, ly, bz + dz, LEAVES);
                }
              }
            }
          }
        }
      }
    }
    // massive top crown
    const top = y + th;
    for (let dy = -2; dy <= 2; dy++) {
      const r = dy === 0 ? 3 : Math.abs(dy) === 1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz > r * r + 0.8) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, LEAVES);
        }
      }
    }
    if (top + 2 < WY) this.set(x, top + 2, z, LEAVES);
  }

  private growBirch(x: number, y: number, z: number, rand: () => number, winter = false) {
    const leaf = winter ? SNOW_LEAVES : BIRCH_LEAVES;
    const th = 6 + Math.floor(rand() * 3);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, BIRCH_LOG);
    const top = y + th;
    for (let dy = -3; dy <= 1; dy++) {
      const r = dy === -2 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() < 0.6) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, leaf);
        }
      }
    }
    if (top + 1 < WY) this.set(x, top + 1, z, leaf);
  }

  private growAppleTree(x: number, y: number, z: number, rand: () => number) {
    const th = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const top = y + th;
    for (let dy = -2; dy <= 2; dy++) {
      const r = dy === 0 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() < 0.45) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) {
            this.set(x + dx, yy, z + dz, APPLE_LEAVES);
          }
        }
      }
    }
    if (top + 1 < WY) this.set(x, top + 1, z, APPLE_LEAVES);
  }

  private growSpruce(x: number, y: number, z: number, rand: () => number) {
    const th = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const top = y + th;
    for (let dy = -4; dy <= 1; dy++) {
      const r = dy === -4 || dy === -2 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rand() < 0.7) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) {
            this.set(x + dx, yy, z + dz, SNOW_LEAVES);
          }
        }
      }
    }
    if (top + 1 < WY) this.set(x, top + 1, z, SNOW_LEAVES);
  }

  // ---------------- structures ----------------
  private flatSpotInChunk(cx: number, cz: number, w: number, d: number, rand: () => number): [number, number, number] | null {
    for (let tries = 0; tries < 8; tries++) {
      const x = cx * CHUNK + Math.floor(rand() * (CHUNK - 2));
      const z = cz * CHUNK + Math.floor(rand() * (CHUNK - 2));
      let hMin = Infinity;
      let hMax = -Infinity;
      for (const [px, pz] of [
        [x, z],
        [x + w, z],
        [x, z + d],
        [x + w, z + d],
        [x + (w >> 1), z + (d >> 1)],
      ]) {
        const h = this.getHeight(px, pz);
        hMin = Math.min(hMin, h);
        hMax = Math.max(hMax, h);
      }
      if (hMax - hMin > 3 || hMin < SEA + 1 || hMax > 34) continue;
      return [x, hMin, z];
    }
    return null;
  }

  private clearBox(x0: number, y0: number, z0: number, w: number, h: number, d: number) {
    for (let y = y0; y < y0 + h; y++)
      for (let z = z0; z < z0 + d; z++)
        for (let x = x0; x < x0 + w; x++) this.set(x, y, z, AIR);
  }

  private fillFloor(x0: number, y: number, z0: number, w: number, d: number, id: number) {
    for (let z = z0; z < z0 + d; z++)
      for (let x = x0; x < x0 + w; x++) {
        this.set(x, y, z, id);
        let fy = y - 1;
        while (fy > 1) {
          const b = this.get(x, fy, z);
          if (b !== AIR && b !== LAVA) break;
          this.set(x, fy, z, COBBLE);
          fy--;
        }
      }
  }

  private buildCottage(cx: number, cz: number, rand: () => number) {
    const w = 5 + Math.floor(rand() * 2);
    const d = 5 + Math.floor(rand() * 2);
    const spot = this.flatSpotInChunk(cx, cz, w, d, rand);
    if (!spot) return;
    const [x0, y0, z0] = spot;
    const ruined = rand() < 0.45;
    const wallH = 3;
    this.clearBox(x0, y0 + 1, z0, w, wallH + 3, d);
    this.fillFloor(x0, y0, z0, w, d, PLANKS);
    const decay = (chance: number) => ruined && rand() < chance;

    for (let y = 1; y <= wallH; y++) {
      for (let x = x0; x < x0 + w; x++)
        for (const z of [z0, z0 + d - 1]) {
          const corner = x === x0 || x === x0 + w - 1;
          if (decay(0.35)) continue;
          this.set(x, y0 + y, z, corner ? LOG : COBBLE);
        }
      for (let z = z0 + 1; z < z0 + d - 1; z++)
        for (const x of [x0, x0 + w - 1]) {
          if (decay(0.35)) continue;
          this.set(x, y0 + y, z, COBBLE);
        }
    }
    const dx = x0 + (w >> 1);
    this.set(dx, y0 + 1, z0, ruined ? AIR : DOOR_WOOD);
    this.set(dx, y0 + 2, z0, ruined ? AIR : DOOR_WOOD);
    if (!decay(0.5)) this.set(x0, y0 + 2, z0 + (d >> 1), GLASS);
    if (!decay(0.5)) this.set(x0 + w - 1, y0 + 2, z0 + (d >> 1), GLASS);
    if (!decay(0.5)) this.set(x0 + (w >> 1) + 1, y0 + 2, z0 + d - 1, GLASS);
    if (!ruined) {
      for (let z = z0; z < z0 + d; z++)
        for (let x = x0; x < x0 + w; x++) this.set(x, y0 + wallH + 1, z, PLANKS);
    }
    this.set(x0 + 1, y0 + 1, z0 + 1, TORCH);
    if (rand() < 0.5) {
      const tx = x0 + w - 2;
      const tz = z0 + d - 2;
      this.set(tx, y0 + 1, tz, rand() < 0.3 ? GOLD_BLOCK : COAL);
      // trap: a lava pocket lurks right under the treasure
      if (rand() < 0.55) {
        for (let dy = 1; dy <= 2; dy++) this.set(tx, y0 - dy, tz, AIR);
        this.set(tx, y0 - 3, tz, LAVA);
      }
    }
    this.structureSites.push({ x: x0 + (w >> 1), y: y0 + 1, z: z0 + (d >> 1), kind: 'cottage' });
  }

  private buildTower(cx: number, cz: number, rand: () => number) {
    const spot = this.flatSpotInChunk(cx, cz, 5, 5, rand);
    if (!spot) return;
    const [x0, y0, z0] = spot;
    const ruined = rand() < 0.35;
    const h = ruined ? 4 + Math.floor(rand() * 3) : 8 + Math.floor(rand() * 3);
    this.clearBox(x0, y0 + 1, z0, 5, h + 3, 5);
    this.fillFloor(x0, y0, z0, 5, 5, COBBLE);
    for (let y = 1; y <= h; y++) {
      for (let x = x0; x < x0 + 5; x++)
        for (const z of [z0, z0 + 4])
          if (!(ruined && rand() < 0.25)) this.set(x, y0 + y, z, y % 3 === 0 && rand() < 0.3 ? STONE : COBBLE);
      for (let z = z0 + 1; z < z0 + 4; z++)
        for (const x of [x0, x0 + 4])
          if (!(ruined && rand() < 0.25)) this.set(x, y0 + y, z, COBBLE);
    }
    this.set(x0 + 2, y0 + 1, z0, AIR);
    this.set(x0 + 2, y0 + 2, z0, AIR);
    if (!ruined) {
      this.set(x0 + 2, y0 + Math.min(h - 1, 4), z0 + 4, GLASS);
      for (let x = x0; x < x0 + 5; x++)
        for (const z of [z0, z0 + 4]) if ((x + z) % 2 === 0) this.set(x, y0 + h + 1, z, FENCE_STONE);
      for (let z = z0; z < z0 + 5; z++)
        for (const x of [x0, x0 + 4]) if ((x + z) % 2 === 0) this.set(x, y0 + h + 1, z, FENCE_STONE);
      for (let z = z0 + 1; z < z0 + 4; z++)
        for (let x = x0 + 1; x < x0 + 4; x++) this.set(x, y0 + h, z, PLANKS);
      this.set(x0 + 2, y0 + h + 1, z0 + 2, TORCH);
    }
    this.set(x0 + 1, y0 + 1, z0 + 1, TORCH);
    // towers always hoard something worth guarding
    this.set(x0 + 3, y0 + 1, z0 + 3, rand() < 0.5 ? GOLD_BLOCK : COAL);
    if (rand() < 0.5) {
      // trapped doorway: thin sand bridge over a lava pit just inside
      this.set(x0 + 2, y0, z0 + 1, SAND);
      this.set(x0 + 2, y0 - 1, z0 + 1, AIR);
      this.set(x0 + 2, y0 - 2, z0 + 1, LAVA);
    }
    this.structureSites.push({ x: x0 + 2, y: y0 + 1, z: z0 + 2, kind: 'tower' });
  }

  private buildRuinYard(cx: number, cz: number, rand: () => number) {
    const spot = this.flatSpotInChunk(cx, cz, 7, 7, rand);
    if (!spot) return;
    const [x0, y0, z0] = spot;
    for (let x = x0; x < x0 + 7; x++)
      for (const z of [z0, z0 + 6]) if (rand() < 0.8) this.set(x, y0 + 1, z, rand() < 0.7 ? FENCE_WOOD : AIR);
    for (let z = z0; z < z0 + 7; z++)
      for (const x of [x0, x0 + 6]) if (rand() < 0.8) this.set(x, y0 + 1, z, rand() < 0.7 ? FENCE_WOOD : AIR);
    for (let i = 0; i < 8; i++) {
      const x = x0 + 1 + Math.floor(rand() * 5);
      const z = z0 + 1 + Math.floor(rand() * 5);
      this.set(x, y0 + 1, z, rand() < 0.6 ? COBBLE : STONE);
      if (rand() < 0.3) this.set(x, y0 + 2, z, COBBLE);
    }
    this.set(x0 + 3, y0 + 1, z0 + 3, rand() < 0.5 ? GOLD_BLOCK : TORCH);
  }

  findSpawn(): [number, number, number] {
    for (let tries = 0; tries < 600; tries++) {
      const r = 10 + (tries / 600) * 26;
      const x = Math.round(ORIGIN_X + (Math.random() * 2 - 1) * r);
      const z = Math.round(ORIGIN_Z + (Math.random() * 2 - 1) * r);
      if (!this.hasColumn(x, z)) continue;
      const h = this.getHeight(x, z);
      if (h < SEA + 2 || h > 30) continue;
      const top = this.get(x, h, z);
      if (top !== GRASS && top !== SNOW_GRASS) continue;
      if (this.get(x, h + 1, z) !== AIR || this.get(x, h + 2, z) !== AIR) continue;
      let lava = false;
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++)
          for (let y = h - 3; y <= h + 1; y++) if (this.get(x + dx, y, z + dz) === LAVA) lava = true;
      if (lava) continue;
      return [x + 0.5, h + 1.02, z + 0.5];
    }
    const h = this.topSolidY(ORIGIN_X, ORIGIN_Z);
    return [ORIGIN_X + 0.5, h + 1.02, ORIGIN_Z + 0.5];
  }
}
