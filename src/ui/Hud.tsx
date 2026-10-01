import { useEffect, useRef, useState } from 'react';
import type { DomRefs, HudState } from '../game/engine';
import { PICKAXE_TIERS } from '../game/blocks';
import { getBlockIcon } from '../game/textures';
import {
  AxeIcon,
  HoeIcon,
  BagIcon,
  BowIcon,
  ClockIcon,
  ShovelIcon,
  DepthIcon,
  HeartIcon,
  MoonIcon,
  PauseIcon,
  PickIcon,
  PlayIcon,
  SkullIcon,
  SoundIcon,
  SunIcon,
  SwordIcon,
} from './icons';
import {
  HAND,
  TOOL_BOW,
  TOOL_PICK,
  TOOL_TORCH,
  isHoeTool,
  isPickTool,
  isShovelTool,
  isSwordTool,
  isAxeTool,
} from '../game/recipes';
import { isGearHotbarId, MATERIALS, RARITY } from '../game/items';
import { t } from '../game/i18n';
import { getToolSpec } from '../game/tools';

const RING = 2 * Math.PI * 22;

function fmtTime(t: number) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
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
};

export default function Hud({ hud, dom, muted, onPause, onMute, onSelect, onBag, onCaptureMouse, isTouch }: Props) {
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
  }, [hud.phase]);

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

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-body">
      {/* damage / hazard vignette */}
      <div
        ref={(el) => {
          dom.vignette = el;
        }}
        className="absolute inset-0 opacity-0"
        style={{ transition: 'opacity 90ms linear' }}
      />

      {/* ---------------- TOP LEFT: vitals ---------------- */}
      <div className="absolute left-2 top-2 flex flex-col gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
        <div className="bevel-flat notch flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
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

        {/* position + a compass needle that points home */}
        <div className="bevel-flat notch flex items-center gap-2 px-2 py-1 text-[11px] tracking-widest text-white/50 sm:px-3">
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

        <div className="bevel-flat notch flex items-center gap-2 px-2 py-1 text-[11px] tracking-widest text-white/60 sm:px-3 sm:text-xs">
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
      </div>

      {/* ---------------- TOP CENTER: clock + combo ---------------- */}
      <div className="absolute left-1/2 top-2 flex -translate-x-1/2 flex-col items-center gap-1 sm:top-4">
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

      {/* ---------------- TOP RIGHT: score + tier + buttons ---------------- */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4 sm:gap-2">
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
        </div>

        <div className="bevel-flat notch flex items-center gap-2 px-2 py-1 sm:px-3">
          <PickIcon size={16} style={{ color: tierColor }} className="drop-shadow" />
          <span className="font-display text-sm leading-none sm:text-base" style={{ color: tierColor }}>
            {hud.tierName}
          </span>
          <span className="font-display text-[11px] text-white/40">{PICKAXE_TIERS[hud.tier].speed.toFixed(1)}x</span>
        </div>

        <div className="pointer-events-auto flex gap-1.5">
          <button
            onClick={onBag}
            className={`bevel-flat notch relative flex h-8 w-8 items-center justify-center transition active:scale-95 sm:h-9 sm:w-9 ${
              hud.craftHint ? 'text-torch' : 'text-white/70 hover:text-torch'
            }`}
            aria-label={t('bag')}
            title={`${t('bag')} (E)`}
          >
            <BagIcon size={17} />
            {hud.craftHint && <span className="anim-flicker absolute -right-1 -top-1 h-2.5 w-2.5 bg-torch shadow-[0_0_8px_#f4b942]" />}
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
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
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
          <span>{hud.heldName}</span>
          {hud.heldKind !== 'fist' && !isTouch && (
            <span className="rounded bg-black/50 px-1 py-0.5 text-[8px] text-white/60">[{t('drop_hint')}]</span>
          )}
        </div>
      </div>

      {/* ---------------- BANNER ---------------- */}
      {hud.banner && (
        <div key={hud.banner.key} className="anim-banner absolute left-1/2 top-[19%] -translate-x-1/2 text-center">
          <div className="font-display text-3xl leading-none sm:text-5xl" style={{ color: hud.banner.color, textShadow: '3px 3px 0 #05080a, 0 0 26px rgba(0,0,0,.6)' }}>
            {hud.banner.text}
          </div>
          <div className="mt-1 text-[11px] font-medium tracking-[0.2em] text-white/75 text-shadow-hard sm:text-xs">{hud.banner.sub}</div>
        </div>
      )}

      {/* ---------------- HOTBAR ---------------- */}
      <div
        className={`hud-hotbar absolute left-1/2 -translate-x-1/2 origin-bottom ${
          isTouch ? 'bottom-44' : 'bottom-4 sm:bottom-6'
        }`}
      >
        <div className="pointer-events-auto flex gap-0.5 p-1 sm:gap-1.5 sm:p-1.5">
          {/* always render 10 fixed cells; empty ones are dim placeholders */}
          {Array.from({ length: 10 }, (_, i) => hud.hotbar[i] ?? null).map((slot, i) =>
            slot === null ? (
              <div
                key={`empty-${i}`}
                className="notch relative flex h-10 w-10 items-center justify-center sm:h-14 sm:w-14"
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
        className={`absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 ${isTouch ? 'bottom-60' : 'bottom-24'}`}
      >
        {hud.tradeNear && hud.phase === 'playing' && (
          <div className="anim-pop bevel-flat notch flex items-center gap-2 px-3 py-1.5" style={{ borderColor: '#d98cff' }}>
            <span className="font-display text-xs tracking-widest text-[#d98cff] sm:text-sm">{t('pressTrade')}</span>
          </div>
        )}
        {hud.craftHint && (
          <button
            onClick={onBag}
            className="pointer-events-auto anim-pop bevel-flat notch flex items-center gap-2 px-3 py-1.5 transition hover:-translate-y-0.5 hover:brightness-125"
            style={{ borderColor: '#f4b942' }}
          >
            <BagIcon size={14} className="anim-flicker text-torch" />
            <span className="font-display text-xs tracking-widest text-torch sm:text-sm">{hud.craftHint}</span>
            <span className="font-display text-[10px] tracking-widest text-white/45">
              {t('ready')} · [E]
            </span>
          </button>
        )}

        {hint && (
          <div className="bevel-flat notch anim-rise px-3 py-1.5 text-center text-[10px] tracking-[0.16em] text-white/55 sm:text-xs">
            {isTouch ? t('hintTouch') : t('hintDesktop')}
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

      {/* ---------------- FPS ---------------- */}
      <div className="absolute bottom-1 right-2 font-display text-[10px] text-white/25">{hud.fps} FPS</div>
    </div>
  );

  function renderSlot(slot: { id: number; count: number }, i: number) {
    return (
            <button
              key={slot.id}
              onClick={() => onSelect(i)}
              className={`hotbar-slot notch relative flex h-10 w-10 items-center justify-center sm:h-14 sm:w-14 ${
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
                  const matCol = gear ? MATERIALS[gear.material].color : '#d6d9dd';
                  const rarCol = gear ? RARITY[gear.rarity].color : '#b6c2b8';
                  return (
                    <span className="flex flex-col items-center justify-center leading-none" style={{ color: matCol }}>
                      <span className="text-base sm:text-xl" style={{ textShadow: `0 0 8px ${rarCol}` }}>
                        ⛨
                      </span>
                      {gear && (
                        <span className="font-display text-[8px] sm:text-[9px]" style={{ color: rarCol }}>
                          +{gear.armor}
                        </span>
                      )}
                    </span>
                  );
                })()
              ) : (
                isPickTool(slot.id) || isSwordTool(slot.id) || isAxeTool(slot.id) ||
                isHoeTool(slot.id) || isShovelTool(slot.id) || slot.id === TOOL_BOW || slot.id === TOOL_TORCH
              ) ? (
                <span
                  className="flex h-6 w-6 items-center justify-center sm:h-9 sm:w-9"
                  style={{
                    color: getToolSpec(slot.id)?.edge ?? tierColor,
                  }}
                >
                  {isSwordTool(slot.id) ? (
                <SwordIcon size={26} />
              ) : slot.id === TOOL_TORCH ? (
                <span className="anim-flicker text-xl leading-none" style={{ color: '#ffb03a' }}>
                  ⨙
                </span>
              ) : isAxeTool(slot.id) ? (
                <AxeIcon size={24} style={{ color: getToolSpec(slot.id)?.tier === 0 ? '#b98a4d' : '#9aa0a6' }} />
              ) : isHoeTool(slot.id) ? (
                <HoeIcon size={24} style={{ color: getToolSpec(slot.id)?.tier === 0 ? '#b98a4d' : '#9aa0a6' }} />
              ) : isShovelTool(slot.id) ? (
                <ShovelIcon size={24} style={{ color: getToolSpec(slot.id)?.tier === 0 ? '#b98a4d' : '#9aa0a6' }} />
              ) : slot.id === TOOL_BOW ? (
                <BowIcon size={24} style={{ color: '#b98a4d' }} />
              ) : (
                <PickIcon size={24} />
              )}
                </span>
              ) : (
                <img src={getBlockIcon(slot.id)} alt="" className="pixelated h-6 w-6 sm:h-9 sm:w-9" draggable={false} />
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
