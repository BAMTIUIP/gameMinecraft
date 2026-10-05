import * as THREE from 'three';
import {
  ARROW_ITEM,
  FIRE_ARROW,
  FREEZE_ARROW,
  GOLD_ARROW,
  IRON_ARROW,
  NETHERITE_ARROW,
  POISON_ARROW,
  STONE_ARROW,
  STUN_ARROW,
  isArrowId,
  type ArrowId,
} from './blocks';

export { ARROW_IDS, isArrowId, type ArrowId } from './blocks';
type ArrowKind = 'plain' | 'stone' | 'iron' | 'gold' | 'netherite' | 'fire' | 'poison' | 'freeze' | 'stun';

export type ArrowTheme = {
  kind: ArrowKind;
  shaft: string;
  shaftLight: string;
  shaftDark: string;
  head: string;
  headLight: string;
  headDark: string;
  fletching: string;
  fletchingDark: string;
  accent: string;
  glow: string;
};

const DEFAULT_THEME: ArrowTheme = {
  kind: 'plain',
  shaft: '#94663c',
  shaftLight: '#d19a5b',
  shaftDark: '#51351f',
  head: '#aeb8bf',
  headLight: '#f1f6f8',
  headDark: '#59636b',
  fletching: '#eee9dc',
  fletchingDark: '#aaa394',
  accent: '#d8e0e3',
  glow: '#e8e2d2',
};

const THEMES: Record<ArrowId, ArrowTheme> = {
  [ARROW_ITEM]: DEFAULT_THEME,
  [STONE_ARROW]: {
    kind: 'stone',
    shaft: '#94663c', shaftLight: '#c18a4f', shaftDark: '#51351f',
    head: '#727b80', headLight: '#c2c8c9', headDark: '#343b40',
    fletching: '#c9c9c2', fletchingDark: '#747a7d', accent: '#aeb5b8', glow: '#9aa2a6',
  },
  [IRON_ARROW]: {
    kind: 'iron',
    shaft: '#7b5737', shaftLight: '#c19361', shaftDark: '#443126',
    head: '#b6c8d0', headLight: '#f5fcff', headDark: '#536876',
    fletching: '#c8d8df', fletchingDark: '#718794', accent: '#e3f4fa', glow: '#d2eaf4',
  },
  [GOLD_ARROW]: {
    kind: 'gold',
    shaft: '#9b7131', shaftLight: '#e2bd59', shaftDark: '#53390f',
    head: '#e8b92e', headLight: '#fff2a1', headDark: '#80500d',
    fletching: '#ffe18a', fletchingDark: '#ad751b', accent: '#fff1a1', glow: '#fbd54a',
  },
  [NETHERITE_ARROW]: {
    kind: 'netherite',
    shaft: '#51424a', shaftLight: '#9a777e', shaftDark: '#201a20',
    head: '#393039', headLight: '#c2a8a2', headDark: '#171418',
    fletching: '#57434a', fletchingDark: '#24191e', accent: '#ff7045', glow: '#ff7045',
  },
  [FIRE_ARROW]: {
    kind: 'fire',
    shaft: '#8c482a', shaftLight: '#e29a4c', shaftDark: '#42251d',
    head: '#df4b20', headLight: '#fff07b', headDark: '#782318',
    fletching: '#ff792c', fletchingDark: '#a93220', accent: '#ffd451', glow: '#ff6a22',
  },
  [POISON_ARROW]: {
    kind: 'poison',
    shaft: '#65503c', shaftLight: '#b2935b', shaftDark: '#31271f',
    head: '#76cf45', headLight: '#e2ff91', headDark: '#286332',
    fletching: '#a276c4', fletchingDark: '#54376d', accent: '#bafa58', glow: '#77dc45',
  },
  [FREEZE_ARROW]: {
    kind: 'freeze',
    shaft: '#527d91', shaftLight: '#b4e5f0', shaftDark: '#254858',
    head: '#70ddf6', headLight: '#f4ffff', headDark: '#23658c',
    fletching: '#d7fbff', fletchingDark: '#64b7d2', accent: '#c9f8ff', glow: '#56dcff',
  },
  [STUN_ARROW]: {
    kind: 'stun',
    shaft: '#8e6d32', shaftLight: '#e7c458', shaftDark: '#493310',
    head: '#e9c83e', headLight: '#fff9ae', headDark: '#815f18',
    fletching: '#f4d36b', fletchingDark: '#a47b25', accent: '#fff17b', glow: '#ffe34b',
  },
};

export function getArrowTheme(id: number): ArrowTheme {
  return isArrowId(id) ? THEMES[id] : DEFAULT_THEME;
}

/** Draw one sharply pixelated, type-specific arrow in the shared 48×48 inventory tile. */
export function drawArrowIcon(ctx: CanvasRenderingContext2D, id: number, size = 48) {
  const theme = getArrowTheme(id);
  const unit = size / 16;
  const p = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * unit, y * unit, w * unit, h * unit);
  };
  const poly = (points: Array<[number, number]>, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0] * unit, points[0][1] * unit);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] * unit, points[i][1] * unit);
    ctx.closePath();
    ctx.fill();
  };

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // Elemental signatures sit behind the arrow so the silhouette remains crisp and readable.
  switch (theme.kind) {
    case 'netherite':
      p(8, 6, 1, 1, '#ff7045');
      p(10, 3, 1, 1, '#ffb05e');
      p(6, 9, 1, 1, '#a84842');
      break;
    case 'fire':
      p(7, 7, 1, 2, '#c53620');
      p(8, 5, 1, 2, '#ff6727');
      p(9, 4, 1, 2, '#ffd04e');
      p(7, 10, 1, 1, '#ff8a2e');
      break;
    case 'poison':
      p(8, 4, 1, 2, '#a8ee51');
      p(7, 5, 1, 1, '#5fbf42');
      p(12, 7, 1, 1, '#ddff83');
      p(9, 2, 1, 1, '#8bdf50');
      break;
    case 'freeze':
      p(13, 0, 1, 1, '#ffffff');
      p(14, 1, 1, 1, '#9cf0ff');
      p(8, 4, 1, 1, '#e8ffff');
      p(12, 7, 1, 1, '#83e8ff');
      break;
    case 'stun':
      poly([[14, 3], [13, 4], [14, 4], [12, 7], [15, 5], [14, 5]], '#fff7a0');
      p(11, 2, 1, 1, '#ffe34b');
      p(8, 7, 1, 1, '#ffdf52');
      break;
    default:
      break;
  }

  // Feather flights, outlined first and shaded on the far edge.
  poly([[4, 11], [2, 8], [1, 8], [2, 12], [4, 14]], theme.headDark);
  poly([[4, 11], [2, 9], [2, 11], [4, 13]], theme.fletching);
  p(2, 9, 1, 1, theme.headLight);
  poly([[4, 12], [6, 11], [9, 14], [8, 15], [4, 14]], theme.headDark);
  poly([[4, 12], [6, 12], [8, 14], [6, 14]], theme.fletching);
  p(6, 13, 1, 1, theme.fletchingDark);

  // Stepped wooden shaft; offset facets make it look like a tiny voxel model rather than a line glyph.
  const shaftPath: Array<[number, number]> = [
    [3, 12], [4, 11], [5, 10], [6, 9], [7, 8], [8, 7], [9, 6], [10, 5], [11, 4],
  ];
  for (const [x, y] of shaftPath) p(x, y, 2, 2, theme.shaftDark);
  for (const [x, y] of shaftPath) {
    p(x, y, 1, 1, theme.shaftLight);
    p(x + 1, y, 1, 1, theme.shaft);
    p(x, y + 1, 1, 1, theme.shaftDark);
  }
  // A colored binding joins the shaft to each special head.
  p(9, 5, 2, 1, theme.accent);

  // Broad, diagonal voxel point with a dark outline and a bright material facet.
  poly([[15, 0], [9, 2], [10, 5], [13, 7]], theme.headDark);
  poly([[14, 1], [10, 2], [11, 4], [13, 6]], theme.head);
  poly([[14, 1], [11, 2], [12, 3], [13, 4]], theme.headLight);

  switch (theme.kind) {
    case 'stone':
      p(10, 3, 1, 1, '#d4d7d4');
      p(12, 5, 1, 1, '#4c555a');
      p(9, 4, 1, 1, '#818b8f');
      break;
    case 'iron':
      p(11, 3, 1, 1, '#ffffff');
      p(12, 4, 1, 1, '#d9eff6');
      p(13, 5, 1, 1, '#687e89');
      break;
    case 'gold':
      p(11, 3, 1, 1, '#fff9cb');
      p(12, 4, 1, 1, '#fff0a1');
      p(13, 5, 1, 1, '#bd861f');
      p(14, 3, 1, 1, '#fff7bb');
      break;
    case 'netherite':
      p(10, 3, 1, 1, '#ff7045');
      p(11, 4, 1, 1, '#ffd06a');
      p(12, 4, 1, 1, '#4b3a41');
      break;
    case 'fire':
      p(10, 3, 1, 1, '#fff07b');
      p(11, 4, 1, 1, '#ff9a2e');
      p(9, 5, 1, 1, '#ff4f20');
      break;
    case 'poison':
      p(10, 3, 1, 1, '#e2ff91');
      p(11, 4, 1, 1, '#a3ed57');
      p(13, 5, 1, 1, '#4a963e');
      break;
    case 'freeze':
      p(10, 3, 1, 1, '#f4ffff');
      p(11, 4, 1, 1, '#c9f8ff');
      p(12, 5, 1, 1, '#46afd2');
      break;
    case 'stun':
      p(10, 3, 1, 1, '#fff9ae');
      p(11, 4, 1, 1, '#fff17b');
      p(13, 5, 1, 1, '#c29625');
      break;
    case 'plain':
      p(11, 3, 1, 1, '#ffffff');
      p(12, 4, 1, 1, '#dce5e8');
      break;
  }
}

const arrowMaterial = (color: string, emissive = false) => new THREE.MeshLambertMaterial({
  color,
  emissive: emissive ? color : '#000000',
  emissiveIntensity: emissive ? 0.42 : 0,
});

/**
 * Build a blocky 3D arrow facing local +Z. This same detailed miniature is used for the first-person
 * view model, the avatar's hand, ground pickups and the projectile in flight.
 */
export function buildArrowModel(id: number): THREE.Group {
  const theme = getArrowTheme(id);
  const group = new THREE.Group();
  group.name = `arrow-model-${id}`;
  group.userData.arrowId = isArrowId(id) ? id : ARROW_ITEM;

  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const material = (color: string, emissive = false) => {
    const key = `${color}:${emissive}`;
    let found = materials.get(key);
    if (!found) {
      found = arrowMaterial(color, emissive);
      materials.set(key, found);
    }
    return found;
  };
  const addBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    color: string, emissive = false,
    rotation: [number, number, number] = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, emissive));
    mesh.position.set(x, y, z);
    mesh.rotation.set(...rotation);
    group.add(mesh);
    return mesh;
  };
  const addCone = (
    radius: number, height: number, radialSegments: number,
    x: number, y: number, z: number,
    color: string, emissive = false,
    rotation: [number, number, number] = [Math.PI / 2, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, radialSegments), material(color, emissive));
    mesh.position.set(x, y, z);
    mesh.rotation.set(...rotation);
    group.add(mesh);
    return mesh;
  };
  const addCrystal = (radius: number, x: number, y: number, z: number, color: string) => {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(radius, 0), material(color, true));
    mesh.position.set(x, y, z);
    group.add(mesh);
  };

  // Dark pixel edge + warm wooden core and a small inset highlight.
  addBox(0.064, 0.064, 0.74, 0, 0, -0.03, theme.shaftDark);
  addBox(0.038, 0.038, 0.72, 0, 0, -0.03, theme.shaft);
  addBox(0.012, 0.012, 0.5, -0.008, 0.021, -0.045, theme.shaftLight);
  addBox(0.075, 0.075, 0.045, 0, 0, 0.295, theme.headDark);
  addBox(0.052, 0.052, 0.035, 0, 0, 0.297, theme.accent, theme.kind === 'fire' || theme.kind === 'poison' || theme.kind === 'freeze' || theme.kind === 'stun');

  // Four small fletches form a real cross at the tail; their color identifies the arrow family at a glance.
  for (const sign of [-1, 1]) {
    addBox(0.028, 0.145, 0.21, 0, sign * 0.045, -0.285, theme.headDark);
    addBox(0.016, 0.125, 0.19, 0, sign * 0.045, -0.285, theme.fletching);
    addBox(0.145, 0.028, 0.21, sign * 0.045, 0, -0.285, theme.headDark);
    addBox(0.125, 0.016, 0.19, sign * 0.045, 0, -0.285, theme.fletching);
  }
  addBox(0.07, 0.07, 0.035, 0, 0, -0.365, theme.fletchingDark);
  addBox(0.04, 0.04, 0.04, 0, 0, -0.365, theme.accent);

  const headRadius = theme.kind === 'stone' || theme.kind === 'gold' || theme.kind === 'netherite' ? 0.13
    : theme.kind === 'iron' || theme.kind === 'freeze' ? 0.105
      : 0.118;
  // Low-poly stone/metal point. The larger dark cone sits just behind the colored cutting edge.
  addCone(headRadius + 0.025, 0.27, 4, 0, 0, 0.4, theme.headDark);
  addCone(headRadius, 0.235, 4, 0, 0, 0.41, theme.head, theme.kind === 'fire' || theme.kind === 'poison' || theme.kind === 'freeze' || theme.kind === 'stun');
  addBox(0.026, 0.016, 0.13, -0.035, 0.045, 0.37, theme.headLight, theme.kind === 'gold' || theme.kind === 'fire' || theme.kind === 'freeze');

  switch (theme.kind) {
    case 'plain':
      addBox(0.038, 0.038, 0.04, 0, 0, 0.33, theme.headLight);
      break;
    case 'stone':
      // Broad chipped flint shoulders give the rough stone point a jagged silhouette.
      addBox(0.1, 0.035, 0.08, -0.075, 0, 0.34, theme.head, false, [0, -0.24, -0.2]);
      addBox(0.1, 0.035, 0.08, 0.075, 0, 0.34, theme.headLight, false, [0, 0.24, 0.2]);
      addBox(0.025, 0.02, 0.08, -0.04, 0.055, 0.36, '#e0e2df');
      break;
    case 'iron':
      addBox(0.055, 0.055, 0.045, 0, 0, 0.315, theme.headDark);
      addBox(0.034, 0.034, 0.05, 0, 0, 0.318, theme.headLight);
      addBox(0.02, 0.018, 0.12, -0.035, 0.045, 0.37, '#ffffff');
      break;
    case 'gold':
      addBox(0.07, 0.07, 0.05, 0, 0, 0.31, '#9b6717');
      addBox(0.042, 0.042, 0.055, 0, 0, 0.313, '#ffe27a', true);
      addCrystal(0.035, 0.07, 0.055, 0.36, '#fff3a0');
      break;
    case 'netherite':
      addBox(0.023, 0.02, 0.16, 0.045, 0.045, 0.365, theme.accent, true, [0.35, 0, -0.34]);
      addBox(0.02, 0.02, 0.09, -0.045, 0.015, 0.42, '#ffb05e', true, [0, 0, 0.4]);
      break;
    case 'fire':
      addBox(0.05, 0.09, 0.08, 0.095, 0, 0.285, '#ff6727', true, [0, 0, -0.35]);
      addBox(0.04, 0.065, 0.065, 0.105, 0.015, 0.31, '#ffd04e', true, [0, 0, -0.5]);
      addBox(0.045, 0.075, 0.08, -0.09, 0.025, 0.29, '#ff8a2e', true, [0, 0, 0.42]);
      break;
    case 'poison':
      addCrystal(0.055, 0.105, 0.035, 0.34, '#77dc45');
      addCrystal(0.038, -0.08, -0.055, 0.36, '#bafa58');
      addCrystal(0.03, 0.02, 0.105, 0.31, '#a276c4');
      break;
    case 'freeze':
      addCrystal(0.05, 0.11, 0.035, 0.35, '#e6ffff');
      addCrystal(0.04, -0.09, -0.045, 0.35, '#8eeeff');
      addBox(0.025, 0.14, 0.03, 0, 0.115, 0.33, '#e8ffff', true, [0, 0, -0.28]);
      break;
    case 'stun':
      addCrystal(0.045, 0.105, 0.035, 0.35, '#fff6a0');
      addCrystal(0.035, -0.09, -0.04, 0.37, '#ffe34b');
      addBox(0.03, 0.12, 0.035, 0.12, 0.045, 0.31, '#fff7a0', true, [0, 0, -0.48]);
      addBox(0.028, 0.09, 0.03, 0.15, -0.025, 0.34, '#ffe34b', true, [0, 0, 0.5]);
      break;
  }

  return group;
}
