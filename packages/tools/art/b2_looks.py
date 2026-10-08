"""B-2's look: slender. The calm girl's face (3) under a white bob, a black blindfold and a black
hairband; a black dress with puffed sleeves and a full skirt flaring from the waist over the
legs, a strip of bare thigh, lace-topped stockings, glossy thigh-high boots on thin legs, long
black gloves, and the long blade on her back."""
from lookgen import *
from heads import Pic, Palette, skin_tones, shaded, rim, neat_mouth
from body import outfit_parts, write_parts
from gridpng import sheet

PALE = ['#fff6ee', '#f6e2d6', '#e4c8b8', '#c4a090', '#8a6a5e']
HEAD_SKIN = ['#fff8f2', '#fbeadf', '#f2d8c8', '#e2c0ac', '#c8a08c', '#a47e6c', '#7e5e50']
KEEP = ['#dee3e7', '#fff7de', '#ad4d21', '#634931', '#4a3c29', '#7b1008', '#a50800', '#d6be9c']
# White hair: the strands close in tone (no checker), its edge a little darker.
HAIR = {'#000000': '#e2e4ec', '#182421': '#cdd0da', '#422c29': '#f6f6fa', '#7b1008': '#b07a7a', '#a50800': '#c89090'}
BAND = '#16161c'
BAND_HI = '#3a3a44'
GLOSS = ['#5a5a68', '#3a3a46', '#26262e', '#18181e', '#0e0e12']
DRESS = ['#4a4a56', '#34343e', '#26262e', '#1a1a20', '#101014']
OUTLINE = '#08080a'


def b2_head(front=False):
    p = Pic.orig(3, front)
    skin_tones(p, HEAD_SKIN, keep=KEEP)
    p.recolor(HAIR)
    neat_mouth(p, front, '#b07878', '#e0b4ac', HEAD_SKIN[2])
    rim(p, ['#e2e4ec', '#cdd0da', '#f6f6fa'], '#9a9eac')
    if not front:
        # The blindfold across the face, the hairband over the crown.
        for y in (7, 8, 9):
            for x in range(9, p.w):
                if p.get(x, y):
                    p.set(x, y, BAND_HI if y == 7 else BAND)
        for x, y in ((9, 0), (9, 1), (8, 2), (8, 3), (7, 4), (7, 5), (6, 6)):
            for dx in (0, 1):
                if p.get(x + dx, y):
                    p.set(x + dx, y, BAND if dx else BAND_HI)
    else:
        for y in (8, 9, 10):
            for x in range(1, p.w - 2):
                if p.get(x, y) and not p.get(x, y) in HAIR.values():
                    p.set(x, y, BAND_HI if y == 8 else BAND)
        for x in range(3, p.w - 3):
            if p.get(x, 2):
                p.set(x, 2, BAND)
    return p


def skirt(front=False):
    """The full skirt over the torso's point: from the waist (the belt, row 7 of the torso) to
    mid-thigh, flaring, scalloped, a grey pattern above its hem. 17 × 32, centred like the torso
    (its rows 7..17 here at 15..25)."""
    w, h, cx = 17, 32, 8
    mask = []
    for y in range(h):
        r = y - 15
        if r < 0 or r > 10:
            mask.append('.' * w)
            continue
        half = 4.2 + r * (0.36 if not front else 0.42)
        row = ''.join('#' if abs(x - cx) <= half else '.' for x in range(w))
        if r == 10:
            row = ''.join(ch if (x % 3) != 1 else '.' for x, ch in enumerate(row))
        mask.append(row)
    p = shaded(mask, DRESS, OUTLINE, light=(0.5, -0.3, 0.8))
    for x in range(w):
        y = 15 + 8
        if p.get(x, y) and p.get(x, y) != OUTLINE and x % 2 == 0:
            p.set(x, y, '#8a8e9a')
        if p.get(x, y - 1) and p.get(x, y - 1) != OUTLINE and x % 4 == 1:
            p.set(x, y - 1, '#6a6e7a')
    return p


RULES = [
    *skin(PALE, CHEST + TORSO, with_shins=False),
    recolor(CHEST, ramp(SHIRT, DRESS[1:4])),
    # Black puffed sleeves and long black gloves.
    recolor(UPPER_ARM + FOREARM + HAND, {**ramp(SKIN, DRESS), '#ffcb84': DRESS[1], '#a56531': DRESS[3]}),
    recolor(FOREARM, {WRIST[0]: '#c9a85a', WRIST[1]: DRESS[2], WRIST[2]: DRESS[4]}),
    recolor(TORSO, ramp(PALE, [DRESS[0], DRESS[0], DRESS[1], DRESS[2], DRESS[3]])),
    recolor(TORSO + KNEE, ramp(SHORTS, GLOSS)),
    # Glossy boots up the shins; heels black.
    recolor(SHIN, ramp(SHIN_SKIN, GLOSS[1:4])),
    recolor(SHOES, {**ramp(SHOE['main'], GLOSS[1:]), '#d64908': GLOSS[2], '#fffbe7': GLOSS[0],
                    '#d6cbb5': GLOSS[3], '#8c8273': GLOSS[4]}),
]
# Slender: puffed sleeves only.
PLAN = {'upper-arm': 2, 'thigh': 0, 'chest': 0}


def legs_and_lace(id_, p):
    """Thighs: bare skin at the top, a lace stocking band, then the glossy boot. The bodice: a
    lace window at the front."""
    if 49 <= id_ <= 56:
        rows = p.h
        for y in range(rows):
            for x in range(p.w):
                c = p.get(x, y)
                if not c:
                    continue
                t = y / rows
                if t < 0.66:
                    tone = ['#fbeadf', '#f2d8c8', '#e2c0ac'][min(2, x * 3 // max(1, p.w))]
                    p.set(x, y, tone)
                elif t < 0.74:
                    p.set(x, y, '#2a2a32' if (x + y) % 2 else '#4a4a56')
                else:
                    p.set(x, y, GLOSS[min(4, 1 + x * 3 // max(1, p.w))])
    if id_ == 57:
        for x, y in ((6, 5), (7, 5), (6, 6), (7, 6), (5, 6)):
            if p.get(x, y):
                p.set(x, y, '#e2c0ac' if (x + y) % 2 else '#5a5a66')
    return p


def b2_sword():
    import json
    old = json.load(open(BOSSES + '/b2/looks/android.json', encoding='utf-8'))
    return old['attachments']['sword'], old['palette']


sword, old_pal = b2_sword()
pal = Palette({'k': '#16161c'})
# The sword's own colours come with it.
sword_rows = {k: [''.join(ch if ch == '.' else pal.char(old_pal[ch]) for ch in r) for r in rows]
              for k, rows in sword['sprites'].items()}
look = {'id': 'android', 'base': 0, 'accent': '#d9c38a', '_raw_heads': True, 'recolor': RULES,
        'parts': dict(no_ponytail())}
write_parts(look, outfit_parts(0, RULES, PLAN, legs_and_lace), pal)
look['parts']['25'] = pal.rows(b2_head())
look['parts']['29'] = pal.rows(b2_head(True))
look['attachments'] = {
    'sword': {'layer': 'back', 'sprites': sword_rows},
    'skirt': {'layer': 'hips', 'sprites': {'34': pal.rows(skirt()), '38': pal.rows(skirt(True))}},
}
look['palette'] = pal.pal
path = write_look('b2', look)
rotate(path, [25, 'skirt@34'])
preview('android')
sheet('b2-parts.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(3), b2_head(), b2_head(True), skirt(), skirt(True))], scale=7)
print('b2 look written')
