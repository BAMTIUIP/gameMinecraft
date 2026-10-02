import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, EXPLORATION_RUN_TIME, type DomRefs, type HudState } from './game/engine';
import { initAudio, isMusicEnabled, isMuted, requestMusic, setMusicEnabled, setMuted, stopMusic } from './game/audio';
import Hud from './ui/Hud';
import TouchControls from './ui/TouchControls';
import { GameOverScreen, LoadingScreen, PauseScreen, StartScreen } from './ui/Screens';
import { loadPlayerName, loadScores, savePlayerName, submitScore, updateName, type ScoreEntry } from './ui/scores';
import Inventory from './ui/Inventory';
import { EMPTY_STATS, type Slot } from './game/items';
import { getLang, initLang, setLang, type Lang } from './game/i18n';
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
import { addTotals, flushProfile, markProfileDirty, onProfileChange, startProfileSync, type ProfileSnapshot } from './game/profile';
import { allFlags, loadFlags } from './game/flags';
import { storageGet, storageSet } from './game/storage';

const INITIAL_HUD: HudState = {
  phase: 'loading',
  loading: 0,
  score: 0,
  timeLeft: EXPLORATION_RUN_TIME,
  health: 100,
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
  // Yandex profile: avatar/nick in the menu, cloud-progress notice, sign-in button
  const [profile, setProfile] = useState<YaProfile | null>(null);
  const [cloudSavedAt, setCloudSavedAt] = useState(0);
  // Remote config (ysdk.getFlags): rendered from the local configuration until the remote one lands
  const [flags, setFlags] = useState(() => allFlags());

  useEffect(() => {
    if (!hostRef.current) return;
    setIsTouch(window.matchMedia?.('(pointer: coarse)').matches ?? false);
    setLangUi(initLang());

    // Yandex Games: auto-detect the user's language from the platform (rule 2.14).
    // An explicit in-game choice (saved in safeStorage) always wins.
    void initYandex().then(async () => {
      const platformLang = yaLang();
      if (platformLang && storageGet('orerush.lang') === null) {
        const mapped: Lang =
          platformLang === 'ru' ? 'ru' : platformLang === 'fr' ? 'fr' : platformLang === 'de' ? 'de' : 'en';
        setLang(mapped);
        setLangUi(mapped);
      }
      // Cloud profile: pull records/settings made on another device and report our own progress.
      // Outside Yandex this resolves immediately with platform: null.
      const snapshot = await startProfileSync();
      setProfile(snapshot.platform);
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
    });
    const loaded = loadScores();
    setScores(loaded);
    bestRef.current = loaded[0]?.score ?? 0;
    setName(loadPlayerName());
    setMutedUi(isMuted());
    setMusicUi(isMusicEnabled());
    setHasSave(Engine.hasSavedWorld());

    const eng = new Engine(hostRef.current, setHud);
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
    const offYaPause = yaOnPause(() => eng.systemPause());
    const offYaResume = yaOnResume(() => eng.systemResume());
    return () => {
      offYaPause();
      offYaResume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('keydown', onKey);
      eng.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** shift length of explore mode: a remote-config knob (flag game.exploreMinutes) */
  const exploreSeconds = Math.max(60, Math.round((Number(flags['game.exploreMinutes']) || 20) * 60));

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
  }, []);

  const pickMode = useCallback((s: boolean) => {
    setSurvivalUi(s);
    storageSet('orerush.mode', s ? 'survival' : 'explorer');
    // the chosen mode travels to the cloud, so another device opens the same way
    markProfileDirty({ mode: s ? 'survival' : 'explorer' });
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
      const t = `run-${serverNow}-${Math.floor(Math.random() * 1e6)}`;
      setToken(t);
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
        token: t,
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
    },
    [token],
  );

  const play = useCallback(() => {
    engineRef.current?.startRun(survival ? undefined : exploreSeconds);
  }, [survival, exploreSeconds]);
  const restart = useCallback(() => {
    // restarting a sandbox stays a sandbox; survival itself is endless too
    engineRef.current?.startRun(survival ? undefined : exploreSeconds, engineRef.current?.sandbox ?? false);
  }, [survival, exploreSeconds]);
  const createWorld = useCallback(() => {
    engineRef.current?.startRun(undefined, true);
    setHasSave(Engine.hasSavedWorld());
  }, []);
  const continueWorld = useCallback(() => {
    if (engineRef.current?.loadWorld()) setHasSave(true);
  }, []);
  const saveWorld = useCallback(() => {
    if (engineRef.current?.saveWorld()) setHasSave(true);
  }, []);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const quit = useCallback(() => engineRef.current?.toMenu(), []);
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

  // leaving the tab (or the platform pausing us) is the last safe moment to push progress
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) void flushProfile(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

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
          showFps={flags['ui.showFps'] !== 'false'}
        />
      )}

      {isTouch && hud.phase === 'playing' && !hud.inventoryOpen && <TouchControls engine={engine} />}

      {hud.phase === 'loading' && <LoadingScreen progress={hud.loading} />}
      {hud.phase === 'menu' && (
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
          shopEnabled={flags['shop.enabled'] !== 'false'}
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
        />
      )}
    </div>
  );
}
