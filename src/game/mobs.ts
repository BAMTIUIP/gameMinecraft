import * as THREE from 'three';
import type { World } from './world';
import { WY } from './world';
import { GRASS, VINE, DIRT, VOLCANIC_STONE, CACTUS, CACTUS_PALE, SAND, STONE, SNOW_GRASS, WATER, TALL_GRASS, FERN, DRY_BLOOM, DESERT_THISTLE, isFlower, isLeafId, isLogId, isSolid } from './blocks';
import type { TKey } from './i18n';
import { shouldDieInDaylight } from './survival';

export type MobId =
  | 'pig'
  | 'sheep'
  | 'cow'
  | 'chicken'
  | 'creeper'
  | 'zombie'
  | 'spider'
  | 'skeleton'
  | 'trader'
  | 'fish'
  | 'crab'
  | 'turtle'
  | 'rabbit'
  | 'penguin'
  | 'bird'
  | 'bee'
  | 'cat'
  | 'archer'
  | 'spiderling'
  | 'calf'
  | 'fawn'
  | 'lizard'
  | 'frog'
  | 'camel'
  | 'camel_calf'
  | 'seal'
  | 'monkey'
  | 'jellyfish'
  | 'deer'
  | 'roe_deer'
  | 'moose'
  | 'hedgehog'
  | 'tumbleweed';

/**
 * Baby scale factors are relative to each species' full model size. Fawns now start at 70% (twice
 * the former 35% minimum), and growth progress is clamped so no fawn can render below that floor.
 */
export const FAWN_NEWBORN_SCALE = 0.7;
export function babyGrowthScale(id: MobId, progress: number): number {
  const newbornScale = id === 'calf' ? 0.65 : id === 'fawn' ? FAWN_NEWBORN_SCALE : 0.35;
  // Only fawns need the new lower bound; leave other species' existing growth curve unchanged.
  const normalizedProgress = id === 'fawn' ? Math.max(0, Math.min(1, progress)) : progress;
  return newbornScale + (1 - newbornScale) * normalizedProgress;
}

export type MobDef = {
  id: MobId;
  nameKey: TKey;
  hostile: boolean;
  hp: number;
  speed: number;
  damage: number;
  /** attack cooldown in seconds */
  cooldown: number;
  /** reach in blocks */
  reach: number;
  /** burns when the sun is up */
  burns: boolean;
  scale: number;
  score: number;
  level: number;
  body: string;
  accent: string;
  legs: string;
  /** creeper-style detonation */
  explodes?: boolean;
  /** lives in water */
  aquatic?: boolean;
  /** shoots arrows instead of melee */
  ranged?: boolean;
};

export const MOBS: Record<MobId, MobDef> = {
  pig: { id: 'pig', nameKey: 'mob_pig', hostile: false, hp: 10, speed: 1.5, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.9, score: 18, level: 0, body: '#eaa0a8', accent: '#f4bcc2', legs: '#c9757f' },
  sheep: { id: 'sheep', nameKey: 'mob_sheep', hostile: false, hp: 10, speed: 1.4, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.95, score: 20, level: 0, body: '#e9e6dd', accent: '#d8c8b4', legs: '#5a4c42' },
  cow: { id: 'cow', nameKey: 'mob_cow', hostile: false, hp: 18, speed: 1.25, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 1.25, score: 26, level: 0, body: '#f4f5f8', accent: '#222226', legs: '#1c1c20' },
  calf: { id: 'calf', nameKey: 'mob_calf', hostile: false, hp: 8, speed: 1.6, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.82, score: 14, level: 0, body: '#f4f5f8', accent: '#222226', legs: '#1c1c20' },
  fawn: { id: 'fawn', nameKey: 'mob_fawn', hostile: false, hp: 8, speed: 3.0, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.72, score: 18, level: 0, body: '#b9854f', accent: '#f2d8ae', legs: '#604230' },
  lizard: { id: 'lizard', nameKey: 'mob_lizard', hostile: false, hp: 4, speed: 3.8, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.65, score: 12, level: 0, body: '#74a95e', accent: '#b5cb7b', legs: '#4b7a43' },
  frog: { id: 'frog', nameKey: 'mob_frog', hostile: false, hp: 5, speed: 2.2, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.58, score: 14, level: 0, body: '#5f9c3f', accent: '#e5c878', legs: '#3d6c2e' },
  chicken: { id: 'chicken', nameKey: 'mob_chicken', hostile: false, hp: 6, speed: 1.7, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.6, score: 12, level: 0, body: '#f2efe6', accent: '#e2483a', legs: '#f3b942' },
  zombie: { id: 'zombie', nameKey: 'mob_zombie', hostile: true, hp: 22, speed: 2.25, damage: 7, cooldown: 1.1, reach: 1.5, burns: true, scale: 1, score: 120, level: 1, body: '#4a8a4a', accent: '#3d6fa8', legs: '#2f4f7a' },
  skeleton: { id: 'skeleton', nameKey: 'mob_skeleton', hostile: true, hp: 18, speed: 2.5, damage: 6, cooldown: 0.85, reach: 1.6, burns: true, scale: 1, score: 150, level: 2, body: '#d8d6cc', accent: '#b6b3a8', legs: '#c2bfb4' },
  spider: { id: 'spider', nameKey: 'mob_spider', hostile: true, hp: 16, speed: 3.3, damage: 5, cooldown: 0.7, reach: 1.5, burns: true, scale: 0.95, score: 140, level: 2, body: '#3a2320', accent: '#c4342a', legs: '#2a1a17' },
  spiderling: { id: 'spiderling', nameKey: 'mob_spider', hostile: true, hp: 5, speed: 3.6, damage: 1, cooldown: 0.9, reach: 1.2, burns: true, scale: 0.4, score: 40, level: 0, body: '#3a2320', accent: '#c4342a', legs: '#2a1a17' },
  creeper: { id: 'creeper', nameKey: 'mob_creeper', hostile: true, hp: 20, speed: 2.45, damage: 26, cooldown: 3, reach: 2.2, burns: true, scale: 1, score: 220, level: 3, body: '#5ac45a', accent: '#2f6b2f', legs: '#4aa84a', explodes: true },
  trader: { id: 'trader', nameKey: 'mob_trader', hostile: false, hp: 9999, speed: 1.2, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 1, score: 0, level: 0, body: '#7a4bb8', accent: '#c9a24a', legs: '#4a2c80' },
  camel: { id: 'camel', nameKey: 'mob_camel', hostile: false, hp: 24, speed: 1.3, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 1.05, score: 34, level: 0, body: '#c9a26a', accent: '#e3bb82', legs: '#9c764b' },
  camel_calf: { id: 'camel_calf', nameKey: 'mob_camel_calf', hostile: false, hp: 12, speed: 1.8, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.72, score: 18, level: 0, body: '#d8ad6a', accent: '#f0cf91', legs: '#a47743' },
  seal: { id: 'seal', nameKey: 'mob_seal', hostile: false, hp: 16, speed: 1.5, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.9, score: 28, level: 0, body: '#83949a', accent: '#b9c8c9', legs: '#596972', aquatic: true },
  monkey: { id: 'monkey', nameKey: 'mob_monkey', hostile: false, hp: 10, speed: 2.6, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.72, score: 23, level: 0, body: '#8b6444', accent: '#d3a97c', legs: '#674729' },
  deer: { id: 'deer', nameKey: 'mob_deer', hostile: false, hp: 14, speed: 2.8, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 1.05, score: 30, level: 0, body: '#a8794f', accent: '#d7bd91', legs: '#594332' },
  roe_deer: { id: 'roe_deer', nameKey: 'mob_roe_deer', hostile: false, hp: 10, speed: 3.2, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.8, score: 24, level: 0, body: '#b78355', accent: '#e2c897', legs: '#594332' },
  moose: { id: 'moose', nameKey: 'mob_moose', hostile: false, hp: 26, speed: 2.0, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 1.6, score: 46, level: 0, body: '#70513d', accent: '#ad8968', legs: '#49392e' },
  tumbleweed: { id: 'tumbleweed', nameKey: 'mob_tumbleweed', hostile: false, hp: 1, speed: 2.35, damage: 0, cooldown: 1, reach: 0.5, burns: false, scale: 0.68, score: 0, level: 0, body: '#cfa866', accent: '#e6c98a', legs: '#a47e46' },
  hedgehog: { id: 'hedgehog', nameKey: 'mob_hedgehog', hostile: false, hp: 7, speed: 1.5, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.48, score: 18, level: 0, body: '#8d6747', accent: '#e4c9a3', legs: '#574234' },
  jellyfish: { id: 'jellyfish', nameKey: 'mob_jellyfish', hostile: false, hp: 4, speed: 1.1, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.7, score: 13, level: 0, body: '#d38cdd', accent: '#f5b9f0', legs: '#b674cb', aquatic: true },
  fish: { id: 'fish', nameKey: 'mob_fish', hostile: false, hp: 4, speed: 1.8, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.5, score: 14, level: 0, body: '#5e9cd8', accent: '#f4c842', legs: '#3f6ea8', aquatic: true },
  crab: { id: 'crab', nameKey: 'mob_crab', hostile: false, hp: 8, speed: 1.9, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.62, score: 22, level: 0, body: '#d85a3a', accent: '#f2836a', legs: '#a83c22' },
  turtle: { id: 'turtle', nameKey: 'mob_turtle', hostile: false, hp: 16, speed: 0.8, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.8, score: 30, level: 0, body: '#4d8c5a', accent: '#7ab88a', legs: '#3a6a44' },
  rabbit: { id: 'rabbit', nameKey: 'mob_rabbit', hostile: false, hp: 5, speed: 2.6, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.55, score: 16, level: 0, body: '#a8825a', accent: '#e8d8c4', legs: '#8a6a48' },
  penguin: { id: 'penguin', nameKey: 'mob_penguin', hostile: false, hp: 10, speed: 1.3, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.7, score: 24, level: 0, body: '#22262e', accent: '#f2f4f8', legs: '#f4a83a' },
  bird: { id: 'bird', nameKey: 'mob_bird', hostile: false, hp: 3, speed: 2.2, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.42, score: 12, level: 0, body: '#4d7dd8', accent: '#f4c842', legs: '#3a5ca8', aquatic: false },
  bee: { id: 'bee', nameKey: 'mob_bee', hostile: false, hp: 3, speed: 1.9, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.32, score: 10, level: 0, body: '#f4c032', accent: '#2a2a30', legs: '#c8d8ee' },
  cat: { id: 'cat', nameKey: 'mob_cat', hostile: false, hp: 12, speed: 3.0, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.7, score: 26, level: 0, body: '#c89a5a', accent: '#e8d0a8', legs: '#a87c42' },
  archer: { id: 'archer', nameKey: 'mob_archer', hostile: true, hp: 16, speed: 2.3, damage: 6, cooldown: 2.2, reach: 15, burns: true, scale: 1, score: 170, level: 2, body: '#d8d6cc', accent: '#8a6a3c', legs: '#c2bfb4', ranged: true },
};

export const HOSTILES: MobId[] = ['zombie', 'skeleton', 'spider', 'creeper'];
export const PASSIVES: MobId[] = ['pig', 'sheep', 'cow', 'chicken'];

export type MobThreatTarget = { id: string; x: number; y: number; z: number };

/** Collision body supplied by the player (or a local companion) while mobs move. */
export type MobCollisionBody = {
  x: number;
  y: number;
  z: number;
  halfX: number;
  halfZ: number;
  height: number;
};

export type Mob = {
  id: MobId;
  def: MobDef;
  group: THREE.Group;
  head: THREE.Object3D | null;
  legParts: THREE.Object3D[];
  mats: THREE.MeshLambertMaterial[];
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  /** One centered billboard bar; local model-space top keeps it anchored over every species. */
  healthBarFill: THREE.Sprite | null;
  healthBarTimer: number;
  healthBarTop: number;
  onGround: boolean;
  /** wander target */
  tx: number;
  tz: number;
  think: number;
  cd: number;
  /** seconds of burning left */
  burn: number;
  burnTick: number;
  /** seconds of slow left */
  slow: number;
  hurtFlash: number;
  walkPhase: number;
  fuse: number;
  alive: boolean;
  jumpCd: number;
  /** arrows lodged in this mob — they drop back out when it dies */
  stuckArrows: number;
  /** seconds left until a baby reaches adult size (0 = grown) */
  grow: number;
  /** air supply for land animals caught in water */
  drown: number;
  /** tucked away inside a hive/shelter — mesh hidden, physics frozen */
  hidden: boolean;
  /** turtle: 0..1 how far head/legs are pulled into the shell */
  shellT: number;
  /** crab: >0 while buried in sand */
  buried: number;
  /** bird colour/proportion variant index (assigned at spawn) */
  variant: number;
  /** size multiplier for bird / fish models and collision boxes */
  modelSize: number;
  /** Unscaled local model bounds used for body-vs-world and body-vs-mob collisions. */
  collisionHalf: number;
  collisionHeight: number;
  /** parts hidden when a turtle retreats into its shell */
  retractParts: THREE.Object3D[];
  /** generic AI task state (bees: 0 roam, 1 pollinating, 2 flying to hive) */
  task: number;
  taskX: number;
  taskY: number;
  taskZ: number;
  taskT: number;
  forageCd: number;
  drinkCd: number;
  /** elapsed seconds of the current bite animation */
  feedClock: number;
  /** the plant that was present when chewing began */
  feedFoodId: number;
  /** animated lower jaw on grazing species */
  feedJaw: THREE.Object3D | null;
  /** torso pivot animated with the feeding reach */
  feedBody: THREE.Object3D | null;
};

const GRAV = 26;
const CHEW_SECONDS = 4.6;

function box(w: number, h: number, d: number, color: string, mats: THREE.MeshLambertMaterial[]) {
  const m = new THREE.MeshLambertMaterial({ color });
  mats.push(m);
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}

/** tiny detail cube (eyes, noses) */
function px2(g: THREE.Group, mats: THREE.MeshLambertMaterial[], x: number, y: number, z: number, color: string) {
  const m = box(0.06, 0.06, 0.05, color, mats);
  m.position.set(x, y, z);
  g.add(m);
}

type PatchFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/** flat coat markings: visually texture-like, not chunky raised cubes */
function coatPatch(
  g: THREE.Group,
  mats: THREE.MeshLambertMaterial[],
  face: PatchFace,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  color: string,
  tag?: string,
) {
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  mats.push(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  if (face === 'left' || face === 'right') mesh.rotation.y = Math.PI / 2;
  else if (face === 'top' || face === 'bottom') mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  if (tag) mesh.userData[tag] = true;
  mesh.userData.coatPatch = true;
  g.add(mesh);
  return mesh;
}

/** Proportions distinguish clownfish, pike, crucian carp, minnows and tiny fry. */
const FISH_VARIANTS = [
  { body: '#ed8231', fin: '#332e38', belly: '#fff4dc', size: 1.05, length: 1, girth: 1.1, dorsal: 1 }, // clownfish
  { body: '#738953', fin: '#405b39', belly: '#b8bf80', size: 1.5, length: 1.8, girth: 0.62, dorsal: 0.7 }, // pike
  { body: '#d5a648', fin: '#997048', belly: '#ebd394', size: 1.35, length: 1.05, girth: 1.5, dorsal: 1.3 }, // crucian carp
  { body: '#8299a8', fin: '#586e7c', belly: '#c4d0ce', size: 0.7, length: 1.15, girth: 0.65, dorsal: 0.65 }, // minnow
  { body: '#a6c6bc', fin: '#799e9c', belly: '#d4dfd1', size: 0.43, length: 0.75, girth: 0.6, dorsal: 0.6 }, // fry
] as const;

/** blocky Minecraft-ish silhouettes assembled from boxes */
function buildBody(def: MobDef): { group: THREE.Group; head: THREE.Object3D | null; legs: THREE.Object3D[]; mats: THREE.MeshLambertMaterial[] } {
  const g = new THREE.Group();
  const mats: THREE.MeshLambertMaterial[] = [];
  const legs: THREE.Object3D[] = [];
  let head: THREE.Object3D | null = null;

  if (def.id === 'spider' || def.id === 'spiderling') {
    const body = box(0.78, 0.42, 0.92, def.body, mats);
    body.position.y = 0.42;
    g.add(body);
    const hd = box(0.5, 0.4, 0.44, def.body, mats);
    hd.position.set(0, 0.46, -0.62);
    g.add(hd);
    head = hd;
    for (const eyeX of [-0.12, 0.12]) {
      const eye = box(0.1, 0.1, 0.06, def.accent, mats);
      eye.position.set(eyeX, 0.56, -0.84);
      g.add(eye);
    }
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const leg = new THREE.Group();
        const seg = box(0.11, 0.11, 0.62, def.legs, mats);
        seg.position.z = 0.0;
        seg.rotation.y = s * 1.15;
        leg.add(seg);
        leg.position.set(s * 0.4, 0.34, -0.3 + i * 0.26);
        g.add(leg);
        legs.push(leg);
      }
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'fish') {
    const body = box(0.3, 0.3, 0.6, def.body, mats);
    body.position.y = 0.31;
    body.userData.fishBody = true;
    g.add(body);
    const tailJoint = new THREE.Group();
    const tail = box(0.07, 0.25, 0.22, def.legs, mats);
    tail.position.z = 0.09;
    tailJoint.add(tail);
    tailJoint.position.set(0, 0.31, 0.27);
    g.add(tailJoint);
    legs.push(tailJoint);
    const fin = box(0.07, 0.16, 0.22, def.legs, mats);
    fin.position.set(0, 0.53, 0);
    fin.userData.fishDorsal = true;
    g.add(fin);
    for (const s of [-1, 1]) {
      const sideFin = box(0.11, 0.06, 0.16, def.legs, mats);
      sideFin.position.set(s * 0.16, 0.25, 0.09);
      sideFin.userData.fishSideFin = true;
      g.add(sideFin);
      const eye = box(0.055, 0.055, 0.055, '#18252a', mats);
      eye.position.set(s * 0.16, 0.37, -0.22);
      eye.userData.fishEye = true;
      g.add(eye);
    }
    return { group: g, head: null, legs, mats };
  }

  if (def.id === 'jellyfish') {
    const bell = box(0.55, 0.24, 0.55, def.body, mats);
    bell.position.y = 0.55;
    g.add(bell);
    const crown = box(0.36, 0.12, 0.38, def.accent, mats);
    crown.position.y = 0.71;
    g.add(crown);
    for (const s of [-1, 1]) for (const z of [-0.17, 0.17]) {
      const tentacle = box(0.05, 0.42, 0.05, def.legs, mats);
      tentacle.position.set(s * 0.18, 0.27, z);
      g.add(tentacle);
      legs.push(tentacle);
    }
    return { group: g, head: null, legs, mats };
  }

  if (def.id === 'crab') {
    const body = box(0.7, 0.28, 0.5, def.body, mats);
    body.position.y = 0.22;
    g.add(body);
    for (const s of [-1, 1]) {
      const claw = box(0.22, 0.18, 0.26, def.accent, mats);
      claw.position.set(s * 0.44, 0.24, -0.3);
      g.add(claw);
      for (let i = 0; i < 3; i++) {
        const leg = box(0.07, 0.2, 0.07, def.legs, mats);
        leg.position.set(s * 0.4, 0.1, -0.1 + i * 0.16);
        g.add(leg);
        legs.push(leg);
      }
      const eye = box(0.06, 0.12, 0.06, '#20301f', mats);
      eye.position.set(s * 0.12, 0.44, -0.2);
      g.add(eye);
    }
    return { group: g, head: null, legs, mats };
  }

  if (def.id === 'turtle') {
    const shell = box(0.8, 0.3, 0.95, def.body, mats);
    shell.position.y = 0.34;
    g.add(shell);
    const shellTop = box(0.55, 0.16, 0.7, def.accent, mats);
    shellTop.position.y = 0.52;
    g.add(shellTop);
    const hd = box(0.26, 0.22, 0.3, def.legs, mats);
    hd.position.set(0, 0.3, -0.62);
    g.add(hd);
    head = hd;
    // friendly turtle face: round eyes on the sides of the head + tiny beak
    for (const s of [-1, 1]) {
      const eyeW = box(0.06, 0.08, 0.08, '#e8ecdf', mats);
      eyeW.position.set(s * 0.15, 0.35, -0.68);
      g.add(eyeW);
      px2(g, mats, s * 0.17, 0.35, -0.72, '#20301f');
    }
    px2(g, mats, 0, 0.26, -0.79, '#3a5a34'); // beak/nose tip
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = box(0.18, 0.16, 0.24, def.legs, mats);
        leg.position.set(sx * 0.36, 0.12, sz * 0.34);
        g.add(leg);
        legs.push(leg);
      }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'penguin') {
    // upright oval body, white belly, tiny flippers, orange beak & feet
    const body = box(0.5, 0.72, 0.44, def.body, mats);
    body.position.y = 0.52;
    g.add(body);
    const belly = box(0.34, 0.5, 0.1, def.accent, mats);
    belly.position.set(0, 0.48, -0.2);
    g.add(belly);
    const hd = box(0.36, 0.3, 0.34, def.body, mats);
    hd.position.set(0, 1.02, 0);
    g.add(hd);
    head = hd;
    const beak = box(0.1, 0.08, 0.16, def.legs, mats);
    beak.position.set(0, 0.98, -0.24);
    g.add(beak);
    for (const s of [-1, 1]) {
      px2(g, mats, s * 0.1, 1.06, -0.18, '#ffffff');
      const flipper = box(0.08, 0.4, 0.2, def.body, mats);
      flipper.position.set(s * 0.31, 0.55, 0);
      flipper.rotation.z = s * 0.12;
      g.add(flipper);
      legs.push(flipper); // flippers waddle like legs
      const foot = box(0.14, 0.06, 0.2, def.legs, mats);
      foot.position.set(s * 0.13, 0.03, -0.04);
      g.add(foot);
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'bird') {
    // Jungle birds are Minecraft-like parrots: blocky head, hooked beak, crest and long tail.
    const body = box(0.32, 0.3, 0.42, def.body, mats);
    body.position.y = 0.32;
    body.userData.birdBody = true;
    g.add(body);
    const chest = box(0.22, 0.22, 0.035, def.accent, mats);
    chest.position.set(0, 0.31, -0.225);
    chest.userData.birdChest = true;
    g.add(chest);
    const hd = box(0.25, 0.24, 0.23, def.body, mats);
    hd.position.set(0, 0.54, -0.2);
    hd.userData.birdBody = true;
    g.add(hd);
    head = hd;
    const face = box(0.18, 0.12, 0.035, '#f3e6c6', mats);
    face.position.set(0, 0.53, -0.335);
    face.userData.parrotFace = true;
    g.add(face);
    const upperBeak = box(0.075, 0.06, 0.13, '#f4a83a', mats);
    upperBeak.position.set(0, 0.51, -0.42);
    upperBeak.rotation.x = -0.08;
    g.add(upperBeak);
    const lowerBeak = box(0.055, 0.035, 0.07, '#5c3a2a', mats);
    lowerBeak.position.set(0, 0.465, -0.39);
    g.add(lowerBeak);
    const crest = box(0.08, 0.18, 0.07, def.legs, mats);
    crest.position.set(0, 0.72, -0.18);
    crest.rotation.x = -0.35;
    crest.userData.parrotCrest = true;
    g.add(crest);
    const tail = box(0.16, 0.06, 0.38, def.legs, mats);
    tail.position.set(0, 0.33, 0.42);
    tail.rotation.x = 0.52;
    tail.userData.birdTail = true;
    g.add(tail);
    const tail2 = box(0.1, 0.045, 0.32, def.accent, mats);
    tail2.position.set(0, 0.3, 0.5);
    tail2.rotation.x = 0.52;
    tail2.userData.birdChest = true;
    g.add(tail2);
    for (const s of [-1, 1]) {
      // Pivot at the shoulder, not at the centre of the feather: the whole
      // wing lifts and lowers instead of spinning in place like a leg.
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.15, 0.38, 0);
      const wing = box(0.32, 0.05, 0.28, def.legs, mats);
      wing.position.x = s * 0.15;
      wing.userData.birdWing = true;
      shoulder.add(wing);
      g.add(shoulder);
      legs.push(shoulder);
      px2(g, mats, s * 0.075, 0.57, -0.335, '#20301f');
      const cheek = box(0.055, 0.055, 0.02, def.accent, mats);
      cheek.position.set(s * 0.085, 0.5, -0.36);
      cheek.userData.birdChest = true;
      g.add(cheek);
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'cat') {
    // domestic Minecraft-like cat: sleek body, pointed ears, raised tail, flat coat pattern
    const body = box(0.4, 0.36, 0.86, def.body, mats);
    body.position.y = 0.5;
    g.add(body);
    const hd = box(0.36, 0.32, 0.34, def.body, mats);
    hd.position.set(0, 0.74, -0.52);
    g.add(hd);
    head = hd;
    for (const s of [-1, 1]) {
      const ear = box(0.1, 0.14, 0.06, def.body, mats);
      ear.position.set(s * 0.11, 0.96, -0.5);
      g.add(ear);
      const tuft = box(0.04, 0.08, 0.04, '#2a2a30', mats);
      tuft.position.set(s * 0.11, 1.06, -0.5);
      g.add(tuft);
      px2(g, mats, s * 0.1, 0.78, -0.7, '#3a5a2a'); // green eyes
    }
    const muzzle = box(0.18, 0.12, 0.08, def.accent, mats);
    muzzle.position.set(0, 0.68, -0.7);
    g.add(muzzle);
    // Keep the tail rooted inside the rump (body ends at z=0.43) and
    // overlap each section with the next so the raised tip stays attached.
    const tailRoot = box(0.12, 0.12, 0.48, def.body, mats);
    tailRoot.position.set(0, 0.54, 0.6); // z=0.36..0.84, inside the body
    g.add(tailRoot);
    const tailBend = box(0.12, 0.12, 0.34, def.body, mats);
    tailBend.position.set(0, 0.63, 0.85);
    tailBend.rotation.x = -0.8; // negative x raises the tail toward +z
    g.add(tailBend);
    const tailTip = box(0.12, 0.12, 0.2, '#2a2a30', mats);
    tailTip.position.set(0, 0.76, 0.95);
    tailTip.rotation.x = -0.8;
    g.add(tailTip);
    // flat coat markings on the flanks/back — reads like texture, not armour plates
    coatPatch(g, mats, 'right', 0.205, 0.58, -0.12, 0.24, 0.18, '#8a6a3a', 'catPatch');
    coatPatch(g, mats, 'left', -0.205, 0.55, 0.16, 0.28, 0.16, '#8a6a3a', 'catPatch');
    coatPatch(g, mats, 'top', 0.04, 0.685, 0.22, 0.18, 0.24, '#8a6a3a', 'catPatch');
    coatPatch(g, mats, 'front', 0.1, 0.82, -0.69, 0.09, 0.1, '#8a6a3a', 'catPatch');
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = box(0.13, 0.36, 0.13, def.legs, mats);
        leg.position.set(sx * 0.14, 0.18, sz * 0.3);
        g.add(leg);
        legs.push(leg);
      }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'bee') {
    // striped fuzzball with translucent-ish wings
    const body = box(0.34, 0.28, 0.44, def.body, mats);
    body.position.y = 0.4;
    g.add(body);
    for (const zz of [-0.06, 0.12]) {
      const stripe = box(0.36, 0.3, 0.08, def.accent, mats);
      stripe.position.set(0, 0.4, zz);
      g.add(stripe);
    }
    const sting = box(0.05, 0.05, 0.1, def.accent, mats);
    sting.position.set(0, 0.38, 0.28);
    g.add(sting);
    for (const s of [-1, 1]) {
      px2(g, mats, s * 0.1, 0.48, -0.24, '#20301f');
      const wing = box(0.2, 0.04, 0.14, def.legs, mats);
      wing.position.set(s * 0.2, 0.56, 0.02);
      wing.rotation.z = s * 0.25;
      g.add(wing);
      legs.push(wing); // wings buzz via leg channel
    }
    return { group: g, head: null, legs, mats };
  }

  if (def.id === 'rabbit') {
    const body = box(0.38, 0.34, 0.52, def.body, mats);
    body.position.y = 0.28;
    g.add(body);
    const hd = box(0.3, 0.28, 0.28, def.body, mats);
    hd.position.set(0, 0.5, -0.32);
    g.add(hd);
    head = hd;
    // long ears
    for (const s of [-1, 1]) {
      const ear = box(0.08, 0.3, 0.06, def.body, mats);
      ear.position.set(s * 0.09, 0.78, -0.3);
      ear.rotation.x = -0.15;
      ear.rotation.z = s * 0.12;
      g.add(ear);
      const earIn = box(0.04, 0.2, 0.04, def.accent, mats);
      earIn.position.set(s * 0.09, 0.78, -0.33);
      g.add(earIn);
    }
    // fluffy tail
    const tail = box(0.12, 0.12, 0.12, def.accent, mats);
    tail.position.set(0, 0.3, 0.3);
    g.add(tail);
    // flat side markings support spotted, Dutch and hare colour variants
    coatPatch(g, mats, 'right', 0.195, 0.34, 0.02, 0.18, 0.12, '#8a6a48', 'rabbitPatch');
    coatPatch(g, mats, 'left', -0.195, 0.31, 0.16, 0.16, 0.11, '#8a6a48', 'rabbitPatch');
    coatPatch(g, mats, 'front', 0.08, 0.52, -0.463, 0.08, 0.07, '#8a6a48', 'rabbitPatch');
    // nose + eyes
    px2(g, mats, 0, 0.46, -0.48, '#3a2a20');
    for (const s of [-1, 1]) px2(g, mats, s * 0.1, 0.54, -0.44, '#20301f');
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = box(0.1, 0.18, 0.12, def.legs, mats);
        leg.position.set(sx * 0.12, 0.09, sz * 0.18);
        g.add(leg);
        legs.push(leg);
      }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'frog') {
    const body = box(0.52, 0.28, 0.62, def.body, mats);
    body.position.y = 0.22; body.userData.frogBody = true; g.add(body);
    const belly = box(0.36, 0.08, 0.42, def.accent, mats);
    belly.position.set(0, 0.12, -0.04); g.add(belly);
    const hd = box(0.48, 0.26, 0.36, def.body, mats);
    hd.position.set(0, 0.36, -0.38); hd.userData.frogBody = true; g.add(hd); head = hd;
    const mouth = box(0.34, 0.035, 0.04, '#2e3b24', mats);
    mouth.position.set(0, 0.31, -0.58); g.add(mouth);
    for (const side of [-1, 1]) {
      const eyeBase = box(0.16, 0.13, 0.14, def.body, mats);
      eyeBase.position.set(side * 0.17, 0.54, -0.42); g.add(eyeBase);
      const eyeWhite = box(0.11, 0.09, 0.035, '#f4f1d8', mats);
      eyeWhite.position.set(side * 0.17, 0.55, -0.5); g.add(eyeWhite);
      const pupil = box(0.07, 0.07, 0.04, '#1a1820', mats);
      pupil.position.set(side * 0.17, 0.55, -0.525); g.add(pupil);
      const fore = box(0.12, 0.14, 0.18, def.legs, mats);
      fore.position.set(side * 0.2, 0.08, -0.25); g.add(fore); legs.push(fore);
      const hind = box(0.18, 0.13, 0.28, def.legs, mats);
      hind.position.set(side * 0.22, 0.07, 0.22); g.add(hind); legs.push(hind);
      const foot = box(0.24, 0.04, 0.18, def.legs, mats);
      foot.position.set(side * 0.26, 0.02, -0.37); g.add(foot);
      const rearFoot = box(0.28, 0.04, 0.2, def.legs, mats);
      rearFoot.position.set(side * 0.27, 0.02, 0.38); g.add(rearFoot);
    }
    coatPatch(g, mats, 'top', -0.12, 0.365, 0.08, 0.18, 0.22, '#3f7830', 'frogPatch');
    coatPatch(g, mats, 'top', 0.13, 0.365, -0.08, 0.16, 0.18, '#78b857', 'frogPatch');
    return { group: g, head, legs, mats };
  }

  if (def.id === 'lizard') {
    // Low, fast ground-dweller with a continuous tapering tail.
    const body = box(0.32, 0.18, 0.54, def.body, mats);
    body.position.y = 0.18;
    g.add(body);
    const hd = box(0.29, 0.16, 0.26, def.body, mats);
    hd.position.set(0, 0.21, -0.36);
    g.add(hd);
    head = hd;
    const jaw = box(0.22, 0.06, 0.16, def.accent, mats);
    jaw.position.set(0, 0.13, -0.44);
    g.add(jaw);
    for (const s of [-1, 1]) {
      px2(g, mats, s * 0.1, 0.27, -0.49, '#202c1c');
      for (const z of [-0.16, 0.18]) {
        const leg = box(0.08, 0.12, 0.12, def.legs, mats);
        leg.position.set(s * 0.17, 0.08, z);
        g.add(leg);
        legs.push(leg);
      }
    }
    const tail = box(0.13, 0.12, 0.34, def.body, mats);
    tail.position.set(0, 0.17, 0.35);
    g.add(tail);
    const tip = box(0.09, 0.08, 0.28, def.body, mats);
    tip.position.set(0, 0.17, 0.61);
    g.add(tip);
    return { group: g, head, legs, mats };
  }

  if (def.id === 'camel' || def.id === 'camel_calf') {
    const baby = def.id === 'camel_calf';
    const torso = box(baby ? 0.58 : 0.76, baby ? 0.48 : 0.64, baby ? 0.92 : 1.26, def.body, mats);
    torso.userData.grazeBody = true;
    torso.position.y = baby ? 0.82 : 1.06; g.add(torso);
    const frontHump = box(baby ? 0.32 : 0.42, baby ? 0.18 : 0.34, baby ? 0.24 : 0.34, def.accent, mats);
    frontHump.position.set(0, baby ? 1.13 : 1.47, baby ? -0.05 : -0.16); frontHump.userData.camelHump = true; g.add(frontHump);
    const rearHump = box(baby ? 0.3 : 0.42, baby ? 0.15 : 0.34, baby ? 0.22 : 0.34, def.accent, mats);
    rearHump.position.set(0, baby ? 1.12 : 1.47, baby ? 0.2 : 0.24); rearHump.userData.camelRearHump = true; rearHump.userData.camelHump = true; g.add(rearHump);
    // lighter, flat coat accents on neck/flank like pixel texture patches
    coatPatch(g, mats, 'right', baby ? 0.292 : 0.382, baby ? 0.88 : 1.12, -0.18, baby ? 0.32 : 0.46, baby ? 0.18 : 0.24, '#e6c184', 'camelPatch');
    coatPatch(g, mats, 'left', baby ? -0.292 : -0.382, baby ? 0.8 : 1.02, 0.28, baby ? 0.28 : 0.42, baby ? 0.16 : 0.22, '#b9854b', 'camelPatch');
    const neck = box(baby ? 0.2 : 0.25, baby ? 0.62 : 0.92, baby ? 0.22 : 0.27, def.body, mats);
    neck.position.set(0, baby ? 1.22 : 1.62, baby ? -0.42 : -0.54); g.add(neck);
    const hd = box(baby ? 0.31 : 0.4, baby ? 0.25 : 0.32, baby ? 0.38 : 0.48, def.body, mats);
    hd.position.set(0, baby ? 1.58 : 2.1, baby ? -0.58 : -0.74); g.add(hd); head = hd;
    const muzzle = box(baby ? 0.23 : 0.29, baby ? 0.13 : 0.16, baby ? 0.22 : 0.27, def.accent, mats);
    muzzle.position.set(0, baby ? 1.49 : 1.98, baby ? -0.81 : -1.02); g.add(muzzle);
    const lip = box(baby ? 0.2 : 0.24, 0.05, 0.08, def.legs, mats);
    lip.position.set(0, baby ? 1.43 : 1.91, baby ? -0.93 : -1.16); g.add(lip);
    for (const side of [-1, 1]) {
      px2(g, mats, side * (baby ? 0.13 : 0.18), baby ? 1.62 : 2.17, baby ? -0.8 : -0.94, '#38281c');
      const ear = box(baby ? 0.075 : 0.09, baby ? 0.15 : 0.21, 0.08, def.body, mats);
      ear.position.set(side * (baby ? 0.16 : 0.22), baby ? 1.79 : 2.33, baby ? -0.47 : -0.56); ear.rotation.z = side * 0.18; g.add(ear);
      for (const z of [baby ? -0.28 : -0.42, baby ? 0.28 : 0.42]) {
        const leg = box(baby ? 0.13 : 0.17, baby ? 0.58 : 0.82, baby ? 0.14 : 0.18, def.legs, mats);
        leg.position.set(side * (baby ? 0.19 : 0.25), baby ? 0.29 : 0.41, z); g.add(leg); legs.push(leg);
        const hoof = box(baby ? 0.15 : 0.2, 0.06, baby ? 0.16 : 0.21, '#6f4a2b', mats);
        hoof.position.set(side * (baby ? 0.19 : 0.25), 0.035, z - 0.02); g.add(hoof);
      }
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'seal') {
    const torso = box(0.62, 0.38, 0.97, def.body, mats);
    torso.position.y = 0.3; g.add(torso);
    const hd = box(0.5, 0.36, 0.43, def.body, mats);
    hd.position.set(0, 0.38, -0.58); g.add(hd); head = hd;
    const snout = box(0.28, 0.14, 0.18, def.accent, mats);
    snout.position.set(0, 0.31, -0.83); g.add(snout);
    for (const side of [-1, 1]) {
      px2(g, mats, side * 0.17, 0.46, -0.81, '#243038');
      const flipper = box(0.2, 0.09, 0.36, def.legs, mats);
      flipper.position.set(side * 0.34, 0.12, -0.09); g.add(flipper); legs.push(flipper);
      const rear = box(0.19, 0.07, 0.35, def.legs, mats);
      rear.position.set(side * 0.12, 0.16, 0.61); g.add(rear);
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'monkey') {
    const torso = box(0.38, 0.52, 0.34, def.body, mats);
    torso.position.y = 0.55; g.add(torso);
    const hd = box(0.43, 0.36, 0.38, def.body, mats);
    hd.position.set(0, 1.01, -0.07); g.add(hd); head = hd;
    const face = box(0.29, 0.23, 0.07, def.accent, mats);
    face.position.set(0, 0.98, -0.27); g.add(face);
    for (const side of [-1, 1]) {
      const ear = box(0.1, 0.14, 0.12, def.accent, mats);
      ear.position.set(side * 0.26, 1.06, -0.03); g.add(ear);
      px2(g, mats, side * 0.09, 1.04, -0.32, '#261e1b');
      const arm = box(0.12, 0.49, 0.13, def.legs, mats);
      arm.position.set(side * 0.29, 0.51, -0.08); g.add(arm); legs.push(arm);
      const foot = box(0.16, 0.3, 0.18, def.legs, mats);
      foot.position.set(side * 0.13, 0.16, 0.08); g.add(foot); legs.push(foot);
    }
    const tail = box(0.11, 0.11, 0.55, def.body, mats);
    tail.position.set(0, 0.65, 0.39); tail.rotation.x = -0.2; g.add(tail);
    const tailEnd = box(0.1, 0.24, 0.11, def.body, mats);
    tailEnd.position.set(0, 0.82, 0.65); g.add(tailEnd);
    return { group: g, head, legs, mats };
  }

  if (def.id === 'chicken') {
    const body = box(0.42, 0.42, 0.5, def.body, mats);
    body.position.y = 0.44;
    g.add(body);
    const hd = box(0.3, 0.32, 0.3, def.body, mats);
    hd.position.set(0, 0.76, -0.22);
    g.add(hd);
    head = hd;
    const beak = box(0.14, 0.1, 0.16, def.legs, mats);
    beak.position.set(0, 0.72, -0.42);
    g.add(beak);
    const comb = box(0.1, 0.14, 0.2, def.accent, mats);
    comb.position.set(0, 0.95, -0.2);
    g.add(comb);
    // beady chicken eyes on the sides of the head
    for (const s of [-1, 1]) px2(g, mats, s * 0.13, 0.8, -0.34, '#20301f');
    for (const s of [-1, 1]) {
      const leg = box(0.09, 0.28, 0.09, def.legs, mats);
      leg.position.set(s * 0.12, 0.14, 0);
      g.add(leg);
      legs.push(leg);
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'tumbleweed') {
    const roll = new THREE.Group();
    const hayShades = [def.accent, def.body, '#b89155', def.legs];
    // Airy, translucent dry-straw inner lattice so it reads as a hollow, weightless tumbleweed
    const wireMat = new THREE.MeshLambertMaterial({
      color: def.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.48,
    });
    roll.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), wireMat));
    const wispMat = new THREE.MeshLambertMaterial({
      color: def.body,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    roll.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), wispMat));

    // Three woven outer hoops of dry hay stems at intersecting angles
    for (let ring = 0; ring < 3; ring++) {
      const hoop = new THREE.Group();
      hoop.rotation.set(ring * 1.05 + 0.3, ring * 0.82, ring * 0.64);
      const segs = 8;
      const rad = 0.31;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const stem = box(0.028, 0.028, 0.26, hayShades[(ring + s) % hayShades.length], mats);
        stem.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0);
        stem.rotation.z = a + Math.PI * 0.5;
        hoop.add(stem);
      }
      roll.add(hoop);
    }

    // Criss-crossing dry straw twigs and forked tips
    for (let i = 0; i < 14; i++) {
      const col = hayShades[i % hayShades.length];
      const len = i % 2 === 0 ? 0.68 : 0.54;
      const twig = box(0.028, 0.032, len, col, mats);
      twig.rotation.set(i * 0.67 + 0.2, i * 1.13, i * 0.49);
      roll.add(twig);
    }
    roll.position.y = 0.35;
    g.add(roll);
    g.userData.roller = roll;
    return { group: g, head: null, legs, mats };
  }

  if (['deer', 'roe_deer', 'moose', 'fawn', 'hedgehog'].includes(def.id)) {
    const hedgehog = def.id === 'hedgehog';
    if (hedgehog) {
      const body = box(0.42, 0.35, 0.58, def.body, mats);
      body.position.y = 0.4; g.add(body);
      const neck = box(0.26, 0.22, 0.25, def.body, mats);
      neck.position.set(0, 0.4, -0.48); g.add(neck);
      const hd = box(0.28, 0.22, 0.38, def.accent, mats);
      hd.position.set(0, 0.44, -0.68); g.add(hd); head = hd;
      for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
        const spine = box(0.045, 0.18, 0.045, '#554436', mats);
        spine.position.set(side * (0.08 + (i % 3) * 0.07), 0.58, 0.24 - i * 0.07);
        spine.rotation.z = side * 0.28; g.add(spine);
      }
      for (const side of [-1, 1]) for (const z of [-0.32, 0.34]) {
        const leg = box(0.12, 0.2, 0.13, def.legs, mats);
        leg.position.set(side * 0.14, 0.12, z); g.add(leg); legs.push(leg);
      }
      return { group: g, head, legs, mats };
    }

    const moose = def.id === 'moose';
    const roe = def.id === 'roe_deer';
    const fawn = def.id === 'fawn';
    const body = box(fawn ? 0.46 : moose ? 0.84 : roe ? 0.52 : 0.62, fawn ? 0.44 : moose ? 0.78 : roe ? 0.56 : 0.64, fawn ? 0.78 : moose ? 1.42 : roe ? 0.9 : 1.06, def.body, mats);
    body.position.y = fawn ? 0.56 : moose ? 1.02 : roe ? 0.76 : 0.84;
    body.userData.grazeBody = true;
    body.userData.deerBody = true;
    g.add(body);

    const chest = box(fawn ? 0.38 : moose ? 0.62 : 0.45, fawn ? 0.32 : moose ? 0.58 : 0.46, fawn ? 0.28 : moose ? 0.46 : 0.34, fawn ? def.accent : def.body, mats);
    chest.position.set(0, fawn ? 0.66 : moose ? 1.08 : 0.9, fawn ? -0.44 : moose ? -0.62 : -0.48);
    chest.userData.deerBody = true;
    g.add(chest);

    const neck = box(fawn ? 0.22 : moose ? 0.36 : 0.28, fawn ? 0.44 : moose ? 0.78 : 0.62, fawn ? 0.23 : moose ? 0.34 : 0.29, def.body, mats);
    neck.position.set(0, fawn ? 0.84 : moose ? 1.28 : 1.08, fawn ? -0.56 : moose ? -0.68 : -0.58);
    neck.rotation.x = fawn ? -0.2 : -0.08;
    neck.userData.deerBody = true;
    g.add(neck);

    const headW = moose ? 0.44 : fawn ? 0.27 : roe ? 0.3 : 0.32;
    const headH = moose ? 0.36 : fawn ? 0.32 : roe ? 0.38 : 0.4;
    const headD = moose ? 0.5 : fawn ? 0.29 : roe ? 0.31 : 0.33;
    const headY = moose ? 1.57 : fawn ? 1.08 : roe ? 1.31 : 1.37;
    const headZ = moose ? -0.92 : fawn ? -0.72 : -0.78;
    const hd = box(headW, headH, headD, moose ? def.accent : def.body, mats);
    hd.position.set(0, headY, headZ);
    hd.userData.deerHead = true;
    g.add(hd); head = hd;

    if (moose) {
      // Moose face intentionally stays heavy and broad — user liked this one.
      const muzzle = box(0.33, 0.24, 0.5, def.accent, mats);
      muzzle.position.set(0, 1.43, -1.23);
      g.add(muzzle);
      const nose = box(0.24, 0.1, 0.08, '#49372c', mats);
      nose.position.set(0, 1.43, -1.52);
      g.add(nose);
      const throat = box(0.3, 0.34, 0.04, '#f0ddbd', mats);
      throat.position.set(0, 1.03, -0.86);
      g.add(throat);
      for (const side of [-1, 1]) {
        const eye = box(0.075, 0.075, 0.045, '#27231f', mats);
        eye.position.set(side * 0.19, 1.62, -1.13);
        g.add(eye);
        const ear = box(0.16, 0.18, 0.18, def.body, mats);
        ear.position.set(side * 0.33, 1.68, -0.75);
        ear.rotation.z = side * 0.34;
        ear.rotation.y = side * 0.1;
        g.add(ear);
      }
    } else {
      // Deer faces: narrow skull, short tapering muzzle, side-set eyes and tall leaf ears.
      // This removes the square, dog-like snout while staying blocky/Minecraft-like.
      const faceFront = headZ - headD / 2;
      coatPatch(g, mats, 'front', 0, headY - (fawn ? 0.02 : 0.03), faceFront - 0.004, fawn ? 0.13 : 0.15, fawn ? 0.22 : 0.27, def.accent, 'deerPatch');

      const snoutW = fawn ? 0.14 : roe ? 0.16 : 0.17;
      const snoutH = fawn ? 0.095 : roe ? 0.115 : 0.12;
      const snoutD = fawn ? 0.16 : roe ? 0.19 : 0.2;
      const muzzle = box(snoutW, snoutH, snoutD, def.accent, mats);
      muzzle.position.set(0, headY - (fawn ? 0.13 : 0.17), faceFront - snoutD * 0.5 + 0.01);
      muzzle.userData.deerHead = true;
      g.add(muzzle);

      const muzzleFront = muzzle.position.z - snoutD * 0.5 - 0.004;
      coatPatch(g, mats, 'front', 0, muzzle.position.y - snoutH * 0.24, muzzleFront, snoutW * 0.78, snoutH * 0.56, '#f0ddbd', 'deerPatch');
      coatPatch(g, mats, 'front', 0, muzzle.position.y + snoutH * 0.1, muzzleFront - 0.002, snoutW * 0.64, fawn ? 0.04 : 0.05, '#33231b', 'deerPatch');

      const neckFront = fawn ? -0.676 : -0.726;
      coatPatch(g, mats, 'front', 0, fawn ? 0.79 : roe ? 0.93 : 0.98, neckFront - 0.004, fawn ? 0.13 : 0.16, fawn ? 0.18 : 0.23, '#f0ddbd', 'deerPatch');

      for (const side of [-1, 1]) {
        const face: PatchFace = side < 0 ? 'left' : 'right';
        coatPatch(g, mats, face, side * (headW / 2 + 0.004), headY + (fawn ? 0.025 : 0.04), headZ - 0.055, fawn ? 0.055 : 0.065, fawn ? 0.07 : 0.078, '#231b16', 'deerEye');
        coatPatch(g, mats, face, side * (headW / 2 + 0.006), headY - (fawn ? 0.03 : 0.02), headZ - 0.1, 0.032, fawn ? 0.055 : 0.065, '#e7d4b5', 'deerPatch');

        const earH = fawn ? 0.31 : roe ? 0.34 : 0.36;
        const ear = box(fawn ? 0.07 : 0.08, earH, fawn ? 0.075 : 0.085, def.body, mats);
        ear.position.set(side * (headW * 0.62 + 0.1), headY + earH * 0.58, headZ + (fawn ? 0.02 : 0.01));
        ear.rotation.z = side * 0.28;
        ear.rotation.y = side * 0.18;
        ear.userData.deerHead = true;
        g.add(ear);
        const inner = box(fawn ? 0.034 : 0.04, earH * 0.58, 0.018, def.accent, mats);
        inner.position.set(side * (headW * 0.62 + 0.1), headY + earH * 0.58, headZ - 0.04);
        inner.rotation.z = side * 0.28;
        inner.rotation.y = side * 0.18;
        inner.userData.deerHead = true;
        g.add(inner);
      }
    }

    if (!fawn && !roe) {
      // Males get blocky Minecraft-like antlers: slim deer forks, broad moose paddles.
      // Roe deer are used as antlerless does to add the requested deer-family variety.
      const baseY = moose ? 1.76 : 1.62;
      const spread = moose ? 0.45 : 0.22;
      for (const side of [-1, 1]) {
        const beam = box(moose ? 0.12 : 0.065, moose ? 0.58 : 0.44, 0.075, '#d5c5a1', mats);
        beam.position.set(side * spread, baseY, moose ? -0.9 : -0.78);
        beam.rotation.z = side * (moose ? 0.42 : 0.24);
        g.add(beam);
        if (moose) {
          const palm = box(0.22, 0.36, 0.055, '#d5c5a1', mats);
          palm.position.set(side * (spread + 0.08), baseY + 0.12, -0.9);
          palm.rotation.z = side * 0.26;
          g.add(palm);
        }
        const tineCount = moose ? 3 : roe ? 1 : 3;
        for (let fork = 0; fork < tineCount; fork++) {
          const tine = box(moose ? 0.06 : 0.05, moose ? 0.28 : 0.22, 0.055, '#d5c5a1', mats);
          tine.position.set(side * (spread + (fork - 1) * (moose ? 0.1 : 0.08)), baseY + 0.17 + fork * 0.035, moose ? -0.88 : -0.76);
          tine.rotation.z = side * (fork === 0 ? -0.45 : 0.45);
          g.add(tine);
        }
      }
    }

    // Flat coat markings: white rump, fawn dots and flank patches are decals.
    coatPatch(g, mats, 'back', 0, fawn ? 0.66 : moose ? 1.12 : 0.86, fawn ? 0.392 : moose ? 0.71 : roe ? 0.45 : 0.53, fawn ? 0.28 : moose ? 0.38 : 0.3, fawn ? 0.22 : moose ? 0.28 : 0.24, '#f2e3c8', 'deerPatch');
    if (fawn) {
      const dot = '#f4e1bd';
      for (const face of ['left', 'right'] as PatchFace[]) {
        const sx = face === 'left' ? -0.232 : 0.232;
        coatPatch(g, mats, face, sx, 0.67, -0.1, 0.09, 0.08, dot, 'deerPatch');
        coatPatch(g, mats, face, sx, 0.62, 0.12, 0.08, 0.07, dot, 'deerPatch');
        coatPatch(g, mats, face, sx, 0.74, 0.24, 0.07, 0.07, dot, 'deerPatch');
      }
      coatPatch(g, mats, 'top', -0.1, 0.785, 0.04, 0.06, 0.08, dot, 'deerPatch');
      coatPatch(g, mats, 'top', 0.11, 0.785, 0.22, 0.07, 0.08, dot, 'deerPatch');
    } else if (!moose) {
      coatPatch(g, mats, 'right', 0.312, roe ? 0.8 : 0.89, -0.06, roe ? 0.22 : 0.26, 0.15, '#7b5337', 'deerPatch');
      coatPatch(g, mats, 'left', -0.312, roe ? 0.72 : 0.84, 0.18, roe ? 0.2 : 0.24, 0.14, '#c99b62', 'deerPatch');
    }

    const tail = box(fawn ? 0.1 : moose ? 0.16 : 0.12, fawn ? 0.12 : 0.16, fawn ? 0.12 : 0.14, '#f2e3c8', mats);
    tail.position.set(0, fawn ? 0.72 : moose ? 1.16 : 0.94, fawn ? 0.48 : moose ? 0.78 : 0.6);
    tail.rotation.x = -0.25;
    g.add(tail);

    for (const side of [-1, 1]) for (const z of [fawn ? -0.22 : moose ? -0.44 : -0.34, fawn ? 0.24 : moose ? 0.42 : 0.34]) {
      const leg = box(fawn ? 0.1 : moose ? 0.15 : 0.11, fawn ? 0.42 : moose ? 0.76 : 0.58, fawn ? 0.1 : moose ? 0.15 : 0.12, def.legs, mats);
      leg.position.set(side * (fawn ? 0.15 : moose ? 0.25 : 0.19), fawn ? 0.21 : moose ? 0.38 : 0.29, z);
      g.add(leg); legs.push(leg);
      const hoof = box(fawn ? 0.12 : moose ? 0.18 : 0.13, 0.055, fawn ? 0.12 : moose ? 0.17 : 0.13, '#2f251f', mats);
      hoof.position.set(side * (fawn ? 0.15 : moose ? 0.25 : 0.19), 0.03, z - 0.02);
      g.add(hoof);
    }
    return { group: g, head, legs, mats };
  }

  const quad = def.id === 'pig' || def.id === 'sheep' || def.id === 'cow' || def.id === 'calf';
  if (quad) {
    const isCow = def.id === 'cow';
    const isCalf = def.id === 'calf';
    const isCattle = isCow || isCalf;
    const bodyW = isCow ? 0.74 : isCalf ? 0.5 : 0.66;
    const bodyH = isCow ? 0.7 : isCalf ? 0.48 : 0.62;
    const bodyD = isCow ? 1.25 : isCalf ? 0.8 : 1.1;
    const bodyY = isCow ? 0.84 : isCalf ? 0.58 : 0.76;

    const body = box(bodyW, bodyH, bodyD, def.body, mats);
    body.userData.grazeBody = true;
    body.position.y = bodyY;
    g.add(body);

    if (def.id === 'sheep') {
      const wool = box(0.8, 0.72, 1.18, def.body, mats);
      wool.position.y = 0.78;
      wool.userData.grazeBody = true;
      g.add(wool);
    }

    const headW = isCow ? 0.54 : isCalf ? 0.42 : 0.52;
    const headH = isCow ? 0.52 : isCalf ? 0.4 : 0.5;
    const headD = isCow ? 0.52 : isCalf ? 0.4 : 0.5;
    const headY = isCow ? 1.05 : isCalf ? 0.78 : 0.96;
    const headZ = isCow ? -0.84 : isCalf ? -0.56 : -0.74;

    const hd = box(headW, headH, headD, def.body, mats);
    hd.position.set(0, headY, headZ);
    g.add(hd);
    head = hd;

    if (def.id === 'pig') {
      const snout = box(0.24, 0.18, 0.12, def.accent, mats);
      snout.position.set(0, 0.9, -1.0);
      g.add(snout);
      // nostrils + eyes
      for (const s of [-1, 1]) {
        px2(g, mats, s * 0.06, 0.9, -1.07, '#8a4a3a');
        px2(g, mats, s * 0.14, 1.06, -1.0, '#20301f');
      }
      // floppy ears
      for (const s of [-1, 1]) {
        const ear = box(0.12, 0.09, 0.06, def.body, mats);
        ear.position.set(s * 0.22, 1.14, -0.82);
        ear.rotation.z = s * 0.35;
        g.add(ear);
      }
      // muddy/brownish coat markings across back & flanks — flat decals, not raised blocks
      const patchCol = '#6e4432';
      coatPatch(g, mats, 'right', 0.334, 0.84, -0.12, 0.3, 0.22, patchCol, 'pigPatch');
      coatPatch(g, mats, 'left', -0.334, 0.8, 0.2, 0.34, 0.26, patchCol, 'pigPatch');
      coatPatch(g, mats, 'top', 0.04, 1.072, 0.3, 0.28, 0.24, patchCol, 'pigPatch');
      coatPatch(g, mats, 'front', 0.12, 1.04, -1.004, 0.16, 0.16, patchCol, 'pigPatch');
      // curly tail
      const tail = box(0.08, 0.1, 0.12, def.accent, mats);
      tail.position.set(0, 0.84, 0.58);
      g.add(tail);
    }

    if (isCattle) {
      // horns (cow: full horns, calf: small budding stubs)
      for (const s of [-1, 1]) {
        const hSize = isCow ? 0.12 : 0.06;
        const horn = box(hSize, isCow ? 0.16 : 0.08, hSize, '#e8e2d6', mats);
        horn.position.set(s * (isCow ? 0.26 : 0.18), isCow ? 1.32 : 1.0, isCow ? -0.84 : -0.56);
        horn.userData.cattleDetail = true;
        g.add(horn);

        // ears
        const ear = box(isCow ? 0.14 : 0.1, 0.08, 0.08, def.body, mats);
        ear.position.set(s * (isCow ? 0.34 : 0.26), isCow ? 1.18 : 0.9, isCow ? -0.8 : -0.52);
        ear.userData.cattleBody = true;
        g.add(ear);

        // eyes with white sclera + black pupil
        const scl = box(0.08, 0.08, 0.03, '#ffffff', mats);
        scl.position.set(s * (isCow ? 0.18 : 0.14), isCow ? 1.12 : 0.86, isCow ? -1.1 : -0.76);
        scl.userData.cattleDetail = true;
        g.add(scl);
        const eyeP = box(0.05, 0.05, 0.04, '#1a1a20', mats);
        eyeP.position.set(s * (isCow ? 0.18 : 0.14), isCow ? 1.12 : 0.86, isCow ? -1.12 : -0.78);
        eyeP.userData.cattleDetail = true;
        g.add(eyeP);
      }

      // pink muzzle with dark nostrils
      const muzzleW = isCow ? 0.36 : 0.28;
      const muzzleH = isCow ? 0.2 : 0.16;
      const muzzle = box(muzzleW, muzzleH, 0.08, '#d8a0a8', mats);
      muzzle.position.set(0, isCow ? 0.88 : 0.66, isCow ? -1.12 : -0.78);
      muzzle.userData.cattleDetail = true;
      g.add(muzzle);
      for (const s of [-1, 1]) {
        const nos = box(0.05, 0.05, 0.05, '#8a5a62', mats);
        nos.position.set(s * (isCow ? 0.09 : 0.07), isCow ? 0.88 : 0.66, isCow ? -1.16 : -0.82);
        nos.userData.cattleDetail = true;
        g.add(nos);
      }

      // Flat coat patches across body & flanks: texture-like markings, not chunky raised plates.
      const sScale = isCow ? 1 : 0.65;
      const spotMat = new THREE.MeshLambertMaterial({ color: def.accent });
      mats.push(spotMat);

      const addSpotPatch = (face: PatchFace, x: number, y: number, z: number, w: number, h: number) => {
        const mesh = coatPatch(g, mats, face, x * sScale, y * sScale, z * sScale, w * sScale, h * sScale, def.accent, 'cattleSpot');
        mesh.material = spotMat;
      };

      addSpotPatch('left', -0.374, isCow ? 0.88 : 0.62, 0.15, 0.46, 0.32); // left flank
      addSpotPatch('right', 0.374, isCow ? 0.86 : 0.6, -0.25, 0.42, 0.3); // right shoulder
      addSpotPatch('top', 0, isCow ? 1.192 : 0.84, 0.3, 0.44, 0.38); // back rump
      addSpotPatch('bottom', 0, isCow ? 0.49 : 0.34, -0.05, 0.48, 0.34); // belly
      addSpotPatch('front', 0.14, isCow ? 1.15 : 0.86, isCow ? -1.105 : -0.77, 0.22, 0.22); // head spot

      if (isCow) {
        // adult cow pink udder
        const udder = box(0.24, 0.12, 0.22, '#e8a8b2', mats);
        udder.position.set(0, 0.52, 0.28);
        udder.userData.cattleDetail = true;
        g.add(udder);

        // tail with tuft
        const tail = box(0.06, 0.46, 0.06, def.body, mats);
        tail.position.set(0, 0.74, 0.66);
        tail.rotation.x = 0.25;
        tail.userData.cattleBody = true;
        g.add(tail);
        const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), spotMat);
        tuft.position.set(0, 0.48, 0.72);
        tuft.userData.cattleSpot = true;
        g.add(tuft);
      }
    }

    if (def.id === 'sheep') {
      // A small wool-framed face, with gentle dark eyes instead of large
      // white sclerae. Keep the skin details tan across every wool variant.
      const faceMat = new THREE.MeshLambertMaterial({ color: '#c7aa88' });
      mats.push(faceMat);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.08), faceMat);
      face.position.set(0, 0.94, -1.0);
      face.userData.sheepFace = true;
      g.add(face);
      const fringe = box(0.42, 0.12, 0.12, def.body, mats);
      fringe.position.set(0, 1.13, -1.03);
      g.add(fringe); // wool tuft follows the sheep's coat colour
      for (const s of [-1, 1]) {
        const eye = box(0.055, 0.055, 0.04, '#3b302b', mats);
        eye.position.set(s * 0.105, 1.01, -1.06);
        eye.userData.sheepFace = true;
        g.add(eye);
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.08), faceMat);
        ear.position.set(s * 0.28, 1.04, -0.8);
        ear.rotation.z = -s * 0.2;
        ear.userData.sheepFace = true;
        g.add(ear);
      }
      const muzzle = box(0.19, 0.12, 0.09, '#e2c9ae', mats);
      muzzle.position.set(0, 0.855, -1.06);
      muzzle.userData.sheepFace = true;
      g.add(muzzle);
      const nose = box(0.055, 0.045, 0.035, '#a57978', mats);
      nose.position.set(0, 0.89, -1.12);
      nose.userData.sheepFace = true;
      g.add(nose);
    }

    const legW = isCow ? 0.2 : isCalf ? 0.13 : 0.2;
    const legH = isCow ? 0.58 : isCalf ? 0.38 : 0.5;
    const legD = isCow ? 0.2 : isCalf ? 0.13 : 0.2;
    const legSpreadX = isCow ? 0.24 : isCalf ? 0.16 : 0.22;
    const legSpreadZ = isCow ? 0.4 : isCalf ? 0.26 : 0.36;
    const legY = isCow ? 0.29 : isCalf ? 0.19 : 0.25;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = box(legW, legH, legD, def.legs, mats);
        leg.position.set(sx * legSpreadX, legY, sz * legSpreadZ);
        leg.userData.cattleLeg = true;
        g.add(leg);
        legs.push(leg);
      }
    }
    return { group: g, head, legs, mats };
  }

  // humanoid: zombie / skeleton / archer / creeper / trader
  const thin = def.id === 'skeleton' || def.id === 'archer';
  const creeper = def.id === 'creeper';
  const trader = def.id === 'trader';
  const body = box(creeper ? 0.56 : thin ? 0.42 : 0.56, creeper ? 0.96 : 0.74, creeper ? 0.34 : 0.3, def.body, mats);
  body.position.y = creeper ? 0.98 : 1.06;
  g.add(body);

  const hd = box(0.56, 0.56, 0.56, def.body, mats);
  hd.position.y = creeper ? 1.74 : 1.72;
  g.add(hd);
  head = hd;

  // face
  for (const ex of [-0.14, 0.14]) {
    const eye = box(0.14, 0.16, 0.06, creeper ? '#12210f' : '#20301f', mats);
    eye.position.set(ex, creeper ? 1.8 : 1.78, -0.3);
    g.add(eye);
  }
  if (creeper) {
    const mouth = box(0.2, 0.26, 0.06, '#12210f', mats);
    mouth.position.set(0, 1.58, -0.3);
    g.add(mouth);
  }

  if (creeper) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = box(0.22, 0.5, 0.22, def.legs, mats);
        leg.position.set(sx * 0.16, 0.25, sz * 0.2);
        g.add(leg);
        legs.push(leg);
      }
    }
  } else {
    for (const s of [-1, 1]) {
      const arm = box(0.2, 0.7, 0.2, trader ? def.body : def.accent, mats);
      arm.position.set(s * 0.38, 1.06, -0.18);
      arm.rotation.x = trader ? -0.25 : -1.2; // zombies reach, the trader strolls
      g.add(arm);
      const leg = box(0.22, 0.68, 0.22, def.legs, mats);
      leg.position.set(s * 0.15, 0.34, 0);
      g.add(leg);
      legs.push(leg);
    }
    if (trader) {
      // robe skirt + gold satchel + hood
      const skirt = box(0.6, 0.5, 0.36, def.body, mats);
      skirt.position.set(0, 0.62, 0);
      g.add(skirt);
      const bag = box(0.26, 0.3, 0.16, def.accent, mats);
      bag.position.set(0.4, 0.92, 0.22);
      g.add(bag);
      const hood = box(0.62, 0.2, 0.62, def.legs, mats);
      hood.position.y = 2.02;
      g.add(hood);
    }
    if (def.id === 'archer') {
      // proper bow in the left hand: curved limbs + string, aimed forward
      const bowGrp = new THREE.Group();
      const limbT2 = box(0.05, 0.3, 0.07, '#8a6a3c', mats);
      limbT2.position.set(0, 0.26, 0.05);
      limbT2.rotation.x = -0.45;
      const limbB2 = box(0.05, 0.3, 0.07, '#8a6a3c', mats);
      limbB2.position.set(0, -0.26, 0.05);
      limbB2.rotation.x = 0.45;
      const grip3 = box(0.06, 0.2, 0.08, '#6e5129', mats);
      const str2 = box(0.015, 0.72, 0.015, '#e8e2d2', mats);
      str2.position.set(0, 0, 0.12);
      const arrow2 = box(0.03, 0.03, 0.4, '#c8bfa8', mats);
      arrow2.position.set(0, 0, -0.1);
      for (const part of [limbT2, limbB2, grip3, str2, arrow2]) bowGrp.add(part);
      // held out in the left hand, string toward the chest, arrow forward
      bowGrp.position.set(-0.42, 1.1, -0.42);
      bowGrp.rotation.y = 0.15;
      g.add(bowGrp);
    } else if (def.id === 'skeleton') {
      // swordsman: blade gripped in the lowered right hand, edge forward
      const swGrp = new THREE.Group();
      const blade2 = box(0.06, 0.55, 0.1, '#b8bec8', mats);
      blade2.position.y = 0.4;
      const tip2 = box(0.06, 0.12, 0.08, '#d0d6de', mats);
      tip2.position.y = 0.72;
      const guard2 = box(0.2, 0.06, 0.12, '#6e5129', mats);
      guard2.position.y = 0.1;
      const grip4 = box(0.07, 0.18, 0.07, '#4a3a24', mats);
      grip4.position.y = -0.04;
      for (const part of [blade2, tip2, guard2, grip4]) swGrp.add(part);
      // hangs from the hand at the arm's end, angled slightly out & forward
      swGrp.position.set(0.44, 0.62, -0.3);
      swGrp.rotation.set(-0.5, 0, -0.12);
      g.add(swGrp);
    }
  }
  return { group: g, head, legs, mats };
}

/** Rotate the whole face (eyes, muzzle and ears included), not just the head
 * cube. The neck is included on camels so they can reach down to eat. */
function makeFeedingHead(group: THREE.Group, head: THREE.Object3D, mats: THREE.MeshLambertMaterial[], id: MobId): { pivot: THREE.Group; mouth: THREE.Object3D | null } {
  const camel = id === 'camel' || id === 'camel_calf';
  const camelCalf = id === 'camel_calf';
  const deerLike = id === 'deer' || id === 'roe_deer' || id === 'fawn';
  const pivot = new THREE.Group();
  const hingeY = camel ? (camelCalf ? 0.78 : 1.04) : head.position.y + 0.08;
  const hingeZ = camel ? (camelCalf ? -0.18 : -0.22) : head.position.z + 0.22;
  const headY = head.position.y, headZ = head.position.z;
  pivot.position.set(0, hingeY, hingeZ);
  for (const part of [...group.children]) {
    if (part === head || (camel
      ? part.position.z < (camelCalf ? -0.28 : -0.38) && part.position.y > (camelCalf ? 0.72 : 0.95)
      : part.position.z < headZ + 0.07 && part.position.y > headY - 0.32)) {
      // Preserve the previous local coordinates while changing parents.
      group.remove(part);
      part.position.sub(pivot.position);
      pivot.add(part);
    }
  }
  group.add(pivot);
  if (deerLike) return { pivot, mouth: null };
  const mouth = box(
    camelCalf ? 0.17 : camel ? 0.22 : deerLike ? (id === 'fawn' ? 0.11 : 0.14) : 0.2,
    deerLike ? 0.045 : 0.07,
    camelCalf ? 0.1 : camel ? 0.14 : deerLike ? 0.075 : 0.14,
    camel ? '#9c764b' : deerLike ? '#4a3527' : '#675543',
    mats,
  );
  const muzzleY = camel ? (camelCalf ? 1.49 : 2.01) : deerLike ? headY - (id === 'fawn' ? 0.16 : 0.2) : headY - 0.13;
  const muzzleZ = camel ? (camelCalf ? -0.81 : -1.02) : deerLike ? headZ - (id === 'fawn' ? 0.3 : 0.32) : headZ - 0.33;
  mouth.position.set(0, muzzleY - hingeY - 0.1, muzzleZ - hingeZ);
  mouth.userData.restY = mouth.position.y;
  pivot.add(mouth);
  return { pivot, mouth };
}

export class MobSystem {
  mobs: Mob[] = [];
  private scene: THREE.Scene;
  private world: World;
  private pool = new Map<MobId, THREE.Group[]>();
  maxMobs = 60; // room for local bird/bee flocks, fish schools and night mobs
  private tick = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  clear() {
    for (const m of this.mobs) {
      this.scene.remove(m.group);
      m.group.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
        if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.dispose();
      });
    }
    this.mobs.length = 0;
    this.pool.clear();
  }

  count(hostile: boolean) {
    let n = 0;
    for (const m of this.mobs) if (m.alive && m.def.hostile === hostile && !m.def.aquatic) n++;
    return n;
  }

  private estimatedSpawnScale(id: MobId) {
    if (id === 'bird') return MOBS[id].scale * 1.35;
    if (id === 'fish') return MOBS[id].scale * 1.5;
    return MOBS[id].scale;
  }

  private estimatedSpawnHalf(id: MobId) {
    const scale = this.estimatedSpawnScale(id);
    const half = id === 'spider' ? 0.48
      : id === 'spiderling' ? 0.3
        : id === 'moose' ? 0.58
          : id === 'camel' ? 0.5
            : id === 'cow' || id === 'sheep' || id === 'pig' ? 0.42
              : id === 'bird' || id === 'bee' ? 0.2
                : 0.32;
    return half * scale;
  }

  private estimatedSpawnHeight(id: MobId) {
    const scale = this.estimatedSpawnScale(id);
    const height = id === 'fish' || id === 'jellyfish' ? 0.75
      : id === 'frog' ? 0.55
        : id === 'spider' || id === 'spiderling' || id === 'chicken' ? 0.9
          : MOBS[id].hostile ? 1.85
            : id === 'camel' ? 2.4
              : id === 'camel_calf' ? 1.75
                : id === 'bird' ? 0.9
                  : id === 'bee' ? 0.7
                    : 1.3;
    return height * scale;
  }

  private spawnClearance(id: MobId | null, other: Mob) {
    if (id === null) return other.def.aquatic ? 0.2 : 0.72;
    if ((id === 'calf' && (other.id === 'cow' || other.id === 'calf')) ||
        (id === 'fawn' && (other.id === 'deer' || other.id === 'roe_deer' || other.id === 'fawn')) ||
        (id === 'camel_calf' && (other.id === 'camel' || other.id === 'camel_calf'))) return 0.18;
    if (MOBS[id].hostile || other.def.hostile) return 0.9;
    if ((id === 'fish' || id === 'jellyfish') && other.def.aquatic) return 0.18;
    if (id === 'bee' || other.id === 'bee' || id === 'bird' || other.id === 'bird') return 0.48;
    if (id === 'trader' || other.id === 'trader') return 0.9;
    return 0.62;
  }

  private hasSpawnSpace(id: MobId | null, x: number, y: number, z: number, half: number, height: number) {
    for (const other of this.mobs) {
      if (!other.alive || other.hidden) continue;
      const otherHeight = this.mobHeight(other);
      if (y >= other.y + otherHeight || y + height <= other.y) continue;
      const minimum = half + this.mobHalf(other) + this.spawnClearance(id, other);
      const dx = x - other.x;
      const dz = z - other.z;
      if (dx * dx + dz * dz < minimum * minimum) return false;
    }
    return true;
  }

  /** Check terrain clearance and keep newly spawned creatures apart from existing ones. */
  canSpawnAt(id: MobId, x: number, y: number, z: number) {
    if (![x, y, z].every(Number.isFinite)) return false;
    const half = this.estimatedSpawnHalf(id);
    const height = this.estimatedSpawnHeight(id);
    return !this.collidesBox(x, y, z, half, height) && this.hasSpawnSpace(id, x, y, z, half, height);
  }

  spawn(id: MobId, x: number, y: number, z: number, fishVariant?: number): Mob | null {
    // fish live in a separate budget — schools shouldn't crowd out land life
    if (id === 'fish') {
      let fishCount = 0;
      for (const m of this.mobs) if (m.alive && m.id === 'fish') fishCount++;
      if (fishCount >= 36) return null;
    } else if (id === 'jellyfish') {
      if (this.mobs.filter((m) => m.alive && m.id === 'jellyfish').length >= 7) return null;
    } else if (this.mobs.length >= this.maxMobs) return null;
    const def = MOBS[id];
    let { group, head, legs, mats } = buildBody(def);
    if (id === 'jellyfish') for (const mat of mats) { mat.transparent = true; mat.opacity = 0.78; mat.depthWrite = false; }
    if (id === 'fish') {
      const vi = fishVariant === undefined ? Math.floor(Math.random() * (FISH_VARIANTS.length - 1)) :
        Math.max(0, Math.min(FISH_VARIANTS.length - 1, fishVariant));
      const v = FISH_VARIANTS[vi];
      group.userData.variant = vi;
      group.userData.modelSize = v.size;
      for (const part of group.children) {
        if (part.userData.fishBody) {
          part.scale.set(v.girth, v.girth, v.length);
        } else if (part.userData.fishDorsal) {
          part.scale.y = v.dorsal;
          part.position.y = 0.46 + v.girth * 0.07;
        } else if (part.userData.fishEye) {
          part.position.x = Math.sign(part.position.x) * (0.15 * v.girth + 0.015);
          part.position.z = -0.22 * v.length;
        } else if (part.userData.fishSideFin) part.position.x = Math.sign(part.position.x) * (0.15 * v.girth + 0.03);
      }
      legs[0].position.z = 0.28 * v.length;
      // Each mesh has its own material, so tinting doesn't colour eyes.
      for (const mat of mats) {
        const color = `#${mat.color.getHexString()}`;
        if (color === def.body) mat.color.set(v.body);
        else if (color === def.accent || color === def.legs) mat.color.set(v.fin);
      }
      // Distinctive clownfish white bands; a pale belly on carp and pike.
      if (vi === 0) for (const z of [-0.12, 0.12]) {
        const stripe = box(0.31 * v.girth, 0.31 * v.girth, 0.08, v.belly, mats);
        stripe.position.set(0, 0.31, z); group.add(stripe);
      }
      else if (vi === 1 || vi === 2) {
        const belly = box(0.23 * v.girth, 0.07, 0.4 * v.length, v.belly, mats);
        belly.position.set(0, 0.18 * v.girth + 0.08, 0); group.add(belly);
      }
    }
    // turtles can retract head + legs into the shell
    if (id === 'turtle') {
      // head-adjacent parts sit forward of z<-0.55; legs are tracked separately
      const retract: THREE.Object3D[] = [...legs];
      group.traverse((o) => {
        if (o !== group && o.position.z < -0.55) retract.push(o);
      });
      // stash on the mob after creation (see below)
      (group.userData as { retract?: THREE.Object3D[] }).retract = retract;
    }
    // Birds now render as parrot-style variants: macaw, cockatiel, grey parrot, budgie.
    if (id === 'bird') {
      const variants: Array<{ colors: [string, string, string]; size: number; length: number; tail: number }> = [
        { colors: ['#d83b2f', '#ffe15c', '#255bc2'], size: 1.35, length: 1.12, tail: 2.2 }, // red/blue macaw
        { colors: ['#2ebd52', '#f45858', '#1f7c40'], size: 1.28, length: 1.08, tail: 2.1 }, // green parrot
        { colors: ['#1e8eea', '#ffd24a', '#1455a8'], size: 1.22, length: 1.06, tail: 1.9 }, // blue parrot
        { colors: ['#f0de72', '#ff8b3d', '#d0b24a'], size: 1.15, length: 1.0, tail: 1.55 }, // cockatiel
        { colors: ['#6c6d78', '#f2f0e6', '#484a56'], size: 1.25, length: 1.05, tail: 1.45 }, // grey parrot
        { colors: ['#5ec7ec', '#f5f1dc', '#2f8e4a'], size: 1.05, length: 0.95, tail: 1.65 }, // budgie
      ];
      const vi = Math.floor(Math.random() * variants.length);
      const { colors: [b, a, l], size, length, tail: tailLength } = variants[vi];
      // Recolour only plumage, not the beak or eyes.
      for (const mat of mats) {
        const hex = `#${mat.color.getHexString()}`;
        if (hex === MOBS.bird.body) mat.color.set(b);
        else if (hex === MOBS.bird.accent) mat.color.set(a);
        else if (hex === MOBS.bird.legs) mat.color.set(l);
      }
      group.userData.variant = vi;
      group.userData.modelSize = size;
      // Grow the body backwards so its chest stays joined to the head;
      // move the tail to the new rump and keep its base overlapping it.
      for (const part of group.children) {
        if (part.userData.birdBody) {
          part.scale.z = length;
          part.position.z += 0.2 * (length - 1);
        } else if (part.userData.birdTail) {
          part.scale.z = tailLength;
          part.position.z = 0.28 + 0.4 * (length - 1) + 0.1 * (tailLength - 1);
        }
      }
      for (const shoulder of legs) shoulder.position.z += 0.2 * (length - 1);
    }
    // domestic / ocelot cat coats inspired by Minecraft cats. Markings are flat coat patches.
    if (id === 'cat') {
      const CAT_VARIANTS = [
        { body: '#c99556', accent: '#f3dcc0', legs: '#855931', patch: '#3a2a20' }, // tabby ginger
        { body: '#1d1d22', accent: '#f4efe4', legs: '#121216', patch: '#f4efe4' }, // tuxedo
        { body: '#f0e8d8', accent: '#efe3d0', legs: '#d0b58c', patch: '#c58b45' }, // calico base
        { body: '#d09a5a', accent: '#f2e0bb', legs: '#9b6f3a', patch: '#6c4d2e' }, // ocelot-like
        { body: '#b8a08a', accent: '#f4eadb', legs: '#5c4638', patch: '#3f3026' }, // Siamese points
        { body: '#d86d34', accent: '#f6e4ce', legs: '#944425', patch: '#f3f0e4' }, // red with white
      ];
      const vi = Math.floor(Math.random() * CAT_VARIANTS.length);
      const cv = CAT_VARIANTS[vi];
      (group.userData as { variant?: number }).variant = vi;
      for (const mat of mats) {
        const hex = `#${mat.color.getHexString()}`;
        if (hex === MOBS.cat.body) mat.color.set(cv.body);
        else if (hex === MOBS.cat.accent) mat.color.set(cv.accent);
        else if (hex === MOBS.cat.legs) mat.color.set(cv.legs);
        else if (hex === '#8a6a3a') mat.color.set(cv.patch);
        else if (hex === '#2a2a30' && vi !== 1) mat.color.set(cv.legs);
      }
    }
    // Rabbits vary between wild hares, Dutch markings, desert cottontails and snowy coats.
    if (id === 'rabbit') {
      const winter = this.world.isWinter(Math.floor(x), Math.floor(z));
      const dry = ['desert', 'canyon'].includes(this.world.biomeAt(Math.floor(x), Math.floor(z)));
      const RABBIT_VARIANTS = winter
        ? [{ body: '#f2f4f6', accent: '#ffffff', legs: '#d7dbe0', patch: '#d9dde2' }, { body: '#dad2c4', accent: '#ffffff', legs: '#9b8364', patch: '#806a52' }]
        : dry
          ? [{ body: '#caa46c', accent: '#f0dfbf', legs: '#8c623e', patch: '#e4c48f' }, { body: '#9e764f', accent: '#e7d0aa', legs: '#6b4b32', patch: '#4a372a' }]
          : [
              { body: '#9a7a5a', accent: '#eadac1', legs: '#604b36', patch: '#4c392a' },
              { body: '#ffffff', accent: '#f5d6d9', legs: '#d5d5dc', patch: '#2f2f35' },
              { body: '#62443a', accent: '#e8d4ba', legs: '#3a2a24', patch: '#d8c7ac' },
              { body: '#d0a26d', accent: '#f0dcc0', legs: '#7a5638', patch: '#f2efe8' },
            ];
      const vi = Math.floor(Math.random() * RABBIT_VARIANTS.length);
      const rv = RABBIT_VARIANTS[vi];
      (group.userData as { variant?: number }).variant = vi;
      for (const mat of mats) {
        const hex = `#${mat.color.getHexString()}`;
        if (hex === MOBS.rabbit.body) mat.color.set(rv.body);
        else if (hex === MOBS.rabbit.accent) mat.color.set(rv.accent);
        else if (hex === MOBS.rabbit.legs) mat.color.set(rv.legs);
        else if (hex === '#8a6a48') mat.color.set(rv.patch);
      }
    }
    // Deer family: several woodland coats plus spotted fawns and pale winter morphs.
    if (id === 'deer' || id === 'roe_deer' || id === 'moose' || id === 'fawn') {
      const winter = this.world.isWinter(Math.floor(x), Math.floor(z));
      if (id !== 'moose') {
        const DEER_VARIANTS = id === 'fawn'
          ? [
              { body: '#b8834f', accent: '#f0d5ad', legs: '#5a3c2d', patch: '#f7e6c8' },
              { body: '#8e6541', accent: '#ead0a5', legs: '#493225', patch: '#fff0cf' },
              { body: '#c18f56', accent: '#f5dfb7', legs: '#64422e', patch: '#f4e9d6' },
            ]
          : [
              { body: '#a8794f', accent: '#d7bd91', legs: '#594332', patch: '#f2e3c8' },
              { body: '#7e5638', accent: '#dfc39a', legs: '#3f2e25', patch: '#f1e2c4' },
              { body: '#b78355', accent: '#e2c897', legs: '#654733', patch: '#fff0d5' },
            ];
        const vi = Math.floor(Math.random() * DEER_VARIANTS.length);
        const dv = DEER_VARIANTS[vi];
        (group.userData as { variant?: number }).variant = vi;
        for (const mat of mats) {
          const hex = `#${mat.color.getHexString()}`;
          if (hex === def.body) mat.color.set(winter ? new THREE.Color(dv.body).lerp(new THREE.Color('#d9d4c9'), 0.16) : dv.body);
          else if (hex === def.accent) mat.color.set(winter ? new THREE.Color(dv.accent).lerp(new THREE.Color('#d9d4c9'), 0.12) : dv.accent);
          else if (hex === def.legs) mat.color.set(dv.legs);
          else if (hex === '#f2e3c8' || hex === '#f4e1bd') mat.color.set(dv.patch);
        }
      } else {
        const MOOSE_VARIANTS = [
          { body: '#70513d', accent: '#ad8968', legs: '#49392e', patch: '#ead8bd' },
          { body: '#5b4635', accent: '#9e7758', legs: '#392d25', patch: '#d8c3a4' },
          { body: '#806248', accent: '#c49a6b', legs: '#4a372b', patch: '#f0ddc0' },
        ];
        const vi = Math.floor(Math.random() * MOOSE_VARIANTS.length);
        const mv = MOOSE_VARIANTS[vi];
        (group.userData as { variant?: number }).variant = vi;
        for (const mat of mats) {
          const hex = `#${mat.color.getHexString()}`;
          if (hex === MOBS.moose.body) mat.color.set(winter ? new THREE.Color(mv.body).lerp(new THREE.Color('#d9d4c9'), 0.12) : mv.body);
          else if (hex === MOBS.moose.accent) mat.color.set(winter ? new THREE.Color(mv.accent).lerp(new THREE.Color('#d9d4c9'), 0.1) : mv.accent);
          else if (hex === MOBS.moose.legs) mat.color.set(mv.legs);
          else if (hex === '#f2e3c8') mat.color.set(mv.patch);
        }
      }
    }
    // frogs use the Minecraft warm/temperate/cold palette variants.
    if (id === 'frog') {
      const biome = this.world.biomeAt(Math.floor(x), Math.floor(z));
      const FROG_VARIANTS = ['desert', 'canyon'].includes(biome)
        ? [{ body: '#d99d44', accent: '#f3d781', legs: '#9c6c28', patch: '#a75f24' }]
        : this.world.isWinter(Math.floor(x), Math.floor(z))
          ? [{ body: '#5e9ab8', accent: '#d8edf2', legs: '#3f718b', patch: '#2e596d' }]
          : [
              { body: '#5f9c3f', accent: '#e5c878', legs: '#3d6c2e', patch: '#2f5d29' },
              { body: '#7aa33b', accent: '#f0cf8a', legs: '#526d2b', patch: '#3e5b20' },
              { body: '#6b9a61', accent: '#e8d3a3', legs: '#4b6d45', patch: '#38502e' },
            ];
      const vi = Math.floor(Math.random() * FROG_VARIANTS.length);
      const fv = FROG_VARIANTS[vi];
      (group.userData as { variant?: number }).variant = vi;
      for (const mat of mats) {
        const hex = `#${mat.color.getHexString()}`;
        if (hex === MOBS.frog.body) mat.color.set(fv.body);
        else if (hex === MOBS.frog.accent) mat.color.set(fv.accent);
        else if (hex === MOBS.frog.legs) mat.color.set(fv.legs);
        else if (hex === '#3f7830' || hex === '#78b857') mat.color.set(fv.patch);
      }
    }
    // Camels vary between one and two humps; calves share the same palette at smaller scale.
    if (id === 'camel' || id === 'camel_calf') {
      const CAMEL_VARIANTS = [
        { body: '#c9a26a', accent: '#e3bb82', legs: '#9c764b', patches: ['#e6c184', '#b9854b'], twoHumps: true },
        { body: '#b88950', accent: '#d8aa6e', legs: '#7a5632', patches: ['#d5ad72', '#8e6139'], twoHumps: false },
        { body: '#d8ad6a', accent: '#f0cf91', legs: '#a47743', patches: ['#f1d49a', '#b9874f'], twoHumps: Math.random() < 0.45 },
      ];
      const vi = Math.floor(Math.random() * CAMEL_VARIANTS.length);
      const cv = CAMEL_VARIANTS[vi];
      (group.userData as { variant?: number }).variant = vi;
      let patchIndex = 0;
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.material) return;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        const hex = `#${mat.color.getHexString()}`;
        if (mesh.userData?.camelRearHump && !cv.twoHumps) mesh.visible = false;
        if (hex === def.body) mat.color.set(cv.body);
        else if (hex === def.accent) mat.color.set(cv.accent);
        else if (hex === def.legs || hex === '#6f4a2b') mat.color.set(cv.legs);
        else if (hex === '#e6c184' || hex === '#b9854b') mat.color.set(cv.patches[(patchIndex++) % cv.patches.length]);
      });
    }
    // cow and calf: colour variants (Holstein, brown/cream, ginger, black, highland-inspired)
    if (id === 'cow' || id === 'calf') {
      const COW_VARIANTS = [
        { body: '#f4f5f8', spot: '#222226', legs: '#1c1c20' }, // Holstein black & white
        { body: '#6d4c33', spot: '#eddcc9', legs: '#482f1b' }, // brown with cream patches
        { body: '#9e4e26', spot: '#faecd8', legs: '#6c3014' }, // ginger / reddish-brown with light spots
        { body: '#241e1b', spot: '#f2ece4', legs: '#161210' }, // dark chocolate with white patches
        { body: '#d7b07a', spot: '#fff2d0', legs: '#8b6439' }, // tan highland-inspired
        { body: '#ead7b9', spot: '#7b4b2b', legs: '#6a4428' }, // cream with chestnut markings
        { body: '#3a312b', spot: '#a56f43', legs: '#211b18' }, // black-brown belted feel
        { body: '#b77b4a', spot: '#ffffff', legs: '#75492d' }, // Hereford-like red with white
      ];
      const vi = Math.floor(Math.random() * COW_VARIANTS.length);
      const cv = COW_VARIANTS[vi];
      (group.userData as { variant?: number }).variant = vi;
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.material) return;
        const m = mesh.material as THREE.MeshLambertMaterial;
        if (mesh.userData?.cattleSpot) {
          m.color.set(cv.spot);
        } else if (mesh.userData?.cattleLeg) {
          m.color.set(cv.legs);
        } else if (!mesh.userData?.cattleDetail) {
          m.color.set(cv.body);
        }
      });
    }
    if (id === 'lizard' && ['desert', 'canyon'].includes(this.world.biomeAt(Math.floor(x), Math.floor(z)))) {
      for (const mat of mats) {
        const hex = `#${mat.color.getHexString()}`;
        if (hex === def.body) mat.color.set('#c4a46e');
        else if (hex === def.accent) mat.color.set('#e0c591');
        else if (hex === def.legs) mat.color.set('#9b7952');
      }
    }
    // sheep: rare wool colours (black 6%, brown 5%, pink 2%) — face stays tan
    if (id === 'sheep') {
      const roll = Math.random();
      const woolColor = roll < 0.02 ? '#e8a8c8' : roll < 0.07 ? '#6a5238' : roll < 0.13 ? '#3a3a40' : null;
      if (woolColor) {
        // recolour only the wool/body meshes; face parts are tagged sheepFace
        const faceMats = new Set<THREE.Material>();
        group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.userData?.sheepFace && mesh.material) faceMats.add(mesh.material as THREE.Material);
        });
        for (const m of mats) {
          if (faceMats.has(m)) continue;
          const c = m.color;
          if (c.r + c.g + c.b > 1.4) m.color.set(woolColor); // only light wool tones
        }
      }
    }
    // winter camouflage: rabbits and sheep turn white in snow biomes
    if ((id === 'rabbit' || id === 'sheep') && this.world.isWinter(Math.floor(x), Math.floor(z))) {
      const faceMats = new Set<THREE.Material>();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.userData?.sheepFace && mesh.material) faceMats.add(mesh.material as THREE.Material);
      });
      for (const m of mats) {
        if (faceMats.has(m)) continue;
        const c = m.color;
        // shift warm browns to snowy whites, keep dark details dark
        if (c.r + c.g + c.b > 1.1) c.setRGB(0.93, 0.95, 0.99);
      }
    }
    let feedJaw: THREE.Object3D | null = null;
    let feedBody: THREE.Object3D | null = null;
    group.traverse((part) => { if (part.userData.grazeBody) feedBody = part; });
    if (head && (id === 'cow' || id === 'calf' || id === 'sheep' || id === 'pig' || id === 'camel' || id === 'camel_calf' || id === 'deer' || id === 'roe_deer' || id === 'moose' || id === 'fawn')) {
      const rig = makeFeedingHead(group, head, mats, id);
      head = rig.pivot;
      feedJaw = rig.mouth;
    }
    const modelSize = (group.userData.modelSize as number | undefined) ?? 1;
    group.updateMatrixWorld(true);
    const modelBounds = new THREE.Box3().setFromObject(group);
    const modelDimensions = modelBounds.getSize(new THREE.Vector3());
    const collisionHalf = Math.max(0.16, Math.max(modelDimensions.x, modelDimensions.z) * 0.5);
    const collisionHeight = Math.max(0.35, modelDimensions.y);
    const healthBarTop = Math.max(0.35, modelBounds.max.y);
    const rootScale = def.scale * modelSize;
    const worldHalf = collisionHalf * rootScale;
    const worldHeight = collisionHeight * rootScale;
    group.scale.setScalar(rootScale);
    group.position.set(x, y, z);
    if (
      ![x, y, z].every(Number.isFinite) ||
      this.collidesBox(x, y, z, worldHalf, worldHeight) ||
      !this.hasSpawnSpace(id, x, y, z, worldHalf, worldHeight)
    ) {
      group.traverse((part) => {
        const mesh = part as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) for (const entry of material) entry.dispose();
        else material?.dispose();
      });
      return null;
    }
    this.scene.add(group);
    const mob: Mob = {
      id,
      def,
      group,
      head,
      legParts: legs,
      mats,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: def.hp,
      maxHp: def.hp,
      healthBarFill: null,
      healthBarTimer: 0,
      healthBarTop,
      onGround: false,
      tx: x,
      tz: z,
      think: Math.random() * 2,
      cd: 0,
      burn: 0,
      burnTick: 0,
      slow: 0,
      hurtFlash: 0,
      walkPhase: Math.random() * 6,
      fuse: -1,
      alive: true,
      jumpCd: 0,
      stuckArrows: 0,
      grow: 0,
      drown: 0,
      hidden: false,
      shellT: 0,
      buried: 0,
      variant: 0,
      modelSize,
      collisionHalf,
      collisionHeight,
      retractParts: [] as THREE.Object3D[],
      task: 0,
      taskX: 0,
      taskY: 0,
      taskZ: 0,
      taskT: 0,
      forageCd: 6 + Math.random() * 7,
      drinkCd: 8 + Math.random() * 8,
      feedClock: 0,
      feedFoodId: 0,
      feedJaw,
      feedBody,
    };
    // wire up per-species extras prepared above
    mob.retractParts = ((group.userData as { retract?: THREE.Object3D[] }).retract ?? []) as THREE.Object3D[];
    mob.variant = ((group.userData as { variant?: number }).variant ?? 0) as number;
    this.mobs.push(mob);
    return mob;
  }

  /** Show a single, centered world-space HP bar attached to the mob after it takes damage. */
  showHealthBar(mob: Mob) {
    mob.healthBarTimer = 3.2;
    if (!mob.healthBarFill) {
      mob.healthBarFill = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0x68d36a,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }));
      // Keep the sprite centered on the mob's pivot. A centered single sprite cannot drift when
      // its parent turns, unlike two independently billboarding fill/background sprites.
      mob.healthBarFill.center.set(0.5, 0.5);
      mob.healthBarFill.renderOrder = 20;
      mob.group.add(mob.healthBarFill);
    }
    mob.healthBarFill.visible = true;
    this.updateHealthBar(mob);
  }

  private updateHealthBar(mob: Mob) {
    if (!mob.healthBarFill) return;
    const width = 0.82;
    const height = 0.055;
    const gap = 0.06;
    const scaleX = Math.max(0.001, Math.abs(mob.group.scale.x));
    const scaleY = Math.max(0.001, Math.abs(mob.group.scale.y));
    const fraction = Math.max(0, Math.min(1, mob.hp / Math.max(1, mob.maxHp)));
    // Compensate for the mob's (possibly growing/shrinking) group scale so the bar stays a
    // consistent world-space size while its base remains just above the model's measured top.
    mob.healthBarFill.scale.set(width * fraction / scaleX, height / scaleY, 1);
    mob.healthBarFill.position.set(0, mob.healthBarTop + (gap + height / 2) / scaleY, 0);
    const material = mob.healthBarFill.material as THREE.SpriteMaterial;
    material.color.set(fraction > 0.55 ? '#68d36a' : fraction > 0.25 ? '#f2c14e' : '#e95c55');
  }

  remove(mob: Mob) {
    mob.alive = false;
    this.scene.remove(mob.group);
    mob.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.dispose();
    });
    const i = this.mobs.indexOf(mob);
    if (i >= 0) this.mobs.splice(i, 1);
  }

  /** full AABB test — samples every voxel the mob's box overlaps, all corners */
  private collidesBox(x: number, y: number, z: number, half: number, height: number) {
    const x0 = Math.floor(x - half);
    const x1 = Math.floor(x + half);
    const y0 = Math.floor(y + 0.001);
    const y1 = Math.floor(y + height - 0.02);
    const z0 = Math.floor(z - half);
    const z1 = Math.floor(z + half);
    for (let yy = y0; yy <= y1; yy++)
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++)
          if (isSolid(this.world.get(xx, yy, zz))) return true;
    return false;
  }

  private worldPathBlocked(fromX: number, fromY: number, fromZ: number, x: number, y: number, z: number, half: number, height: number) {
    const dx = x - fromX;
    const dy = y - fromY;
    const dz = z - fromZ;
    const distance = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const stepSize = Math.max(0.035, Math.min(0.12, half * 0.5));
    const steps = Math.max(1, Math.ceil(distance / stepSize));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      if (this.collidesBox(fromX + dx * t, fromY + dy * t, fromZ + dz * t, half, height)) return true;
    }
    return false;
  }

  mobHalf(m: Mob) {
    return m.collisionHalf * Math.abs(m.group.scale.x);
  }
  mobHeight(m: Mob) {
    return m.collisionHeight * Math.abs(m.group.scale.y);
  }

  /** A shared body-overlap test for mob movement, player movement and safe bot placement. */
  collidesWithMob(
    x: number,
    y: number,
    z: number,
    halfX: number,
    halfZ: number,
    height: number,
    exclude?: Mob,
    padding = 0,
    otherBody?: MobCollisionBody,
  ) {
    const expandedHalfX = halfX + Math.max(0, padding);
    const expandedHalfZ = halfZ + Math.max(0, padding);
    for (const other of this.mobs) {
      if (other === exclude || !other.alive || other.hidden) continue;
      const otherHalf = this.mobHalf(other);
      const otherHeight = this.mobHeight(other);
      if (y >= other.y + otherHeight || y + height <= other.y) continue;
      if (
        x - expandedHalfX < other.x + otherHalf && x + expandedHalfX > other.x - otherHalf &&
        z - expandedHalfZ < other.z + otherHalf && z + expandedHalfZ > other.z - otherHalf
      ) return true;
    }
    if (otherBody &&
        y < otherBody.y + otherBody.height && y + height > otherBody.y &&
        x - expandedHalfX < otherBody.x + otherBody.halfX && x + expandedHalfX > otherBody.x - otherBody.halfX &&
        z - expandedHalfZ < otherBody.z + otherBody.halfZ && z + expandedHalfZ > otherBody.z - otherBody.halfZ) return true;
    return false;
  }

  /** Substep a body path so a large frame delta cannot tunnel through a small creature. */
  collidesAlongMobPath(
    fromX: number,
    fromY: number,
    fromZ: number,
    x: number,
    y: number,
    z: number,
    halfX: number,
    halfZ: number,
    height: number,
    exclude?: Mob,
    padding = 0,
    otherBody?: MobCollisionBody,
  ) {
    const dx = x - fromX;
    const dy = y - fromY;
    const dz = z - fromZ;
    const distance = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const stepSize = Math.max(0.035, Math.min(0.12, Math.min(halfX, halfZ) * 0.5));
    const steps = Math.max(1, Math.ceil(distance / stepSize));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      if (this.collidesWithMob(
        fromX + dx * t,
        fromY + dy * t,
        fromZ + dz * t,
        halfX,
        halfZ,
        height,
        exclude,
        padding,
        otherBody,
      )) return true;
    }
    return false;
  }

  private mobPathBlocked(m: Mob, x: number, y: number, z: number, half: number, height: number, playerBody?: MobCollisionBody) {
    return this.collidesAlongMobPath(
      m.x, m.y, m.z, x, y, z, half, half, height, m, 0, playerBody,
    );
  }

  /** true when the mob's body is submerged */
  private mobInWater(m: Mob) {
    return this.world.get(Math.floor(m.x), Math.floor(m.y + this.mobHeight(m) * 0.5), Math.floor(m.z)) === WATER;
  }

  private pastureBlocked(m: Mob, x: number, z: number) {
    if (m.id !== 'cow' && m.id !== 'calf' && m.id !== 'sheep' && m.id !== 'pig') return false;
    const bx = Math.floor(x), bz = Math.floor(z);
    const nearFeet = this.world.get(bx, Math.floor(m.y - 0.45), bz);
    return this.world.isWinter(bx, bz) || nearFeet === WATER || isLeafId(nearFeet) || isLogId(nearFeet);
  }

  private canStep(m: Mob, x: number, z: number) {
    if (m.id !== 'cow' && m.id !== 'calf' && m.id !== 'sheep' && m.id !== 'pig') return true;
    // Hooves can negotiate a dirt ledge, not a trunk or leaf canopy.
    const block = this.world.get(Math.floor(x), Math.floor(m.y + 0.3), Math.floor(z));
    return block === GRASS || block === DIRT || block === STONE || block === SAND || block === VOLCANIC_STONE;
  }

  private vineNear(x: number, y: number, z: number) {
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
      if (this.world.get(Math.floor(x) + dx, Math.floor(y + 0.4), Math.floor(z) + dz) === VINE) return true;
    }
    return false;
  }

  /** Axis-swept AABB movement against terrain, other creatures, and the player. */
  private move(m: Mob, dt: number, playerBody?: MobCollisionBody) {
    const half = this.mobHalf(m);
    const height = this.mobHeight(m);

    // aquatic mobs float weightless inside water
    if (m.def.aquatic) {
      const inWater = this.world.get(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z)) === WATER;
      if (inWater) {
        m.vy *= Math.pow(0.05, dt);
        m.vy += Math.sin(m.walkPhase) * 0.4 * dt; // gentle bob
        const nx = m.x + m.vx * dt;
        const nz = m.z + m.vz * dt;
        // Stay in water and sweep the full body through terrain and nearby creatures.
        if (
          this.world.get(Math.floor(nx), Math.floor(m.y + 0.3), Math.floor(m.z)) === WATER &&
          !this.worldPathBlocked(m.x, m.y, m.z, nx, m.y, m.z, half, height) &&
          !this.mobPathBlocked(m, nx, m.y, m.z, half, height, playerBody)
        ) m.x = nx;
        else m.vx *= -0.5;
        if (
          this.world.get(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(nz)) === WATER &&
          !this.worldPathBlocked(m.x, m.y, m.z, m.x, m.y, nz, half, height) &&
          !this.mobPathBlocked(m, m.x, m.y, nz, half, height, playerBody)
        ) m.z = nz;
        else m.vz *= -0.5;
        const ny = m.y + m.vy * dt;
        if (
          this.world.get(Math.floor(m.x), Math.floor(ny + 0.3), Math.floor(m.z)) === WATER &&
          !this.worldPathBlocked(m.x, m.y, m.z, m.x, ny, m.z, half, height) &&
          !this.mobPathBlocked(m, m.x, ny, m.z, half, height, playerBody)
        ) m.y = ny;
        else m.vy = 0;
        m.onGround = true;
        return;
      }
      // beached fish flops with normal gravity below
    }

    // un-stick: if the world changed under a mob (player mined it into a wall),
    // lift it to the nearest free space instead of letting it merge with blocks
    if (this.collidesBox(m.x, m.y, m.z, half, height)) {
      let freed = false;
      for (let up = 0.25; up <= 3; up += 0.25) {
        if (!this.collidesBox(m.x, m.y + up, m.z, half, height)) {
          m.y += up;
          freed = true;
          break;
        }
      }
      if (!freed) {
        // Search expanding rings around the mob before giving up: terrain edits
        // or falling sand should relocate animals into the nearest safe space.
        for (let radius=1;radius<=4 && !freed;radius++) {
          const candidates: [number,number][]=[];
          for(let ox=-radius;ox<=radius;ox++) for(let oz=-radius;oz<=radius;oz++)
            if(Math.max(Math.abs(ox),Math.abs(oz))===radius) candidates.push([ox,oz]);
          for(const [ox,oz] of candidates) for(let up=0;up<=2;up+=0.5) {
            if (!this.collidesBox(m.x+ox,m.y+up,m.z+oz,half,height)) {
              m.x+=ox; m.z+=oz; m.y+=up; freed=true; break;
            }
          }
        }
        if (!freed) { m.vx=0; m.vz=0; m.y += 0.25; } // retry next frame; don't kill a trapped animal
      }
      m.vy = Math.min(m.vy, 0);
    }

    // clamp per-frame motion so a lag spike can't tunnel through a wall
    const cap = 0.42;
    const mx = Math.max(-cap, Math.min(cap, m.vx * dt));
    const mz = Math.max(-cap, Math.min(cap, m.vz * dt));

    if (mx !== 0) {
      if (this.pastureBlocked(m, m.x + mx, m.z)) m.vx = 0;
      else if (
        !this.collidesBox(m.x + mx, m.y, m.z, half, height) &&
        !this.mobPathBlocked(m, m.x + mx, m.y, m.z, half, height, playerBody)
      ) m.x += mx;
      else if (
        m.onGround && this.canStep(m, m.x + mx, m.z) &&
        !this.collidesBox(m.x + mx, m.y + 1.02, m.z, half, height) &&
        !this.mobPathBlocked(m, m.x + mx, m.y + 1.02, m.z, half, height, playerBody)
      ) {
        m.x += mx;
        m.y += 1.02;
        if (m.id === 'tumbleweed') m.vy = Math.max(m.vy, 2.8);
      } else if (m.id === 'tumbleweed') {
        m.vx = -m.vx * 0.72;
        m.yaw += Math.PI * 0.65;
      } else m.vx = 0;
    }
    if (mz !== 0) {
      if (this.pastureBlocked(m, m.x, m.z + mz)) m.vz = 0;
      else if (
        !this.collidesBox(m.x, m.y, m.z + mz, half, height) &&
        !this.mobPathBlocked(m, m.x, m.y, m.z + mz, half, height, playerBody)
      ) m.z += mz;
      else if (
        m.onGround && this.canStep(m, m.x, m.z + mz) &&
        !this.collidesBox(m.x, m.y + 1.02, m.z + mz, half, height) &&
        !this.mobPathBlocked(m, m.x, m.y + 1.02, m.z + mz, half, height, playerBody)
      ) {
        m.z += mz;
        m.y += 1.02;
        if (m.id === 'tumbleweed') m.vy = Math.max(m.vy, 2.8);
      } else if (m.id === 'tumbleweed') {
        m.vz = -m.vz * 0.72;
        m.yaw += Math.PI * 0.65;
      } else m.vz = 0;
    }

    // A flying bird steers its own altitude; gravity would turn every
    // wingbeat into another hop. Tumbleweeds experience feather-light gravity
    // and air drag so they float and bounce softly over the desert dunes.
    if ((m.id !== 'bird' || (m.task !== 9 && m.task !== 12)) && !(m.id === 'monkey' && m.task === 13)) {
      m.vy -= (m.id === 'tumbleweed' ? GRAV * 0.32 : GRAV) * dt;
    }
    m.vy = Math.max(m.id === 'bird' ? -2.5 : m.id === 'tumbleweed' ? -6.2 : -28, m.vy);
    if (m.id === 'bird' && (m.task === 9 || m.task === 12)) m.onGround = false;
    const my = Math.max(-0.9, Math.min(0.9, m.vy * dt));
    const ny = m.y + my;
    const hitsTerrainY = this.worldPathBlocked(m.x, m.y, m.z, m.x, ny, m.z, half, height);
    const hitsMobY = this.mobPathBlocked(m, m.x, ny, m.z, half, height, playerBody);
    if (!hitsTerrainY && !hitsMobY) {
      m.y = ny;
      m.onGround = false;
    } else if (my < 0 && hitsTerrainY) {
      // land: snap the feet onto the highest solid corner under the box
      const impactVy = m.vy;
      m.y = Math.floor(ny) + 1.001;
      let guard = 0;
      while (this.collidesBox(m.x, m.y, m.z, half, height) && guard++ < 4) m.y += 1;
      if (m.id === 'tumbleweed' && impactVy < -1.35) {
        m.vy = Math.min(3.2, -impactVy * 0.5);
        m.onGround = false;
      } else {
        m.vy = 0;
        m.onGround = true;
      }
    } else {
      m.vy = 0; // bonked a ceiling or a creature
      if (my < 0) m.onGround = false;
    }
    if (m.y < -8) m.hp = 0;
  }

  update(
    dt: number,
    px: number,
    py: number,
    pz: number,
    daylight: number,
    onAttack: (m: Mob, dmg: number, targetId?: string | null) => void,
    onBurnDeath: (m: Mob) => void,
    onRanged?: (m: Mob) => void,
    onForage?: (x: number, y: number, z: number) => void,
    onFeed?: (x: number, y: number, z: number, food: number) => void,
    hostileTargets: readonly MobThreatTarget[] = [],
    playerBody?: MobCollisionBody,
  ) {
    this.tick++;
    // cats scare creepers & spiders — collect their positions once per frame
    const cats: Mob[] = [];
    for (const m of this.mobs) if (m.alive && m.id === 'cat') cats.push(m);
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (!m.alive) continue;
      const def = m.def;

      // hidden mobs (bees inside a hive) — invisible, frozen, zero cost
      if (m.hidden) {
        m.group.visible = false;
        continue;
      }
      if (m.healthBarTimer > 0) {
        this.updateHealthBar(m);
        m.healthBarTimer = Math.max(0, m.healthBarTimer - dt);
        if (m.healthBarTimer === 0 && m.healthBarFill) m.healthBarFill.visible = false;
      }
      if (def.hostile && daylight > 0.55) {
        const exposedToSun = this.world.topSolidY(Math.floor(m.x), Math.floor(m.z)) <= Math.floor(m.y);
        if (shouldDieInDaylight(true, daylight, exposedToSun)) {
          // No fleeing exception: every hostile left in direct daylight on an open surface dies.
          onBurnDeath(m);
          if (m.alive) this.remove(m);
          continue;
        }
      }

      // --- LOD: far mobs think in slow-motion and skip animation ---
      const distSq = (m.x - px) * (m.x - px) + (m.z - pz) * (m.z - pz);
      let mdt = dt;
      if (distSq > 2500) {
        // >50 blocks: hide + update 1 frame in 8 with compensated dt
        m.group.visible = false;
        if (((this.tick + i) & 7) !== 0) continue;
        mdt = dt * 8;
      } else if (distSq > 1024) {
        // >32 blocks: visible but half-rate AI
        m.group.visible = true;
        if (((this.tick + i) & 1) !== 0) continue;
        mdt = dt * 2;
      } else {
        m.group.visible = true;
      }

      // --- sunlight --- (column scan staggered: each mob checks every 8th frame)
      if (def.burns && daylight > 0.55 && ((this.tick + i) & 7) === 0) {
        const exposed = this.world.topSolidY(Math.floor(m.x), Math.floor(m.z)) <= Math.floor(m.y);
        if (exposed) {
          // spiders are cave-dwellers: they sprint for cover instead of igniting.
          // Only if truly stuck in the open do they start to smoulder.
          if (m.id === 'spider') {
            if (m.task !== 7) {
              const cave = this.findCoverNear(m.x, m.y, m.z, 14);
              if (cave) {
                m.task = 7; // fleeing to shade
                m.taskX = cave[0];
                m.taskY = cave[1];
                m.taskZ = cave[2];
                m.taskT = 12;
              } else m.burn = Math.max(m.burn, 0.6); // nowhere to hide
            }
          } else {
            m.burn = Math.max(m.burn, 0.6);
          }
        } else if (m.id === 'spider' && m.task === 7) {
          m.task = 0; // reached shade — safe
        }
      }
      // spider shade-run overrides normal AI targeting
      if (m.id === 'spider' && m.task === 7) {
        m.taskT -= mdt;
        m.tx = m.taskX;
        m.tz = m.taskZ;
        m.think = 2;
        const mx7 = m.taskX - m.x;
        const mz7 = m.taskZ - m.z;
        const md7 = Math.hypot(mx7, mz7) || 1;
        m.vx += ((mx7 / md7) * def.speed * 1.3 - m.vx) * Math.min(1, mdt * 9);
        m.vz += ((mz7 / md7) * def.speed * 1.3 - m.vz) * Math.min(1, mdt * 9);
        m.yaw = Math.atan2(-mx7, -mz7);
        this.move(m, mdt, playerBody);
        m.group.position.set(m.x, m.y, m.z);
        m.group.rotation.y = m.yaw;
        if (m.taskT <= 0 || md7 < 1.2) m.task = 0;
        continue; // skip chase/wander this frame
      }
      if (m.burn > 0) {
        m.burn -= mdt;
        m.burnTick -= mdt;
        if (m.burnTick <= 0) {
          m.burnTick = 0.5;
          m.hp -= 2.5;
          m.hurtFlash = 0.15;
        }
        if (m.hp <= 0) {
          onBurnDeath(m);
          this.remove(m);
          continue;
        }
      }
      if (m.slow > 0) m.slow -= mdt;
      if (m.hurtFlash > 0) m.hurtFlash -= mdt;
      if (m.cd > 0) m.cd -= mdt;
      if (m.jumpCd > 0) m.jumpCd -= mdt;

      let targetX = px;
      let targetY = py;
      let targetZ = pz;
      let targetId: string | null = null;
      let targetDistSq = (px - m.x) ** 2 + (pz - m.z) ** 2;
      // Local fallback miners can draw melee hostiles away from the player. Recorded Yandex sessions
      // are not treated as live targets, and ranged mobs keep their normal player target.
      if (def.hostile && !def.ranged) {
        for (const candidate of hostileTargets) {
          const dx2 = candidate.x - m.x;
          const dz2 = candidate.z - m.z;
          const d2 = dx2 * dx2 + dz2 * dz2;
          if (d2 < targetDistSq && Math.abs(candidate.y - m.y) < 9) {
            targetDistSq = d2;
            targetX = candidate.x;
            targetY = candidate.y;
            targetZ = candidate.z;
            targetId = candidate.id;
          }
        }
      }
      const dx = targetX - m.x;
      const dz = targetZ - m.z;
      const dy = targetY - m.y;
      const dist = Math.hypot(dx, dz);
      const speedMul = m.slow > 0 ? 0.45 : 1;

      let mx = 0;
      let mz = 0;

      // creepers & spiders flee from cats instead of attacking
      let fleeCat: Mob | null = null;
      if ((def.id === 'creeper' || def.id === 'spider') && cats.length) {
        for (const c of cats) {
          if (Math.hypot(c.x - m.x, c.z - m.z) < 10) {
            fleeCat = c;
            break;
          }
        }
      }

      if (fleeCat) {
        // run directly away from the cat; fuse fizzles out
        const fx2 = m.x - fleeCat.x;
        const fz2 = m.z - fleeCat.z;
        const fd = Math.hypot(fx2, fz2) || 1;
        mx = (fx2 / fd) * def.speed * 1.15 * speedMul;
        mz = (fz2 / fd) * def.speed * 1.15 * speedMul;
        m.yaw = Math.atan2(-mx, -mz);
        m.fuse = -1;
        if (m.onGround && m.jumpCd <= 0 && Math.random() < mdt * 1.5) {
          m.vy = 7.6;
          m.jumpCd = 0.6;
        }
      } else if (def.hostile && dist < 22 && Math.abs(dy) < 9) {
        // --- chase --- (models face -Z, so aim the back of the head at +dir)
        m.yaw = Math.atan2(-dx, -dz);
        if (def.ranged) {
          // archer: hold 6-13 blocks, kite closer players, shoot on LOS
          if (dist < 6) {
            mx = (-dx / (dist || 1)) * def.speed * speedMul;
            mz = (-dz / (dist || 1)) * def.speed * speedMul;
          } else if (dist > 13) {
            mx = (dx / (dist || 1)) * def.speed * speedMul;
            mz = (dz / (dist || 1)) * def.speed * speedMul;
          }
          if (m.cd <= 0 && dist < 16 && this.lineOfSight(m, targetX, targetY + 1.2, targetZ)) {
            m.cd = def.cooldown;
            onRanged?.(m);
          }
        } else if (dist > def.reach * 0.75) {
          mx = (dx / (dist || 1)) * def.speed * speedMul;
          mz = (dz / (dist || 1)) * def.speed * speedMul;
        }
        // melee needs an unobstructed line — no biting through walls or floors
        const canTouch =
          !def.ranged && dist < def.reach && Math.abs(dy) < 2.2 && this.lineOfSight(m, targetX, targetY + 1.2, targetZ);
        // creeper fuse
        if (def.explodes) {
          if (canTouch) {
            if (m.fuse < 0) m.fuse = 1.35;
          } else if (m.fuse > 0 && dist > def.reach * 1.9) m.fuse = -1;
          if (m.fuse > 0) {
            m.fuse -= mdt;
            mx *= 0.25;
            mz *= 0.25;
            if (m.fuse <= 0) {
              onAttack(m, def.damage, targetId);
              this.remove(m);
              continue;
            }
          }
        } else if (canTouch && m.cd <= 0) {
          m.cd = def.cooldown;
          onAttack(m, def.damage, targetId);
        }
        // hop over obstacles / up to the player
        if (m.onGround && m.jumpCd <= 0 && (dy > 0.6 || (dist < 6 && Math.random() < mdt * 1.2))) {
          m.vy = 8.4;
          m.jumpCd = 0.6;
        }
      } else {
        // --- passive reactions to the player ---
        const playerClose = dist < 4.5;

        // turtles: freeze and pull head + legs into the shell
        if (m.id === 'turtle') {
          const target = playerClose ? 1 : 0;
          m.shellT += (target - m.shellT) * Math.min(1, mdt * 5);
          const hide = m.shellT > 0.5;
          for (const p of m.retractParts) p.visible = !hide;
          if (playerClose) {
            // stop dead — a stone with a shell
            m.vx *= 0.6;
            m.vz *= 0.6;
            m.tx = m.x;
            m.tz = m.z;
            m.think = 1.5;
            this.move(m, mdt, playerBody);
            m.group.position.set(m.x, m.y, m.z);
            m.group.rotation.y = m.yaw;
            continue; // skip walking anim while hiding
          }
        }

        // crabs: flee to water or bury into sand (still catchable at 0.8x player walk).
        // The escape DECISION is made once (task 8 = fleeing) and the target is
        // locked in — re-rolling it every frame made crabs spin in circles.
        if (m.id === 'crab') {
          if (m.buried > 0) {
            m.buried -= mdt;
            m.group.position.set(m.x, m.y - 0.22, m.z); // just eyes above the sand
            if (playerClose) m.buried = Math.max(m.buried, 0.8); // stay under while looming
            if (m.buried <= 0) m.group.position.set(m.x, m.y, m.z);
            continue;
          }
          // already safe in water? stop panicking entirely
          const crabInWater = this.world.get(Math.floor(m.x), Math.floor(m.y + 0.2), Math.floor(m.z)) === WATER;
          if (crabInWater && m.task === 8) {
            m.task = 0;
            m.think = 3;
            m.tx = m.x;
            m.tz = m.z;
          }
          if (playerClose && m.task !== 8 && !crabInWater) {
            // decide ONCE how to escape
            m.task = 8;
            m.taskT = 6; // long commitment — no target churn
            const water = this.world.findWaterNear(m.x, m.z, 8);
            const onSand = this.world.get(Math.floor(m.x), Math.floor(m.y - 0.5), Math.floor(m.z)) === SAND;
            if (water) {
              // aim PAST the water's edge so the crab runs into the deep,
              // not to a point it can reach and then dither around
              const wx3 = water[0] - m.x;
              const wz3 = water[2] - m.z;
              const wd3 = Math.hypot(wx3, wz3) || 1;
              m.taskX = water[0] + (wx3 / wd3) * 3;
              m.taskZ = water[2] + (wz3 / wd3) * 3;
            } else if (onSand && dist > 2.2 && Math.random() < 0.6) {
              m.task = 0;
              m.buried = 2.5 + Math.random() * 2; // dig in instead
              continue;
            } else {
              const fx3 = m.x - px;
              const fz3 = m.z - pz;
              const fd3 = Math.hypot(fx3, fz3) || 1;
              m.taskX = m.x + (fx3 / fd3) * 10;
              m.taskZ = m.z + (fz3 / fd3) * 10;
            }
          }
          if (m.task === 8) {
            m.taskT -= mdt;
            // hold the locked escape target — no per-frame re-rolls
            m.tx = m.taskX;
            m.tz = m.taskZ;
            m.think = 1;
            if (m.taskT <= 0) {
              m.task = 0;
              m.think = 0.5; // brief pause before any new decision
            }
          }
        }

        // Brooding birds sit tight on their eggs (engine releases them at hatch).
        // Chickens still cannot fly; this only pins them gently to the nest.
        if ((m.id === 'penguin' || m.id === 'bird' || m.id === 'chicken') && m.task === 6) {
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 2;
          const nd = Math.hypot(m.x - m.taskX, m.z - m.taskZ);
          if (nd < 0.5) {
            // settled: waddle/perch in place, no wandering off
            m.vx *= 0.45;
            m.vz *= 0.45;
          }
        }

        // Grazers deliberately visit plants and water, rather than just
        // wandering over them. Keep food and drink cooldowns separate.
        const grazer = ['cow', 'calf', 'sheep', 'pig', 'camel', 'camel_calf', 'deer', 'roe_deer', 'moose', 'fawn'].includes(m.id);
        if (grazer) {
          m.forageCd -= mdt;
          m.drinkCd -= mdt;
          if (m.task === 10) {
            m.think = 1;
            m.taskT -= mdt;
            const food = this.world.get(m.taskX, m.taskY, m.taskZ);
            if (m.taskT <= 0 || food === 0) m.task = 0;
            else if (m.onGround && Math.hypot(m.tx - m.x, m.tz - m.z) < 0.48 &&
                Math.abs(m.y - m.taskY) < 2) {
              // Do not eat on contact. Settle in place for several visible
              // head dips and bites; the plant remains until the last bite.
              m.task = 14;
              m.feedFoodId = food;
              m.feedClock = 0;
              m.taskT = CHEW_SECONDS;
              m.tx = m.x; m.tz = m.z;
            }
          } else if (m.task === 14) {
            m.think = 1;
            m.tx = m.x; m.tz = m.z;
            const fx = m.taskX + 0.5 - m.x, fz = m.taskZ + 0.5 - m.z;
            if (Math.hypot(fx, fz) > 0.01) m.yaw = Math.atan2(-fx, -fz);
            const previousFeedClock = m.feedClock;
            m.feedClock += mdt;
            m.taskT -= mdt;
            const food = this.world.get(m.taskX, m.taskY, m.taskZ);
            if (Math.floor(previousFeedClock / 0.78) < Math.floor(m.feedClock / 0.78))
              onFeed?.(m.x, m.y + 0.5, m.z, food);
            if (!m.onGround || food !== m.feedFoodId) {
              m.task = 0; // the player or another animal took the food
              m.feedClock = 0;
            } else if (m.taskT <= 0) {
              if ((m.id === 'camel' || m.id === 'camel_calf') ? isFlower(food) || food === CACTUS || food === CACTUS_PALE :
                isFlower(food) || food === TALL_GRASS || food === FERN) {
                // Eat a cactus from its tip, never leave a floating stalk.
                let fy = m.taskY;
                if (food === CACTUS || food === CACTUS_PALE)
                  while (fy + 1 < WY && this.world.get(m.taskX, fy + 1, m.taskZ) === food) fy++;
                this.world.set(m.taskX, fy, m.taskZ, 0);
                onForage?.(m.taskX, fy, m.taskZ);
                m.hp = Math.min(m.maxHp, m.hp + 0.5);
              }
              m.forageCd = 9 + Math.random() * 10;
              m.task = 0;
            }
          } else if (m.task === 11) {
            m.think = 1;
            m.taskT -= mdt;
            if (Math.hypot(m.tx - m.x, m.tz - m.z) < 1.3) {
              if (m.taskX !== 1) { m.taskX = 1; m.taskT = 2.5; }
              m.tx = m.x; m.tz = m.z; // pause at the water's edge
              if (m.taskT < 0) { m.task = 0; m.drinkCd = 16 + Math.random() * 15; }
            } else if (m.taskT < 0) m.task = 0;
          } else if (m.onGround && (m.drinkCd <= 0 || m.forageCd <= 0)) {
            const drinking = m.drinkCd <= 0 && (m.forageCd > 0 || Math.random() < 0.45);
            for (let tries = 0; tries < 30; tries++) {
              const bx = Math.floor(m.x + (Math.random() - 0.5) * 11);
              const bz = Math.floor(m.z + (Math.random() - 0.5) * 11);
              if (!this.world.hasColumn(bx, bz)) continue;
              const h = this.world.getHeight(bx, bz);
              const ground = this.world.get(bx, h, bz);
              const desert = m.id === 'camel' || m.id === 'camel_calf';
              if (desert ? ground !== SAND : ground !== GRASS) continue;
              const plant = this.world.get(bx, h + 1, bz);
              if (drinking) {
                if (![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) =>
                  this.world.get(bx + dx, h, bz + dz) === WATER || this.world.get(bx + dx, h - 1, bz + dz) === WATER)) continue;
                m.tx = bx + 0.5; m.tz = bz + 0.5;
                m.task = 11; m.taskX = 0;
                m.taskT = 4 + Math.hypot(m.tx - m.x, m.tz - m.z) / (m.def.speed * 0.5);
                break;
              }
              if (desert ? plant !== CACTUS && plant !== CACTUS_PALE && plant !== DRY_BLOOM && plant !== DESERT_THISTLE :
                !isFlower(plant) && plant !== TALL_GRASS && plant !== FERN) continue;
              m.taskX = bx; m.taskY = h + 1; m.taskZ = bz;
              // Stop immediately beside the plant, with the muzzle facing it.
              // This keeps the head within reach without walking into the block.
              let approach: [number, number] | null = null;
              const sides: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
              sides.sort((a,b) =>
                Math.hypot(bx + b[0] * 0.62 + 0.5 - m.x, bz + b[1] * 0.62 + 0.5 - m.z) -
                Math.hypot(bx + a[0] * 0.62 + 0.5 - m.x, bz + a[1] * 0.62 + 0.5 - m.z));
              for (const [dx,dz] of sides) {
                const tx = bx + 0.5 + dx * 0.62, tz = bz + 0.5 + dz * 0.62;
                if (this.world.get(bx + dx, h, bz + dz) !== (desert ? SAND : GRASS)) continue;
                if (this.world.get(bx + dx, h + 1, bz + dz) !== 0) continue;
                if (this.collidesBox(tx, m.y, tz, this.mobHalf(m), this.mobHeight(m))) continue;
                approach = [tx,tz]; break;
              }
              if (!approach) continue;
              [m.tx, m.tz] = approach;
              m.task = 10;
              m.taskT = 4 + Math.hypot(m.tx - m.x, m.tz - m.z) / (m.def.speed * 0.5);
              break;
            }
            if (drinking) m.drinkCd = 8; // retry if no shoreline was found
            else m.forageCd = 9 + Math.random() * 10;
          }
        }
        if (m.id === 'monkey' && m.task !== 13 && this.vineNear(m.x, m.y, m.z) && Math.random() < mdt * 1.1) {
          m.task = 13;
          m.taskT = 3;
        }
        if (m.id === 'monkey' && m.task === 13) {
          m.taskT -= mdt;
          if (m.taskT <= 0 || !this.vineNear(m.x, m.y, m.z)) {
            m.task = 0;
            for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
              const xx = Math.floor(m.x) + dx, zz = Math.floor(m.z) + dz;
              if (isLeafId(this.world.get(xx, Math.floor(m.y - 0.5), zz))) {
                m.tx = xx + 0.5; m.tz = zz + 0.5; m.think = 2; m.vy = 2.5;
              }
            }
          } else { m.vy = 2.6; m.onGround = false; }
        }

        // Lizards skitter away as soon as the player approaches.
        if (m.id === 'lizard' && dist < 6) {
          const awayX = (m.x - px) / (dist || 1);
          const awayZ = (m.z - pz) / (dist || 1);
          m.tx = m.x + awayX * 9;
          m.tz = m.z + awayZ * 9;
          m.think = 0.6;
        }

        // Birds can perch, hop on ground/canopy, then use explicit takeoff
        // and landing phases. Chickens are separate mobs and never enter this path.
        if (m.id === 'bird' && m.task !== 6) {
          const takingOff = m.task === 15;
          const flying = m.task === 9;
          const landing = m.task === 12;
          const touchdown = m.task === 16;
          const perched = m.onGround && !takingOff && !flying && !landing && !touchdown;

          if (touchdown) {
            m.taskT -= mdt;
            m.tx = m.x;
            m.tz = m.z;
            m.vx *= 0.72;
            m.vz *= 0.72;
            if (m.taskT <= 0) {
              m.task = 0;
              m.think = 0.8 + Math.random() * 1.8;
              m.jumpCd = 0.45;
            }
          }

          if (perched && m.grow <= 0 && m.jumpCd <= 0) {
            const scared = dist < 5.2;
            const wantsFlight = scared || Math.random() < mdt * 0.055;
            if (wantsFlight) {
              const ground = this.world.topSolidY(Math.floor(m.x), Math.floor(m.z));
              const ceiling = WY - 2 - this.mobHeight(m);
              if (ground + 4 < ceiling) {
                m.task = 15; // crouch + wingbeat wind-up
                m.taskT = 0.48;
                m.taskY = Math.min(ceiling, ground + 4 + Math.random() * 3);
                const a = scared ? Math.atan2(m.z - pz, m.x - px) + (Math.random() - 0.5) * 0.6 : Math.random() * Math.PI * 2;
                const flyDist = scared ? 20 : 14 + Math.random() * 8;
                m.tx = m.x + Math.cos(a) * flyDist;
                m.tz = m.z + Math.sin(a) * flyDist;
                m.think = 1;
              }
            }
          }

          if (m.task === 15) {
            m.taskT -= mdt;
            m.think = 1;
            m.vx *= Math.max(0, 1 - mdt * 5);
            m.vz *= Math.max(0, 1 - mdt * 5);
            if (m.taskT < 0.25) m.vy = Math.max(m.vy, 1.6 + (0.25 - m.taskT) * 4.5);
            if (m.taskT <= 0) {
              m.task = 9;
              m.taskT = 6 + Math.random() * 5;
              m.vy = Math.max(m.vy, 2.8);
              m.onGround = false;
              m.jumpCd = 0.8;
              m.think = m.taskT;
            }
          }

          if (m.task === 9 && m.grow <= 0 && (((this.tick + i) % 34 === 0) || m.taskT < 2.2)) {
            // Prefer exposed leaf tops, but allow landing on open ground too.
            let landed = false;
            for (const pass of [0, 1]) {
              const needLeaf = pass === 0;
              const tries = needLeaf ? 12 : 10;
              for (let attempt = 0; attempt < tries; attempt++) {
                const radius = needLeaf ? 15 : 12;
                const bx = Math.floor(m.x + (Math.random() - 0.5) * radius);
                const bz = Math.floor(m.z + (Math.random() - 0.5) * radius);
                if (!this.world.hasColumn(bx, bz)) continue;
                const h = this.world.topSolidY(bx, bz);
                if (h >= WY - 3 || this.world.get(bx, h + 1, bz) !== 0) continue;
                const ground = this.world.get(bx, h, bz);
                const leaf = isLeafId(ground);
                const openGround = ground === GRASS || ground === SAND || ground === SNOW_GRASS || ground === STONE || ground === VOLCANIC_STONE;
                if (needLeaf ? !leaf : (!leaf && !openGround)) continue;
                m.task = 12;
                m.taskT = 5.5;
                m.taskY = h + 1.05;
                m.tx = bx + 0.5;
                m.tz = bz + 0.5;
                m.think = 6;
                landed = true;
                break;
              }
              if (landed) break;
            }
          }
          if (m.task === 12) {
            m.taskT -= mdt;
            const horizontal = Math.hypot(m.tx - m.x, m.tz - m.z);
            if (m.taskT <= 0 || (horizontal < 0.52 && Math.abs(m.y - m.taskY) < 0.55)) {
              m.task = 16; // touchdown: wings fold before hopping again
              m.taskT = 0.58;
              m.vy = Math.min(m.vy, -0.25);
              m.tx = m.x;
              m.tz = m.z;
              m.think = 1;
            } else {
              const desired = Math.max(-2.2, Math.min(2.6, (m.taskY + 0.25 - m.y) * 1.9));
              m.vy += (desired - m.vy) * Math.min(1, mdt * 4);
            }
          }
          if (m.task === 9) {
            m.taskT -= mdt;
            if (m.taskT <= 0) {
              m.task = 12; // tired: settle near the current spot
              m.taskT = 4.5;
              m.taskY = Math.max(1, this.world.topSolidY(Math.floor(m.x), Math.floor(m.z)) + 1.05);
              m.tx = m.x;
              m.tz = m.z;
              m.vy = Math.min(m.vy, -0.35);
              m.jumpCd = 2.0;
            } else {
              if (Math.hypot(m.tx - m.x, m.tz - m.z) < 2) {
                const a = Math.random() * Math.PI * 2;
                m.tx = m.x + Math.cos(a) * 18;
                m.tz = m.z + Math.sin(a) * 18;
              }
              const toTargetX = m.tx - m.x;
              const toTargetZ = m.tz - m.z;
              const targetDist = Math.hypot(toTargetX, toTargetZ) || 1;
              const aheadX = Math.floor(m.x + (toTargetX / targetDist) * 3);
              const aheadZ = Math.floor(m.z + (toTargetZ / targetDist) * 3);
              const terrain = Math.max(
                this.world.topSolidY(Math.floor(m.x), Math.floor(m.z)),
                this.world.topSolidY(aheadX, aheadZ),
              );
              const targetY = Math.min(WY - 2 - this.mobHeight(m), Math.max(m.taskY, terrain + 4));
              const desiredVy = Math.max(-1.5, Math.min(3.5, (targetY - m.y) * 1.7));
              m.vy += (desiredVy - m.vy) * Math.min(1, mdt * 3);
            }
          }
        }

        // --- calf following mother cow ---
        if (m.id === 'calf') {
          let mother: Mob | null = null;
          let mDist = 28;
          for (const c of this.mobs) {
            if (c.alive && c.id === 'cow') {
              const cd = Math.hypot(c.x - m.x, c.z - m.z);
              if (cd < mDist) {
                mDist = cd;
                mother = c;
              }
            }
          }
          if (mother) {
            if (mDist > 2.8) {
              m.tx = mother.x + (Math.random() - 0.5) * 1.5;
              m.tz = mother.z + (Math.random() - 0.5) * 1.5;
              m.think = 1.6;
            } else {
              m.tx = m.x;
              m.tz = m.z;
              m.think = 2.0;
            }
          }
        }

        // --- wander ---
        m.think -= mdt;
        if (m.think <= 0 && m.task !== 9 && m.task !== 10 && m.task !== 11 && m.task !== 12 && m.task !== 14 && m.task !== 15 && m.task !== 16) {
          m.think = 2 + Math.random() * 4;
          if (Math.random() < 0.62) {
            const a = Math.random() * Math.PI * 2;
            const r = 4 + Math.random() * 9;
            let nx = m.x + Math.cos(a) * r;
            let nz = m.z + Math.sin(a) * r;
            if (m.id === 'fish' && m.variant === 4) {
              // Fry keep their little schools together instead of scattering.
              const friends = this.mobs.filter((f) => f.alive && f.id === 'fish' && f.variant === 4 && Math.hypot(f.x - m.x, f.z - m.z) < 4);
              if (friends.length > 1) {
                nx = friends.reduce((sum, f) => sum + f.x, 0) / friends.length + (Math.random() - 0.5) * 2;
                nz = friends.reduce((sum, f) => sum + f.z, 0) / friends.length + (Math.random() - 0.5) * 2;
              }
            }
            if (m.id === 'monkey') {
              let nearest = 36;
              for (let ox = -6; ox <= 6; ox++) for (let oz = -6; oz <= 6; oz++) {
                const bx = Math.floor(m.x) + ox, bz = Math.floor(m.z) + oz;
                if (this.world.get(bx, Math.floor(m.y + 0.4), bz) !== VINE) continue;
                const ds = ox * ox + oz * oz;
                if (ds < nearest) { nearest = ds; nx = bx + 0.5; nz = bz + 0.5; }
              }
            }
            if (m.id === 'bird') {
              // Short hops only: on the ground they peck around, on trees they
              // hop between nearby leaf tops instead of instantly flying away.
              m.think = 0.55 + Math.random() * 1.35;
              const currentH = this.world.topSolidY(Math.floor(m.x), Math.floor(m.z));
              const currentGround = this.world.get(Math.floor(m.x), currentH, Math.floor(m.z));
              const preferLeaves = isLeafId(currentGround);
              let foundHop = false;
              for (let attempt = 0; attempt < 18; attempt++) {
                const bx = Math.floor(m.x + (Math.random() - 0.5) * 5.5);
                const bz = Math.floor(m.z + (Math.random() - 0.5) * 5.5);
                if (!this.world.hasColumn(bx, bz)) continue;
                const h = this.world.topSolidY(bx, bz);
                if (Math.abs(h + 1.05 - m.y) > 1.25 || this.world.get(bx, h + 1, bz) !== 0) continue;
                const ground = this.world.get(bx, h, bz);
                const leaf = isLeafId(ground);
                const walkable = leaf || ground === GRASS || ground === SAND || ground === SNOW_GRASS || ground === STONE || ground === VOLCANIC_STONE;
                if (!walkable) continue;
                if (preferLeaves && !leaf && Math.random() < 0.75) continue;
                nx = bx + 0.5;
                nz = bz + 0.5;
                foundHop = true;
                break;
              }
              if (!foundHop) { nx = m.x; nz = m.z; }
            }
            if (m.id === 'cow' || m.id === 'calf' || m.id === 'sheep' || m.id === 'pig') {
              // The upper ground block must actually be grass, not ice, water or leaves.
              if (this.world.get(Math.floor(nx), this.world.topSolidY(Math.floor(nx), Math.floor(nz)), Math.floor(nz)) !== GRASS) {
                nx = m.x; nz = m.z;
              }
            }
            if (m.id === 'seal' && this.world.biomeAt(Math.floor(nx), Math.floor(nz)) !== 'winter') {
              nx = m.x; nz = m.z;
            }
            if ((m.id === 'camel' || m.id === 'camel_calf') && !['desert', 'canyon'].includes(this.world.biomeAt(Math.floor(nx), Math.floor(nz)))) {
              nx = m.x; nz = m.z;
            }
            if (m.id === 'monkey' && this.world.biomeAt(Math.floor(nx), Math.floor(nz)) !== 'jungle') {
              nx = m.x; nz = m.z;
            }
            // land animals refuse wander targets that sit in open water
            const shoreDweller = m.id === 'turtle' || m.id === 'crab' || m.id === 'penguin';
            if (!m.def.aquatic && !shoreDweller) {
              const ty = this.world.topSolidY(Math.floor(nx), Math.floor(nz));
              // topSolidY treats water as a hit — check the cell itself
              if (this.world.get(Math.floor(nx), ty, Math.floor(nz)) === WATER) {
                m.tx = m.x;
                m.tz = m.z;
              } else {
                m.tx = nx;
                m.tz = nz;
              }
            } else {
              m.tx = nx;
              m.tz = nz;
            }
          } else {
            m.tx = m.x;
            m.tz = m.z;
          }
        }
        // flee from the player when hit recently
        if (m.id === 'tumbleweed') {
          // Feather-light desert tumbleweed: driven by shifting desert wind gusts,
          // bouncing softly over the sand and skittering away from player drafts.
          const windAngle = 0.62 + Math.sin(this.tick * 0.004) * 0.55 + Math.sin(m.walkPhase * 0.45 + i * 1.7) * 0.35;
          const gust =
            0.62 +
            0.38 * Math.sin(this.tick * 0.028 + i * 1.3) +
            0.28 * Math.max(0, Math.sin(this.tick * 0.065 + i * 2.1));
          let windX = Math.cos(windAngle) * def.speed * gust;
          let windZ = Math.sin(windAngle) * def.speed * gust;
          // Player air draft nudges nearby tumbleweeds lightly
          if (dist < 2.4 && dist > 0.05) {
            const push = ((2.4 - dist) / 2.4) * 2.6;
            windX -= (dx / dist) * push;
            windZ -= (dz / dist) * push;
            if (m.onGround && m.jumpCd <= 0) {
              m.vy = 2.4 + Math.random() * 1.2;
              m.jumpCd = 0.22;
            }
          }
          // Avoid drifting into open water
          const aheadX = Math.floor(m.x + windX * 0.8);
          const aheadZ = Math.floor(m.z + windZ * 0.8);
          const aheadTop = this.world.topSolidY(aheadX, aheadZ);
          if (this.world.get(aheadX, aheadTop, aheadZ) === WATER) {
            windX = -windX;
            windZ = -windZ;
          }
          mx = windX;
          mz = windZ;
          m.yaw = Math.atan2(-mx, -mz);
          // Frequent, buoyant little skips across the desert floor
          if (m.onGround && m.jumpCd <= 0 && Math.hypot(mx, mz) > 0.4) {
            m.vy = 1.85 + gust * 1.55 + Math.random() * 0.95;
            m.jumpCd = 0.26 + Math.random() * 0.42;
          }
        } else {
          const wx = m.tx - m.x;
          const wz = m.tz - m.z;
          const wd = Math.hypot(wx, wz);
          if (wd > 1.0) {
            // dead-zone widened: a target under the feet no longer whips the yaw around
            m.yaw = Math.atan2(-wx, -wz);
            const birdAir = m.id === 'bird' && (m.task === 9 || m.task === 12);
            const pace = birdAir ? 1.5 : m.id === 'bird' ? 0.48 : m.id === 'lizard' && dist < 6 ? 1.15 : 0.6;
            mx = (wx / wd) * def.speed * pace * speedMul;
            mz = (wz / wd) * def.speed * pace * speedMul;
            const birdCanHop = m.id === 'bird' && !birdAir && m.task !== 15 && m.task !== 16;
            const hopChance = m.id === 'rabbit' ? 6 : m.id === 'frog' ? 5.2 : m.id === 'bee' ? 8 : birdCanHop ? 3.4 : m.id === 'bird' || m.id === 'lizard' || m.id === 'cow' || m.id === 'calf' || m.id === 'sheep' || m.id === 'camel' || m.id === 'camel_calf' ? 0 : m.id === 'fawn' ? 1.4 : 0.8;
            if (m.onGround && m.jumpCd <= 0 && Math.random() < mdt * hopChance) {
              m.vy = m.id === 'rabbit' ? 5.8 : m.id === 'frog' ? 4.8 : m.id === 'bird' ? 3.0 : m.id === 'bee' ? 4.6 : m.id === 'chicken' ? 5.3 : 7.6;
              m.jumpCd = m.id === 'rabbit' ? 0.25 : m.id === 'frog' ? 0.35 : m.id === 'bird' ? 0.32 : m.id === 'bee' ? 0.3 : 1.2;
            }
            if (m.id === 'bee' && m.vy < -1.2) m.vy = -1.2;
          }
        }
      }

      // ================= WATER BEHAVIOUR BY SPECIES =================
      if (!m.def.aquatic && this.mobInWater(m)) {
        const bottomWalker = m.id === 'turtle' || m.id === 'crab' || m.id === 'penguin';
        if (m.id === 'frog') {
          // frogs happily bob and swim instead of drowning
          m.drown = 0;
          m.vy = Math.max(m.vy, 1.7);
          mx *= 1.25;
          mz *= 1.25;
          if (Math.random() < mdt * 0.9) {
            const water = this.world.findWaterNear(m.x, m.z, 7);
            if (water) { m.tx = water[0] + 0.5; m.tz = water[2] + 0.5; }
          }
        } else if (bottomWalker) {
          // turtles/crabs stroll along the lake bed; turtles can also swim up
          m.vy = Math.max(m.vy - 6 * mdt, -1.4); // gentle sinking
          if (m.id === 'turtle' && Math.random() < mdt * 0.5) m.vy = 3.2; // paddle up now and then
          mx *= 0.6;
          mz *= 0.6;
          m.drown = 0;
        } else {
          // land animals panic-swim for shore; rabbits are the quickest escapers
          m.drown += mdt;
          const panic = m.id === 'rabbit' ? 2.2 : 1.3;
          m.vy = Math.max(m.vy, 2.6); // bob to the surface
          // paddle away from deep water: keep the current wander target but faster
          mx *= panic;
          mz *= panic;
          if (m.onGround === false && Math.random() < mdt * 2) {
            // splashing — reroll the wander target so they don't circle in place
            const a = Math.random() * Math.PI * 2;
            m.tx = m.x + Math.cos(a) * 8;
            m.tz = m.z + Math.sin(a) * 8;
            m.think = 2;
          }
          // out of air → drowned (rabbits get less air, they're small)
          const airMax = m.id === 'rabbit' ? 7 : 11;
          if (m.drown > airMax) {
            m.hp = 0;
          }
        }
      } else {
        m.drown = 0;
      }

      m.vx += (mx - m.vx) * Math.min(1, mdt * (m.id === 'tumbleweed' ? 4.5 : 9));
      m.vz += (mz - m.vz) * Math.min(1, mdt * (m.id === 'tumbleweed' ? 4.5 : 9));
      this.move(m, mdt, playerBody);

      if (m.hp <= 0) {
        this.remove(m);
        continue;
      }

      // --- babies grow up over time (60s to adulthood) ---
      if (m.grow > 0) {
        m.grow = Math.max(0, m.grow - mdt);
        const t01 = 1 - m.grow / 60;
        m.group.scale.setScalar(m.def.scale * m.modelSize * babyGrowthScale(m.id, t01));
      }

      // --- animation --- (skipped entirely for hidden far mobs)
      m.group.position.set(m.x, m.y, m.z);
      m.group.rotation.y = m.yaw;
      if (m.id === 'tumbleweed' && m.group.userData.roller) {
        const roller = m.group.userData.roller as THREE.Group;
        const spd = Math.hypot(m.vx, m.vz);
        roller.rotation.x += (spd * 3.4 + (m.onGround ? 0.2 : 1.3)) * mdt;
        roller.rotation.z += (spd * 1.4 + Math.sin(m.walkPhase * 1.9) * 0.55) * mdt;
        const squash = m.onGround ? 0.94 + Math.abs(Math.sin(m.walkPhase * 3.4)) * 0.08 : 1.04;
        roller.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        roller.position.y = 0.35 * squash;
      }
      if (!m.group.visible) continue;
      const moving = Math.hypot(m.vx, m.vz);
      m.walkPhase += mdt * (m.id === 'bird' ? 11 : 2 + moving * 2.4);

      const swing = Math.sin(m.walkPhase * 2.4) * Math.min(0.7, moving * 0.3);
      for (let li = 0; li < m.legParts.length; li++) {
        const leg = m.legParts[li];
        if (m.id === 'spider' || m.id === 'spiderling') leg.rotation.x = Math.sin(m.walkPhase * 5 + li) * 0.34 * Math.min(1, moving);
        else if (m.id === 'jellyfish') leg.rotation.x = Math.sin(m.walkPhase * 3 + li) * 0.28;
        else if (m.id === 'bird') {
          const side = li % 2 === 0 ? -1 : 1;
          const folded = -side * 1.15;
          if (m.task === 9 || m.task === 12 || m.task === 15) {
            // Full wingbeats only during real takeoff/flight/landing.
            const takeoffWarmup = m.task === 15 ? Math.max(0, Math.min(1, (0.48 - m.taskT) / 0.48)) : 1;
            const landingEase = m.task === 12 ? 0.55 : 1;
            const amp = (m.task === 15 ? 0.28 + takeoffWarmup * 0.72 : 1.05) * landingEase;
            leg.rotation.z = side * (0.05 + Math.sin(m.walkPhase * 2.6) * amp);
          } else if (!m.onGround) {
            // Ground/tree hops get only a small balancing wing flick, not full flight.
            const target = folded + side * Math.sin(m.walkPhase * 2.4) * 0.18;
            leg.rotation.z += (target - leg.rotation.z) * Math.min(1, mdt * 12);
          } else {
            leg.rotation.z += (folded - leg.rotation.z) * Math.min(1, mdt * 10);
          }
        } else leg.rotation.x = swing * (li % 2 === 0 ? 1 : -1);
      }
      if (m.head) {
        const chewing = m.task === 14;
        // Four full dips over the meal. The jaw opens and closes faster than
        // the neck; both eyes and muzzle ride the same head pivot.
        const cycle = m.feedClock * Math.PI * 2 * 0.85;
        const dip = chewing ? (1 - Math.cos(cycle)) * 0.5 : 0;
        const sipping = m.task === 11 && Math.hypot(m.tx - m.x, m.tz - m.z) < 1.4;
        const cactus = m.id === 'camel' && (m.feedFoodId === CACTUS || m.feedFoodId === CACTUS_PALE);
        // Small grazers reach down; tall cattle lift the head slightly, while
        // pigs/sheep make a modest forward reach. The torso follows the dip so
        // the movement reads as a neck-and-body stretch rather than a nod.
        const reach = m.id === 'camel' ? (cactus ? -0.72 : -1.15) : ['deer','roe_deer','moose'].includes(m.id) ? -0.78 : m.def.scale < 0.85 ? -0.9 : m.def.scale > 1.1 ? 0.28 : -0.52;
        const target = chewing ? reach * dip : sipping ? (m.id === 'camel' ? -0.8 : -0.62) : Math.sin(m.walkPhase * 0.7) * 0.06;
        m.head.rotation.x += (target - m.head.rotation.x) * Math.min(1, mdt * 12);
        if (m.feedBody) {
          const bodyTarget = chewing ? (m.id === 'camel' ? -0.2 : m.def.scale < 0.85 ? -0.12 : 0.08) * dip : sipping ? -0.08 : 0;
          m.feedBody.rotation.x += (bodyTarget - m.feedBody.rotation.x) * Math.min(1, mdt * 7);
        }
        if (m.feedJaw) {
          m.feedJaw.position.y = (m.feedJaw.userData.restY as number) -
            (chewing ? Math.max(0, Math.sin(cycle * 2)) * 0.065 : 0);
        }
      }

      // creeper swells before detonating
      if (def.explodes) {
        const s = m.fuse > 0 ? 1 + Math.sin((1.35 - m.fuse) * 34) * 0.16 + (1.35 - m.fuse) * 0.12 : 1;
        m.group.scale.setScalar(def.scale * s);
      }

      // hurt / burn tint
      const flash = m.hurtFlash > 0 ? 1 : 0;
      const burnT = m.burn > 0 ? 0.55 + Math.sin(m.burn * 22) * 0.25 : 0;
      for (const mat of m.mats) {
        // Brief amber flashes communicate hits without blood-like red coloring.
        if (flash) mat.emissive.setRGB(0.95, 0.68, 0.16);
        else if (burnT) mat.emissive.setRGB(burnT, burnT * 0.42, 0);
        else if (def.explodes && m.fuse > 0) mat.emissive.setRGB(0.9, 0.9, 0.7);
        else mat.emissive.setRGB(0, 0, 0);
      }
    }
  }

  /** find a shaded spot (solid roof overhead) near a position — cave mouths, overhangs */
  findCoverNear(x: number, y: number, z: number, r: number): [number, number, number] | null {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 3 + Math.random() * r;
      const px = Math.floor(x + Math.cos(a) * rr);
      const pz = Math.floor(z + Math.sin(a) * rr);
      if (!this.world.hasColumn(px, pz)) continue;
      // scan downward from the mob's level for an air pocket with a roof
      for (let py = Math.min(WY - 4, Math.floor(y) + 2); py >= Math.max(2, Math.floor(y) - 8); py--) {
        if (
          this.world.get(px, py, pz) === 0 &&
          this.world.get(px, py + 1, pz) === 0 &&
          isSolid(this.world.get(px, py - 1, pz)) &&
          this.world.topSolidY(px, pz) > py + 1 // roof above → shade
        ) {
          return [px + 0.5, py, pz + 0.5];
        }
      }
    }
    return null;
  }

  /** coarse voxel ray from the mob's head to a point — false if a block is in the way */
  lineOfSight(m: Mob, tx: number, ty: number, tz: number): boolean {
    const ox = m.x;
    const oy = m.y + this.mobHeight(m) * 0.8;
    const oz = m.z;
    const dx = tx - ox;
    const dy = ty - oy;
    const dz = tz - oz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.6) return true;
    const steps = Math.ceil(dist * 2.5);
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      if (isSolid(this.world.get(Math.floor(ox + dx * k), Math.floor(oy + dy * k), Math.floor(oz + dz * k))))
        return false;
    }
    return true;
  }

  /** returns the closest mob whose box intersects the ray, within maxDist */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): Mob | null {
    let best: Mob | null = null;
    let bestT = maxDist;
    for (const m of this.mobs) {
      if (!m.alive) continue;
      const half = (m.id === 'spider' || m.id === 'spiderling' ? 0.55 : 0.45) * m.def.scale;
      const h = (m.def.hostile ? (m.id === 'spider' || m.id === 'spiderling' ? 0.95 : 1.95) : 1.35) * m.def.scale;
      const t = rayBox(ox, oy, oz, dx, dy, dz, m.x - half, m.y, m.z - half, m.x + half, m.y + h, m.z + half);
      if (t !== null && t < bestT) {
        bestT = t;
        best = m;
      }
    }
    return best;
  }

  /** every living mob inside a sphere (for splash / explosions) */
  inRadius(x: number, y: number, z: number, r: number): Mob[] {
    const out: Mob[] = [];
    for (const m of this.mobs) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - x, m.y + 0.8 - y, m.z - z) <= r) out.push(m);
    }
    return out;
  }

  /**
   * Find a solid spawn spot. Optional bias angle (radians) concentrates spawns
   * in a ±70° cone — used to seed wildlife ahead of a travelling player.
   */
  findSpawnPoint(
    px: number,
    pz: number,
    minR: number,
    maxR: number,
    biasAngle: number | null = null,
    groundTypes?: readonly number[],
    spawnId?: MobId,
  ): [number, number, number] | null {
    for (let i = 0; i < 48; i++) {
      const a =
        biasAngle !== null && i < 16
          ? biasAngle + (Math.random() * 2 - 1) * 1.2 // forward cone first…
          : Math.random() * Math.PI * 2; // …fall back to full circle
      const r = minR + Math.random() * (maxR - minR);
      const x = Math.floor(px + Math.cos(a) * r);
      const z = Math.floor(pz + Math.sin(a) * r);
      if (!this.world.hasColumn(x, z)) continue;
      const h = this.world.topSolidY(x, z);
      if (h < 2 || h > WY - 6) continue;
      const ground = this.world.get(x, h, z);
      if (!isSolid(ground) || ground === CACTUS || ground === CACTUS_PALE ||
        isLeafId(ground) || isLogId(ground) || (groundTypes && !groundTypes.includes(ground))) continue;
      if (isSolid(this.world.get(x, h + 1, z)) || isSolid(this.world.get(x, h + 2, z))) continue;
      const candidate: [number, number, number] = [x + 0.5, h + 1, z + 0.5];
      if (!this.canSpawnAt(spawnId ?? 'pig', candidate[0], candidate[1], candidate[2])) continue;
      return candidate;
    }
    return null;
  }
}

function rayBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
    } else {
      const inv = 1 / d[i];
      let t1 = (lo[i] - o[i]) * inv;
      let t2 = (hi[i] - o[i]) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
