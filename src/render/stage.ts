// Moteur de rendu, lumières, caméra isométrique et navigation.
import * as THREE from 'three';
import { CAMERA } from '../params/affichage';

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 6000);
  readonly hemi = new THREE.HemisphereLight(0xe2eeff, 0x66758a, 1);
  readonly sun = new THREE.DirectionalLight(0xfff3df, 1);
  readonly fog = new THREE.Fog(0xeef5fa, 100, 1000);

  // caméra
  private readonly ELEV = Math.atan(1 / Math.sqrt(2)); // angle isométrique vrai
  azimuth = Math.PI / 4; targetAz = Math.PI / 4;
  zoom = 1; targetZoom = 1;
  readonly target = new THREE.Vector3();
  mapW = 200;
  private viewW = 300;

  constructor(private host: HTMLElement, private reduceMotion: boolean) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.scene.fog = this.fog;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    const sm = Math.min(4096, this.renderer.capabilities.maxTextureSize);
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.4;

    this.bindControls();
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  /** Cadre la caméra et les ombres sur une carte de largeur mapW. */
  frame(mapW: number, topY: number) {
    this.mapW = mapW;
    const half = mapW * 0.75, sc = this.sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = mapW * 4;
    sc.updateProjectionMatrix();
    this.target.set(0, topY * 0.3, 0);
    this.zoom = this.targetZoom = CAMERA.zoomInitial;
    this.fit();
  }

  fit() {
    const w = this.host.clientWidth, h = this.host.clientHeight, aspect = w / h;
    const span = this.mapW * 1.5;
    this.viewW = aspect < 1 ? span : Math.max(span, span * 0.78 * aspect);
    const c = this.camera;
    c.left = -this.viewW / 2; c.right = this.viewW / 2;
    c.top = this.viewW / aspect / 2; c.bottom = -this.viewW / aspect / 2;
    c.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  rotate(dir: -1 | 1) {
    const q = Math.PI / 2;
    this.targetAz = Math.round((this.targetAz - Math.PI / 4) / q) * q + Math.PI / 4 + dir * q;
  }

  private maxZoom() { return Math.max(CAMERA.zoomMax, this.mapW / CAMERA.zoomMaxParLargeur); }
  private setZoom(z: number) { this.targetZoom = Math.min(this.maxZoom(), Math.max(CAMERA.zoomMin, z)); }

  update(dt: number) {
    const k = this.reduceMotion ? 1 : 1 - Math.pow(0.001, dt);
    this.azimuth += (this.targetAz - this.azimuth) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    const d = this.mapW * 2 + 200, E = this.ELEV, t = this.target, c = this.camera;
    c.position.set(t.x + Math.cos(this.azimuth) * Math.cos(E) * d, t.y + Math.sin(E) * d, t.z + Math.sin(this.azimuth) * Math.cos(E) * d);
    c.lookAt(t);
    c.zoom = this.zoom;
    c.updateProjectionMatrix();
    // perspective atmosphérique : le fond de la carte s'estompe légèrement
    this.fog.near = d + this.mapW * 0.15;
    this.fog.far = d + this.mapW * 2.2;
  }

  /** Angle (degrés) de la direction du nord (-z) à l'écran. */
  northAngle() {
    const o = this.target.clone().project(this.camera);
    const n = this.target.clone().add(new THREE.Vector3(0, 0, -20)).project(this.camera);
    return (Math.atan2(n.x - o.x, n.y - o.y) * 180) / Math.PI;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  // Glisser = déplacer, molette / pincer = zoomer, flèches = pivoter
  private bindControls() {
    const host = this.host, pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    host.addEventListener('pointerdown', e => { host.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); host.classList.add('dragging'); });
    host.addEventListener('pointermove', e => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        const wpp = this.viewW / this.zoom / host.clientWidth, az = this.azimuth, sE = Math.sin(this.ELEV);
        const rx = Math.sin(az), rz = -Math.cos(az), fx = -Math.cos(az), fz = -Math.sin(az);
        this.target.x += (-dx * rx + (dy * fx) / sE) * wpp;
        this.target.z += (-dx * rz + (dy * fz) / sE) * wpp;
        const m = this.mapW / 2;
        this.target.x = Math.max(-m, Math.min(m, this.target.x));
        this.target.z = Math.max(-m, Math.min(m, this.target.z));
      } else if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinch) this.setZoom((this.targetZoom * d) / pinch);
        pinch = d;
      }
    });
    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!pointers.size) host.classList.remove('dragging');
    };
    host.addEventListener('pointerup', release);
    host.addEventListener('pointercancel', release);
    host.addEventListener('wheel', e => { e.preventDefault(); this.setZoom(this.targetZoom * Math.exp(-e.deltaY * CAMERA.molette)); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') this.rotate(-1);
      if (e.key === 'ArrowRight') this.rotate(1);
      if (e.key === '+' || e.key === '=') this.setZoom(this.targetZoom * 1.2);
      if (e.key === '-') this.setZoom(this.targetZoom / 1.2);
    });
  }
}
