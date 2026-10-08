"""Five's looks: her on the calm girl's face (3), magenta hair swept over with the side shaved;
him on the spiky man's (2), dark hair and a beard; both with a cyber line down the cheek, the
roomy leather jacket with its glowing high collar, a cybernetic right forearm; her in leather
trousers with knee pads, him in dark jeans."""
from lookgen import *
from heads import Pic, Palette, skin_tones, beard, rim, neat_mouth
from body import outfit_parts, write_parts
from gridpng import sheet

FAIR = ['#fbe2cc', '#f0c8a8', '#dca488', '#b47c64', '#80543e']
HEAD_SKIN = ['#fdecd8', '#f4d6bc', '#e6bea0', '#d0a284', '#b0826a', '#8a6250', '#68483a']
KEEP3 = ['#dee3e7', '#fff7de', '#ad4d21', '#634931', '#4a3c29', '#7b1008', '#a50800', '#d6be9c']
JACKET = ['#a0805a', '#7a5a3a', '#523a22']
TEE = ['#3a3a42', '#26262c', '#16161a']
LEATHER = ['#4a4a52', '#3a3a42', '#2c2c34', '#202026', '#16161a']
JEANS_DARK = ['#4a4a58', '#3a3a48', '#2c2c3a', '#20202c', '#16161e']
CYAN, CYAN_L = '#3fe8ff', '#bff8ff'


def her(front=False):
    p = Pic.orig(3, front)
    skin_tones(p, HEAD_SKIN, keep=KEEP3)
    p.recolor({'#000000': '#c8306e', '#182421': '#7e1a46', '#422c29': '#ff6aa8', '#7b1008': '#b0606a', '#a50800': '#c87a80'})
    neat_mouth(p, front, '#8a3a4a', '#b8606e', HEAD_SKIN[2])
    rim(p, ['#c8306e', '#7e1a46', '#ff6aa8'], '#5a1032')
    hair = {'#c8306e', '#7e1a46', '#ff6aa8', '#5a1032'}
    # The side shaved to stubble at the back (left of the upright profile).
    for y in range(7, 12 if not front else 14):
        for x in range(1, 5 if not front else 3):
            if p.get(x, y) in hair:
                p.set(x, y, ['#7a5a52', '#5e443e', '#9a3a62'][(x * 3 + y * 5) % 3])
    # The cyber line along the cheekbone to the jaw.
    for x, y in (((9, 11), (9, 12), (10, 13)) if not front else ((3, 11), (3, 12), (4, 13))):
        if p.get(x, y):
            p.set(x, y, CYAN if y % 2 else CYAN_L)
    return p


def him(front=False):
    p = Pic.orig(2, front)
    eye = ['#fff7de', '#fff3bd', '#291810']
    skin_tones(p, HEAD_SKIN, keep=eye)
    p.recolor({'#391808': '#2a1e1a', '#000400': '#120e0c', '#6b2c00': '#3a2a22', '#943c00': '#4a3628'})
    beard(p, 12, 18, 5, ['#4a3a30', '#3a2c24', '#2a201a'], keep=eye)
    for x, y in (((8, 9), (8, 10), (9, 11)) if not front else ((3, 9), (3, 10), (4, 11))):
        if p.get(x, y):
            p.set(x, y, CYAN if y % 2 else CYAN_L)
    return p


def collar(id_, p):
    """The jacket's high collar, glowing, at the neck of the upright chest."""
    if id_ == 57:
        for x, y in ((3, 2), (4, 2), (3, 3), (4, 3), (5, 3), (4, 4)):
            if p.get(x, y):
                p.set(x, y, CYAN if (x + y) % 2 else CYAN_L)
    if id_ in (62, 63, 64, 65):
        # Knee pads.
        for y in range(1, min(4, p.h)):
            for x in range(p.w):
                if p.get(x, y):
                    p.set(x, y, '#5a5a64' if (x + y) % 2 else '#3a3a42')
    return p


def rules(base, legs):
    return [
        *skin(FAIR, ARMS + HAND + CHEST + TORSO, with_shins=False),
        recolor(CHEST, ramp(SHIRT if base == 0 else MALE_SHIRT, TEE)),
        recolor(CHEST, {FAIR[1]: JACKET[0], FAIR[2]: JACKET[1]}),
        recolor(TORSO, ramp(FAIR, [JACKET[0], JACKET[0], JACKET[1], JACKET[2], JACKET[2]])),
        recolor(TORSO, ramp(MALE_SHIRT, JACKET)),
        recolor(TORSO, {BELT[0]: '#c9ced6', BELT[1]: '#0e0e12'}),
        recolor(UPPER_ARM, ramp(FAIR, [JACKET[0], JACKET[0], JACKET[1], JACKET[2], JACKET[2]])),
        # A cybernetic forearm on the right.
        recolor(FOREARM + HAND, {**ramp(FAIR, ['#c9ced6', '#9aa2ae', '#727a86', '#4e5560', '#2e333a']),
                                 '#ffcb84': '#9aa2ae', '#a56531': '#4e5560', WRIST[0]: CYAN, WRIST[1]: '#2a8ab0'}) | {'on': 'right'},
        recolor(FOREARM, {WRIST[0]: JACKET[1], WRIST[1]: JACKET[2], WRIST[2]: '#16161a'}) | {'on': 'left'},
        recolor(TORSO + THIGH + KNEE, ramp(SHORTS, legs)),
        recolor(SHIN, ramp(SHIN_SKIN, legs[1:4])),
        recolor(SHOES, {**ramp(SHOE['main'], ['#3a3a40', '#26262c', '#16161a']), '#d64908': '#26262c',
                        '#fffbe7': '#c9ced6', '#d6cbb5': '#16161a', '#8c8273': '#0e0e12'}),
    ]


def make(id_, base, head, plan, legs, accent):
    r = rules(base, legs)
    pal = Palette({'k': '#18121a'})
    look = {'id': id_, 'base': base, 'accent': accent, '_raw_heads': True, 'recolor': r,
            'parts': dict(no_ponytail()) if base == 0 else {}}
    write_parts(look, outfit_parts(base, r, plan, collar), pal)
    look['parts']['25'] = pal.rows(head())
    look['parts']['29'] = pal.rows(head(True))
    look['palette'] = pal.pal
    path = write_look('five', look)
    rotate(path, [25])
    preview(id_)
    return pal


make('five-her', 0, her, {'chest': 1, 'upper-arm': 1, 'thigh': -1, 'knee': 1}, LEATHER, '#ff2fa6')
pal = make('five-him', 1, him, {'chest': 1, 'upper-arm': 1, 'forearm': 1, 'thigh': 1, 'knee': 1, 'shin': 1},
           JEANS_DARK, CYAN)
sheet('fv-heads.png', [(pal.rows(p), pal.pal) for p in (her(), her(True), Pic.orig(2), him(), him(True))], scale=9)
print('five looks written')
