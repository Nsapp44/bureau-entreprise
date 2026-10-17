# Bureau entreprise

Un bureau pixel art qui montre en direct tes sessions Claude Code et Claude (appli desktop) : chaque conversation a son poste de travail, ses agents, ses tokens, ses pauses café. Tout tourne **en local** (http://localhost:8000, 127.0.0.1 uniquement), sans IA ni jeton consommé.

> Fork personnalisé de [Claude Office Visualizer](https://github.com/paulrobello/claude-office) (v0.24.1) de Paul Robello, licence MIT. Voir `LICENSE`.

## Ce qu'il y a en plus de l'original

- **Vue « Conversations »** : une scène fixe (1920×1164) avec un bureau par conversation, l'ascenseur, la cafetière, les salles atelier / impression 3D.
- **Cafés** : un agent qui attend plus de 5 min va chercher un café ; compteur global et badge `xN` par conversation.
- **Tokens et conso du jour**, ligne OpenAI affichée seulement si OpenAI est connecté.
- **Sauvegardes automatiques** de l'historique (3 dernières gardées).
- **Scripts Windows** : lancer / arrêter / désinstaller / faire un paquet portable (`outils/`).

## Installation (Windows)

Prérequis : Python 3.12+, Node 20+ (pour reconstruire l'interface), [uv](https://docs.astral.sh/uv/).

```powershell
# 1. Dépendances backend
cd app\backend ; uv sync        # ou : python -m venv .venv ; .venv\Scripts\pip install -e .

# 2. Interface (export statique servi par le backend)
cd ..\frontend ; npm install ; npm run build
Copy-Item out ..\backend\static -Recurse

# 3. Hooks Claude Code (outil claude-office-hook + entrées dans ~/.claude/settings.json)
cd ..\.. 
uv tool install .\app\hooks
python app\hooks\manage_hooks.py install --hook-cmd claude-office-hook

# 4. Lancer
powershell -File outils\demarrer.ps1     # ouvre http://localhost:8000
```

Arrêter : `outils\arreter.ps1`. Tout retirer : `outils\desinstaller.ps1` (retire les hooks et l'outil).
Pour un autre système que Windows, voir `app/README.md` (Make, tmux, Docker).

## Le personnaliser

| Je veux changer… | Où |
|---|---|
| Mon nom sur le tableau « Employé du mois » | `app/frontend/src/components/game/EmployeeOfTheMonth.tsx` (texte `YOUR NAME`) |
| Le logo / l'icône | `assets/logo.png`, `assets/logo.ico` (régénérer avec `outils/make_logo.py`) |
| Le décor et les personnages | `outils/make_decor.py`, scripts d'aperçu `outils/apercu_*.py` |
| Les salles (atelier, impression 3D, casiers…) | `app/frontend/src/components/conversations/` (`WorkshopRooms.tsx`, `ConversationsScene.tsx`) |
| Le délai avant un café (5 min) et le nombre max de pauses | `app/frontend/src/components/conversations/coffeeTrips.ts` (`COFFEE_WAIT_MS`) et `useCoffeeBreaks.ts` |
| Les plaques de bureau, couleurs, badges | `ConversationSeat.tsx` |
| Le port et l'adresse | `outils/demarrer.ps1` (127.0.0.1:8000) |
| Les réglages du backend (IA désactivée par défaut) | copier `app/.env.example` en `app/backend/.env` |

Après toute modification de l'interface : `npm run build` dans `app/frontend`, recopier `out` vers `app/backend/static`, relancer.

## Confidentialité

Rien ne quitte ta machine. Le backend écoute en 127.0.0.1, les hooks lisent seulement les événements de tes sessions. Ne publie jamais ton `.env`, tes `sauvegardes/` ni tes `logs/` (déjà dans `.gitignore`).

## Licence

MIT, copyright Paul Robello pour le code d'origine. Les ajouts de ce fork sont publiés sous la même licence.
