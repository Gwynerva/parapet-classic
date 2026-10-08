"""Builds look files for the bosses from readable pieces: colour ramps that recolour the base
character, pictures as text grids with their own legend, kits to extend. Writes JSON with LF."""
import json
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(_HERE, '..', '..', '..'))
# Where looks, effects, worlds and boss files go: the content, or another copy of the bosses'
# folder (PARAPET_BOSSES) to compare a run with it without touching the repository.
BOSSES = os.path.abspath(os.environ.get('PARAPET_BOSSES') or os.path.join(REPO, 'packages', 'content', 'bosses'))
# Previews of the looks (git ignores them).
_PREVIEWS = os.path.join(_HERE, 'out')

# ---------------------------------------------------------------------------------------------
# The base characters' colours (light → dark), from the atlas.
# ---------------------------------------------------------------------------------------------
SKIN = ['#fff3bd', '#ffd794', '#e7aa6b', '#bd7942', '#734521']
HAND_EXTRA = {'#ffcb84': 1, '#a56531': 3}  # hand tones → index in a skin ramp
SHIN_SKIN = ['#ffd794', '#f7ba73', '#de9e5a']
WRIST = ['#8c8273', '#423c5a', '#000400']
SHIRT = ['#ffffff', '#d6cbb5', '#9c8273']  # Blaise's top (chest)
MALE_SHIRT = ['#e70000', '#ad0808', '#6b1c18']  # the male top (chest, torso)
SHORTS = ['#848ea5', '#6b7994', '#525d6b', '#42494a', '#313031']  # thighs, knees, hips
BELT = ['#ffffff', '#000400']
SHOE = {
    'main': ['#ef0000', '#a50800', '#631408'],
    'white': ['#fffbe7'],
    'sole': ['#d6cbb5', '#8c8273'],
    'line': ['#000400'],
}

FOREARM = [1, 2, 3, 4]
UPPER_ARM = [5, 6, 7, 8, 9, 10, 11, 12]
HAND = list(range(17, 25))
HEAD = [25, 26, 27, 28, 29]
SHIN = [30, 31, 32, 33]
TORSO = [34, 35, 36, 37, 38]
SHOES = list(range(39, 49))
THIGH = list(range(49, 57))
CHEST = [57, 58, 59, 60, 61]
KNEE = [62, 63, 64, 65]
PONYTAIL = [13, 14, 15, 16]
ARMS = FOREARM + UPPER_ARM


def ramp(src, dst):
    """Maps a ramp of base colours onto another one (stretched or squeezed to fit)."""
    out = {}
    for i, c in enumerate(src):
        j = round(i * (len(dst) - 1) / max(1, len(src) - 1)) if len(dst) > 1 else 0
        out[c] = dst[j]
    return out


def recolor(sprites, mapping):
    return {'sprites': list(sprites), 'map': dict(mapping)}


def skin(dst, sprites=None, with_shins=True):
    """Recolours the skin (5 tones light → dark) of arms, hands and shins."""
    rules = [recolor(sprites or (ARMS + HAND + TORSO + CHEST), {**ramp(SKIN, dst), **{c: dst[i] for c, i in HAND_EXTRA.items()}})]
    if with_shins:
        rules.append(recolor(SHIN, ramp(SHIN_SKIN, dst[1:4])))
    return rules


def grid(text, legend):
    """Rows of a picture from a text block: legend maps drawing characters to palette ones."""
    lines = [l for l in text.strip('\n').split('\n')]
    width = max(len(l) for l in lines)
    rows = []
    for l in lines:
        l = l.ljust(width, '.')
        rows.append(''.join(legend.get(ch, ch) for ch in l))
    return rows


# Width and height parity of the base characters' heads (Blaise 16×17, the others 17×17).
HEAD_PARITY = {0: (0, 1)}


def fix_parity(rows, wp, hp):
    """Pads a picture on the right and the bottom to the given width and height parity."""
    w = len(rows[0]) if rows else 0
    if w % 2 != wp:
        rows = [r + '.' for r in rows]
    if len(rows) % 2 != hp:
        rows = rows + ['.' * len(rows[0])]
    return rows


_kit_base = {}
_written = {}  # look id → the file this run wrote


def write_look(boss, look):
    base = look.get('base', _kit_base.get(look.get('extends'), 0 if 'extends' not in look else None))
    _kit_base[look['id']] = base
    # Heads taken from the originals keep their own sizes (the game draws them so).
    raw_heads = look.pop('_raw_heads', False)
    if base is not None and not raw_heads:
        wp, hp = HEAD_PARITY.get(base, (1, 1))
        for key in list(look.get('parts', {})):
            if key.split(':')[0] in ('25', '29'):
                look['parts'][key] = fix_parity(look['parts'][key], wp, hp)
    path = f'{BOSSES}/{boss}/looks/{look["id"]}.json'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(look, f, indent=2, ensure_ascii=False)
        f.write('\n')
    _written[look['id']] = path
    return path


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def look_cmd(*args):
    r = subprocess.run(['npm', 'run', '--silent', 'look', '--', *args], cwd=REPO, capture_output=True, text=True,
                       shell=os.name == 'nt')
    out = (r.stdout + r.stderr).strip()
    if out:
        print(out[-2000:])
    return r.returncode


def rotate(path, keys):
    return look_cmd('rotate', path, '--from', ','.join(str(k) for k in keys), '--write')


def preview(look_id, scale=3):
    """A row of poses each way of a look this run wrote, in out/<look>-poses.png."""
    os.makedirs(_PREVIEWS, exist_ok=True)
    look_cmd('poses', _written.get(look_id, look_id), '--out', os.path.join(_PREVIEWS, f'{look_id}-poses.png'),
             '--both', '--scale', str(scale))


# ---------------------------------------------------------------------------------------------
# A little canvas for drawing props of the worlds and effect sprites with code.
# ---------------------------------------------------------------------------------------------
class Canvas:
    def __init__(self, w, h, fill='.'):
        self.w = w
        self.h = h
        self.px = [[fill] * w for _ in range(h)]

    def set(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h and ch is not None:
            self.px[y][x] = ch
        return self

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def rect(self, x, y, w, h, ch):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, ch)
        return self

    def frame(self, x, y, w, h, ch):
        for xx in range(x, x + w):
            self.set(xx, y, ch).set(xx, y + h - 1, ch)
        for yy in range(y, y + h):
            self.set(x, yy, ch).set(x + w - 1, yy, ch)
        return self

    def line(self, x0, y0, x1, y1, ch):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), ch)
        return self

    def disc(self, cx, cy, r, ch):
        for yy in range(int(cy - r - 1), int(cy + r + 2)):
            for xx in range(int(cx - r - 1), int(cx + r + 2)):
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r + 0.3:
                    self.set(xx, yy, ch)
        return self

    def outline(self, ch, inside=None):
        """Draws `ch` around every filled pixel (only on transparent ones)."""
        filled = [[c != '.' for c in row] for row in self.px]
        for y in range(self.h):
            for x in range(self.w):
                if filled[y][x]:
                    continue
                if any(0 <= x + dx < self.w and 0 <= y + dy < self.h and filled[y + dy][x + dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    self.px[y][x] = ch
        return self

    def paste(self, rows, x, y):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.set(x + i, y + j, ch)
        return self

    def mirrored(self):
        c = Canvas(self.w, self.h)
        c.px = [row[::-1] for row in self.px]
        return c

    def rows(self):
        return [''.join(r) for r in self.px]


def hmirror(rows):
    return [r[::-1] for r in rows]


def no_ponytail():
    """Blaise's ponytail hidden (a single clear pixel in each of its pictures)."""
    return {str(i): ['.'] for i in PONYTAIL}
