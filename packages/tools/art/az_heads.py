"""Azure's head, drawn from scratch as pixel art (no original head under it): Liara T'Soni of Mass
Effect, an asari, 106 years old and barely grown up by her people's measure.

No hair: a scalp crest of smooth cartilage, ONE shell sweeping back from a high clean forehead over
the skull and past it into a single point (four pixels behind the head, a little above the eyes),
grooves running along it from the front to the point; under its back edge the neck tendrils, a
dark bundle down to the collar; no ears. Saturated azure skin, big blue eyes under heavy dark lids,
thin painted brows arched high, plum freckles on the cheeks and the nose, full lilac lips, a small
upturned nose, a soft small chin.

One light for the cast, from the upper front: the crest's top and the forehead catch it (the crest
speckled lighter on its lobes), each lobe lit on top and dark under it, the grooves darkest; the
face lit on the planes that face forward (the forehead, the cheekbone, the bridge and the tip of
the nose, the chin), the brow shading the eye socket, the shadow under the nose and the lower lip,
the cheek turning darker toward the jaw, the jaw's shade on the neck. Skin in six tones that shift
from a cool cyan-blue in the light to a violet indigo in the shade, a dark indigo outline in the
shade and a lighter edge where the light hits.

The profile (25) faces right on Blaise's 16 x 17 box (the chin and the neck where hers are); the
look tool turns it into 26-28. 29 is the face turned to us, nearly front on and facing right as
the other bosses' are: the crest's lobes fanning up from the forehead, the near cheek on the left
going into shade, the far one lit; the tendrils behind the jaw. 76-78 are the profile blinking
(shut, half shut) and wincing. Every grid marks Blaise's head box (`*_BOX`, its top left corner in
the grid): `centred` pads the picture so the box sits where the game puts a head."""
from heads import Pic

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
    '....KggsSSSSSsttbbS..',  #  6  the brow
    '......KDTTtttssbSWS..',  #  7
    '.......KDTTttstlllS..',  #  8  the lid
    '.......KnNTtssteIIsS.',  #  9  the eye: white, the iris under the lid's shade
    '.......KnNnTtsftijSW.',  # 10  the iris and its glint, a freckle, the nose's tip
    '.......KnNnTtsSfWft..',  # 11  freckles round the cheekbone
    '.......KnNnTtsSWSmL..',  # 12  the lips
    '.......KnNnDTtssSML..',  # 13
    '........KnNDDTtsWS...',  # 14  the chin
    '.........KnTDDDTt....',  # 15
    '..........KnTTTt.....',  # 16  the neck
]

# --------------------------------------------------------------------------------------------
# The face turned to us (29): column i is x + 1 of the box, row j is its y.
# --------------------------------------------------------------------------------------------
FRONT_BOX = (1, 0)
FRONT = [
    '.....TT.TttT.TT...',  #  0  the lobes' tops
    '....KtsgSWWgWSt...',  #  1
    '...KTtsgSSWgWSt...',  #  2
    '..KThtsgSWWgSWSt..',  #  3
    '..KDtgtsSSSSShSsT.',  #  4
    '..KDgtsbbbSSbbSst.',  #  5  the brows
    '..KnDtbsssSSsssbt.',  #  6
    '..KnTlllltSslllst.',  #  7  the lids
    '..KnTteIISWSeIISt.',  #  8  the eyes
    '..KnTteijSWSeijSt.',  #  9
    '..KnTtfsfsWSSfSst.',  # 10  freckles, the nose's tip
    '...KnTtsstTsSSsT..',  # 11
    '...KnTtssmLmSstK..',  # 12  the lips
    '....KnTtsMLMstK...',  # 13
    '.....KnTtstsTK....',  # 14  the shade under the lower lip
    '......KDTsStK.....',  # 15  the chin
    '.......KDDTK......',  # 16  the neck
]

# The profile's eyes shut (76), half shut (77), screwed up with the mouth open (78): rows painted
# over the profile ('.' keeps a pixel).
FACES = {
    76: {8: '...............ssS...', 9: '...............lll...', 10: '...............tsS...'},
    77: {8: '...............sss...', 9: '...............lll...', 10: '...............eij...'},
    78: {6: '...............sbs...', 7: '...............bbs...', 8: '...............sss...',
         9: '...............lll...', 10: '...............tsS...', 12: '.................mL..', 13: '.................Mm..'},
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


def profile(face=None, extra=None):
    return centred(Pic.text(overlay(PROF, FACES.get(face)), legend(extra)), PROF_BOX)


def front(extra=None):
    return centred(Pic.text(grid(FRONT), legend(extra)), FRONT_BOX)


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    pics = [Pic.orig(0), profile(), Pic.orig(0, True), front()] + [profile(f) for f in FACES]
    sheet('az-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=12)
    print('ok')
