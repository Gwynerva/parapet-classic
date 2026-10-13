"""Rewind's heads, drawn from scratch as pixel art (no original head under them): Max Caulfield.

* Life is Strange (2015): an eighteen-year-old girl's soft face, a small narrow chin, rounded
  cheeks, big blue eyes under a dark upper lash line, thin brows, a tiny upturned nose, small
  rose lips, a few faint freckles over the nose; her brown bob to the jaw, its ends cut in points
  that curl in toward the chin, framing the face; the fringe swept from the part (her right)
  across the forehead to her left temple, its tips over her left brow.
* Double Exposure (2024): ten years on, the same face, the hair grown to the shoulders without
  a fringe, redder, under a slouchy mustard beanie pushed back off the forehead (ribbed cuff).

One light for the cast, from the upper front, soft and broad: the crown's highlight band, the
fringe and the face's front lit; the back of the head, the far side, the hair's underside, under
the chin and the neck in shade. Skin in few, close tones (no dark pixels on the cheeks or jaw),
warmer and pinker in the shade, a touch of blush on the cheeks; the face's edge a warm skin tone,
never black.

The profile (25) faces right on Blaise's 16 x 17 box (the chin and neck where hers are); the
look tool turns it into 26-28. 29 is the face turned to us (3/4, facing right: her part on the
near side, the fringe sweeping to the far temple). 76-78 are the profile blinking (shut, half
shut) and wincing. The bob's part makes her two sides differ: `side='left'` gives her left side
(25:left, 29:left and the faces', mirrored on screen while she faces left), where the fringe
falls over the brow. The Double Exposure heads are 21 rows: two over the box for the beanie, two
under it for the hair on the shoulders, the face where the bob's is."""
from heads import Pic

# Skin: fair with a pink undertone, close tones (highlight, light, mid, shade, deep shade, the
# warm edge under the chin).
SKIN = {'W': '#fff0de', 'S': '#fcdcc2', 's': '#f3c2a2', 't': '#e4a286', 'T': '#c97a68', 'K': '#9c5244'}
# Eyes (lash line, white, dark and light blue iris, catchlight), brow, rose lips (the mouth's line,
# the upper lip, the lighter lower lip), the cheeks' blush, faint freckles.
FACE = {'p': '#2e1820', 'w': '#f7f1f1', 'I': '#2d58a8', 'i': '#5e9de2', 'j': '#e8f6ff', 'b': '#9a6644',
        'n': '#a84a56', 'L': '#d0707a', 'l': '#eea0a2', 'r': '#f6aca0', 'f': '#dc9c80'}
# Life is Strange: warm brown (outline, deep, shadow, mid, light, highlight, sheen).
HAIR_LIS = {'0': '#341f17', 'd': '#513224', 'm': '#6e4631', 'h': '#8c5f40', 'H': '#aa7b52', 'Y': '#c89c6c',
            'y': '#e2bf8e'}
# Double Exposure: longer and redder.
HAIR_DE = {'0': '#3a160c', 'd': '#5c2414', 'm': '#7e361e', 'h': '#a04e2c', 'H': '#c06c40', 'Y': '#da8e5a',
           'y': '#f0b07c'}
# The beanie: mustard knit (highlight -> outline), its ribbed cuff folded up.
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


def _check(rows, w=16):
    assert all(len(r) == w for r in rows), [(i, len(r)) for i, r in enumerate(rows) if len(r) != w]
    return rows


# --------------------------------------------------------------------------- Life is Strange
LIS_PROFILE = _check([
    '.....000000.....',
    '...00hhHHHh00...',
    '..0hhHYYyyYHh0..',
    '.0hhHYHHHHHYHh..',
    '.0dhHHhHHHHHHh..',
    '.0dhhHHhHHhHHH..',
    '.0dhhHHHhhtSbbS.',
    '.0dmhhHHHmsSSSS.',
    '.0dmhhHHhmspppS.',
    '.0dmhmhHhmpwIjS.',
    '.0dmhmhHhmssiiSs',
    '.0ddmmhhHmsrfSt.',
    '.0dmdmhhhmtssnL.',
    '..0dmdmhhmtsssl.',
    '...0dmdmhmTsss..',
    '....0d0d0h.TT...',
    '.........KTt....',
])

LIS_FRONT = _check([
    '.....000000.....',
    '...00hHHHhh00...',
    '..0hHYyyYHhhm0..',
    '.0hHYHHHHYHHhm0.',
    '.0hHmHHHHHHHhh0.',
    '.0HhtsmHYYHHhmh0',
    '0hHmsbbtmHYYhmh0',
    '0hhmSSSSstmHhmh0',
    '0mhmSpppStpppmh0',
    '0mhspjIwSsjIwtm0',
    '0mhsSiiwStiistm0',
    '0mhsrsfsWtsfrtm0',
    '.0hmsSSsLLsttm0.',
    '.0mhmtsslsstmh0.',
    '.0dhm..tSt..mh0.',
    '..0hd..TTT..h0..',
    '...d...TtT...d..',
])

# The profile's eyes shut (76), half shut (77), screwed up with the mouth open (78): rows painted
# over the profile ('.' keeps a pixel).
BLINK = {
    76: ['', '', '', '', '', '', '', '', '..........sSSS', '..........pppp', '...........sSS'],
    77: ['', '', '', '', '', '', '', '', '..........sSSS', '..........pppp', '...........wii'],
    78: ['', '', '', '', '', '', '............SS', '...........bbS', '..........sSpS', '..........ppSS',
         '...........sSS', '', '.............pL', '.............sl'],
}


def blink(rows, face, dy=0):
    return over(rows, [''] * dy + BLINK[face], 0, len(rows))


# Her left side (seen while she runs left, the picture mirrored): the fringe sweeps down over the
# temple and the brow, its tips just over the eye.
FRINGE_LEFT = ['', '', '', '',
               '',
               '.0dhhHHhHHHYYH..',
               '..........HHYHS.',
               '..........thtmS.']

# The 3/4 face from her left (mirrored on screen): the part on the far side, the fringe swept
# from it to the near temple over the near brow, the far brow and forehead open.
FRONT_LEFT = ['', '', '', '',
              '.0hHHHHHHHHmHh0.',
              '.0HHYYHHHhmtsmh0',
              '0hHYHHhmtSbbSmh0',
              '0hhHhmtSSSSStmh0',
              '0mhmSpppSSpppmh0']


def lis_profile(face=None, side=None):
    rows = blink(LIS_PROFILE, face) if face else LIS_PROFILE
    if side == 'left':
        rows = over(rows, FRINGE_LEFT)
    return Pic.text(rows, legend(HAIR_LIS))


def lis_front(side=None):
    rows = over(LIS_FRONT, FRONT_LEFT) if side == 'left' else LIS_FRONT
    return Pic.text(_check(rows), legend(HAIR_LIS))


# -------------------------------------------------------------------------- Double Exposure
# The same face two rows down in a 21-row box; over it the beanie (pushed back, its ribbed cuff
# across the top of the forehead), the open forehead with both brows where the fringe was, the
# hair parted to the side and grown to the shoulders.
DE_PROFILE = _check(over(LIS_PROFILE, [
    '...GFFFFG_______',
    '.GFCBBBBCFG_____',
    'GCBAAABBBBCFG___',
    'GBAAAABBBBBBCG__',
    'GBAAABBBBBBBBCG_',
    'GCBBBBBBBBBBBCEG',
    'GECBCBCBCBCBCBEG',
    'GFECECECECECECG_',
    '', '', '', '', '', '',
    '.0dmdmhhh',
    '.0dmdmhhh',
    '.0dmdmhhm',
    '.0dmdmhhmm',
    '.0dmdmhm',
    '..0dmdmh0',
    '...0d0d0',
], dy=2, h=21))

DE_FRONT = _check(over(LIS_FRONT, [
    '...GFFFG________',
    '.GFCBBBCFG______',
    'GCBAAABBBCFG____',
    'GCBAAAABBBBCFG__',
    'GCBAABBBBBBBBCFG',
    'GECBCBCBCBCBCBEG',
    'GFECECECECECECFG',
    '0mhhtsssstmHhhm0',
    '0mhmsbbSSstHhhm0',
    '0hhmSSSSSsstHmh0',
    '0mhmSpppSSpppmh0',
    '', '', '',
    '0dh..........mh0',
    '0mhhm.......mhm0',
    '0mhhm.......mhm0',
    '0mhhd.......mhm0',
    '0dmhh.......hmd0',
    '.0dmh.......hd0.',
    '..0d0.......0d..',
], dy=2, h=21))


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
