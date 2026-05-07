# Démarrage rapide

## Prérequis

- **Node.js** 18 ou supérieur
- Un **client IA compatible MCP** (Claude Code ou tout client supportant MCP)
- **Git** (optionnel, requis pour le mode équipe)

## Installation

ThreadMind ne nécessite aucune installation globale. Il s'exécute via `npx` :

```bash
npx thread-mind-mcp
```

## Configuration

### Quel setup utiliser ?

| Situation | Approche recommandée |
|-----------|---------------------|
| Usage personnel, tous vos projets | [Global — `~/.claude/settings.json`](#global-personnel-tous-les-projets) |
| Projet en équipe, partagé via git | [Par projet — `.mcp.json`](#par-projet-equipe-mcp-json) |
| Cursor, Windsurf ou autre client MCP | [Autres clients MCP](#autres-clients-mcp) |

---

### Claude Code — Global (personnel, tous les projets)

Disponible dans tous vos projets sans configuration supplémentaire. Recommandé si vous êtes seul sur le projet ou si vous souhaitez ThreadMind partout.

**Via CLI (le plus simple) :**

::: code-group

```bash [macOS / Linux]
claude mcp add thread-mind -- npx -y thread-mind-mcp
```

```bash [Windows]
claude mcp add thread-mind -- cmd /c npx -y thread-mind-mcp
```

:::

**Ou manuellement** dans `~/.claude/settings.json` :

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

---

### Claude Code — Par projet / Équipe (`.mcp.json`)

Crée un fichier `.mcp.json` à la racine du projet. **Commitez-le dans git** — vos coéquipiers ont automatiquement le MCP configuré après un `git pull`, sans aucune configuration manuelle.

**Via CLI (le plus simple) :**

::: code-group

```bash [macOS / Linux]
claude mcp add thread-mind --scope project -- npx -y thread-mind-mcp
```

```bash [Windows]
claude mcp add thread-mind --scope project -- cmd /c npx -y thread-mind-mcp
```

:::

Cela crée un `.mcp.json` à la racine du projet :

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

::: tip
`.mcp.json` est différent de `.claude/settings.json`. Ce dernier stocke les préférences personnelles de Claude Code (permissions, hooks) et est généralement gitignored. `.mcp.json` est spécifiquement conçu pour la configuration MCP partagée en équipe.
:::

---

### Autres clients MCP

ThreadMind utilise le transport **stdio MCP standard** et fonctionne avec tout client compatible — Cursor, Windsurf, Continue, et autres. Ajoutez-le dans le fichier de configuration MCP de votre client :

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

Consultez la documentation de votre client pour connaître l'emplacement exact du fichier de configuration.

::: tip
Après tout changement de configuration, **redémarrez complètement votre client IA** pour que les modifications MCP prennent effet.
:::

::: details Windows avec Volta (gestionnaire de versions Node.js)
Si vous utilisez **Volta**, son shim `npx` peut ne pas être résolvable quand votre client IA spawn des sous-processus — celui-ci hérite du PATH système, pas du PATH de votre session shell. Utilisez `volta run` pour déléguer explicitement la résolution de version :

```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "volta", "run", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

Via CLI : `claude mcp add thread-mind -- cmd /c volta run npx -y thread-mind-mcp`
:::

## Votre premier projet

Une fois ThreadMind configuré, lancez une conversation avec votre IA et utilisez les outils :

### 1. Créer un projet

```
Vous : Crée un projet ThreadMind appelé "Mon App Web" avec comme contexte système
       "Nous construisons une application e-commerce Next.js"

IA :   [appelle project_create]
       ✓ Projet "mon-app-web" créé (mode : solo). Thread principal actif.
```

### 2. Générer les fichiers d'instructions

```
Vous : tm:init

IA :   [appelle threadmind_init]
       ✓ Fichiers générés : CLAUDE.md, .cursorrules, instructions.md
```

Cela génère des fichiers d'instructions qui apprennent à votre client IA à utiliser ThreadMind automatiquement — y compris les raccourcis `tm:` que vous pouvez taper directement dans le chat.

::: tip
Exécutez toujours `tm:init` (ou `threadmind_init`) juste après avoir créé un projet. Le fichier `CLAUDE.md` généré indique à Claude Code d'utiliser proactivement ThreadMind à chaque début de session.
:::

### 3. Travailler et résumer

Menez votre conversation normale sur le sujet, puis sauvegardez un résumé :

```
Vous : [discutez des approches d'authentification avec l'IA...]
Vous : tm:summary

IA :   [génère un résumé, puis appelle summary_update]
       ✓ Résumé mis à jour pour le thread "main".
```

### 4. Créer des sous-threads

```
Vous : tm:create Routes API

IA :   [appelle thread_create]
       ✓ Thread "routes-api" créé sous "main".

       main
       └── routes-api ← actif
```

### 5. Consulter le contexte assemblé

```
Vous : tm:context

IA :   [appelle context_get]
       ## Contexte système
       Nous construisons une application e-commerce Next.js

       ---

       ## Thread : Mon App Web
       Authentification : utilisation de JWT avec refresh tokens...

       ---

       ## Thread : Routes API (actif)
       [vide — commencez à discuter puis résumez]

       ---
       _ThreadMind context: ~180 tokens | depth: 2 threads_
       _Estimated raw history: ~3,400 tokens (~95% reduction from 4 summary updates)_
```

### 6. Visualiser l'arborescence

```
Vous : tm:tree

IA :   [appelle thread_list]
       main
       ├── routes-api ← actif
       └── schema-bdd
```

### 7. Consulter les économies de tokens

```
Vous : tm:stats

IA :   [appelle stats_show]
       ThreadMind Stats: "Mon App Web"

       Overview:
         Threads: 3 (2 with content)
         Summary updates: 4
         Current context: ~180 tokens (depth: 2)

       Token Savings (estimated):
         Estimated raw history: ~3,400 tokens
         ThreadMind context:    ~180 tokens
         Reduction:             ~95%
```

## Référence rapide des raccourcis

Après avoir exécuté `threadmind_init`, vous pouvez taper ces raccourcis directement dans le chat :

| Commande | Action |
|----------|--------|
| `tm:help` | Afficher toutes les commandes disponibles |
| `tm:context` | Charger le contexte assemblé |
| `tm:tree` | Afficher l'arborescence des threads |
| `tm:create <titre>` | Créer un nouveau thread |
| `tm:switch <id>` | Basculer vers un thread |
| `tm:rebase` | Déplacer un thread vers un parent différent (comme `git rebase`). |
| `tm:summary` | Auto-générer et sauvegarder un résumé |
| `tm:summary <contenu>` | Sauvegarder un contenu de résumé spécifique |
| `tm:stats` | Afficher les statistiques d'économie de tokens |
| `tm:delete <id>` | Supprimer un thread |
| `tm:init` | Générer les fichiers d'instructions |
| `tm:project <titre>` | Créer un nouveau projet |
| `tm:projects` | Lister tous les projets |

Ces raccourcis fonctionnent aussi comme Prompts MCP (slash commands) dans Claude Code : `/mcp__thread-mind__tm-help`, etc.

## Workflow recommandé

1. **Créez un projet** au début d'un nouveau codebase ou fonctionnalité
2. **Exécutez `tm:init`** pour générer les fichiers d'instructions pour votre client IA
3. **Travaillez dans le thread principal** pour la planification initiale et les grandes décisions
4. **Branchez** quand vous plongez dans un sous-sujet spécifique (`tm:create <titre>`)
5. **Résumez** après chaque discussion significative (`tm:summary`)
6. **Changez de thread** quand vous changez de sujet (`tm:switch <id>`)
7. **Utilisez `tm:context`** pour alimenter l'IA avec votre contexte structuré plutôt que l'historique brut
8. **Consultez les économies** avec `tm:stats` pour voir la compression de votre contexte

::: tip
De bons résumés sont la clé de l'efficacité de ThreadMind. Concentrez-vous sur les **décisions, résultats et choix techniques clés** — pas sur la conversation elle-même.
:::

## Prochaines étapes

- [Projets](/fr/guide/projects) — gestion des projets en détail
- [Threads](/fr/guide/threads) — création et gestion des threads
- [Assemblage du contexte](/fr/guide/context-assembly) — comment le contexte est construit
