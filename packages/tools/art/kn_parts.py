"""Sir Nobody's heavy plate: a great armet and every body part grown thick in steel."""
from heads import Pic, Palette, shaded
from body import body_parts, metal, dome
from gridpng import sheet

STEEL = ['#f6f9ff', '#d2d9e2', '#aab3c0', '#828c9a', '#5c6574', '#3c4350']
IRON = ['#9a9eaa', '#767a86', '#585c68', '#40434e', '#2c2e37', '#1c1d24']
OUTLINE = '#151820'

HELM_MASK = [
    '.......#####.......',
    '.....#########.....',
    '....###########....',
    '...#############...',
    '..###############..',
    '..################.',
    '.#################.',
    '.##################',
    '.##################',
    '.##################',
    '.##################',
    '.#################.',
    '.#################.',
    '..###############..',
    '..##############...',
    '...############....',
    '..##############...',
    '.################..',
    '..##############...',
]
HELM_FRONT_MASK = [
    '.......#####.......',
    '.....#########.....',
    '....###########....',
    '...#############...',
    '..###############..',
    '..###############..',
    '.#################.',
    '.#################.',
    '.#################.',
    '.#################.',
    '.#################.',
    '.#################.',
    '..###############..',
    '..###############..',
    '...#############...',
    '...#############...',
    '..###############..',
    '.#################.',
    '..###############..',
]


def helm(ramp, front=False, trim=None):
    p = shaded(HELM_FRONT_MASK if front else HELM_MASK, ramp, OUTLINE, light=(0.55, -0.6, 0.6))
    k, d, l, hi = OUTLINE, ramp[-2], ramp[1], ramp[0]
    leg = {'k': k, 'd': d, 'l': l, 'h': hi, 't': trim or ramp[2]}
    if not front:
        p.paint([
            '........hh.........',
            '.......h...........',
            '......h............',
            '.....h.............',
            '...................',
            '.........k.........',
            '.........kl........',
            '.........kkkkkkkkk.',
            '.........k........k',
            '.........kdkdkdkdk.',
            '.........k.........',
            '.........kld.d.d...',
            '.........k.........',
            '..ttttttttttttttt..',
            '...................',
            '...................',
            '...................',
            '.......h...........',
            '...................',
        ], leg)
    else:
        p.paint([
            '.........h.........',
            '.........h.........',
            '.........h.........',
            '.........h.........',
            '.........h.........',
            '.........l.........',
            '..kkkkkkkkkkkkkkk..',
            '..k.............k..',
            '..kkkkkkkkkkkkkkk..',
            '.........l.........',
            '...dkd.d.l.d.dkd...',
            '.........l.........',
            '...ttttttttttttt...',
            '...................',
            '...................',
            '...................',
            '...................',
            '........hh.........',
            '...................',
        ], leg)
    return p


def steel_rules(ramp):
    """Every colour of the male body to steel (light → dark)."""
    from lookgen import SKIN, HAND_EXTRA, MALE_SHIRT, SHORTS, SHIN_SKIN, WRIST, SHOE, BELT, ramp as rmp, recolor
    from lookgen import ARMS, HAND, CHEST, TORSO, THIGH, KNEE, SHIN, SHOES, FOREARM
    r5 = [ramp[0], ramp[1], ramp[2], ramp[3], ramp[4]]
    return [
        recolor(ARMS + HAND + CHEST + TORSO, {**rmp(SKIN, r5), **{c: r5[i] for c, i in HAND_EXTRA.items()}}),
        recolor(CHEST + TORSO, rmp(MALE_SHIRT, ramp[1:4])),
        recolor(TORSO + THIGH + KNEE, rmp(SHORTS, r5)),
        recolor(SHIN, rmp(SHIN_SKIN, ramp[1:4])),
        recolor(FOREARM, {WRIST[0]: ramp[1], WRIST[1]: ramp[3], WRIST[2]: ramp[5]}),
        recolor(SHOES, {**rmp(SHOE['main'], ramp[2:5]), '#d64908': ramp[3], '#fffbe7': ramp[1],
                        '#d6cbb5': ramp[3], '#8c8273': ramp[5]}),
    ]


PLAN = {'chest': 2, 'torso': 2, 'upper-arm': 2, 'forearm': 2, 'hand': 1, 'thigh': 2, 'knee': 2, 'shin': 2, 'shoe': 1}

if __name__ == '__main__':
    parts = body_parts(1, steel_rules(STEEL), PLAN)
    for k, p in list(parts.items()):
        i = int(k)
        if 57 <= i <= 61 or 34 <= i <= 38 or 17 <= i <= 24:
            parts[k] = dome(p, STEEL, OUTLINE)
        else:
            parts[k] = metal(p, STEEL, OUTLINE, segment=4 if not 39 <= i <= 48 else 3)
    pics = [helm(STEEL), helm(STEEL, True), helm(IRON, trim='#e8b84a')] + [parts[k] for k in ('57', '61', '34', '38', '5', '1', '17', '49', '62', '30', '39')]
    pal = Palette()
    sheet('kn-parts.png', [(pal.rows(p), pal.pal) for p in pics], scale=7, per_row=7)
    print('ok')
