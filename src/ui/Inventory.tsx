import { useState } from 'react';
import type { HudState } from '../game/engine';
import {
  RECIPES,
  HAND,
  TOOL_TORCH,
  PICK_TOOLS,
  isToolId,
  toolSellPrice,
  toolRecipeDesc,
  getItemInvCategory,
  getSalvageForItemId,
  getSalvageForGear,
  type InvCategory,
} from '../game/recipes';
import { BLOCKS, PICKAXE_TIERS, ARROW_ITEM, STONE_ARROW, IRON_ARROW, GOLD_ARROW, NETHERITE_ARROW, FIRE_ARROW, POISON_ARROW, FREEZE_ARROW, STUN_ARROW } from '../game/blocks';
import { getBlockIcon } from '../game/textures';
import { BagIcon, CloseIcon } from './icons';
import { AFFIXES, gearColor, gearSellPrice, isGearHotbarId, MATERIALS, RARITY, SLOTS, SLOT_KEY, type Item, type Slot } from '../game/items';
import { blockName, matName, rarName, recipeText, toolLabelForId, t } from '../game/i18n';
import { meatItemLabel } from '../game/food';
import { getToolSpec, toolRepairCost } from '../game/tools';
import { DurabilityBar, ToolSprite } from './ToolSprite';
import { MONKEY_COATS, WOLF_COATS, type PetKind } from '../game/pets';
import { MonkeyIcon } from './MonkeyIcon';
import { WolfIcon } from './WolfIcon';
import { GearIcon } from './GearIcon';

// ---------- helpers ----------

function toolIcon(id: number, size = 24, durability?: number): { el: React.ReactNode; label: string } {
  if (id === HAND) return { el: <span className="text-[16px] leading-none">✊</span>, label: t('emptyHand') };
  const spec = getToolSpec(id);
  if (spec) return { el: <ToolSprite id={id} size={size} durability={durability} />, label: toolLabelForId(id) };
  if (id === TOOL_TORCH) return { el: <span className="text-torch text-[14px] leading-none">⨙</span>, label: t('handTorch') };
  return { el: <span className="text-white/60">#{id}</span>, label: `#${id}` };
}

function toolLabel(id: number): string {
  return getToolSpec(id) ? toolLabelForId(id) : toolIcon(id, 0).label;
}

// ---------- types ----------

type Props = {
  hud: HudState;
  onCraft: (key: string) => void;
  onPlaceItem: (id: number, slot?: number, fromSlot?: number, instanceId?: number) => void;
  onEquipArrow?: (id: number) => void;
  onRemoveSlot: (slot: number) => void;
  onSelectSlot?: (i: number) => void;
  onClose: () => void;
  onEquip: (uid: string) => void;
  onUnequip: (slot: Slot) => void;
  onEquipPet: (kind: PetKind) => void;
  onUnequipPet: (kind: PetKind) => void;
  onSelectPetKind: (kind: PetKind) => void;
  onCyclePetCoat: (kind: PetKind, direction: number) => void;
  onSell: (id: number) => void;
  onBuy: (i: number) => void;
  onUpgrade: (uid: string) => void;
  onReinforce: (uid: string) => void;
  onRepairTool: (instanceId: number) => void;
  onSellTool: (id: number, instanceId?: number) => void;
  onSellGear: (uid: string) => void;
  onSalvageGear: (uid: string) => void;
  onSalvageItem: (id: number, instanceId?: number) => void;
  developerKitEnabled?: boolean;
  onDeveloperGrantAll?: () => boolean;
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
  { id: 'pets', key: 'inv_tab_pets' },
];

type WorkbenchTarget = { kind: 'item'; id: number; instanceId?: number } | { kind: 'gear'; uid: string } | null;

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
  onEquipArrow,
  onRemoveSlot,
  onSelectSlot,
  onClose,
  onEquip,
  onUnequip,
  onEquipPet,
  onUnequipPet,
  onSelectPetKind,
  onCyclePetCoat,
  onSell,
  onBuy,
  onUpgrade,
  onReinforce,
  onRepairTool,
  onSellTool,
  onSellGear,
  onSalvageGear,
  onSalvageItem,
  developerKitEnabled = false,
  onDeveloperGrantAll,
  isTouch,
}: Props) {
  const craftable = new Set(hud.craftable);
  const arrowIds = [ARROW_ITEM, STONE_ARROW, IRON_ARROW, GOLD_ARROW, NETHERITE_ARROW, FIRE_ARROW, POISON_ARROW, FREEZE_ARROW, STUN_ARROW];
  const st = hud.stats;
  const isWorkbenchMode = hud.invTab === 'workbench';

  const [tab, setTab] = useState<Tab>(
    hud.invTab === 'trade' && hud.tradeNear ? 'trade' : hud.invTab === 'anvil' && hud.anvilNear ? 'anvil' : 'tools',
  );
  const [invCat, setInvCat] = useState<InvCategory>('all');
  const [gearTab, setGearTab] = useState<'all' | Slot>('all');
  const [wbTarget, setWbTarget] = useState<WorkbenchTarget>(null);

  const shownRecipes = RECIPES.filter((r) => r.group === tab);

  // Filter general inventory stacks + armor items according to selected general inventory tab
  const filteredStacks =
    invCat === 'armor' || invCat === 'pets'
      ? []
      : hud.inventory.filter((it) => it.id !== hud.arrowLoadout && (invCat === 'all' || getItemInvCategory(it.id) === invCat));
  const filteredGear = (invCat === 'all' || invCat === 'armor' ? hud.bagItems : [])
    .filter((it) => gearTab === 'all' || it.slot === gearTab)
    .sort((a, b) => (a.armor + a.damage) - (b.armor + b.damage));
  const filteredPets = invCat === 'all' || invCat === 'pets' ? hud.petInventoryKinds.filter((kind) => kind !== hud.petEquippedKind) : [];
  const totalShownCount = filteredStacks.length + filteredGear.length + filteredPets.length;
  const petDisplayKind = hud.petEquippedKind ?? hud.petSelectedKind;
  const petDisplayOwned = hud.petOwnedKinds.includes(petDisplayKind);
  const petDisplayCoatIndex = hud.petCoatIndices[petDisplayKind];

  return (
    <div className="inventory-screen absolute inset-0 z-30 overflow-y-auto overscroll-contain bg-pit-950/85 backdrop-blur-[3px]">
      <div className="pointer-events-none absolute inset-0 grain opacity-30" />
      <div className="relative mx-auto flex min-h-full w-full min-w-0 max-w-5xl flex-col p-2 sm:p-6">
        {/* ---------- header ---------- */}
        <div
          className="anim-rise bevel notch sticky top-0 z-40 mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{ top: 'max(0px, env(safe-area-inset-top))' }}
        >
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
            <div className="bevel-flat notch flex items-center gap-2 px-3 py-1.5" style={{ borderColor: PICKAXE_TIERS[hud.tier]?.color ?? '#b98a4d' }}>
              <ToolSprite id={PICK_TOOLS[hud.tier] ?? PICK_TOOLS[0]} size={18} />
              <span className="font-display text-base leading-none" style={{ color: PICKAXE_TIERS[hud.tier]?.color ?? '#b98a4d' }}>
                {hud.tierName}
              </span>
              <span className="font-display text-[10px] text-white/40">{PICKAXE_TIERS[hud.tier]?.speed.toFixed(1)}x</span>
            </div>
            {developerKitEnabled && (
              <button
                type="button"
                data-developer-kit="1"
                onClick={() => onDeveloperGrantAll?.()}
                title={t('devKitDescription')}
                className="notch border border-[#ff536466] bg-[#351a20] px-2.5 py-2 font-display text-[10px] tracking-wider text-[#ff7180] transition hover:bg-[#52212a] hover:text-white"
              >
                {t('devKitButton')}
              </button>
            )}
            <button
              onClick={onClose}
              title={t('closeHint')}
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
                {hud.inventory.length + hud.bagItems.length + hud.petInventoryKinds.length} {t('stacks')}
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
            {invCat === 'armor' && (
              <div className="mb-2 flex flex-wrap gap-1">
                {([['all','ВСЕ'], ['head','ШЛЕМ'], ['chest','НАГРУДНИК'], ['legs','ПОНOЖИ'], ['feet','БОТИНКИ'], ['hands','ПЕРЧАТКИ'], ['offhand','ЩИТ']] as const).map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setGearTab(id)} className={`notch px-2 py-1 font-display text-[9px] ${gearTab === id ? 'text-pit-950 bg-torch' : 'text-white/55 bg-black/25'}`}>{label}</button>
                ))}
              </div>
            )}

            {totalShownCount === 0 ? (
              <div className="sunken notch flex min-h-[110px] items-center justify-center px-4 py-8 text-center text-[11px] leading-relaxed tracking-wide text-white/35">
                {t('emptyPack')}
                <br />
                <span className="text-white/20">{t('emptyPackSub')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                {filteredPets.map((kind) => {
                  const coatIndex = hud.petCoatIndices[kind];
                  const coats = kind === 'wolf' ? WOLF_COATS : MONKEY_COATS;
                  const resourceKey = kind === 'wolf' ? 'petWolfResource' : 'petMonkeyResource';
                  return (
                    <button
                      key={`pet-${kind}-token`}
                      type="button"
                      data-pet-resource={kind}
                      aria-label={t(resourceKey)}
                      onClick={() => onEquipPet(kind)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `pet:${kind}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      title={`${t(resourceKey)} — ${t('petEquipHint')}`}
                      className="anim-pop notch group relative flex aspect-square cursor-grab flex-col items-center justify-center gap-0.5 transition-transform duration-100 hover:-translate-y-1 hover:brightness-125 active:translate-y-0"
                      style={{
                        background: 'linear-gradient(180deg,#3a3026,#171a17)',
                        border: '2px solid #c59b66',
                        boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.08), 0 0 10px rgba(197,155,102,.18)',
                      }}
                    >
                      {kind === 'wolf' ? <WolfIcon coatIndex={coatIndex} size={42} /> : <MonkeyIcon coatIndex={coatIndex} size={39} />}
                      <span className="max-w-full truncate px-1 font-display text-[8px] leading-none text-[#e8d5b4]">
                        {t(resourceKey)}
                      </span>
                      <span className="pointer-events-none absolute inset-x-0 -bottom-5 z-20 hidden truncate bg-black/80 px-1 text-center font-display text-[9px] text-torch group-hover:block">
                        {t(coats[coatIndex]?.nameKey ?? coats[0].nameKey)}
                      </span>
                    </button>
                  );
                })}
                {filteredStacks.map((it, i) => {
                  const spec = getToolSpec(it.id);
                  const isTool = isToolId(it.id);
                  const inBar = hud.hotbar.some((h) => h !== null && (spec ? h.instanceId === it.instanceId : h.id === it.id));
                  const label = isTool ? toolLabel(it.id) : (meatItemLabel(it.id) ?? blockName(it.id, BLOCKS[it.id]?.name ?? ''));
                  const condition = spec ? `${it.durability ?? spec.maxDurability}/${spec.maxDurability || '∞'}` : '';
                  return (
                    <button
                      key={`item-${it.id}-${it.instanceId ?? 'stack'}`}
                      onClick={() => onPlaceItem(it.id, undefined, undefined, it.instanceId)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `item:${it.id}:${it.instanceId ?? ''}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      title={`${label}${condition ? ` · ${condition}` : ''}${RECIPES.find((r) => r && ((spec && r.toolId === it.id) || r.out?.[0] === it.id))?.desc ? ` · ${RECIPES.find((r) => r && ((spec && r.toolId === it.id) || r.out?.[0] === it.id))?.desc}` : ''} — ${t('dragHint')}`}
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
                        <span className="flex h-[82%] w-[82%] items-center justify-center">{toolIcon(it.id, 34, it.durability).el}</span>
                      ) : (
                        <img src={getBlockIcon(it.id)} alt={label} className="pixelated h-[62%] w-[62%]" draggable={false} />
                      )}
                      {spec && (
                        <DurabilityBar
                          current={it.durability ?? spec.maxDurability}
                          max={spec.maxDurability}
                          className="absolute bottom-1 left-1 right-1 h-[3px]"
                          title={condition}
                        />
                      )}
                      {!spec && it.count > 1 && (
                        <span className="absolute bottom-0 right-0.5 font-display text-[11px] leading-none text-white text-shadow-hard">
                          {it.count}
                        </span>
                      )}
                      <span className="pointer-events-none absolute inset-x-0 -bottom-5 z-20 hidden truncate bg-black/80 px-1 text-center font-display text-[9px] text-torch group-hover:block">
                        {label}
                      </span>
                      {arrowIds.includes(it.id) && (
                        <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onEquipArrow?.(it.id); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEquipArrow?.(it.id); } }} className="absolute bottom-1 left-1 right-1 z-30 rounded bg-[#b98a35] px-1 py-0.5 text-center font-display text-[8px] text-pit-950">ЭКИПИРОВАТЬ</span>
                      )}
                    </button>
                  );
                })}

                {/* Armor items directly inside the General Inventory grid (not separate rows) */}
                {filteredGear.map((it, i) => {
                  const rar = RARITY[it.rarity];
                  const mat = MATERIALS[it.material];
                  const armorTint = gearColor(it);
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
                      <GearIcon slot={it.slot} color={armorTint} size={30} className="drop-shadow-[0_0_5px_rgba(255,255,255,.18)]" />
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

              <div className="equipment-grid grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-8">
                <div className="notch relative flex min-h-[92px] min-w-0 flex-col border-2 border-[#f4b942] bg-black/30 p-1 text-center">
                  <div className="font-display text-[8px] tracking-wider text-white/40">СТРЕЛЫ</div>
                  {hud.arrowLoadout !== null ? <img src={getBlockIcon(hud.arrowLoadout)} className="pixelated mx-auto h-7 w-7" /> : <div className="h-7 text-white/25">—</div>}
                  {hud.arrowLoadout !== null && <button type="button" onClick={() => onEquipArrow?.(hud.arrowLoadout!)} className="btn-mc notch mt-0.5 w-full px-1 py-0.5 font-display text-[8px] leading-none text-[#f2b3ae]">СНЯТЬ</button>}
                </div>
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
                      className="notch relative min-w-0 min-h-[92px] transition-transform duration-100"
                    >
                      <button
                        onClick={() => it && onUnequip(slot)}
                        className="notch relative flex min-h-[72px] w-full flex-col justify-center px-1 py-1 text-left transition-transform duration-100 hover:-translate-y-0.5"
                        style={{
                          background: it ? `linear-gradient(180deg, ${rar!.color}22, rgba(10,14,12,.9))` : 'rgba(255,255,255,.02)',
                          border: `2px solid ${it ? rar!.color : '#1d2823'}`,
                        }}
                        title={it ? t('unequip') : t('emptySlot')}
                      >
                        <div className="flex min-w-0 items-center gap-1">
                          {it && <GearIcon slot={it.slot} color={gearColor(it)} size={20} className="shrink-0" />}
                          <div className="min-w-0">
                            <div className="font-display text-[9px] tracking-wider text-white/40">{t(SLOT_KEY[slot])}</div>
                            <div className="truncate font-display text-[11px] leading-tight" style={{ color: it ? gearColor(it) : '#3f4c44' }}>
                              {it ? matName(MATERIALS[it.material].label) : '—'}
                            </div>
                          </div>
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
                          className="btn-mc notch absolute bottom-1 left-1 right-1 z-10 px-1 py-0.5 font-display text-[8px] leading-none"
                          style={{ background: 'linear-gradient(180deg,#3d1f1c,#241210)', border: '1px solid #e2564a55', color: '#f2b3ae' }}
                          title={t('unequip')}
                        >
                          {t('unequip')}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div
                  key="pet-shared-slot"
                  data-pet-slot={petDisplayKind}
                  data-pet-shared-slot="true"
                  data-pet-kind={hud.petEquippedKind ?? petDisplayKind}
                  data-pet-equipped={hud.petEquipped ? 'true' : 'false'}
                  data-pet-coat-index={petDisplayCoatIndex}
                  onDragOver={(e) => {
                    if (hud.petInventoryKinds.length === 0) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    const data = e.dataTransfer.getData('text/plain');
                    const kind = data.startsWith('pet:') ? data.slice(4) : '';
                    if ((kind !== 'wolf' && kind !== 'monkey') || !hud.petInventoryKinds.includes(kind)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onEquipPet(kind);
                  }}
                  className="notch flex min-w-0 flex-col gap-1 p-1"
                >
                  {false && (
                    <div className="flex items-center justify-center gap-1 border-b border-white/10 pb-0.5">
                      {hud.petOwnedKinds.map((kind) => (
                        <button
                          key={`pet-select-${kind}`}
                          type="button"
                          data-pet-select={kind}
                          aria-label={t(kind === 'wolf' ? 'petWolfResource' : 'petMonkeyResource')}
                          onClick={() => onSelectPetKind(kind)}
                          className="flex h-7 w-8 items-center justify-center border transition-colors disabled:cursor-default"
                          style={{
                            borderColor: (hud.petEquippedKind ?? hud.petSelectedKind) === kind ? '#c59b66' : '#ffffff18',
                            background: (hud.petEquippedKind ?? hud.petSelectedKind) === kind ? '#c59b6624' : 'transparent',
                            opacity: hud.petEquipped && hud.petEquippedKind !== kind ? 0.4 : 1,
                          }}
                        >
                          {kind === 'wolf'
                            ? <WolfIcon coatIndex={hud.petCoatIndices.wolf} size={23} />
                            : <MonkeyIcon coatIndex={hud.petCoatIndices.monkey} size={21} />}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    data-pet-toggle={petDisplayKind}
                    disabled={!hud.petOwned}
                    onClick={() => {
                      if (hud.petEquipped && hud.petEquippedKind) onUnequipPet(hud.petEquippedKind);
                      else if (petDisplayOwned) onEquipPet(petDisplayKind);
                    }}
                    title={hud.petEquipped ? t('petUnequipHint') : hud.petTokenAvailable ? t('petEquipHint') : t('petNotOwned')}
                    className="notch flex min-h-[72px] w-full flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                    style={{
                      background: hud.petEquipped ? 'linear-gradient(180deg,#3a3026,#171a17)' : 'rgba(255,255,255,.02)',
                      border: `2px solid ${hud.petEquipped || hud.petTokenAvailable ? '#c59b66' : '#1d2823'}`,
                    }}
                  >
                    <span className="font-display text-[9px] tracking-wider text-white/40">{t('petSlot')}</span>
                    {petDisplayOwned
                      ? petDisplayKind === 'wolf'
                        ? <WolfIcon coatIndex={petDisplayCoatIndex} size={31} />
                        : <MonkeyIcon coatIndex={petDisplayCoatIndex} size={29} />
                      : <span className="text-2xl leading-none text-white/25">🐾</span>}
                    <span className="max-w-full truncate font-display text-[8px] leading-none text-[#e8d5b4]">
                      {hud.petEquipped ? 'ДОМОЙ' : hud.petTokenAvailable ? 'В ПУТЬ' : t('petNotOwned')}
                    </span>
                  </button>
                  {petDisplayOwned && (
                    <div className="flex min-w-0 items-center justify-between gap-0.5 border-t border-white/10 pt-0.5">
                      <button
                        type="button"
                        data-pet-coat-prev
                        aria-label={t(petDisplayKind === 'wolf' ? 'petCoatPrevious' : 'petMonkeyCoatPrevious')}
                        onClick={() => onCyclePetCoat(petDisplayKind, -1)}
                        className="h-5 w-5 shrink-0 font-display text-sm leading-none text-white/60 hover:text-torch"
                      >
                        ‹
                      </button>
                      <span className="min-w-0 truncate text-center font-display text-[8px] text-torch">
                        {t((petDisplayKind === 'wolf' ? WOLF_COATS : MONKEY_COATS)[petDisplayCoatIndex]?.nameKey
                          ?? (petDisplayKind === 'wolf' ? WOLF_COATS : MONKEY_COATS)[0].nameKey)}
                      </span>
                      <button
                        type="button"
                        data-pet-coat-next
                        aria-label={t(petDisplayKind === 'wolf' ? 'petCoatNext' : 'petMonkeyCoatNext')}
                        onClick={() => onCyclePetCoat(petDisplayKind, 1)}
                        className="h-5 w-5 shrink-0 font-display text-sm leading-none text-white/60 hover:text-torch"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
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
                    const toolSpec = slot ? getToolSpec(slot.id) : null;
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
                            const instanceId = parts[3] ? Number(parts[3]) : undefined;
                            if (Number.isFinite(id) && Number.isFinite(from)) onPlaceItem(id, i, from, instanceId);
                          } else if (parts[0] === 'item') {
                            const id = Number(parts[1]);
                            const instanceId = parts[2] ? Number(parts[2]) : undefined;
                            if (Number.isFinite(id)) onPlaceItem(id, i, undefined, instanceId);
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
                            e.dataTransfer.setData('text/plain', `hotbar:${slot.id}:${i}:${slot.instanceId ?? ''}`);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
                          title={
                            slot
                              ? slot.id === HAND
                                ? `${t('emptyHand')} — ${t('dragHint')}`
                                : gearInSlot
                                  ? `${t(SLOT_KEY[gearInSlot.slot])} · ${matName(MATERIALS[gearInSlot.material].label)}`
                                  : isToolId(slot.id)
                                    ? `${toolLabel(slot.id)}${toolSpec ? ` · ${slot.durability ?? toolSpec.maxDurability}/${toolSpec.maxDurability || '∞'}` : ''} — ${t('dragHint')}`
                                    : `${blockName(slot.id, BLOCKS[slot.id]?.name ?? '')} ×${slot.count} — ${t('dragHint')}`
                              : t('emptySlot')
                          }
                        >
                          {slot ? (
                            slot.id === HAND ? (
                              <span className="text-2xl leading-none sm:text-3xl lg:text-4xl">✊</span>
                            ) : gearInSlot ? (
                              <span className="flex flex-col items-center justify-center leading-none">
                                <GearIcon
                                  slot={gearInSlot.slot}
                                  color={gearColor(gearInSlot)}
                                  size={34}
                                  className="drop-shadow-[0_0_5px_rgba(255,255,255,.18)]"
                                />
                                <span className="font-display text-[7px]" style={{ color: RARITY[gearInSlot.rarity].color }}>
                                  ⛨{gearInSlot.armor}
                                </span>
                              </span>
                            ) : isToolId(slot.id) ? (
                              <span className="flex h-full w-full items-center justify-center">
                                {toolSpec ? (
                                  <ToolSprite
                                    id={slot.id}
                                    size={56}
                                    className="h-[58%] w-[58%] max-h-14 max-w-14"
                                    durability={slot.durability}
                                  />
                                ) : slot.id === TOOL_TORCH ? (
                                  <span className="text-2xl leading-none text-torch sm:text-3xl lg:text-4xl">⨙</span>
                                ) : (
                                  <span className="text-[10px] text-white/60">?</span>
                                )}
                              </span>
                            ) : (
                              <img
                                src={getBlockIcon(slot.id)}
                                alt=""
                                className="pixelated h-[58%] max-h-14 max-w-14 w-[58%]"
                                draggable={false}
                              />
                            )
                          ) : (
                            <span className="font-display text-[8px] text-white/20">{i === 9 ? 0 : i + 1}</span>
                          )}
                          {slot && toolSpec && (
                            <DurabilityBar
                              current={slot.durability ?? toolSpec.maxDurability}
                              max={toolSpec.maxDurability}
                              className="absolute bottom-1 left-1 right-1 h-[2px]"
                            />
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
                <AnvilPanel hud={hud} onUpgrade={onUpgrade} onReinforce={onReinforce} onRepairTool={onRepairTool} />
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
  onSalvageItem: (id: number, instanceId?: number) => void;
}) {
  // Resolve the currently placed item in the workbench slot
  let resolvedGear: Item | undefined;
  let resolvedItemId: number | null = null;
  let resolvedItemInstanceId: number | undefined;
  let resolvedItemDurability: number | undefined;
  let resolvedItemMaxDurability: number | undefined;
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
      const found = hud.inventory.find(
        (x) => x.id === wbTarget.id && (wbTarget.instanceId === undefined || x.instanceId === wbTarget.instanceId),
      );
      if (found && found.count > 0) {
        resolvedItemId = found.id;
        resolvedItemInstanceId = found.instanceId;
        resolvedItemDurability = found.durability;
        resolvedItemMaxDurability = found.maxDurability;
        ownedCount = found.instanceId === undefined ? found.count : 1;
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
      const instanceId = parts[2] ? Number(parts[2]) : undefined;
      if (Number.isFinite(id) && id !== HAND) setWbTarget({ kind: 'item', id, instanceId });
    } else if (parts[0] === 'hotbar') {
      const id = Number(parts[1]);
      const instanceId = parts[3] ? Number(parts[3]) : undefined;
      if (Number.isFinite(id) && id !== HAND) {
        if (isGearHotbarId(id)) {
          const g = hud.bagItems.find((b) => b.hid === id);
          if (g) setWbTarget({ kind: 'gear', uid: g.uid });
        } else {
          setWbTarget({ kind: 'item', id, instanceId });
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
      onSalvageItem(resolvedItemId, resolvedItemInstanceId);
      if (resolvedItemInstanceId !== undefined || ownedCount - consumed <= 0) {
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
                <GearIcon
                  slot={resolvedGear.slot}
                  color={gearColor(resolvedGear)}
                  size={44}
                  className="drop-shadow-[0_0_8px_rgba(255,255,255,.18)]"
                />
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
                  <>
                    <span className="flex h-12 w-12 items-center justify-center">{toolIcon(resolvedItemId, 34, resolvedItemDurability).el}</span>
                    {resolvedItemMaxDurability !== undefined && (
                      <DurabilityBar
                        current={resolvedItemDurability ?? resolvedItemMaxDurability}
                        max={resolvedItemMaxDurability}
                        className="absolute bottom-1 left-2 right-2 h-[3px]"
                      />
                    )}
                  </>
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

      <div className="recipe-list flex min-w-0 flex-col gap-1.5 overflow-y-auto pr-1">
        {recipes.map((r, i) => {
          const ready = craftable.has(r.key);
          const justCrafted = hud.lastCraft === r.key;
          const [rName, rDesc] = r.toolId
            ? [toolLabelForId(r.toolId), toolRecipeDesc(r.toolId)]
            : recipeText(r.key, r.name, r.desc);
          const needsFire = r.kind === 'cook' && !ready && r.inputs.every(([id, n]) => (hud.inventory.find((x) => x.id === id)?.count ?? 0) >= n);
          return (
            <div
              key={r.key}
              className={`recipe-card anim-rise notch group relative flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-2 transition-all duration-150 sm:flex-nowrap sm:gap-3 sm:px-2.5 sm:gap-y-0 ${
                ready ? 'hover:translate-x-1' : 'opacity-45'
              } ${justCrafted ? 'anim-pop' : ''}`}
              style={{
                // Keep the expanded recipe list responsive: stagger the entrance briefly, not for several seconds.
                animationDelay: `${Math.min(420, 80 + i * 8)}ms`,
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
                {r.toolId ? (
                  <ToolSprite id={r.toolId} size={36} />
                ) : r.out ? (
                  <img src={getBlockIcon(r.out[0])} alt="" className="pixelated h-9 w-9 drop-shadow-[0_2px_0_rgba(0,0,0,.6)]" draggable={false} />
                ) : r.kind === 'gear' && r.slot ? (
                  <GearIcon slot={r.slot} color={r.accent} size={36} />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center"
                    style={{ color: r.accent }}
                  >
                    {r.kind === 'time' ? <ClockGlyph /> : <HeartGlyph />}
                  </span>
                )}
                {r.out && r.out[1] > 1 && (
                  <span className="ml-0.5 font-display text-sm text-white/70">×{r.out[1]}</span>
                )}
              </div>

              <div className="recipe-details min-w-0 flex-[1_1_8rem] sm:flex-1">
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

              <div className="recipe-costs flex min-w-0 flex-[1_1_10rem] flex-wrap items-center gap-1 sm:flex-initial sm:flex-nowrap sm:shrink-0">
                {r.inputs.map(([id, n]) => {
                  const have = hud.inventory.find((x) => x.id === id)?.count ?? 0;
                  const ok = have >= n;
                  const inputSpec = getToolSpec(id);
                  const inputBlock = BLOCKS[id];
                  const inputName = inputSpec ? toolLabelForId(id) : blockName(id, inputBlock?.name ?? `#${id}`);
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-0.5 whitespace-nowrap"
                      title={`${inputName}: ${have}/${n}`}
                    >
                      {inputSpec ? (
                        <span className="flex h-6 w-6 items-center justify-center" style={{ filter: ok ? 'none' : 'grayscale(1) brightness(.55)' }}>
                          <ToolSprite id={id} size={22} />
                        </span>
                      ) : inputBlock ? (
                        <img
                          src={getBlockIcon(id)}
                          alt=""
                          className="pixelated h-6 w-6"
                          style={{ filter: ok ? 'none' : 'grayscale(1) brightness(.55)' }}
                          draggable={false}
                        />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center font-display text-[9px] text-white/50">?</span>
                      )}
                      <span className={`whitespace-nowrap font-display text-[10px] sm:text-xs ${ok ? 'text-moss' : 'text-blood'}`}>
                        {have}/{n}
                      </span>
                    </span>
                  );
                })}
              </div>

              <button
                disabled={!ready}
                onClick={() => onCraft(r.key)}
                className="recipe-craft btn-mc notch shrink-0 whitespace-nowrap px-2 py-2 font-display text-[10px] leading-none sm:px-3.5 sm:text-xs"
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
        <span className="text-torch">TAB</span> / <span className="text-torch">I</span> / <span className="text-torch">ESC</span> {t('closeHint')}
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
  onSellTool: (id: number, instanceId?: number) => void;
  onSellGear: (uid: string) => void;
}) {
  const sellable = hud.inventory.filter((it) => it.count > 0 && it.id < 200);
  const tools = hud.inventory.filter((it) => isToolId(it.id));
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
            {tools.map((s) => {
              const spec = getToolSpec(s.id);
              return (
                <button
                  key={`${s.id}-${s.instanceId ?? 'stack'}`}
                  onClick={() => onSellTool(s.id, s.instanceId)}
                  className="notch flex items-center gap-2 px-2 py-1 transition-transform duration-100 hover:-translate-y-0.5 hover:brightness-125"
                  style={{ background: 'linear-gradient(180deg,#243129,#121a16)', border: '2px solid #06090a' }}
                >
                  {spec ? <ToolSprite id={s.id} size={24} durability={s.durability} /> : toolIcon(s.id, 20).el}
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-display text-[11px] text-white/75">{toolLabel(s.id)}</span>
                    {spec && (
                      <DurabilityBar
                        current={s.durability ?? spec.maxDurability}
                        max={spec.maxDurability}
                        className="mt-1 h-[3px] w-full"
                        title={`${s.durability ?? spec.maxDurability}/${spec.maxDurability || '∞'}`}
                      />
                    )}
                  </span>
                  <span className="shrink-0 font-display text-[10px] text-torch">
                    +{toolSellPrice(s.id, s.durability)} {t('pts')}
                  </span>
                </button>
              );
            })}
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
                <span className="shrink-0 font-display text-[10px] text-torch">+{gearSellPrice(it)} {t('pts')}</span>
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
                  +{(hud.sellPrices[it.id] ?? 1) * it.count} {t('pts')}
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
  onRepairTool,
}: {
  hud: HudState;
  onUpgrade: (uid: string) => void;
  onReinforce: (uid: string) => void;
  onRepairTool: (instanceId: number) => void;
}) {
  const netherite = hud.inventory.find((x) => x.id === 51)?.count ?? 0;
  const iron = hud.inventory.find((x) => x.id === 6)?.count ?? 0;
  const tools = hud.inventory.filter((it) => getToolSpec(it.id) !== null);
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
      {allGear.length === 0 && tools.length === 0 && (
        <div className="sunken notch px-4 py-8 text-center text-[11px] tracking-wide text-white/35">—</div>
      )}
      {tools.map((item) => {
        const spec = getToolSpec(item.id)!;
        const current = item.durability ?? spec.maxDurability;
        const repairCost = toolRepairCost(item.id, current);
        const resourceHave = spec.repairResource === null
          ? 0
          : (hud.inventory.find((entry) => entry.id === spec.repairResource)?.count ?? 0);
        const canRepair = spec.maxDurability > 0 && current < spec.maxDurability && repairCost > 0 && resourceHave >= repairCost;
        return (
          <div
            key={`repair-${item.id}-${item.instanceId ?? 'stack'}`}
            className="notch flex items-center gap-2.5 px-2.5 py-2"
            style={{
              background: 'linear-gradient(90deg, rgba(138,106,88,.18), rgba(255,255,255,.02) 65%)',
              borderLeft: '4px solid #8a6a58',
            }}
          >
            <ToolSprite id={item.id} size={30} durability={current} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm text-white/80">{toolLabel(item.id)}</div>
              <div className="mt-1 flex items-center gap-2">
                <DurabilityBar current={current} max={spec.maxDurability} className="h-[4px] flex-1" />
                <span className="shrink-0 font-display text-[9px] text-white/45">
                  {spec.maxDurability > 0 ? `${current}/${spec.maxDurability}` : t('indestructible')}
                </span>
              </div>
              {spec.repairResource !== null && (
                <div className="mt-0.5 font-display text-[9px] text-white/35">
                  {t('repairCost')}: {repairCost || '—'} {blockName(spec.repairResource, BLOCKS[spec.repairResource]?.name ?? '')} · {resourceHave}
                </div>
              )}
            </div>
            {spec.maxDurability > 0 && item.instanceId !== undefined && (
              <button
                disabled={!canRepair}
                onClick={() => onRepairTool(item.instanceId!)}
                className="btn-mc notch shrink-0 px-2.5 py-2 font-display text-[10px] leading-none"
                style={{
                  background: canRepair ? 'linear-gradient(180deg,#f4b942,#a96e1e)' : 'linear-gradient(180deg,#26322b,#161d19)',
                  color: canRepair ? '#0a0e0c' : '#4c5b52',
                }}
                title={`${t('toolRepair')} · ${repairCost} ${spec.repairResource === null ? '' : blockName(spec.repairResource, BLOCKS[spec.repairResource]?.name ?? '')}`}
              >
                {t('toolRepair')} · {repairCost || '—'}
              </button>
            )}
          </div>
        );
      })}
      {allGear.map(({ item, equipped }) => {
        const rar = RARITY[item.rarity];
        const itemTint = gearColor(item);
        const canNeth = item.material === 'diamond' && netherite >= 1;
        const canRe = iron >= 4;
        return (
          <div
            key={item.uid}
            className="notch flex items-center gap-2.5 px-2.5 py-2"
            style={{
              background: `linear-gradient(90deg, ${itemTint}22, rgba(255,255,255,.02) 60%)`,
              borderLeft: `4px solid ${itemTint}`,
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
