// Catalogue des bâtiments que le joueur peut construire.
// Les dimensions sont exprimées en « arbres » (diamètre moyen d'un arbre affiché, voir OBJETS dans affichage.ts),
// pour qu'un bâtiment garde la même taille apparente quelle que soit la carte.

export interface TypeBatiment {
  nom: string;
  /** Emprise au sol, en arbres (largeur × profondeur, avant rotation). */
  largeur: number;
  profondeur: number;
  /** Hauteur des murs et du faîtage, en arbres. */
  hauteurMurs: number;
  hauteurToit: number;
  /** Pente maximale (%) acceptée sous chaque partie de l'emprise. */
  penteMax: number;
}

export const BATIMENTS = {
  maisonnette: { nom: 'Maisonnette', largeur: 3, profondeur: 2, hauteurMurs: 0.8, hauteurToit: 0.6, penteMax: 8 },
} satisfies Record<string, TypeBatiment>;
export type CleBatiment = keyof typeof BATIMENTS;

export const CONSTRUCTION = {
  /** Finesse du contrôle de l'emprise : nombre de cases vertes / rouges par arbre de côté. */
  casesParArbre: 2,
  /** Marge (en arbres) où les arbres sont abattus autour d'un bâtiment construit. */
  abattage: 0.3,
};
