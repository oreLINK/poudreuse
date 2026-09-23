import * as THREE from 'three';

const c = (hex: string) => new THREE.Color(hex);

export const C = {
  powder: c('#f5f9fe'),    // poudreuse froide (ubac)
  adret: c('#f8f4ec'),     // neige transformée (adret)
  hardpack: c('#e2e8ee'),  // neige dure des crêtes soufflées
  bowl: c('#fcfdff'),      // combes abritées
  rock: c('#5c626d'), rockLight: c('#8a8f99'),
  meadow: c('#8f8b6c'), meadow2: c('#a59d80'),
  earthTop: c('#6e5a4a'), earthBot: c('#3b3029'), rim: c('#e9f0f6'),
  pine: c('#2d4f45'), pineDark: c('#23403a'), larch: c('#8a7b66'), ghost: c('#e8eef4'),
  wood: c('#7a5a43'), stone: c('#b9b1a4'), roof: c('#f1f5f9'), eave: c('#4a3a30'),
  cornice: c('#f6f9fc'), track: c('#b9c6d3'),
  // sans neige : prés de fond de vallée, alpages, pierriers, toits de bardeaux, jeunes pins à la limite de la forêt
  pre: c('#7d9455'), pre2: c('#8fa062'), alpage: c('#9da274'), alpage2: c('#aaa47e'),
  pierrier: c('#8d887d'), sousBois: c('#5d7148'), toitEte: c('#6d5a4c'), jeunePin: c('#3b5a47'),
  ok: c('#2e9e5b'), bad: c('#d23b3b'),   // aperçu de construction (couleurs des pistes verte et rouge)
};
