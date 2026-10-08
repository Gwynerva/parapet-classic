"""Vera's looks: the black-haired girl (3), her hair blue-black, natural lips, the red tattoo
around her right eye; athletic: a black tank, a vest with the red sling across it, or a red and
white hood; white trousers with black panels, red shoes, a red glove, a black armband."""
from lookgen import *
from heads import Pic, Palette, skin_tones, hood, neat_mouth
from body import outfit_parts, write_parts
from gridpng import sheet

PALE = ['#fff0e2', '#f6d8bc', '#e2b896', '#be9070', '#8a6448']
HEAD_SKIN = ['#fff2e4', '#fbe2c8', '#f0caa8', '#dcae8a', '#c09070', '#9a6e52', '#74503a']
KEEP = ['#dee3e7', '#fff7de', '#ad4d21', '#634931', '#4a3c29', '#7b1008', '#a50800', '#d6be9c']
HAIR = {'#000000': '#0e0e16', '#182421': '#1e1e2a', '#422c29': '#3a3a50', '#7b1008': '#a8605a', '#a50800': '#c47a70'}
INK = '#e5332a'
TATTOO = '#c8302a'
BLACK = ['#3a3a44', '#26262e', '#16161c']
WHITE5 = ['#f6f6f6', '#e4e4e4', '#c8c8cc', '#aaaab0', '#8a8a92']
RED_SHOE = {**ramp(SHOE['main'], ['#ff3a2e', '#d01c18', '#8a100c']), '#d64908': '#d01c18', '#d6cbb5': '#f0f0f0',
            '#8c8273': '#c0c0c0'}
RED_GLOVE = {**ramp(PALE, ['#ff5a4a', '#e5332a', '#c0241e', '#901410', '#600c08'])}


def faith(front=False, tattoo=False):
    p = Pic.orig(3, front)
    skin_tones(p, HEAD_SKIN, keep=KEEP)
    p.recolor(HAIR)
    neat_mouth(p, front, '#a8605a', '#cc847a', HEAD_SKIN[2])
    if tattoo:
        # Around her right eye: a sweep under it and a flick above its outer corner.
        pts = [(11, 10), (14, 7)] if not front else [(4, 10), (3, 7)]
        for x, y in pts:
            if p.get(x, y):
                p.set(x, y, TATTOO)
    return p


HOOD = ['#ff8a7a', '#f45a4a', INK, '#c8281f', '#a01c18', '#741410']
LINING = '#f2f2f4'


def hooded(front=False):
    """The hood up: red cloth close over the hair, draped down to the neck at the back, its
    inside in shadow around the face."""
    from heads import shaded
    p = faith(front, tattoo=True).pad(1, 1, 1, 3)
    w, h = p.w, p.h
    if not front:
        face_edge = lambda y: 13 if y < 10 else 11
        inside = lambda x, y: y < 5 or x < face_edge(y)
    else:
        inside = lambda x, y: y < 5 or x < 4 or x > 14
    solid = [[p.get(x, y) is not None for x in range(w)] for y in range(h)]
    near = lambda x, y: any(0 <= x + dx < w and 0 <= y + dy < h and solid[y + dy][x + dx]
                            for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    mask = [''.join('#' if near(x, y) and inside(x, y) else '.' for x in range(w)) for y in range(h)]
    # The drape: the back of the hood falls to the shoulders.
    rows = [list(r) for r in mask]
    last = max(y for y in range(h) if '#' in mask[y])
    left = min(x for x in range(w) if any(mask[y][x] == '#' for y in range(h)))
    for y in range(last - 3, h):
        for x in range(left, left + (5 if not front else 3)):
            rows[y][x] = '#'
        if front:
            for x in range(w - 1 - 2, w):
                rows[y][x] = '#'
    mask = [''.join(r) for r in rows]
    cover = shaded(mask, HOOD[1:5], '#14121a', light=(0.25, -0.45, 0.85))
    for y in range(h):
        for x in range(w):
            c = cover.get(x, y)
            if not c:
                continue
            # Next to the face: the hood's shadowed inside, not an outline.
            by_face = any(p.get(x + dx, y + dy) and not cover.get(x + dx, y + dy)
                          for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            p.set(x, y, HOOD[5] if (c == '#14121a' and by_face) else c)
    return p


KIT = [
    *skin(PALE, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, WHITE5)),
    recolor(SHIN, ramp(SHIN_SKIN, WHITE5[1:4])),
    recolor(SHOES, RED_SHOE),
    recolor(HAND, {**RED_GLOVE, '#ffcb84': '#ff5a4a', '#a56531': '#901410'}),
    # A black armband on her left forearm only; the right one bare.
    recolor(FOREARM, {WRIST[0]: PALE[2], WRIST[1]: PALE[3], WRIST[2]: PALE[3]}) | {'on': 'right'},
]
# Athletic and light: fitted clothes (the trousers' panels still need the thighs drawn).
PLAN_LEGS = {'thigh': 0}
PLAN = {'chest': 0, 'torso': 0}


def panels(sling):
    """Black panels down the outside of the white trousers; the red sling across the chest."""
    def paint(id_, p):
        if id_ in (49, 50, 51, 52, 53, 54, 55, 56) and p.h > 6:
            for y in range(2, p.h - 2):
                x = 1 + (y * 2) // p.h
                if p.get(x, y):
                    p.set(x, y, '#26262e')
                if p.get(x + 1, y) and y % 3:
                    p.set(x + 1, y, '#3a3a44')
        if sling and id_ == 57:
            for i in range(9):
                x, y = 2 + i, 3 + i
                if p.get(x, y):
                    p.set(x, y, INK if i % 3 else '#16161c')
        return p
    return paint


def make(look_id, rules, plan, k0, k0_right, front, sling=False, accent='#e5332a'):
    pal = Palette({'k': '#14121a', 'r': INK, 'n': '#5a5e6a'})
    all_rules = KIT + rules
    look = {'id': look_id, 'base': 0, 'accent': accent, '_raw_heads': True, 'recolor': all_rules,
            'parts': dict(no_ponytail())}
    write_parts(look, outfit_parts(0, all_rules, {**PLAN_LEGS, **plan}, panels(sling)), pal)
    look['parts']['25'] = pal.rows(k0)
    look['parts']['25:right'] = pal.rows(k0_right)
    look['parts']['29'] = pal.rows(front)
    look['palette'] = pal.pal
    path = write_look('vera', look)
    rotate(path, [25, '25:right'])
    preview(look_id)


make('vera-tank', [
    recolor(CHEST, ramp(SHIRT, BLACK)),
    recolor(TORSO, ramp(PALE, [BLACK[0], BLACK[0], BLACK[1], BLACK[2], BLACK[2]])),
    recolor(TORSO, {BELT[0]: '#5a5e6a', BELT[1]: '#16161c'}),
], PLAN, faith(), faith(tattoo=True), faith(True, True))
make('vera-vest', [
    recolor(CHEST, ramp(SHIRT, BLACK)),
    recolor(TORSO, ramp(PALE, [BLACK[0], BLACK[0], BLACK[1], BLACK[2], BLACK[2]])),
    recolor(TORSO, {BELT[0]: INK, BELT[1]: '#16161c'}),
    recolor(UPPER_ARM, ramp(PALE, ['#3a3a44', '#3a3a44', '#26262e', '#16161c', '#16161c'])),
], {**PLAN, 'chest': 1, 'upper-arm': 1}, faith(), faith(tattoo=True), faith(True, True), sling=True)
make('vera-hood', [
    recolor(CHEST, ramp(SHIRT, ['#e8e8ec', INK, '#a01c18'])),
    recolor(UPPER_ARM, ramp(PALE, ['#3a3a44', '#3a3a44', '#26262e', '#16161c', '#16161c'])),
    recolor(TORSO, ramp(PALE, ['#e8e8ec', '#e8e8ec', '#c8c8cc', INK, '#a01c18'])),
    recolor(THIGH, ramp(SHORTS, ['#3a3a44', '#2c2c34', '#26262e', '#1c1c22', '#16161c'])),
], {**PLAN, 'chest': 1, 'upper-arm': 1, 'forearm': 1}, hooded(), hooded(), hooded(True), accent='#e5332a')

pal = Palette()
sheet('vr-heads.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(3), faith(), faith(tattoo=True), hooded(),
                                                            faith(True, True), hooded(True))], scale=9)
print('vera looks written')
