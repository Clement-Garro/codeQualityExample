# bike-rental-legacy Constitution

## Core Principles

### I. Comportement préservé, une intention par changement

- Un changement MUST avoir un seul objectif : soit modifier la structure (renommage,
  refactoring), soit modifier le comportement (correction de bug, nouvelle fonctionnalité).
  Les deux ne se mélangent jamais dans le même commit.
- Un changement structurel MUST laisser le comportement observable strictement identique :
  mêmes codes HTTP, mêmes corps de réponse, mêmes effets sur les données.
- Le contrat de l'API (routes, clés JSON comme `msg`, `ref`, `el`, `km`, codes de statut)
  MUST NOT changer sans être déclaré explicitement comme changement de comportement, documenté
  dans le README et accompagné de tests mis à jour.
- On comprend et on documente avant de modifier : tout comportement touché MUST être décrit
  dans le README ou dans la spécification de la fonctionnalité.

**Rationale** : sur du code legacy, mélanger structure et comportement rend impossible de
savoir si une régression vient d'un refactoring ou d'une correction.

### II. Filet de tests obligatoire (NON NÉGOCIABLE)

- Aucun code de production n'est modifié sans tests qui couvrent le comportement concerné.
  Pour une correction de bug, le test qui décrit le comportement attendu MUST exister avant
  le correctif (un test `it.failing` existant compte).
- La stratégie suit la pyramide : beaucoup de tests unitaires, moins de tests d'intégration
  (application Express réelle via supertest, sans mock), très peu de tests E2E (vrai serveur).
- Seuls les services externes (paiement, et tout futur appel réseau) MAY être mockés dans les
  tests unitaires. Les modules internes (utilitaires, données en mémoire) restent réels.
- Le score de mutation Stryker MUST rester ≥ 90 % (seuil `break` de `stryker.config.json`) ;
  il ne doit pas baisser par rapport à la branche principale sans justification écrite.
- Chaque test MUST être isolé (rechargement des modules, données initiales), indépendant de
  l'ordre d'exécution, nommé comme une spécification (« refuses a user with less than 5 of
  credit ») et structuré préparer / agir / vérifier, avec des données nommées (`ALICE`,
  `REPUBLIQUE`) plutôt que des valeurs en dur.
- Un défaut connu non corrigé MUST être décrit par un test `it.failing`. Quand le défaut est
  corrigé, `.failing` MUST être retiré dans le même changement.

**Rationale** : la couverture dit quelles lignes s'exécutent ; seuls des tests de qualité
(mesurée par mutation) permettent de refactorer sans peur.

### III. Une seule source de vérité

- Chaque règle métier (tarification, seuil de crédit, montant de pré-autorisation, score de
  fraude, statuts des vélos) MUST être définie à un seul endroit et réutilisée partout.
- Les valeurs métier MUST être des constantes nommées (`30`, `0.15`, `2.5`, `1440`, `25`,
  `0.8`, `5`, `100` n'apparaissent pas en littéral dans la logique).
- Les ensembles de valeurs fermés (statuts des vélos, abonnements) MUST être représentés par
  des `enum` ou des unions de types, jamais par des nombres ou chaînes magiques.

**Rationale** : le tarif codé trois fois a produit une estimation incohérente avec le prix
facturé (0,14 au lieu de 0,15).

### IV. Échouer tôt, jamais en silence

- Une exception ou un échec d'un service externe MUST NOT être avalé (`catch` vide interdit).
  Il est soit traité explicitement, soit propagé, et dans tous les cas journalisé.
- Une opération dont un prérequis échoue (ex. pré-autorisation refusée) MUST être refusée
  avant toute modification de l'état ; l'API répond par un code d'erreur et un corps JSON,
  jamais par un succès partiel.
- Les entrées MUST être validées à la frontière HTTP (champs manquants, vides, nuls, de
  mauvais type, identifiants inconnus) avec un code 4xx explicite.
- Les données MUST rester cohérentes : un vélo est dans au plus une station, une station ne
  dépasse pas sa capacité, un crédit n'est pas débité au-delà de ce qui a été autorisé.

**Rationale** : l'échec de pré-autorisation ignoré et les erreurs de capture avalées créent
des locations sans paiement et des crédits négatifs.

### V. Code lisible, typé et découpé

- Les noms MUST exprimer l'intention, être prononçables et cohérents dans tout le projet ;
  les fonctions contiennent un verbe, les booléens commencent par `is`/`has`, les unités
  figurent dans le nom quand elles ne sont pas évidentes (`durationMinutes`).
- Un commentaire complète le code et ne duplique pas ce que le nom dit déjà.
- Le code nouveau ou modifié MUST être typé explicitement (`Station`, `Bike`, `User`,
  `Rental`) ; `any` est interdit dans le code nouveau. La cible est le mode `strict` de
  TypeScript.
- Les responsabilités MUST être séparées : HTTP (handlers), règles métier, accès aux données
  et services externes vivent dans des unités distinctes. Une fonction a un seul rôle ;
  l'imbrication profonde est remplacée par des gardes (retour anticipé).

**Rationale** : des handlers monolithiques à dix niveaux de `if` et sans types rendent chaque
modification risquée et chaque bug difficile à localiser.

### VI. Event loop non bloquée

- Le code de production MUST NOT bloquer le thread de Node.js : pas d'attente active, pas de
  traitement synchrone long. Les appels aux services (même simulés) sont asynchrones.
- Les calculs coûteux (tri, recherches) MUST être faits hors des boucles quand c'est possible
  et sur des structures adaptées.
- Tout changement touchant les performances MUST être vérifié avec `pnpm load`.

**Rationale** : l'attente active actuelle sérialise toutes les requêtes ; `GET /stations`
coûte à lui seul environ 1,2 s.

## Contraintes techniques

- Stack : Node.js, TypeScript, Express 4 ; tests avec Jest, ts-jest, supertest ; mutation avec
  Stryker. Le gestionnaire de paquets est pnpm (pas de `npm install` ni de `package-lock.json`).
- Les données restent en mémoire et les services externes (paiement, géolocalisation,
  anti-fraude) restent simulés, sauf décision explicite consignée dans une spécification.
- Toute nouvelle dépendance MUST être justifiée dans le plan de la fonctionnalité.
- La configuration (port, seuils) SHOULD venir de constantes ou de variables d'environnement,
  pas de valeurs codées en dur dans `src/index.ts`.
- La journalisation SHOULD passer par un logger structuré plutôt que `console.log`.
- La documentation du projet (README, `docs/`) est rédigée en français et MUST être mise à
  jour quand le comportement, les commandes ou la structure changent.

## Workflow et portes qualité

Avant d'intégrer un changement sur `main`, toutes ces portes MUST être vertes :

1. `pnpm build` compile sans erreur.
2. `pnpm test` passe (unitaires, intégration, E2E), les tests `it.failing` restants
   correspondant uniquement à des défauts encore listés dans `docs/demarche-qualite.md`.
3. `pnpm test:coverage` ne fait pas baisser la couverture des lignes ni des branches.
4. `pnpm test:mutation` reste au-dessus du seuil de 90 %.
5. Le message de commit et la description indiquent si le changement est structurel ou
   comportemental (Principe I).

Les refactorings suivent l'ordre de priorité de `docs/demarche-qualite.md` (section
« Prochaines étapes ») sauf justification. Chaque fonctionnalité passe par le flux Spec Kit
(`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`), et le plan
MUST contenir une vérification de conformité à cette constitution.

## Governance

- Cette constitution prévaut sur toute autre pratique du projet. En cas de conflit avec le
  README ou `docs/`, la constitution s'applique et le document en désaccord est corrigé.
- Amendement : toute modification passe par `/speckit-constitution`, est décrite dans le
  rapport d'impact en tête de fichier, et est commitée séparément du code
  (`docs: amend constitution to vX.Y.Z`).
- Versionnement sémantique : MAJOR pour la suppression ou la redéfinition incompatible d'un
  principe ; MINOR pour l'ajout d'un principe ou d'une section ou un élargissement notable ;
  PATCH pour les clarifications et corrections de forme.
- Conformité : chaque plan (`plan.md`) vérifie les principes avant et après la conception ;
  chaque revue de code vérifie les portes qualité. Toute dérogation MUST être justifiée par
  écrit dans le plan (section de suivi de la complexité) avec l'alternative plus simple
  rejetée.
- Pour les consignes d'exécution au quotidien, se référer au README et à
  `docs/demarche-qualite.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-03 | **Last Amended**: 2026-11-03
