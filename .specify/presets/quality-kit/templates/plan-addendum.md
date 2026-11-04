
## Vérification qualité détaillée *(obligatoire, à remplir avant puis après la conception)*

Chaque ligne est cochée, ou justifiée dans Complexity Tracking. Une case non cochée sans justification
bloque `/speckit-tasks`.

| Principe | Vérification | Avant | Après |
|----------|--------------|-------|-------|
| I. Spécifier avant de coder | `spec.md` validé, contrat écrit, exigences non fonctionnelles chiffrées | [ ] | [ ] |
| II. Tests | Stratégie de test ci-dessous complète, TDD prévu, seuil de mutation tenu | [ ] | [ ] |
| III. Code lisible | Aucune fonction ni aucun fichier prévu au-delà des seuils de taille, complexité, paramètres et longueur de ligne | [ ] | [ ] |
| IV. Architecture | Chaque élément placé dans une couche ci-dessous ; le domaine ne dépend de rien d'extérieur | [ ] | [ ] |
| V. Types | Nouveaux types et enums listés ; aucun type « fourre-tout » | [ ] | [ ] |
| VI. Erreurs | Chaque cas d'erreur du contrat a sa gestion ; aucun succès partiel possible | [ ] | [ ] |
| VII. Observabilité | Événements journalisés listés, sans donnée sensible | [ ] | [ ] |
| VIII. Sécurité | Catégories OWASP de la spec traitées | [ ] | [ ] |
| IX. API REST | Contrat OpenAPI dans `contracts/`, codes de retour exacts | [ ] | [ ] |
| X. Performance | Exigences de performance mesurables, mesure avant/après prévue | [ ] | [ ] |

## Architecture *(obligatoire)*

| Couche | Éléments ajoutés ou modifiés | Ports utilisés ou créés |
|--------|------------------------------|-------------------------|
| Domaine | [entités, règles, politiques] | n/a |
| Application | [use cases] | [ports driven et driving] |
| Infrastructure | [repositories, clients d'API] | [ports driven implémentés] |
| Présentation | [contrôleurs, routes, UI] | [ports driving implémentés] |

Design patterns utilisés, chacun avec le problème qu'il résout : [ou « aucun »]

## Stratégie de test *(obligatoire)*

| Niveau | Ce qui est testé | Doublures (frontières uniquement) | Fichiers |
|--------|------------------|------------------------------------|----------|
| Unitaire | [règles métier, cas limites] | [service externe, horloge] | [chemin] |
| Intégration | [contrat, assemblage réel] | [aucune, ou justification] | [chemin] |
| End-to-end | [parcours P1] | aucune | [chemin] |
| Mutation | [périmètre muté, exclusions justifiées] | n/a | n/a |

## Dépendances ajoutées *(obligatoire, même vide)*

| Dépendance | Version | Pourquoi | Alternative écartée |
|------------|---------|----------|---------------------|
| [nom ou « aucune »] | | | |
