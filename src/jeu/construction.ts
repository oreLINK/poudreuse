// Construction des bâtiments du joueur : contrôle de l'emprise au sol et registre des bâtiments construits.
// Logique pure (sans Three.js) : le rendu ne fait qu'afficher ce qu'elle décide.
import { altAt, isWaterAt, slopeAt } from '../gen/sol';
import type { Domain } from '../gen/types';
import { ARBRE_M } from '../params/affichage';
import { BATIMENTS, CONSTRUCTION, type CleBatiment } from '../params/batiments';

/** 0 = largeur selon x, 1 = tourné d'un quart de tour. */
export type Rotation = 0 | 1;

export interface Batiment {
  id: number;
  type: CleBatiment;
  /** Centre (m). */
  x: number; z: number;
  rot: Rotation;
  /** Altitude (m) du plancher (point le plus haut de l'emprise) et du pied du soubassement (point le plus bas). */
  alt: number; base: number;
}

/** Case de contrôle de l'emprise : centre (m) et verdict. */
export interface CaseEmprise { x: number; z: number; ok: boolean }

export interface Evaluation {
  ok: boolean;
  cases: CaseEmprise[];
  /** Côté (m) d'une case de contrôle. */
  pas: number;
  /** Centre retenu (aligné sur la grille de construction), dimensions (m) et altitudes (m). */
  x: number; z: number; lx: number; lz: number;
  alt: number; base: number;
}

/** Côté (m) d'une case de contrôle : les bâtiments s'alignent sur cette grille. */
export const PAS = ARBRE_M / CONSTRUCTION.casesParArbre;

/** Dimensions au sol (m) selon la rotation. */
export function emprise(type: CleBatiment, rot: Rotation): [number, number] {
  const t = BATIMENTS[type], w = t.largeur * ARBRE_M, d = t.profondeur * ARBRE_M;
  return rot ? [d, w] : [w, d];
}

export class Chantier {
  readonly batiments: Batiment[] = [];
  private nextId = 1;

  constructor(private readonly d: Domain) {}

  /** Aligne un centre (m) sur la grille de construction, selon la parité du nombre de cases. */
  private aligner(v: number, cells: number) {
    const off = cells % 2 ? PAS / 2 : 0;
    return Math.round((v - off) / PAS) * PAS + off;
  }

  /** Contrôle l'emprise d'un bâtiment centré près de (x, z) en mètres : chaque case doit être assez plate, sèche et libre. */
  evaluer(type: CleBatiment, x: number, z: number, rot: Rotation): Evaluation {
    const { d } = this, [lx, lz] = emprise(type, rot);
    const nx = Math.round(lx / PAS), nz = Math.round(lz / PAS);
    x = this.aligner(x, nx); z = this.aligner(z, nz);
    const penteMax = BATIMENTS[type].penteMax, g = (m: number) => m / d.CELL;
    const cases: CaseEmprise[] = [];
    let alt = -Infinity, base = Infinity;
    for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
      const cx = x - lx / 2 + (a + 0.5) * PAS, cz = z - lz / 2 + (b + 0.5) * PAS;
      let ok = cx - PAS / 2 >= 0 && cz - PAS / 2 >= 0 && cx + PAS / 2 <= d.L && cz + PAS / 2 <= d.L;
      // pente au centre et aux quatre coins de la case
      for (const [sx, sz] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        const fi = g(cx + sx * PAS), fj = g(cz + sz * PAS);
        if (slopeAt(d, fi, fj) > penteMax) ok = false;
        const h = altAt(d, fi, fj);
        alt = Math.max(alt, h); base = Math.min(base, h);
      }
      if (isWaterAt(d, g(cx), g(cz))) ok = false;
      if (this.batiments.some(o => this.couvre(o, cx, cz))) ok = false;
      cases.push({ x: cx, z: cz, ok });
    }
    return { ok: cases.every(c => c.ok), cases, pas: PAS, x, z, lx, lz, alt, base };
  }

  /** Vrai si le point (m) est sous l'emprise du bâtiment. */
  couvre(o: Batiment, x: number, z: number) {
    const [lx, lz] = emprise(o.type, o.rot);
    return Math.abs(x - o.x) < lx / 2 && Math.abs(z - o.z) < lz / 2;
  }

  /** Construit le bâtiment si l'emprise est valide ; renvoie null sinon. */
  construire(type: CleBatiment, x: number, z: number, rot: Rotation): Batiment | null {
    const e = this.evaluer(type, x, z, rot);
    if (!e.ok) return null;
    const b: Batiment = { id: this.nextId++, type, x: e.x, z: e.z, rot, alt: e.alt, base: e.base };
    this.batiments.push(b);
    return b;
  }
}
