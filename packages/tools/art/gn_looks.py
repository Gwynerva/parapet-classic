"""Granger's looks: the calm girl's face (3) with short spiky hair and goggles (over the eyes, or
pushed up); a roomy flight jacket with a fur collar, white bracers, black gloves; thin legs in
leggings with a harness strap, white trainers; and the accelerator, a glowing disc that stands
out from her chest."""
from lookgen import *
from heads import Pic, Palette, skin_tones, shaded, rim, neat_mouth
from body import outfit_parts, write_parts
from gridpng import sheet

FAIR = ['#fff0e2', '#fcdcc0', '#ecbc98', '#cc9a78', '#9a6a50']
HEAD_SKIN = ['#fff4e8', '#fde4cc', '#f4ccac', '#e2b090', '#c89274', '#a07058', '#7a5242']
KEEP = ['#dee3e7', '#fff7de', '#ad4d21', '#634931', '#4a3c29', '#7b1008', '#a50800', '#d6be9c']
JACKET = ['#a0784a', '#7a5832', '#523a20']
NAVY = ['#4a5878', '#34405c', '#222a40']
CYAN = '#3fd2ff'
FRAME = {'k': '#1e1814', 'q': '#e8ecf2', 'Q': '#9aa2ae', 's': '#2a2a30'}


def spiky(hair, front=False):
    """Short spiky hair: the long hair at the back cut off, spikes over the crown."""
    p = Pic.orig(3, front)
    skin_tones(p, HEAD_SKIN, keep=KEEP)
    dark, mid, light = hair
    p.recolor({'#000000': mid, '#182421': dark, '#422c29': light, '#7b1008': '#c07a70', '#a50800': '#d89088'})
    neat_mouth(p, front, '#b0645c', '#dc9a90', HEAD_SKIN[2])
    hair_cs = {dark, mid, light}
    if light == '#ffffff':
        rim(p, list(hair_cs), '#8a8e9a')
    if not front:
        for y in range(11, p.h):
            for x in range(0, 9):
                if p.get(x, y) in hair_cs:
                    p.set(x, y, None)
    else:
        for y in range(12, p.h):
            for x in list(range(0, 3)) + list(range(14, p.w)):
                if p.get(x, y) in hair_cs:
                    p.set(x, y, None)
    p.pad(top=3)
    tips = [(2, 4), (5, 2), (8, 1), (11, 1), (14, 3)] if not front else [(3, 3), (6, 1), (9, 0), (12, 1), (15, 3)]
    for tx, ty in tips:
        for i in range(4 - ty % 2):
            y = ty + i
            for x in range(tx - i // 2, tx + 1 + i // 2):
                if p.get(x, y) is None:
                    p.set(x, y, light if i == 0 else (mid if (x + y) % 2 else dark))
    return p


def goggles(p, lens, on_eyes, front=False):
    """The goggles: a white frame, a tinted lens, a dark strap round the head."""
    leg = {**FRAME, 'v': lens, 'V': '#ffe0b0'}
    if not front:
        y0 = 3 + (7 if on_eyes else 3)
        p.paint(['sssssss..kqqqqqqqk', 'sssssss..qvVvvvvvq', '.........qvvvvvvvq', '.........kqqqqqqqk'], leg, 0, y0, only_on='s')
    else:
        y0 = 3 + (8 if on_eyes else 3)
        p.paint(['.kqqqqqkqqqqqqk.', '.qvVvvvqvVvvvvq.', '.qvvvvvqvvvvvvq.', '.kqqqqqkqqqqqqk.'], leg, 1, y0)
    return p


def head(hair, lens, on_eyes, front=False):
    return goggles(spiky(hair, front), lens, on_eyes, front)


def reactor(front=False):
    """The accelerator: a white ring round a glowing core, at the front of the chest (3 px ahead
    of its middle; in the middle seen from the front)."""
    disc = ['.qqq.', 'qcCcq', 'qCwCq', 'qcCcq', '.qqq.']
    leg = {'q': '#e8ecf2', 'c': CYAN, 'C': '#bff4ff', 'w': '#ffffff'}
    p = Pic.text(disc, leg).pad(0, 0, 0, 1)
    if not front:
        p.pad(left=6)
    return p


def details(id_, p):
    """The fur collar at the neck; a harness strap round each thigh."""
    if id_ == 57:
        for x, y in ((3, 1), (4, 1), (3, 2), (4, 2), (5, 2), (4, 3), (5, 3)):
            if p.get(x, y):
                p.set(x, y, '#ecdcbc' if (x + y) % 2 else '#d4c09a')
    if 49 <= id_ <= 56 and p.h > 8:
        y = p.h // 2
        for x in range(p.w):
            if p.get(x, y):
                p.set(x, y, '#2a2a30')
    return p


# A roomy jacket over thin legs in leggings.
PLAN = {'chest': 1, 'upper-arm': 1, 'forearm': 1, 'thigh': -1}


def make(id_, hair, lens, legs, jacket, on_eyes, accent):
    rules = [
        *skin(FAIR, ARMS + HAND + CHEST + TORSO, with_shins=False),
        recolor(CHEST, ramp(SHIRT, jacket)),
        recolor(TORSO, ramp(FAIR, [jacket[0], jacket[0], jacket[1], jacket[2], jacket[2]])),
        recolor(TORSO, {BELT[0]: '#2a2a30', BELT[1]: '#16161c'}),
        recolor(UPPER_ARM, ramp(FAIR, [jacket[0], jacket[0], jacket[1], jacket[2], jacket[2]])),
        recolor(FOREARM, {**ramp(FAIR, ['#ffffff', '#e8ecf2', '#c4ccd6', '#9aa2ae', '#6a7482']),
                          WRIST[0]: CYAN, WRIST[1]: '#2a8ab0', WRIST[2]: '#9aa2ae'}),
        recolor(HAND, {**ramp(FAIR, ['#4a4a52', '#3a3a42', '#2a2a30', '#1c1c22', '#121216']),
                       '#ffcb84': '#3a3a42', '#a56531': '#1c1c22'}),
        recolor(TORSO + THIGH + KNEE, ramp(SHORTS, legs)),
        recolor(SHIN, ramp(SHIN_SKIN, legs[1:4])),
        recolor(SHOES, {**ramp(SHOE['main'], ['#e8ecf2', '#c4ccd6', '#9aa2ae']), '#d64908': '#c4ccd6',
                        '#fffbe7': legs[1], '#d6cbb5': '#6a7482', '#8c8273': '#4a5260'}),
    ]
    pal = Palette({'k': '#1e1814'})
    look = {'id': id_, 'base': 0, 'accent': accent, '_raw_heads': True, 'recolor': rules,
            'parts': dict(no_ponytail())}
    write_parts(look, outfit_parts(0, rules, PLAN, details), pal)
    look['parts']['25'] = pal.rows(head(hair, lens, on_eyes))
    look['parts']['29'] = pal.rows(head(hair, lens, on_eyes, True))
    look['attachments'] = {'reactor': {'layer': 'over', 'sprites': {'57': pal.rows(reactor()),
                                                                     '61': pal.rows(reactor(True))}}}
    look['palette'] = pal.pal
    path = write_look('granger', look)
    rotate(path, [25, 'reactor@57'])
    preview(id_)
    return pal


BROWN = ('#2a1a10', '#3a2618', '#5e3e26')
make('classic', BROWN, '#ff9a2a', ['#ffb04a', '#ff9a2a', '#e8801a', '#c06414', '#8a460c'], JACKET, True, '#ff9a2a')
make('pink', BROWN, '#ff5ab4', ['#ff8ad0', '#ff5ab4', '#e83a9a', '#b8247a', '#801650'], JACKET, True, '#ff5ab4')
pal = make('silver', ('#c8ccd6', '#e4e6ee', '#ffffff'), '#ff6ab8',
           ['#5a6478', '#4a5468', '#3a4458', '#2c3446', '#1e2432'], NAVY, False, CYAN)
sheet('gn-heads.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(3), head(BROWN, '#ff9a2a', True),
                                                            head(BROWN, '#ff9a2a', True, True),
                                                            head(('#c8ccd6', '#e4e6ee', '#ffffff'), '#ff6ab8', False))], scale=9)
print('granger looks written')
