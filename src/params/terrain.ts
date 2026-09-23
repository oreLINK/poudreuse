// Paramètres du relief généré. Toutes les distances et altitudes sont en mètres.
// Modifier ces valeurs change les cartes produites par une même graine : relancer `npm test`.
//
// Le relief est d'abord construit dans un repère de référence (point bas vers 850–1 150 m) : les altitudes
// de RELIEF et de LACS, comme les fonds de vallée de gen/network.ts, s'expriment dans ce repère.
// ALTITUDE relève ensuite toute la carte d'un même décalage, sans changer les pentes.

export const ALTITUDE = {
  /** Le point bas de la carte est tiré au hasard dans cet intervalle : de la station de moyenne montagne à la station d'altitude. */
  pointBas: [1300, 2000] as [number, number],
  /** Plafond des sommets : sur un relief très haut, le point bas est abaissé (sans passer sous pointBas[0]) pour rester réaliste. */
  sommetMax: 4800,
};

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
  /** Au-delà de ce seuil (repère de référence), les altitudes sont tassées pour rester réalistes. */
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
  /** Pas de lac d'altitude sous ce niveau (repère de référence, avant relèvement). */
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
