// Simulation de la météo : vent (calme, rafales localisées, vent soutenu) et ciel (dégagé, nuageux, brouillard,
// précipitations, tempête). Données pures (aucune dépendance au rendu) : le gameplay pourra s'en servir.
import { rng, type Rng } from '../gen/math';
import { CIEL, VENT, type Ciel, type ModeVent } from '../params/meteo';

/** Rafale : zone circulaire (m) où le vent souffle brièvement. */
export interface Rafale { x: number; z: number; R: number; age: number; duree: number; force: number }

/** Ce que la météo a besoin de connaître du reste du monde. */
export interface ContexteMeteo {
  /** Heures de jeu écoulées pendant ce pas. */
  heures: number;
  /** Chaleur de la saison (0 = cœur de l'hiver, 1 = cœur de l'été). */
  chaleur: number;
  /** Température (°C) à l'aire de la station : orage ou tempête de neige. */
  temperatureStation: number;
}

const MODES = Object.keys(VENT.episodes) as ModeVent[];
const CIELS = Object.keys(CIEL.episodes) as Ciel[];
/** Sans contexte (tests du vent) : hiver, 1 h de jeu = 25 s. */
const DEFAUT = (dt: number): ContexteMeteo => ({ heures: dt / 25, chaleur: 0, temperatureStation: -5 });

export class Meteo {
  mode: ModeVent = 'calme';
  readonly rafales: Rafale[] = [];
  /** Intensité (0–1) du vent continu, commune à toute la carte. */
  fond = 0;
  /** État du ciel et grandeurs lissées qui en découlent (0–1). */
  ciel: Ciel = 'degage';
  couverture = 0;
  brouillard = 0;
  precipitation = 0;
  /** Éclair en cours (1 au moment de l'éclair, puis décroît). */
  eclair = 0;
  private reste = 0;
  private resteCiel = 0;
  private prochaine = 0;
  private prochainEclair = 0;
  private t = 0;
  private readonly r: Rng;
  private readonly rc: Rng;

  /** L : côté de la carte (m). */
  constructor(seed: number, private readonly L: number) {
    this.r = rng(seed + 901);
    this.rc = rng(seed + 902);
    this.nouvelEpisode();
    this.nouveauCiel(0);
    const c = CIEL.cibles[this.ciel];
    this.couverture = c.couverture; this.brouillard = c.brouillard; this.precipitation = c.precipitation;
  }

  private entre([a, b]: readonly [number, number], r = this.r) { return a + (b - a) * r(); }

  private nouvelEpisode() {
    const total = MODES.reduce((s, m) => s + VENT.episodes[m].poids, 0);
    let x = this.r() * total;
    this.mode = MODES.find(m => (x -= VENT.episodes[m].poids) < 0) ?? 'calme';
    this.reste = this.entre(VENT.episodes[this.mode].duree);
  }

  /** Tire un nouvel état du ciel, différent du précédent ; poids et durées entre ceux de l'hiver et de l'été. */
  private nouveauCiel(chaleur: number) {
    const mix = (c: Ciel) => {
      const { hiver: h, ete: e } = CIEL.episodes[c];
      return { poids: h.poids + (e.poids - h.poids) * chaleur, duree: [h.duree[0] + (e.duree[0] - h.duree[0]) * chaleur, h.duree[1] + (e.duree[1] - h.duree[1]) * chaleur] as [number, number] };
    };
    const choix = CIELS.filter(c => c !== this.ciel || this.resteCiel === 0);
    const total = choix.reduce((s, c) => s + mix(c).poids, 0);
    let x = this.rc() * total;
    this.ciel = choix.find(c => (x -= mix(c).poids) < 0) ?? 'degage';
    this.resteCiel = this.entre(mix(this.ciel).duree, this.rc);
  }

  /** Orage (tempête chaude, avec éclairs) plutôt que tempête de neige. */
  estOrage(temperatureStation: number) { return this.ciel === 'tempete' && temperatureStation > CIEL.orageTemperature; }

  update(dt: number, ctx: ContexteMeteo = DEFAUT(dt)) {
    this.t += dt;

    // ciel : un épisode chasse l'autre, les grandeurs visibles glissent vers leur nouvelle valeur
    this.resteCiel -= ctx.heures;
    if (this.resteCiel <= 0) this.nouveauCiel(ctx.chaleur);
    const cible = CIEL.cibles[this.ciel], k = Math.min(1, ctx.heures / CIEL.transition);
    this.couverture += (cible.couverture - this.couverture) * k;
    this.brouillard += (cible.brouillard - this.brouillard) * k;
    this.precipitation += (cible.precipitation - this.precipitation) * k;

    // éclairs d'orage (temps réel)
    this.eclair = Math.max(0, this.eclair - dt / CIEL.eclairDuree);
    this.prochainEclair -= dt;
    if (this.estOrage(ctx.temperatureStation) && this.prochainEclair <= 0) {
      this.eclair = 1;
      this.prochainEclair = this.entre(CIEL.eclairIntervalle, this.rc);
    }

    // vent : épisodes propres, sauf en tempête où il souffle fort partout
    this.reste -= dt;
    if (this.reste <= 0) this.nouvelEpisode();
    const tempete = this.ciel === 'tempete' ? CIEL.ventTempete * Math.min(1, this.precipitation * 1.5) : 0;
    const cibleVent = Math.max(tempete, this.mode === 'soutenu'
      ? VENT.soutenu.intensite * (1 + VENT.soutenu.variation * Math.sin(this.t * 0.7) * Math.sin(this.t * 0.23 + 1))
      : 0);
    this.fond += (cibleVent - this.fond) * Math.min(1, dt / VENT.fondu);

    // rafales : les existantes s'éteignent d'elles-mêmes, de nouvelles naissent seulement en épisode de rafales
    for (let q = this.rafales.length - 1; q >= 0; q--) {
      const g = this.rafales[q];
      g.age += dt;
      if (g.age >= g.duree) this.rafales.splice(q, 1);
    }
    const R = VENT.rafales;
    this.prochaine -= dt;
    if (this.mode === 'rafales' && this.prochaine <= 0 && this.rafales.length < R.maxSimultanees) {
      this.rafales.push({ x: this.r() * this.L, z: this.r() * this.L, R: this.entre(R.rayon), age: 0, duree: this.entre(R.duree), force: this.entre(R.force) });
      this.prochaine = this.entre(R.intervalle);
    }
  }

  /** Intensité du vent (0–1) au point (x, z) en mètres. */
  intensiteEn(x: number, z: number) {
    let v = this.fond;
    for (const g of this.rafales) {
      const env = Math.sin((Math.PI * g.age) / g.duree);
      const d2 = ((x - g.x) ** 2 + (z - g.z) ** 2) / (g.R * g.R);
      v = Math.max(v, g.force * env * Math.exp(-d2));
    }
    return v;
  }
}
