// La génération tourne dans un Web Worker : la page reste fluide pendant le calcul.
import { generateDomain } from './domain';
import type { SizeKey } from '../params/monde';

export interface GenRequest { seed: number; size: SizeKey }

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const d = generateDomain(e.data.seed, e.data.size);
  // les grands tableaux sont transférés sans copie
  self.postMessage(d, { transfer: [d.h.buffer, d.lake.buffer, d.isRiver.buffer] });
};
