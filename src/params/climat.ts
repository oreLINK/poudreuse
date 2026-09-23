// Paramètres du climat : températures, limite pluie-neige, enneigement saisonnier.
// L'année est repérée par une fraction : 0 = 21 décembre (début de l'hiver), 0,25 ≈ 21 mars, 0,5 ≈ 21 juin, 0,75 ≈ 23 septembre.

export const CLIMAT = {
  /** Température moyenne (°C) à l'altitude de référence, et amplitude de l'écart entre hiver et été. */
  altitudeReference: 1500,
  temperatureMoyenne: 3.5,
  amplitudeAnnuelle: 9,
  /** Moment le plus froid de l'année (fraction) : mi-janvier. */
  plusFroid: 0.07,
  /** Écart jour-nuit (°C, ± autour de la moyenne), réduit par les nuages ; maximum vers 15 h. */
  amplitudeJour: 4,
  heureMax: 15,
  /** Baisse de température avec l'altitude (°C par mètre). */
  gradient: 0.0065,
  /** Refroidissement (°C) sous les nuages de précipitation et pendant les tempêtes. */
  froidPrecipitation: 1.5,
  froidTempete: 3,
  /** Il neige sous cette température (°C), il pleut au-dessus. */
  seuilNeige: 1,
  /** Fraction de l'année utilisée quand la saison est figée (milieu de saison). */
  saisonFigee: { hiver: 0.12, printemps: 0.37, ete: 0.62, automne: 0.87 },
};

export const ENNEIGEMENT = {
  /**
   * Limite de l'enneigement de saison (m) selon la fraction de l'année : sous cette altitude, le sol est déneigé
   * (hors neige fraîche). Points [fraction, altitude], interpolés.
   */
  limite: [[0, 1000], [0.2, 1050], [0.28, 1500], [0.36, 2100], [0.45, 2700], [0.55, 3100], [0.72, 3250], [0.8, 2700], [0.9, 1600], [1, 1000]] as [number, number][],
  /** La neige tient plus bas en ubac, moins bas en adret (m). */
  ecartUbac: 200,
  ecartAdret: 150,
  /** Épaisseur de neige de saison gagnée par mètre au-dessus de la limite, et plafond (m). */
  epaisseurParMetre: 0.0025,
  epaisseurMax: 3.5,
};

/**
 * Filtre « probabilité de neige » : chance qu'il neige au moins une fois sur un secteur pendant `horizon` jours,
 * en moyenne de saison (pas une prévision). Combine la fréquence des jours de précipitations (plus forte face au vent
 * d'ouest et en altitude, plus faible à l'abri sous le vent) et la chance que ces précipitations tombent en neige.
 */
export const PROBA_NEIGE = {
  horizon: 3,
  /** Part des jours avec précipitations, en hiver et en été (interpolée selon la chaleur de la saison). */
  frequenceHiver: 0.35,
  frequenceEte: 0.3,
  /** Effet du relief sur la fréquence : versant face au vent, versant sous le vent, gain par 1 000 m au-dessus de 2 000 m. */
  auVent: 0.25,
  sousLeVent: 0.2,
  altitude: 0.2,
  /** Écart type (°C) de la température d'un jour de précipitations autour de la moyenne de saison. */
  dispersion: 3.5,
  /** Plafond affiché (le filtre va de 0 à 99 %). */
  max: 0.99,
};
