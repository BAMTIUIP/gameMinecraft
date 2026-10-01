import * as THREE from 'three';
import {
  AIR,
  BED,
  BLOCKS,
  CACTUS,
  CACTUS_PALE,
  DEAD_BUSH,
  DOOR_IRON,
  DOOR_WOOD,
  FENCE_IRON,
  FENCE_STONE,
  FENCE_WOOD,
  FERN,
  MUSHROOM,
  FLOWER_BLUE,
  FLOWER_PINK,
  FLOWER_PURPLE,
  FLOWER_WHITE,
  DRY_BLOOM,
  DESERT_THISTLE,
  BIRD_NEST,
  CHICKEN_NEST,
  COCONUT_LEAVES,
  BANANA_LEAVES,
  T,
  TORCH,
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

const EMISSIVE_SHADE = [0.96, 0.96, 0.9, 1.0, 0.98, 0.98];

/** append an unshaded / self-illuminated box for glowing lantern cores */
function addEmissiveBox(
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
    const sh = EMISSIVE_SHADE[f];
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
  pink: srgb(0xf28bb5),
  purple: srgb(0xa875df),
  white: srgb(0xfff8e8),
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
  const cx = x + 0.5 + (((seed * 5) % 3) - 1) * 0.03;
  const cz = z + 0.5 + (((seed * 9) % 3) - 1) * 0.03;
  const h = 0.44 + ((seed % 3) - 1) * 0.04;
  addBox(P, C, I, cx, y + h * 0.38, cz, 0.06, h * 0.76, 0.06, ...COL.bushA);
  addBox(P, C, I, cx + 0.09, y + h * 0.58, cz - 0.06, 0.14, 0.05, 0.12, ...COL.bushB);
  addBox(P, C, I, cx - 0.1, y + h * 0.5, cz + 0.07, 0.14, 0.05, 0.1, ...COL.bushB);
  addBox(P, C, I, cx + 0.14, y + h * 0.78, cz - 0.1, 0.05, 0.18, 0.05, ...COL.bushA);
  addBox(P, C, I, cx - 0.14, y + h * 0.72, cz + 0.11, 0.05, 0.16, 0.05, ...COL.bushA);
  addBox(P, C, I, cx - 0.05, y + h * 0.74, cz - 0.12, 0.05, 0.15, 0.05, ...COL.bushB);
}

/** Low, sun-baked flowers, mini barrel cacti, and prickly-pear paddle succulents. */
function addDryFlower(P: number[], C: number[], I: number[], x: number, y: number, z: number, thistle: boolean) {
  const seed = ((x * 73856093) ^ (z * 19349663) ^ (y * 83492791)) >>> 0;
  const cx = x + 0.5;
  const cz = z + 0.5;

  if (!thistle && seed % 3 === 0) {
    // Variant A: Mini Flowering Barrel Cactus (matching 1387467106_4dsruut.png)
    const body = srgb(0x2f8538);
    const rib = srgb(0x49a44b);
    const spine = srgb(0xe7dfb8);
    const petal = seed % 2 === 0 ? srgb(0xe85298) : srgb(0xf4c842);
    const center = srgb(0xfff078);
    // Stout ribbed barrel body
    addBox(P, C, I, cx, y + 0.24, cz, 0.46, 0.48, 0.46, ...body);
    addBox(P, C, I, cx, y + 0.24, cz, 0.50, 0.42, 0.34, ...rib);
    addBox(P, C, I, cx, y + 0.24, cz, 0.34, 0.42, 0.50, ...rib);
    // Tiny spines
    for (const sy of [0.14, 0.34]) {
      addBox(P, C, I, cx, y + sy, cz, 0.56, 0.03, 0.03, ...spine);
      addBox(P, C, I, cx, y + sy, cz, 0.03, 0.03, 0.56, ...spine);
    }
    // Blossom on top
    addBox(P, C, I, cx, y + 0.51, cz, 0.24, 0.08, 0.14, ...petal);
    addBox(P, C, I, cx, y + 0.51, cz, 0.14, 0.08, 0.24, ...petal);
    addBox(P, C, I, cx, y + 0.55, cz, 0.10, 0.06, 0.10, ...center);
    return;
  }

  if (!thistle && seed % 3 === 1) {
    // Variant B: Prickly-Pear / Opuntia Paddle Cactus with Crimson Blossoms (080e0564240f071e0e6b7a82e928101b.jpg)
    const padDark = srgb(0x368837);
    const padLight = srgb(0x52a849);
    const bloom = srgb(0xe23d46);
    const bloomTip = srgb(0xffb347);
    // Base paddle
    addBox(P, C, I, cx, y + 0.20, cz, 0.34, 0.38, 0.14, ...padDark);
    // Left & right angled upper paddles
    addBox(P, C, I, cx - 0.18, y + 0.46, cz + 0.04, 0.28, 0.30, 0.12, ...padLight);
    addBox(P, C, I, cx + 0.17, y + 0.42, cz - 0.04, 0.26, 0.28, 0.12, ...padLight);
    // Red/orange cactus flowers on top of the paddles
    addBox(P, C, I, cx - 0.20, y + 0.66, cz + 0.04, 0.13, 0.12, 0.13, ...bloom);
    addBox(P, C, I, cx - 0.20, y + 0.73, cz + 0.04, 0.07, 0.05, 0.07, ...bloomTip);
    addBox(P, C, I, cx + 0.18, y + 0.61, cz - 0.04, 0.12, 0.11, 0.12, ...bloom);
    addBox(P, C, I, cx + 0.18, y + 0.67, cz - 0.04, 0.06, 0.05, 0.06, ...bloomTip);
    return;
  }

  const stalk = srgb(thistle ? 0x6c8c42 : 0x987354);
  const head = srgb(thistle ? 0xd9689a : 0xba7d61);
  addBox(P, C, I, cx, y + 0.22, cz, 0.08, 0.44, 0.08, ...stalk);
  for (const [dx, dz] of [[-0.16, 0.06], [0.14, -0.07], [0, 0.15]]) {
    addBox(P, C, I, cx + dx * 0.5, y + 0.21, cz + dz * 0.5, 0.06, 0.20, 0.06, ...stalk);
    addBox(P, C, I, cx + dx, y + 0.34, cz + dz, 0.15, 0.12, 0.15, ...head);
  }
  addBox(P, C, I, cx, y + 0.49, cz, 0.18, 0.13, 0.18, ...head);
}

/** 3D Cactus spines on exposed sides and colorful desert cactus blossoms on top */
function addCactusDecor(
  P: number[],
  C: number[],
  I: number[],
  x: number,
  y: number,
  z: number,
  id: number,
  world: World,
) {
  const seed = ((x * 73856093) ^ (z * 19349663) ^ (y * 83492791)) >>> 0;
  const spineCol = id === CACTUS_PALE ? srgb(0xede3bd) : srgb(0x2a381b);
  const cx = x + 0.5;
  const cz = z + 0.5;

  // Protruding 3D spines on exposed horizontal faces
  if (world.get(x - 1, y, z) === AIR) {
    for (const [sy, sz] of [[0.22, -0.22], [0.52, 0.20], [0.80, -0.16]]) {
      addBox(P, C, I, x - 0.04, y + sy, cz + sz, 0.09, 0.03, 0.03, ...spineCol);
    }
  }
  if (world.get(x + 1, y, z) === AIR) {
    for (const [sy, sz] of [[0.26, 0.22], [0.54, -0.20], [0.82, 0.16]]) {
      addBox(P, C, I, x + 1.04, y + sy, cz + sz, 0.09, 0.03, 0.03, ...spineCol);
    }
  }
  if (world.get(x, y, z - 1) === AIR) {
    for (const [sy, sx] of [[0.24, 0.20], [0.50, -0.22], [0.78, 0.18]]) {
      addBox(P, C, I, cx + sx, y + sy, z - 0.04, 0.03, 0.03, 0.09, ...spineCol);
    }
  }
  if (world.get(x, y, z + 1) === AIR) {
    for (const [sy, sx] of [[0.20, -0.20], [0.56, 0.22], [0.84, -0.18]]) {
      addBox(P, C, I, cx + sx, y + sy, z + 1.04, 0.03, 0.03, 0.09, ...spineCol);
    }
  }

  // Top cactus crown blossom on ~50% of exposed cactus tips
  if (world.get(x, y + 1, z) === AIR && seed % 2 === 0) {
    const flowerKind = seed % 3;
    const petal =
      flowerKind === 0
        ? srgb(0xe84a90) // vibrant pink/magenta cactus flower
        : flowerKind === 1
          ? srgb(0xe63e38) // crimson red saguaro/opuntia blossom
          : srgb(0xf4c636); // golden desert cactus flower
    const core = srgb(0xfff176);
    addBox(P, C, I, cx, y + 1.05, cz, 0.34, 0.10, 0.18, ...petal);
    addBox(P, C, I, cx, y + 1.05, cz, 0.18, 0.10, 0.34, ...petal);
    addBox(P, C, I, cx, y + 1.11, cz, 0.22, 0.08, 0.22, ...petal);
    addBox(P, C, I, cx, y + 1.16, cz, 0.10, 0.06, 0.10, ...core);
  }
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

/** Chunky voxel flowers with distinct tulip, lavender, daisy and classic rosette silhouettes. */
function addFlower(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number, seed: number) {
  const cx = x + 0.5 + (((seed * 7) % 5) - 2) * 0.04;
  const cz = z + 0.5 + (((seed * 13) % 5) - 2) * 0.04;
  const petal = id === FLOWER_RED ? COL.red
    : id === FLOWER_YELLOW ? COL.yellow
      : id === FLOWER_BLUE ? COL.blue
        : id === FLOWER_PINK ? COL.pink
          : id === FLOWER_PURPLE ? COL.purple
            : COL.white;
  const core = id === FLOWER_YELLOW ? COL.coreB : COL.coreY;
  const h = id === FLOWER_PURPLE ? 0.66 : 0.5 + ((seed % 3) - 1) * 0.05;
  addBox(P, C, I, cx, y + h / 2, cz, 0.07, h, 0.07, ...COL.stem);
  addBox(P, C, I, cx + 0.1, y + h * 0.35, cz, 0.14, 0.05, 0.08, ...COL.leafG);
  addBox(P, C, I, cx - 0.09, y + h * 0.55, cz + 0.02, 0.12, 0.05, 0.08, ...COL.leafG);

  if (id === FLOWER_PURPLE) {
    // Tall lavender spike: several compact florets rise along a single stem.
    for (let row = 0; row < 4; row++) {
      const fy = y + 0.24 + row * 0.105;
      const offset = row % 2 === 0 ? -0.045 : 0.045;
      addBox(P, C, I, cx + offset, fy, cz, 0.12, 0.09, 0.12, ...petal);
      addBox(P, C, I, cx - offset, fy + 0.025, cz + 0.035, 0.09, 0.07, 0.09, ...COL.pink);
    }
    return;
  }

  const hy = y + h + 0.08;
  if (id === FLOWER_PINK) {
    // Tulip cup: three upright petals around a shaded base.
    addBox(P, C, I, cx, hy - 0.035, cz, 0.17, 0.14, 0.17, ...COL.purple);
    addBox(P, C, I, cx, hy + 0.035, cz, 0.14, 0.14, 0.14, ...petal);
    addBox(P, C, I, cx - 0.095, hy + 0.045, cz, 0.09, 0.17, 0.12, ...petal);
    addBox(P, C, I, cx + 0.095, hy + 0.045, cz, 0.09, 0.17, 0.12, ...petal);
    addBox(P, C, I, cx, hy + 0.055, cz - 0.09, 0.12, 0.16, 0.09, ...COL.pink);
    addBox(P, C, I, cx, hy + 0.09, cz, 0.07, 0.06, 0.07, ...COL.coreY);
    return;
  }

  // Classic flower/daisy head: a yellow core with a cross of petals, plus diagonals for daisies.
  addBox(P, C, I, cx, hy, cz, 0.14, 0.14, 0.14, ...core);
  addBox(P, C, I, cx + 0.14, hy, cz, 0.14, 0.12, 0.12, ...petal);
  addBox(P, C, I, cx - 0.14, hy, cz, 0.14, 0.12, 0.12, ...petal);
  addBox(P, C, I, cx, hy, cz + 0.14, 0.12, 0.12, 0.14, ...petal);
  addBox(P, C, I, cx, hy, cz - 0.14, 0.12, 0.12, 0.14, ...petal);
  if (id === FLOWER_WHITE) {
    for (const [dx, dz] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]])
      addBox(P, C, I, cx + dx, hy, cz + dz, 0.11, 0.1, 0.11, ...petal);
  }
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

const LANTERN_IRON_DARK = srgb(0x252322);
const LANTERN_IRON_MID = srgb(0x353230);
const LANTERN_IRON_TOP = srgb(0x4a4745);
const LANTERN_ORANGE = srgb(0xf27d16);
const LANTERN_GOLD = srgb(0xffd62e);
const LANTERN_YELLOW = srgb(0xffee58);
const LANTERN_WHITE = srgb(0xffffe2);

/**
 * 3D Voxel Lantern matching logo.png:
 * - Dark iron base with 4 corner feet,
 * - 4 vertical dark iron corner bars framing a glowing warm orange/gold/yellow/white core,
 * - Wide overhanging dark iron roof eaves,
 * - Stepped upper chimney cap with 4 glowing yellow side vent slits,
 * - Top U-shaped iron hanging handle (plus upper chain link when suspended under a block).
 */
function addLantern(P: number[], C: number[], I: number[], x: number, y: number, z: number, world: World) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const above = world.get(x, y + 1, z);
  const below = world.get(x, y - 1, z);
  const hasFloor = below !== AIR && below !== WATER;
  const hasCeiling = above !== AIR && above !== WATER;
  const hanging = !hasFloor && hasCeiling;

  // Detect adjacent wall if neither floor nor ceiling is present
  let wallDx = 0;
  let wallDz = 0;
  if (!hasFloor && !hasCeiling) {
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nid = world.get(x + dx, y, z + dz);
      if (isOpaque(nid) || nid === FENCE_WOOD || nid === FENCE_STONE) {
        wallDx = dx;
        wallDz = dz;
        break;
      }
    }
  }
  const wallMounted = wallDx !== 0 || wallDz !== 0;
  const by = hanging || wallMounted ? y + 0.08 : y;

  // 1. 4 Corner Feet at bottom
  for (const dx of [-0.15, 0.15]) {
    for (const dz of [-0.15, 0.15]) {
      addBox(P, C, I, cx + dx, by + 0.02, cz + dz, 0.12, 0.04, 0.12, ...LANTERN_IRON_DARK);
    }
  }

  // 2. Bottom Dark Iron Frame Rim
  addBox(P, C, I, cx, by + 0.075, cz, 0.43, 0.07, 0.43, ...LANTERN_IRON_MID);

  // 3. Glowing Multi-Tone Glass & Flame Core (matching logo.png pixel gradient)
  const gy = by + 0.29;
  addEmissiveBox(P, C, I, cx, gy, cz, 0.33, 0.36, 0.33, ...LANTERN_ORANGE);
  addEmissiveBox(P, C, I, cx, gy, cz, 0.338, 0.25, 0.338, ...LANTERN_GOLD);
  addEmissiveBox(P, C, I, cx, gy, cz, 0.344, 0.17, 0.21, ...LANTERN_YELLOW);
  addEmissiveBox(P, C, I, cx, gy, cz, 0.21, 0.17, 0.344, ...LANTERN_YELLOW);
  // Diagonal 2x2 hot cream-white center squares on all 4 panes (exact match to logo.png!)
  addEmissiveBox(P, C, I, cx, gy + 0.036, cz - 0.036, 0.352, 0.072, 0.072, ...LANTERN_WHITE);
  addEmissiveBox(P, C, I, cx, gy - 0.036, cz + 0.036, 0.352, 0.072, 0.072, ...LANTERN_WHITE);
  addEmissiveBox(P, C, I, cx - 0.036, gy + 0.036, cz, 0.072, 0.072, 0.352, ...LANTERN_WHITE);
  addEmissiveBox(P, C, I, cx + 0.036, gy - 0.036, cz, 0.072, 0.072, 0.352, ...LANTERN_WHITE);

  // 4. 4 Vertical Dark Iron Corner Bars
  for (const dx of [-0.162, 0.162]) {
    for (const dz of [-0.162, 0.162]) {
      addBox(P, C, I, cx + dx, gy, cz + dz, 0.082, 0.36, 0.082, ...LANTERN_IRON_DARK);
    }
  }

  // 5. Overhanging Main Iron Roof Eaves
  addBox(P, C, I, cx, by + 0.51, cz, 0.45, 0.08, 0.45, ...LANTERN_IRON_MID);

  // 6. Upper Stepped Chimney Cap with Glowing Yellow Side Vent Slits
  addEmissiveBox(P, C, I, cx, by + 0.575, cz, 0.24, 0.05, 0.24, ...LANTERN_YELLOW);
  for (const dx of [-0.098, 0.098]) {
    for (const dz of [-0.098, 0.098]) {
      addBox(P, C, I, cx + dx, by + 0.575, cz + dz, 0.076, 0.05, 0.076, ...LANTERN_IRON_TOP);
    }
  }
  addBox(P, C, I, cx, by + 0.635, cz, 0.275, 0.07, 0.275, ...LANTERN_IRON_TOP);

  // 7. Top U-Shaped Iron Handle (∏)
  addBox(P, C, I, cx - 0.072, by + 0.715, cz, 0.05, 0.09, 0.05, ...LANTERN_IRON_DARK);
  addBox(P, C, I, cx + 0.072, by + 0.715, cz, 0.05, 0.09, 0.05, ...LANTERN_IRON_DARK);
  addBox(P, C, I, cx, by + 0.77, cz, 0.195, 0.048, 0.05, ...LANTERN_IRON_DARK);

  // 8. Physical Mounting Hardware:
  if (hanging) {
    // Interlocking 3D iron chain links + ceiling flange plate connecting up to y + 1.0
    addBox(P, C, I, cx, y + 0.91, cz, 0.11, 0.14, 0.055, ...LANTERN_IRON_DARK);
    addBox(P, C, I, cx, y + 0.94, cz, 0.055, 0.12, 0.11, ...LANTERN_IRON_TOP);
    addBox(P, C, I, cx, y + 0.98, cz, 0.18, 0.04, 0.18, ...LANTERN_IRON_MID);
  } else if (wallMounted) {
    // 3D Wall-Mount Timber & Wrought-Iron Bracket bolted to the adjacent wall (wallDx, wallDz)
    const alongX = wallDx !== 0;
    const plateX = cx + wallDx * 0.45;
    const plateZ = cz + wallDz * 0.45;
    // Vertical wall backplate bolted against the wall
    addBox(
      P,
      C,
      I,
      plateX,
      y + 0.74,
      plateZ,
      alongX ? 0.10 : 0.22,
      0.38,
      alongX ? 0.22 : 0.10,
      ...FENCE_WOOD_DARK,
    );
    // Horizontal cantilevered bracket beam extending from wall out over the lantern center
    const armCx = cx + wallDx * 0.22;
    const armCz = cz + wallDz * 0.22;
    addBox(
      P,
      C,
      I,
      armCx,
      y + 0.91,
      armCz,
      alongX ? 0.62 : 0.14,
      0.11,
      alongX ? 0.14 : 0.62,
      ...FENCE_WOOD_MAIN,
    );
    // Diagonal iron/wood brace strut under the bracket arm
    addBox(
      P,
      C,
      I,
      cx + wallDx * 0.32,
      y + 0.76,
      cz + wallDz * 0.32,
      alongX ? 0.24 : 0.08,
      0.18,
      alongX ? 0.08 : 0.24,
      ...LANTERN_IRON_MID,
    );
    // Iron chain link connecting the bracket arm down to the lantern handle
    addBox(P, C, I, cx, y + 0.86, cz, 0.08, 0.08, 0.08, ...LANTERN_IRON_DARK);
  } else if (!hasFloor) {
    // Safety net: if a lantern ever lacks floor, ceiling, and wall, anchor it with a post to the ground below
    addBox(P, C, I, cx, y - 0.5, cz, 0.24, 1.0, 0.24, ...FENCE_WOOD_MAIN);
    addBox(P, C, I, cx, y - 0.04, cz, 0.32, 0.08, 0.32, ...FENCE_WOOD_DARK);
  }
}

const FENCE_WOOD_MAIN = srgb(0xa37e49);
const FENCE_WOOD_DARK = srgb(0x866436);
const FENCE_STONE_MAIN = srgb(0x969490);
const FENCE_STONE_DARK = srgb(0x787672);
const FENCE_IRON_MAIN = srgb(0x3b3e44);
const FENCE_IRON_LIGHT = srgb(0x555962);

/**
 * 3D Volumetric Fences, Stone Walls & Hanging Iron Chains (matching maxresdefault.jpg):
 * - FENCE_WOOD: Slender 3D wooden post + connecting horizontal rails & lamp-arm brackets.
 * - FENCE_STONE: Chunky stone wall pillar + connecting stone wall segments.
 * - FENCE_IRON: Interlocking 3D dark-iron chain when vertical, or 3D iron bars when connected horizontally.
 */
function addFence(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number, world: World) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const canConnect = (nid: number) =>
    nid === id ||
    nid === FENCE_WOOD ||
    nid === FENCE_STONE ||
    nid === DOOR_WOOD ||
    nid === DOOR_IRON ||
    isOpaque(nid);

  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  if (id === FENCE_IRON) {
    const hasHoriz = dirs.some(([dx, dz]) => {
      const nid = world.get(x + dx, y, z + dz);
      return nid === FENCE_IRON || isOpaque(nid);
    });
    if (!hasHoriz) {
      // Render as an interlocking 3D hanging iron chain (exact match to maxresdefault.jpg!)
      addBox(P, C, I, cx, y + 0.14, cz, 0.11, 0.28, 0.048, ...FENCE_IRON_MAIN);
      addBox(P, C, I, cx, y + 0.39, cz, 0.048, 0.28, 0.11, ...FENCE_IRON_LIGHT);
      addBox(P, C, I, cx, y + 0.64, cz, 0.11, 0.28, 0.048, ...FENCE_IRON_MAIN);
      addBox(P, C, I, cx, y + 0.88, cz, 0.048, 0.26, 0.11, ...FENCE_IRON_LIGHT);
      return;
    }
    // Connected iron bars / fence
    addBox(P, C, I, cx, y + 0.5, cz, 0.16, 1.0, 0.16, ...FENCE_IRON_MAIN);
    for (const [dx, dz] of dirs) {
      const nid = world.get(x + dx, y, z + dz);
      if (nid === FENCE_IRON || isOpaque(nid)) {
        const rx = cx + dx * 0.25;
        const rz = cz + dz * 0.25;
        const rw = dx !== 0 ? 0.5 : 0.08;
        const rd = dz !== 0 ? 0.5 : 0.08;
        addBox(P, C, I, rx, y + 0.28, rz, rw, 0.08, rd, ...FENCE_IRON_LIGHT);
        addBox(P, C, I, rx, y + 0.76, rz, rw, 0.08, rd, ...FENCE_IRON_LIGHT);
        addBox(P, C, I, cx + dx * 0.3, y + 0.5, cz + dz * 0.3, 0.06, 0.9, 0.06, ...FENCE_IRON_MAIN);
      }
    }
    return;
  }

  if (id === FENCE_STONE) {
    // Stone Wall Pillar (0.46x1.0x0.46) + cap
    addBox(P, C, I, cx, y + 0.5, cz, 0.46, 1.0, 0.46, ...FENCE_STONE_MAIN);
    addBox(P, C, I, cx, y + 0.94, cz, 0.5, 0.12, 0.5, ...FENCE_STONE_DARK);
    for (const [dx, dz] of dirs) {
      if (canConnect(world.get(x + dx, y, z + dz))) {
        const rx = cx + dx * 0.26;
        const rz = cz + dz * 0.26;
        const rw = dx !== 0 ? 0.48 : 0.32;
        const rd = dz !== 0 ? 0.48 : 0.32;
        addBox(P, C, I, rx, y + 0.44, rz, rw, 0.86, rd, ...FENCE_STONE_DARK);
      }
    }
    return;
  }

  // FENCE_WOOD: Slender 3D Wooden Post (0.25x1.0x0.25) + horizontal rails / lamp-post brackets
  addBox(P, C, I, cx, y + 0.5, cz, 0.25, 1.0, 0.25, ...FENCE_WOOD_MAIN);
  addBox(P, C, I, cx, y + 0.95, cz, 0.27, 0.1, 0.27, ...FENCE_WOOD_DARK);
  const belowId = world.get(x, y - 1, z);
  const holdsLantern = belowId === TORCH || belowId === FENCE_IRON;

  for (const [dx, dz] of dirs) {
    if (canConnect(world.get(x + dx, y, z + dz))) {
      const rx = cx + dx * 0.25;
      const rz = cz + dz * 0.25;
      const rw = dx !== 0 ? 0.5 : 0.13;
      const rd = dz !== 0 ? 0.5 : 0.13;
      addBox(P, C, I, rx, y + 0.34, rz, rw, 0.13, rd, ...FENCE_WOOD_DARK);
      addBox(P, C, I, rx, y + 0.78, rz, rw, 0.13, rd, ...FENCE_WOOD_MAIN);
      if (holdsLantern) {
        addBox(P, C, I, rx, y + 0.88, rz, dx !== 0 ? 0.5 : 0.2, 0.16, dz !== 0 ? 0.5 : 0.2, ...FENCE_WOOD_DARK);
      }
    }
  }
}

const BED_WOOD_DARK = srgb(0x6e5028);
const BED_WOOD_FRAME = srgb(0xa37e49);
const BED_BLANKET_RED = srgb(0xc83630);
const BED_BLANKET_HIGHLIGHT = srgb(0xde4640);
const BED_SHEET_WHITE = srgb(0xe8eaf2);
const BED_PILLOW_WHITE = srgb(0xf8f9fc);

/**
 * Render one half (head or foot) of a 2-block-long Minecraft bed at cell (bx, y, bz).
 * `dirX, dirZ` points from Foot -> Head along the 2-block bed axis.
 */
function addBedHalf(
  P: number[],
  C: number[],
  I: number[],
  bx: number,
  y: number,
  bz: number,
  dirX: number,
  dirZ: number,
  isHead: boolean,
) {
  const cx = bx + 0.5;
  const cz = bz + 0.5;
  const alongX = dirX !== 0;
  // sign toward the outer end of this half (+1 for Head in +dir, -1 for Foot in -dir)
  const outSign = isHead ? 1 : -1;
  const endDx = dirX * outSign;
  const endDz = dirZ * outSign;

  // 1. Two outer corner wooden legs (y .. y + 0.18)
  for (const side of [-0.4, 0.4]) {
    const lx = cx + endDx * 0.4 + (alongX ? 0 : side);
    const lz = cz + endDz * 0.4 + (alongX ? side : 0);
    addBox(P, C, I, lx, y + 0.09, lz, 0.16, 0.18, 0.16, ...BED_WOOD_DARK);
  }

  // 2. Oak wood bed frame baseboard (y + 0.18 .. y + 0.30), flush across the center seam
  const frameCx = cx - endDx * 0.01;
  const frameCz = cz - endDz * 0.01;
  const fw = alongX ? 0.98 : 0.96;
  const fd = alongX ? 0.96 : 0.98;
  addBox(P, C, I, frameCx, y + 0.24, frameCz, fw, 0.12, fd, ...BED_WOOD_FRAME);

  if (!isHead) {
    // 3a. FOOT HALF: Full crimson-red blanket (y + 0.30 .. y + 0.56) flush to the center seam
    const matCx = cx - endDx * 0.015;
    const matCz = cz - endDz * 0.015;
    const mw = alongX ? 0.97 : 0.94;
    const md = alongX ? 0.94 : 0.97;
    addBox(P, C, I, matCx, y + 0.43, matCz, mw, 0.26, md, ...BED_BLANKET_RED);
    addBox(
      P,
      C,
      I,
      matCx - endDx * 0.04,
      y + 0.565,
      matCz - endDz * 0.04,
      alongX ? 0.86 : 0.84,
      0.02,
      alongX ? 0.84 : 0.86,
      ...BED_BLANKET_HIGHLIGHT,
    );
  } else {
    // 3b. HEAD HALF: Red blanket continuation near seam + white sheet fold + 3D White Pillow
    // Red blanket strip covering the inner 38% of the head half (meeting the foot half seamlessly)
    const redCx = cx - endDx * 0.31;
    const redCz = cz - endDz * 0.31;
    addBox(
      P,
      C,
      I,
      redCx,
      y + 0.43,
      redCz,
      alongX ? 0.38 : 0.94,
      0.26,
      alongX ? 0.94 : 0.38,
      ...BED_BLANKET_RED,
    );
    // White folded sheet band + head mattress (outer 60% of the head half)
    const sheetCx = cx + endDx * 0.18;
    const sheetCz = cz + endDz * 0.18;
    addBox(
      P,
      C,
      I,
      sheetCx,
      y + 0.425,
      sheetCz,
      alongX ? 0.6 : 0.94,
      0.25,
      alongX ? 0.94 : 0.6,
      ...BED_SHEET_WHITE,
    );
    // Plump 3D White Pillow resting on top of the head mattress (y + 0.55 .. y + 0.64)
    const pilCx = cx + endDx * 0.23;
    const pilCz = cz + endDz * 0.23;
    addBox(
      P,
      C,
      I,
      pilCx,
      y + 0.58,
      pilCz,
      alongX ? 0.42 : 0.78,
      0.09,
      alongX ? 0.78 : 0.42,
      ...BED_PILLOW_WHITE,
    );
  }
}

/**
 * 2-block-long 3D Minecraft Bed (`BED`).
 * Supports both paired 2-block beds (`BED` next to `BED`) and single `BED` blocks
 * (automatically extending into an adjacent open cell so every bed is 2 blocks long).
 */
function addBed(P: number[], C: number[], I: number[], x: number, y: number, z: number, world: World) {
  if (world.get(x + 1, y, z) === BED) {
    addBedHalf(P, C, I, x, y, z, 1, 0, false);
    return;
  }
  if (world.get(x - 1, y, z) === BED) {
    addBedHalf(P, C, I, x, y, z, 1, 0, true);
    return;
  }
  if (world.get(x, y, z + 1) === BED) {
    addBedHalf(P, C, I, x, y, z, 0, 1, false);
    return;
  }
  if (world.get(x, y, z - 1) === BED) {
    addBedHalf(P, C, I, x, y, z, 0, 1, true);
    return;
  }
  // Fallback for an unpaired single BED voxel: render full 2-block bed extending into an adjacent open cell
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  let extDx = -1;
  let extDz = 0;
  for (const [dx, dz] of dirs) {
    if (world.get(x + dx, y, z + dz) === AIR) {
      extDx = dx;
      extDz = dz;
      break;
    }
  }
  addBedHalf(P, C, I, x, y, z, -extDx, -extDz, true);
  addBedHalf(P, C, I, x + extDx, y, z + extDz, -extDx, -extDz, false);
}

export function buildChunkGeometry(world: World, cx: number, cz: number): ChunkGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // separate buffers for alpha-tested blocks (glass / doors / fences)
  const cPositions: number[] = [];
  const cNormals: number[] = [];
  const cColors: number[] = [];
  const cUvs: number[] = [];
  const cIndices: number[] = [];
  // translucent water pass
  const wPositions: number[] = [];
  const wNormals: number[] = [];
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
        if (
          id === FLOWER_RED || id === FLOWER_YELLOW || id === FLOWER_BLUE ||
          id === FLOWER_PINK || id === FLOWER_PURPLE || id === FLOWER_WHITE
        ) {
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
        if (id === TORCH) {
          addLantern(dPositions, dColors, dIndices, x, y, z, world);
          continue;
        }
        if (id === FENCE_WOOD || id === FENCE_STONE || id === FENCE_IRON) {
          addFence(dPositions, dColors, dIndices, x, y, z, id, world);
          continue;
        }
        if (id === BED) {
          addBed(dPositions, dColors, dIndices, x, y, z, world);
          continue;
        }
        if (id === CACTUS || id === CACTUS_PALE) {
          addCactusDecor(dPositions, dColors, dIndices, x, y, z, id, world);
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
        const isDoor = id === DOOR_WOOD || id === DOOR_IRON;
        const isDoorBottom = isDoor && world.get(x, y + 1, z) === id;
        // Determine doorway orientation so doors render as a 0.20-thick slab with 1 unified door face on front/back
        const doorAlongX =
          isDoor &&
          (isOpaque(world.get(x - 1, y, z)) ||
            isOpaque(world.get(x + 1, y, z)) ||
            (!isOpaque(world.get(x, y, z - 1)) && !isOpaque(world.get(x, y, z + 1))));

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          const neighbor = world.get(nx, ny, nz);
          if (wat) {
            // water renders only against air/cutouts, never between water cells
            if (neighbor === WATER || isOpaque(neighbor)) continue;
          } else if (isDoor) {
            // Hide internal horizontal seam between bottom and top halves of a 2-block door
            if ((f === 2 || f === 3) && neighbor === id) continue;
            // Only show the thin edge if not against a wall
            if (isOpaque(neighbor)) continue;
          } else if (cut) {
            // hide only internal faces between two identical cutout blocks
            if (neighbor === id || isOpaque(neighbor)) continue;
          } else if (isOpaque(neighbor)) continue;

          let tile = f === 3 ? def.top : f === 2 ? def.bottom : def.side;
          if (isDoor) {
            const isEdgeFace = doorAlongX ? f === 0 || f === 1 || f === 2 || f === 3 : f === 4 || f === 5 || f === 2 || f === 3;
            if (isEdgeFace) {
              tile = id === DOOR_WOOD ? T.planks : T.iron;
            } else if (isDoorBottom) {
              tile = id === DOOR_WOOD ? T.doorWoodBottom : T.doorIronBottom;
            }
          }
          const [u0, v0, u1, v1] = tileUV(tile);
          const P = wat ? wPositions : cut ? cPositions : positions;
          const N = wat ? wNormals : cut ? cNormals : normals;
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

            let vx = p[0];
            const vy = p[1];
            let vz = p[2];
            if (isDoor) {
              if (doorAlongX) {
                vz = vz === 0 ? 0.4 : 0.6;
              } else {
                vx = vx === 0 ? 0.4 : 0.6;
              }
            }

            P.push(x + vx, y + vy, z + vz);
            N.push(face.dir[0], face.dir[1], face.dir[2]);
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

  const make = (p: number[], n: number[], c: number[], u: number[], idx: number[]) => {
    if (!p.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
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
    solid: make(positions, normals, colors, uvs, indices),
    cutout: make(cPositions, cNormals, cColors, cUvs, cIndices),
    water: make(wPositions, wNormals, wColors, wUvs, wIndices),
    decor,
  };
}
