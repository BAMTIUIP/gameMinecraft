import { useCallback, useRef, useState } from 'react';
import type { Engine } from '../game/engine';
import { t } from '../game/i18n';

const SENS = 0.0048;

export default function TouchControls({
  engine,
  petInteractNear,
  parrotEquipped,
  thirdPerson,
  crouching,
  crawling,
}: {
  engine: Engine | null;
  petInteractNear: boolean;
  parrotEquipped: boolean;
  thirdPerson: boolean;
  crouching: boolean;
  crawling: boolean;
}) {
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const joyId = useRef<number | null>(null);
  const lookPointers = useRef(new Map<number, { x: number; y: number }>());
  const lookPrimary = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const orbitLast = useRef<{ x: number; y: number } | null>(null);
  const [sprint, setSprint] = useState(false);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  /* ---------- joystick ---------- */
  const joyDown = useCallback(
    (e: React.PointerEvent) => {
      if (!engine || joyId.current !== null) return;
      joyId.current = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setKnob({ x: 0, y: 0, active: true });
    },
    [engine],
  );
  const joyMove = useCallback(
    (e: React.PointerEvent) => {
      if (!engine || joyId.current !== e.pointerId) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.max(40, Math.min(66, Math.min(rect.width, rect.height) / 2 - 18));
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(1, len / radius);
      dx = (dx / len) * clamped;
      dy = (dy / len) * clamped;
      setKnob({ x: dx * radius, y: dy * radius, active: true });
      engine.setMove(dx, dy);
    },
    [engine],
  );
  const joyUp = useCallback(
    (e: React.PointerEvent) => {
      if (joyId.current !== e.pointerId) return;
      joyId.current = null;
      setKnob({ x: 0, y: 0, active: false });
      engine?.setMove(0, 0);
    },
    [engine],
  );

  /* ---------- look ---------- */
  const lookDown = useCallback(
    (e: React.PointerEvent) => {
      if (!engine || lookPointers.current.has(e.pointerId)) return;
      const pointers = lookPointers.current;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        lookPrimary.current = e.pointerId;
        lookLast.current = { x: e.clientX, y: e.clientY };
        orbitLast.current = null;
      } else {
        const positions = [...pointers.values()];
        orbitLast.current = {
          x: positions.reduce((sum, point) => sum + point.x, 0) / positions.length,
          y: positions.reduce((sum, point) => sum + point.y, 0) / positions.length,
        };
      }
    },
    [engine],
  );
  const lookMove = useCallback(
    (e: React.PointerEvent) => {
      const pointers = lookPointers.current;
      if (!engine || !pointers.has(e.pointerId)) return;
      const next = { x: e.clientX, y: e.clientY };
      if (pointers.size >= 2) {
        pointers.set(e.pointerId, next);
        const positions = [...pointers.values()];
        const center = {
          x: positions.reduce((sum, point) => sum + point.x, 0) / positions.length,
          y: positions.reduce((sum, point) => sum + point.y, 0) / positions.length,
        };
        const previous = orbitLast.current ?? center;
        orbitLast.current = center;
        const orbiting = engine.orbitThirdPersonCamera((center.x - previous.x) * SENS);
        // Before third person is enabled, retain the old one-finger look behavior.
        if (!orbiting && e.pointerId === lookPrimary.current) {
          const dx = next.x - lookLast.current.x;
          const dy = next.y - lookLast.current.y;
          lookLast.current = next;
          engine.look(dx * SENS, dy * SENS);
        }
      } else {
        if (e.pointerId !== lookPrimary.current) return;
        const dx = next.x - lookLast.current.x;
        const dy = next.y - lookLast.current.y;
        lookLast.current = next;
        pointers.set(e.pointerId, next);
        engine.look(dx * SENS, dy * SENS);
      }
    },
    [engine],
  );
  const lookUp = useCallback((e: React.PointerEvent) => {
    const pointers = lookPointers.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (lookPrimary.current === e.pointerId) lookPrimary.current = null;
    const remaining = [...pointers.entries()];
    if (remaining.length === 1) {
      if (remaining[0][0] === lookPrimary.current) lookLast.current = remaining[0][1];
      orbitLast.current = null;
    } else if (remaining.length > 1) {
      const positions = remaining.map(([, point]) => point);
      orbitLast.current = {
        x: positions.reduce((sum, point) => sum + point.x, 0) / positions.length,
        y: positions.reduce((sum, point) => sum + point.y, 0) / positions.length,
      };
    } else orbitLast.current = null;
  }, []);

  /* ---------- buttons ---------- */
  const hold = (key: string, fn: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setPressed((p) => ({ ...p, [key]: true }));
      fn(true);
    },
    onPointerUp: () => {
      setPressed((p) => ({ ...p, [key]: false }));
      fn(false);
    },
    onPointerCancel: () => {
      setPressed((p) => ({ ...p, [key]: false }));
      fn(false);
    },
  });

  const btn = (active: boolean) =>
    `pointer-events-auto relative flex select-none items-center justify-center rounded-full border-[3px] font-display tracking-widest transition-transform duration-75 ${
      active ? 'scale-95 brightness-125' : ''
    }`;
  const postureBtn = (active: boolean) =>
    `pointer-events-auto flex select-none flex-col items-center justify-center gap-0.5 rounded-md border-[3px] font-display tracking-wide transition-transform duration-75 ${
      active ? 'scale-95 brightness-125' : ''
    }`;

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] touch-none">
      {/* look surface — painted first, so the stick/buttons/hotbar sit above it */}
      <div
        className="pointer-events-auto absolute inset-0"
        onPointerDown={lookDown}
        onPointerMove={lookMove}
        onPointerUp={lookUp}
        onPointerCancel={lookUp}
      />

      {/* joystick */}
      <div
        className="touch-left pointer-events-auto absolute h-[136px] w-[136px]"
        onPointerDown={joyDown}
        onPointerMove={joyMove}
        onPointerUp={joyUp}
        onPointerCancel={joyUp}
      >
        <div className="sunken absolute inset-0 rounded-full opacity-80" />
        <div className="absolute inset-[14px] rounded-full border-2 border-dashed border-white/12" />
        <div
          className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full"
          style={{
            transform: `translate(-50%,-50%) translate(${knob.x}px,${knob.y}px)`,
            background: knob.active ? 'radial-gradient(circle at 35% 30%, #f4d79a, #c08f2e)' : 'radial-gradient(circle at 35% 30%, #7e8f83, #3b4d41)',
            border: '3px solid #06090a',
            boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.25), 0 5px 14px rgba(0,0,0,.6)',
            transition: knob.active ? 'none' : 'transform 120ms ease-out',
          }}
        />
      </div>

      {/* action cluster */}
      <div className="touch-right absolute">
        <div className="touch-action-row relative flex items-end gap-2.5">
          <div className="touch-posture-controls pointer-events-auto absolute right-0 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              data-touch-control="camera"
              aria-pressed={thirdPerson}
              aria-label={t(thirdPerson ? 'touchSwitchToFirst' : 'touchSwitchToThird')}
              title={t(thirdPerson ? 'touchSwitchToFirst' : 'touchSwitchToThird')}
              onClick={() => engine?.toggleTouchPerspective()}
              className={`${postureBtn(thirdPerson)} bg-gradient-to-b from-[#5f7778] to-[#263c3b] text-white/90`}
              style={{ borderColor: thirdPerson ? '#78c6bd' : '#06090a' }}
            >
              <span className="text-xs leading-none" aria-hidden="true">{thirdPerson ? '3P' : '1P'}</span>
              <span className="text-[8px] leading-none">{t('touchViewShort')}</span>
            </button>
            <button
              type="button"
              data-touch-control="crouch"
              aria-pressed={crouching}
              aria-label={t(crouching ? 'touchStand' : 'touchCrouch')}
              title={t(crouching ? 'touchStand' : 'touchCrouch')}
              onClick={() => engine?.toggleTouchCrouch()}
              className={`${postureBtn(crouching)} ${
                crouching ? 'bg-gradient-to-b from-copper to-[#8a4f27] text-pit-950' : 'bg-gradient-to-b from-pit-500 to-pit-700 text-white/80'
              }`}
              style={{ borderColor: crouching ? '#e0a65d' : '#06090a' }}
            >
              <span className="text-sm leading-none" aria-hidden="true">{crouching ? '↑' : '↓'}</span>
              <span className="text-[8px] leading-none">{crouching ? t('touchStandShort') : t('touchCrouchShort')}</span>
            </button>
            <button
              type="button"
              data-touch-control="prone"
              aria-pressed={crawling}
              aria-label={t(crawling ? 'touchStand' : 'touchLieDown')}
              title={t(crawling ? 'touchStand' : 'touchLieDown')}
              onClick={() => engine?.toggleTouchCrawl()}
              className={`${postureBtn(crawling)} ${
                crawling ? 'bg-gradient-to-b from-copper to-[#8a4f27] text-pit-950' : 'bg-gradient-to-b from-pit-500 to-pit-700 text-white/80'
              }`}
              style={{ borderColor: crawling ? '#e0a65d' : '#06090a' }}
            >
              <span className="text-sm leading-none" aria-hidden="true">{crawling ? '↥' : '↧'}</span>
              <span className="text-[8px] leading-none">{crawling ? t('touchStandShort') : t('touchLieShort')}</span>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                engine?.dropHeldItem();
              }}
              className={`${btn(false)} h-11 w-14 text-[9px] bg-gradient-to-b from-[#6e3832] to-[#381a17] text-white/85`}
              style={{ borderColor: '#06090a' }}
            >
              {t('drop_hint')}
            </button>
            <button
              {...hold('sprint', (v) => {
                setSprint(v);
                engine?.setSprint(v);
              })}
              className={`${btn(sprint)} h-14 w-14 text-[10px] ${
                sprint ? 'bg-gradient-to-b from-copper to-[#8a4f27] text-pit-950' : 'bg-gradient-to-b from-pit-500 to-pit-700 text-white/70'
              }`}
              style={{ borderColor: '#06090a' }}
            >
              {t('run')}
            </button>
          </div>
          {parrotEquipped && (
            <button
              type="button"
              data-parrot-whistle
              aria-label={t('petParrotWhistleTouch')}
              title={t('petParrotWhistleTouch')}
              onPointerDown={(e) => {
                e.preventDefault();
                engine?.whistleParrot();
              }}
              className={`${btn(false)} h-12 w-14 text-[9px] bg-gradient-to-b from-[#367d6b] to-[#205246] text-[#d7ffef]`}
              style={{ borderColor: '#53c7a4' }}
            >
              {t('petParrotWhistleTouch')}
            </button>
          )}
          {petInteractNear && (
            <button
              type="button"
              data-pet-interact
              aria-label={t(parrotEquipped ? 'petParrotInteractTouch' : 'petInteractTouch')}
              onPointerDown={(e) => {
                e.preventDefault();
                engine?.interact();
              }}
              className={`${btn(false)} h-12 w-14 text-[9px] bg-gradient-to-b from-[#766043] to-[#49321f] text-[#fff0d5]`}
              style={{ borderColor: '#c59b66' }}
            >
              {t(parrotEquipped ? 'petParrotInteractTouch' : 'petInteractTouch')}
            </button>
          )}
          <button
            {...hold('place', (v) => engine?.setPlacing(v))}
            className={`${btn(pressed.place)} h-16 w-16 text-xs bg-gradient-to-b from-[#4b6f8a] to-[#26404f] text-white/90`}
            style={{ borderColor: '#06090a' }}
          >
            {t('place')}
          </button>
          <div className="flex flex-col gap-2.5">
            <button
              {...hold('jump', (v) => engine?.setJump(v))}
              className={`${btn(pressed.jump)} h-14 w-[74px] text-xs bg-gradient-to-b from-moss to-[#41702c] text-pit-950`}
              style={{ borderColor: '#06090a' }}
            >
              {t('jump')}
            </button>
            <button
              {...hold('mine', (v) => engine?.setMining(v))}
              className={`${btn(pressed.mine)} h-[74px] w-[74px] text-sm bg-gradient-to-b from-torch to-[#a8761f] text-pit-950 shadow-[0_0_22px_rgba(244,185,66,.35)]`}
              style={{ borderColor: '#06090a' }}
            >
              {t('mine')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
