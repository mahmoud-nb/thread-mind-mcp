# Autres clients IA

ThreadMind fonctionne avec tout client MCP capable de lancer des serveurs stdio. Trois choses changent d'un client à l'autre :

- **Où déclarer le serveur** : chaque client a son propre fichier de configuration
- **Comment l'IA apprend à utiliser ThreadMind** : par les consignes que le serveur envoie à la connexion, ou par un fichier `AGENTS.md` pour les clients qui ne les lisent pas
- **Comment le serveur trouve votre projet** : par les dossiers de workspace que le client annonce (roots MCP), ou à défaut par le dossier dans lequel le serveur démarre

Pour Claude Code, utilisez plutôt le [plugin](/fr/guide/claude-code-plugin).

## En un coup d'œil

| Client | Configuration du serveur | Consignes d'utilisation | Dossier du projet |
|--------|--------------------------|-------------------------|-------------------|
| [Cursor](#cursor) | `.cursor/mcp.json` ou `~/.cursor/mcp.json` | `AGENTS.md` | Annoncé par Cursor |
| [VS Code (GitHub Copilot)](#vs-code-github-copilot) | `.vscode/mcp.json` ou `.mcp.json` | Envoyées par le serveur | Annoncé par VS Code |
| [GitHub Copilot CLI](#github-copilot-cli) | `.mcp.json` ou `~/.copilot/mcp-config.json` | `AGENTS.md` | Dossier de lancement |
| [Codex](#codex) | `~/.codex/config.toml` ou `.codex/config.toml` | Envoyées par le serveur | Dossier de lancement |
| [Gemini CLI](#gemini-cli) | `.gemini/settings.json` ou `~/.gemini/settings.json` | Envoyées par le serveur | Dossier de lancement |
| [Windsurf](#windsurf) | `mcp_config.json` | `AGENTS.md` | [À vérifier](#verifier-l-installation) |

Pour générer `AGENTS.md`, demandez `tm:init` à l'IA une fois le serveur configuré : elle appelle `threadmind_init`. Commitez le fichier pour que toute l'équipe en profite.

Les raccourcis `tm:` fonctionnent dans tous les clients, puisqu'ils font partie des consignes d'utilisation.

## Partager une seule configuration avec l'équipe

Claude Code, VS Code et GitHub Copilot CLI lisent tous le fichier `.mcp.json` à la racine du dépôt. Commitez-le et ces trois clients disposent de ThreadMind :

```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

Chaque client ne lance un serveur déclaré par un dépôt qu'une fois que vous lui faites confiance : Claude Code vous demande d'approuver le serveur, VS Code et Copilot CLI s'appuient sur la confiance accordée au workspace et au dossier.

::: tip Windows
Certains clients ne peuvent pas lancer `npx` directement sous Windows natif, car c'est un script `.cmd`. Si le serveur ne démarre pas, lancez-le via `cmd` : `"command": "cmd"` avec `"args": ["/c", "npx", "-y", "thread-mind-mcp"]`. Claude Code en a besoin ; son [plugin](/fr/guide/claude-code-plugin) non. Si vous utilisez le plugin dans un dépôt qui a aussi un `.mcp.json`, refusez le serveur du dépôt quand Claude Code le demande, pour que ThreadMind ne tourne pas deux fois.
:::

## Cursor

Déclarez le serveur dans `.cursor/mcp.json` à la racine du projet (commitez-le pour le partager), ou dans `~/.cursor/mcp.json` pour tous vos projets :

```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

Vérifiez ensuite que le serveur est activé dans **Customize**, dans la barre latérale de Cursor. Cursor demande une approbation avant d'exécuter les outils MCP ; vous pouvez autoriser ceux de ThreadMind pour que l'IA enregistre les résumés sans vous interrompre.

**Consignes d'utilisation :** Cursor lit `AGENTS.md`, que génère `tm:init`. Pour garder ThreadMind hors d'`AGENTS.md`, générez plutôt une règle Cursor, `.cursor/rules/threadmind.mdc` (`threadmind_init` avec `clients: ["cursor"]`), appliquée à chaque conversation. N'en gardez qu'une des deux : avec les deux, Cursor charge les consignes deux fois. Les versions précédentes écrivaient `.cursorrules` ; générer la règle en retire la section ThreadMind.

**Dossier du projet :** Cursor annonce les dossiers du workspace : la configuration globale fonctionne pour tous les projets.

## VS Code (GitHub Copilot)

VS Code lit le [`.mcp.json` partagé](#partager-une-seule-configuration-avec-l-equipe). Pour réserver la configuration à VS Code, utilisez `.vscode/mcp.json`, dont la clé principale est `servers` :

```json
{
  "servers": {
    "thread-mind": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

Pour tous vos workspaces, lancez **MCP: Open User Configuration** depuis la palette de commandes et ajoutez la même entrée.

**Consignes d'utilisation :** VS Code transmet à Copilot les consignes envoyées par le serveur : aucun fichier n'est nécessaire.

**Dossier du projet :** VS Code annonce les dossiers du workspace : la configuration utilisateur fonctionne pour tous les workspaces.

## GitHub Copilot CLI

Copilot CLI lit le [`.mcp.json` partagé](#partager-une-seule-configuration-avec-l-equipe) (ou `.github/mcp.json`) une fois que vous faites confiance au dossier. Pour ajouter ThreadMind pour vous seul, dans tous vos projets :

```bash
copilot mcp add thread-mind -- npx -y thread-mind-mcp
```

La commande écrit `~/.copilot/mcp-config.json`. Dans une session, `/mcp add` ouvre le même réglage sous forme de formulaire.

**Consignes d'utilisation :** Copilot CLI lit `AGENTS.md` : générez-le avec `tm:init`.

**Dossier du projet :** lancez Copilot CLI depuis la racine du projet.

## Codex

La CLI Codex, son extension pour IDE et l'application de bureau partagent une même configuration. Ajoutez ThreadMind avec :

```bash
codex mcp add thread-mind -- npx -y thread-mind-mcp
```

La commande écrit `~/.codex/config.toml`. Vous pouvez aussi modifier ce fichier, ou déclarer le serveur pour un seul projet dans `.codex/config.toml` (projets de confiance uniquement) :

```toml
[mcp_servers.thread-mind]
command = "npx"
args = ["-y", "thread-mind-mcp"]
# Le premier démarrage télécharge le paquet : laissez-lui le temps
startup_timeout_sec = 30
```

**Consignes d'utilisation :** Codex lit les consignes envoyées par le serveur : aucun fichier n'est nécessaire. Codex lit aussi `AGENTS.md`, si votre équipe le génère pour d'autres agents.

**Dossier du projet :** le serveur travaille dans le dossier depuis lequel Codex le lance : lancez Codex depuis la racine du projet. Sinon, fixez le dossier de travail du serveur avec `cwd`.

## Gemini CLI

Déclarez le serveur dans `.gemini/settings.json` à la racine du projet (commitez-le pour le partager), ou dans `~/.gemini/settings.json` pour tous vos projets :

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

Gemini CLI ne se connecte aux serveurs stdio que dans les dossiers de confiance : `gemini mcp list` indique si ThreadMind est connecté. Les prompts MCP de ThreadMind deviennent des commandes slash, comme `/tm-tree`.

**Consignes d'utilisation :** Gemini CLI ajoute les consignes envoyées par le serveur à ses instructions système : aucun fichier n'est nécessaire. Gemini CLI lit `GEMINI.md`, pas `AGENTS.md` ; pour partager un même `AGENTS.md` avec d'autres agents, déclarez-le dans `settings.json` :

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md"]
  }
}
```

**Dossier du projet :** lancez Gemini CLI depuis la racine du projet. Sinon, fixez le dossier de travail du serveur avec `cwd`.

## Windsurf

Windsurf, devenu Devin Desktop, lit les serveurs MCP dans `mcp_config.json` : `~/.config/devin/mcp_config.json` sous macOS et Linux, `%APPDATA%\devin\mcp_config.json` sous Windows. Les versions précédentes de Windsurf utilisaient `~/.codeium/windsurf/mcp_config.json`.

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

**Consignes d'utilisation :** Cascade applique à chaque conversation le fichier `AGENTS.md` à la racine du projet : générez-le avec `tm:init`.

**Dossier du projet :** [vérifiez où ThreadMind stocke ses données](#verifier-l-installation). Si ce n'est pas dans votre projet, définissez `THREADMIND_ROOT` (voir [Emplacement du workspace](/fr/guide/getting-started#emplacement-du-workspace)).

## Autres clients

Zed, Cline, Continue, JetBrains AI Assistant et les autres clients prennent la même commande : `npx -y thread-mind-mcp`, comme serveur stdio. Cherchez où votre client déclare ses serveurs MCP, puis [vérifiez l'installation](#verifier-l-installation).

## Vérifier l'installation

Dans une nouvelle conversation :

1. Demandez **`tm:tree`**. L'IA doit appeler `thread_list`. Si elle ne connaît pas le raccourci, le client n'a pas reçu les consignes d'utilisation : générez `AGENTS.md` avec `threadmind_init`.
2. Dans un dépôt sans projet, l'IA répond qu'il n'y a pas encore de projet ThreadMind : créez-en un avec `tm:project <titre>`.
3. Vérifiez que le dossier `.threadmind/` est apparu à la racine de **votre projet**. S'il est apparu ailleurs, par exemple dans votre dossier personnel, le client a lancé le serveur hors du projet sans l'annoncer : lancez le client depuis le projet, ou définissez `THREADMIND_ROOT`.

## Ce que seul Claude Code fait

Le [plugin Claude Code](/fr/guide/claude-code-plugin) charge le contexte du thread actif au début d'une session, rappelle à l'IA d'enregistrer le résumé, le récupère après une compaction et suit les changements de branche git. Les autres clients s'appuient uniquement sur les consignes d'utilisation : l'IA appelle `context_get` au début d'une conversation et `summary_update` après les décisions. Demandez `tm:summary` avant de fermer une longue conversation, et `tm:context` quand une nouvelle ne démarre pas avec vos décisions.
