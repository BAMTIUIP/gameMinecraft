import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, EXPLORATION_RUN_TIME, type DomRefs, type HudState } from './game/engine';
import { requestGameReview, reviewOffer } from './game/review';
import { requestShortcut, SHORTCUT_REWARD, shortcutOffer } from './game/shortcut';
import {
  coopEnabled,
  publishCoopSession,
  squadMembers,
  startCoopRound,
  stopCoopRound,
  tickCoop,
  type CoopSink,
} from './game/multiplayer';
import { initAudio, isMusicEnabled, isMuted, requestMusic, setMusicEnabled, setMuted, stopMusic } from './game/audio';
import Hud from './ui/Hud';
import TouchControls from './ui/TouchControls';
import { GameOverScreen, LoadingScreen, PauseScreen, StartScreen } from './ui/Screens';
import { loadPlayerName, loadScores, savePlayerName, submitScore, updateName, type ScoreEntry } from './ui/scores';
import Inventory from './ui/Inventory';
import { EMPTY_STATS, type Slot } from './game/items';
import { getLang, initLang, resolveLang, setLang, t, type Lang } from './game/i18n';
import {
  initYandex,
  yaGameplayStart,
  yaGameplayStop,
  yaLang,
  yaLoadingReady,
  yaOnPause,
  yaOnResume,
  yaOpenAuthDialog,
  yaServerTime,
  type YaProfile,
} from './game/yandex';
import { addDiamonds, addTotals, flushProfile, markProfileDirty, onProfileChange, pauseProfileSync, resyncProfile, saveProgressNow, startProfileSync, type ProfileSnapshot } from './game/profile';
import { allFlags, flagBool, loadFlags } from './game/flags';
import { promoAction } from './game/promo';
import { watchAndClaimDailyReward } from './game/daily';
import { confirmExit, dismissExit, onAccountSwitch, onExitPrompt, startPlatformEvents } from './game/platform';
import { copyText, fullscreenAvailable, fullscreenOn, toggleFullscreen, touchDevice } from './game/params';
import { backIntent, focusFirst, installRemoteKeys, tvMode } from './game/remote';
import { markAdSessionStart, rewardedAdsAvailable, showFullscreenAd, showRewardedAd, syncBanner } from './game/ads';
import { completePendingRewardedDropItems, pendingRewardedDropItems, recordRewardedDropLogin, watchAndClaimRewardedDrop, type RewardedDropId } from './game/adDrops';
import { completePendingShopRewards, pendingShopProductRewards } from './game/shopRewards';
import { buyDiamondPack, buyRevive, buyShopItem as purchaseShopItem, deliverPendingPurchases, diamondsBalance, DIAMOND_PACKS, loadShopCatalog, paymentsAvailable, REVIVE_DIAMOND_PRICE, type BuyResult, type ShopCatalog, type ShopItemBuyResult } from './game/shop';
import { grantDeveloperShopProduct } from './game/devShop';
import {
  getLeaderboardView,
  leaderboardAvailable,
  leaderboardCooldownLeft,
  loadLeaderboard,
  loadMyRank,
  submitLeaderboardScore,
  type LeaderboardView,
} from './game/leaderboard';
import { storageGet, storageSet } from './game/storage';
import { getCharacterCustomization, saveCharacterCustomization, type CharacterCustomization } from './game/character';

/** rewarded-video revive: how much breathing room it buys, and how often per run */
const REVIVE_SECONDS = 60;
const MAX_REVIVES_PER_RUN = 2;
/** Ordinary shop is back; the developer-only free catalogue remains explicitly disabled. */
const SHOP_SCREENS_ENABLED = true;

/** Adapter from the co-op module to the running engine: three.js stays inside the engine. */
function coopSink(engine: Engine): CoopSink {
  return {
    spawn: (seeds) => engine.setCompanions(seeds),
    move: (id, pose) => engine.moveCompanion(id, pose),
    finish: (id) => engine.finishCompanion(id),
    clear: () => engine.clearCompanions(),
  };
}

/** Shop goods are delivered only after the destination run/world is loaded. */
function deliverPendingShopDropItems(engine: Engine | null | undefined) {
  if (!engine) return;
  const purchases = pendingShopProductRewards();
  if (purchases && engine.grantShopProductRewards(purchases.products)) completePendingShopRewards(purchases.keys);
  const pending = pendingRewardedDropItems(engine.sandbox ? 'own-world' : 'next-run');
  if (pending && engine.grantShopRewardItems(pending.items)) completePendingRewardedDropItems(pending.keys);
}

const INITIAL_HUD: HudState = {
  phase: 'loading',
  squad: [],
  loading: 0,
  score: 0,
  timeLeft: EXPLORATION_RUN_TIME,
  health: 100,
  stamina: 100,
  airBubbles: 6,
  inWater: false,
  breathVisible: false,
  combo: 0,
  comboMult: 1,
  tier: 0,
  tierName: 'WOOD',
  blocksMined: 0,
  bestCombo: 0,
  deepest: 0,
  oresFound: 0,
  hotbar: new Array(10).fill(null),
  selected: 0,
  target: null,
  banner: null,
  deathCause: null,
  fps: 60,
  locked: false,
  lockFailed: false,
  freeLook: true,
  runTime: EXPLORATION_RUN_TIME,
  inventoryOpen: false,
  tutorialTip: null,
  explorationObjectives: [],
  objectiveIndex: 0,
  objectiveCount: 0,
  inventory: [],
  craftable: [],
  lastCraft: null,
  survival: true,
  daylight: 1,
  timeOfDay: 0.3,
  phaseName: 'day',
  kills: 0,
  heldName: '',
  heldKind: 'pick',
  swordTier: -1,
  equipped: {},
  bagItems: [],
  stats: EMPTY_STATS,
  killedBy: null,
  offers: [],
  sellPrices: {},
  invTab: 'tools',
  tradeNear: false,
  anvilNear: false,
  workbenchNear: false,
  sandbox: false,
  endless: false,
};

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const domRef = useRef<DomRefs>({});
  const savedRef = useRef(false);
  const bestRef = useRef(0);
  const dailyBusyRef = useRef(false);
  const dailyNoteTimerRef = useRef<number | null>(null);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [name, setName] = useState('MINER');
  const [token, setToken] = useState('');
  const [isRecord, setIsRecord] = useState(false);
  const [muted, setMutedUi] = useState(false);
  const [music, setMusicUi] = useState(true);
  const [freeLook, setFreeLookUi] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [lang, setLangUi] = useState<Lang>('en');
  const [survival, setSurvivalUi] = useState<boolean>(() => storageGet('orerush.mode') !== 'explorer');
  const [characterCustomization, setCharacterCustomization] = useState<CharacterCustomization>(() => getCharacterCustomization());
  // Yandex profile: avatar/nick in the menu, cloud-progress notice, sign-in button
  const [profile, setProfile] = useState<YaProfile | null>(null);
  const [cloudSavedAt, setCloudSavedAt] = useState(0);
  // Remote config (ysdk.getFlags): rendered from the local configuration until the remote one lands
  const [flags, setFlags] = useState(() => allFlags());
  // Advertising: the results screen may offer a rewarded video, and ads must not be requested twice
  const [adBusy, setAdBusy] = useState(false);
  const [adNotice, setAdNotice] = useState<string | null>(null);
  const [revivesUsed, setRevivesUsed] = useState(0);
  // shop: real payments go through the Yandex payment frame, the balance lives in the cloud profile
  const [diamonds, setDiamonds] = useState(0);
  const [shopPrices, setShopPrices] = useState<ShopCatalog>(() => new Map());
  const [canPay, setCanPay] = useState(false);
  // leaderboard: the platform keeps the rating, the game only submits results and draws the top
  const [leaderboard, setLeaderboard] = useState<LeaderboardView | null>(null);
  const [lbBusy, setLbBusy] = useState(false);
  const [lbAvailable, setLbAvailable] = useState(false);
  const [lbCooldown, setLbCooldown] = useState(0);
  const [myRank, setMyRank] = useState<number | null | undefined>(undefined);
  /** a line under the squad table on the results screen: published / local teammates / nothing */
  const [squadNote, setSquadNote] = useState<string | null>(null);
  /** rating dialog: the platform decides who may be asked, the results screen only offers the button */
  const [canRate, setCanRate] = useState(false);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  /** desktop shortcut: offered in the menu when the platform says the dialog can be shown */
  const [canShortcut, setCanShortcut] = useState(false);
  const [shortcutNote, setShortcutNote] = useState<string | null>(null);
  /** promo deep link: opening the game from a catalogue banner lands on the promised screen */
  const [promo, setPromo] = useState<{ productId: string | null; promoId: string } | null>(null);
  /** the main-menu daily bonus awaits a verified rewarded-video callback */
  const [dailyBusy, setDailyBusy] = useState(false);
  const [dailyNote, setDailyNote] = useState<string | null>(null);
  /** the game's own dialog for the TV back button (sdk-events) */
  const [exitPrompt, setExitPrompt] = useState(false);
  /** browser fullscreen (sdk-params): the settings dialog shows the right label for the current state */
  const [fullscreen, setFullscreen] = useState(false);
  /** clipboard feedback on the results screen */
  const [copyNote, setCopyNote] = useState<string | null>(null);
  /** the player is on a TV: requirement 1.6.3 — purchases are not allowed there */
  const [isTv, setIsTv] = useState(false);
  /** the last remote Back press, for the "single = pause, double = exit" rule */
  const lastBackAt = useRef(0);
  /** live copies for the window-level key handler, which is installed once */
  const isTvRef = useRef(false);
  const exitPromptOpenRef = useRef(false);
  const onPlatformBackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    setIsTouch(touchDevice()); // deviceInfo when the platform is up, pointer type otherwise
    setLangUi(initLang());
    markAdSessionStart(); // the grace period before the first fullscreen ad starts now

    // Yandex Games: auto-detect the user's language from the platform (rule 2.14).
    // An explicit in-game choice (saved in safeStorage) always wins.
    void initYandex().then(async () => {
      const platformLang = yaLang();
      if (platformLang && storageGet('orerush.lang') === null) {
        // Unsupported codes follow the documented reserve sets (`ru` for be/kk/uk/uz, `en` otherwise).
        const mapped = resolveLang(platformLang);
        setLang(mapped);
        setLangUi(mapped);
      }
      // Cloud profile: pull records/settings made on another device and report our own progress.
      // Outside Yandex this resolves immediately with platform: null.
      const snapshot = await startProfileSync();
      // Apply cloud progress first, then record today's unique trusted-UTC login date.
      recordRewardedDropLogin();
      setProfile(snapshot.platform);
      setCharacterCustomization(getCharacterCustomization());
      if (snapshot.cloudApplied) {
        setScores(loadScores());
        setName(loadPlayerName());
        setSurvivalUi(storageGet('orerush.mode') !== 'explorer');
        setLangUi(getLang());
        setCloudSavedAt(Number(storageGet('orerush.profile.savedAt') ?? 0));
      }
      // Remote config: one request at startup (sdk-config). Paying status comes from the profile,
      // so the Yandex Console can target monetisation flags at paying / non-paying groups.
      setFlags(await loadFlags(snapshot.platform?.paying));

      // Shop: the catalogue gives real prices in the player's currency, and any purchase that was
      // paid for but not delivered last time is granted right now (requirement 1.13.1).
      setCanPay(paymentsAvailable());
      if (paymentsAvailable()) {
        setShopPrices(await loadShopCatalog());
        const restored = await deliverPendingPurchases();
        if (restored > 0) setAdNotice(t('shopPurchaseDone').replace('{n}', String(restored)));
      }
      setDiamonds(diamondsBalance());
      setLbAvailable(leaderboardAvailable());
      // Desktop shortcut: a quiet check at startup — the button only appears when the platform can
      // actually show the native dialog on this device.
      setCanShortcut((await shortcutOffer()).available);
      // Promo deep links can reopen the ordinary shop, but remain suppressed on TVs.
      const action = promoAction();
      // Requirement 1.6.3: the shop route is not available on a TV.
      if (SHOP_SCREENS_ENABLED && action?.kind === 'shop' && !tvMode()) {
        setPromo({ productId: action.productId, promoId: action.promoId });
      }
      // Device info and fullscreen (sdk-params) are only known once the SDK is up: the touch controls
      // follow deviceInfo, and the settings toggle needs the platform's fullscreen status.
      setIsTouch(touchDevice());
      setFullscreen(fullscreenOn());
      setIsTv(tvMode());
    });
    const loaded = loadScores();
    setScores(loaded);
    bestRef.current = loaded[0]?.score ?? 0;
    setName(loadPlayerName());
    setMutedUi(isMuted());
    setMusicUi(isMusicEnabled());
    setHasSave(Engine.hasSavedWorld());

    const eng = new Engine(hostRef.current, setHud);
    eng.setCharacterCustomization(characterCustomization);
    engineRef.current = eng;
    eng.mount();
    eng.setDom(domRef.current);
    // the remote-config knob (game.exploreMinutes) is applied by the effect below, once flags load
    eng.setSurvival(survival);
    setFreeLookUi(eng.freeLookEnabled);
    setEngine(eng);

    const onKey = (e: KeyboardEvent) => {
      const e2 = e.code;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if ((e2 === 'Escape' || e2 === 'KeyP') && !e.repeat) {
        if (eng.inventoryOpen) eng.closeInventory();
        else if (eng.phase === 'playing') eng.pause();
        else if (eng.phase === 'paused') eng.resume();
      }
      if (e2 === 'KeyM') toggleMute();
    };
    // browsers keep the AudioContext suspended until a gesture — kick the menu
    // theme off on the very first interaction
    const unlock = () => {
      initAudio();
      if (eng.phase === 'menu') requestMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    window.addEventListener('keydown', onKey);

    // Yandex Games pauses / resumes the game on its own — ad or purchase window, tab switch, minimised
    // window, focus moved to another window — and calls GameplayAPI.stop()/start() for it. The game has
    // to follow, or the gameplay indicator says "playing" over a frozen game (and "stopped" over a live one)
    // Asynchronous co-op: the engine reports the player's pose a few times per second while a shift
    // runs; the module decides what to record and where the local teammates wander.
    eng.onPose((pose) => tickCoop(pose));

    const offYaPause = yaOnPause(() => eng.systemPause());
    const offYaResume = yaOnResume(() => eng.systemResume());

    // Platform events (sdk-events). HISTORY_BACK happens on TVs and must not exit silently: the game
    // shows its dialog and reports EXIT to the platform only if the player confirms. The account
    // picker holds our progress sync while it is open, and once it closes the chosen cloud progress
    // is pulled in and the game returns to the menu.
    startPlatformEvents();
    // Remote Back (requirement 1.6.3): a single press during a run pauses and opens the in-game menu,
    // a second press inside the double-press window asks about leaving, and in any menu the press asks
    // right away. The same rule covers HISTORY_BACK from the platform and the remote's own Escape-like
    // Back where the SDK does not report it.
    const handleBack = () => {
      const eng = engineRef.current;
      const phase = eng?.phase ?? 'menu';
      const action = backIntent(eng?.inventoryOpen ? 'menu' : phase, lastBackAt.current, Date.now());
      if (action === 'pause') {
        lastBackAt.current = Date.now();
        if (eng?.phase === 'playing') eng.pause(); // the player's own pause: the pause menu is open
        return;
      }
      lastBackAt.current = 0;
      setExitPrompt(true);
    };
    onPlatformBackRef.current = handleBack;
    const offExitPrompt = onExitPrompt(() => onPlatformBackRef.current?.());
    // Esc is the keyboard's Back for the menus: on a TV the platform reports HISTORY_BACK, but some
    // remote layouts and browsers send Escape instead, and a player must never be stuck in a menu.
    // During a run Escape keeps its normal "pause / resume" meaning, so the two never fight.
    const onBackKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || e.repeat) return;
      if (!isTvRef.current || exitPromptOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const phase = engineRef.current?.phase ?? 'menu';
      if (phase === 'playing' || phase === 'paused') return;
      handleBack();
    };
    window.addEventListener('keydown', onBackKey);

    const offAccountSwitch = onAccountSwitch((phase) => {
      if (phase === 'opened') {
        pauseProfileSync(true);
        return;
      }
      pauseProfileSync(false);
      void resyncProfile().then(() => {
        setCharacterCustomization(getCharacterCustomization());
        setScores(loadScores());
        setName(loadPlayerName());
        setDiamonds(diamondsBalance());
        engineRef.current?.toMenu();
      });
    });
    return () => {
      eng.onPose(null);
      offYaPause();
      offYaResume();
      offExitPrompt();
      offAccountSwitch();
      window.removeEventListener('keydown', onBackKey);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('keydown', onKey);
      eng.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setCharacterCustomization(characterCustomization);
  }, [characterCustomization]);

  /**
   * Shift length of explore mode: a remote-config knob (flag game.exploreMinutes). The floor keeps a
   * broken config (0, negative, garbage) from ending runs instantly.
   */
  const exploreSeconds = Math.max(15, Math.round((Number(flags['game.exploreMinutes']) || 20) * 60));

  useEffect(() => {
    engineRef.current?.setRunTime(exploreSeconds);
  }, [exploreSeconds]);

  const toggleMute = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedUi(next);
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !isMusicEnabled();
    setMusicEnabled(next);
    setMusicUi(next);
    if (next && engineRef.current?.phase === 'menu') requestMusic();
    else if (!next) stopMusic(0.35);
  }, []);

  const pickLang = useCallback((l: Lang) => {
    setLang(l);
    setLangUi(l);
    markProfileDirty({ lang: l });
    saveProgressNow(); // requirement 1.9: the choice is progress, it goes out right away
  }, []);

  const saveCharacter = useCallback((next: CharacterCustomization) => {
    const saved = saveCharacterCustomization(next);
    setCharacterCustomization(saved);
  }, []);

  const pickMode = useCallback((s: boolean) => {
    setSurvivalUi(s);
    storageSet('orerush.mode', s ? 'survival' : 'explorer');
    // the chosen mode travels to the cloud, so another device opens the same way
    markProfileDirty({ mode: s ? 'survival' : 'explorer' });
    saveProgressNow();
    engineRef.current?.setSurvival(s);
    engineRef.current?.setRunTime(exploreSeconds);
  }, [exploreSeconds]);

  const equip = useCallback((uid: string) => engineRef.current?.equip(uid), []);
  const unequip = useCallback((slot: Slot) => engineRef.current?.unequip(slot), []);
  const sell = useCallback((id: number) => engineRef.current?.sellResource(id), []);
  const buyOffer = useCallback((i: number) => engineRef.current?.buyOffer(i), []);
  const upgradeItem = useCallback((uid: string) => engineRef.current?.upgradeToNetherite(uid), []);
  const reinforceItem = useCallback((uid: string) => engineRef.current?.reinforceItem(uid), []);
  const sellTool = useCallback((id: number, instanceId?: number) => engineRef.current?.sellTool(id, instanceId), []);
  const sellGear = useCallback((uid: string) => engineRef.current?.sellGear(uid), []);
  // sparse hotbar: place any owned item into a slot (swap / evict), or remove it back
  const placeItem = useCallback(
    (id: number, slot?: number, fromSlot?: number, instanceId?: number) => engineRef.current?.placeInSlot(id, slot, fromSlot, instanceId),
    [],
  );
  const removeSlot = useCallback((slot: number) => engineRef.current?.removeFromSlot(slot), []);
  const salvageGear = useCallback((uid: string) => engineRef.current?.salvageGear(uid), []);
  const salvageItem = useCallback((id: number, instanceId?: number) => engineRef.current?.salvageItem(id, instanceId), []);
  const repairTool = useCallback((instanceId: number) => engineRef.current?.repairTool(instanceId), []);

  const toggleFreeLook = useCallback(() => {
    const next = !(engineRef.current?.freeLookEnabled ?? true);
    engineRef.current?.setFreeLook(next);
    setFreeLookUi(next);
  }, []);

  // Yandex GameplayAPI follows the actual engine phase. The inventory is a live overlay over 'playing',
  // so opening/crafting/closing it must not stop the session; changing camera perspective is phase-neutral too.
  // Platform/system pauses still switch the phase to 'paused' and stop gameplay until the platform resumes.
  useEffect(() => {
    if (hud.phase !== 'loading') yaLoadingReady();
    if (hud.phase === 'playing') yaGameplayStart();
    else yaGameplayStop();
  }, [hud.phase]);

  // record the run when it ends
  useEffect(() => {
    if (hud.phase === 'gameover') {
      if (savedRef.current) return;
      savedRef.current = true;
      const serverNow = yaServerTime();
      const runToken = `run-${serverNow}-${Math.floor(Math.random() * 1e6)}`;
      setToken(runToken);
      setIsRecord(hud.score > bestRef.current);
      bestRef.current = Math.max(bestRef.current, hud.score);
      const next = submitScore({
        name: name || 'MINER',
        score: hud.score,
        blocks: hud.blocksMined,
        tier: hud.tierName,
        depth: hud.deepest,
        combo: hud.bestCombo,
        runTime: hud.runTime,
        date: serverNow,
        token: runToken,
      });
      setScores(next);
      // Cloud progress: lifetime counters (player.setStats/incrementStats) plus the profile blob
      // with the fresh records table. A finished run is a natural sync point, so it is flushed
      // immediately instead of waiting for the debounce.
      const totals = addTotals({
        runs: 1,
        deaths: hud.deathCause && hud.deathCause !== 'time' ? 1 : 0,
        blocksMined: hud.blocksMined,
        oresFound: hud.oresFound,
        kills: hud.kills,
        deepest: hud.deepest,
        bestScore: hud.score,
        playSeconds: Math.max(0, Math.round(hud.runTime - hud.timeLeft)),
      });
      markProfileDirty({ scores: next.filter((e) => !e.token.startsWith('seed-')), best: totals.bestScore, totals, name: name || 'MINER' });
      void flushProfile(true);
      // Leaderboard: the docs allow setScore for authorised players only, and at most once a second
      // — submitLeaderboardScore() checks both and coalesces a burst. The place is then shown on the
      // results screen; without a leaderboard (outside Yandex) the line stays hidden.
      if (leaderboardAvailable()) {
        void (async () => {
          await submitLeaderboardScore(hud.score, `${hud.blocksMined} BLK · ${hud.tierName}`);
          setMyRank(await loadMyRank());
        })();
      } else {
        setMyRank(undefined);
      }
      // Rating the game: ask the platform whether this player may be asked at all (once per session),
      // and only then offer the button — the dialog itself opens from a click, never on its own.
      void reviewOffer().then((offer) => setCanRate(offer.available));

      // Asynchronous co-op: publish the shift so other players can replay it as a teammate. A revive
      // keeps the recorder running, so the next push carries the longer session instead of a copy.
      const published = publishCoopSession({ score: hud.score, depth: hud.deepest, blocks: hud.blocksMined });
      setSquadNote(published ? t('squadPublished') : squadMembers().some((mate) => mate.kind === 'bot') ? t('squadLocal') : null);
    } else {
      savedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.phase]);

  const changeName = useCallback(
    (n: string) => {
      setName(n);
      savePlayerName(n);
      if (token) setScores(updateName(token, n));
      markProfileDirty({ name: n });
      saveProgressNow(); // the record table was rewritten too: push both without waiting
    },
    [token],
  );

  /**
   * Co-op is a survival-mode feature: every place that actually starts a shift calls this (never a
   * phase effect — a revive from the results screen must not spin up a second squad). The module
   * loads opponent sessions from the platform, or hands out local teammates outside Yandex Games.
   */
  const beginCoop = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!survival || !coopEnabled()) {
      engine.clearCompanions();
      return;
    }
    setSquadNote(null);
    const squad = await startCoopRound(coopSink(engine));
    if (!squad.length) engine.clearCompanions();
  }, [survival]);

  /** Leaving the world ends the recorded session and removes the teammates. */
  const endCoop = useCallback(() => {
    stopCoopRound();
    engineRef.current?.clearCompanions();
    setSquadNote(null);
  }, []);

  const play = useCallback(() => {
    setRevivesUsed(0);
    const engine = engineRef.current;
    engine?.startRun(survival ? undefined : exploreSeconds);
    deliverPendingShopDropItems(engine);
    void beginCoop();
  }, [survival, exploreSeconds, beginCoop]);

  /**
   * Restarting is a user action on a stopped-gameplay screen — the one place requirement 4.4 suggests
   * for a fullscreen ad. `showFullscreenAd` is a no-op when the flags, the cooldown or the platform
   * say no, and the run starts either way.
   */
  const restart = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setAdBusy(true);
    setAdNotice(null);
    await showFullscreenAd();
    setAdBusy(false);
    setRevivesUsed(0);
    // restarting a sandbox stays a sandbox; survival itself is endless too
    engine.startRun(survival ? undefined : exploreSeconds, engine.sandbox);
    deliverPendingShopDropItems(engine);
    void beginCoop();
  }, [survival, exploreSeconds, beginCoop]);

  /**
   * Rewarded video: the only ad the player asks for. The reward is applied only when the platform
   * confirmed the view (`rewarded`), otherwise the screen says so and nothing changes.
   */
  const watchAdRevive = useCallback(async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdNotice(null);
    const outcome = await showRewardedAd();
    setAdBusy(false);
    if (outcome.rewarded) {
      if (engineRef.current?.reviveAfterAd(REVIVE_SECONDS)) {
        setRevivesUsed((n) => n + 1);
        setAdNotice(t('adThanks'));
      }
      return;
    }
    setAdNotice(t('adNotShown'));
  }, [adBusy]);
  const createWorld = useCallback(() => {
    const engine = engineRef.current;
    engine?.startRun(undefined, true);
    deliverPendingShopDropItems(engine);
    setHasSave(Engine.hasSavedWorld());
    void beginCoop();
  }, [beginCoop]);
  const continueWorld = useCallback(() => {
    const engine = engineRef.current;
    if (engine?.loadWorld()) {
      deliverPendingShopDropItems(engine);
      setHasSave(true);
      void beginCoop();
    }
  }, [beginCoop]);
  const saveWorld = useCallback(() => {
    if (engineRef.current?.saveWorld()) setHasSave(true);
  }, []);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const quit = useCallback(() => {
    endCoop();
    engineRef.current?.toMenu();
  }, [endCoop]);
  const newWorld = useCallback(() => {
    engineRef.current?.regenerate();
  }, []);
  const selectSlot = useCallback((i: number) => engineRef.current?.selectSlot(i), []);
  const captureMouse = useCallback(() => engineRef.current?.requestLock(), []);
  const craft = useCallback((key: string) => engineRef.current?.craft(key), []);
  const openInventory = useCallback(() => engineRef.current?.openInventory(), []);
  const closeInventory = useCallback(() => engineRef.current?.closeInventory(), []);

  // live profile updates (avatar appears after the first getPlayer, sign-in refreshes it)
  useEffect(() => onProfileChange((snap: ProfileSnapshot) => setProfile(snap.platform)), []);

  // Remote keys (requirement 1.6.3): arrows move the focus through the menus and OK activates the
  // focused item. During a run the arrows keep moving the player, so navigation is off there unless
  // the inventory overlay is open; inputs keep their typing.
  useEffect(() => {
    return installRemoteKeys(() => {
      const eng = engineRef.current;
      if (!eng) return false;
      return eng.phase !== 'playing' || eng.inventoryOpen;
    });
  }, []);

  useEffect(() => {
    isTvRef.current = isTv;
  }, [isTv]);
  useEffect(() => {
    exitPromptOpenRef.current = exitPrompt;
    // A TV player must see where the remote is pointing: when the leave dialog opens, the focus (and
    // its ring) lands on the safe answer, so a first OK press never leaves the game by accident.
    if (isTv && exitPrompt) focusFirst();
  }, [isTv, exitPrompt]);


  // leaving the tab (or the platform pausing us) is the last safe moment to push progress
  useEffect(() => {
    const onHide = () => {
      // Requirement 1.9: a refresh must not lose the world the player has built. The sandbox world
      // is stored locally and has a save button of its own; this last-moment write covers the case
      // when the player leaves without pressing it. Silent: the player is already gone.
      if (engineRef.current?.phase === 'playing' || engineRef.current?.phase === 'paused') {
        engineRef.current?.saveWorld(true);
      }
      if (document.hidden) void flushProfile(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // The sticky banner belongs to menus, not to a run in progress: it must never cover the HUD.
  useEffect(() => {
    void syncBanner(hud.phase === 'menu' || hud.phase === 'gameover');
  }, [hud.phase, flags['adv.enabled'], flags['adv.banner.enabled']]);

  /**
   * Sign-in is offered, never forced: the button explains the benefit first (requirement 1.2),
   * and after a successful dialog the profile is re-read and the cloud merge re-runs.
   */
  const signIn = useCallback(async () => {
    const ok = await yaOpenAuthDialog();
    if (!ok) return;
    const snapshot = await startProfileSync();
    setProfile(snapshot.platform);
    setScores(loadScores());
    setName(loadPlayerName());
    if (snapshot.cloudApplied) setCloudSavedAt(Number(storageGet('orerush.profile.savedAt') ?? 0));
  }, []);

  /**
   * World ranking: loaded when the player opens the tab (and by the refresh button). The module
   * itself keeps the platform's 20-requests-per-5-minutes limit, so calling it never breaks it.
   */
  const loadWorldRanking = useCallback(async () => {
    if (!leaderboardAvailable()) return;
    setLbBusy(true);
    const view = await loadLeaderboard();
    setLeaderboard(view ?? getLeaderboardView());
    setLbCooldown(leaderboardCooldownLeft());
    setLbBusy(false);
  }, []);

  // the refresh button unlocks itself once the platform allows the next request
  useEffect(() => {
    if (!leaderboard) return;
    const id = window.setInterval(() => setLbCooldown(leaderboardCooldownLeft()), 1000);
    return () => window.clearInterval(id);
  }, [leaderboard]);

  /** Opens the desktop-shortcut dialog and credits the one-time reward when it was accepted. */
  // sdk-params: the fullscreen toggle is reachable only from a click (browser rule) and reports state
  const toggleFull = useCallback(async () => {
    if (!fullscreenAvailable()) return;
    setFullscreen(await toggleFullscreen());
  }, []);

  const copyResult = useCallback((text: string) => {
    void copyText(text).then((ok) => setCopyNote(ok ? t('copied') : t('copyFailed')));
  }, []);

  const addDaily = useCallback(async () => {
    if (dailyBusyRef.current) return;
    dailyBusyRef.current = true;
    setDailyBusy(true);
    setDailyNote(null);
    if (dailyNoteTimerRef.current !== null) window.clearTimeout(dailyNoteTimerRef.current);
    try {
      const result = await watchAndClaimDailyReward();
      if (result.ok) {
        setDiamonds(diamondsBalance());
        setDailyNote(t('dailyTaken').replace('{n}', String(result.amount)));
      } else if (result.reason === 'ad') {
        setDailyNote(t('adNotShown'));
      } else if (result.reason === 'storage') {
        setDailyNote(t('dailySaveFailed'));
      } else {
        setDailyNote(t('dailyClaimed'));
      }
    } catch {
      setDailyNote(t('adNotShown'));
    } finally {
      dailyBusyRef.current = false;
      setDailyBusy(false);
      dailyNoteTimerRef.current = window.setTimeout(() => setDailyNote(null), 2500);
    }
  }, []);

  const addShortcut = useCallback(async () => {
    setShortcutNote(null);
    const result = await requestShortcut();
    setCanShortcut(false);
    if (result === 'accepted') {
      setDiamonds(diamondsBalance());
      setShortcutNote(t('shortcutDone').replace('{n}', String(SHORTCUT_REWARD)));
    } else if (result === 'dismissed') {
      setShortcutNote(t('shortcutDismissed'));
    } else if (result === 'failed') {
      setShortcutNote(t('shortcutFailed'));
    }
  }, []);

  /** Opens the platform's rating dialog (docs: only from a user action, once per session). */
  const rateGame = useCallback(async () => {
    setCanRate(false);
    const result = await requestGameReview();
    if (result === 'sent') setReviewNote(t('reviewThanks'));
    else if (result === 'dismissed') setReviewNote(t('reviewDismissed'));
  }, []);

  /** Retry a missing/failed price catalogue when the player opens the shop. */
  const refreshShopCatalog = useCallback(async () => {
    if (!paymentsAvailable()) return;
    const catalog = await loadShopCatalog();
    if (catalog.size) setShopPrices(catalog);
  }, []);

  /** Opens the Yandex payment frame and settles the balance when it closes. */
  const buyPack = useCallback(async (productId: string): Promise<BuyResult> => {
    const result = await buyDiamondPack(productId);
    setDiamonds(result.diamonds);
    return result;
  }, []);

  const buyInGameShopItem = useCallback((productId: string): ShopItemBuyResult => {
    const result = purchaseShopItem(productId);
    setDiamonds(result.diamonds);
    return result;
  }, []);

  /** A shop drop is committed only after the SDK confirms the rewarded video was counted. */
  const claimShopDrop = useCallback(async (dropId: RewardedDropId) => {
    const result = await watchAndClaimRewardedDrop(dropId);
    if (result.ok && result.diamonds > 0) setDiamonds(diamondsBalance());
    return result;
  }, []);

  /** Temporary local grant path for the developer shop; never opens or calls a payment flow. */
  const grantDeveloperProduct = useCallback(async (productId: string): Promise<boolean> => {
    if (!import.meta.env.DEV || isTvRef.current) return false;
    const diamonds = DIAMOND_PACKS[productId];
    if (!grantDeveloperShopProduct(productId, diamonds !== undefined)) return false;
    if (diamonds) addDiamonds(diamonds, 'grant');
    setDiamonds(diamondsBalance());
    return true;
  }, []);

  /** Paid alternative to the rewarded video: same revive, paid with diamonds. */
  const reviveWithDiamonds = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.phase !== 'gameover') return;
    if (diamondsBalance() < REVIVE_DIAMOND_PRICE) {
      setAdNotice(t('notEnoughDiamonds'));
      return;
    }
    if (!engine.reviveAfterAd(REVIVE_SECONDS)) return;
    // the balance was checked a line above, so a refusal here would be a race, not a shortfall:
    // the revive is already granted and the diamonds stay with the player
    buyRevive();
    setDiamonds(diamondsBalance());
    setAdNotice(null);
  }, []);

  const playing = hud.phase === 'playing' || hud.phase === 'paused';

  return (
    <div className="responsive-ui relative h-full w-full overflow-hidden bg-pit-950 font-body text-white">
      {/* three.js canvas + engine fx layer mount here */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* soft colour grade over the world for a cohesive look */}
      <div
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(255,224,170,.05) 0%, rgba(0,0,0,0) 58%, rgba(4,10,14,.28) 100%)' }}
      />

      {playing && (
        <Hud
          hud={hud}
          dom={domRef.current}
          muted={muted}
          onPause={() => engineRef.current?.pause()}
          onMute={toggleMute}
          onSelect={selectSlot}
          onBag={openInventory}
          onCaptureMouse={captureMouse}
          isTouch={isTouch}
          showFps={import.meta.env.DEV && flags['ui.showFps'] !== 'false'}
        />
      )}

      {isTouch && hud.phase === 'playing' && !hud.inventoryOpen && <TouchControls engine={engine} />}

      {hud.phase === 'loading' && <LoadingScreen progress={hud.loading} />}
      {hud.phase === 'menu' && (
        // shopEnabled also asks tvMode() live: the platform may answer before the first render
        <StartScreen
          scores={scores}
          onPlay={play}
          onNewWorld={newWorld}
          music={music}
          onMusic={toggleMusic}
          muted={muted}
          onMute={toggleMute}
          freeLook={freeLook}
          onFreeLook={toggleFreeLook}
          isTouch={isTouch}
          lang={lang}
          onLang={pickLang}
          survival={survival}
          onMode={pickMode}
          hasSave={hasSave}
          onCreateWorld={createWorld}
          onContinueWorld={continueWorld}
          profile={profile}
          onSignIn={signIn}
          cloudSavedAt={cloudSavedAt}
          shopEnabled={SHOP_SCREENS_ENABLED && flags['shop.enabled'] !== 'false' && !isTv && !tvMode()}
          developerShopEnabled={false}
          diamonds={diamonds}
          shopPrices={shopPrices}
          onOpenShop={refreshShopCatalog}
          paymentsAvailable={canPay}
          rewardedAdsEnabled={rewardedAdsAvailable()}
          onBuyPack={buyPack}
          onBuyShopItem={buyInGameShopItem}
          onClaimRewardedDrop={claimShopDrop}
          onDeveloperClaim={grantDeveloperProduct}
          leaderboard={leaderboard}
          leaderboardBusy={lbBusy}
          leaderboardAvailable={lbAvailable}
          leaderboardCooldown={lbCooldown}
          onLoadLeaderboard={loadWorldRanking}
          canShortcut={canShortcut}
          onShortcut={addShortcut}
          shortcutNote={shortcutNote}
          promo={promo}
          onClaimDaily={addDaily}
          dailyBusy={dailyBusy}
          dailyNote={dailyNote}
          fullscreen={fullscreen}
          onFullscreen={toggleFull}
          character={characterCustomization}
          onSaveCharacter={saveCharacter}
        />
      )}
      {hud.phase === 'playing' && hud.inventoryOpen && (
        <Inventory
          hud={hud}
          onCraft={craft}
          onSelectSlot={selectSlot}
          onClose={closeInventory}
          onEquip={equip}
          onUnequip={unequip}
          onSell={sell}
          onBuy={buyOffer}
          onUpgrade={upgradeItem}
          onReinforce={reinforceItem}
          onRepairTool={repairTool}
          onSellTool={sellTool}
          onSellGear={sellGear}
          onPlaceItem={placeItem}
          onRemoveSlot={removeSlot}
          onSalvageGear={salvageGear}
          onSalvageItem={salvageItem}
          isTouch={isTouch}
        />
      )}
      {hud.phase === 'paused' && (
        <PauseScreen
          hud={hud}
          onResume={resume}
          onRestart={restart}
          onQuit={quit}
          onBag={openInventory}
          music={music}
          onMusic={toggleMusic}
          muted={muted}
          onMute={toggleMute}
          onSaveWorld={saveWorld}
        />
      )}
      {hud.phase === 'gameover' && (
        <GameOverScreen
          hud={hud}
          scores={scores}
          token={token}
          name={name}
          onName={changeName}
          onRestart={restart}
          onQuit={quit}
          isRecord={isRecord}
          onRevive={watchAdRevive}
          canRevive={revivesUsed < MAX_REVIVES_PER_RUN && flagBool('adv.enabled') && flagBool('adv.rewarded.enabled')}
          adBusy={adBusy}
          adNotice={adNotice}
          reviveSeconds={REVIVE_SECONDS}
          diamonds={diamonds}
          diamondPrice={REVIVE_DIAMOND_PRICE}
          onDiamondRevive={reviveWithDiamonds}
          myRank={myRank}
          squadNote={squadNote}
          onCopyResult={copyResult}
          copyNote={copyNote}
          canRate={canRate}
          onRate={rateGame}
          reviewNote={reviewNote}
        />
      )}
      {/* The leave dialog is the last overlay on purpose: on a TV the remote navigation picks the
          top-most dialog, so the answer buttons work even when another dialog is open behind it. The
          safe answer is marked as the preferred one — the first OK press never leaves the game. */}
      {exitPrompt && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
        >
          <div className="notch w-full max-w-sm border border-white/10 bg-gradient-to-b from-[#172126] to-[#0c1215] p-5 text-center">
            <h2 id="exit-title" className="font-display text-lg text-white sm:text-2xl">{t('exitTitle')}</h2>
            <p className="mt-1.5 text-[11px] text-white/50 sm:text-xs">{t('exitHint')}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  confirmExit();
                  setExitPrompt(false);
                }}
                className="btn-mc notch bg-gradient-to-b from-[#c9584f] to-[#8d3129] px-3 py-2.5 text-xs text-white sm:text-sm"
              >
                {t('exitConfirm')}
              </button>
              <button
                type="button"
                data-remote-primary
                onClick={() => {
                  dismissExit();
                  setExitPrompt(false);
                }}
                className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-3 py-2.5 text-xs text-white/85 sm:text-sm"
              >
                {t('exitStay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
