import type { DragEvent } from 'react';
import type { HudState } from '../game/engine';
import { BLOCKS, CHEST_STORAGE, isArrowId, isMeatItem } from '../game/blocks';
import { blockName, t } from '../game/i18n';
import { getBlockIcon } from '../game/textures';
import { CloseIcon } from './icons';

type Props = {
  hud: HudState;
  onTransfer: (id: number, amount: number, toChest: boolean) => boolean;
  onTakeAll: () => boolean;
  onClose: () => void;
};

type Stack = { id: number; count: number };
type Side = 'player' | 'chest';

function TransferStack({
  stack,
  side,
  onTransfer,
}: {
  stack: Stack;
  side: Side;
  onTransfer: Props['onTransfer'];
}) {
  const label = blockName(stack.id, BLOCKS[stack.id]?.name ?? `#${stack.id}`);
  const transferOne = () => onTransfer(stack.id, 1, side === 'player');
  const transferHalf = () => onTransfer(stack.id, Math.max(1, Math.ceil(stack.count / 2)), side === 'player');

  return (
    <button
      type="button"
      draggable
      onClick={transferOne}
      onContextMenu={(event) => {
        event.preventDefault();
        transferHalf();
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', `${side}:${stack.id}`);
        event.dataTransfer.effectAllowed = 'move';
      }}
      title={`${label} ×${stack.count} · ${t('chestTransferHint')}`}
      aria-label={`${label}, ${stack.count}`}
      className="notch group relative flex aspect-square min-w-0 items-center justify-center border-2 border-[#06090a] transition hover:-translate-y-0.5 hover:brightness-125 active:translate-y-0"
      style={{
        background: 'linear-gradient(180deg,#28372d,#131b16)',
        boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.07), inset -2px -2px 0 rgba(0,0,0,.38)',
        cursor: 'grab',
      }}
    >
      <img src={getBlockIcon(stack.id)} alt="" className="pixelated h-[68%] w-[68%] object-contain" draggable={false} />
      <span className="absolute bottom-0.5 right-1 font-display text-[10px] leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.9)]">
        ×{stack.count}
      </span>
      <span className="pointer-events-none absolute inset-x-0 top-full z-20 hidden truncate bg-black/90 px-1 py-0.5 text-center font-display text-[9px] text-torch group-hover:block">
        {label}
      </span>
    </button>
  );
}

export default function ChestInventory({ hud, onTransfer, onTakeAll, onClose }: Props) {
  const chest = hud.chest;
  // Tools have individual durability/identity records and are not stackable storage items.
  const playerItems = hud.inventory.filter((item) => (item.id < 200 || isArrowId(item.id) || isMeatItem(item.id)) && !!BLOCKS[item.id] && item.count > 0);
  const chestItems = chest?.items ?? [];

  const handleDrop = (event: DragEvent<HTMLDivElement>, destination: Side) => {
    event.preventDefault();
    event.stopPropagation();
    const [source, rawId] = event.dataTransfer.getData('text/plain').split(':');
    const id = Number(rawId);
    if ((source !== 'player' && source !== 'chest') || source === destination || !Number.isInteger(id)) return;
    const stack = (source === 'player' ? playerItems : chestItems).find((item) => item.id === id);
    if (!stack) return;
    const amount = event.shiftKey ? Math.max(1, Math.ceil(stack.count / 2)) : stack.count;
    onTransfer(id, amount, destination === 'chest');
  };

  const dropProps = (side: Side) => ({
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => handleDrop(event, side),
  });

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto overscroll-contain bg-pit-950/90 p-3 backdrop-blur-[4px] sm:p-6">
      <div className="pointer-events-none absolute inset-0 grain opacity-25" />
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col">
        <header
          className="anim-rise bevel notch sticky top-0 z-40 mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:mb-4"
          style={{ top: 'max(0px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3">
            <img src={getBlockIcon(chest?.id ?? CHEST_STORAGE)} alt="" className="pixelated h-10 w-10" draggable={false} />
            <div>
              <div className="font-display text-2xl leading-none text-white text-outline sm:text-3xl">
                {chest?.name ?? t('chestStorageTitle')}
              </div>
              <div className="mt-1 font-display text-[10px] tracking-[0.24em] text-white/40">
                {t('chestStorageTitle')} · {t('chestTransferHint')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('closeHint')}
            className="bevel-flat notch flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-blood active:scale-95"
            aria-label={t('closeHint')}
          >
            <CloseIcon size={17} />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-3">
          <section
            {...dropProps('player')}
            className="anim-rise bevel-flat notch flex min-h-[270px] flex-col p-3 sm:p-4"
            style={{ animationDelay: '50ms' }}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="font-display text-sm tracking-widest text-torch">{t('chestPlayerTitle')}</div>
              <div className="font-display text-[10px] text-white/40">{playerItems.length} {t('stacks')}</div>
            </div>
            {playerItems.length === 0 ? (
              <div className="sunken notch flex flex-1 items-center justify-center px-3 py-8 text-center font-display text-[11px] tracking-wider text-white/35">
                {t('emptyPack')}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-7">
                {playerItems.map((stack) => (
                  <TransferStack key={stack.id} stack={stack} side="player" onTransfer={onTransfer} />
                ))}
              </div>
            )}
          </section>

          <section
            {...dropProps('chest')}
            className="anim-rise bevel-flat notch flex min-h-[270px] flex-col p-3 sm:p-4"
            style={{ animationDelay: '100ms' }}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div>
                <div className="font-display text-sm tracking-widest text-torch">{t('chestStorageTitle')}</div>
                <div className="mt-0.5 font-display text-[9px] text-white/35">{chestItems.length} {t('stacks')}</div>
              </div>
              <button
                type="button"
                disabled={chestItems.length === 0}
                onClick={onTakeAll}
                className="btn-mc notch shrink-0 px-3 py-2 font-display text-[10px] tracking-wider transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{ background: 'linear-gradient(180deg,#f4d07a,#c99a2e)', color: '#17130a' }}
              >
                {t('chestTakeAll')}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-7">
              {Array.from({ length: 27 }, (_, index) => {
                const stack = chestItems[index];
                return stack ? (
                  <TransferStack key={stack.id} stack={stack} side="chest" onTransfer={onTransfer} />
                ) : (
                  <div
                    key={`empty-${index}`}
                    aria-label={t('chestEmptySlots')}
                    className="sunken notch flex aspect-square items-center justify-center border border-white/[0.04] text-[9px] text-white/10"
                  >
                    ·
                  </div>
                );
              })}
            </div>
            <div className="mt-auto pt-3 text-center font-display text-[9px] tracking-wider text-white/30">
              {t('chestDropHere')}
            </div>
          </section>
        </div>

        <div className="mt-3 text-center font-display text-[9px] tracking-wider text-white/30">
          {t('chestTransferHint')}
        </div>
      </div>
    </div>
  );
}
