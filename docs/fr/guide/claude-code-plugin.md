# Plugin Claude Code

Le plugin ThreadMind pour Claude Code réunit le serveur MCP, deux hooks et une série de commandes. C'est l'installation recommandée pour Claude Code : le contexte du thread actif se charge tout seul au début de chaque session.

## Installation

Dans Claude Code :

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Claude Code installe le serveur ThreadMind avec le plugin, puis le lance avec `node` : ni `npx` ni `cmd /c`, sous Windows comme ailleurs.

::: warning
Si vous aviez configuré ThreadMind à la main (`.mcp.json` ou `claude mcp add`), retirez cette configuration : sinon Claude Code lance deux serveurs ThreadMind.
:::

## Ce qu'il fait

### Le contexte au démarrage

Au début d'une session, après `/clear` et après une compaction, le plugin injecte dans la conversation le contexte assemblé du thread actif, le même texte que renvoie `context_get`. L'IA démarre avec vos décisions, sans avoir à appeler `context_get`.

C'est ce qui fait réellement économiser des tokens avec ThreadMind : quand une conversation s'est allongée, lancez `/clear`. La nouvelle session démarre avec le contexte du thread (en général quelques centaines à quelques milliers de tokens) au lieu de tout l'historique.

Après une compaction automatique, le contexte injecté demande aussi à l'IA d'enregistrer toute décision présente dans le résumé de compaction mais absente du résumé du thread : rien ne se perd.

Rien n'est injecté dans un dépôt sans projet ThreadMind, et le hook n'y crée aucun fichier.

### Des statistiques mesurées

À la fin d'une session, le plugin lit la taille de la conversation dans son transcript : le prompt du dernier tour et sa réponse, tels que l'API les a comptés. `stats_show` montre alors ce que pesaient réellement les sessions, à côté du contexte chargé par le plugin à leur démarrage :

```
Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)
```

Les mesures restent dans `.threadmind/config.json`, qui n'est pas commité. Les 50 dernières sessions sont conservées.

### Commandes

| Commande | Action |
|----------|--------|
| `/thread-mind:context` | Recharger le contexte du thread actif |
| `/thread-mind:tree` | Afficher l'arbre des threads |
| `/thread-mind:create <titre>` | Créer un thread sous le thread actif |
| `/thread-mind:switch <id-du-thread>` | Faire passer cette session sur un autre thread |
| `/thread-mind:summary [ce qu'il faut noter]` | Noter un point dans la bonne section, ou réécrire tout le résumé |
| `/thread-mind:merge` | Intégrer le thread terminé dans son parent |
| `/thread-mind:stats` | Afficher les statistiques |

Les raccourcis texte `tm:` et les prompts MCP restent disponibles en parallèle.

## Comment le thread actif est choisi

Chaque session Claude Code a son propre thread actif : changer de thread dans une session ne déplace pas les autres. Une nouvelle session démarre sur :

1. Le dernier thread utilisé sur la branche git récupérée
2. Sinon, le thread lié à cette branche (un thread créé sur une branche de fonctionnalité lui est lié)
3. Sinon, le dernier thread utilisé, sauf s'il est lié à une autre branche
4. Sinon, `main`

Si vous changez de branche pendant une session, le thread actif suit au prochain appel à ThreadMind. Voir [Threads](/fr/guide/threads#branches-git).

## Hooks et fichiers

| Hook | S'exécute | Commande |
|------|-----------|----------|
| `SessionStart` | Au démarrage, après `/clear` et après une compaction | `thread-mind-mcp hook session-start` |
| `SessionEnd` | À la fin d'une session | `thread-mind-mcp hook session-end` |

Les hooks trouvent le projet via `THREADMIND_ROOT`, puis `CLAUDE_PROJECT_DIR`, puis le dossier de la session.
