"""Planche d'aperçu des looks pixel art (lit agentPixelLooks.json).

Usage : uv run --no-project --with pillow apercu_persos.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOOKS = json.loads(
    (ROOT / "app/frontend/src/constants/agentPixelLooks.json").read_text(encoding="utf-8")
)
OUT = ROOT / "outils" / "apercu-persos.png"

S = 4  # zoom
CELL_W, CELL_H = 110, 150  # in game px
ORIGIN = (55, 112)  # agent origin inside a cell (game px)
names = [k for k in LOOKS if not k.startswith("_")]

img = Image.new("RGB", (CELL_W * 4 * S, CELL_H * 2 * S), "#2A2725")
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("consolab.ttf", 13 * S // 2)
    small = ImageFont.truetype("consola.ttf", 9 * S // 2)
except OSError:
    font = small = ImageFont.load_default()


def rect(ox: int, oy: int, x: float, y: float, w: float, h: float, color: str) -> None:
    d.rectangle(
        [(ox + x) * S, (oy + y) * S, (ox + x + w) * S - 1, (oy + y + h) * S - 1], fill=color
    )


for i, key in enumerate(names):
    look = LOOKS[key]
    cx, cy = (i % 4) * CELL_W, (i // 4) * CELL_H
    ox, oy = cx + ORIGIN[0], cy + ORIGIN[1]
    # floor tile hint
    d.rectangle([cx * S, cy * S, (cx + CELL_W) * S - 1, (cy + CELL_H) * S - 1], outline="#1A1917", width=S)
    if look.get("orbit"):
        d.ellipse([(ox - 34) * S, (oy - 34) * S, (ox + 34) * S, (oy - 6) * S], outline=look["orbit"], width=2 * S)
        rect(ox, oy, 30, -24, 6, 6, "#FFFFFF")
    # capsule body (48x80, white 4px stroke), origin = bottom circle centre
    d.rounded_rectangle(
        [(ox - 24) * S, (oy - 58) * S, (ox + 24) * S, (oy + 22) * S],
        radius=24 * S, fill=look["body"], outline="#FFFFFF", width=4 * S,
    )
    if look.get("glasses"):
        rect(ox, oy, -18, -42, 36, 8, "#111111")
        rect(ox, oy, -14, -41, 6, 2, "#555555")
        rect(ox, oy, 6, -41, 6, 2, "#555555")
    for x, y, w, h, color in look["rects"]:
        rect(ox, oy, x, y, w, h, color)
    label = key.capitalize().replace("Emma", "Emma")
    d.text(((cx + CELL_W / 2) * S, (cy + 8) * S), label, fill="#F3F1EC", font=font, anchor="mt")
    d.text(((cx + CELL_W / 2) * S, (cy + 22) * S), look["theme"], fill="#FF5A3C", font=small, anchor="mt")
    if look.get("headset"):
        d.text(((cx + CELL_W / 2) * S, (cy + CELL_H - 8) * S), "+ casque au bureau", fill="#85827D", font=small, anchor="mb")

img.save(OUT)
print(OUT)
