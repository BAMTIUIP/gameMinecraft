/** Incremental world/chunk work must produce the same deterministic result as the sync helpers. */
import { World } from '../../src/game/world';
import { buildChunkGeometry, buildChunkGeometrySteps } from '../../src/game/mesher';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const stepped = new World(4242);
stepped.reset(4242);
const sync = new World(4242);
sync.reset(4242);
const firstStepDone = stepped.advanceTerrain(0, 0, 1);
ok(!firstStepDone && !stepped.hasTerrain(0, 0), 'A partial terrain chunk is not exposed as finished');
ok(stepped.get(0, 0, 0) === 0, 'Consumers see empty space instead of partially written terrain');
let terrainSteps = 1;
while (!stepped.advanceTerrain(0, 0, 16) && terrainSteps < 1000) terrainSteps++;
sync.genTerrain(0, 0);
ok(stepped.hasTerrain(0, 0) && terrainSteps < 1000, 'Terrain generation completes across bounded steps');
const stepChunk = stepped.getChunk(0, 0)!;
const syncChunk = sync.getChunk(0, 0)!;
ok(stepChunk.state === syncChunk.state && stepChunk.blocks.length === syncChunk.blocks.length, 'Stepped and synchronous chunks have the same shape');
let sameBlocks = true;
for (let i = 0; i < stepChunk.blocks.length; i++) {
  if (stepChunk.blocks[i] !== syncChunk.blocks[i]) { sameBlocks = false; break; }
}
ok(sameBlocks, 'Stepped terrain preserves the deterministic voxel layout');
ok(stepChunk.height.every((height, index) => height === syncChunk.height[index]), 'Stepped terrain preserves the height map');

const sliced = buildChunkGeometrySteps(stepped, 0, 0, 1024, 240, 360);
let sliceCount = 0;
let meshResult = sliced.next();
while (!meshResult.done && sliceCount < 1000) {
  sliceCount++;
  meshResult = sliced.next();
}
const completeMesh = buildChunkGeometry(stepped, 0, 0);
ok(meshResult.done && sliceCount > 0, 'Chunk meshing yields work in small resumable pieces');
ok(meshResult.done && meshResult.value.solid?.getAttribute('position').count <= completeMesh.solid?.getAttribute('position').count!,
  'A vertical mesh band contains no more vertices than the full-depth mesh');
completeMesh.solid?.dispose();
completeMesh.cutout?.dispose();
completeMesh.water?.dispose();
completeMesh.decor?.dispose();
if (meshResult.done) {
  meshResult.value.solid?.dispose();
  meshResult.value.cutout?.dispose();
  meshResult.value.water?.dispose();
  meshResult.value.decor?.dispose();
}

export { passed, failures };
