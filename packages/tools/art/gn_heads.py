"""Granger's head, drawn from scratch: Tracer as a cheerful young woman. Her chestnut hair in a
few clean tapering spikes swept up and back, a lighter fringe falling across the forehead (the
3/4 face) or jutting over the goggles (the profile), a strand before the ear; a slim face that
narrows from round cheeks to a small pointed chin, a touch of blush, a tiny nose, a small happy
smile with rose lips; silver rings in her left ear. Over the eyes, the eyewear of the look: the
orange single-lens goggles in a thick white frame with her eyes and lashes seen through the lens
(classic), aviator sunglasses under thin arched brows (Slipstream), round black goggles
(Punk).

The pictures are text with a legend of semantic characters, lit softly from the upper front (the
way she runs: the right of the profile 25 and of the 3/4 face 29). The skin keeps low contrast:
light over the face, one soft shade on the turned-away edge, under the fringe and under the chin
on the neck; the outline is a warm skin tone, never black. Each grid marks Blaise's 16×17 head
box (`*_BOX`, its top left corner in the grid): `centred` pads the picture so the box sits where
the game puts a head."""
from heads import Pic

# --------------------------------------------------------------------------------------------
# The legend. Hair: highlight → outline; skin: highlight (yellower) → deep shade (redder) → the
# warm outline, `s` the lit edge, `u` the blush; the eyes, brows and lips; the eyewear.
# --------------------------------------------------------------------------------------------
HAIR_CHESTNUT = {'H': '#d8b496', 'A': '#b48660', 'a': '#8c6042', 'b': '#684230', 'c': '#462a1e',
                 'k': '#24140e'}
HAIR_MAGENTA = {'H': '#ffc2f2', 'A': '#ff7ae0', 'a': '#e04cc6', 'b': '#b0329e', 'c': '#7c2276',
                'k': '#3a1038'}
# '2' '3' '4' are the tones of her neck in the collar (gn_parts.NECK).
SKIN = {'1': '#fff0d6', '2': '#ffd0a2', '3': '#f2ac7e', '4': '#d8845a', '5': '#b45e40',
        's': '#e8a07a', 'u': '#f8a088'}
FEATURES = {'m': '#8c2a36', 't': '#fff6ee', 'p': '#d4646e', 'P': '#ee8e8e', 'B': '#6e4030',
            'l': '#6a2410', 'r': '#a83e18', 'e': '#9aa4b4', 'E': '#f4f8ff'}
GOGGLES = {'W': '#ffffff', 'w': '#e2e2dc', 'q': '#b4b2ac',
           'Y': '#ffe28c', 'O': '#ffa030', 'R': '#e8681c'}
SHADES = {'L': '#26242c', 'g': '#e2b456', 'G': '#a87c34', 'K': '#18161c', 'n': '#76809a'}


def legend(hair=HAIR_CHESTNUT, extra=None):
    return {**hair, **SKIN, **FEATURES, **GOGGLES, **SHADES, **(extra or {})}


# --------------------------------------------------------------------------------------------
# The profile (25), facing right: column i is x + 5 of Blaise's head box, row j is y + 5.
# Three spikes swept back, the fringe a visor over the goggles, a short nape; the ear behind a
# strand of hair; a 1-px upturned nose, lips, a small chin set back, the jaw climbing to the ear.
# Through the lens her eye: a lash and the iris.
# --------------------------------------------------------------------------------------------
PROF_BOX = (5, 5)
PROF = [
    '........k................',  # -5
    '..k.....kA...............',  # -4
    '..kA....kaA....k.........',  # -3
    '...kaA...kaA..kA.........',  # -2
    '....kaA..kbaA.kaA........',  # -1
    '.....kaAAbaAAbaAAc.......',  #  0
    '.....kaaAAaaAHHHAAc......',  #  1
    '...kaabaaAAAAAAHHAAAc....',  #  2
    '.kbbbbcaaaaaaaAAAAAHHAc..',  #  3
    '...kbbbbaaaaaabbbbbbbAAc.',  #  4
    '.....kbbbaaabbcWWWWWWw...',  #  5
    '.....kbbbbaabccWwYYrOW...',  #  6
    '.....kbbbbbacb3qwORlRw...',  #  7
    '......kbbbc43c3qqwwwwq...',  #  8
    '......kbbbc453322221s....',  #  9
    '.......kbbc34322uu221s...',  # 10
    '........kbc5432222m2p....',  # 11
    '.........kc44532222mP....',  # 12
    '..........c54455221s.....',  # 13
    '............5444555......',  # 14
    '............5433.........',  # 15
    '............5433.........',  # 16
]

# --------------------------------------------------------------------------------------------
# The 3/4 face (29): column i is x + 3 of the box, row j is y + 5. Three spikes up, one out to
# the near side, the light fringe sweeping down across the forehead over the goggles' near end;
# the goggles across the face with her eyes through the lens; round cheeks with blush narrowing
# to a pointed chin; a small open smile (rose corners, a line of teeth); a slender neck.
# --------------------------------------------------------------------------------------------
FRONT_BOX = (3, 5)
FRONT = [
    '...........k...........',  # -5
    '....k.....kA...........',  # -4
    '....kA....kaA....k.....',  # -3
    '....kbA..kbaA...kA.....',  # -2
    '....kbaA.kbaaA.kaA.....',  # -1
    '....kbaAcbaaAAcbaAc....',  #  0
    '..kaAbaabaAHHHAAAAaAc..',  #  1
    'kaAAbaaAHHAAAAaabcAc...',  #  2
    '..kbbbHAAAaaabc323bc...',  #  3
    '...kbAHAaabc322123bc...',  #  4
    '...kAAabcWWWWWWWWWwc...',  #  5
    '...kaabcYrrYYOrrOOwc...',  #  6
    '...kbbcWOOlRRRRlRRq....',  #  7
    '....kb5wWWWWWwwwwwq....',  #  8
    '.....k53222222212s.....',  #  9
    '......53uu22312u2s.....',  # 10
    '.......5322pttp2s......',  # 11
    '........5322mm22s......',  # 12
    '.........532212s.......',  # 13
    '..........45235........',  # 14
    '..........4455.........',  # 15
    '..........4443.........',  # 16
]


# --------------------------------------------------------------------------------------------
# Eyewear of the other looks: rows of the profile and the 3/4 face replaced (by their y).
# Slipstream: aviator sunglasses (dark teardrop lenses under a gold bar), thin arched brows over
# them. Punk: round black goggles on a black strap.
# --------------------------------------------------------------------------------------------
EYEWEAR = {
    'slipstream': {
        'prof': {
            5: '.....kbbbaaabbc322BBs....',
            6: '.....kbbbbaabccGgggLL....',
            7: '.....kbbbbbacb33222nL....',
            8: '......kbbbc43c33222Ls....',
        },
        'front': {
            5: '...kAAabc3BB22BB2sbc...',
            6: '...kaabcggggggggg3bc...',
            7: '...kbbc3nLLL2nLL2s.....',
            8: '....kb53LLL222LL2s.....',
        },
    },
    'punk': {
        'prof': {
            5: '.....kbbbaaabbc32BBKK....',
            6: '.....kbbbbaabccKKKKKnK...',
            7: '.....kbbbbbacb33222KLK...',
            8: '......kbbbc43c33222KK....',
        },
        'front': {
            4: '...kbAHAaabc322BB3bc...',
            5: '...kAAabcKK222KK2sbc...',
            6: '...kaabcKnLKKKnLKKbc...',
            7: '...kbbc3KLLK2KLLKs.....',
            8: '....kb532KK222KK2s.....',
        },
    },
}
HAIR = {'classic': HAIR_CHESTNUT, 'slipstream': HAIR_CHESTNUT, 'punk': HAIR_MAGENTA}


def grid(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def centred(pic, box):
    """Pads a head picture so that Blaise's head box, whose top left corner is at `box` in it,
    sits where the game draws a head: the box's pixel (8, 8) on the picture's centre, the
    width even and the height odd like hers."""
    c, r = box[0] + 8, box[1] + 8
    w0, h0 = pic.w, pic.h
    pad_l = max(0, w0 - 2 * c)
    W = 2 * (c + pad_l)
    pad_t = max(0, h0 - 1 - 2 * r)
    H = 2 * (r + pad_t) + 1
    return pic.pad(pad_l, pad_t, W - w0 - pad_l, H - h0 - pad_t)


# Her left ear's silver rings (the side seen while she runs left: `25:left`, `29:left`), as
# (column, row) of the grids.
RINGS_PROF = {(11, 13): 'e', (12, 16): 'E'}
RINGS_FRONT = {(4, 13): 'e', (5, 14): 'E'}
# The profile's faces, as (column, row) of the grid: 76 and 77 blink (her eye behind the lens
# closes to a lash line; the dark lenses of the other looks hide it), 78 winces (the eye
# squeezed, the smile gone to a small open mouth). `eye` marks apply to the orange lens only.
FACES = {
    76: {'eye': {(19, 11): 'Y', (18, 12): 'r', (19, 12): 'l'}, 'mouth': {}},
    77: {'eye': {(19, 11): 'O', (18, 12): 'R', (19, 12): 'l', (20, 12): 'r'}, 'mouth': {}},
    78: {'eye': {(18, 11): 'l', (19, 11): 'Y', (19, 12): 'l'},
         'mouth': {(18, 16): '2', (18, 17): 'm', (19, 16): 'm', (19, 17): 'm', (20, 16): 'p', (20, 17): 'p'}},
}
LENS_EYES = ('classic',)


def head(front=False, look='classic', side=None, face=None, extra=None, overlay=None):
    """A head picture of a look: its eyewear, its hair; `side` 'left' adds her ear rings, `face`
    (76-78) is the profile blinking or wincing."""
    rows, box = (FRONT, FRONT_BOX) if front else (PROF, PROF_BOX)
    rows = list(rows)
    for y, r in EYEWEAR.get(look, {}).get('front' if front else 'prof', {}).items():
        rows[y + 5] = r
    leg = legend(HAIR.get(look, HAIR_CHESTNUT), extra)
    p = Pic.text(grid(rows), leg)
    if overlay:
        p.paint(overlay, leg)
    marks = {}
    if side == 'left':
        marks.update(RINGS_FRONT if front else RINGS_PROF)
    if face and not front:
        if look in LENS_EYES:
            marks.update(FACES[face]['eye'])
        marks.update(FACES[face]['mouth'])
    for (x, y), ch in marks.items():
        p.set(x, y, leg[ch])
    return centred(p, box)
