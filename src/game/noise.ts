// Seeded RNG + classic gradient noise (2D/3D) with fbm helpers.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = new Uint8Array(512);

export function seedNoise(seed: number) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function grad3(hash: number, x: number, y: number, z: number) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function noise3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x),
    v = fade(y),
    w = fade(z);
  const A = P[X] + Y,
    AA = P[A] + Z,
    AB = P[A + 1] + Z;
  const B = P[X + 1] + Y,
    BA = P[B] + Z,
    BB = P[B + 1] + Z;
  return lerp(
    lerp(
      lerp(grad3(P[AA], x, y, z), grad3(P[BA], x - 1, y, z), u),
      lerp(grad3(P[AB], x, y - 1, z), grad3(P[BB], x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(grad3(P[AA + 1], x, y, z - 1), grad3(P[BA + 1], x - 1, y, z - 1), u),
      lerp(grad3(P[AB + 1], x, y - 1, z - 1), grad3(P[BB + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}

function grad2(hash: number, x: number, y: number) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? 2 * v : -2 * v);
}

export function noise2(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x),
    v = fade(y);
  const A = P[X] + Y,
    B = P[X + 1] + Y;
  return lerp(
    lerp(grad2(P[A], x, y), grad2(P[B], x - 1, y), u),
    lerp(grad2(P[A + 1], x, y - 1), grad2(P[B + 1], x - 1, y - 1), u),
    v,
  );
}

export function fbm2(x: number, y: number, octaves = 4, lac = 2, gain = 0.5) {
  let amp = 1,
    freq = 1,
    sum = 0,
    norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

export function fbm3(x: number, y: number, z: number, octaves = 3, lac = 2, gain = 0.5) {
  let amp = 1,
    freq = 1,
    sum = 0,
    norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}
