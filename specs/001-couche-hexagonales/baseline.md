# Mesures de référence (étape 2c)

Mesures prises le 2026-11-04 sur `main` au commit `af729c0` (fusion de la PR #1), avant tout
changement de code de l'étape 2c. Ce sont les valeurs de comparaison des portes qualité de chaque
commit `refactor:` (« couverture sans baisse », « mutation ≥ 90 % », « `pnpm load` ≤ référence + 10 % »).

**Commit de départ** : `af729c0`

## Tests

| Niveau | Nombre | Résultat |
|--------|--------|----------|
| Unitaires (`tests/unit`) | 135 | tous verts |
| Intégration (`tests/integration`) | 13 | tous verts |
| End-to-end (`tests/e2e`) | 2 | tous verts |
| **Total** (`pnpm test`) | **150** | tous verts |

`pnpm build` compile sans erreur.

## Couverture (`pnpm test:coverage`, unitaires et intégration)

| Mesure | Valeur |
|--------|--------|
| Lignes | 100 % |
| Branches | 100 % |
| Fonctions | 100 % |
| Instructions | 100 % |

## Mutation (`pnpm test:mutation`)

| Mesure | Valeur |
|--------|--------|
| Score | **96,56 %** (seuil `break` : 90) |
| Mutants tués | 484 |
| Délais dépassés (comptés comme tués) | 49 |
| Survivants | 19 |
| Sans couverture | 0 |

Détail par fichier : `businessRules.ts` 100 %, `handlers.ts` 99,09 %, `utils.ts` 93,70 %,
`payment.ts` 92,86 %, `db.ts` 90,20 %.

## Performance (`pnpm load` : 20 `GET /stations` en parallèle)

Trois exécutions, sans autre processus lourd en parallèle :

| Exécution | Latence moyenne | Latence maximale |
|-----------|-----------------|------------------|
| 1 | 24 064 ms | 24 092 ms |
| 2 | 24 056 ms | 24 081 ms |
| 3 | 24 057 ms | 24 082 ms |
| **Médiane** | **24 057 ms** | **24 082 ms** |

Seuils pour chaque commit de l'étape 2c (référence + 10 %) : latence moyenne ≤ 26 463 ms, latence
maximale ≤ 26 490 ms. Les requêtes sont traitées les unes après les autres à cause de l'attente active,
corrigée à l'étape 2d.
