// Tests du générateur : on vérifie les garanties de gameplay sur plusieurs graines.
import { describe, expect, it } from 'vitest';
import type { SizeKey } from '../src/params/monde';
import { STATION } from '../src/params/amenagement';
import { classOf, type SlopeClass } from '../src/params/terrain';
import { isWaterAt, slopeAt } from '../src/gen/sol';
import { generateDomain } from '../src/gen/domain';
import type { Domain } from '../src/gen/types';

// graines × tailles : la taille par défaut (moyen) et la plus compacte (petit)
const CASES: [number, SizeKey][] = [[1, 'moyen'], [42, 'moyen'], [777, 'moyen'], [5, 'petit'], [314, 'petit']];
const cache = new Map<string, Domain>();
const domain = (seed: number, size: SizeKey) => {
  const key = `${size}:${seed}`;
  if (!cache.has(key)) cache.set(key, generateDomain(seed, size));
  return cache.get(key)!;
};

function slopeShares(d: Domain) {
  const { N, CELL, h } = d, W = N + 1, count: Record<string, number> = {};
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const a = h[z * W + x];
    const pct = Math.hypot((h[z * W + x + 1] - a) / CELL, (h[(z + 1) * W + x] - a) / CELL) * 100;
    const c = classOf(pct);
    count[c] = (count[c] ?? 0) + 1;
  }
  const share = (c: SlopeClass) => (count[c] ?? 0) / (N * N);
  return share;
}

describe('générateur de domaine', () => {
  it('est déterministe : même graine, même carte', () => {
    const a = generateDomain(1234, 'moyen'), b = generateDomain(1234, 'moyen');
    expect(a.h).toEqual(b.h);
    expect(a.rivers.length).toBe(b.rivers.length);
  });

  it.each(CASES)('graine %i (%s) : altitudes réalistes', (seed, size) => {
    const { h } = domain(seed, size);
    let mn = Infinity, mx = -Infinity;
    for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    expect(mn).toBeGreaterThan(700);
    expect(mn).toBeLessThan(1500);
    expect(mx).toBeGreaterThan(2800);
    expect(mx).toBeLessThan(5000);
  });

  it.each(CASES)('graine %i (%s) : répartition des pentes jouable', (seed, size) => {
    const share = slopeShares(domain(seed, size));
    expect(share('vert')).toBeGreaterThan(0.15);
    expect(share('bleu')).toBeGreaterThan(0.1);
    expect(share('rouge')).toBeGreaterThan(0.05);
    expect(share('noir')).toBeGreaterThan(0.03);
    expect(share('plat')).toBeLessThan(0.25);
  });

  it.each(CASES)('graine %i (%s) : aucune cuvette, chaque case a une descente', (seed, size) => {
    const { N, h, lake } = domain(seed, size), W = N + 1;
    for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
      const k = j * W + i;
      let lower = false;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const n = (j + b) * W + i + a;
        if (h[n] < h[k] || (lake[k] && h[n] <= h[k])) { lower = true; break; }
      }
      expect(lower, `case ${i},${j}`).toBe(true);
    }
  });

  it.each(CASES)('graine %i (%s) : les lacs sont plats', (seed, size) => {
    const { N, h, lake } = domain(seed, size), W = N + 1;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * W + i;
      if (lake[k] && lake[k + 1]) expect(Math.abs(h[k] - h[k + 1])).toBeLessThan(0.01);
    }
  });

  it.each(CASES)('graine %i (%s) : les rivières descendent', (seed, size) => {
    const d = domain(seed, size);
    expect(d.rivers.length).toBeGreaterThan(3);
    for (const river of d.rivers) for (let k = 1; k < river.length; k++) expect(river[k][3]).toBeLessThanOrEqual(river[k - 1][3] + 1e-3);
  });

  it.each([...CASES, [9, 'grand'], [11, 'immense']] as [number, SizeKey][])('graine %i (%s) : une aire de station plate, à la bonne taille, parmi les points bas', (seed, size) => {
    const d = domain(seed, size), { CELL, h, station } = d;
    expect(station.R).toBe(STATION.rayon[size]);
    expect(station.x - station.R).toBeGreaterThan(0); expect(station.x + station.R).toBeLessThan(d.L);
    expect(station.z - station.R).toBeGreaterThan(0); expect(station.z + station.R).toBeLessThan(d.L);
    // assez plate : chaque case de l'aire (hors lisière) reste sous 5 %, et presque toutes sont constructibles (pas d'eau)
    const Rc = (station.R * 0.9) / CELL, ci = station.x / CELL, cj = station.z / CELL;
    let cells = 0, wet = 0;
    for (let j = Math.ceil(cj - Rc); j <= Math.floor(cj + Rc); j++) for (let i = Math.ceil(ci - Rc); i <= Math.floor(ci + Rc); i++) {
      if (Math.hypot(i - ci, j - cj) > Rc) continue;
      cells++;
      if (isWaterAt(d, i, j)) wet++;
      expect(slopeAt(d, i + 0.5, j + 0.5), `pente case ${i},${j}`).toBeLessThan(5);
    }
    expect(wet / cells).toBeLessThan(0.1);
    // parmi les parties basses : l'aire est sous l'altitude médiane de la carte
    const sorted = Array.from(h).sort((a, b) => a - b);
    expect(station.alt).toBeLessThan(sorted[Math.floor(sorted.length * 0.5)]);
  });

  it('petit : l\'aire est sur la partie la plus basse de la carte', () => {
    for (const seed of [5, 314]) {
      const { h, station } = domain(seed, 'petit');
      const sorted = Array.from(h).sort((a, b) => a - b);
      expect(station.alt).toBeLessThan(sorted[Math.floor(sorted.length * 0.15)]);
    }
  });
});
