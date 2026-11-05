# Data Model: Services externes asynchrones (étape 2d)

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Les entités du domaine (`Station`, `Bike`, `User`, `Rental`) **ne changent pas**. Elles sont décrites
dans `specs/001-couche-hexagonales/data-model.md`. Cette étape ajoute un composant d'application en
mémoire, `OperationsInProgress`, et fait évoluer les ports vers les services externes.

## OperationsInProgress (application, en mémoire, une instance par application)

Il enregistre les opérations commencées mais pas encore terminées, pour que les requêtes concurrentes en
conflit soient refusées (spec, US2 ; research, R3). Il n'est jamais persisté et repart vide à chaque
`createApplication()`.

| Donnée | Type | Règle |
|--------|------|-------|
| `reservedBikeIds` | ensemble d'identifiants de vélos | un vélo réservé n'est proposé à aucune autre location (FR-005) |
| `rentingUserIds` | ensemble d'identifiants d'utilisateurs | un utilisateur présent compte comme `AlreadyRenting` (FR-007) |
| `returningRentalIds` | ensemble d'identifiants de locations | une location présente compte comme `AlreadyReturned` (FR-008) |
| `promisedSlotsByStation` | nombre par station | ajouté aux vélos présents pour décider `StationFull` (FR-009) |

Opérations, toutes synchrones :

| Opération | Effet | Libération |
|-----------|-------|------------|
| `startRental(userId, bikeId)` | réserve le vélo et marque l'utilisateur | `finishRental(userId, bikeId)` dans un `finally` |
| `startReturn(rentalId, stationId)` | marque la location et promet une place | `finishReturn(rentalId, stationId)` dans un `finally` |
| `isBikeReserved(bikeId)`, `isRenting(userId)`, `isReturning(rentalId)`, `promisedSlotsAt(stationId)` | lecture | — |

Invariants :

- chaque réservation est libérée exactement une fois, quelle que soit l'issue (succès, refus, erreur,
  durée dépassée) ;
- un `startRental` n'est fait qu'après toutes les vérifications de la location, sans `await` entre la
  dernière vérification et la réservation (de même pour `startReturn`).

## Ports modifiés

| Port | Avant (2c) | Après (2d) |
|------|------------|------------|
| `Clock` | `now(): number` | `now(): number`, `wait(durationMs): Promise<void>` |
| `PaymentGateway` | `preAuthorize(...)` et `capture(...)` synchrones | mêmes signatures, renvoient des `Promise` des mêmes résultats |
| `LocationService` | `describe(...): LocationDescription` | `describe(...): Promise<LocationDescription>` ; zone `'north' \| 'south' \| ''` et météo `'clear' \| 'rain' \| ''` (`''` seulement quand la durée maximale est dépassée, commit 3) |
| `FraudScreening` | `scoreOf(user, amount): number` | `assess(user, amount): Promise<FraudAssessment>` (commit 3) ; `scoreOf(...): Promise<number>` aux commits 1 et 2 |
| `FleetNotifier` | `rentalCreated`, `rebalancingRequested` synchrones | mêmes méthodes, renvoient `Promise<void>` |
| Repositories | synchrones | inchangés (research, R1) |

`FraudAssessment` (commit 3) : `{ isAvailable: true, score: number } | { isAvailable: false }`. Le cas
d'utilisation « louer » refuse la location (`FraudSuspected`) quand l'évaluation est indisponible.

## Durées maximales (commit 3)

| Constante | Valeur | Service |
|-----------|--------|---------|
| `PAYMENT_MAXIMUM_DURATION_MS` | 3 000 | pré-autorisation et capture (chaque appel) |
| `GEOLOCATION_MAXIMUM_DURATION_MS` | 1 000 | géolocalisation |
| `FRAUD_SCREENING_MAXIMUM_DURATION_MS` | 1 000 | anti-fraude |
| `FLEET_NOTIFICATION_MAXIMUM_DURATION_MS` | 1 000 | notifications de flotte |

Ce sont des constantes nommées, regroupées dans un objet `MaximumDurations` que le point d'assemblage
passe aux décorateurs, et que les tests peuvent remplacer (FR-018).

## Cas d'utilisation : changements de signature

| Cas d'utilisation | Avant | Après |
|-------------------|-------|-------|
| `RentBike.execute` | `Result<RentalStarted, RentRefusal>` | `Promise<Result<RentalStarted, RentRefusal>>` ; dépend aussi de `OperationsInProgress` |
| `ReturnBike.execute` | `Result<RentalReturned, ReturnRefusal>` | `Promise<…>` ; dépend aussi de `OperationsInProgress` |
| `GetRental.execute` | `Result<RentalDetails, …>` | inchangé : synchrone, car il n'appelle aucun service externe |
| `ListStations.execute` | `StationOverview[]` | `Promise<StationOverview[]>` |

Les raisons de refus (`RentRefusal`, `ReturnRefusal`, `RentalLookupRefusal`) et les valeurs renvoyées
sont inchangées.
