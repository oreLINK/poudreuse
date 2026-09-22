// Paramètres du relief généré. Toutes les distances et altitudes sont en mètres.
// Modifier ces valeurs change les cartes produites par une même graine : relancer `npm test`.

/** Caractère des massifs : hauteur des versants, largeur, finesse des crêtes, rugosité, aiguilles. */
export const TYPES = {
  alpin:      { H: 1750, lam: 2100, k: 160, rough: 0.5,  needle: 0 },
  cristallin: { H: 2200, lam: 1650, k: 70,  rough: 0.9,  needle: 1 },
  ancien:     { H: 700,  lam: 2400, k: 480, rough: 0.15, needle: 0 },
  volcan:     { H: 1150, lam: 2200, k: 220, rough: 0.3,  needle: 0 },
} as const;
export type TypeKey = keyof typeof TYPES;

export const RELIEF = {
  /** Hausse de la hauteur des massifs par rang de taille (+9 % par rang). */
  hausseParRang: 0.09,
  /** Au-delà de ce seuil, les altitudes sont tassées pour rester réalistes. */
  tassementSeuil: 3900,
  tassementFacteur: 0.55,
};

export const PICS = {
  /** Irrégularité des faces des pics (0 = pyramides lisses, qui ressemblent à des toits). */
  rugosite: 0.45,
};

export const EROSION = {
  /** Nombre de gouttes simulées par case. */
  gouttesParCase: 0.7,
};

export const LACS = {
  /** Pas de lac d'altitude sous ce niveau. */
  altitudeMin: 1750,
};

/** Classes de pente (en %), du replat à la paroi non skiable. */
export const CLASSES = [
  { key: 'plat',  max: 5 },
  { key: 'vert',  max: 25 },
  { key: 'bleu',  max: 40 },
  { key: 'rouge', max: 55 },
  { key: 'noir',  max: 100 },
  { key: 'roche', max: Infinity },
] as const;
export type SlopeClass = (typeof CLASSES)[number]['key'];
export const classOf = (pct: number): SlopeClass => CLASSES.find(c => pct < c.max)!.key;
