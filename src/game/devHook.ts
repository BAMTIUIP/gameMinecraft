/**
 * Dev-only automation hook — never shipped to players.
 *
 * `App.tsx` exposes the running engine through `window.__ore` only while `import.meta.env.DEV` is
 * true. The production build replaces that flag with `false` and drops the whole branch, so none of
 * this reaches the Yandex Games archive (requirement 1.14: no developer instruments in the release).
 *
 * Local tooling (`tools/trailer/record.mjs`) uses the hook to prepare deterministic trailer scenes —
 * flat ground, a pond, a tree, scripted mobs, starting gear — and to read state back while capturing
 * promo footage. Every edit goes through the same `World`/`Engine` internals the game itself uses
 * (block writes + chunk re-mesh, the mob system, the hotbar), so the footage stays representative
 * of real gameplay: movement, camera, combat and pet AI are all simulated by the engine untouched.
 */
import { AIR, DIRT, GRASS, LEAVES, LOG, STONE, WATER } from './blocks';
import type { Engine } from './engine';
import { buildChunkGeometrySteps, type ChunkGeometry } from './mesher';
import type { MobId } from './mobs';
import { CHUNK, World, chunkKey } from './world';

/**
 * The engine fields the scene setup needs. They are private on `Engine` (a TypeScript-only
 * restriction), so the hook reaches them through this structural view — the engine itself does not
 * have to change.
 */
type EngineInternals = {
  world: World;
  pos: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  vel: { set(x: number, y: number, z: number): void };
  yaw: number;
  pitch: number;
  mobSys: {
    mobs: ReadonlyArray<{ alive: boolean }>;
    spawn(id: MobId, x: number, y: number, z: number): unknown;
    clear(): void;
  };
  markDirtyAt(x: number, z: number): void;
  addToolInstance(id: number): unknown;
  syncHotbar(force: boolean): void;
  meshBandForPlayer(): { key: number; minY: number; maxY: number };
  installChunkGeometry(cx: number, cz: number, geo: ChunkGeometry, bandKey?: number): void;
  dirtyChunks: Set<number>;
  dirtyMeshJob: { key: number } | null;
};

export type DevHook = {
  /** The live engine instance (its public API: movement input, camera, pets, inventory, …). */
  engine: Engine;
  /** Flatten a rectangle into a grass plain at height `y` (dirt/stone below, air above). */
  flatten(x0: number, z0: number, x1: number, z1: number, y: number): void;
  /** Dig a pond into a plain and fill it with still water one block below the rim. */
  pond(x0: number, z0: number, x1: number, z1: number, surfaceY: number, depth: number): void;
  /** Plant a tree (log trunk + leaf canopy). Returns the trunk base [x, y, z]. */
  plantTree(x: number, y: number, z: number, trunkHeight: number): [number, number, number];
  /** Move the player (scene cuts between scripted beats). */
  teleport(x: number, y: number, z: number, yaw?: number, pitch?: number): void;
  /** Spawn one mob through the real mob system; false when the mob budget refused it. */
  spawnMob(id: MobId, x: number, y: number, z: number): boolean;
  /** Remove every mob (clean scene between takes). */
  clearMobs(): void;
  /** Grant a durable tool and pin it to a hotbar slot (0-9). */
  grantTool(id: number, slot: number): void;
  /**
   * Build and install chunk meshes for a whole rectangle synchronously (the same mesher the frame
   * loop uses, just without its per-frame budget). Trailer capture pre-meshes the whole area the
   * player can stream during the take, so recording runs without meshing stutters.
   */
  premesh(cx0: number, cz0: number, cx1: number, cz1: number): number;
  /** Player position snapshot. */
  playerPos(): [number, number, number];
  /** Player look snapshot (yaw, pitch in radians). */
  playerLook(): [number, number];
};

/** Set one block and keep the owning chunk's heightmap in sync. */
function setBlock(world: World, x: number, y: number, z: number, id: number, height?: number) {
  world.set(x, y, z, id);
  if (height !== undefined) {
    const chunk = world.chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
    if (chunk) {
      chunk.height[(((z % CHUNK) + CHUNK) % CHUNK) * CHUNK + (((x % CHUNK) + CHUNK) % CHUNK)] = height;
    }
  }
}

export function exposeDevHook(engine: Engine): void {
  const e = engine as unknown as EngineInternals;
  const hook: DevHook = {
    engine,

    flatten(x0, z0, x1, z1, y) {
      const world = e.world;
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
        for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
          for (let dy = 14; dy >= -10; dy--) {
            const id = dy === 0 ? GRASS : dy >= -2 ? DIRT : STONE;
            world.set(x, y + dy, z, dy > 0 ? AIR : id);
          }
          setBlock(world, x, y, z, GRASS, y);
          e.markDirtyAt(x, z);
        }
      }
    },

    pond(x0, z0, x1, z1, surfaceY, depth) {
      const world = e.world;
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
        for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
          for (let dy = 14; dy >= -depth; dy--) world.set(x, surfaceY + dy, z, AIR);
          for (let dy = -1; dy >= -depth; dy--) world.set(x, surfaceY + dy, z, WATER);
          setBlock(world, x, surfaceY, z, WATER, surfaceY - depth);
          e.markDirtyAt(x, z);
        }
      }
    },

    plantTree(x, y, z, trunkHeight) {
      const world = e.world;
      for (let dy = 0; dy < trunkHeight; dy++) world.set(x, y + dy, z, LOG);
      const leafLayers: ReadonlyArray<readonly [number, ReadonlyArray<readonly [number, number]>]> = [
        [trunkHeight - 1, [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]],
        [trunkHeight, [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]],
        [trunkHeight + 1, [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]],
      ];
      for (const [dy, offsets] of leafLayers) {
        for (const [dx, dz] of offsets) {
          if (world.get(x + dx, y + dy, z + dz) === AIR) world.set(x + dx, y + dy, z + dz, LEAVES);
        }
      }
      e.markDirtyAt(x, z);
      return [x, y, z];
    },

    teleport(x, y, z, yaw, pitch) {
      e.pos.set(x, y, z);
      e.vel.set(0, 0, 0);
      if (yaw !== undefined) e.yaw = yaw;
      if (pitch !== undefined) e.pitch = pitch;
    },

    spawnMob(id, x, y, z) {
      return e.mobSys.spawn(id, x, y, z) !== null;
    },

    clearMobs() {
      e.mobSys.clear();
    },

    grantTool(id, slot) {
      e.addToolInstance(id);
      engine.assignToHotbar(id, slot);
      e.syncHotbar(true);
    },

    premesh(cx0, cz0, cx1, cz1) {
      const band = e.meshBandForPlayer();
      let meshed = 0;
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          if (!e.world.hasTerrain(cx, cz)) continue;
          const steps = buildChunkGeometrySteps(e.world, cx, cz, 256, band.minY, band.maxY);
          let result = steps.next();
          while (!result.done) result = steps.next();
          e.installChunkGeometry(cx, cz, result.value, band.key);
          meshed += 1;
        }
      }
      e.dirtyChunks.clear();
      e.dirtyMeshJob = null;
      return meshed;
    },

    playerPos() {
      return [e.pos.x, e.pos.y, e.pos.z];
    },

    playerLook() {
      return [e.yaw, e.pitch];
    },
  };
  (window as unknown as { __ore?: DevHook }).__ore = hook;
}
