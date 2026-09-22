import * as THREE from 'three';

// Le style minimaliste a été calibré avec des couleurs utilisées telles quelles (sans conversion sRGB ↔ linéaire).
// Ce module doit être importé avant toute création de couleur.
THREE.ColorManagement.enabled = false;

/** Depuis Three r155, les intensités lumineuses sont physiques : ×π redonne l'éclairage calibré. */
export const LIGHT_SCALE = Math.PI;
