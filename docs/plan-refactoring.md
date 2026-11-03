# Plan de refactoring : checklist

Le refactoring de `bike-rental-legacy` avance en 3 étapes, chacune découpée en commits qui ont un seul objectif : structure **ou** comportement (principe I de la [constitution](../.specify/memory/constitution.md)). On ne passe à la case suivante qu'une fois la précédente commitée et toutes les portes qualité vertes.

Les raisons de chaque choix sont expliquées dans [demarche-qualite.md](demarche-qualite.md).

## Portes qualité (avant chaque commit)

Ces vérifications reprennent la section « Workflow et portes qualité » de la constitution.

1. `pnpm build` compile sans erreur.
2. `pnpm test` passe en entier (unitaires, intégration, E2E).
3. `pnpm test:coverage` : la couverture des lignes et des branches ne baisse pas.
4. `pnpm test:mutation` : le score reste ≥ 90 %.
5. Le diff ne contient qu'un seul type de changement : **structure** (`refactor:`) ou **comportement** (`fix:`, `feat:`).
6. Le README et `docs/` sont à jour si le comportement, les commandes ou la structure changent.
7. Le message de commit indique s'il s'agit d'un changement de structure ou de comportement.

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

## Étape 2 : refactoring de structure et outillage (7 commits)

L'API ne change pas : mêmes routes, mêmes codes HTTP, mêmes réponses JSON. Les tests d'intégration et E2E restent identiques (seule leur mise en place change), ce qui prouve que le comportement est préservé. L'ordre suit les « Prochaines étapes » de `demarche-qualite.md`.

### 2a. Tarif unique et constantes nommées

Commit : `refactor: single pricing function and named business constants`

- [ ] Faire calculer le prix par une seule fonction dans les 3 endroits (diapo 42, DRY)
- [ ] Remplacer `30`, `0.15`, `2.5`, `1440`, `25`, `0.8`, `5`, `100`, `40` par des constantes nommées (diapo 45)
- [ ] Vérifier que les tests passent sans modification
- [ ] Portes qualité, puis commit

### 2b. Types stricts et enums

Commit : `refactor: strict typing and enums for statuses`

- [ ] Activer `strict` dans `tsconfig.json`
- [ ] Typer `Station`, `Bike`, `User`, `Rental` et supprimer les `any`
- [ ] Remplacer les statuts numériques par des enums `BikeStatus`, `RentalStatus`, `Subscription` (diapo 61)
- [ ] Supprimer les gardes impossibles (`user !== null`) en échouant tôt si les données sont incohérentes
- [ ] Portes qualité, puis commit

### 2c. Découpage en couches SOLID

Commit : `refactor: split into domain, services, repositories and HTTP layers`

- [ ] Domaine : entités avec leurs règles (`Bike.checkOut()`, `Rental.complete()`), politique de tarif, détection de fraude (S)
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
- [ ] Remplacer l'attente active par des promesses (diapo 58, principe VI)
- [ ] Empêcher deux requêtes simultanées de prendre le même vélo pendant le paiement, et tester ce cas
- [ ] Injecter une horloge (`Clock`) et supprimer l'horloge rapide des tests
- [ ] Mesurer à nouveau avec `pnpm load` et noter le gain
- [ ] Portes qualité, puis commit

### 2e. Logger et configuration

Commit : `refactor: structured file logger and environment configuration`

- [ ] Ajouter un logger structuré qui écrit dans un fichier, jamais sur la sortie standard (diapo 62), derrière une interface `Logger`
- [ ] Journaliser l'échec de capture du paiement au lieu de l'ignorer (diapo 57)
- [ ] Lire le port et le chemin des logs depuis l'environnement
- [ ] Portes qualité, puis commit

### 2f. ESLint

Commit : `chore: add ESLint with code quality rules`

- [ ] Configurer ESLint avec des règles alignées sur la diapo : complexité, profondeur d'imbrication, 3 paramètres maximum, longueur de ligne, `any` et `console` interdits (diapo 50)
- [ ] Ajouter `pnpm lint` et corriger les erreurs
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
- [ ] Ajouter la quality gate SonarQube aux portes qualité de la constitution (amendement via `/speckit-constitution`)
- [ ] Portes qualité, puis commit

L'idéal serait de lancer une première analyse dès maintenant, sur le code actuel. Elle donnerait une mesure « avant » à comparer avec le résultat du refactoring.

## Étape 3 : nouveau contrat REST (comportement)

C'est un changement de contrat : il casse les clients actuels. La constitution exige qu'il soit déclaré, documenté dans le README et accompagné de tests mis à jour. Grâce à l'étape 2c, il ne devrait toucher que la couche HTTP.

Commit : `feat!: RESTful API contract`

- [ ] Écrire la spécification avec `/speckit-specify` (routes, corps JSON, codes d'erreur), puis `/speckit-plan` et `/speckit-tasks`
- [ ] Routes REST : `GET /stations`, `POST /rentals` (201 + en-tête `Location`), `GET /rentals/:id`, `POST /rentals/:id/return`
- [ ] Clés JSON explicites : `availableBikeCount`, `isElectric`, `kilometers`, `paymentReference`, `durationMinutes`...
- [ ] Erreurs uniformes : `{ "error": { "code": "USER_NOT_FOUND", "message": "..." } }`, y compris pour un JSON mal formé et une route inconnue
- [ ] Validation stricte : identifiants entiers positifs, chaînes refusées (400)
- [ ] Supprimer `estimate`, devenu égal à `price`
- [ ] Mettre à jour les tests d'intégration et E2E sur le nouveau contrat
- [ ] Réécrire la section API du README
- [ ] Portes qualité, puis commit

## Conformité à la constitution

| Principe | Comment le plan le respecte |
|---|---|
| I. Comportement préservé, une intention par changement | Étapes 1 et 3 = comportement, étape 2 = structure ; un commit par case ; contrat d'API changé seulement à l'étape 3, déclaré et documenté |
| II. Filet de tests obligatoire | Les défauts de l'étape 1 étaient décrits par des `it.failing` avant le correctif ; tests d'intégration et E2E inchangés pendant l'étape 2 ; mutation ≥ 90 % à chaque commit |
| III. Une seule source de vérité | 2a (tarif unique, constantes), 2b (enums), 2c (plus de double liste `bikeIds` / `stationId`) |
| IV. Échouer tôt, jamais en silence | Étape 1 (pré-autorisation refusée), 2b (incohérence de données détectée), 2e (échec de capture journalisé), étape 3 (validation stricte) |
| V. Code lisible, typé et découpé | 2b (mode `strict`, plus de `any`), 2c (séparation HTTP / métier / données / services externes), 2f (règles ESLint) |
| VI. Event loop non bloquée | 2d, vérifiée avec `pnpm load` avant et après |

## Dépendances ajoutées

La constitution exige de justifier toute nouvelle dépendance.

| Dépendance | Étape | Pourquoi | Alternative écartée |
|---|---|---|---|
| `pino` | 2e | Logger structuré (JSON) qui écrit dans un fichier, recommandé par la diapo 62 (« plusieurs outils permettent de gérer cette problématique ») | Écrire un logger maison : plus de code à maintenir et à tester |
| `eslint`, `@eslint/js`, `typescript-eslint` | 2f | Faire respecter automatiquement les règles de la diapo (diapo 50, « outil interne à un projet : linter ») | Relecture manuelle : non systématique |
| Scanner SonarQube | 2g | Outil externalisé de la diapo 50 : métriques suivies dans le temps et quality gate | Aucun équivalent interne pour l'historique et la duplication |

## Points ouverts à trancher

- [x] **Stryker sous Windows** : `pnpm test:mutation` échouait sous Windows avec pnpm (plugin Jest introuvable, motif `<rootDir>/tests/...` sans résultat). Corrigé dans `stryker.config.json` : plugin `@stryker-mutator/jest-runner` déclaré explicitement et `testMatch` en `**/tests/unit/**/*.test.ts`.

- [ ] **Hébergement de SonarQube (2g)** : en local avec Docker (gratuit, fonctionne même si le dépôt est privé, et réutilise les diapos Docker 53-54), ou SonarQube Cloud (rien à installer, commente les pull requests GitHub, gratuit pour un dépôt public).
- [ ] **Crédit débité au-delà de l'autorisation** : le principe IV de la constitution l'interdit, mais aujourd'hui une location de plus de 24 h débite 237,65 alors que seuls 5 ont été pré-autorisés. Il faut une règle métier (plafonner, ou demander une autorisation complémentaire), à corriger dans un commit `fix:` séparé.
- [ ] **Scripts Spec Kit en Bash** : le projet a été initialisé avec les scripts `sh`, qui demandent Git Bash sous Windows. Pour l'étape 3, relancer `specify init --here --force --integration claude --script ps` si `/speckit-specify` échoue.
- [ ] **Isolation des tests** : la constitution parle de « rechargement des modules ». Après 2c, l'injection de dépendances donne des données neuves à chaque test sans recharger les modules. Il faudra amender cette phrase via `/speckit-constitution`.
- [ ] **Alerte « vélo cassé »** : le log émis à chaque location dans une station qui contient un vélo cassé n'a pas sa place dans la location. À déplacer dans un service de maintenance, ou à supprimer, lors de 2c.
