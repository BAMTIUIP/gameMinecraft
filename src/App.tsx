import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, RUN_TIME, SESSION_LENGTHS, type DomRefs, type HudState } from './game/engine';
import { initAudio, isMusicEnabled, isMuted, requestMusic, setMusicEnabled, setMuted, stopMusic } from './game/audio';
import Hud from './ui/Hud';
import TouchControls from './ui/TouchControls';
import { GameOverScreen, LoadingScreen, PauseScreen, StartScreen } from './ui/Screens';
import { loadPlayerName, loadScores, savePlayerName, submitScore, updateName, type ScoreEntry } from './ui/scores';
import Inventory from './ui/Inventory';
import { EMPTY_STATS, type Slot } from './game/items';
import { initLang, setLang, type Lang } from './game/i18n';
import {
  initYandex,
  yaGameplayStart,
  yaGameplayStop,
  yaLang,
  yaLoadingReady,
  yaOnPause,
  yaOnResume,
  yaServerTime,
} from './game/yandex';

const INITIAL_HUD: HudState = {
  phase: 'loading',
  loading: 0,
  score: 0,
  timeLeft: RUN_TIME,
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
  runTime: RUN_TIME,
  inventoryOpen: false,
  craftHint: null,
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
  sandbox: false,
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
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      return localStorage.getItem('orerush.session') || 'sprint';
    } catch {
      return 'sprint';
    }
  });
  const [freeLook, setFreeLookUi] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [lang, setLangUi] = useState<Lang>('en');
  const [survival, setSurvivalUi] = useState<boolean>(() => {
    try {
      return localStorage.getItem('orerush.mode') !== 'explorer';
    } catch {
      return true;
    }
  });

  const sessionSecs = SESSION_LENGTHS.find((s) => s.id === sessionId)?.time ?? RUN_TIME;

  useEffect(() => {
    if (!hostRef.current) return;
    setIsTouch(window.matchMedia?.('(pointer: coarse)').matches ?? false);
    setLangUi(initLang());

    // Yandex Games: auto-detect the user's language from the platform (rule 2.14).
    // An explicit in-game choice (saved in localStorage) always wins.
    void initYandex().then(() => {
      const platformLang = yaLang();
      if (!platformLang) return;
      let hasManualChoice = false;
      try {
        hasManualChoice = localStorage.getItem('orerush.lang') !== null;
      } catch {
        /* ignore */
      }
      if (!hasManualChoice) {
        const mapped: Lang =
          platformLang === 'ru' ? 'ru' : platformLang === 'fr' ? 'fr' : platformLang === 'de' ? 'de' : 'en';
        setLang(mapped);
        setLangUi(mapped);
      }
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
    eng.setRunTime(SESSION_LENGTHS.find((s) => s.id === sessionId)?.time ?? RUN_TIME);
    eng.setSurvival(survival);
    setFreeLookUi(eng.freeLookEnabled);
    setEngine(eng);

    const onKey = (e: KeyboardEvent) => {
      const e2 = e.code;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e2 === 'Escape' || e2 === 'KeyP') {
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

  const pickSession = useCallback((id: string) => {
    const s = SESSION_LENGTHS.find((x) => x.id === id);
    if (!s) return;
    setSessionId(id);
    try {
      localStorage.setItem('orerush.session', id);
    } catch {
      /* ignore */
    }
    engineRef.current?.setRunTime(s.time);
  }, []);

  const pickLang = useCallback((l: Lang) => {
    setLang(l);
    setLangUi(l);
  }, []);

  const pickMode = useCallback((s: boolean) => {
    setSurvivalUi(s);
    try {
      localStorage.setItem('orerush.mode', s ? 'survival' : 'explorer');
    } catch {
      /* ignore */
    }
    engineRef.current?.setSurvival(s);
  }, []);

  const equip = useCallback((uid: string) => engineRef.current?.equip(uid), []);
  const unequip = useCallback((slot: Slot) => engineRef.current?.unequip(slot), []);
  const sell = useCallback((id: number) => engineRef.current?.sellResource(id), []);
  const buyOffer = useCallback((i: number) => engineRef.current?.buyOffer(i), []);
  const upgradeItem = useCallback((uid: string) => engineRef.current?.upgradeToNetherite(uid), []);
  const reinforceItem = useCallback((uid: string) => engineRef.current?.reinforceItem(uid), []);
  const sellTool = useCallback((id: number) => engineRef.current?.sellTool(id), []);
  const sellGear = useCallback((uid: string) => engineRef.current?.sellGear(uid), []);
  // sparse hotbar: place any owned item into a slot (swap / evict), or remove it back
  const placeItem = useCallback(
    (id: number, slot?: number, fromSlot?: number) => engineRef.current?.placeInSlot(id, slot, fromSlot),
    [],
  );
  const removeSlot = useCallback((slot: number) => engineRef.current?.removeFromSlot(slot), []);
  const salvageGear = useCallback((uid: string) => engineRef.current?.salvageGear(uid), []);

  const toggleFreeLook = useCallback(() => {
    const next = !(engineRef.current?.freeLookEnabled ?? true);
    engineRef.current?.setFreeLook(next);
    setFreeLookUi(next);
  }, []);

  // Yandex Games lifecycle: ready() once the menu is interactive,
  // GameplayAPI.start/stop around actual play (rules 2.20 / gameplay signals).
  // Only phase 'playing' is gameplay. The pause menu AND the inventory / workbench / trader are 'paused': the
  // world is frozen there (shift timer and world clock stand still, see Engine.updateIdle), and the moderation
  // methodology (1.19.3) wants a red indicator for any menu or shop that takes the player out of the run.
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
      setScores(
        submitScore({
          name: name || 'MINER',
          score: hud.score,
          blocks: hud.blocksMined,
          tier: hud.tierName,
          depth: hud.deepest,
          combo: hud.bestCombo,
          runTime: hud.runTime,
          date: serverNow,
          token: t,
        }),
      );
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
    },
    [token],
  );

  const play = useCallback(() => {
    engineRef.current?.startRun(sessionSecs);
  }, [sessionSecs]);
  const restart = useCallback(() => {
    // restarting a sandbox stays a sandbox
    engineRef.current?.startRun(sessionSecs, engineRef.current?.sandbox ?? false);
  }, [sessionSecs]);
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

  const playing = hud.phase === 'playing' || hud.phase === 'paused';

  return (
    <div className="responsive-ui relative h-full w-full overflow-hidden bg-pit-950 font-body text-white">
      {/* three.js canvas + engine fx layer mount here */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* soft colour grade over the world for a cohesive look */}
      <div
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(255,214,150,.06) 0%, rgba(0,0,0,0) 55%, rgba(4,10,14,.42) 100%)' }}
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
        />
      )}

      {isTouch && hud.phase === 'playing' && <TouchControls engine={engine} />}

      {hud.phase === 'loading' && <LoadingScreen progress={hud.loading} />}
      {hud.phase === 'menu' && (
        <StartScreen
          scores={scores}
          onPlay={play}
          onNewWorld={newWorld}
          sessions={SESSION_LENGTHS}
          sessionId={sessionId}
          onSession={pickSession}
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
        />
      )}
      {hud.phase === 'paused' &&
        (hud.inventoryOpen ? (
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
            onSellTool={sellTool}
            onSellGear={sellGear}
            onPlaceItem={placeItem}
            onRemoveSlot={removeSlot}
            onSalvageGear={salvageGear}
            isTouch={isTouch}
          />
        ) : (
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
        ))}
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
