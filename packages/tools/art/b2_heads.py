"""B-2's heads, drawn from scratch as pixel art (no original head under them): 2B of NieR:Automata.

The black velvet blindfold across the face (two rows and a sheen, a pixel past the face line in
profile), the warm yellowish-white bob to the chin covering the ears, its tips chopped into points
at the cheeks and a little longer at the face than at the nape, the solid fringe swept from her
part (her right) over her left eye and the top of the blindfold, the black hairband behind the
hairline (in profile a near-vertical arc behind the crown), pink lips, the beauty mark under the
left corner of her lips.

One light for the cast, from the upper front: the crown's highlight band and the fringe's lit
strands, the back of the head and the nape in shade, the dark under the clumps; the face lit, the
bob's shade on the cheek, the side of the nose, under the lower lip, the jaw and its shade on the
neck. Skin in five tones that warm toward rose in the shadows and toward yellow-white in the
light; the hair's warm white shades toward a soft mauve grey.

The profile (25) faces right on Blaise's 16 x 17 box (the chin and neck where hers are); it shows
her right side (the part, no mark). `25:left` is her left side seen (the runner mirrored): the
fringe's mass and the beauty mark under the lip. 29 is the face turned to us (3/4, facing right:
her right cheek near, the fringe sweeping to the far temple, the mark under the far corner of the
lips); `29:left` is the same face mirrored on screen, drawn so the fringe and the mark stay on her
own sides. The look tool turns 25 (and 25:left) into 26-28.
"""
from heads import Pic

SKIN = {'K': '#7a3440', 'T': '#bc6c62', 't': '#e0a08c', 's': '#f4c9b4', 'S': '#fde4d4', 'W': '#fff6ec'}
# Lips (line, pink, the lower lip's light), the beauty mark.
FACE = {'l': '#a8505a', 'L': '#d4787c', 'p': '#eca6a4', 'x': '#5c3236'}
# Black velvet: the blindfold and the hairband (black, the turned edge, the sheen).
VELVET = {'k': '#121016', 'q': '#2a2630', 'Q': '#4c4656'}
# Warm yellowish white hair: outline, deep, shadow, half, main, light, highlight.
HAIR_WHITE = {'0': '#3c3238', 'd': '#665c5c', 'm': '#90867c', 'h': '#bdb2a0', 'H': '#e2dacb', 'Y': '#f4f0e6',
              'y': '#fffef8'}
# 2P: black hair (outline, deep, shadow, half, main, light, highlight) and a white blindfold.
HAIR_BLACK = {'0': '#08070c', 'd': '#121019', 'm': '#1c1a26', 'h': '#282634', 'H': '#363446', 'Y': '#4c4a60',
              'y': '#6c6a84'}
VELVET_WHITE = {'k': '#ecebe6', 'q': '#c8c4c0', 'Q': '#ffffff'}


def legend(hair=HAIR_WHITE, velvet=VELVET, extra=None):
    return {**SKIN, **FACE, **hair, **velvet, **(extra or {})}


# ------------------------------------------------------------------------------ profile (25)
PROFILE = [
    '.....0mkqmm.....',
    '...0dhHkqYYhm...',
    '..0dhHkqYyyyYm..',
    '.0dhHYkHYyyyYYm.',
    '.0hhHYhHYYYyYYYm',
    '0dhhHHhHHYHYYYHm',
    '0dmhhHhHHHHYHhHm',
    '0dmhmhhHhHkkqQQq',
    '0dmhmhhHhHkkkkkk',
    '0dmmhmhHhHttssS.',
    '0dmmhmhHhHtsWSSS',
    '0ddmhmhhmHtsSst.',
    '.0dmmdmhmhTtslL.',
    '.0ddmdmhdhTtssp.',
    '..0d.dmdmhKTtsS.',
    '.....0.0dm.KTTK.',
    '................',
]
# Her left side (the runner facing left): the mark under the lip.
PROFILE_LEFT = {(12, 13): 'x'}


def profile(left=False, hair=HAIR_WHITE, velvet=VELVET, extra=None):
    rows = [list(r) for r in PROFILE]
    if left:
        for (x, y), c in PROFILE_LEFT.items():
            rows[y][x] = c
    return Pic.text([''.join(r) for r in rows], legend(hair, velvet, extra))


# --------------------------------------------------------------------------------- 3/4 (29)
FRONT = [
    '....0hhkqhm0....',
    '..0hYYkqyyYhm0..',
    '.0HYYkqyyyYYHhm.',
    '0HYYkqYyyYYHHhm0',
    '0HYYkHhYYYhHHhm0',
    '0HYHhYYhYHHhHhmd',
    '0HHhHYHYhHHHhmmd',
    '0hHhHHHHHhHhhmdd',
    '0hHqQQqkkHhhmmdd',
    '0hHkkkkkkkkkkmd0',
    '0hhkkkkkkkkkkmd0',
    '0hhksSWSStsstmd0',
    '0mhtsSSSWtsttmd0',
    '.0mtssSLlsstdd0.',
    '.0dmtsspsxttd0..',
    '..0dTtsSstTd0...',
    '.....KTTTK......',
]
# The face mirrored on screen (her left cheek near): the mark under the near corner, the fringe
# sweeping from the far temple over the near end of the blindfold.
FRONT_LEFT = [
    '....0hhkqhm0....',
    '..0hYYkqyyYhm0..',
    '.0HYYkqyyyYYHhm.',
    '0HYYkqYyyYYHHhm0',
    '0HYYkHYYYhYHhhm0',
    '0HYHhYYYhHHhHhmd',
    '0HHhHYHhHHhHHmmd',
    '0hHhHHhHHhHHhmdd',
    '0hHhHhhkqQQQqmdd',
    '0hHkkkkkkkkkkmd0',
    '0hhkkkkkkkkkkmd0',
    '0hhksSWSStsstmd0',
    '0mhtsSSSWtsttmd0',
    '.0mtssSLlsstdd0.',
    '.0dmtsxpssttd0..',
    '..0dTtsSstTd0...',
    '.....KTTTK......',
]


def front(left=False, hair=HAIR_WHITE, velvet=VELVET, extra=None):
    rows = FRONT if not left or FRONT_LEFT is None else FRONT_LEFT
    return Pic.text(rows, legend(hair, velvet, extra))


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    pics = [profile(), profile(True), front(), front(True), profile(hair=HAIR_BLACK, velvet=VELVET_WHITE),
            front(hair=HAIR_BLACK, velvet=VELVET_WHITE)]
    sheet('b2-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=12)
    print('ok')


# ------------------------------------------------------------------- the kimono's fox mask
# The white kitsune mask worn on the side of the head (her right), its ears over the crown: white,
# its shade, the red markings, a grey edge. The heads grow two rows on top (the ears) and two
# under (so the face stays where it was): 16 x 21.
MASK = {'F': '#f8f4ec', 'f': '#d6cec4', 'X': '#c8383c', 'U': '#5c5058', 'K': '#2a2226'}
MASK_FACE = [
    'U.....U',
    'XU...UX',
    'UFFXFFU',
    'UKXFXKU',
    'UfFFFfU',
    '.UfFfU.',
    '..UFU..',
    '...U...',
]
# Where it goes on each picture (column, row in the 21-row box), or only its ears peeking over
# the crown from the far side.
MASK_AT = {'25': (0, 0), '29': (0, 0)}
EARS_FAR = {'25:left': ['..U...U', '.UXU.UX'], '29:left': ['.........U...U', '........UXU.UX']}


def masked(pic, key):
    """A head with the fox mask: padded to 21 rows, the mask (or its far ears) painted on."""
    p = pic.copy().pad(0, 2, 0, 2)
    leg = {**MASK, '.': None}
    if key in MASK_AT:
        x0, y0 = MASK_AT[key]
        for dy, row in enumerate(MASK_FACE):
            for dx, ch in enumerate(row):
                if ch != '.':
                    p.set(x0 + dx, y0 + dy, MASK[ch])
    else:
        for dy, row in enumerate(EARS_FAR[key]):
            for dx, ch in enumerate(row):
                if ch != '.' and p.get(dx, dy) is None:
                    p.set(dx, dy, MASK[ch])
    return p
