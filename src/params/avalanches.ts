// Paramètres du manteau neigeux et des avalanches. Durées en heures de jeu (1 h ≈ 25 s réelles), épaisseurs en mètres.

export type TypeAvalanche = 'plaque' | 'aerosol' | 'humide' | 'meuble';

export const MANTEAU = {
  /** Neige fraîche (m par heure de jeu) sous une précipitation d'intensité 1 (tempête). */
  chuteMax: 0.05,
  /** Tassement de la neige fraîche et des plaques (par heure), accéléré par la chaleur. */
  tassementFrais: 0.025,
  tassementPlaque: 0.008,
  /** Fonte (m par heure et par °C au-dessus de 0). */
  fonte: 0.004,
  /** Humidification (par heure et par °C) et regel au-dessous de -2 °C (par heure). Une pluie sur la neige l'humidifie aussitôt. */
  humidification: 0.05,
  humidificationPluie: 8,
  regel: 0.1,
  /** Transport par le vent : part de la neige fraîche reprise par heure à vent maximal, déposée en plaques sous le vent (× dépôt). */
  transport: 0.08,
  depotSousLeVent: 1.3,
  /** Givre de surface : se forme par nuit claire et froide (sous cette température), puis devient une couche fragile quand il est enfoui. */
  givreTemperature: -5,
  givreParHeure: 0.08,
  /** Enfouissement complet du givre sous cette épaisseur de neige fraîche (m). */
  givreEnfoui: 0.05,
  /** Disparition lente de la couche fragile (par heure). */
  disparitionFragile: 0.004,
  /** Fonte des dépôts d'avalanche (fraction de la fonte ordinaire). */
  fonteDepot: 0.5,
};

export const RISQUE = {
  /** Pentes propices aux avalanches (degrés) : rien sous `min`, maximum entre `pleinDebut` et `pleinFin`, puis la neige purge d'elle-même. */
  penteMin: 27,
  pleinDebut: 32,
  pleinFin: 45,
  penteMax: 60,
  /** Facteur résiduel sur les pentes très raides (coulées fréquentes mais petites). */
  tresRaide: 0.3,
  /** Pas de risque sous cette épaisseur totale de neige (m). */
  neigeMin: 0.15,
  /** Contributions à l'instabilité : neige fraîche et plaques (épaisseur de référence en m), couche fragile, humidité. */
  refFrais: 0.35,
  refPlaque: 0.25,
  base: 0.1,
  poidsFragile: 1.2,
  poidsHumide: 1.6,
  /** La forêt ancre le manteau neigeux. */
  facteurForet: 0.3,
  /** Seuils d'instabilité entre les niveaux 1 → 2 → 3 → 4 → 5. Niveau 0 : pas de neige ou pente trop faible. */
  seuils: [0.35, 0.7, 1.1, 1.6],
  /** Couleurs du filtre : niveaux 1 à 5 (le niveau 0 n'est pas coloré). */
  couleurs: ['#3fae5a', '#f2d23c', '#f29233', '#d8403a', '#8e44b8'],
};

export const DECLENCHEMENT = {
  /** Instabilité au-delà de laquelle une rupture naturelle devient possible, et probabilité par case et par heure (× dépassement). */
  seuil: 1.25,
  taux: 0.002,
  /** Coulées meubles : pentes très raides (degrés) chargées de neige fraîche (m), probabilité par case et par heure. */
  meublePente: 40,
  meubleFrais: 0.15,
  meubleTaux: 0.0008,
  /** Nombre maximal d'avalanches en mouvement en même temps. */
  maxSimultanees: 3,
  /** Extension maximale de la zone de départ (cases) par type. */
  tailleMax: { plaque: 12, aerosol: 25, humide: 3, meuble: 1 } satisfies Record<TypeAvalanche, number>,
  /** Une plaque se propage aux cases voisines de pente ≥ penteMin dont l'instabilité dépasse cette fraction de celle du point de départ. */
  propagation: 0.55,
  /** Aérosol : plaque sèche et froide, grosse charge, grande dénivelée sous le départ. */
  aerosolTemperature: -4,
  aerosolCharge: 0.5,
  aerosolDenivele: 800,
  /** Neige humide dès cette humidité (0–1). */
  humide: 0.5,
};

/**
 * Écoulement (modèle de Voellmy) : frottement sec μ, turbulence ξ (m/s²), épaisseur de l'écoulement (m).
 * Vitesses limites obtenues sur une pente de 35° : meuble ~45 km/h, humide ~50 km/h, plaque ~110 km/h, aérosol ~220 km/h.
 */
export const ECOULEMENT = {
  types: {
    plaque:  { mu: 0.2,  xi: 1500, epaisseur: 1.5, particulesParCase: 40 },
    aerosol: { mu: 0.12, xi: 4000, epaisseur: 2,   particulesParCase: 30 },
    humide:  { mu: 0.3,  xi: 300,  epaisseur: 2,   particulesParCase: 50 },
    meuble:  { mu: 0.25, xi: 800,  epaisseur: 0.6, particulesParCase: 60 },
  } satisfies Record<TypeAvalanche, { mu: number; xi: number; epaisseur: number; particulesParCase: number }>,
  /** Frottement supplémentaire en forêt. */
  frottementForet: 0.15,
  /** Accélération de l'animation (1 = temps réel de l'avalanche). */
  acceleration: 2,
  /** Arrêt sous cette vitesse (m/s) quand la pente ne suffit plus à entretenir le mouvement. */
  vitesseArret: 0.8,
  /** Durée maximale de l'écoulement et durée d'affichage des dépôts (s réelles). */
  dureeMax: 240,
  persistanceDepot: 90,
  /** Nombre maximal de particules par avalanche. */
  particulesMax: 700,
  /** Aérosol : nuage émis au-dessus du cœur dense au-delà de cette vitesse (m/s). */
  nuageVitesse: 18,
};
