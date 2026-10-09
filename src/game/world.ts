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
  // expanded forest flora & ruins
  FLOWER_TULIP_RED, FLOWER_TULIP_YELLOW, FLOWER_TULIP_PINK, FLOWER_TULIP_ORANGE, FLOWER_TULIP_WHITE,
  FLOWER_SUNFLOWER, FLOWER_ROSE, FLOWER_LAVENDER, FLOWER_WISTERIA, FLOWER_DAISY, FLOWER_ORCHID, FLOWER_PEONY,
  BUSH, BUSH_FLOWERING, BERRY_BUSH, TALL_LAVENDER, TALL_SUNFLOWER, WISTERIA_VINE, MOSS_CARPET, LEAF_PILE,
  MOSSY_COBBLE, MOSSY_STONE_BRICK, CRACKED_STONE_BRICK, STONE_BRICK,
  // cave biomes
  CAVE_MOSS_BLOCK, CAVE_VINE, CAVE_VINE_GLOW, GLOW_BERRY, DRIPSTONE_BLOCK, POINTED_DRIPSTONE,
  HANGING_ROOTS, ROOTED_DIRT, DEEPSLATE, DEEPSLATE_BRICKS, AMETHYST_BLOCK, GLOW_LICHEN,
  SPORE_BLOSSOM, AZALEA_LEAVES, AZALEA_FLOWERING, CLAY, MUSHROOM_BLOCK_RED, MUSHROOM_BLOCK_BROWN,
  MUSHROOM_STEM, STALACTITE, STALAGMITE,
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
export type CaveBiome = 'normal' | 'lush' | 'vine' | 'dripstone' | 'mossy' | 'amethyst' | 'lake' | 'deep';

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
  blocks: Uint16Array; // CHUNK * WY * CHUNK, index (y*CHUNK+lz)*CHUNK+lx — Uint16 for >255 block IDs (forest flora)
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
    seedNoise(seed);
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

  /** Underground cave biome: separate from surface biome, based on 3D noise & depth — tuned for reference-like variety */
  caveBiomeAt(x: number, y: number, z: number): CaveBiome {
    if (y > SEA - 8) return 'normal';
    const depth = SEA - y;
    const large = fbm3(x * 0.008 + 12.3, y * 0.008 - 44.1, z * 0.008 + 91.7, 3);
    const detail = fbm3(x * 0.022 - 31.2, y * 0.022 + 19.4, z * 0.022 - 73.5, 2);
    const humid = fbm2(x * 0.009 + 53, z * 0.009 - 27, 3);
    const temp = fbm2(x * 0.011 - 71, z * 0.011 + 14, 3);

    // amethyst geodes rare deep
    if (y < 35 && large > 0.58 && detail > 0.22) return 'amethyst';

    // lake caverns: more common, low humidity pockets with big open space
    if (y > 18 && y < SEA - 14 && humid < -0.12 && large < -0.02) return 'lake';

    // lush caves: high humidity, mid depth — should be ~25% of caves (reference lush)
    if (depth > 10 && depth < 95 && humid > 0.08 && large > 0.02) return 'lush';

    // vine caves: very lush with hanging vines, even more humid — ~15% of caves
    if (depth > 8 && depth < 85 && humid > 0.20 && large > -0.08 && temp > -0.18) return 'vine';

    // mossy ruins: temperate, moderate depth — overgrown entrances / ruined villages
    if (depth > 12 && depth < 75 && large > -0.12 && large < 0.32 && humid > -0.18 && humid < 0.32) return 'mossy';

    // dripstone: dry, deep — stalactites/stalagmites
    if (y < 75 && (large < -0.18 || (humid < -0.08 && detail < -0.02))) return 'dripstone';

    if (y < 32) return 'deep';

    return 'normal';
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
      blocks: new Uint16Array(CHUNK * WY * CHUNK),
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
      blocks: new Uint16Array(CHUNK * WY * CHUNK),
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
          // drastically reduce ore density: only ~8% of stone columns even try to spawn ore
          if (rand() > 0.09) continue;
          let ore = 0;
          // new thresholds are much higher (rarer) and y-ranges tighter — matches reference cave cleanliness
          if (y < 22) {
            const netherNoise = noise3(x * 0.31 + 97.3, y * 0.5 - 41, z * 0.31 - 77.7);
            const depthFactor = (22 - y) / 20;
            const thresh = 0.86 - depthFactor * 0.12; // 0.86 near top, 0.74 at bottom
            if (netherNoise > thresh) ore = NETHERITE_ORE;
          }
          if (!ore && y < 36) {
            const n = noise3(x * 0.28 + 71.2, y * 0.42 - 17, z * 0.28 - 48.9);
            if (n > 0.84) ore = EMERALD_ORE;
          }
          if (!ore && y < 48) {
            if (noise3(x * 0.26 - 61.2, y * 0.4 + 19, z * 0.26 + 51.9) > 0.83) ore = DIAMOND_ORE;
          }
          if (!ore && y < 68) {
            const n = noise3(x * 0.24 - 18.5, y * 0.36 + 29, z * 0.24 + 63.4);
            if (n > 0.82) ore = LAPIS_ORE;
          }
          if (!ore && y < 80) {
            if (noise3(x * 0.22 + 44.7, y * 0.34 - 12, z * 0.22 - 33.1) > 0.83) ore = GOLD_ORE;
          }
          if (!ore && y < 100) {
            const n = noise3(x * 0.24 - 18.5, y * 0.36 + 29, z * 0.24 + 63.4);
            if (n < -0.82) ore = REDSTONE_ORE;
          }
          if (!ore && y < 110) {
            const n = noise3(x * 0.28 + 71.2, y * 0.42 - 17, z * 0.28 - 48.9);
            if (n < -0.83) ore = QUARTZ_ORE;
          }
          if (!ore && y < 135) {
            if (noise3(x * 0.19 - 21.4, y * 0.3 + 5, z * 0.19 + 8.2) > 0.81) ore = IRON_ORE;
          }
          if (!ore && y < 165) {
            if (noise3(x * 0.17 + 3.1, y * 0.26, z * 0.17 - 1.7) > 0.79) ore = COAL_ORE;
          }
          if (ore) {
            chunk.blocks[cidx(lx, y, lz)] = ore;
            // small veins 2-4 blocks for a more natural look, but still rare
            if (rand() < 0.45) {
              for (let v = 0; v < 2 + Math.floor(rand() * 2); v++) {
                const nx = lx + Math.floor(rand() * 3) - 1;
                const ny = y + Math.floor(rand() * 3) - 1;
                const nz = lz + Math.floor(rand() * 3) - 1;
                if (nx < 0 || nx >= CHUNK || nz < 0 || nz >= CHUNK || ny < 2 || ny >= h - 3) continue;
                if (chunk.blocks[cidx(nx, ny, nz)] === STONE && rand() < 0.6) chunk.blocks[cidx(nx, ny, nz)] = ore;
              }
            }
          }
        }

        const caveTop = biome === 'desert' ? h - 4 : h - 1;
        const lavaChannel = Math.abs(fbm2(x * 0.014 - 71.8, z * 0.014 + 126.4, 3));
        const lavaLevel = 20 + Math.floor((fbm2(x * 0.008 + 19, z * 0.008 - 44, 2) + 1) * 54);
        const floodedCavern = fbm2(x * 0.019 + 43, z * 0.019 - 98, 2) < -0.28;
        // only rare ores survive cave carving — common ores (coal/iron/redstone/etc) are carved away to avoid floating ore walls like in screenshot
        const isRareOreId = (id: number) => id === NETHERITE_ORE || id === DIAMOND_ORE || id === EMERALD_ORE || id === GOLD_ORE;

        // ---- New cave biome carving: large caverns for lush/vine/mossy/lake, dripstone for deep ----
        // reference-like caves: big open rooms, mossy floors, hanging vines, dripstone columns, underground lakes
        for (let y = 2; y < caveTop; y++) {
          const at = cidx(lx, y, lz);
          let cur = chunk.blocks[at];
          if (cur === BEDROCK || isRareOreId(cur)) continue;

          // deepslate layer below y=40
          if (y < 38 && cur === STONE) {
            if (y < 28 || fbm2(x * 0.03 + y * 0.02, z * 0.03 - y * 0.02, 2) > 0.1) {
              chunk.blocks[at] = DEEPSLATE;
              cur = DEEPSLATE;
            }
          }

          const caveBiome = this.caveBiomeAt(x, y, z);
          const c1 = fbm3(x * 0.055, y * 0.085, z * 0.055, 3);
          const largeCave = fbm3(x * 0.019, y * 0.027, z * 0.019, 2);
          const detail = fbm3(x * 0.11 + 90, y * 0.14 - 40, z * 0.11 + 30, 2);
          const bias = y < 14 ? 0.05 : 0.0;

          let shouldCarve = false;
          if (caveBiome === 'amethyst') {
            // geode: spherical cavity
            const gx = Math.floor(x / 16) * 16 + 8 + (fbm2(x * 0.1, z * 0.1, 1) * 6);
            const gy = 20 + Math.floor(fbm2(x * 0.05 + 123, z * 0.05 - 44, 2) * 10);
            const gz = Math.floor(z / 16) * 16 + 8 + (fbm2(x * 0.1 + 55, z * 0.1 - 22, 1) * 6);
            const dist = Math.sqrt((x - gx) ** 2 + (y - gy) ** 2 + (z - gz) ** 2);
            if (dist < 6) shouldCarve = true;
            else if (dist < 7.5 && cur !== AIR) {
              chunk.blocks[at] = AMETHYST_BLOCK;
              continue;
            }
          } else if (caveBiome === 'lake') {
            // huge open lake caverns — reference: big water-filled rooms with clay banks
            if (largeCave > -0.08 && c1 > 0.02 - bias) shouldCarve = true;
            else if (c1 > 0.18 - bias) shouldCarve = true;
          } else if (caveBiome === 'lush' || caveBiome === 'vine') {
            // lush/vine: very large open caverns with low threshold, plus secondary tunnels — reference lush caves
            if (largeCave > -0.10 && c1 > -0.05) shouldCarve = true;
            else if (c1 > 0.20 - bias) shouldCarve = true;
          } else if (caveBiome === 'mossy') {
            if (largeCave > -0.05 && c1 > 0.0) shouldCarve = true;
            else if (c1 > 0.24 - bias) shouldCarve = true;
          } else if (caveBiome === 'dripstone' || caveBiome === 'deep') {
            if (c1 > 0.24 - bias) shouldCarve = true;
            else if (y < 26 && detail > 0.38) shouldCarve = true;
          } else {
            // normal: more caves than before, but not as huge as lush
            if (c1 > 0.30 - bias) shouldCarve = true;
            else if (y < 26 && detail > 0.42) shouldCarve = true;
          }

          // fissures: meandering diagonal cracks, but less frequent in lush biomes
          if (!shouldCarve && y >= SEA - 150 && y < h - 1 && caveBiome !== 'lush' && caveBiome !== 'vine') {
            const fissure = fbm3(x * 0.023 + y * 0.016 + 147.2, y * 0.042 - 83.6, z * 0.023 - y * 0.016 + 91.3, 2);
            if (Math.abs(fissure) < 0.065 && detail > -0.32) {
              let airBelow = 0;
              for (let dy = 1; dy <= 5; dy++) {
                const yy = y - dy;
                if (yy < 0) break;
                if (chunk.blocks[cidx(lx, yy, lz)] === AIR) airBelow++;
                else break;
              }
              const ledgeNoise = fbm2(x * 0.11 + y * 0.07, z * 0.11 - y * 0.07, 2);
              if (airBelow < 5 || ledgeNoise > 0.15) shouldCarve = true;
            }
          }

          if (shouldCarve && cur !== AIR) {
            chunk.blocks[at] = AIR;
            cur = AIR;
          }

          if (cur !== AIR) continue;

          // water / lava handling based on cave biome
          if (caveBiome === 'lake' && y > 18 && y < SEA - 18) {
            // underground lake water
            if (largeCave < 0.0 && y < SEA - 24) {
              chunk.blocks[at] = WATER;
            }
          } else {
            const canFlood = floodedCavern && y > 18 && y < SEA - 54;
            const floodNoise = canFlood ? fbm3(x * 0.036 + 18, y * 0.043 - 14, z * 0.036 - 51, 2) : 1;
            if (canFlood && floodNoise < -0.22) {
              chunk.blocks[at] = WATER;
            } else if (y > 12 && y < SEA - 130 && lavaChannel < 0.052 && Math.abs(y - lavaLevel) <= 1 && c1 > 0.18) {
              chunk.blocks[at] = LAVA;
            }
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

    // ---- Cave biome decoration: moss, vines, dripstone, glow berries, etc ----
    {
      const caveRand = mulberry32(this.seed ^ (cx * 8191) ^ (cz * 131071));
      for (let y = 6; y < SEA + 10; y++) {
        for (let lz = 0; lz < CHUNK; lz++) {
          for (let lx = 0; lx < CHUNK; lx++) {
            const x = cx * CHUNK + lx;
            const z = cz * CHUNK + lz;
            const at = cidx(lx, y, lz);
            const id = chunk.blocks[at];
            if (id !== AIR) continue;
            const below = y > 0 ? chunk.blocks[cidx(lx, y - 1, lz)] : BEDROCK;
            const above = y < WY - 1 ? chunk.blocks[cidx(lx, y + 1, lz)] : AIR;
            const caveBiome = this.caveBiomeAt(x, y, z);
            if (caveBiome === 'normal' || caveBiome === 'deep') continue;

            // floor decorations
            if (below === STONE || below === DEEPSLATE || below === DRIPSTONE_BLOCK || below === CAVE_MOSS_BLOCK) {
              if (caveBiome === 'lush') {
                const r = caveRand();
                if (r < 0.18) chunk.blocks[at] = CAVE_MOSS_BLOCK;
                else if (r < 0.24) chunk.blocks[at] = CLAY;
                else if (r < 0.28) chunk.blocks[at] = MOSS_CARPET;
                else if (r < 0.30) chunk.blocks[at] = AZALEA_LEAVES;
                else if (r < 0.32) chunk.blocks[at] = AZALEA_FLOWERING;
                else if (r < 0.36) chunk.blocks[at] = GLOW_LICHEN;
              } else if (caveBiome === 'vine') {
                const r = caveRand();
                if (r < 0.14) chunk.blocks[at] = CAVE_MOSS_BLOCK;
                else if (r < 0.20) chunk.blocks[at] = MOSS_CARPET;
                else if (r < 0.26) chunk.blocks[at] = GLOW_LICHEN;
              } else if (caveBiome === 'mossy') {
                const r = caveRand();
                if (r < 0.12) chunk.blocks[at] = MOSSY_COBBLE;
                else if (r < 0.18) chunk.blocks[at] = MOSS_CARPET;
                else if (r < 0.22) chunk.blocks[at] = CAVE_MOSS_BLOCK;
              } else if (caveBiome === 'dripstone') {
                const r = caveRand();
                if (r < 0.08 && y < 60) {
                  // stalagmite rising
                  const h = 1 + Math.floor(caveRand() * 3);
                  for (let dy = 0; dy < h; dy++) {
                    if (y + dy < WY && chunk.blocks[cidx(lx, y + dy, lz)] === AIR)
                      chunk.blocks[cidx(lx, y + dy, lz)] = dy === h - 1 ? POINTED_DRIPSTONE : DRIPSTONE_BLOCK;
                  }
                } else if (r < 0.12) {
                  chunk.blocks[at] = DRIPSTONE_BLOCK;
                }
              } else if (caveBiome === 'lake') {
                if (caveRand() < 0.06 && below !== WATER) chunk.blocks[cidx(lx, y - 1, lz)] = CLAY;
              }
            }

            // ceiling decorations - hanging vines, roots, stalactites, spore blossom
            if (above === STONE || above === DEEPSLATE || above === DRIPSTONE_BLOCK || above === CAVE_MOSS_BLOCK) {
              if (caveBiome === 'lush' || caveBiome === 'vine') {
                const r = caveRand();
                if (r < 0.10) {
                  // hanging vine column with glow berries
                  const len = 2 + Math.floor(caveRand() * (caveBiome === 'vine' ? 8 : 4));
                  for (let dy = 0; dy < len; dy++) {
                    const yy = y - dy;
                    if (yy < 1) break;
                    const idx = cidx(lx, yy, lz);
                    if (chunk.blocks[idx] !== AIR) break;
                    if (dy === len - 1 && caveRand() < 0.5) chunk.blocks[idx] = GLOW_BERRY;
                    else chunk.blocks[idx] = caveRand() < 0.35 ? CAVE_VINE_GLOW : CAVE_VINE;
                  }
                } else if (r < 0.14) {
                  chunk.blocks[at] = HANGING_ROOTS;
                } else if (r < 0.16 && caveBiome === 'lush') {
                  chunk.blocks[at] = SPORE_BLOSSOM;
                } else if (r < 0.19) {
                  chunk.blocks[at] = GLOW_LICHEN;
                }
              } else if (caveBiome === 'mossy') {
                if (caveRand() < 0.07) {
                  const len = 1 + Math.floor(caveRand() * 4);
                  for (let dy = 0; dy < len; dy++) {
                    const yy = y - dy;
                    if (yy < 1) break;
                    const idx = cidx(lx, yy, lz);
                    if (chunk.blocks[idx] !== AIR) break;
                    chunk.blocks[idx] = CAVE_VINE;
                  }
                }
              } else if (caveBiome === 'dripstone' || caveBiome === 'deep') {
                if (caveRand() < 0.09) {
                  const len = 1 + Math.floor(caveRand() * 5);
                  for (let dy = 0; dy < len; dy++) {
                    const yy = y - dy;
                    if (yy < 1) break;
                    const idx = cidx(lx, yy, lz);
                    if (chunk.blocks[idx] !== AIR) break;
                    chunk.blocks[idx] = dy === len - 1 ? POINTED_DRIPSTONE : DRIPSTONE_BLOCK;
                  }
                }
              } else if (caveBiome === 'amethyst') {
                if (caveRand() < 0.12) chunk.blocks[at] = AMETHYST_BLOCK;
              }
            }

            // occasional mushroom patches in lush/mossy
            if ((caveBiome === 'lush' || caveBiome === 'mossy') && caveRand() < 0.005) {
              if (below === CAVE_MOSS_BLOCK || below === STONE || below === CLAY) {
                // small mushroom cluster
                chunk.blocks[at] = MUSHROOM;
                if (caveRand() < 0.3 && y + 1 < WY) {
                  const up = cidx(lx, y + 1, lz);
                  if (chunk.blocks[up] === AIR) chunk.blocks[up] = MUSHROOM_BLOCK_RED;
                }
              }
            }
          }
        }
        if (y % 8 === 0) {
          // yield occasionally to keep generator responsive
          // Note: we are inside generator, so we can yield
          // but we are in a non-generator block, need to handle outside? We'll just continue
        }
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

    // ---- seasonal flower meadows: summer blooms, autumn asters, jungle orchids + expanded forest flora ----
    const centerBiome = this.biomeAt(cx * CHUNK + 8, cz * CHUNK + 8);
    const flowerPatches = centerBiome === 'jungle' ? 4 : centerBiome === 'autumn' ? 3 : centerBiome === 'plains' ? 4 : 1;
    for (let i = 0; i < flowerPatches; i++) {
      if (rand() > 0.62) continue;
      const fx = cx * CHUNK + 2 + Math.floor(rand() * 12);
      const fz = cz * CHUNK + 2 + Math.floor(rand() * 12);
      const patchBiome = this.biomeAt(fx, fz, this.getHeight(fx, fz));
      let palette: number[];
      if (patchBiome === 'autumn') {
        palette = [FLOWER_YELLOW, FLOWER_PURPLE, FLOWER_RED, FLOWER_TULIP_ORANGE, FLOWER_TULIP_RED, FLOWER_DAISY, LEAF_PILE, BUSH];
      } else if (patchBiome === 'jungle') {
        palette = [FLOWER_PINK, FLOWER_WHITE, FLOWER_BLUE, FLOWER_RED, FLOWER_ORCHID, FLOWER_PEONY, FLOWER_WISTERIA, WISTERIA_VINE, BUSH_FLOWERING];
      } else if (patchBiome === 'plains') {
        // summer forest: dense tulip fields, sunflowers, lavender, daisy, rose, peony — reference photos 11-20
        palette = [
          FLOWER_TULIP_RED, FLOWER_TULIP_YELLOW, FLOWER_TULIP_PINK, FLOWER_TULIP_ORANGE, FLOWER_TULIP_WHITE,
          FLOWER_SUNFLOWER, FLOWER_ROSE, FLOWER_LAVENDER, FLOWER_DAISY, FLOWER_PEONY,
          TALL_LAVENDER, TALL_SUNFLOWER, BUSH_FLOWERING, BERRY_BUSH
        ];
      } else if (patchBiome === 'winter') {
        palette = [FLOWER_WHITE, FLOWER_TULIP_WHITE, MOSS_CARPET, BUSH];
      } else {
        palette = [FLOWER_RED, FLOWER_YELLOW, FLOWER_BLUE, FLOWER_PINK, FLOWER_WHITE, FLOWER_TULIP_PINK];
      }
      // dense meadow: pick one dominant species per patch for visual impact (like reference photos)
      const dominant = palette[Math.floor(rand() * palette.length)];
      const secondary = palette[Math.floor(rand() * palette.length)];
      for (let p = 0; p < 10 + Math.floor(rand() * 10); p++) {
        const px = fx + Math.floor(rand() * 7) - 3;
        const pz = fz + Math.floor(rand() * 7) - 3;
        const h = this.getHeight(px, pz);
        const localBiome = this.biomeAt(px, pz, h);
        if (this.get(px, h, pz) !== GRASS || this.get(px, h + 1, pz) !== AIR) continue;
        if (localBiome === 'winter' && rand() > 0.5) continue;
        const kind = rand() < 0.72 ? dominant : secondary;
        this.set(px, h + 1, pz, kind);
      }
    }
    // ---- forest ground cover: moss carpets, leaf piles, bushes (summer/winter/autumn variety) ----
    if (['plains', 'autumn', 'winter'].includes(centerBiome)) {
      const gcCount = centerBiome === 'plains' ? 7 : centerBiome === 'autumn' ? 5 : 3;
      for (let i = 0; i < gcCount; i++) {
        if (rand() > 0.72) continue;
        const gx = cx * CHUNK + 1 + Math.floor(rand() * 14);
        const gz = cz * CHUNK + 1 + Math.floor(rand() * 14);
        const h = this.getHeight(gx, gz);
        if (this.get(gx, h, gz) !== GRASS || this.get(gx, h + 1, gz) !== AIR) continue;
        const roll = rand();
        let id = MOSS_CARPET;
        if (centerBiome === 'autumn') id = roll < 0.45 ? LEAF_PILE : roll < 0.7 ? MOSS_CARPET : BUSH;
        else if (centerBiome === 'winter') id = roll < 0.5 ? MOSS_CARPET : BUSH;
        else id = roll < 0.3 ? BUSH : roll < 0.5 ? BUSH_FLOWERING : roll < 0.65 ? BERRY_BUSH : roll < 0.8 ? MOSS_CARPET : TALL_GRASS;
        this.set(gx, h + 1, gz, id);
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

    // ---- surface ore pokes (keep open desert sand plains clean) — reduced density
    for (let i = 0; i < 3; i++) {
      if (rand() > 0.82) continue;
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

    // guaranteed starter vein in the spawn chunk area — reduced to 2 small veins
    const scx = Math.floor(ORIGIN_X / CHUNK);
    const scz = Math.floor(ORIGIN_Z / CHUNK);
    if (Math.abs(cx - scx) <= 1 && Math.abs(cz - scz) <= 1) {
      for (let i = 0; i < 2; i++) {
        const x = cx * CHUNK + 2 + Math.floor(rand() * 12);
        const z = cz * CHUNK + 2 + Math.floor(rand() * 12);
        if (this.biomeAt(x, z) === 'desert') continue;
        this.placeOreColumn(x, z, COAL_ORE, 1);
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
      } else if (isDesertMountainTransition(this, cx, cz) && sRand() < 0.15) {
        buildCliffsideCarvedTemple(this, cx, cz, sRand);
      } else {
        const roll = sRand();
        // keep the spawn basin itself clear
        const nearSpawn = Math.abs(cx - scx) <= 1 && Math.abs(cz - scz) <= 1;
        if (!nearSpawn) {
          if (biome === 'plains' || biome === 'autumn' || biome === 'winter') {
            // expanded forest biomes: castles, ruined castles, cliff houses, face gates, flower groves — balanced density
            if (roll < 0.018) this.buildForestCastle(cx, cz, sRand);
            else if (roll < 0.032) this.buildRuinedCastle(cx, cz, sRand);
            else if (roll < 0.048) this.buildCliffHouses(cx, cz, sRand);
            else if (roll < 0.058) this.buildDwarfFaceGate(cx, cz, sRand);
            else if (roll < 0.078) this.buildFlowerGrove(cx, cz, sRand);
            else if (roll < 0.10) this.buildCottage(cx, cz, sRand);
            else if (roll < 0.12) this.buildTower(cx, cz, sRand);
            else if (roll < 0.135) this.buildRuinYard(cx, cz, sRand);
          } else {
            if (roll < 0.03) this.buildCottage(cx, cz, sRand);
            else if (roll < 0.05) this.buildTower(cx, cz, sRand);
            else if (roll < 0.06) this.buildRuinYard(cx, cz, sRand);
          }
        }
      }
      this.placeStructureChests(firstStructureSite, sRand);
      this.decorateTreasureCaches(cx, cz, rand);

      // ---- underground cave structures: lush sanctuaries, vine groves, dripstone chambers, mossy ruins, lake villages ----
      if (sRand() < 0.12) {
        const cr = sRand();
        if (cr < 0.25) this.buildLushCaveSanctuary(cx, cz, sRand);
        else if (cr < 0.45) this.buildVineCaveGrove(cx, cz, sRand);
        else if (cr < 0.65) this.buildDripstoneChamber(cx, cz, sRand);
        else if (cr < 0.85) this.buildMossyRuins(cx, cz, sRand);
        else this.buildUndergroundLakeVillage(cx, cz, sRand);
      }
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
    const maxSlope = w > 10 || d > 10 ? 6 : 4;
    const maxH = SEA + 28;
    for (let tries = 0; tries < 16; tries++) {
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
      if (hMax - hMin > maxSlope || hMin < SEA + 1 || hMax > maxH) continue;
      // avoid water-adjacent spots for large castles
      if (w > 10) {
        let wet = false;
        for (let dx = -1; dx <= w; dx++) for (let dz = -1; dz <= d; dz++) {
          if (this.getHeight(x + dx, z + dz) <= SEA) { wet = true; break; }
        }
        if (wet) continue;
      }
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
    this.set(x0 + 3, y0 + 1, z0 + 3, COBBLE);
    this.set(x0 + 3, y0 + 2, z0 + 3, FENCE_STONE);
    this.set(x0 + 3, y0 + 3, z0 + 3, FENCE_WOOD);
    this.set(x0 + 3, y0 + 4, z0 + 3, PLANKS);
    this.set(x0 + 4, y0 + 4, z0 + 3, FENCE_WOOD);
    this.set(x0 + 4, y0 + 3, z0 + 3, TORCH);
    if (rand() < 0.5) this.set(x0 + 2, y0 + 1, z0 + 3, GOLD_BLOCK);
  }

  // ---- Forest biome expansions: castles, ruined castles, cliff towns, dwarf face gate, cave dwellings ----
  private buildForestCastle(cx: number, cz: number, rand: () => number) {
    // Reference: images 1-8 cliff towns, ivy-covered towers, stone brick castles
    const spot = this.flatSpotInChunk(cx, cz, 13, 13, rand);
    if (!spot) return;
    const [x0, y0, z0] = spot;
    const w = 11, d = 11;
    const h = 7 + Math.floor(rand() * 3);
    this.clearBox(x0, y0 + 1, z0, w, h + 4, d);
    this.fillFloor(x0, y0, z0, w, d, STONE_BRICK);
    // outer walls
    for (let y = 1; y <= h; y++) {
      const wallMat = y <= 2 ? STONE_BRICK : rand() < 0.12 ? CRACKED_STONE_BRICK : STONE_BRICK;
      for (let x = x0; x < x0 + w; x++) {
        this.set(x, y0 + y, z0, wallMat);
        this.set(x, y0 + y, z0 + d - 1, wallMat);
      }
      for (let z = z0 + 1; z < z0 + d - 1; z++) {
        this.set(x0, y0 + y, z, wallMat);
        this.set(x0 + w - 1, y0 + y, z, wallMat);
      }
    }
    // corner towers
    for (const [tx, tz] of [[x0, z0], [x0 + w - 1, z0], [x0, z0 + d - 1], [x0 + w - 1, z0 + d - 1]] as const) {
      for (let y = 1; y <= h + 3; y++) {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 1) continue;
          const mat = y > h ? STONE_BRICK : rand() < 0.1 ? MOSSY_STONE_BRICK : STONE_BRICK;
          this.set(tx + dx, y0 + y, tz + dz, mat);
        }
      }
      // crenellations
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if ((dx + dz) % 2 === 0) this.set(tx + dx, y0 + h + 4, tz + dz, STONE_BRICK);
      }
    }
    // gate
    const gx = x0 + Math.floor(w / 2);
    this.set(gx, y0 + 1, z0, AIR);
    this.set(gx, y0 + 2, z0, AIR);
    this.set(gx, y0 + 3, z0, FENCE_WOOD);
    // interior keep
    const kx = x0 + 3, kz = z0 + 3;
    for (let y = 1; y <= 4; y++) {
      for (let x = kx; x < kx + 5; x++) {
        this.set(x, y0 + y, kz, STONE_BRICK);
        this.set(x, y0 + y, kz + 4, STONE_BRICK);
      }
      for (let z = kz + 1; z < kz + 4; z++) {
        this.set(kx, y0 + y, z, STONE_BRICK);
        this.set(kx + 4, y0 + y, z, STONE_BRICK);
      }
    }
    this.fillFloor(kx + 1, y0 + 1, kz + 1, 3, 3, PLANKS);
    this.set(kx + 2, y0 + 2, kz + 2, TORCH);
    // overgrowth - vines/wisteria on walls
    for (let i = 0; i < 6; i++) {
      const wx = x0 + Math.floor(rand() * w);
      const wz = rand() < 0.5 ? z0 : z0 + d - 1;
      if (rand() < 0.6) this.set(wx, y0 + h - Math.floor(rand() * 3), wz, WISTERIA_VINE);
      else this.set(wx, y0 + h - Math.floor(rand() * 3), wz, VINE);
    }
    this.structureSites.push({ x: x0 + Math.floor(w / 2), y: y0 + 1, z: z0 + Math.floor(d / 2), kind: 'tower' });
  }

  private buildRuinedCastle(cx: number, cz: number, rand: () => number) {
    // Overgrown mossy ruins with collapsed walls, ivy, wisteria — images 4-8
    const spot = this.flatSpotInChunk(cx, cz, 15, 15, rand);
    if (!spot) return;
    const [x0, y0, z0] = spot;
    const w = 12 + Math.floor(rand() * 3);
    const d = 12 + Math.floor(rand() * 3);
    const baseH = 3 + Math.floor(rand() * 3);
    this.clearBox(x0, y0 + 1, z0, w, baseH + 5, d);
    // rubble floor with moss
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
      if (rand() < 0.7) this.set(x, y0, z, rand() < 0.5 ? MOSSY_COBBLE : COBBLE);
      if (rand() < 0.18) this.set(x, y0 + 1, z, rand() < 0.5 ? MOSS_CARPET : LEAF_PILE);
    }
    // crumbling walls
    for (let y = 1; y <= baseH; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (rand() < 0.72) {
          const mat = rand() < 0.5 ? MOSSY_STONE_BRICK : rand() < 0.7 ? CRACKED_STONE_BRICK : STONE_BRICK;
          if (rand() < 0.85) this.set(x, y0 + y, z0, mat);
          if (rand() < 0.85) this.set(x, y0 + y, z0 + d - 1, mat);
        }
      }
      for (let z = z0 + 1; z < z0 + d - 1; z++) {
        if (rand() < 0.72) {
          const mat = rand() < 0.5 ? MOSSY_STONE_BRICK : CRACKED_STONE_BRICK;
          if (rand() < 0.85) this.set(x0, y0 + y, z, mat);
          if (rand() < 0.85) this.set(x0 + w - 1, y0 + y, z, mat);
        }
      }
    }
    // collapsed tower stump
    const tx = x0 + 2, tz = z0 + 2;
    for (let y = 1; y <= baseH + 2; y++) {
      if (rand() < 0.8) this.set(tx, y0 + y, tz, MOSSY_STONE_BRICK);
      if (rand() < 0.6) this.set(tx + 1, y0 + y, tz, MOSSY_STONE_BRICK);
    }
    // overgrowth: vines, wisteria, bushes, flowers
    for (let i = 0; i < 10; i++) {
      const rx = x0 + Math.floor(rand() * w);
      const rz = z0 + Math.floor(rand() * d);
      const rh = y0 + 1 + Math.floor(rand() * 2);
      if (this.get(rx, rh, rz) !== AIR) continue;
      const r = rand();
      if (r < 0.25) this.set(rx, rh, rz, WISTERIA_VINE);
      else if (r < 0.45) this.set(rx, rh, rz, VINE);
      else if (r < 0.65) this.set(rx, rh, rz, BUSH);
      else if (r < 0.85) this.set(rx, rh, rz, [FLOWER_WISTERIA, FLOWER_LAVENDER, FLOWER_DAISY][Math.floor(rand() * 3)]);
      else this.set(rx, rh, rz, MOSS_CARPET);
    }
    if (rand() < 0.6) this.set(x0 + Math.floor(w / 2), y0 + 1, z0 + Math.floor(d / 2), GOLD_BLOCK);
    this.structureSites.push({ x: x0 + Math.floor(w / 2), y: y0 + 1, z: z0 + Math.floor(d / 2), kind: 'ruin' });
  }

  private buildCliffHouses(cx: number, cz: number, rand: () => number) {
    // Cliffside carved dwellings / cave houses — images 1-3, 6-8 (stone face gate style)
    // Find a steep drop
    for (let attempt = 0; attempt < 4; attempt++) {
      const bx = cx * CHUNK + 3 + Math.floor(rand() * 10);
      const bz = cz * CHUNK + 3 + Math.floor(rand() * 10);
      const h = this.getHeight(bx, bz);
      if (h < SEA + 6 || h > SEA + 22) continue;
      // check for cliff nearby
      let cliffDir: [number, number] | null = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nh = this.getHeight(bx + dx * 6, bz + dz * 6);
        if (h - nh >= 7) { cliffDir = [dx, dz]; break; }
      }
      if (!cliffDir) continue;
      const [cdx, cdz] = cliffDir;
      const faceX = bx + cdx * 3;
      const faceZ = bz + cdz * 3;
      const faceH = this.getHeight(faceX, faceZ);
      // carve cave dwellings into cliff face
      for (let cave = 0; cave < 2 + Math.floor(rand() * 2); cave++) {
        const caveX = faceX + (rand() < 0.5 ? -1 : 1) * Math.floor(rand() * 3);
        const caveZ = faceZ + (rand() < 0.5 ? -1 : 1) * Math.floor(rand() * 3);
        const caveY = faceH - 1 - cave * 3;
        if (caveY < 5) continue;
        // 3x3x3 cave room
        for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 2; dz++) for (let dx = -1; dx <= 2; dx++) {
          this.set(caveX + dx, caveY + dy, caveZ + dz, AIR);
        }
        // stone brick door frame
        this.set(caveX, caveY, caveZ, STONE_BRICK);
        this.set(caveX, caveY + 1, caveZ, STONE_BRICK);
        this.set(caveX + 1, caveY, caveZ, STONE_BRICK);
        this.set(caveX + 1, caveY + 2, caveZ, STONE_BRICK);
        this.set(caveX, caveY + 2, caveZ, STONE_BRICK);
        this.set(caveX + 1, caveY + 1, caveZ, DOOR_WOOD);
        // interior
        this.set(caveX + 1, caveY, caveZ + 1, PLANKS);
        this.set(caveX, caveY, caveZ + 1, TORCH);
        // small balcony with fence
        if (rand() < 0.6) {
          this.set(caveX, caveY, caveZ - 1, FENCE_WOOD);
          this.set(caveX + 1, caveY, caveZ - 1, FENCE_WOOD);
        }
      }
      // add bushes/flowers around cliff top
      for (let i = 0; i < 5; i++) {
        const rx = bx + Math.floor(rand() * 5) - 2;
        const rz = bz + Math.floor(rand() * 5) - 2;
        const rh = this.getHeight(rx, rz);
        if (this.get(rx, rh, rz) === GRASS && this.get(rx, rh + 1, rz) === AIR) {
          this.set(rx, rh + 1, rz, rand() < 0.5 ? BUSH : FLOWER_TULIP_PINK);
        }
      }
      this.structureSites.push({ x: bx, y: h + 1, z: bz, kind: 'cottage' });
      return;
    }
  }

  private buildDwarfFaceGate(cx: number, cz: number, rand: () => number) {
    // Stone face gate carved into hillside — reference images show dwarf/face gate
    const spot = this.flatSpotInChunk(cx, cz, 9, 6, rand);
    if (!spot) return;
    const [x0, y0, z0] = spot;
    // find hillside
    let hillX = x0 + 4, hillZ = z0 + 3;
    let maxH = y0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const h = this.getHeight(x0 + 4 + dx, z0 + 3 + dz);
      if (h > maxH) { maxH = h; hillX = x0 + 4 + dx; hillZ = z0 + 3 + dz; }
    }
    if (maxH - y0 < 5) return;
    // build face wall
    const faceY = maxH - 2;
    for (let dy = 0; dy < 6; dy++) for (let dx = -3; dx <= 3; dx++) {
      const mat = dy < 2 ? STONE_BRICK : rand() < 0.3 ? MOSSY_STONE_BRICK : STONE_BRICK;
      this.set(hillX + dx, faceY + dy, hillZ, mat);
    }
    // eyes (indent)
    this.set(hillX - 1, faceY + 4, hillZ, AIR);
    this.set(hillX + 1, faceY + 4, hillZ, AIR);
    this.set(hillX - 1, faceY + 3, hillZ, AIR);
    this.set(hillX + 1, faceY + 3, hillZ, AIR);
    // mouth = doorway
    this.set(hillX, faceY + 1, hillZ, AIR);
    this.set(hillX, faceY + 2, hillZ, AIR);
    this.set(hillX, faceY, hillZ, AIR);
    // tunnel behind
    for (let d = 1; d <= 4; d++) {
      for (let dy = 0; dy < 3; dy++) for (let dx = -1; dx <= 1; dx++) {
        this.set(hillX + dx, faceY + dy, hillZ + d, AIR);
      }
      this.set(hillX - 1, faceY + 3, hillZ + d, STONE_BRICK);
      this.set(hillX + 1, faceY + 3, hillZ + d, STONE_BRICK);
    }
    this.set(hillX, faceY, hillZ + 4, PLANKS);
    this.set(hillX, faceY + 1, hillZ + 2, TORCH);
    this.structureSites.push({ x: hillX, y: faceY, z: hillZ, kind: 'ruin' });
  }

  private buildFlowerGrove(cx: number, cz: number, rand: () => number) {
    // Dense flower grove with cherry blossoms / wisteria canopy — images 11-20
    const x = cx * CHUNK + 4 + Math.floor(rand() * 8);
    const z = cz * CHUNK + 4 + Math.floor(rand() * 8);
    const h = this.getHeight(x, z);
    if (this.biomeAt(x, z, h) === 'winter' || h < SEA + 1) return;
    if (this.get(x, h, z) !== GRASS) return;
    // plant 2-3 cherry/jacaranda trees
    for (let t = 0; t < 2 + Math.floor(rand() * 2); t++) {
      const tx = x + Math.floor(rand() * 7) - 3;
      const tz = z + Math.floor(rand() * 7) - 3;
      const th = this.getHeight(tx, tz);
      if (this.get(tx, th, tz) === GRASS && this.get(tx, th + 1, tz) === AIR) {
        if (rand() < 0.5) this.growCherryTree(tx, th + 1, tz, rand);
        else this.growJacarandaTree(tx, th + 1, tz, rand);
      }
    }
    // dense flower carpet underneath
    const flowerPalette = [
      FLOWER_TULIP_RED, FLOWER_TULIP_PINK, FLOWER_TULIP_YELLOW, FLOWER_TULIP_WHITE,
      FLOWER_DAISY, FLOWER_LAVENDER, FLOWER_PEONY, FLOWER_WISTERIA, FLOWER_ROSE,
      TALL_LAVENDER, BUSH_FLOWERING
    ];
    for (let i = 0; i < 18; i++) {
      const fx = x + Math.floor(rand() * 12) - 6;
      const fz = z + Math.floor(rand() * 12) - 6;
      const fh = this.getHeight(fx, fz);
      if (this.get(fx, fh, fz) === GRASS && this.get(fx, fh + 1, fz) === AIR) {
        this.set(fx, fh + 1, fz, flowerPalette[Math.floor(rand() * flowerPalette.length)]);
      }
    }
  }

  // ---- Cave biome structures (reference images 1-13) ----
  private buildLushCaveSanctuary(cx: number, cz: number, rand: () => number) {
    // Find large air pocket in lush/vine biome
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = cx * CHUNK + 3 + Math.floor(rand() * 10);
      const z = cz * CHUNK + 3 + Math.floor(rand() * 10);
      const y = 30 + Math.floor(rand() * 80);
      if (this.caveBiomeAt(x, y, z) !== 'lush' && this.caveBiomeAt(x, y, z) !== 'vine') continue;
      if (this.get(x, y, z) !== AIR) continue;
      // ensure 5x5x4 air space
      let open = 0;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) {
        if (this.get(x + dx, y + dy, z + dz) === AIR) open++;
      }
      if (open < 30) continue;
      // floor with moss, clay, water pool
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const fy = y - 1;
        if (this.get(x + dx, fy, z + dz) === STONE || this.get(x + dx, fy, z + dz) === DEEPSLATE || this.get(x + dx, fy, z + dz) === AIR) {
          if (rand() < 0.6) this.set(x + dx, fy, z + dz, CAVE_MOSS_BLOCK);
          else if (rand() < 0.8) this.set(x + dx, fy, z + dz, CLAY);
          else this.set(x + dx, fy, z + dz, ROOTED_DIRT);
        }
        if (rand() < 0.12 && this.get(x + dx, y, z + dz) === AIR) this.set(x + dx, y, z + dz, MOSS_CARPET);
      }
      // small water pool
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        this.set(x + dx, y - 1, z + dz, WATER);
      }
      // hanging vines with glow berries from ceiling
      for (let i = 0; i < 12; i++) {
        const vx = x + Math.floor(rand() * 7) - 3;
        const vz = z + Math.floor(rand() * 7) - 3;
        const vy = y + 3 + Math.floor(rand() * 3);
        if (this.get(vx, vy, vz) !== STONE && this.get(vx, vy, vz) !== DEEPSLATE && this.get(vx, vy, vz) !== CAVE_MOSS_BLOCK) continue;
        const len = 2 + Math.floor(rand() * 6);
        for (let dy = 0; dy < len; dy++) {
          const yy = vy - 1 - dy;
          if (this.get(vx, yy, vz) !== AIR) break;
          if (dy === len - 1 && rand() < 0.6) this.set(vx, yy, vz, GLOW_BERRY);
          else this.set(vx, yy, vz, rand() < 0.4 ? CAVE_VINE_GLOW : CAVE_VINE);
        }
      }
      // spore blossom and azalea
      for (let i = 0; i < 4; i++) {
        const rx = x + Math.floor(rand() * 5) - 2;
        const rz = z + Math.floor(rand() * 5) - 2;
        const ry = y + 2 + Math.floor(rand() * 2);
        if (this.get(rx, ry, rz) === STONE && this.get(rx, ry - 1, rz) === AIR) {
          this.set(rx, ry - 1, rz, SPORE_BLOSSOM);
        }
      }
      // glow lichen on walls
      for (let i = 0; i < 8; i++) {
        const wx = x + (rand() < 0.5 ? -3 : 3);
        const wz = z + Math.floor(rand() * 7) - 3;
        const wy = y + Math.floor(rand() * 3) - 1;
        if (this.get(wx, wy, wz) === STONE && this.get(wx + (wx < x ? 1 : -1), wy, wz) === AIR) {
          this.set(wx + (wx < x ? 1 : -1), wy, wz, GLOW_LICHEN);
        }
      }
      return;
    }
  }

  private buildVineCaveGrove(cx: number, cz: number, rand: () => number) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = cx * CHUNK + 3 + Math.floor(rand() * 10);
      const z = cz * CHUNK + 3 + Math.floor(rand() * 10);
      const y = 40 + Math.floor(rand() * 70);
      if (this.caveBiomeAt(x, y, z) !== 'vine') continue;
      if (this.get(x, y, z) !== AIR) continue;
      // dense hanging vines ceiling
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        if (rand() < 0.65) {
          const cx2 = x + dx, cz2 = z + dz;
          const cy = y + 4;
          if (this.get(cx2, cy, cz2) !== STONE && this.get(cx2, cy, cz2) !== CAVE_MOSS_BLOCK) continue;
          const len = 3 + Math.floor(rand() * 10);
          for (let dy = 0; dy < len; dy++) {
            const yy = cy - 1 - dy;
            if (this.get(cx2, yy, cz2) !== AIR) break;
            const isGlow = rand() < 0.45;
            this.set(cx2, yy, cz2, isGlow ? CAVE_VINE_GLOW : CAVE_VINE);
            if (isGlow && rand() < 0.25) {
              if (this.get(cx2, yy - 1, cz2) === AIR) this.set(cx2, yy - 1, cz2, GLOW_BERRY);
              break;
            }
          }
        }
      }
      // floor moss and ferns
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        if (rand() < 0.3 && this.get(x + dx, y - 1, z + dz) === STONE) this.set(x + dx, y - 1, z + dz, CAVE_MOSS_BLOCK);
        if (rand() < 0.08 && this.get(x + dx, y, z + dz) === AIR) this.set(x + dx, y, z + dz, FERN);
      }
      return;
    }
  }

  private buildDripstoneChamber(cx: number, cz: number, rand: () => number) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = cx * CHUNK + 3 + Math.floor(rand() * 10);
      const z = cz * CHUNK + 3 + Math.floor(rand() * 10);
      const y = 15 + Math.floor(rand() * 50);
      if (this.caveBiomeAt(x, y, z) !== 'dripstone' && this.caveBiomeAt(x, y, z) !== 'deep') continue;
      if (this.get(x, y, z) !== AIR) continue;
      // stalactites from ceiling
      for (let i = 0; i < 10; i++) {
        const sx = x + Math.floor(rand() * 7) - 3;
        const sz = z + Math.floor(rand() * 7) - 3;
        const sy = y + 3 + Math.floor(rand() * 3);
        if (this.get(sx, sy, sz) !== STONE && this.get(sx, sy, sz) !== DEEPSLATE && this.get(sx, sy, sz) !== DRIPSTONE_BLOCK) continue;
        const len = 1 + Math.floor(rand() * 6);
        for (let dy = 0; dy < len; dy++) {
          const yy = sy - 1 - dy;
          if (this.get(sx, yy, sz) !== AIR) break;
          this.set(sx, yy, sz, dy === len - 1 ? POINTED_DRIPSTONE : DRIPSTONE_BLOCK);
        }
      }
      // stalagmites from floor
      for (let i = 0; i < 10; i++) {
        const sx = x + Math.floor(rand() * 7) - 3;
        const sz = z + Math.floor(rand() * 7) - 3;
        const sy = y - 1;
        if (this.get(sx, sy, sz) !== STONE && this.get(sx, sy, sz) !== DEEPSLATE) continue;
        const len = 1 + Math.floor(rand() * 4);
        for (let dy = 0; dy < len; dy++) {
          const yy = sy + 1 + dy;
          if (this.get(sx, yy, sz) !== AIR) break;
          this.set(sx, yy, sz, dy === len - 1 ? POINTED_DRIPSTONE : DRIPSTONE_BLOCK);
        }
      }
      // dripstone block floor
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (rand() < 0.5 && this.get(x + dx, y - 1, z + dz) === STONE) this.set(x + dx, y - 1, z + dz, DRIPSTONE_BLOCK);
      }
      return;
    }
  }

  private buildMossyRuins(cx: number, cz: number, rand: () => number) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = cx * CHUNK + 3 + Math.floor(rand() * 10);
      const z = cz * CHUNK + 3 + Math.floor(rand() * 10);
      const y = 35 + Math.floor(rand() * 60);
      if (this.caveBiomeAt(x, y, z) !== 'mossy') continue;
      if (this.get(x, y, z) !== AIR) continue;
      // small ruined stone brick structure
      const w = 5 + Math.floor(rand() * 3);
      const d = 5 + Math.floor(rand() * 3);
      for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
        if (this.get(x + dx, y - 1, z + dz) === AIR || this.get(x + dx, y - 1, z + dz) === STONE) {
          this.set(x + dx, y - 1, z + dz, rand() < 0.6 ? MOSSY_STONE_BRICK : rand() < 0.8 ? MOSSY_COBBLE : STONE_BRICK);
        }
      }
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (rand() < 0.7) {
            if (this.get(x + dx, y + dy, z) === AIR) this.set(x + dx, y + dy, z, MOSSY_STONE_BRICK);
            if (this.get(x + dx, y + dy, z + d - 1) === AIR) this.set(x + dx, y + dy, z + d - 1, MOSSY_STONE_BRICK);
          }
        }
        for (let dz = 1; dz < d - 1; dz++) {
          if (rand() < 0.7) {
            if (this.get(x, y + dy, z + dz) === AIR) this.set(x, y + dy, z + dz, MOSSY_STONE_BRICK);
            if (this.get(x + w - 1, y + dy, z + dz) === AIR) this.set(x + w - 1, y + dy, z + dz, MOSSY_STONE_BRICK);
          }
        }
      }
      // vines and moss
      for (let i = 0; i < 6; i++) {
        const vx = x + Math.floor(rand() * w);
        const vz = z + (rand() < 0.5 ? 0 : d - 1);
        const vy = y + Math.floor(rand() * 3);
        if (this.get(vx, vy, vz) === MOSSY_STONE_BRICK && this.get(vx, vy - 1, vz) === AIR) this.set(vx, vy - 1, vz, CAVE_VINE);
      }
      if (rand() < 0.5) this.set(x + Math.floor(w / 2), y, z + Math.floor(d / 2), TORCH);
      this.structureSites.push({ x: x + Math.floor(w / 2), y, z: z + Math.floor(d / 2), kind: 'ruin' });
      return;
    }
  }

  private buildUndergroundLakeVillage(cx: number, cz: number, rand: () => number) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = cx * CHUNK + 4 + Math.floor(rand() * 8);
      const z = cz * CHUNK + 4 + Math.floor(rand() * 8);
      const y = 25 + Math.floor(rand() * 40);
      if (this.caveBiomeAt(x, y, z) !== 'lake') continue;
      if (this.get(x, y, z) !== AIR && this.get(x, y, z) !== WATER) continue;
      // create lake floor
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 4) continue;
        for (let dy = -2; dy <= 0; dy++) {
          const yy = y + dy;
          if (this.get(x + dx, yy, z + dz) === STONE || this.get(x + dx, yy, z + dz) === AIR) {
            if (dy === 0) this.set(x + dx, yy, z + dz, WATER);
            else this.set(x + dx, yy, z + dz, CLAY);
          }
        }
      }
      // wooden platforms on edge
      for (let i = 0; i < 2; i++) {
        const px = x + (rand() < 0.5 ? -4 : 4);
        const pz = z + Math.floor(rand() * 5) - 2;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          this.set(px + dx, y, pz + dz, PLANKS);
          this.set(px + dx, y - 1, pz + dz, FENCE_WOOD);
        }
        this.set(px, y + 1, pz, TORCH);
      }
      // hanging glow vines above lake
      for (let i = 0; i < 6; i++) {
        const vx = x + Math.floor(rand() * 9) - 4;
        const vz = z + Math.floor(rand() * 9) - 4;
        const vy = y + 5 + Math.floor(rand() * 4);
        if (this.get(vx, vy, vz) !== STONE) continue;
        const len = 2 + Math.floor(rand() * 5);
        for (let dy = 0; dy < len; dy++) {
          const yy = vy - 1 - dy;
          if (this.get(vx, yy, vz) !== AIR) break;
          this.set(vx, yy, vz, CAVE_VINE_GLOW);
        }
      }
      return;
    }
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
