# Assemblage du contexte

L'assemblage du contexte est le mécanisme central de ThreadMind : il construit, à partir de l'arbre, un **contexte ciblé** pour le modèle d'IA.

## Fonctionnement

Quand vous appelez `context_get` (ou `tm:context`), changez de thread, lisez la ressource `threadmind://context` ou démarrez une session avec le [plugin Claude Code](/fr/guide/claude-code-plugin), ThreadMind :

1. **Part** du thread actif
2. **Remonte** l'arbre en suivant les liens `parentId` jusqu'à la racine
3. **Inverse** la chaîne (racine → ... → actif)
4. **Garde** tout le résumé du thread actif, et seulement les sections durables de ses ancêtres
5. **Signale** les résumés que des changements de code ont pu rendre obsolètes
6. **Estime** le nombre de tokens (~1 token pour 3,5 caractères)

### Exemple

Avec cet arbre :

```
main ("Next.js e-commerce...")
├── auth ("Auth JWT avec refresh tokens...")
│   ├── auth-ui ("Formulaire de connexion, inscription...") ← active
│   └── auth-api ("POST /login, POST /register...")
└── dashboard ("Tableau de bord admin...")
```

Le contexte assemblé pour `auth-ui` est :

```markdown
## System Context

Application e-commerce Next.js avec Stripe.

---

## Thread: Mon App

## Decisions
- Next.js 15, PostgreSQL, Stripe

---

## Thread: Auth

## Decisions
- JWT avec refresh tokens, bcrypt, Passport.js

## Constraints
- Les sessions survivent à un redémarrage du serveur

---

## Thread: Auth UI (active)

_⚠ 2 commits changed src/auth/ui since this summary was written: check it is still accurate._

## Decisions
- Formulaire de connexion avec React Hook Form

## State
- Inscription faite, réinitialisation du mot de passe à faire

---
_ThreadMind context: ~160 tokens | depth: 3 threads_
```

### Ce qui est exclu

- **Les threads frères** (`auth-api` n'est pas inclus)
- **Les autres branches** (`dashboard` n'est pas inclus)
- **Les résumés vides** (les threads sans contenu sont ignorés)
- **Les sections propres aux ancêtres** : State, Open questions et Next steps décrivent où en est *ce* thread, pas ce dont ses descendants ont besoin

Les résumés sans titres de sections sont hérités en entier. Le résumé d'un thread frère reste à portée : lisez sa ressource `threadmind://thread/{id}`.

## Résumés périmés

Chaque mise à jour de résumé enregistre le commit git sur lequel elle a été écrite, et éventuellement les `paths` dont parle le thread. À l'assemblage, ThreadMind compte les commits depuis :

| Situation | Note sous le titre du thread |
|-----------|------------------------------|
| Des commits ont modifié les `paths` du résumé | `_⚠ 3 commits changed src/auth since this summary was written: check it is still accurate._` |
| Pas de `paths`, des commits depuis | `_Written 14 commits ago._` |
| Le commit n'est pas dans l'historique du dépôt (rebasé, jamais poussé) | `_⚠ Written on commit 3f2a9c1, which is not in this repository's history: check this summary is still accurate._` |

Rien n'est ajouté si git n'est pas disponible ou si rien n'a changé.

## Budget de tokens

`context_get` et `thread_switch` acceptent `maxTokens`. Quand le contexte est plus gros, ThreadMind retire d'abord les ancêtres les plus lointains (le thread actif reste toujours) et les liste dans le pied de page :

```
_ThreadMind context: ~480 tokens | depth: 4 threads_
_Left out to fit the token budget: main, backend (readable as threadmind://thread/{id} resources)_
```

Si le thread actif dépasse à lui seul le budget, son texte est coupé.

## D'où vient le gain

ThreadMind ne réduit pas une conversation en cours : le client renvoie tout l'historique à chaque requête. Le gain vient quand vous **repartez** : après `/clear` ou dans une nouvelle session, le contexte du thread (en général quelques centaines à quelques milliers de tokens) remplace un historique qui avait atteint des dizaines de milliers.

Avec le [plugin Claude Code](/fr/guide/claude-code-plugin), ce redémarrage est automatique après `/clear` et après une compaction, et `stats_show` mesure les deux côtés sur vos propres sessions :

```
Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)
```

Les tailles de conversation viennent des transcripts de Claude Code ; les autres chiffres sont des estimations (~3,5 caractères par token).

## Stratégies de conception

### Arbres peu profonds pour les projets simples

```
main
├── feature-a
├── feature-b
└── feature-c
```

Chaque fonctionnalité a son thread directement sous main. Contexte = décisions de main + fonctionnalité en cours.

### Arbres profonds pour les sujets complexes

```
main
└── auth
    └── oauth
        └── google-provider
            └── token-refresh-bug
```

Quand un sujet demande une exploration poussée, les threads imbriqués gardent chaque niveau ciblé. L'héritage sélectif garde la chaîne courte.

### Approche hybride

```
main
├── backend
│   ├── auth
│   │   └── oauth
│   └── api
│       ├── routes
│       └── middleware
└── frontend
    ├── components
    └── state-management
```

Organisez par couche d'architecture, puis par fonctionnalité dans chaque couche.

::: tip
Les threads terminés n'ont pas besoin de rester dans la chaîne : intégrez-les dans leur parent avec `thread_merge`. Les conclusions remontent et l'arbre reste peu profond.
:::

## Garde-fous

- **Détection des références circulaires** — si une chaîne de parents forme une boucle (possible seulement dans des fichiers modifiés à la main), ThreadMind lève une erreur
- **Profondeur maximale** — les chaînes sont limitées à 50 niveaux
