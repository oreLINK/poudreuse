// Paramètres du monde : tailles de carte et échelle d'affichage.
// Données pures (aucune dépendance) : lisibles par la génération comme par le rendu.

/**
 * Chaque taille double la surface de la précédente. CELL = maille du terrain (m).
 * rang : hauteur des massifs, nombre et taille des pics rocheux (0 = référence, l'ancien « Petit » de 18 km).
 */
export const SIZES = {
  petit:   { km: 12.7, CELL: 58,  rang: -1 },
  moyen:   { km: 18,   CELL: 70,  rang: 0 },
  grand:   { km: 25.5, CELL: 85,  rang: 1 },
  immense: { km: 36,   CELL: 106, rang: 2 },
} as const;
export type SizeKey = keyof typeof SIZES;
export const SIZE_KEYS = Object.keys(SIZES) as SizeKey[];
export const DEFAULT_SIZE: SizeKey = 'moyen';

/** Passage des mètres à la scène 3D. */
export const ECHELLE = {
  /** 1 unité 3D = UNIT mètres au sol. */
  UNIT: 60,
  /** Exagération verticale, pour la lisibilité du relief. */
  VEX: 1.3,
  /** Altitude (m) placée à y = 0. */
  ALT0: 1600,
};
