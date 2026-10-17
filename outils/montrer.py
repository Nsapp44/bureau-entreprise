"""Déclencheur « Claude veut te montrer quelque chose » (Boss agité + toast).

Usage : python montrer.py SESSION_ID "Maquette à valider"
Envoie une notification de type « attention » au backend ; l'état se réinitialise
au prochain message de l'utilisateur (UserPromptSubmit).
"""
import json
import sys
import urllib.request
from datetime import UTC, datetime

session_id = sys.argv[1]
message = sys.argv[2] if len(sys.argv) > 2 else "Besoin de toi"
payload = {
    "event_type": "notification",
    "session_id": session_id,
    "timestamp": datetime.now(UTC).isoformat(),
    "data": {"notification_type": "attention", "message": message},
}
req = urllib.request.Request(
    "http://localhost:8000/api/v1/events",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
)
print(urllib.request.urlopen(req, timeout=5).status)
