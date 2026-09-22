// Mode construction : choisir un bâtiment, le poser sur la carte, puis confirmer.
// Survol = aperçu qui suit le pointeur ; clic (ou toucher) = pose provisoire ; « Confirmer » = construction.
import * as THREE from 'three';
import { Chantier, type Evaluation, type Rotation } from '../jeu/construction';
import { BATIMENTS, CONSTRUCTION, type CleBatiment } from '../params/batiments';
import { ARBRE_M } from '../params/affichage';
import type { Stage } from '../render/stage';
import type { World } from '../render/world';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

export class ModeConstruction {
  private type: CleBatiment | null = null;
  private rot: Rotation = 0;
  /** Pose provisoire (m), en attente de confirmation. */
  private pose: { x: number; z: number } | null = null;
  private eval: Evaluation | null = null;
  private world: World | null = null;
  private chantier: Chantier | null = null;
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private down: { x: number; y: number } | null = null;

  private readonly buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-batiment]')];
  private readonly bar = $('#confirm');
  private readonly title = $('#confirm-title');
  private readonly hint = $('#confirm-hint');
  private readonly okBtn = $<HTMLButtonElement>('#confirm-ok');

  constructor(private readonly stage: Stage, private readonly host: HTMLElement) {
    this.buttons.forEach(b => b.addEventListener('click', () => this.choisir(b.dataset.batiment as CleBatiment)));
    $('#confirm-rot').addEventListener('click', () => this.tourner());
    $('#confirm-cancel').addEventListener('click', () => this.quitter());
    this.okBtn.addEventListener('click', () => this.confirmer());

    host.addEventListener('pointermove', e => {
      if (this.type && !this.pose && e.pointerType === 'mouse') this.viser(e.clientX, e.clientY);
    });
    host.addEventListener('pointerdown', e => { this.down = { x: e.clientX, y: e.clientY }; });
    host.addEventListener('pointerup', e => {
      // un clic sans glisser pose le bâtiment ; un glisser déplace la carte
      if (!this.type || !this.down || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return;
      this.viser(e.clientX, e.clientY);
      if (this.eval) this.pose = { x: this.eval.x, z: this.eval.z };
      this.majBarre();
    });
    host.addEventListener('pointerleave', () => { if (this.type && !this.pose) this.world?.batiments.apercu(null, 0, null); });
    window.addEventListener('keydown', e => {
      if (!this.type) return;
      if (e.key === 'Escape') this.quitter();
      if (e.key === 'r' || e.key === 'R') this.tourner();
      if (e.key === 'Enter' && this.pose) this.confirmer();
    });
  }

  /** Nouvelle carte : nouveau chantier vide. */
  attacher(world: World) {
    this.world = world;
    this.chantier = new Chantier(world.domain);
    this.quitter();
  }

  private choisir(type: CleBatiment) {
    if (this.type === type) { this.quitter(); return; }
    this.type = type; this.rot = 0; this.pose = null; this.eval = null;
    this.host.classList.add('building');
    this.buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.batiment === type)));
    this.majBarre();
  }

  private quitter() {
    this.type = null; this.pose = null; this.eval = null;
    this.host.classList.remove('building');
    this.buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
    this.world?.batiments.apercu(null, 0, null);
    this.bar.hidden = true;
  }

  private tourner() {
    if (!this.type) return;
    this.rot = this.rot ? 0 : 1;
    if (this.eval) this.evaluer(this.pose?.x ?? this.eval.x, this.pose?.z ?? this.eval.z);
    if (this.pose && this.eval) this.pose = { x: this.eval.x, z: this.eval.z };
    this.majBarre();
  }

  /** Point de la carte sous le pointeur → évaluation de l'emprise et aperçu. */
  private viser(cx: number, cy: number) {
    const w = this.world;
    if (!w || !this.type) return;
    const r = this.host.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
    const { origin: o, direction: d } = this.ray.ray;
    const hit = w.view.pick(o.x, o.y, o.z, d.x, d.y, d.z);
    if (!hit) { w.batiments.apercu(null, 0, null); this.eval = null; return; }
    this.evaluer(hit[0] * w.view.CELL, hit[1] * w.view.CELL);
  }

  private evaluer(x: number, z: number) {
    if (!this.chantier || !this.world || !this.type) return;
    this.eval = this.chantier.evaluer(this.type, x, z, this.rot);
    this.world.batiments.apercu(this.type, this.rot, this.eval);
  }

  private confirmer() {
    const { chantier, world, type, pose } = this;
    if (!chantier || !world || !type || !pose) return;
    const b = chantier.construire(type, pose.x, pose.z, this.rot);
    if (!b) return;
    world.batiments.ajouter(b);
    // les arbres sous le bâtiment (et une petite marge) sont abattus
    const e = this.eval!, m = CONSTRUCTION.abattage * ARBRE_M, v = world.view;
    world.vegetation.abattre(v.toW((e.x - e.lx / 2 - m) / v.CELL), v.toW((e.z - e.lz / 2 - m) / v.CELL), v.toW((e.x + e.lx / 2 + m) / v.CELL), v.toW((e.z + e.lz / 2 + m) / v.CELL));
    // on reste en mode construction pour enchaîner les poses
    this.pose = null;
    this.evaluer(pose.x, pose.z);
    this.majBarre();
  }

  private majBarre() {
    if (!this.type) { this.bar.hidden = true; return; }
    this.bar.hidden = false;
    this.title.textContent = BATIMENTS[this.type].nom;
    const ok = !!(this.pose && this.eval?.ok);
    this.okBtn.disabled = !ok;
    this.hint.textContent = !this.pose
      ? 'Cliquez sur la carte pour placer le bâtiment'
      : this.eval?.ok ? 'Emplacement libre et plat : confirmez' : 'Terrain trop pentu, eau ou bâtiment : toutes les cases doivent être vertes';
  }
}
