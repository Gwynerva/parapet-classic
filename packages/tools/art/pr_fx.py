"""Petra Radko's effect (fx.json; petra.py imports this module): the master of disguise's, quiet
until she does a trick. She is also the author of this remake and a longsword fencer.

* disguise (the effect's name): on three flips or vaults in ten she changes costume in the air.
  A theatre mask comes off her face and flies away (porcelain comedy with a gold rim or silver-blue
  tragedy, a ribbon in the outfit's colour), and a chain of three copies of her pose peels off
  behind her, one every 110 ms as the trick goes on, each in another costume's colours: the
  crimson, then the gold of the evening dress (and of a theatre's curtain), then the white of the
  undercover wig, sliding back and fading in 0.4 s; a ring of lilac stage smoke bursts behind her
  round the first of them, the costume she has just left. Nothing of it is drawn over her but the
  mask's first moment.
* author: now and then (one every six seconds or so of running) a small `</>` types itself over
  her head in the outfit's own colour (its `accent`), a caret blinking after it, and floats off;
  on one wall move or roll in five a light bulb comes on over her head: an idea.
* blade: on one flip in five a thin steel arc sweeps round her the way she turns, from behind her
  head over the top and down in front (an Oberhau from vom Tag), a glint at its tip, gone in
  0.15 s.
* presence: by the start a wisp of stage fog at her feet now and then, and rarely a `</>` by her;
  leaving, a ring of smoke round her, smoke off the floor, and the tragedy mask she wore left in
  the air where her face was, falling; coming back, the same smoke, and the comedy mask lifted
  off her face, up and away: it was her all along.

Reduced motion keeps the `</>` (half as often), the bulb and, by the start and the goal, the poof,
fewer puffs and the masks; the quick change and the blade are off (no snapshots then).

`write()` writes fx.json (tricks.py gives the bulb and the cut their chances) and keeps the
variants in boss.json's `effect` in step; importing this module does it, as does
`python3 pr_fx.py`."""
import json
import math

from lookgen import BOSSES, write_json
from tricks import tricks

# How often the quick change comes: the chance of a flip or vault, and its chain of copies.
CHANGE_CHANCE = 0.3
CHAIN = {'count': 3, 'every': 110}
# The copies, oldest first: the crimson and gold of the evening dress (and of a theatre's curtain),
# then the white of the undercover wig. Seen as her pose's own shading in three tones of each.
CHAIN_COLOURS = ['#d02a44', '#f0b438', '#f4f0fa']
# The variants she wears together (boss.json `effect`); the first names the effect.
EFFECT = ['disguise', 'author', 'blade']

# The one light of the cast: from the upper front (x the way the runner faces, y down, z to us).
LIGHT = (0.45, -0.6, 0.65)


class FxPalette:
    """Palette characters for the effect's colours, given out as pictures need them."""
    POOL = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*=?@^~<>/|;:#()[]{}_-,'
            + ''.join(chr(c) for c in range(0x3b1, 0x3ca)) + ''.join(chr(c) for c in range(0x430, 0x450)))

    def __init__(self):
        self.pal = {}
        self.by = {}

    def char(self, colour):
        c = colour.lower()
        if c not in self.by:
            ch = next(ch for ch in self.POOL if ch not in self.pal)
            self.pal[ch] = c
            self.by[c] = ch
        return self.by[c]

    def rows(self, rows, legend):
        return [''.join('.' if c == '.' else self.char(legend[c]) for c in r) for r in rows]

    def grid(self, grid):
        return [''.join('.' if c is None else self.char(c) for c in r) for r in grid]


P = FxPalette()
S = {}


def _unit(v):
    n = math.sqrt(sum(c * c for c in v))
    return tuple(c / n for c in v)


L = _unit(LIGHT)


def alpha(a):
    """An opacity (0..1) as two hex digits, in steps of 1/8 so the palette stays small."""
    return '%02x' % min(255, round(max(0.0, a) * 8) * 32)


# ------------------------------------------------------------------------- stage smoke
# Lilac stage smoke (the boss's colour, faded): soft balls lit from the upper front, translucent at
# the edges, no outline. A puff grows from a knot to a cloud of three balls, which part and fade.
SMOKE = ['#fefbff', '#efe8f7', '#d4c8e4', '#ac9ec6', '#83749f']  # highlight → deep shade


def smoke(size, balls, fade=1.0):
    """A puff in a `size` box: lit balls (x, y, r), as opaque as `fade`."""
    g = [[None] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            best = None
            for i, (cx, cy, r) in enumerate(balls):
                d2 = (px - cx) ** 2 + (py - cy) ** 2
                if d2 > r * r:
                    continue
                z = math.sqrt(r * r - d2)
                # The ball in front: the higher surface (later balls a little forward).
                key = z + i * 0.35
                if best is None or key > best[0]:
                    best = (key, (px - cx) / r, (py - cy) / r, z / r)
            if best is None:
                continue
            _, nx, ny, nz = best
            lit = nx * L[0] + ny * L[1] + nz * L[2]
            tone = 0 if lit > 0.9 else 1 if lit > 0.62 else 2 if lit > 0.3 else 3 if lit > -0.05 else 4
            g[y][x] = SMOKE[tone] + alpha((0.94 if nz > 0.45 else 0.7) * fade)
    return g


S['puff1'] = P.grid(smoke(11, [(5.5, 5.7, 2.2)]))
S['puff2'] = P.grid(smoke(11, [(5.0, 6.0, 3.0), (6.7, 4.7, 2.1)]))
S['puff3'] = P.grid(smoke(11, [(3.9, 6.4, 3.0), (7.0, 6.2, 3.0), (5.6, 3.9, 2.9)]))
S['puff4'] = P.grid(smoke(11, [(3.2, 6.9, 2.5), (7.8, 6.7, 2.5), (5.5, 3.1, 2.4)], 0.75))
S['puff5'] = P.grid(smoke(11, [(2.6, 7.4, 1.7), (8.4, 7.2, 1.7), (5.5, 2.4, 1.6)], 0.45))
PUFF = ['puff1', 'puff2', 'puff3', 'puff4', 'puff5']


def ring(size, radius, r, fade=1.0, n=8, turn=0.0):
    """A cartoon poof: `n` balls of smoke on a ring round the middle, hollow inside."""
    c = size / 2
    balls = []
    for k in range(n):
        # Uneven, like real smoke: the balls a little bigger or smaller, nearer or further out.
        big, out = LUMPS[k % len(LUMPS)]
        a = 2 * math.pi * (k + turn) / n
        balls.append((c + radius * out * math.cos(a), c + radius * out * math.sin(a), r * big))
    return smoke(size, balls, fade)


LUMPS = [(1.0, 1.0), (0.8, 0.94), (1.12, 1.04), (0.86, 0.97), (1.05, 1.06), (0.76, 0.92), (1.08, 1.0),
         (0.9, 1.03)]


# The quick change's poof round her: a ring of smoke balls bursting out (hollow, so she shows
# through), parting, fading.
S['poof1'] = P.grid(ring(27, 5.0, 2.4, 0.85))
S['poof2'] = P.grid(ring(27, 7.2, 2.8, turn=0.25))
S['poof3'] = P.grid(ring(27, 9.0, 2.4, turn=0.4))
S['poof4'] = P.grid(ring(27, 10.2, 1.7, 0.7, turn=0.5))
S['poof5'] = P.grid(ring(27, 10.8, 1.1, 0.45, turn=0.55))
POOF = ['poof1', 'poof2', 'poof3', 'poof4', 'poof5']
# A wisp of fog on the stage's floor, by the start.
S['wisp'] = P.grid(smoke(11, [(2.8, 4.2, 1.8), (5.4, 3.4, 2.4), (8.1, 4.3, 1.8)], 0.7))

# -------------------------------------------------------------------------- the masks
# Classic theatre masks, 9 x 12, taller than wide: a broad brow with a flat top, the cheeks narrowing
# to a pointed chin. Porcelain, not skin, lit from the upper right (`W` where the light falls, `v`
# and `s` the soft shade on the far side). Comedy: ivory with a gold rim, its eyes upturned crescents
# under arched brow ridges, the mouth a wide crescent grin. Tragedy: silver-blue with a dark steel
# rim, the eyes drooping under brows raised in the middle, the mouth turned down. Eyes and mouths
# are dark holes. A thin ribbon in the outfit's colour (`accent`) trails from the left temple and
# flutters (two frames).
COMEDY = {'o': '#8a5a1c', 'g': '#c8942c', 'G': '#f4d272', 'W': '#fffbf2', 'w': '#f3e9d6', 'v': '#dac8ac',
          's': '#b49a7c', 'x': '#2c1a20'}
TRAGEDY = {'o': '#2e3654', 'g': '#56648a', 'G': '#9aa8c8', 'W': '#f2f6ff', 'w': '#d6deec', 'v': '#b0bcd4',
           's': '#8896b6', 'x': '#161a2c'}
RIBBON = {'A': 'accent', 'a': 'accent.dark'}
COMEDY_FACE = [
    '..ggGGG..',
    '.gwwwwWG.',
    'gvwwwwwWG',
    'gvswwwsWG',
    'gvxwwwxWG',
    'gxvxwxwxG',
    'gvwwvwwWG',
    'gxwwvwwxG',
    '.oxxxxxG.',
    '.ovxxxWg.',
    '..ovwWg..',
    '...oog...',
]
TRAGEDY_FACE = [
    '..ggGGG..',
    '.gwwwwWG.',
    'gvwswswWG',
    'gvswwwsWG',
    'gvwxwxwWG',
    'oxxvwvxxG',
    'ovwwvwwWG',
    'ovwwxwwWG',
    '.ovxxxwG.',
    '.oxvwvxg.',
    '..ovwWg..',
    '...oog...',
]
# The ribbon, (x, y, colour) left of the face, in its two flutters.
TIES = [
    [(2, 3, 'A'), (1, 4, 'A'), (1, 5, 'a'), (0, 6, 'A'), (0, 7, 'a')],
    [(2, 3, 'A'), (1, 3, 'a'), (0, 4, 'A'), (0, 5, 'a'), (1, 6, 'A'), (1, 7, 'a')],
]


def mask(face, tie):
    """A face with its ribbon, three columns left of it."""
    g = [['.'] * 3 + list(row) for row in face]
    for x, y, c in tie:
        g[y][x] = c
    return [''.join(r) for r in g]


for i, tie in enumerate(TIES):
    S[f'comedy{i + 1}'] = P.rows(mask(COMEDY_FACE, tie), {**COMEDY, **RIBBON})
    S[f'tragedy{i + 1}'] = P.rows(mask(TRAGEDY_FACE, tie), {**TRAGEDY, **RIBBON})
# A mask tossed off on a trick is one of the two at random (so its ribbon keeps still: a random
# frame does not play); the masks of the presence flutter theirs.
MASKS = ['comedy1', 'tragedy1']
COMEDY_FLUTTER = {'frames': ['comedy1', 'comedy2'], 'fps': 6}
TRAGEDY_FLUTTER = {'frames': ['tragedy1', 'tragedy2'], 'fps': 6}

# ---------------------------------------------------------------------------- </>
# Typed over her head in the outfit's colour, a darker line under every stroke so it reads on a
# light wall; then the caret blinks.
GLYPH_LT = ['..#', '.#.', '#..', '.#.', '..#']
GLYPH_SLASH = ['..#', '..#', '.#.', '#..', '#..']
GLYPH_GT = ['#..', '.#.', '..#', '.#.', '#..']


def typed(n, caret):
    w, h = 13, 6
    g = [['.'] * w for _ in range(h)]
    for i, glyph in enumerate([GLYPH_LT, GLYPH_SLASH, GLYPH_GT][:n]):
        for y, row in enumerate(glyph):
            for x, c in enumerate(row):
                if c == '#':
                    g[y][i * 4 + x] = 'A'
    if caret:
        for y in range(5):
            g[y][12] = 'L'
    for y in range(h - 1, 0, -1):
        for x in range(w):
            if g[y][x] == '.' and g[y - 1][x] in 'AL':
                g[y][x] = 'D'
    return [''.join(r) for r in g]


TAG = {'A': 'accent', 'L': 'accent.light', 'D': 'accent.dark'}
S['tag1'] = P.rows(typed(1, False), TAG)
S['tag2'] = P.rows(typed(2, False), TAG)
S['tag3'] = P.rows(typed(3, False), TAG)
S['tag3c'] = P.rows(typed(3, True), TAG)
TAG_FRAMES = ['tag1', 'tag2', 'tag3', 'tag3c', 'tag3', 'tag3c', 'tag3', 'tag3c', 'tag3', 'tag3', 'tag3', 'tag3']

# ----------------------------------------------------------------------------- an idea
# A light bulb: off (cold glass), on (warm, its glow round it), a flicker of rays.
BULB = {'k': '#3a3440', 'm': '#8a8e9a', 'n': '#5c6070', 'c': '#d8e0ec', 'C': '#f4f8ff', 'f': '#a89aa0',
        'o': '#f0a030', 'y': '#ffd84a', 'Y': '#fff2a8', 'W': '#ffffff', 'a': '#ffd04060', 'r': '#fff2a8c0'}
S['bulb-off'] = P.rows([
    '.............',
    '.............',
    '.....kkk.....',
    '....kccCk....',
    '...kcccCCk...',
    '...kcfffCk...',
    '...kccfcck...',
    '....kcfck....',
    '.....kmk.....',
    '.....mnm.....',
    '.....nmn.....',
    '......k......',
    '.............',
], BULB)
S['bulb-on'] = P.rows([
    '.............',
    '.....aaa.....',
    '....akkka....',
    '...akyYWka...',
    '..akyYWWWka..',
    '..akoyWYWka..',
    '..akoyYWyka..',
    '...akoyyka...',
    '....akmka....',
    '.....mnm.....',
    '.....nmn.....',
    '......k......',
    '.............',
], BULB)
S['bulb-rays'] = P.rows([
    '......r......',
    '.r...aaa...r.',
    '..r.akkka.r..',
    '...akyYWka...',
    '..akyYWWWka..',
    'rrakoyWYWkarr',
    '..akoyYWyka..',
    '...akoyyka...',
    '..r.akmka.r..',
    '.r...mnm...r.',
    '.....nmn.....',
    '......k......',
    '.............',
], BULB)
BULB_FRAMES = ['bulb-off', 'bulb-on', 'bulb-rays', 'bulb-on', 'bulb-rays', 'bulb-on', 'bulb-on', 'bulb-on']

# ---------------------------------------------------------------------------- the blade
# The arc of a cut over her as she flips, drawn for a runner facing right (the engine mirrors it):
# from behind her head over the top and down in front, its tip white, the trail steel fading.
STEEL = ['#ffffff', '#e4ecff', '#b4c2e0', '#8494bc']
# The cut's outer fringe, a darker steel, so it reads on a pale sky or a light wall too.
FRINGE = '#4c5a86'


def arc(start, end, star=False, fade=1.0, size=33, r=14.5):
    """Degrees anticlockwise from ahead (screen up is +90); the tip at `end` (the cut goes down)."""
    g = [[None] * size for _ in range(size)]
    c = (size - 1) / 2

    def at(a, rr):
        return round(c + rr * math.cos(a)), round(c - rr * math.sin(a))

    steps = max(2, int(abs(end - start) * 1.5))
    for i in range(steps + 1):
        t = i / steps  # 0 at the tail, 1 at the tip
        a = math.radians(start + (end - start) * t)
        x, y = at(a, r)
        tone = STEEL[0] if t > 0.86 else STEEL[1] if t > 0.6 else STEEL[2] if t > 0.3 else STEEL[3]
        g[y][x] = tone + alpha((0.35 + 0.65 * t) * fade)
        # The edge thickens toward the tip: a second pixel inside.
        if t > 0.6:
            xi, yi = at(a, r - 1)
            if g[yi][xi] is None:
                g[yi][xi] = STEEL[1] + alpha(0.8 * t * fade)
        if t > 0.35:
            xo, yo = at(a, r + 1)
            if g[yo][xo] is None:
                g[yo][xo] = FRINGE + alpha(0.55 * t * fade)
    if star:
        x, y = at(math.radians(end), r)
        for dx, dy, col in ((0, 0, '#ffffff'), (1, 0, '#ffffffc0'), (-1, 0, '#ffffffc0'), (0, 1, '#ffffffc0'),
                            (0, -1, '#ffffffc0'), (2, 0, '#e4ecff60'), (-2, 0, '#e4ecff60'), (0, 2, '#e4ecff60'),
                            (0, -2, '#e4ecff60')):
            if 0 <= x + dx < size and 0 <= y + dy < size:
                g[y + dy][x + dx] = col
    return g


S['cut1'] = P.grid(arc(165, 100))
S['cut2'] = P.grid(arc(150, 25))
S['cut3'] = P.grid(arc(95, -45, star=True))
S['cut4'] = P.grid(arc(20, -60, fade=0.5))
CUT = ['cut1', 'cut2', 'cut3', 'cut4']

# ---------------------------------------------------------------------------- emitters
EMITTERS = {
    # --- disguise: these come only with the snapshot chain (its `burst`).
    # The poof she changes in: a ring of smoke bursting out behind her back (under her, never over
    # her), round the costume she leaves there.
    'change-smoke': {
        'burst': 1, 'anchor': 'chest', 'offset': [7, 1], 'speed': 0, 'life': 380, 'fadeOut': 120, 'face': True,
        'sprite': {'frames': POOF, 'fps': 13, 'loop': False},
    },
    # The mask she wore comes off her face and flies off, up and back, wobbling, and drops. It stays
    # upright so its face reads at a glance.
    'change-mask': {
        'burst': 1, 'anchor': 'head', 'offset': [5, -1], 'speed': [42, 54], 'angle': [60, 95], 'gravity': 120,
        'drag': 0.6, 'life': [850, 1000], 'fadeIn': 60, 'fadeOut': 350, 'flutter': {'amp': 1.5, 'freq': 2.5},
        'sprite': {'frames': MASKS, 'random': True}, 'layer': 'front',
    },
    # --- author
    # Now and then a `</>` types itself over her head and floats up, slowly left behind.
    'tag': {
        'while': ['run'], 'perSecond': 0.16, 'minSpeed': 40, 'anchor': 'head', 'offset': [4, -11],
        'jitter': [3, 1], 'inherit': 0.8, 'speed': [4, 7], 'angle': [80, 100], 'gravity': -2,
        'life': 1500, 'fadeIn': 60, 'fadeOut': 500, 'sprite': {'frames': TAG_FRAMES, 'fps': 8, 'loop': False}, 'max': 1,
        'reduced': 0.5,
    },
    # An idea on some wall moves and rolls (tricks.py gives them the chance).
    'idea': {
        'enter': ['wall', 'roll'], 'burst': 1, 'anchor': 'head', 'offset': [0, -11], 'inherit': 0.6,
        'speed': [4, 8], 'angle': [80, 100], 'gravity': -6, 'life': 1200, 'fadeIn': 80, 'fadeOut': 450,
        'sprite': {'frames': BULB_FRAMES, 'fps': 7, 'loop': False}, 'max': 1, 'layer': 'front', 'reduced': 1,
    },
    # --- blade: the cut on some flips (tricks.py gives it the chance), keeping up with her.
    'cut': {
        'enter': ['flip'], 'burst': 1, 'anchor': 'chest', 'speed': 0, 'inherit': 1, 'life': 150,
        'fadeOut': 40, 'face': True, 'sprite': {'frames': CUT, 'fps': 27, 'loop': False}, 'layer': 'front',
        'max': 1,
    },
    # --- presence
    # By the start: a wisp of stage fog at her feet now and then, and rarely a `</>` by her.
    'idle-fog': {
        'perSecond': 0.8, 'anchor': 'feet', 'offset': [0, -3], 'jitter': [12, 1], 'speed': [2, 5],
        'angle': [0, 180], 'gravity': -2, 'life': [1600, 2200], 'fadeIn': 500, 'fadeOut': 800, 'face': True,
        'sprite': {'frames': ['wisp']},
    },
    'idle-tag': {
        'perSecond': 0.12, 'anchor': 'head', 'offset': [0, -6], 'jitter': [8, 4], 'speed': [3, 6],
        'angle': [80, 100], 'gravity': -3, 'life': 1500, 'fadeIn': 60, 'fadeOut': 500,
        'sprite': {'frames': TAG_FRAMES, 'fps': 8, 'loop': False}, 'max': 1,
    },
    # Leaving: a poof round her and smoke off the floor, and the tragedy mask she wore left on the
    # air a moment where her face was, falling.
    'vanish-poof': {
        'burst': 1, 'anchor': 'chest', 'speed': 0, 'life': 460, 'fadeOut': 140, 'face': True,
        'sprite': {'frames': POOF, 'fps': 11, 'loop': False}, 'layer': 'front', 'reduced': 1,
    },
    'vanish-smoke': {
        'burst': [4, 5], 'anchor': 'feet', 'offset': [0, -3], 'jitter': [7, 1], 'speed': [6, 14],
        'angle': [20, 160], 'drag': 2, 'gravity': -8, 'life': [600, 800], 'fadeOut': 260, 'face': True,
        'sprite': {'frames': PUFF, 'fps': 8, 'loop': False}, 'reduced': 0.5,
    },
    'vanish-mask': {
        'burst': 1, 'anchor': 'head', 'offset': [0, 2], 'speed': [3, 5], 'angle': [80, 100], 'gravity': 60,
        'life': 1100, 'fadeIn': 120, 'fadeOut': 450, 'sprite': TRAGEDY_FLUTTER, 'layer': 'front',
        'reduced': 1,
    },
    # Coming back: a poof, smoke off the floor, and the comedy mask lifted off her face, up and away:
    # it was her all along.
    'appear-poof': {
        'burst': 1, 'anchor': 'chest', 'speed': 0, 'life': 460, 'fadeOut': 140, 'face': True,
        'sprite': {'frames': POOF, 'fps': 11, 'loop': False}, 'layer': 'front', 'reduced': 1,
    },
    'appear-smoke': {
        'burst': [3, 4], 'anchor': 'feet', 'offset': [0, -3], 'jitter': [7, 1], 'speed': [6, 14],
        'angle': [20, 160], 'drag': 2, 'gravity': -8, 'life': [550, 750], 'fadeOut': 240, 'face': True,
        'sprite': {'frames': PUFF, 'fps': 8, 'loop': False}, 'reduced': 0.5,
    },
    'appear-mask': {
        'burst': 1, 'anchor': 'head', 'offset': [0, 2], 'speed': [26, 30], 'angle': [96, 104], 'gravity': 12,
        'drag': 0.7, 'life': 1300, 'fadeOut': 500, 'sprite': COMEDY_FLUTTER, 'layer': 'front',
        'reduced': 1,
    },
}

fx = {
    'palette': P.pal,
    'sprites': S,
    'emitters': EMITTERS,
    'variants': {
        # The quick change on some flips and vaults: a mask, her other selves peeling off, a poof.
        'disguise': {
            'emitters': [],
            'afterimage': {'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': CHANGE_CHANCE,
                           'repeat': CHAIN, 'colors': CHAIN_COLOURS, 'textured': True,
                           'burst': ['change-smoke', 'change-mask'], 'life': 420, 'drift': [40, -4],
                           'alpha': 0.75},
        },
        # The author: `</>` now and then, an idea on some wall moves and rolls.
        'author': {'emitters': ['tag', 'idea']},
        # The fencer: a cut on some flips.
        'blade': {'emitters': ['cut']},
    },
    'presence': {'idle': ['idle-fog', 'idle-tag'], 'vanish': ['vanish-poof', 'vanish-smoke', 'vanish-mask'],
                 'appear': ['appear-poof', 'appear-smoke', 'appear-mask']},
}


def write():
    write_json(BOSSES + '/petra/fx.json', tricks(fx, 'petra'))
    # The variants she wears, in step with the file (only `effect` is written in boss.json).
    path = BOSSES + '/petra/boss.json'
    with open(path, encoding='utf-8') as f:
        boss = json.load(f)
    if boss.get('effect') != EFFECT:
        boss['effect'] = EFFECT
        write_json(path, boss)


write()
print('petra fx written')
