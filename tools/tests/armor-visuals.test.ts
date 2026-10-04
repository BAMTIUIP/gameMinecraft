import {
  AFFIXES,
  gearColor,
  gearSellPrice,
  makeItem,
  MATERIALS,
  RARITY,
  SLOTS,
  type Item,
  type Material,
} from '../../src/game/items';
import { DIAMOND, GOLD, IRON, PLANKS } from '../../src/game/blocks';
import { getSalvageForGear, gearTraderCost, RECIPES } from '../../src/game/recipes';
import { mulberry32 } from '../../src/game/noise';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const makeArmor = (material: Material, visualColor?: string): Pick<Item, 'material' | 'visualColor'> => ({
  material,
  ...(visualColor ? { visualColor } : {}),
});

for (const material of Object.keys(MATERIALS) as Material[]) {
  ok(
    gearColor(makeArmor(material)) === MATERIALS[material].color,
    `The ${material} armor tint stays identical across worn and dropped 3D models and inventory previews`,
  );
}

ok(
  gearColor(makeArmor('iron', '#4d8c5a')) === '#4d8c5a',
  'Recipe-specific shell colors can be carried by crafted armor so the worn model matches its crafting icon',
);
ok(
  gearColor(makeArmor('iron', 'url(javascript:alert(1))')) === MATERIALS.iron.color,
  'Unsupported saved armor tints safely fall back to the material palette',
);
ok(SLOTS.length === 6 && SLOTS.every((slot) => ['head', 'chest', 'legs', 'feet', 'hands', 'offhand'].includes(slot)), 'All six armor slots have a dedicated visual path');

const rarityColors = ['#93c95d', '#5ea8ff', '#c58cff', '#ff9b42', '#ff5364'];
ok(RARITY.length === 5 && RARITY.every((rarity, index) => rarity.color === rarityColors[index]), 'Armor rarity has five distinct green, blue, purple, orange and red tiers');

const highRarity = makeItem('chest', 'iron', 4, mulberry32(0x5eed));
ok(highRarity.affixes.length === 4 && new Set(highRarity.affixes.map((affix) => affix.id)).size === 4, 'The red mythic tier rolls four independent affixes');
const fireTint = gearColor({ material: 'iron', affixes: [{ id: 'fire', value: 4 }], crafted: false });
const vampTint = gearColor({ material: 'iron', affixes: [{ id: 'vamp', value: 2 }], crafted: false });
ok(fireTint === '#c85c2d' && fireTint !== MATERIALS.iron.color, 'The primary fire affix sets the armor enamel shared by icons and 3D models');
ok(vampTint === '#9d334d' && vampTint !== MATERIALS.iron.color, 'The primary vampiric affix sets a matching crimson armor base');
ok(AFFIXES.fire.color === '#ff8a2b' && AFFIXES.vamp.color === '#ff5f7a', 'Primary color enamel remains distinct from animated fire and haze ornaments');

const saleValues = RARITY.map((_, rarity) => gearSellPrice({ material: 'iron', rarity: rarity as 0 | 1 | 2 | 3 | 4, affixes: [] }));
ok(saleValues.every((value, index) => index === 0 || value > saleValues[index - 1]), 'Trader sale value increases at every rarity tier');
const currencyValue = (cost: Array<[number, number]>) => cost.reduce((total, [id, count]) => total + count * (id === IRON ? 1 : id === GOLD ? 3 : id === DIAMOND ? 10 : 0), 0);
const buyValues = RARITY.map((_, rarity) => currencyValue(gearTraderCost(rarity as 0 | 1 | 2 | 3 | 4)));
ok(buyValues.every((value, index) => index === 0 || value > buyValues[index - 1]), 'Trader purchase cost rises monotonically from green to red gear');

const woodenShield = RECIPES.find((recipe) => recipe.key === 'shield_wood');
const leatherShield = RECIPES.find((recipe) => recipe.key === 'shield_leather');
ok(woodenShield?.kind === 'gear' && woodenShield.slot === 'offhand' && woodenShield.material === 'wood', 'The wooden-shield recipe creates a wood offhand armor item');
ok(woodenShield?.inputs.some(([id]) => id === PLANKS), 'The wooden shield recipe consumes planks');
ok(leatherShield?.kind === 'gear' && leatherShield.slot === 'offhand' && leatherShield.material === 'leather', 'The leather-shield recipe creates a leather offhand armor item');
const woodSalvage = getSalvageForGear(makeItem('offhand', 'wood', 0, () => 0, true));
const leatherSalvage = getSalvageForGear(makeItem('offhand', 'leather', 0, () => 0, true));
ok(woodSalvage.some(([id, count]) => id === PLANKS && count > 0), 'Dismantling a wooden shield returns reduced planks');
ok(leatherSalvage.some(([id, count]) => id === PLANKS && count > 0), 'Dismantling a leather shield returns reduced planks');

export { passed, failures };
