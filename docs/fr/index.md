---
layout: home

hero:
  name: ThreadMind MCP
  text: Des branches pour la mémoire de votre IA.
  tagline: "Un arbre de résumés de threads, compatible git. Démarrez chaque session avec les décisions qui comptent, pas tout l'historique."
  actions:
    - theme: brand
      text: "Démarrage rapide"
      link: /fr/guide/getting-started
    - theme: alt
      text: Voir sur GitHub
      link: https://github.com/mahmoud-nb/thread-mind-mcp
    - theme: alt
      text: npm
      link: https://www.npmjs.com/package/thread-mind-mcp

features:
  - icon: "🌳"
    title: Arborescences de threads
    details: "Structurez votre travail en arbre de threads. Chaque thread hérite des décisions et contraintes de ses ancêtres."
  - icon: "⚡"
    title: Sessions neuves, mémoire intacte
    details: "Videz une longue conversation et repartez du contexte du thread. Le plugin Claude Code le recharge automatiquement et mesure la différence."
  - icon: "🔀"
    title: Suit vos branches git
    details: "Un thread créé sur une branche de fonctionnalité devient actif dès que la branche est récupérée, et prévient quand le code qu'il décrit a changé."
  - icon: "👥"
    title: Collaboration en équipe
    details: "Les fichiers de threads sont commités avec le code. Partez des threads de vos collègues ; chacun gère ses propres résumés."
  - icon: "📁"
    title: Stockage fichier
    details: "Tout est en Markdown et JSON lisibles dans un dossier .threadmind/. Pas de base de données, pas d'index qui entre en conflit dans git."
  - icon: "🔌"
    title: Standard MCP
    details: "Compatible avec tout client MCP — Claude Code, Cursor, Codex, Copilot, etc."
---

## Installation rapide

Dans Claude Code, installez le plugin :

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Dans tout autre client MCP, ajoutez le serveur ([où chaque client le déclare](/fr/guide/other-clients)) :

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

Puis commencez à organiser :

```
Vous : Crée un projet appelé "Mon App"
IA :   ✓ Projet "mon-app" créé. Thread principal actif.

Vous : Crée un thread pour "Authentification"
IA :   ✓ Thread "authentification" créé sous "main".

       main
       └── authentification ← actif
```

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #6d28d9 30%, #a855f7);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #6d28d9aa 50%, #a855f7aa 50%);
  --vp-home-hero-image-filter: blur(44px);
}
</style>
