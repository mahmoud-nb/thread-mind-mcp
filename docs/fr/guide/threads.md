# Threads

Un **thread** est un nœud de l'arbre qui représente un sujet de discussion ou un domaine de travail. Chaque thread conserve un résumé concis en Markdown.

## Arbre des threads

Les threads forment un arbre enraciné au thread `main` :

```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
├── database
│   └── migrations
└── deployment
```

Chaque thread a exactement un parent (sauf `main`, qui n'en a pas) et peut avoir plusieurs enfants. Chaque fichier de thread enregistre son parent : l'arbre est reconstruit à partir des fichiers, sans index séparé à maintenir.

## Créer des threads

```
thread_create(title: "Système Auth", parentId: "main")
```

Ou avec le raccourci : `tm:create Système Auth`

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `title` | string | requis | Titre du thread |
| `parentId` | string | thread actif | Parent depuis lequel brancher |

Si `parentId` est omis, le nouveau thread part du **thread actif**. Il devient le thread actif de la session.

Sur une branche de fonctionnalité, le nouveau thread est aussi [lié à cette branche](#branches-git).

### Avertissement de résumé parent

À la création d'un thread enfant, ThreadMind vérifie que le thread parent a déjà un résumé. Sinon, un avertissement s'affiche :

```
Thread "systeme-auth" created under "main".

main
└── systeme-auth ← active

⚠️  Parent thread "main" has no summary yet.
Run `tm:summary` on "main" before continuing — this ensures the context
chain is complete when you call `context_get` from child threads.
```

C'est **non bloquant** : le thread enfant est toujours créé.

### Génération d'ID

Les IDs suivent les mêmes règles de slugification que les projets :

| Titre | ID |
|-------|----|
| `"Système Auth"` | `systeme-auth` |
| `"Routes API v2"` | `routes-api-v2` |

Les doublons reçoivent des suffixes numériques : `systeme-auth-2`. Les accents sont retirés (`"Système"` → `systeme`) ; un titre sans aucune lettre latine ni chiffre reçoit l'ID `thread` (puis `thread-2`…). Dans `thread_list`, le titre est affiché à côté des IDs qui ne le reflètent pas, par exemple `thread — 认证模块`.

## Le thread actif

Chaque session a son propre thread actif : changer de thread dans une session Claude Code ne déplace pas une autre session ouverte sur le même dépôt.

```
thread_switch(threadId: "auth-ui")
```

Ou avec le raccourci : `tm:switch auth-ui`

`thread_switch` renvoie le contexte complet du nouveau thread : l'IA n'a pas besoin d'appeler `context_get` ensuite. Il accepte le même budget `maxTokens` que `context_get`.

Une nouvelle session démarre sur :

1. Le dernier thread utilisé sur la branche git récupérée
2. Sinon, le thread lié à cette branche
3. Sinon, le dernier thread utilisé, sauf s'il est lié à une autre branche
4. Sinon, `main`

## Branches git

Un thread créé sur une branche de fonctionnalité lui est lié (champ `branch` de son frontmatter), sauf si un thread ouvert est déjà lié à cette branche. Les branches de base (`main`, `master`, `develop`, `dev`, `trunk` et la branche par défaut du dépôt distant) ne sont jamais liées.

```
$ git switch -c feature/auth-ui
tm:create Auth UI
  → thread "auth-ui", lié à feature/auth-ui

(nouvelle session sur la même branche)
  → thread actif : auth-ui

$ git switch main
  → thread actif : le dernier utilisé sur main
```

Le lien est commité avec le fichier du thread : un collègue qui récupère votre branche démarre lui aussi sur son thread. Si vous changez de branche pendant une session, le thread actif suit au prochain appel à ThreadMind.

## Visualiser l'arbre

```
thread_list
```

Ou avec le raccourci : `tm:tree`

```
main
├── auth
│   ├── auth-ui [branch: feature/auth-ui] ← active
│   └── auth-api
├── graphql [abandoned]
└── deployment
```

## Mettre à jour les résumés

Les résumés utilisent ces sections, en omettant celles qui sont vides :

```markdown
## Decisions
- Access tokens JWT (15 min) + refresh tokens (7 jours), en cookies httpOnly
- Pas d'OAuth en v1

## Constraints
- Les sessions doivent survivre à un redémarrage du serveur

## State
- Connexion et rafraîchissement faits, déconnexion à faire

## Open questions
- Renouveler le refresh token à chaque utilisation ?

## Next steps
- Implémenter la déconnexion
```

ThreadMind reconnaît aussi ces titres en français : `## Décisions`, `## Contraintes`, `## État`, `## Questions ouvertes`, `## Prochaines étapes`. Les threads enfants n'héritent que des **Décisions** et **Contraintes** (et de vos propres sections) : l'État, les Questions ouvertes et les Prochaines étapes concernent le thread lui-même. Les résumés sans ces titres sont hérités en entier.

```
summary_update(content: "...")                                        # remplace tout le résumé
summary_update(content: "- Refresh tokens", section: "decisions")     # complète une section
summary_update(content: "- Déconnexion faite", section: "state", replaceSection: true)
```

Ou avec le raccourci : `tm:summary` (l'IA rédige le résumé) ou `tm:summary <contenu>`.

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `content` | string | requis | Le nouveau résumé, ou le texte à ajouter à la section (Markdown) |
| `threadId` | string | thread actif | Thread à mettre à jour |
| `section` | string | — | `decisions`, `constraints`, `state`, `open-questions` ou `next-steps` |
| `replaceSection` | boolean | `false` | Remplacer la section au lieu de la compléter |
| `paths` | string[] | conservé | Fichiers ou dossiers dont parle le thread |

Compléter une section évite de réécrire tout le résumé, ce qui coûte des tokens en sortie et risque de faire perdre des détails.

### Résumés périmés

Chaque mise à jour enregistre le commit git sur lequel elle a été écrite. Si le résumé indique des `paths`, le contexte prévient quand des commits ultérieurs les ont modifiés :

```
## Thread: Auth UI (active)

_⚠ 3 commits changed src/auth since this summary was written: check it is still accurate._
```

Sans `paths`, le contexte indique seulement l'âge du résumé (`_Written 14 commits ago._`).

### Rédiger de bons résumés

- **Concis** — quelques lignes par section
- **Centrés sur les décisions** — ce qui a été décidé et pourquoi
- **Autonomes** — compréhensibles sans contexte préalable

## Terminer un thread

Quand le travail d'un thread est fini, intégrez ses conclusions dans son parent :

```
thread_merge(parentSummary: "...")
```

L'IA rédige le nouveau résumé du parent en y incluant les conclusions du thread ; ThreadMind l'enregistre, marque le thread `done` et passe au parent. Raccourci : `tm:merge`.

Pour clore un thread sans l'intégrer, changez son statut. La raison est ajoutée aux décisions du thread : l'arbre se souvient pourquoi une approche a été écartée.

```
thread_status(status: "abandoned", reason: "REST suffit pour nos clients")
```

Raccourcis : `tm:done [raison]`, `tm:abandon <raison>`. `status: "active"` rouvre un thread. Le thread `main` ne peut pas être clos.

## Supprimer des threads

```
thread_delete(threadId: "auth-api")
```

Ou avec le raccourci : `tm:delete auth-api`

Supprime le thread **et tous ses descendants**. Le thread `main` ne peut pas être supprimé. En mode équipe, vous ne pouvez supprimer que vos propres threads, et pas si un descendant appartient à un collègue.

## Rebaser des threads

Rebaser déplace un thread (et tous ses descendants) sous un autre parent — comme `git rebase`.

```
thread_rebase(threadId: "auth-ui", newParentId: "dashboard")
```

Ou avec le raccourci : `tm:rebase auth-ui dashboard`

**Avant :**
```
main
├── auth
│   └── auth-ui
└── dashboard
```

**Après `tm:rebase auth-ui dashboard` :**
```
main
├── auth
└── dashboard
    └── auth-ui
```

**Contraintes :**
- Impossible de rebaser le thread `main`
- Impossible de créer une référence circulaire (pas de rebase sur un descendant)
- Impossible de rebaser un thread sur lui-même ou sur son parent actuel
- En mode équipe, seul l'auteur du thread peut le rebaser

## Format des fichiers de threads

Chaque thread est un fichier Markdown avec un frontmatter YAML :

```markdown
---
id: auth-ui
title: Auth UI
parentId: auth
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00.000Z
updatedAt: 2026-04-15T12:30:00.000Z
branch: feature/auth-ui
commit: 3f2a9c1e5b7d4a8f0c6e2b1d9a7f5c3e1b0d8a6f
paths: ["src/auth"]
---

## Decisions
- Formulaire de connexion avec React Hook Form
```

`status`, `branch`, `commit`, `paths` et `mergedInto` n'apparaissent que lorsqu'ils sont renseignés. Voir [Format de stockage](/fr/reference/storage).
