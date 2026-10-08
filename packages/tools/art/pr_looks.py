"""Pierre's looks, after the photos: the boyish round face of the orange-haired runner (1), the
hair gone light brown; an ordinary build in roomy clothes. The swordsman (navy V-neck tee, black
joggers, knitted slippers, a longsword on the back), the fencer (sleeveless top, two training
swords), the rebel (an oversized maroon tee with a sprayed A, hair wet and dishevelled), the
undercover one (a white bob wig, a black cardigan over a white shirt, dark jeans, white gloves,
headphones round the neck, a katana)."""
from lookgen import *
from heads import Pic, Palette, skin_tones, by_light, lum
from body import outfit_parts, write_parts
from gridpng import sheet

FAIR = ['#fff0e4', '#fcdcc6', '#eebca0', '#cc9a80', '#9a6a58']
HEAD_SKIN = ['#fff4ea', '#fde4d0', '#f6ceb4', '#e6b498', '#cc967c', '#a87660', '#7e5646']
EYES = ['#52a6ef', '#2175bd', '#000400', '#fff7de', '#fff7d6', '#efdfc6']
BROWN = ['#b08458', '#94693f', '#7a5232', '#5e3e24', '#462c18', '#2e1c10']
WET = ['#8a6440', '#6e4c2e', '#563a22', '#402a18', '#2c1c10', '#1e120a']
WIG = ['#ffffff', '#f2f2f6', '#e2e2ea', '#ccccd6', '#b0b2be', '#8e909e']


def is_hair(c):
    """The runner's orange hair: strongly orange, nothing blue in it."""
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return b < 0x20 and r > g * 1.3


def petr(ramp, front=False):
    p = Pic.orig(1, front)
    hair = [c for c in p.colours() if is_hair(c)]
    by_light(p, hair, ramp)
    skin_tones(p, HEAD_SKIN, keep=EYES + [c.lower() for c in ramp])
    return p


def wet(front=False):
    """After training: darker, strands stuck down over the forehead."""
    p = petr(WET, front)
    for x, y in ((12, 4), (12, 5), (14, 3), (14, 4), (10, 5)) if not front else ((5, 4), (5, 5), (8, 4), (8, 5), (11, 4)):
        if p.get(x, y):
            p.set(x, y, WET[3])
    return p


def wig(front=False):
    """The white bob wig: down to the jaw, a long fringe over one eye."""
    p = petr(WIG, front).pad(bottom=2)
    leg = {'w': WIG[1], 'W': WIG[3], 'k': WIG[5]}
    if not front:
        p.paint(['kWwW....', 'kWwwW...', 'kWwWw...', 'kWwwW...', '.kWwW...', '.kWWk...', '..kk....'], leg, 0, 10)
    else:
        p.paint(['kWw..........wWk', 'kWw..........wWk', 'kWwW........WwWk', '.kWW........WWk.', '..kk........kk..'],
                leg, 0, 10)
    return p


def sword_rows(w, h, hilt, guard, sheath, lean=0):
    """A sheathed sword slung along the back (drawn behind the body, centred on the chest's
    point): the grip up over the shoulder behind the head, the blade down the back to the hips
    (facing right the back is on the left)."""
    c = Canvas(w, h)
    top, tip = 4 + lean, 9 + lean
    c.line(top + 1, 4, tip + 1, h - 1, sheath)
    c.line(top + 2, 4, tip + 2, h - 1, sheath)
    c.line(top - 1, 0, top + 1, 4, hilt)
    c.line(top, 0, top + 2, 4, hilt)
    c.line(top - 2, 4, top + 4, 3, guard)
    return c.rows()


SWORDS = {'X': '#c9ced6', 'x': '#6a7482', 'Y': '#e8c84a', 'y': '#2a2a20', 'Z': '#1c1c22', 'z': '#e8e8ee'}
twin = Canvas(24, 20)
twin.paste(sword_rows(24, 20, 'y', 'Y', 'Y'), 0, 0)
twin.paste(sword_rows(24, 20, 'Y', 'y', 'y', lean=3), 0, 0)

NAVY = ['#3a4a78', '#2a3660', '#1c2444']
BLACK5 = ['#3a3a40', '#2c2c32', '#202026', '#16161a', '#0e0e12']
MAROON = ['#9a5a64', '#7a4048', '#5a2a32']
MESH = ['#8a6a5a', '#6a4e42', '#4a3830']
JEANS = ['#3a4a70', '#2c3a5c', '#222c48', '#182036', '#101626']

KIT = [
    *skin(FAIR, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(FOREARM, {WRIST[0]: FAIR[2], WRIST[1]: FAIR[3], WRIST[2]: FAIR[3]}),
]


def pants(ramp5):
    return [recolor(TORSO + THIGH + KNEE, ramp(SHORTS, ramp5)), recolor(SHIN, ramp(SHIN_SKIN, ramp5[1:4]))]


SLIPPERS = recolor(SHOES, {**ramp(SHOE['main'], ['#c8b040', '#5a6a30', '#2a2a20']), '#d64908': '#5a6a30',
                           '#fffbe7': '#e8d870', '#d6cbb5': '#2a2a20', '#8c8273': '#1a1a14'})
BLACK_SHOES = recolor(SHOES, {**ramp(SHOE['main'], ['#3a3a40', '#26262c', '#16161a']), '#d64908': '#26262c',
                              '#fffbe7': '#e8e8ee', '#d6cbb5': '#e8e8ee', '#8c8273': '#b8bcc8'})
WHITE_SHOES = recolor(SHOES, {**ramp(SHOE['main'], ['#f4f4f6', '#dcdce2', '#b8bcc8']), '#d64908': '#dcdce2'})
# An ordinary build in roomy clothes: tees a size up, joggers.
ROOMY = {'chest': 1, 'upper-arm': 1, 'torso': 1, 'thigh': 1, 'knee': 1, 'shin': 1}


def chest_paint(kind):
    def paint(id_, p):
        if id_ == 61:
            return front_paint(p)
        if id_ != 57:
            return p
        if kind == 'vneck':
            for x, y in ((4, 2), (5, 3), (6, 4), (7, 3), (8, 2)):
                if p.get(x, y):
                    p.set(x, y, '#9aa0aa')
        if kind == 'anarchy':
            for x, y in ((6, 5), (5, 6), (7, 6), (5, 7), (6, 7), (7, 7), (8, 7), (4, 8), (8, 8), (4, 9), (9, 9),
                         (3, 7), (3, 8), (4, 10), (5, 10), (9, 10), (10, 8)):
                if p.get(x, y):
                    p.set(x, y, '#141418')
        if kind == 'shirt':
            for y in range(4, 12):
                for x in (6, 7, 8):
                    if p.get(x, y):
                        p.set(x, y, '#e8e8ee' if x != 8 else '#c8c8d0')
            # Headphones round the neck.
            for x, y in ((3, 2), (4, 3), (5, 3), (6, 3), (7, 2)):
                if p.get(x, y):
                    p.set(x, y, '#2a3660')
            for x, y in ((3, 3), (7, 3)):
                if p.get(x, y):
                    p.set(x, y, '#5a6a9a')
        return p

    def front_paint(p):
        """Seen from the front: the same, centred on the chest."""
        cx = p.w // 2
        if kind == 'vneck':
            for dx, y in ((-2, 2), (-1, 3), (0, 4), (1, 3), (2, 2)):
                if p.get(cx + dx, y):
                    p.set(cx + dx, y, '#9aa0aa')
        if kind == 'anarchy':
            for dx, y in ((0, 5), (-1, 6), (1, 6), (-1, 7), (1, 7), (-2, 8), (-1, 8), (0, 8), (1, 8), (2, 8),
                          (-2, 9), (2, 9), (-3, 10), (3, 10), (-3, 7), (3, 7), (-2, 11), (2, 11), (-1, 12), (0, 12), (1, 12)):
                if p.get(cx + dx, y):
                    p.set(cx + dx, y, '#141418')
        if kind == 'shirt':
            for y in range(4, p.h - 2):
                for dx in (-1, 0, 1):
                    if p.get(cx + dx, y):
                        p.set(cx + dx, y, '#e8e8ee' if dx else '#c8c8d0')
            for dx, y in ((-3, 2), (-2, 3), (-1, 3), (1, 3), (2, 3), (3, 2)):
                if p.get(cx + dx, y):
                    p.set(cx + dx, y, '#2a3660')
        return p
    return paint


def make(id_, rules, plan, head, chest, attachments, accent='#a96bff'):
    pal = Palette({'k': '#1e1612'})
    all_rules = KIT + rules
    look = {'id': id_, 'base': 1, 'accent': accent, '_raw_heads': True, 'recolor': all_rules, 'parts': {}}
    write_parts(look, outfit_parts(1, all_rules, plan, chest_paint(chest)), pal)
    look['parts']['25'] = pal.rows(head())
    look['parts']['29'] = pal.rows(head(True))
    if attachments:
        look['attachments'] = {
            name: {'layer': 'back', 'sprites': {'57': [''.join(ch if ch == '.' else pal.char(SWORDS[ch]) for ch in r)
                                                       for r in rows]}}
            for name, rows in attachments.items()
        }
    look['palette'] = pal.pal
    path = write_look('pierre', look)
    rotate(path, [25] + [f'{n}@57' for n in attachments])
    preview(id_)
    return pal


brown = lambda f=False: petr(BROWN, f)
make('swordsman', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, NAVY)),
    recolor(UPPER_ARM, ramp(FAIR, [NAVY[0], NAVY[0], NAVY[1], NAVY[2], NAVY[2]])),
    recolor(TORSO, {BELT[0]: '#f0f0f0', BELT[1]: '#0e0e12'}),
    *pants(BLACK5), SLIPPERS,
], ROOMY, brown, 'vneck', {'sword': sword_rows(24, 20, 'X', 'x', 'Z')})
make('fencer', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, MESH)), recolor(TORSO, {BELT[0]: '#2a2a30'}), *pants(BLACK5), BLACK_SHOES,
], {**ROOMY, 'upper-arm': 0}, brown, None, {'swords': twin.rows()})
make('rebel', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, MAROON)),
    recolor(UPPER_ARM, ramp(FAIR, [MAROON[0], MAROON[0], MAROON[1], MAROON[2], MAROON[2]])),
    recolor(TORSO, {BELT[0]: '#f0f0f0', BELT[1]: '#0e0e12'}),
    *pants(BLACK5), BLACK_SHOES,
], {**ROOMY, 'chest': 2, 'upper-arm': 2}, wet, 'anarchy', {})
pal = make('undercover', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, ['#2a2a34', '#1c1c24', '#121218'])),
    recolor(UPPER_ARM + FOREARM, ramp(FAIR, ['#2a2a34', '#2a2a34', '#1c1c24', '#121218', '#121218'])),
    recolor(FOREARM, {WRIST[0]: '#3ac060', WRIST[1]: '#2a9048', WRIST[2]: '#1c6a34'}) | {'on': 'left'},
    recolor(FOREARM, {WRIST[0]: '#2a2a34', WRIST[1]: '#1c1c24', WRIST[2]: '#121218'}) | {'on': 'right'},
    recolor(HAND, {**ramp(FAIR, ['#ffffff', '#f4f4f6', '#e0e0e6', '#c4c4cc', '#9a9aa4']), '#ffcb84': '#f4f4f6',
                   '#a56531': '#c4c4cc'}),
    recolor(TORSO, {BELT[0]: '#c9ced6', BELT[1]: '#0e0e12'}),
    *pants(JEANS), WHITE_SHOES,
], {'chest': 1, 'upper-arm': 1, 'forearm': 1, 'torso': 1}, wig, 'shirt',
    {'katana': sword_rows(24, 20, 'z', 'x', 'Z')})
sheet('pr-heads.png', [(pal.rows(p), pal.pal) for p in (Pic.orig(1), brown(), wet(), wig(), brown(True), wig(True))], scale=9)
print('pierre looks written')
