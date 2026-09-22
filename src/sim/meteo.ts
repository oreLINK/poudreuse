// Simulation du vent : épisodes de calme, de rafales localisées ou de vent soutenu.
// Données pures (aucune dépendance au rendu) : le futur gameplay pourra s'en servir (fermeture des remontées).
import { rng, type Rng } from '../gen/math';
import { VENT, type ModeVent } from '../params/meteo';

/** Rafale : zone circulaire (m) où le vent souffle brièvement. */
export interface Rafale { x: number; z: number; R: number; age: number; duree: number; force: number }

const MODES = Object.keys(VENT.episodes) as ModeVent[];

export class Meteo {
  mode: ModeVent = 'calme';
  readonly rafales: Rafale[] = [];
  /** Intensité (0–1) du vent continu, commune à toute la carte. */
  fond = 0;
  private reste = 0;
  private prochaine = 0;
  private t = 0;
  private readonly r: Rng;

  /** L : côté de la carte (m). */
  constructor(seed: number, private readonly L: number) {
    this.r = rng(seed + 901);
    this.nouvelEpisode();
  }

  private entre([a, b]: readonly [number, number]) { return a + (b - a) * this.r(); }

  private nouvelEpisode() {
    const total = MODES.reduce((s, m) => s + VENT.episodes[m].poids, 0);
    let x = this.r() * total;
    this.mode = MODES.find(m => (x -= VENT.episodes[m].poids) < 0) ?? 'calme';
    this.reste = this.entre(VENT.episodes[this.mode].duree);
  }

  update(dt: number) {
    this.t += dt;
    this.reste -= dt;
    if (this.reste <= 0) this.nouvelEpisode();

    // vent continu : monte et retombe en fondu, avec de lentes variations
    const cible = this.mode === 'soutenu'
      ? VENT.soutenu.intensite * (1 + VENT.soutenu.variation * Math.sin(this.t * 0.7) * Math.sin(this.t * 0.23 + 1))
      : 0;
    this.fond += (cible - this.fond) * Math.min(1, dt / VENT.fondu);

    // rafales : les existantes s'éteignent d'elles-mêmes, de nouvelles naissent seulement en épisode de rafales
    for (let k = this.rafales.length - 1; k >= 0; k--) {
      const g = this.rafales[k];
      g.age += dt;
      if (g.age >= g.duree) this.rafales.splice(k, 1);
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
