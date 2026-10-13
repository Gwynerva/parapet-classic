"""Rush B's toolkit: the eight soldiers' bodies are built from material maps lit by one light.

A part is a grid of material names (`None` transparent), drawn over a silhouette: the trunk's
cloth, a vest over it, a belt, straps, knee pads, a holster, a boot's shaft. `light()` turns the
silhouette into a rounded volume (the distance to its edge raised into a dome, smoothed) and
lights it from the upper front like the heads, so every material on it shares the same form: a
vest is lit where the cloth under it would be, a strap rolls over the chest's curve. Each
material has its own ramp (highlight, light, mid, shadow, deep shadow, hue-shifted: shadows warmer
or cooler and more saturated, highlights lighter), an outline for its edge in shade and a lighter
edge where the light hits; a material laid over another (`over`) darkens the pixels just under
its lower edge (the cast shadow of a vest on the shirt, of a belt on the trousers).

Camouflage and stripes are patterns in the part's own pixels, painted on the upright pictures
before the look tool turns them, so they turn with the part instead of crawling: the urban
tiger stripe (Phoenix), the snow camouflage (Arctic), the woodland camouflage (Guerrilla), the
desert camouflage of a helmet (GSG-9)."""
import colorsys
import math

from heads import Pic

# The light of the whole cast: x the way the runner faces, y down, z out of the screen.
LIGHT = (0.45, -0.6, 0.65)
# Arms are drawn lying along x, the shoulder (or the elbow) on the left; they mostly hang down,
# turned a quarter clockwise, so their picture sees the light from its upper left.
ARM_LIGHT = (-0.6, -0.45, 0.65)


# ------------------------------------------------------------------------------------- colours
def rgb(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def hexc(r, g, b):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v))) for v in (r, g, b))


def hls_shift(c, dh=0.0, dl=0.0, ds=0.0):
    r, g, b = (v / 255 for v in rgb(c))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + dh) % 1.0
    l = max(0.0, min(1.0, l + dl))
    s = max(0.0, min(1.0, s + ds))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return hexc(r * 255, g * 255, b * 255)


def mix(a, b, t):
    ra, ga, ba = rgb(a)
    rb, gb, bb = rgb(b)
    return hexc(ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t)


def _tone(c, dh, lk, sd):
    """`c` with its hue turned by dh, its lightness l → l + (1 - l) * lk (lk > 0) or l * (1 + lk)
    (lk < 0), its saturation moved by sd."""
    r, g, b = (v / 255 for v in rgb(c))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l + (1 - l) * lk if lk > 0 else l * (1 + lk)
    r, g, b = colorsys.hls_to_rgb((h + dh) % 1.0, max(0.0, min(1.0, l)), max(0.0, min(1.0, s + sd)))
    return hexc(r * 255, g * 255, b * 255)


def ramp5(base, warm=1, hi=0.34, li=0.15, sh=-0.3, dp=-0.55, sat=0.06, hue=0.022):
    """Five tones round a base colour, highlight to deep shadow, hue-shifted: shadows turn toward
    red (warm=1) or blue (warm=-1) and saturate, highlights toward yellow and lighten."""
    return [
        _tone(base, hue * warm, hi, -sat),
        _tone(base, hue * warm * 0.5, li, -sat * 0.4),
        base,
        _tone(base, -hue * warm, sh, sat),
        _tone(base, -hue * warm * 2, dp, sat * 1.5),
    ]


class Mat:
    """A material: `ramp` five tones (highlight → deep shadow), `edge` the outline in shade,
    `lit` the edge where the light hits, `bias` steps darker (a far limb, a recess), `pattern`
    a function (x, y) → another material's name or None (camouflage, stripes), `flat` how much the
    form's light is evened out (0 round, 1 flat: a stiff vest plate)."""

    def __init__(self, ramp, edge, lit=None, bias=0.0, pattern=None, flat=0.0, gloss=False, steps=None):
        self.ramp = list(ramp)
        self.edge = edge
        self.lit = lit or ramp[3]
        self.bias = bias
        self.pattern = pattern
        self.flat = flat
        self.gloss = gloss
        self.steps = steps


# ------------------------------------------------------------------------------------ the form
def _dist(mask):
    """Euclidean distance of every filled pixel to the nearest empty one (outside the box is
    empty), by brute force (the parts are tiny)."""
    h = len(mask)
    w = max(len(r) for r in mask)
    filled = [[x < len(mask[y]) and mask[y][x] for x in range(w)] for y in range(h)]
    empties = [(x, y) for y in range(-1, h + 1) for x in range(-1, w + 1)
               if not (0 <= x < w and 0 <= y < h and filled[y][x])]
    d = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if filled[y][x]:
                d[y][x] = min(math.hypot(x - ex, y - ey) for ex, ey in empties) - 0.5
    return d, filled, w, h


def light(mask, light=LIGHT, roundness=1.0, smooth=1, wrap=0.25):
    """The brightness (0..1) of every filled pixel of `mask` (rows of booleans) lit by `light`
    as a rounded volume (`wrap` lets the light reach a little past the terminator, so the shade
    is not a black half), and how far each is from the edge; returns (b, edge, depth) grids
    (edge: on the silhouette's edge; depth: the distance to it)."""
    d, filled, w, h = _dist(mask)
    dmax = max(max(r) for r in d) or 1
    # The dome: a quarter circle from the edge up to the deepest point.
    z = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if filled[y][x]:
                t = min(1.0, d[y][x] / dmax)
                z[y][x] = math.sqrt(max(0.0, 1 - (1 - t) ** 2)) * dmax * roundness
    for _ in range(smooth):
        z2 = [r[:] for r in z]
        for y in range(h):
            for x in range(w):
                if not filled[y][x]:
                    continue
                acc, n = 0.0, 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and filled[yy][xx]:
                            acc += z[yy][xx]
                            n += 1
                z2[y][x] = acc / n
        z = z2
    lx, ly, lz = light
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ln, ly / ln, lz / ln

    def at(xx, yy):
        if 0 <= yy < h and 0 <= xx < w and filled[yy][xx]:
            return z[yy][xx]
        return -0.6  # off the edge the form falls away

    b = [[None] * w for _ in range(h)]
    edge = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not filled[y][x]:
                continue
            gx = (at(x + 1, y) - at(x - 1, y)) / 2
            gy = (at(x, y + 1) - at(x, y - 1)) / 2
            nx, ny, nz = -gx, -gy, 1.0
            n = math.sqrt(nx * nx + ny * ny + nz * nz)
            b[y][x] = max(0.0, ((nx * lx + ny * ly + nz * lz) / n + wrap) / (1 + wrap))
            edge[y][x] = any(not (0 <= x + dx < w and 0 <= y + dy < h and filled[y + dy][x + dx])
                             for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    return b, edge, d


# Brightness thresholds of the five tones (highlight above the first).
STEPS = (0.93, 0.8, 0.6, 0.4)


def tone(bright, bias=0.0, steps=STEPS):
    v = bright - bias * 0.17
    for i, s in enumerate(steps):
        if v >= s:
            return i
    return 4


def render(mats_grid, mats, light_dir=LIGHT, over=(), shape=None, steps=STEPS, roundness=1.0, smooth=1,
           outline=True, wrap=0.25, bounce=True):
    """A Pic from a grid of material names: lit as one volume (or as `shape`, a mask of the
    volume when it differs from the drawn pixels), each pixel in its material's ramp (or its
    pattern's), edges outlined (dark in shade, `lit` where the light hits). `over`: (upper,
    lower) material pairs: the lower one darkens a step just under the upper's lower edge.
    `bounce`: light reflected back onto the shaded side just inside its outline (a step up from
    the deepest shade there), so the shadow side keeps its roundness."""
    h = len(mats_grid)
    w = max(len(r) for r in mats_grid)
    grid = [[(mats_grid[y][x] if x < len(mats_grid[y]) else None) for x in range(w)] for y in range(h)]
    mask = shape or [[c is not None for c in r] for r in grid]
    b, edge, depth = light(mask, light_dir, roundness, smooth, wrap)
    out = [[None] * w for _ in range(h)]
    shadow_of = {}
    for up, low in over:
        shadow_of.setdefault(low, set()).add(up)
    for y in range(h):
        for x in range(w):
            m = grid[y][x]
            if m is None:
                continue
            mat = mats[m]
            if mat.pattern:
                pm = mat.pattern(x, y)
                if pm:
                    mat = mats[pm]
            v = b[y][x] if b[y][x] is not None else 0.5
            if mat.flat:
                v = v * (1 - mat.flat) + 0.62 * mat.flat
            i = tone(v, mat.bias, mat.steps or steps)
            if bounce and i == 4 and depth[y][x] < 1.2:
                i = 3
            # Cast shadow under an upper layer's lower edge.
            ups = shadow_of.get(m, ())
            if ups and y > 0 and grid[y - 1][x] in ups:
                i = min(4, i + 1)
            if outline and edge[y][x]:
                out[y][x] = mat.lit if v >= 0.62 else mat.edge
            else:
                out[y][x] = mat.ramp[i]
    return Pic(out)


def grid_of(rows, legend):
    """A material grid from text rows: legend maps characters to material names ('.' empty)."""
    w = max(len(r) for r in rows)
    return [[legend.get(ch) if ch != '.' else None for ch in r.ljust(w, '.')] for r in rows]


def draft(rows, light_dir=LIGHT, chars='ABCEF', edge_dark='k', edge_lit='K', steps=STEPS, roundness=1.0, smooth=1):
    """Text rows of a silhouette ('#') shaded in five characters, for drafting a picture by
    hand: prints and returns them."""
    mask = [[ch != '.' for ch in r] for r in rows]
    b, edge, _ = light(mask, light_dir, roundness, smooth)
    out = []
    for y, r in enumerate(rows):
        s = ''
        for x, ch in enumerate(r):
            if ch == '.':
                s += '.'
            elif edge[y][x]:
                s += edge_lit if b[y][x] >= 0.62 else edge_dark
            else:
                s += chars[tone(b[y][x], 0, steps)]
        out.append(s)
    return out


# ------------------------------------------------------------------------------------ patterns
def _hash(ix, iy, seed):
    h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65536


def noise(x, y, cell=3.0, seed=1):
    """Smooth value noise in 0..1, blobs about `cell` pixels across."""
    fx, fy = x / cell, y / cell
    ix, iy = math.floor(fx), math.floor(fy)
    tx, ty = fx - ix, fy - iy
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = _hash(ix, iy, seed)
    b = _hash(ix + 1, iy, seed)
    c = _hash(ix, iy + 1, seed)
    d = _hash(ix + 1, iy + 1, seed)
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty


def blotches(levels, cell=3.0, seed=1, stretch=1.0):
    """Camouflage: `levels` [(threshold, material), ...] from the highest; a pixel whose noise is
    above a threshold takes its material (else the base's own)."""
    def pattern(x, y):
        v = noise(x * stretch, y, cell, seed)
        for t, m in levels:
            if v >= t:
                return m
        return None
    return pattern


def tiger(dark, mid, light=None, seed=3, period=4, on=0.32):
    """The tiger stripe: broken horizontal streaks, wavy, tapering, dark ones with a mid-tone
    edge, on the base."""
    def pattern(x, y):
        wave = round(1.2 * math.sin(x * 0.8 + seed) + 0.6 * math.sin(x * 0.37 + seed * 2))
        row = y + wave
        band = math.floor(row / period)
        k = row - band * period
        seg = math.floor((x + band * 3 + seed) / 5)
        if _hash(seg, band, seed) <= on:
            return None
        if k == 0:
            return dark
        if k == 1 and _hash(seg, band, seed + 7) > 0.45:
            return mid
        if light and k == 2 and _hash(seg, band, seed + 11) > 0.7:
            return light
        return None
    return pattern


# --------------------------------------------------------------------------------------- parts
def mask_of(pic):
    return [[c is not None for c in r] for r in pic.g]


def grow_mask(mask, n=1, axis=None):
    """A mask grown by n pixels each way (or across `axis` only), padded to keep its centre."""
    for _ in range(n):
        dx = 0 if axis == 'y' else 1
        dy = 0 if axis == 'x' else 1
        h, w = len(mask), len(mask[0])
        out = [[False] * (w + 2 * dx) for _ in range(h + 2 * dy)]
        for y in range(h):
            for x in range(w):
                if mask[y][x]:
                    for ex, ey in ((0, 0), (dx, 0), (-dx, 0), (0, dy), (0, -dy)):
                        out[y + dy + ey][x + dx + ex] = True
        mask = out
    return mask


def shrink_mask(mask, n=1, axis=None):
    """A mask thinned by n pixels each way (or across `axis`); a row or column never vanishes."""
    for _ in range(n):
        h, w = len(mask), len(mask[0])
        out = [r[:] for r in mask]
        for y in range(h):
            for x in range(w):
                if not mask[y][x]:
                    continue
                for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if (axis == 'x' and ey) or (axis == 'y' and ex):
                        continue
                    xx, yy = x + ex, y + ey
                    if not (0 <= xx < w and 0 <= yy < h and mask[yy][xx]):
                        # keep it if the pixel across is empty too (a one-pixel line)
                        bx, by = x - ex, y - ey
                        if 0 <= bx < w and 0 <= by < h and mask[by][bx]:
                            out[y][x] = False
                        break
        mask = out
    return mask


class Part:
    """A part being painted: its mask and a grid of material names over it."""

    def __init__(self, pid, mask, base='cloth'):
        self.pid = pid
        self.mask = mask
        self.h = len(mask)
        self.w = len(mask[0])
        self.grid = [[base if mask[y][x] else None for x in range(self.w)] for y in range(self.h)]

    def span(self, y):
        """The first and last filled column of row y (or None)."""
        xs = [x for x in range(self.w) if self.mask[y][x]]
        return (xs[0], xs[-1]) if xs else None

    def col(self, x):
        ys = [y for y in range(self.h) if self.mask[y][x]]
        return (ys[0], ys[-1]) if ys else None

    def top(self):
        return min(y for y in range(self.h) if any(self.mask[y]))

    def bottom(self):
        return max(y for y in range(self.h) if any(self.mask[y]))

    def set(self, x, y, m, only=None):
        """Paints (x, y) with material m if it is filled (and its material is in `only`)."""
        if 0 <= y < self.h and 0 <= x < self.w and self.mask[y][x]:
            if only is None or self.grid[y][x] in only:
                self.grid[y][x] = m
        return self

    def rows(self, y0, y1, m, x0=None, x1=None, only=None):
        for y in range(y0, y1 + 1):
            for x in range(self.w if x1 is None else x1 + 1):
                if x0 is None or x >= x0:
                    self.set(x, y, m, only)
        return self

    def paint(self, fn):
        """fn(x, y, part) → a material or None (keep), over every filled pixel."""
        for y in range(self.h):
            for x in range(self.w):
                if self.mask[y][x]:
                    m = fn(x, y, self)
                    if m:
                        self.grid[y][x] = m
        return self

    def text(self, rows, legend, x0=0, y0=0):
        """Materials from text rows at (x0, y0): legend maps characters to material names, '.'
        keeps; a character outside the mask grows it there."""
        for dy, r in enumerate(rows):
            for dx, ch in enumerate(r):
                if ch == '.':
                    continue
                x, y = x0 + dx, y0 + dy
                if 0 <= y < self.h and 0 <= x < self.w:
                    if ch == ' ':
                        self.mask[y][x] = False
                        self.grid[y][x] = None
                    else:
                        self.mask[y][x] = True
                        self.grid[y][x] = legend[ch]
        return self

    def pad(self, left=0, top=0, right=0, bottom=0):
        w = self.w + left + right
        self.mask = [[False] * w for _ in range(top)] + [[False] * left + r + [False] * right for r in self.mask] + \
                    [[False] * w for _ in range(bottom)]
        self.grid = [[None] * w for _ in range(top)] + [[None] * left + r + [None] * right for r in self.grid] + \
                    [[None] * w for _ in range(bottom)]
        self.h, self.w = len(self.mask), w
        return self

    def render(self, mats, light_dir=LIGHT, **kw):
        return render(self.grid, mats, light_dir, **kw)


def aligned(part, ox, oy, w0, h0):
    """Pads a part so the original picture's box (w0 x h0, its corner at (ox, oy) of the part)
    keeps its centre where the game puts the part's point."""
    left = right = top = bottom = 0
    d = 2 * ox + w0 - part.w
    if d > 0:
        right = d
    else:
        left = -d
    d = 2 * oy + h0 - part.h
    if d > 0:
        bottom = d
    else:
        top = -d
    return part.pad(left, top, right, bottom)
