
## Exigences non fonctionnelles *(obligatoire, constitution principe I)*

<!--
  Chaque exigence a une métrique et un seuil vérifiables. Si une catégorie ne s'applique pas,
  l'écrire avec la raison : une ligne vide n'est pas acceptée par /speckit-analyze.
-->

| Catégorie | Exigence | Métrique | Seuil |
|-----------|----------|----------|-------|
| Performance | [ex. la liste se charge vite] | [ex. latence p95] | [ex. < 200 ms] |
| Robustesse | [ex. entrées invalides refusées] | [ex. % de cas invalides couverts par des tests] | [100 %] |
| Intégrité des données | [ex. aucun succès partiel] | [ex. invariants vérifiés par des tests] | [tous] |
| Tolérance aux pannes | [ex. le service externe est indisponible] | [ex. délai maximal, comportement de repli] | [ex. 2 s, erreur 503 explicite] |
| Sécurité | [ex. accès réservé au propriétaire] | [ex. tests d'autorisation] | [tous les endpoints] |
| Maintenabilité | [ex. règles de la constitution] | [mutation, complexité, quality gate] | [seuils de la constitution] |

## Contrat *(obligatoire si la fonctionnalité expose ou consomme une interface)*

- **Interface** : [route REST, signature publique, événement, commande CLI]
- **Entrées** : [champs, types, contraintes de validation]
- **Sorties** : [représentation, codes de retour]
- **Erreurs** : [chaque cas d'erreur, son code et son format]
- **Compatibilité** : [changement compatible, ou version majeure de l'API nécessaire]

## Exigences de test *(obligatoire, constitution principe II)*

Les tests sont **demandés** pour cette fonctionnalité, en TDD : chaque test est écrit et échoue avant le
code qui le fait passer.

- **Unitaires** : chaque règle métier et chaque cas limite de cette spec.
- **Intégration** : chaque élément du contrat, avec les vrais modules internes.
- **End-to-end** : chaque parcours utilisateur de priorité P1.
- **Mutation** : le score reste au-dessus du seuil de la constitution.
- Chaque scénario d'acceptation Given / When / Then ci-dessus correspond à au moins un test.

## Sécurité *(obligatoire, constitution principe VIII)*

- **Catégories OWASP Top 10 concernées** : [ex. contrôle d'accès, injection ; ou « aucune » avec la raison]
- **Données manipulées et sensibilité** : [publique, interne, personnelle, secrète]
- **Mesures prévues** : [validation, autorisation côté serveur, chiffrement, journalisation sans donnée sensible]
