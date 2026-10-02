import { babyGrowthScale, FAWN_NEWBORN_SCALE, MOBS } from '../../src/game/mobs';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const formerFawnMinimum = 0.35;
ok(FAWN_NEWBORN_SCALE === formerFawnMinimum * 2, 'Минимальный размер оленёнка ровно вдвое больше прежнего');
ok(babyGrowthScale('fawn', 0) === FAWN_NEWBORN_SCALE, 'Новорождённый оленёнок начинается с нового минимального размера');
ok(
  babyGrowthScale('fawn', 1 - 70 / 60) === FAWN_NEWBORN_SCALE,
  'Отрицательный прогресс роста не создаёт оленят меньше нового минимума',
);
ok(babyGrowthScale('fawn', 0.5) > FAWN_NEWBORN_SCALE, 'Оленёнок постепенно растёт после минимального размера');
ok(babyGrowthScale('fawn', 1) === 1, 'Выросший оленёнок достигает полного размера');
const formerFawnModelScale = MOBS.fawn.scale * formerFawnMinimum;
const newFawnModelScale = MOBS.fawn.scale * babyGrowthScale('fawn', 0);
ok(Math.abs(newFawnModelScale / formerFawnModelScale - 2) < 1e-12, 'Модель оленёнка вдвое крупнее прежнего минимума');
ok(babyGrowthScale('calf', 0) === 0.65, 'Размер новорождённого телёнка остаётся прежним');

export { passed, failures };
