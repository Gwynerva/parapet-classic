"""Flittermouse's heads, drawn from scratch as pixel art: the cowl with its two long ears, the
heavy V brow over narrow white slits and the pointed mask nose, over a pale square jaw with grey
stubble and a tight mouth (Asylum and City); the shorter, thicker, raked ears of the armoured
suit; the faceless black mask of the future suit.

One light for the whole cast, from the upper front: in profile (facing right) from the right,
on the 3/4 face from the near (left) side, so the far side of the face is in shade and the
nose's shadow falls toward the far cheek. Legend: the cowl o (outline) e (outline where the
light hits) D A M L H (deep shade → highlight) X (the gloss of the rubber) r (light bounced
onto the shaded back); the skin S s t u v (highlight → deep shade, the shadows redder, the
highlight yellower), the stubble g G q (lit → shade, cooler), the mouth line m; the lenses w W.
"""
from heads import Pic

COWL = {'o': '#09080e', 'e': '#2a2940', 'D': '#151420', 'A': '#201f2e', 'M': '#2d2c40', 'L': '#413f5a',
        'H': '#5d5c80', 'X': '#9a9cc6', 'r': '#2a2c46'}
SKIN = {'S': '#f6e6d6', 's': '#e6c7b6', 't': '#c9a092', 'u': '#a47470', 'v': '#5c4246',
        'g': '#b4a8aa', 'G': '#8a7d83', 'q': '#62565e', 'm': '#3c2a2e'}
EYES = {'w': '#f4f7ff', 'W': '#a9b5cc'}

# Profile, facing right. The near ear stands in front, its back edge straight, its front edge
# raked; the far ear peeks out behind it. The dome's gloss on the crown; the brow ridge juts
# over the white slit, the mask's nose juts further; under the mask's edge (from the nose back
# along the cheekbone, then down to the jaw's angle) the bare face: the upper lip, the mouth
# turned down at its corner, the jutting square chin, stubble along the jaw. No neck: the cowl
# runs on down into the shoulders, a little bounced light on its back.
PROFILE = [
    '.........e.......',
    '.......o.eLe.....',
    '.......oDoMHe....',
    '......oDAoMHe....',
    '......oDAoAMHe...',
    '.....oDAAoAMHe...',
    '.....oDAAoAMLHe..',
    '...ooDAAAAMLHHee.',
    '..oDAAAMMMMLHHHe.',
    '.oDAAMMMMMLLHXHe.',
    '.oDAAMMMMMLLLHHLe',
    'oDDAAMMMMMMLLLLHe',
    'oDDAAMMMMMMMooooo',
    'oDDAAAMMMMMAwWo..',
    'oDDAAAMMMMMMMLLe.',
    'oDDAAAAMMMMMMMLHe',
    'oDDAAAAAAAAAMMMLo',
    'orDAAAAoutttuooo.',
    'orDAAAAotssssSSv.',
    'orDAAAAotsssuuvm.',
    'orDAAAotgsssusSv.',
    'orDAAAoGggGGtsSSv',
    'orDAAADoqGGGGggsv',
    'oDDAAADDoooooooo.',
]

# Three quarters, turned to us and a little right: the ears at the dome's corners, the near
# one lit; the V of the brows down to the nose, a white slit under each; the mask's nose a lit
# wedge pointing down, its shadow on the far cheek; the mask's edge running out from it and down
# the sides to the jaw; the tight mouth, the shadow under the lip, the broad stubbled chin.
FRONT = [
    '..e..........o...',
    '.eLe........oAo..',
    '.eHe........oAo..',
    '.eHLe......oMAo..',
    '.eHLe......oMAo..',
    '.eHLMe....eLMAo..',
    'eLHLMMeeeeLLMADo.',
    'eLHHLMMMMMLMMADo.',
    'eLHXHLMMMMMMMAADo',
    'eLHHLLMMMMMMMAADo',
    'eLLLLMMMMMMMMAADo',
    'oMLooLMMMMMMooADo',
    'oMLLooMMMMMooLAro',
    'oAwwWooMLMooWwAro',
    'oAMMMMMLHDAAAAAro',
    'oAAMMMLHHDoAAAAro',
    'oAAottoHDouuoAADo',
    'oAosssttuuuttoDDo',
    'oAosgssttttuGGoDo',
    'oAogstvvvvtGGGoDo',
    'oAoGgusssstuGqoDo',
    'oDoGggtuttuGGqoDo',
    'oDDoGgggggGGqqoDo',
    'oDDDoovvvvvoooDDo',
]


def legend(cowl=None, skin=None, eyes=None):
    out = {**COWL, **SKIN, **EYES}
    for extra in (cowl, skin, eyes):
        if extra:
            out.update(extra)
    return out


def cowl(**kw):
    return Pic.text(PROFILE, legend(**kw))


def cowl_front(**kw):
    return Pic.text(FRONT, legend(**kw))


# The armoured suit (Knight): a graphite cowl of harder, faceted plates with a sharper gloss;
# the ears shorter and thicker, raked back; his skin a little warmer under the later game's
# harsher light, the stubble lighter.
KNIGHT_COWL = {'o': '#0b0b0e', 'e': '#2c2c36', 'D': '#18181d', 'A': '#25252c', 'M': '#34343d', 'L': '#4b4b58',
               'H': '#6e6e80', 'X': '#c4c4d4', 'r': '#2e3038'}
KNIGHT_SKIN = {'S': '#f4e2cf', 's': '#e2c1a8', 't': '#c49b82', 'u': '#9e7163', 'v': '#6b453b',
               'g': '#bcaca2', 'G': '#948378', 'q': '#6a5a54'}
KNIGHT_EARS = [
    '.................',
    '.................',
    '......ee.........',
    '......oLee.......',
    '.....oDLHMe......',
    '.....oDALHMee....',
    '.....oDAAMLHHe...',
]
KNIGHT_EARS_FRONT = [
    '.................',
    '.................',
    '.ee..........oo..',
    '.eHe........oAo..',
    '.eHLe......oMAo..',
    '.eHLMe....eLMAo..',
    'eLHLMMeeeeLLMADo.',
]
# The plates: one hard facet down the crown, lit on its near side.
KNIGHT_DOME = {
    8: '..oDAAAMMMLLHHHe.',
    9: '.oDAAMMMMLHLHXHe.',
}
KNIGHT_DOME_FRONT = {
    8: 'eLHXHLMMLMMMMAADo',
    9: 'eLHHLLMLHMMMMAADo',
}


def knight():
    rows = KNIGHT_EARS + PROFILE[7:]
    for i, r in KNIGHT_DOME.items():
        rows[i] = r
    return Pic.text(rows, legend(KNIGHT_COWL, KNIGHT_SKIN))


def knight_front():
    rows = KNIGHT_EARS_FRONT + FRONT[7:]
    for i, r in KNIGHT_DOME_FRONT.items():
        rows[i] = r
    return Pic.text(rows, legend(KNIGHT_COWL, KNIGHT_SKIN))


# The suit of the future (Beyond): the face covered whole, the jaw's shape still lit through the
# black; wide white eyes; the ears short and sharp, spread apart.
BEYOND_COWL = {'o': '#060608', 'e': '#26262e', 'D': '#121216', 'A': '#1c1c22', 'M': '#2a2a33', 'L': '#3e3f4c',
               'H': '#5c5e72', 'X': '#9a9cb2', 'r': '#262634'}
BEYOND_EYES = {'w': '#ffffff', 'W': '#c8d0e0'}
BEYOND_EARS = [
    '.................',
    '.................',
    '.................',
    '........e........',
    '.......oLe.......',
    '......oDLHe......',
    '.....oDAMLHe.....',
]
BEYOND_EARS_FRONT = [
    '.................',
    '.................',
    '.................',
    '.e............o..',
    '.eLe.........oAo.',
    '.eHLe.......oMADo',
    'eLHLMeeeeeeeLMADo',
]
# The lower face as the bare one, its skin and stubble turned to the suit's black (lit the same
# way, so the jaw still reads), the mask's edge gone; the mouth only a faint crease.
COVERED = {'S': 'H', 's': 'L', 't': 'M', 'u': 'A', 'v': 'D', 'g': 'L', 'G': 'M', 'q': 'A', 'm': 'A'}


def _covered(rows, first):
    """Rows from `first` on with the skin turned to black and the mask's edges smoothed away."""
    out = []
    for y, r in enumerate(rows):
        if y < first:
            out.append(r)
            continue
        r = ''.join(COVERED.get(ch, ch) for ch in r)
        if y < len(rows) - 1:
            # The mask's edge inside the face (not the outer outline) melts into the shade.
            r = r[0] + ''.join('A' if ch == 'o' and 0 < x < len(r) - 1 and r[x + 1] != '.' else ch
                               for x, ch in enumerate(r[1:], 1))
        out.append(r)
    return out


def beyond():
    rows = _covered(BEYOND_EARS + PROFILE[7:], 16)
    rows[13] = 'oDDAAAMMMMAwwWo..'
    return Pic.text(rows, legend(BEYOND_COWL, eyes=BEYOND_EYES))


def beyond_front():
    rows = _covered(BEYOND_EARS_FRONT + FRONT[7:], 16)
    rows[13] = 'owwwWooMLMooWwwro'
    return Pic.text(rows, legend(BEYOND_COWL, eyes=BEYOND_EYES))


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    sheet('fm-heads.png', [(pal.rows(p), pal.pal) for p in (cowl(), cowl_front(), knight(), knight_front(), beyond(),
                                                          beyond_front())], scale=9, per_row=6)
    print('ok')
