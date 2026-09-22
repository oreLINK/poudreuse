// Hydrologie : remplissage des cuvettes (lacs plats, pente minimale ailleurs),
// directions d'écoulement, surfaces drainées et tracé des cours d'eau.
import { rng } from './math';
import type { RiverPoint } from './types';

const NB8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

/** File de priorité minimale (tas binaire) sur des indices de cases. */
class MinHeap {
  private v: number[] = [];
  private i: number[] = [];
  get size() { return this.v.length; }
  push(val: number, idx: number) {
    const { v, i } = this;
    v.push(val); i.push(idx);
    let k = v.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (v[p] <= v[k]) break;
      [v[p], v[k]] = [v[k], v[p]]; [i[p], i[k]] = [i[k], i[p]];
      k = p;
    }
  }
  pop(): number {
    const { v, i } = this;
    const top = i[0];
    const lv = v.pop()!, li = i.pop()!;
    if (v.length) {
      v[0] = lv; i[0] = li;
      let k = 0;
      for (;;) {
        const a = 2 * k + 1, b = a + 1;
        let m = k;
        if (a < v.length && v[a] < v[m]) m = a;
        if (b < v.length && v[b] < v[m]) m = b;
        if (m === k) break;
        [v[m], v[k]] = [v[k], v[m]]; [i[m], i[k]] = [i[k], i[m]];
        k = m;
      }
    }
    return top;
  }
}

/**
 * Priority-flood : chaque case obtient un chemin de descente vers le bord.
 * Dans les zones de lac, le remplissage est parfaitement plat ; ailleurs, pente minimale `eps`.
 * Renvoie le masque des lacs et la case « parente » (vers l'exutoire) de chaque case.
 */
/** Un passage de priority-flood. `flat` = cases remplies à plat (lacs), les autres gardent une pente minimale. */
function flood(h: Float32Array, W: number, eps: number, flat: Uint8Array, detect: Uint8Array | null) {
  const done = new Uint8Array(W * W), parent = new Int32Array(W * W).fill(-1);
  const heap = new MinHeap();
  for (let i = 0; i < W; i++) {
    for (const idx of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (!done[idx]) { done[idx] = 1; heap.push(h[idx], idx); }
  }
  while (heap.size) {
    const idx = heap.pop();
    const v = h[idx], cx = idx % W, cz = (idx / W) | 0;
    for (const [dx, dz] of NB8) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
      const n = nz * W + nx;
      if (done[n]) continue;
      done[n] = 1; parent[n] = idx;
      const e = flat[n] ? 0 : eps * (dx && dz ? 1.414 : 1);
      if (h[n] < v + e) { if (detect && flat[n] && v + e - h[n] > 0.5) detect[n] = 1; h[n] = v + e; }
      heap.push(h[n], n);
    }
  }
  return parent;
}

/**
 * Priority-flood : chaque case obtient un chemin de descente vers le bord.
 * 1er passage : les cuvettes des lacs se remplissent à plat, on repère les vrais lacs.
 * 2e passage : tout ce qui n'est pas lac reçoit une pente minimale `eps`.
 * Renvoie le masque des lacs et la case « parente » (vers l'exutoire) de chaque case.
 */
export function fillDepressions(h: Float32Array, N: number, CELL: number, lakeZone: Uint8Array) {
  const W = N + 1, eps = CELL * 0.02;
  const lake = new Uint8Array(W * W);
  flood(h, W, eps, lakeZone, lake);
  // un lac = seulement les cases réellement inondées, et d'une surface suffisante
  const seen = new Uint8Array(W * W);
  for (let s = 0; s < W * W; s++) {
    if (!lake[s] || seen[s]) continue;
    const comp = [s]; seen[s] = 1;
    for (let q = 0; q < comp.length; q++) {
      const c = comp[q], cx = c % W, cz = (c / W) | 0;
      for (const [a, b] of NB8.slice(0, 4)) {
        const nx = cx + a, nz = cz + b;
        if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
        const n = nz * W + nx;
        if (lake[n] && !seen[n]) { seen[n] = 1; comp.push(n); }
      }
    }
    if (comp.length * CELL * CELL < 60000) for (const c of comp) lake[c] = 0;
  }
  const parent = flood(h, W, eps, lake, null);
  return { lake, parent, eps };
}

/**
 * Cours d'eau : l'eau suit la ligne de plus grande pente (départage aléatoire des replats),
 * on cumule la surface drainée et on garde les rivières au bassin versant suffisant.
 */
export function traceRivers(h: Float32Array, N: number, CELL: number, lake: Uint8Array, parent: Int32Array, eps: number, seed: number) {
  const W = N + 1;
  const rr = rng(seed + 11);
  const jit = new Float32Array(W * W);
  for (let i = 0; i < W * W; i++) jit[i] = rr() * eps * 0.9;
  const recv = new Int32Array(W * W).fill(-1);
  for (let cz = 0; cz < W; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx;
    let best = -1, bs = 0;
    if (!lake[i]) for (const [dx, dz] of NB8) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
      const n = nz * W + nx, sl = (h[i] + jit[i] - h[n] - jit[n]) / (dx && dz ? 1.414 : 1);
      if (sl > bs && h[n] <= h[i]) { bs = sl; best = n; }
    }
    recv[i] = best >= 0 ? best : parent[i];
  }
  // surfaces drainées (tri topologique)
  const indeg = new Int32Array(W * W);
  for (let i = 0; i < W * W; i++) if (recv[i] >= 0) indeg[recv[i]]++;
  const acc = new Float32Array(W * W).fill(1), stack: number[] = [];
  for (let i = 0; i < W * W; i++) if (!indeg[i]) stack.push(i);
  while (stack.length) {
    const i = stack.pop()!, n = recv[i];
    if (n < 0) continue;
    acc[n] += acc[i];
    if (--indeg[n] === 0) stack.push(n);
  }
  const minCells = 2.4e6 / (CELL * CELL); // bassin versant minimal ~2,4 km²
  const isRiver = new Uint8Array(W * W);
  for (let i = 0; i < W * W; i++) if (acc[i] >= minCells) isRiver[i] = 1;
  const hasRiverChild = new Uint8Array(W * W);
  for (let i = 0; i < W * W; i++) if (isRiver[i] && recv[i] >= 0) hasRiverChild[recv[i]] = 1;

  const rivers: RiverPoint[][] = [];
  const used = new Uint8Array(W * W);
  const minLen = Math.max(6, 1500 / CELL);
  for (let i = 0; i < W * W; i++) {
    if (!isRiver[i] || hasRiverChild[i]) continue;
    const pts: RiverPoint[] = [];
    let c = i, guard = 0;
    while (c >= 0 && isRiver[c] && guard++ < W * 4) {
      pts.push([c % W, (c / W) | 0, acc[c], h[c]]);
      if (used[c]) break;
      used[c] = 1; c = recv[c];
    }
    const last = pts[pts.length - 1];
    const joins = pts.length >= 3 && used[last[1] * W + last[0]] && acc[i] > minCells * 3;
    if (pts.length >= minLen || joins) rivers.push(pts);
    else for (const p of pts.slice(0, -1)) isRiver[p[1] * W + p[0]] = 0;
  }
  return { rivers, isRiver };
}
