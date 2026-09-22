// Outils numériques partagés : aléatoire déterministe, bruit, fonctions de lissage.

export type Rng = () => number;
export type Noise2 = (x: number, y: number) => number;

/** Générateur pseudo-aléatoire déterministe (mulberry32). Même graine = même suite. */
export function rng(seed: number): Rng {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit de Perlin 2D (valeurs dans [-1, 1] environ). */
export function makeNoise(r: Rng): Noise2 {
  const a = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  const g = (h: number, x: number, y: number): number => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  const f = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), X = xi & 255, Y = yi & 255;
    x -= xi; y -= yi;
    const u = f(x), v = f(y);
    return l(l(g(p[p[X] + Y], x, y), g(p[p[X + 1] + Y], x - 1, y), u),
             l(g(p[p[X] + Y + 1], x, y - 1), g(p[p[X + 1] + Y + 1], x - 1, y - 1), u), v);
  };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Maximum adouci (raccord arrondi entre deux reliefs). */
export const smax = (a: number, b: number, k: number) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2 - k / 2;
/** Minimum adouci (crête arrondie entre deux vallées). */
export const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
