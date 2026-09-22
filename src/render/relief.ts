// Détails du relief : corniches sous le vent et traces de freeride dans les combes.
import * as THREE from 'three';
import { rng } from '../gen/math';
import type { Domain } from '../gen/types';
import { NEIGE } from '../params/neige';
import { C } from './palette';
import type { TerrainView } from './terrainView';

/** Corniches sur les crêtes, surplombant le côté sous le vent (vent dominant d'ouest). */
export function buildCornices(tv: TerrainView, d: Domain): THREE.InstancedMesh | null {
  const { N, W, S, CELL, h, lake, conv, curvX, curvZ, crestT } = tv;
  const shape = new THREE.Shape([
    new THREE.Vector2(-0.55, 0), new THREE.Vector2(0.05, 0.26), new THREE.Vector2(0.55, 0.2),
    new THREE.Vector2(0.5, 0.12), new THREE.Vector2(0.05, -0.04),
  ]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geo.translate(0, 0, -0.5);
  const r = rng(d.seed + 55);
  const list: { x: number; y: number; z: number; rot: number; len: number; s: number }[] = [];
  const step = Math.max(1, Math.round(90 / CELL));
  for (let j = 2; j < N - 2 && list.length < 3000; j += step) for (let i = 2; i < N - 2; i += step) {
    const k = j * W + i;
    if (h[k] < NEIGE.cornicheAlt || conv[k] < crestT * 1.4 || lake[k]) continue;
    const alongZ = curvX[k] < curvZ[k];           // crête nord-sud → corniche vers l'est
    list.push({
      x: tv.toW(i) + (alongZ ? 0.35 * S : 0), z: tv.toW(j) + (alongZ ? 0 : 0.35 * S), y: tv.Y(h[k]) - 0.05,
      rot: alongZ ? 0 : -Math.PI / 2, len: (1 + r() * 0.8) * S, s: 0.8 + r() * 0.5,
    });
  }
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: C.cornice }), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), v = new THREE.Vector3();
  list.forEach((c, k) => { q.setFromAxisAngle(up, c.rot); sc.set(c.s * S, c.s * S, c.len); v.set(c.x, c.y, c.z); m.compose(v, q, sc); im.setMatrixAt(k, m); });
  im.castShadow = im.receiveShadow = true;
  return im;
}

/** Traces de virages dans les combes non damées orientées au nord. */
export function buildFreerideTracks(tv: TerrainView, d: Domain): THREE.Mesh | null {
  const { N, W, S, lake, rockLim } = tv;
  const r = rng(d.seed + 41);
  const pos: number[] = [], idx: number[] = [];
  const want = Math.round(6 + tv.mapW / 25);
  let made = 0;
  for (let t = 0; t < 4000 && made < want; t++) {
    const fi = 2 + r() * (N - 4), fj = 2 + r() * (N - 4);
    const sl = tv.slopeAt(fi, fj);
    if (tv.altAt(fi, fj) < NEIGE.freerideAlt || sl < 35 || sl > rockLim * 0.85 || tv.northAt(fi, fj) < 0.1) continue;
    const nTracks = 1 + Math.floor(r() * 3);
    for (let q = 0; q < nTracks; q++) {
      let x = fi + (r() - 0.5) * 1.2, z = fj + (r() - 0.5) * 1.2;
      const phase = r() * 6.28, amp = 0.25 + r() * 0.2, wl = 2.2 + r();
      const P: [number, number][] = [];
      let dist = 0;
      for (let s = 0; s < 70; s++) {
        const [gx, gz] = tv.gradAt(x, z), gl = Math.hypot(gx, gz);
        if (gl < 0.18 || x < 1 || z < 1 || x > N - 1 || z > N - 1) break;
        const dx = -gx / gl, dz = -gz / gl;                  // dans la ligne de pente
        const off = Math.sin((dist / wl) * 6.28 + phase) * amp;
        P.push([x - dz * off, z + dx * off]);
        x += dx * 0.45; z += dz * 0.45; dist += 0.45;
        if (lake[Math.round(z) * W + Math.round(x)]) break;
      }
      if (P.length < 12) continue;
      const base = pos.length / 3, w = 0.05 / S;
      for (let k = 0; k < P.length; k++) {
        const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        for (const sgn of [-1, 1]) {
          const u = P[k][0] - tz * w * sgn, v = P[k][1] + tx * w * sgn;
          pos.push(tv.toW(u), tv.Y(tv.altAt(u, v)) + 0.1, tv.toW(v));
        }
        if (k) { const qq = base + k * 2; idx.push(qq - 2, qq - 1, qq, qq - 1, qq + 1, qq); }
      }
    }
    made++;
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: C.track, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
}
