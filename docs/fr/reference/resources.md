# Référence des ressources

ThreadMind expose 2 ressources MCP et 1 modèle de ressource (template). Les ressources fournissent des données en lecture seule que les clients MCP peuvent afficher ou injecter.

## `threadmind://context`

**Nom :** `current-context`

**Type MIME :** `text/markdown`

**Description :** Le contexte assemblé pour le thread actif, identique à la sortie de l'outil `context_get`.

### Format de réponse

Retourne un document Markdown avec des sections séparées par `---` :

```markdown
## Contexte système

Votre prompt système ici...

---

## Thread : Thread racine

Contenu du résumé racine...

---

## Thread : Thread enfant (actif)

Résumé du thread actif...
```

### Sans projet actif

Retourne un message texte :
```
No active project or thread. Use project_create first.
```

### Utilisation

Les clients MCP qui supportent les ressources peuvent :
- Afficher le contenu dans un panneau
- L'injecter dans le contexte de conversation

---

## `threadmind://tree`

**Nom :** `thread-tree`

**Type MIME :** `text/plain`

**Description :** Visualisation ASCII de l'arborescence des threads pour le projet actif.

### Format de réponse

```
main
├── auth
│   ├── auth-ui ← actif
│   └── auth-api
├── database
│   └── migrations
└── deploiement
```

### Sans projet actif

Retourne :
```
No active project. Use project_create first.
```

---

## `threadmind://thread/{threadId}`

**Nom :** `thread` (modèle de ressource)

**Type MIME :** `text/markdown`

**Description :** Le résumé d'un thread du projet actif, sans ses ancêtres.

Chaque thread du projet actif est listé comme ressource (nommée par son ID, titrée par le titre du thread), et la variable `threadId` propose l'autocomplétion. Dans Claude Code, tapez `@` pour en mentionner un et ajouter le résumé d'un thread voisin à la conversation sans changer de thread.

### Format de réponse

```markdown
# Endpoints de l'API d'authentification

_Thread `auth-api` · parent: auth · author: sarah-7b2c · updated: 2026-04-15T12:30:00Z_

POST /auth/login, POST /auth/register, POST /auth/refresh...
```

Lire un thread absent de l'arbre du projet actif renvoie une erreur.

---

## Mises à jour des ressources

Les ressources reflètent l'**état actuel** au moment de la lecture. ThreadMind envoie `notifications/resources/list_changed` quand la liste des ressources de threads change (`project_create`, `project_switch`, `thread_create`, `thread_delete`). Il ne gère pas les abonnements : les clients relisent une ressource pour obtenir son contenu actuel.
