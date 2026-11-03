# bike-rental-legacy

> Premier jet, rédigé à partir d'une première lecture du code. Certaines descriptions de comportement sont des déductions et restent à confirmer.

API REST de **location de vélos en libre-service** (type Vélib') : on loue un vélo dans une station, on le rend dans une autre, et le trajet est facturé selon sa durée, le type de vélo et l'abonnement de l'utilisateur.

Le projet se présente comme une base « legacy » : tout tient dans quelques fichiers, les données sont en mémoire et les services externes (paiement, géolocalisation, anti-fraude) sont simulés. C'est un bon terrain pour un travail de qualité de code et de refactoring.

## Stack

- Node.js + TypeScript (mode `strict`)
- Express 4
- Jest + ts-jest + supertest pour les tests, Stryker pour les tests de mutation
- ts-node pour lancer sans compiler
- pnpm comme gestionnaire de paquets

## Démarrage

```bash
pnpm install
pnpm start        # lance l'API sur http://localhost:3000
pnpm test         # lance tous les tests (unitaires, intégration, E2E)
pnpm build        # compile vers dist/
pnpm load         # petit test de charge sur GET /stations
```

## Structure

```
src/
  index.ts         # app Express et déclaration des routes
  handlers.ts      # toute la logique métier des 4 routes
  types.ts         # types du domaine (Station, Bike, User, Rental) et statuts nommés
  businessRules.ts # règles métier nommées : tarif, crédit minimum, pré-autorisation, fraude, usure, zones
  db.ts            # "base de données" en mémoire (stations, vélos, utilisateurs, locations)
  payment.ts       # client de paiement simulé (pré-autorisation, capture, remboursement)
  utils.ts         # helpers : validation, log, arrondi, durée, tarif, géo/météo, score de fraude
scripts/
  load.ts       # envoie 20 requêtes GET /stations en parallèle et mesure la latence
tests/
  unit/         # tests unitaires (utils, payment, db, handlers)
  integration/  # tests d'intégration de l'API HTTP
  e2e/          # parcours utilisateur sur un vrai serveur
  support/      # outils partagés (horloge rapide, faux req/res, recherche par id, silence des logs)
```

## Tests

La stratégie suit la pyramide des tests : beaucoup de tests unitaires rapides, moins de tests d'intégration, très peu de tests E2E, et des tests de mutation pour mesurer la qualité des tests eux-mêmes.

| Niveau | Commande | Nombre | Ce qui est testé |
|---|---|---|---|
| Unitaire | `pnpm test:unit` | 135 | Chaque fonction isolément ; dans les handlers, le paiement (service externe) est mocké |
| Intégration | `pnpm test:integration` | 13 | L'application Express réelle avec tous ses modules, via supertest, sans mock |
| E2E | `pnpm test:e2e` | 2 | Un vrai serveur HTTP appelé avec `fetch`, horloge et délais réels |
| Mutation | `pnpm test:mutation` | | Stryker modifie le code source et vérifie que les tests unitaires et d'intégration détectent chaque modification |

Autres commandes : `pnpm test:coverage` (couverture des tests unitaires et d'intégration).

Résultats actuels : 100 % des lignes et des branches couvertes, **score de mutation de 96,4 %**. Stryker échoue sous 90 % (`stryker.config.json`). Le rapport HTML est généré dans `reports/mutation/index.html`.

Points à connaître :

- **Horloge rapide** (`tests/support/fastClock.ts`) : le code attend en boucle active sur `Date.now()`. Les tests unitaires et d'intégration remplacent `Date.now` par une horloge qui avance d'1 ms à chaque lecture : les délais simulés deviennent instantanés et les durées de location sont exactes (`clock.advanceMinutes(45)`).
- **Isolation** : chaque test recharge les modules (`jest.resetModules()`) et repart des données initiales. L'ordre d'exécution n'a plus d'importance.
- **Défauts connus** : un défaut trouvé mais pas encore corrigé est décrit par un test marqué `it.failing`, qui exprime le comportement attendu et échoue tant que le bug existe. Il faut retirer `.failing` une fois le bug corrigé. Aucun n'est ouvert aujourd'hui.
- **Mutants survivants** : ils sont équivalents (suppression des délais simulés, noms jamais lus, borne `<= 30` / `< 30` qui donne le même prix, garde `leastUsedBikeIndex >= 0` alors que `availableBikes[-1]` vaut déjà `undefined`) : aucun ne correspond à un comportement non vérifié.

## Données (en mémoire)

Les données sont réinitialisées à chaque redémarrage.

- **Stations** (4, à Paris) : République, Bastille, Montparnasse, Nation. Chaque station a une capacité (`capacity`), des coordonnées et la liste des vélos présents (`bikeIds`).
- **Vélos** (10) : station courante (`stationId`), statut (`status`), kilométrage (`kilometers`), électrique ou non (`isElectric`).
  Statuts (`BikeStatus`) : `Available` (0), `Rented` (1), `Maintenance` (2), `Broken` (3). Une location est `Open` (1) ou `Completed` (2) (`RentalStatus`).
- **Utilisateurs** (4) : crédit, abonnement (`basic` ou `premium`), drapeau liste noire (`isBlacklisted`).
  - alice : premium, 50 de crédit
  - bob : basic, 4 de crédit (pas assez pour louer)
  - carol : basic, 120 de crédit
  - dave : basic, sur liste noire
- **Locations** : vide au démarrage, alimentée par `POST /rent`.

## API

### `POST /rent` : louer un vélo

Corps : `{ "userId": 1, "stationId": 1, "bikeId": 2 }` (`bikeId` optionnel)

Déroulé :
1. Vérifie que l'utilisateur et la station existent (404 sinon).
2. Cherche les vélos disponibles de la station. Si `bikeId` est fourni, prend celui-là ; sinon prend **le vélo le moins kilométré**. Aucun vélo : 409.
3. Refuse si l'utilisateur a déjà une location en cours (409).
4. Refuse si le crédit est inférieur à 5 (402).
5. Calcule un score de fraude ; refuse à partir de 100, ce qui arrive en pratique pour un utilisateur sur liste noire (403).
6. Pré-autorise **5** (ou **7,50** pour un vélo électrique) auprès du service de paiement. Si la pré-autorisation est refusée (par exemple crédit inférieur à 7,50 pour un vélo électrique), journalise le refus et répond `402 { "msg": "payment declined" }` sans rien modifier.
7. Crée la location, passe le vélo en « loué » et le retire de la station.

Réponse : `{ msg, rentalId, bikeId, station, preAuth, ref }`

### `POST /return` : rendre un vélo

Corps : `{ "rentalId": 1, "stationId": 2 }`

Déroulé :
1. Vérifie que la location existe et n'est pas déjà terminée, et que la station existe.
2. Refuse si la station d'arrivée est pleine (409).
3. Calcule la durée en minutes et le prix (voir tarification), puis débite l'utilisateur (capture).
4. Clôture la location, remet le vélo « disponible » dans la station d'arrivée et ajoute `minutes / 4` km au compteur.
5. Si la station dépasse 1,5 fois le remplissage moyen, logue un déclenchement de « rééquilibrage » (aucune action réelle).

Réponse : `{ msg, rentalId, minutes, price, station, captured }`

### `GET /stations` : état des stations

Pour chaque station : zone (`north`/`south`), « météo » (`clear`/`rain`), nombre de vélos libres et électriques libres, places restantes, et la liste des vélos disponibles ou cassés triés par kilométrage.

### `GET /rentals/:id` : détail d'une location

Renvoie la durée (en cours ou finale), le prix calculé, une estimation (`estimate`) issue d'un second calcul de prix, et si la location est encore ouverte.

## Tarification (telle que codée)

| Règle | Montant |
|---|---|
| 30 premières minutes | 1 |
| Au-delà de 30 min | + 0,15 par minute |
| Vélo électrique | + 2,50 |
| Location de plus de 24 h | + 25 de pénalité |
| Abonnement premium | − 20 % sur le total |

Le prix est arrondi au centime.

## Services simulés

- **Paiement** (`payment.ts`) : `preAuth`, `capture`, `refund`. Chaque appel attend environ 1 s (attente active) et renvoie une référence aléatoire. Aucun appel réseau réel.
- **Géo/météo** (`utils.geo`) : la zone et la « météo » sont déduites de seuils fixes sur la latitude et la longitude.
- **Anti-fraude** (`utils.fraud`) : score additif (montant > 40, abonnement non premium, liste noire).

## Premières observations (pistes d'amélioration)

Ce que montre une première lecture, à approfondir :

- **Event loop bloquée** : `sleep()` est une boucle d'attente active. Chaque appel « externe » bloque tout le serveur, donc les requêtes concurrentes sont traitées une par une. C'est précisément ce que `pnpm load` met en évidence (`GET /stations` coûte environ 1,2 s à lui seul).
- **Erreurs de capture avalées** : un `catch` vide ; le vélo est rendu même si le paiement échoue, et le crédit peut devenir négatif puisque rien ne compare le prix final au montant pré-autorisé.
- **Handlers monolithiques** : `if/else` imbriqués sur une dizaine de niveaux, recherches linéaires répétées, aucune séparation entre accès aux données, règles métier et HTTP.
- **Divers** : port 3000 codé en dur, tri exécuté dans la boucle de `handleStations`, logs `console.log` non structurés.
