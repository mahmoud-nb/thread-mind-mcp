# Référence des outils

ThreadMind expose 11 outils MCP. Tous retournent des réponses textuelles structurées et utilisent `isError: true` en cas d'échec.

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
- Génère l'ID auteur (si premier projet)
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

---

### `thread_switch`

Bascule vers un autre thread.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `threadId` | `string` | Oui | ID du thread cible |

**Retourne :** Confirmation + aperçu du contexte (300 premiers caractères).

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

Génère des fichiers d'instructions pour les clients IA afin d'activer l'utilisation semi-automatique de ThreadMind.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `clients` | `string[]` | Non | Clients cibles : `"claude"`, `"cursor"`, `"generic"` (défaut : tous) |

**Retourne :** Confirmation avec la liste des fichiers générés.

**Fichiers générés :**

| Client | Fichier | Comportement |
|--------|---------|--------------|
| Claude Code | `CLAUDE.md` | Lu automatiquement à chaque démarrage de session |
| Cursor | `.cursorrules` | Lu automatiquement par Cursor |
| Générique | `.threadmind/instructions.md` | À copier-coller dans les instructions personnalisées de n'importe quel client |

Les instructions générées demandent à l'IA de :
- Appeler `context_get` au début de chaque session
- Appeler `summary_update` après chaque discussion significative
- Utiliser `thread_create` quand le sujet change
- Utiliser `thread_list` pour visualiser l'état actuel

---

## Prompts MCP

ThreadMind fournit également 2 Prompts MCP — des templates structurés que les clients peuvent invoquer.

### `start-thread`

Charge et injecte le contexte assemblé au début d'une session.

**Arguments :** Aucun

**Retourne :** Un message utilisateur contenant le contexte assemblé complet avec estimation des tokens.

**Cas d'usage :** Invoquez ce prompt au début d'une nouvelle conversation pour initialiser l'IA avec le contexte de votre arbre de threads.

### `summarize-thread`

Guide l'IA pour générer un résumé structuré du thread courant.

**Arguments :** Aucun

**Retourne :** Un message utilisateur avec des instructions pour que l'IA résume la discussion en cours, couvrant :
- Les décisions clés prises
- Les choix techniques et leur justification
- L'état actuel / ce qui est implémenté
- Les questions ouvertes ou prochaines étapes

**Cas d'usage :** Invoquez ce prompt après une discussion productive pour générer un résumé, puis utilisez `summary_update` pour le sauvegarder.

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

Erreurs courantes :
- `"No active project. Use project_create first."` — aucun projet sélectionné
- `"Thread \"x\" not found"` — ID de thread invalide
- `"Parent thread \"x\" not found"` — parent invalide lors de la création
- `"Cannot delete the main thread"` — tentative de suppression de la racine
- `"Cannot update thread \"x\": owned by \"y\""` — violation de propriété en mode équipe
