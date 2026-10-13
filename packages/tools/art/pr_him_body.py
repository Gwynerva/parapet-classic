"""The twin brother's bodies (Petra's four men's looks), drawn anew: the upright pictures of the
chest (57, front 61), the torso (34, front 38), the shin (30) and the shoes (39, 43, 47, 48);
the look tool turns the upright ones into their tilted pictures. The arms, thighs and knees are
the man's own, recoloured and grown (pr_looks.py).

His build: an ordinary slim young man in roomy clothes - tees a size or two too big hanging
past the hips with the sleeves to the elbows, loose joggers gathered at the ankles; bare arms in
the fencer's sleeveless mesh; slim jeans under the undercover cosplayer's long cardigan.

Lit like the heads, from the upper front: in profile the front edge and the side facing us are
lit, the back in shade; turned to us, the middle is lit and the sides roll into shade."""
from heads import Pic
from pr_him_face import SKIN


def legend(*parts):
    """One legend from several; no character may mean two colours."""
    out = {}
    for p in parts:
        for k, v in p.items():
            assert out.get(k, v) == v, f'{k!r} is both {out[k]} and {v}'
            out[k] = v
    return out


# Black joggers / trousers (the swordsman's, the fencer's, the rebel's).
JOG = {'j': '#5a5a66', 'J': '#40404a', 'K': '#2c2c34', 'q': '#1e1e24', 'Q': '#101014'}

# ------------------------------------------------------------------------------- swordsman
# An oversized navy tee (#24263b) with a grey-trimmed V-neck; black joggers with a white
# drawstring; knitted slipper-socks striped olive-yellow and black.
NAVY = {'A': '#5e6898', 'B': '#434c7c', 'C': '#30375f', 'E': '#222744', 'F': '#14162a'}
TRIM = {'g': '#b4b8c2', 'G': '#7c8290'}
CORD = {'w': '#f0eee8', 'v': '#b8b4ac'}
KNIT = {'y': '#dccb62', 'Y': '#ad9e3e', 'u': '#6f6a2c', 'z': '#2c2b20', 'Z': '#16160e'}

# fmt: off
SW_CHEST = [            # 57: profile, the front to the right
    #0123456789
    '...DSMW...',  # 0  the neck
    '...DSMW...',  # 1
    '..GgSMWWg.',  # 2  the collar's grey trim round the neck
    '.ECBgMWgGA',  # 3  the V's opening at the front
    'FECBBgWgBA',  # 4
    'FECBBBgBAA',  # 5  its point
    'FECCBBBBAA',  # 6
    'FECCEBBBAB',  # 7  a fold under the dropped sleeve
    'FECCBEBBAB',  # 8
    'FEECCBBBBB',  # 9
    'FEECCBBBBC',  # 10
    '.FEECCCCCE',  # 11
]
SW_CHEST_FRONT = [      # 61: turned to us, the V-neck trimmed grey
    #0123456789A
    '...oDMWo...',  # 0
    '...oDMWo...',  # 1
    '..CgDMWgC..',  # 2  the collar round the neck
    '.ECBgSWgBA.',  # 3  the V
    'FECBBgMgBAB',  # 4
    'FECBBBgBAAB',  # 5  its point
    'FECEBBBBAAB',  # 6  folds of the loose tee
    'FECCEBBBEAB',  # 7
    'FECCBBBEBAB',  # 8
    'FECCBBBBBBC',  # 9
    'FEECCBBBBCC',  # 10
    '.FEECCBCCCE',  # 11
    '.FFEEEEEEEF',  # 12
]
SW_TORSO = [            # 34: profile; the tee hangs to the hips over the joggers
    #0123456789A
    '..FECBBBAB.',  # 0
    '.FECCBBBAB.',  # 1
    '.FECCBBBBAB',  # 2
    '.FECCBBBBAB',  # 3
    '.FECCBBBBAB',  # 4
    'FECCCBBBBBB',  # 5
    'FECCCBBBBBC',  # 6
    'FECCCCBBBBC',  # 7
    'FEECCCCBBBC',  # 8
    'FEEECCCCCCE',  # 9  the tee's hem, loose
    '.FFFEEEEEEF',  # 10
    '.QKJJJjjJwJ',  # 11 the joggers' waist, the drawstring's end
    'QKJJJjjJJvK',  # 12
    'QKJJJJJJJJK',  # 13
    '.QKKJJJJKKQ',  # 14
    '..QQKKKKQQ.',  # 15
]
SW_TORSO_FRONT = [      # 38: turned to us
    #0123456789AB
    '.FECBBBBABB.',  # 0
    'FECCBBBBAABB',  # 1
    'FECCBBBBAABB',  # 2
    'FECCBBBBAABB',  # 3
    'FECCBBBBBABC',  # 4
    'FECCCBBBBBBC',  # 5
    'FECCCBBBBBCC',  # 6
    'FEECCBBBBBCC',  # 7
    'FEECCCBBBCCE',  # 8
    'FEEECCCCCCEE',  # 9
    '.FFFEEEEEEFF',  # 10
    'QKJJjwwjJJKQ',  # 11 the drawstring's two ends
    'QKJJJvJvJJKQ',  # 12
    'QKJJJJKJJJKQ',  # 13
    '.QKJJKQKJJKQ',  # 14
    '..QQQ...QQQ.',  # 15
]
SW_SHIN = [             # 30: the knee at the top; loose, bunching over the elastic cuff
    #0123456
    'QKJJjJ.',  # 0
    'QKJJjJK',  # 1
    'QKJJjJK',  # 2
    'QKJJJJK',  # 3
    'QKKJJJK',  # 4
    'QKJjJJK',  # 5  folds
    'QKJJKJK',  # 6
    'QKjJJKQ',  # 7
    'QKJJjJQ',  # 8
    '.QKJJKQ',  # 9
    '.QqKKqQ',  # 10 the cuff
    '..QqqQ.',  # 11
]
SW_SHOE = [             # 39: a knitted slipper-sock, soft and round, the toe to the right
    #0123456789ABC
    '..QqKqQ......',  # 0  the joggers' cuff over its heel
    '.ZyYyYyYZ....',  # 1  rows of olive-yellow and black knit
    'ZzuzzuzzzuZ..',  # 2
    'ZYyYyYyYyYyyZ',  # 3
    '.ZzzZzzZzzzZ.',  # 4  a soft knit sole, no welt
]
SW_SHOE_SHORT = [       # 47: the foot turned toward us
    #0123456789A
    '..QqKqQ....',  # 0
    '.ZyYyYyZ...',  # 1
    'ZzuzzuzzuZ.',  # 2
    'ZYyYyYyYyyZ',  # 3
    '.ZzzZzzZzZ.',  # 4
]
SW_SHOE_FRONT = [       # 48: from the front
    #0123456
    '.QqKqQ.',  # 0
    'ZyYyYyZ',  # 1
    'ZzuzzzZ',  # 2
    'ZYyYyyZ',  # 3
    '.ZzzzZ.',  # 4
]
# fmt: on

# ---------------------------------------------------------------------------------- fencer
# A sleeveless top of sheer brown mesh (#4d2422) with his skin showing through it, a black cord
# round the neck; loose black trousers; black running shoes on thick white soles.
# The mesh is drawn in three placeholder tones (lit, mid, shade) and woven after the look tool
# has turned the pictures (`weave`), so its fine net stays crisp at every angle.
MESH = {
    '1': '#fe01e1',  # the mesh over lit skin
    '2': '#fe01e2',  # the mesh over skin
    '3': '#fe01e3',  # the mesh in shade
    'f': '#2a1210',  # its edges
    'k': '#121012',  # the black cord
}
# Each placeholder: (thread, skin through the net).
WEAVE = {
    '#fe01e1': ('#6c3229', '#c98f78'),
    '#fe01e2': ('#502520', '#9e6454'),
    '#fe01e3': ('#361613', '#70402f'),
}
SNEAK = {'z': '#101014', 'Z': '#22222a', 'y': '#3e3e4a', 's': '#f2f2ee', 't': '#b8b8bc'}

# fmt: off
FE_CHEST = [            # 57: profile; the cord hangs down the front of the chest
    #0123456789
    '...DSMW...',  # 0
    '...DSMW...',  # 1
    '..fDSMWk..',  # 2  the low round neckline; the cord round the neck
    '.f3fSMWkf.',  # 3
    'f332fWWk1f',  # 4
    'f3322211kf',  # 5
    'f3322211kf',  # 6
    'f332222k1f',  # 7  its loop's end
    'f332222111',  # 8
    'f332222211',  # 9
    'f333222211',  # 10
    '.ff3332221',  # 11
]
FE_CHEST_FRONT = [      # 61: turned to us; bare shoulders, the cord's loop on the chest
    #0123456789A
    '...oDMWo...',  # 0
    '...oDMWo...',  # 1
    '...kDMWk...',  # 2  the cord at the neck
    '.SfkSMWWkfX',  # 3  the straps over bare shoulders
    'DSfkfWWfk1W',  # 4  the scooped neckline
    'DS32kf2fk1W',  # 5  the cord's two strands
    'D332kf2k11f',  # 6
    'f3322kk2111',  # 7  joined at the bottom of the loop
    'f3322222111',  # 8
    'f3322222111',  # 9
    'f3332222211',  # 10
    '.f333222221',  # 11
    '.ff33333ff.',  # 12
]
FE_TORSO = [            # 34: profile; the top to the hips, the trousers' waist
    #0123456789A
    '..f33222111',  # 0
    '.f333222111',  # 1
    '.f332222111',  # 2
    '.f332222211',  # 3
    '.f333222211',  # 4
    'f3333222221',  # 5
    'f3333322222',  # 6
    'f3333332223',  # 7
    '.ffffffffff',  # 8  its hem
    '.QKJJjjJJJK',  # 9  the trousers, loose
    'QKJJJjJJJJK',  # 10
    'QKJJJJJJJJK',  # 11
    'QKJJJJJJJJK',  # 12
    '.QKKJJJJKKQ',  # 13
    '..QQKKKKQQ.',  # 14
    '...........',  # 15
]
FE_TORSO_FRONT = [      # 38
    #0123456789AB
    '.f332222111.',  # 0
    'f3332222111f',  # 1
    'f3322222111f',  # 2
    'f3322222211f',  # 3
    'f3332222211f',  # 4
    'f3332222221f',  # 5
    'f3333222222f',  # 6
    'f3333322223f',  # 7
    '.ffffffffff.',  # 8
    'QKJJjjjJJJKQ',  # 9
    'QKJJJjJJJJKQ',  # 10
    'QKJJJJKJJJKQ',  # 11
    'QKJJJKQKJJKQ',  # 12
    '.QKJJKQKJJK.',  # 13
    '..QQQ...QQ..',  # 14
    '............',  # 15
]
FE_SHIN = [             # 30: straight and loose, the hem over the shoe
    #0123456
    'QKJJjJ.',  # 0
    'QKJJjJK',  # 1
    'QKJJjJK',  # 2
    'QKJJJJK',  # 3
    'QKJJJJK',  # 4
    'QKKJJJK',  # 5
    'QKJJJJK',  # 6
    'QKJJjJK',  # 7
    'QKJJjJK',  # 8
    'QKJJJJK',  # 9
    'QKKJJJK',  # 10
    'QQKKKKQ',  # 11
]
FE_SHOE = [             # 39: a black running shoe, a grey stripe, a thick white sole
    #0123456789ABC
    '.QKKKKQ......',  # 0  the trousers' hem
    '.zZZZZZzyy...',  # 1
    'zZyZZyZZZyyz.',  # 2
    'zZZyyZZZZZZZz',  # 3  the stripe
    'tssssssssssst',  # 4  the white sole
]
FE_SHOE_SHORT = [       # 47
    #0123456789A
    '.QKKKKQ....',  # 0
    '.zZZZZzyy..',  # 1
    'zZyZZZZZyyz',  # 2
    'zZZZZZZZZZz',  # 3
    'tsssssssssz',  # 4
]
FE_SHOE_FRONT = [       # 48
    #0123456
    '.QKKKQ.',  # 0
    'zZyyyZz',  # 1
    'zZZyZZz',  # 2
    'zZZZZZz',  # 3
    'tsssssz',  # 4
]
# fmt: on

# ----------------------------------------------------------------------------------- rebel
# A faded maroon tee (#5a2422 to #7a3a38), oversized, its wide stretched neckline trimmed black,
# a black spray-painted circle-A across the chest, little holes, a tiny badge; black joggers with
# white drawstrings; black-and-white checkerboard canvas slip-ons on white soles.
MAROON = {'A': '#b46a68', 'B': '#94504f', 'C': '#78393c', 'E': '#5a2628', 'F': '#341416'}
SPRAY = {'x': '#1a1214', 'y': '#4a2a2c', 'h': '#241014', 'g': '#e2d6a4'}
CHECK = {'1': '#f4f2ec', '2': '#c4c2bc', '3': '#18161a', '4': '#36343a', '5': '#fbfaf6', '6': '#b0aea8'}

# fmt: off
RB_CHEST = [            # 57: profile; the wide neckline bares the collarbone; the circle-A
    #0123456789            shows round the chest's side
    '...DSMW...',  # 0
    '...DSMW...',  # 1
    '..xDSMWWx.',  # 2  the black-trimmed neckline, stretched wide
    '.ECxSMWxBA',  # 3
    'FECBxxxBgA',  # 4  the tiny badge
    'FECBBBxBBA',  # 5  the A's apex
    'FECBBxxxBA',  # 6  the circle
    'FEChxxBxxA',  # 7  a hole
    'FECCxxxxxB',  # 8  the bar
    'FECCxBBBxB',  # 9
    'FEECCxxxBC',  # 10
    '.FEExCCCxE',  # 11 the A's feet
]
RB_CHEST_FRONT = [      # 61: the circle-A sprayed across the chest
    #0123456789AB
    '....oDMWo...',  # 0
    '....oDMWo...',  # 1
    '.ExMSDMWWMxA',  # 2  the wide stretched neckline trimmed black
    'FECxxSMWMxxA',  # 3
    'FECBBBxBBBgA',  # 4  the A's apex over the circle; the badge
    'FECBxxxxxBBA',  # 5  the circle
    'FECxBxBxBxBA',  # 6  the A's legs inside it
    'FECxBxBxBxBA',  # 7
    'FECxxxxxxxBA',  # 8  the bar
    'FECxxBhBxxBB',  # 9  a hole
    'FEEBxxxxxBBC',  # 10
    '.FExBBBBBxCE',  # 11 the A's feet out of the circle
    '.FFEEEEEEEEF',  # 12
]
RB_TORSO = [            # 34: profile; the tee long, the white drawstrings under it
    #0123456789A
    '..FECBBBxB.',  # 0
    '.FECCBBBxB.',  # 1
    '.FECCBBBBBA',  # 2
    '.FECCBBhBBA',  # 3
    '.FECCBBBBBA',  # 4
    'FECCCBBBBBB',  # 5
    'FECCCCBBBBC',  # 6
    'FEECCCBBBBC',  # 7
    'FEECCCCBBCC',  # 8
    'FEEECCCCCCE',  # 9
    'FEEEEEEEEEF',  # 10 the hem low on the hips
    '.FFFFFFFFww',  # 11
    'QKJJJjjJJwv',  # 12 the strings hang
    'QKJJJJJJJKv',  # 13
    '.QKKJJJJKKQ',  # 14
    '..QQKKKKQQ.',  # 15
]
RB_TORSO_FRONT = [      # 38
    #0123456789AB
    '.FECBBBBBBB.',  # 0
    'FECCBxBBBBBB',  # 1
    'FECCBBBBBBBC',  # 2
    'FECCBBBBhBBC',  # 3
    'FECCBBBBBBBC',  # 4
    'FECCCBBBBBCC',  # 5
    'FECCCBBBBBCC',  # 6
    'FEECCCBBBCCE',  # 7
    'FEECCCCCCCEE',  # 8
    'FEEEECCCCEEE',  # 9
    'FFEEEEEEEEEF',  # 10
    '.FFFFwwFFFF.',  # 11
    'QKJJJwJwJJKQ',  # 12 the strings
    'QKJJJvJvJJKQ',  # 13
    '.QKJJKQKJJK.',  # 14
    '..QQQ...QQ..',  # 15
]
RB_SHIN = [             # 30: the joggers gathered over the ankle
    #0123456
    'QKJJjJ.',  # 0
    'QKJJjJK',  # 1
    'QKJJjJK',  # 2
    'QKJJJJK',  # 3
    'QKKJJJK',  # 4
    'QKJjJJK',  # 5
    'QKJJKJK',  # 6
    'QKjJJKQ',  # 7
    'QKJJjJQ',  # 8
    '.QKJJKQ',  # 9
    '.QqKKqQ',  # 10 the cuff
    '..QqqQ.',  # 11
]
RB_SHOE = [             # 39: a canvas slip-on in black and white checks, a white sole
    #0123456789ABC
    '..QqKqQ......',  # 0  the joggers' cuff
    '.4134141.....',  # 1  the low collar
    '43141341314..',  # 2  the checks
    '413231413234.',  # 3
    '6555555555556',  # 4  the white sole and foxing
]
RB_SHOE_SHORT = [       # 47
    #0123456789A
    '..QqKqQ....',  # 0
    '.4134141...',  # 1
    '431413414..',  # 2
    '41323141324',  # 3
    '65555555556',  # 4
]
RB_SHOE_FRONT = [       # 48
    #0123456
    '.QqKqQ.',  # 0
    '4134134',  # 1
    '4323144',  # 2
    '4134134',  # 3
    '6555556',  # 4
]
# fmt: on

# ------------------------------------------------------------------------------ undercover
# A long black cardigan, open, over a white collared shirt; big black headphones round the neck;
# the straps of a black backpack; slim dark indigo jeans; white canvas low-tops.
CARD = {'A': '#56566a', 'B': '#3a3a48', 'C': '#28283a', 'E': '#1a1a26', 'F': '#0c0c12'}
SHIRT = {'w': '#f6f6f8', 'v': '#d6d8e2', 'u': '#a4a8b8'}
PHONES = {'q': '#16161c', 'Q': '#3c3e4c', 'R': '#7a7e90'}
STRAP = {'p': '#2e3038', 'P': '#8a8e9a'}
JEANS = {'j': '#5a6c9e', 'J': '#3e4e7e', 'K': '#2c3862', 'Z': '#1e2644', 'Y': '#12172a'}
CANVAS = {'s': '#fafaf6', 't': '#dcdcd8', 'T': '#a8aab0', 'l': '#7c7e86'}

# fmt: off
UC_CHEST = [            # 57: profile; a headphone cup on the neck, the shirt's collar, the
    #0123456789          backpack's strap over the shoulder
    '...DSMW...',  # 0
    '..qQRqW...',  # 1  the big black cup, its rim catching the light
    '..qRQqvW..',  # 2  the collar's point under it
    '.EqqqpvwA.',  # 3
    'FECBBpBvwA',  # 4  the strap
    'FECBBpBuwA',  # 5
    'FECCBpBvwA',  # 6  the shirt in the open front
    'FECCBpBuwA',  # 7
    'FECCBPBvwA',  # 8  the strap's buckle
    'FECCCpBvwB',  # 9
    'FEECCpBuvB',  # 10
    '.FEECpCvvE',  # 11
]
UC_CHEST_FRONT = [      # 61: turned to us
    #0123456789AB
    '....oDMWo...',  # 0
    '..qQoDMWoQq.',  # 1  the headphones round the neck, a cup each side
    '..qRwDMWwRq.',  # 2  the collar's points
    '.EqqqvwvqqqA',  # 3
    'FECBpvwvpBBA',  # 4
    'FECBpvuvpBBA',  # 5  the straps
    'FECBpwvwpBAA',  # 6
    'FECCpvuvpBAA',  # 7
    'FECCPwvwPBAA',  # 8  the buckles
    'FECCpvuvpBBA',  # 9
    'FEECpwvwpBBB',  # 10
    '.FEECvuvCBBE',  # 11
    '.FFEEvvvEEEF',  # 12
]
UC_TORSO = [            # 34: profile; the cardigan open over the shirt, the jeans' waist
    #0123456789A
    '..FECBBvwA.',  # 0
    '.FECCBBuwA.',  # 1
    '.FECCBBvwA.',  # 2
    '.FECCBBuwA.',  # 3
    '.FECCBBvwA.',  # 4
    'FECCCBBvwB.',  # 5
    'FECCCBBuwB.',  # 6
    'FECCCBBvvB.',  # 7
    'FECCCBBYYB.',  # 8  the shirt tucked into the jeans' waist
    'FECCCBBjjB.',  # 9
    'FECCCBBJjB.',  # 10
    'FEECCBBJJBK',  # 11
    '.FEECBBJJBK',  # 12
    '.FEECCBKJCZ',  # 13
    '..FEECCZKCY',  # 14
    '...FFEEEYY.',  # 15
]
UC_TORSO_FRONT = [      # 38
    #0123456789AB
    '.FECBvwvBBA.',  # 0
    'FECCBvuvBBAB',  # 1
    'FECCBwvwBBAB',  # 2
    'FECCBvuvBBAB',  # 3
    'FECCBwvwBBAB',  # 4
    'FECCBvuvBBBB',  # 5
    'FECCBwvwBBBC',  # 6
    'FECCBYTYBBBC',  # 7  the belt's buckle
    'FECCBjjjBBBC',  # 8
    'FECCBjJjBBCC',  # 9
    'FECCBJKJBBCC',  # 10
    'FEECBKYKBCCE',  # 11
    'FEECCZ.ZCCEE',  # 12
    '.FEEC...CEEF',  # 13
    '..FFE...EFF.',  # 14
    '............',  # 15
]
UC_SHIN = [             # 30: slim jeans
    #01234
    '.ZKJj',  # 0
    'ZKJjJ',  # 1
    'ZKJjJ',  # 2
    'ZKJJJ',  # 3
    'ZKJJK',  # 4
    'ZKJjK',  # 5
    'ZKJjK',  # 6
    'ZKJJK',  # 7
    'ZKJJK',  # 8
    'ZKKJK',  # 9
    'ZKJJK',  # 10
    'YZZZY',  # 11 the hem
]
UC_SHOE = [             # 39: a white canvas low-top, white laces, a white sole with a grey line
    #0123456789ABC
    '.YZZZY.......',  # 0  the jeans' hem
    '.ltsTsTsTs...',  # 1  the laces up the tongue
    'ltssssssstss.',  # 2
    'lTTTTTTTTTTTl',  # 3  the sole's grey line
    'ltsssssssssst',  # 4  the white sole
]
UC_SHOE_SHORT = [       # 47
    #0123456789A
    '.YZZZY.....',  # 0
    '.ltsTsTs...',  # 1
    'ltsssssstl.',  # 2
    'lTTTTTTTTTl',  # 3
    'ltsssssssst',  # 4
]
UC_SHOE_FRONT = [       # 48
    #0123456
    '.YZZY..',  # 0
    'ltTsTtl',  # 1
    'ltssstl',  # 2
    'lTTTTTl',  # 3
    'ltssstl',  # 4
]
# fmt: on

# The cardigan's long tails over the hips and the thighs (a hips attachment), its fronts hanging
# open: centred like the torso, its row r is row r + 8 here and its column c is c + 1.
# fmt: off
UC_TAILS_34 = ['.' * 13] * 17 + [
    #0123456789ABC
    '.FECCCBB..BA.',  # torso 9
    '.FECCCBB..BA.',  # 10
    '.FEECCBB..BA.',  # 11
    'FEECCCBB..BA.',  # 12
    'FEECCCBBB.BA.',  # 13
    'FEECCCCBB.BA.',  # 14
    'FFEECCCBBBBC.',  # 15
    '.FFEECCCBBCE.',  # the tails below the hips
    '..FFEEECCCE..',  #
    '...FFFEEEF...',  #
] + ['.' * 13] * 5
UC_TAILS_38 = ['.' * 14] * 17 + [
    #0123456789ABCD
    '.FECCB....BBAB',  # torso 9
    '.FECCB....BBAB',  # 10
    '.FECCB....BBAC',  # 11
    'FEECCB....BABC',  # 12
    'FEECCB....BABC',  # 13
    'FEECCB....BBCC',  # 14
    'FEECCB....BBCE',  # 15
    '.FEECB....BCCE',  # the fronts hang open over the thighs
    '.FFEEC....CEEF',  #
    '..FFFE....EFF.',  #
] + ['.' * 14] * 5
# fmt: on


def tails():
    """The undercover cardigan's tails: {key: rows} in CARD's characters."""
    return {'34': UC_TAILS_34, '38': UC_TAILS_38}


LOOKS = {
    'swordsman': (legend(SKIN, NAVY, TRIM, JOG, CORD, KNIT),
                  {'57': SW_CHEST, '61': SW_CHEST_FRONT, '34': SW_TORSO, '38': SW_TORSO_FRONT, '30': SW_SHIN,
                   '39': SW_SHOE, '47': SW_SHOE_SHORT, '48': SW_SHOE_FRONT},
                  [list(JOG.values()), [KNIT['y'], KNIT['Y'], KNIT['u']], [KNIT['z'], KNIT['Z']]]),
    'fencer': (legend(SKIN, MESH, JOG, SNEAK),
               {'57': FE_CHEST, '61': FE_CHEST_FRONT, '34': FE_TORSO, '38': FE_TORSO_FRONT, '30': FE_SHIN,
                '39': FE_SHOE, '47': FE_SHOE_SHORT, '48': FE_SHOE_FRONT},
               [list(JOG.values()), [SNEAK['y'], SNEAK['Z'], SNEAK['z']], [SNEAK['s'], SNEAK['t'], '#7c7c84']]),
    'rebel': (legend(SKIN, MAROON, SPRAY, JOG, CORD, CHECK),
              {'57': RB_CHEST, '61': RB_CHEST_FRONT, '34': RB_TORSO, '38': RB_TORSO_FRONT, '30': RB_SHIN,
               '39': RB_SHOE, '47': RB_SHOE_SHORT, '48': RB_SHOE_FRONT},
              [list(JOG.values()), [CHECK['1'], CHECK['2'], '#8a8882'], [CHECK['4'], CHECK['3']],
               [CHECK['5'], CHECK['6'], '#7c7a74']]),
    'undercover': (legend(SKIN, CARD, SHIRT, PHONES, STRAP, JEANS, CANVAS),
                   {'57': UC_CHEST, '61': UC_CHEST_FRONT, '34': UC_TORSO, '38': UC_TORSO_FRONT, '30': UC_SHIN,
                    '39': UC_SHOE, '47': UC_SHOE_SHORT, '48': UC_SHOE_FRONT},
                   [list(JEANS.values()), [CANVAS['s'], CANVAS['t'], CANVAS['T'], CANVAS['l']]]),
}


def darker(pic, ramps, steps=1):
    """The far side: every colour a step down its own ramp (ramps light to dark)."""
    m = {}
    for ramp in ramps:
        for i, c in enumerate(ramp):
            m.setdefault(c.lower(), ramp[min(len(ramp) - 1, i + steps)])
    return pic.recolor(m)


def parts(look):
    """{key: Pic} of a look's body: the drawn pictures, the far shoe a step darker."""
    leg, rows_by_key, far = LOOKS[look]
    out = {k: Pic.text(rows, leg) for k, rows in rows_by_key.items()}
    out['43'] = darker(Pic.text(rows_by_key['39'], leg), far)
    return out


# Turned by the look tool from these upright pictures.
UPRIGHT = [57, 34, 30, 39, 43]


def check():
    for name, (leg, by_key, _) in LOOKS.items():
        for k, rows in by_key.items():
            for y, r in enumerate(rows):
                assert len(r) == len(rows[0]), f'{name} {k} row {y}: {len(r)} wide, not {len(rows[0])}'
                for ch in r:
                    assert ch == '.' or ch in leg, f'{name} {k} row {y}: {ch!r}'


check()


def weave(look):
    """The fencer's mesh, woven into every picture of the chest and the torso after turning: each
    placeholder pixel a thread or the skin under it, in a fine checker on the picture's own grid."""
    pal = look['palette']
    by_colour = {v.lower(): k for k, v in pal.items()}
    free = (ch for ch in 'abcdeghinpqstuvxyzABCGHILNPRTUVYZ0456789!$%&*=?@^~<>/|;:#(){}[]_-,'
            if ch not in pal)
    chars = {}

    def char(colour):
        if colour not in by_colour:
            ch = next(free)
            pal[ch] = colour
            by_colour[colour] = ch
        return by_colour[colour]

    holders = {by_colour[c]: c for c in WEAVE if c in by_colour}
    for key, rows in look['parts'].items():
        if key.split(':')[0] not in {str(i) for i in range(34, 39)} | {str(i) for i in range(57, 62)}:
            continue
        out = []
        for y, r in enumerate(rows):
            line = ''
            for x, ch in enumerate(r):
                if ch in holders:
                    thread, flesh = WEAVE[holders[ch]]
                    line += char(thread if (x + y) % 2 == 0 else flesh)
                else:
                    line += ch
            out.append(line)
        look['parts'][key] = out
    for ch in list(holders):
        if not any(ch in r for rows in look['parts'].values() for r in rows):
            del pal[ch]
    return look
