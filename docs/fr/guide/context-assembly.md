# Assemblage du contexte

L'assemblage du contexte est le m\u00e9canisme central de ThreadMind \u2014 il construit un **contexte cibl\u00e9** \u00e0 partir de l'arborescence pour l'envoyer au mod\u00e8le IA.

## Fonctionnement

Quand vous appelez `context_get` ou lisez la ressource `threadmind://context`, ThreadMind :

1. **Part** du thread actif
2. **Remonte** l'arbre en suivant les liens `parentId` jusqu'\u00e0 la racine
3. **Inverse** la cha\u00eene (racine \u2192 ... \u2192 actif)
4. **Concat\u00e8ne** le contexte syst\u00e8me + tous les r\u00e9sum\u00e9s dans l'ordre

### Exemple

\u00c9tant donn\u00e9 cet arbre :

```
main ("Vue d'ensemble : e-commerce Next.js...")
\u251c\u2500\u2500 auth ("Auth JWT avec refresh tokens...")
\u2502   \u251c\u2500\u2500 auth-ui ("Formulaire login, page inscription...") \u2190 actif
\u2502   \u2514\u2500\u2500 auth-api ("POST /login, POST /register...")
\u2514\u2500\u2500 dashboard ("Tableau de bord admin avec graphiques...")
```

Le contexte assembl\u00e9 pour `auth-ui` est :

```markdown
## Contexte syst\u00e8me

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
avec validation, flux mot de passe oubli\u00e9...
```

### Ce qui est exclu

- **Les threads fr\u00e8res** (`auth-api` n'est pas inclus)
- **Les autres branches** (`dashboard` n'est pas inclus)
- **Les r\u00e9sum\u00e9s vides** (les threads sans contenu sont ignor\u00e9s)

C'est intentionnel \u2014 seul le **contexte ancestral direct** compte pour le thread actuel.

## \u00c9conomies de tokens

Consid\u00e9rons un projet typique avec 5 niveaux de threads, chacun avec un r\u00e9sum\u00e9 de 10 lignes (~100 tokens) :

| Approche | Tokens envoy\u00e9s |
|----------|----------------|
| Historique complet (100 messages) | ~50 000 tokens |
| Contexte ThreadMind (5 r\u00e9sum\u00e9s) | ~500 tokens |
| **\u00c9conomie** | **~99%** |

M\u00eame avec des r\u00e9sum\u00e9s g\u00e9n\u00e9reux (500 tokens chacun), une cha\u00eene de 5 niveaux ne co\u00fbte que 2 500 tokens \u2014 une r\u00e9duction massive.

## Utiliser le contexte

### Comme outil

```
context_get
```

Retourne le contexte assembl\u00e9 sous forme de texte. Utilisez-le pour injecter explicitement le contexte dans votre conversation.

### Comme ressource

La ressource `threadmind://context` expose le m\u00eame contexte. Les clients MCP qui supportent les ressources peuvent l'afficher ou l'injecter automatiquement.

## Strat\u00e9gies d'organisation

### Arbres peu profonds pour les projets simples

```
main
\u251c\u2500\u2500 feature-a
\u251c\u2500\u2500 feature-b
\u2514\u2500\u2500 feature-c
```

Chaque fonctionnalit\u00e9 a son thread directement sous main. Contexte = main + feature courante.

### Arbres profonds pour les sujets complexes

```
main
\u2514\u2500\u2500 auth
    \u2514\u2500\u2500 oauth
        \u2514\u2500\u2500 google-provider
            \u2514\u2500\u2500 bug-refresh-token
```

Quand un sujet n\u00e9cessite une exploration approfondie, les threads imbriqu\u00e9s gardent chaque niveau focalis\u00e9.

### Approche hybride

```
main
\u251c\u2500\u2500 backend
\u2502   \u251c\u2500\u2500 auth
\u2502   \u2502   \u2514\u2500\u2500 oauth
\u2502   \u2514\u2500\u2500 api
\u2502       \u251c\u2500\u2500 routes
\u2502       \u2514\u2500\u2500 middleware
\u2514\u2500\u2500 frontend
    \u251c\u2500\u2500 composants
    \u2514\u2500\u2500 gestion-etat
```

Organisez par couche architecturale, puis par fonctionnalit\u00e9 dans chaque couche.

::: tip
La profondeur id\u00e9ale d'un arbre est de **3-5 niveaux**. Des arbres plus profonds signifient plus de contexte par assemblage, ce qui r\u00e9duit partiellement l'int\u00e9r\u00eat. Si vous allez plus profond, gardez les r\u00e9sum\u00e9s tr\u00e8s concis.
:::

## Protections

- **D\u00e9tection de r\u00e9f\u00e9rences circulaires** \u2014 si une cha\u00eene de parents forme une boucle, ThreadMind l\u00e8ve une erreur
- **Limite de profondeur** \u2014 les cha\u00eenes sont plafonn\u00e9es \u00e0 50 niveaux pour \u00e9viter une travers\u00e9e infinie
