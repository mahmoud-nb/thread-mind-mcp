# Threads

Un **thread** est un nœud dans l'arborescence représentant un sujet de discussion spécifique. Chaque thread stocke un résumé concis en Markdown.

## Arborescence de threads

Les threads forment un arbre enraciné au thread `main` :

```
main
├── auth
│   ├── auth-ui
│   └── auth-api
├── database
│   └── migrations
└── deploiement
```

Chaque thread a exactement un parent (sauf `main` qui n'en a pas) et peut avoir plusieurs enfants.

## Créer des threads

```
thread_create(title: "Système Auth", parentId: "main")
```

| Paramètre | Type | Défaut | Description |
|-----------|------|---------|-------------|
| `title` | string | requis | Titre du thread |
| `parentId` | string | thread actif | Parent à partir duquel brancher |

Si `parentId` est omis, le nouveau thread branche depuis le **thread actif**.

Le nouveau thread devient automatiquement le thread actif.

### Génération d'ID

Les IDs suivent les mêmes règles de slugification que les projets :

| Titre | ID |
|-------|----|
| `"Système Auth"` | `systeme-auth` |
| `"Routes API v2"` | `routes-api-v2` |

Les doublons reçoivent des suffixes numériques : `systeme-auth-2`.

## Changer de thread

```
thread_switch(threadId: "auth-ui")
```

Bascule sur le thread indiqué. L'outil retourne un aperçu du contexte assemblé pour confirmation.

## Visualiser l'arborescence

```
thread_list
```

Retourne un arbre ASCII avec le thread actif marqué :

```
main
├── auth
│   ├── auth-ui ← actif
│   └── auth-api
├── database
│   └── migrations
└── deploiement
```

## Mettre à jour les résumés

```
summary_update(content: "Implémenté l'auth JWT avec...", threadId: "auth")
```

| Paramètre | Type | Défaut | Description |
|-----------|------|---------|-------------|
| `content` | string | requis | Nouveau résumé (markdown) |
| `threadId` | string | thread actif | Thread à mettre à jour |

### Rédiger de bons résumés

Les résumés sont au cœur de la valeur de ThreadMind. Ils doivent être :

- **Concis** — 5-15 lignes, capturant l'essentiel
- **Orientés décisions** — ce qui a été décidé et pourquoi
- **Actionnables** — ce qui a été implémenté, où en est-on

**Bon résumé :**
```markdown
Implémentation de l'authentification JWT :
- Access tokens (15min) + refresh tokens (7j)
- bcrypt pour le hachage, salt rounds : 12
- Stratégie locale Passport.js pour le login
- Tokens stockés en cookies httpOnly (pas localStorage)
- Décision : pas d'OAuth pour v1, ajout prévu en v2
```

**Mauvais résumé :**
```markdown
On a parlé d'auth et on a décidé d'utiliser JWT.
L'IA a suggéré plusieurs options et on en a choisi une.
```

## Supprimer des threads

```
thread_delete(threadId: "auth-api")
```

Supprime le thread **et tous ses descendants**. Le thread `main` ne peut pas être supprimé.

Si le thread actif est supprimé, le thread actif revient à `main`.

En mode équipe, vous ne pouvez supprimer que les threads dont vous êtes l'auteur.

## Format des fichiers thread

Chaque thread est stocké comme un fichier Markdown avec frontmatter YAML :

```markdown
---
id: systeme-auth
title: Système d'authentification
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

Implémentation de l'authentification JWT avec refresh tokens.
bcrypt pour le hachage. Stratégie locale Passport.js.
Décision : pas d'OAuth pour v1.
```

Le frontmatter contient les métadonnées ; le corps est le contenu du résumé.
