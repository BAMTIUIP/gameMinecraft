import { useEffect, useMemo, useRef, useState } from 'react';
import type { HudState } from '../game/engine';

import { getBlockIcon } from '../game/textures';
import type { ScoreEntry } from './scores';
import { blockName, LANGS, matName, t, type Lang, type TKey } from '../game/i18n';
import type { YaProfile } from '../game/yandex';
import type { LeaderboardView } from '../game/leaderboard';

import { FitBox } from './FitBox';
import { GAME_NAME_LINES } from '../game/brand';
import { AD_FREE_PRODUCT_ID, type ShopCatalog, type ShopItemBuyResult } from '../game/shop';
import { developerShopClaims } from '../game/devShop';
import { dailyReward, dailySecondsUntilReset } from '../game/daily';
import { yaServerTime } from '../game/yandex';
import { CHARACTER_COLORS, CHARACTER_EXPRESSIONS, CHARACTER_GLASSES, CHARACTER_HAIRSTYLES as SUPPORTED_HAIRSTYLES, type CharacterCustomization, type CharacterExpression, type CharacterGender, type CharacterGlasses, type CharacterHairstyle, type CharacterShoeType } from '../game/character';
import { characterFacePixels } from '../game/characterVisuals';
import { fullscreenAvailable } from '../game/params';
import { BLOCKS } from '../game/blocks';
import { isRewardedDrop, rewardedDropStatuses, type RewardedDropClaimResult, type RewardedDropId } from '../game/adDrops';
import { ShopArtwork } from './ShopArtwork';
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

/**
 * Platform avatar with a graceful fallback: `getPhoto()` may return a URL that no longer resolves
 * (expired link, offline device), and a broken-image glyph on screen is exactly the "битая иконка"
 * requirement 1.15 forbids. On any load error the placeholder takes over.
 */
function Avatar({ src, className, fallback }: { src?: string | null; className: string; fallback?: React.ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <>{fallback ?? null}</>;
  return (
    <img
      src={src}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function formatCountdown(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
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

type ShopCategory = 'gear' | 'drops' | 'boosters' | 'pets';
type ShopFilter = 'all' | 'weapons' | 'armor' | 'offers' | 'rewards' | 'pets';
type ShopMode = 'store' | 'developer';
type ShopProduct = {
  id: string;
  category: ShopCategory;
  titleKey: TKey;
  descriptionKey: TKey;
  icon: string;
  accent: string;
  freeDrop?: boolean;
  badgeKey?: TKey;
  rarityKey?: TKey;
  anyMode?: boolean;
  accountBound?: boolean;
};

const SHOP_TABS: ReadonlyArray<{ id: ShopFilter; labelKey: TKey }> = [
  { id: 'all', labelKey: 'shopTabAll' },
  { id: 'weapons', labelKey: 'shopTabWeapon' },
  { id: 'armor', labelKey: 'shopTabArmor' },
  { id: 'offers', labelKey: 'shopTabBoosters' },
  { id: 'pets', labelKey: 'shopTabPets' },
  { id: 'rewards', labelKey: 'shopTabRewards' },
];

function productMatchesShopTab(product: ShopProduct, tab: ShopFilter) {
  if (tab === 'all') return true;
  if (tab === 'weapons') return product.id === 'netherite-pickaxe';
  if (tab === 'armor') return product.id === 'netherite-armor' || product.id.startsWith('armor-');
  if (tab === 'offers') return product.category === 'boosters';
  if (tab === 'pets') return product.category === 'pets';
  return product.category === 'drops';
}

function shopTabForProduct(product: ShopProduct | undefined): ShopFilter {
  if (!product) return 'offers';
  if (productMatchesShopTab(product, 'weapons')) return 'weapons';
  if (productMatchesShopTab(product, 'armor')) return 'armor';
  if (productMatchesShopTab(product, 'pets')) return 'pets';
  if (productMatchesShopTab(product, 'rewards')) return 'rewards';
  return 'offers';
}

const SHOP_PRODUCTS: readonly ShopProduct[] = [
  { id: 'armor-uncommon', category: 'gear', titleKey: 'shopArmorUncommonTitle', descriptionKey: 'shopArmorUncommonDesc', icon: '▣', accent: '#75c884', rarityKey: 'shopRarityCommon' },
  { id: 'armor-rare', category: 'gear', titleKey: 'shopArmorRareTitle', descriptionKey: 'shopArmorRareDesc', icon: '▣', accent: '#6ca7ff', rarityKey: 'shopRarityRare' },
  { id: 'armor-epic', category: 'gear', titleKey: 'shopArmorEpicTitle', descriptionKey: 'shopArmorEpicDesc', icon: '▣', accent: '#bd8cff', rarityKey: 'shopRarityEpic' },
  { id: 'netherite-pickaxe', category: 'gear', titleKey: 'shopNetheritePickaxeTitle', descriptionKey: 'shopNetheritePickaxeDesc', icon: '⛏', accent: '#edaa77', rarityKey: 'shopRarityLegendary' },
  { id: 'netherite-armor', category: 'gear', titleKey: 'shopNetheriteArmorTitle', descriptionKey: 'shopNetheriteArmorDesc', icon: '▣', accent: '#edaa77', rarityKey: 'shopRarityLegendary' },
  { id: 'pet-wolf', category: 'pets', titleKey: 'shopPetWolfTitle', descriptionKey: 'shopPetWolfDesc', icon: '🐺', accent: '#c59b66', badgeKey: 'shopPermanentBadge', anyMode: true, accountBound: true },
  { id: 'pet-monkey', category: 'pets', titleKey: 'shopPetMonkeyTitle', descriptionKey: 'shopPetMonkeyDesc', icon: '🐒', accent: '#bf8c56', badgeKey: 'shopPermanentBadge', anyMode: true, accountBound: true },

  { id: 'drop-daily', category: 'drops', titleKey: 'shopDailyStarterTitle', descriptionKey: 'shopDailyStarterDesc', icon: '▣', accent: '#f4b942', freeDrop: true, badgeKey: 'shopDaily' },
  { id: 'drop-weekly', category: 'drops', titleKey: 'shopWeeklyDropTitle', descriptionKey: 'shopWeeklyDropDesc', icon: '✦', accent: '#62e8dc', freeDrop: true, badgeKey: 'shopWeekly' },
  { id: 'drop-monthly', category: 'drops', titleKey: 'shopMonthlyDropTitle', descriptionKey: 'shopMonthlyDropDesc', icon: '▣', accent: '#bd8cff', freeDrop: true, badgeKey: 'shopMonthly', rarityKey: 'shopRarityEpic' },
  { id: 'chest-common', category: 'drops', titleKey: 'shopChestCommonTitle', descriptionKey: 'shopChestCommonDesc', icon: '▣', accent: '#9ca9ba', rarityKey: 'shopRarityCommon' },
  { id: 'chest-rare', category: 'drops', titleKey: 'shopChestRareTitle', descriptionKey: 'shopChestRareDesc', icon: '▣', accent: '#6ca7ff', rarityKey: 'shopRarityRare' },
  { id: 'chest-epic', category: 'drops', titleKey: 'shopChestEpicTitle', descriptionKey: 'shopChestEpicDesc', icon: '▣', accent: '#bd8cff', rarityKey: 'shopRarityEpic' },

  { id: 'booster-start', category: 'boosters', titleKey: 'shopBoosterStartTitle', descriptionKey: 'shopBoosterStartDesc', icon: '⚡', accent: '#f4b942', badgeKey: 'shopNextRunBadge' },
  { id: 'booster-ore', category: 'boosters', titleKey: 'shopBoosterOreTitle', descriptionKey: 'shopBoosterOreDesc', icon: '⛏', accent: '#62e8dc', badgeKey: 'shopNextRunBadge' },
  { id: 'booster-score', category: 'boosters', titleKey: 'shopBoosterScoreTitle', descriptionKey: 'shopBoosterScoreDesc', icon: '✦', accent: '#bd8cff', badgeKey: 'shopNextRunBadge' },
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

/* ============================ LEADERBOARD ============================= */

/**
 * World ranking (ysdk.leaderboards). The platform limits the requests, so the panel does not ask on
 * its own: it draws whatever App has loaded, and the refresh button is disabled until the game is
 * allowed to ask again.
 */
function LeaderboardTable({
  view,
  busy,
  available,
  canRefresh,
  onRefresh,
}: {
  view: LeaderboardView | null;
  busy: boolean;
  available: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
}) {
  const rank = view?.userRank ?? 0;
  return (
    <div className="sunken notch overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#2b4a5c] to-[#1f3644] px-2.5 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 font-display text-xs tracking-widest text-[#62e8dc]">
          <TrophyIcon size={13} />
          <span className="truncate">{view?.title ?? t('lbTabWorld')}</span>
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy || !canRefresh || !available}
          className="shrink-0 border border-white/15 px-1.5 py-0.5 font-display text-[9px] tracking-widest text-white/60 transition-colors hover:text-white disabled:opacity-40"
        >
          {busy ? t('lbLoading') : t('lbRetry')}
        </button>
      </div>

      {!available ? (
        <div className="px-2.5 py-3 text-[11px] leading-snug text-white/45">{t('lbOffline')}</div>
      ) : !view ? (
        <div className="px-2.5 py-3 text-[11px] leading-snug text-white/45">{busy ? t('lbLoading') : t('lbError')}</div>
      ) : view.rows.length === 0 ? (
        <div className="px-2.5 py-3 text-[11px] leading-snug text-white/45">{t('lbEmpty')}</div>
      ) : (
        <div className="max-h-[38vh] overflow-y-auto">
          {view.rows.map((row, i) => (
            <div
              key={`${row.rank}-${row.name}-${i}`}
              className={`flex items-center gap-2 border-b border-white/5 px-2.5 py-1.5 text-[11px] transition-colors ${
                row.me ? 'bg-[#62e8dc]/15' : i % 2 ? 'bg-white/[0.02]' : ''
              }`}
            >
              <span className={`w-5 font-display text-sm ${row.rank === 1 ? 'text-torch' : 'text-white/35'}`}>{row.rank}</span>
              <Avatar
                src={row.avatar}
                className="h-5 w-5 shrink-0 border border-white/15 object-cover"
                fallback={<span className="h-5 w-5 shrink-0 border border-white/10 bg-white/5" aria-hidden="true" />}
              />
              <span className={`flex-1 truncate font-display text-sm tracking-wide ${row.me ? 'text-[#62e8dc]' : 'text-white/85'} ${row.hidden ? 'italic text-white/35' : ''}`}>
                {row.hidden ? t('lbHiddenPlayer') : row.name}
                {row.me && <span className="ml-1.5 align-middle text-[9px] text-moss">◀ {t('lbYou')}</span>}
              </span>
              <span className="w-16 text-right font-display text-base tabular-nums text-white">{row.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 bg-white/[0.03] px-2.5 py-1.5">
        <span className="font-display text-[10px] tracking-wider text-white/45">
          {available && view ? (rank > 0 ? t('lbYourRank').replace('{n}', String(rank)) : t('lbNoRank')) : t('lbRefreshed')}
        </span>
        {rank > 0 && <span className="font-display text-[9px] text-white/25">{t('lbRefreshed')}</span>}
      </div>
    </div>
  );
}

/** Tabs above the score table: the local shifts the game always keeps, and the world ranking. */
function ScorePanel({
  scores,
  highlight,
  leaderboard,
  leaderboardBusy,
  leaderboardAvailable,
  leaderboardCooldown,
  onLoadLeaderboard,
}: {
  scores: ScoreEntry[];
  highlight?: string;
  leaderboard: LeaderboardView | null;
  leaderboardBusy: boolean;
  leaderboardAvailable: boolean;
  leaderboardCooldown: number;
  onLoadLeaderboard: () => void;
}) {
  const [tab, setTab] = useState<'local' | 'world'>('local');
  useEffect(() => {
    if (tab === 'world') onLoadLeaderboard();
  }, [tab, onLoadLeaderboard]);

  if (!leaderboardAvailable && !leaderboard) return <ScoreTable scores={scores} highlight={highlight} />;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-px">
        {(['local', 'world'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`notch flex-1 px-2 py-1 font-display text-[10px] tracking-widest transition-colors ${
              tab === id ? 'bg-torch text-pit-950' : 'bg-white/5 text-white/45 hover:text-white/75'
            }`}
          >
            {t(id === 'local' ? 'lbTabLocal' : 'lbTabWorld')}
          </button>
        ))}
      </div>
      {tab === 'local' ? (
        <ScoreTable scores={scores} highlight={highlight} />
      ) : (
        <LeaderboardTable
          view={leaderboard}
          busy={leaderboardBusy}
          available={leaderboardAvailable}
          canRefresh={leaderboardCooldown <= 0}
          onRefresh={onLoadLeaderboard}
        />
      )}
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
          <Avatar
            src={profile.photo}
            className="h-full w-full object-cover"
            fallback={<span className="flex h-full w-full items-center justify-center font-display text-lg text-white/45">?</span>}
          />
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
  shopEnabled,
  developerShopEnabled,
  shopPrices,
  wolfPetOwned,
  monkeyPetOwned,
  onOpenShop,
  paymentsAvailable,
  adFreeOwned,
  adFreeBusy,
  adFreeNotice,
  onBuyAdFree,
  rewardedAdsEnabled,
  onBuyShopItem,
  onClaimRewardedDrop,
  onDeveloperClaim,
  leaderboard,
  leaderboardBusy,
  leaderboardAvailable,
  leaderboardCooldown,
  onLoadLeaderboard,
  canShortcut,
  onShortcut,
  shortcutNote,
  promo,
  onClaimDaily,
  dailyBusy,
  dailyNote,
  fullscreen,
  onSettingsOpen,
  onFullscreen,
  character,
  onSaveCharacter,
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
  /** remote-config flag shop.enabled: the shop button disappears when the flag turns it off */
  shopEnabled: boolean;
  /** visible only in DEV or an explicit temporary test preview, and never on a TV */
  developerShopEnabled: boolean;
  /** prices from the Yandex Console catalogue, keyed by product id */
  shopPrices: ShopCatalog;
  /** restored permanent companion ownership; prevents another purchase for the same account */
  wolfPetOwned: boolean;
  monkeyPetOwned: boolean;
  /** retries the catalogue request when the shop is opened after an initial failure */
  onOpenShop: () => void;
  /** true when the payment flow exists (inside Yandex Games with purchases connected) */
  paymentsAvailable: boolean;
  /** whether the permanent disable_ads entitlement has been restored or just purchased */
  adFreeOwned: boolean;
  /** true while the permanent ad-free purchase frame is open */
  adFreeBusy: boolean;
  /** localized feedback for a cancelled or unavailable ad-free purchase */
  adFreeNotice: string | null;
  /** opens the permanent ad-free product only when it is present in the active catalogue */
  onBuyAdFree: () => void;
  /** true only when rewarded ads are enabled and the SDK exposes a rewarded-video method */
  rewardedAdsEnabled: boolean;
  /** buys a catalogue SKU directly with Yandex Games platform currency */
  onBuyShopItem: (productId: string) => Promise<ShopItemBuyResult>;
  /** asks for a rewarded video, then commits the drop only when its reward callback was counted */
  onClaimRewardedDrop: (dropId: RewardedDropId) => Promise<RewardedDropClaimResult>;
  /** grant one local free test entitlement; no platform payment or purchase is made */
  onDeveloperClaim: (productId: string) => Promise<boolean>;
  /** world ranking from ysdk.leaderboards, null until the first successful request */
  leaderboard: LeaderboardView | null;
  leaderboardBusy: boolean;
  leaderboardAvailable: boolean;
  /** milliseconds until the platform allows the next getEntries call (0 = now) */
  leaderboardCooldown: number;
  onLoadLeaderboard: () => void;
  /** the platform can show the desktop-shortcut dialog on this device (shortcut.canShowPrompt) */
  canShortcut: boolean;
  onShortcut: () => void;
  /** result of the shortcut dialog: added (with the reward) / dismissed / failed */
  shortcutNote: string | null;
  /** promo deep link: the shop should open on this product, with the campaign banner visible */
  promo: { productId: string | null; promoId: string } | null;
  /** opens a rewarded video for the daily supply bonus */
  onClaimDaily: () => void;
  dailyBusy: boolean;
  /** brief result of the last ad attempt */
  dailyNote: string | null;
  /** is the browser in fullscreen right now (sdk-params); the toggle lives in the settings dialog */
  fullscreen: boolean;
  /** refreshes the SDK's current fullscreen status when settings open */
  onSettingsOpen: () => void;
  onFullscreen: () => void;
  /** current avatar choices, loaded from local/cloud profile */
  character: CharacterCustomization;
  /** commits the look to local storage and the player's cloud profile */
  onSaveCharacter: (next: CharacterCustomization) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showCharacterCreator, setShowCharacterCreator] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopMode, setShopMode] = useState<ShopMode>('store');
  const [shopTab, setShopTab] = useState<ShopFilter>('all');
  const shopCarouselRef = useRef<HTMLDivElement>(null);
  const [activeShopCard, setActiveShopCard] = useState(0);
  const [devClaims, setDevClaims] = useState<string[]>(() => developerShopClaims());
  const [promoProductId, setPromoProductId] = useState<string | null>(null);

  // A promo banner in the catalogue opens the game with `referrer=promo`: take the player straight
  // to the promised screen instead of leaving them on the main menu (sdk-environment).
  useEffect(() => {
    if (!promo || !shopEnabled) return;
    setShopTab(promo.productId ? shopTabForProduct(SHOP_PRODUCTS.find((product) => product.id === promo.productId)) : 'offers');
    setPromoProductId(promo.productId);
    setShopMode('store');
    setShowShop(true);
    onOpenShop();
  }, [promo, shopEnabled, onOpenShop]);
  const [buying, setBuying] = useState<string | null>(null);
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => yaServerTime());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(yaServerTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const daily = dailyReward();
  const dailyAvailableLabel = dailyBusy
    ? t('shopBuying')
    : !rewardedAdsEnabled
      ? t('shopAdUnavailable')
      : dailyNote ?? [
          t('dailyTitle'),
          t('dailySupplies'),
          t('shopWatchAd'),
          t('dailyStreak').replace('{n}', String(daily.streak)),
        ].join(' · ');
  const adFreePrice = shopPrices.get(AD_FREE_PRODUCT_ID);
  // Requirement 1.13.6: a real-money offer must exist in the active Yandex catalogue. Do not show
  // stale/inactive Console SKUs as disabled pseudo-offers; outside Yandex the shop remains a preview.
  const visibleShopProducts = useMemo(
    () => SHOP_PRODUCTS.filter((product) =>
      shopMode !== 'store' || !paymentsAvailable || product.freeDrop || shopPrices.has(product.id),
    ),
    [shopMode, paymentsAvailable, shopPrices],
  );
  const filteredShopProducts = useMemo(
    () => visibleShopProducts.filter((product) => productMatchesShopTab(product, shopTab)),
    [visibleShopProducts, shopTab],
  );
  const rewardedDrops = rewardedDropStatuses(clockNow);

  const centerShopCard = (carousel: HTMLElement, card: HTMLElement) => {
    const carouselRect = carousel.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const delta = cardRect.left + cardRect.width / 2 - (carouselRect.left + carousel.clientWidth / 2);
    carousel.scrollLeft += delta;
  };

  useEffect(() => {
    const products = visibleShopProducts.filter((product) => productMatchesShopTab(product, shopTab));
    const targetIndex = products.findIndex((product) => product.id === promoProductId);
    const frame = window.requestAnimationFrame(() => {
      const carousel = shopCarouselRef.current;
      if (!carousel) return;
      if (targetIndex >= 0) {
        const promotedCard = carousel.querySelector<HTMLElement>(`[data-shop-product="${products[targetIndex].id}"]`);
        if (promotedCard) centerShopCard(carousel, promotedCard);
        setActiveShopCard(targetIndex);
      } else {
        carousel.scrollTo({ left: 0, behavior: 'auto' });
        setActiveShopCard(0);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleShopProducts, shopTab, promoProductId, showShop]);

  const syncActiveShopCard = () => {
    const carousel = shopCarouselRef.current;
    if (!carousel) return;
    const cards = Array.from(carousel.querySelectorAll<HTMLElement>('[data-shop-product]'));
    if (!cards.length) return;
    const center = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    setActiveShopCard((current) => current === nearest ? current : nearest);
  };

  const moveShopCarousel = (direction: -1 | 1) => {
    const carousel = shopCarouselRef.current;
    if (!carousel) return;
    const cards = Array.from(carousel.querySelectorAll<HTMLElement>('[data-shop-product]'));
    if (!cards.length) return;
    const next = Math.max(0, Math.min(cards.length - 1, activeShopCard + direction));
    const currentRect = cards[activeShopCard]?.getBoundingClientRect();
    const targetRect = cards[next]?.getBoundingClientRect();
    if (currentRect && targetRect) {
      const delta = targetRect.left + targetRect.width / 2 - (currentRect.left + currentRect.width / 2);
      carousel.scrollLeft += delta;
    }
    setActiveShopCard(next);
  };
  const modes = [
    { id: 'survival', on: true, label: t('survival'), sub: t('survivalSub'), accent: '#e2564a', icon: '☠' },
    { id: 'explorer', on: false, label: t('explorer'), sub: t('explorerSub'), accent: '#5fe8dc', icon: '✦' },
  ];

  return (
    <div className="absolute inset-0 z-30 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(38,55,43,.52)_0%,rgba(6,10,9,.88)_58%,rgba(4,7,6,.97)_100%)]" />
      <div className="pointer-events-none absolute inset-0 grain opacity-35" />

      {/* FitBox keeps the whole menu on screen at short window sizes (requirement 1.10) */}
      <FitBox className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-7 xl:px-10">
        <div className="menu-grid grid w-full grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(350px,430px)] xl:gap-10">
          {/* Centered title and primary choices */}
          <main className="menu-main pointer-events-auto mx-auto flex w-full max-w-[980px] flex-col items-center text-center">
            <div className="menu-eyebrow mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.38em] text-torch/80 sm:text-[11px] sm:tracking-[0.46em]">
              <span className="h-px w-7 bg-torch/60 sm:w-10" />
              {t('tagline')}
              <span className="h-px w-7 bg-torch/60 sm:w-10" />
            </div>

            {/* The name itself comes from GAME_NAME (requirement 5.1.3): it is never translated and
                never typed twice, so it cannot drift from the draft's name field. */}
            <h1 className="menu-title font-display leading-[0.8]">
              {GAME_NAME_LINES.map((part, index) => (
                <span
                  key={part}
                  className={`block text-[clamp(3.4rem,10vw,7.5rem)] ${index === 0 ? 'text-transparent' : 'anim-flicker text-torch'} ${index === 0 ? '' : index === 1 ? '-mt-1 sm:-mt-3' : ''}`}
                  style={
                    index === 0
                      ? { WebkitTextStroke: '3px #f4b942' }
                      : { textShadow: '0 0 44px rgba(244,185,66,.42), 5px 5px 0 #05080a' }
                  }
                >
                  {part}
                </span>
              ))}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:mt-4 sm:text-base lg:text-lg">{t('intro')}</p>

            {/* Mode selection and fresh-world generation stay together as the main menu's first action row. */}
            <section className="menu-modes mt-5 w-full max-w-[900px]" aria-label={t('mode')}>
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
            <section className="menu-custom bevel-flat notch mt-3 flex w-full max-w-[900px] flex-col items-center gap-2.5 p-3 sm:flex-row sm:justify-between sm:gap-4 sm:px-4">
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

            <button
              type="button"
              data-daily-bonus="1"
              disabled={!daily.available || !rewardedAdsEnabled || dailyBusy}
              onClick={onClaimDaily}
              title={daily.available
                ? rewardedAdsEnabled ? t('dailyTitle') : t('shopAdUnavailable')
                : t('dailyNextReset').replace('{time}', formatCountdown(dailySecondsUntilReset(clockNow)))}
              className={`menu-daily mt-4 flex w-full max-w-[900px] items-center justify-center gap-2 border px-3 py-2 font-display text-[10px] tracking-wide transition-all sm:mt-5 sm:text-xs ${
                daily.available && rewardedAdsEnabled && !dailyBusy
                  ? 'border-[#f4b942]/60 bg-[#f4b942]/[0.12] text-[#f4b942] hover:bg-[#f4b942]/20'
                  : 'border-white/10 bg-black/20 text-white/40'
              }`}
            >
              <CubeIcon size={14} className="shrink-0" />
              <span>
                {daily.available
                  ? dailyAvailableLabel
                  : t('dailyNextReset').replace('{time}', formatCountdown(dailySecondsUntilReset(clockNow)))}
              </span>
            </button>

            <div
              className={`menu-actions mt-1.5 grid w-full max-w-[900px] items-stretch gap-1.5 sm:mt-3 sm:gap-3 ${shopEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
              {shopEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setShopMode('store');
                    setShopTab('all');
                    setShowShop(true);
                    onOpenShop();
                  }}
                  className="btn-mc notch flex min-w-0 items-center justify-center gap-1.5 bg-gradient-to-b from-[#3c4e62] to-[#263442] px-2 py-3 text-[10px] text-white/90 sm:gap-2 sm:px-4 sm:py-3.5 sm:text-base"
                >
                  <BagIcon size={18} className="shrink-0" />
                  <span>{t('shop')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onPlay}
                className="btn-mc notch flex min-w-0 items-center justify-center gap-1.5 bg-gradient-to-b from-moss to-[#4d8c31] px-2 py-3 text-sm text-pit-950 sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-2xl"
              >
                <PlayIcon size={20} /> {t('play')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSettingsOpen();
                  setShowSettings(true);
                }}
                className="btn-mc notch flex min-w-0 items-center justify-center gap-1.5 bg-gradient-to-b from-pit-500 to-pit-700 px-1.5 py-3 text-[10px] text-white/85 sm:gap-2 sm:px-4 sm:py-3.5 sm:text-base"
              >
                <span aria-hidden="true" className="text-base leading-none sm:text-lg">⚙</span> {t('settings')}
              </button>
            </div>
            {adFreeOwned ? (
              <div
                data-ad-free-owned="1"
                role="status"
                className="mt-1.5 inline-flex min-h-6 items-center gap-1.5 border border-white/10 bg-black/15 px-2 py-1 font-display text-[9px] tracking-wide text-white/35"
              >
                <span aria-hidden="true" className="text-moss">✓</span>{t('adFreeOwned')}
              </div>
            ) : shopEnabled && paymentsAvailable && adFreePrice ? (
              <div className="mt-1.5 flex flex-col items-center gap-1">
                <button
                  type="button"
                  data-ad-free-purchase="1"
                  aria-busy={adFreeBusy}
                  aria-label={`${t('adFreeCta')} · ${adFreePrice.label}`}
                  disabled={adFreeBusy}
                  onClick={onBuyAdFree}
                  className="inline-flex min-h-6 max-w-full flex-wrap items-center justify-center gap-1.5 border border-white/10 bg-black/15 px-2 py-1 font-display text-[9px] tracking-wide text-white/40 transition-colors hover:border-white/20 hover:text-white/70 disabled:cursor-wait disabled:opacity-50"
                >
                  <span aria-hidden="true" className="text-white/30">⊘</span>
                  <span>{adFreeBusy ? t('adFreeBuying') : t('adFreeCta')}</span>
                  <span aria-hidden="true" className="text-white/20">·</span>
                  {adFreePrice.currencyIcon && (
                    <img
                      data-ad-free-currency="1"
                      src={adFreePrice.currencyIcon}
                      alt=""
                      className="h-3.5 w-3.5"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span>{adFreePrice.label}</span>
                </button>
                {adFreeNotice && <span data-ad-free-notice="1" role="status" className="text-[9px] text-white/40">{adFreeNotice}</span>}
              </div>
            ) : null}
            <button
              type="button"
              data-character-creator="1"
              onClick={() => setShowCharacterCreator(true)}
              className="mt-2 flex w-full max-w-[900px] items-center justify-center gap-2 border border-[#8c58bd]/45 bg-gradient-to-r from-[#38264a]/70 via-[#1a1d20]/90 to-[#263846]/70 px-3 py-2.5 font-display text-[10px] tracking-[0.16em] text-[#d7bcff] transition-all hover:border-[#c49aff]/75 hover:brightness-125 sm:mt-3 sm:text-xs"
            >
              <span aria-hidden="true" className="text-lg">🧍</span>
              {t('characterCreator')}
              <span className="text-white/35">·</span>
              <span className="text-white/55">{t(character.gender === 'girl' ? 'characterGirl' : 'characterBoy')}</span>
            </button>
            {developerShopEnabled && (
              <button
                type="button"
                data-developer-shop="1"
                onClick={() => {
                  setShopMode('developer');
                  setShopTab('all');
                  setShopNotice(null);
                  setShowShop(true);
                }}
                className="mt-2 flex w-full max-w-[900px] items-center justify-center gap-2 border border-[#f4b942]/45 bg-[#f4b942]/[0.08] px-3 py-2 font-display text-[9px] tracking-[0.18em] text-[#f4d283] transition-colors hover:bg-[#f4b942]/15 sm:text-[10px]"
              >
                <span aria-hidden="true">⚒</span>{t('devShopButton')}<span aria-hidden="true" className="text-white/30">·</span>{t('devShopFreeBadge')}
              </button>
            )}
          </main>

          {/* Records and compact item guide; stacks under the centered menu on tablet/mobile. */}
          <aside className="menu-aside pointer-events-auto mx-auto flex w-full max-w-[680px] flex-col gap-3 xl:max-w-none xl:gap-4">
            {profile && <ProfileCard profile={profile} restored={cloudSavedAt > 0} onSignIn={onSignIn} />}
            <ScorePanel
              scores={scores}
              leaderboard={leaderboard}
              leaderboardBusy={leaderboardBusy}
              leaderboardAvailable={leaderboardAvailable}
              leaderboardCooldown={leaderboardCooldown}
              onLoadLeaderboard={onLoadLeaderboard}
            />
            <div className="menu-guide grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 xl:gap-4">
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
      </FitBox>

      {showShop && (shopEnabled || developerShopEnabled) && (
        <div className="shop-backdrop absolute inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#05090b]/90 px-2 py-3 backdrop-blur-sm sm:px-5 sm:py-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-title"
            className="shop-dialog bevel notch my-auto flex min-h-0 w-[min(98vw,1120px)] flex-col overflow-hidden border border-[#536c80]/70 bg-[#0b1115] shadow-[0_20px_80px_rgba(0,0,0,.8)]"
          >
            <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-[#15242b] via-[#182229] to-[#241c32] p-3 sm:gap-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#62e8dc]/25 bg-[#62e8dc]/[0.06] sm:h-14 sm:w-14">
                <BagIcon size={28} className="text-[#9cece7]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="shop-title" className="font-display text-xl leading-none text-white sm:text-3xl">{shopMode === 'developer' ? t('devShopTitle') : t('shop')}</h2>
                <p className="mt-1 text-[10px] leading-snug text-white/55 sm:text-sm">{shopMode === 'developer' ? t('devShopSubtitle') : t('shopSubtitle')}</p>
              </div>
              <button
                type="button"
                aria-label={t('close')}
                onClick={() => setShowShop(false)}
                className="btn-mc notch flex h-9 shrink-0 items-center justify-center bg-gradient-to-b from-pit-500 to-pit-700 px-3 text-sm text-white/85 sm:h-11 sm:px-4 sm:text-base"
              >
                × <span className="ml-1 hidden sm:inline">{t('close')}</span>
              </button>
            </header>

            <div className="shop-payment-note mx-2 mt-2 flex shrink-0 items-center gap-2 border border-[#62e8dc]/20 bg-gradient-to-r from-[#0c252b] to-[#171326] px-2.5 py-2 sm:mx-4 sm:mt-3 sm:px-3 sm:py-2.5">
              <BagIcon size={20} className="shrink-0 text-[#9cece7]" />
              <p className="min-w-0 flex-1 text-[9px] leading-snug text-white/50 sm:text-[11px]">
                {shopMode === 'developer' ? t('devShopNotice') : paymentsAvailable ? t('shopRealNotice') : t('shopMockNotice')}
              </p>
              <span className="shrink-0 border border-white/10 bg-black/20 px-1.5 py-1 font-display text-[8px] tracking-widest text-white/45 sm:px-2 sm:text-[9px]">
                {shopMode === 'developer' ? t('devShopFreeBadge') : paymentsAvailable ? t('shopLiveBadge') : t('shopMockBadge')}
              </span>
            </div>

            {promo && (
              <div className="shop-promo-banner mx-2 mt-2 flex shrink-0 items-center gap-2 border-l-2 border-[#f4b942] bg-[#f4b942]/[0.08] px-2.5 py-2 text-[10px] leading-snug text-white/70 sm:mx-4 sm:text-xs">
                <span className="text-[#f4b942]">★</span>
                <span className="min-w-0 flex-1">
                  <b className="font-display tracking-wide text-[#f4b942]">{t('promoBanner').replace('{id}', promo.promoId)}</b>
                  <span className="ml-1.5 text-white/50">{t('promoHint')}</span>
                </span>
              </div>
            )}

            <div id="shop-catalog" className="shop-catalog min-h-0 flex-1 overflow-hidden px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3">
              <div className="shop-carousel-stage">
                <div
                  ref={shopCarouselRef}
                  data-shop-carousel="true"
                  role="list"
                  onScroll={syncActiveShopCard}
                  className="shop-carousel"
                >
                  {filteredShopProducts.map((product) => {
                  const catalogPrice = shopPrices.get(product.id);
                  const promoted = promoProductId === product.id;
                  const developerMode = shopMode === 'developer';
                  const rewardedDrop = isRewardedDrop(product.id);
                  const dropStatus = rewardedDrop ? rewardedDrops[product.id as RewardedDropId] : null;
                  const devAlreadyClaimed = devClaims.includes(product.id);
                  const alreadyOwned = product.id === 'pet-wolf' ? wolfPetOwned : product.id === 'pet-monkey' && monkeyPetOwned;
                  const dropStatusLabel = rewardedDrop && dropStatus && !dropStatus.available
                    ? product.id === 'drop-daily'
                      ? t('shopDropCooldown').replace('{time}', formatCountdown(dailySecondsUntilReset(clockNow)))
                      : t('shopLoginProgress').replace('{days}', String(dropStatus.progress)).replace('{goal}', String(dropStatus.goal))
                    : '';
                  const purchasable = !alreadyOwned && (developerMode
                    ? !devAlreadyClaimed
                    : rewardedDrop
                      ? rewardedAdsEnabled && Boolean(dropStatus?.available)
                      : paymentsAvailable && Boolean(catalogPrice));
                  const priceLabel: React.ReactNode = developerMode
                    ? t('devShopPrice')
                    : rewardedDrop
                      ? t('shopRewardedPrice')
                      : catalogPrice?.label ?? (paymentsAvailable ? t('shopPriceUnavailable') : t('shopPaymentsUnavailable'));
                  return (
                    <article
                      key={product.id}
                      data-shop-product={product.id}
                      role="listitem"
                      tabIndex={-1}
                      className="shop-product-card flex min-h-[220px] flex-col snap-center border bg-gradient-to-b from-[#172126] to-[#0c1215] p-2.5 shadow-[0_6px_18px_rgba(0,0,0,.24)] sm:min-h-[235px] sm:p-3"
                      style={{
                        borderColor: promoted ? '#f4b942' : `${product.accent}45`,
                        boxShadow: promoted ? '0 0 0 1px #f4b94255, 0 6px 22px rgba(244,185,66,.18)' : undefined,
                      }}
                    >
                      <div className="shop-product-meta flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {product.rarityKey && (
                            <span className="border border-white/10 bg-black/25 px-1.5 py-1 font-display text-[8px] tracking-wide sm:text-[9px]" style={{ color: product.accent }}>
                              {t(product.rarityKey)}
                            </span>
                          )}
                          {promoted && (
                            <span className="border border-[#f4b942]/50 bg-[#f4b942]/10 px-1.5 py-1 font-display text-[8px] tracking-wide text-[#f4b942] sm:text-[9px]">
                              ★ {t('promoBadge')}
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

                      <h3 className="shop-product-title mt-2 font-display text-sm leading-tight text-white sm:text-base">{t(product.titleKey)}</h3>
                      <div className="shop-product-art mt-1 flex h-[92px] items-center justify-center overflow-hidden border border-white/[0.04] bg-[radial-gradient(ellipse_at_50%_70%,rgba(98,232,220,.08),transparent_68%)]">
                        <ShopArtwork productId={product.id} accent={product.accent} />
                      </div>
                      <p className="shop-product-description mt-1.5 flex-1 text-[10px] leading-relaxed text-white/55 sm:text-[11px]">{t(product.descriptionKey)}</p>

                      <div className="shop-product-footer mt-2 flex items-end justify-between gap-2 border-t border-white/10 pt-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-display text-sm leading-tight" style={{ color: product.accent }}>
                            {!developerMode && !rewardedDrop && catalogPrice?.currencyIcon && (
                              <img src={catalogPrice.currencyIcon} alt="" className="h-4 w-4" referrerPolicy="no-referrer" />
                            )}
                            {priceLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!purchasable || buying !== null}
                          title={alreadyOwned
                            ? t('shopOwned')
                            : developerMode
                              ? (devAlreadyClaimed ? t('devShopTaken') : t('devShopTake'))
                              : rewardedDrop
                              ? dropStatus?.available
                                ? rewardedAdsEnabled ? t('shopWatchAd') : t('shopAdUnavailable')
                                : dropStatusLabel
                              : !product.freeDrop
                                ? paymentsAvailable ? catalogPrice ? t('shopBuy') : t('shopPriceUnavailable') : t('shopPaymentsUnavailable')
                                : t('shopItemUnavailable')}
                          onClick={async () => {
                            if (!purchasable || buying !== null) return;
                            setBuying(product.id);
                            setShopNotice(null);
                            if (developerMode) {
                              const granted = await onDeveloperClaim(product.id);
                              setBuying(null);
                              if (granted) {
                                setDevClaims(developerShopClaims());
                                setShopNotice(t('devShopGranted').replace('{item}', t(product.titleKey)));
                              } else {
                                setShopNotice(t('devShopGrantFailed'));
                              }
                              return;
                            }
                            if (rewardedDrop) {
                              const result = await onClaimRewardedDrop(product.id as RewardedDropId);
                              setBuying(null);
                              if (result.ok) {
                                const rewardParts = result.items.map(([id, count]) => `${count}× ${blockName(id, BLOCKS[id]?.name ?? 'item')}`);
                                const notice = t('shopDropGranted').replace('{reward}', rewardParts.join(' · '));
                                const deliveryNote = result.delivery === 'own-world' ? t('shopDropOwnWorld') : t('shopDropNextRun');
                                setShopNotice(`${notice} · ${deliveryNote}`);
                              } else if (result.reason === 'ad') {
                                setShopNotice(t('shopDropAdFailed'));
                              } else if (result.reason === 'claimed') {
                                setShopNotice(t('shopDropAlreadyClaimed'));
                              } else {
                                setShopNotice(t('shopDropSaveFailed'));
                              }
                              return;
                            }
                            const result = await onBuyShopItem(product.id);
                            setBuying(null);
                            if (result.ok) {
                              setShopNotice(result.syncPending
                                ? t('shopPurchasePending')
                                : product.id === 'pet-wolf' || product.id === 'pet-monkey'
                                  ? t('shopPetPurchaseDone')
                                  : t('shopItemPurchaseDone').replace('{item}', t(product.titleKey)));
                            } else {
                              setShopNotice(result.reason === 'cancelled'
                                ? t('shopPurchaseCancelled')
                                : result.reason === 'unavailable'
                                  ? t('shopItemUnavailable')
                                  : t('shopPurchaseFailed'));
                            }
                          }}
                          className={`notch shrink-0 border-[3px] px-2.5 py-2 font-display text-[9px] tracking-wide sm:px-3 sm:text-[10px] ${
                            purchasable
                              ? 'border-black/70 bg-gradient-to-b from-[#5fd8cf] to-[#2f9c96] text-pit-950 hover:brightness-110 disabled:opacity-60'
                              : 'cursor-not-allowed border-black/70 bg-gradient-to-b from-[#36404a] to-[#222b33] text-white/45 opacity-80'
                          }`}
                        >
                          {alreadyOwned
                            ? t('shopOwned')
                            : developerMode
                              ? devAlreadyClaimed
                              ? t('devShopTaken')
                              : buying === product.id
                                ? t('devShopTaking')
                                : t('devShopTake')
                            : rewardedDrop
                              ? dropStatus?.available
                                ? !rewardedAdsEnabled
                                  ? t('shopAdUnavailable')
                                  : buying === product.id
                                    ? t('shopBuying')
                                    : t('shopWatchAd')
                                : dropStatusLabel
                              : !product.freeDrop
                                ? buying === product.id
                                  ? t('shopBuying')
                                  : !paymentsAvailable
                                    ? t('shopPaymentsUnavailable')
                                    : catalogPrice
                                      ? t('shopBuy')
                                      : t('shopPriceUnavailable')
                                : t('shopItemUnavailable')}
                        </button>
                      </div>
                    </article>
                  );
                  })}
                </div>
                {filteredShopProducts.length > 1 && (
                  <>
                    <button
                      type="button"
                      data-shop-previous="true"
                      aria-label={t('shopPrev')}
                      disabled={activeShopCard <= 0}
                      onClick={() => moveShopCarousel(-1)}
                      className="shop-carousel-arrow shop-carousel-arrow-prev"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      data-shop-next="true"
                      aria-label={t('shopNext')}
                      disabled={activeShopCard >= filteredShopProducts.length - 1}
                      onClick={() => moveShopCarousel(1)}
                      className="shop-carousel-arrow shop-carousel-arrow-next"
                    >
                      ›
                    </button>
                    <div className="sr-only" aria-live="polite">{activeShopCard + 1} / {filteredShopProducts.length}</div>
                  </>
                )}
              </div>
            </div>

            <nav aria-label={t('shop')} className="shop-tabs flex shrink-0 items-stretch justify-between gap-1 border-t border-white/10 bg-black/25 px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
              {SHOP_TABS.map((tab) => {
                const selected = shopTab === tab.id;
                const icon = tab.id === 'all' ? '⌂' : tab.id === 'weapons' ? '⚔' : tab.id === 'armor' ? '▣' : tab.id === 'offers' ? '⚡' : '✦';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-shop-category={tab.id}
                    aria-pressed={selected}
                    aria-controls="shop-catalog"
                    onClick={() => setShopTab(tab.id)}
                    className={`shop-category-button notch flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 font-display tracking-wide transition-all ${selected ? 'text-[#101113]' : 'bg-[#151d21] text-white/55 hover:text-white/90'}`}
                    style={selected ? { background: 'linear-gradient(180deg,#dfc29b,#9f7257)', border: '2px solid #d3a782', boxShadow: '0 0 12px rgba(196,145,105,.18)' } : { border: '2px solid #06090a' }}
                  >
                    <span aria-hidden="true" className="flex h-4 items-center justify-center text-[14px] leading-none">
                      {icon}
                    </span>
                    <span className="truncate text-[8px] sm:text-[10px]">{t(tab.labelKey)}</span>
                  </button>
                );
              })}
            </nav>

            <footer className="shrink-0 border-t border-white/10 bg-black/25 px-3 py-2 text-center text-[9px] leading-snug text-white/35 sm:px-4 sm:py-2.5 sm:text-[10px]">
              {shopNotice ?? (shopMode === 'developer'
                ? t('devShopNotice')
                : paymentsAvailable
                  ? t('shopRealNotice')
                  : rewardedAdsEnabled ? t('shopRewardedNotice') : t('shopMockNotice'))}
            </footer>
          </section>
        </div>
      )}

      {showCharacterCreator && (
        <CharacterCreatorDialog
          character={character}
          onCancel={() => setShowCharacterCreator(false)}
          onSave={(next) => {
            onSaveCharacter(next);
            setShowCharacterCreator(false);
          }}
        />
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

              {(canShortcut || shortcutNote || fullscreenAvailable()) && (
                <div className="sm:col-span-2">
                  <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-white/45">{t('platformLabel')}</div>
                  <div className="rounded-sm border border-white/10 bg-black/20 p-3">
                    {/* sdk-params: the platform's own button sits in the catalogue corner, so the game
                        offers its own toggle — always from a click, as browsers require */}
                    {fullscreenAvailable() && (
                      <button
                        type="button"
                        onClick={onFullscreen}
                        className="btn-mc notch mr-2 bg-gradient-to-b from-[#4b5a6d] to-[#2f3d4d] px-4 py-2.5 text-xs text-white/90"
                      >
                        ⛶ {fullscreen ? t('fullscreenOn') : t('fullscreenOff')}
                      </button>
                    )}
                    {canShortcut && (
                      <button
                        type="button"
                        onClick={onShortcut}
                        className="btn-mc notch bg-gradient-to-b from-[#4b5a6d] to-[#2f3d4d] px-4 py-2.5 text-xs text-white/90"
                      >
                        ★ {t('shortcutCta')}
                      </button>
                    )}
                    <div className="mt-2 text-[11px] leading-relaxed text-white/55">
                      {shortcutNote ?? t('shortcutSub')}
                    </div>
                  </div>
                </div>
              )}

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

const CHARACTER_HAIRSTYLE_LABELS: Record<CharacterHairstyle, TKey> = {
  short: 'characterHairShort',
  long: 'characterHairLong',
  ponytail: 'characterHairPonytail',
  spiky: 'characterHairSpiky',
  bob: 'characterHairBob',
  curly: 'characterHairCurly',
  braids: 'characterHairBraids',
  bun: 'characterHairBun',
  sidePart: 'characterHairSidePart',
  twinTails: 'characterHairTwinTails',
};
const CHARACTER_HAIRSTYLES = SUPPORTED_HAIRSTYLES.map((id) => ({ id, key: CHARACTER_HAIRSTYLE_LABELS[id] }));
const CHARACTER_SHOES: ReadonlyArray<{ id: CharacterShoeType; key: TKey }> = [
  { id: 'sneakers', key: 'characterShoesSneakers' },
  { id: 'boots', key: 'characterShoesBoots' },
  { id: 'sandals', key: 'characterShoesSandals' },
];
const CHARACTER_FACE_LABELS: Record<CharacterExpression, TKey> = {
  smile: 'characterFaceSmile',
  happy: 'characterFaceHappy',
  cool: 'characterFaceCool',
  surprised: 'characterFaceSurprised',
  wink: 'characterFaceWink',
  neutral: 'characterFaceNeutral',
  sad: 'characterFaceSad',
  thoughtful: 'characterFaceThoughtful',
  scared: 'characterFaceScared',
  angry: 'characterFaceAngry',
};
const CHARACTER_GLASSES_LABELS: Record<CharacterGlasses, TKey> = {
  none: 'characterGlassesNone',
  round: 'characterGlassesRound',
  square: 'characterGlassesSquare',
  sunglasses: 'characterGlassesSunglasses',
};

function CharacterCreatorDialog({
  character,
  onCancel,
  onSave,
}: {
  character: CharacterCustomization;
  onCancel: () => void;
  onSave: (next: CharacterCustomization) => void;
}) {
  const [draft, setDraft] = useState<CharacterCustomization>(() => ({ ...character }));
  const update = <K extends keyof CharacterCustomization>(key: K, value: CharacterCustomization[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const selectedButton = (selected: boolean) =>
    `notch border-[3px] px-2.5 py-2 font-display text-[10px] transition-all ${selected ? 'border-[#d7bcff] bg-[#8c58bd]/30 text-white shadow-[0_0_12px_rgba(185,139,255,.2)]' : 'border-black/70 bg-[#151d21] text-white/55 hover:text-white/85'}`;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#03070a]/90 px-2 py-3 backdrop-blur-md sm:px-5 sm:py-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-title"
        className="my-auto flex max-h-[95vh] w-[min(98vw,940px)] flex-col overflow-hidden border border-[#a275d0]/55 bg-[#0b1015] shadow-[0_22px_90px_rgba(0,0,0,.85)]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#261d35] via-[#182027] to-[#142c34] p-3 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#c49aff]/45 bg-[#8c58bd]/15 text-2xl">🧍</div>
          <div className="min-w-0 flex-1">
            <h2 id="character-title" className="font-display text-lg leading-tight text-[#e0c9ff] sm:text-2xl">{t('characterCreatorTitle')}</h2>
            <p className="mt-1 text-[10px] leading-snug text-white/50 sm:text-xs">{t('characterCreatorSubtitle')}</p>
          </div>
          <button type="button" aria-label={t('close')} onClick={onCancel} className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-3 py-2 text-white/80">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid items-start gap-3 p-3 sm:gap-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_200px]">
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <fieldset className="min-w-0 border border-white/10 bg-black/20 p-2.5 sm:p-3">
                <legend className="px-1 font-display text-[9px] tracking-[0.2em] text-white/45">{t('characterGender')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['boy', 'girl'] as const).map((gender: CharacterGender) => {
                    const selected = draft.gender === gender;
                    return (
                      <button key={gender} type="button" aria-pressed={selected} onClick={() => update('gender', gender)} className={selectedButton(selected)}>
                        <span className="mr-1.5" aria-hidden="true">{gender === 'boy' ? '👦' : '👧'}</span>{t(gender === 'boy' ? 'characterBoy' : 'characterGirl')}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="min-w-0 border border-white/10 bg-black/20 p-2.5 sm:p-3">
                <legend className="px-1 font-display text-[9px] tracking-[0.2em] text-white/45">{t('characterHairstyle')}</legend>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {CHARACTER_HAIRSTYLES.map((style) => (
                    <button key={style.id} type="button" data-character-hairstyle={style.id} aria-pressed={draft.hairstyle === style.id} onClick={() => update('hairstyle', style.id)} className={`${selectedButton(draft.hairstyle === style.id)} flex min-h-[48px] flex-col items-center justify-center gap-1 px-1 py-1.5`}>
                      <HairStyleGlyph hairstyle={style.id} color={draft.hairColor} />
                      <span className="text-[7px] sm:text-[8px]">{t(style.key)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <ColorPaletteField label={t('characterHairColor')} colors={CHARACTER_COLORS.hair} value={draft.hairColor} onChange={(color) => update('hairColor', color)} />
              <ColorPaletteField label={t('characterShirt')} colors={CHARACTER_COLORS.shirt} value={draft.shirtColor} onChange={(color) => update('shirtColor', color)} />
              <ColorPaletteField label={t(draft.gender === 'girl' ? 'characterSkirtColor' : 'characterPants')} colors={CHARACTER_COLORS.pants} value={draft.pantsColor} onChange={(color) => update('pantsColor', color)} />

              <fieldset className="min-w-0 border border-white/10 bg-black/20 p-2.5 sm:p-3">
                <legend className="px-1 font-display text-[9px] tracking-[0.2em] text-white/45">{t('characterShoeType')}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CHARACTER_SHOES.map((shoe) => (
                    <button key={shoe.id} type="button" aria-pressed={draft.shoeType === shoe.id} onClick={() => update('shoeType', shoe.id)} className={selectedButton(draft.shoeType === shoe.id)}>
                      {t(shoe.key)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <ColorPaletteField label={t('characterShoeColor')} colors={CHARACTER_COLORS.shoes} value={draft.shoeColor} onChange={(color) => update('shoeColor', color)} />
              <ColorPaletteField label={t('characterSkin')} colors={CHARACTER_COLORS.skin} value={draft.skinColor} onChange={(color) => update('skinColor', color)} />

              <fieldset className="min-w-0 border border-white/10 bg-black/20 p-2.5 sm:col-span-2 sm:p-3">
                <legend className="px-1 font-display text-[9px] tracking-[0.2em] text-white/45">{t('characterGlasses')}</legend>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {CHARACTER_GLASSES.map((glasses) => (
                    <button key={glasses} type="button" data-character-glasses={glasses} aria-label={t(CHARACTER_GLASSES_LABELS[glasses])} aria-pressed={draft.glasses === glasses} onClick={() => update('glasses', glasses)} className={`${selectedButton(draft.glasses === glasses)} flex items-center justify-center gap-1.5 px-1.5 py-2`}>
                      <GlassesGlyph glasses={glasses} />
                      <span className="text-[8px]">{t(CHARACTER_GLASSES_LABELS[glasses])}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="min-w-0 border border-white/10 bg-black/20 p-2.5 sm:col-span-2 sm:p-3">
                <legend className="px-1 font-display text-[9px] tracking-[0.2em] text-white/45">{t('characterExpression')}</legend>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {CHARACTER_EXPRESSIONS.map(({ id }) => (
                    <button
                      key={id}
                      type="button"
                      data-character-expression={id}
                      aria-label={t(CHARACTER_FACE_LABELS[id])}
                      aria-pressed={draft.expression === id}
                      title={t(CHARACTER_FACE_LABELS[id])}
                      onClick={() => update('expression', id)}
                      className={`flex min-h-[60px] flex-col items-center justify-center gap-1 border px-1 py-1.5 transition-all ${draft.expression === id ? 'border-[#d7bcff] bg-[#8c58bd]/30 shadow-[0_0_12px_rgba(185,139,255,.25)]' : 'border-white/10 bg-black/25 hover:border-white/35'}`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center border border-black/70" style={{ backgroundColor: draft.skinColor }}>
                        <CharacterFaceGlyph expression={id} glasses="none" />
                      </span>
                      <span className="text-[7px] leading-tight text-white/80 sm:text-[8px]">{t(CHARACTER_FACE_LABELS[id])}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <aside className="flex flex-col items-center border border-[#8c58bd]/25 bg-[radial-gradient(ellipse_at_50%_20%,rgba(140,88,189,.18),rgba(0,0,0,.16)_70%)] p-3">
              <div className="mb-2 w-full text-center font-display text-[9px] tracking-[0.2em] text-white/40">{t('characterPreview')}</div>
              <CharacterAvatarPreview character={draft} />
              <div className="mt-2 text-center font-display text-[10px] tracking-wide text-[#d7bcff]">{t(draft.gender === 'girl' ? 'characterGirl' : 'characterBoy')}</div>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-white/10 bg-black/25 p-3 sm:px-5 sm:py-4">
          <button type="button" onClick={onCancel} className="btn-mc notch bg-gradient-to-b from-pit-500 to-pit-700 px-4 py-2.5 font-display text-xs text-white/75">{t('characterCancel')}</button>
          <button type="button" onClick={() => onSave(draft)} className="btn-mc notch bg-gradient-to-b from-[#aa7be3] to-[#6e42a1] px-5 py-2.5 font-display text-xs text-white shadow-[0_0_18px_rgba(170,123,227,.25)]">{t('characterSave')}</button>
        </footer>
      </section>
    </div>
  );
}

function ColorPaletteField({ label, colors, value, onChange }: { label: string; colors: readonly string[]; value: string; onChange: (color: string) => void }) {
  return (
    <fieldset className="min-w-0 border border-white/10 bg-black/20 p-2.5 sm:p-3">
      <legend className="px-1 font-display text-[9px] tracking-[0.2em] text-white/45">{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label}: ${color}`}
            aria-pressed={value === color}
            title={color}
            onClick={() => onChange(color)}
            className={`relative h-7 w-7 border-2 transition-transform hover:scale-110 ${value === color ? 'border-white shadow-[0_0_9px_rgba(255,255,255,.55)]' : 'border-black/60'}`}
            style={{ backgroundColor: color }}
          >
            {value === color && <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] text-white" style={{ textShadow: '0 1px 3px #000' }}>✓</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function HairStyleGlyph({ hairstyle, color }: { hairstyle: CharacterHairstyle; color: string }) {
  const blocks: Array<[number, number, number, number]> = [[6, 6, 20, 8], [7, 4, 18, 4], [5, 9, 22, 3]];
  if (hairstyle === 'long' || hairstyle === 'bob') blocks.push([5, 11, 4, hairstyle === 'bob' ? 9 : 11], [23, 11, 4, hairstyle === 'bob' ? 9 : 11], [8, 19, 16, 3]);
  if (hairstyle === 'ponytail') blocks.push([25, 10, 4, 5], [28, 14, 3, 7]);
  if (hairstyle === 'spiky') blocks.push([7, 2, 4, 7], [14, 0, 4, 8], [21, 2, 4, 7]);
  if (hairstyle === 'curly') blocks.push([3, 6, 5, 5], [8, 1, 5, 6], [18, 1, 5, 6], [24, 6, 5, 5], [5, 10, 4, 5], [23, 10, 4, 5]);
  if (hairstyle === 'braids') blocks.push([4, 10, 4, 5], [5, 14, 3, 5], [24, 10, 4, 5], [24, 14, 3, 5]);
  if (hairstyle === 'bun') blocks.push([12, 1, 8, 5], [13, 0, 6, 3]);
  if (hairstyle === 'sidePart') blocks.push([8, 3, 14, 4], [5, 7, 9, 4]);
  if (hairstyle === 'twinTails') blocks.push([2, 10, 5, 6], [3, 14, 4, 7], [25, 10, 5, 6], [25, 14, 4, 7]);
  return (
    <svg aria-hidden="true" viewBox="0 0 32 23" className="h-5 w-7" style={{ imageRendering: 'pixelated' }}>
      {blocks.map(([x, y, width, height], index) => <rect key={index} x={x} y={y} width={width} height={height} fill={color} />)}
    </svg>
  );
}

function GlassesGlyph({ glasses }: { glasses: CharacterGlasses }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 16" className="h-4 w-8" style={{ imageRendering: 'pixelated' }}>
      {glasses === 'none' ? (
        <path d="M4 8h24" stroke="#9aa6ac" strokeWidth="2" strokeDasharray="3 3" />
      ) : (
        <>
          {glasses === 'sunglasses' && <><rect x="4" y="4" width="10" height="8" fill="#263847" /><rect x="18" y="4" width="10" height="8" fill="#263847" /><rect x="6" y="5" width="4" height="2" fill="#8cb8c1" /><rect x="20" y="5" width="4" height="2" fill="#8cb8c1" /></>}
          <path d="M3 5h11v7H3zM18 5h11v7H18zM14 7h4" fill="none" stroke="#191d22" strokeWidth="2" strokeLinejoin={glasses === 'round' ? 'round' : 'miter'} />
        </>
      )}
    </svg>
  );
}

function CharacterFaceGlyph({ expression, glasses }: { expression: CharacterExpression; glasses: CharacterGlasses }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-full w-full" style={{ imageRendering: 'pixelated' }}>
      {characterFacePixels(expression, glasses).map((pixel, index) => (
        <rect key={index} x={pixel.x} y={pixel.y} width={pixel.width} height={pixel.height} fill={pixel.color} />
      ))}
    </svg>
  );
}

function CharacterAvatarPreview({ character }: { character: CharacterCustomization }) {
  const [backView, setBackView] = useState(false);
  const isGirl = character.gender === 'girl';
  const hair = character.hairColor;
  const block = (style: React.CSSProperties) => ({ position: 'absolute' as const, imageRendering: 'pixelated' as const, ...style });
  const hairstyleHasLongSides = ['long', 'ponytail', 'bob', 'braids'].includes(character.hairstyle);
  const upper = (
    <>
      {(character.hairstyle === 'long' || character.hairstyle === 'bob' || character.hairstyle === 'braids') && <>
        <span style={block({ left: 40, top: 31, width: 13, height: character.hairstyle === 'bob' ? 65 : 81, background: hair, zIndex: 1 })} />
        <span style={block({ left: 89, top: 31, width: 13, height: character.hairstyle === 'bob' ? 65 : 81, background: hair, zIndex: 1 })} />
      </>}
      {character.hairstyle === 'ponytail' && <>
        <span style={block({ left: 88, top: 43, width: 14, height: 29, background: hair, zIndex: 0 })} />
        <span style={block({ left: 93, top: 68, width: 12, height: 41, background: hair, zIndex: 0 })} />
      </>}
      {character.hairstyle === 'twinTails' && <>
        <span style={block({ left: 34, top: 42, width: 13, height: 27, background: hair, zIndex: 0 })} />
        <span style={block({ left: 35, top: 63, width: 12, height: 45, background: hair, zIndex: 0 })} />
        <span style={block({ left: 95, top: 42, width: 13, height: 27, background: hair, zIndex: 0 })} />
        <span style={block({ left: 95, top: 63, width: 12, height: 45, background: hair, zIndex: 0 })} />
      </>}
      {character.hairstyle === 'bun' && <span style={block({ left: 61, top: 9, width: 23, height: 18, background: hair, zIndex: 2 })} />}
      {character.hairstyle === 'curly' && <>
        <span style={block({ left: 40, top: 20, width: 20, height: 24, background: hair, zIndex: 3 })} />
        <span style={block({ left: 56, top: 9, width: 30, height: 21, background: hair, zIndex: 3 })} />
        <span style={block({ left: 81, top: 19, width: 21, height: 26, background: hair, zIndex: 3 })} />
      </>}
      {character.hairstyle === 'short' && <>
        <span style={block({ left: 47, top: 31, width: 11, height: 28, background: hair, zIndex: 1 })} />
        <span style={block({ left: 85, top: 31, width: 11, height: 28, background: hair, zIndex: 1 })} />
      </>}
      {character.hairstyle === 'spiky' && <>
        <span style={block({ left: 52, top: 2, width: 13, height: 23, background: hair, transform: 'rotate(-12deg)', zIndex: 3 })} />
        <span style={block({ left: 66, top: 0, width: 13, height: 25, background: hair, zIndex: 3 })} />
        <span style={block({ left: 81, top: 3, width: 13, height: 21, background: hair, transform: 'rotate(12deg)', zIndex: 3 })} />
      </>}
      <span style={block({ left: 48, top: 16, width: 46, height: 22, background: hair, zIndex: 2 })} />
      {character.hairstyle === 'sidePart' && <>
        <span style={block({ left: 48, top: 28, width: 44, height: 12, background: hair, zIndex: 3 })} />
        <span style={block({ left: 54, top: 20, width: 28, height: 11, background: hair, zIndex: 3 })} />
      </>}
      {!['spiky', 'sidePart', 'curly'].includes(character.hairstyle) && <span style={block({ left: 47, top: 31, width: 48, height: 11, background: hair, zIndex: 3 })} />}
    </>
  );
  return (
    <div className="flex flex-col items-center">
      <div role="group" aria-label={t('characterView')} className="mb-2 grid w-full grid-cols-2 gap-1">
        <button type="button" aria-pressed={!backView} onClick={() => setBackView(false)} className={`border px-2 py-1 font-display text-[8px] ${!backView ? 'border-[#d7bcff] bg-[#8c58bd]/30 text-white' : 'border-white/10 text-white/45'}`}>{t('characterViewFront')}</button>
        <button type="button" aria-pressed={backView} onClick={() => setBackView(true)} className={`border px-2 py-1 font-display text-[8px] ${backView ? 'border-[#d7bcff] bg-[#8c58bd]/30 text-white' : 'border-white/10 text-white/45'}`}>{t('characterViewBack')}</button>
      </div>
      <div data-character-preview-view={backView ? 'back' : 'front'} data-character-preview-skirt={isGirl ? 'true' : 'false'} role="img" aria-label={`${t(character.gender === 'girl' ? 'characterGirl' : 'characterBoy')}, ${t(backView ? 'characterViewBack' : 'characterViewFront')}`} className="relative h-[205px] w-[142px] overflow-hidden border border-white/10 bg-[#111920]/75">
        {upper}
        <span style={block({ left: 51, top: 39, width: 40, height: 39, background: character.skinColor, zIndex: 2 })} />
        {backView && <span style={block({ left: 49, top: 31, width: 44, height: 47, background: hair, zIndex: 4 })} />}
        {backView && hairstyleHasLongSides && <span style={block({ left: 47, top: 31, width: 48, height: 62, background: hair, zIndex: 4 })} />}
        {backView && character.hairstyle === 'bun' && <span style={block({ left: 51, top: 21, width: 43, height: 27, background: hair, zIndex: 4 })} />}
        {!backView && <span style={block({ left: 51, top: 39, width: 40, height: 39, background: character.skinColor, zIndex: 4 })}>
          <CharacterFaceGlyph expression={character.expression} glasses={character.glasses} />
        </span>}
        <span style={block({ left: isGirl ? 41 : 34, top: 80, width: isGirl ? 60 : 74, height: 57, background: character.shirtColor, zIndex: 2 })} />
        <span style={block({ left: 24, top: 82, width: 15, height: 47, background: character.shirtColor, zIndex: 1 })} />
        <span style={block({ left: 103, top: 82, width: 15, height: 47, background: character.shirtColor, zIndex: 1 })} />
        {backView && <span style={block({ left: 70, top: 90, width: 3, height: 32, background: 'rgba(255,255,255,.22)', zIndex: 3 })} />}
        {isGirl ? <>
          <span style={block({ left: 41, top: 130, width: 60, height: 14, background: character.pantsColor, zIndex: 3 })} />
          <span style={block({ left: 35, top: 141, width: 72, height: 15, background: character.pantsColor, zIndex: 3 })} />
          <span style={block({ left: 28, top: 153, width: 86, height: 15, background: character.pantsColor, borderBottom: '4px solid rgba(0,0,0,.28)', zIndex: 3 })} />
          <span style={block({ left: 49, top: 164, width: 16, height: 17, background: character.skinColor, zIndex: 1 })} />
          <span style={block({ left: 77, top: 164, width: 16, height: 17, background: character.skinColor, zIndex: 1 })} />
        </> : <>
          <span style={block({ left: 40, top: 137, width: 25, height: 45, background: character.pantsColor, zIndex: 1 })} />
          <span style={block({ left: 77, top: 137, width: 25, height: 45, background: character.pantsColor, zIndex: 1 })} />
        </>}
        <span style={block({ left: 39, top: 180, width: 31, height: 13, background: character.shoeColor, zIndex: 2, borderBottom: character.shoeType === 'sneakers' ? '4px solid #f1f2ed' : undefined })} />
        <span style={block({ left: 72, top: 180, width: 31, height: 13, background: character.shoeColor, zIndex: 2, borderBottom: character.shoeType === 'sneakers' ? '4px solid #f1f2ed' : undefined })} />
        {character.shoeType === 'sandals' && <>
          <span style={block({ left: 42, top: 180, width: 25, height: 4, background: '#202124', zIndex: 3 })} />
          <span style={block({ left: 75, top: 180, width: 25, height: 4, background: '#202124', zIndex: 3 })} />
        </>}
      </div>
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
  musicVolume,
  onMusicVolume,
  muted,
  onMute,
  fullscreen,
  onFullscreen,
  onSaveWorld,
}: {
  hud: HudState;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onBag: () => void;
  music: boolean;
  onMusic: () => void;
  musicVolume: number;
  onMusicVolume: (volume: number) => void;
  muted: boolean;
  onMute: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onSaveWorld: () => void;
}) {
  return (
    <div className="pause-screen absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-pit-950/78 px-2 py-3 backdrop-blur-[3px] sm:items-center sm:px-4 sm:py-5">
      <div className="bevel notch anim-pop my-auto w-[min(92vw,440px)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6">
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
          <div className="sunken notch space-y-2 bg-black/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[10px] font-display tracking-[0.18em] text-white/60">
              <label htmlFor="pause-music-volume">{t('musicVolume')}</label>
              <span className="tabular-nums text-torch">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              id="pause-music-volume"
              aria-label={t('musicVolume')}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={musicVolume}
              onChange={(event) => onMusicVolume(Number(event.currentTarget.value))}
              className="h-2 w-full cursor-pointer accent-[#f4b942]"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Toggle on={music} onClick={onMusic} icon={<MusicIcon off={!music} size={13} />} label={music ? t('musicOn') : t('musicOff')} />
            <Toggle on={!muted} onClick={onMute} icon={<SoundIcon muted={muted} size={13} />} label={muted ? t('sfxOff') : t('sfxOn')} />
            {fullscreenAvailable() && (
              <button
                type="button"
                onClick={onFullscreen}
                className="btn-mc notch bg-gradient-to-b from-[#4b5a6d] to-[#2f3d4d] px-3 py-2.5 font-display text-[10px] tracking-wide text-white/90"
              >
                ⛶ {fullscreen ? t('fullscreenOn') : t('fullscreenOff')}
              </button>
            )}
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
  onRevive,
  canRevive,
  adBusy,
  adNotice,
  reviveSeconds,
  myRank,
  squadNote,
  canRate,
  onRate,
  reviewNote,
  onCopyResult,
  copyNote,
}: {
  hud: HudState;
  scores: ScoreEntry[];
  token: string;
  name: string;
  onName: (n: string) => void;
  onRestart: () => void;
  onQuit: () => void;
  isRecord: boolean;
  /** rewarded video: continue the run instead of ending it (user action, never automatic) */
  onRevive: () => void;
  canRevive: boolean;
  adBusy: boolean;
  adNotice: string | null;
  reviveSeconds: number;
  /** place in the Yandex leaderboard (undefined = no leaderboard, null = no result yet) */
  myRank?: number | null;
  /** closing line under the squad table: the shift was published / teammates are local */
  squadNote?: string | null;
  /** copies the share line to the clipboard (sdk-params) */
  onCopyResult: (text: string) => void;
  /** feedback of the copy button: «Итог скопирован» or an honest "clipboard is unavailable" */
  copyNote: string | null;
  /** the platform allows asking this player to rate the game (ysdk.feedback.canReview → true) */
  canRate?: boolean;
  onRate?: () => void;
  /** shown after the rating dialog was opened: thanks, or "maybe next time" */
  reviewNote?: string | null;
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
    <div className="absolute inset-0 z-30 overflow-hidden bg-pit-950/85 backdrop-blur-[2px]">
      <div className="pointer-events-none absolute inset-0 grain opacity-30" />
      {/* FitBox: the run report and all of its buttons stay on screen at any window size (1.10) */}
      <FitBox className="mx-auto w-full max-w-5xl items-start p-3 sm:p-5 lg:items-center">
        <div className="gameover-layout">
          <section className="gameover-summary anim-rise min-w-0">
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
              {myRank !== undefined && (
                <div className="mt-2 flex items-center gap-1.5 font-display text-[11px] tracking-[0.2em] text-[#62e8dc]/90">
                  <TrophyIcon size={12} />
                  {myRank && myRank > 0 ? t('lbYourRank').replace('{n}', String(myRank)) : t('lbNoRank')}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-5">
                <Stat icon={<CubeIcon size={12} />} label={t('mined')} value={String(hud.blocksMined)} color="#e8efe9" />
                <Stat icon={<PickIcon size={12} />} label={t('bestCombo')} value={`x${hud.bestCombo}`} color="#93c95d" />
                <Stat icon={<DepthIcon size={12} />} label={t('deepest')} value={String(hud.deepest)} color="#d9844a" />
                <Stat icon={<HeartIcon size={12} />} label={t('ores')} value={String(hud.oresFound)} color="#5fe8dc" />
                <Stat icon={<TrophyIcon size={12} />} label={t('kills')} value={String(hud.kills)} color="#e2564a" />
              </div>

              {/* the shift's squad: teammates replayed from asynchronous multiplayer sessions */}
              {hud.squad.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  <div className="mb-1 flex items-center gap-1.5 font-display text-[10px] tracking-[0.2em] text-[#62e8dc]">
                    <span aria-hidden="true">◆</span> {t('squadTitle')} · {hud.squad.length + 1}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {hud.squad.map((mate) => (
                      <li key={mate.id} className="flex items-center gap-2 text-[11px]">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0"
                          style={{ background: mate.health > 50 ? '#7fe06a' : mate.health > 25 ? '#e8c14a' : '#e2564a' }}
                        />
                        <span className="min-w-0 flex-1 truncate font-display tracking-wide text-white/85">{mate.name}</span>
                        <span className="font-display text-[10px] tabular-nums text-white/45">
                          {t('squadBlocks').replace('{n}', String(mate.blocks))}
                        </span>
                        {mate.finished && <span className="text-[9px] tracking-widest text-torch">{t('squadFinished')}</span>}
                      </li>
                    ))}
                  </ul>
                  {squadNote && <div className="mt-1 text-[10px] leading-snug text-white/35">{squadNote}</div>}
                </div>
              )}
            </div>

            <div className="gameover-action-groups mt-4 flex flex-col gap-2.5">
              <div className="gameover-primary-actions">
                <button
                  onClick={onRestart}
                  disabled={adBusy}
                  className="gameover-action gameover-primary-action btn-mc notch flex items-center justify-center gap-2 bg-gradient-to-b from-moss to-[#4d8c31] text-pit-950 disabled:opacity-60"
                >
                  <PlayIcon size={18} /> <span>{t('mineAgain')}</span>
                </button>
                <button
                  onClick={onQuit}
                  className="gameover-action gameover-primary-action btn-mc notch flex items-center justify-center bg-gradient-to-b from-pit-500 to-pit-700 text-white/85"
                >
                  {t('mainMenu')}
                </button>
              </div>

              {canRevive && (
                <div className="gameover-offer-actions">
                  <button
                    onClick={onRevive}
                    disabled={adBusy}
                    className="gameover-action gameover-offer-action btn-mc notch flex min-w-0 flex-col items-center justify-center gap-0.5 bg-gradient-to-b from-[#62e8dc] to-[#2f9c96] text-center text-pit-950 disabled:opacity-60"
                  >
                    <span className="flex flex-wrap items-center justify-center gap-2 font-display leading-tight">
                      <span className="border border-pit-950/40 bg-pit-950/15 px-1 py-0.5 font-display text-[8px] tracking-widest">
                        {t('adBadge')}
                      </span>
                      {t('watchAdRevive')}
                    </span>
                    <span className="text-[10px] leading-snug opacity-80">{t('watchAdReviveSub').replace('{sec}', String(reviveSeconds))}</span>
                  </button>
                </div>
              )}

              <div className="gameover-utility-actions">
                {canRate && (
                  <button
                    onClick={onRate}
                    className="gameover-action gameover-utility-action btn-mc notch bg-gradient-to-b from-[#4b5a6d] to-[#2f3d4d] text-white/80"
                  >
                    ★ {t('reviewCta')}
                  </button>
                )}
                {/* sdk-params: clipboard.writeText — one click puts the shift's summary on the clipboard */}
                <button
                  onClick={() =>
                    onCopyResult(
                      t('shareTemplate')
                        .replace('{mode}', t(hud.survival ? 'survival' : 'explorer'))
                        .replace('{score}', String(hud.score))
                        .replace('{blocks}', String(hud.blocksMined))
                        .replace('{depth}', String(hud.deepest)),
                    )
                  }
                  className="gameover-action gameover-utility-action btn-mc notch bg-gradient-to-b from-[#4b5a6d] to-[#2f3d4d] text-white/80"
                >
                  ⧉ {t('copyResult')}
                </button>
              </div>

              <div className="gameover-feedback font-display text-[10px] tracking-[0.16em]">
                {reviewNote && <span className="text-[#8ee9e2]">{reviewNote}</span>}
                {copyNote && <span className="text-[#8ee9e2]">{copyNote}</span>}
                {adNotice && <span className="text-copper">{adNotice}</span>}
                <span className="gameover-shortcut text-white/30">[R] · [ESC]</span>
              </div>
            </div>
          </section>

          <aside className="gameover-aside anim-rise min-w-0" style={{ animationDelay: '120ms' }}>
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
          </aside>
        </div>
      </FitBox>
    </div>
  );
}
