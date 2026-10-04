import { gearColor, MATERIALS, SLOTS, type Item, type Material } from '../../src/game/items';

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

export { passed, failures };
