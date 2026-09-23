# Poudreuse — contexte du projet pour une IA

Ce document permet à n'importe quel assistant IA (ou développeur) de reprendre le projet sans historique. Lis-le entièrement avant de modifier le code. **Il doit être mis à jour à chaque ajout, suppression ou modification du projet** (règle détaillée dans `CLAUDE.md`, section 14 pour le journal). Il décrit l'objectif, l'état actuel, l'architecture, les conventions, les décisions déjà prises avec le porteur du projet et les pièges connus.

---

## 1. Objectif

**Poudreuse** est un jeu web de gestion de station de ski, en 3D isométrique minimaliste, jouable dans le navigateur et hébergé sur GitHub Pages.

- Chaque partie se joue sur un **massif montagneux généré procéduralement** à partir d'une graine.
- Le joueur construira sa station : pistes, remontées mécaniques, bâtiments, gestion des skieurs.
- Le réalisme géographique est une priorité (vallées, pentes skiables, hydrologie, végétation, climat), mais le rendu reste **minimaliste** : facettes plates, formes simples, palette sobre.

**Statut actuel : la génération et l'affichage du domaine sont terminés. Le monde vit : horloge (jour et nuit de 5 min, saisons de 20 min, modes réglables dans l'interface), météo changeante (vent, ciel dégagé / nuageux / brouillard, pluie ou neige selon la température, orages l'été, tempêtes de neige l'hiver), manteau neigeux simulé avec risque d'avalanche de 0 à 5 et avalanches naturelles animées (plaque, aérosol, neige humide, coulée meuble). Le joueur peut construire un premier bâtiment (la maisonnette).** Pas encore de pistes, remontées, skieurs, économie ni sauvegarde. Le domaine généré ne contient **plus aucun bâtiment** : tous seront posés par le joueur.

Langue : l'interface, les commentaires du code et la documentation sont **en français**.

---

## 2. Démarrage rapide

Prérequis : Node.js 20 ou plus récent.

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances |
| `npm run dev` | serveur local avec rechargement automatique |
| `npm test` | tests Vitest du générateur et de la météo (~5 s) |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run build` | vérifie les types puis produit `dist/` |
| `npm run preview` | sert `dist/` en local |

Déploiement prévu : un workflow `.github/workflows/deploy.yml` qui installe, teste, construit et publie sur GitHub Pages à chaque push sur `main` (Settings → Pages → Source : **GitHub Actions**). **Attention : ce fichier n'existe pas encore dans le dépôt** (voir pièges connus).

Liens partageables : `?size=petit|moyen|grand|immense&seed=<entier>`. Une même graine redonne exactement le même domaine. Taille par défaut : **Moyen**. Les liens `?size=…` créés avant le décalage des tailles (22/09/2026) désignent désormais une carte d'une taille en dessous.

---

## 3. Pile technique

- **Vite 6** + **TypeScript 5** (mode `strict`, `noUnusedLocals`, `noUnusedParameters`).
- **Three.js 0.170**, piloté en impératif (pas de React Three Fiber). Choix confirmé avec le porteur : rester sur Three.js ; Babylon.js a été envisagé puis écarté.
- **Vitest 5** pour les tests.
- La génération tourne dans un **Web Worker** (module ES) ; les grands tableaux sont transférés sans copie.
- Aucun backend. Polices Google Fonts : *Unbounded* (titre) et *Figtree* (interface).
- `vite.config.ts` : `base: './'` (chemins relatifs, indispensable pour GitHub Pages dans un sous-dossier), `worker.format: 'es'`.

---

## 4. Architecture

```
index.html                  structure de la page (titre, barre d'outils, indicateur de chargement)
src/
  main.ts                   interface, Web Worker, paramètres d'URL, boucle de rendu
  style.css                 styles de l'interface
  params/                   PARAMÉTRAGE : un fichier par thème, données pures (voir section 12)
    monde.ts                tailles de carte, taille par défaut, échelle mètres → 3D
    terrain.ts              types de massifs, relief, pics, érosion, lacs, classes de pente
    neige.ts                roche / neige affichées, corniches, freeride
    climat.ts               températures, enneigement de saison, probabilité de neige
    meteo.ts                vent (calme, rafales, soutenu), ciel (épisodes, orages, tempêtes), précipitations affichées, mer de nuages
    avalanches.ts           manteau neigeux, niveaux de risque, déclenchement, écoulement des avalanches
    temps.ts                durées du jour et de la nuit, modes jour / nuit figés, saisons
    vegetation.ts           limite et densité de la forêt
    amenagement.ts          aire de la station (taille par carte, choix du site, pente)
    batiments.ts            catalogue des bâtiments constructibles (dimensions en arbres, pente max)
    affichage.ts            caméra (zooms), grossissement des objets, diamètre d'un arbre (ARBRE_M), filtres (TOPO, CALQUES)
  jeu/                      LOGIQUE DE JEU : pure, sans Three.js, testable
    construction.ts         Chantier : contrôle de l'emprise (cases vertes / rouges), registre des bâtiments
  sim/                      SIMULATION : logique pure, sans Three.js, pilotée par la boucle
    temps.ts                Horloge : phase de la journée, saison, heure et date ; modes changeables en cours de partie
    climat.ts               température (saison, heure, altitude, nuages), limite pluie-neige, neige de saison, probabilité de neige
    meteo.ts                vent (épisodes, rafales localisées) + ciel (épisodes, couverture, brouillard, précipitations, éclairs)
    manteau.ts              manteau neigeux par sommet de grille : couches, instabilité, risque 0–5, ruptures naturelles
    avalanche.ts            écoulement d'une avalanche (particules, modèle de Voellmy), dépôts
    monde.ts                SimMonde : cadence météo, manteau (par tranches) et avalanches avec l'horloge
  ui/
    construction.ts         mode construction : icône → aperçu au survol → clic → Confirmer
    filtres.ts              menu « Filtres » : courbes de niveau + un calque coloré (risque d'avalanche ou probabilité de neige), légende
    horloge.ts              horloge en haut à droite (heure, date, saison, temps, température) et menu « Temps »
  gen/                      GÉNÉRATION : données pures, AUCUNE dépendance à Three.js
    math.ts                 aléatoire déterministe (mulberry32), bruit de Perlin, smooth/smin/smax
    types.ts                types Domain, Valley, Network, RiverPoint
    network.ts              réseau de vallées (archétypes, affluents, étoiles, couverture, cols, lacs)
    erosion.ts              érosion hydraulique par gouttes
    hydrology.ts            remplissage des cuvettes (2 passes), écoulement, rivières
    domain.ts               orchestration complète → objet Domain, dont l'aire de la station
    sol.ts                  lectures du sol partagées : altitude, pente, eau (utilisées par render/ et jeu/)
    generator.worker.ts     exécute generateDomain() dans un worker
  render/                   AFFICHAGE : Three.js, lit le Domain sans le modifier
    colorSetup.ts           désactive la gestion colorimétrique (à importer en premier)
    palette.ts              couleurs du style
    terrainView.ts          conversions grille ↔ 3D, lectures du relief (via gen/sol.ts), convexité, pick() du point visé
    stage.ts                renderer, lumières, caméra isométrique, navigation
    world.ts                assemble la scène d'un domaine, dispose()
    terrain.ts              terrain à facettes (couleur enneigée + couleur d'été) + socle ; enneigement, courbes et calques dans le shader
    water.ts                lacs et torrents, gelés tant que la neige tient autour
    vegetation.ts           pins, mélèzes, arbres englacés (InstancedMesh) ; abattre() sous un bâtiment
    neige.ts                patchNeige : matériau masqué sans neige ou recoloré en été (chapeaux des pins, corniches, toits…)
    precipitations.ts       flocons ou gouttes autour de la vue, selon la limite pluie-neige
    avalanches.ts           cœur de l'avalanche, nuage d'aérosol, traînée du couloir, dépôts
    relief.ts               corniches + traces de freeride
    batiments.ts            bâtiments du joueur + aperçu de pose (fantôme, cases vertes / rouges)
    atmosphere.ts           mer de nuages + neige soufflée (particules pilotées par sim/meteo.ts)
    dayCycle.ts             éclairage selon la phase (sim/temps.ts) et le ciel (nuages, éclairs, brouillard), couleur des courbes
    shaders.ts              GLSL : bruit, glace, eau, nuages, particules, lecture de la carte du manteau ; uniformes partagés
tests/
  generator.test.ts         garanties de gameplay vérifiées sur plusieurs graines et tailles
  meteo.test.ts             comportement du vent et du ciel
  construction.test.ts      emprise, pente, chevauchement, bord de carte
  temps.test.ts             durées du jour et de la nuit, modes, saisons, heure et date
  neige.test.ts             climat, manteau neigeux, risque, déclenchements, écoulement des avalanches
CLAUDE.md                   consignes permanentes pour l'assistant (dont la mise à jour de ce fichier)
```

**Principe fondamental : séparation stricte données / rendu.** `gen/` produit un modèle (`Domain`), `jeu/` porte l'état du joueur (bâtiments), `sim/` fait évoluer le monde dans le temps, `render/` affiche, `ui/` relie les gestes aux actions de `jeu/`. `params/` est lisible par tous et ne dépend de rien. Les futures mécaniques de jeu devront modifier un modèle de données, jamais la scène directement. Cela garantit sauvegarde, tests et simulation indépendants du rendu.

### Le modèle `Domain` (src/gen/types.ts)

| Champ | Contenu |
|---|---|
| `seed` | graine |
| `N` | nombre de cases par côté (la grille a `(N+1)²` sommets) |
| `CELL` | taille d'une case en mètres |
| `L` | côté de la carte en mètres (`N × CELL`) |
| `h` | `Float32Array` des altitudes en mètres, index `j * (N+1) + i` |
| `lake` | `Uint8Array`, 1 = surface de lac gelé (parfaitement plate) |
| `isRiver` | `Uint8Array`, 1 = case traversée par un cours d'eau |
| `rivers` | liste de rivières, chacune une liste `[i, j, surfaceDrainéeEnCases, altitude]` de l'amont vers l'aval |
| `station` | `{ x, z, alt, R }` en mètres : centre, altitude et rayon de l'aire plate où le joueur bâtit son village de ski |

---

## 5. Conventions

- **Unités** : le générateur travaille en **mètres**. En 3D, **1 unité = 60 m au sol** (`UNIT`), altitude 3D = `(alt − 1600) / 60 × 1,3` (`ALT0 = 1600`, relevé de 1 000 à 1 600 avec les altitudes réelles pour garder la scène centrée ; exagération verticale `VEX = 1,3` pour la lisibilité), réglables dans `params/monde.ts` (`ECHELLE`). **Les pentes sont toujours calculées sur les mètres réels.**
- **Paramètres** : toute valeur de réglage (seuil, durée, taille, probabilité) va dans `src/params/`, commentée, et non en dur dans le code.
- **Orientation** : nord = **−z**. Vent dominant **d'ouest** (souffle vers +x). Soleil levant à l'est (+x), au sud (+z) à midi, couchant à l'ouest.
- **Grille** : chaque case est découpée en deux triangles `(i,j),(i,j+1),(i+1,j)` et `(i+1,j),(i,j+1),(i+1,j+1)`. `TerrainView.altAt()` interpole sur ces mêmes triangles : tout objet posé au sol doit l'utiliser.
- **Déterminisme** : tout aléatoire du générateur et de la simulation passe par `rng(seed + k)`. Ne jamais utiliser `Math.random()` dans `gen/` ni `sim/` (autorisé seulement pour les particules d'ambiance dans `render/`). Graines déjà prises : générateur 0–31, relèvement des altitudes `seed + 32`, rendu 5–99, vent `seed + 901`, ciel `seed + 902`, manteau neigeux `seed + 903`, avalanches `seed + 1000 + n`.
- **Temps de simulation** : la météo et la neige comptent en **heures de jeu** (`Horloge.heuresDe(dt)` : 24 h par journée de 10 min, soit **1 h ≈ 25 s** réelles, que la journée soit figée ou non). Les avalanches et les éclairs, eux, sont animés en secondes réelles.
- **Classes de pente** (`params/terrain.ts`) : replat < 5 %, **verte 5–25 %**, **bleue 25–40 %**, **rouge 40–55 %**, **noire 55–100 %**, paroi non skiable au-delà. Au rendu, la roche apparaît au-delà de `rockLim = 100 × (70 / CELL)^0,4` % (les grandes mailles lissent les pentes, le seuil est donc abaissé ; sur le Petit, maille 58 m, il monte à ~108 %). Voir section 7 pour les barres rocheuses en dessous de ce seuil.

---

## 6. Pipeline de génération (src/gen/domain.ts)

Temps indicatifs (Node, machine du porteur, 22/09/2026) : Petit ~0,4 s, Moyen ~0,6 s, Grand ~0,8 s, Immense ~1,1 s.

### 6.1 Tailles (chaque taille double la **surface** de la précédente)

Définies dans `params/monde.ts` (`SIZES`).

| Taille | Côté | Maille (`CELL`) | `N` | Rang |
|---|---|---|---|---|
| Petit | 12,7 km | 58 m | 219 | −1 |
| **Moyen** (défaut) | 18 km | 70 m | 257 | 0 |
| Grand | 25,5 km | 85 m | 300 | 1 |
| Immense | 36 km | 106 m | 340 | 2 |

Le porteur voulait que « le grand soit le petit puis double à chaque fois ». On a doublé la surface et non le côté (le côté aurait donné 144 km, irréaliste). Les montagnes gardent leurs dimensions physiques : une grande carte contient **plus** de vallées, pas des montagnes plus grosses.

Le 22/09/2026, le porteur a demandé que **tout descende d'un cran** (l'ancien Petit devient Moyen, etc., l'ancien Immense de 51 km est supprimé, un Petit de 12,7 km est créé), pour que les éléments soient plus gros à l'écran lors du tracé des pistes et de la pose des bâtiments. Le **rang** remplace l'ancien indice de taille dans les formules de hauteur des massifs et de pics : le Moyen (rang 0) produit donc exactement le relief de l'ancien Petit pour une même graine (aux faces des pics près, voir 6.3).

### 6.2 Réseau de vallées (network.ts)

1. **Vallées maîtresses** : 6 archétypes combinables, décrits dans une boîte unitaire : `axe`, `coude`, `confluence` (Y), `etoile` (bassin central + bras rayonnants), `parallele` (2–3 vallées séparées par des crêtes), `transmassif` (deux vallées opposées reliées par un col). Sous 22 km de côté (Petit, Moyen) = 1 archétype sur toute la carte ; au-delà, la carte est parfois découpée la carte en 2–3 zones, chacune avec son archétype tourné et inversé au hasard. Le porteur a explicitement demandé de **mélanger tous les motifs sans limite**.
2. L'aval de chaque vallée maîtresse est **prolongé jusqu'au bord de la carte ou jusqu'à une vallée existante** (sinon l'eau n'a pas d'exutoire et le remplissage crée de grandes zones plates).
3. **Affluents** jusqu'à 4 niveaux, greffés en remontant avec un angle aigu, parfois **suspendus** (gradin de 150 à 400 m à la jonction), parfois en **bassin en étoile** (3 vallons depuis une même tête). Écart minimal entre fonds de vallée : 2 700 m.
4. **Passe de couverture** : repère les zones sans vallée et y fait pousser une vallée (depuis la plus proche ou depuis le bord).
5. **Cols** : relient deux têtes de vallée proches à travers une crête.
6. **Lacs** planifiés en tête de cirque (au-dessus de 1 800 m) et au centre de certains bassins en étoile.

Pentes des fonds : vallées maîtresses 1,6–3,5 %, affluents 4,5 % et plus. Plafonds : 2 100 m pour les vallées maîtresses, 2 500 m pour les affluents.

### 6.3 Relief

- Pour chaque case : altitude du fond de la vallée la plus proche + versant qui monte en fonction de la distance, combiné entre vallées par un **minimum adouci** (`smin`) : les **crêtes naissent là où deux vallées se rencontrent**.
- Hauteur des versants relative à un **plafond régional** (`1450 + Hm × 1,1`), pour éviter des sommets absurdes au-dessus de fonds déjà hauts.
- **Régions de caractère** (4 à 14 selon la taille), mélangées par poids gaussiens :

| Type | H (m) | λ (m) | k (finesse des crêtes) | Rugosité | Aiguilles |
|---|---|---|---|---|---|
| alpin | 1750 | 2100 | 160 | 0,5 | non |
| cristallin (aiguilles) | 2200 | 1650 | 70 | 0,9 | oui |
| ancien (ballons) | 700 | 2400 | 480 | 0,15 | non |
| volcan | 1150 | 2200 | 220 | 0,3 | non, + cône avec cratère, brèche, ravines |

- Les massifs sont plus hauts sur les grandes cartes (`× (1 + 0,09 × rang)`).
- **Pics rocheux** : pyramides à 3–4 arêtes, non skiables, placées loin des vallées, plus nombreuses et plus hautes sur les grandes cartes. Leurs faces sont creusées par un bruit « en arêtes » (`PICS.rugosite`) : des pyramides lisses ressemblaient à des toits enneigés (retour du porteur).
- Le relief est construit dans un **repère de référence** (point bas vers 850–1 150 m, sommets 3 700–4 150 m), puis relevé en fin de pipeline (6.8). Dans ce repère, au-delà de 3 900 m, les altitudes sont **tassées** (`3900 + (h − 3900) × 0,55`). Les altitudes de `RELIEF`, `LACS` et des fonds de vallée de `network.ts` s'expriment dans ce repère.

### 6.4 Érosion (erosion.ts)

Érosion hydraulique par gouttes, **légère** (~0,7 goutte par case, ravines de 40 m maximum). Elle ne doit pas transformer les bleues en rouges.

### 6.5 Lacs d'altitude

Cuvette creusée (30 m) et **verrou rocheux** relevé autour, sauf si l'altitude est inférieure à 1 750 m. Les lacs de moins de 6 ha sont supprimés.

### 6.6 Hydrologie (hydrology.ts)

- **Priority-flood en deux passes** : la 1re remplit à plat les zones de lac et repère les vrais lacs ; la 2e donne une pente minimale de 2 % (`eps = CELL × 0,02`) à tout le reste. Garantie : **chaque case a une descente** vers le bord de la carte (un skieur ou l'eau ne reste jamais bloqué dans une cuvette). La 2e passe a été ajoutée parce que les tests ont révélé des micro-replats autour des lacs supprimés.
- **Écoulement** : ligne de plus grande pente en 8 directions, avec un léger départage aléatoire des replats pour éviter les tracés rectilignes ; sinon direction issue du remplissage.
- **Rivières** : bassin versant ≥ 2,4 km² et longueur ≥ 1,5 km. Le porteur a demandé d'en réduire le nombre de moitié (surtout les petites) et des tracés moins rectilignes.

### 6.7 Aire de la station (flattenStation, domain.ts)

Demande du porteur : **une seule aire assez plate par carte**, proportionnelle à la taille de la carte, pour y bâtir le village de ski, **sur la partie la plus basse** (Petit) ou **sur une des parties les plus basses** (autres tailles). Réglages : `params/amenagement.ts` (`STATION`).

| Taille | Rayon de l'aire | Surface | Sites comparés |
|---|---|---|---|
| Petit | 700 m | ~1,5 km² | 1 (le plus bas) |
| Moyen | 950 m | ~2,8 km² | 3 |
| Grand | 1 250 m | ~4,9 km² | 4 |
| Immense | 1 600 m | ~8 km² | 5 |

1. Des sites candidats couvrent la carte (pas d'un demi-rayon, à distance du bord ≥ max(rayon + talus, 8 % du côté), sans zone de lac) ; pour chacun, altitude moyenne et rugosité (écart moyen à cette altitude).
2. On garde les N sites **distincts** les plus bas (N = « sites comparés »), puis celui qui demande le **moins de terrassement**.
3. Le terrain y devient un **plan** ajusté par moindres carrés : pente de 1,5 à 2,5 % dans le sens naturel, plus un **dévers de 1,5 %** vers le bord naturellement le plus bas (l'eau longe l'aire au lieu de stagner). Pente totale ≤ ~3 %.
4. Un **talus** (½ rayon) raccorde le plan au relief (`smooth`).

L'aplanissement se fait **avant l'hydrologie** : l'écoulement et les rivières en tiennent compte. Un torrent peut encore traverser l'aire (les cases d'eau ne sont pas constructibles ; le test tolère < 10 % d'eau). Aucun arbre sur l'aire ni dans une lisière de 60 m ; la mer de nuages y est **trouée** (`NUAGES.troueeStation`) pour construire à découvert.

Le village traditionnel (70 chalets + clocher) et les refuges ont été **supprimés à la demande du porteur** : les seuls bâtiments sont ceux du joueur.

### 6.8 Altitude réelle (relever, domain.ts)

Demande du porteur (23/09/2026) : **point bas entre 1 300 et 2 000 m selon la carte**, pour des altitudes de station réalistes. En dernière étape, toute la carte (et les altitudes des rivières) est relevée d'un **même décalage** : les pentes, lacs, rivières et l'aire de la station sont inchangés, les tests de jouabilité restent valables. Le point bas visé est tiré dans `ALTITUDE.pointBas` (`rng(seed + 32)`), puis abaissé si besoin pour que les sommets ne dépassent pas `ALTITUDE.sommetMax` (4 800 m), sans descendre sous 1 300 m : **les massifs très hauts ont une base plus basse**. Mesuré sur 11 cartes : point bas 1 305–1 840 m, sommets 4 000–4 800 m, aire de station 1 330–1 960 m.

## 7. Rendu (src/render/)

- **Caméra** : orthographique, **isométrique vraie** (élévation `atan(1/√2)`), rotation par pas de 90°. Glisser = déplacer, molette/pincer = zoomer, flèches ← → = pivoter, + / − = zoomer. Mouvements amortis, instantanés si `prefers-reduced-motion`. **Zoom initial 1,4** (les coins de la carte sortent légèrement du cadre), zoom de 0,8 à `max(8, largeur / 14)` : réglages `params/affichage.ts` (`CAMERA`).
- **Taille des objets** : arbres et bâtiments sont grossis de **× 1,4** (`OBJETS.echelle`) pour rester lisibles et faciles à viser ; la densité de forêt a été abaissée (5 500 → 4 600) pour compenser. Un arbre mesure en moyenne **1,13 × 1,4 ≈ 1,58 unité ≈ 95 m** de diamètre (`ARBRE_M`) : c'est l'unité de mesure des bâtiments.
- **Terrain** : maillage non indexé à facettes, couleurs par sommet. Neige : poudreuse bleutée en ubac, neige transformée plus chaude en adret, dure et grise sur les crêtes, éclatante dans les combes. Roche sur les parois et sur les crêtes soufflées côté vent. **Barres rocheuses** : entre 55 % du seuil de roche et le seuil, la roche perce sur les nervures convexes et la neige reste dans les couloirs concaves (convexité lissée sur ~160 m, plus un bruit de plaques de 350 m) ; au-dessus de 3 300 m, le seuil baisse jusqu'à −25 % (faces décapées). Sans cela, les faces raides étaient uniformément blanches et « ressemblaient à des toits en neige » (retour du porteur). Un essai avec des couloirs étirés dans la ligne de pente donnait un damier et a été abandonné. Réglages : `params/neige.ts`. **Été** : chaque facette a aussi une couleur sans neige (attribut `colorEte` : prés et sous-bois sous la limite de la forêt, alpages jusqu'à ~450 m au-dessus, pierriers plus haut ; la roche reste la roche). Le shader mélange les deux selon l'enneigement lu dans la **carte du manteau neigeux** (bord irrégulier), et grise légèrement la neige humide. L'ancienne limite pluie-neige figée (prés en adret sous 1 250 m) a été supprimée : c'est désormais la simulation qui déneige.
- **Socle du diorama** : liseré de neige + couches de terre, jusqu'à 5 unités sous le point bas de la carte.
- **Lacs** : gelés tant que la neige tient autour (shader bleu turquoise, pellicule de neige étirée par le vent, fissures sombres), eau libre bleu sombre animée de reflets sinon. Le porteur a demandé des lacs **bleus comme les cours d'eau**, bien visibles.
- **Torrents** : rubans lissés (Chaikin) avec méandres proportionnés à la taille de la rivière et inversement à la pente. Tronçons gelés (plus en altitude et sur les petits ruisseaux) et eau vive sombre avec **animation minimaliste** (traits clairs qui descendent le courant). Les tronçons gelés dégèlent quand la neige disparaît (carte du manteau).
- **Végétation étagée** : pins denses, mélèzes clairsemés, arbres englacés (« soldats de neige ») à la limite de la forêt. Limite vers 2 250 m (relevée de 1 950 m avec les altitudes réelles, pour garder de la forêt autour des stations hautes), **~170 m plus basse en ubac**, bords irréguliers. Rien sur les lacs, rivières, pentes > 70 % ni sur l'aire de la station. Les chapeaux de neige des pins disparaissent sans neige ; les arbres englacés deviennent de jeunes pins verts (`patchNeige`).
- **Corniches** au-dessus de 2 800 m sur les crêtes, côté sous le vent ; masquées sans neige.
- **Traces de freeride** dans les combes orientées au nord au-dessus de 2 600 m ; masquées sans neige.
- **Bâtiments du joueur** (`render/batiments.ts`) : soubassement de pierre jusqu'au point le plus bas de l'emprise (plancher au point le plus haut), murs de bois, toit enneigé à deux pans avec rive sombre (sinon le toit blanc se confond avec la neige), porte. Murs éclairés la nuit par le cycle du jour. Sans neige, le toit prend une couleur de bardeaux.
- **Mer de nuages** : nappe bruitée dans les fonds de vallée, dense le matin, dissipée à midi.
- **Neige soufflée** : particules depuis les plus hautes crêtes, poussées vers l'est, **seulement là où le vent souffle** d'après `sim/meteo.ts` (plus de vent continu permanent, demande du porteur). Une particule qui meurt tente de repartir d'une crête au hasard avec une probabilité égale à l'intensité locale du vent ; sinon elle attend 0,1–0,5 s. La vitesse suit l'intensité.
- **Cycle jour-nuit** : piloté par l'horloge (`sim/temps.ts`, voir 12) ; **5 min de jour** (lever → coucher : matin froid aux ombres bleues, midi, alpenglow rose au couchant) puis **5 min de nuit** lunaire. Le fond de page suit le ciel. Figé sur la lumière du matin si `prefers-reduced-motion`.
- **Perspective atmosphérique** : brouillard léger qui estompe le fond de la carte ; il se resserre avec le brouillard et les précipitations (`Stage.brume`).
- **Météo** (`render/dayCycle.ts`) : les nuages retirent jusqu'à 75 % du soleil direct et grisent la lumière et le ciel ; un éclair d'orage blanchit brièvement la scène ; par brouillard, la mer de nuages s'épaissit et monte.
- **Précipitations** (`render/precipitations.ts`) : 5 000 particules au plus autour du centre de la vue, nombre proportionnel à l'intensité ; chacune est un flocon (lent, qui dérive avec le vent) ou un trait de pluie (rapide, incliné par le vent) selon son altitude par rapport à la limite pluie-neige : l'été, il pleut en bas et il neige sur les sommets.
- **Avalanches** (`render/avalanches.ts`) : cœur blanc dense (beige pour la neige humide), nuage translucide qui monte au-dessus d'un aérosol rapide, **traînée gris-bleu** qui dessine le couloir parcouru, blocs de dépôt ; le tout s'estompe en 90 s après l'arrêt. Premier essai : particules seules, confondues avec les flocons et invisibles une fois arrêtées, d'où la traînée et les dépôts.

---

## 8. Interface et style (décisions du porteur)

L'interface est volontairement **minimale**. Le porteur a explicitement demandé de **supprimer** :

- les réglages (rugosité, enneigement, types de relief, qualité de neige, chute de neige) ;
- les noms des montagnes (« on verra plus tard ») ;
- la lecture des données de case au survol ;
- le panneau de profil du domaine (statistiques de pentes).

**Seuls restent** : pivoter à gauche / à droite, la boussole, **l'icône de construction (maisonnette)**, **le bouton « Filtres »**, le choix de taille (Petit / Moyen / Grand / Immense), le bouton « Nouveau massif » et **l'horloge** en haut à droite (avec son menu « Temps »). Ne pas rajouter d'éléments d'interface sans demande.

**Horloge** (demande du porteur, 23/09/2026) : panneau en haut à droite, en face du titre : l'heure du jeu (`09:22`, chiffres à chasse fixe), dessous la date et la saison (« 21 décembre · Hiver »), puis le temps qu'il fait et la température à l'aire de la station (« Tempête de neige · −8 °C »). Mise à jour seulement quand un texte change (`ui/horloge.ts`). Une minute de jeu dure environ 0,5 s réelle en hiver.
- **Menu « Temps »** (demande du porteur, 23/09/2026) : un clic sur l'horloge ouvre deux choix segmentés. **Journée** : Normal (jour puis nuit) / Jour / Nuit. **Saisons** : Normal (les quatre saisons, 20 min chacune) / Hiver / Été. Changement immédiat, sans saut d'éclairage ; retenu dans `localStorage` ; fermeture par Échap ou clic ailleurs. Par défaut : journée normale, **hiver** (décision du porteur).
- États affichés : Dégagé, Nuageux, Brouillard, Neige ou Pluie (selon la température à la station), Tempête de neige, Orage (tempête au-dessus de 5 °C), Tempête (entre les deux).

**Filtres** (demande du porteur, 22/09/2026) : le bouton « Filtres » (icône de calques) ouvre un menu au-dessus du dock, avec un interrupteur par filtre. Fermeture par Échap ou clic ailleurs ; le bouton porte un liseré orange quand un filtre est actif. Le choix est retenu dans `localStorage` (confort personnel, optionnel).
- **Deux calques colorés, exclusifs** (demande du porteur, 23/09/2026) : ils teintent tous deux le relief, activer l'un éteint l'autre ; une **légende** apparaît sous l'horloge. Comme les courbes, ils sont éclairés de jour et lumineux la nuit. Réglages : `CALQUES` dans `params/affichage.ts`.
  - **Risque d'avalanche** (touche A) : niveau 1 vert, 2 jaune, 3 orange, 4 rouge, 5 violet (`RISQUE.couleurs`) ; le niveau 0 (pas de neige, pente sous 27°) n'est pas coloré. Le niveau est lu case par case, sans interpolation (sinon des anneaux 1-2-3-4 artificiels bordaient chaque zone de niveau 5).
  - **Probabilité de neige** (touche N) : blanc à 0 %, bleu à 99 %. Interprétation retenue de « probabilité de chutes de neige sur ce secteur en général » : **chance qu'il neige au moins une fois sur le secteur en 3 jours, en moyenne de saison** (voir 12). Une première version (« neige plutôt que pluie quand il précipite ») donnait un bleu uniforme en hiver, donc inutile.
- **Topographie** (touche T) : courbes de niveau tous les **10 m**, marquées tous les **100 m**. Calculées au pixel dans le shader du terrain (épaisseur constante à tous les zooms, aucune géométrie ajoutée, fondu de 0,25 s). Quand les courbes se serrent à moins de 9 px (parois, vue d'ensemble), les courbes de 10 m s'effacent, puis les maîtresses ; en vue d'ensemble, les maîtresses sont allégées (35 %) pour que la carte ne soit pas couverte de bandes orange. Les courbes reviennent en zoomant. Réglages : `TOPO` dans `params/affichage.ts`. Pas de chiffres d'altitude affichés.
  - **Couleur selon l'heure** (demande du porteur, 23/09/2026 : l'orange était peu lisible selon le moment de la journée) : **brun-ocre foncé** (`#7a4f24`) sur la neige éclairée, **crème** (`#d9c49a`) la nuit, mélange au crépuscule. De jour, les courbes sont éclairées comme la neige ; la nuit, elles sont ajoutées **après l'éclairage** (sinon elles s'assombrissent avec la scène et disparaissent), à 60 % d'intensité (`intensiteNuit`). **Couleurs interdites** : bleu, vert, rouge et noir (propres aux pistes) ; le violet est réservé au futur risque d'avalanche 5.

**Construction** (demande du porteur, 22/09/2026) : cliquer sur l'icône du bâtiment, le placer sur la carte, puis confirmer.
- Survol (souris) : un **bâtiment fantôme** translucide suit le pointeur, posé sur une grille de **cases vertes / rouges** (2 cases par arbre de côté ; 6 × 4 pour la maisonnette) visibles à travers lui. Le bâtiment s'aligne sur cette grille.
- Une case est verte si : pente ≤ pente max du bâtiment (8 % pour la maisonnette, mesurée au centre et aux 4 coins), pas d'eau, pas d'autre bâtiment, dans la carte. **Toutes les cases doivent être vertes** pour confirmer.
- Clic ou toucher (sans glisser) : pose provisoire ; une barre au-dessus du dock affiche le nom, une aide, « Tourner » (⤾ ou touche R), « Annuler » (Échap) et « Confirmer » (Entrée), désactivé tant qu'une case est rouge. Glisser déplace toujours la carte.
- Après confirmation, les arbres sous l'emprise (+ 0,3 arbre de marge) sont abattus et le mode reste actif pour enchaîner ; recliquer l'icône ou Annuler en sort.
- Les bâtiments peuvent être posés **partout où le terrain le permet**, pas seulement sur l'aire de la station (qui est simplement le seul grand terrain plat). Ils sont perdus au changement de carte (pas encore de sauvegarde).
- **Maisonnette** : emprise de **3 arbres × 2 arbres** (~285 × 190 m au sol), murs 0,8 arbre, toit 0,6 arbre. Interprétation de « la taille de 3 arbres » : largeur de 3 arbres côte à côte ; réglable dans `params/batiments.ts`.

Style :
- Boutons actifs et primaires : texte en `var(--on-ink)` (clair en thème clair, sombre en thème sombre ; avant, texte blanc sur fond clair en thème sombre).
- Titre « Poudreuse » en *Unbounded* 800, sous-ligné par 4 barres aux couleurs des pistes (vert `#2e9e5b`, bleu `#2d6fd1`, rouge `#d23b3b`, noir `#1f2c3a`).
- Barre d'outils flottante en bas, panneau translucide flouté.
- Palette du relief dans `src/render/palette.ts`.
- **Gestion colorimétrique désactivée** (`THREE.ColorManagement.enabled = false`, sortie `LinearSRGBColorSpace`) et **intensités lumineuses × π** (`LIGHT_SCALE`) : le style a été calibré ainsi avec Three r128 puis porté. Si on réactive la gestion colorimétrique, il faut réajuster palette et shaders.

Nom du jeu : **Poudreuse** (décision finale ; d'autres noms ont été étudiés et écartés). Accroche possible : « Un nouveau massif à chaque partie. À vous d'en faire une station. »

---

## 9. Tests et garanties (tests/)

`generator.test.ts` : vérifiés sur les graines 1, 42 et 777 en taille **Moyen** et 5, 314 en taille **Petit** :

- **déterminisme** : même graine → même carte ;
- **altitudes réalistes** : point bas entre 1 300 et 2 000 m, sommet au-dessus de 3 200 m et sous `ALTITUDE.sommetMax` (sauf si le point bas est déjà au minimum), et sous 5 000 m ; le point bas varie d'une carte à l'autre ;
- **répartition des pentes jouable** : vertes > 15 %, bleues > 10 %, rouges > 5 %, noires > 3 %, replats < 25 % ;
- **aucune cuvette** : chaque case a une voisine plus basse (ou égale dans un lac) ;
- **lacs plats** ;
- **rivières qui descendent** ;
- **aire de station** (aussi sur Grand et Immense) : rayon conforme aux paramètres, entièrement dans la carte, chaque case à moins de 5 % de pente (hors lisière à 90 % du rayon), moins de 10 % de cases d'eau, altitude sous la médiane de la carte ; sur le **Petit**, sous le 15e centile (la partie la plus basse).

`construction.test.ts` : maisonnette de 3 × 2 arbres, constructible au centre de l'aire avec toutes les cases vertes, chevauchement refusé mais bâtiment accolé accepté, pente raide refusée avec cases rouges, bord de carte refusé.

`temps.test.ts` : heure du lever, du coucher et de minuit ; départ le 21 décembre, changement de date à minuit, passage du nouvel an, retour au 21 décembre après le 19 mars ; heure et date figées en mode jour ; date qui suit la saison en mode cycle ; 5 min de jour et 5 min de nuit par défaut, durées réglables respectées, départ à la phase voulue et avance sans saut, le jour couvre la course du soleil, modes jour / nuit figés, hiver figé par défaut, saisons de 20 min dans l'ordre en mode cycle, été figé. Changement de mode en cours de partie sans saut d'éclairage, passage des saisons figées au cycle depuis la saison affichée, 1 h de jeu = 25 s.

`meteo.test.ts` : les trois modes de vent apparaissent, intensités bornées, rafales localisées (une partie de la carte ventée, une autre calme), vent soutenu sur toute la carte, déterminisme ; ciel : les cinq états apparaissent en hiver comme en été, tempêtes d'hiver sans éclairs avec vent fort partout, orages d'été avec éclairs, grandeurs bornées, déterminisme.

`neige.test.ts` (graine 42, Moyen) : plus chaud en été, en bas et l'après-midi ; limite pluie-neige sous 1 300 m en hiver, entre 2 500 et 4 200 m en été ; enneigement de saison partout en hiver, en haute altitude seulement l'été, plus bas en ubac ; probabilité de neige croissante avec l'altitude et face au vent, bornée à 99 % ; mise à jour par tranches complète ; temps calme sans neige fraîche : aucune avalanche et risque ≤ 2 ; pentes sous 27° au niveau 0 ; une tempête fait monter le risque (plus de 100 sommets ≥ 4) puis il redescend ; une tempête déclenche des avalanches, sur des pentes raides, coulées meubles ponctuelles ; plaques sous le vent (versants est) au moins 5 fois plus épaisses qu'au vent ; la forêt réduit l'instabilité ; l'été, le bas est déneigé et la pluie humidifie la neige ; une avalanche dévale (dépôt > 100 m plus bas, sur une pente moyenne < 30 %) et s'arrête ; aérosol > 100 km/h, neige humide < 90 km/h et au moins 1,8 fois plus lente.

Tout changement de paramètres du générateur doit garder ces tests au vert. Répartition typique observée : ~35–45 % vertes, ~20 % bleues, ~12–15 % rouges, ~15–25 % noires, 5–8 % parois.

---

## 10. Pièges connus

- Les modules qui créent des `THREE.Color` au chargement doivent être importés **après** `render/colorSetup.ts` (c'est le premier import de `main.ts`).
- `half` est un **mot réservé GLSL** : ne pas l'utiliser comme nom d'uniforme (d'où `uHalf`).
- Le worker poste le `Domain` avec `transfer` : après envoi, les tableaux ne sont plus utilisables côté worker.
- Les très grandes cartes (Immense : ~320 000 triangles, jusqu'à 24 000 arbres, ombres en 4096) sont exigeantes sur mobile. Pistes d'optimisation : tuiles avec niveaux de détail, ombres adaptatives, érosion en WebAssembly.
- Les seuils d'altitude du rendu et du climat (`FORET.limite`, `NEIGE.cornicheAlt`, `freerideAlt`, `decapageAlt`, `ENNEIGEMENT.limite`, `CLIMAT`) sont en **altitudes réelles** ; ceux du générateur (`RELIEF`, `LACS`, `network.ts`) dans le **repère de référence** (6.3). Ne pas les confondre.
- Tester le site de production nécessite un serveur HTTP (`npm run preview`) : les workers modules ne fonctionnent pas en `file://`.
- **`.github/workflows/deploy.yml` est absent** alors que le README et la section 2 le décrivent : à recréer avant le premier déploiement.
- **`.gitignore`** : ignore `node_modules/`, `dist/`, caches (Vite, Vitest, TypeScript), journaux, `.env`, fichiers macOS et iCloud (`*.icloud` : le projet est dans iCloud Drive), réglages d'éditeur et `.claude/settings.local.json`. `package-lock.json` et `CLAUDE.md` restent versionnés. iCloud peut créer des copies en conflit (« fichier 2.ts ») : elles ne sont pas ignorées exprès, pour qu'elles se voient dans `git status`.
- Uniformes partagés `shared.topo` (0–1, visibilité du filtre, animée par `ui/filtres.ts`), `shared.topoColor` et `shared.topoLueur` (couleur et part lumineuse des courbes, fixées par `render/dayCycle.ts`). Le shader du terrain reconstruit l'altitude en mètres depuis `position.y` (`y / VEX × UNIT + ALT0`) : à garder cohérent si l'échelle change.
- **Carte du manteau neigeux** : `Manteau.carte`, 4 octets par sommet de grille (r = enneigement, g = niveau de risque × 51, b = probabilité de neige, a = humidité), chargée dans une `DataTexture` (`World.attacherCarte`) et lue par `carteEn(xz)` / `carteNette(xz)` (`GLSL_CARTE`, shaders.ts) dans le terrain, l'eau et tout matériau passé par `patchNeige`. Coordonnées : unités 3D, convertie en texel par `uCarteN` et `uCarteS`. Tout nouvel objet qui porte de la neige doit passer par là.
- `patchNeige(..., { masquer: true })` jette les fragments sans neige, mais l'**ombre portée** reste (matériau de profondeur séparé) : acceptable pour de petits objets (chapeaux, corniches).
- **Coût du manteau** : une mise à jour complète coûte ~18 ms sur Immense ; elle est donc étalée en 8 tranches de lignes, une par image (~2,3 ms), chaque tranche recevant les heures écoulées depuis son dernier passage (`Manteau.avancer`). La probabilité de neige n'est recalculée que si la saison a avancé. La texture n'est renvoyée à la carte graphique qu'à la fin d'un tour complet.
- TypeScript 5.9 : un `Uint8Array` passé à `THREE.DataTexture` doit être typé `Uint8Array<ArrayBuffer>`.
- Styles : `[hidden] { display: none !important; }` est nécessaire, sinon un `display: flex` écrase l'attribut `hidden` (la barre de confirmation s'affichait au chargement).
- Le `Domain` a changé (`station` remplace `village` et `refuges`) : toute future sauvegarde devra stocker la version du générateur.
- Capture d'écran automatisée : `chrome --headless --screenshot` capture avant la fin du worker. Passer par le protocole DevTools (ouvrir la page, attendre ~25 s en temps réel sous SwiftShader, puis `Page.captureScreenshot`) ; `Input.dispatchMouseEvent` permet de simuler survol, clic, glisser et molette pour tester la construction.

---

## 11. Prochaines étapes envisagées

Rien n'est encore commencé. Ordre suggéré :

1. ~~Sélection sur le terrain~~ : fait, par marche le long du rayon sur la grille des hauteurs (`TerrainView.pick`), sans `three-mesh-bvh`.
1 bis. **Autres bâtiments** (caisses, restaurants, hôtels, garage de dameuses) dans `params/batiments.ts`, avec géométries propres ; suppression d'un bâtiment ; coût.
2. **Tracé de pistes** sur le terrain, difficulté calculée en direct à partir de la pente réelle ; les rivières sont des obstacles (passerelles), les lacs gelés des repères.
3. **Remontées mécaniques** (téléskis, télésièges, télécabines) entre deux points, avec contraintes de pente et de dénivelé.
4. **Damage** : texture « velours côtelé » sur les pistes tracées (demandé dans le brief visuel, volontairement laissé au gameplay).
5. **Skieurs** (agents) et files d'attente aux remontées.
6. **Économie**, effets de la **météo** sur le jeu (fermer les remontées exposées au vent, visibilité, fréquentation selon le temps), **neige de culture** (ressource en eau des rivières).
7. **Sauvegarde** : graine + actions du joueur dans IndexedDB (la carte se régénère à l'identique).

Demandes du porteur (23/09/2026) : altitudes réalistes, horloge, couleur du filtre topo, modes du temps dans l'interface, météo changeante, manteau neigeux, risque d'avalanche, probabilité de neige, avalanches animées : **faits**. Suites possibles :
- **Déclenchements provoqués** : skieurs, dameuses, et déclenchement préventif (PIDA) par le joueur ; le texte de référence du porteur cite la « surcharge soudaine » comme déclencheur. Le manteau n'a aujourd'hui que des déclenchements naturels.
- **Dégâts** : souffle de l'aérosol et masse de la neige humide sur les bâtiments et la forêt (pas d'effet de jeu pour l'instant).
- **Printemps et automne** : ils passent en mode Normal (enneigement intermédiaire), sans rendu propre (mélèzes dorés, herbe jaunie…).
- Prévenir le joueur d'une avalanche (message, recentrage) : pas fait, faute de demande (interface minimale). Les avalanches sont petites à l'échelle de la carte.

Idées notées mais non retenues pour l'instant : noms des massifs, panneau de statistiques, réglages de génération **dans l'interface** (les réglages existent dans `src/params/`, pour le développement).

---

## 12. Paramétrage (src/params/)

Demande du porteur : un fichier de paramétrage par thème du jeu. Règles :

- **Un fichier par thème**, données pures (lisibles par `gen/`, `jeu/`, `sim/`, `render/` et les tests). Un fichier de paramètres ne peut importer **que d'autres fichiers de paramètres** (ex. `affichage.ts` lit `ECHELLE`).
- Chaque valeur est **commentée** (unité, effet). Les noms de clés sont en français, sauf les constantes historiques (`SIZES`, `TYPES`, `CLASSES`, `UNIT`…).
- Modifier `monde.ts`, `terrain.ts` ou `amenagement.ts` change les cartes produites par une graine : relancer `npm test`. Les autres fichiers n'agissent que sur l'affichage ou la simulation.
- Thèmes à créer avec le gameplay : `pistes.ts` (classes, damage), `remontees.ts` (types, débits, pentes max, vent de fermeture), `skieurs.ts`, `economie.ts`.

| Fichier | Contenu principal |
|---|---|
| `monde.ts` | `SIZES` (côté, maille, rang), `DEFAULT_SIZE`, `ECHELLE` (UNIT, VEX, ALT0) |
| `terrain.ts` | `ALTITUDE` (point bas visé, plafond des sommets), `TYPES` de massifs, `RELIEF` (hausse par rang, tassement), `PICS.rugosite`, `EROSION`, `LACS`, `CLASSES` de pente + `classOf` |
| `neige.ts` | seuil de roche, barres rocheuses (début, nervures, plaques), décapage d'altitude, corniches, freeride |
| `climat.ts` | `CLIMAT` (température moyenne et amplitude annuelle à 1 500 m, moment le plus froid, écart jour-nuit, gradient 6,5 °C/km, froid des précipitations et des tempêtes, seuil de neige 1 °C, moments de l'année des saisons figées) ; `ENNEIGEMENT` (limite de la neige de saison au fil de l'année, écarts ubac / adret, épaisseur par mètre, plafond) ; `PROBA_NEIGE` (horizon 3 jours, fréquence des jours de précipitations, effets du relief, dispersion, plafond 99 %) |
| `avalanches.ts` | `MANTEAU` (chute, tassement, fonte, humidification, regel, transport par le vent, givre, couche fragile) ; `RISQUE` (pentes propices 27–60°, contributions, forêt, seuils des niveaux, couleurs) ; `DECLENCHEMENT` (seuil, taux, coulées meubles, avalanches simultanées, taille des départs, propagation, critères aérosol et humide) ; `ECOULEMENT` (μ, ξ, épaisseur et particules par type, frottement en forêt, accélération, arrêt, durées) |
| `meteo.ts` | `VENT` : épisodes calme / rafales / soutenu (poids, durées), rafales (intervalle, durée, rayon, force, nombre max), vent soutenu (intensité, variation), vitesse des particules ; `NUAGES` (hauteur, trouée au-dessus de la station) ; `CIEL` (poids et durées des états en hiver et en été, cibles de couverture / brouillard / précipitation, transition, vent de tempête, éclairs) ; `PRECIPITATIONS` (nombre de particules, vitesses de chute, dérive) |
| `temps.ts` | `TEMPS` : durées du jour (300 s) et de la nuit (300 s), mode `cycle` / `jour` / `nuit`, repères lever / coucher, phases de départ, figées et des modes ; `SAISONS` : ordre, durée (1 200 s), mode (`hiver` par défaut, ou `cycle`, ou une saison), saison de départ, `calendrier` (premier jour, heures de lever et de coucher par saison), `noms` affichés |
| `vegetation.ts` | limite de la forêt, écart ubac, irrégularité, pente max, lisière autour de la station, densité |
| `amenagement.ts` | `STATION` : rayon et nombre de sites comparés par taille, talus, pente dans le sens naturel, dévers, distance au bord |
| `batiments.ts` | `BATIMENTS` (nom, emprise et hauteurs en arbres, pente max), `CONSTRUCTION` (cases par arbre, marge d'abattage) |
| `affichage.ts` | `CAMERA` (zoom initial / min / max, molette), `OBJETS` (échelle, diamètre d'un arbre), `ARBRE_M`, `TOPO` (équidistance, courbes maîtresses, couleurs de jour et de nuit, intensités, intensité de nuit, épaisseurs, écart minimal, allègement en vue d'ensemble, fondu) ; `CALQUES` (opacités, couleurs de la probabilité de neige, intensité de nuit, fondu) |

### Le vent (sim/meteo.ts)

Le vent enchaîne des **épisodes** tirés au sort selon leurs poids : **calme** (aucun vent, 30 %), **rafales** (50 %) ou **soutenu** (20 %), chacun durant 20 à 90 s. En épisode de rafales, une rafale naît toutes les 0,5–2,5 s (4 au plus en même temps) : une zone de 1,2 à 3,5 km de rayon, placée au hasard, où le vent monte puis retombe en 1,5–4 s. Le vent soutenu souffle partout, monte et retombe en fondu (4 s) et varie lentement de ±20 %. `intensiteEn(x, z)` (mètres) donne l'intensité 0–1 en un point : c'est l'interface que les remontées mécaniques utiliseront. Direction fixe : **d'ouest**, cohérente avec les corniches générées. La météo est recréée (graine du domaine) à chaque nouvelle carte ; elle ne tourne pas si `prefers-reduced-motion`.

---

### L'horloge (sim/temps.ts)

`Horloge` avance avec la boucle (`update(dt)`) et fournit `phase` (0 = minuit, 0,5 ≈ midi : l'échelle de la palette de `render/dayCycle.ts`), `estJour`, `saison`, `avancementSaison`, `heure`, `date` et `joursEcoules`. Le jour couvre les phases `lever` → `coucher` (0,03 → 0,8) en `dureeJour` secondes, la nuit le reste en `dureeNuit` : la phase n'avance donc pas à vitesse constante. En mode `jour` ou `nuit`, la phase reste sur `phaseJour` / `phaseNuit`. Les saisons durent `SAISONS.duree` (20 min) ; en mode `hiver` (défaut, demande du porteur), la saison ne change pas. Les options du constructeur remplacent les paramètres (utilisé par les tests). Les modes se changent en cours de partie (`setModeJournee`, `setModeSaison`, menu « Temps ») ; `params/temps.ts` donne les valeurs par défaut. `fractionAnnee` (0 = 21 décembre) sert au climat : elle suit l'année en mode cycle, et vaut le milieu de la saison figée sinon (`CLIMAT.saisonFigee`).

**Heure et date** (`SAISONS.calendrier`) : chaque saison a un premier jour et des heures de lever et de coucher (hiver : 21 décembre, 7 h 45 → 17 h 15 ; printemps 20 mars, 6 h 45 → 19 h 15 ; été 21 juin, 5 h 45 → 21 h 30 ; automne 23 septembre, 7 h 30 → 19 h 30). L'heure affichée suit l'éclairage : le jour (5 min) couvre lever → coucher, la nuit (5 min) le reste ; les heures ne défilent donc pas à la même vitesse de jour et de nuit. **Saison figée** (défaut) : la partie commence le premier jour de la saison, la date avance d'un jour à chaque minuit du jeu, et revient au premier jour après le dernier (19 mars pour l'hiver). **Mode `cycle`** : une saison ne dure que 2 journées de jeu ; la date parcourt la saison par sauts, proportionnellement à son avancement. **Jour ou nuit figés** : l'heure et la date s'arrêtent ; seule la saison peut encore avancer. Avec `prefers-reduced-motion`, l'horloge part de `phaseFigee` et ne bouge pas.

### Climat (sim/climat.ts)

Température (°C) = moyenne de saison à 1 500 m (3,5 ± 9 °C, plus froid mi-janvier : −5,5 °C en hiver, +12,5 °C en été) + écart jour-nuit (± 4 °C, maximum à 15 h, réduit par les nuages) − froid des précipitations et des tempêtes − 6,5 °C par 1 000 m. Il neige sous 1 °C : la limite pluie-neige est sous le point bas des cartes en hiver, vers 3 000 m l'été. L'**enneigement de saison** (neige ancienne) suit une limite tabulée au fil de l'année (1 000 m en hiver, 3 100–3 250 m en été), 200 m plus bas en ubac, 150 m plus haut en adret ; au-dessus, 0,25 cm par mètre jusqu'à 3,5 m. C'est une fonction du climat, pas un cumul : avec des saisons de 20 min (2 journées de jeu), un cumul physique n'aurait pas le temps de fondre ni de s'accumuler.

### Ciel (sim/meteo.ts)

En plus du vent, un **état du ciel** tiré au sort : dégagé, nuageux, brouillard, précipitations, tempête ; poids et durées (heures de jeu) interpolés entre l'hiver et l'été selon la chaleur de la saison (tempêtes d'hiver de 6 à 14 h, orages d'été de 1 à 3 h, plus fréquents). Un état ne se répète pas. Couverture, brouillard et intensité des précipitations glissent vers les valeurs de l'état en ~0,6 h. En tempête, le vent souffle fort partout ; au-dessus de 5 °C à la station, c'est un **orage** avec éclairs (toutes les 1,5–7 s réelles).

### Manteau neigeux et avalanches (sim/manteau.ts, sim/avalanche.ts)

Choix de modèle (le porteur a fourni un texte de référence sur les types d'avalanches et leurs déclencheurs) : simulation **à l'échelle de la station**, une colonne de neige par sommet de grille, plutôt qu'une physique géotechnique fine.
- **Couches** : neige de saison (climat) + **neige fraîche** (chute ∝ intensité, plus abondante face au vent et en altitude ; pluie au-dessus de 1 °C, qui humidifie la neige) + **plaques à vent** (le vent reprend la neige fraîche des versants ouest et la redépose sur les versants est, à moitié sur les versants nord / sud) + **dépôts** d'avalanche. Tassement (la neige fraîche perd ~2,5 %/h, les plaques ~0,8 %/h, plus vite au chaud), fonte au-dessus de 0 °C, **humidité** (chaleur, pluie ; regel sous −2 °C), **givre de surface** par nuit claire sous −5 °C, qui devient une **couche fragile** persistante une fois enfoui sous la neige fraîche.
- **Instabilité** = facteur de pente (0 sous 27°, plein de 32 à 45°, puis décroissant : la neige purge d'elle-même) × (neige fraîche / 0,35 m + plaques / 0,25 m + 0,1) × (1 + 1,2 × couche fragile), ou instabilité humide si elle est plus forte ; × 0,3 en forêt. **Niveau** 0 sans neige ou sous 27°, puis 1 à 5 selon les seuils 0,35 / 0,7 / 1,1 / 1,6.
- **Déclenchements naturels** : au-delà d'une instabilité de 1,25, probabilité par sommet et par heure proportionnelle au dépassement ; coulées meubles sur les pentes > 40° chargées de plus de 15 cm de neige fraîche. 3 avalanches en mouvement au plus. Type : **neige humide** si l'humidité dépasse 0,5 ; **aérosol** si la neige est sèche, froide (< −4 °C), chargée (> 0,5 m) et la dénivelée sous le départ > 800 m ; sinon **plaque**. La fracture d'une plaque se propage de proche en proche (automate cellulaire) aux sommets voisins raides et instables (jusqu'à 12 sommets, 25 pour un aérosol) ; une coulée meuble part d'un seul point. La neige de la zone de départ est retirée, puis redéposée là où les particules s'arrêtent.
- **Écoulement** : particules soumises à la gravité dans la ligne de pente, à un frottement sec μ et à une turbulence ξ (**modèle de Voellmy**), plus un étalement latéral (en cône pour la neige meuble) ; arrêt quand la vitesse tombe sous 0,8 m/s et que la pente ne suffit plus. Vitesses limites sur 35° : meuble ~45 km/h, humide ~50 km/h, plaque ~110 km/h, aérosol ~220 km/h. Frottement accru en forêt et sur les lacs. Animation accélérée × 2.
- Pas encore d'effet sur le jeu (bâtiments, forêt) ni de déclenchement par le joueur : voir section 11.

---

## 13. Maintenance de ce document

Règle permanente (voir `CLAUDE.md`) : à chaque ajout, suppression ou modification du projet, mettre à jour ce fichier dans la même intervention, corriger ce qui est devenu faux et ajouter une ligne au journal ci-dessous.

---

## 14. Journal

- **22/09/2026** : tailles décalées d'un cran (nouveau Petit 12,7 km, Moyen par défaut = ancien Petit, ancien Immense supprimé), `rang` de taille ; zoom initial 1,4 et objets × 1,4 ; création de `src/params/` (8 thèmes) remplaçant `gen/config.ts` ; vent par épisodes (calme / rafales localisées / soutenu) dans `src/sim/meteo.ts`, neige soufflée pilotée par le vent ; barres rocheuses sur nervures convexes et faces des pics creusées (fin de l'effet « toits en neige ») ; tests étendus au Petit + `tests/meteo.test.ts` ; ajout de `CLAUDE.md` ; corrections : Vitest 5, absence de `deploy.yml` et de `.gitignore` signalée.
- **22/09/2026 (2)** : aire de station plate unique par carte, proportionnelle à la taille (700 / 950 / 1 250 / 1 600 m de rayon), sur la partie la plus basse (Petit) ou l'une des plus basses (autres), paramétrée dans `STATION` ; suppression du village, du clocher et des refuges (`Domain.village` / `refuges` → `Domain.station`, `render/settlements.ts` supprimé) ; construction de la **maisonnette** (3 × 2 arbres) : icône, aperçu fantôme + cases vertes / rouges, pose, rotation, confirmation, abattage des arbres (`jeu/construction.ts`, `render/batiments.ts`, `ui/construction.ts`, `params/batiments.ts`) ; lectures du sol mutualisées dans `gen/sol.ts` ; visée du terrain par `TerrainView.pick` ; trouée de la mer de nuages au-dessus de la station ; contraste des boutons actifs en thème sombre corrigé ; tests : aire de station (4 tailles) + `construction.test.ts` (44 tests).
- **22/09/2026 (3)** : ajout du `.gitignore`.
- **22/09/2026 (4)** : menu « Filtres » avec filtre topographique (courbes de niveau orange léger tous les 10 m, maîtresses tous les 100 m, touche T), paramètres `TOPO`.
- **23/09/2026** : altitudes réelles, point bas 1 300–2 000 m selon la carte, sommets ≤ 4 800 m (`ALTITUDE`, `relever()` en fin de pipeline) ; seuils du rendu relevés (forêt 2 250 m, corniches 2 800 m, freeride 2 600 m, décapage 3 300 m), `ALT0` 1 600, socle sous le point bas ; horloge `sim/temps.ts` (5 min de jour + 5 min de nuit, modes jour / nuit figés, saisons de 20 min, hiver figé) remplaçant l'avance de `DayCycle` ; courbes de niveau brun-ocre le jour, crème lumineux la nuit (`topoColor`, `topoLueur`) ; `tests/temps.test.ts` (53 tests) ; feuille de route météo / avalanches consignée en section 11.
- **23/09/2026 (2)** : horloge en haut à droite (heure, date, saison) : `ui/horloge.ts`, `SAISONS.calendrier` et `noms`, `Horloge.heure` / `date` / `joursEcoules` ; le temps s'arrête en mode jour ou nuit figé ; en animations réduites, l'horloge part de `phaseFigee` ; 5 tests de plus (58).
- **23/09/2026 (3)** : menu « Temps » sur l'horloge (journée Normal / Jour / Nuit, saisons Normal / Hiver / Été, `Horloge.setModeJournee` / `setModeSaison` / `fractionAnnee` / `heuresDe`) ; climat (`params/climat.ts`, `sim/climat.ts`) ; ciel changeant avec pluie / neige, orages et tempêtes de neige (`CIEL`, `PRECIPITATIONS`, `render/precipitations.ts`, éclairage et brume selon le ciel) ; manteau neigeux, risque 0–5 et avalanches naturelles animées de quatre types (`params/avalanches.ts`, `sim/manteau.ts`, `sim/avalanche.ts`, `sim/monde.ts`, `render/avalanches.ts`) ; rendu d'été (couleur sans neige par facette, lacs et torrents qui dégèlent, `render/neige.ts` pour chapeaux des pins, arbres englacés, corniches, traces, toits) ; calques « Risque d'avalanche » (A) et « Probabilité de neige » (N) avec légende ; horloge enrichie du temps et de la température ; `NEIGE.limitePluieNeige` supprimé ; tests `neige.test.ts` et ciel (80 tests).
