"""Five's heads, drawn from scratch: V of Cyberpunk 2077, the woman and the man (two faces: the
game lets you play either).

Her: a raspberry asymmetric undercut, the crest swept over the crown and highest at the front, a
forelock over the forehead, the long hair hanging at the back to the collar, the side shaved to
dark stubble; the chrome cyber line from the brow's tail back to the temple and down round the
eye to the cheekbone; heavy-lidded green eyes in dark liner, dark plum lips, a narrow firm chin,
silver rings in the ear. In the 3/4 face the crest falls in a sheet over the far eye.

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
# Her legend.
# --------------------------------------------------------------------------------------------
HER_SKIN = {
    'H': '#ffeccc',  # highlight: brow ridge, nose, cheekbone (yellower)
    '1': '#fbd0a0',  # light
    '2': '#eaab7b',  # base
    '3': '#c87f57',  # shadow (redder)
    '4': '#97503a',  # deep shadow
    'o': '#4a1c14',  # outline in shade
    's': '#d89468',  # the lit edge (sel-out)
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
    'g': '#5c4a50',  # stubble where the light reaches
    'G': '#40333a',  # stubble
    'j': '#2a2026',  # stubble in shade
}
CHROME = {'C': '#f0ecea', 'c': '#b4acac', 'x': '#5c5052'}
HER_FACE = {
    'w': '#f4e8e0',  # eye white (warm)
    'i': '#5aa648',  # green iris
    'I': '#1e3a1a',  # pupil
    'l': '#1e0c10',  # liner and lashes
    'b': '#3e1a1a',  # brows
    'm': '#6a2234',  # lips, dark plum
    'M': '#bd6a76',  # lower lip's light
    'e': '#f2f4fa',  # silver rings
    'E': '#9096a6',
}
HER = {**HER_SKIN, **HER_HAIR, **SHAVED, **CHROME, **HER_FACE}

# --------------------------------------------------------------------------------------------
# Her profile (25), facing right: column i is x + 1 of the head box, row j is y + 2.
# --------------------------------------------------------------------------------------------
HER_PROF_BOX = (1, 2)
# fmt: off
HER_PROF = [
    #012345678901234567     x + 1
    '..........krr.....',  # -2 the crest, highest at the front
    '.......kRrpPPpr...',  # -1
    '....kRrqqpPPPpqr..',  # 0
    '..kRrqppqrqpPpqr..',  # 1
    '.kRqpqrqpqrqpPqr..',  # 2
    '.kqprRRrRrqrqpqk..',  # 3 the crest's underside; the forelock
    '.kpqRjjjjj321Rqr..',  # 4 the shaved side under it
    '.kprjGGGgg2111r...',  # 5 the forelock's tip on the forehead
    '.kqrjGgggccbbbH...',  # 6 the chrome line from the brow's tail; the brow
    '.krqje12gC2llls...',  # 7 a ring on the helix; heavy liner
    '.kRrj1o12c12wwiH..',  # 8 the ear; the eye; the nose
    '.krRj34222c13wI2H.',  # 9 the line's end
    '.kRR4o13321H1132s.',  # 10 the lobe; the cheekbone; the nostril
    '..kR443322211223..',  # 11 the long hair's tip
    '...ko4E3322223mm..',  # 12 a ring under the lobe; the upper lip
    '....o434322212MM..',  # 13 the lower lip
    '.....o334322123...',  # 14 the jaw line; under the lip
    '.....o333432111s..',  # 15 the narrow firm chin
    '......o33344333o..',  # 16 the jaw's shadow on the neck
]

# Her 3/4 face (29): column i is x + 1 of the box, row j is y + 2. The crest swept over to the
# far side falls in a sheet over the far eye; the near temple shaved, the ear with its rings.
HER_FRONT_BOX = (1, 2)
HER_FRONT = [
    #012345678901234567     x + 1
    '.......krrk.......',  # -2
    '....kRqpPPpqr.....',  # -1 swept over from the shaved side
    '..kRqppPPppqqrk...',  # 0
    '.kRrqpqpPpqpqqrk..',  # 1
    '.kRRrqrqpqrqpqqrk.',  # 2
    '.kjRrRrqrqpqpqpqk.',  # 3
    '.kGj321123Rrqpqrk.',  # 4 the shaved temple; the hairline; the sheet of hair falling
    '.kgG21H112Rrqpqrk.',  # 5
    '.kgCbbb2bbRrqqprk.',  # 6 the brows; the chrome line from the brow's tail
    'kGc2lllHllRrqqprk.',  # 7 liner; the line turns down at the temple
    'o2c2wwi1wiRrqpqrk.',  # 8 the ear; the eyes, the far one under the strand
    '242c3wI23IRrqqrk..',  # 9 the line round the eye's corner
    'o321cH1H333Rqrqk..',  # 10 the line's end on the cheekbone; the nose's tip
    '.o322123434Rrqk...',  # 11 the nostril, its shadow on the far cheek
    '.Eo323mmm34Rqk....',  # 12 a ring under the lobe; the lips
    '...o322MM3oRk.....',  # 13
    '...4o2233o.k......',  # 14
    '...44o12o.........',  # 15 the narrow chin
    '...o44oo..........',  # 16
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


# The profile's faces, as changes of the grid (column, row): 76 the eyes closing, 77 closed (the
# smoky lid down to the lashes), 78 the pain face (the eyes squeezed, the mouth open).
HER_FACES = {
    76: {(12, 10): 'l', (13, 10): 'l', (14, 10): 'l', (12, 11): '3', (13, 11): 'w', (14, 11): 'I'},
    77: {(12, 10): '2', (13, 10): '1', (14, 10): '1', (12, 11): 'l', (13, 11): 'l', (14, 11): 'l'},
    78: {(12, 10): 'l', (13, 10): 'l', (14, 10): 'l', (12, 11): '3', (13, 11): '2', (14, 11): '2',
         (11, 8): 'b', (13, 14): 'o', (14, 14): 'o', (15, 14): 'm', (14, 15): 'o', (15, 15): 'M'},
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
