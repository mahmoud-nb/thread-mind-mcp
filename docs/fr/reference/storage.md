# Format de stockage

ThreadMind utilise un stockage basé sur des fichiers dans un dossier `.threadmind/`. Tous les fichiers sont lisibles et compatibles git.

## Structure des dossiers

```
.threadmind/
  .gitignore              # Exclut config.json du contrôle de version
  .lock                   # Verrou transitoire, présent seulement pendant une écriture
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
| `author` | `string` | ID auteur (`{nom_git}-{4 caractères hexa dérivés de git user.email}`), créé à la première écriture |
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

C'est le nom du fichier qui fait foi pour l'ID du thread : le champ `id` n'est qu'informatif. Les valeurs que YAML pourrait mal interpréter (`: `, guillemet ou tiret initial, `null`/`true`/`false`, espaces en bordure) sont écrites comme des chaînes JSON entre guillemets doubles, qui sont aussi du YAML valide. Le bloc se termine à la première ligne contenant exactement `---` : titres et résumés peuvent donc contenir `---`.

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
.lock
*.tmp
```

Cela garantit que l'état par utilisateur (projet/thread actif, ID auteur) reste local tandis que les fichiers de threads et les structures d'arbre sont partagés via git.

## Écritures atomiques

Toutes les écritures de fichiers utilisent un modèle atomique :
1. Écriture dans un fichier temporaire (`{chemin}.{uuid}.tmp`), vidé sur le disque
2. Renommage du fichier temporaire vers le chemin final (sous Windows, avec quelques nouvelles tentatives si un autre processus tient le fichier)
3. En cas d'échec, suppression du fichier temporaire

Un lecteur voit donc soit l'ancienne, soit la nouvelle version d'un fichier, jamais une version partielle, même si le processus est interrompu en cours d'écriture.

## Concurrence

Les opérations qui lisent puis modifient des fichiers (création, déplacement ou suppression de threads, mise à jour de résumé, changement de thread actif) s'exécutent une par une : dans un processus via une file d'attente en mémoire, et entre processus (plusieurs sessions sur le même dépôt) via le fichier `.threadmind/.lock`. Un verrou laissé par un processus planté est récupéré au bout de 10 secondes.

## Génération d'ID (slugification)

Les IDs de projets et threads sont générés par slugification des titres :

```
Entrée                          → Sortie
"Mon App"                       → "mon-app"
"Système Auth v2"               → "systeme-auth-v2"
"API (REST)"                    → "api-rest"
"  Espaces & Symboles!! "       → "espaces-symboles"
"Cœur métier"                   → "coeur-metier"
"认证模块"                        → "thread" (ou "project")
```

Règles :
1. Suppression des accents (`é` → `e`, `œ` → `oe`) et mise en minuscules
2. Remplacement des espaces/underscores par des tirets
3. Suppression des caractères autres que `a-z`, `0-9` et tirets
4. Fusion des tirets multiples, suppression des tirets en début/fin, 64 caractères maximum
5. S'il ne reste rien, utilisation de `thread` (ou `project`)

En cas de collision, ajout de `-2`, `-3`, etc. Les sauts de ligne dans les titres sont remplacés par des espaces.

Les IDs sont limités aux lettres minuscules, chiffres et tirets : les outils refusent tout autre ID, ce qui exclut aussi les chemins du type `../`.
