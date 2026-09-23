// Lacs et torrents, gelés tant que la neige tient autour (carte du manteau neigeux).
import * as THREE from 'three';
import { clamp, makeNoise, rng } from '../gen/math';
import type { Domain } from '../gen/types';
import { LAKE_FRAG, RIVER_FRAG, RIVER_VERT, WORLD_XZ_VERT, shared, uniformsCarte } from './shaders';
import type { TerrainView } from './terrainView';

export function buildLakes(tv: TerrainView): THREE.Mesh | null {
  const { N, W, h, lake } = tv;
  const pos: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * W + i;
    if (!(lake[k] && lake[k + 1] && lake[k + W] && lake[k + W + 1])) continue;
    const y = tv.Y(h[k]) + 0.06;
    const x0 = tv.toW(i), x1 = tv.toW(i + 1), z0 = tv.toW(j), z1 = tv.toW(j + 1);
    pos.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { light: shared.light, time: shared.time, ...uniformsCarte() },
    vertexShader: WORLD_XZ_VERT, fragmentShader: LAKE_FRAG,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  return new THREE.Mesh(g, mat);
}

type P4 = [number, number, number, number];
const chaikin = (P: P4[]): P4[] => {
  const Q: P4[] = [P[0]];
  for (let k = 0; k < P.length - 1; k++) {
    const a = P[k], b = P[k + 1];
    Q.push(a.map((v, q) => v * 0.75 + b[q] * 0.25) as P4);
    Q.push(a.map((v, q) => v * 0.25 + b[q] * 0.75) as P4);
  }
  Q.push(P[P.length - 1]);
  return Q;
};

export function buildRivers(tv: TerrainView, d: Domain): THREE.Mesh | null {
  const { W, S, CELL, lake } = tv;
  const pos: number[] = [], idx: number[] = [], along: number[] = [], across: number[] = [], frozen: number[] = [];
  const rn = makeNoise(rng(d.seed + 31));
  let rid = 0;

  const addRibbon = (pts: P4[]) => {
    if (pts.length < 2) return;
    rid++;
    let P = chaikin(chaikin(pts));
    // méandres : ondulation latérale, ample sur les rivières lentes et larges, faible sur les torrents raides
    let dist = 0;
    P = P.map((p, k) => {
      if (k) dist += Math.hypot(p[0] - P[k - 1][0], p[1] - P[k - 1][1]);
      const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const km2 = (p[2] * CELL * CELL) / 1e6, sl = tv.slopeAt(p[0], p[1]);
      const amp = clamp(0.35 + 0.25 * Math.log(1 + km2), 0, 1.3) * clamp(1.3 - sl / 25, 0.25, 1) * Math.min(1, k / 4, (P.length - 1 - k) / 4);
      const off = (rn(dist * 0.16 + rid * 3.3, rid * 0.7) + 0.5 * rn(dist * 0.5, rid * 1.9)) * amp;
      return [p[0] - tz * off, p[1] + tx * off, p[2], p[3]] as P4;
    });
    P = chaikin(P);
    const base = pos.length / 3;
    dist = 0;
    for (let k = 0; k < P.length; k++) {
      if (k) dist += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]) * S;
      const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const km2 = (P[k][2] * CELL * CELL) / 1e6;
      const w = Math.min(1.4, 0.14 + 0.08 * Math.sqrt(km2)) / S;
      const alt = tv.altAt(P[k][0], P[k][1]);
      // plus gelé en altitude et sur les petits ruisseaux
      const frz = clamp(0.45 + 0.55 * rn(dist * 0.05 + rid * 5.1, 3.3) + (alt - 1700) / 1800 - Math.log(1 + km2) * 0.09, 0, 1);
      for (const sgn of [-1, 1]) {
        const fi = P[k][0] - tz * w * sgn, fj = P[k][1] + tx * w * sgn;
        pos.push(tv.toW(fi), tv.Y(Math.max(tv.altAt(fi, fj), alt)) + 0.16, tv.toW(fj));
        along.push(dist); across.push(sgn); frozen.push(frz);
      }
      if (k > 0) { const q = base + k * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); }
    }
  };

  for (const river of d.rivers) {
    let cur: P4[] = [];
    for (const [i, j, a, hh] of river) {
      if (lake[j * W + i]) { addRibbon(cur); cur = []; continue; }
      cur.push([i, j, a, hh]);
    }
    addRibbon(cur);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('across', new THREE.Float32BufferAttribute(across, 1));
  g.setAttribute('frozen', new THREE.Float32BufferAttribute(frozen, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: shared.time, light: shared.light, ...uniformsCarte() },
    vertexShader: RIVER_VERT, fragmentShader: RIVER_FRAG,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return new THREE.Mesh(g, mat);
}
