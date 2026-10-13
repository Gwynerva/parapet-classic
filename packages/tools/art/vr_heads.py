"""Vera's heads, drawn from scratch as pixel art (no original head under them): Faith Connors of
Mirror's Edge (2008) and Mirror's Edge Catalyst (2016).

* The face: light warm skin, a heart-shaped face with high cheekbones and a small pointed chin,
  almond eyes in heavy black liner flicked back at the outer corner, dark brown irises, a small
  straight nose, full natural lips; her runner tattoo, black, under her RIGHT eye only: the liner
  of the lower lid drawn back and a spike pointing down to the cheekbone.
* Mirror's Edge (`me1`): a smooth blue-black bob to the jaw, the ears hidden, the ends flicked
  out, and the straight blunt fringe at the brows that juts over the forehead like a visor.
* Catalyst (`cat`): the asymmetric A-line, short at the nape and long at the front, the fringe
  from a parting on her left swept down over her right eye.

One light for the cast, from the upper front: the crown's blue sheen band and the fringe's front
lit, the back of the head, the nape and under the fringe dark; the fringe's shade across the
brows, the far cheek, the nose's side and underside, the lip's underside and the jaw in shade, the
cheekbone and the nose's tip lit. Skin in five tones that warm toward red in the shadow and toward
yellow in the light, a dark outline only in the shade, a warm lit edge where the light meets it.

The profile `25` faces right on Blaise's 16 x 17 box; the look tool turns it into 26-28. `29` is
the face turned to us (3/4, facing right, the near side on the left). Each comes in two: her
right side (`:right`, the tattoo seen) and her left one, drawn mirrored when she faces left (the
3/4 face then shows the tattoo under the far eye, and the Catalyst fringe falls over that eye).
76 / 77 (blinks), 78 (the pain face) and 79 (startled) are the profile with the eyes shut, half
shut, screwed up with the mouth open, and wide."""
from heads import Pic

# Skin: highlight (yellower), light, mid, shadow, deep shadow (redder, more saturated), the
# outline in shade, the lit edge (sel-out) where the light meets the outline.
SKIN = {'W': '#fff2d8', 'S': '#f8d2b0', 's': '#e8a585', 't': '#c97461', 'T': '#93434f', 'K': '#4a1a28',
        'e': '#d98c74'}
# Blue-black hair: sheen, light, mid-light, mid, dark, deep, outline.
HAIR = {'y': '#a4c0e6', 'Y': '#5f7eac', 'H': '#384f78', 'h': '#243354', 'm': '#172138', 'd': '#0d1322',
        'k': '#05070e'}
# Liner and lashes, eye white (lit, shaded), iris, the tattoo, lips (light, line, highlight).
FACE = {'p': '#140d18', 'w': '#f2e6e0', 'v': '#c9aeb0', 'i': '#5a2a26', 'x': '#1c1024', 'L': '#cc6f7c',
        'l': '#8a3c4e', 'r': '#eaa096'}
LEG = {**SKIN, **HAIR, **FACE}

# fmt: off
# Mirror's Edge, the profile facing right (her right side: the tattoo).
ME1_25 = [
    # 0123456789012345
    '.....kkkkkk.....',  # 0
    '...kkdmhhHhkk...',  # 1
    '..kdmhhHYyYHhk..',  # 2
    '.kdmhHYyyYYHHhk.',  # 3
    '.kdmYYHHHHHHYHhk',  # 4
    'kdmhHHhhhhhhhYHk',  # 5
    'kdhhdHhmmhhmhmhk',  # 6
    'kdmhdHhdTtttsSs.',  # 7
    'kdmhdhhdtsppppS.',  # 8
    'kdhmdhhdtsSwipS.',  # 9
    'kdhmdhmdtsxxSWWe',  # 10
    'kdmmdmmdtsSxSSt.',  # 11
    'kdmmdmmdTtsSSlL.',  # 12
    'kddmddmKTtssSL..',  # 13
    '.kkdk.kk.KtsSt..',  # 14
    '...k.....KttT...',  # 15
    '........KTtK....',  # 16
]
# Mirror's Edge, the 3/4 face turned right, her right eye near (the tattoo under it).
ME1_29 = [
    # 0123456789012345
    '....kkkkkkk.....',  # 0
    '..kkdmhhhHhkk...',  # 1
    '.kdmhhHHYyYHhk..',  # 2
    '.kmhHYyyyYYHHhk.',  # 3
    'kdmYYHHHHHHHHhdk',  # 4
    'kdhHHhhhhhhhYhmk',  # 5
    'kdhhdmhhmhhmhmdk',  # 6
    'kdhdTttsssttTddk',  # 7
    'kdhdpppSsspppdmk',  # 8
    'kdhdpwiSsSwiptmk',  # 9
    'kdhdxxWSWtsSstmk',  # 10
    'kdmdtxSSStssTdmk',  # 11
    'kdmdKtSSllstTdmk',  # 12
    '.kddkTtsLtstKdk.',  # 13
    '.k.k.KtSssTK.k..',  # 14
    '.....KTttTK.....',  # 15
    '......KTTK......',  # 16
]

# Catalyst, the profile facing right (her right side): the fringe from the parting on her left
# swept forward and down over the outer corner of her eye to the cheekbone, the forehead bare in
# front of it; the A-line: the nape short, the front lock long past the jaw.
CAT_25R = [
    # 0123456789012345
    '.....kkkkkk.....',  # 0
    '...kkdmhhHhkk...',  # 1
    '..kdmhhHYyYHhk..',  # 2
    '.kdmhHYyyYYHHhk.',  # 3
    '.kdmYYHHHHYyYHk.',  # 4
    'kdmhHHhhhHYYHhhk',  # 5
    'kdmhHhhhHYYhhdSe',  # 6
    'kdmhdhhHYYhdTsS.',  # 7
    'kdmhdhHYhhdpppS.',  # 8
    'kdmhdhYhhdtwipS.',  # 9
    'kdmmdHhhdtsxSSWe',  # 10
    '.kdmdhhdTtsxSSt.',  # 11
    '..kkdhmdTtsSSlL.',  # 12
    '....kdhdKtsSSL..',  # 13
    '.....kdmKKtsSt..',  # 14
    '......kk.KttT...',  # 15
    '........KTtK....',  # 16
]
# Her left side: the parting, the hair swept back from the forehead (bare under it), the eye clear.
CAT_25L = [
    # 0123456789012345
    '.....kkkkkk.....',  # 0
    '...kkdmhhHhkk...',  # 1
    '..kdmhhHYyYHhk..',  # 2
    '.kdmhHYyyYYHHk..',  # 3
    '.kdmYYHHHHHhdtk.',  # 4
    'kdmhHHhhhhhdtSSe',  # 5
    'kdmhHhhhhhdTtsSe',  # 6
    'kdmhdhhhhdTtssS.',  # 7
    'kdmhdhhhdtppppS.',  # 8
    'kdmhdhhhdtSwipS.',  # 9
    'kdmmdhhhdtsSSWWe',  # 10
    '.kdmdhhmdtsSSSt.',  # 11
    '..kkdhmdTtsSSlL.',  # 12
    '....kdhdKtsSSL..',  # 13
    '.....kdmKKtsSt..',  # 14
    '......kk.KttT...',  # 15
    '........KTtK....',  # 16
]
# The 3/4 face, her right eye near: the fringe from the parting on the far side swept down over
# the near eye's outer corner, the far temple bare, the near lock long past the jaw.
CAT_29R = [
    # 0123456789012345
    '....kkkkkkk.....',  # 0
    '..kkdmhhhHhkk...',  # 1
    '.kdmhhHHYyYHhk..',  # 2
    '.kmhHYyyyYYHdk..',  # 3
    'kdmYYHHHHHHdTtk.',  # 4
    'kdhHHhhhhHYdtsdk',  # 5
    'kdhHYYhhHYhdtstk',  # 6
    'kdhdHYYHhdTtssdk',  # 7
    'kdhhHYdTsspppthk',  # 8
    'kdhHdwiSsSwiptmk',  # 9
    'kdhdxxWSWtsSstmk',  # 10
    'kdmdtxSSStssTdmk',  # 11
    'kdmdKtSSllstTdk.',  # 12
    '.kddkTtsLtstKk..',  # 13
    '..kdkKtSssTK....',  # 14
    '...kkKTttTK.....',  # 15
    '......KTTK......',  # 16
]
# Seen mirrored (her left eye near): the parting on the near side, the fringe swept over the far
# eye, her right, the tattoo under it.
CAT_29L = [
    # 0123456789012345
    '....kkkkkkk.....',  # 0
    '..kkdmhhhHhkk...',  # 1
    '.kdmhhHHYyYHhk..',  # 2
    '.kdhHYyyyYYHHhk.',  # 3
    '.ktdhHHHHHHYYhdk',  # 4
    'kdtSdhhhhhHYYhdk',  # 5
    'kdtSsdhhhHYYhhdk',  # 6
    'kdTtsTdHHYYhhhdk',  # 7
    'kdtpppSsdYYhhmdk',  # 8
    'kdtpwiSsSdYhhmdk',  # 9
    'kdtsSSWSWtdYhmdk',  # 10
    '.ktsSSSStsdxhhdk',  # 11
    '.ktKtSSllsKdhmdk',  # 12
    '..kKTtsLtKkdmdk.',  # 13
    '...KKtSssTKkdk..',  # 14
    '....kKTttTKkk...',  # 15
    '......KTTK......',  # 16
]
# fmt: on

# The tattoo's pixels ('x') in each picture, and where it goes under the far eye of the 3/4 face
# seen mirrored (her right eye then).
FAR_TATTOO = [(11, 10), (12, 10), (11, 11)]

# The profile's faces, as edits of its eye (the liner row 8, the eye row 9, x 9-13) and mouth:
# the eyes shut (76), half shut (77), screwed up with the mouth open (78), wide (79).
FACES = (76, 77, 78, 79)
EYE = range(9, 14)


def with_face(rows, face):
    rows = [list(r) for r in rows]
    top, eye = rows[8], rows[9]
    for x in EYE:
        a, b = top[x], eye[x]
        if face == 76:  # shut: the lid down, the lashes a line
            if a == 'p' and x > 10:
                top[x] = 's'
            if b in 'wi':
                eye[x] = 'p'
        elif face == 77:  # half shut: the lid over the white
            if b == 'w':
                eye[x] = 'p'
        elif face == 78:  # screwed up
            if a == 'p' and x > 11:
                top[x] = 'T'
            if b in 'wi':
                eye[x] = 'p'
        elif face == 79:  # wide: the white round a small pupil
            if b == 'i':
                eye[x] = 'p'
            if b == 'p' and x == 13:
                eye[x] = 'w'
    if face == 78:  # the mouth open
        rows[12][13] = 'K'
        rows[13][13] = 'l'
    return [''.join(r) for r in rows]


def tattoo_side(rows, front, side):
    """The rows with her runner tattoo under her right eye only: in the profile it shows facing
    right (her right side seen); in the 3/4 face under the near eye facing right, under the far
    one (seen mirrored) facing left."""
    rows = [list(r) for r in rows]
    if side == 'left':
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c == 'x':
                    r[x] = 'p' if y == 10 and front else ('s' if r[x - 1] in 'tT' else 'S')
        if front:
            for x, y in FAR_TATTOO:
                rows[y][x] = 'x'
    return [''.join(r) for r in rows]


def selout(rows, front):
    """The hair's outline lit where the light meets it (the crown, and the front of the profile):
    deep blue there instead of black."""
    rows = [list(r) for r in rows]
    h, w = len(rows), len(rows[0])

    def clear(x, y):
        return not (0 <= x < w and 0 <= y < h) or rows[y][x] == '.'

    lit = []
    for y in range(min(h, 8)):
        for x in range(w):
            if rows[y][x] != 'k':
                continue
            up = clear(x, y - 1)
            ahead = clear(x + 1, y) if not front else False
            if (up and (front or x >= 6) and 3 <= x <= 12) or (ahead and 2 <= y <= 6):
                lit.append((x, y))
    for x, y in lit:
        rows[y][x] = 'd'
    return [''.join(r) for r in rows]


def me1(front=False, side='right', face=None):
    rows = selout(tattoo_side(ME1_29 if front else ME1_25, front, side), front)
    return Pic.text(with_face(rows, face) if face else rows, LEG)


CAT = {(False, 'right'): CAT_25R, (False, 'left'): CAT_25L, (True, 'right'): CAT_29R, (True, 'left'): CAT_29L}


def cat(front=False, side='right', face=None):
    rows = selout(CAT[(front, side)], front)
    if face:
        rows = with_face(rows, face)
    return Pic.text(rows, LEG)


def preview_pics():
    return ([me1(), me1(True), me1(side='left'), me1(True, 'left'), cat(), cat(True), cat(side='left'),
             cat(True, 'left')] + [me1(face=f) for f in FACES] + [cat(face=f) for f in FACES])


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    sheet('vr-heads.png', [(pal.rows(p), pal.pal) for p in preview_pics()], scale=10)
    print('ok')
