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
  domain/            # modèle et règles métier, sans aucune dépendance extérieure
    bike.ts, rental.ts, user.ts, station.ts   # entités immuables qui protègent leurs invariants
    pricing.ts, fraud.ts, bikeSelection.ts, fleet.ts, money.ts   # règles : tarif, fraude, choix du vélo, usure, rééquilibrage
    businessRules.ts # valeurs métier nommées (tarif, crédit minimum, pré-autorisation, fraude, usure, zones)
    errors.ts        # DomainRuleViolation, InconsistentDataError
  application/       # cas d'utilisation et ports (interfaces vers l'extérieur)
    useCases/        # RentBike, ReturnBike, GetRental, ListStations
    ports/           # repositories, paiement, localisation, anti-fraude, notifications, logger, horloge
    result.ts        # résultat d'un cas d'utilisation et raisons de refus
  infrastructure/    # implémentations des ports
    inMemory/        # données initiales et repositories en mémoire
    simulated/       # services externes simulés (paiement, géolocalisation, anti-fraude, notifications)
    consoleLogger.ts, systemClock.ts
  presentation/http/ # contrat HTTP actuel : validation, mise en forme, traduction des refus, routes
  compositionRoot.ts # seul endroit qui crée et relie les dépendances (createApplication)
  index.ts           # démarrage du serveur
scripts/
  load.ts       # envoie 20 requêtes GET /stations en parallèle et mesure la latence
tests/
  unit/         # tests unitaires, un dossier par couche (domain, application, infrastructure, presentation)
  integration/  # tests d'intégration de l'API HTTP
  e2e/          # parcours utilisateur sur un vrai serveur
  support/      # outils partagés (horloge rapide, doublures des ports, recherche par id, silence des logs)
```

## Tests

La stratégie suit la pyramide des tests : beaucoup de tests unitaires rapides, moins de tests d'intégration, très peu de tests E2E, et des tests de mutation pour mesurer la qualité des tests eux-mêmes.

| Niveau | Commande | Nombre | Ce qui est testé |
|---|---|---|---|
| Unitaire | `pnpm test:unit` | 302 | Chaque couche isolément : le domaine sans aucune doublure, les cas d'utilisation avec les vrais repositories et des doublures pour les services externes, la couche HTTP avec des cas d'utilisation doublés |
| Intégration | `pnpm test:integration` | 13 | L'application réelle assemblée par `createApplication()`, via supertest, sans mock |
| E2E | `pnpm test:e2e` | 2 | Un vrai serveur HTTP appelé avec `fetch`, horloge et délais réels |
| Mutation | `pnpm test:mutation` | | Stryker modifie le code source et vérifie que les tests unitaires et d'intégration détectent chaque modification |

Autres commandes : `pnpm test:coverage` (couverture des tests unitaires et d'intégration).

Résultats actuels : 100 % des lignes et des branches couvertes, **score de mutation de 99,5 %**. Stryker échoue sous 90 % (`stryker.config.json`). Le rapport HTML est généré dans `reports/mutation/index.html`.

Points à connaître :

- **Horloge rapide** (`tests/support/fastClock.ts`) : le code attend en boucle active sur `Date.now()`. Les tests unitaires et d'intégration remplacent `Date.now` par une horloge qui avance d'1 ms à chaque lecture : les délais simulés deviennent instantanés et les durées de location sont exactes (`clock.advanceMinutes(45)`).
- **Isolation** : chaque test crée sa propre application (`createApplication()`) ou ses propres repositories, avec une copie neuve des données initiales et une numérotation des locations qui repart de 1. L'ordre d'exécution n'a pas d'importance.
- **Défauts connus** : un défaut trouvé mais pas encore corrigé est décrit par un test marqué `it.failing`, qui exprime le comportement attendu et échoue tant que le bug existe. Il faut retirer `.failing` une fois le bug corrigé. Aucun n'est ouvert aujourd'hui.
- **Mutants survivants** : les 3 restants sont équivalents (borne `> 30` / `>= 30` qui donne le même prix à 30 minutes, `<` / `<=` dans l'attente active, référence de paiement aléatoire) : aucun ne correspond à un comportement non vérifié.

## Données (en mémoire)

Les données sont réinitialisées à chaque redémarrage.

- **Stations** (4, à Paris) : République, Bastille, Montparnasse, Nation. Chaque station a une capacité (`capacity`) et des coordonnées ; ses vélos présents et ses places libres se déduisent de la station de chaque vélo.
- **Vélos** (10) : station courante (`stationId`, `null` pendant une location : c'est la seule donnée d'emplacement), statut (`status`), kilométrage (`kilometers`), électrique ou non (`isElectric`).
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

- **Paiement** (`infrastructure/simulated/simulatedPaymentGateway.ts`) : pré-autorisation et capture. Chaque appel attend environ 1 s (attente active) et renvoie une référence aléatoire. Aucun appel réseau réel. Le crédit est débité par le retour, seulement si la capture réussit.
- **Géo/météo** (`infrastructure/simulated/simulatedLocationService.ts`) : la zone et la « météo » sont déduites de seuils fixes sur la latitude et la longitude.
- **Anti-fraude** (`infrastructure/simulated/simulatedFraudScreening.ts`) : applique la règle du domaine (`domain/fraud.ts`), un score additif (montant > 40, abonnement non premium, liste noire).

## Premières observations (pistes d'amélioration)

Ce que montrait la première lecture du code, et où en est chaque point :

- **Event loop bloquée** (ouvert, étape 2d) : `busyWait()` (`src/infrastructure/simulated/busyWait.ts`, ex-`sleep()`) est une boucle d'attente active. Chaque appel « externe » bloque tout le serveur, donc les requêtes concurrentes sont traitées une par une. C'est précisément ce que `pnpm load` met en évidence (`GET /stations` coûte environ 1,2 s à lui seul).
- **Erreurs de capture avalées** : le `catch` vide a disparu à l'étape 2c (le paiement renvoie un résultat au lieu de lever une exception) ; le vélo est toujours rendu si la capture échoue, et cet échec n'est pas encore journalisé (étape 2e). Ouvert : le crédit peut devenir négatif, puisque rien ne compare le prix final au montant pré-autorisé (point ouvert de `docs/plan-refactoring.md`).
- ~~**Handlers monolithiques**~~ (réglé à l'étape 2c) : les `if/else` imbriqués sur une dizaine de niveaux sont remplacés par des couches séparées (domaine, cas d'utilisation, infrastructure, présentation HTTP) ; plus aucune fonction ne dépasse 30 lignes.
- **Divers** : port 3000 codé en dur et logs `console.log` non structurés (ouverts, étape 2e) ; le tri exécuté dans la boucle de la liste des stations est réglé à l'étape 2c (un seul tri par station).
