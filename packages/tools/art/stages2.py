"""The other bosses' worlds (see stages.py)."""
import math
from lookgen import Canvas
from scene import blob, foliage, lit_blob, palm, pine, rng, skyline, strip, tree, building
from stages import stage


POOL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*=?@^~<>/|;:'


def ch(P, colour):
    """The palette character of a colour, added to the palette if it is new."""
    for k, v in P.items():
        if v.lower() == colour.lower():
            return k
    k = next(c for c in POOL if c not in P)
    P[k] = colour
    return k


def chs(P, colours):
    return [ch(P, c) for c in colours]


def rain(colours, per=30):
    return {'perSecond': per, 'anchor': 'head', 'jitter': [0, 30], 'offset': [0, -40], 'speed': [150, 190],
            'angle': [-104, -97], 'life': [500, 700], 'fadeOut': 100, 'rect': {'size': 1, 'colors': colours}}


def motes(colours, per=5, rise=True):
    return {'perSecond': per, 'anchor': 'body', 'jitter': [0, 25], 'speed': [4, 12],
            'angle': [70, 110] if rise else [-110, -70], 'gravity': -6 if rise else 6, 'life': [1500, 2600],
            'fadeIn': 300, 'fadeOut': 700, 'flutter': {'amp': 2, 'freq': 0.8},
            'rect': {'size': 1, 'colors': colours}, 'blend': 'add'}


def cloud(w, h, seed, tones):
    c = Canvas(w, h)
    r = rng(seed)
    for _ in range(7):
        cx, cy = r.uniform(w * 0.2, w * 0.8), r.uniform(h * 0.45, h * 0.7)
        rx = r.uniform(w * 0.12, w * 0.24)
        lit_blob(c, cx, cy, rx, rx * 0.65, tones[0], tones[1], tones[2])
    return c.rows()


# ----------------------------------------------------------------------------------------- Grove
@stage
def grove():
    """Grove Street at sundown: an orange sky with palms against it, the downtown haze, the
    houses of the street with their porches, a lowrider, the hoop over the wall with the tag."""
    P = {'k': '#1e1620', 'p': '#2c1e34', 'P': '#3e2a44', 'd': '#5a3c4c',
         'w': '#e8d8c0', 'W': '#c4b098', 'x': '#9a8470', 'r': '#a8482c', 'R': '#7a3220', 'y': '#ffd27a',
         'g': '#3fae4c', 'G': '#2a7a34', 'm': '#6a8a5a', 'M': '#4a6a40', 'b': '#3a3a48', 'B': '#4e4e60',
         'c': '#7a4a8a', 'C': '#a86ac0', 'v': '#e0e0e8', 'o': '#c86a3a', 's': '#8a8a96', 'S': '#5e5e6a',
         'l': '#4a3a2a', 'L': '#6a5440', 'e': '#b0a090', 'E': '#8a7a6c', 'f': '#2a2a34', 'z': '#ffffff'}

    def house(seed, wall, side):
        c = Canvas(46, 34)
        c.rect(0, 10, 40, 24, wall).rect(34, 10, 6, 24, side)
        for i in range(10):
            c.rect(i * 2, 10 - i, 46 - i * 4, 1, 'r' if i % 2 else 'R')
        c.rect(4, 20, 8, 8, 'y').rect(4, 20, 8, 1, 'k').rect(7, 20, 1, 8, 'k')
        c.rect(20, 18, 7, 16, 'l').rect(21, 19, 5, 15, 'L').set(25, 26, 'y')
        c.rect(14, 28, 26, 1, 'W').rect(14, 29, 1, 5, 'W').rect(39, 29, 1, 5, 'W')
        return c.rows()

    def lowrider():
        c = Canvas(40, 12)
        c.rect(2, 4, 36, 5, 'c').rect(8, 0, 20, 5, 'c').rect(10, 1, 7, 3, 'v').rect(19, 1, 7, 3, 'v')
        c.rect(2, 4, 36, 1, 'C').rect(0, 6, 40, 1, 's')
        for x in (8, 30):
            blob(c, x, 9, 2.6, 2.6, 'f')
            c.set(x, 9, 's')
        return c.rows()

    def wall():
        c = Canvas(60, 22)
        c.rect(0, 2, 60, 20, 'e').rect(0, 2, 60, 1, 'v')
        for y in range(5, 22, 4):
            c.rect(0, y, 60, 1, 'E')
        for x, ch in ((6, 'G'), (8, 'g'), (14, 'g'), (20, 'g'), (26, 'G'), (32, 'g')):
            c.rect(x, 7, 2, 10, ch)
        c.rect(6, 7, 6, 2, 'g').rect(6, 11, 6, 2, 'g').rect(14, 7, 6, 2, 'g').rect(14, 11, 5, 2, 'g')
        c.rect(20, 7, 6, 2, 'g').rect(20, 15, 6, 2, 'g').rect(26, 7, 6, 2, 'g').rect(26, 11, 6, 2, 'g')
        c.rect(26, 15, 6, 2, 'g').rect(40, 9, 12, 5, 'C').rect(41, 10, 10, 3, 'c')
        return c.rows()

    def hoop():
        c = Canvas(14, 40)
        c.rect(6, 8, 2, 32, 's').rect(1, 0, 12, 9, 'v').rect(1, 0, 12, 1, 's').rect(4, 3, 6, 4, 'o')
        c.rect(5, 4, 4, 2, 'v').rect(3, 9, 8, 1, 'o').line(3, 10, 5, 14, 'v').line(10, 10, 8, 14, 'v')
        return c.rows()

    sun = Canvas(18, 18)
    blob(sun, 9, 9, 8.5, 8.5, '#')
    P['#'] = '#ffcf7a'
    return {
        'palette': P,
        'sky': ['#3a2a5a', '#5a3466', '#8a3e62', '#c0505a', '#e46a4c', '#f4904a', '#fab060', '#fcd08a'],
        'tint': '#ff804010',
        'sprites': {
            'sun': sun.rows(), 'downtown': skyline(140, 40, 'd', seed=4, lights=['y'], light_share=0.05),
            'palm-far': palm(40, ('p', 'P'), ('p', 'P')), 'palm': palm(52, ('m', 'M'), ('l', 'L')),
            'house-a': house(1, 'w', 'W'), 'house-b': house(2, 'e', 'E'), 'car': lowrider(), 'wall': wall(),
            'hoop': hoop(), 'street': strip(48, 10, chs(P, ['#9a9aa6', '#6a6a78', '#545462']), seed=5),
        },
        'ground': 'street',
        'layers': [
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'sun', 'x': 70, 'y': 26}]},
            {'speed': 0.08, 'period': 140, 'alpha': 0.7, 'items': [{'sprite': 'downtown', 'x': 0, 'y': 0}]},
            {'speed': 0.2, 'period': 120, 'items': [{'sprite': 'palm-far', 'x': 10, 'y': 0},
                                                     {'sprite': 'palm-far', 'x': 70, 'y': 0}]},
            {'speed': 0.5, 'period': 200, 'items': [{'sprite': 'house-a', 'x': 0, 'y': 0},
                                                     {'sprite': 'palm', 'x': 44, 'y': 0},
                                                     {'sprite': 'house-b', 'x': 90, 'y': 0},
                                                     {'sprite': 'car', 'x': 140, 'y': 0}]},
            {'speed': 1, 'period': 180, 'items': [{'sprite': 'wall', 'x': 0, 'y': 0}, {'sprite': 'hoop', 'x': 64, 'y': 0}]},
        ],
        'ambient': ['dust'],
        'emitters': {'dust': motes(['#ffd8a0', '#ffb070'], per=3)},
    }


# ------------------------------------------------------------------------------------------ Vera
@stage
def vera():
    """A city of white glass towers in hard sunlight; rooftops of vents and pipes, the red marks
    of the runners' paths on them; a crane against the blue."""
    P = {'w': '#f8fafc', 'W': '#dfe6ee', 'X': '#b8c4d2', 'g': '#8ec8f0', 'G': '#5aa0d8', 'h': '#d8f0ff',
         'r': '#e5332a', 'R': '#a01c18', 's': '#8a94a2', 'S': '#5e6876', 'k': '#2a2e36', 'y': '#ffd040',
         'c': '#c8d2de', 'C': '#9aa6b6'}

    def tower(w, h, seed):
        c = Canvas(w, h)
        c.rect(0, 0, w, h, 'W').rect(0, 0, w // 3, h, 'w').rect(w - 3, 0, 3, h, 'X')
        r = rng(seed)
        for y in range(2, h - 2, 3):
            for x in range(1, w - 3, 2):
                c.set(x, y, 'g' if r.random() < 0.7 else 'h')
                c.set(x, y + 1, 'G' if r.random() < 0.6 else 'g')
        c.rect(0, 0, w, 1, 'X')
        return c.rows()

    def crane():
        c = Canvas(60, 70)
        for y in range(10, 70):
            c.set(40, y, 'r').set(43, y, 'R')
            if y % 4 == 0:
                c.line(40, y, 43, y + 3, 'R')
        c.rect(0, 8, 60, 2, 'r').rect(36, 4, 10, 4, 'R')
        for x in range(0, 58, 4):
            c.line(x, 10, x + 2, 8, 'R')
        c.line(8, 10, 8, 30, 'k').rect(6, 30, 5, 3, 'k')
        return c.rows()

    def roof():
        c = Canvas(90, 26)
        c.rect(0, 14, 90, 12, 'c').rect(0, 14, 90, 1, 'w')
        c.rect(6, 4, 14, 10, 'W').rect(6, 4, 14, 1, 'w').rect(17, 4, 3, 10, 'X')
        for x in range(8, 16, 3):
            c.rect(x, 6, 2, 6, 'S')
        c.rect(30, 8, 30, 3, 's').rect(30, 8, 30, 1, 'c').rect(58, 0, 3, 11, 's')
        c.rect(70, 6, 10, 8, 'W').rect(70, 6, 10, 1, 'w').rect(72, 2, 6, 4, 'X')
        # The runner's marks: red on what to use.
        c.rect(30, 7, 30, 1, 'r').rect(70, 5, 10, 1, 'r').rect(6, 3, 14, 1, 'r')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#3a8ad8', '#4a9ae0', '#62acea', '#7cbef0', '#9ad0f6', '#bce2fa', '#dcf0fc', '#f4fafe'],
        'sprites': {
            'far': skyline(160, 60, ch(P, '#c4d2e2'), seed=8, min_h=0.4),
            'tower-a': tower(22, 80, 1), 'tower-b': tower(30, 66, 2), 'tower-c': tower(18, 92, 3),
            'crane': crane(), 'roof': roof(), 'deck': strip(48, 10, chs(P, ['#ffffff', '#e4eaf0', '#c8d2de']), noise=0.08),
            'cloud': cloud(50, 16, 4, chs(P, ['#ffffff', '#eaf4fc', '#cfe2f2'])),
        },
        'ground': 'deck',
        'layers': [
            {'speed': 0.02, 'period': 300, 'drift': 3, 'items': [{'sprite': 'cloud', 'x': 20, 'y': 70},
                                                                 {'sprite': 'cloud', 'x': 180, 'y': 82}]},
            {'speed': 0.06, 'period': 160, 'alpha': 0.75, 'items': [{'sprite': 'far', 'x': 0, 'y': 0}]},
            {'speed': 0.2, 'period': 170, 'items': [{'sprite': 'tower-a', 'x': 0, 'y': 0}, {'sprite': 'crane', 'x': 26, 'y': 0},
                                                     {'sprite': 'tower-c', 'x': 96, 'y': 0}, {'sprite': 'tower-b', 'x': 130, 'y': 0}]},
            {'speed': 1, 'period': 90, 'items': [{'sprite': 'roof', 'x': 0, 'y': 0}]},
        ],
        'ambient': ['glints'],
        'emitters': {'glints': {'perSecond': 2, 'anchor': 'body', 'jitter': [0, 30], 'offset': [-30, -20], 'speed': 0,
                                'life': [200, 400], 'fadeOut': 200, 'rect': {'size': 1, 'colors': ['#ffffff']},
                                'blend': 'add'}},
    }


# -------------------------------------------------------------------------------------------- B-2
@stage
def b2():
    """A city taken back by green: broken towers with vines, a collapsed overpass, grass over the
    road, light falling through haze and spores drifting in it; an old machine sitting still."""
    P = {'s': '#b8b4a6', 'S': '#8e8a7e', 'd': '#6a665c', 'D': '#4e4a42', 'g': '#7aa04a', 'G': '#5a7e36',
         'q': '#3e5a26', 'v': '#8ab85a', 'w': '#e8e4d4', 'k': '#2a2824', 'm': '#7a7468', 'M': '#5a5448',
         'y': '#e8e0a0', 'f': '#d8d0b0', 'o': '#c8a040'}

    def ruin(w, h, seed):
        c = Canvas(w, h)
        r = rng(seed)
        top = [int(h * (0.1 + 0.5 * r.random())) for _ in range(w)]
        for x in range(w):
            if x > 0 and r.random() < 0.7:
                top[x] = top[x - 1] + r.randint(-2, 2)
            for y in range(max(0, top[x]), h):
                c.set(x, y, 's' if x < w * 0.7 else 'S')
        for y in range(4, h - 2, 5):
            for x in range(2, w - 2, 4):
                if c.get(x, y) != '.':
                    c.rect(x, y, 2, 3, 'D')
        for _ in range(w // 2):
            x = r.randrange(w)
            y0 = max(0, top[x])
            for y in range(y0, min(h, y0 + r.randint(4, 14))):
                c.set(x, y, r.choice(['g', 'G', 'q']))
        return c.rows()

    def column(broken):
        c = Canvas(12, 40)
        top = 14 if broken else 0
        c.rect(2, top + 4, 8, 36 - top, 's').rect(7, top + 4, 3, 36 - top, 'S').rect(0, top, 12, 4, 'w').rect(0, 36, 12, 4, 'w')
        if broken:
            for x in range(2, 10):
                c.set(x, top + 4 - (x % 3), 's')
        for y in range(top + 6, 38, 3):
            c.set(3 + y % 5, y, 'G').set(4 + y % 5, y + 1, 'g')
        return c.rows()

    def machine():
        c = Canvas(20, 18)
        lit_blob(c, 10, 6, 6, 5, 'm', 'M', 'k')
        c.set(12, 5, 'o').set(13, 5, 'o')
        c.rect(6, 10, 8, 4, 'M').rect(4, 14, 3, 4, 'k').rect(13, 14, 3, 4, 'k').rect(1, 9, 3, 5, 'k').rect(16, 9, 3, 5, 'k')
        return c.rows()

    def grass():
        c = Canvas(48, 10)
        c.rect(0, 0, 48, 10, 'D').rect(0, 0, 48, 2, 'G')
        r = rng(2)
        for x in range(48):
            for y in range(0, r.randint(1, 4)):
                c.set(x, y, r.choice(['g', 'G', 'v']))
            if r.random() < 0.08:
                c.set(x, 0, 'y')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#a8b4b0', '#b8c2bc', '#c6cec4', '#d2d8cc', '#dce0d2', '#e4e6d8', '#ececdc'],
        'sprites': {'far': ruin(160, 60, 1), 'near': ruin(90, 46, 2), 'column': column(False), 'broken': column(True),
                    'machine': machine(), 'grass': grass()},
        'ground': 'grass',
        'layers': [
            {'speed': 0.08, 'period': 160, 'alpha': 0.55, 'items': [{'sprite': 'far', 'x': 0, 'y': 0}]},
            {'speed': 0.3, 'period': 180, 'alpha': 0.9, 'items': [{'sprite': 'near', 'x': 0, 'y': 0}]},
            {'speed': 1, 'period': 150, 'items': [{'sprite': 'column', 'x': 0, 'y': 0}, {'sprite': 'broken', 'x': 50, 'y': 0},
                                                   {'sprite': 'machine', 'x': 90, 'y': 0}]},
        ],
        'ambient': ['spores'],
        'emitters': {'spores': motes(['#fff8c0', '#e8f0a0', '#ffffff'], per=6)},
    }


# ------------------------------------------------------------------------------------ Sir Nobody
@stage
def sir_nobody():
    """A castle at dusk: blue mountains, the castle's wall with its banners and burning torches,
    oaks in front; embers rising."""
    P = {'s': '#9a948a', 'S': '#7a746a', 't': '#5e5850', 'T': '#46423c', 'w': '#b8b2a6',
         'r': '#b01c1c', 'R': '#801010', 'y': '#e8b84a', 'Y': '#ffe08a', 'o': '#ff8a2a', 'O': '#ffd060', 'k': '#2a2620',
         'm': '#4a5a8a', 'M': '#3a4870', 'n': '#2c3658', 'b': '#5a3a22', 'B': '#7a5232',
         'g': '#3e6a34', 'G': '#2c5226', 'l': '#5a8a4a', 'q': '#1e3a1a'}

    def mountains():
        c = Canvas(160, 50)
        r = rng(5)
        for x in range(160):
            h = 22 + 16 * math.sin(x / 19) + 8 * math.sin(x / 7.3 + 1) + r.random() * 2
            for y in range(int(50 - h), 50):
                c.set(x, y, 'm' if (x // 20) % 2 else 'M')
            c.set(x, int(50 - h), 'w' if h > 38 else 'm')
        return c.rows()

    def wall():
        c = Canvas(64, 46)
        c.rect(0, 8, 64, 38, 'S')
        for x in range(0, 64, 12):
            c.rect(x, 0, 7, 8, 'S').rect(x, 0, 7, 1, 'w').rect(x + 5, 0, 2, 8, 't')
        for y in range(10, 46, 6):
            off = 0 if (y // 6) % 2 else 6
            for x in range(off, 64, 12):
                c.rect(x, y, 1, 6, 't')
            c.rect(0, y + 5, 64, 1, 't')
        c.rect(26, 22, 8, 24, 'T').disc(29.5, 22, 4, 'T')
        return c.rows()

    def banner():
        c = Canvas(12, 30)
        c.rect(0, 0, 12, 2, 'k').rect(1, 2, 10, 22, 'r').rect(1, 2, 1, 22, 'R').rect(9, 2, 2, 22, 'R')
        for i in range(5):
            c.rect(1 + i, 24 + i, 10 - 2 * i, 1, 'r')
        c.rect(4, 8, 4, 8, 'y').rect(3, 10, 6, 2, 'y').rect(5, 9, 2, 6, 'Y')
        return c.rows()

    def torch(frame):
        c = Canvas(7, 20)
        c.rect(3, 6, 1, 14, 'b').rect(2, 5, 3, 2, 'k')
        h = 4 + frame % 2
        c.rect(2, 6 - h + 1, 3, h - 1, 'o').rect(3, 6 - h, 1, h, 'O')
        c.set(2 + frame % 3, 6 - h - 1, 'Y')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#1c2148', '#2a2a5c', '#3e3266', '#5e3c68', '#8a4a62', '#b8605a', '#dc8058', '#f0a868'],
        'stars': {'count': 18, 'colors': ['#fff4d0', '#d8e0ff']},
        'tint': '#ff904010',
        'sprites': {'mountains': mountains(), 'wall': wall(), 'banner': banner(), 'torch1': torch(0), 'torch2': torch(1),
                    'torch3': torch(2), 'oak': tree(44, ['l', 'g', 'G', 'q'], ('B', 'b'), seed=4),
                    'oak2': tree(36, ['l', 'g', 'G', 'q'], ('B', 'b'), seed=9),
                    'stone': strip(32, 10, chs(P, ['#b8b2a6', '#7a746a', '#5e5850']), seed=3, noise=0.12)},
        'ground': 'stone',
        'layers': [
            {'speed': 0.06, 'period': 160, 'items': [{'sprite': 'mountains', 'x': 0, 'y': 0}]},
            {'speed': 0.4, 'period': 64, 'items': [{'sprite': 'wall', 'x': 0, 'y': 0}]},
            {'speed': 0.4, 'period': 192, 'items': [
                {'sprite': 'banner', 'x': 10, 'y': 12}, {'sprite': 'torch1', 'x': 48, 'y': 14, 'frames': ['torch1', 'torch2', 'torch3'], 'fps': 7},
                {'sprite': 'banner', 'x': 106, 'y': 12}, {'sprite': 'torch1', 'x': 150, 'y': 14, 'frames': ['torch2', 'torch3', 'torch1'], 'fps': 7}]},
            {'speed': 0.8, 'period': 200, 'items': [{'sprite': 'oak', 'x': 30, 'y': 0}, {'sprite': 'oak2', 'x': 130, 'y': 0}]},
        ],
        'ambient': ['embers'],
        'emitters': {'embers': {'perSecond': 5, 'anchor': 'body', 'jitter': [0, 20], 'speed': [8, 18], 'angle': [70, 110],
                                'gravity': -10, 'life': [1000, 1800], 'fadeOut': 600,
                                'rect': {'size': 1, 'colors': ['#ffb040', '#ff7020']}, 'blend': 'add'}},
    }


# --------------------------------------------------------------------------------------- Granger
@stage
def granger():
    """London on a grey afternoon: the clock tower over the river haze, rows of terraced houses
    with chimneys, a red phone box, a lamp post, a red bus going by, light drizzle."""
    P = {'s': '#8a6a5a', 'S': '#6a4e42', 't': '#4a3830', 'r': '#c02a24', 'R': '#8a1a16', 'w': '#e8ecf2', 'W': '#c8ccd4',
         'g': '#5a6270', 'G': '#3e4450', 'y': '#ffe08a', 'k': '#24262c', 'c': '#8a8e9a', 'C': '#6a6e7a', 'b': '#b8a888',
         'B': '#968668', 'o': '#d8b060'}

    def clock_tower():
        c = Canvas(20, 80)
        c.rect(4, 20, 12, 60, 'b').rect(12, 20, 4, 60, 'B')
        for y in range(24, 80, 4):
            c.rect(5, y, 6, 1, 'B')
        c.rect(3, 14, 14, 8, 'b').rect(13, 14, 4, 8, 'B')
        blob(c, 10, 17.5, 3.2, 3.2, 'w')
        c.set(10, 16, 'k').set(10, 17, 'k').set(11, 17, 'k')
        for i in range(10):
            c.rect(10 - (10 - i) // 2, 4 + i, 10 - i, 1, 'G' if i % 3 else 'g')
        c.rect(9, 0, 2, 4, 'g')
        return c.rows()

    def terrace(seed):
        c = Canvas(64, 40)
        r = rng(seed)
        for i, x in enumerate(range(0, 64, 16)):
            wall = 's' if i % 2 else 'S'
            c.rect(x, 8, 16, 32, wall)
            for y in (12, 22):
                c.rect(x + 3, y, 4, 6, 'y' if r.random() < 0.4 else 'G').rect(x + 9, y, 4, 6, 'y' if r.random() < 0.3 else 'G')
                c.rect(x + 3, y, 4, 1, 'w').rect(x + 9, y, 4, 1, 'w')
            c.rect(x + 6, 31, 5, 9, 'k').rect(x + 6, 31, 5, 1, 'w')
            c.rect(x, 6, 16, 2, 't').rect(x + 2, 0, 4, 6, 'S').rect(x + 2, 0, 4, 1, 't')
        return c.rows()

    def phone():
        c = Canvas(10, 26)
        c.rect(0, 2, 10, 24, 'r').rect(7, 2, 3, 24, 'R').rect(1, 0, 8, 2, 'r').rect(2, 4, 6, 2, 'k')
        for y in range(7, 22, 4):
            c.rect(2, y, 2, 3, 'W').rect(5, y, 2, 3, 'W')
        return c.rows()

    def lamp():
        c = Canvas(9, 34)
        c.rect(4, 6, 1, 28, 'k').rect(2, 0, 5, 6, 'k').rect(3, 1, 3, 4, 'y').rect(3, 31, 3, 3, 'k')
        return c.rows()

    def bus():
        c = Canvas(48, 28)
        c.rect(0, 2, 48, 22, 'r').rect(0, 2, 48, 1, 'w').rect(0, 13, 48, 1, 'R')
        for x in range(3, 44, 7):
            c.rect(x, 5, 5, 5, 'W').rect(x, 16, 5, 5, 'W')
        for x in (8, 38):
            blob(c, x, 25, 3, 3, 'k')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#6a7484', '#7a8494', '#8a94a2', '#9aa2ae', '#a8b0ba', '#b6bcc4', '#c4c8ce'],
        'sprites': {'tower': clock_tower(), 'far': skyline(160, 46, ch(P, '#8a909c'), seed=6, min_h=0.3),
                    'terrace': terrace(1), 'phone': phone(), 'lamp': lamp(), 'bus': bus(),
                    'cloud': cloud(60, 18, 9, chs(P, ['#c8ccd2', '#aeb4bc', '#959ca6'])),
                    'pavement': strip(32, 10, chs(P, ['#9aa0aa', '#6e747e', '#585e68']), seed=7, noise=0.1)},
        'ground': 'pavement',
        'layers': [
            {'speed': 0.02, 'period': 280, 'drift': 4, 'items': [{'sprite': 'cloud', 'x': 0, 'y': 60}, {'sprite': 'cloud', 'x': 150, 'y': 74}]},
            {'speed': 0.05, 'period': 160, 'alpha': 0.6, 'items': [{'sprite': 'far', 'x': 0, 'y': 0}]},
            {'speed': 0.08, 'period': 400, 'alpha': 0.8, 'items': [{'sprite': 'tower', 'x': 110, 'y': 0}]},
            {'speed': 0.45, 'period': 64, 'items': [{'sprite': 'terrace', 'x': 0, 'y': 0}]},
            {'speed': 0.6, 'period': 420, 'drift': -30, 'items': [{'sprite': 'bus', 'x': 0, 'y': 0}]},
            {'speed': 1, 'period': 200, 'items': [{'sprite': 'phone', 'x': 20, 'y': 0}, {'sprite': 'lamp', 'x': 120, 'y': 0}]},
        ],
        'ambient': ['drizzle'],
        'emitters': {'drizzle': rain(['#c8d0dc', '#aab4c4'], per=18)},
    }


# ---------------------------------------------------------------------------------------- Rush B
@stage
def rush_b():
    """A sun-baked desert town: domes and sandstone walls, an arch, the big B painted by the
    bombsite, crates, a palm, dust in the hot air."""
    P = {'s': '#e8c890', 'S': '#d4b074', 't': '#b8925a', 'T': '#94703e', 'd': '#6a4e2a', 'w': '#f4e4c0',
         'k': '#3a2c1c', 'b': '#2a2a30', 'c': '#a87a44', 'C': '#7a5630', 'g': '#6a8a3a', 'G': '#4a6a2a',
         'p': '#8a6a3a', 'P': '#6a4e2a', 'y': '#fff4c8'}

    def town():
        c = Canvas(160, 46)
        r = rng(3)
        x = 0
        while x < 160:
            w = r.randint(14, 26)
            h = r.randint(16, 34)
            c.rect(x, 46 - h, w, h, 'S').rect(x + w - 3, 46 - h, 3, h, 't')
            if r.random() < 0.4:
                blob(c, x + w / 2, 46 - h, w / 3, w / 4, 'w')
            for yy in range(46 - h + 4, 44, 7):
                c.rect(x + 3, yy, 2, 3, 'd')
            x += w + r.randint(0, 3)
        return c.rows()

    def wall():
        c = Canvas(80, 40)
        c.rect(0, 0, 80, 40, 's').rect(0, 0, 80, 2, 'w').rect(0, 2, 80, 1, 'T')
        c.rect(20, 10, 18, 30, 'k').disc(29, 10, 9, 'k').rect(20, 10, 18, 30, 'k')
        c.rect(22, 12, 14, 28, 'd').disc(29, 12, 7, 'd')
        for y in range(6, 40, 6):
            c.rect(0, y, 18, 1, 't').rect(40, y, 40, 1, 't')
        # The bombsite's B.
        c.rect(50, 8, 3, 20, 'b').rect(50, 8, 10, 3, 'b').rect(50, 16, 10, 3, 'b').rect(50, 25, 11, 3, 'b')
        c.rect(58, 10, 3, 7, 'b').rect(59, 18, 3, 8, 'b')
        return c.rows()

    def crates():
        c = Canvas(34, 28)
        for x0, y0, s in ((0, 12, 16), (16, 12, 16), (8, 0, 13)):
            c.rect(x0, y0, s, s, 'c').frame(x0, y0, s, s, 'C').line(x0, y0, x0 + s - 1, y0 + s - 1, 'C')
            c.rect(x0, y0, s, 1, 'p')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#5aa0e0', '#6eaee6', '#84bcec', '#9ccaf0', '#b6d8f2', '#cee4f2', '#e2ecf0', '#f0f0e8'],
        'sprites': {'town': town(), 'wall': wall(), 'crates': crates(), 'palm': palm(46, ('g', 'G'), ('p', 'P')),
                    'cloud': cloud(50, 14, 2, chs(P, ['#ffffff', '#eef4f8', '#d8e4ee'])),
                    'sand': strip(32, 10, chs(P, ['#f4dca8', '#e0c08a', '#c8a06a']), seed=4, noise=0.2)},
        'ground': 'sand',
        'layers': [
            {'speed': 0.02, 'period': 300, 'drift': 2, 'items': [{'sprite': 'cloud', 'x': 60, 'y': 84}]},
            {'speed': 0.12, 'period': 160, 'alpha': 0.8, 'items': [{'sprite': 'town', 'x': 0, 'y': 0}]},
            {'speed': 0.5, 'period': 240, 'items': [{'sprite': 'wall', 'x': 0, 'y': 0}, {'sprite': 'palm', 'x': 100, 'y': 0}]},
            {'speed': 1, 'period': 200, 'items': [{'sprite': 'crates', 'x': 40, 'y': 0}]},
        ],
        'ambient': ['dust'],
        'emitters': {'dust': {'perSecond': 6, 'anchor': 'feet', 'jitter': [0, 4], 'offset': [-40, -6], 'speed': [6, 16],
                              'angle': [-20, 20], 'life': [1200, 2000], 'fadeIn': 300, 'fadeOut': 600,
                              'rect': {'size': 1, 'colors': ['#f4dca8', '#e0c08a']}}},
    }


# ------------------------------------------------------------------------------------------ Five
@stage
def five():
    """Night City: magenta haze over megatowers, holographic signs flickering, flying cars
    crossing, a vending machine glowing at the kerb, rain."""
    P = {'k': '#14121c', 'K': '#221e30', 'q': '#2e2a40', 'Q': '#3c3652', 'm': '#ff2fa6', 'M': '#ffa0d8', 'c': '#3fe8ff',
         'C': '#bff8ff', 'y': '#fff060', 'Y': '#ffb020', 'w': '#ffffff', 'r': '#e02040', 'v': '#7a3aff', 'V': '#b088ff'}

    def towers(seed, tone, tall, rim):
        c = Canvas(140, tall)
        r = rng(seed)
        x = 0
        while x < 140:
            w = r.randint(9, 18)
            h = r.randint(tall // 3, tall)
            c.rect(x, tall - h, w, h, tone).rect(x, tall - h, 1, h, rim)
            for yy in range(tall - h + 3, tall - 2, 4):
                for xx in range(x + 2, x + w - 2, 3):
                    if r.random() < 0.08:
                        c.set(xx, yy, r.choice(['c', 'm', 'y', 'V']))
            if r.random() < 0.5:
                c.rect(x + w // 2, tall - h - 6, 1, 6, tone).set(x + w // 2, tall - h - 7, 'r')
            x += w + r.randint(3, 9)
        return c.rows()

    def holo(frame, text, colour, pole):
        """A sign on a pole `pole` px tall."""
        w = max(len(r) for r in text) + 4
        h = len(text) + 4
        c = Canvas(w, h + pole)
        c.frame(0, 0, w, h, 'Q').rect(1, 1, w - 2, h - 2, 'k')
        c.rect(w // 2 - 1, h, 2, pole, 'q').rect(w // 2, h, 1, pole, 'Q')
        if frame != 2:
            c.paste([r.replace('#', colour) for r in text], 2, 2)
        return c.rows()

    def car(colour):
        c = Canvas(18, 6)
        c.rect(2, 1, 14, 3, 'q').rect(5, 0, 7, 2, 'Q').rect(6, 0, 5, 1, 'C').rect(0, 2, 2, 1, 'y').rect(16, 2, 2, 1, 'r')
        c.rect(3, 4, 12, 1, colour)
        return c.rows()

    def vending():
        c = Canvas(14, 30)
        c.rect(0, 0, 14, 30, 'Q').rect(1, 1, 12, 4, 'm').rect(2, 2, 10, 2, 'M').rect(2, 7, 7, 16, 'c')
        for y in range(8, 22, 3):
            c.rect(3, y, 5, 1, 'C')
        c.rect(10, 8, 2, 4, 'y').rect(2, 25, 10, 3, 'k')
        return c.rows()

    sign_a = ['#.#.###.#.#', '#.#.#...##.', '###.##..#.#', '#.#.###.#.#']
    sign_b = ['###.###', '#...#.#', '###.###', '..#.#..', '###.#..']
    return {
        'palette': P,
        'sky': ['#120c24', '#1e1236', '#2c1646', '#3e1a54', '#561e5e', '#702464', '#8a2e66', '#a63a6a'],
        'stars': {'count': 10, 'colors': ['#ffd0f0', '#c0f0ff']},
        'sprites': {'far': towers(1, ch(P, '#3a2456'), 60, ch(P, '#5a2e6e')), 'mid': towers(2, 'K', 46, 'q'),
                    'sign-a1': holo(0, sign_a, 'm', 30), 'sign-a2': holo(1, sign_a, 'M', 30), 'sign-a3': holo(2, sign_a, 'm', 30),
                    'sign-b1': holo(0, sign_b, 'c', 22), 'sign-b2': holo(1, sign_b, 'C', 22), 'sign-b3': holo(2, sign_b, 'c', 22),
                    'car-a': car('m'), 'car-b': car('c'), 'vending': vending(),
                    'kerb': strip(32, 10, chs(P, ['#5a5a6e', '#221e30', '#2e2a40']), seed=6, noise=0.1)},
        'ground': 'kerb',
        'layers': [
            {'speed': 0.05, 'period': 140, 'alpha': 0.8, 'items': [{'sprite': 'far', 'x': 0, 'y': 0}]},
            {'speed': 0.12, 'period': 360, 'drift': 40, 'items': [{'sprite': 'car-a', 'x': 0, 'y': 70}, {'sprite': 'car-b', 'x': 170, 'y': 58}]},
            {'speed': 0.25, 'period': 140, 'items': [{'sprite': 'mid', 'x': 0, 'y': 0}]},
            {'speed': 0.35, 'period': 300, 'drift': -55, 'items': [{'sprite': 'car-b', 'x': 0, 'y': 46}]},
            {'speed': 0.55, 'period': 180, 'items': [
                {'sprite': 'sign-a1', 'x': 20, 'y': 0, 'frames': ['sign-a1', 'sign-a2', 'sign-a1', 'sign-a3', 'sign-a1', 'sign-a2'], 'fps': 5},
                {'sprite': 'sign-b1', 'x': 110, 'y': 0, 'frames': ['sign-b1', 'sign-b2', 'sign-b1', 'sign-b1', 'sign-b3'], 'fps': 4}]},
            {'speed': 1, 'period': 220, 'items': [{'sprite': 'vending', 'x': 80, 'y': 0}]},
        ],
        'ambient': ['rain'],
        'emitters': {'rain': rain(['#7a6aff', '#3fe8ff', '#ff2fa6'])},
    }


# --------------------------------------------------------------------------------- Flittermouse
@stage
def flittermouse():
    """A harbour city at night: the skyline under a full moon, the signal's beam with the bat in
    the clouds, warehouses with lit windows, a water tower, a gargoyle on the roof edge, rain."""
    P = {'k': '#0c0e18', 'K': '#161a2a', 'q': '#202640', 'Q': '#2c3454', 'y': '#ffd23a', 'Y': '#fff2a0',
         'l': '#ffe06a50', 'L': '#fff2a080', 'w': '#5a6488', 'g': '#3a4060', 's': '#4a5274', 'r': '#c02020',
         'm': '#e8ecf4', 'M': '#c4cad8'}

    def signal():
        c = Canvas(70, 100)
        for y in range(24, 100):
            half = 2 + (100 - y) // 6
            cx = 22 + (100 - y) // 3
            c.rect(cx - half, y, half * 2, 1, 'l')
        blob(c, 52, 14, 13, 10, 'L')
        c.paste(['..k.....k..', '.kkk.k.kkk.', 'kkkkkkkkkkk', '..kkkkkkk..', '....kkk....', '.....k.....'], 47, 11)
        return c.rows()

    def moon():
        c = Canvas(18, 18)
        lit_blob(c, 9, 9, 8, 8, 'm', 'M', 'w')
        c.set(6, 7, 'M').set(11, 11, 'M').set(10, 6, 'M')
        return c.rows()

    def warehouses():
        c = Canvas(110, 50)
        c.rect(0, 16, 50, 34, 'q')
        for i in range(10):
            c.rect(25 - i * 2 - 2, 6 + i, i * 4 + 4, 1, 'q')
        c.rect(54, 22, 56, 28, 'K')
        for x in range(58, 108, 8):
            c.rect(x, 28, 4, 3, 'y' if x % 3 else 'g')
        for x in range(6, 46, 8):
            c.rect(x, 26, 3, 2, 'y' if x % 3 == 0 else 'g')
        c.rect(80, 0, 2, 22, 'Q').rect(66, 0, 30, 2, 'Q')
        return c.rows()

    def water_tower():
        c = Canvas(20, 40)
        c.rect(2, 4, 16, 14, 'Q').rect(0, 2, 20, 3, 'q').rect(8, 0, 4, 2, 'q')
        for x in (3, 9, 15):
            c.rect(x, 18, 2, 22, 'K')
        c.line(3, 22, 16, 32, 'K').line(16, 22, 3, 32, 'K')
        return c.rows()

    def gargoyle():
        c = Canvas(18, 20)
        c.rect(0, 14, 18, 6, 's').rect(0, 14, 18, 1, 'w')
        c.disc(9, 9, 5, 'g').rect(5, 3, 2, 3, 'g').rect(11, 3, 2, 3, 'g').rect(7, 8, 1, 1, 'r').rect(11, 8, 1, 1, 'r')
        c.line(3, 6, 0, 2, 'g').line(15, 6, 17, 2, 'g')
        return c.rows()

    def ground():
        c = Canvas(32, 10)
        c.rect(0, 0, 32, 10, 'q').rect(0, 0, 32, 1, 'w').rect(0, 1, 32, 1, 's')
        for x in range(0, 32, 8):
            c.rect(x, 2, 1, 8, 'K')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#060814', '#0a0e20', '#0e142c', '#121a38', '#182244', '#1e2a50', '#26345c'],
        'stars': {'count': 24, 'colors': ['#dce4ff', '#ffffff']},
        'sprites': {'signal': signal(), 'moon': moon(), 'far': skyline(150, 60, ch(P, '#141a30'), seed=3, lights=['y', 'Y'], light_share=0.06),
                    'warehouses': warehouses(), 'tower': water_tower(), 'gargoyle': gargoyle(), 'ground': ground(),
                    'cloud': cloud(70, 18, 6, chs(P, ['#2c3454', '#202640', '#161a2a']))},
        'ground': 'ground',
        'layers': [
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'moon', 'x': 30, 'y': 70}]},
            {'speed': 0.02, 'period': 300, 'drift': 3, 'alpha': 0.9, 'items': [{'sprite': 'cloud', 'x': 0, 'y': 74},
                                                                               {'sprite': 'cloud', 'x': 160, 'y': 86}]},
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'signal', 'x': 84, 'y': 2}]},
            {'speed': 0.08, 'period': 150, 'items': [{'sprite': 'far', 'x': 0, 'y': 0}]},
            {'speed': 0.3, 'period': 110, 'items': [{'sprite': 'warehouses', 'x': 0, 'y': 0}]},
            {'speed': 0.6, 'period': 200, 'items': [{'sprite': 'tower', 'x': 30, 'y': 0}]},
            {'speed': 1, 'period': 240, 'items': [{'sprite': 'gargoyle', 'x': 140, 'y': 0}]},
        ],
        'ambient': ['rain'],
        'emitters': {'rain': rain(['#5a6a9a', '#8a9ac8'], per=28)},
    }


# -------------------------------------------------------------------------------------- Shahzada
@stage
def shahzada():
    """A palace at sunset: dunes and domed towers far off in gold haze, the arcade with its
    hanging lanterns, a palm, the great hourglass; sand on the wind."""
    P = {'s': '#f0d8a0', 'S': '#d8b878', 't': '#b8925a', 'T': '#8a6a3a', 'w': '#fff4d8', 'k': '#3a2614',
         'g': '#e8a838', 'G': '#c07a20', 'y': '#ffe08a', 'Y': '#fff6c8', 'o': '#ff9a3a', 'b': '#2f5fb0', 'B': '#4f86d8',
         'd': '#e0b070', 'D': '#c09050', 'p': '#5a8a3a', 'P': '#3e6a2a', 'r': '#8a5a2a', 'R': '#6a4020'}

    def dunes():
        c = Canvas(160, 30)
        for x in range(160):
            h = 12 + 8 * math.sin(x / 21) + 5 * math.sin(x / 9 + 2)
            for y in range(int(30 - h), 30):
                c.set(x, y, 'd' if math.cos(x / 21) > 0 else 'D')
        return c.rows()

    def domes():
        c = Canvas(120, 60)
        for x0, w, h, dome in ((4, 16, 30, 9), (26, 22, 40, 12), (52, 10, 50, 0), (66, 26, 34, 14), (98, 14, 28, 8)):
            c.rect(x0, 60 - h, w, h, 'S').rect(x0 + w - 3, 60 - h, 3, h, 't')
            if dome:
                lit_blob(c, x0 + w / 2, 60 - h, dome * 0.75, dome * 0.8, 'y', 'g', 'G')
                c.rect(int(x0 + w / 2), 60 - h - dome - 3, 1, 3, 'g')
            else:
                c.rect(x0 + 3, 60 - h - 8, 4, 8, 'S').rect(x0 + 4, 60 - h - 12, 2, 4, 'g')
            for yy in range(60 - h + 5, 58, 7):
                c.rect(x0 + 3, yy, 2, 4, 'k')
        return c.rows()

    def arcade():
        c = Canvas(64, 50)
        c.rect(0, 0, 64, 6, 's').rect(0, 0, 64, 1, 'w').rect(0, 5, 64, 1, 't')
        for x in range(0, 64, 16):
            c.rect(x, 6, 4, 44, 'S').rect(x + 3, 6, 1, 44, 't')
            for i in range(6):
                c.rect(x + 4 + i, 6 + i, 12 - 2 * i, 1, 'S')
        return c.rows()

    def lantern(frame):
        c = Canvas(7, 16)
        c.rect(3, 0, 1, 5, 'k').rect(1, 5, 5, 7, 'G').rect(2, 6, 3, 5, 'y' if frame else 'Y').rect(2, 12, 3, 2, 'G')
        return c.rows()

    def hourglass():
        c = Canvas(18, 28)
        c.rect(0, 0, 18, 3, 'r').rect(0, 25, 18, 3, 'r').rect(1, 3, 2, 22, 'R').rect(15, 3, 2, 22, 'R')
        for y in range(3, 14):
            w = 12 - (y - 3)
            c.rect(9 - w // 2, y, w, 1, 'w' if y < 7 else 'y')
        for y in range(14, 25):
            w = 2 + (y - 14)
            c.rect(9 - w // 2, y, w, 1, 'w' if y < 20 else 'g')
        return c.rows()

    sun = Canvas(22, 22)
    blob(sun, 11, 11, 10.5, 10.5, 'y')
    blob(sun, 10.5, 10.5, 8, 8, 'Y')
    return {
        'palette': P,
        'sky': ['#5a3a6a', '#7a4466', '#a4505e', '#cc6650', '#e8844a', '#f4a44a', '#f8c460', '#fbdc8a'],
        'tint': '#ffa03010',
        'sprites': {'sun': sun.rows(), 'dunes': dunes(), 'domes': domes(), 'arcade': arcade(), 'lantern1': lantern(0),
                    'lantern2': lantern(1), 'palm': palm(50, ('p', 'P'), ('r', 'R')), 'hourglass': hourglass(),
                    'tiles': strip(32, 10, chs(P, ['#f4e0b0', '#d8b878', '#b8925a']), seed=8, noise=0.12)},
        'ground': 'tiles',
        'layers': [
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'sun', 'x': 40, 'y': 24}]},
            {'speed': 0.05, 'period': 160, 'items': [{'sprite': 'dunes', 'x': 0, 'y': 0}]},
            {'speed': 0.15, 'period': 160, 'alpha': 0.85, 'items': [{'sprite': 'domes', 'x': 20, 'y': 0}]},
            {'speed': 0.5, 'period': 64, 'items': [{'sprite': 'arcade', 'x': 0, 'y': 0}]},
            {'speed': 0.5, 'period': 128, 'items': [
                {'sprite': 'lantern1', 'x': 10, 'y': 30, 'frames': ['lantern1', 'lantern2'], 'fps': 3},
                {'sprite': 'lantern1', 'x': 74, 'y': 30, 'frames': ['lantern2', 'lantern1'], 'fps': 3}]},
            {'speed': 1, 'period': 240, 'items': [{'sprite': 'palm', 'x': 20, 'y': 0}, {'sprite': 'hourglass', 'x': 150, 'y': 0}]},
        ],
        'ambient': ['sand'],
        'emitters': {'sand': {'perSecond': 14, 'anchor': 'body', 'jitter': [0, 25], 'offset': [-60, 0], 'speed': [30, 60],
                              'angle': [-10, 10], 'life': [1500, 2500], 'fadeIn': 200, 'fadeOut': 600,
                              'flutter': {'amp': 2, 'freq': 1}, 'rect': {'size': 1, 'colors': ['#ffe08a', '#e8a838', '#fff4d8']}}},
    }


# ----------------------------------------------------------------------------------------- Azure
@stage
def azure():
    """A city of another world: a violet sky with two moons and a ringed planet, curved white
    spires lit blue, skybridges and floating platforms, flying cars in lanes at two depths,
    glowing plants by the walkway; blue motes drifting up."""
    P = {'w': '#f4f6ff', 'W': '#d4dcf0', 'X': '#a8b4d8', 'b': '#5aa0ff', 'B': '#8ac4ff', 'c': '#bfe4ff', 'v': '#9a6aff',
         'V': '#c8a8ff', 'k': '#141a3a', 'K': '#222a54', 'm': '#e8e0ff', 'M': '#b8b0e0', 'p': '#c8a0e8', 'P': '#9a70c0',
         'g': '#40e0c0', 'G': '#20a090', 'y': '#fff0a0', 'r': '#ff6a8a', 'n': '#6a5a9a'}

    def spire(h, seed, lean):
        c = Canvas(28, h)
        for y in range(h):
            t = y / h
            half = 1 + 5 * t ** 1.8
            cx = 14 + lean * (1 - t) ** 2 * 8
            for x in range(int(cx - half), int(cx + half) + 1):
                c.set(x, y, 'w' if x < cx - half * 0.3 else 'W' if x < cx + half * 0.4 else 'X')
        r = rng(seed)
        for y in range(6, h - 2, 4):
            t = y / h
            cx = 14 + lean * (1 - t) ** 2 * 8
            c.set(int(cx), y, 'b' if r.random() < 0.6 else 'c')
            c.set(int(cx) + 2, y + 1, 'B' if r.random() < 0.4 else 'X')
        c.rect(13, 0, 2, 3, 'B')
        # Rings of light round the spire.
        for y in (h // 3, h // 2 + 4):
            t = y / h
            half = 1 + 5 * t ** 1.8
            cx = 14 + lean * (1 - t) ** 2 * 8
            for x in range(int(cx - half - 3), int(cx + half + 4)):
                c.set(x, y, 'B' if x < cx else 'b')
        return c.rows()

    def platform():
        """A round terrace on a slender column."""
        c = Canvas(40, 48)
        c.rect(17, 10, 6, 38, 'W').rect(17, 10, 2, 38, 'w').rect(21, 10, 2, 38, 'X')
        for y in range(16, 46, 8):
            c.rect(17, y, 6, 1, 'b')
        lit_blob(c, 20, 6, 18, 4, 'w', 'W', 'X')
        c.rect(4, 6, 32, 1, 'b')
        return c.rows()

    def bridge():
        c = Canvas(120, 20)
        for x in range(120):
            y = 6 + int(5 * math.sin(x / 120 * math.pi))
            c.set(x, y, 'W').set(x, y + 1, 'X')
            if x % 10 == 0:
                c.set(x, y - 1, 'b')
        return c.rows()

    def car(colour, light):
        c = Canvas(14, 5)
        lit_blob(c, 7, 2, 6.5, 2, 'w', colour, 'X')
        c.rect(0, 2, 1, 1, light).rect(13, 2, 1, 1, 'r')
        return c.rows()

    def moon(r_, tones):
        c = Canvas(int(r_ * 2 + 2), int(r_ * 2 + 2))
        lit_blob(c, r_ + 1, r_ + 1, r_, r_, *tones)
        return c.rows()

    def planet():
        c = Canvas(40, 24)
        lit_blob(c, 20, 12, 9, 9, 'p', 'P', 'n')
        for x in range(2, 38):
            y = 12 + int((x - 20) * 0.18)
            if not (12 < x < 28 and y < 12):
                c.set(x, y, 'V')
        return c.rows()

    def plant(frame):
        c = Canvas(14, 22)
        c.rect(6, 6, 2, 16, 'G')
        for i, (dx, dy) in enumerate(((-4, 2), (4, 0), (-3, 8), (4, 6))):
            blob(c, 7 + dx, 4 + dy, 3, 2, 'g' if (i + frame) % 2 else 'c')
        return c.rows()

    def walkway():
        c = Canvas(32, 10)
        c.rect(0, 0, 32, 10, 'K').rect(0, 0, 32, 1, 'c').rect(0, 1, 32, 1, 'b')
        for x in range(0, 32, 8):
            c.rect(x, 3, 4, 1, 'B')
        return c.rows()

    return {
        'palette': P,
        'sky': ['#0c0a2a', '#16123c', '#22184e', '#30205e', '#40286a', '#523272', '#663c78', '#7a4a7e'],
        'stars': {'count': 30, 'colors': ['#ffffff', '#c8d8ff', '#ffd8f8']},
        'sprites': {'moon-a': moon(7, ('m', 'M', 'n')), 'moon-b': moon(3.5, ('c', 'B', 'n')), 'planet': planet(),
                    'spire-a': spire(58, 1, 1), 'spire-b': spire(44, 2, -1), 'spire-c': spire(70, 3, 0.5),
                    'platform': platform(), 'bridge': bridge(), 'car-a': car('b', 'y'), 'car-b': car('v', 'c'),
                    'plant1': plant(0), 'plant2': plant(1), 'walkway': walkway(),
                    'far': skyline(160, 50, ch(P, '#2a2458'), seed=9, lights=['b', 'c', 'V'], light_share=0.07)},
        'ground': 'walkway',
        'layers': [
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'planet', 'x': 10, 'y': 66}, {'sprite': 'moon-a', 'x': 120, 'y': 82},
                                                    {'sprite': 'moon-b', 'x': 146, 'y': 74}]},
            {'speed': 0.05, 'period': 160, 'alpha': 0.75, 'items': [{'sprite': 'far', 'x': 0, 'y': 0}]},
            {'speed': 0.12, 'period': 260, 'drift': 30, 'items': [{'sprite': 'car-a', 'x': 0, 'y': 64}, {'sprite': 'car-b', 'x': 90, 'y': 60},
                                                                  {'sprite': 'car-a', 'x': 180, 'y': 67}]},
            {'speed': 0.2, 'period': 200, 'items': [{'sprite': 'spire-a', 'x': 0, 'y': 0}, {'sprite': 'bridge', 'x': 20, 'y': 40},
                                                     {'sprite': 'spire-c', 'x': 110, 'y': 0}, {'sprite': 'spire-b', 'x': 150, 'y': 0}]},
            {'speed': 0.35, 'period': 220, 'drift': -50, 'items': [{'sprite': 'car-b', 'x': 0, 'y': 44}, {'sprite': 'car-a', 'x': 120, 'y': 50}]},
            {'speed': 0.5, 'period': 180, 'items': [{'sprite': 'platform', 'x': 40, 'y': 0}]},
            {'speed': 1, 'period': 160, 'items': [{'sprite': 'plant1', 'x': 30, 'y': 0, 'frames': ['plant1', 'plant2'], 'fps': 1.5},
                                                   {'sprite': 'plant1', 'x': 110, 'y': 0, 'frames': ['plant2', 'plant1'], 'fps': 1.5}]},
        ],
        'ambient': ['motes'],
        'emitters': {'motes': motes(['#8ac4ff', '#bfe4ff', '#c8a8ff'], per=6)},
    }
