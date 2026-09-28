import { useEffect, useRef, useState } from 'react';
import type { HudState } from '../game/engine';

import { getBlockIcon } from '../game/textures';
import type { ScoreEntry } from './scores';
import { blockName, LANGS, matName, t, type Lang, type TKey } from '../game/i18n';
import {
  BagIcon,
  ClockIcon,
  CubeIcon,
  DepthIcon,
  EyeIcon,
  HeartIcon,
  MusicIcon,
  PickIcon,
  PlayIcon,
  SoundIcon,
  TrophyIcon,
} from './icons';

export function fmtMinutes(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function Toggle({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`notch flex items-center gap-2 px-3 py-2 font-display text-[11px] tracking-widest transition-all duration-150 hover:-translate-y-0.5 ${
        on ? 'text-torch' : 'text-white/35'
      }`}
      style={{
        background: on ? 'linear-gradient(180deg,#2b3a31,#151d19)' : 'linear-gradient(180deg,#171f1b,#0d1310)',
        border: `3px solid ${on ? '#f4b94266' : '#06090a'}`,
        boxShadow: on
          ? 'inset 2px 2px 0 rgba(255,255,255,.1), 0 0 14px rgba(244,185,66,.2)'
          : 'inset 2px 2px 0 rgba(255,255,255,.05), inset -2px -2px 0 rgba(0,0,0,.45)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const Key = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <kbd
    className={`inline-flex h-7 items-center justify-center rounded-[3px] border-b-[3px] border-black/70 bg-gradient-to-b from-pit-500 to-pit-700 px-1.5 font-display text-xs text-white/90 shadow-[inset_1px_1px_0_rgba(255,255,255,.18)] ${
      wide ? 'min-w-16' : 'min-w-7'
    }`}
  >
    {children}
  </kbd>
);

const Row = ({ k, v, accent }: { k: React.ReactNode; v: React.ReactNode; accent?: string }) => (
  <div className="flex items-center gap-2.5 text-[11px] tracking-wide text-white/55 sm:text-xs">
    <span className="flex gap-1">{k}</span>
    <span className="font-display text-sm" style={{ color: accent ?? '#e8efe9' }}>
      {v}
    </span>
  </div>
);

function ScoreTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: string }) {
  return (
    <div className="sunken notch overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-pit-600 to-pit-700 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 font-display text-xs tracking-widest text-torch">
          <TrophyIcon size={13} /> {t('records')}
        </span>
        <span className="font-display text-[10px] text-white/35">{t('local')}</span>
      </div>
      <div className="max-h-[38vh] overflow-y-auto">
        {scores.map((s, i) => {
          const mine = highlight && s.token === highlight;
          return (
            <div
              key={s.token}
              className={`flex items-center gap-2 border-b border-white/5 px-2.5 py-1.5 text-[11px] transition-colors ${
                mine ? 'bg-torch/20' : i % 2 ? 'bg-white/[0.02]' : ''
              }`}
            >
              <span className={`w-5 font-display text-sm ${i === 0 ? 'text-torch' : 'text-white/35'}`}>{i + 1}</span>
              <span className={`flex-1 truncate font-display text-sm tracking-wide ${mine ? 'text-torch' : 'text-white/85'}`}>
                {s.name || '—'}
                {mine && <span className="ml-1.5 align-middle text-[9px] text-moss">◀ {t('you')}</span>}
              </span>
              <span className="hidden font-display text-[10px] text-white/30 sm:inline">{matName(s.tier)}</span>
              <span className="hidden w-10 text-right font-display text-[10px] text-white/25 sm:inline">
                {s.runTime ? fmtMinutes(s.runTime) : '—'}
              </span>
              <span className="hidden w-12 text-right font-display text-[10px] text-white/30 sm:inline">
                {s.blocks} {t('blk')}
              </span>
              <span className="w-16 text-right font-display text-base tabular-nums text-white">{s.score.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================== LOADING =============================== */
export function LoadingScreen({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  const stage = pct < 45 ? t('stTerrain') : pct < 62 ? t('stForest') : pct < 96 ? t('stMesh') : t('stSpawn');
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-pit-950">
      <div className="w-[min(90vw,420px)]">
        <div className="mb-4 flex items-end gap-3">
          <CubeIcon size={30} className="anim-float text-torch" />
          <div>
            <div className="font-display text-3xl leading-none text-white text-outline">{t('carving')}</div>
            <div className="mt-1 text-[11px] tracking-[0.3em] text-white/40">{t('loadSub')}</div>
          </div>
        </div>
        <div className="sunken notch h-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-moss via-torch to-copper stripes transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between font-display text-xs text-white/45">
          <span>{stage}</span>
          <span className="tabular-nums text-torch">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- session dropdown ---------------- */
function SessionDropdown({
  sessions,
  sessionId,
  onSession,
}: {
  sessions: ReadonlyArray<{ id: string; labelKey: TKey; time: number; sub: string; accent: string }>;
  sessionId: string;
  onSession: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  return (
    <div className="relative w-64">
      <button
        onClick={() => setOpen((v) => !v)}
        className="notch flex w-full items-center justify-between px-4 py-3 transition-all duration-150 hover:brightness-125"
        style={{
          background: `linear-gradient(180deg, ${cur.accent}26, rgba(10,14,12,.94))`,
          border: `3px solid ${cur.accent}`,
          boxShadow: `0 0 18px ${cur.accent}30`,
        }}
      >
        <span className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl leading-none tabular-nums" style={{ color: cur.accent }}>
            {fmtMinutes(cur.time)}
          </span>
          <span className="font-display text-[10px] tracking-widest text-white/55">{t(cur.labelKey)}</span>
        </span>
        <svg viewBox="0 0 12 8" width="14" height="9" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <path d="M1 1l5 5 5-5" fill="none" stroke={cur.accent} strokeWidth="2.4" />
        </svg>
      </button>

      {open && (
        <div className="anim-pop absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden bevel notch">
          {sessions.map((s) => {
            const on = s.id === sessionId;
            return (
              <button
                key={s.id}
                onClick={() => {
                  onSession(s.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  on ? '' : 'hover:bg-white/5'
                }`}
                style={{ background: on ? `${s.accent}22` : undefined, borderLeft: `4px solid ${on ? s.accent : 'transparent'}` }}
              >
                <span className="font-display text-lg leading-none tabular-nums" style={{ color: s.accent }}>
                  {fmtMinutes(s.time)}
                </span>
                <span className="font-display text-[10px] tracking-widest text-white/45">{t(s.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =============================== START =============================== */
export function StartScreen({
  scores,
  onPlay,
  onNewWorld,
  sessions,
  sessionId,
  onSession,
  music,
  onMusic,
  muted,
  onMute,
  freeLook,
  onFreeLook,
  isTouch,
  lang,
  onLang,
  survival,
  onMode,
  hasSave,
  onCreateWorld,
  onContinueWorld,
}: {
  scores: ScoreEntry[];
  onPlay: () => void;
  onNewWorld: () => void;
  sessions: ReadonlyArray<{ id: string; labelKey: TKey; time: number; sub: string; accent: string }>;
  sessionId: string;
  onSession: (id: string) => void;
  music: boolean;
  onMusic: () => void;
  muted: boolean;
  onMute: () => void;
  freeLook: boolean;
  onFreeLook: () => void;
  isTouch: boolean;
  lang: Lang;
  onLang: (l: Lang) => void;
  survival: boolean;
  onMode: (s: boolean) => void;
  hasSave: boolean;
  onCreateWorld: () => void;
  onContinueWorld: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(6,10,9,.94)_0%,rgba(6,10,9,.82)_38%,rgba(6,10,9,.35)_68%,rgba(6,10,9,.55)_100%)]" />
      <div className="pointer-events-none absolute inset-0 grain opacity-40" />

      <div className="relative flex min-h-full flex-col gap-6 p-4 sm:p-7 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10">
        {/* ---- left: identity + CTA ---- */}
        <div className="pointer-events-auto flex max-w-xl flex-col justify-center">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.42em] text-torch/80">
            <span className="h-px w-8 bg-torch/60" />
            {t('tagline')}
          </div>

          <h1 className="font-display leading-[0.82]">
            <span className="block text-[clamp(3.4rem,13vw,8.5rem)] text-transparent text-outline" style={{ WebkitTextStroke: '3px #f4b942' }}>
              ORE
            </span>
            <span
              className="anim-flicker -mt-2 block text-[clamp(3.4rem,13vw,8.5rem)] text-torch text-shadow-hard sm:-mt-4"
              style={{ textShadow: '0 0 44px rgba(244,185,66,.45), 5px 5px 0 #05080a' }}
            >
              RUSH
            </span>
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">{t('intro')}</p>

          {/* ---- shift length: dropdown ---- */}
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.3em] text-white/40">
              <ClockIcon size={12} className="text-torch" /> {t('shiftLength')}
            </div>
            <SessionDropdown sessions={sessions} sessionId={sessionId} onSession={onSession} />
          </div>

          {/* ---- game mode ---- */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.3em] text-white/40">
              <CubeIcon size={12} className="text-torch" /> {t('mode')}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { on: true, label: t('survival'), sub: t('survivalSub'), accent: '#e2564a', icon: '☠' },
                { on: false, label: t('explorer'), sub: t('explorerSub'), accent: '#5fe8dc', icon: '✦' },
              ].map((m) => {
                const sel = m.on === survival;
                return (
                  <button
                    key={m.label}
                    onClick={() => onMode(m.on)}
                    className={`notch flex-1 px-3.5 py-2.5 text-left transition-all duration-150 ${
                      sel ? '-translate-y-0.5' : 'hover:-translate-y-0.5 hover:brightness-125'
                    }`}
                    style={{
                      minWidth: 150,
                      background: sel
                        ? `linear-gradient(180deg, ${m.accent}2e, rgba(10,14,12,.92))`
                        : 'linear-gradient(180deg,#1b241f,#101713)',
                      border: `3px solid ${sel ? m.accent : '#06090a'}`,
                      boxShadow: sel
                        ? `inset 2px 2px 0 rgba(255,255,255,.12), 0 0 20px ${m.accent}38`
                        : 'inset 2px 2px 0 rgba(255,255,255,.06), inset -2px -2px 0 rgba(0,0,0,.45)',
                    }}
                  >
                    <div className="font-display text-lg leading-none" style={{ color: sel ? m.accent : '#dbe3dc' }}>
                      {m.icon} {m.label}
                    </div>
                    <div className="mt-1 text-[10px] leading-tight" style={{ color: sel ? `${m.accent}bb` : '#6c7b71' }}>
                      {m.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- language ---- */}
          <div className="mt-4">
            <div className="mb-2 text-[10px] tracking-[0.3em] text-white/40">{t('language')}</div>
            <div className="flex gap-2">
              {LANGS.map((l) => {
                const sel = l.id === lang;
                return (
                  <button
                    key={l.id}
                    onClick={() => onLang(l.id)}
                    className={`notch flex items-center gap-2 px-3 py-2 font-display text-xs tracking-widest transition-all duration-150 hover:-translate-y-0.5 ${
                      sel ? 'text-pit-950' : 'text-white/45'
                    }`}
                    style={{
                      background: sel ? 'linear-gradient(180deg,#f4d07a,#c99a2e)' : 'linear-gradient(180deg,#1b241f,#101713)',
                      border: `3px solid ${sel ? '#f4b942' : '#06090a'}`,
                      boxShadow: sel ? '0 0 16px rgba(244,185,66,.3)' : 'inset 2px 2px 0 rgba(255,255,255,.05)',
                    }}
                  >
                    <span className="text-sm">{l.flag}</span>
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- options ---- */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Toggle on={music} onClick={onMusic} icon={<MusicIcon off={!music} size={14} />} label={music ? t('musicOn') : t('musicOff')} />
            <Toggle on={!muted} onClick={onMute} icon={<SoundIcon muted={muted} size={14} />} label={muted ? t('sfxOff') : t('sfxOn')} />
            {!isTouch && (
              <Toggle
                on={freeLook}
                onClick={onFreeLook}
                icon={<EyeIcon size={14} />}
                label={freeLook ? t('freeLookOn') : t('freeLookOff')}
              />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onPlay}
              className="btn-mc notch flex items-center gap-3 bg-gradient-to-b from-moss to-[#4d8c31] px-8 py-4 text-2xl text-pit-950 sm:text-3xl"
            >
              <PlayIcon size={22} />
              {t('play')}
            </button>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-5 py-4 text-base text-white/85"
            >
              {showHelp ? t('hideControls') : t('controls')}
            </button>
            <button
              onClick={onNewWorld}
              className="btn-mc notch bg-gradient-to-b from-copper to-[#7d4522] px-5 py-4 text-base text-pit-950"
            >
              {t('newWorld')}
            </button>
          </div>

          {/* ---- my world: sandbox без таймера ---- */}
          <div className="bevel-flat notch mt-5 p-3">
            <div className="mb-1 flex items-center gap-2 font-display text-sm tracking-widest text-[#8fb8ff]">
              ∞ {t('myWorld')}
            </div>
            <div className="mb-2.5 text-[11px] leading-relaxed text-white/45">{t('myWorldSub')}</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onCreateWorld}
                className="btn-mc notch bg-gradient-to-b from-[#5e8cff] to-[#3a5cb0] px-5 py-3 text-base text-pit-950"
              >
                {t('createWorld')}
              </button>
              {hasSave && (
                <button
                  onClick={onContinueWorld}
                  className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-5 py-3 text-base text-white/85"
                >
                  {t('continueWorld')}
                </button>
              )}
            </div>
          </div>

          {showHelp && (
            <div className="bevel notch anim-rise mt-5 grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 font-display text-xs tracking-widest text-torch">{t('keyboard')}</div>
                <div className="space-y-1.5">
                  <Row k={<><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></>} v={t('move')} />
                  <Row k={<Key>SPACE</Key>} v={t('jump')} />
                  <Row k={<Key wide>SHIFT</Key>} v={t('sprint')} />
                  <Row k={<Key wide>LMB</Key>} v={t('mineHold')} />
                  <Row k={<Key wide>RMB</Key>} v={t('placeBlock')} />
                  <Row k={<><Key>1</Key>–<Key>9</Key></>} v={t('selectSlot')} />
                  <Row k={<Key>I</Key>} v={t('bag')} />
                  <Row k={<Key>ESC</Key>} v={t('pause')} />
                </div>
                <div className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/45">
                  {t('lockNote')}
                </div>
              </div>
              <div>
                <div className="mb-2 font-display text-xs tracking-widest text-torch">{t('touch')}</div>
                <div className="space-y-1.5">
                  <Row k={<Key wide>◉</Key>} v={t('stickMove')} />
                  <Row k={<Key wide>⇄</Key>} v={t('dragLook')} />
                  <Row k={<Key wide>⛏</Key>} v={t('holdDig')} />
                  <Row k={<Key wide>▲</Key>} v={t('hopBlock')} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---- right: records + ore guide ---- */}
        <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-4 lg:w-[340px]">
          <ScoreTable scores={scores} />
          <div className="bevel-flat notch p-3">
            <div className="mb-2 flex items-center gap-1.5 font-display text-xs tracking-widest text-torch">
              <BagIcon size={13} /> {t('guideTitle')} <span className="text-white/30">· {t('guideSub')}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { n: 'STONE', c: '#9aa0a6', ing: [[4, 3], [12, 2]] },
                { n: 'IRON', c: '#e6c39a', ing: [[6, 3], [12, 2]] },
                { n: 'DIAMOND', c: '#5fe8dc', ing: [[8, 3], [12, 2]] },
              ].map((p) => (
                <div key={p.n} className="flex items-center gap-2">
                  <PickIcon size={15} style={{ color: p.c }} />
                  <span className="w-16 font-display text-[11px]" style={{ color: p.c }}>
                    {matName(p.n)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {p.ing.map(([id, n]) => (
                      <span key={id} className="flex items-center gap-0.5">
                        <img src={getBlockIcon(id)} alt="" className="pixelated h-5 w-5" draggable={false} />
                        <span className="font-display text-[10px] text-white/50">×{n}</span>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-white/10 pt-1.5 text-[10px] leading-relaxed text-white/40">
              {t('guideMore')}
            </div>
          </div>

          <div className="bevel-flat notch p-3">
            <div className="mb-2 flex items-center gap-1.5 font-display text-xs tracking-widest text-white/60">
              <PickIcon size={13} className="text-copper" /> {t('oreTableTitle')}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[5, 6, 7, 8, 3, 9].map((id) => (
                <div key={id} className="flex items-center gap-2">
                  <img src={getBlockIcon(id)} alt="" className="pixelated h-7 w-7" draggable={false} />
                  <div className="leading-tight">
                    <div className="font-display text-[11px] text-white/80">{blockName(id, BLOCK_LABEL[id])}</div>
                    <div className="font-display text-[10px] text-torch">
                      {BLOCK_SCORE[id]} {t('pts')} · +{BLOCK_TIME[id]}
                      {t('secShort')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const BLOCK_LABEL: Record<number, string> = { 3: 'Stone', 5: 'Coal', 6: 'Iron', 7: 'Gold', 8: 'Diamond', 9: 'Oak Log' };
const BLOCK_SCORE: Record<number, string> = { 3: '6', 5: '45', 6: '110', 7: '240', 8: '620', 9: '14' };
const BLOCK_TIME: Record<number, string> = { 3: '0', 5: '1.5', 6: '2.5', 7: '4', 8: '7', 9: '0' };

/* =============================== PAUSE =============================== */
export function PauseScreen({
  hud,
  onResume,
  onRestart,
  onQuit,
  onBag,
  music,
  onMusic,
  muted,
  onMute,
  onSaveWorld,
}: {
  hud: HudState;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onBag: () => void;
  music: boolean;
  onMusic: () => void;
  muted: boolean;
  onMute: () => void;
  onSaveWorld: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-pit-950/78 backdrop-blur-[3px]">
      <div className="bevel notch anim-pop w-[min(92vw,440px)] p-5 sm:p-6">
        <div className="mb-1 font-display text-4xl leading-none text-white text-outline sm:text-5xl">{t('paused')}</div>
        <div className="mb-5 text-[11px] tracking-[0.3em] text-torch/70">
          {t('pausedSub')} · {fmtMinutes(hud.runTime)}
        </div>

        <div className="sunken notch mb-5 grid grid-cols-2 gap-px bg-white/5 p-px sm:grid-cols-4">
          <Stat icon={<TrophyIcon size={13} />} label={t('score')} value={hud.score.toLocaleString()} color="#f4b942" />
          <Stat icon={<ClockIcon size={13} />} label={t('shift')} value={`${Math.ceil(hud.timeLeft)}s`} color="#e8efe9" />
          <Stat icon={<CubeIcon size={13} />} label={t('mined')} value={String(hud.blocksMined)} color="#93c95d" />
          <Stat icon={<DepthIcon size={13} />} label={t('depth')} value={String(hud.deepest)} color="#d9844a" />
        </div>

        <div className="flex flex-col gap-2.5">
          <button onClick={onResume} className="btn-mc notch flex items-center justify-center gap-2 bg-gradient-to-b from-moss to-[#4d8c31] py-3.5 text-xl text-pit-950">
            <PlayIcon size={17} /> {t('resume')}
          </button>
          <button
            onClick={onBag}
            className="btn-mc notch flex items-center justify-center gap-2 bg-gradient-to-b from-torch to-[#a8761f] py-3 text-base text-pit-950"
          >
            <BagIcon size={16} /> {t('workbench')}
            {hud.craftHint ? ` · ${hud.craftHint}` : ''}
          </button>
          {hud.sandbox && (
            <button
              onClick={onSaveWorld}
              className="btn-mc notch flex items-center justify-center gap-2 bg-gradient-to-b from-[#5e8cff] to-[#3a5cb0] py-3 text-base text-pit-950"
            >
              💾 {t('saveWorldBtn')}
            </button>
          )}
          <div className="flex justify-center gap-2">
            <Toggle on={music} onClick={onMusic} icon={<MusicIcon off={!music} size={13} />} label={music ? t('musicOn') : t('musicOff')} />
            <Toggle on={!muted} onClick={onMute} icon={<SoundIcon muted={muted} size={13} />} label={muted ? t('sfxOff') : t('sfxOn')} />
          </div>
          <div className="flex gap-2.5">
            <button onClick={onRestart} className="btn-mc notch flex-1 bg-gradient-to-b from-pit-500 to-pit-700 py-3 text-base text-white/85">
              {t('restart')}
            </button>
            <button onClick={onQuit} className="btn-mc notch flex-1 bg-gradient-to-b from-[#7a3a33] to-[#4a211c] py-3 text-base text-white/85">
              {t('quit')}
            </button>
          </div>
        </div>
        <div className="mt-4 text-center text-[10px] tracking-[0.22em] text-white/30">{t('escResume')}</div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-pit-900/90 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] tracking-[0.2em] text-white/40">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="font-display text-xl leading-tight tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/* =============================== GAME OVER =============================== */
export function GameOverScreen({
  hud,
  scores,
  token,
  name,
  onName,
  onRestart,
  onQuit,
  isRecord,
}: {
  hud: HudState;
  scores: ScoreEntry[];
  token: string;
  name: string;
  onName: (n: string) => void;
  onRestart: () => void;
  onQuit: () => void;
  isRecord: boolean;
}) {
  const [shown, setShown] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 1000;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(hud.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hud.score]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !(e.target as HTMLElement)?.matches?.('input')) onRestart();
      if (e.code === 'Escape') onQuit();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRestart, onQuit]);

  const dead = hud.deathCause;
  const title =
    dead === 'time' ? t('shiftComplete') : dead === 'lava' ? t('youMelted') : dead === 'mob' ? t('slain') : t('gravityWins');
  const accent = dead === 'time' ? '#93c95d' : dead === 'lava' ? '#ff7a22' : '#e2564a';
  const sub =
    dead === 'time'
      ? t('overTime')
      : dead === 'lava'
        ? t('overLava')
        : dead === 'mob'
          ? `${t('overMob')}${hud.killedBy ? ` (${hud.killedBy})` : ''}`
          : t('overFall');

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-pit-950/85 backdrop-blur-[2px]">
      <div className="pointer-events-none absolute inset-0 grain opacity-30" />
      <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 p-4 sm:p-7 lg:flex-row lg:items-center">
        <div className="anim-rise flex-1">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.4em]" style={{ color: accent }}>
            <span className="h-px w-8" style={{ background: accent }} />
            {t('runReport')} · {fmtMinutes(hud.runTime)}
          </div>
          <h2 className="font-display text-[clamp(2.4rem,8vw,4.6rem)] leading-[0.9] text-white text-outline">{title}</h2>
          <p className="mt-2 max-w-md text-sm text-white/55">{sub}</p>

          <div className="bevel notch mt-5 p-4">
            <div className="text-[10px] tracking-[0.34em] text-white/40">{t('finalScore')}</div>
            <div
              className="font-display text-[clamp(3rem,11vw,5.4rem)] leading-none tabular-nums"
              style={{ color: accent, textShadow: `0 0 40px ${accent}55, 4px 4px 0 #05080a` }}
            >
              {shown.toLocaleString()}
            </div>
            {isRecord && (
              <div className="anim-pop mt-2 inline-block bg-torch px-2 py-0.5 font-display text-xs tracking-widest text-pit-950">
                {t('newBest')}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-5">
              <Stat icon={<CubeIcon size={12} />} label={t('mined')} value={String(hud.blocksMined)} color="#e8efe9" />
              <Stat icon={<PickIcon size={12} />} label={t('bestCombo')} value={`x${hud.bestCombo}`} color="#93c95d" />
              <Stat icon={<DepthIcon size={12} />} label={t('deepest')} value={String(hud.deepest)} color="#d9844a" />
              <Stat icon={<HeartIcon size={12} />} label={t('ores')} value={String(hud.oresFound)} color="#5fe8dc" />
              <Stat icon={<TrophyIcon size={12} />} label={t('kills')} value={String(hud.kills)} color="#e2564a" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button onClick={onRestart} className="btn-mc notch flex items-center gap-2 bg-gradient-to-b from-moss to-[#4d8c31] px-7 py-3.5 text-xl text-pit-950">
              <PlayIcon size={18} /> {t('mineAgain')}
            </button>
            <button onClick={onQuit} className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-5 py-3.5 text-base text-white/85">
              {t('mainMenu')}
            </button>
            <span className="font-display text-[10px] tracking-[0.24em] text-white/30">[R] · [ESC]</span>
          </div>
        </div>

        <div className="anim-rise w-full lg:w-[360px]" style={{ animationDelay: '120ms' }}>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-[10px] tracking-[0.28em] text-white/40">{t('signLog')}</span>
            <input
              value={name}
              maxLength={12}
              onChange={(e) => onName(e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ0-9 _-]/g, ''))}
              className="sunken notch flex-1 px-2.5 py-1.5 font-display text-base tracking-widest text-torch outline-none focus:ring-2 focus:ring-torch/50"
              placeholder={t('miner')}
            />
          </div>
          <ScoreTable scores={scores} highlight={token} />
        </div>
      </div>
    </div>
  );
}
