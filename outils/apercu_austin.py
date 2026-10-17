"""Aperçu d'Austin (lit austinDog.json) : 2 images de course, grand + taille réelle.

Usage : uv run --no-project --with pillow apercu_austin.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOG = json.loads(
    (ROOT / "app/frontend/src/constants/austinDog.json").read_text(encoding="utf-8")
)
OUT = ROOT / "outils" / "apercu-austin.png"

pal = DOG["palette"]
frames = DOG["frames"]


def render(frame: list[str], px: int, mirror: bool = False) -> Image.Image:
    w, h = max(len(r) for r in frame), len(frame)
    im = Image.new("RGBA", (w * px, h * px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y, row in enumerate(frame):
        for x, ch in enumerate(row):
            if ch == "." or ch not in pal:
                continue
            xx = (w - 1 - x) if mirror else x
            d.rectangle([xx * px, y * px, xx * px + px - 1, y * px + px - 1], fill=pal[ch])
    return im


big = 16
canvas = Image.new("RGB", (1100, 560), "#2A2725")
d = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("consolab.ttf", 26)
    small = ImageFont.truetype("consola.ttf", 18)
except OSError:
    font = small = ImageFont.load_default()

d.text((550, 20), "Austin — berger australien x berger américain (blanc & marron)", fill="#F3F1EC", font=font, anchor="mt")
d.text((550, 56), "yeux vairons : gauche gris, droit bleu · collier orange Nasap3D", fill="#FF5A3C", font=small, anchor="mt")
for i, f in enumerate(frames):
    im = render(f, big)
    canvas.paste(im, (60 + i * 520, 100), im)
    d.text((60 + i * 520 + im.width // 2, 100 + im.height + 10), f"course {i + 1}/2", fill="#85827D", font=small, anchor="mt")

# taille réelle dans la salle (x2 pour que ce soit visible), à côté d'un agent
real = DOG["pixel"] * 2
y0 = 470
d.text((60, y0 - 40), "taille réelle dans la salle (zoom x2) :", fill="#A29F99", font=small)
for i, (f, m) in enumerate([(frames[0], False), (frames[1], False), (frames[0], True)]):
    im = render(f, real, m)
    canvas.paste(im, (420 + i * 90, y0 - im.height // 2), im)
# capsule agent à la même échelle pour comparer (48x80 px game -> x2)
d.rounded_rectangle([940, y0 - 120, 940 + 96, y0 + 40], radius=48, fill="#F5C518", outline="#FFFFFF", width=8)
d.text((988, y0 + 50), "un employé", fill="#A29F99", font=small, anchor="mt")

canvas.save(OUT)
print(OUT)
