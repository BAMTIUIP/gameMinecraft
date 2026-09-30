import { useState } from 'react';
import type { HudState } from '../game/engine';
import {
  RECIPES,
  HAND,
  SWORDS,
  PICK_TOOLS,
  SWORD_TOOLS,
  AXE_TOOLS,
  isPickTool,
  isSwordTool,
  isAxeTool,
  toolSellPrice,
  getItemInvCategory,
  getSalvageForItemId,
  getSalvageForGear,
  type InvCategory,
} from '../game/recipes';
import { BLOCKS, PICKAXE_TIERS, PICKAXE_TIERS as PT2 } from '../game/blocks';
import { getBlockIcon } from '../game/textures';
import { BagIcon, CloseIcon, PickIcon, AxeIcon, BowIcon, ShovelIcon, SwordIcon } from './icons';
import { AFFIXES, isGearHotbarId, MATERIALS, RARITY, SLOTS, SLOT_KEY, type Item, type Slot } from '../game/items';
import { blockName, matName, pickaxeLabel, rarName, recipeText, swordLabel, t } from '../game/i18n';

// ---------- helpers ----------

function toolIcon(id: number, size = 24): { el: React.ReactNode; label: string } {
  if (id === HAND) return { el: <span className="text-[16px] leading-none">✊</span>, label: t('emptyHand') };
  if (isPickTool(id)) {
    const tierIdx = id - PICK_TOOLS[0];
    const color = PT2[tierIdx]?.color ?? '#b98a4d';
    return { el: <PickIcon size={size} style={{ color }} />, label: pickaxeLabel(tierIdx) };
  }
  if (isSwordTool(id)) {
    const tierIdx = id - SWORD_TOOLS[0];
    const color = SWORDS[tierIdx]?.color ?? '#d9dde2';
    return { el: <SwordIcon size={size} style={{ color }} />, label: swordLabel(tierIdx) };
  }
  if (isAxeTool(id)) {
    const isWood = id === AXE_TOOLS[0];
    return { el: <AxeIcon size={size} style={{ color: isWood ? '#b98a4d' : '#9aa0a6' }} />, label: isWood ? t('axeWood') : t('axeStone') };
  }
  if (id === 202) return { el: <span className="text-torch text-[14px] leading-none">⨙</span>, label: t('handTorch') };
  if (id === 204) return { el: <ShovelIcon size={size} style={{ color: '#b98a4d' }} />, label: t('tool_shovel') };
  if (id === 205) return { el: <BowIcon size={size} style={{ color: '#93c95d' }} />, label: t('tool_bow') };
  return { el: <span className="text-white/60">#{id}</span>, label: `#${id}` };
}

function toolLabel(id: number): string {
  return toolIcon(id, 0).label;
}

const SLOT_GLYPH: Record<Slot, string> = {
  head: '⛑',
  chest: '⛨',
  legs: '👖',
  feet: '👢',
  hands: '🧤',
  offhand: '🛡',
};

// ---------- types ----------

type Props = {
  hud: HudState;
  onCraft: (key: string) => void;
  onPlaceItem: (id: number, slot?: number, fromSlot?: number) => void;
  onRemoveSlot: (slot: number) => void;
  onSelectSlot?: (i: number) => void;
  onClose: () => void;
  onEquip: (uid: string) => void;
  onUnequip: (slot: Slot) => void;
  onSell: (id: number) => void;
  onBuy: (i: number) => void;
  onUpgrade: (uid: string) => void;
  onReinforce: (uid: string) => void;
  onSellTool: (id: number) => void;
  onSellGear: (uid: string) => void;
  onSalvageGear: (uid: string) => void;
  onSalvageItem: (id: number) => void;
  isTouch?: boolean;
};

type Tab = 'tools' | 'blocks' | 'gear' | 'food' | 'trade' | 'anvil';
const TABS: Array<{ id: Tab; key: string }> = [
  { id: 'tools', key: 'tab_tools' },
  { id: 'blocks', key: 'tab_blocks' },
  { id: 'gear', key: 'tab_gear' },
  { id: 'food', key: 'tab_food' },
];

const INV_CATEGORY_TABS: Array<{ id: InvCategory; key: string }> = [
  { id: 'all', key: 'inv_tab_all' },
  { id: 'tools', key: 'inv_tab_tools' },
  { id: 'food', key: 'inv_tab_food' },
  { id: 'armor', key: 'inv_tab_armor' },
  { id: 'blocks', key: 'inv_tab_blocks' },
];

type WorkbenchTarget = { kind: 'item'; id: number } | { kind: 'gear'; uid: string } | null;

// ---------- small components ----------

function Badge({ c, txt }: { c: string; txt: string }) {
  return (
    <span className="px-1.5 py-0.5 font-display text-[9px] leading-tight" style={{ color: c, background: `${c}1f`, border: `1px solid ${c}55` }}>
      {txt}
    </span>
  );
}

// ---------- main component ----------

export default function Inventory({
  hud,
  onCraft,
  onPlaceItem,
  onRemoveSlot,
  onSelectSlot,
  onClose,
  onEquip,
  onUnequip,
  onSell,
  onBuy,
  onUpgrade,
  onReinforce,
  onSellTool,
  onSellGear,
  onSalvageGear,
  onSalvageItem,
  isTouch,
}: Props) {
  const craftable = new Set(hud.craftable);
  const st = hud.stats;
  const isWorkbenchMode = hud.invTab === 'workbench';

  const [tab, setTab] = useState<Tab>(
    hud.invTab === 'trade' && hud.tradeNear ? 'trade' : hud.invTab === 'anvil' && hud.anvilNear ? 'anvil' : 'tools',
  );
  const [invCat, setInvCat] = useState<InvCategory>('all');
  const [wbTarget, setWbTarget] = useState<WorkbenchTarget>(null);

  const shownRecipes = RECIPES.filter((r) => r.group === tab);

  // Filter general inventory stacks + armor items according to selected general inventory tab
  const filteredStacks =
    invCat === 'armor'
      ? []
      : hud.inventory.filter((it) => invCat === 'all' || getItemInvCategory(it.id) === invCat);
  const filteredGear = invCat === 'all' || invCat === 'armor' ? hud.bagItems : [];
  const totalShownCount = filteredStacks.length + filteredGear.length;

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-pit-950/85 backdrop-blur-[3px]">
      <div className="pointer-events-none absolute inset-0 grain opacity-30" />
      <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col p-3 sm:p-6">
        {/* ---------- header ---------- */}
        <div className="anim-rise bevel notch mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-end gap-3">
            <BagIcon size={30} className="mb-1 text-torch" />
            <div>
              <div className="font-display text-3xl leading-none text-white text-outline sm:text-4xl">
                {isWorkbenchMode ? t('wb_title') : t('workbench')}
              </div>
              <div className="mt-1 text-[10px] tracking-[0.32em] text-white/40">
                {isWorkbenchMode ? t('wb_sub') : `${t('haul')} · ${t('recipes')} · ${t('gear')}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="bevel-flat notch flex items-center gap-2 px-3 py-1.5" style={{ borderColor: PT2[hud.tier]?.color ?? '#b98a4d' }}>
              <PickIcon size={16} style={{ color: PT2[hud.tier]?.color ?? '#b98a4d' }} />
              <span className="font-display text-base leading-none" style={{ color: PT2[hud.tier]?.color ?? '#b98a4d' }}>
                {hud.tierName}
              </span>
              <span className="font-display text-[10px] text-white/40">{PT2[hud.tier]?.speed.toFixed(1)}x</span>
            </div>
            <button
              onClick={onClose}
              className="bevel-flat notch flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-blood active:scale-95"
              aria-label={t('closeHint')}
            >
              <CloseIcon size={17} />
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_1.55fr]">
          {/* ---------- general inventory + equipment + hotbar ---------- */}
          <div
            className="anim-rise bevel-flat notch flex flex-col p-3 lg:col-span-2"
            style={{ animationDelay: '60ms' }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              const data = e.dataTransfer.getData('text/plain');
              if (!data.startsWith('hotbar:')) return;
              e.preventDefault();
              const from = Number(data.split(':')[2]);
              if (Number.isFinite(from)) onRemoveSlot(from);
            }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm tracking-widest text-torch">{t('haul')}</span>
              <span className="font-display text-[11px] text-white/35">
                {hud.inventory.length + hud.bagItems.length} {t('stacks')}
              </span>
            </div>

            {/* ---------- 5 General Inventory Category Tabs ---------- */}
            <div className="mb-2.5 flex flex-wrap gap-1">
              {INV_CATEGORY_TABS.map((ct) => {
                const active = invCat === ct.id;
                return (
                  <button
                    key={ct.id}
                    onClick={() => setInvCat(ct.id)}
                    className={`notch px-2 py-1 font-display text-[10px] tracking-wider transition-all duration-100 ${
                      active ? 'text-pit-950' : 'text-white/55 hover:text-torch'
                    }`}
                    style={{
                      background: active
                        ? 'linear-gradient(180deg,#f4d07a,#c99a2e)'
                        : 'linear-gradient(180deg,#1b241f,#101713)',
                      border: `2px solid ${active ? '#f4b942' : '#06090a'}`,
                    }}
                  >
                    {t(ct.key as never)}
                  </button>
                );
              })}
            </div>

            {totalShownCount === 0 ? (
              <div className="sunken notch flex min-h-[110px] items-center justify-center px-4 py-8 text-center text-[11px] leading-relaxed tracking-wide text-white/35">
                {t('emptyPack')}
                <br />
                <span className="text-white/20">{t('emptyPackSub')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                {filteredStacks.map((it, i) => {
                  const inBar = hud.hotbar.some((h) => h !== null && h.id === it.id);
                  const isTool = it.id >= 200;
                  const label = isTool ? toolLabel(it.id) : blockName(it.id, BLOCKS[it.id]?.name ?? '');
                  return (
                    <button
                      key={`item-${it.id}`}
                      onClick={() => onPlaceItem(it.id)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `item:${it.id}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      title={`${label} — ${t('dragHint')}`}
                      className="anim-pop notch group relative flex aspect-square items-center justify-center transition-transform duration-100 hover:-translate-y-1 hover:brightness-125 active:translate-y-0"
                      style={{
                        animationDelay: `${i * 18}ms`,
                        background: 'linear-gradient(180deg,#243129,#121a16)',
                        border: `2px solid ${inBar ? '#4d6a55' : '#06090a'}`,
                        boxShadow: inBar
                          ? 'inset 2px 2px 0 rgba(255,255,255,.1), 0 0 10px rgba(147,201,93,.18)'
                          : 'inset 2px 2px 0 rgba(255,255,255,.06), inset -2px -2px 0 rgba(0,0,0,.45)',
                        cursor: 'grab',
                      }}
                    >
                      {isTool ? (
                        <span className="flex h-[62%] w-[62%] items-center justify-center">{toolIcon(it.id, 24).el}</span>
                      ) : (
                        <img src={getBlockIcon(it.id)} alt={label} className="pixelated h-[62%] w-[62%]" draggable={false} />
                      )}
                      <span className="absolute bottom-0 right-0.5 font-display text-[11px] leading-none text-white text-shadow-hard">
                        {it.count}
                      </span>
                      <span className="pointer-events-none absolute inset-x-0 -bottom-5 z-20 hidden truncate bg-black/80 px-1 text-center font-display text-[9px] text-torch group-hover:block">
                        {label}
                      </span>
                    </button>
                  );
                })}

                {/* Armor items directly inside the General Inventory grid (not separate rows) */}
                {filteredGear.map((it, i) => {
                  const rar = RARITY[it.rarity];
                  const mat = MATERIALS[it.material];
                  const inBar = hud.hotbar.some((h) => h !== null && h.id === it.hid);
                  const label = `${t(SLOT_KEY[it.slot])} · ${matName(mat.label)} (${rarName(it.rarity, rar.name)})`;
                  return (
                    <div
                      key={`gear-${it.uid}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `gear:${it.uid}:${it.hid}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => onPlaceItem(it.hid)}
                      title={`${label} · ⛨${it.armor}${it.damage > 0 ? ` ⚔${it.damage}` : ''} — ${t('dragHint')}`}
                      className="anim-pop notch group relative flex aspect-square cursor-grab flex-col items-center justify-center p-1 transition-transform duration-100 hover:-translate-y-1 hover:brightness-125 active:cursor-grabbing"
                      style={{
                        animationDelay: `${(filteredStacks.length + i) * 18}ms`,
                        background: `linear-gradient(180deg, ${rar.color}28, #121a16)`,
                        border: `2px solid ${inBar ? '#f4b942' : rar.color}`,
                        boxShadow: `inset 2px 2px 0 rgba(255,255,255,.1), 0 0 10px ${rar.color}22`,
                      }}
                    >
                      <span className="text-lg leading-none sm:text-xl" style={{ color: mat.color, textShadow: `0 0 8px ${rar.color}` }}>
                        {SLOT_GLYPH[it.slot]}
                      </span>
                      <span className="mt-0.5 max-w-full truncate font-display text-[8px] leading-none" style={{ color: rar.color }}>
                        {t(SLOT_KEY[it.slot])}
                      </span>
                      <span className="absolute bottom-0 right-0.5 font-display text-[9px] leading-none text-white text-shadow-hard">
                        ⛨{it.armor}
                      </span>
                      {/* Quick Equip badge in top-left corner */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEquip(it.uid);
                        }}
                        className="absolute left-0.5 top-0.5 z-10 rounded bg-black/70 px-1 py-0.5 font-display text-[7px] leading-none text-moss hover:bg-moss hover:text-pit-950"
                        title={t('equip')}
                      >
                        {t('equip')}
                      </button>
                      <span className="pointer-events-none absolute inset-x-0 -bottom-5 z-20 hidden truncate bg-black/80 px-1 text-center font-display text-[9px] text-torch group-hover:block">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ---------- equipment (6 equipped slots only — unequipped armor lives in general inventory above) ---------- */}
            <div className="mt-3 border-t border-white/10 pt-2.5 flex flex-col">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-display text-sm tracking-widest text-torch">{t('gear')}</span>
                <span className="font-display text-[11px] text-white/45">
                  ⛨{st.armor} · ⚔{Math.round(st.damage)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-6">
                {SLOTS.map((slot) => {
                  const it = hud.equipped[slot];
                  const rar = it ? RARITY[it.rarity] : null;
                  return (
                    <div
                      key={slot}
                      draggable={!!it}
                      onDragStart={(e) => {
                        if (!it) return;
                        e.dataTransfer.setData('text/plain', `gear:${it.uid}:${it.hid}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        const data = e.dataTransfer.getData('text/plain');
                        if (!data.startsWith('gear:')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const uid = data.split(':')[1];
                        const bag = hud.bagItems.find((b) => b.uid === uid);
                        if (bag && bag.slot === slot) onEquip(uid);
                      }}
                      className="notch relative transition-transform duration-100"
                    >
                      <button
                        onClick={() => it && onUnequip(slot)}
                        className="notch relative w-full px-1.5 py-1 text-left transition-transform duration-100 hover:-translate-y-0.5"
                        style={{
                          background: it ? `linear-gradient(180deg, ${rar!.color}22, rgba(10,14,12,.9))` : 'rgba(255,255,255,.02)',
                          border: `2px solid ${it ? rar!.color : '#1d2823'}`,
                        }}
                        title={it ? t('unequip') : t('emptySlot')}
                      >
                        <div className="font-display text-[9px] tracking-wider text-white/40">{t(SLOT_KEY[slot])}</div>
                        <div className="truncate font-display text-[11px] leading-tight" style={{ color: it ? rar!.color : '#3f4c44' }}>
                          {it ? matName(MATERIALS[it.material].label) : '—'}
                        </div>
                        {it && it.affixes.length > 0 && (
                          <div className="mt-0.5 flex gap-0.5">
                            {it.affixes.map((a) => (
                              <span key={a.id} className="h-1.5 w-1.5" style={{ background: AFFIXES[a.id].color }} />
                            ))}
                          </div>
                        )}
                      </button>
                      {it && (
                        <button
                          onClick={() => onUnequip(slot)}
                          className="btn-mc notch absolute -right-1 -top-1 z-10 px-1 py-0.5 font-display text-[8px] leading-none"
                          style={{ background: 'linear-gradient(180deg,#3d1f1c,#241210)', border: '1px solid #e2564a55', color: '#f2b3ae' }}
                          title={t('unequip')}
                        >
                          {t('unequip')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {(st.fire > 0 || st.frost > 0 || st.vamp > 0 || st.thorns > 0 || st.reach > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
                  {st.fire > 0 && <Badge c={AFFIXES.fire.color} txt={`${t('aff_fire')} ${st.fire.toFixed(1)}/s`} />}
                  {st.frost > 0 && <Badge c={AFFIXES.frost.color} txt={`${t('aff_frost')} ${st.frost.toFixed(0)}%`} />}
                  {st.vamp > 0 && <Badge c={AFFIXES.vamp.color} txt={`${t('aff_vamp')} ${st.vamp.toFixed(1)}`} />}
                  {st.thorns > 0 && <Badge c={AFFIXES.thorns.color} txt={`${t('aff_thorns')} ${st.thorns.toFixed(0)}%`} />}
                  {st.reach > 0 && <Badge c={AFFIXES.reach.color} txt={`${t('aff_reach')} +${st.reach.toFixed(1)}m`} />}
                </div>
              )}

              {/* ---------- hotbar management: 10 quick slots (sparse, drag & drop) ---------- */}
              <div className="mt-3 border-t border-white/10 pt-2.5">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-display text-xs tracking-widest text-torch">{t('hotbarTitle')}</span>
                  <span className="font-display text-[10px] text-white/40">
                    {hud.hotbar.filter(Boolean).length}/10
                  </span>
                </div>

                <div className="mb-1.5 grid grid-cols-5 gap-1 sm:grid-cols-10">
                  {Array.from({ length: 10 }, (_, i) => hud.hotbar[i] ?? null).map((slot, i) => {
                    const active = i === hud.selected;
                    const gearInSlot = slot && isGearHotbarId(slot.id) ? hud.bagItems.find((b) => b.hid === slot.id) : undefined;
                    return (
                      <div
                        key={i}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const data = e.dataTransfer.getData('text/plain');
                          if (!data) return;
                          const parts = data.split(':');
                          if (parts[0] === 'hotbar') {
                            const id = Number(parts[1]);
                            const from = Number(parts[2]);
                            if (Number.isFinite(id) && Number.isFinite(from)) onPlaceItem(id, i, from);
                          } else if (parts[0] === 'item') {
                            const id = Number(parts[1]);
                            if (Number.isFinite(id)) onPlaceItem(id, i);
                          } else if (parts[0] === 'gear') {
                            const hid = Number(parts[2]);
                            if (Number.isFinite(hid)) onPlaceItem(hid, i);
                          }
                        }}
                        className={`notch group/cell relative flex aspect-square items-center justify-center p-0.5 transition-transform hover:-translate-y-0.5 ${
                          active ? 'ring-2 ring-torch' : ''
                        }`}
                        style={{
                          background: slot ? (active ? '#2e4236' : '#1b241f') : '#101713',
                          border: `2px solid ${active ? '#f4b942' : '#06090a'}`,
                        }}
                      >
                        <button
                          onClick={() => {
                            if (onSelectSlot) onSelectSlot(i);
                          }}
                          draggable={!!slot}
                          onDragStart={(e) => {
                            if (!slot) return;
                            e.dataTransfer.setData('text/plain', `hotbar:${slot.id}:${i}`);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
                          title={
                            slot
                              ? slot.id === HAND
                                ? `${t('emptyHand')} — ${t('dragHint')}`
                                : gearInSlot
                                  ? `${t(SLOT_KEY[gearInSlot.slot])} · ${matName(MATERIALS[gearInSlot.material].label)}`
                                  : slot.id >= 200
                                    ? `${toolLabel(slot.id)} — ${t('dragHint')}`
                                    : `${blockName(slot.id, BLOCKS[slot.id]?.name ?? '')} ×${slot.count} — ${t('dragHint')}`
                              : t('emptySlot')
                          }
                        >
                          {slot ? (
                            slot.id === HAND ? (
                              <span className="text-sm sm:text-base">✊</span>
                            ) : gearInSlot ? (
                              <span
                                className="flex flex-col items-center justify-center leading-none"
                                style={{ color: MATERIALS[gearInSlot.material].color }}
                              >
                                <span className="text-sm sm:text-base">{SLOT_GLYPH[gearInSlot.slot]}</span>
                                <span className="font-display text-[7px]" style={{ color: RARITY[gearInSlot.rarity].color }}>
                                  ⛨{gearInSlot.armor}
                                </span>
                              </span>
                            ) : isPickTool(slot.id) ? (
                              <PickIcon size={16} style={{ color: PICKAXE_TIERS[slot.id - PICK_TOOLS[0]]?.color ?? '#b98a4d' }} />
                            ) : isSwordTool(slot.id) ? (
                              <SwordIcon size={16} style={{ color: SWORDS[slot.id - SWORD_TOOLS[0]]?.color ?? '#d9dde2' }} />
                            ) : isAxeTool(slot.id) ? (
                              <AxeIcon size={16} style={{ color: slot.id === AXE_TOOLS[0] ? '#b98a4d' : '#9aa0a6' }} />
                            ) : slot.id === 202 ? (
                              <span className="text-sm text-torch">⨙</span>
                            ) : slot.id === 204 ? (
                              <ShovelIcon size={16} style={{ color: '#b9bec4' }} />
                            ) : slot.id === 205 ? (
                              <BowIcon size={16} style={{ color: '#93c95d' }} />
                            ) : slot.id >= 200 ? (
                              <PickIcon size={16} style={{ color: PICKAXE_TIERS[isPickTool(slot.id) ? slot.id - PICK_TOOLS[0] : 0].color }} />
                            ) : (
                              <img src={getBlockIcon(slot.id)} alt="" className="pixelated h-5 w-5 sm:h-6 sm:w-6" draggable={false} />
                            )
                          ) : (
                            <span className="font-display text-[8px] text-white/20">{i === 9 ? 0 : i + 1}</span>
                          )}
                          {slot && slot.id < 200 && slot.id !== HAND && (
                            <span className="absolute bottom-0 right-0.5 font-display text-[8px] leading-none text-white text-shadow-hard">
                              {slot.count}
                            </span>
                          )}
                        </button>
                        {slot && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSlot(i);
                            }}
                            className={`absolute -right-1 -top-1 z-10 h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none text-white shadow ${
                              isTouch ? 'flex' : 'hidden group-hover/cell:flex'
                            }`}
                            style={{ background: '#e2564a', border: '1px solid #7a2620' }}
                            title={t('removeSlot')}
                          >
                            ×
                          </button>
                        )}
                        <span className="pointer-events-none absolute left-0.5 top-0 font-display text-[7px] leading-none text-white/30">
                          {i === 9 ? 0 : i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mb-1 text-[9px] leading-snug tracking-wide text-white/30">{t('hotbarHint')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- bottom section: Workbench Dismantle Station (when opened via E on Workbench) OR Crafting Recipes ---------- */}
        <div className="anim-rise bevel-flat notch mt-3 flex flex-col p-3" style={{ animationDelay: '120ms' }}>
          {isWorkbenchMode ? (
            <WorkbenchDismantlePanel
              hud={hud}
              wbTarget={wbTarget}
              setWbTarget={setWbTarget}
              onSalvageGear={onSalvageGear}
              onSalvageItem={onSalvageItem}
            />
          ) : (
            <>
              {/* tabs — trade appears near a trader, anvil near a placed anvil */}
              <div className="mb-2 flex flex-wrap gap-1">
                {[
                  ...TABS,
                  ...(hud.tradeNear ? [{ id: 'trade' as Tab, key: 'tab_trade' }] : []),
                  ...(hud.anvilNear ? [{ id: 'anvil' as Tab, key: 'tab_anvil' }] : []),
                ].map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setTab(tb.id)}
                    className={`notch px-2 py-1 font-display text-[10px] tracking-wider transition-all duration-100 ${
                      tab === tb.id ? 'text-pit-950' : 'text-white/45 hover:text-torch'
                    }`}
                    style={{
                      background:
                        tab === tb.id
                          ? tb.id === 'trade'
                            ? 'linear-gradient(180deg,#d98cff,#8b4bb8)'
                            : 'linear-gradient(180deg,#f4d07a,#c99a2e)'
                          : 'linear-gradient(180deg,#1b241f,#101713)',
                      border: `2px solid ${tab === tb.id ? (tb.id === 'trade' ? '#d98cff' : '#f4b942') : '#06090a'}`,
                    }}
                  >
                    {t(tb.key as never)}
                  </button>
                ))}
              </div>

              {/* tab content */}
              {tab === 'trade' ? (
                <TradePanel hud={hud} onSell={onSell} onBuy={onBuy} onSellTool={onSellTool} onSellGear={onSellGear} />
              ) : tab === 'anvil' ? (
                <AnvilPanel hud={hud} onUpgrade={onUpgrade} onReinforce={onReinforce} />
              ) : (
                <Recipes recipes={shownRecipes} craftable={craftable} hud={hud} onCraft={onCraft} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- workbench dismantle station ----------

function WorkbenchDismantlePanel({
  hud,
  wbTarget,
  setWbTarget,
  onSalvageGear,
  onSalvageItem,
}: {
  hud: HudState;
  wbTarget: WorkbenchTarget;
  setWbTarget: (t: WorkbenchTarget) => void;
  onSalvageGear: (uid: string) => void;
  onSalvageItem: (id: number) => void;
}) {
  // Resolve the currently placed item in the workbench slot
  let resolvedGear: Item | undefined;
  let resolvedItemId: number | null = null;
  let ownedCount = 0;

  if (wbTarget?.kind === 'gear') {
    resolvedGear =
      hud.bagItems.find((b) => b.uid === wbTarget.uid) ??
      Object.values(hud.equipped).find((b) => b && b.uid === wbTarget.uid);
    if (resolvedGear) ownedCount = 1;
  } else if (wbTarget?.kind === 'item') {
    if (isGearHotbarId(wbTarget.id)) {
      resolvedGear = hud.bagItems.find((b) => b.hid === wbTarget.id);
      if (resolvedGear) ownedCount = 1;
    } else {
      const found = hud.inventory.find((x) => x.id === wbTarget.id);
      if (found && found.count > 0) {
        resolvedItemId = found.id;
        ownedCount = found.count;
      }
    }
  }

  const salvageOutputs: Array<[number, number]> | null = resolvedGear
    ? getSalvageForGear(resolvedGear)
    : resolvedItemId !== null
      ? (getSalvageForItemId(resolvedItemId)?.outputs ?? null)
      : null;

  const canDismantle = ownedCount > 0 && salvageOutputs !== null && salvageOutputs.length > 0;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const parts = data.split(':');
    if (parts[0] === 'gear') {
      const uid = parts[1];
      if (uid) setWbTarget({ kind: 'gear', uid });
    } else if (parts[0] === 'item') {
      const id = Number(parts[1]);
      if (Number.isFinite(id) && id !== HAND) setWbTarget({ kind: 'item', id });
    } else if (parts[0] === 'hotbar') {
      const id = Number(parts[1]);
      if (Number.isFinite(id) && id !== HAND) {
        if (isGearHotbarId(id)) {
          const g = hud.bagItems.find((b) => b.hid === id);
          if (g) setWbTarget({ kind: 'gear', uid: g.uid });
        } else {
          setWbTarget({ kind: 'item', id });
        }
      }
    }
  };

  const handleDismantle = () => {
    if (!canDismantle) return;
    if (resolvedGear) {
      onSalvageGear(resolvedGear.uid);
      setWbTarget(null);
    } else if (resolvedItemId !== null) {
      const info = getSalvageForItemId(resolvedItemId);
      const consumed = info ? Math.max(1, info.inputsUsed) : 1;
      onSalvageItem(resolvedItemId);
      if (ownedCount - consumed <= 0) {
        setWbTarget(null);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-display text-base tracking-widest text-torch">{t('wb_title')}</div>
          <div className="text-[11px] text-white/45">{t('wb_sub')}</div>
        </div>
      </div>

      <div className="sunken notch flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:px-6 sm:py-5">
        {/* Empty / Occupied Workbench Drag-and-Drop Slot */}
        <div className="flex items-center gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={handleDrop}
            className="notch relative flex h-24 w-24 shrink-0 flex-col items-center justify-center transition-all"
            style={{
              background:
                resolvedGear || resolvedItemId !== null
                  ? 'linear-gradient(180deg,#2e4236,#16201a)'
                  : 'linear-gradient(180deg,#141c17,#0b100d)',
              border:
                resolvedGear || resolvedItemId !== null
                  ? '3px solid #f4b942'
                  : '3px dashed rgba(244,185,66,0.45)',
              boxShadow:
                resolvedGear || resolvedItemId !== null
                  ? '0 0 18px rgba(244,185,66,0.25), inset 2px 2px 0 rgba(255,255,255,0.1)'
                  : 'inset 2px 2px 0 rgba(0,0,0,0.6)',
            }}
          >
            {resolvedGear ? (
              <>
                <span
                  className="text-3xl leading-none"
                  style={{
                    color: MATERIALS[resolvedGear.material].color,
                    textShadow: `0 0 10px ${RARITY[resolvedGear.rarity].color}`,
                  }}
                >
                  {SLOT_GLYPH[resolvedGear.slot]}
                </span>
                <span className="mt-1 font-display text-[10px]" style={{ color: RARITY[resolvedGear.rarity].color }}>
                  ⛨{resolvedGear.armor}
                </span>
                <button
                  onClick={() => setWbTarget(null)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blood font-display text-xs text-white shadow"
                  title={t('removeSlot')}
                >
                  ×
                </button>
              </>
            ) : resolvedItemId !== null ? (
              <>
                {resolvedItemId >= 200 ? (
                  <span className="flex h-12 w-12 items-center justify-center">{toolIcon(resolvedItemId, 34).el}</span>
                ) : (
                  <img
                    src={getBlockIcon(resolvedItemId)}
                    alt=""
                    className="pixelated h-12 w-12"
                    draggable={false}
                  />
                )}
                <span className="absolute bottom-1 right-1.5 font-display text-xs text-white text-shadow-hard">
                  ×{ownedCount}
                </span>
                <button
                  onClick={() => setWbTarget(null)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blood font-display text-xs text-white shadow"
                  title={t('removeSlot')}
                >
                  ×
                </button>
              </>
            ) : (
              <div className="px-2 text-center font-display text-[9px] leading-tight tracking-wider text-white/35">
                {t('wb_empty')}
              </div>
            )}
          </div>

          {/* Item details & returned materials preview */}
          <div className="flex flex-col gap-1.5">
            {resolvedGear ? (
              <div className="font-display text-sm" style={{ color: RARITY[resolvedGear.rarity].color }}>
                {t(SLOT_KEY[resolvedGear.slot])} · {matName(MATERIALS[resolvedGear.material].label)}
              </div>
            ) : resolvedItemId !== null ? (
              <div className="font-display text-sm text-white">
                {resolvedItemId >= 200
                  ? toolLabel(resolvedItemId)
                  : blockName(resolvedItemId, BLOCKS[resolvedItemId]?.name ?? '')}
              </div>
            ) : (
              <div className="font-display text-xs tracking-wider text-white/40">{t('wb_empty')}</div>
            )}

            {(resolvedGear || resolvedItemId !== null) && (
              <>
                {salvageOutputs ? (
                  <div className="flex flex-col gap-1">
                    <span className="font-display text-[10px] tracking-wider text-white/45">{t('wb_returns')}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {salvageOutputs.map(([ingId, count]) => (
                        <span
                          key={ingId}
                          className="notch flex items-center gap-1.5 bg-black/40 px-2 py-1"
                          style={{ border: '1px solid rgba(147,201,93,0.4)' }}
                        >
                          <img src={getBlockIcon(ingId)} alt="" className="pixelated h-5 w-5" draggable={false} />
                          <span className="font-display text-xs text-moss">
                            +{count} {blockName(ingId, BLOCKS[ingId]?.name ?? '')}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="font-display text-xs text-blood">{t('wb_not_craftable')}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Dismantle Action Button */}
        <button
          disabled={!canDismantle}
          onClick={handleDismantle}
          className="btn-mc notch shrink-0 px-5 py-3 font-display text-sm tracking-wider transition-all sm:px-6 sm:py-3.5"
          style={{
            background: canDismantle
              ? 'linear-gradient(180deg, #f4b942, #b87d1e)'
              : 'linear-gradient(180deg, #26322b, #161d19)',
            color: canDismantle ? '#0a0e0c' : '#4c5b52',
            border: `2px solid ${canDismantle ? '#ffd97a' : '#06090a'}`,
            boxShadow: canDismantle ? '0 0 18px rgba(244,185,66,0.35)' : 'none',
          }}
        >
          ♻ {t('salvage')}
        </button>
      </div>
    </div>
  );
}

// ---------- recipes list ----------

function Recipes({
  recipes,
  craftable,
  hud,
  onCraft,
}: {
  recipes: typeof RECIPES;
  craftable: Set<string>;
  hud: HudState;
  onCraft: (key: string) => void;
}) {
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-sm tracking-widest text-torch">{t('recipes')}</span>
        <span className="font-display text-[11px] text-white/35">
          {craftable.size} {t('ready')} · 1–9
        </span>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
        {recipes.map((r, i) => {
          const ready = craftable.has(r.key);
          const justCrafted = hud.lastCraft === r.key;
          const [rName, rDesc] = recipeText(r.key, r.name, r.desc);
          const needsFire = r.kind === 'cook' && !ready && r.inputs.every(([id, n]) => (hud.inventory.find((x) => x.id === id)?.count ?? 0) >= n);
          return (
            <div
              key={r.key}
              className={`anim-rise notch group relative flex items-center gap-2.5 px-2.5 py-2 transition-all duration-150 sm:gap-3 ${
                ready ? 'hover:translate-x-1' : 'opacity-45'
              } ${justCrafted ? 'anim-pop' : ''}`}
              style={{
                animationDelay: `${140 + i * 34}ms`,
                background: ready
                  ? `linear-gradient(90deg, ${r.accent}22, rgba(255,255,255,.02) 55%)`
                  : 'rgba(255,255,255,.015)',
                borderLeft: `4px solid ${ready ? r.accent : '#22302a'}`,
                boxShadow: ready ? `0 0 18px ${r.accent}1f` : 'none',
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center font-display text-[11px]"
                style={{ background: '#0c1210', color: ready ? r.accent : '#4c5b52', border: '2px solid #06090a' }}
              >
                {r.hotkey}
              </span>

              <div className="flex w-11 shrink-0 items-center justify-center">
                {r.out ? (
                  <img src={getBlockIcon(r.out[0])} alt="" className="pixelated h-9 w-9 drop-shadow-[0_2px_0_rgba(0,0,0,.6)]" draggable={false} />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center"
                    style={{ color: r.accent }}
                  >
                    {r.kind === 'pickaxe' ? (
                      <PickIcon size={26} style={{ color: r.accent }} />
                    ) : r.kind === 'time' ? (
                      <ClockGlyph />
                    ) : (
                      <HeartGlyph />
                    )}
                  </span>
                )}
                {r.out && r.out[1] > 1 && (
                  <span className="ml-0.5 font-display text-sm text-white/70">×{r.out[1]}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-display text-sm leading-tight sm:text-base" style={{ color: ready ? r.accent : '#c9d3cc' }}>
                    {rName}
                  </span>
                  {needsFire && (
                    <span className="shrink-0 bg-[#4a2c14] px-1 font-display text-[9px] tracking-wider text-[#ff8a2b]">
                      {t('needCampfire')}
                    </span>
                  )}
                </div>
                <div className="truncate text-[10px] leading-tight text-white/40">{rDesc}</div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {r.inputs.map(([id, n]) => {
                  const have = hud.inventory.find((x) => x.id === id)?.count ?? 0;
                  const ok = have >= n;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-0.5"
                      title={`${blockName(id, BLOCKS[id].name)}: ${have}/${n}`}
                    >
                      <img
                        src={getBlockIcon(id)}
                        alt=""
                        className="pixelated h-6 w-6"
                        style={{ filter: ok ? 'none' : 'grayscale(1) brightness(.55)' }}
                        draggable={false}
                      />
                      <span className={`font-display text-xs ${ok ? 'text-moss' : 'text-blood'}`}>
                        {have}/{n}
                      </span>
                    </span>
                  );
                })}
              </div>

              <button
                disabled={!ready}
                onClick={() => onCraft(r.key)}
                className="btn-mc notch shrink-0 px-2.5 py-2 font-display text-[11px] leading-none sm:px-3.5 sm:text-xs"
                style={{
                  background: ready ? `linear-gradient(180deg, ${r.accent}, ${r.accent}99)` : 'linear-gradient(180deg,#26322b,#161d19)',
                  color: ready ? '#0a0e0c' : '#4c5b52',
                }}
              >
                {t('craft')}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 border-t border-white/10 pt-2 text-[10px] tracking-wide text-white/35">
        <span className="text-torch">I</span> / <span className="text-torch">ESC</span> {t('closeHint')}
      </div>
    </>
  );
}

// ---------- trader ----------

function TradePanel({
  hud,
  onSell,
  onBuy,
  onSellTool,
  onSellGear,
}: {
  hud: HudState;
  onSell: (id: number) => void;
  onBuy: (i: number) => void;
  onSellTool: (id: number) => void;
  onSellGear: (uid: string) => void;
}) {
  const sellable = hud.inventory.filter((it) => it.count > 0 && it.id < 200);
  const tools = hud.inventory.filter((it) => it.id >= 200);
  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      <div>
        <div className="font-display text-sm tracking-widest text-[#d98cff]">{t('trader')}</div>
        <div className="text-[10px] tracking-wider text-white/40">{t('traderSub')}</div>
      </div>

      {/* offers */}
      <div className="flex flex-col gap-1.5">
        {hud.offers.map((o, i) => {
          const rar = RARITY[o.item.rarity];
          const afford = o.cost.every(([id, n]) => (hud.inventory.find((x) => x.id === id)?.count ?? 0) >= n);
          return (
            <div
              key={i}
              className={`notch flex items-center gap-2.5 px-2.5 py-2 ${o.sold ? 'opacity-35' : ''}`}
              style={{
                background: `linear-gradient(90deg, ${rar.color}22, rgba(255,255,255,.02) 60%)`,
                borderLeft: `4px solid ${rar.color}`,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm" style={{ color: rar.color }}>
                  {t(SLOT_KEY[o.item.slot])} · {matName(MATERIALS[o.item.material].label)} ·{' '}
                  {rarName(o.item.rarity, rar.name)}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span className="font-display text-[9px] text-white/50">⛨{o.item.armor}{o.item.damage > 0 ? ` ⚔${o.item.damage}` : ''}</span>
                  {o.item.affixes.map((a) => (
                    <span key={a.id} className="px-1 font-display text-[9px]" style={{ color: AFFIXES[a.id].color, background: `${AFFIXES[a.id].color}1a` }}>
                      {t(AFFIXES[a.id].nameKey)} {a.value}{AFFIXES[a.id].unit}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {o.cost.map(([id, n]) => (
                  <span key={id} className="flex items-center gap-0.5">
                    <img src={getBlockIcon(id)} alt="" className="pixelated h-6 w-6" draggable={false} />
                    <span className="font-display text-xs text-white/60">×{n}</span>
                  </span>
                ))}
              </div>
              <button
                disabled={o.sold || !afford}
                onClick={() => onBuy(i)}
                className="btn-mc notch shrink-0 px-2.5 py-2 font-display text-[11px] leading-none"
                style={{
                  background: o.sold || !afford ? 'linear-gradient(180deg,#26322b,#161d19)' : 'linear-gradient(180deg,#d98cff,#8b4bb8)',
                  color: o.sold || !afford ? '#4c5b52' : '#12081a',
                }}
              >
                {o.sold ? t('offerSold') : t('buy')}
              </button>
            </div>
          );
        })}
      </div>

      {/* sell tools & gear */}
      {(tools.length > 0 || hud.bagItems.length > 0) && (
        <div className="border-t border-white/10 pt-2">
          <div className="mb-1.5 font-display text-xs tracking-widest text-[#d98cff]">{t('sellGear')}</div>
          <div className="flex flex-col gap-1">
            {tools.map((s) => (
              <button
                key={s.id}
                onClick={() => onSellTool(s.id)}
                className="notch flex items-center justify-between px-2 py-1 transition-transform duration-100 hover:-translate-y-0.5 hover:brightness-125"
                style={{ background: 'linear-gradient(180deg,#243129,#121a16)', border: '2px solid #06090a' }}
              >
                <span className="font-display text-[11px] text-white/75">
                  {toolLabel(s.id)}
                  {s.count > 1 ? ` ×${s.count}` : ''}
                </span>
                <span className="font-display text-[10px] text-torch">
                  +{toolSellPrice(s.id)} {t('pts')}
                </span>
              </button>
            ))}
            {hud.bagItems.map((it) => (
              <button
                key={it.uid}
                onClick={() => onSellGear(it.uid)}
                className="notch flex items-center justify-between px-2 py-1 transition-transform duration-100 hover:-translate-y-0.5 hover:brightness-125"
                style={{
                  background: `linear-gradient(90deg, ${RARITY[it.rarity].color}18, #121a16 65%)`,
                  border: '2px solid #06090a',
                }}
              >
                <span className="truncate font-display text-[11px]" style={{ color: RARITY[it.rarity].color }}>
                  {t(SLOT_KEY[it.slot])} · {matName(MATERIALS[it.material].label)}
                </span>
                <span className="shrink-0 font-display text-[10px] text-torch">{t('sell')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* sell list */}
      <div className="border-t border-white/10 pt-2">
        <div className="mb-1.5 font-display text-xs tracking-widest text-torch">{t('sell')}</div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {sellable.map((it) => (
            <button
              key={it.id}
              onClick={() => onSell(it.id)}
              className="notch flex items-center gap-1.5 px-1.5 py-1 text-left transition-transform duration-100 hover:-translate-y-0.5 hover:brightness-125"
              style={{ background: 'linear-gradient(180deg,#243129,#121a16)', border: '2px solid #06090a' }}
              title={`${blockName(it.id, BLOCKS[it.id].name)} ×${it.count}`}
            >
              <img src={getBlockIcon(it.id)} alt="" className="pixelated h-6 w-6 shrink-0" draggable={false} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[10px] text-white/70">×{it.count}</span>
                <span className="block font-display text-[10px] text-torch">
                  +{hud.sellPrices[it.id] ? hud.sellPrices[it.id] * it.count : it.count} {t('pts')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- anvil ----------

function AnvilPanel({
  hud,
  onUpgrade,
  onReinforce,
}: {
  hud: HudState;
  onUpgrade: (uid: string) => void;
  onReinforce: (uid: string) => void;
}) {
  const netherite = hud.inventory.find((x) => x.id === 51)?.count ?? 0;
  const iron = hud.inventory.find((x) => x.id === 6)?.count ?? 0;
  const allGear: Array<{ item: Item; equipped: boolean }> = [
    ...Object.values(hud.equipped)
      .filter((it): it is Item => !!it)
      .map((item) => ({ item, equipped: true })),
    ...hud.bagItems.map((item) => ({ item, equipped: false })),
  ];
  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-1">
      <div>
        <div className="font-display text-sm tracking-widest text-[#8a6a58]">{t('tab_anvil')}</div>
        <div className="text-[10px] tracking-wider text-white/40">{t('anvilHint')}</div>
        <div className="mt-1 flex gap-3 font-display text-[11px]">
          <span className="text-[#8a6a58]">{matName('NETHERITE')} ×{netherite}</span>
          <span className="text-white/50">{matName('IRON')} ×{iron}</span>
        </div>
      </div>
      {allGear.length === 0 && (
        <div className="sunken notch px-4 py-8 text-center text-[11px] tracking-wide text-white/35">—</div>
      )}
      {allGear.map(({ item, equipped }) => {
        const rar = RARITY[item.rarity];
        const canNeth = item.material === 'diamond' && netherite >= 1;
        const canRe = iron >= 4;
        return (
          <div
            key={item.uid}
            className="notch flex items-center gap-2.5 px-2.5 py-2"
            style={{
              background: `linear-gradient(90deg, ${MATERIALS[item.material].color}22, rgba(255,255,255,.02) 60%)`,
              borderLeft: `4px solid ${MATERIALS[item.material].color}`,
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm" style={{ color: rar.color }}>
                {t(SLOT_KEY[item.slot])} · {matName(MATERIALS[item.material].label)}
                {equipped && <span className="ml-1.5 text-[9px] text-moss">◀ {t('equipped')}</span>}
              </div>
              <div className="font-display text-[10px] text-white/50">
                ⛨{item.armor}
                {item.damage > 0 ? ` ⚔${item.damage}` : ''}
              </div>
            </div>
            {item.material === 'diamond' && (
              <button
                disabled={!canNeth}
                onClick={() => onUpgrade(item.uid)}
                className="btn-mc notch shrink-0 px-2.5 py-2 font-display text-[10px] leading-none"
                style={{
                  background: canNeth ? 'linear-gradient(180deg,#8a6a58,#4a3830)' : 'linear-gradient(180deg,#26322b,#161d19)',
                  color: canNeth ? '#f4e8dc' : '#4c5b52',
                }}
              >
                {t('upgradeNeth')}
              </button>
            )}
            <button
              disabled={!canRe}
              onClick={() => onReinforce(item.uid)}
              className="btn-mc notch shrink-0 px-2.5 py-2 font-display text-[10px] leading-none"
              style={{
                background: canRe ? 'linear-gradient(180deg,#c8ccd2,#8f959d)' : 'linear-gradient(180deg,#26322b,#161d19)',
                color: canRe ? '#12161a' : '#4c5b52',
              }}
            >
              {t('reinforce')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- glyphs ----------

const ClockGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2.5" />
  </svg>
);

const HeartGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
    <path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z" />
  </svg>
);
