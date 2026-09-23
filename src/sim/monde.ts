// Simulation d'un domaine dans le temps : météo, manteau neigeux et avalanches, cadencés par l'horloge.
// Logique pure, sans Three.js : le rendu lit l'état (météo, carte du manteau, particules des avalanches).
import type { Domain } from '../gen/types';
import { DECLENCHEMENT } from '../params/avalanches';
import { Avalanche } from './avalanche';
import { chaleurSaison, temperature, type Contexte } from './climat';
import { Manteau } from './manteau';
import { Meteo } from './meteo';
import type { Horloge } from './temps';

export class SimMonde {
  readonly meteo: Meteo;
  readonly manteau: Manteau;
  readonly avalanches: Avalanche[] = [];
  /** Vrai quand la carte du manteau a changé depuis la dernière lecture par le rendu. */
  carteModifiee = true;
  private numero = 0;

  constructor(readonly d: Domain, horloge: Horloge) {
    this.meteo = new Meteo(d.seed, d.L);
    this.manteau = new Manteau(d);
    this.manteau.update(0, this.meteo, this.contexte(horloge), 0);
  }

  contexte(h: Horloge): Contexte {
    const m = this.meteo;
    return { fraction: h.fractionAnnee, heure: h.heure, couverture: m.couverture, precipitation: m.precipitation, tempete: m.ciel === 'tempete' };
  }

  /** Température (°C) à l'aire de la station. */
  temperatureStation(h: Horloge) { return temperature(this.d.station.alt, this.contexte(h)); }

  /** Fait avancer le monde de dt secondes réelles ; renvoie les avalanches qui viennent de partir. */
  update(dt: number, h: Horloge): Avalanche[] {
    const heures = h.heuresDe(dt), c = this.contexte(h);
    this.meteo.update(dt, { heures, chaleur: chaleurSaison(c.fraction), temperatureStation: temperature(this.d.station.alt, c) });
    // le manteau est repris par tranches (une par image) : toute la grille en quelques images, sans à-coup
    const nouvelles: Avalanche[] = [];
    const libres = DECLENCHEMENT.maxSimultanees - this.avalanches.filter(a => a.enCours).length;
    const { declenchements, complet } = this.manteau.avancer(heures, this.meteo, c, libres);
    for (const dec of declenchements) {
      const a = new Avalanche(this.d, dec, this.d.seed + 1000 + this.numero++, this.manteau);
      this.avalanches.push(a);
      nouvelles.push(a);
    }
    if (complet) this.carteModifiee = true;
    for (let k = this.avalanches.length - 1; k >= 0; k--) {
      const a = this.avalanches[k];
      a.update(dt);
      if (a.terminee) this.avalanches.splice(k, 1);
    }
    return nouvelles;
  }
}
