// Tests du climat, du manteau neigeux et des avalanches.
import { describe, expect, it } from 'vitest';
import { generateDomain } from '../src/gen/domain';
import { slopeAt } from '../src/gen/sol';
import { CLIMAT } from '../src/params/climat';
import { RISQUE } from '../src/params/avalanches';
import { Avalanche } from '../src/sim/avalanche';
import { limitePluieNeige, neigeSaison, probabiliteNeige, temperature, type Contexte } from '../src/sim/climat';
import { Manteau, type Declenchement } from '../src/sim/manteau';
import type { Meteo } from '../src/sim/meteo';

const hiver: Contexte = { fraction: CLIMAT.saisonFigee.hiver, heure: 12, couverture: 0.2, precipitation: 0, tempete: false };
const ete: Contexte = { ...hiver, fraction: CLIMAT.saisonFigee.ete };
/** Météo simplifiée : précipitation et vent uniformes. */
const ciel = (precipitation: number, vent = 0) => ({ precipitation, intensiteEn: () => vent }) as unknown as Meteo;
const d = generateDomain(42, 'moyen');

/** Fait tourner le manteau par pas d'une demi-heure ; renvoie les déclenchements. */
function tourner(m: Manteau, heures: number, meteo: Meteo, c: Contexte) {
  const out: Declenchement[] = [];
  for (let t = 0; t < heures; t += 0.5) out.push(...m.update(0.5, meteo, { ...c, heure: (c.heure + t) % 24 }, 3));
  return out;
}

describe('climat', () => {
  it('fait plus chaud en été, en bas et l\'après-midi', () => {
    expect(temperature(1500, ete)).toBeGreaterThan(temperature(1500, hiver) + 12);
    expect(temperature(1500, hiver)).toBeGreaterThan(temperature(3000, hiver) + 9);
    expect(temperature(1500, { ...hiver, heure: 15 })).toBeGreaterThan(temperature(1500, { ...hiver, heure: 4 }));
  });

  it('neige l\'hiver sur toute la carte, pluie l\'été sauf en haute altitude', () => {
    expect(limitePluieNeige(hiver)).toBeLessThan(1300);
    const lim = limitePluieNeige(ete);
    expect(lim).toBeGreaterThan(2500);
    expect(lim).toBeLessThan(4200);
  });

  it('enneigement de saison : partout en hiver, seulement en haute altitude en été', () => {
    expect(neigeSaison(1300, 0, hiver.fraction)).toBeGreaterThan(0.2);
    expect(neigeSaison(1800, 0, ete.fraction)).toBe(0);
    expect(neigeSaison(3800, 0, ete.fraction)).toBeGreaterThan(0.5);
    expect(neigeSaison(3000, 1, ete.fraction)).toBeGreaterThan(neigeSaison(3000, -1, ete.fraction));
  });

  it('probabilité de neige : croît avec l\'altitude et face au vent, plus forte en hiver, bornée à 99 %', () => {
    expect(probabiliteNeige(3000, 0, hiver.fraction)).toBeGreaterThan(probabiliteNeige(1400, 0, hiver.fraction));
    expect(probabiliteNeige(2000, 1, hiver.fraction)).toBeGreaterThan(probabiliteNeige(2000, -1, hiver.fraction) + 0.15);
    expect(probabiliteNeige(1400, 0, hiver.fraction)).toBeGreaterThan(0.5);
    expect(probabiliteNeige(1400, 0, ete.fraction)).toBeLessThan(0.02);
    expect(probabiliteNeige(3800, 0, ete.fraction)).toBeGreaterThan(0.3);
    expect(probabiliteNeige(4500, 1, hiver.fraction)).toBeLessThanOrEqual(0.99);
  });
});

describe('manteau neigeux', () => {
  it('mise à jour par tranches : toute la grille est reprise en un tour, avec les heures écoulées', () => {
    const m = new Manteau(d);
    let tours = 0;
    for (let k = 0; k < Manteau.TRANCHES * 2; k++) if (m.avancer(0.5, ciel(1), hiver, 0).complet) tours++;
    expect(tours).toBe(2);
    // 8 h de neige : chaque tranche a reçu sa neige fraîche (le bas de la grille comme le haut)
    const W = d.N + 1, haut = m.frais[5 * W + 5], bas = m.frais[(d.N - 5) * W + d.N - 5];
    expect(Math.min(haut, bas)).toBeGreaterThan(0.1);
  });

  it('temps calme sans neige fraîche : risque faible, aucune avalanche', () => {
    const m = new Manteau(d);
    const dec = tourner(m, 48, ciel(0), hiver);
    expect(dec.length).toBe(0);
    expect(Math.max(...m.niveau)).toBeLessThanOrEqual(2);
  });

  it('pentes douces et terrain plat restent au niveau 0', () => {
    const m = new Manteau(d);
    tourner(m, 12, ciel(1), hiver);
    for (let k = 0; k < m.niveau.length; k++) if (m.penteEn(k) < RISQUE.penteMin) expect(m.niveau[k]).toBe(0);
  });

  it('une tempête de neige fait monter le risque, puis il redescend', () => {
    const m = new Manteau(d);
    tourner(m, 14, ciel(1, 0.7), hiver);
    const fort = Array.from(m.niveau).filter(l => l >= 4).length;
    expect(fort).toBeGreaterThan(100);
    tourner(m, 96, ciel(0), hiver);
    expect(Array.from(m.niveau).filter(l => l >= 4).length).toBeLessThan(fort / 4);
  });

  it('une tempête déclenche des avalanches naturelles, sur des pentes raides', () => {
    const m = new Manteau(d);
    const dec = tourner(m, 16, ciel(1, 0.7), hiver);
    expect(dec.length).toBeGreaterThan(0);
    for (const x of dec) expect(m.penteEn(x.cellules[0])).toBeGreaterThan(RISQUE.penteMin);
    // une plaque se propage sur plusieurs cases, une coulée meuble part d'un point
    for (const x of dec) if (x.type === 'meuble') expect(x.cellules.length).toBe(1);
  });

  it('le vent forme des plaques sous le vent (versants est), pas face au vent', () => {
    const m = new Manteau(d);
    tourner(m, 6, ciel(0.6, 1), hiver);
    const W = d.N + 1;
    let est = 0, ouest = 0, ne = 0, no = 0;
    for (let j = 1; j < d.N; j++) for (let i = 1; i < d.N; i++) {
      const k = j * W + i, gx = (d.h[k + 1] - d.h[k - 1]) / (2 * d.CELL);
      if (Math.abs(gx) < 0.15) continue;
      if (gx < 0) { est += m.plaque[k]; ne++; } else { ouest += m.plaque[k]; no++; }
    }
    expect(est / ne).toBeGreaterThan((ouest / no) * 5);
  });

  it('la forêt ancre le manteau', () => {
    const m = new Manteau(d);
    tourner(m, 10, ciel(1), hiver);
    let f = 0, nf = 0, cf = 0, cnf = 0;
    for (let k = 0; k < m.instabilite.length; k++) {
      const p = m.penteEn(k);
      if (p < 33 || p > 40) continue;
      if (m.estForet(k)) { f += m.instabilite[k]; cf++; } else { nf += m.instabilite[k]; cnf++; }
    }
    if (cf && cnf) expect(f / cf).toBeLessThan(nf / cnf);
  });

  it('en été, le bas de la carte est déneigé et la pluie humidifie la neige d\'altitude', () => {
    const m = new Manteau(d);
    tourner(m, 6, ciel(0.5), ete);
    const W = d.N + 1;
    let bas = 0, nb = 0;
    for (let k = 0; k < d.h.length; k++) if (d.h[k] < 2000) { bas += m.hauteur(k); nb++; }
    expect(bas / nb).toBeLessThan(0.01);
    expect(Math.max(...Array.from(m.humide))).toBeGreaterThan(0.5);
    expect(W).toBe(m.W);
  });
});

describe('avalanches', () => {
  /** Un départ sur une pente raide et enneigée. */
  function depart(type: Declenchement['type']): Declenchement {
    const m = new Manteau(d);
    tourner(m, 2, ciel(0), hiver);
    let k0 = -1;
    for (let k = 0; k < d.h.length && k0 < 0; k++) if (m.penteEn(k) > 36 && m.penteEn(k) < 42 && !m.estForet(k) && d.h[k] > 2500) k0 = k;
    return { type, cellules: [k0], volume: 20000 };
  }

  it('dévale la pente puis s\'arrête en dépôt', () => {
    const a = new Avalanche(d, depart('plaque'), 1);
    for (let t = 0; t < 300 && a.enCours; t += 0.05) a.update(0.05);
    expect(a.enCours).toBe(false);
    let alt = 0, n = 0;
    for (let q = 0; q < a.n; q++) if (a.etat[q] === 0) { alt += a.altitude(q); n++; }
    expect(n).toBeGreaterThan(a.n / 2);
    expect(alt / n).toBeLessThan(a.departAlt - 100);
    // les dépôts reposent sur des pentes faibles (zone d'arrêt)
    let pente = 0;
    for (let q = 0; q < a.n; q++) if (a.etat[q] === 0) pente += slopeAt(d, a.x[q] / d.CELL, a.z[q] / d.CELL);
    expect(pente / n).toBeLessThan(30);
  });

  it('l\'aérosol est bien plus rapide que la neige humide', () => {
    const run = (type: Declenchement['type']) => {
      const a = new Avalanche(d, depart(type), 1);
      for (let t = 0; t < 300 && a.enCours; t += 0.05) a.update(0.05);
      return a.vitesseMax;
    };
    const aero = run('aerosol'), hum = run('humide');
    expect(aero).toBeGreaterThan(hum * 1.8);
    expect(hum * 3.6).toBeLessThan(90);        // km/h
    expect(aero * 3.6).toBeGreaterThan(100);
  });
});
