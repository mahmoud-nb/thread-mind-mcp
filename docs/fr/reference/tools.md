# Référence des outils

ThreadMind expose 14 outils MCP. Tous retournent des réponses textuelles structurées et utilisent `isError: true` en cas d'échec. Lancé par le plugin Claude Code, le serveur expose aussi [`threadmind_hook`](#threadmind-hook), que seuls les hooks du plugin appellent.

Chaque outil déclare un titre et des annotations MCP : `readOnlyHint` pour `project_list`, `thread_list`, `context_get` et `stats_show` ; `destructiveHint` pour `thread_delete`, `summary_update` (qui peut remplacer le résumé précédent) et `thread_merge` (qui remplace le résumé du parent). Les clients peuvent s'en servir pour décider quand demander une confirmation.

Le serveur envoie aussi ses consignes d'utilisation au client à la connexion (instructions de serveur MCP) : un client comme Claude Code n'a besoin d'aucun fichier d'instructions.

Chaque session a son propre projet et son propre thread actifs : voir [Le thread actif](/fr/guide/threads#le-thread-actif).

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
- Crée le fichier de configuration du projet et le thread `main`
- Génère votre ID auteur (s'il n'existe pas encore)
- En fait le projet actif de la session, sur `main`

---

### `project_list`

Liste tous les projets ThreadMind.

**Paramètres :** Aucun

**Retourne :** Liste formatée avec titre, ID, mode, et le projet de la session marqué.

**Exemple de sortie :**
```
- Mon App (mon-app) [solo] ← active
- Projet Perso (projet-perso) [team]
```

---

### `project_switch`

Fait passer la session sur un autre projet.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `projectId` | `string` | Oui | ID du projet cible |

**Retourne :** Confirmation avec le thread actif, choisi comme au démarrage d'une session.

Inutile dans un dépôt qui n'a qu'un projet : il est sélectionné automatiquement.

---

## Outils de threads

### `thread_create`

Crée un nouveau thread enfant à partir d'un parent.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `title` | `string` | Oui | Titre du thread (utilisé pour générer l'ID slug) |
| `parentId` | `string` | Non | ID du thread parent (défaut : thread actif) |

**Retourne :** Confirmation avec l'ID du thread, la branche à laquelle il a été lié (le cas échéant) et l'arbre mis à jour.

**Effets secondaires :**
- Crée le fichier du thread
- Sur une branche de fonctionnalité sans thread ouvert lié, lie le thread à cette branche
- En fait le thread actif de la session

**Vérification du résumé parent :** si le parent n'a pas encore de résumé, un avertissement `⚠️` suggère de lancer `tm:summary` dessus. Le thread est créé dans tous les cas.

---

### `thread_switch`

Fait passer la session sur un autre thread.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread cible |
| `maxTokens` | `number` | Non | Budget de tokens du contexte renvoyé |

**Retourne :** Confirmation + le contexte assemblé complet du nouveau thread : inutile d'appeler `context_get` ensuite.

Les autres sessions gardent leur thread ; les nouvelles sessions sur la même branche git démarreront sur celui-ci.

---

### `thread_list`

Affiche l'arbre des threads du projet de la session.

**Paramètres :** Aucun

**Retourne :** Arbre ASCII avec le thread actif, les statuts et les branches liées.

**Exemple de sortie :**
```
main
├── auth
│   ├── auth-ui [branch: feature/auth-ui] ← active
│   └── auth-api
├── graphql [abandoned]
└── dashboard
```

---

### `thread_status`

Marque un thread comme terminé ou abandonné, ou le rouvre.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `status` | `"active"` \| `"done"` \| `"abandoned"` | Oui | Nouveau statut |
| `threadId` | `string` | Non | ID du thread (défaut : thread actif) |
| `reason` | `string` | Non | Pourquoi ; ajouté à la section Decisions du thread |

**Retourne :** Confirmation + arbre mis à jour.

**Contraintes :**
- Le thread `main` ne peut pas être clos
- En mode équipe, seul l'auteur du thread peut changer son statut

Un thread clos n'est plus lié à sa branche pour les nouvelles sessions.

---

### `thread_merge`

Intègre un thread terminé dans son parent.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `parentSummary` | `string` | Oui | Le nouveau résumé du parent, incluant les conclusions du thread (rédigé par l'IA) |
| `threadId` | `string` | Non | Thread à intégrer (défaut : thread actif) |

**Retourne :** Confirmation + arbre mis à jour.

**Effets secondaires :**
- Remplace le résumé du parent par `parentSummary`
- Marque le thread `done`, avec `mergedInto` égal au parent
- Fait du parent le thread actif de la session

En mode équipe, il faut être propriétaire du thread et de son parent.

---

### `thread_delete`

Supprime un thread et tous ses descendants.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread à supprimer |

**Retourne :** Confirmation + arbre mis à jour.

**Contraintes :**
- Impossible de supprimer le thread `main`
- En mode équipe, seulement vos propres threads, et pas si un descendant appartient à un collègue
- Supprime en cascade tous les descendants

Une session dont le thread actif a été supprimé repart comme au démarrage d'une session.

---

### `thread_rebase`

Déplace un thread (et tous ses descendants) sous un autre parent. Comme `git rebase`.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread à déplacer |
| `newParentId` | `string` | Oui | ID du nouveau parent |

**Retourne :** Confirmation + arbre mis à jour.

**Contraintes :**
- Impossible de rebaser le thread `main`
- Impossible de créer une référence circulaire (le nouveau parent ne doit pas être un descendant du thread déplacé)
- Impossible de rebaser un thread sur lui-même ou sur son parent actuel
- En mode équipe, seul l'auteur du thread peut le rebaser

**Effets secondaires :** met à jour `parentId` et `updatedAt` dans le frontmatter du thread ; les descendants suivent.

---

## Outils de résumé et de contexte

### `summary_update`

Met à jour le résumé d'un thread, ou l'une de ses sections.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `content` | `string` | Oui | Nouveau résumé, ou texte à ajouter à `section` (Markdown) |
| `threadId` | `string` | Non | Thread à mettre à jour (défaut : thread actif) |
| `section` | `string` | Non | Ne mettre à jour que cette section : `decisions`, `constraints`, `state`, `open-questions` ou `next-steps` |
| `replaceSection` | `boolean` | Non | Remplacer la section au lieu de la compléter (pour `state` et `next-steps`) |
| `paths` | `string[]` | Non | Fichiers ou dossiers dont parle le thread ; une liste vide les efface. S'il est omis, les fichiers modifiés par Claude sur le thread depuis le dernier enregistrement sont ajoutés, si le [plugin Claude Code](/fr/guide/claude-code-plugin#les-fichiers-modifies-enregistres-avec-le-resume) les a signalés |

**Retourne :** Confirmation avec l'ID du thread, et les fichiers enregistrés avec le résumé quand le plugin les a signalés.

**Contraintes :**
- En mode équipe, seulement vos propres threads

**Effets secondaires :**
- Sans `section`, remplace tout le résumé ; avec, complète (ou remplace) seulement cette section, en la créant à sa place si elle manque
- Enregistre le commit git courant, qui sert à signaler le résumé quand ses `paths` changent
- Met à jour `updatedAt`

---

### `context_get`

Renvoie le contexte assemblé du thread actif de la session.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `maxTokens` | `number` | Non | Budget de tokens : les ancêtres les plus lointains sont retirés en premier |

**Retourne :** Le contexte système, les sections durables (Decisions, Constraints) des résumés des ancêtres et tout le résumé du thread actif, avec un pied de page :

```
_ThreadMind context: ~450 tokens | depth: 3 threads_
```

**Algorithme :**
1. Remonter du thread actif à la racine via `parentId`
2. Inverser la chaîne (racine → actif)
3. Garder les Decisions et Constraints des ancêtres (les résumés libres en entier) et tout le résumé du thread actif ; ignorer les résumés vides
4. Ajouter un avertissement sous les résumés dont les `paths` ont changé depuis leur écriture
5. Retirer les ancêtres les plus lointains pour respecter `maxTokens`
6. Estimer le nombre de tokens (~1 token pour 3,5 caractères)

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
| `cursor` | `.cursor/rules/threadmind.mdc` | Cursor, comme règle de projet toujours appliquée, à la place d'`AGENTS.md` (Cursor lit les deux) |
| `generic` | `.threadmind/instructions.md` | À coller dans les instructions personnalisées de n'importe quel client |

Dans les fichiers Markdown, la section ThreadMind est placée entre les marqueurs `<!-- threadmind:start -->` et `<!-- threadmind:end -->` : le reste du fichier est préservé. Le fichier de règle Cursor est entièrement généré.

Les instructions demandent à l'IA de :
- Appeler `context_get` une fois au début d'une session, sauf si le contexte a déjà été chargé
- Structurer les résumés en sections, et compléter une section avec `summary_update` après une décision ou une tâche terminée
- Utiliser `thread_list`, puis `thread_switch` ou `thread_create`, quand le sujet change
- Clore les threads terminés avec `thread_merge` ou `thread_status`
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
| `tm-stats` | Tailles des résumés et tailles de conversation mesurées | Aucun |

### Prompts qui modifient l'état

Ces prompts demandent à l'IA d'appeler l'outil correspondant : les réglages de confirmation du client continuent de s'appliquer.

| Prompt | Outil | Arguments |
|--------|-------|-----------|
| `tm-create` | `thread_create` | `title` (requis) |
| `tm-switch` | `thread_switch` | `threadId` (requis, avec autocomplétion) |
| `tm-rebase` | `thread_rebase` | `threadId`, `newParentId` (requis, avec autocomplétion) |
| `tm-summary` | `summary_update` | `content` (optionnel — l'IA rédige le résumé s'il est omis), `topic` (indication optionnelle) |
| `tm-init` | `threadmind_init` | Aucun |

Sans `content`, `tm-summary` fournit à l'IA le résumé actuel et le modèle de sections.

### Alias de compatibilité

| Prompt | Équivalent |
|--------|------------|
| `start-thread` | `tm-context` |
| `summarize-thread` | `tm-summary` sans `content` (accepte un `topic` optionnel) |

Dans Claude Code, ils apparaissent comme `/mcp__thread-mind__tm-help`, `/mcp__thread-mind__tm-create`, etc. Le [plugin Claude Code](/fr/guide/claude-code-plugin) ajoute des commandes plus courtes `/thread-mind:*`.

### Raccourcis texte (commandes `tm:`)

Les instructions du serveur (et les fichiers générés par `threadmind_init`) apprennent à l'IA à reconnaître des commandes courtes tapées directement dans le chat :

```
tm:help                → Afficher toutes les commandes
tm:context             → context_get
tm:tree                → thread_list
tm:create Auth System  → thread_create(title: "Auth System")
tm:switch auth-ui      → thread_switch(threadId: "auth-ui")
tm:rebase auth-ui dashboard → thread_rebase(threadId: "auth-ui", newParentId: "dashboard")
tm:summary             → Rédiger + sauvegarder le résumé
tm:summary <contenu>   → summary_update(content: ...)
tm:merge               → thread_merge (l'IA rédige le nouveau résumé du parent)
tm:done [raison]       → thread_status(status: "done")
tm:abandon <raison>    → thread_status(status: "abandoned")
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

Affiche l'état des résumés du projet et, avec le plugin Claude Code, la taille réelle atteinte par les conversations.

**Paramètres :** Aucun

**Exemple de sortie :**
```
ThreadMind Stats: "Mon Projet"

Threads: 7 (5 active, 1 done, 1 abandoned)
Active thread: auth-ui (depth 3, ~450 tokens of context)

Summaries:
  Thread                   Tokens   Updated
  main                     ~120     2026-09-20
  auth                     ~90      2026-09-25
  auth-ui                  ~140     2026-09-27

Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)

Summary and context sizes are estimates (~3.5 characters per token); conversation sizes come from the Claude Code transcripts.
```

Sans le plugin, la partie mesurée explique comment obtenir des mesures. Les tailles de conversation sont lues dans les données d'usage des transcripts par le hook `SessionEnd` du plugin ; voir [Plugin Claude Code](/fr/guide/claude-code-plugin#des-statistiques-mesurees).

---

## Outil des hooks

### `threadmind_hook`

Le point d'entrée des hooks du [plugin Claude Code](/fr/guide/claude-code-plugin#hooks-et-fichiers). Il n'existe que lorsque le serveur tourne avec `THREADMIND_HOOKS=1`, comme le lance le plugin ; l'IA a pour consigne de ne jamais l'appeler.

**Paramètres :** `event` (`session-start`, `stop`, `pre-compact`, `user-prompt`, `file-edited` ou `branch-check`), plus les champs de l'entrée du hook Claude Code utiles à cet événement : `session_id`, `transcript_path`, `source`, `trigger`, `stop_hook_active`, `prompt`, `file_path`.

**Retourne :** Une sortie de hook Claude Code en JSON, ou aucun contenu quand le hook n'a rien à faire.

---

## Gestion des erreurs

Tous les outils suivent le même schéma d'erreur :

```json
{
  "content": [{ "type": "text", "text": "Error: No ThreadMind project in this workspace. Only create one (project_create) if the user asks for it." }],
  "isError": true
}
```

Les IDs de threads et de projets n'acceptent que des lettres minuscules, des chiffres et des tirets. Toute autre valeur (y compris un chemin comme `../`) est refusée avant l'exécution de l'outil, avec une `Input validation error`.

Erreurs courantes :
- `"No ThreadMind project in this workspace…"` — aucun projet pour l'instant
- `"No active project. Existing projects: … Use project_switch to select one."` — plusieurs projets, aucun sélectionné
- `"Thread \"x\" not found"` — le thread n'existe pas dans le projet
- `"Parent thread \"x\" not found"` — parent invalide lors de la création
- `"Cannot delete the main thread"`, `"Cannot rebase the main thread"`, `"The main thread cannot be closed"`
- `"\"x\" is a descendant of \"y\""` — référence circulaire détectée lors du rebase
- `"Cannot update thread \"x\": owned by \"y\""` — violation de propriété en mode équipe
- `"... its descendants include threads owned by others"` — suppression en mode équipe qui entraînerait en cascade des threads d'un collègue
