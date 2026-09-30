import * as THREE from 'three';
import {
  AIR,
  BED,
  BEDROCK,
  BLOCKS,
  CAMPFIRE,
  COAL,
  COBBLE,
  COOKED_MEAT,
  DIAMOND,
  DIAMOND_BLOCK,
  DOOR_IRON,
  DOOR_WOOD,
  GLASS,
  IRON,
  DIRT,
  GOLD,
  GOLD_BLOCK,
  GOLD_ORE,
  DIAMOND_ORE,
  EMERALD_ORE,
  COAL_BLOCK,
  IRON_BLOCK,
  REDSTONE_BLOCK,
  LAPIS_BLOCK,
  EMERALD_BLOCK,
  QUARTZ_BLOCK,
  REDSTONE,
  LAPIS,
  EMERALD,
  QUARTZ,
  GRASS,
  LAVA,
  LEAVES,
  LOG,
  PICKAXE_TIERS,
  PLANKS,
  RAW_MEAT,
  SAND,
  STONE,
  T,
  TORCH,
  WATER,
  ARROW_ITEM,
  FLOWER_RED,
  FLOWER_YELLOW,
  FLOWER_BLUE,
  BIRD_NEST, CHICKEN_NEST,
  ICE,
  ANVIL,
  TURTLE_EGG,
  HONEY,
  NETHERITE,
  HIVE,
  SNOW_GRASS,
  WOOL,
  FEATHER,
  TURTLE_SHELL,
  CRAB_SHELL,
  FISH_SCALE,
  CAT_CLAW,
  PENGUIN_EGG,
  CACTUS,
  CACTUS_PALE,
  BIRCH_LOG,
  APPLE_LEAVES,
  COCONUT_LEAVES, BANANA_LEAVES, PALM_LOG, VINE, COCONUT, BANANA, VOLCANIC_STONE,
  APPLE,
  CRAFTING_TABLE,
  TALL_GRASS,
  FERN,
  DEAD_BUSH,
  MUSHROOM,
  isFlower,
  isPlant,
  isInstaBreak,
  isLogId,
  isLeafId,
  WEB,
  BONE,
  FLESH,
  GUNPOWDER,
  LOOT_BAG,
  blockClass,
  isBreakable,
  isInteractive,
  isResource,
  isSolid,
} from './blocks';
import { CHUNK, ORIGIN_X, ORIGIN_Z, WY, World, chunkKey, keyToChunk, type Biome } from './world';
import {
  HAND,
  RECIPES,
  SWORDS,
  TOOL_AXE,
  TOOL_BOW,
  TOOL_PICK,
  TOOL_SHOVEL,
  TOOL_TORCH,
  PICK_TOOLS,
  SWORD_TOOLS,
  AXE_TOOLS,
  isPickTool,
  isSwordTool,
  isAxeTool,
  toolSellPrice,
  getSalvageForItemId,
  getSalvageForGear,
  type Recipe,
} from './recipes';
import { MobSystem, type Mob, type MobId } from './mobs';
import {
  AFFIXES,
  computeStats,
  damageReduction,
  EMPTY_STATS,
  ensureGearHid,
  isGearHotbarId,
  makeItem,
  MATERIALS,
  RARITY,
  rollLoot,
  SLOT_KEY,
  type AffixId,
  type Item,
  type Slot,
  type Stats,
} from './items';
import { blockName, matName, pickaxeLabel, recipeText, swordLabel, t } from './i18n';
import { yaServerTime } from './yandex';

const AFFIX_KEY = Object.fromEntries(
  (Object.keys(AFFIXES) as AffixId[]).map((k) => [k, AFFIXES[k].nameKey]),
) as Record<AffixId, Parameters<typeof t>[0]>;
const RARITY_COLORS = RARITY.map((r) => r.color);
import { buildChunkGeometry } from './mesher';
import { crackTileUV, getAtlasTexture, getCloudTexture, getCrackTexture, getSkyTexture, tileUV } from './textures';
import { mulberry32, seedNoise } from './noise';
import { initAudio, requestMusic, resumeAudio, sfx, stopMusic, suspendAudio } from './audio';

export type Phase = 'loading' | 'menu' | 'playing' | 'paused' | 'gameover';

export type HudState = {
  phase: Phase;
  loading: number;
  score: number;
  timeLeft: number;
  health: number;
  combo: number;
  comboMult: number;
  tier: number;
  tierName: string;
  blocksMined: number;
  bestCombo: number;
  deepest: number;
  oresFound: number;
  /** 10 fixed quick slots; `null` = empty hole (sparse hotbar) */
  hotbar: ({ id: number; count: number } | null)[];
  selected: number;
  target: { id: number; name: string } | null;
  banner: { text: string; sub: string; color: string; key: number } | null;
  deathCause: 'time' | 'lava' | 'fall' | 'mob' | null;
  fps: number;
  locked: boolean;
  lockFailed: boolean;
  freeLook: boolean;
  runTime: number;
  inventoryOpen: boolean;
  craftHint: string | null;
  inventory: { id: number; count: number }[];
  craftable: string[];
  lastCraft: string | null;
  // --- new: world clock, mobs, gear ---
  survival: boolean;
  daylight: number;
  timeOfDay: number;
  phaseName: 'day' | 'dusk' | 'night' | 'dawn';
  kills: number;
  heldName: string;
  heldKind: 'pick' | 'sword' | 'block' | 'fist' | 'torch' | 'axe' | 'shovel' | 'bow' | 'gear';
  offers: TradeOffer[];
  sellPrices: Record<number, number>;
  invTab: string;
  tradeNear: boolean;
  anvilNear: boolean;
  workbenchNear: boolean;
  sandbox: boolean;
  swordTier: number;
  equipped: Partial<Record<Slot, Item>>;
  bagItems: Item[];
  stats: Stats;
  killedBy: string | null;
};

export type DomRefs = {
  coords?: HTMLElement | null;
  compass?: HTMLElement | null;
  progress?: HTMLElement | null;
  comboBar?: HTMLElement | null;
  healthBar?: HTMLElement | null;
  timeBar?: HTMLElement | null;
  vignette?: HTMLElement | null;
  crosshair?: HTMLElement | null;
};

const RUN_TIME = 150;

/** selectable shift lengths (seconds) */
export const SESSION_LENGTHS = [
  { id: 'sprint', labelKey: 'sesSprint' as const, time: 150, sub: '2:30', accent: '#f4b942' },
  { id: 'shift', labelKey: 'sesFull' as const, time: 600, sub: '10:00', accent: '#93c95d' },
  { id: 'marathon', labelKey: 'sesMarathon' as const, time: 1200, sub: '20:00', accent: '#5fe8dc' },
  { id: 'half', labelKey: 'sesHalf' as const, time: 1800, sub: '30:00', accent: '#d9844a' },
  { id: 'hour', labelKey: 'sesHour' as const, time: 3600, sub: '1:00:00', accent: '#c58cff' },
  { id: 'double', labelKey: 'sesDouble' as const, time: 7200, sub: '2:00:00', accent: '#ff5f7a' },
] as const;

export type TradeOffer = { item: Item; cost: Array<[number, number]>; sold: boolean };
const MAX_PARTICLES = 520;
const MAX_DROPS = 44;
const GRAVITY = 30;
const JUMP_V = 9.4;
const WALK = 4.6;
const SPRINT = 7.1;
const PLAYER_HALF = 0.3;
const PLAYER_HEIGHT = 1.8;
const EYE = 1.62;
const REACH = 5.6;

type Popup = { x: number; y: number; z: number; vy: number; life: number; max: number; text: string; color: string; big: boolean; el: HTMLDivElement };
type WeatherKind = 'clear' | 'rain' | 'snow';
type Particle = { weather?: Exclude<WeatherKind, 'clear'>; smoke?: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number };
type Drop = {
  active: boolean;
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  mesh: THREE.Mesh;
  /** clearance between the pickup origin and the floor, including bobbing */
  clearance: number;
  /** rolled gear carried by a LOOT_BAG drop */
  gear?: Item | null;
  /** volumetric model used instead of the textured cube (animal/monster loot) */
  fancy?: THREE.Group | null;
  /** minimum age before player can pick up this drop (longer when thrown with G) */
  pickupDelay?: number;
  /** true when thrown by the player via G (avoids duplicate mining score on re-pickup) */
  thrown?: boolean;
};

export class Engine {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private hudScene!: THREE.Scene;
  private hudCamera!: THREE.PerspectiveCamera;
  private world = new World(1);
  private chunkMeshes = new Map<number, THREE.Mesh>();
  private cutoutMeshes = new Map<number, THREE.Mesh>();
  private material!: THREE.MeshLambertMaterial;
  private cutoutMat!: THREE.MeshLambertMaterial;
  private waterMat!: THREE.MeshBasicMaterial;
  private waterMeshes = new Map<number, THREE.Mesh>();
  private decorMat!: THREE.MeshBasicMaterial;
  private decorMeshes = new Map<number, THREE.Mesh>();
  /** horizontal draw distance in blocks (auto-tuned by the fps watchdog) */
  private renderDist = 132;
  private maxRenderDist = 132;

  private setRenderDist(d: number) {
    this.renderDist = Math.max(64, Math.min(this.maxRenderDist, d));
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.far = this.renderDist * 0.94;
      fog.near = fog.far * 0.38;
    }
  }

  private fx!: HTMLDivElement;
  private sunGlare!: HTMLDivElement;
  private popups: Popup[] = [];
  private particles: Particle[] = [];
  private pMesh!: THREE.InstancedMesh;
  private pDummy = new THREE.Object3D();
  private pColor = new THREE.Color();
  private drops: Drop[] = [];
  private dropUVBase = new Float32Array(48);
  private motes!: THREE.Points;
  private clouds!: THREE.Mesh;

  private highlight!: THREE.LineSegments;
  private crackMesh!: THREE.Mesh;
  private crackMat!: THREE.MeshBasicMaterial;
  private crackUVBase = new Float32Array(48);
  private crackStage = -1;
  private pickGroup!: THREE.Group;
  private pickHeadMats: THREE.MeshLambertMaterial[] = [];
  private pickBaseX = 0.44;
  private toolPick!: THREE.Group;
  private toolSword!: THREE.Group;
  private toolBlock!: THREE.Mesh;
  private toolItem!: THREE.Group;
  private toolLantern!: THREE.Group;
  private toolTorch!: THREE.Group;
  private toolHand!: THREE.Group;
  private toolAxe!: THREE.Group;
  private toolShovel!: THREE.Group;
  private toolBow!: THREE.Group;
  private toolGear!: THREE.Group;
  private gearPlateMat!: THREE.MeshLambertMaterial;
  private torchFlame!: THREE.Mesh;
  private torchFlameMat!: THREE.MeshBasicMaterial;
  private torchLight!: THREE.PointLight;
  private swordMat!: THREE.MeshLambertMaterial;
  private axeHeadMat!: THREE.MeshLambertMaterial;
  private axeEdgeMat!: THREE.MeshLambertMaterial;
  private blockUVBase = new Float32Array(48);
  private blockShown = -1;
  private itemShown = -1;
  private itemHasFancy = false;

  private dom: DomRefs = {};
  private onHud: (s: HudState) => void;

  // ---- run state ----
  phase: Phase = 'loading';
  /** the current pause was imposed by the system (hidden tab, focus loss, Yandex) — not chosen by the player */
  private pausedBySystem = false;
  private score = 0;
  private runTime = RUN_TIME;
  private timeLeft = RUN_TIME;
  private health = 100;
  private combo = 0;
  private comboTimer = 0;
  private bestCombo = 0;
  private blocksMined = 0;
  private oresFound = 0;
  private deepest = 0;
  private tier = 0;
  private inventory = new Map<number, number>();
  /** sparse 10-slot quick bar: blocks / tools / HAND / empty holes */
  private hotbar: (number | undefined)[] = [];
  private selected = 0;
  private deathCause: HudState['deathCause'] = null;
  // --- world clock / mobs / gear ---
  survival = true;
  private dayLen = 190;
  private clock = 0.28;
  private daylight = 1;
  private mobSys!: MobSystem;
  private spawnTimer = 0;
  private animalTimer = 0;
  private ambientTimer = 0;
  private kills = 0;
  private killedBy: string | null = null;
  private wasNight = false;
  private swordTier = -1;
  private equipped: Partial<Record<Slot, Item>> = {};
  private bagItems: Item[] = [];
  private stats: Stats = { ...EMPTY_STATS };
  private attackCd = 0;
  private sunLight!: THREE.DirectionalLight;
  private ambLight!: THREE.AmbientLight;
  private skyMesh!: THREE.Mesh;
  private skyMat!: THREE.MeshBasicMaterial;
  private sunDir = new THREE.Vector3(0, 1, 0);
  private sunMesh!: THREE.Mesh;
  private sunHaloMat!: THREE.MeshBasicMaterial;
  private moonMesh!: THREE.Object3D;
  private starMat!: THREE.PointsMaterial;
  private stars!: THREE.Points;
  private placedTorchLights: THREE.PointLight[] = [];
  private placedTorchScanTimer = 0;
  private weatherKind: WeatherKind = 'clear';
  private weatherTargetKind: WeatherKind = 'clear';
  private weatherIntensity = 0;
  private weatherTargetIntensity = 0;
  private weatherTimer = 0;
  private weatherSpawnAcc = 0;
  private banner: HudState['banner'] = null;
  private bannerTimer = 0;
  private loadTasks: (() => boolean)[] = [];
  private loadTotal = 0;
  private loadProgress = 0;

  // ---- player ----
  private pos = new THREE.Vector3(32, 30, 32);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = false;
  private fallStart = 0;
  private spawnY = 20;
  private spawnX = 0;
  private spawnZ = 0;
  private coyote = 0;
  private crouching = false;
  private crouchLerp = 0;
  private crawling = false;
  private crawlLerp = 0;

  /** collision height depends on posture: crawling fits through 1-block gaps */
  private playerHeight() {
    return this.crawling ? 0.72 : PLAYER_HEIGHT;
  }
  private sleeping = false;
  private sleepDark = 0;
  private inLava = false;
  private inWater = false;
  private cactusCooldown = 0;
  private volcanoSmokeTimer = 0;
  private desertWindTimer = 0;
  private hurtTimer = 0;
  private bob = 0;
  private stepSmooth = 0;
  private fovTarget = 72;
  private landDip = 0;

  // ---- input ----
  private keys: Record<string, boolean> = {};
  private touchMove = { x: 0, y: 0 };
  private touchJump = false;
  private touchMine = false;
  private touchPlace = false;
  private touchSprint = false;
  private mining = false;
  private placing = false;
  private placeCooldown = 0;
  private locked = false;
  /** pointer lock refused (sandboxed iframe / denied permission) → drag-look fallback */
  private lockFailed = false;
  private hoverX = 0.5;
  private hoverY = 0.5;
  private hoverActive = false;
  private freeLook = true;

  // ---- mining ----
  private target: { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number } | null = null;
  private mineProgress = 0;
  private mineBlockKey = '';
  private swingT = -1;
  private swingDur = 0.3;
  private swingStep = 0;
  private swingSoundAt = 0.45;

  // ---- fx ----
  private shake = 0;
  private shakeMag = 0;
  private flash = 0;
  private time = 0;
  private raf = 0;
  private last = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private slowFrames = 0;
  private basePixelRatio = 1;
  private disposed = false;
  private lastHudKey = '';
  private menuAngle = 0;
  private warnTick = 0;
  private rand = mulberry32(1);

  constructor(container: HTMLElement, onHud: (s: HudState) => void) {
    this.container = container;
    this.onHud = onHud;
  }

  // ================= SETUP =================
  mount() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, this.isCoarse() ? 1.5 : 2);
    // phones start with a tighter horizon; the watchdog opens it back up
    this.maxRenderDist = this.isCoarse() ? 104 : 132;
    this.renderDist = this.isCoarse() ? 88 : 132;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.autoClear = false;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color('#bcd7e8');
    // wider view on the big map, with the fog wall just inside the cull radius
    this.scene.fog = new THREE.Fog(fogColor, 48, 124);
    this.scene.background = fogColor;

    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.08, 600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.hudScene = new THREE.Scene();
    this.hudCamera = new THREE.PerspectiveCamera(68, w / h, 0.01, 12);
    this.hudScene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const dl = new THREE.DirectionalLight(0xfff2d8, 0.78);
    dl.position.set(0.5, 1, 0.7);
    this.hudScene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x9fc0ff, 0.28);
    dl2.position.set(-1, -0.3, -0.6);
    this.hudScene.add(dl2);

    // Lambert terrain keeps baked voxel AO via vertex colours, while real PointLights
    // from hand/placed torches can now illuminate the world locally at night.
    this.material = new THREE.MeshLambertMaterial({ map: getAtlasTexture(), vertexColors: true, fog: true, alphaTest: 0.08 });
    this.cutoutMat = new THREE.MeshLambertMaterial({
      map: getAtlasTexture(),
      vertexColors: true,
      fog: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.waterMat = new THREE.MeshBasicMaterial({
      map: getAtlasTexture(),
      vertexColors: true,
      fog: true,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    });
    this.decorMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });

    this.buildSky();
    this.buildParticles();
    this.buildDrops();
    this.buildMotes();
    this.buildHighlight();
    this.buildPickaxe();
    this.buildFxLayer();
    this.bindInput();
    this.layoutViewModel(w / h);
    this.setRenderDist(this.renderDist);
    this.mobSys = new MobSystem(this.scene, this.world);

    this.queueWorldGen(this.pickBalancedSeed());
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private pickBalancedSeed(): number {
    const c0x = Math.floor(ORIGIN_X / CHUNK);
    const c0z = Math.floor(ORIGIN_Z / CHUNK);
    let bestSeed = Math.floor(Math.random() * 1e9);
    let bestScore = -Infinity;

    for (let i = 0; i < 56; i++) {
      const candidate = Math.floor(Math.random() * 1e9);
      seedNoise(candidate);
      this.world.reset(candidate);

      const counts: Record<'plains' | 'winter' | 'jungle' | 'dry' | 'volcanic', number> = {
        plains: 0,
        winter: 0,
        jungle: 0,
        dry: 0,
        volcanic: 0,
      };
      let coreDry = 0;
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const biome = this.world.biomeAt((c0x + dx) * CHUNK + 8, (c0z + dz) * CHUNK + 8);
          const key = biome === 'desert' || biome === 'canyon' ? 'dry' : biome;
          counts[key]++;
          if (key === 'dry' && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) coreDry++;
        }
      }

      const values = Object.values(counts);
      const dominant = Math.max(...values);
      const diversity = values.filter((v) => v > 0).length;
      const hasGreenSpawn = counts.plains + counts.jungle + counts.winter;
      const target = 49 / 4;
      const balancePenalty = values.reduce((sum, v) => sum + Math.abs(v - target), 0);
      const dryPenalty = Math.max(0, counts.dry - 15) * 4 + coreDry * 3;
      const score = diversity * 26 + hasGreenSpawn * 0.35 - balancePenalty - dryPenalty - Math.max(0, dominant - 19) * 6;

      if (score > bestScore) {
        bestScore = score;
        bestSeed = candidate;
      }
      // Good enough: no biome dominates the starting area and dry biomes are not the core default.
      if (diversity >= 3 && dominant <= 18 && counts.dry <= 15 && coreDry <= 3 && hasGreenSpawn >= 18) return candidate;
    }
    return bestSeed;
  }

  private isCoarse() {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  }

  private buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(360, 28, 18),
      new THREE.MeshBasicMaterial({ map: getSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -100;
    this.scene.add(sky);
    this.skyMesh = sky;
    this.skyMat = sky.material as THREE.MeshBasicMaterial;

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(18, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, fog: false, transparent: true, opacity: 0.98, depthWrite: false, side: THREE.DoubleSide }),
    );
    const sunHalo = new THREE.Mesh(
      new THREE.CircleGeometry(52, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd36a,
        fog: false,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    sunHalo.position.z = -0.6;
    sun.add(sunHalo);
    this.sunHaloMat = sunHalo.material as THREE.MeshBasicMaterial;
    sun.frustumCulled = false;
    this.scene.add(sun);
    this.sunMesh = sun;

    // a proper round moon: soft halo + bright disc + a few dark craters
    const moon = new THREE.Group();
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(16, 32),
      new THREE.MeshBasicMaterial({ color: 0xaebfe8, fog: false, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(10, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false, transparent: true, opacity: 0.96, depthWrite: false, side: THREE.DoubleSide }),
    );
    disc.position.z = 0.5;
    moon.add(halo);
    moon.add(disc);
    const craterMat = new THREE.MeshBasicMaterial({
      color: 0xb8c4e0,
      fog: false,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const [cx2, cy2, r2] of [
      [-3.2, 2.4, 1.9],
      [2.8, -1.6, 1.4],
      [0.6, 3.6, 1.0],
      [-1.8, -3.0, 1.2],
    ] as const) {
      const crater = new THREE.Mesh(new THREE.CircleGeometry(r2, 20), craterMat);
      crater.position.set(cx2, cy2, 1);
      moon.add(crater);
    }
    moon.frustumCulled = false;
    this.scene.add(moon);
    this.moonMesh = moon;

    const starCount = this.isCoarse() ? 160 : 260;
    const starPos = new Float32Array(starCount * 3);
    const rand = mulberry32(7301);
    for (let i = 0; i < starCount; i++) {
      const a = rand() * Math.PI * 2;
      const y = 0.08 + rand() * 0.9;
      const r = Math.sqrt(Math.max(0, 1 - y * y)) * 330;
      starPos[i * 3] = Math.cos(a) * r;
      starPos[i * 3 + 1] = y * 330;
      starPos[i * 3 + 2] = Math.sin(a) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starCanvas = document.createElement('canvas');
    starCanvas.width = starCanvas.height = 16;
    const starCtx = starCanvas.getContext('2d')!;
    const sg = starCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    sg.addColorStop(0, 'rgba(255,255,255,1)');
    sg.addColorStop(0.35, 'rgba(210,230,255,.85)');
    sg.addColorStop(1, 'rgba(210,230,255,0)');
    starCtx.fillStyle = sg;
    starCtx.fillRect(0, 0, 16, 16);
    const starTex = new THREE.CanvasTexture(starCanvas);
    this.starMat = new THREE.PointsMaterial({
      size: 1.7,
      map: starTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      fog: false,
      sizeAttenuation: true,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.ambLight = new THREE.AmbientLight(0xdfe8ff, 0.55);
    this.scene.add(this.ambLight);
    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 1);
    this.sunLight.position.set(-0.5, 1, 0.35);
    this.scene.add(this.sunLight);

    const cloudTex = getCloudTexture();
    cloudTex.repeat.set(3, 3);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.58, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 118;
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);

    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffb15a, 0, 15, 1.55);
      light.visible = false;
      this.placedTorchLights.push(light);
      this.scene.add(light);
    }
  }

  private buildParticles() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // white vertex colours + per-instance colour → guarantees tinting on every three build
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    this.pMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pMesh.frustumCulled = false;
    this.pMesh.count = 0;
    const colors = new Float32Array(MAX_PARTICLES * 3).fill(1);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.pMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.pMesh);
  }

  private buildDrops() {
    const base = new THREE.BoxGeometry(1, 1, 1);
    this.dropUVBase = Float32Array.from((base.getAttribute('uv') as THREE.BufferAttribute).array as ArrayLike<number>);
    for (let i = 0; i < MAX_DROPS; i++) {
      const geo = base.clone();
      // the shared terrain material has vertexColors on — without a white colour
      // attribute the drops would shade to pure black
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3));
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.drops.push({ active: false, id: STONE, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, mesh, clearance: 0.32 });
    }
    base.dispose();
  }

  private buildMotes() {
    const N = 220;
    const pos = new Float32Array(N * 3);
    const rand = mulberry32(99);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rand() - 0.5) * 40;
      pos[i * 3 + 1] = rand() * 26;
      pos[i * 3 + 2] = (rand() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,235,0.95)');
    g.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
      sizeAttenuation: true,
      fog: false,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  private buildHighlight() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0b0d0c, transparent: true, opacity: 0.85, fog: false }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.crackMat = new THREE.MeshBasicMaterial({
      map: getCrackTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      fog: false,
      opacity: 0.92,
    });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), this.crackMat);
    this.crackMesh.visible = false;
    this.crackUVBase = Float32Array.from((this.crackMesh.geometry.getAttribute('uv') as THREE.BufferAttribute).array as ArrayLike<number>);
    this.scene.add(this.crackMesh);
  }

  private buildPickaxe() {
    this.pickGroup = new THREE.Group();

    // Chunky, oversized tool so it reads clearly against any terrain.
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0d0b, side: THREE.BackSide, fog: false });
    const parts: Array<{ geo: THREE.BoxGeometry; mat: THREE.Material; pos: [number, number, number]; rot?: [number, number, number]; head?: boolean }> = [];

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x9c7743 });
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x6e5129 });
    const headColors = [0xc79455, 0xa8aeb4, 0xeccaa2, 0x6cf2e4];
    headColors.forEach((c) => this.pickHeadMats.push(new THREE.MeshLambertMaterial({ color: c })));
    const headMat = this.pickHeadMats[0];

    parts.push({ geo: new THREE.BoxGeometry(0.1, 0.92, 0.1), mat: woodMat, pos: [0, -0.3, 0.08], rot: [0.2, 0, 0] });
    parts.push({ geo: new THREE.BoxGeometry(0.105, 0.2, 0.105), mat: woodDarkMat, pos: [0, -0.56, 0.13], rot: [0.2, 0, 0] });
    // head bar + two swept tips
    parts.push({ geo: new THREE.BoxGeometry(0.17, 0.18, 0.66), mat: headMat, pos: [0, 0.2, -0.02], head: true });
    parts.push({ geo: new THREE.BoxGeometry(0.15, 0.15, 0.26), mat: headMat, pos: [0, 0.15, -0.42], rot: [-0.55, 0, 0], head: true });
    parts.push({ geo: new THREE.BoxGeometry(0.15, 0.15, 0.26), mat: headMat, pos: [0, 0.15, 0.38], rot: [0.55, 0, 0], head: true });
    // collar where head meets shaft
    parts.push({ geo: new THREE.BoxGeometry(0.15, 0.14, 0.15), mat: new THREE.MeshLambertMaterial({ color: 0x3f4046 }), pos: [0, 0.06, 0.02] });

    this.toolPick = new THREE.Group();
    for (const p of parts) {
      const mesh = new THREE.Mesh(p.geo, p.mat);
      mesh.position.set(...p.pos);
      if (p.rot) mesh.rotation.set(...p.rot);
      if (p.head) mesh.name = 'head';
      this.toolPick.add(mesh);

      // fat black shell = cartoon outline, keeps the tool readable on bright sand
      const shell = new THREE.Mesh(p.geo, outlineMat);
      shell.position.copy(mesh.position);
      shell.rotation.copy(mesh.rotation);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolPick.add(shell);
    }
    // Minecraft grip: the head crosses the view so the whole T-shape reads,
    // handle runs to the lower-right, blade tips up-left.
    this.toolPick.rotation.set(-0.12, 1.32, 0.62);
    this.toolPick.position.set(0.02, -0.02, 0.06);
    this.pickGroup.add(this.toolPick);

    // ---- sword ----
    this.toolSword = new THREE.Group();
    const swordMat = new THREE.MeshLambertMaterial({ color: 0xd9dde2 });
    this.swordMat = swordMat;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.95, 0.05), swordMat);
    blade.position.y = 0.42;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.05), swordMat);
    tip.position.y = 0.96;
    tip.rotation.z = Math.PI / 4;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.09), new THREE.MeshLambertMaterial({ color: 0x8a6a3c }));
    guard.position.y = -0.08;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a4126 }));
    grip.position.y = -0.3;
    for (const part of [blade, tip, guard, grip]) {
      this.toolSword.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.rotation.copy(part.rotation);
      shell.scale.setScalar(1.13);
      shell.renderOrder = -1;
      this.toolSword.add(shell);
    }
    this.toolSword.rotation.set(0.05, 0.5, 0.85);
    this.toolSword.visible = false;
    this.pickGroup.add(this.toolSword);

    // ---- axe ----
    this.toolAxe = new THREE.Group();
    const axeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), new THREE.MeshLambertMaterial({ color: 0x9c7743 }));
    axeHandle.position.y = -0.15;
    const axeHeadMat = new THREE.MeshLambertMaterial({ color: 0xa8aeb4 });
    const axeEdgeMat = new THREE.MeshLambertMaterial({ color: 0xd6d9dd });
    this.axeHeadMat = axeHeadMat;
    this.axeEdgeMat = axeEdgeMat;
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.12), axeHeadMat);
    axeHead.position.set(0.16, 0.32, 0);
    const axeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.12), axeEdgeMat);
    axeEdge.position.set(0.33, 0.32, 0);
    for (const part of [axeHandle, axeHead, axeEdge]) {
      this.toolAxe.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolAxe.add(shell);
    }
    this.toolAxe.rotation.set(-0.12, 1.1, 0.62);
    this.toolAxe.visible = false;
    this.pickGroup.add(this.toolAxe);

    // ---- shovel ----
    this.toolShovel = new THREE.Group();
    const shHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshLambertMaterial({ color: 0x9c7743 }));
    shHandle.position.y = -0.1;
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.06), new THREE.MeshLambertMaterial({ color: 0xb9bec4 }));
    scoop.position.set(0, 0.42, 0);
    for (const part of [shHandle, scoop]) {
      this.toolShovel.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolShovel.add(shell);
    }
    this.toolShovel.rotation.set(-0.1, 0.9, 0.55);
    this.toolShovel.visible = false;
    this.pickGroup.add(this.toolShovel);

    // ---- bow ----
    this.toolBow = new THREE.Group();
    const bowMat2 = new THREE.MeshLambertMaterial({ color: 0x8a6a3c });
    const limbT = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.09), bowMat2);
    limbT.position.set(0.1, 0.42, 0);
    limbT.rotation.z = -0.5;
    const limbB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.09), bowMat2);
    limbB.position.set(0.1, -0.42, 0);
    limbB.rotation.z = 0.5;
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.11), new THREE.MeshLambertMaterial({ color: 0x6e5129 }));
    const stringMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xe8e2d2 }));
    stringMesh.position.set(0.24, 0, 0);
    for (const part of [limbT, limbB, grip2, stringMesh]) this.toolBow.add(part);
    this.toolBow.rotation.set(0, -0.5, 0.12);
    this.toolBow.visible = false;
    this.pickGroup.add(this.toolBow);

    // ---- bare hand: blocky forearm + fist, Minecraft first-person style ----
    this.toolHand = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4a7a52 });
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), skinMat);
    forearm.position.set(0, -0.14, 0.1);
    forearm.rotation.x = 0.5;
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.25), sleeveMat);
    sleeve.position.set(0, -0.34, 0.22);
    sleeve.rotation.x = 0.5;
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.26), skinMat);
    fist.position.set(0, 0.12, -0.03);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), skinMat);
    thumb.position.set(-0.13, 0.14, -0.06);
    for (const part of [forearm, sleeve, fist, thumb]) {
      this.toolHand.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.rotation.copy(part.rotation);
      shell.scale.setScalar(1.12);
      shell.renderOrder = -1;
      this.toolHand.add(shell);
    }
    this.toolHand.rotation.set(0.15, 0.35, 0.25);
    this.toolHand.position.set(0.05, -0.1, 0.05);
    this.toolHand.visible = false;
    this.pickGroup.add(this.toolHand);

    // ---- hand torch ----
    this.toolTorch = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), new THREE.MeshLambertMaterial({ color: 0x8b6a3c }));
    stick.position.y = -0.1;
    const headT = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.15, 0.13),
      new THREE.MeshBasicMaterial({ color: 0xffc84a }),
    );
    headT.position.y = 0.2;
    this.torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), this.torchFlameMat);
    flame.position.y = 0.33;
    this.torchFlame = flame;
    for (const part of [stick, headT, flame]) this.toolTorch.add(part);
    const stickShell = new THREE.Mesh(stick.geometry, outlineMat);
    stickShell.position.copy(stick.position);
    stickShell.scale.setScalar(1.15);
    stickShell.renderOrder = -1;
    this.toolTorch.add(stickShell);
    this.toolTorch.rotation.set(0.1, 0.2, 0.35);
    this.toolTorch.position.set(0, 0.05, 0);
    this.toolTorch.visible = false;
    this.pickGroup.add(this.toolTorch);

    // point light so the torch also lights up mobs at night
    this.torchLight = new THREE.PointLight(0xffb050, 0, 14, 1.6);
    this.scene.add(this.torchLight);

    // ---- held block ----
    this.toolBlock = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), this.material.clone());
    this.blockUVBase = Float32Array.from(
      (this.toolBlock.geometry.getAttribute('uv') as THREE.BufferAttribute).array as ArrayLike<number>,
    );
    this.toolBlock.geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(this.toolBlock.geometry.getAttribute('position').count * 3).fill(1), 3),
    );
    this.toolBlock.rotation.set(0.35, 0.7, 0.1);
    this.toolBlock.position.set(0, 0.02, 0);
    this.toolBlock.visible = false;
    this.pickGroup.add(this.toolBlock);

    // ---- 3D held Lantern matching logo.png ----
    this.toolLantern = new THREE.Group();
    const lIronDark = new THREE.MeshLambertMaterial({ color: 0x262423 });
    const lIronMid = new THREE.MeshLambertMaterial({ color: 0x363331 });
    const lIronTop = new THREE.MeshLambertMaterial({ color: 0x4b4846 });
    const lGlowOrange = new THREE.MeshBasicMaterial({ color: 0xf27d16 });
    const lGlowGold = new THREE.MeshBasicMaterial({ color: 0xffd836 });
    const lGlowYellow = new THREE.MeshBasicMaterial({ color: 0xffee58 });
    const lGlowWhite = new THREE.MeshBasicMaterial({ color: 0xffffe4 });
    const addLBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      this.toolLantern.add(m);
    };
    const lby = -0.22;
    for (const dx of [-0.1, 0.1]) {
      for (const dz of [-0.1, 0.1]) {
        addLBox(0.08, 0.03, 0.08, dx, lby + 0.015, dz, lIronDark);
      }
    }
    addLBox(0.3, 0.05, 0.3, 0, lby + 0.055, 0, lIronMid);
    const lgy = lby + 0.21;
    addLBox(0.23, 0.26, 0.23, 0, lgy, 0, lGlowOrange);
    addLBox(0.236, 0.18, 0.236, 0, lgy, 0, lGlowGold);
    addLBox(0.242, 0.12, 0.14, 0, lgy, 0, lGlowYellow);
    addLBox(0.14, 0.12, 0.242, 0, lgy, 0, lGlowYellow);
    addLBox(0.248, 0.052, 0.052, 0, lgy + 0.026, -0.026, lGlowWhite);
    addLBox(0.248, 0.052, 0.052, 0, lgy - 0.026, 0.026, lGlowWhite);
    addLBox(0.052, 0.052, 0.248, -0.026, lgy + 0.026, 0, lGlowWhite);
    addLBox(0.052, 0.052, 0.248, 0.026, lgy - 0.026, 0, lGlowWhite);
    for (const dx of [-0.112, 0.112]) {
      for (const dz of [-0.112, 0.112]) {
        addLBox(0.058, 0.26, 0.058, dx, lgy, dz, lIronDark);
      }
    }
    addLBox(0.32, 0.055, 0.32, 0, lby + 0.365, 0, lIronMid);
    addLBox(0.17, 0.036, 0.17, 0, lby + 0.41, 0, lGlowYellow);
    for (const dx of [-0.068, 0.068]) {
      for (const dz of [-0.068, 0.068]) {
        addLBox(0.054, 0.036, 0.054, dx, lby + 0.41, dz, lIronTop);
      }
    }
    addLBox(0.195, 0.05, 0.195, 0, lby + 0.45, 0, lIronTop);
    addLBox(0.036, 0.065, 0.036, -0.05, lby + 0.505, 0, lIronDark);
    addLBox(0.036, 0.065, 0.036, 0.05, lby + 0.505, 0, lIronDark);
    addLBox(0.136, 0.036, 0.036, 0, lby + 0.545, 0, lIronDark);
    this.toolLantern.rotation.set(0.22, 0.65, 0.08);
    this.toolLantern.position.set(0.02, 0.04, 0);
    this.toolLantern.visible = false;
    this.pickGroup.add(this.toolLantern);

    // ---- 3D held Armor / Gear plate ----
    this.toolGear = new THREE.Group();
    this.gearPlateMat = new THREE.MeshLambertMaterial({ color: 0xd6d9dd });
    const gearTrimMat = new THREE.MeshLambertMaterial({ color: 0x3b4046 });
    const gBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.12), this.gearPlateMat);
    const gShoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), this.gearPlateMat);
    gShoulderL.position.set(-0.2, 0.12, 0);
    const gShoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.14), this.gearPlateMat);
    gShoulderR.position.set(0.2, 0.12, 0);
    const gTrim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.13), gearTrimMat);
    gTrim.position.set(0, -0.16, 0);
    this.toolGear.add(gBody, gShoulderL, gShoulderR, gTrim);
    this.toolGear.rotation.set(0.2, 0.5, 0.05);
    this.toolGear.position.set(0.02, 0.02, 0);
    this.toolGear.visible = false;
    this.pickGroup.add(this.toolGear);

    // ---- 3D held Material / Resource Item (Lapis, Emerald, Diamond, Ingots, Drops, etc.) ----
    this.toolItem = new THREE.Group();
    this.toolItem.rotation.set(0.18, 0.55, 0.08);
    this.toolItem.position.set(0.02, 0.04, 0.02);
    this.toolItem.scale.setScalar(1.38);
    this.toolItem.visible = false;
    this.pickGroup.add(this.toolItem);

    this.pickGroup.position.set(0.44, -0.4, -0.72);
    this.pickGroup.rotation.set(0.35, -0.5, 0.22);
    this.hudScene.add(this.pickGroup);
  }

  /** swap the first-person model to match the selected hotbar slot */
  private syncViewModel() {
    if (!this.toolPick) return;
    const kind = this.heldKind();
    const heldId = this.hotbar[this.selected];
    const holdingLanternBlock = kind === 'block' && heldId === TORCH;
    const isCandidateItem =
      kind === 'block' && heldId !== undefined && !holdingLanternBlock && !BLOCKS[heldId]?.solid;
    if (isCandidateItem && heldId !== undefined && heldId !== this.itemShown) {
      this.itemShown = heldId;
      this.toolItem.clear();
      const fancy = this.buildFancyDrop(heldId);
      if (fancy) {
        this.toolItem.add(fancy);
        this.itemHasFancy = true;
      } else {
        this.itemHasFancy = false;
      }
    }
    const holdingFancyItem = isCandidateItem && this.itemHasFancy;

    this.toolPick.visible = kind === 'pick';
    this.toolHand.visible = kind === 'fist';
    this.toolSword.visible = kind === 'sword';
    this.toolBlock.visible = kind === 'block' && !holdingLanternBlock && !holdingFancyItem;
    this.toolItem.visible = holdingFancyItem;
    this.toolLantern.visible = holdingLanternBlock;
    this.toolTorch.visible = kind === 'torch';
    this.toolAxe.visible = kind === 'axe';
    this.toolShovel.visible = kind === 'shovel';
    this.toolBow.visible = kind === 'bow';
    this.toolGear.visible = kind === 'gear';
    if (kind === 'gear' && heldId !== undefined) {
      const g = this.bagItems.find((b) => b.hid === heldId);
      if (g && this.gearPlateMat) {
        this.gearPlateMat.color.set(MATERIALS[g.material]?.color ?? '#d6d9dd');
      }
    }
    if (kind === 'torch' || holdingLanternBlock) {
      // flame flicker + world light following the player
      const f = 0.85 + Math.sin(this.time * 11) * 0.12 + Math.sin(this.time * 23) * 0.06;
      if (kind === 'torch') {
        this.torchFlame.scale.set(f, 1.1 + (f - 0.85) * 1.6, f);
        this.torchFlameMat.opacity = 0.72 + f * 0.2;
      }
      this.torchLight.visible = true;
      this.torchLight.intensity = 3.1 + (1 - this.daylight) * 2.3;
      this.torchLight.distance = 15 + (1 - this.daylight) * 3;
      this.torchLight.position.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
      if (kind === 'torch' && Math.random() < 0.06) {
        this.burst(this.pos.x + (Math.random() - 0.5) * 0.3, this.pos.y + 1.75, this.pos.z + (Math.random() - 0.5) * 0.3, [255, 176, 58], 1, 0.7);
      }
    } else {
      this.torchLight.visible = false;
      this.torchLight.intensity = 0;
    }
    if (kind === 'sword' && this.swordMat) {
      this.swordMat.color.set(SWORDS[Math.max(0, this.heldSwordTier())].color);
    }
    if (kind === 'pick') {
      const c = PICKAXE_TIERS[this.heldPickTier()].color;
      this.pickHeadMats.forEach((m2) => m2.color.set(c));
    }
    if (kind === 'axe' && this.axeHeadMat && this.axeEdgeMat) {
      const tier = this.heldAxeTier();
      if (tier === 0) {
        this.axeHeadMat.color.set('#b98a4d');
        this.axeEdgeMat.color.set('#c09a61');
      } else {
        this.axeHeadMat.color.set('#a8aeb4');
        this.axeEdgeMat.color.set('#d6d9dd');
      }
    }
    if (kind === 'block') {
      const id = this.hotbar[this.selected];
      if (id !== undefined && id !== this.blockShown) {
        this.blockShown = id;
        const def = BLOCKS[id];
        const uv = this.toolBlock.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const base = this.blockUVBase;
        for (let f = 0; f < 6; f++) {
          const tile = f === 2 ? def.top : f === 3 ? def.bottom : def.side;
          const [u0, v0, u1, v1] = tileUV(tile);
          for (let i = 0; i < 4; i++) {
            const idx = f * 4 + i;
            uv.setXY(idx, u0 + (u1 - u0) * base[idx * 2], v0 + (v1 - v0) * base[idx * 2 + 1]);
          }
        }
        uv.needsUpdate = true;
      }
    }
  }

  private buildFxLayer() {
    this.fx = document.createElement('div');
    this.fx.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
    this.sunGlare = document.createElement('div');
    this.sunGlare.style.cssText =
      'position:absolute;inset:-18%;pointer-events:none;opacity:0;transition:opacity 80ms linear;mix-blend-mode:screen;background:radial-gradient(circle at 50% 50%, rgba(255,224,92,.48) 0%, rgba(255,190,45,.24) 12%, rgba(255,170,30,.08) 28%, rgba(255,190,30,0) 52%);';
    this.fx.appendChild(this.sunGlare);
    this.container.appendChild(this.fx);
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:0;top:0;will-change:transform,opacity;font-family:var(--font-display);font-weight:700;white-space:nowrap;text-shadow:2px 2px 0 rgba(0,0,0,.75);opacity:0;transform:translate3d(-999px,-999px,0);';
      this.fx.appendChild(el);
      this.popups.push({ x: 0, y: 0, z: 0, vy: 0, life: 0, max: 1, text: '', color: '#fff', big: false, el });
    }
  }

  // ================= WORLD GEN QUEUE =================
  private queueWorldGen(seed: number) {
    this.loadTasks = [];
    this.loadProgress = 0;
    this.weatherKind = 'clear';
    this.weatherTargetKind = 'clear';
    this.weatherIntensity = 0;
    this.weatherTargetIntensity = 0;
    this.weatherTimer = 6;
    this.weatherSpawnAcc = 0;
    seedNoise(seed);
    this.world.reset(seed);
    this.rand = mulberry32(seed);
    const c0x = Math.floor(ORIGIN_X / CHUNK);
    const c0z = Math.floor(ORIGIN_Z / CHUNK);
    const R = 4; // starter area: 9×9 chunk terrain, 7×7 decorated+meshed
    for (let cz = c0z - R; cz <= c0z + R; cz++)
      for (let cx = c0x - R; cx <= c0x + R; cx++) {
        this.loadTasks.push(() => {
          this.world.genTerrain(cx, cz);
          return true;
        });
      }
    for (let cz = c0z - R + 1; cz <= c0z + R - 1; cz++)
      for (let cx = c0x - R + 1; cx <= c0x + R - 1; cx++) {
        this.loadTasks.push(() => {
          this.world.decorate(cx, cz);
          return true;
        });
      }
    for (let cz = c0z - R + 1; cz <= c0z + R - 1; cz++)
      for (let cx = c0x - R + 1; cx <= c0x + R - 1; cx++) {
        this.loadTasks.push(() => {
          this.buildChunk(cx, cz);
          return true;
        });
      }
    this.loadTasks.push(() => {
      const [x, y, z] = this.world.findSpawn();
      this.pos.set(x, y, z);
      this.yaw = this.world.spawnYawFor(x, z);
      this.pitch = -0.14;
      this.seedStarterWildlife(x, z, this.yaw);
      return true;
    });
    this.loadTotal = this.loadTasks.length;
    this.phase = 'loading';
  }

  // ================= CHUNK STREAMING =================
  /** make sure a chunk is fully generated (terrain + neighbours + decoration) */
  private ensureDecorated(cx: number, cz: number) {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) this.world.genTerrain(cx + dx, cz + dz);
    const wasDecorated = this.world.isDecorated(cx, cz);
    this.world.decorate(cx, cz);
    // Decoration can spill structures, trees and lamps into neighbouring chunks.
    // If those neighbours were already meshed, rebuild them lazily to avoid
    // persistent see-through holes around large desert/jungle structures.
    if (!wasDecorated) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const key = chunkKey(cx + dx, cz + dz);
          if (this.chunkMeshes.has(key) || this.cutoutMeshes.has(key) || this.waterMeshes.has(key) || this.decorMeshes.has(key)) {
            this.dirtyChunks.add(key);
          }
        }
      }
    }
  }

  /**
   * The world streams in around the player: every frame we spend a small time
   * budget generating + meshing the nearest missing chunks, and drop meshes
   * that fell far behind. The map never ends.
   */
  private streamChunks(px: number, pz: number) {
    const t0 = performance.now();
    // adaptive budget: generous when we're fast, frugal when frames slip;
    // pending dirty-rebuilds always take priority over new terrain
    const budgetMs = this.dirtyChunks.size > 0 ? 2.5 : this.fps < 50 ? 4 : 7;
    const pcx = Math.floor(px / CHUNK);
    const pcz = Math.floor(pz / CHUNK);
    const radius = Math.ceil(this.renderDist / CHUNK) + 1;

    // spiral out from the player so close terrain always wins
    outer: for (let r = 0; r <= radius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = pcx + dx;
          const cz = pcz + dz;
          const key = chunkKey(cx, cz);
          if (this.chunkMeshes.has(key) || this.cutoutMeshes.has(key) || this.waterMeshes.has(key) || this.decorMeshes.has(key)) continue;
          if (this.meshedEmpty.has(key)) continue;
          this.ensureDecorated(cx, cz);
          this.buildChunk(cx, cz);
          if (performance.now() - t0 > budgetMs) break outer; // frame budget
        }
      }
    }

    // unload meshes far beyond the horizon (world data stays cached)
    if ((this.frameNo & 31) === 0) {
      const drop = (this.renderDist / CHUNK + 4) ** 2;
      for (const [key, mesh] of this.chunkMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.chunkMeshes.delete(key);
        }
      }
      for (const [key, mesh] of this.cutoutMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.cutoutMeshes.delete(key);
        }
      }
      for (const [key, mesh] of this.waterMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.waterMeshes.delete(key);
        }
      }
      for (const [key, mesh] of this.decorMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.decorMeshes.delete(key);
        }
      }
      for (const key of this.meshedEmpty) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) this.meshedEmpty.delete(key);
      }
    }
  }

  /** chunks that produced no geometry (all air) — remembered so we don't retry every frame */
  private meshedEmpty = new Set<number>();
  private frameNo = 0;

  /**
   * Deferred remeshing: simulations (fluids, gravity, trees) mark chunks dirty
   * and a fixed per-frame budget rebuilds them — a lava spill can touch dozens
   * of chunks without ever spiking a frame.
   */
  private dirtyChunks = new Set<number>();

  private markDirtyAt(x: number, z: number) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    this.dirtyChunks.add(chunkKey(cx, cz));
    // only touch neighbours when the edit sits on a chunk border
    if (lx === 0) this.dirtyChunks.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirtyChunks.add(chunkKey(cx + 1, cz));
    if (lz === 0) this.dirtyChunks.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirtyChunks.add(chunkKey(cx, cz + 1));
  }

  private flushDirtyChunks() {
    if (!this.dirtyChunks.size) return;
    const t0 = performance.now();
    for (const key of this.dirtyChunks) {
      this.dirtyChunks.delete(key);
      const [cx, cz] = keyToChunk(key);
      this.buildChunk(cx, cz);
      if (performance.now() - t0 > 4) break; // ~4ms budget per frame
    }
  }

  private buildChunk(cx: number, cz: number) {
    const key = chunkKey(cx, cz);
    const old = this.chunkMeshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
    const oldCut = this.cutoutMeshes.get(key);
    if (oldCut) {
      this.scene.remove(oldCut);
      oldCut.geometry.dispose();
      this.cutoutMeshes.delete(key);
    }
    const oldWater = this.waterMeshes.get(key);
    if (oldWater) {
      this.scene.remove(oldWater);
      oldWater.geometry.dispose();
      this.waterMeshes.delete(key);
    }
    const oldDecor = this.decorMeshes.get(key);
    if (oldDecor) {
      this.scene.remove(oldDecor);
      oldDecor.geometry.dispose();
      this.decorMeshes.delete(key);
    }
    const geo = buildChunkGeometry(this.world, cx, cz);
    if (geo.solid) {
      const mesh = new THREE.Mesh(geo.solid, this.material);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.chunkMeshes.set(key, mesh);
    }
    if (geo.cutout) {
      const mesh = new THREE.Mesh(geo.cutout, this.cutoutMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.cutoutMeshes.set(key, mesh);
    }
    if (geo.water) {
      const mesh = new THREE.Mesh(geo.water, this.waterMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.waterMeshes.set(key, mesh);
    }
    if (geo.decor) {
      const mesh = new THREE.Mesh(geo.decor, this.decorMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.decorMeshes.set(key, mesh);
    }
    if (!geo.solid && !geo.cutout && !geo.water && !geo.decor) this.meshedEmpty.add(key);
    else this.meshedEmpty.delete(key);
  }

  private updateChunkVisibility() {
    // distance culling is stable frame-to-frame — refresh it at 20Hz
    if ((this.frameNo % 3) !== 0) return;
    const cam = this.camera.position;
    const far = this.renderDist * this.renderDist;
    for (const [key, m] of this.chunkMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, m] of this.cutoutMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, m] of this.waterMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, m] of this.decorMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
  }

  private rebuildAt(x: number, z: number) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    this.buildChunk(cx, cz);
    if (lx === 0) this.buildChunk(cx - 1, cz);
    if (lx === CHUNK - 1) this.buildChunk(cx + 1, cz);
    if (lz === 0) this.buildChunk(cx, cz - 1);
    if (lz === CHUNK - 1) this.buildChunk(cx, cz + 1);
  }

  // ================= INPUT =================
  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c) && (this.phase === 'playing' || this.inventoryOpen)) {
      e.preventDefault();
    }
    if (this.keys[c]) return;
    this.keys[c] = true;

    // E = doors / windows / trader; TAB (or I) = inventory / workbench
    if (c === 'KeyE') {
      if (this.phase === 'playing') this.interact();
      else if (this.inventoryOpen) this.closeInventory();
      return;
    }
    if (c === 'Tab' || c === 'KeyI') {
      if (this.phase === 'playing') {
        e.preventDefault();
        this.openInventory();
      } else if (this.inventoryOpen) {
        e.preventDefault();
        this.closeInventory();
      }
      return;
    }
    if (this.inventoryOpen && c.startsWith('Digit')) {
      const r = RECIPES.find((rr) => rr.hotkey === c.slice(5));
      if (r) this.craft(r.key);
      return;
    }
    if (this.phase !== 'playing') return;
    if (c === 'KeyF') this.tryPlace();
    if (c === 'KeyG') {
      this.dropHeldItem();
      return;
    }
    if (c.startsWith('Digit')) {
      const n = parseInt(c.slice(5), 10);
      // 1-9 → slots 1-9, 0 → slot 10
      if (n >= 1 && n <= 9) this.selectSlot(n - 1);
      else if (n === 0) this.selectSlot(9);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement;
    this.lockPending = false;
    if (this.locked) this.lockFailed = false; // lock works — kill the fallback
    if (!this.locked && this.phase === 'playing') {
      this.mining = false;
      this.placing = false;
      // in drag-look fallback there is no lock to lose, so never pause on it.
      // Esc = the player paused; the lock also drops when the window loses focus — a system pause
      if (!this.isCoarse() && !this.lockFailed) this.pause(!document.hasFocus() || document.hidden);
    }
    this.syncHud(true);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (e.button === 1) e.preventDefault();
    // every click is a fresh chance to grab the pointer — user gesture context
    if (!this.locked && !this.isCoarse()) {
      this.lockFailed = false;
      this.requestLock();
    }
    if (e.button === 0) this.mining = true; // LMB = hit / mine / shoot
    else if (e.button === 2 || e.button === 1) {
      // RMB (and middle) = place, always — no more mode-dependent behaviour
      this.placing = true;
      this.tryPlace();
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mining = false;
    if (e.button === 2 || e.button === 1) this.placing = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (this.locked) {
      this.look(e.movementX * 0.0028, e.movementY * 0.0028);
      return;
    }
    if (this.phase !== 'playing' || this.isCoarse()) return;
    // lock unavailable → remember the cursor for edge-steering fallback,
    // and while any button is held give precise 1:1 drag aiming
    const r = this.renderer.domElement.getBoundingClientRect();
    this.hoverX = (e.clientX - r.left) / r.width;
    this.hoverY = (e.clientY - r.top) / r.height;
    this.hoverActive = true;
    if (this.lockFailed && (this.mining || this.placing)) {
      this.look(e.movementX * 0.0058, e.movementY * 0.0058);
    }
  };
  private onMouseLeave = () => {
    this.hoverActive = false;
  };

  /** hands-free steering — only as a fallback when pointer lock is unavailable */
  private updateHoverLook(dt: number) {
    if (!this.lockFailed) return; // browser lock works → cursor stays pinned centre
    if (this.locked || !this.hoverActive || this.isCoarse()) return;
    if (this.mining || this.placing) return; // drag aiming takes over
    if (this.phase !== 'playing' || !this.freeLook) return;
    const dead = 0.13;
    const ax = this.hoverX * 2 - 1;
    const ay = this.hoverY * 2 - 1;
    const curve = (v: number) => {
      const a = Math.abs(v);
      if (a < dead) return 0;
      const n = (a - dead) / (1 - dead);
      return Math.sign(v) * n * n * 1.9;
    };
    const dx = curve(ax) * dt * 2.35;
    const dy = curve(ay) * dt * 1.75;
    if (dx || dy) this.look(dx, dy);
  }

  setFreeLook(v: boolean) {
    this.freeLook = v;
    this.syncHud(true);
  }
  get freeLookEnabled() {
    return this.freeLook;
  }
  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing') return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    // cycle through all 10 fixed slots — an empty hole selects the bare hand
    this.selectSlot((this.selected + dir + 10) % 10);
  };
  private onContext = (e: Event) => e.preventDefault();
  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hudCamera.aspect = w / h;
    this.hudCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.layoutViewModel(w / h);
  };

  /** keeps the first-person pickaxe on screen for portrait phones as well as widescreens */
  private layoutViewModel(aspect: number) {
    if (!this.pickGroup) return;
    const portrait = aspect < 1;
    this.pickBaseX = portrait ? 0.24 : aspect < 1.35 ? 0.38 : 0.5;
    this.pickGroup.scale.setScalar(portrait ? 0.95 : aspect < 1.35 ? 1.1 : 1.22);
  }

  private onBlur = () => {
    // window lost focus → browsers swallow the keyup; drop every held key so
    // crouch/sprint/crawl can't get stuck on
    this.keys = {};
    this.mining = false;
    this.placing = false;
  };

  /** Yandex Games requirement: hidden tab ⇒ game paused + audio silenced */
  private onVisibility = () => {
    if (document.hidden) this.systemPause();
    else resumeAudio(); // the run itself waits for the player (or for the platform's resume event)
  };

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContext);
    el.addEventListener('mouseleave', this.onMouseLeave);
  }

  requestLock() {
    initAudio();
    const el = this.renderer.domElement;
    if (this.isCoarse() || this.lockFailed) return;
    if (document.pointerLockElement === el) return;
    this.lockPending = true;
    const fail = () => {
      this.lockPending = false;
      this.lockFailed = true;
      this.syncHud(true);
    };
    window.setTimeout(() => {
      this.lockPending = false;
      if (!this.locked) this.lockFailed = true;
      this.syncHud(true);
    }, 900);
    try {
      const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(fail);
    } catch {
      fail();
    }
  }
  private lockPending = false;

  private onPointerLockError = () => {
    this.lockPending = false;
    this.lockFailed = true;
    this.syncHud(true);
  };

  // public input API (touch UI)
  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch -= dy;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
  }
  setMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }
  setJump(v: boolean) {
    this.touchJump = v;
  }
  setMining(v: boolean) {
    initAudio();
    this.mining = v;
  }
  setSprint(v: boolean) {
    this.touchSprint = v;
  }
  setPlacing(v: boolean) {
    // touch: the PLACE button doubles as the door/window toggle
    if (v && !this.interact()) this.tryPlace();
    this.placing = v;
  }
  selectSlot(i: number) {
    // 10 fixed slots — selecting an empty hole falls back to the bare hand
    if (i < 0 || i >= 10) return;
    this.selected = i;
    sfx.ui(true);
    this.syncHotbar(true);
  }

  /**
   * First empty hotbar slot (0-9), or -1 when the bar is full.
   * The hotbar is sparse: slots can hold blocks, tools, the HAND pseudo-item or be empty.
   */
  private firstFreeSlot(): number {
    for (let i = 0; i < 10; i++) if (this.hotbar[i] === undefined) return i;
    return -1;
  }

  /**
   * Unified hotbar placement (drag&drop + click):
   * - fromSlot defined → the item is dragged from another hotbar slot:
   *   occupied target → swap, empty target → move.
   * - fromSlot undefined → the item comes from the inventory list:
   *   placed into the target slot, evicting the occupant (which stays owned in
   *   the inventory). The HAND pseudo-item can never be pushed out of the bar.
   */
  placeInSlot(id: number, slot: number | undefined, fromSlot?: number) {
    if (id === undefined || id === null) return;
    const target = slot !== undefined ? Math.max(0, Math.min(9, Math.trunc(slot))) : this.firstFreeSlot();
    if (target < 0) {
      sfx.ui(false);
      return;
    }

    if (fromSlot !== undefined) {
      if (this.hotbar[fromSlot] !== id) return;
      if (target === fromSlot) return;
      const occupant = this.hotbar[target];
      this.hotbar[fromSlot] = occupant; // swap if occupied, clear if empty
      this.hotbar[target] = id;
    } else {
      // from the inventory list — ownership must exist (the HAND only lives in the bar)
      const owned =
        id === HAND
          ? this.hotbar.includes(HAND)
          : isGearHotbarId(id)
            ? this.bagItems.some((b) => b.hid === id)
            : (this.inventory.get(id) ?? 0) > 0;
      if (!owned) return;
      const occupant = this.hotbar[target];
      if (occupant === HAND) {
        sfx.ui(false); // the hand is permanent — clear that slot first
        return;
      }
      // one placement per item: move it if it sits in another slot
      const existing = this.hotbar.indexOf(id);
      if (existing >= 0 && existing !== target) this.hotbar[existing] = undefined;
      // the evicted occupant keeps its ownership in the inventory — just clear the slot
      this.hotbar[target] = id;
    }

    this.selected = target;
    sfx.ui(true);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /**
   * Remove an item from a hotbar slot (drag it back toward the inventory area).
   * Blocks/tools keep their ownership in the inventory list.
   * The HAND pseudo-item can't disappear — it slides back to slot 1.
   */
  removeFromSlot(slot: number) {
    const i = Math.max(0, Math.min(9, Math.trunc(slot) || 0));
    const id = this.hotbar[i];
    if (id === undefined) return;
    if (id === HAND) {
      if (i === 0) return;
      if (this.hotbar[0] !== undefined) {
        sfx.ui(false);
        return;
      }
      this.hotbar[0] = HAND;
      this.hotbar[i] = undefined;
    } else {
      this.hotbar[i] = undefined;
    }
    if (this.selected === i) this.selected = 0;
    sfx.ui(true);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  setDom(refs: DomRefs) {
    this.dom = refs;
  }

  // ================= SANDBOX: MY WORLD (save / load, no timer) =================
  sandbox = false;
  private static SAVE_KEY = 'orerush.myworld.v1';

  static hasSavedWorld(): boolean {
    try {
      return localStorage.getItem(Engine.SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  private static rleEnc(arr: Uint8Array | Int16Array): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < arr.length) {
      const v = arr[i];
      let n = 1;
      while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
      out.push(n, v);
      i += n;
    }
    return out;
  }

  private static rleDec(pairs: number[], len: number, into: Uint8Array | Int16Array) {
    let idx = 0;
    for (let i = 0; i < pairs.length && idx < len; i += 2) {
      const n = pairs[i];
      const v = pairs[i + 1];
      for (let k = 0; k < n && idx < len; k++) into[idx++] = v;
    }
  }

  /** snapshot the whole run into localStorage; returns false on quota errors */
  saveWorld(): boolean {
    try {
      const chunks: Array<[number, number, number[], number[]]> = [];
      for (const [key, ch] of this.world.chunks) {
        chunks.push([key, ch.state, Engine.rleEnc(ch.blocks), Engine.rleEnc(ch.height)]);
      }
      const data = {
        v: 1,
        savedAt: yaServerTime(),
        seed: this.world.seed,
        clock: this.clock,
        pos: [this.pos.x, this.pos.y, this.pos.z],
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        score: this.score,
        inventory: Array.from(this.inventory.entries()),
        hotbar: this.hotbar.slice(),
        selected: this.selected,
        tier: this.tier,
        swordTier: this.swordTier,
        equipped: this.equipped,
        bagItems: this.bagItems,
        hive: Array.from(this.hiveHoney.entries()),
        birdNests: this.birdNests,
        vineTips: Array.from(this.vineTips.entries()),
        kills: this.kills,
        blocksMined: this.blocksMined,
        chunks,
      };
      localStorage.setItem(Engine.SAVE_KEY, JSON.stringify(data));
      this.pushBanner(t('worldSaved'), '', '#93c95d');
      sfx.upgrade();
      return true;
    } catch {
      this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
      sfx.ui(false);
      return false;
    }
  }

  /** restore a saved sandbox world and jump straight into it */
  loadWorld(): boolean {
    let data: ReturnType<typeof JSON.parse>;
    try {
      const raw = localStorage.getItem(Engine.SAVE_KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!data || data.v !== 1) return false;

    // fresh run scaffolding first (clears mobs/doors/trees/fluids/meshes)
    this.startRun(undefined, true);

    // then overwrite the world with the saved chunks
    this.world.reset(data.seed);
    for (const [key, state, blocksRLE, heightRLE] of data.chunks) {
      const blocks = new Uint8Array(CHUNK * WY * CHUNK);
      const height = new Int16Array(CHUNK * CHUNK);
      Engine.rleDec(blocksRLE, blocks.length, blocks);
      Engine.rleDec(heightRLE, height.length, height);
      this.world.chunks.set(key, { blocks, height, state });
    }
    this.clearAllMeshes();

    // player + progress state
    this.pos.set(data.pos[0], data.pos[1], data.pos[2]);
    this.spawnX = data.pos[0];
    this.spawnY = data.pos[1];
    this.spawnZ = data.pos[2];
    this.yaw = data.yaw;
    this.pitch = data.pitch;
    this.health = data.health;
    this.score = data.score;
    this.inventory = new Map(data.inventory);
    // normalize the quick bar to the sparse 10-slot model (old saves are dense;
    // JSON round-trips empty holes as null)
    const rawBar: unknown[] = Array.isArray(data.hotbar) ? (data.hotbar as unknown[]) : [HAND];
    this.hotbar = rawBar.slice(0, 10).map((x) => (typeof x === 'number' ? x : undefined));
    this.selected = Math.max(0, Math.min(9, Number(data.selected) || 0));
    this.tier = data.tier;
    this.swordTier = data.swordTier;
    this.equipped = data.equipped ?? {};
    this.bagItems = (data.bagItems ?? []).map((it: Item) => ensureGearHid(it));
    this.stats = computeStats(this.equipped);
    this.hiveHoney = new Map(data.hive ?? []);
    this.birdNests = (Array.isArray(data.birdNests) ? data.birdNests : []).slice(0, 6);
    this.vineTips = new Map((Array.isArray(data.vineTips) ? data.vineTips : []).slice(0, 128));
    this.kills = data.kills ?? 0;
    this.blocksMined = data.blocksMined ?? 0;
    this.clock = data.clock ?? 0.3;
    this.updateClock(0);
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  private clearAllMeshes() {
    const wipe = (m2: Map<number, THREE.Mesh>) => {
      for (const [, mesh] of m2) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
      m2.clear();
    };
    wipe(this.chunkMeshes);
    wipe(this.cutoutMeshes);
    wipe(this.waterMeshes);
    wipe(this.decorMeshes);
    this.meshedEmpty.clear();
    this.dirtyChunks.clear();
  }

  // ================= PHASE CONTROL =================
  startRun(seconds?: number, sandbox = false) {
    this.sandbox = sandbox;
    initAudio();
    stopMusic(0.4);
    if (seconds && seconds > 0) this.runTime = seconds;
    this.score = 0;
    this.timeLeft = this.runTime;
    this.health = 100;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.blocksMined = 0;
    this.oresFound = 0;
    this.deepest = 0;
    this.tier = 0;
    this.inventory.clear();
    this.hotbar = [];
    this.selected = 0;
    this.deathCause = null;
    this.inventoryOpen = false;
    this.lastCraft = null;
    this.prevHint = null;
    this.vel.set(0, 0, 0);
    this.mineProgress = 0;
    this.mineBlockKey = '';
    this.swingT = -1;
    this.shake = 0;
    this.shakeMag = 0;
    this.flash = 0;
    this.warnTick = 0;
    this.hurtTimer = 0;
    this.inLava = false;
    this.cactusCooldown = 0;
    this.particles.length = 0;
    this.pMesh.count = 0;
    this.drops.forEach((d) => {
      d.active = false;
      d.mesh.visible = false;
      if (d.fancy) {
        this.scene.remove(d.fancy);
        d.fancy = null;
      }
    });
    this.popups.forEach((p) => {
      p.life = 0;
      p.el.style.opacity = '0';
    });
    [DIRT, COBBLE, SAND, PLANKS, STONE, LEAVES].forEach((id) => this.inventory.set(id, 0));
    // the bare hand starts in slot 1 — it can be dragged to any slot later
    this.hotbar = [HAND];
    this.selected = 0;
    this.swordTier = -1;
    this.equipped = {};
    this.bagItems = [];
    this.stats = { ...EMPTY_STATS };
    this.kills = 0;
    this.killedBy = null;
    this.attackCd = 0;
    this.clock = 0.3;
    this.daylight = 1;
    this.wasNight = false;
    this.sleeping = false;
    this.sleepDark = 0;
    this.crouching = false;
    this.crouchLerp = 0;
    this.crawling = false;
    this.crawlLerp = 0;
    this.spawnTimer = 3;
    this.animalTimer = 1;
    this.ambientTimer = 1.5;
    this.mobSys.clear();
    this.clearFallingTrees();
    this.clearDoors();
    this.gravQueue.length = 0;
    this.gravSet.clear();
    this.fluidQueue.length = 0;
    this.fluidSet.clear();
    this.fluidLevel.clear();
    this.vineTips.clear();
    this.birdNests.length = 0;
    this.birdNestTimer = 10;
    this.guardedSites.clear();
    this.clearArrows();
    this.rollTraderOffers();
    // traders now wander in from the wild as you travel (see wanderTraderTimer)
    this.wanderTraderTimer = 15;
    this.stockedWater.clear();
    this.travelDir.x = 0;
    this.travelDir.z = 0;
    this.travelSpeed = 0;
    this.turtleEggs.length = 0;
    this.eggTimer = 12;
    this.hiveHoney.clear();
    this.hiveBees.clear();
    this.predTimer = 0;
    this.spiderEggs.length = 0;
    this.spiderTimer = 10;
    const [x, y, z] = this.world.findSpawn();
    this.pos.set(x, y, z);
    this.spawnY = y;
    this.spawnX = x;
    this.spawnZ = z;
    this.fallStart = y;
    this.yaw = this.world.spawnYawFor(x, z);
    this.pitch = -0.1;
    this.seedStarterWildlife(x, z, this.yaw);
    this.deepest = 0;
    this.phase = 'playing';
    this.banner = null;
    this.pushBanner(t('shiftStart'), t('shiftStartSub'), '#f4b942');
    this.updatePickaxe();
    sfx.start();
    this.requestLock();
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private seedStarterWildlife(x: number, z: number, yaw: number) {
    const fwdAngle = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    const biome = this.world.biomeAt(Math.floor(x), Math.floor(z));
    const isDry = biome === 'desert' || biome === 'canyon';
    const species: MobId[] =
      biome === 'winter'
        ? ['penguin', 'seal', 'rabbit']
        : isDry
          ? ['tumbleweed', 'tumbleweed', 'camel', 'lizard']
          : biome === 'jungle'
            ? ['bird', 'monkey', 'bee', 'rabbit']
            : ['cow', 'sheep', 'chicken', 'rabbit'];
    const preferredGround = isDry ? [SAND] : biome === 'winter' ? [SNOW_GRASS] : [GRASS];
    for (const id of species) {
      const spot = this.mobSys.findSpawnPoint(x, z, 6, 22, fwdAngle, preferredGround);
      if (spot) this.mobSys.spawn(id, spot[0], spot[1], spot[2]);
    }
  }

  regenerate(seed?: number) {
    const nextSeed = seed ?? this.pickBalancedSeed();
    this.mobSys?.clear();
    this.clearFallingTrees();
    this.clearDoors();
    for (const [, m] of this.chunkMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.chunkMeshes.clear();
    for (const [, m] of this.cutoutMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.cutoutMeshes.clear();
    for (const [, m] of this.waterMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.waterMeshes.clear();
    for (const [, m] of this.decorMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.decorMeshes.clear();
    this.meshedEmpty.clear();
    this.queueWorldGen(nextSeed);
  }

  pause(bySystem = false) {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.pausedBySystem = bySystem;
    this.mining = false;
    this.placing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.ui(false);
    this.syncHud(true);
  }

  resume(bySystem = false) {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.pausedBySystem = false;
    if (!bySystem) sfx.ui(true);
    // a pointer-lock request needs a user gesture; after a platform resume there usually was none, and a
    // refused request would only flag lockFailed — the HUD's "click to capture the mouse" covers that case
    if (!bySystem || navigator.userActivation?.isActive) this.requestLock();
    this.syncHud(true);
  }

  /**
   * Yandex Games asks the game to pause (ad or purchase window, tab switch, minimised window, focus moved
   * to another window) — or the tab was hidden: freeze the run and silence the audio. The platform calls
   * GameplayAPI.stop() for these on its own, so the game has to actually stop.
   */
  systemPause() {
    this.pause(true);
    suspendAudio();
  }

  /**
   * …and the counterpart: the platform calls GameplayAPI.start() on its own, so a run that *the system*
   * froze continues. A pause the player chose (Esc, menu, inventory) is never undone behind their back.
   */
  systemResume() {
    resumeAudio();
    if (this.phase === 'paused' && this.pausedBySystem) this.resume(true);
  }

  toMenu() {
    this.phase = 'menu';
    this.inventoryOpen = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.mining = false;
    requestMusic();
    this.syncHud(true);
  }

  setSurvival(v: boolean) {
    this.survival = v;
    if (!v) {
      // explorer mode clears anything hostile already walking around
      for (let i = this.mobSys.mobs.length - 1; i >= 0; i--) {
        const m = this.mobSys.mobs[i];
        if (m.def.hostile) this.mobSys.remove(m);
      }
    }
    this.syncHud(true);
  }

  setRunTime(seconds: number) {
    this.runTime = seconds;
    if (this.phase === 'menu' || this.phase === 'loading') this.timeLeft = seconds;
    this.syncHud(true);
  }

  endRun(cause: 'time' | 'lava' | 'fall' | 'mob') {
    if (this.phase !== 'playing') return;
    this.sleeping = false;
    this.sleepDark = 0;
    this.phase = 'gameover';
    this.deathCause = cause;
    this.mining = false;
    this.addShake(cause === 'time' ? 0.25 : 1.1);
    this.flash = 1;
    if (document.pointerLockElement) document.exitPointerLock();
    if (cause !== 'mob') this.killedBy = null;
    if (cause === 'time') sfx.win();
    else sfx.gameOver();
    // let the jingle breathe, then bring the theme back under the score screen
    window.setTimeout(() => {
      if (this.phase === 'gameover') requestMusic();
    }, 1800);
    this.burst(this.pos.x, this.pos.y + 1, this.pos.z, cause === 'time' ? [255, 220, 120] : [255, 90, 60], 34, 5);
    this.syncHud(true);
  }

  private gameOverState(): HudState['deathCause'] {
    return this.deathCause;
  }

  // ================= LOOP =================
  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 1 / 60;
    this.time += dt;
    this.frameNo++;

    // fps + adaptive resolution
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      const cap = Math.min(window.devicePixelRatio || 1, 2);
      if (this.fps < 42) {
        this.slowFrames++;
        if (this.slowFrames > 2) {
          // pull the horizon in first — cheaper than losing sharpness
          if (this.renderDist > 72) this.setRenderDist(this.renderDist - 16);
          else if (this.renderer.getPixelRatio() > 0.85)
            this.renderer.setPixelRatio(Math.max(0.85, this.renderer.getPixelRatio() - 0.25));
          this.slowFrames = 0;
        }
      } else if (this.fps > 57) {
        if (this.renderer.getPixelRatio() < this.basePixelRatio)
          this.renderer.setPixelRatio(Math.min(cap, this.renderer.getPixelRatio() + 0.25));
        else if (this.renderDist < this.maxRenderDist) this.setRenderDist(this.renderDist + 8);
        this.slowFrames = 0;
      } else this.slowFrames = 0;
    }

    if (this.phase === 'loading') this.stepLoading();
    else if (this.phase === 'menu') this.updateMenu(dt);
    else if (this.phase === 'playing') this.updatePlay(dt);
    else if (this.phase === 'paused') this.updateIdle(dt);
    else this.updateGameOver(dt);

    this.render();
  };

  private stepLoading() {
    // spend a fixed slice of the frame so the progress bar stays smooth
    const t0 = performance.now();
    let n = 0;
    while (this.loadTasks.length && n < 8 && performance.now() - t0 < 14) {
      this.loadTasks.shift()!();
      n++;
    }
    this.loadProgress = this.loadTotal ? 1 - this.loadTasks.length / this.loadTotal : 0;
    if (!this.loadTasks.length) {
      this.phase = 'menu';
      this.loadProgress = 1;
      requestMusic();
      this.syncHud(true);
    } else {
      // re-render React only when the visible percentage actually changes
      const pct = Math.round(this.loadProgress * 100);
      if (pct !== this.lastLoadPct) {
        this.lastLoadPct = pct;
        this.syncHud(true);
      }
    }
  }
  private lastLoadPct = -1;

  private updateMenu(dt: number) {
    this.menuAngle += dt * 0.06;
    const cx = ORIGIN_X,
      cz = ORIGIN_Z;
    const r = 34 + Math.sin(this.menuAngle * 0.45) * 8;
    const h = this.world.getHeight(cx, cz) || 18;
    const ax = cx + Math.cos(this.menuAngle) * r;
    const az = cz + Math.sin(this.menuAngle) * r;
    let camY = h + 20 + Math.sin(this.menuAngle * 0.7) * 3;
    camY = Math.max(camY, this.world.topSolidY(Math.floor(ax), Math.floor(az)) + 4);
    this.camera.position.set(ax, camY, az);
    this.camera.lookAt(cx, h - 2, cz);
    this.camera.fov += (66 - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
    this.updateAmbient(dt);
    this.syncHud(false);
  }

  private updateIdle(dt: number) {
    this.updateAmbient(dt);
    this.updateParticles(dt);
    this.syncHud(false);
  }

  private updateGameOver(dt: number) {
    this.updateAmbient(dt);
    this.updateParticles(dt);
    this.updateDrops(dt, true);
    // slow cinematic orbit around the player
    this.menuAngle += dt * 0.22;
    const eye = this.pos.y + EYE;
    const r = 4.2;
    const camPos = new THREE.Vector3(this.pos.x + Math.cos(this.menuAngle) * r, eye + 1.1, this.pos.z + Math.sin(this.menuAngle) * r);
    const gx = Math.floor(camPos.x),
      gz = Math.floor(camPos.z);
    if (this.world.inBounds(gx, 0, gz)) camPos.y = Math.max(camPos.y, this.world.topSolidY(gx, gz) + 1.4);
    this.camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(this.pos.x, this.pos.y + 0.9, this.pos.z);
    this.camera.rotation.z += Math.sin(this.time * 0.6) * 0.01;
    this.updateShake(dt);
    this.syncHud(false);
  }

  private updatePlay(dt: number) {
    // ---- sleeping: cinematic time-lapse to dawn ----
    if (this.sleeping) {
      this.sleepDark = Math.min(1, this.sleepDark + dt * 2.2);
      // the shift clock keeps ticking — sleep isn't free time (sandbox: no clock)
      if (!this.sandbox) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endRun('time');
          return;
        }
      }
      // fast-forward the sun; wake at early morning (clock ≈ 0.3)
      this.clock = (this.clock + dt * 0.22) % 1;
      this.updateClock(0);
      if (this.clock > 0.28 && this.clock < 0.5) {
        this.sleeping = false;
        this.health = Math.min(100, this.health + 25);
        this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+25 ${t('hp')}`, '#93c95d', true);
        this.pushBanner(t('sunRises'), t('sunRisesSub'), '#ffc86a');
        sfx.start();
      }
      this.updateMobs(dt);
      this.updateParticles(dt);
      this.updateAmbient(dt);
      this.updateCamera(dt);
      this.syncHud(false);
      return;
    }
    this.sleepDark = Math.max(0, this.sleepDark - dt * 1.6);

    this.updateHoverLook(dt);
    this.updateClock(dt);
    this.updatePlayer(dt);
    this.updateTarget();
    if (this.placing || this.touchPlace || this.keys['KeyF']) this.tryPlace();
    if (this.attackCd > 0) this.attackCd -= dt;
    this.streamChunks(this.pos.x, this.pos.z);
    this.updateMobs(dt);
    this.updateGuards(dt);
    this.updateNature(dt);
    this.updateHiveFx(dt);
    this.updateArrows(dt);
    this.updateFallingTrees(dt);
    this.updateBlockGravity();
    this.growVines(dt);
    this.updateFluids();
    this.flushDirtyChunks();
    this.updateMining(dt);

    // night / dawn announcements
    const isNight = this.daylight < 0.35;
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      if (this.survival) {
        if (isNight) this.pushBanner(t('nightFalls'), t('nightFallsSub'), '#6f8bd8');
        else this.pushBanner(t('sunRises'), t('sunRisesSub'), '#ffc86a');
      }
    }
    this.updateDrops(dt, false);
    this.updateParticles(dt);
    this.updateAmbient(dt);
    this.updateShake(dt);
    this.updateCamera(dt);

    // sandbox worlds have no shift clock — stay as long as you like
    if (!this.sandbox) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 10.5) {
        this.warnTick -= dt;
        if (this.warnTick <= 0) {
          this.warnTick = this.timeLeft <= 5 ? 0.32 : 0.7;
          sfx.tickWarn();
        }
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRun('time');
        return;
      }
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.syncHud(true);
      }
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.banner = null;
        this.syncHud(true);
      }
    }
    // nudge the player the first time a pickaxe upgrade is within reach
    const hint = this.craftHint();
    if (hint !== this.prevHint) {
      this.prevHint = hint;
      const hintKey = this.craftHintKey();
      const hintRecipe = hintKey ? RECIPES.find((r) => r.key === hintKey) : undefined;
      if (hint && hintRecipe?.kind === 'pickaxe') {
        this.pushBanner(t('workbenchReady'), `${hint} — ${t('pressE')}`, '#f4b942');
      }
    }
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.syncHud(false);
  }

  // ================= PLAYER =================
  private collides(px: number, py: number, pz: number) {
    const minX = Math.floor(px - PLAYER_HALF),
      maxX = Math.floor(px + PLAYER_HALF);
    const minY = Math.floor(py),
      maxY = Math.floor(py + this.playerHeight() - 0.001);
    const minZ = Math.floor(pz - PLAYER_HALF),
      maxZ = Math.floor(pz + PLAYER_HALF);
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++) if (isSolid(this.world.get(x, y, z))) return true;
    return false;
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number) {
    if (amount === 0) return { blocked: false, top: 0 };
    const p = this.pos;
    p[axis] += amount;
    const minX = Math.floor(p.x - PLAYER_HALF),
      maxX = Math.floor(p.x + PLAYER_HALF);
    const minY = Math.floor(p.y),
      maxY = Math.floor(p.y + this.playerHeight() - 0.001);
    const minZ = Math.floor(p.z - PLAYER_HALF),
      maxZ = Math.floor(p.z + PLAYER_HALF);
    let blocked = false;
    let top = 0;
    let best = amount > 0 ? Infinity : -Infinity;
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (!isSolid(this.world.get(x, y, z))) continue;
          blocked = true;
          top = Math.max(top, y + 1);
          const coord = axis === 'y' ? y : axis === 'x' ? x : z;
          best = amount > 0 ? Math.min(best, coord) : Math.max(best, coord);
        }
      }
    }
    if (blocked) {
      const eps = 0.0005;
      if (axis === 'y') p.y = amount > 0 ? best - this.playerHeight() - eps : best + 1 + eps;
      else if (axis === 'x') p.x = amount > 0 ? best - PLAYER_HALF - eps : best + 1 + PLAYER_HALF + eps;
      else p.z = amount > 0 ? best - PLAYER_HALF - eps : best + 1 + PLAYER_HALF + eps;
      this.vel[axis] = 0;
      if (axis === 'y' && amount < 0) this.onGround = true;
    }
    return { blocked, top };
  }

  private updatePlayer(dt: number) {
    const k = this.keys;
    let fx = 0,
      fz = 0;
    if (k['KeyW'] || k['ArrowUp']) fz += 1;
    if (k['KeyS'] || k['ArrowDown']) fz -= 1;
    if (k['KeyA'] || k['ArrowLeft']) fx -= 1;
    if (k['KeyD'] || k['ArrowRight']) fx += 1;
    fx += this.touchMove.x;
    fz += -this.touchMove.y;
    // C = crawl (prone, fits 1-block gaps); CTRL = crouch; SHIFT = sprint
    const wantCrawl = !!k['KeyC'];
    if (wantCrawl) this.crawling = true;
    else if (this.crawling) {
      // stand up only if there is headroom for the full-height box
      this.crawling = false;
      if (this.collides(this.pos.x, this.pos.y, this.pos.z)) this.crawling = true; // stuck in a tunnel — stay prone
    }
    this.crouching = !this.crawling && !!(k['ControlLeft'] || k['ControlRight']);
    const sprint =
      !this.crouching && !this.crawling && (k['ShiftLeft'] || k['ShiftRight'] || this.touchSprint) && fz > 0.1;
    const len = Math.hypot(fx, fz);
    if (len > 1) {
      fx /= len;
      fz /= len;
    }

    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw);
    // forward = -Z rotated by yaw
    const wx = fx * cos - fz * sin;
    const wz = -fx * sin - fz * cos;

    const speed = this.crawling ? WALK * 0.3 : this.crouching ? WALK * 0.45 : sprint ? SPRINT : WALK;
    const accel = this.onGround ? 58 : 16;
    const targetVX = wx * speed;
    const targetVZ = wz * speed;
    const maxD = accel * dt;
    this.vel.x += Math.max(-maxD, Math.min(maxD, targetVX - this.vel.x));
    this.vel.z += Math.max(-maxD, Math.min(maxD, targetVZ - this.vel.z));
    if (this.onGround && len < 0.05) {
      // standing on ice? barely any grip — you keep gliding
      const under = this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.5), Math.floor(this.pos.z));
      const fr = Math.pow(under === ICE ? 0.35 : 0.0008, dt);
      this.vel.x *= fr;
      this.vel.z *= fr;
    }

    // jump — with coyote time so edge-of-a-ledge jumps still feel fair
    const jumpHeld = (k['Space'] || this.touchJump) && !this.crouching && !this.crawling;
    if (jumpHeld && (this.onGround || this.coyote > 0)) {
      this.vel.y = JUMP_V;
      this.onGround = false;
      this.coyote = 0;
      sfx.jump();
      this.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, [210, 200, 180], 6, 1.6);
    }

    // gravity (lighter while holding jump for variable height)
    let g = GRAVITY;
    if (this.vel.y > 0 && !jumpHeld) g *= 1.9;
    this.vel.y -= g * dt;
    this.vel.y = Math.max(-52, this.vel.y);
    // Vines form climbable ladders through the palm canopy.
    const vr = PLAYER_HALF + 0.13;
    let onVine = false;
    for (const xx of [this.pos.x - vr, this.pos.x + vr])
      for (const zz of [this.pos.z - vr, this.pos.z + vr])
        for (const yy of [this.pos.y + 0.35, this.pos.y + 1.25])
          if (this.world.get(Math.floor(xx), Math.floor(yy), Math.floor(zz)) === VINE) onVine = true;
    if (onVine) {
      this.vel.y = jumpHeld ? Math.max(this.vel.y, 3.5) : Math.max(this.vel.y, -1.5);
      this.fallStart = this.pos.y;
    }

    const wasGround = this.onGround;
    this.onGround = false;

    const ox = this.pos.x,
      oz = this.pos.z;

    // crouch edge-guard: refuse steps that would carry you over a drop
    if (this.crouching && this.onGround) {
      const supported = (px: number, pz: number) =>
        isSolid(this.world.get(Math.floor(px), Math.floor(this.pos.y - 0.6), Math.floor(pz))) ||
        isSolid(this.world.get(Math.floor(px), Math.floor(this.pos.y - 1.4), Math.floor(pz)));
      if (this.vel.x !== 0 && !supported(this.pos.x + Math.sign(this.vel.x) * (PLAYER_HALF + 0.06) + this.vel.x * dt, this.pos.z))
        this.vel.x = 0;
      if (this.vel.z !== 0 && !supported(this.pos.x, this.pos.z + Math.sign(this.vel.z) * (PLAYER_HALF + 0.06) + this.vel.z * dt))
        this.vel.z = 0;
    }

    const rx = this.moveAxis('x', this.vel.x * dt);
    const rz = this.moveAxis('z', this.vel.z * dt);

    // step assist: glide up single blocks so traversal stays fluid (not while prone)
    if (wasGround && !this.crawling && (rx.blocked || rz.blocked)) {
      const target = Math.max(rx.top, rz.top);
      if (target > this.pos.y && target - this.pos.y <= 1.02) {
        const oy = this.pos.y;
        this.pos.y = target;
        if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
          this.pos.y = oy;
        } else {
          this.moveAxis('x', this.vel.x * dt - (this.pos.x - ox));
          this.moveAxis('z', this.vel.z * dt - (this.pos.z - oz));
          this.stepSmooth = Math.max(this.stepSmooth, target - oy);
          this.onGround = true;
        }
      }
    }

    this.moveAxis('y', this.vel.y * dt);

    // landing
    if (this.onGround && !wasGround) {
      const fall = this.fallStart - this.pos.y;
      const hard = fall > 3.2;
      sfx.land(hard);
      this.landDip = Math.min(0.42, fall * 0.035);
      if (hard) {
        this.addShake(Math.min(0.55, fall * 0.045));
        this.burst(this.pos.x, this.pos.y + 0.06, this.pos.z, [196, 182, 158], 10, 2.2);
      }
      if (fall > 5) {
        const dmg = Math.round((fall - 5) * 7.5);
        if (dmg > 0) this.damage(dmg, 'fall');
      }
    }
    if (!this.onGround && this.vel.y > 0) this.fallStart = Math.max(this.fallStart, this.pos.y);
    if (this.onGround) this.fallStart = this.pos.y;

    // water: buoyant swim, no damage
    this.inWater = false;
    {
      const bx = Math.floor(this.pos.x);
      const by = Math.floor(this.pos.y + 0.6);
      const bz = Math.floor(this.pos.z);
      if (this.world.get(bx, by, bz) === WATER) this.inWater = true;
    }
    if (this.inWater) {
      this.vel.y = jumpHeld ? Math.max(this.vel.y, 3.4) : Math.max(this.vel.y * Math.pow(0.2, dt), -2.6);
      this.vel.x *= Math.pow(0.25, dt);
      this.vel.z *= Math.pow(0.25, dt);
      this.fallStart = this.pos.y; // water breaks any fall
    }

    // lava / void hazard
    this.inLava = false;
    const fx0 = Math.floor(this.pos.x - PLAYER_HALF),
      fx1 = Math.floor(this.pos.x + PLAYER_HALF);
    const fy0 = Math.floor(this.pos.y),
      fy1 = Math.floor(this.pos.y + PLAYER_HEIGHT);
    const fz0 = Math.floor(this.pos.z - PLAYER_HALF),
      fz1 = Math.floor(this.pos.z + PLAYER_HALF);
    for (let y = fy0; y <= fy1; y++)
      for (let z = fz0; z <= fz1; z++)
        for (let x = fx0; x <= fx1; x++) if (this.world.get(x, y, z) === LAVA) this.inLava = true;
    if (this.inLava) {
      // you can still swim for the ledge — holding jump claws you upward
      this.vel.y = jumpHeld ? Math.max(this.vel.y, 4.1) : Math.min(this.vel.y, 2.0);
      this.vel.x *= Math.pow(0.12, dt);
      this.vel.z *= Math.pow(0.12, dt);
      this.hurtTimer = 0.35;
      this.flash = Math.max(this.flash, 0.55);
      this.damage(26 * dt, 'lava');
      if (Math.random() < dt * 22) {
        this.burst(this.pos.x + (Math.random() - 0.5) * 0.6, this.pos.y + 0.3, this.pos.z + (Math.random() - 0.5) * 0.6, [255, 140, 40], 2, 2);
      }
    }

    // Cactus spines hurt on body contact, even though the solid block stops
    // the player just short of its centre. Explorer mode remains harmless.
    this.cactusCooldown = Math.max(0, this.cactusCooldown - dt);
    if (this.survival && this.cactusCooldown <= 0) {
      const reach = PLAYER_HALF + 0.12;
      let touching = false;
      for (let y = fy0; y <= fy1 && !touching; y++)
        for (let z = Math.floor(this.pos.z - reach); z <= Math.floor(this.pos.z + reach) && !touching; z++)
          for (let x = Math.floor(this.pos.x - reach); x <= Math.floor(this.pos.x + reach); x++) {
            const block = this.world.get(x, y, z);
            if (block === CACTUS || block === CACTUS_PALE) {
              touching = true;
              break;
            }
          }
      if (touching) {
        this.cactusCooldown = 0.75;
        this.killedBy = blockName(CACTUS, 'Cactus');
        this.damage(4, 'mob');
      }
    }

    // no world bounds any more — the map streams in forever
    if (this.pos.y < -6) this.damage(200, 'fall');

    this.deepest = Math.max(this.deepest, Math.round(this.spawnY - this.pos.y));
    this.coyote = this.onGround ? 0.11 : Math.max(0, this.coyote - dt);
    this.bob += dt * (this.onGround ? Math.hypot(this.vel.x, this.vel.z) * 1.55 : 3.2);
    this.stepSmooth = Math.max(0, this.stepSmooth - dt * 3.4);
    this.fovTarget = sprint && len > 0.2 ? 82 : 72;
  }

  private damage(amount: number, cause: 'lava' | 'fall' | 'mob') {
    if (this.phase !== 'playing') return;
    this.health -= amount;
    if (amount > 3) {
      this.hurtTimer = 0.3;
      this.flash = Math.max(this.flash, Math.min(0.9, amount / 40));
      this.addShake(Math.min(0.6, amount / 45));
      sfx.hurt();
    }
    if (this.health <= 0) {
      this.health = 0;
      this.endRun(cause);
    } else if (amount > 3) {
      this.syncHud(true);
    }
  }

  private updateCamera(dt: number) {
    const bobAmt = this.onGround ? Math.min(1, Math.hypot(this.vel.x, this.vel.z) / WALK) : 0;
    const bobY = Math.sin(this.bob * 2.2) * 0.055 * bobAmt;
    const bobX = Math.cos(this.bob * 1.1) * 0.045 * bobAmt;
    // smooth crouch dip + crawl drop (eye down to ~0.55 over the feet)
    this.crouchLerp += ((this.crouching ? 1 : 0) - this.crouchLerp) * Math.min(1, dt * 11);
    this.crawlLerp += ((this.crawling ? 1 : 0) - this.crawlLerp) * Math.min(1, dt * 9);
    const eyeDrop = this.crouchLerp * 0.42 + this.crawlLerp * (EYE - 0.52);
    const targetY = this.pos.y + EYE - eyeDrop - this.landDip + this.stepSmooth * 0.35 + bobY;
    this.landDip = Math.max(0, this.landDip - dt * 1.6);
    this.camera.position.set(this.pos.x + bobX * 0.35, targetY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * 1.1) * 0.012 * bobAmt);
    this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    const sh = this.shakeMag * this.shake;
    if (sh > 0.0001) {
      this.camera.position.x += (Math.random() - 0.5) * sh * 0.55;
      this.camera.position.y += (Math.random() - 0.5) * sh * 0.55;
      this.camera.position.z += (Math.random() - 0.5) * sh * 0.55;
      this.camera.rotation.z += (Math.random() - 0.5) * sh * 0.09;
      this.camera.rotation.x += (Math.random() - 0.5) * sh * 0.035;
    }
    if (this.inLava) {
      this.camera.rotation.z += Math.sin(this.time * 12) * 0.012;
    }
  }

  private updateShake(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 3.1);
    if (this.shake === 0) this.shakeMag = 0;
  }

  private addShake(mag: number) {
    this.shakeMag = Math.min(1.4, Math.max(this.shakeMag * this.shake, 0) + mag);
    this.shake = 1;
  }

  private chooseWeather(biome: Biome) {
    const dry = biome === 'desert' || biome === 'canyon' || biome === 'volcanic';
    if (dry) {
      this.weatherTargetKind = 'clear';
      this.weatherTargetIntensity = 0;
      this.weatherTimer = 8 + this.rand() * 14;
      return;
    }
    const roll = this.rand();
    if (biome === 'winter') {
      this.weatherTargetKind = roll < 0.34 ? 'snow' : 'clear';
      this.weatherTargetIntensity = this.weatherTargetKind === 'snow' ? 0.45 + this.rand() * 0.45 : 0;
    } else {
      const rainChance = biome === 'jungle' ? 0.34 : 0.2;
      this.weatherTargetKind = roll < rainChance ? 'rain' : 'clear';
      this.weatherTargetIntensity = this.weatherTargetKind === 'rain' ? 0.35 + this.rand() * (biome === 'jungle' ? 0.55 : 0.42) : 0;
    }
    this.weatherTimer = this.weatherTargetKind === 'clear' ? 18 + this.rand() * 34 : 28 + this.rand() * 58;
  }

  private updateWeather(dt: number, biome: Biome) {
    const dry = biome === 'desert' || biome === 'canyon' || biome === 'volcanic';
    this.weatherTimer -= dt;
    if (dry || this.weatherTimer <= 0 || (biome === 'winter' && this.weatherKind === 'rain') || (biome !== 'winter' && this.weatherKind === 'snow')) {
      this.chooseWeather(biome);
    }
    if (this.weatherTargetKind !== 'clear') this.weatherKind = this.weatherTargetKind;
    const k = 1 - Math.pow(0.001, dt / (this.weatherTargetKind === 'clear' ? 4.5 : 6.5));
    this.weatherIntensity += (this.weatherTargetIntensity - this.weatherIntensity) * k;
    if (this.weatherIntensity < 0.035 && this.weatherTargetKind === 'clear') this.weatherKind = 'clear';
    this.spawnWeatherParticles(dt, biome);
  }

  private spawnWeatherParticles(dt: number, biome: Biome) {
    if (this.weatherKind === 'clear' || this.weatherIntensity <= 0.05) return;
    const dry = biome === 'desert' || biome === 'canyon' || biome === 'volcanic';
    if (dry) return;
    const surface = this.world.getHeight(Math.floor(this.pos.x), Math.floor(this.pos.z));
    if (this.pos.y < surface - 1) return;
    const rain = this.weatherKind === 'rain';
    const rate = (rain ? 46 : 22) * this.weatherIntensity * (this.isCoarse() ? 0.55 : 1);
    this.weatherSpawnAcc += dt * rate;
    while (this.weatherSpawnAcc >= 1 && this.particles.length < MAX_PARTICLES - 32) {
      this.weatherSpawnAcc -= 1;
      const a = this.rand() * Math.PI * 2;
      const r = 4 + this.rand() * 25;
      const x = this.camera.position.x + Math.cos(a) * r;
      const z = this.camera.position.z + Math.sin(a) * r;
      const y = this.camera.position.y + 12 + this.rand() * 16;
      if (rain) {
        this.particles.push({
          weather: 'rain',
          x,
          y,
          z,
          vx: -2.3 - this.rand() * 1.6,
          vy: -18 - this.rand() * 8,
          vz: 0.6 + (this.rand() - 0.5) * 1.2,
          life: 1.2,
          max: 1.2,
          size: 0.045 + this.rand() * 0.02,
          r: 0.55,
          g: 0.72,
          b: 1,
        });
      } else {
        this.particles.push({
          weather: 'snow',
          x,
          y,
          z,
          vx: -0.35 + (this.rand() - 0.5) * 0.45,
          vy: -0.8 - this.rand() * 0.9,
          vz: (this.rand() - 0.5) * 0.55,
          life: 8.5,
          max: 8.5,
          size: 0.055 + this.rand() * 0.045,
          r: 0.9,
          g: 0.96,
          b: 1,
        });
      }
    }
  }

  private updatePlacedTorchLights(dt: number) {
    this.placedTorchScanTimer -= dt;
    if (this.placedTorchScanTimer > 0) return;
    this.placedTorchScanTimer = 0.85;
    if (!this.placedTorchLights.length) return;

    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y + 1);
    const pz = Math.floor(this.pos.z);
    const underground = this.pos.y < this.world.getHeight(px, pz) - 2;
    if (this.daylight > 0.78 && !underground) {
      for (const light of this.placedTorchLights) {
        light.visible = false;
        light.intensity = 0;
      }
      return;
    }
    const radius = 16;
    const y0 = Math.max(1, py - 8);
    const y1 = Math.min(WY - 1, py + 8);
    const found: Array<{ x: number; y: number; z: number; d2: number }> = [];
    for (let z = pz - radius; z <= pz + radius; z++) {
      for (let x = px - radius; x <= px + radius; x++) {
        const dx = x + 0.5 - this.pos.x;
        const dz = z + 0.5 - this.pos.z;
        const flat = dx * dx + dz * dz;
        if (flat > radius * radius) continue;
        for (let y = y0; y <= y1; y++) {
          if (this.world.get(x, y, z) !== TORCH) continue;
          const dy = y + 0.5 - (this.pos.y + 1.1);
          found.push({ x, y, z, d2: flat + dy * dy });
        }
      }
    }
    found.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.placedTorchLights.length; i++) {
      const light = this.placedTorchLights[i];
      const f = found[i];
      if (!f) {
        light.visible = false;
        light.intensity = 0;
        continue;
      }
      light.visible = true;
      light.position.set(f.x + 0.5, f.y + 0.55, f.z + 0.5);
      light.distance = 15 + (1 - this.daylight) * 3;
      light.intensity = 2.2 + (1 - this.daylight) * 1.5;
    }
  }

  private updateAmbient(dt: number) {
    const biomeHere = this.world.biomeAt(Math.floor(this.pos.x), Math.floor(this.pos.z));
    this.updateWeather(dt, biomeHere);
    this.updatePlacedTorchLights(dt);
    // Grey smoke rises only from active volcanic craters within sight.
    this.volcanoSmokeTimer -= dt;
    if (this.volcanoSmokeTimer <= 0) {
      this.volcanoSmokeTimer = 0.18;
      const volcano = this.world.volcanoAt(this.pos.x, this.pos.z);
      if (volcano?.active && volcano.distance < 48 && this.world.hasColumn(Math.floor(volcano.x), Math.floor(volcano.z))) {
        const y = this.world.getHeight(Math.floor(volcano.x), Math.floor(volcano.z)) + 2.2;
        for (let i = 0; i < 2 && this.particles.length < MAX_PARTICLES; i++) {
          this.particles.push({
            smoke: true, x: volcano.x + (Math.random() - 0.5) * 2, y,
            z: volcano.z + (Math.random() - 0.5) * 2,
            vx: (Math.random() - 0.5) * 0.7, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 0.7,
            life: 2.6, max: 2.6, size: 0.24, r: 0.3, g: 0.29, b: 0.28,
          });
        }
      }
    }
    // Soft ground-level dust gusts in hot desert regions.
    this.desertWindTimer -= dt;
    if (this.desertWindTimer <= 0) {
      this.desertWindTimer = 0.09;
      if (this.world.biomeAt(Math.floor(this.pos.x),Math.floor(this.pos.z)) === 'desert' && Math.random()<0.65 && this.particles.length<MAX_PARTICLES) {
        this.particles.push({x:this.pos.x+(Math.random()-0.5)*18,y:this.pos.y+Math.random()*1.8,z:this.pos.z+(Math.random()-0.5)*18,
          vx:1.1+Math.random()*1.1,vy:0.08+Math.random()*0.15,vz:(Math.random()-0.5)*0.35,
          life:1.1+Math.random()*0.8,max:1.8,size:0.025+Math.random()*0.025,r:0.72,g:0.62,b:0.43});
      }
    }
    // clouds drift: deserts stay cloudless and harsh; rain/snow thickens the ceiling.
    const mat = this.clouds.material as THREE.MeshBasicMaterial;
    (mat.map as THREE.Texture).offset.x = (this.time * 0.0035) % 1;
    (mat.map as THREE.Texture).offset.y = (this.time * 0.0012) % 1;
    this.clouds.position.x = this.camera.position.x;
    this.clouds.position.z = this.camera.position.z;
    this.clouds.position.y = this.camera.position.y + 112;
    const drySky = biomeHere === 'desert' || biomeHere === 'canyon' || biomeHere === 'volcanic';
    const cloudTarget = drySky ? 0 : Math.min(0.46, 0.04 + this.daylight * 0.24 + this.weatherIntensity * 0.28);
    mat.opacity += (cloudTarget - mat.opacity) * Math.min(1, dt * 1.7);
    this.clouds.visible = mat.opacity > 0.025;

    // motes wrap around the camera (updated at half rate — they drift slowly)
    if ((this.frameNo & 1) === 0) {
    const attr = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const cx = this.camera.position.x,
      cy = this.camera.position.y,
      cz = this.camera.position.z;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += Math.sin(this.time * 0.4 + i) * 0.004;
      arr[i + 1] += 0.006 + Math.cos(this.time * 0.3 + i) * 0.003;
      arr[i + 2] += Math.cos(this.time * 0.35 + i) * 0.004;
      const dx = arr[i] - cx,
        dy = arr[i + 1] - cy,
        dz = arr[i + 2] - cz;
      if (dx > 20) arr[i] -= 40;
      if (dx < -20) arr[i] += 40;
      if (dz > 20) arr[i + 2] -= 40;
      if (dz < -20) arr[i + 2] += 40;
      if (dy > 13) arr[i + 1] -= 26;
      if (dy < -13) arr[i + 1] += 26;
    }
    attr.needsUpdate = true;
    (this.motes.material as THREE.PointsMaterial).opacity = 0.28 + Math.sin(this.time * 1.6) * 0.1;
    }

    // pickaxe idle + swing
    const idle = Math.sin(this.time * 2.1) * 0.012;
    let sx = 0,
      sy = 0,
      sz = 0,
      px = 0,
      py = 0;
    if (this.swingT >= 0) {
      this.swingT += dt / this.swingDur;
      if (this.swingT >= 1) this.swingT = -1;
      else {
        const t = this.swingT;
        const k = Math.sin(Math.min(1, t) * Math.PI);
        const impact = t > this.swingSoundAt && t < this.swingSoundAt + 0.18;
        if (t >= this.swingSoundAt && !this.swingSoundDone) {
          this.swingSoundDone = true;
          sfx.swing(this.swingStep % 6);
          const tg = this.target;
          if (tg && this.phase === 'playing' && isBreakable(tg.id)) {
            sfx.crack(this.swingStep % 5);
            this.addShake(0.05);
            this.burst(
              tg.x + 0.5 + tg.nx * 0.5,
              tg.y + 0.5 + tg.ny * 0.5,
              tg.z + 0.5 + tg.nz * 0.5,
              BLOCKS[tg.id].tint,
              3,
              1.5,
            );
          }
        }
        sx = -k * 1.15;
        sy = k * 0.35;
        sz = k * 0.28;
        px = k * 0.06;
        py = -k * 0.16 + (impact ? 0.02 : 0);
      }
    }
    this.syncViewModel();
    this.pickGroup.rotation.set(0.42 + sx + idle, -0.58 + sy, 0.3 + sz + idle * 0.6);
    this.pickGroup.position.x = this.pickBaseX + px;
    this.pickGroup.position.y = -0.46 + py + idle * 0.6;
    this.pickGroup.position.z = -0.92 + Math.max(0, sx) * -0.14;

    // popups
    this.updatePopups(dt);
  }

  // ================= MINING =================
  private eyeV = new THREE.Vector3();
  private dirV = new THREE.Vector3();
  private updateTarget() {
    // analytic view vector — immune to screen shake / camera smoothing
    const cp = Math.cos(this.pitch),
      sp = Math.sin(this.pitch);
    this.dirV.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    this.eyeV.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.target = this.raycast(this.eyeV, this.dirV, REACH);
  }

  private raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
    let x = Math.floor(origin.x),
      y = Math.floor(origin.y),
      z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x),
      stepY = Math.sign(dir.y),
      stepZ = Math.sign(dir.z);
    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    const voxBoundX = x + (stepX > 0 ? 1 : 0);
    const voxBoundY = y + (stepY > 0 ? 1 : 0);
    const voxBoundZ = z + (stepZ > 0 ? 1 : 0);
    let tMaxX = dir.x === 0 ? Infinity : (voxBoundX - origin.x) / dir.x;
    let tMaxY = dir.y === 0 ? Infinity : (voxBoundY - origin.y) / dir.y;
    let tMaxZ = dir.z === 0 ? Infinity : (voxBoundZ - origin.z) / dir.z;
    let nx = 0,
      ny = 0,
      nz = 0;
    let t = 0;
    for (let i = 0; i < 128; i++) {
      const id = this.world.get(x, y, z);
      // the crosshair ray passes straight through water — you can mine underwater
      if (id !== AIR && id !== WATER && this.world.inBounds(x, y, z)) {
        return { x, y, z, nx, ny, nz, id };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
      if (t > maxDist) break;
    }
    return null;
  }

  private updateMining(dt: number) {
    const wantMining = this.mining || this.touchMine;
    // bow: LMB shoots instead of mining
    if (wantMining && this.heldKind() === 'bow') {
      this.tryShoot();
      this.highlight.visible = false;
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      return;
    }
    // a mob under the crosshair always wins over the block behind it
    if (wantMining && this.tryAttack()) {
      this.highlight.visible = false;
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      return;
    }
    const t = this.target;
    if (!t) {
      this.highlight.visible = false;
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    const pulse = 1 + Math.sin(this.time * 9) * 0.006;
    this.highlight.scale.setScalar(pulse);
    const hlMat = this.highlight.material as THREE.LineBasicMaterial;
    hlMat.opacity = wantMining ? 0.95 : 0.6;

    const def = BLOCKS[t.id];
    if (!isBreakable(t.id)) {
      hlMat.color.setHex(0xe2564a);
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      return;
    }
    hlMat.color.setHex(0x0b0d0c);

    if (wantMining) {
      // Flowers, meadow grass, ferns, dead bushes, and eggs break in exactly ONE hit
      if (isInstaBreak(t.id)) {
        this.mineProgress = 0;
        this.startSwing(0.05);
        this.breakBlock(t.x, t.y, t.z, t.id);
        this.updateTarget();
        return;
      }
      const key = `${t.x},${t.y},${t.z}`;
      if (key !== this.mineBlockKey) {
        this.mineBlockKey = key;
        this.mineProgress = 0;
        // first whack on an occupied hive wakes the swarm
        if (t.id === HIVE) this.angerBees(t.x, t.y, t.z);
      }
      if (this.swingT < 0) this.startSwing(def.hardness);
      // mining speed comes from the pick actually in hand — old picks stay slower
      const pickTier = this.heldKind() === 'pick' ? this.heldPickTier() : 0;
      const tierSpeed = PICKAXE_TIERS[pickTier].speed * this.toolMultiplier(t.id) * (1 + this.stats.miner / 100);
      this.mineProgress += (dt * tierSpeed) / Math.max(0.05, def.hardness);
      if (this.mineProgress >= 1) {
        this.mineProgress = 0;
        this.breakBlock(t.x, t.y, t.z, t.id);
        this.updateTarget();
      }
    } else {
      this.mineProgress = Math.max(0, this.mineProgress - dt * 2.2);
    }

    const stage = Math.min(9, Math.floor(this.mineProgress * 10));
    if (this.mineProgress > 0.01) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      if (stage !== this.crackStage) {
        this.crackStage = stage;
        const [u0, v0, u1, v1] = crackTileUV(stage);
        const uv = this.crackMesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const base = this.crackUVBase;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, u0 + (u1 - u0) * base[i * 2], v0 + (v1 - v0) * base[i * 2 + 1]);
        }
        uv.needsUpdate = true;
      }
    } else {
      this.crackMesh.visible = false;
      this.crackStage = -1;
    }
  }

  private startSwing(hardness: number) {
    const tierSpeed = PICKAXE_TIERS[this.tier].speed;
    this.swingDur = Math.max(0.13, Math.min(0.42, (hardness * 0.32) / tierSpeed));
    this.swingT = 0;
    this.swingStep++;
    this.swingSoundAt = 0.42;
    this.swingSoundDone = false;
  }
  private swingSoundDone = false;

  private breakBlock(x: number, y: number, z: number, id: number) {
    const def = BLOCKS[id];
    this.world.set(x, y, z, AIR);
    if (id === BED) {
      // A bed is 2 blocks long: breaking either half removes the partner half too
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (this.world.get(x + dx, y, z + dz) === BED) {
          this.world.set(x + dx, y, z + dz, AIR);
          this.rebuildAt(x + dx, z + dz);
        }
      }
    }
    if (id === DOOR_WOOD || id === DOOR_IRON) {
      // A door is 2 blocks tall: breaking either half removes the other half too
      for (const dy of [1, -1]) {
        if (this.world.get(x, y + dy, z) === id) {
          this.world.set(x, y + dy, z, AIR);
        }
      }
    }
    if (id === VINE) {
      // Sever a single hanging strand: the severed section and everything
      // beneath it falls, while the upper part stays attached to the canopy.
      for (let yy = y - 1; yy >= 1 && this.world.get(x, yy, z) === VINE; yy--)
        this.world.set(x, yy, z, AIR);
      if (this.world.get(x, y + 1, z) === VINE && this.vineTips.size < 128)
        this.vineTips.set(Engine.packCell(x, y + 1, z), { x, y: y + 1, z, t: 4 + Math.random() * 4 });
    }
    // cutting a trunk? everything above comes down as one physical piece
    if (isLogId(id) && isLogId(this.world.get(x, y + 1, z))) {
      this.fellTree(x, y, z);
    }
    this.rebuildAt(x, z);
    this.blocksMined++;

    const tint = def.tint;
    this.burst(x + 0.5, y + 0.5, z + 0.5, tint, isLeafId(id) ? 8 : 16, id === STONE ? 3.4 : 2.6);
    this.addShake(id >= 5 && id <= 8 ? 0.34 : 0.2);
    sfx.breakBlock(id === DIRT || id === SAND || id === GRASS || isPlant(id) ? 0.8 : isLeafId(id) ? 1.5 : 1);

    this.combo++;
    this.comboTimer = 3.0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    // neighbours may have just lost their support / adjacent fluids start flowing
    this.enqueueSupportCheck(x, y, z);
    this.enqueueFluid(x, y, z);

    // hives only yield honey that bees actually deposited
    if (id === BIRD_NEST || id === CHICKEN_NEST) {
      this.birdNests = this.birdNests.filter((n) => n.x !== x || n.y !== y || n.z !== z);
    }
    if (id === HIVE) {
      const key = Engine.packCell(x, y, z);
      const stored = this.hiveHoney.get(key) ?? 0;
      this.hiveHoney.delete(key);
      this.hiveBees.delete(key); // occupants spill out via their own task logic
      for (let i = 0; i < stored; i++) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, HONEY);
      if (stored > 0) this.burst(x + 0.5, y + 0.5, z + 0.5, [244, 184, 58], 12, 2.6);
      this.angerBees(x, y, z);
    } else if (id === COCONUT_LEAVES || id === BANANA_LEAVES) {
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, id === COCONUT_LEAVES ? COCONUT : BANANA);
    } else if (id === APPLE_LEAVES) {
      // apple leaves guarantee fresh apples!
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, APPLE);
      if (Math.random() < 0.4) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, APPLE);
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, LEAVES);
    } else {
      const dropId = def.drop;
      if (dropId) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, dropId);
      if (id === LEAVES && Math.random() < 0.08) {
        this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, APPLE);
      }
    }

    if (id === DIAMOND_ORE || id === GOLD_ORE || id === EMERALD_ORE || id === DIAMOND || id === GOLD) {
      const isDia = id === DIAMOND_ORE || id === DIAMOND;
      const isEm = id === EMERALD_ORE;
      this.burst(
        x + 0.5,
        y + 0.5,
        z + 0.5,
        isDia ? [120, 245, 235] : isEm ? [60, 235, 110] : [255, 220, 90],
        22,
        4.4,
      );
      this.addShake(0.6);
      this.pushBanner(
        isDia || isEm ? t('diamond') : t('gold'),
        `+${Math.round(def.timeBonus)}${t('secShort')} ${t('secondsOnClock')}`,
        isDia ? '#5fe8dc' : isEm ? '#2bd45e' : '#f7d34b',
      );
    }
    this.syncHotbar(false);
    this.syncHud(true);
  }

  // ================= FALLING TREES =================
  private fallingTrees: Array<{
    group: THREE.Group;
    pivot: THREE.Vector3;
    axis: THREE.Vector3;
    angle: number;
    vel: number;
    creak: boolean;
    blocks: Array<{ dx: number; dy: number; dz: number; id: number }>;
  }> = [];
  private blockGeoCache = new Map<number, THREE.BoxGeometry>();

  /** shared unit-cube geometry with the block's atlas UVs baked in */
  private getBlockGeometry(id: number, sideTileOverride?: number): THREE.BoxGeometry {
    const cacheKey = sideTileOverride !== undefined ? id * 1000 + sideTileOverride : id;
    let geo = this.blockGeoCache.get(cacheKey);
    if (geo) return geo;
    geo = new THREE.BoxGeometry(1, 1, 1);
    geo.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3),
    );
    const def = BLOCKS[id];
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    const base = this.dropUVBase;
    for (let f = 0; f < 6; f++) {
      const tile = f === 2 ? def.top : f === 3 ? def.bottom : (sideTileOverride ?? def.side);
      const [u0, v0, u1, v1] = tileUV(tile);
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, u0 + (u1 - u0) * base[idx * 2], v0 + (v1 - v0) * base[idx * 2 + 1]);
      }
    }
    uv.needsUpdate = true;
    this.blockGeoCache.set(cacheKey, geo);
    return geo;
  }

  /** detach the trunk + canopy above (x,y,z) from the world and let it topple over */
  private fellTree(x: number, y: number, z: number) {
    // 1. collect the trunk going up (allowing 1-block lean / branches for giant trees)
    const logs: Array<{ pos: [number, number, number]; id: number }> = [];
    const seen = new Set<string>();
    const key = (px: number, py: number, pz: number) => `${px},${py},${pz}`;
    const stack: Array<[number, number, number]> = [[x, y + 1, z]];
    while (stack.length && logs.length < 48) {
      const [cx, cy, cz] = stack.pop()!;
      const k = key(cx, cy, cz);
      if (seen.has(k)) continue;
      seen.add(k);
      const bid = this.world.get(cx, cy, cz);
      if (!isLogId(bid)) continue;
      logs.push({ pos: [cx, cy, cz], id: bid });
      for (let dy = 0; dy <= 1; dy++)
        for (let dz2 = -1; dz2 <= 1; dz2++)
          for (let dx2 = -1; dx2 <= 1; dx2++) {
            if (dx2 === 0 && dy === 0 && dz2 === 0) continue;
            if (cy + dy > y) stack.push([cx + dx2, cy + dy, cz + dz2]);
          }
    }
    if (!logs.length) return;

    // 2. gather the whole leaf canopy — wide first ring around the logs, then
    //    flood through connected leaves so nothing is left hovering
    const leaves: Array<{ pos: [number, number, number]; id: number }> = [];
    let frontier: Array<[number, number, number]> = [];
    for (const l of logs) {
      const [cx, cy, cz] = l.pos;
      for (let dy = -1; dy <= 2; dy++)
        for (let dz2 = -2; dz2 <= 2; dz2++)
          for (let dx2 = -2; dx2 <= 2; dx2++) {
            const px = cx + dx2,
              py = cy + dy,
              pz = cz + dz2;
            const k = key(px, py, pz);
            if (seen.has(k)) continue;
            seen.add(k);
            const bid = this.world.get(px, py, pz);
            if (isLeafId(bid)) {
              leaves.push({ pos: [px, py, pz], id: bid });
              frontier.push([px, py, pz]);
            }
          }
    }
    for (let pass = 0; pass < 5 && leaves.length < 220; pass++) {
      const next: Array<[number, number, number]> = [];
      for (const [cx, cy, cz] of frontier) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dz2 = -1; dz2 <= 1; dz2++)
            for (let dx2 = -1; dx2 <= 1; dx2++) {
              const px = cx + dx2,
                py = cy + dy,
                pz = cz + dz2;
              const k = key(px, py, pz);
              if (seen.has(k)) continue;
              seen.add(k);
              const bid = this.world.get(px, py, pz);
              if (isLeafId(bid)) {
                leaves.push({ pos: [px, py, pz], id: bid });
                next.push([px, py, pz]);
              }
            }
      }
      frontier = next;
    }

    // 3. pull the blocks out of the world, remember which chunks need remeshing
    const chunks = new Set<number>();
    const markChunks = (px: number, pz: number) => {
      const cx = Math.floor(px / CHUNK);
      const cz = Math.floor(pz / CHUNK);
      for (let dz2 = -1; dz2 <= 1; dz2++)
        for (let dx2 = -1; dx2 <= 1; dx2++) chunks.add(chunkKey(cx + dx2, cz + dz2));
    };
    const all = [...logs.map((l) => [l.pos, l.id] as const), ...leaves.map((l) => [l.pos, l.id] as const)];
    for (const [[px, py, pz]] of all) {
      this.world.set(px, py, pz, AIR);
      markChunks(px, pz);
    }
    // anything the canopy grab missed loses support and crumbles on its own
    for (const [[px, py, pz]] of all) this.enqueueSupportCheck(px, py, pz);
    // the felled tree's own chunk rebuilds instantly (visual pop matters);
    // spill-over neighbours go through the deferred queue
    let first = true;
    for (const ck of chunks) {
      const [ccx, ccz] = keyToChunk(ck);
      if (first) {
        this.buildChunk(ccx, ccz);
        first = false;
      } else this.dirtyChunks.add(ck);
    }

    // 4. rebuild the tree as one mesh group hinged at the stump
    const pivot = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    const group = new THREE.Group();
    group.position.copy(pivot);
    const blocks: Array<{ dx: number; dy: number; dz: number; id: number }> = [];
    for (const [[px, py, pz], id] of all) {
      const mesh = new THREE.Mesh(this.getBlockGeometry(id), this.material);
      mesh.position.set(px + 0.5 - pivot.x, py + 0.5 - pivot.y, pz + 0.5 - pivot.z);
      group.add(mesh);
      blocks.push({ dx: mesh.position.x, dy: mesh.position.y, dz: mesh.position.z, id });
    }
    this.scene.add(group);

    // 5. topple away from the player
    let fx = pivot.x - this.pos.x;
    let fz = pivot.z - this.pos.z;
    const fl = Math.hypot(fx, fz);
    if (fl < 0.01) {
      fx = 1;
      fz = 0;
    } else {
      fx /= fl;
      fz /= fl;
    }
    const axis = new THREE.Vector3(fz, 0, -fx).normalize();

    this.fallingTrees.push({ group, pivot, axis, angle: 0, vel: 0.28, creak: false, blocks });
    if (this.fallingTrees.length > 4) this.finishTree(this.fallingTrees.shift()!);
    sfx.crack(3);
  }

  private updateFallingTrees(dt: number) {
    for (let i = this.fallingTrees.length - 1; i >= 0; i--) {
      const ft = this.fallingTrees[i];
      // gravity torque: the further it tips, the faster it goes
      ft.vel += (1.4 + Math.sin(Math.min(ft.angle, 1.5)) * 6.5) * dt;
      ft.angle += ft.vel * dt;
      if (!ft.creak && ft.angle > 0.3) {
        ft.creak = true;
        sfx.swing(2);
      }
      if (ft.angle >= Math.PI / 2 - 0.03) {
        this.fallingTrees.splice(i, 1);
        this.finishTree(ft);
        continue;
      }
      ft.group.setRotationFromAxisAngle(ft.axis, ft.angle);
    }
  }

  private treeTmp = new THREE.Vector3();
  /** impact: the felled tree shatters into drops and particles along its length */
  private finishTree(ft: { group: THREE.Group; pivot: THREE.Vector3; axis: THREE.Vector3; blocks: Array<{ dx: number; dy: number; dz: number; id: number }> }) {
    const q = new THREE.Quaternion().setFromAxisAngle(ft.axis, Math.PI / 2 - 0.05);
    let logs = 0;
    for (const b of ft.blocks) {
      this.treeTmp.set(b.dx, b.dy, b.dz).applyQuaternion(q).add(ft.pivot);
      const wx = this.treeTmp.x;
      const wy = Math.max(1, this.treeTmp.y);
      const wz = this.treeTmp.z;
      if (isLogId(b.id)) {
        logs++;
        this.spawnDrop(wx, wy + 0.3, wz, b.id === BIRCH_LOG ? BIRCH_LOG : LOG);
        this.burst(wx, wy, wz, BLOCKS[b.id]?.tint ?? BLOCKS[LOG].tint, 5, 2.4);
      } else if (b.id === COCONUT_LEAVES || b.id === BANANA_LEAVES) {
        if (Math.random() < 0.35) this.spawnDrop(wx, wy + 0.2, wz, b.id === COCONUT_LEAVES ? COCONUT : BANANA);
        this.burst(wx, wy, wz, BLOCKS[b.id].tint, 3, 2);
      } else if (b.id === APPLE_LEAVES) {
        // apple leaves drop fresh apples!
        this.spawnDrop(wx, wy + 0.2, wz, APPLE);
        if (Math.random() < 0.5) this.spawnDrop(wx, wy + 0.2, wz, APPLE);
        if (Math.random() < 0.3) this.spawnDrop(wx, wy + 0.2, wz, LEAVES);
        this.burst(wx, wy, wz, [220, 60, 50], 4, 2);
      } else {
        // leaves mostly puff away; some drop as a resource
        if (Math.random() < 0.3) this.spawnDrop(wx, wy + 0.2, wz, LEAVES);
        if (b.id === LEAVES && Math.random() < 0.06) this.spawnDrop(wx, wy + 0.2, wz, APPLE);
        this.burst(wx, wy, wz, BLOCKS[b.id]?.tint ?? BLOCKS[LEAVES].tint, 3, 2);
      }
    }
    this.scene.remove(ft.group);
    ft.group.clear();
    this.addShake(Math.min(0.7, 0.25 + logs * 0.07));
    sfx.land(true);
    sfx.breakBlock(0.6);
  }

  private clearFallingTrees() {
    for (const ft of this.fallingTrees) {
      this.scene.remove(ft.group);
      ft.group.clear();
    }
    this.fallingTrees.length = 0;
  }

  // ================= DOORS & WINDOWS (E to toggle) =================
  private openDoors: Array<{ x: number; y: number; z: number; id: number; mesh: THREE.Mesh }> = [];

  private clearDoors() {
    for (const d of this.openDoors) {
      this.scene.remove(d.mesh);
    }
    this.openDoors.length = 0;
  }

  /** nearest living trader within reach, if any */
  traderNear(): Mob | null {
    for (const m of this.mobSys.mobs) {
      if (!m.alive || m.id !== 'trader') continue;
      if (Math.hypot(m.x - this.pos.x, m.y - this.pos.y, m.z - this.pos.z) < 3.6) return m;
    }
    return null;
  }

  /** E — trade with the trader, open the door/window under the crosshair, or close ones nearby */
  interact(): boolean {
    if (this.phase !== 'playing') return false;
    // trader first — walking up to him and pressing E opens the trade tab
    if (this.traderNear()) {
      this.invTab = 'trade';
      this.openInventory();
      return true;
    }
    const tg = this.target;
    // workbench / crafting table → open the workbench dismantle view
    if (tg && tg.id === CRAFTING_TABLE) {
      this.invTab = 'workbench';
      this.openInventory();
      return true;
    }
    // anvil → open the smithing tab
    if (tg && tg.id === ANVIL) {
      this.invTab = 'anvil';
      this.openInventory();
      return true;
    }
    // bed → sleep through the night
    if (tg && tg.id === BED) {
      if (this.daylight > 0.5) {
        this.popup(tg.x + 0.5, tg.y + 1.2, tg.z + 0.5, t('sleepOnlyNight'), '#a8c0ff');
        sfx.ui(false);
      } else if (!this.sleeping) {
        this.sleeping = true;
        this.mining = false;
        this.placing = false;
        this.pushBanner(t('sleeping'), t('sleepingSub'), '#a8c0ff');
        sfx.ui(true);
      }
      return true;
    }
    if (tg && isInteractive(tg.id)) {
      this.openDoorAt(tg.x, tg.y, tg.z, tg.id, tg.nx, tg.nz);
      return true;
    }
    // close any opened panels within reach
    let closed = false;
    for (let i = this.openDoors.length - 1; i >= 0; i--) {
      const d = this.openDoors[i];
      const dist = Math.hypot(d.x + 0.5 - this.pos.x, d.y + 0.5 - (this.pos.y + 1), d.z + 0.5 - this.pos.z);
      if (dist > 3.4) continue;
      if (this.world.get(d.x, d.y, d.z) !== AIR) continue;
      // don't close a door onto yourself
      const px = this.pos.x,
        pz = this.pos.z,
        py = this.pos.y;
      if (
        d.x + 1 > px - PLAYER_HALF &&
        d.x < px + PLAYER_HALF &&
        d.z + 1 > pz - PLAYER_HALF &&
        d.z < pz + PLAYER_HALF &&
        d.y + 1 > py &&
        d.y < py + PLAYER_HEIGHT
      )
        continue;
      this.world.set(d.x, d.y, d.z, d.id);
      this.scene.remove(d.mesh);
      this.openDoors.splice(i, 1);
      this.rebuildAt(d.x, d.z);
      closed = true;
    }
    if (closed) {
      sfx.place();
      this.updateTarget();
      this.syncHud(true);
    }
    return closed;
  }

  private openDoorAt(x: number, y: number, z: number, id: number, nx: number, nz: number) {
    // doors open as a whole vertical stack (2-tall doors feel like one door)
    const cells: Array<[number, number, number]> = [[x, y, z]];
    if (id !== GLASS) {
      for (const dy of [1, -1, 2, -2]) {
        if (this.world.get(x, y + dy, z) === id) cells.push([x, y + dy, z]);
      }
    }
    // pick the swing direction: panel hugs the side of the frame
    let horizN: [number, number] = [nx, nz];
    if (nx === 0 && nz === 0) {
      horizN = Math.abs(this.dirV.x) > Math.abs(this.dirV.z) ? [Math.sign(this.dirV.x), 0] : [0, Math.sign(this.dirV.z)];
    }
    const alongX = horizN[0] !== 0; // door plane was YZ → open panel lies along X wall

    for (const [cx, cy, cz] of cells) {
      const isBottomDoor =
        (id === DOOR_WOOD || id === DOOR_IRON) && cells.some(([, cy2]) => cy2 === cy + 1);
      const sideTile = isBottomDoor ? (id === DOOR_WOOD ? T.doorWoodBottom : T.doorIronBottom) : undefined;
      this.world.set(cx, cy, cz, AIR);
      const mesh = new THREE.Mesh(this.getBlockGeometry(id, sideTile), this.cutoutMat);
      if (alongX) {
        mesh.scale.set(1, 1, 0.13);
        mesh.position.set(cx + 0.5, cy + 0.5, cz + 0.935);
      } else {
        mesh.scale.set(0.13, 1, 1);
        mesh.position.set(cx + 0.935, cy + 0.5, cz + 0.5);
      }
      this.scene.add(mesh);
      this.openDoors.push({ x: cx, y: cy, z: cz, id, mesh });
    }
    this.rebuildAt(x, z);
    sfx.place();
    this.burst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[id].tint, 4, 1.4);
    this.updateTarget();
    this.syncHud(true);
  }

  // ================= FLUID FLOW =================
  /** cells that might need to flow; level map caps lateral creep at 4 blocks.
   *  Numeric packed keys — no string alloc/GC churn in the hot path. */
  private fluidQueue: number[] = [];
  private fluidSet = new Set<number>();
  private fluidLevel = new Map<number, number>();

  private static packCell(x: number, y: number, z: number) {
    return ((x + 32768) * 64 + y) * 65536 + (z + 32768);
  }
  private static unpackCell(k: number): [number, number, number] {
    const z = (k % 65536) - 32768;
    const rest = Math.floor(k / 65536);
    const y = rest % 64;
    const x = Math.floor(rest / 64) - 32768;
    return [x, y, z];
  }

  private enqueueFluid(x: number, y: number, z: number) {
    for (const [dx, dy, dz] of [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      const px = x + dx;
      const py = y + dy;
      const pz = z + dz;
      const id = this.world.get(px, py, pz);
      if (id !== WATER && id !== LAVA) continue;
      const k = Engine.packCell(px, py, pz);
      if (this.fluidSet.has(k)) continue;
      this.fluidSet.add(k);
      this.fluidQueue.push(k);
    }
  }

  private updateFluids() {
    if (!this.fluidQueue.length) return;
    // lava is thick: it only flows every 4th frame
    let budget = 16;
    const defer: number[] = [];
    while (this.fluidQueue.length && budget > 0) {
      const k = this.fluidQueue.shift()!;
      this.fluidSet.delete(k);
      const [x, y, z] = Engine.unpackCell(k);
      const id = this.world.get(x, y, z);
      if (id !== WATER && id !== LAVA) continue;
      if (id === LAVA && (this.frameNo & 3) !== 0 &&
          ![[x,y-1,z],[x+1,y,z],[x-1,y,z],[x,y,z+1],[x,y,z-1],[x,y+1,z]]
            .some(([ax,ay,az]) => { const b = this.world.get(ax,ay,az); return b === WATER || b === ICE; })) {
        // Keep slow lava flow, but never delay a water contact behind its flow tick.
        defer.push(k);
        continue;
      }
      budget--;
      const level = this.fluidLevel.get(k) ?? 0;
      const mark = (px: number, pz: number) => this.markDirtyAt(px, pz);
      // Only player-disturbed / newly flowing fluid enters this queue. Generated
      // oceans and lava pools are never scanned or put into a reaction queue.
      const adjacent: Array<[number, number, number]> = [
        [x, y - 1, z], [x + 1, y, z], [x - 1, y, z],
        [x, y, z + 1], [x, y, z - 1], [x, y + 1, z],
      ];
      let reacted = false;
      for (const [ax, ay, az] of adjacent) {
        const other = this.world.get(ax, ay, az);
        if (id === LAVA && (other === WATER || other === ICE)) {
          // Ice melts to water; the contacting lava hardens, leaving the water.
          if (other === ICE) { this.world.set(ax, ay, az, WATER); mark(ax, az); }
          this.world.set(x, y, z, VOLCANIC_STONE);
          this.fluidLevel.delete(k);
          this.burst(x + 0.5, y + 0.5, z + 0.5, [85, 45, 49], 8, 2);
          mark(x, z);
          reacted = true;
          break;
        }
        if (id === WATER && other === LAVA) {
          this.world.set(ax, ay, az, VOLCANIC_STONE);
          this.fluidLevel.delete(Engine.packCell(ax, ay, az));
          this.burst(ax + 0.5, ay + 0.5, az + 0.5, [85, 45, 49], 8, 2);
          mark(ax, az);
          reacted = true;
          break;
        }
      }
      if (reacted) continue; // one bounded reaction per fluid update
      const flow = (px: number, py: number, pz: number, lvl: number) => {
        const target = this.world.get(px, py, pz);
        if (target === WATER && id === LAVA || target === ICE && id === LAVA) {
          if (target === ICE) { this.world.set(px, py, pz, WATER); mark(px, pz); }
          this.world.set(x, y, z, VOLCANIC_STONE);
          this.fluidLevel.delete(k);
          mark(x, z);
          return true;
        }
        if (target === LAVA && id === WATER) {
          this.world.set(px, py, pz, VOLCANIC_STONE);
          this.fluidLevel.delete(Engine.packCell(px, py, pz));
          mark(px, pz);
          return true;
        }
        if (target === AIR || (id === WATER && isFlower(target))) {
          this.world.set(px, py, pz, id);
          this.fluidLevel.set(Engine.packCell(px, py, pz), lvl);
          this.enqueueFluid(px, py, pz);
          mark(px, pz);
          return true;
        }
        return false;
      };
      if (flow(x, y - 1, z, 0)) continue;
      if (level < 4) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          flow(x + dx, y, z + dz, level + 1);
          if (this.world.get(x, y, z) !== id) break;
        }
      }
    }
    for (const k of defer) {
      if (!this.fluidSet.has(k)) {
        this.fluidSet.add(k);
        this.fluidQueue.push(k);
      }
    }
  }

  // ================= TURTLE/PENGUIN EGGS, BEES, PREDATION =================
  private birdNests: Array<{ x: number; y: number; z: number; kind: 'bird' | 'chicken'; t: number }> = [];
  private birdNestTimer = 10;
  private turtleEggs: Array<{
    x: number;
    y: number;
    z: number;
    t: number;
    kind: 'turtle' | 'penguin';
    /** penguin eggs hatch only while a parent broods on top */
    brooding?: boolean;
  }> = [];
  private eggTimer = 12;
  private beeTimer = 0;
  private predTimer = 0;
  private spiderTimer = 10;
  /** spider egg sacs waiting to hatch into spiderlings */
  private spiderEggs: Array<{ x: number; y: number; z: number; t: number }> = [];
  /** honey stored per placed hive (packed cell → count, max 3) */
  private hiveHoney = new Map<number, number>();
  /** bees currently inside each hive (sleeping or brewing) — max 5 */
  private hiveBees = new Map<number, number>();
  private hiveFxTimer = 0;

  private hiveEnter(key: number): boolean {
    const n = this.hiveBees.get(key) ?? 0;
    if (n >= 5) return false; // full house
    this.hiveBees.set(key, n + 1);
    return true;
  }
  private hiveLeave(key: number) {
    const n = this.hiveBees.get(key) ?? 0;
    if (n <= 1) this.hiveBees.delete(key);
    else this.hiveBees.set(key, n - 1);
  }

  /** attacking a hive: every bee inside (or nearby) comes out ANGRY — task 5 */
  private angerBees(hx: number, hy: number, hz: number) {
    for (const m of this.mobSys.mobs) {
      if (!m.alive || m.id !== 'bee') continue;
      const insideThis =
        m.hidden && Math.floor(m.taskX) === hx && m.taskY === hy && Math.floor(m.taskZ) === hz;
      const nearby = !m.hidden && Math.hypot(m.x - hx, m.z - hz) < 8;
      if (!insideThis && !nearby) continue;
      if (m.hidden) {
        // burst out of the entrance
        m.hidden = false;
        m.x = hx + 0.5;
        m.y = hy - 0.1;
        m.z = hz + 0.7;
        m.vy = 2.5;
      }
      m.task = 5; // angry!
      m.taskT = 10; // give up after 10s
      m.taskX = 2; // stings left
      this.burst(m.x, m.y + 0.4, m.z, [244, 100, 40], 6, 2);
    }
    if (this.survival || true) sfx.crack(4);
  }

  /** ambient FX on occupied hive entrances: honey drips by day, sleep Zzz at night */
  private updateHiveFx(dt: number) {
    this.hiveFxTimer -= dt;
    if (this.hiveFxTimer > 0) return;
    this.hiveFxTimer = 0.9;
    const night = this.daylight < 0.35;
    for (const [key, count] of this.hiveBees) {
      if (count <= 0) continue;
      const [hx, hy, hz] = Engine.unpackCell(key);
      // skip far-away hives
      if (Math.hypot(hx - this.pos.x, hz - this.pos.z) > 36) continue;
      const ex = hx + 0.5;
      const ey = hy + 0.35; // entrance hole height
      const ez = hz + 0.55;
      if (night) {
        // slow pale "Zzz" motes drifting up from the entrance
        this.burst(ex, ey + 0.25, ez, [200, 210, 240], 1 + (count > 2 ? 1 : 0), 0.4);
      } else {
        // busy hive: honey-coloured working sparkles at the hole
        this.burst(ex, ey, ez, [244, 184, 58], 1 + Math.min(2, count - 1), 0.7);
      }
    }
  }

  /** nearest hive block within r, or null */
  private findHiveNear(x: number, y: number, z: number, r: number): [number, number, number] | null {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    for (let dy = -3; dy <= 4; dy++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (this.world.get(bx + dx, by + dy, bz + dz) === HIVE) return [bx + dx, by + dy, bz + dz];
    return null;
  }

  private updateBirdNests(dt: number) {
    // Placing nests is rare; checking a handful of adults and at most six nests
    // every few seconds has no world-generation or per-voxel overhead.
    this.birdNestTimer -= dt;
    if (this.birdNestTimer <= 0) {
      this.birdNestTimer = 10 + Math.random() * 6;
      if (this.daylight > 0.35 && this.birdNests.length < 6) {
        for (const parent of this.mobSys.mobs) {
          if (!parent.alive || parent.grow > 0 || !parent.onGround ||
            (parent.id !== 'bird' && parent.id !== 'chicken') ||
            Math.hypot(parent.x - this.pos.x, parent.z - this.pos.z) > 42) continue;
          const x = Math.floor(parent.x), z = Math.floor(parent.z);
          const y = Math.floor(parent.y + 0.12);
          if (y <= 1 || y >= WY - 2 || this.world.get(x, y, z) !== AIR) continue;
          const below = this.world.get(x, y - 1, z);
          if (parent.id === 'bird' ? !isLeafId(below) : below !== GRASS) continue;
          if (this.birdNests.some((n) => Math.hypot(n.x - x, n.z - z) < 6)) continue;
          if (parent.id === 'chicken') {
            // Hens choose cover: under a tree or beside tall meadow grass.
            let sheltered = false;
            for (let dx = -2; dx <= 2 && !sheltered; dx++)
              for (let dz = -2; dz <= 2 && !sheltered; dz++) {
                if (dx || dz) {
                  const plant = this.world.get(x + dx, y, z + dz);
                  if (plant === TALL_GRASS || plant === FERN) sheltered = true;
                }
                for (let dy = 2; dy <= 7 && !sheltered; dy++)
                  if (isLeafId(this.world.get(x + dx, y + dy, z + dz))) sheltered = true;
              }
            if (!sheltered) continue;
          }
          const kind = parent.id;
          this.world.set(x, y, z, kind === 'bird' ? BIRD_NEST : CHICKEN_NEST);
          this.birdNests.push({ x, y, z, kind, t: 32 + Math.random() * 18 });
          this.markDirtyAt(x, z);
          this.burst(x + 0.5, y + 0.3, z + 0.5, kind === 'bird' ? [100, 69, 42] : [211, 177, 92], 4, 0.8);
          break;
        }
      }
    }
    for (let i = this.birdNests.length - 1; i >= 0; i--) {
      const nest = this.birdNests[i];
      const expected = nest.kind === 'bird' ? BIRD_NEST : CHICKEN_NEST;
      if (this.world.get(nest.x, nest.y, nest.z) !== expected ||
          !(nest.kind === 'bird' ? isLeafId(this.world.get(nest.x, nest.y - 1, nest.z)) :
            this.world.get(nest.x, nest.y - 1, nest.z) === GRASS)) {
        if (this.world.get(nest.x, nest.y, nest.z) === expected) {
          this.world.set(nest.x, nest.y, nest.z, AIR); this.markDirtyAt(nest.x, nest.z);
        }
        this.birdNests.splice(i, 1);
        continue;
      }
      // Don't spawn chicks far outside the active wildlife area.
      if (Math.hypot(nest.x - this.pos.x, nest.z - this.pos.z) > 48) continue;
      nest.t -= dt;
      if (nest.t > 0 || this.mobSys.mobs.length >= this.mobSys.maxMobs - 2) continue;
      this.world.set(nest.x, nest.y, nest.z, AIR);
      this.markDirtyAt(nest.x, nest.z);
      this.birdNests.splice(i, 1);
      for (let b = 0; b < 2; b++) {
        const baby = this.mobSys.spawn(nest.kind, nest.x + 0.35 + b * 0.3, nest.y + 0.05, nest.z + 0.5);
        if (baby) {
          baby.grow = 60;
          baby.group.scale.setScalar(baby.def.scale * baby.modelSize * 0.35);
          baby.jumpCd = 2;
        }
      }
      this.burst(nest.x + 0.5, nest.y + 0.3, nest.z + 0.5, [239, 232, 207], 8, 1.2);
      if (Math.hypot(this.pos.x - nest.x - 0.5, this.pos.z - nest.z - 0.5) < 4)
        this.popup(nest.x + 0.5, nest.y + 0.6, nest.z + 0.5, t('eggHatched'), '#f1d797');
    }
  }

  /** Crush every type of egg under any part of the player's feet (not just
   * the voxel beneath the centre). Spider egg sacs are world objects, too. */
  private crushEggsUnderfoot() {
    if (!this.onGround) return;
    const fy = Math.floor(this.pos.y + 0.08);
    const margin = PLAYER_HALF - 0.02;
    let lastCrushed: [number, number, number] | null = null;
    for (let x = Math.floor(this.pos.x - margin); x <= Math.floor(this.pos.x + margin); x++)
      for (let z = Math.floor(this.pos.z - margin); z <= Math.floor(this.pos.z + margin); z++) {
        const id = this.world.get(x, fy, z);
        if (id !== TURTLE_EGG && id !== PENGUIN_EGG && id !== BIRD_NEST && id !== CHICKEN_NEST) continue;
        this.world.set(x, fy, z, AIR);
        this.birdNests = this.birdNests.filter((n) => n.x !== x || n.y !== fy || n.z !== z);
        this.turtleEggs = this.turtleEggs.filter((n) => n.x !== x || n.y !== fy || n.z !== z);
        if (id === PENGUIN_EGG) for (const parent of this.mobSys.mobs) {
          if (parent.id === 'penguin' && parent.task === 6 &&
              Math.hypot(parent.x - x - 0.5, parent.z - z - 0.5) < 2) {
            parent.task = 0;
            parent.think = 0;
          }
        }
        this.markDirtyAt(x, z);
        this.burst(x + 0.5, fy + 0.25, z + 0.5, [231, 228, 210], 10, 1.8);
        lastCrushed = [x, fy, z];
      }
    // Spider egg sacs are tracked separately, rather than voxel blocks.
    for (let i = this.spiderEggs.length - 1; i >= 0; i--) {
      const egg = this.spiderEggs[i];
      if (Math.abs(egg.x - this.pos.x) > margin + 0.25 ||
          Math.abs(egg.z - this.pos.z) > margin + 0.25 ||
          Math.abs(egg.y - this.pos.y) > 0.55) continue;
      this.spiderEggs.splice(i, 1);
      this.burst(egg.x, egg.y + 0.15, egg.z, [235, 237, 232], 10, 1.8);
      lastCrushed = [egg.x - 0.5, egg.y, egg.z - 0.5];
    }
    if (lastCrushed) {
      const [x, y, z] = lastCrushed;
      this.popup(x + 0.5, y + 0.7, z + 0.5, t('eggCrushed'), '#e2564a');
      sfx.crack(1);
      this.addShake(0.12);
    }
  }

  private fruitFallTimer = 5;
  private updateNature(dt: number) {
    this.crushEggsUnderfoot();
    // Hedgehogs forage for fallen apples: carry one on their back, then eat it.
    for (const hedgehog of this.mobSys.mobs) {
      if (!hedgehog.alive || hedgehog.id !== 'hedgehog') continue;
      const carried = hedgehog.group.userData.carriedApple as THREE.Mesh | undefined;
      if (carried) {
        hedgehog.group.userData.appleEatTime = (hedgehog.group.userData.appleEatTime ?? 8) - dt;
        if (hedgehog.group.userData.appleEatTime <= 0) {
          hedgehog.group.remove(carried);
          carried.geometry.dispose();
          (carried.material as THREE.Material).dispose();
          delete hedgehog.group.userData.carriedApple;
          hedgehog.group.userData.appleEatTime = 8;
        }
        continue;
      }
      // In the summer forest, pause to nibble a nearby mushroom. The plant stays
      // in place throughout the chew and is removed only on the final bite.
      if (!this.world.isWinter(Math.floor(hedgehog.x), Math.floor(hedgehog.z))) {
        const bx = Math.floor(hedgehog.x), bz = Math.floor(hedgehog.z), by = Math.floor(hedgehog.y);
        if (hedgehog.group.userData.mushroomNibble === undefined) {
          outer: for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) for (let dy=-1;dy<=1;dy++) {
            if (this.world.get(bx+dx,by+dy,bz+dz) === MUSHROOM) {
              hedgehog.group.userData.mushroomNibble = {x:bx+dx,y:by+dy,z:bz+dz,t:4.6};
              break outer;
            }
          }
        }
        const nibble = hedgehog.group.userData.mushroomNibble as {x:number;y:number;z:number;t:number}|undefined;
        if (nibble) {
          nibble.t -= dt;
          if (nibble.t <= 0) {
            if (this.world.get(nibble.x,nibble.y,nibble.z) === MUSHROOM) {
              this.world.set(nibble.x,nibble.y,nibble.z,AIR);
              this.markDirtyAt(nibble.x,nibble.z);
            }
            delete hedgehog.group.userData.mushroomNibble;
          }
          continue;
        }
      }
      const apple = this.drops.find((d) => d.active && d.id === APPLE && Math.hypot(d.x - hedgehog.x, d.z - hedgehog.z) < 1.1 && Math.abs(d.y - hedgehog.y) < 1.5);
      if (apple) {
        apple.active = false; this.scene.remove(apple.mesh);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,0.18), new THREE.MeshLambertMaterial({color:'#d84c38'}));
        mesh.position.set(0,0.72,0.12); hedgehog.group.add(mesh);
        hedgehog.group.userData.carriedApple = mesh;
        hedgehog.group.userData.appleEatTime = 8;
      }
    }
    // Occasionally a ripe fruit drops from a nearby living tree canopy.
    this.fruitFallTimer -= dt;
    if (this.fruitFallTimer <= 0) {
      this.fruitFallTimer = 7 + Math.random() * 13;
      if (Math.random() < 0.7) {
        const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
        for (let attempt = 0; attempt < 16; attempt++) {
          const x = px + Math.floor(Math.random() * 25) - 12;
          const z = pz + Math.floor(Math.random() * 25) - 12;
          const y = Math.floor(this.pos.y) + 2 + Math.floor(Math.random() * 11);
          const leaf = this.world.get(x, y, z);
          const fruit = leaf === APPLE_LEAVES ? APPLE : leaf === COCONUT_LEAVES ? COCONUT : leaf === BANANA_LEAVES ? BANANA : 0;
          if (fruit && this.world.get(x, y - 1, z) === AIR) {
            this.spawnDrop(x + 0.5, y - 0.15, z + 0.5, fruit);
            break;
          }
        }
      }
    }
    // ---- egg laying: turtles ONLY on sand, penguins ONLY on snowy ground ----
    this.eggTimer -= dt;
    if (this.eggTimer <= 0) {
      this.eggTimer = 14 + Math.random() * 10;
      if (this.turtleEggs.length < 6) {
        const layers = this.mobSys.mobs.filter(
          (m) => m.alive && (m.id === 'turtle' || m.id === 'penguin') && m.grow <= 0,
        );
        for (const tu of layers) {
          const bx = Math.floor(tu.x);
          const bz = Math.floor(tu.z);
          const by = Math.floor(tu.y);
          const ground = this.world.get(bx, by - 1, bz);
          const okGround = tu.id === 'turtle' ? ground === SAND : ground === SNOW_GRASS || ground === ICE;
          if (okGround && this.world.get(bx, by, bz) === AIR) {
            // penguins lay their own egg type and will brood it
            this.world.set(bx, by, bz, tu.id === 'turtle' ? TURTLE_EGG : PENGUIN_EGG);
            this.turtleEggs.push({
              x: bx,
              y: by,
              z: bz,
              t: 50 + Math.random() * 30,
              kind: tu.id === 'turtle' ? 'turtle' : 'penguin',
            });
            if (tu.id === 'penguin') {
              // the parent settles onto the nest (task 6 = brooding)
              tu.task = 6;
              tu.taskX = bx + 0.5;
              tu.taskZ = bz + 0.5;
            }
            this.markDirtyAt(bx, bz);
            this.burst(bx + 0.5, by + 0.3, bz + 0.5, [230, 235, 225], 5, 1.4);
            break;
          }
        }
      }
    }
    // ---- hatch / verify ----
    for (let i = this.turtleEggs.length - 1; i >= 0; i--) {
      const egg = this.turtleEggs[i];
      const expect = egg.kind === 'penguin' ? PENGUIN_EGG : TURTLE_EGG;
      if (this.world.get(egg.x, egg.y, egg.z) !== expect) {
        this.turtleEggs.splice(i, 1); // mined or crushed
        continue;
      }
      // penguin eggs only develop while a parent broods on the nest
      if (egg.kind === 'penguin') {
        egg.brooding = this.mobSys.mobs.some(
          (p) =>
            p.alive &&
            p.id === 'penguin' &&
            p.grow <= 0 &&
            Math.hypot(p.x - (egg.x + 0.5), p.z - (egg.z + 0.5)) < 1.2,
        );
        if (!egg.brooding) continue; // timer frozen without a warm belly
      }
      egg.t -= dt;
      if (egg.t <= 0) {
        this.world.set(egg.x, egg.y, egg.z, AIR);
        this.markDirtyAt(egg.x, egg.z);
        this.turtleEggs.splice(i, 1);
        // release the brooding parent back to normal life
        if (egg.kind === 'penguin') {
          for (const p of this.mobSys.mobs) {
            if (p.alive && p.id === 'penguin' && p.task === 6 && Math.hypot(p.x - (egg.x + 0.5), p.z - (egg.z + 0.5)) < 2) {
              p.task = 0;
              p.think = 0;
            }
          }
        }
        // babies match whoever laid the clutch, then grow up over ~60s
        const n = 1 + (Math.random() < 0.6 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0);
        for (let b = 0; b < n; b++) {
          const a = Math.random() * Math.PI * 2;
          const baby = this.mobSys.spawn(
            egg.kind,
            egg.x + 0.5 + Math.cos(a) * (0.6 + Math.random() * 0.8),
            egg.y + 0.2,
            egg.z + 0.5 + Math.sin(a) * (0.6 + Math.random() * 0.8),
          );
          if (baby) {
            baby.grow = 60; // starts at 35% size, reaches adult in a minute
            baby.group.scale.setScalar(baby.def.scale * 0.35);
          }
        }
        this.burst(egg.x + 0.5, egg.y + 0.4, egg.z + 0.5, [230, 235, 225], 10, 2);
        if (Math.hypot(this.pos.x - egg.x - 0.5, this.pos.y + 0.8 - egg.y - 0.5, this.pos.z - egg.z - 0.5) <= 2) {
          this.popup(egg.x + 0.5, egg.y + 0.8, egg.z + 0.5, t('eggHatched'), '#7ab88a');
          sfx.pickup(2);
        }
      }
    }
    this.updateBirdNests(dt);

    // ---- cave spiders: weave webs & lay eggs that hatch into spiderlings ----
    this.spiderTimer -= dt;
    if (this.spiderTimer <= 0) {
      this.spiderTimer = 8;
      if (this.survival) {
        for (const m of this.mobSys.mobs) {
          if (!m.alive || m.id !== 'spider') continue;
          const sx = Math.floor(m.x);
          const sy = Math.floor(m.y);
          const sz = Math.floor(m.z);
          // "in a cave" = solid roof somewhere above
          const roofed = this.world.topSolidY(sx, sz) > sy + 1;
          if (!roofed) continue;
          const r = Math.random();
          if (r < 0.3) {
            // weave: drop a collectible web strand nearby
            this.spawnDrop(m.x + (Math.random() - 0.5), m.y + 0.4, m.z + (Math.random() - 0.5), WEB);
            this.burst(m.x, m.y + 0.6, m.z, [238, 240, 245], 4, 1);
          } else if (r < 0.42 && this.spiderEggs.length < 4) {
            // lay an egg sac on the cave floor
            this.spiderEggs.push({ x: m.x, y: m.y + 0.2, z: m.z, t: 30 + Math.random() * 25 });
            this.burst(m.x, m.y + 0.3, m.z, [238, 240, 245], 6, 1.4);
          }
        }
      }
    }
    for (let i = this.spiderEggs.length - 1; i >= 0; i--) {
      const egg = this.spiderEggs[i];
      egg.t -= dt;
      // faint pulsing web glow so the sac is spottable in the dark
      if (Math.random() < dt * 2) this.burst(egg.x, egg.y + 0.2, egg.z, [238, 240, 245], 1, 0.4);
      if (egg.t <= 0) {
        this.spiderEggs.splice(i, 1);
        const n = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (let b = 0; b < n; b++) {
          this.mobSys.spawn('spiderling', egg.x + (Math.random() - 0.5), egg.y, egg.z + (Math.random() - 0.5));
        }
        this.burst(egg.x, egg.y + 0.3, egg.z, [196, 52, 42], 10, 2);
        sfx.crack(3);
      }
    }

    // ---- bee state machine: roam → pollinate a flower → carry pollen to a hive ----
    this.beeTimer -= dt;
    if (this.beeTimer <= 0) {
      this.beeTimer = 0.55;
      const beeNight = this.daylight < 0.35;
      for (const m of this.mobSys.mobs) {
        if (!m.alive || m.id !== 'bee') continue;

        // ---- task 5: ANGRY — chase the player and sting (1 dmg, max 2 stings) ----
        if (m.task === 5) {
          m.taskT -= 0.55;
          const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
          if (m.taskT <= 0 || m.taskX <= 0 || d > 12) {
            // calmed down (or you outran it) → fly back home
            m.task = 0;
            m.think = 0;
          } else {
            m.tx = this.pos.x;
            m.tz = this.pos.z;
            m.think = 2;
            if (m.group.visible && Math.random() < 0.5)
              this.burst(m.x, m.y + 0.4, m.z, [244, 100, 40], 1, 0.6);
            if (d < 1.3 && Math.abs(m.y - (this.pos.y + 1)) < 1.6) {
              // sting!
              m.taskX -= 1;
              this.killedBy = t('mob_bee');
              this.damage(1, 'mob');
              this.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, [244, 100, 40], 5, 2);
              sfx.crack(2);
              // bounce away after the hit
              const bx2 = m.x - this.pos.x;
              const bz2 = m.z - this.pos.z;
              const bd = Math.hypot(bx2, bz2) || 1;
              m.vx += (bx2 / bd) * 5;
              m.vz += (bz2 / bd) * 5;
              m.vy += 2;
            }
          }
          continue;
        }

        // ---- night: every bee heads home and sleeps INSIDE the hive till dawn ----
        if (beeNight && m.task !== 4 && m.task !== 3) {
          const hive = this.findHiveNear(m.x, m.y, m.z, 20);
          if (hive) {
            m.task = 4;
            m.taskX = hive[0] + 0.5;
            m.taskY = hive[1];
            m.taskZ = hive[2] + 0.5;
          } else {
            m.task = 0; // no hive — just idle in the dark
            m.tx = m.x;
            m.tz = m.z;
            m.think = 3;
            continue;
          }
        }
        if (m.task === 4) {
          if (m.hidden) {
            // asleep inside the hive: pinned to the hive cell, invisible
            if (!beeNight || this.world.get(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ)) !== HIVE) {
              // dawn (or hive broken) → pop out just below the entrance
              this.hiveLeave(Engine.packCell(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ)));
              m.hidden = false;
              m.x = m.taskX;
              m.y = m.taskY - 0.2;
              m.z = m.taskZ + 0.6;
              m.vy = 1.5;
              m.task = 0;
              this.burst(m.x, m.y + 0.3, m.z, [244, 192, 80], 4, 1);
            }
            continue;
          }
          // still flying home
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 3;
          const closeH =
            Math.hypot(m.x - m.taskX, m.z - m.taskZ) < 1.2 && Math.abs(m.y + 0.4 - m.taskY) < 2.2;
          if (closeH) {
            // crawl inside and vanish for the night (if there's room — max 5)
            const hk = Engine.packCell(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ));
            if (this.hiveEnter(hk)) {
              m.hidden = true;
              m.x = m.taskX;
              m.y = m.taskY;
              m.z = m.taskZ;
              m.vx = 0;
              m.vy = 0;
              m.vz = 0;
            } else {
              // hive full — doze on top of it instead
              m.tx = m.taskX;
              m.tz = m.taskZ;
              m.think = 3;
            }
          } else if (!beeNight) {
            m.task = 0; // dawn caught the bee mid-flight — back to work
          }
          continue; // no sparkles at night
        }

        if (Math.random() < 0.4 && m.group.visible) this.burst(m.x, m.y + 0.4, m.z, [244, 192, 80], 1, 0.5);

        if (m.task === 0) {
          // roam: look for a flower within 6 blocks
          const bx = Math.floor(m.x);
          const by = Math.floor(m.y);
          const bz = Math.floor(m.z);
          outer2: for (let dy = -2; dy <= 2; dy++)
            for (let dz = -6; dz <= 6; dz++)
              for (let dx = -6; dx <= 6; dx++) {
                if (isFlower(this.world.get(bx + dx, by + dy, bz + dz))) {
                  m.task = 1;
                  m.taskX = bx + dx + 0.5;
                  m.taskY = by + dy;
                  m.taskZ = bz + dz + 0.5;
                  m.taskT = 30; // pollination: exactly 30s of game time
                  break outer2;
                }
              }
        } else if (m.task === 1) {
          // pollinating: hover at the bloom, sparkle. HARD CAP 30s of game time —
          // when it expires the bee ALWAYS heads for a hive.
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 2;
          m.taskT -= 0.55;
          const near = Math.hypot(m.x - m.taskX, m.z - m.taskZ) < 1.4;
          if (near && m.group.visible) this.burst(m.taskX, m.taskY + 0.7, m.taskZ, [255, 220, 120], 3, 1, 0.25);
          const flowerGone = !isFlower(this.world.get(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ)));
          if (m.taskT <= 0 || flowerGone) {
            // time's up → fly to the hive with whatever pollen was gathered
            const hive = this.findHiveNear(m.x, m.y, m.z, 14);
            if (hive) {
              m.task = 2;
              m.taskX = hive[0] + 0.5;
              m.taskY = hive[1];
              m.taskZ = hive[2] + 0.5;
              m.taskT = 30; // hard cap on the flight home
            } else m.task = 0; // no hive around — back to roaming
          }
        } else if (m.task === 2) {
          // flying home with pollen
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 2;
          m.taskT -= 0.55;
          const hx = Math.floor(m.taskX);
          const hz = Math.floor(m.taskZ);
          if (this.world.get(hx, m.taskY, hz) !== HIVE || m.taskT <= 0) {
            m.task = 0; // hive gone / lost interest
          } else if (Math.hypot(m.x - m.taskX, m.z - m.taskZ) < 1.5 && Math.abs(m.y - m.taskY) < 2.5) {
            // arrived → crawl INSIDE and brew honey (only if there's room, max 5)
            const hk2 = Engine.packCell(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ));
            if (this.hiveEnter(hk2)) {
              m.task = 3;
              m.taskT = 30;
              m.hidden = true;
              m.x = m.taskX;
              m.y = m.taskY;
              m.z = m.taskZ;
              m.vx = 0;
              m.vy = 0;
              m.vz = 0;
            } else {
              m.task = 0; // full hive — drop the pollen, try later
            }
          }
        } else if (m.task === 3) {
          // hidden inside the hive, making honey — then it flies back out
          m.taskT -= 0.55;
          const hx = Math.floor(m.taskX);
          const hz = Math.floor(m.taskZ);
          const hiveGone = this.world.get(hx, m.taskY, hz) !== HIVE;
          if (hiveGone || m.taskT <= 0) {
            if (!hiveGone && m.taskT <= 0) {
              const key = Engine.packCell(hx, m.taskY, hz);
              const cur = this.hiveHoney.get(key) ?? 0;
              if (cur < 3) {
                this.hiveHoney.set(key, cur + 1);
                this.burst(m.taskX, m.taskY + 0.5, m.taskZ, [244, 184, 58], 8, 1.6);
                sfx.pickup(1);
              }
            }
            // emerge from the entrance (or spill out of the wreckage)
            this.hiveLeave(Engine.packCell(hx, m.taskY, hz));
            m.hidden = false;
            m.x = m.taskX;
            m.y = m.taskY - 0.2;
            m.z = m.taskZ + 0.6;
            m.vy = 1.5;
            m.task = beeNight ? 4 : 0; // if night fell during the brew — go back in to sleep
            if (m.task === 4) {
              m.taskX = hx + 0.5;
              m.taskZ = hz + 0.5;
            }
            this.burst(m.x, m.y + 0.3, m.z, [244, 192, 80], 4, 1);
          }
        }
      }
    }

    // ---- predation: crabs raid eggs & fish, turtles eat fish and defend nests ----
    this.predTimer -= dt;
    if (this.predTimer <= 0) {
      this.predTimer = 2;
      const crabs: Mob[] = [];
      const turtles: Mob[] = [];
      const fish: Mob[] = [];
      for (const m of this.mobSys.mobs) {
        if (!m.alive) continue;
        if (m.id === 'crab') crabs.push(m);
        else if (m.id === 'turtle' && m.grow <= 0) turtles.push(m);
        else if (m.id === 'fish') fish.push(m);
      }
      // crabs: nearest egg within reach gets eaten; otherwise snack on shallow fish
      for (const c of crabs) {
        let ate = false;
        for (let i = this.turtleEggs.length - 1; i >= 0; i--) {
          const egg = this.turtleEggs[i];
          const d = Math.hypot(egg.x + 0.5 - c.x, egg.z + 0.5 - c.z);
          if (d < 1.6 && Math.abs(egg.y - c.y) < 1.5) {
            this.world.set(egg.x, egg.y, egg.z, AIR);
            this.markDirtyAt(egg.x, egg.z);
            this.turtleEggs.splice(i, 1);
            this.burst(egg.x + 0.5, egg.y + 0.3, egg.z + 0.5, [230, 235, 225], 10, 2);
            ate = true;
            break;
          } else if (d < 9) {
            // crab senses a nest — scuttle toward it
            c.tx = egg.x + 0.5;
            c.tz = egg.z + 0.5;
            c.think = 3;
          }
        }
        if (!ate && Math.random() < 0.35) {
          for (const f of fish) {
            if (Math.hypot(f.x - c.x, f.y - c.y, f.z - c.z) < 1.5) {
              this.mobSys.remove(f);
              this.burst(f.x, f.y + 0.3, f.z, [94, 156, 216], 8, 2);
              break;
            }
          }
        }
      }
      // turtles: eat fish; attack any crab that is threatening a nest
      for (const tu of turtles) {
        if (Math.random() < 0.3) {
          for (const f of fish) {
            if (Math.hypot(f.x - tu.x, f.y - tu.y, f.z - tu.z) < 1.4) {
              this.mobSys.remove(f);
              this.burst(f.x, f.y + 0.3, f.z, [94, 156, 216], 8, 2);
              break;
            }
          }
        }
        for (const c of crabs) {
          if (!c.alive) continue;
          // is this crab menacing any nest?
          const menacing = this.turtleEggs.some((e) => Math.hypot(e.x + 0.5 - c.x, e.z + 0.5 - c.z) < 5);
          if (!menacing) continue;
          const d = Math.hypot(c.x - tu.x, c.z - tu.z);
          if (d < 1.8) {
            // snap! the crab becomes lunch
            this.mobSys.remove(c);
            this.burst(c.x, c.y + 0.3, c.z, [216, 90, 58], 12, 2.4);
            this.spawnDrop(c.x, c.y + 0.4, c.z, RAW_MEAT);
          } else if (d < 8) {
            tu.tx = c.x;
            tu.tz = c.z;
            tu.think = 3;
          }
        }
      }
    }
  }

  // ================= ANVIL & WORKBENCH =================
  anvilNear(): boolean {
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y);
    const pz = Math.floor(this.pos.z);
    for (let dy = -1; dy <= 2; dy++)
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++)
          if (this.world.get(px + dx, py + dy, pz + dz) === ANVIL) return true;
    return false;
  }

  workbenchNear(): boolean {
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y);
    const pz = Math.floor(this.pos.z);
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++)
          if (this.world.get(px + dx, py + dy, pz + dz) === CRAFTING_TABLE) return true;
    return false;
  }

  private findGearByUid(uid: string): { item: Item; equippedSlot: Slot | null } | null {
    const bagIdx = this.bagItems.findIndex((x) => x.uid === uid);
    if (bagIdx >= 0) return { item: this.bagItems[bagIdx], equippedSlot: null };
    for (const slot of Object.keys(this.equipped) as Slot[]) {
      const it = this.equipped[slot];
      if (it && it.uid === uid) return { item: it, equippedSlot: slot };
    }
    return null;
  }

  /** diamond gear + 1 netherite scrap → netherite gear (stats ×1.5, affixes kept) */
  upgradeToNetherite(uid: string) {
    const found = this.findGearByUid(uid);
    if (!found || found.item.material !== 'diamond') return;
    if ((this.inventory.get(NETHERITE) ?? 0) < 1) {
      sfx.ui(false);
      return;
    }
    this.inventory.set(NETHERITE, (this.inventory.get(NETHERITE) ?? 0) - 1);
    const it = found.item;
    it.material = 'netherite';
    it.armor = Math.round(it.armor * 1.5);
    it.damage = Math.round(it.damage * 1.5);
    if (found.equippedSlot) this.stats = computeStats(this.equipped);
    sfx.upgrade();
    this.addShake(0.35);
    this.flash = 0.4;
    this.pushBanner(matName('NETHERITE'), `${t(('slot_' + it.slot) as never)} · ⛨${it.armor}`, '#8a6a58');
    this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [138, 106, 88], 20, 4);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /** hammer 4 iron into any piece for +2 armour */
  reinforceItem(uid: string) {
    const found = this.findGearByUid(uid);
    if (!found) return;
    if ((this.inventory.get(IRON) ?? 0) < 4) {
      sfx.ui(false);
      return;
    }
    this.inventory.set(IRON, (this.inventory.get(IRON) ?? 0) - 4);
    found.item.armor += 2;
    if (found.equippedSlot) this.stats = computeStats(this.equipped);
    sfx.place();
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, '+2 ⛨', '#d6d9dd');
    this.syncHotbar(true);
    this.syncHud(true);
  }

  // ================= STRUCTURE GUARDS =================
  private guardedSites = new Set<number>();
  private guardTimer = 0;
  /** smoothed travel direction — wildlife spawns ahead of where you're going */
  private travelDir = { x: 0, z: 0 };
  private travelSpeed = 0;
  /** water bodies already stocked with a fish school (packed cell keys) */
  private stockedWater = new Set<number>();
  private wanderTraderTimer = 30;
  private stockTimer = 0;

  /**
   * Fish schools: whenever a new water area comes near, drop a whole school
   * (4–7 fish) into it at once — ponds feel alive the moment you see them.
   * Region key = 8×8-block water cell, so big lakes get several schools.
   */
  private stockWaterAhead(biasAngle: number | null) {
    this.stockTimer -= 1;
    if (this.stockTimer > 0) return;
    this.stockTimer = 30; // every ~0.5s
    // probe a point near / ahead of the player
    const a = biasAngle !== null ? biasAngle + (Math.random() * 2 - 1) * 0.9 : Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 26;
    const wx = this.pos.x + Math.cos(a) * r;
    const wz = this.pos.z + Math.sin(a) * r;
    const water = this.world.findWaterNear(wx, wz, 8);
    if (!water) return;
    const regionKey = Engine.packCell(Math.floor(water[0] / 8), 0, Math.floor(water[2] / 8));
    if (this.stockedWater.has(regionKey)) {
      // A school may have swum away or been recycled after the player left.
      if (this.mobSys.mobs.some((m) => m.alive && m.id === 'fish' && Math.hypot(m.x - water[0], m.z - water[2]) < 9)) return;
      this.stockedWater.delete(regionKey);
    }
    if (this.mobSys.mobs.filter((m) => m.alive && m.id === 'fish').length >= 36) return;
    this.stockedWater.add(regionKey);
    if (this.stockedWater.size > 400) this.stockedWater.clear(); // stale far-away regions
    // Small fish travel in larger, tighter schools; larger species mingle in
    // smaller groups. A few deeper pools harbour drifting jellyfish.
    const frySchool = Math.random() < 0.5;
    const school = frySchool ? 9 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < school; i++) {
      const fx = water[0] + (Math.random() - 0.5) * (frySchool ? 2.5 : 5);
      const fz = water[2] + (Math.random() - 0.5) * (frySchool ? 2.5 : 5);
      const fy = Math.max(2, water[1] - 1);
      const px = Math.floor(fx), pz = Math.floor(fz);
      const inWater = this.world.get(px, fy, pz) === WATER;
      const vi = frySchool ? 4 : Math.floor(Math.random() * 4);
      this.mobSys.spawn('fish', inWater ? fx : water[0], fy, inWater ? fz : water[2], vi);
    }
    if (this.world.get(Math.floor(water[0]), water[1] - 2, Math.floor(water[2])) === WATER && Math.random() < 0.32) {
      this.mobSys.spawn('jellyfish', water[0], water[1] - 1, water[2]);
    }
  }

  private updateGuards(dt: number) {
    if (!this.survival) return;
    this.guardTimer -= dt;
    if (this.guardTimer > 0) return;
    this.guardTimer = 1.5;
    for (let i = 0; i < this.world.structureSites.length; i++) {
      const s = this.world.structureSites[i];
      if (this.guardedSites.has(i)) continue;
      const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
      if (d > 26) continue;
      this.guardedSites.add(i);
      // sunlight-proof garrison so the guards survive the day shift
      const picks: MobId[] = s.kind === 'tower' ? ['spider', 'creeper', 'spider'] : ['spider', 'creeper'];
      for (const id of picks) {
        const p = this.mobSys.findSpawnPoint(s.x, s.z, 2, 7);
        if (p) this.mobSys.spawn(id, p[0], p[1], p[2]);
      }
    }
  }

  // ================= BLOCK GRAVITY =================
  /** blocks with no support below AND on all four sides crumble into drops */
  private gravQueue: number[] = [];
  private gravSet = new Set<number>();

  private gravKey(x: number, y: number, z: number) {
    return Engine.packCell(x, y, z);
  }

  private enqueueSupportCheck(x: number, y: number, z: number) {
    const push = (px: number, py: number, pz: number) => {
      if (!this.world.inBounds(px, py, pz)) return;
      const k = this.gravKey(px, py, pz);
      if (this.gravSet.has(k)) return;
      this.gravSet.add(k);
      this.gravQueue.push(k);
    };
    push(x + 1, y, z);
    push(x - 1, y, z);
    push(x, y + 1, z);
    push(x, y, z + 1);
    push(x, y, z - 1);
  }

  private vineTips = new Map<number, { x: number; y: number; z: number; t: number }>();

  private growVines(dt: number) {
    for (const [key, tip] of this.vineTips) {
      if (Math.hypot(tip.x - this.pos.x, tip.z - this.pos.z) > 80) {
        this.vineTips.delete(key);
        continue;
      }
      tip.t -= dt;
      if (tip.t > 0) continue;
      this.vineTips.delete(key);
      if (this.world.get(tip.x, tip.y, tip.z) !== VINE ||
          tip.y <= 1 || this.world.get(tip.x, tip.y - 1, tip.z) !== AIR) continue;
      let anchorY = tip.y;
      while (anchorY + 1 < WY && this.world.get(tip.x, anchorY + 1, tip.z) === VINE) anchorY++;
      if (!isLeafId(this.world.get(tip.x, anchorY + 1, tip.z))) continue;
      this.world.set(tip.x, tip.y - 1, tip.z, VINE);
      this.markDirtyAt(tip.x, tip.z);
      this.vineTips.set(Engine.packCell(tip.x, tip.y - 1, tip.z),
        { ...tip, y: tip.y - 1, t: 4 + Math.random() * 4 });
    }
  }

  private updateBlockGravity() {
    if (!this.gravQueue.length) return;
    let crumbled = false;
    let budget = 18;
    while (this.gravQueue.length && budget-- > 0) {
      const k = this.gravQueue.shift()!;
      this.gravSet.delete(k);
      const [x, y, z] = Engine.unpackCell(k);
      const id = this.world.get(x, y, z);
      if (id === AIR || id === BEDROCK || id === LAVA || id === WATER || id === VINE || y <= 1) continue;
      if (id === SAND) {
        // Sand is gravity-driven: drop it into the first supported cell below.
        let fallY=y;
        while (fallY>1 && this.world.get(x,fallY-1,z)===AIR) {
          this.world.set(x,fallY,z,AIR); this.world.set(x,fallY-1,z,SAND); fallY--;
        }
        if (fallY!==y) { this.markDirtyAt(x,z); this.enqueueSupportCheck(x,fallY,z); this.enqueueSupportCheck(x,y,z); }
        continue;
      }
      if (isLeafId(id)) {
        // Palm crowns reach three blocks out; all leaf kinds recognise
        // their matching living trunk or adjacent solid structure block.
        let alive =
          isSolid(this.world.get(x, y - 1, z)) ||
          isSolid(this.world.get(x, y + 1, z)) ||
          isSolid(this.world.get(x + 1, y, z)) ||
          isSolid(this.world.get(x - 1, y, z)) ||
          isSolid(this.world.get(x, y, z + 1)) ||
          isSolid(this.world.get(x, y, z - 1));
        const reach = id === COCONUT_LEAVES || id === BANANA_LEAVES ? 3 : 2;
        for (let dy = -2; dy <= 2 && !alive; dy++)
          for (let dz2 = -reach; dz2 <= reach && !alive; dz2++)
            for (let dx2 = -reach; dx2 <= reach; dx2++)
              if ((reach === 3 ?
                this.world.get(x + dx2, y + dy, z + dz2) === PALM_LOG :
                isLogId(this.world.get(x + dx2, y + dy, z + dz2)))) {
                alive = true;
                break;
              }
        if (alive) continue;
      } else if (
        // regular blocks & hanging lanterns: supported from below, above, or any side
        isSolid(this.world.get(x, y - 1, z)) ||
        isSolid(this.world.get(x, y + 1, z)) ||
        isSolid(this.world.get(x + 1, y, z)) ||
        isSolid(this.world.get(x - 1, y, z)) ||
        isSolid(this.world.get(x, y, z + 1)) ||
        isSolid(this.world.get(x, y, z - 1))
      )
        continue;

      // unsupported → crumble
      this.world.set(x, y, z, AIR);
      const def = BLOCKS[id];
      if (def.drop) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, def.drop);
      this.burst(x + 0.5, y + 0.5, z + 0.5, def.tint, 6, 2.2);
      this.markDirtyAt(x, z);
      crumbled = true;
      this.enqueueSupportCheck(x, y, z);
    }
    if (crumbled) sfx.breakBlock(0.9);
  }

  private tryPlace() {
    if (this.phase !== 'playing') return;
    if (this.placeCooldown > 0) return;
    const id = this.hotbar[this.selected];
    if (!id || id === HAND) return;
    // Right-clicking while holding Armor in hand equips it immediately
    if (isGearHotbarId(id)) {
      const g = this.bagItems.find((b) => b.hid === id);
      if (g) {
        this.equip(g.uid);
        this.placeCooldown = 0.25;
      }
      return;
    }
    // Right-clicking while holding Food in hand eats it
    const foodHeal =
      id === COOKED_MEAT ? 30 : id === COCONUT ? 22 : id === APPLE ? 20 : id === BANANA ? 16 : id === HONEY ? 15 : 0;
    if (foodHeal > 0) {
      const count = this.inventory.get(id) ?? 0;
      if (count > 0) {
        this.inventory.set(id, count - 1);
        this.health = Math.min(100, this.health + foodHeal);
        this.placeCooldown = 0.32;
        this.startSwing(0.45);
        sfx.pickup(4);
        this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${foodHeal} ${t('hp')}`, '#93c95d', true);
        this.syncHotbar(true);
        this.syncHud(true);
      }
      return;
    }
    const t2 = this.target;
    if (!t2) return;
    if (id >= TOOL_PICK || isResource(id)) return; // tools/resources don't place as blocks
    if ((this.inventory.get(id) ?? 0) <= 0) {
      if (this.placeCooldown <= 0) {
        sfx.ui(false);
        this.placeCooldown = 0.4;
      }
      return;
    }
    const px = t2.x + t2.nx,
      py = t2.y + t2.ny,
      pz = t2.z + t2.nz;
    if (!this.world.inBounds(px, py, pz)) return;
    const targetCell = this.world.get(px, py, pz);
    if (targetCell !== AIR && targetCell !== WATER) return; // building displaces water
    // don't entomb the player
    const minX = this.pos.x - PLAYER_HALF - 0.02,
      maxX = this.pos.x + PLAYER_HALF + 0.02;
    const minY = this.pos.y - 0.02,
      maxY = this.pos.y + PLAYER_HEIGHT + 0.02;
    const minZ = this.pos.z - PLAYER_HALF - 0.02,
      maxZ = this.pos.z + PLAYER_HALF + 0.02;
    if (px + 1 > minX && px < maxX && py + 1 > minY && py < maxY && pz + 1 > minZ && pz < maxZ) return;

    // Placing lava into a water cell is itself a contact, not a free swap.
    const placed = id === LAVA && targetCell === WATER ? VOLCANIC_STONE : id;
    this.world.set(px, py, pz, placed);
    if (placed === BED) {
      // Place the 2nd block (head) of the 2-block Minecraft bed along player's facing direction
      const pref: [number, number] =
        Math.abs(this.dirV.x) >= Math.abs(this.dirV.z)
          ? [this.dirV.x >= 0 ? 1 : -1, 0]
          : [0, this.dirV.z >= 0 ? 1 : -1];
      const candidates: Array<[number, number]> = [
        pref,
        [-pref[0], -pref[1]],
        [-pref[1], pref[0]],
        [pref[1], -pref[0]],
      ];
      for (const [bdx, bdz] of candidates) {
        const hx = px + bdx;
        const hz = pz + bdz;
        if (this.world.inBounds(hx, py, hz) && this.world.get(hx, py, hz) === AIR) {
          this.world.set(hx, py, hz, BED);
          this.rebuildAt(hx, hz);
          break;
        }
      }
    } else if (
      (placed === DOOR_WOOD || placed === DOOR_IRON) &&
      this.world.inBounds(px, py + 1, pz) &&
      this.world.get(px, py + 1, pz) === AIR &&
      this.world.get(px, py - 1, pz) !== placed
    ) {
      this.world.set(px, py + 1, pz, placed);
    }
    this.inventory.set(id, (this.inventory.get(id) ?? 0) - 1);
    this.enqueueFluid(px, py, pz); // placing next to fluid disturbs it
    this.rebuildAt(px, pz);
    this.placeCooldown = 0.18;
    this.startSwing(0.5);
    sfx.place();
    this.burst(px + 0.5, py + 0.5, pz + 0.5, BLOCKS[placed].tint, 5, 1.6);
    this.syncHotbar(true);
  }

  // ================= DROPS =================
  /** pretty 3D miniatures for animal & monster loot (instead of textured cubes) */
  private static fancyBox(
    g: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rx = 0,
    rz = 0,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.rotation.z = rz;
    g.add(m);
  }

  private buildFancyDrop(id: number): THREE.Group | null {
    const g = new THREE.Group();
    const B = Engine.fancyBox;
    switch (id) {
      case WOOL: {
        // fluffy cloud of offset puffs
        B(g, 0, 0, 0, 0.3, 0.24, 0.3, 0xeeeeeb);
        B(g, 0.12, 0.08, -0.06, 0.2, 0.18, 0.2, 0xf8f8f5);
        B(g, -0.11, 0.06, 0.08, 0.18, 0.16, 0.18, 0xe0e0dc);
        B(g, 0.02, 0.15, 0.05, 0.16, 0.13, 0.16, 0xffffff);
        break;
      }
      case FEATHER: {
        // quill + vane, tilted
        B(g, 0, 0, 0, 0.04, 0.42, 0.04, 0xc8c4b8, 0, 0.5);
        B(g, 0.07, 0.08, 0, 0.16, 0.3, 0.03, 0xf2f2f6, 0, 0.5);
        B(g, 0.12, 0.2, 0, 0.1, 0.16, 0.03, 0xdcdce4, 0, 0.5);
        break;
      }
      case TURTLE_SHELL: {
        // domed carapace with scute plates
        B(g, 0, 0, 0, 0.42, 0.12, 0.5, 0x4d8c5a);
        B(g, 0, 0.09, 0, 0.32, 0.1, 0.38, 0x5a9e68);
        B(g, 0, 0.17, 0, 0.2, 0.08, 0.24, 0x7ab88a);
        B(g, 0, -0.07, 0, 0.36, 0.04, 0.44, 0xd8cfa8); // pale rim
        break;
      }
      case CRAB_SHELL: {
        B(g, 0, 0, 0, 0.38, 0.1, 0.3, 0xd85a3a);
        B(g, 0, 0.08, 0, 0.28, 0.09, 0.22, 0xf2836a);
        B(g, 0.2, 0.02, -0.08, 0.08, 0.06, 0.1, 0xa83c22); // spike
        B(g, -0.2, 0.02, -0.08, 0.08, 0.06, 0.1, 0xa83c22);
        break;
      }
      case FISH_SCALE: {
        B(g, 0, 0, 0, 0.22, 0.26, 0.04, 0x6eaadc, 0.2);
        B(g, 0, 0.08, 0.01, 0.16, 0.12, 0.03, 0x9ecdf2, 0.2);
        break;
      }
      case CAT_CLAW: {
        // curved talon from three angled segments
        B(g, 0, 0.1, 0, 0.09, 0.16, 0.09, 0xc8bca4);
        B(g, 0.05, -0.02, 0, 0.07, 0.16, 0.07, 0xe6dcc8, 0, -0.5);
        B(g, 0.13, -0.13, 0, 0.05, 0.14, 0.05, 0xf2ecda, 0, -0.9);
        break;
      }
      case HONEY: {
        // amber droplet
        B(g, 0, 0, 0, 0.22, 0.26, 0.22, 0xf4b83a);
        B(g, 0, 0.16, 0, 0.12, 0.14, 0.12, 0xf4b83a);
        B(g, 0.05, 0.05, 0.05, 0.08, 0.08, 0.08, 0xffd97a); // glint
        break;
      }
      case RAW_MEAT: {
        B(g, 0, 0, 0, 0.34, 0.16, 0.26, 0xd2574c);
        B(g, 0.05, 0.05, 0, 0.16, 0.1, 0.14, 0xf0938a); // marbling
        B(g, -0.15, 0, 0, 0.06, 0.18, 0.28, 0xf8e3d4); // fat rim
        break;
      }
      case COOKED_MEAT: {
        B(g, 0, 0, 0, 0.34, 0.16, 0.26, 0x9a5a2c);
        B(g, 0.04, 0.05, 0, 0.18, 0.09, 0.14, 0xc07c42);
        B(g, -0.08, 0.07, 0.04, 0.12, 0.03, 0.05, 0x5a3116); // grill marks
        break;
      }
      case BONE: {
        B(g, 0, 0, 0, 0.09, 0.4, 0.09, 0xe8e2d2, 0, 0.4);
        B(g, -0.1, 0.2, 0, 0.12, 0.12, 0.12, 0xf4efe2, 0, 0.4);
        B(g, 0.1, -0.2, 0, 0.12, 0.12, 0.12, 0xf4efe2, 0, 0.4);
        break;
      }
      case FLESH: {
        B(g, 0, 0, 0, 0.3, 0.14, 0.26, 0x7a9a4a);
        B(g, 0.06, 0.06, -0.03, 0.14, 0.08, 0.12, 0x5a7a34);
        B(g, -0.07, 0.04, 0.06, 0.1, 0.06, 0.08, 0xa05a4a); // raw patch
        break;
      }
      case GUNPOWDER: {
        // little grey mound
        B(g, 0, -0.05, 0, 0.3, 0.1, 0.3, 0x4a4a52);
        B(g, 0, 0.03, 0, 0.2, 0.1, 0.2, 0x55555c);
        B(g, 0.02, 0.1, -0.02, 0.1, 0.08, 0.1, 0x7a7a84);
        break;
      }
      case WEB: {
        // spun silk bundle
        B(g, 0, 0, 0, 0.26, 0.2, 0.26, 0xeef0f5);
        B(g, 0.08, 0.06, 0.08, 0.14, 0.12, 0.14, 0xffffff);
        B(g, -0.09, -0.04, -0.05, 0.12, 0.1, 0.12, 0xd8dce6);
        break;
      }
      case FLOWER_RED:
      case FLOWER_YELLOW:
      case FLOWER_BLUE: {
        // a picked bloom: short stem, leaf, petal cross around a core
        const petal = id === FLOWER_RED ? 0xe2564a : id === FLOWER_YELLOW ? 0xf4c842 : 0x5e8cff;
        const core = id === FLOWER_YELLOW ? 0xb8722a : 0xf4c842;
        B(g, 0, -0.12, 0, 0.05, 0.24, 0.05, 0x4d8c31, 0, 0.3); // tilted stem
        B(g, 0.07, -0.16, 0, 0.1, 0.04, 0.06, 0x5f9738); // leaf
        B(g, 0, 0.05, 0, 0.11, 0.11, 0.11, core);
        B(g, 0.11, 0.05, 0, 0.11, 0.09, 0.09, petal);
        B(g, -0.11, 0.05, 0, 0.11, 0.09, 0.09, petal);
        B(g, 0, 0.05, 0.11, 0.09, 0.09, 0.11, petal);
        B(g, 0, 0.05, -0.11, 0.09, 0.09, 0.11, petal);
        B(g, 0, 0.14, 0, 0.08, 0.05, 0.08, petal);
        break;
      }
      case TALL_GRASS:
      case FERN: {
        B(g, 0, -0.05, 0, 0.06, 0.28, 0.06, 0x5f9738, 0, 0.2);
        B(g, 0.06, 0.02, 0, 0.12, 0.05, 0.06, 0x78b54e);
        B(g, -0.06, 0.08, 0, 0.12, 0.05, 0.06, 0x4a7a2a);
        break;
      }
      case DEAD_BUSH: {
        B(g, 0, 0, 0, 0.05, 0.24, 0.05, 0xa4845c, 0, 0.3);
        B(g, 0.05, 0.06, 0, 0.12, 0.04, 0.06, 0x88663e);
        break;
      }
      case COCONUT: {
        B(g, 0, 0, 0, 0.24, 0.22, 0.24, 0x75502e);
        B(g, 0, 0.11, 0, 0.14, 0.07, 0.14, 0xb89261);
        break;
      }
      case BANANA: {
        B(g, 0, 0, 0, 0.07, 0.26, 0.07, 0xf3d34f, 0, 0.7);
        B(g, 0.1, -0.08, 0, 0.08, 0.17, 0.07, 0xe6c035, 0, 0.4);
        break;
      }
      case APPLE: {
        // glossy red apple with stem and green leaf
        B(g, 0, 0, 0, 0.24, 0.24, 0.24, 0xe23628);
        B(g, 0, 0.12, 0, 0.18, 0.06, 0.18, 0xff5c4e); // top round
        B(g, 0.05, 0.04, 0.05, 0.09, 0.1, 0.09, 0xff7a6c); // glint
        B(g, 0, 0.17, 0, 0.04, 0.09, 0.04, 0x5c3d18, 0, 0.3); // stem
        B(g, 0.07, 0.17, 0, 0.09, 0.04, 0.06, 0x56a832, 0, 0.3); // leaf
        break;
      }
      case COAL: {
        // 3D Ember-Core Anthracite Shard Cluster: 3 jagged dark carbon spires + glowing orange ember heart
        B(g, 0, 0.03, 0, 0.14, 0.30, 0.14, 0x222636, 0.08, -0.08);
        B(g, -0.09, -0.02, 0.03, 0.12, 0.22, 0.12, 0x161924, 0, 0.28);
        B(g, 0.09, -0.01, -0.02, 0.12, 0.24, 0.12, 0x2c3145, -0.1, -0.26);
        // Glowing orange-gold ember fissure core
        B(g, 0, -0.01, 0.05, 0.09, 0.12, 0.08, 0xff771a);
        B(g, 0, 0.01, 0.07, 0.05, 0.07, 0.05, 0xffe270);
        break;
      }
      case IRON: {
        // 3D Dwarven Twin-Flanged Steel Bar with Brass Rivets
        B(g, 0, 0, 0, 0.34, 0.09, 0.14, 0x5c667a); // recessed gunmetal web
        B(g, 0, 0.055, 0, 0.34, 0.03, 0.17, 0xeef4fc); // top silver-steel rail
        B(g, 0, -0.055, 0, 0.34, 0.03, 0.17, 0x9aa6ba); // bottom steel rail
        B(g, -0.11, 0, 0, 0.07, 0.15, 0.19, 0xd6e0ed); // left flange collar
        B(g, 0.11, 0, 0, 0.07, 0.15, 0.19, 0xd6e0ed); // right flange collar
        B(g, -0.04, 0.07, 0, 0.035, 0.03, 0.06, 0xf0b442); // brass rivet L
        B(g, 0.04, 0.07, 0, 0.035, 0.03, 0.06, 0xf0b442); // brass rivet R
        break;
      }
      case REDSTONE: {
        // 3D Volatile Arcane Crimson Energy Crystal & Orbiting Sparks
        B(g, 0, 0.02, 0, 0.12, 0.32, 0.12, 0xc91230, 0.12, 0.18);
        B(g, 0, 0.02, 0, 0.18, 0.18, 0.18, 0xf01e42, 0.12, 0.18);
        B(g, 0, 0.02, 0, 0.09, 0.22, 0.15, 0xff6680, 0.12, 0.18);
        // Orbiting scarlet-pink energy motes
        B(g, -0.15, 0.13, 0.06, 0.06, 0.06, 0.06, 0xff2e4c);
        B(g, 0.15, 0.11, -0.05, 0.06, 0.06, 0.06, 0xff8598);
        B(g, -0.13, -0.10, -0.06, 0.05, 0.05, 0.05, 0xff2e4c);
        B(g, 0.13, -0.09, 0.06, 0.05, 0.05, 0.05, 0xff8598);
        break;
      }
      case GOLD: {
        // 3D Gleaming Beveled Pure-Gold Bullion Ingot (stepped trapezoidal gold bar with stamped mint ridges)
        B(g, 0, -0.045, 0, 0.36, 0.055, 0.21, 0xb8760b); // deep amber-gold base bevel
        B(g, 0, 0.005, 0, 0.32, 0.055, 0.175, 0xe8ad15); // warm gold middle body
        B(g, 0, 0.048, 0, 0.27, 0.035, 0.14, 0xfcd12a); // radiant sun-gold top table
        // Two raised stamped gold bullion bands + white-gold specular edge glint
        B(g, -0.065, 0.07, 0, 0.05, 0.018, 0.11, 0xffe975);
        B(g, 0.065, 0.07, 0, 0.05, 0.018, 0.11, 0xffe975);
        B(g, 0, 0.068, -0.045, 0.23, 0.014, 0.025, 0xfffbe0);
        break;
      }
      case LAPIS: {
        // 3D Faceted Royal Sapphire-Lazuli Gemstone (multi-tiered diamond/marquise-cut azure crystal)
        B(g, 0, 0, 0, 0.18, 0.28, 0.10, 0x142e8c, 0.08, 0.18); // deep ultramarine outer pavilion
        B(g, 0, 0, 0, 0.22, 0.20, 0.11, 0x1e46c7, 0.08, 0.18); // royal cobalt girdle
        B(g, 0, 0.01, 0, 0.15, 0.22, 0.13, 0x3369f5, 0.08, 0.18); // vivid azure crown facets
        B(g, 0, 0.01, 0, 0.10, 0.15, 0.15, 0x6ba1ff, 0.08, 0.18); // bright sky-blue central table
        B(g, -0.02, 0.05, 0.065, 0.045, 0.065, 0.03, 0xe0f0ff, 0.08, 0.18); // crisp white-azure gem shine
        break;
      }
      case DIAMOND: {
        // 3D 4-Pointed Star-Prism Ice Crystal
        B(g, 0, 0, 0, 0.11, 0.34, 0.11, 0x42e8f5); // vertical star spear
        B(g, 0, 0, 0, 0.32, 0.11, 0.11, 0x42e8f5); // horizontal star spear
        B(g, 0, 0, 0, 0.11, 0.11, 0.28, 0x1fa6bd); // depth star spear
        B(g, 0, 0, 0, 0.18, 0.18, 0.15, 0x8cfaff, 0, Math.PI / 4); // diagonal prism core
        B(g, 0, 0, 0, 0.10, 0.10, 0.17, 0xffffff); // brilliant white heart
        break;
      }
      case EMERALD: {
        // 3D Twin-Spire Jade Beryl Cluster on Dark Rock Matrix
        B(g, 0, -0.12, 0, 0.22, 0.08, 0.18, 0x323642); // dark rock matrix base
        B(g, 0.03, 0.03, 0, 0.12, 0.30, 0.11, 0x15b856, 0, -0.1); // tall main jade spire
        B(g, 0.03, 0.05, 0, 0.07, 0.26, 0.13, 0x5ef298, 0, -0.1); // bright mint facet
        B(g, -0.08, -0.02, 0.02, 0.09, 0.20, 0.09, 0x0f8f42, 0.08, 0.36); // angled side spire
        B(g, -0.08, 0, 0.02, 0.05, 0.16, 0.10, 0x8affb8, 0.08, 0.36); // side spire highlight
        break;
      }
      case QUARTZ: {
        // 3D Radiating 3-Pronged Rose-Ivory Geode Crown
        B(g, 0, -0.11, 0, 0.22, 0.08, 0.16, 0x4a1e2b); // dark volcanic geode base
        B(g, 0, 0.04, 0, 0.10, 0.28, 0.10, 0xf7f0f2); // central tall quartz needle
        B(g, 0, 0.07, 0, 0.06, 0.24, 0.11, 0xffffff); // pure white tip
        B(g, -0.09, 0.01, 0.02, 0.09, 0.22, 0.09, 0xdecbcf, 0.08, 0.42); // left angled needle
        B(g, 0.09, 0.01, -0.02, 0.09, 0.22, 0.09, 0xe8d8dc, -0.08, -0.42); // right angled needle
        break;
      }
      case NETHERITE: {
        // 3D Ancient Damascus Ingot with Glowing Lava Runes
        B(g, 0, -0.02, 0, 0.34, 0.10, 0.19, 0x261c1f);
        B(g, 0, 0.04, 0, 0.28, 0.06, 0.14, 0x453338);
        B(g, 0, 0.075, 0, 0.18, 0.02, 0.06, 0xff6a1a);
        break;
      }
      default: {
        if (isPickTool(id)) {
          const tierIdx = id - PICK_TOOLS[0];
          const headCol = [0xb98a4d, 0x9aa0a6, 0xd6d9dd, 0x5fe8dc][tierIdx] ?? 0xb98a4d;
          B(g, 0, -0.02, 0, 0.05, 0.38, 0.05, 0x8b6234, 0, 0.3);
          B(g, -0.04, 0.14, 0, 0.32, 0.07, 0.07, headCol, 0, 0.3);
          break;
        }
        if (isSwordTool(id)) {
          const tierIdx = id - SWORD_TOOLS[0];
          const bladeCol = [0xb98a4d, 0xd6d9dd, 0x5fe8dc][tierIdx] ?? 0xd6d9dd;
          B(g, 0.04, -0.13, 0, 0.05, 0.13, 0.05, 0x6e4f2a, 0, 0.3);
          B(g, 0.01, -0.06, 0, 0.18, 0.04, 0.06, 0x4a351d, 0, 0.3);
          B(g, -0.05, 0.11, 0, 0.08, 0.3, 0.04, bladeCol, 0, 0.3);
          break;
        }
        if (isAxeTool(id)) {
          const headCol = id === AXE_TOOLS[0] ? 0xb98a4d : 0x9aa0a6;
          B(g, 0, -0.02, 0, 0.05, 0.36, 0.05, 0x8b6234, 0, 0.25);
          B(g, 0.06, 0.1, 0, 0.16, 0.14, 0.06, headCol, 0, 0.25);
          break;
        }
        if (id === TOOL_SHOVEL) {
          B(g, 0, -0.04, 0, 0.05, 0.34, 0.05, 0x8b6234, 0, 0.25);
          B(g, -0.04, 0.14, 0, 0.14, 0.15, 0.04, 0xa8aeb4, 0, 0.25);
          break;
        }
        if (id === TOOL_BOW) {
          B(g, 0, 0, 0, 0.05, 0.38, 0.05, 0x8b6234, 0, 0.2);
          B(g, 0.06, 0, 0, 0.02, 0.36, 0.02, 0xe8e2d2, 0, 0.2);
          break;
        }
        if (id === TOOL_TORCH) {
          B(g, 0, -0.03, 0, 0.06, 0.28, 0.06, 0x8b6234);
          B(g, 0, 0.14, 0, 0.08, 0.09, 0.08, 0xffb03a);
          break;
        }
        return null;
      }
    }
    return g;
  }

  /**
   * Throw the currently held item (block, material, food, weapon/tool, or armor)
   * forward onto the ground when pressing G.
   */
  dropHeldItem() {
    if (this.phase !== 'playing') return;
    const id = this.hotbar[this.selected];
    if (id === undefined || id === HAND) {
      sfx.ui(false);
      return;
    }

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const sx = this.pos.x + fx * 0.65;
    const sy = this.pos.y + 1.15;
    const sz = this.pos.z + fz * 0.65;
    const tvx = fx * 5.2;
    const tvy = 2.5 + Math.max(-0.2, this.dirV.y) * 2.4;
    const tvz = fz * 5.2;

    if (isGearHotbarId(id)) {
      const idx = this.bagItems.findIndex((b) => b.hid === id);
      if (idx < 0) {
        this.hotbar[this.selected] = undefined;
        this.syncHotbar(true);
        this.syncHud(true);
        return;
      }
      const [gear] = this.bagItems.splice(idx, 1);
      this.hotbar[this.selected] = undefined;
      this.spawnDrop(sx, sy, sz, LOOT_BAG, gear, { vx: tvx, vy: tvy, vz: tvz, pickupDelay: 1.35, thrown: true });
      this.startSwing(0.45);
      sfx.place();
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }

    const count = this.inventory.get(id) ?? 0;
    if (count <= 0) {
      this.hotbar[this.selected] = undefined;
      sfx.ui(false);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }

    if (count - 1 <= 0) {
      this.inventory.delete(id);
      this.hotbar[this.selected] = undefined;
    } else {
      this.inventory.set(id, count - 1);
    }

    if (id >= 200) {
      this.recalcOwnedToolTiers();
    }

    this.spawnDrop(sx, sy, sz, id, null, { vx: tvx, vy: tvy, vz: tvz, pickupDelay: 1.35, thrown: true });
    this.startSwing(0.45);
    sfx.place();
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private recalcOwnedToolTiers() {
    let bestPick = 0;
    for (let t = 0; t < PICK_TOOLS.length; t++) {
      if ((this.inventory.get(PICK_TOOLS[t]) ?? 0) > 0) bestPick = t;
    }
    this.tier = bestPick;
    this.updatePickaxe();
    let bestSword = -1;
    for (let s = 0; s < SWORD_TOOLS.length; s++) {
      if ((this.inventory.get(SWORD_TOOLS[s]) ?? 0) > 0) bestSword = s;
    }
    this.swordTier = bestSword;
  }

  private spawnDrop(
    x: number,
    y: number,
    z: number,
    id: number,
    gear: Item | null = null,
    opts?: { vx?: number; vy?: number; vz?: number; pickupDelay?: number; thrown?: boolean },
  ) {
    const d = this.drops.find((dd) => !dd.active) ?? this.drops[0];
    d.active = true;
    d.id = id;
    d.gear = gear ? ensureGearHid(gear) : null;
    d.age = 0;
    d.pickupDelay = opts?.pickupDelay ?? 0.22;
    d.thrown = opts?.thrown ?? false;
    d.x = x;
    d.y = y;
    d.z = z;
    const a = this.rand() * Math.PI * 2;
    const sp = 1.4 + this.rand() * 1.5;
    d.vx = opts?.vx ?? Math.cos(a) * sp;
    d.vz = opts?.vz ?? Math.sin(a) * sp;
    d.vy = opts?.vy ?? 3.4 + this.rand() * 1.8;
    // volumetric loot models replace the textured cube where available
    if (d.fancy) {
      this.scene.remove(d.fancy);
      d.fancy = null;
    }
    const fancy = this.buildFancyDrop(id);
    if (fancy) {
      d.fancy = fancy;
      // Miniature parts extend below their group's origin (especially flower
      // stems). Account for their full bounds, the display scale and bobbing.
      const bounds = new THREE.Box3().setFromObject(fancy);
      d.clearance = Math.max(0.14, -bounds.min.y * 0.3 * 2.6 + 0.08);
      fancy.position.set(x, y, z);
      this.scene.add(fancy);
      d.mesh.visible = false;
    } else {
      d.clearance = 0.32; // a spinning cube's lowest corner plus bobbing
      d.mesh.visible = true;
      this.applyDropUV(d, id);
    }
  }

  private applyDropUV(d: Drop, id: number) {
    const def = BLOCKS[id];
    const uv = d.mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const base = this.dropUVBase;
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z ; 4 verts each
    for (let f = 0; f < 6; f++) {
      const tile = f === 2 ? def.top : f === 3 ? def.bottom : def.side;
      const [u0, v0, u1, v1] = tileUV(tile);
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, u0 + (u1 - u0) * base[idx * 2], v0 + (v1 - v0) * base[idx * 2 + 1]);
      }
    }
    uv.needsUpdate = true;
  }

  private updateDrops(dt: number, frozen: boolean) {
    if (this.placeCooldown > 0) this.placeCooldown -= dt;
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + 1.1, this.pos.z);
    for (const d of this.drops) {
      if (!d.active) continue;
      d.age += dt;
      if (!frozen) {
        const dist = Math.hypot(d.x - eye.x, d.y - eye.y, d.z - eye.z);
        const delay = d.pickupDelay ?? 0.22;
        // attraction radius: short by default, extended by the MAGNET affix
        const magnetR = 2.1 + this.stats.magnet;
        if (d.age > delay + 0.04 && dist < magnetR) {
          const sd = Math.max(0.001, dist);
          const pull = (34 / Math.max(1.6, dist * 1.1)) * 6;
          const damp = Math.pow(0.02, dt);
          d.vx = (d.vx + ((eye.x - d.x) / sd) * pull * dt) * damp;
          d.vy = (d.vy + ((eye.y - d.y) / sd) * pull * dt) * damp;
          d.vz = (d.vz + ((eye.z - d.z) / sd) * pull * dt) * damp;
        } else {
          d.vy -= GRAVITY * 0.62 * dt;
          d.vx *= Math.pow(0.25, dt);
          d.vz *= Math.pow(0.25, dt);
        }
        const nx = d.x + d.vx * dt,
          ny = d.y + d.vy * dt,
          nz = d.z + d.vz * dt;
        if (isSolid(this.world.get(Math.floor(nx), Math.floor(d.y), Math.floor(d.z)))) d.vx *= -0.35;
        else d.x = nx;
        const floorY = Math.floor(ny - d.clearance);
        let hitFloor: number | null = null;
        for (let yy = Math.floor(d.y - d.clearance); yy >= floorY; yy--) {
          if (isSolid(this.world.get(Math.floor(d.x), yy, Math.floor(d.z)))) {
            hitFloor = yy;
            break;
          }
        }
        if (hitFloor !== null && d.vy < 0) {
          d.y = hitFloor + 1 + d.clearance;
          d.vy = 0;
        } else if (isSolid(this.world.get(Math.floor(d.x), Math.floor(ny), Math.floor(d.z)))) {
          d.vy *= -0.3;
        } else d.y = ny;
        if (isSolid(this.world.get(Math.floor(d.x), Math.floor(d.y), Math.floor(nz)))) d.vz *= -0.35;
        else d.z = nz;

        if (d.age > delay && dist < 1.35) {
          this.collect(d);
          continue;
        }
        // uncollected drops eventually despawn (loot bags linger much longer)
        if (d.age > (d.id === LOOT_BAG ? 150 : 60)) {
          d.active = false;
          d.mesh.visible = false;
          if (d.fancy) {
            this.scene.remove(d.fancy);
            d.fancy = null;
          }
          continue;
        }
      }
      const s = 0.28 + Math.sin(d.age * 5) * 0.02;
      if (d.fancy) {
        // fancy models bob & spin upright (no X tumble — they read better level)
        d.fancy.position.set(d.x, d.y + Math.sin(d.age * 3) * 0.06, d.z);
        d.fancy.rotation.y += dt * 2;
        d.fancy.scale.setScalar(s * 2.6);
      } else {
        d.mesh.position.set(d.x, d.y + Math.sin(d.age * 3) * 0.06, d.z);
        d.mesh.rotation.y += dt * 2.4;
        d.mesh.rotation.x += dt * 0.9;
        d.mesh.scale.setScalar(s);
      }
    }
  }

  private collect(d: Drop) {
    d.active = false;
    d.mesh.visible = false;
    if (d.fancy) {
      this.scene.remove(d.fancy);
      d.fancy = null;
    }
    // a loot bag holds a rolled piece of gear
    if (d.id === LOOT_BAG && d.gear) {
      const it = ensureGearHid(d.gear);
      d.gear = null;
      this.bagItems.push(it);
      if (!d.thrown) {
        this.pushBanner(
          t('looted'),
          `${t(('slot_' + it.slot) as never)} · ${it.affixes.map((a) => t(AFFIX_KEY[a.id])).join(' + ') || '—'}`,
          RARITY_COLORS[it.rarity],
        );
        this.burst(d.x, d.y, d.z, [217, 140, 255], 14, 3);
        sfx.upgrade();
      } else {
        sfx.pickup(3);
      }
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    // Picking up a dropped weapon or tool
    if (d.id >= 200) {
      this.inventory.set(d.id, (this.inventory.get(d.id) ?? 0) + 1);
      this.addToHotbar(d.id);
      this.recalcOwnedToolTiers();
      sfx.pickup(4);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    if (d.thrown) {
      this.inventory.set(d.id, (this.inventory.get(d.id) ?? 0) + 1);
      this.addToHotbar(d.id);
      sfx.pickup(2);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    const def = BLOCKS[d.id];
    const comboMult = this.comboMult();
    const tierMult = PICKAXE_TIERS[this.tier].mult;
    const gained = Math.max(1, Math.round(def.score * comboMult * tierMult));
    this.score += gained;
    this.inventory.set(d.id, (this.inventory.get(d.id) ?? 0) + 1);
    this.addToHotbar(d.id);
    if ((d.id >= 5 && d.id <= 8) || (d.id >= REDSTONE && d.id <= QUARTZ)) this.oresFound++;
    if (def.timeBonus > 0) {
      this.timeLeft = Math.min(this.runTime + 40, this.timeLeft + def.timeBonus);
      this.popup(d.x, d.y + 0.6, d.z, `+${def.timeBonus}${t('secShort')}`, '#7ee7a0', true);
    }
    if (d.id === DIAMOND || d.id === EMERALD) this.health = Math.min(100, this.health + 16);
    else if (d.id === GOLD || d.id === LAPIS || d.id === QUARTZ) this.health = Math.min(100, this.health + 8);
    else if (d.id === IRON || d.id === REDSTONE) this.health = Math.min(100, this.health + 4);
    else if (d.id === COAL) this.health = Math.min(100, this.health + 2);

    this.popup(d.x, d.y + 0.3, d.z, `+${gained}`, gained >= 200 ? '#f7d34b' : gained >= 40 ? '#8fe3ff' : '#ffffff', gained >= 100);
    this.burst(d.x, d.y, d.z, def.tint, 8, 2.4);
    sfx.pickup(this.combo);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private comboMult() {
    return 1 + Math.min(this.combo, 24) * 0.14;
  }

  private addToHotbar(id: number) {
    if (this.hotbar.includes(id)) return;
    const f = this.firstFreeSlot();
    if (f < 0) return;
    this.hotbar[f] = id;
  }

  // ================= DAY / NIGHT =================
  /** 0 = midnight, 0.5 = noon */
  private updateClock(dt: number) {
    this.clock = (this.clock + dt / this.dayLen) % 1;
    const smooth01 = (v: number) => {
      const t2 = Math.max(0, Math.min(1, v));
      return t2 * t2 * (3 - 2 * t2);
    };

    const sunAngle = this.clock * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(sunAngle);
    this.daylight = smooth01((sunHeight + 0.22) / 0.92);

    const d = this.daylight;
    if (this.skyMesh) this.skyMesh.position.copy(this.camera.position);
    if (this.stars) this.stars.position.copy(this.camera.position);
    const biome = this.world.biomeAt(Math.floor(this.pos.x), Math.floor(this.pos.z));
    const dry = biome === 'desert' || biome === 'canyon';
    const weather = dry ? 0 : this.weatherIntensity;

    const night = new THREE.Color(0x050914);
    const dawn = new THREE.Color(dry ? 0xffad63 : 0xe8895d);
    const day = new THREE.Color(dry ? 0xcfe8ff : biome === 'winter' ? 0xc7def3 : 0xb8d8f0);
    const storm = new THREE.Color(biome === 'winter' ? 0xaebccc : 0x788897);
    const c = new THREE.Color();
    if (d < 0.22) c.copy(night).lerp(dawn, d / 0.22);
    else c.copy(dawn).lerp(day, (d - 0.22) / 0.78);
    if (weather > 0) c.lerp(storm, Math.min(0.78, weather * 0.72));

    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(c);
    const nightHaze = 0.58 + d * 0.42;
    const weatherHaze = 1 - weather * 0.18;
    fog.far = this.renderDist * nightHaze * weatherHaze;
    fog.near = fog.far * (0.36 + weather * 0.08);
    this.scene.background = c;
    if (this.skyMat) this.skyMat.color.copy(c).multiplyScalar((dry ? 0.72 : 0.62) + d * (dry ? 0.62 : 0.54));

    const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 0.84, sunHeight * 0.96, -0.34).normalize();
    this.sunDir.copy(sunDir);
    const moonDir = sunDir.clone().multiplyScalar(-1);
    const celestialR = 255;
    if (this.sunMesh) {
      this.sunMesh.position.copy(this.camera.position).addScaledVector(sunDir, celestialR);
      this.sunMesh.lookAt(this.camera.position);
      this.sunMesh.visible = sunDir.y > -0.05 && d > 0.035;
      const mat = this.sunMesh.material as THREE.MeshBasicMaterial;
      const sunOpacity = Math.max(0, Math.min(1, (d - 0.03) / 0.35)) * (dry ? 1 : 1 - weather * 0.55);
      mat.opacity = sunOpacity;
      mat.color.set(dry ? 0xffc933 : d < 0.35 ? 0xff9f3f : 0xffd24a);
      if (this.sunHaloMat) this.sunHaloMat.opacity = sunOpacity * (dry ? 0.36 : 0.24) * (1 - weather * 0.45);
      const sc = dry && d > 0.65 ? 1.18 : 1;
      this.sunMesh.scale.setScalar(sc);
    }
    if (this.moonMesh) {
      this.moonMesh.position.copy(this.camera.position).addScaledVector(moonDir, celestialR);
      this.moonMesh.lookAt(this.camera.position);
      this.moonMesh.visible = moonDir.y > -0.03 && d < 0.72;
    }
    if (this.starMat) {
      this.starMat.opacity = smooth01((0.42 - d) / 0.42) * (1 - Math.min(0.85, weather * 0.85));
    }

    const lightDir = sunDir.y > -0.04 ? sunDir : moonDir;
    if (this.sunLight) {
      this.sunLight.position.copy(lightDir);
      this.sunLight.color.set(sunDir.y > -0.04 ? (dry ? 0xffe0a8 : 0xfff0d0) : 0x88a6d8);
      const sunPower = sunDir.y > -0.04 ? 0.08 + d * (dry ? 0.92 : 0.74) : 0.035 + (1 - d) * 0.06;
      this.sunLight.intensity = sunPower * (1 - weather * 0.35);
    }
    if (this.ambLight) {
      const ambient = (0.045 + d * (dry ? 0.42 : 0.34)) * (1 - weather * 0.26) + (dry && d > 0.5 ? 0.07 : 0);
      this.ambLight.intensity = ambient;
      this.ambLight.color.set(d < 0.25 ? 0x9fb8ff : dry ? 0xffe8be : 0xdfe8ff);
    }

    const tint = new THREE.Color();
    if (d < 0.22) tint.setRGB(0.58 + d * 1.2, 0.64 + d * 1.0, 0.86 + d * 0.55);
    else tint.setRGB(1, 1, dry ? 0.9 : 0.98);
    if (weather > 0) tint.lerp(new THREE.Color(0xaeb8c1), weather * 0.28);
    this.material.color.copy(tint);
    if (this.cutoutMat) this.cutoutMat.color.copy(tint);
    if (this.decorMat) this.decorMat.color.copy(tint);
    if (this.waterMat) this.waterMat.color.copy(new THREE.Color(d < 0.22 ? 0x8aa7d8 : 0xffffff).lerp(storm, weather * 0.22));
  }

  phaseName(): HudState['phaseName'] {
    const d = this.daylight;
    if (d > 0.82) return 'day';
    if (d < 0.2) return 'night';
    return this.clock < 0.5 ? 'dawn' : 'dusk';
  }

  // ================= MOBS =================
  private updateMobs(dt: number) {
    const night = this.daylight < 0.42;

    // hostile spawning
    if (this.survival) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = night ? 1.4 : 6;
        // caves are dark at any hour: when the player is underground, monsters
        // keep coming even at noon (and never burn down there — no open sky)
        const surfaceH = this.world.getHeight(Math.floor(this.pos.x), Math.floor(this.pos.z));
        const underground = this.pos.y < surfaceH - 4;
        const cap = night ? 12 : underground ? 7 : 3;
        if (this.mobSys.count(true) < cap) {
          const p = underground
            ? this.findCaveSpawn()
            : this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 16, 38);
          if (p) {
            // skeletons (melee + archer) now make up 40% of the night
            const roll = Math.random();
            const id: MobId =
              roll < 0.26 ? 'zombie' : roll < 0.44 ? 'spider' : roll < 0.66 ? 'skeleton' : roll < 0.84 ? 'archer' : 'creeper';
            const m = this.mobSys.spawn(id, p[0], p[1], p[2]);
            if (m && !night) m.burn = 0.4;
          }
        }
      }
    }
    // ---- travel direction tracking (for ahead-of-player spawning) ----
    const hv = Math.hypot(this.vel.x, this.vel.z);
    this.travelSpeed += (hv - this.travelSpeed) * Math.min(1, dt * 2);
    if (hv > 1.5) {
      const k = Math.min(1, dt * 1.5);
      this.travelDir.x += (this.vel.x / hv - this.travelDir.x) * k;
      this.travelDir.z += (this.vel.z / hv - this.travelDir.z) * k;
    }
    const moving = this.travelSpeed > 2.2 && Math.hypot(this.travelDir.x, this.travelDir.z) > 0.4;
    const biasAngle = moving ? Math.atan2(this.travelDir.z, this.travelDir.x) : null;

    // ---- fish schools: stock each water body the moment you approach it ----
    this.stockWaterAhead(biasAngle);

    // ---- biome-aware wildlife ----
    // Keep separate local quotas: a handful of land animals must not consume
    // all the slots before birds and insects have arrived nearby.
    const nearby = this.mobSys.mobs.filter((m) =>
      m.alive && !m.def.hostile && !m.hidden && Math.hypot(m.x - this.pos.x, m.z - this.pos.z) < 36,
    );
    const landCount = nearby.filter((m) => !m.def.aquatic && !['bird', 'bee', 'crab', 'turtle', 'penguin'].includes(m.id)).length;
    const birds = nearby.filter((m) => m.id === 'bird').length;
    const bees = nearby.filter((m) => m.id === 'bee').length;
    const budget = this.survival ? 24 : 30;
    this.animalTimer -= dt;
    if (this.animalTimer <= 0) {
      this.animalTimer = (this.survival ? 2.8 : 2.1) * (moving ? 0.6 : 1);
      if (landCount < (this.survival ? 6 : 8) && this.mobSys.count(false) < budget) {
        const water = this.world.findWaterNear(this.pos.x, this.pos.z, 26);
        const shoreCount = nearby.filter((m) => ['crab', 'turtle', 'penguin', 'seal'].includes(m.id)).length;
        if (water && shoreCount < 3 && Math.random() < 0.35) {
          const winterShore = this.world.isWinter(Math.floor(water[0]), Math.floor(water[2]));
          const p = this.mobSys.findSpawnPoint(water[0], water[2], 1, 6, null,
            winterShore ? [ICE, SNOW_GRASS] : [SAND, GRASS]);
          if (p && Math.hypot(p[0] - water[0], p[2] - water[2]) < 6) {
            const id: MobId = winterShore ? (Math.random() < 0.55 ? 'penguin' : 'seal') :
              (Math.random() < 0.55 ? 'crab' : 'turtle');
            this.mobSys.spawn(id, p[0], p[1], p[2]);
          }
        } else {
          const p = moving
            ? this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 10, 25, biasAngle, [GRASS, SAND, STONE, VOLCANIC_STONE, SNOW_GRASS])
            : this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 9, 28, null, [GRASS, SAND, STONE, VOLCANIC_STONE, SNOW_GRASS]);
          if (p) {
            const biome = this.world.biomeAt(Math.floor(p[0]), Math.floor(p[2]));
            const high = this.world.getHeight(Math.floor(p[0]), Math.floor(p[2])) > 26;
            // Pasture species belong on green ground only. Arctic wildlife
            // lives around ice; camels and lizards inhabit the dry regions.
            const ground = this.world.get(Math.floor(p[0]), Math.floor(p[1] - 1), Math.floor(p[2]));
            const pasture = ground === GRASS;
            const list: MobId[] = biome === 'winter'
              ? ['rabbit', 'deer', 'roe_deer', 'moose', 'hedgehog']
              : biome === 'desert' || biome === 'canyon'
                ? ['lizard', 'lizard', 'camel', 'tumbleweed', 'tumbleweed', 'tumbleweed']
                : biome === 'jungle'
                  ? ['monkey', 'monkey', 'monkey', 'lizard', 'pig', 'rabbit', 'hedgehog']
                  : biome === 'volcanic'
                    ? ['lizard', 'lizard', 'rabbit']
                    : high ? (pasture ? ['sheep', 'sheep', 'rabbit'] : ['rabbit'])
                      : pasture ? ['pig', 'sheep', 'cow', 'chicken', 'rabbit', 'cat', 'deer', 'roe_deer', 'hedgehog'] : ['rabbit'];
            const spawnedId = list[Math.floor(Math.random() * list.length)];
            const spawned = this.mobSys.spawn(spawnedId, p[0], p[1], p[2]);
            if (spawnedId === 'cow' && Math.random() < 0.55 && spawned) {
              const a = Math.random() * Math.PI * 2;
              const calf = this.mobSys.spawn('calf', p[0] + Math.cos(a) * 1.6, p[1], p[2] + Math.sin(a) * 1.6);
              if (calf) {
                calf.grow = 60;
                calf.group.scale.setScalar(calf.def.scale * 0.65);
              }
            }
          }
        }
      }
    }

    // A separate, faster trickle of birds and bees keeps the sky alive even
    // when the ground-animal quota is already full.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = (this.survival ? 1.5 : 1.2) * (moving ? 0.7 : 1);
      const beeTarget = this.daylight < 0.35 || this.world.isWinter(Math.floor(this.pos.x), Math.floor(this.pos.z)) ? 0 : 4;
      if (this.mobSys.count(false) < budget && (birds < 4 || bees < beeTarget)) {
        const id: MobId = birds < 4 && (bees >= beeTarget || birds / 4 <= bees / beeTarget) ? 'bird' : 'bee';
        if (id === 'bee') {
          const flower = this.world.findFlowerNear(this.pos.x, this.pos.z, 24);
          if (flower && this.world.biomeAt(Math.floor(flower[0]), Math.floor(flower[2])) !== 'winter')
            this.mobSys.spawn('bee', flower[0], flower[1] + 0.3, flower[2]);
        } else {
          const p = this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 8, 26, biasAngle,
            [GRASS, SAND, STONE, SNOW_GRASS, VOLCANIC_STONE]);
          if (p) this.mobSys.spawn('bird', p[0], p[1], p[2]);
        }
      }
    }

    // ---- recycle wildlife left far behind (frees the cap for new land) ----
    if ((this.frameNo & 63) === 0) {
      for (let i = this.mobSys.mobs.length - 1; i >= 0; i--) {
        const m = this.mobSys.mobs[i];
        if (!m.alive || m.def.hostile || m.id === 'trader') continue;
        const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
        if (d > 48) this.mobSys.remove(m); // free old slots for birds and insects nearby
      }
    }

    // ---- wandering traders cross your path out in the wild ----
    this.wanderTraderTimer -= dt;
    if (this.wanderTraderTimer <= 0) {
      this.wanderTraderTimer = 45 + Math.random() * 50;
      const traders = this.mobSys.mobs.filter((m) => m.alive && m.id === 'trader');
      // keep at most 2 alive; drop ones left far behind
      for (const tr of traders) {
        if (Math.hypot(tr.x - this.pos.x, tr.z - this.pos.z) > 90) this.mobSys.remove(tr);
      }
      if (traders.length < 2) {
        const p = this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 20, 38, biasAngle);
        // never in water — solid dry ground only
        if (p && this.world.get(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])) !== WATER) {
          this.mobSys.spawn('trader', p[0], p[1], p[2]);
        }
      }
    }

    this.mobSys.update(
      dt,
      this.pos.x,
      this.pos.y,
      this.pos.z,
      this.daylight,
      (m, dmg) => this.mobHit(m, dmg),
      (m) => this.mobDied(m, true),
      (m) => this.mobShoot(m),
      (x, y, z) => { this.markDirtyAt(x, z); this.enqueueSupportCheck(x, y, z); },
      (x, y, z, food) => {
        const tint = BLOCKS[food]?.tint ?? [220, 180, 100];
        const particles = tint[0] > tint[1] * 1.25 && tint[0] > tint[2] * 1.25 ? [245, 190, 80] : tint;
        this.burst(x, y, z, particles, 2, 0.35, 0.25);
      },
    );
  }

  /** dark-cave spawn: air pocket with a solid floor, below the surface, near the player */
  private findCaveSpawn(): [number, number, number] | null {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 16;
      const x = Math.floor(this.pos.x + Math.cos(a) * r);
      const z = Math.floor(this.pos.z + Math.sin(a) * r);
      if (!this.world.hasColumn(x, z)) continue;
      const surf = this.world.getHeight(x, z);
      // probe a few depths around the player's own level
      const y0 = Math.max(2, Math.floor(this.pos.y) - 6 + Math.floor(Math.random() * 10));
      for (let y = y0; y < Math.min(surf - 3, y0 + 6); y++) {
        if (
          isSolid(this.world.get(x, y - 1, z)) &&
          this.world.get(x, y, z) === AIR &&
          this.world.get(x, y + 1, z) === AIR
        ) {
          return [x + 0.5, y, z + 0.5];
        }
      }
    }
    return null;
  }

  private mobHit(m: Mob, dmg: number) {
    if (this.phase !== 'playing') return;
    const red = damageReduction(this.stats.armor);
    let taken = dmg * (1 - red);
    if (m.def.explodes) {
      this.addShake(1.1);
      this.flash = 0.9;
      this.burst(m.x, m.y + 0.6, m.z, [90, 90, 90], 34, 6);
      this.burst(m.x, m.y + 0.6, m.z, [255, 170, 60], 18, 5);
      const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
      taken *= Math.max(0.2, 1 - d / 3.4);
      // a wall between you and the blast soaks most of it
      if (!this.mobSys.lineOfSight(m, this.pos.x, this.pos.y + 1.2, this.pos.z)) taken *= 0.15;
    } else {
      this.addShake(0.3);
      this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [220, 60, 50], 6, 2);
    }
    // thorns reflect
    if (this.stats.thorns > 0 && m.alive) {
      const back = (dmg * this.stats.thorns) / 100;
      m.hp -= back;
      m.hurtFlash = 0.16;
      if (m.hp <= 0) this.mobDied(m, false);
    }
    this.killedBy = t(m.def.nameKey);
    this.damage(taken, 'mob');
  }

  /** player swings at whatever the crosshair is on */
  private tryAttack() {
    if (this.attackCd > 0) return false;
    const reach = this.heldKind() === 'sword' ? 4.2 : 3.4;
    const m = this.mobSys.raycast(this.eyeV.x, this.eyeV.y, this.eyeV.z, this.dirV.x, this.dirV.y, this.dirV.z, reach);
    if (!m) return false;
    if (m.id === 'trader') return true; // he's a merchant, not target practice

    const swift = 1 - Math.min(0.4, this.stats.swift / 100);
    this.attackCd = (this.heldKind() === 'sword' ? 0.42 : 0.56) * swift;
    this.startSwing(0.6);

    let dmg = this.attackDamage();
    const crit = Math.random() < 0.18;
    if (crit) dmg *= 1.8;
    m.hp -= dmg;
    m.hurtFlash = 0.18;
    // knockback
    const kx = m.x - this.pos.x;
    const kz = m.z - this.pos.z;
    const kd = Math.hypot(kx, kz) || 1;
    m.vx += (kx / kd) * 7;
    m.vz += (kz / kd) * 7;
    if (m.onGround) m.vy = 4.2;

    // --- affixes ---
    if (this.stats.fire > 0) {
      m.burn = Math.max(m.burn, 3.5);
      this.burst(m.x, m.y + 0.9, m.z, [255, 150, 40], 8, 3);
    }
    if (this.stats.frost > 0) m.slow = 2.5;
    if (this.stats.vamp > 0) {
      this.health = Math.min(100, this.health + this.stats.vamp);
      this.popup(this.pos.x, this.pos.y + 1.6, this.pos.z, `+${this.stats.vamp.toFixed(0)}`, '#ff5f7a');
    }

    // Friendly, model-matched hit puffs; scale both count and spread to the animal.
    // Red coats use soft cream particles so hits never resemble blood.
    if (!m.def.hostile) {
      const hex = m.def.body.replace('#', '');
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const color = rgb[0] > rgb[1] * 1.35 && rgb[0] > rgb[2] * 1.2 ? [238, 224, 190] : rgb;
      const size = Math.max(0.3, Math.min(1.35, m.def.scale));
      this.burst(m.x, m.y + 0.65 * size, m.z, color, Math.max(2, Math.round((crit ? 9 : 5) * size)), (crit ? 2.3 : 1.5) * size);
    } else {
      this.burst(m.x, m.y + 0.9, m.z, [230, 60, 50], crit ? 14 : 7, crit ? 4 : 2.6);
    }
    this.popup(m.x, m.y + 1.5, m.z, `${Math.round(dmg)}`, crit ? '#ffd24a' : '#ffffff', crit);
    this.addShake(crit ? 0.32 : 0.16);
    sfx.breakBlock(1.4);

    if (m.hp <= 0) this.mobDied(m, false);
    return true;
  }

  attackDamage() {
    const heldSword = this.heldSwordTier();
    const base = heldSword >= 0 ? SWORDS[heldSword].damage : 3 + this.heldPickTier() * 2.5;
    const held = this.heldKind();
    const mul = held === 'sword' ? 1 : held === 'pick' ? 0.55 : 0.3;
    return (base * mul + this.stats.damage) * (1 + this.stats.swift / 220);
  }

  // ================= ARROWS =================
  private arrows: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    mesh: THREE.Mesh;
    /** true = shot by a skeleton archer, hurts the player */
    hostile?: boolean;
  }> = [];
  private arrowGeo: THREE.BoxGeometry | null = null;
  private arrowMat = new THREE.MeshBasicMaterial({ color: 0xd9cba8 });

  /** skeleton archer fires an arrow at the player */
  private mobShoot(m: Mob) {
    if (!this.arrowGeo) this.arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.52);
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    const ox = m.x;
    const oy = m.y + 1.4;
    const oz = m.z;
    let dx = this.pos.x - ox;
    let dy = this.pos.y + 1.1 - oy;
    let dz = this.pos.z - oz;
    const len = Math.hypot(dx, dy, dz) || 1;
    // slight inaccuracy so it's dodgeable
    dx = dx / len + (Math.random() - 0.5) * 0.08;
    dy = dy / len + (Math.random() - 0.5) * 0.06 + 0.03;
    dz = dz / len + (Math.random() - 0.5) * 0.08;
    const sp = 22;
    const a = { x: ox + dx, y: oy, z: oz + dz, vx: dx * sp, vy: dy * sp, vz: dz * sp, life: 2.2, mesh, hostile: true };
    mesh.position.set(a.x, a.y, a.z);
    this.scene.add(mesh);
    this.arrows.push(a as (typeof this.arrows)[number]);
    sfx.swing(3);
  }

  private tryShoot() {
    if (this.attackCd > 0) return;
    if ((this.inventory.get(ARROW_ITEM) ?? 0) <= 0) {
      this.attackCd = 0.4;
      sfx.ui(false);
      return;
    }
    this.inventory.set(ARROW_ITEM, (this.inventory.get(ARROW_ITEM) ?? 0) - 1);
    const swift = 1 - Math.min(0.4, this.stats.swift / 100);
    this.attackCd = 0.55 * swift;
    this.startSwing(0.4);
    sfx.swing(4);
    if (!this.arrowGeo) this.arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.52);
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    const sp = 34;
    const a = {
      x: this.eyeV.x + this.dirV.x * 0.6,
      y: this.eyeV.y - 0.12 + this.dirV.y * 0.6,
      z: this.eyeV.z + this.dirV.z * 0.6,
      vx: this.dirV.x * sp,
      vy: this.dirV.y * sp + 0.6,
      vz: this.dirV.z * sp,
      life: 2.4,
      mesh,
    };
    mesh.position.set(a.x, a.y, a.z);
    this.scene.add(mesh);
    this.arrows.push(a);
    this.syncHotbar(true);
  }

  private updateArrows(dt: number) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vy -= 13 * dt;
      const steps = 2; // sub-steps prevent tunnelling at 34 m/s
      let dead = a.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        a.x += (a.vx * dt) / steps;
        a.y += (a.vy * dt) / steps;
        a.z += (a.vz * dt) / steps;
        // hostile arrows hunt the player instead of mobs
        if (a.hostile) {
          const pd = Math.hypot(a.x - this.pos.x, a.y - (this.pos.y + 1), a.z - this.pos.z);
          if (pd < 0.85) {
            const red = damageReduction(this.stats.armor);
            this.killedBy = t('mob_archer');
            this.damage(7 * (1 - red), 'mob');
            this.burst(a.x, a.y, a.z, [220, 60, 50], 6, 2);
            dead = true;
            break;
          }
          if (isSolid(this.world.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) {
            this.burst(a.x, a.y, a.z, [200, 190, 160], 3, 1.2);
            if (Math.random() < 0.8) {
              this.spawnDrop(
                a.x - (a.vx / 22) * 0.35,
                a.y - (a.vy / 22) * 0.35 + 0.15,
                a.z - (a.vz / 22) * 0.35,
                ARROW_ITEM,
              );
            }
            dead = true;
            break;
          }
          continue;
        }
        // hit a mob?
        const hit = this.mobSys.inRadius(a.x, a.y, a.z, 0.75).filter((m) => m.id !== 'trader')[0];
        if (hit) {
          const dmg = (14 + this.stats.damage * 0.6) * (Math.random() < 0.2 ? 1.7 : 1);
          hit.hp -= dmg;
          hit.hurtFlash = 0.18;
          hit.vx += a.vx * 0.06;
          hit.vz += a.vz * 0.06;
          // the arrow lodges in the target — it drops back out on death
          hit.stuckArrows++;
          if (this.stats.fire > 0) hit.burn = Math.max(hit.burn, 3);
          if (this.stats.frost > 0) hit.slow = 2;
          this.popup(hit.x, hit.y + 1.5, hit.z, `${Math.round(dmg)}`, '#93c95d');
          this.burst(a.x, a.y, a.z, [220, 220, 200], 5, 2);
          sfx.crack(2);
          if (hit.hp <= 0) this.mobDied(hit, false);
          dead = true;
          break;
        }
        if (isSolid(this.world.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) {
          // stick into the ground as a retrievable pickup (arrows survive ~80% of landings)
          this.burst(a.x, a.y, a.z, [200, 190, 160], 3, 1.4);
          if (Math.random() < 0.8) {
            // back out of the wall a touch so the drop doesn't spawn inside the block
            this.spawnDrop(a.x - (a.vx / 34) * 0.35, a.y - (a.vy / 34) * 0.35 + 0.15, a.z - (a.vz / 34) * 0.35, ARROW_ITEM);
          }
          dead = true;
          break;
        }
      }
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
      if (dead) {
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  private clearArrows() {
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows.length = 0;
  }

  private mobDied(m: Mob, burned: boolean) {
    if (!m.alive) return;
    // Tumbleweeds are rolling plants, not animals: one hit breaks them cleanly,
    // with no meat, kill count, score, or animal-drop logic.
    if (m.id === 'tumbleweed') {
      this.burst(m.x, m.y + 0.25, m.z, [214, 180, 114], 6, 0.75, 0.42);
      this.mobSys.remove(m);
      return;
    }
    this.kills++;
    const def = m.def;
    // animals & birds drop meat — cooked straight away if they burned
    if (!def.hostile && def.id !== 'jellyfish') {
      const meat = burned ? COOKED_MEAT : RAW_MEAT;
      const small =
        def.id === 'chicken' ||
        def.id === 'rabbit' ||
        def.id === 'fish' ||
        def.id === 'bird' ||
        def.id === 'calf' ||
        def.id === 'lizard' ||
        def.id === 'monkey';
      const n = small ? 1 : 2;
      for (let i = 0; i < n; i++) this.spawnDrop(m.x, m.y + 0.6, m.z, meat);
      // species loot (Minecraft-style, percentage rolls)
      const dropAt = (id: number, chance: number, count = 1) => {
        if (Math.random() < chance) for (let i = 0; i < count; i++) this.spawnDrop(m.x, m.y + 0.5, m.z, id);
      };
      switch (def.id) {
        case 'sheep':
          dropAt(WOOL, 0.9, 1 + (Math.random() < 0.5 ? 1 : 0));
          break;
        case 'chicken':
        case 'bird':
          dropAt(FEATHER, 0.7, 1 + (Math.random() < 0.4 ? 1 : 0));
          break;
        case 'turtle':
          dropAt(TURTLE_SHELL, 0.4);
          break;
        case 'crab':
          dropAt(CRAB_SHELL, 0.55);
          break;
        case 'fish':
          dropAt(FISH_SCALE, 0.75, 1 + (Math.random() < 0.5 ? 1 : 0));
          break;
        case 'cat':
          dropAt(CAT_CLAW, 0.55);
          break;
        case 'penguin':
          dropAt(FEATHER, 0.6, 2);
          break;
      }
    }
    // monster-specific ingredients stay right where the mob fell
    if (def.hostile) {
      const ing =
        def.id === 'spider' ? WEB : def.id === 'skeleton' ? BONE : def.id === 'zombie' ? FLESH : GUNPOWDER;
      const n = 1 + (Math.random() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) this.spawnDrop(m.x, m.y + 0.5, m.z, ing);
      if (def.id === 'skeleton' && Math.random() < 0.5) {
        for (let i = 0; i < 3; i++) this.spawnDrop(m.x, m.y + 0.5, m.z, ARROW_ITEM);
      }
    }
    // every arrow you shot into it clatters back out — walk over and re-collect
    for (let i = 0; i < m.stuckArrows; i++) this.spawnDrop(m.x, m.y + 0.6, m.z, ARROW_ITEM);
    m.stuckArrows = 0;
    const gained = Math.round(def.score * this.comboMult() * (1 + this.stats.greed / 100));
    this.score += gained;
    this.combo++;
    this.comboTimer = 3;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const nearby = Math.hypot(m.x - this.pos.x, m.y - this.pos.y, m.z - this.pos.z);
    if (nearby < 22) this.popup(m.x, m.y + 1.4, m.z, `+${gained}`, def.hostile ? '#ff9f5a' : '#93c95d', def.hostile);
    this.burst(m.x, m.y + 0.8, m.z, burned ? [255, 140, 40] : [200, 60, 60], 18, 3.6);
    if (nearby < 16) sfx.breakBlock(def.hostile ? 0.7 : 1.2);
    if (nearby < 12) this.addShake(0.24);

    // loot: gear drops as a physical bag AT the death spot — walk over to grab it
    if (def.hostile) {
      const it = rollLoot(def.level, (Math.random() * 1e9) | 0);
      if (it) this.spawnDrop(m.x, m.y + 0.7, m.z, LOOT_BAG, it);
    }
    this.mobSys.remove(m);
    this.syncHud(true);
  }

  // ================= EQUIPMENT =================
  equip(uid: string) {
    const i = this.bagItems.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const it = this.bagItems[i];
    const prev = this.equipped[it.slot];
    this.equipped[it.slot] = it;
    this.bagItems.splice(i, 1);
    if (prev) this.bagItems.push(prev);
    this.stats = computeStats(this.equipped);
    sfx.ui(true);
    this.syncHud(true);
  }

  unequip(slot: Slot) {
    const it = this.equipped[slot];
    if (!it) return;
    delete this.equipped[slot];
    this.bagItems.push(it);
    this.stats = computeStats(this.equipped);
    sfx.ui(false);
    this.syncHud(true);
  }

  // ================= HELD ITEM =================
  /** tier of the pick currently in hand (0 if none) */
  heldPickTier(): number {
    const id = this.hotbar[this.selected] ?? -1;
    return isPickTool(id) ? id - PICK_TOOLS[0] : 0;
  }
  heldSwordTier(): number {
    const id = this.hotbar[this.selected] ?? -1;
    return isSwordTool(id) ? id - SWORD_TOOLS[0] : -1;
  }
  heldAxeTier(): number {
    const id = this.hotbar[this.selected] ?? -1;
    if (id === TOOL_AXE) return 1;
    return isAxeTool(id) ? id - AXE_TOOLS[0] : 0;
  }

  heldKind(): HudState['heldKind'] {
    const id = this.hotbar[this.selected];
    if (id === HAND || id === undefined) return 'fist';
    if (isGearHotbarId(id)) return 'gear';
    if (id === TOOL_PICK || isPickTool(id)) return 'pick';
    if (isSwordTool(id)) return 'sword';
    if (id === TOOL_TORCH) return 'torch';
    if (id === TOOL_AXE || isAxeTool(id)) return 'axe';
    if (id === TOOL_SHOVEL) return 'shovel';
    if (id === TOOL_BOW) return 'bow';
    return 'block';
  }

  heldName(): string {
    const k = this.heldKind();
    if (k === 'gear') {
      const id = this.hotbar[this.selected] ?? -1;
      const g = this.bagItems.find((b) => b.hid === id);
      if (g) return `${t(SLOT_KEY[g.slot])} · ${matName(MATERIALS[g.material].label)}`;
      return t('gear');
    }
    if (k === 'pick') return pickaxeLabel(this.heldPickTier());
    if (k === 'sword') return swordLabel(Math.max(0, this.heldSwordTier()));
    if (k === 'torch') return t('handTorch');
    if (k === 'axe') return this.heldAxeTier() === 0 ? t('axeWood') : t('axeStone');
    if (k === 'shovel') return t('tool_shovel');
    if (k === 'bow') return `${t('tool_bow')} · ${this.inventory.get(ARROW_ITEM) ?? 0}`;
    if (k === 'fist') return t('emptyHand'); // bare hand (slot 1 or empty)
    const id = this.hotbar[this.selected] ?? -1;
    return blockName(id, BLOCKS[id]?.name ?? '');
  }

  /** how effective the held tool is against a given block */
  private toolMultiplier(blockId: number): number {
    const cls = blockClass(blockId);
    switch (this.heldKind()) {
      case 'pick':
        return cls === 'stone' ? 1.35 : cls === 'earth' ? 0.7 : cls === 'wood' ? 0.6 : 0.8;
      case 'axe': {
        const axeTier = this.heldAxeTier();
        const axeSpeed = axeTier === 0 ? 2.0 : 2.8;
        return cls === 'wood' ? axeSpeed : cls === 'earth' ? 0.6 : 0.35;
      }
      case 'shovel':
        return cls === 'earth' ? 2.6 : cls === 'wood' ? 0.5 : 0.3;
      case 'sword':
        return 0.25;
      case 'bow':
        return 0.2;
      case 'fist':
        // bare hands: noticeably worse than even a wooden pick
        return cls === 'wood' || cls === 'earth' ? 0.45 : 0.3;
      default:
        return 0.5;
    }
  }

  // ================= TRADER =================
  offers: TradeOffer[] = [];
  private static SELL_PRICES: Array<[number, number]> = [
    [COAL, 40],
    [IRON, 100],
    [REDSTONE, 140],
    [GOLD, 220],
    [LAPIS, 170],
    [DIAMOND, 550],
    [EMERALD, 650],
    [QUARTZ, 130],
    [COAL_BLOCK, 160],
    [IRON_BLOCK, 400],
    [REDSTONE_BLOCK, 560],
    [GOLD_BLOCK, 880],
    [LAPIS_BLOCK, 680],
    [DIAMOND_BLOCK, 2200],
    [EMERALD_BLOCK, 2600],
    [QUARTZ_BLOCK, 520],
    [LOG, 12],
    [RAW_MEAT, 18],
    [COOKED_MEAT, 45],
    [WEB, 35],
    [BONE, 30],
    [FLESH, 15],
    [GUNPOWDER, 60],
    [ARROW_ITEM, 4],
    [FLOWER_RED, 8],
    [FLOWER_YELLOW, 8],
    [FLOWER_BLUE, 8],
    [HONEY, 25],
    [NETHERITE, 800],
    [APPLE, 12],
    [COCONUT, 15],
    [BANANA, 12],
    [VOLCANIC_STONE, 7],
    [BIRCH_LOG, 12],
    [CACTUS, 8],
    [CACTUS_PALE, 8],
    [WOOL, 10],
    [FEATHER, 6],
    [TURTLE_SHELL, 45],
    [CRAB_SHELL, 32],
    [FISH_SCALE, 8],
    [CAT_CLAW, 40],
    [COBBLE, 4],
    [STONE, 5],
    [SAND, 3],
    [DIRT, 2],
    [LEAVES, 2],
    [PLANKS, 6],
  ];

  sellPrice(id: number): number {
    const e = Engine.SELL_PRICES.find(([bid]) => bid === id);
    return e ? e[1] : Math.max(1, Math.round((BLOCKS[id]?.score ?? 1) * 0.8));
  }

  /** sell a tool straight out of the hotbar */
  sellTool(id: number) {
    if (id < 200) return;
    const count = this.inventory.get(id) ?? 0;
    if (count <= 0) return; // nothing owned — never sell an air slot
    // clear the quick-bar placement (if any) and drop one from the owned count
    const i = this.hotbar.indexOf(id);
    if (i >= 0) this.hotbar[i] = undefined;
    this.inventory.set(id, count - 1);
    if (count - 1 <= 0) this.inventory.delete(id);
    if (this.selected === i) this.selected = 0;
    const gained = toolSellPrice(id);
    this.score += gained;
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+${gained}`, '#f7d34b');
    sfx.pickup(5);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /** sell a piece of gear (from the bag) to the trader */
  sellGear(uid: string) {
    const i = this.bagItems.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const it = this.bagItems[i];
    this.bagItems.splice(i, 1);
    const matMul = { leather: 30, iron: 80, gold: 140, diamond: 320, netherite: 900 }[it.material];
    const gained = Math.round(matMul * (1 + it.rarity * 0.6) + it.affixes.length * 40);
    this.score += gained;
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+${gained}`, '#f7d34b');
    sfx.pickup(6);
    this.syncHud(true);
  }

  /** dismantle unwanted gear at the workbench back into raw materials */
  salvageGear(uid: string): boolean {
    if (!this.workbenchNear() && this.invTab !== 'workbench') {
      sfx.ui(false);
      return false;
    }
    const i = this.bagItems.findIndex((x) => x.uid === uid);
    let it: Item | undefined;
    if (i >= 0) {
      it = this.bagItems[i];
      this.bagItems.splice(i, 1);
    } else {
      // Allow dismantling even if dragged directly from an equipped slot
      for (const s of Object.keys(this.equipped) as Slot[]) {
        if (this.equipped[s]?.uid === uid) {
          it = this.equipped[s];
          delete this.equipped[s];
          this.stats = computeStats(this.equipped);
          break;
        }
      }
    }
    if (!it) return false;

    const outputs = getSalvageForGear(it);
    const parts: string[] = [];
    for (const [id, count] of outputs) {
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
      this.addToHotbar(id);
      parts.push(`+${count} ${blockName(id, BLOCKS[id]?.name ?? '')}`);
    }

    sfx.breakBlock(0.8);
    this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [220, 220, 230], 12, 2.5);
    this.pushBanner(t('salvaged'), parts.join(', '), '#93c95d');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** dismantle any craftable item/tool/weapon/block at the workbench back into reduced crafting ingredients */
  salvageItem(id: number): boolean {
    if (!this.workbenchNear() && this.invTab !== 'workbench') {
      sfx.ui(false);
      return false;
    }
    if (isGearHotbarId(id)) {
      const g = this.bagItems.find((b) => b.hid === id);
      return g ? this.salvageGear(g.uid) : false;
    }
    const info = getSalvageForItemId(id);
    if (!info) {
      sfx.ui(false);
      return false;
    }
    const owned = this.inventory.get(id) ?? 0;
    if (owned <= 0) {
      sfx.ui(false);
      return false;
    }
    const consume = Math.min(owned, Math.max(1, info.inputsUsed));
    const remaining = owned - consume;
    if (remaining <= 0) {
      this.inventory.delete(id);
      const hbIdx = this.hotbar.indexOf(id);
      if (hbIdx >= 0) this.hotbar[hbIdx] = undefined;
    } else {
      this.inventory.set(id, remaining);
    }
    if (id >= 200) {
      this.recalcOwnedToolTiers();
    }

    const parts: string[] = [];
    for (const [outId, outCount] of info.outputs) {
      this.inventory.set(outId, (this.inventory.get(outId) ?? 0) + outCount);
      this.addToHotbar(outId);
      parts.push(`+${outCount} ${blockName(outId, BLOCKS[outId]?.name ?? '')}`);
    }

    sfx.breakBlock(0.8);
    this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [220, 220, 230], 12, 2.5);
    this.pushBanner(t('salvaged'), parts.join(', '), '#93c95d');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** sell the entire stack of a resource to the trader for score */
  sellResource(id: number) {
    const count = this.inventory.get(id) ?? 0;
    if (count <= 0) {
      sfx.ui(false);
      return;
    }
    const gained = this.sellPrice(id) * count;
    this.inventory.set(id, 0);
    this.score += gained;
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+${gained}`, '#f7d34b', gained > 400);
    sfx.pickup(6);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  buyOffer(index: number) {
    const offer = this.offers[index];
    if (!offer || offer.sold) return;
    for (const [id, n] of offer.cost) {
      if ((this.inventory.get(id) ?? 0) < n) {
        sfx.ui(false);
        return;
      }
    }
    for (const [id, n] of offer.cost) this.inventory.set(id, (this.inventory.get(id) ?? 0) - n);
    offer.sold = true;
    this.bagItems.push(offer.item);
    sfx.upgrade();
    this.pushBanner(t('looted'), `${t(('slot_' + offer.item.slot) as never)}`, RARITY_COLORS[offer.item.rarity]);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private rollTraderOffers() {
    const rand = mulberry32((Math.random() * 1e9) | 0);
    const slots: Slot[] = ['hands', 'chest', 'offhand', 'head', 'legs', 'feet'];
    this.offers = [];
    for (let i = 0; i < 3; i++) {
      const rarity = (rand() < 0.55 ? 2 : 3) as 2 | 3;
      const material = rand() < 0.4 ? 'gold' : rand() < 0.75 ? 'iron' : 'diamond';
      const item = makeItem(slots[Math.floor(rand() * slots.length)], material, rarity, rand);
      const cost: Array<[number, number]> =
        rarity === 3
          ? [
              [DIAMOND, 2 + Math.floor(rand() * 2)],
              [GOLD, 2],
            ]
          : [
              [GOLD, 2 + Math.floor(rand() * 3)],
              [IRON, 3],
            ];
      this.offers.push({ item, cost, sold: false });
    }
  }

  /** true when a placed campfire burns within 4 blocks of the player */
  campfireNear(): boolean {
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y);
    const pz = Math.floor(this.pos.z);
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++)
          if (this.world.get(px + dx, py + dy, pz + dz) === CAMPFIRE) return true;
    return false;
  }

  // ================= INVENTORY & CRAFTING =================
  inventoryOpen = false;
  invTab: string = 'all';
  private lastCraft: string | null = null;
  private prevHint: string | null = null;

  private craftSignature() {
    let s = '';
    for (const r of RECIPES) s += this.canCraft(r) ? '1' : '0';
    return s;
  }

  inventoryList() {
    const out: { id: number; count: number }[] = [];
    this.inventory.forEach((count, id) => {
      if (count > 0) out.push({ id, count });
    });
    out.sort((a, b) => b.count - a.count || a.id - b.id);
    return out;
  }

  canCraft(r: Recipe) {
    // Any tool or item can be crafted at any time if you have the ingredients —
    // no prerequisite tier, no previous-recipe unlock, no duplicate limit.
    if (r.kind === 'cook' && !this.campfireNear()) return false;
    return r.inputs.every(([id, n]) => (this.inventory.get(id) ?? 0) >= n);
  }

  craftHintKey(): string | null {
    const pick = RECIPES.find((r) => r.kind === 'pickaxe' && this.canCraft(r));
    if (pick) return pick.key;
    const any = RECIPES.find((r) => this.canCraft(r));
    return any ? any.key : null;
  }

  craftHint(): string | null {
    const key = this.craftHintKey();
    const r = key ? RECIPES.find((rr) => rr.key === key) : undefined;
    if (!r) return null;
    return recipeText(r.key, r.name, r.desc)[0];
  }

  craft(key: string): boolean {
    const r = RECIPES.find((rr) => rr.key === key);
    if (!r || !this.canCraft(r)) {
      sfx.ui(false);
      return false;
    }
    for (const [id, n] of r.inputs) this.inventory.set(id, (this.inventory.get(id) ?? 0) - n);
    this.lastCraft = r.key;
    const [rName, rDesc] = recipeText(r.key, r.name, r.desc);

    if (r.out) {
      const [id, n] = r.out;
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + n);
      this.addToHotbar(id);
    }
    if (r.kind === 'axe') {
      // crafted tools land in the inventory list — the player drags them into a quick slot
      const tool = r.tier === 0 ? AXE_TOOLS[0] : AXE_TOOLS[1];
      this.inventory.set(tool, (this.inventory.get(tool) ?? 0) + 1);
      sfx.upgrade();
      this.pushBanner(rName, rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [255, 235, 160], 12, 3);
    } else if (r.kind === 'shovel' || r.kind === 'bow') {
      const tool = r.kind === 'shovel' ? TOOL_SHOVEL : TOOL_BOW;
      this.inventory.set(tool, (this.inventory.get(tool) ?? 0) + 1);
      sfx.upgrade();
      this.pushBanner(rName, rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [255, 235, 160], 12, 3);
    } else if (r.kind === 'torch') {
      this.inventory.set(TOOL_TORCH, (this.inventory.get(TOOL_TORCH) ?? 0) + 1);
      sfx.upgrade();
      this.pushBanner(t('handTorch'), rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [255, 176, 58], 12, 3);
    } else if (r.kind === 'food') {
      this.health = Math.min(100, this.health + (r.heal ?? 0));
      sfx.pickup(4);
      this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${r.heal} ${t('hp')}`, '#93c95d', true);
    } else if (r.kind === 'gear' && r.slot && r.material) {
      const it = makeItem(r.slot, r.material, 1, Math.random, true);
      // Minecraft-flavoured specials
      if (r.key === 'turtle_helmet') it.armor += 3; // scute plating
      if (r.key === 'claw_gloves') it.affixes.push({ id: 'swift', value: 12 });
      if (r.key === 'crab_shield') it.armor += 2;
      this.bagItems.push(it);
      sfx.upgrade();
      this.pushBanner(rName, `+${it.armor} ${t('armorTotal')}`, r.accent);
    } else if (r.kind === 'weapon' && r.weapon !== undefined) {
      this.swordTier = Math.max(this.swordTier, r.weapon);
      // the new sword is a real inventory item like everything else — count accumulates,
      // the player drags it into a quick slot themselves
      const toolId = SWORD_TOOLS[r.weapon];
      this.inventory.set(toolId, (this.inventory.get(toolId) ?? 0) + 1);
      sfx.upgrade();
      this.addShake(0.4);
      this.pushBanner(rName, rDesc, r.accent);
    } else if (r.kind === 'pickaxe' && r.tier !== undefined) {
      this.tier = Math.max(this.tier, r.tier);
      // the pickaxe is a real inventory item — count accumulates, the player
      // drags it into a quick slot themselves
      const toolId = PICK_TOOLS[r.tier];
      this.inventory.set(toolId, (this.inventory.get(toolId) ?? 0) + 1);
      this.updatePickaxe();
      this.flash = 0.5;
      this.addShake(0.55);
      this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [255, 235, 160], 34, 5.5);
      sfx.upgrade();
      this.pushBanner(pickaxeLabel(r.tier), rDesc, PICKAXE_TIERS[r.tier].color);
    } else if (r.kind === 'time') {
      this.timeLeft = Math.min(this.runTime + 60, this.timeLeft + (r.seconds ?? 0));
      sfx.upgrade();
      this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${r.seconds}${t('secShort')}`, '#7ee7a0', true);
      this.pushBanner(t('overdrive'), `+${r.seconds}${t('secShort')} ${t('secondsOnClock')}`, '#7ee7a0');
    } else if (r.kind === 'heal') {
      this.health = Math.min(100, this.health + (r.heal ?? 0));
      sfx.upgrade();
      this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${r.heal} ${t('hp')}`, '#e2564a', true);
      this.pushBanner(t('patchedUp'), `+${r.heal} ${t('health')}`, '#e2564a');
    } else {
      sfx.place();
      this.pushBanner(rName, rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.1, this.pos.z, [255, 240, 190], 14, 3);
    }
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /**
   * Click-to-assign: put an owned inventory item into a hotbar slot
   * (or the first free slot when `slot` is omitted). Delegates to placeInSlot.
   */
  assignToHotbar(id: number, slot?: number) {
    this.placeInSlot(id, slot);
  }

  openInventory() {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    if (!this.traderNear() && this.invTab === 'trade') this.invTab = 'tools';
    this.inventoryOpen = true;
    this.phase = 'paused';
    this.pausedBySystem = false;
    this.mining = false;
    this.placing = false;
    this.lastCraft = null;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.ui(true);
    this.syncHud(true);
  }

  closeInventory() {
    if (!this.inventoryOpen) return;
    this.inventoryOpen = false;
    this.invTab = 'tools';
    this.phase = 'playing';
    sfx.ui(false);
    this.requestLock();
    this.syncHud(true);
  }

  private updatePickaxe() {
    const c = PICKAXE_TIERS[this.tier].color;
    this.pickHeadMats.forEach((m) => m.color.set(c));
  }

  // ================= PARTICLES =================
  burst(x: number, y: number, z: number, rgb: [number, number, number] | number[], count: number, power = 3, sizeScale = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const sp = (0.4 + Math.random() * 0.9) * power;
      const jitter = () => (Math.random() - 0.5) * 46;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.7,
        y: y + (Math.random() - 0.5) * 0.7,
        z: z + (Math.random() - 0.5) * 0.7,
        vx: Math.cos(a) * Math.cos(b) * sp,
        vy: Math.sin(b) * sp + power * 0.55,
        vz: Math.sin(a) * Math.cos(b) * sp,
        life: 0.5 + Math.random() * 0.75,
        max: 1.25,
        size: (0.07 + Math.random() * 0.11) * sizeScale,
        r: Math.max(0, Math.min(1, (rgb[0] + jitter()) / 255)),
        g: Math.max(0, Math.min(1, (rgb[1] + jitter()) / 255)),
        b: Math.max(0, Math.min(1, (rgb[2] + jitter()) / 255)),
      });
    }
  }

  private updateParticles(dt: number) {
    const arr = this.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      if (p.weather) {
        if (p.weather === 'snow') {
          p.vx += Math.sin(this.time * 1.7 + p.x * 0.31) * dt * 0.08;
          p.vz += Math.cos(this.time * 1.3 + p.z * 0.27) * dt * 0.08;
        } else {
          p.vy -= 3.2 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const ground = this.world.getHeight(Math.floor(p.x), Math.floor(p.z)) + 0.08;
        if (p.y <= ground || Math.abs(p.x - this.pos.x) > 34 || Math.abs(p.z - this.pos.z) > 34) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
        }
        continue;
      }
      if (!p.smoke) p.vy -= GRAVITY * 0.72 * dt;
      else { p.vx += (Math.random() - 0.5) * dt; p.vz += (Math.random() - 0.5) * dt; }
      const nx = p.x + p.vx * dt,
        ny = p.y + p.vy * dt,
        nz = p.z + p.vz * dt;
      if (!p.smoke && isSolid(this.world.get(Math.floor(nx), Math.floor(p.y), Math.floor(p.z)))) {
        p.vx *= -0.32;
      } else p.x = nx;
      if (!p.smoke && isSolid(this.world.get(Math.floor(p.x), Math.floor(ny), Math.floor(p.z)))) {
        if (p.vy < 0) {
          p.vy *= -0.28;
          p.vx *= 0.72;
          p.vz *= 0.72;
        } else p.vy = 0;
      } else p.y = ny;
      if (!p.smoke && isSolid(this.world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(nz)))) {
        p.vz *= -0.32;
      } else p.z = nz;
    }

    const n = arr.length;
    this.pMesh.count = n;
    for (let i = 0; i < n; i++) {
      const p = arr[i];
      const k = Math.min(1, p.life / (p.weather ? p.max : 0.42));
      const s = p.size * (0.45 + k * 0.75);
      this.pDummy.position.set(p.x, p.y, p.z);
      if (p.weather === 'rain') {
        this.pDummy.rotation.set(0.2, 0, -0.16);
        this.pDummy.scale.set(s * 0.34, s * 5.8, s * 0.34);
      } else if (p.weather === 'snow') {
        this.pDummy.rotation.set(p.x * 1.7 + this.time, p.y * 1.3, p.z * 1.7);
        this.pDummy.scale.set(s * 1.15, s * 0.32, s * 1.15);
      } else {
        this.pDummy.rotation.set(p.x * 3 + this.time, p.y * 3, p.z * 3);
        this.pDummy.scale.setScalar(s);
      }
      this.pDummy.updateMatrix();
      this.pMesh.setMatrixAt(i, this.pDummy.matrix);
      this.pColor.setRGB(p.r, p.g, p.b, THREE.SRGBColorSpace);
      this.pMesh.setColorAt(i, this.pColor);
    }
    if (n > 0) {
      this.pMesh.instanceMatrix.needsUpdate = true;
      if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    }
  }

  // ================= POPUPS =================
  private popup(x: number, y: number, z: number, text: string, color: string, big = false) {
    const p = this.popups.find((pp) => pp.life <= 0) ?? this.popups[0];
    p.x = x + (Math.random() - 0.5) * 0.5;
    p.y = y;
    p.z = z + (Math.random() - 0.5) * 0.5;
    p.vy = 1.35;
    p.life = big ? 1.25 : 0.95;
    p.max = p.life;
    p.text = text;
    p.color = color;
    p.big = big;
    p.el.textContent = text;
    p.el.style.color = color;
    p.el.style.fontSize = big ? '30px' : '21px';
    p.el.style.letterSpacing = big ? '1px' : '0.5px';
  }

  private pushBanner(text: string, sub: string, color: string) {
    this.banner = { text, sub, color, key: Math.random() };
    this.bannerTimer = 2.6;
    this.syncHud(true);
  }

  private tmpV = new THREE.Vector3();
  private updatePopups(dt: number) {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const p of this.popups) {
      if (p.life <= 0) {
        if (p.el.style.opacity !== '0') p.el.style.opacity = '0';
        continue;
      }
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= Math.pow(0.25, dt);
      this.tmpV.set(p.x, p.y, p.z).project(this.camera);
      if (this.tmpV.z > 1) {
        p.el.style.opacity = '0';
        continue;
      }
      const sx = (this.tmpV.x * 0.5 + 0.5) * w;
      const sy = (-this.tmpV.y * 0.5 + 0.5) * h;
      const k = p.life / p.max;
      const pop = k > 0.86 ? 1 + (1 - k / 0.86) * -0.35 : 1;
      p.el.style.transform = `translate3d(${sx}px,${sy}px,0) translate(-50%,-50%) scale(${pop.toFixed(3)})`;
      p.el.style.opacity = String(Math.min(1, k * 2.2));
    }
  }

  // ================= HUD SYNC =================
  private writeDom() {
    const d = this.dom;
    if (d.coords) {
      const txt = `${Math.floor(this.pos.x)} · ${Math.floor(this.pos.y)} · ${Math.floor(this.pos.z)}`;
      if (d.coords.textContent !== txt) d.coords.textContent = txt;
    }
    if (d.compass) {
      // arrow points back to the spawn point
      const dx = this.spawnX - this.pos.x;
      const dz = this.spawnZ - this.pos.z;
      const dist = Math.hypot(dx, dz);
      const bearing = Math.atan2(dx, -dz) - this.yaw;
      d.compass.style.transform = `rotate(${(bearing * 180) / Math.PI}deg)`;
      d.compass.style.opacity = dist < 6 ? '0.25' : '1';
    }
    if (d.progress) d.progress.style.setProperty('--p', this.mineProgress.toFixed(3));
    if (d.comboBar) d.comboBar.style.transform = `scaleX(${Math.max(0, Math.min(1, this.comboTimer / 3)).toFixed(3)})`;
    if (d.healthBar) d.healthBar.style.width = `${Math.max(0, Math.min(100, this.health)).toFixed(1)}%`;
    if (d.timeBar) d.timeBar.style.width = `${Math.max(0, Math.min(100, (this.timeLeft / this.runTime) * 100)).toFixed(2)}%`;
    if (d.vignette) {
      if (this.sleepDark > 0.01) {
        // closing eyelids while asleep
        d.vignette.style.opacity = String((this.sleepDark * 0.92).toFixed(3));
        d.vignette.style.background =
          'radial-gradient(ellipse at 50% 50%, rgba(4,6,10,.55) 30%, rgba(2,3,6,.99) 90%)';
      } else {
        const lava = this.inLava ? 0.72 : 0;
        const hurt = this.hurtTimer > 0 ? this.hurtTimer * 1.6 : 0;
        const low = this.health < 35 ? (1 - this.health / 35) * (0.25 + Math.sin(this.time * 5) * 0.12) : 0;
        const urgent = this.timeLeft < 10 ? (1 - this.timeLeft / 10) * (0.18 + Math.sin(this.time * 8) * 0.1) : 0;
        d.vignette.style.opacity = String(Math.max(this.flash * 0.55, lava, hurt, low, urgent).toFixed(3));
        d.vignette.style.background =
          lava > 0.4
            ? 'radial-gradient(circle at 50% 55%, rgba(255,110,20,0) 20%, rgba(226,60,12,.85) 100%)'
            : 'radial-gradient(circle at 50% 55%, rgba(190,20,20,0) 34%, rgba(178,26,26,.78) 100%)';
      }
    }
    if (d.crosshair) {
      const s = 1 + this.mineProgress * 0.5 + (this.swingT >= 0 ? 0.16 : 0);
      d.crosshair.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)}) rotate(${(this.mineProgress * 45).toFixed(1)}deg)`;
      d.crosshair.style.opacity = this.target ? '1' : '0.55';
    }
  }

  private syncHotbar(force: boolean) {
    // sparse 10-slot bar: blocks, tools & gear vanish when they are no longer owned;
    // the HAND is permanent
    for (let i = 0; i < this.hotbar.length; i++) {
      const id = this.hotbar[i];
      if (id === undefined || id === HAND) continue;
      if (isGearHotbarId(id)) {
        if (!this.bagItems.some((b) => b.hid === id)) this.hotbar[i] = undefined;
      } else if ((this.inventory.get(id) ?? 0) <= 0) {
        this.hotbar[i] = undefined;
      }
    }
    while (this.hotbar.length > 10) this.hotbar.pop();
    if (!this.hotbar.includes(HAND)) {
      const f = this.firstFreeSlot();
      if (f >= 0) this.hotbar[f] = HAND;
    }
    this.selected = Math.max(0, Math.min(9, this.selected));
    if (force) this.lastHudKey = '';
  }

  private lastHudCheck = 0;

  private syncHud(force: boolean) {
    // cheap DOM writes every frame; the expensive React-state key only ~7x/sec
    if (!force) {
      const now = performance.now();
      if (now - this.lastHudCheck < 140) {
        this.writeDom();
        return;
      }
      this.lastHudCheck = now;
    }
    const t = this.target;
    const key = [
      this.phase,
      Math.round(this.loadProgress * 100),
      this.score,
      Math.ceil(this.timeLeft),
      Math.ceil(this.health),
      this.combo,
      this.tier,
      this.blocksMined,
      Math.round(this.deepest),
      this.oresFound,
      this.selected,
      this.banner?.key ?? 0,
      this.deathCause ?? '-',
      this.fps,
      this.locked || this.lockPending ? 1 : 0,
      this.lockFailed ? 1 : 0,
      this.inventoryOpen ? 1 : 0,
      this.lastCraft ?? '-',
      t ? t.id : 0,
      this.hotbar.map((id) => `${id ?? -1}:${this.inventory.get(id ?? -1) ?? 0}`).join('|'),
      this.craftSignature(),
    ].join('~');
    if (!force && key === this.lastHudKey) {
      this.writeDom();
      return;
    }
    this.lastHudKey = key;
    this.onHud({
      phase: this.phase,
      loading: this.loadProgress,
      score: this.score,
      timeLeft: this.timeLeft,
      health: Math.max(0, Math.ceil(this.health)),
      combo: this.combo,
      comboMult: this.comboMult(),
      tier: this.tier,
      tierName: pickaxeLabel(this.tier),
      blocksMined: this.blocksMined,
      bestCombo: this.bestCombo,
      deepest: Math.round(this.deepest),
      oresFound: this.oresFound,
      // sparse hotbar: pad to 10 fixed slots, empty holes become null
      hotbar: Array.from({ length: 10 }, (_, i) => {
        const id = this.hotbar[i];
        if (id === undefined) return null;
        if (isGearHotbarId(id)) return { id, count: 1 };
        return { id, count: this.inventory.get(id) ?? 0 };
      }),
      selected: this.selected,
      target: t && t.id !== AIR ? { id: t.id, name: blockName(t.id, BLOCKS[t.id].name) } : null,
      banner: this.banner,
      deathCause: this.gameOverState(),
      fps: this.fps,
      locked: this.locked || this.lockPending,
      lockFailed: this.lockFailed,
      freeLook: this.freeLook,
      runTime: this.runTime,
      survival: this.survival,
      daylight: this.daylight,
      timeOfDay: this.clock,
      phaseName: this.phaseName(),
      kills: this.kills,
      heldName: this.heldName(),
      heldKind: this.heldKind(),
      swordTier: this.swordTier,
      equipped: { ...this.equipped },
      bagItems: this.bagItems.slice(),
      stats: this.stats,
      killedBy: this.killedBy,
      offers: this.offers,
      sellPrices: Object.fromEntries(Engine.SELL_PRICES),
      invTab: this.invTab,
      tradeNear: this.phase === 'playing' || this.inventoryOpen ? this.traderNear() !== null : false,
      anvilNear: this.phase === 'playing' || this.inventoryOpen ? this.anvilNear() : false,
      workbenchNear: this.phase === 'playing' || this.inventoryOpen ? this.workbenchNear() : false,
      sandbox: this.sandbox,
      inventoryOpen: this.inventoryOpen,
      craftHint: this.craftHint(),
      inventory: this.inventoryList(),
      craftable: RECIPES.filter((r) => this.canCraft(r)).map((r) => r.key),
      lastCraft: this.lastCraft,
    });
    this.writeDom();
  }

  private updateSunGlare() {
    if (!this.sunGlare || this.daylight < 0.18 || this.weatherIntensity > 0.75) {
      if (this.sunGlare) this.sunGlare.style.opacity = '0';
      return;
    }
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const dot = forward.dot(this.sunDir);
    const t2 = Math.max(0, Math.min(1, (dot - 0.955) / 0.045));
    const glare = t2 * t2 * (3 - 2 * t2) * Math.min(1, this.daylight * 1.25) * (1 - this.weatherIntensity * 0.65);
    this.sunGlare.style.opacity = glare.toFixed(3);
  }

  // ================= RENDER =================
  private render() {
    this.updateChunkVisibility();
    this.updateClock(0);
    this.updateSunGlare();
    const cur = this.phase === 'playing' ? (this.locked ? 'none' : 'crosshair') : 'default';
    if (this.renderer.domElement.style.cursor !== cur) this.renderer.domElement.style.cursor = cur;
    const mining = this.mining || this.touchMine;
    this.pickGroup.visible = this.phase === 'playing' || this.phase === 'paused';
    this.highlight.visible = this.highlight.visible && this.phase === 'playing';
    this.crackMesh.visible = this.crackMesh.visible && this.phase === 'playing' && mining;
    if (this.phase !== 'playing') {
      this.crackMesh.visible = false;
      this.highlight.visible = false;
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.hudScene, this.hudCamera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    const el = this.renderer?.domElement;
    if (el) {
      el.removeEventListener('mousedown', this.onMouseDown);
      el.removeEventListener('wheel', this.onWheel);
      el.removeEventListener('contextmenu', this.onContext);
      el.removeEventListener('mouseleave', this.onMouseLeave);
    }
    this.renderer?.dispose();
    if (el && el.parentElement) el.parentElement.removeChild(el);
    if (this.fx?.parentElement) this.fx.parentElement.removeChild(this.fx);
  }
}

export { RUN_TIME };
