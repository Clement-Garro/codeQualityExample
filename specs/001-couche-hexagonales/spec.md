# Feature Specification: Découpage en couches hexagonales (étape 2c)

**Feature Branch**: `001-couche-hexagonales`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Refactoring de structure 2c du plan (docs/plan-refactoring.md) : séparer
l'application en couches selon l'architecture hexagonale (constitution, principe IV), SANS AUCUN
changement de comportement. Pourquoi : aujourd'hui les règles métier (tarif, fraude, choix du vélo,
règles de location et de retour) sont mêlées à la couche HTTP et au stockage en mémoire ; on veut
pouvoir les tester seules, et pouvoir changer le contrat d'API à l'étape 3 en ne touchant que la couche
de présentation. Priorités, chacune livrable dans un commit refactor: séparé : P1 domaine isolé
(entités qui protègent leurs invariants, tarif, fraude), testé sans HTTP ni stockage ; P2 accès aux
données et services externes (paiement, localisation) derrière des interfaces, avec une seule source de
vérité pour l'emplacement des vélos ; P3 cas d'utilisation (louer, rendre, consulter une location,
lister les stations) dont les dépendances sont injectées ; P4 couche HTTP réduite à la validation des
entrées, la mise en forme des réponses et la gestion des erreurs en un seul endroit, anciens fichiers
supprimés. Critères d'acceptation : contrat d'API strictement identique (dérogation transitoire au
principe IX), tests d'intégration et E2E inchangés et verts, mutation ≥ 90 %, couverture sans baisse.
Point à trancher : l'alerte « vélo cassé » journalisée pendant une location (déplacer ou supprimer).
Hors périmètre : asynchrone (2d), logger (2e), ESLint et Prettier (2f), SonarQube (2g), nouveau
contrat REST (étape 3)."

## Contexte

C'est un changement de **structure** (commits `refactor:`), pas de comportement. Les « utilisateurs »
de cette fonctionnalité sont les mainteneurs du service de location de vélos ; les clients de l'API ne
doivent percevoir **aucune** différence. Le vocabulaire d'architecture (domaine, ports, couches) est
donc le sujet même de la spec, et non un détail d'implémentation.

Aujourd'hui, un seul module traite à la fois la requête HTTP, les règles métier (choix du vélo, crédit
minimal, fraude, tarif, usure, rééquilibrage) et la modification directe des données en mémoire.
L'emplacement d'un vélo est enregistré deux fois (dans la station et dans le vélo), ce que le
principe VI de la constitution interdit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Domaine isolé et testé seul (Priority: P1)

Un mainteneur veut vérifier une règle métier (prix d'une location, score de fraude, choix du vélo le
moins kilométré, passage d'un vélo à l'état « loué », clôture d'une location) sans démarrer de serveur
HTTP ni préparer de données en mémoire. Les règles métier vivent dans un domaine qui ne dépend ni du
transport HTTP, ni du stockage, ni d'un framework, et les entités refusent elles-mêmes les changements
d'état invalides.

**Why this priority**: c'est la valeur principale du découpage. Tant que les règles sont mêlées au
HTTP, chaque test de règle passe par une fausse requête et chaque changement est risqué. Le domaine est
aussi le socle des étapes P2 à P4.

**Independent Test**: les tests unitaires du domaine s'exécutent en important uniquement le domaine
(aucun module HTTP, de stockage ou de service simulé chargé), et l'API garde exactement les mêmes
réponses (tests d'intégration et E2E verts).

**Acceptance Scenarios**:

1. **Given** une location de 45 minutes sur un vélo électrique pour un abonné premium, **When** le
   domaine calcule le prix, **Then** il obtient le même montant qu'aujourd'hui, sans aucun appel au
   stockage ni au HTTP.
2. **Given** un vélo déjà loué, **When** on tente de le louer à nouveau au niveau du domaine,
   **Then** l'entité refuse le changement d'état et le vélo reste inchangé.
3. **Given** une location déjà terminée, **When** on tente de la clôturer à nouveau, **Then**
   l'entité refuse et la location garde son heure de fin, sa station d'arrivée et son prix.
4. **Given** un utilisateur basic sur liste noire et un montant de 7,50, **When** le domaine calcule
   le score de fraude, **Then** il obtient la même valeur qu'aujourd'hui (≥ seuil de refus).
5. **Given** plusieurs vélos disponibles dans une station sans vélo demandé, **When** le domaine
   choisit un vélo, **Then** il choisit le moins kilométré et, à égalité, le premier dans l'ordre
   actuel des données.

---

### User Story 2 - Données et services externes derrière des interfaces (Priority: P2)

Un mainteneur veut pouvoir remplacer le stockage en mémoire, le service de paiement simulé ou le
service de localisation simulé sans toucher aux règles métier. Les besoins du métier envers ces
systèmes sont décrits par des interfaces (ports) ; les implémentations actuelles (mémoire, simulations)
deviennent des adaptateurs. L'emplacement d'un vélo n'est plus enregistré qu'à un seul endroit.

**Why this priority**: sans ports, les cas d'utilisation (P3) ne peuvent pas recevoir leurs
dépendances, et la double source de vérité sur l'emplacement des vélos reste un risque d'incohérence.

**Independent Test**: les tests unitaires peuvent fournir une fausse implémentation de chaque port
(paiement, localisation, stockage) ; les réponses de `GET /stations` (vélos listés, compteurs, places
libres) sont identiques avant et après, pour l'état initial et après des locations et retours.

**Acceptance Scenarios**:

1. **Given** l'état initial des données, **When** on liste les stations, **Then** chaque station a
   les mêmes vélos listés, le même nombre de vélos libres et électriques libres et le même nombre de
   places libres qu'avant le refactoring.
2. **Given** un vélo loué à République puis rendu à Bastille, **When** on liste les stations,
   **Then** le vélo n'apparaît plus à République, apparaît à Bastille, et les places libres des deux
   stations sont celles d'aujourd'hui.
3. **Given** un vélo en cours de location, **When** on liste les stations, **Then** il n'apparaît
   dans aucune station et n'occupe aucune place.
4. **Given** une fausse implémentation du paiement qui refuse la pré-autorisation, **When** on loue,
   **Then** la location est refusée sans modification des données, comme aujourd'hui.

---

### User Story 3 - Cas d'utilisation avec dépendances injectées (Priority: P3)

Un mainteneur veut lire en un seul endroit le déroulé de chaque opération : louer un vélo, rendre un
vélo, consulter une location, lister les stations. Chaque cas d'utilisation orchestre le domaine et
les ports qu'il reçoit à sa construction ; un point d'assemblage unique (composition root) crée les
adaptateurs et les fournit. Aucun cas d'utilisation ne crée lui-même ses dépendances.

**Why this priority**: c'est ce qui permet de tester chaque opération avec des données neuves et des
doubles aux frontières, et de brancher n'importe quelle présentation (HTTP aujourd'hui, nouveau
contrat REST à l'étape 3).

**Independent Test**: chaque cas d'utilisation est testé unitairement avec des doubles de ports et
des données nommées, sans HTTP ; deux instances assemblées séparément ne partagent aucune donnée.

**Acceptance Scenarios**:

1. **Given** un cas « louer » assemblé avec un paiement qui accepte, **When** Alice loue à
   République, **Then** le résultat contient le vélo 4, la station République, une pré-autorisation de
   7,50 et une référence de paiement, et la location est enregistrée.
2. **Given** deux applications assemblées séparément, **When** on loue un vélo dans la première,
   **Then** la seconde est toujours dans l'état initial (numérotation des locations comprise).
3. **Given** les conditions de refus de la location (utilisateur inconnu, station inconnue, aucun
   vélo disponible, location déjà en cours, crédit insuffisant, fraude, paiement refusé), **When** on
   loue, **Then** le cas d'utilisation signale la même raison de refus qu'aujourd'hui, dans le même
   ordre de vérification, sans modifier les données.

---

### User Story 4 - Couche HTTP réduite à la présentation (Priority: P4)

Un mainteneur qui préparera l'étape 3 veut ne toucher que la couche de présentation pour changer le
contrat. La couche HTTP se limite à valider les entrées, appeler le cas d'utilisation, mettre en forme
la réponse et traduire les erreurs en codes et corps de réponse, à un seul endroit. Les anciens
modules monolithiques (gestionnaires HTTP, utilitaires, stockage, paiement) n'existent plus.

**Why this priority**: c'est la dernière marche ; elle n'apporte de valeur qu'une fois le domaine, les
ports et les cas d'utilisation en place.

**Independent Test**: les tests d'intégration et E2E existants passent avec les mêmes requêtes et les
mêmes assertions ; la couche HTTP ne contient plus aucune règle métier (aucune constante métier, aucun
accès direct aux données).

**Acceptance Scenarios**:

1. **Given** chaque requête des tests d'intégration et E2E actuels, **When** elle est envoyée à
   l'application refactorée, **Then** le code HTTP et le corps JSON sont identiques à ceux
   d'aujourd'hui.
2. **Given** une raison de refus quelconque, **When** elle remonte d'un cas d'utilisation, **Then** sa
   traduction en code HTTP et en `msg` est faite à un seul endroit de la présentation.
3. **Given** le dépôt après le dernier commit, **When** on cherche les anciens modules, **Then** ils
   n'existent plus et rien ne les importe.

---

### Edge Cases

Comportements actuels, parfois surprenants, qui MUST être préservés à l'identique (le refactoring ne
les corrige pas) :

- Identifiants transmis sous forme de chaîne (`"1"`) : acceptés et convertis ; une chaîne non
  numérique (`"abc"`) donne « introuvable » (404), pas 400.
- Champ obligatoire absent, `null`, chaîne vide ou `NaN` : 400 `bad request`.
- `bikeId` fourni mais absent des vélos disponibles de la station (loué, cassé, en maintenance,
  autre station) : 409 `no bike available` ; `bikeId` à `null` : choix automatique.
- Ordre des vérifications de la location : utilisateur, station, vélo disponible, location déjà en
  cours, crédit minimal, fraude, pré-autorisation. Ordre pour le retour : location, déjà rendue,
  station, station pleine.
- Les places libres d'une station comptent tous les vélos présents, y compris cassés et en
  maintenance ; un vélo loué n'occupe aucune place.
- La liste des vélos d'une station contient les vélos disponibles et cassés (marqués `broken`),
  jamais ceux en maintenance ou loués, triés par kilométrage.
- Échec de la capture du paiement au retour : la location est quand même clôturée et la réponse
  indique `captured: false` (journaliser cet échec relève de l'étape 2e).
- Une location de plus de 24 h débite plus que le montant pré-autorisé (point ouvert du plan, à
  corriger dans un `fix:` séparé, hors périmètre).
- `GET /rentals/:id` d'une location en cours calcule la durée jusqu'à maintenant ; `estimate` reste
  égal à `price` (supprimé à l'étape 3 seulement).
- Données incohérentes (utilisateur ou vélo d'une location introuvable) : l'application échoue tôt
  avec une erreur explicite, comme aujourd'hui.
- Les attentes simulées des services (paiement, localisation, fraude, journalisation) gardent leur
  durée actuelle : les rendre asynchrones relève de l'étape 2d.

## Requirements *(mandatory)*

### Functional Requirements

**Préservation du comportement**

- **FR-001**: Le système MUST conserver à l'identique le contrat d'API actuel : routes `POST /rent`,
  `POST /return`, `GET /stations`, `GET /rentals/:id`, codes HTTP, corps JSON (clés `msg`, `ref`,
  `el`, `km`, etc.) et messages d'erreur (dérogation transitoire au principe IX).
- **FR-002**: Le système MUST conserver les mêmes effets sur les données pour chaque opération :
  crédit débité, statut et kilométrage des vélos, emplacement des vélos, état des locations,
  numérotation des locations à partir de 1.
- **FR-003**: Le système MUST conserver les mêmes lignes de journal (niveau, message, contexte) pour
  la création de location, le refus de paiement, la pré-autorisation, la capture et le
  rééquilibrage, ainsi que pour l'alerte « vélo cassé » (FR-016).
- **FR-004**: Chaque priorité (P1 à P4) MUST être livrée dans un commit `refactor:` distinct après
  lequel toutes les portes qualité sont vertes.

**P1 – Domaine**

- **FR-005**: Les règles métier (tarif, durée, pré-autorisation, crédit minimal, score de fraude,
  choix du vélo, usure, seuil de rééquilibrage) MUST être exprimées dans le domaine, qui ne dépend
  d'aucune couche HTTP, de stockage, de service externe ni de framework.
- **FR-006**: Les entités vélo et location MUST protéger leurs invariants : un vélo ne peut être loué
  que s'il est disponible ; une location ne peut être clôturée qu'une fois ; un changement d'état
  invalide est refusé avec une erreur explicite et laisse l'entité inchangée.
- **FR-007**: Les données du domaine MUST être immuables par défaut ; l'état d'une entité ne change
  que par ses propres opérations (principe V).

**P2 – Ports et adaptateurs**

- **FR-008**: L'accès aux stations, vélos, utilisateurs et locations, le paiement (pré-autorisation,
  capture) et la localisation MUST passer par des interfaces définies du côté du métier ; les
  implémentations en mémoire et simulées actuelles en sont des adaptateurs.
- **FR-009**: L'emplacement d'un vélo MUST être enregistré à un seul endroit ; la liste des vélos
  présents dans une station et le nombre de places libres en sont déduits.
- **FR-010**: Chaque interface MUST être petite et ciblée : un consommateur ne dépend que des
  opérations qu'il utilise (principe IV, I de SOLID).

**P3 – Cas d'utilisation**

- **FR-011**: Les opérations louer, rendre, consulter une location et lister les stations MUST être
  chacune un cas d'utilisation distinct, qui reçoit ses dépendances à sa construction.
- **FR-012**: Un point d'assemblage unique MUST créer les adaptateurs et les cas d'utilisation ;
  aucun autre code ne crée de dépendance ni n'utilise d'état global partagé.
- **FR-013**: Chaque assemblage MUST partir de ses propres données initiales : deux applications
  assemblées séparément ne partagent ni données ni compteur de locations.
- **FR-014**: Un cas d'utilisation MUST signaler chaque refus par une raison métier nommée (et non
  par un code HTTP), et ne modifier aucune donnée quand il refuse.

**P4 – Présentation**

- **FR-015**: La couche HTTP MUST se limiter à la validation des entrées, à l'appel du cas
  d'utilisation, à la mise en forme des réponses et à la traduction des raisons de refus en codes et
  corps HTTP, cette traduction étant faite à un seul endroit.
- **FR-016**: L'alerte « vélo cassé », journalisée aujourd'hui à chaque location dans une station qui
  contient un vélo cassé, MUST être conservée à l'identique (même moment, même ligne de journal) dans
  le cas d'utilisation « louer » pendant 2c. La supprimer ou la déplacer vers un service de
  maintenance est un changement de comportement, traité plus tard dans un commit `fix:` ou `feat:`
  séparé (point ouvert du plan).
- **FR-017**: Les anciens modules (gestionnaires HTTP, utilitaires, stockage, paiement) MUST être
  supprimés à la fin de P4 ; le code et les tests MUST NOT plus les importer.

**Tests**

- **FR-018**: Les tests d'intégration et E2E MUST garder les mêmes requêtes et les mêmes assertions ;
  seule leur mise en place (création de l'application, accès aux données de départ pour préparer un
  cas ou vérifier un crédit) MAY changer pour passer par le point d'assemblage.
- **FR-019**: Les tests unitaires MUST être réorganisés par couche (domaine, cas d'utilisation,
  adaptateurs, présentation), avec des doubles uniquement aux frontières (paiement, localisation,
  horloge) et des données nommées (`ALICE`, `REPUBLIQUE`).

### Key Entities *(include if feature involves data)*

- **Station** : point de stationnement nommé, avec une capacité et une position ; ses vélos présents
  et ses places libres sont déduits de l'emplacement des vélos.
- **Vélo** : identifiant, électrique ou non, kilométrage, statut (disponible, loué, maintenance,
  cassé), emplacement (une station, ou aucune pendant une location).
- **Utilisateur** : identifiant, nom, crédit, abonnement (basic ou premium), présence sur liste noire.
- **Location** : utilisateur, vélo, station de départ, heure de début, référence et montant de
  pré-autorisation, puis à la clôture heure de fin, station d'arrivée et prix ; statut ouverte ou
  terminée.
- **Politique de tarif** : calcule le prix à partir de la durée, du type de vélo et de l'abonnement.
- **Détection de fraude** : calcule un score de risque à partir de l'utilisateur et du montant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des tests d'intégration (13) et E2E (2) actuels passent sans modification de
  leurs requêtes ni de leurs assertions, après chacun des 4 commits.
- **SC-002**: Le score de tests par mutation reste ≥ 90 % après chacun des 4 commits.
- **SC-003**: La couverture des lignes et des branches reste à son niveau actuel (100 %) après
  chacun des 4 commits.
- **SC-004**: 100 % des règles métier listées en FR-005 sont vérifiées par des tests qui ne chargent
  ni la couche HTTP ni le stockage.
- **SC-005**: La présentation ne contient aucune constante métier ni aucun accès direct aux données
  (vérifiable par recherche dans le code).
- **SC-006**: L'emplacement d'un vélo n'est enregistré qu'à un seul endroit (0 doublon), vérifiable
  par lecture du modèle de données.
- **SC-007**: Pour l'étape 3, la liste des fichiers à modifier pour changer le contrat se limite à la
  couche de présentation et à ses tests (vérifiable lors de la revue du plan de l'étape 3).

## Assumptions

- Le comportement de référence est celui de `main` au commit `247f66f` (dernier changement de code :
  `a4b4307`, `refactor: strict typing and enums for statuses`), décrit par le README et les tests
  actuels.
- « Tests d'intégration et E2E inchangés » signifie mêmes requêtes et mêmes assertions, comme
  l'indique déjà le plan (« seule leur mise en place change ») : les quatre accès directs aux données
  de départ (crédit de Carol, liste des locations, crédit d'un utilisateur) passent par le point
  d'assemblage.
- Les tests unitaires actuels des gestionnaires HTTP, des utilitaires, du stockage et du paiement
  sont réécrits ou déplacés par couche ; leurs cas sont conservés, pas supprimés.
- Les attentes actives, `console.log`, la configuration en dur et l'absence de délai maximal sur les
  services simulés restent en l'état : ils relèvent des étapes 2d et 2e (dérogation « code legacy »
  du plan).
- Le remboursement (`refundPayment`), inutilisé aujourd'hui, n'est pas exposé par le port de paiement
  (YAGNI) ; il est supprimé avec l'ancien module.
- Aucune nouvelle dépendance n'est ajoutée.

## Exigences non fonctionnelles *(obligatoire, constitution principe I)*

| Catégorie | Exigence | Métrique | Seuil |
|-----------|----------|----------|-------|
| Performance | Le refactoring ne ralentit pas le service | Latence moyenne et maximale de `pnpm load` avant / après | Pas plus de 10 % au-dessus de la mesure de référence |
| Robustesse | Les entrées invalides restent refusées comme aujourd'hui | Cas d'entrées invalides (champ manquant, nul, vide, `NaN`, identifiant inconnu) couverts par des tests | 100 % des cas actuels |
| Intégrité des données | Aucun succès partiel ; une seule source de vérité sur l'emplacement des vélos | Tests « refus sans modification » pour chaque raison de refus ; doublons d'emplacement | Toutes les raisons ; 0 doublon |
| Tolérance aux pannes | Comportement actuel conservé (capture échouée → `captured: false`) | Tests existants | Tous verts ; délais maximaux traités en 2d |
| Sécurité | Aucune nouvelle surface d'attaque | Routes exposées et entrées acceptées avant / après | Identiques |
| Maintenabilité | Couches séparées selon le principe IV | Mutation ; couverture ; dépendances du domaine vers HTTP / stockage / framework | ≥ 90 % ; sans baisse (100 %) ; 0 |

## Contrat *(obligatoire si la fonctionnalité expose ou consomme une interface)*

- **Interface** : inchangée : `POST /rent`, `POST /return`, `GET /stations`, `GET /rentals/:id`
  (description de référence : section « API » du README).
- **Entrées** : inchangées : `{ userId, stationId, bikeId? }` pour la location,
  `{ rentalId, stationId }` pour le retour, `:id` pour la consultation.
- **Sorties** : inchangées : `{ msg, rentalId, bikeId, station, preAuth, ref }`,
  `{ msg, rentalId, minutes, price, station, captured }`, liste des stations
  `{ id, name, zone, weather, free, electric, slots, bikes: [{ id, el, km, broken? }] }`,
  `{ msg, id, bikeId, minutes, price, estimate, open }`.
- **Erreurs** : inchangées : 400 `bad request` ; 404 `no user`, `no station`, `no rental` ;
  409 `no bike available`, `already renting`, `already returned`, `station full` ;
  402 `not enough credit`, `payment declined` ; 403 `refused`.
- **Compatibilité** : changement compatible, aucun client n'est affecté. Le nouveau contrat REST
  relève de l'étape 3.

## Exigences de test *(obligatoire, constitution principe II)*

Les tests sont **demandés** pour cette fonctionnalité, en TDD : chaque test est écrit et échoue avant le
code qui le fait passer.

- **Unitaires** : chaque règle métier et chaque cas limite de cette spec.
- **Intégration** : chaque élément du contrat, avec les vrais modules internes.
- **End-to-end** : chaque parcours utilisateur de priorité P1.
- **Mutation** : le score reste au-dessus du seuil de la constitution.
- Chaque scénario d'acceptation Given / When / Then ci-dessus correspond à au moins un test.

Précisions propres à ce refactoring :

- Les tests d'intégration et E2E existants servent de filet : ils ne changent pas (FR-018) et
  couvrent déjà le contrat et le parcours principal.
- Pour chaque nouvelle unité (entité, politique, cas d'utilisation, adaptateur), le test unitaire
  est écrit avant elle ; un test d'invariant (FR-006) échoue d'abord, puis l'entité le fait passer.

## Sécurité *(obligatoire, constitution principe VIII)*

- **Catégories OWASP Top 10 concernées** : A01 Contrôle d'accès défaillant (l'API n'a pas
  d'authentification aujourd'hui : situation inchangée, hors périmètre) ; A04 Conception non sécurisée
  (la séparation des couches et la validation à la frontière la réduisent) ; A03 Injection : aucune,
  pas de requête vers une base ni d'interpréteur. Aucune autre catégorie n'est touchée, puisque les
  routes et les entrées ne changent pas.
- **Données manipulées et sensibilité** : noms et crédits des utilisateurs, présence sur liste noire
  (données personnelles internes, simulées) ; références de paiement (internes).
- **Mesures prévues** : validation des entrées conservée à la frontière HTTP ; aucune nouvelle donnée
  journalisée ; aucun secret ajouté.
