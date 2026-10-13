"""Petra's heads, drawn from scratch as pixel art after the owner's photos (her "twin brother",
pr_him_face.py, has the same face: the skin, the hazel eyes, the nose and the mouth of analysis.md).

One face for her four looks (FACE_P, the profile 25 facing right; FACE_F, the 3/4 face 29), neat
and feminine: a short lower face curving to a small chin, eyes 3 x 2 under a dark lash line with a
flick at the outer corner, thin groomed brows, a minimal nose, a small mouth in the look's lipstick,
a touch of blush. Lit from the upper front with soft broad light: few close skin tones, warmer and
redder in the shade, no dark pixels on the cheeks or the jaw, the edge a warm skin tone.

Each look paints its hair over the face (kate's own light-brown hair with golden strands and a low
bun; the mechanic's silver-grey wig with a blunt fringe, and her rose-amber glasses; the birthday
snapback over a silver-blue wig with a long side fringe; the evening's chestnut waves and gold clip).
The wigs' heads are 20 x 25, the face where it is on Blaise's 16 x 17 box. 76 / 77 blink, 78 winces."""
from heads import Pic

# The twins' skin (analysis.md, the same tones as his): highlight, light, mid, shade, deep shade,
# the cheeks' blush; shadows redder, the highlight yellower.
SKIN = {'W': '#fbe6d6', 'S': '#f3cdb4', 's': '#e2aa8e', 't': '#bf7f68', 'T': '#8e5446', 'r': '#e89a90'}
# Her eyes: the lash line, the white, the hazel iris (dark top, lighter hazel below), the catchlight;
# the groomed brows.
EYES = {'p': '#2a1612', 'P': '#7a4a3c', 'w': '#f8f2ee', 'I': '#3a2618', 'i': '#6a4a2c', 'j': '#fff6e6', 'b': '#9a6c48'}
LIPS = {
    'kate': {'n': '#a8464e', 'L': '#d97a72', 'l': '#eea296', 'o': '#fbc0b4'},
    'mechanic': {'n': '#a85a60', 'L': '#d8908e', 'l': '#ecb0aa', 'o': '#fbd0c8'},
    'birthday': {'n': '#2a0c18', 'L': '#6a2640', 'l': '#8a4462', 'o': '#a85a76'},
    'evening': {'n': '#6a0c18', 'L': '#b01e2c', 'l': '#d23a44', 'o': '#f07a78'},
}
HAIR = {
    'kate': {'0': '#3c2616', 'd': '#5c3c24', 'm': '#7c5434', 'h': '#9c7044', 'H': '#bc8e58', 'Y': '#d8ae6c',
             'y': '#f0d090'},
    'mechanic': {'0': '#3c3e48', 'd': '#666a76', 'm': '#8a8e9a', 'h': '#a8acb8', 'H': '#c4c8d0', 'Y': '#dcdee4',
                 'y': '#f2f4f6'},
    'birthday': {'0': '#34405a', 'd': '#62708e', 'm': '#8896b2', 'h': '#a8b6d0', 'H': '#c4d0e4', 'Y': '#dce4f0',
                 'y': '#f0f4fa', 'k': '#0c0c10', 'K': '#1a1a20', 'g': '#28282f', 'G': '#40404a', 'c': '#efe6c8',
                 'x': '#1a1612'},
    'evening': {'0': '#2a140c', 'd': '#4a2216', 'm': '#6c3422', 'h': '#8e4a2e', 'H': '#b0663e', 'Y': '#cc8a58',
                'y': '#e6b07c', 'g': '#f0c860', 'G': '#a87a22'},
}


def _check(rows, w=16):
    assert all(len(r) == w for r in rows), [(i, len(r)) for i, r in enumerate(rows) if len(r) != w]
    return rows


def over(base, rows, dy=0, h=None, dx=0, w=None):
    """`base` moved by (dx, dy) in a w x h box, then `rows` painted over ('.' keeps, '_' erases)."""
    h = h or len(base) + dy
    w = w or len(base[0]) + dx
    out = [['.'] * w for _ in range(h)]
    for y, r in enumerate(base):
        for x, c in enumerate(r):
            if 0 <= y + dy < h and 0 <= x + dx < w:
                out[y + dy][x + dx] = c
    for y, r in enumerate(rows):
        for x, c in enumerate(r[:w]):
            if c == '_':
                out[y][x] = '.'
            elif c != '.':
                out[y][x] = c
    return [''.join(r) for r in out]


# The profile, facing right, on Blaise's 16 x 17 box.
FACE_P = _check([
    '................',
    '................',
    '................',
    '.........sssS...',
    '........ssSSWS..',
    '........sssbbWS.',
    '........ssSSSSS.',
    '........sspssSS.',
    '.......SssspppS.',
    '......tstsswjIS.',
    '......tstsssIiSS',
    '......ttssssrst.',
    '.......tssSSStL.',
    '........tssSSSl.',
    '.........ttssS..',
    '.........tTTt...',
    '........ttT.....',
])

# The face turned to us (3/4, facing right): the near side on the left, the far side narrower.
FACE_F = _check([
    '................',
    '................',
    '................',
    '........sS......',
    '.....sSSWSS.....',
    '....sSSSWSSS....',
    '....ssbbSSbbss..',
    '...spsSSSSSSsp..',
    '...ssppPSSPppt..',
    '...ssjIwSSjIwt..',
    '...ssIiwSSIiwt..',
    '...srrSSSWtsrt..',
    '...ssSSSSsssst..',
    '....sSSSLLsst...',
    '....tsSSslst....',
    '.......tSSt.....',
    '.......tTt......',
])

KATE_P = [
    '.....000000.....',
    '...00hHHYYHh0...',
    '..0hHHYyyYHHh0..',
    '.0hHHYHHHYHHms..',
    '.0hHhHHHHHHms...',
    '0dhhHhHHHHms....',
    '0dhhhHhHHms.....',
    '0dmhhhHhms......',
    '0dmhhhm.........',
    '0dmmhm..........',
    '.0dmhm..........',
    '.0ddmd0.........',
    '0HYHHd0.........',
    '0HHhhd0T........',
    '0hhhdd0TT.......',
    '.00000TTT.......',
    '................',
]

KATE_F = [
    '.....000000.....',
    '...00HHYYm000...',
    '..0hHYyyHmYHh0..',
    '.0hHYyYHm.mHHh0.',
    '.0hHYHHm...mHh0.',
    '0hHHHm......mh0.',
    '0hHHm........mh0',
    '0hH...........h0',
    '0hmH..........d0',
    '0hmY.........hd0',
    '0dmH.........h0.',
    '0dmH.........m0.',
    '0dmh.........m0.',
    '.0dm.........m0.',
    '.0d0............',
    '..00............',
    '................',
]

# Faces in profile: eyes shut (76), half shut (77), screwed up (78), over the profile.
BLINK = {
    76: ['', '', '', '', '', '', '', '..........s', '...........sSS', '..........pppp', '...........sSS'],
    77: ['', '', '', '', '', '', '', '..........s', '...........sss', '..........pppp', '...........sIi'],
    78: ['', '', '', '', '', '...........SSW', '............SS', '..........sbbS', '...........sSS', '..........sppp',
         '...........sSS', '', '.............TL', '.............Tl'],
}

# --------------------------------------------------------------------------------- mechanic
# A long straight silver-grey wig down over the shoulders, its blunt fringe down to the brows;
# rimless glasses with rose-amber lenses and thin gold temples. 20 x 25: the face where it is
# on the 16 x 17 box (2 columns each side, 4 rows over and under).
MECH_P = [
    '....................',
    '....................',
    '....................',
    '.........0000.......',
    '.......00hHHH00.....',
    '......0hHHYYYHh0....',
    '.....0hHYyyYHHHh0...',
    '....0hHYYHHHHHHHh0..',
    '...0dhHHhHHHHHHHHm0.',
    '...0dhHhhHHhHHhHHm..',
    '..0dhhHhhHhmhHmhmm..',
    '..0dhhhHhhhms.......',
    '..0dhhhHhhhm........',
    '..0dhhhHhhhm........',
    '...0dhhHhhhm........',
    '...0dhhHhhm.........',
    '..0dhhhHhhm.........',
    '..0dhhhhHhm.........',
    '..0dhhHhhhhm........',
    '.0dhhHhhd0hm........',
    '.0dhhHhd0.Hm........',
    '..0dhHhd..hm........',
    '..0dhd0d..md........',
    '...0d0.0...d........',
    '....0...............',
]
MECH_F = [
    '....................',
    '....................',
    '....................',
    '........00m000......',
    '......00HHmhhh00....',
    '.....0HYYHmhHhhh0...',
    '....0HYyYHHmhYHhh0..',
    '...0hYyYHHHHmhYHhh0.',
    '..0hHYHHHHHHHhhHHhd0',
    '..0hHHhHHhHHhHHhhmd0',
    '..0hHhmHhhmHhhmhmmd0',
    '.0hHhmsssssssssshmd0',
    '.0hHhm..........hmd0',
    '.0hHhm..........hmd0',
    '0hhHhm..........hd0.',
    '0hhHhm..........hd0.',
    '.0hhHm..........hmd0',
    '.0hhHm..........hmd0',
    '.0hhHh..........hmd0',
    '0hdhHhm........mhhd0',
    '0hd0hHm........mhd0.',
    '0hd.0hd........hdhd0',
    '.0d.0hd........0d0d.',
    '..0..0d.........0.0.',
    '......0.............',
]


def tint(pic, pts, colour, a):
    """The pixels at `pts` seen through a tinted glass: mixed with `colour` by `a`."""
    t = [int(colour[i:i + 2], 16) for i in (1, 3, 5)]
    for x, y in pts:
        c = pic.get(x, y)
        if c:
            v = [int(c[i:i + 2], 16) for i in (1, 3, 5)]
            pic.set(x, y, '#%02x%02x%02x' % tuple(round(v[i] * (1 - a) + t[i] * a) for i in range(3)))
    return pic


GOLD = '#c8a464'
LENS = '#ec8c6c'
RIM = '#a4504a'


def glasses(pic, front, dx, dy):
    """Rimless rectangular glasses: each lens tints the eye and the skin behind it rose-amber (the
    eye shows through), its rim a stronger rose where the glass edge catches the colour, a 1-px
    glint on the upper outer corner of the lit lens; the thin gold bridge between the lenses and,
    in profile, the temple running back over the hair to the ear."""
    def lens(x0, x1, y0, y1, glint=None):
        inside = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
        tint(pic, [(x + dx, y + dy) for x, y in inside], LENS, 0.34)
        rim = [(x, y1) for x in range(x0, x1 + 1)] + [(x0, y) for y in range(y0, y1)] + [(x1, y) for y in range(y0, y1)]
        tint(pic, [(x + dx, y + dy) for x, y in rim], RIM, 0.3)
        if glint:
            pic.set(glint[0] + dx, glint[1] + dy, '#fffaf2')

    if front:
        lens(4, 7, 8, 11, glint=(4, 8))
        lens(10, 12, 8, 11)
        for x in (8, 9):
            pic.set(x + dx, 8 + dy, GOLD)
    else:
        lens(12, 14, 8, 11, glint=(14, 8))
        for x in (9, 10, 11):
            pic.set(x + dx, 8 + dy, GOLD)
    return pic


# --------------------------------------------------------------------------------- birthday
# A black snapback (flat brim, the cream "PROG RESS" patch) over a long straight silver-blue wig
# with a long side fringe.
BDAY_P = [
    '....................',
    '.......kkkkkk.......',
    '.....kkgGGGggkk.....',
    '....kgGGGggggggKk...',
    '...kgGggggggcccck...',
    '...kgggggggcxxcxk...',
    '..kKggggggggcxcxxk..',
    '..kKgggggggggcccck..',
    '..0kKKKKKKKKKKKKKKkk',
    '..0hkkkkkkkkkkkkkkkk',
    '..0dhHHhHHHYHHHm....',
    '..0dhHhhHhhHHm......',
    '..0dhHhhhHhhm.......',
    '..0dhHhhhHhhm.......',
    '...0dhHhhHhm........',
    '...0dhHhhHhm........',
    '..0dhhHhhhHm........',
    '..0dhhHhhhm.........',
    '..0dhhhHhhhm........',
    '.0dhhHhhd0hm........',
    '.0dhhHhd0.Hm........',
    '..0dhHhd..hm........',
    '..0dhd0d..md........',
    '...0d0.0...d........',
    '....0...............',
]
BDAY_F = [
    '....................',
    '......kkkkkk........',
    '....kkgGGGggkk......',
    '...kgGGGgcccckk.....',
    '..kgGGggcxxcxKKk....',
    '..kgGgggcxcxxKKk....',
    '..kgggggccccKKKk....',
    '..kKggggggggKKKkk...',
    '..kKKKKKKKKKKKKKKkk.',
    '..0kkkkkkkkkkkkkkkkk',
    '..0hHHYYHHHHHmhhd0..',
    '..0hHhmSsmHHHHHmhd0.',
    '.0hhHm....mHHHHmhd0.',
    '.0hhHm.......mHhhd0.',
    '0hhHhm........mhhd0.',
    '0hhHhm.........mhd0.',
    '.0hhHm..........hmd0',
    '.0hhHm..........hmd0',
    '.0hhHh..........hmd0',
    '0hdhHhm........mhhd0',
    '0hd0hHm........mhd0.',
    '0hd.0hd........hdhd0',
    '.0d.0hd........0d0d.',
    '..0..0d.........0.0.',
    '......0.............',
]

# ---------------------------------------------------------------------------------- evening
# Long chestnut hair in soft waves over the shoulders, a side part, a gold clip.
EVE_P = [
    '....................',
    '....................',
    '....................',
    '........00000.......',
    '......00hHHHH00.....',
    '.....0hHHYyyYHh0....',
    '....0hHHYYYHHHHm0...',
    '...0hHHHHHHHHHmS....',
    '...0hhHHhHHHHmS.....',
    '..0dhhhHHhhHmS......',
    '..0dhhhHHHhmS.......',
    '..0dhhHHgYm.........',
    '..0dhHHhGhm.........',
    '..0dhHhhhHm.........',
    '..0dhhhhHHm.........',
    '..0dhhHHHhm.........',
    '.0dhhHHhhm..........',
    '.0dhHHhhhm..........',
    '.0dhhhhHHmd.........',
    '..0dhhHHHmd.........',
    '..0dhHHhhm..........',
    '.0dhHHhhm...........',
    '.0dhhhhHm...........',
    '..0dhhHm0...........',
    '...0000.............',
]
EVE_F = [
    '....................',
    '....................',
    '....................',
    '.......000000.......',
    '.....00hHYYHHh00....',
    '....0hHYyyYHHHHh0...',
    '...0hHYYHHHHHhhhm0..',
    '..0hHHHmmHHHHhhmmd0.',
    '..0hHHm..mmHHhhmhhd0',
    '..0hHgm....mmhmmhhd0',
    '..0hHGm.........mhd0',
    '..0hHHm.........hhd0',
    '.0hhHm..........hmd0',
    '.0hHHm..........mhd0',
    '.0HHhm..........hhd0',
    '.0hHhm..........hmd0',
    '.0hhHm..........mhd0',
    '.0hHHh..........hhd0',
    '.0HHhhm........mhmd0',
    '.0hhHhm........mhhd0',
    '.0hHHhm........hmd0.',
    '.0dhHhm........mhd0.',
    '..0HHhd........hd0..',
    '..0dhd.........0d0..',
    '...0.0..........0...',
]


# Dark lipstick: a soft plum line, darker in the middle, the lower lip left to the light (a dark
# block would read as an open mouth).
FULL_LIPS = [''] * 13 + ['.......lLl', '........SS']

LOOKS = {
    'kate': {'p': KATE_P, 'f': KATE_F},
    'mechanic': {'p': MECH_P, 'f': MECH_F, 'box': (20, 25, 2, 4), 'post': glasses},
    'birthday': {'p': BDAY_P, 'f': BDAY_F, 'box': (20, 25, 2, 4), 'mouth': FULL_LIPS},
    'evening': {'p': EVE_P, 'f': EVE_F, 'box': (20, 25, 2, 4), 'mouth': FULL_LIPS},
}


def legend(look):
    return {**SKIN, **EYES, **LIPS[look], **HAIR[look]}


def _build(look, rows, hair, front):
    spec = LOOKS[look]
    w, h, dx, dy = spec.get('box', (16, 17, 0, 0))
    pic = Pic.text(over(rows, hair, dy=dy, h=h, dx=dx, w=w) if (dx or dy) else over(rows, hair), legend(look))
    if 'post' in spec:
        spec['post'](pic, front, dx, dy)
    return pic


def profile(look, face=None):
    rows = over(FACE_P, BLINK[face]) if face else FACE_P
    return _build(look, rows, LOOKS[look]['p'], False)


def front(look):
    rows = over(FACE_F, LOOKS[look]['mouth']) if 'mouth' in LOOKS[look] else FACE_F
    return _build(look, rows, LOOKS[look]['f'], True)
