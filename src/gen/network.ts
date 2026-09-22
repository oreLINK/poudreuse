// Réseau de vallées : vallées maîtresses (archétypes combinables), affluents, bassins en étoile,
// passe de couverture, cols et emplacements des lacs d'altitude.
import type { Noise2, Rng } from './math';
import type { Network, Valley, ValleyPoint } from './types';

type UV = [number, number];
interface Trace { p: UV[]; from?: number; g: number; w: number; base?: number }
interface Head { x: number; z: number; alt: number; v: number; dir: number }

const SP = 2700; // écart minimal entre deux fonds de vallée (m)

export function buildNetwork(r: Rng, noise: Noise2, L: number): Network {
  const valleys: Valley[] = [];
  const B = SP;
  const grid = new Map<number, [number, number, number, number][]>();
  const key = (x: number, z: number) => (Math.floor(x / B) + 1) * 10000 + (Math.floor(z / B) + 1);
  const addPt = (x: number, z: number, vi: number, pi: number) => {
    const k = key(x, z);
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push([x, z, vi, pi]);
  };
  /** Distance au point de vallée le plus proche (dans un rayon ~2 SP), en ignorant certains points. */
  const clearance = (x: number, z: number, ignore: (vi: number, pi: number) => boolean) => {
    let d = Infinity;
    const cx = Math.floor(x / B) + 1, cz = Math.floor(z / B) + 1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = grid.get((cx + a) * 10000 + cz + b);
      if (!list) continue;
      for (const [px, pz, vi, pi] of list) { if (!ignore(vi, pi)) d = Math.min(d, Math.hypot(px - x, pz - z)); }
    }
    return d;
  };
  const inside = (x: number, z: number, m = -0.03) => x > L * m && z > L * m && x < L * (1 - m) && z < L * (1 - m);
  const j = (a: number) => (r() - 0.5) * 2 * a;
  const addValley = (v: Omit<Valley, 'id'>): Valley => {
    const val = { ...v, id: valleys.length } as Valley;
    valleys.push(val);
    val.pts.forEach((p, i) => addPt(p[0], p[1], val.id, i));
    return val;
  };
  const hubs: { x: number; z: number; alt: number }[] = [];

  // ---------- Vallées maîtresses ----------
  // Chaque archétype est décrit dans une boîte unitaire, de l'aval vers l'amont.
  const ARCH: Record<string, () => Trace[]> = {
    axe: () => [{ p: [[-0.08, 0.5], [0.35, 0.45 + j(0.1)], [0.7, 0.55 + j(0.1)], [1.08, 0.5]], g: 0.016, w: 420 }],
    coude: () => {
      const k: UV = [0.5 + j(0.1), 0.35 + j(0.08)];
      return [{ p: [[-0.08, 0.3], k, [k[0] + 0.1, 0.75], [k[0] + 0.05, 1.08]], g: 0.018, w: 400 }];
    },
    confluence: () => {
      const J: UV = [0.42 + j(0.08), 0.5 + j(0.06)];
      return [
        { p: [[-0.08, 0.5], J], g: 0.016, w: 440 },
        { p: [J, [0.7, 0.3], [1.08, 0.18 + j(0.1)]], from: 0, g: 0.02, w: 360 },
        { p: [J, [0.72, 0.68], [1.08, 0.82 + j(0.1)]], from: 0, g: 0.02, w: 360 },
      ];
    },
    etoile: () => {
      const H: UV = [0.55 + j(0.06), 0.5 + j(0.06)];
      const n = 3 + Math.floor(r() * 3), a0 = r() * 6.28;
      const arms: Trace[] = [{ p: [[-0.08, 0.5 + j(0.1)], [0.25, 0.5], H], g: 0.016, w: 420 }];
      for (let k = 0; k < n; k++) {
        const a = a0 + (k * 6.28) / n + j(0.3), len = 0.3 + r() * 0.15;
        if (Math.cos(a) < -0.6) continue;
        arms.push({ p: [H, [H[0] + Math.cos(a) * len * 0.5, H[1] + Math.sin(a) * len * 0.5], [H[0] + Math.cos(a) * len, H[1] + Math.sin(a) * len]], from: 0, g: 0.035, w: 260 });
      }
      return arms;
    },
    parallele: () => {
      const n = 2 + (r() < 0.4 ? 1 : 0), out: Trace[] = [];
      for (let k = 0; k < n; k++) {
        const v = (k + 0.5) / n + j(0.05);
        out.push({ p: [[-0.08, v], [0.5, v + j(0.08)], [1.08, v + j(0.06)]], g: 0.016 + r() * 0.006, w: 400, base: k * 80 });
      }
      return out;
    },
    transmassif: () => [
      { p: [[-0.08, 0.3 + j(0.1)], [0.25, 0.35], [0.44, 0.42 + j(0.06)]], g: 0.03, w: 380 },
      { p: [[1.08, 0.7 + j(0.1)], [0.75, 0.65], [0.56, 0.58 + j(0.06)]], g: 0.03, w: 380, base: 120 },
    ],
  };
  const archNames = Object.keys(ARCH);

  // Composition : une ou plusieurs zones selon la taille, chacune avec son archétype
  const boxes: [number, number, number, number][] = [];
  if (L < 22000) boxes.push([0, 0, 1, 1]);
  else if (L < 30000 && r() < 0.5) boxes.push([0, 0, 1, 1]);
  if (!boxes.length) {
    const split = L < 40000 ? 2 : 2 + Math.floor(r() * 2);
    const vertical = r() < 0.5;
    if (L >= 30000 && r() < 0.3) boxes.push([0, 0, 1, 1]);
    else for (let k = 0; k < split; k++) boxes.push(vertical ? [k / split, 0, 1 / split, 1] : [0, k / split, 1, 1 / split]);
  }

  const mains: Valley[] = [];
  for (const [bx, bz, bw, bh] of boxes) {
    const name = archNames[Math.floor(r() * archNames.length)];
    const traces = ARCH[name]();
    const rot = Math.floor(r() * 4), mir = r() < 0.5;
    const map = ([u0, v0]: UV): UV => {
      let u = u0, v = v0;
      if (mir) u = 1 - u;
      for (let k = 0; k < rot; k++) [u, v] = [1 - v, u];
      return [(bx + u * bw) * L, (bz + v * bh) * L];
    };
    const base = 950 + r() * 250;
    const local: { pts: ValleyPoint[] }[] = [];
    for (const t of traces) {
      const P = t.p.map(map);
      const pts: ValleyPoint[] = [];
      let alt = t.from != null && t.from >= 0 ? local[t.from].pts[local[t.from].pts.length - 1][2] : base + (t.base ?? 0);
      // méandres : un point intermédiaire tous les ~800 m
      for (let s = 0; s < P.length - 1; s++) {
        const [ax, az] = P[s], [ex, ez] = P[s + 1];
        const len = Math.hypot(ex - ax, ez - az), K = Math.max(1, Math.round(len / 800));
        const nx = -(ez - az) / len, nz = (ex - ax) / len;
        for (let q = s === 0 ? 0 : 1; q <= K; q++) {
          const t2 = q / K;
          const wob = q > 0 && q < K ? noise(q * 0.37 + s * 3.1 + mains.length * 5.3, 7.7) * Math.min(1400, len * 0.12) : 0;
          const x = ax + (ex - ax) * t2 + nx * wob, z = az + (ez - az) * t2 + nz * wob;
          if (pts.length) alt += t.g * Math.hypot(x - pts[pts.length - 1][0], z - pts[pts.length - 1][1]);
          pts.push([x, z, Math.min(2100, alt)]);
        }
      }
      // l'aval d'un tracé maître doit sortir de la carte ou rejoindre une vallée existante
      if (t.from == null || t.from < 0) {
        const [sx, sz] = pts[0];
        const de = Math.min(sx, sz, L - sx, L - sz);
        if (de > L * 0.04) {
          let tgt: ValleyPoint | null = null, dm = Infinity;
          for (const mv of mains) for (const q of mv.pts) { const d = Math.hypot(q[0] - sx, q[1] - sz); if (d < dm) { dm = d; tgt = q; } }
          if (!tgt || dm > de) {
            const e = [sx, sz, L - sx, L - sz], k = e.indexOf(de);
            tgt = k === 0 ? [-L * 0.06, sz, base] : k === 1 ? [sx, -L * 0.06, base] : k === 2 ? [L * 1.06, sz, base] : [sx, L * 1.06, base];
          }
          const len = Math.hypot(sx - tgt[0], sz - tgt[1]), K = Math.max(1, Math.round(len / 800));
          const all: ValleyPoint[] = [];
          for (let q = 0; q < K; q++) {
            const f = q / K, wob = q ? noise(q * 0.41 + mains.length, 2.3) * Math.min(900, len * 0.1) : 0;
            all.push([tgt[0] + (sx - tgt[0]) * f - ((sz - tgt[1]) / len) * wob, tgt[1] + (sz - tgt[1]) * f + ((sx - tgt[0]) / len) * wob, 0]);
          }
          all.push(...pts);
          let a2 = tgt[2] + 10;
          all[0][2] = a2;
          for (let q = 1; q < all.length; q++) { a2 += t.g * Math.hypot(all[q][0] - all[q - 1][0], all[q][1] - all[q - 1][1]); all[q][2] = Math.min(2100, a2); }
          pts.length = 0; pts.push(...all);
        }
      }
      const clipped = pts.filter(p => p[0] > -L * 0.06 && p[1] > -L * 0.06 && p[0] < L * 1.06 && p[1] < L * 1.06);
      local.push({ pts: clipped.length >= 2 ? clipped : pts });
      if (clipped.length >= 2) mains.push(addValley({ pts: clipped, w: t.w, level: 0 }));
    }
    // trans-massif : un col relie les deux têtes
    if (name === 'transmassif' && local.length === 2) {
      const A = local[0].pts[local[0].pts.length - 1], Bp = local[1].pts[local[1].pts.length - 1];
      const mx = (A[0] + Bp[0]) / 2, mz = (A[1] + Bp[1]) / 2, ca = Math.max(A[2], Bp[2]) + 250 + r() * 200;
      addValley({ pts: [[A[0], A[1], A[2]], [mx, mz, ca]], w: 150, level: 4 });
      addValley({ pts: [[Bp[0], Bp[1], Bp[2]], [mx, mz, ca]], w: 150, level: 4 });
    }
    if (name === 'etoile' && local[0]) { const hb = local[0].pts[local[0].pts.length - 1]; hubs.push({ x: hb[0], z: hb[1], alt: hb[2] }); }
  }

  // ---------- Affluents : se greffent en remontant, parfois suspendus, parfois en étoile ----------
  const heads: Head[] = [];
  const queue: Valley[] = valleys.slice();
  const maxLen = [0, 10000, 6500, 4000, 2600], width = [420, 230, 160, 120, 100], prob = [0.85, 0.6, 0.42, 0.3, 0];

  const growBranch = (parentId: number, pi: number, sx: number, sz: number, salt: number, ang: number, level: number, hanging: boolean): Valley | null => {
    const pts: ValleyPoint[] = [[sx, sz, salt]];
    let a = ang, x = sx, z = sz, len = 0;
    let alt = salt + (hanging ? 140 + r() * 260 : 15);   // combe suspendue : gradin à la jonction
    const g0 = 0.045 + level * 0.012 + r() * 0.02;
    const lim = maxLen[level] * (0.45 + r() * 0.55), step = 650;
    const selfId = valleys.length;
    while (len < lim) {
      a += noise(len / 2500 + selfId * 3.7, level * 11.3) * 0.5;
      const nx = x + Math.cos(a) * step, nz = z + Math.sin(a) * step;
      if (!inside(nx, nz)) break;
      const c = clearance(nx, nz, (vi, qi) => (vi === parentId && Math.abs(qi - pi) <= 5) || vi === selfId);
      if (c < SP * 0.78) break;
      x = nx; z = nz; len += step;
      alt += step * g0 * (1 + len / 9000);
      pts.push([x, z, Math.min(2500, alt)]);
    }
    if (len < 1400) return null;
    const v = addValley({ pts, w: width[level], level, parent: parentId });
    const head = pts[pts.length - 1];
    heads.push({ x: head[0], z: head[1], alt: head[2], v: v.id, dir: a });
    return v;
  };

  const processQueue = () => {
    let guard = 0;
    while (queue.length && guard++ < 2000) {
      const v = queue.shift()!;
      if (v.level >= 4) continue;
      const lvl = v.level + 1;
      let i = 1 + Math.floor(r() * 2);
      while (i < v.pts.length - 1) {
        const [x, z, alt] = v.pts[i];
        const [x0, z0] = v.pts[Math.max(0, i - 1)], [x1, z1] = v.pts[Math.min(v.pts.length - 1, i + 1)];
        const up = v.pts[Math.min(v.pts.length - 1, i + 1)][2] >= v.pts[Math.max(0, i - 1)][2] ? 1 : -1; // sens de remontée
        const tAng = Math.atan2((z1 - z0) * up, (x1 - x0) * up);
        for (const side of [-1, 1]) {
          if (r() > prob[v.level]) continue;
          const ang = tAng + side * (Math.PI * (0.3 + r() * 0.2));
          const hanging = r() < (v.level === 0 ? 0.35 : 0.45);
          const b = growBranch(v.id, i, x, z, alt, ang, lvl, hanging);
          if (!b) continue;
          queue.push(b);
          // bassin en étoile : plusieurs vallons partent d'une même tête
          if (lvl <= 2 && r() < 0.22) {
            const hd = b.pts[b.pts.length - 1], prev = b.pts[b.pts.length - 2];
            hubs.push({ x: hd[0], z: hd[1], alt: hd[2] });
            const baseAng = Math.atan2(hd[1] - prev[1], hd[0] - prev[0]);
            for (const da of [-1.1, 0, 1.1]) {
              const sb = growBranch(b.id, b.pts.length - 1, hd[0], hd[1], hd[2], baseAng + da + (r() - 0.5) * 0.3, Math.min(4, lvl + 1), false);
              if (sb) queue.push(sb);
            }
          }
        }
        i += 2 + Math.floor(r() * 2);
      }
    }
  };
  processQueue();

  // ---------- Couverture : aucune zone ne doit rester sans vallée ----------
  const blocked = new Set<number>();
  for (let round = 0; round < 80; round++) {
    let best: { x: number; z: number; k: number } | null = null, bd = SP * 1.25;
    for (let z = L * 0.04; z < L; z += 1400) for (let x = L * 0.04; x < L; x += 1400) {
      const k = Math.round(x / 1400) * 1000 + Math.round(z / 1400);
      if (blocked.has(k)) continue;
      const d = Math.min(clearance(x, z, () => false), SP * 3) + ((x * 7 + z * 13) % 97) * 0.01;
      if (d > bd) { bd = d; best = { x, z, k }; }
    }
    if (!best) break;
    blocked.add(best.k);
    let q: { v: Valley; i: number; p: ValleyPoint } | null = null, qd = Infinity;
    for (const v of valleys) {
      if (v.level >= 4) continue;
      v.pts.forEach((p, i) => { const dd = Math.hypot(p[0] - best!.x, p[1] - best!.z); if (dd < qd) { qd = dd; q = { v, i, p }; } });
    }
    const edge = Math.min(best.x, best.z, L - best.x, L - best.z);
    let b: Valley | null = null;
    if (edge < qd * 0.8) {
      const e = [best.x, best.z, L - best.x, L - best.z], k = e.indexOf(edge);
      const sx = k === 0 ? -L * 0.03 : k === 2 ? L * 1.03 : best.x;
      const sz = k === 1 ? -L * 0.03 : k === 3 ? L * 1.03 : best.z;
      b = growBranch(-1, 0, sx, sz, 1150 + r() * 350, Math.atan2(best.z - sz, best.x - sx), 2, false);
    } else if (q) {
      const qq = q as { v: Valley; i: number; p: ValleyPoint };
      b = growBranch(qq.v.id, qq.i, qq.p[0], qq.p[1], qq.p[2], Math.atan2(best.z - qq.p[1], best.x - qq.p[0]), Math.min(4, qq.v.level + 1), r() < 0.35);
    }
    if (b) { queue.push(b); processQueue(); }
  }

  // ---------- Cols : relient deux têtes de vallée proches à travers la crête ----------
  const cols: Network['cols'] = [];
  const maxCols = Math.round((L * L) / 1.2e8) + 1;
  for (let a = 0; a < heads.length && cols.length < maxCols; a++) {
    for (let b = a + 1; b < heads.length && cols.length < maxCols; b++) {
      const A = heads[a], Bh = heads[b];
      const d = Math.hypot(A.x - Bh.x, A.z - Bh.z);
      if (d > 4200 || d < 1200 || A.v === Bh.v || r() < 0.35) continue;
      const mx = (A.x + Bh.x) / 2, mz = (A.z + Bh.z) / 2;
      if (clearance(mx, mz, vi => vi === A.v || vi === Bh.v) < SP * 0.45) continue;
      const colAlt = Math.max(A.alt, Bh.alt) + 120 + r() * 220;
      addValley({ pts: [[A.x, A.z, A.alt], [mx, mz, colAlt]], w: 130, level: 4 });
      addValley({ pts: [[Bh.x, Bh.z, Bh.alt], [mx, mz, colAlt]], w: 130, level: 4 });
      cols.push({ x: mx, z: mz, alt: colAlt });
    }
  }

  // ---------- Lacs d'altitude : cirques et centres des bassins en étoile ----------
  const lakes: Network['lakes'] = [];
  for (const hd of heads) if (hd.alt > 1800 && r() < 0.4) lakes.push({ x: hd.x - Math.cos(hd.dir) * 250, z: hd.z - Math.sin(hd.dir) * 250, R: 150 + r() * 170 });
  for (const hb of hubs) if (r() < 0.55) lakes.push({ x: hb.x, z: hb.z, R: 240 + r() * 200 });

  return { valleys, lakes, cols };
}
