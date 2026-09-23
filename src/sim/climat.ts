// Climat : températures selon la saison, l'heure et l'altitude ; enneigement de saison ; probabilité de neige.
// Fonctions pures, sans Three.js.
import { CLIMAT, ENNEIGEMENT, PROBA_NEIGE } from '../params/climat';

/** Contexte climatique à un instant : moment de l'année (0 = 21 décembre), heure, nuages et état du ciel. */
export interface Contexte {
  fraction: number;
  heure: number;
  couverture: number;
  /** Intensité des précipitations (0–1) et tempête en cours. */
  precipitation: number;
  tempete: boolean;
}

export const CONTEXTE_HIVER: Contexte = { fraction: CLIMAT.saisonFigee.hiver, heure: 12, couverture: 0, precipitation: 0, tempete: false };

/** Température moyenne (°C) de la saison à l'altitude de référence. */
export function temperatureSaison(fraction: number) {
  return CLIMAT.temperatureMoyenne - CLIMAT.amplitudeAnnuelle * Math.cos(2 * Math.PI * (fraction - CLIMAT.plusFroid));
}

/** Chaleur de la saison (0 = cœur de l'hiver, 1 = cœur de l'été). */
export function chaleurSaison(fraction: number) {
  return (1 - Math.cos(2 * Math.PI * (fraction - CLIMAT.plusFroid))) / 2;
}

/** Température (°C) à une altitude (m). */
export function temperature(alt: number, c: Contexte) {
  const jour = CLIMAT.amplitudeJour * (1 - 0.6 * c.couverture) * Math.cos((2 * Math.PI * (c.heure - CLIMAT.heureMax)) / 24);
  const froid = c.precipitation * CLIMAT.froidPrecipitation + (c.tempete ? CLIMAT.froidTempete : 0);
  return temperatureSaison(c.fraction) + jour - froid - CLIMAT.gradient * (alt - CLIMAT.altitudeReference);
}

/** Altitude (m) de la limite pluie-neige : il neige au-dessus. */
export function limitePluieNeige(c: Contexte) {
  return CLIMAT.altitudeReference + (temperature(CLIMAT.altitudeReference, c) - CLIMAT.seuilNeige) / CLIMAT.gradient;
}

/** Limite de l'enneigement de saison (m), avant l'effet de l'exposition. */
export function limiteEnneigement(fraction: number) {
  const pts = ENNEIGEMENT.limite, f = ((fraction % 1) + 1) % 1;
  for (let k = 0; k < pts.length - 1; k++) {
    const [f0, a0] = pts[k], [f1, a1] = pts[k + 1];
    if (f >= f0 && f <= f1) return a0 + ((a1 - a0) * (f - f0)) / (f1 - f0 || 1);
  }
  return pts[0][1];
}

/** Épaisseur (m) de la neige de saison. nord : +1 en ubac, -1 en adret. */
export function neigeSaison(alt: number, nord: number, fraction: number) {
  const lim = limiteEnneigement(fraction) - (nord > 0 ? nord * ENNEIGEMENT.ecartUbac : nord * ENNEIGEMENT.ecartAdret);
  return Math.min(ENNEIGEMENT.epaisseurMax, Math.max(0, (alt - lim) * ENNEIGEMENT.epaisseurParMetre));
}

/** Fonction de répartition de la loi normale centrée réduite (approximation d'Abramowitz et Stegun). */
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const p = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const n = 1 - 0.3989422804 * Math.exp((-x * x) / 2) * p;
  return x >= 0 ? n : 1 - n;
}

/**
 * Probabilité (0–0,99) qu'il neige au moins une fois sur un secteur pendant PROBA_NEIGE.horizon jours, selon la saison,
 * l'altitude et l'exposition (ouest : +1 face au vent dominant, -1 sous le vent). Moyenne de saison, pas une prévision.
 */
export function probabiliteNeige(alt: number, ouest: number, fraction: number) {
  const P = PROBA_NEIGE, chaleur = chaleurSaison(fraction);
  const relief = 1 + P.auVent * Math.max(0, ouest) - P.sousLeVent * Math.max(0, -ouest) + P.altitude * Math.max(0, (alt - 2000) / 1000);
  const frequence = Math.min(1, (P.frequenceHiver + (P.frequenceEte - P.frequenceHiver) * chaleur) * relief);
  const t = temperatureSaison(fraction) - CLIMAT.froidPrecipitation - CLIMAT.gradient * (alt - CLIMAT.altitudeReference);
  const jour = frequence * phi((CLIMAT.seuilNeige - t) / P.dispersion);
  return Math.min(P.max, 1 - Math.pow(1 - jour, P.horizon));
}
