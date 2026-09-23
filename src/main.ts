// Point d'entrée : interface, génération en arrière-plan, boucle de rendu.
import './render/colorSetup'; // doit précéder toute création de couleur
import './style.css';
import { DEFAULT_SIZE, SIZE_KEYS, type SizeKey } from './params/monde';
import { TEMPS } from './params/temps';
import type { Domain } from './gen/types';
import type { GenRequest } from './gen/generator.worker';
import { DayCycle } from './render/dayCycle';
import { shared } from './render/shaders';
import { Stage } from './render/stage';
import { World } from './render/world';
import { limitePluieNeige } from './sim/climat';
import { SimMonde } from './sim/monde';
import { Horloge } from './sim/temps';
import { ModeConstruction } from './ui/construction';
import { MenuFiltres } from './ui/filtres';
import { AffichageHorloge } from './ui/horloge';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const stage = new Stage($('#scene'), reduceMotion);
const day = new DayCycle(stage.sun, stage.hemi, stage.fog);
// animations réduites : l'horloge reste figée sur la lumière du matin
const horloge = new Horloge(reduceMotion ? { phaseDepart: TEMPS.phaseFigee } : {});
const affichageHorloge = new AffichageHorloge(horloge);
const construction = new ModeConstruction(stage, $('#scene'));
const filtres = new MenuFiltres(reduceMotion);
// un seul panneau à la fois au-dessus du dock
document.querySelectorAll('[data-batiment]').forEach(b => b.addEventListener('click', () => filtres.ouvrir(false)));
let world: World | null = null;
let sim: SimMonde | null = null;

// ---------- Génération (Web Worker) ----------
const worker = new Worker(new URL('./gen/generator.worker.ts', import.meta.url), { type: 'module' });
const loading = $('#loading'), regenBtn = $<HTMLButtonElement>('#regen');
const sizeBtns = [...document.querySelectorAll<HTMLButtonElement>('#sizes button')];

// l'adresse garde la taille et la graine : un domaine se partage par un simple lien
const params = new URLSearchParams(location.search);
let size: SizeKey = SIZE_KEYS.includes(params.get('size') as SizeKey) ? (params.get('size') as SizeKey) : DEFAULT_SIZE;
let busy = false;

function setBusy(b: boolean) {
  busy = b;
  loading.classList.toggle('on', b);
  regenBtn.disabled = b;
  sizeBtns.forEach(btn => (btn.disabled = b));
}
function syncSizeButtons() { sizeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === size))); }

function generate(seed = Math.floor(Math.random() * 99999)) {
  if (busy) return;
  setBusy(true);
  const url = new URL(location.href);
  url.searchParams.set('size', size); url.searchParams.set('seed', String(seed));
  history.replaceState(null, '', url);
  const req: GenRequest = { seed, size };
  worker.postMessage(req);
}

worker.onmessage = (e: MessageEvent<Domain>) => {
  world?.dispose();
  world = new World(e.data);
  sim = new SimMonde(e.data, horloge);
  world.attacherCarte(sim.manteau.carte);
  construction.attacher(world);
  stage.scene.add(world.group);
  stage.frame(world.mapW, world.topY);
  day.apply(world, horloge.phase, sim.meteo);
  setBusy(false);
};
worker.onerror = err => { console.error(err); setBusy(false); };

regenBtn.addEventListener('click', () => generate());
sizeBtns.forEach(b => b.addEventListener('click', () => { size = b.dataset.size as SizeKey; syncSizeButtons(); generate(); }));
$('#rotL').addEventListener('click', () => stage.rotate(-1));
$('#rotR').addEventListener('click', () => stage.rotate(1));

syncSizeButtons();
const seedParam = Number(params.get('seed'));
generate(Number.isFinite(seedParam) && seedParam > 0 ? seedParam : undefined);

// ---------- Boucle ----------
const needle = $<HTMLElement>('#needle');
let last = performance.now();
function loop(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const zoomPx = stage.renderer.getPixelRatio() * Math.sqrt(stage.zoom);
  if (!reduceMotion) {
    shared.time.value += dt;
    horloge.update(dt);
    if (sim && world) for (const a of sim.update(dt, horloge)) world.avalanches.ajouter(a);
  }
  if (sim && world && sim.carteModifiee) { world.carteModifiee(); sim.carteModifiee = false; }
  const meteo = sim?.meteo ?? null;
  day.apply(world, horloge.phase, meteo ?? undefined);
  stage.brume = meteo ? Math.min(1, meteo.brouillard + meteo.precipitation * 0.35) : 0;
  stage.update(dt);
  filtres.update(dt);
  affichageHorloge.update(meteo, sim ? sim.temperatureStation(horloge) : 0);
  needle.style.transform = `rotate(${stage.northAngle()}deg)`;
  if (world && sim && !reduceMotion) {
    world.spindrift?.update(dt, 2.2 * zoomPx, sim.meteo);
    world.avalanches.update(dt, 2.2 * zoomPx);
    const vent = sim.meteo.intensiteEn(sim.d.station.x, sim.d.station.z);
    world.precipitations.update(dt, world.view, stage.target, stage.largeurVue, sim.meteo.precipitation, limitePluieNeige(sim.contexte(horloge)), vent, 2 * zoomPx);
  }
  stage.render();
requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
