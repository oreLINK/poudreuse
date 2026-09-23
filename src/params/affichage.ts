// Paramètres de la caméra et de la taille des objets à l'écran.
import { ECHELLE } from './monde';

export const CAMERA = {
  /** Zoom au chargement d'une carte (1 = carte entière visible). */
  zoomInitial: 1.4,
  zoomMin: 0.8,
  /** Zoom maximal : le plus grand de `zoomMax` et de (largeur de carte / `zoomMaxParLargeur`). */
  zoomMax: 8,
  zoomMaxParLargeur: 14,
  /** Sensibilité de la molette. */
  molette: 0.0015,
};

export const OBJETS = {
  /** Grossissement des arbres et des bâtiments, pour qu'ils restent lisibles et faciles à viser. */
  echelle: 1.4,
  /** Diamètre moyen d'un arbre avant grossissement (unités 3D) : l'unité de mesure des bâtiments. */
  arbre: 1.13,
};

/** Diamètre moyen d'un arbre affiché, en mètres au sol. */
export const ARBRE_M = OBJETS.arbre * OBJETS.echelle * ECHELLE.UNIT;

/** Filtre topographique : courbes de niveau dessinées sur le relief. */
export const TOPO = {
  /** Écart d'altitude (m) entre deux courbes. */
  equidistance: 10,
  /** Une courbe maîtresse, plus marquée, toutes les N mètres. */
  maitresse: 100,
  /**
   * Couleur selon l'éclairage : brun-ocre foncé sur la neige éclairée, crème lumineux la nuit (non assombri par l'éclairage),
   * mélange au crépuscule.
   * Bleu, vert, rouge et noir sont réservés aux pistes, violet au risque d'avalanche.
   */
  couleurJour: '#7a4f24',
  couleurNuit: '#d9c49a',
  /** Intensité relative des courbes la nuit (lumineuses sur fond sombre, elles ressortent plus que de jour). */
  intensiteNuit: 0.6,
  /** Intensité des courbes ordinaires et des courbes maîtresses (0–1). */
  opacite: 0.5,
  opaciteMaitresse: 0.7,
  /** Épaisseur (pixels écran). */
  epaisseur: 1,
  epaisseurMaitresse: 1.5,
  /** Écart minimal (pixels) entre deux courbes : en dessous, elles s'estompent pour ne pas former d'aplat (elles reviennent en zoomant). */
  ecartMin: 9,
  /** Au-dessous de cet écart (pixels), les courbes maîtresses s'allègent jusqu'à `vueEnsemble` × leur intensité. */
  ecartConfort: 40,
  vueEnsemble: 0.35,
  /** Durée (s) du fondu à l'activation. */
  fondu: 0.25,
};

/** Calques colorés du menu « Filtres » (un seul à la fois). Couleurs du risque : RISQUE.couleurs dans avalanches.ts. */
export const CALQUES = {
  /** Intensité du calque de risque d'avalanche (niveaux 1 à 5 ; le niveau 0 n'est pas coloré). */
  opaciteRisque: 0.6,
  /** Probabilité de neige : blanc à 0 %, bleu à 99 %. */
  probaMin: '#ffffff',
  probaMax: '#1f5fd0',
  opaciteProba: 0.75,
  /** Luminosité des calques la nuit (ils restent lisibles sur le relief sombre). */
  intensiteNuit: 0.75,
  /** Durée (s) du fondu à l'activation. */
  fondu: 0.25,
};
