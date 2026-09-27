# Qu'est-ce que ThreadMind ?

ThreadMind MCP est un serveur [Model Context Protocol](https://modelcontextprotocol.io/) qui donne une mémoire aux sessions de code avec une IA : un **arbre de threads**, chacun portant un court résumé de ce qui a été décidé sur un sujet. Les résumés sont des fichiers Markdown dans votre dépôt.

## Le problème

Une longue conversation avec un assistant IA transporte tout son historique : chaque message, résultat d'outil et idée abandonnée est renvoyé à chaque requête. Elle grossit jusqu'à ce que le client la compacte ou que vous repartiez de zéro, et repartir de zéro fait perdre ce qui a été décidé.

Les sujets s'emmêlent aussi : authentification, détails d'interface et questions de déploiement finissent dans le même historique.

## La solution

ThreadMind conserve l'essentiel sous forme d'arbre de résumés :

```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
└── dashboard
```

Le contexte d'un thread, c'est son propre résumé plus les **décisions et contraintes** de ses ancêtres. Les branches sœurs (`auth-api`, `dashboard`) restent à l'écart.

Vous pouvez donc repartir à moindre coût : lancez `/clear` ou ouvrez une nouvelle session, et le contexte du thread, en général quelques centaines à quelques milliers de tokens, remplace un historique qui avait atteint des dizaines de milliers. Avec le [plugin Claude Code](/fr/guide/claude-code-plugin), ce rechargement est automatique, et `stats_show` mesure les deux tailles sur vos propres sessions.

::: info
ThreadMind ne peut pas réduire une conversation en cours : c'est le client qui décide de ce qu'il envoie au modèle. Le gain vient quand une session démarre depuis le contexte du thread plutôt que depuis un long historique.
:::

## Avantages clés

### Repartir de zéro sans perdre les décisions

Les résumés sont organisés en sections (Décisions, Contraintes, État, Questions ouvertes, Prochaines étapes). Les threads enfants n'héritent que de la partie durable : chaque niveau reste court.

### Explorer plusieurs approches

Envie d'essayer une autre architecture ? Créez une branche :

```
main
├── approach-a (API REST)
│   └── implementation
└── approach-b (GraphQL)
```

Chaque branche garde son propre contexte. Quand une approche l'emporte, intégrez ses conclusions dans le parent ; quand elle échoue, marquez-la abandonnée avec la raison : l'arbre se souvient du pourquoi.

### Suivre vos branches git

Un thread créé sur une branche de fonctionnalité lui est lié : récupérez la branche, et son thread devient le thread actif, pour vous comme pour les collègues qui la récupèrent. Les résumés enregistrent aussi le commit sur lequel ils ont été écrits : ThreadMind peut prévenir quand le code qu'ils décrivent a changé depuis.

### Collaborer en équipe

Les fichiers de threads sont du Markdown commité avec le code : chacun voit les décisions des autres, part de leurs threads et les relit dans les pull requests.

## Intégration

ThreadMind est un **serveur MCP** qui fonctionne à côté de votre client IA :

```
┌──────────────┐     Protocole MCP       ┌──────────────┐
│  Client IA   │◄───────────────────────►│  ThreadMind  │
│ (Claude Code,│   outils, ressources,   │  Serveur MCP │
│  Cursor,     │   prompts, instructions │              │
│  Codex...)   │                         │ .threadmind/ │
└──────────────┘                         └──────────────┘
```

Le serveur indique au client comment l'utiliser (instructions de serveur MCP). L'IA appelle ses **outils** (créer des threads, mettre à jour les résumés, obtenir le contexte) et lit ses **ressources** (contexte assemblé, arbre, threads individuels).

## Prochaines étapes

- [Démarrage rapide](/fr/guide/getting-started) — installer et configurer ThreadMind
- [Plugin Claude Code](/fr/guide/claude-code-plugin) — le contexte automatique au démarrage
- [Threads](/fr/guide/threads) — l'arbre, les sections, les statuts et les branches git
- [Assemblage du contexte](/fr/guide/context-assembly) — comment le contexte est construit
