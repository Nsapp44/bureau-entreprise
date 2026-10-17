"""Generate the "Bureau entreprise" logo (PNG + multi-size ICO).

Style inspired by nasap3d.com: near-black background, low-poly mesh,
orange accent (#FF5A3C), cream (#F3F1EC). Pixel-art desk like the app.
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets"
OUT.mkdir(exist_ok=True)

S = 512
BG = (14, 13, 12, 255)
BG2 = (26, 25, 23, 255)
ORANGE = (255, 90, 60, 255)
ORANGE_D = (196, 62, 38, 255)
CREAM = (243, 241, 236, 255)
GREY = (90, 86, 80, 255)
SCREEN = (22, 21, 20, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
radius = 104
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=BG)

# Low-poly mesh (jittered grid triangulated)
random.seed(3)
mesh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
md = ImageDraw.Draw(mesh)
step = 96
pts = {}
for gx in range(-1, S // step + 2):
    for gy in range(-1, S // step + 2):
        pts[(gx, gy)] = (gx * step + random.randint(-30, 30), gy * step + random.randint(-30, 30))
for (gx, gy), p in pts.items():
    for q in ((gx + 1, gy), (gx, gy + 1), (gx + 1, gy + 1)):
        if q in pts:
            md.line([p, pts[q]], fill=(255, 255, 255, 34), width=2)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
img.paste(mesh, (0, 0), Image.composite(mesh, Image.new("RGBA", (S, S)), mask))

# Pixel-art scene on a 32x32 grid, scaled x12, centred
P = 12
G = 32
art = Image.new("RGBA", (G, G), (0, 0, 0, 0))
a = ImageDraw.Draw(art)


def px(x0, y0, x1, y1, c):
    a.rectangle([x0, y0, x1, y1], fill=c)


# Monitor
px(8, 5, 23, 15, CREAM)
px(9, 6, 22, 14, SCREEN)
px(10, 8, 17, 8, ORANGE)
px(10, 10, 20, 10, GREY)
px(10, 12, 15, 12, GREY)
px(19, 12, 20, 13, ORANGE)  # cursor
px(15, 16, 16, 17, CREAM)
px(12, 18, 19, 18, CREAM)
# Desk
px(3, 19, 28, 21, ORANGE)
px(3, 22, 28, 22, ORANGE_D)
px(5, 23, 6, 29, ORANGE_D)
px(25, 23, 26, 29, ORANGE_D)
# Coffee mug
px(23, 16, 25, 18, CREAM)
px(26, 17, 26, 17, CREAM)
# Status dot (like the app's "working" indicator)
px(26, 4, 28, 6, ORANGE)

art = art.resize((G * P, G * P), Image.NEAREST)
off = (S - G * P) // 2
img.alpha_composite(art, (off, off + 10))

img.save(OUT / "logo.png")
img.save(OUT / "logo.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ok", OUT)
