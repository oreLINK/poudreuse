// Fait réagir un matériau Lambert à l'enneigement lu dans la carte du manteau neigeux :
// objet masqué sans neige (chapeaux des sapins, corniches, traces) ou couleur d'été (toits, arbres englacés).
import * as THREE from 'three';
import { GLSL_CARTE, uniformsCarte } from './shaders';

interface Options {
  /** Masquer l'objet là où il n'y a plus de neige. */
  masquer?: boolean;
  /** Couleur de l'objet sans neige. */
  ete?: THREE.Color;
}

export function patchNeige<M extends THREE.MeshLambertMaterial>(mat: M, o: Options): M {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniformsCarte(), o.ete ? { uEte: { value: o.ete } } : {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_CARTE}\nvarying float vNeige;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 xzNeige = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xz;   // tout l'objet d'un bloc
        #else
          vec2 xzNeige = (modelMatrix * vec4(transformed, 1.)).xz;
        #endif
        vNeige = smoothstep(.35, .65, carteEn(xzNeige).r);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vNeige;${o.ete ? '\nuniform vec3 uEte;' : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${o.masquer ? 'if (vNeige < .5) discard;' : ''}
        ${o.ete ? 'diffuseColor.rgb = mix(uEte, diffuseColor.rgb, vNeige);' : ''}`);
  };
  return mat;
}
