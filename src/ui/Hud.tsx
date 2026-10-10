import { useEffect, useRef, useState } from 'react';
import type { DomRefs, HudState, TutorialIcon } from '../game/engine';
import { PICKAXE_TIERS } from '../game/blocks';
import { getBlockIcon } from '../game/textures';
import {
  AxeIcon,
  BagIcon,
  BowIcon,
  ClockIcon,
  DepthIcon,
  HeartIcon,
  HoeIcon,
  MoonIcon,
  PauseIcon,
  PickIcon,
  PlayIcon,
  ShovelIcon,
  SkullIcon,
  SoundIcon,
  SunIcon,
  SwordIcon,
} from './icons';
import {
  HAND,
  TOOL_PICK,
  TOOL_TORCH,
} from '../game/recipes';
import { gearColor, isGearHotbarId, RARITY } from '../game/items';
import { formatObjectiveTitle, t } from '../game/i18n';
import { getToolSpec } from '../game/tools';
import { DurabilityBar, ToolSprite } from './ToolSprite';
import { GearIcon } from './GearIcon';

const RING = 2 * Math.PI * 22;

function fmtTime(t: number) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function objectiveReward(score: number, seconds: number) {
  return t('objectiveReward')
    .replace('{score}', String(score))
    .replace('{time}', fmtTime(seconds));
}

function TutorialGlyph({ icon, color }: { icon: TutorialIcon; color: string }) {
  const props = { size: 20, style: { color } };
  switch (icon) {
    case 'pickaxe': return <PickIcon {...props} />;
    case 'sword': return <SwordIcon {...props} />;
    case 'bow': return <BowIcon {...props} />;
    case 'axe': return <AxeIcon {...props} />;
    case 'shovel': return <ShovelIcon {...props} />;
    case 'hoe': return <HoeIcon {...props} />;
    case 'anvil': return <span className="font-display text-xl leading-none" style={{ color }}>⚒</span>;
    case 'ladder': return <span className="font-display text-xl leading-none" style={{ color }}>↕</span>;
    case 'trader': return <span className="font-display text-lg leading-none" style={{ color }}>⇄</span>;
    case 'workbench': return <span className="font-display text-lg leading-none" style={{ color }}>▦</span>;
  }
}

type Props = {
  hud: HudState;
  dom: DomRefs;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
  onSelect: (i: number) => void;
  onBag: () => void;
  onCaptureMouse: () => void;
  isTouch: boolean;
  /** remote-config flag ui.showFps */
  showFps: boolean;
};

export default function Hud({ hud, dom, muted, onPause, onMute, onSelect, onBag, onCaptureMouse, isTouch, showFps }: Props) {
  const scoreRef = useRef<HTMLDivElement>(null);
  const prevScore = useRef(hud.score);
  const [bump, setBump] = useState(0);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    if (hud.score !== prevScore.current) {
      prevScore.current = hud.score;
      setBump((b) => b + 1);
    }
  }, [hud.score]);

  useEffect(() => {
    setHint(true);
    const t = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(t);
  }, [hud.phase, hud.thirdPerson]);

  const controlsHint = isTouch
    ? hud.thirdPerson
      ? `${t('hintTouch')} · ${t('cameraOrbitTouch')}`
      : t('hintTouch')
    : hud.thirdPerson
      ? `${t('hintDesktop')} · ${t('cameraOrbitMouse')}`
      : t('hintDesktop');
  const endless = hud.sandbox || hud.endless;
  const urgent = hud.timeLeft <= 15 && !endless;
  const night = hud.phaseName === 'night';
  const tierColor = PICKAXE_TIERS[hud.tier].color;
  const hpColor =
    hud.health > 60
      ? 'from-[#5f9c33] to-moss'
      : hud.health > 30
        ? 'from-[#c9761f] to-torch'
        : 'from-[#8f1c14] to-blood';
  const hungerColor = hud.hunger > 30 ? 'from-[#d98c42] to-[#f4c15d]' : 'from-[#c94c45] to-[#ef735f]';
  const staminaColor =
    hud.stamina > 60
      ? 'from-[#5f9c33] to-moss'
      : hud.stamina > 30
        ? 'from-[#c9761f] to-torch'
        : 'from-[#8f1c14] to-blood';

  const underwater = hud.headUnderwater;
  return (
    <div className={`pointer-events-none absolute inset-0 z-20 select-none font-body ${isTouch ? 'hud-touch' : ''}`}>
      {/* damage / hazard vignette */}
      <div
        ref={(el) => {
          dom.vignette = el;
        }}
        className="absolute inset-0 opacity-0"
        style={{ transition: 'opacity 90ms linear' }}
      />
      {/* underwater blue filter — shows water boundary, only when head is underwater */}
      {underwater && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 40%, rgba(40,140,220,0.18) 0%, rgba(10,70,140,0.30) 55%, rgba(5,35,80,0.42) 100%)`,
            pointerEvents: 'none',
            transition: 'opacity 200ms ease',
          }}
        />
      )}

      {/* ---------------- TOP LEFT: vitals + mission ---------------- */}
      <div className="hud-information hud-information--top-left absolute left-2 top-2 flex flex-col gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
        <div className="hud-health-panel bevel-flat notch flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
          <HeartIcon size={16} className="text-blood drop-shadow-[0_0_6px_rgba(226,86,74,.7)]" />
          <div className="sunken relative h-3.5 w-28 overflow-hidden sm:h-4 sm:w-44">
            <div
              ref={(el) => {
                dom.healthBar = el;
              }}
              className={`absolute inset-y-0 left-0 w-full bg-gradient-to-r ${hpColor}`}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'repeating-linear-gradient(90deg, transparent 0 15px, rgba(0,0,0,.6) 15px 17px)' }}
            />
          </div>
          <span className="font-display text-sm leading-none text-white/85 sm:text-base">{hud.health}</span>
        </div>

        <div className="hud-hunger-panel bevel-flat notch -mt-1 flex h-5 items-center gap-2 px-2 sm:h-6 sm:gap-3" role="progressbar" aria-label="Hunger" aria-valuenow={hud.hunger} title={`Голод: ${hud.hunger}%`}>
          <span className="text-sm" aria-hidden="true">🍖</span>
          <div className="sunken relative h-2 w-28 shrink-0 overflow-hidden sm:h-2.5 sm:w-44"><div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${hungerColor}`} style={{ width: `${hud.hunger}%` }} /></div>
          <span className="font-display text-[10px] text-white/70">{hud.hunger}</span>
        </div>

        <div
          className="hud-stamina-panel bevel-flat notch -mt-1 flex h-5 items-center gap-2 px-2 sm:h-6 sm:gap-3 sm:px-3"
          role="progressbar"
          aria-label={t('stamina')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hud.stamina)}
          aria-valuetext={`${Math.round(hud.stamina)}%`}
          title={`${t('stamina')}: ${Math.round(hud.stamina)}%`}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#62e8dc]" aria-hidden="true">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
              <path d="M9.4 1.2 3.2 8.7h4L6.5 14.8l6.3-8.1H8.6z" fill="currentColor" />
            </svg>
          </span>
          <div className="sunken relative h-2 w-28 shrink-0 overflow-hidden sm:h-2.5 sm:w-44">
            <div
              ref={(el) => {
                dom.staminaBar = el;
              }}
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${staminaColor}`}
              style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'repeating-linear-gradient(90deg, transparent 0 15px, rgba(0,0,0,.5) 15px 17px)' }}
            />
          </div>
          <span className="shrink-0 font-display text-[10px] leading-none tabular-nums text-white/65 sm:text-[9px]">{Math.round(hud.stamina)}%</span>
        </div>

        {/* position + a compass needle that points home */}
        <div className="hud-vitals-coordinates bevel-flat notch flex items-center gap-2 px-2 py-1 text-[11px] tracking-widest text-white/50 sm:px-3">
          <span className="relative flex h-4 w-4 items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-torch"
              ref={(el) => {
                dom.compass = el as unknown as HTMLElement | null;
              }}
              style={{ transformOrigin: '50% 50%' }}
            >
              <path d="M12 2l4.5 13L12 12.2 7.5 15z" fill="currentColor" />
              <path d="M12 22l-4.5-7L12 17.5 16.5 15z" fill="currentColor" opacity="0.35" />
            </svg>
          </span>
          <span
            className="font-display text-xs tabular-nums text-white/75 sm:text-sm"
            ref={(el) => {
              dom.coords = el;
            }}
          >
            0 · 0 · 0
          </span>
        </div>

        <div className="hud-vitals-stats bevel-flat notch flex items-center gap-2 px-2 py-1 text-[11px] tracking-widest text-white/60 sm:px-3 sm:text-xs">
          <DepthIcon size={14} className="text-copper" />
          <span>
            {t('depth')} <b className="font-display text-sm text-torch sm:text-base">{hud.deepest}</b>
          </span>
          <span className="mx-1 h-3 w-px bg-white/15" />
          <span>
            {t('ores')} <b className="font-display text-sm text-ore sm:text-base">{hud.oresFound}</b>
          </span>
          {hud.survival && (
            <>
              <span className="mx-1 h-3 w-px bg-white/15" />
              <span className="flex items-center gap-1">
                <SkullIcon size={11} className="text-blood" />
                <b className="font-display text-sm text-white/90">{hud.kills}</b>
              </span>
            </>
          )}
          <span className="mx-1 hidden h-3 w-px bg-white/15 sm:block" />
          <span className="hidden sm:inline">
            {t('mined')} <b className="font-display text-sm text-white/90">{hud.blocksMined}</b>
          </span>
        </div>

        {hud.objectiveCount > 0 && hud.phase !== 'menu' && (
          <section
            aria-label={t('objectivePanelTitle')}
            className="hud-objective-panel pointer-events-auto relative mt-1 w-[min(20rem,calc(100vw-1rem))] border border-[#8c7549]/60 bg-[#101611]/90 p-2 shadow-[0_8px_26px_rgba(0,0,0,.5)] backdrop-blur-sm sm:w-80 sm:p-2.5"
          >
            <header className="mb-1.5 flex items-center justify-between gap-2 border-b border-white/10 pb-1">
              <span className="font-display text-[9px] tracking-[0.18em] text-[#f4b942] sm:text-[10px]">
                {t('objectivePanelTitle')}
              </span>
              <span className="text-[9px] text-white/50">
                {hud.objectiveIndex >= hud.objectiveCount
                  ? t('objectiveAllComplete')
                  : t('objectiveTaskCounter')
                      .replace('{current}', String(hud.objectiveIndex + 1))
                      .replace('{total}', String(hud.objectiveCount))}
              </span>
            </header>
            <div className="flex flex-col gap-1.5">
              {hud.explorationObjectives.map((objective) => (
                <div
                  key={objective.id}
                  className={`hud-objective-row hud-objective-row--${objective.status} border-l-2 pl-2 ${
                    objective.status === 'active'
                      ? 'border-[#93c95d] bg-[#93c95d]/[0.07]'
                      : objective.status === 'complete'
                        ? 'border-[#93c95d]/45 opacity-70'
                        : 'border-white/15 opacity-45'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <span className={`mt-px text-[10px] leading-tight ${objective.status === 'complete' ? 'text-[#93c95d]' : objective.status === 'active' ? 'text-[#f4b942]' : 'text-white/40'}`}>
                      {objective.status === 'complete' ? '✓' : objective.status === 'active' ? '◆' : '◇'}
                    </span>
                    <span className="min-w-0 flex-1 text-[10px] leading-tight text-white/85 sm:text-[11px]">
                      {formatObjectiveTitle(objective.titleKey, objective.target)}
                    </span>
                    {objective.status !== 'locked' && (
                      <span className="shrink-0 font-display text-[9px] tabular-nums text-white/70">
                        {objective.progress}/{objective.target}
                      </span>
                    )}
                  </div>
                  <div className="hud-objective-reward ml-4 mt-0.5 font-display text-[8px] tracking-wide text-white/45 sm:text-[9px]">
                    {objectiveReward(objective.rewardScore, objective.rewardSeconds)}
                  </div>
                  {objective.status === 'active' && (
                    <div className="hud-objective-progress sunken ml-4 mt-1 h-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#6b9e41] to-[#b5d86e] transition-[width] duration-200"
                        style={{ width: `${Math.min(100, (objective.progress / objective.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {hud.tutorialTip && hud.phase === 'playing' && (
          <div
            key={hud.tutorialTip.key}
            role="status"
            aria-live="polite"
            className="hud-tutorial-panel anim-pop pointer-events-auto relative mt-1 flex w-[min(19rem,calc(100vw-1rem))] items-start gap-2.5 bevel-flat notch border-l-4 bg-[#101712]/95 px-2.5 py-2 shadow-[0_8px_26px_rgba(0,0,0,.55)] sm:w-72"
            style={{ borderLeftColor: hud.tutorialTip.color }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-black/35">
              <TutorialGlyph icon={hud.tutorialTip.icon} color={hud.tutorialTip.color} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[10px] tracking-[0.2em]" style={{ color: hud.tutorialTip.color }}>
                {hud.tutorialTip.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-white/75 sm:text-xs">
                {hud.tutorialTip.body}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ---------------- TOP CENTER: clock + combo ---------------- */}
      <div className="hud-information hud-information--top-center absolute left-1/2 top-2 flex -translate-x-1/2 flex-col items-center gap-1 sm:top-4">
        <div className={`bevel-flat notch flex items-center gap-2 px-3 py-1 sm:gap-3 sm:px-4 sm:py-1.5 ${urgent ? 'anim-ring' : ''}`}>
          <ClockIcon size={15} className={urgent ? 'text-blood' : 'text-torch'} />
          <span
            className={`font-display text-2xl leading-none tabular-nums sm:text-3xl ${urgent ? 'text-blood' : 'text-white'}`}
            style={{ textShadow: urgent ? '0 0 12px rgba(226,86,74,.8)' : '2px 2px 0 rgba(0,0,0,.8)' }}
          >
            {endless ? '∞' : fmtTime(hud.timeLeft)}
          </span>
        </div>
        {/* day / night indicator */}
        <div
          className="bevel-flat notch flex items-center gap-1.5 px-2 py-0.5"
          style={{ borderColor: night ? '#3f5a99' : '#c98b2e' }}
        >
          {night ? <MoonIcon size={11} className="text-[#a8c0ff]" /> : <SunIcon size={11} className="text-torch" />}
          <span className="font-display text-[10px] tracking-widest" style={{ color: night ? '#a8c0ff' : '#f4b942' }}>
            {t(hud.phaseName)}
          </span>
          {hud.survival && night && <span className="anim-flicker text-[9px] text-blood">☠</span>}
        </div>
        <div className="sunken h-1.5 w-28 overflow-hidden sm:w-40">
            <div
              ref={(el) => {
                dom.timeBar = el;
              }}
              className={`h-full w-full ${urgent ? 'bg-blood stripes' : 'bg-torch'}`}
            />
        </div>

        {hud.combo > 1 && (
          <div key={hud.combo} className="anim-pop mt-0.5 flex items-center gap-2">
            <span
              className="font-display text-2xl leading-none sm:text-3xl"
              style={{ color: hud.comboMult > 3 ? '#f7d34b' : hud.comboMult > 2 ? '#5fe8dc' : '#93c95d', textShadow: '2px 2px 0 #05080a' }}
            >
              {t('combo')} x{hud.combo}
            </span>
            <span className="font-display text-base text-white/70">({hud.comboMult.toFixed(2)}x)</span>
          </div>
        )}
        {hud.combo > 1 && (
          <div className="sunken h-1 w-24 overflow-hidden sm:w-32">
            <div
              ref={(el) => {
                dom.comboBar = el;
              }}
              className="h-full w-full origin-left bg-moss"
            />
          </div>
        )}
      </div>

      {/* ---------------- TOP RIGHT: score + tier + buttons + squad ---------------- */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4 sm:gap-2">
        <div className="hud-information hud-information--top-right flex flex-col items-end gap-1.5 sm:gap-2">
          <div className="bevel-flat notch px-3 py-1 text-right sm:px-4 sm:py-2">
            <div className="text-[9px] tracking-[0.28em] text-white/45 sm:text-[10px]">{t('score').toUpperCase()}</div>
            <div
              key={bump}
              ref={scoreRef}
              className={`font-display text-3xl leading-none tabular-nums text-torch sm:text-4xl ${bump ? 'anim-bump' : ''}`}
              style={{ textShadow: '0 0 16px rgba(244,185,66,.35), 2px 2px 0 #05080a' }}
            >
              {hud.score.toLocaleString()}
            </div>
            {(hud.scoreBoost > 1.01 || hud.oreBoost > 1.01) && (
              <div className="mt-1 flex justify-end gap-1">
                {hud.scoreBoost > 1.01 && (
                  <span className="rounded bg-[#bd8cff]/20 px-1 py-0.5 font-display text-[8px] text-[#bd8cff]">SCORE x{hud.scoreBoost.toFixed(2)}</span>
                )}
                {hud.oreBoost > 1.01 && (
                  <span className="rounded bg-[#62e8dc]/20 px-1 py-0.5 font-display text-[8px] text-[#62e8dc]">ORE x{hud.oreBoost.toFixed(1)}</span>
                )}
              </div>
            )}
          </div>

          <div className="bevel-flat notch flex items-center gap-2 px-2 py-1 sm:px-3">
            <PickIcon size={16} style={{ color: tierColor }} className="drop-shadow" />
            <span className="font-display text-sm leading-none sm:text-base" style={{ color: tierColor }}>
              {hud.tierName}
            </span>
            <span className="font-display text-[11px] text-white/40">{PICKAXE_TIERS[hud.tier].speed.toFixed(1)}x</span>
          </div>

          {/* teammates from asynchronous multiplayer sessions (survival co-op, up to five) */}
          {hud.squad.length > 0 && (hud.phase === 'playing' || hud.phase === 'paused') && (
            <section
              aria-label={t('squadTitle')}
              className="bevel-flat notch w-[11.5rem] px-2 py-1.5 text-left sm:w-48"
            >
              <div className="mb-1 flex items-center gap-1.5 font-display text-[9px] tracking-[0.2em] text-[#62e8dc] sm:text-[10px]">
                <span aria-hidden="true">◆</span> {t('squadTitle')}
                <span className="ml-auto text-white/35">{hud.squad.length + 1}</span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {hud.squad.map((mate) => (
                  <li key={mate.id} className="flex items-center gap-1.5 text-[10px] sm:text-[11px]">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0"
                      style={{ background: mate.health > 50 ? '#7fe06a' : mate.health > 25 ? '#e8c14a' : '#e2564a' }}
                    />
                    <span className="min-w-0 flex-1 truncate font-display tracking-wide text-white/85">{mate.name}</span>
                    <span className={`shrink-0 text-[7px] tracking-wide ${mate.kind === 'bot' ? 'text-white/35' : 'text-[#62e8dc]/55'}`}>
                      {t(mate.kind === 'bot' ? 'squadLocalBot' : 'squadReplay')}
                    </span>
                    {mate.dead ? (
                      <span className="shrink-0 text-[8px] tracking-widest text-blood">{t('squadDead')}</span>
                    ) : mate.finished ? (
                      <span className="shrink-0 text-[8px] tracking-widest text-torch">{t('squadFinished')}</span>
                    ) : (
                      <span className="shrink-0 font-display tabular-nums text-white/45">
                        {t('squadBlocks').replace('{n}', String(mate.blocks))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="pointer-events-auto flex gap-1.5">
          <button
            onClick={onBag}
            className="bevel-flat notch relative flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-torch active:scale-95 sm:h-9 sm:w-9"
            aria-label={t('bag')}
            title={`${t('bag')} (TAB / I)`}
          >
            <BagIcon size={17} />
          </button>
          <button
            onClick={onMute}
            className="bevel-flat notch flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-torch active:scale-95 sm:h-9 sm:w-9"
            aria-label={muted ? t('sfxOn') : t('sfxOff')}
            title={`${muted ? t('sfxOn') : t('sfxOff')} (M)`}
          >
            <SoundIcon muted={muted} size={17} />
          </button>
          <button
            onClick={onPause}
            className="bevel-flat notch flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-torch active:scale-95 sm:h-9 sm:w-9"
            aria-label={t('pause')}
          >
            <PauseIcon size={15} />
          </button>
        </div>
      </div>

      {/* ---------------- CENTER: crosshair + target ---------------- */}
      <div className="hud-information hud-information--center absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <div
          className="ring-p relative h-16 w-16"
          ref={(el) => {
            dom.progress = el;
          }}
        >
          <svg viewBox="0 0 60 60" className="absolute inset-0">
            <circle
              cx="30"
              cy="30"
              r="22"
              fill="none"
              stroke="rgba(244,185,66,.95)"
              strokeWidth="3.5"
              strokeLinecap="butt"
              strokeDasharray={RING}
              style={{ strokeDashoffset: `calc(${RING} * (1 - var(--p)))`, transform: 'rotate(-90deg)', transformOrigin: '30px 30px' }}
            />
          </svg>
          <div
            ref={(el) => {
              dom.crosshair = el;
            }}
            className="absolute left-1/2 top-1/2 h-5 w-5"
            style={{ transform: 'translate(-50%,-50%)', transition: 'opacity 120ms linear' }}
          >
            <div className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-white/90 mix-blend-difference" />
            <div className="absolute bottom-0 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-white/90 mix-blend-difference" />
            <div className="absolute left-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-white/90 mix-blend-difference" />
            <div className="absolute right-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-white/90 mix-blend-difference" />
          </div>
        </div>
        {hud.target && (
          <div className="mt-1 font-display text-xs tracking-wide text-white/80 text-shadow-hard sm:text-sm">{hud.target.name}</div>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 font-display text-[10px] tracking-widest text-torch/80 text-shadow-hard">
          {hud.heldKind !== 'fist' && <span>{hud.heldName}</span>}
          {hud.heldKind !== 'fist' && !isTouch && (
            <span className="rounded bg-black/50 px-1 py-0.5 text-[8px] text-white/60">[{t('drop_hint')}]</span>
          )}
        </div>
      </div>

      {/* ---------------- BANNER ---------------- */}
      {hud.banner && (
        <div key={hud.banner.key} className="hud-information hud-information--banner anim-banner absolute left-1/2 top-[19%] -translate-x-1/2 text-center">
          <div className="font-display text-3xl leading-none sm:text-5xl" style={{ color: hud.banner.color, textShadow: '3px 3px 0 #05080a, 0 0 26px rgba(0,0,0,.6)' }}>
            {hud.banner.text}
          </div>
          <div className="mt-1 text-[11px] font-medium tracking-[0.2em] text-white/75 text-shadow-hard sm:text-xs">{hud.banner.sub}</div>
        </div>
      )}

      {/* ---------------- BREATH ---------------- */}
      <div
        className={`hud-breath absolute left-1/2 flex flex-col items-center gap-0.5 bevel-flat notch bg-[#07151c]/90 px-2 py-1 ${hud.breathVisible ? 'hud-breath--visible' : ''} ${hud.airBubbles === 0 ? 'hud-breath--critical' : ''}`}
        role={hud.breathVisible ? 'status' : undefined}
        aria-hidden={!hud.breathVisible}
        aria-label={`${t('air')}: ${hud.airBubbles} / 6`}
      >
        <span className="font-display text-[9px] tracking-widest text-[#a8e5ff]">{t('air')}</span>
        <span className="flex items-center gap-0.5">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`hud-breath-bubble ${i < hud.airBubbles ? 'hud-breath-bubble--full' : 'hud-breath-bubble--empty'}`}>
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="9" cy="9" r="7" />
                <path d="M6.1 6.3c.5-1.3 1.4-1.9 2.5-2" />
                <circle cx="12.8" cy="11.7" r=".8" className="hud-breath-bubble-shine" />
              </svg>
            </span>
          ))}
        </span>
      </div>

      {/* ---------------- HOTBAR ---------------- */}
      <div
        className={`hud-hotbar absolute left-1/2 origin-bottom ${
          isTouch ? 'bottom-44' : 'bottom-4 sm:bottom-6'
        }`}
      >
        <div className="hotbar-row pointer-events-auto">
          {/* always render 10 fixed cells; empty ones are dim placeholders */}
          {Array.from({ length: 10 }, (_, i) => hud.hotbar[i] ?? null).map((slot, i) =>
            slot === null ? (
              <div
                key={`empty-${i}`}
                data-hotbar-index={i}
                className="hotbar-cell notch relative flex items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg,#141c17,#0c1210)',
                  border: '3px solid #06090a',
                  boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.03), inset -2px -2px 0 rgba(0,0,0,.4)',
                  opacity: 0.55,
                }}
              >
                <span className="absolute left-0.5 top-0 font-display text-[9px] leading-none text-white/25">
                  {i === 9 ? 0 : i + 1}
                </span>
              </div>
            ) : (
              renderSlot(slot, i)
            ),
          )}
        </div>
      </div>

      {/* ---------------- HINT STACK (above the hotbar) ---------------- */}
      <div
        className={`hud-information hud-information--hint absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 ${isTouch ? 'bottom-60' : 'bottom-24'}`}
      >
        {!isTouch && (hud.petEquippedKind === 'parrot' || hud.petEquippedKind === 'owl') && hud.phase === 'playing' && (
          <div data-parrot-whistle className="anim-pop bevel-flat notch flex items-center gap-2 px-3 py-1.5" style={{ borderColor: hud.petEquippedKind === 'owl' ? '#d9a74a' : '#53c7a4' }}>
            <kbd className="rounded bg-black/45 px-1.5 py-0.5 font-display text-[10px]" style={{ color: hud.petEquippedKind === 'owl' ? '#f4d28c' : '#8ce2c4' }}>B</kbd>
            <span className="font-display text-xs tracking-widest sm:text-sm" style={{ color: hud.petEquippedKind === 'owl' ? '#fde6b8' : '#b4f0d9' }}>{t(hud.petEquippedKind === 'owl' ? 'petOwlWhistle' : 'petParrotWhistle')}</span>
          </div>
        )}
        {!isTouch && hud.petInteractNear && hud.phase === 'playing' && (
          <div data-pet-interact className="anim-pop bevel-flat notch flex items-center gap-2 px-3 py-1.5" style={{ borderColor: '#c59b66' }}>
            <kbd className="rounded bg-black/45 px-1.5 py-0.5 font-display text-[10px] text-torch">E</kbd>
            <span className="font-display text-xs tracking-widest text-[#f3d49a] sm:text-sm">{t(hud.petEquippedKind === 'parrot' ? 'petParrotInteract' : hud.petEquippedKind === 'owl' ? 'petOwlInteract' : 'petInteract')}</span>
          </div>
        )}
        {hud.tradeNear && hud.phase === 'playing' && (
          <div className="anim-pop bevel-flat notch flex items-center gap-2 px-3 py-1.5" style={{ borderColor: '#d98cff' }}>
            <span className="font-display text-xs tracking-widest text-[#d98cff] sm:text-sm">{t('pressTrade')}</span>
          </div>
        )}
        {/* Controls hint. On a tall portrait (9:16) screen this black plate sits right over the
            action in the middle of the view, and on touch it only repeats what the always-visible
            control buttons already say — so it is hidden in portrait orientation. Landscape keeps it. */}
        {hint && (
          <div className="bevel-flat notch anim-rise px-3 py-1.5 text-center text-[10px] tracking-[0.16em] text-white/55 portrait:hidden sm:text-xs">
            {controlsHint}
          </div>
        )}

        {!isTouch && !hud.locked && !hud.lockFailed && (
          <button
            onClick={onCaptureMouse}
            className="pointer-events-auto bevel-flat notch anim-pop flex items-center gap-2 px-4 py-2 font-display text-sm tracking-widest text-torch transition hover:brightness-125"
          >
            <PlayIcon size={14} /> {t('captureMouse')}
          </button>
        )}

        {!isTouch && hud.lockFailed && (
          <div className="bevel-flat notch px-3 py-1.5 text-center text-[10px] tracking-[0.16em] text-white/45">
            {hud.freeLook ? (
              <>
                <span className="text-torch">{t('freeLookTurn')}</span> · <span className="text-torch">{t('fPlace')}</span> ·{' '}
                <span className="text-torch">{t('rmbAim')}</span>
              </>
            ) : (
              <>
                <span className="text-torch">{t('holdRmbLook')}</span> · <span className="text-torch">{t('fMmbPlace')}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---------------- FPS (remote-config flag ui.showFps) ---------------- */}
      {showFps && <div className="hud-information hud-information--fps absolute bottom-1 right-2 font-display text-[10px] text-white/25">{hud.fps} FPS</div>}
    </div>
  );

  function renderSlot(slot: { id: number; count: number; durability?: number; maxDurability?: number }, i: number) {
    const toolSpec = getToolSpec(slot.id);
    const durability = slot.durability ?? toolSpec?.maxDurability ?? 0;
    const maxDurability = slot.maxDurability ?? toolSpec?.maxDurability ?? 0;
    return (
            <button
              key={`hotbar-${i}`}
              data-hotbar-index={i}
              onClick={() => onSelect(i)}
              className={`hotbar-cell hotbar-slot notch relative flex items-center justify-center ${
                i === hud.selected ? 'active' : ''
              }`}
              style={{
                background: i === hud.selected ? 'linear-gradient(180deg,#3d5145,#22302a)' : 'linear-gradient(180deg,#1b241f,#101713)',
                border: `3px solid ${i === hud.selected ? PICKAXE_TIERS[hud.tier].color : '#06090a'}`,
                boxShadow:
                  i === hud.selected
                    ? 'inset 2px 2px 0 rgba(255,255,255,.2), inset -2px -2px 0 rgba(0,0,0,.4), 0 0 16px rgba(244,185,66,.35)'
                    : 'inset 2px 2px 0 rgba(255,255,255,.07), inset -2px -2px 0 rgba(0,0,0,.45)',
              }}
            >
              {slot.id === HAND ? (
                <span className="flex h-6 w-6 items-center justify-center text-xl sm:h-9 sm:w-9 sm:text-2xl" title={t('emptyHand')}>
                  ✊
                </span>
              ) : isGearHotbarId(slot.id) ? (
                (() => {
                  const gear = hud.bagItems.find((b) => b.hid === slot.id);
                  const matCol = gear ? gearColor(gear) : '#d6d9dd';
                  const rarCol = gear ? RARITY[gear.rarity].color : '#b6c2b8';
                  return (
                    <span className="flex flex-col items-center justify-center leading-none" style={{ color: matCol }}>
                      {gear ? (
                        <GearIcon slot={gear.slot} color={matCol} affixes={gear.affixes} size={28} className="drop-shadow-[0_0_5px_rgba(255,255,255,.18)]" />
                      ) : (
                        <span className="text-base sm:text-xl" style={{ textShadow: `0 0 8px ${rarCol}` }}>⛨</span>
                      )}
                      {gear && (
                        <span className="font-display text-[8px] sm:text-[9px]" style={{ color: rarCol }}>
                          +{gear.armor}
                        </span>
                      )}
                    </span>
                  );
                })()
              ) : (toolSpec || slot.id === TOOL_TORCH) ? (
                <span className="flex h-6 w-6 items-center justify-center sm:h-9 sm:w-9">
                  {slot.id === TOOL_TORCH ? (
                    <span className="anim-flicker text-xl leading-none" style={{ color: '#ffb03a' }}>
                      ⨙
                    </span>
                  ) : (
                    <ToolSprite id={slot.id} size={24} durability={durability} />
                  )}
                </span>
              ) : (
                <img src={getBlockIcon(slot.id)} alt="" className="pixelated h-6 w-6 sm:h-9 sm:w-9" draggable={false} />
              )}
              {toolSpec && maxDurability > 0 && (
                <DurabilityBar
                  current={durability}
                  max={maxDurability}
                  className="absolute bottom-[2px] left-1 right-1 h-[2px]"
                  title={`${durability}/${maxDurability}`}
                />
              )}
              {toolSpec && maxDurability <= 0 && (
                <span className="absolute bottom-0.5 left-1 font-display text-[8px] leading-none text-[#ff8a5a]">∞</span>
              )}
              <span className="absolute bottom-0 right-0.5 font-display text-[11px] leading-none text-white text-shadow-hard sm:text-xs">
                {slot.id === HAND || slot.id >= TOOL_PICK ? '' : slot.count}
              </span>
              <span className="absolute left-0.5 top-0 font-display text-[9px] leading-none text-white/35">
                {i === 9 ? 0 : i + 1}
              </span>
            </button>
    );
  }
}
