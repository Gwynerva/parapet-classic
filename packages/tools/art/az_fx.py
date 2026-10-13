"""Azure's effect: Liara's biotics, each piece one of her own powers or scenes, not "blue sparks".

* The flare, on about a third of the flips and vaults: her biotic aura blazes up as she casts
  (a copy of her pose in biotic violet, left where she was, rising a little and fading in 0.4 s),
  cold flames lick up off her outline, and her Singularity (her signature power in all three
  games) is left hanging behind her: a black sphere 25 px across in a thin dark red edge and a
  white-lilac corona, six arms swirling round it with pebbles and sparks drawn in along them; it
  forms, spins and collapses to a point in about a second. The three always come together.
* Her aura on the run, much fainter: now and then a small cold flame rising off her.
* Lift on some landings: two to four pebbles rise from under her feet in a faint lilac field and
  drift up as she runs on.
* While she is in the air, a faint shimmer at her hands (the open-palm cast of her renders).
* Waiting by the start she floats in the blue Prothean stasis bubble she was found in on Therum;
  it pops into motes when she vanishes and forms again when she appears.
* `glyph` (worn by the broker look): now and then her VI drone Glyph, a white core in blue rings,
  keeps her company for a moment, hovering over the back of her crest.

The sprites are drawn here, some by code (the Singularity and the bubble), the stones and the
flames by hand."""
import math

# Biotic lilac and blue, the singularity's core, the stones, the barrier's blue (with alpha).
PALETTE = {
    'w': '#ffffff', 'L': '#efeaff', 'l': '#c4bcff', 'v': '#8a82ec', 'V': '#5a52b8', 'u': '#3c3488',
    'k': '#0c0818', 'K': '#221a44', 'r': '#7c1e3c', 'R': '#a8304e',
    'h': '#9a8cff70', 'H': '#c8c0ff90',
    's': '#c8bca8', 'S': '#968a76', 'd': '#5e5648',
    'b': '#5a7cff2e', 'B': '#7c9cffa0', 'c': '#b4ccffd0', 'C': '#eef4ffe8', 'e': '#6a8cff60',
    'g': '#5aa8ff', 'G': '#a8d4ff', 'W': '#f4faff', 'q': '#2e6ad8',
    # Cold flame (drawn with blend add: the darker, the fainter).
    'F': '#d4ccff', 'f': '#8a7aff', 'n': '#4a38cc', 'm': '#261c7c',
}


def blank(w, h):
    return [['.'] * w for _ in range(h)]


def rows(g):
    return [''.join(r) for r in g]


# The Singularity, 25 px across: a sprite of its own for every step of its life.
SING = 25
ARMS = 6
# A spin step: the arms are six, the pebbles and sparks drawn in along them come every other
# arm, so the picture repeats after a third of a turn: eight frames of 15 degrees.
SPIN = 8
STEP = (2 * math.pi / 3) / SPIN


def singularity(i, sc=1.0, pull=0.0, motes=True):
    """The sphere as Liara throws it (ME3, against Kai Leng): a black core in a thin dark red
    edge, a white-lilac corona brightest on the lit side (the upper front: the upper right here,
    the particle is mirrored to her facing), six arms of it trailing as it spins, and pebbles and
    sparks drawn in along the arms, falling into the corona and glowing as they go. `i` is the spin step (a step turns it 15 degrees, eight steps make a seamless loop),
    `sc` its size (the forming and collapsing frames), `pull` how tightly the collapse winds the
    arms in."""
    g = blank(SING, SING)
    c = (SING - 1) / 2
    rot = i * STEP
    core, rim, cor = 4.55 * sc, 5.45 * sc, 7.1 * sc
    a0, a1 = 6.2 * sc, (12.3 - 2.6 * pull) * sc
    twist = 0.30 + 0.35 * pull
    for y in range(SING):
        for x in range(SING):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            lit = math.cos(a + math.pi / 4)
            if d <= core:
                g[y][x] = 'k'
                continue
            if d <= rim:
                g[y][x] = 'R' if lit > 0.5 else 'r'
                continue
            if d <= cor:
                g[y][x] = 'w' if lit > 0.2 else 'L' if lit > -0.55 else 'l'
                continue
    # The arms: six strokes along trailing spirals, 2-3 px wide where they leave the corona and
    # thinning to a point, bright at the root and on the lit side, dimmer toward the tip.
    curves = []
    for k in range(ARMS):
        pts = []
        n = 40
        for m in range(n + 1):
            r = a0 + (a1 - a0) * m / n
            ang = rot + k * math.pi / 3 - twist * (r - a0) / max(sc, 0.2)
            pts.append((c + r * math.cos(ang), c + r * math.sin(ang), m / n))
        curves.append(pts)
    for y in range(SING):
        for x in range(SING):
            d = math.hypot(x - c, y - c)
            if d <= cor or d > a1 + 1.0:
                continue
            best = None
            for pts in curves:
                for (cx, cy, t) in pts:
                    w = (1.35 - 0.95 * t) * max(sc, 0.5)
                    dd = math.hypot(x - cx, y - cy)
                    if dd < w:
                        lit = math.cos(math.atan2(cy - c, cx - c) + math.pi / 4)
                        v = 1.0 - 1.0 * t + 0.30 * lit - 0.25 * (dd / w) ** 2
                        best = v if best is None else max(best, v)
            if best is not None:
                g[y][x] = ('L' if best > 0.86 else 'l' if best > 0.6 else 'v' if best > 0.36
                           else 'V' if best > 0.14 else 'u')
    if motes:
        out, inn = (a1 - 0.8), cor + 0.3
        for j in range(-2, 5):
            # Pebbles on arms 0, 2, 4 and sparks on arms 1, 3, 5, each sliding one place in along
            # its arm per loop (so the loop is seamless: where one was, the next one is).
            for phase, kind in ((0.0, 'stone'), (0.5, 'spark')):
                s = j + (i % SPIN) / SPIN + phase + (i // SPIN)
                if not 0.15 < s < 2.95:
                    continue
                arm = 2 * j + (1 if kind == 'spark' else 0)
                r = out - (out - inn) * s / 3
                ang = rot + arm * math.pi / 3 - twist * (r - a0) / max(sc, 0.2) + 0.05
                px, py = round(c + r * math.cos(ang)), round(c + r * math.sin(ang))
                if not (0 <= px < SING and 0 <= py < SING):
                    continue
                if kind == 'stone':
                    if s < 0.5 or s > 2.5:
                        g[py][px] = 'S' if s < 0.5 else 'w'
                    else:
                        g[py][px] = 's'
                        if py + 1 < SING:
                            g[py + 1][px] = 'd'
                        if px - 1 >= 0 and s < 1.9:
                            g[py][px - 1] = 'S'
                else:
                    g[py][px] = 'w' if 0.6 < s < 2.6 else 'L'
    return rows(g)


def flash(size=SING):
    """The end of the collapse: a white point with four short rays and a faint ring."""
    g = blank(size, size)
    c = (size - 1) // 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            if d < 0.6:
                g[y][x] = 'w'
            elif (dx == 0 or dy == 0) and d <= 1.1:
                g[y][x] = 'L'
            elif (dx == 0 or dy == 0) and d <= 3.1:
                g[y][x] = 'H' if d <= 2.1 else 'h'
            elif abs(d - 4.6) < 0.5 and (x + y) % 2 == 0:
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


# Cold flame: biotic light licking off her outline (blend add, so on the night sky it glows and
# on a light one it only brightens). Drawn for a runner facing right (`face` mirrors them): the
# tongues lean back, the way the air takes them. Each animation: born at the outline, stretched
# and curling, then a thin wisp torn off.
WISPS = {
    # The small ones of the run, 3-4 px wide, 5-6 tall: a lilac heart, a dim tip.
    'wisp-a1': ['.m.',
                '.n.',
                'nfn',
                'fFf',
                '.n.'],
    'wisp-a2': ['m..',
                '.n.',
                '.nn',
                'nff',
                '.fn',
                '..n'],
    'wisp-a3': ['m...',
                '.n..',
                '..n.',
                '..f.',
                '...n'],
    'wisp-b1': ['..m',
                '.n.',
                'nf.',
                'fFn',
                '.n.'],
    'wisp-b2': ['m...',
                '.n..',
                '.nn.',
                '.nfn',
                '..ff',
                '..n.'],
    'wisp-b3': ['.m..',
                'm...',
                '.n..',
                '..f.',
                '..n.'],
    # The flare's, 5 px wide and 7-8 tall: a fuller tongue, round at the root, with a white
    # heart, its tip curling back.
    'flame-a1': ['.....',
                 '..m..',
                 '..n..',
                 '.nn..',
                 '.nfn.',
                 'nffFn',
                 'nfFfn',
                 '.nfn.'],
    'flame-a2': ['m....',
                 '.n...',
                 '.nn..',
                 '..fn.',
                 '.nffn',
                 '.nFfn',
                 '..fn.',
                 '..n..'],
    'flame-a3': ['m....',
                 '.n...',
                 '..n..',
                 '..nm.',
                 '.nf..',
                 '..fn.',
                 '..n..',
                 '.....'],
    'flame-b1': ['.....',
                 '...m.',
                 '..n..',
                 '.nf..',
                 '.ffn.',
                 'nfFfn',
                 'nfFfn',
                 '.nn..'],
    'flame-b2': ['.m...',
                 'm....',
                 '.n...',
                 '.nfn.',
                 '..ffn',
                 '.nfFn',
                 '.nffn',
                 '..nn.'],
    'flame-b3': ['.m...',
                 'm.n..',
                 '..n..',
                 '..fm.',
                 '.nf..',
                 '..n..',
                 '.....',
                 '.....'],
}


GLYPH = {
    'glyph1': ['..ggg..', '.g...g.', 'g.GWG.g', 'q.WWW.q', 'g.GWG.g', '.q...q.', '..qqq..'],
    'glyph2': ['...g...', '.qgGgq.', '.gGWGg.', 'gGWWWGg', '.gGWGg.', '.qgGgq.', '...q...'],
}


def sprites():
    s = {f'sing{i}': singularity(i) for i in range(SPIN)}
    # Forming (two steps before the loop's start) and collapsing (going on from where the loop
    # leaves it: the frames after sing2 of the second round).
    s.update({'form1': singularity(-2, 0.42, motes=False), 'form2': singularity(-1, 0.74)})
    s.update({'coll1': singularity(11, 0.74, 0.5), 'coll2': singularity(12, 0.5, 0.9, motes=False),
              'coll3': singularity(13, 0.3, 1.0, motes=False), 'flash': flash()})
    s.update(STONES)
    s.update({'bubble': bubble(), 'pop1': bubble(broken=1), 'pop2': bubble(broken=2)})
    s.update(GLYPH)
    s.update(WISPS)
    return s


EMITTERS = {
    # The flare (the biotics variant's snapshot, on about a third of the flips and vaults) brings
    # the Singularity and the cold flames with it; neither has a trigger of its own (and with
    # reduced motion, which takes no snapshots, neither comes).
    # Singularity: a little behind her hips and below them, on the layer behind her, so she flips
    # away from it (forward or back) and it never covers her face; it stays in the world
    # (inherit 0), forms, spins a loop and a half and collapses to a point: 17 frames at 16 fps,
    # 1.06 s.
    'singularity': {
        'burst': 1, 'anchor': 'hips', 'offset': [14, 5], 'speed': 0, 'inherit': 0, 'life': 1060,
        'fadeOut': 110,
        'sprite': {'frames': ['form1', 'form2'] + [f'sing{i}' for i in range(SPIN)] + ['sing0', 'sing1', 'sing2']
                   + ['coll1', 'coll2', 'coll3', 'flash'], 'fps': 16, 'loop': False},
        'face': True, 'max': 2, 'reduced': 1,
    },
    # The flare's cold flames: seven to ten tongues licking up off her outline as the power goes,
    # carried along with her and torn off behind.
    'flare': {
        'burst': [7, 10], 'anchor': 'body', 'speed': [6, 16], 'angle': [60, 120], 'inherit': 0.85,
        'gravity': -40, 'drag': 1.5, 'life': [300, 480], 'fadeOut': 220,
        'sprite': {'frames': [], 'sets': [['flame-a1', 'flame-a2', 'flame-a3'], ['flame-b1', 'flame-b2', 'flame-b3']],
                   'fps': 8, 'loop': False},
        'face': True, 'blend': 'add', 'max': 12, 'reduced': 0.5,
    },
    # Her aura on the run, much fainter: now and then (two or three a second) a small cold flame on
    # her, rising off her outline and lagging behind (in front of her: it only brightens).
    'aura': {
        'while': ['run'], 'perSecond': 2.4, 'minSpeed': 60, 'anchor': 'body', 'speed': [4, 10], 'angle': [70, 110],
        'inherit': 0.75, 'gravity': -36, 'life': [300, 440], 'fadeIn': 60, 'fadeOut': 200,
        'sprite': {'frames': [], 'sets': [['wisp-a1', 'wisp-a2', 'wisp-a3'], ['wisp-b1', 'wisp-b2', 'wisp-b3']],
                   'fps': 8, 'loop': False},
        'face': True, 'blend': 'add', 'max': 3, 'reduced': 0.4, 'layer': 'front',
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

# The flare: on about a third of the flips and vaults her aura blazes up as she casts, a copy of
# her pose in biotic violet left where she was and fading fast, the cold flames and the
# Singularity with it (no snapshots with reduced motion, so none of the three then).
FLARE = {
    'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': 0.3, 'burst': ['singularity', 'flare'],
    'colors': ['#8a9cff'], 'textured': True, 'life': 400, 'drift': [0, -10], 'alpha': 0.7,
}

VARIANTS = {
    'biotics': {'emitters': ['aura', 'lift', 'hands'], 'afterimage': FLARE},
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
