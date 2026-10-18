# Mode équipe

Le mode équipe permet de partager les arborescences de threads entre développeurs via git.

## Vue d'ensemble

En mode équipe :
- Les fichiers de threads sont **commités dans git** et partagés (chaque fichier enregistre son parent : il n'y a pas d'index d'arbre séparé)
- Chaque membre a un **identifiant auteur unique** stocké localement
- Des règles de propriété contrôlent qui peut modifier quels threads
- Les membres peuvent toujours **brancher depuis n'importe quel thread** pour construire sur le travail des autres

## Mise en place

### 1. Créer un projet en mode équipe

```
project_create(title: "Notre App", mode: "team")
```

### 2. Commiter le dossier `.threadmind/`

```bash
git add .threadmind/
git commit -m "Initialisation du projet ThreadMind"
git push
```

### 3. Les collègues récupèrent et commencent à travailler

```bash
git pull
# Un projet unique est sélectionné automatiquement (sinon : project_switch)
# Votre ID auteur est créé lors de votre première écriture
```

Un collègue qui récupère l'une de vos branches de fonctionnalité démarre sur le thread qui lui est lié (voir [Branches git](/fr/guide/threads#branches-git)).

## Identité de l'auteur

Lors de votre première écriture (création d'un thread, mise à jour d'un résumé…), ThreadMind dérive votre identifiant auteur de votre identité git :

```
{git_user_name}-{4 caractères hexa dérivés de git user.email}
```

Exemples :
- `mahmoud-a3f9`
- `sarah-7b2c`
- `dev-e4d1`

Comme il provient de `git config user.email`, vous obtenez le même ID sur chaque clone et chaque machine, et vous restez propriétaire de vos threads après un nouveau clone. Sans email git, un suffixe aléatoire est utilisé. Pour choisir l'ID explicitement, définissez `THREADMIND_AUTHOR` dans le `env` de la configuration du serveur MCP.

Cet ID est stocké dans `.threadmind/config.json`, qui est **gitignoré** — chaque membre a sa propre identité locale.

## Règles de propriété

| Action | Vos threads | Threads des collègues |
|--------|:-----------:|:----------------------:|
| Lire le résumé | Oui | Oui |
| Modifier le résumé | Oui | Non |
| Supprimer | Oui | Non |
| Créer un thread enfant | Oui | Oui |
| Basculer vers | Oui | Oui |

Le principe clé : **vous pouvez toujours lire et brancher depuis le travail de n'importe qui, mais vous ne pouvez modifier que le vôtre**.

Supprimer un thread supprime aussi ses descendants : la suppression est donc refusée si l'un d'eux appartient à un collègue.

::: warning
La propriété évite les modifications accidentelles ; ce n'est pas un contrôle d'accès. Toute personne ayant accès en écriture au dépôt peut modifier les fichiers directement ou définir `THREADMIND_AUTHOR`.
:::

## Workflow quotidien

### Travailler sur une branche de fonctionnalité

```bash
git pull
git switch -c feature/api-docs
```

```
Vous : Crée un thread "Documentation API" sous "routes-api"

IA :   ✓ Thread "documentation-api" créé sous "routes-api".
       Lié à la branche git "feature/api-docs" : il devient le thread actif dès que cette branche est récupérée.

       main
       ├── auth
       │   └── auth-tests
       ├── routes-api [branch: feature/routes-api]
       │   └── documentation-api [branch: feature/api-docs] ← active
       └── frontend
```

Vous êtes propriétaire de `documentation-api` et pouvez mettre à jour son résumé, même si son parent `routes-api` appartient à un autre collègue. L'auteur, le statut et la branche d'un thread sont affichés par sa ressource `threadmind://thread/{id}`.

### Le partager avec le code

Commitez les fichiers de threads avec le code qu'ils décrivent, pour qu'ils soient relus dans la même pull request :

```bash
git add .threadmind/ src/
git commit -m "docs(api): documenter les routes"
git push -u origin feature/api-docs
```

Un collègue qui récupère `feature/api-docs` démarre sa session suivante sur `documentation-api`. Une fois la branche fusionnée, intégrez le thread dans son parent avec `thread_merge`, ou clôturez-le avec `thread_status`.

## Comportement de merge Git

### Ce qui fusionne sans conflit

- **Fichiers de threads différents** — chaque thread est un fichier `.md` séparé qui enregistre son propre parent : deux personnes qui créent des threads ne sont jamais en conflit, même sous le même parent
- **État de session et mesures** — ils sont dans `.threadmind/config.json`, qui n'est pas commité

### Ce qui peut générer des conflits

- **Le même fichier de thread** — seulement si deux personnes modifient le même thread, ce que les règles de propriété empêchent via ThreadMind

::: warning Mise à jour depuis la 0.4
Les versions précédentes gardaient l'arbre dans `.threadmind/trees/<projet>.json` et les statistiques dans `.threadmind/stats/`. ThreadMind migre désormais l'arbre dans les fichiers de threads à la première utilisation et supprime `trees/<projet>.json` : commitez ce changement. Mettez à jour toute l'équipe en même temps, car les anciennes versions ont besoin du fichier d'arbre. Le dossier `stats/` n'est plus utilisé et peut être supprimé.
:::

## Bonnes pratiques

1. **Réservez les sujets en créant des threads** — créez un thread avant de plonger dans un sujet pour signaler à vos collègues ce sur quoi vous travaillez
2. **Résumez régulièrement** — vos collègues bénéficient de vos résumés même sans lire votre code
3. **Branchez, ne modifiez pas** — si vous n'êtes pas d'accord avec l'approche d'un collègue, créez un thread enfant avec votre alternative plutôt que de demander de changer son résumé
4. **Tirez (pull) avant de créer des threads** — évitez le travail en doublon en voyant quels threads existent déjà
