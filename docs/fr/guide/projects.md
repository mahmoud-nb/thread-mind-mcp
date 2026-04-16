# Projets

Un **projet** est l'espace de travail principal de ThreadMind. Il regroupe une arborescence de threads, un contexte système et une configuration.

## Créer un projet

```
project_create(title: "Mon App", systemContext: "...", mode: "solo")
```

Cela va :
1. Générer un ID à partir du titre (`"Mon App"` → `"mon-app"`)
2. Créer le fichier de configuration du projet
3. Créer le thread racine `main`
4. Initialiser l'arborescence
5. Générer votre identifiant auteur unique (depuis `git config user.name` + UUID court)
6. Définir ce projet comme actif

### Paramètres

| Paramètre | Type | Défaut | Description |
|-----------|------|---------|-------------|
| `title` | string | requis | Nom lisible du projet |
| `systemContext` | string | `""` | Prompt système global inclus dans chaque assemblage de contexte |
| `mode` | `"solo"` \| `"team"` | `"solo"` | Mode de collaboration |

### Contexte système

Le `systemContext` est une instruction globale qui apparaît en haut de chaque contexte assemblé, quel que soit le thread actif. Utilisez-le pour :

- Décisions techniques globales ("Nous utilisons TypeScript en mode strict")
- Vue d'ensemble de l'architecture ("Monorepo avec frontend Next.js et backend Express")
- Conventions de code ("Utiliser des composants fonctionnels, pas de classes")

## Lister les projets

```
project_list
```

Retourne tous les projets avec leur mode et met en évidence le projet actif :

```
- Mon App (mon-app) [solo] ← actif
- Projet Perso (projet-perso) [solo]
- Projet Équipe (projet-equipe) [team]
```

## Changer de projet

```
project_switch(projectId: "projet-perso")
```

Change le projet actif et réinitialise le thread actif à `main`.

## Modes de projet

### Mode Solo

Mode par défaut. Aucune restriction de propriété — vous pouvez modifier le résumé de n'importe quel thread.

### Mode Équipe

Active les workflows collaboratifs via git. Voir [Mode équipe](/fr/guide/team-mode) pour les détails.

Différence clé : en mode équipe, vous ne pouvez mettre à jour que les résumés des threads que vous avez créés. Vous pouvez toujours créer des threads enfants à partir de n'importe quel thread.

## Stockage

Chaque projet crée :

```
.threadmind/
  projects/
    mon-app.json          # Configuration du projet
  threads/
    mon-app/
      main.md             # Thread racine
      ...                 # Autres threads
  trees/
    mon-app.json          # Structure de l'arborescence
```

## Génération d'ID

Les IDs de projet sont auto-générés par slugification du titre :

| Titre | ID généré |
|-------|-------------|
| `"Mon App"` | `mon-app` |
| `"Plateforme E-Commerce"` | `plateforme-e-commerce` |
| `"API v2"` | `api-v2` |

Si l'ID existe déjà, un suffixe numérique est ajouté : `mon-app-2`, `mon-app-3`, etc.
