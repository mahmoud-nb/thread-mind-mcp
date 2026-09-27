# Référence des outils

ThreadMind expose 12 outils MCP. Tous retournent des réponses textuelles structurées et utilisent `isError: true` en cas d'échec.

Chaque outil déclare un titre et des annotations MCP : `readOnlyHint` pour `project_list`, `thread_list`, `context_get` et `stats_show` ; `destructiveHint` pour `thread_delete` et `summary_update` (qui remplace le résumé précédent). Les clients peuvent s'en servir pour décider quand demander une confirmation.

Le serveur envoie aussi ses consignes d'utilisation au client à la connexion (instructions de serveur MCP) : un client comme Claude Code n'a besoin d'aucun fichier d'instructions.

## Outils de projet

### `project_create`

Crée un nouveau projet ThreadMind avec un thread racine `main`.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `title` | `string` | Oui | Titre du projet (utilisé pour générer l'ID slug) |
| `systemContext` | `string` | Non | Prompt système global inclus dans chaque assemblage |
| `mode` | `"solo"` \| `"team"` | Non | Mode de collaboration (défaut : `"solo"`) |

**Retourne :** Confirmation avec l'ID du projet et le mode.

**Effets secondaires :**
- Crée le fichier de configuration du projet
- Crée le thread `main`
- Initialise l'arborescence
- Génère votre ID auteur (s'il n'existe pas encore)
- Définit comme projet actif

---

### `project_list`

Liste tous les projets ThreadMind.

**Paramètres :** Aucun

**Retourne :** Liste formatée avec titre, ID, mode et marqueur actif.

**Exemple de sortie :**
```
- Mon App (mon-app) [solo] ← actif
- Projet Perso (projet-perso) [team]
```

---

### `project_switch`

Bascule vers un autre projet.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `projectId` | `string` | Oui | ID du projet cible |

**Retourne :** Message de confirmation.

**Effets secondaires :**
- Met à jour le projet actif
- Réinitialise le thread actif à `main`

---

## Outils de thread

### `thread_create`

Crée un nouveau thread enfant à partir d'un parent.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `title` | `string` | Oui | Titre du thread (utilisé pour générer l'ID slug) |
| `parentId` | `string` | Non | ID du thread parent (défaut : thread actif) |

**Retourne :** Confirmation avec l'ID du thread + visualisation de l'arbre.

**Vérification du résumé parent :** après la création, l'outil lit le contenu du thread parent. Si celui-ci n'a pas encore de résumé, un avertissement `⚠️` est ajouté à la réponse, suggérant de lancer `tm:summary` sur le parent avant de continuer. Le thread enfant est toujours créé, indépendamment de cette vérification.

---

### `thread_switch`

Bascule vers un autre thread.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread cible |

**Retourne :** Confirmation + le contexte assemblé complet du nouveau thread : inutile d'appeler `context_get` ensuite.

**Effets secondaires :**
- Définit le thread comme thread actif

---

### `thread_list`

Affiche l'arborescence du projet actif.

**Paramètres :** Aucun

**Retourne :** Visualisation ASCII de l'arbre avec le thread actif marqué.

**Exemple de sortie :**
```
main
├── auth
│   ├── auth-ui ← actif
│   └── auth-api
└── dashboard
```

---

### `thread_delete`

Supprime un thread et tous ses descendants.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread à supprimer |

**Retourne :** Confirmation + arborescence mise à jour.

**Contraintes :**
- Impossible de supprimer le thread `main`
- En mode équipe, seul l'auteur peut supprimer ses threads
- Cascade vers tous les descendants

---

### `thread_rebase`

Déplace un thread (et tous ses descendants) vers un autre parent. Similaire à `git rebase`.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread à déplacer |
| `newParentId` | `string` | Oui | ID du nouveau thread parent |

**Retourne :** Confirmation + arborescence mise à jour.

**Contraintes :**
- Impossible de rebaser le thread `main`
- Impossible de créer des références circulaires (le parent cible ne doit pas être un descendant du thread déplacé)
- Impossible de rebaser sur soi-même ou le parent actuel
- En mode équipe, seul l'auteur du thread peut le rebaser

**Effets secondaires :**
- Retire le thread de la liste des enfants de l'ancien parent
- Ajoute le thread à la liste des enfants du nouveau parent
- Met à jour `parentId` dans l'arborescence et le frontmatter du thread
- Met à jour le timestamp `updatedAt` du thread déplacé

---

## Outils de résumé et contexte

### `summary_update`

Met à jour le résumé d'un thread.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `content` | `string` | Oui | Nouveau contenu du résumé (markdown) |
| `threadId` | `string` | Non | Thread à mettre à jour (défaut : thread actif) |

**Retourne :** Confirmation avec l'ID du thread.

**Contraintes :**
- En mode équipe, seul l'auteur peut modifier ses threads

**Effets secondaires :**
- Écrase le contenu du thread avec le nouveau résumé
- Met à jour le timestamp `updatedAt`
- Enregistre la mise à jour dans les statistiques d'économie de tokens

---

### `context_get`

Récupère le contexte assemblé complet pour le thread actif.

**Paramètres :** Aucun

**Retourne :** Le contexte assemblé — contexte système + résumés des ancêtres de la racine au thread actif, avec un pied de page d'estimation de tokens :

```
ThreadMind context: ~450 tokens | depth: 3 threads
```

**Algorithme :**
1. Remonter du thread actif à la racine via `parentId`
2. Inverser la chaîne (racine → actif)
3. Concaténer contexte système + résumés
4. Ignorer les threads au contenu vide
5. Estimer le nombre de tokens (~1 token pour 3,5 caractères)

Voir [Assemblage du contexte](/fr/guide/context-assembly) pour les détails.

---

## Outils de configuration

### `threadmind_init`

Écrit les consignes d'utilisation du serveur dans les fichiers lus par les agents qui ne reçoivent pas les instructions de serveur MCP. Claude Code n'en a pas besoin.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `clients` | `string[]` | Non | Fichiers à générer : `"agents"`, `"claude"`, `"cursor"`, `"generic"` (défaut : `agents` et `generic`) |

**Retourne :** Confirmation avec la liste des fichiers générés, et des notes sur les sections laissées par les versions précédentes.

**Fichiers générés :**

| Cible | Fichier | Lu par |
|-------|---------|--------|
| `agents` | `AGENTS.md` | Codex, Cursor, GitHub Copilot et d'autres agents |
| `claude` | `CLAUDE.md` | Claude Code — inutile, il reçoit les instructions du serveur |
| `cursor` | `.cursor/rules/threadmind.mdc` | Cursor, comme règle de projet toujours appliquée |
| `generic` | `.threadmind/instructions.md` | À coller dans les instructions personnalisées de n'importe quel client |

Dans les fichiers Markdown, la section ThreadMind est placée entre les marqueurs `<!-- threadmind:start -->` et `<!-- threadmind:end -->` : le reste du fichier est préservé. Le fichier de règle Cursor est entièrement généré.

Les instructions demandent à l'IA de :
- Appeler `context_get` une fois au début d'une session
- Appeler `summary_update` après une décision ou une tâche terminée, en gardant ce qui reste vrai
- Utiliser `thread_list`, puis `thread_switch` ou `thread_create`, quand le sujet change
- Exécuter les raccourcis `tm:` tapés par l'utilisateur

**Migration :** les versions précédentes écrivaient `CLAUDE.md` et `.cursorrules`. En générant la règle Cursor, `threadmind_init` retire la section ThreadMind de `.cursorrules` (et supprime le fichier s'il ne contient plus rien). Une section ThreadMind restée dans un fichier non ciblé est signalée, pas modifiée.

---

## Prompts MCP

ThreadMind fournit 11 Prompts MCP — des templates structurés que les clients peuvent invoquer comme slash commands.

### Prompts en lecture seule

Ces prompts intègrent directement leur résultat dans le message, sans appel d'outil.

| Prompt | Contenu | Arguments |
|--------|---------|-----------|
| `tm-help` | Référence des commandes, projet et thread actifs | Aucun |
| `tm-context` | Contexte assemblé du thread actif | Aucun |
| `tm-tree` | Arbre des threads du projet actif | Aucun |
| `tm-stats` | Statistiques d'économie de tokens | Aucun |

### Prompts qui modifient l'état

Ces prompts demandent à l'IA d'appeler l'outil correspondant : les réglages de confirmation du client continuent de s'appliquer.

| Prompt | Outil | Arguments |
|--------|-------|-----------|
| `tm-create` | `thread_create` | `title` (requis) |
| `tm-switch` | `thread_switch` | `threadId` (requis, avec autocomplétion) |
| `tm-rebase` | `thread_rebase` | `threadId`, `newParentId` (requis, avec autocomplétion) |
| `tm-summary` | `summary_update` | `content` (optionnel — l'IA rédige le résumé s'il est omis), `topic` (indication optionnelle) |
| `tm-init` | `threadmind_init` | Aucun |

Sans `content`, `tm-summary` fournit à l'IA le résumé actuel et un modèle (décisions et raisons, choix techniques, état actuel, questions ouvertes).

### Alias de compatibilité

| Prompt | Équivalent |
|--------|------------|
| `start-thread` | `tm-context` |
| `summarize-thread` | `tm-summary` sans `content` (accepte un `topic` optionnel) |

Dans Claude Code, ils apparaissent comme `/mcp__thread-mind__tm-help`, `/mcp__thread-mind__tm-create`, etc.

### Raccourcis texte (commandes `tm:`)

Les instructions du serveur (et les fichiers générés par `threadmind_init`) apprennent à l'IA à reconnaître des commandes courtes tapées directement dans le chat :

```
tm:help                → Afficher toutes les commandes
tm:context             → context_get
tm:tree                → thread_list
tm:create Auth System  → thread_create(title: "Auth System")
tm:switch auth-ui      → thread_switch(threadId: "auth-ui")
tm:rebase auth-ui dashboard → thread_rebase(threadId: "auth-ui", newParentId: "dashboard")
tm:summary             → Auto-générer + sauvegarder le résumé
tm:summary <contenu>   → summary_update(content: ...)
tm:stats               → stats_show
tm:delete auth-api     → thread_delete(threadId: "auth-api")
tm:init                → threadmind_init
tm:project Mon App     → project_create(title: "Mon App")
tm:projects            → project_list
```

Ces raccourcis fonctionnent dans tout client IA qui lit les instructions de serveur MCP ou l'un des fichiers générés.

---

## Outils de statistiques

### `stats_show`

Affiche les statistiques d'économie de tokens pour le projet ThreadMind actif.

**Paramètres :** Aucun

**Retourne :** Un rapport formaté contenant :
- Vue d'ensemble : nombre de threads, mises à jour de résumés, taille du contexte actuel
- Économies de tokens : historique brut estimé vs contexte ThreadMind, ratio de compression
- Détail par thread : mises à jour, tokens actuels, input cumulé, ratio

**Exemple de sortie :**
```
ThreadMind Stats: "Mon Projet"

Overview:
  Threads: 5 (3 with tracked updates)
  Summary updates: 12
  Current context: ~450 tokens (depth: 3)

Token Savings (estimated):
  Estimated raw history: ~12,000 tokens
  ThreadMind context:    ~450 tokens
  Reduction:             ~96%

Per-Thread Breakdown:
  Thread               Updates  Current   Cumulative    Ratio
  main                 4        ~120      ~3400         96%
  auth-system          3        ~90       ~2800         97%

Method: Cumulative summary input vs current context size.
Token estimates use ~3.5 chars/token approximation.
```

**Fonctionnement :** Chaque appel à `summary_update` est tracké. L'input cumulé représente le texte total compressé en résumés au fil du temps. Le ratio compare cet input cumulé au contexte assemblé actuel — montrant la compression réalisée par ThreadMind.

::: info
Les estimations de tokens sont approximatives (~3,5 caractères/token). Le protocole MCP ne permet pas d'accéder à la consommation réelle de tokens du modèle. Toutes les métriques sont dérivées du texte que ThreadMind stocke et sert.
:::

---

## Gestion des erreurs

Tous les outils suivent le même schéma d'erreur :

```json
{
  "content": [{ "type": "text", "text": "Error: No active project. Use project_create first." }],
  "isError": true
}
```

Les IDs de threads et de projets n'acceptent que des lettres minuscules, des chiffres et des tirets. Toute autre valeur (y compris un chemin comme `../`) est refusée avant l'exécution de l'outil, avec une `Input validation error`.

Erreurs courantes :
- `"No active project. Use project_create first."` — aucun projet sélectionné
- `"Thread \"x\" not found"` — le thread n'est pas dans l'arbre du projet actif
- `"Parent thread \"x\" not found"` — parent invalide lors de la création
- `"Cannot delete the main thread"` — tentative de suppression de la racine
- `"Cannot rebase the main thread"` — tentative de rebase de la racine
- `"\"x\" is a descendant of \"y\""` — référence circulaire détectée lors du rebase
- `"Cannot update thread \"x\": owned by \"y\""` — violation de propriété en mode équipe
- `"... its descendants include threads owned by others"` — suppression en mode équipe qui entraînerait en cascade des threads d'un collègue
