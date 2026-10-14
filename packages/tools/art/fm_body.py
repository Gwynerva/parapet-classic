"""Flittermouse's body: the heaviest build of the cast (huge shoulders and forearms, a barrel
chest, thick legs) as pictures lit from the upper front: the suit, the bat across the chest,
the belt, the gauntlets with their three fins, the boots and the cape."""
import math

from body import part, inflate
from heads import Pic

LIGHT = (0.45, -0.6, 0.65)


def mask(rows):
    """A silhouette from text rows ('#' or any letter filled, '.' empty)."""
    return Pic([[('#' if ch != '.' else None) for ch in r] for r in rows])


def lit(pic, ramp, outline, sel=None, light=LIGHT, centre=None, radii=None, along=None, gloss=0.0,
        spec=None):
    """Re-lights a silhouette as a rounded volume: an ellipsoid at `centre` with `radii` (or a
    cylinder `along` 'x' / 'y': round across, straight along), tones of `ramp` (light → dark)
    by how it faces `light`; the edge in `outline`, or in `sel` where it faces the light (a lit
    edge drawn lighter). `spec` (colour) puts a sharp highlight where the surface mirrors the
    light to the eye (above `gloss`)."""
    pts = [(x, y) for y, row in enumerate(pic.g) for x, c in enumerate(row) if c]
    if not pts:
        return pic
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx, cy = centre or ((min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2)
    rx, ry = radii or ((max(xs) - min(xs) + 1) / 2, (max(ys) - min(ys) + 1) / 2)
    lx, ly, lz = light
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    h, w = pic.h, pic.w
    filled = [[pic.get(x, y) is not None for x in range(w)] for y in range(h)]
    # Across a cylinder: the span at each row (along y) or column (along x).
    spans = {}
    if along:
        for x, y in pts:
            k, t = (y, x) if along == 'y' else (x, y)
            lo, hi = spans.get(k, (t, t))
            spans[k] = (min(lo, t), max(hi, t))
    out = Pic([[None] * w for _ in range(h)])
    for y in range(h):
        for x in range(w):
            if not filled[y][x]:
                continue
            if along:
                k, t = (y, x) if along == 'y' else (x, y)
                lo, hi = spans[k]
                half = max(0.5, (hi - lo + 1) / 2)
                u = (t + 0.5 - (lo + hi + 1) / 2) / half
                nx, ny = (u, 0.0) if along == 'y' else (0.0, u)
            else:
                nx = (x + 0.5 - cx) / rx
                ny = (y + 0.5 - cy) / ry
            d = nx * nx + ny * ny
            if d > 1:
                nx, ny, d = nx / math.sqrt(d), ny / math.sqrt(d), 1.0
            nz = math.sqrt(max(0.0, 1 - d))
            nd = nx * lx + ny * ly + nz * lz
            edge = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if not (0 <= x + dx < w and 0 <= y + dy < h and filled[y + dy][x + dx])]
            if edge:
                facing = sum(dx * lx + dy * ly for dx, dy in edge)
                out.set(x, y, sel if sel and facing > 0.3 else outline)
                continue
            b = max(0.0, min(1.0, (nd + 0.2) / 1.2))
            c = ramp[min(len(ramp) - 1, round((1 - b) * (len(ramp) - 1)))]
            if spec:
                rz = 2 * nd * nz - lz
                if rz > 0 and rz ** 8 > gloss:
                    c = spec
            out.set(x, y, c)
    return out


def grown(id_, n, base=1, axis=None):
    """A base part's silhouette grown by `n` (shrunk if negative)."""
    from body import shrink
    p = part(base, id_)
    if n > 0:
        inflate(p, n, axis)
    elif n < 0:
        shrink(p, -n, axis)
    return p


def paint(pic, rows, legend, x0=0, y0=0, only_on=True):
    """Text rows over a picture: '.' keeps, ' ' erases, a legend character paints (only over
    pixels already there unless `only_on` is False)."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + dx, y0 + dy
            if only_on and pic.get(x, y) is None and ch != ' ':
                continue
            pic.set(x, y, None if ch == ' ' else legend[ch])
    return pic


def materials(rows, mats, centre=None, radii=None, along=None, light=LIGHT):
    """A part drawn as regions of materials: `rows` of characters ('.' empty), `mats` maps a
    character to (ramp, outline, sel, spec, gloss); every region is lit with the same volume
    (the whole silhouette's), the silhouette's edge in its material's outline."""
    sil = mask(rows)
    out = Pic([[None] * sil.w for _ in range(sil.h)])
    cache = {}
    for ch, m in mats.items():
        ramp, outline, sel = m[0], m[1], m[2]
        spec = m[3] if len(m) > 3 else None
        gloss = m[4] if len(m) > 4 else 0.5
        cache[ch] = lit(sil, ramp, outline, sel, light=light, centre=centre, radii=radii, along=along,
                        spec=spec, gloss=gloss)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in cache:
                out.set(x, y, cache[ch].get(x, y))
    return out


def text_rows(pic):
    """A picture's silhouette as rows of one character (to start a hand-drawn mask from)."""
    return [''.join('#' if c else '.' for c in row) for row in pic.g]


# ---------------------------------------------------------------------------------------------
# The parts as regions: g suit, k black (cowl, gloves, boots), b the bat, y the belt, Y its
# buckle, p a pouch, t the trunks. Upright pictures (the game turns them).
# ---------------------------------------------------------------------------------------------

# The chest in profile, facing right: the cowl flowing into the shoulders (no neck), the broad
# shoulders, a barrel chest, the near wing of the bat across it.
CHEST = [
    '.....kkkkkk......',
    '...kkkkkkkkkk....',
    '.kkkkkkkkkkkkkk..',
    'kkkkkkkkkkkkkkkg.',
    'kkkkkggkkkkkkgggg',
    'kkgggggggggbbbbbg',
    'kkggggggggbbbbbbb',
    'kggggggggggbbgbbb',
    'kgggggggggggggbgg',
    'kggggggggnnnnnggg',
    'kggggggggggggggg.',
    '.gggggggggggnggg.',
    '.gggggggggggggg..',
    '..ggggggggnnnng..',
    '..gggggggggggg...',
    '...gggggggggg....',
    '....gggggggg.....',
    '.....gggggg......',
]

# The chest turned to us: the cowl's collar on the shoulders, the bat from shoulder to shoulder.
CHEST_FRONT = [
    '...kkkk.......kkkk...',
    '.kkkkkk.......kkkkkk.',
    'kkkkkkk.......kkkkkkk',
    'kkkkkkkk.....kkkkkkkk',
    'kggkkkkkk...kkkkkkggk',
    'kbgggggggbgbgggggggbk',
    'gbbbggggbbbbbggggbbbg',
    'gbbbbbbbbbbbbbbbbbbbg',
    'ggbbbbbbbbbbbbbbbbbgg',
    'gggbbgbbbbbbbbbgbbggg',
    'ggggggggbbbbbgggggggg',
    'ggggggggggngggggggggg',
    '.gggggnnnnnnnnngggggg',
    '.gggggggggngggggggg..',
    '..ggggggnnnnnggggggg.',
    '..ggggggggnggggggg...',
    '...ggggggggggggggg...',
    '....ggggggggggggg....',
]

# The belly, the belt (a pouch at the front) and the trunks in profile.
TORSO = [
    '....gggggg...',
    '...gggggggg..',
    '..gggggggggg.',
    '..gggggggggg.',
    '..gggggggggg.',
    '..gggggggggg.',
    '..gggggggggg.',
    '..yyyyyyyyyy.',
    '.ppqppqyyYYy.',
    '.ppqppqtttttt',
    '.tttttttttttt',
    '.tttttttttttt',
    '.tttttttttttt',
    '..tttttttttt.',
    '..ttttttttt..',
    '...tttttttt..',
    '....tttttt...',
    '.....ttt.....',
]

# Turned to us: the buckle in the middle, a pouch each side.
TORSO_FRONT = [
    '.....ggggg.....',
    '...ggggggggg...',
    '..ggggggggggg..',
    '..ggggggggggg..',
    '..ggggggggggg..',
    '..ggggggggggg..',
    '..ggggggggggg..',
    '.yyyyyYYYyyyyy.',
    '.ppqppYqYppqpp.',
    '.ppqpptttppqpp.',
    '.ttttttttttttt.',
    '.ttttttttttttt.',
    '.ttttttttttttt.',
    '.ttttttttttttt.',
    '..ttttttttttt..',
    '..ttttttttttt..',
    '...ttttttttt...',
    '.....ttttt.....',
]

# The knee: a round cap.
KNEE = [
    '...####...',
    '.########.',
    '##########',
    '##########',
    '##########',
    '.########.',
    '...####...',
]

# The shin: the suit at the knee, then the boot's shaft up to mid-calf with its cuff (c).
SHIN = [
    '....gg...',
    '...gggg..',
    '..gggggg.',
    '.gggggggg',
    '.gggggggg',
    '.cccccccc',
    '.kkkkkkkk',
    '.kkkkkkk.',
    '.kkkkkkk.',
    '.kkkkkkk.',
    '.kkkkkk..',
    'kkkkkkk..',
    'kkkkkkk..',
    'kkkkkkk..',
    '.kkkkk...',
    '..kkk....',
]

# The boots, heavy and tactical, drawn in tones (o outline, D A M L H the leather dark to lit,
# s the ridged rubber of the sole, S its black tread a pixel longer than the toe). Profile, toe
# to the right: a high ankle, the instep rising, a blunt toe cap.
BOOT = [
    '.oAMMo.......',
    '.oAMLLo......',
    '.oAMLLHooo...',
    'oDAAMLLLHHHo.',
    'oDAAAMMMLLHLo',
    'osssssssssssS',
    '.SSoSSSoSSSS.',
]

# Seen a little turned (the original's shorter shoe).
BOOT_SHORT = [
    '.oAMMo.....',
    '.oAMLLo....',
    '.oAMLLHoo..',
    'oDAAMLLHHo.',
    'oDAAAMMLHLo',
    'osssssssssS',
    '.SSoSSSoSS.',
]

# Seen from the front: the round toe cap over the sole.
BOOT_FRONT = [
    '.oMMLo.',
    'oAMLHLo',
    'oAMLHLo',
    'oAMMLLo',
    'oDAMMLo',
    'osssssS',
    'SSSSSSS',
]

# The gauntlet, drawn whole: elbow left, wrist right, a flared cuff at the elbow and three fins
# along the outer edge raked back to the elbow (f their lit edge, F the blade).
GAUNTLET = [
    '..ooooooooo...',
    '.oLHHHHHLLLo..',
    'oLLLLLLLLMMAo.',
    'oMMMMMMMMMAAo.',
    'oAAAAAAAAAADo.',
    '.oDDDDDDDDDo..',
    '..oFFoFFoFFo..',
    '.oFFoFFoFFo...',
    '.fo.fo.fo.....',
]

# The cape, a ribbon hanging from the upper back: rows run down its length from the shoulders,
# columns across it from its outer edge (lit, the top when it streams back) in towards the body
# (+ the column the chain runs through). Drawn by `cape_rows`: narrow at the shoulders and
# widening fast, a lit outer edge, one long fold, a dark inner edge; the hem cut into big sharp
# scallops, the outer point the longest (the bat-wing hem of the Arkham cape).


def cape_rows(width=15, length=31, chain=3, points=(0, 5, 10, 14), depth=3.4, fold=6, shoulder=6):
    import math
    # The hem: how far down each column reaches (points longest, round arcs between them).
    hem = []
    for x in range(width):
        left = max(p for p in points if p <= x)
        right = min((p for p in points if p >= x), default=left)
        if right == left:
            d = 0.0
        else:
            t = (x - left) / (right - left)
            d = math.sin(t * math.pi) * depth
        extra = 2 if x == points[0] else (1 if x == points[-1] else 0)
        hem.append(length - 1 - round(d) + extra)
    rows = []
    for y in range(max(hem) + 1):
        # At the shoulders the cape is narrower: it widens over the first rows.
        reach = width if y >= shoulder else max(chain + 3, round(width * (0.45 + 0.55 * y / shoulder)))
        row = ''
        for x in range(width):
            if x >= reach or y > hem[x]:
                row += '.'
                continue
            last = y == hem[x]
            if x == reach - 1 or x == width - 1:
                ch = 'o'
            elif x == 0:
                ch = 'H'
            elif x == 1:
                ch = 'L'
            elif x == 2:
                ch = 'M'
            elif x == fold and 4 < y < hem[x] - 2:
                ch = 'D'
            elif x == fold + 1 and 4 < y < hem[x] - 2:
                ch = 'M'
            else:
                ch = 'A'
            if last and x > 0:
                ch = 'o' if x > 2 else 'D'
            row += ch
        rows.append(row)
    rows[0] = rows[0][:chain] + '+' + rows[0][chain + 1:]
    return rows


CAPE = cape_rows()

# The cape over the shoulders, behind the back, on the chest in profile (an attachment behind
# everything, turned with the chest): what the body shows of the cape when the ribbon hangs
# behind it.
MANTLE = [
    '....................',
    '....................',
    '........oo..........',
    '......ooLMo.........',
    '....ooLMMAo.........',
    '...oLLMAAAo.........',
    '..oLMMAAAAo.........',
    '..oLMAAAADo.........',
    '.oLMMAAADDo.........',
    '.oLMAAAADDo.........',
    '.oLMAAAADDo.........',
    '.oLMAAAADDo.........',
    'oLMMAAAADDo.........',
    'oLMAAAAADDo.........',
    'oLMAAAAADDo.........',
    'oLMAAAADDDo.........',
    'oLMAAAADDDo.........',
    'oLMAAAADDo..........',
    'oLMAAADDDo..........',
    'oLMAAADDo...........',
    '.ooAADDo............',
    '...ooo..............',
]

# Turned to us: the cape behind the shoulders, wider than them.
MANTLE_FRONT = [
    '.....................',
    '.....................',
    '....ooooooooooooo....',
    '..ooLLMMMMMMMMMAAoo..',
    '.oLLMMAAAAAAAAAADDDo.',
    'oLMMAAAAAAAAAAAAADDDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    'oLMAAAAAAAAAAAAAAADDo',
    '.oMAAAAAAAAAAAAAAADo.',
    '.oMAAAAAAAAAAAAAAADo.',
    '..oo.............oo..',
]


# ---------------------------------------------------------------------------------------------
# The armoured suit (Knight): graphite plates (g) with the bat sculpted into the chest plate (b,
# its lit rim r found by `rim`), a gorget (k), one seam under the pectoral plate (n), the olive
# belt (y, pouches p), the dark suit under the belt (d).
# ---------------------------------------------------------------------------------------------
KNIGHT_CHEST = [
    '.....kkkkkk......',
    '...kkkkkkkkkk....',
    '.kkkkkkkkkkkkkk..',
    'kkkkkkkkkkkkkkkg.',
    'kkkkkggkkkkkkgggg',
    'kkggggggggggggggg',
    'kkggggggggbbbbbbg',
    'kggggggggggbbgbbg',
    'kgggggggggggggbgg',
    'knnnnnnnnnnnnnngg',
    'kggggggggggggggg.',
    '.gggggggggggnggg.',
    '.ggggggggggngggg.',
    '..nnnnnnnnnnnng..',
    '..gggggggggggg...',
    '...ggggggggggg...',
    '....gggggggg.....',
    '.....gggggg......',
]

KNIGHT_CHEST_FRONT = [
    '...kkkk.......kkkk...',
    '.kkkkkk.......kkkkkk.',
    'kkkkkkk.......kkkkkkk',
    'kkkkkkkk.....kkkkkkkk',
    'kggkkkkkk...kkkkkkggk',
    'gggggggggggggggggggg.',
    'gbggggggbgggbggggggbg',
    'gbbgggggbbbbbgggggbbg',
    'gbbbbbbbbbbbbbbbbbbbg',
    'ggbbbbbbbbbbbbbbbbbgg',
    'gggbgbbbbbbbbbbbgbggg',
    'gggggggggbbbggggggggg',
    'gnnnnnnnnnbnnnnnnnnng',
    '.ggggggggngnggggggggg',
    '.gggggggggngggggggg..',
    '..gnnnnnnnnnnnnnnng..',
    '...ggggggggggggggg...',
    '....ggggggggggggg....',
]

KNIGHT_TORSO = [
    '....gggggg...',
    '...gggggggg..',
    '..gggggggggg.',
    '..gnnnnnnnng.',
    '..gggggggggg.',
    '..gggggggggg.',
    '..gggggggggg.',
    '..yyyyyyyyyy.',
    '.ppqppqyyYYy.',
    '.ppqppqdddddd',
    '.pppppqdddddd',
    '.dddddddddddd',
    '.dddddddddddd',
    '..dddddddddd.',
    '..ddddddddd..',
    '...dddddddd..',
    '....dddddd...',
    '.....ddd.....',
]

KNIGHT_TORSO_FRONT = [
    '.....ggggg.....',
    '...ggggggggg...',
    '..ggggggggggg..',
    '..gnnnngnnnng..',
    '..ggggggggggg..',
    '..gggggnggggg..',
    '..ggggggggggg..',
    'yyyyyyYYYyyyyyy',
    'ppqppyYqYyppqpp',
    'ppqppdddddppqpp',
    'pppppdddddppppp',
    '.ddddddddddddd.',
    '.ddddddddddddd.',
    '.ddddddddddddd.',
    '..ddddddddddd..',
    '..ddddddddddd..',
    '...ddddddddd...',
    '.....ddddd.....',
]

# The knee pad: a big rounded plate.
KNIGHT_KNEE = [
    '..rrrrrr..',
    '.rgggggggr',
    'rggggggggg',
    'gggggggggg',
    'gggggggggg',
    '.gggggggg.',
    '..gggggg..',
]

# The armoured boot up to the knee: a plate down the shin (g), the shaft (k).
KNIGHT_SHIN = [
    '....kk...',
    '...kkkk..',
    '..kkkkkk.',
    '.kkkkgggk',
    '.kkkkgggk',
    '.kkkkgggk',
    '.kkkkgggk',
    '.kkkkggk.',
    '.kkkkggk.',
    '.kkkkggk.',
    '.kkkkkk..',
    'kkkkkkk..',
    'kkkkkkk..',
    'kkkkkkk..',
    '.kkkkk...',
    '..kkk....',
]

# The armoured boot's foot: long and wide, a plate on the instep, a massive sole.
KNIGHT_BOOT = [
    '.oAMMo.......',
    '.oAMLLoo.....',
    '.oAMLHLLoo...',
    'oDAAMLHHHLo..',
    'oDAAAMMLLHHLo',
    'ossssssssssss',
    'oSSSoSSSoSSSS',
]

KNIGHT_BOOT_SHORT = [
    '.oAMMo.....',
    '.oAMLooo...',
    '.oAMLHLLo..',
    'oDAAMLHHLo.',
    'oDAAAMLLHLo',
    'ossssssssss',
    'oSSSoSSoSSS',
]

KNIGHT_BOOT_FRONT = [
    '.oMMLo.',
    'oAMLHLo',
    'oAMLHLo',
    'oAMMLLo',
    'oDAMLLo',
    'ossssso',
    'SSSSSSS',
]

# Its gauntlet: bigger plates, the fins small and sharp.
KNIGHT_GAUNTLET = [
    '..ooooooooo...',
    '.oLHHHoHHLLo..',
    'oLLLLLoLLLMAo.',
    'oMMMMMoMMMAAo.',
    'oAAAAAoAAAADo.',
    '.oDDDDoDDDDo..',
    '..oFfooFfoFfo.',
    '..oFo.oFo.oFo.',
    '...o...o...o..',
]

# The pauldron over the shoulder end of the upper arm (an attachment over it).
KNIGHT_PAULDRON = [
    '..oooooo..........',
    '.oLHHHLMo.........',
    'oLHHLLMMAo........',
    'oMLLMMMAAo........',
    'oAMMAAAADo........',
    'oAAAADDDDo........',
    '.oDDDDDDo.........',
    '..oooooo..........',
    '..................',
]

# ---------------------------------------------------------------------------------------------
# The suit of the future (Beyond): black all over (k), the red bat a wide V from shoulder to
# shoulder (R), the white belt (w) with its red round buckle (Y), no cape.
# ---------------------------------------------------------------------------------------------
BEYOND_CHEST = [
    '.....kkkkkk......',
    '...kkkkkkkkkk....',
    '.kkkkkkkkkkkkkk..',
    'kkkkkkkkkkkkkkkk.',
    'kkkRRRkkkkkkkkkkk',
    'kkkkRRRRkkkkkkkkk',
    'kkkkkkRRRRkkkkkkk',
    'kkkkkkkkRRRRkkkkk',
    'kkkkkkkkkkRRRRRkk',
    'kkkkkkkkkkkkRRRRk',
    'kkkkkkkkkkkkkkRRk',
    '.kkkkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkkk..',
    '..kkkkkkkkkkkkk..',
    '..kkkkkkkkkkkk...',
    '...kkkkkkkkkk....',
    '....kkkkkkkk.....',
    '.....kkkkkk......',
]

BEYOND_CHEST_FRONT = [
    '...kkkk.......kkkk...',
    '.kkkkkk.......kkkkkk.',
    'kkkkkkk.......kkkkkkk',
    'kkkkkkkk.....kkkkkkkk',
    'RRkkkkkkk...kkkkkkkRR',
    'kRRRkkkkkRkRkkkkkRRRk',
    'kkRRRRkkRRRRRkkRRRRkk',
    'kkkRRRRRRRRRRRRRRRkkk',
    'kkkkRRRRRRRRRRRRRkkkk',
    'kkkkkkRRRRRRRRRkkkkkk',
    'kkkkkkkkRRRRRkkkkkkkk',
    'kkkkkkkkkkRkkkkkkkkkk',
    '.kkkkkkkkkkkkkkkkkkkk',
    '.kkkkkkkkkkkkkkkkkkk.',
    '..kkkkkkkkkkkkkkkkk..',
    '..kkkkkkkkkkkkkkkk...',
    '...kkkkkkkkkkkkkkk...',
    '....kkkkkkkkkkkkk....',
]

BEYOND_TORSO = [
    '....kkkkkk...',
    '...kkkkkkkk..',
    '..kkkkkkkkkk.',
    '..kkkkkkkkkk.',
    '..kkkkkkkkkk.',
    '..kkkkkkkkkk.',
    '..kkkkkkkkkk.',
    '..wwwwwwwwYw.',
    '..wwwwwwwYYY.',
    '.kkkkkkkkkYkk',
    '.kkkkkkkkkkkk',
    '.kkkkkkkkkkkk',
    '.kkkkkkkkkkkk',
    '..kkkkkkkkkk.',
    '..kkkkkkkkk..',
    '...kkkkkkkk..',
    '....kkkkkk...',
    '.....kkk.....',
]

BEYOND_TORSO_FRONT = [
    '.....kkkkk.....',
    '...kkkkkkkkk...',
    '..kkkkkkkkkkk..',
    '..kkkkkkkkkkk..',
    '..kkkkkkkkkkk..',
    '..kkkkkkkkkkk..',
    '..kkkkkkkkkkk..',
    '.wwwwwYYYwwwww.',
    '.wkwwYYYYYwwkw.',
    '.kkkkkYYYkkkkk.',
    '.kkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkk.',
    '..kkkkkkkkkkk..',
    '..kkkkkkkkkkk..',
    '...kkkkkkkkk...',
    '.....kkkkk.....',
]

# Its boots are the suit itself: smooth, a thin sole, a sheen down the shin.
BEYOND_SHIN = [
    '....kk...',
    '...kkkk..',
    '..kkkkkk.',
    '.kkkkkkkk',
    '.kkkkkkkk',
    '.kkkkkkkk',
    '.kkkkkkkk',
    '.kkkkkkk.',
    '.kkkkkkk.',
    '.kkkkkkk.',
    '.kkkkkk..',
    'kkkkkkk..',
    'kkkkkkk..',
    'kkkkkkk..',
    '.kkkkk...',
    '..kkk....',
]

BEYOND_BOOT = [
    '.oAMMo.......',
    '.oAMLLo......',
    '.oAMLLHo.....',
    'oDAAMLLHHoo..',
    'oDAAAMMLLHHo.',
    'oDDDAAAMMMLLo',
    '.oooooooooooo',
]

BEYOND_BOOT_SHORT = [
    '.oAMMo.....',
    '.oAMLLo....',
    '.oAMLLHo...',
    'oDAAMLHHo..',
    'oDAAAMLLHo.',
    'oDDDAAMMLLo',
    '.oooooooooo',
]

BEYOND_BOOT_FRONT = [
    '.oMMLo.',
    'oAMLHLo',
    'oAMLHLo',
    'oAMMLLo',
    'oDAMMLo',
    'oDAAMLo',
    '.ooooo.',
]


def rim(rows, under='b', on='g', mark='r'):
    """A lit rim: every `on` pixel just above an `under` one becomes `mark` (a sculpted edge)."""
    out = [list(r) for r in rows]
    for y in range(1, len(rows)):
        for x, ch in enumerate(rows[y]):
            if ch == under and rows[y - 1][x] == on:
                out[y - 1][x] = mark
    return [''.join(r) for r in out]
