# D\u00e9marrage rapide

## Pr\u00e9requis

- **Node.js** 18 ou sup\u00e9rieur
- Un **client IA compatible MCP** (Claude Code ou tout client supportant MCP)
- **Git** (optionnel, requis pour le mode \u00e9quipe)

## Installation

ThreadMind ne n\u00e9cessite aucune installation globale. Il s'ex\u00e9cute via `npx` :

```bash
npx thread-mind-mcp
```

## Configuration

### Claude Code

Ajoutez la configuration suivante dans votre fichier de param\u00e8tres MCP :

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

**Par projet** (`.claude/settings.json` dans votre d\u00e9p\u00f4t) :
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

Tout client supportant le transport stdio MCP peut utiliser ThreadMind avec le m\u00eame mod\u00e8le de configuration.

## Votre premier projet

Une fois ThreadMind configur\u00e9, lancez une conversation avec votre IA et utilisez les outils :

### 1. Cr\u00e9er un projet

```
Vous : Cr\u00e9e un projet ThreadMind appel\u00e9 "Mon App Web" avec comme contexte syst\u00e8me
       "Nous construisons une application e-commerce Next.js"

IA :   [appelle project_create]
       \u2713 Projet "mon-app-web" cr\u00e9\u00e9 (mode : solo). Thread principal actif.
```

### 2. Travailler et r\u00e9sumer

Menez votre conversation normale sur le sujet, puis sauvegardez un r\u00e9sum\u00e9 :

```
Vous : [discutez des approches d'authentification avec l'IA...]
Vous : R\u00e9sume ce qu'on a d\u00e9cid\u00e9 dans le thread courant

IA :   [appelle summary_update]
       \u2713 R\u00e9sum\u00e9 mis \u00e0 jour pour le thread "main".
```

### 3. Cr\u00e9er des sous-threads

```
Vous : Cr\u00e9e un thread pour "Routes API"

IA :   [appelle thread_create]
       \u2713 Thread "routes-api" cr\u00e9\u00e9 sous "main".

       main
       \u2514\u2500\u2500 routes-api \u2190 actif
```

### 4. Consulter le contexte assembl\u00e9

```
Vous : Montre-moi le contexte ThreadMind actuel

IA :   [appelle context_get]
       ## Contexte syst\u00e8me
       Nous construisons une application e-commerce Next.js

       ---

       ## Thread : Mon App Web
       Authentification : utilisation de JWT avec refresh tokens...

       ---

       ## Thread : Routes API (actif)
       [vide \u2014 commencez \u00e0 discuter puis r\u00e9sumez]
```

### 5. Visualiser l'arborescence

```
Vous : Montre l'arborescence des threads

IA :   [appelle thread_list]
       main
       \u251c\u2500\u2500 routes-api \u2190 actif
       \u2514\u2500\u2500 schema-bdd
```

## Workflow recommand\u00e9

1. **Cr\u00e9ez un projet** au d\u00e9but d'un nouveau codebase ou fonctionnalit\u00e9
2. **Travaillez dans le thread principal** pour la planification initiale et les grandes d\u00e9cisions
3. **Branchez** quand vous plongez dans un sous-sujet sp\u00e9cifique
4. **R\u00e9sumez** apr\u00e8s chaque discussion significative \u2014 gardez les r\u00e9sum\u00e9s concis (5-15 lignes)
5. **Changez de thread** quand vous changez de sujet
6. **Utilisez `context_get`** pour alimenter l'IA avec votre contexte structur\u00e9 plut\u00f4t que l'historique brut

::: tip
De bons r\u00e9sum\u00e9s sont la cl\u00e9 de l'efficacit\u00e9 de ThreadMind. Concentrez-vous sur les **d\u00e9cisions, r\u00e9sultats et choix techniques cl\u00e9s** \u2014 pas sur la conversation elle-m\u00eame.
:::

## Prochaines \u00e9tapes

- [Projets](/fr/guide/projects) \u2014 gestion des projets en d\u00e9tail
- [Threads](/fr/guide/threads) \u2014 cr\u00e9ation et gestion des threads
- [Assemblage du contexte](/fr/guide/context-assembly) \u2014 comment le contexte est construit
