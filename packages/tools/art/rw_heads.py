"""Rewind's heads, drawn from scratch as pixel art (no original head under them): Max Caulfield.

* Life is Strange (2015): a straight, chin-length auburn bob, smooth as a helmet, its ends cut in
  points at the jaw over the ear; a thick fringe swept from the part (her right) across the
  forehead over her left brow, a visor over the brow in profile; blue eyes with drooping outer
  corners, freckles over the nose, a soft oval face, a small upturned nose, a small closed mouth.
* Double Exposure (2024): ten years on, the same face, the hair grown past the shoulders without
  a fringe, redder, under a slouchy mustard beanie pushed back off the forehead (ribbed cuff).

One light for the cast, from the upper front: the crown's highlight band and the visor's top
lit, the back of the head and the nape dark; the face lit, the fringe's and the side lock's shade
on the skin, the far cheek, under the nose, the lip and the jaw in shade. Skin in five tones that
warm toward red in the shadows and toward yellow-white in the light.

The profile (25) faces right on Blaise's 16 × 17 box (the chin and neck where hers are); the
look tool turns it into 26-28. 29 is the face turned to us (3/4, facing right: her part on the
near side, the fringe sweeping to the far temple). 76-78 are the profile blinking (shut, half
shut) and wincing. The Double Exposure heads are 21 rows: two over the box for the beanie, two
under it for the hair on the shoulders, the face where the bob's is."""
from heads import Pic

# Skin: fair with a pink undertone; shadows warmer and redder, the light yellower.
SKIN = {'K': '#70302a', 'T': '#b8604e', 't': '#da9078', 's': '#f0b898', 'S': '#fddcc2', 'W': '#fff2e2'}
# Eyes (white, dark and light blue iris, lash), brow, lips, freckles, the cheek's warmth.
FACE = {'w': '#eae4e6', 'I': '#2c4a86', 'i': '#4a80c6', 'j': '#8cc0f0', 'p': '#2a1a1e', 'b': '#5c3424',
        'L': '#d47c72', 'l': '#a24c44', 'f': '#cc8466', 'r': '#f4a490'}
# Life is Strange: auburn brown (outline, deep, shadow, mid, light, highlight, sheen).
HAIR_LIS = {'0': '#2c160e', 'd': '#4c2818', 'm': '#6c3c24', 'h': '#8c5634', 'H': '#ac7246', 'Y': '#cc9662',
            'y': '#e2b680'}
# Double Exposure: longer and redder.
HAIR_DE = {'0': '#2e120a', 'd': '#521f12', 'm': '#76321c', 'h': '#9a4a2a', 'H': '#bc6a3e', 'Y': '#d88c58',
           'y': '#eeae78'}
# The beanie: mustard knit (highlight → outline), its ribbed cuff folded up.
BEANIE = {'A': '#f6cc6a', 'B': '#e6ae44', 'C': '#c88c26', 'E': '#9c6616', 'F': '#6a420c', 'G': '#3e2606'}


def legend(hair, extra=None):
    return {**SKIN, **FACE, **hair, **(extra or {})}


def over(base, rows, dy=0, h=None):
    """`base` rows moved down `dy` in an `h`-row box, then `rows` painted over them ('.' keeps a
    pixel, '_' erases it)."""
    h = h or len(base) + dy
    w = len(base[0])
    out = [['.'] * w for _ in range(h)]
    for y, r in enumerate(base):
        for x, c in enumerate(r):
            if 0 <= y + dy < h:
                out[y + dy][x] = c
    for y, r in enumerate(rows):
        for x, c in enumerate(r[:w]):
            if c == '_':
                out[y][x] = '.'
            elif c != '.':
                out[y][x] = c
    return [''.join(r) for r in out]


# --------------------------------------------------------------------------- Life is Strange
LIS_PROFILE = [
    '....0dmhhhm0....',
    '..0dmhHHYYHhm0..',
    '.0dmhHHYyyYHHhm.',
    '0dmhhHHHYYYHHHm.',
    '0dmhmhHHHHHYHHHH',
    '0dmhmhhhHhmhHhHm',
    '0dmhmhHtsmtShbS.',
    '0dmhmhHtsSSSppW.',
    '0dmhmhHtSSSwiIS.',
    '0dmmhhHtsSWsjiW.',
    '0dmmhhHhtSSfrSSS',
    '0dmmhhHhtsSSSst.',
    '0dmmhhHhtssssSL.',
    '0dmhhmhmtsssslL.',
    '0dmmdmmdTtsstS..',
    '.0..d..dKTttT...',
    '.........KTTK...',
]

LIS_FRONT = [
    '....0dmhhmd0....',
    '..0dhmhHHHhm0...',
    '.0dhmhHYYYYHhm0.',
    '0dhHmHHhYyYHhhm0',
    '0dhmHHHYhHYHhhm0',
    '0dhsSSHHYhHHhhm0',
    '0dhsbbSsmHhHhmm0',
    '0dhspppSttpmhmd0',
    '0dhswIISSswItmd0',
    '0dhswijSWswitmd0',
    '0dhsSWfSStfstmd0',
    '0dhsSSSStsstTmd0',
    '0dhtsSSsllstThd0',
    '0dmhtsssrstThmd0',
    '0dmdTtsStsTKdmd0',
    '.0d.KTtssTK..d0.',
    '.....KTTTK......',
]

# The profile's eyes shut (76), half shut (77), screwed up with the mouth open (78).
BLINK = {
    76: ['', '', '', '', '', '', '', '............SS.', '...........SppS', '............SS.'],
    77: ['', '', '', '', '', '', '', '............SS.', '...........ppp.', '............ii.'],
    78: ['', '', '', '', '', '', '.............b.', '............bSS', '...........SppS', '............pS.',
         '', '', '', '.............p.'],
}


def blink(rows, face, dy=0):
    return over(rows, [''] * dy + BLINK[face], 0, len(rows))


def lis_profile(face=None):
    return Pic.text(blink(LIS_PROFILE, face) if face else LIS_PROFILE, legend(HAIR_LIS))


def lis_front():
    return Pic.text(LIS_FRONT, legend(HAIR_LIS))


# -------------------------------------------------------------------------- Double Exposure
# The bob's face two rows down in a 21-row box; the beanie, the forehead and the long hair over it.
DE_PROFILE = over(LIS_PROFILE, [
    '..GFFFFFG_______',
    '.FCBBBBBCFG_____',
    'GCBBAAABBBCF____',
    'GCBAAAABBBBCF___',
    'GCBBAABBBBBBCF__',
    'GCCBBBBBBBEEFS__',
    'GECBBBEEEBCBFS__',
    'GEEECBCBCBCFtSS_',
    '0FBCBFdh.SS.b...',
    '', '', '', '', '', '', '',
    '0dmhhmhd',
    '0dmhhmd.',
    '0dmhmd..',
    '.0dmd___________',
    '..00____________',
], dy=2, h=21)

DE_FRONT = over(LIS_FRONT, [
    '..GFFFFFG_______',
    '.FCBBBBBCFG_____',
    'GCBBAAABBBCFG___',
    'GCBAAAAABBBBCFG_',
    'GCEBAAABBBBBCEEG',
    'GBCBCBCBCBCBCBCG',
    'GFCECECECECECEFG',
    '0dhhssSSSSsthmd0',
    '0dhsbbSSSsbbtmd0',
    '..........ppt...',
    '', '', '', '', '', '', '',
    '0dmh........hmd0',
    '0dmd.....__.dmd0',
    '.0dm________md0_',
    '__00________00__',
], dy=2, h=21)


def de_profile(face=None):
    rows = DE_PROFILE
    if face:
        rows = blink(rows, face, 2)
    return Pic.text(rows, legend(HAIR_DE, BEANIE))


def de_front():
    return Pic.text(DE_FRONT, legend(HAIR_DE, BEANIE))


if __name__ == '__main__':
    from heads import Palette
    from gridpng import sheet
    pal = Palette()
    pics = [lis_profile(), lis_front(), de_profile(), de_front()] + [lis_profile(f) for f in BLINK]
    sheet('rw-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=12)
    print('ok')
