import * as THREE from 'three';
import {
  AIR,
  BED,
  BLOCKS,
  CAMPFIRE,
  LADDER_PALETTE,
  isLadder,
  isSolid,
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
  WHEAT_CROP_1,
  WHEAT_CROP_2,
  WHEAT_CROP_3,
  FLOWER_BLUE,
  FLOWER_PINK,
  FLOWER_PURPLE,
  FLOWER_WHITE,
  DRY_BLOOM,
  DESERT_THISTLE,
  BIRD_NEST,
  CHICKEN_NEST,
  CHEST_AUTUMN,
  CHEST_CANYON,
  CHEST_DESERT,
  CHEST_JUNGLE,
  CHEST_PLAINS,
  CHEST_STORAGE,
  CHEST_UNDERWATER,
  CHEST_VOLCANIC,
  CHEST_WINTER,
  baseChestId,
  isOpenChest,
  isTreasureChest,
  isUnderwaterChest,
  COCONUT_LEAVES,
  BANANA_LEAVES,
  HAY_BALE,
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
  // expanded flora & ruins
  FLOWER_TULIP_RED,
  FLOWER_TULIP_YELLOW,
  FLOWER_TULIP_PINK,
  FLOWER_TULIP_ORANGE,
  FLOWER_TULIP_WHITE,
  FLOWER_SUNFLOWER,
  FLOWER_ROSE,
  FLOWER_LAVENDER,
  FLOWER_WISTERIA,
  FLOWER_DAISY,
  FLOWER_ORCHID,
  FLOWER_PEONY,
  BUSH,
  BUSH_FLOWERING,
  BERRY_BUSH,
  TALL_LAVENDER,
  TALL_SUNFLOWER,
  WISTERIA_VINE,
  MOSS_CARPET,
  LEAF_PILE,
  // cave biomes
  CAVE_MOSS_BLOCK,
  CAVE_VINE,
  CAVE_VINE_GLOW,
  GLOW_BERRY,
  DRIPSTONE_BLOCK,
  POINTED_DRIPSTONE,
  HANGING_ROOTS,
  ROOTED_DIRT,
  DEEPSLATE,
  DEEPSLATE_BRICKS,
  AMETHYST_BLOCK,
  GLOW_LICHEN,
  SPORE_BLOSSOM,
  AZALEA_LEAVES,
  AZALEA_FLOWERING,
  CLAY,
  MUSHROOM_BLOCK_RED,
  MUSHROOM_BLOCK_BROWN,
  MUSHROOM_STEM,
  STALACTITE,
  STALAGMITE,
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
const TILE_UV_CACHE = new Map<number, readonly number[]>();
function cachedTileUV(tile: number): readonly number[] {
  let uv = TILE_UV_CACHE.get(tile);
  if (!uv) {
    uv = tileUV(tile);
    TILE_UV_CACHE.set(tile, uv);
  }
  return uv;
}

export const CAMPFIRE_SMOKE_HEIGHT = 42;
export const HAY_CAMPFIRE_SMOKE_HEIGHT = 78;
export type CampfireSpec = { x: number; y: number; z: number; hayBoost: boolean };
export type ChunkGeometry = {
  campfires: CampfireSpec[];
  solid: THREE.BufferGeometry | null;
  cutout: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  /** untextured coloured decor models: flowers, egg clutches, chest bodies */
  decor: THREE.BufferGeometry | null;
  /** hinged chest lids, drawn as separate meshes so they can swing open */
  chestLids: ChestLidSpec[];
};

/** per-face brightness matching the terrain look */
const BOX_SHADE = [0.66, 0.66, 0.46, 1.0, 0.8, 0.8]; // -x +x -y +y -z +z

/** Append a shaded coloured box to the decor buffers; angleY enables tiny rotated details. */
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
  angleY = 0,
  angleX = 0,
  pivotY = cy,
  pivotZ = cz,
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
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    for (const v of faces[f]) {
      let vx = v[0];
      let vy = v[1];
      let vz = v[2];
      // in-plane spin first, then the hinge swing — a sea star on an opening lid stays a sea star
      if (angleY !== 0) {
        const dx = vx - cx;
        const dz = vz - cz;
        vx = cx + dx * cosY + dz * sinY;
        vz = cz - dx * sinY + dz * cosY;
      }
      if (angleX !== 0) {
        const dy = vy - pivotY;
        const dz = vz - pivotZ;
        vy = pivotY + dy * cosX - dz * sinX;
        vz = pivotZ + dy * sinX + dz * cosX;
      }
      P.push(vx, vy, vz);
      C.push(r * sh, g * sh, b * sh);
    }
    I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
}

/** A wall-mounted, climbable voxel ladder; the first solid neighbour fixes its rendering plane. */
function addLadder(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number, world: World) {
  const supportedAt = (dx: number, dz: number) => isSolid(world.get(x + dx, y, z + dz));
  let axis: 'x' | 'z' = 'z';
  let plane = z + 0.055;
  if (supportedAt(-1, 0)) {
    axis = 'x';
    plane = x + 0.055;
  } else if (supportedAt(1, 0)) {
    axis = 'x';
    plane = x + 0.945;
  } else if (supportedAt(0, -1)) {
    axis = 'z';
    plane = z + 0.055;
  } else if (supportedAt(0, 1)) {
    axis = 'z';
    plane = z + 0.945;
  }

  const palette = LADDER_PALETTE[id];
  const rail = srgb(palette.dark);
  const rung = srgb(palette.light);
  if (axis === 'x') {
    for (const railZ of [z + 0.22, z + 0.78]) {
      addBox(P, C, I, plane, y + 0.5, railZ, 0.085, 0.94, 0.09, ...rail);
    }
    for (const rungY of [y + 0.12, y + 0.30, y + 0.48, y + 0.66, y + 0.84]) {
      addBox(P, C, I, plane, rungY, z + 0.5, 0.065, 0.055, 0.60, ...rung);
    }
  } else {
    for (const railX of [x + 0.22, x + 0.78]) {
      addBox(P, C, I, railX, y + 0.5, plane, 0.09, 0.94, 0.085, ...rail);
    }
    for (const rungY of [y + 0.12, y + 0.30, y + 0.48, y + 0.66, y + 0.84]) {
      addBox(P, C, I, x + 0.5, rungY, plane, 0.60, 0.055, 0.065, ...rung);
    }
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
  const variant = Math.abs(seed) % 4;
  const cx = x + 0.5 + (((seed * 7) % 7) - 3) * 0.04;
  const cz = z + 0.5 + (((seed * 11) % 7) - 3) * 0.04;
  const h = 0.48 + ((seed % 6) * 0.08);
  if (variant === 0) {
    // classic dense clump with bent tips
    addBox(P, C, I, cx - 0.08, y + h * 0.45, cz - 0.05, 0.06, h * 0.9, 0.06, ...COL.grassA);
    addBox(P, C, I, cx + 0.07, y + h * 0.5, cz + 0.06, 0.06, h, 0.06, ...COL.grassB);
    addBox(P, C, I, cx - 0.04, y + h * 0.35, cz + 0.1, 0.05, h * 0.7, 0.05, ...COL.grassC);
    addBox(P, C, I, cx + 0.09, y + h * 0.4, cz - 0.08, 0.05, h * 0.8, 0.05, ...COL.grassA);
  } else if (variant === 1) {
    // tall arching blades with light tips
    addBox(P, C, I, cx, y + h * 0.5, cz, 0.05, h, 0.05, ...COL.grassB);
    addBox(P, C, I, cx + 0.12, y + h * 0.55, cz + 0.04, 0.04, h*0.85, 0.04, ...COL.grassA);
    addBox(P, C, I, cx - 0.10, y + h * 0.48, cz - 0.06, 0.04, h*0.75, 0.04, ...COL.grassC);
    addBox(P, C, I, cx + 0.04, y + h * 0.85, cz + 0.02, 0.07, 0.07, 0.07, ...srgb(0xc8e6a0));
  } else if (variant === 2) {
    // feathery 5-blade star
    for (let k=0;k<5;k++){
      const ang = k*1.256 + seed*0.1;
      const dx = Math.cos(ang)*0.11, dz = Math.sin(ang)*0.11;
      const col = k%2===0?COL.grassA:COL.grassB;
      addBox(P, C, I, cx+dx*0.5, y+h*0.5, cz+dz*0.5, 0.05, h*(0.7+0.2*Math.random()), 0.05, ...col);
    }
  } else {
    // low thick meadow tuft with seed heads
    addBox(P, C, I, cx, y+0.18, cz, 0.18, 0.36, 0.18, ...COL.grassC);
    addBox(P, C, I, cx+0.08, y+0.32, cz+0.06, 0.08, 0.22, 0.08, ...COL.grassB);
    addBox(P, C, I, cx-0.07, y+0.30, cz-0.05, 0.07, 0.20, 0.07, ...COL.grassA);
    addBox(P, C, I, cx, y+0.52, cz, 0.10, 0.06, 0.10, ...srgb(0xd4c07a));
  }
}

function addFern(P: number[], C: number[], I: number[], x: number, y: number, z: number, seed: number) {
  const variant = Math.abs(seed) % 4;
  const cx = x + 0.5 + (((seed*3)%5)-2)*0.02;
  const cz = z + 0.5 + (((seed*7)%5)-2)*0.02;
  const h = 0.42 + ((seed % 4) * 0.08);
  if (variant === 0) {
    addBox(P, C, I, cx, y + h * 0.5, cz, 0.08, h, 0.08, ...COL.fernA);
    addBox(P, C, I, cx + 0.14, y + h * 0.6, cz, 0.22, 0.05, 0.12, ...COL.fernB);
    addBox(P, C, I, cx - 0.14, y + h * 0.6, cz, 0.22, 0.05, 0.12, ...COL.fernB);
    addBox(P, C, I, cx, y + h * 0.5, cz + 0.14, 0.12, 0.05, 0.22, ...COL.fernB);
    addBox(P, C, I, cx, y + h * 0.5, cz - 0.14, 0.12, 0.05, 0.22, ...COL.fernB);
  } else if (variant === 1) {
    // tall layered fern with 3 tiers
    addBox(P, C, I, cx, y+h*0.5, cz, 0.07, h, 0.07, ...COL.fernA);
    for(let t=0;t<3;t++){
      const ty = y + 0.12 + t*0.14;
      const s = 0.18 + t*0.06;
      addBox(P, C, I, cx+s, ty, cz, s, 0.04, 0.08, ...COL.fernB);
      addBox(P, C, I, cx-s, ty+0.02, cz, s, 0.04, 0.08, ...COL.fernB);
    }
  } else if (variant === 2) {
    // broad ostrich fern
    addBox(P, C, I, cx, y+h*0.45, cz, 0.09, h*0.9, 0.09, ...COL.fernA);
    for(let k=0;k<6;k++){
      const ang = k*1.047; const r=0.16;
      const dx=Math.cos(ang)*r, dz=Math.sin(ang)*r;
      addBox(P, C, I, cx+dx, y+h*0.62, cz+dz, 0.18, 0.04, 0.10, ...COL.fernB);
    }
  } else {
    // delicate maidenhair with small leaflets
    addBox(P, C, I, cx, y+h*0.5, cz, 0.05, h, 0.05, ...COL.fernA);
    for(let k=0;k<4;k++){
      const yk = y+0.15+k*0.10;
      addBox(P, C, I, cx+0.10, yk, cz+0.04, 0.12, 0.03, 0.06, ...COL.fernB);
      addBox(P, C, I, cx-0.10, yk+0.02, cz-0.03, 0.12, 0.03, 0.06, ...COL.fernB);
      addBox(P, C, I, cx+0.04, yk+0.01, cz+0.10, 0.06, 0.03, 0.12, ...COL.fernB);
    }
  }
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

/** One palette per chest family, shared by the body and its hinged lid. */
type ChestPalette = { body: number; lid: number; band: number; iron: number; jewel: number };
const CHEST_PALETTES: Record<number, ChestPalette> = {
  [CHEST_PLAINS]: { body: 0x80502e, lid: 0xa76635, band: 0xd4a84d, iron: 0x49342a, jewel: 0xf2ca60 },
  [CHEST_STORAGE]: { body: 0x765033, lid: 0x9c6638, band: 0xc29443, iron: 0x3f3028, jewel: 0xe7bd55 },
  [CHEST_WINTER]: { body: 0x3f6474, lid: 0x628fa1, band: 0xc3dce1, iron: 0x2f4556, jewel: 0xc2f1ff },
  [CHEST_AUTUMN]: { body: 0x87452e, lid: 0xb86631, band: 0xdba94b, iron: 0x452c26, jewel: 0xffd16a },
  [CHEST_JUNGLE]: { body: 0x435b37, lid: 0x648347, band: 0xa49a49, iron: 0x2b3a2a, jewel: 0xb8d35b },
  [CHEST_DESERT]: { body: 0x93602e, lid: 0xc39245, band: 0xe4c76c, iron: 0x594027, jewel: 0xffe99a },
  [CHEST_CANYON]: { body: 0x713d2d, lid: 0xa75234, band: 0xc38b42, iron: 0x3f2926, jewel: 0xf18a4b },
  [CHEST_VOLCANIC]: { body: 0x302b32, lid: 0x514049, band: 0x815248, iron: 0x1c1a20, jewel: 0xff7148 },
  [CHEST_UNDERWATER]: { body: 0x3b5b51, lid: 0x58776a, band: 0x9b7650, iron: 0x354942, jewel: 0x69c7b5 },
};

/** Hinge line of every chest lid, measured from the block's own corner. */
export const CHEST_LID_HINGE_Y = 0.335;
export const CHEST_LID_HINGE_Z = -0.365;
/** lid swung fully back, standing behind the chest */
export const CHEST_LID_OPEN_ANGLE = -Math.PI / 2;

/** engine-side description of a hinged lid found while meshing a chunk */
export type ChestLidSpec = {
  x: number;
  y: number;
  z: number;
  /** closed-variant id; selects the palette */
  base: number;
  open: boolean;
};

/**
 * Lid, banding, gem and the sea-growth that rides on the lid — authored around
 * the hinge at origin so the same numbers serve the baked model and the swing.
 */
function emitChestLid(
  P: number[],
  C: number[],
  I: number[],
  hx: number,
  hy: number,
  hz: number,
  baseId: number,
  angleX: number,
) {
  const palette = CHEST_PALETTES[baseId] ?? CHEST_PALETTES[CHEST_PLAINS];
  const lid = srgb(palette.lid), band = srgb(palette.band), body = srgb(palette.body), jewel = srgb(palette.jewel);
  const put = (rx: number, ry: number, rz: number, w: number, h: number, d: number, col: number[], angleY = 0) =>
    addBox(P, C, I, hx + rx, hy + ry, hz + rz, w, h, d, col[0], col[1], col[2], angleY, angleX, hy, hz);

  put(0, 0.07, 0.345, 0.79, 0.14, 0.67, lid);
  put(0, 0.151, 0.345, 0.75, 0.035, 0.63, band);
  // Short, raised wood-grain strips and a small material gem distinguish each biome chest.
  for (const dx of [-0.22, 0, 0.22]) put(dx, 0.177, 0.345, 0.035, 0.018, 0.48, body);
  put(0, 0.2, 0.33, 0.13, 0.045, 0.13, jewel);
  put(0, 0.225, 0.33, 0.065, 0.03, 0.065, band);

  if (isUnderwaterChest(baseId)) {
    const shell = srgb(0xc7b996);
    const shellShade = srgb(0x8e9e89);
    const star = srgb(0xf07b53);
    const addBarnacle = (bx: number, bz: number, scale: number) => {
      put(bx, 0.205, bz, 0.11 * scale, 0.055 * scale, 0.1 * scale, shellShade);
      put(bx, 0.24, bz, 0.075 * scale, 0.055 * scale, 0.075 * scale, shell);
      put(bx, 0.275, bz, 0.04 * scale, 0.035 * scale, 0.045 * scale, srgb(0xe2d8bb));
    };
    addBarnacle(-0.27, 0.185, 0.9);
    addBarnacle(0.28, 0.465, 0.75);
    addBarnacle(0.18, 0.125, 0.65);
    addBarnacle(-0.36, 0.585, 0.72);
    // Five rotated little arms form a bright sea star resting on the lid.
    for (let arm = 0; arm < 5; arm++) {
      put(-0.12, 0.245, 0.465, 0.065, 0.035, 0.23, star, arm * (Math.PI * 2 / 5));
    }
    put(-0.12, 0.25, 0.465, 0.11, 0.04, 0.11, srgb(0xf8a06a));
  }
}

const chestLidGeometryCache = new Map<number, THREE.BufferGeometry>();

/**
 * Stand-alone lid geometry for the engine's swinging meshes: hinge at the
 * origin, lid extending toward +z in the closed pose. Cached per chest family.
 */
export function chestLidGeometry(blockId: number): THREE.BufferGeometry {
  const base = baseChestId(blockId);
  const cached = chestLidGeometryCache.get(base);
  if (cached) return cached;
  const P: number[] = [];
  const C: number[] = [];
  const I: number[] = [];
  emitChestLid(P, C, I, 0, 0, 0, base, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I);
  geo.computeBoundingSphere();
  chestLidGeometryCache.set(base, geo);
  return geo;
}

/**
 * Biome-coloured voxel treasure chest body. The lid is a separate hinged piece
 * so the engine can swing it open; a looted chest shows its dark interior.
 */
function addTreasureChestBody(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number) {
  const base = baseChestId(id);
  const open = isOpenChest(id);
  const palette = CHEST_PALETTES[base] ?? CHEST_PALETTES[CHEST_PLAINS];
  const cx = x + 0.5;
  const cz = z + 0.5;
  const body = srgb(palette.body), band = srgb(palette.band);
  const iron = srgb(palette.iron), jewel = srgb(palette.jewel);
  const front = z + 0.145;

  // Feet, reinforced body and a raised rim the lid rests on.
  for (const dx of [-0.29, 0.29]) for (const dz of [-0.23, 0.23])
    addBox(P, C, I, cx + dx, y + 0.055, cz + dz, 0.13, 0.11, 0.13, ...iron);
  addBox(P, C, I, cx, y + 0.22, cz, 0.78, 0.31, 0.66, ...body);
  addBox(P, C, I, cx, y + 0.095, cz, 0.80, 0.065, 0.68, ...iron);
  addBox(P, C, I, cx, y + 0.395, cz, 0.83, 0.15, 0.71, ...iron);

  // Metal corner straps and front-facing latch, kept chunky so they read at game distance.
  for (const dx of [-0.25, 0.25]) {
    addBox(P, C, I, cx + dx, y + 0.245, front, 0.055, 0.29, 0.04, ...band);
    addBox(P, C, I, cx + dx, y + 0.245, z + 0.855, 0.055, 0.29, 0.04, ...band);
    addBox(P, C, I, x + 0.105, y + 0.245, cz + dx * 0.78, 0.04, 0.29, 0.055, ...band);
    addBox(P, C, I, x + 0.895, y + 0.245, cz + dx * 0.78, 0.04, 0.29, 0.055, ...band);
  }
  addBox(P, C, I, cx, y + 0.285, z + 0.132, 0.15, 0.17, 0.065, ...iron);
  addBox(P, C, I, cx, y + 0.3, z + 0.092, 0.075, 0.085, 0.025, ...jewel);
  addBox(P, C, I, cx, y + 0.276, z + 0.074, 0.025, 0.045, 0.018, ...iron);

  if (open) {
    // dark interior, a faint warm glow and a few coins the looter left behind
    addBox(P, C, I, cx, y + 0.366, cz, 0.62, 0.075, 0.5, ...srgb(0x1d1512));
    addEmissiveBox(P, C, I, cx, y + 0.336, cz, 0.5, 0.02, 0.38, ...srgb(0x6b4a1c));
    for (const [dx, dz, s] of [[-0.17, -0.11, 1], [0.14, 0.05, 0.85], [0.02, -0.2, 0.7]] as const)
      addBox(P, C, I, cx + dx, y + 0.375, cz + dz, 0.12 * s, 0.03, 0.12 * s, ...jewel);
  }

  if (isUnderwaterChest(base)) {
    const moss = srgb(0x557a59);
    const darkMoss = srgb(0x365b4e);
    // Algae trails droop over the corners like a chest abandoned on the sea floor.
    for (const [dx, dz, height] of [[-0.33, -0.23, 0.22], [0.32, 0.2, 0.28], [-0.28, 0.24, 0.16]] as const) {
      addBox(P, C, I, cx + dx, y + 0.37 - height * 0.36, cz + dz, 0.055, height, 0.07, ...moss);
      addBox(P, C, I, cx + dx + 0.045, y + 0.34 - height * 0.42, cz + dz + 0.025, 0.045, height * 0.72, 0.06, ...darkMoss);
    }
  }
}

/** Chunky voxel flowers with distinct tulip, lavender, daisy and classic rosette silhouettes — expanded for forest biomes. */
function addFlower(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number, seed: number) {
  const cx = x + 0.5 + (((seed * 7) % 5) - 2) * 0.04;
  const cz = z + 0.5 + (((seed * 13) % 5) - 2) * 0.04;

  // Extended color map for new flora
  const COL_TULIP_RED = srgb(0xd42a2a);
  const COL_TULIP_YELLOW = srgb(0xe8c628);
  const COL_TULIP_PINK = srgb(0xe46a9a);
  const COL_TULIP_ORANGE = srgb(0xe86a18);
  const COL_TULIP_WHITE = srgb(0xf0f0e8);
  const COL_SUNFLOWER = srgb(0xf0c030);
  const COL_ROSE = srgb(0xc41e1e);
  const COL_LAV = srgb(0x7a5aba);
  const COL_WISTERIA = srgb(0x9a7ac8);
  const COL_DAISY = srgb(0xf0f0e8);
  const COL_ORCHID = srgb(0x6a5aba);
  const COL_PEONY = srgb(0xd45a8a);

  let petal: number[] = COL.white;
  let core = COL.coreY;
  let isTulip = false;
  let isLavenderSpike = false;
  let isSunflower = false;
  let isRose = false;
  let isWisteria = false;
  let isDaisy = false;
  let isOrchid = false;
  let isPeony = false;

  switch (id) {
    case FLOWER_RED: petal = COL.red; break;
    case FLOWER_YELLOW: petal = COL.yellow; core = COL.coreB; break;
    case FLOWER_BLUE: petal = COL.blue; break;
    case FLOWER_PINK: petal = COL.pink; isTulip = true; break;
    case FLOWER_PURPLE: petal = COL.purple; isLavenderSpike = true; break;
    case FLOWER_WHITE: petal = COL.white; isDaisy = true; break;
    case FLOWER_TULIP_RED: petal = COL_TULIP_RED; isTulip = true; break;
    case FLOWER_TULIP_YELLOW: petal = COL_TULIP_YELLOW; isTulip = true; core = COL.coreB; break;
    case FLOWER_TULIP_PINK: petal = COL_TULIP_PINK; isTulip = true; break;
    case FLOWER_TULIP_ORANGE: petal = COL_TULIP_ORANGE; isTulip = true; break;
    case FLOWER_TULIP_WHITE: petal = COL_TULIP_WHITE; isTulip = true; break;
    case FLOWER_SUNFLOWER: petal = COL_SUNFLOWER; isSunflower = true; core = srgb(0x5a3a10); break;
    case FLOWER_ROSE: petal = COL_ROSE; isRose = true; break;
    case FLOWER_LAVENDER: petal = COL_LAV; isLavenderSpike = true; break;
    case FLOWER_WISTERIA: petal = COL_WISTERIA; isWisteria = true; break;
    case FLOWER_DAISY: petal = COL_DAISY; isDaisy = true; break;
    case FLOWER_ORCHID: petal = COL_ORCHID; isOrchid = true; break;
    case FLOWER_PEONY: petal = COL_PEONY; isPeony = true; break;
    default: break;
  }

  const h = isLavenderSpike ? 0.66 : isSunflower ? 0.72 : isRose ? 0.56 : 0.5 + ((seed % 3) - 1) * 0.05;
  addBox(P, C, I, cx, y + h / 2, cz, 0.07, h, 0.07, ...COL.stem);
  addBox(P, C, I, cx + 0.1, y + h * 0.35, cz, 0.14, 0.05, 0.08, ...COL.leafG);
  addBox(P, C, I, cx - 0.09, y + h * 0.55, cz + 0.02, 0.12, 0.05, 0.08, ...COL.leafG);

  if (isLavenderSpike) {
    for (let row = 0; row < 4; row++) {
      const fy = y + 0.24 + row * 0.105;
      const offset = row % 2 === 0 ? -0.045 : 0.045;
      addBox(P, C, I, cx + offset, fy, cz, 0.12, 0.09, 0.12, ...petal);
      addBox(P, C, I, cx - offset, fy + 0.025, cz + 0.035, 0.09, 0.07, 0.09, ...COL.pink);
    }
    return;
  }

  const hy = y + h + 0.08;
  if (isTulip) {
    addBox(P, C, I, cx, hy - 0.035, cz, 0.17, 0.14, 0.17, ...COL.purple);
    addBox(P, C, I, cx, hy + 0.035, cz, 0.14, 0.14, 0.14, ...petal);
    addBox(P, C, I, cx - 0.095, hy + 0.045, cz, 0.09, 0.17, 0.12, ...petal);
    addBox(P, C, I, cx + 0.095, hy + 0.045, cz, 0.09, 0.17, 0.12, ...petal);
    addBox(P, C, I, cx, hy + 0.055, cz - 0.09, 0.12, 0.16, 0.09, ...COL.pink);
    addBox(P, C, I, cx, hy + 0.09, cz, 0.07, 0.06, 0.07, ...COL.coreY);
    return;
  }
  if (isSunflower) {
    // Large sunflower head with dark center
    addBox(P, C, I, cx, hy, cz, 0.32, 0.14, 0.32, ...core);
    for (const [dx, dz] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18], [0.13, 0.13], [-0.13, 0.13], [0.13, -0.13], [-0.13, -0.13]]) {
      addBox(P, C, I, cx + dx, hy, cz + dz, 0.16, 0.12, 0.16, ...petal);
    }
    return;
  }
  if (isRose) {
    addBox(P, C, I, cx, hy, cz, 0.22, 0.20, 0.22, ...petal);
    addBox(P, C, I, cx, hy + 0.08, cz, 0.16, 0.12, 0.16, ...srgb(0xe83030));
    addBox(P, C, I, cx, hy + 0.14, cz, 0.09, 0.06, 0.09, ...srgb(0xff5a4a));
    return;
  }
  if (isWisteria) {
    // Hanging cascade
    for (let r = 0; r < 3; r++) {
      const fy = hy - r * 0.12;
      const s = 0.18 - r * 0.03;
      addBox(P, C, I, cx, fy, cz, s, s * 0.7, s, ...petal);
      addBox(P, C, I, cx + 0.05, fy - 0.02, cz + 0.03, s * 0.7, s * 0.5, s * 0.7, ...srgb(0xc8a8f0));
    }
    return;
  }
  if (isOrchid) {
    addBox(P, C, I, cx, hy, cz, 0.18, 0.14, 0.18, ...petal);
    addBox(P, C, I, cx + 0.12, hy + 0.02, cz, 0.12, 0.10, 0.12, ...petal);
    addBox(P, C, I, cx - 0.12, hy + 0.02, cz, 0.12, 0.10, 0.12, ...petal);
    addBox(P, C, I, cx, hy + 0.06, cz, 0.14, 0.10, 0.22, ...srgb(0xd8c8ff));
    addBox(P, C, I, cx, hy + 0.02, cz + 0.08, 0.10, 0.08, 0.10, ...srgb(0xff9ad0));
    return;
  }
  if (isPeony) {
    addBox(P, C, I, cx, hy, cz, 0.26, 0.22, 0.26, ...petal);
    addBox(P, C, I, cx, hy + 0.08, cz, 0.20, 0.16, 0.20, ...srgb(0xe87aa8));
    addBox(P, C, I, cx, hy + 0.14, cz, 0.12, 0.10, 0.12, ...srgb(0xffb0d0));
    return;
  }

  // Classic flower/daisy head: a yellow core with a cross of petals, plus diagonals for daisies.
  addBox(P, C, I, cx, hy, cz, 0.14, 0.14, 0.14, ...core);
  addBox(P, C, I, cx + 0.14, hy, cz, 0.14, 0.12, 0.12, ...petal);
  addBox(P, C, I, cx - 0.14, hy, cz, 0.14, 0.12, 0.12, ...petal);
  addBox(P, C, I, cx, hy, cz + 0.14, 0.12, 0.12, 0.14, ...petal);
  addBox(P, C, I, cx, hy, cz - 0.14, 0.12, 0.12, 0.14, ...petal);
  if (isDaisy) {
    for (const [dx, dz] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]] as const)
      addBox(P, C, I, cx + dx, hy, cz + dz, 0.11, 0.1, 0.11, ...petal);
  }
  addBox(P, C, I, cx, hy + 0.12, cz, 0.1, 0.06, 0.1, ...petal);
}

/** Bushes, berry bushes, tall lavender/sunflower, wisteria vine, moss carpet, leaf pile for forest biomes */
function addBush(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number, seed: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const leaf = srgb(0x3a7a2a);
  const leafLight = srgb(0x5aba4a);
  const stem = srgb(0x4a3a1a);
  // trunk
  addBox(P, C, I, cx, y + 0.18, cz, 0.10, 0.36, 0.10, ...stem);
  if (id === BUSH) {
    addBox(P, C, I, cx, y + 0.46, cz, 0.64, 0.42, 0.64, ...leaf);
    addBox(P, C, I, cx, y + 0.58, cz, 0.52, 0.28, 0.52, ...leafLight);
  } else if (id === BUSH_FLOWERING) {
    addBox(P, C, I, cx, y + 0.46, cz, 0.68, 0.44, 0.68, ...leaf);
    for (const [dx, dz, col] of [[-0.18, -0.12, 0xf0e0e8], [0.16, 0.14, 0xffb0d0], [0.12, -0.16, 0xf0f0f8]] as const) {
      addBox(P, C, I, cx + dx, y + 0.58, cz + dz, 0.14, 0.10, 0.14, ...srgb(col));
    }
  } else if (id === BERRY_BUSH) {
    addBox(P, C, I, cx, y + 0.46, cz, 0.64, 0.42, 0.64, ...leaf);
    for (const [dx, dz] of [[-0.15, 0.1], [0.18, -0.08], [0.05, 0.18]] as const) {
      addBox(P, C, I, cx + dx, y + 0.54, cz + dz, 0.10, 0.10, 0.10, ...srgb(0xc41e1e));
      addBox(P, C, I, cx + dx + 0.02, y + 0.58, cz + dz, 0.05, 0.05, 0.05, ...srgb(0xff4a3a));
    }
  }
}
function addTallPlant(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const stem = srgb(0x4a8a32);
  addBox(P, C, I, cx, y + 0.5, cz, 0.08, 1.0, 0.08, ...stem);
  if (id === TALL_LAVENDER) {
    for (let r = 0; r < 5; r++) {
      const fy = y + 0.45 + r * 0.12;
      addBox(P, C, I, cx, fy, cz, 0.16, 0.10, 0.16, ...srgb(r % 2 === 0 ? 0x7a5aba : 0x5a3a8a));
    }
  } else if (id === TALL_SUNFLOWER) {
    addBox(P, C, I, cx, y + 0.85, cz, 0.34, 0.16, 0.34, ...srgb(0xf0c030));
    addBox(P, C, I, cx, y + 0.85, cz, 0.18, 0.18, 0.18, ...srgb(0x5a3a10));
  }
}
function addWisteriaVineDecor(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.5, cz, 0.07, 1.0, 0.07, ...srgb(0x4a6a3a));
  for (const [dx, dz, yy] of [[0.12, 0.08, 0.75], [-0.10, 0.12, 0.55], [0.08, -0.12, 0.35]] as const) {
    addBox(P, C, I, cx + dx, y + yy, cz + dz, 0.16, 0.14, 0.16, ...srgb(0x9a7ac8));
    addBox(P, C, I, cx + dx, y + yy - 0.06, cz + dz, 0.10, 0.10, 0.10, ...srgb(0xc8a8f0));
  }
}
function addCaveVine(P: number[], C: number[], I: number[], x: number, y: number, z: number, glow: boolean) {
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.5, cz, 0.06, 1.0, 0.06, ...srgb(0x3a7a2a));
  addBox(P, C, I, cx + 0.08, y + 0.6, cz + 0.06, 0.10, 0.12, 0.10, ...srgb(glow ? 0x6cbb4a : 0x4a8a3a));
  addBox(P, C, I, cx - 0.07, y + 0.3, cz - 0.05, 0.09, 0.10, 0.09, ...srgb(glow ? 0x7acc5a : 0x3a6a2a));
  if (glow) {
    addBox(P, C, I, cx, y + 0.15, cz, 0.12, 0.10, 0.12, ...srgb(0xf0d860));
    addBox(P, C, I, cx, y + 0.08, cz, 0.08, 0.06, 0.08, ...srgb(0xfff0a0));
  }
}
function addGlowBerry(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.5, cz, 0.05, 0.8, 0.05, ...srgb(0x4a7a2a));
  addBox(P, C, I, cx, y + 0.12, cz, 0.14, 0.12, 0.14, ...srgb(0xf0d860));
  addBox(P, C, I, cx, y + 0.06, cz, 0.08, 0.08, 0.08, ...srgb(0xfff0a0));
}
function addHangingRoots(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.5, cz, 0.06, 1.0, 0.06, ...srgb(0x7a5a3a));
  addBox(P, C, I, cx + 0.06, y + 0.4, cz, 0.04, 0.8, 0.04, ...srgb(0x8a6a4a));
  addBox(P, C, I, cx - 0.06, y + 0.35, cz, 0.04, 0.7, 0.04, ...srgb(0x6a4a2a));
}
function addSporeBlossom(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.85, cz, 0.14, 0.08, 0.14, ...srgb(0x4a7a3a));
  addBox(P, C, I, cx, y + 0.5, cz, 0.18, 0.14, 0.18, ...srgb(0xe46a9a));
  addBox(P, C, I, cx, y + 0.38, cz, 0.12, 0.10, 0.12, ...srgb(0xff9abe));
  addBox(P, C, I, cx, y + 0.20, cz, 0.04, 0.4, 0.04, ...srgb(0x5a9a4a));
}
function addDripstone(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number) {
  const cx = x + 0.5, cz = z + 0.5;
  if (id === POINTED_DRIPSTONE) {
    addBox(P, C, I, cx, y + 0.5, cz, 0.14, 0.8, 0.14, ...srgb(0x8a7565));
    addBox(P, C, I, cx, y + 0.15, cz, 0.08, 0.3, 0.08, ...srgb(0x9a8a7a));
  } else if (id === STALACTITE) {
    addBox(P, C, I, cx, y + 0.7, cz, 0.22, 0.6, 0.22, ...srgb(0x8a7565));
    addBox(P, C, I, cx, y + 0.25, cz, 0.14, 0.5, 0.14, ...srgb(0x9a8a7a));
    addBox(P, C, I, cx, y + 0.05, cz, 0.08, 0.3, 0.08, ...srgb(0xaa9a8a));
  } else if (id === STALAGMITE) {
    addBox(P, C, I, cx, y + 0.3, cz, 0.22, 0.6, 0.22, ...srgb(0x8a7565));
    addBox(P, C, I, cx, y + 0.7, cz, 0.14, 0.4, 0.14, ...srgb(0x9a8a7a));
  }
}
function addGlowLichen(P: number[], C: number[], I: number[], x: number, y: number, z: number) {
  const cx = x + 0.5, cz = z + 0.5;
  addBox(P, C, I, cx, y + 0.5, cz, 0.08, 0.08, 0.92, ...srgb(0x6a9a5a));
  addBox(P, C, I, cx, y + 0.55, cz, 0.06, 0.04, 0.72, ...srgb(0x8abb6a));
}
function addGroundCover(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  if (id === MOSS_CARPET) {
    addBox(P, C, I, cx, y + 0.06, cz, 0.96, 0.12, 0.96, ...srgb(0x4a9a3a));
    addBox(P, C, I, cx + 0.1, y + 0.12, cz - 0.08, 0.32, 0.06, 0.28, ...srgb(0x5aba4a));
  } else if (id === LEAF_PILE) {
    addBox(P, C, I, cx, y + 0.08, cz, 0.92, 0.16, 0.92, ...srgb(0xc87a28));
    addBox(P, C, I, cx - 0.12, y + 0.16, cz + 0.10, 0.36, 0.08, 0.32, ...srgb(0xe8a040));
    addBox(P, C, I, cx + 0.14, y + 0.14, cz - 0.06, 0.28, 0.06, 0.28, ...srgb(0xd06020));
  }
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

/** Crossed, charred logs and a stone ring form the static base of the animated campfire. */
function addCampfire(P: number[], C: number[], I: number[], x: number, y: number, z: number, hayBoost: boolean) {
  const cx = x + 0.5, cz = z + 0.5;
  const stones = hayBoost ? [0x8e7953, 0xa28a5a, 0x786747, 0xb09661] : [0x777477, 0x908b86, 0x625f62, 0xa09a91];
  const ring = [
    [cx - 0.32, cz - 0.25], [cx + 0.31, cz - 0.27],
    [cx - 0.30, cz + 0.27], [cx + 0.30, cz + 0.25],
  ];
  ring.forEach(([sx, sz], i) => addBox(P, C, I, sx, y + 0.07, sz, 0.29, 0.13, 0.27, ...srgb(stones[i])));
  addBox(P, C, I, cx, y + 0.16, cz, 0.86, 0.16, 0.16, ...srgb(0x38251d), Math.PI * 0.12);
  addBox(P, C, I, cx, y + 0.18, cz, 0.86, 0.16, 0.16, ...srgb(0x503126), Math.PI * 0.5);
  addBox(P, C, I, cx - 0.10, y + 0.245, cz + 0.03, 0.25, 0.055, 0.18, ...srgb(hayBoost ? 0xffa52f : 0xff7a22));
  addBox(P, C, I, cx + 0.10, y + 0.245, cz - 0.04, 0.20, 0.045, 0.14, ...srgb(0xffd15a));
}

/** Three slim wheat stems with stage-dependent seed heads; each plant stays inside its voxel. */
function addWheatCrop(P: number[], C: number[], I: number[], x: number, y: number, z: number, id: number) {
  const stage = id === WHEAT_CROP_1 ? 1 : id === WHEAT_CROP_2 ? 2 : 3;
  const stem = srgb(stage === 3 ? 0xa9953d : stage === 2 ? 0x8c9b42 : 0x5f9840);
  const head = srgb(stage === 3 ? 0xe2bd4c : stage === 2 ? 0x91a44a : 0x6fa54c);
  const stalks: Array<[number, number]> = [[0.29, 0.34], [0.52, 0.53], [0.71, 0.67]];
  const heights = stage === 1 ? [0.36, 0.42, 0.32] : stage === 2 ? [0.66, 0.75, 0.61] : [0.88, 0.96, 0.82];
  stalks.forEach(([sx, sz], i) => {
    const h = heights[i];
    addBox(P, C, I, x + sx, y + h / 2, z + sz, 0.055, h, 0.055, ...stem, (i - 1) * 0.1);
    if (stage > 1) {
      addBox(P, C, I, x + sx + 0.045, y + h - 0.08, z + sz, 0.12, 0.10, 0.10, ...head, (i - 1) * 0.22);
      if (stage === 3) {
        addBox(P, C, I, x + sx + 0.08, y + h - 0.16, z + sz + 0.035, 0.055, 0.17, 0.055, ...head, (i - 1) * 0.2);
      }
    }
  });
}

export function* buildChunkGeometrySteps(
  world: World,
  cx: number,
  cz: number,
  yieldEvery = 256,
  minY = 0,
  maxY = WY,
): Generator<void, ChunkGeometry, void> {
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
  // hinged lids and dynamic fire/smoke effects are maintained as individual world objects.
  const chestLids: ChestLidSpec[] = [];
  const campfires: CampfireSpec[] = [];
  // volumetric decor pass (flowers, egg clutches) — coloured, untextured
  const dPositions: number[] = [];
  const dColors: number[] = [];
  const dIndices: number[] = [];

  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const sourceChunk = world.getChunk?.(cx, cz);
  const blockData = sourceChunk?.blocks;
  const getLocal = (lx: number, y: number, lz: number) => {
    if (y < 0 || y >= WY) return AIR;
    if (blockData && lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK)
      return blockData[(y * CHUNK + lz) * CHUNK + lx];
    return world.get(x0 + lx, y, z0 + lz);
  };
  const solidLocal = (lx: number, y: number, lz: number) => isOpaque(getLocal(lx, y, lz));
  const AXES_X: readonly [number, number] = [1, 2];
  const AXES_Y: readonly [number, number] = [0, 2];
  const AXES_Z: readonly [number, number] = [0, 1];
  let visited = 0;

  // Only mesh a vertical window around the player; the world data remains fully generated below.
  const scanMinY = Math.max(0, Math.min(WY, Math.floor(minY)));
  const scanMaxY = Math.max(scanMinY, Math.min(WY, Math.ceil(maxY)));
  // Iterate the chunk's packed voxel buffer in storage order. This keeps reads cache-friendly
  // and avoids a World.get/map lookup for every block inside the chunk.
  for (let y = scanMinY; y < scanMaxY; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const z = z0 + lz;
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx;
        const localIndex = (y * CHUNK + lz) * CHUNK + lx;
        const id = blockData ? blockData[localIndex] : world.get(x, y, z);
        if (yieldEvery > 0 && ++visited % yieldEvery === 0) yield;
        if (id === AIR) continue;
        if (id === CAMPFIRE) {
          const hayBoost = getLocal(lx, y - 1, lz) === HAY_BALE;
          addCampfire(dPositions, dColors, dIndices, x, y, z, hayBoost);
          campfires.push({ x, y, z, hayBoost });
          continue;
        }
        if (id === WHEAT_CROP_1 || id === WHEAT_CROP_2 || id === WHEAT_CROP_3) {
          addWheatCrop(dPositions, dColors, dIndices, x, y, z, id);
          continue;
        }
        // flowers, grasses & egg clutches render as little 3D models, not textured cubes
        if (
          id === FLOWER_RED || id === FLOWER_YELLOW || id === FLOWER_BLUE ||
          id === FLOWER_PINK || id === FLOWER_PURPLE || id === FLOWER_WHITE ||
          id === FLOWER_TULIP_RED || id === FLOWER_TULIP_YELLOW || id === FLOWER_TULIP_PINK ||
          id === FLOWER_TULIP_ORANGE || id === FLOWER_TULIP_WHITE ||
          id === FLOWER_SUNFLOWER || id === FLOWER_ROSE || id === FLOWER_LAVENDER ||
          id === FLOWER_WISTERIA || id === FLOWER_DAISY || id === FLOWER_ORCHID || id === FLOWER_PEONY
        ) {
          addFlower(dPositions, dColors, dIndices, x, y, z, id, x * 31 + z * 17 + y);
          continue;
        }
        if (id === BUSH || id === BUSH_FLOWERING || id === BERRY_BUSH) {
          addBush(dPositions, dColors, dIndices, x, y, z, id, x * 31 + z * 17 + y);
          continue;
        }
        if (id === TALL_LAVENDER || id === TALL_SUNFLOWER) {
          addTallPlant(dPositions, dColors, dIndices, x, y, z, id);
          continue;
        }
        if (id === WISTERIA_VINE) {
          addWisteriaVineDecor(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        if (id === MOSS_CARPET || id === LEAF_PILE) {
          addGroundCover(dPositions, dColors, dIndices, x, y, z, id);
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
        if (isTreasureChest(id)) {
          addTreasureChestBody(dPositions, dColors, dIndices, x, y, z, id);
          chestLids.push({ x, y, z, base: baseChestId(id), open: isOpenChest(id) });
          continue;
        }
        if (id === VINE) {
          // Climbable hanging tendrils; do not fill the entire voxel.
          addBox(dPositions, dColors, dIndices, x + 0.45, y + 0.5, z + 0.45, 0.06, 0.96, 0.06, ...srgb(0x38743a));
          addBox(dPositions, dColors, dIndices, x + 0.58, y + 0.4, z + 0.53, 0.05, 0.78, 0.05, ...srgb(0x68a850));
          continue;
        }
        if (id === CAVE_VINE) {
          addCaveVine(dPositions, dColors, dIndices, x, y, z, false);
          continue;
        }
        if (id === CAVE_VINE_GLOW) {
          addCaveVine(dPositions, dColors, dIndices, x, y, z, true);
          continue;
        }
        if (id === GLOW_BERRY) {
          addGlowBerry(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        if (id === HANGING_ROOTS) {
          addHangingRoots(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        if (id === SPORE_BLOSSOM) {
          addSporeBlossom(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        if (id === POINTED_DRIPSTONE || id === STALACTITE || id === STALAGMITE) {
          addDripstone(dPositions, dColors, dIndices, x, y, z, id);
          continue;
        }
        if (id === GLOW_LICHEN) {
          addGlowLichen(dPositions, dColors, dIndices, x, y, z);
          continue;
        }
        if (isLadder(id)) {
          addLadder(dPositions, dColors, dIndices, x, y, z, id, world);
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
        if ((id === COCONUT_LEAVES || id === BANANA_LEAVES) && getLocal(lx, y - 1, lz) === AIR &&
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
        const isDoorBottom = isDoor && getLocal(lx, y + 1, lz) === id;
        // Determine doorway orientation so doors render as a 0.20-thick slab with 1 unified door face on front/back
        const doorAlongX =
          isDoor &&
          (isOpaque(getLocal(lx - 1, y, lz)) ||
            isOpaque(getLocal(lx + 1, y, lz)) ||
            (!isOpaque(getLocal(lx, y, lz - 1)) && !isOpaque(getLocal(lx, y, lz + 1))));

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const ny = y + face.dir[1];
          const localNx = lx + face.dir[0];
          const localNz = lz + face.dir[2];
          // Close the vertical slice with boundary faces; without caps, unseen voxels above/below
          // the active band would be omitted and caves would appear to have missing ceilings.
          const neighbor = ny < scanMinY || ny >= scanMaxY ? AIR : getLocal(localNx, ny, localNz);
          if (wat) {
            // water renders only against air/cutouts, never between water cells
            if (neighbor === WATER || isOpaque(neighbor) || isTreasureChest(neighbor)) continue;
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
          const [u0, v0, u1, v1] = cachedTileUV(tile);
          const P = wat ? wPositions : cut ? cPositions : positions;
          const N = wat ? wNormals : cut ? cNormals : normals;
          const C = wat ? wColors : cut ? cColors : colors;
          const U = wat ? wUvs : cut ? cUvs : uvs;
          const I = wat ? wIndices : cut ? cIndices : indices;
          const base = P.length / 3;

          // Tangent axes are static per face. Sample the four side neighbours and four corners once,
          // then reuse them for all four vertices instead of issuing 12 reads per face.
          const axes = face.dir[0] !== 0 ? AXES_X : face.dir[1] !== 0 ? AXES_Y : AXES_Z;
          const needsAO = !glow;
          let sideA0 = false, sideA1 = false, sideB0 = false, sideB1 = false;
          let corner00 = false, corner01 = false, corner10 = false, corner11 = false;
          if (needsAO) {
            const ax = axes[0], bx = axes[1];
            const aX = ax === 0 ? 1 : 0, aY = ax === 1 ? 1 : 0, aZ = ax === 2 ? 1 : 0;
            const bX = bx === 0 ? 1 : 0, bY = bx === 1 ? 1 : 0, bZ = bx === 2 ? 1 : 0;
            sideA0 = solidLocal(localNx - aX, ny - aY, localNz - aZ);
            sideA1 = solidLocal(localNx + aX, ny + aY, localNz + aZ);
            sideB0 = solidLocal(localNx - bX, ny - bY, localNz - bZ);
            sideB1 = solidLocal(localNx + bX, ny + bY, localNz + bZ);
            corner00 = solidLocal(localNx - aX - bX, ny - aY - bY, localNz - aZ - bZ);
            corner01 = solidLocal(localNx - aX + bX, ny - aY + bY, localNz - aZ + bZ);
            corner10 = solidLocal(localNx + aX - bX, ny + aY - bY, localNz + aZ - bZ);
            corner11 = solidLocal(localNx + aX + bX, ny + aY + bY, localNz + aZ + bZ);
          }
          let ao0 = 0, ao1 = 0, ao2 = 0, ao3 = 0;
          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            const p = corner.pos;
            let ao = 3;
            if (needsAO) {
              const aPositive = p[axes[0]] !== 0;
              const bPositive = p[axes[1]] !== 0;
              const s1 = (aPositive ? sideA1 : sideA0) ? 1 : 0;
              const s2 = (bPositive ? sideB1 : sideB0) ? 1 : 0;
              const cc = (aPositive
                ? (bPositive ? corner11 : corner10)
                : (bPositive ? corner01 : corner00)) ? 1 : 0;
              ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
            }
            if (c === 0) ao0 = ao;
            else if (c === 1) ao1 = ao;
            else if (c === 2) ao2 = ao;
            else ao3 = ao;

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

          if (ao0 + ao3 > ao1 + ao2) {
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
    campfires,
    solid: make(positions, normals, colors, uvs, indices),
    cutout: make(cPositions, cNormals, cColors, cUvs, cIndices),
    water: make(wPositions, wNormals, wColors, wUvs, wIndices),
    decor,
    chestLids,
  };
}

/** Synchronous compatibility wrapper for tests and tools; gameplay uses the sliced builder. */
export function buildChunkGeometry(world: World, cx: number, cz: number): ChunkGeometry {
  const job = buildChunkGeometrySteps(world, cx, cz, Number.MAX_SAFE_INTEGER);
  let result = job.next();
  while (!result.done) result = job.next();
  return result.value;
}
