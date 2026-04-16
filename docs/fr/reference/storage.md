# Format de stockage

ThreadMind utilise un stockage basé sur des fichiers dans un dossier `.threadmind/`. Tous les fichiers sont lisibles et compatibles git.

## Structure des dossiers

```
.threadmind/
  .gitignore              # Exclut config.json du contrôle de version
  config.json             # État local utilisateur (gitignoré)
  projects/
    {project-id}.json     # Configuration du projet
  threads/
    {project-id}/
      {thread-id}.md      # Fichiers thread (frontmatter + résumé)
  trees/
    {project-id}.json     # Index de l'arborescence
  stats/
    {project-id}.json     # Statistiques d'économie de tokens
```

## Formats de fichiers

### `config.json` (AppState)

État local par utilisateur. **Gitignoré** — chaque membre de l'équipe a le sien.

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
| `activeProjectId` | `string \| null` | Projet actuellement sélectionné |
| `activeThreadId` | `string \| null` | Thread actuellement sélectionné |
| `author` | `string` | ID auteur unique (`{nom_git}-{uuid}`) |
| `version` | `number` | Version du schéma pour les migrations |

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
| `id` | `string` | Identifiant slugifié du projet |
| `title` | `string` | Nom lisible du projet |
| `systemContext` | `string` | Prompt système global |
| `mode` | `"solo" \| "team"` | Mode de collaboration |
| `rootThreadId` | `string` | Toujours `"main"` |

---

### `threads/{project-id}/{thread-id}.md` (ThreadNode)

Fichier Markdown avec frontmatter YAML :

```markdown
---
id: systeme-auth
title: Système d'authentification
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

Authentification JWT avec refresh tokens.
bcrypt pour le hachage, salt rounds : 12.
Stratégie locale Passport.js.
```

**Champs du frontmatter (ThreadMetadata) :**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifiant du thread (correspond au nom du fichier) |
| `title` | `string` | Titre lisible du thread |
| `parentId` | `string \| "null"` | ID du thread parent, `"null"` pour la racine |
| `author` | `string` | ID de l'auteur qui a créé ce thread |
| `createdAt` | `string` | Horodatage ISO 8601 de création |
| `updatedAt` | `string` | Horodatage ISO 8601 de dernière mise à jour |

**Corps :** Contenu du résumé en Markdown (peut être vide pour les nouveaux threads).

---

### `trees/{project-id}.json` (TreeStructure)

Index dénormalisé pour une traversée rapide de l'arbre :

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
| `nodes[id].children` | `string[]` | Liste ordonnée des IDs des threads enfants |

::: info
Le fichier d'arbre est un **index dénormalisé** — les mêmes relations parent-enfant existent dans le frontmatter de chaque thread. Si le fichier d'arbre est corrompu ou a des conflits de merge, il peut être regénéré depuis les fichiers de threads.
:::

---

### `stats/{project-id}.json` (ProjectStats)

Statistiques d'économie de tokens, mises à jour automatiquement à chaque appel `summary_update` :

```json
{
  "projectId": "mon-app",
  "threads": {
    "main": {
      "updateCount": 4,
      "firstContentLength": 350,
      "currentContentLength": 280,
      "cumulativeInputLength": 1420,
      "lastUpdatedAt": "2026-04-15T14:30:00Z"
    },
    "systeme-auth": {
      "updateCount": 3,
      "firstContentLength": 200,
      "currentContentLength": 310,
      "cumulativeInputLength": 890,
      "lastUpdatedAt": "2026-04-15T16:00:00Z"
    }
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Projet auquel ce fichier de stats appartient |
| `threads` | `Record<string, SummaryStats>` | Statistiques par thread |
| `threads[id].updateCount` | `number` | Nombre d'appels à `summary_update` |
| `threads[id].firstContentLength` | `number` | Longueur en caractères du tout premier résumé |
| `threads[id].currentContentLength` | `number` | Longueur en caractères du dernier résumé |
| `threads[id].cumulativeInputLength` | `number` | Somme de toutes les longueurs de contenu soumises |
| `threads[id].lastUpdatedAt` | `string` | Horodatage ISO 8601 de la dernière mise à jour |

La métrique clé est le ratio entre `cumulativeInputLength` (texte total compressé) et `currentContentLength` (taille du résumé actuel). Cela mesure la quantité d'information que ThreadMind compresse au fil du temps.

::: tip
Les fichiers de stats sont purement informatifs. S'ils sont supprimés, ils se reconstruisent naturellement au fur et à mesure des appels à `summary_update`. Aucune donnée n'est perdue — seul le suivi historique est réinitialisé.
:::

---

### `.gitignore`

Créé automatiquement dans `.threadmind/` :

```
config.json
```

Cela garantit que l'état par utilisateur (projet/thread actif, ID auteur) reste local tandis que les fichiers de threads et les structures d'arbre sont partagés via git.

## Écritures atomiques

Toutes les écritures de fichiers utilisent un modèle atomique :
1. Écriture dans un fichier temporaire (`{chemin}.{uuid}.tmp`)
2. Écriture au chemin final
3. Suppression du fichier temporaire

Cela évite la corruption si le processus est interrompu en cours d'écriture.

## Génération d'ID (slugification)

Les IDs de projets et threads sont générés par slugification des titres :

```
Entrée                      → Sortie
"Mon App"                  → "mon-app"
"Système Auth v2"          → "systeme-auth-v2"
"API (REST)"               → "api-rest"
"  Espaces & Symboles!! "  → "espaces--symboles"
```

Règles :
1. Mise en minuscules
2. Remplacement des espaces/underscores par des tirets
3. Suppression des caractères non alphanumériques (sauf tirets)
4. Fusion des tirets multiples
5. Suppression des tirets en début/fin

En cas de collision, ajout de `-2`, `-3`, etc.
