"""Sir Nobody: the knight who never takes his helm off. His looks (kn_looks.py: helms in
kn_helms.py, parts in kn_parts.py), his effect, the Summon Sign, and his outfits in boss.json.

The effect is Dark Souls' summon sign, the knight who is always ready to help:
* while he runs, now and then a little soul wisp slips out of his visor slit and drifts up (there
  is nobody inside);
* on about a third of his soft landings, wall-flip landings and rolls a golden summon sign is
  left glowing on the roof where he touched down (he will be on some roof, should you need him),
  fading in a second and a half; on some flips and vaults the soul is shaken out of the slit;
* where his steel strikes or scrapes stone on a trick (the boot on a wall, the sabatons on a roof
  or a block, the gauntlets on a roof, a block or a pole, the heels whipping round in a flip),
  a short jet of hot sparks, on most contacts (kn_sparks.py); never while he just runs;
* by the start he stands on his sign, motes rising from it; he leaves as a phantom going back to
  his world (a thin pillar of light, the motes of him rising) and comes back the same way.
No feathers: his plume does not moult."""
import json
import os

from lookgen import BOSSES, write_json
from tricks import tricks
import kn_looks
import kn_sparks

# ------------------------------------------------------------------------------------- the effect
# Gold of the sign (white chalk light → old gold), its glow (with alpha), the soul (the outfit's
# accent: warm gold on the Sunlight knight, pale tin on the Onion, cold blue on the Hollow).
PALETTE = {
    'w': '#fffbe6', 'Y': '#f8e9a0', 'y': '#e2c870', 'a': '#b89a48', 'A': '#7a6430',
    'g': '#f8e9a0aa', 'G': '#e2c87066', 'h': '#fffbe644', 'q': '#f8e9a030',
    'W': '#ffffff', 'b': 'accent.light', 'B': 'accent', 'd': 'accent.dark',
    **kn_sparks.PALETTE,
}

# The sign on the roof, seen low from the side: a ring of chalk light, a signature scrawled in
# it, shimmering; a mote rising from it now and then. The ring lies on the bottom rows; the empty
# rows above are the motes' room (the sprite is centred on its point: `offset` lifts it).
_RING = [
    '.....GyYYYyG.....',
    '..GyY.a...a.YyG..',
    'GYw.aY.wWw.Ya.wYG',
    '..GyY.a...a.YyG..',
    '.....GyYYYyG.....',
]
_RING2 = [
    '.....GyYwYyG.....',
    '..GyY..a.a..YyG..',
    'GYw.a.YwWwY.a.wYG',
    '..GyY..a.a..YyG..',
    '.....GyYwYyG.....',
]
_RING3 = [
    '.....GyYYYyG.....',
    '..GwY.a...a.YwG..',
    'GYw.aY.YWY.Ya.wYG',
    '..GwY.a...a.YwG..',
    '.....GyYYYyG.....',
]
_MOTES = [
    ['.................', '.................', '.................', '.................',
     '.................', '........w........', '.................'],
    ['.................', '.................', '.................', '........h........',
     '........g........', '.................', '...........w.....'],
    ['.................', '........h........', '.................', '...........g.....',
     '.................', '.....w...........', '.................'],
    ['.................', '.................', '...........h.....', '.................',
     '.....g...........', '.................', '.................'],
]
SIGN = [m + r for m, r in zip(_MOTES, (_RING, _RING2, _RING3, _RING2))]

# The sign he stands on by the start, wider than his stance: it shows either side of his feet.
BIG_SIGN = [
    ['.......GgyYYYYYYYygG.......',
     '...GgyY..a.......a..YygG...',
     'GYw..aY.w.Y.WwW.Y.w.Ya..wYG',
     '...GgyY..a.......a..YygG...',
     '.......GgyYwYYYwYygG.......'],
    ['.......GgyYYYYYYYygG.......',
     '...GgyY...a.....a...YygG...',
     'GYw.a.Yw.Y.wWWWw.Y.wY.a.wYG',
     '...GgyY...a.....a...YygG...',
     '.......GgywYYYYYwygG.......'],
    ['.......GgyYYYYYYYygG.......',
     '...GgwY..a.......a..YwgG...',
     'GYw..aY.Y.w.WwW.w.Y.Ya..wYG',
     '...GgwY..a.......a..YwgG...',
     '.......GgyYYwYwYYygG.......'],
]
BIG_LIFT = -2  # its bottom row on the roof

# A little soul: a white core, the outfit's light accent round it, a soft halo, its tail below.
SOUL = [
    ['..h..',
     '.hbh.',
     'hbWbh',
     '.bWb.',
     '.hBh.',
     '..B..',
     '..d..'],
    ['..h..',
     '.hbh.',
     'hbWbh',
     '.bWb.',
     '..B..',
     '.hd..',
     '.....'],
    ['.....',
     '..h..',
     '.hbh.',
     'hbWbh',
     '.bBb.',
     '..B..',
     '...d.'],
]


def pillar(w, h=44):
    """A thin pillar of light, `w` pixels wide: a white core, gold edges, fading at the top."""
    rows = []
    for y in range(h):
        fade = y / (h - 1)  # 0 at the top, 1 at the foot
        row = ''
        for x in range(w):
            d = abs(x - (w - 1) / 2)
            if w == 1:
                ch = 'g' if fade > 0.25 else 'q'
            elif d < 0.6:
                ch = 'w' if fade > 0.3 else ('g' if fade > 0.12 else 'q')
            elif d < 1.6:
                ch = 'g' if fade > 0.3 else 'q'
            elif d < 2.6:
                ch = 'G' if fade > 0.45 else 'q'
            else:
                ch = 'q' if fade > 0.55 else '.'
            row += ch
        rows.append(row)
    return rows


SPRITES = {f'sign{i + 1}': rows for i, rows in enumerate(SIGN)}
SPRITES.update({f'soul{i + 1}': rows for i, rows in enumerate(SOUL)})
SPRITES.update({f'bigsign{i + 1}': rows for i, rows in enumerate(BIG_SIGN)})
BIG_FRAMES = ['bigsign1', 'bigsign2', 'bigsign3', 'bigsign2']
SPRITES.update({'pillar1': pillar(7), 'pillar2': pillar(5), 'pillar3': pillar(3), 'pillar4': pillar(1)})
SPRITES.update(kn_sparks.SPRITES)
SIGN_FRAMES = ['sign1', 'sign2', 'sign3', 'sign4']
# The ring's bottom row (11) on the roof: the sprite's centre is its row 6.
SIGN_LIFT = -5

fx = {
    'palette': PALETTE,
    'sprites': SPRITES,
    'emitters': {
        # Now and then (every five seconds or so) a soul slips out of the visor slit and drifts
        # up behind him, gone in a second.
        'soul': {
            'while': ['run', 'air'], 'perSecond': 0.2, 'minSpeed': 30, 'anchor': 'head', 'offset': [-4, -2],
            'speed': [3, 7], 'angle': [75, 105], 'inherit': 1, 'gravity': -14, 'drag': 0.3,
            'life': [900, 1150], 'fadeIn': 60, 'fadeOut': 500, 'flutter': {'amp': 1, 'freq': 1.6},
            'sprite': {'frames': ['soul1', 'soul2', 'soul3', 'soul2'], 'fps': 6}, 'blend': 'add', 'max': 1,
            'reduced': 0.5,
        },
        # On some flips and vaults the soul is shaken out of the slit.
        'soul-trick': {
            'enter': ['flip', 'vault'], 'chance': 0.3, 'burst': 1, 'anchor': 'head', 'offset': [-4, -2],
            'speed': [8, 14], 'angle': [60, 120], 'inherit': 0.6, 'gravity': -14, 'drag': 1.5,
            'life': [900, 1150], 'fadeIn': 80, 'fadeOut': 500, 'flutter': {'amp': 1, 'freq': 1.6},
            'sprite': {'frames': ['soul1', 'soul2', 'soul3', 'soul2'], 'fps': 6}, 'blend': 'add', 'max': 1,
            'reduced': 0.5,
        },
        # The summon sign left on the roof where he touches down (a chance): a soft landing (25),
        # a wall flip's landing (51) or a roll; still, behind him, glowing and fading. Not on the
        # `land` trigger: a landing he gets ready for (23) starts in the air.
        'sign': {
            'moves': [25, 51], 'enter': ['roll'], 'chance': 0.3, 'burst': 1, 'anchor': 'feet',
            'offset': [0, SIGN_LIFT],
            'speed': 0, 'inherit': 0, 'gravity': 0, 'life': [1400, 1800], 'fadeIn': 140, 'fadeOut': 700,
            'sprite': {'frames': SIGN_FRAMES, 'fps': 5}, 'layer': 'behind', 'max': 2, 'reduced': 1,
        },
        # By the start: the sign under his feet, breathing, and motes rising from it.
        'idle-sign': {
            'perSecond': 3, 'anchor': 'feet', 'offset': [0, BIG_LIFT], 'speed': 0, 'gravity': 0,
            'life': 2600, 'fadeIn': 700, 'fadeOut': 900, 'sprite': {'frames': BIG_FRAMES, 'fps': 4},
            'layer': 'behind', 'max': 2,
        },
        'idle-motes': {
            'perSecond': 2.5, 'anchor': 'feet', 'offset': [0, -1], 'jitter': [11, 0], 'speed': [6, 14],
            'angle': [80, 100], 'gravity': -10, 'drag': 0.5, 'life': [900, 1500], 'fadeIn': 150,
            'fadeOut': 600, 'rect': {'size': 1, 'colors': ['w', 'Y', 'y']}, 'blend': 'add', 'max': 6,
        },
        # Leaving and coming back as a phantom: a thin pillar of light over the sign, the motes of
        # him rising.
        'pillar': {
            'burst': 1, 'anchor': 'chest', 'offset': [0, 2], 'speed': 0, 'life': 520, 'fadeIn': 60, 'fadeOut': 260,
            'sprite': {'frames': ['pillar1', 'pillar2', 'pillar3', 'pillar4'], 'fps': 8, 'loop': False},
            'blend': 'add', 'reduced': 1,
        },
        'ring': {
            'burst': 1, 'anchor': 'feet', 'offset': [0, BIG_LIFT], 'speed': 0, 'life': 1300, 'fadeIn': 80,
            'fadeOut': 800, 'sprite': {'frames': BIG_FRAMES, 'fps': 6}, 'layer': 'behind', 'reduced': 1,
        },
        'phantom': {
            'burst': 22, 'anchor': 'body', 'jitter': [3, 0], 'speed': [4, 16], 'angle': [70, 110],
            'gravity': -36, 'drag': 0.6, 'life': [600, 1200], 'fadeOut': 450, 'flutter': {'amp': 1, 'freq': 2},
            'rect': {'size': 1, 'colors': ['w', 'W', 'Y', 'b']}, 'blend': 'add', 'reduced': 0.3,
        },
        # Steel on stone on his tricks (kn_sparks.py).
        **kn_sparks.EMITTERS,
    },
    'variants': {
        'summon-sign': {'emitters': ['soul', 'soul-trick', 'sign', *kn_sparks.EMITTERS]},
    },
    'presence': {'idle': ['idle-sign', 'idle-motes'], 'vanish': ['pillar', 'ring', 'phantom'],
                 'appear': ['pillar', 'ring', 'phantom']},
}


def write_fx():
    write_json(BOSSES + '/sir-nobody/fx.json', tricks(fx, 'sir-nobody'))


def write_boss(looks):
    path = BOSSES + '/sir-nobody/boss.json'
    b = json.load(open(path, encoding='utf-8'))
    b['looks'] = looks
    b['effect'] = ['summon-sign']
    write_json(path, b)
    # The old outfits (a dome helm on grey plate) are gone.
    for old in ('plate', 'dark-knight'):
        p = f'{BOSSES}/sir-nobody/looks/{old}.json'
        if os.path.exists(p):
            os.remove(p)


if __name__ == '__main__':
    looks = kn_looks.make_all()
    write_fx()
    write_boss(looks)
    print('sir nobody written')
