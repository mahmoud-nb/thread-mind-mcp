# Référence des ressources

ThreadMind expose 2 ressources MCP. Les ressources fournissent des données en lecture seule que les clients MCP peuvent afficher ou injecter.

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
- L'injecter automatiquement dans le contexte de conversation
- S'abonner aux mises à jour (ThreadMind envoie `notifications/resources/updated` après chaque mutation)

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

## Mises à jour des ressources

Les deux ressources reflètent l'**état actuel** au moment de la lecture. Après tout outil de mutation (`project_create`, `thread_create`, `thread_switch`, `summary_update`, `thread_delete`), le contenu des ressources change.

Les clients MCP qui s'abonnent aux notifications de ressources seront informés automatiquement des mises à jour.
