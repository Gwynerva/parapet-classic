"""Grove's body, drawn anew: the upright pictures of the chest (57, front 61), the torso (34,
front 38), the legs (thighs 53 near / 49 far, knee 62, shin 30) and the shoes (39, 43, 47,
48). The look tool turns the upright ones into their tilted pictures (58-60, 35-37, 50-52,
54-56, 63-65, 31-33, 40-42, 44-46).

His build: lean and wiry on top (the original man's arms, a loose white tank top with deep
armholes over a narrow chest), a long neck, and a heavy bottom: wide baggy jeans, low on the
hips under the boxers' waistband and a brown belt, straight down and bunching in folds over the
shoes. The shoes carry the hem of the jeans on their heel (the game draws a foot over its
shin), so the jeans sit over them.

Lit like the heads, from the upper front: in profile the front edge and the side facing us are
lit, the back in shade; turned to us, the middle is lit and the sides roll into shade."""
from heads import Pic

# Skin (as the head's).
SKIN = {'X': '#dba377', 'W': '#bb7d58', 'L': '#9f6549', 'M': '#84513a', 'S': '#683627', 'D': '#4a1f18'}
# The white tank top, its shadows cool.
TANK = {'A': '#f7f5f0', 'B': '#dddbd8', 'C': '#b5b3be', 'E': '#83819a'}
# The boxers' waistband, the belt and its silver buckle.
BELT = {'w': '#e2ddd6', 'v': '#a9a19f', 'n': '#74482f', 'N': '#46291a', 'q': '#eef1f4', 'Q': '#8d95a1'}
# Mid-blue denim (#496393), light to deep.
DENIM = {'j': '#93a8cd', 'J': '#6c84b3', 'g': '#4b6496', 'G': '#384b7a', 'K': '#243154'}
# Black low-tops: a lit top, a shine on the toe, light diagonal stripes, a thin light sole.
SHOE = {'z': '#0c0b0e', 'Z': '#1e1c22', 'y': '#3a3640', 'Y': '#6c6672', 's': '#a8a2a6', 't': '#6e6870',
        'f': '#d8d2c4', 'F': '#9e9688'}


def legend(*parts):
    out = {}
    for p in parts:
        out.update(p)
    return out


# fmt: off
CHEST_TANK = [          # 57: profile, the front to the right
    #0123456789
    '...SMLL...',  # 0  the neck
    '...SMLL...',  # 1
    '...SMLW...',  # 2
    '..BDMLWA..',  # 3  the back strap, the low neckline
    '.CBDSLWAB.',  # 4  the bare side in the deep armhole
    'ECBDSLAAB.',  # 5
    'ECBBDAAAB.',  # 6
    'ECBBAAAAB.',  # 7
    'ECBBAAAAB.',  # 8
    'ECCBAAABB.',  # 9
    '.ECBBBBBC.',  # 10
    '.ECCBBBCE.',  # 11
]
CHEST_TANK_FRONT = [    # 61: turned to us
    #0123456789A
    '...SMLL....',  # 0
    '...SMLL....',  # 1
    '...SMLW....',  # 2
    '.SMBLWWBL..',  # 3  thin straps over bare shoulders
    'DSMBAWXABL.',  # 4  the scooped neckline
    'DSCBAAAABM.',  # 5  deep armholes
    'DSCBAAAABS.',  # 6
    'ECBBAAAABC.',  # 7
    'ECBBAAAABC.',  # 8
    'ECBBAAAABC.',  # 9
    '.ECBBAAABC.',  # 10
    '.ECBBBBBCE.',  # 11
    '.EECCCCCCE.',  # 12
]
TORSO_TANK = [          # 34: profile
    #0123456789A
    '...BAAAB...',  # 0  the tank top, loose
    '..CBAAAAB..',  # 1
    '..CBAAAAB..',  # 2
    '..CBBAAAB..',  # 3
    '..ECBAAAB..',  # 4
    '..ECBBAAB..',  # 5
    '..ECCBBBC..',  # 6  its hem
    '..vwwvwwwv.',  # 7  the boxers' waistband
    '..NnnNnnnqQ',  # 8  the belt, the buckle in front
    '.KGgJJJjjJg',  # 9  the jeans, low and wide
    'KGgJJJjjJJg',  # 10
    'KGgJJJJJJJg',  # 11
    'KGggJJJJJgG',  # 12
    '.KGggJJJgGK',  # 13
    '..KGGgggGK.',  # 14
    '...KKKKKK..',  # 15
]
TORSO_TANK_FRONT = [    # 38: turned to us
    #0123456789AB
    '...CBAAAAB..',  # 0
    '..CBAAAAAAB.',  # 1
    '..CBAAAAAAB.',  # 2
    '..CBBAAAAAB.',  # 3
    '..ECBAAAABC.',  # 4
    '..ECBBAAABC.',  # 5
    '..ECCBBBBCE.',  # 6
    '..vwwvwwvwv.',  # 7
    '..NnnnqQnnN.',  # 8
    '.KGgJJjjJgGK',  # 9
    'KGgJJJjJJJgK',  # 10
    'KGgJJJGJJJgK',  # 11
    'KGgJJJGJJggK',  # 12
    'KGggJGKGJgGK',  # 13
    '.KGGgK.KgGK.',  # 14
    '..KKK...KK..',  # 15
]
THIGH = [               # 53: the near thigh, the hip at the top, the front to the right
    #0123456789
    '..KGgJJg..',  # 0
    '.KGgJJJJg.',  # 1
    'KGgJJJjJJg',  # 2
    'KGgJJJjjJg',  # 3  the light on its upper front
    'KGgJJJJjJg',  # 4
    'KGggJJJJJg',  # 5
    'KGgGgJJJJg',  # 6  a crease from the back down to the front
    'KGgJGgJJJg',  # 7
    '.KGgJGgJJg',  # 8
    '.KGgJJGgJg',  # 9
    '.KGgJJJJjg',  # 10
    '.KGgJJJJjG',  # 11
    '.KGgJJJJgK',  # 12
    '..KGGggGK.',  # 13
]
KNEE = [                # 62
    #012345678
    '.....KgJ.',  # 0
    '...KGgJjg',  # 1
    '.KGgJJjJg',  # 2
    'KGgGGgJgK',  # 3
    'KGgJJJJgG',  # 4
    'KGgJjJJgG',  # 5
    '.KGgggggK',  # 6
]
SHIN = [                # 30: the knee at the top; the hem bunches in folds at the bottom
    #012345678
    '..KGgJJg.',  # 0
    '.KGgJJJJg',  # 1
    '.KGgJJjJg',  # 2
    '.KGgJJjJg',  # 3
    '.KGgJJjJg',  # 4
    '.KGgJJJJg',  # 5
    '.KGggJJJg',  # 6
    'KGgJJJJJg',  # 7
    'KGGGgGGGK',  # 8  folds stacking
    'KGgJJjJJg',  # 9
    'KKGGgGGGK',  # 10
    'KGgJJJJJg',  # 11
]
SHOE_SIDE = [           # 39: the toe to the right; the jeans' hem over the heel
    #0123456789ABC
    'KGgJjJJg.....',  # 0
    'KKGGGGKZyy...',  # 1
    'zZZsZZsZZsyY.',  # 2  three light stripes, slanting forward
    'zZsZZsZZsZZyz',  # 3
    'zffffffffffFz',  # 4  the thin light sole
]
SHOE_SHORT = [          # 47: the foot turned toward us
    #0123456789A
    'KGgJjJg....',  # 0
    'KKGGGKZyy..',  # 1
    'zZZsZZsZyY.',  # 2
    'zZsZZsZZZyz',  # 3
    'zfffffffffz',  # 4
]
SHOE_FRONT = [          # 48: from the front
    #0123456
    'KgJjJgK',  # 0
    'KKGGGKK',  # 1
    'zZyYyZz',  # 2
    'zZZyZZz',  # 3
    'zffffFz',  # 4
]
# fmt: on

# ------------------------------------------------------------------ grove-green
# The Grove-green shirt, oversized, open over a longer white tee (Binco's "Green Shirt").
GREEN = {'a': '#7aa957', 'b': '#5a8a3f', 'c': '#43702f', 'd': '#2f5223', 'e': '#1d3517'}
# Black sneakers with a white toe cap and a white sole (the remaster's).
SNEAKER = {'z': '#0c0b0e', 'Z': '#1e1c22', 'y': '#3a3640', 's': '#efece4', 't': '#bdb8ae', 'f': '#efece4',
           'F': '#aaa498'}

# fmt: off
CHEST_GREEN = [         # 57: profile; the shirt's collar round the long neck, the tee in its open front
    #0123456789A
    '...SMLL....',  # 0
    '...SMLL....',  # 1
    '..eSMLWe...',  # 2  the collar
    '.ecbMLAbe..',  # 3  the tee's neckline under it
    'edcbbcAAbe.',  # 4  wide, dropped shoulders
    'edccbcAAbe.',  # 5
    'edcccbABce.',  # 6
    'edcccbABce.',  # 7
    'edcccbABce.',  # 8
    'edccccABde.',  # 9
    'eddccbBCde.',  # 10
    '.eddcbBCde.',  # 11
    '.eeddcCEee.',  # 12
]
CHEST_GREEN_FRONT = [   # 61: turned to us, the shirt open down the middle
    #0123456789AB
    '....SMLL....',  # 0
    '....SMLL....',  # 1
    '...eSMLWe...',  # 2
    '.ecbbAAbbce.',  # 3  the collar spread, the tee's neckline
    'ecbbcAAcbbce',  # 4
    'edbccAAcccde',  # 5
    'edcccABdccde',  # 6
    'edcccABdccde',  # 7
    'edcccABdccde',  # 8
    'edcccABdccde',  # 9
    'edccdABddcde',  # 10
    '.eddcABdcde.',  # 11
    '.eedcBCddee.',  # 12
    '..eeeCEeee..',  # 13
]
TORSO_GREEN = [         # 34: profile; the shirt to the hips, the tee's hem longer, then the jeans
    #0123456789AB
    '..edccbABe..',  # 0
    '.edcccbABe..',  # 1
    '.edcccbABe..',  # 2
    '.edcccbABe..',  # 3
    '.edccccABe..',  # 4
    '.eddcccABde.',  # 5
    'eddcccbBCde.',  # 6
    'eddcccbBCde.',  # 7
    'eeeddddeeee.',  # 8  the shirt's hem
    '.ECBAAAAABC.',  # 9  the white tee below it
    '.ECCBBBBBCE.',  # 10
    'KGgJJjjJJgG.',  # 11 the jeans
    'KGgJJJJJJgG.',  # 12
    '.KGgJJJJgGK.',  # 13
    '..KGGgggGK..',  # 14
    '...KKKKKK...',  # 15
]
TORSO_GREEN_FRONT = [   # 38
    #0123456789AB
    '.edccABdcde.',  # 0
    'edcccABdccde',  # 1
    'edcccABdccde',  # 2
    'edcccABdccde',  # 3
    'edcccABdccde',  # 4
    'edccdABddcde',  # 5
    'eddcdABdddde',  # 6
    'eddcdBBddcde',  # 7
    'eeeeeCCeeeee',  # 8
    '.ECBAAAAABCE',  # 9
    '.ECCBBBBBCE.',  # 10
    'KGgJJjJJJgGK',  # 11
    'KGgJJJGJJggK',  # 12
    'KGggJGKGJgGK',  # 13
    '.KGGgK.KgGK.',  # 14
    '..KKK...KK..',  # 15
]
SNEAKER_SIDE = [        # 39: black, a white toe cap and sole
    #0123456789ABC
    'KGgJjJJg.....',  # 0
    'KKGGGGKZyy...',  # 1
    'zZZZZZZZZtss.',  # 2
    'zZZZZZZZtsssz',  # 3
    'zffffffffffFz',  # 4
]
SNEAKER_SHORT = [       # 47
    #0123456789A
    'KGgJjJg....',  # 0
    'KKGGGKZyy..',  # 1
    'zZZZZZZtss.',  # 2
    'zZZZZZtsssz',  # 3
    'zfffffffffz',  # 4
]
SNEAKER_FRONT = [       # 48
    #0123456
    'KgJjJgK',  # 0
    'KKGGGKK',  # 1
    'zZtsZZz',  # 2
    'ztsssZz',  # 3
    'zffffFz',  # 4
]
# fmt: on

# ------------------------------------------------------------------ grove-cover
# The cover art: a pale grey-mint shirt over the tank, dark navy jeans, tan work boots.
PALE = {'h': '#e3ede5', 'i': '#bfd1c5', 'k': '#94aa9e', 'l': '#687d73'}
NAVY = {DENIM['j']: '#5e7696', DENIM['J']: '#40587a', DENIM['g']: '#2b3e5a', DENIM['G']: '#1d2b42',
        DENIM['K']: '#121a2a'}
BOOT = {'o': '#d29a5a', 'p': '#ad743a', 'r': '#835227', 'u': '#553317', 'x': '#2a1d14', 'V': '#5c4634',
        'U': '#e2cf9e'}

# fmt: off
CHEST_COVER = [         # 57: profile; the shirt open over the tank
    #0123456789A
    '...SMLL....',  # 0
    '...SMLL....',  # 1
    '..lSMLWl...',  # 2  the collar
    '.lkiMLAil..',  # 3  the tank's neckline under it
    'lkiihiAAil.',  # 4
    'lkiiihAAil.',  # 5
    'lkiiihABkl.',  # 6
    'lkiiihABkl.',  # 7
    'lkiiihABkl.',  # 8
    'lkkiiiABkl.',  # 9
    '.lkkiiBCkl.',  # 10
    '.llkkiCEll.',  # 11
]
CHEST_COVER_FRONT = [   # 61
    #0123456789AB
    '....SMLL....',  # 0
    '....SMLL....',  # 1
    '...lSMLWl...',  # 2
    '.lkiiAAiikl.',  # 3
    'lkiihAAhiikl',  # 4
    'lkiihAAhiikl',  # 5
    'lkiiiABhiikl',  # 6
    'lkiiiABiiikl',  # 7
    'lkiiiABiiikl',  # 8
    'lkiiiABiiikl',  # 9
    'lkkiiABikkkl',  # 10
    '.lkkiBCkkkl.',  # 11
    '..lllCElll..',  # 12
]
TORSO_COVER = [         # 34: profile; the shirt hangs over the belt
    #0123456789AB
    '..lkiihABl..',  # 0
    '.lkiiihABl..',  # 1
    '.lkiiihABl..',  # 2
    '.lkiiihABl..',  # 3
    '.lkiiiiABl..',  # 4
    '.lkkiiiABkl.',  # 5
    'lkkiiihBCkl.',  # 6
    'lkkiiihBCkl.',  # 7
    'llllllllll..',  # 8  the shirt's hem
    'KGgJJjjJJgG.',  # 9  the jeans
    'KGgJJJjJJgG.',  # 10
    'KGgJJJJJJgG.',  # 11
    'KGggJJJJJgG.',  # 12
    '.KGggJJJgGK.',  # 13
    '..KGGgggGK..',  # 14
    '...KKKKKK...',  # 15
]
TORSO_COVER_FRONT = [   # 38
    #0123456789AB
    '.lkiiABikkl.',  # 0
    'lkiiiABiiikl',  # 1
    'lkiiiABiiikl',  # 2
    'lkiiiABiiikl',  # 3
    'lkiiiABiiikl',  # 4
    'lkkiiABikkkl',  # 5
    'lkkiiBBikkkl',  # 6
    'lkkiiBCkkkkl',  # 7
    'llllllllllll',  # 8
    'KGgJJjJJJgGK',  # 9
    'KGgJJjGJJJgK',  # 10
    'KGgJJJGJJJgK',  # 11
    'KGgJJJGJJggK',  # 12
    'KGggJGKGJgGK',  # 13
    '.KGGgK.KgGK.',  # 14
    '..KKK...KK..',  # 15
]
BOOT_SIDE = [           # 39: a tan work boot, its thick dark sole; the jeans' hem over its top
    #0123456789ABC
    'KGgJjJJg.....',  # 0
    'KKGGGGKUpo...',  # 1  laces at the top of the tongue
    'urpppppUppoo.',  # 2
    'urrppppppppou',  # 3
    'xVxxxxxxxxxxx',  # 4
]
BOOT_SHORT = [          # 47
    #0123456789A
    'KGgJjJg....',  # 0
    'KKGGGKUpo..',  # 1
    'urppppUpoo.',  # 2
    'urrpppppppu',  # 3
    'xVxxxxxxxxx',  # 4
]
BOOT_FRONT = [          # 48
    #0123456
    'KgJjJgK',  # 0
    'KKGGGKK',  # 1
    'urpUpou',  # 2
    'urpppou',  # 3
    'xxxxxxx',  # 4
]
# fmt: on

LEGEND = legend(SKIN, TANK, BELT, DENIM, SHOE)
GREEN_LEGEND = legend(SKIN, TANK, DENIM, GREEN, SNEAKER)
COVER_LEGEND = legend(SKIN, TANK, DENIM, PALE, BOOT)
_ALL = {'57': CHEST_TANK, '61': CHEST_TANK_FRONT, '34': TORSO_TANK, '38': TORSO_TANK_FRONT, '53': THIGH,
        '62': KNEE, '30': SHIN, '39': SHOE_SIDE, '47': SHOE_SHORT, '48': SHOE_FRONT}
_GREEN = {'57': CHEST_GREEN, '61': CHEST_GREEN_FRONT, '34': TORSO_GREEN, '38': TORSO_GREEN_FRONT,
          '39': SNEAKER_SIDE, '47': SNEAKER_SHORT, '48': SNEAKER_FRONT}
_COVER = {'57': CHEST_COVER, '61': CHEST_COVER_FRONT, '34': TORSO_COVER, '38': TORSO_COVER_FRONT,
          '39': BOOT_SIDE, '47': BOOT_SHORT, '48': BOOT_FRONT}
# Turned by the look tool from these upright pictures.
UPRIGHT = [57, 34, 53, 49, 62, 30, 39, 43]


def darker(pic, steps):
    """The far side: every colour a step down its own ramp."""
    m = {}
    order = [list(SKIN.values()), list(TANK.values()), list(DENIM.values()), list(NAVY.values()),
             [SHOE['f'], SHOE['F'], '#6e6860'], [SHOE['Y'], SHOE['y'], SHOE['Z'], SHOE['z']],
             [SHOE['s'], SHOE['t'], '#5e5862'], [SNEAKER['s'], SNEAKER['t'], '#8a857c'],
             list(GREEN.values()), list(PALE.values()), [BOOT['o'], BOOT['p'], BOOT['r'], BOOT['u']]]
    for ramp in order:
        for i, c in enumerate(ramp):
            m.setdefault(c.lower(), ramp[min(len(ramp) - 1, i + steps)])
    return pic.recolor(m)


def _legs(legend_):
    """The jeans and the shoes: {key: Pic} with the far thigh and shoe a step darker."""
    return {'53': Pic.text(THIGH, legend_), '62': Pic.text(KNEE, legend_), '30': Pic.text(SHIN, legend_),
            '49': darker(Pic.text(THIGH, legend_), 1)}


def tank_parts():
    """{part key: Pic} of the tank-top outfit."""
    out = {k: Pic.text(rows, LEGEND) for k, rows in _ALL.items()}
    out['49'] = darker(Pic.text(THIGH, LEGEND), 1)
    out['43'] = darker(Pic.text(SHOE_SIDE, LEGEND), 1)
    return out


def green_parts():
    """{part key: Pic} of the green shirt over the tee (the tank's jeans)."""
    out = _legs(GREEN_LEGEND)
    out.update({k: Pic.text(rows, GREEN_LEGEND) for k, rows in _GREEN.items()})
    out['43'] = darker(Pic.text(SNEAKER_SIDE, GREEN_LEGEND), 1)
    return out


def cover_parts():
    """{part key: Pic} of the cover art's outfit: the pale shirt, navy jeans, work boots."""
    out = _legs(COVER_LEGEND)
    out.update({k: Pic.text(rows, COVER_LEGEND) for k, rows in _COVER.items()})
    out['43'] = darker(Pic.text(BOOT_SIDE, COVER_LEGEND), 1)
    for k, p in out.items():
        p.recolor(NAVY)
    return out


def check():
    for group, leg in ((_ALL, LEGEND), (_GREEN, GREEN_LEGEND), (_COVER, COVER_LEGEND)):
        for k, rows in group.items():
            for y, r in enumerate(rows):
                assert len(r) == len(rows[0]), f'{k} row {y}: {len(r)} wide, not {len(rows[0])}'
                for ch in r:
                    assert ch == '.' or ch in leg, f'{k} row {y}: {ch!r}'


check()
