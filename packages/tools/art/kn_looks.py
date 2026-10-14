"""Sir Nobody's looks: the knight who never takes his helm off (kn_helms.py), every part repainted
in its materials (kn_parts.py). Three knights of Dark Souls, three silhouettes:

* sunlight — Solaire of Astora: the tall bucket helm with a thin red plume, a cream tabard with a
  hand-painted sun, green fur over the shoulders, dark chainmail arms and thighs against light
  iron bracers and tall greaves, a ragged leather skirt, chainmail sabatons with iron toecaps.
  Upright and square: the tabard-and-plate knight.
* onion — Siegmeyer / Siegward of Catarina: the fluted onion helm with its spike on a round body
  of rolled plates, big round pauldrons, thick fluted limbs, a jagged mail skirt, wide duck-toed
  sabatons. Brass-tin, stout.
* hollow — Artorias of the Abyss and the Hollow Knight: a narrow pointed hounskull whose slit is a
  void with white eyes, a long black tassel, a ragged dark-blue scarf and skirt, slim dark steel
  over bluish mail, long pointed sabatons. Tall and lean, the tatters moving."""
import math

from lookgen import write_look, rotate, preview
from heads import Palette, Pic, shaded
from kn_parts import Frame, repaint, plate, mail, cloth, tone, shift, outfit, far, dome, family, L3
import kn_helms

OUT = '#1c1a1c'


def at(f, s, t):
    """The pixel at `s` along a part and `t` across it."""
    sr = f.s0 + s * (f.s1 - f.s0)
    lo, hi = f.spans.get(round(sr), (-1, 1))
    tr = (lo + hi) / 2 + t * (hi - lo) / 2
    x = f.cx + sr * f.u[0] + tr * f.v[0]
    y = f.cy + sr * f.u[1] + tr * f.v[1]
    return int(math.floor(x)), int(math.floor(y))


def paste(pic, rows, legend, x0, y0, only_on=True):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + i, y0 + j
            if only_on and (pic.get(x, y) is None or pic.get(x, y) == OUT):
                continue
            pic.set(x, y, legend[ch])
    return pic


def build(parts, shader_of, outline=OUT, lit=None, far_ramps=None):
    """Every part repainted; far limbs (forearm, knee, shin) also get a darker `:far` picture."""
    out = {}
    for k, p in parts.items():
        sid = int(k)
        sh = shader_of(sid)
        if sh is None:
            continue
        pic = repaint(p, sid, sh, outline, lit)
        out[k] = pic
        if far_ramps and family(sid) in ('forearm', 'knee', 'shin'):
            out[f'{k}:far'] = far(pic, far_ramps)
    return out


def lit_of(*ramps):
    """The outline where the light hits: the material's own darkest tone (sel-out)."""
    def lit(c):
        for r in ramps:
            if c in r:
                return r[-1]
        return OUT
    return lit


def drape(sil, sid, inside, colour, pad, outline=OUT, lit=None):
    """Cloth, fur or plates hung on a part, past its edges: a picture padded by `pad` round the
    part's (so it is centred on the same point); `inside(s, t, w)` says if a pixel is in it (`s`
    pixels along the part from its joint, `t` pixels across from its middle, `w` the part's half
    width there), `colour(s, t, w, b, x, y)` paints it (`b` the light on a cylinder across)."""
    f = Frame(sil, sid)
    W, H = sil.w + 2 * pad, sil.h + 2 * pad
    keys = sorted(f.spans)
    cells = {}
    for Y in range(H):
        for X in range(W):
            x, y = X - pad, Y - pad
            sr = f._s(x, y)
            key = min(keys, key=lambda k: abs(k - sr))
            lo, hi = f.spans[key]
            mid, w = (lo + hi) / 2, max(0.5, (hi - lo) / 2)
            t = f._t(x, y) - mid
            s = sr - f.s0
            if inside(s, t, w):
                tn = max(-1.0, min(1.0, t / (w + 1.5)))
                b = tn * f.vl + math.sqrt(max(0.0, 1 - tn * tn)) * L3[2]
                cells[(X, Y)] = colour(s, t, w, b, X, Y)
    p = Pic([[None] * W for _ in range(H)])
    for (X, Y), c in cells.items():
        if c is None:
            continue
        edge = any(cells.get((X + dx, Y + dy)) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            ex = sum(dx for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if cells.get((X + dx, Y + dy)) is None)
            ey = sum(dy for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if cells.get((X + dx, Y + dy)) is None)
            p.set(X, Y, (lit(c) if lit else c) if ex * L3[0] + ey * L3[1] > 0.1 else outline)
        else:
            p.set(X, Y, c)
    return p


def strand(t, seed=0):
    """A pseudo-random length (0..1) for the strand at `t` pixels across (same on every turn)."""
    i = int(math.floor(t + 100))
    return ((i * 37 + seed * 11) % 7) / 6


def look(id_, parts, helm, helm_front, extra=None, accent='#e8b84a', rot=()):
    pal = Palette({'k': OUT})
    lk = {'id': id_, 'base': 1, 'accent': accent, '_raw_heads': True, 'parts': {}}
    for k, p in parts.items():
        lk['parts'][k] = pal.rows(p)
    lk['parts']['25'] = pal.rows(helm)
    lk['parts']['29'] = pal.rows(helm_front)
    for key, val in (extra or {}).items():
        if key == 'attachments':
            lk['attachments'] = {n: {'layer': a['layer'], 'sprites': {k: pal.rows(v) for k, v in a['sprites'].items()}}
                                 for n, a in val.items()}
        elif key == 'ribbons':
            rib = {}
            for n, r in val.items():
                r = dict(r)
                if 'texture' in r:
                    tex, legend = r.pop('texture')
                    r['texture'] = [''.join('+' if ch == '+' else ('.' if ch == '.' else pal.char(legend[ch]))
                                            for ch in row) for row in tex]
                rib[n] = r
            lk['ribbons'] = rib
        else:
            lk[key] = val
    lk['palette'] = pal.pal
    path = write_look('sir-nobody', lk)
    rotate(path, [25, *rot])
    preview(id_)
    return path


def shoes(drawn, legend, ramps):
    """The drawn shoes (39 near, 47 turned a little, 48 to us) and the far foot's (43) a shade
    darker; the look tool turns 39 and 43 into 40-42 and 44-46."""
    out = {k: Pic.text(rows, legend) for k, rows in drawn.items()}
    out['43'] = far(out['39'], ramps)
    out['47:far'] = far(out['47'], ramps)
    return out


# ======================================================================================= sunlight
IRON = ['#fffaf0', '#ece4cc', '#c8bfa8', '#9a9384', '#76737a', '#55535f', '#38363f']
MAIL = ['#aaa69c', '#86827a', '#64615c', '#46444a', '#2e2d33']
TABARD = ['#fdf6e2', '#f1e6c6', '#d9c8a0', '#b19a74', '#7e6850']
SCARF = ['#c4c0a2', '#a29e82', '#7e7a62', '#5a5744', '#3c3a2c']
FUR = ['#e2ecb4', '#c2d28e', '#9aa868', '#6c784c', '#465032']
SKIRT = ['#cdb08a', '#ae9068', '#8a6e4e', '#644c34', '#3e2e1e']
BELT = ['#6e5236', '#4a3422', '#2c1e12']
GLOVE = ['#8a6844', '#6a4c30', '#4c341f', '#30200f']
SUN = {'r': '#e8473a', 'R': '#a8302a', 'y': '#ffd83a', 'Y': '#fff4a0', 'o': '#d89a28'}

# Solaire's sun, painted by his own hand: a yellow face in a ring of red rays.
SUN_SIDE = [
    '.r.r.',
    'r.y.r',
    '.yYy.',
    'ryYyr',
    '.yoy.',
    'r.y.r',
    '.r.r.',
]
SUN_FRONT = [
    '.r.r.r.',
    'r.yyy.r',
    '.yyYyy.',
    'ryYYyyr',
    '.yyyoy.',
    'r.yoy.r',
    '.r.r.r.',
]

# Chainmail sabatons with an iron instep plate and toecap, flat soles (39 near, 47 turned a little,
# 48 to us). M m: mail; W h l n: iron; k: outline; s: the sole.
SABATON = {
    '39': ['.kMmMmMk.....',
           '.MmMmMmkhhok.',
           'kmMmMmkhllhWk',
           'kMmMmMkmllhhk',
           'ksssssssssss.'],
    '47': ['.kMmMmk....',
           'kMmMmMkhok.',
           'kmMmMkhllWk',
           'kMmMmkmlhhk',
           'ksssssssssk'],
    '48': ['.kMmMk.',
           'kMmMmMk',
           'khlhWhk',
           'kmllhmk',
           'ksssssk'],
}
SAB_LEG = {'k': OUT, 'M': MAIL[1], 'm': MAIL[3], 'W': IRON[0], 'h': IRON[1], 'l': IRON[2], 'n': IRON[4],
           'd': IRON[5], 's': '#3a2a1c'}


def sunlight_shader(sid):
    fam = family(sid)
    if fam == 'chest':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.24:
                return cloth(SCARF)(f, x, y)
            ragged = 0.32 + 0.05 * ((x * 5 + y * 3) % 3)
            if s < ragged:
                return tone(FUR, f.b(x, y) + (0.2 if (x + 2 * y) % 3 == 0 else 0), -0.35, 1.0)
            return cloth(TABARD)(f, x, y)
        return sh
    if fam == 'torso':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.5:
                return cloth(TABARD)(f, x, y)
            if s < 0.6:
                return tone(BELT, f.b(x, y), -0.3, 1.0)
            return tone(SKIRT, f.b(x, y) - (0.18 if (x * 3 + y) % 4 == 0 else 0), -0.4, 1.0)
        return sh
    if fam in ('upper-arm', 'thigh', 'knee'):
        return mail(MAIL)
    if fam == 'forearm':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.34:
                return mail(MAIL)(f, x, y)
            if s < 0.44:
                return tone(IRON, f.b(x, y) + 0.25, -0.3, 0.95)
            return plate(IRON)(f, x, y)
        return sh
    if fam == 'shin':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.14:
                return tone(IRON, f.b(x, y) + 0.3, -0.3, 0.95)
            if s < 0.22:
                return tone(IRON, f.b(x, y) - 0.45, -0.3, 0.95)
            return plate(IRON)(f, x, y)
        return sh
    return None


SUN_LIT = lit_of(IRON, MAIL, TABARD, FUR, SKIRT, BELT, GLOVE, SCARF)


def sunlight_parts():
    plan = {'chest': 1, 'torso': 1, 'upper-arm': 1, 'forearm': 2, 'hand': 0, 'thigh': 1, 'knee': 1, 'shin': 2}
    sil = outfit(plan)
    parts = build(sil, sunlight_shader, OUT, SUN_LIT, far_ramps=[IRON, MAIL])
    # The sun on the tabard's front.
    for k in ('57', '58', '59', '60'):
        f = Frame(sil[k], int(k))
        x, y = at(f, 0.6, -0.38)
        paste(parts[k], SUN_SIDE, SUN, x - 2, y - 3)
    f = Frame(sil['61'], 61)
    x, y = at(f, 0.58, 0.0)
    paste(parts['61'], SUN_FRONT, SUN, x - 3, y - 3)
    # Leather gloves.
    for k, p in sil.items():
        if family(int(k)) == 'hand':
            parts[k] = dome(p, GLOVE[:3] if int(k) < 21 else GLOVE[1:], OUT)
    parts.update(shoes(SABATON, SAB_LEG, [IRON, MAIL]))
    return parts


def pelerine(sil, sid):
    """Green fur over the shoulders: a shaggy collar round the top of the chest, past its back and
    front, tufts hanging down."""
    length = Frame(sil, sid).length()

    def inside(s, t, w):
        top = 0.16 * length
        bottom = 0.35 * length + 1.4 * strand(t, 1)
        return top <= s <= bottom and abs(t) <= w + (1.6 if s > top + 1.5 else 0.6)

    def colour(s, t, w, b, x, y):
        clump = 0.25 if (x + 2 * y) % 3 == 0 else (-0.12 if (2 * x + y) % 5 == 0 else 0)
        return tone(FUR, b + clump - 0.06 * (s - 0.16 * length), -0.4, 1.0)
    return drape(sil, sid, inside, colour, 3, OUT, lambda c: FUR[-1])


def leather_skirt(sil, sid):
    """Below the belt, the ragged leather skirt to mid-thigh, in strips, flaring a little."""
    length = Frame(sil, sid).length()
    top = 0.6 * length

    def inside(s, t, w):
        bottom = length + 2.0 + 2.0 * strand(t, 3)
        return top <= s <= bottom and abs(t) <= w + 0.5 + 0.2 * (s - top)

    def colour(s, t, w, b, x, y):
        fold = 0.2 if int(math.floor(t + 100)) % 3 == 0 else 0
        return tone(SKIRT, b - fold - 0.03 * (s - top), -0.45, 1.0)
    return drape(sil, sid, inside, colour, 6, OUT, SUN_LIT)


def make_sunlight():
    sil = outfit({'chest': 1, 'torso': 1})
    fur = {'57': pelerine(sil['57'], 57), '61': pelerine(sil['61'], 61)}
    hem = {'34': leather_skirt(sil['34'], 34), '38': leather_skirt(sil['38'], 38)}
    look('sunlight', sunlight_parts(), kn_helms.bucket(), kn_helms.bucket_front(), {
        'attachments': {'fur': {'layer': 'front', 'sprites': fur}, 'skirt': {'layer': 'hips', 'sprites': hem}},
        'ribbons': {'plume': {'anchor': 'head', 'offset': [4, -8], 'segments': 5, 'length': 2.6, 'width': [2, 1],
                              'colors': ['#d8503a', '#a33a2c', '#6e2620'], 'gravity': 60, 'drag': 3}},
    }, accent='#e8b84a', rot=['fur@57', 'skirt@34', 39, 43])
    return 'sunlight'


# ========================================================================================== onion
TIN = kn_helms.TIN[1:]  # highlight → deep shade
TIN_SPEC = kn_helms.TIN_SPEC
TIN_MAIL = ['#8a8270', '#686050', '#4a4438', '#302c24']
TIN_BELT = ['#7a5838', '#56402a', '#36281a']


def rolls(n, top=0.0, bottom=1.0):
    """Plates rolled round the body: `n` bands across the part between `top` and `bottom` (of its
    length), each a little cylinder of its own: its upper edge catching the light, its lower one
    in shade over the next."""
    def m(f, x, y):
        s = f.s(x, y)
        u = (s - top) / (bottom - top) * n
        frac = u - math.floor(u)
        b = f.b(x, y)
        if frac < 0.3:
            b += 0.35
        elif frac > 0.82:
            return TIN[-1] if f.b(x, y) < 0.6 else TIN[-2]
        elif frac > 0.62:
            b -= 0.4
        c = tone(TIN, b, -0.35, 0.95)
        if b > 1.05 and frac < 0.28:
            c = TIN_SPEC
        return c
    return m


def flutes(ramp, every=2.2):
    """Plate fluted along the part: ridges every `every` pixels across, lit on their side toward
    the light."""
    def m(f, x, y):
        b = f.b(x, y)
        t = f.t(x, y)
        w = max(1.0, (f.spans.get(round(f._s(x, y)), (-1, 1))[1] - f.spans.get(round(f._s(x, y)), (-1, 1))[0]) / 2)
        k = (t * w / every) % 1
        if k < 0.3:
            b -= 0.35
        elif k > 0.75:
            b += 0.2
        c = tone(ramp, b, -0.35, 0.95)
        if f.b(x, y) > 0.93:
            c = TIN_SPEC
        return c
    return m


def onion_shader(sid):
    fam = family(sid)
    if fam == 'chest':
        r = rolls(3, 0.22, 1.0)

        def sh(f, x, y):
            if f.s(x, y) < 0.22:
                return mail(TIN_MAIL)(f, x, y)
            return r(f, x, y)
        return sh
    if fam == 'torso':
        r = rolls(2, 0.0, 0.44)

        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.44:
                return r(f, x, y)
            if s < 0.57:
                return tone(TIN_BELT, f.b(x, y), -0.3, 1.0)
            return mail(TIN_MAIL)(f, x, y)
        return sh
    if fam == 'upper-arm':
        return mail(TIN_MAIL)
    if fam == 'thigh':
        return flutes(TIN)
    if fam == 'forearm':
        fl = flutes(TIN)

        def sh(f, x, y):
            s = f.s(x, y)
            if 0.0 < s < 0.16:
                return tone(TIN, f.b(x, y) - 0.4, -0.35, 0.95)
            return fl(f, x, y)
        return sh
    if fam == 'shin':
        fl = flutes(TIN)

        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.12:
                return tone(TIN, f.b(x, y) + 0.3, -0.35, 0.95)
            if s < 0.2:
                return tone(TIN, f.b(x, y) - 0.5, -0.35, 0.95)
            return fl(f, x, y)
        return sh
    if fam == 'knee':
        return plate(TIN)
    return None


ONION_LIT = lit_of(TIN, TIN_MAIL, TIN_BELT)


def pauldron(ramp, outline, w=12, h=11, pad=7):
    """A big round pauldron of three lames over the shoulder end of an upright arm (shoulder on
    the left): a lit dome, the lames' edges as arcs."""
    cx, cy = (w - 1) / 2, (h - 1) / 2
    mask = []
    for y in range(h):
        row = ''
        for x in range(w):
            dx, dy = (x - cx) / (w / 2), (y - cy) / (h / 2)
            row += '#' if dx * dx + dy * dy <= 1.02 else '.'
        mask.append(row)
    p = shaded(mask, ramp, outline, light=(0.45, -0.6, 0.65))
    # Lames: arcs round the shoulder (centred at the dome's left end), each edge a dark line with
    # the next lame's lit rim under it.
    for y in range(h):
        for x in range(w):
            c = p.get(x, y)
            if c is None or c == outline:
                continue
            d = math.hypot((x - 0.5) * 1.0, (y - cy) * 1.15)
            for edge in (5.2, 8.4):
                if abs(d - edge) < 0.5:
                    p.set(x, y, ramp[-1])
                elif 0.5 <= d - edge < 1.4 and ramp.index(c) > 0:
                    p.set(x, y, ramp[max(0, ramp.index(c) - 2)])
    return Pic([r[:] + [None] * pad for r in p.g])


def mail_skirt(sil, sid):
    """A short mail skirt under the belt with a jagged hem: dark points between the thighs."""
    length = Frame(sil, sid).length()
    top = 0.55 * length

    def inside(s, t, w):
        tooth = abs(((t + 100) % 3) - 1.5) / 1.5  # 0..1 across each tooth
        bottom = length + 1.0 + 2.5 * (1 - tooth)
        return top <= s <= bottom and abs(t) <= w + 0.6 + 0.15 * (s - top)

    def colour(s, t, w, b, x, y):
        c = tone(TIN_MAIL, b - 0.1, -0.5, 1.0)
        if (x + y) % 2 == 0:
            c = shift(TIN_MAIL, c, 1)
        return c
    return drape(sil, sid, inside, colour, 6, OUT, lambda c: TIN_MAIL[-1])


# Wide duck-toed sabatons of fluted lames (39 near, 47 turned a little, 48 to us).
DUCK = {
    '39': ['.kdnmlk......',
           'kdnmlhlkkok..',
           'kdnmklhlhlhok',
           'kdnkmlhlhWhlk',
           'kkkkkkkkkkkkk'],
    '47': ['.kdnmk.....',
           'kdnmlhkkok.',
           'kdnklhlhWok',
           'kdkmlhlhWhk',
           'kkkkkkkkkkk'],
    '48': ['.kdnmk.',
           'kdlhWlk',
           'kdlhWlk',
           'kdmlhmk',
           'kkkkkkk'],
}
DUCK_LEG = {'k': OUT, 'W': TIN_SPEC, 'h': TIN[0], 'l': TIN[1], 'm': TIN[2], 'n': TIN[3], 'd': TIN[4],
            'o': kn_helms.TIN_SEL}


def onion_parts():
    plan = {'chest': 2, 'torso': 3, 'upper-arm': 2, 'forearm': 2, 'hand': 1, 'thigh': 2, 'knee': 2, 'shin': 2}
    sil = outfit(plan)
    parts = build(sil, onion_shader, OUT, ONION_LIT, far_ramps=[TIN, TIN_MAIL])
    for k, p in sil.items():
        if family(int(k)) == 'hand':
            parts[k] = dome(p, TIN[1:5] if int(k) < 21 else TIN[2:6], OUT)
    parts.update(shoes(DUCK, DUCK_LEG, [TIN]))
    return parts


def make_onion():
    sil = outfit({'torso': 3})
    skirt = {'34': mail_skirt(sil['34'], 34), '38': mail_skirt(sil['38'], 38)}
    pd = {'5': pauldron(TIN, OUT), '9': pauldron(TIN[1:] + [TIN[-1]], OUT)}
    look('onion', onion_parts(), kn_helms.onion(), kn_helms.onion_front(), {
        'attachments': {'pauldron': {'layer': 'over', 'sprites': pd}, 'skirt': {'layer': 'hips', 'sprites': skirt}},
    }, accent='#e0c878', rot=['pauldron@5', 'pauldron@9', 'skirt@34', 39, 43])
    return 'onion'


# ========================================================================================= hollow
STEEL = kn_helms.STEEL[1:]  # highlight → deep shade
STEEL_SPEC = kn_helms.STEEL_SPEC
BMAIL = ['#8e98a8', '#6a7486', '#4c5466', '#343a4a', '#22262f']
ABYSS_BLUE = ['#5a7aa6', '#3a5a80', '#26405e', '#182a42', '#0e1828']
HBELT = ['#4a3c34', '#30261f', '#1c1612']


def steel(spec=0.93):
    """Dark steel as a cylinder across the part, a cold sheen on its shadow edge."""
    def m(f, x, y):
        b = f.b(x, y)
        if b > spec:
            return STEEL_SPEC
        return tone(STEEL, b, -0.3, spec)
    return m


def hollow_shader(sid):
    fam = family(sid)
    if fam == 'chest':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.34 + 0.05 * ((x * 3 + y) % 3):
                return tone(ABYSS_BLUE, f.b(x, y) - (0.2 if (x + y) % 3 == 0 else 0), -0.4, 1.0)
            if sid == 61:
                t = f.t(x, y)
                if -0.12 < t < 0.08:
                    return tone(STEEL, f.b(x, y) + 0.35, -0.3, 0.93)
                if 0.08 <= t < 0.28:
                    return tone(STEEL, f.b(x, y) - 0.3, -0.3, 0.93)
            return steel()(f, x, y)
        return sh
    if fam == 'torso':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.42:
                b = f.b(x, y) - (0.45 if int(s * 12) % 3 == 2 else 0)
                return tone(STEEL, b, -0.3, 0.93)
            if s < 0.52:
                return tone(HBELT, f.b(x, y), -0.3, 1.0)
            return mail(BMAIL)(f, x, y)
        return sh
    if fam in ('upper-arm', 'thigh'):
        return mail(BMAIL)
    if fam == 'forearm':
        def sh(f, x, y):
            s = f.s(x, y)
            if s < 0.3:
                return mail(BMAIL)(f, x, y)
            return steel()(f, x, y)
        return sh
    if fam == 'knee':
        return steel(0.9)
    if fam == 'shin':
        def sh(f, x, y):
            s = f.s(x, y)
            # Blue rags wound round the greave's top.
            if 0.1 < s < 0.42 and (int(s * 14) % 3 != 2):
                return tone(ABYSS_BLUE, f.b(x, y) - (0.25 if (x + 2 * y) % 4 == 0 else 0), -0.4, 1.0)
            return steel()(f, x, y)
        return sh
    return None


HOLLOW_LIT = lit_of(STEEL, BMAIL, ABYSS_BLUE, HBELT)


def tatters(sil, sid):
    """The ragged blue skirt under the belt, in strips of different lengths down to the shins."""
    length = Frame(sil, sid).length()
    top = 0.5 * length

    def inside(s, t, w):
        bottom = length + 5 + 7 * strand(t, 5)
        return top <= s <= bottom and abs(t) <= w + 0.5 + 0.25 * (s - top)

    def colour(s, t, w, b, x, y):
        fold = 0.25 if int(math.floor(t + 100)) % 2 == 0 else 0
        c = tone(ABYSS_BLUE, b - fold - 0.03 * (s - top), -0.5, 1.0)
        if s > length + 4 and (x + y) % 3 == 0:
            c = shift(ABYSS_BLUE, c, 1)
        return c
    return drape(sil, sid, inside, colour, 10, OUT, HOLLOW_LIT)


# Long pointed sabatons, the gothic toe running out ahead (39 near, 47 turned a little, 48 to us).
POINTED = {
    '39': ['.kdnmk.......',
           'kdnmlhkk.....',
           'kdnmlhWhkko..',
           'kdnmmlhhhWhko',
           '.kkkkkkkkkkk.'],
    '47': ['.kdnmk.....',
           'kdnmlhkko..',
           'kdnmlhWhhko',
           'kdnmlhhWhhk',
           '.kkkkkkkkk.'],
    '48': ['.kdnk..',
           'kdnmlk.',
           'kdnlhWk',
           'kdmlhlk',
           '.kkkkk.'],
}
POINT_LEG = {'k': OUT, 'W': STEEL_SPEC, 'h': STEEL[0], 'l': STEEL[1], 'm': STEEL[2], 'n': STEEL[3], 'd': STEEL[4],
             'o': kn_helms.STEEL_SEL}

# The tassel from the crest of the helm and the scarf from the nape, as cloth pictures along the
# chain (rows from the root): K black hair, b its cold sheen; B the blue cloth, its lit edge L.
TASSEL = ['.+.', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', 'bKk', '.Kk',
          '.Kk', '.Kk', '.K.', '.K.', '.k.', '.k.']
TASSEL_KEY = {'K': '#2a2a2e', 'k': '#141418', 'b': '#3a5a80'}
SCARF_TEX = ['.+..', 'LBBd', 'LBBd', 'LBdd', 'LBBd', 'LBBd', 'LBdd', 'LBBd', 'LBBd', 'LBdd', 'LBBd', 'LB.d',
             'L.Bd', '.B.d', '.B..', '..B.']
SCARF_KEY = {'L': ABYSS_BLUE[0], 'B': ABYSS_BLUE[1], 'd': ABYSS_BLUE[3]}


def hollow_parts():
    plan = {'chest': 1, 'torso': 1, 'upper-arm': 0, 'forearm': 1, 'hand': 0, 'thigh': 0, 'knee': 0, 'shin': 1}
    sil = outfit(plan)
    parts = build(sil, hollow_shader, OUT, HOLLOW_LIT, far_ramps=[STEEL, BMAIL, ABYSS_BLUE])
    # A silver buckle on the belt.
    buckle = {'W': STEEL_SPEC, 'h': STEEL[0], 'd': STEEL[4]}
    for k in ('34', '35', '36', '37', '38'):
        f = Frame(sil[k], int(k))
        x, y = at(f, 0.47, 0.0 if k == '38' else -0.7)
        paste(parts[k], ['Wh', 'hd'], buckle, x - (0 if k == '38' else 1), y - 1)
    for k, p in sil.items():
        if family(int(k)) == 'hand':
            parts[k] = dome(p, STEEL[1:5] if int(k) < 21 else STEEL[2:6], OUT)
    parts.update(shoes(POINTED, POINT_LEG, [STEEL]))
    return parts


def make_hollow():
    sil = outfit({'torso': 1})
    skirt = {'34': tatters(sil['34'], 34), '38': tatters(sil['38'], 38)}
    look('hollow', hollow_parts(), kn_helms.hounskull(), kn_helms.hounskull_front(), {
        'attachments': {'tatters': {'layer': 'hips', 'sprites': skirt}},
        'ribbons': {
            'tassel': {'anchor': 'head', 'offset': [2, -9], 'segments': 6, 'gravity': 170, 'drag': 2.6,
                       'texture': (TASSEL, TASSEL_KEY)},
            'scarf': {'anchor': 'neck', 'offset': [2, 1], 'segments': 5, 'gravity': 160, 'drag': 2.8,
                      'texture': (SCARF_TEX, SCARF_KEY)},
        },
    }, accent='#9cc0f0', rot=['tatters@34', 39, 43])
    return 'hollow'


def make_all():
    """Every look written; their ids, the main one first."""
    return [make_sunlight(), make_onion(), make_hollow()]


if __name__ == '__main__':
    make_all()
