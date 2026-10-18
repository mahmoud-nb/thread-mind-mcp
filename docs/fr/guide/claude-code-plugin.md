# Plugin Claude Code

Le plugin ThreadMind pour Claude Code réunit le serveur MCP, des hooks, des options et une série de commandes. C'est l'installation recommandée pour Claude Code : le contexte du thread actif se charge tout seul au début de chaque session, et le plugin veille à ce que son résumé reste enregistré au fil de la conversation.

## Installation

Dans Claude Code :

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Claude Code installe le serveur ThreadMind avec le plugin, puis le lance avec `node` : ni `npx` ni `cmd /c`, sous Windows comme ailleurs. Le plugin demande Claude Code 2.1.271 ou plus récent.

::: warning
Si vous aviez configuré ThreadMind à la main (`.mcp.json` ou `claude mcp add`), retirez cette configuration : sinon Claude Code lance deux serveurs ThreadMind.
:::

## Ce qu'il fait

ThreadMind repose sur une seule chose : que l'IA enregistre l'essentiel dans le résumé du thread. Le plugin charge ce résumé au début d'une session, puis vérifie qu'il continue d'être enregistré.

### Le contexte au démarrage

Au début d'une session, après `/clear` et après une compaction, le plugin injecte dans la conversation le contexte assemblé du thread actif, le même texte que renvoie `context_get`. L'IA démarre avec vos décisions, sans avoir à appeler `context_get`.

C'est ce qui fait réellement économiser des tokens avec ThreadMind : quand une conversation s'est allongée, lancez `/clear`. La nouvelle session démarre avec le contexte du thread (en général quelques centaines à quelques milliers de tokens) au lieu de tout l'historique.

Claude Code accepte jusqu'à 10 000 caractères d'un hook. Un contexte plus long laisse d'abord de côté les ancêtres les plus éloignés, puis est coupé, et l'IA est invitée à appeler `context_get` pour les parties manquantes.

Rien n'est injecté dans un dépôt sans projet ThreadMind, et le plugin n'y crée aucun fichier.

### Les rappels de résumé

À la fin de chaque réponse, le plugin mesure de combien la conversation a grandi depuis le dernier enregistrement du résumé du thread actif, à partir des compteurs de tokens du transcript Claude Code. Tous les 50 000 tokens de travail non enregistré, il le rappelle à Claude :

```
Stop hook feedback:
ThreadMind: ~52k tokens of conversation since the summary of thread "routes-api" was last saved.
If this work produced decisions, constraints or progress worth keeping, record them now with
summary_update (one section, or the whole structured summary). Otherwise, end your turn.
```

Claude enregistre alors l'essentiel avec `summary_update`, ou termine son tour s'il n'y avait rien à garder. Un rappel n'est jamais suivi d'un autre dans le même tour, et enregistrer le résumé remet le compteur à zéro.

Avec l'option `warn`, vous seul voyez le rappel, sous forme de message dans la conversation ; Claude n'est pas interrompu. Les rappels s'arrêtent sur les threads marqués terminés ou abandonnés.

### Avant que le contexte se remplisse

Quand la conversation atteint 70 % de la fenêtre de contexte avec du travail non enregistré, le plugin envoie un dernier rappel, une seule fois, pour que le résumé soit enregistré avant que Claude Code ne compacte la conversation. La taille de la fenêtre de contexte vient de la [status line](#status-line) si vous l'avez installée, de l'option `context_window`, ou à défaut est supposée de 200 000 tokens (1 000 000 dès que la conversation dépasse cette taille).

### Après une compaction

Si une compaction survient malgré tout avec du travail non enregistré, le plugin le note juste avant. La session qui reprend après la compaction démarre avec le contexte du thread et la consigne d'enregistrer d'abord le résumé, à partir du résumé de conversation que Claude Code vient d'écrire :

```
The conversation was just compacted before the summary of thread "routes-api" was saved
(~38k tokens of work). Before anything else, call summary_update to record the decisions,
constraints, state and next steps from the conversation summary, then carry on.
```

Le plugin ne bloque jamais une compaction. L'option `compact_summary` désactive ce comportement : l'IA est alors seulement invitée à vérifier que le résumé de compaction ne contient pas de décisions manquantes.

### Après `/clear`

`/clear` efface la conversation. Si la conversation effacée contenait du travail non enregistré, le plugin vous le signale au démarrage de la nouvelle session, pour que vous sachiez que le résumé l'a manqué :

```
ThreadMind: the conversation you cleared had ~41k tokens of work that was not saved in thread "routes-api"'s summary.
```

Enregistrez le résumé (`tm:summary`) avant `/clear` pour l'éviter.

### Les changements de branche git

Quand Claude lance `git switch`, `git checkout` ou `gh pr checkout`, ou quand vous changez de branche dans votre propre terminal entre deux messages, le thread actif suit la branche (voir [Comment le thread actif est choisi](#comment-le-thread-actif-est-choisi)). Le plugin donne alors aussitôt à Claude le contexte du nouveau thread actif, pour que le travail continue dans le bon thread.

### Les fichiers modifiés enregistrés avec le résumé

Le plugin note les fichiers que Claude modifie. Quand Claude enregistre le résumé sans préciser de `paths`, ces fichiers sont enregistrés avec lui : le contexte [signale le résumé](/fr/guide/context-assembly#resumes-perimes) dès que des commits ultérieurs les modifient.

### `tm:tree` et `tm:stats` instantanés

`tm:tree`, `tm:stats`, `/thread-mind:tree` et `/thread-mind:stats` reçoivent leur réponse directement du plugin, sans envoyer la demande à Claude : la réponse est instantanée et ne consomme aucun token. Claude Code l'affiche comme la raison pour laquelle votre message n'a pas été envoyé à Claude.

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

## Options

Réglez-les dans `/config`, sur les lignes du plugin ThreadMind. Elles s'appliquent à partir de la session suivante.

| Option | Par défaut | Effet |
|--------|------------|-------|
| Rappels de résumé (`reminders`) | `nudge` | `nudge` : Claude enregistre le résumé lui-même. `warn` : vous seul êtes prévenu. `off` : aucun rappel |
| Tokens entre deux rappels (`reminder_tokens`) | `50000` | De combien la conversation grandit avant chaque rappel |
| Dernier rappel avant compaction (`context_threshold`) | `70` | Remplissage de la fenêtre de contexte, en pourcentage, qui déclenche le dernier rappel |
| Enregistrer le résumé après une compaction (`compact_summary`) | activé | Claude enregistre le résumé en premier après une compaction qui a emporté du travail non enregistré |
| tm:tree et tm:stats instantanés (`instant_commands`) | activé | Répondre à ces raccourcis sans Claude |
| Taille de la fenêtre de contexte (`context_window`) | `0` | `0` pour la détecter ; à renseigner si vous n'utilisez pas la status line |

## Status line

Une status line garde l'état de ThreadMind sous les yeux, en bas de Claude Code :

```
🧵 routes-api · feature/routes-api · saved 2h ago · ⚠ ~54k unsaved · ctx 64%
```

| Partie | Signification |
|--------|---------------|
| `🧵 routes-api` | Le thread actif, avec `[done]` ou `[abandoned]` s'il est clôturé |
| `feature/routes-api` | La branche git récupérée |
| `saved 2h ago` | Quand le résumé du thread a été enregistré pour la dernière fois (`no summary yet` avant le premier) |
| `~54k unsaved` | Le travail compté par le plugin depuis, signalé par ⚠ au-delà de l'intervalle des rappels |
| `ctx 64%` | Le remplissage de la fenêtre de contexte |

Un plugin ne peut pas définir la status line : ajoutez-la à votre `~/.claude/settings.json`. Installez le paquet une fois pour que la commande démarre vite :

```bash
npm install -g thread-mind-mcp
```

```json
{
  "statusLine": {
    "type": "command",
    "command": "thread-mind-mcp status-line"
  }
}
```

Sans installation globale, utilisez `"command": "npx -y thread-mind-mcp status-line"`, plus lent à démarrer. La status line reste vide dans les dépôts sans projet ThreadMind. Elle transmet aussi au plugin la taille réelle de la fenêtre de contexte, pour le [dernier rappel](#avant-que-le-contexte-se-remplisse).

## Vérifier que ThreadMind fait son travail

- **La status line** montre le thread actif et la quantité de travail non enregistré
- **La conversation** montre chaque appel aux outils ThreadMind ; `Ctrl+O` en affiche le détail, et les rappels du plugin apparaissent comme `Stop hook feedback`
- **`git diff .threadmind/`** montre ce que l'IA a réellement écrit dans les résumés ; en équipe, les fichiers de threads sont relus dans la pull request
- **`/thread-mind:stats`** montre quand chaque résumé a été enregistré pour la dernière fois
- **`/thread-mind:context`** montre le contexte que reçoit l'IA

## Comment le thread actif est choisi

Chaque session Claude Code a son propre thread actif : changer de thread dans une session ne déplace pas les autres. Une nouvelle session démarre sur :

1. Le dernier thread utilisé sur la branche git récupérée
2. Sinon, le thread lié à cette branche (un thread créé sur une branche de fonctionnalité lui est lié)
3. Sinon, le dernier thread utilisé, sauf s'il est lié à une autre branche
4. Sinon, `main`

Si vous changez de branche pendant une session, le thread actif suit, et le plugin en informe Claude. Voir [Threads](/fr/guide/threads#branches-git).

## Hooks et fichiers

| Hook | S'exécute | Traitement |
|------|-----------|------------|
| `SessionStart` (startup) | Au démarrage d'une session | Commande `thread-mind-mcp hook session-start` |
| `SessionStart` (clear, compact) | Après `/clear` et après une compaction | Outil `threadmind_hook`, événement `session-start` |
| `UserPromptSubmit` | Quand vous envoyez un message | Outil `threadmind_hook`, événement `user-prompt` |
| `PostToolUse` (Edit, Write) | Après une modification de fichier par Claude | Outil `threadmind_hook`, événement `file-edited` |
| `PostToolUse` (Bash) | Après `git switch`, `git checkout`, `gh pr checkout` | Outil `threadmind_hook`, événement `branch-check` |
| `Stop` | À la fin de chaque réponse | Outil `threadmind_hook`, événement `stop` |
| `PreCompact` | Avant une compaction | Outil `threadmind_hook`, événement `pre-compact` |
| `SessionEnd` | À la fin d'une session | Commande `thread-mind-mcp hook session-end` |

La plupart des hooks appellent l'outil `threadmind_hook` du serveur du plugin (hooks `mcp_tool`) : ils partagent ainsi le thread actif de la session. Claude Code ne rend les serveurs MCP accessibles aux hooks qu'une fois la session démarrée : les hooks qui s'exécutent avant ou après sont donc des commandes ; ils trouvent le projet via `THREADMIND_ROOT`, puis `CLAUDE_PROJECT_DIR`, puis le dossier de la session.

Le plugin lance le serveur avec `THREADMIND_HOOKS=1`, qui expose `threadmind_hook`. Les autres clients MCP ne voient pas cet outil.

## Sans le plugin

Les hooks fonctionnent aussi avec un serveur [configuré par vos soins](/fr/guide/getting-started#claude-code-sans-le-plugin). Ajoutez `THREADMIND_HOOKS` à l'`env` du serveur, ainsi que les options voulues :

| Variable | Option |
|----------|--------|
| `THREADMIND_HOOKS` | `1` expose l'outil `threadmind_hook` |
| `THREADMIND_REMINDERS` | `nudge`, `warn` ou `off` |
| `THREADMIND_REMINDER_TOKENS` | Tokens entre deux rappels |
| `THREADMIND_CONTEXT_THRESHOLD` | Dernier rappel, en pourcentage de la fenêtre de contexte |
| `THREADMIND_COMPACT_SUMMARY` | `true` ou `false` |
| `THREADMIND_INSTANT_COMMANDS` | `true` ou `false` |
| `THREADMIND_CONTEXT_WINDOW` | Taille de la fenêtre de contexte, en tokens |

Déclarez ensuite les hooks dans `.claude/settings.json` (équipe) ou `~/.claude/settings.json` (vous), avec dans `server` le nom donné au serveur. Cet exemple ajoute les rappels et la reprise après compaction :

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "thread-mind",
            "tool": "threadmind_hook",
            "input": {
              "event": "stop",
              "session_id": "${session_id}",
              "transcript_path": "${transcript_path}",
              "stop_hook_active": "${stop_hook_active}"
            }
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "thread-mind",
            "tool": "threadmind_hook",
            "input": {
              "event": "pre-compact",
              "session_id": "${session_id}",
              "transcript_path": "${transcript_path}"
            }
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "clear|compact",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "thread-mind",
            "tool": "threadmind_hook",
            "input": {
              "event": "session-start",
              "session_id": "${session_id}",
              "source": "${source}"
            }
          }
        ]
      }
    ]
  }
}
```

Pour charger aussi le contexte au démarrage d'une session, ajoutez un hook `SessionStart` avec le matcher `startup` qui lance la commande `npx -y thread-mind-mcp hook session-start` : les hooks d'outil ne peuvent pas s'exécuter aussi tôt. Le [hooks.json](https://github.com/mahmoud-nb/thread-mind-mcp/blob/master/plugin/hooks/hooks.json) du plugin liste les autres hooks avec leurs entrées.
