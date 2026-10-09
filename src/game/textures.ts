import * as THREE from 'three';
import { mulberry32 } from './noise';
import {
  T,
  BLOCKS,
  LADDER_PALETTE,
  isLadder,
  TORCH,
  BED,
  DOOR_WOOD,
  DOOR_IRON,
  COAL,
  IRON,
  GOLD,
  DIAMOND,
  REDSTONE,
  LAPIS,
  EMERALD,
  QUARTZ,
  NETHERITE,
  NETHERITE_INGOT,
  CHEST_STORAGE_OPEN,
  isTreasureChest,
  CAMPFIRE,
  APPLE,
  COCONUT,
  BANANA,
} from './blocks';
import { drawArrowIcon, isArrowId } from './arrowVisuals';

export const TILE = 16;
/** gutter of replicated edge pixels on every side — stops mipmap bleeding between tiles */
export const GUT = 8;
export const CELL = TILE + GUT * 2;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 64; // 256 tiles - power-of-two height 2048 for mipmaps, expanded for forest flora & ruins
export const ATLAS_W = CELL * ATLAS_COLS;
export const ATLAS_H = CELL * ATLAS_ROWS;

export function tileOrigin(index: number): [number, number] {
  return [(index % ATLAS_COLS) * CELL + GUT, Math.floor(index / ATLAS_COLS) * CELL + GUT];
}

function expandGutters(ctx: Ctx) {
  const c = ctx.canvas;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i++) {
    const [ox, oy] = tileOrigin(i);
    // edges stretched outward
    ctx.drawImage(c, ox, oy, 1, TILE, ox - GUT, oy, GUT, TILE);
    ctx.drawImage(c, ox + TILE - 1, oy, 1, TILE, ox + TILE, oy, GUT, TILE);
    ctx.drawImage(c, ox, oy, TILE, 1, ox, oy - GUT, TILE, GUT);
    ctx.drawImage(c, ox, oy + TILE - 1, TILE, 1, ox, oy + TILE, TILE, GUT);
    // corners
    ctx.drawImage(c, ox, oy, 1, 1, ox - GUT, oy - GUT, GUT, GUT);
    ctx.drawImage(c, ox + TILE - 1, oy, 1, 1, ox + TILE, oy - GUT, GUT, GUT);
    ctx.drawImage(c, ox, oy + TILE - 1, 1, 1, ox - GUT, oy + TILE, GUT, GUT);
    ctx.drawImage(c, ox + TILE - 1, oy + TILE - 1, 1, 1, ox + TILE, oy + TILE, GUT, GUT);
  }
}

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, ox: number, oy: number, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(ox + x, oy + y, w, h);
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/** fills a 16x16 tile with a speckled base colour */
function speckle(ctx: Ctx, ox: number, oy: number, base: string, seed: number, spread = 16, density = 0.9) {
  const rand = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (rand() > density) continue;
      const a = Math.round((rand() - 0.5) * 2 * spread);
      if (a === 0) continue;
      px(ctx, ox, oy, x, y, 1, 1, shade(base, a));
    }
  }
}

function blobs(
  ctx: Ctx,
  ox: number,
  oy: number,
  seed: number,
  colors: string[],
  count: number,
  size = 2,
  cells: Array<[number, number]> = [],
) {
  const rand = mulberry32(seed);
  const spots = cells.length
    ? cells
    : Array.from({ length: count }, () => [Math.floor(rand() * 13) + 1, Math.floor(rand() * 13) + 1] as [number, number]);
  spots.forEach(([cx, cy], i) => {
    const col = colors[i % colors.length];
    const s = size + (rand() < 0.4 ? 1 : 0);
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        if (dx === s - 1 && dy === s - 1 && rand() < 0.6) continue;
        const x = cx + dx,
          y = cy + dy;
        if (x < 0 || y < 0 || x > 15 || y > 15) continue;
        px(ctx, ox, oy, x, y, 1, 1, rand() < 0.25 ? shade(col, 34) : col);
      }
    }
  });
}

function drawTile(ctx: Ctx, index: number) {
  const [ox, oy] = tileOrigin(index);
  const rand = mulberry32(index * 1337 + 11);

  switch (index) {
    case T.grassTop: {
      speckle(ctx, ox, oy, '#6da83f', 5, 22);
      for (let i = 0; i < 26; i++) {
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#7cbb4b' : '#5b9135');
      }
      break;
    }
    case T.grassSide: {
      speckle(ctx, ox, oy, '#8a6244', 9, 20);
      ctx.fillStyle = '#6da83f';
      ctx.fillRect(ox, oy, 16, 4);
      for (let x = 0; x < 16; x++) {
        const h = 3 + Math.floor(rand() * 3);
        ctx.fillStyle = rand() < 0.5 ? '#6da83f' : '#5f9738';
        ctx.fillRect(ox + x, oy, 1, h);
        px(ctx, ox, oy, x, h, 1, 1, '#7c4a2f');
      }
      for (let i = 0; i < 14; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), 5 + Math.floor(rand() * 11), 1, 1, rand() < 0.5 ? '#7a5539' : '#96704f');
      break;
    }
    case T.dirt: {
      speckle(ctx, ox, oy, '#8a6244', 13, 22);
      for (let i = 0; i < 12; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#6f4c33' : '#9c7250');
      break;
    }
    case T.stone: {
      speckle(ctx, ox, oy, '#83838a', 21, 14);
      for (let i = 0; i < 8; i++)
        px(ctx, ox, oy, Math.floor(rand() * 15), Math.floor(rand() * 15), 2, 1, rand() < 0.5 ? '#767680' : '#909099');
      break;
    }
    case T.cobble: {
      speckle(ctx, ox, oy, '#5f5f66', 33, 8);
      const stones: Array<[number, number, number, number]> = [
        [1, 1, 6, 5],
        [8, 1, 7, 4],
        [1, 7, 4, 4],
        [6, 6, 5, 5],
        [12, 6, 3, 5],
        [1, 12, 7, 3],
        [9, 12, 6, 3],
      ];
      const r2 = mulberry32(77);
      stones.forEach(([sx, sy, sw, sh]) => {
        const base = r2() < 0.5 ? '#8d8d95' : '#7e7e87';
        ctx.fillStyle = base;
        ctx.fillRect(ox + sx, oy + sy, sw, sh);
        ctx.fillStyle = shade(base, 22);
        ctx.fillRect(ox + sx, oy + sy, sw, 1);
        ctx.fillStyle = shade(base, -30);
        ctx.fillRect(ox + sx, oy + sy + sh - 1, sw, 1);
      });
      break;
    }
    case T.coal: {
      // Natural stone matrix with rich, stepped diagonal jet-black anthracite seams & graphite sheen
      speckle(ctx, ox, oy, '#81838b', 41, 14);
      const seams: Array<[number, number, number, number]> = [
        [2, 2, 3, 2],
        [4, 3, 3, 2],
        [10, 2, 4, 2],
        [9, 4, 3, 2],
        [3, 8, 4, 2],
        [6, 9, 4, 2],
        [11, 8, 3, 3],
        [2, 12, 4, 2],
        [8, 12, 5, 2],
      ];
      for (const [sx, sy, sw, sh] of seams) {
        px(ctx, ox, oy, sx, sy, sw, sh, '#121318');
        px(ctx, ox, oy, sx + 1, sy, Math.max(1, sw - 1), 1, '#262934');
      }
      // Crisp graphite-silver crystal glints on upper facets
      for (const [gx, gy] of [[3, 2], [11, 2], [4, 8], [12, 8], [9, 12]]) {
        px(ctx, ox, oy, gx, gy, 1, 1, '#484e61');
      }
      break;
    }
    case T.iron: {
      // Natural stone matrix with rich warm raw-iron ochre & gleaming silver-steel nugget veins
      speckle(ctx, ox, oy, '#81838b', 53, 14);
      const pockets: Array<[number, number, number, number]> = [
        [2, 2, 3, 3],
        [4, 4, 3, 2],
        [10, 2, 4, 2],
        [9, 4, 3, 2],
        [2, 9, 4, 2],
        [5, 8, 3, 3],
        [11, 9, 3, 2],
        [8, 12, 4, 2],
      ];
      for (const [vx, vy, vw, vh] of pockets) {
        px(ctx, ox, oy, vx, vy, vw, vh, '#6e4c36');
        px(ctx, ox, oy, vx, vy, Math.max(1, vw - 1), Math.max(1, vh - 1), '#c7926b');
        px(ctx, ox, oy, vx + 1, vy, 1, 1, '#f2dccb');
      }
      // Bright metallic silver-iron glints inside the veins
      for (const [sx, sy] of [[3, 3], [11, 2], [6, 9], [12, 9], [9, 12]]) {
        px(ctx, ox, oy, sx, sy, 1, 1, '#ffffff');
      }
      break;
    }
    case T.gold: {
      // Natural stone laced with gleaming golden nuggets & sun-gold veins
      speckle(ctx, ox, oy, '#81838b', 67, 14);
      for (const [gx, gy] of [[2, 2], [9, 3], [5, 7], [2, 11], [10, 10]]) {
        px(ctx, ox, oy, gx, gy, 4, 3, '#6e4b0c');
        px(ctx, ox, oy, gx + 1, gy, 3, 2, '#f0b91f');
        px(ctx, ox, oy, gx + 1, gy, 2, 1, '#fff59e');
      }
      px(ctx, ox, oy, 5, 4, 4, 1, '#d99e16');
      px(ctx, ox, oy, 8, 9, 3, 1, '#d99e16');
      break;
    }
    case T.diamond: {
      // Deep stone with 4-pointed star-prism cyan ice crystals
      speckle(ctx, ox, oy, '#81838b', 83, 14);
      for (const [cx, cy] of [[4, 4], [11, 5], [6, 11], [12, 12]]) {
        px(ctx, ox, oy, cx - 1, cy - 1, 3, 3, '#104e5b');
        px(ctx, ox, oy, cx, cy - 2, 1, 5, '#2ed8eb');
        px(ctx, ox, oy, cx - 2, cy, 5, 1, '#2ed8eb');
        px(ctx, ox, oy, cx - 1, cy - 1, 3, 3, '#6ef7ff');
        px(ctx, ox, oy, cx, cy, 1, 1, '#ffffff');
      }
      break;
    }
    case T.logSide: {
      speckle(ctx, ox, oy, '#6d5233', 97, 12);
      for (let x = 0; x < 16; x++) {
        if (rand() < 0.55) {
          const c = rand() < 0.5 ? '#5b4327' : '#7d5f3d';
          ctx.fillStyle = c;
          ctx.fillRect(ox + x, oy, 1, 16);
        }
      }
      px(ctx, ox, oy, 4, 3, 2, 6, '#4e3921');
      px(ctx, ox, oy, 11, 9, 2, 5, '#4e3921');
      break;
    }
    case T.logTop: {
      speckle(ctx, ox, oy, '#a8814e', 111, 10);
      ctx.strokeStyle = '#7c5c34';
      for (let r = 2; r < 8; r += 2) {
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 8 - r + 0.5, oy + 8 - r + 0.5, r * 2 - 1, r * 2 - 1);
      }
      break;
    }
    case T.leaves: {
      // Fancy foliage: rich oak green with dithered transparent cutout holes
      speckle(ctx, ox, oy, '#48852d', 123, 26);
      for (let i = 0; i < 35; i++) {
        const x = Math.floor(rand() * 16),
          y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1, 1, rand() < 0.5 ? '#366420' : '#5da238');
      }
      for (let i = 0; i < 12; i++) px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, '#74ba46');
      // see-through canopy holes
      const rHole = mulberry32(127);
      for (let i = 0; i < 18; i++) {
        const hx = Math.floor(rHole() * 15);
        const hy = Math.floor(rHole() * 15);
        ctx.clearRect(ox + hx, oy + hy, 1, 1);
        if (rHole() < 0.4) ctx.clearRect(ox + hx + 1, oy + hy, 1, 1);
      }
      break;
    }
    case T.sand: {
      speckle(ctx, ox, oy, '#dbcb98', 137, 14);
      for (let i = 0; i < 12; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#cbb884' : '#ecdfb4');
      break;
    }
    case T.planks: {
      speckle(ctx, ox, oy, '#b08a53', 151, 10);
      ctx.fillStyle = '#8b6a3c';
      for (const y of [3, 7, 11, 15]) ctx.fillRect(ox, oy + y, 16, 1);
      for (const [x, y] of [
        [5, 0],
        [11, 4],
        [3, 8],
        [9, 12],
      ])
        ctx.fillRect(ox + x, oy + y, 1, 4);
      for (let i = 0; i < 14; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 2, 1, rand() < 0.5 ? '#a37e49' : '#c09a61');
      break;
    }
    case T.bedrock: {
      speckle(ctx, ox, oy, '#3b3b41', 163, 10);
      for (let i = 0; i < 20; i++)
        px(ctx, ox, oy, Math.floor(rand() * 15), Math.floor(rand() * 15), 2, 2, rand() < 0.5 ? '#26262a' : '#57575f');
      break;
    }
    case T.lava: {
      speckle(ctx, ox, oy, '#e0521a', 177, 18);
      blobs(ctx, ox, oy, 191, ['#ffb03a', '#ff7a18', '#ffd970'], 5, 3);
      for (let i = 0; i < 10; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#8f2b0c' : '#ffe9a8');
      break;
    }
    case T.torch: {
      // 16x16 pixel-art lantern matching logo.png (dark iron cage + warm glowing core)
      ctx.clearRect(ox, oy, 16, 16);
      // Top U-shaped iron handle (y=0..2)
      px(ctx, ox, oy, 6, 0, 4, 1, '#242221');
      px(ctx, ox, oy, 6, 1, 1, 2, '#242221');
      px(ctx, ox, oy, 9, 1, 1, 2, '#242221');
      // Upper stepped chimney cap + yellow vent slits (y=2..4)
      px(ctx, ox, oy, 5, 2, 6, 1, '#4b4846');
      px(ctx, ox, oy, 5, 3, 1, 1, '#3d3a38');
      px(ctx, ox, oy, 10, 3, 1, 1, '#3d3a38');
      px(ctx, ox, oy, 6, 3, 4, 1, '#ffee58');
      // Overhanging dark iron roof eaves (y=4..5)
      px(ctx, ox, oy, 3, 4, 10, 2, '#32302e');
      px(ctx, ox, oy, 4, 4, 8, 1, '#454240');
      // Glowing glass core (y=6..12)
      px(ctx, ox, oy, 4, 6, 8, 7, '#f27d16');
      px(ctx, ox, oy, 5, 7, 6, 5, '#ffd62e');
      px(ctx, ox, oy, 6, 8, 4, 3, '#ffee58');
      // 2x2 diagonal hot white-yellow center squares (exact match to logo.png)
      px(ctx, ox, oy, 6, 8, 2, 1, '#ffffe4');
      px(ctx, ox, oy, 8, 9, 2, 1, '#ffffe4');
      // Vertical dark iron cage bars (left, center-split, right)
      px(ctx, ox, oy, 3, 6, 1, 7, '#262423');
      px(ctx, ox, oy, 12, 6, 1, 7, '#262423');
      px(ctx, ox, oy, 4, 6, 1, 7, '#343130');
      px(ctx, ox, oy, 11, 6, 1, 7, '#343130');
      // Bottom iron frame rim + corner feet (y=13..15)
      px(ctx, ox, oy, 3, 13, 10, 2, '#32302e');
      px(ctx, ox, oy, 3, 15, 3, 1, '#22201f');
      px(ctx, ox, oy, 10, 15, 3, 1, '#22201f');
      break;
    }
    case T.goldBlock: {
      // Unique style: Royal Sun-Crest Bullion Block with bronze corner scrollwork & ruby solar core
      ctx.fillStyle = '#d49618';
      ctx.fillRect(ox, oy, 16, 16);
      // Outer ornate dark-bronze & bright-gold frame
      ctx.fillStyle = '#784b08';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillStyle = '#fce36b';
      ctx.fillRect(ox + 1, oy + 1, 14, 14);
      ctx.fillStyle = '#e5a820';
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      // Corner filigree studs
      for (const [cx, cy] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
        px(ctx, ox, oy, cx, cy, 2, 2, '#915c0c');
      }
      // Raised central Sun Medallion with gleaming white-gold heart
      px(ctx, ox, oy, 5, 5, 6, 6, '#b57410');
      px(ctx, ox, oy, 7, 3, 2, 10, '#fff59e');
      px(ctx, ox, oy, 3, 7, 10, 2, '#fff59e');
      px(ctx, ox, oy, 6, 6, 4, 4, '#ffe863');
      px(ctx, ox, oy, 7, 7, 2, 2, '#ffffff');
      break;
    }
    case T.glass: {
      // transparent centre, pale frame + cross bars, a few glints
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#dfeef4';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillStyle = '#c3d9e2';
      ctx.fillRect(ox + 7, oy, 2, 16);
      ctx.fillRect(ox, oy + 7, 16, 2);
      ctx.fillStyle = 'rgba(235,250,255,0.6)';
      px(ctx, ox, oy, 3, 3, 1, 1, 'rgba(255,255,255,0.75)');
      px(ctx, ox, oy, 4, 4, 1, 1, 'rgba(255,255,255,0.5)');
      px(ctx, ox, oy, 12, 11, 1, 1, 'rgba(255,255,255,0.6)');
      break;
    }
    case T.doorWood: {
      // TOP half of a 2-block Minecraft oak door: upper 4-pane window + lock rail (no handle here!)
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#a37e49';
      ctx.fillRect(ox, oy, 16, 16);
      // Outer top & side frame bevels (no bottom border so it joins doorWoodBottom seamlessly)
      ctx.fillStyle = '#73552c';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillStyle = '#b89158';
      ctx.fillRect(ox + 1, oy + 1, 14, 1);
      ctx.fillRect(ox + 1, oy + 1, 1, 15);
      // Upper 4-pane window cutouts (2x2 glass openings separated by cross-mullion)
      ctx.clearRect(ox + 3, oy + 3, 4, 4);
      ctx.clearRect(ox + 9, oy + 3, 4, 4);
      ctx.clearRect(ox + 3, oy + 8, 4, 4);
      ctx.clearRect(ox + 9, oy + 8, 4, 4);
      // Window frame shadow trim & central cross-mullion
      ctx.fillStyle = '#6e532c';
      ctx.fillRect(ox + 2, oy + 2, 12, 1);
      ctx.fillRect(ox + 2, oy + 12, 12, 1);
      ctx.fillRect(ox + 2, oy + 2, 1, 11);
      ctx.fillRect(ox + 13, oy + 2, 1, 11);
      ctx.fillRect(ox + 7, oy + 3, 2, 9);
      ctx.fillRect(ox + 3, oy + 7, 10, 1);
      // Mid-rail wood grain at bottom of top half (oy = 13..15)
      for (let i = 0; i < 8; i++) {
        px(ctx, ox, oy, 2 + Math.floor(rand() * 12), 13 + Math.floor(rand() * 3), 2, 1, rand() < 0.5 ? '#8f6c3b' : '#b58d52');
      }
      break;
    }
    case T.doorIron: {
      // TOP half of a 2-block Minecraft iron door: upper barred window + steel frame (no handle here!)
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#c8ccd2';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#7d838c';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillStyle = '#e2e6ec';
      ctx.fillRect(ox + 1, oy + 1, 14, 1);
      ctx.fillRect(ox + 1, oy + 1, 1, 15);
      // 4-pane upper window cutouts
      ctx.clearRect(ox + 3, oy + 3, 4, 4);
      ctx.clearRect(ox + 9, oy + 3, 4, 4);
      ctx.clearRect(ox + 3, oy + 8, 4, 4);
      ctx.clearRect(ox + 9, oy + 8, 4, 4);
      ctx.fillStyle = '#8b919a';
      ctx.fillRect(ox + 2, oy + 2, 12, 1);
      ctx.fillRect(ox + 2, oy + 12, 12, 1);
      ctx.fillRect(ox + 7, oy + 3, 2, 9);
      ctx.fillRect(ox + 3, oy + 7, 10, 1);
      break;
    }
    case T.fenceWood:
    case T.fenceStone:
    case T.fenceIron: {
      ctx.clearRect(ox, oy, 16, 16);
      const cols =
        index === T.fenceWood
          ? ['#a37e49', '#8b6a3c']
          : index === T.fenceStone
            ? ['#8d8d95', '#6e6e76']
            : ['#c8ccd2', '#8f959d'];
      // two vertical posts
      ctx.fillStyle = cols[0];
      ctx.fillRect(ox + 2, oy, 3, 16);
      ctx.fillRect(ox + 11, oy, 3, 16);
      ctx.fillStyle = cols[1];
      ctx.fillRect(ox + 4, oy, 1, 16);
      ctx.fillRect(ox + 13, oy, 1, 16);
      // two horizontal rails
      ctx.fillStyle = cols[0];
      ctx.fillRect(ox, oy + 3, 16, 2);
      ctx.fillRect(ox, oy + 10, 16, 2);
      ctx.fillStyle = cols[1];
      ctx.fillRect(ox, oy + 4, 16, 1);
      ctx.fillRect(ox, oy + 11, 16, 1);
      if (index === T.fenceIron) {
        for (const yy of [0, 15]) {
          px(ctx, ox, oy, 3, yy, 1, 1, '#6e747d');
          px(ctx, ox, oy, 12, yy, 1, 1, '#6e747d');
        }
      }
      break;
    }
    case T.campfire: {
      // charred logs crossed over embers
      speckle(ctx, ox, oy, '#3a2a1c', 401, 10);
      ctx.fillStyle = '#5a4126';
      ctx.fillRect(ox + 1, oy + 10, 14, 3);
      ctx.fillRect(ox + 1, oy + 3, 14, 3);
      ctx.fillStyle = '#2c1f12';
      ctx.fillRect(ox + 1, oy + 12, 14, 1);
      blobs(ctx, ox, oy, 403, ['#ff8a2b', '#ffc84a', '#ff5f1f'], 5, 2, [
        [4, 6],
        [8, 7],
        [11, 5],
        [6, 9],
        [9, 10],
      ]);
      px(ctx, ox, oy, 7, 2, 2, 2, '#ffe9a0');
      px(ctx, ox, oy, 5, 4, 1, 1, '#fff4c8');
      px(ctx, ox, oy, 10, 3, 1, 1, '#fff4c8');
      break;
    }
    case T.pedestal: {
      speckle(ctx, ox, oy, '#9a9aa2', 411, 10);
      ctx.fillStyle = '#83838a';
      ctx.fillRect(ox, oy + 13, 16, 3);
      ctx.fillRect(ox + 5, oy + 4, 6, 10);
      ctx.fillStyle = '#b9b9c0';
      ctx.fillRect(ox + 4, oy + 3, 8, 2);
      // glowing crystal on top
      px(ctx, ox, oy, 6, 0, 4, 3, '#ffd76a');
      px(ctx, ox, oy, 7, 0, 2, 2, '#fff3bc');
      break;
    }
    case T.pedestalGold: {
      speckle(ctx, ox, oy, '#c99a20', 421, 14);
      ctx.fillStyle = '#a8801a';
      ctx.fillRect(ox, oy + 13, 16, 3);
      ctx.fillRect(ox + 5, oy + 4, 6, 10);
      ctx.fillStyle = '#f6d65c';
      ctx.fillRect(ox + 4, oy + 3, 8, 2);
      px(ctx, ox, oy, 6, 0, 4, 3, '#a6fff4');
      px(ctx, ox, oy, 7, 0, 2, 2, '#e2fffb');
      break;
    }
    case T.meatRaw: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#d2574c';
      ctx.fillRect(ox + 3, oy + 4, 10, 9);
      ctx.fillStyle = '#b23c34';
      ctx.fillRect(ox + 3, oy + 11, 10, 2);
      ctx.fillStyle = '#f0938a';
      ctx.fillRect(ox + 5, oy + 6, 4, 3);
      ctx.fillStyle = '#f8e3d4';
      ctx.fillRect(ox + 11, oy + 5, 2, 8); // fat rim
      px(ctx, ox, oy, 4, 2, 2, 2, '#e8e2d6'); // bone
      px(ctx, ox, oy, 10, 2, 2, 2, '#e8e2d6');
      break;
    }
    case T.meatCooked: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#9a5a2c';
      ctx.fillRect(ox + 3, oy + 4, 10, 9);
      ctx.fillStyle = '#6e3d1c';
      ctx.fillRect(ox + 3, oy + 11, 10, 2);
      ctx.fillStyle = '#c07c42';
      ctx.fillRect(ox + 5, oy + 6, 5, 3);
      ctx.fillStyle = '#5a3116';
      for (const [gx, gy] of [
        [4, 5],
        [8, 9],
        [11, 6],
      ])
        ctx.fillRect(ox + gx, oy + gy, 2, 1); // grill marks
      px(ctx, ox, oy, 4, 2, 2, 2, '#e8e2d6');
      px(ctx, ox, oy, 10, 2, 2, 2, '#e8e2d6');
      break;
    }
    case T.web: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.strokeStyle = 'rgba(238,240,245,0.9)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + 8.5, oy + 8.5);
        const a = (i * Math.PI) / 4;
        ctx.lineTo(ox + 8.5 + Math.cos(a) * 8, oy + 8.5 + Math.sin(a) * 8);
        ctx.moveTo(ox + 8.5, oy + 8.5);
        ctx.lineTo(ox + 8.5 - Math.cos(a) * 8, oy + 8.5 - Math.sin(a) * 8);
        ctx.stroke();
      }
      for (const r of [3, 6]) ctx.strokeRect(ox + 8.5 - r, oy + 8.5 - r, r * 2, r * 2);
      break;
    }
    case T.bone: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(ox + 6, oy + 4, 4, 9);
      ctx.fillRect(ox + 4, oy + 2, 8, 3);
      ctx.fillRect(ox + 4, oy + 12, 8, 3);
      ctx.fillStyle = '#c9c2ae';
      ctx.fillRect(ox + 6, oy + 6, 1, 6);
      px(ctx, ox, oy, 4, 2, 2, 2, '#f4efe2');
      px(ctx, ox, oy, 10, 12, 2, 2, '#f4efe2');
      break;
    }
    case T.flesh: {
      ctx.clearRect(ox, oy, 16, 16);
      speckle(ctx, ox, oy, '#7a9a4a', 431, 20);
      ctx.clearRect(ox, oy, 16, 3);
      ctx.clearRect(ox, oy + 13, 16, 3);
      ctx.clearRect(ox, oy, 3, 16);
      ctx.clearRect(ox + 13, oy, 3, 16);
      ctx.fillStyle = '#5a7a34';
      ctx.fillRect(ox + 5, oy + 6, 3, 2);
      ctx.fillRect(ox + 9, oy + 9, 2, 3);
      ctx.fillStyle = '#a05a4a';
      ctx.fillRect(ox + 7, oy + 4, 4, 2);
      break;
    }
    case T.gunpowder: {
      ctx.clearRect(ox, oy, 16, 16);
      const r3 = mulberry32(441);
      for (let i = 0; i < 46; i++) {
        const x = 2 + Math.floor(r3() * 12);
        const y = 4 + Math.floor(r3() * 10);
        px(ctx, ox, oy, x, y, 1, 1, r3() < 0.6 ? '#55555c' : r3() < 0.5 ? '#3a3a40' : '#7a7a84');
      }
      // little pile shape
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(ox + 5, oy + 10, 6, 3);
      ctx.fillRect(ox + 6, oy + 8, 4, 2);
      px(ctx, ox, oy, 7, 6, 2, 2, '#8a8a94');
      break;
    }
    case T.arrowItem: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.strokeStyle = '#a88a5c';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ox + 3, oy + 13);
      ctx.lineTo(ox + 12, oy + 4);
      ctx.stroke();
      ctx.fillStyle = '#c8ccd2';
      ctx.fillRect(ox + 11, oy + 2, 3, 3);
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(ox + 2, oy + 12, 2, 2);
      px(ctx, ox, oy, 4, 10, 1, 1, '#e8e2d2');
      break;
    }
    case T.lootBag: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#7a4bb8';
      ctx.fillRect(ox + 3, oy + 6, 10, 8);
      ctx.fillStyle = '#9a6ad8';
      ctx.fillRect(ox + 3, oy + 6, 10, 2);
      ctx.fillStyle = '#5a3390';
      ctx.fillRect(ox + 3, oy + 12, 10, 2);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(ox + 6, oy + 3, 4, 3);
      px(ctx, ox, oy, 7, 8, 2, 3, '#ffd76a'); // clasp
      px(ctx, ox, oy, 5, 7, 1, 1, '#d9b3ff');
      break;
    }
    case T.bed: {
      // top-down bed: white pillow, red blanket, wooden frame
      ctx.fillStyle = '#8b6a3c';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#c2453a';
      ctx.fillRect(ox + 1, oy + 5, 14, 10);
      ctx.fillStyle = '#a83228';
      ctx.fillRect(ox + 1, oy + 13, 14, 2);
      ctx.fillRect(ox + 1, oy + 5, 14, 1);
      ctx.fillStyle = '#e8e2d6';
      ctx.fillRect(ox + 2, oy + 1, 12, 4);
      ctx.fillStyle = '#c9c2b2';
      ctx.fillRect(ox + 2, oy + 4, 12, 1);
      px(ctx, ox, oy, 3, 2, 2, 1, '#f7f3e8');
      for (let i = 0; i < 5; i++)
        px(ctx, ox, oy, 3 + Math.floor(rand() * 10), 7 + Math.floor(rand() * 6), 1, 1, rand() < 0.5 ? '#d2574c' : '#b23c34');
      break;
    }
    case T.water: {
      speckle(ctx, ox, oy, '#3a6ec8', 501, 12);
      const r4 = mulberry32(503);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(r4() * 14);
        const y = Math.floor(r4() * 16);
        px(ctx, ox, oy, x, y, 2 + Math.floor(r4() * 2), 1, r4() < 0.5 ? '#5a8ede' : '#2f5cb0');
      }
      px(ctx, ox, oy, 3, 3, 3, 1, '#8ab4f0');
      px(ctx, ox, oy, 10, 9, 3, 1, '#8ab4f0');
      break;
    }
    case T.flowerRed:
    case T.flowerYellow:
    case T.flowerBlue: {
      ctx.clearRect(ox, oy, 16, 16);
      const petal = index === T.flowerRed ? '#e2564a' : index === T.flowerYellow ? '#f4c842' : '#5e8cff';
      const core = index === T.flowerYellow ? '#b8722a' : '#f4c842';
      // stem + leaves
      ctx.fillStyle = '#4d8c31';
      ctx.fillRect(ox + 7, oy + 7, 2, 9);
      px(ctx, ox, oy, 5, 11, 2, 1, '#5f9738');
      px(ctx, ox, oy, 9, 9, 2, 1, '#5f9738');
      // petals
      ctx.fillStyle = petal;
      ctx.fillRect(ox + 6, oy + 2, 4, 4);
      ctx.fillRect(ox + 4, oy + 3, 2, 2);
      ctx.fillRect(ox + 10, oy + 3, 2, 2);
      ctx.fillRect(ox + 7, oy, 2, 2);
      ctx.fillRect(ox + 7, oy + 6, 2, 1);
      px(ctx, ox, oy, 7, 3, 2, 2, core);
      break;
    }
    case T.flowerPink:
    case T.flowerPurple:
    case T.flowerWhite: {
      ctx.clearRect(ox, oy, 16, 16);
      const petal = index === T.flowerPink ? '#f28bb5' : index === T.flowerPurple ? '#a875df' : '#fff8e6';
      const core = index === T.flowerPurple ? '#f3cd58' : '#eebd42';
      ctx.fillStyle = '#4d8c31';
      ctx.fillRect(ox + 7, oy + 7, 2, 9);
      px(ctx, ox, oy, 5, 10, 3, 1, '#5f9738');
      px(ctx, ox, oy, 9, 12, 2, 1, '#5f9738');
      if (index === T.flowerPurple) {
        // lavender spike with clustered florets
        ctx.fillStyle = petal;
        for (const [x, y] of [[6, 5], [9, 4], [6, 2], [9, 1], [7, 0]]) ctx.fillRect(ox + x, oy + y, 2, 2);
        px(ctx, ox, oy, 8, 3, 1, 1, '#d9a3f0');
      } else {
        ctx.fillStyle = petal;
        // six-petal rosette, especially daisy-like for the white variant
        ctx.fillRect(ox + 6, oy + 2, 4, 4);
        ctx.fillRect(ox + 4, oy + 3, 2, 2);
        ctx.fillRect(ox + 10, oy + 3, 2, 2);
        ctx.fillRect(ox + 7, oy, 2, 2);
        if (index === T.flowerWhite) {
          ctx.fillRect(ox + 5, oy + 1, 2, 2);
          ctx.fillRect(ox + 9, oy + 1, 2, 2);
        }
        px(ctx, ox, oy, 7, 3, 2, 2, core);
      }
      break;
    }
    case T.lampRed:
    case T.lampBlue:
    case T.lampYellow: {
      const glow = index === T.lampRed ? ['#ff6e64', '#ffb0a8'] : index === T.lampBlue ? ['#6e96ff', '#b0c8ff'] : ['#ffdc64', '#fff0b0'];
      speckle(ctx, ox, oy, '#5a4126', 521 + index, 8);
      ctx.fillStyle = glow[0];
      ctx.fillRect(ox + 3, oy + 3, 10, 10);
      ctx.fillStyle = glow[1];
      ctx.fillRect(ox + 5, oy + 5, 6, 6);
      ctx.fillStyle = '#3a2611';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillRect(ox, oy, 2, 16);
      ctx.fillRect(ox + 14, oy, 2, 16);
      px(ctx, ox, oy, 7, 7, 2, 2, '#ffffff');
      break;
    }
    case T.snowTop: {
      speckle(ctx, ox, oy, '#eef2f8', 601, 8);
      for (let i = 0; i < 12; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#dde4ee' : '#ffffff');
      px(ctx, ox, oy, 4, 5, 2, 1, '#cdd6e4');
      px(ctx, ox, oy, 11, 10, 2, 1, '#cdd6e4');
      break;
    }
    case T.snowSide: {
      speckle(ctx, ox, oy, '#8a6244', 611, 20);
      ctx.fillStyle = '#eef2f8';
      ctx.fillRect(ox, oy, 16, 4);
      for (let x = 0; x < 16; x++) {
        const h = 3 + Math.floor(rand() * 2);
        ctx.fillStyle = rand() < 0.5 ? '#eef2f8' : '#dde4ee';
        ctx.fillRect(ox + x, oy, 1, h);
      }
      for (let i = 0; i < 10; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), 6 + Math.floor(rand() * 10), 1, 1, rand() < 0.5 ? '#7a5539' : '#96704f');
      break;
    }
    case T.ice: {
      speckle(ctx, ox, oy, '#a8cbec', 621, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(ox, oy, 16, 2);
      // cracks
      ctx.strokeStyle = '#7fa8d4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox + 2.5, oy + 12.5);
      ctx.lineTo(ox + 7.5, oy + 6.5);
      ctx.lineTo(ox + 13.5, oy + 9.5);
      ctx.stroke();
      px(ctx, ox, oy, 3, 3, 2, 1, '#e8f2fc');
      px(ctx, ox, oy, 11, 5, 2, 1, '#e8f2fc');
      break;
    }
    case T.snowLeaves: {
      speckle(ctx, ox, oy, '#447f2a', 631, 22);
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(rand() * 16),
          y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1, 1, rand() < 0.5 ? '#356320' : '#5ba236');
      }
      // snow caps + transparent see-through holes
      ctx.fillStyle = '#eef2f8';
      ctx.fillRect(ox, oy, 16, 2);
      for (let i = 0; i < 14; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 12), 2, 1, rand() < 0.6 ? '#eef2f8' : '#ffffff');
      const rHoleS = mulberry32(637);
      for (let i = 0; i < 14; i++) {
        const hx = Math.floor(rHoleS() * 15);
        const hy = 3 + Math.floor(rHoleS() * 12);
        ctx.clearRect(ox + hx, oy + hy, 1, 1);
      }
      break;
    }
    case T.hive: {
      // woven wax hive with a dark entrance and honey drips
      speckle(ctx, ox, oy, '#d8a848', 701, 12);
      ctx.fillStyle = '#b8892e';
      for (const yy of [3, 7, 11]) ctx.fillRect(ox, oy + yy, 16, 1);
      ctx.fillStyle = '#3a2a14';
      ctx.fillRect(ox + 6, oy + 9, 4, 3);
      ctx.fillStyle = '#f4c85c';
      ctx.fillRect(ox + 2, oy + 4, 2, 2);
      ctx.fillRect(ox + 12, oy + 5, 2, 1);
      px(ctx, ox, oy, 5, 13, 1, 2, '#f4b83a'); // drip
      px(ctx, ox, oy, 11, 12, 1, 3, '#f4b83a');
      break;
    }
    case T.turtleEgg: {
      ctx.clearRect(ox, oy, 16, 16);
      // sandy nest mound hugging the ground
      ctx.fillStyle = '#d4c491';
      ctx.fillRect(ox + 1, oy + 13, 14, 3);
      ctx.fillStyle = '#c4b481';
      ctx.fillRect(ox + 2, oy + 12, 12, 1);
      px(ctx, ox, oy, 3, 14, 2, 1, '#e0d0a0');
      px(ctx, ox, oy, 11, 15, 2, 1, '#b8a878');
      // plump rounded eggs nestled into the sand
      const egg = (ex: number, ey: number, w: number, h: number) => {
        // rounded silhouette: main body + trimmed corners
        ctx.fillStyle = '#eef2e4';
        ctx.fillRect(ox + ex + 1, oy + ey, w - 2, h);
        ctx.fillRect(ox + ex, oy + ey + 1, w, h - 2);
        // highlight + shading
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox + ex + 1, oy + ey + 1, 2, 1);
        ctx.fillStyle = '#c8d0b8';
        ctx.fillRect(ox + ex + 1, oy + ey + h - 1, w - 2, 1);
        ctx.fillRect(ox + ex + w - 1, oy + ey + 2, 1, h - 3);
        // speckles
        px(ctx, ox, oy, ex + 2, ey + 3, 1, 1, '#9aa888');
        px(ctx, ox, oy, ex + w - 3, ey + 2, 1, 1, '#9aa888');
      };
      egg(1, 7, 6, 7); // left egg
      egg(9, 8, 6, 6); // right egg
      egg(5, 4, 6, 7); // back egg peeking over
      break;
    }
    case T.anvil: {
      speckle(ctx, ox, oy, '#4a4c54', 711, 8);
      // top face
      ctx.fillStyle = '#5e626c';
      ctx.fillRect(ox + 1, oy + 2, 14, 4);
      ctx.fillStyle = '#787c88';
      ctx.fillRect(ox + 1, oy + 2, 14, 1);
      // waist + base
      ctx.fillStyle = '#3a3c44';
      ctx.fillRect(ox + 5, oy + 6, 6, 5);
      ctx.fillStyle = '#4e5058';
      ctx.fillRect(ox + 3, oy + 11, 10, 4);
      px(ctx, ox, oy, 2, 3, 2, 1, '#9aa0ac'); // glint
      break;
    }
    case T.netheriteOre: {
      speckle(ctx, ox, oy, '#4a3028', 721, 10);
      blobs(ctx, ox, oy, 723, ['#7a4a38', '#8a5a42', '#5a3a2c'], 5, 2);
      // gold-ish sparks of ancient metal
      px(ctx, ox, oy, 4, 5, 2, 1, '#c8925a');
      px(ctx, ox, oy, 10, 9, 1, 2, '#c8925a');
      px(ctx, ox, oy, 7, 12, 2, 1, '#a87848');
      break;
    }
    case T.honey: {
      ctx.clearRect(ox, oy, 16, 16);
      // honey pot
      ctx.fillStyle = '#b8792e';
      ctx.fillRect(ox + 4, oy + 6, 8, 7);
      ctx.fillStyle = '#f4b83a';
      ctx.fillRect(ox + 4, oy + 5, 8, 3);
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(ox + 5, oy + 5, 3, 1);
      ctx.fillStyle = '#8a5a1e';
      ctx.fillRect(ox + 5, oy + 12, 6, 1);
      px(ctx, ox, oy, 7, 3, 2, 2, '#f4b83a'); // drip above
      break;
    }
    case T.netherite: {
      ctx.clearRect(ox, oy, 16, 16);
      // ancient scrap: a chipped fragment with ember inclusions
      ctx.fillStyle = '#281d20';
      ctx.fillRect(ox + 3, oy + 6, 10, 6);
      ctx.fillStyle = '#4a383b';
      ctx.fillRect(ox + 4, oy + 6, 8, 3);
      ctx.fillStyle = '#241c20';
      ctx.fillRect(ox + 4, oy + 11, 8, 1);
      px(ctx, ox, oy, 5, 8, 2, 1, '#ff7045');
      px(ctx, ox, oy, 10, 9, 1, 1, '#ffb05e');
      px(ctx, ox, oy, 4, 4, 2, 2, '#34292c'); // broken shard
      px(ctx, ox, oy, 11, 4, 1, 2, '#34292c');
      break;
    }
    case T.netheriteIngot: {
      ctx.clearRect(ox, oy, 16, 16);
      // Ember-forged alloy ingot: crisp bevel, dark steel body, orange rune seam.
      px(ctx, ox, oy, 4, 4, 8, 2, '#211a20');
      px(ctx, ox, oy, 2, 6, 12, 5, '#211a20');
      px(ctx, ox, oy, 4, 11, 9, 2, '#211a20');
      px(ctx, ox, oy, 4, 5, 8, 2, '#6b555b');
      px(ctx, ox, oy, 3, 7, 10, 3, '#42363c');
      px(ctx, ox, oy, 4, 10, 8, 2, '#30272d');
      px(ctx, ox, oy, 5, 5, 5, 1, '#baa09a');
      px(ctx, ox, oy, 4, 7, 2, 1, '#ff7045');
      px(ctx, ox, oy, 6, 8, 4, 1, '#ffd06a');
      px(ctx, ox, oy, 10, 9, 2, 1, '#ff7045');
      px(ctx, ox, oy, 3, 6, 1, 1, '#ffb05e');
      break;
    }
    case T.wool: {
      // fluffy knit texture
      speckle(ctx, ox, oy, '#eeeeeb', 801, 6);
      const r5 = mulberry32(803);
      for (let i = 0; i < 22; i++) {
        const x = Math.floor(r5() * 15);
        const y = Math.floor(r5() * 15);
        px(ctx, ox, oy, x, y, 2, 1, r5() < 0.5 ? '#e0e0dc' : '#f8f8f5');
      }
      for (const yy of [4, 9, 14]) {
        for (let x = 0; x < 16; x += 3) px(ctx, ox, oy, x + ((yy / 4) | 0), yy, 2, 1, '#d8d8d2');
      }
      break;
    }
    case T.feather: {
      ctx.clearRect(ox, oy, 16, 16);
      // quill diagonal + barbs
      ctx.strokeStyle = '#c8c4b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ox + 3, oy + 13);
      ctx.lineTo(ox + 12, oy + 3);
      ctx.stroke();
      ctx.fillStyle = '#f2f2f6';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(ox + 4 + i, oy + 10 - i, 4, 2);
      }
      ctx.fillStyle = '#dcdce4';
      for (let i = 0; i < 5; i++) px(ctx, ox, oy, 5 + i, 10 - i, 1, 1, '#dcdce4');
      break;
    }
    case T.turtleShell: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#4d8c5a';
      ctx.fillRect(ox + 3, oy + 5, 10, 8);
      ctx.fillRect(ox + 4, oy + 4, 8, 10);
      ctx.fillStyle = '#7ab88a';
      ctx.fillRect(ox + 5, oy + 6, 3, 3);
      ctx.fillRect(ox + 9, oy + 9, 3, 3);
      ctx.fillStyle = '#3a6a44';
      ctx.fillRect(ox + 3, oy + 12, 10, 1);
      px(ctx, ox, oy, 5, 5, 1, 1, '#8fcf9e');
      break;
    }
    case T.crabShell: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#d85a3a';
      ctx.fillRect(ox + 3, oy + 6, 10, 6);
      ctx.fillRect(ox + 4, oy + 5, 8, 8);
      ctx.fillStyle = '#f2836a';
      ctx.fillRect(ox + 5, oy + 6, 6, 2);
      ctx.fillStyle = '#a83c22';
      ctx.fillRect(ox + 4, oy + 11, 8, 1);
      // little spikes
      px(ctx, ox, oy, 3, 4, 1, 2, '#a83c22');
      px(ctx, ox, oy, 12, 4, 1, 2, '#a83c22');
      break;
    }
    case T.fishScale: {
      ctx.clearRect(ox, oy, 16, 16);
      // overlapping shiny scales
      ctx.fillStyle = '#6eaadc';
      ctx.fillRect(ox + 5, oy + 5, 6, 7);
      ctx.fillRect(ox + 4, oy + 6, 8, 5);
      ctx.fillStyle = '#9ecdf2';
      ctx.fillRect(ox + 5, oy + 5, 6, 2);
      ctx.fillStyle = '#4d80b8';
      ctx.fillRect(ox + 5, oy + 11, 6, 1);
      px(ctx, ox, oy, 6, 6, 2, 1, '#d0e8fa');
      break;
    }
    case T.penguinEgg: {
      ctx.clearRect(ox, oy, 16, 16);
      // single large bluish egg on a snow patch
      ctx.fillStyle = '#eef2f8';
      ctx.fillRect(ox + 2, oy + 13, 12, 3);
      ctx.fillStyle = '#e1e8f0';
      ctx.fillRect(ox + 5, oy + 4, 6, 10);
      ctx.fillRect(ox + 4, oy + 5, 8, 8);
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(ox + 6, oy + 5, 3, 2);
      ctx.fillStyle = '#b8c8dc';
      ctx.fillRect(ox + 5, oy + 12, 6, 1);
      break;
    }
    case T.catClaw: {
      ctx.clearRect(ox, oy, 16, 16);
      // curved talon
      ctx.strokeStyle = '#e6dcc8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ox + 5, oy + 3);
      ctx.quadraticCurveTo(ox + 12, oy + 6, ox + 10, oy + 13);
      ctx.stroke();
      ctx.fillStyle = '#c8bca4';
      ctx.fillRect(ox + 4, oy + 2, 3, 3); // root
      break;
    }
    case T.diamondBlock: {
      // Unique style: Prismatic Star-Cut Crystal Vault Block with refracting facets & white-cyan star core
      ctx.fillStyle = '#0e4d5c';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#22a6bd';
      ctx.fillRect(ox + 1, oy + 1, 14, 14);
      ctx.fillStyle = '#3fe0f0';
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      // Dark teal corner triangles
      for (const [cx, cy] of [[1, 1], [13, 1], [1, 13], [13, 13]]) {
        px(ctx, ox, oy, cx, cy, 2, 2, '#126475');
      }
      // 4-pointed star prism in center
      px(ctx, ox, oy, 7, 2, 2, 12, '#8cfaff');
      px(ctx, ox, oy, 2, 7, 12, 2, '#8cfaff');
      px(ctx, ox, oy, 5, 5, 6, 6, '#5ceef7');
      px(ctx, ox, oy, 6, 6, 4, 4, '#b8ffff');
      px(ctx, ox, oy, 7, 7, 2, 2, '#ffffff');
      break;
    }
    case T.birchLogSide: {
      // white paper birch bark with realistic horizontal black lenticel streaks
      speckle(ctx, ox, oy, '#e8e8e6', 853, 14);
      for (let i = 0; i < 20; i++)
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#dcdcd8' : '#f5f5f2');
      ctx.fillStyle = '#2b2a28';
      // horizontal dark notches
      ctx.fillRect(ox + 2, oy + 3, 4, 1);
      ctx.fillRect(ox + 10, oy + 5, 5, 1);
      ctx.fillRect(ox + 1, oy + 9, 3, 1);
      ctx.fillRect(ox + 7, oy + 11, 6, 1);
      ctx.fillRect(ox + 3, oy + 14, 4, 1);
      px(ctx, ox, oy, 6, 3, 1, 1, '#686660');
      px(ctx, ox, oy, 9, 5, 1, 1, '#686660');
      px(ctx, ox, oy, 13, 11, 1, 1, '#686660');
      break;
    }
    case T.birchLogTop: {
      speckle(ctx, ox, oy, '#e8e8e6', 863, 10);
      ctx.fillStyle = '#cbb27a';
      ctx.fillRect(ox + 1, oy + 1, 14, 14);
      ctx.fillStyle = '#b99e65';
      for (let r = 2; r < 7; r += 2) {
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 8 - r + 0.5, oy + 8 - r + 0.5, r * 2 - 1, r * 2 - 1);
      }
      break;
    }
    case T.birchLeaves: {
      // bright spring emerald leaves with cutout transparent holes
      speckle(ctx, ox, oy, '#6cb33a', 877, 24);
      for (let i = 0; i < 35; i++) {
        const x = Math.floor(rand() * 16),
          y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1, 1, rand() < 0.5 ? '#539327' : '#88d44c');
      }
      for (let i = 0; i < 10; i++) px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, '#a4eb6a');
      const rHoleB = mulberry32(881);
      for (let i = 0; i < 18; i++) {
        const hx = Math.floor(rHoleB() * 15);
        const hy = Math.floor(rHoleB() * 15);
        ctx.clearRect(ox + hx, oy + hy, 1, 1);
      }
      break;
    }
    case T.appleLeaves: {
      // deep green oak leaves with cutout holes AND glossy red apples!
      speckle(ctx, ox, oy, '#3d7826', 893, 26);
      for (let i = 0; i < 30; i++) {
        const x = Math.floor(rand() * 16),
          y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1, 1, rand() < 0.5 ? '#2c5b1b' : '#529634');
      }
      // transparent holes
      const rHoleA = mulberry32(899);
      for (let i = 0; i < 16; i++) {
        const hx = Math.floor(rHoleA() * 15);
        const hy = Math.floor(rHoleA() * 15);
        ctx.clearRect(ox + hx, oy + hy, 1, 1);
      }
      // red apples with highlight and stem
      const drawApple = (ax: number, ay: number) => {
        ctx.fillStyle = '#dc3224';
        ctx.fillRect(ox + ax, oy + ay, 3, 3);
        ctx.fillRect(ox + ax + 1, oy + ay - 1, 1, 1); // top bulge
        px(ctx, ox, oy, ax, ay, 1, 1, '#ff6b5e'); // glint
        px(ctx, ox, oy, ax + 1, ay - 1, 1, 1, '#5a3d1c'); // stem
      };
      drawApple(3, 4);
      drawApple(10, 9);
      drawApple(4, 11);
      break;
    }
    case T.autumnLeaves: {
      // mottled maple canopy: gold, amber, vermilion and russet with cutout gaps
      speckle(ctx, ox, oy, '#c65a25', 911, 28);
      const fallColors = ['#e99b28', '#f0bd3c', '#d84926', '#9f3525', '#ef7628'];
      for (let i = 0; i < 38; i++) {
        const x = Math.floor(rand() * 16), y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1 + (rand() < 0.22 ? 1 : 0), 1, fallColors[Math.floor(rand() * fallColors.length)]);
      }
      for (const [x, y] of [[2, 3], [11, 2], [6, 8], [12, 12], [3, 13]])
        px(ctx, ox, oy, x, y, 2, 2, '#f3cb4c');
      const autumnHoles = mulberry32(919);
      for (let i = 0; i < 13; i++) ctx.clearRect(ox + Math.floor(autumnHoles() * 15), oy + Math.floor(autumnHoles() * 15), 1, 1);
      break;
    }
    case T.cherryLeaves: {
      // pale sakura canopy with layered pink blossoms and a few fresh green leaves
      speckle(ctx, ox, oy, '#e9a6be', 929, 22);
      for (let i = 0; i < 32; i++) {
        const x = Math.floor(rand() * 16), y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1, 1, rand() < 0.58 ? '#f7c6d7' : '#ce789b');
      }
      for (const [x, y] of [[2, 4], [10, 2], [6, 9], [12, 12], [3, 13]]) {
        px(ctx, ox, oy, x, y, 2, 2, '#fff0f4');
        px(ctx, ox, oy, x, y, 1, 1, '#ffe1a1');
      }
      for (const [x, y] of [[4, 8], [11, 6], [8, 13]]) px(ctx, ox, oy, x, y, 2, 1, '#82b54c');
      const cherryHoles = mulberry32(937);
      for (let i = 0; i < 14; i++) ctx.clearRect(ox + Math.floor(cherryHoles() * 15), oy + Math.floor(cherryHoles() * 15), 1, 1);
      break;
    }
    case T.jacarandaLeaves: {
      // jacaranda canopy: layered violet blossoms with a few dark green leaf gaps
      speckle(ctx, ox, oy, '#8052a4', 947, 24);
      for (let i = 0; i < 34; i++) {
        const x = Math.floor(rand() * 16), y = Math.floor(rand() * 16);
        px(ctx, ox, oy, x, y, 1 + (rand() < 0.2 ? 1 : 0), 1,
          rand() < 0.55 ? '#b689d2' : rand() < 0.5 ? '#603a82' : '#9563bc');
      }
      for (const [x, y] of [[2, 4], [10, 2], [6, 9], [12, 12], [3, 13]]) {
        px(ctx, ox, oy, x, y, 2, 2, '#d9a9e8');
        px(ctx, ox, oy, x, y, 1, 1, '#f0c4ef');
      }
      for (const [x, y] of [[4, 8], [11, 6], [8, 13]]) px(ctx, ox, oy, x, y, 2, 1, '#557d3b');
      const jacarandaHoles = mulberry32(953);
      for (let i = 0; i < 14; i++) ctx.clearRect(ox + Math.floor(jacarandaHoles() * 15), oy + Math.floor(jacarandaHoles() * 15), 1, 1);
      break;
    }
    case T.cactusSide: {
      // vertical ribbed bands with white spine clusters
      speckle(ctx, ox, oy, '#559c3c', 911, 14);
      ctx.fillStyle = '#3f7c2a';
      for (const rx of [0, 5, 10, 15]) ctx.fillRect(ox + rx, oy, 1, 16);
      ctx.fillStyle = '#71be52';
      for (const rx of [2, 7, 12]) ctx.fillRect(ox + rx, oy, 2, 16);
      // spine / needle clusters
      for (const [sx, sy] of [
        [3, 3],
        [8, 6],
        [13, 2],
        [3, 11],
        [8, 13],
        [13, 10],
      ]) {
        px(ctx, ox, oy, sx, sy, 1, 1, '#ffffff');
        px(ctx, ox, oy, sx - 1, sy, 1, 1, '#e8eedc');
        px(ctx, ox, oy, sx + 1, sy, 1, 1, '#e8eedc');
        px(ctx, ox, oy, sx, sy - 1, 1, 1, '#4a3212'); // dark root
      }
      break;
    }
    case T.cactusTop: {
      speckle(ctx, ox, oy, '#4b8a34', 921, 10);
      ctx.fillStyle = '#396d24';
      ctx.fillRect(ox + 7, oy, 2, 16);
      ctx.fillRect(ox, oy + 7, 16, 2);
      ctx.fillStyle = '#65ab46';
      ctx.fillRect(ox + 4, oy + 4, 8, 8);
      px(ctx, ox, oy, 7, 7, 2, 2, '#85cf62');
      for (const [sx, sy] of [
        [4, 4],
        [11, 4],
        [4, 11],
        [11, 11],
      ])
        px(ctx, ox, oy, sx, sy, 1, 1, '#ffffff');
      break;
    }
    case T.cactusPaleSide: {
      // pale sage/dusty desert cactus
      speckle(ctx, ox, oy, '#78a878', 931, 14);
      ctx.fillStyle = '#5c8a5c';
      for (const rx of [0, 5, 10, 15]) ctx.fillRect(ox + rx, oy, 1, 16);
      ctx.fillStyle = '#94c294';
      for (const rx of [2, 7, 12]) ctx.fillRect(ox + rx, oy, 2, 16);
      for (const [sx, sy] of [
        [3, 4],
        [8, 8],
        [13, 3],
        [3, 12],
        [8, 14],
        [13, 11],
      ]) {
        px(ctx, ox, oy, sx, sy, 1, 1, '#f8fdf4');
        px(ctx, ox, oy, sx - 1, sy, 1, 1, '#d8e4d2');
        px(ctx, ox, oy, sx, sy - 1, 1, 1, '#403820');
      }
      break;
    }
    case T.cactusPaleTop: {
      speckle(ctx, ox, oy, '#669666', 941, 10);
      ctx.fillStyle = '#4e7a4e';
      ctx.fillRect(ox + 7, oy, 2, 16);
      ctx.fillRect(ox, oy + 7, 16, 2);
      ctx.fillStyle = '#8ab88a';
      ctx.fillRect(ox + 4, oy + 4, 8, 8);
      px(ctx, ox, oy, 7, 7, 2, 2, '#a4d4a4');
      break;
    }
    case T.tallGrass: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#5f9738';
      for (const [gx, gy, gw, gh] of [
        [3, 4, 2, 12],
        [6, 2, 2, 14],
        [9, 5, 2, 11],
        [12, 3, 2, 13],
      ]) {
        ctx.fillRect(ox + gx, oy + gy, gw, gh);
      }
      ctx.fillStyle = '#78b54e';
      for (let i = 0; i < 10; i++)
        px(ctx, ox, oy, 3 + Math.floor(rand() * 11), 3 + Math.floor(rand() * 12), 1, 1, '#8ed05e');
      break;
    }
    case T.fern: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#41822d';
      ctx.fillRect(ox + 7, oy + 3, 2, 13);
      for (let i = 0; i < 4; i++) {
        const fy = 4 + i * 3;
        const fw = 3 + i;
        ctx.fillRect(ox + 7 - fw, oy + fy, fw * 2 + 2, 1);
        ctx.fillRect(ox + 7 - fw + 1, oy + fy + 1, (fw - 1) * 2 + 2, 1);
      }
      px(ctx, ox, oy, 7, 2, 2, 1, '#66aa4e');
      break;
    }
    case T.deadBush: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.strokeStyle = '#a4845c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ox + 8, oy + 15);
      ctx.lineTo(ox + 8, oy + 8);
      ctx.lineTo(ox + 4, oy + 3);
      ctx.moveTo(ox + 8, oy + 9);
      ctx.lineTo(ox + 13, oy + 4);
      ctx.moveTo(ox + 6, oy + 6);
      ctx.lineTo(ox + 2, oy + 8);
      ctx.moveTo(ox + 10, oy + 7);
      ctx.lineTo(ox + 14, oy + 10);
      ctx.stroke();
      break;
    }
    case T.apple: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#e23628';
      ctx.fillRect(ox + 4, oy + 5, 8, 8);
      ctx.fillRect(ox + 5, oy + 4, 6, 10);
      ctx.fillRect(ox + 3, oy + 6, 10, 6);
      ctx.fillStyle = '#ff6c5e';
      ctx.fillRect(ox + 5, oy + 5, 2, 3);
      ctx.fillStyle = '#b81e12';
      ctx.fillRect(ox + 5, oy + 12, 6, 1);
      // stem + leaf
      ctx.fillStyle = '#5c3d18';
      ctx.fillRect(ox + 7, oy + 2, 2, 3);
      ctx.fillStyle = '#56a832';
      ctx.fillRect(ox + 9, oy + 2, 3, 2);
      break;
    }
    case T.volcanicStone: {
      // Charcoal grey volcanic basalt with unmistakable ember/ruby inclusions.
      speckle(ctx, ox, oy, '#3d4144', 21, 13);
      for (let i = 0; i < 13; i++)
        px(ctx, ox, oy, Math.floor(rand() * 15), Math.floor(rand() * 15), 2, 1, rand() < 0.5 ? '#303438' : '#505458');
      for (let i = 0; i < 9; i++) {
        const x = 1 + Math.floor(rand() * 13), y = 1 + Math.floor(rand() * 14);
        const ruby = rand() < 0.55;
        px(ctx, ox, oy, x, y, 2, 1, ruby ? '#b8432e' : '#852f2b');
        if (ruby && i % 3 === 0) px(ctx, ox, oy, x, y - 1, 1, 1, '#e16a3e');
      }
      break;
    }
    case T.palmLogSide: {
      speckle(ctx, ox, oy, '#9a7045', 2017, 12);
      ctx.fillStyle = '#66482d';
      for (let y = 2; y < 16; y += 4) ctx.fillRect(ox, oy + y, 16, 1);
      px(ctx, ox, oy, 5, 5, 3, 1, '#c19862');
      break;
    }
    case T.palmLogTop: {
      speckle(ctx, ox, oy, '#bd955f', 2023, 8);
      ctx.strokeStyle = '#735031';
      for (let r = 2; r < 8; r += 2) ctx.strokeRect(ox + 8 - r, oy + 8 - r, r * 2, r * 2);
      break;
    }
    case T.dryBloom:
    case T.desertThistle: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#8e7952'; ctx.fillRect(ox + 7, oy + 7, 2, 8);
      ctx.fillStyle = index === T.dryBloom ? '#b37b5b' : '#9c9658';
      for (const [x,y] of [[4,5],[9,4],[3,9],[10,8]]) ctx.fillRect(ox + x, oy + y, 3, 2);
      ctx.fillStyle = '#d3a176'; ctx.fillRect(ox + 7, oy + 5, 2, 2);
      break;
    }
    case T.birdNest:
    case T.chickenNest: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = index === T.birdNest ? '#62432b' : '#d0a951';
      ctx.fillRect(ox + 2, oy + 8, 12, 5);
      ctx.fillStyle = index === T.birdNest ? '#3b291d' : '#9a793c';
      ctx.fillRect(ox + 4, oy + 7, 8, 3);
      ctx.fillStyle = '#ede7d2';
      ctx.fillRect(ox + 5, oy + 5, 2, 4); ctx.fillRect(ox + 9, oy + 5, 2, 4);
      break;
    }
    case T.coconutLeaves:
    case T.bananaLeaves: {
      const banana = index === T.bananaLeaves;
      speckle(ctx, ox, oy, banana ? '#69a536' : '#38844b', 2029, 25);
      const holes = mulberry32(2039 + index);
      for (let i = 0; i < 22; i++) ctx.clearRect(ox + Math.floor(holes() * 16), oy + Math.floor(holes() * 16), 1, 1);
      for (const [x,y] of [[4,5],[10,9],[6,11]]) px(ctx, ox, oy, x, y, banana ? 2 : 3, 2, banana ? '#eed04b' : '#80603a');
      break;
    }
    case T.vine: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#366c2f'; ctx.fillRect(ox + 6, oy, 2, 16);
      ctx.fillStyle = '#5da84c';
      for (let y = 2; y < 16; y += 4) { ctx.fillRect(ox + 3, oy + y, 4, 2); ctx.fillRect(ox + 8, oy + y + 2, 5, 2); }
      break;
    }
    case T.coconut:
    case T.banana: {
      ctx.clearRect(ox, oy, 16, 16);
      if (index === T.coconut) {
        ctx.fillStyle = '#694627'; ctx.fillRect(ox + 4, oy + 4, 9, 9);
        ctx.fillStyle = '#9e7241'; ctx.fillRect(ox + 5, oy + 4, 6, 3);
        px(ctx, ox, oy, 7, 8, 2, 2, '#d2b482');
      } else {
        ctx.fillStyle = '#f1cc45';
        for (let x = 4; x < 12; x++) ctx.fillRect(ox + x, oy + 5 + Math.floor((x-8)*(x-8)/16), 2, 3);
        px(ctx, ox, oy, 11, 9, 2, 1, '#694c2b');
      }
      break;
    }
    case T.mushroom: {
      ctx.clearRect(ox, oy, 16, 16);
      // Pixel-art red-capped woodland mushroom with a stout cream stem.
      ctx.fillStyle = '#e9ddc5';
      ctx.fillRect(ox + 6, oy + 8, 4, 7);
      ctx.fillRect(ox + 5, oy + 11, 6, 3);
      ctx.fillStyle = '#a84436';
      ctx.fillRect(ox + 3, oy + 4, 10, 5);
      ctx.fillRect(ox + 5, oy + 2, 6, 3);
      ctx.fillStyle = '#d96a4c';
      ctx.fillRect(ox + 5, oy + 3, 5, 2);
      for (const [x,y] of [[4,6],[8,4],[11,6]]) px(ctx, ox, oy, x, y, 1, 1, '#f3e7d0');
      break;
    }
    case T.craftingTableTop: {
      // Classic wooden crafting table top with 3x3 carved grid
      speckle(ctx, ox, oy, '#ba905a', 951, 8);
      ctx.fillStyle = '#7a4e24';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillRect(ox, oy, 2, 16);
      ctx.fillRect(ox + 14, oy, 2, 16);
      // 3x3 crafting grid in the center
      ctx.fillStyle = '#9e6e3c';
      ctx.fillRect(ox + 3, oy + 3, 10, 10);
      ctx.fillStyle = '#5e3814';
      ctx.fillRect(ox + 6, oy + 3, 1, 10);
      ctx.fillRect(ox + 9, oy + 3, 1, 10);
      ctx.fillRect(ox + 3, oy + 6, 10, 1);
      ctx.fillRect(ox + 3, oy + 9, 10, 1);
      // tiny carved hammer/tool icons in corner
      px(ctx, ox, oy, 13, 2, 1, 2, '#4a2c0f');
      px(ctx, ox, oy, 2, 13, 2, 1, '#4a2c0f');
      break;
    }
    case T.craftingTableSide:
    case T.craftingTableFront: {
      // Wood plank base with hanging saw, shears & drawer
      speckle(ctx, ox, oy, '#a87e46', 961, 10);
      ctx.fillStyle = '#6a421c';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      // drawer / compartment
      ctx.fillStyle = '#5c3514';
      ctx.fillRect(ox + 3, oy + 3, 10, 5);
      ctx.fillStyle = '#8f6334';
      ctx.fillRect(ox + 4, oy + 4, 8, 3);
      px(ctx, ox, oy, 7, 5, 2, 1, '#2c1808'); // drawer pull
      // hanging saw / tool on side
      ctx.fillStyle = '#c4cacf';
      ctx.fillRect(ox + 4, oy + 10, 6, 2);
      ctx.fillStyle = '#724921';
      ctx.fillRect(ox + 10, oy + 9, 2, 4);
      px(ctx, ox, oy, 5, 12, 1, 1, '#8c9298');
      px(ctx, ox, oy, 7, 12, 1, 1, '#8c9298');
      break;
    }
    case T.sandstoneTop: {
      // Smooth sun-warmed sandstone top with subtle bevelled rim
      speckle(ctx, ox, oy, '#dfd29e', 2111, 8);
      ctx.fillStyle = '#eae0b2';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillStyle = '#cbb982';
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillRect(ox + 15, oy, 1, 16);
      for (let i = 0; i < 10; i++) {
        px(ctx, ox, oy, 1 + Math.floor(rand() * 14), 1 + Math.floor(rand() * 14), 2, 1, rand() < 0.5 ? '#e8dcad' : '#d2c28c');
      }
      break;
    }
    case T.sandstoneSide: {
      // Classic Minecraft sandstone: smooth cap band on top, stratified sandstone courses below
      speckle(ctx, ox, oy, '#dacb96', 2129, 10);
      // smooth top cap (rows 0..3)
      ctx.fillStyle = '#e7dbb0';
      ctx.fillRect(ox, oy, 16, 3);
      ctx.fillStyle = '#efe5be';
      ctx.fillRect(ox, oy, 16, 1);
      ctx.fillStyle = '#b9a572';
      ctx.fillRect(ox, oy + 3, 16, 1);
      // horizontal sandstone layers & block joints
      for (const [ry, col] of [
        [7, '#c2ae7a'],
        [11, '#bca773'],
        [15, '#b6a06c'],
      ] as const) {
        ctx.fillStyle = col;
        ctx.fillRect(ox, oy + ry, 16, 1);
      }
      for (const [jx, jy, jh] of [
        [5, 4, 3],
        [12, 4, 3],
        [3, 8, 3],
        [10, 8, 3],
        [7, 12, 3],
        [14, 12, 3],
      ]) {
        ctx.fillStyle = '#c2ae7a';
        ctx.fillRect(ox + jx, oy + jy, 1, jh);
        px(ctx, ox, oy, jx + 1, jy, 2, 1, '#e8dcad');
      }
      break;
    }
    case T.sandstoneBottom: {
      // Rough fractured sandstone underside
      speckle(ctx, ox, oy, '#cdb982', 2141, 14);
      for (const [bx, by, bw, bh] of [
        [1, 1, 6, 6],
        [8, 1, 7, 5],
        [1, 8, 7, 7],
        [9, 7, 6, 8],
      ]) {
        ctx.fillStyle = '#dac994';
        ctx.fillRect(ox + bx, oy + by, bw, bh);
        ctx.fillStyle = '#b6a06c';
        ctx.fillRect(ox + bx, oy + by + bh - 1, bw, 1);
      }
      break;
    }
    case T.chiseledSandstoneSide: {
      // Carved sandstone with cornice bands and sunken hieroglyph frame
      speckle(ctx, ox, oy, '#e1d4a2', 2153, 8);
      ctx.fillStyle = '#efe5be';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillStyle = '#b59f6b';
      ctx.fillRect(ox, oy + 2, 16, 1);
      ctx.fillRect(ox, oy + 13, 16, 1);
      // carved recessed panel
      ctx.fillStyle = '#c8b47e';
      ctx.fillRect(ox + 2, oy + 4, 12, 8);
      ctx.fillStyle = '#e6daaa';
      ctx.fillRect(ox + 3, oy + 5, 10, 6);
      // hieroglyph motif inside panel
      ctx.fillStyle = '#9e8755';
      ctx.fillRect(ox + 5, oy + 6, 2, 2);
      ctx.fillRect(ox + 9, oy + 6, 2, 2);
      ctx.fillRect(ox + 7, oy + 8, 2, 2);
      ctx.fillRect(ox + 5, oy + 9, 6, 1);
      break;
    }
    case T.terracottaOrange: {
      // Warm sun-baked orange terracotta clay
      speckle(ctx, ox, oy, '#a9562b', 2161, 9);
      for (const [ry, col] of [
        [2, '#b66033'],
        [6, '#9c4c24'],
        [10, '#b96437'],
        [14, '#964720'],
      ] as const) {
        ctx.fillStyle = col;
        ctx.fillRect(ox, oy + ry, 16, 2);
      }
      for (let i = 0; i < 12; i++) {
        px(ctx, ox, oy, Math.floor(rand() * 15), Math.floor(rand() * 16), 2, 1, rand() < 0.5 ? '#c16b3d' : '#8f421d');
      }
      break;
    }
    case T.hayBaleTop: {
      // Golden bundled dry straw ends
      speckle(ctx, ox, oy, '#d2ab3e', 2179, 16);
      for (let i = 0; i < 18; i++) {
        const sx = Math.floor(rand() * 14);
        const sy = Math.floor(rand() * 15);
        px(ctx, ox, oy, sx, sy, 3, 1, i % 2 === 0 ? '#e7c458' : '#b78e2a');
      }
      break;
    }
    case T.hayBaleSide: {
      // Golden dry hay stalks bound with two russet twine bands
      speckle(ctx, ox, oy, '#d4ad42', 2197, 14);
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = x % 3 === 0 ? '#e6c35a' : x % 3 === 1 ? '#cfa63b' : '#b88f2c';
        ctx.fillRect(ox + x, oy, 1, 16);
      }
      for (let i = 0; i < 16; i++) {
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 14), 1, 2, rand() < 0.5 ? '#f0d16c' : '#9f7920');
      }
      // Two horizontal red-brown binding straps
      for (const by of [4, 11]) {
        ctx.fillStyle = '#8b3e22';
        ctx.fillRect(ox, oy + by, 16, 2);
        ctx.fillStyle = '#a85030';
        ctx.fillRect(ox, oy + by, 16, 1);
      }
      break;
    }
    case T.doorWoodBottom: {
      // BOTTOM half of a 2-block Minecraft oak door: single handle at waist height + solid carved lower panels
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#a37e49';
      ctx.fillRect(ox, oy, 16, 16);
      // Side & bottom outer frame bevels (no top border so it joins T.doorWood seamlessly)
      ctx.fillStyle = '#73552c';
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillStyle = '#b89158';
      ctx.fillRect(ox + 1, oy, 1, 15);
      // Recessed left & right solid wood wainscoting panels (oy = 4..12)
      for (const px0 of [3, 9]) {
        ctx.fillStyle = '#7a5b30';
        ctx.fillRect(ox + px0, oy + 4, 4, 9);
        ctx.fillStyle = '#94703d';
        ctx.fillRect(ox + px0 + 1, oy + 5, 3, 8);
        ctx.fillStyle = '#b58d52';
        ctx.fillRect(ox + px0 + 1, oy + 12, 3, 1);
      }
      // THE SINGLE DOOR HANDLE + dark iron lock plate at waist height (oy = 0..3, right side)
      px(ctx, ox, oy, 11, 0, 3, 4, '#2d2a28');
      px(ctx, ox, oy, 11, 1, 3, 2, '#d8b24c');
      px(ctx, ox, oy, 12, 1, 2, 1, '#fff0a6');
      break;
    }
    case T.doorIronBottom: {
      // BOTTOM half of a 2-block Minecraft iron door: single latch handle + solid riveted steel panels
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#c8ccd2';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#7d838c';
      ctx.fillRect(ox, oy, 1, 16);
      ctx.fillRect(ox + 15, oy, 1, 16);
      ctx.fillRect(ox, oy + 15, 16, 1);
      ctx.fillStyle = '#e2e6ec';
      ctx.fillRect(ox + 1, oy, 1, 15);
      for (const px0 of [3, 9]) {
        ctx.fillStyle = '#8b919a';
        ctx.fillRect(ox + px0, oy + 4, 4, 9);
        ctx.fillStyle = '#b4b9c2';
        ctx.fillRect(ox + px0 + 1, oy + 5, 3, 8);
      }
      // Single iron handle at waist height (oy = 1..3)
      px(ctx, ox, oy, 11, 0, 3, 4, '#3b3e45');
      px(ctx, ox, oy, 11, 1, 3, 2, '#686e78');
      break;
    }
    // ---- New Mineral Ores (Unique Stylized Geode & Fissure Aesthetic) ----
    case T.redstoneOre: {
      // Natural stone split by glowing neon-crimson lightning fissures & ruby core node
      speckle(ctx, ox, oy, '#81838b', 401, 14);
      // Dark fissure channel
      for (const [fx, fy, fw, fh] of [
        [2, 2, 4, 2],
        [5, 4, 4, 3],
        [7, 6, 4, 4],
        [10, 9, 4, 3],
        [3, 10, 4, 3],
      ]) {
        px(ctx, ox, oy, fx, fy, fw, fh, '#590814');
        px(ctx, ox, oy, fx + 1, fy, Math.max(1, fw - 2), fh, '#e61938');
      }
      // Glowing white-pink energy sparks along the lightning vein
      px(ctx, ox, oy, 6, 5, 2, 1, '#ff7a8a');
      px(ctx, ox, oy, 8, 7, 2, 2, '#ff2e4c');
      px(ctx, ox, oy, 8, 7, 1, 1, '#ffe0e5');
      px(ctx, ox, oy, 4, 11, 2, 1, '#ff7a8a');
      break;
    }
    case T.lapisOre: {
      // Natural stone embedded with faceted royal-ultramarine & vivid azure lazuli crystal clusters
      speckle(ctx, ox, oy, '#81838b', 402, 14);
      const clusters: Array<[number, number, number, number]> = [
        [2, 3, 3, 2],
        [4, 2, 2, 2],
        [10, 2, 3, 3],
        [6, 6, 4, 2],
        [5, 8, 3, 2],
        [11, 8, 3, 2],
        [2, 11, 4, 2],
        [8, 12, 4, 2],
      ];
      for (const [lx, ly, lw, lh] of clusters) {
        px(ctx, ox, oy, lx, ly, lw, lh, '#10226b');
        px(ctx, ox, oy, lx, ly, Math.max(1, lw - 1), Math.max(1, lh - 1), '#2452de');
        px(ctx, ox, oy, lx + 1, ly, Math.max(1, lw - 2), 1, '#528bff');
      }
      // Bright sky-azure crystal highlights
      for (const [hx, hy] of [[3, 3], [11, 3], [7, 6], [3, 11], [9, 12]]) {
        px(ctx, ox, oy, hx, hy, 1, 1, '#99c4ff');
      }
      break;
    }
    case T.emeraldOre: {
      // Mountain rock with diagonal pointed jade-beryl crystal spires jutting upward
      speckle(ctx, ox, oy, '#81838b', 403, 14);
      const spires: Array<[number, number]> = [
        [3, 3],
        [10, 2],
        [6, 8],
        [2, 10],
        [11, 9],
      ];
      for (const [sx, sy] of spires) {
        px(ctx, ox, oy, sx, sy, 2, 4, '#095228');
        px(ctx, ox, oy, sx, sy + 1, 2, 3, '#18c962');
        px(ctx, ox, oy, sx, sy, 1, 2, '#78ffad');
        px(ctx, ox, oy, sx, sy, 1, 1, '#e0ffec');
      }
      break;
    }
    case T.quartzOre: {
      // Dark volcanic obsidian-crimson matrix with radiating star-fans of rose-white quartz needles
      speckle(ctx, ox, oy, '#471b26', 404, 18);
      for (let i = 0; i < 16; i++) {
        px(ctx, ox, oy, Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1, rand() < 0.5 ? '#331019' : '#6b2837');
      }
      // Radiating quartz crystal needles
      for (const [qx, qy] of [[3, 3], [10, 4], [5, 10], [11, 11]]) {
        px(ctx, ox, oy, qx, qy, 3, 3, '#b89ea6');
        px(ctx, ox, oy, qx + 1, qy - 1, 1, 4, '#f5ebed');
        px(ctx, ox, oy, qx - 1, qy + 1, 4, 1, '#f5ebed');
        px(ctx, ox, oy, qx + 1, qy, 1, 2, '#ffffff');
      }
      break;
    }
    // ---- Crafted Mineral Blocks (Unique Ornate Architectural & Runic Style) ----
    case T.coalBlock: {
      // Interlocking forged carbon-brick weave with glowing orange-amber ember seams
      ctx.fillStyle = '#14151c';
      ctx.fillRect(ox, oy, 16, 16);
      // Glowing ember mortar lines
      ctx.fillStyle = '#d95b16';
      for (const y of [3, 7, 11, 15]) ctx.fillRect(ox, oy + y, 16, 1);
      // Staggered dark anthracite bricks with metallic sheen
      const rows: Array<[number, number]> = [
        [0, 0],
        [4, 4],
        [8, 0],
        [12, 4],
      ];
      for (const [ry, xShift] of rows) {
        for (let bx = 0; bx < 16; bx += 8) {
          const x0 = (bx + xShift) % 16;
          px(ctx, ox, oy, x0, ry, 7, 3, '#222530');
          px(ctx, ox, oy, x0 + 1, ry, 5, 1, '#363b4d');
        }
      }
      // Hot ember spark intersections
      for (const [ex, ey] of [[3, 3], [11, 7], [7, 11]]) {
        px(ctx, ox, oy, ex, ey, 2, 1, '#ffb03b');
      }
      break;
    }
    case T.ironBlock: {
      // Dwarven bolted steel vault plate with raised X-brace & brass corner rivets
      ctx.fillStyle = '#5c6473';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#cfd7e3';
      ctx.fillRect(ox + 1, oy + 1, 14, 14);
      ctx.fillStyle = '#aeb8c7';
      ctx.fillRect(ox + 3, oy + 3, 10, 10);
      // Diagonal raised steel X-ribs
      for (let i = 3; i <= 12; i++) {
        px(ctx, ox, oy, i, i, 2, 1, '#eef3fa');
        px(ctx, ox, oy, i, 15 - i, 2, 1, '#eef3fa');
      }
      // Central steel boss
      px(ctx, ox, oy, 6, 6, 4, 4, '#7a8496');
      px(ctx, ox, oy, 7, 7, 2, 2, '#ffffff');
      // 4 Golden-brass corner rivets
      for (const [rx, ry] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
        px(ctx, ox, oy, rx, ry, 2, 2, '#d89b38');
      }
      break;
    }
    case T.redstoneBlock: {
      // Arcane Runic Power Core Block: dark obsidian cage + glowing neon-crimson rune cross
      ctx.fillStyle = '#261019';
      ctx.fillRect(ox, oy, 16, 16);
      // Inner crimson energy chamber
      ctx.fillStyle = '#850c22';
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      // Glowing scarlet rune cross & circuit bars
      ctx.fillStyle = '#f01e3c';
      ctx.fillRect(ox + 6, oy + 1, 4, 14);
      ctx.fillRect(ox + 1, oy + 6, 14, 4);
      ctx.fillStyle = '#ff5972';
      ctx.fillRect(ox + 7, oy + 2, 2, 12);
      ctx.fillRect(ox + 2, oy + 7, 12, 2);
      // Dark obsidian corner brackets
      for (const [cx, cy] of [[1, 1], [11, 1], [1, 11], [11, 11]]) {
        px(ctx, ox, oy, cx, cy, 4, 4, '#361824');
        px(ctx, ox, oy, cx + 1, cy + 1, 2, 2, '#ff3856');
      }
      // White-hot pulsing core
      px(ctx, ox, oy, 7, 7, 2, 2, '#ffe8ec');
      break;
    }
    case T.lapisBlock: {
      // Celestial Night-Sky Mosaic Tile with golden border & 4-pointed golden star inlay
      ctx.fillStyle = '#0d1b54';
      ctx.fillRect(ox, oy, 16, 16);
      // Ornate gold mosaic border
      ctx.fillStyle = '#d4a338';
      ctx.fillRect(ox + 1, oy + 1, 14, 1);
      ctx.fillRect(ox + 1, oy + 14, 14, 1);
      ctx.fillRect(ox + 1, oy + 1, 1, 14);
      ctx.fillRect(ox + 14, oy + 1, 1, 14);
      // Deep sapphire inner field
      speckle(ctx, ox + 2, oy + 2, '#1f45b8', 408, 18);
      ctx.fillStyle = '#2e62eb';
      ctx.fillRect(ox + 4, oy + 4, 8, 8);
      // Central 4-pointed golden star inlay
      px(ctx, ox, oy, 7, 3, 2, 10, '#ffd84d');
      px(ctx, ox, oy, 3, 7, 10, 2, '#ffd84d');
      px(ctx, ox, oy, 6, 6, 4, 4, '#ffe878');
      px(ctx, ox, oy, 7, 7, 2, 2, '#ffffff');
      break;
    }
    case T.emeraldBlock: {
      // Carved Jade-Temple Coffered Block with stepped geometric relief & mint crystal heart
      ctx.fillStyle = '#074722';
      ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#128744';
      ctx.fillRect(ox + 1, oy + 1, 14, 14);
      // Corner jade studs
      for (const [cx, cy] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
        px(ctx, ox, oy, cx, cy, 2, 2, '#5ef298');
      }
      // Stepped diamond temple relief in center
      px(ctx, ox, oy, 4, 4, 8, 8, '#0b5e2d');
      px(ctx, ox, oy, 6, 3, 4, 10, '#22d46b');
      px(ctx, ox, oy, 3, 6, 10, 4, '#22d46b');
      px(ctx, ox, oy, 5, 5, 6, 6, '#4df58d');
      px(ctx, ox, oy, 6, 6, 4, 4, '#a6ffca');
      px(ctx, ox, oy, 7, 7, 2, 2, '#0b5e2d');
      break;
    }
    case T.quartzBlock: {
      // Classical Fluted Rose-Ivory Marble Pillar Block with rose-gold frieze bands
      ctx.fillStyle = '#f2ebed';
      ctx.fillRect(ox, oy, 16, 16);
      // Top & bottom rose-gold capital & base trim
      ctx.fillStyle = '#b88c94';
      ctx.fillRect(ox, oy, 16, 2);
      ctx.fillRect(ox, oy + 14, 16, 2);
      ctx.fillStyle = '#d9b8bf';
      ctx.fillRect(ox, oy + 2, 16, 1);
      ctx.fillRect(ox, oy + 13, 16, 1);
      // Vertical fluted marble grooves
      for (const fx of [2, 6, 10, 14]) {
        px(ctx, ox, oy, fx, 3, 1, 10, '#d4c3c8');
        px(ctx, ox, oy, fx + 1, 3, 1, 10, '#ffffff');
      }
      break;
    }
    case T.farmland: {
      // Tilled soil: dark dirt with a simple pixel furrow pattern.
      speckle(ctx, ox, oy, '#725039', 423, 13);
      ctx.fillStyle = '#4e3528';
      for (let y = 2; y < 16; y += 4) ctx.fillRect(ox + 1, oy + y, 14, 1);
      ctx.fillStyle = '#9a6b47';
      for (let x = 3; x < 16; x += 5) ctx.fillRect(ox + x, oy + 1, 1, 2);
      break;
    }
    // ---- Expanded Flora (Tulips, Roses, Sunflowers, Lavender, Wisteria, Daisy, etc.) ----
    case T.flowerTulipRed:
    case T.flowerTulipYellow:
    case T.flowerTulipPink:
    case T.flowerTulipOrange:
    case T.flowerTulipWhite: {
      ctx.clearRect(ox, oy, 16, 16);
      const tulipMap: Record<number, {cup: string, light: string, dark: string}> = {
        [T.flowerTulipRed]: {cup: '#d42a2a', light: '#ff5a4a', dark: '#8a1a1a'},
        [T.flowerTulipYellow]: {cup: '#e8c628', light: '#ffea4a', dark: '#a08018'},
        [T.flowerTulipPink]: {cup: '#e46a9a', light: '#ff9abe', dark: '#a04068'},
        [T.flowerTulipOrange]: {cup: '#e86a18', light: '#ff9a3a', dark: '#a0400a'},
        [T.flowerTulipWhite]: {cup: '#f0f0e8', light: '#ffffff', dark: '#c8c8b8'},
      };
      const col = tulipMap[index] || tulipMap[T.flowerTulipRed];
      // stem
      ctx.fillStyle = '#4a8a32'; ctx.fillRect(ox + 7, oy + 8, 2, 8);
      // tulip cup - closed elegant shape
      ctx.fillStyle = col.dark; ctx.fillRect(ox + 5, oy + 5, 6, 5);
      ctx.fillStyle = col.cup; ctx.fillRect(ox + 5, oy + 4, 6, 5);
      ctx.fillRect(ox + 4, oy + 5, 8, 3);
      ctx.fillStyle = col.light; ctx.fillRect(ox + 6, oy + 4, 2, 2);
      break;
    }
    case T.flowerSunflower: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#4a8a32'; ctx.fillRect(ox + 7, oy + 8, 2, 8);
      // sunflower head - large yellow with dark center
      ctx.fillStyle = '#e8c828'; ctx.fillRect(ox + 2, oy + 2, 12, 8);
      ctx.fillRect(ox + 3, oy + 1, 10, 10);
      ctx.fillStyle = '#ffea4a'; ctx.fillRect(ox + 4, oy + 3, 8, 5);
      ctx.fillStyle = '#5a3a10'; ctx.fillRect(ox + 6, oy + 5, 4, 4);
      ctx.fillStyle = '#7a5a1a'; ctx.fillRect(ox + 7, oy + 6, 2, 2);
      break;
    }
    case T.flowerRose: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#3a7a2a'; ctx.fillRect(ox + 7, oy + 8, 2, 8);
      // rose bloom - layered red petals
      ctx.fillStyle = '#8a1010'; ctx.fillRect(ox + 5, oy + 4, 6, 5);
      ctx.fillStyle = '#c41e1e'; ctx.fillRect(ox + 4, oy + 3, 8, 6);
      ctx.fillStyle = '#e83030'; ctx.fillRect(ox + 5, oy + 3, 6, 4);
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(ox + 6, oy + 3, 2, 2);
      // thorns hint
      px(ctx, ox, oy, 6, 12, 1, 1, '#5a3a1a');
      break;
    }
    case T.flowerLavender: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#4a8a32'; ctx.fillRect(ox + 7, oy + 9, 2, 7);
      // lavender spike - purple clustered buds
      ctx.fillStyle = '#5a3a8a'; ctx.fillRect(ox + 6, oy + 3, 4, 8);
      ctx.fillStyle = '#7a5aba'; ctx.fillRect(ox + 5, oy + 2, 6, 7);
      for (let y = 2; y < 9; y += 2) {
        px(ctx, ox, oy, 6 + (y % 2), y, 2, 1, '#a48ad8');
        px(ctx, ox, oy, 8, y + 1, 1, 1, '#c4a8f0');
      }
      break;
    }
    case T.flowerWisteria: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#6a8a4a'; ctx.fillRect(ox + 7, oy + 2, 2, 6);
      // hanging wisteria cluster - cascading light purple
      ctx.fillStyle = '#8a6aba'; ctx.fillRect(ox + 4, oy + 6, 8, 7);
      ctx.fillStyle = '#a88ad8'; ctx.fillRect(ox + 5, oy + 7, 6, 6);
      ctx.fillStyle = '#c8a8f0'; ctx.fillRect(ox + 6, oy + 8, 4, 4);
      for (let y = 7; y < 13; y++) px(ctx, ox, oy, 6 + (y % 3), y, 1, 1, '#e0c8ff');
      ctx.fillStyle = '#5a4a6a'; ctx.fillRect(ox + 7, oy + 13, 2, 2);
      break;
    }
    case T.flowerDaisy: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#5a9a3a'; ctx.fillRect(ox + 7, oy + 9, 2, 7);
      // white petals + yellow center
      ctx.fillStyle = '#f0f0e8'; ctx.fillRect(ox + 3, oy + 4, 10, 6);
      ctx.fillRect(ox + 5, oy + 3, 6, 8);
      ctx.fillStyle = '#e8e8d8'; ctx.fillRect(ox + 4, oy + 5, 2, 4);
      ctx.fillRect(ox + 10, oy + 5, 2, 4);
      ctx.fillStyle = '#f0d840'; ctx.fillRect(ox + 6, oy + 5, 4, 4);
      ctx.fillStyle = '#ffe860'; px(ctx, ox, oy, 7, 6, 1, 1, '#ffe860');
      break;
    }
    case T.flowerOrchid: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#4a7a3a'; ctx.fillRect(ox + 7, oy + 9, 2, 7);
      // exotic orchid - blue-purple with patterned lip
      ctx.fillStyle = '#4a3a8a'; ctx.fillRect(ox + 3, oy + 5, 10, 5);
      ctx.fillStyle = '#6a5aba'; ctx.fillRect(ox + 4, oy + 3, 8, 6);
      ctx.fillStyle = '#8a7ad8'; ctx.fillRect(ox + 5, oy + 4, 6, 3);
      ctx.fillStyle = '#d8c8ff'; ctx.fillRect(ox + 5, oy + 6, 6, 3);
      ctx.fillStyle = '#ff9ad0'; ctx.fillRect(ox + 7, oy + 7, 2, 1);
      break;
    }
    case T.flowerPeony: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#4a8a32'; ctx.fillRect(ox + 7, oy + 10, 2, 6);
      // large fluffy peony
      ctx.fillStyle = '#b04070'; ctx.fillRect(ox + 3, oy + 3, 10, 8);
      ctx.fillStyle = '#d45a8a'; ctx.fillRect(ox + 4, oy + 2, 8, 8);
      ctx.fillStyle = '#e87aa8'; ctx.fillRect(ox + 5, oy + 3, 6, 6);
      ctx.fillStyle = '#ffb0d0'; ctx.fillRect(ox + 6, oy + 4, 3, 3);
      for (const [x,y] of [[4,4],[9,4],[5,8],[9,8]]) px(ctx, ox, oy, x, y, 2, 1, '#ffa8c8');
      break;
    }
    case T.bush: {
      ctx.clearRect(ox, oy, 16, 16);
      // dense green shrub
      ctx.fillStyle = '#2a5a1a'; ctx.fillRect(ox + 3, oy + 6, 10, 8);
      ctx.fillStyle = '#3a7a2a'; ctx.fillRect(ox + 2, oy + 5, 12, 7);
      ctx.fillStyle = '#4a9a3a'; ctx.fillRect(ox + 4, oy + 4, 8, 6);
      ctx.fillStyle = '#5aba4a'; ctx.fillRect(ox + 5, oy + 5, 3, 2);
      ctx.fillStyle = '#3a4a1a'; ctx.fillRect(ox + 7, oy + 12, 2, 4);
      break;
    }
    case T.bushFlowering: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#2a5a1a'; ctx.fillRect(ox + 2, oy + 6, 12, 8);
      ctx.fillStyle = '#3a7a2a'; ctx.fillRect(ox + 1, oy + 5, 14, 7);
      // white/pink blossoms on bush
      for (const [x,y,c] of [[3,6,'#f0e0e8'],[7,5,'#ffb0d0'],[11,7,'#f0f0f8'],[5,8,'#ff9abe'],[9,9,'#ffe0f0']] as const) {
        px(ctx, ox, oy, x as number, y as number, 2, 2, c as string);
      }
      ctx.fillStyle = '#3a4a1a'; ctx.fillRect(ox + 7, oy + 12, 2, 4);
      break;
    }
    case T.berryBush: {
      ctx.clearRect(ox, oy, 16, 16);
      ctx.fillStyle = '#2a5a1a'; ctx.fillRect(ox + 2, oy + 6, 12, 8);
      ctx.fillStyle = '#3a7a2a'; ctx.fillRect(ox + 3, oy + 5, 10, 7);
      // red berries
      for (const [x,y] of [[4,7],[8,6],[11,8],[5,10],[9,11]]) {
        px(ctx, ox, oy, x, y, 2, 2, '#c41e1e');
        px(ctx, ox, oy, x, y, 1, 1, '#ff4a3a');
      }
      ctx.fillStyle = '#3a4a1a'; ctx.fillRect(ox + 7, oy + 12, 2, 4);
      break;
    }
    case T.tallLavender:
    case T.tallSunflower: {
      ctx.clearRect(ox, oy, 16, 16);
      const isSun = index === T.tallSunflower;
      ctx.fillStyle = '#4a8a32'; ctx.fillRect(ox + 7, oy + 2, 2, 14);
      if (isSun) {
        // tall sunflower - two blooms? top one
        ctx.fillStyle = '#e8c828'; ctx.fillRect(ox + 2, oy + 1, 12, 6);
        ctx.fillStyle = '#ffea4a'; ctx.fillRect(ox + 4, oy + 2, 8, 4);
        ctx.fillStyle = '#5a3a10'; ctx.fillRect(ox + 6, oy + 3, 4, 3);
        ctx.fillStyle = '#3a9a2a'; ctx.fillRect(ox + 3, oy + 9, 10, 4);
      } else {
        // tall lavender
        for (let y = 1; y < 10; y++) {
          ctx.fillStyle = y % 2 === 0 ? '#7a5aba' : '#5a3a8a';
          ctx.fillRect(ox + 5, oy + y, 6, 1);
          px(ctx, ox, oy, 6, y, 1, 1, '#a48ad8');
        }
        ctx.fillStyle = '#4a9a3a'; ctx.fillRect(ox + 4, oy + 10, 8, 3);
      }
      break;
    }
    case T.wisteriaVine: {
      ctx.clearRect(ox, oy, 16, 16);
      // hanging vine with purple clusters like T.vine but with flowers
      ctx.fillStyle = '#4a6a3a'; ctx.fillRect(ox + 6, oy, 2, 16);
      ctx.fillStyle = '#6a8a5a';
      for (let y = 1; y < 16; y += 3) ctx.fillRect(ox + 3, oy + y, 4, 2);
      ctx.fillStyle = '#9a7ac8';
      for (const [x,y] of [[9,3],[4,7],[10,9],[3,12]]) {
        px(ctx, ox, oy, x, y, 3, 3, '#9a7ac8');
        px(ctx, ox, oy, x+1, y+1, 1, 1, '#d0b0f0');
      }
      break;
    }
    case T.mossCarpet: {
      // lush green moss carpet ground cover
      speckle(ctx, ox, oy, '#4a9a3a', 3001, 18);
      for (let i = 0; i < 20; i++) {
        const x = Math.floor((mulberry32(3001 + i)()) * 16);
        const y = Math.floor((mulberry32(3101 + i)()) * 16);
        px(ctx, ox, oy, x, y, 1 + (i % 2), 1, i % 3 === 0 ? '#5aba4a' : i % 3 === 1 ? '#3a7a2a' : '#6ac85a');
      }
      break;
    }
    case T.leafPile: {
      // autumn leaf litter - orange/brown/yellow mix
      speckle(ctx, ox, oy, '#c87a28', 3201, 16);
      const cols = ['#e8a040','#d06020','#f0c040','#8a4a1a','#c87828'];
      for (let i = 0; i < 24; i++) {
        const x = Math.floor((mulberry32(3201 + i)()) * 16);
        const y = Math.floor((mulberry32(3301 + i)()) * 16);
        px(ctx, ox, oy, x, y, 1, 1, cols[i % cols.length]);
      }
      break;
    }
    case T.mossyCobble: {
      speckle(ctx, ox, oy, '#5a5e5a', 3401, 10);
      for (const [bx,by,bw,bh] of [[0,0,7,7],[9,0,7,7],[0,9,8,7],[9,9,7,7]] as const) {
        ctx.fillStyle = '#666a66'; ctx.fillRect(ox+bx,oy+by,bw,bh);
        ctx.fillStyle = '#7a807a'; ctx.fillRect(ox+bx+1,oy+by+1,bw-2,bh-2);
      }
      ctx.fillStyle = '#3a4a3a'; ctx.fillRect(ox,oy+7,16,2);
      ctx.fillRect(ox+7,oy,2,16);
      // moss patches
      for (const [x,y] of [[2,2],[11,3],[3,11],[10,10]]) px(ctx, ox, oy, x, y, 3, 2, '#4a8a3a');
      break;
    }
    case T.mossyStoneBrick: {
      // stone bricks with moss overgrowth - castle ruins aesthetic
      ctx.fillStyle = '#5a5e60'; ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#6a6e70'; ctx.fillRect(ox+1, oy+1, 14, 6);
      ctx.fillRect(ox+1, oy+9, 14, 6);
      ctx.fillStyle = '#4a4e50'; ctx.fillRect(ox, oy+7,16,2); ctx.fillRect(ox, oy+15,16,1);
      ctx.fillStyle = '#8a8e90'; ctx.fillRect(ox+2, oy+2, 5, 1); ctx.fillRect(ox+2, oy+10, 4, 1);
      // moss
      px(ctx, ox, oy, 1, 1, 4, 2, '#4a7a3a'); px(ctx, ox, oy, 9, 3, 3, 2, '#5a9a4a');
      px(ctx, ox, oy, 2, 11, 5, 2, '#3a6a2a'); px(ctx, ox, oy, 11, 10, 3, 3, '#4a8a3a');
      break;
    }
    case T.crackedStoneBrick: {
      ctx.fillStyle = '#5a5e60'; ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#6a6e70'; ctx.fillRect(ox+1, oy+1, 14, 6); ctx.fillRect(ox+1, oy+9, 14, 6);
      ctx.fillStyle = '#4a4e50'; ctx.fillRect(ox, oy+7,16,2);
      // cracks
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox+3, oy+2); ctx.lineTo(ox+6, oy+7); ctx.lineTo(ox+4, oy+12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox+11, oy+1); ctx.lineTo(ox+9, oy+8); ctx.lineTo(ox+12, oy+14); ctx.stroke();
      break;
    }
    case T.stoneBrick: {
      // clean stone bricks - castle walls
      ctx.fillStyle = '#5a5e60'; ctx.fillRect(ox, oy, 16, 16);
      ctx.fillStyle = '#7a7e80'; ctx.fillRect(ox+1, oy+1, 14, 6);
      ctx.fillRect(ox+1, oy+9, 14, 6);
      ctx.fillStyle = '#4a4e50'; ctx.fillRect(ox, oy+7,16,2); ctx.fillRect(ox, oy+15,16,1); ctx.fillRect(ox+7, oy,1,16);
      ctx.fillStyle = '#8a8e90'; ctx.fillRect(ox+2, oy+2, 5, 1); ctx.fillRect(ox+2, oy+10, 4, 1);
      ctx.fillStyle = '#9aa0a4'; ctx.fillRect(ox+9, oy+2, 3, 1);
      break;
    }
    case T.pumpkin: {
      // jack-o style pumpkin
      speckle(ctx, ox, oy, '#d87a18', 3601, 10);
      ctx.fillStyle = '#a85a10'; for (let x=0;x<16;x+=4) ctx.fillRect(ox+x,oy,1,16);
      ctx.fillStyle = '#f0a030'; ctx.fillRect(ox+2, oy+2, 12, 12);
      ctx.fillStyle = '#5a3a0a'; ctx.fillRect(ox+6, oy+1, 4, 3);
      ctx.fillStyle = '#3a5a1a'; ctx.fillRect(ox+7, oy, 2, 2);
      break;
    }
    // ---- Mineral Item Tiles (Row 2 fallback in atlas) ----
    case T.coalItem:
      speckle(ctx, ox, oy, '#222328', 411, 14);
      break;
    case T.ironIngot:
      speckle(ctx, ox, oy, '#d6d9de', 412, 12);
      break;
    case T.redstone:
      speckle(ctx, ox, oy, '#d41919', 413, 16);
      break;
    case T.goldIngot:
      speckle(ctx, ox, oy, '#f5c428', 414, 14);
      break;
    case T.lapis:
      speckle(ctx, ox, oy, '#264ecc', 415, 16);
      break;
    case T.diamondGem:
      speckle(ctx, ox, oy, '#45e6e8', 416, 14);
      break;
    case T.emerald:
      speckle(ctx, ox, oy, '#1ed458', 417, 14);
      break;
    case T.quartz:
      speckle(ctx, ox, oy, '#f0eae2', 418, 10);
      break;
  }
}

let atlasTex: THREE.Texture | null = null;
let atlasCanvas: HTMLCanvasElement | null = null;

export function getAtlasCanvas(): HTMLCanvasElement {
  if (atlasCanvas) return atlasCanvas;
  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i++) drawTile(ctx, i);
  expandGutters(ctx);
  atlasCanvas = c;
  return c;
}

export function getAtlasTexture(): THREE.Texture {
  if (atlasTex) return atlasTex;
  const tex = new THREE.CanvasTexture(getAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  atlasTex = tex;
  return tex;
}

const UV_PAD_U = 0.5 / ATLAS_W;
const UV_PAD_V = 0.5 / ATLAS_H;

/** UV rect (in atlas space) of a tile index */
export function tileUV(index: number) {
  const [ox, oy] = tileOrigin(index);
  const u0 = ox / ATLAS_W + UV_PAD_U;
  const u1 = (ox + TILE) / ATLAS_W - UV_PAD_U;
  // canvas y grows downward, three's v grows upward
  const v1 = 1 - oy / ATLAS_H - UV_PAD_V;
  const v0 = 1 - (oy + TILE) / ATLAS_H + UV_PAD_V;
  return [u0, v0, u1, v1];
}

/** 10-stage crack overlay strip (160 x 16) */
let crackTex: THREE.Texture | null = null;
export function getCrackTexture(): THREE.Texture {
  if (crackTex) return crackTex;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let stage = 0; stage < 10; stage++) {
    const ox = stage * 16;
    const rand = mulberry32(stage * 977 + 5);
    const lines = stage + 2;
    ctx.strokeStyle = 'rgba(12,10,14,0.78)';
    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      let x = rand() * 16;
      let y = rand() * 16;
      ctx.beginPath();
      ctx.moveTo(ox + x + 0.5, y + 0.5);
      const segs = 2 + Math.floor(rand() * 3);
      for (let s = 0; s < segs; s++) {
        x += (rand() - 0.5) * 9;
        y += (rand() - 0.5) * 9;
        ctx.lineTo(ox + Math.max(0, Math.min(16, x)) + 0.5, Math.max(0, Math.min(16, y)) + 0.5);
      }
      ctx.stroke();
    }
    for (let i = 0; i < stage * 3; i++) {
      ctx.fillStyle = 'rgba(8,6,10,0.55)';
      ctx.fillRect(ox + Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  crackTex = tex;
  return tex;
}

export function crackTileUV(stage: number) {
  const w = 1 / 10;
  return [stage * w + 0.001, 0.001, (stage + 1) * w - 0.001, 0.999];
}

/** Sky gradient dome texture */
export function getSkyTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#1f4f8f');
  g.addColorStop(0.28, '#3f7ec4');
  g.addColorStop(0.55, '#7fb2e0');
  g.addColorStop(0.78, '#bcd9ec');
  g.addColorStop(1.0, '#e8d7b8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/** Chunky Minecraft-style cloud sheet */
export function getCloudTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const rand = mulberry32(4242);
  ctx.clearRect(0, 0, 128, 128);
  // Sparse blocky cloud islands. Keep most texels transparent so the sky and sun
  // stay visible, especially when the player looks straight up.
  for (let island = 0; island < 12; island++) {
    const baseX = Math.floor(rand() * 16) * 8;
    const baseY = Math.floor(rand() * 16) * 8;
    const puffs = 2 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const cx = (baseX + (Math.floor(rand() * 7) - 3) * 8 + 128) % 128;
      const cy = (baseY + (Math.floor(rand() * 5) - 2) * 8 + 128) % 128;
      const w = (2 + Math.floor(rand() * 4)) * 8;
      const h = (1 + Math.floor(rand() * 3)) * 8;
      const a = 0.34 + rand() * 0.24;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(cx, cy, w, h);
      ctx.fillStyle = `rgba(210,228,246,${a * 0.55})`;
      ctx.fillRect(cx, cy + h - 3, w, 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const iconCache = new Map<number, string>();

/** 48x48 pixel-art inventory icon for a block id (returns a data URL) */
export function getBlockIcon(id: number): string {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const size = 48;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (isArrowId(id)) {
    drawArrowIcon(ctx, id, size);
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  if (isTreasureChest(id)) {
    const fill = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    const open = id === CHEST_STORAGE_OPEN || (id >= 118 && id <= 125);
    // Chunky pixel-art chest: a bevelled lid, dark iron straps and a bright latch.
    fill(6, 15, 36, 27, '#251b16');
    fill(8, 18, 32, 22, '#81502d');
    fill(8, 18, 32, 4, '#a76d37');
    fill(8, 36, 32, 4, '#59371f');
    fill(13, 19, 4, 20, '#d0a24b');
    fill(31, 19, 4, 20, '#d0a24b');
    if (open) {
      fill(8, 20, 32, 13, '#160f0d');
      fill(11, 17, 26, 5, '#c28b48');
      fill(12, 10, 24, 8, '#9a6032');
      fill(13, 11, 22, 4, '#bb7b3f');
      fill(8, 32, 32, 4, '#d1a64f');
    } else {
      fill(7, 12, 34, 9, '#936033');
      fill(9, 10, 30, 5, '#b27a41');
      fill(10, 14, 28, 4, '#d0a24b');
      fill(22, 20, 5, 12, '#3e3024');
      fill(23, 22, 3, 5, '#f0cb67');
    }
    fill(7, 41, 8, 4, '#30231b');
    fill(33, 41, 8, 4, '#30231b');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  if (id === TORCH) {
    // Custom 3D isometric voxel lantern icon matching logo.png
    const fill = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    // Top U-shaped dark iron handle
    fill(19, 2, 10, 3, '#252322');
    fill(19, 5, 3, 5, '#252322');
    fill(26, 5, 3, 5, '#252322');
    // Stepped upper chimney cap + glowing yellow vent slits
    fill(14, 9, 20, 4, '#524e4c');
    fill(14, 13, 4, 3, '#3b3836');
    fill(22, 13, 4, 3, '#3b3836');
    fill(30, 13, 4, 3, '#3b3836');
    fill(18, 13, 4, 3, '#ffee58');
    fill(26, 13, 4, 3, '#ffe042');
    // Wide overhanging dark iron roof eaves
    fill(9, 16, 30, 3, '#474442');
    fill(8, 19, 32, 4, '#2d2b2a');
    // Left pane (warm orange -> golden yellow -> diagonal white-cream center)
    fill(11, 23, 12, 16, '#f27d16');
    fill(13, 25, 9, 12, '#ffd836');
    fill(14, 27, 7, 8, '#ffee58');
    fill(14, 27, 4, 4, '#ffffe4');
    fill(17, 31, 4, 4, '#ffffe4');
    // Right pane (slightly shaded perspective side)
    fill(25, 23, 12, 16, '#e06c12');
    fill(26, 25, 9, 12, '#f5c728');
    fill(27, 27, 7, 8, '#ffe64c');
    fill(27, 27, 4, 4, '#fffbd6');
    fill(30, 31, 4, 4, '#fffbd6');
    // 3 visible vertical dark iron corner pillars (left, center, right)
    fill(9, 23, 3, 16, '#2b2928');
    fill(22, 23, 4, 16, '#232120');
    fill(36, 23, 3, 16, '#2b2928');
    // Bottom dark iron base rim + corner feet with center notches
    fill(8, 39, 32, 4, '#33302e');
    fill(9, 43, 6, 3, '#22201f');
    fill(20, 43, 8, 3, '#22201f');
    fill(33, 43, 6, 3, '#22201f');

    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  if (id === DOOR_WOOD || id === DOOR_IRON) {
    // Draw a unified 2-block-tall door icon (top half with window + bottom half with single handle)
    const atlas = getAtlasCanvas();
    const topTile = id === DOOR_WOOD ? T.doorWood : T.doorIron;
    const botTile = id === DOOR_WOOD ? T.doorWoodBottom : T.doorIronBottom;
    const [tx, ty] = tileOrigin(topTile);
    const [bx, by] = tileOrigin(botTile);
    ctx.drawImage(atlas, tx, ty, TILE, TILE, 12, 2, 24, 22);
    ctx.drawImage(atlas, bx, by, TILE, TILE, 12, 24, 24, 22);
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  if (isLadder(id)) {
    // Front-facing pixel-art rails and rungs, tinted by wood, dye, stone, or iron tier.
    const palette = LADDER_PALETTE[id];
    const color = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
    const dark = color(palette.dark);
    const light = color(palette.light);
    const fill = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    fill(8, 5, 9, 38, dark);
    fill(31, 5, 9, 38, dark);
    fill(10, 6, 4, 36, light);
    fill(33, 6, 4, 36, light);
    for (const y of [9, 18, 27, 36]) {
      fill(12, y, 24, 6, dark);
      fill(13, y, 22, 3, light);
      fill(12, y + 4, 24, 2, dark);
    }
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  if (id === BED) {
    // Draw a 2-block-long Minecraft bed icon (wooden frame + 4 legs + red blanket + white pillow)
    const fill = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    // Wooden legs (4 corners)
    fill(4, 34, 5, 7, '#6e5029');
    fill(39, 34, 5, 7, '#6e5029');
    fill(14, 37, 4, 5, '#594020');
    // Oak bed frame base
    fill(4, 28, 40, 6, '#9c7540');
    fill(4, 32, 40, 2, '#78582d');
    // Red mattress & blanket (left & center 2/3 of the 2-block bed)
    fill(4, 18, 28, 10, '#c83630');
    fill(6, 16, 26, 4, '#de4640');
    fill(4, 25, 28, 3, '#a22622');
    // White sheet fold & plump white pillow at the head (right 1/3 of the bed)
    fill(30, 18, 14, 10, '#e2e4ec');
    fill(32, 14, 11, 7, '#f7f8fc');
    fill(32, 19, 11, 2, '#cfd3de');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  // ---- Custom non-block icons: campfire, apple, coconut, banana (should not look like blocks) ----
  const p = (gx: number, gy: number, gw: number, gh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(gx * 3, gy * 3, gw * 3, gh * 3);
  };
  const fill48 = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  if (id === CAMPFIRE) {
    // Campfire icon: not a cube, but logs + flames from side view
    ctx.clearRect(0, 0, size, size);
    // shadow base
    fill48(8, 38, 32, 4, '#1a120a');
    // crossed logs at bottom
    // log 1 - horizontal
    fill48(6, 32, 36, 7, '#3d2814');
    fill48(6, 32, 36, 3, '#7a4a28');
    fill48(8, 35, 32, 2, '#a46d3a');
    fill48(6, 32, 5, 7, '#4a2e16');
    fill48(37, 32, 5, 7, '#4a2e16');
    // log 2 - slightly upper, also horizontal but darker
    fill48(8, 28, 32, 6, '#2f1d0f');
    fill48(8, 28, 32, 2, '#6b4420');
    // embers
    fill48(14, 26, 20, 4, '#4a1a0a');
    fill48(16, 27, 3, 2, '#ff4a14');
    fill48(24, 27, 3, 2, '#ff6a14');
    // flames - 3 tongues
    fill48(12, 14, 10, 14, '#e05a14');
    fill48(14, 10, 6, 12, '#ff7a1a');
    fill48(16, 6, 4, 10, '#ffae22');
    fill48(26, 12, 10, 16, '#c94a12');
    fill48(28, 8, 6, 14, '#ff7a1a');
    fill48(30, 4, 4, 10, '#ffae22');
    fill48(18, 16, 12, 12, '#ff8a22');
    fill48(20, 10, 8, 12, '#ffae22');
    fill48(22, 4, 4, 10, '#ffee58');
    fill48(22, 6, 2, 6, '#ffffff');
    fill48(30, 8, 2, 4, '#ffffcc');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === APPLE) {
    // Apple icon: round fruit, not a block
    ctx.clearRect(0, 0, size, size);
    // shadow
    fill48(16, 38, 16, 3, '#1a0a0a');
    // apple body - round
    p(4, 5, 8, 8, '#b81e12');
    p(5, 4, 6, 10, '#d92a1c');
    p(3, 6, 10, 6, '#e23628');
    p(4, 6, 8, 6, '#e23628');
    // highlight
    p(5, 5, 2, 3, '#ff7a6a');
    p(5, 5, 1, 2, '#ffcec6');
    // bottom shade
    p(5, 12, 6, 1, '#8a1410');
    // stem
    p(7, 2, 2, 3, '#4a2e12');
    p(7, 2, 1, 2, '#6b4a20');
    // leaf
    p(9, 2, 3, 2, '#4a8a2a');
    p(9, 2, 2, 1, '#6cb33a');
    p(10, 3, 2, 1, '#3d6a1e');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === COCONUT) {
    ctx.clearRect(0, 0, size, size);
    // coconut - round brown with 3 eyes
    p(4, 4, 8, 9, '#4a2a12');
    p(5, 3, 6, 11, '#6b4420');
    p(3, 6, 10, 6, '#7a4e24');
    p(4, 5, 8, 8, '#8a5a2e');
    p(5, 5, 2, 2, '#c9a87a');
    p(9, 5, 1, 1, '#3a2210');
    p(5, 8, 1, 1, '#3a2210');
    p(8, 8, 1, 1, '#3a2210');
    p(5, 6, 1, 1, '#a67c4a');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === BANANA) {
    ctx.clearRect(0, 0, size, size);
    // banana - curved yellow bunch
    // bunch stem
    p(10, 3, 2, 2, '#5a3d12');
    // three bananas curved
    // banana 1 (front)
    fill48(10, 12, 24, 4, '#c9a81e');
    fill48(12, 8, 20, 8, '#f2d23a');
    fill48(14, 8, 16, 3, '#f9e85a');
    fill48(30, 14, 4, 4, '#a68a18');
    // banana 2 (middle)
    fill48(14, 16, 22, 4, '#b89a1a');
    fill48(16, 12, 18, 8, '#e8c62a');
    fill48(18, 12, 14, 3, '#f9e85a');
    // banana 3 (back)
    fill48(18, 20, 20, 4, '#a68a18');
    fill48(20, 16, 16, 8, '#d9b820');
    fill48(22, 16, 12, 3, '#f2d23a');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === COAL) {
    // 1. Ember-Core Anthracite Shard Cluster (3 jagged dark carbon spires + glowing orange ember fissure)
    p(6, 2, 4, 12, '#0e0f14');
    p(2, 5, 5, 8, '#0e0f14');
    p(9, 4, 5, 9, '#0e0f14');
    // Left shard
    p(3, 6, 3, 6, '#232634');
    p(3, 6, 2, 2, '#3a3f54');
    // Right shard
    p(10, 5, 3, 7, '#1d202b');
    p(11, 5, 2, 3, '#34394c');
    // Central tall spire
    p(7, 3, 2, 9, '#2b2f40');
    p(7, 3, 1, 4, '#4c536e');
    // Glowing orange-gold ember vein in the core
    p(6, 8, 3, 3, '#d94e14');
    p(7, 7, 2, 3, '#ff8826');
    p(7, 8, 1, 2, '#ffe478');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === IRON) {
    // 2. Dwarven Twin-Flanged Steel Bar with Brass Rivets
    p(1, 5, 14, 6, '#2b303b');
    p(2, 4, 4, 8, '#2b303b');
    p(10, 4, 4, 8, '#2b303b');
    // Flanged end collars
    p(3, 5, 2, 6, '#d6e0ed');
    p(11, 5, 2, 6, '#d6e0ed');
    p(3, 5, 2, 2, '#ffffff');
    p(11, 5, 2, 2, '#ffffff');
    // Recessed gunmetal web with silver-blue top & bottom rails
    p(5, 6, 6, 4, '#5a6478');
    p(5, 5, 6, 1, '#eef4fc');
    p(5, 10, 6, 1, '#98a4b8');
    // Two golden-brass rivets
    p(6, 7, 1, 2, '#f0b442');
    p(9, 7, 1, 2, '#f0b442');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === REDSTONE) {
    // 3. Volatile Arcane Crimson Energy Crystal & Orbiting Sparks
    // Central floating tilted energy shard
    p(6, 2, 4, 12, '#4f0514');
    p(4, 5, 8, 6, '#4f0514');
    p(7, 3, 2, 10, '#c91230');
    p(5, 6, 6, 4, '#f01e42');
    p(6, 5, 4, 6, '#ff4d6d');
    p(7, 6, 2, 4, '#ffd6de');
    // 4 Orbiting glowing scarlet-pink energy motes
    p(2, 3, 2, 2, '#ff2a4b');
    p(2, 3, 1, 1, '#fff0f3');
    p(12, 3, 2, 2, '#ff2a4b');
    p(13, 3, 1, 1, '#fff0f3');
    p(2, 11, 2, 2, '#ff2a4b');
    p(12, 11, 2, 2, '#ff2a4b');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === GOLD) {
    // 4. Gleaming Beveled Pure-Gold Bullion Ingot (diagonal 3D gold bar with bright specular facets)
    // Dark bronze-gold silhouette outline
    p(4, 3, 9, 3, '#593804');
    p(2, 5, 12, 5, '#593804');
    p(1, 7, 12, 5, '#593804');
    // Deep amber-gold lower side & front bevels
    p(2, 8, 10, 3, '#b87409');
    p(4, 6, 9, 4, '#d99311');
    // Radiant pure-gold top slanted table
    p(5, 4, 7, 2, '#f7c11e');
    p(3, 6, 9, 3, '#f7c11e');
    p(2, 8, 8, 2, '#eab015');
    // Sun-gold upper facet & white-gold specular gleam
    p(5, 4, 6, 1, '#ffe96b');
    p(3, 6, 7, 1, '#ffe96b');
    p(4, 5, 5, 1, '#fffbe0');
    p(3, 7, 3, 1, '#fffbe0');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === LAPIS) {
    // 5. Faceted Royal Sapphire-Lazuli Gemstone (rich teardrop/marquise-cut azure crystal)
    // Deep ultramarine outline
    p(6, 1, 4, 2, '#0b1954');
    p(4, 3, 8, 3, '#0b1954');
    p(3, 6, 10, 5, '#0b1954');
    p(4, 11, 8, 3, '#0b1954');
    p(6, 14, 4, 1, '#0b1954');
    // Royal cobalt outer facets
    p(6, 2, 4, 2, '#1c42ba');
    p(4, 4, 8, 8, '#1738a3');
    p(5, 12, 6, 2, '#122b85');
    // Vivid azure central crystal table
    p(5, 4, 6, 7, '#2d63eb');
    p(6, 3, 4, 8, '#4780ff');
    // Inner sky-blue facet & crisp white-azure gem shine
    p(5, 5, 3, 4, '#75a8ff');
    p(6, 4, 2, 2, '#d9ecff');
    p(5, 6, 1, 2, '#ffffff');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === DIAMOND) {
    // 6. 4-Pointed Star-Prism Ice Crystal
    p(7, 1, 2, 14, '#0c4554');
    p(1, 7, 14, 2, '#0c4554');
    p(4, 4, 8, 8, '#0c4554');
    // Diagonal cyan facet wings
    p(5, 5, 6, 6, '#1fa6bd');
    // Vertical & horizontal star-prism spears
    p(7, 2, 2, 12, '#42e8f5');
    p(2, 7, 12, 2, '#42e8f5');
    // Bright white-cyan core
    p(6, 6, 4, 4, '#99fcff');
    p(7, 7, 2, 2, '#ffffff');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === EMERALD) {
    // 7. Twin-Spire Jade Beryl Cluster on Dark Rock Base
    // Main tall emerald spire (right-center)
    p(6, 1, 5, 12, '#063d1e');
    p(7, 2, 3, 10, '#16b857');
    p(7, 2, 2, 8, '#4df28c');
    p(7, 2, 1, 4, '#d9ffea');
    // Secondary angled side crystal spire (left)
    p(2, 5, 5, 7, '#063d1e');
    p(3, 6, 3, 5, '#129646');
    p(3, 6, 2, 3, '#68fa9e');
    // Dark mineral matrix base
    p(4, 12, 8, 3, '#2d3038');
    p(5, 12, 6, 2, '#464a57');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === QUARTZ) {
    // 8. Radiating 3-Pronged Rose-Ivory Geode Crown
    // Center tall needle
    p(6, 1, 4, 11, '#543b44');
    p(7, 2, 2, 9, '#f2e8eb');
    p(7, 2, 1, 6, '#ffffff');
    // Left angled needle
    p(2, 4, 5, 8, '#543b44');
    p(3, 5, 3, 6, '#decbcf');
    p(3, 5, 2, 3, '#ffffff');
    // Right angled needle
    p(9, 4, 5, 8, '#543b44');
    p(10, 5, 3, 6, '#d4bcc2');
    p(11, 5, 2, 3, '#f7f0f2');
    // Dark volcanic geode base
    p(4, 11, 8, 3, '#3b1924');
    p(5, 12, 6, 2, '#5e2838');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === NETHERITE) {
    // Ancient scrap: broken plate with tiny ember inclusions.
    p(3, 5, 10, 8, '#21191c');
    p(4, 6, 8, 5, '#49373b');
    p(5, 6, 6, 2, '#665057');
    p(5, 8, 2, 1, '#ff7045');
    p(8, 9, 2, 1, '#ffb05e');
    p(4, 4, 2, 2, '#31262a');
    p(11, 4, 1, 2, '#31262a');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }
  if (id === NETHERITE_INGOT) {
    // Forged netherite alloy: beveled dark metal with a bright molten rune seam.
    p(4, 3, 8, 3, '#20191e');
    p(2, 5, 12, 6, '#20191e');
    p(4, 11, 9, 2, '#20191e');
    p(4, 4, 8, 2, '#79636a');
    p(3, 6, 10, 4, '#44373e');
    p(4, 10, 8, 2, '#30272d');
    p(5, 4, 5, 1, '#c4aaa0');
    p(4, 7, 2, 1, '#ff7045');
    p(6, 8, 4, 1, '#ffd06a');
    p(10, 9, 2, 1, '#ff7045');
    p(3, 5, 1, 1, '#ffb05e');
    const url = c.toDataURL();
    iconCache.set(id, url);
    return url;
  }

  const atlas = getAtlasCanvas();
  const def = BLOCKS[id];
  // top face (squashed, lighter)
  const [tx, ty] = tileOrigin(def.top);
  ctx.save();
  ctx.translate(0, 0);
  ctx.transform(1, 0, 0, 0.42, 0, 0);
  ctx.drawImage(atlas, tx, ty, TILE, TILE, 0, 0, size, size);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(0, 0, size, size * 0.42);
  // front face
  const [sx, sy] = tileOrigin(def.side);
  ctx.drawImage(atlas, sx, sy, TILE, TILE, 0, size * 0.42, size, size * 0.58);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, size * 0.42, size, size * 0.58);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, size * 0.42, size * 0.12, size * 0.58);
  const url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}
