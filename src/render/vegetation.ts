// Végétation étagée : pins denses, mélèzes clairsemés, arbres englacés à la limite de la forêt.
import * as THREE from 'three';
import { makeNoise, rng } from '../gen/math';
import type { Domain } from '../gen/types';
import { OBJETS } from '../params/affichage';
import { FORET } from '../params/vegetation';
import { C } from './palette';
import type { TerrainView } from './terrainView';

interface Tree { x: number; y: number; z: number; s: number; rot: number; dark: boolean; lean: number }

export interface Vegetation {
  objects: THREE.Object3D[];
  /** Abat les arbres dans un rectangle (coordonnées 3D). */
  abattre(x0: number, z0: number, x1: number, z1: number): void;
}

export function buildVegetation(tv: TerrainView, d: Domain): Vegetation {
  const { N, CELL } = tv;
  const r = rng(d.seed + 99), nz = makeNoise(rng(d.seed + 5));
  const sx = d.station.x / CELL, sz = d.station.z / CELL, clear = d.station.R + FORET.lisiereStation;
  const target = Math.min(FORET.arbresMax, Math.round(FORET.densite * (tv.mapW / 200) ** 2));
  const spots: Record<'pine' | 'larch' | 'ghost', Tree[]> = { pine: [], larch: [], ghost: [] };
  let total = 0;
  for (let t = 0; t < target * 16 && total < target; t++) {
    const fi = r() * N, fj = r() * N;
    const wx = (fi * CELL) / 1000, wz = (fj * CELL) / 1000;
    const alt = tv.altAt(fi, fj);
    if (tv.slopeAt(fi, fj) > FORET.penteMax || tv.isLakeOrRiver(fi, fj)) continue;
    if (Math.hypot(fi - sx, fj - sz) * CELL < clear) continue;          // aire de la station, laissée libre pour le joueur
    // limite de la forêt : plus basse en ubac, plus haute en adret, bords irréguliers
    const lim = FORET.limite - tv.northAt(fi, fj) * FORET.ecartUbac + nz(wx * 0.8, wz * 0.8) * FORET.irregularite;
    if (alt > lim + 170) continue;
    const dens = nz(wx * 0.75 + 20, wz * 0.75 + 20) + nz(wx * 2.5, wz * 2.5) * 0.35;
    let kind: keyof typeof spots;
    if (alt < lim - 260) { if (dens < 0.02) continue; kind = r() < 0.12 ? 'larch' : 'pine'; }
    else if (alt < lim) { if (dens < -0.05 || r() > 0.55 - ((alt - (lim - 260)) / 260) * 0.35) continue; kind = r() < 0.55 ? 'larch' : 'pine'; }
    else { if (r() > 0.22) continue; kind = 'ghost'; }
    const s = (kind === 'ghost' ? 0.45 + r() * 0.35 : 0.75 + r() * 0.55) * OBJETS.echelle;
    spots[kind].push({ x: tv.toW(fi), y: tv.Y(alt), z: tv.toW(fj), s, rot: r() * Math.PI, dark: r() < 0.4, lean: (r() - 0.5) * 0.25 });
    total++;
  }

  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Tree[], color?: (t: Tree) => THREE.Color) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    im.count = list.length;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    list.forEach((t, k) => {
      e.set(t.lean, t.rot, t.lean * 0.6); q.setFromEuler(e); sc.setScalar(t.s); v.set(t.x, t.y - 0.1, t.z);
      m.compose(v, q, sc); im.setMatrixAt(k, m);
      if (color) im.setColorAt(k, color(t));
    });
    im.castShadow = im.receiveShadow = true;
    return im;
  };
  const cone = new THREE.ConeGeometry(0.55, 1.9, 6); cone.translate(0, 0.9, 0);
  const tip = new THREE.ConeGeometry(0.28, 0.7, 6); tip.translate(0, 1.55, 0);
  const larch = new THREE.ConeGeometry(0.34, 1.9, 5); larch.translate(0, 0.95, 0);
  const ghost = new THREE.ConeGeometry(0.5, 1.1, 5); ghost.translate(0, 0.5, 0);
  const meshes: [THREE.InstancedMesh, Tree[]][] = [
    [make(cone, new THREE.MeshLambertMaterial(), spots.pine, t => (t.dark ? C.pineDark : C.pine)), spots.pine],
    [make(tip, new THREE.MeshLambertMaterial({ color: C.powder }), spots.pine), spots.pine],
    [make(larch, new THREE.MeshLambertMaterial({ color: C.larch }), spots.larch), spots.larch],
    [make(ghost, new THREE.MeshLambertMaterial({ color: C.ghost }), spots.ghost), spots.ghost],
  ];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    objects: meshes.map(([im]) => im),
    abattre(x0, z0, x1, z1) {
      for (const [im, list] of meshes) {
        let changed = false;
        list.forEach((t, k) => { if (t.x > x0 && t.x < x1 && t.z > z0 && t.z < z1) { im.setMatrixAt(k, zero); changed = true; } });
        if (changed) im.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
