# Threads

Un **thread** est un n\u0153ud dans l'arborescence repr\u00e9sentant un sujet de discussion sp\u00e9cifique. Chaque thread stocke un r\u00e9sum\u00e9 concis en Markdown.

## Arborescence de threads

Les threads forment un arbre enracin\u00e9 au thread `main` :

```
main
\u251c\u2500\u2500 auth
\u2502   \u251c\u2500\u2500 auth-ui
\u2502   \u2514\u2500\u2500 auth-api
\u251c\u2500\u2500 database
\u2502   \u2514\u2500\u2500 migrations
\u2514\u2500\u2500 deploiement
```

Chaque thread a exactement un parent (sauf `main` qui n'en a pas) et peut avoir plusieurs enfants.

## Cr\u00e9er des threads

```
thread_create(title: "Syst\u00e8me Auth", parentId: "main")
```

| Param\u00e8tre | Type | D\u00e9faut | Description |
|-----------|------|---------|-------------|
| `title` | string | requis | Titre du thread |
| `parentId` | string | thread actif | Parent \u00e0 partir duquel brancher |

Si `parentId` est omis, le nouveau thread branche depuis le **thread actif**.

Le nouveau thread devient automatiquement le thread actif.

### G\u00e9n\u00e9ration d'ID

Les IDs suivent les m\u00eames r\u00e8gles de slugification que les projets :

| Titre | ID |
|-------|----|
| `"Syst\u00e8me Auth"` | `systeme-auth` |
| `"Routes API v2"` | `routes-api-v2` |

Les doublons re\u00e7oivent des suffixes num\u00e9riques : `systeme-auth-2`.

## Changer de thread

```
thread_switch(threadId: "auth-ui")
```

Bascule sur le thread indiqu\u00e9. L'outil retourne un aper\u00e7u du contexte assembl\u00e9 pour confirmation.

## Visualiser l'arborescence

```
thread_list
```

Retourne un arbre ASCII avec le thread actif marqu\u00e9 :

```
main
\u251c\u2500\u2500 auth
\u2502   \u251c\u2500\u2500 auth-ui \u2190 actif
\u2502   \u2514\u2500\u2500 auth-api
\u251c\u2500\u2500 database
\u2502   \u2514\u2500\u2500 migrations
\u2514\u2500\u2500 deploiement
```

## Mettre \u00e0 jour les r\u00e9sum\u00e9s

```
summary_update(content: "Impl\u00e9ment\u00e9 l'auth JWT avec...", threadId: "auth")
```

| Param\u00e8tre | Type | D\u00e9faut | Description |
|-----------|------|---------|-------------|
| `content` | string | requis | Nouveau r\u00e9sum\u00e9 (markdown) |
| `threadId` | string | thread actif | Thread \u00e0 mettre \u00e0 jour |

### R\u00e9diger de bons r\u00e9sum\u00e9s

Les r\u00e9sum\u00e9s sont au c\u0153ur de la valeur de ThreadMind. Ils doivent \u00eatre :

- **Concis** \u2014 5-15 lignes, capturant l'essentiel
- **Orient\u00e9s d\u00e9cisions** \u2014 ce qui a \u00e9t\u00e9 d\u00e9cid\u00e9 et pourquoi
- **Actionnables** \u2014 ce qui a \u00e9t\u00e9 impl\u00e9ment\u00e9, o\u00f9 en est-on

**Bon r\u00e9sum\u00e9 :**
```markdown
Impl\u00e9mentation de l'authentification JWT :
- Access tokens (15min) + refresh tokens (7j)
- bcrypt pour le hachage, salt rounds : 12
- Strat\u00e9gie locale Passport.js pour le login
- Tokens stock\u00e9s en cookies httpOnly (pas localStorage)
- D\u00e9cision : pas d'OAuth pour v1, ajout pr\u00e9vu en v2
```

**Mauvais r\u00e9sum\u00e9 :**
```markdown
On a parl\u00e9 d'auth et on a d\u00e9cid\u00e9 d'utiliser JWT.
L'IA a sugg\u00e9r\u00e9 plusieurs options et on en a choisi une.
```

## Supprimer des threads

```
thread_delete(threadId: "auth-api")
```

Supprime le thread **et tous ses descendants**. Le thread `main` ne peut pas \u00eatre supprim\u00e9.

Si le thread actif est supprim\u00e9, le thread actif revient \u00e0 `main`.

En mode \u00e9quipe, vous ne pouvez supprimer que les threads dont vous \u00eates l'auteur.

## Format des fichiers thread

Chaque thread est stock\u00e9 comme un fichier Markdown avec frontmatter YAML :

```markdown
---
id: systeme-auth
title: Syst\u00e8me d'authentification
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

Impl\u00e9mentation de l'authentification JWT avec refresh tokens.
bcrypt pour le hachage. Strat\u00e9gie locale Passport.js.
D\u00e9cision : pas d'OAuth pour v1.
```

Le frontmatter contient les m\u00e9tadonn\u00e9es ; le corps est le contenu du r\u00e9sum\u00e9.
