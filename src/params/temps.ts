// Paramètres du temps qui passe : journée, nuit, saisons. Durées en secondes réelles.

export type ModeJournee = 'cycle' | 'jour' | 'nuit';
export type Saison = 'hiver' | 'printemps' | 'ete' | 'automne';
export type ModeSaison = 'cycle' | Saison;

export const TEMPS = {
  /** Durée du jour (du lever au coucher) et de la nuit. */
  dureeJour: 300,
  dureeNuit: 300,
  /** 'cycle' = jour et nuit s'enchaînent ; 'jour' ou 'nuit' = l'éclairage reste figé sur phaseJour ou phaseNuit. */
  modeJournee: 'cycle' as ModeJournee,
  /**
   * Repères de la palette d'éclairage (render/dayCycle.ts), en phase : 0 = minuit, 0,5 ≈ midi.
   * Le jour va du lever au coucher du soleil, la nuit du coucher au lever suivant.
   */
  lever: 0.03,
  coucher: 0.8,
  /** Moment de la journée au lancement (phase). */
  phaseDepart: 0.1,
  /** Phases utilisées en mode 'jour' et 'nuit'. */
  phaseJour: 0.3,
  phaseNuit: 0.95,
  /** Moment figé quand l'utilisateur demande de réduire les animations. */
  phaseFigee: 0.16,
};

export const SAISONS = {
  /** Ordre des saisons dans l'année. */
  ordre: ['hiver', 'printemps', 'ete', 'automne'] as Saison[],
  /** Durée d'une saison. */
  duree: 1200,
  /** 'cycle' = les saisons s'enchaînent ; sinon la saison indiquée reste en place. Seul l'hiver est affiché pour l'instant. */
  mode: 'hiver' as ModeSaison,
  /** Saison au lancement en mode 'cycle'. */
  depart: 'hiver' as Saison,
  /**
   * Calendrier affiché par l'horloge : premier jour de la saison [jour, mois] et heures (décimales) du lever
   * et du coucher du soleil, qui donnent l'heure affichée pendant le jour et la nuit (Alpes du Nord).
   * Saison figée : la date avance d'un jour à chaque minuit et reprend au début de la saison à sa fin.
   * Mode 'cycle' : une saison dure bien moins de jours de jeu que de jours réels, la date parcourt donc la saison par sauts.
   */
  calendrier: {
    hiver:     { debut: [21, 12], lever: 7.75, coucher: 17.25 },
    printemps: { debut: [20, 3],  lever: 6.75, coucher: 19.25 },
    ete:       { debut: [21, 6],  lever: 5.75, coucher: 21.5 },
    automne:   { debut: [23, 9],  lever: 7.5,  coucher: 19.5 },
  } satisfies Record<Saison, { debut: [number, number]; lever: number; coucher: number }>,
  /** Noms affichés. */
  noms: { hiver: 'Hiver', printemps: 'Printemps', ete: 'Été', automne: 'Automne' } satisfies Record<Saison, string>,
};
