// Tests de l'horloge : durées du jour et de la nuit, modes figés, saisons, heure et date affichées.
import { describe, expect, it } from 'vitest';
import { CLIMAT } from '../src/params/climat';
import { SAISONS, TEMPS } from '../src/params/temps';
import { Horloge } from '../src/sim/temps';

/** Temps passé de jour et de nuit sur une durée donnée, par pas de 0,5 s. */
function repartition(h: Horloge, secondes: number) {
  let jour = 0, nuit = 0;
  for (let t = 0; t < secondes; t += 0.5) { h.update(0.5); if (h.estJour) jour += 0.5; else nuit += 0.5; }
  return { jour, nuit };
}

describe('horloge', () => {
  it('par défaut : 5 min de jour puis 5 min de nuit', () => {
    expect(TEMPS.dureeJour).toBe(300);
    expect(TEMPS.dureeNuit).toBe(300);
    const { jour, nuit } = repartition(new Horloge(), 3000);
    expect(jour).toBeCloseTo(1500, -1);
    expect(nuit).toBeCloseTo(1500, -1);
  });

  it('respecte des durées réglées différemment', () => {
    const { jour, nuit } = repartition(new Horloge({ dureeJour: 120, dureeNuit: 30 }), 1500);
    expect(jour / nuit).toBeCloseTo(4, 1);
  });

  it('commence à la phase de départ et avance sans saut', () => {
    const h = new Horloge();
    expect(h.phase).toBeCloseTo(TEMPS.phaseDepart, 5);
    let prev = h.phase;
    for (let k = 0; k < 2000; k++) {
      h.update(0.5);
      const d = (h.phase - prev + 1) % 1;
      expect(d).toBeLessThan(0.01);
      prev = h.phase;
    }
  });

  it('le jour couvre la course du soleil, du lever au coucher', () => {
    const h = new Horloge({ phaseDepart: TEMPS.lever });
    h.update(TEMPS.dureeJour / 2);
    expect(h.phase).toBeCloseTo((TEMPS.lever + TEMPS.coucher) / 2, 5);
    h.update(TEMPS.dureeJour / 2 + 1);
    expect(h.estJour).toBe(false);
  });

  it('peut rester de jour ou de nuit', () => {
    expect(repartition(new Horloge({ modeJournee: 'jour' }), 1000).nuit).toBe(0);
    expect(repartition(new Horloge({ modeJournee: 'nuit' }), 1000).jour).toBe(0);
  });

  it('reste en hiver par défaut', () => {
    expect(SAISONS.mode).toBe('hiver');
    const h = new Horloge();
    h.update(SAISONS.duree * 3.5);
    expect(h.saison).toBe('hiver');
  });

  it('en mode cycle, chaque saison dure 20 min', () => {
    const h = new Horloge({ modeSaison: 'cycle' });
    const vues: string[] = [];
    for (let t = 0; t < SAISONS.duree * 4; t += 60) { h.update(60); if (vues[vues.length - 1] !== h.saison) vues.push(h.saison); }
    expect(vues).toEqual(['hiver', 'printemps', 'ete', 'automne', 'hiver']);
    expect(SAISONS.duree).toBe(1200);
  });

  it('peut rester en été', () => {
    const h = new Horloge({ modeSaison: 'ete' });
    h.update(10000);
    expect(h.saison).toBe('ete');
  });

  it('affiche l\'heure du lever et du coucher de la saison', () => {
    const { lever, coucher } = SAISONS.calendrier.hiver;
    const h = new Horloge({ phaseDepart: TEMPS.lever });
    expect(h.heure).toBeCloseTo(lever, 5);
    h.update(TEMPS.dureeJour);
    expect(h.heure).toBeCloseTo(coucher, 5);
    h.update(TEMPS.dureeNuit / 2);
    expect(h.heure).toBeCloseTo((coucher + (24 - (coucher - lever)) / 2) % 24, 5);
  });

  it('commence le premier jour de l\'hiver et change de date à minuit', () => {
    const h = new Horloge();
    expect(h.date).toEqual({ jour: 21, mois: 12 });
    let prev = h.heure;
    for (let k = 0; k < 4000 && h.joursEcoules === 0; k++) { prev = h.heure; h.update(0.25); }
    expect(h.joursEcoules).toBe(1);
    expect(prev).toBeGreaterThan(23.9);
    expect(h.heure).toBeLessThan(0.1);
    expect(h.date).toEqual({ jour: 22, mois: 12 });
  });

  it('un jour de calendrier par journée de jeu, passe le nouvel an et revient au début de l\'hiver', () => {
    const h = new Horloge(), cycle = TEMPS.dureeJour + TEMPS.dureeNuit;
    h.update(cycle * 11);
    expect(h.date).toEqual({ jour: 1, mois: 1 });
    h.update(cycle * 77);
    expect(h.date).toEqual({ jour: 19, mois: 3 });   // dernier jour de l'hiver (le printemps commence le 20 mars)
    h.update(cycle);
    expect(h.date).toEqual({ jour: 21, mois: 12 });
  });

  it('jour ou nuit figés : l\'heure et la date ne bougent pas', () => {
    const h = new Horloge({ modeJournee: 'jour' }), heure = h.heure;
    h.update(5000);
    expect(h.heure).toBe(heure);
    expect(h.joursEcoules).toBe(0);
  });

  it('en mode cycle, la date suit la saison', () => {
    const h = new Horloge({ modeSaison: 'cycle' });
    h.update(SAISONS.duree * 1.5);
    expect(h.saison).toBe('printemps');
    const { mois } = h.date;
    expect(mois === 4 || mois === 5).toBe(true);
  });

  it('changer de mode en cours de partie ne fait pas sauter l\'éclairage', () => {
    const h = new Horloge({ modeJournee: 'jour' });
    const p = h.phase;
    h.setModeJournee('cycle');
    expect(h.phase).toBeCloseTo(p, 5);
    h.update(10);
    expect(h.phase).toBeGreaterThan(p);
    h.setModeJournee('nuit');
    expect(h.estJour).toBe(false);
  });

  it('passer des saisons figées au cycle repart de la saison affichée', () => {
    const h = new Horloge({ modeSaison: 'ete' });
    expect(h.fractionAnnee).toBeCloseTo(CLIMAT.saisonFigee.ete, 5);
    h.setModeSaison('cycle');
    expect(h.saison).toBe('ete');
    expect(h.fractionAnnee).toBeCloseTo(0.5, 5);
    h.update(SAISONS.duree);
    expect(h.saison).toBe('automne');
    h.setModeSaison('hiver');
    expect(h.saison).toBe('hiver');
  });

  it('une heure de jeu dure en moyenne 25 s', () => {
    expect(new Horloge().heuresDe(25)).toBeCloseTo(1, 5);
  });
});

