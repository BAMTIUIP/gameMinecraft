import {
  ARROW_ITEM,
  DIRT,
  GOLD_ARROW,
  IRON_ARROW,
  NETHERITE_ARROW,
  PLANKS,
  STONE,
  STONE_ARROW,
} from '../../src/game/blocks';
import {
  arrowBreakChance,
  arrowBreaksOnBlock,
  bowArrowDamage,
  meleeAttackInterval,
  meleeDamage,
} from '../../src/game/combat';
import { MOBS } from '../../src/game/mobs';
import {
  AXE_TOOLS,
  BOW_TOOLS,
  HOE_TOOLS,
  PICK_TOOLS,
  SHOVEL_TOOLS,
  SWORD_TOOLS,
  TOOL_BOW,
  getToolSpec,
  toolWearRatio,
} from '../../src/game/tools';

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, actual?: string) => {
  if (condition) passed += 1;
  else failures.push(actual ? `${label} (получено: ${actual})` : label);
};
const close = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-9;

const weaponTables: Array<[string, readonly number[], readonly number[]]> = [
  ['pickaxe', PICK_TOOLS, [2, 3, 4, 2, 5, 6]],
  ['sword', SWORD_TOOLS, [4, 5, 6, 4, 7, 8]],
  ['axe', AXE_TOOLS, [7, 9, 9, 7, 9, 10]],
  ['shovel', SHOVEL_TOOLS, [2.5, 3.5, 4.5, 2.5, 5.5, 6.5]],
  ['hoe', HOE_TOOLS, [1, 1, 1, 1, 1, 1]],
];
for (const [kind, ids, expected] of weaponTables) {
  const actual = ids.map((id) => getToolSpec(id)?.attackDamage ?? Number.NaN);
  ok(actual.every((damage, index) => close(damage, expected[index])), `${kind} damage follows the material progression`, actual.join('/'));
}

ok(close(meleeDamage(-1), 1), 'An empty hand deals one predictable damage point');
ok(close(meleeDamage(SWORD_TOOLS[0]), 4), 'A wooden sword deals four damage points, rather than the former inflated value');
ok(close(meleeDamage(AXE_TOOLS[5]), 10), 'A netherite axe deals ten damage points');
ok(close(meleeDamage(PICK_TOOLS[0]), 2), 'A wooden pickaxe deals two damage points');
ok(close(meleeDamage(SHOVEL_TOOLS[0]), 2.5), 'A wooden shovel keeps its half-point damage');
ok(close(meleeDamage(HOE_TOOLS[5]), 1), 'A hoe remains a weak one-point melee weapon at every tier');
ok(close(meleeDamage(TOOL_BOW), 1), 'Hitting with a bow is treated like a fist, not like a projectile shot');
ok(close(meleeDamage(SWORD_TOOLS[0], 100), 7), 'Damage affixes are capped instead of dwarfing the weapon, while swift remains attack speed only');

ok(close(meleeAttackInterval(-1), 0.25), 'Unarmed swings recover at four attacks per second');
ok(close(meleeAttackInterval(SWORD_TOOLS[0]), 0.625), 'Swords use a faster but measured 0.625-second swing');
ok(close(meleeAttackInterval(AXE_TOOLS[0]), 1.25), 'Wooden and stone axes trade their heavy hit for a slower recovery');
ok(close(meleeAttackInterval(AXE_TOOLS[2]), 1 / 0.9), 'Iron axes recover at their material-specific speed');
ok(close(meleeAttackInterval(PICK_TOOLS[0]), 1 / 1.2), 'Pickaxes recover at 1.2 attacks per second');
ok(close(meleeAttackInterval(SHOVEL_TOOLS[0]), 1), 'Shovels recover once per second');
ok(
  close(meleeAttackInterval(HOE_TOOLS[0]), 1) && close(meleeAttackInterval(HOE_TOOLS[1]), 0.5) &&
  close(meleeAttackInterval(HOE_TOOLS[2]), 1 / 3) && close(meleeAttackInterval(HOE_TOOLS[3]), 1) &&
  close(meleeAttackInterval(HOE_TOOLS[4]), 0.25) && close(meleeAttackInterval(HOE_TOOLS[5]), 0.25),
  'Hoe swing speeds follow wood/gold, stone, iron, and diamond/netherite combat tiers',
);

ok(close(bowArrowDamage(BOW_TOOLS[0], ARROW_ITEM), 6), 'A basic instant bow shot is a consistent six-damage normal arrow');
ok(close(bowArrowDamage(BOW_TOOLS[5], ARROW_ITEM), 9), 'The strongest bow has a modest, explicit progression');
ok(close(bowArrowDamage(BOW_TOOLS[0], STONE_ARROW), 6.6), 'Stone arrows add a small predictable damage bonus');
ok(close(bowArrowDamage(BOW_TOOLS[0], IRON_ARROW), 7.2), 'Iron arrows scale damage consistently');
ok(close(bowArrowDamage(BOW_TOOLS[0], GOLD_ARROW), 7.5), 'Gold arrows have a modest predictable material bonus');
ok(close(bowArrowDamage(BOW_TOOLS[0], NETHERITE_ARROW), 8.1), 'Netherite arrows stay stronger without the old 2.2x damage spike');
ok(close(bowArrowDamage(BOW_TOOLS[0], 158), 6), 'Elemental arrows use status effects instead of a hidden random damage boost');

ok(arrowBreakChance(STONE) > arrowBreakChance(PLANKS), 'Stone is more likely to break an arrow than wood');
ok(arrowBreakChance(STONE) > arrowBreakChance(DIRT), 'Stone is more likely to break an arrow than dirt');
ok(arrowBreakChance(DIRT) < arrowBreakChance(PLANKS), 'Soft dirt is the safest common impact surface');
ok(arrowBreaksOnBlock(STONE, () => 0.31), 'A stone impact breaks an arrow when its sampled roll crosses the 32% threshold');
ok(!arrowBreaksOnBlock(STONE, () => 0.32), 'Stone impact survives once the roll reaches the break threshold');
ok(!arrowBreaksOnBlock(DIRT, () => 0.07), 'An arrow survives a high roll on soft ground');
ok(arrowBreaksOnBlock(DIRT, () => 0.05), 'A low roll can still break an arrow on soft ground');

ok(close(MOBS.cow.hp, 10), 'Cows use a familiar ten-point health pool so basic arrows consistently need two hits');
const cowAfterFirstBasicShot = MOBS.cow.hp - bowArrowDamage(BOW_TOOLS[0], ARROW_ITEM);
const cowAfterSecondBasicShot = cowAfterFirstBasicShot - bowArrowDamage(BOW_TOOLS[0], ARROW_ITEM);
ok(close(cowAfterFirstBasicShot, 4) && cowAfterSecondBasicShot <= 0, 'Two normal wooden-bow arrows kill a full-health cow predictably, without random critical damage');
ok(close(MOBS.sheep.hp, 8) && close(MOBS.chicken.hp, 4), 'Sheep and chickens use appropriately smaller health pools');
ok(close(MOBS.zombie.hp, 20) && close(MOBS.skeleton.hp, 20), 'Core hostile mobs use a consistent twenty-point health baseline');
ok(close(toolWearRatio(100, 100), 0) && close(toolWearRatio(50, 100), 0.5) && close(toolWearRatio(0, 100), 1), 'Wear is a continuous normalized value for gradual model deformation');
ok(close(toolWearRatio(0, 0), 0), 'The unbreakable material has no visible wear');

export { passed, failures };
