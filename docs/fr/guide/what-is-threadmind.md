# Qu'est-ce que ThreadMind ?

ThreadMind MCP est un serveur [Model Context Protocol](https://modelcontextprotocol.io/) qui organise les conversations IA en **arborescences hi\u00e9rarchiques de threads**.

## Le probl\u00e8me

Quand vous travaillez avec un assistant IA, chaque nouveau message inclut **tout l'historique de la conversation** comme contexte. Cela signifie :

- **Gaspillage de tokens** \u2014 r\u00e9p\u00e9tition de milliers de tokens d'informations d\u00e9j\u00e0 trait\u00e9es
- **Limites de contexte** \u2014 atteinte de la fen\u00eatre de contexte du mod\u00e8le, perte des premiers messages
- **M\u00e9lange des sujets** \u2014 logique d'authentification m\u00e9lang\u00e9e avec les discussions UI et les questions de d\u00e9ploiement

```
Message 1 \u2192 Message 2 \u2192 ... \u2192 Message 80 \u2192 Message 81
                                              \u2191
                 Les 80 messages envoy\u00e9s comme contexte
                 = dizaines de milliers de tokens
```

## La solution

ThreadMind remplace l'historique lin\u00e9aire par un **arbre de threads r\u00e9sum\u00e9s** :

```
main (r\u00e9sum\u00e9 : 200 tokens)
\u251c\u2500\u2500 auth (r\u00e9sum\u00e9 : 150 tokens)
\u2502   \u251c\u2500\u2500 auth-ui (r\u00e9sum\u00e9 : 100 tokens) \u2190 actif
\u2502   \u2514\u2500\u2500 auth-api (r\u00e9sum\u00e9 : 120 tokens)
\u2514\u2500\u2500 dashboard (r\u00e9sum\u00e9 : 180 tokens)
```

Quand vous travaillez sur `auth-ui`, seule la **cha\u00eene ancestrale directe** est envoy\u00e9e :

```
main \u2192 auth \u2192 auth-ui = ~450 tokens
```

C'est tout. La branche `dashboard` et le fr\u00e8re `auth-api` ne sont pas inclus \u2014 ils ne sont pas pertinents pour votre focus actuel.

## Avantages cl\u00e9s

### R\u00e9duction drastique des tokens

Au lieu d'envoyer 50+ messages bruts, vous envoyez 2-5 r\u00e9sum\u00e9s concis. R\u00e9duction typique : **80-95%** des tokens.

### Explorer plusieurs approches

Envie d'essayer une architecture diff\u00e9rente ? Cr\u00e9ez une branche :

```
main
\u251c\u2500\u2500 approche-a (API REST)
\u2502   \u2514\u2500\u2500 impl\u00e9mentation
\u2514\u2500\u2500 approche-b (GraphQL)     \u2190 basculez ici pour explorer
    \u2514\u2500\u2500 impl\u00e9mentation
```

Chaque branche maintient son propre contexte. Basculez librement sans contaminer les autres explorations.

### Collaborer en \u00e9quipe

En mode \u00e9quipe, les arborescences sont partag\u00e9es via git :
- R\u00e9cup\u00e9rez les threads de vos coll\u00e8gues pour voir leur progression
- Cr\u00e9ez des branches \u00e0 partir de leur travail
- Chacun g\u00e8re ses propres r\u00e9sum\u00e9s

### Rester organis\u00e9

Chaque sujet a son propre thread. Plus besoin de faire d\u00e9filer des centaines de messages pour retrouver cette d\u00e9cision sur le sch\u00e9ma de la base de donn\u00e9es.

## Int\u00e9gration

ThreadMind est un **serveur MCP** qui fonctionne avec votre client IA :

```
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510     Protocole MCP      \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 Client IA   \u2502\u25c4\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25ba\u2502  ThreadMind   \u2502
\u2502 (Claude Code,\u2502   outils & ressources  \u2502  Serveur MCP  \u2502
\u2502  ChatGPT,   \u2502                        \u2502               \u2502
\u2502  Gemini...) \u2502                        \u2502  .threadmind/ \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                        \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

Le client IA appelle les **outils** de ThreadMind (cr\u00e9er des threads, mettre \u00e0 jour des r\u00e9sum\u00e9s, obtenir le contexte) et lit ses **ressources** (contexte assembl\u00e9, visualisation de l'arbre).

## Prochaines \u00e9tapes

- [D\u00e9marrage rapide](/fr/guide/getting-started) \u2014 installer et configurer ThreadMind
- [Projets](/fr/guide/projects) \u2014 comprendre la gestion des projets
- [Threads](/fr/guide/threads) \u2014 apprendre les arborescences de threads
- [Assemblage du contexte](/fr/guide/context-assembly) \u2014 comment le contexte est construit
