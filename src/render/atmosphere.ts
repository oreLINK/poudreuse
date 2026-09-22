// Mer de nuages dans les fonds de vallée et neige soufflée sur les sommets.
import * as THREE from 'three';
import type { Domain } from '../gen/types';
import { NUAGES, VENT } from '../params/meteo';
import type { Meteo } from '../sim/meteo';
import { CLOUD_FRAG, SPIN_FRAG, SPIN_VERT, WORLD_XZ_VERT, shared } from './shaders';
import type { TerrainView } from './terrainView';

export function buildClouds(tv: TerrainView, d: Domain) {
  const g = new THREE.PlaneGeometry(tv.mapW, tv.mapW, 1, 1);
  g.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { time: shared.time, opacity: { value: 0.7 }, color: { value: new THREE.Color('#f4f6fa') }, uHalf: { value: tv.mapW / 2 },
      // trouée au-dessus de l'aire de la station, pour construire à découvert
      uHole: { value: new THREE.Vector3(tv.toW(d.station.x / tv.CELL), tv.toW(d.station.z / tv.CELL), (d.station.R / tv.CELL) * tv.S * NUAGES.troueeStation) } },
    vertexShader: WORLD_XZ_VERT, fragmentShader: CLOUD_FRAG,
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.position.y = tv.Y(d.station.alt + NUAGES.hauteur);
  mesh.renderOrder = 5;
  return { mesh, material };
}

/** Neige soufflée depuis les plus hautes crêtes, seulement là où le vent souffle (voir sim/meteo.ts). */
export class Spindrift {
  readonly points: THREE.Points;
  private readonly mat: THREE.ShaderMaterial;
  private readonly p: Float32Array; private readonly a: Float32Array; private readonly v: Float32Array;
  private readonly age: Float32Array; private readonly life: Float32Array;
  /** 1 = particule en vol, 0 = en attente d'un coup de vent. */
  private readonly alive: Uint8Array;

  /** emitters : [x, y, z] en 3D et [x, z] en mètres pour interroger la météo. */
  private constructor(private readonly emitters: { w: [number, number, number]; mx: number; mz: number }[], private readonly n: number) {
    this.p = new Float32Array(n * 3); this.a = new Float32Array(n); this.v = new Float32Array(n * 3);
    this.age = new Float32Array(n); this.life = new Float32Array(n); this.alive = new Uint8Array(n);
    for (let k = 0; k < n; k++) this.wait(k);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { size: { value: 3 }, light: shared.light },
      vertexShader: SPIN_VERT, fragmentShader: SPIN_FRAG, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.renderOrder = 6;
    this.points.frustumCulled = false;
  }

  /** Émetteurs : les crêtes les plus hautes. */
  static build(tv: TerrainView): Spindrift | null {
    const { N, W, CELL, h, conv, crestT, maxAlt } = tv;
    const cand: [number, number, number, number][] = [];
    for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
      const k = j * W + i;
      if (h[k] > Math.max(2900, maxAlt - 900) && conv[k] > crestT) cand.push([i, j, h[k], 0]);
    }
    cand.sort((a, b) => b[2] - a[2]);
    const em: { w: [number, number, number]; mx: number; mz: number }[] = [];
    for (const [i, j, alt] of cand) {
      if (em.length >= 40) break;
      const x = tv.toW(i), z = tv.toW(j);
      if (em.every(f => Math.hypot(f.w[0] - x, f.w[2] - z) > 6)) em.push({ w: [x, tv.Y(alt), z], mx: i * CELL, mz: j * CELL });
    }
    return em.length ? new Spindrift(em, 90 * em.length) : null;
  }

  /** Particule au repos : invisible, elle retentera bientôt de s'envoler. */
  private wait(k: number) {
    this.alive[k] = 0; this.a[k] = 0;
    this.age[k] = 0; this.life[k] = 0.1 + Math.random() * 0.4;
  }

  /** Tente d'envoler une particule depuis une crête : d'autant plus probable que le vent y est fort. */
  private spawn(k: number, meteo: Meteo) {
    const e = this.emitters[Math.floor(Math.random() * this.emitters.length)];
    const force = meteo.intensiteEn(e.mx, e.mz);
    if (Math.random() >= force) { this.wait(k); return; }
    const [x, y, z] = e.w, [v0, v1] = VENT.vitesse, speed = 0.4 + 0.6 * force;
    this.p[k * 3] = x + (Math.random() - 0.5) * 1.5;
    this.p[k * 3 + 1] = y + Math.random() * 0.6;
    this.p[k * 3 + 2] = z + (Math.random() - 0.5) * 1.5;
    this.v[k * 3] = (v0 + Math.random() * (v1 - v0)) * speed;   // vent d'ouest → vers +x
    this.v[k * 3 + 1] = (0.2 + Math.random() * 0.5) * speed;
    this.v[k * 3 + 2] = (Math.random() - 0.5) * 0.8;
    this.alive[k] = 1; this.age[k] = 0; this.life[k] = 1.5 + Math.random() * 2.5;
  }

  update(dt: number, pointSize: number, meteo: Meteo) {
    const { p, a, v, age, life, alive } = this;
    for (let q = 0; q < this.n; q++) {
      age[q] += dt;
      if (age[q] > life[q]) { this.spawn(q, meteo); continue; }
      if (!alive[q]) continue;
      p[q * 3] += v[q * 3] * dt; p[q * 3 + 1] += v[q * 3 + 1] * dt; p[q * 3 + 2] += v[q * 3 + 2] * dt;
      a[q] = Math.sin((Math.PI * age[q]) / life[q]);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    this.mat.uniforms.size.value = pointSize;
  }
}
