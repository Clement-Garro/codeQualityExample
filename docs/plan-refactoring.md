# Plan de refactoring : checklist

Le refactoring de `bike-rental-legacy` avance en 3 étapes, chacune découpée en commits qui ont un seul objectif : structure **ou** comportement (point 1 de « Workflow et portes qualité » de la [constitution](../.specify/memory/constitution.md), v2.0.0). On ne passe à la case suivante qu'une fois la précédente commitée et toutes les portes qualité vertes.

Les raisons de chaque choix sont expliquées dans [demarche-qualite.md](demarche-qualite.md).

## Portes qualité (avant chaque commit)

Ces vérifications reprennent la section « Workflow et portes qualité » de la constitution.

1. `pnpm build` compile sans erreur (vérification des types en mode `strict`).
2. `pnpm lint` passe, formateur compris (à partir de l'étape 2f).
3. `pnpm test` passe en entier (unitaires, intégration, E2E).
4. `pnpm test:coverage` : la couverture des lignes et des branches ne baisse pas.
5. `pnpm test:mutation` : le score reste ≥ 90 %.
6. La quality gate SonarQube est verte (à partir de l'étape 2g).
7. Le diff ne contient qu'un seul type de changement : **structure** (`refactor:`) ou **comportement** (`fix:`, `feat:`), avec un message Conventional Commits qui l'indique.
8. Le README et `docs/` sont à jour si le comportement, les commandes ou la structure changent.
9. Le code et les tests générés par une IA ont été relus par un humain ; la revue répond aux 5 questions de la diapo 142.

Tant que l'étape 3 n'est pas faite, un commit `refactor:` ne modifie pas le contrat d'API actuel (voir la section [Dérogations](#dérogations-complexity-tracking)).

## Étape 1 : corriger les 3 défauts (comportement)

Écrite et vérifiée dans le projet. Résultats : 145 tests verts (130 unitaires, 13 intégration, 2 E2E), mutation à 95,65 %, 100 % des lignes couvertes, 97,2 % des branches.

Commit : `fix: refuse rental on declined pre-authorization and use 0.15 rate everywhere`

- [x] Refuser la location (`402 payment declined`) quand la pré-autorisation est refusée, avant toute modification des données, et journaliser le refus
- [x] Utiliser le tarif de 0,15 par minute partout (l'estimation égale enfin le prix)
- [x] Retirer les 3 `.failing` et ajouter les tests du paiement refusé (unitaires et intégration)
- [x] Mettre à jour le README et `docs/demarche-qualite.md`
- [x] Passer les portes qualité (couverture des branches 97,27 % → 97,2 % : mêmes 4 gardes non couvertes, 3 branches mortes supprimées)
- [x] Écrire les 7 fichiers dans le projet
- [x] Relire le diff
- [x] Lancer `pnpm test`
- [x] Commiter

## Étape 2 : refactoring de structure et outillage (8 commits)

L'API ne change pas : mêmes routes, mêmes codes HTTP, mêmes réponses JSON. Les tests d'intégration et E2E restent identiques (seule leur mise en place change), ce qui prouve que le comportement est préservé. L'ordre suit les « Prochaines étapes » de `demarche-qualite.md`.

### 2a. Tarif unique et constantes nommées

Commit : `refactor: single pricing function and named business constants`

- [x] Faire calculer le prix par une seule fonction dans les 3 endroits (diapo 42, DRY) ; le calcul de durée, lui aussi copié 3 fois, est extrait dans `computeDurationMinutes`
- [x] Remplacer `30`, `0.15`, `2.5`, `1440`, `25`, `0.8`, `5`, `100`, `40` par des constantes nommées (diapo 45), ainsi que les poids de fraude, l'usure (`4` min/km), le seuil de rééquilibrage (`1.5`) et les seuils de zone, dans `src/businessRules.ts`
- [x] Vérifier que les tests passent sans modification (145 verts, aucun fichier de test modifié)
- [x] Portes qualité (couverture des branches 97,2 % → 97,6 % ; mutation 95,65 % → 95,49 % : mutants tués supprimés avec la duplication, survivants équivalents), puis commit

### 2b. Types stricts et enums

Commit : `refactor: strict typing and enums for statuses`

- [x] Activer `strict` dans `tsconfig.json` (sources et tests)
- [x] Typer `Station`, `Bike`, `User`, `Rental` et supprimer les `any` ; les handlers dépendent d'interfaces HTTP minimales (`HttpRequest`, `HttpResponse`) et le paiement ne reçoit que les champs utiles de l'utilisateur
- [x] Remplacer les statuts numériques par des enums `BikeStatus`, `RentalStatus` ; `Subscription` en objet `as const` pour garder les littéraux `'basic'` / `'premium'` valides (diapo 61)
- [x] Supprimer les gardes impossibles (`user !== null`, `bike !== null`) en échouant tôt si les données sont incohérentes (3 tests ajoutés)
- [x] Tests : modifications de typage uniquement (helper `findById`, callbacks typés, `as const`), aucune assertion changée ; 2 tests ajoutés pour un trou révélé par la mutation (location qui n'est pas la première de la liste)
- [x] Portes qualité (150 tests, 100 % des lignes et des branches, mutation 96,38 %), puis commit

### 2c. Découpage en couches SOLID

Commit : `refactor: split into domain, services, repositories and HTTP layers`

Correspondance avec les couches du principe IV : domaine = domaine, services = application (use cases et ports), repositories et services simulés = infrastructure, HTTP = présentation.

- [ ] Domaine : entités avec leurs règles (`Bike.checkOut()`, `Rental.complete()`), politique de tarif, détection de fraude (S) ; données immuables par défaut, état modifié uniquement par des méthodes qui protègent les invariants (principe V) ; le domaine ne dépend ni d'Express ni de l'infrastructure
- [ ] Services : `RentalService` (louer, rendre, consulter) et `StationService` (S)
- [ ] Interfaces (ports) pour les repositories, le paiement et la localisation ; implémentations en mémoire et simulées (I, D)
- [ ] Couche HTTP : validation des entrées, mise en forme des réponses, gestion des erreurs en un seul endroit
- [ ] Composition root qui câble toutes les dépendances (injection de dépendances)
- [ ] Supprimer la duplication `station.bikeIds` / `bike.stationId` : une seule source de vérité
- [ ] Réorganiser les tests unitaires par couche ; intégration et E2E inchangés
- [ ] Supprimer les anciens fichiers (`handlers.ts`, `utils.ts`, `db.ts`, `payment.ts`)
- [ ] Portes qualité, puis commit

### 2d. Asynchrone

Commit : `refactor: async simulated services instead of busy waiting`

- [ ] Mesurer avec `pnpm load` (référence avant)
- [ ] Remplacer l'attente active par des promesses (diapo 58, principe X)
- [ ] Donner un délai maximal à chaque appel de service simulé (paiement, géolocalisation, anti-fraude) et un comportement défini en cas d'échec (principe VI)
- [ ] Empêcher deux requêtes simultanées de prendre le même vélo pendant le paiement, et tester ce cas
- [ ] Injecter une horloge (`Clock`) et supprimer l'horloge rapide des tests
- [ ] Mesurer à nouveau avec `pnpm load` et noter le gain
- [ ] Portes qualité, puis commit

### 2e. Logger et configuration

Commit : `refactor: structured file logger and environment configuration`

- [ ] Ajouter un logger structuré injecté, derrière une interface `Logger`, sans `console.log` (diapo 62, principe VII), et sans données sensibles dans les logs
- [ ] Journaliser l'échec de capture du paiement au lieu de l'ignorer (diapo 57)
- [ ] Lire le port et la destination des logs (fichier par défaut) depuis l'environnement
- [ ] Portes qualité, puis commit

### 2f. ESLint et Prettier

Commit : `chore: add ESLint and Prettier with code quality rules`

- [ ] Configurer ESLint + typescript-eslint avec les seuils du principe III (diapo 50) : `max-lines-per-function` 30, `complexity` 10, `max-params` 3, `max-depth`, `max-lines` 1000, longueur de ligne 120, `no-explicit-any`, `no-console`, `no-floating-promises`
- [ ] Ajouter Prettier pour automatiser la mise en forme (diapos 37, 39), avec `eslint-config-prettier` pour éviter les conflits de règles
- [ ] Ajouter `pnpm lint` et `pnpm format`, puis corriger les erreurs (uniquement des corrections sans effet sur le comportement)
- [ ] Portes qualité (+ lint), puis commit

### 2g. Analyse statique externe (SonarQube)

Commit : `chore: add SonarQube analysis`

La diapo 50 distingue l'outil interne au projet (le linter, étape 2f) de l'outil externalisé qui suit les métriques dans le temps : SonarQube. Il mesure les bugs, les vulnérabilités, les *code smells*, la duplication, la complexité et la couverture, et bloque si un seuil (*quality gate*) n'est pas atteint.

- [ ] Choisir l'hébergement (voir Points ouverts) : SonarQube en local avec Docker, ou SonarQube Cloud
- [ ] Lancer le serveur et créer le projet `bike-rental-legacy`
- [ ] Ajouter `sonar-project.properties` (sources `src`, tests `tests`, rapport de couverture `coverage/lcov.info`)
- [ ] Ajouter un script `pnpm sonar` qui lance l'analyse après `pnpm test:coverage`
- [ ] Faire une première analyse et noter les résultats de référence
- [ ] Corriger ou justifier les problèmes signalés
- [x] Ajouter la quality gate aux portes qualité de la constitution : déjà exigée par la v2.0.0, aucun amendement nécessaire
- [ ] Portes qualité, puis commit

L'idéal serait de lancer une première analyse dès maintenant, sur le code actuel. Elle donnerait une mesure « avant » à comparer avec le résultat du refactoring.

### 2h. Intégration continue

Commit : `ci: run quality gates on every push`

La constitution exige que les portes qualité soient vertes « en local et en intégration continue » (diapos 150, 151). Le dépôt n'a pas encore de CI : c'est une dérogation écrite (voir Dérogations).

- [ ] Ajouter un workflow GitHub Actions (`.github/workflows/quality.yml`) avec pnpm : installation, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:coverage`, `pnpm test:mutation`
- [ ] Ajouter l'analyse SonarQube et sa quality gate au workflow (après 2g)
- [ ] Vérifier qu'un push sur une branche déclenche le workflow et qu'une porte rouge le fait échouer
- [ ] Portes qualité, puis commit

## Étape 3 : nouveau contrat REST (comportement)

C'est un changement de contrat : il casse les clients actuels. La constitution exige qu'il soit déclaré, documenté dans le README et accompagné de tests mis à jour. Grâce à l'étape 2c, il ne devrait toucher que la couche HTTP. Il met fin à la dérogation transitoire au principe IX.

Commit : `feat!: RESTful API contract`

- [ ] Écrire la spécification avec `/speckit-specify` (routes, corps JSON, codes d'erreur, exigences non fonctionnelles, catégories OWASP concernées), puis `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks` et `/speckit-analyze`
- [ ] Écrire le contrat OpenAPI avant le code (diapo 137, principe IX)
- [ ] Routes REST : `GET /stations`, `POST /rentals` (201 + en-tête `Location`), `GET /rentals/:id`, `POST /rentals/:id/return`
- [ ] Clés JSON explicites : `availableBikeCount`, `isElectric`, `kilometers`, `paymentReference`, `durationMinutes`...
- [ ] Erreurs uniformes : `{ "error": { "code": "USER_NOT_FOUND", "message": "..." } }`, y compris pour un JSON mal formé et une route inconnue
- [ ] Validation stricte : identifiants entiers positifs, chaînes refusées (400)
- [ ] Supprimer `estimate`, devenu égal à `price`
- [ ] Mettre à jour les tests d'intégration et E2E sur le nouveau contrat
- [ ] Réécrire la section API du README
- [ ] Retirer la dérogation transitoire de la constitution (`/speckit-constitution`, commit `docs:` séparé) et de la section Dérogations ci-dessous
- [ ] Portes qualité, puis commit

## Conformité à la constitution

Constitution v2.0.0 (modèle du preset quality-kit). Étapes 1 et 3 = comportement, étape 2 = structure, un commit par case.

| Principe | Comment le plan le respecte |
|---|---|
| I. Spécifier avant de coder | Étape 3 passe par le flux Spec Kit complet ; l'étape 2 ne change pas le comportement (contrat inchangé, tests d'intégration et E2E identiques) |
| II. Tests obligatoires, écrits en premier | Les défauts de l'étape 1 étaient décrits par des `it.failing` avant le correctif ; mutation ≥ 90 % et couverture sans baisse à chaque commit ; horloge injectée en 2d (tests déterministes) |
| III. Code lisible | 2a (tarif unique, constantes nommées), 2f (seuils de taille, complexité et paramètres dans ESLint, Prettier) |
| IV. Architecture hexagonale et SOLID | 2c (couches, ports, composition root, injection de dépendances) |
| V. Types et états valides | 2b (mode `strict`, plus de `any`, enums), 2c (entités qui protègent leurs invariants) |
| VI. Erreurs, robustesse et intégrité | Étape 1 (pré-autorisation refusée), 2b (incohérence de données détectée), 2c (une seule source de vérité `bikeIds` / `stationId`), 2d (délais maximaux), 2e (échec de capture journalisé), étape 3 (validation stricte) |
| VII. Observabilité | 2e (logger structuré injecté, destination configurable) |
| VIII. Sécurité | Dépendances justifiées ci-dessous ; catégories OWASP examinées dans la spec de l'étape 3 |
| IX. API REST | Étape 3 (routes REST, codes exacts, erreurs uniformes, OpenAPI) ; dérogation transitoire jusque-là |
| X. Performance | 2d, mesurée avec `pnpm load` avant et après |

## Dérogations (Complexity Tracking)

La constitution exige que toute dérogation soit écrite ici, avec l'alternative plus simple écartée.

| Dérogation | Pourquoi | Alternative écartée | Fin |
|---|---|---|---|
| Principe IX : le contrat actuel est conservé (`POST /rent`, `POST /return`, `GET /stations`, `GET /rentals/:id`, clés `msg`, `ref`, `el`, `km`, codes et corps actuels) | Les tests d'intégration et E2E inchangés prouvent que l'étape 2 préserve le comportement ; changer le contrat en même temps mélangerait structure et comportement | Passer au contrat REST tout de suite : impossible de distinguer une régression du refactoring d'un changement voulu | Étape 3 |
| Principes IV, VII et X et outillage (linter, formateur, SonarQube, intégration continue) pas encore respectés par le code legacy | Mise en conformité progressive, un commit par intention | Tout réécrire en une fois : diff impossible à relire, risque de régression élevé | Fin de l'étape 2 |

## Dépendances ajoutées

La constitution exige de justifier toute nouvelle dépendance.

| Dépendance | Étape | Pourquoi | Alternative écartée |
|---|---|---|---|
| `pino` | 2e | Logger structuré (JSON) qui écrit dans un fichier, recommandé par la diapo 62 (« plusieurs outils permettent de gérer cette problématique ») | Écrire un logger maison : plus de code à maintenir et à tester |
| `eslint`, `@eslint/js`, `typescript-eslint` | 2f | Faire respecter automatiquement les règles de la diapo (diapo 50, « outil interne à un projet : linter ») | Relecture manuelle : non systématique |
| `prettier`, `eslint-config-prettier` | 2f | Mise en forme automatisée exigée par le principe III (diapos 37, 39) | Règles de style d'ESLint : dépréciées et moins complètes |
| Scanner SonarQube | 2g | Outil externalisé de la diapo 50 : métriques suivies dans le temps et quality gate | Aucun équivalent interne pour l'historique et la duplication |

## Points ouverts à trancher

- [x] **Stryker sous Windows** : `pnpm test:mutation` échouait sous Windows avec pnpm (plugin Jest introuvable, motif `<rootDir>/tests/...` sans résultat). Corrigé dans `stryker.config.json` : plugin `@stryker-mutator/jest-runner` déclaré explicitement et `testMatch` en `**/tests/unit/**/*.test.ts`.

- [ ] **Hébergement de SonarQube (2g)** : en local avec Docker (gratuit, fonctionne même si le dépôt est privé, et réutilise les diapos Docker 53-54), ou SonarQube Cloud (rien à installer, commente les pull requests GitHub, gratuit pour un dépôt public).
- [ ] **Crédit débité au-delà de l'autorisation** : le principe VI de la constitution l'interdit, mais aujourd'hui une location de plus de 24 h débite 237,65 alors que seuls 5 ont été pré-autorisés. Il faut une règle métier (plafonner, ou demander une autorisation complémentaire), à corriger dans un commit `fix:` séparé.
- [ ] **Scripts Spec Kit en Bash** : le projet a été initialisé avec les scripts `sh`, qui demandent Git Bash sous Windows. Pour l'étape 3, relancer `specify init --here --force --integration claude --script ps` si `/speckit-specify` échoue.
- [x] **Isolation des tests** : la v1 de la constitution parlait de « rechargement des modules ». La v2.0.0 exige seulement des tests déterministes, isolés et indépendants de leur ordre : l'injection de dépendances de 2c y répond, sans amendement.
- [ ] **Alerte « vélo cassé »** : le log émis à chaque location dans une station qui contient un vélo cassé n'a pas sa place dans la location. Conservée telle quelle pendant 2c (pur refactoring, décision de la spec `../specs/001-couche-hexagonales`, FR-016) ; à déplacer dans un service de maintenance ou à supprimer ensuite, dans un commit `feat:` ou `fix:` séparé.
