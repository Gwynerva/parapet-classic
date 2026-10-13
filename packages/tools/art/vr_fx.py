"""Vera's effect (vera.py writes it): gusts of wind round her body, the glass of the city on some
wall kick-offs and the Time Trial checkpoint she waits in.

The wind is drawn as pixel strokes along Bezier curves (one pixel wide, without corners, a
grey-blue edge under them), and every stroke is a little animation: it comes in at her front,
goes round her and leaves at her back in tatters, in four frames."""
import math

# ------------------------------------------------------------------ strokes of air


def curve(*ctrl):
    """The pixels of a cubic Bezier through control points (x, y) (y down), in order along it, one
    pixel wide and without L corners."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = ctrl
    n = 200
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3
        y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
        p = (math.floor(x + 0.5), math.floor(y + 0.5))
        if not pts or pts[-1] != p:
            pts.append(p)
    # Pixel-perfect: drop a pixel standing in the corner of an L (its neighbours touch diagonally).
    out = []
    for i, p in enumerate(pts):
        if 0 < i < len(pts) - 1 and out:
            a, b = out[-1], pts[i + 1]
            if abs(a[0] - b[0]) == 1 and abs(a[1] - b[1]) == 1:
                continue
        out.append(p)
    return out


# Along a stroke, from its tail to its head: the head leads, white, the tail thins out; a grey-blue
# edge under the stroke makes it read on the white city as on the sky.
def _tone(t):
    if t > 0.75:
        return 'W'
    if t > 0.45:
        return 'a'
    if t > 0.2:
        return 'b'
    return 'f'


def stroke(pts, windows, torn=(), box=None):
    """Frames of a stroke: `windows` are (from, to) fractions of the curve shown in each frame (the
    curve runs from her front to her back); a frame in `torn` is in tatters (two pixels on, one
    off). `box` (x0, y0, x1, y1) is the canvas, shared by strokes that must stay together."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, y0, x1, y1 = box or (min(xs), min(ys), max(xs), max(ys))
    w = x1 - x0 + 1
    h = y1 - y0 + 2  # a row more for the edge under it
    n = len(pts) - 1
    frames = []
    for k, (lo, hi) in enumerate(windows):
        g = [['.'] * w for _ in range(h)]
        i0, i1 = round(lo * n), round(hi * n)
        span = max(1, i1 - i0)
        on = set()
        for i in range(i0, i1 + 1):
            if k in torn and (i1 - i) % 3 == 2:
                continue
            x, y = pts[i][0] - x0, pts[i][1] - y0
            g[y][x] = _tone((i - i0) / span)
            on.add((x, y))
        for (x, y) in sorted(on):
            # The edge goes along its runs, not where it turns over itself (a curl stays clean).
            run = (x - 1, y) in on or (x + 1, y) in on
            near = {(x, y - 1), (x, y + 1), (x, y + 2)} & on
            if run and not near and g[y][x] in 'Wab' and g[y + 1][x] == '.':
                g[y + 1][x] = 'g'
        frames.append([''.join(r) for r in g])
    return frames


# Coming in at her front, round her, leaving at her back, in tatters.
PASS = [(0.0, 0.45), (0.0, 1.0), (0.35, 1.0), (0.7, 1.0)]
TORN = (3,)


# How many frames each stroke has (a stroke that comes later starts with empty frames).
FRAMES = {}


def _named(name, frames, delay=0):
    blank = ['.' * len(frames[0][0])] * len(frames[0])
    frames = [blank] * delay + frames
    FRAMES[name] = len(frames)
    return {f'{name}{i}': rows for i, rows in enumerate(frames)}


def wrap(rx, ry, shift, drop, lens=0.55):
    """One turn of air round her, as the air parts round a body: seen from the side and a little from
    above, its far strand bows up behind her and its near strand, further back and lower, bows down
    in front of her; open, so that off her body it is a wave of wind and not a ring. Both run from
    her front (right) to her back (left), on one canvas, so that they stay together."""
    k = 4 / 3 * ry
    far = curve((rx, 0), (rx * lens, -k), (-rx * lens, -k), (-rx, 0))
    near = curve((rx - shift, drop), (rx * lens - shift, drop + k), (-rx * lens - shift, drop + k),
                 (-rx - shift, drop))
    both = far + near
    box = (min(p[0] for p in both), min(p[1] for p in both), max(p[0] for p in both),
           max(p[1] for p in both))
    return stroke(far, PASS, TORN, box), stroke(near, PASS, TORN, box)


def sprites():
    out = {}
    # Round her chest, and a moment later round her thighs: the gust runs down her.
    turns = {'chest': (10, 3, 9, 3, 0), 'legs': (8, 2, 7, 2, 1)}
    for name, (rx, ry, shift, drop, delay) in turns.items():
        far, near = wrap(rx, ry, shift, drop)
        out.update(_named(f'{name}-far', far, delay))
        out.update(_named(f'{name}-near', near, delay))
    return out


def anim(name, fps=11):
    if not FRAMES:
        sprites()
    return {'frames': [f'{name}{i}' for i in range(FRAMES[name])], 'fps': fps, 'loop': False}


# A stroke of air: it keeps her pace for a moment (inherit 1), then the air lets go of it (drag)
# and it falls behind her, gone in about 0.4 s. The two strands of a turn start at the same point
# and move the same way (no jitter, no ranges), so they stay one turn.
AIR = {'speed': 12, 'angle': 0, 'inherit': 1, 'drag': 3, 'life': 380, 'fadeIn': 20, 'fadeOut': 120,
       'face': True}

# A gust comes on a clock of its own, not on a roll of the dice: emitters with the same `while`,
# `perSecond` and `minSpeed` count the same way, so all the strokes of a gust come on the same
# step (chances are rolled emitter by emitter and would split a turn's strands).
# - Running fast (near full speed, as on the character screen): one every 3.6 s of it. A clock of
#   time, not of distance: when the body's point jumps from the hands to the feet the distance
#   jumps too, and the gust would come on that step and be thrown off.
# - Flipping: one every 1.7 s spent in flips, about one flip in two, at a moment of the flip that
#   changes from flip to flip (not when it starts: a trick's first step can throw the air off the
#   same way). In the air it falls a little with her.
# Not with reduced motion. Vaults and wall moves have none: their first steps throw it off, and
# the wall has its glass.
RUN = {'while': ['run'], 'perSecond': 0.28, 'minSpeed': 90, 'reduced': 0}
FLIP = {'while': ['flip'], 'perSecond': 0.6, 'reduced': 0, 'gravity': 200}


def gust(name, anchor, offset, layer, clock, **more):
    return {**clock, 'anchor': anchor, 'offset': offset, **AIR, 'sprite': anim(name), 'layer': layer,
            **more}


FX = {
    'palette': {
        # Air: white, pale and grey-blue, see-through.
        'W': '#fffffff0', 'a': '#e3eef7d8', 'b': '#aac0d4d0', 'f': '#b9cbdba0', 'g': '#6f8aa8e0',
        # Glass: a white glint, pale and deep blue.
        'w': '#ffffff', 'c': '#c5e2f2', 'C': '#75a9ce', 'D': '#2e5c84',
        # The Time Trial checkpoint.
        'p': '#ff3a1ab0', 'P': '#ff1a1070',
    },
    'sprites': {
        **sprites(),
        # A Time Trial checkpoint's wall, rising.
        'seg': ['p', 'p', 'P', 'P'],
        # The checkpoint's ring on the ground.
        'ring': ['.....PPPPPPPPPPP.....', '..PPP...........PPP..', 'PP.................PP',
                 '..ppp...........ppp..', '.....ppppppppppp.....'],
        # Glass: a white glint, pale and deep blue.
        'shard1': ['w...', 'cw..', 'cCw.', 'DDCw'],
        'shard2': ['.w', 'wc', 'cC', 'D.'],
        'shard3': ['wcc', '.CD'],
        'shard4': ['.w.', 'wcC', 'DD.'],
    },
    'emitters': {
        # Running fast: a turn of air round her chest and, a moment later, round her thighs, their
        # far strands behind her and their near strands in front.
        'run-chest-far': gust('chest-far', 'chest', [2, 0], 'behind', RUN),
        'run-chest-near': gust('chest-near', 'chest', [2, 0], 'front', RUN),
        'run-legs-far': gust('legs-far', 'hips', [2, 7], 'behind', RUN, life=460),
        'run-legs-near': gust('legs-near', 'hips', [2, 7], 'front', RUN, life=460),
        # Flipping: the same round her hips, the middle she turns round, so it stays on her.
        'flip-chest-far': gust('chest-far', 'hips', [0, -6], 'behind', FLIP),
        'flip-chest-near': gust('chest-near', 'hips', [0, -6], 'front', FLIP),
        'flip-legs-far': gust('legs-far', 'hips', [1, 4], 'behind', FLIP, life=460),
        'flip-legs-near': gust('legs-near', 'hips', [1, 4], 'front', FLIP, life=460),
        # Glass off the wall on some kick-offs (the tic-tac jump, the wall flip).
        'kick-glass': {
            'moves': [20, 48], 'chance': 0.2, 'burst': [4, 6], 'anchor': 'feet', 'jitter': [2, 4],
            'speed': [30, 75], 'angle': [-20, 200], 'gravity': 260, 'life': [450, 700], 'fadeOut': 260,
            'tumble': [2, 5], 'reduced': 0.3,
            'sprite': {'frames': ['shard1', 'shard2', 'shard3', 'shard4'], 'random': True},
        },
        # Presence: the Time Trial checkpoint she waits in: its ring on the ground, its two faint
        # walls and red specks rising round her.
        'checkpoint': {
            'perSecond': 7, 'anchor': 'feet', 'jitter': [9, 0], 'speed': [14, 28], 'angle': 90,
            'life': [900, 1400], 'fadeIn': 150, 'fadeOut': 500,
            'rect': {'size': 1, 'colors': ['#ff3a1ab0', '#ff6a3a99', '#ff1a10cc']},
        },
        'column-a': {
            'perSecond': 4, 'anchor': 'feet', 'offset': [10, 0], 'jitter': [0.5, 0], 'speed': [18, 28],
            'angle': 90, 'life': [1200, 1600], 'fadeIn': 200, 'fadeOut': 600, 'reduced': 0.5,
            'sprite': {'frames': ['seg']},
        },
        'column-b': {
            'perSecond': 4, 'anchor': 'feet', 'offset': [-10, 0], 'jitter': [0.5, 0], 'speed': [18, 28],
            'angle': 90, 'life': [1200, 1600], 'fadeIn': 200, 'fadeOut': 600, 'reduced': 0.5,
            'sprite': {'frames': ['seg']},
        },
        'ring': {
            'perSecond': 1.5, 'anchor': 'feet', 'offset': [0, -1], 'speed': 0, 'life': 1000, 'fadeIn': 300,
            'fadeOut': 500, 'reduced': 1, 'sprite': {'frames': ['ring']},
        },
        # Leaving and coming back: a gust round where she stands, a few glass shards.
        'whirl-back': {
            'burst': [3, 4], 'anchor': 'body', 'jitter': [5, 2], 'speed': [30, 60], 'angle': [-8, 8],
            'drag': 2, 'life': [300, 400], 'fadeOut': 140, 'face': True, 'reduced': 0.3,
            'sprite': anim('chest-far', 11),
        },
        'whirl-front': {
            'burst': [2, 3], 'anchor': 'body', 'jitter': [5, 2], 'speed': [30, 60], 'angle': [-8, 8],
            'drag': 2, 'life': [300, 400], 'fadeOut': 140, 'face': True, 'layer': 'front', 'reduced': 0.3,
            'sprite': anim('chest-near', 11),
        },
        'shatter': {
            'burst': [5, 8], 'anchor': 'feet', 'speed': [30, 70], 'angle': [20, 160], 'gravity': 280,
            'life': [400, 700], 'fadeOut': 250, 'tumble': [2, 5], 'reduced': 0.3,
            'sprite': {'frames': ['shard1', 'shard2', 'shard3', 'shard4'], 'random': True},
        },
    },
    'variants': {
        # The wind: gusts now and then while she runs fast and while she flips.
        'gust': {'emitters': ['run-chest-far', 'run-chest-near', 'run-legs-far', 'run-legs-near',
                              'flip-chest-far', 'flip-chest-near', 'flip-legs-far', 'flip-legs-near']},
        'glass': {'emitters': ['kick-glass']},
    },
    'presence': {'idle': ['ring', 'checkpoint', 'column-a', 'column-b'],
                 'vanish': ['whirl-back', 'whirl-front', 'shatter'],
                 'appear': ['whirl-back', 'whirl-front', 'shatter']},
}


def write():
    import json
    from lookgen import BOSSES, write_json
    from tricks import tricks
    write_json(BOSSES + '/vera/fx.json', tricks(json.loads(json.dumps(FX)), 'vera'))
    b = json.load(open(BOSSES + '/vera/boss.json', encoding='utf-8'))
    b['effect'] = ['gust', 'glass']
    write_json(BOSSES + '/vera/boss.json', b)


if __name__ == '__main__':
    # The effect alone (vera.py writes the looks too).
    write()
    print('vera fx written')
