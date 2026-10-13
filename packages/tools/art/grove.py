"""Grove: the looks (gr_looks.py) and the effect.

CJ's San Andreas in three touches, none of them on him for long:
- tag: when he touches a wall, about one time in three, a small green "GROVE" tag is sprayed on
  it: a puff of paint mist, the letters, the paint running down. It stays on the wall where it
  was sprayed (it does not follow him) and fades after two seconds. Tagging the hood is the
  first thing the game makes him do.
- respect: on one flip or vault in five the game's white "RESPECT +" rises over his head, and
  now and then a green bill or two flutter off him; a lone bill slips out of his pocket while
  he runs, every fifteen seconds or so.
- the boss's presence: a faint mist of green paint while he waits at the start, a cloud of it
  as he leaves, and "MISSION PASSED!" with "RESPECT +" when he turns up at the goal."""
from lookgen import *
from tricks import tricks

import gr_looks  # noqa: F401  (the looks)

# ------------------------------------------------------------------ a pixel font
# 3 x 5 letters (M, N wider), drawn as '#'.
FONT = {
    'A': ['.#.', '#.#', '###', '#.#', '#.#'],
    'C': ['.##', '#..', '#..', '#..', '.##'],
    'D': ['##.', '#.#', '#.#', '#.#', '##.'],
    'E': ['###', '#..', '##.', '#..', '###'],
    'G': ['.##', '#..', '#.#', '#.#', '.##'],
    'I': ['###', '.#.', '.#.', '.#.', '###'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    'N': ['#..#', '##.#', '#.##', '#..#', '#..#'],
    'O': ['.#.', '#.#', '#.#', '#.#', '.#.'],
    'P': ['##.', '#.#', '##.', '#..', '#..'],
    'R': ['##.', '#.#', '##.', '#.#', '#.#'],
    'S': ['.##', '#..', '.#.', '..#', '##.'],
    'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'V': ['#.#', '#.#', '#.#', '#.#', '.#.'],
    '+': ['...', '.#.', '###', '.#.', '...'],
    '!': ['#', '#', '#', '.', '#'],
    ' ': ['.', '.', '.', '.', '.'],
}


def text(word, fill, shade, outline, pad=1):
    """A word in the pixel font: `fill` letters, their bottom row in `shade`, a 1-pixel
    `outline` all round (8 ways), like the game's captions."""
    w = sum(len(FONT[ch][0]) + 1 for ch in word) - 1
    c = Canvas(w + 2 * pad, 5 + 2 * pad)
    x = pad
    for ch in word:
        g = FONT[ch]
        for y, row in enumerate(g):
            for i, px in enumerate(row):
                if px == '#':
                    c.set(x + i, pad + y, shade if y == 4 else fill)
        x += len(g[0]) + 1
    filled = [[ch != '.' for ch in row] for row in c.px]
    for y in range(c.h):
        for x in range(c.w):
            if filled[y][x]:
                continue
            if any(0 <= x + dx < c.w and 0 <= y + dy < c.h and filled[y + dy][x + dx]
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                c.px[y][x] = outline
    return c


def framed(c, w, h, x, y):
    """`c` pasted on an empty canvas of w x h at (x, y)."""
    out = Canvas(w, h)
    out.paste(c.rows(), x, y)
    return out


# ------------------------------------------------------------------ the sprites
fx_palette = {
    # The tag: Grove green spray paint, its dark edge, a lit stroke, the overspray.
    'g': '#3c9c45', 'G': '#86d46e', 'd': '#143a1a', 'o': '#3c9c4570', 'O': '#86d46e50',
    # Paint mist.
    'p': '#8ad67a90', 'P': '#c8f0b8a0',
    # The game's texts: white RESPECT +, gold MISSION PASSED!, black edges.
    'w': '#ffffff', 'W': '#c9c9c9', 'k': '#000000', 'y': '#f0b43c', 'Y': '#b97418',
    # A green bill.
    'm': '#4f8a3c', 'M': '#94c873', 'n': '#1f3b18', 'c': '#d8ecc0',
}

# "GROVE" in Grove green, the letters bouncing like a hand-sprayed tag, a dark drop shadow
# under them (it reads on light and dark walls), an underline swept under the word and curling
# up at its end, a thin halo of overspray. Frames: the mist, half the word, the word, the drips.
BOUNCE = [1, 0, 1, 0, 1]
word = Canvas(5 * 4 + 1, 7)
x = 0
for ch, dy in zip('GROVE', BOUNCE):
    for y, row in enumerate(FONT[ch]):
        for i, px in enumerate(row):
            if px == '#':
                # The light on the strokes' tops.
                top = y == 0 or FONT[ch][0][i] != '#' and y == 1
                word.set(x + i, dy + y, 'G' if top else 'g')
    x += 4
for y in range(word.h - 1, -1, -1):  # the drop shadow, down and to the right
    for x in range(word.w - 1, -1, -1):
        if word.get(x, y) in 'gG' and word.get(x + 1, y + 1) == '.':
            word.set(x + 1, y + 1, 'd')
TW, TH = word.w + 3, word.h + 7
tag = framed(word, TW, TH, 1, 1)
UY = word.h + 1
tag.line(1, UY, TW - 5, UY, 'g').set(TW - 4, UY - 1, 'g').set(TW - 3, UY - 2, 'G')
tag.line(2, UY + 1, TW - 4, UY + 1, 'd').set(TW - 3, UY, 'd').set(TW - 2, UY - 1, 'd')
for x, y in ((0, 2), (0, 5), (4, 0), (10, 0), (17, 0), (TW - 1, 3), (TW - 2, 6), (6, UY + 2), (13, UY + 2),
             (TW - 7, UY + 2), (0, UY)):
    if tag.get(x, y) == '.':
        tag.set(x, y, 'o')


def drips(base, length):
    c = Canvas(base.w, base.h)
    c.px = [r[:] for r in base.px]
    for x, n in ((3, length), (10, max(0, length - 1)), (TW - 8, length + 1)):
        for i in range(n):
            c.set(x, UY + 2 + i, 'g' if i < n - 1 else 'd')
    return c


mist1 = Canvas(TW, TH)
for x, y in ((2, 3), (4, 2), (5, 4), (3, 5), (7, 3), (1, 4), (6, 6), (8, 5)):
    mist1.set(x, y, 'P' if (x + y) % 3 == 0 else 'p')
mist2 = Canvas(TW, TH)
mist2.px = [r[:] for r in tag.px]
for y in range(mist2.h):  # the paint going on: the first half of the word
    for x in range(mist2.w):
        if x > TW // 2 and mist2.get(x, y) != '.':
            mist2.set(x, y, '.')
for x, y in ((TW // 2 + 2, 3), (TW // 2 + 4, 2), (TW // 2 + 3, 5), (TW // 2 + 5, 4), (TW // 2 + 1, 7)):
    mist2.set(x, y, 'P' if (x + y) % 2 else 'p')

tag_frames = {'tag0': mist1.rows(), 'tag1': mist2.rows(), 'tag2': tag.rows(), 'tag3': drips(tag, 1).rows(),
              'tag4': drips(tag, 2).rows()}

respect = text('RESPECT +', 'w', 'W', 'k').rows()
passed = text('MISSION PASSED!', 'y', 'Y', 'k').rows()

bill1 = grid('''
nnnnnnn
nmmMmmn
nmMcMmn
nmmMmmn
nnnnnnn
''', {})
bill2 = grid('''
...nnn.
.nnmMn.
nmMcMn.
nMmMmn.
nmmnn..
nnn....
''', {})
bill3 = grid('''
nnnnnnn
nMmmmMn
nnnnnnn
''', {})
puff1 = grid('''
.p.
pPp
.p.
''', {})
puff2 = grid('''
.pp.
pPPp
pPPp
.pp.
''', {})
puff3 = grid('''
..pp..
.pPPp.
pPppPp
pP..Pp
.pPPp.
..pp..
''', {})

# The moves where he touches a wall (reference/notes/02-moves.md), and where the tag goes from
# the point that touches it so that it lands on the wall and not in the air in front of it
# (found with the showcase's demos): running up it (33), his hand still a stride from it as the
# move starts; the tic-tac's kick (20), his back to the wall, his foot on it; the wall flip's
# kick (48), facing it. Not the 'wall' trigger, which starts while a move is still armed, before
# he gets there.
WALL_TAGS = {'tag': ([33], 'hand.near', [-36, -1]), 'tag-kick': ([20], 'foot.near', [9, -4]),
             'tag-flip': ([48], 'foot.near', [-16, -4])}
BILL = {'frames': ['bill1', 'bill2', 'bill3', 'bill2'], 'fps': 7}
PUFF = {'frames': ['puff1', 'puff2', 'puff3'], 'fps': 4, 'loop': False}

fx = {
    'palette': fx_palette,
    'sprites': {**tag_frames, 'respect': respect, 'passed': passed, 'bill1': bill1, 'bill2': bill2,
                'bill3': bill3, 'puff1': puff1, 'puff2': puff2, 'puff3': puff3},
    'emitters': {
        # A tag sprayed on the wall he touches; it stays there and fades (WALL_TAGS).
        'tag': {
            'chance': 0.35, 'burst': 1, 'speed': 0, 'inherit': 0, 'life': 2400, 'fadeIn': 60, 'fadeOut': 900,
            'sprite': {'frames': ['tag0', 'tag1', 'tag2', 'tag3', 'tag4'], 'fps': 7, 'loop': False},
            'layer': 'behind', 'max': 2, 'reduced': 1,
        },
        # RESPECT + over his head on some flips and vaults (tricks.py).
        'respect': {
            'burst': 1, 'anchor': 'head', 'offset': [0, -12], 'speed': 12, 'angle': 90, 'inherit': 0.6,
            'drag': 1.2, 'life': 1150, 'fadeIn': 60, 'fadeOut': 420, 'sprite': {'frames': ['respect']},
            'layer': 'front', 'max': 1, 'reduced': 1,
        },
        # A bill or two off him on some of them.
        'bills': {
            'burst': [1, 2], 'anchor': 'chest', 'speed': [35, 60], 'angle': [70, 140], 'inherit': 0.3,
            'gravity': 75, 'drag': 1.4, 'life': [1000, 1300], 'fadeOut': 300, 'flutter': {'amp': 2, 'freq': 2.5},
            'sprite': BILL, 'max': 4,
        },
        # Now and then one slips out of his back pocket while he runs.
        'pocket': {
            'while': ['run'], 'perSecond': 0.07, 'minSpeed': 60, 'anchor': 'hips', 'offset': [3, 1],
            'speed': [12, 24], 'angle': [40, 80], 'inherit': 0.15, 'gravity': 55, 'drag': 1.6,
            'life': [1100, 1400], 'fadeOut': 350, 'flutter': {'amp': 2, 'freq': 2.2}, 'sprite': BILL, 'max': 1,
        },
        # The boss: a faint mist of green paint by the start, a cloud of it as he leaves…
        'mist': {
            'perSecond': 3, 'anchor': 'body', 'speed': [3, 8], 'angle': [60, 120], 'gravity': -6, 'drag': 1,
            'life': [700, 1000], 'fadeIn': 200, 'fadeOut': 400, 'rect': {'size': 1, 'colors': ['p', 'P', 'o']},
        },
        'cloud': {
            'burst': 12, 'anchor': 'body', 'speed': [12, 40], 'angle': [0, 360], 'gravity': -12, 'drag': 1.8,
            'life': [600, 900], 'fadeOut': 400, 'sprite': PUFF,
        },
        'cash': {
            'burst': 3, 'anchor': 'chest', 'speed': [30, 60], 'angle': [50, 130], 'gravity': 70, 'drag': 1.4,
            'life': [1000, 1300], 'fadeOut': 300, 'flutter': {'amp': 2, 'freq': 2.5}, 'sprite': BILL,
        },
        # …and the game's own words when he turns up at the goal.
        'passed': {
            'burst': 1, 'anchor': 'head', 'offset': [0, -14], 'speed': 6, 'angle': 90, 'life': 2000,
            'fadeIn': 80, 'fadeOut': 600, 'sprite': {'frames': ['passed']}, 'layer': 'front', 'reduced': 1,
        },
        'respected': {
            'burst': 1, 'anchor': 'head', 'offset': [0, -6], 'speed': 6, 'angle': 90, 'life': 2000,
            'fadeIn': 500, 'fadeOut': 600, 'sprite': {'frames': ['respect']}, 'layer': 'front', 'reduced': 1,
        },
    },
    'variants': {
        'respect': {'emitters': ['respect', 'bills', 'pocket']},
        'tag': {'emitters': list(WALL_TAGS)},
    },
    'presence': {'idle': ['mist'], 'vanish': ['cloud', 'cash'], 'appear': ['cloud', 'passed', 'respected']},
}
for name, (moves, anchor, offset) in WALL_TAGS.items():
    fx['emitters'][name] = {**fx['emitters']['tag'], 'moves': moves, 'anchor': anchor, 'offset': offset}
write_json(BOSSES + '/grove/fx.json', tricks(fx, 'grove'))
print('grove written')
