# Inventaire des tests unitaires (étape 2c)

Inventaire des 135 tests unitaires avant le refactoring (commit `af729c0`). Chaque ligne reçoit
dans « Repris dans » le fichier qui reprend le cas quand il est déplacé ; une ligne ne peut pas rester
vide quand son fichier d'origine est supprimé. Un cas retiré volontairement porte « retiré : <raison> ».

| Fichier d'origine | describe | it | Repris dans |
|---|---|---|---|
| `tests/unit/db.test.ts` | rental ids | starts at 1 and increments on every call | |
| `tests/unit/db.test.ts` | rental ids | starts again from 1 after a reset | |
| `tests/unit/db.test.ts` | seed data integrity | starts without any rental | |
| `tests/unit/db.test.ts` | seed data integrity | lists in each station exactly the bikes located there | |
| `tests/unit/db.test.ts` | seed data integrity | never puts more bikes in a station than its capacity | |
| `tests/unit/db.test.ts` | seed data integrity | uses unique ids for stations, bikes and users | |
| `tests/unit/db.test.ts` | seed data integrity | only uses known bike statuses | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 400 for an empty body | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 400 for a missing userId | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 400 for a missing stationId | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 400 for an empty userId | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 400 for a null stationId | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 404 for an unknown user | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | answers 404 for an unknown station | |
| `tests/unit/handlers.test.ts` | handleRentBike › input validation | accepts ids sent as numeric strings | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | picks the available bike with the lowest mileage when no bike is requested | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | picks the lowest mileage even when that bike is not the last one listed | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | keeps the first listed bike when two bikes have the same mileage | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | treats a null bikeId as "no preference" | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | rents the requested bike when it is available | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | answers 409 when the requested bike is in maintenance | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | answers 409 when the requested bike is broken | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | answers 409 when the requested bike is parked at another station | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | answers 409 when the requested bike is unknown | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | answers 409 when the station has no available bike | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | warns about broken bikes found at the station | |
| `tests/unit/handlers.test.ts` | handleRentBike › bike selection | does not report bikes in maintenance as broken | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | refuses a second rental while the first one is still open | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | lets the user rent again once the previous bike is returned | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | refuses a user with less than 5 of credit | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | accepts a user with exactly 5 of credit | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | refuses a blacklisted user without contacting the payment gateway | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | refuses a blacklisted premium user, whose fraud score is exactly 100 | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | pre-authorizes 5 for a classic bike | |
| `tests/unit/handlers.test.ts` | handleRentBike › business rules | pre-authorizes 7.50 for an electric bike | |
| `tests/unit/handlers.test.ts` | handleRentBike › successful rental | answers with the rental summary | |
| `tests/unit/handlers.test.ts` | handleRentBike › successful rental | records an open rental | |
| `tests/unit/handlers.test.ts` | handleRentBike › successful rental | marks the bike as rented and removes it from the station | |
| `tests/unit/handlers.test.ts` | handleRentBike › successful rental | gives each rental its own increasing id | |
| `tests/unit/handlers.test.ts` | handleRentBike › successful rental | logs the rental creation | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 400 for an empty body | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 400 for a missing rentalId | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 400 for a missing stationId | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 404 for an unknown rental | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 404 for an unknown station | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 409 when the rental is already closed | |
| `tests/unit/handlers.test.ts` | handleReturnBike › input validation | answers 409 when the return station is full | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 10 min, classic bike, basic user | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 30 min (last minute of the flat price) | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 31 min (first charged minute) | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 45 min | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 45 min on an electric bike | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 45 min for a premium user | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 45 min on an electric bike for a premium user | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 24 h exactly (no penalty yet) | |
| `tests/unit/handlers.test.ts` | handleReturnBike › pricing | charges 24 h and 1 min (late penalty) | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | answers with the return summary | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | closes the requested rental and leaves the other ones open | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | closes a rental that is not the first one in the list | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | captures the price on the pre-authorized payment | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | closes the rental | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | parks the bike at the return station and adds the distance ridden | |
| `tests/unit/handlers.test.ts` | handleReturnBike › successful return | still closes the rental but reports captured: false when the capture fails | |
| `tests/unit/handlers.test.ts` | handleReturnBike › rebalancing | asks for rebalancing when the return station holds 1.5 times the average number of bikes | |
| `tests/unit/handlers.test.ts` | handleReturnBike › rebalancing | does not ask for rebalancing below that threshold | |
| `tests/unit/handlers.test.ts` | handleReturnBike › rebalancing | does not ask for rebalancing when the station is exactly at the threshold | |
| `tests/unit/handlers.test.ts` | handleListStations | describes every station with its available bikes, sorted by mileage | |
| `tests/unit/handlers.test.ts` | handleListStations | no longer lists a rented bike and frees its slot | |
| `tests/unit/handlers.test.ts` | handleGetRental | answers 404 for an unknown rental | |
| `tests/unit/handlers.test.ts` | handleGetRental | shows the requested rental when it is not the first one in the list | |
| `tests/unit/handlers.test.ts` | handleGetRental | shows the running duration and price of an open rental | |
| `tests/unit/handlers.test.ts` | handleGetRental | shows the rental that was asked for when several exist | |
| `tests/unit/handlers.test.ts` | handleGetRental | applies the tariff for a ride within the flat price | |
| `tests/unit/handlers.test.ts` | handleGetRental | applies the tariff for an electric bike | |
| `tests/unit/handlers.test.ts` | handleGetRental | applies the tariff for a premium user | |
| `tests/unit/handlers.test.ts` | handleGetRental | applies the tariff for a rental of exactly 24 hours | |
| `tests/unit/handlers.test.ts` | handleGetRental | applies the tariff for a rental longer than 24 hours | |
| `tests/unit/handlers.test.ts` | handleGetRental | gives a basic user an estimate equal to the price within the first 30 minutes | |
| `tests/unit/handlers.test.ts` | handleGetRental | gives a premium user an estimate equal to the price within the first 30 minutes | |
| `tests/unit/handlers.test.ts` | handleGetRental | freezes the duration and the price once the bike is returned | |
| `tests/unit/handlers.test.ts` | handleRentBike when the payment pre-authorization is declined | refuses the rental with 402 payment declined | |
| `tests/unit/handlers.test.ts` | handleRentBike when the payment pre-authorization is declined | does not record any rental | |
| `tests/unit/handlers.test.ts` | handleRentBike when the payment pre-authorization is declined | leaves the bike available at its station | |
| `tests/unit/handlers.test.ts` | handleRentBike when the payment pre-authorization is declined | does not consume a rental id | |
| `tests/unit/handlers.test.ts` | handleRentBike when the payment pre-authorization is declined | logs the refusal with its reason | |
| `tests/unit/handlers.test.ts` | handleGetRental estimate | gives an estimate equal to the price of the rental | |
| `tests/unit/handlers.test.ts` | inconsistent data | refuses to return a bike whose rental refers to an unknown user, without closing the rental | |
| `tests/unit/handlers.test.ts` | inconsistent data | refuses to return a bike whose rental refers to an unknown bike, without closing the rental | |
| `tests/unit/handlers.test.ts` | inconsistent data | refuses to show a rental that refers to an unknown user | |
| `tests/unit/payment.test.ts` | preAuthorizePayment | authorizes the amount without debiting the user | |
| `tests/unit/payment.test.ts` | preAuthorizePayment | sends the user and the amount to the payment gateway | |
| `tests/unit/payment.test.ts` | preAuthorizePayment | accepts a credit exactly equal to the amount | |
| `tests/unit/payment.test.ts` | preAuthorizePayment | refuses a user whose credit is below the amount | |
| `tests/unit/payment.test.ts` | preAuthorizePayment | refuses a blacklisted user | |
| `tests/unit/payment.test.ts` | preAuthorizePayment | reports insufficient funds before the blacklist | |
| `tests/unit/payment.test.ts` | capturePayment | debits the amount from the user credit | |
| `tests/unit/payment.test.ts` | capturePayment | sends the user, the payment reference and the amount to the payment gateway | |
| `tests/unit/payment.test.ts` | capturePayment | accepts a zero amount | |
| `tests/unit/payment.test.ts` | capturePayment | refuses a negative amount and leaves the credit untouched | |
| `tests/unit/payment.test.ts` | refundPayment | credits the amount back to the user | |
| `tests/unit/payment.test.ts` | refundPayment | sends the user, the payment reference and the amount to the payment gateway | |
| `tests/unit/utils.test.ts` | sleep | blocks for at least the requested duration | |
| `tests/unit/utils.test.ts` | log | prints the level, the message and the serialized context on one line | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns every field is filled when { userId: 1, stationId: 2 } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is zero when { userId: 0, stationId: 2 } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is a non-empty string when { userId: '1', stationId: '2' } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is a non-numeric string when { userId: 'abc', stationId: '2' } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is missing when { userId: 1 } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is null when { userId: 1, stationId: null } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is an empty string when { userId: 1, stationId: '' } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | returns a field is NaN when { userId: 1, stationId: NaN } | |
| `tests/unit/utils.test.ts` | hasRequiredFields | rejects a null object | |
| `tests/unit/utils.test.ts` | hasRequiredFields | rejects a undefined object | |
| `tests/unit/utils.test.ts` | hasRequiredFields | accepts any object when no field is required | |
| `tests/unit/utils.test.ts` | roundToCents | rounds 3.14159 to 3.14 |`tests/unit/domain/money.test.ts` |
| `tests/unit/utils.test.ts` | roundToCents | rounds 4.6000000001 to 4.6 |`tests/unit/domain/money.test.ts` |
| `tests/unit/utils.test.ts` | roundToCents | rounds 0.125 to 0.13 |`tests/unit/domain/money.test.ts` |
| `tests/unit/utils.test.ts` | roundToCents | rounds 10 to 10 |`tests/unit/domain/money.test.ts` |
| `tests/unit/utils.test.ts` | simulateHttpCall | answers 200, echoes the request and returns a payment reference | |
| `tests/unit/utils.test.ts` | getLocationInfo | places (48.867, 2.363) in zone "north" with "clear" weather | |
| `tests/unit/utils.test.ts` | getLocationInfo | places (48.841, 2.322) in zone "south" with "rain" weather | |
| `tests/unit/utils.test.ts` | getLocationInfo | places (48.85, 2.36) in zone "south" with "rain" weather | |
| `tests/unit/utils.test.ts` | getLocationInfo | places (48.851, 2.361) in zone "north" with "clear" weather | |
| `tests/unit/utils.test.ts` | computeFraudScore | scores a premium user with a small amount |`tests/unit/domain/fraud.test.ts` |
| `tests/unit/utils.test.ts` | computeFraudScore | scores a basic user |`tests/unit/domain/fraud.test.ts` |
| `tests/unit/utils.test.ts` | computeFraudScore | scores an amount of exactly 40 |`tests/unit/domain/fraud.test.ts` |
| `tests/unit/utils.test.ts` | computeFraudScore | scores an amount above 40 |`tests/unit/domain/fraud.test.ts` |
| `tests/unit/utils.test.ts` | computeFraudScore | scores a basic user with an amount above 40 |`tests/unit/domain/fraud.test.ts` |
| `tests/unit/utils.test.ts` | computeFraudScore | scores a blacklisted user |`tests/unit/domain/fraud.test.ts` |
| `tests/unit/utils.test.ts` | computeRentalPrice | charges the flat price of 1 for the first 30 minutes |`tests/unit/domain/pricing.test.ts` |
| `tests/unit/utils.test.ts` | computeRentalPrice | adds 2.50 for an electric bike |`tests/unit/domain/pricing.test.ts` |
| `tests/unit/utils.test.ts` | computeRentalPrice | gives premium subscribers 20% off |`tests/unit/domain/pricing.test.ts` |
| `tests/unit/utils.test.ts` | computeRentalPrice | charges a small amount for each minute after the first 30 |`tests/unit/domain/pricing.test.ts` |
| `tests/unit/utils.test.ts` | computeRentalPrice | adds a 25 penalty once the rental exceeds 24 hours |`tests/unit/domain/pricing.test.ts` |
| `tests/unit/utils.test.ts` | computeRentalPrice | uses the billing rate of 0.15 per minute after the first 30 minutes |`tests/unit/domain/pricing.test.ts` |
