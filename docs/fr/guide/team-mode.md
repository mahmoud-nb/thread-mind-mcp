# Mode équipe

Le mode équipe permet de partager les arborescences de threads entre développeurs via git.

## Vue d'ensemble

En mode équipe :
- Les fichiers de threads et les structures d'arbre sont **commités dans git** et partagés
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
# ThreadMind détecte automatiquement le projet
# Chaque collègue reçoit son propre ID auteur à la première utilisation
```

## Identité de l'auteur

À la création d'un projet, ThreadMind génère un identifiant auteur unique :

```
{git_user_name}-{uuid_4_caractères}
```

Exemples :
- `mahmoud-a3f9`
- `sarah-7b2c`
- `dev-e4d1`

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

## Workflow quotidien

### Développement au quotidien

```bash
# Début de journée : récupérer les derniers threads
git pull

# Voir l'arborescence complète de l'équipe
# → thread_list

main
├── auth (sarah-7b2c)
│   └── auth-tests (sarah-7b2c)
├── routes-api (mahmoud-a3f9)
│   └── validation-api (mahmoud-a3f9)
└── frontend (alex-1e5f)
```

### Brancher depuis le thread d'un collègue

```
Vous : Crée un thread "Documentation API" sous "routes-api"

IA :   ✓ Thread "documentation-api" créé sous "routes-api".
       Auteur : sarah-7b2c (vous)
```

Maintenant vous êtes propriétaire de `documentation-api` et pouvez mettre à jour son résumé, même si son parent `routes-api` appartient à un autre collègue.

### Partager votre travail

```bash
git add .threadmind/
git commit -m "Ajout du thread documentation API"
git push
```

## Comportement de merge Git

### Ce qui fusionne sans conflit

- **Fichiers de threads différents** — chaque thread est un fichier `.md` séparé, donc deux personnes créant des threads différents ne sont jamais en conflit
- **Nouveaux threads** — l'ajout de threads ne fait qu'ajouter à la structure de l'arbre

### Ce qui peut générer des conflits

- **tree.json** — si deux personnes créent des threads sous le même parent simultanément, l'index de l'arbre peut être en conflit. Résolution : accepter les deux changements (les deux nouveaux enfants doivent apparaître)

::: tip
Si les conflits d'arborescence deviennent fréquents, vous pouvez regénérer l'arbre à partir du frontmatter des fichiers de threads. L'arbre est un index dénormalisé — la source de vérité est dans les fichiers de threads eux-mêmes.
:::

## Bonnes pratiques

1. **Réservez les sujets en créant des threads** — créez un thread avant de plonger dans un sujet pour signaler à vos collègues ce sur quoi vous travaillez
2. **Résumez régulièrement** — vos collègues bénéficient de vos résumés même sans lire votre code
3. **Branchez, ne modifiez pas** — si vous n'êtes pas d'accord avec l'approche d'un collègue, créez un thread enfant avec votre alternative plutôt que de demander de changer son résumé
4. **Tirez (pull) avant de créer des threads** — évitez le travail en doublon en voyant quels threads existent déjà
