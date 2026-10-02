import { useEffect, useRef, useState } from 'react';
import type { HudState } from '../game/engine';

import { getBlockIcon } from '../game/textures';
import type { ScoreEntry } from './scores';
import { blockName, LANGS, matName, t, type Lang, type TKey } from '../game/i18n';
import type { YaProfile } from '../game/yandex';
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

type ShopCategory = 'diamonds' | 'pets' | 'gear' | 'drops' | 'boosters' | 'skins';
type ShopFilter = 'all' | ShopCategory;
type ShopProduct = {
  id: string;
  category: ShopCategory;
  titleKey: TKey;
  descriptionKey: TKey;
  icon: string;
  accent: string;
  diamondAmount?: number;
  rubles?: number;
  diamondCost?: number;
  freeDrop?: boolean;
  badgeKey?: TKey;
  rarityKey?: TKey;
  anyMode?: boolean;
  accountBound?: boolean;
};

const SHOP_TABS: ReadonlyArray<{ id: ShopFilter; labelKey: TKey }> = [
  { id: 'all', labelKey: 'shopTabAll' },
  { id: 'diamonds', labelKey: 'shopTabDiamonds' },
  { id: 'pets', labelKey: 'shopTabPets' },
  { id: 'gear', labelKey: 'shopTabGear' },
  { id: 'drops', labelKey: 'shopTabDrops' },
  { id: 'boosters', labelKey: 'shopTabBoosters' },
  { id: 'skins', labelKey: 'shopTabSkins' },
];

const SHOP_PRODUCTS: readonly ShopProduct[] = [
  { id: 'diamonds-100', category: 'diamonds', titleKey: 'shopPack100Title', descriptionKey: 'shopDiamondPackDesc', icon: '◆', accent: '#62e8dc', diamondAmount: 100, rubles: 99 },
  { id: 'diamonds-599', category: 'diamonds', titleKey: 'shopPack599Title', descriptionKey: 'shopDiamondPackDesc', icon: '◆', accent: '#62e8dc', diamondAmount: 599, rubles: 499 },
  { id: 'diamonds-1599', category: 'diamonds', titleKey: 'shopPack1599Title', descriptionKey: 'shopDiamondPackDesc', icon: '◆', accent: '#62e8dc', diamondAmount: 1599, rubles: 999, rarityKey: 'shopRarityRare' },
  { id: 'diamonds-5999', category: 'diamonds', titleKey: 'shopPack5999Title', descriptionKey: 'shopDiamondPackDesc', icon: '◆', accent: '#b895ff', diamondAmount: 5999, rubles: 1999, rarityKey: 'shopRarityEpic' },

  { id: 'pet-parrot', category: 'pets', titleKey: 'shopPetParrotTitle', descriptionKey: 'shopPetParrotDesc', icon: '🦜', accent: '#e7a84b', diamondCost: 79, anyMode: true },
  { id: 'pet-owl', category: 'pets', titleKey: 'shopPetOwlTitle', descriptionKey: 'shopPetOwlDesc', icon: '🦉', accent: '#b895ff', diamondCost: 399, anyMode: true, rarityKey: 'shopRarityRare' },
  { id: 'pet-monkey', category: 'pets', titleKey: 'shopPetMonkeyTitle', descriptionKey: 'shopPetMonkeyDesc', icon: '🐒', accent: '#c98b5b', diamondCost: 99, anyMode: true },
  { id: 'pet-capybara', category: 'pets', titleKey: 'shopPetCapybaraTitle', descriptionKey: 'shopPetCapybaraDesc', icon: '🦫', accent: '#c98b5b', diamondCost: 499, anyMode: true, rarityKey: 'shopRarityRare' },
  { id: 'pet-wolf', category: 'pets', titleKey: 'shopPetWolfTitle', descriptionKey: 'shopPetWolfDesc', icon: '🐺', accent: '#9ca9ba', diamondCost: 899, anyMode: true, rarityKey: 'shopRarityEpic' },

  { id: 'armor-uncommon', category: 'gear', titleKey: 'shopArmorUncommonTitle', descriptionKey: 'shopArmorUncommonDesc', icon: '▣', accent: '#75c884', rarityKey: 'shopRarityCommon' },
  { id: 'armor-rare', category: 'gear', titleKey: 'shopArmorRareTitle', descriptionKey: 'shopArmorRareDesc', icon: '▣', accent: '#6ca7ff', rarityKey: 'shopRarityRare' },
  { id: 'armor-epic', category: 'gear', titleKey: 'shopArmorEpicTitle', descriptionKey: 'shopArmorEpicDesc', icon: '▣', accent: '#bd8cff', rarityKey: 'shopRarityEpic' },
  { id: 'diamond-pickaxe', category: 'gear', titleKey: 'shopDiamondPickaxeTitle', descriptionKey: 'shopDiamondPickaxeDesc', icon: '⛏', accent: '#62e8dc', diamondCost: 2999, rarityKey: 'shopRarityLegendary' },
  { id: 'diamond-armor', category: 'gear', titleKey: 'shopDiamondArmorTitle', descriptionKey: 'shopDiamondArmorDesc', icon: '🛡', accent: '#62e8dc', diamondCost: 4999, rarityKey: 'shopRarityLegendary' },

  { id: 'drop-daily', category: 'drops', titleKey: 'shopDailyStarterTitle', descriptionKey: 'shopDailyStarterDesc', icon: '🎁', accent: '#f4b942', freeDrop: true, badgeKey: 'shopDaily' },
  { id: 'drop-weekly', category: 'drops', titleKey: 'shopWeeklyDropTitle', descriptionKey: 'shopWeeklyDropDesc', icon: '✦', accent: '#62e8dc', freeDrop: true, badgeKey: 'shopWeekly' },
  { id: 'drop-monthly', category: 'drops', titleKey: 'shopMonthlyDropTitle', descriptionKey: 'shopMonthlyDropDesc', icon: '🎁', accent: '#bd8cff', freeDrop: true, badgeKey: 'shopMonthly', rarityKey: 'shopRarityEpic' },
  { id: 'chest-common', category: 'drops', titleKey: 'shopChestCommonTitle', descriptionKey: 'shopChestCommonDesc', icon: '▣', accent: '#9ca9ba', badgeKey: 'shopWeekly', rarityKey: 'shopRarityCommon' },
  { id: 'chest-rare', category: 'drops', titleKey: 'shopChestRareTitle', descriptionKey: 'shopChestRareDesc', icon: '▣', accent: '#6ca7ff', badgeKey: 'shopWeekly', rarityKey: 'shopRarityRare' },
  { id: 'chest-epic', category: 'drops', titleKey: 'shopChestEpicTitle', descriptionKey: 'shopChestEpicDesc', icon: '▣', accent: '#bd8cff', badgeKey: 'shopWeekly', rarityKey: 'shopRarityEpic' },

  { id: 'booster-start', category: 'boosters', titleKey: 'shopBoosterStartTitle', descriptionKey: 'shopBoosterStartDesc', icon: '⚡', accent: '#f4b942', accountBound: true },
  { id: 'booster-ore', category: 'boosters', titleKey: 'shopBoosterOreTitle', descriptionKey: 'shopBoosterOreDesc', icon: '⛏', accent: '#62e8dc', accountBound: true },
  { id: 'booster-score', category: 'boosters', titleKey: 'shopBoosterScoreTitle', descriptionKey: 'shopBoosterScoreDesc', icon: '✦', accent: '#bd8cff', accountBound: true },

  { id: 'skin-miner', category: 'skins', titleKey: 'shopSkinMinerTitle', descriptionKey: 'shopSkinMinerDesc', icon: '♟', accent: '#e7a84b' },
  { id: 'skin-arctic', category: 'skins', titleKey: 'shopSkinArcticTitle', descriptionKey: 'shopSkinArcticDesc', icon: '♟', accent: '#62e8dc' },
  { id: 'skin-nomad', category: 'skins', titleKey: 'shopSkinNomadTitle', descriptionKey: 'shopSkinNomadDesc', icon: '♟', accent: '#b895ff' },
];

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

/* =============================== START =============================== */
/**
 * Yandex profile card: avatar + nick from the platform, cloud-progress state, and — for a player
 * who has not signed in — the sign-in offer. Requirement 1.2 asks to explain the benefit before
 * opening the platform dialog, so the button expands into a short explanation first.
 */
function ProfileCard({
  profile,
  restored,
  onSignIn,
}: {
  profile: YaProfile;
  restored: boolean;
  onSignIn: () => void;
}) {
  const [explaining, setExplaining] = useState(false);
  const name = profile.name || t('profileGuest');
  return (
    <div className="bevel-flat notch p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-white/15 bg-black/40">
          {profile.photo ? (
            <img src={profile.photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-lg text-white/45">?</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] tracking-[0.28em] text-white/40">
            <span className="text-[#ff3f2e]">◉</span> {t('profileYandex')}
          </div>
          <div className="truncate font-display text-base leading-tight text-white/90">{name}</div>
          <div className="mt-0.5 text-[10px] leading-snug text-white/45">
            {profile.authorized ? t('profileCloudOn') : t('profileCloudOff')}
          </div>
        </div>
        {restored && (
          <span className="shrink-0 border border-moss/60 bg-moss/15 px-1.5 py-1 font-display text-[8px] tracking-widest text-moss">
            {t('profileRestored')}
          </span>
        )}
      </div>

      {!profile.authorized && (
        <div className="mt-2.5 border-t border-white/10 pt-2.5">
          {explaining ? (
            <>
              <p className="text-[11px] leading-relaxed text-white/60">{t('signInBenefit')}</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={onSignIn}
                  className="btn-mc notch flex-1 bg-gradient-to-b from-[#ff5a4a] to-[#c5362a] px-3 py-2 text-xs text-white"
                >
                  {t('signInContinue')}
                </button>
                <button
                  type="button"
                  onClick={() => setExplaining(false)}
                  className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-3 py-2 text-xs text-white/80"
                >
                  {t('signInCancel')}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setExplaining(true)}
              className="btn-mc notch w-full bg-gradient-to-b from-[#ff5a4a] to-[#c5362a] px-3 py-2.5 text-xs text-white"
            >
              {t('signIn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StartScreen({
  scores,
  onPlay,
  onNewWorld,
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
  profile,
  onSignIn,
  cloudSavedAt,
}: {
  scores: ScoreEntry[];
  onPlay: () => void;
  onNewWorld: () => void;
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
  /** Yandex profile, or null when the game runs outside Yandex Games (card is hidden then) */
  profile: YaProfile | null;
  onSignIn: () => void;
  /** timestamp of the cloud profile that was pulled on this boot, 0 when nothing was restored */
  cloudSavedAt: number;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopTab, setShopTab] = useState<ShopFilter>('all');
  const filteredShopProducts = shopTab === 'all'
    ? SHOP_PRODUCTS
    : SHOP_PRODUCTS.filter((product) => product.category === shopTab);
  const modes = [
    { id: 'survival', on: true, label: t('survival'), sub: t('survivalSub'), accent: '#e2564a', icon: '☠' },
    { id: 'explorer', on: false, label: t('explorer'), sub: t('explorerSub'), accent: '#5fe8dc', icon: '✦' },
  ];

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto overscroll-contain">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(38,55,43,.52)_0%,rgba(6,10,9,.88)_58%,rgba(4,7,6,.97)_100%)]" />
      <div className="pointer-events-none absolute inset-0 grain opacity-35" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1600px] items-center justify-center px-3 py-4 sm:px-6 sm:py-7 xl:px-10">
        <div className="grid w-full grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(350px,430px)] xl:gap-10">
          {/* Centered title and primary choices */}
          <main className="pointer-events-auto mx-auto flex w-full max-w-[980px] flex-col items-center text-center">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.38em] text-torch/80 sm:text-[11px] sm:tracking-[0.46em]">
              <span className="h-px w-7 bg-torch/60 sm:w-10" />
              {t('tagline')}
              <span className="h-px w-7 bg-torch/60 sm:w-10" />
            </div>

            <h1 className="font-display leading-[0.8]">
              <span className="block text-[clamp(3.4rem,10vw,7.5rem)] text-transparent" style={{ WebkitTextStroke: '3px #f4b942' }}>
                ORE
              </span>
              <span
                className="anim-flicker -mt-1 block text-[clamp(3.4rem,10vw,7.5rem)] text-torch sm:-mt-3"
                style={{ textShadow: '0 0 44px rgba(244,185,66,.42), 5px 5px 0 #05080a' }}
              >
                RUSH
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:mt-4 sm:text-base lg:text-lg">{t('intro')}</p>

            {/* Mode selection and fresh-world generation stay together as the main menu's first action row. */}
            <section className="mt-5 w-full max-w-[900px]" aria-label={t('mode')}>
              <div className="mb-2 flex items-center justify-center gap-2 text-[10px] tracking-[0.28em] text-white/50 sm:text-[11px] sm:tracking-[0.34em]">
                <CubeIcon size={13} className="text-torch" /> {t('mode')}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {modes.map((m) => {
                  const selected = m.on === survival;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onMode(m.on)}
                      className="notch flex min-h-[5.3rem] flex-col items-center justify-center px-2 py-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:brightness-125 sm:min-h-[6.4rem] sm:px-3"
                      style={{
                        background: selected
                          ? `linear-gradient(180deg, ${m.accent}32, rgba(10,14,12,.96))`
                          : 'linear-gradient(180deg,#1b241f,#101713)',
                        border: `3px solid ${selected ? m.accent : '#06090a'}`,
                        boxShadow: selected
                          ? `inset 2px 2px 0 rgba(255,255,255,.12), 0 0 20px ${m.accent}35`
                          : 'inset 2px 2px 0 rgba(255,255,255,.06), inset -2px -2px 0 rgba(0,0,0,.45)',
                      }}
                    >
                      <span className="font-display text-base leading-tight sm:text-xl" style={{ color: selected ? m.accent : '#dbe3dc' }}>
                        <span className="mr-1.5">{m.icon}</span>{m.label}
                      </span>
                      <span className="mt-1 text-[10px] leading-snug sm:text-xs" style={{ color: selected ? `${m.accent}bb` : '#819087' }}>
                        {m.sub}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onNewWorld}
                  className="notch col-span-2 flex min-h-[4.5rem] items-center justify-center gap-2.5 bg-gradient-to-b from-copper to-[#7d4522] px-3 py-2.5 text-pit-950 transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 sm:col-span-1 sm:min-h-[6.4rem] sm:flex-col sm:gap-1.5"
                >
                  <span className="font-display text-xl leading-none sm:text-2xl">↻</span>
                  <span className="font-display text-xs leading-tight sm:text-sm">{t('generateWorld')}</span>
                </button>
              </div>
            </section>

            {/* Custom world is deliberately directly beneath the mode/world choices. */}
            <section className="bevel-flat notch mt-3 flex w-full max-w-[900px] flex-col items-center gap-2.5 p-3 sm:flex-row sm:justify-between sm:gap-4 sm:px-4">
              <div className="min-w-0 text-center sm:text-left">
                <div className="font-display text-xs tracking-[0.13em] text-[#9dbdff] sm:text-sm sm:tracking-widest">
                  ∞ {t('createYourWorld')}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">{t('myWorldSub')}</div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onCreateWorld}
                  className="btn-mc notch bg-gradient-to-b from-[#6d95ff] to-[#3a5cb0] px-4 py-2.5 text-xs text-pit-950 sm:px-5 sm:py-3 sm:text-sm"
                >
                  {t('createWorld')}
                </button>
                {hasSave && (
                  <button
                    type="button"
                    onClick={onContinueWorld}
                    className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-4 py-2.5 text-xs text-white/85 sm:px-5 sm:py-3 sm:text-sm"
                  >
                    {t('continueWorld')}
                  </button>
                )}
              </div>
            </section>

            <div className="mt-4 grid w-full max-w-[900px] grid-cols-3 items-stretch gap-1.5 sm:mt-5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setShopTab('all');
                  setShowShop(true);
                }}
                className="btn-mc notch flex min-w-0 items-center justify-center gap-1.5 bg-gradient-to-b from-[#3c4e62] to-[#263442] px-2 py-3 text-[10px] text-white/90 sm:gap-2 sm:px-4 sm:py-3.5 sm:text-base"
              >
                <span aria-hidden="true" className="font-display text-lg leading-none text-[#62e8dc] sm:text-xl">◆</span>
                <span>{t('shop')}</span>
              </button>
              <button
                type="button"
                onClick={onPlay}
                className="btn-mc notch flex min-w-0 items-center justify-center gap-1.5 bg-gradient-to-b from-moss to-[#4d8c31] px-2 py-3 text-sm text-pit-950 sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-2xl"
              >
                <PlayIcon size={20} /> {t('play')}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="btn-mc notch flex min-w-0 items-center justify-center gap-1.5 bg-gradient-to-b from-pit-500 to-pit-700 px-1.5 py-3 text-[10px] text-white/85 sm:gap-2 sm:px-4 sm:py-3.5 sm:text-base"
              >
                <span aria-hidden="true" className="text-base leading-none sm:text-lg">⚙</span> {t('settings')}
              </button>
            </div>
          </main>

          {/* Records and compact item guide; stacks under the centered menu on tablet/mobile. */}
          <aside className="pointer-events-auto mx-auto flex w-full max-w-[680px] flex-col gap-3 xl:max-w-none xl:gap-4">
            {profile && <ProfileCard profile={profile} restored={cloudSavedAt > 0} onSignIn={onSignIn} />}
            <ScoreTable scores={scores} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 xl:gap-4">
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
                        {p.ing.map(([id, count]) => (
                          <span key={id} className="flex items-center gap-0.5">
                            <img src={getBlockIcon(id)} alt="" className="pixelated h-5 w-5" draggable={false} />
                            <span className="font-display text-[10px] text-white/50">×{count}</span>
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
                          {BLOCK_SCORE[id]} {t('pts')} · +{BLOCK_TIME[id]}{t('secShort')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showShop && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#05090b]/90 px-2 py-3 backdrop-blur-sm sm:px-5 sm:py-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-title"
            className="bevel notch my-auto flex max-h-[94vh] w-[min(98vw,1120px)] flex-col overflow-hidden border border-[#536c80]/70 bg-[#0b1115] shadow-[0_20px_80px_rgba(0,0,0,.8)]"
          >
            <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-[#15242b] via-[#182229] to-[#241c32] p-3 sm:gap-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#62e8dc]/45 bg-[#62e8dc]/10 font-display text-2xl text-[#62e8dc] sm:h-14 sm:w-14 sm:text-3xl">
                ◆
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="shop-title" className="font-display text-xl leading-none text-white sm:text-3xl">{t('shop')}</h2>
                <p className="mt-1 text-[10px] leading-snug text-white/55 sm:text-sm">{t('shopSubtitle')}</p>
              </div>
              <div className="hidden min-w-28 border border-[#62e8dc]/35 bg-black/25 px-3 py-1.5 text-right sm:block">
                <div className="font-display text-[9px] tracking-[0.2em] text-white/40">{t('shopDemoBalance')}</div>
                <div className="font-display text-lg leading-tight text-[#62e8dc]">◆ 0</div>
                <div className="text-[8px] text-white/35">{t('shopBalance')}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1 border border-[#62e8dc]/35 bg-black/25 px-2 py-1 font-display text-sm text-[#62e8dc] sm:hidden">◆ 0</div>
              <button
                type="button"
                aria-label={t('close')}
                onClick={() => setShowShop(false)}
                className="btn-mc notch flex h-9 shrink-0 items-center justify-center bg-gradient-to-b from-pit-500 to-pit-700 px-3 text-sm text-white/85 sm:h-11 sm:px-4 sm:text-base"
              >
                × <span className="ml-1 hidden sm:inline">{t('close')}</span>
              </button>
            </header>

            <div className="mx-2 mt-2 flex shrink-0 items-center gap-2 border border-[#62e8dc]/20 bg-gradient-to-r from-[#0c252b] to-[#171326] px-2.5 py-2 sm:mx-4 sm:mt-3 sm:px-3 sm:py-2.5">
              <span className="hidden font-display text-xl text-[#62e8dc] sm:inline">◇</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[9px] tracking-wide text-[#9cece7] sm:text-[10px]">{t('shopPortalCurrency')}</div>
                <p className="mt-0.5 text-[9px] leading-snug text-white/50 sm:text-[11px]">{t('shopMockNotice')}</p>
              </div>
              <span className="shrink-0 border border-white/10 bg-black/20 px-1.5 py-1 font-display text-[8px] tracking-widest text-white/45 sm:px-2 sm:text-[9px]">
                {t('shopMockBadge')}
              </span>
            </div>

            <nav aria-label={t('shop')} className="shop-tabs mt-2 flex shrink-0 gap-1.5 overflow-x-auto px-2 pb-1 sm:mt-3 sm:gap-2 sm:px-4">
              {SHOP_TABS.map((tab) => {
                const selected = shopTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setShopTab(tab.id)}
                    className={`notch shrink-0 px-2.5 py-2 font-display text-[9px] tracking-wide transition-all sm:px-3.5 sm:text-[10px] ${selected ? 'text-[#071012]' : 'bg-[#151d21] text-white/55 hover:text-white/85'}`}
                    style={selected ? { background: 'linear-gradient(180deg,#83eee3,#43bbb5)', border: '3px solid #62e8dc', boxShadow: '0 0 14px rgba(98,232,220,.2)' } : { border: '3px solid #06090a' }}
                  >
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </nav>

            {shopTab === 'boosters' && (
              <div className="mx-2 mt-1 flex shrink-0 items-start gap-2 border-l-2 border-[#f4b942] bg-[#f4b942]/[0.06] px-2.5 py-2 text-[10px] leading-snug text-white/65 sm:mx-4 sm:text-xs">
                <span className="text-[#f4b942]">⚡</span>{t('shopBoosterInfo')}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {filteredShopProducts.map((product) => {
                  const priceLabel = product.diamondAmount !== undefined
                    ? `${product.diamondAmount.toLocaleString()} ◆`
                    : product.diamondCost !== undefined
                      ? `${product.diamondCost.toLocaleString()} ◆`
                      : product.freeDrop
                        ? t('shopFree')
                        : t('shopPriceSoon');
                  return (
                    <article
                      key={product.id}
                      className="flex min-h-[220px] flex-col border bg-gradient-to-b from-[#172126] to-[#0c1215] p-2.5 shadow-[0_6px_18px_rgba(0,0,0,.24)] sm:min-h-[235px] sm:p-3"
                      style={{ borderColor: `${product.accent}45` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {product.rarityKey && (
                            <span className="border border-white/10 bg-black/25 px-1.5 py-1 font-display text-[8px] tracking-wide sm:text-[9px]" style={{ color: product.accent }}>
                              {t(product.rarityKey)}
                            </span>
                          )}
                          {product.badgeKey && (
                            <span className="border border-white/10 bg-black/25 px-1.5 py-1 font-display text-[8px] tracking-wide text-white/50 sm:text-[9px]">
                              {t(product.badgeKey)}
                            </span>
                          )}
                          {product.anyMode && (
                            <span className="border border-[#93c95d]/25 bg-[#93c95d]/[0.06] px-1.5 py-1 font-display text-[8px] tracking-wide text-[#a8d78a] sm:text-[9px]">
                              {t('shopAnyMode')}
                            </span>
                          )}
                          {product.accountBound && (
                            <span className="border border-[#f4b942]/25 bg-[#f4b942]/[0.06] px-1.5 py-1 font-display text-[8px] tracking-wide text-[#f4cb75] sm:text-[9px]">
                              {t('shopAccountBound')}
                            </span>
                          )}
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-black/20 font-display text-xl sm:h-10 sm:w-10 sm:text-2xl" style={{ color: product.accent }}>
                          {product.icon}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-sm leading-tight text-white sm:text-base">{t(product.titleKey)}</h3>
                      {product.diamondAmount !== undefined && (
                        <div className="mt-1 font-display text-lg leading-none text-[#62e8dc] sm:text-xl">
                          {product.diamondAmount.toLocaleString()} <span className="text-xs">◆ {t('shopBalance')}</span>
                        </div>
                      )}
                      <p className="mt-1.5 flex-1 text-[10px] leading-relaxed text-white/55 sm:text-[11px]">{t(product.descriptionKey)}</p>

                      <div className="mt-2 flex items-end justify-between gap-2 border-t border-white/10 pt-2">
                        <div>
                          <div className="font-display text-sm leading-tight" style={{ color: product.accent }}>{priceLabel}</div>
                          {product.rubles !== undefined && (
                            <div className="mt-0.5 font-display text-xs text-white/65">{product.rubles} ₽</div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled
                          title={t('shopMockNotice')}
                          className="notch shrink-0 cursor-not-allowed border-[3px] border-black/70 bg-gradient-to-b from-[#36404a] to-[#222b33] px-2.5 py-2 font-display text-[9px] tracking-wide text-white/45 opacity-80 sm:px-3 sm:text-[10px]"
                        >
                          {t('shopSoon')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-black/25 px-3 py-2 text-center text-[9px] leading-snug text-white/35 sm:px-4 sm:py-2.5 sm:text-[10px]">
              {t('shopMockNotice')}
            </footer>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-pit-950/85 px-3 py-4 backdrop-blur-sm sm:px-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="bevel notch my-auto max-h-[92vh] w-[min(94vw,720px)] overflow-y-auto p-4 shadow-[0_16px_60px_rgba(0,0,0,.7)] sm:p-6"
          >
            <header className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <h2 id="settings-title" className="flex items-center gap-2 font-display text-2xl text-torch sm:text-3xl">
                <span aria-hidden="true">⚙</span> {t('settings')}
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-3 py-2 text-xs text-white/85 sm:px-4 sm:text-sm"
              >
                × {t('close')}
              </button>
            </header>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-white/45">{t('language')}</div>
                <div className="flex flex-wrap gap-2">
                  {LANGS.map((l) => {
                    const selected = l.id === lang;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onLang(l.id)}
                        className={`notch flex items-center gap-1.5 px-2.5 py-2 font-display text-[10px] tracking-wide transition-all hover:-translate-y-0.5 sm:px-3 sm:text-xs ${selected ? 'text-pit-950' : 'text-white/55'}`}
                        style={{
                          background: selected ? 'linear-gradient(180deg,#f4d07a,#c99a2e)' : 'linear-gradient(180deg,#1b241f,#101713)',
                          border: `3px solid ${selected ? '#f4b942' : '#06090a'}`,
                        }}
                      >
                        <span className="text-sm">{l.flag}</span>{l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-white/45">{t('settings')}</div>
                <div className="flex flex-wrap gap-2">
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
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-white/45">{t('controls')}</div>
                <div className="grid gap-4 rounded-sm border border-white/10 bg-black/20 p-3 sm:grid-cols-2 sm:p-4">
                  <div>
                    <div className="mb-2 font-display text-xs tracking-widest text-torch">{t('keyboard')}</div>
                    <div className="space-y-1.5">
                      <Row k={<><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></>} v={t('move')} />
                      <Row k={<Key>V</Key>} v={t('togglePerspective')} />
                      <Row k={<Key>SPACE</Key>} v={t('jump')} />
                      <Row k={<Key wide>SHIFT</Key>} v={t('sprint')} />
                      <Row k={<Key wide>LMB</Key>} v={t('mineHold')} />
                      <Row k={<Key wide>RMB</Key>} v={t('placeBlock')} />
                      <Row k={<><Key>1</Key>–<Key>9</Key></>} v={t('selectSlot')} />
                      <Row k={<Key>I</Key>} v={t('bag')} />
                      <Row k={<Key>ESC</Key>} v={t('pause')} />
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/45">{t('lockNote')}</div>
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
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="btn-mc notch bg-gradient-to-b from-moss to-[#4d8c31] px-5 py-2.5 font-display text-sm text-pit-950"
              >
                {t('close')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const BLOCK_LABEL: Record<number, string> = { 3: 'Stone', 5: 'Coal', 6: 'Iron', 7: 'Gold', 8: 'Diamond', 9: 'Oak Log' };
const BLOCK_SCORE: Record<number, string> = { 3: '6', 5: '45', 6: '110', 7: '240', 8: '620', 9: '14' };
const BLOCK_TIME: Record<number, string> = { 3: '0', 5: '2', 6: '3.5', 7: '5', 8: '9', 9: '0' };

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
          {t('pausedSub')} · {hud.endless ? '∞' : fmtMinutes(hud.runTime)}
        </div>

        <div className="sunken notch mb-5 grid grid-cols-2 gap-px bg-white/5 p-px sm:grid-cols-4">
          <Stat icon={<TrophyIcon size={13} />} label={t('score')} value={hud.score.toLocaleString()} color="#f4b942" />
          <Stat icon={<ClockIcon size={13} />} label={t('shift')} value={hud.endless ? '∞' : `${Math.ceil(hud.timeLeft)}${t('secShort')}`} color="#e8efe9" />
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
            {t('runReport')} · {hud.endless ? '∞' : fmtMinutes(hud.runTime)}
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
