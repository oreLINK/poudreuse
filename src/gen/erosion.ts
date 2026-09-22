// Érosion hydraulique par gouttes : creuse les ravines, dépose des cônes en bas de pente.
import type { Rng } from './math';

export function erode(h: Float32Array, N: number, CELL: number, r: Rng, drops: number): void {
  const W = N + 1;
  // on travaille en « cases » pour que les pentes soient sans dimension
  const hn = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) hn[i] = h[i] / CELL;
  const R = 2, brush: [number, number, number][] = [];
  let wsum = 0;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
    const d = Math.hypot(a, b);
    if (d <= R) { const w = 1 - d / R; brush.push([a, b, w]); wsum += w; }
  }
  for (const b of brush) b[2] /= wsum;
  const inertia = 0.08, capF = 0.6, minCap = 0.002, erS = 0.2, depS = 0.25, evap = 0.025, grav = 4, life = 40;

  const sample = (x: number, z: number): [number, number, number] => {
    const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, k = j * W + i;
    const a = hn[k], b = hn[k + 1], c = hn[k + W], d = hn[k + W + 1];
    return [
      a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v,
      (b - a) * (1 - v) + (d - c) * v,
      (c - a) * (1 - u) + (d - b) * u,
    ];
  };

  for (let n = 0; n < drops; n++) {
    let x = 1 + r() * (N - 3), z = 1 + r() * (N - 3), dx = 0, dz = 0, speed = 1, water = 1, sed = 0;
    for (let s = 0; s < life; s++) {
      const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j;
      const [hOld, gx, gz] = sample(x, z);
      dx = dx * inertia - gx * (1 - inertia);
      dz = dz * inertia - gz * (1 - inertia);
      const len = Math.hypot(dx, dz);
      if (len < 1e-9) break;
      dx /= len; dz /= len; x += dx; z += dz;
      if (x < 1 || z < 1 || x > N - 2 || z > N - 2) break;
      const dh = sample(x, z)[0] - hOld;
      const cap = Math.max(-dh * speed * water * capF, minCap);
      const k = j * W + i;
      if (sed > cap || dh > 0) {
        const dep = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depS;
        sed -= dep;
        hn[k] += dep * (1 - u) * (1 - v); hn[k + 1] += dep * u * (1 - v);
        hn[k + W] += dep * (1 - u) * v; hn[k + W + 1] += dep * u * v;
      } else {
        const er = Math.min((cap - sed) * erS, -dh);
        for (const [a, b, w] of brush) {
          const ii = i + a, jj = j + b;
          if (ii < 0 || jj < 0 || ii > N || jj > N) continue;
          const kk = jj * W + ii, e = Math.min(hn[kk], er * w);
          hn[kk] -= e; sed += e;
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed + dh * grav));
      water *= 1 - evap;
    }
  }
  for (let i = 0; i < h.length; i++) h[i] = hn[i] * CELL;
}
