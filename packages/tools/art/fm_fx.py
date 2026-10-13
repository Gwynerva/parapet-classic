"""Flittermouse's effect (fx.json): now and then a single bat slips out from under the cape and
flaps away; on some flips and vaults he throws a batarang; waiting at the start a faint signal
hangs in the sky; leaving and coming back, a smoke pellet: dark smoke creeping along the ground
and bats flushed out of it."""
from lookgen import BOSSES, write_json
from tricks import tricks

PALETTE = {
    # Bats: the body, the wing membrane, its lit edge (to read on a night sky).
    'k': '#0e0c14', 'K': '#2a2638', 'e': '#5e5a7c',
    # The batarang: its dark outline, gunmetal, the lit steel, the white glint on the blades.
    'o': '#0d0c12', 'm': '#2c3240', 'M': '#6c7a8e', 'w': '#f9faf4',
    # Smoke: charcoal with a violet cast, thinning out.
    's': '#2a2a34d0', 'S': '#3c3c4ab0', 't': '#4c4c5c80',
    # The signal: a pale beam's end with a bat cut out of it.
    'y': '#fff1a838', 'Y': '#fff6c85a',
}

SPRITES = {
    # A bat flapping: wings up, spread, down (the ears on its head, the wings' trailing edge
    # scalloped, their leading edge catching the light).
    'bat-up': [
        'e.......e',
        'Ke.....eK',
        '.KKk.kKK.',
        '..KkkkK..',
        '....k....',
    ],
    'bat-mid': [
        '...k.k...',
        'eeKkkkKee',
        'KKKKkKKKK',
        '.K.K.K.K.',
    ],
    'bat-down': [
        '...k.k...',
        '..ekkke..',
        '.eKKkKKe.',
        'eK.....Ke',
        'K.......K',
    ],
    # The batarang, spinning: flat (a bat's wings with hooked tips, the hub glinting), turned
    # on its edge one way, on end, the other way.
    'rang1': [
        'w.......w',
        'oMo...oMo',
        '.oMmwmMo.',
        '..om.mo..',
    ],
    'rang2': [
        '......w',
        '....oMo',
        '..omMo.',
        '.oMwo..',
        'oMmo...',
        'wo.....',
    ],
    'rang3': [
        '.w.',
        'oMo',
        'oMo',
        'mwm',
        'oMo',
        'oMo',
        '.w.',
    ],
    'rang4': [
        'w......',
        'oMo....',
        '.oMmo..',
        '..owMo.',
        '...omMo',
        '.....ow',
    ],
    # Smoke puffs, billowing and thinning out.
    'puff1': [
        '.ss..',
        'sSSs.',
        'sSSss',
        '.sss.',
    ],
    'puff2': [
        '..sss...',
        '.sSSSss.',
        'sSSSSSs.',
        'sSSsSSss',
        '.ssssss.',
    ],
    'puff3': [
        '...ssss....',
        '.ssSSSSss..',
        'sSSSStSSss.',
        'sSStSSSSSss',
        'sSSSSSStSs.',
        '.sssssssss.',
    ],
    'puff4': [
        '....tttt.....',
        '..ttSSSStt...',
        '.tSStttSSStt.',
        'tSSttSStttSSt',
        'tSStttttSSStt',
        '.ttSSttSttt..',
        '...ttttttt...',
    ],
    # The signal in the sky: an oval of light with the bat cut out.
    'signal': [
        '....yyyyyyy....',
        '..yyyYYYYYyyy..',
        '.yyYY.YYY.YYyy.',
        'yyY....Y....Yyy',
        'yyY.........Yyy',
        'yyYY.Y...Y.YYyy',
        '.yyYYYY.YYYYyy.',
        '..yyyYYYYYyyy..',
        '....yyyyyyy....',
    ],
}

PUFF = {'frames': ['puff1', 'puff2', 'puff3', 'puff4'], 'fps': 4, 'loop': False}
FLAP = {'frames': ['bat-up', 'bat-mid', 'bat-down', 'bat-mid'], 'fps': 12}

EMITTERS = {
    # One bat now and then from under the cape, up and away behind him (about one every three
    # or four seconds of running, never more than two at once).
    'bat': {
        'while': ['run', 'air'], 'perSecond': 0.28, 'minSpeed': 60, 'anchor': 'back', 'offset': [3, 3],
        'jitter': [1, 2], 'speed': [28, 46], 'angle': [35, 70], 'inherit': 0.25, 'gravity': -22, 'drag': 0.4,
        'life': [1300, 1700], 'fadeIn': 120, 'fadeOut': 450, 'flutter': {'amp': 2, 'freq': 3}, 'sprite': FLAP,
        'max': 2, 'reduced': 0.5,
    },
    # A batarang from the near hand, thrown ahead and a little up, spinning (its chance on
    # flips and vaults is set in tricks.py).
    'batarang': {
        'enter': ['flip', 'vault'], 'burst': 1, 'anchor': 'hand.near', 'speed': [150, 180], 'angle': [158, 172],
        'inherit': 0.3, 'gravity': 40, 'drag': 0.2, 'life': [560, 700], 'fadeOut': 200,
        'sprite': {'frames': ['rang1', 'rang2', 'rang3', 'rang4'], 'fps': 20}, 'layer': 'front', 'max': 2, 'reduced': 1,
    },
    # Waiting: a faint signal high in the sky, now and then; a bat circling.
    'signal': {
        'perSecond': 0.12, 'anchor': 'head', 'offset': [0, -46], 'jitter': [10, 4], 'speed': [1, 3],
        'angle': [80, 100], 'life': 4200, 'fadeIn': 1400, 'fadeOut': 1600, 'sprite': {'frames': ['signal']},
        'max': 1,
    },
    'idle-bat': {
        'perSecond': 0.3, 'anchor': 'body', 'jitter': [10, 6], 'speed': [14, 24], 'angle': [60, 120],
        'gravity': -10, 'life': [1200, 1600], 'fadeIn': 150, 'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 3},
        'sprite': FLAP, 'max': 2,
    },
    # Leaving and coming back: a smoke pellet. Dark smoke creeping along the ground both ways,
    # and the bats it flushes out.
    'smoke': {
        'burst': 5, 'anchor': 'feet', 'offset': [0, -3], 'jitter': [4, 1], 'speed': [22, 44], 'angle': [-6, 16],
        'gravity': -4, 'drag': 1.5, 'life': [1200, 1600], 'fadeOut': 700, 'sprite': PUFF, 'reduced': 0.5,
    },
    'smoke-ahead': {
        'burst': 5, 'anchor': 'feet', 'offset': [0, -3], 'jitter': [4, 1], 'speed': [22, 44],
        'angle': [164, 186], 'gravity': -4, 'drag': 1.5, 'life': [1200, 1600], 'fadeOut': 700, 'sprite': PUFF,
        'reduced': 0.5,
    },
    'smoke-rise': {
        'burst': 7, 'anchor': 'body', 'jitter': [6, 3], 'speed': [5, 12], 'angle': [60, 120], 'gravity': -8,
        'drag': 1.2, 'life': [900, 1300], 'fadeOut': 600, 'sprite': PUFF, 'reduced': 0,
    },
    'flush': {
        'burst': 5, 'anchor': 'body', 'speed': [45, 85], 'angle': [35, 145], 'gravity': -30, 'drag': 0.5,
        'life': [900, 1300], 'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 4}, 'sprite': FLAP, 'reduced': 0.4,
    },
}

FX = {
    'palette': PALETTE,
    'sprites': SPRITES,
    'emitters': EMITTERS,
    'variants': {'bats': {'emitters': ['bat']}, 'batarang': {'emitters': ['batarang']}},
    'presence': {'idle': ['signal', 'idle-bat'], 'vanish': ['smoke', 'smoke-ahead', 'smoke-rise', 'flush'],
                 'appear': ['smoke', 'smoke-ahead', 'smoke-rise', 'flush']},
}

EFFECT = ['bats', 'batarang']


def write():
    import copy
    write_json(BOSSES + '/flittermouse/fx.json', tricks(copy.deepcopy(FX), 'flittermouse'))


def preview():
    """The sprites for view.py."""
    return [(rows, {k: v[:7] if len(v) == 9 and False else v for k, v in PALETTE.items()}) for rows in SPRITES.values()]


if __name__ == '__main__':
    write()
    print('fx written')
