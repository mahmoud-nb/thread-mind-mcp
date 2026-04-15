# Mode \u00e9quipe

Le mode \u00e9quipe permet de partager les arborescences de threads entre d\u00e9veloppeurs via git.

## Vue d'ensemble

En mode \u00e9quipe :
- Les fichiers de threads et les structures d'arbre sont **commit\u00e9s dans git** et partag\u00e9s
- Chaque membre a un **identifiant auteur unique** stock\u00e9 localement
- Des r\u00e8gles de propri\u00e9t\u00e9 contr\u00f4lent qui peut modifier quels threads
- Les membres peuvent toujours **brancher depuis n'importe quel thread** pour construire sur le travail des autres

## Mise en place

### 1. Cr\u00e9er un projet en mode \u00e9quipe

```
project_create(title: "Notre App", mode: "team")
```

### 2. Commiter le dossier `.threadmind/`

```bash
git add .threadmind/
git commit -m "Initialisation du projet ThreadMind"
git push
```

### 3. Les coll\u00e8gues r\u00e9cup\u00e8rent et commencent \u00e0 travailler

```bash
git pull
# ThreadMind d\u00e9tecte automatiquement le projet
# Chaque coll\u00e8gue re\u00e7oit son propre ID auteur \u00e0 la premi\u00e8re utilisation
```

## Identit\u00e9 de l'auteur

\u00c0 la cr\u00e9ation d'un projet, ThreadMind g\u00e9n\u00e8re un identifiant auteur unique :

```
{git_user_name}-{uuid_4_caract\u00e8res}
```

Exemples :
- `mahmoud-a3f9`
- `sarah-7b2c`
- `dev-e4d1`

Cet ID est stock\u00e9 dans `.threadmind/config.json`, qui est **gitignor\u00e9** \u2014 chaque membre a sa propre identit\u00e9 locale.

## R\u00e8gles de propri\u00e9t\u00e9

| Action | Vos threads | Threads des coll\u00e8gues |
|--------|:-----------:|:----------------------:|
| Lire le r\u00e9sum\u00e9 | Oui | Oui |
| Modifier le r\u00e9sum\u00e9 | Oui | Non |
| Supprimer | Oui | Non |
| Cr\u00e9er un thread enfant | Oui | Oui |
| Basculer vers | Oui | Oui |

Le principe cl\u00e9 : **vous pouvez toujours lire et brancher depuis le travail de n'importe qui, mais vous ne pouvez modifier que le v\u00f4tre**.

## Workflow quotidien

### D\u00e9veloppement au quotidien

```bash
# D\u00e9but de journ\u00e9e : r\u00e9cup\u00e9rer les derniers threads
git pull

# Voir l'arborescence compl\u00e8te de l'\u00e9quipe
# \u2192 thread_list

main
\u251c\u2500\u2500 auth (sarah-7b2c)
\u2502   \u2514\u2500\u2500 auth-tests (sarah-7b2c)
\u251c\u2500\u2500 routes-api (mahmoud-a3f9)
\u2502   \u2514\u2500\u2500 validation-api (mahmoud-a3f9)
\u2514\u2500\u2500 frontend (alex-1e5f)
```

### Brancher depuis le thread d'un coll\u00e8gue

```
Vous : Cr\u00e9e un thread "Documentation API" sous "routes-api"

IA :   \u2713 Thread "documentation-api" cr\u00e9\u00e9 sous "routes-api".
       Auteur : sarah-7b2c (vous)
```

Maintenant vous \u00eates propri\u00e9taire de `documentation-api` et pouvez mettre \u00e0 jour son r\u00e9sum\u00e9, m\u00eame si son parent `routes-api` appartient \u00e0 un autre coll\u00e8gue.

### Partager votre travail

```bash
git add .threadmind/
git commit -m "Ajout du thread documentation API"
git push
```

## Comportement de merge Git

### Ce qui fusionne sans conflit

- **Fichiers de threads diff\u00e9rents** \u2014 chaque thread est un fichier `.md` s\u00e9par\u00e9, donc deux personnes cr\u00e9ant des threads diff\u00e9rents ne sont jamais en conflit
- **Nouveaux threads** \u2014 l'ajout de threads ne fait qu'ajouter \u00e0 la structure de l'arbre

### Ce qui peut g\u00e9n\u00e9rer des conflits

- **tree.json** \u2014 si deux personnes cr\u00e9ent des threads sous le m\u00eame parent simultan\u00e9ment, l'index de l'arbre peut \u00eatre en conflit. R\u00e9solution : accepter les deux changements (les deux nouveaux enfants doivent appara\u00eetre)

::: tip
Si les conflits d'arborescence deviennent fr\u00e9quents, vous pouvez reg\u00e9n\u00e9rer l'arbre \u00e0 partir du frontmatter des fichiers de threads. L'arbre est un index d\u00e9normalis\u00e9 \u2014 la source de v\u00e9rit\u00e9 est dans les fichiers de threads eux-m\u00eames.
:::

## Bonnes pratiques

1. **R\u00e9servez les sujets en cr\u00e9ant des threads** \u2014 cr\u00e9ez un thread avant de plonger dans un sujet pour signaler \u00e0 vos coll\u00e8gues ce sur quoi vous travaillez
2. **R\u00e9sumez r\u00e9guli\u00e8rement** \u2014 vos coll\u00e8gues b\u00e9n\u00e9ficient de vos r\u00e9sum\u00e9s m\u00eame sans lire votre code
3. **Branchez, ne modifiez pas** \u2014 si vous n'\u00eates pas d'accord avec l'approche d'un coll\u00e8gue, cr\u00e9ez un thread enfant avec votre alternative plut\u00f4t que de demander de changer son r\u00e9sum\u00e9
4. **Tirez (pull) avant de cr\u00e9er des threads** \u2014 \u00e9vitez le travail en doublon en voyant quels threads existent d\u00e9j\u00e0
