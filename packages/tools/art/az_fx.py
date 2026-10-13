"""Azure's effect: Liara's biotics, each piece one of her own powers or scenes, not "blue sparks".

* Singularity (her signature power in all three games) on some flips and vaults: a black sphere
  in a thin dark red edge and a white-lilac corona, four tongues of it swirling out, left hanging
  in the air where she was for under a second, then collapsing to a point.
* Lift on some landings: two to four pebbles rise from under her feet in a faint lilac field and
  drift up as she runs on.
* While she is in the air, a faint shimmer at her hands (the open-palm cast of her renders).
* Waiting by the start she floats in the blue Prothean stasis bubble she was found in on Therum;
  it pops into motes when she vanishes and forms again when she appears.
* `glyph` (worn by the broker look): now and then her VI drone Glyph, a white core in blue rings,
  keeps her company for a moment, hovering over the back of her crest.

The sprites are drawn here, some by code (circles and the bubble), the stones by hand."""
import math

# Biotic lilac and blue, the singularity's core, the stones, the barrier's blue (with alpha).
PALETTE = {
    'w': '#ffffff', 'L': '#efeaff', 'l': '#c4bcff', 'v': '#8a82ec', 'V': '#5a52b8', 'u': '#3c3488',
    'k': '#0c0818', 'K': '#221a44', 'r': '#7a2a5a',
    'h': '#9a8cff70', 'H': '#c8c0ff90',
    's': '#c8bca8', 'S': '#968a76', 'd': '#5e5648',
    'b': '#5a7cff2e', 'B': '#7c9cffa0', 'c': '#b4ccffd0', 'C': '#eef4ffe8', 'e': '#6a8cff60',
    'g': '#5aa8ff', 'G': '#a8d4ff', 'W': '#f4faff', 'q': '#2e6ad8',
}


def blank(w, h):
    return [['.'] * w for _ in range(h)]


def rows(g):
    return [''.join(r) for r in g]


def singularity(frame, size=15):
    """The sphere as Liara throws it: a black core in a thin dark red edge, a white-lilac corona
    round it and four tongues of it swirling out and fading; a step of a sixteenth of a turn a
    frame, so four frames loop (the tongues are four)."""
    g = blank(size, size)
    c = (size - 1) / 2
    turn = frame * math.pi / 8
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            if d <= 2.9:
                g[y][x] = 'k'
            elif d <= 3.6:
                g[y][x] = 'r'
            elif d <= 4.95:
                # The corona: brightest on the side the light comes from (upper right).
                lit = math.cos(a + math.pi / 4)
                g[y][x] = 'w' if lit > 0.3 else 'L' if lit > -0.5 else 'l'
            elif d <= 7.0:
                for k in range(4):
                    ang = turn + k * math.pi / 2 + 0.45 * (d - 4.95)
                    off = (a - ang + math.pi) % (2 * math.pi) - math.pi
                    if abs(off) < 0.42 - 0.1 * (d - 4.95):
                        g[y][x] = 'l' if d <= 5.7 else 'v' if d <= 6.4 else 'h'
    return rows(g)


def collapse(radius, size=15):
    """The sphere shrinking: a smaller core and rim, the haze pulled in, then a bright point."""
    g = blank(size, size)
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c)
            if radius <= 0.6:
                if d < 0.6:
                    g[y][x] = 'w'
                elif d < 1.6:
                    g[y][x] = 'H'
                elif d < 2.4 and (x + y) % 2 == 0:
                    g[y][x] = 'h'
            elif d <= radius - 1.0:
                g[y][x] = 'k'
            elif d <= radius:
                g[y][x] = 'L' if x + y < size - 1 else 'l'
            elif d <= radius + 1.2:
                g[y][x] = 'h'
    return rows(g)


# Lift: a pebble (light, mid, dark) in a faint lilac field.
STONES = {
    'stone1': ['.hHh.', 'hsSdh', 'hSddh', '.hhh.'],
    'stone2': ['.hHHh.', 'HssSdh', 'hsSSdh', 'hSddh.', '.hhh..'],
    'stone3': ['.H.', 'hsh', '.h.'],
}


def bubble(w=33, h=61, broken=0):
    """The Prothean stasis bubble: an upright ellipse, a faint blue fill, a brighter rim, a white
    gleam at its upper right (the light's side, the runner's front: the sprite is mirrored to her
    facing), a dim line where the field folds. `broken` 1 and 2: the rim splitting into dashes and
    dots, the fill gone."""
    g = blank(w, h)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    rx, ry = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        for x in range(w):
            e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            inner = ((x - cx) / (rx - 1.4)) ** 2 + ((y - cy) / (ry - 1.4)) ** 2
            ang = math.atan2(y - cy, x - cx)
            if e <= 1.0 and inner > 1.0:
                if broken == 1 and (int((ang + math.pi) * 9) % 3 == 0):
                    continue
                if broken == 2 and (int((ang + math.pi) * 9) % 3 != 1):
                    continue
                gleam = -1.3 < ang < -0.6 if broken == 0 else False
                g[y][x] = 'C' if gleam else 'c' if -2.0 < ang < 0.2 else 'B'
            elif e <= 1.0 and broken == 0:
                g[y][x] = 'b'
                band = ((x - cx) / (rx - 4)) ** 2 + ((y - cy + 6) / (ry - 3)) ** 2
                if 0.92 < band <= 1.0 and -2.8 < ang < -0.5:
                    g[y][x] = 'e'
    return rows(g)


GLYPH = {
    'glyph1': ['..ggg..', '.g...g.', 'g.GWG.g', 'q.WWW.q', 'g.GWG.g', '.q...q.', '..qqq..'],
    'glyph2': ['...g...', '.qgGgq.', '.gGWGg.', 'gGWWWGg', '.gGWGg.', '.qgGgq.', '...q...'],
}


def sprites():
    s = {f'sing{i}': singularity(i) for i in range(4)}
    s.update({'coll1': collapse(3.6), 'coll2': collapse(2.2), 'coll3': collapse(0.5)})
    s.update(STONES)
    s.update({'bubble': bubble(), 'pop1': bubble(broken=1), 'pop2': bubble(broken=2)})
    s.update(GLYPH)
    return s


EMITTERS = {
    # Singularity: on a flip or a vault, about one in three, ahead of her near hand; it stays in the
    # world (inherit 0), swirls for half a second and collapses (12 frames at 13 fps, 0.92 s).
    'singularity': {
        'enter': ['flip', 'vault'], 'chance': 0.3, 'burst': 1, 'anchor': 'hand.near', 'offset': [-3, -1],
        'speed': 0, 'inherit': 0, 'life': 920, 'fadeIn': 60, 'fadeOut': 140,
        'sprite': {'frames': ['sing0', 'sing1', 'sing2', 'sing3', 'sing0', 'sing1', 'sing2', 'sing3', 'coll1',
                              'coll2', 'coll3', 'coll3'], 'fps': 13, 'loop': False},
        'max': 2, 'reduced': 1,
    },
    # Lift: on about a third of the landings, two to four pebbles float up from under her feet.
    'lift': {
        'enter': ['land'], 'chance': 0.3, 'burst': [2, 4], 'anchor': 'feet', 'offset': [0, -1], 'jitter': [6, 0],
        'speed': [10, 18], 'angle': [75, 105], 'inherit': 0, 'gravity': -6, 'drag': 1.6, 'life': [900, 1300],
        'fadeIn': 120, 'fadeOut': 450, 'sprite': {'frames': ['stone1', 'stone2', 'stone3'], 'random': True},
        'max': 8, 'reduced': 0.5,
    },
    # The shimmer at her hands, only in the air: a few faint lilac pixels.
    'hands': {
        'while': ['air'], 'perSecond': 5, 'anchor': 'hands', 'jitter': [1, 1], 'speed': [3, 8],
        'angle': [40, 140], 'gravity': -8, 'life': [180, 320], 'fadeOut': 140,
        'rect': {'size': 1, 'colors': ['L', 'l', 'v']}, 'blend': 'add', 'max': 6,
    },
    # Glyph: now and then (one in four tries, a try every four seconds or so) the drone by her
    # shoulder, carried along with her for two seconds.
    'glyph': {
        'while': ['run'], 'perSecond': 0.25, 'chance': 0.25, 'minSpeed': 60, 'anchor': 'head', 'offset': [11, -12],
        'speed': 0, 'inherit': 1, 'life': [1800, 2200], 'fadeIn': 300, 'fadeOut': 700,
        'flutter': {'amp': 1, 'freq': 0.8}, 'sprite': {'frames': ['glyph1', 'glyph2'], 'fps': 5},
        'max': 1, 'reduced': 0.3, 'layer': 'front',
    },
    # Presence. Waiting: she floats in the stasis bubble (two bubbles crossfading, the field
    # breathing), a few blue motes rising in it.
    'bubble': {
        'perSecond': 0.8, 'anchor': 'feet', 'offset': [0, -29], 'speed': 0, 'life': 2400, 'fadeIn': 700,
        'fadeOut': 800, 'sprite': {'frames': ['bubble']}, 'face': True, 'max': 2, 'layer': 'front', 'reduced': 1,
    },
    'bubble-motes': {
        'perSecond': 3, 'anchor': 'feet', 'offset': [0, -10], 'jitter': [11, 8], 'speed': [5, 10],
        'angle': [80, 100], 'life': [900, 1400], 'fadeIn': 200, 'fadeOut': 500,
        'rect': {'size': 1, 'colors': ['G', 'g', 'L']}, 'blend': 'add',
    },
    # Vanishing: the bubble breaks (rim into dashes, then dots) and bursts into motes.
    'pop': {
        'burst': 1, 'anchor': 'feet', 'offset': [0, -29], 'speed': 0, 'life': 260, 'fadeOut': 120,
        'sprite': {'frames': ['pop1', 'pop2'], 'fps': 8, 'loop': False}, 'face': True, 'layer': 'front',
        'reduced': 1,
    },
    'pop-motes': {
        'burst': [26, 32], 'anchor': 'feet', 'offset': [0, -29], 'jitter': [14, 27], 'speed': [14, 40],
        'angle': [0, 360], 'drag': 2.4, 'life': [500, 900], 'fadeOut': 400,
        'rect': {'size': [1, 2], 'colors': ['G', 'g', 'L', 'l', 'W']}, 'blend': 'add', 'reduced': 0.4,
    },
    # Appearing: the bubble flashes in round her and fades.
    'form': {
        'burst': 1, 'anchor': 'feet', 'offset': [0, -29], 'speed': 0, 'life': 900, 'fadeOut': 600,
        'sprite': {'frames': ['pop2', 'pop1', 'bubble'], 'fps': 10, 'loop': False}, 'face': True,
        'layer': 'front', 'reduced': 1,
    },
}

VARIANTS = {
    'biotics': {'emitters': ['singularity', 'lift', 'hands']},
    'glyph': {'emitters': ['glyph']},
}

PRESENCE = {'idle': ['bubble', 'bubble-motes'], 'vanish': ['pop', 'pop-motes'], 'appear': ['form', 'pop-motes']}


def fx():
    return {'palette': dict(PALETTE), 'sprites': sprites(), 'emitters': {k: dict(v) for k, v in EMITTERS.items()},
            'variants': VARIANTS, 'presence': PRESENCE}


if __name__ == '__main__':
    from gridpng import sheet
    s = sprites()
    sheet('az-fx.png', [(s[k], PALETTE) for k in s], scale=8, per_row=8)
    print('ok')
