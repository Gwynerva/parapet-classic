"""Heads of the bosses built on the original characters' hand-drawn heads: recoloured (skin, hair,
eyes, lips), painted over (goggles, tattoos, a blindfold, a cowl), grown (hair past the box).
Pictures are grids of hex colours until they go into a look, where a palette builder gives every
colour a character."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_HEADS = json.load(open(os.path.join(HERE, 'base_heads.json'), encoding='utf-8'))

# Which original has what: 0 Blaise (red hair, female), 1 Playman (orange, male), 2 brown spiky
# with stubble (male), 3 long black hair (female), 4 mohawk, glasses, goatee (male), 5 curly buns
# (female, dark skin), 6 bob with fringe (female), 7 shaved head (male, dark skin), 8 bandana
# (female), 9 black pompadour (male).


def _sprite(c, front):
    if c == 0:
        return 29 if front else 25
    return (86 if front else 82) + 5 * (c - 1)


class Pic:
    def __init__(self, grid):
        self.g = [list(r) for r in grid]

    @staticmethod
    def orig(c, front=False):
        v = _HEADS[str(_sprite(c, front))]
        pal = v['palette']
        return Pic([[pal[ch] if ch != '.' else None for ch in row] for row in v['rows']])

    @staticmethod
    def text(rows, legend):
        """A picture from text rows; `legend` maps characters to colours ('.' clear)."""
        w = max(len(r) for r in rows)
        return Pic([[legend.get(ch) if ch != '.' else None for ch in r.ljust(w, '.')] for r in rows])

    @property
    def w(self):
        return len(self.g[0]) if self.g else 0

    @property
    def h(self):
        return len(self.g)

    def copy(self):
        return Pic([r[:] for r in self.g])

    def get(self, x, y):
        if 0 <= y < self.h and 0 <= x < self.w:
            return self.g[y][x]
        return None

    def set(self, x, y, c):
        if 0 <= y < self.h and 0 <= x < self.w:
            self.g[y][x] = c
        return self

    def recolor(self, mapping):
        m = {k.lower(): v for k, v in mapping.items()}
        for row in self.g:
            for i, c in enumerate(row):
                if c is not None and c.lower() in m:
                    row[i] = m[c.lower()]
        return self

    def where(self, colours):
        """Pixels of any of these colours."""
        s = {c.lower() for c in colours}
        return [(x, y) for y, row in enumerate(self.g) for x, c in enumerate(row) if c and c.lower() in s]

    def paint(self, rows, legend, x0=0, y0=0, only_on=''):
        """Paints text rows at (x0, y0): '.' keeps, ' ' erases, others are legend colours; the
        characters in `only_on` paint only over pixels already there (a strap round a head)."""
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch == '.':
                    continue
                if ch in only_on and self.get(x0 + dx, y0 + dy) is None:
                    continue
                self.set(x0 + dx, y0 + dy, None if ch == ' ' else legend[ch])
        return self

    def pad(self, left=0, top=0, right=0, bottom=0):
        w = self.w + left + right
        self.g = [[None] * w for _ in range(top)] + \
                 [[None] * left + r + [None] * right for r in self.g] + \
                 [[None] * w for _ in range(bottom)]
        return self

    def mirrored(self):
        return Pic([r[::-1] for r in self.g])

    def colours(self):
        out = []
        for row in self.g:
            for c in row:
                if c and c.lower() not in out:
                    out.append(c.lower())
        return out

    def dump(self):
        pal = {c: chr(97 + i) if i < 26 else chr(65 + i - 26) for i, c in enumerate(self.colours())}
        for y, row in enumerate(self.g):
            print(f'{y:2d} ' + ''.join(pal[c.lower()] if c else '.' for c in row))
        print(' '.join(f'{v}={k}' for k, v in pal.items()))


_POOL = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
         '!$%&*=?@^~<>/|;:#(){}[]_-,\'"`' + ''.join(chr(c) for c in range(0x3b1, 0x3ca)))


class Palette:
    """A look's palette that grows as pictures in hex colours go in."""

    def __init__(self, existing=None):
        self.pal = dict(existing or {})
        self.by = {v.lower(): k for k, v in self.pal.items()}

    def char(self, colour):
        c = colour.lower()
        if c in self.by:
            return self.by[c]
        for ch in _POOL:
            if ch not in self.pal:
                self.pal[ch] = c
                self.by[c] = ch
                return ch
        raise ValueError('palette full')

    def rows(self, pic):
        return [''.join('.' if c is None else self.char(c) for c in row) for row in pic.g]


# Skin ramps (light → dark) by the originals' tones, and replacement ramps.
BLAISE_SKIN = ['#fff7de', '#fff3bd', '#ffe3ad', '#ffd794', '#f7c384', '#f7ba7b', '#e7aa6b', '#e7a66b',
               '#de9663', '#d6965a', '#c6824a', '#bd7942', '#b57139', '#b56d39', '#a55529', '#a55129',
               '#945529', '#8c4921', '#734521', '#6b3c18', '#422c10']


def tone(colour, k):
    """A colour scaled toward black (k < 1) or white (k > 1)."""
    c = colour.lstrip('#')
    r, g, b = (int(c[i:i + 2], 16) for i in (0, 2, 4))
    if k <= 1:
        r, g, b = (round(v * k) for v in (r, g, b))
    else:
        t = k - 1
        r, g, b = (round(v + (255 - v) * t) for v in (r, g, b))
    return '#%02x%02x%02x' % (r, g, b)


def lum(colour):
    c = colour.lstrip('#')
    r, g, b = (int(c[i:i + 2], 16) for i in (0, 2, 4))
    return 0.299 * r + 0.587 * g + 0.114 * b


def by_light(pic, colours, ramp):
    """Recolours `colours` of a picture onto `ramp` (light → dark) by their lightness."""
    cs = sorted({c.lower() for c in colours if pic.where([c])}, key=lum, reverse=True)
    if not cs:
        return pic
    m = {}
    for i, c in enumerate(cs):
        j = round(i * (len(ramp) - 1) / max(1, len(cs) - 1))
        m[c] = ramp[j]
    return pic.recolor(m)


def skin_tones(pic, ramp, keep=()):
    """Every warm skin colour of a head mapped by lightness onto `ramp`, except `keep`."""
    keep = {k.lower() for k in keep}
    cs = [c for c in pic.colours() if _is_skin(c) and c not in keep]
    return by_light(pic, cs, ramp)


def _is_skin(c):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return r > 90 and r >= g >= b and r - b > 40 and not (r > 200 and g < 60)


def hair_tones(pic, colours, ramp):
    return by_light(pic, colours, ramp)


def shaded(mask, ramp, outline, light=(0.5, -0.6, 0.62), centre=None, radii=None):
    """A solid lit like a rounded body: `mask` rows ('#' filled), its pixels shaded from `ramp`
    (light → dark) by how they face `light` (x right, y down, z out of the screen), its edge in
    `outline`."""
    h = len(mask)
    w = max(len(r) for r in mask)
    filled = [[x < len(r) and r[x] == '#' for x in range(w)] for r in mask]
    xs = [x for y in range(h) for x in range(w) if filled[y][x]]
    ys = [y for y in range(h) for x in range(w) if filled[y][x]]
    cx, cy = centre or ((min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2)
    rx, ry = radii or ((max(xs) - min(xs) + 1) / 2, (max(ys) - min(ys) + 1) / 2)
    lx, ly, lz = light
    ln = (lx * lx + ly * ly + lz * lz) ** 0.5
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    g = [[None] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not filled[y][x]:
                continue
            edge = any(not (0 <= x + dx < w and 0 <= y + dy < h and filled[y + dy][x + dx])
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                g[y][x] = outline
                continue
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            nz = max(0.0, 1 - nx * nx - ny * ny) ** 0.5
            n = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1
            b = (nx * lx + ny * ly + nz * lz) / n
            b = max(0.0, min(1.0, (b + 0.25) / 1.25))
            g[y][x] = ramp[round((1 - b) * (len(ramp) - 1))]
    return Pic(g)


def beard(pic, y0, y1, x0, ramp, keep=()):
    """Stubble or a beard: the skin of rows y0..y1 (from column x0 on) in `ramp` by lightness,
    leaving `keep` (lips, teeth) alone."""
    keep = {k.lower() for k in keep}
    cs = []
    for y in range(y0, min(y1 + 1, pic.h)):
        for x in range(x0, pic.w):
            c = pic.get(x, y)
            if c and _is_skin(c) and c.lower() not in keep:
                cs.append((x, y, c))
    if not cs:
        return pic
    tones = sorted({c.lower() for _, _, c in cs}, key=lum, reverse=True)
    for x, y, c in cs:
        i = tones.index(c.lower())
        j = round(i * (len(ramp) - 1) / max(1, len(tones) - 1))
        pic.set(x, y, ramp[j])
    return pic


def hood(pic, edge, ramp, outline, top=4, grow=1, light=(0.45, -0.6, 0.65), right=None):
    """A hood over a head: the head's outline grown by `grow`, over every row above `top` and
    left of `edge(y)` (the face's front edge, per row) below it, and right of `right(y)` if given
    (a face seen from the front); shaded and pasted on."""
    p = pic.copy().pad(grow, grow, grow, grow)
    h, w = p.h, p.w
    solid = [[p.get(x, y) is not None for x in range(w)] for y in range(h)]
    grown = [[any(0 <= x + dx < w and 0 <= y + dy < h and solid[y + dy][x + dx]
                  for dx in range(-grow, grow + 1) for dy in range(-grow, grow + 1)) for x in range(w)]
             for y in range(h)]
    mask = []
    for y in range(h):
        oy = y - grow
        row = ''
        for x in range(w):
            ox = x - grow
            inside = grown[y][x] and (oy < top or ox < edge(oy) or (right is not None and ox > right(oy)))
            row += '#' if inside else '.'
        mask.append(row)
    cover = shaded(mask, ramp, outline, light=light)
    for y in range(h):
        for x in range(w):
            c = cover.get(x, y)
            if c:
                p.set(x, y, c)
    return p


def rim(pic, colours, edge_colour):
    """Darkens the outer edge of a picture's pixels of `colours` (hair) so its shape reads."""
    cs = {c.lower() for c in colours}
    out = pic.copy()
    for y in range(pic.h):
        for x in range(pic.w):
            c = pic.get(x, y)
            if c and c.lower() in cs and any(pic.get(x + dx, y + dy) is None
                                             for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.set(x, y, edge_colour)
    pic.g = out.g
    return pic


def neat_mouth(pic, front, dark, light, skin, smile=False):
    """Closed lips on the black-haired girl's face (3), instead of her open painted mouth: a thin
    line of the upper lip, a lighter lower lip under it, the corner lifted for a smile. Call it
    before padding the picture."""
    if not front:
        for x, y in ((12, 13), (13, 13), (14, 13), (13, 14), (14, 14)):
            pic.set(x, y, skin)
        pic.set(13, 13, dark).set(14, 13, dark).set(14, 14, light)
        if smile:
            pic.set(12, 12, dark)
    else:
        for x, y in ((9, 13), (10, 13), (11, 13), (10, 14), (11, 14)):
            pic.set(x, y, skin)
        pic.set(9, 13, dark).set(10, 13, dark).set(11, 13, dark).set(10, 14, light)
        if smile:
            pic.set(8, 12, dark).set(12, 12, dark)
    return pic
