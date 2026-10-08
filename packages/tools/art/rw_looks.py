"""Rewind's looks: the black-haired girl (3) gone chestnut, her hair a messy bob, freckled; a roomy grey hoodie over a pink
tee or a teal winter coat with a beanie; jeans; and always the messenger bag on its strap,
swinging at her hip."""
from lookgen import *
from heads import Pic, Palette, skin_tones, neat_mouth
from body import outfit_parts, write_parts
from gridpng import sheet

FAIR = ['#fff0dc', '#ffe0c0', '#f4c49c', '#d89a74', '#a86a4a']
HEAD_FAIR = ['#fff4e4', '#ffe6cc', '#f8d0aa', '#eab48c', '#d4966e', '#b4764e', '#8a5434']
EYE = ['#dee3e7', '#fff7de']
LIPS = ['#7b1008', '#a50800']
IRIS = ['#ad4d21', '#634931', '#4a3c29']
# Soft chestnut: the strands close in tone, the lipstick gone natural.
HAIR = {'#000000': '#7a5030', '#182421': '#5e3a22', '#422c29': '#946238', '#7b1008': '#a05a4c', '#a50800': '#c47a68'}
JEANS = ['#7a94c0', '#647ea8', '#506a92', '#3c5476', '#2a3c58']
HOODIE = ['#b4a698', '#968878', '#76685a']
PINK = ['#f4a0b4', '#e07a94', '#b85a74']
COAT = ['#5aa090', '#3f8070', '#2c5e52']
GLOVE = ['#c88a48', '#a86a30', '#7a4a1c']
BEANIE = {'u': '#5a6a8a', 'U': '#7a8aaa', 'n': '#3e4a66', 'k': '#1e2232'}


def bob(front=False):
    p = Pic.orig(3, front)
    skin_tones(p, HEAD_FAIR, keep=EYE + LIPS + IRIS)
    p.recolor(HAIR)
    neat_mouth(p, front, '#b06a60', '#e0a090', HEAD_FAIR[2])
    # A few freckles over the nose and cheeks.
    for (x, y) in ([(11, 11), (13, 12), (10, 12)] if not front else [(6, 11), (7, 12), (11, 11), (12, 12)]):
        if p.get(x, y) and p.get(x, y).lower() not in EYE:
            p.set(x, y, '#c88a62')
    return p


def beanie(front=False):
    p = bob(front).pad(top=2)
    if not front:
        p.paint([
            '.....kkkkkkk.......',
            '...kkUUUUUUUkk.....',
            '..kUUuuuuuuuuUk....',
            '.kUuuuuuuuuuuuuk...',
            '.kuuuuuuuuuuuuuuk..',
            'kuuuuuuuuuuuuuuuk..',
            'knnnnnnnnnnnnnnnnk.',
            'knununununununununk',
            '.kkkkkkkkkkkkkkkkk.',
        ], BEANIE)
    else:
        p.paint([
            '......kkkkkkk......',
            '....kkUUUUUUUkk....',
            '...kUUuuuuuuuuUk...',
            '..kUuuuuuuuuuuuuk..',
            '..kuuuuuuuuuuuuuk..',
            '.kuuuuuuuuuuuuuuuk.',
            '.knnnnnnnnnnnnnnnk.',
            '.knununununununuk..',
            '..kkkkkkkkkkkkkkk..',
        ], BEANIE)
    return p


KIT_RULES = [
    *skin(FAIR, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, JEANS)),
    recolor(SHIN, ramp(SHIN_SKIN, JEANS[1:4])),
]
# A roomy top over slim jeans.
PLAN = {'chest': 1, 'upper-arm': 1, 'forearm': 1, 'torso': 1}


def bag_strap(pal, inner):
    """Paints the strap across the chest (and the tee showing under the open hoodie)."""
    def paint(id_, p):
        if id_ != 57:
            return p
        # The grown chest: the strap from the far shoulder down to the near hip.
        for i in range(10):
            x, y = 3 + i // 1, 3 + i
            if p.get(x, y):
                p.set(x, y, '#5a3418')
        if inner:
            for (x, y) in ((7, 5), (8, 6), (8, 7), (9, 8), (9, 9), (8, 9), (7, 10)):
                if p.get(x, y) and p.get(x, y) != '#5a3418':
                    p.set(x, y, inner)
        return p
    return paint


def bag():
    """The messenger bag on its strap: one stiff segment from the shoulder, swinging at the hip."""
    rows = ['..+..'] + ['..q..'] * 11 + [
        'qqqqq',
        'qQQQq',
        'qQyQq',
        'qbbbq',
        'qbbbq',
        '.qqq.',
    ]
    return {'anchor': 'back', 'offset': [-1, 0], 'texture': rows, 'segments': 1, 'stiffness': 0.6,
            'gravity': 380, 'drag': 2, 'layer': 'front'}


def make(look_id, rules, head, front, inner=None, accent='#4aa8ff'):
    pal = Palette({'k': '#1e2232', 'q': '#5a3418', 'Q': '#8a6a4a', 'b': '#6a4a32', 'y': '#d8b060'})
    all_rules = KIT_RULES + rules
    look = {'id': look_id, 'base': 0, 'accent': accent, '_raw_heads': True, 'recolor': all_rules,
            'parts': {k: v for k, v in no_ponytail().items()}}
    write_parts(look, outfit_parts(0, all_rules, PLAN, bag_strap(pal, inner)), pal)
    look['parts']['25'] = pal.rows(head)
    look['parts']['29'] = pal.rows(front)
    look['ribbons'] = {'bag': bag()}
    look['palette'] = pal.pal
    path = write_look('rewind', look)
    rotate(path, [25])
    preview(look_id)


make('hoodie', [
    recolor(CHEST, ramp(SHIRT, HOODIE)),
    recolor(TORSO, {FAIR[0]: PINK[0], FAIR[1]: PINK[0], FAIR[2]: PINK[1], FAIR[3]: PINK[2], FAIR[4]: PINK[2]}),
    recolor(TORSO, {BELT[0]: '#3a2a20', BELT[1]: '#2a1a12'}),
    recolor(UPPER_ARM + FOREARM, ramp(FAIR, HOODIE[:1] + HOODIE + HOODIE[2:])),
    recolor(FOREARM, {WRIST[0]: HOODIE[1], WRIST[1]: HOODIE[2], WRIST[2]: '#5a4c40'}),
    recolor(SHOES, {**ramp(SHOE['main'], ['#c8ccd2', '#9aa0aa', '#6a707a']), '#d64908': '#9aa0aa'}),
], bob(), bob(True), inner=PINK[0])
make('beanie', [
    recolor(CHEST, ramp(SHIRT, COAT)),
    recolor(TORSO, ramp(FAIR, ['#ece4d8', COAT[0], COAT[1], COAT[2], COAT[2]])),
    recolor(TORSO, {BELT[0]: COAT[2], BELT[1]: '#1e403a'}),
    recolor(UPPER_ARM + FOREARM, ramp(FAIR, COAT[:1] + COAT + COAT[2:])),
    recolor(FOREARM, {WRIST[0]: COAT[1], WRIST[1]: COAT[2], WRIST[2]: '#1e403a'}),
    recolor(HAND, {**ramp(FAIR, GLOVE[:1] + GLOVE + GLOVE[2:]), '#ffcb84': GLOVE[0], '#a56531': GLOVE[2]}),
    recolor(SHOES, {**ramp(SHOE['main'], ['#7a5030', '#5a3820', '#3a2414']), '#d64908': '#5a3820', '#fffbe7': '#a87a50'}),
], beanie(), beanie(True), accent='#5aa090')
pal = Palette()
sheet('rw-heads.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(3), bob(), beanie(), bob(True), beanie(True))], scale=9)
print('rewind looks written')
