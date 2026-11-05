---

description: "Tâches de l'étape 2d : services externes asynchrones"
---

# Tasks: Services externes asynchrones (étape 2d)

**Input**: Design documents from `specs/002-async-services/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests** : toujours demandés (constitution, principe II). Dans chaque story, les nouveaux tests sont
écrits **avant** le code et MUST échouer d'abord. Les 13 tests d'intégration et les 2 tests E2E
d'origine sont des **tests de caractérisation** : ils passent avant et après chaque commit, avec les
mêmes requêtes et les mêmes attentes (FR-015). Seule la mise en place de l'intégration change au
commit 1, et les tests E2E restent inchangés.

**Organization** : les phases suivent l'**ordre de livraison** imposé par FR-017 (clarification Q1),
pas l'ordre des priorités :
- US4, le temps maîtrisé, au commit 1 ;
- US1 et US2 ensemble au commit 2 : l'attente non bloquante n'est jamais livrée sans les garanties de
  concurrence ;
- US3, les durées maximales, au commit 3.

Chaque commit a sa propre demande de fusion, intégrée à `main` avant la suivante.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 à US4)
- Les chemins sont relatifs à la racine du dépôt.

---

## Phase 1: Setup (documentation et mesures de référence)

**Purpose** : intégrer la documentation de l'étape, puis figer les mesures de départ.

- [ ] T001 Ouvrir une demande de fusion de `002-async-services` vers `main` de `Clement-Garro/codeQualityExample` (le dépôt `origin`, pas `upstream`), titre `docs: step 2d specification and plan` (spec, clarifications, plan, recherche, modèle, contrats, quickstart et ce fichier, aucun code), la faire relire et l'intégrer avant toute autre tâche
- [ ] T002 Créer la branche `2d-c1-test-clock` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2d-c1-test-clock`)
- [ ] T003 Mesurer l'état de départ et l'écrire dans `specs/002-async-services/baseline.md` :
  - identifiant du commit de départ ;
  - nombre de tests (`pnpm jest tests/unit`, `tests/integration`, `tests/e2e`) ;
  - couverture des lignes et des branches (`pnpm test:coverage`) ;
  - score de mutation (`pnpm test:mutation`) ;
  - durée de `pnpm jest tests/unit tests/integration` sur 3 exécutions (SC-005) ;
  - médianes des latences moyenne et maximale de `pnpm load` sur 3 exécutions (SC-001) ;
  - médiane, sur 3 mesures, de la durée d'un `GET /stations` seul avec `pnpm start` et `curl -s -o /dev/null -w '%{time_total}' localhost:3000/stations` (SC-008)
- [ ] T004 Enregistrer la liste des noms de tests (`pnpm jest --json --outputFile=<scratch>/tests-before.json`, sans `.stryker-tmp`) pour vérifier à chaque commit qu'aucun test ne disparaît sans remplaçant, puis commiter `specs/002-async-services/baseline.md` sur `2d-c1-test-clock` (`docs: record baseline for step 2d`)

---

## Phase 2: Foundational

**Purpose** : aucune tâche en plus. Le temps maîtrisé (US4) est lui-même le socle des stories suivantes,
qui sont strictement séquentielles (R8, R11).

**Checkpoint** : la documentation de 2d est intégrée à `main`, `2d-c1-test-clock` existe et
`baseline.md` est commité.

---

## Phase 3: User Story 4 - Les tests maîtrisent le temps sans l'attendre (Priority: P3) — commit 1

**Goal** : toute lecture de l'heure et toute attente simulée passent par l'horloge injectée (`Clock`).
Les tests utilisent une horloge de test injectée, et aucun ne remplace plus l'horloge globale (FR-013,
FR-014). Le comportement est inchangé : l'attente reste active à ce commit.

**Independent Test** :
- `tests/support/fastClock.ts` n'existe plus ;
- `grep -rn "spyOn(Date" tests` ne renvoie rien ;
- `grep -rn "Date.now()" src` ne renvoie que `src/infrastructure/systemClock.ts` ;
- toute la suite passe, avec les tests d'intégration et E2E inchangés hors mise en place.

### Tests for User Story 4 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent avant l'implémentation.

- [ ] T005 [US4] Exécuter `pnpm jest tests/integration tests/e2e` avant tout changement et vérifier qu'ils passent (filet de caractérisation pendant toute l'étape)
- [ ] T006 [P] [US4] Écrire `tests/unit/support/testClock.test.ts` :
  - `new TestClock().now()` démarre à `Date.UTC(2026, 0, 1, 8, 0, 0)` et avance de 1 ms à chaque lecture ;
  - `advanceMinutes(45)` ajoute exactement 45 × 60 000 ms ;
  - deux horloges de test sont indépendantes
- [ ] T007 [P] [US4] Réécrire `tests/unit/infrastructure/simulated.test.ts` avec une `TestClock` passée en paramètre, sans `useFastClock` :
  - `busyWait(clock, 500)` se termine quand l'horloge injectée a avancé d'au moins 500 ms ;
  - `simulateHttpCall(clock, url, body)` renvoie le même résultat qu'aujourd'hui et fait avancer l'horloge injectée d'au moins 200 ms
- [ ] T008 [P] [US4] Adapter `tests/unit/infrastructure/simulatedPaymentGateway.test.ts`, `simulatedLocationService.test.ts`, `simulatedFraudScreening.test.ts` et `simulatedFleetNotifier.test.ts` :
  - construire chaque adaptateur avec une `TestClock` (`new SimulatedPaymentGateway(logger, clock)`, `new SimulatedLocationService(clock)`, `new SimulatedFraudScreening(clock)`, `new SimulatedFleetNotifier(logger, clock)`) ;
  - mesurer la latence avec `clock.now()` au lieu de `Date.now()` ;
  - supprimer `useFastClock` ;
  - aucune autre attente ne change
- [ ] T009 [P] [US4] Réécrire `tests/unit/infrastructure/systemClock.test.ts` sans `jest.spyOn(Date, 'now')` : `new SystemClock().now()` est compris entre deux lectures de `Date.now()` faites juste avant et juste après
- [ ] T010 [P] [US4] Adapter `tests/unit/compositionRoot.test.ts` : `createApplication({ clock })` avec une `TestClock`, sans `useFastClock` ; ajouter un test : après une location, `clock.advanceMinutes(45)` donne `minutes: 45` dans `GET /rentals/1`, ce qui prouve que l'horloge injectée est utilisée
- [ ] T011 [US4] Lancer `pnpm jest tests/unit/support tests/unit/infrastructure tests/unit/compositionRoot.test.ts` et vérifier que les tests de T006 à T010 échouent (module `testClock` absent, signatures sans horloge)

### Implementation for User Story 4

- [ ] T012 [US4] Créer `tests/support/testClock.ts` : classe `TestClock implements Clock` (`now()` renvoie l'instant courant puis avance de 1 ms, `advanceMinutes(minutes)`), qui ne remplace aucune fonction globale
- [ ] T013 [US4] Dans `src/infrastructure/simulated/busyWait.ts`, passer à `busyWait(clock: Clock, durationMs: number)`, qui lit `clock.now()` ; dans `src/infrastructure/simulated/simulateHttpCall.ts`, passer à `simulateHttpCall(clock: Clock, url, body)`
- [ ] T014 [US4] Faire recevoir l'horloge par les adaptateurs simulés (`SimulatedPaymentGateway(logger, clock)`, `SimulatedLocationService(clock)`, `SimulatedFraudScreening(clock)`, `SimulatedFleetNotifier(logger, clock)`) dans `src/infrastructure/simulated/` ; mêmes durées, mêmes journaux
- [ ] T015 [US4] Dans `src/compositionRoot.ts`, remplacer `createApplication(seed)` par `createApplication(options: { seed?: SeedData; clock?: Clock } = {})` : une seule horloge (par défaut `new SystemClock()`) pour les adaptateurs et les cas d'utilisation ; `src/index.ts` reste `createApplication().app`
- [ ] T016 [US4] Adapter **uniquement la mise en place** de `tests/integration/rental-api.test.ts` :
  - `clock = new TestClock()` puis `({ app, repositories } = createApplication({ clock }))`, à la place de `useFastClock()` ;
  - `clock.advanceMinutes(...)` reste inchangé ;
  - aucune requête ni aucun `expect` modifié
- [ ] T017 [US4] Supprimer `tests/support/fastClock.ts` et toute référence à `useFastClock` ; vérifier `grep -rn "spyOn(Date" tests` (sans résultat) et `grep -rn "Date.now()" src` (seulement `src/infrastructure/systemClock.ts`)
- [ ] T018 [US4] Vérifier :
  - `git diff main -- tests/e2e` est vide ;
  - `git diff main -- tests/integration` se limite à la mise en place, avec le même nombre de `request(app)` et de `expect(` qu'avant ;
  - aucun test de `tests-before.json` n'a disparu sans remplaçant
- [ ] T019 [US4] Passer les portes du commit ([quickstart.md](quickstart.md), section 1) :
  - `pnpm build` ;
  - `pnpm test` ;
  - `pnpm test:coverage` (100 %) ;
  - `pnpm test:mutation` (≥ 90 %) ;
  - durée de `pnpm jest tests/unit tests/integration` ≤ `baseline.md`, mêmes résultats sur 3 exécutions ;
  - seuils du principe III sur les fichiers modifiés
- [ ] T020 [US4] Relecture humaine du diff avant le commit (code et tests générés par une IA, constitution « Workflow » point 5) : répondre aux 5 questions de la diapo 142, corriger les remarques, puis relancer les portes si le code a changé
- [ ] T021 [US4] Commiter `refactor: inject the clock into simulated delays and tests` (« structure, aucun changement de comportement »), vérifier avec `git show --stat HEAD` que `tests/e2e` n'est pas touché, pousser (`git push -u origin 2d-c1-test-clock`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample`, avec les résultats des portes
- [ ] T022 [US4] Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main` ; ne pas commencer la phase 4 avant cette intégration

**Checkpoint** : le temps est maîtrisé sans horloge globale remplacée ; commit 1 intégré à `main`.

---

## Phase 4: User Stories 1 et 2 - Attente non bloquante et cohérence sous concurrence (Priority: P1) — commit 2

**Goal** :
- les ports externes et `Clock.wait` sont asynchrones ;
- les requêtes ne s'attendent plus les unes les autres, et la liste des stations géolocalise ses stations en même temps (US1) ;
- `OperationsInProgress` empêche les conflits entre requêtes concurrentes, avec les refus du contrat actuel (US2).

**Independent Test** :
- les tests de concurrence (unitaires et HTTP) passent, et échoueraient avec une simple attente asynchrone sans réservation ;
- `grep -rn busyWait src tests` ne renvoie rien ;
- `pnpm load` donne une latence maximale en médiane inférieure à 2 s (SC-001) ;
- un `GET /stations` seul répond en moins de 0,5 s (SC-008).

- [ ] T023 [US1] Créer la branche `2d-c2-async` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2d-c2-async`)

### Tests for User Stories 1 et 2 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent avant l'implémentation.

- [ ] T024 [P] [US1] Compléter `tests/unit/support/testClock.test.ts` pour `wait(ms)` :
  - en mode par défaut (saut automatique), `await clock.wait(300)` se résout et `now()` a avancé d'au moins 300 ms ;
  - deux attentes concurrentes de 100 et 300 ms se résolvent dans l'ordre de leurs échéances ;
  - en mode manuel (`new TestClock({ autoAdvance: false })`), une attente de 300 ms n'est pas résolue après `advance(299)`, et l'est après `advance(1)`
- [ ] T025 [P] [US1] Compléter `tests/unit/infrastructure/systemClock.test.ts` : `await new SystemClock().wait(20)` se résout après au moins 20 ms réelles
- [ ] T026 [P] [US1] Adapter les tests des adaptateurs simulés (`tests/unit/infrastructure/simulated*.test.ts`) : chaque méthode renvoie une promesse ; en mode manuel, la promesse n'est pas résolue avant la durée simulée (paiement 1 000 ms par opération, géolocalisation 300 ms, anti-fraude 200 ms, location créée 100 ms, rééquilibrage 150 ms) et l'est juste après ; mêmes résultats et mêmes lignes de journal ; `simulateHttpCall` asynchrone (200 ms)
- [ ] T027 [P] [US1] Dans `tests/support/portDoubles.ts` :
  - remplacer `ControlledClock` par `TestClock` en mode manuel ;
  - rendre asynchrones `FixedLocationService.describe`, `FixedFraudScreening.scoreOf` et `RecordingFleetNotifier.*` ;
  - ajouter un helper `deferred<T>()` (promesse que le test résout lui-même)
- [ ] T028 [P] [US1] Dans `tests/support/fakePaymentGateway.ts`, rendre `preAuthorize` et `capture` asynchrones et ajouter `holdPreAuthorizations()` et `holdCaptures()`, qui retiennent les réponses jusqu'à `releasePreAuthorizations()` et `releaseCaptures()`
- [ ] T029 [P] [US1] Adapter `tests/unit/application/rentBike.test.ts`, `returnBike.test.ts` et `listStations.test.ts` à `await useCase.execute(...)` : mêmes cas, mêmes attentes ; `getRental.test.ts` reste synchrone
- [ ] T030 [P] [US1] Ajouter à `tests/unit/application/listStations.test.ts` le test « géolocalise toutes les stations en même temps » : avec une localisation doublée qui retient ses réponses, les 4 appels à `describe` sont lancés avant qu'aucun ne soit résolu ; en les résolvant dans l'ordre inverse, le résultat reste dans l'ordre des données (FR-004)
- [ ] T031 [P] [US1] Adapter `tests/unit/presentation/createHttpApp.test.ts` : doublures de cas d'utilisation asynchrones (`jest.fn(async (...) => ...)`) ; une promesse rejetée par `getRental` ou `rentBike` donne la réponse 500 par défaut d'Express (R6)
- [ ] T032 [P] [US2] Écrire `tests/unit/application/operationsInProgress.test.ts` :
  - `startRental` / `finishRental` réservent et libèrent le vélo et l'utilisateur ;
  - `startReturn` / `finishReturn` marquent et libèrent la location, et promettent puis rendent une place ;
  - `promisedSlotsAt` compte les retours en cours par station ;
  - deux applications ont des registres indépendants
- [ ] T033 [P] [US2] Ajouter à `tests/unit/application/rentBike.test.ts` les tests de concurrence (paiement retenu avec `holdPreAuthorizations`, FR-016) :
  - même vélo demandé par deux utilisateurs → le second reçoit `NoBikeAvailable` ;
  - sans préférence, dans une station avec au moins deux vélos disponibles → deux vélos différents ;
  - même utilisateur deux fois → `AlreadyRenting` ;
  - paiement refusé après réservation → vélo de nouveau proposé ;
  - paiement qui rejette (exception) → réservation libérée et erreur propagée ;
  - une demande sans conflit (autre utilisateur, autre station) passe pendant l'attente ;
  - l'ordre des refus est inchangé (Bob, crédit insuffisant, reçoit `NotEnoughCredit` même pendant une autre location)
- [ ] T034 [P] [US2] Ajouter à `tests/unit/application/returnBike.test.ts` les tests de concurrence (capture retenue avec `holdCaptures`) :
  - deux retours de la même location → `AlreadyReturned`, une seule capture, un seul débit ;
  - même location vers deux stations → `AlreadyReturned`, vélo garé dans une seule station ;
  - deux locations différentes vers une station avec une seule place libre → la seconde reçoit `StationFull` ;
  - capture qui rejette → marque de retour et place promise libérées
- [ ] T035 [P] [US2] Écrire `tests/integration/concurrency.test.ts` (application réelle, `TestClock` en saut automatique, `Promise.all` de requêtes supertest) :
  - deux `POST /rent` du même vélo → un `200` et un `409 { msg: 'no bike available' }` ;
  - deux `POST /return` de la même location → un `200` et un `409 { msg: 'already returned' }`, crédit débité une fois ;
  - deux `POST /rent` du même utilisateur → un `200` et un `409 { msg: 'already renting' }`
- [ ] T036 [P] [US1] Ajouter à `tests/integration/concurrency.test.ts` le test SC-002 : un `GET /stations` lancé pendant un `POST /rent` reçoit sa réponse avant celle de la location, ce qui montre qu'il n'attend pas le paiement
- [ ] T037 [US1] Lancer `pnpm jest tests/unit tests/integration` et vérifier que les nouveaux tests (T024 à T036) échouent, et que les tests adaptés échouent à la compilation tant que les ports sont synchrones

### Implementation for User Stories 1 et 2

- [ ] T038 [US1] Ajouter `wait(durationMs): Promise<void>` au port `src/application/ports/clock.ts` ; l'implémenter dans `src/infrastructure/systemClock.ts` (minuteur avec `unref()`) et dans `tests/support/testClock.ts` (saut automatique par défaut, attentes résolues dans l'ordre des échéances au tour suivant de la boucle d'événements ; mode manuel `{ autoAdvance: false }` avec `advance(ms)`)
- [ ] T039 [US1] Rendre asynchrones les ports `src/application/ports/paymentGateway.ts`, `locationService.ts`, `fraudScreening.ts` (`scoreOf(...): Promise<number>`) et `fleetNotifier.ts` (`Promise<void>`) ; les résultats renvoyés restent les mêmes
- [ ] T040 [US1] Dans `src/infrastructure/simulated/`, remplacer `busyWait(clock, ms)` par `await clock.wait(ms)` dans `simulateHttpCall` (devenu asynchrone) et dans les 4 adaptateurs simulés, avec les mêmes durées et le même ordre des journaux ; supprimer `src/infrastructure/simulated/busyWait.ts`
- [ ] T041 [US2] Créer `src/application/operationsInProgress.ts`, classe `OperationsInProgress`, qui garde :
  - `reservedBikeIds`, `rentingUserIds`, `returningRentalIds` ;
  - `promisedSlotsByStation`, un nombre par station.

  Elle offre `startRental(userId, bikeId)`, `finishRental(userId, bikeId)`, `startReturn(rentalId, stationId)`, `finishReturn(rentalId, stationId)`, `isBikeReserved`, `isRenting`, `isReturning` et `promisedSlotsAt`, toutes synchrones (data-model.md).
- [ ] T042 [US2] Rendre `src/application/useCases/rentBike.ts` asynchrone :
  - mêmes vérifications dans le même ordre, sans `await` ;
  - un vélo réservé ne compte pas comme disponible ;
  - `isRenting(user)` vaut `AlreadyRenting` ;
  - `startRental` juste après la vérification du crédit, avant l'appel à l'anti-fraude ;
  - `finishRental` dans un `finally`, quelle que soit l'issue ;
  - `OperationsInProgress` ajouté aux dépendances ;
  - fonctions de 30 lignes au plus
- [ ] T043 [US2] Rendre `src/application/useCases/returnBike.ts` asynchrone :
  - `isReturning(rental)` vaut `AlreadyReturned` ;
  - station pleine si `vélos présents + promisedSlotsAt(station) >= capacité` ;
  - `startReturn` avant la capture et `finishReturn` dans un `finally` ;
  - débit, clôture et dépôt du vélo inchangés
- [ ] T044 [P] [US1] Rendre `src/application/useCases/listStations.ts` asynchrone : `Promise.all` des géolocalisations sur `stations.findAll()`, résultat dans l'ordre des données (FR-004)
- [ ] T045 [US1] Dans `src/presentation/http/createHttpApp.ts`, rendre les routes asynchrones : une enveloppe transmet toute promesse rejetée à `next(error)` (R6) ; `UseCases` utilise les nouvelles signatures (`GetRental` reste synchrone)
- [ ] T046 [US2] Dans `src/compositionRoot.ts`, créer une `OperationsInProgress` par application et la passer à `RentBike` et `ReturnBike`
- [ ] T047 [US1] Vérifier :
  - `grep -rn busyWait src tests` ne renvoie rien ;
  - `git diff main -- tests/e2e` est vide ;
  - les 13 tests d'intégration d'origine gardent leurs requêtes et leurs `expect` ;
  - aucun test de `tests-before.json` n'a disparu sans remplaçant
- [ ] T048 [US1] Mesurer en temps réel :
  - `pnpm load` 3 fois : médiane de la latence maximale < 2 s (SC-001) ;
  - `GET /stations` seul avec `curl` 3 fois : médiane < 0,5 s (SC-008) ;
  - un `GET /stations` lancé pendant un `POST /rent` : réponse < 1,5 s (SC-002).

  Noter les valeurs dans la description de la demande de fusion.
- [ ] T049 [US1] Passer les portes du commit :
  - `pnpm build` ;
  - `pnpm test` ;
  - `pnpm test:coverage` (100 %) ;
  - `pnpm test:mutation` (≥ 90 %) ;
  - durée de `pnpm jest tests/unit tests/integration` ≤ `baseline.md`, mêmes résultats sur 3 exécutions (SC-005) ;
  - seuils du principe III
- [ ] T050 [US2] Relecture humaine du diff avant le commit (constitution « Workflow » point 5) : 5 questions de la diapo 142, en vérifiant en particulier qu'aucun `await` ne sépare une vérification de la réservation correspondante (R3) et que chaque réservation est libérée dans un `finally`
- [ ] T051 [US2] Commiter `refactor: wait for external services without blocking` (« structure, aucun changement de comportement pour une requête seule ; requêtes concurrentes traitées comme l'une après l'autre »), pousser (`git push -u origin 2d-c2-async`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample`, avec les mesures de T048 et les résultats des portes
- [ ] T052 [US2] Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main` ; ne pas commencer la phase 5 avant cette intégration

**Checkpoint** : plus aucune attente active ; conflits concurrents refusés comme l'une après l'autre ; commit 2 intégré à `main`.

---

## Phase 5: User Story 3 - Chaque appel externe a une durée maximale (Priority: P2) — commit 3

**Goal** : un décorateur par port externe abandonne l'appel au-delà de sa durée maximale. Il journalise
le dépassement et renvoie la valeur de repli de la clarification Q1. C'est un nouveau comportement,
livré dans un commit `feat:`.

**Independent Test** : avec une doublure qui ne répond jamais, chaque requête se termine au plus tard à
la durée maximale du service, avec la réponse Q1 et la ligne `[WARN] external service timeout ...`.

- [ ] T053 [US3] Créer la branche `2d-c3-timeouts` depuis `main` à jour (`git switch main`, `git pull`, `git switch -c 2d-c3-timeouts`)

### Tests for User Story 3 ⚠️

> Écrire ces tests d'abord ; vérifier qu'ils échouent avant l'implémentation.

- [ ] T054 [P] [US3] Écrire `tests/unit/infrastructure/timeouts/withMaximumDuration.test.ts` (horloge de test en mode manuel, `RecordingLogger`) :
  - un appel qui répond à temps renvoie son résultat, sans journal ;
  - un appel qui ne répond jamais renvoie la valeur de repli dès `advance(maximumDurationMs)`, mais pas avant ;
  - le dépassement journalise `warn('external service timeout', { service, maximumDurationMs })` ;
  - un appel qui rejette avant l'échéance transmet son erreur
- [ ] T055 [P] [US3] Écrire `tests/unit/infrastructure/timeouts/decorators.test.ts`. Pour chaque décorateur, avec une doublure muette et une doublure normale : réponse normale transmise telle quelle, et valeur de repli exacte au-delà de la durée maximale :
  - `PaymentGatewayWithMaximumDuration` : `preAuthorize` → `{ isApproved: false, reason: 'payment gateway timeout' }`, `capture` → `{ isCaptured: false }` ;
  - `LocationServiceWithMaximumDuration` : `{ zone: '', weather: '' }` ;
  - `FraudScreeningWithMaximumDuration` : `{ isAvailable: false }` ;
  - `FleetNotifierWithMaximumDuration` : se résout sans valeur.
- [ ] T056 [P] [US3] Adapter `tests/unit/infrastructure/simulatedFraudScreening.test.ts` et la doublure `FixedFraudScreening` de `tests/support/portDoubles.ts` au port `assess(user, amount): Promise<FraudAssessment>` (`{ isAvailable: true, score }`), avec les mêmes scores
- [ ] T057 [P] [US3] Ajouter à `tests/unit/application/rentBike.test.ts` :
  - anti-fraude indisponible (`{ isAvailable: false }`) → `FraudSuspected`, paiement non contacté, vélo libéré ;
  - pré-autorisation `{ isApproved: false, reason: 'payment gateway timeout' }` → `PaymentDeclined`, journal `payment declined` avec cette raison, vélo de nouveau proposé
- [ ] T058 [P] [US3] Ajouter à `tests/unit/application/listStations.test.ts` et à `tests/unit/presentation/responses.test.ts` : une station dont la géolocalisation renvoie `{ zone: '', weather: '' }` est listée avec `zone: ''` et `weather: ''`, les autres champs restant exacts
- [ ] T059 [P] [US3] Ajouter à `tests/unit/compositionRoot.test.ts` le test SC-007 : `createApplication({ clock, maximumDurations })` enveloppe les services externes. Avec une horloge en mode manuel et des durées maximales très courtes passées en option, un `GET /stations` se termine à leur échéance avec `zone: ''` et `weather: ''`, et la ligne `[WARN] external service timeout` est journalisée.
- [ ] T060 [US3] Lancer `pnpm jest tests/unit` et vérifier que les tests de T054 à T059 échouent (modules `timeouts` absents, port `assess` absent)

### Implementation for User Story 3

- [ ] T061 [US3] Créer `src/infrastructure/timeouts/maximumDurations.ts` : `PAYMENT_MAXIMUM_DURATION_MS = 3000`, `GEOLOCATION_MAXIMUM_DURATION_MS = 1000`, `FRAUD_SCREENING_MAXIMUM_DURATION_MS = 1000`, `FLEET_NOTIFICATION_MAXIMUM_DURATION_MS = 1000`, regroupées dans l'objet `DEFAULT_MAXIMUM_DURATIONS` de type `MaximumDurations` (FR-018)
- [ ] T062 [US3] Créer `src/infrastructure/timeouts/withMaximumDuration.ts` : course entre l'appel et `clock.wait(maximumDurationMs)`, valeur de repli et journal au dépassement (R7), paramètres groupés en un objet si plus de 3
- [ ] T063 [US3] Changer le port `src/application/ports/fraudScreening.ts` en `assess(user, amount): Promise<FraudAssessment>`, avec `FraudAssessment = { isAvailable: true; score: number } | { isAvailable: false }` ; adapter `SimulatedFraudScreening` ; dans `src/application/useCases/rentBike.ts`, refuser avec `FraudSuspected` si l'évaluation est indisponible ou si `isFraudSuspected(score)`
- [ ] T064 [US3] Élargir `LocationDescription` dans `src/application/ports/locationService.ts` à `zone: 'north' | 'south' | ''` et `weather: 'clear' | 'rain' | ''`, puis vérifier que `src/application/useCases/listStations.ts` et `src/presentation/http/responses.ts` transmettent ces valeurs telles quelles
- [ ] T065 [US3] Créer les 4 décorateurs dans `src/infrastructure/timeouts/` : `PaymentGatewayWithMaximumDuration`, `LocationServiceWithMaximumDuration`, `FraudScreeningWithMaximumDuration` et `FleetNotifierWithMaximumDuration`, avec les valeurs de repli de T055
- [ ] T066 [US3] Dans `src/compositionRoot.ts`, ajouter l'option `maximumDurations` (par défaut `DEFAULT_MAXIMUM_DURATIONS`) et envelopper chaque adaptateur simulé dans son décorateur, avec le même `Logger` et la même `Clock`
- [ ] T067 [US3] Recopier `specs/002-async-services/contracts/current-api.openapi.yaml` (version 1.1.0) comme référence du contrat actuel et le citer dans la section API du `README.md` (zone et météo vides possibles)
- [ ] T068 [US3] Vérifier : `git diff main -- tests/e2e` est vide, les 13 tests d'intégration d'origine sont inchangés, et aucun test de `tests-before.json` n'a disparu sans remplaçant

**Checkpoint** : chaque appel externe a une durée maximale ; prêt pour les portes qualité finales.

---

## Phase 6: Portes qualité

**Purpose** : une tâche par porte de la constitution, sur l'état final, avant le commit 3.

- [ ] T069 Build : `pnpm build` compile sans erreur
- [ ] T070 Linter : `pnpm lint` n'existe pas encore (étape 2f, dérogation « Outillage » de Complexity Tracking). Vérifier à la main, sur `src/` et `tests/unit/`, les seuils du principe III :
  - fonctions ≤ 30 lignes, complexité ≤ 10, ≤ 3 paramètres ;
  - fichiers ≤ 1000 lignes ;
  - lignes ≤ 120 caractères (`grep -rnE '.{121,}' src tests/unit tests/support` sans résultat) ;
  - aucun `any`, aucun cast non justifié, aucune assertion non nulle `!`
- [ ] T071 Vérification des types : `pnpm exec tsc --noEmit` sans erreur
- [ ] T072 Suite de tests complète : `pnpm test` (unitaires, intégration, E2E) entièrement verte, avec 13 tests d'intégration d'origine et 2 E2E inchangés
- [ ] T073 Couverture sans baisse : `pnpm test:coverage`, lignes et branches à 100 %
- [ ] T074 Mutation : `pnpm test:mutation` ≥ 90 % ; noter le score et justifier chaque mutant survivant équivalent
- [ ] T075 Quality gate de l'analyse statique : SonarQube n'est pas encore installé (étape 2g, dérogation « Outillage »). Le noter dans la description de la demande de fusion, avec l'absence d'intégration continue (étape 2h).
- [ ] T076 Audit des dépendances (constitution, principe VIII) : `pnpm audit --prod` sans vulnérabilité haute ni critique ; aucune dépendance ajoutée (plan, « Dépendances ajoutées ») ; l'alerte connue sur `minimatch`, par `eslint`, est notée
- [ ] T077 Performance et déterminisme :
  - `pnpm load` 3 fois : médiane de la latence maximale < 2 s (SC-001) ;
  - `GET /stations` seul : médiane < 0,5 s (SC-008) ;
  - `pnpm jest tests/unit tests/integration` 3 fois : durée ≤ `baseline.md` et mêmes résultats (SC-005)
- [ ] T078 Documentation à jour :
  - `README.md` : section « Premières observations », où l'event loop bloquée et les durées maximales sont marquées comme réglées en 2d ; section des services simulés (attente non bloquante, durées maximales) ; section Tests (horloge de test injectée à la place de l'horloge rapide) ;
  - `docs/plan-refactoring.md` : cases de 2d cochées avec les résultats ;
  - `docs/demarche-qualite.md` : choix technique « Horloge rapide » remplacé par l'horloge de test injectée ;
  - `specs/002-async-services/plan.md` : dérogations X et VI retirées de Complexity Tracking
- [ ] T079 Relecture humaine du diff avant le commit (constitution « Workflow » point 5) : 5 questions de la diapo 142 sur l'ensemble du commit 3, corriger les remarques, puis relancer les portes si le code a changé
- [ ] T080 Commiter `feat: give every external call a maximum duration` (nouveau comportement : refus du contrat actuel quand un service externe dépasse sa durée maximale), pousser (`git push -u origin 2d-c3-timeouts`) et ouvrir une demande de fusion vers `main` de `Clement-Garro/codeQualityExample`, avec les résultats des portes
- [ ] T081 Faire relire la demande de fusion, corriger les remarques, puis l'intégrer à `main`. L'étape 2d est terminée quand elle est intégrée. Vérifier alors sur `main`, depuis le commit de départ noté dans `baseline.md` :
  - `git diff <départ>..main -- tests/e2e` est vide ;
  - les 13 tests d'intégration d'origine ont le même nombre de `request(app)` et de `expect(` ;
  - la suite complète est verte

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : T001 (documentation intégrée) avant tout ; T003 et T004 avant tout changement de code.
- **US4, US1+US2 et US3** : strictement séquentielles (FR-017). Chaque phase se termine par une demande
  de fusion intégrée à `main`, et la suivante part de `main` à jour.
  - US1+US2 a besoin de l'horloge injectée de l'US4.
  - US3 a besoin des ports asynchrones et de `Clock.wait` de US1+US2.
- **Portes qualité (Phase 6)** : après la phase 5 ; T080 contient le commit 3.

### Within Each Phase

- Les tests de caractérisation sont verts avant tout changement. Les nouveaux tests sont écrits puis
  **vérifiés en échec** (T011, T037, T060), avant l'implémentation, les vérifications, les portes, la
  relecture humaine et la demande de fusion.
- **Phase 4** : port `Clock` et horloges (T038), puis ports externes (T039), puis adaptateurs (T040),
  puis registre (T041), puis cas d'utilisation (T042 à T044), puis routes (T045), puis assemblage (T046).
- **Phase 5** : constantes (T061), puis `withMaximumDuration` (T062), puis ports (T063, T064), puis
  décorateurs (T065), puis assemblage (T066).

### Parallel Opportunities

- **US4** : T006 à T010.
- **US1+US2** : T024 à T036 (fichiers distincts ; T029, T030 et T033, T034 touchent les mêmes fichiers de
  tests : à faire à la suite) ; T044 en parallèle de T042 et T043.
- **US3** : T054 à T059.

---

## Parallel Example: User Stories 1 et 2

```bash
# Tests en parallèle (fichiers distincts) :
Task: "Compléter tests/unit/support/testClock.test.ts pour wait(ms)"
Task: "Écrire tests/unit/application/operationsInProgress.test.ts"
Task: "Écrire tests/integration/concurrency.test.ts"
Task: "Adapter tests/unit/presentation/createHttpApp.test.ts aux cas d'utilisation asynchrones"
```

---

## Implementation Strategy

### MVP First

Le MVP utile est le **commit 2** (US1+US2) : c'est lui qui supprime le blocage. Il ne peut pas être livré
avant le commit 1 (US4), dont il a besoin pour des tests rapides et déterministes, et il ne doit jamais
l'être sans les garanties de l'US2. Le commit 3 (US3) ajoute la tolérance aux pannes.

### Incremental Delivery

0. Demande de fusion documentaire (`002-async-services`), intégrée à `main`
1. US4 : `refactor: inject the clock into simulated delays and tests`, demande de fusion `2d-c1-test-clock`, intégrée
2. US1 et US2 : `refactor: wait for external services without blocking`, demande de fusion `2d-c2-async`, intégrée
3. US3 et portes qualité : `feat: give every external call a maximum duration`, demande de fusion `2d-c3-timeouts`, intégrée
4. `/speckit-converge` : dernière étape obligatoire du flux (constitution, principe I)

Chaque demande de fusion laisse `main` vert : on peut s'arrêter après n'importe laquelle. Si l'on
s'arrête après le commit 2, la dérogation VI (durées maximales) reste écrite dans Complexity Tracking.

---

## Notes

- Une tâche, une intention : les commits 1 et 2 ne changent pas le comportement d'une requête seule ; le
  commit 3 est le seul changement de comportement.
- Si un test de caractérisation (intégration d'origine, E2E) échoue, c'est une régression à corriger, pas
  un test à adapter.
- Une réservation (vélo, utilisateur, location, place) est toujours libérée dans un `finally` ; un oubli
  bloquerait durablement un vélo ou un utilisateur (section Sécurité de la spec).
- Les tests unitaires et d'intégration n'attendent jamais le temps réel ; seuls `pnpm load`, `curl` et le
  test E2E mesurent des durées réelles.
