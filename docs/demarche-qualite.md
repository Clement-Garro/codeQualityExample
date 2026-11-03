# Démarche qualité : pourquoi ces changements

Ce document explique les choix faits sur `bike-rental-legacy` et les relie aux règles du support de cours *Code quality* (les numéros renvoient aux diapos). Il ne répète pas le fonctionnement de l'application ni les commandes : ils sont dans le [README](../README.md).

## Principe directeur

Sur du code legacy, on ne change jamais le comportement et la structure en même temps. Chaque étape a donc un objectif unique et une vérification :

| Étape | Objectif | Change le comportement ? | Vérification |
|---|---|---|---|
| 1. README | Comprendre avant de toucher | Non | Lecture du code |
| 2. Renommage | Rendre le code lisible | Non | Compilation, tests, rejeu de requêtes |
| 3. Tests | Poser un filet de sécurité | Non | Pyramide de tests + tests de mutation |
| 4. Refactoring et corrections | Améliorer la structure, corriger les bugs | Oui | Les tests de l'étape 3 |

Les étapes 1 à 3 sont faites. L'étape 4 est préparée (voir [Prochaines étapes](#prochaines-étapes)).

## 1. Documenter avant de modifier

**Pourquoi** : la maintenabilité, c'est la capacité à « maintenir et corriger l'application » et à « intervenir rapidement sur une application en erreur » (diapo 18). On ne peut ni maintenir ni corriger un code dont on ne sait pas ce qu'il est censé faire.

**Ce qui a été fait** : un README qui décrit le comportement observé (routes, règles métier, tarification) et liste les premières observations de qualité. Il sert de référence pour vérifier ensuite qu'aucun changement n'altère ce comportement.

## 2. Renommage

### Règles appliquées

| Règle de la diapo | Avant | Après |
|---|---|---|
| Le nom représente une intention (diapo 37) | `t`, `t2`, `x`, `acc` | `durationMinutes`, `price`, `selectedBike`, `openRentalCount` |
| Pas besoin de commentaire pour comprendre (diapo 37) | `bl // blacklisted`, `el` | `isBlacklisted`, `isElectric` |
| Être prononçable (diapo 37) | `st`, `endSt`, `cap` | `stationId`, `endStationId`, `capacity` |
| Les fonctions contiennent un verbe (diapo 38) | `money()`, `fraud()`, `geo()`, `priceOf()` | `roundToCents()`, `computeFraudScore()`, `getLocationInfo()`, `computeRentalPrice()` |
| Un même concept garde le même nom (diapo 38) | `e` désignait un vélo, une location ou une erreur selon l'endroit | `bike`, `rental`, `error` partout |
| Rester consistant dans le projet (diapo 37) | `handleRent`, `handleStations`, `handleRentalById` | `handleRentBike`, `handleListStations`, `handleGetRental` (toujours verbe + objet) |

Les booléens commencent par `is` (`isElectric`, `isBlacklisted`) pour se lire comme une question, et les unités apparaissent dans le nom quand elles ne sont pas évidentes (`durationMinutes`, `durationMs`).

### Ce qui n'a volontairement pas été renommé

- **Les clés JSON de l'API** (`msg`, `ref`, `el`, `km`) : elles forment le contrat avec les clients. Les renommer changerait le comportement, ce qui sort du cadre d'un renommage (voir le principe directeur).
- **Les conventions du langage** : `req` / `res` pour Express, `i` / `j` pour les index de boucle. La diapo 37 demande de « respecter les règles du langage », et ces noms sont reconnus par tout développeur JavaScript.
- **Le commentaire sur les codes de statut des vélos** (`0 = available`...) : un nom seul ne peut pas expliquer des nombres magiques. La vraie correction est un `enum` (diapo 61, « Enum plutôt que des String »), qui relève du refactoring.

### Commentaires

Les commentaires que les nouveaux noms rendaient redondants ont été supprimés (`// helpers`, `// price helper`, `// pretends to be an outside http call`). Un commentaire doit « compléter le code, pas dupliquer l'information » (diapo 40).

### Vérification

Un renommage ne doit rien casser. On a donc vérifié trois choses : la compilation TypeScript, les tests existants, et le rejeu de 18 requêtes (cas d'erreur compris) sur l'ancienne et la nouvelle version, avec des réponses strictement identiques.

## 3. Stratégie de test

### Pourquoi une pyramide

Plus un test est haut dans la pyramide, plus il est lent, fragile et difficile à diagnostiquer, mais plus il est proche de l'usage réel. On met donc beaucoup de tests rapides à la base et très peu de tests lents au sommet.

| Niveau | Nombre | Isole quoi | Durée | Ce qu'il prouve |
|---|---|---|---|---|
| Unitaire | 135 | Une fonction ; le paiement (service externe) est mocké | ms | Chaque règle métier est correcte |
| Intégration | 13 | Rien : l'app Express réelle, via supertest | ms | Les modules fonctionnent ensemble (routage, parsing JSON, paiement réel) |
| E2E | 2 | Rien : un vrai serveur HTTP, horloge réelle | secondes | Un parcours utilisateur complet fonctionne |
| Mutation | | | minutes | Les tests détectent réellement les erreurs |

### Tests unitaires

- **Pourquoi mocker le paiement et rien d'autre** : le paiement représente un système externe (passerelle bancaire). Le mocker permet de simuler ses pannes et de vérifier ce qu'on lui envoie. Les utilitaires et la base en mémoire sont gardés réels : ce sont des détails internes, et les mocker rendrait les tests fragiles au moindre refactoring (*loose coupling*, diapo 48).
- **Robustesse** (diapo 22, « résister aux entrées erronées ») : chaque route est testée avec des champs manquants, vides, nuls, des identifiants inconnus et des chaînes à la place de nombres.
- **Intégrité des données** (diapo 17, « garantir la non corruption des données entre elles ») : les données initiales sont vérifiées (chaque station liste exactement les vélos qui s'y trouvent, aucune station au-delà de sa capacité, identifiants uniques).
- **Bornes** : la tarification est testée aux limites (30 et 31 minutes, 24 h et 24 h + 1 min), là où les erreurs `<` / `<=` se cachent.

### Tests d'intégration

Ils vérifient ce que les tests unitaires ne voient pas : le routage Express, le parsing JSON (un corps mal formé renvoie bien 400), et la chaîne complète location, retour, débit du crédit avec le vrai module de paiement.

### Tests E2E

Seulement deux, parce qu'ils sont lents (délais réels de plusieurs secondes) : un parcours complet d'un utilisateur (consulter les stations, louer, suivre, rendre, revérifier) et un cas d'erreur. Rien n'est simulé : c'est la seule preuve que l'application fonctionne comme un client la verrait.

### Tests de mutation

**Pourquoi** : la couverture de code dit quelles lignes sont exécutées, pas si les tests vérifient vraiment le résultat. Stryker introduit de petites erreurs dans le code (un `<` qui devient `<=`, une condition forcée à `true`...) et vérifie qu'au moins un test échoue.

**Ce que ça a apporté** : au premier passage, presque tout le code était déjà exécuté par les tests, mais le score de mutation n'était que de 92 %. Les mutants survivants ont révélé de vrais trous. Par exemple, le choix du vélo le moins kilométré semblait testé, mais dans les données initiales ce vélo est toujours le dernier de la liste : un code qui prenait simplement le dernier vélo passait aussi les tests. Un test avec des kilométrages modifiés a corrigé ça.

**Score actuel : 96,4 %** (94,9 % avant la correction des défauts, 95,7 % après, 95,5 % après la suppression de la duplication du tarif : les deux copies supprimées contenaient une centaine de mutants tous tués, ce qui fait mécaniquement baisser le pourcentage ; 96,4 % après le typage strict), avec un seuil bloquant à 90 % dans `stryker.config.json`. Les mutants restants sont **équivalents**, c'est-à-dire sans effet observable : suppression des délais simulés, noms d'utilisateurs jamais lus, borne `<= 30` ou `< 30` qui donne le même prix à 30 minutes, garde `leastUsedBikeIndex >= 0` alors que `availableBikes[-1]` vaut déjà `undefined`.

Le passage au typage strict a révélé un trou : remplacer la recherche d'une location par `rentals.find(() => true)` (toujours la première) ne faisait échouer aucun test, car tous les tests manipulaient la première location de la liste. L'ancienne boucle gardait la dernière correspondance, ce qui masquait le problème. Deux tests sur une location qui n'est pas la première l'ont comblé. Les mutants qui survivaient dans le chemin du défaut de pré-autorisation sont détectés depuis sa correction.

`src/index.ts` est exclu : il ne contient que le câblage des routes, et certaines mutations y démarreraient un vrai serveur pendant les tests.

### Choix techniques

- **Horloge rapide** (`tests/support/fastClock.ts`) : le code attend avec une boucle active sur `Date.now()`, ce qui bloque le thread unique de Node (diapo 58). Sans cette horloge, la suite prendrait plusieurs minutes et la durée des locations dépendrait de la vitesse de la machine. L'horloge avance d'1 ms à chaque lecture : les attentes deviennent instantanées et `clock.advanceMinutes(45)` simule exactement 45 minutes. On contourne le problème sans modifier le code de production, conformément au principe directeur.
- **Isolation** : chaque test recharge les modules (`jest.resetModules()`) et repart des données initiales. L'ancien fichier de test dépendait de l'ordre d'exécution, ce qui rendait chaque test incompréhensible seul et cassait la suite dès qu'on en déplaçait un.
- **Nommage des tests** : les règles de nommage s'appliquent aussi aux tests. « works » ou « lists stuff » ne disent rien ; « refuses a user with less than 5 of credit » se lit comme une spécification. Chaque test suit la structure préparer / agir / vérifier.
- **Pas de valeurs en dur** (diapo 45) : les identifiants des données de test sont nommés (`ALICE`, `REPUBLIQUE`, `ELECTRIC_BIKE`) plutôt que d'écrire `1` ou `4` partout.
- **Pas de duplication** (diapo 42) : les helpers communs (`rentBike`, `returnBike`, `rentForMinutes`) et les tests paramétrés (`it.each`) évitent de répéter la même mise en place dans des dizaines de tests.

## Défauts identifiés puis corrigés

Ces bugs ont été trouvés pendant la mise en place des tests, mais pas corrigés tout de suite, pour ne pas mélanger correction et mise en place des tests. Chacun a d'abord été décrit par un test marqué `it.failing` : le test exprimait le comportement attendu et échouait tant que le bug existait, ce qui gardait la suite verte tout en rendant le bug visible.

Ils sont corrigés dans un commit `fix:` séparé. Les `.failing` ont été retirés.

| Défaut | Règle enfreinte | Correction | Test |
|---|---|---|---|
| Une location est créée même si la pré-autorisation du paiement échoue, et l'API répond `ok` | Une exception ne doit jamais être étouffée (diapo 57) ; *Fail fast* (diapo 48) | Réponse `402 payment declined` avant toute modification des données, refus journalisé | `handlers.test.ts` : *when the payment pre-authorization is declined* ; `rental-api.test.ts` : *refuses the rental when the real payment gateway declines the pre-authorization* |
| L'estimation de `GET /rentals/:id` diffère du prix facturé | Duplication (diapo 42) : le tarif est codé trois fois, une copie utilise 0,14 au lieu de 0,15 | Tarif de 0,15 partout | `handlers.test.ts` : *gives an estimate equal to the price of the rental* |
| `computeRentalPrice` utilise un tarif différent de la facturation | Même cause | Même correction | `utils.test.ts` : *uses the billing rate of 0.15 per minute* |

## Prochaines étapes

Maintenant que les tests protègent le comportement, le refactoring peut commencer. Par ordre de priorité :

1. ~~**Supprimer la duplication du tarif**~~ (diapo 42, DRY) : fait. `computeRentalPrice` est la seule fonction de calcul du prix et `computeDurationMinutes` la seule de calcul de durée.
2. **Ne plus étouffer les exceptions** (diapo 57) : ne plus ignorer silencieusement un échec de capture (le refus de pré-autorisation est déjà corrigé).
3. ~~**Rendre les états incohérents impossibles**~~ (diapo 61) : fait. Mode `strict` de TypeScript, types `Station`, `Bike`, `User`, `Rental` dans `src/types.ts`, enums `BikeStatus` et `RentalStatus`, `Subscription` en objet constant (un `enum` à valeurs chaînes refuserait les littéraux `'basic'` / `'premium'`). Les gardes impossibles (`user !== null`, `bike !== null`) sont remplacées par un échec immédiat (*fail fast*) si les données sont incohérentes, testé dans *inconsistent data*.
4. **Découper les handlers** (diapos 41 et 46) : une dizaine de niveaux de `if` imbriqués, une complexité cyclomatique élevée et plusieurs rôles par fonction (*separation of concern*, diapo 48).
5. **Remplacer l'attente active par de l'asynchrone** (diapo 58) : aujourd'hui une requête bloque tout le serveur, ce qui pose un problème de performance (diapo 25) visible avec `pnpm load`.
6. ~~**Extraire les valeurs en dur**~~ (diapo 45) : fait. Les valeurs métier sont des constantes nommées dans `src/businessRules.ts` (`PRICE_PER_EXTRA_MINUTE`, `MINIMUM_CREDIT_TO_RENT`, `FRAUD_REFUSAL_SCORE`...). Restent volontairement en littéral : les statuts (remplacés par des `enum` à l'étape 3), les délais simulés (supprimés à l'étape 5) et les codes HTTP.
7. **Utiliser un vrai logger** à la place de `console.log` (diapo 62) et ajouter un linter (diapo 50) pour faire respecter ces règles automatiquement.
