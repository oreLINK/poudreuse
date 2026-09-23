// Écoulement d'une avalanche : particules qui dévalent le relief selon le modèle de Voellmy
// (frottement sec + turbulence), puis s'arrêtent en dépôt. Logique pure, en mètres, sans Three.js.
import { clamp, rng, type Rng } from '../gen/math';
import { altAt, gradAt } from '../gen/sol';
import type { Domain } from '../gen/types';
import { ECOULEMENT, type TypeAvalanche } from '../params/avalanches';
import type { Declenchement, Manteau } from './manteau';

const G = 9.81;

export class Avalanche {
  readonly type: TypeAvalanche;
  readonly n: number;
  /** Position (m), vitesse (m/s) et état de chaque particule : 1 = en mouvement, 0 = arrêtée en dépôt, 2 = sortie de la carte. */
  readonly x: Float32Array; readonly z: Float32Array; readonly vx: Float32Array; readonly vz: Float32Array;
  readonly etat: Uint8Array;
  /** Nuage d'aérosol : hauteur (m) au-dessus du cœur et densité (0–1) par particule. */
  readonly nuage: Float32Array; readonly densiteNuage: Float32Array;
  /** Secondes réelles écoulées ; fin de l'écoulement (s) ou -1 s'il est encore en cours. */
  age = 0;
  fin = -1;
  /** Vitesse maximale atteinte (m/s), point de rupture (m). */
  vitesseMax = 0;
  readonly departX: number; readonly departZ: number; readonly departAlt: number;
  private readonly r: Rng;
  private readonly epaisseurParParticule: number;

  constructor(private readonly d: Domain, dec: Declenchement, seed: number, private readonly manteau?: Manteau) {
    const { CELL, N } = d, W = N + 1, P = ECOULEMENT.types[dec.type];
    this.type = dec.type;
    this.r = rng(seed);
    this.n = Math.min(ECOULEMENT.particulesMax, Math.max(8, dec.cellules.length * P.particulesParCase));
    this.x = new Float32Array(this.n); this.z = new Float32Array(this.n); this.vx = new Float32Array(this.n); this.vz = new Float32Array(this.n);
    this.etat = new Uint8Array(this.n).fill(1);
    this.nuage = new Float32Array(this.n); this.densiteNuage = new Float32Array(this.n);
    for (let q = 0; q < this.n; q++) {
      // les particules partent de toute la zone de départ ; une coulée meuble part d'un seul point
      const k = dec.cellules[q % dec.cellules.length], i = k % W, j = (k - i) / W;
      const spread = dec.type === 'meuble' ? 0.15 : 0.5;
      this.x[q] = (i + (this.r() - 0.5) * 2 * spread) * CELL;
      this.z[q] = (j + (this.r() - 0.5) * 2 * spread) * CELL;
    }
    const k0 = dec.cellules[0], i0 = k0 % W;
    this.departX = i0 * CELL; this.departZ = ((k0 - i0) / W) * CELL; this.departAlt = d.h[k0];
    // la neige mise en mouvement est redéposée, répartie entre les particules
    this.epaisseurParParticule = dec.volume / this.n / (CELL * CELL);
  }

  get enCours() { return this.fin < 0; }
  /** L'avalanche et ses dépôts ont fini d'être affichés. */
  get terminee() { return this.fin >= 0 && this.age - this.fin > ECOULEMENT.persistanceDepot; }

  /** dt : secondes réelles. */
  update(dt: number) {
    this.age += dt;
    if (!this.enCours) return;
    const { d } = this, { CELL, N } = d, P = ECOULEMENT.types[this.type], E = ECOULEMENT;
    const steps = Math.max(1, Math.ceil(dt * E.acceleration * 20)), h = (dt * E.acceleration) / steps;
    let actives = 0;
    for (let s = 0; s < steps; s++) {
      actives = 0;
      for (let q = 0; q < this.n; q++) {
        if (this.etat[q] !== 1) continue;
        const fi = this.x[q] / CELL, fj = this.z[q] / CELL;
        if (fi < 0 || fj < 0 || fi > N || fj > N) { this.etat[q] = 2; continue; }
        const [gx, gz] = gradAt(d, fi, fj), gl = Math.hypot(gx, gz);
        const cos = 1 / Math.sqrt(1 + gl * gl), sin = gl * cos;
        const k = Math.round(fj) * (N + 1) + Math.round(fi);
        const mu = P.mu + (this.manteau?.estForet(k) ? E.frottementForet : 0) + (d.lake[k] ? 0.3 : 0);
        let vx = this.vx[q], vz = this.vz[q];
        const v = Math.hypot(vx, vz);
        // vitesse le long du terrain ; gravité dans la ligne de pente
        if (gl > 1e-6) { vx += (-gx / gl) * G * sin * h; vz += (-gz / gl) * G * sin * h; }
        // frottement sec et turbulence, opposés au mouvement
        if (v > 1e-3) {
          const dec = (G * mu * cos + (G * v * v) / (P.xi * P.epaisseur)) * h;
          const nv = Math.hypot(vx, vz), f = Math.max(0, nv - dec) / (nv || 1);
          vx *= f; vz *= f;
        }
        // étalement latéral : la coulée s'élargit en descendant (en cône pour la neige meuble)
        const w = (this.type === 'meuble' ? 0.25 : 0.12) * Math.min(v, 20) * h;
        vx += (this.r() - 0.5) * w; vz += (this.r() - 0.5) * w;
        const nv = Math.hypot(vx, vz);
        if (nv < E.vitesseArret && sin - mu * cos < 0.02) {
          this.etat[q] = 0;
          this.manteau?.deposer(this.x[q], this.z[q], this.epaisseurParParticule);
          continue;
        }
        this.vx[q] = vx; this.vz[q] = vz;
        this.x[q] += vx * cos * h; this.z[q] += vz * cos * h;   // déplacement projeté à l'horizontale
        if (nv > this.vitesseMax) this.vitesseMax = nv;
        // aérosol : un nuage de neige en suspension monte au-dessus du cœur rapide, puis retombe
        if (this.type === 'aerosol') {
          const vise = nv > E.nuageVitesse ? clamp((nv - E.nuageVitesse) * 4, 0, 120) : 0;
          this.nuage[q] += (vise - this.nuage[q]) * Math.min(1, h * 0.8);
          this.densiteNuage[q] = clamp(this.nuage[q] / 60, 0, 1);
        }
        actives++;
      }
      if (!actives) break;
    }
    if (!actives || this.age > E.dureeMax) this.fin = this.age;
  }

  /** Altitude du sol (m) sous une particule. */
  altitude(q: number) { return altAt(this.d, this.x[q] / this.d.CELL, this.z[q] / this.d.CELL); }
}
