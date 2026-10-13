"""Vera's heads, drawn from scratch as pixel art (no original head under them): Faith Connors of
Mirror's Edge (2008) and Mirror's Edge Catalyst (2016).

* The face: light warm skin, a heart-shaped face with soft round cheeks and a small pointed chin,
  almond eyes of the same size under a black upper liner that runs a pixel past the outer corner
  (the flick), dark brown irises, a nose of one shade and a lit tip, small rose lips (the darker
  line, a lighter lower lip), a touch of blush; her runner tattoo, black, under her RIGHT eye only:
  a thin spike pointing down to the cheekbone, a pixel below the eye so the eyes stay even.
* Mirror's Edge (`me1`): a smooth blue-black bob to the jaw, the ears hidden, the ends flicked
  out, and the straight blunt fringe at the brows that juts over the forehead like a visor.
* Catalyst (`cat`): the asymmetric A-line, short at the nape and long at the front, the fringe
  from a parting on her left swept down over her right eye.

One light for the cast, from the upper front: the crown's blue sheen band and the fringe's front
lit, the back of the head, the nape and under the fringe dark; the fringe's soft shade on the
upper lids, the far cheek a tone darker, the nose's side and the chin's underside in shade, the
near cheek and the nose's tip lit. Skin in soft, low-contrast tones that warm toward red in the
shadow and toward yellow in the light; the outline a warm dark skin tone, never black, and nothing
dark on the cheeks or the jaw.

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
# Liner and lashes, eye white (lit, shaded), iris, the tattoo, lips (rose, the mouth's line, the
# lower lip's light), a touch of blush on the cheek.
FACE = {'p': '#140d18', 'w': '#fcf6f2', 'v': '#c9aeb0', 'i': '#5a2a26', 'x': '#22142c', 'L': '#d4707e',
        'l': '#9a4458', 'r': '#f2aaa2', 'B': '#f09a90'}
LEG = {**SKIN, **HAIR, **FACE}

# The face, the same in every picture: the eyes on rows 8-9 (the upper lash line, then the white
# and the iris), even in size, the liner running a pixel past the outer corner (the flick); the
# nose a shade and a lit tip; the small rose mouth on row 13 (12 in profile); the jaw curving in to
# a small pointed chin; the outline a warm dark skin tone, never black.

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
    'kdmhdHhdtssSSSs.',  # 7
    'kdmhdhhdtsSpppS.',  # 8
    'kdhmdhhdtsSSwiS.',  # 9
    'kdhmdhmdtsSxSSSe',  # 10
    'kdmmdmmdtsSxBSs.',  # 11
    'kdmmdmmdtsSSSlL.',  # 12
    'kddmddmktsSSsr..',  # 13
    '.kkdk.kk.TtsSs..',  # 14
    '...k.....TttT...',  # 15
    '........TttT....',  # 16
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
    'kdhdtssSSSsstddk',  # 7
    'kdhdpppSSpppsdmk',  # 8
    'kdhdSwiSSwiStdmk',  # 9
    'kdhdSSSSsSSstdmk',  # 10
    'kdhdsxBStWSBtdmk',  # 11
    'kdmdsxSSSSstddmk',  # 12
    '.kddksSLlLstkdk.',  # 13
    '.k.k..TsrsT..k..',  # 14
    '.......TsT......',  # 15
    '......TttT......',  # 16
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
    'kdmhdhhHYYhdtsS.',  # 7
    'kdmhdhHYhhhdppS.',  # 8
    'kdmhdhYhhdtSwiS.',  # 9
    'kdmmdHhhdtsxSSSe',  # 10
    '.kdmdhhdtsSxBSs.',  # 11
    '..kkdhmdtsSSSlL.',  # 12
    '....kdhdtsSSsr..',  # 13
    '.....kdmkTtsSs..',  # 14
    '......kk.TttT...',  # 15
    '........TttT....',  # 16
]
# Her left side: the parting, the hair swept back from the forehead (bare under it), the eye clear.
CAT_25L = [
    # 0123456789012345
    '.....kkkkkk.....',  # 0
    '...kkdmhhHhkk...',  # 1
    '..kdmhhHYyYHhk..',  # 2
    '.kdmhHYyyYYHHk..',  # 3
    '.kdmYYHHHHHhdtk.',  # 4
    'kdmhHHhhhhhdsSSe',  # 5
    'kdmhHhhhhhdtsSSe',  # 6
    'kdmhdhhhhdtssSS.',  # 7
    'kdmhdhhhdtspppS.',  # 8
    'kdmhdhhhdtSSwiS.',  # 9
    'kdmmdhhhdtsWSSSe',  # 10
    '.kdmdhhmdtsBSSs.',  # 11
    '..kkdhmdtsSSSlL.',  # 12
    '....kdhdtsSSsr..',  # 13
    '.....kdmkTtsSs..',  # 14
    '......kk.TttT...',  # 15
    '........TttT....',  # 16
]
# The 3/4 face, her right eye near: the fringe from the parting on the far side swept down over
# the near eye's outer corner, the far temple bare, the near lock long past the jaw.
CAT_29R = [
    # 0123456789012345
    '....kkkkkkk.....',  # 0
    '..kkdmhhhHhkk...',  # 1
    '.kdmhhHHYyYHhk..',  # 2
    '.kmhHYyyyYYHdk..',  # 3
    'kdmYYHHHHHHdtsk.',  # 4
    'kdhHHhhhhHYdsSdk',  # 5
    'kdhHYYhhHYhdsSsk',  # 6
    'kdhdHYYHhdtsSsdk',  # 7
    'kdhHYdpSSpppsdmk',  # 8
    'kdhHdwiSSwiStdmk',  # 9
    'kdhdSSSSsSSstdmk',  # 10
    'kdhdsxBStWSBtdmk',  # 11
    'kdmdsxSSSSstdk..',  # 12
    '.kddksSLlLstk...',  # 13
    '..kdk.TsrsT.....',  # 14
    '...kk..TsT......',  # 15
    '......TttT......',  # 16
]
# Seen mirrored (her left eye near): the parting on the near side, the temple bare under it, the
# fringe swept over the outer corner of the far eye, her right, the tattoo under it, the far lock
# long past the jaw.
CAT_29L = [
    # 0123456789012345
    '....kkkkkkk.....',  # 0
    '..kkdmhhhHhkk...',  # 1
    '.kdmhhHHYyYHhk..',  # 2
    '.kdhHYyyyYYHHhk.',  # 3
    '.ktdhHHHHHHYYhdk',  # 4
    'kdtSdhhhhhHYYhdk',  # 5
    'kdtSsdhhhHYYhhdk',  # 6
    'kdtSssdHHYYhhhdk',  # 7
    'kdtspppSSpdYhhdk',  # 8
    'kdhdSwiSSwidYhdk',  # 9
    'kdhdSSSSsSSsdhdk',  # 10
    'kdhdsSBStWxsdhdk',  # 11
    'kdmdsSSSSSxtdhdk',  # 12
    '.kddksSLlLstdhdk',  # 13
    '.k.k..TsrsTkdk..',  # 14
    '.......TsT.kk...',  # 15
    '......TttT......',  # 16
]
# fmt: on

# The tattoo ('x'): a thin spike a pixel under the eye, apart from it so both eyes stay the same
# size. Where it goes under the far eye when the 3/4 face is seen mirrored (her right eye far).
FAR_TATTOO = [(10, 11), (10, 12)]

# The profile's faces, as edits of its eye (the lash line on row 8, the eye on row 9) and mouth:
# the eyes shut (76), half shut (77), screwed up with the mouth open (78), wide (79).
FACES = (76, 77, 78, 79)
EYE = range(11, 14)


def with_face(rows, face):
    rows = [list(r) for r in rows]
    top, eye = rows[8], rows[9]
    for x in EYE:
        a, b = top[x], eye[x]
        if face == 76:  # shut: the lid down, the lashes a line where the eye was
            if a == 'p':
                top[x] = 's'
            if b in 'wi':
                eye[x] = 'p'
        elif face == 77:  # half shut: the lid over the white
            if b == 'w':
                eye[x] = 'p'
        elif face == 78:  # screwed up: the lid creased, the eye a line
            if a == 'p':
                top[x] = 't'
            if b in 'wi':
                eye[x] = 'p'
        elif face == 79:  # wide: the white round a small dark pupil
            if b == 'S' and a == 'p':
                eye[x] = 'w'
            elif b == 'i':
                eye[x] = 'p'
    if face == 78:  # the mouth open
        rows[12][13] = 'K'
        rows[13][13] = 'L'
    return [''.join(r) for r in rows]


def tattoo_side(rows, front, side):
    """The rows with her runner tattoo under her right eye only: in the profile it shows facing
    right (her right side seen); in the 3/4 face under the near eye facing right, under the far
    one (seen mirrored) facing left."""
    rows = [list(r) for r in rows]
    if side == 'left':
        for r in rows:
            for x, c in enumerate(r):
                if c == 'x':
                    r[x] = 'S'
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
