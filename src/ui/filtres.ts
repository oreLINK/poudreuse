// Menu des filtres d'affichage : pour l'instant, le filtre topographique (courbes de niveau).
import { TOPO } from '../params/affichage';
import { shared } from '../render/shaders';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const STORE = 'poudreuse.filtres';

export class MenuFiltres {
  private topo = false;
  private readonly btn = $<HTMLButtonElement>('#filtres-btn');
  private readonly menu = $('#filtres');
  private readonly topoSwitch = $<HTMLInputElement>('#filtre-topo');

  constructor(private readonly reduceMotion: boolean) {
    // le choix est retenu d'une visite à l'autre (confort personnel, sans importance si le stockage est indisponible)
    try { this.topo = JSON.parse(localStorage.getItem(STORE) ?? '{}').topo === true; } catch { /* stockage indisponible */ }
    this.topoSwitch.checked = this.topo;
    shared.topo.value = this.topo ? 1 : 0;

    this.btn.addEventListener('click', () => this.ouvrir(this.menu.hidden));
    this.topoSwitch.addEventListener('change', () => this.setTopo(this.topoSwitch.checked));
    document.addEventListener('pointerdown', e => {
      if (!this.menu.hidden && !this.menu.contains(e.target as Node) && !this.btn.contains(e.target as Node)) this.ouvrir(false);
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.menu.hidden) { this.ouvrir(false); this.btn.focus(); }
      if ((e.key === 't' || e.key === 'T') && !(e.target instanceof HTMLInputElement)) this.setTopo(!this.topo);
    });
  }

  ouvrir(open: boolean) {
    this.menu.hidden = !open;
    this.btn.setAttribute('aria-expanded', String(open));
    if (open) this.topoSwitch.focus();
  }

  private setTopo(on: boolean) {
    this.topo = on;
    this.topoSwitch.checked = on;
    this.btn.classList.toggle('active', on);
    try { localStorage.setItem(STORE, JSON.stringify({ topo: on })); } catch { /* stockage indisponible */ }
  }

  /** Fondu d'apparition des courbes. */
  update(dt: number) {
    const target = this.topo ? 1 : 0, v = shared.topo.value;
    this.btn.classList.toggle('active', this.topo);
    shared.topo.value = this.reduceMotion ? target : v + Math.sign(target - v) * Math.min(Math.abs(target - v), dt / TOPO.fondu);
  }
}
