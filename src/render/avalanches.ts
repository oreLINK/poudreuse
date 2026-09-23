// Affichage des avalanches (sim/avalanche.ts) : cœur dense de neige en mouvement, nuage d'aérosol,
// traînée qui dessine le couloir parcouru et dépôts, qui s'estompent ensuite.
import * as THREE from 'three';
import { ECOULEMENT } from '../params/avalanches';
import type { Avalanche } from '../sim/avalanche';
import { shared } from './shaders';
import type { TerrainView } from './terrainView';

const VERT = /* glsl */ `
  attribute float alpha; attribute float taille; attribute vec3 couleur; varying float vA; varying vec3 vC; uniform float size;
  void main(){ vA = alpha; vC = couleur; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = size * taille; }`;
const FRAG = /* glsl */ `
  uniform vec3 light; varying float vA; varying vec3 vC;
  void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vC * max(light, vec3(.5)), vA * (1. - smoothstep(.3, .5, d))); }`;

const C_COEUR = new THREE.Color('#fbfdff'), C_HUMIDE = new THREE.Color('#e6dfd2'), C_NUAGE = new THREE.Color('#eef3f8');
const C_TRACE = new THREE.Color('#b9c6d4'), C_DEPOT = new THREE.Color('#cfd8e2');
/** Traînée : une particule sur TRACE_UNE_SUR laisse un point tous les TRACE_PAS cases parcourues, TRACE_MAX points au plus. */
const TRACE_UNE_SUR = 3, TRACE_PAS = 0.8, TRACE_MAX = 48;

/**
 * Nuage de points d'une avalanche, par tranches : [cœur n] [nuage d'aérosol n, si aérosol] [traînée : TRACE_MAX par particule traceuse].
 */
class Vue {
  readonly points: THREE.Points;
  private readonly pos: Float32Array; private readonly alpha: Float32Array; private readonly taille: Float32Array; private readonly col: Float32Array;
  private readonly mat: THREE.ShaderMaterial;
  private readonly debutTrace: number; private readonly nTrace: number;
  /** Âge (s) de chaque point de traînée (-1 = libre), dernier point semé et nombre de points par particule traceuse. */
  private readonly ageTrace: Float32Array;
  private readonly dernierX: Float32Array; private readonly dernierZ: Float32Array; private readonly semes: Uint8Array;

  constructor(readonly a: Avalanche) {
    this.debutTrace = a.n * (a.type === 'aerosol' ? 2 : 1);
    const traceuses = Math.ceil(a.n / TRACE_UNE_SUR);
    this.nTrace = traceuses * TRACE_MAX;
    this.dernierX = new Float32Array(traceuses).fill(NaN); this.dernierZ = new Float32Array(traceuses); this.semes = new Uint8Array(traceuses);
    const n = this.debutTrace + this.nTrace;
    this.pos = new Float32Array(n * 3); this.alpha = new Float32Array(n); this.taille = new Float32Array(n); this.col = new Float32Array(n * 3);
    this.ageTrace = new Float32Array(this.nTrace).fill(-1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('taille', new THREE.BufferAttribute(this.taille, 1));
    g.setAttribute('couleur', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { size: { value: 3 }, light: shared.light },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  private point(k: number, x: number, y: number, z: number, a: number, t: number, c: THREE.Color) {
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.alpha[k] = a; this.taille[k] = t;
    this.col[k * 3] = c.r; this.col[k * 3 + 1] = c.g; this.col[k * 3 + 2] = c.b;
  }

  update(dt: number, tv: TerrainView, pointSize: number) {
    const { a } = this, fondu = a.enCours ? 1 : Math.max(0, 1 - (a.age - a.fin) / ECOULEMENT.persistanceDepot);
    const coeur = a.type === 'humide' ? C_HUMIDE : C_COEUR;
    for (let q = 0; q < a.n; q++) {
      const x = tv.toW(a.x[q] / tv.CELL), z = tv.toW(a.z[q] / tv.CELL), sol = a.altitude(q), y = tv.Y(sol);
      const bouge = a.etat[q] === 1;
      if (a.etat[q] === 2) this.point(q, x, y, z, 0, 0, coeur);
      else if (bouge) this.point(q, x, y + 0.25, z, 1, 2.2, coeur);                // cœur dense en mouvement
      else this.point(q, x, y + 0.12, z, 0.95 * fondu, 1.5, C_DEPOT);              // bloc déposé
      if (a.type === 'aerosol') {
        const c = a.n + q;
        this.point(c, x, tv.Y(sol + a.nuage[q]) + 0.3, z, bouge ? a.densiteNuage[q] * 0.35 : 0, 3 + a.densiteNuage[q] * 6, C_NUAGE);
      }
      // traînée : les particules traceuses sèment un point à chaque bout de chemin, qui dessine le couloir
      const p = q / TRACE_UNE_SUR;
      if (bouge && q % TRACE_UNE_SUR === 0 && this.semes[p] < TRACE_MAX) {
        const gx = a.x[q] / tv.CELL, gz = a.z[q] / tv.CELL;
        if (!(Math.hypot(gx - this.dernierX[p], gz - this.dernierZ[p]) < TRACE_PAS)) {
          const t = p * TRACE_MAX + this.semes[p]++;
          this.ageTrace[t] = 0;
          this.point(this.debutTrace + t, x, y + 0.08, z, 0.7, 1.2, C_TRACE);
          this.dernierX[p] = gx; this.dernierZ[p] = gz;
        }
      }
    }
    // la traînée pâlit avec le temps et disparaît avec les dépôts
    for (let t = 0; t < this.nTrace; t++) {
      if (this.ageTrace[t] < 0) continue;
      this.ageTrace[t] += dt;
      this.alpha[this.debutTrace + t] = 0.7 * Math.max(0, 1 - this.ageTrace[t] / (ECOULEMENT.persistanceDepot * 1.2)) * fondu;
    }
    const g = this.points.geometry;
    for (const k of ['position', 'alpha', 'taille', 'couleur']) g.attributes[k].needsUpdate = true;
    this.mat.uniforms.size.value = pointSize;
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

export class AvalanchesVue {
  readonly group = new THREE.Group();
  private readonly vues: Vue[] = [];

  constructor(private readonly tv: TerrainView) {}

  ajouter(a: Avalanche) {
    const v = new Vue(a);
    this.vues.push(v);
    this.group.add(v.points);
  }

  /** Met à jour l'affichage et retire les avalanches dont les dépôts ont disparu. */
  update(dt: number, pointSize: number) {
    for (let k = this.vues.length - 1; k >= 0; k--) {
      const v = this.vues[k];
      if (v.a.terminee) { this.group.remove(v.points); v.dispose(); this.vues.splice(k, 1); continue; }
      v.update(dt, this.tv, pointSize);
    }
  }
}
