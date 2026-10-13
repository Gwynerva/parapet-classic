"""Granger's head, drawn from scratch: Tracer's chestnut hair in big uneven spikes swept up and
back, a fringe jutting over the goggles and a strand before the ear; a small upturned nose,
freckles, a wide cheeky grin, a pointed chin; silver rings in her left ear. Over the eyes, the
eyewear of the look: the orange single-lens goggles in a thick white frame (classic), aviator
sunglasses (Slipstream), round black goggles (Punk).

The pictures are text with a legend of semantic characters, lit from the upper front (the way
she runs: the right of the profile 25, the near left of the 3/4 face 29, whose far side turns
away into shade). Each grid marks Blaise's 16×17 head box (`*_BOX`, its top left corner in the
grid): `centred` pads the picture so the box sits where the game puts a head."""
from heads import Pic

# --------------------------------------------------------------------------------------------
# The legend. Hair: highlight → outline; skin: highlight (yellower) → deep shade (redder) →
# the outline in shade, `s` the lit edge; eyewear and features.
# --------------------------------------------------------------------------------------------
HAIR_CHESTNUT = {'H': '#d8b496', 'A': '#b48660', 'a': '#8c6042', 'b': '#684230', 'c': '#462a1e',
                 'k': '#24140e'}
HAIR_MAGENTA = {'H': '#ffc2f2', 'A': '#ff7ae0', 'a': '#e04cc6', 'b': '#b0329e', 'c': '#7c2276',
                'k': '#3a1038'}
SKIN = {'1': '#ffeccc', '2': '#ffd0a2', '3': '#f2ac7e', '4': '#d8845a', '5': '#ac553c',
        '6': '#62221a', 's': '#d07c58'}
FEATURES = {'m': '#5a1a1a', 't': '#fff4ea', 'p': '#d4766a', 'f': '#c27050', 'B': '#4a3024',
            'e': '#9aa4b4', 'E': '#f4f8ff'}
GOGGLES = {'W': '#ffffff', 'w': '#e2e2dc', 'q': '#b4b2ac', 'Q': '#7a7874',
           'Y': '#ffe28c', 'O': '#ffa030', 'R': '#e8681c', 'r': '#a83e18'}


def legend(hair=HAIR_CHESTNUT, extra=None):
    return {**hair, **SKIN, **FEATURES, **GOGGLES, **(extra or {})}


# --------------------------------------------------------------------------------------------
# The profile (25), facing right: column i is x + 5 of Blaise's head box, row j is y + 5.
# --------------------------------------------------------------------------------------------
PROF_BOX = (5, 5)
PROF = [
    '........................',  # -5
    '..........cA............',  # -4
    '....k.....bA.....c......',  # -3
    '....kba..cbaA...bA......',  # -2
    '.....kbacbaaAA.cbaA.....',  # -1
    '......kcbbaAHAbaAHAa....',  #  0
    '...kbcbaaaAAHAaaAAHAc...',  #  1
    '...kccbbaAAaaabaAAHHAc..',  #  2
    '....kcbaacbbaabbaAAAAac.',  #  3
    '....kcbaacbbaacccbbcbac.',  #  4
    '....kcbacbbaacqWWWWWWw..',  #  5
    '....kcbacbbacbWwOOYYOW..',  #  6
    '.....kcacbacccqqRRORrw..',  #  7
    '.....kcbcbc644bQqqqqwq..',  #  8
    '.....kcbcc6353b4443332s.',  #  9
    '......kcbc6353b32f1f224.',  # 10
    '.......kcc6643c32m122p..',  # 11
    '........kc55643322mmt...',  # 12
    '..........5456433223p...',  # 13
    '...........445564323s...',  # 14
    '............44455656....',  # 15
    '............44445.......',  # 16
]

# --------------------------------------------------------------------------------------------
# The 3/4 face (29): column i is x + 3 of the box, row j is y + 5.
# --------------------------------------------------------------------------------------------
FRONT_BOX = (3, 5)
FRONT = [
    '......................',  # -5
    '...........cA.........',  # -4
    '......k...cbA....c....',  # -3
    '.....kba..cbaA..bA....',  # -2
    '......kbacbaaA.cbaA...',  # -1
    '......kcbbaAHAbaAHAa..',  #  0
    '...kbcbbbaaAHHAaaAAAAc',  #  1
    '...kcbbbaaaaAAHAaAAAc.',  #  2
    '...kcbbaaAAAAaabcbbc..',  #  3
    '...kcaAAAaabc4334cbc..',  #  4
    '...kAaWWWWWWWWWWWWw...',  #  5
    '...kbWwYYOOOOYYOORq...',  #  6
    '...kcqwORRRRrwqRRrQ...',  #  7
    '...64Qqqqwwwq23QqqQ...',  #  8
    '...63b5443343235456...',  #  9
    '...64c42f1f22115f45...',  # 10
    '....6543m2223453m45...',  # 11
    '.....6543mttttmm456...',  # 12
    '......65434ppp4456....',  # 13
    '.......6543443456.....',  # 14
    '.........6532246......',  # 15
    '...........6556.......',  # 16
]


# --------------------------------------------------------------------------------------------
# Eyewear of the other looks: rows of the profile and the 3/4 face replaced (by their y).
# Slipstream: aviator sunglasses (dark teardrop lenses, a gold frame), the brows over them.
# Punk: round black goggles on a black strap.
# --------------------------------------------------------------------------------------------
SHADES = {'L': '#26242c', 'l': '#76809a', 'g': '#e2b456', 'K': '#18161c'}
NO_GOGGLE_CHEEKS_PROF = '.....kcbbc6353b332f222s.'
NO_GOGGLE_CHEEKS_FRONT = '...63b4332232234456...'
EYEWEAR = {
    'slipstream': {
        'prof': {
            5: '....kcbcbabbcc5432BB2s..',
            6: '....kcbbcbbbcc4gggLlL2..',
            7: '.....kcbbabccc4332LLL3..',
            8: '.....kcbbbc644b3322232..',
            9: NO_GOGGLE_CHEEKS_PROF,
        },
        'front': {
            5: '...kAa4BBB2232BB345...',
            6: '...kbgLlLLLggLlLL45...',
            7: '...kc4LLLLL23LLLL45...',
            8: '...6443LLL3223LL445...',
            9: NO_GOGGLE_CHEEKS_FRONT,
        },
    },
    'punk': {
        'prof': {
            5: '....kcbcbabbcc543222KK..',
            6: '....kcbbcbbbKKKKKKKKlLK.',
            7: '.....kcbbabccc43323KLLK.',
            8: '.....kcbbbc644b33222KK..',
            9: NO_GOGGLE_CHEEKS_PROF,
        },
        'front': {
            5: '...kAa3KK22233KK345...',
            6: '...kKKKlLKKKKKlLK45...',
            7: '...kc4KLLK323KLLK45...',
            8: '...6443KK32223KK445...',
            9: NO_GOGGLE_CHEEKS_FRONT,
        },
    },
}
HAIR = {'classic': HAIR_CHESTNUT, 'slipstream': HAIR_CHESTNUT, 'punk': HAIR_MAGENTA}


def grid(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def centred(pic, box):
    """Pads a head picture so that Blaise's head box, whose top left corner is at `box` in it,
    sits where the game draws a head: the box's pixel (8, 8) on the picture's centre, the
    width even and the height odd like hers."""
    c, r = box[0] + 8, box[1] + 8
    w0, h0 = pic.w, pic.h
    pad_l = max(0, w0 - 2 * c)
    W = 2 * (c + pad_l)
    pad_t = max(0, h0 - 1 - 2 * r)
    H = 2 * (r + pad_t) + 1
    return pic.pad(pad_l, pad_t, W - w0 - pad_l, H - h0 - pad_t)


# Her left ear's silver rings (the side seen while she runs left: `25:left`, `29:left`).
RINGS_PROF = {(10, 14): 'E', (10, 16): 'e'}
RINGS_FRONT = {(3, 15): 'E', (4, 16): 'e'}
# The profile's faces: 76 and 77 blink (her eyes are behind the lens: the grin relaxes a little),
# 78 winces (the mouth open, the cheek pulled).
FACES = {
    76: {},
    77: {(17, 16): '2', (18, 17): 'm', (19, 17): 'm', (20, 17): '3'},
    78: {(17, 16): '3', (18, 17): 'm', (19, 17): 'm', (20, 17): 'm', (19, 18): 'm', (20, 18): '6',
         (18, 16): 'm', (20, 16): '4'},
}


def head(front=False, look='classic', side=None, face=None, extra=None, overlay=None):
    """A head picture of a look: its eyewear, its hair; `side` 'left' adds her ear rings, `face`
    (76-78) is the profile blinking or wincing."""
    rows, box = (FRONT, FRONT_BOX) if front else (PROF, PROF_BOX)
    rows = list(rows)
    for y, r in EYEWEAR.get(look, {}).get('front' if front else 'prof', {}).items():
        rows[y + 5] = r
    leg = legend(HAIR.get(look, HAIR_CHESTNUT), {**SHADES, **(extra or {})})
    p = Pic.text(grid(rows), leg)
    if overlay:
        p.paint(overlay, leg)
    marks = {}
    if side == 'left':
        marks.update(RINGS_FRONT if front else RINGS_PROF)
    if face and not front:
        marks.update(FACES[face])
    for (x, y), ch in marks.items():
        p.set(x, y, leg[ch])
    return centred(p, box)
