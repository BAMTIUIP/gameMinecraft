import * as THREE from 'three';
import type { World } from './world';
import { WY } from './world';
import { SAND, WATER, isSolid } from './blocks';
import type { TKey } from './i18n';

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
  | 'calf';

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
  calf: { id: 'calf', nameKey: 'mob_calf', hostile: false, hp: 8, speed: 1.6, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.65, score: 14, level: 0, body: '#f4f5f8', accent: '#222226', legs: '#1c1c20' },
  chicken: { id: 'chicken', nameKey: 'mob_chicken', hostile: false, hp: 6, speed: 1.7, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 0.6, score: 12, level: 0, body: '#f2efe6', accent: '#e2483a', legs: '#f3b942' },
  zombie: { id: 'zombie', nameKey: 'mob_zombie', hostile: true, hp: 22, speed: 2.25, damage: 7, cooldown: 1.1, reach: 1.5, burns: true, scale: 1, score: 120, level: 1, body: '#4a8a4a', accent: '#3d6fa8', legs: '#2f4f7a' },
  skeleton: { id: 'skeleton', nameKey: 'mob_skeleton', hostile: true, hp: 18, speed: 2.5, damage: 6, cooldown: 0.85, reach: 1.6, burns: true, scale: 1, score: 150, level: 2, body: '#d8d6cc', accent: '#b6b3a8', legs: '#c2bfb4' },
  spider: { id: 'spider', nameKey: 'mob_spider', hostile: true, hp: 16, speed: 3.3, damage: 5, cooldown: 0.7, reach: 1.5, burns: true, scale: 0.95, score: 140, level: 2, body: '#3a2320', accent: '#c4342a', legs: '#2a1a17' },
  spiderling: { id: 'spiderling', nameKey: 'mob_spider', hostile: true, hp: 5, speed: 3.6, damage: 1, cooldown: 0.9, reach: 1.2, burns: true, scale: 0.4, score: 40, level: 0, body: '#3a2320', accent: '#c4342a', legs: '#2a1a17' },
  creeper: { id: 'creeper', nameKey: 'mob_creeper', hostile: true, hp: 20, speed: 2.45, damage: 26, cooldown: 3, reach: 2.2, burns: true, scale: 1, score: 220, level: 3, body: '#5ac45a', accent: '#2f6b2f', legs: '#4aa84a', explodes: true },
  trader: { id: 'trader', nameKey: 'mob_trader', hostile: false, hp: 9999, speed: 1.2, damage: 0, cooldown: 1, reach: 1, burns: false, scale: 1, score: 0, level: 0, body: '#7a4bb8', accent: '#c9a24a', legs: '#4a2c80' },
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
  /** bird colour variant index (assigned at spawn) */
  variant: number;
  /** parts hidden when a turtle retreats into its shell */
  retractParts: THREE.Object3D[];
  /** generic AI task state (bees: 0 roam, 1 pollinating, 2 flying to hive) */
  task: number;
  taskX: number;
  taskY: number;
  taskZ: number;
  taskT: number;
};

const GRAV = 26;

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
    body.position.y = 0.3;
    g.add(body);
    const tail = box(0.08, 0.26, 0.2, def.accent, mats);
    tail.position.set(0, 0.3, 0.42);
    g.add(tail);
    legs.push(tail); // animated like a leg → wagging tail
    const fin = box(0.06, 0.16, 0.2, def.accent, mats);
    fin.position.set(0, 0.5, 0);
    g.add(fin);
    for (const s of [-1, 1]) {
      const eye = box(0.05, 0.05, 0.05, '#20301f', mats);
      eye.position.set(s * 0.17, 0.36, -0.26);
      g.add(eye);
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
    // small songbird: round body, wings, tail feathers, yellow chest
    const body = box(0.3, 0.26, 0.4, def.body, mats);
    body.position.y = 0.3;
    g.add(body);
    const chest = box(0.2, 0.18, 0.08, def.accent, mats);
    chest.position.set(0, 0.26, -0.22);
    g.add(chest);
    const hd = box(0.22, 0.2, 0.2, def.body, mats);
    hd.position.set(0, 0.48, -0.18);
    g.add(hd);
    head = hd;
    const beak = box(0.06, 0.05, 0.1, '#f4a83a', mats);
    beak.position.set(0, 0.46, -0.32);
    g.add(beak);
    const tail = box(0.14, 0.05, 0.2, def.legs, mats);
    tail.position.set(0, 0.34, 0.28);
    tail.rotation.x = 0.35;
    g.add(tail);
    for (const s of [-1, 1]) {
      const wing = box(0.06, 0.16, 0.3, def.legs, mats);
      wing.position.set(s * 0.19, 0.32, 0);
      g.add(wing);
      legs.push(wing); // wings flap via the leg animation channel
      px2(g, mats, s * 0.07, 0.52, -0.26, '#20301f');
    }
    return { group: g, head, legs, mats };
  }

  if (def.id === 'cat') {
    // lynx: sleek body, tufted ears, short bobbed tail, spotted coat
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
    // long continuous tail: segments overlap so there are no air gaps.
    // body ends at z=+0.43, y≈0.5 — the tail root starts inside it.
    const tail1 = box(0.1, 0.1, 0.34, def.body, mats);
    tail1.position.set(0, 0.54, 0.56); // root buried in the rump
    tail1.rotation.x = 0.3;
    g.add(tail1);
    const tail2 = box(0.09, 0.09, 0.3, def.body, mats);
    tail2.position.set(0, 0.65, 0.78); // overlaps tail1's end
    tail2.rotation.x = 0.55;
    g.add(tail2);
    const tailTip = box(0.085, 0.085, 0.2, '#2a2a30', mats);
    tailTip.position.set(0, 0.76, 0.92); // overlaps tail2's end
    tailTip.rotation.x = 0.75;
    g.add(tailTip);
    // spots
    for (const [sx2, sy2, sz2] of [
      [0.16, 0.6, -0.1],
      [-0.14, 0.56, 0.15],
      [0.1, 0.64, 0.28],
    ])
      px2(g, mats, sx2, sy2, sz2, '#8a6a3a');
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
    body.position.y = bodyY;
    g.add(body);

    if (def.id === 'sheep') {
      const wool = box(0.8, 0.72, 1.18, def.body, mats);
      wool.position.y = 0.78;
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
      // cute muddy/brownish body spots & patches across back & flanks
      const patchCol = '#6e4432';
      const p1 = box(0.24, 0.22, 0.3, patchCol, mats);
      p1.position.set(0.24, 0.84, -0.12);
      g.add(p1);
      const p2 = box(0.26, 0.26, 0.34, patchCol, mats);
      p2.position.set(-0.24, 0.8, 0.2);
      g.add(p2);
      const p3 = box(0.28, 0.14, 0.24, patchCol, mats);
      p3.position.set(0.04, 1.08, 0.3);
      g.add(p3);
      const p4 = box(0.16, 0.16, 0.06, patchCol, mats);
      p4.position.set(0.12, 1.04, -0.99); // spot over eye
      g.add(p4);
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

      // 3D patches/spots across the body & flanks!
      const sScale = isCow ? 1 : 0.65;
      const spotMat = new THREE.MeshLambertMaterial({ color: def.accent });
      mats.push(spotMat);

      const addSpot = (x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * sScale, h * sScale, d * sScale), spotMat);
        mesh.position.set(x * sScale, y * sScale, z * sScale);
        mesh.userData.cattleSpot = true;
        g.add(mesh);
      };

      addSpot(-0.32, isCow ? 0.88 : 0.62, 0.15, 0.18, 0.38, 0.48); // left flank
      addSpot(0.32, isCow ? 0.86 : 0.6, -0.25, 0.18, 0.36, 0.42); // right shoulder
      addSpot(0, isCow ? 1.2 : 0.84, 0.3, 0.44, 0.16, 0.38); // back rump
      addSpot(0, isCow ? 0.52 : 0.36, -0.05, 0.48, 0.12, 0.42); // belly
      addSpot(0.14, isCow ? 1.15 : 0.86, isCow ? -0.86 : -0.58, 0.22, 0.22, 0.04); // head spot

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
      // Face is ALWAYS warm tan — recognisable on white, black or pink wool.
      const faceMat = new THREE.MeshLambertMaterial({ color: '#b89878' });
      mats.push(faceMat);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.08), faceMat);
      face.position.set(0, 0.98, -1.0);
      face.userData.sheepFace = true;
      g.add(face);
      for (const s of [-1, 1]) {
        // white sclera + dark pupil → readable eyes at any wool colour
        const sclera = box(0.1, 0.1, 0.04, '#f4f4f0', mats);
        sclera.position.set(s * 0.11, 1.06, -1.05);
        sclera.userData.sheepFace = true;
        g.add(sclera);
        px2(g, mats, s * 0.12, 1.06, -1.08, '#20301f');
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.07), faceMat);
        ear.position.set(s * 0.28, 1.08, -0.78);
        ear.userData.sheepFace = true;
        g.add(ear);
      }
      // soft pink nose
      px2(g, mats, 0, 0.88, -1.06, '#c88a92');
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

export class MobSystem {
  mobs: Mob[] = [];
  private scene: THREE.Scene;
  private world: World;
  private pool = new Map<MobId, THREE.Group[]>();
  maxMobs = 40;
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
      });
    }
    this.mobs.length = 0;
    this.pool.clear();
  }

  count(hostile: boolean) {
    let n = 0;
    for (const m of this.mobs) if (m.alive && m.def.hostile === hostile && m.id !== 'fish') n++;
    return n;
  }

  spawn(id: MobId, x: number, y: number, z: number): Mob | null {
    // fish live in a separate budget — schools shouldn't crowd out land life
    if (id === 'fish') {
      let fishCount = 0;
      for (const m of this.mobs) if (m.alive && m.id === 'fish') fishCount++;
      if (fishCount >= 24) return null;
    } else if (this.mobs.length >= this.maxMobs) return null;
    const def = MOBS[id];
    const { group, head, legs, mats } = buildBody(def);
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
    // birds & parrots: pick a colour variant at spawn
    if (id === 'bird') {
      const variants: Array<[string, string, string]> = [
        ['#4d7dd8', '#f4c842', '#3a5ca8'], // bluebird
        ['#d84d4d', '#f4e8d8', '#a83a3a'], // robin red
        ['#f4c832', '#2a2a30', '#c89a20'], // goldfinch
        ['#58b858', '#f45858', '#3a8a3a'], // green parrot (red chest)
        ['#e858a8', '#58d8e8', '#b83a80'], // tropical parrot
        ['#8a8a92', '#f4f4f8', '#5a5a64'], // dove grey
      ];
      const vi = Math.floor(Math.random() * variants.length);
      const [b, a, l] = variants[vi];
      // recolour: body → b, accent → a, legs/wings → l (skip eyes/beak darks)
      for (const m of mats) {
        const hex = `#${m.color.getHexString()}`;
        if (hex === MOBS.bird.body) m.color.set(b);
        else if (hex === MOBS.bird.accent) m.color.set(a);
        else if (hex === MOBS.bird.legs) m.color.set(l);
      }
      (group.userData as { variant?: number }).variant = vi;
      // parrots (variants 3-4) get a longer tail — stretch the tail feathers
      if (vi === 3 || vi === 4) {
        group.traverse((o) => {
          if (o !== group && o.position.z > 0.2) {
            o.scale.z = 2.2;
            o.position.z += 0.14;
          }
        });
      }
    }
    // cow and calf: color variants (Holstein spotted, brown/cream, ginger, dark chocolate)
    if (id === 'cow' || id === 'calf') {
      const COW_VARIANTS = [
        { body: '#f4f5f8', spot: '#222226', legs: '#1c1c20' }, // 0: Holstein black & white
        { body: '#6d4c33', spot: '#eddcc9', legs: '#482f1b' }, // 1: Brown with cream patches
        { body: '#9e4e26', spot: '#faecd8', legs: '#6c3014' }, // 2: Ginger / Reddish-brown with light spots
        { body: '#241e1b', spot: '#f2ece4', legs: '#161210' }, // 3: Dark chocolate with white patches
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
    group.scale.setScalar(def.scale);
    group.position.set(x, y, z);
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
      retractParts: [] as THREE.Object3D[],
      task: 0,
      taskX: 0,
      taskY: 0,
      taskZ: 0,
      taskT: 0,
    };
    // wire up per-species extras prepared above
    mob.retractParts = ((group.userData as { retract?: THREE.Object3D[] }).retract ?? []) as THREE.Object3D[];
    mob.variant = ((group.userData as { variant?: number }).variant ?? 0) as number;
    this.mobs.push(mob);
    return mob;
  }

  remove(mob: Mob) {
    mob.alive = false;
    this.scene.remove(mob.group);
    mob.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
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

  mobHalf(m: Mob) {
    return (m.id === 'spider' || m.id === 'spiderling' ? 0.45 : 0.32) * m.def.scale;
  }
  mobHeight(m: Mob) {
    return (m.id === 'spider' || m.id === 'spiderling' || m.id === 'chicken' ? 0.9 : m.def.hostile ? 1.85 : 1.3) * m.def.scale;
  }

  /** true when the mob's body is submerged */
  private mobInWater(m: Mob) {
    return this.world.get(Math.floor(m.x), Math.floor(m.y + this.mobHeight(m) * 0.5), Math.floor(m.z)) === WATER;
  }

  /** axis-swept AABB movement: no more corner clipping or sinking into terrain */
  private move(m: Mob, dt: number) {
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
        // stay inside the water body
        if (this.world.get(Math.floor(nx), Math.floor(m.y + 0.3), Math.floor(m.z)) === WATER) m.x = nx;
        else m.vx *= -0.5;
        if (this.world.get(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(nz)) === WATER) m.z = nz;
        else m.vz *= -0.5;
        const ny = m.y + m.vy * dt;
        if (this.world.get(Math.floor(m.x), Math.floor(ny + 0.3), Math.floor(m.z)) === WATER) m.y = ny;
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
        // fully entombed — nudge sideways to the nearest open column
        for (const [ox, oz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (!this.collidesBox(m.x + ox, m.y + 1, m.z + oz, half, height)) {
            m.x += ox;
            m.z += oz;
            m.y += 1;
            freed = true;
            break;
          }
        }
        if (!freed) m.hp = 0; // buried alive
      }
      m.vy = Math.min(m.vy, 0);
    }

    // clamp per-frame motion so a lag spike can't tunnel through a wall
    const cap = 0.42;
    const mx = Math.max(-cap, Math.min(cap, m.vx * dt));
    const mz = Math.max(-cap, Math.min(cap, m.vz * dt));

    if (mx !== 0) {
      if (!this.collidesBox(m.x + mx, m.y, m.z, half, height)) m.x += mx;
      else if (m.onGround && !this.collidesBox(m.x + mx, m.y + 1.02, m.z, half, height)) {
        m.x += mx;
        m.y += 1.02;
      } else m.vx = 0;
    }
    if (mz !== 0) {
      if (!this.collidesBox(m.x, m.y, m.z + mz, half, height)) m.z += mz;
      else if (m.onGround && !this.collidesBox(m.x, m.y + 1.02, m.z + mz, half, height)) {
        m.z += mz;
        m.y += 1.02;
      } else m.vz = 0;
    }

    m.vy -= GRAV * dt;
    m.vy = Math.max(-28, m.vy);
    const my = Math.max(-0.9, Math.min(0.9, m.vy * dt));
    const ny = m.y + my;
    if (!this.collidesBox(m.x, ny, m.z, half, height)) {
      m.y = ny;
      m.onGround = false;
    } else if (my < 0) {
      // land: snap the feet onto the highest solid corner under the box
      m.y = Math.floor(ny) + 1.001;
      let guard = 0;
      while (this.collidesBox(m.x, m.y, m.z, half, height) && guard++ < 4) m.y += 1;
      m.vy = 0;
      m.onGround = true;
    } else {
      m.vy = 0; // bonked a ceiling
    }
    if (m.y < -8) m.hp = 0;
  }

  update(
    dt: number,
    px: number,
    py: number,
    pz: number,
    daylight: number,
    onAttack: (m: Mob, dmg: number) => void,
    onBurnDeath: (m: Mob) => void,
    onRanged?: (m: Mob) => void,
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
        this.move(m, mdt);
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

      const dx = px - m.x;
      const dz = pz - m.z;
      const dy = py - m.y;
      const dist = Math.hypot(dx, dz);
      const speedMul = m.slow > 0 ? 0.45 : 1;

      let mx = 0;
      let mz = 0;

      // creepers & spiders flee from lynxes instead of attacking
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
          if (m.cd <= 0 && dist < 16 && this.lineOfSight(m, px, py + 1.2, pz)) {
            m.cd = def.cooldown;
            onRanged?.(m);
          }
        } else if (dist > def.reach * 0.75) {
          mx = (dx / (dist || 1)) * def.speed * speedMul;
          mz = (dz / (dist || 1)) * def.speed * speedMul;
        }
        // melee needs an unobstructed line — no biting through walls or floors
        const canTouch =
          !def.ranged && dist < def.reach && Math.abs(dy) < 2.2 && this.lineOfSight(m, px, py + 1.2, pz);
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
              onAttack(m, def.damage);
              this.remove(m);
              continue;
            }
          }
        } else if (canTouch && m.cd <= 0) {
          m.cd = def.cooldown;
          onAttack(m, def.damage);
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
            this.move(m, mdt);
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

        // brooding penguins sit tight on the nest (engine releases them at hatch)
        if (m.id === 'penguin' && m.task === 6) {
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 2;
          const nd = Math.hypot(m.x - m.taskX, m.z - m.taskZ);
          if (nd < 0.5) {
            // settled: waddle in place, no wandering off
            m.vx *= 0.5;
            m.vz *= 0.5;
          }
        }

        // flying birds (not chickens): occasionally take wing toward the wander target
        if (m.id === 'bird' && m.task !== 9 && Math.random() < mdt * 0.25) {
          m.task = 9; // airborne
          m.taskT = 3 + Math.random() * 4;
          m.vy = 5 + Math.random() * 2;
        }
        if (m.id === 'bird' && m.task === 9) {
          m.taskT -= mdt;
          // wings hold altitude: sinusoidal lift, gentle glide forward
          m.vy = Math.max(m.vy - 4 * mdt, -0.6);
          if (Math.random() < mdt * 3) m.vy += 2.2; // flap
          if (m.taskT <= 0 || m.onGround) m.task = 0; // land
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
        if (m.think <= 0) {
          m.think = 2 + Math.random() * 4;
          if (Math.random() < 0.62) {
            const a = Math.random() * Math.PI * 2;
            const r = 4 + Math.random() * 9;
            const nx = m.x + Math.cos(a) * r;
            const nz = m.z + Math.sin(a) * r;
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
        const wx = m.tx - m.x;
        const wz = m.tz - m.z;
        const wd = Math.hypot(wx, wz);
        if (wd > 1.0) {
          // dead-zone widened: a target under the feet no longer whips the yaw around
          m.yaw = Math.atan2(-wx, -wz);
          mx = (wx / wd) * def.speed * 0.6 * speedMul;
          mz = (wz / wd) * def.speed * 0.6 * speedMul;
          const hopChance = m.id === 'rabbit' ? 6 : m.id === 'bird' ? 4 : m.id === 'bee' ? 8 : 0.8;
          if (m.onGround && m.jumpCd <= 0 && Math.random() < mdt * hopChance) {
            // rabbits bound, birds flutter in long floaty hops
            m.vy = m.id === 'rabbit' ? 5.8 : m.id === 'bird' ? 7.2 : m.id === 'bee' ? 4.6 : 7.6;
            m.jumpCd = m.id === 'rabbit' ? 0.25 : m.id === 'bird' ? 0.7 : m.id === 'bee' ? 0.3 : 1.2;
          }
          // birds fall slowly — wings catch the air; bees hover even softer
          if (m.id === 'bird' && m.vy < -2) m.vy = -2;
          if (m.id === 'bee' && m.vy < -1.2) m.vy = -1.2;
        }
      }

      // ================= WATER BEHAVIOUR BY SPECIES =================
      if (!m.def.aquatic && this.mobInWater(m)) {
        const bottomWalker = m.id === 'turtle' || m.id === 'crab' || m.id === 'penguin';
        if (bottomWalker) {
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

      m.vx += (mx - m.vx) * Math.min(1, mdt * 9);
      m.vz += (mz - m.vz) * Math.min(1, mdt * 9);
      this.move(m, mdt);

      if (m.hp <= 0) {
        this.remove(m);
        continue;
      }

      // --- babies grow up over time (60s to adulthood) ---
      if (m.grow > 0) {
        m.grow = Math.max(0, m.grow - mdt);
        const t01 = 1 - m.grow / 60;
        m.group.scale.setScalar(m.def.scale * (0.35 + 0.65 * t01));
      }

      // --- animation --- (skipped entirely for hidden far mobs)
      m.group.position.set(m.x, m.y, m.z);
      m.group.rotation.y = m.yaw;
      if (!m.group.visible) continue;
      const moving = Math.hypot(m.vx, m.vz);
      m.walkPhase += mdt * (2 + moving * 2.4);

      const swing = Math.sin(m.walkPhase * 2.4) * Math.min(0.7, moving * 0.3);
      for (let li = 0; li < m.legParts.length; li++) {
        const leg = m.legParts[li];
        if (m.id === 'spider' || m.id === 'spiderling') leg.rotation.x = Math.sin(m.walkPhase * 5 + li) * 0.34 * Math.min(1, moving);
        else if (m.id === 'bird' && m.task === 9) {
          // airborne: wings beat hard around the Z axis instead of walking
          leg.rotation.z = Math.sin(m.walkPhase * 14) * 0.9 * (li % 2 === 0 ? 1 : -1);
          leg.rotation.x = 0;
        } else if (m.id === 'bird') {
          leg.rotation.z = 0;
          leg.rotation.x = swing * (li % 2 === 0 ? 1 : -1);
        } else leg.rotation.x = swing * (li % 2 === 0 ? 1 : -1);
      }
      if (m.head) m.head.rotation.x = Math.sin(m.walkPhase * 0.7) * 0.06;

      // creeper swells before detonating
      if (def.explodes) {
        const s = m.fuse > 0 ? 1 + Math.sin((1.35 - m.fuse) * 34) * 0.16 + (1.35 - m.fuse) * 0.12 : 1;
        m.group.scale.setScalar(def.scale * s);
      }

      // hurt / burn tint
      const flash = m.hurtFlash > 0 ? 1 : 0;
      const burnT = m.burn > 0 ? 0.55 + Math.sin(m.burn * 22) * 0.25 : 0;
      for (const mat of m.mats) {
        if (flash) mat.emissive.setRGB(0.85, 0.15, 0.12);
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
  ): [number, number, number] | null {
    for (let i = 0; i < 24; i++) {
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
      if (!isSolid(this.world.get(x, h, z))) continue;
      if (isSolid(this.world.get(x, h + 1, z)) || isSolid(this.world.get(x, h + 2, z))) continue;
      return [x + 0.5, h + 1, z + 0.5];
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
