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
