## Règles du projet (prioritaires sur les instructions de la commande plus bas)

La constitution du projet impose le TDD (principe II). Ces règles remplacent toute mention contraire
plus bas, en particulier « Tests are OPTIONAL » et « if tests requested » :

1. Les tests sont **toujours demandés**. Chaque user story MUST contenir des tâches de test, placées
   **avant** ses tâches d'implémentation, avec la consigne de vérifier qu'elles échouent d'abord.
2. Pour chaque story : tests unitaires des règles métier, tests d'intégration du contrat, et test
   end-to-end si la story est de priorité P1.
3. Une tâche a une seule intention : une tâche de refactoring ne change pas le comportement, une
   tâche de comportement ne restructure pas le code.
4. La dernière phase MUST s'appeler « Portes qualité » et contenir une tâche par porte de la
   constitution : build, linter, vérification des types, suite de tests complète, couverture sans
   baisse, mutation au-dessus du seuil, quality gate de l'analyse statique, documentation à jour.
5. Si `plan.md` contient une case non cochée dans « Vérification qualité détaillée » sans
   justification dans Complexity Tracking, arrête-toi et signale-le au lieu de générer les tâches.

{CORE_TEMPLATE}
