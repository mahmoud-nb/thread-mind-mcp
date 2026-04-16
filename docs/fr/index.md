---
layout: home

hero:
  name: ThreadMind MCP
  text: Moins de tokens, plus de réflexion.
  tagline: "Organisez vos conversations IA en arborescences de threads. Réduisez la consommation de tokens en remplaçant l'historique complet par des résumés structurés."
  actions:
    - theme: brand
      text: "Démarrage rapide"
      link: /fr/guide/getting-started
    - theme: alt
      text: Voir sur GitHub
      link: https://github.com/mahmoud-nb/thread-mind-mcp

features:
  - icon: "🌳"
    title: Arborescences de threads
    details: "Structurez vos conversations IA sous forme d'arbre. Chaque thread hérite du contexte de ses ancêtres — fini l'historique dupliqué."
  - icon: "⚡"
    title: Optimisation des tokens
    details: "Envoyez uniquement des résumés concis au lieu de l'historique complet. Réduisez l'utilisation de tokens de 80%+ sur les longues sessions."
  - icon: "🔀"
    title: Brancher et explorer
    details: "Explorez différentes pistes de raisonnement dans des threads séparés. Basculez entre les branches sans perdre le contexte."
  - icon: "👥"
    title: Collaboration en équipe
    details: "Partagez les arborescences via git. Créez des branches à partir des threads de vos collègues. Chacun gère ses propres résumés."
  - icon: "📁"
    title: Stockage fichier
    details: "Tout est stocké en Markdown et JSON lisibles dans un dossier .threadmind/. Pas de base de données, 100% compatible git."
  - icon: "🔌"
    title: Standard MCP
    details: "Compatible avec tout client IA MCP — Claude Code, ChatGPT, Gemini, etc. Installation en une seule commande npx."
---

## Installation rapide

Ajoutez ThreadMind à votre client IA en quelques secondes :

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
