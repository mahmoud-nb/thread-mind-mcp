# R\u00e9f\u00e9rence des ressources

ThreadMind expose 2 ressources MCP. Les ressources fournissent des donn\u00e9es en lecture seule que les clients MCP peuvent afficher ou injecter.

## `threadmind://context`

**Nom :** `current-context`

**Type MIME :** `text/markdown`

**Description :** Le contexte assembl\u00e9 pour le thread actif, identique \u00e0 la sortie de l'outil `context_get`.

### Format de r\u00e9ponse

Retourne un document Markdown avec des sections s\u00e9par\u00e9es par `---` :

```markdown
## Contexte syst\u00e8me

Votre prompt syst\u00e8me ici...

---

## Thread : Thread racine

Contenu du r\u00e9sum\u00e9 racine...

---

## Thread : Thread enfant (actif)

R\u00e9sum\u00e9 du thread actif...
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
- S'abonner aux mises \u00e0 jour (ThreadMind envoie `notifications/resources/updated` apr\u00e8s chaque mutation)

---

## `threadmind://tree`

**Nom :** `thread-tree`

**Type MIME :** `text/plain`

**Description :** Visualisation ASCII de l'arborescence des threads pour le projet actif.

### Format de r\u00e9ponse

```
main
\u251c\u2500\u2500 auth
\u2502   \u251c\u2500\u2500 auth-ui \u2190 actif
\u2502   \u2514\u2500\u2500 auth-api
\u251c\u2500\u2500 database
\u2502   \u2514\u2500\u2500 migrations
\u2514\u2500\u2500 deploiement
```

### Sans projet actif

Retourne :
```
No active project. Use project_create first.
```

---

## Mises \u00e0 jour des ressources

Les deux ressources refl\u00e8tent l'**\u00e9tat actuel** au moment de la lecture. Apr\u00e8s tout outil de mutation (`project_create`, `thread_create`, `thread_switch`, `summary_update`, `thread_delete`), le contenu des ressources change.

Les clients MCP qui s'abonnent aux notifications de ressources seront inform\u00e9s automatiquement des mises \u00e0 jour.
