# Contrats internes : ports (étape 2c)

Interfaces définies du côté de l'application (`src/application/ports/`). Le domaine n'en dépend pas ;
les adaptateurs de `src/infrastructure/` les implémentent ; la présentation appelle les ports
*driving*. Chaque port est petit : un consommateur ne reçoit que ce qu'il utilise (FR-010). Les
signatures exactes sont fixées par les tests, en TDD ; ce document fixe les responsabilités et les
garanties.

## Ports *driving* (cas d'utilisation)

| Cas d'utilisation | Entrée | Succès | Refus (enum) |
|-------------------|--------|--------|--------------|
| `RentBike` | `{ userId, stationId, requestedBikeId \| null }` | location, vélo, nom de station, montant pré-autorisé, référence | `RentRefusal` |
| `ReturnBike` | `{ rentalId, stationId }` | location, minutes, prix, nom de station, capture réussie ou non | `ReturnRefusal` |
| `GetRental` | `rentalId` | `RentalDetails` | `RentalLookupRefusal` |
| `ListStations` | aucune | `StationOverview[]` | aucun |

Garanties communes :

- L'ordre des vérifications est celui d'aujourd'hui (spec, cas limites) ; le premier refus rencontré
  est renvoyé.
- Un refus ne modifie **aucune** donnée et ne consomme pas d'identifiant de location.
- Des données incohérentes (utilisateur ou vélo d'une location introuvable) lèvent
  `InconsistentDataError` avant toute modification.

## Ports *driven*

| Port | Opérations | Adaptateur 2c | Garanties |
|------|------------|---------------|-----------|
| `StationRepository` | `findById`, `findAll` | en mémoire | ordre des données initiales |
| `BikeRepository` | `findById`, `findDockedAt(stationId)`, `countDocked()`, `save` | en mémoire | `findDockedAt` dans l'ordre des données ; seule source d'emplacement |
| `UserRepository` | `findById`, `save` | en mémoire | |
| `RentalRepository` | `findById`, `findAll`, `hasOpenRentalFor(userId)`, `nextId()`, `save` | en mémoire | `nextId` démarre à 1 par instance ; `findAll` sert à la mise en place des tests d'intégration (vérifier qu'aucune location n'est créée) |
| `PaymentGateway` | `preAuthorize(account, amount)`, `capture(account, reference, amount)` | simulé | résultats discriminés, jamais d'exception pour un refus ; mêmes règles et durées qu'aujourd'hui (R4, R5) |
| `LocationService` | `describe(latitude, longitude)` → `{ zone, weather }` | simulé (300 ms) | mêmes seuils (48,85 ; 2,36) |
| `FraudScreening` | `scoreOf(user, amount)` | simulé (200 ms) + politique du domaine | |
| `FleetNotifier` | `rentalCreated(rentalId)`, `rebalancingRequested(stationId)` | simulé (100 ms / 150 ms) + `Logger.info` | mêmes lignes de journal |
| `Logger` | `info(message, context)`, `warn(message, context)` | `ConsoleLogger` | format `[LEVEL] message <JSON du contexte>` inchangé |
| `Clock` | `now()` | `SystemClock` (`Date.now()`) | compatible avec l'horloge rapide des tests |

## Lignes de journal conservées (FR-003, FR-016)

| Ligne | Émise par | Quand |
|-------|-----------|-------|
| `[WARN] broken bike at station <bikeId>` | `RentBike` via `Logger` | pour chaque vélo cassé de la station, après les vérifications utilisateur et station, avant le choix du vélo |
| `[WARN] payment declined {"userId":…,"amount":…,"reason":"…"}` | `RentBike` via `Logger` | pré-autorisation refusée |
| `[INFO] preauth done "<ref>"` | `PaymentGateway` simulé | après chaque pré-autorisation simulée (avant la décision) |
| `[INFO] capture done "<ref>"` | `PaymentGateway` simulé | capture réussie |
| `[INFO] rental created <rentalId>` | `FleetNotifier` simulé | location créée |
| `[INFO] rebalancing triggered <stationId>` | `FleetNotifier` simulé | seuil de rééquilibrage dépassé |
