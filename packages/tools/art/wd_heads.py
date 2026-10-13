"""Widow's head, drawn from scratch as pixel art (no original head under it): Widowmaker, Amélie
Lacroix of Overwatch, the femme fatale whose heart was slowed to a few beats a minute.

What a fan names first, kept at 16 px: the cool lavender-blue skin (lavender grey, NOT Liara's
saturated azure), the Infra-Sight visor raised on the head (the dark grey spider shell over the
forehead and the crown, its big red lens over the brow and two small ones higher up, a module with
a red lens over each temple), the very high ponytail of dark indigo hair rising from the crown in a
dark metal cuff (its long tail is a ribbon from the cuff, `TAIL`), the narrow face with high
cheekbones and a small pointed chin, golden eyes half shut under a heavy black liner flicked out,
full dark plum lips, a silver stud in the ear. No fringe: the visor covers the forehead.

One light for the cast, from the upper front, in soft broad tones rather than carved planes: the
visor's shell catches it on its top and its front (a sharp specular edge, reflected light on its
underside), the lenses each a glint; the face light and low in contrast, the near cheek and the
nose's tip lit, a soft shade under the visor's rim and on the turned-away side, the underside of
the jaw and the neck in shade; nothing dark on the cheeks or the jaw. The skin in six tones that
shift from a pale, faintly warm lilac in the light to a violet in the shade, a dark plum outline in
the shade and a lighter edge where the light hits.

The profile (25) faces right on Blaise's 16 x 17 box (the chin and the neck where hers are); the
look tool turns it into 26-28. 29 is the face turned to us, nearly front on and facing right as
the other bosses' are. 76-78 are the profile blinking (shut, half shut) and wincing. Every grid
marks Blaise's head box (`*_BOX`, its top left corner in the grid): `centred` pads the picture so
the box sits where the game puts a head.

Each look may change the headgear and the hair (`HEADS`): the classic grey visor; Noire's black
visor with its two little horns and the hair in a high knot of curls; Odile's crown of black
swan feathers and teal-streaked hair; the Comtesse's bronze visor-coronet with amber lenses."""
from heads import Pic

# --------------------------------------------------------------------------------------------
# The legend.
# Skin: highlight (pale, faintly warm) → light → mid (the official #b1b4db) → shadow (violet) →
# deep shadow → the outline in shade (dark plum); `r` a faint mauve blush.
SKIN = {'W': '#e4e2f4', 'S': '#c8c8ea', 's': '#b0b1dc', 't': '#9590c8', 'T': '#7a70b0', 'D': '#5c4e90',
        'K': '#2c2244', 'r': '#bca6d8'}
# Eyes: the liner and lashes, the golden iris and its dark lower half, the white (cool, barely
# seen); lips: the lower lip's light, the lips, the line between them; the silver stud.
FACE = {'P': '#dcc6f4', 'l': '#16121e', 'i': '#f0cc4c', 'I': '#a4701e', 'e': '#dcdaf0', 'L': '#b08ed0', 'm': '#8462aa',
        'M': '#4c3676', 'x': '#c4c8dc'}
# Hair (dark indigo, the official #30385f): sheen → light → base → shade → outline.
HAIR = {'h': '#6a68bc', 'H': '#474c8c', 'c': '#30385f', 'C': '#20243e', 'k': '#100e1c'}
# The visor: specular edge → light → mid → shade → deep → outline; the lenses: red, glint, rim.
VISOR = {'v': '#c4c2d0', 'V': '#8e8a9a', 'g': '#6a6676', 'G': '#4a4656', 'q': '#302c3a', 'o': '#141019',
         'R': '#f0262a', 'y': '#ffb09a', 'Q': '#94101c'}
# The cuff of the ponytail: dark metal, its glint; the temple modules (light, shade).
CUFF = {'u': '#9a98a8', 'U': '#3e3c4a', 'N': '#7c7886', 'n': '#57535f'}


def legend(extra=None):
    return {**SKIN, **FACE, **HAIR, **VISOR, **CUFF, **(extra or {})}


# --------------------------------------------------------------------------------------------
# The profile (25), facing right: column i is x + 5 of Blaise's head box, row j is y + 4.
# The visor a shell over the forehead and the crown, coming down to a point over the brow, the
# big lens on its front, a small one on its top; the temple module over the ear with its lens;
# behind them the hair drawn back to the nape and up into the cuff on the crown, the ponytail
# rising out of it (the ribbon goes on from there); under the visor the eye: the heavy liner and
# its flick, the gold iris half under the lid; a small straight nose, full lips, the small
# pointed chin set back, the jaw climbing to the ear, the long slender neck.
# --------------------------------------------------------------------------------------------
PROF_BOX = (5, 6)
PROF = [
    #   x: -5   0    5    10   15
    '.....kkk.................',  # -6  the tail rising out of the cuff
    '....kHhck................',  # -5
    '....kcHcCk...............',  # -4
    '.....kCUuUk..............',  # -3  the cuff
    '.......kCcCoooo..........',  # -2  the visor's top
    '......kHcoqgVvvVgo.......',  # -1
    '.....khHoqgVVvVRgo.......',  #  0  a small lens on the top
    '.....khcqNNnqgVVVgQo.....',  #  1  the temple module over the ear
    '.....kHcqNynqGgVgQyRo....',  #  2  its lens; the big lens on the front
    '.....kHcqnRnqGGggQRRo....',  #  3
    '.....kHcqqqqqqGGGqqo.....',  #  4  the visor's rim
    '.....kcCcCqqqCCTtDDSS....',  #  5  the hair drawn back under it; the brow
    '......kCcHcKTtslttsS.....',  #  6  the ear; the liner's flick, the lid's shadow
    '.......kCcCKtsSSlllS.....',  #  7  the liner
    '.......kCcKxtsSSeiIS.....',  #  8  the stud; the gold iris under the lid
    '........kCKTtsSWSSSSS....',  #  9  the cheekbone's light; the nose's tip
    '.........kKTtsSrSSst.....',  # 10  a touch of blush; under the nose
    '.........KTTTtsSSSMm.....',  # 11  the upper lip
    '..........KTTttsSSmL.....',  # 12  the lower lip, fuller
    '...........KTTtsSSS......',  # 13  under the lip
    '...........KTTTtsD.......',  # 14  the small chin set back
    '............KTTtK........',  # 15  the jaw climbing back, the neck under it
    '............KTTtK........',  # 16  the neck
]

# --------------------------------------------------------------------------------------------
# The face turned to us (29): column i is x + 3 of the box, row j is y + 4. The visor's shell over
# the forehead with its point down between the brows, the big lens over it and the two small ones
# higher on each side, the near temple module standing out past the cheek with its lens, the far
# one behind; the ponytail rising behind the crown; the narrow face, the liner flicked out at both
# outer corners, gold irises half under the lids; the nose a shade and a lit tip; full plum lips;
# the small pointed chin; the long neck.
# --------------------------------------------------------------------------------------------
FRONT_BOX = (3, 6)
FRONT = [
    #   x: -3 0    5    10   15
    '...kkk................',  # -6  the ponytail rising behind the crown
    '..kHhck...............',  # -5
    '..kcHcCk..............',  # -4
    '...kCUuUk.............',  # -3  the cuff
    '....kCck..oooo........',  # -2  the visor's crest
    '.....kCcoqgvvVgo......',  # -1
    '....kCoqgVVvvVVgo.....',  #  0
    '...qNqqRgVVvVVgRGo....',  #  1  the two small lenses; the near temple module
    '..qNynqggVVQQVVgGqnq..',  #  2  the big lens; the far module
    '..qnRnqgGVQyRQVgGqRq..',  #  3
    '..qqnqTDDtQRRQtDDqnq..',  #  4  the arched brows under the shell; the lens over the brow
    '....qKtsSSsqqsSSsKq...',  #  5  the visor's point between them
    '.....KltttSStStttlK...',  #  6  the liner's flicks, the lids' shadow
    '.....KllllSStllllK....',  #  7  the liner
    '.....KteiISSteiItK....',  #  8  gold irises half under the lids
    '.....KsWSSSStSSsD.....',  #  9  the cheekbones
    '.....xKsrSSSWtrsD.....',  # 10  the stud; the nose's tip and shade; blush
    '.......KsSmMmSsD......',  # 11  the lips
    '........KsLPLsD.......',  # 12  the lower lip, fuller, its gloss
    '........KTtSsD........',  # 13
    '........KTTsK.........',  # 14  the small pointed chin
    '........KTttD.........',  # 15  the neck
    '........KTttD.........',  # 16
]

# The ponytail's long tail, a ribbon from the top of the hair rising out of the cuff (its root at
# `TAIL_ROOT`: pixels behind and below the head's centre): rows run along it from the root, the
# chain through the middle; dark indigo, the sheen down its middle, thick at the root and
# tapering to a fine point by her waist.
TAIL_ROOT = (7, -12)
TAIL = [
    'kcHhk',
    'kcHhk',
    'kcHhk',
    'kCHhk',
    'kCcHk',
    'kCcHk',
    'kCcHk',
    '.kcHk',
    '.kcHk',
    '.kCHk',
    '.kchk',
    '.kcHk',
    '.kCHk',
    '.kCck',
    '..kHk',
    '..kck',
    '..kHk',
    '..kck',
    '..kk.',
    '..k..',
]

# The profile's eyes shut (76), half shut (77), screwed up with the mouth a little open (78): rows
# painted over the profile ('.' keeps a pixel).
FACES = {
    76: {12: '...............stTt', 13: '...............lTts', 14: '................lll'},
    77: {12: '...............sTTt', 13: '...............tlll', 14: '................sIl'},
    78: {11: '................DDD', 12: '...............tTTD', 13: '...............llll', 14: '................ttl', 17: '..................MM', 18: '..................ML'},
}


def grid(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def centred(pic, box):
    """Pads a head picture so that Blaise's head box, whose top left corner is at `box` in it,
    sits where the game draws a head: the box's pixel (8, 8) on the picture's centre, the width
    even and the height odd like hers."""
    c, r = box[0] + 8, box[1] + 8
    w0, h0 = pic.w, pic.h
    pad_l = max(0, w0 - 2 * c)
    W = 2 * (c + pad_l)
    pad_t = max(0, h0 - 1 - 2 * r)
    H = 2 * (r + pad_t) + 1
    return pic.pad(pad_l, pad_t, W - w0 - pad_l, H - h0 - pad_t)


def overlay(rows, paint):
    rows = [list(r) for r in grid(rows)]
    for y, row in (paint or {}).items():
        for x, c in enumerate(row):
            if c != '.':
                rows[y][x] = c
    return [''.join(r) for r in rows]


def painted(rows, box, strokes):
    """Rows with strokes painted over them: (y, x, text) in the head box's coordinates, '.' keeps
    a pixel, ' ' erases it, other characters paint."""
    rows = [list(r) for r in grid(rows)]
    for y, x, text in strokes:
        for i, c in enumerate(text):
            if c != '.':
                rows[box[1] + y][box[0] + x + i] = '.' if c == ' ' else c
    return [''.join(r) for r in rows]


# --------------------------------------------------------------------------------------------
# The looks' headgear and hair: a legend over hers and strokes painted over the profile (`prof`)
# and the 3/4 face (`front`), in the head box's coordinates; `tail` False when the hair is up in a
# knot (no ponytail ribbon).
# --------------------------------------------------------------------------------------------
# Noire: the visor black, two little horns on it, the red lenses; the hair up in a high knot of
# curls instead of the tail.
NOIRE_KNOT = [
    (-6, -1, ' kkkk '),
    (-5, -2, 'kHhHck'),
    (-4, -2, 'kcHchCk'),
    (-3, -2, 'khcCHck'),
    (-2, -1, 'kCcCk'),
]
# Odile: the visor black with rose lenses, a crest of black swan feathers fanning up from it, teal
# streaks in her hair.
ODILE_CREST_PROF = [(-3, 5, 'oq'), (-4, 4, 'oq'), (-5, 4, 'o'),
                    (-3, 7, 'qg'), (-4, 7, 'oq'), (-5, 6, 'oq'), (-6, 6, 'o'),
                    (-3, 9, 'gv'), (-4, 9, 'qg'), (-5, 9, 'oq'), (-6, 9, 'o'),
                    (-3, 11, 'gq'), (-4, 11, 'qo'), (-5, 12, 'o'),
                    (-2, 12, 'qo'), (-3, 13, 'o')]
ODILE_CREST_FRONT = [(-3, 4, 'oq'), (-4, 3, 'o'),
                     (-3, 6, 'qg'), (-4, 6, 'oq'), (-5, 5, 'o'),
                     (-3, 8, 'gv'), (-4, 8, 'qg'), (-5, 8, 'oq'), (-6, 8, 'o'),
                     (-3, 10, 'vg'), (-4, 10, 'gq'), (-5, 10, 'qo'), (-6, 10, 'o'),
                     (-3, 12, 'qo'), (-4, 12, 'oq'), (-5, 13, 'o')]
HEADS = {
    'classic': {},
    'noire': {
        'legend': {'v': '#7a7888', 'V': '#44424e', 'g': '#302e38', 'G': '#22202a', 'q': '#16141a',
                   'o': '#08070a', 'N': '#3a3844', 'n': '#26242e'},
        'prof': NOIRE_KNOT + [(-4, 7, 'o'), (-3, 7, 'qo'), (-4, 10, 'o'), (-3, 9, 'oq')],
        'front': NOIRE_KNOT + [(-4, 5, 'o'), (-3, 5, 'qo'), (-4, 11, 'o'), (-3, 10, 'oq')],
        'tail': False,
    },
    'odile': {
        'legend': {'v': '#6a8a92', 'V': '#363c48', 'g': '#262a34', 'G': '#1a1c24', 'q': '#121318',
                   'o': '#060608', 'N': '#30343e', 'n': '#20232a', 'R': '#ff58b8', 'y': '#ffd6f0',
                   'Q': '#a0186e', 'h': '#5ccab8', 'H': '#2e8a86'},
        'prof': ODILE_CREST_PROF,
        'front': ODILE_CREST_FRONT,
    },
    'comtesse': {
        'legend': {'v': '#ffe6b4', 'V': '#d2a46e', 'g': '#a6764a', 'G': '#7a5232', 'q': '#4e321e',
                   'o': '#24140c', 'N': '#c09060', 'n': '#8a603c', 'R': '#ffa030', 'y': '#fff2c0',
                   'Q': '#b85a12', 'U': '#9a6a2c', 'u': '#f4cc78'},
    },
}


def head_legend(look, extra=None):
    return legend({**HEADS.get(look, {}).get('legend', {}), **(extra or {})})


def profile(face=None, look='classic', extra=None):
    rows = painted(overlay(PROF, FACES.get(face)), PROF_BOX, HEADS.get(look, {}).get('prof', []))
    return centred(Pic.text(rows, head_legend(look, extra)), PROF_BOX)


def front(look='classic', extra=None):
    rows = painted(FRONT, FRONT_BOX, HEADS.get(look, {}).get('front', []))
    return centred(Pic.text(rows, head_legend(look, extra)), FRONT_BOX)


def has_tail(look):
    return HEADS.get(look, {}).get('tail', True)


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    pics = [p for lk in HEADS for p in (profile(look=lk), front(look=lk))] + [profile(f) for f in FACES]
    sheet('wd-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=12)
    print('ok')
