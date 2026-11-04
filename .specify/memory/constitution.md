# bike-rental-legacy Constitution

## Core Principles

### I. Spécifier avant de coder

- Toute fonctionnalité ou tout changement de comportement MUST passer par le flux Spec Kit :
  `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`
  → `/speckit-implement` → `/speckit-converge`. Aucun code de production sans `spec.md` validé.
- Le contrat (comportement, paramètres, retours, erreurs) MUST être défini avant l'implémentation et
  reste la source de vérité : si le comportement change, la spec est modifiée d'abord (diapo 89).
- Chaque spec MUST lister ses exigences non fonctionnelles (performance, robustesse, sécurité,
  intégrité, tolérance aux pannes, maintenabilité) avec une métrique et un seuil (diapos 13 à 25).
- Les métriques servent au suivi et MUST NOT devenir l'objectif (diapo 16) : un seuil est un minimum,
  pas une cible à atteindre en écrivant des tests vides.

**Rationale** : l'IA est une machine probabiliste ; un contrat écrit et vérifiable est le seul moyen de
garder le contrôle sur du code généré (diapos 87 à 90).

### II. Tests obligatoires, écrits en premier (NON NÉGOCIABLE)

- Le développement MUST suivre le TDD : le test qui décrit le comportement attendu est écrit, échoue,
  puis le code le fait passer, puis on refactore (diapo 79). Cela vaut pour le code écrit par une IA.
- La pyramide MUST être respectée (diapo 77) : beaucoup de tests unitaires, moins de tests
  d'intégration, très peu de tests end-to-end, ces derniers construits sur les parcours utilisateur
  de la spec (diapo 75).
- Un test MUST être déterministe, isolé des autres tests et indépendant de leur ordre (diapos 68, 71).
  Pas d'horloge, d'aléatoire ni de réseau non maîtrisés.
- Un test MUST suivre Arrange / Act / Assert ou Given / When / Then, avoir un nom qui se lit comme une
  spécification et utiliser des données nommées plutôt que des valeurs en dur (diapos 69, 70).
- Les mocks MUST rester aux frontières (services externes, horloge, réseau) ; le code interne est
  testé réel (diapo 72). Les tests d'intégration MUST tester le code dans son vrai contexte (diapo 74).
- Le score de tests par mutation MUST rester ≥ 90 % et la couverture des lignes et
  des branches MUST NOT baisser (diapos 71, 73).
- Un défaut connu non corrigé MUST être décrit par un test marqué « échec attendu » (`it.failing`,
  `@Disabled` avec raison, etc.), converti en test normal dans le changement qui le corrige.

**Rationale** : un bug en production coûte cher (diapo 67) ; une couverture de 100 % ne prouve rien
sans assertions, d'où la mutation (diapo 73).

### III. Code lisible

- Les noms MUST exprimer l'intention sans commentaire, être prononçables et cohérents dans tout le
  projet ; un même concept garde le même nom ; les fonctions contiennent un verbe ; les booléens
  commencent par `is`/`has`/`can` ; les unités figurent dans le nom si besoin (diapos 37, 38).
- Les conventions du langage MUST être respectées et la mise en forme MUST être automatisée par un
  formateur (diapos 37, 39).
- Un commentaire MUST compléter le code, jamais le paraphraser ; aucun code commenté n'est commité
  (diapo 40).
- Une fonction MUST tenir en 30 lignes, avoir une complexité cyclomatique
  ≤ 10 et au plus 3 paramètres ; l'imbrication est remplacée par des gardes
  (diapos 41, 43, 46).
- Un fichier de code, tests compris, MUST NOT dépasser 1000 lignes ; au-delà de 400 lignes,
  son découpage MUST être envisagé et le choix de ne pas découper justifié en revue. Une ligne MUST NOT
  dépasser 120 caractères (diapo 41). Seuls les fichiers générés sont exclus.
- La duplication de logique MUST être supprimée, sans créer de mauvaise abstraction (diapo 42).
- Aucune valeur métier en dur : constantes nommées ou configuration (diapo 45).
- La visibilité MUST être la plus restreinte possible (diapo 44). Les paramètres de sortie sont
  interdits (diapo 43).
- La complexité en temps MUST être raisonnée : pas de calcul coûteux dans une boucle évitable
  (diapo 47). KISS, DRY, YAGNI et Fail fast s'appliquent (diapo 48).

**Rationale** : le code est écrit pour être lu (diapo 173).

### IV. Architecture hexagonale et SOLID

- Le code MUST être séparé en couches : domaine (modèle et règles métier), application (use cases et
  ports), infrastructure (implémentation des ports *driven* : repositories, API externes), présentation
  (implémentation des ports *driving* : API REST, UI) (diapos 96 à 103).
- Le domaine MUST NOT dépendre de l'infrastructure, de la présentation ni d'un framework ; les
  dépendances pointent vers le domaine.
- Les dépendances MUST être injectées (constructeur, composition root), jamais instanciées dans le code
  métier ni obtenues par un singleton (diapo 125). La composition est préférée à l'héritage (diapo 48).
- Chaque entité MUST avoir une seule responsabilité (S), s'étendre sans être modifiée (O), être
  substituable par ses implémentations et sous-types (L), dépendre d'interfaces petites et ciblées (I),
  dépendre d'abstractions et non de détails (D) (diapos 120 à 125).
- Un design pattern MUST répondre à un problème présent, nommé dans le plan (diapo 105, YAGNI).

**Rationale** : couplage faible, séparation des responsabilités et testabilité indépendante du
contexte (diapo 97).

### V. Types et états valides

- Le code MUST être typé strictement : mode strict du compilateur, pas de type « fourre-tout »
  (`any`, `Object`, casts non vérifiés) sans justification écrite (diapos 61, 63).
- Les ensembles fermés MUST être des enums ou des unions ; un état incohérent MUST être impossible à
  représenter (diapo 61).
- Les données MUST être immuables par défaut ; les entités modifient leur état uniquement par des
  méthodes qui protègent leurs invariants (diapo 60).
- L'absence de valeur MUST être explicite et traitée (`null`/`undefined`/`Optional`) (diapo 59).

**Rationale** : une erreur détectée à la compilation ne coûte rien.

### VI. Erreurs, robustesse et intégrité

- Une exception MUST NOT être étouffée : elle est traitée explicitement ou propagée, et journalisée
  (diapo 57).
- Toute entrée externe MUST être validée côté serveur à la frontière, avec une erreur explicite
  (diapos 22, 167).
- Une opération dont un prérequis échoue MUST être refusée avant toute modification de l'état : pas de
  succès partiel (diapos 17, 48).
- Les données MUST rester cohérentes entre elles : une seule source de vérité par information
  (diapo 17).
- Un appel à un système externe MUST avoir un délai maximal et un comportement défini en cas d'échec
  (diapos 20, 21).

**Rationale** : un échec silencieux devient un bug en production.

### VII. Observabilité

- Le code de production MUST journaliser via un logger structuré injecté, jamais via `console.log`,
  `print` ou équivalent (diapo 62).
- Les logs MUST permettre de comprendre un incident (contexte, identifiants) et MUST NOT contenir de
  données sensibles (mots de passe, jetons, données personnelles).
- La destination des logs MUST être configurable (fichier, sortie standard collectée par la
  plateforme, service externe).

**Rationale** : les logs sont la principale source d'information en production (diapo 62).

### VIII. Sécurité

- Chaque spec et chaque plan MUST examiner les catégories de l'OWASP Top 10 (version en vigueur)
  concernées (diapos 165, 166).
- Requêtes paramétrées ou ORM obligatoires, aucune concaténation de données entrantes dans une
  requête (diapo 167).
- Aucun secret dans le code ni dans le dépôt ; pas d'identifiants par défaut ; mots de passe hachés
  avec un algorithme adapté (bcrypt, argon2) (diapos 168, 169).
- Les permissions MUST être vérifiées côté serveur ; les données sont classées par sensibilité et
  chiffrées quand elles sont sensibles (diapo 169).
- Les dépendances MUST être justifiées, à jour et auditées (chaîne d'approvisionnement logicielle).

**Rationale** : la sécurité se mesure par rapport au risque et commence par des règles simples dans le
code (diapo 165).

### IX. API REST

*S'applique dès que le projet expose une API HTTP.*

- Les URL MUST désigner des ressources, pas des actions ; les verbes HTTP portent l'action et `GET`
  MUST NOT modifier l'état (diapos 133, 135).
- Les codes de retour MUST être exacts : 200, 201 (avec en-tête `Location`), 204 (sans contenu), 400,
  401 (non authentifié), 403 (non autorisé), 404, 409 (conflit d'état), 500 (diapo 134).
- Le format des erreurs MUST être uniforme dans toute l'API.
- L'API MUST être sans état (diapo 130) et décrite par un contrat OpenAPI écrit avant le code
  (diapo 137). Un changement incompatible MUST passer par une nouvelle version (diapo 136).

### X. Performance

- Le code MUST NOT bloquer le fil d'exécution principal : entrées/sorties asynchrones, pas d'attente
  active (diapo 58).
- Une optimisation MUST être justifiée par une mesure avant/après, liée à une exigence non
  fonctionnelle de la spec (diapo 25).

## Contraintes techniques

- Stack : Node.js, TypeScript, Express 4 ; tests avec Jest, ts-jest et supertest ; tests par mutation
  avec Stryker. Gestionnaire de paquets : pnpm (pas de `npm install` ni de `package-lock.json`).
- Règles propres à la stack :
  - `strict: true` dans `tsconfig.json` (sources, scripts et tests) ; `readonly` par défaut ; pas de
    `as unknown as` ; toute Promise attendue ou gérée (`no-floating-promises`).
  - ESLint + typescript-eslint avec les seuils du principe III, et un formateur (Prettier).
  - Le seuil de mutation de 90 % est le seuil `break` de `stryker.config.json` ; il ne peut être
    abaissé que par amendement de cette constitution.
  - Tout changement touchant les performances MUST être mesuré avec `pnpm load` avant et après.
- Règles propres au projet :
  - **Dérogation transitoire au principe IX (contrat d'API actuel)** : tant que l'étape 3 de
    `docs/plan-refactoring.md` (`feat!: RESTful API contract`) n'est pas faite, le contrat actuel
    MUST être conservé à l'identique : routes `POST /rent`, `POST /return`, `GET /stations`,
    `GET /rentals/:id`, clés JSON `msg`, `ref`, `el`, `km`, codes HTTP et corps de réponse actuels.
    Un commit `refactor:` MUST NOT modifier ce contrat ; seule l'étape 3 le change, déclarée comme
    changement de comportement, spécifiée, documentée dans le README et accompagnée des tests mis à
    jour. Cette dérogation est retirée par amendement dans le changement qui termine l'étape 3.
  - **Code legacy** : le code existant ne respecte pas encore les principes IV, VII et X ni
    l'outillage obligatoire ; `docs/plan-refactoring.md` est le chemin de mise en conformité et ses
    étapes sont suivies dans l'ordre, sauf justification. Le code nouveau ou modifié MUST respecter
    la constitution.
  - Les données restent en mémoire et les services externes (paiement, géolocalisation,
    anti-fraude) restent simulés, sauf décision explicite consignée dans une spec.
  - Les tests `it.failing` restants MUST correspondre uniquement à des défauts listés dans
    `docs/demarche-qualite.md`.
  - La documentation (README, `docs/`) est rédigée en français.
- Outillage obligatoire : formateur et linter configurés avec les seuils du principe III (taille des
  fonctions et des fichiers, longueur de ligne, complexité, paramètres), tests avec
  couverture, tests par mutation, analyse statique externalisée (SonarQube ou équivalent) avec quality
  gate (diapos 50, 80).
- Toute nouvelle dépendance MUST être justifiée dans le plan, avec l'alternative écartée.
- La configuration (ports, URL, seuils, secrets) MUST venir de l'environnement, jamais du code.
- L'environnement d'exécution SHOULD être reproductible (Docker ou équivalent) (diapos 53, 54).
- La documentation (README, `docs/`) MUST être à jour quand le comportement, les commandes ou la
  structure changent.

## Workflow et portes qualité

1. Un commit MUST avoir une seule intention : structure (`refactor:`) **ou** comportement (`feat:`,
   `fix:`), jamais les deux. Messages au format Conventional Commits.
2. Une revue MUST être petite et avoir un contexte clair ; découper au besoin (diapo 143).
3. Avant d'intégrer, toutes ces portes MUST être vertes, en local et en intégration continue
   (diapos 150, 151) : build, linter, vérification des types, tests (unitaires, intégration, E2E),
   couverture sans baisse, mutation ≥ 90 %, quality gate de l'analyse statique.
4. La revue de code MUST répondre aux 5 questions de la diapo 142 : besoin fonctionnel, exigences non
   fonctionnelles, clean code, tests, architecture. Elle apporte plus que l'outillage automatique
   (diapo 144).
5. Le code et les tests générés par une IA MUST être relus par un humain avant d'être intégrés : la
   confiance n'exclut pas le contrôle (diapo 88). Une IA ne valide pas seule ses propres tests.

## Governance

- Cette constitution prévaut sur toute autre pratique du projet. En cas de conflit avec un autre
  document, la constitution s'applique et le document est corrigé.
- Amendement : uniquement via `/speckit-constitution`, avec rapport d'impact, dans un commit séparé
  (`docs: amend constitution to vX.Y.Z`).
- Versionnement sémantique : MAJOR pour retirer ou affaiblir un principe, MINOR pour en ajouter ou
  l'étendre, PATCH pour une clarification.
- Toute dérogation MUST être écrite dans le plan (section Complexity Tracking) avec l'alternative plus
  simple écartée. Une dérogation non écrite est une violation.
- `/speckit-analyze` traite toute contradiction avec cette constitution comme CRITICAL.

**Version**: 2.0.0 | **Ratified**: 2026-11-03 | **Last Amended**: 2026-11-04
