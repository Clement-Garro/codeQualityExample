# Data Model: Découpage en couches hexagonales (étape 2c)

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Toutes les entités sont immuables (R1) : chaque transition renvoie une nouvelle instance et lève
`DomainRuleViolation` si son invariant n'est pas respecté. Les valeurs numériques des enums sont
celles stockées aujourd'hui (aucune donnée ne change).

## Enums et types fermés

| Nom | Valeurs | Origine |
|-----|---------|---------|
| `BikeStatus` | `Available = 0`, `Rented = 1`, `Maintenance = 2`, `Broken = 3` | `src/types.ts` (déplacé) |
| `RentalStatus` | `Open = 1`, `Completed = 2` | `src/types.ts` (déplacé) |
| `Subscription` | `'basic'`, `'premium'` (objet `as const`) | `src/types.ts` (déplacé) |
| `RentRefusal` | `UserNotFound`, `StationNotFound`, `NoBikeAvailable`, `AlreadyRenting`, `NotEnoughCredit`, `FraudSuspected`, `PaymentDeclined` | nouveau (R2) |
| `ReturnRefusal` | `RentalNotFound`, `AlreadyReturned`, `StationNotFound`, `StationFull` | nouveau (R2) |
| `RentalLookupRefusal` | `RentalNotFound` | nouveau (R2) |

## Entités

### Station

| Champ | Type | Règle |
|-------|------|-------|
| `id` | entier | unique |
| `name` | texte | |
| `capacity` | entier > 0 | |
| `latitude`, `longitude` | nombres | utilisés par le service de localisation |

- **Changement** : `bikeIds` est supprimé (R3). Les vélos présents et `freeSlotCount = capacity −
  nombre de vélos présents` sont déduits des vélos.
- **Opération** : `hasFreeSlot(dockedBikeCount): boolean` (faux quand
  `dockedBikeCount >= capacity`, ce qui donne `station full`).

### Bike

| Champ | Type | Règle |
|-------|------|-------|
| `id` | entier | unique |
| `stationId` | entier ou `null` | `null` si et seulement si `status = Rented` (source unique d'emplacement) |
| `status` | `BikeStatus` | |
| `kilometers` | entier ≥ 0 | ne diminue jamais |
| `isElectric` | booléen | |

Transitions :

```text
Available ──checkOut()──▶ Rented (stationId = null)
Rented ──dockAt(stationId, distanceKm)──▶ Available (stationId = station, kilometers += distanceKm)
Maintenance, Broken : aucune transition dans ce périmètre
```

- `checkOut()` refuse tout statut autre que `Available`.
- `dockAt()` refuse tout statut autre que `Rented` et une distance négative.

### User

| Champ | Type | Règle |
|-------|------|-------|
| `id` | entier | unique |
| `name` | texte | |
| `credit` | nombre | peut devenir négatif (comportement actuel, point ouvert du plan) |
| `subscription` | `Subscription` | |
| `isBlacklisted` | booléen | |

- `hasMinimumCreditToRent(): boolean` : `credit >= MINIMUM_CREDIT_TO_RENT` (5).
- `debit(amount)` : refuse un montant négatif ; renvoie un utilisateur au crédit diminué.

### Rental

| Champ | Type | Règle |
|-------|------|-------|
| `id` | entier | attribué par le repository, séquentiel à partir de 1, consommé uniquement à la création |
| `userId`, `bikeId`, `startStationId` | entiers | |
| `startTime` | instant (ms) | |
| `paymentReference` | texte | référence de pré-autorisation |
| `preAuthAmount` | nombre | 5, ou 7,50 pour un vélo électrique |
| `isElectric` | booléen | type du vélo au moment de la location (sert au tarif) |
| `status` | `RentalStatus` | |
| `endTime`, `endStationId`, `price` | instant, entier, nombre ou `null` | tous `null` si `Open`, tous renseignés si `Completed` |

Transitions :

```text
Rental.open({...}) ──▶ Open
Open ──complete({ endTime, endStationId, price })──▶ Completed
Completed ──complete──▶ DomainRuleViolation (aucun changement)
```

- `isOpen(): boolean` ; `durationMinutesAt(now)` : durée jusqu'à `now` si ouverte, jusqu'à `endTime`
  sinon.

## Politiques du domaine (fonctions pures)

| Politique | Entrées | Sortie | Règle actuelle conservée |
|-----------|---------|--------|--------------------------|
| `computeDurationMinutes` | début, fin (ms) | minutes entières | `floor((fin − début) / 60 000)` |
| `computeRentalPrice` | minutes, électrique, abonnement | prix arrondi au centime | 1 ; + 0,15/min au-delà de 30 ; + 2,50 électrique ; + 25 au-delà de 24 h ; × 0,8 premium |
| `computePreAuthorizationAmount` | électrique | montant | 5, + 2,50 si électrique |
| `computeFraudScore` | abonnement, liste noire, montant | score | + 30 si montant > 40 ; + 10 si non premium ; + 100 si liste noire |
| `isFraudSuspected` | score | booléen | `score >= 100` |
| `selectBike` | vélos disponibles (ordre des données), vélo demandé ou `null` | vélo ou aucun | demandé s'il est disponible ; sinon le moins kilométré, premier listé à égalité |
| `computeRiddenKilometers` | minutes | km | `floor(minutes / 4)` |
| `isRebalancingNeeded` | vélos à la station, total présent, nombre de stations | booléen | `présents > (total / stations) × 1,5` (strict) |
| `roundToCents` | montant | montant | `round(montant × 100) / 100` |

## Vues de lecture (sorties des cas d'utilisation)

- **StationOverview** : station, `zone` et `weather` (service de localisation), vélos listés
  (disponibles et cassés, triés par kilométrage, tri stable), nombre de vélos libres et électriques
  libres, places libres. La mise en forme JSON (`el`, `km`, `broken`) est faite par la présentation.
- **RentalDetails** : location, minutes, prix (calculé avec l'abonnement actuel de l'utilisateur),
  ouverte ou non.

## Données initiales

`createSeedData()` renvoie une **copie neuve** des 4 stations, 10 vélos et 4 utilisateurs actuels de
`src/db.ts` (sans `bikeIds` ; le `stationId` de chaque vélo est la donnée conservée) et aucune
location. Les tests d'intégrité actuels de `db.test.ts` sont repris sur ces données.
