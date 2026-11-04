---

description: "Tâches du découpage en couches hexagonales (étape 2c)"
---

# Tasks: Découpage en couches hexagonales (étape 2c)

**Input**: Design documents from `specs/001-couche-hexagonales/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: toujours demandés (constitution, principe II). Dans chaque story, les tests unitaires sont
écrits **avant** le code et MUST échouer d'abord (module absent ou comportement manquant). Les tests
d'intégration (`tests/integration/rental-api.test.ts`) et E2E (`tests/e2e/rental-journey.test.ts`)
sont des **tests de caractérisation** du contrat : ils passent avant et après chaque story, et leur
passage inchangé est le critère d'acceptation (FR-001, FR-018). Ils ne doivent donc pas échouer.

**Organization**: une phase par user story ; chaque story est livrée dans **un** commit `refactor:`
(FR-004). Aucune tâche ne change le comportement observable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 à US4)
- Les chemins sont relatifs à la racine du dépôt.

---

## Phase 1: Setup (mesures de référence)

**Purpose**: figer le comportement et les métriques de départ avant tout changement.

- [X] T001 Ouvrir une demande de fusion de `001-couches-hexagonales` vers `main` de `Clement-Garro/codeQualityExample` (le dépôt `origin`, pas `upstream`), titre `docs: constitution v2.0.0 and step 2c specification` (3 commits `docs:` et corrections de l'analyse, aucun code), la faire relire et l'intégrer avant toute autre tâche
- [X] T002 Créer la branche `2c-p1-domain` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2c-p1-domain`)
- [X] T003 Lancer `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:mutation` et `pnpm load` sur l'arbre actuel, et noter dans `specs/001-couche-hexagonales/baseline.md` : nombre de tests (total, unitaires, intégration, E2E), couverture des lignes et des branches, score de mutation, latence moyenne et maximale de `pnpm load` (médiane de 3 exécutions), identifiant du commit de départ
- [X] T004 Lancer `pnpm jest --verbose tests/unit` et recopier la liste complète des noms de tests unitaires (fichier, `describe`, `it`) dans `specs/001-couche-hexagonales/test-inventory.md`, avec une colonne « repris dans » vide : elle sera remplie à chaque déplacement de test (aucun cas ne doit disparaître)
- [X] T005 Commiter `specs/001-couche-hexagonales/baseline.md` et `specs/001-couche-hexagonales/test-inventory.md` sur `2c-p1-domain` (`docs: record baseline and test inventory for step 2c`), séparément de tout code

---

## Phase 2: Foundational

**Purpose**: aucune tâche bloquante en plus : le domaine (US1) est lui-même le socle des stories
suivantes. Les stories sont **séquentielles** (stratégie « étrangleur », R10).

**Checkpoint**: la documentation 2c est intégrée à `main` ; la branche `2c-p1-domain` existe ; `baseline.md` et
`test-inventory.md` sont commités ; toutes les portes de départ sont vertes.

---

## Phase 3: User Story 1 - Domaine isolé et testé seul (Priority: P1) 🎯 MVP

**Goal**: toutes les règles métier vivent dans `src/domain/`, sans dépendance HTTP, stockage,
service simulé ni framework ; les entités sont immuables et protègent leurs invariants ;
`src/handlers.ts` délègue ses décisions au domaine.

**Independent Test**: `pnpm jest tests/unit/domain` passe en n'important que `src/domain/` ; les tests
d'intégration et E2E passent sans aucune modification (`git diff` vide sur `tests/integration` et
`tests/e2e`).

### Tests for User Story 1 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent (modules absents) avant l'implémentation.

- [X] T006 [US1] Exécuter `pnpm jest tests/integration tests/e2e` avant tout changement et vérifier qu'ils passent : ils servent de filet de caractérisation du contrat pendant toute la story (aucune modification de ces deux dossiers dans cette story)
- [X] T007 [P] [US1] Écrire `tests/unit/domain/money.test.ts` : `roundToCents` (`round(montant × 100) / 100`), en reprenant les cas de `roundToCents` de `tests/unit/utils.test.ts`
- [X] T008 [P] [US1] Écrire `tests/unit/domain/pricing.test.ts` : `computeDurationMinutes` (`floor((fin − début) / 60 000)`), `computeRentalPrice` (1 ; + 0,15/min au-delà de 30 ; + 2,50 électrique ; + 25 au-delà de 24 h ; × 0,8 premium ; arrondi au centime ; bornes 30/31 min et 1440/1441 min) et `computePreAuthorizationAmount` (5, ou 7,50 pour un électrique), en reprenant les cas de prix de `tests/unit/utils.test.ts` et de `describe('pricing')` de `tests/unit/handlers.test.ts`
- [X] T009 [P] [US1] Écrire `tests/unit/domain/fraud.test.ts` : `computeFraudScore` (+ 30 si montant > 40, borne 40 exclue ; + 10 si non premium ; + 100 si liste noire) et `isFraudSuspected` (`score >= 100` : 99 accepté, 100 refusé), en reprenant les cas de `computeFraudScore` de `tests/unit/utils.test.ts`
- [X] T010 [P] [US1] Écrire `tests/unit/domain/bikeSelection.test.ts` : `selectBike` renvoie le vélo demandé s'il est parmi les disponibles, aucun sinon ; sans vélo demandé (`null`), le moins kilométré, et le premier dans l'ordre des données en cas d'égalité ; aucun vélo si la liste est vide (cas repris de `describe('bike selection')` de `tests/unit/handlers.test.ts`)
- [X] T011 [P] [US1] Écrire `tests/unit/domain/fleet.test.ts` : `computeRiddenKilometers` (`floor(minutes / 4)`) et `isRebalancingNeeded` (`présents > (total / stations) × 1,5`, strict : exactement au seuil → faux)
- [X] T012 [P] [US1] Écrire `tests/unit/domain/bike.test.ts` : `Bike.restore` refuse un vélo qui viole « `stationId` `null` si et seulement si `status = Rented` » ou des `kilometers` négatifs ; `checkOut()` passe `Available` → `Rented` avec `stationId = null` et refuse tout autre statut ; `dockAt(stationId, distanceKm)` passe `Rented` → `Available`, ajoute la distance, refuse tout autre statut et une distance négative ; chaque transition renvoie une nouvelle instance et laisse l'original inchangé ; une transition refusée lève `DomainRuleViolation`
- [X] T013 [P] [US1] Écrire `tests/unit/domain/rental.test.ts` : `Rental.open` crée une location `Open` avec `endTime`, `endStationId` et `price` à `null` ; `complete({ endTime, endStationId, price })` la passe `Completed` et renseigne les trois champs ; une seconde `complete` lève `DomainRuleViolation` sans rien changer ; `isOpen()` ; `durationMinutesAt(now)` mesure jusqu'à `now` si ouverte, jusqu'à `endTime` sinon
- [X] T014 [P] [US1] Écrire `tests/unit/domain/user.test.ts` : `hasMinimumCreditToRent()` (`credit >= 5` : 4,99 refusé, 5 accepté) ; `debit(amount)` renvoie un nouvel utilisateur au crédit diminué, accepte un crédit qui devient négatif (comportement actuel) et refuse un montant négatif
- [X] T015 [P] [US1] Écrire `tests/unit/domain/station.test.ts` : `hasFreeSlot(dockedBikeCount)` est faux quand `dockedBikeCount >= capacity`, vrai sinon
- [X] T016 [US1] Lancer `pnpm jest tests/unit/domain` et vérifier que tous les tests de T007 à T015 échouent (modules introuvables)

### Implementation for User Story 1

- [X] T017 [P] [US1] Déplacer `src/businessRules.ts` vers `src/domain/businessRules.ts` avec `git mv`, contenu inchangé
- [X] T018 [P] [US1] Créer `src/domain/errors.ts` : `DomainRuleViolation` et `InconsistentDataError` (message actuel `inconsistent data: <description> not found`)
- [X] T019 [P] [US1] Créer `src/domain/money.ts` (`roundToCents`)
- [X] T020 [US1] Créer `src/domain/pricing.ts` (`computeDurationMinutes`, `computeRentalPrice`, `computePreAuthorizationAmount`) à partir des constantes de `src/domain/businessRules.ts` (dépend de T017, T019)
- [X] T021 [P] [US1] Créer `src/domain/fraud.ts` (`computeFraudScore`, `isFraudSuspected`), **sans** l'attente de 200 ms (elle ira dans l'adaptateur simulé en US2, R6)
- [X] T022 [P] [US1] Créer `src/domain/bikeSelection.ts` (`selectBike`)
- [X] T023 [P] [US1] Créer `src/domain/fleet.ts` (`computeRiddenKilometers`, `isRebalancingNeeded`)
- [X] T024 [P] [US1] Créer `src/domain/bike.ts` : enum `BikeStatus` (`Available = 0`, `Rented = 1`, `Maintenance = 2`, `Broken = 3`, déplacé de `src/types.ts`) et classe `Bike` à champs `readonly`, constructeur privé, `create` / `restore`, `checkOut()`, `dockAt()` (R1)
- [X] T025 [P] [US1] Créer `src/domain/user.ts` : objet `Subscription` (`'basic'`, `'premium'`, `as const`, déplacé de `src/types.ts`) et classe `User` immuable (`hasMinimumCreditToRent`, `debit`)
- [X] T026 [P] [US1] Créer `src/domain/rental.ts` : enum `RentalStatus` (`Open = 1`, `Completed = 2`, déplacé de `src/types.ts`) et classe `Rental` immuable (`open`, `complete`, `isOpen`, `durationMinutesAt`)
- [X] T027 [P] [US1] Créer `src/domain/station.ts` : classe `Station` immuable (`id`, `name`, `capacity`, `latitude`, `longitude`, `hasFreeSlot`), **sans** `bikeIds`
- [X] T028 [US1] Lancer `pnpm jest tests/unit/domain` : tout vert ; vérifier qu'aucun fichier de `src/domain/` n'importe hors de `src/domain/` (`grep -rnE "from '(\.\./)+(application|infrastructure|presentation)|from 'express'" src/domain` sans résultat) et que les tests du domaine n'importent que `src/domain/` (`grep -rn "from '../../../src/" tests/unit/domain | grep -v "src/domain"` sans résultat, SC-004)
- [X] T029 [US1] Dans `src/handlers.ts`, remplacer les calculs locaux par les politiques du domaine (`selectBike`, `computePreAuthorizationAmount`, `isFraudSuspected`, `computeRentalPrice`, `computeDurationMinutes`, `computeRiddenKilometers`, `isRebalancingNeeded`, `roundToCents`) et `requireExisting` par `InconsistentDataError`, sans changer l'ordre des vérifications ni les réponses ; l'attente de 200 ms de l'anti-fraude reste appelée au même endroit (`sleep(200)` avant le calcul du score)
- [X] T030 [US1] Dans `src/handlers.ts`, faire passer les changements d'état par les entités (`checkOut`, `dockAt`, `complete`) via des fonctions de conversion **temporaires** enregistrement ↔ entité, marquées `// TEMPORARY (2c, P1): removed in P2` (un vélo loué est converti avec `stationId = null`, l'enregistrement garde son `stationId` jusqu'en P2), puis réécrire les champs dans les enregistrements de `src/db.ts`
- [X] T031 [US1] Mettre à jour les imports de `src/db.ts`, `src/payment.ts`, `src/utils.ts` et `src/handlers.ts` vers `src/domain/` ; supprimer `src/types.ts` ; garder les interfaces d'enregistrement dans `src/db.ts` jusqu'en P2 en les renommant `StationRecord` (avec `bikeIds`), `BikeRecord`, `UserRecord` et `RentalRecord` pour éviter toute collision avec les classes du domaine du même nom
- [X] T032 [US1] Retirer de `src/utils.ts` les fonctions déplacées dans le domaine (`roundToCents`, `computeFraudScore`, `computeDurationMinutes`, `computeRentalPrice`) ; `getLocationInfo` importe ses seuils depuis `src/domain/businessRules.ts`
- [X] T033 [US1] Retirer de `tests/unit/utils.test.ts` les cas repris dans `tests/unit/domain/` et mettre à jour les imports de types dans `tests/unit/*.test.ts` et `tests/support/*.ts` (seulement les chemins d'import, aucune assertion changée) ; remplir la colonne « repris dans » de `specs/001-couche-hexagonales/test-inventory.md`
- [X] T034 [US1] Vérifier `git diff --stat HEAD -- tests/integration tests/e2e` (vide), puis passer les portes du commit : `pnpm build`, `pnpm test`, `pnpm test:coverage` (≥ `baseline.md`), `pnpm test:mutation` (≥ 90 %), `pnpm load` (médiane de 3 exécutions ≤ référence + 10 %), seuils du principe III à la main sur les fichiers ajoutés ou modifiés
- [X] T035 [US1] Relecture humaine du diff avant le commit (code et tests générés par une IA, constitution « Workflow » point 5) : répondre aux 5 questions de la diapo 142 (besoin fonctionnel, exigences non fonctionnelles, clean code, tests, architecture) et vérifier qu'aucune règle métier n'est restée dans `src/handlers.ts` hors des appels au domaine, corriger les remarques puis relancer les portes si le code a changé
- [X] T036 [US1] Commiter `refactor: isolate the domain model and business policies` (message indiquant « structure, aucun changement de comportement »)
- [X] T037 [US1] Pousser la branche (`git push -u origin 2c-p1-domain`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample` (le dépôt `origin`, pas `upstream`), titre `refactor: isolate the domain model and business policies`, en indiquant dans la description « structure, aucun changement de comportement » et les résultats des portes (interface web de GitHub, ou `gh pr create --repo Clement-Garro/codeQualityExample --base main` si GitHub CLI est installé)
- [X] T038 [US1] Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main` ; ne pas commencer US2 avant cette intégration

**Checkpoint**: domaine isolé et testé seul ; contrat inchangé ; commit P1 fait et intégré à `main` par sa demande de fusion.

---

## Phase 4: User Story 2 - Données et services externes derrière des interfaces (Priority: P2)

**Goal**: ports dans `src/application/ports/`, adaptateurs dans `src/infrastructure/`, une seule source
d'emplacement des vélos (`Bike.stationId`), gestionnaires construits par `createHandlers(deps)` et
premier point d'assemblage `createApplication()`.

**Independent Test**: chaque port peut être remplacé par un double dans les tests unitaires ; les
réponses de `GET /stations` sont identiques (tests d'intégration verts) ; `grep -rn "bikeIds" src tests`
ne renvoie rien.

- [X] T039 [US2] Créer la branche `2c-p2-ports` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2c-p2-ports`)

### Tests for User Story 2 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent avant l'implémentation.

- [X] T040 [P] [US2] Écrire `tests/unit/infrastructure/seedData.test.ts` : `createSeedData()` renvoie 4 stations, 10 vélos, 4 utilisateurs, aucune location ; une copie neuve à chaque appel ; identifiants uniques ; statuts connus ; aucune station au-delà de sa capacité (comptée par `stationId`) ; aucun vélo ne viole « `stationId` `null` si et seulement si `status = Rented` » (cas repris de `tests/unit/db.test.ts`)
- [X] T041 [P] [US2] Écrire `tests/unit/infrastructure/inMemoryRepositories.test.ts` : `findById`, `findAll` dans l'ordre des données, `save` remplace l'entité ; `BikeRepository.findDockedAt(stationId)` dans l'ordre des données, sans vélo loué ; `countDocked()` ; `RentalRepository.hasOpenRentalFor(userId)`, `findAll`, `nextId()` qui démarre à 1 et s'incrémente, indépendamment par instance (cas `rental ids` repris de `tests/unit/db.test.ts`)
- [X] T042 [P] [US2] Écrire `tests/unit/infrastructure/simulatedPaymentGateway.test.ts` : `preAuthorize` approuve un crédit égal au montant, refuse « insufficient funds » si crédit < montant **avant** « blacklisted », journalise `[INFO] preauth done "<ref>"`, transmet utilisateur et montant à l'appel simulé, ne modifie aucun crédit ; `capture` réussit pour un montant nul ou positif avec `[INFO] capture done "<ref>"`, renvoie `{ isCaptured: false }` pour un montant négatif, ne débite jamais (cas repris de `tests/unit/payment.test.ts`, sauf `refundPayment` supprimé, R4 ; noter ce retrait dans `test-inventory.md`)
- [X] T043 [P] [US2] Écrire `tests/unit/infrastructure/simulatedLocationService.test.ts` : `zone` `north` si latitude > 48,85 sinon `south`, `weather` `clear` si longitude > 2,36 sinon `rain` (bornes exclues), attente d'au moins 300 ms (cas repris de `getLocationInfo` dans `tests/unit/utils.test.ts`)
- [X] T044 [P] [US2] Écrire `tests/unit/infrastructure/simulatedFraudScreening.test.ts` : renvoie le score de la politique du domaine et attend au moins 200 ms
- [X] T045 [P] [US2] Écrire `tests/unit/infrastructure/simulatedFleetNotifier.test.ts` : `rentalCreated(1)` journalise `[INFO] rental created 1` après au moins 100 ms ; `rebalancingRequested(1)` journalise `[INFO] rebalancing triggered 1` après au moins 150 ms
- [X] T046 [P] [US2] Écrire `tests/unit/infrastructure/consoleLogger.test.ts` : `warn('broken bike at station', { bikeId: 6 })` écrit `[WARN] broken bike at station {"bikeId":6}` et `info` écrit `[INFO] …` (cas `log` repris de `tests/unit/utils.test.ts`)
- [X] T047 [P] [US2] Écrire `tests/unit/infrastructure/simulated.test.ts` : `busyWait` bloque au moins la durée demandée (cas `sleep` de `tests/unit/utils.test.ts`) et `simulateHttpCall` renvoie statut 200, URL, corps et référence `REF<nombre>` ; écrire `tests/unit/infrastructure/systemClock.test.ts` : `now()` renvoie `Date.now()`
- [X] T048 [P] [US2] Écrire `tests/unit/compositionRoot.test.ts` : deux `createApplication()` ne partagent rien (une location dans la première via supertest ; la seconde liste toujours l'état initial et attribue la location n° 1) (FR-013)
- [X] T049 [US2] Lancer `pnpm jest tests/unit/infrastructure tests/unit/compositionRoot.test.ts` et vérifier que tout échoue (modules introuvables)

### Implementation for User Story 2

- [X] T050 [P] [US2] Créer `src/application/ports/repositories.ts` : `StationRepository` (`findById`, `findAll`), `BikeRepository` (`findById`, `findDockedAt`, `countDocked`, `save`), `UserRepository` (`findById`, `save`), `RentalRepository` (`findById`, `findAll`, `hasOpenRentalFor`, `nextId`, `save`), en types du domaine
- [X] T051 [P] [US2] Créer `src/application/ports/paymentGateway.ts` (résultats `{ isApproved: true, reference } | { isApproved: false, reason }` et `{ isCaptured: true, reference } | { isCaptured: false }`), `src/application/ports/locationService.ts` (`describe(latitude, longitude)` → `{ zone: 'north' | 'south', weather: 'clear' | 'rain' }`) et `src/application/ports/fraudScreening.ts` (`scoreOf(user, amount)`)
- [X] T052 [P] [US2] Créer `src/application/ports/logger.ts` (`info`, `warn`), `src/application/ports/clock.ts` (`now()`) et `src/application/ports/fleetNotifier.ts` (`rentalCreated`, `rebalancingRequested`)
- [X] T053 [US2] Créer `src/infrastructure/inMemory/seedData.ts` : `createSeedData()` recopie les données de `src/db.ts` en entités du domaine, **sans** `bikeIds` (le `stationId` de chaque vélo est la donnée conservée), aucune location
- [X] T054 [US2] Créer `src/infrastructure/inMemory/inMemoryRepositories.ts` : `createInMemoryRepositories(seed)` (les 4 repositories, compteur de locations propre à l'instance)
- [X] T055 [P] [US2] Déplacer `sleep` vers `src/infrastructure/simulated/busyWait.ts` (renommé `busyWait`) et `simulateHttpCall` vers `src/infrastructure/simulated/simulateHttpCall.ts`, contenus inchangés
- [X] T056 [P] [US2] Créer `src/infrastructure/consoleLogger.ts` (format exact de l'ancien `log` : `'[' + level + '] ' + message + ' ' + JSON.stringify(context)`) et `src/infrastructure/systemClock.ts` (`Date.now()`)
- [X] T057 [US2] Créer `src/infrastructure/simulated/simulatedPaymentGateway.ts` : mêmes attentes (800 ms + appel simulé 200 ms), mêmes règles et même ordre que `src/payment.ts`, résultats discriminés, journalisation via `Logger` (dépend de T051, T055, T056)
- [X] T058 [P] [US2] Créer `src/infrastructure/simulated/simulatedLocationService.ts` (attente 300 ms, seuils de `src/domain/businessRules.ts`)
- [X] T059 [P] [US2] Créer `src/infrastructure/simulated/simulatedFraudScreening.ts` (attente 200 ms puis `computeFraudScore` du domaine)
- [X] T060 [P] [US2] Créer `src/infrastructure/simulated/simulatedFleetNotifier.ts` (100 ms puis `rental created`, 150 ms puis `rebalancing triggered`, via `Logger`)
- [X] T061 [US2] Transformer `src/handlers.ts` en `createHandlers(deps)` qui reçoit repositories et ports ; remplacer les tableaux de `src/db.ts` par les repositories, `station.bikeIds` par `findDockedAt` / `countDocked`, et supprimer les conversions temporaires de T030
- [X] T062 [US2] Dans `src/handlers.ts`, remplacer les appels à `preAuthorizePayment` / `capturePayment` et leurs `try/catch` par `PaymentGateway` ; après une capture réussie, débiter avec `user.debit(price)` puis `save` ; capture refusée → aucun débit, location clôturée, `captured: false` (R4)
- [X] T063 [US2] Dans `src/handlers.ts`, remplacer `log` par `Logger` (alerte « vélo cassé » et refus de paiement au même moment, mêmes contextes), `sleep(100)` + `rental created` et `sleep(150)` + `rebalancing triggered` par `FleetNotifier`, `sleep(200)` + score par `FraudScreening`, `getLocationInfo` par `LocationService`, et `Date.now()` par `Clock`
- [X] T064 [US2] Créer `src/compositionRoot.ts` : `createApplication(seed = createSeedData())` crée repositories, adaptateurs, `createHandlers`, l'application Express (routes actuelles) et renvoie `{ app, repositories }` ; réduire `src/index.ts` à `export const app = createApplication().app` et au démarrage sur le port 3000 (message inchangé)
- [X] T065 [P] [US2] Créer `tests/support/fakePaymentGateway.ts` : double configurable (approuve avec `REF-PREAUTH`, refuse avec une raison, capture réussie avec `REF-CAPTURE` ou refusée)
- [X] T066 [US2] Adapter la mise en place de `tests/unit/handlers.test.ts` : `createHandlers` avec les vrais repositories en mémoire, le vrai `ConsoleLogger` (les assertions sur `console.log` restent identiques) et `tests/support/fakePaymentGateway.ts` à la place de `jest.mock('../../src/payment')` ; accès aux données via les repositories ; aucune assertion changée
- [X] T067 [US2] Adapter **uniquement la mise en place** de `tests/integration/rental-api.test.ts` : `beforeEach` crée `createApplication()` (plus de `jest.resetModules()` ni de `require`) ; crédit de Carol fixé à 6 via `repositories.users.save(...)` ; `db.rentals` remplacé par `repositories.rentals.findAll()` ; `creditOf` lit `repositories.users` ; aucune requête ni aucun `expect` modifié par ailleurs ; `tests/e2e/rental-journey.test.ts` non touché
- [X] T068 [US2] Supprimer `src/db.ts`, `src/payment.ts`, ainsi que `sleep`, `simulateHttpCall`, `getLocationInfo` et `log` de `src/utils.ts` ; supprimer `tests/unit/db.test.ts`, `tests/unit/payment.test.ts` et les cas déplacés de `tests/unit/utils.test.ts` une fois leurs cas reportés dans `specs/001-couche-hexagonales/test-inventory.md`
- [X] T069 [US2] Vérifier : `grep -rn "bikeIds" src tests` sans résultat ; `git diff HEAD -- tests/e2e` vide ; `git diff HEAD -- tests/integration` limité à la mise en place (relecture ligne à ligne)
- [X] T070 [US2] Passer les portes du commit : `pnpm build`, `pnpm test`, `pnpm test:coverage` (≥ `baseline.md`), `pnpm test:mutation` (≥ 90 %), `pnpm load` (médiane de 3 exécutions ≤ référence + 10 %), seuils du principe III sur les fichiers ajoutés ou modifiés
- [X] T071 [US2] Relecture humaine du diff avant le commit (code et tests générés par une IA, constitution « Workflow » point 5) : répondre aux 5 questions de la diapo 142 (besoin fonctionnel, exigences non fonctionnelles, clean code, tests, architecture) et vérifier que chaque consommateur ne reçoit que les ports qu'il utilise (FR-010), corriger les remarques puis relancer les portes si le code a changé
- [X] T072 [US2] Commiter `refactor: put data access and external services behind ports`
- [ ] T073 [US2] Pousser la branche (`git push -u origin 2c-p2-ports`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample` (le dépôt `origin`, pas `upstream`), titre `refactor: put data access and external services behind ports`, en indiquant dans la description « structure, aucun changement de comportement » et les résultats des portes (interface web de GitHub, ou `gh pr create --repo Clement-Garro/codeQualityExample --base main` si GitHub CLI est installé)
- [ ] T074 [US2] Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main` ; ne pas commencer US3 avant cette intégration

**Checkpoint**: ports et adaptateurs en place, une seule source d'emplacement, assemblage injecté ; commit P2 fait et intégré à `main` par sa demande de fusion.

---

## Phase 5: User Story 3 - Cas d'utilisation avec dépendances injectées (Priority: P3)

**Goal**: quatre cas d'utilisation dans `src/application/useCases/`, construits par le point
d'assemblage, qui renvoient un résultat discriminé ; les gestionnaires ne font plus que les appeler.

**Independent Test**: chaque cas d'utilisation est testé sans HTTP, avec les vrais repositories en
mémoire et des doubles aux frontières ; tests d'intégration et E2E verts sans modification depuis P2.

- [ ] T075 [US3] Créer la branche `2c-p3-use-cases` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2c-p3-use-cases`)

### Tests for User Story 3 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent avant l'implémentation.

- [ ] T076 [P] [US3] Créer `tests/support/portDoubles.ts` : doubles de `LocationService` (zone et météo fixées), `FraudScreening` (score fixé), `FleetNotifier` et `Logger` (qui enregistrent les appels), `Clock` (instant contrôlé, `advanceMinutes`) ; données nommées `ALICE`, `BOB`, `CAROL`, `DAVE`, `REPUBLIQUE`, `BASTILLE`, `MONTPARNASSE`, `NATION`
- [ ] T077 [P] [US3] Écrire `tests/unit/application/rentBike.test.ts` : succès (Alice à République → vélo 4, `Republique`, 7,50, référence, location enregistrée, vélo loué hors station, `rentalCreated` notifié) ; chaque refus `UserNotFound`, `StationNotFound`, `NoBikeAvailable`, `AlreadyRenting`, `NotEnoughCredit`, `FraudSuspected`, `PaymentDeclined` dans cet ordre de vérification ; aucune donnée modifiée et aucun identifiant consommé sur refus ; `warn('broken bike at station', bikeId)` pour chaque vélo cassé après les vérifications utilisateur et station ; `warn('payment declined', { userId, amount, reason })` ; paiement non contacté en cas de fraude (cas repris de `describe('handleRentBike')` et `describe('handleRentBike when the payment pre-authorization is declined')` de `tests/unit/handlers.test.ts`)
- [ ] T078 [P] [US3] Écrire `tests/unit/application/returnBike.test.ts` : succès (minutes, prix, nom de station, capture, débit, vélo `Available` à la station d'arrivée, `+ floor(minutes / 4)` km, location `Completed`) ; refus `RentalNotFound`, `AlreadyReturned`, `StationNotFound`, `StationFull` dans cet ordre, sans modification ; capture refusée → location clôturée, aucun débit, capture signalée échouée ; rééquilibrage demandé au-delà du seuil strict seulement ; utilisateur ou vélo introuvable → `InconsistentDataError` sans clôture (cas repris de `describe('handleReturnBike')` et `describe('inconsistent data')`)
- [ ] T079 [P] [US3] Écrire `tests/unit/application/getRental.test.ts` : `RentalNotFound` ; location ouverte (durée jusqu'à maintenant, prix avec l'abonnement actuel, ouverte) ; location rendue (durée et prix figés) ; utilisateur introuvable → `InconsistentDataError` (cas repris de `describe('handleGetRental')` et `describe('handleGetRental estimate')`)
- [ ] T080 [P] [US3] Écrire `tests/unit/application/listStations.test.ts` : une vue par station dans l'ordre des données, zone et météo du `LocationService`, vélos disponibles et cassés triés par kilométrage (tri stable), compteurs libres et électriques libres, places libres comptant cassés et maintenance, vélo loué absent et sans place occupée (cas repris de `describe('handleListStations')`)
- [ ] T081 [US3] Lancer `pnpm jest tests/unit/application` et vérifier que tout échoue (modules introuvables)

### Implementation for User Story 3

- [ ] T082 [US3] Créer `src/application/result.ts` : type `Result<T, Refusal>` (`{ isSuccess: true, value } | { isSuccess: false, refusal }`) et enums `RentRefusal` (`UserNotFound`, `StationNotFound`, `NoBikeAvailable`, `AlreadyRenting`, `NotEnoughCredit`, `FraudSuspected`, `PaymentDeclined`), `ReturnRefusal` (`RentalNotFound`, `AlreadyReturned`, `StationNotFound`, `StationFull`), `RentalLookupRefusal` (`RentalNotFound`)
- [ ] T083 [US3] Créer `src/application/useCases/rentBike.ts` : classe `RentBike` (dépendances au constructeur), entrée `{ userId, stationId, requestedBikeId: number | null }`, ordre de vérification de T077, étapes en méthodes privées de 30 lignes au plus
- [ ] T084 [P] [US3] Créer `src/application/useCases/returnBike.ts` (classe `ReturnBike`, entrée `{ rentalId, stationId }`)
- [ ] T085 [P] [US3] Créer `src/application/useCases/getRental.ts` (classe `GetRental`)
- [ ] T086 [P] [US3] Créer `src/application/useCases/listStations.ts` (classe `ListStations`, renvoie des `StationOverview`)
- [ ] T087 [US3] Dans `src/compositionRoot.ts`, construire les 4 cas d'utilisation et les passer à `createHandlers`
- [ ] T088 [US3] Réduire chaque gestionnaire de `src/handlers.ts` à : valider l'entrée, appeler le cas d'utilisation, traduire le résultat en code et corps JSON actuels ; plus aucune règle métier ni accès aux repositories dans ce fichier
- [ ] T089 [US3] Retirer de `tests/unit/handlers.test.ts` les cas repris dans `tests/unit/application/` (garder la validation des entrées et la traduction des refus) et mettre à jour `specs/001-couche-hexagonales/test-inventory.md`
- [ ] T090 [US3] Vérifier `git diff HEAD -- tests/integration tests/e2e` (vide), puis passer les portes du commit : `pnpm build`, `pnpm test`, `pnpm test:coverage` (≥ `baseline.md`), `pnpm test:mutation` (≥ 90 %), `pnpm load` (médiane de 3 exécutions ≤ référence + 10 %), seuils du principe III
- [ ] T091 [US3] Relecture humaine du diff avant le commit (code et tests générés par une IA, constitution « Workflow » point 5) : répondre aux 5 questions de la diapo 142 (besoin fonctionnel, exigences non fonctionnelles, clean code, tests, architecture) et vérifier que chaque cas d'utilisation ne reçoit que les ports qu'il utilise (FR-010), corriger les remarques puis relancer les portes si le code a changé
- [ ] T092 [US3] Commiter `refactor: extract rental and station use cases`
- [ ] T093 [US3] Pousser la branche (`git push -u origin 2c-p3-use-cases`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample` (le dépôt `origin`, pas `upstream`), titre `refactor: extract rental and station use cases`, en indiquant dans la description « structure, aucun changement de comportement » et les résultats des portes (interface web de GitHub, ou `gh pr create --repo Clement-Garro/codeQualityExample --base main` si GitHub CLI est installé)
- [ ] T094 [US3] Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main` ; ne pas commencer US4 avant cette intégration

**Checkpoint**: cas d'utilisation injectés et testés seuls ; commit P3 fait et intégré à `main` par sa demande de fusion.

---

## Phase 6: User Story 4 - Couche HTTP réduite à la présentation (Priority: P4)

**Goal**: `src/presentation/http/` valide, appelle, met en forme et traduit les refus à un seul endroit ;
les anciens modules n'existent plus.

**Independent Test**: tests d'intégration et E2E verts sans modification depuis P2 ;
`grep -rnE "businessRules|Repository|seedData" src/presentation` sans résultat ; anciens fichiers absents.

- [ ] T095 [US4] Créer la branche `2c-p4-presentation` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2c-p4-presentation`)

### Tests for User Story 4 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent avant l'implémentation.

- [ ] T096 [P] [US4] Écrire `tests/unit/presentation/validation.test.ts` : `hasRequiredFields` refuse un champ absent, `null`, vide ou `NaN` et un corps absent, accepte tout objet si aucun champ n'est requis ; conversions : `"1"` → 1, `"abc"` → `NaN`, `bikeId` absent ou `null` → `null` (cas repris de `hasRequiredFields` dans `tests/unit/utils.test.ts` et de `describe('input validation')` de `tests/unit/handlers.test.ts`)
- [ ] T097 [P] [US4] Écrire `tests/unit/presentation/refusals.test.ts` : chaque refus donne exactement le code et le `msg` du [contrat](contracts/current-api.openapi.yaml) : `UserNotFound` 404 `no user`, `StationNotFound` 404 `no station`, `NoBikeAvailable` 409 `no bike available`, `AlreadyRenting` 409 `already renting`, `NotEnoughCredit` 402 `not enough credit`, `FraudSuspected` 403 `refused`, `PaymentDeclined` 402 `payment declined`, `RentalNotFound` 404 `no rental`, `AlreadyReturned` 409 `already returned`, `StationFull` 409 `station full`
- [ ] T098 [P] [US4] Écrire `tests/unit/presentation/responses.test.ts` : mise en forme exacte (clés et ordre) de `{ msg, rentalId, bikeId, station, preAuth, ref }`, `{ msg, rentalId, minutes, price, station, captured }`, `{ id, name, zone, weather, free, electric, slots, bikes: [{ id, el, km, broken? }] }` (`broken: true` seulement pour un vélo cassé) et `{ msg, id, bikeId, minutes, price, estimate, open }` (`estimate` égal à `price`)
- [ ] T099 [P] [US4] Écrire `tests/unit/presentation/createHttpApp.test.ts` : avec des cas d'utilisation doubles et supertest, chaque route appelle le bon cas avec l'entrée convertie, `400 { msg: 'bad request' }` sans appeler de cas d'utilisation pour une entrée invalide, `404 { msg: 'no rental' }` pour `/rentals/not-a-number`
- [ ] T100 [US4] Lancer `pnpm jest tests/unit/presentation` et vérifier que tout échoue (modules introuvables)

### Implementation for User Story 4

- [ ] T101 [P] [US4] Créer `src/presentation/http/validation.ts` (`hasRequiredFields` déplacé de `src/utils.ts`, conversions `Number()` et `bikeId` → `number | null`)
- [ ] T102 [P] [US4] Créer `src/presentation/http/refusals.ts` : **une seule** table refus → `{ status, msg }`
- [ ] T103 [P] [US4] Créer `src/presentation/http/responses.ts` (mise en forme JSON, `roundToCents` du domaine pour `preAuth`)
- [ ] T104 [US4] Créer `src/presentation/http/createHttpApp.ts` : `express.json()`, les 4 routes actuelles, appel des cas d'utilisation, sans gestionnaire d'erreurs personnalisé (JSON mal formé, route inconnue et données incohérentes gardent les réponses par défaut d'Express, R2)
- [ ] T105 [US4] Dans `src/compositionRoot.ts`, utiliser `createHttpApp(useCases)` à la place de `createHandlers` ; vérifier que `src/index.ts` ne contient que l'export de `app` et le démarrage
- [ ] T106 [US4] Supprimer `src/handlers.ts`, `src/utils.ts`, `tests/unit/handlers.test.ts`, `tests/unit/utils.test.ts` et `tests/support/fakeHttp.ts` s'il n'est plus utilisé, après avoir vérifié dans `specs/001-couche-hexagonales/test-inventory.md` que chaque cas a sa colonne « repris dans » remplie
- [ ] T107 [US4] Vérifier `git diff HEAD -- tests/integration tests/e2e` (vide) et les commandes de la section 3 de [quickstart.md](quickstart.md) (dépendances entre couches, anciens modules absents, `bikeIds` absent) ; vérifier FR-012 : aucun adaptateur créé hors du point d'assemblage (`grep -rnE "new (Simulated|ConsoleLogger|SystemClock)|createInMemoryRepositories\(|createSeedData\(" src` ne renvoie que `src/compositionRoot.ts` et les définitions) et aucune variable de module mutable (`grep -rnE "^(export )?let " src` sans résultat)

**Checkpoint**: présentation réduite ; plus aucun ancien module ; prêt pour les portes qualité finales.

---

## Phase 7: Portes qualité

**Purpose**: une tâche par porte de la constitution, sur l'état final, avant le commit P4.

- [ ] T108 Build : `pnpm build` compile sans erreur
- [ ] T109 Linter : `pnpm lint` n'existe pas encore (étape 2f, dérogation « Outillage » de Complexity Tracking) ; à la place, vérifier à la main sur `src/` et `tests/unit/` les seuils du principe III : fonctions ≤ 30 lignes, complexité ≤ 10, ≤ 3 paramètres, fichiers ≤ 1000 lignes, lignes ≤ 120 caractères (`grep -rnE '.{121,}' src tests` sans résultat), aucun `any` (seul celui de `tests/e2e/rental-journey.test.ts` reste, justifié dans Complexity Tracking), aucun `console.log` hors de `src/infrastructure/consoleLogger.ts` et `src/index.ts` (dérogation de Complexity Tracking)
- [ ] T110 Vérification des types : `pnpm exec tsc --noEmit` sans erreur (mode `strict`, sources, scripts et tests)
- [ ] T111 Suite de tests complète : `pnpm test` (unitaires, intégration, E2E) entièrement verte ; nombre de tests d'intégration (13) et E2E (2) identique à `baseline.md`
- [ ] T112 Couverture sans baisse : `pnpm test:coverage`, lignes et branches ≥ les valeurs de `baseline.md` (100 %)
- [ ] T113 Mutation : `pnpm test:mutation` ≥ 90 % ; noter le score et les mutants survivants (justifier chaque survivant équivalent)
- [ ] T114 Audit des dépendances (constitution, principe VIII) : `pnpm audit --prod` sans vulnérabilité haute ni critique ; noter le résultat dans la description de la demande de fusion P4 ; confirmer qu'aucune dépendance n'est ajoutée par 2c (plan, « Dépendances ajoutées ») ; une alerte sur `eslint` (rangé à tort dans `dependencies`, corrigé en 2f) est notée comme connue, pas corrigée ici
- [ ] T115 Quality gate de l'analyse statique : SonarQube n'est pas encore installé (étape 2g, dérogation « Outillage ») ; le noter dans la description de la demande de fusion P4 (T120), avec l'absence d'intégration continue (portes exécutées en local seulement, étape 2h, dérogation de Complexity Tracking) ; `baseline.md` n'est pas modifié dans le commit `refactor:`
- [ ] T116 Performance : `pnpm load` 3 fois, médianes de la latence moyenne et maximale ≤ référence de `baseline.md` + 10 %
- [ ] T117 Documentation à jour : section structure du `README.md` (nouvelles couches, plus de `handlers.ts`, `db.ts`, `payment.ts`, `utils.ts`), cases 2c cochées dans `docs/plan-refactoring.md` avec les résultats des portes, point ouvert « Isolation des tests » confirmé, mention des chemins dans `docs/demarche-qualite.md` si elle cite les anciens fichiers
- [ ] T118 Relecture humaine du diff avant le commit (code et tests générés par une IA, constitution « Workflow » point 5) : répondre aux 5 questions de la diapo 142 (besoin fonctionnel, exigences non fonctionnelles, clean code, tests, architecture) sur l'ensemble de P4 et des corrections des portes, corriger les remarques puis relancer les portes si le code a changé
- [ ] T119 Commiter `refactor: reduce the HTTP layer to presentation` (P4), puis vérifier avec `git show --stat HEAD` que ce commit ne touche ni `tests/integration` ni `tests/e2e`
- [ ] T120 Pousser la branche (`git push -u origin 2c-p4-presentation`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample` (le dépôt `origin`, pas `upstream`), titre `refactor: reduce the HTTP layer to presentation`, en indiquant dans la description « structure, aucun changement de comportement » et les résultats des portes (interface web de GitHub, ou `gh pr create --repo Clement-Garro/codeQualityExample --base main` si GitHub CLI est installé)
- [ ] T121 Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main` ; l'étape 2c est terminée quand cette demande est intégrée ; une fois intégrée, vérifier sur `main` l'ensemble de l'étape depuis le commit de départ noté dans `baseline.md` : `git diff <départ>..main -- tests/e2e` vide, et `git diff <départ>..main -- tests/integration` limité à la mise en place faite en P2 (T067)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune dépendance ; MUST être fait avant tout changement de code.
- **Foundational (Phase 2)** : vide.
- **US1 → US2 → US3 → US4** : strictement séquentielles. Chaque story s'appuie sur la précédente
  (US2 utilise les entités, US3 les ports, US4 les cas d'utilisation) et se termine par un commit vert
  proposé dans sa propre demande de fusion ; la story suivante ne commence qu'après l'intégration de
  cette demande à `main` (spec, FR-004).
- **Portes qualité (Phase 7)** : après US4 ; T119 contient le commit P4.

### Within Each User Story

- T006 / caractérisation d'abord, puis tests unitaires écrits et **vérifiés en échec** (T016, T049,
  T081, T100), puis implémentation, puis migration des anciens tests, puis portes et commit.
- Dans US2 : ports (T050 à T052) → adaptateurs (T053 à T060) → gestionnaires (T061 à T063, même
  fichier, séquentiels) → assemblage (T064) → tests existants (T066, T067) → suppressions (T068).
- Dans US3 : `result.ts` (T082) → cas d'utilisation (T083 à T086) → assemblage (T087) → gestionnaires (T088).

### Parallel Opportunities

- US1 : T007 à T015 (9 fichiers de tests) en parallèle ; T017 à T019 et T021 à T027 en parallèle.
- US2 : T040 à T048 en parallèle ; T050 à T052 en parallèle ; T055, T056, T058 à T060 en parallèle ; T065 en parallèle de T061 à T064.
- US3 : T076 à T080 en parallèle ; T084 à T086 en parallèle (après T082).
- US4 : T096 à T099 en parallèle ; T101 à T103 en parallèle.

---

## Parallel Example: User Story 1

```bash
# Tests du domaine, tous en parallèle (fichiers distincts) :
Task: "Écrire tests/unit/domain/pricing.test.ts"
Task: "Écrire tests/unit/domain/fraud.test.ts"
Task: "Écrire tests/unit/domain/bikeSelection.test.ts"
Task: "Écrire tests/unit/domain/bike.test.ts"
Task: "Écrire tests/unit/domain/rental.test.ts"

# Puis les modules du domaine, en parallèle :
Task: "Créer src/domain/fraud.ts"
Task: "Créer src/domain/bikeSelection.ts"
Task: "Créer src/domain/bike.ts"
Task: "Créer src/domain/rental.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 : demande de fusion documentaire intégrée à `main` (T001), branche `2c-p1-domain` (T002),
   mesures de référence et inventaire des tests commités (T003 à T005).
2. Phase 3 : US1 → domaine isolé, commit P1, demande de fusion intégrée (T037, T038).
3. **STOP and VALIDATE** : `pnpm jest tests/unit/domain` seul, tests d'intégration et E2E inchangés,
   toutes les portes vertes. Le projet est déjà meilleur (règles testables seules) même si la suite
   attend.

### Incremental Delivery

0. Demande de fusion documentaire (`001-couches-hexagonales`) → intégrée à `main`
1. US1 (P1) → commit `refactor: isolate the domain model and business policies` → demande de fusion `2c-p1-domain` → intégrée
2. US2 (P2) → commit `refactor: put data access and external services behind ports` → demande de fusion `2c-p2-ports` → intégrée
3. US3 (P3) → commit `refactor: extract rental and station use cases` → demande de fusion `2c-p3-use-cases` → intégrée
4. US4 (P4) + Portes qualité → commit `refactor: reduce the HTTP layer to presentation` → demande de fusion `2c-p4-presentation` → intégrée
5. `/speckit-converge` : dernière étape obligatoire du flux Spec Kit (constitution, principe I), pour vérifier qu'il ne reste aucun travail de la spec non réalisé

Chaque demande de fusion laisse `main` vert : on peut s'arrêter après n'importe laquelle.

---

## Notes

- Une tâche = une intention : aucune tâche ne modifie le comportement observable ; si un test de
  caractérisation (intégration, E2E) échoue, c'est une régression à corriger, pas un test à adapter.
- Seule exception prévue aux tests d'intégration : la mise en place en T067 (FR-018).
- `specs/001-couche-hexagonales/test-inventory.md` garantit qu'aucun cas de test existant ne disparaît.
- Le retrait de `refundPayment` (inutilisé) est la seule suppression de code mort ; il est noté dans
  l'inventaire (R4).
- L'alerte « vélo cassé » reste dans le cas « louer » (FR-016) ; son sort est un point ouvert du plan.
- SC-007 (étape 3 limitée à la présentation) n'a pas de tâche ici : il se vérifie lors de la revue du plan de l'étape 3.
- `/speckit-clarify` doit avoir été exécuté sur la spec avant `/speckit-implement` (constitution, principe I).
