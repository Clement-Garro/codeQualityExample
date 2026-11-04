# quality-kit

Preset [Spec Kit](https://github.github.io/spec-kit/) qui impose, dans chaque projet où il est installé, les règles du support de cours « Code quality » : clean code, TDD et pyramide de tests, tests par mutation, architecture hexagonale, SOLID, API REST, sécurité (OWASP), revue de code et intégration continue.

Il ne remplace pas ta réflexion : il rend les règles **inviolables par défaut** pour l'agent IA (diapo 88), et `/speckit-analyze` signale toute violation comme CRITICAL.

## Ce que fait le preset

| Fichier | Effet dans le projet |
|---|---|
| `templates/constitution-template.md` | `/speckit-constitution` part de cette constitution déjà remplie (10 principes, contraintes, portes qualité) au lieu d'un modèle vide |
| `templates/spec-addendum.md` | Chaque `spec.md` contient en plus : exigences non fonctionnelles chiffrées, contrat, exigences de test, sécurité |
| `templates/plan-addendum.md` | Chaque `plan.md` contient en plus : vérification qualité principe par principe, couches de l'architecture, stratégie de test, dépendances justifiées |
| `commands/speckit.tasks.md` | `/speckit-tasks` génère **toujours** les tests, avant le code, et finit par une phase « Portes qualité ». Par défaut, Spec Kit rend les tests optionnels |

Testé avec Spec Kit 1.2.6.

## Installer le kit sur ta machine (une fois)

1. Place ce dossier à un endroit stable, par exemple `C:\Users\garro\WebstormProjects\quality-kit`.
2. Fais-en un dépôt git, pour versionner tes règles : `git init`, puis un premier commit.

## Utiliser le kit dans un nouveau projet

```powershell
specify init mon-projet --integration claude --script ps
cd mon-projet
specify preset add --dev C:\Users\garro\WebstormProjects\quality-kit
specify preset list
claude
```

Puis, dans Claude Code :

```text
/speckit-constitution Projet : mon-projet. Stack : TypeScript, Node 22, Express, pnpm. Seuils par défaut.
```

Relis la constitution produite dans `.specify/memory/constitution.md`, puis commite-la seule. La suite est dans [docs/guide-speckit.md](docs/guide-speckit.md).

## Projet existant

```powershell
cd mon-projet-existant
git status                     # doit être propre : commite avant
specify init --here --force --integration claude --script ps
specify preset add --dev C:\Users\garro\WebstormProjects\quality-kit
```

Si le projet a déjà une constitution, `/speckit-constitution` la fusionne avec celle du kit et propose un numéro de version. Relis attentivement ce qui change avant de commiter.

## Mettre à jour le kit

1. Modifie les fichiers du kit, augmente `version` dans `preset.yml` (versionnement sémantique), commite.
2. Dans chaque projet : `specify preset update quality-kit --dev C:\Users\garro\WebstormProjects\quality-kit`
3. Relance `/speckit-constitution` pour appliquer les nouvelles règles, et commite l'amendement seul.

## Documentation

- [docs/referentiel-qualite.md](docs/referentiel-qualite.md) : toutes les règles avec leur raison et leur diapo, et les points où la diapo est incomplète ou à corriger.
- [docs/guide-speckit.md](docs/guide-speckit.md) : comment utiliser Spec Kit correctement dans un projet.

Le dossier `docs/` n'est pas copié dans les projets (`.presetignore`) : la constitution suffit à l'agent, le référentiel sert aux humains.
