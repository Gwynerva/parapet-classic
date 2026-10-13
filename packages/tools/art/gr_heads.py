"""Grove's head, drawn from scratch: Carl "CJ" Johnson (GTA: San Andreas).

What a fan names first: a very short caesar cut with a crisp squared hairline (not a shaved
head), a thin moustache joined to a chin goatee, heavy scowling brows over small deep-set eyes,
a broad nose with a lit tip, a full lower lip, ears that stick out, warm medium-brown skin and a
long neck.

Lit like the rest of the cast from the upper front: in the profile (25, facing right) the crown,
the brow ridge, the nose and the cheekbone facing us are lit, the back of the head, the nape and
under the jaw in shade; in the 3/4 face (29) the front of the face is lit, the far cheek narrower
and a step darker, the nose's shadow on the far side. Skin shadows go redder and more saturated,
highlights lighter and yellower; a dark outline in shade, a warm lighter edge where the light
hits.

Base 1 (the man) heads are 17 x 17; these are 17 x 19 with the head a pixel higher and the neck
three rows longer, so he stands with his long neck. The look tool turns 25 into 26-28. 76 / 77
are the blinks, 78 the pain face ("Ah sh*t...")."""
from heads import Pic

# Skin: warm medium brown (base #84513a); hue-shifted: shadows redder, highlights yellower.
SKIN = {
    'X': '#dba377',  # specular: nose tip, brow ridge, cheekbone
    'W': '#bb7d58',  # light
    'L': '#9f6549',  # light-mid
    'M': '#84513a',  # base
    'S': '#683627',  # shadow (redder)
    'D': '#4a1f18',  # deep shadow (red-brown)
    'o': '#260e0b',  # outline in shade
    'O': '#6a3524',  # outline where the light hits (sel-out)
    'r': '#3c150f',  # inside the ear, the nostrils
}
FACE = {
    'e': '#d2c0aa',  # eye white (warm, never pure white)
    'i': '#2a140c',  # iris (dark brown)
    'b': '#1c0f0a',  # brows
    'm': '#24140e',  # moustache and goatee
    'n': '#4c2a1e',  # stubble at their edges
    'u': '#8a4d3e',  # upper lip under the moustache
    'l': '#98584c',  # lower lip
    'p': '#b07163',  # lower lip's highlight
}
HAIR = {
    'k': '#140b08',  # hair outline
    'h': '#2a1a13',  # hair in shade
    'H': '#3d2a1f',  # hair
    'Y': '#5e4635',  # crown highlight band
    'f': '#3a251c',  # the faded sides: short hair over skin
    'F': '#50352a',  # the fade where the light reaches it
}
LEGEND = {**SKIN, **FACE, **HAIR}

# fmt: off
PROFILE = [            # 25: facing right
    #0123456789ABCDEFG
    '......kkkkk......',  # 0
    '....kkHHYYYkk....',  # 1
    '...khHHHYYYYk....',  # 2
    '..khHHHHHYYhWO...',  # 3  squared hairline over the forehead
    '..khHHHHHhLWXWO..',  # 4  the temple's corner
    '..kfoooMLWWbbbO..',  # 5  heavy brow on the ridge; the ear's top; the faded sides
    '..kFoWLSLWSeiO...',  # 6  deep-set eye; the ear's lit rim
    '..oFoLrSMXWLWWO..',  # 7  cheekbone; the bridge
    '..ofoLrMMLWMLWXO.',  # 8  the broad nose, its lit tip
    '..oSoMSSMLLMSrSo.',  # 9  the nostril
    '...oSoSMMLLnmmo..',  # 10 the moustache; the ear's lobe
    '...oDSMMMLMnlpo..',  # 11 the full lower lip
    '....oSMMMLMMmo...',  # 12 the goatee under it
    '.....oSMMMMnmO...',  # 13 the chin
    '......oDDooomo...',  # 14 the jaw's shadow on the neck
    '......oDSSDo.....',  # 15 the long neck
    '......oDSMLo.....',  # 16
    '......oDSMLo.....',  # 17
    '......oDSMLo.....',  # 18
]

FRONT = [              # 29: the 3/4 face, turned to us, facing right
    #0123456789ABCDEFG
    '......kkkkk......',  # 0
    '....kkHYYYHkk....',  # 1
    '...khHYYYYHHhk...',  # 2
    '..khHHYYYHHHhhk..',  # 3  squared hairline
    '..kfFSMLWWWLSfk..',  # 4  the hair's shade on the forehead, the faded temples
    '..kFMLWXXWWLMSo..',  # 5
    '..kfSbbLWXWLbbo..',  # 6  scowling brows
    '.oOSSeibLWbeiSoo.',  # 7  small deep-set eyes, inner brows down
    '.oLrSMWLLWMLMSoS.',  # 8  cheekbones, the bridge
    '.oMrSMLLLWXSMSoo.',  # 9  the nose's lit tip, its shadow to the far side
    '..oSSMLMSrSrSSo..',  # 10 broad nostrils
    '...oSMLnmmmmnSo..',  # 11 the moustache
    '...oDSMSuuuuSo...',  # 12 the upper lip
    '....oDnnlpplno...',  # 13 the full lower lip; the moustache joins the goatee
    '.....oDnmmmmo....',  # 14 the goatee
    '......oDDDSo.....',  # 15 the jaw's shadow on the long neck
    '......oMLMSo.....',  # 16
    '......oMLMSo.....',  # 17
    '......oMLMSo.....',  # 18
]
# fmt: on


def _edit(rows, changes):
    """A copy of `rows` with {(x, y): char} changed."""
    out = [list(r) for r in rows]
    for (x, y), ch in changes.items():
        out[y][x] = ch
    return [''.join(r) for r in out]


# The faces shown instead of the profile: shut eyes (two blinks) and the pain face.
BLINK = _edit(PROFILE, {(11, 6): 'S', (12, 6): 'b'})
SQUINT = _edit(PROFILE, {(11, 6): 'b', (12, 6): 'i'})
PAIN = _edit(PROFILE, {(11, 6): 'b', (12, 6): 'b', (12, 11): 'o', (13, 11): 'r'})


# The green rag (grove-green): tied over the crown, low on the forehead, knotted at the back
# (its two tails are a ribbon of the look).
RAG = {'A': '#86b562', 'B': '#5e9142', 'C': '#477532', 'E': '#305525', 'F': '#152a10'}
# fmt: off
RAG_PROFILE = [
    #0123456789ABCDEFG
    '......FFFFF......',  # 0
    '....FFCBBAAFF....',  # 1
    '...FECCBBBAABF...',  # 2
    '..FECCCBBBBAABF..',  # 3
    '.FEECCCCBBBBBBF..',  # 4  its lower edge over the forehead
    'FCEF.............',  # 5  the knot
    '.FF..............',  # 6
]
RAG_FRONT = [
    #0123456789ABCDEFG
    '......FFFFF......',  # 0
    '....FFBAAABFF....',  # 1
    '...FEBAAAABBEF...',  # 2
    '..FECBBBBBBBCEF..',  # 3
    '..FECCCCCCCCCEF..',  # 4
]
# fmt: on


def _pic(rows, rag):
    p = Pic.text(rows, LEGEND)
    if rag:
        p.paint(RAG_FRONT if rows is FRONT else RAG_PROFILE, RAG)
    return p


def profile(rag=False):
    return _pic(PROFILE, rag)


def front(rag=False):
    return _pic(FRONT, rag)


def profile_short(rag=False):
    """The profile with the neck cut under the jaw (same box): the look tool turns this one
    into 26-28, so a tilted head in a flip does not swing a long stalk of neck."""
    return _pic(PROFILE[:16] + ['.' * len(PROFILE[0])] * (len(PROFILE) - 16), rag)


def blink(rag=False):
    return _pic(BLINK, rag)


def squint(rag=False):
    return _pic(SQUINT, rag)


def pain(rag=False):
    return _pic(PAIN, rag)


VIEWS = [('25', profile), ('29', front), ('76', blink), ('77', squint), ('78', pain),
         ('25 rag', lambda: profile(True)), ('29 rag', lambda: front(True))]


def check():
    for name, rows in (('profile', PROFILE), ('front', FRONT), ('blink', BLINK), ('pain', PAIN)):
        for y, r in enumerate(rows):
            assert len(r) == len(rows[0]), f'{name} row {y}: {len(r)} wide'
            for ch in r:
                assert ch == '.' or ch in LEGEND, f'{name} row {y}: {ch!r}'
    for name, rows in (('rag', RAG_PROFILE), ('rag front', RAG_FRONT)):
        for y, r in enumerate(rows):
            assert len(r) == len(PROFILE[0]), f'{name} row {y}: {len(r)} wide'
            for ch in r:
                assert ch == '.' or ch in RAG, f'{name} row {y}: {ch!r}'


check()
