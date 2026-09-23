// Génération complète d'un domaine : relief, pics, érosion, lacs, aire de la station, hydrologie, altitude réelle.
import { STATION } from '../params/amenagement';
import { DEFAULT_SIZE, SIZES, type SizeKey } from '../params/monde';
import { ALTITUDE, EROSION, LACS, PICS, RELIEF, TYPES, type TypeKey } from '../params/terrain';
import { makeNoise, rng, smax, smin, smooth } from './math';
import { buildNetwork } from './network';
import { erode } from './erosion';
import { fillDepressions, traceRivers } from './hydrology';
import type { Domain } from './types';

interface Segment { ax: number; az: number; aa: number; bx: number; bz: number; ba: number; w: number; dx: number; dz: number; l2: number }

export function generateDomain(seed: number, size: SizeKey = DEFAULT_SIZE): Domain {
  const { km, CELL, rang } = SIZES[size];
  const N = Math.round((km * 1000) / CELL), L = N * CELL, W = N + 1;
  const r = rng(seed), noise = makeNoise(r);
  const o = Array.from({ length: 12 }, () => r() * 200);
  const fbm = (x: number, y: number, freq: number, oct: number, gain: number, k: number) => {
    let s = 0, amp = 1, f = freq, n = 0;
    for (let i = 0; i < oct; i++) { s += noise(x * f + o[k], y * f + o[k + 1]) * amp; n += amp; amp *= gain; f *= 2.03; }
    return s / n;
  };
  const ridged = (x: number, y: number, freq: number, oct: number, gain: number, sharp: number, k: number) => {
    let s = 0, amp = 1, f = freq, n = 0;
    for (let i = 0; i < oct; i++) { s += Math.pow(1 - Math.abs(noise(x * f + o[k], y * f + o[k + 1])), sharp) * amp; n += amp; amp *= gain; f *= 2.1; }
    return s / n;
  };

  const net = buildNetwork(r, noise, L);

  // ---------- Segments de vallée + index spatial ----------
  const segs: Segment[] = [];
  for (const v of net.valleys) for (let i = 0; i < v.pts.length - 1; i++) {
    const [ax, az, aa] = v.pts[i], [bx, bz, ba] = v.pts[i + 1];
    segs.push({ ax, az, aa, bx, bz, ba, w: v.w, dx: bx - ax, dz: bz - az, l2: (bx - ax) ** 2 + (bz - az) ** 2 || 1 });
  }
  const BK = 3000, RS = 7500, NB = Math.ceil(L / BK) + 1;
  const segDist = (s: Segment, x: number, z: number) => {
    const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.l2));
    return [Math.hypot(x - s.ax - s.dx * t, z - s.az - s.dz * t), t] as const;
  };
  const buckets: Segment[][] = [];
  for (let bz = 0; bz < NB; bz++) for (let bx = 0; bx < NB; bx++) {
    const cx = (bx + 0.5) * BK, cz = (bz + 0.5) * BK, lim = RS + BK * 0.71;
    const list = segs.filter(s => segDist(s, cx, cz)[0] < lim);
    buckets.push(list.length ? list : segs);
  }
  const segsNear = (x: number, z: number) =>
    buckets[Math.min(NB - 1, Math.max(0, Math.floor(z / BK))) * NB + Math.min(NB - 1, Math.max(0, Math.floor(x / BK)))];
  const distValleys = (x: number, z: number) => { let d = Infinity; for (const s of segsNear(x, z)) d = Math.min(d, segDist(s, x, z)[0]); return d; };

  // ---------- Régions de caractère (alpin, aiguilles, ballons, volcan) ----------
  const typeKeys = Object.keys(TYPES) as TypeKey[];
  const nReg = Math.max(4, Math.min(14, Math.round((L * L) / 8e7)));
  const order = typeKeys.slice().sort(() => r() - 0.5);
  const regions: { x: number; z: number; type: TypeKey }[] = [];
  for (let k = 0; k < nReg; k++) {
    const type = k < 4 ? order[k] : typeKeys[Math.floor(r() * 4)];
    let best = { x: L / 2, z: L / 2, type }, bd = -Infinity;
    for (let t = 0; t < (type === 'volcan' ? 40 : 12); t++) {
      const x = (0.05 + r() * 0.9) * L, z = (0.05 + r() * 0.9) * L;
      let score = type === 'volcan' ? distValleys(x, z) : 0;   // les volcans loin des vallées
      let near = Infinity;
      for (const g of regions) near = Math.min(near, Math.hypot(g.x - x, g.z - z));
      score += Math.min(near, L) * (type === 'volcan' ? 0.3 : 1);
      if (score > bd) { bd = score; best = { x, z, type }; }
    }
    regions.push(best);
  }
  const sigma = Math.max(3500, (L / Math.sqrt(nReg)) * 0.55);
  const volcanoes = regions.filter(g => g.type === 'volcan')
    .map(g => ({ ...g, amp: 1200 + r() * 300, R: 3300, rc: 330 + r() * 150, breach: r() * Math.PI * 2 }));

  // ---------- Relief ----------
  const h = new Float32Array(W * W);
  const dminArr = new Float32Array(W * W);
  for (let jz = 0; jz <= N; jz++) for (let ix = 0; ix <= N; ix++) {
    const x0 = ix * CELL, z0 = jz * CELL;
    const x = x0 + fbm(x0, z0, 1 / 5000, 2, 0.5, 0) * 450, z = z0 + fbm(x0, z0, 1 / 5000, 2, 0.5, 2) * 450;
    let ws = 0, pH = 0, pLam = 0, pK = 0, pRough = 0, pNeedle = 0;
    for (const g of regions) {
      const w = Math.exp(-((x - g.x) ** 2 + (z - g.z) ** 2) / (sigma * sigma)) + 1e-9, t = TYPES[g.type];
      ws += w; pH += t.H * w; pLam += t.lam * w; pK += t.k * w; pRough += t.rough * w; pNeedle += t.needle * w;
    }
    pH /= ws; pLam /= ws; pK /= ws; pRough /= ws; pNeedle /= ws;
    const Hm = pH * (1 + rang * RELIEF.hausseParRang) * (0.72 + 0.56 * (fbm(x, z, 1 / 6500, 3, 0.5, 4) * 0.5 + 0.5));
    const lam = pLam * 0.85;
    let hv = Infinity, dmin = Infinity;
    for (const s of segsNear(x, z)) {
      const [d, t] = segDist(s, x, z);
      if (d < dmin) dmin = d;
      if (d > RS) continue;
      const dd = Math.max(0, d - s.w) / lam;
      const floor = s.aa + (s.ba - s.aa) * t;
      const rel = Math.max(300, 1450 + Hm * 1.1 - floor);     // hauteur des versants jusqu'au plafond régional
      const cand = floor + 180 * (1 - Math.exp(-d / 2600)) + rel * ((dd * dd) / (1 + dd * dd));
      hv = hv === Infinity ? cand : smin(hv, cand, pK);          // crêtes là où deux vallées se rencontrent
    }
    if (hv === Infinity) hv = 1500 + Hm;
    const mount = smooth(250, 1800, dmin);
    hv += (ridged(x, z, 1 / 1900, 5, 0.5, 2 + pNeedle, 6) - 0.45) * 330 * pRough * mount;
    if (pNeedle > 0.05) hv += Math.pow(Math.max(0, ridged(x, z, 1 / 700, 2, 0.5, 4, 8) - 0.55), 2) * 1100 * pNeedle * smooth(1500, 3500, dmin);
    hv += fbm(x, z, 1 / 450, 3, 0.5, 10) * 14 * (0.4 + mount);
    for (const v of volcanoes) {
      const ddx = x - v.x, ddz = z - v.z, dist = Math.hypot(ddx, ddz), d = dist / v.R;
      if (d >= 1) continue;
      const ang = Math.atan2(ddz, ddx);
      let c = 1300 + v.amp * Math.pow(1 - d, 1.75);
      const gully = Math.pow(1 - Math.abs(noise(Math.cos(ang) * 5 + o[4], Math.sin(ang) * 5 + o[5] + d * 2)), 3);
      c -= gully * 110 * smooth(0.08, 0.3, d) * smooth(0.95, 0.6, d);                 // ravines rayonnantes
      c -= Math.exp(-Math.pow(dist / v.rc, 4)) * 260                                   // cratère
        + Math.pow(Math.max(0, Math.cos(ang - v.breach)), 10) * smooth(v.rc * 2.4, v.rc * 0.8, dist) * 170; // brèche
      c += Math.exp(-Math.pow((dist - v.rc) / 110, 2)) * 40;                            // rebord
      hv += (smax(hv, c, 160) - hv) * smooth(150, 1400, dmin);
    }
    h[jz * W + ix] = hv;
    dminArr[jz * W + ix] = dmin;
  }

  // ---------- Pics rocheux à arêtes, plus nombreux et plus hauts sur les grands domaines ----------
  {
    const cand: [number, number, number][] = [];
    for (let t = 0; t < 4000; t++) {
      const i = 2 + Math.floor(r() * (N - 4)), jz = 2 + Math.floor(r() * (N - 4)), k = jz * W + i;
      if (dminArr[k] > 1700) cand.push([h[k], i, jz]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    const want = Math.round(((L * L) / 2.6e7) * (0.6 + rang * 0.3));
    const summits: { x: number; z: number; ph: number; R: number; arms: number; rot: number }[] = [];
    for (const [, ci, cj] of cand) {
      if (summits.length >= want) break;
      const x = ci * CELL, z = cj * CELL;
      if (summits.some(p => Math.hypot(p.x - x, p.z - z) < 2300)) continue;
      summits.push({ x, z, ph: (300 + r() * 420) * (1 + rang * 0.1), R: 900 + r() * 700, arms: 3 + Math.floor(r() * 2), rot: r() * 6.28 });
    }
    for (const p of summits) {
      const R = (p.R * 1.6) / CELL, ci = p.x / CELL, cj = p.z / CELL;
      for (let jz = Math.max(0, Math.floor(cj - R)); jz <= Math.min(N, Math.ceil(cj + R)); jz++) {
        for (let i = Math.max(0, Math.floor(ci - R)); i <= Math.min(N, Math.ceil(ci + R)); i++) {
          const dx = i * CELL - p.x, dz = jz * CELL - p.z, d = Math.hypot(dx, dz) / p.R;
          const star = 0.6 + 0.45 * Math.pow(Math.abs(Math.cos((p.arms * (Math.atan2(dz, dx) - p.rot)) / 2)), 3);
          const f = Math.max(0, 1 - d / star);
          if (f <= 0) continue;
          // faces creusées d'arêtes et de couloirs : sans cela, les pics ressemblent à des toits
          const x = i * CELL, z = jz * CELL;
          const facets = 1 + PICS.rugosite * (ridged(x + 5000, z - 3000, 1 / 650, 3, 0.5, 2, 6) - 0.5) * 2 * Math.min(1, d * 3);
          h[jz * W + i] += p.ph * Math.pow(f, 1.2) * facets;
        }
      }
    }
  }
  // les très hauts sommets sont tassés (ordre de grandeur réaliste)
  const { tassementSeuil: T0, tassementFacteur: TF } = RELIEF;
  for (let k = 0; k < h.length; k++) if (h[k] > T0) h[k] = T0 + (h[k] - T0) * TF;

  // ---------- Érosion hydraulique légère ----------
  erode(h, N, CELL, rng(seed + 3), Math.round(N * N * EROSION.gouttesParCase));

  // ---------- Lacs d'altitude : cuvette de cirque fermée par un verrou rocheux ----------
  const lakeZone = new Uint8Array(W * W);
  const hAtM = (x: number, z: number) => h[Math.min(N, Math.max(0, Math.round(z / CELL))) * W + Math.min(N, Math.max(0, Math.round(x / CELL)))];
  for (const lk of net.lakes) {
    const level = hAtM(lk.x, lk.z);
    if (level < LACS.altitudeMin) continue;
    const R = (lk.R * 1.8) / CELL, ci = lk.x / CELL, cj = lk.z / CELL;
    for (let j = Math.max(0, Math.floor(cj - R)); j <= Math.min(N, Math.ceil(cj + R)); j++) {
      for (let i = Math.max(0, Math.floor(ci - R)); i <= Math.min(N, Math.ceil(ci + R)); i++) {
        const d = (Math.hypot(i - ci, j - cj) * CELL) / lk.R, k = j * W + i;
        if (d >= 1.8) continue;
        if (d < 1.15) lakeZone[k] = 1;
        if (d < 1) h[k] = Math.min(h[k], level - 30 * (1 - d * d));
        else { const rim = Math.max(h[k], level + 8 + (d - 1) * 60); h[k] = rim + (h[k] - rim) * smooth(1.3, 1.8, d); }
      }
    }
  }

  // ---------- Aire de la station : terrain plat, parmi les sites les plus bas, pour le village du joueur ----------
  const station = flattenStation(h, N, CELL, lakeZone, size);

  // ---------- Hydrologie ----------
  const { lake, parent, eps } = fillDepressions(h, N, CELL, lakeZone);
  const { rivers, isRiver } = traceRivers(h, N, CELL, lake, parent, eps, seed);

  // ---------- Altitude réelle : toute la carte est relevée d'un même décalage (les pentes ne changent pas) ----------
  const dz = relever(h, rng(seed + 32));
  for (const river of rivers) for (const p of river) p[3] += dz;

  station.alt = hAtM(station.x, station.z);
  return { seed, N, CELL, L, h, lake, isRiver, rivers, station };
}

/**
 * Relève la carte pour que son point bas tombe dans ALTITUDE.pointBas, tiré au hasard,
 * abaissé si besoin pour que les sommets ne dépassent pas ALTITUDE.sommetMax. Renvoie le décalage (m).
 */
function relever(h: Float32Array, r: () => number): number {
  let mn = Infinity, mx = -Infinity;
  for (const v of h) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const [bas, haut] = ALTITUDE.pointBas;
  const cible = Math.max(bas, Math.min(bas + r() * (haut - bas), ALTITUDE.sommetMax - (mx - mn)));
  const dz = cible - mn;
  for (let k = 0; k < h.length; k++) h[k] += dz;
  return dz;
}

/**
 * Choisit le site de l'aire de la station et l'aplanit.
 * Les sites candidats couvrent la carte ; on garde les plus bas (sites distincts), puis celui qui demande le moins de terrassement.
 * L'aire devient un plan légèrement incliné dans son sens naturel, avec un dévers vers le bord le plus bas
 * pour que l'eau la longe, raccordé au relief par un talus.
 */
function flattenStation(h: Float32Array, N: number, CELL: number, lakeZone: Uint8Array, size: SizeKey): Domain['station'] {
  const W = N + 1, L = N * CELL, R = STATION.rayon[size], bank = R * STATION.talus;
  const Rc = R / CELL, margin = Math.max(R + bank, L * STATION.bordMin);
  const stride = Math.max(1, Math.round(Rc / 8));
  /** Parcourt les sommets de grille du disque de rayon rad (cases) autour de (ci, cj). */
  const disk = (ci: number, cj: number, rad: number, st: number, f: (k: number, dx: number, dz: number) => void) => {
    for (let j = Math.max(0, Math.floor(cj - rad)); j <= Math.min(N, Math.ceil(cj + rad)); j += st)
      for (let i = Math.max(0, Math.floor(ci - rad)); i <= Math.min(N, Math.ceil(ci + rad)); i += st) {
        const dx = i - ci, dz = j - cj;
        if (dx * dx + dz * dz <= rad * rad) f(j * W + i, dx, dz);
      }
  };

  // sites candidats : altitude moyenne et rugosité (écart moyen à cette altitude)
  const sites: { x: number; z: number; mean: number; rough: number }[] = [];
  for (let z = margin; z <= L - margin; z += R / 2) for (let x = margin; x <= L - margin; x += R / 2) {
    const ci = x / CELL, cj = z / CELL;
    let sum = 0, n = 0, wet = false;
    disk(ci, cj, Rc, stride, k => { sum += h[k]; n++; if (lakeZone[k]) wet = true; });
    if (wet || !n) continue;
    const mean = sum / n;
    let dev = 0;
    disk(ci, cj, Rc, stride, k => { dev += Math.abs(h[k] - mean); });
    sites.push({ x, z, mean, rough: dev / n });
  }
  if (!sites.length) sites.push({ x: L / 2, z: L / 2, mean: h[Math.round(N / 2) * W + Math.round(N / 2)], rough: 0 });
  sites.sort((a, b) => a.mean - b.mean);
  const lowest: typeof sites = [];
  for (const s of sites) {
    if (lowest.length >= STATION.candidats[size]) break;
    if (lowest.every(o => Math.hypot(o.x - s.x, o.z - s.z) > 2 * R)) lowest.push(s);
  }
  const site = lowest.reduce((a, b) => (b.rough < a.rough ? b : a));

  // plan ajusté au terrain (moindres carrés), pente bornée
  const ci = site.x / CELL, cj = site.z / CELL;
  let sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0;
  disk(ci, cj, Rc, 1, (k, dx, dz) => {
    const r = h[k] - site.mean;
    sxx += dx * dx; szz += dz * dz; sxz += dx * dz; sxh += dx * r; szh += dz * r;
  });
  const det = sxx * szz - sxz * sxz || 1;
  let gx = ((szz * sxh - sxz * szh) / det) / CELL, gz = ((sxx * szh - sxz * sxh) / det) / CELL;
  const gl = Math.hypot(gx, gz);
  if (gl < 1e-6) { gx = 1; gz = 0; } else { gx /= gl; gz /= gl; }
  const along = Math.min(Math.max(gl * 100, STATION.penteLongMin), STATION.penteLongMax) / 100;
  // dévers vers le côté où le terrain est naturellement le plus bas
  let side = 0;
  disk(ci, cj, Rc, stride, (k, dx, dz) => { side += (h[k] - site.mean) * Math.sign(dx * -gz + dz * gx); });
  const cross = (STATION.devers / 100) * (side >= 0 ? 1 : -1);
  const plane = (dx: number, dz: number) => site.mean + (dx * gx + dz * gz) * CELL * along + (dx * -gz + dz * gx) * CELL * cross;

  disk(ci, cj, (R + bank) / CELL, 1, (k, dx, dz) => {
    const t = smooth(R, R + bank, Math.hypot(dx, dz) * CELL);
    h[k] = plane(dx, dz) + (h[k] - plane(dx, dz)) * t;
  });
  return { x: site.x, z: site.z, alt: site.mean, R };
}
