/** Campfire geometry metadata and the requested smoke-column heights. */
import { AIR, CAMPFIRE, HAY_BALE } from '../../src/game/blocks';
import { buildChunkGeometry, CAMPFIRE_SMOKE_HEIGHT, HAY_CAMPFIRE_SMOKE_HEIGHT } from '../../src/game/mesher';
import { World } from '../../src/game/world';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

ok(CAMPFIRE_SMOKE_HEIGHT === 30, 'A normal campfire emits smoke for 30 blocks');
ok(HAY_CAMPFIRE_SMOKE_HEIGHT === 60, 'A campfire on a hay bale emits smoke for 60 blocks');

const world = new World(73);
world.genTerrain(0, 0);
world.set(5, 20, 5, HAY_BALE);
world.set(5, 21, 5, CAMPFIRE);
let geometry = buildChunkGeometry(world, 0, 0);
ok(geometry.campfires.length === 1 && geometry.campfires[0].hayBoost, 'Mesher marks a campfire over hay as smoke-boosted');
ok(geometry.decor !== null, 'Campfire keeps its crossed-log and stone-ring base in the decor pass');

world.set(5, 20, 5, AIR);
geometry = buildChunkGeometry(world, 0, 0);
ok(geometry.campfires.length === 1 && !geometry.campfires[0].hayBoost, 'A campfire without hay gets the normal smoke height');

export { passed, failures };
