import type { CSSProperties } from 'react';
import { TOOL_AXE, TOOL_BOW, TOOL_HOE, TOOL_PICK, TOOL_SHOVEL, TOOL_SWORD } from '../game/tools';
import { ToolSprite } from './ToolSprite';

type P = { className?: string; size?: number; style?: CSSProperties };

type ToolIconProps = P;

// HUD/stat icons deliberately reuse the same pixel silhouettes as inventory;
// this prevents a second, mismatched set of pickaxe/sword drawings.
const SharedToolIcon = ({ id, className = '', size = 24, style }: ToolIconProps & { id: number }) => (
  <ToolSprite id={id} size={size} className={className} style={style} monochrome />
);

export const PickIcon = (props: P) => <SharedToolIcon {...props} id={TOOL_PICK} />;

export const HeartIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M4 4h4v2h2V4h4v2h2V4h4v6h-2v2h-2v2h-2v2h-2v2h-2v2h-2v-2H8v-2H6v-2H4v-2H2v-2H0V4h4z" transform="translate(1 1) scale(0.92)" />
  </svg>
);

export const ClockIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M12 7v5.5l3.5 2.5" strokeLinecap="square" />
  </svg>
);

export const PauseIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <rect x="5" y="4" width="5" height="16" />
    <rect x="14" y="4" width="5" height="16" />
  </svg>
);

export const PlayIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M5 3l16 9-16 9z" />
  </svg>
);

export const SoundIcon = ({ muted, className = '', size = 20 }: P & { muted: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
    {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5c1.6 1.9 1.6 5.1 0 7M20 6c2.8 3.3 2.8 8.7 0 12" />}
  </svg>
);

export const CubeIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l9 5v10l-9 5-9-5V7z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </svg>
);

export const DepthIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M12 3v14M6 12l6 6 6-6" strokeLinecap="square" />
    <path d="M4 21h16" />
  </svg>
);

export const SwordIcon = (props: P) => <SharedToolIcon {...props} id={TOOL_SWORD} />;
export const AxeIcon = (props: P) => <SharedToolIcon {...props} id={TOOL_AXE} />;
export const HoeIcon = (props: P) => <SharedToolIcon {...props} id={TOOL_HOE} />;
export const ShovelIcon = (props: P) => <SharedToolIcon {...props} id={TOOL_SHOVEL} />;
export const BowIcon = (props: P) => <SharedToolIcon {...props} id={TOOL_BOW} />;

export const SkullIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M12 2a9 9 0 0 0-9 9c0 2.6 1.2 4.6 3 6v3h3v-2h2v2h2v-2h2v2h3v-3c1.8-1.4 3-3.4 3-6a9 9 0 0 0-9-9zM8.5 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
  </svg>
);

export const MoonIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
);

export const SunIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <circle cx="12" cy="12" r="5" />
    <path d="M11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM3.5 5l1.5-1.5 2.8 2.8L6.3 7.8zM16.2 17.7l1.5-1.5 2.8 2.8-1.5 1.5zM17.7 7.8l-1.5-1.5 2.8-2.8L20.5 5zM5 20.5L3.5 19l2.8-2.8 1.5 1.5z" />
  </svg>
);

export const MusicIcon = ({ off, className = '', size = 20 }: P & { off?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M9 18V5l11-2v13" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" fill="currentColor" stroke="none" />
    <circle cx="17" cy="16" r="3" fill="currentColor" stroke="none" />
    {off && <path d="M3 3l18 18" strokeWidth="2.6" />}
  </svg>
);

export const EyeIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
  </svg>
);

export const BagIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M4 8h16v12H4z" />
    <path d="M9 8V5h6v3" />
    <path d="M4 13h5M15 13h5" />
  </svg>
);

export const CloseIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.6">
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);

export const TrophyIcon = ({ className = '', size = 20 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M6 3h12v2h3v3c0 2.8-2.2 5-5 5h-.4A5.5 5.5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1a5.5 5.5 0 0 1-2.6-2.9H8c-2.8 0-5-2.2-5-5V5h3zM5 7v1c0 1.7 1.3 3 3 3V7zm14 0h-3v4c1.7 0 3-1.3 3-3z" />
  </svg>
);
