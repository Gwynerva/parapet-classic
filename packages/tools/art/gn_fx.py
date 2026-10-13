"""Granger's effect (fx.json): Tracer's own tricks, rare and small.

* Blink, on about a third of her vaults, flips, wall moves and dashes: a cyan snapshot of her
  pose where she took off, a 1-px tracer line from it toward where she went, a few sparks; gone
  in a quarter of a second.
* Recall, now and then while she runs (about once in sixteen seconds): a cyan hologram of her
  running backwards away behind her, a little clock over its head turning back.
* The news from the future: on a few tricks a newspaper flies off her and flutters away.
* Waiting by the start the accelerator on her chest pulses; she leaves in a blink (the three
  chevrons of the ability and a streak ahead) and comes back by a recall (the clock turning back).

The ghost's frames are her own run cycle (the look tool draws the poses), as a scanlined cyan
silhouette."""
import os
import struct
import subprocess
import tempfile
import zlib

from lookgen import REPO

CYAN = '#3fd2ff'
PALETTE = {
    'x': '#e8ffff', 'y': '#7fe8ff', 'z': CYAN, 'Z': '#1f8fd8',
    # The ghost: a translucent scanlined silhouette, its edge deeper, the clock's face.
    'G': '#9ff0ffb4', 'g': '#3fd2ff96', 'h': '#1f8fd8a0', 'c': '#e8ffffd8', 'C': '#1f6fb0d8',
    # The newspaper.
    'w': '#f6f3ea', 'q': '#cdc8ba', 'n': '#8e8a80', 'K': '#26262c', 'r': '#c8302c',
    # The pulse bomb.
    'b': '#4a4c54', 'B': '#8a8e98',
}


# --------------------------------------------------------------------------------------------
# A small PNG reader (8-bit RGB or RGBA, not interlaced): the look tool's poses.
# --------------------------------------------------------------------------------------------
def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, w = 8, b'', 0
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        pos += 12 + n
        if kind == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
            assert depth == 8 and ctype in (2, 6), (depth, ctype)
            bpp = 4 if ctype == 6 else 3
        elif kind == b'IDAT':
            idat += body
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev = [], bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append([tuple(line[x * bpp:x * bpp + 3]) for x in range(w)])
        prev = line
    return rows


# --------------------------------------------------------------------------------------------
# The Recall ghost: her run cycle as silhouettes, played backwards, a clock turning back over it.
# --------------------------------------------------------------------------------------------
RUN_FRAMES = list(range(8))
BG = (159, 179, 200)
# The clock's hand, counter-clockwise from twelve, one step a frame.
HAND = [((0, -1), (0, -2)), ((-1, -1), (-2, -2)), ((-1, 0), (-2, 0)), ((-1, 1), (-2, 2)),
        ((0, 1), (0, 2)), ((1, 1), (2, 2)), ((1, 0), (2, 0)), ((1, -1), (2, -2))]
CLOCK = [
    '..ccc..',
    '.c...c.',
    'c.....c',
    'c..C..c',
    'c.....c',
    '.c...c.',
    '..ccc..',
]


def clock_frame(i):
    g = [list(r) for r in CLOCK]
    for dx, dy in HAND[i % len(HAND)]:
        g[3 + dy][3 + dx] = 'C'
    return [''.join(r) for r in g]


def ghost_frames(look='classic'):
    """{name: rows} of the ghost, frames in the order they play (the run cycle backwards), and its
    height (the feet on its bottom row)."""
    tmp = tempfile.mkdtemp(prefix='gn-ghost-')
    sil = []
    for f in RUN_FRAMES:
        out = os.path.join(tmp, f'f{f}.png')
        subprocess.run(['node', 'packages/tools/src/lookCli.ts', 'poses', look, '--out', out, '--scale', '1',
                        '--frames', str(f)], cwd=REPO, check=True, capture_output=True)
        sil.append(read_png(out))
    h, w = len(sil[0]), len(sil[0][0])
    xs = [x for s in sil for y in range(h) for x in range(w) if s[y][x] != BG]
    ys = [y for s in sil for y in range(h) for x in range(w) if s[y][x] != BG]
    # Centred on the pose's point (the cell's middle), the feet on the bottom row.
    cx = w // 2
    half = max(cx - min(xs), max(xs) - cx) + 1
    x0, x1, y0, y1 = cx - half, cx + half, min(ys), max(ys)
    top = 9  # room for the clock over the head
    frames = {}
    for k, f in enumerate(reversed(range(len(sil)))):
        s = sil[f]
        g = [['.'] * (x1 - x0) for _ in range(y1 - y0 + 1 + top)]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1):
                if s[y][x] == BG:
                    continue
                edge = any(s[y + dy][x + dx] == BG for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                g[y - y0 + top][x - x0] = 'h' if edge else ('G' if y % 2 == 0 else 'g')
        # The clock over the head, a little behind it (+x is ahead in the picture: she faces right).
        head_x = [x - x0 for y in range(y0, y0 + 6) for x in range(x0, x1) if s[y][x] != BG]
        hx = (min(head_x) + max(head_x)) // 2 - 6 if head_x else 4
        for j, r in enumerate(clock_frame(k)):
            for i, ch in enumerate(r):
                if ch != '.' and 0 <= hx + i < len(g[0]):
                    g[j][hx + i] = ch
        frames[f'ghost{k}'] = [''.join(r) for r in g]
    return frames, len(next(iter(frames.values())))


# --------------------------------------------------------------------------------------------
# Little sprites
# --------------------------------------------------------------------------------------------
SPRITES = {
    # The newspaper: folded with its masthead and headline, then flapping open.
    'news1': [
        'wwwwwww',
        'wKKrKKq',
        'wnwnnwq',
        'wnnwnnq',
        'wnwnwnq',
        'qqqqqqq',
    ],
    'news2': [
        '.wwwwwww.',
        'wKKrwwnnw',
        'wnnwwwnwq',
        'wnwnqwnnq',
        'wnnwqwnwq',
        '.qqq.qqq.',
    ],
    'news3': [
        '.wwwww.',
        'wwKKrKq',
        'wwnwnnq',
        'wwnnwnq',
        'wwnwnnq',
        '.qqqqq.',
    ],
    # Blink's tracer line, dim where she was, bright where she went.
    'line': ['ZZZZzzzzzzyyyyyyxxxx'],
    # Blink's icon: three chevrons pointing up.
    'chevrons': [
        '..x..',
        '.y.y.',
        'y.x.y',
        '.z.z.',
        'z...z',
    ],
    # The accelerator's pulse.
    'pulse1': ['.y.', 'yxy', '.y.'],
    'pulse2': ['.zz.', 'z..z', 'z..z', '.zz.'],
    'pulse3': ['..ZZ..', '.Z..Z.', 'Z....Z', 'Z....Z', '.Z..Z.', '..ZZ..'],
    # The pulse bomb, ticking.
    'bomb1': ['.bBb.', 'bBzBb', '.bBb.'],
    'bomb2': ['.bBb.', 'bBxBb', '.bBb.'],
}
for _i in range(8):
    SPRITES[f'clock{_i}'] = [r.replace('c', 'y').replace('C', 'x') for r in clock_frame(_i)]


def tracer_line():
    """The tracer line: a 1-px streak from where she took off toward where she went (ahead), still,
    brightest at its far end, fading with the snapshot."""
    return {'burst': 1, 'anchor': 'chest', 'offset': [-10, 0], 'speed': 0, 'life': 240, 'fadeOut': 180,
            'sprite': {'frames': ['line']}, 'face': True, 'blend': 'add', 'layer': 'behind'}


def fx():
    ghost, gh = ghost_frames()
    names = list(ghost)
    emitters = {
        'tracer': tracer_line(),
        'blink-spark': {
            'burst': [3, 5], 'anchor': 'chest', 'jitter': [2, 4], 'speed': [20, 60], 'angle': [0, 360],
            'drag': 5, 'life': [160, 260], 'fadeOut': 150, 'rect': {'size': 1, 'colors': ['x', 'y']},
            'blend': 'add',
        },
        'recall': {
            'while': ['run'], 'perSecond': 0.06, 'minSpeed': 60, 'anchor': 'feet', 'offset': [10, -(gh // 2) + 8],
            'speed': 70, 'angle': 0, 'life': 1000, 'fadeIn': 220, 'fadeOut': 520, 'face': True,
            'sprite': {'frames': names, 'fps': 13, 'loop': True}, 'max': 1, 'layer': 'behind',
        },
        'newspaper': {
            'enter': ['flip', 'vault', 'wall'], 'chance': 0.08, 'burst': 1, 'anchor': 'hand.near',
            'speed': [50, 80], 'angle': [25, 60], 'gravity': 40, 'drag': 1.6, 'life': 1600, 'fadeIn': 60,
            'fadeOut': 600, 'flutter': {'amp': 2, 'freq': 1.6},
            'sprite': {'frames': ['news1', 'news2', 'news3', 'news2'], 'fps': 7, 'loop': True},
            'layer': 'front', 'reduced': 0.5,
        },
        'pulse': {
            'perSecond': 0.8, 'anchor': 'chest', 'speed': 0, 'life': 520, 'fadeIn': 80, 'fadeOut': 300,
            'sprite': {'frames': ['pulse1', 'pulse2', 'pulse3'], 'fps': 6, 'loop': False}, 'blend': 'add',
            'reduced': 0.5,
        },
        'blink-out': {
            'burst': 1, 'anchor': 'chest', 'offset': [0, -14], 'speed': 18, 'angle': 90, 'life': 650,
            'fadeOut': 380, 'sprite': {'frames': ['chevrons']}, 'blend': 'add', 'reduced': 1,
        },
        'streak': {
            'burst': [14, 18], 'anchor': 'body', 'jitter': [2, 10], 'speed': [120, 260], 'angle': [178, 182],
            'drag': 3, 'life': [140, 260], 'fadeOut': 140, 'rect': {'size': 1, 'colors': ['x', 'y', 'z']},
            'blend': 'add',
        },
        'recall-in': {
            'burst': 1, 'anchor': 'head', 'offset': [0, -10], 'speed': 0, 'life': 700, 'fadeIn': 120,
            'fadeOut': 300, 'sprite': {'frames': [f'clock{i}' for i in range(8)], 'fps': 12, 'loop': False},
            'blend': 'add', 'reduced': 1,
        },
        'sparks': {
            'burst': [8, 12], 'anchor': 'body', 'jitter': [3, 12], 'speed': [30, 90], 'angle': [0, 360],
            'drag': 5, 'life': [220, 380], 'fadeOut': 200, 'rect': {'size': 1, 'colors': ['x', 'y', 'z']},
            'blend': 'add',
        },
    }
    blink_snapshot = {
        'mode': 'snapshot', 'enter': ['vault', 'flip', 'wall', 'dash'], 'chance': 0.3, 'colors': [CYAN],
        'textured': False, 'life': 240, 'drift': [0, 0], 'alpha': 0.6,
        'burst': ['tracer', 'blink-spark'],
    }
    return {
        'palette': PALETTE,
        'sprites': {**SPRITES, **ghost},
        'emitters': emitters,
        'variants': {
            'blink': {'emitters': ['newspaper'], 'afterimage': blink_snapshot},
            'recall': {'emitters': ['recall']},
        },
        'presence': {'idle': ['pulse'], 'vanish': ['blink-out', 'streak', 'sparks'],
                     'appear': ['recall-in', 'sparks']},
    }
