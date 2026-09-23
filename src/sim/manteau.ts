// Manteau neigeux : une colonne de neige par sommet de grille, qui évolue avec la météo.
// Couches suivies : neige de saison (fonction du climat), neige fraîche, plaques à vent, dépôts d'avalanche,
// humidité, givre de surface et couche fragile enfouie. En découlent l'instabilité, le niveau de risque (0–5)
// et les déclenchements naturels d'avalanches. Logique pure, sans Three.js.
import { clamp, rng, smooth, type Rng } from '../gen/math';
import type { Domain } from '../gen/types';
import { DECLENCHEMENT, MANTEAU, RISQUE, type TypeAvalanche } from '../params/avalanches';
import { CLIMAT } from '../params/climat';
import { FORET } from '../params/vegetation';
import { neigeSaison, probabiliteNeige, temperature, type Contexte } from './climat';
import type { Meteo } from './meteo';

/** Zone de départ d'une avalanche. */
export interface Declenchement {
  type: TypeAvalanche;
  /** Indices des sommets de grille de la zone de départ ; le premier est le point de rupture. */
  cellules: number[];
  /** Volume de neige mis en mouvement (m³). */
  volume: number;
}

const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

export class Manteau {
  readonly W: number;
  // état
  readonly frais: Float32Array; readonly plaque: Float32Array; readonly depot: Float32Array;
  readonly humide: Float32Array; readonly givre: Float32Array; readonly fragile: Float32Array;
  // résultats
  readonly epaisseur: Float32Array; readonly instabilite: Float32Array; readonly niveau: Uint8Array;
  readonly probaNeige: Float32Array;
  /** Carte pour le rendu, 4 octets par sommet : enneigement, niveau de risque × 51, probabilité de neige, humidité. */
  readonly carte: Uint8Array<ArrayBuffer>;
  // terrain, précalculé
  private readonly pente: Float32Array; private readonly nord: Float32Array; private readonly ouest: Float32Array;
  private readonly foret: Uint8Array;
  private readonly r: Rng;
  private fraction = CLIMAT.saisonFigee.hiver;
  /** Mise à jour par tranches de lignes (une par appel à avancer) : heures en attente pour chaque tranche. */
  static readonly TRANCHES = 8;
  private readonly enAttente = new Float32Array(Manteau.TRANCHES);
  /** Moment de l'année du dernier calcul de la probabilité de neige, par ligne (elle ne dépend que de la saison). */
  private readonly fractionProba: Float32Array;
  private tranche = 0;

  constructor(private readonly d: Domain) {
    const { N, CELL, h, lake, isRiver, station } = d, W = (this.W = N + 1), n = W * W;
    this.r = rng(d.seed + 903);
    const f32 = () => new Float32Array(n);
    this.frais = f32(); this.plaque = f32(); this.depot = f32(); this.humide = f32(); this.givre = f32(); this.fragile = f32();
    this.epaisseur = f32(); this.instabilite = f32(); this.niveau = new Uint8Array(n); this.probaNeige = f32();
    this.carte = new Uint8Array(n * 4);
    this.fractionProba = new Float32Array(W).fill(-1);
    this.pente = f32(); this.nord = f32(); this.ouest = f32(); this.foret = new Uint8Array(n);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * W + i;
      const gx = (h[j * W + Math.min(N, i + 1)] - h[j * W + Math.max(0, i - 1)]) / ((Math.min(N, i + 1) - Math.max(0, i - 1)) * CELL);
      const gz = (h[Math.min(N, j + 1) * W + i] - h[Math.max(0, j - 1) * W + i]) / ((Math.min(N, j + 1) - Math.max(0, j - 1)) * CELL);
      const g = Math.hypot(gx, gz);
      this.pente[k] = (Math.atan(g) * 180) / Math.PI;
      this.nord[k] = g < 0.03 ? 0 : gz / g;      // descend vers -z = versant nord
      this.ouest[k] = g < 0.03 ? 0 : gx / g;     // descend vers -x = versant ouest, face au vent dominant
      // forêt : même règle d'ensemble que l'affichage (limite plus basse en ubac, pas sur les pentes raides ni sur l'eau)
      const lim = FORET.limite - this.nord[k] * FORET.ecartUbac;
      const surStation = Math.hypot(i * CELL - station.x, j * CELL - station.z) < station.R + FORET.lisiereStation;
      this.foret[k] = h[k] < lim && g * 100 < FORET.penteMax && !lake[k] && !isRiver[k] && !surStation ? 1 : 0;
    }
  }

  /** Épaisseur totale (m) au sommet k. */
  hauteur(k: number) { return this.epaisseur[k]; }
  estForet(k: number) { return this.foret[k] === 1; }
  penteEn(k: number) { return this.pente[k]; }

  /** Facteur de pente (0–1) : les avalanches partent surtout entre 30 et 45°. */
  private facteurPente(deg: number) {
    const R = RISQUE;
    if (deg < R.penteMin) return 0;
    if (deg < R.pleinDebut) return (deg - R.penteMin) / (R.pleinDebut - R.penteMin);
    if (deg <= R.pleinFin) return 1;
    return Math.max(R.tresRaide, 1 - ((1 - R.tresRaide) * (deg - R.pleinFin)) / (R.penteMax - R.pleinFin));
  }

  /**
   * Fait évoluer tout le manteau pendant `heures` heures de jeu. libres = nombre d'avalanches qui peuvent encore partir.
   * Renvoie les déclenchements naturels.
   */
  update(heures: number, meteo: Meteo, c: Contexte, libres = DECLENCHEMENT.maxSimultanees): Declenchement[] {
    this.enAttente.fill(0);
    return this.traiter(0, this.W, heures, meteo, c, libres);
  }

  /**
   * Même chose, par tranches de lignes pour étaler le calcul sur plusieurs images : chaque appel traite une tranche
   * avec les heures accumulées depuis son dernier passage. `complet` : toute la grille a été reprise depuis le dernier tour.
   */
  avancer(heures: number, meteo: Meteo, c: Contexte, libres = DECLENCHEMENT.maxSimultanees) {
    const T = Manteau.TRANCHES, t = this.tranche;
    for (let k = 0; k < T; k++) this.enAttente[k] += heures;
    const j0 = Math.floor((t * this.W) / T), j1 = Math.floor(((t + 1) * this.W) / T);
    const declenchements = this.traiter(j0, j1, this.enAttente[t], meteo, c, libres);
    this.enAttente[t] = 0;
    this.tranche = (t + 1) % T;
    return { declenchements, complet: this.tranche === 0 };
  }

  /** Fait évoluer les lignes j0 (incluse) à j1 (exclue). */
  private traiter(j0: number, j1: number, heures: number, meteo: Meteo, c: Contexte, libres: number): Declenchement[] {
    const { d } = this, { h, CELL, N, lake } = d, W = this.W, M = MANTEAU, R = RISQUE;
    this.fraction = c.fraction;
    const tRef = temperature(CLIMAT.altitudeReference, c);
    const nuitClaire = c.couverture < 0.3 && (c.heure < 7 || c.heure > 19);
    const chute = meteo.precipitation * M.chuteMax * heures;
    for (let j = j0; j < j1; j++) {
      const proba = Math.abs(c.fraction - this.fractionProba[j]) > 0.002;
      if (proba) this.fractionProba[j] = c.fraction;
      for (let i = 0; i <= N; i++) {
      const k = j * W + i, alt = h[k];
      const T = tRef - CLIMAT.gradient * (alt - CLIMAT.altitudeReference);
      const base = lake[k] ? 0 : neigeSaison(alt, this.nord[k], c.fraction);
      let frais = this.frais[k], plaque = this.plaque[k], hum = this.humide[k], givre = this.givre[k], fragile = this.fragile[k], depot = this.depot[k];

      // précipitations : plus abondantes face au vent et en altitude ; neige sous le seuil, pluie au-dessus
      if (chute > 0) {
        const p = chute * (0.85 + 0.15 * Math.max(0, this.ouest[k]) + 0.1 * clamp((alt - 2000) / 1500, 0, 1));
        if (T < CLIMAT.seuilNeige) {
          frais += p;
          const enfoui = Math.min(givre, (givre * p) / M.givreEnfoui);   // le givre recouvert devient une couche fragile
          fragile = Math.max(fragile, enfoui); givre -= enfoui;
        } else if (base + frais + plaque > 0.05) hum = Math.min(1, hum + p * M.humidificationPluie);
      }
      // vent : la neige fraîche est reprise sur les versants au vent et redéposée en plaques sous le vent
      if (frais > 0.005) {
        const v = meteo.intensiteEn(i * CELL, j * CELL);
        if (v > 0.3) {
          const repris = frais * Math.min(1, M.transport * v * heures);
          if (this.ouest[k] > 0.2) frais -= repris;                                                      // versant au vent : décapé
          else if (this.ouest[k] < -0.2) { frais -= repris; plaque += repris * M.depotSousLeVent; }       // sous le vent : plaque
          else { frais -= repris / 2; plaque += (repris / 2) * M.depotSousLeVent; }                       // chargement latéral
        }
      }
      // tassement, fonte, humidification et regel
      const chaud = Math.max(0, T);
      frais *= Math.exp(-M.tassementFrais * heures * (1 + chaud / 3));
      plaque *= Math.exp(-M.tassementPlaque * heures * (1 + chaud / 3));
      if (T > 0) {
        const f = M.fonte * T * heures;
        const df = Math.min(frais, f); frais -= df;
        plaque = Math.max(0, plaque - (f - df));
        depot = Math.max(0, depot - f * M.fonteDepot);
        if (base + frais + plaque + depot > 0.05) hum = Math.min(1, hum + M.humidification * T * heures * (1 - 0.5 * this.nord[k]));
      } else if (T < -2) hum *= Math.exp(-M.regel * heures);
      // givre de surface par nuit claire et froide, surtout en ubac ; la couche fragile disparaît lentement
      if (nuitClaire && T < M.givreTemperature) givre = Math.min(1, givre + M.givreParHeure * heures * (this.nord[k] > 0 ? 1 : 0.5));
      fragile *= Math.exp(-M.disparitionFragile * heures);

      const hs = base + frais + plaque + depot;
      if (hs < 0.02) { hum = 0; givre = 0; }
      this.frais[k] = frais; this.plaque[k] = plaque; this.humide[k] = hum; this.givre[k] = givre; this.fragile[k] = fragile; this.depot[k] = depot;
      this.epaisseur[k] = hs;

      // instabilité et niveau de risque
      let I = 0;
      const fp = this.facteurPente(this.pente[k]);
      if (fp > 0 && hs >= R.neigeMin && !lake[k]) {
        const sec = fp * (frais / R.refFrais + plaque / R.refPlaque + R.base) * (1 + R.poidsFragile * fragile);
        const mouille = fp * hum * R.poidsHumide * smooth(R.neigeMin, 0.4, hs);
        I = Math.max(sec, mouille) * (this.foret[k] ? R.facteurForet : 1);
      }
      this.instabilite[k] = I;
      let lvl = 0;
      if (I > 0) { lvl = 1; for (const s of R.seuils) if (I > s) lvl++; }
      this.niveau[k] = lvl;
      // probabilité de neige du secteur : ne dépend que de la saison
      if (proba) this.probaNeige[k] = probabiliteNeige(alt, this.ouest[k], c.fraction);
    } }

    this.remplirCarte(j0 * W, j1 * W);
    return this.declencher(j0 * W, j1 * W, heures, c, libres);
  }

  private remplirCarte(k0: number, k1: number) {
    const { carte } = this;
    for (let k = k0; k < k1; k++) {
      const q = k * 4;
      carte[q] = Math.round(smooth(0.02, 0.12, this.epaisseur[k]) * 255);
      carte[q + 1] = this.niveau[k] * 51;
      carte[q + 2] = Math.round(this.probaNeige[k] * 255);
      carte[q + 3] = Math.round(this.humide[k] * 255);
    }
  }

  /** Tire au sort les ruptures naturelles : seulement là où l'instabilité dépasse le seuil, ou coulées sur pentes très raides. */
  private declencher(k0: number, k1: number, heures: number, c: Contexte, libres: number): Declenchement[] {
    const out: Declenchement[] = [], D = DECLENCHEMENT, n = k1 - k0;
    if (libres <= 0 || n <= 0) return out;
    // départ du parcours à un endroit tiré au hasard, pour ne pas favoriser le haut de la tranche
    const debut = Math.floor(this.r() * n);
    for (let q = 0; q < n && out.length < libres; q++) {
      const k = k0 + ((debut + q) % n), I = this.instabilite[k];
      let p = 0, meuble = false;
      if (I > D.seuil) p = D.taux * (I - D.seuil) * heures;
      else if (this.pente[k] > D.meublePente && this.frais[k] > D.meubleFrais && !this.foret[k]) {
        p = D.meubleTaux * (this.frais[k] / D.meubleFrais) * heures; meuble = true;
      }
      if (p > 0 && this.r() < p) out.push(this.rupture(k, meuble, c));
    }
    return out;
  }

  /** Type de l'avalanche, zone de départ (propagation de la fracture de proche en proche) et retrait de la neige. */
  private rupture(k0: number, meuble: boolean, c: Contexte): Declenchement {
    const D = DECLENCHEMENT, { h, CELL } = this.d, W = this.W;
    const T = temperature(h[k0], c), charge = this.frais[k0] + this.plaque[k0];
    let type: TypeAvalanche;
    if (meuble) type = 'meuble';
    else if (this.humide[k0] > D.humide) type = 'humide';
    else if (charge > D.aerosolCharge && T < D.aerosolTemperature && this.denivele(k0) > D.aerosolDenivele) type = 'aerosol';
    else type = 'plaque';

    const cellules = [k0], vu = new Set([k0]), I0 = this.instabilite[k0];
    for (let q = 0; q < cellules.length && cellules.length < D.tailleMax[type]; q++) {
      const k = cellules[q], i = k % W, j = (k - i) / W;
      for (const [a, b] of NB8) {
        const ii = i + a, jj = j + b, nk = jj * W + ii;
        if (ii < 0 || jj < 0 || ii >= W || jj >= W || vu.has(nk)) continue;
        vu.add(nk);
        if (this.pente[nk] >= RISQUE.penteMin && !this.foret[nk] && this.instabilite[nk] >= I0 * D.propagation) {
          cellules.push(nk);
          if (cellules.length >= D.tailleMax[type]) break;
        }
      }
    }
    let volume = 0;
    for (const k of cellules) {
      const part = this.frais[k] + this.plaque[k] + (type === 'humide' ? 0.4 : 0.1);
      volume += part * CELL * CELL;
      this.frais[k] = 0; this.plaque[k] = 0; this.fragile[k] = 0; this.givre[k] = 0;
      if (type === 'humide') this.humide[k] *= 0.5;
      this.instabilite[k] = 0; this.niveau[k] = Math.min(this.niveau[k], 1);
    }
    return { type, cellules, volume };
  }

  /** Dénivelée (m) sous un point en suivant la plus grande pente. */
  private denivele(k0: number) {
    const { h, N } = this.d, W = this.W;
    let k = k0;
    for (let s = 0; s < 400; s++) {
      const i = k % W, j = (k - i) / W;
      let best = k;
      for (const [a, b] of NB8) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii > N || jj > N) continue;
        if (h[jj * W + ii] < h[best]) best = jj * W + ii;
      }
      if (best === k) break;
      k = best;
    }
    return h[k0] - h[k];
  }

  /** Dépose de la neige d'avalanche (m) au sommet le plus proche de (x, z) en mètres. */
  deposer(x: number, z: number, epaisseur: number) {
    const { N, CELL } = this.d;
    const i = clamp(Math.round(x / CELL), 0, N), j = clamp(Math.round(z / CELL), 0, N), k = j * this.W + i;
    this.depot[k] += epaisseur;
    this.epaisseur[k] += epaisseur;
  }

  /** Moment de l'année de la dernière mise à jour. */
  get fractionAnnee() { return this.fraction; }
}
