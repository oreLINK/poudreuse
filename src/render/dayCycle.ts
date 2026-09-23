// Cycle de la journée : matin froid aux ombres bleues, midi, alpenglow au couchant, nuit lunaire ;
// assombri et grisé par les nuages, éclairé par les éclairs d'orage, noyé par le brouillard.
import * as THREE from 'three';
import { TOPO } from '../params/affichage';
import { TEMPS } from '../params/temps';
import { LIGHT_SCALE } from './colorSetup';
import { shared } from './shaders';
import type { World } from './world';

interface Key { p: number; top: string; bot: string; sun: string; si: number; sky: string; gnd: string; hi: number; cl: number; night: number }
const RAW: Key[] = [
  { p: 0,    top: '#0c1526', bot: '#1f2d48', sun: '#9fb4d9', si: 0.2,  sky: '#33466b', gnd: '#1a2233', hi: 0.38, cl: 0.55, night: 1 },
  { p: 0.06, top: '#3b4e7a', bot: '#f0b49a', sun: '#ff9b6b', si: 0.5,  sky: '#9aa7d0', gnd: '#5a5f78', hi: 0.5,  cl: 0.85, night: 0.3 },
  { p: 0.14, top: '#9cc6e6', bot: '#fbe9da', sun: '#ffe2b8', si: 0.88, sky: '#d6e6ff', gnd: '#6f7c94', hi: 0.66, cl: 0.8,  night: 0 },
  { p: 0.36, top: '#a9cfe8', bot: '#eef5fa', sun: '#fff5e6', si: 1,    sky: '#e2eeff', gnd: '#66758a', hi: 0.72, cl: 0.25, night: 0 },
  { p: 0.62, top: '#9fc4e0', bot: '#f6efe3', sun: '#ffe7c4', si: 0.92, sky: '#dfe8fa', gnd: '#66708a', hi: 0.68, cl: 0.3,  night: 0 },
  { p: 0.72, top: '#5f6fa3', bot: '#f4a88f', sun: '#ff8a7a', si: 0.75, sky: '#8d88b8', gnd: '#4b4f6b', hi: 0.5,  cl: 0.45, night: 0.1 },
  { p: 0.79, top: '#26345a', bot: '#7b6a8c', sun: '#d98aa0', si: 0.3,  sky: '#4a557e', gnd: '#262d42', hi: 0.4,  cl: 0.5,  night: 0.6 },
  { p: 0.86, top: '#0c1526', bot: '#1f2d48', sun: '#9fb4d9', si: 0.2,  sky: '#33466b', gnd: '#1a2233', hi: 0.38, cl: 0.55, night: 1 },
  { p: 1,    top: '#0c1526', bot: '#1f2d48', sun: '#9fb4d9', si: 0.2,  sky: '#33466b', gnd: '#1a2233', hi: 0.38, cl: 0.55, night: 1 },
];
const KEYS = RAW.map(k => ({ ...k, top: new THREE.Color(k.top), bot: new THREE.Color(k.bot), sun: new THREE.Color(k.sun), sky: new THREE.Color(k.sky), gnd: new THREE.Color(k.gnd) }));

const TOPO_JOUR = new THREE.Color(TOPO.couleurJour), TOPO_NUIT = new THREE.Color(TOPO.couleurNuit);

/** Ce que l'éclairage lit de la météo (sim/meteo.ts). */
export interface EtatCiel { couverture: number; brouillard: number; eclair: number }
const CIEL_CLAIR: EtatCiel = { couverture: 0, brouillard: 0, eclair: 0 };

/** Éclairage selon la phase de la journée (fournie par sim/temps.ts) : 0 = minuit, 0,5 ≈ midi. */
export class DayCycle {
  private tick = 0;
  private readonly top = new THREE.Color();
  private readonly bot = new THREE.Color();
  private readonly white = new THREE.Color(1, 1, 1);
  private readonly dir = new THREE.Vector3();
  private readonly tmp = new THREE.Color();
  private readonly gris = new THREE.Color();

  constructor(private sun: THREE.DirectionalLight, private hemi: THREE.HemisphereLight, private fog: THREE.Fog) {}

  apply(world: World | null, p: number, ciel: EtatCiel = CIEL_CLAIR) {
    let a = KEYS[0], b = KEYS[1];
    for (let k = 0; k < KEYS.length - 1; k++) if (p >= KEYS[k].p && p <= KEYS[k + 1].p) { a = KEYS[k]; b = KEYS[k + 1]; break; }
    const t = (p - a.p) / (b.p - a.p || 1), L = (x: number, y: number) => x + (y - x) * t;
    this.top.copy(a.top).lerp(b.top, t);
    this.bot.copy(a.bot).lerp(b.bot, t);
    this.sun.color.copy(a.sun).lerp(b.sun, t);
    this.sun.intensity = L(a.si, b.si) * LIGHT_SCALE;
    this.hemi.color.copy(a.sky).lerp(b.sky, t);
    this.hemi.groundColor.copy(a.gnd).lerp(b.gnd, t);
    this.hemi.intensity = L(a.hi, b.hi) * LIGHT_SCALE;
    const night = L(a.night, b.night);

    // nuages : moins de soleil direct, lumière diffuse grise, ciel terne ; éclair : flash blanc
    const cv = ciel.couverture, ec = ciel.eclair;
    this.sun.intensity *= 1 - 0.75 * cv;
    this.hemi.intensity *= 1 + 0.2 * cv;
    this.hemi.intensity += ec * 2.2 * LIGHT_SCALE;
    this.hemi.color.lerp(this.gris.setScalar(this.hemi.color.getHSL({ h: 0, s: 0, l: 0 }).l), cv * 0.6);
    for (const c of [this.top, this.bot]) {
      c.lerp(this.gris.setScalar(c.getHSL({ h: 0, s: 0, l: 0 }).l * (1 - 0.1 * cv)), cv * 0.7);
      c.lerp(this.white, ec * 0.6);
    }

    // le soleil se lève à l'est (+x), passe au sud (+z), se couche à l'ouest ; la lune éclaire la nuit
    const dayT = (p - TEMPS.lever) / (TEMPS.coucher - TEMPS.lever);
    if (dayT > 0 && dayT < 1) {
      const th = Math.PI * dayT, el = Math.max(0.07, Math.sin(Math.PI * dayT) * 0.72);
      this.dir.set(Math.cos(th) * Math.cos(el), Math.sin(el), Math.sin(th) * Math.cos(el));
    } else this.dir.set(-0.35, 0.8, 0.45).normalize();
    const mapW = world?.mapW ?? 200;
    this.sun.position.copy(this.dir).multiplyScalar(mapW * 1.4);
    this.sun.target.position.set(0, 0, 0);

    // éclairage des matériaux personnalisés (eau, glace, neige soufflée)
    this.tmp.copy(this.hemi.color).multiplyScalar((this.hemi.intensity / LIGHT_SCALE) * 0.75);
    shared.light.value.copy(this.sun.color).multiplyScalar((this.sun.intensity / LIGHT_SCALE) * 0.5).add(this.tmp).multiplyScalar(1.05);

    if (world) {
      const cm = world.cloudMaterial;
      cm.uniforms.opacity.value = L(a.cl, b.cl);
      (cm.uniforms.color.value as THREE.Color).copy(this.bot).lerp(this.white, 0.55).multiplyScalar(0.5 + 0.5 * (1 - night * 0.6));
      world.batiments.wallMaterial.emissive.setRGB(night * 0.55, night * 0.33, night * 0.12);   // fenêtres allumées
      // brouillard : la mer de nuages s'épaissit et monte
      cm.uniforms.opacity.value = Math.max(cm.uniforms.opacity.value, 0.92 * ciel.brouillard);
      world.cloudMesh.position.y = world.cloudY + ciel.brouillard * 6;
    }
    // courbes de niveau : brun-ocre sur la neige éclairée, crème la nuit
    shared.topoColor.value.copy(TOPO_JOUR).lerp(TOPO_NUIT, night);
    shared.topoLueur.value = night;
    this.fog.color.copy(this.bot);
    if (this.tick++ % 4 === 0) {
      document.body.style.background = `linear-gradient(180deg, #${this.top.getHexString()}, #${this.bot.getHexString()})`;
      document.body.classList.toggle('night', night > 0.5);
    }
  }
}
