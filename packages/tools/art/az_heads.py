"""Azure's head, drawn from scratch as pixel art (no original head under it): Liara T'Soni of Mass
Effect, an asari, 106 years old and barely grown up by her people's measure.

No hair: a scalp crest of smooth cartilage, ONE shell sweeping back from a high clean forehead over
the skull and past it into a single point (four pixels behind the head, a little above the eyes),
grooves running along it from the front to the point; under its back edge the neck tendrils, a
dark bundle down to the collar; no ears. Saturated azure skin, a soft young heart-shaped face (the
cheeks rounding in to a small narrow chin), big blue eyes under dark upper lashes flicked up at the
outer corner, thin painted brows set high, plum freckles under the eyes, a small upturned nose (a
shade and a lit tip), small lilac lips.

One light for the cast, from the upper front, in soft broad tones rather than carved planes: the
crest's tops and the forehead catch it (the crest speckled lighter on its front lobe), the grooves
dark slits with the lobe lit under them; the face light and low in contrast, the near cheek and the
nose's tip lit, the far side of the face a tone darker, the underside of the jaw and the neck in
shade, nothing dark on the cheeks or the jaw. Skin in six tones that shift from a cool cyan-blue in
the light to a violet indigo in the shade, a dark indigo outline in the shade and a lighter edge
where the light hits.

The profile (25) faces right on Blaise's 16 x 17 box (the chin and the neck where hers are); the
look tool turns it into 26-28. 29 is the face turned to us, nearly front on and facing right as the
other bosses' are: the crest's three lobes over the forehead (as she is seen from the front), the
grooves meeting above it, the temples flaring, the face narrowing to the chin; the tendrils are
behind the neck there. 76-78 are the profile blinking (shut, half shut) and wincing. Every grid
marks Blaise's head box (`*_BOX`, its top left corner in the grid): `centred` pads the picture so
the box sits where the game puts a head."""
from heads import Pic, centred
from lookgen import padded_rows

# Skin: highlight (cool, a little cyan) → light → mid-light → mid → shadow → deep (violet) → the
# outline in shade.
SKIN = {'W': '#a8cdf6', 'S': '#7fa6ea', 's': '#6189dc', 't': '#4d6ecb', 'T': '#3d52ad', 'D': '#2e378a',
        'K': '#1a1a52'}
# The crest: its lighter speckles, the grooves; the neck tendrils (dark, lit).
CREST = {'h': '#c4def9', 'g': '#20225e', 'n': '#2a3274', 'N': '#41539f'}
# Eyes (white, its shade, iris, its dark, the glint), the heavy lid and lashes, the painted brow;
# lips (light, mid, the mouth's line); plum freckles.
FACE = {'e': '#eef4ff', 'E': '#b4c0dc', 'i': '#3a64f0', 'I': '#1c2a8c', 'j': '#9cc0ff', 'l': '#14143a',
        'b': '#262a6e', 'L': '#9282d8', 'm': '#6c5cb6', 'M': '#3a2a72', 'f': '#5a3e8c'}


def legend(extra=None):
    return {**SKIN, **CREST, **FACE, **(extra or {})}


# --------------------------------------------------------------------------------------------
# The profile (25), facing right: column i is x + 4 of Blaise's head box, row j is its y.
# --------------------------------------------------------------------------------------------
PROF_BOX = (4, 0)
PROF = [
    '.......TTttttt.......',  #  0  the crest's top
    '.....KTtsSSWWWSt.....',  #  1
    '...KDTtsShgggSWSs....',  #  2  the upper groove starts
    '.KDTTgggggtSSSWWSs...',  #  3
    'KDTggtsSSShSggSWSs...',  #  4  the point; the lower groove starts
    '..KDTTTgggggtsSWSSs..',  #  5
    '....KggnTsSSSSssbbS..',  #  6  the brow; the tendrils start under the crest
    '......KnNtsSSSlsssS..',  #  7  the lash's flick
    '......KnNTtsSSSlllS..',  #  8  the upper lashes
    '.......KnNtsSSSeiSS..',  #  9  the eye: white, the iris lit
    '.......KnNtsSSWEISSW.',  # 10  the iris darker below; the cheekbone's light, the nose's tip
    '.......KnNTtsSfSfSs..',  # 11  freckles under the eye, the dip under the nose
    '........KnNtsSSSSMm..',  # 12  the lips
    '........KnNTtsSSSL...',  # 13  the lower lip
    '.........KnTttsSSs...',  # 14  the small chin, the jaw climbing back
    '..........KnTttsT....',  # 15
    '..........KnTttK.....',  # 16  the neck
]

# --------------------------------------------------------------------------------------------
# The face turned to us (29): column i is x + 1 of the box, row j is its y.
# --------------------------------------------------------------------------------------------
FRONT_BOX = (1, 0)
FRONT = [
    '........TssT......',  #  0  the front lobe's top
    '.....Tt.SWhS.tT...',  #  1  the side lobes, the notches between
    '....TsSgSWWSgsD...',  #  2  the grooves
    '...TsSSsgWSgsstD..',  #  3  meeting over the forehead
    '..TgssSSSWSSsstD..',  #  4  the near lobe's end over the temple
    '..DtgsbbSSSSbbtD..',  #  5  the painted brows
    '...TsSSSSSSSsstD..',  #  6
    '...TslsssSSssslD..',  #  7  the lashes' flicks
    '...TSslllSSllltD..',  #  8  the upper lashes
    '...TSseijSSeijtD..',  #  9  the eyes: white, the iris lit, its glint
    '...TSsEIisSEIitD..',  # 10  the iris darker below
    '...TsWfSstWsfstD..',  # 11  freckles, the nose's shade and tip
    '....TsSSSsSsstD...',  # 12  the cheeks rounding in
    '.....TsSSmMmtD....',  # 13  the lips
    '......TsSsLsD.....',  # 14  the lower lip's light
    '.......DtSsD......',  # 15  the small chin
    '.......DttsD......',  # 16  the neck
]

# The profile's eyes shut (76), half shut (77), screwed up with the mouth open (78): rows painted
# over the profile ('.' keeps a pixel).
FACES = {
    76: {7: '..............s......', 8: '...............sSS...', 9: '..............lllS...',
         10: '...............sS....'},
    77: {8: '...............ssS...', 9: '...............lll...'},
    78: {6: '................ss...', 7: '..............sbbs...', 8: '...............ssS...',
         9: '..............lllS...', 10: '...............sS....', 13: '.................ML..'},
}


def overlay(rows, paint):
    rows = [list(r) for r in padded_rows(rows)]
    for y, row in (paint or {}).items():
        for x, c in enumerate(row):
            if c != '.':
                rows[y][x] = c
    return [''.join(r) for r in rows]


def profile(face=None, extra=None):
    return centred(Pic.text(overlay(PROF, FACES.get(face)), legend(extra)), PROF_BOX)


def front(extra=None):
    return centred(Pic.text(padded_rows(FRONT), legend(extra)), FRONT_BOX)


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    pics = [Pic.orig(0), profile(), Pic.orig(0, True), front()] + [profile(f) for f in FACES]
    sheet('az-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=12)
    print('ok')
