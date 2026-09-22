// Tests du vent : épisodes variés, calme sans vent, rafales localisées.
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
