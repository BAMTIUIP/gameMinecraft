import * as THREE from 'three';
import {
  AIR,
  BLOCKS,
  DEAD_BUSH,
  FERN,
  FLOWER_BLUE, DRY_BLOOM, DESERT_THISTLE, BIRD_NEST, CHICKEN_NEST,
  COCONUT_LEAVES,
  BANANA_LEAVES,
  VINE,
  FLOWER_RED,
  FLOWER_YELLOW,
  PENGUIN_EGG,
  TALL_GRASS,
  TURTLE_EGG,
  WATER,
  isCutout,
  isOpaque,
} from './blocks';
import { CHUNK, WY, World } from './world';
import { tileUV } from './textures';

type Corner = { pos: [number, number, number]; uv: [number, number] };
type Face = { dir: [number, number, number]; corners: Corner[]; shade: number };

// Corner order is TL, BL, TR, BR (indices 0,1,2 / 2,1,3) — matches three's voxel example.
export const FACES: Face[] = [
  {
    dir: [-1, 0, 0],
    shade: 0.66,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0],
    shade: 0.66,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    shade: 0.46,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1],
    shade: 0.8,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    shade: 0.8,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

const AO_LEVELS = [0.44, 0.64, 0.83, 1.0];

export type ChunkGeometry = {
  solid: THREE.BufferGeometry | null;
  cutout: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  /** untextured coloured decor models: flowers, egg clutches */
  decor: THREE.BufferGeometry | null;
};

/** per-face brightness matching the terrain look */
const BOX_SHADE = [0.66, 0.66, 0.46, 1.0, 0.8, 0.8]; // -x +x -y +y -z +z

/** append an axis-aligned coloured box (centre cx,cy,cz) to the decor buffers */
function addBox(
  P: number[],
  C: number[],
  I: number[],
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  r: number,
  g: number,
  b: number,
) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  // corners per face: [-x,+x,-y,+y,-z,+z], each 4 verts (2 tris)
  const faces: number[][][] = [
    [[x0, y1, z0], [x0, y0, z0], [x0, y1, z1], [x0, y0, z1]],
    [[x1, y1, z1], [x1, y0, z1], [x1, y1, z0], [x1, y0, z0]],
    [[x1, y0, z1], [x0, y0, z1], [x1, y0, z0], [x0, y0, z0]],
    [[x0, y1, z1], [x1, y1, z1], [x0, y1, z0], [x1, y1, z0]],
    [[x1, y0, z0], [x0, y0, z0], [x1, y1, z0], [x0, y1, z0]],
    [[x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1]],
  ];
  for (let f = 0; f < 6; f++) {
    const base = P.length / 3;
    const sh = Math.pow(BOX_SHADE[f], 2.2);
    for (const v of faces[f]) {
      P.push(v[0], v[1], v[2]);
      C.push(r * sh, g * sh, b * sh);
    }
    I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
}

const srgb = (hex: number): [number, number, number] => {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  return [c.r, c.g, c.b];
};
const COL = {
  stem: srgb(0x4d8c31),
  leafG: srgb(0x5f9738),
  red: srgb(0xe2564a),
  yellow: srgb(0xf4c842),
  blue: srgb(0x5e8cff),
  coreY: srgb(0xf4c842),
  coreB: srgb(0xb8722a),
  egg: srgb(0xeef2e4),
  eggShade: srgb(0xc8d0b8),
  sand: srgb(0xd4c491),
  grassA: srgb(0x5f9738),
  grassB: srgb(0x78b54e),
  grassC: srgb(0x4a7a2a),
  fernA: srgb(0x41822d),
  fernB: srgb(0x5ca03e),
  bushA: srgb(0xa4845c),
  bushB: srgb(0x88663e),
};

function addTallGrass(P: number[], C: number[], I: number[], x: number, y: number, z: number, seed: number) {
  const cx = x + 0.5 + (((seed * 7) % 5) - 2) * 0.03;
  const cz = z + 0.5 + (((seed * 11) % 5) - 2) * 0.03;
  const h = 0.55 + ((seed % 5) - 2) * 0.06;
  addBox(P, C, I, cx - 0.08, y + h * 0.45, cz - 0.05, 0.06, h * 0.9, 0.06, ...COL.grassA);
  addBox(P, C, I, cx + 0.07, y + h * 0.5, cz + 0.06, 0.06, h, 0.06, ...COL.grassB);
  addBox(P, C, I, cx - 0.04, y + h * 0.35, cz + 0.1, 0.05, h * 0.7, 0.05, ...COL.grassC);
  addBox(P, C, I, cx + 0.09, y + h * 0.4, cz - 0.08, 0.05, h * 0.8, 0.05, ...COL.grassA);
}

function addFern(P: number[], C: number[], I: number[], x: number, y: number, z: number, seed: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const h = 0.45 + ((seed % 3) - 1) * 0.04;
  addBox(P, C, I, cx, y + h * 0.5, cz, 0.08, h, 0.08, ...COL.fernA);
  addBox(P, C, I, cx + 0.14, y + h * 0.6, cz, 0.22, 0.05, 0.12, ...COL.fernB);
  addBox(P, C, I, cx - 0.14, y + h * 0.6, cz, 0.22, 0.05, 0.12, ...COL.fernB);
  addBox(P, C, I, cx, y + h * 0.5, cz + 0.14, 0.12, 0.05, 0.22, ...COL.fernB);
  addBox(P, C, I, cx, y + h * 0.5, cz - 0.14, 0.12, 0.05, 0.22, ...COL.fernB);
}

function addMushroom(P: number[], C: number[], I: number[], x: number, y: number, z: number, seed: number) {
  const cx = x + 0.5, cz = z + 0.5;
  const cap = seed % 3 === 0 ? srgb(0xd57a39) : srgb(0xb74636);
  const stem = srgb(0xe9ddc5);
  addBox(P, C, I, cx, y + 0.2, cz, 0.1, 0.4, 0.1, ...stem);
  addBox(P, C, I, cx, y + 0.4, cz, 0.42, 0.14, 0.4, ...cap);
  addBox(P, C, I, cx, y + 0.47, cz, 0.28, 0.08, 0.28, ...cap);
  addBox(P, C, I, cx - 0.1, y + 0.45, cz - 0.04, 0.07, 0.035, 0.07, ...stem);
  addBox(P, C, I, cx + 0.08, y + 0.45, cz + 0.07, 0.07, 0.035, 0.07, ...stem);
}

function addDeadBush(P: number[], C: number[], I: number[], x: number, y: number, z: number, seed: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const h = 0.42 + ((seed % 3) - 1) * 0.04;
  addBox(P, C, I, cx, y + h * 0.4, cz, 0.06, h * 0.8, 0.06, ...COL.bushA);
  addBox(P, C, I, cx + 0.08, y + h * 0.6, cz - 0.06, 0.12, 0.05, 0.12, ...COL.bushB);
  addBox(P, C, I, cx - 0.09, y + h * 0.5, cz + 0.07, 0.14, 0.05, 0.1, ...COL.bushB);
}

/** Low, sun-baked flowers: branched stalks and muted seed heads. */
function addDryFlower(P: number[], C: number[], I: number[], x: number, y: number, z: number, thistle: boolean) {
  const stalk = srgb(thistle ? 0x82764d : 0x987354);
  const head = srgb(thistle ? 0xa69b61 : 0xba7d61);
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.22, cz, 0.06, 0.44, 0.06, ...stalk);
  for (const [dx,dz] of [[-0.16,0.06],[0.14,-0.07],[0,0.15]]) {
    addBox(P, C, I, cx + dx * 0.5, y + 0.21, cz + dz * 0.5, 0.05, 0.18, 0.05, ...stalk);
    addBox(P, C, I, cx + dx, y + 0.34, cz + dz, 0.15, 0.12, 0.15, ...head);
  }
  addBox(P, C, I, cx, y + 0.49, cz, 0.18, 0.13, 0.18, ...head);
}

/** Woven cup with two small eggs: straw for hens, dark twigs for songbirds. */
function addBirdNest(P: number[], C: number[], I: number[], x: number, y: number, z: number, chicken: boolean) {
  const rim = srgb(chicken ? 0xd1aa60 : 0x62442e);
  const lining = srgb(chicken ? 0xa68547 : 0x382a22);
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.07, cz, 0.66, 0.12, 0.62, ...lining);
  for (const dx of [-0.29, 0.29]) addBox(P, C, I, cx + dx, y + 0.14, cz, 0.12, 0.14, 0.72, ...rim);
  for (const dz of [-0.27, 0.27]) addBox(P, C, I, cx, y + 0.14, cz + dz, 0.67, 0.14, 0.12, ...rim);
  for (const dx of [-0.13, 0.13]) {
    addBox(P, C, I, cx + dx, y + 0.22, cz, 0.13, 0.18, 0.14, ...srgb(chicken ? 0xf3e6c8 : 0xe8e7df));
    addBox(P, C, I, cx + dx, y + 0.32, cz, 0.09, 0.05, 0.1, ...srgb(chicken ? 0xf9edd9 : 0xf2f1e8));
  }
}

/** a chunky voxel flower: stem, two leaves, cross-shaped petal head */
function addFlower(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number, seed: number) {
  const cx = x + 0.5 + (((seed * 7) % 5) - 2) * 0.04;
  const cz = z + 0.5 + (((seed * 13) % 5) - 2) * 0.04;
  const petal = id === FLOWER_RED ? COL.red : id === FLOWER_YELLOW ? COL.yellow : COL.blue;
  const core = id === FLOWER_YELLOW ? COL.coreB : COL.coreY;
  const h = 0.5 + ((seed % 3) - 1) * 0.05;
  // stem
  addBox(P, C, I, cx, y + h / 2, cz, 0.07, h, 0.07, ...COL.stem);
  // leaves
  addBox(P, C, I, cx + 0.1, y + h * 0.35, cz, 0.14, 0.05, 0.08, ...COL.leafG);
  addBox(P, C, I, cx - 0.09, y + h * 0.55, cz + 0.02, 0.12, 0.05, 0.08, ...COL.leafG);
  // head: core + 4 petals
  const hy = y + h + 0.08;
  addBox(P, C, I, cx, hy, cz, 0.14, 0.14, 0.14, ...core);
  addBox(P, C, I, cx + 0.14, hy, cz, 0.14, 0.12, 0.12, ...petal);
  addBox(P, C, I, cx - 0.14, hy, cz, 0.14, 0.12, 0.12, ...petal);
  addBox(P, C, I, cx, hy, cz + 0.14, 0.12, 0.12, 0.14, ...petal);
  addBox(P, C, I, cx, hy, cz - 0.14, 0.12, 0.12, 0.14, ...petal);
  addBox(P, C, I, cx, hy + 0.12, cz, 0.1, 0.06, 0.1, ...petal);
}

const COL_SNOW = srgb(0xeef2f8);
const COL_PEgg = srgb(0xe1e8f0);
const COL_PEggShade = srgb(0xb8c8dc);

/** penguin egg: one big bluish egg on a snow patch */
function addPenguinEgg(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.04, cz, 0.6, 0.08, 0.6, ...COL_SNOW);
  addBox(P, C, I, cx, y + 0.22, cz, 0.3, 0.34, 0.3, ...COL_PEgg);
  addBox(P, C, I, cx, y + 0.42, cz, 0.22, 0.12, 0.22, ...COL_PEggShade);
}

/** an egg clutch: sandy mound + three rounded eggs sitting IN the block */
function addEggClutch(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  // sand mound
  addBox(P, C, I, cx, y + 0.05, cz, 0.72, 0.1, 0.72, ...COL.sand);
  // three eggs (body + rounded cap ≈ oval)
  const egg = (ex: number, ez: number, s: number) => {
    addBox(P, C, I, ex, y + 0.14 + s * 0.07, ez, 0.2 * s + 0.06, 0.24 * s, 0.2 * s + 0.06, ...COL.egg);
    addBox(P, C, I, ex, y + 0.14 + s * 0.19, ez, 0.15 * s, 0.1 * s, 0.15 * s, ...COL.eggShade);
  };
  egg(cx - 0.16, cz - 0.1, 1);
  egg(cx + 0.17, cz + 0.02, 0.9);
  egg(cx + 0.0, cz + 0.19, 0.8);
}

export function buildChunkGeometry(world: World, cx: number, cz: number): ChunkGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // separate buffers for alpha-tested blocks (glass / doors / fences)
  const cPositions: number[] = [];
  const cColors: number[] = [];
  const cUvs: number[] = [];
  const cIndices: number[] = [];
  // translucent water pass
  const wPositions: number[] = [];
  const wColors: number[] = [];
  const wUvs: number[] = [];
  const wIndices: number[] = [];
  // volumetric decor pass (flowers, egg clutches) — coloured, untextured
  const dPositions: number[] = [];
  const dColors: number[] = [];
  const dIndices: number[] = [];

  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const solidAt = (x: number, y: number, z: number) => isOpaque(world.get(x, y, z));

  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const z = z0 + lz;
      for (let y = 0; y < WY; y++) {
        const id = world.get(x, y, z);
        if (id === AIR) continue;
        // flowers, grasses & egg clutches render as little 3D models, not textured cubes
        if (id === FLOWER_RED || id === FLOWER_YELLOW || id === FLOWER_BLUE) {
          addFlower(dPositions, dColors, dIndices, x, y, z, id, x * 31 + z * 17 + y);
          continue;
        }
        if (id === DRY_BLOOM || id === DESERT_THISTLE) {
          addDryFlower(dPositions, dColors, dIndices, x, y, z, id === DESERT_THISTLE);
          continue;
        }
        if (id === BIRD_NEST || id === CHICKEN_NEST) {
          addBirdNest(dPositions, dColors, dIndices, x, y, z, id === CHICKEN_NEST);
          continue;
        }
        if (id === VINE) {
          // Climbable hanging tendrils; do not fill the entire voxel.
          addBox(dPositions, dColors, dIndices, x + 0.45, y + 0.5, z + 0.45, 0.06, 0.96, 0.06, ...srgb(0x38743a));
          addBox(dPositions, dColors, dIndices, x + 0.58, y + 0.4, z + 0.53, 0.05, 0.78, 0.05, ...srgb(0x68a850));
          continue;
        }
        if (id === TALL_GRASS) {
          addTallGrass(dPositions, dColors, dIndices, x, y, z, x * 31 + z * 17 + y);
          continue;
        }
        if (id === FERN) {
          addFern(dPositions, dColors, dIndices, x, y, z, x * 31 + z * 17 + y);
          continue;
        }
        if (id === MUSHROOM) {
          addMushroom(dPositions, dColors, dIndices, x, y, z, x * 31 + z * 17 + y);
          continue;
        }
        if (id === DEAD_BUSH) {
          addDeadBush(dPositions, dColors, dIndices, x, y, z, x * 31 + z * 17 + y);
          continue;
        }
        if (id === TURTLE_EGG) {
          addEggClutch(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        if (id === PENGUIN_EGG) {
          addPenguinEgg(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        // A few hanging fruit clusters make the two palm varieties readable
        // from below. The edible drops still come from harvesting the leaves.
        if ((id === COCONUT_LEAVES || id === BANANA_LEAVES) && world.get(x, y - 1, z) === AIR &&
          ((x * 179 + z * 73 + y * 113) >>> 0) % 6 === 0) {
          if (id === COCONUT_LEAVES) {
            addBox(dPositions, dColors, dIndices, x + 0.47, y - 0.12, z + 0.48, 0.23, 0.22, 0.23, ...srgb(0x795332));
            addBox(dPositions, dColors, dIndices, x + 0.64, y - 0.08, z + 0.46, 0.19, 0.20, 0.19, ...srgb(0x9a7042));
          } else {
            addBox(dPositions, dColors, dIndices, x + 0.46, y - 0.14, z + 0.51, 0.10, 0.27, 0.11, ...srgb(0xe7c745));
            addBox(dPositions, dColors, dIndices, x + 0.60, y - 0.12, z + 0.50, 0.09, 0.25, 0.11, ...srgb(0xf6dc5b));
          }
        }
        const def = BLOCKS[id];
        const glow = def.emissive === 1;
        const cut = isCutout(id);
        const wat = id === WATER;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          const neighbor = world.get(nx, ny, nz);
          if (wat) {
            // water renders only against air/cutouts, never between water cells
            if (neighbor === WATER || isOpaque(neighbor)) continue;
          } else if (cut) {
            // hide only internal faces between two identical cutout blocks
            if (neighbor === id || isOpaque(neighbor)) continue;
          } else if (isOpaque(neighbor)) continue;

          const tile = f === 3 ? def.top : f === 2 ? def.bottom : def.side;
          const [u0, v0, u1, v1] = tileUV(tile);
          const P = wat ? wPositions : cut ? cPositions : positions;
          const C = wat ? wColors : cut ? cColors : colors;
          const U = wat ? wUvs : cut ? cUvs : uvs;
          const I = wat ? wIndices : cut ? cIndices : indices;
          const base = P.length / 3;

          // tangent axes for AO sampling
          const axes: number[] = [];
          for (let a = 0; a < 3; a++) if (face.dir[a] === 0) axes.push(a);

          const aoVals: number[] = [];
          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            const p = corner.pos;
            let ao = 3;
            if (!glow) {
              const d1 = p[axes[0]] * 2 - 1;
              const d2 = p[axes[1]] * 2 - 1;
              const o1 = [0, 0, 0];
              o1[axes[0]] = d1;
              const o2 = [0, 0, 0];
              o2[axes[1]] = d2;
              const s1 = solidAt(nx + o1[0], ny + o1[1], nz + o1[2]) ? 1 : 0;
              const s2 = solidAt(nx + o2[0], ny + o2[1], nz + o2[2]) ? 1 : 0;
              const cc = solidAt(nx + o1[0] + o2[0], ny + o1[1] + o2[1], nz + o1[2] + o2[2]) ? 1 : 0;
              ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
            }
            aoVals.push(ao);

            P.push(x + p[0], y + p[1], z + p[2]);
            U.push(u0 + (u1 - u0) * corner.uv[0], v0 + (v1 - v0) * corner.uv[1]);
            // authored in sRGB, stored in three's linear working space
            const light = glow || cut || wat ? Math.pow(face.shade, 1.4) : Math.pow(AO_LEVELS[ao] * face.shade, 2.2);
            C.push(light, light, light);
          }

          if (aoVals[0] + aoVals[3] > aoVals[1] + aoVals[2]) {
            I.push(base, base + 1, base + 3, base, base + 3, base + 2);
          } else {
            I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }
  }

  const make = (p: number[], c: number[], u: number[], idx: number[]) => {
    if (!p.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  };

  let decor: THREE.BufferGeometry | null = null;
  if (dPositions.length) {
    decor = new THREE.BufferGeometry();
    decor.setAttribute('position', new THREE.Float32BufferAttribute(dPositions, 3));
    decor.setAttribute('color', new THREE.Float32BufferAttribute(dColors, 3));
    decor.setIndex(dIndices);
    decor.computeBoundingSphere();
  }

  return {
    solid: make(positions, colors, uvs, indices),
    cutout: make(cPositions, cColors, cUvs, cIndices),
    water: make(wPositions, wColors, wUvs, wIndices),
    decor,
  };
}
