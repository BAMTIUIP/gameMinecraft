import * as THREE from 'three';
import { Engine } from '../../src/game/engine';
import {
  AXE_TOOLS,
  BOW_TOOLS,
  HOE_TOOLS,
  PICK_TOOLS,
  SHOVEL_TOOLS,
  SWORD_TOOLS,
  TOOL_AXE,
  TOOL_HOE,
  TOOL_PICK,
  TOOL_SHOVEL,
  TOOL_SWORD,
  getToolSpec,
} from '../../src/game/tools';

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string) => {
  if (condition) passed += 1;
  else failures.push(label);
};

const engine = Object.create(Engine.prototype) as unknown as {
  buildToolModel: (id: number, wearRatio?: number) => THREE.Group;
  buildFancyDrop: (id: number, durability?: number) => THREE.Group | null;
};
const ids = [...new Set([
  TOOL_PICK, TOOL_SWORD, TOOL_AXE, TOOL_SHOVEL, TOOL_HOE,
  ...PICK_TOOLS, ...SWORD_TOOLS, ...AXE_TOOLS, ...SHOVEL_TOOLS, ...HOE_TOOLS, ...BOW_TOOLS,
])];

for (const id of ids) {
  const spec = getToolSpec(id);
  if (!spec || spec.maxDurability <= 0) continue;
  const pristine = engine.buildToolModel(id, 0);
  const worn = engine.buildToolModel(id, 1);
  pristine.updateMatrixWorld(true);
  worn.updateMatrixWorld(true);
  const wornBounds = new THREE.Box3().setFromObject(worn);
  const hasWearDeformation = (() => {
    let deformed = false;
    worn.traverse((object) => {
      if (Math.abs(object.scale.x - 1) > 0.001 || Math.abs(object.scale.y - 1) > 0.001 || Math.abs(object.scale.z - 1) > 0.001) deformed = true;
    });
    return deformed;
  })();
  ok(hasWearDeformation, `Tool ${id} deforms a component of the real held model as it wears`);
  ok(
    Number.isFinite(wornBounds.min.x) && Number.isFinite(wornBounds.max.y) &&
    wornBounds.max.x - wornBounds.min.x < 1.5 && wornBounds.max.y - wornBounds.min.y < 1.8,
    `Worn tool ${id} stays within a compact, finite model bound`,
  );
  pristine.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
  worn.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
}

const swordClean = engine.buildToolModel(SWORD_TOOLS[0], 0);
const swordWorn = engine.buildToolModel(SWORD_TOOLS[0], 1);
swordClean.updateMatrixWorld(true);
swordWorn.updateMatrixWorld(true);
const cleanSwordBounds = new THREE.Box3().setFromObject(swordClean);
const wornSwordBounds = new THREE.Box3().setFromObject(swordWorn);
ok(wornSwordBounds.max.y < cleanSwordBounds.max.y - 0.25, 'A worn sword has a visibly shorter blade while its grip and guard stay in place');

const wornBow = engine.buildToolModel(BOW_TOOLS[0], 1);
wornBow.updateMatrixWorld(true);
const wornBowBounds = new THREE.Box3().setFromObject(wornBow);
ok(wornBowBounds.max.x < 0.2, 'Bow wear marks stay on the bow limbs instead of appearing as detached blocks beside it');

const droppedSword = engine.buildFancyDrop(SWORD_TOOLS[0], 1);
let droppedSwordHasDeformation = false;
droppedSword?.traverse((object) => {
  if (Math.abs(object.scale.y - 1) > 0.001) droppedSwordHasDeformation = true;
});
ok(droppedSwordHasDeformation, 'A damaged tool dropped on the ground keeps its wear deformation');

export { passed, failures };
