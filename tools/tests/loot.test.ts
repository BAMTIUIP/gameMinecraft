import { gearDropChance, MATERIALS, rollLoot } from '../../src/game/items';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

ok(Math.abs(gearDropChance(1) - 0.055) < 1e-12, 'Слабый монстр даёт зелёную экипировку примерно раз в 18 убийств');
ok(gearDropChance(1) >= 1 / 20 && gearDropChance(1) <= 1 / 15, 'Начальный шанс попадает в диапазон 1 предмет на 15–20 мобов');
ok(gearDropChance(6) > gearDropChance(3) && gearDropChance(3) > gearDropChance(1), 'Сильные монстры дают экипировку чаще, но без обилия дропа');

const trials = 20_000;
let weakDrops = 0;
let weakInvalid = 0;
let strongRare = 0;
let strongMythic = 0;
let strongNetherite = 0;
for (let seed = 1; seed <= trials; seed++) {
  const weak = rollLoot(1, seed);
  if (weak) {
    weakDrops++;
    if (weak.rarity !== 0 || (weak.material !== 'leather' && weak.material !== 'iron')) weakInvalid++;
  }
  const strong = rollLoot(6, seed);
  if (strong) {
    if (strong.rarity >= 2) strongRare++;
    if (strong.rarity === 4) strongMythic++;
    if (strong.material === 'netherite') strongNetherite++;
  }
}
const weakChance = weakDrops / trials;
ok(weakChance > 0.05 && weakChance < 0.06, `Слабый моб выпадает около 5.5%: фактически ${(weakChance * 100).toFixed(2)}%`);
ok(weakInvalid === 0, 'Слабые монстры не выдают редкую броню или материалы сильных уровней');
ok(strongRare > 0 && strongMythic > 0, 'Сильные монстры могут изредка выдавать редкую и мифическую экипировку');
ok(strongMythic < strongRare, 'Мифическая экипировка встречается реже редкой');
ok(strongNetherite > 0 && MATERIALS.netherite.armor > MATERIALS.diamond.armor, 'Незеритовая экипировка доступна сильнейшим монстрам и остаётся самым мощным материалом');

export { passed, failures };
