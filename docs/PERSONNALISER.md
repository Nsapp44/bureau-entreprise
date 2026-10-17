# Personnaliser

Après toute modif du front : `cd app\frontend ; npm run build ; Copy-Item out ..\backend\static -Recurse -Force`, puis relancer (`outils\arreter.ps1`, `outils\demarrer.ps1`).

| Je veux changer… | Où |
|---|---|
| Mon nom sur « Employé du mois » | `app/frontend/src/components/game/EmployeeOfTheMonth.tsx` (texte `YOUR NAME`) |
| Les prénoms des agents | `app/backend/app/config.py` (`AGENT_NAMES`) **et** les clés de `app/frontend/src/constants/agentPixelLooks.json` |
| Le look d'un agent | `agentPixelLooks.json`, `agentLooks.ts` |
| Le nom du chien / des chats | `constants/rexDog.json`, `constants/officeCats.json`, `OfficeDog.tsx` |
| Le logo | `assets/logo.png`, `assets/logo.ico` (régénérer : `python outils\make_logo.py`) |
| Le décor | `outils/make_decor.py`, aperçus : `outils/apercu_*.py` |
| Les salles (atelier, impression 3D…) | `app/frontend/src/components/conversations/WorkshopRooms.tsx`, `ConversationsScene.tsx` |
| Le délai avant un café | `conversations/coffeeTrips.ts` (`COFFEE_WAIT_MS`), `useCoffeeBreaks.ts` |
| Les plaques de bureau, badges | `ConversationSeat.tsx` |
| L'adresse et le port | `outils/demarrer.ps1` (le front suppose 8000) |
| Les réglages backend | copier `app/.env.example` en `app/backend/.env` |

## Faire une démo avec de fausses données

Pour des captures sans exposer de vraies conversations : démarrer un backend avec une base vide, puis envoyer des événements :

```powershell
$e = @{ event_type="session_start"; session_id="demo-1"; timestamp=(Get-Date).ToUniversalTime().ToString("o"); data=@{} } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/events -ContentType "application/json" -Body $e
```

Les titres viennent de `%APPDATA%\Claude\claude-code-sessions\<compte>\<org>\local_*.json` : pointer `APPDATA` vers un dossier factice contenant des fichiers `local_*.json` avec un champ `title` inventé.

## Captures

La page est un canvas : `canvas.toDataURL('image/png')` exécuté dans la console, puis `fetch` en POST vers un petit serveur local qui écrit le PNG dans `docs/screens/`. Attendre deux `requestAnimationFrame` avant l'export (sinon l'image est noire).
