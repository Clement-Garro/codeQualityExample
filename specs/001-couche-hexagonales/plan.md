# Implementation Plan: Découpage en couches hexagonales (étape 2c)

**Branch**: `001-couche-hexagonales` (branche git actuelle : `001-couches-hexagonales`) | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-couche-hexagonales/spec.md`

## Summary

Séparer `bike-rental-legacy` en quatre couches (domaine, application, infrastructure, présentation)
sans aucun changement de comportement observable : même contrat HTTP, mêmes effets sur les données,
mêmes lignes de journal, mêmes attentes simulées. Le domaine devient pur et immuable (entités qui
protègent leurs invariants, politiques de tarif, de fraude, de choix du vélo et de rééquilibrage),
les données et services externes passent derrière des ports, l'emplacement d'un vélo n'est plus
stocké qu'une fois, quatre cas d'utilisation reçoivent leurs dépendances d'un point d'assemblage
unique, et la couche HTTP ne fait plus que valider, appeler, mettre en forme et traduire les refus.
Livraison en 4 commits `refactor:` (P1 à P4) selon une stratégie « étrangleur » ([research.md](research.md), R10).

## Technical Context

**Language/Version**: TypeScript 5.4 (mode `strict`), Node.js 20

**Primary Dependencies**: Express 4 (présentation uniquement) ; aucune dépendance ajoutée

**Storage**: en mémoire, données initiales recréées à chaque assemblage (`createSeedData()`)

**Testing**: Jest 30 + ts-jest, supertest (intégration), `fetch` sur un vrai serveur (E2E), Stryker 10 (mutation, seuil `break` 90)

**Target Platform**: serveur Node.js (développement sous Windows et Linux)

**Project Type**: web-service (API HTTP JSON)

**Performance Goals**: aucune régression : `pnpm load` (20 `GET /stations` en parallèle) ≤ référence + 10 %

**Constraints**: contrat HTTP strictement identique ; attentes actives conservées (supprimées en 2d) ; `console.log` conservé derrière un port (remplacé en 2e) ; fonctions ≤ 30 lignes, complexité ≤ 10, ≤ 3 paramètres, fichiers ≤ 1000 lignes, lignes ≤ 120 caractères (principe III, vérification manuelle en attendant ESLint en 2f)

**Scale/Scope**: 4 routes, 4 cas d'utilisation, ~650 lignes de production et ~1200 lignes de tests à réorganiser ; 4 stations, 10 vélos, 4 utilisateurs de démonstration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Règle | Avant la conception | Après la conception |
|-------|---------------------|---------------------|
| I. Spec validée, contrat écrit, ENF chiffrées | ✅ spec validée (checklist complète), contrat actuel décrit | ✅ [contrat OpenAPI](contracts/current-api.openapi.yaml) et [ports](contracts/ports.md) écrits |
| II. TDD, pyramide, mutation ≥ 90 %, couverture sans baisse | ✅ exigé par la spec (FR-018, FR-019, SC-001 à SC-003) | ✅ stratégie de test ci-dessous, test écrit avant chaque unité |
| III. Code lisible, seuils de taille | ✅ objectif du découpage | ✅ aucun fichier prévu > 200 lignes ; `RentBike` découpé en étapes privées ; paramètres groupés en objets quand > 3 |
| IV. Hexagonal et SOLID | ✅ objet même de la fonctionnalité | ✅ voir Architecture ; domaine sans dépendance extérieure |
| V. Types stricts, états valides, immuabilité | ✅ | ✅ entités immuables à constructeur privé (R1), enums de refus (R2), `stationId: number \| null` |
| VI. Erreurs, intégrité, une seule source de vérité | ⚠️ capture : `catch {}` vide actuel ; pas de délai maximal sur les services | ✅ `catch {}` supprimé (résultats discriminés, R4) ; `bikeIds` supprimé (R3) ; délais maximaux → dérogation (2d) |
| VII. Logger injecté | ⚠️ `console.log` global | ✅ port `Logger` injecté ; `ConsoleLogger` conservé → dérogation (2e) |
| VIII. Sécurité | ✅ OWASP examiné dans la spec, aucune nouvelle surface | ✅ |
| IX. API REST | ⚠️ contrat non REST | ⚠️ dérogation transitoire de la constitution (étape 3) |
| X. Pas de blocage | ⚠️ attente active | ⚠️ confinée aux adaptateurs simulés → dérogation (2d) |
| Outillage (linter, formateur, SonarQube) | ⚠️ absent | ⚠️ dérogation « code legacy » (2f, 2g) |
| Une intention par commit | ✅ 4 commits `refactor:` | ✅ R10 |

**Résultat** : porte franchie. Chaque ⚠️ est une dérogation écrite dans Complexity Tracking et déjà
couverte par la constitution (dérogation transitoire IX, règle « code legacy ») et par
`docs/plan-refactoring.md`.

## Project Structure

### Documentation (this feature)

```text
specs/001-couche-hexagonales/
├── plan.md                         # ce fichier
├── research.md                     # phase 0 : décisions R1 à R11
├── data-model.md                   # phase 1 : entités, transitions, politiques
├── quickstart.md                   # phase 1 : guide de validation
├── contracts/
│   ├── current-api.openapi.yaml    # contrat HTTP actuel, à préserver
│   └── ports.md                    # ports driving et driven, lignes de journal
├── checklists/requirements.md
└── tasks.md                        # phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── domain/                         # P1 – aucune dépendance extérieure
│   ├── businessRules.ts            # constantes (déplacé depuis src/businessRules.ts)
│   ├── errors.ts                   # DomainRuleViolation, InconsistentDataError
│   ├── station.ts
│   ├── bike.ts                     # BikeStatus, checkOut(), dockAt()
│   ├── user.ts                     # Subscription, debit(), hasMinimumCreditToRent()
│   ├── rental.ts                   # RentalStatus, open(), complete(), durationMinutesAt()
│   ├── money.ts                    # roundToCents
│   ├── pricing.ts                  # durée, prix, montant de pré-autorisation
│   ├── fraud.ts                    # score et seuil de refus
│   ├── bikeSelection.ts            # choix du vélo
│   └── fleet.ts                    # usure (km) et seuil de rééquilibrage
├── application/                    # P2 (ports) et P3 (cas d'utilisation)
│   ├── ports/
│   │   ├── repositories.ts         # Station/Bike/User/RentalRepository
│   │   ├── paymentGateway.ts
│   │   ├── locationService.ts
│   │   ├── fraudScreening.ts
│   │   ├── fleetNotifier.ts
│   │   ├── logger.ts
│   │   └── clock.ts
│   ├── result.ts                   # Result<T, Refusal>, enums de refus
│   └── useCases/
│       ├── rentBike.ts
│       ├── returnBike.ts
│       ├── getRental.ts
│       └── listStations.ts
├── infrastructure/                 # P2
│   ├── inMemory/
│   │   ├── seedData.ts             # createSeedData() (depuis src/db.ts, sans bikeIds)
│   │   └── inMemoryRepositories.ts
│   ├── simulated/
│   │   ├── busyWait.ts             # ex-sleep (supprimé en 2d)
│   │   ├── simulateHttpCall.ts
│   │   ├── simulatedPaymentGateway.ts
│   │   ├── simulatedLocationService.ts
│   │   ├── simulatedFraudScreening.ts
│   │   └── simulatedFleetNotifier.ts
│   ├── consoleLogger.ts            # format actuel (remplacé en 2e)
│   └── systemClock.ts
├── presentation/http/              # P4
│   ├── validation.ts               # hasRequiredFields, conversions Number()
│   ├── refusals.ts                 # table unique refus → { status, msg }
│   ├── responses.ts                # mise en forme JSON (msg, ref, el, km…)
│   └── createHttpApp.ts            # routes Express → cas d'utilisation
├── compositionRoot.ts              # P2 (première version), complété en P3 et P4
└── index.ts                        # export app = createApplication().app ; listen(3000)

tests/
├── unit/
│   ├── domain/                     # P1 – n'importe que src/domain
│   ├── application/                # P3 – cas d'utilisation avec doubles aux frontières
│   ├── infrastructure/             # P2 – repositories, données initiales, adaptateurs simulés
│   ├── presentation/               # P4 – validation, table des refus, mise en forme
│   └── compositionRoot.test.ts     # P2 – isolation de deux assemblages
├── integration/rental-api.test.ts  # requêtes et assertions inchangées (mise en place en P2)
├── e2e/rental-journey.test.ts      # inchangé
└── support/                        # fakeHttp, fastClock, findById + doubles des ports (P2)
```

Fichiers supprimés : `src/businessRules.ts`, `src/types.ts` (P1) ; `src/db.ts`, `src/payment.ts`
(P2) ; `src/handlers.ts`, `src/utils.ts` (P4, au plus tard) ; `tests/unit/db.test.ts`,
`payment.test.ts`, `utils.test.ts`, `handlers.test.ts` au fur et à mesure que leurs cas sont repris
dans les nouveaux dossiers.

**Structure Decision**: projet unique ; un dossier par couche hexagonale sous `src/`, et le même
découpage sous `tests/unit/`. Correspondance avec le vocabulaire de `docs/plan-refactoring.md` :
domaine = domaine, services = application, repositories et services simulés = infrastructure,
HTTP = présentation.

## Livraison en 4 commits

| Commit | Contenu | Tests | Fin de l'étape |
|--------|---------|-------|----------------|
| `refactor: isolate the domain model and business policies` (P1) | `src/domain/` ; `handlers.ts` délègue toutes ses règles au domaine via une conversion temporaire enregistrement ↔ entité | `tests/unit/domain/` (TDD) ; tests de règles retirés de `handlers.test.ts`/`utils.test.ts` quand repris | `businessRules.ts`, `types.ts` et les fonctions métier de `utils.ts` supprimés |
| `refactor: put data access and external services behind ports` (P2) | ports, adaptateurs, `createSeedData()`, `bikeIds` supprimé, `createHandlers(deps)`, premier `createApplication()` | `tests/unit/infrastructure/`, `compositionRoot.test.ts` ; `handlers.test.ts` utilise des doubles de ports au lieu de `jest.mock` ; **mise en place** de l'intégration via `createApplication()` | `db.ts`, `payment.ts`, la conversion temporaire de P1 et `jest.resetModules()` supprimés |
| `refactor: extract rental and station use cases` (P3) | 4 cas d'utilisation, résultats discriminés, gestionnaires réduits à un appel | `tests/unit/application/` (cas repris de `handlers.test.ts`) | plus aucune règle ni accès aux données dans `handlers.ts` |
| `refactor: reduce the HTTP layer to presentation` (P4) | `src/presentation/http/`, table unique des refus, `index.ts` minimal | `tests/unit/presentation/` | `handlers.ts`, `utils.ts`, `handlers.test.ts`, `utils.test.ts` supprimés ; README (section structure) et `docs/plan-refactoring.md` (cases 2c) mis à jour |

Avant P1 : mesures de référence ([quickstart.md](quickstart.md), section 0). Après chaque commit :
toutes les portes qualité (quickstart, section 1).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| IX : contrat HTTP non REST conservé | Exigence FR-001 : prouver par des tests d'intégration et E2E inchangés que 2c ne change pas le comportement | Changer le contrat maintenant mélangerait structure et comportement (étape 3) |
| X : attente active conservée dans les adaptateurs simulés | Mêmes durées qu'aujourd'hui (R5) ; mesure de référence de 2d non faussée | Passer en asynchrone maintenant : c'est l'étape 2d, avec sa propre mesure avant / après |
| VI : pas de délai maximal sur les appels simulés | Les appels sont synchrones et locaux ; un délai maximal n'a de sens qu'avec des appels asynchrones | L'ajouter maintenant imposerait l'asynchrone (2d) |
| VII : `ConsoleLogger` écrit avec `console.log` | Mêmes lignes de journal (FR-003) ; le port est déjà injecté | Logger structuré maintenant : étape 2e, changerait le format |
| Outillage : pas d'ESLint, Prettier ni SonarQube | Étapes 2f et 2g ; seuils du principe III vérifiés en revue | Ajouter l'outillage dans ce refactoring mélangerait deux intentions |
| Conversion temporaire enregistrement ↔ entité dans `handlers.ts` (P1 seulement) | Permet un commit P1 vert sans toucher au stockage | Faire P1 et P2 ensemble : diff trop gros pour une revue |

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
| VI. Erreurs | Chaque cas d'erreur du contrat a sa gestion ; aucun succès partiel possible | [x] | [x] (délais maximaux : Complexity Tracking) |
| VII. Observabilité | Événements journalisés listés, sans donnée sensible | [x] | [x] ([ports.md](contracts/ports.md) ; console : Complexity Tracking) |
| VIII. Sécurité | Catégories OWASP de la spec traitées | [x] | [x] |
| IX. API REST | Contrat OpenAPI dans `contracts/`, codes de retour exacts | [x] (dérogation) | [x] (contrat actuel décrit ; REST : Complexity Tracking) |
| X. Performance | Exigences de performance mesurables, mesure avant/après prévue | [x] | [x] (`pnpm load` avant P1 et après chaque commit) |

## Architecture *(obligatoire)*

| Couche | Éléments ajoutés ou modifiés | Ports utilisés ou créés |
|--------|------------------------------|-------------------------|
| Domaine | `Station`, `Bike`, `User`, `Rental` (immuables, invariants) ; politiques `pricing`, `fraud`, `bikeSelection`, `fleet`, `money` ; constantes et enums ; `DomainRuleViolation`, `InconsistentDataError` | n/a |
| Application | `RentBike`, `ReturnBike`, `GetRental`, `ListStations` ; `Result` et enums de refus | driving : les 4 cas d'utilisation ; driven créés : `StationRepository`, `BikeRepository`, `UserRepository`, `RentalRepository`, `PaymentGateway`, `LocationService`, `FraudScreening`, `FleetNotifier`, `Logger`, `Clock` |
| Infrastructure | repositories en mémoire, `createSeedData`, adaptateurs simulés (paiement, localisation, anti-fraude, notifications), `ConsoleLogger`, `SystemClock`, `busyWait`, `simulateHttpCall` | implémente tous les ports driven |
| Présentation | `createHttpApp` (4 routes), `validation`, `refusals` (table unique), `responses` | appelle les ports driving |

Point d'assemblage : `createApplication(seed)` dans `src/compositionRoot.ts`, seul endroit qui
instancie les adaptateurs et les cas d'utilisation (injection par constructeur).

Design patterns utilisés, chacun avec le problème qu'il résout :

- **Ports et adaptateurs** : isoler le métier du HTTP, du stockage et des services simulés (but de
  la fonctionnalité, étape 3 limitée à la présentation).
- **Repository** : une interface de collection par agrégat, pour remplacer le stockage en mémoire
  sans toucher au métier et déduire l'emplacement des vélos d'une source unique.
- **Composition root** : un seul endroit crée les dépendances, chaque assemblage a ses propres
  données (FR-012, FR-013).
- **Résultat discriminé** : signaler un refus métier sans exception ni code HTTP (FR-014).

## Stratégie de test *(obligatoire)*

| Niveau | Ce qui est testé | Doublures (frontières uniquement) | Fichiers |
|--------|------------------|------------------------------------|----------|
| Unitaire – domaine | invariants des entités (transitions refusées sans changement), tarif (bornes 30 min et 24 h, électrique, premium, arrondi), pré-autorisation, score et seuil de fraude (bornes 40 et 100), choix du vélo (moins kilométré, égalité, vélo demandé, `null`), usure, rééquilibrage (seuil strict) | aucune | `tests/unit/domain/*.test.ts` |
| Unitaire – application | chaque cas d'utilisation : succès, chaque refus dans l'ordre de vérification, aucune modification ni identifiant consommé sur refus, lignes de journal (`broken bike`, `payment declined`), capture échouée → `captured: false`, données incohérentes → exception sans modification | `PaymentGateway`, `LocationService`, `FraudScreening`, `FleetNotifier`, `Logger`, `Clock` ; repositories **réels** en mémoire | `tests/unit/application/*.test.ts` |
| Unitaire – infrastructure | repositories (recherche, ordre, `findDockedAt`, `countDocked`, `nextId` par instance), intégrité des données initiales, adaptateurs simulés (règles de refus, lignes de journal, durées minimales), format de `ConsoleLogger` | `console.log` (espion existant) ; horloge rapide pour les attentes | `tests/unit/infrastructure/*.test.ts` |
| Unitaire – présentation | validation (absent, `null`, vide, `NaN`, chaînes numériques), table des refus (chaque refus → code et `msg`), mise en forme des réponses (clés et ordre) | cas d'utilisation (doubles), `fakeHttp` | `tests/unit/presentation/*.test.ts` |
| Unitaire – assemblage | deux `createApplication()` ne partagent ni données ni compteur | aucune | `tests/unit/compositionRoot.test.ts` |
| Intégration | contrat HTTP complet avec tous les vrais modules | aucune (horloge rapide seulement) | `tests/integration/rental-api.test.ts` (inchangé hors mise en place) |
| End-to-end | parcours P1 du cycliste et requête incomplète | aucune | `tests/e2e/rental-journey.test.ts` (inchangé) |
| Mutation | tout `src/` sauf `src/index.ts` (exclusion actuelle : démarrage du serveur) | n/a | `stryker.config.json` inchangé |

Les cas existants de `handlers.test.ts`, `utils.test.ts`, `db.test.ts` et `payment.test.ts` sont
**tous repris** dans la couche qui porte désormais la règle ; un fichier de test n'est supprimé
qu'une fois ses cas déplacés (vérifié en revue par la liste des noms de tests).

## Dépendances ajoutées *(obligatoire, même vide)*

| Dépendance | Version | Pourquoi | Alternative écartée |
|------------|---------|----------|---------------------|
| aucune | | Assemblage à la main (R9) | Conteneur d'injection : injustifié pour une dizaine d'objets |
