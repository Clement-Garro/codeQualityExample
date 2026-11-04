# Quickstart : valider le découpage en couches (étape 2c)

Guide de vérification, à dérouler **avant le premier commit** (mesures de référence) puis **après
chacun des 4 commits** P1 à P4. Les références : [spec](spec.md), [contrat HTTP](contracts/current-api.openapi.yaml),
[ports](contracts/ports.md), [modèle](data-model.md).

## Prérequis

- Node.js et pnpm installés, dépendances à jour : `pnpm install`.
- Sous Windows, les scripts Spec Kit demandent Git Bash ; les commandes `pnpm` fonctionnent partout.
- Partir d'un arbre propre sur la branche de la fonctionnalité.

## 0. Mesures de référence (avant P1)

```bash
pnpm test                 # tous verts (150 après 2b, dont 13 intégration et 2 E2E)
pnpm test:coverage        # noter lignes et branches (attendu : 100 % / 100 %)
pnpm test:mutation        # noter le score (attendu ≥ 90 %, 96,38 % après 2b)
pnpm load                 # noter latence moyenne et maximale
```

Noter les quatre valeurs dans la description du premier commit ou dans `docs/plan-refactoring.md`.

## 1. Portes qualité après chaque commit

| Vérification | Commande | Résultat attendu |
|--------------|----------|------------------|
| Compilation stricte | `pnpm build` | aucune erreur |
| Tous les tests | `pnpm test` | tout vert |
| Couverture | `pnpm test:coverage` | lignes et branches ≥ référence (100 %) |
| Mutation | `pnpm test:mutation` | score ≥ 90 % |
| Performance | `pnpm load` | moyenne et maximum ≤ référence + 10 % |

## 2. Contrat HTTP inchangé (SC-001)

```bash
git diff main -- tests/integration tests/e2e
```

- **P1, P3, P4** : le diff de ces dossiers est **vide**.
- **P2** : seul changement autorisé, la mise en place du test d'intégration (création via
  `createApplication()`, accès au crédit de Carol, à la liste des locations et au crédit d'un
  utilisateur via `repositories`). Aucune requête ni aucun `expect` ne change. `tests/e2e` reste
  identique.

Vérification manuelle facultative, serveur lancé avec `pnpm start` :

```bash
curl -s localhost:3000/stations                                   # 4 stations, champs free/electric/slots/bikes
curl -s -X POST localhost:3000/rent -H 'Content-Type: application/json' -d '{"userId":1,"stationId":1}'
# attendu : {"msg":"ok","rentalId":1,"bikeId":4,"station":"Republique","preAuth":7.5,"ref":"REF…"}
curl -s localhost:3000/rentals/abc                                # attendu : 404 {"msg":"no rental"}
```

## 3. Architecture (SC-004, SC-005, SC-006)

Après P4 :

```bash
# Le domaine ne dépend d'aucune autre couche ni d'un framework : aucun résultat attendu
grep -rnE "from '(\.\./)+(application|infrastructure|presentation)|from 'express'" src/domain

# L'application ne dépend ni de l'infrastructure ni de la présentation : aucun résultat attendu
grep -rnE "from '(\.\./)+(infrastructure|presentation)|from 'express'" src/application

# La présentation ne contient ni constante métier ni accès aux données : aucun résultat attendu
grep -rnE "businessRules|Repository|seedData" src/presentation

# Les anciens modules ont disparu : aucun résultat attendu
ls src/handlers.ts src/utils.ts src/db.ts src/payment.ts src/types.ts src/businessRules.ts 2>/dev/null
grep -rnE "src/(handlers|utils|db|payment|types|businessRules)'" src tests scripts

# Une seule source d'emplacement : aucun résultat attendu
grep -rn "bikeIds" src tests
```

## 4. Tests du domaine sans HTTP ni stockage (SC-004)

```bash
pnpm jest tests/unit/domain
```

Les fichiers de `tests/unit/domain/` n'importent que `src/domain/` (vérifiable par
`grep -rn "from '../../../src/" tests/unit/domain | grep -v "src/domain"` : aucun résultat).

## 5. Isolation (FR-013)

Le test unitaire du point d'assemblage crée deux applications, loue un vélo dans la première et
vérifie que la seconde liste toujours l'état initial et attribue la location n° 1.
