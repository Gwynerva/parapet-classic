"""B-2's body pictures, drawn here as text pixel art (upright; the look tool turns them).

2B's gothic doll build on Blaise's body: the high turtleneck of black velvet, puffed shoulders
(the upper arms), a narrow waist, the bell skirt to mid-thigh flaring back with its light grey
lining at the hem and the slit at the front, the arm black (sleeve) - feathers - WHITE (forearm) -
black (glove), the thin legs in black thigh-high stiletto boots under a band of dark stocking.

Each picture's legend: the velvet a..e (sheen → outline), the leather g G j J (gloss → dark, the
outline e), the stocking n N M over skin and its band k, skin S s t T, white w W v, the lining r R,
silver i I. A look gives the colours (`android`, inverted `2p`, ...)."""

# ------------------------------------------------------------------------------- the chest
# Profile (12 x 14, Blaise's 10 x 12 grown by one all round): the turtleneck up under the chin,
# the bust, the straight back, the waist.
CHEST_57 = [
    '............',
    '....eddbe...',
    '....dcbae...',
    '....dccbe...',
    '...edccbbe..',
    '..edcccbbbe.',
    '.Tsdcccbbabe',
    '.tsdcccbaaae',
    '.etdccccbabe',
    '.eddcccdddde',
    '..edcccccbe.',
    '..eddcccbde.',
    '..eddddddde.',
    '...eeeeeee..',
]
# Turned to us (13 x 15): the collar, the lace window under it (the stocking's sheer tones), the
# bust lit from her right.
CHEST_61 = [
    '.............',
    '....eddbe....',
    '....dcbae....',
    '....dccbe....',
    '..eedccbbee..',
    '.edcdMNMcbbe.',
    '.edcbaMcbaae.',
    '.edcbbcdbbae.',
    '.eddccdcccbe.',
    '..eddcccccde.',
    '..eddcccccde.',
    '...edcccbde..',
    '...eddddddd..',
    '....eeeeeee..',
    '.............',
]

# ------------------------------------------------------------------------------- the torso
# Profile (9 x 16): the bodice to a narrow waist, the hips under the skirt.
TORSO_34 = [
    '...cbbb..',
    '..dcbbba.',
    '..dccbba.',
    '..dcccbb.',
    '...dccbe.',
    '...dccbe.',
    '..edccbe.',
    '..edcccbe',
    '.edccccbe',
    '.edcccccb',
    'edcccccbb',
    'edccccccb',
    'eddcccccd',
    'eddddccdd',
    '.eedddde.',
    '...eeee..',
]
TORSO_38 = [
    '...cbbbbb..',
    '..dcccbbba.',
    '..dccccbba.',
    '..ddcccbbb.',
    '...dcccbbe.',
    '...dcccbbe.',
    '..edcccbbe.',
    '..edccccbee',
    '.edcccccbbe',
    '.edccccccbe',
    'edcccccccbe',
    'edcccccccbe',
    'eddccccccde',
    'edddcccddde',
    '.eedddddde.',
    '...eeeeee..',
]

# ---------------------------------------------------------------------------------- arms
# The puffed sleeve: the upper arm (10 x 7, shoulder left), two rows over and under the arm at the
# shoulder, narrowing to the elbow.
UPPER_ARM = [
    '.eeee.....',
    'ebaabe....',
    'ebbbbbeeee',
    'ecbbcbbbbe',
    'edccccccde',
    'eddcddeee.',
    '.eeee.....',
]
# The forearm (8 x 5, elbow left): the gathered sleeve, the feathers of the cuff sticking out
# over and under it, the white forearm to the wrist.
FOREARM = [
    '.e.e....',
    'ebeeoooo',
    'ecdeOOOO',
    'edeeuuuu',
    '..e.e...',
]

# ---------------------------------------------------------------------------------- legs
# The thigh (7 x 14): skin under the skirt, the stocking's band, the sheer stocking, the boot's
# top and the glossy leather down to the knee.
THIGH = [
    '.ssSs..',
    'tssSSs.',
    'tssSSst',
    'tssSSst',
    'kkkkkkk',
    '.MNnnNk',
    '.MNnnN.',
    '.eGgjJe',
    '.eJjGge',
    '..eJGge',
    '..eJGge',
    '..eJGge',
    '..eJjGe',
    '..eJjGe',
]
KNEE = [
    '.eGe.',
    'eJGge',
    'eJGge',
    'eJjGe',
    '.eJe.',
]
SHIN = [
    '.eGe.',
    '.eJGe',
    'eJjGe',
    'eJjGe',
    'eJjGe',
    '.eJGe',
    '.eJGe',
    '.eJGe',
    '.eGe.',
    '.eGe.',
    '.eGe.',
    '.eGe.',
]
# The stiletto boot's foot (13 x 9: two rows of the shaft over the original shoe, two clear rows
# under it so it stands where that stood): the heel's spike, the arch, the almond toe.
BOOT_39 = [
    '.eGe.........',
    '.eGe.........',
    '.eJGe........',
    '.eJjGe.......',
    '.eJjjGge.....',
    '.ee.eJjGgee..',
    '.e...eeeeeee.',
    '.............',
    '.............',
]
BOOT_47 = [
    '.eGe.......',
    '.eGe.......',
    '.eJGe......',
    '.eJjGge....',
    '.ee.eJGgee.',
    '.e..eeeeee.',
    '...........',
]
BOOT_48 = [
    '.eJGe..',
    '.eJGe..',
    '.eJGge.',
    'eJjjGge',
    'eJjjjGe',
    '.eeeee.',
    '.......',
]

# ---------------------------------------------------------------------------------- skirt
# The bell skirt on the hips layer, over the torso's point (17 x 32: torso row r is row r + 8,
# column c is c + 4): from the waist to mid-thigh, flaring back, the embroidery's silver over the
# hem, the light grey lining showing under it, the slit at the front.
SKIRT_34 = ['.' * 17] * 15 + [
    '......eddcbbe....',
    '.....edccccbbe...',
    '.....edcdcccbe...',
    '....edccdcccbae..',
    '....edcdcccdbae..',
    '...edccdcccdcbae.',
    '...edcdccccdcbbe.',
    '..edccdcccdccboe.',
    '..edcidcccicdcse.',
    '.edcccdcccdcceSe.',
    'eRrrrrrrrrrRe.e..',
    '.eeeeeeeeeee.....',
] + ['.' * 17] * 5
SKIRT_38 = ['.' * 17] * 15 + [
    '......eddcbbe....',
    '.....edcccbbbe...',
    '.....edcdccbbe...',
    '....edcdcccdbbe..',
    '....edcdcccdcbe..',
    '...edccdcccdcbae.',
    '...edocdcccdccbe.',
    '..edcosdcccdccbae',
    '..edcesdcicdcicbe',
    '.edcceSdcccdcccbe',
    '.eRrre.eRrrrrrrRe',
    '..eee...eeeeeeee.',
] + ['.' * 17] * 5


# ---------------------------------------------------------------------------------- sword
def sword(view='side'):
    """Virtuous Contract floating behind her back, on the chest (back layer), `+` on the chest's
    point: the white katana's blade down and back past the hips, the round silver guard and the
    black collar behind the nape, the white hilt wrapped with black diamonds, the silver pommel
    and its white tassel. `view` 'side' (57, the profile) or 'front' (61, turned to us)."""
    from lookgen import Canvas
    W, H, ox, oy = 30, 32, 17, 15  # the chest's point at (ox, oy)
    c = Canvas(W, H)
    if view == 'side':
        guard, tip, pommel = (-7, -4), (-17, 10), (-3, -11)
    else:
        guard, tip, pommel = (-5, -6), (-12, 10), (-1, -12)
    gx, gy = ox + guard[0], oy + guard[1]
    tx, ty = ox + tip[0], oy + tip[1]
    px, py = ox + pommel[0], oy + pommel[1]
    # The blade: two pixels thick, its upper edge lit, a slight curve (the edge bowed down).
    n = max(abs(tx - gx), abs(ty - gy))
    pts = []
    for i in range(1, n + 1):
        t = i / n
        x = gx + (tx - gx) * t
        y = gy + (ty - gy) * t + 0.9 * (4 * t * (1 - t))
        pts.append((round(x), round(y)))
    for k, (x, y) in enumerate(pts):
        last = k == len(pts) - 1
        c.set(x, y, 'W' if not last else 'w')
        if not last:
            c.set(x + 1, y, 'w')
    # The black collar by the guard, the guard.
    c.set(gx - 1, gy + 1, 'z').set(gx, gy + 1, 'z')
    c.set(gx, gy, 'i').set(gx - 1, gy, 'I').set(gx + 1, gy, 'i').set(gx, gy - 1, 'i').set(gx, gy + 2, 'I')
    c.set(gx + 1, gy - 1, 'I').set(gx - 1, gy + 1, 'I')
    # The hilt: white with black diamonds, up to the pommel.
    m = max(abs(px - gx), abs(py - gy))
    for i in range(2, m):
        t = i / m
        x, y = round(gx + (px - gx) * t), round(gy + (py - gy) * t)
        c.set(x, y, 'w' if i % 2 else 'z')
    c.set(px, py, 'i')
    # The tassel hanging from the pommel.
    c.set(px - 1, py + 1, 'w').set(px - 1, py + 2, 'W').set(px - 2, py + 3, 'w')
    c.set(ox, oy, '+')
    return c.rows()


# ================================================================== YoRHa Uniform 1 (kimono)
# The legend adds the obi p P q (light grey, light → shade); o O are the white trim and cords.
# Profile chest: the wrap collar round the neck, its white piping running down to the bust, the
# black top, the obi's upper edge under the bust.
K_CHEST_57 = [
    '............',
    '....edoe....',
    '....dcoe....',
    '...edcboe...',
    '..edccbboe..',
    '.eddcccbboe.',
    '.edccccbbboe',
    '.edcccccbbae',
    '.edcccccbbae',
    '.eddcccccbbe',
    '..edccccccde',
    '..qPPPPPppe.',
    '..qPPPPPPpe.',
    '...eeeeeee..',
]
K_CHEST_61 = [
    '.............',
    '....edoode...',
    '....dcooce...',
    '..eedcoobbee.',
    '.edcccobobbe.',
    '.edcccbobbbae',
    '.edccccbobbae',
    '.edccccbobbae',
    '.eddccccbobbe',
    '..eddcccbobe.',
    '..edcccccobe.',
    '..qPPPPPPpppe',
    '..qPPPPPPPppe',
    '...eeeeeeeee.',
    '.............',
]
# The torso: the wide obi, its black cord, the big black bow at the front with the white knot and
# its tassel; the short skirt below.
K_TORSO_34 = [
    '..qPPPpp.',
    '..qPPPppe',
    '..ezzzzez',
    '..qPPPpzo',
    '..qPPPpez',
    '..qPPPpoe',
    '..qqPPPoe',
    '..edccbbe',
    '.edccccbe',
    '.edcccccb',
    'edcccccbb',
    'edccccccb',
    'eddcccccd',
    'eddddccdd',
    '.eedddde.',
    '...eeee..',
]
K_TORSO_38 = [
    '..qPPPPPpp.',
    '..qPPPPPppe',
    '..ezzzzzzze',
    '..qPzzozzpe',
    '..qPPzozPpe',
    '..qPPPoPPpe',
    '..qqPPoPPpe',
    '..edccocbbe',
    '.edcccccbbe',
    '.edccccccbe',
    'edcccccccbe',
    'edcccccccbe',
    'eddccccccde',
    'edddcccddde',
    '.eedddddde.',
    '...eeeeee..',
]
# Bare shoulders: the upper arm's skin to the detached sleeve's white-striped top.
K_UPPER_ARM = [
    '..........',
    '.tssse....',
    'tsSSSoeeee',
    'tsSSSobbbe',
    'TtssSocccd',
    '.TttToeeee',
    '..........',
]
# The detached sleeve to the wrist, its white stripes at the flared cuff.
K_FOREARM = [
    '........',
    'ebbbbobe',
    'ecccbobe',
    'edddeoee',
    '.....e..',
]
# The sheer black stockings to the thigh, the white cord bow and its tassel on top of each.
K_THIGH = [
    '.sSSs..',
    'tssSSs.',
    'tssSSst',
    'kkoOokk',
    '.MNoNnk',
    '.MNnoN.',
    '.MNnnN.',
    '.MNnnN.',
    '..MNnN.',
    '..MNnN.',
    '..MNnN.',
    '..MNnN.',
    '..MNnN.',
    '..MNnN.',
]
K_KNEE = [
    '.MNn.',
    'MNnnN',
    'MNnnN',
    'MNnNM',
    '.MNM.',
]
K_SHIN = [
    '.MNn.',
    '.MNnN',
    'MNnnN',
    'MNnnN',
    'MNnnN',
    '.MNnN',
    '.MNnN',
    '.MNnN',
    '.MNn.',
    '.MNn.',
    '.MNn.',
    '.MNn.',
]
# Black stiletto pumps with the strap round the ankle: the sheer stocking over the instep.
PUMP_39 = [
    '.MNn.........',
    '.eGge........',
    '.MNnN........',
    '.eNnnN.......',
    '.eeNnnJGe....',
    '.e.eeJjGgge..',
    '.e...eeeeeee.',
    '.............',
    '.............',
]
PUMP_47 = [
    '.MNn.......',
    '.eGge......',
    '.eNnNe.....',
    '.eNnJGge...',
    '.ee.eJGgge.',
    '.e..eeeeee.',
    '...........',
]
PUMP_48 = [
    '.MNn...',
    '.eGge..',
    '.MNnN..',
    'eMNnNe.',
    'eJjGge.',
    '.eeeee.',
    '.......',
]
# The short skirt (hips layer, like the android's): straight, its white trim at the hem, the slit
# at the front.
K_SKIRT_34 = ['.' * 17] * 15 + [
    '......edccbbe....',
    '.....edcccbbe....',
    '.....edccccbbe...',
    '....edccccdcbe...',
    '....edcccdccbbe..',
    '....edcccdcccbe..',
    '...edccccdccSbe..',
    '...eoooooooeSe...',
    '....eeeeeeee.....',
] + ['.' * 17] * 8
K_SKIRT_38 = ['.' * 17] * 15 + [
    '......edcbbe.....',
    '.....edcccbbe....',
    '.....edccccbe....',
    '....edcdcccbbe...',
    '....edcdcccdbe...',
    '....edcdcccdbbe..',
    '...edcSdcccdcbe..',
    '...eoeSeooooooe..',
    '....e.eeeeeeee...',
] + ['.' * 17] * 8
# The long black tail panel down the back to the ankles, a silver embroidery on it (a ribbon from
# the hips, its first row at the anchor).
TAIL = [
    '.+..',
    'ecbe',
    'edbe',
    'edbe',
    'edce',
    'edce',
    'edce',
    'edce',
    'edce',
    'edce',
    'eice',
    'iiie',
    'eice',
    'edce',
    'edie',
    'eiie',
    'edce',
    'edce',
    'edce',
    'edce',
    'eddc',
    '.ee.',
]
