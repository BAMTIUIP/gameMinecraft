import {
  CACTUS,
  CACTUS_PALE,
  DEAD_BUSH,
  DESERT_THISTLE,
  DRY_BLOOM,
  FERN,
  FLOWER_RED,
  MUSHROOM,
  TALL_GRASS,
  VINE,
  canBreakByHand,
  isInstaBreak,
  isPlant,
} from '../../src/game/blocks';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const handBreakablePlants = [FLOWER_RED, TALL_GRASS, FERN, DEAD_BUSH, VINE, MUSHROOM, DRY_BLOOM, DESERT_THISTLE];
for (const id of handBreakablePlants) {
  ok(isPlant(id), `Блок ${id} распознан как растение`);
  ok(canBreakByHand(id), `Растение ${id} можно сломать голой рукой`);
  ok(isInstaBreak(id), `Растение ${id} ломается одним ударом`);
}
for (const id of [CACTUS, CACTUS_PALE]) {
  ok(canBreakByHand(id), `Кактус ${id} можно сломать голой рукой`);
  ok(isInstaBreak(id), `Кактус ${id} ломается одним ударом`);
}

export { passed, failures };
