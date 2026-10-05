import type { ItemDetails } from '../game/itemDetails';
import { t } from '../game/i18n';

type Props = {
  details: ItemDetails;
  pinned: boolean;
  onClose: () => void;
};

export default function ItemInfoPopup({ details, pinned, onClose }: Props) {
  return (
    <section
      role={pinned ? 'dialog' : 'tooltip'}
      aria-label={details.name}
      aria-live="polite"
      className={`item-info-popup fixed bottom-3 left-1/2 z-[90] w-[min(22rem,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden border bg-[#0c1410]/[.97] shadow-[0_12px_38px_rgba(0,0,0,.72)] backdrop-blur-md ${pinned ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ borderColor: `${details.color}99`, boxShadow: `0 12px 38px rgba(0,0,0,.72), 0 0 18px ${details.color}18` }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-2.5 border-b border-white/10 px-3 py-2.5">
        <span className="mt-0.5 h-8 w-1 shrink-0" style={{ backgroundColor: details.color, boxShadow: `0 0 10px ${details.color}88` }} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm tracking-wider text-white" style={{ color: details.color }}>
            {details.name}
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-white/65">{details.description}</p>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('itemInfoClose')}
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center font-display text-lg text-white/45 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
      {details.stats.length > 0 && (
        <dl className="grid max-h-[32vh] grid-cols-1 gap-y-0.5 overflow-y-auto px-3 py-2">
          {details.stats.map((stat, index) => (
            <div key={`${stat.label}-${index}`} className="flex min-w-0 items-start justify-between gap-3 text-[10px] leading-snug">
              <dt className="shrink-0 font-display tracking-wide text-white/40">{stat.label}</dt>
              <dd className="min-w-0 text-right text-white/85" style={stat.color ? { color: stat.color } : undefined}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
