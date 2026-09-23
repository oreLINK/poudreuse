import * as THREE from 'three';

/** Carte du manteau neigeux par défaut (tout enneigé), avant la première mise à jour de la simulation. */
const carteVide = new THREE.DataTexture(new Uint8Array([255, 0, 0, 0]), 1, 1);
carteVide.needsUpdate = true;

/** Uniformes partagés : temps (animations) et couleur de la lumière ambiante (cycle du jour). */
export const shared = {
  time: { value: 0 },
  light: { value: new THREE.Color(1, 1, 1) },
  /** Visibilité du filtre topographique (0 = masqué, 1 = affiché). */
  topo: { value: 0 },
  /** Couleur des courbes de niveau, qui suit l'éclairage (render/dayCycle.ts). */
  topoColor: { value: new THREE.Color(1, 1, 1) },
  /** Part des courbes affichée sans éclairage (0 = éclairées comme le relief, 1 = lumineuses, la nuit). */
  topoLueur: { value: 0 },
  /**
   * Carte du manteau neigeux (sim/manteau.ts), un texel par sommet de grille : r = enneigement, g = risque / 5,
   * b = probabilité de neige, a = humidité. uCarteN = cases par côté, uCarteS = taille d'une case en unités 3D.
   */
  carte: { value: carteVide as THREE.Texture },
  carteN: { value: 1 },
  carteS: { value: 1 },
  /** Calque coloré affiché sur le relief : 0 = aucun, 1 = risque d'avalanche, 2 = probabilité de neige ; et sa visibilité (0–1). */
  calque: { value: 0 },
  calqueA: { value: 0 },
};

/** Uniformes à donner à un matériau qui lit la carte du manteau neigeux. */
export const uniformsCarte = () => ({ uCarte: shared.carte, uCarteN: shared.carteN, uCarteS: shared.carteS });

/** Lecture de la carte du manteau neigeux en un point de la scène (coordonnées x, z en unités 3D). */
export const GLSL_CARTE = /* glsl */ `
  uniform sampler2D uCarte; uniform float uCarteN; uniform float uCarteS;
  vec4 carteEn(vec2 xz){ vec2 g = xz / uCarteS + uCarteN * .5; return texture2D(uCarte, (g + .5) / (uCarteN + 1.)); }
  /** Valeur du sommet de grille le plus proche, sans interpolation (niveaux de risque : pas de dégradé entre 0 et 5). */
  vec4 carteNette(vec2 xz){ vec2 g = floor(xz / uCarteS + uCarteN * .5 + .5); return texture2D(uCarte, (g + .5) / (uCarteN + 1.)); }`;

export const GLSL_NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }`;

export const WORLD_XZ_VERT = /* glsl */ `
  varying vec2 vW;
  void main(){ vW = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

/** Lac : gelé (glace turquoise, pellicule de neige, fissures) tant que la neige tient autour, eau libre sinon. */
export const LAKE_FRAG = GLSL_NOISE + GLSL_CARTE + /* glsl */ `
  uniform vec3 light; uniform float time; varying vec2 vW;
  void main(){
    float gel = smoothstep(.25, .6, carteEn(vW).r);
    vec3 eau = mix(vec3(.13, .30, .42), vec3(.20, .42, .52), vnoise(vW * .08 + time * .05));
    eau += vec3(.10, .12, .12) * smoothstep(.72, .9, vnoise(vec2(vW.x * .6, vW.y * 1.4) + time * .4));
    vec3 deep = vec3(.25, .49, .66), turq = vec3(.28, .62, .70), snow = vec3(.93, .96, .99), dark = vec3(.12, .25, .34);
    vec3 c = mix(deep, turq, vnoise(vW * .12));
    float film = smoothstep(.5, .8, fbm(vec2(vW.x * .18, vW.y * .7)));
    c = mix(c, snow, film * .5);
    float n = fbm(vW * .45 + fbm(vW * .25) * 2.);
    float crack = 1. - smoothstep(.0, .018, abs(n - .5));
    c = mix(c, dark, crack * .55);
    gl_FragColor = vec4(mix(eau, c, gel) * light, 1.);
  }`;

/** Torrent : tronçons gelés et eau vive sombre parcourue de reflets qui descendent le courant. */
export const RIVER_VERT = GLSL_CARTE + /* glsl */ `
  attribute float along; attribute float across; attribute float frozen;
  varying float vAlong; varying float vAcross; varying float vFrozen;
  void main(){
    vAlong = along; vAcross = across;
    vFrozen = frozen * smoothstep(.3, .8, carteEn(position.xz).r);   // les torrents dégèlent avec la neige
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }`;
export const RIVER_FRAG = /* glsl */ `
  uniform float time; uniform vec3 light;
  varying float vAlong; varying float vAcross; varying float vFrozen;
  void main(){
    vec3 water = vec3(.21, .42, .56), ice = vec3(.80, .88, .94), foam = vec3(.86, .93, .97);
    float edge = 1. - abs(vAcross);
    float lane = floor((vAcross * .5 + .5) * 3.);
    float s = fract(vAlong * .22 - time * .45 + lane * .37);
    float streak = smoothstep(0., .04, s) * (1. - smoothstep(.04, .16, s));
    vec3 open = mix(water * .9, water * 1.1, edge);
    open = mix(open, foam, streak * .5 * edge);
    float fz = smoothstep(.5, .62, vFrozen + (1. - edge) * .25);
    gl_FragColor = vec4(mix(open, ice, fz) * light, 1.);
  }`;

/** Mer de nuages : nappe bruitée qui dérive lentement dans les fonds de vallée, dégagée au-dessus de la station (uHole : x, z, rayon). */
export const CLOUD_FRAG = GLSL_NOISE + /* glsl */ `
  uniform float time; uniform float opacity; uniform vec3 color; uniform float uHalf; uniform vec3 uHole; varying vec2 vW;
  void main(){
    vec2 p = vW * .035 + vec2(time * .012, time * .005);
    float n = fbm(p) * .7 + fbm(p * 2.7 + 5.) * .3;
    float a = smoothstep(.36, .62, n);
    float edge = 1. - smoothstep(uHalf * .9, uHalf, max(abs(vW.x), abs(vW.y)));
    edge *= smoothstep(uHole.z, uHole.z * 1.6, length(vW - uHole.xy) + (n - .5) * uHole.z * .4);
    gl_FragColor = vec4(color * (.92 + .08 * n), a * opacity * edge);
  }`;

/** Neige soufflée : particules rondes qui s'estompent. */
export const SPIN_VERT = /* glsl */ `
  attribute float alpha; varying float vA; uniform float size;
  void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = size; }`;
export const SPIN_FRAG = /* glsl */ `
  uniform vec3 light; varying float vA;
  void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(max(light, vec3(.5)), vA * (1. - d * 2.) * .75); }`;
