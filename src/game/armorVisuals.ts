import * as THREE from 'three';
import { AFFIXES, RARITY, gearColor, type Item } from './items';

const ARMOR_TEXTURE_SIZE = 64;
type RGB = [number, number, number];
type ArmorSurfaceState = {
  baseIntensity: number;
  hasFire: boolean;
  hasVamp: boolean;
  phase: number;
};

function colorRgb(color: THREE.ColorRepresentation): RGB {
  const hex = new THREE.Color(color).getHex(THREE.SRGBColorSpace);
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function textureFor(data: Uint8Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, ARMOR_TEXTURE_SIZE, ARMOR_TEXTURE_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function makeSurfaceMaps(item: Item, baseColor: THREE.ColorRepresentation) {
  const size = ARMOR_TEXTURE_SIZE;
  const colorData = new Uint8Array(size * size * 4);
  const glowData = new Uint8Array(size * size * 4);
  const base = colorRgb(baseColor);
  const transparentBlack: RGB = [0, 0, 0];
  let hasGlow = false;
  const colorPixel = (x: number, y: number, color: RGB) => putPixel(colorData, x, y, color);
  const glowPixel = (x: number, y: number, color: RGB) => {
    putPixel(glowData, x, y, color);
    hasGlow = true;
  };
  const colorRect = (x: number, y: number, width: number, height: number, color: RGB) => fillRect(colorData, x, y, width, height, color);
  const glowRect = (x: number, y: number, width: number, height: number, color: RGB) => {
    fillRect(glowData, x, y, width, height, color);
    hasGlow = true;
  };

  fillRect(colorData, 0, 0, size, size, base);
  fillRect(glowData, 0, 0, size, size, transparentBlack);

  const rarity = RARITY[item.rarity] ?? RARITY[0];
  const rarityRgb = colorRgb(rarity.color);
  const affixIds = new Set(item.affixes.map((affix) => affix.id));

  // Small inset enamel pips sit on the upper armor panel, never in front of the avatar's face.
  const pipCount = Math.max(1, Math.min(5, item.rarity + 1));
  const pipSpacing = 8;
  const firstPip = Math.round((size - (pipCount - 1) * pipSpacing) / 2);
  for (let index = 0; index < pipCount; index++) {
    const cx = firstPip + index * pipSpacing;
    const cy = 8;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2) continue;
        colorPixel(cx + dx, cy + dy, rarityRgb);
        glowPixel(cx + dx, cy + dy, rarityRgb);
      }
    }
    colorPixel(cx, cy, [255, 255, 255]);
  }

  // Burning affixes are painted as narrow inlaid bands. The emissive map pulses on the same pixels.
  if (affixIds.has('fire')) {
    const fireRgb = colorRgb(AFFIXES.fire.color);
    const fireShade = colorRgb('#a74328');
    for (const center of [15, 48]) {
      colorRect(center - 2, 16, 5, 40, fireShade);
      colorRect(center - 1, 17, 3, 38, fireRgb);
      colorRect(center, 18, 1, 36, colorRgb('#ffd078'));
      glowRect(center - 1, 17, 3, 38, fireRgb);
    }
  }

  // Vampire and magnet effects become surface inlays rather than a detached aura or orbit.
  if (affixIds.has('vamp')) {
    const vampRgb = colorRgb(AFFIXES.vamp.color);
    const deepRed = colorRgb('#70273a');
    colorRect(3, 20, 2, 36, deepRed);
    colorRect(size - 5, 20, 2, 36, deepRed);
    for (let y = 22; y < 56; y += 6) {
      colorPixel(4, y, vampRgb);
      colorPixel(size - 5, y + 2, vampRgb);
      glowPixel(4, y, vampRgb);
      glowPixel(size - 5, y + 2, vampRgb);
    }
  }

  if (affixIds.has('magnet')) {
    const magnetRgb = colorRgb(AFFIXES.magnet.color);
    const centerX = 32;
    const centerY = 40;
    for (let y = 29; y <= 51; y++) {
      for (let x = 21; x <= 43; x++) {
        const radius = Math.hypot(x - centerX, y - centerY);
        if (Math.abs(radius - 9) > 0.8) continue;
        colorPixel(x, y, magnetRgb);
        glowPixel(x, y, magnetRgb);
      }
    }
  }

  if (affixIds.has('frost')) {
    const frostRgb = colorRgb(AFFIXES.frost.color);
    for (let offset = -5; offset <= 5; offset++) {
      for (const [x, y] of [[32 + offset, 39], [32, 39 + offset], [32 + offset, 39 + offset], [32 + offset, 39 - offset]] as const) {
        colorPixel(x, y, frostRgb);
        glowPixel(x, y, frostRgb);
      }
    }
  }

  if (affixIds.has('thorns')) {
    const thornRgb = colorRgb(AFFIXES.thorns.color);
    for (let offset = 0; offset <= 8; offset++) {
      for (const x of [9 + offset * 2, 47 + offset * 2]) {
        const y = offset % 2 === 0 ? 38 : 40;
        colorPixel(x, y, thornRgb);
        colorPixel(x, y + 1, thornRgb);
        glowPixel(x, y, thornRgb);
      }
    }
  }

  // Every additional buff receives a tiny colored stitch along the lower seam of the panel.
  for (const [index, affix] of item.affixes.slice(1).entries()) {
    if (['fire', 'vamp', 'magnet', 'frost', 'thorns'].includes(affix.id)) continue;
    const mark = colorRgb(AFFIXES[affix.id].color);
    const cx = 14 + (index % 4) * 12;
    for (let x = cx - 2; x <= cx + 2; x++) {
      colorPixel(x, 58, mark);
      colorPixel(x, 59, mark);
      glowPixel(x, 58, mark);
    }
  }

  return { map: textureFor(colorData), emissiveMap: textureFor(glowData), hasGlow };
}

function putPixel(data: Uint8Array, x: number, y: number, color: RGB) {
  if (x < 0 || y < 0 || x >= ARMOR_TEXTURE_SIZE || y >= ARMOR_TEXTURE_SIZE) return;
  const index = (y * ARMOR_TEXTURE_SIZE + x) * 4;
  data[index] = color[0];
  data[index + 1] = color[1];
  data[index + 2] = color[2];
  data[index + 3] = 255;
}

function fillRect(data: Uint8Array, x: number, y: number, width: number, height: number, color: RGB) {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) putPixel(data, px, py, color);
  }
}

function disposeSurfaceMaps(material: THREE.MeshLambertMaterial) {
  const maps = new Set<THREE.Texture>();
  if (material.map) maps.add(material.map);
  if (material.emissiveMap) maps.add(material.emissiveMap);
  maps.forEach((texture) => texture.dispose());
}

export function setArmorSurfaceTexture(
  material: THREE.MeshLambertMaterial,
  item: Item,
  baseColor: THREE.ColorRepresentation = gearColor(item),
) {
  // A plain crafted/common piece keeps the untouched material: no rarity pip, stripe, or glow.
  if (!(item.affixes?.length ?? 0) && !(item.rarity ?? 0)) {
    resetArmorSurfaceTexture(material, baseColor);
    return;
  }
  disposeSurfaceMaps(material);
  const { map, emissiveMap, hasGlow } = makeSurfaceMaps(item, baseColor);
  material.color.set('#ffffff');
  material.map = map;
  material.emissive.set('#ffffff');
  material.emissiveMap = emissiveMap;
  const hasFire = item.affixes.some((affix) => affix.id === 'fire');
  const hasVamp = item.affixes.some((affix) => affix.id === 'vamp');
  material.emissiveIntensity = hasGlow ? 1.05 : 0;
  material.userData.armorSurfaceFx = {
    baseIntensity: hasGlow ? 1.05 : 0,
    hasFire,
    hasVamp,
    phase: item.rarity * 0.72 + item.affixes.length * 0.13,
  } satisfies ArmorSurfaceState;
  material.needsUpdate = true;
}

export function createArmorSurfaceMaterial(
  item: Item,
  baseColor: THREE.ColorRepresentation = gearColor(item),
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  setArmorSurfaceTexture(material, item, baseColor);
  return material;
}

export function resetArmorSurfaceTexture(material: THREE.MeshLambertMaterial, color: THREE.ColorRepresentation) {
  disposeSurfaceMaps(material);
  material.map = null;
  material.emissiveMap = null;
  material.color.set(color);
  material.emissive.set('#000000');
  material.emissiveIntensity = 1;
  delete material.userData.armorSurfaceFx;
  material.needsUpdate = true;
}

/** Animate the emissive ink on the armor surface; no buff geometry floats away from the armor. */
export function animateArmorVisuals(root: THREE.Object3D, time: number) {
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      const surface = material.userData.armorSurfaceFx as ArmorSurfaceState | undefined;
      if (!surface) continue;
      const firePulse = (Math.sin(time * 6.4 + surface.phase) + 1) * 0.5;
      const vampPulse = (Math.sin(time * 2.7 + surface.phase) + 1) * 0.5;
      let intensity = surface.baseIntensity;
      if (surface.hasFire) intensity *= 0.72 + firePulse * 0.42;
      if (surface.hasVamp) intensity *= 0.9 + vampPulse * 0.18;
      if (material instanceof THREE.MeshLambertMaterial) material.emissiveIntensity = intensity;
    }
  });
}
