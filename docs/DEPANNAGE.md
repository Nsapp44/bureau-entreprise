# Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page vide / « déconnecté » | Backend arrêté, ou lancé sur un autre port | `outils\demarrer.ps1` ; le front attend le port **8000** |
| Ancienne interface après une modif | `out` pas recopié | `npm run build` puis `Copy-Item out ..\backend\static -Recurse`, relancer |
| Aucune conversation n'apparaît | Hooks non installés ou session déjà ouverte avant l'installation | `python app\hooks\manage_hooks.py install --hook-cmd claude-office-hook`, relancer la session Claude |
| Titres = noms de dossiers | Pas de fichiers de l'appli desktop | Normal avec Claude Code seul en terminal |
| `npm run build` : « Symlink … points out of the filesystem root » | `node_modules` est une jonction | Faire une vraie copie du dossier |
| Autre version servie que celle du dépôt | Un paquet `app` d'une autre copie est installé dans le venv | Lancer depuis `app\backend` avec `PYTHONPATH=.` et vérifier `python -c "import app.main;print(app.main.__file__)"` |
| `uv` cassé | Environnement local | `.venv\Scripts\python.exe -m pytest` |
| Texte illisible en thème sombre Windows | Couleurs système héritées | Fixer fond et texte explicitement |
| Pas de ligne OpenAI | OpenAI non connecté (voulu) | S'affiche seulement si OpenAI est connecté |

Logs des hooks : `~/.claude/claude-office-hooks.log` (activer avec `CLAUDE_OFFICE_DEBUG=1`).
