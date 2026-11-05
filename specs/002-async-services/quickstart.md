# Quickstart : valider l'étape 2d

Guide de vérification, à dérouler **avant le premier commit** (mesures de référence) puis **après chacun
des 3 commits**. Références : [spec](spec.md), [contrat HTTP](contracts/current-api.openapi.yaml),
[ports](contracts/ports.md), [modèle](data-model.md).

## Prérequis

- Node.js et pnpm installés, dépendances à jour : `pnpm install`.
- Partir de `main` à jour, sur la branche de la demande de fusion en cours (FR-017).

## 0. Mesures de référence (avant le commit 1)

```bash
pnpm test                 # tous verts (317 à la fin de 2c : 302 unitaires, 13 intégration, 2 E2E)
pnpm test:coverage        # lignes et branches (attendu : 100 % / 100 %)
pnpm test:mutation        # score (attendu ≥ 90 %, 99,54 % à la fin de 2c)
pnpm load                 # 3 fois : médianes des latences moyenne et maximale (≈ 24 s)
```

Noter aussi la durée de `pnpm test` hors E2E (environ 11 s, SC-005) et la durée d'une consultation seule
des stations (environ 1,2 s, SC-008), mesurée avec `curl -w '%{time_total}'` sur le serveur lancé avec
`pnpm start`.

## 1. Portes qualité après chaque commit

| Vérification | Commande | Résultat attendu |
|--------------|----------|------------------|
| Compilation stricte | `pnpm build` | aucune erreur |
| Tous les tests | `pnpm test` | tout vert |
| Couverture | `pnpm test:coverage` | 100 % lignes et branches |
| Mutation | `pnpm test:mutation` | ≥ 90 % |
| Durée des tests | `pnpm jest tests/unit tests/integration` (3 fois) | ≤ référence, mêmes résultats (SC-005) |
| Relecture humaine | revue du diff | 5 questions de la diapo 142 |

## 2. Contrat inchangé (SC-004)

```bash
git diff main -- tests/e2e            # vide à chaque commit
git diff main -- tests/integration    # commit 1 : mise en place seulement (horloge de test) ; ensuite : ajouts seulement
```

Les 13 tests d'intégration d'origine gardent leurs requêtes et leurs `expect` (compter `request(app)` et
`expect(` avant et après, comme à la clôture de 2c).

## 3. Temps maîtrisé (commit 1, US4)

```bash
ls tests/support/fastClock.ts                                   # absent
grep -rn "spyOn(Date" tests                                     # aucun résultat : l'horloge globale n'est plus remplacée
grep -rn "Date.now()" src | grep -v src/infrastructure/systemClock.ts   # aucun résultat
```

## 4. Attente non bloquante et concurrence (commit 2, US1 et US2)

```bash
grep -rn "busyWait" src tests                                   # aucun résultat
pnpm jest tests/unit/application tests/integration              # tests de concurrence verts
pnpm load                                                       # 3 fois : médiane de la latence maximale < 2 s (SC-001)
```

Avec le serveur lancé (`pnpm start`) :

```bash
curl -s -o /dev/null -w '%{time_total}\n' localhost:3000/stations    # < 0,5 s (SC-008)
```

SC-002 (une consultation pendant un paiement, < 1,5 s) est vérifié par un test d'intégration qui retient le
paiement, et en temps réel en lançant `curl .../stations` pendant un `curl -X POST .../rent`.

## 5. Durées maximales (commit 3, US3)

```bash
pnpm jest tests/unit/infrastructure/timeouts                     # chaque décorateur : valeur de repli et ligne de journal
```

Les tests des cas d'utilisation vérifient les réponses de la clarification Q1 avec des doublures qui ne
répondent jamais : `402 payment declined`, `403 refused`, zone et météo vides, `captured: false`, et
notification ignorée.
