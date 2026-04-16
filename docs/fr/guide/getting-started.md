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

### Claude Code

Ajoutez la configuration suivante dans votre fichier de paramètres MCP :

**Globale** (`~/.claude/settings.json`) :
```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

**Par projet** (`.claude/settings.json` dans votre dépôt) :
```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

### Autres clients MCP

Tout client supportant le transport stdio MCP peut utiliser ThreadMind avec le même modèle de configuration.

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
