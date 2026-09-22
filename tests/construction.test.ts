// Tests de la construction : emprise, pente, eau, chevauchement.
import { describe, expect, it } from 'vitest';
import { generateDomain } from '../src/gen/domain';
import { slopeAt } from '../src/gen/sol';
import { Chantier, emprise, PAS } from '../src/jeu/construction';
import { ARBRE_M } from '../src/params/affichage';

const d = generateDomain(42, 'petit');

describe('construction', () => {
  it('une maisonnette mesure 3 arbres sur 2', () => {
    const [lx, lz] = emprise('maisonnette', 0);
    expect(lx).toBeCloseTo(3 * ARBRE_M);
    expect(lz).toBeCloseTo(2 * ARBRE_M);
    expect(emprise('maisonnette', 1)).toEqual([lz, lx]);
  });

  it('se construit au centre de l\'aire de la station, toutes les cases vertes', () => {
    const c = new Chantier(d);
    const e = c.evaluer('maisonnette', d.station.x, d.station.z, 0);
    expect(e.cases.length).toBe(6 * 4);
    expect(e.cases.every(k => k.ok)).toBe(true);
    expect(c.construire('maisonnette', d.station.x, d.station.z, 0)).not.toBeNull();
    expect(c.batiments.length).toBe(1);
  });

  it('refuse un chevauchement mais accepte un bâtiment accolé', () => {
    const c = new Chantier(d), vide = new Chantier(d);
    const [lx] = emprise('maisonnette', 0), { x, z } = d.station;
    c.construire('maisonnette', x, z, 0);
    expect(c.evaluer('maisonnette', x + PAS, z, 0).ok).toBe(false);
    // accolé : aucune case ne devient rouge à cause du voisin
    for (const nx of [x + lx, x - lx]) {
      const avec = c.evaluer('maisonnette', nx, z, 0).cases, sans = vide.evaluer('maisonnette', nx, z, 0).cases;
      expect(avec.map(k => k.ok)).toEqual(sans.map(k => k.ok));
    }
  });

  it('refuse une pente raide et marque les cases concernées en rouge', () => {
    const c = new Chantier(d);
    let steep: [number, number] | null = null;
    for (let j = 10; j < d.N - 10 && !steep; j += 3) for (let i = 10; i < d.N - 10; i += 3) {
      if (slopeAt(d, i, j) > 60) { steep = [i * d.CELL, j * d.CELL]; break; }
    }
    expect(steep).not.toBeNull();
    const e = c.evaluer('maisonnette', steep![0], steep![1], 0);
    expect(e.ok).toBe(false);
    expect(e.cases.some(k => !k.ok)).toBe(true);
    expect(c.construire('maisonnette', steep![0], steep![1], 0)).toBeNull();
  });

  it('refuse le bord de la carte', () => {
    expect(new Chantier(d).evaluer('maisonnette', 10, 10, 0).ok).toBe(false);
  });
});
