// Terrain à facettes et socle du diorama.
import * as THREE from 'three';
import { clamp, makeNoise, rng } from '../gen/math';
import { TOPO } from '../params/affichage';
import { ECHELLE } from '../params/monde';
import { NEIGE } from '../params/neige';
import { shared } from './shaders';
import { C } from './palette';
import type { TerrainView } from './terrainView';

export function buildTerrain(tv: TerrainView, seed: number): THREE.Mesh {
  const { N, W, CELL, lake, conv, crestT, rockLim } = tv;
  const r = rng(seed + 7), n2 = makeNoise(rng(seed + 21)), n3 = makeNoise(rng(seed + 23));
  const pos = new Float32Array(N * N * 18), col = new Float32Array(N * N * 18);
  let p = 0;
  const tmp = new THREE.Color();
  // convexité lissée sur quelques centaines de mètres : dessine des nervures et des couloirs continus
  const ribs = new Float32Array(W * W), rad = Math.max(1, Math.round(NEIGE.lissageNervures / CELL));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let sum = 0, cnt = 0;
    for (let b = Math.max(1, j - rad); b <= Math.min(N - 1, j + rad); b++)
      for (let a = Math.max(1, i - rad); a <= Math.min(N - 1, i + rad); a++) { sum += conv[b * W + a]; cnt++; }
    ribs[j * W + i] = cnt ? sum / cnt : 0;
  }

  const tri = (i1: number, j1: number, i2: number, j2: number, i3: number, j3: number) => {
    const a = tv.hAt(i1, j1), b = tv.hAt(i2, j2), c = tv.hAt(i3, j3);
    const ux = (i2 - i1) * CELL, uz = (j2 - j1) * CELL, uy = b - a;
    const vx = (i3 - i1) * CELL, vz = (j3 - j1) * CELL, vy = c - a;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const hl = Math.hypot(nx, nz);
    // pente lissée à l'échelle de la case : plaques de roche plus nettes
    const pct = tv.slopeAt(Math.min(i1, i2, i3) + 0.5, Math.min(j1, j2, j3) + 0.5) * 0.6 + (hl / ny) * 40;
    const north = hl > 1e-6 ? -nz / hl : 0;       // normale vers -z = versant nord
    const westward = hl > 1e-6 ? -nx / hl : 0;    // face au vent dominant d'ouest
    const alt = (a + b + c) / 3;
    const cv = conv[j1 * W + i1];
    const crest = cv > crestT && alt > 2300;

    // seuil de roche, abaissé en haute altitude où le vent et le froid décapent les faces
    const lim = rockLim * (1 - NEIGE.decapageMax * clamp((alt - NEIGE.decapageAlt) / 1000, 0, 1));
    // faces raides : la roche perce sur les nervures convexes, la neige reste dans les couloirs concaves
    let rockBand = false;
    const ci = Math.min(i1, i2, i3), cj = Math.min(j1, j2, j3);
    const cellPct = tv.slopeAt(ci + 0.5, cj + 0.5), start = lim * NEIGE.rocheDebut;
    if (cellPct > start) {
      const band = (cellPct - start) / (lim - start);
      const rib = clamp(ribs[cj * W + ci] / (crestT * NEIGE.nervure), -0.6, 0.6);
      const n = n3((ci * CELL) / NEIGE.plaque, (cj * CELL) / NEIGE.plaque) * 0.35;
      rockBand = band + rib + n > 0.75;
    }

    if (lake[j1 * W + i1] && lake[j2 * W + i2] && lake[j3 * W + i3]) tmp.copy(C.powder);
    else if (pct >= lim || rockBand || (crest && westward > 0.3 && pct > lim * 0.55)) {
      // roche : parois raides, barres rocheuses et crêtes soufflées côté vent
      tmp.copy(C.rock).lerp(C.rockLight, r() * 0.6 + (alt - 2000) / 4000);
    } else {
      // neige : poudreuse en ubac, transformée en adret, dure sur les crêtes, éclatante dans les combes
      tmp.copy(C.powder).lerp(C.adret, clamp(-north * 0.8 + 0.1, 0, 1) * clamp((pct - 8) / 30, 0, 1));
      if (cv < -crestT * 0.6 && north > 0) tmp.lerp(C.bowl, 0.7);
      if (crest) tmp.lerp(C.hardpack, clamp(cv / (crestT * 3), 0, 1) * 0.8);
      tmp.multiplyScalar(0.965 + clamp((alt - 1100) / 1500, 0, 1) * 0.035);
      // limite pluie-neige : des prés percent en adret à basse altitude
      const rain = NEIGE.limitePluieNeige - north * NEIGE.limiteEcartUbac;
      if (alt < rain) {
        const n = n2((i1 * CELL) / 400, (j1 * CELL) / 400) * 0.5 + 0.5;
        if (n > 0.45 + ((alt - (rain - 250)) / 250) * 0.55) tmp.copy(C.meadow).lerp(C.meadow2, r());
      }
    }
    tmp.offsetHSL(0, 0, (r() - 0.5) * 0.03);
    for (const [ii, jj, hh] of [[i1, j1, a], [i2, j2, b], [i3, j3, c]]) {
      pos[p] = tv.toW(ii); pos[p + 1] = tv.Y(hh); pos[p + 2] = tv.toW(jj);
      col[p] = tmp.r; col[p + 1] = tmp.g; col[p + 2] = tmp.b;
      p += 3;
    }
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    tri(i, j, i, j + 1, i + 1, j);
    tri(i + 1, j, i, j + 1, i + 1, j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, topoMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * Matériau du relief avec le filtre topographique : courbes de niveau tous les TOPO.equidistance mètres,
 * calculées au pixel (épaisseur constante à tous les zooms). Là où les courbes ordinaires se serreraient
 * au point de former un aplat (parois), elles s'effacent et seules les maîtresses restent.
 */
function topoMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTopo = shared.topo;
    sh.uniforms.uTopoColor = { value: new THREE.Color(TOPO.couleur) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vAltM;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAltM = position.y / ${ECHELLE.VEX.toFixed(4)} * ${ECHELLE.UNIT.toFixed(1)} + ${ECHELLE.ALT0.toFixed(1)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAltM; uniform float uTopo; uniform vec3 uTopoColor;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uTopo > 0.001) {
          float fw = max(fwidth(vAltM), 1e-4);
          // distance (en pixels) à la courbe la plus proche
          float dMin = abs(fract(vAltM / ${TOPO.equidistance.toFixed(1)} + .5) - .5) * ${TOPO.equidistance.toFixed(1)} / fw;
          float dMaj = abs(fract(vAltM / ${TOPO.maitresse.toFixed(1)} + .5) - .5) * ${TOPO.maitresse.toFixed(1)} / fw;
          float minor = (1. - smoothstep(${(TOPO.epaisseur / 2).toFixed(2)}, ${(TOPO.epaisseur / 2 + 1).toFixed(2)}, dMin))
                      * (1. - smoothstep(${(1 / TOPO.ecartMin).toFixed(3)}, ${(2 / TOPO.ecartMin).toFixed(3)}, fw / ${TOPO.equidistance.toFixed(1)}));   // courbes trop serrées : effacées
          float major = (1. - smoothstep(${(TOPO.epaisseurMaitresse / 2).toFixed(2)}, ${(TOPO.epaisseurMaitresse / 2 + 1).toFixed(2)}, dMaj))
                      * (1. - smoothstep(${(1 / TOPO.ecartMin).toFixed(3)}, ${(2 / TOPO.ecartMin).toFixed(3)}, fw / ${TOPO.maitresse.toFixed(1)}))
                      // vue d'ensemble : les maîtresses se rapprochent, on les allège pour garder une carte légère
                      * (1. - ${(1 - TOPO.vueEnsemble).toFixed(2)} * smoothstep(${(1 / TOPO.ecartConfort).toFixed(4)}, ${(1 / TOPO.ecartMin).toFixed(4)}, fw / ${TOPO.maitresse.toFixed(1)}));
          float a = max(minor * ${TOPO.opacite.toFixed(2)}, major * ${TOPO.opaciteMaitresse.toFixed(2)}) * uTopo;
          diffuseColor.rgb = mix(diffuseColor.rgb, uTopoColor, a);
        }`);
  };
  return m;
}

export function buildSkirt(tv: TerrainView): THREE.Mesh {
  const { N } = tv;
  const BASE = -6, band = 0.5, pos: number[] = [], col: number[] = [];
  const push = (x: number, y: number, z: number, c: THREE.Color) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); };
  const quad = (i1: number, j1: number, i2: number, j2: number) => {
    const x1 = tv.toW(i1), z1 = tv.toW(j1), x2 = tv.toW(i2), z2 = tv.toW(j2);
    const h1 = tv.Y(tv.hAt(i1, j1)), h2 = tv.Y(tv.hAt(i2, j2));
    push(x1, h1, z1, C.rim); push(x2, h2, z2, C.rim); push(x1, h1 - band, z1, C.rim);
    push(x2, h2, z2, C.rim); push(x2, h2 - band, z2, C.rim); push(x1, h1 - band, z1, C.rim);
    push(x1, h1 - band, z1, C.earthTop); push(x2, h2 - band, z2, C.earthTop); push(x1, BASE, z1, C.earthBot);
    push(x2, h2 - band, z2, C.earthTop); push(x2, BASE, z2, C.earthBot); push(x1, BASE, z1, C.earthBot);
  };
  for (let k = 0; k < N; k++) { quad(k, N, k + 1, N); quad(N, k + 1, N, k); quad(k + 1, 0, k, 0); quad(0, k, 0, k + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}
