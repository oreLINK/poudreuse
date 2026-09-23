// Horloge du jeu : journée (jour puis nuit, durées réglables), saisons, heure et date affichées. Logique pure, sans Three.js.
import { CLIMAT } from '../params/climat';
import { SAISONS, TEMPS, type ModeJournee, type ModeSaison, type Saison } from '../params/temps';

export interface OptionsHorloge {
  dureeJour: number; dureeNuit: number; modeJournee: ModeJournee;
  lever: number; coucher: number; phaseDepart: number; phaseJour: number; phaseNuit: number;
  dureeSaison: number; modeSaison: ModeSaison; saisonDepart: Saison;
}

const DEFAUT: OptionsHorloge = {
  dureeJour: TEMPS.dureeJour, dureeNuit: TEMPS.dureeNuit, modeJournee: TEMPS.modeJournee,
  lever: TEMPS.lever, coucher: TEMPS.coucher, phaseDepart: TEMPS.phaseDepart, phaseJour: TEMPS.phaseJour, phaseNuit: TEMPS.phaseNuit,
  dureeSaison: SAISONS.duree, modeSaison: SAISONS.mode, saisonDepart: SAISONS.depart,
};

export class Horloge {
  private readonly o: OptionsHorloge;
  /** Secondes écoulées dans la journée en cours (0 = lever du soleil). */
  private t: number;
  /** Journées complètes (lever à lever) écoulées depuis le lancement. */
  private cycles = 0;
  /** Numéro du jour calendaire au lancement (voir jourCourant). */
  private readonly jour0: number;
  /** Secondes écoulées depuis le début de l'année (0 = début de la première saison de SAISONS.ordre). */
  private an: number;

  constructor(options: Partial<OptionsHorloge> = {}) {
    this.o = { ...DEFAUT, ...options };
    this.t = this.secondesDepuisLever(this.o.phaseDepart);
    this.an = Math.max(0, SAISONS.ordre.indexOf(this.o.saisonDepart)) * this.o.dureeSaison;
    this.jour0 = this.jourCourant();
  }

  update(dt: number) {
    const { dureeJour, dureeNuit, dureeSaison, modeJournee } = this.o;
    this.an = (this.an + dt) % (dureeSaison * SAISONS.ordre.length);
    // jour ou nuit figés : le temps s'arrête (heure et date comprises), seule la saison peut avancer
    if (modeJournee !== 'cycle') return;
    this.t += dt;
    this.cycles += Math.floor(this.t / (dureeJour + dureeNuit));
    this.t %= dureeJour + dureeNuit;
  }

  /** Phase de l'éclairage (0 = minuit, 0,5 ≈ midi) : le jour couvre [lever, coucher], la nuit le reste. */
  get phase(): number {
    const { modeJournee, phaseJour, phaseNuit, dureeJour, dureeNuit, lever, coucher } = this.o;
    if (modeJournee === 'jour') return phaseJour;
    if (modeJournee === 'nuit') return phaseNuit;
    const p = this.t < dureeJour
      ? lever + (this.t / dureeJour) * (coucher - lever)
      : coucher + ((this.t - dureeJour) / dureeNuit) * (1 - (coucher - lever));
    return p % 1;
  }

  /** Vrai entre le lever et le coucher du soleil. */
  get estJour(): boolean {
    const p = this.phase;
    return p >= this.o.lever && p < this.o.coucher;
  }

  get saison(): Saison {
    if (this.o.modeSaison !== 'cycle') return this.o.modeSaison;
    return SAISONS.ordre[Math.floor(this.an / this.o.dureeSaison) % SAISONS.ordre.length];
  }

  /** Avancement (0–1) dans la saison en cours ; 0 si la saison est figée. */
  get avancementSaison(): number {
    return this.o.modeSaison === 'cycle' ? (this.an % this.o.dureeSaison) / this.o.dureeSaison : 0;
  }

  get modeJournee(): ModeJournee { return this.o.modeJournee; }
  get modeSaison(): ModeSaison { return this.o.modeSaison; }

  /** Change le mode de la journée en cours de partie, sans saut d'éclairage : le cycle repart de la lumière affichée. */
  setModeJournee(m: ModeJournee) {
    if (m === this.o.modeJournee) return;
    const p = this.phase;
    this.o.modeJournee = m;
    if (m === 'cycle') this.t = this.secondesDepuisLever(p);
  }

  /** Change le mode des saisons : en passant au cycle, l'année repart du début de la saison affichée. */
  setModeSaison(m: ModeSaison) {
    if (m === this.o.modeSaison) return;
    const s = this.saison;
    this.o.modeSaison = m;
    if (m === 'cycle') this.an = SAISONS.ordre.indexOf(s) * this.o.dureeSaison;
  }

  /** Moment de l'année pour le climat (0 = 21 décembre) : suit l'année en mode cycle, milieu de saison sinon. */
  get fractionAnnee(): number {
    if (this.o.modeSaison !== 'cycle') return CLIMAT.saisonFigee[this.o.modeSaison];
    return this.an / (this.o.dureeSaison * SAISONS.ordre.length);
  }

  /** Heures de jeu écoulées pendant dt secondes réelles (en moyenne sur une journée ; utilisé par la météo et la neige). */
  heuresDe(dt: number) { return (dt * 24) / (this.o.dureeJour + this.o.dureeNuit); }

  /** Heure affichée (décimale, 0–24), cohérente avec l'éclairage : lever et coucher aux heures du calendrier de la saison. */
  get heure(): number {
    const { lever, coucher } = SAISONS.calendrier[this.saison], s = this.secondesDepuisLever(this.phase);
    const h = s < this.o.dureeJour
      ? lever + (s / this.o.dureeJour) * (coucher - lever)
      : coucher + ((s - this.o.dureeJour) / this.o.dureeNuit) * (24 - (coucher - lever));
    return h % 24;
  }

  /** Nombre de minuits passés depuis le lancement. */
  get joursEcoules(): number { return this.jourCourant() - this.jour0; }

  /** Date affichée : jour et mois (1–12), dans la saison en cours (voir SAISONS.calendrier). */
  get date(): { jour: number; mois: number } {
    const i = SAISONS.ordre.indexOf(this.saison), cal = SAISONS.calendrier;
    const [j0, m0] = cal[this.saison].debut, [j1, m1] = cal[SAISONS.ordre[(i + 1) % SAISONS.ordre.length]].debut;
    const debut = Date.UTC(2001, m0 - 1, j0);
    let fin = Date.UTC(2001, m1 - 1, j1);
    if (fin <= debut) fin = Date.UTC(2002, m1 - 1, j1);
    const duree = Math.round((fin - debut) / 86400000);
    const decalage = this.o.modeSaison === 'cycle' ? Math.floor(this.avancementSaison * duree) : this.joursEcoules % duree;
    const d = new Date(Date.UTC(2001, m0 - 1, j0 + decalage));
    return { jour: d.getUTCDate(), mois: d.getUTCMonth() + 1 };
  }

  /** Numéro du jour calendaire : change à minuit, au milieu de la nuit selon les heures de la saison. */
  private jourCourant() {
    const { lever, coucher } = SAISONS.calendrier[this.saison], { dureeJour, dureeNuit } = this.o;
    const minuit = dureeJour + ((24 - coucher) / (24 - (coucher - lever))) * dureeNuit;
    return this.cycles + (this.t >= minuit ? 1 : 0);
  }

  /** Temps (s) depuis le lever correspondant à une phase donnée. */
  private secondesDepuisLever(p: number) {
    const { lever, coucher, dureeJour, dureeNuit } = this.o;
    const depuisLever = (((p - lever) % 1) + 1) % 1, jour = coucher - lever;
    return depuisLever < jour ? (depuisLever / jour) * dureeJour : dureeJour + ((depuisLever - jour) / (1 - jour)) * dureeNuit;
  }
}
