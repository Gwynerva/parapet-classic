"""Azure, the last boss: a young-looking scholar of an old blue people. The calm girl's face (3)
gone blue, freckled, a crest of ridged scalp sweeping back instead of hair; four looks (the
scholar in white and blue, the broker in dark blue with silver, an open black leather jacket, a
dark scaled suit with gold); biotics: blue-white glow round her body and hands, rings on her
tricks, violet afterimages when she charges; her world: a city of white spires under two moons."""
import json
from lookgen import *
from tricks import tricks
from heads import Pic, Palette, skin_tones, by_light, neat_mouth, rim, shaded
from body import outfit_parts, write_parts, apply_rules
from gridpng import sheet

BLUE_SKIN = ['#c6dcff', '#a8c6ff', '#8aaef4', '#6e94e2', '#5a7cca', '#4664aa', '#344c88']
DUSK_SKIN = ['#c0c4f0', '#a2a8e4', '#868ed4', '#6c74c0', '#5a60a8', '#464a8a', '#34366c']
KEEP = ['#dee3e7', '#fff7de', '#ad4d21', '#000400', '#7b1008', '#a50800']
HAIR = ['#000000', '#182421', '#422c29']
OUT = '#141a3a'


def fins(w, h, specs, ox, oy):
    """Curved crest fins: each a quadratic curve (base, bend, tip) swept as discs from its base
    radius to its tip's. Returns the covered pixels (shifted by ox, oy)."""
    pts = set()
    for (bx, by), (cx, cy), (tx, ty), r0, r1 in specs:
        for i in range(41):
            t = i / 40
            x = (1 - t) ** 2 * bx + 2 * (1 - t) * t * cx + t * t * tx
            y = (1 - t) ** 2 * by + 2 * (1 - t) * t * cy + t * t * ty
            r = r0 + (r1 - r0) * t
            for yy in range(int(y - r - 1), int(y + r + 2)):
                for xx in range(int(x - r - 1), int(x + r + 2)):
                    if (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r:
                        pts.add((xx + ox, yy + oy))
    return {(x, y) for x, y in pts if 0 <= x < w and 0 <= y < h}


# The crest of the profile (facing right): fins from the temple and the back of the head sweeping
# up and back past the skull; seen from the front, fanning up and out on both sides.
FINS_K0 = [((10, 2), (4, -2), (-1, 1), 2.8, 1.3), ((7, 5), (1, 2), (-3, 5), 2.6, 1.2),
           ((5, 9), (0, 8), (-3, 10), 2.3, 1.1)]
FINS_FRONT = [((5, 4), (1, 0), (-1, 4), 2.6, 1.2), ((12, 4), (16, 0), (18, 4), 2.6, 1.2),
              ((8.5, 3), (8.5, 1.5), (8.5, 1), 2.2, 1.6)]


def asari(tones=BLUE_SKIN, front=False, gold=False):
    p = Pic.orig(3, front)
    hair = set(p.where(HAIR))
    skin_tones(p, tones, keep=KEEP)
    p.recolor({'#ad4d21': '#3a6ad8', '#7b1008': '#5a3a8a', '#a50800': '#7a5aaa'})
    neat_mouth(p, front, '#4a3a8a', '#7a6ac0', tones[2])
    # No hair: the skull, smooth and close (hair beyond it goes).
    cx, cy = 8.5, 7.5
    for x, y in list(hair):
        if ((x + 0.5 - cx) / 8.0) ** 2 + ((y + 0.5 - cy) / 7.8) ** 2 > 1:
            p.set(x, y, None)
            hair.discard((x, y))
    ox, oy = (4, 4) if not front else (2, 4)
    p.pad(left=ox, top=oy, right=0 if not front else 2)
    scalp = {(x + ox, y + oy) for x, y in hair}
    crest = fins(p.w, p.h, FINS_FRONT if front else FINS_K0, ox, oy)
    area = scalp | crest
    mask = [''.join('#' if (x, y) in area and (p.get(x, y) is None or (x, y) in scalp) else '.'
                    for x in range(p.w)) for y in range(p.h)]
    lit = shaded(mask, tones[0:6], tones[6], light=(0.4, -0.7, 0.6), centre=(cx + ox, cy + oy - 2),
                 radii=(10, 10))
    for y in range(p.h):
        for x in range(p.w):
            c = lit.get(x, y)
            if c:
                p.set(x, y, c)
    # Grooves along the fins: each fin's underside a darker line from its base up to its tip.
    for (bx, by), (bcx, bcy), (tx, ty), r0, r1 in (FINS_FRONT if front else FINS_K0):
        for i in range(4, 36):
            t = i / 40
            x = (1 - t) ** 2 * bx + 2 * (1 - t) * t * bcx + t * t * tx
            y = (1 - t) ** 2 * by + 2 * (1 - t) * t * bcy + t * t * ty + (r0 + (r1 - r0) * t) * 0.6
            xi, yi = int(x) + ox, int(y) + oy
            if p.get(xi, yi) and p.get(xi, yi) != tones[6]:
                p.set(xi, yi, tones[5])
    freckles = [(12, 10), (14, 10), (13, 11)] if not front else [(5, 11), (12, 11), (6, 12), (11, 12)]
    for x, y in freckles:
        if p.get(x + ox, y + oy):
            p.set(x + ox, y + oy, tones[4])
    if gold:
        for x, y in ([(10, 5), (11, 5), (12, 5), (12, 6)] if not front else [(5, 5), (6, 4), (7, 5), (10, 5), (11, 4), (12, 5)]):
            if p.get(x + ox, y + oy):
                p.set(x + ox, y + oy, '#e8b84a')
    return p


WHITE = ['#ffffff', '#eef2f8', '#d6dde8', '#b4bed0', '#8e98b0']
NAVY = ['#4a5a8a', '#36446e', '#283456', '#1c2440', '#121828']
LEATHER = ['#6a6a78', '#44444e', '#2e2e36', '#1e1e24', '#121216']
VIOLET = ['#7a6a9a', '#5e5080', '#463c66', '#322a4c', '#201a34']
SILVER = ['#f4f6fa', '#d0d6e0', '#a8b0be', '#808a9a', '#5a6474']
SKIN_FAMILIES = {'hand': list(range(17, 25))}


def five_tones(tones):
    """The five skin tones the body's recolour maps to (light → dark)."""
    return [tones[0], tones[2], tones[3], tones[4], tones[6]]


def skin_rules(tones):
    return skin(five_tones(tones), ARMS + HAND + CHEST + TORSO, with_shins=False)


def chest_shape(p):
    """Her figure in profile: the chest a pixel fuller at the front."""
    p.pad(1, 0, 1, 0)
    for x, y in ((10, 6), (11, 7), (11, 8), (10, 9)):
        if p.get(x - 1, y):
            p.set(x, y, p.get(x - 1, y))
    return p


def outfit(tones, top, legs, stripes_top=(), stripes_legs=(), gloss=0.0, collar=True, neckline=False,
           belt=None, shins=None, gloves=None):
    """Every body part as a fitted suit: a smooth fabric over her slim shape, clean bands along
    the limbs, the neck covered by a high collar or bare above a neckline."""
    from body import FAMILIES, part, suit, dome, shrink
    s5 = five_tones(tones)
    rules = skin_rules(tones)
    out = {}
    for fam, ids in FAMILIES.items():
        if fam == 'shoe':
            continue
        for id_ in ids:
            src = apply_rules(part(0, id_), id_, rules)
            p = src.copy()
            if id_ == 57:
                p = chest_shape(p)
            if fam == 'knee':
                # Slim legs: the knee no wider than the leg.
                shrink(p, 1)
            if fam == 'hand':
                g = gloves or s5
                out[str(id_)] = dome(p, g, OUT)
                continue
            ramp_ = legs if fam in ('thigh', 'knee', 'shin') else top
            stripes = stripes_legs if fam in ('thigh', 'knee', 'shin') else stripes_top
            if fam == 'shin' and shins:
                ramp_, stripes = shins, ()
            q = suit(p, ramp_, OUT, stripes=stripes, gloss=gloss)
            # The neck: under a high collar, or bare (and a neckline below it).
            if fam == 'chest' and not collar:
                off = 1 if id_ == 57 else 0
                for y in range(0, 3):
                    for x in range(q.w):
                        if q.get(x, y) and q.get(x, y) != OUT:
                            q.set(x, y, s5[1] if x < q.w // 2 + off else s5[2])
                if neckline:
                    v = [(7, 3), (8, 3), (7, 4), (8, 4), (8, 5)] if id_ == 57 else [(4, 3), (5, 3), (6, 3), (5, 4), (6, 4), (5, 5)]
                    for x, y in v:
                        if q.get(x, y) and q.get(x, y) != OUT:
                            q.set(x, y, s5[1] if (x + y) % 2 else s5[2])
            if fam == 'torso' and belt:
                for y in (7, 8):
                    for x in range(q.w):
                        if q.get(x, y) and q.get(x, y) != OUT:
                            q.set(x, y, belt[0] if y == 7 else belt[1])
            out[str(id_)] = q
    return out


def make(look_id, tones, parts, shoe_ramp, accent, gold=False):
    pal = Palette({'k': OUT})
    rules = skin_rules(tones) + [recolor(SHOES, {**ramp(SHOE['main'], shoe_ramp[1:4]), '#d64908': shoe_ramp[2],
                                                 '#fffbe7': shoe_ramp[0], '#d6cbb5': shoe_ramp[3],
                                                 '#8c8273': shoe_ramp[4]})]
    look = {'id': look_id, 'base': 0, 'accent': accent, '_raw_heads': True, 'recolor': rules,
            'parts': dict(no_ponytail())}
    write_parts(look, parts, pal)
    look['parts']['25'] = pal.rows(asari(tones, gold=gold))
    look['parts']['29'] = pal.rows(asari(tones, True, gold=gold))
    look['palette'] = pal.pal
    path = write_look('azure', look)
    rotate(path, [25])
    preview(look_id)
    return pal


BLUE_BAND = (0.15, 0.55, '#5a8aee', '#2e52b0')
make('scholar', BLUE_SKIN, outfit(BLUE_SKIN, WHITE, WHITE, stripes_top=[BLUE_BAND], stripes_legs=[BLUE_BAND],
                                  belt=('#4a6ad8', '#2a3a8a'), gloves=WHITE),
     ['#c4ccd8', '#9aa2b0', '#727a88', '#4e5560', '#2e333a'], '#4a8cff')
make('broker', BLUE_SKIN, outfit(BLUE_SKIN, NAVY, NAVY, stripes_top=[(0.35, 0.95, '#e8ecf4', '#aab2c4')],
                                 stripes_legs=[(0.4, 0.95, '#e8ecf4', '#aab2c4')], belt=('#c8783a', '#7a4418'),
                                 shins=SILVER, gloves=NAVY),
     SILVER, '#7ab0ff')
make('leather', BLUE_SKIN, outfit(BLUE_SKIN, LEATHER, LEATHER, gloss=0.05, collar=False, neckline=True,
                                  belt=('#c8a050', '#2a2a30'), gloves=LEATHER),
     LEATHER, '#5a9aff')
pal = make('twilight', DUSK_SKIN, outfit(DUSK_SKIN, VIOLET, VIOLET, stripes_top=[(0.6, 0.78, '#e8b84a', '#a07a20')],
                                         stripes_legs=[(0.6, 0.78, '#e8b84a', '#a07a20')], collar=False, neckline=True,
                                         belt=('#e8b84a', '#8a6a20'), gloves=VIOLET),
           ['#5a4a7a', '#463c66', '#322a4c', '#201a34', '#100c1e'], '#b080ff', gold=True)
sheet('az-heads.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(3), asari(), asari(front=True),
                                                            asari(DUSK_SKIN, gold=True), asari(DUSK_SKIN, True, gold=True))], scale=9)

# ------------------------------------------------------------------ biotics
fx = {
    'palette': {'w': '#ffffff', 'c': '#bfe0ff', 'b': '#7ab0ff', 'B': '#4a6aff', 'v': '#b080ff', 'V': '#7a4aff',
                'h': '#e4f0ff'},
    'sprites': {
        'wisp1': ['.c.', 'cwc', '.c.'],
        'wisp2': ['..b..', '.bcb.', 'bcwcb', '.bcb.', '..b..'],
        'wisp3': ['.v.', 'vcv', '.v.'],
        'ring1': ['.bbb.', 'b...b', 'b...b', 'b...b', '.bbb.'],
        'ring2': ['..vvv..', '.v...v.', 'v.....v', 'v.....v', 'v.....v', '.v...v.', '..vvv..'],
    },
    'emitters': {
        # The glow round her, blown back as she runs.
        'aura': {
            'while': ['run', 'air', 'wall'], 'every': 5, 'minSpeed': 40, 'anchor': 'body', 'jitter': [3, 6],
            'speed': [10, 30], 'angle': [-40, 40], 'drag': 1.5, 'life': [350, 650], 'fadeOut': 300,
            'flutter': {'amp': 1.5, 'freq': 3}, 'sprite': {'frames': ['wisp1', 'wisp3', 'wisp2'], 'random': True},
            'blend': 'add', 'max': 40, 'reduced': 0.3,
        },
        # Her hands, always alight.
        'hands': {
            'while': ['run', 'air', 'wall', 'idle'], 'perSecond': 14, 'anchor': 'hands', 'jitter': [1, 1],
            'speed': [4, 12], 'angle': [0, 360], 'life': [150, 300], 'fadeOut': 150,
            'rect': {'size': 1, 'colors': ['w', 'c', 'b', 'v']}, 'blend': 'add', 'max': 20,
        },
        # A ring of force on some of her tricks.
        'ring': {
            'enter': ['flip', 'vault', 'land', 'wall'], 'chance': 0.5, 'burst': [14, 20], 'anchor': 'body',
            'speed': [70, 100], 'angle': [0, 360], 'drag': 5, 'life': [300, 450], 'fadeOut': 250,
            'rect': {'size': [1, 2], 'colors': ['c', 'b', 'v', 'w']}, 'blend': 'add',
        },
        'burst': {
            'burst': 30, 'anchor': 'body', 'speed': [20, 90], 'angle': [0, 360], 'drag': 2, 'life': [500, 900],
            'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 3},
            'sprite': {'frames': ['wisp1', 'wisp2', 'wisp3'], 'random': True}, 'blend': 'add',
        },
        'idle': {
            'perSecond': 5, 'anchor': 'body', 'jitter': [6, 10], 'speed': [4, 10], 'angle': [60, 120],
            'life': [600, 1000], 'fadeIn': 150, 'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 2},
            'sprite': {'frames': ['wisp1', 'wisp3'], 'random': True}, 'blend': 'add',
        },
    },
    'variants': {
        'biotics': {
            'emitters': ['aura', 'hands', 'ring'],
            'afterimage': {'steps': [{'back': 5, 'alpha': 0.16}, {'back': 3, 'alpha': 0.26}, {'back': 1, 'alpha': 0.36}],
                           'colors': ['#4a6aff', '#7a5aff', '#a07aff'], 'textured': False, 'while': 'fast'},
        },
    },
    'presence': {'idle': ['idle'], 'vanish': ['burst'], 'appear': ['burst']},
}
write_json(BOSSES + '/azure/fx.json', tricks(fx, 'azure'))
write_json(BOSSES + '/azure/boss.json', {'id': 'azure', 'color': '#4a8cff', 'gender': 'female',
                                         'looks': ['scholar', 'broker', 'leather', 'twilight'], 'effect': ['biotics']})
print('azure written')
