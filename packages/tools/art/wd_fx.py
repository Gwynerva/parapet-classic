"""Widow's effect (fx.json): Widowmaker's kit, the femme fatale's: flashier than the other bosses'
on her tricks, quiet on the run (only, now and then, a kiss).

* kiss (the effect's name, "Widow's Kiss": her rifle's and her own, the emote and the "Bisous"):
  - the spectral shot, on about a third of her flips and vaults: she fires as she takes off. Her
    visor's lens glints (a red lens star, the sniper's glint), a pink muzzle flash bursts ahead of
    her, a charged shot's tracer 128 px long (a white-hot core in a pink glow in a violet haze)
    hangs in the air where she fired and burns out from the outside in, the bullet's own streak
    flies on ahead, and the recoil leaves three spectral copies of her behind (hot pink, then the
    outfit's colour, then that colour paled; hologram scanlines), one every 80 ms, sliding back and
    fading in 0.4 s;
  - now and then as she runs (about one every eight seconds) a lipstick kiss in plum leaves her
    lips and floats back and up, twinkling once; one landing in ten she blows one too.
* grapple: on about half of her tic-tac jumps and wall runs and one jump in seven her grappling
  hook is shot from the gauntlet like a bullet: a twisted steel line flies up ahead of her, its
  leading stretch a pink tracer, a flash at the wrist in the outfit's colour (`accent`, the
  gauntlet's light), the grapnel bites (another flash), the line holds taut a moment with a glint
  running up it, then reels back in; 0.4 s, behind her, flying with her (the runner's own launch
  and gravity) so that it keeps to her hand.
* venom: on about two rolls and hard landings in five she leaves a Venom Mine behind: a little
  spider of steel with a violet core blinks twice and pops into a cloud of violet poison, round
  puffs lit from the upper front, their shade and underside toxic green, green glints in it,
  which swells along the ground up to her hips where it was dropped, rises a little and thins out
  ("A deadly fragrance").
* presence: by the start (and where she waits at the end) the line she came down hangs beside
  her, her visor glints now and then, and wisps of venom curl at her feet; leaving, she blows a
  kiss (it stays in the air where her lips were and floats away) and dissolves into a burst of
  venom; coming back, a line drops from above and she comes down it, her visor glinting as she
  arrives.

Reduced motion keeps the kisses (the running ones half as often), the hook, the mine and its
cloud, and at the start and the goal the kiss, the cloud, the line and the glint; the spectral
shot is off (the engine takes no snapshots then: its tracer, flash and glint come only with
them), and so is the haze by the start (the engine draws none).

`write()` writes fx.json (tricks.py gives the hook, the landing kiss and the mine their chances)
and keeps the variants in boss.json's `effect` in step; `python3 wd_fx.py` does it."""
import json
import math
import random

from lookgen import BOSSES, write_json
from tricks import tricks

# The variants she wears together (boss.json `effect`); the first names the effect.
EFFECT = ['kiss', 'grapple', 'venom']

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


def blank(w, h):
    return [[None] * w for _ in range(h)]


def stamp(g, rows, legend, x0, y0):
    """Paints `rows` (legend characters, `.` clear) into the grid `g` at (x0, y0)."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.' and 0 <= y0 + y < len(g) and 0 <= x0 + x < len(g[0]):
                g[y0 + y][x0 + x] = legend[ch]


# S['none']: nothing at all, the frames a delayed particle waits through.
S['none'] = ['.']

# ------------------------------------------------------------------------------ the kiss
# A lipstick kiss in plum, 13 x 6, as her "Baiser" spray: the upper lip's bow in two lit peaks, a
# dark parting with sharp corners, the full lower lip with a gloss on it. Its twinkle: a little
# white star off the upper lip's corner.
KISS = {'k': '#3a1550', 'o': '#561e78', 'd': '#8a3cb0', 'm': '#c05ae0', 'l': '#e898f6', 'w': '#fff0ff',
        'W': '#ffffff', 'p': '#f6dcffa0'}
KISS_ROWS = [
    '...............',
    '.....dl.dl.....',
    '...dmmlmmlmd...',
    '.ddmmmmmmmmmdd.',
    '..kkoooooookk..',
    '...dmllwlmmd...',
    '....ddmmmdd....',
    '...............',
]
S['kiss'] = P.rows(KISS_ROWS, KISS)
_tw = [list(r) for r in KISS_ROWS]
for _x, _y, _c in ((13, 0, 'p'), (12, 1, 'p'), (13, 1, 'W'), (14, 1, 'p'), (13, 2, 'p')):
    _tw[_y][_x] = _c
S['kiss-tw'] = P.rows([''.join(r) for r in _tw], KISS)
KISS_FRAMES = ['kiss', 'kiss', 'kiss-tw', 'kiss', 'kiss', 'kiss', 'kiss', 'kiss']

# ----------------------------------------------------------------------------- the glint
# The sniper's glint on her visor's lens: a lens star, white at its heart, pink round it, its
# rays red and fading; the level rays longer (a scope's flare).
GLINT = {'W': '#ffffff', 'P': '#ffc8d4', 'R': '#ff3048', 'r': '#ff304899', 'q': '#ff304850'}


def star(size, arm_h, arm_v, diag, core=1):
    c = size // 2
    g = [['.'] * size for _ in range(size)]
    order = '.qrRPW'

    def put(x, y, ch):
        if 0 <= x < size and 0 <= y < size and order.index(ch) > order.index(g[y][x]):
            g[y][x] = ch
    ramp = ['W', 'P', 'R', 'R', 'r', 'q', 'q']
    for d in range(arm_h + 1):
        ch = ramp[min(len(ramp) - 1, round(d * 6 / max(1, arm_h)))] if d else 'W'
        put(c + d, c, ch)
        put(c - d, c, ch)
    for d in range(arm_v + 1):
        ch = ramp[min(len(ramp) - 1, round(d * 6 / max(1, arm_v)))] if d else 'W'
        put(c, c + d, ch)
        put(c, c - d, ch)
    for d in range(1, diag + 1):
        ch = ['P', 'r', 'q'][min(2, d - 1)]
        for sx in (-1, 1):
            for sy in (-1, 1):
                put(c + sx * d, c + sy * d, ch)
    if core > 1:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            put(c + dx, c + dy, 'W')
    return [''.join(r) for r in g]


S['glint1'] = P.rows(star(13, 1, 1, 0), GLINT)
S['glint2'] = P.rows(star(13, 4, 3, 1), GLINT)
S['glint3'] = P.rows(star(13, 6, 5, 2, 2), GLINT)
S['glint4'] = P.rows(star(13, 5, 3, 1), GLINT)
S['glint5'] = P.rows(star(13, 2, 1, 0), GLINT)
GLINT_FRAMES = ['glint1', 'glint2', 'glint3', 'glint3', 'glint4', 'glint5']

# ------------------------------------------------------------------------ the spectral shot
# Widow's Kiss fired as she turns over: drawn for a runner facing right, from the muzzle ahead.
# The tracer of a charged shot, 128 px of it, a white-hot core in a pink glow in a violet haze, the
# haze and glow tapering off toward its far end; it burns out from the outside in (four frames).
# The bullet's own streak flies on ahead of it; at the muzzle a flash, mostly forward.
SHOT = {'core': '#ffffff', 'hot': '#ffe6f6', 'glow': '#ff6ec0', 'haze': '#c45cff'}
BW, BH = 128, 5


def beam(stage):
    g = blank(BW, BH)
    for x in range(BW):
        t = x / (BW - 1)
        if stage < 3 or (x // 3) % 2 == 0:
            core = (1.0 if stage == 0 else 0.85 if stage == 1 else 0.6 if stage == 2 else 0.4) * (1 - 0.55 * t)
            g[2][x] = (SHOT['core'] if t < 0.5 else SHOT['hot']) + alpha(core)
        if stage <= 1 and t < 0.88:
            a = (0.75 if stage == 0 else 0.4) * (1 - t / 0.88)
            g[1][x] = g[3][x] = SHOT['glow'] + alpha(a)
        if stage == 0 and t < 0.6:
            a = 0.45 * (1 - t / 0.6)
            g[0][x] = g[4][x] = SHOT['haze'] + alpha(a)
    return g


for _i in range(4):
    S[f'beam{_i + 1}'] = P.grid(beam(_i))
BEAM_FRAMES = ['beam1', 'beam2', 'beam3', 'beam4']
# The bullet's streak, its head bright, its tail pink.
S['bolt'] = P.grid([[None if (y != 1 and x < 14) else
                     (SHOT['core'] if x >= 21 else SHOT['hot'] + alpha(0.5 + x / 46) if y == 1 else
                      SHOT['glow'] + alpha(0.6)) for x in range(24)] for y in range(3)])
MUZZLE = {'W': '#ffffff', 'h': '#ffe6f6', 'p': '#ff6ec0', 'v': '#c45cffa0', 'q': '#c45cff60'}
S['muzzle1'] = P.rows([
    '....q..........',
    '.....p...q.....',
    '..q..hp.p......',
    '...phWWhhp..q..',
    'qpphWWWWhhhpppq',
    '...phWWhhp..q..',
    '..q..hp.p......',
    '.....p...q.....',
    '....q..........',
], MUZZLE)
S['muzzle2'] = P.rows([
    '...............',
    '.....q.........',
    '......p..q.....',
    '....phhpp......',
    '..vphWWhhppq...',
    '....phhpp......',
    '......p..q.....',
    '.....q.........',
    '...............',
], MUZZLE)
# Where the beam's middle is from her chest: the muzzle a little ahead of her.
MUZZLE_AHEAD = 7
BEAM_OFFSET = [-(MUZZLE_AHEAD + BW // 2), -2]
# Her copies, oldest first (the recoil leaves them behind): the shot's hot pink, then the outfit's
# own colour, then that colour paled to a ghost's (orchid and lilac for the classic suit, red for
# Noire, teal for Odile, gold for the Comtesse).
SHOT_COLOURS = ['#ff5aa8', 'accent', 'accent.light']
SHOT_CHANCE = 0.35
SHOT_CHAIN = {'count': 3, 'every': 80}

# --------------------------------------------------------------------------- the grapple
# Drawn for a runner facing right: the hand at the bottom left, the line up ahead two rows for
# every column. A twisted steel cable, its claw, the gauntlet's flash at the wrist and the bite's
# at the claw in the outfit's colour; shot like a bullet, its leading stretch a pink tracer.
ROPE = {'c': '#ddd6ee', 'm': '#8f87a8', 'C': '#3a3346', 'S': '#f0ecfa', 's': '#a49cbc', 'k': '#4a4258',
        'W': '#ffffff', 'A': 'accent', 'a': 'accent.light'}
GW, GH = 33, 55
HAND = (3, 51)
FULL = 44
# The claw as it flies and holds (a grapnel: its hooks bent back to catch, the gauntlet's light in
# its head), spread wide as it bites, folded as it reels back in.
CLAW_FLY = [
    '...a...',
    '..SAS..',
    '.SSsSS.',
    'S..s..S',
    'S..k..S',
    '...k...',
]
CLAW_BITE = [
    '.a.....a.',
    '..S.a.S..',
    '.S.SAS.S.',
    'S..SsS..S',
    'S...s...S',
    '....k....',
    '....k....',
]
CLAW_SHUT = [
    '.a.',
    'SAS',
    'SsS',
    '.k.',
]


def cable(i):
    """The steel cable's i-th pixel: light, mid, dark, mid, a twist that reads on a pale sky and a
    night one."""
    return ROPE['cmCm'[i % 4]]


def rope_at(i):
    """The i-th pixel of the line from the hand."""
    return HAND[0] + i // 2, HAND[1] - i


def grapple(n, claw='open', flash=0, bite=False, glint=None, hot=False):
    """The line's first `n` pixels; `hot`: fired like a shot, its leading stretch a tracer."""
    g = blank(GW, GH)
    for i in range(n + 1):
        x, y = rope_at(i)
        g[y][x] = cable(i)
        lead = n - i
        if hot and lead < 12:
            g[y][x] = (SHOT['core'] if lead < 4 else SHOT['hot'] if lead < 8 else SHOT['glow'])
            if x + 1 < GW:
                g[y][x + 1] = SHOT['glow'] + alpha(0.5 - lead / 30)
    tx, ty = rope_at(n)
    pic = CLAW_BITE if bite else CLAW_FLY if claw == 'open' else CLAW_SHUT
    stamp(g, pic, ROPE, tx - len(pic[0]) // 2, ty - len(pic))
    if glint is not None:
        for i in (glint, glint + 1):
            x, y = rope_at(i)
            g[y][x] = ROPE['W']
    hx, hy = HAND
    if flash == 2:
        stamp(g, ['.a.a.', 'aAWAa', '.a.a.'], ROPE, hx - 2, hy - 1)
        g[hy - 2][hx] = ROPE['A']
        g[hy + 2][hx] = ROPE['A']
    elif flash == 1:
        stamp(g, ['.A.', 'AWA', '.A.'], ROPE, hx - 1, hy - 1)
    return g


S['hook1'] = P.grid(grapple(10, flash=2, hot=True))
S['hook2'] = P.grid(grapple(24, flash=1, hot=True))
S['hook3'] = P.grid(grapple(36, hot=True))
S['hook4'] = P.grid(grapple(FULL, bite=True))
S['hook5'] = P.grid(grapple(FULL, glint=12))
S['hook6'] = P.grid(grapple(FULL, glint=28))
S['hook7'] = P.grid(grapple(30, claw='shut'))
S['hook8'] = P.grid(grapple(16, claw='shut'))
S['hook9'] = P.grid(grapple(5, claw='shut'))
HOOK_FRAMES = [f'hook{i}' for i in range(1, 10)]
# Where the sprite's middle is from the hand (+x behind, as offsets go).
HOOK_OFFSET = [-(GW // 2 - HAND[0]), -(HAND[1] - GH // 2)]
# The runner's own flight (reference/notes/03-physics.md), so that the line keeps to her hand as
# she flies: gravity 8800 (261 px/s^2); a run jump's launch 3630 ahead and 4325 up, a tic-tac's
# 3759 and 4478 (about 172 px/s, 50 degrees up ahead).
FALL = 261
# Running up a wall she climbs faster than she went in: the line rises a little faster than that.
WALL_RISE = 100
FLIGHT = {'speed': 172, 'angle': 130, 'gravity': FALL, 'inherit': 0}

# ------------------------------------------------------------------------- venom: the gas
# Violet poison in round puffs, each lit from the upper front as a ball (pinkish lilac where the
# light falls, deep blue violet in the shade), see-through, their thin edges ragged; the
# underside glows toxic green (a bounce light in another hue) and green glints sparkle in it.
GAS = ['#f6dcff', '#d6a2f6', '#b06ae4', '#8644c6', '#5e2e9c']
# The toxic green: the underside's glow, the shade under the puffs, the glints.
BOUNCE = '#7ee0a0'
SHADE = '#4a7f88'
SPARK = '#e4ffa8'


def _hash(x, y, s):
    v = math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)


def _noise(x, y, s):
    """Smooth value noise (0..1)."""
    x0, y0 = math.floor(x), math.floor(y)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(x0, y0, s), _hash(x0 + 1, y0, s)
    c, d = _hash(x0, y0 + 1, s), _hash(x0 + 1, y0 + 1, s)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def gas(w, h, balls, fade=1.0, sparks=0, seed=1, swirl=0.0):
    """Puffs (x, y, r), the later ones in front: each pixel shaded as the front ball's surface, the
    shade under them and their underside going toxic green."""
    g = blank(w, h)
    for y in range(h):
        for x in range(w):
            px, py = x + 0.5, y + 0.5
            best = None
            for i, (cx, cy, r) in enumerate(balls):
                d2 = (px - cx) ** 2 + (py - cy) ** 2
                if d2 > r * r:
                    continue
                z = math.sqrt(r * r - d2)
                key = z + i * 0.6
                if best is None or key > best[0]:
                    best = (key, (px - cx) / r, (py - cy) / r, z / r)
            if best is None:
                continue
            _, nx, ny, nz = best
            # Noise eats into the thin edge.
            if nz < 0.45 and _noise(px / 2.2 + swirl, py / 2.2, seed) < 0.42 - nz * 0.6:
                continue
            lit = nx * L[0] + ny * L[1] + nz * L[2]
            k = 0 if lit > 0.9 else 1 if lit > 0.66 else 2 if lit > 0.36 else 3 if lit > 0.02 else 4
            col, a = GAS[k], (0.74 if nz > 0.5 else 0.52)
            if ny > 0.55 and nz < 0.55:
                col, a = BOUNCE, 0.66
            elif ny > 0.3 and k >= 3:
                col = SHADE
            g[y][x] = col + alpha(a * fade)
    rnd = random.Random(seed)
    cells = [(x, y) for y in range(h) for x in range(w) if g[y][x] and g[y][x][:7] in GAS[1:4]]
    for _ in range(sparks):
        if cells:
            x, y = rnd.choice(cells)
            g[y][x] = SPARK + alpha(fade)
    return g


# The cloud of a mine, 45 x 35: its foot on the bottom row, the mine in the middle of it.
VW, VH = 45, 35
VX, VY = 22.5, VH - 0.5
# Its puffs grown full, (x, height, radius): wide on the ground, billowing up to her hips.
CLOUD = [(-13, 4.5, 5.5), (12.5, 4.5, 5.8), (0, 6.5, 8.0), (-7, 12.5, 6.8), (7.5, 13.5, 6.4), (0.5, 20.0, 6.2),
         (-19, 2.5, 4.0), (19.5, 2.5, 3.8)]


def cloud(e, thin=0.0):
    """The cloud grown to `e` (0..1), thinning by `thin` (0..1) as it rises and fades."""
    k = 0.35 + 0.65 * e
    return [(VX + x * k, VY - y * (0.35 + 0.65 * e) - 5 * thin, r * (0.4 + 0.6 * e) * (1 - 0.4 * thin))
            for x, y, r in CLOUD]


MINE = {'k': '#1e1c26', 'b': '#3c3a48', 'B': '#6c6a7c', 'h': '#a8a6b8', 'c': '#5a46c8', 'C': '#9a86ff',
        'W': '#ffffff', 'g': '#a894ffb0', 'G': '#e0d8ff90'}
MINE_DIM = [
    '..........',
    '...kbBh...',
    '..kbcCcB..',
    '..kbbbbbk.',
    '.k.k...k.k',
    'k........k',
]
MINE_LIT = [
    '...gGGg...',
    '..gkbBhg..',
    'GgkCWWWCgG',
    '.gkbbbbbkg',
    '.k.k...k.k',
    'k........k',
]


def mine(lit):
    g = blank(VW, VH)
    stamp(g, MINE_LIT if lit else MINE_DIM, MINE, (VW - 10) // 2 + 1, VH - 6)
    return g


def pop():
    """The mine bursting: a white-violet flash, its rays tipped toxic green, over the first knot of gas."""
    g = gas(VW, VH, cloud(0.0), sparks=1, seed=11)
    cx, cy = VW // 2, VH - 4
    rays = ['#ffffff', '#ffffff', '#ffffffe0', '#f6dcffc0', '#d6a2f6a0', '#7ee0a0a0', '#7ee0a060', '#7ee0a040']
    for d, c in enumerate(rays):
        for dx, dy in ((d, 0), (-d, 0), (0, -d // 2)):
            g[cy + dy][cx + dx] = c
    for d, c in ((1, '#ffffffe0'), (2, '#f6dcffa0'), (3, '#7ee0a060')):
        for sx in (-1, 1):
            g[cy - d][cx + sx * d] = c
            g[cy + min(d, 1)][cx + sx * d] = c
    return g


S['mine0'] = P.grid(mine(False))
S['mine1'] = P.grid(mine(True))
S['pop'] = P.grid(pop())
# The cloud: (growth, thinning, opacity), at 12 frames a second.
CLOUD_SEQ = [(0.15, 0, 1), (0.36, 0, 1), (0.55, 0, 1), (0.7, 0, 1), (0.82, 0, 0.95), (0.9, 0, 0.92),
             (0.95, 0.1, 0.86), (0.98, 0.25, 0.78), (1.0, 0.4, 0.66), (1.0, 0.55, 0.52), (1.0, 0.7, 0.38),
             (1.0, 0.85, 0.24)]
for _i, (_e, _t, _f) in enumerate(CLOUD_SEQ):
    S[f'gas{_i + 1}'] = P.grid(gas(VW, VH, cloud(_e, _t), fade=_f, sparks=4 if _i < 9 else 1, seed=_i + 1,
                                   swirl=_i * 0.3))
GAS_FRAMES = [f'gas{i + 1}' for i in range(len(CLOUD_SEQ))]
VENOM_FRAMES = ['mine0', 'mine1', 'mine0', 'mine1', 'pop'] + GAS_FRAMES
# From the feet (on the ground) to the sprite's middle; the mine left a little behind her.
VENOM_OFFSET = [7, -(VH // 2) + 1]


# A wisp of venom, 13 x 8, curling at her feet by the start (her "perfume").
def wisp(e, fade):
    balls = [(3.5 + e, 5.0 - e, 2.2 + 0.8 * e), (6.5, 4.4 - 1.2 * e, 2.8 + 0.9 * e),
             (9.5 - 0.8 * e, 5.2 - 0.6 * e, 2.0 + 0.8 * e)]
    return gas(13, 8, balls, fade=fade, sparks=1 if e > 0.3 else 0, seed=int(e * 10) + 30, swirl=e)


S['wisp1'] = P.grid(wisp(0.0, 0.8))
S['wisp2'] = P.grid(wisp(0.5, 0.75))
S['wisp3'] = P.grid(wisp(1.0, 0.55))
WISP = ['wisp1', 'wisp2', 'wisp3']


# A puff of venom thrown off as she dissolves, 13 x 13.
def puff(e, fade):
    balls = [(6.5, 7.0 - e, 3.6 + 2.0 * e), (4.6 + e, 5.0 - e, 2.6 + 1.4 * e), (8.6 - e, 5.4 - e, 2.2 + 1.2 * e)]
    return gas(13, 13, balls, fade=fade, sparks=1 if e > 0.4 else 0, seed=int(e * 10) + 40, swirl=e)


S['puff1'] = P.grid(puff(0.0, 0.95))
S['puff2'] = P.grid(puff(0.5, 0.85))
S['puff3'] = P.grid(puff(1.0, 0.55))
PUFF = ['puff1', 'puff2', 'puff3']

# --------------------------------------------------------------------- the line she hangs on
# Hanging beside her by the start (she came down it): the twisted cable straight down from out of
# sight (its top fading into the sky) to a frayed end a little over the floor. Coming back, it
# drops from above first, then stays the same.
LW, LH = 3, 89


def line(n, fade_top=26, hot=False):
    """The line's first `n` pixels from the top; `hot`: dropping, its end a pink tracer."""
    g = blank(LW, LH)
    for y in range(min(n, LH - 1)):
        col = cable(y)
        a = min(1.0, (y + 1) / fade_top)
        lead = n - 1 - y
        if hot and lead < 8:
            col, a = (SHOT['core'] if lead < 3 else SHOT['hot'] if lead < 5 else SHOT['glow']), 1.0
            if lead < 5:
                g[y][0] = g[y][2] = SHOT['glow'] + alpha(0.5)
        g[y][1] = col + alpha(a)
    if n >= LH - 1:
        # The frayed end, a little to each side.
        g[LH - 2][1] = ROPE['C']
        g[LH - 1][0] = ROPE['c'] + alpha(0.6)
        g[LH - 1][2] = ROPE['C'] + alpha(0.8)
    return g


S['line'] = P.grid(line(LH))
for _i, _n in enumerate((20, 40, 60, 80)):
    S[f'drop{_i + 1}'] = P.grid(line(_n, hot=True))
DROP_FRAMES = ['drop1', 'drop2', 'drop3', 'drop4'] + ['line'] * 32
# Beside her, behind her shoulder, its end ten pixels over the floor.
LINE_OFFSET = [13, -(LH // 2) - 9]

# --------------------------------------------------------------------------- emitters
EMITTERS = {
    # --- kiss
    # Now and then as she runs, a kiss from her lips floats back and up, twinkling once.
    'kiss': {
        'while': ['run'], 'perSecond': 0.12, 'minSpeed': 40, 'anchor': 'head', 'offset': [-3, 3],
        'speed': [18, 26], 'angle': [35, 60], 'inherit': 0.3, 'drag': 1.1, 'gravity': -12, 'life': 1700,
        'fadeIn': 120, 'fadeOut': 700, 'flutter': {'amp': 1.5, 'freq': 1.3},
        'sprite': {'frames': KISS_FRAMES, 'fps': 5, 'loop': False}, 'face': True, 'max': 1,
        'layer': 'front', 'reduced': 0.5,
    },
    # Blown on some landings (tricks.py gives the chance): a little faster, higher.
    'kiss-land': {
        'enter': ['land'], 'burst': 1, 'anchor': 'head', 'offset': [-3, 3], 'speed': [26, 34],
        'angle': [55, 80], 'inherit': 0.3, 'drag': 1.2, 'gravity': -10, 'life': 1700, 'fadeIn': 80,
        'fadeOut': 700, 'flutter': {'amp': 1.5, 'freq': 1.3},
        'sprite': {'frames': KISS_FRAMES, 'fps': 5, 'loop': False}, 'face': True, 'max': 2, 'layer': 'front',
        'reduced': 1,
    },
    # --- grapple: from the gauntlet up ahead, on some wall moves and jumps (tricks.py: chances).
    # Running up a wall (move 33): the line climbs with her, its claw biting at the wall's top.
    'grapple': {
        'moves': [33], 'burst': 1, 'anchor': 'hand.far', 'offset': HOOK_OFFSET, 'speed': WALL_RISE,
        'angle': 90, 'inherit': 1, 'life': 420, 'fadeOut': 90, 'face': True,
        'sprite': {'frames': HOOK_FRAMES, 'fps': 22, 'loop': False}, 'max': 1, 'reduced': 1,
    },
    # Her tic-tac kick off a wall (move 20) and her jumps (18, 19): the line flies with her.
    'grapple-kick': {
        'moves': [20], 'burst': 1, 'anchor': 'hand.far', 'offset': HOOK_OFFSET, **FLIGHT, 'life': 420,
        'fadeOut': 90, 'face': True, 'sprite': {'frames': HOOK_FRAMES, 'fps': 22, 'loop': False}, 'max': 1,
        'reduced': 1,
    },
    'grapple-jump': {
        'moves': [18, 19], 'burst': 1, 'anchor': 'hand.far', 'offset': HOOK_OFFSET, **FLIGHT, 'life': 420,
        'fadeOut': 90, 'face': True, 'sprite': {'frames': HOOK_FRAMES, 'fps': 22, 'loop': False}, 'max': 1,
        'reduced': 1,
    },
    # --- venom: the mine left behind on some rolls and hard landings (moves 24 and 25: on the ground;
    # a plain landing starts in the air); it stays where it fell, blinks, pops and its cloud thins out.
    'mine': {
        'enter': ['roll'], 'moves': [24, 25], 'burst': 1, 'anchor': 'feet', 'offset': VENOM_OFFSET,
        'speed': 0, 'inherit': 0, 'life': 1600, 'fadeOut': 260, 'face': True,
        'sprite': {'frames': VENOM_FRAMES, 'fps': 12, 'loop': False}, 'max': 2, 'reduced': 1,
    },
    # --- the spectral shot: these come only with her copies (the snapshot's `burst`).
    # The tracer, left in the air where she fired, burning out.
    'shot-beam': {
        'burst': 1, 'anchor': 'chest', 'offset': BEAM_OFFSET, 'speed': 0, 'inherit': 0, 'life': 300,
        'fadeOut': 120, 'face': True, 'sprite': {'frames': BEAM_FRAMES, 'fps': 13, 'loop': False},
    },
    # The bullet streaking on ahead.
    'shot-bolt': {
        'burst': 1, 'anchor': 'chest', 'offset': [-(MUZZLE_AHEAD + 12), -2], 'speed': 900, 'angle': 180,
        'inherit': 0, 'life': 170, 'fadeOut': 60, 'face': True, 'sprite': {'frames': ['bolt']}, 'blend': 'add',
    },
    # The muzzle's flash, keeping up with her a moment.
    'shot-flash': {
        'burst': 1, 'anchor': 'chest', 'offset': [-(MUZZLE_AHEAD + 4), -2], 'speed': 0, 'inherit': 1, 'life': 140,
        'fadeOut': 40, 'face': True, 'sprite': {'frames': ['muzzle1', 'muzzle2'], 'fps': 18, 'loop': False},
        'blend': 'add', 'layer': 'front',
    },
    # Her visor's lens glints as she takes aim.
    'shot-glint': {
        'burst': 1, 'anchor': 'head', 'offset': [-3, -3], 'speed': 0, 'inherit': 0.5, 'life': 300,
        'fadeOut': 60, 'sprite': {'frames': GLINT_FRAMES, 'fps': 20, 'loop': False}, 'layer': 'front',
    },
    # --- presence
    # By the start: the line she came down, hanging beside her (always there: three copies of it on
    # top of each other living for different times, each made again as soon as it goes, so one
    # always shows; each fades in over a third of a second, so that coming back the line drops
    # first), her visor glinting now and then, venom curling at her feet.
    'idle-line': {
        'perSecond': 40, 'anchor': 'feet', 'offset': LINE_OFFSET, 'speed': 0, 'life': [900, 2600],
        'fadeIn': 350, 'fadeOut': 300, 'face': True, 'sprite': {'frames': ['line']}, 'max': 3,
    },
    'idle-glint': {
        'perSecond': 0.4, 'anchor': 'feet', 'offset': [-2, -51], 'speed': 0, 'life': 300, 'fadeOut': 60,
        'face': True, 'sprite': {'frames': GLINT_FRAMES, 'fps': 20, 'loop': False}, 'layer': 'front',
        'max': 1,
    },
    'idle-wisp': {
        'perSecond': 0.9, 'anchor': 'feet', 'offset': [0, -3], 'jitter': [10, 1], 'speed': [3, 6],
        'angle': [0, 180], 'gravity': -3, 'life': [1400, 1900], 'fadeIn': 400, 'fadeOut': 700, 'face': True,
        'sprite': {'frames': WISP, 'fps': 2, 'loop': False}, 'max': 4,
    },
    # Leaving: a kiss stays in the air where her lips were and floats away; she dissolves into a
    # burst of venom (its cloud behind her, puffs thrown off round her).
    'vanish-kiss': {
        'burst': 1, 'anchor': 'head', 'offset': [-2, 1], 'speed': [10, 12], 'angle': [70, 80],
        'gravity': -8, 'drag': 0.6, 'life': 2000, 'fadeIn': 60, 'fadeOut': 800, 'flutter': {'amp': 1.5, 'freq': 1},
        'sprite': {'frames': KISS_FRAMES, 'fps': 5, 'loop': False}, 'face': True, 'layer': 'front',
        'reduced': 1,
    },
    'vanish-gas': {
        'burst': 1, 'anchor': 'feet', 'offset': [0, -(VH // 2) + 1], 'speed': 0, 'life': 1100,
        'fadeOut': 260, 'face': True, 'sprite': {'frames': ['pop'] + GAS_FRAMES, 'fps': 12, 'loop': False},
        'reduced': 1,
    },
    'vanish-puff': {
        'burst': [5, 7], 'anchor': 'body', 'jitter': [4, 3], 'speed': [14, 30], 'angle': [0, 180],
        'drag': 1.8, 'gravity': -10, 'life': [700, 1000], 'fadeOut': 400, 'face': True,
        'sprite': {'frames': PUFF, 'fps': 4, 'loop': False}, 'layer': 'front', 'reduced': 0.3,
    },
    # Coming back: a line drops from above beside her, she comes down it, her visor glints.
    'appear-line': {
        'burst': 1, 'anchor': 'feet', 'offset': LINE_OFFSET, 'speed': 0, 'life': 1500, 'fadeOut': 250,
        'face': True, 'sprite': {'frames': DROP_FRAMES, 'fps': 24, 'loop': False}, 'reduced': 1,
    },
    'appear-glint': {
        'burst': 1, 'anchor': 'feet', 'offset': [-2, -51], 'speed': 0, 'life': 700, 'fadeOut': 60,
        'face': True, 'sprite': {'frames': ['none'] * 8 + GLINT_FRAMES, 'fps': 20, 'loop': False},
        'layer': 'front', 'reduced': 1,
    },
    'appear-wisp': {
        'burst': [2, 3], 'anchor': 'feet', 'offset': [0, -3], 'jitter': [8, 1], 'speed': [6, 12],
        'angle': [0, 180], 'drag': 1.5, 'gravity': -4, 'life': [1000, 1300], 'fadeIn': 300, 'fadeOut': 600,
        'face': True, 'sprite': {'frames': WISP, 'fps': 3, 'loop': False}, 'reduced': 0.5,
    },
}

fx = {
    'palette': P.pal,
    'sprites': S,
    'emitters': EMITTERS,
    'variants': {
        # Widow's Kiss, her kiss and her rifle's: a kiss now and then and on some landings, and on a
        # third of her flips and vaults the spectral shot (a tracer far ahead, the muzzle's flash, her
        # visor's glint, three copies of her left behind by the recoil).
        'kiss': {
            'emitters': ['kiss', 'kiss-land'],
            'afterimage': {'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': SHOT_CHANCE, 'repeat': SHOT_CHAIN,
                           'colors': SHOT_COLOURS, 'textured': True, 'scanlines': True,
                           'burst': ['shot-beam', 'shot-bolt', 'shot-flash', 'shot-glint'], 'life': 400,
                           'drift': [60, 0], 'alpha': 0.75},
        },
        # The grappling hook on some wall moves and jumps.
        'grapple': {'emitters': ['grapple', 'grapple-kick', 'grapple-jump']},
        # A Venom Mine on some rolls and hard landings.
        'venom': {'emitters': ['mine']},
    },
    'presence': {'idle': ['idle-line', 'idle-glint', 'idle-wisp'],
                 'vanish': ['vanish-gas', 'vanish-puff', 'vanish-kiss'],
                 'appear': ['appear-line', 'appear-wisp', 'appear-glint']},
}


def write():
    write_json(BOSSES + '/widow/fx.json', tricks(fx, 'widow'))
    # The variants she wears, in step with the file (only `effect` is written in boss.json).
    path = BOSSES + '/widow/boss.json'
    with open(path, encoding='utf-8') as f:
        boss = json.load(f)
    if boss.get('effect') != EFFECT:
        boss['effect'] = EFFECT
        write_json(path, boss)


if __name__ == '__main__':
    write()
    print('widow fx written')
