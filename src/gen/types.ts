/** Point d'un fond de vallée : x, z (m) et altitude du fond (m). */
export type ValleyPoint = [number, number, number];

export interface Valley {
  id: number;
  pts: ValleyPoint[];
  w: number;          // demi-largeur du fond (m)
  level: number;      // 0 = vallée maîtresse, 1..3 = affluents, 4 = col
  parent?: number;
}

export interface Network {
  valleys: Valley[];
  lakes: { x: number; z: number; R: number }[];
  cols: { x: number; z: number; alt: number }[];
}

/** Point de rivière : i, j (case), surface drainée (en cases), altitude (m). */
export type RiverPoint = [number, number, number, number];

export interface Domain {
  seed: number;
  N: number;          // nombre de cases par côté
  CELL: number;       // taille d'une case (m)
  L: number;          // côté de la carte (m)
  h: Float32Array;    // altitudes (N+1)², en m
  lake: Uint8Array;   // 1 = surface de lac gelé
  isRiver: Uint8Array;
  rivers: RiverPoint[][];
  /** Aire plate où le joueur bâtit son village de ski : centre (m), altitude (m) et rayon (m). */
  station: { x: number; z: number; alt: number; R: number };
}
