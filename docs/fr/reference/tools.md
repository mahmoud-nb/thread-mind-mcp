# R\u00e9f\u00e9rence des outils

ThreadMind expose 9 outils MCP. Tous retournent des r\u00e9ponses textuelles structur\u00e9es et utilisent `isError: true` en cas d'\u00e9chec.

## Outils de projet

### `project_create`

Cr\u00e9e un nouveau projet ThreadMind avec un thread racine `main`.

**Param\u00e8tres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `title` | `string` | Oui | Titre du projet (utilis\u00e9 pour g\u00e9n\u00e9rer l'ID slug) |
| `systemContext` | `string` | Non | Prompt syst\u00e8me global inclus dans chaque assemblage |
| `mode` | `"solo"` \| `"team"` | Non | Mode de collaboration (d\u00e9faut : `"solo"`) |

**Retourne :** Confirmation avec l'ID du projet et le mode.

**Effets secondaires :**
- Cr\u00e9e le fichier de configuration du projet
- Cr\u00e9e le thread `main`
- Initialise l'arborescence
- G\u00e9n\u00e8re l'ID auteur (si premier projet)
- D\u00e9finit comme projet actif

---

### `project_list`

Liste tous les projets ThreadMind.

**Param\u00e8tres :** Aucun

**Retourne :** Liste format\u00e9e avec titre, ID, mode et marqueur actif.

**Exemple de sortie :**
```
- Mon App (mon-app) [solo] \u2190 actif
- Projet Perso (projet-perso) [team]
```

---

### `project_switch`

Bascule vers un autre projet.

**Param\u00e8tres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `projectId` | `string` | Oui | ID du projet cible |

**Retourne :** Message de confirmation.

**Effets secondaires :**
- Met \u00e0 jour le projet actif
- R\u00e9initialise le thread actif \u00e0 `main`

---

## Outils de thread

### `thread_create`

Cr\u00e9e un nouveau thread enfant \u00e0 partir d'un parent.

**Param\u00e8tres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `title` | `string` | Oui | Titre du thread (utilis\u00e9 pour g\u00e9n\u00e9rer l'ID slug) |
| `parentId` | `string` | Non | ID du thread parent (d\u00e9faut : thread actif) |

**Retourne :** Confirmation avec l'ID du thread + visualisation de l'arbre.

---

### `thread_switch`

Bascule vers un autre thread.

**Param\u00e8tres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread cible |

**Retourne :** Confirmation + aper\u00e7u du contexte (300 premiers caract\u00e8res).

---

### `thread_list`

Affiche l'arborescence du projet actif.

**Param\u00e8tres :** Aucun

**Retourne :** Visualisation ASCII de l'arbre avec le thread actif marqu\u00e9.

**Exemple de sortie :**
```
main
\u251c\u2500\u2500 auth
\u2502   \u251c\u2500\u2500 auth-ui \u2190 actif
\u2502   \u2514\u2500\u2500 auth-api
\u2514\u2500\u2500 dashboard
```

---

### `thread_delete`

Supprime un thread et tous ses descendants.

**Param\u00e8tres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread \u00e0 supprimer |

**Retourne :** Confirmation + arborescence mise \u00e0 jour.

**Contraintes :**
- Impossible de supprimer le thread `main`
- En mode \u00e9quipe, seul l'auteur peut supprimer ses threads
- Cascade vers tous les descendants

---

## Outils de r\u00e9sum\u00e9 et contexte

### `summary_update`

Met \u00e0 jour le r\u00e9sum\u00e9 d'un thread.

**Param\u00e8tres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `content` | `string` | Oui | Nouveau contenu du r\u00e9sum\u00e9 (markdown) |
| `threadId` | `string` | Non | Thread \u00e0 mettre \u00e0 jour (d\u00e9faut : thread actif) |

**Retourne :** Confirmation avec l'ID du thread.

**Contraintes :**
- En mode \u00e9quipe, seul l'auteur peut modifier ses threads

---

### `context_get`

R\u00e9cup\u00e8re le contexte assembl\u00e9 complet pour le thread actif.

**Param\u00e8tres :** Aucun

**Retourne :** Le contexte assembl\u00e9 \u2014 contexte syst\u00e8me + r\u00e9sum\u00e9s des anc\u00eatres de la racine au thread actif.

**Algorithme :**
1. Remonter du thread actif \u00e0 la racine via `parentId`
2. Inverser la cha\u00eene (racine \u2192 actif)
3. Concat\u00e9ner contexte syst\u00e8me + r\u00e9sum\u00e9s
4. Ignorer les threads au contenu vide

Voir [Assemblage du contexte](/fr/guide/context-assembly) pour les d\u00e9tails.

---

## Gestion des erreurs

Tous les outils suivent le m\u00eame sch\u00e9ma d'erreur :

```json
{
  "content": [{ "type": "text", "text": "Error: No active project. Use project_create first." }],
  "isError": true
}
```

Erreurs courantes :
- `"No active project. Use project_create first."` \u2014 aucun projet s\u00e9lectionn\u00e9
- `"Thread \"x\" not found"` \u2014 ID de thread invalide
- `"Parent thread \"x\" not found"` \u2014 parent invalide lors de la cr\u00e9ation
- `"Cannot delete the main thread"` \u2014 tentative de suppression de la racine
- `"Cannot update thread \"x\": owned by \"y\""` \u2014 violation de propri\u00e9t\u00e9 en mode \u00e9quipe
