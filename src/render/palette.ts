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
  ok: c('#2e9e5b'), bad: c('#d23b3b'),   // aperçu de construction (couleurs des pistes verte et rouge)
};
