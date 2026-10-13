"""Five's heads, drawn from scratch: V of Cyberpunk 2077, the woman and the man (two faces: the
game lets you play either).

Her (redrawn to read feminine and neat): a raspberry asymmetric undercut, the crest swept over
the crown and highest at the front, its tip over the forehead, the long hair hanging at the back
in points to the collar, the side shaved to dark stubble; the chrome cyber line, one clean pixel
wide, from the brow's tail back to the temple, down and round under the eye to the cheekbone;
large green eyes with white under a dark lash line with a flick at the outer corner, thin brows,
a small upturned nose, small dark berry lips, a short lower face curving in to a small chin set
back, a slim jaw climbing to the ear, a slender neck in shade, a ring under the lobe. The light is
soft and broad (lit front, a mid tone on the side planes, shade under the chin, a touch of
blush), never dark pixels on the cheek or jaw. In the 3/4 face the crest falls in a sheet down
the far side, framing the far cheek and jaw; both eyes are the same size.

Him: a short spiky black crop over faded sides with a shaved line through the fade, heavy
straight brows low over green eyes, chrome brackets at the temples, a short boxed beard with a
moustache (the cheeks open), a square jaw, the ears standing out a little.

Lit like the rest of the cast from the upper front (the way they run: the right of the profile
25, the near left of the 3/4 face 29, whose far side turns into shade). Skin shadows go redder
and more saturated, highlights lighter and yellower; a dark outline in shade, a warm lighter edge
where the light hits; hair in clumps with a highlight band on the crown and dark roots. Her shaved
side is shown whichever way V runs (the key art has it on the right, the 2023 cosplay guide on
the left), so the heads have no `:left` pictures.

Each grid marks the base's head box (`*_BOX`, its top left corner in the grid; Blaise's is 16 x
17, the man's 17 x 17): `centred` pads the picture so the box sits where the game puts a head.
76 / 77 are the blinks, 78 the pain face."""
from heads import Pic

# --------------------------------------------------------------------------------------------
# Her legend. The skin's five tones are the body's (fv_parts.py takes HER_SKIN for her hands and
# midriff); the head adds its own warmer outline and a blush.
# --------------------------------------------------------------------------------------------
HER_SKIN = {
    'H': '#ffeccc',  # highlight: forehead, nose tip, cheek (yellower)
    '1': '#fbd0a0',  # light
    '2': '#eaab7b',  # base
    '3': '#c87f57',  # shadow (redder)
    '4': '#97503a',  # deep shadow
    'o': '#4a1c14',  # outline in shade
    's': '#d89468',  # the lit edge (sel-out)
}
HEAD_SKIN = {
    'o': '#7a3a2c',  # the face's outline: a warm dark skin tone, not black
    'u': '#f0a088',  # a touch of blush
}
HER_HAIR = {
    'P': '#ff86a6',  # highlight band
    'p': '#e2416f',  # light
    'q': '#b7204e',  # base raspberry
    'r': '#851139',  # shadow
    'R': '#540a26',  # deep (roots, under the clumps)
    'k': '#2a0613',  # hair outline
}
SHAVED = {
    'g': '#5e4650',  # stubble where the light reaches
    'G': '#45323b',  # stubble
    'j': '#2e2028',  # stubble in shade
}
CHROME = {'C': '#f0ecea', 'c': '#b4acac', 'x': '#5c5052'}  # (his brackets)
HER_CHROME = {'C': '#c4cedb'}  # her line: one clean, cool silver
HER_FACE = {
    'w': '#fbf3ec',  # eye white (warm)
    'i': '#4fb052',  # green iris
    'v': '#b4ec9a',  # the iris' highlight
    'I': '#163a20',  # pupil
    'l': '#2a0c16',  # liner and lashes
    'b': '#8a4440',  # thin brows, a dark warm brown
    'm': '#7c2244',  # the mouth line and upper lip, dark berry
    'M': '#b0506c',  # lower lip
    'n': '#e08ca0',  # the lower lip's highlight
    'e': '#f2f4fa',  # a silver ring
}
HER = {**HER_SKIN, **HEAD_SKIN, **HER_HAIR, **SHAVED, **HER_CHROME, **HER_FACE}

# --------------------------------------------------------------------------------------------
# Her profile (25), facing right: column i is x + 1 of the head box, row j is y + 2.
# --------------------------------------------------------------------------------------------
HER_PROF_BOX = (1, 2)
# fmt: off
HER_PROF = [
    #012345678901234567     x + 1
    '..........kk......',  # -2 the crest, highest toward the front
    '........kkRqk.....',  # -1
    '.....kkRqpPPPk....',  # 0 the highlight band on the crown
    '...kRrqqpPPPpqk...',  # 1
    '..kRqqrqppPPppqk..',  # 2
    '.kRqrqqrqqppPPpqk.',  # 3 the crest swept back over the shaved side
    '.kqrRRRRRRr1HH1rk.',  # 4 its dark underside; the forelock's tip
    'kRqrjjjjjjgCbbbH..',  # 5 the stubble; the chrome line from the brow's tail; a thin brow
    'kRqRGGGGggCl11HH..',  # 6 the line down the temple; the liner's flick
    'kRqRGGGgg2C2lll1..',  # 7 the lash line
    'kRqRjjj322C1wIi1..',  # 8 the ear; the eye
    'kRqRjjj342C1wiv1s.',  # 9 the nose's bridge
    'kRqRRjj3322CH111H.',  # 10 the line's end on the cheekbone; the small upturned nose
    '.kRqrRRke221u113..',  # 11 a ring under the lobe; a touch of blush; the nostril
    '.kRqRrRR332111mm..',  # 12 the berry lips
    '.kRrqRrk4321112M..',  # 13 the lower lip; the jaw climbing to the ear
    '..kRqkRk343211s...',  # 14 the small chin, set back
    '..kRk.kk334323....',  # 15 the long hair hanging in points; under the chin
    '...k...k334.......',  # 16 the slender neck in shade
]

# Her 3/4 face (29): column i is x + 1 of the box, row j is y + 2. The crest swept over to the
# far side falls in a sheet down the far cheek; the near temple shaved, the ear with its ring.
HER_FRONT_BOX = (1, 2)
HER_FRONT = [
    #012345678901234567     x + 1
    '.....kk...........',  # -2 the crest, highest over the parting
    '...kkRqk..........',  # -1
    '..kRqpPPpk........',  # 0 the highlight band
    '.kRqpPPPpqqk......',  # 1
    '.kRqpPpppqqqrk....',  # 2
    '.kGRRqppqqpqqqrk..',  # 3 the shaved temple; the fringe swept across
    '.kG3H12Rqpqpqqprk.',  # 4
    '.GgCbbb12bRqpqprk.',  # 5 thin brows; the chrome line from the brow's tail
    '.GCl1H1112Rqqprk..',  # 6 the line down the temple; the liner's flick
    'o2C1lll11lllRqrk..',  # 7 the lash lines
    'o4C1wIi12wIiRqrk..',  # 8 the eyes, the same size
    'o3C1wiv12wivRqrk..',  # 9
    '.o2CCH1H32u3Rqk...',  # 10 the line turning under the eye; the nose's tip, shaded on the far side
    '.es1u1123233Rqrk..',  # 11 a ring under the lobe; blush
    '..s112mm323Rk.Rk..',  # 12 small berry lips; the sheet of hair ends in points
    '...s11nM33k...k...',  # 13 the lower lip
    '....s1H123........',  # 14 the small chin
    '.....s123.........',  # 15
    '.....3433.........',  # 16 the slender neck
]
# fmt: on


# --------------------------------------------------------------------------------------------
# His legend.
# --------------------------------------------------------------------------------------------
HIM_SKIN = {
    'H': '#fff0d6',  # highlight (yellower)
    '1': '#f3cfaa',  # light
    '2': '#dba985',  # base
    '3': '#b47b5d',  # shadow (redder)
    '4': '#7e4a3a',  # deep shadow
    'o': '#3a1a14',  # outline in shade
    's': '#c8916e',  # the lit edge (sel-out)
}
HIM_HAIR = {
    'A': '#5a5d70',  # highlight on the spikes (cool)
    'a': '#383a4a',  # light
    'h': '#22232d',  # base, near black
    'd': '#131319',  # dark
    'k': '#08080c',  # outline
    'f': '#94786c',  # the fade where the light reaches it: skin under short hair
    'F': '#57484a',  # the fade
}
BEARD = {
    'B': '#5c4a44',  # the boxed beard, lit
    'n': '#3a2c2a',  # beard
    'N': '#221818',  # beard in shade
}
HIM_FACE = {
    'w': '#f2ebe4',  # eye white
    'i': '#58944a',  # green iris
    'I': '#20381c',
    'b': '#1c1416',  # heavy brows
    'm': '#7a3e3a',  # lips
    'M': '#a8665a',  # lower lip's light
}
HIM = {**HIM_SKIN, **HIM_HAIR, **BEARD, **CHROME, **HIM_FACE}

# His profile (25), facing right: column i is x + 2 of the man's 17 x 17 head box, row j is y + 2.
HIM_PROF_BOX = (2, 2)
# fmt: off
HIM_PROF = [
    #012345678901234567890     x + 2
    '.........k..k..k.....',  # -2 the crop: short spikes up and forward
    '........kakkakkAk....',  # -1
    '......kkhahhaAhaAk...',  # 0
    '.....kdhhhahhahhaAk..',  # 1
    '....kdhdhhdhhdhhhak..',  # 2 the fringe jutting forward
    '...kdFdFdFdd3223d....',  # 3 the fade under the crop
    '...kFFFFFFF321112s...',  # 4
    '...kFF222FF21H111s...',  # 5 the shaved line through the fade
    '...kFfffff3C2111Hs...',  # 6 the chrome bracket at the temple
    '...kF3213f2c3bbbbs...',  # 7 the ear; heavy brows low over the eye
    '...kF32o2B2c23wi1H...',  # 8 the sideburn; the eye; the bridge
    '...k33342B2c12wI1Hs..',  # 9 the nose
    '....k3o23Bn1H1121Hs..',  # 10 the cheekbone; the nose's tip
    '....k4333Bn2112334...',  # 11 the beard's line across the cheek
    '....k4334nBn223BnnB..',  # 12 the moustache
    '.....4444NnBnBnmMMn..',  # 13 the lower lip
    '......o44oNnnBBnBBn..',  # 14 the boxed beard on the chin
    '.......o44oNnnBBBn...',  # 15
    '........o44oNNnnN....',  # 16 the square jaw
]

# His 3/4 face (29): column i is x + 2 of the box, row j is y + 2.
HIM_FRONT_BOX = (2, 2)
HIM_FRONT = [
    #012345678901234567890
    '.......k..k..k.......',  # -2
    '......kakkAkkak......',  # -1
    '....kkhahhAahaAk.....',  # 0
    '...kdhhahhahhahak....',  # 1
    '..kdhdhhdhhdhhdhk....',  # 2
    '..kFdhdhd3dhdhdFk....',  # 3 the crop's ragged edge over the forehead
    '..kfF3211H11223Fk....',  # 4
    '..k1f21H1111223fk....',  # 5 the shaved line in the near fade
    '..kfC2111H1223cFk....',  # 6 the chrome brackets at both temples
    '..o2cbbbb12bbbc3o....',  # 7 the heavy straight brows
    '..24Bcwi2H2wi322o....',  # 8 the eyes
    '..34B2332133323no....',  # 9
    '..o3BBH111H3233no....',  # 10 the nose's tip, its shadow on the far cheek
    '...onB32234343Bno....',  # 11
    '...oNnB3nBBnn3no.....',  # 12 the moustache
    '....oNnBnMMmnBno.....',  # 13 the lips
    '.....oNnBnBBnno......',  # 14 the boxed beard
    '......oNnBBnNo.......',  # 15
    '.......oNNNNo........',  # 16 the square jaw
]
# fmt: on


HIM_FACES = {
    76: {(14, 10): 'b', (15, 10): 'b', (14, 11): 'w', (15, 11): 'I'},
    77: {(14, 10): '2', (15, 10): '1', (14, 11): 'b', (15, 11): 'b'},
    78: {(14, 10): 'b', (15, 10): 'b', (14, 11): '3', (15, 11): '2', (13, 9): 'b',
         (15, 15): 'o', (16, 15): 'o', (17, 15): 'm', (16, 16): 'M'},
}


def him_head(front=False, face=None):
    rows, box = (HIM_FRONT, HIM_FRONT_BOX) if front else (HIM_PROF, HIM_PROF_BOX)
    if face:
        rows = marked(rows, HIM_FACES[face])
    return centred(Pic.text(grid(rows), HIM), box, 1, 1)


def grid(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def centred(pic, box, wp=0, hp=1):
    """Pads a head picture so that the head box, whose top left corner is at `box` in it, sits
    where the game draws a head: the box's pixel (8, 8) on the picture's centre, the width and
    the height of the parity `wp`, `hp` (Blaise's head is 16 x 17, the man's 17 x 17)."""
    c, r = box[0] + 8, box[1] + 8
    w0, h0 = pic.w, pic.h
    pad_l = max(0, w0 - wp - 2 * c)
    W = 2 * (c + pad_l) + wp
    pad_t = max(0, h0 - hp - 2 * r)
    H = 2 * (r + pad_t) + hp
    return pic.pad(pad_l, pad_t, W - w0 - pad_l, H - h0 - pad_t)


# The profile's faces, as changes of the grid (column, row), made from the eye of 25: 76 the eye
# half closed (the lid and the lash line with its flick one row down), 77 closed (a curved lash
# line at the bottom of the eye), 78 the pain face (the eye squeezed, the brow pulled down at the
# front, the mouth open).
HER_FACES = {
    76: {(11, 8): '2', (11, 9): 'l', (12, 9): '1', (13, 9): '1', (14, 9): '1',
         (12, 10): 'l', (13, 10): 'l', (14, 10): 'l'},
    77: {(11, 8): '2', (12, 9): '1', (13, 9): '1', (14, 9): '1', (12, 10): '1', (13, 10): 'H', (14, 10): '1',
         (11, 11): 'l', (12, 11): 'l', (13, 11): 'l', (14, 11): 'l'},
    78: {(11, 8): '2', (12, 9): '1', (13, 9): '1', (14, 9): '1', (12, 10): 'l', (13, 10): 'l', (14, 10): 'l',
         (12, 11): '2', (13, 11): '3', (14, 11): '2', (14, 7): '1', (14, 8): 'b',
         (13, 14): 'l', (14, 14): 'l', (14, 15): 'l'},
}


def marked(rows, marks):
    g = [list(r) for r in grid(rows)]
    for (x, y), ch in marks.items():
        g[y][x] = ch
    return [''.join(r) for r in g]


def her_head(front=False, face=None, hair=None):
    """Her profile or 3/4 face; `face` (76-78) the profile blinking or in pain; `hair` another
    hair legend (the Street Kid's hot pink)."""
    rows, box = (HER_FRONT, HER_FRONT_BOX) if front else (HER_PROF, HER_PROF_BOX)
    if face:
        rows = marked(rows, HER_FACES[face])
    return centred(Pic.text(grid(rows), {**HER, **(hair or {})}), box)


def preview_heads():
    """(label, Pic) of every head, for the preview sheets."""
    return [('her 25', her_head()), ('her 29', her_head(True)), ('him 25', him_head()), ('him 29', him_head(True))] + \
        [(f'her {f}', her_head(face=f)) for f in (76, 77, 78)] + [(f'him {f}', him_head(face=f)) for f in (76, 77, 78)]
