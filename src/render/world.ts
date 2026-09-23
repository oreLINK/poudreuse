// Assemble la scène d'un domaine à partir des données générées.
import * as THREE from 'three';
import type { Domain } from '../gen/types';
import { Spindrift, buildClouds } from './atmosphere';
import { AvalanchesVue } from './avalanches';
import { Precipitations } from './precipitations';
import { shared } from './shaders';
import { buildCornices, buildFreerideTracks } from './relief';
import { buildSkirt, buildTerrain } from './terrain';
import { TerrainView } from './terrainView';
import { buildVegetation, type Vegetation } from './vegetation';
import { BatimentsVue } from './batiments';
import { buildLakes, buildRivers } from './water';

export class World {
  readonly group = new THREE.Group();
  readonly view: TerrainView;
  readonly cloudMaterial: THREE.ShaderMaterial;
  /** Mer de nuages et sa hauteur de base (elle monte par temps de brouillard). */
  readonly cloudMesh: THREE.Mesh;
  readonly cloudY: number;
  readonly avalanches: AvalanchesVue;
  readonly precipitations = new Precipitations();
  private carte: THREE.DataTexture | null = null;
  readonly batiments: BatimentsVue;
  readonly vegetation: Vegetation;
  readonly spindrift: Spindrift | null;

  constructor(readonly domain: Domain) {
    const tv = (this.view = new TerrainView(domain));
    const add = (o: THREE.Object3D | null) => { if (o) this.group.add(o); };
    add(buildTerrain(tv, domain.seed));
    add(buildSkirt(tv));
    add(buildLakes(tv));
    add(buildRivers(tv, domain));
    add(buildFreerideTracks(tv, domain));
    this.vegetation = buildVegetation(tv, domain);
    this.vegetation.objects.forEach(add);
    add(buildCornices(tv, domain));
    this.batiments = new BatimentsVue(tv);
    add(this.batiments.group);
    const clouds = buildClouds(tv, domain);
    add(clouds.mesh);
    this.cloudMaterial = clouds.material;
    this.cloudMesh = clouds.mesh;
    this.cloudY = clouds.mesh.position.y;
    this.avalanches = new AvalanchesVue(tv);
    add(this.avalanches.group);
    add(this.precipitations.points);
    this.spindrift = Spindrift.build(tv);
    add(this.spindrift?.points ?? null);
  }

  /** Relie la carte du manteau neigeux (sim/manteau.ts, 4 octets par sommet) aux shaders. */
  attacherCarte(data: Uint8Array<ArrayBuffer>) {
    const W = this.view.N + 1, tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.carte = tex;
    shared.carte.value = tex; shared.carteN.value = this.view.N; shared.carteS.value = this.view.S;
  }

  /** À appeler après chaque mise à jour du manteau neigeux. */
  carteModifiee() { if (this.carte) this.carte.needsUpdate = true; }

  get mapW() { return this.view.mapW; }
  get topY() { return this.view.Y(this.view.maxAlt); }

  dispose() {
    this.carte?.dispose();
    this.group.traverse(o => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach(mt => mt.dispose());
    });
    this.group.removeFromParent();
  }
}
