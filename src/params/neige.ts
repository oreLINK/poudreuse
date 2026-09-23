// Paramètres de l'enneigement affiché : où la roche perce, corniches, traces.
// L'épaisseur de neige elle-même (saison, chutes, fonte) est simulée : voir climat.ts et avalanches.ts.

export const NEIGE = {
  /** Pente (%) au-delà de laquelle la neige ne tient plus, pour une maille de 70 m (le seuil baisse sur les grandes mailles). */
  rocheSeuil: 100,
  /**
   * Début des barres rocheuses, en fraction du seuil : entre ce point et le seuil, les faces raides
   * alternent nervures rocheuses et couloirs de neige au lieu d'être uniformément blanches.
   */
  rocheDebut: 0.55,
  /** Sensibilité au relief : plus la valeur est basse, plus les nervures convexes sont rocheuses et les couloirs concaves enneigés. */
  nervure: 0.5,
  /** Échelle (m) sur laquelle on mesure nervures et couloirs. */
  lissageNervures: 160,
  /** Taille (m) des plaques qui rendent les barres rocheuses irrégulières. */
  plaque: 350,
  /** Au-dessus de cette altitude, le vent et le froid décapent les faces : le seuil de roche baisse… */
  decapageAlt: 3300,
  /** … jusqu'à cette fraction, atteinte 1 000 m plus haut. */
  decapageMax: 0.25,
  /** Corniches sur les crêtes au-dessus de cette altitude. */
  cornicheAlt: 2800,
  /** Traces de freeride dans les combes nord au-dessus de cette altitude. */
  freerideAlt: 2600,
};
