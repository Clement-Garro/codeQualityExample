# Implementation Plan: Services externes asynchrones (étape 2d)

**Branch**: `002-async-services` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-async-services/spec.md`

## Summary

Remplacer l'attente active des services externes simulés par une attente qui ne bloque pas le serveur,
sans changer le contrat ni les garanties actuelles. L'horloge, qui fournit l'heure et les attentes, est
injectée partout, et les tests la maîtrisent sans remplacer l'horloge globale (US4). Les ports vers les
services externes deviennent asynchrones et la liste des stations géolocalise ses stations en même temps
(US1). Un registre en mémoire des opérations en cours réserve, avant le premier `await`, ce que
l'opération va modifier, pour que les requêtes concurrentes en conflit reçoivent les refus actuels
(US2). Enfin, des décorateurs donnent une durée maximale à chaque appel externe et renvoient les refus
du contrat actuel quand elle est dépassée (US3). Livraison en 3 commits, chacun dans sa propre demande
de fusion ([research.md](research.md), R11).

## Technical Context

**Language/Version**: TypeScript 5.4 (mode `strict`), Node.js 20

**Primary Dependencies**: Express 4 (présentation) ; aucune dépendance ajoutée

**Storage**: en mémoire (repositories synchrones, inchangés)

**Testing**: Jest 30 + ts-jest, supertest (intégration et concurrence HTTP), `fetch` sur un vrai serveur (E2E, temps réel), Stryker 10 (seuil `break` 90)

**Target Platform**: serveur Node.js (développement sous Windows et Linux)

**Project Type**: web-service (API HTTP JSON)

**Performance Goals** :
- 20 `GET /stations` simultanés : latence maximale < 2 s, en médiane de 3 exécutions de `pnpm load` (référence ≈ 24 s) ;
- une consultation seule : < 0,5 s (référence ≈ 1,2 s) ;
- une consultation pendant un paiement : < 1,5 s.

**Constraints** :
- contrat HTTP inchangé, sauf la zone et la météo vides quand la géolocalisation dépasse sa durée maximale (commit 3) ;
- mêmes durées simulées qu'aujourd'hui ;
- mêmes lignes de journal et même ordre au sein d'une requête ;
- tests sans attente réelle et déterministes ;
- principe III : fonctions ≤ 30 lignes, complexité ≤ 10, ≤ 3 paramètres.

**Scale/Scope** : un processus, 4 routes, 4 ports à rendre asynchrones, 2 cas d'utilisation à protéger contre la concurrence, 4 décorateurs à durée maximale, environ 300 tests unitaires à adapter

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Règle | Avant la conception | Après la conception |
|-------|---------------------|---------------------|
| I. Spec validée, contrat écrit, ENF chiffrées | ✅ spec validée (16/16), clarifiée (4 questions) | ✅ [contrat 1.1.0](contracts/current-api.openapi.yaml), [ports](contracts/ports.md) |
| II. TDD, tests déterministes, mutation ≥ 90 % | ✅ exigé (FR-014 à FR-016) | ✅ horloge de test injectée, tests de concurrence avec réponses retenues (R8, R9) |
| III. Code lisible, seuils | ✅ | ✅ attente, réservation et décorateurs séparés en petites unités |
| IV. Hexagonal et SOLID | ✅ | ✅ `OperationsInProgress` dans l'application ; durées maximales dans l'infrastructure (décorateurs) ; domaine inchangé |
| V. Types stricts | ✅ | ✅ `FraudAssessment` discriminé ; zone et météo en unions fermées avec `''` |
| VI. Erreurs, intégrité, délais maximaux | ⚠️ pas de délai maximal (dérogation 2c) | ✅ US3 (commit 3) ; aucune modification partielle (réservations libérées dans un `finally`) |
| VII. Logger injecté | ⚠️ `console.log` derrière `ConsoleLogger` | ⚠️ dérogation conservée (2e) ; délais dépassés journalisés sans donnée sensible |
| VIII. Sécurité | ✅ OWASP A04 examiné (conditions de concurrence) | ✅ US2 + libération systématique des réservations |
| IX. API REST | ⚠️ contrat non REST | ⚠️ dérogation transitoire (étape 3) |
| X. Pas de blocage, mesure avant / après | ⚠️ attente active | ✅ levée au commit 2, mesurée par `pnpm load` |
| Configuration depuis l'environnement | ⚠️ port et démarrage en dur (dérogation 2c) | ⚠️ durées maximales en constantes injectées, lues depuis l'environnement en 2e (clarification Q3) |
| Outillage (linter, formateur, SonarQube, CI) | ⚠️ absent | ⚠️ dérogations conservées (2f, 2g, 2h) |
| Une intention par commit | ✅ | ✅ R11 : 2 `refactor:` et 1 `feat:` |

**Résultat** : la porte est franchie. Chaque ⚠️ restant est une dérogation écrite dans Complexity
Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-async-services/
├── plan.md                         # ce fichier
├── research.md                     # décisions R1 à R11
├── data-model.md                   # OperationsInProgress, ports modifiés, durées maximales
├── quickstart.md                   # guide de validation
├── contracts/
│   ├── current-api.openapi.yaml    # contrat HTTP 1.1.0 (zone et météo vides possibles)
│   └── ports.md                    # ports asynchrones, décorateurs, journal
├── checklists/requirements.md
├── baseline.md                     # mesures de référence (tâche de Setup)
└── tasks.md                        # phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── domain/                                  # inchangé
├── application/
│   ├── ports/
│   │   ├── clock.ts                         # + wait(durationMs) (commit 2)
│   │   ├── paymentGateway.ts                # Promise (commit 2)
│   │   ├── locationService.ts               # Promise (commit 2) ; zone et météo '' (commit 3)
│   │   ├── fraudScreening.ts                # Promise (commit 2) ; assess + FraudAssessment (commit 3)
│   │   └── fleetNotifier.ts                 # Promise (commit 2)
│   ├── operationsInProgress.ts              # nouveau (commit 2)
│   └── useCases/                            # rentBike, returnBike, listStations asynchrones (commit 2)
├── infrastructure/
│   ├── systemClock.ts                       # + wait avec minuteur non bloquant (commit 2)
│   ├── simulated/
│   │   ├── busyWait.ts                      # lit l'horloge injectée (commit 1) ; supprimé (commit 2)
│   │   ├── simulateHttpCall.ts              # horloge injectée (commit 1) ; asynchrone (commit 2)
│   │   └── simulated*.ts                    # horloge injectée (commit 1) ; clock.wait (commit 2)
│   └── timeouts/                            # nouveau (commit 3)
│       ├── withMaximumDuration.ts           # course entre l'appel et clock.wait
│       ├── maximumDurations.ts              # constantes nommées (FR-018)
│       └── *WithMaximumDuration.ts          # un décorateur par port externe
├── presentation/http/createHttpApp.ts       # routes asynchrones, rejet transmis à next (commit 2)
└── compositionRoot.ts                       # option clock (commit 1), OperationsInProgress (commit 2), décorateurs (commit 3)

tests/
├── support/
│   ├── fastClock.ts                         # supprimé (commit 1)
│   ├── testClock.ts                         # nouveau : 1 ms par lecture (commit 1) ; + wait à saut automatique et mode manuel (commit 2)
│   ├── fakePaymentGateway.ts                # + réponses retenues (commit 2)
│   └── portDoubles.ts                       # doublures asynchrones (commit 2), doublures muettes (commit 3)
├── unit/                                    # tests adaptés à l'asynchrone ; tests de concurrence (commit 2) ; tests des décorateurs (commit 3)
├── integration/rental-api.test.ts           # mise en place seulement (commit 1) ; mêmes requêtes et attentes
└── e2e/rental-journey.test.ts               # inchangé
```

**Structure Decision** : celle de l'étape 2c est conservée. Les seuls ajouts sont
`application/operationsInProgress.ts` et `infrastructure/timeouts/`.

## Livraison en 3 commits, une demande de fusion par commit

| Commit (branche) | Contenu | Tests | Fin |
|------------------|---------|-------|-----|
| `refactor: inject the clock into simulated delays and tests` (`2d-c1-test-clock`) | `busyWait`, `simulateHttpCall` et les adaptateurs simulés reçoivent `Clock` ; `createApplication({ seed, clock })` | `testClock.ts` (1 ms par lecture) remplace `fastClock.ts` dans tous les tests ; intégration : mise en place seulement | plus aucun `spyOn(Date, 'now')` ni `Date.now()` hors `SystemClock` |
| `refactor: wait for external services without blocking` (`2d-c2-async`) | ports externes et `Clock.wait` en `Promise` ; cas d'utilisation et routes asynchrones ; `OperationsInProgress` ; géolocalisations en même temps | tests adaptés ; tests de concurrence (FR-016) ; `testClock` avec saut automatique et mode manuel | `busyWait` supprimé ; SC-001, SC-002 et SC-008 mesurés |
| `feat: give every external call a maximum duration` (`2d-c3-timeouts`) | décorateurs à durée maximale ; `FraudAssessment` ; zone et météo `''` ; journal des délais dépassés | décorateurs testés avec des doublures muettes ; réponses Q1 testées par cas d'utilisation et par HTTP | contrat 1.1.0 ; README et `docs/plan-refactoring.md` (cases 2d) |

Avant le commit 1 : mesures de référence ([quickstart.md](quickstart.md), section 0). Après chaque
commit : toutes les portes (quickstart, section 1).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| IX : contrat HTTP non REST conservé | Le comportement doit rester comparable aux tests d'intégration et E2E existants | Le nouveau contrat est l'étape 3 |
| VII : `ConsoleLogger` écrit avec `console.log` | Mêmes lignes de journal (FR-001) | Logger structuré : étape 2e |
| Configuration : durées maximales et port en constantes, pas dans l'environnement | Clarification Q3 : constantes injectées, réglables par les tests | La lecture de l'environnement relève de l'étape 2e |
| X et VI tant que le commit 2 (attente active) ou le commit 3 (durée maximale) ne sont pas intégrés | FR-017 impose l'ordre US4, US1+US2, US3 | Tout livrer en un commit mélangerait structure et comportement |
| `any` conservé dans `tests/e2e/rental-journey.test.ts` | Le test E2E reste inchangé (FR-015) | Il sera réécrit à l'étape 3 |
| Outillage : pas d'ESLint, de Prettier, de SonarQube ni d'intégration continue | Étapes 2f, 2g et 2h | Mélanger deux intentions |

## Vérification qualité détaillée *(obligatoire, à remplir avant puis après la conception)*

Chaque ligne est cochée, ou justifiée dans Complexity Tracking. Une case non cochée sans justification
bloque `/speckit-tasks`.

| Principe | Vérification | Avant | Après |
|----------|--------------|-------|-------|
| I. Spécifier avant de coder | `spec.md` validé, contrat écrit, exigences non fonctionnelles chiffrées | [x] | [x] |
| II. Tests | Stratégie de test ci-dessous complète, TDD prévu, seuil de mutation tenu | [x] | [x] |
| III. Code lisible | Aucune fonction ni aucun fichier prévu au-delà des seuils de taille, complexité, paramètres et longueur de ligne | [x] | [x] |
| IV. Architecture | Chaque élément placé dans une couche ci-dessous ; le domaine ne dépend de rien d'extérieur | [x] | [x] |
| V. Types | Nouveaux types et enums listés ; aucun type « fourre-tout » | [x] | [x] |
| VI. Erreurs | Chaque cas d'erreur du contrat a sa gestion ; aucun succès partiel possible | [x] (délai maximal : commit 3) | [x] |
| VII. Observabilité | Événements journalisés listés, sans donnée sensible | [x] | [x] ([ports.md](contracts/ports.md) ; console : Complexity Tracking) |
| VIII. Sécurité | Catégories OWASP de la spec traitées | [x] | [x] (A04 : US2) |
| IX. API REST | Contrat OpenAPI dans `contracts/`, codes de retour exacts | [x] (dérogation) | [x] (contrat 1.1.0 ; REST : Complexity Tracking) |
| X. Performance | Exigences de performance mesurables, mesure avant/après prévue | [x] | [x] (`pnpm load` avant le commit 1 et après le commit 2) |

## Architecture *(obligatoire)*

| Couche | Éléments ajoutés ou modifiés | Ports utilisés ou créés |
|--------|------------------------------|-------------------------|
| Domaine | aucun | n/a |
| Application | `OperationsInProgress` ; `RentBike`, `ReturnBike`, `ListStations` asynchrones ; refus par prudence si l'anti-fraude est indisponible | driven modifiés : `Clock` (+ `wait`), `PaymentGateway`, `LocationService`, `FraudScreening`, `FleetNotifier` (asynchrones) |
| Infrastructure | `SystemClock.wait` ; adaptateurs simulés avec `clock.wait` ; `withMaximumDuration` et 4 décorateurs ; `MaximumDurations` | implémente les ports driven ci-dessus |
| Présentation | routes asynchrones, rejets transmis au gestionnaire d'erreurs d'Express | appelle les ports driving |

Le point d'assemblage crée une `OperationsInProgress` par application, la passe aux cas « louer » et
« rendre », et enveloppe chaque adaptateur externe dans son décorateur à durée maximale (commit 3).

Design patterns utilisés, chacun avec le problème qu'il résout :

- **Décorateur** : ajouter une durée maximale à chaque port externe sans toucher aux adaptateurs simulés
  ni aux cas d'utilisation (R7).
- **Réservation avant `await`** (registre d'opérations en cours) : obtenir le comportement « l'une après
  l'autre » pour les requêtes en conflit sans verrou global (R3).

## Stratégie de test *(obligatoire)*

| Niveau | Ce qui est testé | Doublures (frontières uniquement) | Fichiers |
|--------|------------------|------------------------------------|----------|
| Unitaire – application | cas d'utilisation asynchrones, mêmes résultats qu'en 2c ; conflits : même vélo, même utilisateur, même location, dernière place, réservation libérée après refus, erreur ou délai ; `OperationsInProgress` | paiement avec réponses retenues, localisation, anti-fraude, notifications, logger, horloge de test | `tests/unit/application/*.test.ts` |
| Unitaire – infrastructure | adaptateurs simulés : latence par `clock.wait` (mode manuel : pas de réponse avant la durée simulée), mêmes règles et journaux ; `SystemClock.wait` ; décorateurs (commit 3) : réponse normale transmise, valeur de repli et journal au-delà de la durée maximale | horloge de test, doublure muette | `tests/unit/infrastructure/**/*.test.ts` |
| Unitaire – présentation | routes asynchrones ; rejet → 500 par défaut d'Express | cas d'utilisation doublés | `tests/unit/presentation/*.test.ts` |
| Unitaire – assemblage | isolation de deux applications ; horloge injectée | horloge de test | `tests/unit/compositionRoot.test.ts` |
| Intégration | contrat complet (13 tests inchangés) ; conflits HTTP concurrents ; consultation pendant un paiement retenu (SC-002) | horloge de test seulement | `tests/integration/rental-api.test.ts` (+ nouveaux fichiers de concurrence) |
| End-to-end | parcours P1 en temps réel | aucune | `tests/e2e/rental-journey.test.ts` (inchangé) |
| Performance | SC-001, SC-008 en temps réel | aucune | `pnpm load`, `curl` (quickstart) |
| Mutation | tout `src/` sauf `src/index.ts` | n/a | `stryker.config.json` inchangé |

## Dépendances ajoutées *(obligatoire, même vide)*

| Dépendance | Version | Pourquoi | Alternative écartée |
|------------|---------|----------|---------------------|
| aucune | | `Promise`, `setTimeout` et `Promise.all` suffisent | Bibliothèque de verrous ou de délais : injustifiée pour un seul processus |
