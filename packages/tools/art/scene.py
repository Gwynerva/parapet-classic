"""Drawing the bosses' little worlds: pieces of scenery as pixel art on palette characters, lit
from the upper left (the sun's side), far things hazy, near things outlined."""
import math
import random
from lookgen import Canvas


def rng(seed):
    return random.Random(seed)


def blob(c, cx, cy, rx, ry, ch):
    """A filled ellipse."""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                c.set(x, y, ch)
    return c


def lit_blob(c, cx, cy, rx, ry, light, mid, dark):
    """An ellipse lit from the upper left: a light crescent, a dark lower right."""
    blob(c, cx, cy, rx, ry, mid)
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if nx * nx + ny * ny <= 1:
                d = nx * 0.6 + ny * 0.8
                if d < -0.45:
                    c.set(x, y, light)
                elif d > 0.45:
                    c.set(x, y, dark)
    return c


def foliage(c, cx, cy, r, tones, seed=1):
    """A round crown of leaves: clusters of the tones, lighter up and left."""
    rnd = rng(seed)
    for _ in range(int(r * r * 0.9)):
        a = rnd.random() * math.tau
        d = math.sqrt(rnd.random()) * r
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.85
        k = (x - cx) / r * 0.6 + (y - cy) / r * 0.8
        i = 0 if k < -0.35 else 1 if k < 0.2 else 2
        if len(tones) > 3 and rnd.random() < 0.12:
            i = 3
        blob(c, x, y, 1.6, 1.4, tones[i])
    return c


def pine(h, tones, trunk='t'):
    """A dark pine: tiers of needles narrowing up."""
    w = h // 2 + 3
    c = Canvas(w, h)
    cx = w // 2
    c.rect(cx, h - 4, 1, 4, trunk)
    for i in range(h - 4):
        y = h - 5 - i
        half = max(0, (i % 6 + (h - 4 - i) * 0.35) * 0.5)
        half = min(half, (h - 4 - i) * 0.45)
        for x in range(int(cx - half), int(cx + half) + 1):
            c.set(x, y, tones[0] if x < cx - half * 0.3 else tones[1] if x < cx + half * 0.4 else tones[2])
    return c.rows()


def tree(h, tones, trunk=('t', 'T'), seed=1):
    """A broad tree: a trunk and two or three crowns of leaves."""
    w = h + 4
    c = Canvas(w, h)
    cx = w // 2
    c.rect(cx - 1, h // 2, 3, h // 2, trunk[1]).rect(cx - 1, h // 2, 1, h // 2, trunk[0])
    c.line(cx, h // 2 + 2, cx - h // 4, h // 3, trunk[1]).line(cx, h // 2 + 3, cx + h // 4, h // 3 + 1, trunk[1])
    foliage(c, cx, h * 0.35, h * 0.32, tones, seed)
    foliage(c, cx - h * 0.25, h * 0.45, h * 0.22, tones, seed + 1)
    foliage(c, cx + h * 0.25, h * 0.42, h * 0.24, tones, seed + 2)
    return c.rows()


def palm(h, leaf=('g', 'G'), trunk=('t', 'T')):
    c = Canvas(h, h)
    x0 = h // 2
    for y in range(h // 4, h):
        x = x0 + int(math.sin((h - y) / h * 1.4) * 3)
        c.set(x, y, trunk[(y // 2) % 2]).set(x + 1, y, trunk[1])
    top = (x0 + int(math.sin(0.75 * 1.4) * 3), h // 4)
    for a in (-2.6, -2.1, -1.5, -0.9, -0.4, 0.1):
        for i in range(h // 3):
            t = i / (h / 3)
            x = top[0] + math.cos(a) * i
            y = top[1] + math.sin(a) * i * 0.7 + t * t * h * 0.18
            c.set(int(x), int(y), leaf[0] if i % 3 else leaf[1])
            c.set(int(x), int(y) + 1, leaf[1])
    return c.rows()


def building(w, h, wall, side, roof, window, lit, seed=1, lit_share=0.3, cols=3, rows_gap=4, top=None):
    """A building lit from the left: its front wall, a darker strip of side, windows in a grid,
    some of them lit."""
    rnd = rng(seed)
    c = Canvas(w, h)
    c.rect(0, 0, w, h, wall)
    c.rect(w - max(2, w // 6), 0, max(2, w // 6), h, side)
    c.rect(0, 0, w, 1, roof)
    for y in range(3, h - 3, rows_gap):
        for x in range(2, w - max(2, w // 6) - 1, cols):
            c.set(x, y, lit if rnd.random() < lit_share else window)
            if cols > 2:
                c.set(x, y + 1, lit if rnd.random() < lit_share * 0.6 else window)
    if top:
        top(c)
    return c.rows()


def skyline(w, h, tone, seed=1, lights=None, light_share=0.08, min_h=0.35):
    """Far buildings as one silhouette (with a few lights)."""
    rnd = rng(seed)
    c = Canvas(w, h)
    x = 0
    while x < w:
        bw = rnd.randint(5, 12)
        bh = int(h * (min_h + rnd.random() * (1 - min_h)))
        c.rect(x, h - bh, bw, bh, tone)
        if rnd.random() < 0.3:
            c.rect(x + bw // 2, h - bh - 3, 1, 3, tone)
        if lights:
            for yy in range(h - bh + 2, h - 1, 3):
                for xx in range(x + 1, x + bw - 1, 2):
                    if rnd.random() < light_share:
                        c.set(xx, yy, rnd.choice(lights))
        x += bw + rnd.randint(0, 2)
    return c.rows()


def strip(w, h, tones, seed=1, noise=0.15):
    """A strip of ground: its top edge light, speckled."""
    rnd = rng(seed)
    c = Canvas(w, h)
    c.rect(0, 0, w, h, tones[1])
    c.rect(0, 0, w, 1, tones[0])
    for y in range(1, h):
        for x in range(w):
            if rnd.random() < noise:
                c.set(x, y, tones[2])
    return c.rows()


def stars_and(c, n, chars, seed=1):
    rnd = rng(seed)
    for _ in range(n):
        c.set(rnd.randrange(c.w), rnd.randrange(c.h), rnd.choice(chars))
    return c
