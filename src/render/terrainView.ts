// Vue « rendu » d'un domaine : conversions monde ↔ grille et lectures du relief.
import type { Domain } from '../gen/types';
import { altAt, gradAt, isWaterAt, slopeAt } from '../gen/sol';
import { ECHELLE } from '../params/monde';
import { NEIGE } from '../params/neige';

const { UNIT, VEX, ALT0 } = ECHELLE;

export class TerrainView {
  readonly N: number; readonly CELL: number; readonly W: number; readonly S: number;
  readonly h: Float32Array; readonly lake: Uint8Array; readonly isRiver: Uint8Array;
  readonly mapW: number; readonly minAlt: number; readonly maxAlt: number;
  /** Convexité locale (m) : > 0 sur les crêtes, < 0 dans les combes. */
  readonly conv: Float32Array; readonly curvX: Float32Array; readonly curvZ: Float32Array;
  /** Seuil de pente (%) au-delà duquel la neige ne tient pas, ajusté à la maille. */
  readonly rockLim: number;
  readonly crestT: number;

  constructor(readonly d: Domain) {
    this.N = d.N; this.CELL = d.CELL; this.W = d.N + 1; this.S = d.CELL / UNIT;
    this.h = d.h; this.lake = d.lake; this.isRiver = d.isRiver;
    this.mapW = d.N * this.S;
    let mn = Infinity, mx = -Infinity;
    for (const v of d.h) { if (v < mn) mn = v; if (v > mx) mx = v; }
    this.minAlt = mn; this.maxAlt = mx;
    const W = this.W, N = this.N, h = d.h;
    this.conv = new Float32Array(W * W); this.curvX = new Float32Array(W * W); this.curvZ = new Float32Array(W * W);
    for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
      const k = j * W + i;
      this.curvX[k] = h[k - 1] + h[k + 1] - 2 * h[k];
      this.curvZ[k] = h[k - W] + h[k + W] - 2 * h[k];
      this.conv[k] = -(this.curvX[k] + this.curvZ[k]) / 4;
    }
    this.rockLim = NEIGE.rocheSeuil * Math.pow(70 / d.CELL, 0.4);
    this.crestT = d.CELL * 0.1;
  }

  hAt(i: number, j: number) { return this.h[j * this.W + i]; }
  /** Altitude (m) → hauteur 3D. */
  Y(alt: number) { return ((alt - ALT0) / UNIT) * VEX; }
  /** Indice de grille (continu) → coordonnée 3D. */
  toW(i: number) { return (i - this.N / 2) * this.S; }
  /** Coordonnée 3D → indice de grille (continu). */
  toG(w: number) { return w / this.S + this.N / 2; }

  /** Altitude interpolée sur les mêmes triangles que le maillage. */
  altAt(fi: number, fj: number) { return altAt(this.d, fi, fj); }
  /** Gradient (sans dimension) sur la case. */
  gradAt(fi: number, fj: number) { return gradAt(this.d, fi, fj); }
  /** Pente en %. */
  slopeAt(fi: number, fj: number) { return slopeAt(this.d, fi, fj); }
  /** +1 = versant nord (ubac), -1 = versant sud (adret). Le nord est -z. */
  northAt(fi: number, fj: number) { const [gx, gz] = this.gradAt(fi, fj), l = Math.hypot(gx, gz); return l < 0.03 ? 0 : gz / l; }
  isLakeOrRiver(fi: number, fj: number) { return isWaterAt(this.d, fi, fj); }

  /**
   * Point du terrain visé par un rayon (coordonnées 3D), en indices de grille, ou null hors de la carte.
   * Marche le long du rayon puis affine par dichotomie : bien plus rapide qu'un lancer de rayon sur 300 000 triangles.
   */
  pick(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): [number, number] | null {
    if (dy >= 0) return null;
    const top = this.Y(this.maxAlt) + 1, bottom = this.Y(this.minAlt) - 1;
    let t0 = Math.max(0, (oy - top) / -dy);
    const t1 = (oy - bottom) / -dy, step = this.S * 0.5;
    const above = (t: number) => {
      const fi = this.toG(ox + dx * t), fj = this.toG(oz + dz * t);
      return oy + dy * t > this.Y(this.altAt(fi, fj));
    };
    for (let t = t0; t <= t1; t += step) {
      if (above(t)) { t0 = t; continue; }
      let a = t0, b = t;
      for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (above(m)) a = m; else b = m; }
      const fi = this.toG(ox + dx * b), fj = this.toG(oz + dz * b);
      return fi < 0 || fj < 0 || fi > this.N || fj > this.N ? null : [fi, fj];
    }
    return null;
  }
}
