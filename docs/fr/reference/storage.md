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
```

Les fichiers de threads sont l'arbre : chacun enregistre son parent, et ThreadMind reconstruit l'arbre à partir d'eux. Il n'y a pas d'index séparé à maintenir ni à faire entrer en conflit dans git.

## Formats de fichiers

### `config.json` (AppState)

État local par utilisateur. **Gitignoré** — chaque membre de l'équipe a le sien.

```json
{
  "activeProjectId": "mon-app",
  "activeThreadId": "auth-ui",
  "author": "mahmoud-a3f9",
  "version": 1,
  "branchThreads": {
    "mon-app": { "main": "main", "feature/auth-ui": "auth-ui" }
  },
  "sessions": [
    {
      "sessionId": "b1f3…",
      "projectId": "mon-app",
      "startedAt": "2026-09-27T09:00:00.000Z",
      "source": "clear",
      "injectedTokens": 1150,
      "endedAt": "2026-09-27T11:40:00.000Z",
      "endReason": "clear",
      "finalContextTokens": 48200
    }
  ]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `activeProjectId` | `string \| null` | Dernier projet utilisé : là où démarrent les nouvelles sessions |
| `activeThreadId` | `string \| null` | Dernier thread utilisé, le repli hors de git |
| `author` | `string` | ID auteur (`{nom_git}-{4 caractères hexa dérivés de git user.email}`), créé à la première écriture |
| `version` | `number` | Version du schéma pour les migrations |
| `branchThreads` | `object` | Dernier thread utilisé sur chaque branche git, par projet |
| `sessions` | `array` | Les 50 dernières sessions mesurées par le [plugin Claude Code](/fr/guide/claude-code-plugin) |

Chaque session garde son propre thread actif en mémoire ; ce fichier indique seulement où démarre la session suivante.

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
id: auth-ui
title: Auth UI
parentId: auth
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00.000Z
updatedAt: 2026-04-15T12:30:00.000Z
branch: feature/auth-ui
commit: 3f2a9c1e5b7d4a8f0c6e2b1d9a7f5c3e1b0d8a6f
paths: ["src/auth"]
---

## Décisions
- Formulaire de connexion avec React Hook Form

## État
- Inscription faite, réinitialisation du mot de passe à faire
```

**Champs du frontmatter (ThreadMetadata) :**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifiant du thread (correspond au nom du fichier) |
| `title` | `string` | Titre lisible du thread |
| `parentId` | `string \| "null"` | ID du thread parent, `"null"` pour la racine |
| `author` | `string` | ID de l'auteur qui a créé ce thread |
| `createdAt` | `string` | Horodatage ISO 8601 de création ; ordonne les enfants dans l'arbre |
| `updatedAt` | `string` | Horodatage ISO 8601 de dernière mise à jour |
| `status` | `"done" \| "abandoned"` | Absent pour un thread actif |
| `branch` | `string` | Branche git à laquelle le thread est lié |
| `commit` | `string` | Commit HEAD lors de la dernière écriture du résumé |
| `paths` | `string[]` | Fichiers ou dossiers couverts par le résumé, pour le signaler quand ils changent |
| `mergedInto` | `string` | Parent dans lequel le thread a été intégré |

Les cinq derniers champs n'apparaissent que lorsqu'ils sont renseignés. **Corps :** résumé en Markdown, idéalement avec les sections Décisions, Contraintes, État, Questions ouvertes, Prochaines étapes (voir [Threads](/fr/guide/threads#mettre-a-jour-les-resumes)).

C'est le nom du fichier qui fait foi pour l'ID du thread : le champ `id` n'est qu'informatif. Les valeurs que YAML pourrait mal interpréter (`: `, guillemet ou tiret initial, `null`/`true`/`false`, espaces en bordure) sont écrites comme des chaînes JSON entre guillemets doubles, qui sont aussi du YAML valide. Le bloc se termine à la première ligne contenant exactement `---` : titres et résumés peuvent donc contenir `---`.

Un thread dont le fichier parent manque est affiché comme une racine, pour rester visible.

---

### `.gitignore`

Créé automatiquement dans `.threadmind/` :

```
config.json
.lock
*.tmp
```

Cela garantit que l'état par utilisateur (projet/thread actif, ID auteur, mesures de sessions) reste local tandis que les fichiers de threads sont partagés via git.

## Mise à jour depuis la 0.4

Les versions précédentes écrivaient aussi :

- `trees/{project-id}.json`, un index qui dupliquait le parent de chaque thread. C'était lui qui était lu : à la première utilisation, ThreadMind aligne les fichiers de threads sur lui, puis le supprime.
- `stats/{project-id}.json`, les anciennes statistiques estimées. Il n'est plus ni lu ni écrit, et peut être supprimé.

## Écritures atomiques

Toutes les écritures de fichiers utilisent un modèle atomique :
1. Écriture dans un fichier temporaire (`{chemin}.{uuid}.tmp`), vidé sur le disque
2. Renommage du fichier temporaire vers le chemin final (sous Windows, avec quelques nouvelles tentatives si un autre processus tient le fichier)
3. En cas d'échec, suppression du fichier temporaire

Un lecteur voit donc soit l'ancienne, soit la nouvelle version d'un fichier, jamais une version partielle, même si le processus est interrompu en cours d'écriture.

## Concurrence

Les opérations qui lisent puis modifient des fichiers (création, déplacement ou suppression de threads, mise à jour de résumé, enregistrement du thread actif) s'exécutent une par une : dans un processus via une file d'attente en mémoire, et entre processus (plusieurs sessions sur le même dépôt, les hooks du plugin) via le fichier `.threadmind/.lock`. Un verrou laissé par un processus planté est récupéré au bout de 10 secondes.

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
