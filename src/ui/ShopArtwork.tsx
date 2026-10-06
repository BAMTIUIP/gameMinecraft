import type { CSSProperties } from 'react';

type ShopArtworkProps = { productId: string; accent: string };

/** Warm jungle companion: big rounded ears, expressive square eyes, curled tail, and mossy perch. */
function MonkeyArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="monkey-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#173522" /><stop offset=".58" stopColor="#0b1b18" /><stop offset="1" stopColor="#111b18" /></linearGradient>
        <radialGradient id="monkey-light" cx="68%" cy="36%" r="62%"><stop stopColor="#f3a64c" stopOpacity=".42" /><stop offset=".55" stopColor="#1f9a57" stopOpacity=".14" /><stop offset="1" stopColor="#06130d" stopOpacity="0" /></radialGradient>
        <linearGradient id="monkey-fur" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e89a48" /><stop offset=".55" stopColor="#a95727" /><stop offset="1" stopColor="#65351f" /></linearGradient>
        <linearGradient id="monkey-face" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffe0a0" /><stop offset="1" stopColor="#dc9c58" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#monkey-bg)" /><rect width="160" height="86" fill="url(#monkey-light)" />
      <path d="M0 0h24v8h7v12h-7v8h-7v9H0zM36 0h10v8h7v12h-8v7H34v-8h-7V8h9z" fill="#17613a" opacity=".78" />
      <path d="M10 0h8v7h6v7h-7v7h-7zM49 4h6v9h-6zM136 0h10v8h7v15h-7v9h-9v-8h-7V10h6zM149 40h11v20h-8v9h-9V53h6z" fill="#2b8d4b" opacity=".6" />
      <path d="M17 9h4v14h-4zM43 12h4v10h-4zM145 14h4v14h-4z" fill="#90d96c" opacity=".35" />
      <path d="M17 20h7v25h-7zM24 27h6v20h-6zM30 34h6v14h-6z" fill="#72b6d1" opacity=".42" />
      <path d="M0 70h160v16H0z" fill="#1b4528" />
      <path d="M0 67h31v5h15v-4h16v5h18v-4h15v5h17v-4h15v5h33v16H0z" fill="#39753a" />
      <path d="M12 71h9v4h-9zM49 68h8v4h-8zM105 70h10v4h-10zM139 69h9v5h-9z" fill="#91cf47" />
      {/* Curling tail is drawn behind the body as a stepped, shaded voxel tube. */}
      <path d="M84 58H71v-5H61v-7h-5v-9h-6v-5h-8v5h-4v9h5v5h8v-5h-4v-4h5v5h5v8h-5v5H46v-4h-6v-8h-4v-9h5v-7h9v-4h9v5h7v6h5v10h-4v6h8v5h9z" fill="none" stroke="#542b1b" strokeWidth="7" strokeLinejoin="miter" />
      <path d="M84 56H71v-5H61v-7h-5v-9h-6" fill="none" stroke="#dc8840" strokeWidth="2.2" strokeLinejoin="miter" />
      {/* Crouched body and tucked legs. */}
      <path d="M78 46h25v6h10v12h-9v8H70v-6h-8v-9h10v-6h6z" fill="url(#monkey-fur)" stroke="#42251a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M83 56h18v9H83z" fill="#d18a43" /><path d="M74 64h12v6H74zM102 63h8v6h-8z" fill="#63331e" />
      {/* Oversized ears, head and warm face mask. */}
      <path d="M72 24h-8v-6h4v-6h10v5h5v10h-6zM111 22h7v-6h-4v-5h-9v5h-5v10h6z" fill="#a9502b" stroke="#44251b" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M68 19h7v12h-8v-5h-4v-5h5zM111 18h6v5h-4v7h-7v-7h5z" fill="#e99962" />
      <path d="M75 13h25v4h8v7h6v13h-5v7h-8v5H77v-5h-8v-7h-5V25h6v-7h5z" fill="url(#monkey-fur)" stroke="#47271a" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M77 27h24v4h6v9h-5v6H79v-4h-7v-9h5z" fill="url(#monkey-face)" />
      <path d="M81 20h5v3h-5zM90 17h7v3h-7z" fill="#f4bd69" />
      <path d="M80 30h6v7h-6zM96 30h6v7h-6z" fill="#fff5d8" /><path d="M82 31h4v6h-4zM98 31h4v6h-4z" fill="#1b1717" /><path d="M83 31h2v2h-2zM99 31h2v2h-2z" fill="#fff" />
      <path d="M89 39h5v3h-5z" fill="#75422a" /><path d="M87 43h10" fill="none" stroke="#75422a" strokeWidth="1.6" strokeLinecap="square" />
      {/* One arm braces on the rock; small fingers catch the edge. */}
      <path d="M76 48h8v7h-5v8h-7v-5h3v-7h-4z" fill="#c4783c" stroke="#63351f" strokeWidth="1.2" />
      <path d="M66 64h10v4h-4v3h-3v-3h-4zM99 68h9v3h-4v2h-3v-2h-4z" fill="#f0bd78" />
    </svg>
  );
}

/** Moonlit battle wolf with silver fur, amber eyes, cyan rune shield, and frosty rim-light. */
function WolfArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="wolf-bg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#263957" /><stop offset="1" stopColor="#101827" /></linearGradient>
        <radialGradient id="wolf-aura" cx="55%" cy="44%" r="58%"><stop stopColor="#3bbce7" stopOpacity=".35" /><stop offset="1" stopColor="#08111d" stopOpacity="0" /></radialGradient>
        <linearGradient id="wolf-fur" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#f0f4f6" /><stop offset=".5" stopColor="#aeb8c5" /><stop offset="1" stopColor="#657387" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#wolf-bg)" /><rect width="160" height="86" fill="url(#wolf-aura)" />
      <path d="M0 0h18v10h8v13h-8v10h-8v17H0zM145 0h15v50h-9V37h-8v-9h7V16h-5z" fill="#111c2d" />
      <path d="M20 0h6v30h-6zM136 0h6v25h-6zM0 60h160v26H0z" fill="#18263a" />
      <path d="M0 72h24v-5h18v5h19v-4h17v5h24v-5h18v5h18v-4h22v17H0z" fill="#26354b" />
      <path d="M17 75h7v3h-7zM54 71h9v4h-9zM121 73h8v4h-8zM145 69h8v5h-8z" fill="#78b8d6" opacity=".6" />
      {/* Tail and long wolf silhouette, facing left. */}
      <path d="M111 38h13v-5h8v4h7v6h-8v4h-8v7h-10z" fill="#aeb9c6" stroke="#303d50" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M65 36h49v5h9v15h-7v8h-9v8h-8v-8h-5v8h-9v-8h-8v7h-9v-8h-7V54h-7V43h8z" fill="url(#wolf-fur)" stroke="#344254" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M79 41h30v5H79zM72 51h35v6H72z" fill="#d5dce3" opacity=".55" />
      {/* Upturned ears, brow, cheek and tapered muzzle. */}
      <path d="M39 32 37 14l12 9 5-3 3 12zM56 30l8-19 8 15 8 6z" fill="#9ca9b7" stroke="#2b394b" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m41 28-1-8 8 7zM61 28l4-10 4 9z" fill="#48566a" />
      <path d="M43 29h24l7 6h8v10h-7v8h-9v4H51v-5h-8v-7h-7V36h7z" fill="url(#wolf-fur)" stroke="#344254" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M40 40h18v7h15v6H54v-4h-9z" fill="#e0e4e8" />
      <path d="M47 35h8v3h-8zM61 35h7v3h-7z" fill="#4b5360" />
      <path d="M48 38h6v6h-6zM64 38h6v6h-6z" fill="#d89231" /><path d="M50 39h3v5h-3zM66 39h3v5h-3z" fill="#171d25" />
      <path d="M35 40h8v6h-8z" fill="#1a2028" stroke="#111722" strokeWidth="1" />
      <path d="M42 49h20" fill="none" stroke="#555e69" strokeWidth="1.3" />
      {/* Dark collar and rune shoulder guard. */}
      <path d="M69 43h10v13H69z" fill="#263346" stroke="#111a27" strokeWidth="1.3" />
      <path d="m79 37 13-5 12 8-4 19-14 6-9-10z" fill="#263449" stroke="#101824" strokeWidth="2" strokeLinejoin="round" />
      <path d="m88 43 7 5-7 7-5-7z" fill="#50f5f2" /><path d="m88 45 3 3-3 3-2-3z" fill="#e4ffff" />
      <path d="M83 37h8" stroke="#9feeff" strokeWidth="1.5" opacity=".9" />
      <path d="M25 56h3v3h-3zM132 29h3v3h-3zM145 57h2v2h-2z" fill="#68d9ff" />
    </svg>
  );
}

/** Sunset alley cat with alert ears, ringed tail, bright eyes and a warm terracotta glow. */
function CatArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="cat-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#4f2d24" /><stop offset=".55" stopColor="#201418" /><stop offset="1" stopColor="#0d1017" /></linearGradient>
        <radialGradient id="cat-glow" cx="58%" cy="42%" r="60%"><stop stopColor="#ffad63" stopOpacity=".35" /><stop offset="1" stopColor="#1a0e14" stopOpacity="0" /></radialGradient>
        <linearGradient id="cat-fur" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2c08d" /><stop offset=".52" stopColor="#d48853" /><stop offset="1" stopColor="#714431" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#cat-bg)" /><rect width="160" height="86" fill="url(#cat-glow)" />
      <path d="M0 0h17v12h9v12h-8v11H8v12H0zM142 0h18v46h-9V31h-8v-9h7V11h-8z" fill="#22131a" />
      <path d="M0 66h160v20H0z" fill="#2a2328" /><path d="M0 72h160v4H0z" fill="#6a4f39" opacity=".72" />
      <path d="M18 74h11v3H18zM57 70h8v3h-8zM130 72h9v4h-9z" fill="#ffbf73" opacity=".55" />
      {/* Upright curved tail. */}
      <path d="M115 57h8V42h-5V28h5V17h7v10h4v18h-4v16h-9v7h-6z" fill="#6a3d2d" stroke="#2f1a17" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M123 20h7v4h-7zM123 32h7v4h-7zM123 44h7v4h-7z" fill="#f3d1aa" opacity=".8" />
      {/* Compact body with tucked paws. */}
      <path d="M68 39h42v6h9v17h-8v7H70v-5h-8V50h6z" fill="url(#cat-fur)" stroke="#4a291f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M76 47h27v6H76zM72 56h32v7H72z" fill="#f6d2ab" opacity=".5" />
      <path d="M76 65h9v6h-9zM97 64h8v7h-8z" fill="#4f2c20" />
      {/* Big ears, square muzzle and bright eyes. */}
      <path d="M48 35 46 16l13 10 7-8 7 13zM76 30l6-16 10 9 10-5 2 14z" fill="#c1754a" stroke="#48271d" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 32 49 24l8 6zM83 27l2-7 6 5z" fill="#82462e" />
      <path d="M49 31h28l8 6h7v11h-7v7h-10v4H57v-5h-8v-7h-6V38h6z" fill="url(#cat-fur)" stroke="#4a291f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 42h20v7h13v6H64v-4h-14z" fill="#f8ddc2" />
      <path d="M55 36h7v3h-7zM68 35h7v3h-7z" fill="#8c5539" />
      <path d="M56 39h6v7h-6zM70 39h6v7h-6z" fill="#8de06d" /><path d="M58 40h3v6h-3zM72 40h3v6h-3z" fill="#171717" />
      <path d="M48 42h7v5h-7z" fill="#2a2020" /><path d="M63 48h6l-3 4z" fill="#cc6b77" />
      <path d="M60 52h13" fill="none" stroke="#6a493d" strokeWidth="1.2" />
      <path d="M56 49h-8M76 49h8" fill="none" stroke="#f7e9db" strokeWidth="1.1" strokeLinecap="square" />
    </svg>
  );
}

/** Violet forest owl with ear tufts, layered folded wings, and bright golden eyes. */
function OwlArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="owl-bg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#534b78" /><stop offset=".6" stopColor="#28223f" /><stop offset="1" stopColor="#121527" /></linearGradient>
        <radialGradient id="owl-halo" cx="50%" cy="45%" r="55%"><stop stopColor="#b47cff" stopOpacity=".37" /><stop offset="1" stopColor="#28213e" stopOpacity="0" /></radialGradient>
        <linearGradient id="owl-feathers" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d3c6f4" /><stop offset=".52" stopColor="#9088b8" /><stop offset="1" stopColor="#514e78" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#owl-bg)" /><rect width="160" height="86" fill="url(#owl-halo)" />
      <path d="M0 0h15v24H9v15h8v12H9v20H0zM145 0h15v70h-11V51h6V37h-8z" fill="#292445" />
      <path d="M16 0h5v37h-5zM140 0h5v33h-5zM0 68h160v18H0z" fill="#293322" />
      <path d="M0 72h20v-4h15v5h22v-4h18v5h22v-4h18v5h18v-4h27v15H0z" fill="#42613a" />
      <g fill="#e7cbff"><rect x="30" y="18" width="2" height="2"/><rect x="126" y="16" width="2" height="2"/><rect x="23" y="49" width="2" height="2"/><rect x="137" y="46" width="2" height="2"/></g>
      {/* Floating pixel feathers. */}
      <path d="M32 48h4v-7h3v9h-3v7h-4z" fill="#b483ff" stroke="#e2cbff" strokeWidth=".7" />
      <path d="M125 43h4v-6h3v9h-3v6h-4z" fill="#8e76ff" stroke="#d8c3ff" strokeWidth=".7" />
      {/* Broad folded wings, back silhouette and layered feathers. */}
      <path d="M63 31H51v7h-7v8h-7v13h9v7h17l7-9V39zM97 31h12v7h7v8h7v13h-9v7h-17l-7-9V39z" fill="#645b87" stroke="#28223b" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M52 42h15v6H52zM47 51h20v5H47zM100 42h15v6h-15zM93 51h20v5H93z" fill="#a59ac9" />
      <path d="M55 57h14v5H55zM101 57h14v5h-14z" fill="#796d9f" />
      {/* Tufted head and compact body. */}
      <path d="M63 25 56 15l13 5 11-5 1 7h9l3-7 12 5-5 9 5 10v18H61V42l6-10z" fill="url(#owl-feathers)" stroke="#312a46" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M70 21h21v5H70zM63 31h34v6H63z" fill="#d8d0ee" opacity=".7" />
      {/* Eye discs and luminous amber eyes. */}
      <path d="M63 32h15v15H63zM83 32h15v15H83z" fill="#453451" stroke="#e7c8ff" strokeWidth="1" />
      <path d="M66 35h10v9H66zM86 35h10v9H86z" fill="#ffcf42" /><path d="M69 36h5v8h-5zM89 36h5v8h-5z" fill="#171521" />
      <path d="M69 36h2v2h-2zM89 36h2v2h-2z" fill="#fff7c1" />
      <path d="M78 42h5l-3 5z" fill="#ffc94b" stroke="#98682c" strokeWidth=".8" />
      {/* Pale chest plumage with short pixel rows. */}
      <path d="M72 49h18v4h5v11H67V53h5z" fill="#d6d0e8" />
      <path d="M73 53h6v3h-6zM82 53h8v3h-8zM70 59h8v3h-8zM82 59h10v3H82z" fill="#aaa4c7" />
      <path d="M74 65h5v6h-5zM86 65h5v6h-5z" fill="#bd9b70" /><path d="M68 71h18v3H68z" fill="#262234" />
    </svg>
  );
}

/** Calm, chunky capybara with a tiny flower, warm fur, water, and mossy islets. */
function CapybaraArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="capy-bg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#174735" /><stop offset=".55" stopColor="#183e32" /><stop offset="1" stopColor="#10242a" /></linearGradient>
        <radialGradient id="capy-sun" cx="70%" cy="35%" r="60%"><stop stopColor="#ffc76b" stopOpacity=".42" /><stop offset="1" stopColor="#2a6e4a" stopOpacity="0" /></radialGradient>
        <linearGradient id="capy-fur" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d99a55" /><stop offset=".6" stopColor="#a86a38" /><stop offset="1" stopColor="#744326" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#capy-bg)" /><rect width="160" height="86" fill="url(#capy-sun)" />
      <path d="M0 9h15v11h8v15h-8v12H8v12H0zM136 0h9v11h7v12h8v15h-9v12h-8V34h-7z" fill="#27784a" />
      <path d="M0 57h160v29H0z" fill="#166c80" /><path d="M0 63h160v5H0z" fill="#2cb4c1" opacity=".62" />
      <path d="M9 73h34v13H9zM121 70h31v16h-31z" fill="#315c38" /><path d="M12 71h29v4H12zM123 68h28v4h-28z" fill="#8acb4e" />
      <path d="M14 66h7v4h-7zM137 64h5v4h-5zM48 77h12v2H48zM92 71h16v2H92z" fill="#b0f4e8" opacity=".58" />
      {/* Short tail and sturdy oval body. */}
      <path d="M112 53h8v5h7v5h-8v-3h-7z" fill="#87512e" />
      <path d="M66 43h40v5h11v9h7v11h-8v7H67v-5h-9V58h5v-9h3z" fill="url(#capy-fur)" stroke="#4a2b20" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M77 54h28v16H77z" fill="#e2b97d" opacity=".82" />
      <path d="M80 57h21v4H80zM75 64h28v4H75z" fill="#f0d29c" opacity=".65" />
      {/* Head, tiny ears and blunt square muzzle. */}
      <path d="M56 28h8v-5h7v4h7v7h5v14h-5v6h-9v4H57v-5h-7V43h-5v-9h7v-5z" fill="url(#capy-fur)" stroke="#4a2b20" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M57 28v-6h7v6zM72 28v-5h7v6z" fill="#734126" /><path d="M58 29h4v3h-4zM74 28h3v3h-3z" fill="#e6ad71" />
      <path d="M49 38h24v7h-6v7H53v-5h-5z" fill="#e5b878" />
      <path d="M47 39h14v9H47z" fill="#563321" /><path d="M50 40h8v2h-8z" fill="#211a17" />
      <path d="M62 34h4v4h-4z" fill="#211a17" /><path d="M63 34h2v2h-2z" fill="#fff1c9" />
      {/* Pink flower tucked by one ear. */}
      <path d="M80 29h4v-4h4v4h4v4h-4v4h-4v-4h-4z" fill="#ff8fab" stroke="#873d61" strokeWidth=".8" />
      <path d="M85 29h4v4h-4z" fill="#ffd84f" />
      {/* Feet in the shallow water. */}
      <path d="M71 69h8v6h-4v3h-7v-3h3zM100 70h8v5h-3v3h-7v-3h2z" fill="#754426" />
      <path d="M69 75h5v2h-5zM98 75h5v2h-5z" fill="#d99a55" />
    </svg>
  );
}

/** Open high-tier treasure cache with an angled pickaxe, diamond crystals, metal straps, and lock. */
function DiamondChestArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="diamond-chest-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#162b34" /><stop offset="1" stopColor="#080f18" /></linearGradient>
        <linearGradient id="diamond-chest-wood" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6f6250" /><stop offset=".5" stopColor="#34464a" /><stop offset="1" stopColor="#18282d" /></linearGradient>
        <linearGradient id="diamond-chest-crystal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f1ffff" /><stop offset=".34" stopColor="#76fff3" /><stop offset="1" stopColor="#078cae" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#diamond-chest-bg)" />
      <path d="M0 0h19v12h8v14h-8v10H8v13H0zM141 0h19v48h-8V32h-9v-9h7V12h-9z" fill="#1c3138" />
      <path d="M0 68h160v18H0z" fill="#18252b" /><path d="M0 72h160v3H0z" fill="#42534d" opacity=".6" />
      <g opacity=".65" stroke="#263640" strokeWidth="1">
        <path d="M18 67 26 53h7l7 14z" fill="#70eaf3" /><path d="M27 54h5v9h-5z" fill="#d6ffff" />
        <path d="M125 67 133 50h8l7 17z" fill="#4bd5e6" /><path d="M135 51h5v10h-5z" fill="#dcffff" />
      </g>
      {/* Pickaxe resting against the chest. */}
      <path d="m41 30 20 35" stroke="#77502f" strokeWidth="5" strokeLinejoin="miter" />
      <path d="M29 28h17v4h16v5H47v5h-6v-6h-8v6h-5z" fill="#a9bdc7" stroke="#34414c" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M32 30h12v2H32zM48 34h10v2H48z" fill="#f0ffff" />
      {/* Open angular lid and three faceted diamonds. */}
      <path d="m51 39 35-13 35 10-36 14z" fill="#1c3939" stroke="#111e24" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m56 38 30-10 28 8-30 11z" fill="#607568" />
      <path d="M60 44h51v9H60z" fill="#72533b" />
      <path d="M67 43 74 29h11l7 14-13 12z" fill="url(#diamond-chest-crystal)" stroke="#174f62" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M80 43 85 24h12l9 19-13 11z" fill="#35dcea" stroke="#164b5a" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M97 44 104 31h10l7 13-12 10z" fill="#87fff7" stroke="#1d5860" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M75 31h8l-5 12h-6zM88 26h7l-5 16h-7zM106 33h6l-5 10h-6z" fill="#efffff" opacity=".72" />
      {/* Riveted chest front, straps and gold lock. */}
      <path d="M52 45h69v28H52z" fill="url(#diamond-chest-wood)" stroke="#131e22" strokeWidth="1.8" />
      <path d="M58 47h9v23h-9zM105 47h8v23h-8z" fill="#9c7042" />
      <path d="M72 49h22v6H72z" fill="#213d3e" /><path d="M77 53h12v13H77z" fill="#c18a3d" stroke="#4b3825" strokeWidth="1" />
      <path d="M81 56h4v7h-4z" fill="#17282e" /><path d="M58 48h6v3h-6zM108 48h5v3h-5zM58 65h6v3h-6zM108 65h5v3h-5z" fill="#dca94d" />
      <path d="M54 72h66v4H54z" fill="#10191c" />
    </svg>
  );
}

/** Deep miner skin with square lamp helmet, dark coat, leather straps, and turquoise crystal. */
function MinerSkinArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="miner-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#80562e" /><stop offset=".5" stopColor="#39291f" /><stop offset="1" stopColor="#211d1b" /></linearGradient>
        <radialGradient id="miner-lamp-glow" cx="50%" cy="34%" r="56%"><stop stopColor="#ffd15d" stopOpacity=".52" /><stop offset="1" stopColor="#c76f26" stopOpacity="0" /></radialGradient>
        <linearGradient id="miner-coat" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#333846" /><stop offset="1" stopColor="#141820" /></linearGradient>
        <linearGradient id="miner-crystal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eeffff" /><stop offset=".45" stopColor="#56fff0" /><stop offset="1" stopColor="#087b9b" /></linearGradient>
      </defs>
      <rect width="160" height="86" fill="url(#miner-bg)" /><rect width="160" height="86" fill="url(#miner-lamp-glow)" />
      <path d="M0 0h19v9h8v13h-8v9h-8v16H0zM139 0h21v49h-9V34h-8V22h6V10h-10z" fill="#5d4028" />
      <path d="M0 67h160v19H0z" fill="#4d3728" /><path d="M0 72h160v4H0z" fill="#9c6832" opacity=".7" />
      <path d="M17 11 30 6v7l-13 5zM129 61l13-5v6l-13 5z" fill="#21d5d0" opacity=".55" />
      {/* Silhouette, square face, and padded miner's helmet. */}
      <path d="M71 34h20v8h9v8h7v29H53V50h8v-8h10z" fill="url(#miner-coat)" stroke="#14171d" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M68 23h25v5h6v10h-7v7H68v-5h-6V29h6z" fill="#d5a879" stroke="#59402e" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M64 24h31v5h8v5H58v-5h6z" fill="#282c35" stroke="#10141b" strokeWidth="1.5" />
      <path d="M73 16h21v6h7v7H64v-6h9z" fill="#353b46" stroke="#151922" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M77 18h9v-5h8v5h6v5H77z" fill="#202631" />
      <path d="M84 15h9v7h-9z" fill="#ffe16a" stroke="#86612b" strokeWidth="1.2" /><path d="M86 16h4v3h-4z" fill="#fff8bd" />
      <path d="M70 33h5v4h-5zM86 33h5v4h-5z" fill="#66d6cf" /><path d="M72 34h2v2h-2zM88 34h2v2h-2z" fill="#111820" />
      <path d="M78 40h9v3h-9z" fill="#75462c" />
      {/* Utility straps and glowing teal pendant. */}
      <path d="m66 43 6 1 19 24-6 4-20-25z" fill="#995e32" stroke="#3f2e24" strokeWidth="1.1" />
      <path d="M91 45h5v22h-5z" fill="#b47b3d" /><path d="M63 52h34v5H63z" fill="#8e552d" />
      <path d="M63 51h8v7h-8zM91 51h8v7h-8z" fill="#d19a4d" />
      <path d="M77 55h11v13H77z" fill="#1b3440" stroke="#b77e3a" strokeWidth="1.2" />
      <path d="m82 56 5 5-5 7-5-7z" fill="url(#miner-crystal)" stroke="#0d5868" strokeWidth=".8" />
      <path d="M58 59h10v6H58zM93 59h10v6H93z" fill="#202630" />
      <path d="M64 75h30v5H64z" fill="#10141a" /><path d="M65 72h29v3H65z" fill="#6e472b" />
    </svg>
  );
}

/**
 * Hand-built voxel parrot inspired by the supplied reference: scarlet head and breast, a gold hooked
 * beak, layered green/turquoise/blue wing feathers, and a chunky wooden perch. Kept as inline SVG so
 * the shop gets the character's silhouette and color without downloading the large source render.
 */
function ParrotArtwork() {
  return (
    <svg className="h-[72px] w-full" viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="parrot-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#102b1b" />
          <stop offset=".55" stopColor="#07150f" />
          <stop offset="1" stopColor="#101a13" />
        </linearGradient>
        <radialGradient id="parrot-glow" cx="65%" cy="42%" r="62%">
          <stop offset="0" stopColor="#db6a13" stopOpacity=".42" />
          <stop offset=".48" stopColor="#1e9f4a" stopOpacity=".18" />
          <stop offset="1" stopColor="#07130d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="parrot-red" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#ff5731" />
          <stop offset=".45" stopColor="#ef2d1d" />
          <stop offset="1" stopColor="#a71918" />
        </linearGradient>
        <linearGradient id="parrot-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#77ee49" />
          <stop offset=".5" stopColor="#23c64e" />
          <stop offset="1" stopColor="#08763c" />
        </linearGradient>
        <linearGradient id="parrot-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#49e7dc" />
          <stop offset=".48" stopColor="#168fd5" />
          <stop offset="1" stopColor="#174aab" />
        </linearGradient>
        <linearGradient id="parrot-gold" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#fff064" />
          <stop offset=".48" stopColor="#ffbe24" />
          <stop offset="1" stopColor="#dd6b13" />
        </linearGradient>
        <linearGradient id="parrot-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#563018" />
          <stop offset=".45" stopColor="#a86b2a" />
          <stop offset="1" stopColor="#573016" />
        </linearGradient>
      </defs>

      {/* Deep jungle vignette and soft amber light, kept quiet behind the saturated bird. */}
      <rect width="160" height="86" fill="url(#parrot-bg)" />
      <rect width="160" height="86" fill="url(#parrot-glow)" />
      <g opacity=".72">
        <path d="M0 0h22v8h8v10h-7v8h-8v9H0zM34 0h14v8h8v12h-7v8H37v-8h-8V9h5z" fill="#075322" />
        <path d="M0 43h11v-8h9v8h8v10h-7v8h-9v9H0zM12 68h8v-7h11v8h8v17H8V76h4z" fill="#0a612b" />
        <path d="M125 0h13v9h8v9h8v10h6v15h-12v-7h-8v-8h-8v-9h-7zM144 52h8v-7h8v41h-24V71h8z" fill="#075123" />
        <path d="M24 7h7v7h8v8h-8v7h-9v-8h-6v-7h8zM136 5h8v8h7v8h-8v7h-9v-9h-6v-8h8z" fill="#18813a" opacity=".72" />
        <path d="M0 27h8v7h9v8h-9v8H0zM153 30h7v14h-8v-7h-7v-7z" fill="#0c7234" opacity=".8" />
      </g>
      <g fill="#77cf54" opacity=".22">
        <rect x="8" y="12" width="4" height="4" /><rect x="28" y="30" width="3" height="3" />
        <rect x="145" y="15" width="4" height="4" /><rect x="133" y="48" width="3" height="3" />
        <rect x="18" y="57" width="3" height="3" /><rect x="151" y="62" width="3" height="3" />
      </g>
      <ellipse cx="99" cy="71" rx="34" ry="6" fill="#000" opacity=".38" />

      {/* Blocky cut branch and short trunk. */}
      <path d="M91 66h20v20H91z" fill="url(#parrot-wood)" />
      <path d="M96 67h5v19h-5zM106 69h3v17h-3z" fill="#d4933c" opacity=".55" />
      <path d="m69 61 32-8 24 8-36 10z" fill="#d99537" stroke="#3d2619" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m89 71 36-10v8L89 81z" fill="#70401f" stroke="#3d2619" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="m69 61 20 10v10L69 70z" fill="#995d29" stroke="#3d2619" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="m76 62 24-6 12 4-25 7z" fill="#f2ba52" opacity=".7" />
      <path d="M98 73h5v3h-5zM111 68h5v2h-5z" fill="#432617" opacity=".65" />

      {/* Long red tail behind the body. */}
      <g stroke="#17251e" strokeWidth="1.25" strokeLinejoin="round">
        <path d="m82 47 8 7-18 20-8 11-6-4 7-14z" fill="#a91d22" />
        <path d="m86 48 7 5-12 18-9 10-6-3 7-13z" fill="#e52e29" />
        <path d="m77 50 7 4-14 18-9 10-5-4 7-13z" fill="#c32128" />
        <path d="m72 65-7 9-6 8 5 2 10-11z" fill="#ff5340" stroke="none" />
      </g>

      {/* Green shoulder and stepped wing feathers. */}
      <g stroke="#173222" strokeWidth="1.35" strokeLinejoin="round">
        <path d="M91 33 81 31 70 35 63 43 59 54 64 62 74 66 88 60 98 47z" fill="url(#parrot-green)" />
        <path d="m79 33 9 1 5 5-10 5-11-2-3-4z" fill="#61e94b" />
        <path d="m68 42 11-3 8 4-5 6-13 2-5-4z" fill="#25d66a" />
        <path d="m64 50 14-3 8 5-5 6-13 3-5-4z" fill="#19ba61" />
        <path d="m68 59 13-4 7 4-8 6-10 1-5-3z" fill="#0c8c4c" />
        <path d="m78 36 5 1-4 4-5 1zM67 46l7-2 4 2-7 3zM65 54l7-2 5 2-8 3z" fill="#b3ff65" stroke="none" opacity=".8" />
      </g>

      {/* Layered turquoise-to-blue flight feathers, each feather has a bright voxel edge. */}
      <g stroke="#142a3e" strokeWidth="1.2" strokeLinejoin="round">
        <path d="m77 51 9 2-13 14-13 14-7-3 8-15z" fill="url(#parrot-blue)" />
        <path d="m83 51 8 3-11 14-12 12-6-3 8-14z" fill="#168ccf" />
        <path d="m71 57 8 2-12 13-11 12-5-4 7-13z" fill="#126fc3" />
        <path d="m77 56 5 2-9 11-8 9-4-2 7-12z" fill="#55e2db" stroke="none" />
        <path d="m67 67 5-6 4 2-7 8-5 6-3-2z" fill="#46cfee" stroke="none" />
        <path d="m61 77 5-6 2 2-6 8-4 3-2-2z" fill="#82f4e5" stroke="none" />
      </g>

      {/* Scarlet breast and rounded voxel body. */}
      <g stroke="#4c1d1b" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M87 39h17l8 7v13l-7 8H87l-8-6V48z" fill="url(#parrot-red)" />
        <path d="M91 48h17v6H91z" fill="#ff6340" opacity=".72" stroke="none" />
        <path d="M86 58h21v7H86z" fill="#c42020" opacity=".78" stroke="none" />
        <path d="M81 47h7v7h-7zM91 66h15v3H91z" fill="#ff452e" />
        <path d="M94 42h13v3H94z" fill="#ff9860" opacity=".72" stroke="none" />
      </g>

      {/* Bright red stepped crown and face; cream cheek frames the glossy square eye. */}
      <g stroke="#541c18" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M78 17h20v-3h13v5h8v8h5v11h-5v7h-8v5H88v-4h-9v-7h-5V27h4z" fill="url(#parrot-red)" />
        <path d="M80 17h20v4H80zM103 19h10v4h-10z" fill="#ff7441" stroke="none" />
        <path d="M78 24h5v8h-5zM112 27h8v8h-8z" fill="#d9271d" stroke="none" />
        <path d="M90 28h17v3h7v8h-4v7H96v-4h-7v-9h4z" fill="#fff0c1" />
        <path d="M91 30h6v4h-6zM94 44h13v3H94z" fill="#ffe17c" stroke="none" />
        <path d="M101 32h6v8h-6z" fill="#101719" stroke="#33231e" strokeWidth="1" />
        <path d="M102 33h2v2h-2z" fill="#fff" stroke="none" />
        <path d="M96 41h9v3h-9z" fill="#f6cf67" stroke="none" />
      </g>

      {/* Oversized golden hooked beak with top, front, and shaded lower planes. */}
      <g stroke="#68401a" strokeWidth="1.35" strokeLinejoin="round">
        <path d="M113 31h8v4h7v5h5v5l-7 2-4 6h-7l-5-7v-9h3z" fill="url(#parrot-gold)" />
        <path d="M113 31h8v4h7v5h-12v-4h-3z" fill="#fff17a" />
        <path d="M128 40h5v5l-7 2h-7v-4h9z" fill="#f79c1f" />
        <path d="M119 47h7l-4 6h-7l-5-7h7z" fill="#d86b16" />
        <path d="M116 36h7v2h-7z" fill="#fff8b0" stroke="none" />
      </g>

      {/* Golden claws grip the perch. */}
      <g stroke="#6b4219" strokeWidth="1.1" strokeLinejoin="round">
        <path d="M86 63h4v5h5v2h-4v3h-3v-3h-4v-2h3z" fill="#ffcf36" />
        <path d="M101 64h4v4h5v2h-4v3h-3v-3h-4v-2h2z" fill="#f4a91c" />
        <path d="M82 68h4v2h-4zM99 69h4v2h-4z" fill="#fff078" stroke="none" />
      </g>

      {/* Tiny specular feather blocks echo the glossy, voxel-rendered reference. */}
      <g fill="#fff" opacity=".28">
        <rect x="84" y="21" width="5" height="2" />
        <rect x="73" y="43" width="4" height="2" />
        <rect x="67" y="55" width="4" height="2" />
        <rect x="62" y="72" width="4" height="2" />
        <rect x="94" y="51" width="4" height="2" />
      </g>
    </svg>
  );
}

/** Faceted violet crystal cache, drawn inline to match the supplied gem/booster reference. */
function AmethystClusterArtwork() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="amethyst-cave" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#252046" /><stop offset=".55" stopColor="#111526" /><stop offset="1" stopColor="#091017" /></linearGradient>
        <radialGradient id="amethyst-aura"><stop stopColor="#a76dff" stopOpacity=".48" /><stop offset="1" stopColor="#683fff" stopOpacity="0" /></radialGradient>
        <linearGradient id="amethyst-crystal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f4e9ff" /><stop offset=".3" stopColor="#c990ff" /><stop offset=".72" stopColor="#773fd2" /><stop offset="1" stopColor="#392468" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#amethyst-cave)" />
      <ellipse cx="101" cy="70" rx="74" ry="55" fill="url(#amethyst-aura)" />
      <path d="M0 0h31v16h13v19H31v13H18v18H0zM165 0h35v62h-17V43h-12V27h8V15h-9z" fill="#30284e" />
      <path d="M0 99h200v21H0z" fill="#171c26" /><path d="M22 101h156v5H22z" fill="#58417d" opacity=".65" />
      <path d="M51 98h98v7H51z" fill="#4b3e65" stroke="#171522" strokeWidth="3" />
      <path d="M61 89h78v11H61z" fill="#77618e" stroke="#251d35" strokeWidth="3" />
      <path d="M67 85h66v7H67z" fill="#d5aafd" opacity=".7" />
      <path d="m72 85 8-40 13-18 13 18-6 40z" fill="url(#amethyst-crystal)" stroke="#241a42" strokeWidth="3" strokeLinejoin="miter" />
      <path d="m93 85 7-54 14-20 15 20-10 54z" fill="#8a4fe0" stroke="#201537" strokeWidth="3" strokeLinejoin="miter" />
      <path d="m111 86 5-39 14-18 12 18-7 39z" fill="#5737a5" stroke="#201537" strokeWidth="3" strokeLinejoin="miter" />
      <path d="m82 49 11-19-4 44-7 9zM102 35l12-18-5 52-7 14zM124 49l7-13-5 38-6 11z" fill="#f1dcff" opacity=".8" />
      <path d="M44 63h6v6h-6zM151 48h5v5h-5zM53 34h4v4h-4zM145 76h5v5h-5z" fill="#f9dbff" />
      <path d="M28 83h7v2h-7zM165 87h8v2h-8z" fill="#a97cff" />
    </svg>
  );
}

/** Golden stepped monument with an ember core, inspired by the supplied starter-boost relic. */
function GoldenRelicArtwork() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="relic-dusk" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#44331f" /><stop offset=".62" stopColor="#1d211f" /><stop offset="1" stopColor="#0c1212" /></linearGradient>
        <radialGradient id="relic-glow"><stop stopColor="#ffd96a" stopOpacity=".56" /><stop offset="1" stopColor="#ee9d32" stopOpacity="0" /></radialGradient>
        <linearGradient id="relic-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0a1" /><stop offset=".35" stopColor="#e8b642" /><stop offset=".75" stopColor="#9a641e" /><stop offset="1" stopColor="#f6cc57" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#relic-dusk)" /><ellipse cx="102" cy="60" rx="80" ry="64" fill="url(#relic-glow)" />
      <path d="M0 99h200v21H0z" fill="#17211e" /><path d="M19 104h163v5H19z" fill="#54603b" opacity=".72" />
      <path d="M51 92h98v13H51z" fill="#73502a" stroke="#201a12" strokeWidth="3" />
      <path d="M61 83h78v12H61z" fill="url(#relic-gold)" stroke="#352718" strokeWidth="3" />
      <path d="M73 75h54v11H73z" fill="#a5742c" stroke="#352718" strokeWidth="3" />
      <path d="M82 42h36v34H82z" fill="url(#relic-gold)" stroke="#392718" strokeWidth="3" />
      <path d="M72 35h56v10H72z" fill="#ffda5d" stroke="#4a311a" strokeWidth="3" />
      <path d="M82 26h36v10H82z" fill="#bd852c" stroke="#3a2818" strokeWidth="3" />
      <path d="M91 16h18v12H91z" fill="#ffe98b" stroke="#513817" strokeWidth="3" />
      <path d="M68 46h11v24H68zM121 46h11v24h-11z" fill="#d6a03d" stroke="#493117" strokeWidth="3" />
      <path d="M95 47h10v20H95z" fill="#fff09a" /><path d="M98 51h4v12h-4z" fill="#ff8e2f" />
      <path d="M45 42h5v5h-5zM149 33h5v5h-5zM55 23h4v4h-4zM143 72h5v5h-5z" fill="#fff0a1" />
      <path d="M27 80h8v3h-8zM164 89h7v3h-7z" fill="#e89f31" opacity=".8" />
    </svg>
  );
}

/** Mixed ore-and-coin haul bursting from a dark oak chest for the epic supply item. */
function MixedLootChestArtwork() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="mixed-loot-bg" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#172238" /><stop offset=".58" stopColor="#11151e" /><stop offset="1" stopColor="#0a1012" /></linearGradient>
        <radialGradient id="mixed-loot-flare"><stop stopColor="#e7a34e" stopOpacity=".38" /><stop offset="1" stopColor="#cd7631" stopOpacity="0" /></radialGradient>
        <linearGradient id="mixed-loot-wood" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#986238" /><stop offset=".5" stopColor="#5d3826" /><stop offset="1" stopColor="#34231c" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#mixed-loot-bg)" /><ellipse cx="99" cy="63" rx="84" ry="61" fill="url(#mixed-loot-flare)" />
      <path d="M0 98h200v22H0z" fill="#17211e" /><path d="M18 104h164v4H18z" fill="#446044" />
      {/* Coins and ore shards arc upward from the open lid. */}
      <path d="M38 44h19v6H38zM46 36h19v6H46z" fill="#e9b952" stroke="#523617" strokeWidth="2" />
      <path d="M52 31h13v4H52zM139 36h20v6h-20zM149 28h16v6h-16z" fill="#d99d35" stroke="#523617" strokeWidth="2" />
      <path d="m67 55 8-24h12l7 24-14 12z" fill="#61e9dc" stroke="#123e51" strokeWidth="2" />
      <path d="m85 50 7-34h12l8 34-14 12z" fill="#d68bff" stroke="#4a245f" strokeWidth="2" />
      <path d="m110 55 8-26h12l7 26-13 10z" fill="#f1a64c" stroke="#61371d" strokeWidth="2" />
      <path d="M73 35h8l-4 17h-7zM93 21h7l-4 22h-6zM119 32h7l-4 17h-7z" fill="#fff4ce" opacity=".85" />
      <path d="M72 57 77 47h9l5 10-10 9z" fill="#7b4fe5" stroke="#2b1e5f" strokeWidth="2" />
      <path d="M42 74 48 63h13l7 11-13 10z" fill="#4fc4c8" stroke="#183b3f" strokeWidth="2" />
      <path d="M132 73 139 61h14l6 12-14 11z" fill="#c9d4dc" stroke="#39424a" strokeWidth="2" />
      {/* Open chest body and heavy bands. */}
      <path d="m46 62 54-10 54 10v11H46z" fill="#68442d" stroke="#1b1715" strokeWidth="4" />
      <path d="M40 72h120v34H40z" fill="url(#mixed-loot-wood)" stroke="#171515" strokeWidth="4" />
      <path d="M50 78h100v22H50z" fill="#75452c" stroke="#281d18" strokeWidth="2" />
      <path d="M57 74h10v31H57zM134 74h10v31h-10z" fill="#bd8a42" stroke="#463018" strokeWidth="2" />
      <path d="M88 76h24v11H88z" fill="#dcad4f" stroke="#553919" strokeWidth="2" />
      <path d="M93 82h14v17H93z" fill="#29252a" stroke="#583b21" strokeWidth="2" />
      <path d="M98 85h5v10h-5z" fill="#f4d26d" />
      <path d="M47 101h105v5H47z" fill="#1b1716" />
      <path d="M23 57h4v4h-4zM171 49h4v4h-4zM34 31h4v4h-4zM163 67h4v4h-4z" fill="#fff0b5" />
    </svg>
  );
}

/** Desert traveler skin with hood, layered scarf and a side satchel, all made from voxel planes. */
function NomadSkinArtwork() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="nomad-desert" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b8743d" /><stop offset=".55" stopColor="#67402f" /><stop offset="1" stopColor="#241c1c" /></linearGradient>
        <radialGradient id="nomad-sunset"><stop stopColor="#ffd17b" stopOpacity=".54" /><stop offset="1" stopColor="#ef9342" stopOpacity="0" /></radialGradient>
        <linearGradient id="nomad-cloak" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e1b476" /><stop offset=".56" stopColor="#9b6038" /><stop offset="1" stopColor="#583c31" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#nomad-desert)" /><ellipse cx="102" cy="49" rx="80" ry="67" fill="url(#nomad-sunset)" />
      <path d="M0 77 34 53l25 16 29-33 32 34 30-26 50 31v45H0z" fill="#ad6840" opacity=".8" />
      <path d="M0 91h200v29H0z" fill="#3b2923" /><path d="M0 98h200v5H0z" fill="#d08a4d" opacity=".7" />
      <path d="M26 84h5v-17h5V57h6v10h-4v17h5v6H26zM167 83h5V64h5v-9h6v9h-4v19h5v6h-17z" fill="#31513a" />
      <path d="M81 56h38v9h10v11h10v34H62V76h9V65h10z" fill="url(#nomad-cloak)" stroke="#30221d" strokeWidth="3" strokeLinejoin="miter" />
      <path d="M71 77h58v9H71zM76 88h48v8H76z" fill="#724731" />
      <path d="M92 61h16v41H92z" fill="#c88b50" /><path d="M97 66h6v31h-6z" fill="#eed2a1" opacity=".8" />
      <path d="M82 30h36v8h8v18h-7v11H79V56h-7V39h10z" fill="#bd895c" stroke="#473226" strokeWidth="3" strokeLinejoin="miter" />
      <path d="M77 27h46v10H77zM84 20h32v9H84zM91 14h17v8H91z" fill="#8b583b" stroke="#3e2a22" strokeWidth="3" />
      <path d="M78 43h44v11H78z" fill="#754b37" /><path d="M85 46h9v5h-9zM106 46h9v5h-9z" fill="#e9c184" />
      <path d="M88 45h7v7h-7zM106 45h7v7h-7z" fill="#17191b" /><path d="M90 46h2v2h-2zM108 46h2v2h-2z" fill="#fff0c5" />
      <path d="M96 55h11v4H96z" fill="#553125" />
      {/* Weathered satchel and shoulder strap. */}
      <path d="m116 64 8-2 18 28-7 4-18-27z" fill="#573729" stroke="#30221c" strokeWidth="2" />
      <path d="M126 81h23v23h-23z" fill="#885236" stroke="#33241f" strokeWidth="3" />
      <path d="M130 86h15v11h-15z" fill="#bd8250" /><path d="M135 88h5v8h-5z" fill="#edd28e" />
      <path d="M74 109h52v7H74z" fill="#30221e" /><path d="M78 105h18v5H78zM104 105h18v5h-18z" fill="#805236" />
      <path d="M54 37h4v4h-4zM146 52h4v4h-4zM38 42h5v5h-5z" fill="#fff1bd" />
    </svg>
  );
}

/** Netherite pickaxe, with a basalt head, ember inlays and a compact dark handle. */
function NetheritePickaxeArtwork() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="nether-pick-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#241d24" /><stop offset="1" stopColor="#101419" /></linearGradient>
        <linearGradient id="nether-pick-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8c6e69" /><stop offset=".48" stopColor="#39343b" /><stop offset="1" stopColor="#1c2027" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#nether-pick-bg)" />
      <ellipse cx="101" cy="89" rx="65" ry="15" fill="#ff6b44" opacity=".12" />
      <path d="M0 100h200v20H0z" fill="#13181c" /><path d="M24 104h152v4h-152z" fill="#634437" opacity=".7" />
      <path d="m84 23 37 71-11 7-39-72z" fill="#52372d" stroke="#201a18" strokeWidth="4" />
      <path d="m85 34 26 50-5 3-27-49z" fill="#bc754c" opacity=".65" />
      <path d="M38 22h45v10h38v10h-16v11h-12V42H79v-8H62v14H48V36H38z" fill="url(#nether-pick-metal)" stroke="#12151b" strokeWidth="4" strokeLinejoin="miter" />
      <path d="M44 27h34v5H44zM84 36h28v5H84z" fill="#c49a7c" />
      <path d="M53 36h9v8h-9zM97 43h9v8h-9z" fill="#ff754e" />
      <path d="M42 26h12v3H42zM110 35h9v3h-9z" fill="#f4d0a9" opacity=".7" />
      <path d="M31 64h5v5h-5zM155 27h4v4h-4zM148 57h5v5h-5z" fill="#ff8c58" />
    </svg>
  );
}

/** Matching netherite armor set, rendered as blackened voxel plates with copper-orange seams. */
function NetheriteArmorArtwork() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="nether-armor-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#241d27" /><stop offset="1" stopColor="#0b1015" /></linearGradient>
        <radialGradient id="nether-armor-glow"><stop stopColor="#ff714b" stopOpacity=".3" /><stop offset="1" stopColor="#782b25" stopOpacity="0" /></radialGradient>
        <linearGradient id="nether-armor-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#75656a" /><stop offset=".46" stopColor="#39343c" /><stop offset="1" stopColor="#181a20" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#nether-armor-bg)" /><ellipse cx="100" cy="59" rx="76" ry="65" fill="url(#nether-armor-glow)" />
      <path d="M0 100h200v20H0z" fill="#15191c" /><path d="M25 104h150v4H25z" fill="#7d4b37" opacity=".7" />
      <path d="M79 22h16V11h10v11h16v12h-6v10h-9v10H82V44h-9V34h6z" fill="url(#nether-armor-metal)" stroke="#0d1116" strokeWidth="3" />
      <path d="M84 29h23v7H84zM78 39h36v5H78z" fill="#c4876c" />
      <path d="M84 40h27v6H84z" fill="#ff714c" /><path d="M91 41h13v3H91z" fill="#ffe0ae" />
      <path d="M71 52H56v9h-8v14h11v8h17v-8h12zM117 52h15v9h8v14h-11v8h-18v-8h-9z" fill="url(#nether-armor-metal)" stroke="#11151a" strokeWidth="3" />
      <path d="M60 59h15v5H60zM121 59h15v5h-15z" fill="#a78375" />
      <path d="M77 48h44v10h7v26h-8v13H78V84h-8V58h7z" fill="url(#nether-armor-metal)" stroke="#101318" strokeWidth="3" />
      <path d="M84 56h30v8H84zM78 67h10v15H78zM110 67h11v15h-11z" fill="#60535a" />
      <path d="m93 63 8 4 6 11-11 10-11-10 5-10z" fill="#df6547" stroke="#40262b" strokeWidth="2" />
      <path d="m96 67 4 2-3 12-5-5z" fill="#ffd295" />
      <path d="M82 88h15v11H82zM104 88h15v11h-15z" fill="#28242b" stroke="#111318" strokeWidth="2" />
      <path d="M39 41h4v4h-4zM154 34h4v4h-4zM49 92h6v3h-6zM146 91h5v3h-5z" fill="#ff8756" />
    </svg>
  );
}

/** Small pixel/voxel-style SVGs keep the catalogue vivid without shipping large raster assets. */
export function ShopArtwork({ productId, accent }: ShopArtworkProps) {
  if (productId === 'pet-parrot') return <ParrotArtwork />;
  if (productId === 'pet-monkey') return <MonkeyArtwork />;
  if (productId === 'pet-wolf') return <WolfArtwork />;
  if (productId === 'pet-owl') return <OwlArtwork />;
  if (productId === 'pet-capybara') return <CapybaraArtwork />;
  if (productId === 'booster-score') return <AmethystClusterArtwork />;
  if (productId === 'booster-start') return <GoldenRelicArtwork />;
  if (productId === 'chest-rare') return <DiamondChestArtwork />;
  if (productId === 'chest-epic') return <MixedLootChestArtwork />;
  if (productId === 'netherite-pickaxe') return <NetheritePickaxeArtwork />;
  if (productId === 'netherite-armor') return <NetheriteArmorArtwork />;
  if (productId === 'armor-epic') return <NetheriteArmorArtwork />;
  if (productId === 'skin-miner') return <MinerSkinArtwork />;
  if (productId === 'skin-nomad') return <NomadSkinArtwork />;
  const chest = productId.startsWith('drop-') || productId.startsWith('chest-');
  const gear = productId.startsWith('armor-') || productId === 'netherite-pickaxe' || productId === 'netherite-armor';
  const booster = productId.startsWith('booster-');
  const pet = productId.startsWith('pet-');
  const className = 'h-[72px] w-full';
  const imageStyle: CSSProperties = { color: accent };

  return (
    <svg className={className} style={imageStyle} viewBox="0 0 160 86" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id={`shop-art-${productId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity=".2" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M14 73h132v2H14z" fill="#d8e9e2" opacity=".08" />
      <path d="M20 73h120" stroke={accent} strokeWidth="1" opacity=".16" />
      <ellipse cx="80" cy="72" rx="31" ry="7" fill={accent} opacity=".11" />
      <path d="M80 7v8M42 18l5 5M118 18l-5 5" stroke={accent} strokeWidth="2" opacity=".35" />

      {chest && (
        <g stroke="#12191c" strokeWidth="4" strokeLinejoin="miter">
          <path d="M48 31V25h8v-5h48v5h8v6h5v15H43V31z" fill={accent} opacity=".78" />
          <path d="M43 42h74v26H43z" fill="#5a402b" />
          <path d="M49 47h62v16H49z" fill="#8b6138" stroke="#29211a" strokeWidth="3" />
          <path d="M75 44h10v13H75z" fill={accent} stroke="#222" strokeWidth="3" />
          <path d="M53 29h54v4H53z" fill="#fff" opacity=".22" stroke="none" />
          <path d="M53 64h54v4H53z" fill="#201b18" opacity=".5" stroke="none" />
        </g>
      )}

      {gear && productId.startsWith('armor-') && (
        <g stroke="#172126" strokeWidth="4" strokeLinejoin="miter">
          <path d="M56 22h15v8h16v8h8v25h-8v8H52v-8h-8V38h8v-8h4z" fill={accent} />
          <path d="M58 31h27v8h10v8H75v9h-8V39H52v-8z" fill="#e7fff8" opacity=".45" stroke="none" />
          <path d="M51 58h42v9H51z" fill="#18333a" opacity=".45" stroke="none" />
        </g>
      )}

      {booster && productId === 'booster-start' && (
        <g stroke="#272019" strokeWidth="4" strokeLinejoin="miter">
          <path d="M68 17h24v9H68z" fill="#cfb178" />
          <path d="M72 26h16v9l11 10v19H61V45l11-10z" fill="#71462d" />
          <path d="M64 48h32v15H64z" fill="#f4b942" />
          <path d="M75 39h10v9H75z" fill="#fff1bd" stroke="none" />
        </g>
      )}
      {booster && productId === 'booster-ore' && (
        <g stroke="#18252b" strokeWidth="4" strokeLinejoin="miter">
          <path d="M53 29h16v-9h28l12 14v25l-14 11H60L47 56V38z" fill="#68727a" />
          <path d="M66 35h12v9H66zM91 48h12v9H91zM70 56h10v8H70z" fill={accent} />
          <path d="M72 21h22v7H72z" fill="#c2fff7" />
        </g>
      )}
      {booster && productId === 'booster-score' && (
        <g stroke="#2d2340" strokeWidth="4" strokeLinejoin="miter">
          <path d="M76 15h10v16h14v9h-9v8h16v10h-23v-9h-9v13H64V51H51V40h17v-9h8z" fill={accent} />
          <path d="M80 24v15h13v7H75v-9H59" fill="#f2d8ff" opacity=".72" stroke="none" />
        </g>
      )}

      {pet && (
        <g stroke="#172126" strokeWidth="4" strokeLinejoin="miter">
          {productId === 'pet-owl' && <path d="M56 28V18h15v8h18v-8h15v10h7v28h-8v9h-9v-8H62v8h-9v-9h-8V35h11z" fill={accent} />}
          {productId === 'pet-parrot' && <path d="M64 20h22v8h13v13h-9v9h-9v18H65V57h-9V39h8z" fill={accent} />}
          {productId === 'pet-monkey' && <path d="M54 30V20h15v7h21v-7h15v14h7v23h-9v9H61v-9h-9V37h5z" fill={accent} />}
          {productId === 'pet-cat' && <path d="M51 31h12V19h10v10h18v-8h10v16h8v20h-11v8H66v-8H53V48h-6z" fill={accent} />}
          {productId === 'pet-capybara' && <path d="M48 39h9V28h37v8h14v25H96v8H59v-7h-11z" fill={accent} />}
          {productId === 'pet-wolf' && <path d="M48 33h14V21h10v10h23v-8h11v17h9v19h-12v8H67v-8H51V48h-7z" fill={accent} />}
          <path d="M68 37h5v5h-5zM87 37h5v5h-5z" fill="#f4eee2" stroke="none" />
          <path d="M75 47h10v5H75z" fill="#202124" stroke="none" />
          <path d="M62 62h8v7h-8zM94 62h8v7h-8z" fill="#30383b" />
        </g>
      )}

      {!chest && !gear && !booster && !pet && (
        <g stroke="#1d292e" strokeWidth="4" strokeLinejoin="miter">
          <path d="M59 19h42v37H59z" fill={accent} />
          <path d="M53 57h54v13H53z" fill="#46545b" />
          <path d="M68 27h7v7h-7zM85 27h7v7h-7z" fill="#1b2022" stroke="none" />
          <path d="M71 41h18v6H71z" fill="#263137" stroke="none" />
          <path d="M57 22h11v5H57z" fill="#fff" opacity=".45" stroke="none" />
        </g>
      )}
    </svg>
  );
}
