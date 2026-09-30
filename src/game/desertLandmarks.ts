import {
  AIR,
  BED,
  CAMPFIRE,
  CHISELED_SANDSTONE,
  COAL,
  COBBLE,
  CRAFTING_TABLE,
  DIAMOND,
  DIAMOND_BLOCK,
  DIRT,
  DOOR_WOOD,
  DRY_BLOOM,
  FENCE_IRON,
  FENCE_STONE,
  FENCE_WOOD,
  FERN,
  FLOWER_BLUE,
  FLOWER_RED,
  FLOWER_YELLOW,
  GOLD,
  GOLD_BLOCK,
  GRASS,
  HAY_BALE,
  IRON,
  LAMP_BLUE,
  LAMP_RED,
  LAMP_YELLOW,
  LAVA,
  LEAVES,
  LOG,
  PEDESTAL_GOLD,
  PLANKS,
  SAND,
  SANDSTONE,
  STONE,
  TALL_GRASS,
  TERRACOTTA_ORANGE,
  TORCH,
  VINE,
  VOLCANIC_STONE,
  WATER,
} from './blocks';
import { CHUNK, WY, World } from './world';

/**
 * Prepare a clean, level foundation pad in the desert or cliffside,
 * filling air gaps underneath so monuments never float over dunes.
 */
function prepareFoundation(
  world: World,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  d: number,
  clearH: number,
  floorBlock = SANDSTONE,
) {
  for (let z = z0 - 1; z <= z0 + d; z++) {
    for (let x = x0 - 1; x <= x0 + w; x++) {
      const inFootprint = x >= x0 && x < x0 + w && z >= z0 && z < z0 + d;
      for (let y = y0 + 1; y < Math.min(WY - 1, y0 + clearH); y++) {
        world.set(x, y, z, AIR);
      }
      if (inFootprint) {
        world.set(x, y0, z, floorBlock);
      } else if (world.get(x, y0, z) === AIR) {
        world.set(x, y0, z, SAND);
      }
      let fy = y0 - 1;
      let depth = 0;
      while (fy > 1 && depth < 12) {
        const cur = world.get(x, fy, z);
        if (cur !== AIR && cur !== WATER && cur !== LAVA) break;
        world.set(x, fy, z, inFootprint ? SANDSTONE : SAND);
        fy--;
        depth++;
      }
    }
  }
}

/**
 * 1. LUSH DESERT OASIS LAGOON (Оазис в равнинной пустыне)
 * Matches 7b4df2abf339f97ca088d8d78b4231b6.webp and 25011923175cc7e12bb3e728f3353e53.jpg:
 * - Natural multi-lobed turquoise water pool recessed into a sealed sandstone/sand basin,
 * - Lush green GRASS shoreline ring with tall grass, ferns, and desert wildflowers,
 * - 3–4 curved Date Palms leaning over the lagoon,
 * - Multi-armed Saguaro & flowering cacti on the outer sandy rim.
 */
export function buildDesertOasisLagoon(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 14, SAND);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Carve a two-lobed natural oasis lagoon with sealed bottom and banks
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx1 = (x - (cx - 1)) / 4.3;
      const dz1 = (z - (cz - 0.5)) / 3.8;
      const dx2 = (x - (cx + 2)) / 3.5;
      const dz2 = (z - (cz + 1.5)) / 3.4;
      const dist = Math.min(dx1 * dx1 + dz1 * dz1, dx2 * dx2 + dz2 * dz2);

      // Seal underneath down to y0 - 3 so oasis water never leaks into caves
      for (let sy = Math.max(2, y0 - 3); sy <= y0; sy++) {
        world.set(x, sy, z, sy === y0 ? SAND : SANDSTONE);
      }

      if (dist < 0.62) {
        // Deep turquoise water center (2 blocks deep)
        world.set(x, y0 - 2, z, SANDSTONE);
        world.set(x, y0 - 1, z, WATER);
        world.set(x, y0, z, WATER);
      } else if (dist < 0.96) {
        // Shallow water shelf
        world.set(x, y0 - 1, z, SAND);
        world.set(x, y0, z, WATER);
      } else if (dist < 1.48) {
        // Lush green oasis bank around the water
        world.set(x, y0, z, rand() < 0.82 ? GRASS : SANDSTONE);
        if (world.get(x, y0, z) === GRASS && rand() < 0.55) {
          const roll = rand();
          world.set(
            x,
            y0 + 1,
            z,
            roll < 0.45
              ? TALL_GRASS
              : roll < 0.72
                ? FERN
                : roll < 0.86
                  ? FLOWER_RED
                  : roll < 0.94
                    ? FLOWER_YELLOW
                    : FLOWER_BLUE,
          );
        }
      } else {
        // Outer sandy rim with occasional sandstone boulders
        world.set(x, y0, z, SAND);
        if (rand() < 0.08) {
          world.set(x, y0 + 1, z, SANDSTONE);
        } else if (rand() < 0.14) {
          world.set(x, y0 + 1, z, DRY_BLOOM);
        }
      }
    }
  }

  // Small sandstone water-steps / oasis pier on the front bank
  world.set(cx, y0, z0 + 2, CHISELED_SANDSTONE);
  world.set(cx + 1, y0, z0 + 2, SANDSTONE);
  world.set(cx - 1, y0 + 1, z0 + 2, FENCE_WOOD);
  world.set(cx - 1, y0 + 2, z0 + 2, TORCH);

  // Curved Date Palms around the oasis bank
  const palmSpots: Array<[number, number]> = [
    [x0 + 3, z0 + 3],
    [x0 + 11, z0 + 4],
    [x0 + 4, z0 + 11],
    [x0 + 11, z0 + 11],
  ];
  for (const [px, pz] of palmSpots) {
    world.set(px, y0, pz, GRASS);
    world.set(px, y0 + 1, pz, AIR);
    world.growPalm(px, y0 + 1, pz, rand);
  }

  // Multi-arm Saguaro & flowering cacti on the outer desert edge of the oasis
  const cactusSpots: Array<[number, number]> = [
    [x0 + 1, z0 + 7],
    [x0 + 13, z0 + 8],
    [x0 + 7, z0 + 13],
  ];
  for (const [kx, kz] of cactusSpots) {
    world.set(kx, y0, kz, SAND);
    world.set(kx, y0 + 1, kz, AIR);
    world.growCactus(kx, y0 + 1, kz, rand);
  }
}

/**
 * 2. TWO-STORY GABLE & PERGOLA HOUSE (Двухэтажный дом с деревянной крышей, лозой и перголой)
 * Matches Image 2:
 * - Sandstone walls with oak log frame & protruding timber studs,
 * - Stepped dark-wood gable roof with overhanging eaves,
 * - Window flowerboxes & hanging 3D lanterns,
 * - Climbing leaf & vine patch on the facade,
 * - Attached wooden pergola shading an irrigated garden plot.
 */
export function buildDesertGablePergolaHouse(world: World, x0: number, y0: number, z0: number, _rand: () => number) {
  const w = 11;
  const d = 10;
  prepareFoundation(world, x0, y0, z0, w, d, 12, SANDSTONE);

  const hx0 = x0 + 1;
  const hx1 = x0 + 6; // 6-wide 2-story house
  const hz0 = z0 + 1;
  const hz1 = z0 + 8;

  // Ground & Second Floor walls (y=1..6)
  for (let y = 1; y <= 6; y++) {
    for (let z = hz0; z <= hz1; z++) {
      for (let x = hx0; x <= hx1; x++) {
        const edge = x === hx0 || x === hx1 || z === hz0 || z === hz1;
        const corner = (x === hx0 || x === hx1) && (z === hz0 || z === hz1);
        if (!edge) {
          if (y === 3) world.set(x, y0 + y, z, PLANKS);
          continue;
        }
        if (corner) {
          world.set(x, y0 + y, z, LOG);
        } else if (y === 3) {
          world.set(x, y0 + y, z, CHISELED_SANDSTONE);
        } else {
          world.set(x, y0 + y, z, SANDSTONE);
        }
      }
    }
  }

  // Stepped wooden gable roof with 1-block eaves overhang (y=7..9)
  for (let z = hz0 - 1; z <= hz1 + 1; z++) {
    for (let x = hx0 - 1; x <= hx1 + 1; x++) {
      const distFromCenter = Math.min(x - (hx0 - 1), hx1 + 1 - x);
      const roofY = y0 + 6 + Math.min(3, distFromCenter);
      world.set(x, roofY, z, z === hz0 - 1 || z === hz1 + 1 ? LOG : PLANKS);
      // Fill gable triangle on front & back walls
      if ((z === hz0 || z === hz1) && roofY > y0 + 7) {
        for (let fy = y0 + 7; fy < roofY; fy++) {
          world.set(x, fy, z, SANDSTONE);
        }
      }
    }
  }

  // Door, windows, flowerboxes & lanterns
  world.set(hx0 + 2, y0 + 1, hz0, DOOR_WOOD);
  world.set(hx0 + 2, y0 + 2, hz0, DOOR_WOOD);
  world.set(hx0 + 4, y0 + 2, hz0, FENCE_WOOD);
  world.set(hx0 + 4, y0 + 1, hz0 - 1, DIRT);
  world.set(hx0 + 4, y0 + 2, hz0 - 1, FLOWER_RED);
  world.set(hx0 + 2, y0 + 5, hz0, FENCE_WOOD);
  world.set(hx0 + 3, y0 + 5, hz0, FENCE_WOOD);
  world.set(hx0 + 1, y0 + 4, hz0 - 1, TORCH);
  world.set(hx0 + 4, y0 + 4, hz0 - 1, TORCH);

  // Climbing greenery & vines on front-left corner
  world.set(hx0, y0 + 1, hz0 - 1, LEAVES);
  world.set(hx0, y0 + 2, hz0 - 1, LEAVES);
  world.set(hx0, y0 + 3, hz0 - 1, VINE);
  world.set(hx0, y0 + 4, hz0 - 1, VINE);

  // Side Wooden Pergola & Irrigated Crop Garden (x = x0 + 7 .. x0 + 9)
  for (let z = hz0 + 1; z <= hz1 - 1; z++) {
    for (let x = x0 + 7; x <= x0 + 9; x++) {
      if (x === x0 + 8 && z > hz0 + 1 && z < hz1 - 1) {
        world.set(x, y0, z, WATER);
      } else {
        world.set(x, y0, z, GRASS);
        world.set(x, y0 + 1, z, (x + z) % 2 === 0 ? TALL_GRASS : FLOWER_YELLOW);
      }
      // Overhead pergola lattice at y0 + 3
      if ((x + z) % 2 === 0) {
        world.set(x, y0 + 3, z, FENCE_WOOD);
      }
    }
  }
  for (const pz of [hz0 + 1, hz1 - 1]) {
    for (let py = 1; py <= 3; py++) {
      world.set(x0 + 9, y0 + py, pz, LOG);
    }
  }
  world.set(x0 + 9, y0 + 2, hz0 + 1, TORCH);

  // Interior bed & workbench
  world.set(hx0 + 3, y0 + 1, hz1 - 1, BED);
  world.set(hx0 + 4, y0 + 1, hz1 - 1, BED);
  world.set(hx0 + 1, y0 + 1, hz1 - 1, CRAFTING_TABLE);
  world.structureSites.push({ x: hx0 + 2, y: y0 + 1, z: hz0 + 3, kind: 'cottage' });
}

/**
 * 3. TIERED ADOBE VILLA WITH ROOFTOP PLANTER & LANTERN BRACKETS
 * Matches Image 9:
 * - Cobblestone front patio,
 * - Multi-level sandstone & terracotta adobe walls,
 * - Rooftop enclosed wheat/hay garden bed with timber pergola,
 * - Hanging corner lanterns on wooden brackets.
 */
export function buildDesertTieredLanternVilla(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 11;
  const d = 10;
  prepareFoundation(world, x0, y0, z0, w, d, 12, COBBLE);

  // Ground floor main volume (9x7)
  const vx0 = x0 + 1;
  const vx1 = x0 + 9;
  const vz0 = z0 + 2;
  const vz1 = z0 + 8;

  for (let y = 1; y <= 4; y++) {
    for (let z = vz0; z <= vz1; z++) {
      for (let x = vx0; x <= vx1; x++) {
        const edge = x === vx0 || x === vx1 || z === vz0 || z === vz1;
        if (!edge) {
          if (y === 4) world.set(x, y0 + y, z, SANDSTONE);
          continue;
        }
        world.set(x, y0 + y, z, y === 4 ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Second-story tower room on the left half (vx0 .. vx0 + 4, y = 5..7)
  for (let y = 5; y <= 7; y++) {
    for (let z = vz0 + 1; z <= vz1; z++) {
      for (let x = vx0; x <= vx0 + 4; x++) {
        const edge = x === vx0 || x === vx0 + 4 || z === vz0 + 1 || z === vz1;
        if (!edge) {
          if (y === 7) world.set(x, y0 + y, z, PLANKS);
          continue;
        }
        world.set(x, y0 + y, z, y === 7 ? TERRACOTTA_ORANGE : SANDSTONE);
      }
    }
  }

  // Rooftop Planter Box & Pergola on the right terrace (vx0 + 5 .. vx1, y = 5..7)
  for (let z = vz0 + 1; z <= vz1 - 1; z++) {
    for (let x = vx0 + 5; x <= vx1 - 1; x++) {
      world.set(x, y0 + 4, z, GRASS);
      world.set(x, y0 + 5, z, (x + z) % 2 === 0 ? TALL_GRASS : FLOWER_YELLOW);
      world.set(x, y0 + 7, z, FENCE_WOOD);
    }
  }
  world.set(vx1, y0 + 5, vz0 + 1, LOG);
  world.set(vx1, y0 + 6, vz0 + 1, LOG);
  world.set(vx1, y0 + 5, vz1 - 1, LOG);
  world.set(vx1, y0 + 6, vz1 - 1, LOG);

  // Corner wooden lantern brackets with hanging 3D lanterns
  for (const [lx, lz] of [
    [vx0, vz0 - 1],
    [vx1, vz0 - 1],
    [vx0 + 4, vz0],
  ]) {
    world.set(lx, y0 + 4, lz, FENCE_WOOD);
    world.set(lx, y0 + 3, lz, TORCH);
  }

  // Doorway, windows & interior
  world.set(vx0 + 2, y0 + 1, vz0, DOOR_WOOD);
  world.set(vx0 + 2, y0 + 2, vz0, DOOR_WOOD);
  world.set(vx0 + 6, y0 + 2, vz0, FENCE_WOOD);
  world.set(vx0 + 2, y0 + 6, vz0 + 1, FENCE_WOOD);
  world.set(vx0 + 5, y0 + 1, vz1 - 1, BED);
  world.set(vx0 + 6, y0 + 1, vz1 - 1, BED);
  world.set(vx0 + 2, y0 + 1, vz1 - 1, CRAFTING_TABLE);
  if (rand() < 0.9) {
    world.set(vx1, y0 + 1, vz0 - 1, HAY_BALE);
    world.set(vx1 - 1, y0 + 1, vz0 - 1, LEAVES);
  }
  world.structureSites.push({ x: vx0 + 3, y: y0 + 1, z: vz0 + 3, kind: 'cottage' });
}

/**
 * 4. STEPPED MAYAN / AZTEC PYRAMID WITH TERRACOTTA TRIM
 * Matches Image 1:
 * - 5 stepped sandstone tiers with orange terracotta horizontal cornice bands,
 * - 4 axial staircases with terracotta & chiseled sandstone balustrades,
 * - Summit temple shrine with 4 portals and subterranean gold vault.
 */
export function buildPyramidSteppedMaya(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 16, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // 5 stepped tiers (each tier is 2 blocks high: bottom SANDSTONE, top TERRACOTTA_ORANGE rim)
  for (let tier = 0; tier < 5; tier++) {
    const r = 7 - tier; // 7, 6, 5, 4, 3
    const by = y0 + 1 + tier * 2;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const edge = Math.abs(dx) === r || Math.abs(dz) === r;
        world.set(cx + dx, by, cz + dz, SANDSTONE);
        world.set(cx + dx, by + 1, cz + dz, edge ? TERRACOTTA_ORANGE : SANDSTONE);
      }
    }
  }

  // 4 axial stepped staircases with terracotta balustrades
  for (let step = 0; step < 5; step++) {
    const dist = 7 - step;
    const sy = y0 + 1 + step * 2;
    // North & South stairs
    for (const s of [-1, 1]) {
      world.set(cx, sy, cz + s * dist, CHISELED_SANDSTONE);
      world.set(cx, sy + 1, cz + s * dist, AIR);
      world.set(cx - 1, sy + 1, cz + s * dist, TERRACOTTA_ORANGE);
      world.set(cx + 1, sy + 1, cz + s * dist, TERRACOTTA_ORANGE);
      // East & West stairs
      world.set(cx + s * dist, sy, cz, CHISELED_SANDSTONE);
      world.set(cx + s * dist, sy + 1, cz, AIR);
      world.set(cx + s * dist, sy + 1, cz - 1, TERRACOTTA_ORANGE);
      world.set(cx + s * dist, sy + 1, cz + 1, TERRACOTTA_ORANGE);
    }
  }

  // Summit Sanctuary Temple (5x5 at y0 + 11 .. y0 + 14)
  const topY = y0 + 11;
  for (let y = 0; y <= 3; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        if (y === 3) {
          world.set(cx + dx, topY + y, cz + dz, edge ? TERRACOTTA_ORANGE : CHISELED_SANDSTONE);
        } else if (edge) {
          if ((dx === 0 || dz === 0) && y <= 1) {
            world.set(cx + dx, topY + y, cz + dz, AIR);
          } else {
            world.set(cx + dx, topY + y, cz + dz, corner ? TERRACOTTA_ORANGE : SANDSTONE);
          }
        } else {
          world.set(cx + dx, topY + y, cz + dz, AIR);
        }
      }
    }
  }
  world.set(cx, topY, cz, PEDESTAL_GOLD);
  world.set(cx, topY + 2, cz, TORCH);

  // Hollow interior treasure chamber inside the base of the pyramid
  for (let y = y0 + 1; y <= y0 + 4; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        world.set(cx + dx, y, cz + dz, AIR);
      }
    }
  }
  // Open front entrance tunnel on -Z side
  for (let z = z0; z <= cz - 2; z++) {
    world.set(cx, y0 + 1, z, AIR);
    world.set(cx, y0 + 2, z, AIR);
  }
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz + 1, GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, cz + 1, rand() < 0.7 ? DIAMOND : GOLD);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

/**
 * 5. LAVA-CHANNEL & EYE OF HORUS PYRAMID
 * Matches Image 6 (maxresdefault (2).jpg):
 * - Stepped sandstone & stone pyramid with glowing LAVA channels safely recessed
 *   down the stepped ribs,
 * - Glowing Eye of Horus motif above the entrance portal,
 * - 4 corner fire-brazier towers.
 */
export function buildPyramidLavaHorus(world: World, x0: number, y0: number, z0: number, _rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 15, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Build stepped pyramid layers (r = 7 down to 0)
  for (let layer = 0; layer <= 7; layer++) {
    const r = 7 - layer;
    const py = y0 + 1 + layer;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const cornerDiag = Math.abs(dx) === r && Math.abs(dz) === r;
        const axial = dx === 0 || dz === 0;
        world.set(
          cx + dx,
          py,
          cz + dz,
          cornerDiag ? CHISELED_SANDSTONE : axial ? TERRACOTTA_ORANGE : SANDSTONE,
        );
      }
    }
  }
  // Glowing golden & lava apex
  world.set(cx, y0 + 8, cz, GOLD_BLOCK);
  world.set(cx, y0 + 9, cz, LAMP_RED);

  // Recessed glowing Lava Eye of Horus on front facade (-Z) and glowing rib accents
  world.set(cx - 1, y0 + 5, cz - 3, GOLD_BLOCK);
  world.set(cx, y0 + 5, cz - 3, LAMP_RED);
  world.set(cx + 1, y0 + 5, cz - 3, GOLD_BLOCK);
  world.set(cx, y0 + 6, cz - 2, GOLD_BLOCK);

  // Contained Lava troughs on the 4 corner shrines
  for (const [sx, sz] of [
    [x0 + 1, z0 + 1],
    [x0 + 13, z0 + 1],
    [x0 + 1, z0 + 13],
    [x0 + 13, z0 + 13],
  ]) {
    for (let y = 1; y <= 4; y++) {
      world.set(sx, y0 + y, sz, CHISELED_SANDSTONE);
    }
    world.set(sx, y0 + 5, sz, CAMPFIRE);
    world.set(sx, y0 + 4, sz, LAMP_RED);
  }

  // Inner Pharaoh Vault
  for (let y = y0 + 1; y <= y0 + 4; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        world.set(cx + dx, y, cz + dz, AIR);
      }
    }
  }
  for (let z = z0; z <= cz - 2; z++) {
    world.set(cx, y0 + 1, z, AIR);
    world.set(cx, y0 + 2, z, AIR);
  }
  world.set(cx - 2, y0 + 1, cz + 2, LAVA);
  world.set(cx + 2, y0 + 1, cz + 2, LAVA);
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz, GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, cz, DIAMOND_BLOCK);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

/**
 * 6. SKULL-GATE PYRAMID WITH TWIN FLAMING BRAZIER TOWERS
 * Matches Image 18 (9687a2340496444248f0c412e36d7c91.png):
 * - Stepped sandstone pyramid backdrop,
 * - Sculpted 3D Voxel Skull Gatehouse with glowing fiery eyes & teeth archway,
 * - Two tall ornate flanking Egyptian towers topped with blazing fire braziers.
 */
export function buildPyramidSkullGate(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 16, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 8;

  // Main stepped pyramid in the rear (z0 + 3 .. z0 + 14)
  for (let layer = 0; layer <= 6; layer++) {
    const r = 6 - layer;
    const py = y0 + 1 + layer;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const edge = Math.abs(dx) === r || Math.abs(dz) === r;
        world.set(cx + dx, py, cz + dz, edge && layer % 2 === 1 ? TERRACOTTA_ORANGE : SANDSTONE);
      }
    }
  }
  world.set(cx, y0 + 8, cz, GOLD_BLOCK);

  // Twin Ornate Flanking Brazier Towers at front-left (x0 + 1..3) & front-right (x0 + 11..13)
  for (const tx of [x0 + 2, x0 + 12]) {
    const tz = z0 + 2;
    for (let y = 1; y <= 9; y++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const corner = Math.abs(dx) === 1 && Math.abs(dz) === 1;
          const block =
            y === 5 || y === 8
              ? TERRACOTTA_ORANGE
              : corner
                ? CHISELED_SANDSTONE
                : SANDSTONE;
          world.set(tx + dx, y0 + y, tz + dz, block);
        }
      }
    }
    // Blazing fire brazier crown
    world.set(tx, y0 + 10, tz, LAMP_RED);
    world.set(tx, y0 + 11, tz, CAMPFIRE);
    for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      world.set(tx + bx, y0 + 10, tz + bz, CHISELED_SANDSTONE);
      world.set(tx + bx, y0 + 11, tz + bz, TORCH);
    }
  }

  // Sculpted 3D Voxel Skull Gatehouse on the front face (cx - 3 .. cx + 3, z = z0 + 1 .. z0 + 3)
  const sz = z0 + 2;
  for (let y = 1; y <= 7; y++) {
    for (let dx = -3; dx <= 3; dx++) {
      // Rounded cranium top
      if (y === 7 && Math.abs(dx) === 3) continue;
      world.set(cx + dx, y0 + y, sz, y >= 5 ? CHISELED_SANDSTONE : SANDSTONE);
      world.set(cx + dx, y0 + y, sz + 1, SANDSTONE);
    }
  }
  // Glowing fiery skull eye sockets (y = 4..5, dx = -2..-1 and +1..+2)
  for (const ex of [-2, -1, 1, 2]) {
    world.set(cx + ex, y0 + 5, sz, AIR);
    world.set(cx + ex, y0 + 5, sz + 1, LAMP_RED);
    world.set(cx + ex, y0 + 4, sz, AIR);
    world.set(cx + ex, y0 + 4, sz + 1, Math.abs(ex) === 2 ? GOLD_BLOCK : LAMP_RED);
  }
  // Nasal cavity
  world.set(cx, y0 + 4, sz, AIR);
  // Skull teeth & mouth archway entrance (y = 1..3)
  for (let dx = -1; dx <= 1; dx++) {
    world.set(cx + dx, y0 + 1, sz, AIR);
    world.set(cx + dx, y0 + 2, sz, AIR);
    world.set(cx + dx, y0 + 1, sz + 1, AIR);
    world.set(cx + dx, y0 + 2, sz + 1, AIR);
    // Upper teeth row at y = 3
    world.set(cx + dx, y0 + 3, sz, dx === 0 ? CHISELED_SANDSTONE : FENCE_STONE);
  }

  // Inner tomb chamber & treasure
  for (let y = y0 + 1; y <= y0 + 4; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        world.set(cx + dx, y, cz + dz, AIR);
      }
    }
  }
  for (let z = sz; z <= cz - 2; z++) {
    world.set(cx, y0 + 1, z, AIR);
    world.set(cx, y0 + 2, z, AIR);
  }
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz, GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, cz, rand() < 0.75 ? DIAMOND_BLOCK : GOLD_BLOCK);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

/**
 * 7. RED-STRIPED PHARAOH PYRAMID WITH GOLDEN CAPSTONE, WATER POOLS & GUARDIAN STATUES
 * Matches Images 17 & 20 (image.jpg, y5urpu4o3v571.jpg):
 * - Egyptian pyramid with red terracotta stripes & golden capstone,
 * - Forecourt water pools,
 * - Golden Pharaoh guardian statues & flaming braziers.
 */
export function buildPyramidPharaohRed(world: World, x0: number, y0: number, z0: number, _rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 15, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 8;

  // Pyramid body (r = 6 down to 0)
  for (let layer = 0; layer <= 6; layer++) {
    const r = 6 - layer;
    const py = y0 + 1 + layer;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const isGoldCap = layer >= 5;
        const isRedStripe = Math.abs(dx) <= 1 || Math.abs(dz) <= 1 || layer === 1;
        world.set(
          cx + dx,
          py,
          cz + dz,
          isGoldCap ? GOLD_BLOCK : isRedStripe ? TERRACOTTA_ORANGE : SANDSTONE,
        );
      }
    }
  }
  world.set(cx, y0 + 8, cz, GOLD_BLOCK);

  // Forecourt Water Pools & Golden Guardian Statues at z0 + 1 .. z0 + 2
  for (const side of [-1, 1]) {
    const gx = cx + side * 4;
    const gz = z0 + 1;
    // Water pool
    world.set(cx + side * 2, y0 - 1, gz, SANDSTONE);
    world.set(cx + side * 2, y0, gz, WATER);
    world.set(cx + side * 3, y0 - 1, gz, SANDSTONE);
    world.set(cx + side * 3, y0, gz, WATER);
    // Golden Guardian Statue
    world.set(gx, y0 + 1, gz, CHISELED_SANDSTONE);
    world.set(gx, y0 + 2, gz, GOLD_BLOCK);
    world.set(gx, y0 + 3, gz, GOLD_BLOCK);
    world.set(gx, y0 + 4, gz, LAMP_YELLOW);
    world.set(gx + side, y0 + 3, gz, FENCE_IRON);
  }

  // Entrance portico & inner chamber
  for (let y = y0 + 1; y <= y0 + 4; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        world.set(cx + dx, y, cz + dz, AIR);
      }
    }
  }
  for (let z = z0; z <= cz - 2; z++) {
    world.set(cx, y0 + 1, z, AIR);
    world.set(cx, y0 + 2, z, AIR);
  }
  world.set(cx - 1, y0 + 3, z0 + 2, TORCH);
  world.set(cx + 1, y0 + 3, z0 + 2, TORCH);
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz + 1, GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, cz + 1, DIAMOND);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

/**
 * 8. BABYLONIAN / EGYPTIAN COLONNADED ZIGGURAT TEMPLE-PYRAMID
 * Matches Image 13:
 * - Multi-tiered ziggurat with rows of vertical chiseled sandstone columns,
 * - Grand central portal & upper colonnaded sanctuary.
 */
export function buildPyramidBabylonColonnade(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 16, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Lower Colonnaded Terrace (13x13, y = 1..4)
  for (let y = 1; y <= 4; y++) {
    for (let dz = -6; dz <= 6; dz++) {
      for (let dx = -6; dx <= 6; dx++) {
        const edge = Math.abs(dx) === 6 || Math.abs(dz) === 6;
        if (y === 4) {
          world.set(cx + dx, y0 + y, cz + dz, edge ? TERRACOTTA_ORANGE : SANDSTONE);
        } else if (edge) {
          // Alternating vertical columns
          const isCol = (dx + dz) % 2 === 0;
          world.set(cx + dx, y0 + y, cz + dz, isCol ? CHISELED_SANDSTONE : AIR);
        } else if (Math.abs(dx) === 5 || Math.abs(dz) === 5) {
          world.set(cx + dx, y0 + y, cz + dz, SANDSTONE);
        }
      }
    }
  }

  // Second Colonnaded Terrace (9x9, y = 5..8)
  for (let y = 5; y <= 8; y++) {
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const edge = Math.abs(dx) === 4 || Math.abs(dz) === 4;
        if (y === 8) {
          world.set(cx + dx, y0 + y, cz + dz, edge ? TERRACOTTA_ORANGE : SANDSTONE);
        } else if (edge) {
          const isCol = (dx + dz) % 2 === 0;
          world.set(cx + dx, y0 + y, cz + dz, isCol ? CHISELED_SANDSTONE : SANDSTONE);
        }
      }
    }
  }

  // Summit Stepped Crown (5x5, y = 9..11)
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      world.set(cx + dx, y0 + 9, cz + dz, SANDSTONE);
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
        world.set(cx + dx, y0 + 10, cz + dz, CHISELED_SANDSTONE);
      }
    }
  }
  world.set(cx, y0 + 11, cz, GOLD_BLOCK);

  // Grand Central Entrance & Sanctuary Hall
  for (let z = z0; z <= cz; z++) {
    world.set(cx, y0 + 1, z, AIR);
    world.set(cx, y0 + 2, z, AIR);
    world.set(cx, y0 + 3, z, AIR);
  }
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz, GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, cz, rand() < 0.7 ? DIAMOND_BLOCK : GOLD_BLOCK);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'tower' });
}

/**
 * 9. GREAT PHARAOH SPHINX MONUMENT WITH BLUE & GOLD NEMES HEADDRESS
 * Matches Image 8 (images (1).jfif) & Image 20 (Twin Sphinx Avenue):
 * - Outstretched lion paws with sacred altar between the paws,
 * - Sculpted sandstone lion body,
 * - Pharaoh head with striped Blue (LAMP_BLUE) & Gold (GOLD_BLOCK) Nemes headdress
 *   and golden royal uraeus crown!
 */
export function buildGreatSphinxMonument(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 13;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 15, SANDSTONE);

  const cx = x0 + 6;

  // Patterned Ceremonial Plinth & Forecourt
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      const border = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1;
      world.set(x, y0, z, border ? TERRACOTTA_ORANGE : (x + z) % 4 === 0 ? CHISELED_SANDSTONE : SANDSTONE);
    }
  }

  // 1. Outstretched Lion Paws (z = z0 + 1 .. z0 + 5, left paw cx - 2, right paw cx + 2)
  for (const side of [-2, 2]) {
    for (let z = z0 + 1; z <= z0 + 5; z++) {
      world.set(cx + side, y0 + 1, z, SANDSTONE);
      if (z >= z0 + 2) {
        world.set(cx + side, y0 + 2, z, CHISELED_SANDSTONE);
      }
    }
    // Front claws
    world.set(cx + side, y0 + 1, z0 + 1, CHISELED_SANDSTONE);
  }
  // Sacred Dream Stela & Gold Altar between the Sphinx's paws
  world.set(cx, y0 + 1, z0 + 3, PEDESTAL_GOLD);
  world.set(cx, y0 + 2, z0 + 4, GOLD_BLOCK);
  world.set(cx - 1, y0 + 2, z0 + 1, TORCH);
  world.set(cx + 1, y0 + 2, z0 + 1, TORCH);

  // 2. Lion Body (z = z0 + 5 .. z0 + 12, x = cx - 2 .. cx + 2, y = 1..5)
  for (let y = 1; y <= 5; y++) {
    for (let z = z0 + 5; z <= z0 + 12; z++) {
      const maxX = y === 5 ? 1 : 2;
      for (let dx = -maxX; dx <= maxX; dx++) {
        world.set(cx + dx, y0 + y, z, y === 3 ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }
  // Hollow secret chamber inside the Sphinx body accessed from between the paws!
  for (let y = 1; y <= 3; y++) {
    for (let z = z0 + 6; z <= z0 + 10; z++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.set(cx + dx, y0 + y, z, AIR);
      }
    }
  }
  world.set(cx, y0 + 1, z0 + 5, AIR);
  world.set(cx, y0 + 2, z0 + 5, AIR);
  world.set(cx, y0 + 1, z0 + 9, GOLD_BLOCK);
  world.set(cx - 1, y0 + 1, z0 + 9, rand() < 0.8 ? DIAMOND_BLOCK : GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, z0 + 9, PEDESTAL_GOLD);
  world.set(cx, y0 + 3, z0 + 8, TORCH);

  // 3. Pharaoh Head & Striped Blue-and-Gold Nemes Headdress (y = 6..11, z = z0 + 4 .. z0 + 8)
  for (let y = 6; y <= 10; y++) {
    const headWidth = y >= 7 && y <= 9 ? 3 : 2;
    const stripeBlock = y % 2 === 0 ? LAMP_BLUE : GOLD_BLOCK;
    for (let z = z0 + 5; z <= z0 + 8; z++) {
      for (let dx = -headWidth; dx <= headWidth; dx++) {
        const isFlaredHeaddress = Math.abs(dx) >= 2 || z >= z0 + 7 || y === 10;
        world.set(cx + dx, y0 + y, z, isFlaredHeaddress ? stripeBlock : SANDSTONE);
      }
    }
  }
  // Sculpted Face Details on front of head (z = z0 + 4)
  // Ceremonial Pharaoh Beard
  world.set(cx, y0 + 5, z0 + 4, GOLD_BLOCK);
  world.set(cx, y0 + 6, z0 + 4, CHISELED_SANDSTONE);
  // Nose & Eyes
  world.set(cx, y0 + 7, z0 + 4, SANDSTONE);
  world.set(cx, y0 + 8, z0 + 4, SANDSTONE);
  world.set(cx - 1, y0 + 8, z0 + 5, VOLCANIC_STONE);
  world.set(cx + 1, y0 + 8, z0 + 5, VOLCANIC_STONE);
  // Golden Uraeus Cobra Crown on forehead & top
  world.set(cx, y0 + 10, z0 + 4, GOLD_BLOCK);
  world.set(cx, y0 + 11, z0 + 6, GOLD_BLOCK);
  world.set(cx, y0 + 12, z0 + 6, LAMP_YELLOW);

  world.structureSites.push({ x: cx, y: y0 + 1, z: z0 + 7, kind: 'tower' });
}

/**
 * 10. GRAND EGYPTIAN OBELISK & ANUBIS / SPHINX AVENUE COURT
 * Matches Image 14 (resize_1500_833_true_q90_819992_1e817746def735437928194e3.jpeg):
 * - Towering 15-block-high Egyptian Obelisk with golden pyramidion tip,
 * - Processional avenue flanked by 4 dark-stone Anubis / Jackal guardian statues,
 * - Pillared sandstone courtyard & date palms.
 */
export function buildObeliskAvenueCourt(world: World, x0: number, y0: number, z0: number, _rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 18, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Patterned ceremonial avenue floor
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx = Math.abs(x - cx);
      const block =
        dx === 0
          ? GOLD_BLOCK
          : dx === 1
            ? TERRACOTTA_ORANGE
            : dx === 2
              ? CHISELED_SANDSTONE
              : SANDSTONE;
      world.set(x, y0, z, block);
    }
  }

  // Towering Central Obelisk Pedestal & Shaft
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      world.set(cx + dx, y0 + 1, cz + dz, CHISELED_SANDSTONE);
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
        world.set(cx + dx, y0 + 2, cz + dz, TERRACOTTA_ORANGE);
        world.set(cx + dx, y0 + 3, cz + dz, TORCH);
      }
    }
  }
  // 3x3 lower obelisk base (y = 2..5)
  for (let y = 2; y <= 5; y++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.set(cx + dx, y0 + y, cz + dz, y === 5 ? TERRACOTTA_ORANGE : CHISELED_SANDSTONE);
      }
    }
  }
  // Tapering 1x1 needle shaft (y = 6..14) + Gold Pyramidion Tip (y = 15..16)
  for (let y = 6; y <= 14; y++) {
    world.set(cx, y0 + y, cz, y % 3 === 0 ? CHISELED_SANDSTONE : TERRACOTTA_ORANGE);
  }
  world.set(cx, y0 + 15, cz, GOLD_BLOCK);
  world.set(cx, y0 + 16, cz, LAMP_YELLOW);

  // 4 Dark-Stone Anubis / Jackal Guardian Statues flanking the avenue
  for (const [sx, sz] of [
    [x0 + 2, z0 + 3],
    [x0 + 12, z0 + 3],
    [x0 + 2, z0 + 11],
    [x0 + 12, z0 + 11],
  ]) {
    world.set(sx, y0 + 1, sz, CHISELED_SANDSTONE);
    world.set(sx, y0 + 2, sz, VOLCANIC_STONE);
    world.set(sx, y0 + 3, sz, VOLCANIC_STONE);
    world.set(sx, y0 + 4, sz, GOLD_BLOCK); // Golden collar
    world.set(sx, y0 + 5, sz, VOLCANIC_STONE); // Head
    // Jackal ears
    world.set(sx, y0 + 6, sz, FENCE_IRON);
  }

  world.set(cx, y0 + 2, cz - 2, PEDESTAL_GOLD);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz - 3, kind: 'tower' });
}

/**
 * 11. ALADDIN RED & SANDSTONE FORTRESS PALACE (Замок из Алладина с башнями и куполом)
 * Matches Image 3:
 * - Banded orange terracotta & sandstone fortress walls with crenellated battlements,
 * - 4 corner bastion watchtowers,
 * - Grand arched palace gateway,
 * - Central elevated palace pavilion crowned with a glowing onion dome,
 * - Interior oasis palms.
 */
export function buildAladdinRedFortress(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 16, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Outer striped curtain wall (y = 1..5)
  for (let y = 1; y <= 5; y++) {
    const wallMat = y === 2 || y === 4 ? TERRACOTTA_ORANGE : SANDSTONE;
    for (let z = z0 + 1; z <= z0 + 13; z++) {
      for (let x = x0 + 1; x <= x0 + 13; x++) {
        const edge = x === x0 + 1 || x === x0 + 13 || z === z0 + 1 || z === z0 + 13;
        if (!edge) continue;
        // Front arched gate opening
        if (z === z0 + 1 && Math.abs(x - cx) <= 1 && y <= 3) continue;
        if (y === 5) {
          if ((x + z) % 2 === 0) world.set(x, y0 + y, z, TERRACOTTA_ORANGE);
        } else {
          world.set(x, y0 + y, z, wallMat);
        }
      }
    }
  }

  // 4 Corner Bastion Towers (3x3 at each corner, y = 1..8)
  for (const [tx, tz] of [
    [x0 + 1, z0 + 1],
    [x0 + 13, z0 + 1],
    [x0 + 1, z0 + 13],
    [x0 + 13, z0 + 13],
  ]) {
    for (let y = 1; y <= 7; y++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
          if (!edge && y < 7) continue;
          world.set(tx + dx, y0 + y, tz + dz, y % 2 === 0 ? TERRACOTTA_ORANGE : CHISELED_SANDSTONE);
        }
      }
    }
    // Tower dome cap
    world.set(tx, y0 + 8, tz, TERRACOTTA_ORANGE);
    world.set(tx, y0 + 9, tz, GOLD_BLOCK);
    world.set(tx, y0 + 10, tz, FENCE_WOOD);
  }

  // Central Palace Keep & Onion Dome (5x5 at cx, cz, y = 1..12)
  for (let y = 1; y <= 7; y++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (!edge) {
          if (y === 4 || y === 7) world.set(cx + dx, y0 + y, cz + dz, PLANKS);
          continue;
        }
        if ((dx === 0 || dz === 0) && y <= 2) continue;
        world.set(cx + dx, y0 + y, cz + dz, y === 4 || y === 7 ? TERRACOTTA_ORANGE : SANDSTONE);
      }
    }
  }
  // Ornate Onion Dome above the Central Keep (y = 8..12)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.set(cx + dx, y0 + 8, cz + dz, TERRACOTTA_ORANGE);
      world.set(cx + dx, y0 + 9, cz + dz, GOLD_BLOCK);
    }
  }
  world.set(cx, y0 + 10, cz, TERRACOTTA_ORANGE);
  world.set(cx, y0 + 11, cz, GOLD_BLOCK);
  world.set(cx, y0 + 12, cz, TORCH);

  // Courtyard Oasis Palms & Treasure
  world.growPalm(x0 + 4, y0 + 1, z0 + 4, rand);
  world.growPalm(x0 + 10, y0 + 1, z0 + 4, rand);
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz + 1, BED);
  world.set(cx, y0 + 1, cz + 1, BED);
  world.set(cx + 1, y0 + 1, cz - 1, CRAFTING_TABLE);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'cottage' });
}

/**
 * 12. ALADDIN BLUE-DOME PALACE & MINARETS (Дворец Аграбы с голубыми куполами и минаретами)
 * Matches Image 12:
 * - Multi-tiered cream sandstone palace with recessed vertical colonnade windows,
 * - Grand turquoise/blue central dome (LAMP_BLUE) + side domes,
 * - 4 slender corner minarets topped with blue dome caps and golden finials.
 */
export function buildAladdinBlueDomePalace(world: World, x0: number, y0: number, z0: number, _rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 17, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Main Palace Hall (9x9 around cx, cz, y = 1..7)
  for (let y = 1; y <= 7; y++) {
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const edge = Math.abs(dx) === 4 || Math.abs(dz) === 4;
        if (!edge) {
          if (y === 4 || y === 7) world.set(cx + dx, y0 + y, cz + dz, SANDSTONE);
          continue;
        }
        // Arched entrance on all 4 axes
        if ((dx === 0 || dz === 0) && y <= 3) continue;
        // Vertical colonnade windows on y = 2..5
        if (y >= 2 && y <= 5 && (Math.abs(dx) === 2 || Math.abs(dz) === 2)) {
          world.set(cx + dx, y0 + y, cz + dz, FENCE_WOOD);
        } else {
          world.set(cx + dx, y0 + y, cz + dz, y === 7 ? CHISELED_SANDSTONE : SANDSTONE);
        }
      }
    }
  }

  // Grand Turquoise-Blue Onion Dome (LAMP_BLUE, y = 8..13)
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      world.set(cx + dx, y0 + 8, cz + dz, LAMP_BLUE);
      world.set(cx + dx, y0 + 9, cz + dz, LAMP_BLUE);
    }
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.set(cx + dx, y0 + 10, cz + dz, LAMP_BLUE);
    }
  }
  world.set(cx, y0 + 11, cz, GOLD_BLOCK);
  world.set(cx, y0 + 12, cz, FENCE_IRON);
  world.set(cx, y0 + 13, cz, TORCH);

  // 4 Slender Corner Minarets with Blue Domes (y = 1..12)
  for (const [mx, mz] of [
    [x0 + 1, z0 + 1],
    [x0 + 13, z0 + 1],
    [x0 + 1, z0 + 13],
    [x0 + 13, z0 + 13],
  ]) {
    for (let y = 1; y <= 9; y++) {
      world.set(mx, y0 + y, mz, y % 3 === 0 ? CHISELED_SANDSTONE : SANDSTONE);
    }
    // Balcony collar
    for (const [bx, bz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      world.set(mx + bx, y0 + 9, mz + bz, FENCE_WOOD);
    }
    // Blue dome cap
    world.set(mx, y0 + 10, mz, LAMP_BLUE);
    world.set(mx, y0 + 11, mz, LAMP_BLUE);
    world.set(mx, y0 + 12, mz, GOLD_BLOCK);
  }

  // Royal Interior
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 2, y0 + 1, cz + 2, BED);
  world.set(cx - 1, y0 + 1, cz + 2, BED);
  world.set(cx + 2, y0 + 1, cz + 2, GOLD_BLOCK);
  world.set(cx + 2, y0 + 1, cz - 2, CRAFTING_TABLE);
  world.set(cx, y0 + 3, cz, TORCH);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'cottage' });
}

/**
 * 13. FOUR-MINARET OASIS COURTYARD SANCTUARY WITH GIANT WEEPING TREE
 * Matches d26b87ae5b3c84addc551c913ffbef57.jpg:
 * - Sandstone courtyard enclosure with a tall Red-Terracotta & Sandstone Iwan Arch,
 * - 4 tiered corner minarets,
 * - Giant lush weeping sanctuary tree growing out of the central courtyard!
 */
export function buildDesertOasisSanctuary(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 16, SANDSTONE);

  const cx = x0 + 7;
  const cz = z0 + 7;

  // Arched perimeter gallery walls (11x11 around cx, cz, y = 1..5)
  for (let y = 1; y <= 5; y++) {
    for (let dz = -5; dz <= 5; dz++) {
      for (let dx = -5; dx <= 5; dx++) {
        const edge = Math.abs(dx) === 5 || Math.abs(dz) === 5;
        if (!edge) continue;
        const isArchOpening = y <= 3 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1);
        if (isArchOpening) continue;
        world.set(cx + dx, y0 + y, cz + dz, y === 5 ? TERRACOTTA_ORANGE : SANDSTONE);
      }
    }
  }

  // High Red-Trimmed Central Iwan Arch on Front (-Z) & Back (+Z) (y = 6..8)
  for (const sz of [cz - 5, cz + 5]) {
    for (let y = 6; y <= 8; y++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (y === 6 && Math.abs(dx) <= 1) continue;
        world.set(cx + dx, y0 + y, sz, Math.abs(dx) === 2 || y === 8 ? TERRACOTTA_ORANGE : CHISELED_SANDSTONE);
      }
    }
  }

  // 4 Tiered Corner Minarets (y = 1..11)
  for (const [mx, mz] of [
    [cx - 5, cz - 5],
    [cx + 5, cz - 5],
    [cx - 5, cz + 5],
    [cx + 5, cz + 5],
  ]) {
    for (let y = 1; y <= 9; y++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (y > 6 && (dx !== 0 || dz !== 0)) continue;
          world.set(mx + dx, y0 + y, mz + dz, y === 6 ? TERRACOTTA_ORANGE : SANDSTONE);
        }
      }
    }
    world.set(mx, y0 + 10, mz, TERRACOTTA_ORANGE);
    world.set(mx, y0 + 11, mz, FENCE_WOOD);
  }

  // Lush Green Oasis Courtyard & Giant Weeping Sanctuary Tree in the center
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      world.set(cx + dx, y0, cz + dz, Math.abs(dx) === 2 && Math.abs(dz) === 2 ? WATER : GRASS);
      if (world.get(cx + dx, y0, cz + dz) === GRASS && (dx !== 0 || dz !== 0) && rand() < 0.5) {
        world.set(cx + dx, y0 + 1, cz + dz, rand() < 0.5 ? FLOWER_RED : TALL_GRASS);
      }
    }
  }
  // Trunk & branching limbs
  for (let y = 1; y <= 7; y++) {
    world.set(cx, y0 + y, cz, LOG);
  }
  for (const [bx, bz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    world.set(cx + bx, y0 + 6, cz + bz, LOG);
  }
  // Broad lush leaf dome with hanging vines (y = 6..9)
  for (let dy = 6; dy <= 9; dy++) {
    const r = dy === 9 ? 2 : 3;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        if (world.get(cx + dx, y0 + dy, cz + dz) === AIR) {
          world.set(cx + dx, y0 + dy, cz + dz, LEAVES);
        }
        if (dy === 6 && Math.abs(dx) + Math.abs(dz) >= 3 && rand() < 0.5) {
          world.set(cx + dx, y0 + 5, cz + dz, VINE);
          world.set(cx + dx, y0 + 4, cz + dz, VINE);
        }
      }
    }
  }
  world.set(cx + 2, y0 + 1, cz, PEDESTAL_GOLD);
  world.structureSites.push({ x: cx + 2, y: y0 + 1, z: cz, kind: 'cottage' });
}

/**
 * 14. COLOSSAL HALF-BURIED DESERT SKULL RUIN
 * Matches Image 5 (7cc69f67ba5be31e46c49aba1e586fd0.jpg):
 * - Massive weathered sandstone skull tilted into the desert sand dunes,
 * - Rounded cranium dome, deep hollow eye sockets, nasal cavity, cheekbones,
 *   and upper jaw teeth emerging from the sand,
 * - Secret treasure cache inside the hollow cranium!
 */
export function buildGiantDesertSkull(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 13;
  const d = 13;
  prepareFoundation(world, x0, y0, z0, w, d, 12, SAND);

  const cx = x0 + 6;
  const cz = z0 + 6;

  // Sculpt the rounded 3D cranium shell (radius ~4.5)
  for (let y = 1; y <= 8; y++) {
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ny = (y - 4.2) / 4.0;
        const nx = dx / 4.2;
        const nz = dz / 4.4;
        const dist2 = nx * nx + ny * ny + nz * nz;
        if (dist2 <= 1.05 && dist2 >= 0.52) {
          const mat =
            y >= 6 && (dx + dz) % 3 === 0
              ? CHISELED_SANDSTONE
              : SANDSTONE;
          world.set(cx + dx, y0 + y, cz + dz, mat);
        }
      }
    }
  }

  // Facial Front (-Z side: cz - 4 .. cz - 3)
  // Prominent brow ridge at y = 5
  for (let dx = -3; dx <= 3; dx++) {
    world.set(cx + dx, y0 + 5, cz - 4, CHISELED_SANDSTONE);
  }
  // Two deep hollow eye sockets (dx = -2..-1 and +1..+2, y = 3..4)
  for (const ex of [-2, -1, 1, 2]) {
    for (const ey of [3, 4]) {
      world.set(cx + ex, y0 + ey, cz - 4, AIR);
      world.set(cx + ex, y0 + ey, cz - 3, AIR);
    }
  }
  // Nasal bridge & triangular nasal cavity
  world.set(cx, y0 + 4, cz - 4, SANDSTONE);
  world.set(cx, y0 + 3, cz - 4, AIR);
  world.set(cx, y0 + 2, cz - 4, AIR);
  world.set(cx, y0 + 2, cz - 3, AIR);

  // Upper jaw teeth emerging from the sand at z = cz - 4, y = 1
  for (let dx = -2; dx <= 2; dx++) {
    world.set(cx + dx, y0 + 1, cz - 4, dx % 2 === 0 ? CHISELED_SANDSTONE : AIR);
  }

  // Sand drifts banking up against the back and sides of the buried skull
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dz >= 2 && Math.abs(dx) <= 3) {
        world.set(cx + dx, y0 + 1, cz + dz, SAND);
        if (dz >= 3) world.set(cx + dx, y0 + 2, cz + dz, SAND);
      }
    }
  }

  // Hidden treasure inside the hollow cranium
  world.set(cx, y0 + 1, cz, PEDESTAL_GOLD);
  world.set(cx - 1, y0 + 1, cz, GOLD_BLOCK);
  world.set(cx + 1, y0 + 1, cz, rand() < 0.75 ? DIAMOND_BLOCK : GOLD);
  world.set(cx, y0 + 1, cz + 1, CAMPFIRE);
  world.structureSites.push({ x: cx, y: y0 + 1, z: cz, kind: 'ruin' });
}

/**
 * 15. HALF-RUINED DESERT CASTLE & CREEPER WATCHTOWER
 * Matches Image 1 (Creeper-face Watchtower + Walled Courtyard) & ruined desert castles:
 * - Weathered, half-collapsed sandstone & terracotta castle walls with broken arches,
 * - Iconic Sculpted Creeper-Face Sandstone Watchtower rising on one side,
 * - Sand drifts & buried courtyard treasure.
 */
export function buildRuinedDesertCastle(world: World, x0: number, y0: number, z0: number, rand: () => number) {
  const w = 15;
  const d = 15;
  prepareFoundation(world, x0, y0, z0, w, d, 15, SANDSTONE);

  const cx = x0 + 7;

  // Half-ruined perimeter castle walls with weathered gaps & sand drifts
  for (let z = z0 + 1; z <= z0 + 13; z++) {
    for (let x = x0 + 1; x <= x0 + 13; x++) {
      const edge = x === x0 + 1 || x === x0 + 13 || z === z0 + 1 || z === z0 + 13;
      if (!edge) {
        if (rand() < 0.18) world.set(x, y0, z, SAND);
        continue;
      }
      if (z === z0 + 1 && Math.abs(x - cx) <= 1) continue; // Front gate
      const wallH = 2 + Math.floor(rand() * 4);
      for (let y = 1; y <= wallH; y++) {
        world.set(x, y0 + y, z, y === wallH ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
  }

  // Iconic Creeper-Face Sandstone Watchtower (7x7 at x0 + 4..10, z0 + 6..12, y = 1..11)
  const tx = cx;
  const tz = z0 + 9;
  for (let y = 1; y <= 10; y++) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
        if (!edge) {
          if (y === 5 || y === 10) world.set(tx + dx, y0 + y, tz + dz, PLANKS);
          continue;
        }
        // Carve the iconic Creeper face into the front (-Z) & back (+Z) faces of the tower!
        if (Math.abs(dz) === 3) {
          const isEye = (y === 7 || y === 8) && (Math.abs(dx) === 1 || Math.abs(dx) === 2);
          const isNose = (y === 5 || y === 6) && dx === 0;
          const isMouthTop = y === 4 && Math.abs(dx) <= 1;
          const isMouthFangs = y === 3 && Math.abs(dx) === 1;
          if (isEye || isNose || isMouthTop || isMouthFangs) {
            world.set(tx + dx, y0 + y, tz + dz, AIR);
            continue;
          }
        }
        world.set(tx + dx, y0 + y, tz + dz, y === 10 ? TERRACOTTA_ORANGE : SANDSTONE);
      }
    }
  }
  // Entrance door into the Creeper Tower + rooftop crenellations
  world.set(tx, y0 + 1, tz - 3, AIR);
  world.set(tx, y0 + 2, tz - 3, AIR);
  for (let dx = -3; dx <= 3; dx += 2) {
    world.set(tx + dx, y0 + 11, tz - 3, CHISELED_SANDSTONE);
    world.set(tx + dx, y0 + 11, tz + 3, CHISELED_SANDSTONE);
  }
  world.set(tx, y0 + 1, tz, PEDESTAL_GOLD);
  world.set(tx - 1, y0 + 1, tz, GOLD_BLOCK);
  world.set(tx + 1, y0 + 1, tz, rand() < 0.7 ? DIAMOND : GOLD);
  world.set(tx, y0 + 3, tz, TORCH);
  world.structureSites.push({ x: tx, y: y0 + 1, z: tz, kind: 'ruin' });
}

/**
 * 16. MOUNTAIN-CARVED CLIFFSIDE TEMPLES & CAVE ENTRANCES
 * (Высеченные в горе здания, переходящие во вход в пещеру)
 * Matches:
 * - Variant 0: Petra Red-Rock Treasury (965c63533b8ebf72bfdf46608922baf7.jpg & Petra photo)
 * - Variant 1: Twin-Tower Mountain Gatehouse (d3cf311e694dbadafc0ca82ce0951e3e.png)
 * - Variant 2: Hanging Vine Cliff Monastery with Twin Bridges (58371d3ef564c25947d8250dd0038a8c.jpg)
 *
 * Builds a dramatic sandstone/stone cliff mass at the back of the chunk, carves the
 * ornate architectural facade directly into the rock face, and excavates a deep,
 * glowing Cave Entrance Tunnel penetrating deep into the mountain!
 */
export function buildCliffsideCarvedTemple(world: World, cx: number, cz: number, rand: () => number): boolean {
  const x0 = cx * CHUNK + 1;
  const z0 = cz * CHUNK + 1;
  const y0 = Math.max(20, world.getHeight(x0 + 7, z0 + 3));
  if (y0 + 17 >= WY) return false;

  const w = 14;
  const d = 14;
  prepareFoundation(world, x0, y0, z0, w, d, 17, SANDSTONE);

  const midX = x0 + 7;
  const variant = Math.floor(rand() * 3);

  // 1. Sculpt the Rising Mountain Cliff Mass in the rear half (z = z0 + 5 .. z0 + 13, height 14..16 blocks)
  for (let z = z0 + 5; z <= z0 + 13; z++) {
    const depthFactor = z - (z0 + 5);
    for (let x = x0; x < x0 + w; x++) {
      const edgeDist = Math.min(x - x0, x0 + w - 1 - x);
      const cliffH = Math.min(15, 11 + Math.floor(depthFactor * 0.5) + Math.min(2, edgeDist));
      for (let y = 1; y <= cliffH; y++) {
        const isTerracottaBand = variant === 0 && (y % 4 === 0 || y % 4 === 1);
        const isStoneCliff = variant !== 0 && (y > 8 || (x + y + z) % 3 === 0);
        world.set(
          x,
          y0 + y,
          z,
          isTerracottaBand ? TERRACOTTA_ORANGE : isStoneCliff ? STONE : SANDSTONE,
        );
      }
    }
  }

  const facadeZ = z0 + 5;

  if (variant === 0) {
    // --- VARIANT 0: PETRA RED-ROCK TREASURY FACADE (965c63533b8ebf72bfdf46608922baf7.jpg) ---
    // Carve recessed portico niche into the cliff face (x = midX - 4 .. midX + 4, y = 1..12)
    for (let y = 1; y <= 12; y++) {
      for (let dx = -4; dx <= 4; dx++) {
        world.set(midX + dx, y0 + y, facadeZ, AIR);
        world.set(midX + dx, y0 + y, facadeZ + 1, TERRACOTTA_ORANGE);
      }
    }
    // 4 Tall Classical Columns (dx = -4, -2, +2, +4, y = 1..6)
    for (const colX of [-4, -2, 2, 4]) {
      for (let y = 1; y <= 6; y++) {
        world.set(midX + colX, y0 + y, facadeZ, y === 1 || y === 6 ? CHISELED_SANDSTONE : SANDSTONE);
      }
    }
    // Triangular Pediment & Entablature at y = 7..8
    for (let dx = -4; dx <= 4; dx++) {
      world.set(midX + dx, y0 + 7, facadeZ, TERRACOTTA_ORANGE);
    }
    for (let dx = -2; dx <= 2; dx++) {
      world.set(midX + dx, y0 + 8, facadeZ, CHISELED_SANDSTONE);
    }
    // Upper Tholos Urn & Broken Pediment at y = 9..12
    for (let y = 9; y <= 11; y++) {
      world.set(midX - 3, y0 + y, facadeZ, SANDSTONE);
      world.set(midX + 3, y0 + y, facadeZ, SANDSTONE);
      world.set(midX, y0 + y, facadeZ, y === 11 ? GOLD_BLOCK : CHISELED_SANDSTONE);
    }
  } else if (variant === 1) {
    // --- VARIANT 1: TWIN-TOWER MOUNTAIN GATEHOUSE (d3cf311e694dbadafc0ca82ce0951e3e.png) ---
    for (const side of [-3, 3]) {
      for (let y = 1; y <= 13; y++) {
        for (let dx = -1; dx <= 1; dx++) {
          const isSlit = dx === 0 && (y === 4 || y === 5 || y === 9 || y === 10);
          world.set(
            midX + side + dx,
            y0 + y,
            facadeZ - 1,
            isSlit ? FENCE_IRON : Math.abs(dx) === 1 ? CHISELED_SANDSTONE : SANDSTONE,
          );
        }
      }
      world.set(midX + side, y0 + 14, facadeZ - 1, CHISELED_SANDSTONE);
    }
    // Central Ribbed Spire & Stepped Arch Portal
    for (let y = 5; y <= 14; y++) {
      world.set(midX, y0 + y, facadeZ - 1, y % 2 === 0 ? CHISELED_SANDSTONE : STONE);
    }
    for (let dx = -1; dx <= 1; dx++) {
      world.set(midX + dx, y0 + 4, facadeZ - 1, CHISELED_SANDSTONE);
    }
  } else {
    // --- VARIANT 2: HANGING VINE CLIFF MONASTERY WITH TWIN BRIDGES (58371d3ef564c25947d8250dd0038a8c.jpg) ---
    // Upper wooden gabled sanctuary jutting out of the cliff face (y = 6..10)
    for (let y = 6; y <= 9; y++) {
      for (let dx = -3; dx <= 3; dx++) {
        const edge = Math.abs(dx) === 3;
        world.set(midX + dx, y0 + y, facadeZ - 1, edge ? LOG : y === 9 ? PLANKS : SANDSTONE);
      }
    }
    world.set(midX - 1, y0 + 7, facadeZ - 1, FENCE_WOOD);
    world.set(midX + 1, y0 + 7, facadeZ - 1, FENCE_WOOD);
    world.set(midX - 2, y0 + 7, facadeZ - 2, TORCH);
    world.set(midX + 2, y0 + 7, facadeZ - 2, TORCH);

    // Lush hanging vines & leaves cascading down the cliff face
    for (const vx of [x0 + 2, x0 + 4, x0 + 10, x0 + 12]) {
      world.set(vx, y0 + 11, facadeZ, LEAVES);
      for (let vy = 5; vy <= 10; vy++) {
        world.set(vx, y0 + vy, facadeZ - 1, VINE);
      }
    }

    // Water stream at the foot of the cliff (z = z0 + 2..3) crossed by Twin Wooden Bridges!
    for (let x = x0 + 1; x < x0 + w - 1; x++) {
      for (const wz of [z0 + 2, z0 + 3]) {
        world.set(x, y0 - 1, wz, SANDSTONE);
        world.set(x, y0, wz, WATER);
      }
    }
    for (const bx of [midX - 2, midX, midX + 2]) {
      for (const wz of [z0 + 2, z0 + 3]) {
        world.set(bx, y0 + 1, wz, PLANKS);
      }
      world.set(bx, y0 + 2, z0 + 1, FENCE_WOOD);
      world.set(bx, y0 + 3, z0 + 1, TORCH);
    }
  }

  // 2. Carve the Deep Walkable Cave Entrance Tunnel into the Mountain (z = facadeZ .. z0 + 13)
  for (let z = facadeZ - 1; z <= z0 + 12; z++) {
    const caveFloorOffset = z >= facadeZ + 4 ? -1 : 0;
    for (let dy = caveFloorOffset; dy <= 3; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dy === 3 && Math.abs(dx) === 1) continue; // Arched cave ceiling
        world.set(midX + dx, y0 + 1 + dy, z, AIR);
      }
    }
    if (z === facadeZ + 2 || z === facadeZ + 6) {
      world.set(midX - 1, y0 + 2, z, TORCH);
      world.set(midX + 1, y0 + 2, z, TORCH);
    }
  }

  // 3. Subterranean Mountain Cavern & Treasure Grotto at the end of the cave tunnel (z0 + 10..12)
  for (let z = z0 + 9; z <= z0 + 12; z++) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -1; dy <= 3; dy++) {
        world.set(midX + dx, y0 + 1 + dy, z, AIR);
      }
    }
  }
  // Ore veins & treasure inside the mountain cave grotto
  world.set(midX - 3, y0 + 2, z0 + 11, GOLD);
  world.set(midX + 3, y0 + 2, z0 + 11, IRON);
  world.set(midX - 2, y0 + 1, z0 + 12, COAL);
  world.set(midX, y0, z0 + 11, PEDESTAL_GOLD);
  world.set(midX - 1, y0, z0 + 11, GOLD_BLOCK);
  world.set(midX + 1, y0, z0 + 11, rand() < 0.8 ? DIAMOND_BLOCK : GOLD_BLOCK);
  world.set(midX, y0 + 3, z0 + 11, TORCH);

  world.structureSites.push({ x: midX, y: y0 + 1, z: facadeZ + 2, kind: 'ruin' });
  return true;
}
