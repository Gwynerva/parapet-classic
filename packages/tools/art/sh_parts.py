"""Shahzada's body pieces: helpers that paint along a part whatever its turn (a bracer round the
wrist end of a forearm, a seam down a trouser leg, a band round an upper arm), and his boots,
shoes and props drawn as text pictures."""
import math

from heads import Pic

# Families by sprite id (Blaise's numbering) and how a family's upright picture lies.
ARM_IDS = set(range(1, 13)) | set(range(17, 25))


def rot_index(id_):
    """Which turn of its part a sprite is: 0 upright, 1-3 turned 22.5° more each, 4 seen from
    the front (the chest 61, the torso 38)."""
    firsts = [1, 5, 9, 17, 21, 30, 34, 39, 43, 47, 49, 53, 57, 62]
    first = max(f for f in firsts if f <= id_)
    return id_ - first


def axis(pic, id_):
    """For every filled pixel (x, y) → (s, t, d0, d1): s from 0 at the part's start (shoulder,
    elbow, hip, knee, neck) to 1 at its end, t from -1 to 1 across it at that point (arms: + toward
    the top of the upright picture; legs and body: + toward the back, - toward the front, the way
    he runs), d0 / d1 pixels from the start / the end."""
    k = rot_index(id_)
    if id_ in (38, 61) or id_ in (47, 48):
        th = 0.0
    else:
        th = math.radians(22.5 * k)
    if id_ in ARM_IDS:
        d = (math.cos(th), math.sin(th))
    else:
        d = (-math.sin(th), math.cos(th))
    n = (d[1], -d[0])
    if id_ not in ARM_IDS:
        n = (-n[0], -n[1])
    pts = [(x, y) for y in range(pic.h) for x in range(pic.w) if pic.get(x, y)]
    if not pts:
        return {}
    proj = {p: ((p[0] + 0.5) * d[0] + (p[1] + 0.5) * d[1], (p[0] + 0.5) * n[0] + (p[1] + 0.5) * n[1]) for p in pts}
    s0 = min(v[0] for v in proj.values())
    s1 = max(v[0] for v in proj.values())
    spans = {}
    for p, (s, t) in proj.items():
        key = round(s)
        lo, hi = spans.get(key, (t, t))
        spans[key] = (min(lo, t), max(hi, t))
    out = {}
    for p, (s, t) in proj.items():
        lo, hi = spans[round(s)]
        mid = (lo + hi) / 2
        half = max(0.5, (hi - lo) / 2)
        out[p] = ((s - s0) / max(1e-6, s1 - s0), max(-1.0, min(1.0, (t - mid) / half)), s - s0, s1 - s)
    return out


def edge(pic, x, y):
    """Whether a filled pixel is on the picture's outline."""
    return any(pic.get(x + dx, y + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def lit(pic, x, y, light=(0.45, -0.6)):
    """How much a pixel of a part faces the light, roughly: -1 (away) to 1, from where its empty
    neighbours are (an edge facing up and ahead is lit)."""
    v = 0.0
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        if pic.get(x + dx, y + dy) is None:
            v += dx * light[0] + dy * light[1]
    return v


def paint(pic, id_, fn):
    """Calls fn(x, y, s, t, colour, d0, d1) for every filled pixel (d0 / d1: pixels from the start
    and the end along the part); a colour it returns replaces the pixel."""
    for (x, y), (s, t, d0, d1) in axis(pic, id_).items():
        c = fn(x, y, s, t, pic.get(x, y), d0, d1)
        if c:
            pic.set(x, y, c)
    return pic


def ramp_by(colour_ramp, value):
    """A colour of a ramp (light → dark) for value 0 (lightest) … 1 (darkest)."""
    i = round(max(0.0, min(1.0, value)) * (len(colour_ramp) - 1))
    return colour_ramp[i]


def tone_of(colour, ramp):
    """The index of `colour` in `ramp`, or of the nearest colour of it by lightness."""
    from heads import lum
    if colour is None:
        return None
    c = colour.lower()
    for i, r in enumerate(ramp):
        if r.lower() == c:
            return i
    l = lum(c)
    return min(range(len(ramp)), key=lambda i: abs(lum(ramp[i]) - l))


def relight(pic, id_, ramp, outline, light=(0.45, -0.6, 0.65), keep=()):
    """Re-lights a part as a round tube of `ramp` (light → dark) along its axis, outlined:
    cloth or leather that keeps the part's silhouette. Pixels of `keep` stay."""
    keep = {k.lower() for k in keep}
    lx, ly, lz = light
    ln = (lx * lx + ly * ly + lz * lz) ** 0.5
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    k = rot_index(id_)
    th = 0.0 if id_ in (38, 61, 47, 48) else math.radians(22.5 * k)
    if id_ in ARM_IDS:
        nvec = (math.sin(th), -math.cos(th))
    else:
        # t grows toward the back of the body and the legs (the front of an upright picture is +x)
        nvec = (-math.cos(th), -math.sin(th))
    ax = axis(pic, id_)
    out = pic.copy()
    for (x, y), (s, t, d0, d1) in ax.items():
        c = pic.get(x, y)
        if c and c.lower() in keep:
            continue
        if edge(pic, x, y):
            out.set(x, y, outline)
            continue
        nz = max(0.0, 1 - t * t) ** 0.5
        nx, ny = t * nvec[0], t * nvec[1]
        b = nx * lx + ny * ly + nz * lz
        b = max(0.0, min(1.0, (b + 0.25) / 1.25))
        out.set(x, y, ramp_by(ramp, 1 - b))
    pic.g = out.g
    return pic
