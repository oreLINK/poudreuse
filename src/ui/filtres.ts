// Menu des filtres d'affichage : courbes de niveau, et un calque coloré au choix (risque d'avalanche ou probabilité de neige).
import { CALQUES, TOPO } from '../params/affichage';
import { RISQUE } from '../params/avalanches';
import { shared } from '../render/shaders';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const STORE = 'poudreuse.filtres';
type Calque = 'aucun' | 'risque' | 'proba';
const CODE: Record<Calque, number> = { aucun: 0, risque: 1, proba: 2 };

export class MenuFiltres {
  private topo = false;
  /** Les deux calques colorés s'excluent : ils teintent tous deux le relief. */
  private calque: Calque = 'aucun';
  private readonly btn = $<HTMLButtonElement>('#filtres-btn');
  private readonly menu = $('#filtres');
  private readonly topoSwitch = $<HTMLInputElement>('#filtre-topo');
  private readonly risqueSwitch = $<HTMLInputElement>('#filtre-risque');
  private readonly probaSwitch = $<HTMLInputElement>('#filtre-proba');
  private readonly legende = $('#legende');

  constructor(private readonly reduceMotion: boolean) {
    // légendes aux couleurs des paramètres
    document.querySelectorAll<HTMLElement>('#legende-risque .niveaux span').forEach((s, i) => (s.style.background = RISQUE.couleurs[i]));
    $('#legende-proba .degrade').style.background = `linear-gradient(90deg, ${CALQUES.probaMin}, ${CALQUES.probaMax})`;
    // le choix est retenu d'une visite à l'autre (confort personnel, sans importance si le stockage est indisponible)
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? '{}');
      this.topo = s.topo === true;
      if (s.calque === 'risque' || s.calque === 'proba') this.calque = s.calque;
    } catch { /* stockage indisponible */ }
    shared.topo.value = this.topo ? 1 : 0;
    shared.calque.value = CODE[this.calque];
    shared.calqueA.value = this.calque === 'aucun' ? 0 : 1;
    this.appliquer();

    this.btn.addEventListener('click', () => this.ouvrir(this.menu.hidden));
    this.topoSwitch.addEventListener('change', () => { this.topo = this.topoSwitch.checked; this.appliquer(); });
    this.risqueSwitch.addEventListener('change', () => this.setCalque(this.risqueSwitch.checked ? 'risque' : 'aucun'));
    this.probaSwitch.addEventListener('change', () => this.setCalque(this.probaSwitch.checked ? 'proba' : 'aucun'));
    document.addEventListener('pointerdown', e => {
      if (!this.menu.hidden && !this.menu.contains(e.target as Node) && !this.btn.contains(e.target as Node)) this.ouvrir(false);
    });
    window.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return;
      if (e.key === 'Escape' && !this.menu.hidden) { this.ouvrir(false); this.btn.focus(); }
      if (e.key === 't' || e.key === 'T') { this.topo = !this.topo; this.appliquer(); }
      if (e.key === 'a' || e.key === 'A') this.setCalque(this.calque === 'risque' ? 'aucun' : 'risque');
      if (e.key === 'n' || e.key === 'N') this.setCalque(this.calque === 'proba' ? 'aucun' : 'proba');
    });
  }

  ouvrir(open: boolean) {
    this.menu.hidden = !open;
    this.btn.setAttribute('aria-expanded', String(open));
    if (open) this.topoSwitch.focus();
  }

  private setCalque(c: Calque) {
    // on passe d'un calque à l'autre sans fondu inutile ; vers « aucun », le calque en cours s'estompe
    if (c !== 'aucun') shared.calque.value = CODE[c];
    this.calque = c;
    this.appliquer();
  }

  private appliquer() {
    this.topoSwitch.checked = this.topo;
    this.risqueSwitch.checked = this.calque === 'risque';
    this.probaSwitch.checked = this.calque === 'proba';
    this.btn.classList.toggle('active', this.topo || this.calque !== 'aucun');
    this.legende.hidden = this.calque === 'aucun';
    $('#legende-risque').hidden = this.calque !== 'risque';
    $('#legende-proba').hidden = this.calque !== 'proba';
    try { localStorage.setItem(STORE, JSON.stringify({ topo: this.topo, calque: this.calque })); } catch { /* stockage indisponible */ }
  }

  /** Fondus d'apparition des courbes et des calques. */
  update(dt: number) {
    const fondu = (v: number, cible: number, duree: number) =>
      this.reduceMotion ? cible : v + Math.sign(cible - v) * Math.min(Math.abs(cible - v), dt / duree);
    shared.topo.value = fondu(shared.topo.value, this.topo ? 1 : 0, TOPO.fondu);
    shared.calqueA.value = fondu(shared.calqueA.value, this.calque === 'aucun' ? 0 : 1, CALQUES.fondu);
  }
}
