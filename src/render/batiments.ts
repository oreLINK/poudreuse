// Bâtiments construits par le joueur, et aperçu pendant la pose : bâtiment fantôme et cases vertes / rouges.
import * as THREE from 'three';
import type { Batiment, Evaluation, Rotation } from '../jeu/construction';
import { emprise } from '../jeu/construction';
import { OBJETS } from '../params/affichage';
import { BATIMENTS, type CleBatiment } from '../params/batiments';
import { ECHELLE } from '../params/monde';
import { patchNeige } from './neige';
import { C } from './palette';
import type { TerrainView } from './terrainView';

const ARBRE_U = OBJETS.arbre * OBJETS.echelle;   // diamètre d'un arbre en unités 3D
interface Mats { wall: THREE.Material; roof: THREE.Material; eave: THREE.Material; stone: THREE.Material; door: THREE.Material }

/** Maison minimaliste : soubassement de pierre, murs de bois, toit à deux pans (enneigé selon la saison). Origine = centre du plancher. */
function maison(type: CleBatiment, rot: Rotation, m: Mats) {
  const t = BATIMENTS[type], [lxm, lzm] = emprise(type, rot);
  const lx = lxm / ECHELLE.UNIT, lz = lzm / ECHELLE.UNIT, hw = t.hauteurMurs * ARBRE_U, hr = t.hauteurToit * ARBRE_U;
  const g = new THREE.Group();

  const stoneG = new THREE.BoxGeometry(lx * 0.96, 1, lz * 0.96); stoneG.translate(0, -0.5, 0);
  const socle = new THREE.Mesh(stoneG, m.stone);
  socle.name = 'socle';

  const walls = new THREE.Mesh(new THREE.BoxGeometry(lx * 0.9, hw, lz * 0.9).translate(0, hw / 2, 0), m.wall);

  // faîtage dans le sens de la plus grande longueur
  const long = Math.max(lx, lz), wide = Math.min(lx, lz);
  const shape = new THREE.Shape([new THREE.Vector2(-wide * 0.56, 0), new THREE.Vector2(wide * 0.56, 0), new THREE.Vector2(0, hr)]);
  const roofG = new THREE.ExtrudeGeometry(shape, { depth: long * 1.02, bevelEnabled: false });
  roofG.translate(0, hw, -long * 0.51);
  if (lx >= lz) roofG.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(roofG, m.roof);
  // rive de toit sombre sous la neige : détache la silhouette du manteau neigeux
  const eaveG = new THREE.ExtrudeGeometry(shape, { depth: long * 1.04, bevelEnabled: false });
  eaveG.scale(1.03, 0.35, 1); eaveG.translate(0, hw - hr * 0.02, -long * 0.52);
  if (lx >= lz) eaveG.rotateY(Math.PI / 2);
  const eave = new THREE.Mesh(eaveG, m.eave);

  // porte sur une grande façade
  const door = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.16, hw * 0.55, 0.06).translate(0, hw * 0.275, 0), m.door);
  if (lx >= lz) door.position.z = lz * 0.45; else { door.rotation.y = Math.PI / 2; door.position.x = lx * 0.45; }

  for (const o of [socle, walls, eave, roof, door]) { o.castShadow = o.receiveShadow = true; g.add(o); }
  return g;
}

export class BatimentsVue {
  readonly group = new THREE.Group();
  /** Murs des bâtiments : le cycle du jour les fait briller la nuit (fenêtres allumées). */
  readonly wallMaterial = new THREE.MeshLambertMaterial({ color: C.wood, emissive: new THREE.Color(0, 0, 0) });
  private readonly mats: Mats = {
    wall: this.wallMaterial,
    roof: patchNeige(new THREE.MeshLambertMaterial({ color: C.roof }), { ete: C.toitEte }),   // toit enneigé ou bardeaux
    eave: new THREE.MeshLambertMaterial({ color: C.eave }),
    stone: new THREE.MeshLambertMaterial({ color: C.stone }),
    door: new THREE.MeshLambertMaterial({ color: C.earthBot }),
  };
  private readonly ghostMats: Mats & { wall: THREE.MeshLambertMaterial } = {
    wall: new THREE.MeshLambertMaterial({ color: C.wood, transparent: true, opacity: 0.45, depthWrite: false }),
    roof: new THREE.MeshLambertMaterial({ color: C.roof, transparent: true, opacity: 0.45, depthWrite: false }),
    eave: new THREE.MeshLambertMaterial({ color: C.eave, transparent: true, opacity: 0.45, depthWrite: false }),
    stone: new THREE.MeshLambertMaterial({ color: C.stone, transparent: true, opacity: 0.45, depthWrite: false }),
    door: new THREE.MeshLambertMaterial({ color: C.earthBot, transparent: true, opacity: 0.45, depthWrite: false }),
  };
  private ghost: THREE.Group | null = null;
  private ghostKey = '';
  private readonly tiles: THREE.Mesh;

  constructor(private readonly tv: TerrainView) {
    this.tiles = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
      // visibles à travers le bâtiment fantôme : toute l'emprise se lit d'un coup d'œil
      vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false,
    }));
    this.tiles.renderOrder = 8;
    this.tiles.visible = false;
    this.group.add(this.tiles);
  }

  /** Place un groupe « maison » sur le terrain : plancher à alt, soubassement jusqu'à base. */
  private poser(g: THREE.Object3D, x: number, z: number, alt: number, base: number) {
    const { tv } = this;
    g.position.set(tv.toW(x / tv.CELL), tv.Y(alt), tv.toW(z / tv.CELL));
    g.getObjectByName('socle')!.scale.y = tv.Y(alt) - tv.Y(base) + 0.25;
  }

  ajouter(b: Batiment) {
    const g = maison(b.type, b.rot, this.mats);
    this.poser(g, b.x, b.z, b.alt, b.base);
    this.group.add(g);
  }

  /** Aperçu de pose : bâtiment fantôme et cases de contrôle. null = masquer. */
  apercu(type: CleBatiment | null, rot: Rotation, e: Evaluation | null) {
    if (!type || !e) {
      if (this.ghost) this.ghost.visible = false;
      this.tiles.visible = false;
      return;
    }
    const key = `${type}:${rot}`;
    if (key !== this.ghostKey) {
      if (this.ghost) { this.group.remove(this.ghost); this.ghost.traverse(o => (o as THREE.Mesh).geometry?.dispose()); }
      this.ghost = maison(type, rot, this.ghostMats);
      this.ghost.traverse(o => { o.castShadow = false; });
      this.ghostKey = key;
      this.group.add(this.ghost);
    }
    this.ghost!.visible = true;
    this.poser(this.ghost!, e.x, e.z, e.alt, e.base);
    this.ghostMats.wall.color.copy(e.ok ? C.wood : C.bad);

    // cases drapées sur le relief, légèrement espacées pour lire la grille
    const { tv } = this, pos: number[] = [], col: number[] = [], h = (e.pas / 2) * 0.9;
    for (const c of e.cases) {
      const color = c.ok ? C.ok : C.bad;
      const pt = (dx: number, dz: number) => {
        const x = c.x + dx, z = c.z + dz;
        pos.push(tv.toW(x / tv.CELL), tv.Y(tv.altAt(x / tv.CELL, z / tv.CELL)) + 0.12, tv.toW(z / tv.CELL));
        col.push(color.r, color.g, color.b);
      };
      pt(-h, -h); pt(-h, h); pt(h, -h);
      pt(h, -h); pt(-h, h); pt(h, h);
    }
    const g = this.tiles.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    this.tiles.visible = true;
  }
}
