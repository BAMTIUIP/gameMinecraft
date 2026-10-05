import { readFileSync } from 'node:fs';
import {
  APPLE,
  ARROW_ITEM,
  DIRT,
  FIRE_ARROW,
  RAW_MEAT,
  STONE_ARROW,
} from '../../src/game/blocks';
import { getGearDetails, getItemDetails, getPetDetails } from '../../src/game/itemDetails';
import { BOW_TOOLS, SWORD_TOOLS } from '../../src/game/tools';
import type { Item } from '../../src/game/items';

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string) => {
  if (condition) passed += 1;
  else failures.push(label);
};
const valueFor = (label: string, stats: Array<{ label: string; value: string }>) => stats.find((stat) => stat.label === label)?.value;

const sword = getItemDetails(SWORD_TOOLS[0], { durability: 22, maxDurability: 55 });
ok(sword.name === 'WOODEN SWORD', 'Tool popups show the localized name of the exact weapon tier');
ok(valueFor('DAMAGE', sword.stats) === '4', 'Weapon popup damage matches the actual wooden sword damage');
ok(valueFor('DURABILITY', sword.stats) === '22/55', 'Weapon popup shows the current instance durability');
ok(Boolean(sword.description), 'Weapon popup includes a short description');

const bow = getItemDetails(BOW_TOOLS[0]);
ok(valueFor('ARROW DAMAGE', bow.stats) === '6', 'Bow popup shows projectile damage, not its weak melee damage');
ok(valueFor('DURABILITY', getItemDetails(BOW_TOOLS[5]).stats) === '∞', 'Unbreakable bow popup displays infinite durability');

const arrows = getItemDetails(STONE_ARROW, { count: 16 });
ok(arrows.name.toLowerCase().includes('stone'), 'Arrow popup names the selected arrow type');
ok(valueFor('QUANTITY', arrows.stats) === '16' && valueFor('ARROW DAMAGE', arrows.stats) === '6.6', 'Arrow popup shows stack size and arrow damage');
ok(getItemDetails(FIRE_ARROW, { count: 8 }).description.toLowerCase().includes('ignit'), 'Special-arrow popup uses its effect description');
ok(valueFor('ARROW DAMAGE', getItemDetails(ARROW_ITEM).stats) === '6', 'Basic-arrow popup shows baseline projectile damage');

const apple = getItemDetails(APPLE, { count: 3 });
ok(valueFor('HEALING', apple.stats) === '+20 HP' && valueFor('QUANTITY', apple.stats) === '3', 'Food popup shows healing and stack quantity');
ok(getItemDetails(RAW_MEAT).description.toLowerCase().includes('cook'), 'Raw-food popup explains that the item must be cooked');
const dirt = getItemDetails(DIRT, { count: 12 });
ok(valueFor('QUANTITY', dirt.stats) === '12' && valueFor('USE', dirt.stats) === 'PLACEABLE', 'Block popup shows its quantity and placement use');
ok(valueFor('BREAK TIME', dirt.stats) === '0.5s', 'Block popup shows the registered mining time');

const gear: Item = {
  uid: 'test-item',
  hid: 300,
  slot: 'offhand',
  material: 'iron',
  rarity: 2,
  armor: 7,
  damage: 2,
  affixes: [{ id: 'fire', value: 3 }],
  crafted: false,
};
const gearDetails = getGearDetails(gear);
ok(valueFor('ARMOR', gearDetails.stats) === '7' && valueFor('DAMAGE', gearDetails.stats) === '2', 'Armor popup shows both protection and offhand damage');
ok(gearDetails.stats.some((stat) => stat.label === 'FLAME' && stat.value.includes('3')), 'Armor popup lists its rolled affix and value');
ok(getPetDetails('wolf').stats.length > 0, 'Companion popup includes its type and equip status');
ok(getPetDetails('parrot').name === 'Parrot companion' && getPetDetails('parrot').stats.length === 2, 'The parrot companion token has a descriptive, stat-bearing inventory popup');
ok(getPetDetails('owl').name === 'Eagle owl companion' && getPetDetails('owl').stats.length === 2, 'The eagle owl companion token has a descriptive, stat-bearing inventory popup');

const hudSource = readFileSync('src/ui/Hud.tsx', 'utf8');
ok(hudSource.includes("import { DurabilityBar, ToolSprite } from './ToolSprite'"), 'The in-game HUD imports the shared tool durability indicator');
ok(/<DurabilityBar[\s\S]*?current=\{durability\}[\s\S]*?max=\{maxDurability\}/.test(hudSource), 'The active game hotbar renders each tool’s live durability');
const inventorySource = readFileSync('src/ui/Inventory.tsx', 'utf8');
ok(inventorySource.includes('<ItemInfoPopup') && inventorySource.includes('onMouseEnter'), 'Inventory items reveal the detailed popup on hover and click');

export { passed, failures };
