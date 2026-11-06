# Feature Specification: Services externes asynchrones (étape 2d)

**Feature Branch**: `002-async-services`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Étape 2d du plan : passage en asynchrone"

## Contexte

L'étape 2d de `docs/plan-refactoring.md` remplace l'attente active des services externes simulés
(paiement, géolocalisation, anti-fraude, notifications de flotte) par une attente qui ne bloque pas
le serveur (constitution, principe X). Aujourd'hui, chaque appel « externe » occupe tout le serveur :
20 consultations simultanées de la liste des stations prennent environ 24 s, car elles sont traitées
l'une après l'autre (`specs/001-couche-hexagonales/baseline.md`).

Cette attente active a un effet de bord qu'il faut préserver : comme une seule requête avance à la
fois, deux demandes ne peuvent jamais se croiser. Une fois l'attente non bloquante, deux locations
simultanées pourraient choisir le même vélo pendant la seconde que dure le paiement, et deux retours
simultanés de la même location pourraient la débiter deux fois. Les garanties actuelles (un vélo loué
une seule fois, une location en cours par utilisateur, une location rendue et débitée une seule fois,
une station jamais au-delà de sa capacité) MUST donc rester vraies quand les requêtes se chevauchent.

Les « utilisateurs » de la fonctionnalité sont les clients de l'API (qui ne doivent plus attendre les
requêtes des autres) et les mainteneurs (qui doivent pouvoir tester le temps sans attendre). Le
contrat d'API actuel est conservé (dérogation transitoire au principe IX) : seule la durée des
réponses change quand plusieurs requêtes sont en cours.

## Clarifications

### Session 2026-11-05

- Q: Quelle réponse le client reçoit-il quand un service externe ne répond pas dans sa durée maximale ?
  → A: Les refus du contrat actuel, sans nouveau code HTTP : paiement → `402 payment declined`,
  anti-fraude → `403 refused` (refus par prudence), géolocalisation → zone et météo inconnues,
  capture → `captured: false`, notifications → ignorées et journalisées.
- Q: Comment livrer l'étape 2d : une demande de fusion par commit, ou une seule pour toute l'étape ?
  → A: Une demande de fusion par commit (US4, puis US1+US2, puis US3), chacune revue et intégrée à
  `main` avant la suivante, comme à l'étape 2c.
- Q: La liste des stations doit-elle géolocaliser ses stations en même temps, ou seulement le pouvoir ?
  → A: Obligatoire : toutes les stations sont géolocalisées en même temps, une consultation seule dure
  moins de 0,5 s, et un test le vérifie.
- Q: Où régler les durées maximales des services externes : constantes nommées dans le code, ou
  variables d'environnement dès 2d ?
  → A: Constantes nommées, injectées par le point d'assemblage et réglables dans les tests ; leur
  lecture depuis l'environnement est faite à l'étape 2e (dérogation écrite dans le plan).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Les requêtes ne s'attendent plus les unes les autres (Priority: P1)

Un cycliste qui consulte les stations pendant qu'un autre cycliste paie sa location obtient sa réponse
sans attendre la fin de ce paiement. Plusieurs requêtes en cours avancent en même temps : chacune ne
dure que le temps de ses propres appels aux services externes.

**Why this priority**: c'est le but de l'étape (principe X) et le gain mesurable par `pnpm load`. Le
reste de la spec en découle : sans attente non bloquante, la concurrence (US2) n'existe pas.

**Independent Test**: lancer 20 consultations simultanées des stations et mesurer la durée de chacune ;
envoyer une consultation pendant une location en cours et mesurer sa durée.

**Acceptance Scenarios**:

1. **Given** 20 clients qui consultent les stations au même moment, **When** les 20 requêtes sont
   traitées, **Then** chacune reçoit la même réponse qu'aujourd'hui et la plus lente se termine en
   moins de 2 s (au lieu d'environ 24 s).
2. **Given** une location dont le paiement est en cours, **When** un autre client consulte les stations,
   **Then** sa réponse arrive sans attendre la fin du paiement.
3. **Given** une seule requête à la fois, **When** elle est traitée, **Then** elle donne exactement la
   même réponse, les mêmes effets sur les données et les mêmes lignes de journal qu'aujourd'hui.

---

### User Story 2 - Les données restent cohérentes quand les requêtes se chevauchent (Priority: P1)

Quand plusieurs requêtes concernent le même vélo, le même utilisateur, la même location ou la même
station en même temps, le service se comporte comme si elles étaient arrivées l'une après l'autre :
une seule réussit là où une seule pouvait réussir, et les autres reçoivent la réponse de refus du
contrat actuel.

**Why this priority**: sans cette garantie, l'US1 introduit des locations en double et des doubles
débits, ce que le principe VI interdit et que le service garantit aujourd'hui. Elle est livrée avec
l'US1, jamais après.

**Independent Test**: envoyer simultanément plusieurs demandes en conflit et vérifier qu'une seule
réussit, que les autres reçoivent le refus attendu et que les données sont celles d'une exécution
l'une après l'autre.

**Acceptance Scenarios**:

1. **Given** deux cyclistes qui demandent le même vélo au même moment, **When** les deux demandes sont
   traitées, **Then** une seule location est créée et l'autre demande reçoit `409 no bike available`.
2. **Given** deux cyclistes sans préférence dans une station qui a au moins deux vélos disponibles,
   **When** ils louent au même moment, **Then** ils obtiennent deux vélos différents.
3. **Given** un utilisateur qui envoie deux demandes de location au même moment, **When** elles sont
   traitées, **Then** une seule location est créée et l'autre demande reçoit `409 already renting`.
4. **Given** deux retours simultanés de la même location, **When** ils sont traités, **Then** la
   location est clôturée et débitée une seule fois, et l'autre retour reçoit `409 already returned`.
5. **Given** une station qui n'a plus qu'une place libre, **When** deux vélos y sont rendus au même
   moment, **Then** un seul retour réussit et l'autre reçoit `409 station full`.
6. **Given** un vélo réservé par une location dont le paiement est ensuite refusé, **When** la location
   est refusée, **Then** le vélo redevient disponible dans sa station, comme aujourd'hui.

---

### User Story 3 - Chaque appel externe a une durée maximale (Priority: P2)

Un appel à un service externe (paiement, géolocalisation, anti-fraude, notifications) qui ne répond pas
dans une durée maximale est abandonné, et le service répond de façon définie au lieu d'attendre
indéfiniment (constitution, principe VI).

**Why this priority**: c'est une exigence de la constitution reportée à l'étape 2d (dérogation de
l'étape 2c). Avec les services simulés actuels, elle ne change rien en fonctionnement normal : leurs
durées sont fixes et inférieures aux durées maximales. Elle ajoute en revanche un nouveau cas d'échec,
donc un changement de comportement, livré dans son propre commit.

**Independent Test**: remplacer un service externe par une doublure qui ne répond jamais et vérifier que
la requête se termine dans la durée maximale avec la réponse définie.

**Acceptance Scenarios**:

1. **Given** un service externe qui ne répond pas, **When** une requête l'appelle, **Then** la requête se
   termine au plus tard à l'expiration de la durée maximale de ce service, avec le refus du contrat actuel
   défini en FR-011, et aucune donnée n'est modifiée à moitié.
2. **Given** des services externes qui répondent normalement, **When** une requête les appelle, **Then**
   la réponse est identique à celle d'aujourd'hui.

---

### User Story 4 - Les tests maîtrisent le temps sans l'attendre (Priority: P3)

Un mainteneur teste les durées de location, les attentes des services simulés et les durées maximales
sans attendre le temps réel et sans remplacer l'horloge globale du système : le temps est fourni aux
composants qui en ont besoin, et les tests le font avancer eux-mêmes.

**Why this priority**: l'horloge rapide actuelle ne fonctionne qu'avec l'attente active (elle avance à
chaque lecture de l'heure). Elle devient inutilisable avec une attente non bloquante. Sans temps
maîtrisé, les tests de l'US1 à l'US3 deviendraient lents ou non déterministes (principe II).

**Independent Test**: la suite unitaire et d'intégration s'exécute sans attendre aucune durée simulée
réelle et donne le même résultat à chaque exécution.

**Acceptance Scenarios**:

1. **Given** une location de 45 minutes dans un test, **When** le test fait avancer le temps de
   45 minutes, **Then** la durée et le prix calculés sont ceux d'aujourd'hui, sans attente réelle.
2. **Given** un test d'un service simulé, **When** il vérifie la latence simulée, **Then** il le fait en
   faisant avancer le temps, pas en attendant.
3. **Given** la suite complète, **When** elle est lancée deux fois, **Then** elle donne les mêmes
   résultats, quel que soit l'ordre des tests.

---

### Edge Cases

- Une location refusée après la réservation du vélo (fraude, paiement refusé ou délai dépassé) libère
  le vélo avant de répondre : il est de nouveau proposé aux requêtes suivantes.
- Une demande qui précise un vélo réservé par une autre location en cours reçoit `409 no bike
  available`, comme pour un vélo déjà loué.
- Un utilisateur dont une location est en cours de création est considéré comme « en location » pour
  ses autres demandes (`409 already renting`), même avant la fin du paiement.
- Deux retours concurrents vers deux stations différentes de la même location : un seul réussit,
  l'autre reçoit `409 already returned`, et le vélo n'est garé que dans une station.
- Une erreur dans une requête (données incohérentes, exception inattendue) n'interrompt ni ne bloque les
  autres requêtes en cours, et ne laisse aucune réservation active.
- La liste des stations reste dans l'ordre des données, même si les géolocalisations des stations
  sont faites en même temps.
- Les lignes de journal d'une requête gardent leur ordre relatif (par exemple `preauth done` avant
  `rental created`) ; les lignes de requêtes différentes peuvent s'entrelacer.
- Le crédit qui peut devenir négatif après une location de plus de 24 h reste le comportement actuel
  (point ouvert du plan, hors périmètre).

## Requirements *(mandatory)*

### Functional Requirements

**Comportement préservé**

- **FR-001**: Pour une requête traitée seule, le système MUST donner la même réponse (code et corps),
  les mêmes effets sur les données et les mêmes lignes de journal, dans le même ordre, qu'aujourd'hui
  (contrat actuel, dérogation transitoire au principe IX).
- **FR-002**: Les services externes simulés MUST garder leurs durées actuelles (paiement ≈ 1 s par
  appel, géolocalisation 300 ms, anti-fraude 200 ms, notification de location 100 ms, demande de
  rééquilibrage 150 ms) ; seule la façon d'attendre change.

**US1 – Attente non bloquante**

- **FR-003**: Pendant qu'une requête attend un service externe, le système MUST continuer à traiter les
  autres requêtes.
- **FR-004**: La liste des stations MUST géolocaliser toutes les stations en même temps (la durée d'une
  consultation est celle d'une seule géolocalisation, pas leur somme) tout en renvoyant les stations
  dans l'ordre des données.

**US2 – Cohérence sous concurrence**

- **FR-005**: Un vélo choisi pour une location MUST être réservé jusqu'à la création ou au refus de cette
  location ; un vélo réservé n'est proposé à aucune autre demande.
- **FR-006**: Une location refusée après la réservation (fraude, paiement refusé, délai dépassé, erreur)
  MUST libérer le vélo avant de répondre.
- **FR-007**: Un utilisateur MUST avoir au plus une location en cours ou en cours de création, même si ses
  demandes arrivent en même temps.
- **FR-008**: Une location MUST être clôturée, débitée et son vélo garé au plus une fois, même si plusieurs
  retours arrivent en même temps.
- **FR-009**: Une station MUST NOT dépasser sa capacité, même si plusieurs retours y arrivent en même
  temps (les places promises à un retour en cours comptent comme occupées).
- **FR-010**: Une demande perdante d'un conflit MUST recevoir la réponse de refus du contrat actuel qu'elle
  aurait reçue en arrivant juste après la gagnante (`no bike available`, `already renting`,
  `already returned`, `station full`).

**US3 – Durée maximale des appels externes**

- **FR-011**: Chaque appel à un service externe MUST avoir une durée maximale ; quand elle est dépassée,
  le système MUST répondre avec les refus du contrat actuel, sans nouveau code ni message HTTP :
  - pré-autorisation du paiement : location refusée avec `402 payment declined` (vélo libéré, aucune
    location créée) ;
  - anti-fraude : location refusée par prudence avec `403 refused`, sans contacter le paiement ;
  - géolocalisation : la station est listée avec une zone et une météo inconnues (`''`), les autres
    informations de la station restant exactes ;
  - capture du paiement : la location est clôturée comme aujourd'hui en cas d'échec de capture, avec
    `captured: false` et aucun débit ;
  - notifications de flotte (location créée, rééquilibrage) : ignorées pour la réponse, qui reste un
    succès ; seule la journalisation de FR-012 le signale.
- **FR-018**: Les durées maximales MUST être des constantes nommées (une par service), fournies aux
  adaptateurs par le point d'assemblage et réglables par les tests ; leur lecture depuis
  l'environnement relève de l'étape 2e.
- **FR-012**: Un appel abandonné pour délai dépassé MUST NOT laisser de modification partielle des données
  et MUST être journalisé (niveau, service concerné, durée maximale).

**US4 – Temps maîtrisé**

- **FR-013**: Les composants qui lisent l'heure ou attendent une durée MUST recevoir le temps par
  injection ; aucun test ne remplace l'horloge globale du système.
- **FR-014**: Les tests unitaires et d'intégration MUST s'exécuter sans attendre les durées simulées réelles
  et être déterministes ; l'horloge rapide (`tests/support/fastClock.ts`) MUST être supprimée.

**Tests et livraison**

- **FR-015**: Les tests d'intégration MUST garder les mêmes requêtes et les mêmes attentes ; seule leur mise
  en place (fourniture du temps maîtrisé) MAY changer. Le test E2E MUST rester inchangé (vrai serveur,
  temps réel).
- **FR-016**: Chaque garantie de l'US2 MUST être couverte par un test qui fait réellement se chevaucher les
  requêtes en conflit.
- **FR-017**: L'étape MUST être livrée en trois commits, chacun dans sa propre demande de fusion vers
  `main`, revue et intégrée avant de commencer la suivante : d'abord le temps maîtrisé de l'US4
  (`refactor:`), puis l'attente non bloquante avec les garanties de l'US2 (`refactor:`, comportement
  conservé), enfin les durées maximales de l'US3 (nouveau comportement, dans un commit de comportement).

### Key Entities *(include if feature involves data)*

- **Réservation de vélo** : marque temporaire qu'un vélo est retenu par une location en cours de
  création ; elle disparaît à la création (le vélo est alors loué) ou au refus (le vélo redevient
  disponible).
- **Opération en cours** : location en cours de création pour un utilisateur, ou retour en cours pour une
  location, qui bloque les demandes concurrentes en conflit le temps de son traitement.
- **Durée maximale** : délai au-delà duquel un appel à un service externe est abandonné, propre à chaque
  service.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 20 consultations simultanées des stations sont toutes terminées en moins de 2 s (médiane de
  3 exécutions de `pnpm load`, latence maximale), contre environ 24 s aujourd'hui.
- **SC-002**: Une consultation des stations envoyée pendant le paiement d'une location reçoit sa réponse
  en moins de 1,5 s, quel que soit le nombre de locations en cours.
- **SC-008**: Une consultation des stations envoyée seule reçoit sa réponse en moins de 0,5 s (une seule
  durée de géolocalisation, au lieu d'environ 1,2 s aujourd'hui).
- **SC-003**: Dans les tests de concurrence, 100 % des conflits (même vélo, même utilisateur, même
  location, dernière place d'une station) donnent exactement une réussite et des refus du contrat
  actuel ; 0 location en double, 0 double débit, 0 station au-delà de sa capacité.
- **SC-004**: 100 % des tests d'intégration (13) et E2E (2) passent, sans modification de leurs requêtes ni
  de leurs attentes.
- **SC-005**: La suite unitaire et d'intégration ne dure pas plus longtemps qu'aujourd'hui (environ 11 s)
  et donne le même résultat sur 3 exécutions consécutives.
- **SC-006**: Le score de mutation reste ≥ 90 % et la couverture des lignes et des branches reste à 100 %.
- **SC-007**: Avec un service externe qui ne répond jamais, 100 % des requêtes concernées se terminent au
  plus tard à l'expiration de la durée maximale de ce service.

## Assumptions

- Le comportement de référence est celui de `main` au commit `1d6b753` (fin de l'étape 2c), et la mesure
  de référence de `pnpm load` est celle de `specs/001-couche-hexagonales/baseline.md` (médianes
  24 057 / 24 082 ms), à confirmer au début de l'étape.
- Les notifications de flotte (location créée, rééquilibrage) restent attendues avant la réponse, pour
  garder l'ordre des journaux et la durée de chaque requête ; les envoyer sans les attendre serait une
  optimisation distincte.
- Le service reste un seul processus avec des données en mémoire : les garanties de l'US2 portent sur les
  requêtes concurrentes de ce processus, pas sur plusieurs instances.
- Un conflit perdant est refusé immédiatement ; il n'attend pas la fin de la requête gagnante pour
  réessayer.
- Délais maximaux par défaut, au-dessus des durées simulées pour ne rien changer en fonctionnement normal :
  paiement 3 s par appel, géolocalisation 1 s, anti-fraude 1 s, notifications 1 s. Ce sont des constantes
  nommées injectées par le point d'assemblage (FR-018, principe III, pas de valeur en dur).
- Le test E2E garde le temps réel ; il devient simplement plus rapide.
- Aucune nouvelle dépendance n'est nécessaire.

## Exigences non fonctionnelles *(obligatoire, constitution principe I)*

| Catégorie | Exigence | Métrique | Seuil |
|-----------|----------|----------|-------|
| Performance | Les requêtes concurrentes ne s'attendent plus | Latence maximale de 20 `GET /stations` simultanés (`pnpm load`, médiane de 3 exécutions) | < 2 s (référence ≈ 24 s) |
| Performance | Une requête n'attend pas le paiement d'une autre | Durée d'une consultation pendant une location en cours | < 1,5 s |
| Performance | Les stations sont géolocalisées en même temps | Durée d'une consultation seule des stations | < 0,5 s (référence ≈ 1,2 s) |
| Robustesse | Les entrées invalides restent refusées comme aujourd'hui | Tests de validation existants | 100 % verts |
| Intégrité des données | Aucune location en double, aucun double débit, aucune station au-delà de sa capacité sous concurrence | Tests de concurrence (FR-016) | 0 incohérence |
| Tolérance aux pannes | Un service externe qui ne répond pas ne bloque pas la requête | Durée d'une requête avec un service muet | ≤ durée maximale du service (FR-011) |
| Sécurité | Aucune nouvelle surface d'attaque | Routes exposées et entrées acceptées avant / après | Identiques |
| Maintenabilité | Tests déterministes et rapides, seuils de la constitution | Mutation ; couverture ; durée de la suite | ≥ 90 % ; 100 % ; ≤ référence |

## Contrat *(obligatoire si la fonctionnalité expose ou consomme une interface)*

- **Interface** : inchangée : `POST /rent`, `POST /return`, `GET /stations`, `GET /rentals/:id`
  (référence : `specs/001-couche-hexagonales/contracts/current-api.openapi.yaml`).
- **Entrées** : inchangées.
- **Sorties** : inchangées.
- **Erreurs** : inchangées pour toutes les situations d'aujourd'hui ; les conflits concurrents reçoivent
  les refus existants (FR-010) ; un service externe trop lent donne aussi un refus existant (FR-011).
  Seule nouveauté visible : une zone et une météo vides (`''`) pour une station dont la géolocalisation
  dépasse sa durée maximale, valeurs que le contrat décrit aujourd'hui comme `north`/`south` et
  `clear`/`rain` ; le contrat de référence est complété en conséquence au moment du plan.
- **Compatibilité** : changement compatible pour les clients ; seule la durée des réponses change sous
  charge.

## Exigences de test *(obligatoire, constitution principe II)*

Les tests sont **demandés** pour cette fonctionnalité, en TDD : chaque test est écrit et échoue avant le
code qui le fait passer.

- **Unitaires** : chaque règle métier et chaque cas limite de cette spec.
- **Intégration** : chaque élément du contrat, avec les vrais modules internes.
- **End-to-end** : chaque parcours utilisateur de priorité P1.
- **Mutation** : le score reste au-dessus du seuil de la constitution.
- Chaque scénario d'acceptation Given / When / Then ci-dessus correspond à au moins un test.

Précisions propres à cette étape :

- Les tests de concurrence (US2) font réellement se chevaucher les requêtes, avec un temps maîtrisé qui
  permet de les maintenir en attente au moment voulu ; un test qui passerait aussi avec des requêtes
  l'une après l'autre ne prouve rien.
- La mesure de performance (US1) se fait avec `pnpm load` et le test E2E, en temps réel ; les tests
  unitaires et d'intégration n'attendent jamais le temps réel.

## Sécurité *(obligatoire, constitution principe VIII)*

- **Catégories OWASP Top 10 concernées** : A04 Conception non sécurisée (conditions de concurrence :
  double location, double débit, réservation non libérée, traitées par l'US2) ; A01 Contrôle d'accès
  défaillant (absence d'authentification, situation inchangée, hors périmètre). Aucune autre catégorie
  n'est touchée : les routes et les entrées ne changent pas.
- **Données manipulées et sensibilité** : noms et crédits des utilisateurs, présence sur liste noire
  (données personnelles internes, simulées) ; références de paiement (internes).
- **Mesures prévues** : réservation et opérations en cours libérées dans tous les cas (succès, refus,
  erreur, délai dépassé) pour éviter un blocage durable d'un vélo ou d'un utilisateur ; journaux des
  délais dépassés sans donnée sensible.
