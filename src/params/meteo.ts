// Paramètres de la météo. Durées en secondes réelles, distances en mètres.
// Le vent dominant vient de l'ouest (il souffle vers l'est) : les corniches sont générées en conséquence.

export type ModeVent = 'calme' | 'rafales' | 'soutenu';
/** État du ciel. « tempete » = tempête de neige quand il fait froid, orage quand il fait chaud. */
export type Ciel = 'degage' | 'nuageux' | 'brouillard' | 'precipitations' | 'tempete';

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

/**
 * Ciel : épisodes tirés au sort, durées en heures de jeu (1 h ≈ 25 s réelles).
 * Poids et durées interpolés entre l'hiver et l'été selon la chaleur de la saison.
 */
export const CIEL = {
  episodes: {
    degage:         { hiver: { poids: 0.3,  duree: [6, 20] }, ete: { poids: 0.35, duree: [6, 20] } },
    nuageux:        { hiver: { poids: 0.25, duree: [3, 10] }, ete: { poids: 0.25, duree: [3, 10] } },
    brouillard:     { hiver: { poids: 0.12, duree: [2, 6] },  ete: { poids: 0.08, duree: [2, 5] } },
    precipitations: { hiver: { poids: 0.23, duree: [3, 12] }, ete: { poids: 0.17, duree: [2, 8] } },
    tempete:        { hiver: { poids: 0.1,  duree: [6, 14] }, ete: { poids: 0.15, duree: [1, 3] } },
  } satisfies Record<Ciel, Record<'hiver' | 'ete', { poids: number; duree: [number, number] }>>,
  /** Couverture nuageuse (0–1), brouillard (0–1) et intensité des précipitations (0–1) visées par chaque état. */
  cibles: {
    degage:         { couverture: 0.05, brouillard: 0, precipitation: 0 },
    nuageux:        { couverture: 0.7,  brouillard: 0, precipitation: 0 },
    brouillard:     { couverture: 0.8,  brouillard: 1, precipitation: 0 },
    precipitations: { couverture: 0.9,  brouillard: 0.2, precipitation: 0.5 },
    tempete:        { couverture: 1,    brouillard: 0.45, precipitation: 1 },
  } satisfies Record<Ciel, { couverture: number; brouillard: number; precipitation: number }>,
  /** Temps (heures de jeu) pour passer d'un état à l'autre. */
  transition: 0.6,
  /** Tempête : le vent souffle fort partout. */
  ventTempete: 1,
  /** Orage : éclairs (s réelles entre deux éclairs), seulement au-dessus de cette température à la station (°C). */
  eclairIntervalle: [1.5, 7] as [number, number],
  orageTemperature: 5,
  /** Durée (s réelles) d'un éclair. */
  eclairDuree: 0.35,
};

/** Précipitations affichées : particules autour du centre de la vue. */
export const PRECIPITATIONS = {
  particules: 5000,
  /** Vitesse de chute (unités 3D par s) de la neige et de la pluie, dérive due au vent. */
  chuteNeige: 1.6,
  chutePluie: 14,
  deriveVent: 5,
};
