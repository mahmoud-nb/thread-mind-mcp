# Format de stockage

ThreadMind utilise un stockage bas\u00e9 sur des fichiers dans un dossier `.threadmind/`. Tous les fichiers sont lisibles et compatibles git.

## Structure des dossiers

```
.threadmind/
  .gitignore              # Exclut config.json du contr\u00f4le de version
  config.json             # \u00c9tat local utilisateur (gitignor\u00e9)
  projects/
    {project-id}.json     # Configuration du projet
  threads/
    {project-id}/
      {thread-id}.md      # Fichiers thread (frontmatter + r\u00e9sum\u00e9)
  trees/
    {project-id}.json     # Index de l'arborescence
```

## Formats de fichiers

### `config.json` (AppState)

\u00c9tat local par utilisateur. **Gitignor\u00e9** \u2014 chaque membre de l'\u00e9quipe a le sien.

```json
{
  "activeProjectId": "mon-app",
  "activeThreadId": "auth-ui",
  "author": "mahmoud-a3f9",
  "version": 1
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `activeProjectId` | `string \| null` | Projet actuellement s\u00e9lectionn\u00e9 |
| `activeThreadId` | `string \| null` | Thread actuellement s\u00e9lectionn\u00e9 |
| `author` | `string` | ID auteur unique (`{nom_git}-{uuid}`) |
| `version` | `number` | Version du sch\u00e9ma pour les migrations |

---

### `projects/{id}.json` (ProjectConfig)

```json
{
  "id": "mon-app",
  "title": "Mon App",
  "systemContext": "Construction d'une application e-commerce Next.js",
  "mode": "solo",
  "rootThreadId": "main"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifiant slugifi\u00e9 du projet |
| `title` | `string` | Nom lisible du projet |
| `systemContext` | `string` | Prompt syst\u00e8me global |
| `mode` | `"solo" \| "team"` | Mode de collaboration |
| `rootThreadId` | `string` | Toujours `"main"` |

---

### `threads/{project-id}/{thread-id}.md` (ThreadNode)

Fichier Markdown avec frontmatter YAML :

```markdown
---
id: systeme-auth
title: Syst\u00e8me d'authentification
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

Authentification JWT avec refresh tokens.
bcrypt pour le hachage, salt rounds : 12.
Strat\u00e9gie locale Passport.js.
```

**Champs du frontmatter (ThreadMetadata) :**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifiant du thread (correspond au nom du fichier) |
| `title` | `string` | Titre lisible du thread |
| `parentId` | `string \| "null"` | ID du thread parent, `"null"` pour la racine |
| `author` | `string` | ID de l'auteur qui a cr\u00e9\u00e9 ce thread |
| `createdAt` | `string` | Horodatage ISO 8601 de cr\u00e9ation |
| `updatedAt` | `string` | Horodatage ISO 8601 de derni\u00e8re mise \u00e0 jour |

**Corps :** Contenu du r\u00e9sum\u00e9 en Markdown (peut \u00eatre vide pour les nouveaux threads).

---

### `trees/{project-id}.json` (TreeStructure)

Index d\u00e9normalis\u00e9 pour une travers\u00e9e rapide de l'arbre :

```json
{
  "nodes": {
    "main": {
      "parentId": null,
      "children": ["systeme-auth", "dashboard"]
    },
    "systeme-auth": {
      "parentId": "main",
      "children": ["auth-ui", "auth-api"]
    },
    "auth-ui": {
      "parentId": "systeme-auth",
      "children": []
    },
    "auth-api": {
      "parentId": "systeme-auth",
      "children": []
    },
    "dashboard": {
      "parentId": "main",
      "children": []
    }
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `nodes` | `Record<string, TreeNode>` | Map d'ID de thread vers parent/enfants |
| `nodes[id].parentId` | `string \| null` | ID du thread parent |
| `nodes[id].children` | `string[]` | Liste ordonn\u00e9e des IDs des threads enfants |

::: info
Le fichier d'arbre est un **index d\u00e9normalis\u00e9** \u2014 les m\u00eames relations parent-enfant existent dans le frontmatter de chaque thread. Si le fichier d'arbre est corrompu ou a des conflits de merge, il peut \u00eatre reg\u00e9n\u00e9r\u00e9 depuis les fichiers de threads.
:::

---

### `.gitignore`

Cr\u00e9\u00e9 automatiquement dans `.threadmind/` :

```
config.json
```

Cela garantit que l'\u00e9tat par utilisateur (projet/thread actif, ID auteur) reste local tandis que les fichiers de threads et les structures d'arbre sont partag\u00e9s via git.

## \u00c9critures atomiques

Toutes les \u00e9critures de fichiers utilisent un mod\u00e8le atomique :
1. \u00c9criture dans un fichier temporaire (`{chemin}.{uuid}.tmp`)
2. \u00c9criture au chemin final
3. Suppression du fichier temporaire

Cela \u00e9vite la corruption si le processus est interrompu en cours d'\u00e9criture.

## G\u00e9n\u00e9ration d'ID (slugification)

Les IDs de projets et threads sont g\u00e9n\u00e9r\u00e9s par slugification des titres :

```
Entr\u00e9e                      \u2192 Sortie
"Mon App"                  \u2192 "mon-app"
"Syst\u00e8me Auth v2"          \u2192 "systeme-auth-v2"
"API (REST)"               \u2192 "api-rest"
"  Espaces & Symboles!! "  \u2192 "espaces--symboles"
```

R\u00e8gles :
1. Mise en minuscules
2. Remplacement des espaces/underscores par des tirets
3. Suppression des caract\u00e8res non alphanum\u00e9riques (sauf tirets)
4. Fusion des tirets multiples
5. Suppression des tirets en d\u00e9but/fin

En cas de collision, ajout de `-2`, `-3`, etc.
