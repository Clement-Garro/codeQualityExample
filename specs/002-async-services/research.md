# Research: Services externes asynchrones (étape 2d)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-05

Le contexte technique ne contient aucune inconnue : la stack est imposée par la constitution et aucune
dépendance n'est ajoutée. Les décisions ci-dessous portent sur la façon de passer à l'attente non
bloquante **sans changer le comportement** (US1, US2, US4), puis d'ajouter les durées maximales (US3).
Chacune a été vérifiée sur le code de `main` au commit `1d6b753`.

## R1. Quels ports deviennent asynchrones

- **Decision** : les ports vers les **services externes** deviennent asynchrones et renvoient des
  promesses : `PaymentGateway`, `LocationService`, `FraudScreening`, `FleetNotifier`. Les
  **repositories restent synchrones** (stockage en mémoire). Les quatre cas d'utilisation et les routes
  HTTP deviennent asynchrones.
- **Rationale** : seule l'attente des services externes bloque le serveur (principe X). Garder les
  repositories synchrones permet de lire et de modifier les données sans interruption entre deux
  `await`. Toute la cohérence sous concurrence (R3) repose sur cette propriété.
- **Alternatives considered** : rendre aussi les repositories asynchrones, pour préparer une vraie base
  de données. C'est inutile tant que les données restent en mémoire (hypothèse de la spec), et chaque
  `await` ajouté ouvrirait une fenêtre de concurrence supplémentaire à protéger.

## R2. Une seule source de temps : `Clock.now()` et `Clock.wait(ms)`

- **Decision** : le port `Clock` gagne une méthode `wait(durationMs): Promise<void>`, à côté de `now()`.
  Les adaptateurs simulés attendent avec `clock.wait(...)` au lieu de `busyWait(...)`. `SystemClock`
  implémente `wait` avec un minuteur dont le `unref()` évite de retenir l'arrêt du processus.
- **Rationale** : la même horloge fournit l'heure (durées de location) et les attentes (latences
  simulées, durées maximales). Une horloge de test peut ainsi faire avancer les deux ensemble, sans
  remplacer l'horloge globale (FR-013).
- **Alternatives considered** :
  - un port `Scheduler` séparé : deux sources de temps qu'un test devrait garder synchronisées ;
  - les faux minuteurs de Jest : ils remplacent les fonctions globales, ce que FR-013 interdit, et se
    combinent mal avec supertest.

## R3. Cohérence sous concurrence : réserver avant le premier `await`

- **Decision** : un composant de l'application, `OperationsInProgress`, enregistre en mémoire :
  - les vélos réservés ;
  - les utilisateurs dont une location est en cours de création ;
  - les locations en cours de retour ;
  - par station, le nombre de places promises à des retours en cours.

  Il est partagé par `RentBike` et `ReturnBike`, et injecté par le point d'assemblage.
  - **Louer** : toutes les vérifications actuelles sont faites, dans le même ordre et sans `await`. Un
    vélo réservé ne compte pas comme disponible, et un utilisateur en cours de location compte comme
    `AlreadyRenting`. La réservation est prise **dans le même bloc synchrone, juste après la dernière
    vérification et avant l'appel à l'anti-fraude**. Elle est libérée dans un `finally`, que la location
    soit créée, refusée, ou qu'une erreur survienne.
  - **Rendre** : une location en cours de retour donne `AlreadyReturned`. Les places promises comptent
    dans la vérification de la station pleine. La marque de retour et la place promise sont posées avant
    l'appel de capture, et libérées dans un `finally`.
- **Rationale** : JavaScript n'exécute qu'un fil à la fois. Entre deux `await`, aucune autre requête ne
  peut s'intercaler. Vérifier puis réserver sans `await` intermédiaire suffit donc pour qu'une seule
  requête gagne. Le perdant reçoit le refus qu'il aurait reçu en arrivant juste après le gagnant
  (FR-010), refusé immédiatement, sans réessayer (hypothèse de la spec). Le `finally` empêche qu'un vélo
  ou un utilisateur reste bloqué (section Sécurité de la spec).
- **Alternatives considered** :
  - **un nouveau statut `Reserved` sur le vélo** : il modifierait le modèle de données et la liste des
    stations, ce qui serait un comportement visible ;
  - **un verrou global** sérialisant toutes les locations : il annulerait une partie du gain de l'US1 ;
  - **une revérification après chaque `await`** : elle est plus fragile, avec deux chemins de refus pour
    un même conflit.

## R4. Ce que voit la liste des stations pendant une location

- **Decision** : un vélo réservé reste listé comme disponible jusqu'à la création de la location.
- **Rationale** : une consultation qui se croise avec une location est « avant » ou « après » elle. Les
  deux réponses existent déjà aujourd'hui, et la spec n'exige que la cohérence des écritures.
- **Alternatives considered** : masquer les vélos réservés. Ce serait un état intermédiaire nouveau,
  visible par les clients, qui n'existe pas aujourd'hui.

## R5. Géolocalisations en même temps et ordre conservé (FR-004)

- **Decision** : `ListStations` lance la géolocalisation de toutes les stations en même temps
  (`Promise.all`) sur la liste des stations dans l'ordre des données. Le résultat suit le même ordre.
- **Rationale** : la durée d'une consultation devient celle d'une seule géolocalisation, soit environ
  300 ms au lieu de 1,2 s (SC-008), et `Promise.all` conserve l'ordre de son entrée.
- **Alternatives considered** : géolocaliser les stations l'une après l'autre. Cette option a été écartée
  à la clarification (Q2).

## R6. Routes Express asynchrones et réponses d'erreur par défaut

- **Decision** : chaque route asynchrone est enveloppée pour transmettre une promesse rejetée à
  `next(error)`. Express renvoie alors sa réponse 500 par défaut, comme aujourd'hui pour des données
  incohérentes.
- **Rationale** : Express 4 n'attrape pas les promesses rejetées. Sans cette enveloppe, une erreur
  laisserait la requête sans réponse et produirait un rejet non géré. Le test existant « answers 500
  when the data is corrupted » protège ce comportement.
- **Alternatives considered** :
  - passer à Express 5, qui gère les promesses : c'est un changement de dépendance hors périmètre ;
  - attraper les erreurs dans chaque route : la logique serait dupliquée.

## R7. Durées maximales (US3) : décorateurs dans l'infrastructure

- **Decision** : chaque port externe est enveloppé par un décorateur à durée maximale, dans
  `src/infrastructure/timeouts/`. Il met en concurrence l'appel et `clock.wait(maximumDurationMs)`.
  Quand la durée est dépassée, il journalise
  `warn('external service timeout', { service, maximumDurationMs })` (FR-012) et renvoie la valeur
  d'échec du port, d'après la clarification Q1 :

  | Port | Valeur renvoyée quand la durée est dépassée | Effet pour le client |
  |------|---------------------------------------------|----------------------|
  | `PaymentGateway.preAuthorize` | `{ isApproved: false, reason: 'payment gateway timeout' }` | `402 payment declined`, vélo libéré |
  | `PaymentGateway.capture` | `{ isCaptured: false }` | location clôturée, `captured: false`, aucun débit |
  | `FraudScreening.assess` | `{ isAvailable: false }` | `403 refused` (le cas d'utilisation refuse par prudence) |
  | `LocationService.describe` | `{ zone: '', weather: '' }` | station listée avec une zone et une météo inconnues |
  | `FleetNotifier.*` | (rien) | réponse inchangée, seul le journal le signale |

  Pour que le refus par prudence reste une règle de l'application, le port `FraudScreening` renvoie une
  évaluation (`{ isAvailable: true, score } | { isAvailable: false }`) au lieu d'un nombre. Les durées
  maximales sont des constantes nommées, injectées par le point d'assemblage (FR-018).
- **Rationale** :
  - les cas d'utilisation ne connaissent pas la notion de délai : ils reçoivent un refus qu'ils savent
    déjà traiter, sauf l'anti-fraude indisponible, nouveau cas explicite ;
  - un seul mécanisme sert à tous les services ;
  - les décorateurs se testent seuls, avec une doublure qui ne répond jamais.
- **Alternatives considered** :
  - mettre la durée maximale dans chaque adaptateur simulé : le code serait dupliqué et mélangé à la
    simulation ;
  - la mettre dans les cas d'utilisation : la règle « durée maximale » se mélangerait au métier ;
  - renvoyer un score de fraude maximal en cas de délai : la décision de refus serait cachée dans
    l'infrastructure.

## R8. Temps maîtrisé dans les tests, en deux temps (US4)

- **Decision** :
  - **Commit 1 (US4)** : `busyWait` et `simulateHttpCall` reçoivent l'horloge injectée et lisent
    `clock.now()` au lieu de `Date.now()`. Les tests utilisent une horloge de test injectée
    (`tests/support/testClock.ts`), qui avance de 1 ms à chaque lecture, comme l'horloge rapide
    actuelle mais sans remplacer `Date.now`. `tests/support/fastClock.ts` est supprimé.
    `createApplication` accepte une horloge en option.
  - **Commit 2 (US1+US2)** : l'horloge de test gagne `wait(ms)`. Par défaut, elle « saute » à l'échéance
    de la prochaine attente et la résout au tour suivant de la boucle d'événements, ce qui revient à
    avancer automatiquement. Les attentes concurrentes se résolvent dans l'ordre de leurs échéances. Un
    mode manuel (`advance(ms)`) sert aux tests qui vérifient une latence ou une durée maximale.
- **Rationale** :
  - FR-017 impose l'US4 en premier, alors que l'attente active n'existe pas encore en asynchrone ;
    injecter l'horloge dans l'attente active livre l'US4 seule, sans changer de comportement ;
  - les tests d'intégration gardent leurs requêtes, leurs attentes et `clock.advanceMinutes(45)`, avec
    seulement une mise en place différente (FR-015) ;
  - le saut automatique rend chaque attente instantanée tout en faisant vraiment se chevaucher les
    requêtes concurrentes.
- **Alternatives considered** :
  - livrer l'US4 après l'US1 : c'est contraire à FR-017 ;
  - des faux minuteurs globaux : c'est contraire à FR-013 ;
  - des attentes réelles plus courtes dans les tests : la suite serait lente et non déterministe.

## R9. Tests de concurrence (FR-016)

- **Decision** :
  - **Au niveau des cas d'utilisation** : les doublures de `PaymentGateway` peuvent **retenir** une
    réponse (une promesse que le test résout lui-même). On lance la requête A, elle reste en attente du
    paiement ; on lance la requête B, on vérifie qu'elle est refusée ; puis on libère A et on vérifie
    l'état final.
  - **Au niveau HTTP** : deux requêtes supertest lancées ensemble (`Promise.all`) sur la même
    application, avec l'horloge de test en saut automatique.
- **Rationale** : un test de concurrence qui passerait aussi avec des requêtes traitées l'une après
  l'autre ne prouve rien (exigences de test de la spec). Retenir la réponse du paiement garantit que les
  deux requêtes se chevauchent vraiment.
- **Alternatives considered** : des boucles de requêtes concurrentes nombreuses en espérant une
  collision. C'est non déterministe, et donc contraire au principe II.

## R10. Mesures de performance

- **Decision** :
  - les mesures de référence `pnpm load` sont prises au début de l'étape, sur `main` ;
  - après le commit 2 : la latence maximale de 20 `GET /stations` simultanés, en médiane de 3
    exécutions, doit être inférieure à 2 s (SC-001) ;
  - une consultation seule, mesurée en temps réel par le test E2E et par un script de mesure, doit être
    inférieure à 0,5 s (SC-008) ;
  - une consultation pendant une location en cours, mesurée par un test d'intégration avec un paiement
    retenu, doit être inférieure à 1,5 s (SC-002).
- **Rationale** : principe X, avec une mesure avant et après. Les tests unitaires et d'intégration
  n'attendent jamais le temps réel (FR-014), donc les durées réelles se mesurent avec `pnpm load` et
  le test E2E.
- **Alternatives considered** : mesurer dans les tests unitaires. Le résultat dépendrait de la machine
  et ne serait pas déterministe.

## R11. Livraison

- **Decision** : trois commits, chacun dans sa propre demande de fusion (FR-017, clarification Q1) :
  1. `refactor: inject the clock into simulated delays and tests` (US4) ;
  2. `refactor: wait for external services without blocking` (US1 et US2) ;
  3. `feat: give every external call a maximum duration` (US3). C'est un nouveau comportement, d'où
     le préfixe `feat:`.
- **Rationale** : une intention par commit (constitution, « Workflow », point 1), et des revues petites
  (point 2).
- **Alternatives considered** : un seul commit. Il mélangerait structure et comportement.
