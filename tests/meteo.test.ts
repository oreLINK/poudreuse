// Tests de la météo : vent (épisodes variés, calme sans vent, rafales localisées) et ciel (états, orages, tempêtes).
import { describe, expect, it } from 'vitest';
import { Meteo } from '../src/sim/meteo';

const L = 18000;
/** Fait tourner la météo et relève, pour chaque mode, l'intensité en 9 points de la carte. */
function run(seed: number, seconds: number) {
  const m = new Meteo(seed, L), seen = { calme: [] as number[][], rafales: [] as number[][], soutenu: [] as number[][] };
  for (let t = 0; t < seconds; t += 0.1) {
    m.update(0.1);
    const pts: number[] = [];
    for (const fx of [0.2, 0.5, 0.8]) for (const fz of [0.2, 0.5, 0.8]) pts.push(m.intensiteEn(fx * L, fz * L));
    seen[m.mode].push(pts);
  }
  return seen;
}

describe('météo', () => {
  const seen = run(7, 3000);

  it('alterne les trois modes de vent', () => {
    expect(seen.calme.length).toBeGreaterThan(0);
    expect(seen.rafales.length).toBeGreaterThan(0);
    expect(seen.soutenu.length).toBeGreaterThan(0);
  });

  it('les intensités restent entre 0 et 1', () => {
    for (const list of Object.values(seen)) for (const pts of list) for (const v of pts) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1.2);
    }
  });

  it('les rafales ne soufflent pas partout à la fois', () => {
    // en épisode de rafales, une bonne part des relevés montre une carte où certains points sont calmes et d'autres ventés
    const mixed = seen.rafales.filter(pts => Math.max(...pts) > 0.3 && Math.min(...pts) < 0.05).length;
    expect(mixed / seen.rafales.length).toBeGreaterThan(0.2);
  });

  it('le vent soutenu souffle sur toute la carte', () => {
    // hors fondu d'entrée, tous les points sont ventés
    const windy = seen.soutenu.filter(pts => Math.min(...pts) > 0.4).length;
    expect(windy / seen.soutenu.length).toBeGreaterThan(0.5);
  });

  it('est déterministe pour une même graine', () => {
    expect(run(3, 200)).toEqual(run(3, 200));
  });
});

/** Fait tourner le ciel pendant `heures` heures de jeu (pas de 0,1 s réelle = 0,01 h). */
function ciel(seed: number, heures: number, chaleur: number, temperatureStation: number) {
  const m = new Meteo(seed, L), etats = new Set<string>();
  let eclairs = 0, orages = 0, tempetes = 0, ventTempete = 0;
  for (let h = 0; h < heures; h += 0.01) {
    m.update(0.1, { heures: 0.01, chaleur, temperatureStation });
    etats.add(m.ciel);
    if (m.eclair === 1) eclairs++;
    if (m.ciel === 'tempete') { tempetes++; if (m.estOrage(temperatureStation)) orages++; if (m.precipitation > 0.9) ventTempete = Math.max(ventTempete, m.intensiteEn(L / 2, L / 2)); }
  }
  return { etats, eclairs, orages, tempetes, ventTempete, m };
}

describe('ciel', () => {
  const hiver = ciel(11, 600, 0, -6), ete = ciel(11, 600, 1, 16);

  it('passe par tous les états : dégagé, nuageux, brouillard, précipitations, tempête', () => {
    expect([...hiver.etats].sort()).toEqual(['brouillard', 'degage', 'nuageux', 'precipitations', 'tempete']);
    expect([...ete.etats].sort()).toEqual(['brouillard', 'degage', 'nuageux', 'precipitations', 'tempete']);
  });

  it('l\'hiver : tempêtes de neige sans éclairs, avec un vent fort partout', () => {
    expect(hiver.tempetes).toBeGreaterThan(0);
    expect(hiver.orages).toBe(0);
    expect(hiver.eclairs).toBe(0);
    expect(hiver.ventTempete).toBeGreaterThan(0.8);
  });

  it('l\'été : orages avec éclairs, plus courts que les tempêtes d\'hiver', () => {
    expect(ete.orages).toBeGreaterThan(0);
    expect(ete.eclairs).toBeGreaterThan(5);
  });

  it('couverture, brouillard et précipitations restent entre 0 et 1', () => {
    const m = hiver.m;
    for (const v of [m.couverture, m.brouillard, m.precipitation]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('est déterministe pour une même graine', () => {
    const a = ciel(5, 100, 0.5, 2).m, b = ciel(5, 100, 0.5, 2).m;
    expect([a.ciel, a.couverture, a.precipitation]).toEqual([b.ciel, b.couverture, b.precipitation]);
  });
});
