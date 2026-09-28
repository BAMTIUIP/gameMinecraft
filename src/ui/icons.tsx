import type { CSSProperties } from 'react';

type P = { className?: string; size?: number; style?: CSSProperties };

export const PickIcon = ({ className = '', size = 24, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} fill="none">
    <path d="M3 8.5c3.6-3.4 8-4.6 12-3.4l-1.9 1.9 2.6 2.6 1.9-1.9c1.2 4 0 8.4-3.4 12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.4 12.6 4.2 19.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M3 21l1.6-1.6" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
  </svg>
);

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

export const SwordIcon = ({ className = '', size = 24, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 3l-9.5 9.5M20 3v4.5L15.5 12" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 13.5L3 17l4 4 3.5-3.5" strokeLinejoin="round" />
    <path d="M10.5 12.5l1 1" />
    <path d="M4.5 18.5L2 21" strokeLinecap="round" strokeWidth="2.6" />
  </svg>
);

export const AxeIcon = ({ className = '', size = 24, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 4c3 0 6 2 6 5-2-1-4-1-5.5.5L13 11 11 9l1.5-2.5C13.5 5 13 4 14 4z" fill="currentColor" strokeLinejoin="round" />
    <path d="M12 10L4 20" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const ShovelIcon = ({ className = '', size = 24, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15.5 8.5L6 18" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M15 3l6 6-2.5 2.5c-1.5 1.5-4 1.5-5.5 0s-1.5-4 0-5.5z" fill="currentColor" strokeLinejoin="round" />
    <path d="M4 20l2-2" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const BowIcon = ({ className = '', size = 24, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 3c8 1 15 8 16 16-3 1-6 .5-8-1L7 12C5.5 10 5 6 5 3z" strokeLinejoin="round" />
    <path d="M5 3l16 16" strokeWidth="1.4" />
    <path d="M3 15l6 6" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

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
