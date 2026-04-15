# Projets

Un **projet** est l'espace de travail principal de ThreadMind. Il regroupe une arborescence de threads, un contexte syst\u00e8me et une configuration.

## Cr\u00e9er un projet

```
project_create(title: "Mon App", systemContext: "...", mode: "solo")
```

Cela va :
1. G\u00e9n\u00e9rer un ID \u00e0 partir du titre (`"Mon App"` \u2192 `"mon-app"`)
2. Cr\u00e9er le fichier de configuration du projet
3. Cr\u00e9er le thread racine `main`
4. Initialiser l'arborescence
5. G\u00e9n\u00e9rer votre identifiant auteur unique (depuis `git config user.name` + UUID court)
6. D\u00e9finir ce projet comme actif

### Param\u00e8tres

| Param\u00e8tre | Type | D\u00e9faut | Description |
|-----------|------|---------|-------------|
| `title` | string | requis | Nom lisible du projet |
| `systemContext` | string | `""` | Prompt syst\u00e8me global inclus dans chaque assemblage de contexte |
| `mode` | `"solo"` \| `"team"` | `"solo"` | Mode de collaboration |

### Contexte syst\u00e8me

Le `systemContext` est une instruction globale qui appara\u00eet en haut de chaque contexte assembl\u00e9, quel que soit le thread actif. Utilisez-le pour :

- D\u00e9cisions techniques globales ("Nous utilisons TypeScript en mode strict")
- Vue d'ensemble de l'architecture ("Monorepo avec frontend Next.js et backend Express")
- Conventions de code ("Utiliser des composants fonctionnels, pas de classes")

## Lister les projets

```
project_list
```

Retourne tous les projets avec leur mode et met en \u00e9vidence le projet actif :

```
- Mon App (mon-app) [solo] \u2190 actif
- Projet Perso (projet-perso) [solo]
- Projet \u00c9quipe (projet-equipe) [team]
```

## Changer de projet

```
project_switch(projectId: "projet-perso")
```

Change le projet actif et r\u00e9initialise le thread actif \u00e0 `main`.

## Modes de projet

### Mode Solo

Mode par d\u00e9faut. Aucune restriction de propri\u00e9t\u00e9 \u2014 vous pouvez modifier le r\u00e9sum\u00e9 de n'importe quel thread.

### Mode \u00c9quipe

Active les workflows collaboratifs via git. Voir [Mode \u00e9quipe](/fr/guide/team-mode) pour les d\u00e9tails.

Diff\u00e9rence cl\u00e9 : en mode \u00e9quipe, vous ne pouvez mettre \u00e0 jour que les r\u00e9sum\u00e9s des threads que vous avez cr\u00e9\u00e9s. Vous pouvez toujours cr\u00e9er des threads enfants \u00e0 partir de n'importe quel thread.

## Stockage

Chaque projet cr\u00e9e :

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

## G\u00e9n\u00e9ration d'ID

Les IDs de projet sont auto-g\u00e9n\u00e9r\u00e9s par slugification du titre :

| Titre | ID g\u00e9n\u00e9r\u00e9 |
|-------|-------------|
| `"Mon App"` | `mon-app` |
| `"Plateforme E-Commerce"` | `plateforme-e-commerce` |
| `"API v2"` | `api-v2` |

Si l'ID existe d\u00e9j\u00e0, un suffixe num\u00e9rique est ajout\u00e9 : `mon-app-2`, `mon-app-3`, etc.
