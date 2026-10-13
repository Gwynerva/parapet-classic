"""Sir Nobody's helms, drawn from scratch: there is no face, the helm is the face.

* Sunlight (Solaire of Astora, Dark Souls): the Iron Helm, a tall flat-topped bucket, one black
  eye slit at a third of its height; the raised strip down the middle of the face plate crosses
  the slit (the "cross" seen 3/4), breaths beside it, a riveted brow band; a mail coif under it.
  Dull warm iron.
* Onion (Siegmeyer / Siegward of Catarina): a fluted onion with a spike, wider than the head,
  the slit along its widest line, a row of breaths under it, a flared neck rim. Pale tin-bronze
  with a pinkish sheen on the crown.
* Hollow (Artorias of the Abyss + the Hollow Knight): a narrow hounskull, its crown drawn up to a
  point, its visor pushed forward into a snout; the slit is a void with one white pixel of an
  eye in it (two seen 3/4): nobody inside, something looking out. Dark steel, a cold blue sheen
  on its shadow side.

Each helm is a little solid (`f(x, y, z) < 0` inside: x the way he faces, y up, z his side)
seen from the side (the profile, 25) and turned 60° to us (the 3/4 face, 29), lit like the whole
cast from the upper front: a Lambert ramp with hue shifting (light warm and yellowish, shade cool),
a sharp specular, reflected light on the shadow edge, a darker underside that mirrors the ground,
a dark outline in shade and a lighter coloured one where the light hits (sel-out). Details (slit,
breaths, rivets, flutes) are painted where the surface is, so both views agree; a few pixels are
touched up by hand after.

The profile faces right on a 17 × 19 box (the man's 17 × 17 head with a row more above and
below: the helm is taller than a head and covers the neck); the look tool turns it into 26-28.
The 3/4 face (29) is 15 × 19."""
import math

from heads import Pic

_L = (0.45, 0.6, 0.65)  # the cast's light, y up here
_n = math.sqrt(sum(c * c for c in _L))
L = tuple(c / _n for c in _L)
_h = (L[0], L[1], L[2] + 1)
_n = math.sqrt(sum(c * c for c in _h))
HALF = tuple(c / _n for c in _h)


def _norm(v):
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / n for c in v)


class Hit:
    """What the ray from a pixel met: the point (object space), the normal (view space), how lit
    it is (`b`, -1..1), the specular, the angle round the helm from its front (`th`, degrees,
    positive toward his near side) and the height `y`."""

    def __init__(self, p, n, view_n):
        self.p = p
        self.x, self.y, self.z = p
        self.n = n
        self.nv = view_n
        self.b = sum(a * b for a, b in zip(view_n, L))
        self.spec = max(0.0, sum(a * b for a, b in zip(view_n, HALF))) ** 36
        self.th = math.degrees(math.atan2(self.z, self.x))
        self.r = math.hypot(self.x, self.z)


def render(f, w, h, cx, cy, yaw, paint, pitch=10.0, step=0.04, depth=14.0, spec_axis=None):
    """Every pixel of a `w` × `h` picture whose ray meets the solid: `paint(hit)` gives its
    colour (or None to leave it clear). `cx`, `cy`: where the helm's axis is in the picture;
    `yaw`: degrees the helm is turned from the profile toward us; `pitch`: degrees we look down
    on it (a sliver of its crown shows). `spec_axis` 'y' makes the specular a vertical streak
    (a cylinder brushed along its height)."""
    a = math.radians(yaw)
    fwd = (math.cos(a), 0.0, math.sin(a))
    lat = (-math.sin(a), 0.0, math.cos(a))
    bt = math.radians(pitch)
    ey = (0.0, math.cos(bt), -math.sin(bt))  # the view's up, in the world
    ez = (0.0, math.sin(bt), math.cos(bt))   # toward the viewer, in the world

    def to_obj(X, Y, Z):
        wx = X
        wy = Y * ey[1] + Z * ez[1]
        wz = Y * ey[2] + Z * ez[2]
        return (wx * fwd[0] + wz * fwd[2], wy, wx * lat[0] + wz * lat[2])

    def to_view(n):
        wx = n[0] * fwd[0] + n[2] * lat[0]
        wy = n[1]
        wz = n[0] * fwd[2] + n[2] * lat[2]
        return _norm((wx, wy * ey[1] + wz * ey[2], wy * ez[1] + wz * ez[2]))

    hits = {}
    for j in range(h):
        for i in range(w):
            X = i + 0.5 - cx
            Y = cy - (j + 0.5)
            Z = depth
            while Z > -depth:
                p = to_obj(X, Y, Z)
                if f(*p) < 0:
                    break
                Z -= step
            else:
                continue
            e = 0.05
            g = (f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]),
                 f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]),
                 f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e))
            n = _norm(g)
            hit = Hit(p, n, to_view(n))
            if spec_axis == 'y' and abs(n[1]) < 0.5:
                # A streak along the height: the light and the eye seen from above.
                hv = to_view((n[0], 0.0, n[2]))
                hh = _norm((HALF[0], 0.0, HALF[2]))
                hit.spec = max(0.0, hv[0] * hh[0] + hv[2] * hh[2]) ** 40
            hits[(i, j)] = hit
    pic = Pic([[None] * w for _ in range(h)])
    for (i, j), hit in hits.items():
        pic.set(i, j, paint(hit))
    return pic, hits


def tone(ramp, b, lo=-0.35, hi=0.95):
    """A ramp's colour (light → dark) for the light `b`."""
    q = max(0.0, min(1.0, (b - lo) / (hi - lo)))
    return ramp[min(len(ramp) - 1, max(0, round((1 - q) * (len(ramp) - 1))))]


# Light → a ramp's step (1: highlight … 6: deep shadow; 0, the specular, is given apart): uneven
# steps, so the lit side keeps a few tones and the turn into shade is quick.
CUTS = (0.66, 0.5, 0.3, 0.08, -0.2)


def cut(ramp, b, cuts=CUTS, shift=0):
    i = 1 + sum(1 for c in cuts if b < c) + shift
    return ramp[max(1, min(len(ramp) - 1, i))]


def step_ramp(ramp, colour, k):
    if colour not in ramp:
        return colour
    return ramp[max(0, min(len(ramp) - 1, ramp.index(colour) + k))]


def outline(pic, hits, dark, lit, rim=None, rim_ramp=None, keep=()):
    """The silhouette's edge: `lit` (sel-out) where its surface faces the light, `dark` in shade;
    `rim(colour)` lightens the pixel just inside the shadow edge (reflected light)."""
    out = pic.copy()
    w, h = pic.w, pic.h

    def solid(x, y):
        return pic.get(x, y) is not None

    for y in range(h):
        for x in range(w):
            if not solid(x, y) or pic.get(x, y) in keep:
                continue
            edges = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not solid(x + dx, y + dy)]
            if not edges:
                continue
            ex = sum(d[0] for d in edges)
            ey = sum(d[1] for d in edges)
            # Facing the light: the edge points right (ahead) or up.
            facing = ex * L[0] - ey * L[1]
            out.set(x, y, lit if facing > 0.25 else dark)
            if rim and facing < -0.2:
                ix, iy = x - (1 if ex > 0 else -1 if ex < 0 else 0), y - (1 if ey > 0 else -1 if ey < 0 else 0)
                c = pic.get(ix, iy)
                if c is not None and (ix, iy) in hits and not any(
                        not solid(ix + dx, iy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    hb = hits[(ix, iy)]
                    if hb.b < 0.2 and c in (rim_ramp or ()):
                        out.set(ix, iy, rim)
    return out


def patch(pic, rows, legend, x0=0, y0=0):
    """Hand touch-ups: '.' keeps a pixel, ' ' clears it, others paint a legend colour."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            pic.set(x0 + dx, y0 + dy, None if ch == ' ' else legend[ch])
    return pic


def smax(a, b, k=0.6):
    h = max(0.0, min(1.0, 0.5 + 0.5 * (b - a) / k))
    return a * (1 - h) + b * h + k * h * (1 - h)


def smin(a, b, k=0.6):
    return -smax(-a, -b, k)


# ------------------------------------------------------------------------------------- Sunlight
# Dull warm iron: highlights cream, shade cool violet-grey, reflected light warm.
IRON = ['#f6f0dc', '#d6cfb8', '#aca592', '#858174', '#646270', '#4a4858', '#34323f']
IRON_SPEC = '#fffcf0'
IRON_RIM = '#8a7a68'
IRON_OUT = '#17151c'
IRON_SEL = '#5c4c3e'
VOID = '#060608'
MAIL_COIF = ['#a29a88', '#7a7466', '#575348', '#3a362e', '#24211c']

B_R = 6.2      # radius across (seen in profile: its depth)
B_TOP = 7.4    # crown above the axis' middle
B_BOT = -5.0   # its lower edge, on the gorget
SLIT_Y = 2.0   # the slit's row (pixel centres on half units)
BAND = (SLIT_Y - 1.6, SLIT_Y + 1.5)  # the band round the helm the slit is cut in
STRIP = 6.5    # half width of the strip down the face plate, degrees


def bucket_f(x, y, z):
    r = math.hypot(x, z * 1.04)
    th = abs(math.degrees(math.atan2(z, x)))
    rad = B_R
    if th < STRIP and B_BOT < y < BAND[1]:
        rad += 0.45
    side = r - rad
    cap = max(y - B_TOP, B_BOT - y)
    helm = smax(side, cap, 0.9)
    # The gorget: steel lames flaring out under the helm.
    gy = B_BOT - y
    if -0.4 < gy < 3.2:
        flare = B_R - 0.4 + 0.55 * max(0.0, gy)
        g = max(r - flare, max(y - B_BOT - 0.4, -y + B_BOT - 3.0))
        helm = min(helm, g)
    return helm


def bucket_paint(hit):
    th, y, b = hit.th, hit.y, hit.b
    a = abs(th)
    if y < B_BOT - 0.1:
        # The gorget's lames, each a little cylinder of its own, darker toward the back.
        lame = ((th + 360) / 17) % 1
        c = tone(IRON, b + (0.12 if lame < 0.5 else -0.3), -0.5, 1.1)
        if y < B_BOT - 2.0:
            c = step_ramp(IRON, c, 1)
        return c
    c = cut(IRON, b)
    row = round(SLIT_Y - y)  # rows under the slit (negative: above it)
    # The crown's rim catches the sky.
    if y > B_TOP - 0.9:
        c = step_ramp(IRON, c, -1)
    # The band the slit is cut in: its top edge lit, a soft shadow under it.
    if row == -1 and a < 120:
        c = step_ramp(IRON, c, -1)
    if row == 2 and a < 120:
        c = step_ramp(IRON, c, 1)
    # The slit, one row, either side of the strip.
    if STRIP <= a < 52 and row == 0:
        return VOID
    # The strip: its lit edge and its shaded one (the cross).
    if a < STRIP + 1 and row >= -1:
        c = step_ramp(IRON, c, -1 if th < 1.5 else 2)
    if hit.spec > 0.6 and row not in (-1, 0, 2):
        return IRON_SPEC
    # The lower rows mirror the dark ground.
    if y < B_BOT + 1.0:
        c = step_ramp(IRON, c, 1)
    return c


def _bucket(yaw, w, cx):
    helm, hits = render(bucket_f, w, 19, cx, 9.3, yaw, bucket_paint, spec_axis='y')
    return outline(helm, hits, IRON_OUT, IRON_SEL, IRON_RIM, IRON[3:])


# Drawn by hand over the renderer's tone layout: clusters read better than a gradient at this
# size. k outline in shade, o outline in the light (sel-out), W specular, h l m n d D the iron
# light → deep shade (cool), r reflected light (warm), s the slit (nothing inside).
IRON_KEY = {'k': IRON_OUT, 'o': IRON_SEL, 'W': IRON_SPEC, 'h': IRON[1], 'l': IRON[2], 'm': IRON[3],
            'n': IRON[4], 'd': IRON[5], 'D': IRON[6], 'r': IRON_RIM, 's': VOID}

BUCKET = [
    '.................',
    '....kkkkkkkkkoo..',
    '...kdnmmllhhhhho.',
    '...knmmllhhWWhho.',
    '...krddnmmmlhWlo.',
    '...krddnmmmlhWlo.',
    '...krddnmmmlhWlo.',
    '...krdnnmmllhhho.',
    '...krddnmmmsssho.',
    '...krddnmmmlhWlo.',
    '...kDDdnnnmmllmo.',
    '...krddnmmmlhWlo.',
    '...krddnmmmlhWlo.',
    '...krddnmmmlhWlo.',
    '...kDddnnmmmllmo.',
    '..kkDDDDDDdddddko',
    '..kdlldlldhhdhWho',
    '.kDmmDmmDllDlhlho',
    '.kkkkkkkkkkkkkkoo',
]

BUCKET_FRONT = [
    '...............',
    '...kkkkkkkkkoo.',
    '..kdnmmllhhhhho',
    '..knmmllhhhWhho',
    '.krdnnmmllnWlmo',
    '.krdnnmmllnWlmo',
    '.krdnnmmllnWlmo',
    '.krdnmmllhnWhlo',
    '.krdnsssssnWsso',
    '.krdnnmmllnWlmo',
    '.kDDdnnmmmdWmno',
    '.krdnnmmllnWlmo',
    '.krdnnmmllnWlmo',
    '.krdnnmmllnWlmo',
    '.kDddnnmmmdhmno',
    'kkDDDDDDdddddko',
    'kdlldlldhhdhWho',
    'kDmmDmmDllDlhlo',
    'kkkkkkkkkkkkkko',
]


def bucket():
    return Pic.text(BUCKET, IRON_KEY)


def bucket_front():
    return Pic.text(BUCKET_FRONT, IRON_KEY)


def bucket_render():
    """The renderer's underpainting the drawing was made over."""
    return _bucket(0, 17, 8.9)


def bucket_front_render():
    return _bucket(62, 15, 7.5)


# ---------------------------------------------------------------------------------------- Onion
# Brass-tin: highlights pale cream, mids gold-olive, shade olive-brown; reflected light teal (the
# helm in the reference picks up the green of the moss around).
TIN = ['#fffbe2', '#f2dea0', '#d6b870', '#b09450', '#86703a', '#5e4c2a', '#3a2e1e']
TIN_SPEC = '#fffaea'
TIN_RIM = '#4e6e5e'
TIN_OUT = '#1c1712'
TIN_SEL = '#6a5634'

O_WIDE = 0.4     # height of the widest line (the band and the slit)
O_TOP = 7.6      # where the bulb ends in the spike
O_BOT = -5.2     # the bulb's lower end, over the neck
O_MAX = 7.5


def onion_r(y):
    """The bulb's radius at height y: a full dome pinched into the spike, rounded into the neck."""
    if y > O_TOP or y < O_BOT:
        return -1.0
    if y >= O_WIDE:
        t = (y - O_WIDE) / (O_TOP - O_WIDE)  # 0 at the widest, 1 at the tip
        return O_MAX * math.sqrt(max(0.0, 1 - t ** 2.2)) * (1 - 0.35 * t ** 3)
    t = (O_WIDE - y) / (O_WIDE - O_BOT)
    return O_MAX * math.sqrt(max(0.0, 1 - 0.78 * t * t))


def onion_f(x, y, z):
    r = math.hypot(x, z)
    body = r - onion_r(y)
    spike = r - 0.6 * (1 - (y - O_TOP + 0.6) / 2.6) if O_TOP - 0.8 < y < O_TOP + 2.0 else 9.0
    neck = 9.0
    if y < O_BOT + 0.6:
        rad = 3.4 if y > O_BOT - 1.6 else 4.6
        neck = max(r - rad, max(y - O_BOT - 0.6, O_BOT - 2.7 - y))
    return min(body, spike, neck)


FLUTES = 12


def onion_paint(hit):
    th, y, b = hit.th, hit.y, hit.b
    if y > O_TOP - 0.4:
        return TIN[2] if b > 0.3 else TIN[4]
    if y < O_BOT:
        # The neck in the bulb's shadow, its flared rim catching the light.
        return cut(TIN, b, shift=2 if y > O_BOT - 1.6 else 1)
    c = cut(TIN, b, shift=1)
    row = round(O_WIDE - y)
    if row == 0 and abs(th) < 64:
        return VOID
    if row == 0:
        return cut(TIN, b, shift=1)
    if row == -1:
        c = cut(TIN, b, shift=0)
    if row == 1:
        c = cut(TIN, b, shift=2)
    if hit.spec > 0.45 and row not in (0, -1, 1):
        return TIN_SPEC
    if y < O_BOT + 1.5:
        c = cut(TIN, b, shift=2)
    return c


def flutes(pic, hits, yaw, cx, cy, pitch=10.0):
    """Grooves down the bulb's meridians, one pixel on every row, each with its ridge lit on the
    side toward the light; rivets on the band."""
    a = math.radians(yaw)
    out = pic.copy()
    for k in range(FLUTES):
        phi = 2 * math.pi * k / FLUTES + math.pi / FLUTES
        # Seen: the meridian's angle round toward the viewer.
        vz = math.sin(phi + a)
        vx = math.cos(phi + a)
        if vz < 0.2:
            continue
        for j in range(pic.h):
            y = cy - (j + 0.5)
            yo = y / math.cos(math.radians(pitch))
            if not (O_BOT + 0.8 < yo < O_TOP - 1.2) or abs(round(O_WIDE - yo)) <= 1:
                continue
            x = int(math.floor(cx + onion_r(yo) * vx))
            c = pic.get(x, j)
            if c is None or c in (TIN_OUT, TIN_SEL, VOID) or (x, j) not in hits:
                continue
            out.set(x, j, step_ramp(TIN, c, 2 if yo > O_WIDE else 1) if c != TIN_SPEC else TIN[2])
            nx = x + 1
            c2 = pic.get(nx, j)
            if c2 in TIN and (nx, j) in hits and hits[(nx, j)].b > 0.15:
                out.set(nx, j, step_ramp(TIN, c2, -1) if TIN.index(c2) > 1 else c2)
    for k in range(FLUTES):
        phi = 2 * math.pi * k / FLUTES
        vz, vx = math.sin(phi + a), math.cos(phi + a)
        if vz < 0.3:
            continue
        j = int(math.floor(cy - O_WIDE * math.cos(math.radians(pitch)) - 0.5)) - 1
        x = int(math.floor(cx + O_MAX * vx))
        if out.get(x, j) in TIN:
            out.set(x, j, TIN[-1])
    return out


def one_spec(pic, hits, spec, under, n=2):
    """Only the `n` brightest specular pixels stay: a crisp glint, not a blob."""
    lit = sorted(((h.spec, xy) for xy, h in hits.items() if pic.get(*xy) == spec), reverse=True)
    for _, (x, y) in lit[n:]:
        pic.set(x, y, under)
    return pic


def _onion(yaw, w, cx):
    cy = 10.2
    pic, hits = render(onion_f, w, 19, cx, cy, yaw, onion_paint, pitch=4.0)
    pic = one_spec(pic, hits, TIN_SPEC, TIN[1])
    pic = flutes(pic, hits, yaw, cx, cy, pitch=4.0)
    return outline(pic, hits, TIN_OUT, TIN_SEL, TIN_RIM, TIN[4:])


def onion():
    return _onion(0, 17, 8.5)


def onion_front():
    return _onion(62, 15, 7.5)


# --------------------------------------------------------------------------------------- Hollow
STEEL = ['#c8bec2', '#968a8c', '#706466', '#54494c', '#3c3439', '#29232a', '#1a161c']
STEEL_SPEC = '#f0ecf2'
STEEL_RIM = '#3e5a80'
STEEL_OUT = '#0b090d'
STEEL_SEL = '#4a3e46'
EYE = '#f6f6fa'
ABYSS = '#030306'


def hound_r(y, th):
    """The hounskull: a narrow egg drawn up to a point, its visor a snout pushed forward."""
    if y > 8.6 or y < -5.2:
        return -1.0
    if y >= 0.5:
        t = (y - 0.5) / 8.1
        base = 5.6 * math.sqrt(max(0.0, 1 - t ** 1.9)) * (1 - 0.25 * t)
    else:
        t = (0.5 - y) / 5.7
        base = 5.6 * math.sqrt(max(0.0, 1 - 0.55 * t * t)) - 0.9 * t
    snout = 0.0
    if -4.8 < y < 1.6:
        s = 1 - abs(y + 1.4) / 3.4
        snout = 2.3 * max(0.0, s) * max(0.0, math.cos(th)) ** 6
    return base + snout


def hound_f(x, y, z):
    r = math.hypot(x, z * 1.15)
    th = math.atan2(z, x)
    body = r - hound_r(y, th)
    neck = max(math.hypot(x + 0.8, z) - 3.4, max(y + 4.4, -7.6 - y)) if y < -4.0 else 9.0
    return min(body, neck)


def hound_paint(hit):
    th, y, b = hit.th, hit.y, hit.b
    c = tone(STEEL, b, -0.35, 0.95)
    if abs(th) < 62 and abs(y - 1.9) < 0.5 and hit.y > -4.0:
        return ABYSS
    if abs(th) < 56 and abs(y - 0.9) < 0.5:
        c = step_ramp(STEEL, c, -2)
    # The ridge down the snout.
    if -1.5 > y > -4.6 and -4 <= th < 4:
        c = step_ramp(STEEL, c, -2)
    if y < -4.1:
        c = step_ramp(STEEL, c, 1)
    if hit.spec > 0.5:
        return STEEL_SPEC
    return c


def _hound(yaw, w, cx):
    pic, hits = render(hound_f, w, 19, cx, 10.0, yaw, hound_paint)
    pic = outline(pic, hits, STEEL_OUT, STEEL_SEL, STEEL_RIM, STEEL[3:], keep=(ABYSS,))
    return pic, hits


# Drawn by hand: k outline, o sel-out, W specular, h l m n d D the steel light → deep shade,
# b cold blue reflected light, s the void, e an eye.
STEEL_KEY = {'k': STEEL_OUT, 'o': STEEL_SEL, 'W': STEEL_SPEC, 'h': STEEL[1], 'l': STEEL[2], 'm': STEEL[3],
             'n': STEEL[4], 'd': STEEL[5], 'D': STEEL[6], 'b': STEEL_RIM, 's': ABYSS, 'e': EYE}

HOUND = [
    '......k..........',
    '......kok........',
    '.....kdlo........',
    '.....kdlho.......',
    '....kdnmlho......',
    '....kdnmlhWo.....',
    '...kbdnmmlhWo....',
    '...kbdnmmllhho...',
    '...kbdnmmlhhhlo..',
    '...kbdnmsssssesk.',
    '...kbdnmmlhhWhhlo',
    '...kbDdnmmlhhWhlo',
    '...kbDdnmmllhhlo.',
    '....kDdnnmmllmk..',
    '.....kDdnnmmk....',
    '.....kDdnmlk.....',
    '....kDdnmmlmk....',
    '....kDdnmmllmo...',
    '....kkkkkkkkkk...',
]

HOUND_FRONT = [
    '.......k.......',
    '......kok......',
    '.....kdlho.....',
    '.....kdlhho....',
    '....kdnmlhWo...',
    '...kbdnmlhWho..',
    '...kbdnmmlhWo..',
    '..kbdnmmlhhWho.',
    '..kbdnmmlhhWhlo',
    '..kbsessssssesk',
    '..kbdnmmlnWhhlo',
    '..kbDdnmlnWhlmo',
    '...kDdnmlnWlmk.',
    '...kDdnnmnhlk..',
    '....kDdnmlmk...',
    '....kDdnmlk....',
    '...kDdnmmlmk...',
    '...kDdnmmllmo..',
    '...kkkkkkkkkk..',
]


def hounskull():
    return Pic.text(HOUND, STEEL_KEY)


def hounskull_front():
    return Pic.text(HOUND_FRONT, STEEL_KEY)


PREVIEW = [bucket, bucket_front, onion, onion_front, hounskull, hounskull_front]
