# Démarrage rapide

## Prérequis

- **Node.js** 18 ou supérieur
- Un **client IA compatible MCP** (Claude Code ou tout client supportant MCP)
- **Git** (optionnel : mode équipe, liens entre threads et branches, alertes de résumés périmés)

## Installation

ThreadMind ne nécessite aucune installation globale. Il s'exécute via `npx` :

```bash
npx thread-mind-mcp
```

## Configuration

### Quel setup utiliser ?

| Situation | Approche recommandée |
|-----------|---------------------|
| Claude Code | [Le plugin ThreadMind](#plugin-claude-code-recommande) |
| Claude Code sans le plugin, usage personnel | [Global — `~/.claude/settings.json`](#global-personnel-tous-les-projets) |
| Claude Code sans le plugin, projet en équipe | [Par projet — `.mcp.json`](#par-projet-equipe-mcp-json) |
| Cursor, Windsurf ou autre client MCP | [Autres clients MCP](#autres-clients-mcp) |

---

### Plugin Claude Code (recommandé)

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Le plugin installe le serveur et charge le contexte du thread actif au début de chaque session, après `/clear` et après une compaction. Voir [Plugin Claude Code](/fr/guide/claude-code-plugin). Les configurations manuelles ci-dessous sont des alternatives : ne les combinez pas avec le plugin.

---

### Claude Code — Global (personnel, tous les projets)

Disponible dans tous vos projets sans configuration supplémentaire. Recommandé si vous êtes seul sur le projet ou si vous souhaitez ThreadMind partout.

**Via CLI (le plus simple) :**

::: code-group

```bash [macOS / Linux]
claude mcp add thread-mind -- npx -y thread-mind-mcp
```

```bash [Windows]
claude mcp add thread-mind -- cmd /c npx thread-mind-mcp
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
      "args": ["/c", "npx", "thread-mind-mcp"],
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
claude mcp add thread-mind --scope project -- cmd /c npx thread-mind-mcp
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
      "args": ["/c", "npx", "thread-mind-mcp"],
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
      "args": ["/c", "npx", "thread-mind-mcp"],
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
      "args": ["/c", "volta", "run", "npx", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

Via CLI : `claude mcp add thread-mind -- cmd /c volta run npx -y thread-mind-mcp`
:::

### Emplacement du workspace

ThreadMind stocke ses données dans `.threadmind/` à la racine de votre workspace, déterminée dans cet ordre :

1. La variable d'environnement `THREADMIND_ROOT`, si elle est définie
2. Les racines (roots) de workspace annoncées par votre client MCP (celle qui contient déjà `.threadmind/` est prioritaire)
3. Le dossier depuis lequel le serveur a été lancé — votre projet, avec Claude Code

Un client qui lance les serveurs hors de votre projet sans annoncer de racines a besoin de `THREADMIND_ROOT` :

```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"],
      "env": { "THREADMIND_ROOT": "/chemin/vers/votre/projet" }
    }
  }
}
```

## Votre premier projet

Une fois ThreadMind configuré, lancez une conversation avec votre IA et utilisez les outils :

### 1. Créer un projet

```
Vous : Crée un projet ThreadMind appelé "Mon App Web" avec comme contexte système
       "Nous construisons une application e-commerce Next.js"

IA :   [appelle project_create]
       ✓ Projet "mon-app-web" créé (mode : solo). Thread principal actif.
```

### 2. Configurer d'autres agents (optionnel)

Le serveur envoie ses consignes d'utilisation à votre client IA dès la connexion, raccourcis `tm:` compris : Claude Code charge le contexte au début de chaque session sans aucun fichier de configuration.

Pour les agents qui ne lisent pas les instructions de serveur MCP, générez un fichier `AGENTS.md` (lu par Codex, Cursor, GitHub Copilot et d'autres) :

```
Vous : tm:init

IA :   [appelle threadmind_init]
       ✓ Fichiers générés : AGENTS.md, .threadmind/instructions.md
```

::: tip
Si une version précédente a généré une section ThreadMind dans `CLAUDE.md`, supprimez-la : Claude Code reçoit désormais les mêmes consignes du serveur, et les chargerait sinon deux fois. `threadmind_init` signale ce type de reste.
:::

### 3. Travailler et résumer

Menez votre conversation normale sur le sujet, puis sauvegardez un résumé :

```
Vous : [discutez des approches d'authentification avec l'IA...]
Vous : tm:summary

IA :   [rédige le résumé en sections, puis appelle summary_update]
       ✓ Résumé mis à jour pour le thread "main".
```

Par la suite, une seule décision peut être ajoutée sans tout réécrire : `summary_update` avec `section: "decisions"`.

### 4. Créer des sous-threads

```
Vous : tm:create Routes API

IA :   [appelle thread_create]
       ✓ Thread "routes-api" créé sous "main".

       main
       └── routes-api ← actif
```

Sur une branche de fonctionnalité, le thread lui est lié : dès que la branche est récupérée, il devient le thread actif.

### 5. Repartir de zéro quand la conversation s'allonge

Quand la conversation devient longue, sauvegardez le résumé et lancez `/clear`. Avec le plugin, la nouvelle session démarre avec le contexte du thread :

```
## Thread: Mon App Web

## Décisions
- Next.js 15, PostgreSQL, Stripe

---

## Thread: Routes API (active)

## État
- Routes produits et panier faites

---
_ThreadMind context: ~180 tokens | depth: 2 threads_
```

Sans le plugin, demandez `tm:context` dans la nouvelle session.

### 6. Visualiser l'arborescence

```
Vous : tm:tree

IA :   [appelle thread_list]
       main
       ├── routes-api ← active
       └── schema-bdd
```

### 7. Terminer un thread

```
Vous : tm:merge

IA :   [rédige le nouveau résumé du parent, puis appelle thread_merge]
       ✓ Thread "routes-api" intégré dans "main", qui devient le thread actif.
```

### 8. Consulter les chiffres

```
Vous : tm:stats

IA :   [appelle stats_show]
       Measured sessions (Claude Code plugin):
         Conversation size when sessions ended: ~48,200 tokens on average
         ThreadMind context loaded at session start: ~1,150 tokens on average
```

## Référence rapide des raccourcis

Vous pouvez taper ces raccourcis directement dans le chat (les instructions du serveur les apprennent à l'IA) :

| Commande | Action |
|----------|--------|
| `tm:help` | Afficher toutes les commandes disponibles |
| `tm:context` | Charger le contexte assemblé |
| `tm:tree` | Afficher l'arborescence des threads |
| `tm:create <titre>` | Créer un nouveau thread |
| `tm:switch <id>` | Basculer vers un thread |
| `tm:rebase` | Déplacer un thread vers un parent différent (comme `git rebase`). |
| `tm:summary` | Rédiger et sauvegarder le résumé |
| `tm:summary <contenu>` | Sauvegarder un contenu de résumé spécifique |
| `tm:merge` | Intégrer le thread dans son parent |
| `tm:done [raison]` | Marquer le thread terminé |
| `tm:abandon <raison>` | Marquer le thread abandonné |
| `tm:stats` | Afficher les statistiques |
| `tm:delete <id>` | Supprimer un thread |
| `tm:init` | Générer les fichiers d'instructions |
| `tm:project <titre>` | Créer un nouveau projet |
| `tm:projects` | Lister tous les projets |

Ces raccourcis fonctionnent aussi comme Prompts MCP (slash commands) dans Claude Code : `/mcp__thread-mind__tm-help`, etc.

## Workflow recommandé

1. **Créez un projet** au début d'un nouveau codebase ou fonctionnalité
2. **Travaillez dans le thread principal** pour la planification initiale et les grandes décisions
3. **Branchez** quand vous plongez dans un sous-sujet (`tm:create <titre>`), idéalement sur sa branche git
4. **Notez les décisions** au fil de l'eau (`tm:summary`)
5. **Repartez de zéro** avec `/clear` quand la conversation s'allonge : le contexte du thread est conservé
6. **Changez de thread** quand vous changez de sujet (`tm:switch <id>`)
7. **Intégrez ou clôturez** les threads terminés (`tm:merge`, `tm:done`, `tm:abandon`)
8. **Consultez les chiffres** avec `tm:stats`

::: tip
De bons résumés sont la clé de l'efficacité de ThreadMind. Mettez ce qui doit rester vrai dans les **Décisions** et **Contraintes** : c'est ce dont héritent les threads enfants.
:::

## Prochaines étapes

- [Projets](/fr/guide/projects) — gestion des projets en détail
- [Threads](/fr/guide/threads) — création et gestion des threads
- [Assemblage du contexte](/fr/guide/context-assembly) — comment le contexte est construit
