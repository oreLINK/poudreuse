// Paramètres de l'aire de la station : le terrain plat où le joueur bâtit son village de ski.
import type { SizeKey } from './monde';

export const STATION = {
  /** Rayon (m) de l'aire plate, proportionnel à la taille de la carte. Une seule aire par carte. */
  rayon: { petit: 700, moyen: 950, grand: 1250, immense: 1600 } satisfies Record<SizeKey, number>,
  /**
   * Nombre de sites, parmi les plus bas de la carte, entre lesquels choisir celui qui demande le moins de terrassement.
   * 1 = toujours le site le plus bas.
   */
  candidats: { petit: 1, moyen: 3, grand: 4, immense: 5 } satisfies Record<SizeKey, number>,
  /** Largeur du talus qui raccorde l'aire au relief, en fraction du rayon. */
  talus: 0.5,
  /** Pente (%) de l'aire dans son sens naturel, bornée pour que l'eau s'écoule sans gêner la construction. */
  penteLongMin: 1.5,
  penteLongMax: 2.5,
  /** Léger dévers (%) vers un bord : les torrents longent l'aire au lieu de la couper en deux. */
  devers: 1.5,
  /** Distance minimale (fraction du côté de carte) entre le centre de l'aire et le bord de la carte. */
  bordMin: 0.08,
};
