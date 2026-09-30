import {
  AIR,
  BED,
  CACTUS,
  CACTUS_PALE,
  CHISELED_SANDSTONE,
  CRAFTING_TABLE,
  DEAD_BUSH,
  DIAMOND_BLOCK,
  DIRT,
  DOOR_WOOD,
  DRY_BLOOM,
  EMERALD_BLOCK,
  FENCE_IRON,
  FENCE_STONE,
  FENCE_WOOD,
  FERN,
  FLOWER_RED,
  FLOWER_YELLOW,
  GLASS,
  GOLD_BLOCK,
  GRASS,
  HAY_BALE,
  LAVA,
  LEAVES,
  LOG,
  PEDESTAL_GOLD,
  PLANKS,
  SAND,
  SANDSTONE,
  TALL_GRASS,
  TERRACOTTA_ORANGE,
  TORCH,
  VINE,
  WATER,
} from './blocks';
import { mulberry32 } from './noise';
import type { World } from './world';
import { CHUNK, ORIGIN_X, ORIGIN_Z, SEA } from './world';
import {
  buildAladdinBlueDomePalace,
  buildAladdinRedFortress,
  buildCliffsideCarvedTemple,
  buildDesertGablePergolaHouse,
  buildDesertOasisLagoon,
  buildDesertOasisSanctuary,
  buildDesertTieredLanternVilla,
  buildGiantDesertSkull,
  buildGreatSphinxMonument,
  buildObeliskAvenueCourt,
  buildPyramidBabylonColonnade,
  buildPyramidLavaHorus,
  buildPyramidPharaohRed,
  buildPyramidSkullGate,
  buildPyramidSteppedMaya,
  buildRuinedDesertCastle,
} from './desertLandmarks';

export type DesertAssetId =
  | 'desert_minaret_tower'
  | 'desert_stepped_balcony_house'
  | 'desert_beam_garden_house'
  | 'desert_pergola_house'
  | 'desert_courtyard_villa'
  | 'desert_adobe_cottage'
  | 'desert_pergola_farm'
  | 'desert_well_pavilion'
  | 'desert_bazaar_row'
  | 'desert_temple'
  | 'desert_gable_pergola_house'
  | 'desert_tiered_lantern_villa'
  | 'desert_oasis_lagoon'
  | 'pyramid_stepped_maya'
  | 'pyramid_lava_horus'
  | 'pyramid_skull_gate'
  | 'pyramid_pharaoh_red'
  | 'pyramid_babylon_colonnade'
  | 'sphinx_monument'
  | 'obelisk_avenue'
  | 'aladdin_red_fortress'
  | 'aladdin_blue_dome_palace'
  | 'desert_oasis_sanctuary'
  | 'giant_desert_skull'
  | 'ruined_desert_castle';

export interface DesertAssetDef {
  id: DesertAssetId;
  name: string;
  width: number;
  depth: number;
  weight: number;
  build: (world: World, x0: number, y0: number, z0: number, rand: () => number) => void;
}

/**
 * Find a dry spot strictly inside chunk (cx, cz) so the asset never clips
 * across chunk borders. When `villageMode` is true, tolerates slightly steeper
 * dunes so every plot in a multi-building desert village spawns reliably.
 */
function findDesertSpotInChunk(
  world: World,
  cx: number,
  cz: number,
  w: number,
  d: number,
  rand: () => number,
  villageMode = false,
): [number, number, number] | null {
  const maxX = Math.max(0, CHUNK - w);
  const maxZ = Math.max(0, CHUNK - d);
  const maxSlope = villageMode ? 8 : 5;
  for (let tries = 0; tries < 12; tries++) {
    const lx = tries === 0 ? Math.floor((CHUNK - w) / 2) : Math.floor(rand() * (maxX + 1));
    const lz = tries === 0 ? Math.floor((CHUNK - d) / 2) : Math.floor(rand() * (maxZ + 1));
    const x0 = cx * CHUNK + Math.max(0, Math.min(lx, CHUNK - w));
    const z0 = cz * CHUNK + Math.max(0, Math.min(lz, CHUNK - d));
    const xm = x0 + (w >> 1);
    const zm = z0 + (d >> 1);
    if (!villageMode && world.biomeAt(xm, zm) !== 'desert') continue;

    let hMin = Infinity;
    let hMax = -Infinity;
    let flooded = false;
    const samples: Array<[number, number]> = [
      [x0, z0],
      [x0 + w - 1, z0],
      [x0, z0 + d - 1],
      [x0 + w - 1, z0 + d - 1],
      [xm, zm],
      [xm, z0],
      [xm, z0 + d - 1],
    ];
    for (const [px, pz] of samples) {
      const h = world.getHeight(px, pz);
      if (h <= SEA || world.get(px, h, pz) === WATER || world.get(px, h + 1, pz) === WATER) {
        flooded = true;
        break;
      }
      hMin = Math.min(hMin, h);
      hMax = Math.max(hMax, h);
    }
    if (!villageMode && (flooded || hMax - hMin > maxSlope || hMin <= SEA || hMax > 36)) continue;
    const baseH = Math.max(SEA + 2, Math.min(32, Math.round(hMin * 0.65 + hMax * 0.35)));
    return [x0, baseH, z0];
  }
  return null;
}

/**
 * Prepare a clean, level sandstone foundation and a walkable sand street apron
 * around the structure footprint within the chunk.
 */
function prepareDesertFoundation(
  world: World,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  d: number,
  clearH: number,
  floorBlock = SANDSTONE,
) {
  const cx = Math.floor((x0 + (w >> 1)) / CHUNK);
  const cz = Math.floor((z0 + (d >> 1)) / CHUNK);
  const minX = Math.max(cx * CHUNK, x0 - 2);
  const maxX = Math.min(cx * CHUNK + CHUNK - 1, x0 + w + 1);
  const minZ = Math.max(cz * CHUNK, z0 - 2);
  const maxZ = Math.min(cz * CHUNK + CHUNK - 1, z0 + d + 1);

  // Clear air volume above the footprint and its street apron
  for (let y = y0 + 1; y <= y0 + clearH; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        world.set(x, y, z, AIR);
      }
    }
  }

  // Apron border at y0 in SAND (with occasional sandstone path cobbles) so entrances are never blocked
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const inside = x >= x0 && x < x0 + w && z >= z0 && z < z0 + d;
      const topId = inside ? floorBlock : SAND;
      world.set(x, y0, z, topId);
      for (let fy = y0 - 1; fy >= Math.max(2, y0 - 7); fy--) {
        const cur = world.get(x, fy, z);
        if (cur !== AIR && cur !== WATER && cur !== LAVA) break;
        world.set(x, fy, z, inside ? SANDSTONE : SAND);
      }
    }
  }
}

/**
 * Custom Desert Oasis Tree (from the reference screenshot: crooked oak-log trunk
 * with layered green leaf clusters and occasional hanging vines).
 */
function buildDesertOasisTree(world: World, tx: number, ty: number, tz: number, rand: () => number) {
  const cx = Math.floor(tx / CHUNK);
  const cz = Math.floor(tz / CHUNK);
  const inChunk = (x: number, z: number) =>
    x >= cx * CHUNK + 1 && x <= cx * CHUNK + CHUNK - 2 && z >= cz * CHUNK + 1 && z <= cz * CHUNK + CHUNK - 2;
  if (!inChunk(tx, tz)) return;

  const trunkH = 3 + Math.floor(rand() * 2); // 3..4 blocks tall
  const bendDir: [number, number] =
    rand() < 0.25 ? [1, 0] : rand() < 0.5 ? [-1, 0] : rand() < 0.75 ? [0, 1] : [0, -1];

  world.set(tx, ty - 1, tz, DIRT);
  let curX = tx;
  let curZ = tz;
  for (let y = 0; y < trunkH; y++) {
    if (y === trunkH - 1 && inChunk(curX + bendDir[0], curZ + bendDir[1])) {
      world.set(curX, ty + y, curZ, LOG);
      curX += bendDir[0];
      curZ += bendDir[1];
    }
    world.set(curX, ty + y, curZ, LOG);
  }

  const crownY = ty + trunkH;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.abs(dx) + Math.abs(dz);
      const lx = curX + dx;
      const lz = curZ + dz;
      if (!inChunk(lx, lz)) continue;
      if (dist <= 2 && !(Math.abs(dx) === 2 && Math.abs(dz) === 2)) {
        if (world.get(lx, crownY, lz) === AIR) world.set(lx, crownY, lz, LEAVES);
        if (dist === 2 && rand() < 0.35 && world.get(lx, crownY - 1, lz) === AIR) {
          world.set(lx, crownY - 1, lz, LEAVES);
        }
      }
      if (dist <= 1 && world.get(lx, crownY + 1, lz) === AIR) {
        world.set(lx, crownY + 1, lz, LEAVES);
      }
    }
  }
}

/**
 * Populate the sandy street perimeter of a chunk with desert village details:
 * sandstone path stones, oasis trees, hay bales, and desert shrubs.
 */
function decorateVillageStreet(
  world: World,
  cx: number,
  cz: number,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  d: number,
  rand: () => number,
) {
  const cMinX = cx * CHUNK + 1;
  const cMaxX = cx * CHUNK + CHUNK - 2;
  const cMinZ = cz * CHUNK + 1;
  const cMaxZ = cz * CHUNK + CHUNK - 2;

  // Try placing 1–2 custom desert oasis trees in the open corners of the chunk
  const treeCandidates: Array<[number, number]> = [
    [cMinX + 1, cMinZ + 1],
    [cMaxX - 1, cMinZ + 1],
    [cMinX + 1, cMaxZ - 1],
    [cMaxX - 1, cMaxZ - 1],
  ];
  let treesPlaced = 0;
  for (const [tx, tz] of treeCandidates) {
    if (treesPlaced >= 2) break;
    const outsideBuilding = tx < x0 - 1 || tx > x0 + w || tz < z0 - 1 || tz > z0 + d;
    if (!outsideBuilding) continue;
    const th = world.getHeight(tx, tz);
    if (th > SEA + 1 && Math.abs(th - y0) <= 3 && world.get(tx, th, tz) === SAND && rand() < 0.75) {
      buildDesertOasisTree(world, tx, th + 1, tz, rand);
      treesPlaced++;
    }
  }

  // Try placing a style-matched street lamp post (from maxresdefault.jpg) on an open street corner
  const lampCandidates: Array<[number, number, number, number]> = [
    [cMinX + 2, cMinZ + 2, 1, 0],
    [cMaxX - 2, cMinZ + 2, -1, 0],
    [cMinX + 2, cMaxZ - 2, 1, 0],
    [cMaxX - 2, cMaxZ - 2, -1, 0],
  ];
  for (const [lx, lz, adx, adz] of lampCandidates) {
    const outsideBuilding = lx < x0 - 1 || lx > x0 + w || lz < z0 - 1 || lz > z0 + d;
    if (!outsideBuilding) continue;
    const lh = world.getHeight(lx, lz);
    if (lh > SEA + 1 && Math.abs(lh - y0) <= 3 && world.get(lx, lh, lz) === SAND) {
      if (rand() < 0.45) {
        buildDesertDoubleLampPost(world, lx, lh, lz, rand() < 0.5, rand() < 0.65);
      } else if (rand() < 0.75) {
        buildDesertSingleLampPost(world, lx, lh, lz, adx, adz);
      } else {
        buildDesertBotanicalLampPost(world, lx, lh, lz, adx, adz);
      }
      break;
    }
  }

  // Scatter sandstone path stepping stones & desert flora along the street margin
  for (let i = 0; i < 9; i++) {
    const sx = cMinX + Math.floor(rand() * (CHUNK - 2));
    const sz = cMinZ + Math.floor(rand() * (CHUNK - 2));
    const outside = sx < x0 || sx >= x0 + w || sz < z0 || sz >= z0 + d;
    if (!outside) continue;
    const sh = world.getHeight(sx, sz);
    if (sh <= SEA + 1 || Math.abs(sh - y0) > 3 || world.get(sx, sh, sz) !== SAND) continue;
    const roll = rand();
    if (roll < 0.45) {
      world.set(sx, sh, sz, rand() < 0.7 ? SANDSTONE : CHISELED_SANDSTONE);
    } else if (roll < 0.62 && world.get(sx, sh + 1, sz) === AIR) {
      world.set(sx, sh + 1, sz, rand() < 0.65 ? DEAD_BUSH : DRY_BLOOM);
    } else if (roll < 0.68 && world.get(sx, sh + 1, sz) === AIR) {
      world.set(sx, sh + 1, sz, rand() < 0.5 ? CACTUS : CACTUS_PALE);
    }
  }
}

/** Helper to place a small stack of golden hay bales beside a building */
function placeHayStack(world: World, x: number, y: number, z: number, rand: () => number) {
  world.set(x, y, z, HAY_BALE);
  if (rand() < 0.65) world.set(x, y + 1, z, HAY_BALE);
  for (const [dx, dz] of [
    [1, 0],
    [0, 1],
  ]) {
    if (rand() < 0.55 && world.get(x + dx, y, z + dz) === AIR) {
      world.set(x + dx, y, z + dz, HAY_BALE);
    }
  }
}

/**
 * Wall-mounted bracket lantern (from maxresdefault.jpg):
 * Wooden fence arm at (x, y + 1, z) with a 3D Lantern hanging underneath at (x, y, z).
 */
function placeWallBracketLantern(world: World, x: number, y: number, z: number) {
  world.set(x, y + 1, z, FENCE_WOOD);
  world.set(x, y, z, TORCH);
}

/**
 * Single overhanging street lamp post (from maxresdefault.jpg top-left & bottom-left):
 * Chiseled Sandstone base + 3-block wooden fence post + overhanging plank/fence arm + hanging Lantern.
 */
function buildDesertSingleLampPost(
  world: World,
  x: number,
  y0: number,
  z: number,
  armDx: number,
  armDz: number,
) {
  world.set(x, y0 + 1, z, CHISELED_SANDSTONE);
  world.set(x, y0 + 2, z, FENCE_WOOD);
  world.set(x, y0 + 3, z, FENCE_WOOD);
  world.set(x, y0 + 4, z, PLANKS);
  world.set(x + armDx, y0 + 4, z + armDz, FENCE_WOOD);
  world.set(x + armDx, y0 + 3, z + armDz, TORCH);
}

/**
 * Double T-Bar street lamp post with optional staggered iron chain (from maxresdefault.jpg):
 * Chiseled Sandstone base + stone collar + wooden post + T-crossbeam + 2 hanging Lanterns.
 */
function buildDesertDoubleLampPost(
  world: World,
  x: number,
  y0: number,
  z: number,
  alongX = true,
  staggeredChain = true,
) {
  const dx = alongX ? 1 : 0;
  const dz = alongX ? 0 : 1;
  world.set(x, y0 + 1, z, CHISELED_SANDSTONE);
  world.set(x, y0 + 2, z, FENCE_STONE);
  world.set(x, y0 + 3, z, FENCE_WOOD);
  world.set(x, y0 + 4, z, FENCE_WOOD);
  world.set(x, y0 + 5, z, PLANKS);
  world.set(x - dx, y0 + 5, z - dz, FENCE_WOOD);
  world.set(x + dx, y0 + 5, z + dz, FENCE_WOOD);
  world.set(x - dx, y0 + 4, z - dz, TORCH);
  if (staggeredChain) {
    world.set(x + dx, y0 + 4, z + dz, FENCE_IRON);
    world.set(x + dx, y0 + 3, z + dz, TORCH);
  } else {
    world.set(x + dx, y0 + 4, z + dz, TORCH);
  }
}

/**
 * Botanical Oasis Lamp Post with draped foliage (from maxresdefault.jpg right panels):
 * Planter base + wooden post + leafy overhang + hanging Lantern.
 */
function buildDesertBotanicalLampPost(
  world: World,
  x: number,
  y0: number,
  z: number,
  armDx: number,
  armDz: number,
) {
  world.set(x, y0 + 1, z, PLANKS);
  world.set(x, y0 + 2, z, FENCE_WOOD);
  world.set(x, y0 + 3, z, FENCE_WOOD);
  world.set(x, y0 + 4, z, FENCE_WOOD);
  world.set(x, y0 + 5, z, PLANKS);
  world.set(x, y0 + 6, z, LEAVES);
  world.set(x + armDx, y0 + 5, z + armDz, LEAVES);
  world.set(x + armDx, y0 + 4, z + armDz, TORCH);
}

/**
 * 1. DESERT MINARET WATCHTOWER (Высокая башня-минарет с балками и зеленью у подножия)
 * Matches the central & left-center towers in 2018-09-18-13-42-01-1537707980_lrg.png:
 * - 7x7 crenellated sandstone base with protruding Oak Log timber beam ends,
 * - Lush green rooftop bushes & flowers planted inside the base parapet around the shaft,
 * - Slender 5x5 -> 3x3 tall sandstone shaft with recessed vertical window slits,
 *   stepped sandstone ledges, flared crown, and central wooden fence spire.
 */
function buildDesertMinaretTower(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 9;
  const d = 9;
  const baseH = 4;
  const towerH = 13;
  prepareDesertFoundation(world, x0, y0, z0, w, d, towerH + 4, SANDSTONE);

  const bx0 = x0 + 1;
  const bz0 = z0 + 1; // 7x7 base block (bx0..bx0+6, bz0..bz0+6)
  const cx = x0 + 4;
  const cz = z0 + 4;

  // --- 1. 7x7 Base Terrace (height 1..4) ---
  for (let y = 1; y <= baseH; y++) {
    for (let z = bz0; z <= bz0 + 6; z++) {
      for (let x = bx0; x <= bx0 + 6; x++) {
        const edge = x === bx0 || x === bx0 + 6 || z === bz0 || z === bz0 + 6;
        if (!edge) {
          if (y === baseH) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        const corner = (x === bx0 || x === bx0 + 6) && (z === bz0 || z === bz0 + 6);
        world.set(x, y0 + y, z, y === baseH || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Protruding Oak Log timber beams sticking out 1 block from the 7x7 base at y0 + 3
  for (const dOff of [-2, 0, 2]) {
    world.set(cx + dOff, y0 + 3, z0, LOG);
    world.set(cx + dOff, y0 + 3, z0 + 8, LOG);
    world.set(x0, y0 + 3, cz + dOff, LOG);
    world.set(x0 + 8, y0 + 3, cz + dOff, LOG);
  }

  // Base parapet merlons + lush green bushes/flowers on the base roof (y0 + 5)
  for (let z = bz0; z <= bz0 + 6; z++) {
    for (let x = bx0; x <= bx0 + 6; x++) {
      const edge = x === bx0 || x === bx0 + 6 || z === bz0 || z === bz0 + 6;
      const corner = (x === bx0 || x === bx0 + 6) && (z === bz0 || z === bz0 + 6);
      if (edge) {
        if (corner || (x + z) % 2 === 0) {
          world.set(x, y0 + baseH + 1, z, corner ? CHISELED_SANDSTONE : SANDSTONE);
        } else if (rand() < 0.45) {
          world.set(x, y0 + baseH + 1, z, FENCE_WOOD);
        }
      } else if (Math.abs(x - cx) === 2 || Math.abs(z - cz) === 2) {
        // Ring of terrace greenery around the central tower shaft (exact match to screenshot!)
        const roll = rand();
        if (roll < 0.55) {
          world.set(x, y0 + baseH + 1, z, LEAVES);
        } else if (roll < 0.8) {
          world.set(x, y0 + baseH, z, GRASS);
          world.set(x, y0 + baseH + 1, z, rand() < 0.5 ? FLOWER_RED : TALL_GRASS);
        }
      }
    }
  }

  // --- 2. Tall Slender Central Minaret Shaft (cx-1..cx+1 core with corner piers, y=5..towerH) ---
  for (let y = baseH + 1; y <= towerH; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ax = Math.abs(dx);
        const az = Math.abs(dz);
        // Inner 3x3 shaft + buttress piers at (|dx|<=1, |dz|==2) or crown at top
        if (ax === 2 && az === 2) continue;
        if (ax <= 1 && az <= 1) {
          if (dx === 0 && dz === 0) {
            world.set(cx, y0 + y, cz, y === towerH ? SANDSTONE : AIR);
          } else {
            world.set(cx + dx, y0 + y, cz + dz, y === 8 || y === 11 ? CHISELED_SANDSTONE : SANDSTONE);
          }
        } else if (y <= 6 || y === 9 || y >= towerH - 1) {
          // Protruding sandstone ledges & flared upper cornice crown
          const isMidWindow = (dx === 0 || dz === 0) && y >= 6 && y <= 10;
          if (!isMidWindow) {
            world.set(cx + dx, y0 + y, cz + dz, y === towerH ? CHISELED_SANDSTONE : SANDSTONE);
          }
        }
      }
    }
    // Recessed vertical slit windows with wooden lattice on all 4 faces (y=6..10)
    if (y >= 6 && y <= 10) {
      const winBlock = y === 8 ? SANDSTONE : FENCE_WOOD;
      world.set(cx, y0 + y, cz - 1, winBlock);
      world.set(cx, y0 + y, cz + 1, winBlock);
      world.set(cx - 1, y0 + y, cz, winBlock);
      world.set(cx + 1, y0 + y, cz, winBlock);
    }
  }

  // Top roof cap & wooden fence finial spire (y0 + towerH + 1 .. + 3)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.set(cx + dx, y0 + towerH + 1, cz + dz, dx === 0 && dz === 0 ? CHISELED_SANDSTONE : SANDSTONE);
    }
  }
  world.set(cx, y0 + towerH + 2, cz, FENCE_WOOD);
  world.set(cx, y0 + towerH + 3, cz, FENCE_WOOD);
  world.set(cx, y0 + towerH + 4, cz, TORCH);

  // Ground-floor arched doorway (-Z) + twin wall-bracket lanterns flanking the entrance
  world.set(cx, y0 + 1, bz0, DOOR_WOOD);
  world.set(cx, y0 + 2, bz0, DOOR_WOOD);
  world.set(cx, y0 + 1, z0, AIR);
  world.set(cx, y0 + 2, z0, AIR);
  placeWallBracketLantern(world, cx - 2, y0 + 2, z0);
  placeWallBracketLantern(world, cx + 2, y0 + 2, z0);
  // Hanging chain lanterns on the upper minaret crown
  world.set(cx - 2, y0 + towerH - 2, cz, TORCH);
  world.set(cx + 2, y0 + towerH - 2, cz, TORCH);
  world.set(cx, y0 + 1, cz, TORCH);

  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

/**
 * 2. DESERT STEPPED BALCONY HOUSE (Двухъярусный дом с балконом, навесом и лестницей)
 * Matches the prominent two-story house on the left foreground of 2018-09-18-13-42-01-1537707980_lrg.png:
 * - Wide sandstone ground story with a sloped wooden front market awning & workbench,
 * - Set-back second story with an inset roof cap + rooftop greenery patch,
 * - Second-floor balcony enclosed by wooden fences & shaded by a wooden canopy,
 * - Exterior stepped sandstone staircase climbing up the side wall.
 */
function buildDesertSteppedBalconyHouse(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 10;
  const d = 9;
  const h1 = 4;
  const h2 = 8;
  prepareDesertFoundation(world, x0, y0, z0, w, d, h2 + 3, SANDSTONE);

  // --- 1. Ground Story (x0+1..x0+7, z0+2..z0+8) ---
  const gx0 = x0 + 1;
  const gx1 = x0 + 7;
  const gz0 = z0 + 2;
  const gz1 = z0 + 8;

  for (let y = 1; y <= h1; y++) {
    for (let z = gz0; z <= gz1; z++) {
      for (let x = gx0; x <= gx1; x++) {
        const edge = x === gx0 || x === gx1 || z === gz0 || z === gz1;
        if (!edge) {
          if (y === h1) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        const corner = (x === gx0 || x === gx1) && (z === gz0 || z === gz1);
        world.set(x, y0 + y, z, y === h1 || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Protruding Oak Log beam ends on ground-floor side & rear walls at y0 + 3
  world.set(gx0 - 1, y0 + 3, gz0 + 2, LOG);
  world.set(gx0 - 1, y0 + 3, gz0 + 4, LOG);
  world.set(gx0 + 2, y0 + 3, gz1, LOG);
  world.set(gx0 + 4, y0 + 3, gz1, LOG);

  // Ground-floor front awning (z0..z0+1, x: gx0+1..gx1-1) + outdoor counter
  for (let x = gx0 + 1; x <= gx1 - 1; x++) {
    world.set(x, y0 + 3, gz0 - 1, PLANKS);
    world.set(x, y0 + 2, gz0 - 2, PLANKS);
  }
  world.set(gx0 + 1, y0 + 1, gz0 - 2, FENCE_WOOD);
  world.set(gx1 - 1, y0 + 1, gz0 - 2, FENCE_WOOD);
  world.set(gx0 + 2, y0 + 1, gz0 - 1, CRAFTING_TABLE);
  world.set(gx1 - 2, y0 + 1, gz0 - 1, PEDESTAL_GOLD);

  // Ground-floor doorway & windows
  world.set(gx0 + 3, y0 + 1, gz0, DOOR_WOOD);
  world.set(gx0 + 3, y0 + 2, gz0, DOOR_WOOD);
  world.set(gx0 + 5, y0 + 2, gz0, FENCE_WOOD);
  world.set(gx0, y0 + 2, gz0 + 3, FENCE_WOOD);
  world.set(gx0 + 2, y0 + 1, gz0 + 2, TORCH);
  world.set(gx0 + 4, y0 + 1, gz1 - 1, BED);
  world.set(gx0 + 5, y0 + 1, gz1 - 1, BED);

  // --- 2. Exterior Stepped Sandstone Staircase on +X side (x = gx1 + 1) ---
  for (let step = 0; step < 4; step++) {
    const sz = gz0 + 1 + step;
    const sy = y0 + 1 + step;
    for (let fillY = y0 + 1; fillY <= sy; fillY++) {
      world.set(gx1 + 1, fillY, sz, fillY === sy ? SANDSTONE : CHISELED_SANDSTONE);
    }
    world.set(gx1 + 2, sy, sz, FENCE_WOOD);
  }

  // --- 3. Second Story on rear half of roof (gx0+1..gx1-1, z: gz0+3..gz1) ---
  for (let y = h1 + 1; y <= h2; y++) {
    for (let z = gz0 + 3; z <= gz1; z++) {
      for (let x = gx0 + 1; x <= gx1 - 1; x++) {
        const edge = x === gx0 + 1 || x === gx1 - 1 || z === gz0 + 3 || z === gz1;
        if (!edge) {
          if (y === h2) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        const corner = (x === gx0 + 1 || x === gx1 - 1) && (z === gz0 + 3 || z === gz1);
        world.set(x, y0 + y, z, y === h2 || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }
  // Upper doorway & window onto front balcony
  world.set(gx0 + 3, y0 + h1 + 1, gz0 + 3, DOOR_WOOD);
  world.set(gx0 + 3, y0 + h1 + 2, gz0 + 3, DOOR_WOOD);
  world.set(gx0 + 1, y0 + h1 + 2, gz0 + 5, FENCE_WOOD);
  world.set(gx1 - 1, y0 + h1 + 2, gz0 + 5, FENCE_WOOD);

  // Inset raised roof cap on top of 2nd story (y0 + h2 + 1) with greenery patch
  for (let z = gz0 + 4; z <= gz1 - 1; z++) {
    for (let x = gx0 + 2; x <= gx1 - 2; x++) {
      world.set(x, y0 + h2 + 1, z, SANDSTONE);
    }
  }
  world.set(gx0 + 3, y0 + h2 + 2, gz0 + 5, LEAVES);
  if (rand() < 0.7) world.set(gx0 + 4, y0 + h2 + 2, gz0 + 5, TALL_GRASS);

  // --- 4. Second-Story Front Balcony & Wooden Shade Canopy (z: gz0..gz0+2) ---
  for (let z = gz0; z <= gz0 + 2; z++) {
    for (let x = gx0; x <= gx1; x++) {
      const edge = x === gx0 || x === gx1 || z === gz0;
      if (edge && !(x === gx1 && z === gz0 + 2)) {
        world.set(x, y0 + h1 + 1, z, FENCE_WOOD);
      }
    }
  }
  // Corner fence posts & wooden plank canopy shading the upper balcony
  world.set(gx0 + 1, y0 + h1 + 2, gz0, FENCE_WOOD);
  world.set(gx0 + 1, y0 + h1 + 3, gz0, FENCE_WOOD);
  world.set(gx1 - 1, y0 + h1 + 2, gz0, FENCE_WOOD);
  world.set(gx1 - 1, y0 + h1 + 3, gz0, FENCE_WOOD);
  for (let z = gz0; z <= gz0 + 2; z++) {
    for (let x = gx0 + 1; x <= gx1 - 1; x++) {
      world.set(x, y0 + h1 + 4, z, PLANKS);
    }
  }
  // Potted bush on balcony corner + hanging lantern under the upper balcony canopy
  world.set(gx0 + 1, y0 + h1 + 1, gz0 + 1, LEAVES);
  world.set(gx0 + 3, y0 + h1 + 3, gz0 + 1, TORCH);
  // Single overhanging street lamp post beside the front market awning (maxresdefault.jpg)
  buildDesertSingleLampPost(world, x0, y0, z0 + 1, 1, 0);

  world.structureSites.push({ x: gx0 + 3, y: y0 + 1, z: gz0 + 3, kind: 'cottage' });
}

/**
 * 3. DESERT TIMBER-BEAM ROOFTOP GARDEN HOUSE (Дом с бревнами и садом на крыше)
 * Matches the houses in the right foreground & center of 2018-09-18-13-42-01-1537707980_lrg.png:
 * - Warm sandstone facade with protruding Oak Log ceiling beam ends on all 4 sides,
 * - Recessed wooden-shuttered windows with plank sills,
 * - Crenellated sandstone rooftop parapet + wooden fence railings enclosing a
 *   lush sunken rooftop garden (bushes, tall grass, red & yellow flowers),
 * - Cascading green leaves & vines draping down one corner of the building.
 */
function buildDesertBeamGardenHouse(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 10;
  const d = 10;
  const wallH = 5;
  prepareDesertFoundation(world, x0, y0, z0, w, d, wallH + 4, SANDSTONE);

  const hx0 = x0 + 1;
  const hx1 = x0 + 8; // 8x8 house body inside 10x10 footprint (leaving 1-block border for protruding beams)
  const hz0 = z0 + 1;
  const hz1 = z0 + 8;

  // --- 1. Sandstone & Chiseled Sandstone Walls (y=1..5) ---
  for (let y = 1; y <= wallH; y++) {
    for (let z = hz0; z <= hz1; z++) {
      for (let x = hx0; x <= hx1; x++) {
        const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1;
        if (!edge) {
          if (y === wallH) {
            // Sunken rooftop garden soil in the center 4x4 of the roof
            const inGarden = x >= hx0 + 2 && x <= hx1 - 2 && z >= hz0 + 2 && z <= hz1 - 2;
            world.set(x, y0 + y, z, inGarden ? GRASS : SANDSTONE);
          }
          continue;
        }
        const corner = (x === hx0 || x === hx1) && (z === hz0 || z === hz1);
        let mat = SANDSTONE;
        if (y === wallH || corner) mat = CHISELED_SANDSTONE;
        world.set(x, y0 + y, z, mat);
      }
    }
  }

  // --- 2. Signature Protruding Oak Log Timber Beams at y0 + 2 and y0 + 4 ---
  for (const offset of [1, 3, 6]) {
    // Upper beam row (y0 + 4) on all 4 facades
    world.set(hx0 + offset, y0 + 4, z0, LOG);
    world.set(hx0 + offset, y0 + 4, z0 + 9, LOG);
    world.set(x0, y0 + 4, hz0 + offset, LOG);
    world.set(x0 + 9, y0 + 4, hz0 + offset, LOG);
  }
  // Lower beam accents on corners (y0 + 2)
  world.set(hx0 + 1, y0 + 2, z0, LOG);
  world.set(hx1 - 1, y0 + 2, z0, LOG);
  world.set(x0, y0 + 2, hz0 + 1, LOG);
  world.set(x0 + 9, y0 + 2, hz0 + 1, LOG);

  // --- 3. Windows, Shutters & Doorway ---
  const doorX = hx0 + 3;
  world.set(doorX, y0 + 1, hz0, DOOR_WOOD);
  world.set(doorX, y0 + 2, hz0, DOOR_WOOD);
  world.set(doorX, y0 + 3, z0, PLANKS); // wooden door hood

  // Shuttered windows on all sides
  for (const [wx, wz] of [
    [hx0 + 5, hz0],
    [hx0, hz0 + 3],
    [hx0, hz0 + 5],
    [hx1, hz0 + 3],
    [hx1, hz0 + 5],
    [hx0 + 3, hz1],
    [hx0 + 5, hz1],
  ]) {
    world.set(wx, y0 + 2, wz, FENCE_WOOD);
    world.set(wx, y0 + 3, wz, FENCE_WOOD);
  }

  // --- 4. Crenellated Parapet + Lush Rooftop Oasis Garden (y0 + wallH + 1) ---
  for (let z = hz0; z <= hz1; z++) {
    for (let x = hx0; x <= hx1; x++) {
      const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1;
      const corner = (x === hx0 || x === hx1) && (z === hz0 || z === hz1);
      if (edge) {
        if (corner || (x + z) % 2 === 0) {
          world.set(x, y0 + wallH + 1, z, corner ? CHISELED_SANDSTONE : SANDSTONE);
        } else {
          world.set(x, y0 + wallH + 1, z, FENCE_WOOD);
        }
      } else if (x >= hx0 + 2 && x <= hx1 - 2 && z >= hz0 + 2 && z <= hz1 - 2) {
        const r = rand();
        if (r < 0.42) world.set(x, y0 + wallH + 1, z, LEAVES);
        else if (r < 0.68) world.set(x, y0 + wallH + 1, z, TALL_GRASS);
        else if (r < 0.85) world.set(x, y0 + wallH + 1, z, FLOWER_RED);
        else world.set(x, y0 + wallH + 1, z, FLOWER_YELLOW);
      }
    }
  }

  // Cascading green leaves & vines draping down the front-left corner (as in screenshot!)
  for (let y = wallH + 1; y >= 2; y--) {
    world.set(hx0, y0 + y, z0, y >= 4 ? LEAVES : VINE);
    if (y >= 3) world.set(x0, y0 + y, hz0, LEAVES);
  }

  // Interior furnishings + wall bracket lantern by doorway + botanical lamp post outside
  world.set(hx0 + 2, y0 + 1, hz0 + 2, TORCH);
  placeWallBracketLantern(world, doorX + 1, y0 + 2, z0);
  buildDesertBotanicalLampPost(world, x0 + 9, y0, z0 + 1, -1, 0);
  world.set(hx1 - 2, y0 + 1, hz1 - 1, BED);
  world.set(hx1 - 1, y0 + 1, hz1 - 1, BED);
  world.set(hx0 + 1, y0 + 1, hz1 - 1, CRAFTING_TABLE);
  placeHayStack(world, x0 + 9, y0 + 1, hz1 - 1, rand);

  world.structureSites.push({ x: hx0 + 3, y: y0 + 1, z: hz0 + 3, kind: 'cottage' });
}

/**
 * 4. DESERT LATTICE PERGOLA HOUSE (Дом с деревянной решетчатой перголой на крыше)
 * Matches the sandstone house with the elevated waffle/grid wooden roof pergola in
 * the foreground of screenshot #2 and upper-left of screenshot #1.
 */
function buildDesertPergolaHouse(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 9;
  const d = 9;
  const wallH = 4;
  prepareDesertFoundation(world, x0, y0, z0, w, d, wallH + 5, SANDSTONE);

  const hx0 = x0 + 1;
  const hx1 = x0 + 7; // 7x7 house body
  const hz0 = z0 + 1;
  const hz1 = z0 + 7;

  // --- 1. Main Sandstone House Body (y=1..4) ---
  for (let y = 1; y <= wallH; y++) {
    for (let z = hz0; z <= hz1; z++) {
      for (let x = hx0; x <= hx1; x++) {
        const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1;
        if (!edge) {
          if (y === wallH) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        const corner = (x === hx0 || x === hx1) && (z === hz0 || z === hz1);
        world.set(x, y0 + y, z, y === wallH || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Protruding Oak Log beams on all 4 facades at y0 + 3
  for (const off of [1, 3, 5]) {
    world.set(hx0 + off, y0 + 3, z0, LOG);
    world.set(hx0 + off, y0 + 3, z0 + 8, LOG);
    world.set(x0, y0 + 3, hz0 + off, LOG);
    world.set(x0 + 8, y0 + 3, hz0 + off, LOG);
  }

  // Doorway & windows
  world.set(hx0 + 3, y0 + 1, hz0, DOOR_WOOD);
  world.set(hx0 + 3, y0 + 2, hz0, DOOR_WOOD);
  world.set(hx0 + 1, y0 + 2, hz0, FENCE_WOOD);
  world.set(hx0 + 5, y0 + 2, hz0, FENCE_WOOD);
  world.set(hx0, y0 + 2, hz0 + 3, FENCE_WOOD);
  world.set(hx1, y0 + 2, hz0 + 3, FENCE_WOOD);

  // --- 2. Rooftop Wooden Railing & Elevated Lattice Waffle Pergola (y0 + 5 .. y0 + 7) ---
  for (let z = hz0; z <= hz1; z++) {
    for (let x = hx0; x <= hx1; x++) {
      const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1;
      const corner = (x === hx0 || x === hx1) && (z === hz0 || z === hz1);
      if (edge) {
        world.set(x, y0 + wallH + 1, z, corner ? CHISELED_SANDSTONE : FENCE_WOOD);
      }
      if (corner || ((edge && (x === hx0 + 3 || z === hz0 + 3)))) {
        world.set(x, y0 + wallH + 2, z, FENCE_WOOD);
      }
      // Waffle lattice roof at y0 + wallH + 3: alternating planks and fence grid
      const rx = x - hx0;
      const rz = z - hz0;
      if (rx % 2 === 0 || rz % 2 === 0) {
        world.set(x, y0 + wallH + 3, z, rx % 2 === 0 && rz % 2 === 0 ? PLANKS : FENCE_WOOD);
      }
    }
  }

  // Rooftop lounge plants & chain-suspended lanterns under the lattice pergola beams (rx=2,4, rz=2,4 have PLANKS at y0+wallH+3)
  world.set(hx0 + 2, y0 + wallH + 1, hz0 + 2, LEAVES);
  world.set(hx1 - 2, y0 + wallH + 1, hz1 - 2, LEAVES);
  world.set(hx0 + 2, y0 + wallH + 2, hz0 + 4, TORCH);
  world.set(hx0 + 4, y0 + wallH + 2, hz0 + 2, FENCE_IRON);
  world.set(hx0 + 4, y0 + wallH + 1, hz0 + 2, TORCH);

  // Interior furniture + front bracket lantern
  world.set(hx0 + 2, y0 + 1, hz0 + 2, TORCH);
  placeWallBracketLantern(world, hx0 + 2, y0 + 2, z0);
  world.set(hx0 + 4, y0 + 1, hz0 + 5, BED);
  world.set(hx0 + 5, y0 + 1, hz0 + 5, BED);
  world.set(hx0 + 1, y0 + 1, hz0 + 5, CRAFTING_TABLE);
  if (rand() < 0.7) placeHayStack(world, x0 + 8, y0 + 1, hz1, rand);

  world.structureSites.push({ x: hx0 + 3, y: y0 + 1, z: hz0 + 3, kind: 'cottage' });
}

/**
 * 5. DESERT COURTYARD VILLA (Большая двухэтажная вилла с аркадой, лестницей и садом)
 * Matches the large multi-level sandstone complex in the center of screenshot #2
 * and right-center of screenshot #1:
 * - Open ground-floor sandstone colonnade/loggia,
 * - Protruding Oak Log beams,
 * - Exterior stepped staircase up to a fenced terrace,
 * - Upper story with crenellated parapet & lush green rooftop foliage cascading down.
 */
function buildDesertCourtyardVilla(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 11;
  const d = 10;
  const h1 = 4;
  const h2 = 7;
  prepareDesertFoundation(world, x0, y0, z0, w, d, h2 + 3, SANDSTONE);

  const vx0 = x0 + 1;
  const vx1 = x0 + 9; // 9x8 main footprint
  const vz0 = z0 + 1;
  const vz1 = z0 + 8;

  // --- 1. Ground Floor with Open Front Colonnade (y=1..4) ---
  for (let y = 1; y <= h1; y++) {
    for (let z = vz0; z <= vz1; z++) {
      for (let x = vx0; x <= vx1; x++) {
        const edge = x === vx0 || x === vx1 || z === vz0 || z === vz1;
        if (!edge) {
          if (y === h1) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        // Front wall (z === vz0) has open pillared arches on even x offsets
        if (z === vz0 && y <= 2 && (x - vx0) % 2 === 1) {
          world.set(x, y0 + y, z, AIR);
          continue;
        }
        const corner = (x === vx0 || x === vx1) && (z === vz0 || z === vz1);
        world.set(x, y0 + y, z, y === h1 || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Protruding Oak Log beams along front & sides at y0 + 4
  for (let x = vx0 + 1; x <= vx1 - 1; x += 2) {
    world.set(x, y0 + 4, z0, LOG);
    world.set(x, y0 + 4, z0 + 9, LOG);
  }
  for (let z = vz0 + 1; z <= vz1 - 1; z += 2) {
    world.set(x0, y0 + 4, z, LOG);
    world.set(x0 + 10, y0 + 4, z, LOG);
  }

  // --- 2. Upper Wing on Left Side (vx0..vx0+5, vz0+1..vz1, y=5..7) ---
  for (let y = h1 + 1; y <= h2; y++) {
    for (let z = vz0 + 1; z <= vz1; z++) {
      for (let x = vx0; x <= vx0 + 5; x++) {
        const edge = x === vx0 || x === vx0 + 5 || z === vz0 + 1 || z === vz1;
        if (!edge) {
          if (y === h2) world.set(x, y0 + y, z, GRASS);
          continue;
        }
        const corner = (x === vx0 || x === vx0 + 5) && (z === vz0 + 1 || z === vz1);
        world.set(x, y0 + y, z, y === h2 || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Upper wing windows & rooftop garden parapet (y0 + h2 + 1)
  world.set(vx0 + 2, y0 + h1 + 2, vz0 + 1, FENCE_WOOD);
  world.set(vx0 + 3, y0 + h1 + 2, vz0 + 1, FENCE_WOOD);
  world.set(vx0 + 5, y0 + h1 + 1, vz0 + 4, DOOR_WOOD);
  world.set(vx0 + 5, y0 + h1 + 2, vz0 + 4, DOOR_WOOD);

  for (let z = vz0 + 1; z <= vz1; z++) {
    for (let x = vx0; x <= vx0 + 5; x++) {
      const edge = x === vx0 || x === vx0 + 5 || z === vz0 + 1 || z === vz1;
      if (edge) {
        world.set(x, y0 + h2 + 1, z, (x + z) % 2 === 0 ? SANDSTONE : FENCE_WOOD);
      } else {
        world.set(x, y0 + h2 + 1, z, rand() < 0.55 ? LEAVES : rand() < 0.8 ? TALL_GRASS : FLOWER_YELLOW);
      }
    }
  }

  // --- 3. Right-side Roof Terrace + Cascading Greenery ---
  for (let z = vz0; z <= vz1; z++) {
    for (let x = vx0 + 6; x <= vx1; x++) {
      const edge = x === vx1 || z === vz0 || z === vz1;
      if (edge) {
        world.set(x, y0 + h1 + 1, z, (x + z) % 2 === 0 ? SANDSTONE : FENCE_WOOD);
      } else if (rand() < 0.35) {
        world.set(x, y0 + h1 + 1, z, LEAVES);
      }
    }
  }
  // Cascading green leaves down the front corner pillar
  for (let y = h2 + 1; y >= 2; y--) {
    world.set(vx0, y0 + y, vz0, y >= 4 ? LEAVES : VINE);
  }

  // Interior details + hanging colonnade lanterns + front double street lamp post
  world.set(vx0 + 2, y0 + 1, vz0 + 3, TORCH);
  world.set(vx0 + 3, y0 + 3, vz0 + 1, TORCH);
  world.set(vx0 + 7, y0 + 3, vz0 + 1, TORCH);
  buildDesertDoubleLampPost(world, x0 + 9, y0, z0, false, true);
  world.set(vx0 + 6, y0 + 1, vz0 + 5, BED);
  world.set(vx0 + 7, y0 + 1, vz0 + 5, BED);
  world.set(vx0 + 7, y0 + 1, vz0 + 2, CRAFTING_TABLE);
  world.set(vx0 + 4, y0 + 1, vz0 + 6, PEDESTAL_GOLD);

  world.structureSites.push({ x: vx0 + 4, y: y0 + 1, z: vz0 + 4, kind: 'cottage' });
}

/**
 * 6. DESERT ADOBE COTTAGE WITH SIDE STAIRS & LEAN-TO STALL
 * Matches the foreground house at the bottom-center of 2018-09-18-13-42-01-1537707980_lrg.png:
 * - Clean sandstone cube house with two recessed front windows and an inset flat roof cap,
 * - Lower side terrace with wooden fence railing, trapdoor/shutter screen, and yellow flower bush,
 * - Exterior stepped sandstone stairs climbing the side wall,
 * - Attached wooden lean-to market shed on fence posts.
 */
function buildDesertAdobeCottage(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 10;
  const d = 8;
  const wallH = 4;
  prepareDesertFoundation(world, x0, y0, z0, w, d, wallH + 4, SANDSTONE);

  // Main cube house at x0+1..x0+6, z0+1..z0+6 (6x6)
  const hx0 = x0 + 1;
  const hx1 = x0 + 6;
  const hz0 = z0 + 1;
  const hz1 = z0 + 6;

  for (let y = 1; y <= wallH; y++) {
    for (let z = hz0; z <= hz1; z++) {
      for (let x = hx0; x <= hx1; x++) {
        const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1;
        if (!edge) {
          if (y === wallH) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        const corner = (x === hx0 || x === hx1) && (z === hz0 || z === hz1);
        world.set(x, y0 + y, z, y === wallH || corner ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Inset raised flat roof cap (4x4 at y0 + wallH + 1, exact match to bottom-center house in screenshot!)
  for (let z = hz0 + 1; z <= hz1 - 1; z++) {
    for (let x = hx0 + 1; x <= hx1 - 1; x++) {
      world.set(x, y0 + wallH + 1, z, SANDSTONE);
    }
  }

  // Two recessed front windows + side doorway
  world.set(hx0 + 1, y0 + 2, hz0, GLASS);
  world.set(hx0 + 3, y0 + 2, hz0, GLASS);
  world.set(hx0 + 2, y0 + 1, hz1, DOOR_WOOD);
  world.set(hx0 + 2, y0 + 2, hz1, DOOR_WOOD);

  // Exterior stepped sandstone stairs along the left wall (x = x0)
  for (let step = 0; step < 3; step++) {
    const sz = hz0 + 2 + step;
    const sy = y0 + 1 + step;
    for (let fy = y0 + 1; fy <= sy; fy++) {
      world.set(x0, fy, sz, SANDSTONE);
    }
  }

  // Front-right corner garden terrace with wooden fence railing & yellow flower
  world.set(hx1, y0 + wallH + 1, hz0, FENCE_WOOD);
  world.set(hx1 - 1, y0 + wallH + 1, hz0, FENCE_WOOD);
  world.set(hx1, y0 + wallH + 1, hz0 + 1, FENCE_WOOD);
  world.set(hx1 - 1, y0 + wallH, hz0 + 1, GRASS);
  world.set(hx1 - 1, y0 + wallH + 1, hz0 + 1, FLOWER_YELLOW);
  world.set(hx1, y0 + wallH + 1, hz0 + 2, LEAVES);

  // Attached Lean-To Wooden Market Stall on the right side (x0+7..x0+9, z0+1..z0+5)
  for (let z = hz0; z <= hz0 + 4; z++) {
    world.set(x0 + 7, y0 + 3, z, PLANKS);
    world.set(x0 + 8, y0 + 3, z, PLANKS);
    world.set(x0 + 9, y0 + 2, z, PLANKS);
  }
  world.set(x0 + 9, y0 + 1, hz0, FENCE_WOOD);
  world.set(x0 + 9, y0 + 1, hz0 + 4, FENCE_WOOD);
  world.set(x0 + 8, y0 + 1, hz0 + 1, CRAFTING_TABLE);
  world.set(x0 + 8, y0 + 1, hz0 + 3, HAY_BALE);
  world.set(x0 + 9, y0 + 1, hz0 + 2, LEAVES);

  // Interior + hanging stall lantern + street lamp post by front corner
  world.set(hx0 + 2, y0 + 1, hz0 + 2, TORCH);
  world.set(x0 + 8, y0 + 2, hz0 + 2, TORCH);
  buildDesertSingleLampPost(world, x0 + 8, y0, z0 + 6, -1, 0);
  world.set(hx0 + 3, y0 + 1, hz0 + 4, BED);
  world.set(hx0 + 4, y0 + 1, hz0 + 4, BED);
  if (rand() < 0.6) world.set(hx0 + 1, y0 + 1, hz0 + 4, PEDESTAL_GOLD);

  world.structureSites.push({ x: hx0 + 2, y: y0 + 1, z: hz0 + 3, kind: 'cottage' });
}

/**
 * 7. DESERT OASIS PERGOLA FARM (Деревянная пергола-оазис с грядками и листвой)
 * Matches the timber-beam pergola gardens in the bottom-left of screenshot #1
 * and bottom-right of screenshot #2:
 * - Oak Log pillars supporting an overhead trellis grid of Oak Logs & Planks,
 * - Lush green Leaves & hanging Vines draped across the overhead beams,
 * - Irrigated water channels and green crop rows underneath.
 */
function buildDesertPergolaFarm(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 9;
  const d = 8;
  prepareDesertFoundation(world, x0, y0, z0, w, d, 6, SANDSTONE);

  // --- 1. Irrigated Farmland & Water Channels at y0 ---
  for (let z = z0 + 1; z <= z0 + d - 2; z++) {
    for (let x = x0 + 1; x <= x0 + w - 2; x++) {
      if (z === z0 + 3) {
        world.set(x, y0 - 1, z, SANDSTONE);
        world.set(x, y0, z, WATER);
      } else {
        world.set(x, y0, z, GRASS);
        const r = rand();
        const crop = r < 0.5 ? TALL_GRASS : r < 0.78 ? FERN : r < 0.9 ? FLOWER_YELLOW : FLOWER_RED;
        world.set(x, y0 + 1, z, crop);
      }
    }
  }

  // --- 2. Timber-Beam Pergola Pillars (Oak Logs at corners & midpoints, y=1..3) ---
  const pillarXs = [x0, x0 + 4, x0 + w - 1];
  const pillarZs = [z0, z0 + 3, z0 + d - 1];
  for (const pz of pillarZs) {
    for (const px of pillarXs) {
      for (let y = 1; y <= 3; y++) {
        world.set(px, y0 + y, pz, LOG);
      }
    }
  }

  // --- 3. Overhead Timber Trellis Grid (y0 + 4) + Draped Green Foliage (y0 + 4..5) ---
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      const onBeamX = x === x0 || x === x0 + 4 || x === x0 + w - 1;
      const onBeamZ = z === z0 || z === z0 + 3 || z === z0 + d - 1;
      if (onBeamX || onBeamZ) {
        world.set(x, y0 + 4, z, onBeamX && onBeamZ ? LOG : PLANKS);
        if (rand() < 0.45) {
          world.set(x, y0 + 5, z, LEAVES);
        }
      } else if (rand() < 0.55) {
        world.set(x, y0 + 4, z, LEAVES);
        if (rand() < 0.35) world.set(x, y0 + 5, z, LEAVES);
      }
    }
  }

  // Hanging vines & chain-suspended lanterns under the pergola (matching top-center of maxresdefault.jpg!)
  world.set(x0 + 2, y0 + 3, z0 + 3, FENCE_IRON);
  world.set(x0 + 2, y0 + 2, z0 + 3, TORCH);
  world.set(x0 + 6, y0 + 3, z0 + 3, TORCH);
  world.set(x0, y0 + 3, z0 + 2, VINE);
  world.set(x0 + w - 1, y0 + 3, z0 + 5, VINE);
  placeHayStack(world, x0 + w - 2, y0 + 1, z0, rand);
}

/**
 * 8. DESERT VILLAGE WELL & OASIS PLAZA (Колодец под деревянным навесом с оазисным деревом)
 * Matches the central village well right beside the minaret tower in screenshot #1:
 * - Sandstone & Chiseled Sandstone water well with wooden fence corner posts,
 * - Sloped wooden/sandstone canopy roof,
 * - Custom crooked Desert Oasis Tree shading the well plaza.
 */
function buildDesertWellPavilion(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 8;
  const d = 8;
  prepareDesertFoundation(world, x0, y0, z0, w, d, 8, SAND);

  const cx = x0 + 3;
  const cz = z0 + 3;

  // Paved sandstone plaza around the well
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      world.set(cx + dx, y0, cz + dz, (dx + dz) % 2 === 0 ? SANDSTONE : CHISELED_SANDSTONE);
    }
  }

  // 3x3 Well Curb + Water Basin
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) {
        world.set(cx, y0 - 1, cz, SANDSTONE);
        world.set(cx, y0, cz, WATER);
        world.set(cx, y0 + 1, cz, WATER);
      } else {
        world.set(cx + dx, y0 + 1, cz + dz, Math.abs(dx) === 1 && Math.abs(dz) === 1 ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // 4 Wooden Fence Posts + Shaded Canopy Roof (y0 + 2..4)
  for (const [px, pz] of [
    [cx - 1, cz - 1],
    [cx + 1, cz - 1],
    [cx - 1, cz + 1],
    [cx + 1, cz + 1],
  ]) {
    world.set(px, y0 + 2, pz, FENCE_WOOD);
    world.set(px, y0 + 3, pz, FENCE_WOOD);
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.set(cx + dx, y0 + 4, cz + dz, dx === 0 && dz === 0 ? SANDSTONE : PLANKS);
    }
  }
  // Hanging lantern under the well canopy + Double T-Bar Street Lamp on the plaza
  world.set(cx, y0 + 3, cz, TORCH);
  buildDesertDoubleLampPost(world, x0 + 1, y0, z0 + 1, true, true);

  // Custom Desert Oasis Tree growing right next to the well (exact match to screenshot!)
  buildDesertOasisTree(world, x0 + 6, y0 + 1, z0 + 6, rand);
  placeHayStack(world, x0 + 1, y0 + 1, z0 + 6, rand);

  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'cottage' });
}

/**
 * 9. DESERT BAZAAR ROW (Торговые лавки с деревянными навесами и тюками сена)
 * Matches the open-air wooden market stalls along the sandy village streets.
 */
function buildDesertBazaarRow(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 8;
  const d = 7;
  prepareDesertFoundation(world, x0, y0, z0, w, d, 6, SAND);

  // Sandstone counter & wooden awning stall
  for (let z = z0 + 1; z <= z0 + 5; z++) {
    for (let x = x0 + 1; x <= x0 + 6; x++) {
      world.set(x, y0, z, (x + z) % 2 === 0 ? SANDSTONE : CHISELED_SANDSTONE);
    }
  }

  // Back sandstone wall + side fence posts
  for (let x = x0 + 1; x <= x0 + 6; x++) {
    world.set(x, y0 + 1, z0 + 5, SANDSTONE);
    world.set(x, y0 + 2, z0 + 5, x % 2 === 0 ? CHISELED_SANDSTONE : SANDSTONE);
    world.set(x, y0 + 3, z0 + 5, LOG);
  }
  for (const px of [x0 + 1, x0 + 6]) {
    world.set(px, y0 + 1, z0 + 1, FENCE_WOOD);
    world.set(px, y0 + 2, z0 + 1, FENCE_WOOD);
    world.set(px, y0 + 1, z0 + 3, FENCE_WOOD);
    world.set(px, y0 + 2, z0 + 3, FENCE_WOOD);
  }

  // Sloped wooden plank canopy roof (y0 + 4 at rear, y0 + 3 at front)
  for (let x = x0 + 1; x <= x0 + 6; x++) {
    world.set(x, y0 + 4, z0 + 4, PLANKS);
    world.set(x, y0 + 4, z0 + 3, PLANKS);
    world.set(x, y0 + 3, z0 + 2, PLANKS);
    world.set(x, y0 + 3, z0 + 1, PLANKS);
  }

  // Merchant counters, crates, greenery, hay bales & hanging awning lanterns
  world.set(x0 + 2, y0 + 1, z0 + 2, CHISELED_SANDSTONE);
  world.set(x0 + 3, y0 + 1, z0 + 2, CRAFTING_TABLE);
  world.set(x0 + 4, y0 + 1, z0 + 2, PEDESTAL_GOLD);
  placeHayStack(world, x0 + 5, y0 + 1, z0 + 4, rand);
  world.set(x0 + 2, y0 + 3, z0 + 3, TORCH);
  world.set(x0 + 5, y0 + 3, z0 + 3, TORCH);
  buildDesertSingleLampPost(world, x0, y0, z0 + 1, 1, 0);
  world.set(x0 + 7, y0 + 1, z0 + 4, LEAVES);
  world.set(x0 + 7, y0 + 2, z0 + 4, LEAVES);
}

/**
 * 10. DESERT TEMPLE (Монументальный храм пустыни с двумя башнями и тайником)
 * Spawns as a rare desert landmark outside the village clusters.
 */
function buildDesertTemple(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 13;
  const d = 13;
  prepareDesertFoundation(world, x0, y0, z0, w, d, 11, SANDSTONE);

  const cx = x0 + 6;
  const cz = z0 + 7;

  // Interior floor mosaic
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const manhattan = Math.abs(dx) + Math.abs(dz);
      if (manhattan === 0) world.set(cx + dx, y0, cz + dz, CHISELED_SANDSTONE);
      else if (manhattan === 1 || manhattan === 3) world.set(cx + dx, y0, cz + dz, TERRACOTTA_ORANGE);
      else if (Math.abs(dx) === 2 && Math.abs(dz) === 2) world.set(cx + dx, y0, cz + dz, TERRACOTTA_ORANGE);
    }
  }

  // Stepped pyramid main chamber
  for (let y = 1; y <= 4; y++) {
    const wallMat = y === 3 ? CHISELED_SANDSTONE : y === 4 ? TERRACOTTA_ORANGE : SANDSTONE;
    for (let x = x0; x < x0 + w; x++) {
      for (let z = z0 + 2; z < z0 + d; z++) {
        const edge = x === x0 || x === x0 + w - 1 || z === z0 + 2 || z === z0 + d - 1;
        if (edge) world.set(x, y0 + y, z, y === 4 && (x + z) % 2 === 0 ? SANDSTONE : wallMat);
      }
    }
  }
  for (let step = 1; step <= 4; step++) {
    const py = y0 + 4 + step;
    const xMin = x0 + step;
    const xMax = x0 + w - 1 - step;
    const zMin = z0 + 2 + step;
    const zMax = z0 + d - 1 - step;
    for (let z = zMin; z <= zMax; z++) {
      for (let x = xMin; x <= xMax; x++) {
        const edge = x === xMin || x === xMax || z === zMin || z === zMax;
        if (edge || step === 4) {
          const mat = step === 2 && (x === xMin || x === xMax) ? TERRACOTTA_ORANGE : step === 4 ? CHISELED_SANDSTONE : SANDSTONE;
          world.set(x, py, z, mat);
        }
      }
    }
  }
  world.set(cx, y0 + 8, cz, AIR);

  // Twin Front Pylon Towers
  const towerH = 8;
  for (const tx0 of [x0, x0 + 9]) {
    for (let y = 1; y <= towerH; y++) {
      for (let tz = z0; tz < z0 + 4; tz++) {
        for (let tx = tx0; tx < tx0 + 4; tx++) {
          const edge = tx === tx0 || tx === tx0 + 3 || tz === z0 || tz === z0 + 3;
          if (!edge && y < towerH) {
            world.set(tx, y0 + y, tz, AIR);
            continue;
          }
          let mat = y === towerH - 1 ? CHISELED_SANDSTONE : SANDSTONE;
          const lx = tx - tx0;
          if (tz === z0 && (lx === 1 || lx === 2)) {
            if (y === 2 || y === 3 || y === 5 || y === 7) mat = TERRACOTTA_ORANGE;
            else if (y === 6) mat = CHISELED_SANDSTONE;
          }
          if (tz === z0 && (lx === 0 || lx === 3) && (y === 4 || y === 6)) {
            mat = TERRACOTTA_ORANGE;
          }
          world.set(tx, y0 + y, tz, mat);
        }
      }
    }
    for (let tz = z0; tz < z0 + 4; tz++) {
      for (let tx = tx0; tx < tx0 + 4; tx++) {
        const edge = tx === tx0 || tx === tx0 + 3 || tz === z0 || tz === z0 + 3;
        const corner = (tx === tx0 || tx === tx0 + 3) && (tz === z0 || tz === z0 + 3);
        if (edge && (corner || (tx + tz) % 2 === 0)) {
          world.set(tx, y0 + towerH + 1, tz, corner ? CHISELED_SANDSTONE : SANDSTONE);
        }
      }
    }
  }

  // Central Entrance Portal + flanking stone pillar lanterns
  for (let y = 1; y <= 5; y++) {
    for (let x = x0 + 4; x <= x0 + 8; x++) {
      world.set(x, y0 + y, z0 + 1, y === 4 ? CHISELED_SANDSTONE : SANDSTONE);
    }
  }
  for (let z = z0; z <= z0 + 3; z++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      world.set(x, y0 + 1, z, AIR);
      world.set(x, y0 + 2, z, AIR);
    }
  }
  placeWallBracketLantern(world, x0 + 4, y0 + 2, z0);
  placeWallBracketLantern(world, x0 + 8, y0 + 2, z0);
  // Interior temple lanterns resting on carved sandstone pedestals
  world.set(cx - 2, y0 + 1, cz, CHISELED_SANDSTONE);
  world.set(cx - 2, y0 + 2, cz, TORCH);
  world.set(cx + 2, y0 + 1, cz, CHISELED_SANDSTONE);
  world.set(cx + 2, y0 + 2, cz, TORCH);

  // Underground treasure room
  const vaultDepth = Math.min(4, Math.max(2, y0 - 3));
  if (vaultDepth >= 2) {
    const vy = y0 - vaultDepth;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.set(cx + dx, vy - 1, cz + dz, SANDSTONE);
        for (let y = vy; y < y0; y++) world.set(cx + dx, y, cz + dz, AIR);
      }
    }
    world.set(cx - 1, vy, cz, GOLD_BLOCK);
    world.set(cx + 1, vy, cz, rand() < 0.65 ? DIAMOND_BLOCK : EMERALD_BLOCK);
    world.set(cx, vy, cz + 1, PEDESTAL_GOLD);
    world.set(cx, vy, cz - 1, TORCH);
  }

  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

export const DESERT_BUILDING_ASSETS: readonly DesertAssetDef[] = [
  { id: 'desert_minaret_tower', name: 'Desert Minaret Watchtower', width: 9, depth: 9, weight: 10, build: buildDesertMinaretTower },
  { id: 'desert_stepped_balcony_house', name: 'Desert Stepped Balcony House', width: 10, depth: 9, weight: 12, build: buildDesertSteppedBalconyHouse },
  { id: 'desert_beam_garden_house', name: 'Desert Timber-Beam Garden House', width: 10, depth: 10, weight: 12, build: buildDesertBeamGardenHouse },
  { id: 'desert_pergola_house', name: 'Desert Lattice Pergola House', width: 9, depth: 9, weight: 10, build: buildDesertPergolaHouse },
  { id: 'desert_courtyard_villa', name: 'Desert Courtyard Villa', width: 11, depth: 10, weight: 10, build: buildDesertCourtyardVilla },
  { id: 'desert_adobe_cottage', name: 'Desert Adobe Cottage & Stall', width: 10, depth: 8, weight: 10, build: buildDesertAdobeCottage },
  { id: 'desert_pergola_farm', name: 'Desert Oasis Pergola Farm', width: 9, depth: 8, weight: 8, build: buildDesertPergolaFarm },
  { id: 'desert_well_pavilion', name: 'Desert Village Well Pavilion', width: 8, depth: 8, weight: 8, build: buildDesertWellPavilion },
  { id: 'desert_bazaar_row', name: 'Desert Street Bazaar Row', width: 8, depth: 7, weight: 8, build: buildDesertBazaarRow },
  { id: 'desert_temple', name: 'Desert Temple', width: 13, depth: 13, weight: 7, build: buildDesertTemple },
  { id: 'desert_gable_pergola_house', name: 'Desert Two-Story Gable & Pergola House', width: 11, depth: 10, weight: 12, build: buildDesertGablePergolaHouse },
  { id: 'desert_tiered_lantern_villa', name: 'Desert Tiered Rooftop-Planter Villa', width: 11, depth: 10, weight: 12, build: buildDesertTieredLanternVilla },
  { id: 'desert_oasis_lagoon', name: 'Lush Desert Oasis Lagoon', width: 15, depth: 15, weight: 14, build: buildDesertOasisLagoon },
  { id: 'pyramid_stepped_maya', name: 'Stepped Mayan Terracotta Pyramid', width: 15, depth: 15, weight: 9, build: buildPyramidSteppedMaya },
  { id: 'pyramid_lava_horus', name: 'Lava-Channel & Eye of Horus Pyramid', width: 15, depth: 15, weight: 9, build: buildPyramidLavaHorus },
  { id: 'pyramid_skull_gate', name: 'Skull-Gate Pyramid & Twin Brazier Towers', width: 15, depth: 15, weight: 9, build: buildPyramidSkullGate },
  { id: 'pyramid_pharaoh_red', name: 'Red-Striped Pharaoh Pyramid & Statues', width: 15, depth: 15, weight: 9, build: buildPyramidPharaohRed },
  { id: 'pyramid_babylon_colonnade', name: 'Colonnaded Ziggurat Temple-Pyramid', width: 15, depth: 15, weight: 8, build: buildPyramidBabylonColonnade },
  { id: 'sphinx_monument', name: 'Great Pharaoh Sphinx Monument', width: 13, depth: 15, weight: 9, build: buildGreatSphinxMonument },
  { id: 'obelisk_avenue', name: 'Grand Obelisk & Anubis Avenue Court', width: 15, depth: 15, weight: 8, build: buildObeliskAvenueCourt },
  { id: 'aladdin_red_fortress', name: 'Aladdin Red & Sandstone Fortress Palace', width: 15, depth: 15, weight: 9, build: buildAladdinRedFortress },
  { id: 'aladdin_blue_dome_palace', name: 'Aladdin Blue-Dome Agrabah Palace', width: 15, depth: 15, weight: 9, build: buildAladdinBlueDomePalace },
  { id: 'desert_oasis_sanctuary', name: 'Four-Minaret Oasis Tree Sanctuary', width: 15, depth: 15, weight: 8, build: buildDesertOasisSanctuary },
  { id: 'giant_desert_skull', name: 'Colossal Half-Buried Desert Skull', width: 13, depth: 13, weight: 8, build: buildGiantDesertSkull },
  { id: 'ruined_desert_castle', name: 'Half-Ruined Castle & Creeper Watchtower', width: 15, depth: 15, weight: 8, build: buildRuinedDesertCastle },
];

function getAsset(id: DesertAssetId): DesertAssetDef {
  return DESERT_BUILDING_ASSETS.find((a) => a.id === id) ?? DESERT_BUILDING_ASSETS[0];
}

function pickWeightedDesertAsset(rand: () => number): DesertAssetDef {
  const total = DESERT_BUILDING_ASSETS.reduce((acc, a) => acc + a.weight, 0);
  let r = rand() * total;
  for (const a of DESERT_BUILDING_ASSETS) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return DESERT_BUILDING_ASSETS[0];
}

/**
 * 3x3 Desert Village layout combining classic and new multi-story desert houses:
 */
const VILLAGE_3X3_LAYOUT: Record<string, DesertAssetId> = {
  '0,0': 'desert_minaret_tower',
  '-1,0': 'desert_gable_pergola_house',
  '1,0': 'desert_beam_garden_house',
  '0,-1': 'desert_well_pavilion',
  '0,1': 'desert_tiered_lantern_villa',
  '-1,-1': 'desert_pergola_farm',
  '1,-1': 'desert_stepped_balcony_house',
  '-1,1': 'desert_adobe_cottage',
  '1,1': 'desert_courtyard_villa',
};

/**
 * Outer ring (|sdx| === 2 || |sdz| === 2) around the starter village so players
 * can explore Oases, Sphinx & Pyramid Complexes, Aladdin Palaces, Giant Skulls,
 * Ruined Castles, and Cliff-Carved Mountain Cave Temples within walking distance!
 */
const STARTER_OUTER_RING_LAYOUT: Record<string, DesertAssetId> = {
  // East: Full Sphinx + Obelisk Avenue + Stepped Pyramid Complex
  '2,-1': 'sphinx_monument',
  '2,0': 'obelisk_avenue',
  '2,1': 'pyramid_stepped_maya',
  // West: Flat Desert Oasis Lagoon + Giant Skull + Ruined Castle
  '-2,0': 'desert_oasis_lagoon',
  '-2,1': 'giant_desert_skull',
  '-2,-1': 'ruined_desert_castle',
  // South: Valley of the Pyramids (Skull-Gate, Lava Eye of Horus, Red Pharaoh)
  '-1,2': 'pyramid_skull_gate',
  '0,2': 'pyramid_lava_horus',
  '1,2': 'pyramid_pharaoh_red',
  '-2,2': 'pyramid_babylon_colonnade',
  // North: Aladdin Castles & Oasis Sanctuary
  '-1,-2': 'aladdin_red_fortress',
  '0,-2': 'aladdin_blue_dome_palace',
  '1,-2': 'desert_oasis_sanctuary',
};

const PYRAMID_VARIETIES: readonly DesertAssetId[] = [
  'pyramid_stepped_maya',
  'pyramid_lava_horus',
  'pyramid_skull_gate',
  'pyramid_pharaoh_red',
  'pyramid_babylon_colonnade',
];

/**
 * Detect whether chunk (cx, cz) sits on a transition between desert and
 * mountains / canyon / elevated highlands so we can carve a cliffside temple
 * with a deep cave entrance into the mountain face.
 */
export function isDesertMountainTransition(world: World, cx: number, cz: number): boolean {
  const x = cx * CHUNK + 8;
  const z = cz * CHUNK + 8;
  const centerBiome = world.biomeAt(x, z);
  let hasDesert = centerBiome === 'desert';
  let hasHighlandOrBorder = centerBiome !== 'desert';
  let minH = Infinity;
  let maxH = -Infinity;

  for (const [ox, oz] of [
    [0, 0],
    [-14, 0],
    [14, 0],
    [0, -14],
    [0, 14],
  ]) {
    const h = world.heightAt(x + ox, z + oz);
    const b = world.biomeAt(x + ox, z + oz, h);
    if (b === 'desert') hasDesert = true;
    if (b === 'canyon' || b === 'volcanic' || b === 'plains' || h >= SEA + 8) {
      hasHighlandOrBorder = true;
    }
    minH = Math.min(minH, h);
    maxH = Math.max(maxH, h);
  }
  return hasDesert && (hasHighlandOrBorder || maxH - minH >= 4);
}

/**
 * Regional Desert Generator:
 * Divides the desert into distinct sub-regions:
 * 1. Starter Village + Outer Ring of Monuments (Sphinx Complex, Pyramids, Oasis, Aladdin Palaces, Cliff Temples),
 * 2. Mountain-Border Cliff-Carved Cave Temples (Petra Treasury, Twin-Tower Gatehouse, Hanging Vine Monastery),
 * 3. Desert Villages (3x3 settlements),
 * 4. Flat Desert Plains with Lush Oases, Half-Ruined Castles & Giant Skulls,
 * 5. Full Sphinx + Obelisk Avenue + Pyramid Monumental Complexes,
 * 6. Aladdin Castles & Four-Minaret Oasis Sanctuaries.
 */
export function spawnDesertBiomeStructures(world: World, cx: number, cz: number, rand: () => number): boolean {
  const centerX = cx * CHUNK + 8;
  const centerZ = cz * CHUNK + 8;
  const scx = Math.floor(ORIGIN_X / CHUNK);
  const scz = Math.floor(ORIGIN_Z / CHUNK);
  const sdx = cx - scx;
  const sdz = cz - scz;

  // --- 1. Starter Desert Village (|sdx| <= 1 && |sdz| <= 1) ---
  if (Math.abs(sdx) <= 1 && Math.abs(sdz) <= 1) {
    const starterId = VILLAGE_3X3_LAYOUT[`${sdx},${sdz}`];
    if (starterId) {
      const asset = getAsset(starterId);
      const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, true);
      if (spot) {
        asset.build(world, spot[0], spot[1], spot[2], rand);
        decorateVillageStreet(world, cx, cz, spot[0], spot[1], spot[2], asset.width, asset.depth, rand);
        return true;
      }
    }
  }

  // --- 2. Starter Outer Ring of Landmarks, Oases, Pyramids, Sphinxes & Cliff Temples ---
  if (Math.max(Math.abs(sdx), Math.abs(sdz)) === 2) {
    // Corner cliff-carved cave temples at (2, -2), (-2, -2), (2, 2)
    if ((sdx === 2 && sdz === -2) || (sdx === -2 && sdz === -2) || (sdx === 2 && sdz === 2)) {
      return buildCliffsideCarvedTemple(world, cx, cz, rand);
    }
    const ringId = STARTER_OUTER_RING_LAYOUT[`${sdx},${sdz}`];
    if (ringId) {
      const asset = getAsset(ringId);
      const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, true);
      if (spot) {
        asset.build(world, spot[0], spot[1], spot[2], rand);
        if (ringId !== 'desert_oasis_lagoon') {
          decorateVillageStreet(world, cx, cz, spot[0], spot[1], spot[2], asset.width, asset.depth, rand);
        }
        return true;
      }
    }
  }

  if (world.biomeAt(centerX, centerZ) !== 'desert') return false;

  // --- 3. Cliff-Carved Mountain Cave Temples where Desert transitions into Mountains/Highlands ---
  if (isDesertMountainTransition(world, cx, cz) && rand() < 0.48) {
    if (buildCliffsideCarvedTemple(world, cx, cz, rand)) return true;
  }

  // --- 4. Regional Sub-Biome Zoning (4x4 chunk regions) ---
  const regX = Math.floor(cx / 4);
  const regZ = Math.floor(cz / 4);
  const regRng = mulberry32(world.seed ^ Math.imul(regX, 73856093) ^ Math.imul(regZ, 19349663) ^ 0x5d39a1);
  const zoneRoll = regRng();
  const vcx = regX * 4 + 1 + Math.floor(regRng() * 2);
  const vcz = regZ * 4 + 1 + Math.floor(regRng() * 2);
  const dx = cx - vcx;
  const dz = cz - vcz;

  if (zoneRoll < 0.24) {
    // ZONE A: Desert Village Settlement (3x3 cluster)
    if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
      let chosenId = VILLAGE_3X3_LAYOUT[`${dx},${dz}`] ?? 'desert_beam_garden_house';
      if (dx === 1 && dz === 1 && rand() < 0.45) chosenId = 'desert_bazaar_row';
      const asset = getAsset(chosenId);
      const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, true);
      if (spot) {
        asset.build(world, spot[0], spot[1], spot[2], rand);
        decorateVillageStreet(world, cx, cz, spot[0], spot[1], spot[2], asset.width, asset.depth, rand);
        return true;
      }
    }
  } else if (zoneRoll < 0.52) {
    // ZONE B: Flat Desert Plains with Lush Oases, Ruined Castles & Giant Skulls
    let plainId: DesertAssetId | null = null;
    if (dx === 0 && dz === 0) plainId = 'desert_oasis_lagoon';
    else if (dx === 1 && dz === 0 && regRng() < 0.65) plainId = 'desert_oasis_lagoon';
    else if (dx === -1 && dz === 1) plainId = 'giant_desert_skull';
    else if (dx === 1 && dz === -1) plainId = 'ruined_desert_castle';

    if (plainId) {
      const asset = getAsset(plainId);
      const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, true);
      if (spot) {
        asset.build(world, spot[0], spot[1], spot[2], rand);
        return true;
      }
    }
  } else if (zoneRoll < 0.78) {
    // ZONE C: Monumental Sphinx + Obelisk Avenue + Pyramid Complex
    const mainPyr = PYRAMID_VARIETIES[Math.floor(regRng() * PYRAMID_VARIETIES.length)];
    const secondPyr = PYRAMID_VARIETIES[Math.floor(regRng() * PYRAMID_VARIETIES.length)];
    let complexId: DesertAssetId | null = null;
    if (dx === 0 && dz === -1) complexId = 'sphinx_monument';
    else if (dx === 0 && dz === 0) complexId = 'obelisk_avenue';
    else if (dx === 0 && dz === 1) complexId = mainPyr;
    else if (dx === 1 && dz === 1) complexId = secondPyr;
    else if (dx === -1 && dz === 0 && regRng() < 0.7) complexId = 'sphinx_monument';

    if (complexId) {
      const asset = getAsset(complexId);
      const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, true);
      if (spot) {
        asset.build(world, spot[0], spot[1], spot[2], rand);
        decorateVillageStreet(world, cx, cz, spot[0], spot[1], spot[2], asset.width, asset.depth, rand);
        return true;
      }
    }
  } else {
    // ZONE D: Aladdin Castles, Blue-Dome Palaces & Four-Minaret Oasis Sanctuaries
    let palaceId: DesertAssetId | null = null;
    if (dx === 0 && dz === 0) palaceId = 'aladdin_blue_dome_palace';
    else if (dx === 1 && dz === 0) palaceId = 'aladdin_red_fortress';
    else if (dx === 0 && dz === 1) palaceId = 'desert_oasis_sanctuary';
    else if (dx === -1 && dz === -1) palaceId = 'desert_oasis_lagoon';

    if (palaceId) {
      const asset = getAsset(palaceId);
      const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, true);
      if (spot) {
        asset.build(world, spot[0], spot[1], spot[2], rand);
        if (palaceId !== 'desert_oasis_lagoon') {
          decorateVillageStreet(world, cx, cz, spot[0], spot[1], spot[2], asset.width, asset.depth, rand);
        }
        return true;
      }
    }
  }

  // --- 5. Rare Standalone Desert Landmarks across Remaining Open Chunks ---
  if (rand() < 0.14) {
    const asset = pickWeightedDesertAsset(rand);
    const spot = findDesertSpotInChunk(world, cx, cz, asset.width, asset.depth, rand, false);
    if (spot) {
      asset.build(world, spot[0], spot[1], spot[2], rand);
      return true;
    }
  }
  return false;
}
