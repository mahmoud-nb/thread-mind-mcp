# Assemblage du contexte

L'assemblage du contexte est le mécanisme central de ThreadMind — il construit un **contexte ciblé** à partir de l'arborescence pour l'envoyer au modèle IA.

## Fonctionnement

Quand vous appelez `context_get` ou lisez la ressource `threadmind://context`, ThreadMind :

1. **Part** du thread actif
2. **Remonte** l'arbre en suivant les liens `parentId` jusqu'à la racine
3. **Inverse** la chaîne (racine → ... → actif)
4. **Concatène** le contexte système + tous les résumés dans l'ordre

### Exemple

Étant donné cet arbre :

```
main ("Vue d'ensemble : e-commerce Next.js...")
├── auth ("Auth JWT avec refresh tokens...")
│   ├── auth-ui ("Formulaire login, page inscription...") ← actif
│   └── auth-api ("POST /login, POST /register...")
└── dashboard ("Tableau de bord admin avec graphiques...")
```

Le contexte assemblé pour `auth-ui` est :

```markdown
## Contexte système

Construction d'une application e-commerce Next.js avec Stripe.

---

## Thread : Mon App

Vue d'ensemble : e-commerce Next.js avec PostgreSQL...

---

## Thread : Auth

Auth JWT avec refresh tokens, bcrypt, Passport.js...

---

## Thread : Auth UI (actif)

Formulaire de login email/mot de passe, page d'inscription
avec validation, flux mot de passe oublié...
```

### Ce qui est exclu

- **Les threads frères** (`auth-api` n'est pas inclus)
- **Les autres branches** (`dashboard` n'est pas inclus)
- **Les résumés vides** (les threads sans contenu sont ignorés)

C'est intentionnel — seul le **contexte ancestral direct** compte pour le thread actuel.

## Économies de tokens

Considérons un projet typique avec 5 niveaux de threads, chacun avec un résumé de 10 lignes (~100 tokens) :

| Approche | Tokens envoyés |
|----------|----------------|
| Historique complet (100 messages) | ~50 000 tokens |
| Contexte ThreadMind (5 résumés) | ~500 tokens |
| **Économie** | **~99%** |

Même avec des résumés généreux (500 tokens chacun), une chaîne de 5 niveaux ne coûte que 2 500 tokens — une réduction massive.

## Utiliser le contexte

### Comme outil

```
context_get
```

Retourne le contexte assemblé sous forme de texte. Utilisez-le pour injecter explicitement le contexte dans votre conversation.

### Comme ressource

La ressource `threadmind://context` expose le même contexte. Les clients MCP qui supportent les ressources peuvent l'afficher ou l'injecter automatiquement.

## Stratégies d'organisation

### Arbres peu profonds pour les projets simples

```
main
├── feature-a
├── feature-b
└── feature-c
```

Chaque fonctionnalité a son thread directement sous main. Contexte = main + feature courante.

### Arbres profonds pour les sujets complexes

```
main
└── auth
    └── oauth
        └── google-provider
            └── bug-refresh-token
```

Quand un sujet nécessite une exploration approfondie, les threads imbriqués gardent chaque niveau focalisé.

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
    ├── composants
    └── gestion-etat
```

Organisez par couche architecturale, puis par fonctionnalité dans chaque couche.

::: tip
La profondeur idéale d'un arbre est de **3-5 niveaux**. Des arbres plus profonds signifient plus de contexte par assemblage, ce qui réduit partiellement l'intérêt. Si vous allez plus profond, gardez les résumés très concis.
:::

## Protections

- **Détection de références circulaires** — si une chaîne de parents forme une boucle, ThreadMind lève une erreur
- **Limite de profondeur** — les chaînes sont plafonnées à 50 niveaux pour éviter une traversée infinie
