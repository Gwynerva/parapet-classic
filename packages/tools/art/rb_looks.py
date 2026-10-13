"""Rush B's looks: the eight Counter-Strike 1.6 player models, one picked at random every run.
Eight different soldiers on the man's skeleton (base 1), each with his own head (rb_heads.py),
build, outfit and boots, painted with the toolkit (rb_kit.py):

Terrorists
- phoenix: Phoenix Connexion. Balaclava; a navy short-sleeved tee, bare tanned forearms,
  fingerless gloves; a black tactical vest with pouches; urban tiger-stripe trousers bloused
  over black laced jump boots.
- leet: the Elite Crew (L337 Krew). The thinnest: no vest, an olive bomber jacket with a zip, a
  ribbed waistband and cuffs, a light tee's collar; brown trousers, a thigh holster, brown low
  work boots.
- arctic: the Arctic Avengers. The puffiest: a white snow-camouflage suit with grey blotches,
  its hood bunched at the nape, black straps crossed over the chest, a black belt; the tallest
  black boots.
- guerrilla: Guerrilla Warfare. The most muscular: bare arms from the shoulder, a sleeveless
  black vest open over an olive tank top, woodland camouflage tucked into black jungle boots
  worn pale at the toes; the red bandana's tails fly behind.
Counter-terrorists
- seal: SEAL Team 6. OD green, a black vest, black knee pads, trousers bloused over low black
  boots.
- gsg9: GSG-9. Dark blue-violet, a smooth black plate carrier with a high collar and POLIZEI
  across the back, darker knee patches, glossy black boots.
- sas: SAS. Black from head to foot, the vest a different black with magazine pouches, a radio
  on the shoulder, the strap of a gas-mask bag across the chest to the bag on the hip, black
  boots on light grey soles.
- gign: GIGN. Light lilac blue, a shorter dark grey vest with pockets, laced up the back, the
  uniform showing between it and the belt, a thigh holster, high black boots with a ladder of
  light laces.

The upright pictures of the trunk and the legs (57, 61, 34, 38, 53, 49, 62, 30) and the boots
(39, 43, 47, 48) are material maps on the man's silhouettes (grown or thinned by build), lit
as volumes; the look tool turns them into their tilted pictures, so camouflage turns with them.
The arms and hands keep the man's own shading (their tones mapped onto each material's ramp)."""
import json

from lookgen import write_look, write_json, rotate, preview, look_cmd
from heads import Palette, Pic
from body import part as base_part, inflate, shrink
from gridpng import sheet
import rb_heads as H
from rb_kit import (Mat, Part, ramp5, mix, mask_of, grow_mask, shrink_mask, aligned, blotches, tiger, noise,
                    LIGHT, render)

FRONT_LIGHT = LIGHT
# Turned by the look tool from these upright pictures (and the arms' and hands').
UPRIGHT = [57, 34, 53, 49, 62, 30, 39, 43, 5, 9, 1, 17, 21]


# ------------------------------------------------------------------------------- materials
def mat(base, warm=1, edge=None, lit=None, bias=0.0, ramp=None, **kw):
    """A material round a base colour: its hue-shifted ramp, a dark edge and a lit edge."""
    r = ramp or ramp5(base, warm, **{k: v for k, v in kw.items() if k in ('hi', 'li', 'sh', 'dp', 'sat', 'hue')})
    return Mat(r, edge or mix(r[4], '#000000', 0.45), lit or r[3], bias=bias,
               pattern=kw.get('pattern'), flat=kw.get('flat', 0.0))


def far(m):
    """The same material a step darker: the far limb, in the body's shade."""
    return Mat(m.ramp, m.edge, m.lit, bias=m.bias + 1.0, pattern=m.pattern, flat=m.flat)


# ------------------------------------------------------------------------------- silhouettes
def orig_mask(pid):
    return mask_of(base_part(1, pid))


def build_mask(pid, plan):
    """The man's silhouette of part `pid`, grown (n > 0) or thinned (n < 0) across `axis`."""
    m = orig_mask(pid)
    n, axis = plan if isinstance(plan, tuple) else (plan, None)
    if n > 0:
        m = grow_mask(m, n, axis)
    elif n < 0:
        m = shrink_mask(m, -n, axis)
    return m


# ------------------------------------------------------------------------------- the arms
def tone_pic(pid):
    """The man's part as tone indices (0 lightest .. 4 darkest) by its colours' lightness."""
    from heads import lum
    p = base_part(1, pid)
    cols = sorted({c.lower() for r in p.g for c in r if c}, key=lum, reverse=True)
    idx = {c: min(4, round(i * 4 / max(1, len(cols) - 1))) for i, c in enumerate(cols)}
    # Keep the two darkest apart from the middle tones for small parts.
    return Pic([[None if c is None else str(idx[c.lower()]) for c in r] for r in p.g])


def limb(pid, regions, mats, grow=0, axis=None):
    """An arm's or hand's picture in the man's own shading: `regions(x, y, w, h)` names a material
    per pixel (after growing), the tone comes from the man's picture."""
    t = tone_pic(pid)
    if grow > 0:
        inflate(t, grow, axis)
    elif grow < 0:
        shrink(t, -grow, axis)
    out = []
    for y, r in enumerate(t.g):
        row = []
        for x, c in enumerate(r):
            if c is None:
                row.append(None)
                continue
            m = mats[regions(x, y, t.w, t.h)]
            if m.pattern:
                pm = m.pattern(x, y)
                if pm:
                    m = mats[pm]
            i = min(4, max(0, int(c) + round(m.bias)))
            row.append(m.ramp[i])
        out.append(row)
    return Pic(out)


# ------------------------------------------------------------------------------- boots
# Boots seen from the side, the toe to the right (39 near, 43 far), from three quarters (47) and
# from the front (48). Letters: U the upper, T a toe cap, L laces / eyelets, S the sole's side, s
# the tread, H the heel, B the trousers bloused over the top, W wear on the toe. A boot's shaft
# rises above the man's shoe box; the picture is padded so the shoe stays where his was.
BOOTS = {
    # Jump boots (Phoenix): laced up the front to mid-calf, the trousers bloused over the top.
    'jump': {
        '39': ['.BBBBBB......',
               '.UULULU......',
               '.UUULULU.....',
               '.UUUUULUUU...',
               'UUUUUUUUUUTT.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.BBBBB.....',
               '.UULUL.....',
               '.UUULUUUU..',
               'UUUUUUUUTT.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.BBBBB.',
               '.ULLLU.',
               'UULULUU',
               'UUUUUUU',
               'SSSSSSS'],
    },
    # Low work boots (L337): brown leather to the ankle, a stitched welt, a thick sole.
    'work': {
        '39': ['.BBBBBBB.....',
               '.UUUULUUU....',
               'UUUUUUULUUU..',
               'UUUUUUUUUUTT.',
               'SSSSSSSSSSSSS',
               'sHHHsssssssss'],
        '47': ['.BBBBBB....',
               '.UUULUUU...',
               'UUUUUULUUT.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.BBBBB.',
               'UUULUUU',
               'UUUUUUU',
               'SSSSSSS',
               'sssssss'],
    },
    # Tall smooth boots (Arctic): the shaft is the shin's; here the foot.
    'tall': {
        '39': ['.UUUUUU......',
               '.UUUUUU......',
               '.UUUUUUU.....',
               '.UUUUUUUUU...',
               'UUUUUUUUUUUT.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.UUUUU.....',
               '.UUUUU.....',
               '.UUUUUUUU..',
               'UUUUUUUUUT.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.UUUUU.',
               '.UUUUU.',
               'UUUUUUU',
               'UUUUUUU',
               'SSSSSSS'],
    },
    # Jungle boots (Guerrilla): to mid-calf, the camouflage tucked in, the toe worn pale.
    'jungle': {
        '39': ['.UUUUUU......',
               '.UULULU......',
               '.UUULULU.....',
               '.UUUUUUUUW...',
               'UUUUUUUUUWWW.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.UUUUU.....',
               '.UULUL.....',
               '.UUULUUUW..',
               'UUUUUUUUWW.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.UUUUU.',
               '.ULULU.',
               'UUULUUU',
               'UUWWWUU',
               'SSSSSSS'],
    },
    # Low boots (SEAL): just over the ankle, the OD trousers bloused over them.
    'low': {
        '39': ['.BBBBBBB.....',
               '.BBUUULUU....',
               'UUUUUUULUUU..',
               'UUUUUUUUUUTT.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.BBBBBB....',
               '.BUUULUU...',
               'UUUUUULUUT.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.BBBBB.',
               'BUULUUB',
               'UUUUUUU',
               'SSSSSSS',
               'sssssss'],
    },
    # Glossy black boots (GSG-9): a shine down the shaft and on the toe.
    'gloss': {
        '39': ['.UUUUUU......',
               '.UGUULU......',
               '.UGUUULU.....',
               '.UUUUUUUUG...',
               'UUUUUUUUUGGU.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.UUUUU.....',
               '.UGULU.....',
               '.UUUULUUG..',
               'UUUUUUUGGU.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.UUUUU.',
               '.UGLUU.',
               'UUULUUU',
               'UUGGUUU',
               'SSSSSSS'],
    },
    # Black boots on light grey soles (SAS).
    'sole': {
        '39': ['.UUUUUU......',
               '.UULUUU......',
               '.UUUULUU.....',
               '.UUUUUUUUU...',
               'UUUUUUUUUUUU.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.UUUUU.....',
               '.UULUU.....',
               '.UUUULUUU..',
               'UUUUUUUUUU.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.UUUUU.',
               '.UULUU.',
               'UUUUUUU',
               'UUUUUUU',
               'SSSSSSS'],
    },
    # High boots with a ladder of light laces up the front (GIGN); the ladder runs on up the
    # shin's shaft.
    'ladder': {
        '39': ['.UUUULU......',
               '.UUUUUL......',
               '.UUUULUL.....',
               '.UUUUUULUU...',
               'UUUUUUUUUUTT.',
               'SSSSSSSSSSSSS',
               'sHHsssssssss.'],
        '47': ['.UUUUL.....',
               '.UUUULU....',
               '.UUUUULUU..',
               'UUUUUUUUTT.',
               'SSSSSSSSSSS',
               'sHHssssssss'],
        '48': ['.ULULU.',
               '.ULULU.',
               'UULLLUU',
               'UUUUUUU',
               'SSSSSSS'],
    },
}
# Where the man's shoe box (w x 5) sits in each boot picture: its rows from the bottom.
SHOE_BOX = {'39': (13, 5), '43': (13, 5), '47': (11, 5), '48': (7, 5)}


def boot(kind, key, mats, letters, light_dir=LIGHT):
    """A boot picture: the drawer's letters through `letters` to the look's materials."""
    rows = BOOTS[kind]['39' if key == '43' else key]
    legend = {ch: letters[ch] for r in rows for ch in r if ch != '.'}
    p = Part(int(key), [[ch != '.' for ch in r] for r in rows])
    p.text(rows, legend)
    w0, h0 = SHOE_BOX[key]
    aligned(p, 0, len(rows) - h0, w0, h0)
    ms = {k: (far(v) if key == '43' else v) for k, v in mats.items()}
    return p.render(ms, light_dir, wrap=0.5, bounce=False)


# ------------------------------------------------------------------------------- the trunk
def neckline(p, rows, m, mats=None):
    """The neck of the chest picture (its first rows) in material m (skin or the mask's)."""
    for y in rows:
        p.rows(y, y, m)
    return p


def write(look_id, accent, head, parts, effect=None, ribbons=None, attachments=None):
    """Writes the look: the head's pictures, the parts (Pic), turns the upright ones."""
    pal = Palette()
    look = {'id': look_id, 'base': 1, 'accent': accent, '_raw_heads': True, 'parts': {}}
    for k, p in head.pics().items():
        look['parts'][k] = pal.rows(p)
    for k, p in parts.items():
        look['parts'][k] = pal.rows(p)
    if ribbons:
        look['ribbons'] = ribbons(pal)
    if attachments:
        look['attachments'] = attachments(pal)
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('rush-b', look)
    rotate(path, [25] + [k for k in UPRIGHT if str(k) in parts])
    preview(look_id)
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def trunk(rows, legend, mats, key, light_dir=LIGHT, over=(), w0=None, h0=None, ox=None, oy=0):
    """A chest or torso picture from region rows (legend: character → material), lit, aligned
    on the man's box (w0 x h0, its corner at (ox, oy)): by default centred across."""
    p = Part(key, [[ch != '.' for ch in r] for r in rows])
    p.text(rows, legend)
    ow, oh = {57: (10, 12), 61: (11, 13), 34: (9, 16), 38: (11, 16), 53: (8, 14), 49: (8, 14), 62: (8, 7),
              30: (5, 12)}[key]
    w0, h0 = w0 or ow, h0 or oh
    if ox is None:
        ox = (p.w - w0) // 2
    aligned(p, ox, oy, w0, h0)
    return p.render(mats, light_dir, over=over)


def leg(rows, legend, mats, key, far_side=False, ox=None, oy=0):
    ms = {k: far(v) for k, v in mats.items()} if far_side else mats
    return trunk(rows, legend, ms, key, ox=ox, oy=oy)




def piece(rows, mats, key, light_dir=LIGHT, over=(), ox=None, oy=0, far_side=False):
    """A picture from rows of material letters (keys of `mats`)."""
    legend = {ch: ch for r in rows for ch in r if ch != '.'}
    ms = {k: far(v) for k, v in mats.items()} if far_side else mats
    return trunk(rows, legend, ms, key, light_dir, over, ox=ox, oy=oy)


def legmap(pid, plan, fill, shaft=0, shaft_ch='o', blouse=0, edits=()):
    """Rows of a leg part on the man's silhouette (grown or thinned by `plan`) in `fill`; the last
    `shaft` rows a boot's shaft, the `blouse` rows over it a pixel fuller in front (the trousers
    bloused over the boot); `edits` (x, y, letter) for the rest (a holster, a pad)."""
    m = build_mask(pid, plan)
    rows = [[fill if c else '.' for c in r] for r in m]
    h, w = len(rows), len(rows[0])
    for y in range(h - shaft, h):
        rows[y] = [shaft_ch if c != '.' else '.' for c in rows[y]]
    for y in range(h - shaft - blouse, h - shaft):
        xs = [x for x in range(w) if rows[y][x] != '.']
        if xs and xs[-1] + 1 < w:
            rows[y][xs[-1] + 1] = fill
    for x, y, ch in edits:
        rows[y][x] = ch
    return [''.join(r) for r in rows]


def arms(mats, upper, fore, hand, grow=0):
    """The arms and hands: `upper(x, y, w, h)`, `fore(...)`, `hand(...)` name a material per
    pixel of the man's (grown) pictures; the far arm a step darker."""
    farm = {k: far(v) for k, v in mats.items()}
    return {
        '5': limb(5, upper, mats, grow, 'y' if grow else None),
        '9': limb(9, upper, farm, grow, 'y' if grow else None),
        '1': limb(1, fore, mats, grow, 'y' if grow else None),
        '17': limb(17, hand, mats),
        '21': limb(21, hand, farm),
    }


def boots(kind, mats, letters):
    """The four boot pictures, the drawer's letters mapped to the look's materials."""
    return {k: boot(kind, k, mats, letters) for k in ('39', '43', '47', '48')}


def fingerless(x, y, w, h):
    """A fingerless glove on the man's fist: the fingers' ends bare at its front."""
    return 's' if x >= w - 2 and 1 <= y <= h - 2 else 'g'


def gloved(x, y, w, h):
    return 'g'


# Common leathers and metals.
BLACK_LEATHER = ['#58585e', '#3a3a40', '#26262b', '#18181c', '#0e0e10']
STEEL = ['#f0f4f8', '#c4ccd4', '#8e98a2', '#5e666e', '#3a3f44']


def leather(ramp=BLACK_LEATHER):
    return Mat(ramp, mix(ramp[4], '#000000', 0.5), ramp[2])


def skin_of(s):
    return Mat([s[c] for c in 'XWMSD'], s['o'], s['O'])


def cloth_of(c):
    return Mat([c[k] for k in 'ABCEF'], c['k'], c['K'])


# ================================================================================== Phoenix
def phoenix():
    m = {
        'n': cloth_of(H.KNIT),
        'c': Mat(['#4c669a', '#354b7c', '#26385f', '#1b2747', '#121a31'], '#0a0f1e', '#1b2747'),
        's': skin_of(H.TAN),
        'g': leather(),
        'v': Mat(['#626b76', '#454d57', '#30363e', '#22272c', '#15181c'], '#08090b', '#30363e'),
        'p': Mat(['#707a86', '#525b66', '#3c434c', '#2a2f35', '#1a1d21'], '#08090b', '#3c434c'),
        'x': Mat(['#2a2f35', '#22272c', '#1a1d21', '#121417', '#0c0d0f'], '#060607', '#1a1d21'),
        'b': leather(['#4c4c4c', '#333333', '#232323', '#171717', '#0e0e0e']),
        'k': Mat(STEEL, '#22262a', STEEL[2]),
        't': Mat(['#e4ecee', '#c8d4d8', '#a6b6bc', '#82949c', '#5e6e76'], '#2a3236', '#82949c',
                 pattern=tiger('d', 'm', seed=3, period=3, on=0.2)),
        'd': Mat(['#4a5258', '#30363b', '#212529', '#171a1d', '#0f1113'], '#08090a', '#212529'),
        'm': Mat(['#9aa8ae', '#7e8e96', '#66767e', '#506068', '#3a464c'], '#1c2226', '#66767e'),
        'o': leather(['#5a5d62', '#38393d', '#232427', '#18191b', '#0f1011']),
        'l': Mat(['#7a7d82', '#626569', '#4c4f53', '#3a3d40', '#2a2c2f'], '#101112', '#4c4f53'),
        'S': Mat(['#2a2a2c', '#1c1c1e', '#141416', '#0e0e10', '#09090a'], '#030303', '#1c1c1e'),
    }
    over = [('v', 'c'), ('p', 'v'), ('b', 't'), ('v', 'b'), ('t', 'o')]
    parts = {}
    # fmt: off
    parts['57'] = piece([
        #0123456789AB
        '....nnn.....',  # 0  the balaclava down the neck
        '....nnnn....',  # 1
        '...cnnnnc...',  # 2  the tee's collar
        '...cccccc...',  # 3
        '..vvcccvvv..',  # 4  the vest's armhole, the tee's shoulder in it
        '..vvvccvvvv.',  # 5
        '.vvvvvvvvppv',  # 6  pouches on the front
        'vvvvvvvvvppv',  # 7
        'vvvvvvvvvxxv',  # 8
        'vvvvvvvvvppv',  # 9
        '.vvvvvvvvppv',  # 10
        '.vvvvvvvvvv.',  # 11
    ], m, 57, over=over)
    parts['61'] = piece([
        #0123456789ABC
        '....nnnn.....',  # 0
        '....nnnn.....',  # 1
        '...cnnnnc....',  # 2
        '.ccccnncccc..',  # 3  the tee's shoulders, its V
        'vvvcccccvvvv.',  # 4
        'vvvvcccvvvvv.',  # 5
        'vvvvvcvvvvvv.',  # 6
        'vppvvxvvvppv.',  # 7  pouches either side of the front
        'vppvvxvvvppvv',  # 8
        'vvvvvxvvvvvvv',  # 9
        'vppvvxvvvppvv',  # 10
        'vppvvxvvvppvv',  # 11
        '.vvvvvvvvvvv.',  # 12
    ], m, 61, over=over)
    parts['34'] = piece([
        #0123456789A
        '...vvvvvv..',  # 0  the vest's lower part
        '..vvvvvvvp.',  # 1
        '..vvvvvvvp.',  # 2
        '..vvvvvvvv.',  # 3
        '..vvvvvvvv.',  # 4
        '..vvvvvvvv.',  # 5
        '..vvvvvvv..',  # 6
        '..bbbbbbbk.',  # 7  the belt, its buckle in front
        '..bbbbbbbk.',  # 8
        '.ttttttttt.',  # 9  the tiger stripe
        'tttttttttt.',  # 10
        'tttttttttt.',  # 11
        'tttttttttt.',  # 12
        '.ttttttttt.',  # 13
        '..tttttttt.',  # 14
        '...ttttt...',  # 15
    ], m, 34, over=over)
    parts['38'] = piece([
        #0123456789AB
        '...vvvvvvv..',  # 0
        '..vvvvxvvvv.',  # 1
        '..vvvvxvvvv.',  # 2
        '..vppvxvppv.',  # 3
        '..vppvxvppv.',  # 4
        '..vvvvxvvvv.',  # 5
        '..vvvvvvvvv.',  # 6
        '..bbbbkkbbb.',  # 7
        '..bbbbkkbbb.',  # 8
        '.ttttttttttt',  # 9
        'tttttttttttt',  # 10
        'tttttttttttt',  # 11
        'tttttt.ttttt',  # 12
        'ttttt..ttttt',  # 13
        '.tttt..tttt.',  # 14
        '..ttt...ttt.',  # 15
    ], m, 38, over=over)
    # fmt: on
    thigh = legmap(53, 0, 't')
    parts['53'] = piece(thigh, m, 53)
    parts['49'] = piece(legmap(49, 0, 't'), m, 49, far_side=True)
    parts['62'] = piece(legmap(62, 0, 't'), m, 62)
    parts['30'] = piece(legmap(30, (1, 'x'), 't', shaft=2, blouse=2), m, 30, over=over)
    parts.update(boots('jump', m, {'U': 'o', 'T': 'o', 'L': 'l', 'S': 'S', 's': 'S', 'H': 'S', 'B': 't',
                                   'W': 'o', 'G': 'o'}))
    # Short navy sleeves, bare forearms, black fingerless gloves.
    parts.update(arms(m, lambda x, y, w, h: 'c' if x < 5 else 's',
                      lambda x, y, w, h: 'g' if x >= 6 else 's', fingerless))
    return write('phoenix', '#4c669a', H.PHOENIX, parts)


# ===================================================================================== L337
def leet():
    m = {
        'n': skin_of(H.OLIVE),
        's': skin_of(H.OLIVE),
        'c': Mat(['#86a466', '#6a8a4c', '#55713c', '#3e5428', '#2a3a1a'], '#141c0c', '#3e5428'),
        'r': Mat(['#6a8250', '#536a3c', '#42562e', '#2f3e20', '#202a14'], '#101608', '#2f3e20'),
        'w': Mat(['#f4f4ea', '#e0e0d2', '#c8c8b8', '#a2a292', '#7a7a6c'], '#3a3a32', '#a2a292'),
        'z': Mat(['#e8e2c8', '#c8c0a0', '#a29a7a', '#7a7458', '#545038'], '#2a2818', '#a29a7a'),
        'b': leather(['#7a5634', '#5e4026', '#46301c', '#322214', '#20160c']),
        'k': Mat(['#f8e8a8', '#dcc478', '#b49a50', '#86703a', '#5a4a24'], '#2a2010', '#b49a50'),
        't': Mat(['#a8944c', '#8e7c3c', '#756529', '#5a4c1c', '#3e3412'], '#1e1808', '#5a4c1c'),
        'h': leather(['#4a3a2a', '#33281c', '#241c14', '#18120c', '#0e0a06']),
        'x': leather(['#3a2e22', '#2a2118', '#1e1810', '#14100a', '#0c0906']),
        'g': leather(),
        'o': Mat(['#a87c4c', '#8a6238', '#6e4c2a', '#4f361e', '#342212'], '#180e06', '#6e4c2a'),
        'l': Mat(['#d8b884', '#bc9a66', '#9e7e4e', '#7a5e38', '#564026'], '#2a1c0e', '#9e7e4e'),
        'S': Mat(['#4a3a2c', '#36291e', '#281e16', '#1c140e', '#120c08'], '#060402', '#36291e'),
    }
    over = [('b', 't'), ('r', 'b'), ('c', 'r'), ('t', 'o')]
    parts = {}
    # fmt: off
    parts['57'] = piece([
        #0123456789
        '...nnn....',  # 0  the neck
        '...nnnn...',  # 1
        '..cnnnwc..',  # 2  the jacket's collar up, the tee's collar under it
        '..cccwwc..',  # 3
        '..ccccccc.',  # 4
        '..ccccccz.',  # 5  the zip down the front
        '.cccccccz.',  # 6
        '.cccccccz.',  # 7
        '.cccccccz.',  # 8
        '.cccccccz.',  # 9
        '.cccccccz.',  # 10
        '..cccccc..',  # 11
    ], m, 57, over=over)
    parts['61'] = piece([
        #0123456789A
        '...nnnn....',  # 0
        '...nnnn....',  # 1
        '..cnwwnc...',  # 2  the collar open on the tee
        '.ccwwwwcc..',  # 3
        'cccccwcccc.',  # 4
        'ccccczccccc',  # 5  the zip
        'ccccczccccc',  # 6
        '.cccczccccc',  # 7
        '.cccczcccc.',  # 8
        '.cccczcccc.',  # 9
        '.cccczcccc.',  # 10
        '.cccczcccc.',  # 11
        '..ccczccc..',  # 12
    ], m, 61, over=over)
    parts['34'] = piece([
        #012345678
        '...cccc..',  # 0  the jacket's lower part
        '..ccccccz',  # 1
        '..ccccccz',  # 2
        '..ccccccz',  # 3
        '..rrrrrrr',  # 4  its ribbed waistband
        '..rrrrrrr',  # 5
        '..bbbbbbb',  # 6  the belt
        '..bbbbbbk',  # 7
        '..ttttttt',  # 8  brown trousers
        '.tttttttt',  # 9
        '.tttttttt',  # 10
        '.tttttttt',  # 11
        '.tttttttt',  # 12
        '..ttttttt',  # 13
        '...tttttt',  # 14
        '....ttt..',  # 15
    ], m, 34, over=over)
    parts['38'] = piece([
        #0123456789A
        '...ccccc...',  # 0
        '..ccczcccc.',  # 1
        '..ccczcccc.',  # 2
        '..ccczcccc.',  # 3
        '..rrrrrrrr.',  # 4
        '..rrrrrrrr.',  # 5
        '..bbbbkbbb.',  # 6
        '..bbbbkbbb.',  # 7
        '..tttttttt.',  # 8
        '.ttttttttt.',  # 9
        '.ttttttttt.',  # 10
        '.ttttt.ttt.',  # 11
        '.tttt..ttt.',  # 12
        '.tttt..ttt.',  # 13
        '..ttt..ttt.',  # 14
        '..ttt...tt.',  # 15
    ], m, 38, over=over)
    # fmt: on
    holster = [(x, y, 'h') for y in range(3, 9) for x in (1, 2, 3)] + \
              [(x, 4, 'x') for x in range(1, 8)] + [(x, 8, 'x') for x in range(2, 8)]
    parts['53'] = piece(legmap(53, (-1, 'x'), 't', edits=[(x, y, c) for x, y, c in holster
                                                           if build_mask(53, (-1, 'x'))[y][x]]), m, 53)
    parts['49'] = piece(legmap(49, (-1, 'x'), 't'), m, 49, far_side=True)
    parts['62'] = piece(legmap(62, 0, 't'), m, 62)
    parts['30'] = piece(legmap(30, 0, 't'), m, 30)
    parts.update(boots('work', m, {'U': 'o', 'T': 'o', 'L': 'l', 'S': 'S', 's': 'S', 'H': 'S', 'B': 't',
                                   'W': 'o', 'G': 'o'}))
    parts.update(arms(m, lambda x, y, w, h: 'c', lambda x, y, w, h: 'r' if x >= 6 else 'c', fingerless))
    return write('leet', '#c8a04a', H.LEET, parts)


# =================================================================================== Arctic
SNOW = blotches([(0.74, 'e'), (0.6, 'f'), (0.47, 'q')], cell=2.2, seed=7)


def arctic():
    m = {
        'n': cloth_of(H.SKI),
        'w': Mat(['#ffffff', '#f2f6f4', '#dfe6e2', '#bcc4c0', '#929a96'], '#4a504c', '#bcc4c0', pattern=SNOW),
        'h': Mat(['#ffffff', '#f2f6f4', '#dfe6e2', '#bcc4c0', '#929a96'], '#4a504c', '#bcc4c0', pattern=SNOW),
        'H': Mat(['#9aa29e', '#828a86', '#6c7470', '#565e5a', '#424844'], '#2a302c', '#6c7470'),
        'q': Mat(['#d2d8d4', '#bec4c0', '#aab0ac', '#8e9490', '#70766f'], '#3a3e3a', '#8e9490'),
        'f': Mat(['#a8aea8', '#92988f', '#7e847e', '#666b66', '#4e524e'], '#2a2c2a', '#666b66'),
        'e': Mat(['#7a7e7a', '#646864', '#525652', '#3e423e', '#2c2f2c'], '#141614', '#3e423e'),
        'x': leather(['#3c3c3c', '#2a2a2a', '#1c1c1c', '#131313', '#0b0b0b']),
        'k': Mat(STEEL, '#22262a', STEEL[2]),
        'b': leather(['#3c3c3c', '#2a2a2a', '#1c1c1c', '#131313', '#0b0b0b']),
        'p': leather(['#4a4a4a', '#343434', '#262626', '#1a1a1a', '#101010']),
        'g': leather(),
        'o': leather(['#626262', '#3e3e3e', '#262626', '#181818', '#0e0e0e']),
        'S': Mat(['#2a2a2a', '#1c1c1c', '#141414', '#0e0e0e', '#090909'], '#030303', '#1c1c1c'),
    }
    over = [('x', 'w'), ('b', 'w'), ('p', 'b'), ('w', 'o')]
    parts = {}
    # fmt: off
    parts['57'] = piece([
        #0123456789ABC
        '..hh..nnn....',  # 0  the hood bunched at the nape, below the head, a fold in it
        '.hhhhHnnnn...',  # 1
        'hhhhhHnnnnw..',  # 2
        'hHHHhhHwwwww.',  # 3
        'hhhhhHwwxxww.',  # 4  a strap over the shoulder
        '.HHHHwwwwxwww',  # 5  its lower edge
        'wwwwwwwwxxwww',  # 6
        'wwwwwwwwwkwww',  # 7  its buckle
        'wwwwwwwwwxxww',  # 8
        'wwwwwwwwwwxxw',  # 9
        'wwwwwwwwwwxxw',  # 10
        '.wwwwwwwwwwx.',  # 11
        '..wwwwwwwww..',  # 12
    ], m, 57, over=over, ox=2)
    parts['61'] = piece([
        #0123456789ABC
        '...hnnnnh....',  # 0  the hood round the neck
        '..hhnnnnhh...',  # 1
        '.hhwnnnnwhh..',  # 2
        'wxxwwwwwwxxw.',  # 3  the straps from both shoulders
        'wwxxwwwwxxwww',  # 4
        'wwwxxwwxxwwww',  # 5
        'wwwwxkkxwwwww',  # 6  crossed, buckled on the breastbone
        'wwwxxwwxxwwww',  # 7
        'wwxxwwwwxxwww',  # 8
        'wxxwwwwwwxxww',  # 9
        'xxwwwwwwwwxxw',  # 10
        'wwwwwwwwwwwww',  # 11
        '.wwwwwwwwwww.',  # 12
    ], m, 61, over=over, ox=1)
    parts['34'] = piece([
        #0123456789AB
        '...wwwwwwx..',  # 0  the suit, puffed
        '..wwwwwwwwx.',  # 1
        '..wwwwwwwwwx',  # 2
        '.wwwwwwwwwww',  # 3
        '.wwwwwwwwwww',  # 4
        '.wwwwwwwwwww',  # 5
        '.wwwwwwwwww.',  # 6
        '.bbppbbbbbk.',  # 7  the black belt, its pouches
        '.bbppbbbbbk.',  # 8
        '.wwwwwwwwwww',  # 9
        'wwwwwwwwwwww',  # 10
        'wwwwwwwwwwww',  # 11
        'wwwwwwwwwwww',  # 12
        '.wwwwwwwwwww',  # 13
        '..wwwwwwwww.',  # 14
        '...wwwwwww..',  # 15
    ], m, 34, over=over, ox=1)
    parts['38'] = piece([
        #0123456789ABC
        '..xwwwwwwwx..',  # 0
        '..wxwwwwwxww.',  # 1
        '.wwwxwwwxwww.',  # 2
        '.wwwwxwxwwww.',  # 3
        '.wwwwwxwwwww.',  # 4
        '.wwwwwwwwwww.',  # 5
        '.wwwwwwwwwww.',  # 6
        '.bppbbkbbppb.',  # 7
        '.bppbbkbbppb.',  # 8
        '.wwwwwwwwwwww',  # 9
        'wwwwwwwwwwwww',  # 10
        'wwwwwwwwwwwww',  # 11
        'wwwwww.wwwwww',  # 12
        'wwwww...wwwww',  # 13
        '.wwww...wwww.',  # 14
        '..www....www.',  # 15
    ], m, 38, over=over, ox=1)
    # fmt: on
    parts['53'] = piece(legmap(53, (1, 'x'), 'w'), m, 53)
    parts['49'] = piece(legmap(49, (1, 'x'), 'w'), m, 49, far_side=True)
    parts['62'] = piece(legmap(62, 1, 'w'), m, 62)
    parts['30'] = piece(legmap(30, (1, 'x'), 'w', shaft=7), m, 30, over=over)
    parts.update(boots('tall', m, {'U': 'o', 'T': 'o', 'L': 'o', 'S': 'S', 's': 'S', 'H': 'S', 'B': 'w',
                                   'W': 'o', 'G': 'o'}))
    parts.update(arms(m, lambda x, y, w, h: 'w', lambda x, y, w, h: 'g' if x >= w - 2 else 'w', gloved, grow=1))
    return write('arctic', '#dfe6e2', H.ARCTIC, parts)


# ================================================================================ Guerrilla
WOODLAND = blotches([(0.7, 'D'), (0.56, 'B'), (0.38, 'O')], cell=2.2, seed=11)


def guerrilla():
    m = {
        'n': skin_of(H.RUDDY),
        's': skin_of(H.RUDDY),
        'a': Mat(['#8c8456', '#6e683e', '#58532f', '#403c20', '#2a2814'], '#14120a', '#403c20'),
        'v': Mat(['#5a5a54', '#3c3c38', '#2a2a26', '#1c1c1a', '#111110'], '#060605', '#2a2a26'),
        'p': Mat(['#66665e', '#4a4a44', '#363632', '#262624', '#181816'], '#060605', '#363632'),
        'b': leather(['#4a3e30', '#342a20', '#241c16', '#18120e', '#0e0a08']),
        'k': Mat(['#d8d2b8', '#b0a888', '#867e60', '#5e5840', '#3c3828'], '#1c1a10', '#867e60'),
        'w': Mat(['#c4b27c', '#ab9764', '#927e50', '#72603a', '#524428'], '#2a2214', '#72603a', pattern=WOODLAND),
        'O': Mat(['#7e8448', '#666c36', '#52582a', '#3e421e', '#2a2e14'], '#14160a', '#3e421e'),
        'B': Mat(['#8a6a48', '#704e32', '#5a3c26', '#422a1a', '#2c1c10'], '#140c06', '#422a1a'),
        'D': Mat(['#4c4436', '#383228', '#2a241c', '#1e1a14', '#14110c'], '#080604', '#2a241c'),
        'g': leather(),
        'o': leather(['#5c5c5c', '#3a3a3a', '#262626', '#181818', '#0e0e0e']),
        'W': Mat(['#8a7a68', '#726252', '#5a4a3a', '#44382c', '#30281e'], '#140f0a', '#5a4a3a'),
        'l': Mat(['#6a6a6a', '#555555', '#454545', '#363636', '#2a2a2a'], '#101010', '#454545'),
        'S': Mat(['#2a2a2a', '#1c1c1c', '#141414', '#0e0e0e', '#090909'], '#030303', '#1c1c1c'),
    }
    over = [('v', 'a'), ('p', 'v'), ('b', 'w'), ('v', 'b'), ('w', 'o')]
    parts = {}
    # fmt: off
    parts['57'] = piece([
        #0123456789AB
        '....nnnn....',  # 0  the thick neck
        '....nnnn....',  # 1
        '...annnna...',  # 2  the tank top's straps
        '..aaannaaa..',  # 3
        '.vvaaaaavvva',  # 4  the sleeveless vest, open in front
        '.vvvaaavvvva',  # 5
        'vvvvvvvvvvpa',  # 6
        'vvvvvvvvvvpa',  # 7
        'vvvvvvvvvvva',  # 8
        'vvvvvvvvvvpa',  # 9
        '.vvvvvvvvvpa',  # 10
        '.vvvvvvvvvva',  # 11
    ], m, 57, over=over)
    parts['61'] = piece([
        #0123456789ABC
        '....nnnn.....',  # 0
        '....nnnn.....',  # 1
        '..aannnnaa...',  # 2
        'aaaaannaaaaa.',  # 3  broad shoulders
        'vvvvaaaavvvvv',  # 4  the vest open on the olive tank
        'vvvvaaaavvvvv',  # 5
        'vppvaaaavvppv',  # 6
        'vppvaaaavvppv',  # 7
        'vvvvaaaavvvvv',  # 8
        'vppvaaaavvppv',  # 9
        'vppvaaaavvppv',  # 10
        'vvvvaaaavvvvv',  # 11
        '.vvvaaaavvvv.',  # 12
    ], m, 61, over=over)
    parts['34'] = piece([
        #0123456789A
        '...vvvvvva.',  # 0
        '..vvvvvvvpa',  # 1
        '..vvvvvvvpa',  # 2
        '..vvvvvvvva',  # 3
        '..vvvvvvvva',  # 4
        '..vvvvvvvva',  # 5
        '..vvvvvvvaa',  # 6
        '..bbbbbbbk.',  # 7  the belt
        '..bbbbbbbk.',  # 8
        '.wwwwwwwww.',  # 9  woodland camouflage
        'wwwwwwwwww.',  # 10
        'wwwwwwwwww.',  # 11
        'wwwwwwwwww.',  # 12
        '.wwwwwwwww.',  # 13
        '..wwwwwwww.',  # 14
        '...wwwww...',  # 15
    ], m, 34, over=over)
    parts['38'] = piece([
        #0123456789AB
        '...vvaaavv..',  # 0
        '..vvvaaavvv.',  # 1
        '..vppaaappv.',  # 2
        '..vppaaappv.',  # 3
        '..vvvaaavvv.',  # 4
        '..vvvaaavvv.',  # 5
        '..vvvaaavvv.',  # 6
        '..bbbbkkbbb.',  # 7
        '..bbbbkkbbb.',  # 8
        '.wwwwwwwwwww',  # 9
        'wwwwwwwwwwww',  # 10
        'wwwwwwwwwwww',  # 11
        'wwwwww.wwwww',  # 12
        'wwwww..wwwww',  # 13
        '.wwww..wwww.',  # 14
        '..www...www.',  # 15
    ], m, 38, over=over)
    # fmt: on
    parts['53'] = piece(legmap(53, 0, 'w'), m, 53)
    parts['49'] = piece(legmap(49, 0, 'w'), m, 49, far_side=True)
    parts['62'] = piece(legmap(62, 0, 'w'), m, 62)
    parts['30'] = piece(legmap(30, (1, 'x'), 'w', shaft=3), m, 30, over=over)
    parts.update(boots('jungle', m, {'U': 'o', 'T': 'o', 'L': 'l', 'S': 'S', 's': 'S', 'H': 'S', 'B': 'w',
                                     'W': 'W', 'G': 'o'}))
    # Bare, muscular arms from the shoulder; fingerless gloves.
    parts.update(arms(m, lambda x, y, w, h: 's', lambda x, y, w, h: 'g' if x >= w - 2 else 's', fingerless,
                      grow=1))

    def ribbons(pal):
        # The bandana's two tails from its knot at the back of the head.
        r = H.RED
        return {'bandana': {'anchor': 'head', 'offset': [7, -1], 'segments': 3, 'length': 2.5, 'width': [2, 1],
                            'colors': [pal.char(r['n']), pal.char(r['N']), pal.char(r['N'])], 'gravity': 90,
                            'drag': 3, 'stiffness': 0.25}}
    return write('guerrilla', '#e0402e', H.GUERRILLA, parts, ribbons=ribbons)


# ============================================================== the counter-terrorists' kit
# A uniform with long sleeves under a tactical vest, a belt; the variants are each soldier's.
# fmt: off
CT_57 = [
    #0123456789AB
    '....nnn.....',  # 0  the mask down the neck
    '....nnnn....',  # 1
    '...cnnnnc...',  # 2  the uniform's collar
    '...cccccc...',  # 3
    '..vvcccvvv..',  # 4  the vest
    '..vvvvvvvvv.',  # 5
    '.vvvvvvvvppv',  # 6  pouches on the front
    'vvvvvvvvvppv',  # 7
    'vvvvvvvvvvvv',  # 8
    'vvvvvvvvvppv',  # 9
    '.vvvvvvvvppv',  # 10
    '.vvvvvvvvvv.',  # 11
]
CT_61 = [
    #0123456789ABC
    '....nnnn.....',  # 0
    '....nnnn.....',  # 1
    '...cnnnnc....',  # 2
    '.ccccnncccc..',  # 3
    'vvvccnnccvvv.',  # 4
    'vvvvcccvvvvv.',  # 5
    'vvvvvcvvvvvv.',  # 6
    'vppvvvvvvppv.',  # 7
    'vppvvvvvvppvv',  # 8
    'vvvvvvvvvvvvv',  # 9
    'vppvvvvvvppvv',  # 10
    'vppvvvvvvppvv',  # 11
    '.vvvvvvvvvvv.',  # 12
]
CT_34 = [
    #0123456789A
    '...vvvvvv..',  # 0
    '..vvvvvvvp.',  # 1
    '..vvvvvvvp.',  # 2
    '..vvvvvvvv.',  # 3
    '..vvvvvvvv.',  # 4
    '..vvvvvvvv.',  # 5
    '..vvvvvvv..',  # 6
    '..bbbbbbbk.',  # 7
    '..bbbbbbbk.',  # 8
    '.ttttttttt.',  # 9
    'tttttttttt.',  # 10
    'tttttttttt.',  # 11
    'tttttttttt.',  # 12
    '.ttttttttt.',  # 13
    '..tttttttt.',  # 14
    '...ttttt...',  # 15
]
CT_38 = [
    #0123456789AB
    '...vvvvvvv..',  # 0
    '..vvvvvvvvv.',  # 1
    '..vvvvvvvvv.',  # 2
    '..vppvvvppv.',  # 3
    '..vppvvvppv.',  # 4
    '..vvvvvvvvv.',  # 5
    '..vvvvvvvvv.',  # 6
    '..bbbbkkbbb.',  # 7
    '..bbbbkkbbb.',  # 8
    '.ttttttttttt',  # 9
    'tttttttttttt',  # 10
    'tttttttttttt',  # 11
    'tttttt.ttttt',  # 12
    'ttttt..ttttt',  # 13
    '.tttt..tttt.',  # 14
    '..ttt...ttt.',  # 15
]
# fmt: on


def edited(rows, changes):
    out = [list(r) for r in rows]
    for (x, y), ch in changes.items():
        out[y][x] = ch
    return [''.join(r) for r in out]


def ct(look_id, accent, head, m, boot_kind, boot_letters, e57=None, e61=None, e34=None, e38=None, knee=None,
       shin=None, thigh_edits=(), over=(), r57=CT_57, r61=CT_61, r34=CT_34, r38=CT_38):
    """A counter-terrorist: his vest's trunk (the kit's, or rows of his own `r57`...) with his
    edits, his legs and boots."""
    over = [('v', 'c'), ('p', 'v'), ('b', 't'), ('v', 'b'), ('t', 'o')] + list(over)
    parts = {
        '57': piece(edited(r57, e57 or {}), m, 57, over=over),
        '61': piece(edited(r61, e61 or {}), m, 61, over=over),
        '34': piece(edited(r34, e34 or {}), m, 34, over=over),
        '38': piece(edited(r38, e38 or {}), m, 38, over=over),
    }
    mask53 = build_mask(53, 0)
    parts['53'] = piece(legmap(53, 0, 't', edits=[(x, y, c) for x, y, c in thigh_edits if mask53[y][x]]), m, 53)
    parts['49'] = piece(legmap(49, 0, 't'), m, 49, far_side=True)
    parts['62'] = piece(knee or legmap(62, 0, 't'), m, 62)
    parts['30'] = piece(shin or legmap(30, (1, 'x'), 't', shaft=2), m, 30, over=over)
    parts.update(boots(boot_kind, m, boot_letters))
    parts.update(arms(m, lambda x, y, w, h: 'c', lambda x, y, w, h: 'g' if x >= w - 2 else 'c', gloved))
    return parts


BOOT_LETTERS = {'U': 'o', 'T': 'o', 'L': 'l', 'S': 'S', 's': 'S', 'H': 'S', 'B': 't', 'W': 'o', 'G': 'G'}


def blacks(vest, pouch=None):
    """A vest's black (a hue of its own) and its pouches a step lighter."""
    v = ramp5(vest, 1, hi=0.3, li=0.13, sh=-0.3, dp=-0.55, sat=0.02, hue=0.0)
    p = ramp5(mix(vest, '#ffffff', 0.08), 1, hi=0.3, li=0.13, sh=-0.3, dp=-0.55, sat=0.02, hue=0.0)
    return Mat(v, mix(v[4], '#000000', 0.5), v[2]), Mat(p, mix(p[4], '#000000', 0.5), p[2])


# ===================================================================================== SEAL
def seal():
    od = ['#8e9668', '#737c52', '#5e6644', '#464d30', '#30351f']
    v, p = blacks('#2c2e24')
    m = {
        'n': Mat([H.MASK[c] for c in '12345'], H.MASK['6'], H.MASK['7']),
        'c': Mat(od, '#181c0e', od[3]),
        't': Mat(od, '#181c0e', od[3]),
        'v': v, 'p': p,
        'b': leather(['#444438', '#2e2e26', '#20201a', '#161612', '#0c0c0a']),
        'k': Mat(['#9aa088', '#7c826a', '#606650', '#484c3a', '#30342a'], '#14160e', '#606650'),
        'P': Mat(['#6a6c62', '#45473f', '#2c2e28', '#1e1f1b', '#121310'], '#050504', '#2c2e28'),
        'g': leather(),
        'o': leather(['#5a5a58', '#383836', '#242422', '#181816', '#0e0e0d']),
        'l': Mat(['#6a6a68', '#555553', '#454543', '#363634', '#2a2a28'], '#101010', '#454543'),
        'S': Mat(['#2a2a28', '#1c1c1a', '#141412', '#0e0e0d', '#090908'], '#030303', '#1c1c1a'),
        'G': leather(['#5a5a58', '#383836', '#242422', '#181816', '#0e0e0d']),
    }
    # Black knee pads, a pixel proud of the knee.
    knee = legmap(62, 1, 'P', edits=[(x, 0, 't') for x in range(10)] + [(x, 1, 't') for x in range(10)])
    knee = [r.replace('t', '.') if i == 0 else r for i, r in enumerate(knee)]
    parts = ct('seal', '#737c52', H.SEAL, m, 'low', BOOT_LETTERS, knee=knee,
               shin=legmap(30, (1, 'x'), 't', shaft=1, blouse=2), over=[('P', 't')])
    return write('seal', '#8e9668', H.SEAL, parts)


# ==================================================================================== GSG-9
def gsg9():
    navy = ['#6a74a8', '#525a8c', '#3f4672', '#2e3456', '#1e223c']
    v, p = blacks('#2a2b32')
    m = {
        'n': Mat([H.MASK[c] for c in '12345'], H.MASK['6'], H.MASK['7']),
        'c': Mat(navy, '#141830', navy[3]),
        't': Mat(navy, '#141830', navy[3]),
        'q': Mat(['#4e5680', '#3e4468', '#30354f', '#25293c', '#1a1d2a'], '#0c0e16', '#30354f'),
        'v': v, 'p': p,
        'w': Mat(['#e4e4ec', '#cacad2', '#ababb4', '#8a8a94', '#6a6a72'], '#2a2a30', '#ababb4'),
        'b': leather(['#404048', '#2c2c32', '#1e1e22', '#151518', '#0c0c0e']),
        'k': Mat(STEEL, '#22262a', STEEL[2]),
        'g': leather(),
        'o': leather(['#4a4a52', '#2e2e34', '#1e1e22', '#141417', '#0c0c0e']),
        'G': Mat(['#d8dae2', '#a8aab4', '#7a7c86', '#55575f', '#3a3c42'], '#1a1b1e', '#7a7c86'),
        'l': Mat(['#5a5a62', '#48484e', '#3a3a40', '#2e2e33', '#232327'], '#0e0e10', '#3a3a40'),
        'S': Mat(['#2a2a2e', '#1c1c1f', '#141416', '#0e0e10', '#09090a'], '#030303', '#1c1c1f'),
    }
    # A smooth plate carrier, no pouches, its collar high round the neck; POLIZEI: a light line
    # across its back, a short one on the front by his right shoulder.
    # fmt: off
    r57 = [
        #0123456789AB
        '....nnn.....',  # 0
        '....nnnn....',  # 1
        '...vnnnnv...',  # 2  the high collar
        '...vvccvv...',  # 3
        '..vvvccvvv..',  # 4
        '..vvvvvvvvv.',  # 5
        '.vvvvvvvvvvv',  # 6
        'wwwvvvvvvvvv',  # 7  POLIZEI across the back
        'vvvvvvvvvvvv',  # 8
        'vvvvvvvvvvvv',  # 9
        '.vvvvvvvvvvv',  # 10
        '.vvvvvvvvvv.',  # 11
    ]
    r61 = [
        #0123456789ABC
        '....nnnn.....',  # 0
        '....nnnn.....',  # 1
        '..vvnnnnvv...',  # 2  the high collar
        '.vvvvnnvvvv..',  # 3
        'vvvvvccvvvvv.',  # 4
        'vwwvvvvvvvvv.',  # 5  POLIZEI by his right shoulder
        'vvvvvvvvvvvv.',  # 6
        'vvvvvvvvvvvv.',  # 7
        'vvvvvvvvvvvvv',  # 8
        'vvvvvvvvvvvvv',  # 9
        'vvvvvvvvvvvvv',  # 10
        'vvvvvvvvvvvvv',  # 11
        '.vvvvvvvvvvv.',  # 12
    ]
    # fmt: on
    r34 = edited(CT_34, {(9, 1): 'v', (9, 2): 'v'})
    r38 = edited(CT_38, {(x, y): 'v' for y in (3, 4) for x in (3, 4, 8, 9)})
    knee = legmap(62, 0, 'q', edits=[(6, 0, 't'), (7, 0, 't'), (4, 1, 't'), (5, 1, 't')])
    parts = ct('gsg9', '#4e5888', H.GSG9, m, 'gloss', BOOT_LETTERS, knee=knee, r57=r57, r61=r61, r34=r34, r38=r38)
    return write('gsg9', '#626ca2', H.GSG9, parts)


# ====================================================================================== SAS
def sas():
    black = ['#5e6164', '#46494c', '#35373a', '#26282a', '#18191b']
    v, p = blacks('#1e2226')
    m = {
        'n': cloth_of(H.HOOD),
        'c': Mat(black, '#08090a', black[3]),
        't': Mat(black, '#08090a', black[3]),
        'v': v, 'p': p,
        'r': Mat(['#5a6066', '#454a50', '#34383c', '#26292c', '#1a1c1e'], '#08090a', '#34383c'),
        'R': Mat(['#e8f0f0', '#b8c4c8', '#8a969a', '#606a6e', '#424a4e'], '#1c2022', '#8a969a'),
        's': Mat(['#6e7276', '#585c60', '#46494c', '#35383a', '#26282a'], '#0c0d0e', '#46494c'),
        'h': Mat(['#585e56', '#454a43', '#353a34', '#272b26', '#1b1e1a'], '#0a0b09', '#353a34'),
        'H': Mat(['#666c63', '#50564e', '#3f443d', '#2f332d', '#212420'], '#0a0b09', '#3f443d'),
        'b': leather(['#3c3e40', '#2a2c2e', '#1e1f21', '#151617', '#0d0d0e']),
        'k': Mat(['#7a7e82', '#62666a', '#4e5256', '#3c3f42', '#2c2e30'], '#101112', '#4e5256'),
        'g': leather(),
        'o': leather(['#4e5052', '#323436', '#222324', '#171819', '#0e0e0f']),
        'l': Mat(['#5a5c5e', '#48494b', '#3a3b3d', '#2e2f30', '#232425'], '#0e0e0f', '#3a3b3d'),
        'S': Mat(['#c8cacc', '#aeb0b2', '#94969a', '#76787c', '#5a5c60'], '#2a2c2e', '#94969a'),
        'G': leather(['#4e5052', '#323436', '#222324', '#171819', '#0e0e0f']),
    }
    # The radio on the shoulder, its stub of an aerial; magazine pouches across the front; the
    # strap of the gas-mask bag across the chest from his right shoulder to the bag on his left
    # hip.
    # fmt: off
    r57 = [
        #0123456789AB
        '....nnn.....',  # 0
        '....nnnn....',  # 1
        '..rcnnnnc...',  # 2  the radio
        '..rcccccc...',  # 3
        '.rrRccsvvv..',  # 4  the bag's strap over the shoulder
        '.rrrvvvsvvv.',  # 5
        '.vvvvvvvsppv',  # 6
        'vvvvvvvvvspv',  # 7
        'vvvvvvvvvpsv',  # 8
        'vvvvvvvvvpps',  # 9
        '.vvvvvvvvppv',  # 10
        '.vvvvvvvvvv.',  # 11
    ]
    r61 = [
        #0123456789ABC
        '....nnnn.....',  # 0
        '....nnnn.....',  # 1
        '.r.cnnnnc....',  # 2  the radio
        '.rRccnncccc..',  # 3
        'vsvccnnccvvv.',  # 4  the strap from his right shoulder
        'vvsvcccvvvvv.',  # 5
        'vvvsvcvvvvvv.',  # 6
        'vpppsppppvvv.',  # 7  magazine pouches across, the strap over them
        'vpppvspppvvvv',  # 8
        'vvvvvvsvvvvvv',  # 9
        'vvvvvvvsvvvvv',  # 10
        'vvvvvvvvsvvvv',  # 11
        '.vvvvvvvvsvv.',  # 12
    ]
    r34 = [
        #0123456789A
        '...vvvvvv..',  # 0
        '..vvvvvvsp.',  # 1
        '..vvvvvsvp.',  # 2
        '..vvvvsvvv.',  # 3
        '..vvvsvvvv.',  # 4
        '..vvsvvvvv.',  # 5
        '..vvhhhvv..',  # 6  the gas-mask bag on his hip
        '..bhHHHhbk.',  # 7  its flap
        '..bhhhhhbk.',  # 8
        '.thhhhhttt.',  # 9
        'tttthhhttt.',  # 10
        'tttttttttt.',  # 11
        'tttttttttt.',  # 12
        '.ttttttttt.',  # 13
        '..tttttttt.',  # 14
        '...ttttt...',  # 15
    ]
    r38 = [
        #0123456789AB
        '...vvvvvsv..',  # 0
        '..vvvvvvvsv.',  # 1
        '..vvvvvvvvs.',  # 2
        '..vppvvvvvs.',  # 3
        '..vppvvvvvs.',  # 4
        '..vvvvvvvhhh',  # 5  the bag
        '..vvvvvvvHHH',  # 6
        '..bbbbkkbhhh',  # 7
        '..bbbbkkbhhh',  # 8
        '.tttttttthhh',  # 9
        'tttttttttttt',  # 10
        'tttttttttttt',  # 11
        'tttttt.ttttt',  # 12
        'ttttt..ttttt',  # 13
        '.tttt..tttt.',  # 14
        '..ttt...ttt.',  # 15
    ]
    # fmt: on
    parts = ct('sas', '#46494c', H.SAS, m, 'sole', BOOT_LETTERS, r57=r57, r61=r61, r34=r34, r38=r38,
               over=[('s', 'v'), ('s', 'p'), ('H', 'h'), ('h', 't')])
    return write('sas', '#8a969a', H.SAS, parts)


# ===================================================================================== GIGN
def gign():
    blue = ['#a2acec', '#8290d6', '#6876bc', '#505c9a', '#383f72']
    v, p = blacks('#3a3c40')
    m = {
        'n': Mat([H.LOWER[c] for c in '12345'], H.LOWER['6'], H.LOWER['7']),
        'c': Mat(blue, '#1a1c34', blue[3]),
        't': Mat(blue, '#1a1c34', blue[3]),
        'v': v, 'p': p,
        'L': Mat(['#c4c6ca', '#a8aaae', '#8c8e92', '#707276', '#56585c'], '#26282a', '#8c8e92'),
        'h': leather(['#3a3a3e', '#28282c', '#1c1c1f', '#141416', '#0c0c0e']),
        'x': leather(['#2e2e32', '#222225', '#18181b', '#111113', '#0a0a0b']),
        'b': leather(['#3e3e44', '#2a2a2e', '#1e1e21', '#151517', '#0c0c0e']),
        'k': Mat(STEEL, '#22262a', STEEL[2]),
        'g': leather(),
        'o': leather(['#4c4c4e', '#303032', '#202022', '#161617', '#0d0d0e']),
        'l': Mat(['#c4c6ca', '#a8aaae', '#8c8e92', '#707276', '#56585c'], '#26282a', '#8c8e92'),
        'S': Mat(['#2a2a2c', '#1c1c1e', '#141416', '#0e0e10', '#09090a'], '#030303', '#1c1c1e'),
        'G': leather(['#4c4c4e', '#303032', '#202022', '#161617', '#0d0d0e']),
    }
    # The vest laced up the back.
    lace57 = {(0, 6): 'L', (1, 7): 'L', (0, 8): 'L', (1, 9): 'L', (1, 10): 'L'}
    lace34 = {(2, 1): 'L', (3, 2): 'L', (2, 3): 'L'}
    # A shorter vest: the uniform shows between it and the belt.
    # fmt: off
    r34 = [
        #0123456789A
        '...vvvvvv..',  # 0
        '..vvvvvvvp.',  # 1
        '..vvvvvvvp.',  # 2
        '..vvvvvvvv.',  # 3  the vest's lower edge
        '..cccccccc.',  # 4  the uniform under it
        '..cccccccc.',  # 5
        '..ccccccc..',  # 6
        '..bbbbbbbk.',  # 7  the belt
        '..bbbbbbbk.',  # 8
        '.ttttttttt.',  # 9
        'tttttttttt.',  # 10
        'tttttttttt.',  # 11
        'tttttttttt.',  # 12
        '.ttttttttt.',  # 13
        '..tttttttt.',  # 14
        '...ttttt...',  # 15
    ]
    r38 = [
        #0123456789AB
        '...vvvvvvv..',  # 0
        '..vvvvvvvvv.',  # 1
        '..vppvvvppv.',  # 2  its pockets
        '..vppvvvppv.',  # 3
        '..vvvvvvvvv.',  # 4  its lower edge
        '..ccccccccc.',  # 5  the uniform under it
        '..ccccccccc.',  # 6
        '..bbbbkkbbb.',  # 7
        '..bbbbkkbbb.',  # 8
        '.ttttttttttt',  # 9
        'tttttttttttt',  # 10
        'tttttttttttt',  # 11
        'tttttt.ttttt',  # 12
        'ttttt..ttttt',  # 13
        '.tttt..tttt.',  # 14
        '..ttt...ttt.',  # 15
    ]
    # fmt: on
    holster = [(x, y, 'h') for y in range(3, 9) for x in (1, 2, 3)] + \
              [(x, 4, 'x') for x in range(1, 8)] + [(x, 8, 'x') for x in range(2, 8)]
    # High boots: the shaft half up the shin, a ladder of light laces up its front.
    shin = legmap(30, (1, 'x'), 't', shaft=6)
    shin = [''.join('L' if ch == 'o' and x == max(i for i, c in enumerate(r) if c != '.') and y % 2 == 0 else ch
                    for x, ch in enumerate(r)) for y, r in enumerate(shin)]
    parts = ct('gign', '#6a70aa', H.GIGN, m, 'ladder', {**BOOT_LETTERS, 'L': 'L'}, e57=lace57, e34=lace34,
               thigh_edits=holster, shin=shin, r34=r34, r38=r38)
    return write('gign', '#828ac6', H.GIGN, parts)


LOOK_IDS = ['phoenix', 'leet', 'arctic', 'guerrilla', 'seal', 'gsg9', 'sas', 'gign']
BUILDERS = {'phoenix': phoenix, 'leet': leet, 'arctic': arctic, 'guerrilla': guerrilla, 'seal': seal,
            'gsg9': gsg9, 'sas': sas, 'gign': gign}


def heads_sheet():
    """The eight heads magnified (out/rb-heads.png): profile, 3/4, the blinks and the pain face."""
    pics = []
    for h in H.HEADS:
        pal = Palette()
        for k, p in h.pics().items():
            pics.append((pal.rows(p), pal.pal))
    sheet('rb-heads.png', pics, scale=10, per_row=10)


import sys as _sys
_only = [a for a in _sys.argv[1:] if a in BUILDERS] if __name__ == '__main__' else []
LOOKS = {i: BUILDERS[i]() for i in (_only or LOOK_IDS)}
heads_sheet()
print('rush b looks written')
