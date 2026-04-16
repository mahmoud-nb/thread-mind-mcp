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

### 2. Travailler et résumer

Menez votre conversation normale sur le sujet, puis sauvegardez un résumé :

```
Vous : [discutez des approches d'authentification avec l'IA...]
Vous : Résume ce qu'on a décidé dans le thread courant

IA :   [appelle summary_update]
       ✓ Résumé mis à jour pour le thread "main".
```

### 3. Créer des sous-threads

```
Vous : Crée un thread pour "Routes API"

IA :   [appelle thread_create]
       ✓ Thread "routes-api" créé sous "main".

       main
       └── routes-api ← actif
```

### 4. Consulter le contexte assemblé

```
Vous : Montre-moi le contexte ThreadMind actuel

IA :   [appelle context_get]
       ## Contexte système
       Nous construisons une application e-commerce Next.js

       ---

       ## Thread : Mon App Web
       Authentification : utilisation de JWT avec refresh tokens...

       ---

       ## Thread : Routes API (actif)
       [vide — commencez à discuter puis résumez]
```

### 5. Visualiser l'arborescence

```
Vous : Montre l'arborescence des threads

IA :   [appelle thread_list]
       main
       ├── routes-api ← actif
       └── schema-bdd
```

## Workflow recommandé

1. **Créez un projet** au début d'un nouveau codebase ou fonctionnalité
2. **Travaillez dans le thread principal** pour la planification initiale et les grandes décisions
3. **Branchez** quand vous plongez dans un sous-sujet spécifique
4. **Résumez** après chaque discussion significative — gardez les résumés concis (5-15 lignes)
5. **Changez de thread** quand vous changez de sujet
6. **Utilisez `context_get`** pour alimenter l'IA avec votre contexte structuré plutôt que l'historique brut

::: tip
De bons résumés sont la clé de l'efficacité de ThreadMind. Concentrez-vous sur les **décisions, résultats et choix techniques clés** — pas sur la conversation elle-même.
:::

## Prochaines étapes

- [Projets](/fr/guide/projects) — gestion des projets en détail
- [Threads](/fr/guide/threads) — création et gestion des threads
- [Assemblage du contexte](/fr/guide/context-assembly) — comment le contexte est construit
