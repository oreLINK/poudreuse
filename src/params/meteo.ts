// Paramètres de la météo. Durées en secondes réelles, distances en mètres.
// Le vent dominant vient de l'ouest (il souffle vers l'est) : les corniches sont générées en conséquence.

export type ModeVent = 'calme' | 'rafales' | 'soutenu';

export const VENT = {
  /**
   * Le vent alterne des épisodes. poids = probabilité relative d'être choisi, duree = [min, max].
   * - calme : pas de vent, aucune neige soufflée ;
   * - rafales : coups de vent brefs et localisés, qui balaient une partie des crêtes seulement ;
   * - soutenu : vent continu sur tous les sommets, d'intensité légèrement variable.
   */
  episodes: {
    calme:   { poids: 0.3, duree: [25, 60] },
    rafales: { poids: 0.5, duree: [40, 90] },
    soutenu: { poids: 0.2, duree: [20, 45] },
  } satisfies Record<ModeVent, { poids: number; duree: [number, number] }>,
  /** Durée (s) du fondu du vent continu au début et à la fin d'un épisode soutenu. */
  fondu: 4,
  rafales: {
    /** Temps entre deux rafales. */
    intervalle: [0.5, 2.5] as [number, number],
    /** Durée d'une rafale. */
    duree: [1.5, 4] as [number, number],
    /** Rayon de la zone balayée. */
    rayon: [1200, 3500] as [number, number],
    /** Force (0–1). */
    force: [0.6, 1] as [number, number],
    maxSimultanees: 4,
  },
  soutenu: {
    /** Intensité moyenne (0–1) et amplitude de ses variations. */
    intensite: 0.8,
    variation: 0.2,
  },
  /** Vitesse des particules de neige soufflée (unités 3D/s) à intensité maximale. */
  vitesse: [2.5, 5] as [number, number],
};

export const NUAGES = {
  /** Hauteur de la mer de nuages au-dessus de l'aire de la station. */
  hauteur: 320,
  /** Rayon de la trouée au-dessus de l'aire de la station, en fraction du rayon de l'aire (0 = pas de trouée). */
  troueeStation: 1.1,
};
