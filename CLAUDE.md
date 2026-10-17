# CLAUDE.md — Bureau entreprise

Visualiseur pixel art local de sessions Claude Code (fork de Claude Office v0.24.1, MIT). Backend FastAPI + front Next.js/PixiJS servi en statique sur **http://localhost:8000** (127.0.0.1 uniquement). Aucun jeton IA consommé.

Humains : lire `README.md`. Ce fichier est pour toi, Claude : installer, lancer, personnaliser sans casser.

## Carte des fichiers

| Besoin | Fichier |
|---|---|
| Backend (API, WebSocket, état des agents) | `app/backend/app/` (`main.py`, `config.py`, `core/`) |
| Noms des agents (liste par défaut) | `app/backend/app/config.py` (`AGENT_NAMES`) |
| Noms + apparence des personnages | `app/frontend/src/constants/agentPixelLooks.json`, `agentLooks.ts` |
| Vue « Conversations » (scène 1920×1164) | `app/frontend/src/components/conversations/` |
| Vue « Bureau » (1280×1024) | `app/frontend/src/components/game/` |
| Chien / chats | `OfficeDog.tsx`, `dogBehavior.ts`, `constants/rexDog.json`, `officeCats.json` |
| Cafés (délai, max) | `conversations/coffeeTrips.ts` (`COFFEE_WAIT_MS`), `useCoffeeBreaks.ts` |
| Nom sur le tableau « Employé du mois » | `game/EmployeeOfTheMonth.tsx` (`YOUR NAME`) |
| Scripts Windows | `outils/*.ps1` ; décor/logo : `outils/make_*.py` |
| Hooks Claude Code | `app/hooks/` (`manage_hooks.py install`) |

## Commandes (Windows, depuis la racine du dépôt)

```powershell
cd app\backend ; uv sync                         # ou python -m venv .venv ; .venv\Scripts\pip install -e .
cd ..\frontend ; npm install ; npm run build     # produit app\frontend\out
Copy-Item out ..\backend\static -Recurse         # le backend sert ce dossier
cd ..\.. ; uv tool install .\app\hooks
python app\hooks\manage_hooks.py install --hook-cmd claude-office-hook
powershell -File outils\demarrer.ps1             # lance + ouvre la page
```

Tests : `cd app\frontend ; npx tsc --noEmit ; npx vitest run` — `cd app\backend ; .venv\Scripts\python.exe -m pytest`.
Arrêt : `outils\arreter.ps1`. Retrait total : `outils\desinstaller.ps1`.

## Pièges connus

- **Le front attend le backend sur le port 8000** (API et WebSocket codés en dur). Un autre port = page vide. Ne pas lancer `next dev` sur 3000 seul.
- Après toute modif du front : `npm run build` **puis recopier `out` → `app/backend/static`**, sinon l'ancienne version est servie.
- Le backend doit tourner **depuis ce dépôt** : si un autre `app` est installé dans le venv, vérifier `app.main.__file__` (sinon on sert une autre copie).
- Build Turbopack : un `node_modules` en jonction/lien symbolique est refusé → vraie copie.
- Les titres de conversation viennent de `%APPDATA%\Claude\claude-code-sessions\<compte>\<org>\local_*.json` (appli desktop). Sans elle, le nom du dossier du projet sert de titre.
- Thème sombre de Windows : fixer soi-même fond **et** texte dans toute nouvelle UI.
- Les agents sont purement visuels : nommer = changer la liste, pas de logique liée aux prénoms.

## Données fictives (démo, captures)

Envoyer des événements à `POST http://127.0.0.1:8000/api/v1/events` : `{"event_type", "session_id", "timestamp", "data"}`. Voir `docs/PERSONNALISER.md` pour un exemple. Ne jamais faire de capture avec de vraies conversations.

## Règles

- Ne pas committer `.env`, `logs/`, `sauvegardes/`, `node_modules`, `app/backend/static`.
- Avant un push : scanner pour les noms/chemins personnels. Push normal, pas de `--force` sans l'accord du propriétaire.
- Garder les changements minimaux ; ne pas renommer les modules upstream sans raison.

Plus de détails : `docs/ARCHITECTURE.md`, `docs/PERSONNALISER.md`, `docs/DEPANNAGE.md`.
