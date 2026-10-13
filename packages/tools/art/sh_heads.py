"""Shahzada's heads, drawn from scratch: the prince of the Sands of Time (a narrow tanned face, a
long straight nose, a scowl under low heavy brows, pale blue-cyan eyes, a chin-strip beard,
straight dark-brown hair to the jaw parted in the middle, a fresh cut over his left brow), and the
same face as the Warrior Within (shaggy black hair to the shoulders, stubble and a short beard),
the Dark Prince (charcoal skin, glowing eyes and veins of sand, hair standing up like smoke with
embers at its tips) and the wanderer of 2008 (an open face, a blue head-wrap with a red band,
spiky hair over it, stubble).

Every picture is text over a legend of semantic characters, lit from the upper front like the
rest of the cast: in the profile `25` (facing right) the forehead, the brow ridge, the bridge of
the nose and the cheekbone are lit, the eye socket, the nose's underside, the jaw's underside and
the neck in shade; in the 3/4 face `29` (turned right) the near cheek is lit and the far one
narrow and a step darker, the nose's shadow falling toward it. Skin shadows go redder, highlights
yellower; a dark outline in shade and a warm lit edge (sel-out) where the light hits. The hair is
clumps with a sheen band over the crown, dark at the roots, the nape and under the clumps.

The look tool turns 25 into 26-28; 76 / 77 (blinks) and 78 (the pain face: "no, no, that's not
how it happened") are drawn from the profile."""
from heads import Pic, Palette
from gridpng import sheet

# Skin: highlight, light, mid, shadow, deep shadow (shadows redder, the highlight yellower), the
# outline in shade and the lit edge.
SKIN = {
    '1': '#ffdca2',
    '2': '#efb07a',
    '3': '#d28a55',
    '4': '#a95e35',
    '5': '#73301e',
    'o': '#3a1108',
    'q': '#c47243',
}
# Hair: sheen, light, mid, dark, outline (dark brown with chestnut glints).
HAIR = {'H': '#9a6a40', 'h': '#6a4428', 'm': '#46291a', 'd': '#2a170d', 'k': '#120804'}
FACE = {
    'w': '#efe4d2',  # eye white
    'W': '#c9b9a4',  # eye white in shade
    'e': '#7ae6ea',  # iris, pale blue-cyan
    'E': '#2f8f9c',  # iris in shade
    'b': '#25130a',  # brows, lids
    'B': '#2e190e',  # the chin-strip beard
    'L': '#5a1e14',  # the mouth's line
    'l': '#c27a5a',  # lower lip
    'c': '#b0281c',  # the cut over his left brow
}
SOT = {**SKIN, **HAIR, **FACE}

# fmt: off
# The profile, facing right: the hair a heavy straight curtain to the jaw, hiding the ear, its
# ends split; the brow low over the eye, the long nose, the thin mouth, the beard's drop under
# the chin.
SOT_25 = [
    #0123456789ABCDEFG
    '.....kkkkkk......',  # 0
    '...kkmhhhhhkk....',  # 1
    '..kdmhhhHHHHhk...',  # 2
    '.kdmhhhHHhhHHhk..',  # 3
    '.kdmhhmhhhhhhHhk.',  # 4
    '.kdmhmhhhmhhd31q.',  # 5
    'kdmmhhmhhhhd321q.',  # 6
    'kdmhmhhmhhd3bbb2.',  # 7
    'kdmhmhmhhd44weq..',  # 8
    'kdmhmdhhmd42321q.',  # 9
    'kdmhmdhmmd4322211',  # 10
    'kddmdmhmmd42234o.',  # 11
    'kdmdmdmhmd4322q..',  # 12
    'kdmdmdmdmd433LL..',  # 13
    'kdkdmdmdko5432l..',  # 14
    '.k.kdkdk.oo54BB..',  # 15
    '.........ooo.BB..',  # 16
]
# The 3/4 face, turned right: the parting's V at the crown, two curtains of hair to the jaw, the
# brows drawn down to the nose, the near cheek lit, the far one narrow and shaded, the nose's
# shadow falling toward it, the beard a thin strip from the lip to the chin.
SOT_29 = [
    #0123456789ABCDEFG
    '.....kkkkkkk.....',  # 0
    '...kkmhhHdHhkk...',  # 1
    '..kmhhHHhdhHHhk..',  # 2
    '.kmhhHHhd1dhHhmk.',  # 3
    '.kmhhhhd212dhhmk.',  # 4
    'kmhhhmd21112dhmmk',  # 5
    'kmhhmd321112cdmmk',  # 6
    'kmhmd3bb212bb4dmk',  # 7
    'kmhd43web2bew4dmk',  # 8
    'kmhd4223213344dmk',  # 9
    'kdhd4212214344dmk',  # 10
    'kdhd432345444dmk.',  # 11
    'kdmdd4322334odhk.',  # 12
    'kdmdmo43LLLodmdk.',  # 13
    '.kdkdmo43l4ok.k..',  # 14
    '.k..k..o4BBo.....',  # 15
    '........oBo......',  # 16
]
# fmt: on

FACE_CHARS = set('12345oqwWeEbBLlc')


def sot(front=False):
    """The prince of the Sands of Time."""
    return Pic.text(SOT_29 if front else SOT_25, SOT)


def face_rows(front=False):
    """His face alone (skin, eyes, brows, nose, mouth, beard), the hair left out."""
    rows = SOT_29 if front else SOT_25
    return [''.join(ch if ch in FACE_CHARS else '.' for ch in r) for r in rows]


def layered(front, layer25, layer29, legend, pad=(0, 0, 0, 0), face_legend=SOT, drop=''):
    """The face padded (left, top, right, bottom) with a look's own hair or headgear painted
    over it: '.' keeps the face, ' ' erases, other characters paint from `legend`; face
    characters in `drop` are left out first (the cut, the beard)."""
    rows = [''.join('.' if ch in drop else ch for ch in r) for r in face_rows(front)]
    p = Pic.text(rows, face_legend)
    p.pad(*pad)
    p.paint(layer29 if front else layer25, legend)
    return p


# --- the faces shown instead of the profile now and then: blinks and the pain face -----------

def blink(p, lid, lash):
    """Eyes shut: the eye's white goes to the lid's skin, the iris to the lash line."""
    for x, y in p.where([SOT['w'], SOT['W']]):
        p.set(x, y, lid)
    for x, y in p.where([SOT['e'], SOT['E']]):
        p.set(x, y, lash)
    return p


def pain(p, lid, lash, mouth, x_mouth, y_mouth):
    """Screwed up: eyes shut tight and the mouth dropped open a pixel ("no, no, no...")."""
    blink(p, lash, lash)
    p.set(x_mouth, y_mouth, mouth)
    p.set(x_mouth + 1, y_mouth, mouth)
    return p


def faces(head25, legend, mouth_at=(13, 14)):
    """76 / 77 (blinks) and 78 (pain) of a profile picture whose face uses `legend`."""
    lid, lash, mouth = legend['4'], legend['b'], legend['L']
    x, y = mouth_at
    b = blink(head25.copy(), lid, lash)
    return {'76': b, '77': b.copy(), '78': pain(head25.copy(), lid, lash, mouth, x, y)}


def synced(rows, pad, front, legend, drop=''):
    """A look's own head drawn in full over the template of the SoT face (padded by `pad`): where
    it has a face character and the SoT face has one too, the SoT's is taken (so the face stays
    one person's whatever is retouched); face characters in `drop` become plain skin ('2')."""
    face = face_rows(front)
    l, t = pad[0], pad[1]
    out = []
    for y, r in enumerate(rows):
        row = ''
        for x, ch in enumerate(r):
            fy, fx = y - t, x - l
            if ch in FACE_CHARS and 0 <= fy < len(face) and 0 <= fx < len(face[fy]) and face[fy][fx] in FACE_CHARS:
                ch = face[fy][fx]
            row += '2' if ch in drop else ch
        out.append(row)
    return Pic.text(out, legend)


# --- Warrior Within: seven years on, black shaggy hair to the shoulders falling over the brow,
# stubble and a short beard over the jaw, the skin a shade darker ---------------------------------

WW_SKIN = {'1': '#f6cc9c', '2': '#dea072', '3': '#bf7c4e', '4': '#93553a', '5': '#5e2c1e', 'o': '#2a0e08',
           'q': '#b0663e'}
# Black hair with a cool grey sheen.
WW_HAIR = {'H': '#6a5e68', 'h': '#40363c', 'm': '#231c20', 'd': '#140f12', 'k': '#050304'}
# Stubble and the short beard: the skin's tones greyed and darkened, by lightness.
WW_STUBBLE = ['#c49a76', '#a07858', '#7a5640', '#56382a', '#34201a']
WW_PAD = (1, 2, 1, 2)

# fmt: off
# Layers over the face (padded by WW_PAD): '.' keeps the face.
WW_25 = [
    #0123456789ABCDEFGHI
    '...................',  # 0
    '....k..k...k.......',  # 1
    '...kmkkhkkkhk......',  # 2
    '..kmhhhhHHhhhk.....',  # 3
    '.kmhhHHHHHHHhhk....',  # 4
    '.kmhHHhhhhhHHHhk...',  # 5
    'kmhhhmhhmhhhhHHhk..',  # 6
    'kmhmhhmhhmhhmhhd...',  # 7
    'kdmhmhhmhhmhhmd....',  # 8
    'kdmmhmhhmhhmhd.....',  # 9
    'kdmhmmhhmhmhd......',  # 10
    'kdmhhmmhhmhmd......',  # 11
    'kmdhhmdhhmhmd......',  # 12
    'kmdmhhmdhhmhd......',  # 13
    'kdmdhhmdhmhdd......',  # 14
    'kddmhhmdmhmd.......',  # 15
    '.kdmdhmdmhd........',  # 16
    '.kddmdhmdmk........',  # 17
    '..kdkmdkdk.........',  # 18
    '..k.kdk.dk.........',  # 19
    '.....k...k.........',  # 20
]
WW_29 = [
    #0123456789ABCDEFGHI
    '...................',  # 0
    '.....k.k..k.k......',  # 1
    '...kkmkhkkhkhkk....',  # 2
    '..kmhhhHHhhHHhhk...',  # 3
    '.kmhhHHHHHHHHhhmk..',  # 4
    '.kmhHHhhhhhhhHHhmk.',  # 5
    'kmhhhhmhhmhhmhhhmk.',  # 6
    'kmhhmhdh.d..mhdhmk.',  # 7
    'kmhmhdh......dhdmk.',  # 8
    'kmhhmd.........dmk.',  # 9
    'kmhmd..........dhmk',  # 10
    'kmhmd..........dhmk',  # 11
    'kdhmd..........dmhk',  # 12
    'kdhmd.........ddmhk',  # 13
    'kdmhmd........dmhk.',  # 14
    'kdmhmd.......dmhdk.',  # 15
    'kdmhmdm......dmhk..',  # 16
    '.kdmhmdm.....dhk...',  # 17
    '.kdkdmdk.....kmk...',  # 18
    '.k.kdk.k.....k.k...',  # 19
    '....k..............',  # 20
]
# fmt: on


def warrior(front=False):
    from heads import beard
    legend = {**SOT, **WW_SKIN, **WW_HAIR}
    p = layered(front, WW_25, WW_29, legend, pad=WW_PAD, face_legend={**SOT, **WW_SKIN}, drop='c')
    keep = [SOT[c] for c in 'lLweEWb']
    beard(p, 13, 18, 5 if front else 11, WW_STUBBLE, keep=keep)
    return p


# --- the Dark Prince: charcoal skin lit like the rest, sand glowing in his eyes and in veins from
# the eyes over the cheek and the brow, hair standing up like smoke with embers at its tips -------

DARK_SKIN = {'1': '#7a7088', '2': '#575068', '3': '#3c3649', '4': '#282331', '5': '#17141d', 'o': '#060508',
             'q': '#4c4458', 'w': '#fff4c0', 'W': '#ffd88a', 'e': '#ffd25a', 'E': '#ff9a2a', 'b': '#0c0a10',
             'B': '#121016', 'L': '#0a080c', 'l': '#3e3648', 'c': '#ff9a2a'}
DARK_HAIR = {'H': '#5a5266', 'h': '#3a3444', 'm': '#24202c', 'd': '#14121a', 'k': '#050407',
             'y': '#ffe08a', 'r': '#ff8a1a', 'R': '#c8400a', 'g': '#ffb000'}
DARK_PAD = (1, 3, 1, 3)

# fmt: off
DARK_25 = [
    #0123456789ABCDEFGHI
    '.y.................',  # 0
    '.rk.....y..........',  # 1
    '..Rk...yk...y......',  # 2
    '..khk..Rhk..rk.....',  # 3
    '...khkkhhk.kRk..y..',  # 4
    '..kmhhkhHhkkhk.kr..',  # 5
    '..kmhhhhHHhkhhkRk..',  # 6
    '..kmhhhhhHHhhHhhk..',  # 7
    '..kdmhmhhhHHhd31q..',  # 8
    '.kdmmhhmhhhhd321q..',  # 9
    '.kdmhmhhmhhd3bbb2..',  # 10
    '.kdmhmhmhhd44weq...',  # 11
    '.kdmhmdhhmd42321q..',  # 12
    '.kdmhmdhmmd4322211.',  # 13
    '.kddmdmhmmd42234o..',  # 14
    '..kdmdmdhmd4322q...',  # 15
    '..kddmdmdmd433LL...',  # 16
    '...kdkdmdko5432l...',  # 17
    '...k.kdk.koo54BB...',  # 18
    '..........ooo.BB...',  # 19
    '...................',  # 20
    '...................',  # 21
    '...................',  # 22
]
DARK_29 = [
    #0123456789ABCDEFGHI
    '...y......y........',  # 0
    '...rk....yk...y....',  # 1
    '....Rk..kRk..kr....',  # 2
    '..y.khk.khk.kRk.y..',  # 3
    '..rkhhkkhhkkhhkkr..',  # 4
    '..kRhhhkhHhkhHhkRk.',  # 5
    '..kmhhHHhhhHHhhmk..',  # 6
    '..kmhhhhd212dhhmk..',  # 7
    '.kmhhhmd21112dhmmk.',  # 8
    '.kmhhmd321112cdmmk.',  # 9
    '.kmhmd3bb212bb4dmk.',  # 10
    '.kmhd43web2bew4dmk.',  # 11
    '.kmhd4223213344dmk.',  # 12
    '.kdhd4212214344dmk.',  # 13
    '.kdhd432345444dmk..',  # 14
    '.kdmdd4322334odhk..',  # 15
    '.kdmdmo43LLLodmdk..',  # 16
    '..kdkdmo43l4ok.k...',  # 17
    '..k..k..o4BBo......',  # 18
    '.........oBo.......',  # 19
    '...................',  # 20
    '...................',  # 21
    '...................',  # 22
]
# fmt: on
# The veins (x, y, colour) over the face.
DARK_VEINS_25 = [(15, 8, 'y'), (14, 9, 'g'), (12, 13, 'g'), (12, 14, 'y'), (11, 15, 'r'), (12, 16, 'g'),
                 (13, 17, 'R')]
DARK_VEINS_29 = [(12, 10, 'g'), (13, 9, 'y'), (12, 8, 'g'), (11, 7, 'r'), (5, 13, 'g'), (6, 14, 'y'),
                 (6, 15, 'g'), (7, 16, 'r'), (4, 12, 'R')]


def dark(front=False):
    legend = {**SOT, **DARK_SKIN, **DARK_HAIR}
    p = synced(DARK_29 if front else DARK_25, DARK_PAD, front, legend)
    for x, y, ch in (DARK_VEINS_29 if front else DARK_VEINS_25):
        p.set(x, y, DARK_HAIR[ch])
    return p


# --- the wanderer of 2008: an open face, a blue head-wrap with a red band wound round it, spiky
# hair over it and under it at the back, stubble -------------------------------------------------

WRAP = {'N': '#7a94dc', 'n': '#4c66b8', 'v': '#2c3c80', 'z': '#121630', 'R': '#e8603c', 'r': '#a8321c',
        'H': '#6e5038', 'h': '#4a3424', 'm': '#33231a', 'd': '#22160e', 'k': '#0e0806'}
W8_STUBBLE = ['#c8946a', '#a47250', '#80543a', '#5c3828', '#3c2218']
W8_PAD = (1, 2, 1, 2)

# fmt: off
W8_25 = [
    #0123456789ABCDEFGHI
    '....k.hk.hk.k......',  # 0
    '...khkhhkhhkhk.....',  # 1
    '...kzzzzzzzzzzk....',  # 2
    '..kzvnnnNNNNNNnz...',  # 3
    '..kzRRrnnnnNNNNnz..',  # 4
    '.kzvnnRRRrnnnnnnnz.',  # 5
    '.kzvvnnnnRRRRRRRRz.',  # 6
    '.kdzvvnnvvzzzzzzz..',  # 7
    '.kdzzzhhmhhd321q...',  # 8
    '.kdmhmhhmhhd3bbb2..',  # 9
    '.kdmhmhmhhd44weq...',  # 10
    '.kdmhmdhhmd42321q..',  # 11
    '.kdhdmdhmmd4322211.',  # 12
    '.kdkdmdhmdd42234o..',  # 13
    '..k.kdkdhmd4322q...',  # 14
    '....kd.kdmd433LL...',  # 15
    '.....k..kko5432l...',  # 16
    '.........koo54BB...',  # 17
    '..........ooo.BB...',  # 18
    '...................',  # 19
    '...................',  # 20
]
W8_29 = [
    #0123456789ABCDEFGHI
    '...k.hk.hk.hk.k....',  # 0
    '...khkhhkhhkhhk....',  # 1
    '...kzzzzzzzzzzzk...',  # 2
    '..kzvnNNNNNNNNnzk..',  # 3
    '.kzvnnNNNNNNNnnvzk.',  # 4
    '.kzRRRRRRRRRRRRRzk.',  # 5
    '.kzvvnnnnnnnnvvvzk.',  # 6
    '.kmzzzzzzzzzzzzdmk.',  # 7
    '.kmhmd211122dhmmk..',  # 8
    '.kmhmd3bb212bb4dmk.',  # 9
    '.kmhd43web2bew4dmk.',  # 10
    '.kmhd4223213344dmk.',  # 11
    '.kdhd4212214344dmk.',  # 12
    '.kdhd432345444dmk..',  # 13
    '.kdmdd4322334odhk..',  # 14
    '.kdkdmo43LLLodmdk..',  # 15
    '..k.kdo43l4okdk....',  # 16
    '.....k..o4BBo.k....',  # 17
    '.........oBo.......',  # 18
    '...................',  # 19
    '...................',  # 20
]
# fmt: on


def wanderer(front=False):
    from heads import beard
    p = synced(W8_29 if front else W8_25, W8_PAD, front, {**SOT, **WRAP}, drop='c')
    keep = [SOT[c] for c in 'lLweEWb']
    beard(p, 14, 19, 5 if front else 11, W8_STUBBLE, keep=keep)
    return p


def preview_pics():
    return [sot(), sot(True), warrior(), warrior(True), dark(), dark(True), wanderer(), wanderer(True)]


if __name__ == '__main__':
    pics = preview_pics()
    pal = Palette()
    sheet('sh-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=10, per_row=8)
    print('ok')
