"""Rush B's looks: four attackers and four defenders on two kits. Heads on the pompadour man's
(9) and the spiky man's (2): a balaclava with an eye slit, sunglasses, a red bandana and a
beard, a gas mask, helmets. Bodies: a bulky tactical vest, cargo trousers, a holster on the
thigh, heavy boots; bare arms for the attackers, sleeves for the defenders."""
from lookgen import *
from heads import Pic, Palette, skin_tones, hood, beard, shaded
from body import outfit_parts, write_parts
from gridpng import sheet

SKIN_T = ['#f6d0aa', '#e8b896', '#d8a07c', '#b07a58', '#7a4e34']
HEAD_SKIN = ['#f8dcb6', '#ecc49a', '#dcaa80', '#c48e64', '#a2704c', '#7c5236', '#583820']
EYE9 = ['#fff3bd']
EYE2 = ['#fff7de', '#fff3bd', '#291810']
VEST = ['#3a3a42', '#26262c', '#16161a']
WOOL = ['#4a4a52', '#3a3a42', '#2c2c34', '#202026', '#16161a']
OUT = '#0c0c10'
BOOTS = {**ramp(SHOE['main'], ['#3a3a40', '#26262c', '#16161a']), '#d64908': '#26262c', '#fffbe7': '#4a4a52',
         '#d6cbb5': '#16161a', '#8c8273': '#0e0e12'}
CAMO = {
    'urban': ['#e0e0e4', '#5a5a62', '#b0b0b8', '#2a2a30', '#8a8a92'],
    'khaki': ['#c8a868', '#b09050', '#987838', '#7a6028', '#5a4418'],
    'woodland': ['#d8c070', '#6a5a2a', '#b89a48', '#3a3018', '#8a7838'],
    'arctic': ['#ffffff', '#c8ccd2', '#eef0f4', '#8a8e96', '#dcdfe4'],
    'black': ['#4a4a52', '#3a3a42', '#2c2c34', '#202026', '#16161a'],
    'gsg': ['#6a7aa8', '#56669a', '#44548a', '#344274', '#26305a'],
    'swat': ['#5a6a9a', '#4a5a8a', '#3c4a78', '#2e3a64', '#222c4e'],
    'green': ['#6a7a4a', '#5a6a3a', '#4a5a30', '#3a4826', '#2a361a'],
}


def face9(front=False):
    p = Pic.orig(9, front)
    skin_tones(p, HEAD_SKIN, keep=EYE9)
    return p


def face2(front=False):
    p = Pic.orig(2, front)
    skin_tones(p, HEAD_SKIN, keep=EYE2)
    return p


def balaclava(front=False):
    """Knitted black wool over all of the head but a slit for the eyes."""
    p = face9(front)
    slit = (lambda x, y: 7 <= y <= 9 and x >= 9) if not front else (lambda x, y: 7 <= y <= 9 and 2 <= x <= 13)
    mask = [''.join('#' if p.get(x, y) and not slit(x, y) else '.' for x in range(p.w)) for y in range(p.h)]
    cover = shaded(mask, WOOL, OUT, light=(0.4, -0.5, 0.75))
    for y in range(p.h):
        for x in range(p.w):
            if cover.get(x, y):
                p.set(x, y, cover.get(x, y))
    return p


def shades(front=False):
    p = face9(front)
    lens = [(x, 8) for x in range(10, 16)] if not front else [(x, 8) for x in range(2, 15) if x != 8]
    for x, y in lens:
        if p.get(x, y):
            p.set(x, y, '#101014')
    for x, y in ([(x, 7) for x in range(10, 16)] if not front else [(x, 7) for x in range(3, 14)]):
        if p.get(x, y):
            p.set(x, y, '#3a3a44')
    return p


BANDANA = ['#e04030', '#c02a24', '#9a1e1a', '#701410']


def bandana(front=False):
    """A red bandana tied over the hair, its knot's ends at the back, and a beard."""
    p = face2(front)
    beard(p, 12, 18, 5, ['#4a3426', '#3a281c', '#2a1c14'], keep=EYE2)
    q = hood(p, lambda y: -1, BANDANA, OUT, top=5, grow=0, light=(0.4, -0.6, 0.7))
    if not front:
        q.paint(['rR.', 'Rr.', '.R.'], {'r': BANDANA[1], 'R': BANDANA[2]}, 0, 5)
    return q


def gas_mask(front=False):
    p = balaclava(front)
    leg = {'o': '#7a8494', 'O': '#c4ccd8', 'k': OUT, 'f': '#5a6270', 'F': '#8a929e'}
    if not front:
        p.paint(['.kkkk', 'kOOok', 'kOooK'.replace('K', 'k'), '.kkkk'], leg, 10, 6)
        p.paint(['..kk..', '.kffk.', 'kfFFfk', 'kfFFfk', '.kffk.'], leg, 10, 11)
    else:
        p.paint(['.kkk..kkk.', 'kOok.kOok.', 'kook..kook', '.kk....kk.'], leg, 3, 6)
        p.paint(['..kkk..', '.kfFfk.', '.kfFfk.', '..kkk..'], leg, 5, 11)
    return p


def helmet(colours, front=False):
    """A helmet over the hair and the back of the head, a chin strap."""
    p = face9(front)
    edge = (lambda y: 8 if y < 11 else 6) if not front else (lambda y: 1)
    q = hood(p, edge, colours, OUT, top=6, grow=1, light=(0.5, -0.6, 0.6))
    strap = [(8, 12), (8, 13), (9, 14), (10, 15)] if not front else [(2, 12), (2, 13), (3, 14), (14, 12), (14, 13), (13, 14)]
    for x, y in strap:
        if q.get(x + 1, y + 1):
            q.set(x + 1, y + 1, '#2a2a30')
    return q


def kit_rules(long_sleeves):
    return [
        *skin(SKIN_T, ARMS + HAND + CHEST + TORSO, with_shins=False),
        recolor(CHEST + TORSO, ramp(MALE_SHIRT, VEST)),
        recolor(TORSO, {BELT[0]: '#5a5a62', BELT[1]: '#0e0e12'}),
        recolor(HAND, {**ramp(SKIN_T, ['#4a4a52', '#3a3a42', '#2c2c34', '#202026', '#16161a']), '#ffcb84': '#3a3a42',
                       '#a56531': '#202026'})
        if long_sleeves else recolor(FOREARM, {WRIST[0]: '#3a3a42', WRIST[1]: '#16161a', WRIST[2]: '#0e0e12'}),
        recolor(SHOES, BOOTS),
    ]


def holster(id_, p):
    """Pouches on the vest; a holster on the near thigh."""
    if id_ == 57:
        for x, y in ((6, 6), (7, 6), (6, 7), (7, 7), (6, 9), (7, 9), (6, 10), (7, 10)):
            if p.get(x, y):
                p.set(x, y, '#4a4a54' if y in (6, 9) else '#202026')
    if id_ == 53 and p.h > 8:
        for y in range(3, 8):
            for x in range(1, 4):
                if p.get(x, y):
                    p.set(x, y, '#16161a' if x == 1 or y == 3 else '#26262c')
    return p


def soldier(id_, head, camo, sleeves, long_sleeves, accent):
    s = CAMO[camo]
    rules = kit_rules(long_sleeves) + [recolor(TORSO + THIGH + KNEE, ramp(SHORTS, s)),
                                       recolor(SHIN, ramp(SHIN_SKIN, s[1:4]))]
    sleeve = ramp(SKIN_T, [sleeves[0], sleeves[0], sleeves[1], sleeves[2], sleeves[2]])
    rules.append(recolor(UPPER_ARM + (FOREARM if long_sleeves else []), sleeve))
    if long_sleeves:
        rules.append(recolor(FOREARM, {WRIST[0]: sleeves[1], WRIST[1]: sleeves[2], WRIST[2]: '#16161a'}))
    plan = {'chest': 1, 'torso': 1, 'thigh': 1, 'knee': 1, 'shin': 1}
    if long_sleeves:
        plan.update({'upper-arm': 1, 'forearm': 1})
    pal = Palette({'k': OUT})
    look = {'id': id_, 'base': 1, 'accent': accent, '_raw_heads': True, 'recolor': rules, 'parts': {}}
    write_parts(look, outfit_parts(1, rules, plan, holster), pal)
    look['parts']['25'] = pal.rows(head())
    look['parts']['29'] = pal.rows(head(True))
    look['palette'] = pal.pal
    path = write_look('rush-b', look)
    rotate(path, [25])
    preview(id_)
    return pal


soldier('balaclava', balaclava, 'urban', ['#2a3a6a', '#1e2a50', '#141c38'], False, '#e0a040')
soldier('shades', shades, 'khaki', ['#5a7a3a', '#46602c', '#344820'], True, '#c8a868')
soldier('bandana', bandana, 'woodland', ['#5a6a3a', '#46542c', '#344020'], False, '#c02a24')
soldier('arctic', balaclava, 'arctic', ['#eef0f4', '#c8ccd2', '#9aa0aa'], True, '#e8ecf4')
soldier('gas-mask', gas_mask, 'black', ['#3a3a42', '#2c2c34', '#202026'], True, '#7a8494')
soldier('helmet', lambda f=False: helmet(['#7a88b0', '#5a6a94', '#44548a', '#344274', '#26305a'], f), 'gsg',
        ['#56669a', '#44548a', '#344274'], True, '#c8a868')
soldier('blue-squad', lambda f=False: helmet(['#4a5a8a', '#3a4a78', '#2c3a64', '#222c4e', '#161e38'], f), 'swat',
        ['#4a5a8a', '#3c4a78', '#2e3a64'], True, '#4a6ab8')
pal = soldier('jungle', lambda f=False: helmet(['#8a9a5a', '#6a7a46', '#56663a', '#46542e', '#323e20'], f), 'green',
              ['#5a6a3a', '#4a5a30', '#3a4826'], True, '#6a8a3a')
sheet('rb-heads.png', [(pal.rows(h), pal.pal) for h in (balaclava(), shades(), bandana(), gas_mask(),
                                                         helmet(['#7a88b0', '#5a6a94', '#44548a', '#344274', '#26305a']),
                                                         balaclava(True), shades(True), bandana(True), gas_mask(True))],
      scale=8, per_row=5)
print('rush b looks written')
