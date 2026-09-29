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
  FLOWER_BLUE, DRY_BLOOM, DESERT_THISTLE,
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
  VOLCANIC_STONE, PALM_LOG, COCONUT_LEAVES, BANANA_LEAVES, VINE, MUSHROOM, isFlower,
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
export type Biome = 'winter' | 'plains' | 'jungle' | 'desert' | 'canyon' | 'volcanic';

const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};

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
  private volcanoes = new Map<string, { x: number; z: number; radius: number; active: boolean } | null>();
  /** castles & towers register here so the engine can post guards + traps */
  structureSites: Array<{ x: number; y: number; z: number; kind: 'tower' | 'cottage' }> = [];

  constructor(seed = 1337) {
    this.seed = seed;
  }

  reset(seed: number) {
    this.seed = seed;
    this.chunks.clear();
    this.volcanoes.clear();
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

  /** Bees should hatch into the world at flowers, never on ice or in open water. */
  findFlowerNear(x: number, z: number, r: number): [number, number, number] | null {
    for (let i = 0; i < 42; i++) {
      const px = Math.floor(x + (Math.random() * 2 - 1) * r);
      const pz = Math.floor(z + (Math.random() * 2 - 1) * r);
      if (!this.hasColumn(px, pz) || this.biomeAt(px, pz) === 'winter') continue;
      const h = this.getHeight(px, pz);
      if (isFlower(this.get(px, h + 1, pz))) return [px + 0.5, h + 1, pz + 0.5];
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

  private humidityAt(x: number, z: number) {
    return fbm2(x * 0.006 + 103, z * 0.006 - 71, 3);
  }

  /** Seeded volcano centres are shared across chunks, including negative coordinates. */
  volcanoAt(x: number, z: number) {
    if (this.volcanoes.size > 2048) this.volcanoes.clear();
    const cx = Math.floor(x / 144), cz = Math.floor(z / 144);
    let nearest: { x: number; z: number; radius: number; active: boolean; distance: number } | null = null;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ix = cx + dx, iz = cz + dz, key = `${ix},${iz}`;
      if (!this.volcanoes.has(key)) {
        const rng = mulberry32(this.seed ^ Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663) ^ 0x6a42d3);
        this.volcanoes.set(key, rng() < 0.29 ? {
          x: ix * 144 + 24 + rng() * 96,
          z: iz * 144 + 24 + rng() * 96,
          radius: 25 + rng() * 8,
          active: rng() < 0.55,
        } : null);
      }
      const v = this.volcanoes.get(key);
      if (!v || Math.hypot(v.x - ORIGIN_X, v.z - ORIGIN_Z) < 55) continue;
      const distance = Math.hypot(x - v.x, z - v.z);
      if (distance < v.radius + 48 && (!nearest || distance - v.radius < nearest.distance - nearest.radius))
        nearest = { ...v, distance };
    }
    return nearest;
  }

  biomeAt(x: number, z: number, h?: number): Biome {
    const volcano = this.volcanoAt(x, z);
    if (volcano && volcano.distance < volcano.radius) return 'volcanic';
    const height = h ?? this.heightAt(x, z);
    if (this.isWinter(x, z, height)) return 'winter';
    const humidity = this.humidityAt(x, z);
    const heat = this.temperatureAt(x, z, SEA + 6);
    if (heat > 0.03 && humidity < -0.26) return 'canyon';
    if (heat > -0.02 && humidity < -0.1) return 'desert';
    if (heat > 0.02 && humidity > 0.12) return 'jungle';
    return 'plains';
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
    // Meandering rivers and broad, multi-chunk lake basins in humid regions.
    const valley = Math.abs(fbm2(x * 0.019 + 61, z * 0.019 - 52, 3));
    if (valley < 0.1) h -= (0.1 - valley) * 30;
    const humidity = this.humidityAt(x, z);
    const lake = fbm2(x * 0.008 - 52, z * 0.008 + 97, 3);
    h -= smooth((lake - 0.18) / 0.22) * 15 * smooth((humidity + 0.15) * 4);

    // Warm dry plateaus are carved by narrow ravines; desert dunes are low
    // and rolling. Blend the relief gradually across biome boundaries.
    const heat = this.temperatureAt(x, z, SEA + 6);
    const dry = smooth((-humidity - 0.06) * 5) * smooth((heat + 0.04) * 5);
    const ravine = Math.abs(fbm2(x * 0.017 + 31, z * 0.017 - 83, 3));
    h += dry * (3 + fbm2(x * 0.04, z * 0.04, 2) * 2 - smooth((0.16 - ravine) / 0.12) * 15);

    const volcano = this.volcanoAt(x, z);
    if (volcano && volcano.distance < volcano.radius) {
      h += smooth((volcano.radius - volcano.distance) / volcano.radius) * 18;
      // depressed crater rim, open to the sky instead of a solid lava tower
      if (volcano.distance < 5) h -= smooth((5 - volcano.distance) / 5) * 6;
    }

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
        const biome = this.biomeAt(x, z, h);
        const winter = biome === 'winter';

        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = BEDROCK;
          else if (y === h) {
            if (biome === 'volcanic') id = VOLCANIC_STONE;
            else if (h <= SEA + 1 || biome === 'desert') id = SAND;
            else if (biome === 'canyon') id = h % 6 < 3 ? STONE : SAND;
            else if (h > 30) id = winter ? SNOW_GRASS : STONE;
            else id = winter ? SNOW_GRASS : GRASS;
          } else if (biome === 'volcanic' && y > h - 6) id = VOLCANIC_STONE;
          else if (biome === 'canyon' && y > SEA + 2) id = Math.floor(y / 3) % 2 ? STONE : SAND;
          else if (y > h - 4) id = biome === 'desert' || h <= SEA + 1 ? SAND : h > 30 ? STONE : DIRT;
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
        // An active crater and its narrow downslope lava tongue.
        const volcano = biome === 'volcanic' ? this.volcanoAt(x, z) : null;
        if (volcano?.active && h > SEA + 3 && h + 1 < WY - 1) {
          const dx = x - volcano.x, dz = z - volcano.z;
          const along = (dx + dz) * 0.707;
          const cross = Math.abs(dx - dz) * 0.707;
          if ((volcano.distance < 3 || (along > 2 && along < volcano.radius * 0.7 && cross < 1.4)) &&
              [[1,0],[-1,0],[0,1],[0,-1]].every(([ox,oz]) => this.heightAt(x + ox, z + oz) > SEA + 2)) {
            // Stop tongues before a lake or ice edge: don't initialize thousands
            // of natural contacts. Player-disturbed fluids still react normally.
            chunk.blocks[cidx(lx, h + 1, lz)] = LAVA;
          }
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

    // Generation may place sea water after cave lava (or the neighbour chunk
    // may already contain water). Resolve every newly generated contact now,
    // before the chunk is ever shown; no waiting for the player's fluid queue.
    const contacts: Array<[number, number, number]> = [];
    for (let lz = 0; lz < CHUNK; lz++) for (let lx = 0; lx < CHUNK; lx++) {
      const x = cx * CHUNK + lx, z = cz * CHUNK + lz;
      for (let y = 1; y < WY; y++) {
        const id = this.get(x,y,z);
        const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        if (id === LAVA && dirs.some(([dx,dy,dz]) => this.get(x+dx,y+dy,z+dz) === WATER))
          contacts.push([x,y,z]);
        // Water may have just been generated on this side of a chunk border,
        // while its contacting lava belonged to an already-generated chunk.
        if (id === WATER) for (const [dx,dy,dz] of dirs)
          if (this.get(x+dx,y+dy,z+dz) === LAVA) contacts.push([x+dx,y+dy,z+dz]);
      }
    }
    for (const [x,y,z] of contacts) this.set(x,y,z, VOLCANIC_STONE);
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
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const h = chunk.height[lz * CHUNK + lx];
        const biome = this.biomeAt(x, z, h);
        if (rand() > (biome === 'jungle' ? 0.11 : 0.04)) continue;
        const top = this.get(x, h, z);
        const winter = top === SNOW_GRASS;
        if (top !== GRASS && !winter) continue;
        if (winter && rand() < 0.35) continue; // taiga
        if (h < SEA + 2 || h > (winter ? 34 : 30)) continue;
        let ok = true;
        for (let dz = -2; dz <= 2 && ok; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            const b = this.get(x + dx, h + 2, z + dz);
            if (b === LOG || b === BIRCH_LOG || b === PALM_LOG) {
              ok = false;
              break;
            }
          }
        if (!ok) continue;
        if (biome === 'jungle' && rand() < 0.48) this.growPalm(x, h + 1, z, rand);
        else this.growDiverseTree(x, h + 1, z, rand, winter, biome === 'jungle');
      }
    }

    // ---- cacti of various sizes and colors on sand ----
    for (let i = 0; i < 4; i++) {
      if (rand() > 0.6) continue;
      const x = cx * CHUNK + 1 + Math.floor(rand() * 14);
      const z = cz * CHUNK + 1 + Math.floor(rand() * 14);
      const h = this.getHeight(x, z);
      if ((this.biomeAt(x, z, h) === 'desert' || this.biomeAt(x, z, h) === 'canyon') &&
        this.get(x, h, z) === SAND && this.get(x, h + 1, z) === AIR && h > SEA) {
        this.growCactus(x, h + 1, z, rand);
      }
    }

    // ---- ground cover: especially dense ferns in the jungle ----
    const lush = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8) === 'jungle';
    for (let i = 0; i < (lush ? 12 : 4); i++) {
      if (rand() > 0.8) continue;
      const gx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const gz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const plantId = rand() < (lush ? 0.25 : 0.65) ? TALL_GRASS : FERN;
      for (let p = 0; p < 3 + Math.floor(rand() * 4); p++) {
        const px = gx + Math.floor(rand() * 5) - 2;
        const pz = gz + Math.floor(rand() * 5) - 2;
        const h = this.getHeight(px, pz);
        if (this.get(px, h, pz) === GRASS && this.get(px, h + 1, pz) === AIR) this.set(px, h + 1, pz, plantId);
      }
    }

    // ---- small mushroom clusters in warm, leafy forest floors ----
    if (['plains', 'jungle'].includes(this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8))) {
      for (let i = 0; i < 5; i++) {
        if (rand() > 0.62) continue;
        const mx = cx * CHUNK + 1 + Math.floor(rand() * 14);
        const mz = cz * CHUNK + 1 + Math.floor(rand() * 14);
        const mh = this.getHeight(mx, mz);
        if (this.get(mx, mh, mz) === GRASS && this.get(mx, mh + 1, mz) === AIR &&
            this.get(mx, mh + 2, mz) === AIR && !this.isWinter(mx, mz, mh))
          this.set(mx, mh + 1, mz, MUSHROOM);
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

    // Sparse, drought-tolerant blooms on open desert and canyon sand.
    for (let i = 0; i < 5; i++) {
      if (rand() > 0.75) continue;
      const x = cx * CHUNK + 1 + Math.floor(rand() * 14);
      const z = cz * CHUNK + 1 + Math.floor(rand() * 14);
      const h = this.getHeight(x, z);
      if (this.get(x, h, z) === SAND && this.get(x, h + 1, z) === AIR &&
          ['desert', 'canyon'].includes(this.biomeAt(x, z, h)))
        this.set(x, h + 1, z, rand() < 0.5 ? DRY_BLOOM : DESERT_THISTLE);
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

    // ---- springs over jungle escarpments and canyon walls ----
    const cliffBiome = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8);
    const springChance = cliffBiome === 'jungle' ? 0.65 : cliffBiome === 'canyon' ? 0.45 : 0.12;
    if (rand() < springChance) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const wx = cx * CHUNK + 2 + Math.floor(rand() * 12);
        const wz = cz * CHUNK + 2 + Math.floor(rand() * 12);
        const h = this.getHeight(wx, wz);
        if (this.get(wx, h + 1, wz) !== AIR) continue;
        let placed = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nh = this.getHeight(wx + dx, wz + dz);
          if (h - nh < 4 || nh <= LAVA_LEVEL + 1) continue;
          this.set(wx, h + 1, wz, WATER); // spring at the lip of the cliff
          for (let y = h; y > nh; y--) {
            if (this.get(wx + dx, y, wz + dz) === AIR) this.set(wx + dx, y, wz + dz, WATER);
          }
          for (let step = 1; step <= 2; step++) {
            const px = wx + dx * step;
            const pz = wz + dz * step;
            const poolY = this.getHeight(px, pz) + 1;
            if (this.get(px, poolY, pz) === AIR) this.set(px, poolY, pz, WATER);
          }
          placed = true;
          break;
        }
        if (placed) break;
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

  private growPalm(x: number, y: number, z: number, rand: () => number) {
    const height = 6 + Math.floor(rand() * 4);
    if (y + height + 3 >= WY) return;
    const leaf = rand() < 0.5 ? COCONUT_LEAVES : BANANA_LEAVES;
    for (let i = 0; i < height; i++) if (this.get(x, y + i, z) === AIR) this.set(x, y + i, z, PALM_LOG);
    const crown = y + height;
    let vines = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const r = Math.abs(dx) + Math.abs(dz);
      if (r > 3 || (r === 3 && rand() < 0.3)) continue;
      const py = crown - (r >= 3 ? 1 : 0);
      if (this.get(x + dx, py, z + dz) === AIR) this.set(x + dx, py, z + dz, leaf);
      // hanging climbable vines on the outer leaves
      if (r === 3 && vines < 3 && rand() < 0.5) {
        vines++;
        for (let v = 1; v < height; v++) {
          if (this.get(x + dx, py - v, z + dz) !== AIR) break;
          this.set(x + dx, py - v, z + dz, VINE);
        }
      }
    }
    if (this.get(x, crown + 1, z) === AIR) this.set(x, crown + 1, z, leaf);
  }

  private growDiverseTree(x: number, y: number, z: number, rand: () => number, winter = false, jungle = false) {
    if (winter) {
      if (rand() < 0.2) this.growBirch(x, y, z, rand, true);
      else this.growSpruce(x, y, z, rand);
      return;
    }
    if (jungle) {
      if (rand() < 0.72) this.growGiantOak(x, y, z, rand);
      else this.growBushyOak(x, y, z, rand);
    } else {
      const roll = rand();
      if (roll < 0.28) this.growStandardOak(x, y, z, rand);
      else if (roll < 0.48) this.growBushyOak(x, y, z, rand);
      else if (roll < 0.66) this.growBirch(x, y, z, rand, false);
      else if (roll < 0.82) this.growAppleTree(x, y, z, rand);
      else if (roll < 0.94) this.growGiantOak(x, y, z, rand);
      else this.growSmallBush(x, y, z, rand);
    }

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
