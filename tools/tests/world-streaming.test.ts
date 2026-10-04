/** Incremental world/chunk work must produce the same deterministic result as the sync helpers. */
import { SEA, SURFACE_MESH_MIN_Y, World } from '../../src/game/world';
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

const preview = new World(4242);
preview.reset(4242);
const previewFirstStepDone = preview.advanceSurface(0, 0, 1);
ok(!previewFirstStepDone && !preview.hasSurface(0, 0), 'An incomplete surface preview is not exposed to the renderer');
let surfaceSteps = 1;
while (!preview.advanceSurface(0, 0, 16) && surfaceSteps < 1000) surfaceSteps++;
ok(preview.hasSurface(0, 0) && !preview.hasTerrain(0, 0) && surfaceSteps < 1000,
  'The visible surface can finish before deep terrain');
let sameSurface = true;
let surfaceMismatch = '';
for (let z = 0; z < 16 && sameSurface; z++) {
  for (let x = 0; x < 16 && sameSurface; x++) {
    const h = preview.getHeight(x, z);
    const topY = h <= SEA ? SEA : h;
    const previewId = preview.get(x, topY, z);
    const fullId = sync.get(x, topY, z);
    if (h !== sync.getHeight(x, z) || previewId !== fullId) {
      sameSurface = false;
      surfaceMismatch = `at ${x},${topY},${z}: preview height/block ${h}/${previewId}, full ${sync.getHeight(x, z)}/${fullId}`;
    }
  }
}
ok(sameSurface, 'The fast menu preview matches the eventual ground and exposed water/ice surface', surfaceMismatch);
ok(preview.get(8, SURFACE_MESH_MIN_Y - 1, 8) === 0, 'Unrequested underground layers remain empty in the surface preview');
preview.decorate(0, 0, true);
const previewTop = preview.get(8, preview.getHeight(8, 8), 8);
ok(preview.getChunk(0, 0)?.surfaceDecorated === true && !preview.hasTerrain(0, 0),
  'Menu foliage decoration does not mark underground terrain complete');
const fullUpgradeFirstStep = preview.advanceTerrain(0, 0, 1);
ok(!fullUpgradeFirstStep && preview.hasSurface(0, 0) && !preview.hasTerrain(0, 0) &&
  preview.get(8, preview.getHeight(8, 8), 8) === previewTop,
  'The rendered surface remains intact while full-depth terrain is built');
let fullUpgradeSteps = 1;
while (!preview.advanceTerrain(0, 0, 16) && fullUpgradeSteps < 1000) fullUpgradeSteps++;
ok(preview.hasTerrain(0, 0) && preview.getChunk(0, 0)?.state === 1 && fullUpgradeSteps < 1000,
  'A preview chunk can be upgraded to full terrain');
let sameUpgradedTerrain = true;
const upgraded = preview.getChunk(0, 0)!;
for (let i = 0; i < upgraded.blocks.length; i++) {
  if (upgraded.blocks[i] !== syncChunk.blocks[i]) { sameUpgradedTerrain = false; break; }
}
ok(sameUpgradedTerrain, 'Preview-to-full upgrade produces the same complete deterministic terrain');

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
