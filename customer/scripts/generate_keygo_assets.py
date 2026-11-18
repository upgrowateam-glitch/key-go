"""Generate KeyGo app icon, splash, adaptive icon and favicon PNGs.

The mark mirrors src/components/ui/KeyGoLogo.tsx (100x100 viewBox):
a key bow + shaft + tooth whose tip is a forward chevron ("Go").
"""
import os
from PIL import Image, ImageDraw

KEY_TOP = (255, 201, 51)      # yellow highlight #FFBA00 (light end)
KEY_BOTTOM = (240, 168, 0)
TILE_TOP = (22, 77, 61)       # deep green #0C3B2E (lighter top)
TILE_BOTTOM = (12, 59, 46)
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
SS = 4  # supersampling factor


def vgradient(size, top, bottom):
    grad = Image.new("RGBA", (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        grad.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return grad.resize((size, size))


def mark_mask(size, scale=1.0):
    """Return an L-mode mask of the key mark. `scale` shrinks it around the centre."""
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    u = big / 100.0 * scale
    o = big / 2 - 50 * u  # offset so the mark stays centred when scaled

    def P(x, y):
        return (o + x * u, o + y * u)

    sw = 9 * u
    # Bow (ring)
    cx, cy, r = 33, 50, 14
    d.ellipse([P(cx - r - 4.5, cy - r - 4.5), P(cx + r + 4.5, cy + r + 4.5)], fill=255)
    d.ellipse([P(cx - r + 4.5, cy - r + 4.5), P(cx + r - 4.5, cy + r - 4.5)], fill=0)
    # Shaft
    d.rectangle([P(46, 45.5), P(79, 54.5)], fill=255)
    # Tooth
    d.rounded_rectangle([P(52, 50), P(59.5, 64)], radius=2 * u, fill=255)
    # Chevron tip (round caps / joins)
    pts = [P(67, 36), P(81, 50), P(67, 64)]
    d.line(pts, fill=255, width=int(sw), joint="curve")
    for p in (pts[0], pts[1], pts[2]):
        d.ellipse([p[0] - sw / 2, p[1] - sw / 2, p[0] + sw / 2, p[1] + sw / 2], fill=255)
    return m.resize((size, size), Image.Resampling.LANCZOS)


GREEN = (12, 59, 46)


def render(size, background=True, scale=1.0, mono=False, solid=None):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if background:
        bg = vgradient(size, TILE_TOP, TILE_BOTTOM)
        img.paste(bg, (0, 0))
    if solid:
        fill = Image.new("RGBA", (size, size), solid + (255,))
    elif mono:
        fill = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    else:
        fill = vgradient(size, KEY_TOP, KEY_BOTTOM)
    img.paste(fill, (0, 0), mark_mask(size, scale))
    return img


if __name__ == "__main__":
    out = lambda n: os.path.join(ASSETS, n)
    render(1024, scale=0.78).save(out("icon.png"))
    # Splash sits on the pale page color, so the key is drawn in the primary green
    render(1024, background=False, scale=0.9, solid=GREEN).save(out("splash-icon.png"))
    # Adaptive icon: keep the mark inside the ~66% safe zone.
    render(1024, background=False, scale=0.55).save(out("android-icon-foreground.png"))
    render(1024, background=False, scale=0.55, mono=True).save(out("android-icon-monochrome.png"))
    Image.new("RGBA", (1024, 1024), TILE_BOTTOM + (255,)).save(out("android-icon-background.png"))
    render(256, scale=0.82).resize((64, 64), Image.Resampling.LANCZOS).save(out("favicon.png"))
    print("KeyGo assets written to", os.path.abspath(ASSETS))
