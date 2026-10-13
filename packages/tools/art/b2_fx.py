"""B-2's effect (fx.json), quiet as an android but sharp when she dodges:

* evade: on some of her rolls, dashes and flips (three in ten) she does a Perfect Evade. A white
  flash cuts across her (a four-pointed star tipped with the gold of her Pod programs, then a cut
  of white over black), the image tears into one-pixel slices for a moment, and a chain of three
  holograms of her pose stays behind, one every 90 ms as the move goes on: white, grey and black
  as YoRHa's uniform, with rolling scanlines, sliding back and fading in 0.4 s. As they fade they
  tear again, and black-box cubes, a white one and a gold bit peel off and float away.
* Pod 042: now and then (one every twelve seconds or so of running) her Pod hovers by her
  shoulder for a second, its copper cap glinting, and dissolves into data squares.
* presence: by the start a data square now and then drifts up from her; leaving, her black box
  self-destructs (a short white ring, black cubes with silver circuits and white ones); coming
  back, white data squares gather into her from both sides (uploaded to a new body).

`write()` writes fx.json (b2.py calls it)."""
from lookgen import BOSSES, write_json
from tricks import tricks

# How often she evades: the chance of a roll, dash or flip, and the chain it leaves.
EVADE_CHANCE = 0.3
CHAIN = {'count': 3, 'every': 90}
# The holograms, oldest first: white, grey, YoRHa black.
CHAIN_COLOURS = ['#ffffff', '#8a867e', '#26262c']


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
S = {}

# ------------------------------------------------------------------------------ evade
# YoRHa's monochrome (the white of her sleeves, the beige-grey of the menus, black velvet) and a
# touch of the gold of her Pod programs.
YORHA = {'W': '#ffffff', 'w': '#f4f2ec', 's': '#cfcbc4', 'g': '#8a867e', 'k': '#121216',
         'K': '#2c2c34', 'y': '#f2d58a', 'Y': '#fff4cf'}
# Nothing: a frame that keeps a particle hidden (pieces that come off the holograms later).
S['none'] = ['.']
# The flash of the evade: a four-pointed star stretched along the move, then a thin cut (white
# over black, so it reads on her dress and on a pale sky alike), then a dash, gone in a tenth of a
# second.
S['flash1'] = P.rows([
    '..........y..........',
    '..........W..........',
    '.........gWg.........',
    '........gWWWg........',
    'ygswwWWWWWWWWWWWwwsgy',
    '........gWWWg........',
    '.........gWg.........',
    '..........W..........',
    '..........y..........',
], YORHA)
S['flash2'] = P.rows([
    '.............W.............',
    'gswwwwWWWWWWWWWWWWWWWwwwwsg',
    '...kkkkkkkkkkkkkkkkkkkkk...',
], YORHA)
S['flash3'] = P.rows(['s.wwwWWWWWwww.s'], YORHA)
# Slices of the hologram torn sideways: rows of one pixel, white, grey and black, and a torn pair.
S['slice-w'] = P.rows(['wwwwwww'], YORHA)
S['slice-long'] = P.rows(['sWWWWWWWWWWs'], YORHA)
S['slice-s'] = P.rows(['sssssggg'], YORHA)
S['slice-k'] = P.rows(['kkkkk'], YORHA)
S['slice-kw'] = P.rows(['KKKKKKwww'], YORHA)
S['slice-tear'] = P.rows(['wwww....', '...kkkkk'], YORHA)
# A gold bit (a Pod program's).
S['bit-gold'] = P.rows(['y'], YORHA)

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
# Cubes of the self-destruct (and of the evade's holograms): black with a silver circuit pixel,
# and white ones.
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


def later(frames_hidden, frames):
    """A sprite sequence hidden for `frames_hidden` frames first: a piece that comes off later."""
    return ['none'] * frames_hidden + frames


# Pieces coming off the holograms: hidden at first, at 25 frames a second (40 ms a frame).
TEAR_FPS = 25

EMITTERS = {
    # The evade (all of these come only with the holograms, as their `burst`).
    # The flash across her as she slips out of the pose.
    'evade-flash': {
        'burst': 1, 'anchor': 'chest', 'offset': [2, 0], 'speed': 0, 'life': 125, 'fadeOut': 30,
        'sprite': {'frames': ['flash1', 'flash2', 'flash3'], 'fps': 25, 'loop': False}, 'layer': 'front',
    },
    # The image tearing at once: slices shifted sideways for a moment.
    'evade-slices': {
        'burst': [4, 6], 'anchor': 'body', 'jitter': [7, 14], 'speed': [20, 50], 'angle': [-8, 8],
        'drag': 8, 'life': [60, 120], 'fadeOut': 20,
        'sprite': {'frames': ['slice-w', 'slice-long', 'slice-s', 'slice-k', 'slice-tear', 'slice-kw'],
                   'random': True},
        'layer': 'front',
    },
    # As the holograms fade they tear again, flickering (on the first, which the others follow).
    'evade-tear-a': {
        'burst': [1, 2], 'anchor': 'body', 'jitter': [6, 13], 'speed': [6, 18], 'angle': [-10, 10],
        'drag': 4, 'life': [300, 360], 'fadeOut': 40,
        'sprite': {'frames': later(4, ['slice-w', 'slice-w', 'none', 'slice-tear']), 'fps': TEAR_FPS,
                   'loop': False},
    },
    'evade-tear-b': {
        'burst': [1, 2], 'anchor': 'body', 'jitter': [6, 13], 'speed': [6, 18], 'angle': [-10, 10],
        'drag': 4, 'life': [340, 400], 'fadeOut': 40,
        'sprite': {'frames': later(6, ['slice-kw', 'none', 'slice-k', 'slice-k']), 'fps': TEAR_FPS,
                   'loop': False},
    },
    # Black-box cubes peeling off them, a white one and a gold bit, floating back and up.
    'evade-cubes': {
        'burst': [2, 3], 'anchor': 'body', 'jitter': [5, 12], 'speed': [8, 20], 'angle': [30, 80],
        'gravity': -10, 'drag': 2, 'life': [600, 750], 'fadeOut': 300, 'tumble': [1, 2],
        'sprite': {'frames': later(5, ['cube-black']), 'fps': TEAR_FPS, 'loop': False},
    },
    'evade-cube-white': {
        'burst': 1, 'anchor': 'body', 'jitter': [5, 12], 'speed': [8, 20], 'angle': [30, 80],
        'gravity': -10, 'drag': 2, 'life': [550, 700], 'fadeOut': 280, 'tumble': [1, 2],
        'sprite': {'frames': later(4, ['cube-white']), 'fps': TEAR_FPS, 'loop': False},
    },
    'evade-gold': {
        'burst': [1, 2], 'anchor': 'body', 'jitter': [5, 12], 'speed': [6, 16], 'angle': [40, 100],
        'gravity': -12, 'drag': 2, 'life': [550, 700], 'fadeOut': 280,
        'sprite': {'frames': later(5, ['bit-gold']), 'fps': TEAR_FPS, 'loop': False},
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
}

EVADE_BURST = ['evade-flash', 'evade-slices', 'evade-tear-a', 'evade-tear-b', 'evade-cubes',
               'evade-cube-white', 'evade-gold']

fx = {
    'palette': P.pal,
    'sprites': S,
    'emitters': EMITTERS,
    'variants': {
        # A Perfect Evade on some of her rolls, dashes and flips: a flash and a chain of holograms
        # of her pose, white to black, tearing and shedding cubes; her Pod now and then.
        'evade': {'emitters': ['pod'],
                  'afterimage': {'mode': 'snapshot', 'enter': ['roll', 'dash', 'flip'], 'chance': EVADE_CHANCE,
                                 'repeat': CHAIN, 'colors': CHAIN_COLOURS, 'textured': True, 'scanlines': True,
                                 'burst': EVADE_BURST, 'life': 400, 'drift': [55, 0], 'alpha': 1}},
    },
    'presence': {'idle': ['idle-data'], 'vanish': ['blackbox-ring', 'blackbox-cubes'],
                 'appear': ['gather-behind', 'gather-ahead']},
}


def write():
    write_json(BOSSES + '/b2/fx.json', tricks(fx, 'b2'))


if __name__ == '__main__':
    write()
    print('b2 fx written')
