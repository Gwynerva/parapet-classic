"""Petra's "twin brother" (her four men's looks: her in disguise), his head drawn from scratch
after the owner's photos.

The face (the twins share it with Petra's, pr_her*.py: the same skin, eyes, nose and mouth): a
soft oval with full round cheeks and a small soft chin set a little back, no stubble and no
heavy jaw; hazel-brown eyes under slightly hooded lids; straight light-brown brows; a straight
nose with a soft rounded tip; a thin upper lip over a fuller lower one, in a light closed smile.
Youthful and clean.

His hair, one per look: the swordsman's own mid-brown hair in a mop (a bowl cut: a heavy
straight fringe to the brows, the ears covered, the sides flaring a little), the fencer's grown
out and swept to the side, the rebel's wet waves to the jaw curling at the tips, and the
undercover cosplayer's white chin-length bob wig with a long fringe swept over one eye.

Lit like the rest of the cast from the upper front: in the profile `25` (facing right) the
forehead, the brow, the bridge and the tip of the nose, the cheekbone, the upper lip and the
chin are lit, the eye's lid, under the nose, under the lower lip, the jaw's underside and the
neck in shade; in the 3/4 face `29` the near cheek is lit and the far one narrow and in shade,
the nose's shadow falling toward it. Skin shadows go redder, highlights yellower; a dark warm
outline in shade, a lighter edge where the light hits. Hair in clumps with a sheen on the crown,
dark at the roots, the nape and under the fringe.

The look tool turns 25 into 26-28; 76 / 77 are the blinks and 78 the pain face."""
from heads import Pic

# The twins' skin (analysis.md): highlight, light, mid, shadow, deep; shadows redder and more
# saturated, the highlight yellower.
SKIN = {
    'X': '#fbe6d6',  # highlight
    'W': '#f3cdb4',  # light
    'M': '#e2aa8e',  # mid
    'S': '#bf7f68',  # shadow
    'D': '#8e5446',  # deep shadow
    'o': '#4e2220',  # outline in shade
    'O': '#d08c74',  # the lit edge (sel-out)
    'r': '#e89a90',  # the cheeks' pink
    'n': '#7a3830',  # the nostril, the ear's inside
}
EYES = {
    'e': '#f8f2ee',  # eye white
    'j': '#fff6e6',  # the catchlight
    'E': '#d8c8c4',  # eye white in shade
    'i': '#6a4a2c',  # hazel iris
    'I': '#3a2618',  # its dark (pupil, the top under the lid)
    'l': '#5a2c20',  # the upper lid's crease (his lashes are not made up)
}
MOUTH = {
    'L': '#b4604f',  # the mouth's line
    'p': '#e0a08c',  # the lower lip
}
BROWS = {'b': '#9a6c48'}
FACE = {**SKIN, **EYES, **MOUTH, **BROWS}

# fmt: off
FACE_25 = [            # the profile, facing right: the bald head (the hair is painted over it)
    #0123456789ABCDEFG
    '.................',  # 0
    '......oooooo.....',  # 1
    '....ooMWWWXXoo...',  # 2
    '...oSMMWWWXXXXO..',  # 3
    '..oSMMWWWWXXXXWO.',  # 4
    '..oSMMWWWWWXXXWO.',  # 5
    '.oDSMMMWWWWWXXWO.',  # 6  forehead
    '.oDSMMMMMSMbbbWO.',  # 7  brow
    '.oDSMSSMMSMlllXO.',  # 8  the upper lid's line
    '.oDSnoSMMMWejIWX.',  # 9  the eye, a catchlight; the bridge
    '.oDSnoSMMMXWIiWXO',  # 10 the cheekbone; the nose's soft tip
    '..oDSSSMSMWrWMMS.',  # 11 under the nose
    '...oDSSMSSMWWMWO.',  # 12 the thin upper lip
    '....oDDoSMMWWLpO.',  # 13 the mouth's corner, the fuller lower lip
    '......oDDSMWWSO..',  # 14 the chin; the jaw's line
    '.......oSDDMWO...',  # 15 its shadow on the neck
    '.......oSSDoo....',  # 16 the neck
]
FACE_29 = [            # the 3/4 face, turned right
    #0123456789ABCDEFG
    '.................',  # 0
    '......ooooo......',  # 1
    '....ooMWWWMoo....',  # 2
    '...oMWXXWWWMMo...',  # 3
    '..oMWXXXWWWWMSo..',  # 4
    '..oMWXXWWWWWMSo..',  # 5  the forehead, lit from the near side
    '.oMWWXWWWWWMMSSo.',  # 6
    '.oMWSbbbMWMbbbSo.',  # 7  brows
    '.oSMMlllWXMlllDo.',  # 8  the upper lids' lines, a little hooded
    '.onMWjIeWXMjIeDo.',  # 9  hazel eyes looking at us, a catchlight
    '.onMXIiWWXSIiSDo.',  # 10 the cheekbone lit; the nose's shade side
    '.oMXWrrWWXnSrSDo.',  # 11 the soft tip, its shadow toward the far cheek
    '.oMWWWWWMSSMMSDo.',  # 12 full cheeks
    '..oMWWWMMLLMSDo..',  # 13 the mouth
    '...oMWWMWppMSo...',  # 14 the lower lip
    '....oSMWWWMSo....',  # 15 the small soft chin
    '.....ooSSSoo.....',  # 16
]
# fmt: on

# --------------------------------------------------------------------------------------------
# Hair. Each layer is painted over the face: '.' keeps it, ' ' erases, other characters paint
# (hair, or skin in the hair's shade).
# --------------------------------------------------------------------------------------------
# His own hair: mid brown (analysis.md) - highlight, light, mid, dark, outline.
BROWN = {'H': '#b0804a', 'h': '#8a5c34', 'm': '#64402a', 'd': '#42281a', 'k': '#24140c'}

# fmt: off
MOP_25 = [             # swordsman: a bowl cut, the fringe straight to the brows, the ears covered
    #0123456789ABCDEFG
    '.....kkdddd......',  # 0
    '...kkmhhhHHdd....',  # 1
    '..kdmhhHHHHHhd...',  # 2  the sheen on the crown
    '.kdmhhhhhHHHHhd..',  # 3
    '.kdmmhmhhhhhhHhd.',  # 4  the fringe
    'kdmmhmhhmhhmhhhhd',  # 5
    'kddmhmmhmmhmmhmdd',  # 6  its ends, straight at the brows
    'kdmmhmhmmdS......',  # 7  the sides over the ears
    'kdmmhmhmmdS......',  # 8
    'kddmmhmmmd.......',  # 9
    'kddmmhmmdd.......',  # 10
    '.kddmmmddk.......',  # 11
    '..kkdddko........',  # 12 the nape
    '....kkk..........',  # 13
]
MOP_29 = [
    #0123456789ABCDEFG
    '.....dddddkk.....',  # 0
    '...ddhHHHhhmkk...',  # 1
    '..dhHHHHHhhhmmk..',  # 2  the sheen on the crown, lit from the near side
    '.dhHHhhhhHhhmmdk.',  # 3
    '.dhhhhmhhhmhmmdk.',  # 4  the fringe
    'dhhmhhmhhmhmmdmdk',  # 5
    'dmhmdhmmdhmdmmddk',  # 6  its ends, straight at the brows
    'dhmd..........dmk',  # 7  the sides over the ears, flaring a little
    'dhmd..........ddk',  # 8
    'dmmd..........ddk',  # 9
    'kmmd..........ddk',  # 10
    'kdmd..........dk.',  # 11
    '.kdd..........dk.',  # 12
    '..kk..........k..',  # 13
]
# fmt: on

# The fencer's: grown out, swept back and to the side off the forehead, covering the ears and
# reaching the collar at the back.
# fmt: off
SWEPT_25 = [
    #0123456789ABCDEFG
    '....kkkkkk.......',  # 0
    '..kkmhhHHHkk.....',  # 1
    '.kmhhhHHHHHhk....',  # 2
    '.kmhhhhhHHHHhd...',  # 3  swept back off the forehead
    'kdmhhmhhhhhhhhd..',  # 4
    'kdmhmhhmhhhhhdS..',  # 5
    'kdmmhmhmhhhdS....',  # 6
    'kdmhmmhmhmhd.....',  # 7  a lock at the temple, over the ear
    'kdmhmhmhmhd......',  # 8
    'kdmhmhmhmhd......',  # 9
    'kdmmhmhmhd.......',  # 10
    'kddmdmhmmd.......',  # 11
    '.kdmdmdmdk.......',  # 12 to the collar at the back
    '..kdmdmdk........',  # 13
    '...kkkkk.........',  # 14
]
SWEPT_29 = [
    #0123456789ABCDEFG
    '.....kkkkkk......',  # 0
    '...kkhHHHhhkk....',  # 1
    '..khHdHHHhhhmk...',  # 2  the parting on the near side
    '.khHdMMHhhhhhmk..',  # 3  the fringe swept across to the far side
    '.khd...MMhhhhmmk.',  # 4
    'khmd.....Mhhhmmdk',  # 5
    'khmd.......Mhmddk',  # 6
    'khmd.........Sddk',  # 7
    'kmmd..........ddk',  # 8
    'kmmd..........ddk',  # 9
    'kdmd..........dk.',  # 10
    'kdmd..........dk.',  # 11
    '.kdmk.........dk.',  # 12
    '.kdk..........k..',  # 13
    '..k..............',  # 14
]
# fmt: on

# The rebel's after training: wet, darker, in clumps with a wet shine, waves to the jaw curling
# out at the tips, the forehead under a wet fringe (no bare strip at the parting: it read as a
# bald patch).
WET = {'w': '#ad8a68', 'H': '#80603f', 'h': '#5e4028', 'm': '#422a18', 'd': '#2c1a0e', 'k': '#160c06'}
# fmt: off
WAVES_25 = [              # (padded a pixel each side: the curls stick out)
    #0123456789ABCDEFGHI
    '......kkkkk........',  # 0
    '....kkmhhhhkkk.....',  # 1
    '...kmhHwhmhhmhkk...',  # 2  wet clumps, a shine streaking along them
    '..kmhmhhHwmhhhmhk..',  # 3
    '..kdmhmmhhmdmhhmhk.',  # 4  swept forward over the whole forehead
    '.kdmhmdmmhhmdmhdhk.',  # 5
    '.kddmhmdmmhmdkdmdk.',  # 6  their wet tips down to the brow
    '.kdmhmmdmhdkdS.....',  # 7  a curl at the temple
    '.kmdmhmdmhd........',  # 8  waves over the ear
    '.kdmhdmhmdk........',  # 9
    '.kdmdhmdmhk........',  # 10
    '..kdmhdmdk.........',  # 11
    '.khkdmhdk..........',  # 12 to the jaw
    'kHdkdmhkk..........',  # 13 the tips curling out
    '.kk.kHdHk..........',  # 14
    '.....kk.k..........',  # 15
]
WAVES_29 = [
    #0123456789ABCDEFGHI
    '......kkkkkk.......',  # 0
    '....kkhhHhmhkk.....',  # 1
    '...khHwhmhhhmhdk...',  # 2  wet clumps, a shine streaking along them
    '..khhmhHwmhhhmhhdk.',  # 3  combed over to the far side,
    '..kdhmhhmhhmhhmhdk.',  # 4  the forehead covered to the brows
    '.khmhhmhhmhdmhmhdk.',  # 5  in wet clumps
    '.kdhmhhmdhkSdkMhdk.',  # 6  their tips stuck to it
    '.kmhmdhdkS......dk.',  # 7  their tips over the near brow
    '.kdhmdkS........dk.',  # 8
    '.khdm..........dhk.',  # 9  waves down both sides
    '.kdhd..........hdk.',  # 10
    '.khdm..........dmk.',  # 11
    'kdhk...........kdhk',  # 12 to the jaw
    'kHkk...........kkHk',  # 13 the tips curling out
    '.k...............k.',  # 14
]
# fmt: on

# The undercover cosplayer's wig: a layered white bob to the chin, cool white with grey-lilac
# shade between its clumps (not the warm cream of B-2's; no hairband, no blindfold): a long fringe
# swept from the part on the far side down across the forehead and over one eye, its tips in
# points; chopped, tapered tips at the cheeks and the jaw; the nape tapering in.
WIG = {'H': '#ffffff', 'h': '#e6e9f3', 'g': '#c5c7dc', 'm': '#9fa1bf', 'd': '#727396', 'k': '#44465e'}
# fmt: off
BOB_25 = [
    #0123456789ABCDEFG
    '.................',  # 0
    '.....kkkkkkk.....',  # 1  the crown sits low on the head
    '...kkghHHHHhkk...',  # 2
    '..kghhgHHHHhhhk..',  # 3  clumps from the crown, lilac shade between them
    '.kmghhghhHhhghhk.',  # 4
    '.kmgmhhghhhgHhhhk',  # 5  the fringe swept forward, the light on its curve
    'kdmghhmghhghhHghk',  # 6
    'kdmghmghhghhgShgk',  # 7  its pointed tips over the brow
    '.kmgmhghgkgS..hk.',  # 8
    'kdmgmhgmgh.......',  # 9  over the ear
    'kdmgmhgmghk......',  # 10
    '.kdgmhgmghg......',  # 11 a lock's tip on the cheek
    '.kdgmhgmgmhk.....',  # 12
    '..kdmgmdgmgk.....',  # 13 the nape tapering in
    '..kdkdmkdmgk.....',  # 14 chopped, tapered tips at the jaw
    '...k.kdk.kmk.....',  # 15
    '......k...k......',  # 16
]
BOB_29 = [
    #0123456789ABCDEFG
    '.................',  # 0
    '.....kkkkk k.....',  # 1  the part on the far side
    '...kkhHHHHkgkk...',  # 2
    '..khHHHhhhgkgmk..',  # 3
    '.khHhhghhhgkhmmk.',  # 4
    '.khhghhghhghhgmk.',  # 5  the fringe swept from the part across the forehead
    'khhghhghhghhhgmdk',  # 6
    'khghhghhghkS.hmdk',  # 7  in points over the near eye
    'khghhghkhS....gdk',  # 8
    'kmghgkhgS.....gdk',  # 9
    'kmghgk.k......mdk',  # 10
    '.kmghk........gdk',  # 11 layered sides to the chin
    'kmghmd........mdk',  # 12
    '.kmgmk.......kgdk',  # 13
    '.kdmdk.......kmk.',  # 14 chopped tips, curling in
    '..k.k.........k..',  # 15
]
# fmt: on

HAIRS = {
    'mop': (BROWN, MOP_25, MOP_29, (0, 0, 0, 0)),
    'swept': (BROWN, SWEPT_25, SWEPT_29, (0, 0, 0, 0)),
    'waves': (WET, WAVES_25, WAVES_29, (1, 0, 1, 0)),
    'bob': (WIG, BOB_25, BOB_29, (0, 0, 0, 0)),
}


# The faces shown now and then instead of the profile, as changes (column, row) of FACE_25: 76 the
# eyes shut (the lid down, a curved lash line), 77 half shut (the lid over the iris' top), 78 the
# pain face (eyes screwed up, the brow pulled down at the front, the mouth dropped open).
FACES = {
    76: {(11, 8): 'S', (12, 8): 'M', (13, 8): 'M', (11, 9): 'S', (12, 9): 'l', (13, 9): 'l',
         (11, 10): 'X', (12, 10): 'W', (13, 10): 'W'},
    77: {(11, 8): 'S', (12, 8): 'M', (13, 8): 'M', (11, 9): 'l', (12, 9): 'l', (13, 9): 'l',
         (11, 10): 'X', (12, 10): 'I', (13, 10): 'i'},
    78: {(12, 7): 'S', (13, 7): 'b', (12, 8): 'b', (13, 8): 'b', (11, 8): 'S', (11, 9): 'l', (12, 9): 'l',
         (13, 9): 'l', (11, 10): 'S', (12, 10): 'M', (13, 10): 'S', (13, 12): 'L', (13, 13): 'o',
         (14, 13): 'D'},
}


def marked(rows, marks):
    out = [list(r) for r in rows]
    for (x, y), ch in marks.items():
        out[y][x] = ch
    return [''.join(r) for r in out]


# The undercover cosplayer's sly half-smile: one corner of the mouth lifted.
SMIRK = {25: {(13, 12): 'L', (13, 13): 'M'}, 29: {(11, 12): 'L', (11, 13): 'S'}}


def head(hair='mop', front=False, face=None, smirk=False):
    """The face (29 or 25, or one of the faces 76-78 of the profile) with a look's hair over it."""
    legend, rows25, rows29, pad = HAIRS[hair]
    rows = FACE_29 if front else FACE_25
    if smirk:
        rows = marked(rows, SMIRK[29 if front else 25])
    if face:
        rows = marked(rows, FACES[face])
    p = Pic.text(rows, FACE).pad(*pad)
    p.paint(rows29 if front else rows25, {**legend, **SKIN})
    return p


def check():
    for name, rows in (('25', FACE_25), ('29', FACE_29)):
        for y, r in enumerate(rows):
            assert len(r) == 17, f'face {name} row {y}: {len(r)} wide'
            for ch in r:
                assert ch == '.' or ch in FACE, f'face {name} row {y}: {ch!r}'
    for hair, (legend, r25, r29, pad) in HAIRS.items():
        for name, rows in (('25', r25), ('29', r29)):
            w = 17 + pad[0] + pad[2]
            for y, r in enumerate(rows):
                assert len(r) == w, f'{hair} {name} row {y}: {len(r)} wide, not {w}'
                for ch in r:
                    assert ch in '. ' or ch in legend or ch in SKIN, f'{hair} {name} row {y}: {ch!r}'


check()

VIEWS = [(f'{h} {k}', (lambda h=h, k=k: head(h, k == 29, k if k > 29 else None)))
         for h in HAIRS for k in (25, 29, 76, 77, 78)]
