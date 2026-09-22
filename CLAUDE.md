# Consignes pour Claude

Lis `CONTEXT.md` avant toute modification : il décrit l'objectif, l'architecture, les conventions et les décisions déjà prises avec le porteur du projet.

## Règle permanente : tenir CONTEXT.md à jour

À **chaque** ajout, suppression ou modification du projet (code, paramètres, tests, dépendances, outillage, décisions du porteur), mets à jour `CONTEXT.md` **dans la même intervention**, sans attendre qu'on le demande :

- reflète l'état réel du code (arborescence, modèle de données, valeurs de paramètres citées, tests, commandes) ;
- consigne les nouvelles décisions du porteur, avec leur raison quand elle est connue ;
- retire ou corrige ce qui est devenu faux plutôt que d'empiler des notes ;
- ajoute une ligne datée au journal des modifications (section « Journal ») ;
- si une modification ne change rien de ce que décrit CONTEXT.md, n'invente pas de contenu, mais ajoute tout de même la ligne de journal.

Tiens aussi `README.md` à jour quand l'arborescence ou les commandes changent.

## Rappels

- Langue : interface, commentaires et documentation en français.
- Les réglages de jeu se changent dans `src/params/` (un fichier par thème), pas en dur dans le code.
- Lance `npm test` et `npm run typecheck` après toute modification du générateur ou des paramètres.
