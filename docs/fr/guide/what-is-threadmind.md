# Qu'est-ce que ThreadMind ?

ThreadMind MCP est un serveur [Model Context Protocol](https://modelcontextprotocol.io/) qui organise les conversations IA en **arborescences hiérarchiques de threads**.

## Le problème

Quand vous travaillez avec un assistant IA, chaque nouveau message inclut **tout l'historique de la conversation** comme contexte. Cela signifie :

- **Gaspillage de tokens** — répétition de milliers de tokens d'informations déjà traitées
- **Limites de contexte** — atteinte de la fenêtre de contexte du modèle, perte des premiers messages
- **Mélange des sujets** — logique d'authentification mélangée avec les discussions UI et les questions de déploiement

```
Message 1 → Message 2 → ... → Message 80 → Message 81
                                              ↑
                 Les 80 messages envoyés comme contexte
                 = dizaines de milliers de tokens
```

## La solution

ThreadMind remplace l'historique linéaire par un **arbre de threads résumés** :

```
main (résumé : 200 tokens)
├── auth (résumé : 150 tokens)
│   ├── auth-ui (résumé : 100 tokens) ← actif
│   └── auth-api (résumé : 120 tokens)
└── dashboard (résumé : 180 tokens)
```

Quand vous travaillez sur `auth-ui`, seule la **chaîne ancestrale directe** est envoyée :

```
main → auth → auth-ui = ~450 tokens
```

C'est tout. La branche `dashboard` et le frère `auth-api` ne sont pas inclus — ils ne sont pas pertinents pour votre focus actuel.

## Avantages clés

### Réduction drastique des tokens

Au lieu d'envoyer 50+ messages bruts, vous envoyez 2-5 résumés concis. Réduction typique : **80-95%** des tokens.

### Explorer plusieurs approches

Envie d'essayer une architecture différente ? Créez une branche :

```
main
├── approche-a (API REST)
│   └── implémentation
└── approche-b (GraphQL)     ← basculez ici pour explorer
    └── implémentation
```

Chaque branche maintient son propre contexte. Basculez librement sans contaminer les autres explorations.

### Collaborer en équipe

En mode équipe, les arborescences sont partagées via git :
- Récupérez les threads de vos collègues pour voir leur progression
- Créez des branches à partir de leur travail
- Chacun gère ses propres résumés

### Rester organisé

Chaque sujet a son propre thread. Plus besoin de faire défiler des centaines de messages pour retrouver cette décision sur le schéma de la base de données.

## Intégration

ThreadMind est un **serveur MCP** qui fonctionne avec votre client IA :

```
┌─────────────┐     Protocole MCP      ┌──────────────┐
│ Client IA   │◄────────────────────────►│  ThreadMind   │
│ (Claude Code,│   outils & ressources  │  Serveur MCP  │
│  ChatGPT,   │                        │               │
│  Gemini...) │                        │  .threadmind/ │
└─────────────┘                        └──────────────┘
```

Le client IA appelle les **outils** de ThreadMind (créer des threads, mettre à jour des résumés, obtenir le contexte) et lit ses **ressources** (contexte assemblé, visualisation de l'arbre).

## Prochaines étapes

- [Démarrage rapide](/fr/guide/getting-started) — installer et configurer ThreadMind
- [Projets](/fr/guide/projects) — comprendre la gestion des projets
- [Threads](/fr/guide/threads) — apprendre les arborescences de threads
- [Assemblage du contexte](/fr/guide/context-assembly) — comment le contexte est construit
