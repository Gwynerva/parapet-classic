"""The other bosses' worlds (see stages.py)."""
import math
from lookgen import Canvas
from scene import blob, lit_blob, palm, rng, skyline, strip, tree
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


# ----------------------------------------------------------------------------------------- Widow
@stage
def widow():
    """Château Guillard, Widowmaker's family house on the lake of Annecy, on a violet autumn night:
    the full moon in its halo over the snowy Alps, its light broken on the water, thin clouds going
    by; the round tower with its tall slate cone and a candle in its window, the mansards with a few
    lit windows, the great gothic window, the gold pennant over the belvedere's bell, all mirrored
    in the lake under drifting mist; a village's lights on the far shore; in the garden cypresses,
    a gas lamp and a stone dancer in arabesque (the ballerina she was); fog on the water; she runs
    along the stone balustrade, its lanterns flickering, a black widow let down on her thread by
    her web on a pillar; now and then a gold leaf falls."""
    P = {
        # the moon, its halo
        'm': '#f8f4ff', 'n': '#e2daf8', 'N': '#c4bae6', 'o': '#d2c8ee',
        'h': '#d8ccff0c', 'H': '#d8ccff16', '*': '#d8ccff22',
        # veils of cloud
        'c': '#5a5490', 'C': '#403b72', 'd': '#302c5c',
        # the Alps, far, and the shore under them
        'a': '#33386c', 'A': '#444c82', 'i': '#a4a6d6', 'I': '#7478ae', 'b': '#232749', 'B': '#30365c',
        # the lake, the moon's path on it
        'w': '#252a56', 'W': '#353c6e', 'x': '#1b1f45', 'r': '#e8deff', 'R': '#a49ad6',
        # château: stone (lit to deep shade), slate, windows, the pennant
        'S': '#7882a8', 's': '#565f86', 't': '#3e4569', 'T': '#2b3051', 'k': '#16182c',
        'U': '#5e70a6', 'q': '#404e84', 'Q': '#2e3966', 'u': '#1e2549',
        'v': '#141530', 'y': '#ffc85e', 'Y': '#fff0b4', 'O': '#b46a34', 'f': '#eabc4c', 'F': '#a87c26',
        # its reflection
        '!': '#384070', '$': '#2d3462', '%': '#22284d', '&': '#f0b45070',
        # rocks
        'l': '#4c5478', 'L': '#343a5a',
        # trees at night: gold, rust; cypresses; trunks and iron
        '4': '#c89c52', '1': '#966c3a', '2': '#66462e', '3': '#402c26',
        '8': '#cc844e', '5': '#a45c38', '6': '#76402c', '7': '#4c2c24',
        'p': '#243a3e', 'P': '#17252a', 'e': '#365254', 'j': '#2e2228', 'J': '#14131c',
        # the balustrade and the flagstones
        'z': '#68709e', 'Z': '#424a74', 'X': '#2f3558', 'K': '#1f233f',
        # lamps and their light
        'G': '#ffd27a', 'E': '#fff6d6', 'D': '#ffc85e1c', 'g': '#ffc85e34',
        # the web and its spider; mist and fog
        'V': '#e6e2ff80', '9': '#e02a2a',
        'M': '#cac2f21c', '0': '#cac2f236', '-': '#b4acec14', '=': '#b4acec26',
    }

    def moon():
        c = Canvas(20, 20)
        lit_blob(c, 10, 10, 9.5, 9.5, 'm', 'n', 'N')
        for cx, cy, rx, ry in ((7.5, 7, 2.2, 1.6), (12.5, 5.5, 1.6, 1.2), (11.5, 11.5, 2.6, 2.1),
                               (6.5, 12.5, 1.6, 1.3)):
            blob(c, cx, cy, rx, ry, 'o')  # the seas
        return c.rows()

    def halo():
        c = Canvas(48, 48)
        blob(c, 24, 24, 23.5, 23.5, 'h')
        blob(c, 24, 24, 18, 18, 'H')
        blob(c, 24, 24, 13.5, 13.5, '*')
        return c.rows()

    def veil(w, h, seed):
        """Thin streaks of cloud, their tops silvered by the moon, tapering at the ends."""
        c = Canvas(w, h)
        r = rng(seed)
        for i in range(h // 2 + 2):
            ln = r.randint(w // 4, w * 3 // 4)
            x0, y = r.randint(0, w - ln), r.randint(0, h - 2)
            for x in range(x0, x0 + ln):
                end = min(x - x0, x0 + ln - 1 - x)
                if end < 2 and r.random() < 0.5:
                    continue
                c.set(x, y, 'c' if c.get(x, y - 1) == '.' else 'C')
                if end > 3:
                    c.set(x, y + 1, 'd' if end < 8 else 'C')
        return c.rows()

    def alps(w, h, seed):
        """Snowy peaks, the moon's side (left) of each lit; the ridge tiles every `w` px."""
        c = Canvas(w, h)
        r = rng(seed)
        peaks, x = [], 0
        while x < w - 12:
            peaks.append((x + r.randint(0, 6), r.randint(int(h * 0.4), h - 2)))
            x += r.randint(18, 30)
        peaks = [(px - w, ph) for px, ph in peaks] + peaks + [(px + w, ph) for px, ph in peaks]
        pts = []
        for (x0, h0), (x1, h1) in zip(peaks, peaks[1:]):
            pts.append((x0, h0))
            pts.append(((x0 + x1) / 2 + r.uniform(-3, 3), min(h0, h1) - r.randint(6, 14)))
        pts.append(peaks[-1])

        def ridge(x):
            for (x0, h0), (x1, h1) in zip(pts, pts[1:]):
                if x0 <= x <= x1:
                    return h0 + (h1 - h0) * (x - x0) / max(1e-6, x1 - x0)
            return 0

        valleys = pts[1::2]

        def owner(x, y):
            # Below a valley the next peak's lit flank runs on down in front of this one's shade.
            for i, (vx, vh) in enumerate(valleys):
                if x < vx - max(0, y - (h - vh)) * 0.3:
                    return peaks[i]
            return peaks[-1]

        for x in range(w):
            rough = 1.3 * math.sin(x * 0.8 + seed) + 0.8 * math.sin(x * 2.1) + r.choice((0, 0, 1))
            top = h - int(round(ridge(x) + rough))
            for y in range(max(0, top), h):
                # the crease from the peak down and a little right: left of it faces the moon
                near = owner(x, y)
                lit = x < near[0] + (y - (h - near[1])) * 0.2
                cap = 4 + (near[1] - h * 0.56) * 0.4 + (x * 7 + near[0]) % 3
                snow = near[1] > h * 0.56 and y < h - near[1] + cap
                c.set(x, y, ('i' if lit else 'I') if snow else ('A' if lit else 'a'))
        return c.rows()

    def shore(w, h, seed):
        """Wooded hills on the far shore, a village's lights by the water (Annecy)."""
        c = Canvas(w, h)
        r = rng(seed)
        ph = [r.uniform(0, math.tau) for _ in range(3)]
        for x in range(w):
            t = x / w * math.tau
            hh = 0.5 + 0.18 * math.sin(2 * t + ph[0]) + 0.1 * math.sin(5 * t + ph[1]) + 0.05 * math.sin(13 * t + ph[2])
            top = h - int(h * hh)
            c.rect(x, top, 1, h - top, 'b')
            c.set(x, top, 'B')
            if math.sin(5 * t + ph[1] + 0.25) > math.sin(5 * t + ph[1]):  # rising: the slope faces the moon
                c.set(x, top + 1, 'B')
        for vx in (r.randrange(10, w // 2 - 20), r.randrange(w // 2 + 10, w - 20)):
            for i in range(5):
                bw, bh = r.randint(3, 5), r.randint(2, 4)
                x0 = vx + i * 4
                c.rect(x0, h - bh, bw, bh, 'B')
                if r.random() < 0.7:
                    c.set(x0 + 1, h - bh + 1, 'O')
            c.rect(vx + 9, h - 9, 1, 5, 'B')
        return c.rows()

    def lake(frame, w=128, h=34):
        """Calm far off (the shore's shine), long slow ripples nearer."""
        c = Canvas(w, h)
        c.rect(0, 0, w, h, 'w')
        c.rect(0, 0, w, 2, 'W')
        r = rng(21 + frame)
        for y in range(2, h, 2):
            step = 14 + y // 2
            for x in range(0, w, step):
                xx = (x + r.randrange(step // 2) + frame * 3) % w
                ln = 2 + y // 5
                for i in range(ln):
                    c.set((xx + i) % w, y, 'W' if y < 10 or (x // step + y // 2) % 2 else 'x')
        return c.rows()

    def glitter(frame, w=26, h=20):
        """The moon's path on the water: short silver streaks under it, wider and broken nearer."""
        c = Canvas(w, h)
        r = rng(40 + frame)
        for y in range(1, h, 2):
            half = 2 + y * 0.5
            for _ in range(1 + (y > 6) + (y > 13)):
                ln = r.randint(2, 3 + y // 6)
                x0 = int(w / 2 - half + r.random() * (2 * half - ln))
                c.rect(x0, y, ln, 1, 'r' if r.random() < 0.25 else 'R')
        return c.rows()

    def chateau():
        W, H, R = 124, 72, 14
        c = Canvas(W, H + R)

        def window(x, y, h, lit):
            """Three wide, arched: the top corners stone, a lit sill under it."""
            c.rect(x, y, 3, h, 'y' if lit else 'v')
            c.set(x + 1, y, 'Y' if lit else 'U')
            c.set(x, y, 's').set(x + 2, y, 's')
            if lit:
                c.set(x, y + 1, 'Y')
            c.rect(x, y + h, 3, 1, 'S')

        def dormer(x, y, lit):
            """A gabled dormer 5 wide, its peak at row y."""
            c.set(x + 2, y, 'S')
            c.rect(x + 1, y + 1, 3, 1, 'S').set(x + 3, y + 1, 's')
            c.rect(x, y + 2, 5, 5, 's').rect(x, y + 2, 1, 5, 'S').rect(x + 4, y + 2, 1, 5, 't')
            c.rect(x + 1, y + 3, 3, 3, 'y' if lit else 'v')
            c.set(x + 2, y + 3, 'Y' if lit else 'U')

        def mansard(x0, x1, top, bottom):
            for y in range(top, bottom + 1):
                inset = (bottom - y) // 2
                a, b = x0 + inset, x1 - inset
                c.rect(a, y, b - a + 1, 1, 'Q').set(a, y, 'U').set(a + 1, y, 'q').set(b, y, 'u')
            c.rect(x0 + (bottom - top) // 2, top - 1, x1 - x0 + 1 - (bottom - top) // 2 * 2, 1, 'U')

        def chimney(x, top, bottom):
            h = bottom - top
            c.rect(x, top, 3, h, 's').rect(x, top, 1, h, 'S').rect(x + 2, top, 1, h, 't')
            c.rect(x - 1, top, 5, 1, 'S').set(x + 3, top, 't')

        # The main block, its mansard with a cresting, dormers, the belvedere with the bell.
        c.rect(62, 31, 43, 30, 's')
        c.rect(61, 30, 45, 1, 'S').rect(62, 31, 43, 1, 'T')
        mansard(61, 105, 22, 29)
        c.rect(65, 19, 37, 1, 'S')
        for x in range(65, 102, 2):
            c.set(x, 20, 's')
        chimney(67, 14, 21)
        chimney(98, 13, 21)
        for x, lit in ((70, False), (77, True), (92, False)):
            dormer(x, 22, lit)
        c.rect(79, 11, 9, 9, 's').rect(79, 11, 1, 9, 'S').rect(87, 11, 1, 9, 't')
        c.rect(81, 13, 5, 6, 'v').set(81, 13, 's').set(85, 13, 's')
        c.rect(82, 15, 3, 2, 'F').set(83, 14, 'f').set(82, 15, 'f').set(83, 17, 'F')
        c.rect(78, 10, 11, 1, 'S')
        for i, (a, b) in enumerate(((79, 87), (80, 86), (81, 85), (82, 84))):
            c.rect(a, 9 - i, b - a + 1, 1, 'Q').set(a, 9 - i, 'U').set(b, 9 - i, 'u')
        c.rect(83, 0, 1, 6, 's')
        for i, x in enumerate(range(65, 102, 6)):
            window(x, 36, 5, i in (2, 5))
            window(x, 46, 5, i in (4,))
        # The right wing, lower.
        c.rect(105, 40, 17, 21, 's').rect(119, 40, 3, 21, 't')
        c.rect(104, 39, 19, 1, 'S').rect(105, 40, 14, 1, 'T')
        mansard(104, 122, 33, 38)
        chimney(116, 27, 33)
        window(108, 44, 5, False)
        window(114, 44, 5, True)
        # The left wing (shaded by the tower on its left), its dormers and chimney.
        c.rect(21, 34, 19, 27, 's').rect(21, 34, 4, 27, 't')
        c.rect(20, 33, 21, 1, 'S').rect(21, 34, 19, 1, 'T')
        mansard(20, 40, 26, 32)
        chimney(35, 18, 26)
        dormer(23, 25, False)
        dormer(30, 25, True)
        window(26, 38, 5, False)
        window(33, 38, 5, False)
        window(33, 48, 5, True)
        # The pavilion: a steep roof with finials, a lit dormer, the great gothic window.
        c.rect(40, 25, 22, 36, 's').rect(40, 25, 1, 36, 'S').rect(59, 25, 3, 36, 't')
        c.rect(39, 24, 24, 1, 'S').rect(40, 25, 22, 1, 'T')
        for y in range(6, 24):
            t = (y - 6) / 17
            a, b = round(47 - t * 8), round(55 + t * 8)
            c.rect(a, y, b - a + 1, 1, 'Q').set(a, y, 'U').set(a + 1, y, 'q').set(b, y, 'u').set(b - 1, y, 'u')
        c.rect(47, 5, 9, 1, 'k').rect(47, 3, 1, 2, 'k').rect(55, 3, 1, 2, 'k').set(51, 4, 'k')
        dormer(49, 11, True)
        gx, gy, gw, gh = 45, 30, 11, 21
        for y in range(gh):
            half = min(gw // 2, y)
            c.rect(gx + gw // 2 - half, gy + y, half * 2 + 1, 1, 't')
            if y >= 1:
                inner = min(gw // 2 - 1, y - 1)
                for x in range(gx + gw // 2 - inner, gx + gw // 2 + inner + 1):
                    c.set(x, gy + y, 'O' if (x + y) % 4 else 'y')
        for y in range(gy + 3, gy + gh):
            c.set(gx + gw // 2, y, 't')
        c.rect(gx + 1, gy + 11, gw - 2, 1, 't')
        c.set(gx + gw // 2, gy + 6, 'Y').set(gx + 3, gy + 14, 'Y').set(gx + 7, gy + 16, 'Y')
        c.rect(gx, gy + gh, gw, 1, 'S')
        # The round tower: courses of stone round a cylinder lit from the left, the cornice on its
        # corbels (its slate cone comes last, taller than the canvas).
        cx, rad = 12, 9
        for y in range(21, 67):
            for x in range(cx - rad, cx + rad + 1):
                nx = (x + 0.5 - cx) / (rad + 0.5)
                c.set(x, y, 'S' if nx < -0.5 else 's' if nx < 0.15 else 't' if nx < 0.65 else 'T')
        for y in (31, 45, 57):
            for x in range(cx - rad + 1, cx + rad):
                if (x + y) % 5 == 0:
                    c.set(x, y, {'S': 's', 's': 't', 't': 'T', 'T': 'T'}[c.get(x, y)])
        for x in range(cx - rad - 1, cx + rad + 2):
            nx = (x + 0.5 - cx) / (rad + 1.5)
            c.set(x, 18, 'S' if nx < 0.1 else 's').set(x, 19, 'S' if nx < -0.4 else 's' if nx < 0.4 else 't')
            c.set(x, 20, 'T' if x % 2 else 't')
        window(cx - 2, 26, 4, False)
        window(cx - 1, 36, 4, True)
        window(cx - 2, 50, 4, False)
        # The arcade over the water and the terrace wall with its balustrade.
        c.rect(21, 55, 24, 17, 's').rect(21, 55, 24, 1, 'S')
        for x in (24, 30, 36):
            c.rect(x, 59, 4, 13, 'k').set(x, 59, 's').set(x + 3, 59, 's').rect(x, 70, 4, 2, 'T')
            c.set(x - 1, 60, 'S')
        c.rect(44, 57, 80, 15, 's').rect(44, 57, 80, 1, 'S').rect(44, 58, 80, 1, 'T').rect(44, 69, 80, 3, 't')
        for row, y in enumerate(range(61, 69, 4)):
            for x in range(44 + (row % 2) * 4, 121, 8):
                c.rect(x, y, 5, 1, 't').set(x + 5, y - 1, 't').set(x + 5, y - 2, 't')
        c.rect(121, 57, 3, 15, 'T')
        c.rect(60, 54, 61, 1, 'S')
        for x in range(60, 121):
            c.set(x, 55, 'S' if x % 2 == 0 else 'T').set(x, 56, 's' if x % 2 == 0 else 'T')
        # Rocks at the tower's foot.
        for x, y, rx, ry in ((5, 68, 6, 4.5), (15, 70, 5, 3), (24, 71, 4, 2.5)):
            lit_blob(c, x, y, rx, ry, 'l', 'L', 'T')
        # Trees of the grounds: gold by the tower, rust by the right wing, a cypress.
        c.paste(tree(22, ['4', '1', '2', '3'], ('j', 'J'), seed=5), 17, 41)
        c.paste(tree(20, ['8', '5', '6', '7'], ('j', 'J'), seed=9), 98, 39)
        c.paste(cypress(19), 59, 38)
        # The reflection: the lower house upside down, darker, broken by ripples.
        tone = {**{k: '&' for k in 'yYOf4'}, **{k: '!' for k in 'SsUl18'}, **{k: '$' for k in 'tqQL25ep6F'}}
        deeper = {'!': '$', '$': '%', '%': 'w', '&': '&'}
        for r in range(R):
            src = H - 1 - int(r * 1.5)
            dx = (0, 1, 0, -1)[(r // 2) % 4] if r > 2 else 0
            for x in range(W):
                k = c.get(x - dx, src)
                # Every other row mostly the lake's: the reflection in streaks.
                if k == '.' or (r > 1 and r % 2 == 1 and ((x + r * 5) // 4) % 3 != 0):
                    continue
                t = tone.get(k, '%')
                # Fainter further from the wall, the lake's own ripples showing through.
                if r > R // 2 or (r > 3 and (x + r) % 7 == 0):
                    t = deeper[t]
                c.set(x, H + r, t)
        # The tower's tall cone: the canvas grows on top, the bottom stays where it was.
        top = 8
        out = Canvas(W, top + H + R)
        out.paste(c.rows(), 0, top)
        for y in range(2, top + 17):
            half = 0.6 + (y - 2) * (rad + 1.5) / (top + 15)
            half += max(0, y - (top + 13)) * 0.4  # the eaves flare out
            a, b = round(cx - half), round(cx + half)
            for x in range(a, b + 1):
                nx = (x + 0.5 - cx) / max(1, half)
                out.set(x, y, 'U' if nx < -0.55 else 'q' if nx < -0.1 else 'Q' if nx < 0.5 else 'u')
            if y % 4 == 1 and y > 5:
                out.set(round(cx + half * 0.2), y, 'u')
        out.rect(cx - rad - 1, top + 17, 2 * rad + 3, 1, 'u')
        out.set(cx, 0, 'S').set(cx, 1, 'S')
        return out.rows()

    def cypress(h):
        c = Canvas(7, h)
        for y in range(h - 2):
            u = (y + 1) / (h - 2)
            half = 3.2 * min(1, u * 1.7) ** 0.8 * (1 - max(0, u - 0.82) * 2.5)
            for x in range(7):
                nx = (x + 0.5 - 3.5) / max(0.6, half)
                if abs(nx) <= 1:
                    c.set(x, y, 'e' if nx < -0.35 else 'p' if nx < 0.4 else 'P')
            if y % 4 == 2 and half > 1.5:
                c.set(int(3.5 + half * 0.2), y, 'P')
        c.rect(3, h - 2, 1, 2, 'j')
        return c.rows()

    def flag(frame):
        return [['ffff......', 'FFfffffff.', '...FFFF.ff'],
                ['fffff.....', 'FFffffffff', '....FFF...'],
                ['ffff....ff', 'FFfffffff.', '..FFF.....']][frame]

    def candle(frame):
        return [['YY', 'yY', 'yy', 'yy'], ['Yy', 'yy', 'yy', 'Oy'], ['YY', 'YY', 'yy', 'yy']][frame]

    def haze(w, h, seed):
        """Mist lying on the water: long thin streaks, thicker in the middle, fading at the ends."""
        c = Canvas(w, h)
        r = rng(seed)
        for _ in range(h + 2):
            ln = r.randint(w // 5, w // 2)
            x0, y = r.randint(0, w - ln), r.randint(0, h - 1)
            for x in range(x0, x0 + ln):
                end = min(x - x0, x0 + ln - 1 - x)
                if end > 1 or r.random() < 0.5:
                    c.set(x, y, '0' if end > ln // 4 and c.get(x, y) == 'M' else 'M')
        return c.rows()

    def statue():
        """A stone dancer en pointe in arabesque on her pedestal: the ballerina she was."""
        return ['..........ss.....',
                '.........Sss.....',
                '.........SSs...s.',
                '.........Sst..s..',
                '..........t..s...',
                '.........SSss....',
                '......ssSSSt.....',
                '....ss..SSt......',
                '...s....SSt......',
                'ss......SSt......',
                '.SSSs.SSSSSSs....',
                '...sSSSSssssst...',
                '........SSt......',
                '........Ss.......',
                '........Ss.......',
                '........Ss.......',
                '........St.......',
                '.........s.......',
                '.........s.......',
                '...SSSSSSSSSSSt..',
                '....tttttttttt...',
                '....SSsssssstt...',
                '....Sssssssstt...',
                '....Sssssssstt...',
                '....Sssssssstt...',
                '....Sssssssstt...',
                '....Sssssssstt...',
                '...SSSSSSSSSSSt..',
                '...sssssssssstt..']

    def fog(w, h, seed):
        """The fog lying on the lake by the terrace: thicker low down, in long drifting streaks."""
        c = Canvas(w, h)
        r = rng(seed)
        for y in range(h):
            x = r.randrange(8)
            while x < w:
                ln = r.randint(10, 30)
                for i in range(ln):
                    if r.random() < 0.15 + 0.85 * y / h:
                        c.set((x + i) % w, y, '=' if y > h * 0.6 and 2 < i < ln - 3 else '-')
                x += ln + r.randint(2, 10)
        return c.rows()

    def lamp(h=40):
        c = Canvas(19, h + 6)
        top = 6
        blob(c, 9, top + 4, 9.2, 9.2, 'D')
        blob(c, 9, top + 4, 5.2, 5.2, 'g')
        c.rect(8, top - 1, 3, 1, 'J').set(9, top - 2, 'J')
        c.rect(7, top, 5, 1, 'J').rect(7, top + 1, 5, 5, 'J').rect(8, top + 1, 3, 5, 'G')
        c.set(9, top + 2, 'E').set(9, top + 3, 'E').rect(7, top + 6, 5, 1, 'J')
        for x, y in ((9, 7), (8, 8), (10, 8), (7, 9), (11, 9)):  # the bracket's scrolls
            c.set(x, top + y, 'J')
        c.rect(9, top + 7, 1, h - 10, 'J')
        c.rect(8, h - 1, 3, 4, 'J').rect(7, h + 3, 5, 3, 'J')
        return c.rows()

    def lantern(frame):
        c = Canvas(15, 16)
        blob(c, 7, 8, 7.4 if frame != 1 else 6.6, 7.4 if frame != 1 else 6.6, 'D')
        blob(c, 7, 8, 3.6 if frame != 2 else 4.2, 3.6 if frame != 2 else 4.2, 'g')
        c.set(7, 3, 'J').rect(6, 4, 3, 1, 'J').rect(5, 5, 5, 1, 'J')
        c.rect(5, 6, 5, 6, 'J').rect(6, 6, 3, 6, 'G')
        c.set(7, 8 if frame != 1 else 9, 'E').set(7, 9 if frame != 2 else 7, 'E')
        if frame == 2:
            c.set(6, 8, 'E')
        c.rect(5, 12, 5, 1, 'J').rect(6, 13, 3, 3, 'J')
        return c.rows()

    def balustrade():
        c = Canvas(48, 15)
        c.rect(0, 0, 6, 15, 'Z').rect(0, 0, 6, 1, 'z').rect(0, 1, 1, 14, 'z').rect(5, 1, 1, 14, 'X')
        c.rect(1, 1, 5, 1, 'Z').rect(2, 5, 2, 6, 'X').rect(2, 5, 2, 1, 'K')
        c.rect(6, 2, 42, 1, 'z').rect(6, 3, 42, 1, 'Z').rect(6, 4, 42, 1, 'X')
        vase = ['zZX', '.Z.', 'zZX', 'zZX', 'zZX', '.Z.', 'zZX', 'zZX']
        for x in range(8, 46, 5):
            c.paste(vase, x, 5)
        c.rect(6, 13, 42, 1, 'Z').rect(6, 14, 42, 1, 'X')
        return c.rows()

    def web():
        """A quarter web in the corner of a pillar and the rail."""
        c = Canvas(11, 9)
        for ex, ey in ((10, 2), (8, 7), (3, 8)):
            c.line(0, 0, ex, ey, 'V')
        for rad in (4, 8):
            for a in range(10, 84, 3):
                t = math.radians(a)
                c.set(round(math.cos(t) * rad), round(math.sin(t) * rad * 0.9), 'V')
        return c.rows()

    def spider(drop):
        """The black widow let down on her thread, the red hourglass on her belly."""
        c = Canvas(5, 9)
        c.rect(2, 0, 1, drop, 'V')
        c.paste(['J.J.J', '.JJJ.', 'J.9.J', '.JJJ.', 'J...J'], 0, drop)
        return c.rows()

    def terrace():
        c = Canvas(48, 12)
        c.rect(0, 0, 48, 12, 'X').rect(0, 0, 48, 1, 'z').rect(0, 1, 48, 1, 'Z').rect(0, 10, 48, 2, 'K')
        for x in (0, 24):
            c.rect(x, 2, 1, 8, 'K').rect(x + 1, 2, 6, 1, 'Z')
        r = rng(12)
        for _ in range(26):
            c.set(r.randrange(48), r.randrange(3, 10), r.choice(['K', 'K', 'Z']))
        return c.rows()

    leaves = {'leaf-a': ['44', '1.'], 'leaf-b': ['.8', '55'], 'leaf-c': ['5.', '66'], 'leaf-d': ['4', '1']}
    house = chateau()
    ch_x, ch_y = 150, 10

    def on_house(row, h):
        """The `y` of a thing `h` px tall at this row of the château's picture."""
        return ch_y + len(house) - row - h
    return {
        'palette': P,
        'sky': ['#0a0a1e', '#0f0f2a', '#151535', '#1c1b41', '#24224c', '#2e2a58', '#3a3264', '#473b70', '#56457a',
                '#664f82'],
        'stars': {'count': 26, 'colors': ['#e8e2ff', '#ffffff', '#c4bcf0']},
        'tint': '#20104008',
        'sprites': {
            'halo': halo(), 'moon': moon(), 'veil-a': veil(84, 7, 3), 'veil-b': veil(60, 6, 8),
            'alps': alps(220, 44, 4), 'shore': shore(180, 16, 6),
            'lake1': lake(0), 'lake2': lake(1), 'lake3': lake(2),
            'glitter1': glitter(0), 'glitter2': glitter(1), 'glitter3': glitter(2),
            'chateau': house, 'flag1': flag(0), 'flag2': flag(1), 'flag3': flag(2),
            'candle1': candle(0), 'candle2': candle(1), 'candle3': candle(2),
            'haze': haze(120, 8, 2), 'fog': fog(160, 16, 5),
            'cypress': cypress(34), 'cypress-s': cypress(28),
            'statue': statue(), 'lamp': lamp(),
            'lantern1': lantern(0), 'lantern2': lantern(1), 'lantern3': lantern(2),
            'balustrade': balustrade(), 'web': web(),
            'spider1': spider(2), 'spider2': spider(3), 'spider3': spider(4),
            'terrace': terrace(), **leaves,
        },
        'ground': 'terrace',
        'layers': [
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'halo', 'x': 22, 'y': 48},
                                                    {'sprite': 'moon', 'x': 36, 'y': 62}]},
            {'speed': 0.02, 'period': 320, 'drift': 2, 'alpha': 0.8, 'items': [{'sprite': 'veil-a', 'x': 10, 'y': 92},
                                                                               {'sprite': 'veil-b', 'x': 190, 'y': 104}]},
            {'speed': 0.03, 'period': 220, 'items': [{'sprite': 'alps', 'x': 0, 'y': 34}]},
            {'speed': 0.06, 'period': 180, 'items': [{'sprite': 'shore', 'x': 0, 'y': 34}]},
            {'speed': 0.1, 'period': 128, 'items': [{'sprite': 'lake1', 'x': 0, 'y': 0, 'frames': ['lake1', 'lake2', 'lake3'],
                                                      'fps': 2}]},
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'glitter1', 'x': 33, 'y': 14,
                                                    'frames': ['glitter1', 'glitter2', 'glitter3'], 'fps': 3}]},
            {'speed': 0.12, 'period': 400, 'items': [
                {'sprite': 'chateau', 'x': ch_x, 'y': ch_y},
                {'sprite': 'flag1', 'x': ch_x + 84, 'y': on_house(8, 3), 'frames': ['flag1', 'flag2', 'flag3', 'flag2'],
                 'fps': 4},
                {'sprite': 'candle1', 'x': ch_x + 11, 'y': on_house(8 + 36, 4),
                 'frames': ['candle1', 'candle2', 'candle1', 'candle3'], 'fps': 5}]},
            {'speed': 0.14, 'period': 300, 'drift': 4, 'items': [{'sprite': 'haze', 'x': 0, 'y': 20},
                                                                 {'sprite': 'haze', 'x': 170, 'y': 26}]},
            {'speed': 0.3, 'period': 160, 'drift': 5, 'items': [{'sprite': 'fog', 'x': 0, 'y': 13}]},
            {'speed': 0.45, 'period': 330, 'items': [
                {'sprite': 'cypress', 'x': 0, 'y': 0}, {'sprite': 'cypress-s', 'x': 9, 'y': 0},
                {'sprite': 'statue', 'x': 110, 'y': 8}, {'sprite': 'lamp', 'x': 230, 'y': 0}]},
            {'speed': 1, 'period': 48, 'items': [{'sprite': 'balustrade', 'x': 0, 'y': 0}]},
            {'speed': 1, 'period': 240, 'items': [
                {'sprite': 'lantern1', 'x': -4, 'y': 15, 'frames': ['lantern1', 'lantern2', 'lantern1', 'lantern3'],
                 'fps': 6},
                {'sprite': 'web', 'x': 150, 'y': 1},
                {'sprite': 'spider1', 'x': 155, 'y': 1,
                 'frames': ['spider1', 'spider2', 'spider3', 'spider3', 'spider2', 'spider1'], 'fps': 1.5}]},
        ],
        'ambient': ['leaves'],
        'emitters': {
            'leaves': {'perSecond': 1.5, 'anchor': 'head', 'jitter': [0, 20], 'offset': [0, -36], 'speed': [8, 18],
                       'angle': [-140, -100], 'gravity': 18, 'drag': 1, 'life': [2600, 3600], 'fadeOut': 700,
                       'flutter': {'amp': 3, 'freq': 1.1}, 'tumble': [1, 2],
                       'sprite': {'frames': list(leaves), 'random': True}},
        },
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
