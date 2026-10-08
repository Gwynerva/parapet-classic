"""Grove's look: the shaved man's head (7) darker, with a buzz cut and a thin goatee, his lips
shut; strong bare arms, a white tank top on a broad chest, baggy light jeans down to the shoes,
a brown belt, black sneakers with white stripes, and a green bandana from the back pocket."""
from lookgen import *
from heads import Pic, Palette, skin_tones, by_light
from body import outfit_parts, write_parts
from gridpng import sheet

SKIN_DARK = ['#b07a52', '#8f5c3a', '#734528', '#56301a', '#381c0e']
HEAD_SKIN = ['#c48e64', '#a6704a', '#8a5636', '#6e4026', '#542e1a', '#3c1e10']
TANK = ['#f6f6f2', '#d9d9d2', '#a7a79e']
JEANS = ['#a9c6e3', '#86a8cf', '#6688b3', '#4d6c94', '#374f6e']
BUZZ = ['#3a2c24', '#2a1e18', '#1c140f', '#120c09']
TEETH = ['#dee3e7', '#fff7de']

HAIR_K0 = [
    '................',
    '....########....',
    '...##########...',
    '..############..',
    '..###########...',
    '..#######.......',
    '..#####.........',
    '..####..........',
    '..###...........',
    '..##............',
]
HAIR_FRONT = [
    '................',
    '.....######.....',
    '....########....',
    '....#########...',
    '...###########..',
    '...##.......##..',
    '...#.........#..',
]


def cj(front=False):
    p = Pic.orig(7, front)
    eye_dark = p.where(['#000000', '#082418', '#391808'])
    skin_tones(p, HEAD_SKIN, keep=TEETH)
    mask = HAIR_FRONT if front else HAIR_K0
    pts = [(x, y) for y, r in enumerate(mask) for x, ch in enumerate(r) if ch == '#' and p.get(x, y)]
    # The buzz cut: the skull's own light and shade, in short dark hair.
    cs = sorted({p.get(x, y).lower() for x, y in pts}, key=lambda c: sum(int(c[i:i + 2], 16) for i in (1, 3, 5)), reverse=True)
    for x, y in pts:
        i = cs.index(p.get(x, y).lower())
        p.set(x, y, BUZZ[round(i * (len(BUZZ) - 1) / max(1, len(cs) - 1))])
    # Lips shut over the grin, a thin moustache, a goatee.
    # (The teeth share their colour with the eyes' whites: only the mouth's rows.)
    lips = {'#dee3e7': '#5a2e22', '#fff7de': '#6e3a2a'}
    for y in range(11, p.h):
        for x in range(p.w):
            c = p.get(x, y)
            if c and c.lower() in lips:
                p.set(x, y, lips[c.lower()])
    if not front:
        for x, y in ((12, 11), (13, 11), (14, 11), (11, 14), (12, 14), (11, 15), (12, 15), (13, 15)):
            if p.get(x, y):
                p.set(x, y, '#1c120c')
    else:
        for x, y in ((8, 11), (9, 11), (10, 11), (11, 11), (12, 11), (9, 14), (10, 14), (9, 15), (10, 15), (11, 15)):
            if p.get(x, y):
                p.set(x, y, '#1c120c')
    for x, y in eye_dark:
        p.set(x, y, '#0c0806')
    return p


RULES = [
    *skin(SKIN_DARK, ARMS + HAND + CHEST + TORSO, with_shins=False),
    # The wristband is skin: bare arms.
    recolor(FOREARM, {WRIST[0]: SKIN_DARK[2], WRIST[1]: SKIN_DARK[3], WRIST[2]: SKIN_DARK[4]}),
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, TANK)),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, JEANS)),
    recolor(SHIN, ramp(SHIN_SKIN, JEANS[1:4])),
    recolor(TORSO, {BELT[0]: '#8a5a2e', BELT[1]: '#4a2e14'}),
    recolor(SHOES, {**ramp(SHOE['main'], ['#2a2a2e', '#1c1c20', '#101014']), '#d64908': '#1c1c20',
                    '#d6cbb5': '#e8e8e8', '#8c8273': '#b8b8b8'}),
]
# Strong arms, a broad chest, baggy jeans.
PLAN = {'chest': 1, 'torso': 1, 'upper-arm': 1, 'forearm': 1, 'thigh': 2, 'knee': 2, 'shin': 2}


def bandana():
    return ['ggG', 'gGg', 'Ggg', 'gGg', 'Gg.', 'g..']


pal = Palette({'k': '#1c120c', 'g': '#3fae4c', 'G': '#2a7a34'})
look = {'id': 'grove-tank', 'base': 1, 'accent': '#3fae4c', '_raw_heads': True, 'recolor': RULES}
write_parts(look, outfit_parts(1, RULES, PLAN), pal)
look['parts']['25'] = pal.rows(cj())
look['parts']['29'] = pal.rows(cj(True))
look['ribbons'] = {'bandana': {'anchor': 'hips', 'offset': [4, 3], 'texture': bandana(), 'segments': 2,
                               'gravity': 300, 'drag': 2.2}}
look['palette'] = pal.pal
path = write_look('grove', look)
rotate(path, [25])
preview('grove-tank')
sheet('gr-heads.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(7), cj(), Pic.orig(7, True), cj(True))], scale=10)
print('grove look written')
