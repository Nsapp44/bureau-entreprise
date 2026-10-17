"""Génère les sprites du décor (pixel art) : bureau moderne, chaise style Secretlab Titan, palmier.

Dessin sur une petite grille puis agrandissement au plus proche à la taille exacte
des anciens PNG, pour que les échelles du code restent valables.
Usage : uv run --no-project --with pillow python make_decor.py [--apercu]
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SPRITES = Path(__file__).resolve().parent.parent / "app" / "frontend" / "public" / "sprites"
OUTLINE = (12, 12, 15, 255)
ORANGE = (255, 106, 19, 255)
ORANGE_D = (196, 72, 8, 255)


def hexc(h: str, a: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def outline(img: Image.Image, color=OUTLINE) -> Image.Image:
    """Contour 1 px autour des pixels opaques (style des sprites existants)."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] and src[nx, ny] != color:
                    dst[x, y] = color
                    break
    return out


def px(d: ImageDraw.ImageDraw, x0, y0, x1, y1, c) -> None:
    """Rectangle inclusif."""
    d.rectangle([x0, y0, x1, y1], fill=c)


# ---------------------------------------------------------------- bureau
def desk() -> Image.Image:
    W, H = 70, 37
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    top, top_hi, lip, panel, panel_d = (hexc("#2E333B"), hexc("#3C424C"), hexc("#1D2026"),
                                        hexc("#23272E"), hexc("#1A1D22"))
    metal, metal_hi, metal_d = hexc("#8C939E"), hexc("#C3CAD3"), hexc("#5C626B")
    # Pieds (derrière le panneau) : cadre métal en T
    for lx in (3, 63):
        px(d, lx, 14, lx + 3, 34, metal)
        px(d, lx, 14, lx, 34, metal_hi)
        px(d, lx + 3, 14, lx + 3, 34, metal_d)
        px(d, lx - 2, 35, lx + 5, 36, metal_d)
        px(d, lx - 2, 35, lx + 5, 35, metal)
    # Panneau de modestie (maille)
    px(d, 7, 14, 62, 27, panel)
    for y in range(16, 27, 3):
        for x in range(9 + (y % 2) * 2, 61, 4):
            px(d, x, y, x + 1, y, panel_d)
    # Caisson à tiroirs à droite
    px(d, 47, 14, 61, 31, hexc("#2A2E35"))
    for y0 in (16, 21, 26):
        px(d, 48, y0, 60, y0 + 3, hexc("#343943"))
        px(d, 52, y0 + 1, 56, y0 + 1, ORANGE)
    px(d, 48, 31, 49, 32, OUTLINE)
    px(d, 59, 31, 60, 32, OUTLINE)
    # Plateau en perspective (trapèze)
    for y in range(0, 11):
        inset = round(3 * (10 - y) / 10)
        px(d, inset, y, W - 1 - inset, y, top)
    for y in range(1, 10, 3):  # reflets du plateau
        px(d, 10 + y * 2, y, 22 + y * 2, y, top_hi)
    px(d, 3, 0, W - 4, 0, top_hi)
    # Chant avant + liseré orange
    px(d, 0, 11, W - 1, 13, lip)
    px(d, 0, 12, W - 1, 12, ORANGE)
    px(d, 0, 13, W - 1, 13, ORANGE_D)
    # Passe-câble
    px(d, 33, 3, 36, 4, hexc("#15171B"))
    return outline(im)


# ---------------------------------------------------------------- chaise
def chair() -> Image.Image:
    """Style Secretlab Titan : tissu gris clair chiné, flancs et accoudoirs noirs, logo T."""
    W, H = 32, 51
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    grey, grey_hi, grey_d = hexc("#C9CBCE"), hexc("#DDDFE1"), hexc("#A9ACB1")
    black, black_hi = hexc("#1B1C20"), hexc("#34363C")
    metal, metal_d = hexc("#2A2C31"), hexc("#16171A")
    # Dossier : silhouette (demi-largeur par ligne), épaules arrondies
    shape = {}
    for y in range(0, 31):
        if y < 3:
            half = 7 + y
        elif y < 10:
            half = 10
        elif y < 16:
            half = 11
        elif y < 23:
            half = 11 - (y - 16) // 3
        else:
            half = 9
        shape[y] = half
        px(d, 16 - half, y, 15 + half, y, black)
    # Panneau central en tissu gris chiné, flancs noirs de 2 px
    for y in range(1, 30):
        half = max(4, shape[y] - 2)
        px(d, 16 - half, y, 15 + half, y, grey)
        px(d, 16 - half, y, 16 - half, y, grey_hi)
        px(d, 15 + half, y, 15 + half, y, grey_d)
        px(d, 16 - shape[y], y, 16 - shape[y], y, black_hi)
    for y in range(2, 30, 3):  # grain du tissu
        for x in range(9 + (y % 2) * 2, 23, 5):
            px(d, x, y, x, y, grey_d)
    # Coussin de tête intégré (couture) + petit logo en haut
    px(d, 9, 8, 22, 8, grey_d)
    px(d, 14, 3, 17, 4, black)
    px(d, 15, 5, 16, 5, black)
    # Logo T au centre
    px(d, 13, 13, 18, 13, black)
    px(d, 15, 14, 16, 19, black)
    # Couture lombaire
    px(d, 10, 23, 21, 23, grey_d)
    # Accoudoirs noirs 4D
    for x0 in (0, 28):
        px(d, x0, 24, x0 + 3, 25, black)
        px(d, x0, 24, x0 + 3, 24, black_hi)
        px(d, x0 + 1, 26, x0 + 2, 33, metal)
    # Assise grise à passepoil noir
    px(d, 4, 29, 27, 34, grey)
    px(d, 5, 29, 26, 29, grey_hi)
    px(d, 4, 33, 27, 34, black)
    # Vérin et piétement étoile noirs
    px(d, 15, 35, 16, 40, metal)
    px(d, 14, 35, 17, 36, black)
    px(d, 5, 41, 26, 42, metal)
    px(d, 5, 42, 26, 42, metal_d)
    for x0, x1 in ((3, 8), (23, 28)):
        px(d, x0, 43, x1, 43, metal_d)
    px(d, 13, 43, 18, 44, metal)
    # Roulettes
    for x0 in (2, 14, 26):
        px(d, x0, 45, x0 + 3, 48, hexc("#141418"))
        px(d, x0 + 1, 46, x0 + 1, 46, hexc("#3A3C42"))
    return outline(im)


# ---------------------------------------------------------------- palmier
def palm() -> Image.Image:
    W, H = 56, 84
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    trunk, trunk_d, trunk_hi = hexc("#8A5A32"), hexc("#5E3B1E"), hexc("#B07A45")
    greens = [hexc("#1D6B34"), hexc("#2E8B45"), hexc("#4DB35C"), hexc("#7AD47A")]
    crown = (27, 22)
    # Tronc courbé, segmenté
    pts = []
    for i in range(46):
        t = i / 45
        x = 30 - 5 * math.sin(t * math.pi * 0.9) + 2 * t
        y = 68 - t * 46
        pts.append((x, y))
    for i, (x, y) in enumerate(pts):
        wdt = 3 + (1 if i < 20 else 0)
        c = trunk_d if i % 4 == 0 else trunk
        px(d, round(x - wdt / 2), round(y), round(x + wdt / 2), round(y), c)
        if i % 4 != 0:
            px(d, round(x - wdt / 2), round(y), round(x - wdt / 2), round(y), trunk_hi)
    # Feuilles (palmes) : courbes de Bézier + folioles
    fronds = [(-27, 16, 0), (-24, -2, 1), (-10, -16, 2), (9, -16, 1),
              (25, -2, 2), (27, 16, 0), (-16, 22, 1), (17, 22, 1)]
    for dx, dy, shade in fronds:
        x0, y0 = crown
        cx, cy = x0 + dx * 0.5, y0 - 14 + min(dy, 0)
        x1, y1 = x0 + dx, y0 + dy
        prev = None
        for i in range(0, 41):
            t = i / 40
            bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1
            by = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1
            if prev:
                d.line([prev, (bx, by)], fill=greens[shade], width=2 if t < 0.6 else 1)
            # folioles qui retombent
            if i % 4 == 0 and 0.12 < t < 0.95:
                ln = 4 * math.sin(t * math.pi) + 1
                ang = math.atan2(by - (prev[1] if prev else by), bx - (prev[0] if prev else bx))
                for side in (-1, 1):
                    a = ang + side * 1.2
                    ex, ey = bx + math.cos(a) * ln, by + abs(math.sin(a)) * ln + 2
                    d.line([(bx, by), (ex, ey)], fill=greens[min(3, shade + (side > 0))], width=1)
            prev = (bx, by)
    # Noix de coco
    for cx, cy in ((25, 24), (29, 25), (27, 27)):
        d.ellipse([cx - 2, cy - 2, cx + 1, cy + 1], fill=hexc("#5A3A1A"))
    # Pot moderne anthracite + bande orange
    px(d, 18, 68, 41, 70, hexc("#2C3038"))
    for y in range(71, 83):
        inset = (y - 71) // 4
        px(d, 19 + inset, y, 40 - inset, y, hexc("#23272E"))
        px(d, 19 + inset, y, 20 + inset, y, hexc("#353A44"))
    px(d, 19, 74, 40, 75, ORANGE)
    px(d, 19, 68, 40, 68, hexc("#3B2A1C"))
    return outline(im)


def save(img: Image.Image, name: str, size: tuple[int, int] | None, scale: int | None = None) -> None:
    if size is None:
        size = (img.width * scale, img.height * scale)
    img.resize(size, Image.NEAREST).save(SPRITES / name)
    print(f"{name}: {size[0]}x{size[1]}")


def main() -> None:
    items = [("desk.png", desk(), (1338, 704)), ("chair.png", chair(), (457, 727)),
             ("palm.png", palm(), None)]
    if "--apercu" in sys.argv:
        tiles = [img.resize((img.width * 6, img.height * 6), Image.NEAREST) for _, img, _ in items]
        sheet = Image.new("RGBA", (sum(t.width for t in tiles) + 40 * len(tiles), max(t.height for t in tiles) + 40),
                          (44, 40, 38, 255))
        x = 20
        for t in tiles:
            sheet.alpha_composite(t, (x, 20))
            x += t.width + 40
        out = Path(__file__).resolve().parent / "apercu-decor.png"
        sheet.save(out)
        print(out)
        return
    for name, img, size in items:
        save(img, name, size, scale=8)


if __name__ == "__main__":
    main()
