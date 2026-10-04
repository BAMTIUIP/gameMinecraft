import {
  AIR,
  GRASS,
  DIRT,
  STONE,
  COBBLE,
  LOG,
  LEAVES,
  SAND,
  BEDROCK,
  LAVA,
  PLANKS,
  GLASS,
  DOOR_WOOD,
  DOOR_IRON,
  FENCE_STONE,
  FENCE_WOOD,
  TORCH,
  GOLD_BLOCK,
  WATER,
  FLOWER_RED,
  FLOWER_YELLOW,
  FLOWER_BLUE,
  FLOWER_PINK,
  FLOWER_PURPLE,
  FLOWER_WHITE,
  DRY_BLOOM,
  DESERT_THISTLE,
  SNOW_GRASS,
  ICE,
  SNOW_LEAVES,
  HIVE,
  NETHERITE_ORE,
  CHEST_BY_BIOME,
  CHEST_UNDERWATER,
  isSolid,
  TALL_GRASS,
  FERN,
  DEAD_BUSH,
  CACTUS,
  CACTUS_PALE,
  BIRCH_LOG,
  BIRCH_LEAVES,
  AUTUMN_LEAVES,
  CHERRY_LEAVES,
  JACARANDA_LEAVES,
  APPLE_LEAVES,
  VOLCANIC_STONE, PALM_LOG, COCONUT_LEAVES, BANANA_LEAVES, VINE, MUSHROOM, SANDSTONE,
  COAL_ORE, IRON_ORE, REDSTONE_ORE, GOLD_ORE, LAPIS_ORE, DIAMOND_ORE, EMERALD_ORE, QUARTZ_ORE,
  COAL_BLOCK,
  isCutout, isFlower,
  FARMLAND, WHEAT_CROP_2, WHEAT_CROP_3, WEB,
} from './blocks';
import { isDesertMountainTransition, spawnDesertBiomeStructures } from './desertAssets';
import { buildCliffsideCarvedTemple } from './desertLandmarks';
import { fbm2, fbm3, mulberry32, noise3, seedNoise } from './noise';

/**
 * Streaming voxel world: chunks generate on demand as the player travels,
 * so the map never ends. Legacy WX/WZ mark the "starter" area only.
 */
// Keep the playable vertical span compact on mobile: 150 blocks below the raised surface.
// This reduces voxel generation and texture shimmer without changing the surface gameplay.
export const WY = 210;
export const CHUNK = 16;
export const SEA = 162; // surface and sea are lifted 150 blocks above bedrock
/** Minimum Y stored in the fast menu preview; only the visible surface band is needed there. */
export const SURFACE_MESH_MIN_Y = Math.max(0, Math.floor((SEA - 24) / 32) * 32);
export const LAVA_LEVEL = 6;
// legacy constants — the pre-generated spawn region (8×8 chunks)
export const WX = 128;
export const WZ = 128;
export const CX = WX / CHUNK;
export const CZ = WZ / CHUNK;
/** world origin the spawn basin is carved around */
export const ORIGIN_X = 64;
export const ORIGIN_Z = 64;
export type Biome = 'winter' | 'plains' | 'autumn' | 'jungle' | 'desert' | 'canyon' | 'volcanic';

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
  /** 0 = empty/preview, 1 = full terrain, 2 = decorated */
  state: number;
  /** True once the visible surface band is ready; lower voxel layers may still be empty. */
  surfaceReady?: boolean;
  /** Surface-only foliage was added for the menu preview; full decoration still runs after terrain. */
  surfaceDecorated?: boolean;
};

const cidx = (lx: number, y: number, lz: number) => (y * CHUNK + lz) * CHUNK + lx;
const FLUID_NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

export class World {
  chunks = new Map<number, Chunk>();
  seed: number;
  private terrainJobs = new Map<number, Generator<void, void, void>>();
  private surfaceJobs = new Map<number, Generator<void, void, void>>();
  private volcanoes = new Map<string, { x: number; z: number; radius: number; active: boolean } | null>();
  /** castles & towers register here so the engine can post guards + traps */
  structureSites: Array<{ x: number; y: number; z: number; kind: 'tower' | 'cottage' | 'ruin' }> = [];

  constructor(seed = 1337) {
    this.seed = seed;
  }

  reset(seed: number) {
    this.seed = seed;
    this.chunks.clear();
    this.terrainJobs.clear();
    this.surfaceJobs.clear();
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

  hasSurface(cx: number, cz: number) {
    const chunk = this.getChunk(cx, cz);
    return !!chunk && (chunk.state >= 1 || chunk.surfaceReady === true);
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
    if (!c || (c.state < 1 && !c.surfaceReady) || (c.state < 1 && y < SURFACE_MESH_MIN_Y)) return AIR;
    return c.blocks[cidx(((x % CHUNK) + CHUNK) % CHUNK, y, ((z % CHUNK) + CHUNK) % CHUNK)];
  }

  /** silently ignored when the chunk or requested underground layer isn't generated yet */
  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= WY) return;
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!c || (c.state < 1 && (!c.surfaceReady || y < SURFACE_MESH_MIN_Y))) return;
    c.blocks[cidx(((x % CHUNK) + CHUNK) % CHUNK, y, ((z % CHUNK) + CHUNK) % CHUNK)] = id;
  }

  getHeight(x: number, z: number): number {
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (!c || (c.state < 1 && !c.surfaceReady)) return this.heightAt(x, z);
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
    if (hh > SEA + 14) t -= (hh - (SEA + 14)) * 0.025; // mountain tops freeze
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
    // Keep dry biomes special instead of the default: deserts need both heat and low humidity.
    // This makes “New world” seeds feel varied instead of desert-dominated.
    if (heat > 0.15 && humidity < -0.42) return 'canyon';
    if (heat > 0.08 && humidity < -0.18) return 'desert';
    if (heat > 0.02 && humidity > 0.12) return 'jungle';
    // Temperate shoulder-climate grows its own deciduous woodland: amber maples
    // and asters, rather than making every non-frozen greenland look identical.
    if (heat > -0.16 && heat < 0.14 && humidity > -0.28 && humidity < 0.18) return 'autumn';
    // The remaining temperate grassland is the warm/summer palette.
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

    // Warm dry plateaus in canyons are carved by narrow ravines, while desert
    // biomes flatten out into broad, gently terraced sandy plains with soft
    // long-wavelength dunes and occasional meandering river/oasis channels.
    const heat = this.temperatureAt(x, z, SEA + 6);
    const warmFactor = smooth((heat + 0.04) * 9);
    const desertPlain = warmFactor * smooth((-humidity - 0.06) * 10) * (1 - smooth((-humidity - 0.34) * 9));
    if (desertPlain > 0) {
      const duneBroad = fbm2(x * 0.01 + 19.3, z * 0.01 - 27.1, 2) * 2.0;
      const duneRipple = fbm2(x * 0.024 - 14.2, z * 0.024 + 33.7, 2) * 0.6;
      const farDuneMound = Math.max(0, fbm2(x * 0.006 - 41, z * 0.006 + 13, 2) - 0.24) * 5.5;
      const oasisChannel = valley < 0.075 ? (0.075 - valley) * 50 : 0;
      const desertH = SEA + 3.2 + duneBroad + duneRipple + farDuneMound - oasisChannel;
      h = h * (1 - desertPlain * 0.9) + desertH * (desertPlain * 0.9);
    }
    const canyonFactor = warmFactor * smooth((-humidity - 0.33) * 10);
    if (canyonFactor > 0) {
      const ravine = Math.abs(fbm2(x * 0.017 + 31, z * 0.017 - 83, 3));
      h += canyonFactor * (2.2 - smooth((0.16 - ravine) / 0.12) * 5.5);
    }

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

  /** Build a fast, shallow chunk for the animated menu camera without generating caves or deep ores. */
  genSurface(cx: number, cz: number) {
    while (!this.advanceSurface(cx, cz, Number.MAX_SAFE_INTEGER)) {}
  }

  /** Advance a preview chunk by a bounded number of columns; full terrain remains a separate stage. */
  advanceSurface(cx: number, cz: number, columnBudget = 1): boolean {
    const key = chunkKey(cx, cz);
    if (this.hasSurface(cx, cz)) return true;
    let job = this.surfaceJobs.get(key);
    if (!job) {
      job = this.generateSurfaceSteps(cx, cz);
      this.surfaceJobs.set(key, job);
    }
    const budget = Math.max(1, Math.floor(columnBudget));
    for (let i = 0; i < budget; i++) {
      const next = job.next();
      if (next.done) {
        this.surfaceJobs.delete(key);
        return true;
      }
    }
    return false;
  }

  private *generateSurfaceSteps(cx: number, cz: number): Generator<void, void, void> {
    const key = chunkKey(cx, cz);
    if (this.hasSurface(cx, cz)) return;
    const chunk: Chunk = {
      blocks: new Uint8Array(CHUNK * WY * CHUNK),
      height: new Int16Array(CHUNK * CHUNK),
      state: 0,
      surfaceReady: false,
    };
    // Expose this buffer only after all columns in the surface band have finished.
    this.chunks.set(key, chunk);
    const minY = SURFACE_MESH_MIN_Y;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const h = this.heightAt(x, z);
        chunk.height[lz * CHUNK + lx] = h;
        const biome = this.biomeAt(x, z, h);
        const winter = biome === 'winter';

        for (let y = minY; y <= h; y++) {
          let id: number;
          if (y === h) {
            if (biome === 'volcanic') id = VOLCANIC_STONE;
            else if (h <= SEA + 1 || biome === 'desert') id = SAND;
            else if (biome === 'canyon') id = h % 6 < 3 ? STONE : SAND;
            else if (h > SEA + 18) id = winter ? SNOW_GRASS : STONE;
            else id = winter ? SNOW_GRASS : GRASS;
          } else if (biome === 'volcanic' && y > h - 6) id = VOLCANIC_STONE;
          else if (biome === 'canyon' && y > SEA + 2) id = Math.floor(y / 3) % 2 ? STONE : SAND;
          else if (biome === 'desert' && y > h - 3) id = SAND;
          else if (biome === 'desert' && y > h - 7) id = SANDSTONE;
          else if (y > h - 4) id = h <= SEA + 1 ? SAND : h > SEA + 18 ? STONE : DIRT;
          else id = STONE;
          chunk.blocks[cidx(lx, y, lz)] = id;
        }

        if (h <= SEA) {
          for (let y = Math.max(minY, h + 1); y <= SEA; y++)
            chunk.blocks[cidx(lx, y, lz)] = WATER;
          if (winter && SEA >= minY && chunk.blocks[cidx(lx, SEA, lz)] === WATER)
            chunk.blocks[cidx(lx, SEA, lz)] = ICE;
        }

        const volcano = biome === 'volcanic' ? this.volcanoAt(x, z) : null;
        if (volcano?.active && h > SEA + 3 && h + 1 < WY - 1 &&
            (volcano.distance < 3 || ((x - volcano.x + z - volcano.z) * 0.707 > 2 &&
              ((x - volcano.x + z - volcano.z) * 0.707) < volcano.radius * 0.7 &&
              Math.abs((x - volcano.x - (z - volcano.z)) * 0.707) < 1.4)) &&
            [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oz]) => this.heightAt(x + ox, z + oz) > SEA + 2)) {
          chunk.blocks[cidx(lx, h + 1, lz)] = LAVA;
        }
        yield;
      }
    }
    chunk.surfaceReady = true;
  }

  /** stage 1: raw terrain, ores, caves, lava — synchronous helper for generation tools/tests. */
  genTerrain(cx: number, cz: number) {
    this.advanceTerrain(cx, cz, Number.MAX_SAFE_INTEGER);
  }

  /** Advance at most `columnBudget` terrain columns; return true when the chunk is complete. */
  advanceTerrain(cx: number, cz: number, columnBudget = 1): boolean {
    const key = chunkKey(cx, cz);
    if ((this.chunks.get(key)?.state ?? 0) >= 1) return true;
    this.surfaceJobs.delete(key);
    let job = this.terrainJobs.get(key);
    if (!job) {
      job = this.generateTerrainSteps(cx, cz);
      this.terrainJobs.set(key, job);
    }
    const budget = Math.max(1, Math.floor(columnBudget));
    for (let i = 0; i < budget; i++) {
      const next = job.next();
      if (next.done) {
        this.terrainJobs.delete(key);
        return true;
      }
    }
    return false;
  }

  private *generateTerrainSteps(cx: number, cz: number): Generator<void, void, void> {
    const key = chunkKey(cx, cz);
    if ((this.chunks.get(key)?.state ?? 0) >= 1) return;
    const chunk: Chunk = {
      blocks: new Uint8Array(CHUNK * WY * CHUNK),
      height: new Int16Array(CHUNK * CHUNK),
      state: 0,
    };
    // Keep any fast menu-surface chunk live until its full-depth replacement is complete.
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
            else if (h > SEA + 18) id = winter ? SNOW_GRASS : STONE;
            else id = winter ? SNOW_GRASS : GRASS;
          } else if (biome === 'volcanic' && y > h - 6) id = VOLCANIC_STONE;
          else if (biome === 'canyon' && y > SEA + 2) id = Math.floor(y / 3) % 2 ? STONE : SAND;
          else if (biome === 'desert' && y > h - 3) id = SAND;
          else if (biome === 'desert' && y > h - 7) id = SANDSTONE;
          else if (y > h - 4) id = h <= SEA + 1 ? SAND : h > SEA + 18 ? STONE : DIRT;
          else id = STONE;
          chunk.blocks[cidx(lx, y, lz)] = id;
        }

        for (let y = 2; y < h - 3; y++) {
          if (chunk.blocks[cidx(lx, y, lz)] !== STONE) continue;
          const depth = y / WY;
          let ore = 0;
          let nF = 0, nG = 0;
          let hasNf = false, hasNg = false;
          // Sample only fields eligible at this depth, and reuse the lapis/redstone and
          // emerald/quartz fields instead of calculating them twice in the same cell.
          if (y < 14 && noise3(x * 0.31 + 97.3, y * 0.5 - 41, z * 0.31 - 77.7) > 0.74) ore = NETHERITE_ORE;
          if (!ore && y < 58) {
            nG = noise3(x * 0.28 + 71.2, y * 0.42 - 17, z * 0.28 - 48.9);
            hasNg = true;
            if (nG > 0.65 - depth * 0.2) ore = EMERALD_ORE;
          }
          if (!ore && y < 88 && noise3(x * 0.26 - 61.2, y * 0.4 + 19, z * 0.26 + 51.9) > 0.6 - depth * 0.24) ore = DIAMOND_ORE;
          if (!ore && y < 128) {
            nF = noise3(x * 0.24 - 18.5, y * 0.36 + 29, z * 0.24 + 63.4);
            hasNf = true;
            if (nF > 0.59 - depth * 0.15) ore = LAPIS_ORE;
          }
          if (!ore && y < 158 && noise3(x * 0.22 + 44.7, y * 0.34 - 12, z * 0.22 - 33.1) > 0.58 - depth * 0.16) ore = GOLD_ORE;
          if (!ore && y < 188) {
            if (!hasNf) nF = noise3(x * 0.24 - 18.5, y * 0.36 + 29, z * 0.24 + 63.4);
            if (nF < -0.56 + depth * 0.14) ore = REDSTONE_ORE;
          }
          if (!ore && y < 210) {
            if (!hasNg) nG = noise3(x * 0.28 + 71.2, y * 0.42 - 17, z * 0.28 - 48.9);
            if (nG < -0.57 + depth * 0.12) ore = QUARTZ_ORE;
          }
          if (!ore && y < 270 && noise3(x * 0.19 - 21.4, y * 0.3 + 5, z * 0.19 + 8.2) > 0.52 - depth * 0.1) ore = IRON_ORE;
          if (!ore && y < 318 && noise3(x * 0.17 + 3.1, y * 0.26, z * 0.17 - 1.7) > 0.46) ore = COAL_ORE;
          if (ore) chunk.blocks[cidx(lx, y, lz)] = ore;
        }

        const caveTop = biome === 'desert' ? h - 4 : h - 1;
        const fracture = Math.abs(fbm2(x * 0.021 + 147.2, z * 0.021 - 83.6, 3));
        const lavaChannel = Math.abs(fbm2(x * 0.014 - 71.8, z * 0.014 + 126.4, 3));
        const lavaLevel = 20 + Math.floor((fbm2(x * 0.008 + 19, z * 0.008 - 44, 2) + 1) * 54);
        const floodedCavern = fbm2(x * 0.019 + 43, z * 0.019 - 98, 2) < -0.28;
        for (let y = 2; y < caveTop; y++) {
          const at = cidx(lx, y, lz);
          let cur = chunk.blocks[at];
          if (cur === BEDROCK) continue;
          const c1 = fbm3(x * 0.055, y * 0.085, z * 0.055, 3);
          const bias = y < 14 ? 0.05 : 0.0;
          let c2 = 0;
          let c2Computed = false;
          if (cur !== AIR && c1 > 0.36 - bias) {
            chunk.blocks[at] = AIR;
            cur = AIR;
          } else if (cur !== AIR && y < 22) {
            c2 = fbm3(x * 0.11 + 90, y * 0.14 - 40, z * 0.11 + 30, 2);
            c2Computed = true;
            if (c2 > 0.52) {
              chunk.blocks[at] = AIR;
              cur = AIR;
            }
          }
          // Hairline cracks descend from high ground into the cave network; their secondary noise
          // is sampled only in the rare columns/layers that can actually form a crack.
          if (cur !== AIR && fracture < 0.022 && y >= SEA - 150 && y < h - 1) {
            if (!c2Computed) c2 = fbm3(x * 0.11 + 90, y * 0.14 - 40, z * 0.11 + 30, 2);
            if (c2 > -0.55) {
              chunk.blocks[at] = AIR;
              cur = AIR;
            }
          }
          if (cur !== AIR) continue;
          // Only evaluate the extra flood-noise field in columns and layers that can hold an underground lake.
          // This avoids a second fractal-noise sample for the majority of carved cave cells.
          const canFlood = floodedCavern && y > 18 && y < SEA - 54;
          const floodNoise = canFlood ? fbm3(x * 0.036 + 18, y * 0.043 - 14, z * 0.036 - 51, 2) : 1;
          if (canFlood && floodNoise < -0.22) {
            chunk.blocks[at] = WATER;
          } else if (y > 12 && y < SEA - 130 && lavaChannel < 0.052 && Math.abs(y - lavaLevel) <= 1 && c1 > 0.18) {
            // Long noisy channels intersect air pockets to form branching underground lava rivers.
            chunk.blocks[at] = LAVA;
          }
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
          // Lava reservoirs must never be visible beneath ocean/lake water.
          // Harden any deep lava in a flooded column before the chunk is shown.
          for (let y = 1; y <= SEA; y++) {
            if (chunk.blocks[cidx(lx, y, lz)] === LAVA) chunk.blocks[cidx(lx, y, lz)] = VOLCANIC_STONE;
          }
        }
        if (rand() < 0.004) {
          const hy = Math.max(1, h - 1);
          chunk.blocks[cidx(lx, hy, lz)] = biome === 'desert' ? SANDSTONE : COBBLE;
        }
        // Keep the main thread responsive: the engine resumes a small number of columns per frame.
        yield;
      }
    }

    // Resolve generated lava contacts without allocating a six-neighbour array for every voxel.
    // A contiguous byte scan is much cheaper than repeated World.get() calls across all 92k cells.
    const blocks = chunk.blocks;
    const layerSize = CHUNK * CHUNK;
    for (let index = 0; index < blocks.length; index++) {
      const id = blocks[index];
      if (id !== LAVA && id !== WATER) continue;
      const y = Math.floor(index / layerSize);
      const inLayer = index - y * layerSize;
      const lz = Math.floor(inLayer / CHUNK);
      const lx = inLayer - lz * CHUNK;
      const x = cx * CHUNK + lx;
      const z = cz * CHUNK + lz;

      if (id === LAVA) {
        let touchesWater = false;
        for (const [dx, dy, dz] of FLUID_NEIGHBORS) {
          let neighbor: number;
          const nx = lx + dx, nz = lz + dz, ny = y + dy;
          if (nx >= 0 && nx < CHUNK && nz >= 0 && nz < CHUNK && ny >= 0 && ny < WY)
            neighbor = blocks[cidx(nx, ny, nz)];
          else neighbor = this.get(x + dx, ny, z + dz);
          if (neighbor === WATER) { touchesWater = true; break; }
        }
        if (touchesWater) blocks[index] = VOLCANIC_STONE;
        continue;
      }

      // Newly added water at a horizontal chunk edge may meet lava in an older neighbour.
      if (lx === 0 && this.get(x - 1, y, z) === LAVA) this.set(x - 1, y, z, VOLCANIC_STONE);
      if (lx === CHUNK - 1 && this.get(x + 1, y, z) === LAVA) this.set(x + 1, y, z, VOLCANIC_STONE);
      if (lz === 0 && this.get(x, y, z - 1) === LAVA) this.set(x, y, z - 1, VOLCANIC_STONE);
      if (lz === CHUNK - 1 && this.get(x, y, z + 1) === LAVA) this.set(x, y, z + 1, VOLCANIC_STONE);
      if ((index & 4095) === 4095) yield;
    }
    chunk.state = 1;
    chunk.surfaceReady = true;
    this.chunks.set(key, chunk);
    this.surfaceJobs.delete(key);
  }

  /**
   * stage 2: trees, surface ore, occasional structures.
   * Caller guarantees the 8 neighbours have terrain, so writes can spill over.
   */
  decorate(cx: number, cz: number, surfaceOnly = false) {
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    if (surfaceOnly) {
      if (!chunk.surfaceReady || chunk.surfaceDecorated) return;
      chunk.surfaceDecorated = true;
    } else {
      if (chunk.state < 1 || chunk.state >= 2) return;
      chunk.state = 2;
    }
    const rand = mulberry32(this.seed * 31 + 7 + chunkKey(cx, cz) * 2654435761);

    // ---- seasonal tree forms: oaks, maples, cherry, birch, apple, spruce, palms ----
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const h = chunk.height[lz * CHUNK + lx];
        const biome = this.biomeAt(x, z, h);
        const treeChance = biome === 'jungle' ? 0.11 : biome === 'autumn' ? 0.075 : 0.04;
        if (rand() > treeChance) continue;
        const top = this.get(x, h, z);
        const winter = top === SNOW_GRASS;
        if (top !== GRASS && !winter) continue;
        if (winter && rand() < 0.35) continue; // open taiga clearings
        if (h < SEA + 2 || h > SEA + (winter ? 22 : biome === 'autumn' ? 19 : 18)) continue;
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
        else this.growDiverseTree(x, h + 1, z, rand, winter, biome === 'jungle', biome === 'autumn');
      }
    }

    // ---- small wild wheat plots seed the farming loop in open temperate biomes ----
    const farmBiome = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8);
    if ((farmBiome === 'plains' || farmBiome === 'autumn') && rand() < 0.13) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const fx = cx * CHUNK + 3 + Math.floor(rand() * 10);
        const fz = cz * CHUNK + 3 + Math.floor(rand() * 10);
        const h = this.getHeight(fx, fz);
        if (this.get(fx, h, fz) !== GRASS || Math.hypot(fx - ORIGIN_X, fz - ORIGIN_Z) < 20) continue;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const px = fx + dx, pz = fz + dz, soil = this.getHeight(px, pz);
          if (this.get(px, soil, pz) !== GRASS || this.get(px, soil + 1, pz) !== AIR) continue;
          this.set(px, soil, pz, FARMLAND);
          this.set(px, soil + 1, pz, rand() < 0.74 ? WHEAT_CROP_3 : WHEAT_CROP_2);
        }
        break;
      }
    }

    // ---- rare date palms punctuate otherwise open desert plains ----
    if (rand() < 0.07) {
      const x = cx * CHUNK + 3 + Math.floor(rand() * 10);
      const z = cz * CHUNK + 3 + Math.floor(rand() * 10);
      const h = this.getHeight(x, z);
      if (this.biomeAt(x,z,h) === 'desert' && h > SEA && this.get(x,h,z) === SAND &&
          this.get(x,h+1,z) === AIR && Math.hypot(x-ORIGIN_X,z-ORIGIN_Z) > 48)
        this.growPalm(x,h+1,z,rand);
    }

    // ---- cacti of various sizes, branching saguaros, barrel cacti, and opuntia on sand ----
    for (let i = 0; i < 6; i++) {
      if (rand() > 0.68) continue;
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
    if (['plains', 'autumn', 'jungle'].includes(this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8))) {
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

    // ---- dead bushes on sand (characteristic scattered dry shrubs across desert plains) ----
    const isDesertChunk = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8) === 'desert';
    for (let i = 0; i < (isDesertChunk ? 6 : 3); i++) {
      if (rand() > 0.8) continue;
      const bx = cx * CHUNK + 1 + Math.floor(rand() * 14);
      const bz = cz * CHUNK + 1 + Math.floor(rand() * 14);
      const h = this.getHeight(bx, bz);
      if (this.get(bx, h, bz) === SAND && this.get(bx, h + 1, bz) === AIR && h > SEA) {
        this.set(bx, h + 1, bz, DEAD_BUSH);
      }
    }

    // ---- seasonal flower meadows: summer blooms, autumn asters, jungle orchids ----
    const centerBiome = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8);
    const flowerPatches = centerBiome === 'jungle' ? 5 : centerBiome === 'autumn' ? 4 : 3;
    for (let i = 0; i < flowerPatches; i++) {
      if (rand() > 0.75) continue;
      const fx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const fz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const patchBiome = this.biomeAt(fx, fz, this.getHeight(fx, fz));
      const palette = patchBiome === 'autumn'
        ? [FLOWER_YELLOW, FLOWER_PURPLE, FLOWER_RED]
        : patchBiome === 'jungle'
          ? [FLOWER_PINK, FLOWER_WHITE, FLOWER_BLUE, FLOWER_RED]
          : [FLOWER_RED, FLOWER_YELLOW, FLOWER_BLUE, FLOWER_PINK, FLOWER_WHITE];
      const kind = palette[Math.floor(rand() * palette.length)];
      for (let p = 0; p < 4 + Math.floor(rand() * 5); p++) {
        const px = fx + Math.floor(rand() * 5) - 2;
        const pz = fz + Math.floor(rand() * 5) - 2;
        const h = this.getHeight(px, pz);
        const localBiome = this.biomeAt(px, pz, h);
        if (localBiome !== 'winter' && this.get(px, h, pz) === GRASS && this.get(px, h + 1, pz) === AIR)
          this.set(px, h + 1, pz, kind);
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
    const springChance = cliffBiome === 'jungle' ? 0.72 : cliffBiome === 'canyon' ? 0.55 : 0.18;
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

    // ---- surface ore pokes (keep open desert sand plains clean) ----
    for (let i = 0; i < 4; i++) {
      if (rand() > 0.7) continue;
      const x = cx * CHUNK + 1 + Math.floor(rand() * 14);
      const z = cz * CHUNK + 1 + Math.floor(rand() * 14);
      const h = this.getHeight(x, z);
      const top = this.get(x, h, z);
      if (this.biomeAt(x, z, h) === 'desert') continue;
      if (top !== GRASS && top !== STONE && top !== SAND) continue;
      const roll = rand();
      const kind =
        roll < 0.45
          ? COAL_ORE
          : roll < 0.72
            ? IRON_ORE
            : roll < 0.84
              ? GOLD_ORE
              : roll < 0.91
                ? REDSTONE_ORE
                : roll < 0.96
                  ? LAPIS_ORE
                  : QUARTZ_ORE;
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
        if (this.biomeAt(x, z) === 'desert') continue;
        this.placeOreColumn(x, z, i < 2 ? COAL_ORE : IRON_ORE, 1 + (i % 2));
      }
    }

    // ---- rare spider nests in natural caverns ----
    if (!surfaceOnly && rand() < 0.045) {
      for (let attempt = 0; attempt < 22; attempt++) {
        const x = cx * CHUNK + 3 + Math.floor(rand() * 10);
        const z = cz * CHUNK + 3 + Math.floor(rand() * 10);
        const y = 14 + Math.floor(rand() * Math.max(1, SEA - 38));
        if (y + 2 >= this.getHeight(x, z) || this.get(x, y, z) !== AIR || this.get(x, y + 1, z) !== AIR || !isSolid(this.get(x, y - 1, z))) continue;
        let room = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.get(x + dx, y, z + dz) === AIR && this.get(x + dx, y + 1, z + dz) === AIR) room++;
        }
        if (room < 2) continue;
        this.set(x, y, z, WEB);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (rand() < 0.82 && this.get(x + dx, y, z + dz) === AIR) this.set(x + dx, y, z + dz, WEB);
        }
        if (this.get(x, y + 1, z) === AIR && rand() < 0.7) this.set(x, y + 1, z, WEB);
        break;
      }
    }

    if (!surfaceOnly) {
      // ---- structures (deterministic per chunk) ----
      const sRand = mulberry32(this.seed * 101 + 41 + chunkKey(cx, cz) * 7919);
      const biome = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8);
      const firstStructureSite = this.structureSites.length;
      if (biome === 'desert' || biome === 'canyon') {
        spawnDesertBiomeStructures(this, cx, cz, sRand);
      } else if (isDesertMountainTransition(this, cx, cz) && sRand() < 0.45) {
        buildCliffsideCarvedTemple(this, cx, cz, sRand);
      } else {
        const roll = sRand();
        // keep the spawn basin itself clear
        const nearSpawn = Math.abs(cx - scx) <= 1 && Math.abs(cz - scz) <= 1;
        if (!nearSpawn) {
          if (roll < 0.055) this.buildCottage(cx, cz, sRand);
          else if (roll < 0.085) this.buildTower(cx, cz, sRand);
          else if (roll < 0.105) this.buildRuinYard(cx, cz, sRand);
        }
      }
      this.placeStructureChests(firstStructureSite, sRand);
      this.decorateTreasureCaches(cx, cz, rand);
    }
  }

  /** A few safe structures receive a chest; all other sites stay untouched. */
  private placeStructureChests(firstSite: number, rand: () => number) {
    for (let i = firstSite; i < this.structureSites.length; i++) {
      const site = this.structureSites[i];
      const chance = site.kind === 'tower' ? 0.42 : site.kind === 'ruin' ? 0.3 : 0.22;
      if (rand() >= chance) continue;
      const biome = this.biomeAt(site.x, site.z);
      this.placeChestNearSite(site.x, site.y, site.z, biome, rand);
    }
  }

  /** Find an empty, floor-supported spot within the room, avoiding its centerpiece. */
  private placeChestNearSite(x: number, y: number, z: number, biome: Biome, rand: () => number): boolean {
    const offsets: Array<[number, number]> = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2],
    ];
    const start = Math.floor(rand() * offsets.length);
    for (let n = 0; n < offsets.length; n++) {
      const [dx, dz] = offsets[(start + n) % offsets.length];
      const px = x + dx, pz = z + dz;
      if (!this.inBounds(px, y, pz) || y < 1 || y + 1 >= WY) continue;
      if (this.get(px, y, pz) !== AIR || this.get(px, y + 1, pz) !== AIR) continue;
      if (!isSolid(this.get(px, y - 1, pz))) continue;
      // never wedge a chest into a doorway or under a hanging lantern
      const blocked = [
        this.get(px + 1, y, pz), this.get(px - 1, y, pz),
        this.get(px, y, pz + 1), this.get(px, y, pz - 1),
        this.get(px, y + 1, pz),
      ].some((neighbor) => neighbor === DOOR_WOOD || neighbor === DOOR_IRON || neighbor === TORCH);
      if (blocked) continue;
      this.set(px, y, pz, CHEST_BY_BIOME[biome]);
      return true;
    }
    return false;
  }

  /** Sprinkle submerged caches and natural cave caches through suitable chunks. */
  private decorateTreasureCaches(cx: number, cz: number, rand: () => number) {
    // Sea-floor caches are deliberately limited to water at least four blocks deep.
    if (rand() < 0.2) {
      for (let attempt = 0; attempt < 36; attempt++) {
        const x = cx * CHUNK + 1 + Math.floor(rand() * (CHUNK - 2));
        const z = cz * CHUNK + 1 + Math.floor(rand() * (CHUNK - 2));
        const floorY = this.getHeight(x, z);
        if (floorY > 0 && floorY <= SEA - 4 && Math.hypot(x - ORIGIN_X, z - ORIGIN_Z) > 28 &&
            isSolid(this.get(x, floorY, z)) && this.get(x, floorY + 1, z) === WATER &&
            this.get(x, floorY + 2, z) === WATER) {
          this.set(x, floorY + 1, z, CHEST_UNDERWATER);
          break;
        }
      }
    }

    // Ordinary cave caches use existing underground caverns and side passages.
    if (rand() < 0.13) {
      for (let attempt = 0; attempt < 44; attempt++) {
        const x = cx * CHUNK + 1 + Math.floor(rand() * (CHUNK - 2));
        const z = cz * CHUNK + 1 + Math.floor(rand() * (CHUNK - 2));
        const surface = this.getHeight(x, z);
        const y = 8 + Math.floor(rand() * Math.max(1, SEA - 24));
        if (y >= surface - 6 || y + 1 >= WY || this.get(x, y, z) !== AIR || this.get(x, y + 1, z) !== AIR ||
            !isSolid(this.get(x, y - 1, z)) || Math.hypot(x - ORIGIN_X, z - ORIGIN_Z) < 30) continue;
        let openSides = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const neighbor = this.get(x + dx, y, z + dz);
          if (neighbor === AIR) openSides++;
          if (neighbor === WATER || neighbor === LAVA) openSides = -100;
        }
        if (openSides < 1) continue;
        this.set(x, y, z, CHEST_BY_BIOME[this.biomeAt(x, z, surface)]);
        break;
      }
    }

    // Rare sealed cache pockets are carved into solid rock: miners must find and break in.
    if (rand() < 0.028) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = cx * CHUNK + 2 + Math.floor(rand() * (CHUNK - 4));
        const z = cz * CHUNK + 2 + Math.floor(rand() * (CHUNK - 4));
        const floorY = 8 + Math.floor(rand() * Math.max(1, SEA - 42));
        if (floorY + 4 >= this.getHeight(x, z) || Math.hypot(x - ORIGIN_X, z - ORIGIN_Z) < 42) continue;
        let solidPocket = true;
        for (let dy = 1; dy <= 3 && solidPocket; dy++)
          for (let dz = -1; dz <= 1 && solidPocket; dz++)
            for (let dx = -1; dx <= 1; dx++)
              if (this.get(x + dx, floorY + dy, z + dz) !== STONE) {
                solidPocket = false;
                break;
              }
        if (!solidPocket || !isSolid(this.get(x, floorY, z))) continue;
        for (let dy = 1; dy <= 3; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (let dx = -1; dx <= 1; dx++) this.set(x + dx, floorY + dy, z + dz, AIR);
        this.set(x, floorY + 1, z, CHEST_BY_BIOME[this.biomeAt(x, z)]);
        break;
      }
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

  growCactus(x: number, y: number, z: number, rand: () => number) {
    const block = rand() < 0.62 ? CACTUS : CACTUS_PALE;
    const altBlock = block === CACTUS ? CACTUS_PALE : CACTUS;
    const variant = Math.floor(rand() * 7);

    // Variant 0: Tall Multi-Arm Grand Saguaro (2 to 3 upward arms at staggered heights)
    if (variant === 0) {
      const h = 5 + Math.floor(rand() * 2); // 5-6 blocks tall
      for (let dy = 0; dy < h && y + dy < WY; dy++) {
        this.set(x, y + dy, z, block);
      }
      const dirs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const armCount = 2 + (rand() < 0.45 ? 1 : 0);
      const startIdx = Math.floor(rand() * 4);
      for (let a = 0; a < armCount; a++) {
        const [dx, dz] = dirs[(startIdx + a) % 4];
        const armBaseY = y + 1 + ((a * 2) % Math.max(2, h - 2));
        const armHeight = 2 + Math.floor(rand() * 2);
        if (armBaseY < WY && this.get(x + dx, armBaseY, z + dz) === AIR) {
          this.set(x + dx, armBaseY, z + dz, block);
          for (let ay = 1; ay <= armHeight && armBaseY + ay < WY; ay++) {
            if (this.get(x + dx, armBaseY + ay, z + dz) === AIR) {
              this.set(x + dx, armBaseY + ay, z + dz, block);
            }
          }
        }
      }
      return;
    }

    // Variant 1: Classic Western Twin-Arm Saguaro (symmetric or stepped L-arms)
    if (variant === 1) {
      const h = 4 + Math.floor(rand() * 2); // 4-5 blocks tall
      for (let dy = 0; dy < h && y + dy < WY; dy++) {
        this.set(x, y + dy, z, block);
      }
      const alongX = rand() < 0.5;
      const d1: [number, number] = alongX ? [1, 0] : [0, 1];
      const d2: [number, number] = alongX ? [-1, 0] : [0, -1];
      const y1 = y + 1;
      const y2 = y + 2;
      for (const [dx, dz, ay, ah] of [
        [d1[0], d1[1], y1, 2],
        [d2[0], d2[1], y2, 2],
      ] as const) {
        if (ay < WY && this.get(x + dx, ay, z + dz) === AIR) {
          this.set(x + dx, ay, z + dz, block);
          for (let k = 1; k <= ah && ay + k < WY; k++) {
            if (this.get(x + dx, ay + k, z + dz) === AIR) this.set(x + dx, ay + k, z + dz, block);
          }
        }
      }
      return;
    }

    // Variant 2: Prickly-Pear / Opuntia Paddle Bush Cactus with Red/Yellow Blossoms
    if (variant === 2) {
      this.set(x, y, z, block);
      if (y + 1 < WY) this.set(x, y + 1, z, block);
      const pads: Array<[number, number, number]> = [
        [1, 1, 0],
        [-1, 1, 0],
        [0, 1, 1],
        [1, 2, 0],
        [-1, 2, 0],
      ];
      for (const [dx, dy, dz] of pads) {
        if (rand() < 0.75 && y + dy < WY && this.get(x + dx, y + dy, z + dz) === AIR) {
          this.set(x + dx, y + dy, z + dz, dy === 2 ? altBlock : block);
          if (dy === 2 && y + dy + 1 < WY && this.get(x + dx, y + dy + 1, z + dz) === AIR) {
            this.set(x + dx, y + dy + 1, z + dz, rand() < 0.75 ? FLOWER_RED : FLOWER_YELLOW);
          }
        }
      }
      if (y + 2 < WY && this.get(x, y + 2, z) === AIR) {
        this.set(x, y + 2, z, FLOWER_RED);
      }
      return;
    }

    // Variant 3: Organ-Pipe Multi-Stem Cactus Cluster
    if (variant === 3) {
      const stems: Array<[number, number, number, number]> = [
        [0, 0, 4, block],
        [1, 0, 3, altBlock],
        [0, 1, 2, block],
        [-1, 1, 3, altBlock],
      ];
      for (const [dx, dz, sh, sb] of stems) {
        const baseH = this.getHeight(x + dx, z + dz);
        if (this.get(x + dx, baseH, z + dz) !== SAND) continue;
        for (let dy = 1; dy <= sh && baseH + dy < WY; dy++) {
          if (this.get(x + dx, baseH + dy, z + dz) === AIR) {
            this.set(x + dx, baseH + dy, z + dz, sb);
          }
        }
      }
      return;
    }

    // Variant 4: Stout Flowering Barrel Cactus + surrounding mini succulents
    if (variant === 4) {
      const h = rand() < 0.65 ? 1 : 2;
      for (let dy = 0; dy < h && y + dy < WY; dy++) {
        this.set(x, y + dy, z, block);
      }
      if (y + h < WY && this.get(x, y + h, z) === AIR) {
        this.set(x, y + h, z, rand() < 0.6 ? FLOWER_RED : FLOWER_YELLOW);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (rand() < 0.45) {
          const nh = this.getHeight(x + dx, z + dz);
          if (this.get(x + dx, nh, z + dz) === SAND && this.get(x + dx, nh + 1, z + dz) === AIR) {
            this.set(x + dx, nh + 1, z + dz, DRY_BLOOM);
          }
        }
      }
      return;
    }

    // Variant 5: Candelabra 3-Pronged Fork Cactus
    if (variant === 5) {
      this.set(x, y, z, block);
      if (y + 1 < WY) this.set(x, y + 1, z, block);
      const alongX = rand() < 0.5;
      for (const s of [-1, 0, 1]) {
        const dx = alongX ? s : 0;
        const dz = alongX ? 0 : s;
        const branchH = s === 0 ? 3 : 2;
        for (let dy = 1; dy <= branchH && y + 1 + dy < WY; dy++) {
          if (this.get(x + dx, y + 1 + dy, z + dz) === AIR) {
            this.set(x + dx, y + 1 + dy, z + dz, s === 0 ? block : altBlock);
          }
        }
      }
      return;
    }

    // Variant 6: Classic Column / Single-Arm Desert Cactus
    const h = 2 + Math.floor(rand() * 3); // 2 to 4 blocks tall
    for (let dy = 0; dy < h && y + dy < WY; dy++) {
      this.set(x, y + dy, z, block);
    }
    if (h >= 3 && rand() < 0.65) {
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
    if (rand() < 0.35 && y + h < WY && this.get(x, y + h, z) === AIR) {
      this.set(x, y + h, z, rand() < 0.5 ? FLOWER_RED : FLOWER_YELLOW);
    }
  }

  growPalm(x: number, y: number, z: number, rand: () => number) {
    const height = 6 + Math.floor(rand() * 4);
    if (y + height + 4 >= WY) return;
    const leaf = rand() < 0.5 ? COCONUT_LEAVES : BANANA_LEAVES;
    const crownStyle = Math.floor(rand() * 4);
    // Slight natural lean for oasis palms
    const leanDir: [number, number] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ][Math.floor(rand() * 4)] as [number, number];
    const leanAt = Math.floor(height * 0.55);
    let cx = x;
    let cz = z;
    for (let i = 0; i < height; i++) {
      if (i === leanAt && rand() < 0.7) {
        cx += leanDir[0];
        cz += leanDir[1];
      }
      if (this.get(cx, y + i, cz) === AIR || isCutout(this.get(cx, y + i, cz))) {
        this.set(cx, y + i, cz, PALM_LOG);
      }
    }

    const crown = y + height;
    const putLeaf = (px: number, py: number, pz: number) => {
      if (py >= 0 && py < WY && this.get(px, py, pz) === AIR) this.set(px, py, pz, leaf);
    };
    putLeaf(cx, crown, cz);

    if (leaf === BANANA_LEAVES && crownStyle === 1) {
      // Upright banana crown: broad, overlapping paddle fronds radiate from the tip.
      const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (const [dx, dz] of dirs) {
        const length = 3 + Math.floor(rand() * 2);
        const px = -dz, pz = dx;
        for (let step = 1; step <= length; step++) {
          const py = crown + (step === 1 ? 1 : 0) - Math.floor(step * 0.38);
          const fx = cx + dx * step, fz = cz + dz * step;
          putLeaf(fx, py, fz);
          if (step < length) {
            putLeaf(fx + px, py, fz + pz);
            putLeaf(fx - px, py, fz - pz);
          }
          if (step <= 2) putLeaf(fx, py - 1, fz);
        }
      }
      putLeaf(cx, crown + 2, cz);
    } else if (leaf === BANANA_LEAVES) {
      // Broad oval crown; two spread settings create low, wide and compact silhouettes.
      const alongX = rand() < 0.5;
      const major = crownStyle === 3 ? 5 : 4;
      const minor = crownStyle === 2 ? 2 : 3;
      for (let dx = -major; dx <= major; dx++) for (let dz = -major; dz <= major; dz++) {
        const u = alongX ? dx : dz;
        const v = alongX ? dz : dx;
        if (u * u / (major * major + 1) + v * v / (minor * minor + 1) > 1) continue;
        putLeaf(cx + dx, crown - (Math.abs(u) > 2 ? 1 : 0), cz + dz);
        if (Math.abs(u) === 3 && Math.abs(v) <= 1) putLeaf(cx + dx, crown - 2, cz + dz);
      }
      putLeaf(cx, crown + 1, cz);
    } else if (crownStyle === 1) {
      // Coconut fan: eight individual fronds with stepped, ribbed-looking tips.
      const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dx, dz] of dirs) {
        const length = 2 + Math.floor(rand() * 2);
        const px = -dz, pz = dx;
        for (let step = 1; step <= length; step++) {
          const py = crown - Math.floor((step + 1) / 2);
          const fx = cx + dx * step, fz = cz + dz * step;
          putLeaf(fx, py, fz);
          if (step < length) {
            putLeaf(fx + px, py, fz + pz);
            putLeaf(fx - px, py, fz - pz);
          }
          if (step === length) putLeaf(fx, py - 1, fz);
        }
      }
      putLeaf(cx, crown + 1, cz);
    } else if (crownStyle === 3) {
      // Drooping radial crown with longer, layered fronds for a fuller tropical silhouette.
      const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (const [dx, dz] of dirs) {
        const length = 3 + Math.floor(rand() * 2);
        const px = -dz, pz = dx;
        for (let step = 1; step <= length; step++) {
          const py = crown - Math.floor(step * 0.52);
          const fx = cx + dx * step, fz = cz + dz * step;
          putLeaf(fx, py, fz);
          if (step < length) {
            putLeaf(fx + px, py, fz + pz);
            putLeaf(fx - px, py, fz - pz);
          }
          if (step === length) putLeaf(fx, py - 1, fz);
        }
      }
      putLeaf(cx, crown + 1, cz);
    } else {
      // Date-palm silhouette: long cardinal fronds droop at their ends.
      const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of dirs) {
        const length = 3 + Math.floor(rand() * 2);
        for (let step = 1; step <= length; step++) {
          const py = crown - Math.floor(step * (crownStyle === 2 ? 0.62 : 0.38));
          putLeaf(cx + dx * step, py, cz + dz * step);
          if (step < length) {
            putLeaf(cx + dx * step + dz, py, cz + dz * step - dx);
            putLeaf(cx + dx * step - dz, py, cz + dz * step + dx);
          }
          if (step === length) putLeaf(cx + dx * step, py - 1, cz + dz * step);
        }
      }
      putLeaf(cx, crown + 1, cz);
    }

    // Occasional trailing vines make jungle palms distinct from dry date palms.
    if (leaf === BANANA_LEAVES) {
      const vineDirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let vines = 0;
      for (const [dx, dz] of vineDirs) {
        if (vines >= 2 || rand() > 0.38) continue;
        vines++;
        const py = crown - 1;
        for (let v = 1; v < Math.min(height, 5); v++) {
          if (this.get(cx + dx * 3, py - v, cz + dz * 3) !== AIR) break;
          this.set(cx + dx * 3, py - v, cz + dz * 3, VINE);
        }
      }
    }
  }

  private growDiverseTree(
    x: number,
    y: number,
    z: number,
    rand: () => number,
    winter = false,
    jungle = false,
    autumn = false,
  ) {
    if (winter) {
      const roll = rand();
      if (roll < 0.10) this.growBareConifer(x, y, z, rand);
      else if (roll < 0.26) this.growSparseSpruce(x, y, z, rand);
      else if (roll < 0.46) this.growLayeredConifer(x, y, z, rand, SNOW_LEAVES);
      else if (roll < 0.58) this.growBirch(x, y, z, rand, true);
      else this.growSpruce(x, y, z, rand);
      return;
    }
    if (autumn) {
      // Use rounded, separated crowns so the whole woodland reads as gold and rust,
      // with both narrow birch-like and broad oak/maple silhouettes.
      const roll = rand();
      if (roll < 0.28) this.growMaple(x, y, z, rand);
      else if (roll < 0.48) this.growAutumnCanopyTree(x, y, z, rand, true);
      else if (roll < 0.73) this.growAutumnCanopyTree(x, y, z, rand, false);
      else if (roll < 0.86) this.growWillow(x, y, z, rand, AUTUMN_LEAVES);
      else this.growSmallBush(x, y, z, rand, AUTUMN_LEAVES);
    } else if (jungle) {
      const roll = rand();
      if (roll < 0.16) this.growWillow(x, y, z, rand);
      else if (roll < 0.27) this.growJacarandaTree(x, y, z, rand);
      else if (roll < 0.67) this.growGiantOak(x, y, z, rand);
      else if (roll < 0.84) this.growTieredOak(x, y, z, rand);
      else this.growBushyOak(x, y, z, rand);
    } else {
      const roll = rand();
      if (roll < 0.18) this.growStandardOak(x, y, z, rand);
      else if (roll < 0.32) this.growBushyOak(x, y, z, rand);
      else if (roll < 0.42) this.growBirch(x, y, z, rand, false);
      else if (roll < 0.50) this.growAppleTree(x, y, z, rand);
      else if (roll < 0.60) this.growGiantOak(x, y, z, rand);
      else if (roll < 0.70) this.growTieredOak(x, y, z, rand);
      else if (roll < 0.79) this.growLayeredConifer(x, y, z, rand);
      else if (roll < 0.87) this.growCherryTree(x, y, z, rand);
      else if (roll < 0.94) this.growJacarandaTree(x, y, z, rand);
      else if (roll < 0.98) this.growWillow(x, y, z, rand);
      else this.growSmallBush(x, y, z, rand);
    }

    // Hives are a warm/summer detail rather than a feature of frosted or late-autumn trees.
    if (!autumn && rand() < 0.045) {
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

  private growLeafPuff(
    x: number,
    y: number,
    z: number,
    rand: () => number,
    leaves: number,
    radius = 1,
    edgeGaps = 0.12,
  ) {
    for (let dy = -1; dy <= 1; dy++) {
      const r = Math.max(0, radius - (Math.abs(dy) === 1 ? 1 : 0));
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r + 0.5 || (d2 > r * r * 0.45 && rand() < edgeGaps)) continue;
        if (this.get(x + dx, y + dy, z + dz) === AIR) this.set(x + dx, y + dy, z + dz, leaves);
      }
    }
  }

  private growSmallBush(x: number, y: number, z: number, rand: () => number, leaves = LEAVES) {
    const h = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < h; i++) this.set(x, y + i, z, LOG);
    const top = y + h;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && rand() < 0.5) continue;
        if (this.get(x + dx, top, z + dz) === AIR) this.set(x + dx, top, z + dz, leaves);
      }
    }
    this.set(x, top + 1, z, leaves);
  }

  private growStandardOak(x: number, y: number, z: number, rand: () => number, leaves = LEAVES) {
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
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, leaves);
        }
      }
    }
    if (top + 1 < WY) this.set(x, top + 1, z, leaves);
  }

  /** Open, three-tier oak with a straight trunk and separate branch-end leaf clusters. */
  private growTieredOak(x: number, y: number, z: number, rand: () => number) {
    const th = 8 + Math.floor(rand() * 4);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    // Low roots echo the broad, flared base on the reference oaks.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const length = 1 + Math.floor(rand() * 2);
      for (let step = 1; step <= length; step++) {
        if (this.get(x + dx * step, y, z + dz * step) === AIR)
          this.set(x + dx * step, y, z + dz * step, LOG);
      }
    }
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let tier = 0; tier < 3; tier++) {
      const level = y + 3 + tier * 2;
      const radius = 4 - tier;
      const tierDirs = dirs.slice();
      for (let i = tierDirs.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [tierDirs[i], tierDirs[j]] = [tierDirs[j], tierDirs[i]];
      }
      tierDirs.length = 5 + Math.floor(rand() * 3);
      for (const [dx, dz] of tierDirs) {
        const length = Math.max(1, radius - (dx !== 0 && dz !== 0 ? 1 : 0));
        let ex = x, ez = z, ey = level;
        for (let step = 1; step <= length; step++) {
          ex = x + dx * step;
          ez = z + dz * step;
          ey = level + Math.floor(step * 0.2);
          if (this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
        }
        this.growLeafPuff(ex, ey + 1, ez, rand, LEAVES, tier === 1 && rand() < 0.5 ? 2 : 1, 0.2);
        if (tier === 0 && rand() < 0.4) this.growLeafPuff(ex - dx, ey + 1, ez - dz, rand, LEAVES, 1, 0.18);
      }
    }
    this.growLeafPuff(x, y + th + 1, z, rand, LEAVES, 2, 0.16);
  }

  private growBushyOak(x: number, y: number, z: number, rand: () => number, leaves = LEAVES) {
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
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, leaves);
        }
      }
    }
    if (top + 2 < WY) this.set(x, top + 2, z, leaves);
  }

  private growGiantOak(x: number, y: number, z: number, rand: () => number, leaves = LEAVES) {
    const th = 10 + Math.floor(rand() * 4); // towering old oak, 10-13 blocks high
    const flareHeight = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < th; i++) {
      this.set(x, y + i, z, LOG);
      if (i < flareHeight) {
        this.set(x + 1, y + i, z, LOG);
        this.set(x, y + i, z + 1, LOG);
        this.set(x + 1, y + i, z + 1, LOG);
      }
    }
    // Buttress roots spread away from the broad lower trunk in all directions.
    const rootDirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [dx, dz] of rootDirs) {
      const rootLength = 2 + Math.floor(rand() * 2);
      for (let step = 1; step <= rootLength; step++) {
        const rootY = y;
        if (this.get(x + dx * step, rootY, z + dz * step) === AIR)
          this.set(x + dx * step, rootY, z + dz * step, LOG);
      }
    }
    // Long boughs radiate in every direction and carry separate leaf clusters.
    const branchDirs: Array<[number, number]> = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ];
    const shuffledDirs = branchDirs.slice();
    for (let i = shuffledDirs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffledDirs[i], shuffledDirs[j]] = [shuffledDirs[j], shuffledDirs[i]];
    }
    const numBranches = 5 + Math.floor(rand() * 4);
    for (let b = 0; b < numBranches; b++) {
      const dir = shuffledDirs[b];
      const by = y + 4 + Math.floor(rand() * Math.max(1, th - 5));
      const blen = 3 + Math.floor(rand() * 3);
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
                  this.set(bx + dx, ly, bz + dz, leaves);
                }
              }
            }
          }
        }
      }
    }
    // Broad, domed canopy like a mature park oak.
    const top = y + th;
    for (let dy = -2; dy <= 2; dy++) {
      const r = dy === 0 ? 6 : Math.abs(dy) === 1 ? 5 : 3;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz > r * r + 0.8) continue;
          const yy = top + dy;
          if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, leaves);
        }
      }
    }
    if (top + 2 < WY) this.set(x, top + 2, z, leaves);
  }

  /** Broad, branching maple with separated gold/rust foliage clusters like an autumn canopy. */
  private growMaple(x: number, y: number, z: number, rand: () => number) {
    const th = 6 + Math.floor(rand() * 3);
    let trunkX = x, trunkZ = z;
    const bendAt = 3 + Math.floor(rand() * 3);
    const bend: [number, number] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)] as [number, number];
    for (let i = 0; i < th; i++) {
      if (i === bendAt && rand() < 0.6) {
        this.set(trunkX, y + i, trunkZ, LOG);
        trunkX += bend[0];
        trunkZ += bend[1];
      }
      this.set(trunkX, y + i, trunkZ, LOG);
    }

    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const branchCount = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < branchCount; i++) {
      const [dx, dz] = dirs[(i + Math.floor(rand() * 3)) % dirs.length];
      const by = y + 3 + Math.floor(rand() * Math.max(1, th - 4));
      const length = 2 + Math.floor(rand() * 2);
      let ex = trunkX, ez = trunkZ, ey = by;
      for (let step = 1; step <= length; step++) {
        ex = trunkX + dx * step;
        ez = trunkZ + dz * step;
        ey = by + Math.floor(step * 0.35);
        if (ey < WY && this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
      }
      this.growLeafPuff(ex, ey + 1, ez, rand, AUTUMN_LEAVES, rand() < 0.35 ? 2 : 1, 0.26);
    }

    const top = y + th;
    const crown = [
      [0, 0, 0, 2],
      [2, 0, 0, 1], [-2, 0, 0, 1],
      [0, 0, 2, 1], [0, 0, -2, 1],
      [1, -1, 1, 1], [-1, -1, -1, 1],
    ] as const;
    for (const [dx, dy, dz, radius] of crown) {
      this.growLeafPuff(trunkX + dx, top + dy, trunkZ + dz, rand, AUTUMN_LEAVES, radius, 0.24);
    }
  }

  /** Narrow birch-like or broad oak-like silhouette with separated autumn leaf clusters. */
  private growAutumnCanopyTree(x: number, y: number, z: number, rand: () => number, slender: boolean) {
    const th = (slender ? 7 : 6) + Math.floor(rand() * 4);
    const trunk = slender ? BIRCH_LOG : LOG;
    for (let i = 0; i < th; i++) this.set(x, y + i, z, trunk);
    const top = y + th;
    const dirs: Array<[number, number]> = slender
      ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const branchCount = slender ? 4 + Math.floor(rand() * 2) : 5 + Math.floor(rand() * 3);
    for (let i = 0; i < branchCount; i++) {
      const [dx, dz] = dirs[Math.floor(rand() * dirs.length)];
      const by = y + 3 + Math.floor(rand() * Math.max(1, th - 4));
      const length = (slender ? 1 : 2) + Math.floor(rand() * 3);
      let ex = x, ez = z, ey = by;
      for (let step = 1; step <= length; step++) {
        ex = x + dx * step;
        ez = z + dz * step;
        ey = by + Math.floor(step * 0.35);
        if (this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, trunk);
      }
      this.growLeafPuff(ex, ey + 1, ez, rand, AUTUMN_LEAVES, slender ? 1 : 2, 0.27);
    }
    const offsets: Array<[number, number, number]> = slender
      ? [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]
      : [[0, 0, 0], [2, -1, 0], [-2, -1, 0], [0, -1, 2], [0, -1, -2]];
    for (const [dx, dy, dz] of offsets) {
      this.growLeafPuff(x + dx, top + dy, z + dz, rand, AUTUMN_LEAVES, slender ? 1 : 2, 0.25);
    }
  }

  /** Large sakura with a crooked trunk, exposed boughs, and airy pink blossom puffs. */
  private growCherryTree(x: number, y: number, z: number, rand: () => number) {
    const th = 8 + Math.floor(rand() * 5);
    let trunkX = x, trunkZ = z;
    const bendAt = 3 + Math.floor(rand() * 3);
    const bend: [number, number] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)] as [number, number];
    for (let i = 0; i < th; i++) {
      if (i === bendAt && rand() < 0.75) {
        this.set(trunkX, y + i, trunkZ, LOG);
        trunkX += bend[0];
        trunkZ += bend[1];
      }
      this.set(trunkX, y + i, trunkZ, LOG);
    }
    // Low boughs spread from the base so the flowering trunk reads as old and broad-rooted.
    const rootDirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of rootDirs) {
      const length = 1 + Math.floor(rand() * 2);
      for (let step = 1; step <= length; step++) {
        const rootY = y;
        if (this.get(x + dx * step, rootY, z + dz * step) === AIR)
          this.set(x + dx * step, rootY, z + dz * step, LOG);
      }
    }

    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const branchCount = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < branchCount; i++) {
      const [dx, dz] = dirs[(i * 3 + Math.floor(rand() * 4)) % dirs.length];
      const by = y + 4 + Math.floor(rand() * Math.max(1, th - 5));
      const length = 3 + Math.floor(rand() * 3);
      let ex = trunkX, ez = trunkZ, ey = by;
      for (let step = 1; step <= length; step++) {
        ex = trunkX + dx * step;
        ez = trunkZ + dz * step;
        ey = by + Math.floor(step * 0.4);
        if (ey < WY && this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
      }
      this.growLeafPuff(ex, ey + 1, ez, rand, CHERRY_LEAVES, rand() < 0.55 ? 2 : 1, 0.22);
      if (rand() < 0.45) this.growLeafPuff(ex - dx, ey + 1, ez - dz, rand, CHERRY_LEAVES, 1, 0.18);
    }

    const top = y + th;
    // A wide, slightly flattened blossom crown built from overlapping pink clusters.
    for (const [dx, dy, dz, radius] of [
      [0, 0, 0, 4], [0, 1, 0, 3],
      [4, -1, 0, 3], [-4, -1, 0, 3], [0, -1, 4, 3], [0, -1, -4, 3],
      [3, 0, 3, 2], [-3, 0, 3, 2], [3, 0, -3, 2], [-3, 0, -3, 2],
    ] as const) {
      this.growLeafPuff(trunkX + dx, top + dy, trunkZ + dz, rand, CHERRY_LEAVES, radius, 0.2);
    }
  }

  /** Jacaranda: branching crown with airy clusters of violet-blue leaves. */
  private growJacarandaTree(x: number, y: number, z: number, rand: () => number) {
    const th = 8 + Math.floor(rand() * 4);
    let trunkX = x, trunkZ = z;
    const lean: [number, number] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)] as [number, number];
    const bendAt = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < th; i++) {
      if (i === bendAt && rand() < 0.6) {
        this.set(trunkX, y + i, trunkZ, LOG);
        trunkX += lean[0];
        trunkZ += lean[1];
      }
      this.set(trunkX, y + i, trunkZ, LOG);
    }

    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const branchCount = 7 + Math.floor(rand() * 5);
    for (let i = 0; i < branchCount; i++) {
      const [dx, dz] = dirs[Math.floor(rand() * dirs.length)];
      const by = y + 3 + Math.floor(rand() * Math.max(1, th - 4));
      const length = 2 + Math.floor(rand() * 3);
      let ex = trunkX, ez = trunkZ, ey = by;
      for (let step = 1; step <= length; step++) {
        ex = trunkX + dx * step;
        ez = trunkZ + dz * step;
        ey = by + Math.floor(step * 0.35);
        if (ey < WY && this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
      }
      this.growLeafPuff(ex, ey + 1, ez, rand, JACARANDA_LEAVES, rand() < 0.35 ? 2 : 1, 0.28);
      if (rand() < 0.45) this.growLeafPuff(ex - dx, ey + 1, ez - dz, rand, JACARANDA_LEAVES, 1, 0.25);
    }

    const top = y + th;
    for (const [dx, dy, dz, radius] of [
      [0, 0, 0, 2], [1, 0, 0, 2], [-1, 0, 0, 2], [0, 0, 1, 2], [0, 0, -1, 2],
      [2, -1, 2, 1], [-2, -1, 2, 1], [2, -1, -2, 1], [-2, -1, -2, 1],
    ] as const) {
      this.growLeafPuff(trunkX + dx, top + dy, trunkZ + dz, rand, JACARANDA_LEAVES, radius, 0.24);
    }
  }

  /** Broad weeping willow: visible horizontal limbs, loose crown, and hanging foliage curtains. */
  private growWillow(x: number, y: number, z: number, rand: () => number, foliage = LEAVES) {
    const th = 8 + Math.floor(rand() * 3);
    let trunkX = x, trunkZ = z;
    const lean: [number, number] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)] as [number, number];
    const leanAt = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < th; i++) {
      if (i === leanAt && rand() < 0.65) {
        this.set(trunkX, y + i, trunkZ, LOG);
        trunkX += lean[0];
        trunkZ += lean[1];
      }
      this.set(trunkX, y + i, trunkZ, LOG);
    }

    const top = y + th;
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const orderedDirs = dirs.slice();
    for (let i = orderedDirs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [orderedDirs[i], orderedDirs[j]] = [orderedDirs[j], orderedDirs[i]];
    }
    const branchCount = 8 + Math.floor(rand() * 3);
    for (let i = 0; i < branchCount; i++) {
      const [dx, dz] = i < orderedDirs.length ? orderedDirs[i] : dirs[Math.floor(rand() * dirs.length)];
      const by = top - 2 - Math.floor(rand() * 3);
      const length = 3 + Math.floor(rand() * 3);
      let ex = trunkX, ez = trunkZ, ey = by;
      for (let step = 1; step <= length; step++) {
        ex = trunkX + dx * step;
        ez = trunkZ + dz * step;
        ey = by + (step === 1 ? 1 : 0);
        if (this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
      }
      this.growLeafPuff(ex, ey + 1, ez, rand, foliage, 1, 0.08);
      const curtainLength = i % 3 === 0 || rand() < 0.25
        ? 5 + Math.floor(rand() * 4)
        : 2 + Math.floor(rand() * 4);
      for (let drop = 1; drop <= curtainLength; drop++) {
        const leafY = ey - drop;
        if (leafY <= y || this.get(ex, leafY, ez) !== AIR) break;
        this.set(ex, leafY, ez, rand() < 0.24 ? VINE : foliage);
        if (drop < curtainLength && rand() < 0.45) {
          const side = rand() < 0.5 ? -1 : 1;
          const sx = ex + (dz !== 0 ? side : 0);
          const sz = ez + (dx !== 0 ? side : 0);
          if (this.get(sx, leafY, sz) === AIR) this.set(sx, leafY, sz, foliage);
        }
      }
    }

    // A loose umbrella of leaves lets the wooden branches show through.
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      if (dx * dx + dz * dz > 19 || (Math.abs(dx) === 4 && Math.abs(dz) === 4)) continue;
      const py = top - (Math.abs(dx) + Math.abs(dz) > 5 ? 1 : 0);
      if (this.get(trunkX + dx, py, trunkZ + dz) === AIR) this.set(trunkX + dx, py, trunkZ + dz, foliage);
    }
  }

  private growBirch(x: number, y: number, z: number, rand: () => number, winter = false, leafOverride?: number) {
    const leaf = leafOverride ?? (winter ? SNOW_LEAVES : BIRCH_LEAVES);
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

  /** Leafless winter tree, ranging from a bare trunk to a forked branch skeleton. */
  private growBareConifer(x: number, y: number, z: number, rand: () => number) {
    const th = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let level = 2;
    while (level < th - 1) {
      const [dx, dz] = dirs[Math.floor(rand() * dirs.length)];
      const branchY = y + level;
      const length = 1 + Math.floor(rand() * 2);
      for (let step = 1; step <= length; step++) {
        const bx = x + dx * step;
        const bz = z + dz * step;
        const by = branchY + Math.floor(step * 0.45);
        if (by < WY && this.get(bx, by, bz) === AIR) this.set(bx, by, bz, LOG);
        if (step === length && rand() < 0.42 && by + 1 < WY && this.get(bx, by + 1, bz) === AIR)
          this.set(bx, by + 1, bz, LOG);
      }
      level += 1 + Math.floor(rand() * 2);
    }
  }

  /** Sparse snow-pine with exposed branch tiers and small frosted needle tufts. */
  private growSparseSpruce(x: number, y: number, z: number, rand: () => number) {
    const th = 8 + Math.floor(rand() * 4);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let level = 2; level < th - 1; level += 2) {
      const [dx, dz] = dirs[Math.floor(rand() * dirs.length)];
      const length = 1 + Math.floor(rand() * 2);
      let ex = x, ez = z, ey = y + level;
      for (let step = 1; step <= length; step++) {
        ex = x + dx * step;
        ez = z + dz * step;
        ey = y + level + Math.floor(step * 0.35);
        if (this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
      }
      if (rand() < 0.8) this.growLeafPuff(ex, ey + 1, ez, rand, SNOW_LEAVES, 1, 0.3);
    }
    if (rand() < 0.7) this.growLeafPuff(x, y + th, z, rand, SNOW_LEAVES, 1, 0.25);
  }

  /** Whorled pine with visible horizontal boughs and separated needle clusters. */
  private growLayeredConifer(x: number, y: number, z: number, rand: () => number, foliage = LEAVES) {
    const th = 8 + Math.floor(rand() * 5);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

    for (let level = 2; level < th - 1; level += 2) {
      const tierDirs = dirs.slice();
      for (let i = tierDirs.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [tierDirs[i], tierDirs[j]] = [tierDirs[j], tierDirs[i]];
      }
      const branchCount = 4 + Math.floor(rand() * 3);
      const tierRadius = Math.max(1, Math.ceil((th - level) * 0.34));
      for (const [dx, dz] of tierDirs.slice(0, branchCount)) {
        const maximum = Math.max(1, tierRadius - (dx !== 0 && dz !== 0 ? 1 : 0));
        const length = Math.max(1, maximum - Math.floor(rand() * 2));
        let ex = x, ez = z, ey = y + level;
        for (let step = 1; step <= length; step++) {
          ex = x + dx * step;
          ez = z + dz * step;
          ey = y + level + (step === 1 ? 1 : 0);
          if (this.get(ex, ey, ez) === AIR) this.set(ex, ey, ez, LOG);
          if (step === length || (step === length - 1 && rand() < 0.3)) {
            const radius = level <= 4 && rand() < 0.45 ? 2 : 1;
            this.growLeafPuff(ex, ey + 1, ez, rand, foliage, radius, 0.24);
          }
        }
      }
    }
    this.growLeafPuff(x, y + th, z, rand, foliage, 1, 0.16);
  }

  /** Tall tiered conifer with a dense, snow-capped pyramidal crown. */
  private growSpruce(x: number, y: number, z: number, rand: () => number) {
    const th = 8 + Math.floor(rand() * 4);
    for (let i = 0; i < th; i++) this.set(x, y + i, z, LOG);
    for (let dy = 1; dy <= th + 1; dy++) {
      const radius = Math.max(0, Math.ceil((th + 1 - dy) * 0.34));
      for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > radius * radius + 0.7 || (radius > 1 && d2 > radius * radius * 0.68 && rand() < 0.12)) continue;
        const yy = y + dy;
        if (yy < WY && this.get(x + dx, yy, z + dz) === AIR) this.set(x + dx, yy, z + dz, SNOW_LEAVES);
      }
    }
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
      if (hMax - hMin > 3 || hMin < SEA + 1 || hMax > SEA + 22) continue;
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
      // Hanging ceiling lantern inside + wall-bracket lantern outside front door (maxresdefault.jpg style)
      this.set(dx, y0 + wallH, z0 + (d >> 1), TORCH);
      if (z0 - 1 >= cx * CHUNK) {
        this.set(dx - 1, y0 + 3, z0 - 1, FENCE_WOOD);
        this.set(dx - 1, y0 + 2, z0 - 1, TORCH);
      }
    } else {
      this.set(x0 + 1, y0 + 1, z0 + 1, TORCH);
    }
    if (rand() < 0.5) {
      const tx = x0 + w - 2;
      const tz = z0 + d - 2;
      this.set(tx, y0 + 1, tz, rand() < 0.3 ? GOLD_BLOCK : COAL_BLOCK);
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
    if (!ruined && z0 - 1 >= cx * CHUNK) {
      this.set(x0 + 1, y0 + 3, z0 - 1, FENCE_STONE);
      this.set(x0 + 1, y0 + 2, z0 - 1, TORCH);
      this.set(x0 + 3, y0 + 3, z0 - 1, FENCE_STONE);
      this.set(x0 + 3, y0 + 2, z0 - 1, TORCH);
    }
    if (!ruined) {
      this.set(x0 + 2, y0 + Math.min(h - 1, 4), z0 + 4, GLASS);
      for (let x = x0; x < x0 + 5; x++)
        for (const z of [z0, z0 + 4]) if ((x + z) % 2 === 0) this.set(x, y0 + h + 1, z, FENCE_STONE);
      for (let z = z0; z < z0 + 5; z++)
        for (const x of [x0, x0 + 4]) if ((x + z) % 2 === 0) this.set(x, y0 + h + 1, z, FENCE_STONE);
      for (let z = z0 + 1; z < z0 + 4; z++)
        for (let x = x0 + 1; x < x0 + 4; x++) this.set(x, y0 + h, z, PLANKS);
      this.set(x0 + 2, y0 + h + 1, z0 + 2, FENCE_STONE);
      this.set(x0 + 2, y0 + h + 2, z0 + 2, TORCH);
    }
    this.set(x0 + 1, y0 + 1, z0 + 1, TORCH);
    // towers always hoard something worth guarding
    this.set(x0 + 3, y0 + 1, z0 + 3, rand() < 0.5 ? GOLD_BLOCK : COAL_BLOCK);
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
    // Central weathered stone & wood street lamp post in the ruin yard (maxresdefault.jpg style)
    this.set(x0 + 3, y0 + 1, z0 + 3, COBBLE);
    this.set(x0 + 3, y0 + 2, z0 + 3, FENCE_STONE);
    this.set(x0 + 3, y0 + 3, z0 + 3, FENCE_WOOD);
    this.set(x0 + 3, y0 + 4, z0 + 3, PLANKS);
    this.set(x0 + 4, y0 + 4, z0 + 3, FENCE_WOOD);
    this.set(x0 + 4, y0 + 3, z0 + 3, TORCH);
    if (rand() < 0.5) this.set(x0 + 2, y0 + 1, z0 + 3, GOLD_BLOCK);
  }

  findSpawn(): [number, number, number] {
    for (let tries = 0; tries < 720; tries++) {
      const angle = (tries * 2.399963229728653) % (Math.PI * 2);
      const r = 6 + ((tries % 31) / 30) * 42;
      const x = Math.round(ORIGIN_X + Math.cos(angle) * r);
      const z = Math.round(ORIGIN_Z + Math.sin(angle) * r);
      const [cx, cz] = this.chunkOf(x, z);
      if (!this.hasSurface(cx, cz)) continue;
      const h = this.topSolidY(x, z);
      if (h < SEA + 2 || h > SEA + 18) continue;
      const top = this.get(x, h, z);
      if (top !== GRASS && top !== SNOW_GRASS && top !== SAND) continue;
      const biome = this.biomeAt(x, z, h);
      if (tries < 420 && (biome === 'desert' || biome === 'canyon')) continue;
      if (this.get(x, h + 1, z) !== AIR || this.get(x, h + 2, z) !== AIR || this.get(x, h + 3, z) !== AIR) continue;
      let clear = true;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (this.get(x + dx, h + 1, z + dz) !== AIR || this.get(x + dx, h + 2, z + dz) !== AIR) {
            clear = false;
          }
        }
      }
      if (!clear) continue;
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

  /** Camera yaw (radians) from (x,z) facing the desert village center */
  spawnYawFor(x: number, z: number): number {
    const desertSites = this.structureSites.filter((s) => this.biomeAt(s.x, s.z) === 'desert');
    if (desertSites.length > 0) {
      // Aim toward the centroid of nearby desert village buildings
      const near = desertSites.filter((s) => Math.hypot(s.x - x, s.z - z) < 48);
      const pool = near.length > 0 ? near : desertSites;
      let sumX = 0;
      let sumZ = 0;
      for (const s of pool) {
        sumX += s.x;
        sumZ += s.z;
      }
      const targetX = sumX / pool.length;
      const targetZ = sumZ / pool.length;
      if (Math.hypot(targetX - x, targetZ - z) > 2) {
        return Math.atan2(-(targetX - x), -(targetZ - z));
      }
    }
    return Math.PI * 0.75;
  }
}
