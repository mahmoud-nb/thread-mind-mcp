---
layout: home

hero:
  name: ThreadMind MCP
  text: Moins de tokens, plus de r\u00e9flexion.
  tagline: "Organisez vos conversations IA en arborescences de threads. R\u00e9duisez la consommation de tokens en rempla\u00e7ant l\u2019historique complet par des r\u00e9sum\u00e9s structur\u00e9s."
  actions:
    - theme: brand
      text: "D\u00e9marrage rapide"
      link: /fr/guide/getting-started
    - theme: alt
      text: Voir sur GitHub
      link: https://github.com/mahmoud-nb/thread-mind-mcp

features:
  - icon: "\U0001F333"
    title: Arborescences de threads
    details: "Structurez vos conversations IA sous forme d\u2019arbre. Chaque thread h\u00e9rite du contexte de ses anc\u00EAtres \u2014 fini l\u2019historique dupliqu\u00e9."
  - icon: "\u26A1"
    title: Optimisation des tokens
    details: "Envoyez uniquement des r\u00e9sum\u00e9s concis au lieu de l\u2019historique complet. R\u00e9duisez l\u2019utilisation de tokens de 80%+ sur les longues sessions."
  - icon: "\U0001F500"
    title: Brancher et explorer
    details: "Explorez diff\u00e9rentes pistes de raisonnement dans des threads s\u00e9par\u00e9s. Basculez entre les branches sans perdre le contexte."
  - icon: "\U0001F465"
    title: Collaboration en \u00e9quipe
    details: "Partagez les arborescences via git. Cr\u00e9ez des branches \u00e0 partir des threads de vos coll\u00e8gues. Chacun g\u00e8re ses propres r\u00e9sum\u00e9s."
  - icon: "\U0001F4C1"
    title: Stockage fichier
    details: "Tout est stock\u00e9 en Markdown et JSON lisibles dans un dossier .threadmind/. Pas de base de donn\u00e9es, 100% compatible git."
  - icon: "\U0001F50C"
    title: Standard MCP
    details: "Compatible avec tout client IA MCP \u2014 Claude Code, ChatGPT, Gemini, etc. Installation en une seule commande npx."
---

## Installation rapide

Ajoutez ThreadMind \u00e0 votre client IA en quelques secondes :

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

Puis commencez \u00e0 organiser :

```
Vous : Cr\u00e9e un projet appel\u00e9 "Mon App"
IA :   \u2713 Projet "mon-app" cr\u00e9\u00e9. Thread principal actif.

Vous : Cr\u00e9e un thread pour "Authentification"
IA :   \u2713 Thread "authentification" cr\u00e9\u00e9 sous "main".

       main
       \u2514\u2500\u2500 authentification \u2190 actif
```

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #6d28d9 30%, #a855f7);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #6d28d9aa 50%, #a855f7aa 50%);
  --vp-home-hero-image-filter: blur(44px);
}
</style>
