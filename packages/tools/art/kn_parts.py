"""Sir Nobody's body: every turn of every body part repainted from its silhouette (the man's
original part, grown) in its own materials, lit from the upper front like the whole cast.

A part's frame is known from its sprite: the upright pictures lie along x (arms: shoulder or elbow
on the left, toe of a shoe on the right) or along y (legs and the body: hip, knee or neck on top),
and every next picture of a part is turned 22.5° clockwise. So each pixel gets `s`, how far along
the part it is (0 at the joint it hangs from, 1 at its other end), and `t`, across it (-1..1),
and a material picks its colour from them and from the light on a cylinder across the part.
That keeps the bands (a greave's rim, a bracer, a belt, a tabard's hem) in place on every turn.

Materials: plate (a cylinder of metal: sharp highlight, reflected light on its shadow edge),
chainmail (dark rings), cloth (soft), fur (clumps), leather. Shoes are drawn as pixel art."""
import math

from heads import Pic, shaded
from body import body_parts, inflate

L3 = (0.45, -0.6, 0.65)
_n = math.sqrt(sum(c * c for c in L3))
L3 = tuple(c / _n for c in L3)

# Upright direction from the joint a part hangs from to its other end.
_DIST0 = {
    'forearm': (1, 0), 'upper-arm': (1, 0), 'shoe': (1, 0),
    'shin': (0, 1), 'thigh': (0, 1), 'knee': (0, 1), 'torso': (0, 1), 'chest': (0, 1), 'hand': (1, 0),
}
_FIRST = {}
for _fam, _ids in (('forearm', [1]), ('upper-arm', [5, 9]), ('hand', [17, 21]), ('shin', [30]),
                   ('torso', [34]), ('shoe', [39, 43, 47]), ('thigh', [49, 53]), ('chest', [57]),
                   ('knee', [62])):
    for _f in _ids:
        for _k in range(4):
            _FIRST[_f + _k] = (_fam, _k)
_FIRST[38] = ('torso', 0)
_FIRST[61] = ('chest', 0)
_FIRST[48] = ('shoe', 0)
_FIRST[47] = ('shoe', 0)


def family(sid):
    return _FIRST[sid][0]


def is_front(sid):
    """The pictures of the body turned to us (torso, chest, shoe)."""
    return sid in (38, 61, 48)


class Frame:
    """Where every pixel of a part's picture lies on the part: `s` along it (0 at its joint),
    `t` across (-1..1), `b` the light on a cylinder across it."""

    def __init__(self, pic, sid):
        fam, k = _FIRST[sid]
        dx, dy = _DIST0[fam]
        a = math.radians(22.5 * k)
        ux, uy = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
        self.u = (ux, uy)
        self.v = (-uy, ux)
        pts = [(x, y) for y in range(pic.h) for x in range(pic.w) if pic.get(x, y)]
        self.cx = sum(p[0] for p in pts) / len(pts) + 0.5
        self.cy = sum(p[1] for p in pts) / len(pts) + 0.5
        sr = [self._s(x, y) for x, y in pts]
        self.s0, self.s1 = min(sr), max(sr)
        spans = {}
        for x, y in pts:
            key = round(self._s(x, y))
            t = self._t(x, y)
            lo, hi = spans.get(key, (t, t))
            spans[key] = (min(lo, t), max(hi, t))
        self.spans = spans
        self.vl = self.v[0] * L3[0] + self.v[1] * L3[1]

    def _s(self, x, y):
        return (x + 0.5 - self.cx) * self.u[0] + (y + 0.5 - self.cy) * self.u[1]

    def _t(self, x, y):
        return (x + 0.5 - self.cx) * self.v[0] + (y + 0.5 - self.cy) * self.v[1]

    def s(self, x, y):
        return (self._s(x, y) - self.s0) / max(1e-6, self.s1 - self.s0)

    def length(self):
        return self.s1 - self.s0 + 1

    def t(self, x, y):
        lo, hi = self.spans.get(round(self._s(x, y)), (-1, 1))
        return max(-1.0, min(1.0, (self._t(x, y) - (lo + hi) / 2) / max(0.5, (hi - lo) / 2)))

    def b(self, x, y):
        t = self.t(x, y)
        return t * self.vl + math.sqrt(max(0.0, 1 - t * t)) * L3[2]

    def lit_edge(self, pic, x, y):
        ex = ey = 0
        for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if pic.get(x + ddx, y + ddy) is None:
                ex += ddx
                ey += ddy
        return ex * L3[0] + ey * L3[1] > 0.1


def is_edge(pic, x, y):
    return any(pic.get(x + dx, y + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def tone(ramp, b, lo=-0.25, hi=1.0):
    """A ramp's colour (light → dark) for light `b`."""
    q = max(0.0, min(1.0, (b - lo) / (hi - lo)))
    return ramp[min(len(ramp) - 1, max(0, round((1 - q) * (len(ramp) - 1))))]


def shift(ramp, colour, n):
    """The colour `n` steps darker (n > 0) or lighter along its ramp."""
    i = ramp.index(colour) if colour in ramp else 0
    return ramp[max(0, min(len(ramp) - 1, i + n))]


def repaint(pic, sid, shader, outline, lit_outline=None):
    """A new picture of the part: `shader(f, x, y)` colours its inside (None leaves it clear),
    the edge is `outline` in shade and `lit_outline(colour inside)` where the light hits."""
    f = Frame(pic, sid)
    out = Pic([[None] * pic.w for _ in range(pic.h)])
    inside = {}
    for y in range(pic.h):
        for x in range(pic.w):
            if pic.get(x, y) is None:
                continue
            inside[(x, y)] = shader(f, x, y)
    for (x, y), c in inside.items():
        if c is None:
            continue
        if is_edge(pic, x, y):
            if lit_outline and f.lit_edge(pic, x, y):
                out.set(x, y, lit_outline(c) if callable(lit_outline) else lit_outline)
            else:
                out.set(x, y, outline)
        else:
            out.set(x, y, c)
    return out


# ------------------------------------------------------------------------------------- materials
def plate(ramp, spec=0.9):
    """Metal as a cylinder across the part: ramp light → dark, a sharp specular streak."""
    def m(f, x, y):
        b = f.b(x, y)
        if b > spec:
            return ramp[0]
        return tone(ramp[1:], b, -0.3, spec)
    return m


def mail(ramp):
    """Chainmail: dark rings, a ring's lit top on every other pixel, rows offset."""
    def m(f, x, y):
        b = f.b(x, y)
        c = tone(ramp[1:], b, -0.3, 0.95)
        if (x + y) % 2 == 0:
            c = shift(ramp, c, -1)
        return c
    return m


def cloth(ramp):
    def m(f, x, y):
        return tone(ramp, f.b(x, y), -0.4, 1.0)
    return m


def outfit(plan, keys=None):
    """The man's parts grown by `plan`, as silhouettes to repaint."""
    return body_parts(1, [], plan)


def far(pic, ramps):
    """The far limb a shade darker: every colour one step down its ramp."""
    out = pic.copy()
    for y in range(pic.h):
        for x in range(pic.w):
            c = pic.get(x, y)
            if c is None:
                continue
            for r in ramps:
                if c in r:
                    out.set(x, y, shift(r, c, 1))
                    break
    return out


def dome(mask_pic, ramp, outline, light=(0.45, -0.6, 0.65)):
    rows = [''.join('#' if mask_pic.get(x, y) else '.' for x in range(mask_pic.w)) for y in range(mask_pic.h)]
    return shaded(rows, ramp, outline, light=light)
