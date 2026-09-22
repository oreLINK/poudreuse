// Lectures du sol d'un domaine (sans Three.js) : altitude, pente, eau.
// Coordonnées continues de grille (fi, fj) : 1 = une case ; mètres = grille × CELL.
import { clamp } from './math';
import type { Domain } from './types';

type Sol = Pick<Domain, 'N' | 'CELL' | 'h' | 'lake' | 'isRiver'>;

const hAt = (d: Sol, i: number, j: number) => d.h[j * (d.N + 1) + i];

/** Altitude (m) interpolée sur les mêmes triangles que le maillage affiché. */
export function altAt(d: Sol, fi: number, fj: number) {
  fi = clamp(fi, 0, d.N - 1e-4); fj = clamp(fj, 0, d.N - 1e-4);
  const i = Math.floor(fi), j = Math.floor(fj), tx = fi - i, tz = fj - j;
  const a = hAt(d, i, j), b = hAt(d, i + 1, j), c = hAt(d, i, j + 1), e = hAt(d, i + 1, j + 1);
  if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
  return e + (c - e) * (1 - tx) + (b - e) * (1 - tz);
}

/** Gradient (sans dimension) sur la case. */
export function gradAt(d: Sol, fi: number, fj: number): [number, number] {
  const i = clamp(Math.floor(fi), 0, d.N - 1), j = clamp(Math.floor(fj), 0, d.N - 1);
  return [
    ((hAt(d, i + 1, j) - hAt(d, i, j)) + (hAt(d, i + 1, j + 1) - hAt(d, i, j + 1))) / 2 / d.CELL,
    ((hAt(d, i, j + 1) - hAt(d, i, j)) + (hAt(d, i + 1, j + 1) - hAt(d, i + 1, j))) / 2 / d.CELL,
  ];
}

/** Pente en %. */
export function slopeAt(d: Sol, fi: number, fj: number) { const [gx, gz] = gradAt(d, fi, fj); return Math.hypot(gx, gz) * 100; }

/** Lac gelé ou cours d'eau au sommet de grille le plus proche. */
export function isWaterAt(d: Sol, fi: number, fj: number) {
  const k = Math.round(clamp(fj, 0, d.N)) * (d.N + 1) + Math.round(clamp(fi, 0, d.N));
  return !!(d.lake[k] || d.isRiver[k]);
}
