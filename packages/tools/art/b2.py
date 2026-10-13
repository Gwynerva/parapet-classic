"""B-2: the looks (b2_looks.py), the effect (evade) and her outfits in boss.json.

The effect is 2B's own, quiet as an android:
* evade: on some of her rolls, dashes and flips (two in five) she slips out of her own pose as in
  a Perfect Evade: a pale champagne-gold hologram of it stays a moment where she was and drifts
  back, fading; three to five glints flash on it and break into one-pixel data squares (the gold
  of YoRHa's weapon rings and Pod programs, the white squares of its memories);
* Pod 042: now and then (one every twelve seconds or so of running) her Pod hovers by her
  shoulder for a second, its copper cap glinting, and dissolves into data squares;
* presence: by the start a data square now and then drifts up from her; leaving, her black box
  self-destructs (a short white ring, black cubes with silver circuits and white ones); coming
  back, white data squares gather into her from both sides (uploaded to a new body).
The constant glitter of the old effect is gone."""
from lookgen import *
from tricks import tricks
import json

import b2_looks  # noqa: F401  (the looks)


class FxPalette:
    """Palette characters for the effect's colours, given out as pictures need them."""
    POOL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

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


P = FxPalette()
GOLD = {'W': '#fff4cf', 'g': '#f2d58a', 'G': '#d9b25c', 'o': '#a8843c', 's': '#efe9d8'}
S = {}

# ------------------------------------------------------------------------------- glints
# A four-pointed glint, its smaller flash, and the data square it leaves.
S['glint1'] = P.rows(['..g..', '..W..', 'gWWWg', '..W..', '..g..'], GOLD)
S['glint2'] = P.rows(['.....', '..g..', '.gWg.', '..g..', '.....'], GOLD)
S['glint3'] = P.rows(['.....', '.....', '..W..', '.....', '.....'], GOLD)

# ----------------------------------------------------------------------------- Pod 042
# The warm grey box with rounded corners (lit from the front), its copper cap, the dark block
# under it with the little arms; a frame with the cap's glint; dissolving into squares.
POD = {'L': '#e2dccf', 'M': '#b2ab9f', 'D': '#827c72', 'k': '#3e3b38', 'd': '#2a2a30', 'c': '#d08a50',
       'C': '#8c5232', 'W': '#fff4cf', 's': '#efe9d8'}
S['pod'] = P.rows([
    '...Cc..',
    '...CC..',
    '.kkkkk.',
    'kDMLLLk',
    'kDMLLLk',
    'kDMMLLk',
    'kDDMMMk',
    '.kkkkk.',
    '..ddd..',
    '.d.d.d.',
], POD)
S['pod-lit'] = P.rows([
    '...CW..',
    '...Cc..',
    '.kkkkk.',
    'kDMLLLk',
    'kDMLLLk',
    'kDMMLLk',
    'kDDMMMk',
    '.kkkkk.',
    '..ddd..',
    '.d.d.d.',
], POD)
S['pod-d1'] = P.rows([
    '...C...',
    '.....s.',
    '.kk.kk.',
    'kDML.Lk',
    '.DMLL.k',
    'kD.MLL.',
    '.DDM.Mk',
    '.k.kk..',
    '..d.d..',
    '.......',
], POD)
S['pod-d2'] = P.rows([
    '.s.....',
    '....s..',
    '..k...k',
    '.D..L..',
    's..L...',
    '..M...s',
    '.D..M..',
    '...k...',
    '.s.....',
    '.......',
], POD)

# --------------------------------------------------------------------- the black box
# Cubes of the self-destruct: black with a silver circuit pixel, and white ones.
BOX = {'k': '#121216', 'K': '#2c2c34', 'i': '#a8aab4', 'w': '#f4f2ec', 'W': '#cfcbc4'}
S['cube-black'] = P.rows(['Kk', 'ki'], BOX)
S['cube-white'] = P.rows(['ww', 'wW'], BOX)
# The short white ring of the blast, growing and thinning out.
RING = {'W': '#fff8e8', 'w': '#efe9d8'}
S['ring1'] = P.rows(['.www.', 'wWWWw', 'wWWWw', 'wWWWw', '.www.'], RING)
S['ring2'] = P.rows([
    '...www...',
    '.ww...ww.',
    '.w.....w.',
    'w.......w',
    'w.......w',
    'w.......w',
    '.w.....w.',
    '.ww...ww.',
    '...www...',
], RING)
S['ring3'] = P.rows([
    '....w.w....',
    '..w.....w..',
    '...........',
    'w.........w',
    '...........',
    'w.........w',
    '...........',
    'w.........w',
    '...........',
    '..w.....w..',
    '....w.w....',
], RING)

SQUARES = ['#efe9d8', '#fff4cf', '#f2d58a']

fx = {
    'palette': P.pal,
    'sprites': S,
    'emitters': {
        # With the hologram (its `burst`): glints on the pose, flashing out…
        'glints': {
            'burst': [3, 5], 'anchor': 'body', 'jitter': [4, 9], 'speed': [4, 12], 'angle': [20, 160],
            'gravity': -12, 'drag': 2, 'life': [260, 360], 'fadeOut': 120,
            'sprite': {'frames': ['glint1', 'glint2', 'glint3'], 'fps': 10, 'loop': False}, 'blend': 'add',
        },
        # …and breaking into data squares that drift back and up.
        'glint-squares': {
            'burst': [7, 11], 'anchor': 'body', 'jitter': [4, 10], 'speed': [8, 22], 'angle': [-20, 80],
            'gravity': -14, 'drag': 1.5, 'life': [450, 700], 'fadeIn': 180, 'fadeOut': 300,
            'rect': {'size': 1, 'colors': SQUARES},
        },
        # Pod 042 by her shoulder now and then, keeping up with her, dissolving.
        'pod': {
            'while': ['run'], 'perSecond': 0.08, 'minSpeed': 60, 'max': 1, 'anchor': 'neck', 'offset': [17, -5],
            'inherit': 1, 'speed': 0, 'gravity': 0, 'life': 1300, 'fadeIn': 160, 'fadeOut': 220, 'face': True,
            'sprite': {'frames': ['pod', 'pod', 'pod', 'pod', 'pod-lit', 'pod', 'pod', 'pod', 'pod', 'pod',
                                  'pod-d1', 'pod-d2'], 'fps': 9.5, 'loop': False},
            'reduced': 0.5,
        },
        # By the start: a data square now and then drifts up from her.
        'idle-data': {
            'perSecond': 1.2, 'anchor': 'body', 'jitter': [5, 2], 'speed': [2, 6], 'angle': [70, 110],
            'gravity': -6, 'life': [900, 1400], 'fadeIn': 250, 'fadeOut': 500,
            'rect': {'size': 1, 'colors': SQUARES},
        },
        # Leaving: the black box's self-destruct.
        'blackbox-ring': {
            'burst': 1, 'anchor': 'chest', 'speed': 0, 'life': 330, 'fadeOut': 120,
            'sprite': {'frames': ['ring1', 'ring2', 'ring3'], 'fps': 10, 'loop': False}, 'blend': 'add',
            'layer': 'front',
        },
        'blackbox-cubes': {
            'burst': [12, 16], 'anchor': 'body', 'jitter': [3, 4], 'speed': [30, 75], 'angle': [0, 360],
            'gravity': 90, 'drag': 1.4, 'life': [550, 900], 'fadeOut': 300, 'tumble': [1, 3],
            'sprite': {'frames': ['cube-black', 'cube-black', 'cube-white'], 'random': True},
        },
        # Coming back: white squares gather into her from both sides.
        'gather-behind': {
            'burst': [9, 12], 'anchor': 'body', 'offset': [11, 0], 'jitter': [3, 3], 'speed': [22, 30],
            'angle': [170, 190], 'drag': 0.6, 'life': [380, 480], 'fadeIn': 140, 'fadeOut': 140,
            'rect': {'size': 1, 'colors': SQUARES},
        },
        'gather-ahead': {
            'burst': [9, 12], 'anchor': 'body', 'offset': [-11, 0], 'jitter': [3, 3], 'speed': [22, 30],
            'angle': [-10, 10], 'drag': 0.6, 'life': [380, 480], 'fadeIn': 140, 'fadeOut': 140,
            'rect': {'size': 1, 'colors': SQUARES},
        },
    },
    'variants': {
        # A Perfect Evade on some of her rolls, dashes and flips: her pose in pale gold, glints
        # breaking into data squares; her Pod now and then.
        'evade': {'emitters': ['pod'],
                  'afterimage': {'mode': 'snapshot', 'enter': ['roll', 'dash', 'flip'], 'chance': 0.4,
                                 'burst': ['glints', 'glint-squares'], 'colors': ['#f2d58a'], 'textured': True,
                                 'life': 420, 'drift': [22, -4], 'alpha': 0.45}},
    },
    'presence': {'idle': ['idle-data'], 'vanish': ['blackbox-ring', 'blackbox-cubes'],
                 'appear': ['gather-behind', 'gather-ahead']},
}
write_json(BOSSES + '/b2/fx.json', tricks(fx, 'b2'))

# Her outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/b2/boss.json', encoding='utf-8'))
b['looks'] = ['android', 'replica', 'kimono']
b['effect'] = ['evade']
write_json(BOSSES + '/b2/boss.json', b)
print('b2 written')
