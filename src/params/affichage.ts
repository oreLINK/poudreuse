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
  /** Orange léger. */
  couleur: '#f5b574',
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
