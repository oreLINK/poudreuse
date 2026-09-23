// Horloge en haut à droite : heure, date, saison, temps qu'il fait et température à la station.
// Un clic ouvre le menu « Temps » : journée normale / jour seul / nuit seule, saisons normales / hiver seul / été seul.
import { CLIMAT } from '../params/climat';
import { SAISONS, type ModeJournee, type ModeSaison } from '../params/temps';
import type { Meteo } from '../sim/meteo';
import type { Horloge } from '../sim/temps';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const STORE = 'poudreuse.temps';

/** Nom affiché de l'état du ciel ; précipitations et tempêtes selon la température à la station. */
export function nomCiel(m: Meteo, tStation: number) {
  const neige = tStation < CLIMAT.seuilNeige;
  switch (m.ciel) {
    case 'degage': return 'Dégagé';
    case 'nuageux': return 'Nuageux';
    case 'brouillard': return 'Brouillard';
    case 'precipitations': return neige ? 'Neige' : 'Pluie';
    case 'tempete': return m.estOrage(tStation) ? 'Orage' : neige ? 'Tempête de neige' : 'Tempête';
  }
}

export class AffichageHorloge {
  private readonly heure = $('#horloge-heure');
  private readonly date = $('#horloge-date');
  private readonly saison = $('#horloge-saison');
  private readonly ciel = $('#horloge-ciel');
  private readonly temp = $('#horloge-temp');
  private readonly btn = $<HTMLButtonElement>('#horloge');
  private readonly menu = $('#temps');
  private dernier = '';

  constructor(private readonly h: Horloge) {
    // réglages retenus d'une visite à l'autre (confort personnel, sans importance si le stockage est indisponible)
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? '{}');
      if (['cycle', 'jour', 'nuit'].includes(s.journee)) h.setModeJournee(s.journee);
      if (['cycle', 'hiver', 'ete'].includes(s.saison)) h.setModeSaison(s.saison);
    } catch { /* stockage indisponible */ }
    this.cocher();

    this.btn.addEventListener('click', () => this.ouvrir(this.menu.hidden));
    this.menu.addEventListener('change', e => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'journee') h.setModeJournee(t.value as ModeJournee);
      if (t.name === 'saison') h.setModeSaison(t.value as ModeSaison);
      try { localStorage.setItem(STORE, JSON.stringify({ journee: h.modeJournee, saison: h.modeSaison })); } catch { /* stockage indisponible */ }
      this.dernier = '';
    });
    document.addEventListener('pointerdown', e => {
      if (!this.menu.hidden && !this.menu.contains(e.target as Node) && !this.btn.contains(e.target as Node)) this.ouvrir(false);
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !this.menu.hidden) { this.ouvrir(false); this.btn.focus(); } });
  }

  ouvrir(open: boolean) {
    this.menu.hidden = !open;
    this.btn.setAttribute('aria-expanded', String(open));
    if (open) this.menu.querySelector<HTMLInputElement>('input:checked')?.focus();
  }

  private cocher() {
    const s = this.h.modeSaison === 'printemps' || this.h.modeSaison === 'automne' ? 'cycle' : this.h.modeSaison;
    for (const [nom, val] of [['journee', this.h.modeJournee], ['saison', s]]) {
      const i = this.menu.querySelector<HTMLInputElement>(`input[name="${nom}"][value="${val}"]`);
      if (i) i.checked = true;
    }
  }

  /** Met la page à jour, seulement quand quelque chose d'affiché change. */
  update(meteo: Meteo | null, tStation: number) {
    const { h } = this, mn = Math.floor(h.heure * 60) % 1440, { jour, mois } = h.date, s = h.saison;
    const ciel = meteo ? nomCiel(meteo, tStation) : '', t = Math.round(tStation);
    const cle = `${mn}|${jour}|${mois}|${s}|${ciel}|${t}`;
    if (cle === this.dernier) return;
    this.dernier = cle;
    this.heure.textContent = `${String(Math.floor(mn / 60)).padStart(2, '0')}:${String(mn % 60).padStart(2, '0')}`;
    this.date.textContent = `${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]}`;
    this.saison.textContent = SAISONS.noms[s];
    this.ciel.textContent = ciel;
    this.temp.textContent = `${t < 0 ? '−' : ''}${Math.abs(t)} °C`;
  }
}
