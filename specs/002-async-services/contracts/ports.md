# Contrats internes : ports asynchrones (étape 2d)

Mise à jour de `specs/001-couche-hexagonales/contracts/ports.md`. Seuls les éléments qui changent sont
décrits ici ; le reste (repositories, lignes de journal existantes, responsabilités) est inchangé.

## Ports *driving* (cas d'utilisation)

| Cas d'utilisation | Signature après 2d | Garanties ajoutées |
|-------------------|--------------------|--------------------|
| `RentBike` | `execute(input): Promise<Result<RentalStarted, RentRefusal>>` | un vélo réservé n'est proposé à personne d'autre ; un utilisateur en cours de location reçoit `AlreadyRenting` ; la réservation est libérée dans tous les cas |
| `ReturnBike` | `execute(input): Promise<Result<RentalReturned, ReturnRefusal>>` | une location en cours de retour reçoit `AlreadyReturned` ; les places promises comptent pour `StationFull` ; débit et dépôt du vélo au plus une fois |
| `ListStations` | `execute(): Promise<StationOverview[]>` | stations géolocalisées en même temps, résultat dans l'ordre des données |
| `GetRental` | inchangé (synchrone) | — |

L'ordre des vérifications et les raisons de refus sont inchangés.

## Ports *driven*

| Port | Opérations après 2d | Garanties |
|------|---------------------|-----------|
| `Clock` | `now()`, `wait(durationMs): Promise<void>` | seule source de temps de l'application ; `SystemClock` : `Date.now()` et un minuteur non bloquant (`unref`) |
| `PaymentGateway` | `preAuthorize(account, amount): Promise<PreAuthorizationResult>`, `capture(account, reference, amount): Promise<CaptureResult>` | résultats inchangés ; un refus reste un résultat, jamais une exception |
| `LocationService` | `describe(latitude, longitude): Promise<LocationDescription>` | zone et météo vides (`''`) seulement quand la durée maximale est dépassée (commit 3) |
| `FraudScreening` | commits 1 et 2 : `scoreOf(user, amount): Promise<number>` ; commit 3 : `assess(user, amount): Promise<FraudAssessment>` | `{ isAvailable: false }` quand la durée maximale est dépassée ; le cas d'utilisation refuse alors la location |
| `FleetNotifier` | `rentalCreated(rentalId): Promise<void>`, `rebalancingRequested(stationId): Promise<void>` | ne rejette jamais ; attendu avant la réponse (ordre des journaux conservé) |

## Durées simulées (inchangées, FR-002)

| Adaptateur simulé | Attente |
|-------------------|---------|
| `SimulatedPaymentGateway` | 800 ms, plus l'appel HTTP simulé de 200 ms, par opération |
| `SimulatedLocationService` | 300 ms |
| `SimulatedFraudScreening` | 200 ms |
| `SimulatedFleetNotifier` | 100 ms (location créée), 150 ms (rééquilibrage) |

Toutes les attentes passent par `Clock.wait` ; `busyWait` est supprimé au commit 2.

## Décorateurs à durée maximale (commit 3)

| Décorateur | Enveloppe | Valeur quand la durée est dépassée |
|------------|-----------|------------------------------------|
| `PaymentGatewayWithMaximumDuration` | `PaymentGateway` | `preAuthorize` : `{ isApproved: false, reason: 'payment gateway timeout' }` ; `capture` : `{ isCaptured: false }` |
| `LocationServiceWithMaximumDuration` | `LocationService` | `{ zone: '', weather: '' }` |
| `FraudScreeningWithMaximumDuration` | `FraudScreening` | `{ isAvailable: false }` |
| `FleetNotifierWithMaximumDuration` | `FleetNotifier` | rien (la notification est abandonnée) |

## Lignes de journal

Les lignes existantes sont inchangées, et leur ordre relatif dans une même requête est conservé. Les
lignes de requêtes différentes peuvent s'entrelacer. Le commit 3 ajoute une ligne :

| Ligne | Émise par | Quand |
|-------|-----------|-------|
| `[WARN] external service timeout {"service":"<nom>","maximumDurationMs":<durée>}` | décorateur à durée maximale, via `Logger` | durée maximale dépassée (FR-012) |
