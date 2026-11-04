# Research: Découpage en couches hexagonales (étape 2c)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-04

Le contexte technique ne contenait aucune inconnue (stack imposée par la constitution, aucune
dépendance ajoutée). Les recherches portent sur les choix de conception qui permettent de découper
**sans changer le comportement**. Chaque décision a été vérifiée sur le code de `main` (`247f66f`).

## R1. Forme des entités du domaine

- **Decision** : classes à champs `readonly`, constructeur privé, fabriques statiques (`create` pour
  un nouvel objet, `restore` pour recharger un enregistrement existant). Chaque transition d'état
  (`bike.checkOut()`, `bike.dockAt(station, distanceKm)`, `rental.complete(...)`, `user.debit(amount)`)
  vérifie son invariant et **renvoie une nouvelle instance** ; une transition invalide lève
  `DomainRuleViolation` sans rien modifier.
- **Rationale** : principe V (immuable par défaut, état modifié uniquement par des méthodes qui
  protègent les invariants, état incohérent impossible à construire) et FR-006 / FR-007. Une instance
  ne peut pas être modifiée « dans le dos » d'un repository, ce qui supprime une classe de bugs du
  code actuel (objets partagés modifiés en place).
- **Alternatives considered** : interfaces `readonly` + fonctions pures (n'importe qui peut construire
  un objet invalide par décomposition `{ ...bike, status }`, invariants non protégés) ; classes
  mutables à état privé (contredit « immuable par défaut »).

## R2. Refus métier et erreurs

- **Decision** : un cas d'utilisation renvoie un résultat discriminé
  `{ isSuccess: true, value } | { isSuccess: false, refusal }`, où `refusal` est une valeur d'un enum
  par opération (`RentRefusal`, `ReturnRefusal`, `RentalLookupRefusal`). Les violations d'invariant et
  les données incohérentes restent des exceptions (`DomainRuleViolation`, `InconsistentDataError`) :
  ce sont des bugs, pas des cas métier.
- **Rationale** : FR-014 (raison nommée, pas de code HTTP dans l'application) ; la présentation
  traduit chaque refus en code et `msg` dans **une seule table** (FR-015). Les exceptions non
  attendues continuent d'atteindre le gestionnaire d'erreurs par défaut d'Express, ce qui conserve le
  comportement actuel (500 pour des données incohérentes, 400 pour un JSON mal formé).
- **Alternatives considered** : exceptions métier attrapées par un middleware d'erreurs (une raison de
  refus deviendrait un flux d'exception, et un middleware global changerait le corps des 500
  actuels) ; renvoyer directement `{ status, msg }` depuis l'application (couplage au HTTP, contraire
  au principe IV et au but de l'étape 3).

## R3. Une seule source de vérité pour l'emplacement des vélos

- **Decision** : `Bike.stationId: number | null` (`null` pendant une location) est la seule donnée
  d'emplacement ; `Station` perd `bikeIds`. Les vélos présents dans une station, ses places libres et
  le total utilisé par le rééquilibrage sont **déduits** par `BikeRepository.findDockedAt(stationId)` /
  `countDocked()`.
- **Rationale** : principe VI et FR-009. Équivalence vérifiée : aujourd'hui `station.bikeIds` contient
  exactement les vélos dont `stationId` vaut la station et qui ne sont pas loués (test
  `lists in each station exactly the bikes located there`, mise à jour symétrique à la location et au
  retour). Un vélo loué garde aujourd'hui son ancien `stationId` mais il est exclu partout (statut
  « loué ») : le passer à `null` ne change aucune réponse. L'ordre des vélos d'une station reste
  l'ordre des données, ce qui préserve le départage « premier listé » à kilométrage égal.
- **Alternatives considered** : garder `bikeIds` comme source et déduire `stationId` (le choix du vélo,
  la liste et le retour lisent tous le vélo ; il faudrait inverser toutes les recherches) ; garder les
  deux synchronisés par le repository (la duplication demeure).

## R4. Responsabilités du paiement et débit du crédit

- **Decision** : port `PaymentGateway` avec `preAuthorize(account, amount)` et
  `capture(account, reference, amount)`, qui renvoient des résultats discriminés
  (`{ isApproved: true, reference } | { isApproved: false, reason }`,
  `{ isCaptured: true, reference } | { isCaptured: false }`). L'adaptateur simulé reprend exactement
  les règles actuelles (refus si crédit < montant puis si liste noire ; capture refusée si montant
  négatif) et les mêmes attentes. **Le débit du crédit est fait par le cas « rendre »**
  (`user.debit(price)` puis sauvegarde) seulement si la capture a réussi.
- **Rationale** : le crédit est une donnée du domaine, il ne doit pas être modifié par un adaptateur
  externe. Ordre et effets identiques à aujourd'hui : capture puis débit, aucun débit si la capture
  échoue, location clôturée dans tous les cas, `captured: false` dans la réponse. `refundPayment`,
  jamais appelé, n'est pas repris (YAGNI, hypothèse de la spec).
- **Alternatives considered** : l'adaptateur débite via le repository des utilisateurs (un adaptateur
  externe modifierait une donnée métier, dépendance infrastructure → infrastructure) ; garder les
  exceptions de l'ancien module (le `catch {}` vide de la capture resterait, contraire au principe VI).

## R5. Attentes simulées (attente active)

- **Decision** : `busyWait(ms)` (l'actuel `sleep`) et `simulateHttpCall` vivent dans
  `src/infrastructure/simulated/` et ne sont appelés que par les adaptateurs simulés, avec les mêmes
  durées : pré-autorisation et capture 800 + 200 ms, localisation 300 ms, anti-fraude 200 ms,
  notification de location créée 100 ms, demande de rééquilibrage 150 ms.
- **Rationale** : FR-002 et cas limite « les attentes simulées gardent leur durée actuelle » ; NFR de
  performance (pas de régression > 10 %) ; l'étape 2d mesure le gain de l'asynchrone et ne doit pas
  être faussée. Le domaine et l'application restent purs (aucune attente).
- **Alternatives considered** : supprimer les attentes dès maintenant (empiète sur 2d et fausse sa
  mesure de référence) ; les laisser dans les cas d'utilisation (l'application dépendrait d'un détail
  de simulation).

## R6. Anti-fraude : règle du domaine, service simulé

- **Decision** : le calcul du score est une politique pure du domaine (`computeFraudScore`). Le port
  `FraudScreening.scoreOf(user, amount)` est implémenté par un adaptateur simulé qui attend 200 ms
  puis applique la politique du domaine.
- **Rationale** : FR-005 (la règle de fraude est testable seule) et constitution (« anti-fraude »
  listé parmi les services externes simulés) ; l'attente actuelle de `computeFraudScore` est
  conservée (R5).
- **Alternatives considered** : appeler la politique directement depuis le cas d'utilisation (perte
  des 200 ms, cf. R5) ; mettre la règle dans l'adaptateur (non testable sans infrastructure).

## R7. Journalisation et notifications

- **Decision** : port `Logger` (`info(message, context)`, `warn(message, context)`) implémenté par
  `ConsoleLogger`, qui produit **exactement** le format actuel
  `[LEVEL] message JSON.stringify(context)` via `console.log`. Port `FleetNotifier`
  (`rentalCreated(rentalId)`, `rebalancingRequested(stationId)`) implémenté par un adaptateur simulé
  qui attend (100 ms / 150 ms) puis journalise `rental created` / `rebalancing triggered`. L'alerte
  « vélo cassé » et le refus de paiement passent par `Logger.warn` dans le cas « louer » (FR-016).
- **Rationale** : FR-003 (mêmes lignes de journal, vérifiées par les tests unitaires actuels) et
  FR-012 (aucune dépendance globale dans l'application). L'étape 2e n'aura qu'à remplacer
  l'adaptateur par un logger structuré.
- **Alternatives considered** : garder la fonction globale `log` (dépendance non injectée) ; adopter
  le logger structuré maintenant (hors périmètre, étape 2e, changerait le format des lignes).

## R8. Horloge

- **Decision** : port `Clock.now(): number` implémenté par `SystemClock` (`Date.now()`). Le domaine
  reçoit les instants en paramètre (`Rental.open({ startTime })`, `rental.complete({ endTime })`,
  `computeDurationMinutes(start, end)`).
- **Rationale** : le domaine ne lit plus l'heure lui-même (testable seul, FR-005). `SystemClock`
  lisant `Date.now()`, l'horloge rapide des tests (`useFastClock`) continue de fonctionner sans
  changement ; la supprimer reste une tâche de 2d.
- **Alternatives considered** : `Date.now()` direct dans les cas d'utilisation (dépendance cachée) ;
  supprimer l'horloge rapide maintenant (impossible tant que l'attente active existe, 2d).

## R9. Point d'assemblage et isolation

- **Decision** : `createApplication(seed = createSeedData())` dans `src/compositionRoot.ts` crée des
  repositories en mémoire neufs (copie des données initiales, compteur de locations à 1), les
  adaptateurs, les cas d'utilisation et l'application HTTP, et renvoie `{ app, repositories }`.
  `src/index.ts` exporte `app = createApplication().app` et démarre le serveur (inchangé pour le E2E
  et `pnpm load`).
- **Rationale** : FR-012 et FR-013 ; chaque test obtient des données neuves sans
  `jest.resetModules()` (règle le point ouvert « isolation des tests »).
- **Alternatives considered** : conteneur d'injection (bibliothèque) : dépendance non justifiée pour
  une dizaine d'objets ; singletons de module (état global partagé, contraire à FR-012).

## R10. Stratégie de commits et migration des tests

- **Decision** : découpage « étrangleur » en 4 commits `refactor:`, chacun vert sur toutes les portes :
  1. **P1** : création de `src/domain/` (entités, politiques, constantes, enums). `handlers.ts`
     délègue toutes ses décisions au domaine via une conversion temporaire enregistrement ↔ entité.
     `businessRules.ts`, `types.ts` et les fonctions métier de `utils.ts` disparaissent.
  2. **P2** : ports dans `src/application/ports/`, adaptateurs dans `src/infrastructure/`, première
     version du point d'assemblage. `handlers.ts` devient `createHandlers(deps)` ; `db.ts` et
     `payment.ts` disparaissent ; `bikeIds` est supprimé. **Seul commit qui modifie la mise en place
     des tests d'intégration** (création via `createApplication()`, 4 accès aux données via
     `repositories`).
  3. **P3** : extraction des 4 cas d'utilisation dans `src/application/useCases/` ; les gestionnaires
     ne font plus que les appeler.
  4. **P4** : `src/presentation/http/` (validation, mise en forme, table des refus, routes) ;
     suppression de `handlers.ts` et du reste de `utils.ts`.
- **Rationale** : FR-004 ; chaque étape est petite et relisible (constitution, workflow point 2) ; les
  tests d'intégration et E2E servent de filet à chaque commit.
- **Alternatives considered** : un seul gros commit (diff impossible à relire) ; écrire la nouvelle
  architecture à côté et basculer à la fin (duplication de toute la logique pendant 3 commits).

## R11. Validation des entrées

- **Decision** : `hasRequiredFields` et les conversions `Number(...)` vont dans
  `src/presentation/http/validation.ts`, inchangés. Les cas d'utilisation reçoivent des nombres
  (éventuellement `NaN`, qui donne « introuvable ») et `requestedBikeId: number | null`.
- **Rationale** : cas limites de la spec (`"1"` accepté, `"abc"` → 404, `null` → choix automatique) ;
  la validation stricte (400 pour une chaîne) relève de l'étape 3.
- **Alternatives considered** : valider plus strictement dès maintenant (changement de comportement).
