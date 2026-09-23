# Poudreuse

Jeu de gestion de station de ski en 3D isométrique minimaliste, sur des massifs générés procéduralement.

Le projet génère le domaine (réseau de vallées, massifs, pics rocheux, érosion, lacs, torrents, forêts étagées, aire plate pour la station, altitudes de station réalistes) et le fait vivre : jour et nuit, saisons (hiver ou été au choix), météo changeante (vent, nuages, brouillard, pluie ou neige, orages, tempêtes de neige), manteau neigeux simulé, risque d'avalanche de 0 à 5 et avalanches naturelles animées. Le joueur peut déjà y construire des maisonnettes.

## Démarrer

Il faut [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
npm run dev        # serveur local avec rechargement automatique
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | tests du générateur (déterminisme, altitudes, pentes, drainage, lacs, rivières), de la météo, de l'horloge, du manteau neigeux et des avalanches |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` | vérifie les types puis produit le site dans `dist/` |
| `npm run preview` | sert `dist/` en local pour tester le build |

## Publier sur GitHub Pages

1. Crée un dépôt sur GitHub et pousse le projet sur la branche `main`.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Chaque push sur `main` lance `.github/workflows/deploy.yml` : installation, tests, build, publication.

Le site est ensuite disponible à l'adresse `https://<ton-compte>.github.io/<nom-du-depot>/`. Les chemins sont relatifs (`base: './'` dans `vite.config.ts`), donc aucun réglage n'est nécessaire selon le nom du dépôt.

## Partager un domaine

L'adresse contient la taille et la graine, par exemple `?size=grand&seed=4217`. La même graine redonne toujours exactement le même domaine.

## Architecture

```
src/
  main.ts                 interface, Web Worker, boucle de rendu
  params/                 paramétrage, un fichier par thème (monde, terrain, neige, météo, temps, végétation, aménagement, bâtiments, affichage)
  jeu/
    construction.ts       contrôle des emplacements et registre des bâtiments
  ui/
    construction.ts       mode construction (icône, pose, confirmation)
    filtres.ts            menu des filtres (courbes de niveau, risque d'avalanche, probabilité de neige)
    horloge.ts            horloge (heure, date, saison, temps qu'il fait) et menu « Temps »
  sim/
    temps.ts              horloge : jour, nuit, saisons
    climat.ts             températures, enneigement de saison, probabilité de neige
    meteo.ts              vent et ciel (nuages, brouillard, précipitations, orages, tempêtes)
    manteau.ts            manteau neigeux, risque d'avalanche, déclenchements
    avalanche.ts          écoulement des avalanches
    monde.ts              cadence de la simulation
  gen/                    génération : données pures, sans Three.js
    math.ts               aléatoire déterministe, bruit, lissages
    network.ts            réseau de vallées (archétypes, affluents, étoiles, cols, lacs)
    erosion.ts            érosion hydraulique par gouttes
    hydrology.ts          remplissage des cuvettes, écoulement, rivières
    domain.ts             orchestration : relief, pics, lacs, aire de la station, hydrologie, altitude réelle
    sol.ts                lectures du sol : altitude, pente, eau
    generator.worker.ts   exécute la génération hors du fil principal
  render/                 affichage : Three.js
    stage.ts              moteur, lumières, caméra isométrique, navigation
    world.ts              assemble la scène d'un domaine
    terrain.ts, water.ts, vegetation.ts, relief.ts, atmosphere.ts
    neige.ts              objets qui suivent l'enneigement (chapeaux des sapins, corniches, toits)
    precipitations.ts     flocons et gouttes
    avalanches.ts         affichage des avalanches
    batiments.ts          bâtiments du joueur et aperçu de pose (cases vertes / rouges)
    dayCycle.ts           cycle jour-nuit, alpenglow, nuages, éclairs, brouillard
    shaders.ts            shaders de la glace, de l'eau, des nuages, de la neige soufflée
tests/
  generator.test.ts       garanties de gameplay vérifiées sur plusieurs graines et tailles
  meteo.test.ts           comportement du vent
  construction.test.ts    règles de construction
  temps.test.ts           horloge (jour, nuit, saisons)
  neige.test.ts           climat, manteau neigeux, avalanches
```

Les réglages du jeu (tailles de carte, altitudes, climat, météo, manteau neigeux, avalanches, durées du jour et de la nuit, saisons, zoom…) se modifient dans `src/params/`. `CONTEXT.md` décrit le projet en détail pour reprendre le travail sans historique.

Le principe : `gen/` produit un modèle de données (`Domain`) et `render/` ne fait que l'afficher. Le jeu (pistes, remontées, skieurs) viendra modifier ce modèle, ce qui rendra possibles la sauvegarde, les tests et la simulation, sans toucher au rendu.

## Repères techniques

- Unités : le générateur travaille en mètres. En 3D, 1 unité = 60 m au sol et le relief est exagéré de 30 % en hauteur pour la lisibilité. Les pentes sont toujours calculées sur les mètres réels.
- Orientation : nord = `-z`, vent dominant d'ouest, soleil levant à l'est (`+x`).
- Classes de pente : verte < 25 %, bleue 25–40 %, rouge 40–55 %, noire 55–100 %, paroi au-delà.
- Couleurs : le style a été calibré sans gestion des espaces colorimétriques (`src/render/colorSetup.ts`). Si tu la réactives, il faudra réajuster la palette et les shaders.
