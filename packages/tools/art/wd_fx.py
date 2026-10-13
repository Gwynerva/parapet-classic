"""Widow's effect (fx.json): Widowmaker's kit, the femme fatale's: flashier than the other bosses'
on her tricks, quiet on the run (only, now and then, a kiss).

* kiss (the effect's name, "Widow's Kiss": her rifle's and her own, the emote and the "Bisous"):
  - the spectral shot, on about a third of her flips and vaults, in two beats, both the way she is
    going (off a wall, the way she leaps from it), not the way she faces:
    - the aim, from the trick's start: her scope's red reticle closes in on a point ahead of her
      and locks into a crosshair, while motes of pink light are drawn in to her heart (the charge
      of a scoped shot); both keep up with her, taken again from where she is in three beats;
    - the shot, 0.33 s in, mid-air: the reticle flashes white as her visor's lens glints, the
      muzzle flashes in a ring of light and a spray of sparks, a charged shot's tracer 128 px long
      (a white-hot core in a pink glow in a violet haze) hangs where she fired and burns out from
      the outside in, the bullet streaks on, and the recoil leaves three spectral copies of her
      along her way (hot pink, then the outfit's colour, then that colour paled; hologram
      scanlines), one every 70 ms, rising a little and fading in 0.4 s;
  - now and then as she runs (about one every eight seconds) a lipstick kiss in plum leaves her
    lips and floats back and up, twinkling once; one landing in ten she blows one too.
* grapple: on about half of her runs up a wall (only there has it a wall to bite) her grappling
  hook is shot from the gauntlet like a bullet: a twisted steel line flies up ahead of her, its
  leading stretch a pink tracer, a flash at the wrist in the outfit's colour (`accent`, the
  gauntlet's light), the grapnel bites the wall's top (another flash), the line holds taut a moment
  with a glint running up it, then reels back in; 0.4 s, behind her, climbing with her.
* venom: on about two rolls and hard landings in five she drops her Venom Mine just behind her
  heels (a small dark spider of a device, a violet glow in its belly, a red light on its back): it
  skids a little, blinks twice and bursts, and its poison spills back along the floor the way she
  came, fast, braking hard, its front rolling over; tendrils of violet mist rise out of it one after
  another, lean back and curl over into volutes (a toxic green underside, green glints), then fray
  and fade where it fell ("A deadly fragrance"). One picture, so the mine and its poison always come
  together; behind her, never over her.
* presence: by the start (and where she waits at the end) the line she came down hangs beside
  her, her visor glints now and then, and wisps of venom curl at her feet; leaving, she blows a
  kiss (it stays in the air where her lips were and floats away) and dissolves into a burst of
  venom; coming back, a line drops from above and she comes down it, her visor glinting as she
  arrives.

Reduced motion keeps the kisses (the running ones half as often), the hook, the mine and its spill,
and at the start and the goal the kiss, the cloud, the line and the glint; the spectral
shot is off (the engine takes no snapshots then: its aim and shot come only with them), and so is
the haze by the start (the engine draws none).

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
            + ''.join(chr(c) for c in range(0x3b1, 0x3ca)) + ''.join(chr(c) for c in range(0x430, 0x450))
            + ''.join(chr(c) for c in range(0x391, 0x3aa) if c != 0x3a2) + ''.join(chr(c) for c in range(0x410, 0x430))
            + ''.join(chr(c) for c in range(0xc0, 0x100) if c not in (0xd7, 0xf7)))

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
# Widow's Kiss fired mid-air: drawn for a runner going right, from the muzzle ahead.
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
SHOT_CHAIN = {'count': 3, 'every': 70}
# The aim: from the trick's start (and a breath more, so that the way she is going is known) to the
# shot, mid-air in every trick she takes it on (a flip lasts 0.7-0.8 s, a vault 0.5 s).
AIM_FROM = 60
SHOT_AT = 330

# ----------------------------------------------------------------------------------- the aim
# Her scope's reticle, as on her "Scope" spray: a red ring broken at the four quarters, ticks in
# the gaps, a diamond at its heart. It closes in on a point ahead of her, the way she will fire,
# locks (the ticks grown into a crosshair) and flashes white as she fires through it.
RETICLE = {'R': '#ff3048', 'r': '#ff3048a0', 'q': '#ff304860', 'T': '#ff8a9c', 'W': '#ffffff',
           'P': '#ffc8d4'}
RS = 27


def reticle(r, fade=1.0, lock=False, flash=False):
    g = blank(RS, RS)
    c = RS // 2
    ring = RETICLE['W'] if flash else RETICLE['R']
    for i in range(720):
        a = math.radians(i / 2)
        x, y = round(c + r * math.cos(a)), round(c - r * math.sin(a))
        # Broken at the quarters.
        if min(abs(x - c), abs(y - c)) <= max(1, r // 4):
            continue
        g[y][x] = ring + alpha(fade)
    # Ticks in the gaps, pointing in; grown into a crosshair once it locks.
    inner, outer = (r - 2, r + 5) if lock else (r - 1, r + 1)
    for d in range(inner, outer + 1):
        col = RETICLE['P'] if (flash or d <= r) else RETICLE['T']
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            if 0 <= c + dx < RS and 0 <= c + dy < RS:
                g[c + dy][c + dx] = col + alpha(fade * (1.0 if d <= r + 2 else 0.6))
    # The heart: a dot, a diamond once locked.
    g[c][c] = RETICLE['W'] + alpha(fade)
    if lock:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            g[c + dy][c + dx] = (RETICLE['W'] if flash else RETICLE['R']) + alpha(fade)
    return g


for _i, (_r, _f) in enumerate(((13, 0.6), (11, 0.8), (9, 0.9), (7, 1.0))):
    S[f'aim{_i + 1}'] = P.grid(reticle(_r, _f))
S['lock'] = P.grid(reticle(5, 1.0, lock=True))
S['lock-fire'] = P.grid(reticle(5, 1.0, lock=True, flash=True))
S['lock-out'] = P.grid(reticle(6, 0.5, lock=True))
# The aim in three beats, each taken again from where she is by then (a sniper keeps her mark as
# she flies): the ring closing in, closing in, locked; it flashes as she fires through it, at
# SHOT_AT. (delay, frames, ms a frame)
AIM_BEATS = [(AIM_FROM, ['aim1', 'aim2'], 55), (AIM_FROM + 110, ['aim3', 'aim4'], 50),
             (SHOT_AT - 60, ['lock', 'lock', 'lock-fire', 'lock-fire', 'lock-out', 'lock-out'], 30)]

# Her charge gathering as she aims (her rifle's scoped shot charges): eight motes of pink light on
# a ring round her, drawn in, a trail behind each, till they meet at her heart.
CHARGE = {'W': '#ffffff', 'h': '#ffe6f6', 'p': '#ff6ec0', 'v': '#c45cff'}
CS = 37


def charge(r, turn):
    g = blank(CS, CS)
    c = CS // 2
    if r <= 0:
        for dx, dy, k in ((0, 0, 'W'), (1, 0, 'h'), (-1, 0, 'h'), (0, 1, 'h'), (0, -1, 'h'), (2, 0, 'p'),
                          (-2, 0, 'p'), (0, 2, 'p'), (0, -2, 'p')):
            g[c + dy][c + dx] = CHARGE[k]
        return g
    for k in range(8):
        a = 2 * math.pi * (k / 8 + turn)
        for j, col in ((0, 'W'), (0.6, 'W'), (1.3, 'h'), (2.4, 'p'), (3.6, 'p'), (4.8, 'v')):
            rr = r + j
            x, y = round(c + rr * math.cos(a)), round(c - rr * math.sin(a))
            if 0 <= x < CS and 0 <= y < CS and g[y][x] is None:
                g[y][x] = CHARGE[col] + ('' if j < 2 else alpha(0.85 - j * 0.1))
    return g


for _i, (_r, _t) in enumerate(((16, 0.0), (13, 0.02), (10, 0.04), (7, 0.06), (4, 0.08), (0, 0))):
    S[f'charge{_i + 1}'] = P.grid(charge(_r, _t))
# The charge in the same three beats.
CHARGE_BEATS = [(AIM_FROM, ['charge1', 'charge2'], 55), (AIM_FROM + 110, ['charge3', 'charge4'], 50),
                (SHOT_AT - 60, ['charge5', 'charge5', 'charge6'], 30)]

# As she fires: a ring of the shot's light bursting round the muzzle.
def burst_ring(r, fade):
    g = blank(19, 19)
    c = 9
    for i in range(360):
        a = math.radians(i)
        x, y = round(c + r * math.cos(a)), round(c - r * math.sin(a))
        g[y][x] = (SHOT['hot'] if r < 5 else SHOT['glow']) + alpha(fade)
    return g


S['ring1'] = P.grid(burst_ring(3, 1.0))
S['ring2'] = P.grid(burst_ring(5, 0.85))
S['ring3'] = P.grid(burst_ring(7, 0.6))
S['ring4'] = P.grid(burst_ring(8.5, 0.35))
RING_FRAMES = ['ring1', 'ring2', 'ring3', 'ring4']
# The point she aims at, ahead of her chest on the tracer's line.
AIM_AHEAD = 62

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
# Running up a wall she climbs faster than she went in: the line rises a little faster than that.
WALL_RISE = 100
# The runner's own gravity (reference/notes/03-physics.md: 8800, 261 px/s^2): what keeps up with
# her in the air (the reticle, her charge) falls with her.
FALL = 261

# ------------------------------------------------------------- venom by the start and leaving
# Violet poison in round puffs (her presence's: the wisps at her feet, the cloud she leaves in),
# each lit from the upper front as a ball (pinkish lilac where the
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


# The cloud she leaves in (presence), 45 x 35: its foot on the bottom row.
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


def pop():
    """A burst of venom: a white-violet flash, its rays tipped toxic green, over the first knot of gas."""
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


S['pop'] = P.grid(pop())
# The cloud: (growth, thinning, opacity), at 12 frames a second.
CLOUD_SEQ = [(0.15, 0, 1), (0.36, 0, 1), (0.55, 0, 1), (0.7, 0, 1), (0.82, 0, 0.95), (0.9, 0, 0.92),
             (0.95, 0.1, 0.86), (0.98, 0.25, 0.78), (1.0, 0.4, 0.66), (1.0, 0.55, 0.52), (1.0, 0.7, 0.38),
             (1.0, 0.85, 0.24)]
for _i, (_e, _t, _f) in enumerate(CLOUD_SEQ):
    S[f'gas{_i + 1}'] = P.grid(gas(VW, VH, cloud(_e, _t), fade=_f, sparks=4 if _i < 9 else 1, seed=_i + 1,
                                   swirl=_i * 0.3))
GAS_FRAMES = [f'gas{i + 1}' for i in range(len(CLOUD_SEQ))]

# ------------------------------------------------------------------- venom: the mine's spill
# Her Venom Mine on a roll or a hard landing, one picture of 22 frames (all of it in one burst, so
# the mine and its poison always come together), drawn for a runner going right: the spill runs
# left, behind her.
# - The mine (her official one, small): a dark spider of a device on four hooked legs, a violet
#   glow in its belly, a red light on its back; it lands where she touched down and blinks twice.
# - It bursts (a white-violet flash) and its poison spills out along the floor, back the way she
#   came: a low fog racing out, fast, then braking hard, its front rolling over into a volute.
# - Out of it tendrils rise one after another, lean back and curl over (each unrolls from the
#   ground up: a swirl opening into a volute), lit from the upper front, a toxic green underside,
#   green glints in it; the fog creeps on a little.
# - Then it all frays (in tatters) and fades where it fell, the mine dimming with it.
# What Vera's wind taught it (vr_fx.py): strokes along curves that draw themselves in windows, a
# bright head leading them, an edge of another colour under them, tatters as they go; but poison is
# heavy: it hugs the ground, rises slowly and curls over instead of whipping past.
SW, SH = 90, 46
SRC = 78          # the mine's middle
SGY = SH - 1      # the ground (the mine's feet)
MIST = {'hi': '#ecc8ff', 'body': '#b06ae6', 'shade': '#7c40c4', 'under': '#6fd496', 'haze': '#b880ec',
        'head': '#fbeeff'}
MIST_LIGHT = _unit((0.6, -0.8))
MINE = {'k': '#16141c', 'b': '#3a3846', 'B': '#4c4a5a', 'h': '#8a889c', 'v': '#6a3ec8', 'V': '#a070ff',
        'W': '#e8dcff', 'R': '#ff3b3b', 'r': '#6a1a22', 'q': '#ff3b3b70'}
MINE_ON = ['....qRq....', '...kBhhk...', '..kbBBBhk..', '..kvVWVvk..', '.h.kbbbk.h.', 'b..b...b..b']
MINE_OFF = ['.....r.....', '...kBhhk...', '..kbBBBhk..', '..kvVVVvk..', '.h.kbbbk.h.', 'b..b...b..b']


def path(x0, y0, theta0, length, turn, power, wobble=0.0, waves=0.0, step=0.25):
    """Points along a whiplash from (x0, y0): heading theta0 (degrees, 0 right, 90 up), turning by
    `turn` along it, most of the turn at its end (a volute); `wobble` waves its heading."""
    pts, x, y = [], x0, y0
    n = max(2, int(length / step))
    for i in range(n + 1):
        u = i / n
        th = math.radians(theta0 + turn * u ** power + wobble * math.sin(u * waves * 2 * math.pi) * (1 - u))
        pts.append((x, y))
        x += math.cos(th) * step
        y -= math.sin(th) * step
    return pts


class Mist:
    """Mist drawn as dabs along curves, each pixel shaded by the front dab: lit on its upper front
    side, shaded on the other, a toxic green underside, a haze round it, a light head."""

    def __init__(self):
        self.best = blank(SW, SH)

    def dab(self, cx, cy, r, f, kind, order, head):
        rr = r + 1.2
        for y in range(int(cy - rr - 1), int(cy + rr + 2)):
            for x in range(int(cx - rr - 1), int(cx + rr + 2)):
                if not (0 <= x < SW and 0 <= y < SH):
                    continue
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d = math.hypot(dx, dy)
                if d > rr:
                    continue
                inside = d <= r
                depth = (1 - d / rr) + (1.0 if inside else 0) + order * 0.001
                lit = (dx * MIST_LIGHT[0] + dy * MIST_LIGHT[1]) / max(r, 0.6)
                cur = self.best[y][x]
                if cur is None or depth > cur[0]:
                    self.best[y][x] = (depth, lit if inside else None, f, kind, dy / max(r, 0.6), head)

    def stroke(self, pts, width, f, kind, order, lo=0.0, hi=1.0, torn=False):
        """The part lo..hi of a curve (it unrolls: its head leads, light); torn: in tatters."""
        n = len(pts) - 1
        i0, i1 = int(lo * n), int(hi * n)
        for i in range(i0, i1 + 1):
            if torn and (i // 6) % 3 == 2:
                continue
            u = i / n
            r = width(u)
            if r > 0.25:
                self.dab(pts[i][0], pts[i][1], r, f, kind, order + u, i1 - i < 3 and hi < 0.999)

    def grid(self):
        g = blank(SW, SH)
        for y in range(SH):
            for x in range(SW):
                b = self.best[y][x]
                if b is None:
                    continue
                _, lit, f, kind, down, head = b
                if lit is None:
                    g[y][x] = MIST['haze'] + alpha(0.22 * f)
                elif head and lit > -0.2:
                    g[y][x] = MIST['head'] + alpha(0.9 * f)
                elif lit > (0.6 if kind == 'fog' else 0.4):
                    g[y][x] = MIST['hi'] + alpha(0.8 * f)
                elif down > 0.45 and kind == 'fog':
                    g[y][x] = MIST['under'] + alpha(0.75 * f)
                elif lit < -0.45:
                    g[y][x] = (MIST['under'] if kind == 'curl' and down > 0.5 else MIST['shade']) + alpha(0.62 * f)
                else:
                    g[y][x] = MIST['body'] + alpha((0.6 if kind == 'fog' else 0.68) * f)
        return g


# The fog along the floor (and a thinner roll over it), its front a volute; the tendrils rising out of
# it, (curve, width at the root, frame it starts in).
FOG = path(SRC - 3, SGY - 2.4, 180, 64, -330, 7, wobble=5, waves=2.2)
FOG2 = path(SRC - 6, SGY - 4.0, 181, 44, -310, 6, wobble=7, waves=1.6)
TENDRILS = [(path(SRC - 14, SGY - 2, 97, 21, 430, 3.8), 2.2, 6), (path(SRC - 28, SGY - 2, 102, 30, 450, 4.0), 2.5, 7),
            (path(SRC - 42, SGY - 2, 99, 19, 410, 3.8), 2.0, 8), (path(SRC - 54, SGY - 2, 106, 12, 370, 3.5), 1.6, 9)]
# How far along the floor the fog's head has run, frame by frame from the burst: fast, braking hard.
SPILL_RUN = [0.12, 0.42, 0.66, 0.8, 0.88, 0.93, 0.96, 0.98, 1.0]
SPILL_FRAMES_N = 22
# Quick: the mine is down and burst in a quarter of a second, the curls up in the next half (she
# runs on: the spill must be seen while it is still near her).
SPILL_FPS = 15
BURST_AT = 4


def _ease(x):
    return 1 - (1 - min(1.0, max(0.0, x))) ** 2.2


def spill(k):
    m = Mist()
    fade = 1.0 if k < 15 else max(0.0, 1 - (k - 14) / 7.5)
    torn = k >= 16
    if k >= BURST_AT:
        s = k - BURST_AT
        thick = 3.0 if s < 4 else max(1.1, 3.0 - (s - 3) * 0.14)
        hi = SPILL_RUN[min(s, len(SPILL_RUN) - 1)]
        lo = 0.0 if s < 9 else min(0.8, (s - 8) * 0.08)
        m.stroke(FOG, lambda u: thick * (1 - 0.5 * u) * (0.9 + 0.15 * math.sin(u * 13 + s)) + 0.25, fade, 'fog', 0,
                 lo, hi, torn)
        m.stroke(FOG2, lambda u: thick * 0.7 * (1 - 0.5 * u) + 0.2, fade * 0.85, 'fog', 1, lo, hi * 0.97, torn)
        for j, (pts, w0, born) in enumerate(TENDRILS):
            if k < born:
                continue
            c = k - born
            hi_c = _ease(c / 7.0)
            lo_c = 0.0 if c < 8 else min(0.8, (c - 7) * 0.11)
            w = w0 if c < 7 else max(0.7, w0 - (c - 6) * 0.15)
            if hi_c - lo_c > 0.04:
                m.stroke(pts, lambda u, w=w: w * (1 - u) ** 0.9 + 0.3, fade, 'curl', 2 + j, lo_c, hi_c, torn)
    g = m.grid()
    # The mine: lands (a pixel high in its first frame), blinks twice, bursts, dims with the rest.
    if k < BURST_AT:
        stamp(g, MINE_ON if k in (1, 3) else MINE_OFF, MINE, SRC - 5, SGY - 5 - (1 if k == 0 else 0))
    else:
        mine_fade = [[(MINE[c] if len(MINE[c]) == 7 else MINE[c][:7]) + alpha(fade * (int(MINE[c][7:], 16) / 255
                                                                               if len(MINE[c]) == 9 else 1.0))
                      if c != '.' else None for c in r] for r in MINE_OFF]
        for y, r in enumerate(mine_fade):
            for x, c in enumerate(r):
                if c:
                    g[SGY - 5 + y][SRC - 5 + x] = c
    if k == BURST_AT:
        for d, c in enumerate(['#ffffff', '#ffffff', '#f6dcffd0', '#d6a2f6a0', '#7ee0a080', '#7ee0a040']):
            for dx, dy in ((d, 0), (-d, 0), (0, -d)):
                if 0 <= SRC + dx < SW:
                    g[SGY - 3 + dy][SRC + dx] = c
    rnd = random.Random(k)
    cells = [(x, y) for y in range(SH) for x in range(SW) if g[y][x] and g[y][x][:7] in (MIST['body'], MIST['shade'])]
    for _ in range(3 if BURST_AT <= k < 15 else 1 if k < 18 else 0):
        if cells:
            x, y = rnd.choice(cells)
            g[y][x] = SPARK
    return g


_spill = [spill(k) for k in range(SPILL_FRAMES_N)]
# Cropped to what any frame uses, the same for all (so the picture stays put).
_ys = [y for g in _spill for y in range(SH) if any(g[y])]
_xs = [x for g in _spill for row in g for x, c in enumerate(row) if c]
_y0, _x0, _x1 = min(_ys), min(_xs), max(_xs)
for _k, _g in enumerate(_spill):
    S[f'spill{_k + 1}'] = P.grid([row[_x0:_x1 + 1] for row in _g[_y0:]])
SPILL_FRAMES = [f'spill{k + 1}' for k in range(SPILL_FRAMES_N)]
# From her feet (on the ground) to the picture's middle: the mine dropped just behind her heels, where
# her body does not hide it.
_cw, _ch = _x1 + 1 - _x0, SH - _y0
SPILL_OFFSET = [(SRC - _x0) - _cw // 2 + 9, -(_ch // 2) + 1]


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
    # --- grapple: only running up a wall (move 33), where it has something to bite: from the
    # gauntlet up ahead, the line climbs with her, its claw biting at the wall's top (tricks.py: the
    # chance).
    'grapple': {
        'moves': [33], 'burst': 1, 'anchor': 'hand.far', 'offset': HOOK_OFFSET, 'speed': WALL_RISE,
        'angle': 90, 'inherit': 1, 'life': 420, 'fadeOut': 90, 'face': True,
        'sprite': {'frames': HOOK_FRAMES, 'fps': 22, 'loop': False}, 'max': 1, 'reduced': 1,
    },
    # --- venom: her Venom Mine on some rolls and hard landings (moves 24 and 25: on the ground; a
    # plain landing starts in the air) where she touched down, and its spill behind her, the way she
    # is going (not the way she faces); one particle, so the mine and its poison come together
    # (tricks.py: the chance). Dropped as she goes, the mine skids on a little after her (its share
    # of her speed, braking hard) and stops as it bursts.
    'venom': {
        'enter': ['roll'], 'moves': [24, 25], 'burst': 1, 'toward': 'motion', 'anchor': 'feet',
        'offset': SPILL_OFFSET, 'speed': 0, 'inherit': 0.35, 'drag': 4,
        'life': round(SPILL_FRAMES_N * 1000 / SPILL_FPS),
        'fadeOut': 80, 'face': True, 'sprite': {'frames': SPILL_FRAMES, 'fps': SPILL_FPS, 'loop': False}, 'max': 2,
        'reduced': 1,
    },
    # --- the spectral shot: these come only with her copies (the snapshot's `burst`), all sided
    # with the way she is going (off a wall, the way she leaps from it), in two beats: the aim (its
    # emitters are made below, from AIM_BEATS and CHARGE_BEATS), then the shot.
    # The shot, when the aim is done (mid-air): her visor's lens glints, the muzzle flashes in a
    # ring of light and a spray of sparks, the tracer hangs where she fired and burns out, the
    # bullet streaks on; the recoil copies come with the snapshot's own delay.
    'shot-glint': {
        'burst': 1, 'delay': SHOT_AT, 'anchor': 'head', 'offset': [-3, -3], 'speed': 0, 'inherit': 0.5,
        'life': 300, 'fadeOut': 60, 'sprite': {'frames': GLINT_FRAMES, 'fps': 20, 'loop': False},
        'layer': 'front',
    },
    'shot-flash': {
        'burst': 1, 'delay': SHOT_AT, 'toward': 'motion', 'anchor': 'chest', 'offset': [-(MUZZLE_AHEAD + 4), -2],
        'speed': 0, 'inherit': 1, 'life': 140, 'fadeOut': 40, 'face': True,
        'sprite': {'frames': ['muzzle1', 'muzzle2'], 'fps': 18, 'loop': False}, 'blend': 'add', 'layer': 'front',
    },
    'shot-ring': {
        'burst': 1, 'delay': SHOT_AT, 'toward': 'motion', 'anchor': 'chest', 'offset': [-MUZZLE_AHEAD, -2],
        'speed': 0, 'inherit': 0.5, 'life': 180, 'fadeOut': 60, 'face': True,
        'sprite': {'frames': RING_FRAMES, 'fps': 22, 'loop': False}, 'blend': 'add',
    },
    'shot-sparks': {
        'burst': [9, 12], 'delay': SHOT_AT, 'toward': 'motion', 'anchor': 'chest', 'offset': [-MUZZLE_AHEAD, -2],
        'speed': [70, 190], 'angle': [158, 202], 'inherit': 0.4, 'drag': 4, 'life': [140, 300], 'fadeOut': 120,
        'rect': {'size': 1, 'colors': [SHOT['core'], SHOT['hot'], SHOT['glow']]}, 'blend': 'add',
    },
    'shot-beam': {
        'burst': 1, 'delay': SHOT_AT, 'toward': 'motion', 'anchor': 'chest', 'offset': BEAM_OFFSET, 'speed': 0,
        'inherit': 0, 'life': 320, 'fadeOut': 130, 'face': True,
        'sprite': {'frames': BEAM_FRAMES, 'fps': 13, 'loop': False},
    },
    'shot-bolt': {
        'burst': 1, 'delay': SHOT_AT, 'toward': 'motion', 'anchor': 'chest', 'offset': [-(MUZZLE_AHEAD + 12), -2],
        'speed': 900, 'angle': 180, 'inherit': 0, 'life': 170, 'fadeOut': 60, 'face': True,
        'sprite': {'frames': ['bolt']}, 'blend': 'add',
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

# The aim's beats (see AIM_BEATS): each a particle of its own, from where she is by then, keeping
# up with her (her speed, her gravity) till the next.
for _n, _beats, _extra in (('aim-reticle', AIM_BEATS, {'offset': [-AIM_AHEAD, -2], 'layer': 'front'}),
                           ('aim-charge', CHARGE_BEATS, {'offset': [0, -2], 'blend': 'add'})):
    for _k, (_d, _frames, _ms) in enumerate(_beats):
        EMITTERS[f'{_n}{_k + 1}'] = {
            'burst': 1, 'delay': _d, 'toward': 'motion', 'anchor': 'chest', 'speed': 0, 'inherit': 1,
            # Each beat lasts a step longer than its frames, so that no gap opens between them.
            'gravity': FALL, 'life': _ms * len(_frames) + (30 if _k < len(_beats) - 1 else 0),
            'fadeIn': 40 if _k == 0 else 0,
            'fadeOut': 60 if _k == len(_beats) - 1 else 0, 'face': True,
            'sprite': {'frames': _frames, 'fps': round(1000 / _ms, 2), 'loop': False}, **_extra,
        }
AIM_EMITTERS = [f'{n}{k + 1}' for n in ('aim-reticle', 'aim-charge') for k in range(3)]

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
            'afterimage': {'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': SHOT_CHANCE, 'delay': SHOT_AT,
                           'repeat': SHOT_CHAIN, 'colors': SHOT_COLOURS, 'textured': True, 'scanlines': True,
                           'burst': AIM_EMITTERS + ['shot-glint', 'shot-flash', 'shot-ring', 'shot-sparks',
                                                    'shot-beam', 'shot-bolt'],
                           'life': 420, 'drift': [0, -8], 'alpha': 0.75},
        },
        # The grappling hook on some wall moves and jumps.
        'grapple': {'emitters': ['grapple']},
        # A Venom Mine on some rolls and hard landings.
        'venom': {'emitters': ['venom']},
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
