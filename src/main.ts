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
import { Meteo } from './sim/meteo';
import { ModeConstruction } from './ui/construction';
import { MenuFiltres } from './ui/filtres';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const stage = new Stage($('#scene'), reduceMotion);
const day = new DayCycle(stage.sun, stage.hemi, stage.fog);
const construction = new ModeConstruction(stage, $('#scene'));
const filtres = new MenuFiltres(reduceMotion);
// un seul panneau à la fois au-dessus du dock
document.querySelectorAll('[data-batiment]').forEach(b => b.addEventListener('click', () => filtres.ouvrir(false)));
let world: World | null = null;
let meteo: Meteo | null = null;

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
  meteo = new Meteo(e.data.seed, e.data.L);
  construction.attacher(world);
  stage.scene.add(world.group);
  stage.frame(world.mapW, world.topY);
  day.apply(world);
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
  if (!reduceMotion) { shared.time.value += dt; day.advance(dt); meteo?.update(dt); }
  day.apply(world, reduceMotion ? TEMPS.phaseFigee : day.phase);
  stage.update(dt);
  filtres.update(dt);
  needle.style.transform = `rotate(${stage.northAngle()}deg)`;
  if (world?.spindrift && meteo && !reduceMotion) world.spindrift.update(dt, 2.2 * stage.renderer.getPixelRatio() * Math.sqrt(stage.zoom), meteo);
  stage.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
