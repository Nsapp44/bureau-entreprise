# Architecture

```
Claude Code / appli Claude
        │ (hooks : prompt, outils, sous-agents, fin de session)
        ▼
claude-office-hook  ──POST──▶  FastAPI  :8000  ──WebSocket──▶  Navigateur (PixiJS)
                                │  /api/v1/events                    ├─ vue « Bureau » (1 session)
                                │  état des agents + historique      └─ vue « Conversations » (toutes)
                                ▼
                            SQLite (+ 3 sauvegardes auto)
```

## Les morceaux

- **Hooks** (`app/hooks`) : petit outil `claude-office-hook` installé dans `~/.claude/settings.json` ; il envoie chaque événement à `http://127.0.0.1:8000/api/v1/events`. Aucun appel réseau externe.
- **Backend** (`app/backend/app`) : reçoit les événements, tient la machine à états de chaque agent (arrive, travaille, attend, termine), pousse les changements en WebSocket. Il sert aussi le front en statique (`SERVE_STATIC=1`, dossier `app/backend/static`).
- **Front** (`app/frontend`) : Next.js en export statique, dessin avec PixiJS. Deux vues : « Bureau » (une session, 1280×1024) et « Conversations » (une scène fixe 1920×1164, un bureau par conversation, salles atelier).
- **Titres de conversation** : lus dans les fichiers de l'appli desktop (`%APPDATA%\Claude\claude-code-sessions\...\local_*.json`).
- **Scripts Windows** (`outils/`) : démarrer, arrêter, désinstaller, faire un paquet portable ; générateurs de décor et de logo.

## Ce qui est en plus de l'original

Vue Conversations, cafés (attente > 5 min), compteurs de tokens et conso du jour, ligne OpenAI conditionnelle, chien et chats, sauvegardes automatiques, scripts Windows.

## Principes

- Tout reste local (127.0.0.1).
- Le front code en dur le backend sur le port 8000.
- Les agents sont décoratifs : leur prénom vient de `AGENT_NAMES` / `agentPixelLooks.json`.
