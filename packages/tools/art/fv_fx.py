"""Five's effect (fx.json): the two halves of V's line ("a stranger's voice in the head and a
jacket that glows") and the implant of the Edgerunners, each quiet and short.

* The Relic glitch (`glitch`), about once in eleven seconds of running or flying: for a sixth of a
  second the image of V tears like the screen when Johnny's engram takes over, stuck to the
  runner: two or three slices of her shifted in red and cyan, a few dead pixels by the head, the
  collar's light gone red. Nothing stays behind on the route.
* The collar (`glitch` too): now and then a glint of light runs up the stripes of the collar.
* Sandevistan (`sandevistan`), on about one flip or vault in four: time slows, V leaves a flat
  lime silhouette of the pose sliding back, and behind it a stepped smear of scanlines going mint,
  sky, violet, magenta, gone in a third of a second.
* Waiting by the start, a dead pixel blinks and a slice of the image tears now and then; V leaves
  in a red and cyan tear (flatlined) and comes back with a holo-call: a little red window opens by
  the head, a green ring rings in it, it folds into a line."""

GLITCH_EVERY = 0.09  # per second: one glitch in about eleven seconds of running or flying

PALETTE = {
    # Relic: the engram's red, the screen's cyan, magenta dead pixels.
    'r': '#ff2a3a', 'R': '#ff8a92', 'c': '#33e6ff', 'C': '#c2f9ff', 'm': '#e4136a', 'k': '#120c16',
    # The collar's light.
    'g': '#effdff', 'G': '#90e4fc', 'Z': '#1db7ed',
    # Sandevistan's steps.
    'L': '#b9ff70', 'n': '#5ee6c0', 's': '#5ac8ff', 'v': '#8a6cff', 'M': '#e4136a',
    # The holo-call: its red frame, the window, the green ring.
    'F': '#ff3a5c', 'f': '#a8102e', 'h': '#3a0a1ac0', 'H': '#5a1428c0', 'o': '#0df967', 'O': '#b8ffd0',
}

SPRITES = {
    # Slices of the runner torn sideways: a red one and a cyan one, broken.
    'slice-r1': ['rrrrr.rrrrrr'],
    'slice-r2': ['rrr.rrrrrrr.', '..rrrr..rr..'],
    'slice-c1': ['cccccccc.ccc'],
    'slice-c2': ['.cccc.cccccc', 'cc....ccc...'],
    'slice-w': ['CCCC.CCCCCCC'],
    # Dead pixels by the head: two frames, flickering.
    'dead-1': ['rr.......', '.....cc..', '.........', '..mm.....', '.......rr'],
    'dead-2': ['.........', 'cc.......', '......mm.', '.........', '...rr....'],
    # The collar gone red: its stripes, two frames.
    'collar-red-1': ['rRr', '...', 'rRr', '...', 'rRr'],
    'collar-red-2': ['...', 'rRr', '...', 'rRr', '...'],
    # A glint running up the collar.
    'glint': ['g', 'G', 'Z'],
    # Sandevistan: scanlines of the smear, stepped colours.
    'scan-n': ['nnnn'],
    'scan-n2': ['nnnnnn'],
    'scan-s': ['ssss'],
    'scan-s2': ['ssssss'],
    'scan-v': ['vvvv'],
    'scan-v2': ['vvvvvv'],
    'scan-m': ['MMMM'],
    'scan-m2': ['MMMMMM'],
    # The holo-call by the head: it opens from a line, a ring rings in it, it folds back.
    'call-0': ['.........', '.........', '.........', 'FFFFFFFFF', '.........', '.........', '.........'],
    'call-1': ['.........', '.........', 'FFFFFFFFF', 'FhhhhhhhF', 'FFFFFFFFF', '.........', '.........'],
    'call-2': ['FFFFFFFFF', 'FhhhhhhhF', 'FhhhohhhF', 'FhhoHohhF', 'FhhhohhhF', 'FhhhhhhhF', 'fffffffff'],
    'call-3': ['FFFFFFFFF', 'FhhhOhhhF', 'FhhOoOhhF', 'FhOoHoOhF', 'FhhOoOhhF', 'FhhhOhhhF', 'fffffffff'],
}


def fx():
    em = {}
    glitch = {'while': ['run', 'air'], 'perSecond': GLITCH_EVERY, 'inherit': 1, 'speed': 0, 'blend': 'add',
              'layer': 'front', 'max': 1}
    # Three slices across the body, the red one behind, the cyan ones ahead (sliced shifts).
    em['relic-slice-r'] = {**glitch, 'anchor': 'chest', 'offset': [2, -3], 'life': [150, 190], 'fadeOut': 40,
                           'sprite': {'frames': ['slice-r1', 'slice-r2', 'slice-r1'], 'fps': 20}}
    em['relic-slice-c'] = {**glitch, 'anchor': 'chest', 'offset': [-2, 2], 'life': [130, 170], 'fadeOut': 40,
                           'sprite': {'frames': ['slice-c2', 'slice-c1', 'slice-w'], 'fps': 20}}
    em['relic-slice-hips'] = {**glitch, 'anchor': 'hips', 'offset': [-1, 0], 'life': [110, 150], 'fadeOut': 40,
                              'sprite': {'frames': ['slice-r2', 'slice-c2'], 'fps': 16}}
    em['relic-dead'] = {**glitch, 'anchor': 'head', 'offset': [0, -1], 'life': [140, 200], 'fadeOut': 30,
                        'sprite': {'frames': ['dead-1', 'dead-2'], 'fps': 14}}
    em['relic-collar'] = {**glitch, 'anchor': 'neck', 'offset': [7, 1], 'blend': 'normal', 'life': [160, 200],
                          'fadeOut': 30, 'sprite': {'frames': ['collar-red-1', 'collar-red-2'], 'fps': 14}}
    # The collar's glint now and then.
    em['collar-glint'] = {'while': ['run'], 'perSecond': 0.45, 'minSpeed': 30, 'anchor': 'neck', 'offset': [7, 4],
                          'inherit': 1, 'speed': 14, 'angle': 90, 'life': [180, 220], 'fadeIn': 40, 'fadeOut': 80,
                          'sprite': {'frames': ['glint'], 'fps': 1}, 'blend': 'add', 'layer': 'front', 'max': 1}
    # Sandevistan: the smear behind the lime snapshot, four steps going back, each a few scanlines
    # across the body, left where they were drawn (the runner goes on).
    for i, (k, col) in enumerate((('n', 'mint'), ('s', 'sky'), ('v', 'violet'), ('m', 'magenta'))):
        em[f'sande-{col}'] = {
            'burst': [6, 8], 'anchor': 'chest', 'offset': [7 + 6 * i, 4], 'jitter': [2, 13], 'speed': 0,
            'inherit': 0, 'life': [240 + 30 * i, 300 + 30 * i], 'fadeOut': 140,
            'sprite': {'frames': [f'scan-{k}', f'scan-{k}2'], 'random': True}, 'blend': 'add',
        }
    # Waiting, leaving, coming back.
    em['idle-dead'] = {'perSecond': 1.2, 'anchor': 'head', 'jitter': [6, 6], 'speed': 0, 'life': [90, 160],
                       'fadeOut': 40, 'rect': {'size': [1, 2], 'colors': ['r', 'c', 'm']}, 'blend': 'add'}
    em['idle-slice'] = {'perSecond': 0.5, 'anchor': 'chest', 'jitter': [3, 10], 'speed': 0, 'life': [80, 140],
                        'fadeOut': 30, 'sprite': {'frames': ['slice-r1', 'slice-c1', 'slice-c2'], 'random': True},
                        'blend': 'add'}
    em['flatline'] = {'burst': 14, 'anchor': 'body', 'jitter': [5, 14], 'speed': [10, 50], 'angle': [-12, 12],
                      'drag': 5, 'life': [140, 320], 'fadeOut': 120,
                      'sprite': {'frames': ['slice-r1', 'slice-r2', 'slice-c1', 'slice-c2', 'slice-w'],
                                 'random': True}, 'blend': 'add'}
    em['holo-call'] = {'burst': 1, 'anchor': 'head', 'offset': [-12, -4], 'speed': 0, 'life': 1150, 'fadeOut': 120,
                       'sprite': {'frames': ['call-0', 'call-1', 'call-2', 'call-3', 'call-2', 'call-3', 'call-2',
                                             'call-1', 'call-0'], 'fps': 8, 'loop': False},
                       'layer': 'front'}
    em['holo-lines'] = {'burst': 6, 'anchor': 'body', 'jitter': [6, 14], 'speed': 0, 'life': [120, 260],
                        'fadeOut': 100, 'rect': {'size': 1, 'colors': ['c', 'C']}, 'blend': 'add'}
    for e in em.values():
        e.setdefault('reduced', 0)
    return {
        'palette': PALETTE,
        'sprites': SPRITES,
        'emitters': em,
        'variants': {
            'glitch': {'emitters': ['relic-slice-r', 'relic-slice-c', 'relic-slice-hips', 'relic-dead',
                                    'relic-collar', 'collar-glint']},
            # The outfits without the Samurai's glowing collar (Street Kid, David's jacket): the glitch
            # without the collar's light.
            'glitch-bare': {'emitters': ['relic-slice-r', 'relic-slice-c', 'relic-slice-hips', 'relic-dead']},
            'sandevistan': {'afterimage': {
                'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': 0.28,
                'burst': ['sande-mint', 'sande-sky', 'sande-violet', 'sande-magenta'],
                'colors': ['#b9ff70'], 'textured': False, 'life': 320, 'drift': [36, 0], 'alpha': 0.6}},
        },
        'presence': {'idle': ['idle-dead', 'idle-slice'], 'vanish': ['flatline'], 'appear': ['holo-call', 'holo-lines']},
    }
