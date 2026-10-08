"""The bosses' little worlds (the character screen's dioramas), one function each; writes every
`bosses/<boss>/stage.json` (`python stages.py [boss ...]`)."""
import sys
from lookgen import BOSSES, Canvas, write_json
from scene import blob, foliage, lit_blob, palm, pine, rng, skyline, strip, tree, building

STAGES = {}


def stage(fn):
    STAGES[fn.__name__.replace('_', '-')] = fn
    return fn


# ---------------------------------------------------------------------------------------- Pierre
@stage
def pierre():
    """The author's room (room.py): the wallpaper with golden rings, the window over the radiator,
    a painting, the glass shelf, the swords, the open wardrobe, a backpack, the mirror, the door;
    dust in the light."""
    import room
    sk = Canvas(48, 3, 's')
    sk.rect(0, 2, 48, 1, 'O')
    return {
        'palette': dict(room.ROOM_PALETTE),
        'sprites': {'wallpaper': room.wallpaper(), 'skirting': sk.rows(), 'floor': room.floor(),
                    'window': room.window(), 'radiator': room.radiator(), 'painting': room.painting(),
                    'shelf': room.shelf(), 'backpack': room.backpack(), 'mirror': room.mirror(), 'door': room.door(),
                    'swords': room.swords(), 'glass': room.glass_shelf()},
        'tint': '#ffe2a014',
        'ground': 'floor',
        'layers': [
            {'speed': 0.55, 'period': 48, 'items': [{'sprite': 'wallpaper', 'x': 0, 'y': 0},
                                                    {'sprite': 'skirting', 'x': 0, 'y': 0}]},
            {'speed': 0.55, 'period': 320, 'items': [
                {'sprite': 'window', 'x': 0, 'y': 22}, {'sprite': 'radiator', 'x': 2, 'y': 3},
                {'sprite': 'painting', 'x': 120, 'y': 58}]},
            {'speed': 0.6, 'period': 320, 'items': [
                {'sprite': 'glass', 'x': 26, 'y': 0}, {'sprite': 'swords', 'x': 50, 'y': 0},
                {'sprite': 'shelf', 'x': 66, 'y': 0}, {'sprite': 'backpack', 'x': 90, 'y': 56},
                {'sprite': 'mirror', 'x': 112, 'y': 0}, {'sprite': 'door', 'x': 200, 'y': 0}]},
        ],
        'ambient': ['dust'],
        'emitters': {'dust': room.dust_emitter()},
    }


# ---------------------------------------------------------------------------------------- Rewind
@stage
def rewind():
    """A cliff over the sea in autumn at sunset: the lighthouse on the headland, its beam turning;
    red, orange and yellow trees among dark pines; a wooden fence; leaves falling."""
    P = {'k': '#2a2230', 's': '#fff2b8', 'S': '#ffd070', 'o': '#f4a060',
         'a': '#3e5a8c', 'A': '#4f6c9c', 'b': '#2e4874', 'h': '#f8c070', 'H': '#ffe0a0',
         'c': '#6a5a5e', 'C': '#4e4248', 'D': '#3a3036', 'w': '#f4efe6', 'W': '#cfc6bc', 'r': '#c8483a',
         'R': '#963228', 'y': '#fff6c070', 'B': '#fff6c038', 'Y': '#ffe880',
         '1': '#f0b040', '2': '#e8783a', '3': '#c04a2a', '4': '#8a3a20', '5': '#f8d070',
         'p': '#3a5a3e', 'P': '#2a4430', 'q': '#1e3224', 't': '#5a3a2a', 'T': '#3e2a1e',
         'f': '#8a6a4a', 'F': '#6a4e34', 'g': '#7a8a3a', 'G': '#5a6a2a', 'l': '#c86a2a'}
    sun = Canvas(14, 14)
    blob(sun, 7, 7, 6.5, 6.5, 'S')
    blob(sun, 6.5, 6.5, 5, 5, 's')

    def sea(frame):
        c = Canvas(96, 18)
        c.rect(0, 0, 96, 18, 'a')
        c.rect(0, 0, 96, 1, 'A')
        r = rng(3 + frame)
        for y in range(1, 18, 2):
            for x in range(0, 96, 6):
                xx = (x + r.randrange(6) + frame * 2) % 96
                c.rect(xx, y, 2 + y // 6, 1, 'A' if y < 9 else 'b')
        return c.rows()

    def glare(frame):
        # The low sun's path on the water: broken streaks, wider nearer.
        c = Canvas(24, 18)
        r = rng(11 + frame)
        for y in range(0, 18, 2):
            half = 2 + y // 3
            x = 12 - half + r.randrange(2)
            while x < 12 + half:
                ln = r.randint(1, 3)
                c.rect(x, y, ln, 1, 'h' if y < 8 else 'H')
                x += ln + r.randint(1, 3)
        return c.rows()

    def headland(beam):
        c = Canvas(70, 46)
        # The cliff: rock lit from the left.
        for y in range(22, 46):
            half = 14 + (y - 22) * 1.1
            for x in range(int(35 - half), int(35 + half * 0.8)):
                c.set(x, y, 'c' if x < 30 else 'C' if x < 44 else 'D')
        c.rect(14, 22, 30, 2, 'g')
        # The lighthouse: white with red bands, a lantern on top.
        for y in range(6, 23):
            w = 3 + (y - 6) // 6
            for x in range(28 - w, 29 + w):
                band = 'r' if (y // 4) % 2 else 'w'
                c.set(x, y, {'w': 'W', 'r': 'R'}[band] if x > 28 else band)
        c.rect(25, 3, 7, 3, 'k').rect(26, 3, 5, 2, 'Y').rect(25, 2, 7, 1, 'k').rect(27, 0, 3, 2, 'k')
        if beam:
            dx = -1 if beam == 1 else 1
            for i in range(1, 22):
                for j in range(-(i // 6), i // 6 + 1):
                    c.set(28 + dx * (3 + i), 4 + j, 'B' if abs(j) == i // 6 else 'y')
        return c.rows()

    def fence():
        c = Canvas(32, 14)
        for x in (2, 14, 26):
            c.rect(x, 1, 2, 13, 'f').rect(x + 1, 1, 1, 13, 'F').rect(x, 0, 2, 1, 'f')
        c.rect(0, 4, 32, 2, 'f').rect(0, 5, 32, 1, 'F').rect(0, 9, 32, 2, 'f').rect(0, 10, 32, 1, 'F')
        return c.rows()

    def grass():
        c = Canvas(48, 10)
        c.rect(0, 0, 48, 10, 'G')
        c.rect(0, 0, 48, 1, 'g')
        r = rng(9)
        for _ in range(40):
            c.set(r.randrange(48), r.randrange(1, 10), r.choice(['2', '1', '3', 'l', 'g']))
        return c.rows()

    autumn = ['5', '1', '2', '3']
    red = ['2', '3', '4', '1']
    leaf = {'leaf1': ['22', '2.'], 'leaf2': ['.1', '11'], 'leaf3': ['3.', '33'], 'leaf4': ['1', '1']}
    return {
        'palette': P,
        'sky': ['#4a3e6e', '#5e4a7a', '#7a527c', '#a45e78', '#cc6e6a', '#e88a62', '#f4aa6a', '#f8c47a'],
        'tint': '#ff905008',
        'sprites': {
            'sun': sun.rows(), 'sea1': sea(0), 'sea2': sea(1), 'sea3': sea(2),
            'glare1': glare(0), 'glare2': glare(1), 'glare3': glare(2),
            'head0': headland(0), 'head1': headland(1), 'head2': headland(2),
            'pine': pine(44, ['p', 'P', 'q']), 'pine-s': pine(32, ['p', 'P', 'q']),
            'oak': tree(40, autumn, seed=3), 'maple': tree(34, red, seed=7),
            'fence': fence(), 'grass': grass(), **leaf,
        },
        'ground': 'grass',
        'layers': [
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'sun', 'x': 92, 'y': 14}]},
            {'speed': 0.04, 'period': 96, 'items': [{'sprite': 'sea1', 'x': 0, 'y': 0, 'frames': ['sea1', 'sea2', 'sea3'],
                                                      'fps': 2}]},
            {'speed': 0, 'period': 1000, 'items': [{'sprite': 'glare1', 'x': 87, 'y': 0,
                                                    'frames': ['glare1', 'glare2', 'glare3'], 'fps': 3}]},
            {'speed': 0.1, 'period': 260, 'items': [{'sprite': 'head0', 'x': 150, 'y': 0,
                                                       'frames': ['head1', 'head0', 'head2', 'head0'], 'fps': 2}]},
            {'speed': 0.4, 'period': 150, 'items': [
                {'sprite': 'pine', 'x': 0, 'y': 0}, {'sprite': 'oak', 'x': 24, 'y': 0},
                {'sprite': 'pine-s', 'x': 68, 'y': 0}, {'sprite': 'maple', 'x': 96, 'y': 0}]},
            {'speed': 1, 'period': 96, 'items': [{'sprite': 'fence', 'x': 0, 'y': 0}, {'sprite': 'fence', 'x': 32, 'y': 0}]},
        ],
        'ambient': ['leaves', 'flutter'],
        'emitters': {
            'leaves': {'perSecond': 6, 'anchor': 'head', 'jitter': [0, 20], 'offset': [0, -30], 'speed': [8, 20],
                       'angle': [-130, -100], 'gravity': 20, 'drag': 1, 'life': [2500, 3500], 'fadeOut': 600,
                       'flutter': {'amp': 3, 'freq': 1.2}, 'tumble': [1, 2],
                       'sprite': {'frames': list(leaf), 'random': True}},
            'flutter': {'perSecond': 0.6, 'anchor': 'body', 'jitter': [0, 15], 'speed': [6, 14], 'angle': [60, 120],
                        'gravity': -6, 'life': [2000, 3000], 'fadeIn': 200, 'fadeOut': 600,
                        'flutter': {'amp': 3, 'freq': 2.5},
                        'sprite': {'frames': ['fly1', 'fly2', 'fly3', 'fly2'], 'fps': 10}},
        },
    }


def finish(boss, s):
    # Sprites the ambient emitters borrow from the boss's effects (the butterflies).
    import json
    fx = json.load(open(f'{BOSSES}/{boss}/fx.json', encoding='utf-8'))
    pool = [c for c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*=?@^~<>/|;:#'
            if c not in s['palette']]
    remap = {}
    for e in s.get('emitters', {}).values():
        for name in e.get('sprite', {}).get('frames', []):
            if name in s['sprites'] or name not in fx['sprites']:
                continue
            rows = []
            for row in fx['sprites'][name]:
                out = ''
                for ch in row:
                    if ch == '.':
                        out += ch
                        continue
                    colour = fx['palette'][ch]
                    if colour not in remap:
                        remap[colour] = pool.pop(0)
                        s['palette'][remap[colour]] = colour
                    out += remap[colour]
                rows.append(out)
            s['sprites'][name] = rows
    return s


if __name__ == '__main__':
    import stages
    import stages2  # noqa: F401  (registers the other worlds)
    for boss in sys.argv[1:] or stages.STAGES:
        write_json(f'{BOSSES}/{boss}/stage.json', stages.finish(boss, stages.STAGES[boss]()))
        print(boss, 'stage written')
