// Précipitations : flocons ou gouttes autour du centre de la vue. Chaque particule est neige ou pluie
// selon son altitude par rapport à la limite pluie-neige (l'été, il peut pleuvoir en bas et neiger sur les sommets).
import * as THREE from 'three';
import { ECHELLE } from '../params/monde';
import { PRECIPITATIONS } from '../params/meteo';
import { shared } from './shaders';
import type { TerrainView } from './terrainView';

const VERT = /* glsl */ `
  attribute float pluie; varying float vPluie; uniform float size;
  void main(){ vPluie = pluie; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = size * (1. + pluie * 2.5); }`;
const FRAG = /* glsl */ `
  uniform vec3 light; uniform float incline; varying float vPluie;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float a;
    if (vPluie > .5) { a = (1. - smoothstep(.03, .09, abs(c.x + c.y * incline))) * (1. - smoothstep(.35, .5, abs(c.y))) * .45; }   // trait de pluie
    else { float d = length(c); if (d > .5) discard; a = (1. - d * 2.) * .9; }                                                // flocon
    vec3 col = vPluie > .5 ? vec3(.72, .80, .88) : vec3(1.);
    gl_FragColor = vec4(col * max(light, vec3(.55)), a);
  }`;

export class Precipitations {
  readonly points: THREE.Points;
  private readonly n = PRECIPITATIONS.particules;
  /** Coordonnées normalisées dans le volume autour de la vue : u, w ∈ [-1, 1] à l'horizontale, v ∈ [0, 1] en hauteur. */
  private readonly u: Float32Array; private readonly v: Float32Array; private readonly w: Float32Array;
  private readonly pos: Float32Array; private readonly pluie: Float32Array;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    const n = this.n;
    this.u = new Float32Array(n); this.v = new Float32Array(n); this.w = new Float32Array(n);
    for (let k = 0; k < n; k++) { this.u[k] = Math.random() * 2 - 1; this.v[k] = Math.random(); this.w[k] = Math.random() * 2 - 1; }
    this.pos = new Float32Array(n * 3); this.pluie = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pluie', new THREE.BufferAttribute(this.pluie, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { size: { value: 2 }, light: shared.light, incline: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }

  /**
   * centre : point visé par la caméra (3D) ; largeur : largeur visible (unités 3D) ; intensite : 0–1 ;
   * limite : altitude (m) de la limite pluie-neige ; vent : 0–1 (d'ouest, vers +x).
   */
  update(dt: number, tv: TerrainView, centre: THREE.Vector3, largeur: number, intensite: number, limite: number, vent: number, pointSize: number) {
    const count = Math.round(this.n * Math.min(1, intensite));
    this.points.geometry.setDrawRange(0, count);
    this.points.visible = count > 0;
    if (!count) return;
    const B = largeur * 0.65, H = B * 0.9, P = PRECIPITATIONS;
    const { UNIT, VEX, ALT0 } = ECHELLE;
    for (let k = 0; k < count; k++) {
      const alt = ((centre.y - H * 0.35 + this.v[k] * H) / VEX) * UNIT + ALT0;
      const pl = alt > limite ? 0 : 1;
      this.v[k] -= ((pl ? P.chutePluie : P.chuteNeige) * dt) / H;
      this.u[k] += (vent * P.deriveVent * (pl ? 0.5 : 1) * dt) / B + (pl ? 0 : (Math.random() - 0.5) * 0.4 * dt / B);
      if (this.u[k] > 1) this.u[k] -= 2;
      const x = centre.x + this.u[k] * B, z = centre.z + this.w[k] * B;
      let y = centre.y - H * 0.35 + this.v[k] * H;
      const sol = tv.Y(tv.altAt(tv.toG(x), tv.toG(z)));
      if (this.v[k] < 0 || y < sol) { this.v[k] = 1; this.u[k] = Math.random() * 2 - 1; this.w[k] = Math.random() * 2 - 1; y = centre.y + H * 0.65; }
      this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
      this.pluie[k] = pl;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.pluie.needsUpdate = true;
    this.mat.uniforms.size.value = pointSize;
    this.mat.uniforms.incline.value = -vent * 0.5;
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}
