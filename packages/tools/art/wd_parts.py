"""Widow's body pictures, drawn here as text pixel art (upright; the look tool turns them).

Widowmaker's build on Blaise's body: the tallest-looking and most hourglass of the women, a
ballerina's poise: a full bust and round hips against a waist cinched in by the suit's dark side
panels, the longest, slimmest legs (the lilac leg panels cut high on the hip lengthen them, the
stiletto heels lengthen them more), slender bare arms.

Every picture is text with a legend of semantic characters, shared by the looks (`wd_looks.py`
gives each look its colours):

  a b c d e    the suit's body, gloss → outline (classic: glossy magenta latex)
  f g h j      the leg panels, light → dark (classic: lilac grey); k their black ribs
  p P          the trim (classic: light blue piping round the neckline)
  W S s t T D  her lavender skin, highlight → deep shade
  m n N q o    dark armour and carbon (the gauntlet, the shoulder plate, the waist panels),
               spec → outline; v V the gauntlet's violet glow
  B C E F      the boots, light → dark (outline o); x X the claws' blue tips
  z            the tattoo's ink; r R the look's accent (Noire's red corset, Odile's teal...)

Pictures face right (the toe, the bust); upright limbs lie along y (legs) or x (arms: the shoulder
or the elbow on the left). Sizes keep Blaise's part centred where hers is (a picture grown on the
right or the bottom only, or by one on each side)."""
from lookgen import check_pictures

# ------------------------------------------------------------------------------- the chest
# The chest in profile (57), 13 x 13 (Blaise's 10 x 12 grown by one on the left and the bottom and
# three on the right, so it sits where hers does): the high collar round the neck, the neckline's deep V down the front (a
# line of skin edged by the trim), the full bust lit on its top; behind, the suit open down the
# back to the waist, edged with the trim, the spider tattoo's dark mark between the shoulders.
CLASSIC_57 = [
    '....epbe.....',
    '....ecbe.....',
    '....edce.....',
    '...edccpe....',
    '..edcccbpe...',
    '.eTtpccbpSe..',
    '.eTtpcbbaabe.',
    '.eTzpcbbbaabe',
    '.eTtpccbbaaae',
    '.edTpcccbbbde',
    '..edpcccccde.',
    '..eddddddde..',
    '...eeeeeee...',
]
# The chest turned to us (61), 11 x 13: the collar, the V of skin from it down the middle edged
# with the trim, the bust either side of it lit from her right, the dark curved panels under it.
CLASSIC_61 = [
    '...ecbbe...',
    '...ecbbe...',
    '..eppSppe..',
    '.edcpSSpbe.',
    'edcbpSSpabe',
    'edbbapSpaae',
    'edcbbpSpbae',
    'edccbpSpbbe',
    'eqdccpWpcbe',
    'eqqdcpSpcqe',
    '.eqdcpPpdqe',
    '.eqddcpcdqe',
    '..eeeeeeee.',
]

# ------------------------------------------------------------------------------- the torso
# The torso in profile (34), 11 x 16 (Blaise's 9 x 16 and a column each side): the V's last point at the front, the waist cinched by the
# dark side panel, the round hips and the rear lit by the gloss, the leg panel cut high on the hip
# (from the hip bone down to the back of the thigh), its rib.
CLASSIC_34 = [
    '....edcbe..',
    '....eqcbe..',
    '....eqcbe..',
    '....eqcbe..',
    '...edqcbe..',
    '...edqcbbe.',
    '..edcqcbbe.',
    '.ebbcdqcae.',
    'ebabcdqcbf.',
    'eaabcddcfg.',
    'ebacdcdfgg.',
    'ebbcccfggh.',
    'edcdcfgggh.',
    '.eddfgkghj.',
    '..ejgkghj..',
    '...jjjjj...',
]
# The torso turned to us (38), 13 x 16 (Blaise's 11 x 16 and a column each side): the V's point at the middle, the waist cinched between
# the dark panels, the hips flaring, the leg panels cut high up the hips to a V of the suit.
CLASSIC_38 = [
    '....edpce....',
    '....eqcqe....',
    '....eqcqe....',
    '....eqcqe....',
    '...eqccbqe...',
    '...edccbbe...',
    '..edcccbbae..',
    '.edcccccbbae.',
    'efdccccbbbbae',
    'egfdcccbbbage',
    'eggfdccbbbgfe',
    'ehggfdcbbgffe',
    'ehgggdccgfffe',
    '.jhgggdcgffj.',
    '..jjhgjjgfj..',
    '....jj..jj...',
]

# ---------------------------------------------------------------------------------- arms
# Her bare upper arm (5; the far one, 9, a tone darker), shoulder on the left, slender (a row
# thinner than Blaise's).
ARM_5 = [
    '.tss......',
    'tSSSWSSSSs',
    'tsssSSsss.',
    '.Tttttttt.',
    '..........',
]
# The left shoulder's plate: a dark grey pentagon over the shoulder, the glowing W on it.
PLATE_5 = [
    'qnmmnq....',
    'qnNpNnSSSs',
    'qNpNpNsss.',
    'oqNNNoTtt.',
    '.oqqo.....',
]
# Her right forearm, bare, the tattoo's dark script along it, the glove's cuff at the wrist.
FORE_1_RIGHT = [
    '.SWSSSnq',
    'sszszsNq',
    '.tttttNq',
]
# Her left forearm in the grappling hook's gauntlet: massive dark grey armour from the elbow to the
# wrist, a row thicker each side than the arm, the violet glow along it, two spikes back to the
# elbow.
FORE_1_LEFT = [
    'mnnnnnmq',
    'qNnvVvNq',
    'qNNvvvNq',
    'oqqqqqqo',
]

# ---------------------------------------------------------------------------------- legs
# The thigh (53; the far one, 49, a tone darker): the lilac leg panel, slim, tapering to the knee,
# its two black ribs curving down to meet over the knee.
THIGH_53 = [
    '..jhgj.',
    '.jhggfj',
    '.jkgffj',
    '.jhkgfj',
    '.jhkgfj',
    '.jhgkfj',
    '..jhkfj',
    '..jhgkj',
    '..jhgfj',
    '..jhgfj',
    '..jhgfj',
    '..jhgj.',
    '..jhgj.',
    '..jjgj.',
]
# The knee: the boot's pointed knee guard, a grey plate rising to a point over the front of the
# knee, the dark mesh behind it.
KNEE_62 = [
    '....o',
    '...oX',
    '..oBB',
    '.oCBB',
    'oECBo',
    'oFECo',
    'oFEo.',
    '.oo..',
]
# The boot's shaft (30): grey armour, slim, a line of light down its front, tapering to the ankle.
SHIN_30 = [
    '.oCBo',
    '.oECo',
    '.oECo',
    '.oECo',
    '.oECo',
    '.oECo',
    '.oEo.',
    '.oEo.',
    '.oCo.',
    'oECo.',
    'oECo.',
    'oEBo.',
]
# The stiletto boot's foot (39, the far one 43 darker; 47 and 48 the foot turned): the arched foot
# high on its heel, the heel a thin spike with a blue claw curling back, the pointed toe with a claw
# over it. Two rows of the shaft over the original shoe and two clear rows under it, so it stands
# where that stood.
BOOT_39 = [
    '.oECo........',
    '.oECo........',
    '.oEECo.......',
    'XoFECBo......',
    '.oFEECBo.....',
    '.oFooFECBo...',
    '.xo..ooooBBox',
    '.............',
    '.............',
]
BOOT_47 = [
    '.oECo......',
    '.oECo......',
    '.oEECo.....',
    'XoFECBo....',
    '.oFEECBo...',
    '.oFoFECBBo.',
    '.xo.ooooBox',
    '...........',
    '...........',
]
BOOT_48 = [
    '.oECo..',
    '.oECo..',
    '.oECBo.',
    'oFECBBo',
    'oFECCBo',
    'xooooox',
    '.......',
]
FAR = {'a': 'b', 'b': 'c', 'c': 'd', 'f': 'g', 'g': 'h', 'h': 'j', 'W': 'S', 'S': 's', 's': 't', 't': 'T',
       'B': 'C', 'C': 'E', 'E': 'F', 'p': 'P', 'm': 'n', 'n': 'N', 'X': 'x'}


# ---------------------------------------------------------------------------------- the rifle
# Widow's Kiss across her back, on the chest (back layer), `+` on the chest's point: the open
# D-shaped stock up behind her shoulder, the dark receiver with the scope's red light, the long
# barrel of blue-lilac metal down and back past her hips, forked at the muzzle.
RIFLE = [
    '.........oooo.',
    '........oqnnqo',
    '........oq..qo',
    '.......oq..qo.',
    '.......oqqqqo.',
    '......oNmmNo..',
    '......oNrNNo..',
    '.....oNNNNo...',
    '.....oiIIo....',
    '....oiIIo.....',
    '....oiIo.....+',
    '...oiIo.......',
    '...oiIo.......',
    '..oiIo........',
    '..oiIo........',
    '.oiIo.........',
    '.oiIo.........',
    'oiIo..........',
    'oiIo..........',
    'oIoIo.........',
    '.o.o..........',
]


def rifle(view='side'):
    """The rifle on the chest's point: across the back in profile (57); turned to us (61) higher
    and further over, the stock over her far shoulder and the muzzle under the near hip."""
    rows = [r.replace('+', '.') for r in RIFLE]
    w = len(rows[0])
    x, y = (13, 10) if view == 'side' else (3, 10)
    # Pad so the chest's point can sit anywhere in or around the picture.
    pad = 4
    rows = ['.' * (w + 2 * pad)] * pad + ['.' * pad + r + '.' * pad for r in rows] + ['.' * (w + 2 * pad)] * pad
    x, y = x + pad, y + pad
    rows[y] = rows[y][:x] + '+' + rows[y][x + 1:]
    return rows


# ================================================================================== Noire
# The black bodysuit (a..e black latex) closed to the high collar, the blood-red corset (r R) from
# under the bust over the waist, the belt of red cartridges round the hips, black legs and sleeves,
# black stilettos with red soles and heels (x X); the gauntlet black with a red glow.
NOIRE_57 = [
    '....ebbe.....',
    '....ecbe.....',
    '....edce.....',
    '...edccbe....',
    '..edcccbbe...',
    '.edccccbbae..',
    '.edcccbbaabe.',
    '.edcccbbbaabe',
    '.edRrrrrrrrre',
    '.edRrrrrrrrde',
    '..eRRrrrrrde.',
    '..eRRrrrrRe..',
    '...eeeeeee...',
]
NOIRE_61 = [
    '...ecbbe...',
    '...ecbbe...',
    '..edcbbbe..',
    '.edcbbbabe.',
    'edcbbbbaabe',
    'edbbabbaaae',
    'edcbaabbabe',
    'edccbbbbbbe',
    'eRrrrrrrrRe',
    'eRrrrrrrrRe',
    '.eRrrrrrRe.',
    '.eRrrrrrRe.',
    '..eeeeeeee.',
]
NOIRE_34 = [
    '....eRrre..',
    '....eRrre..',
    '....eRrre..',
    '....eRrre..',
    '...eRRrre..',
    '...eRRrrre.',
    '..eRRrrrre.',
    '..eeeeeeee.',
    '.eqXrXrXre.',
    'ebbcccccbe.',
    'eaabcccbbe.',
    'ebacccbbbd.',
    'ebccccbbbd.',
    '.edcccbbd..',
    '..eddcbd...',
    '...eeeee...',
]
NOIRE_38 = [
    '....eRrre....',
    '....eRrre....',
    '....eRrre....',
    '....eRrre....',
    '...eRRrrRe...',
    '...eRrrrRe...',
    '..eRRrrrrRe..',
    '.eeeeeeeeeee.',
    'eqrXrXrXrXrqe',
    'edcccccbbbbae',
    'edcccccbbbbbe',
    'eddccccdcbbbe',
    '.eddccdcdcbe.',
    '..edccedcbe..',
    '...edde.dde..',
    '....ee...e...',
]
NOIRE_LEG = {'f': 'b', 'g': 'c', 'h': 'd', 'j': 'e', 'k': 'd'}
# The sleeves: black latex from the shoulder, the shoulder's plate black with its red W.
NOIRE_ARM = {'W': 'a', 'S': 'b', 's': 'c', 't': 'd', 'T': 'e', 'z': 'd'}
NOIRE_PLATE = {'p': 'r', 'S': 'b', 's': 'c', 't': 'd', 'T': 'e'}
# Black knee-high stilettos, segmented plates down the shin, the red sole and the red heel.
NOIRE_62 = [
    '....o',
    '...oB',
    '..oCB',
    '.oECB',
    'oFECo',
    'oFECo',
    'oFEo.',
    '.oo..',
]
NOIRE_30 = [
    '.oCBo',
    '.oECo',
    '.oFFo',
    '.oECo',
    '.oECo',
    '.oFFo',
    '.oEo.',
    '.oEo.',
    '.oFo.',
    'oECo.',
    'oECo.',
    'oEBo.',
]
NOIRE_39 = [
    '.oECo........',
    '.oECo........',
    '.oEECo.......',
    '.oFECBo......',
    '.oFEECBo.....',
    '.xFooFECBo...',
    '.xx..xxxxxxo.',
    '.............',
    '.............',
]
NOIRE_47 = [
    '.oECo......',
    '.oECo......',
    '.oEECo.....',
    '.oFECBo....',
    '.oFEECBo...',
    '.xFoFECBBo.',
    '.xx.xxxxxx.',
    '...........',
    '...........',
]
NOIRE_48 = [
    '.oECo..',
    '.oECo..',
    '.oECBo.',
    'oFECBBo',
    'oFECCBo',
    'xxxxxxx',
    '.......',
]


# ================================================================================== Odile
# The black swan: the teal satin corset (a..e) cinched to the waist, its black lace edge (q) across
# the bust and its boning, bare shoulders, a black choker; a black tutu with teal rings (a hips
# attachment, `TUTU_34` / `TUTU_38`); black tights (f g h j) wrapped by the teal ribbons of her
# pointe shoes (k), black pumps with teal ankle ribbons; the silver gauntlet with a rose glow and
# black feathers on her left shoulder.
ODILE_57 = [
    '...TSsT....',
    '...qqqq....',
    '...TsST....',
    '..TsSSST...',
    '.TtsSSSWt..',
    'eqqqqqqqqe.',
    'edcbbaabbbe',
    'edcbbaaabae',
    'edccbbbbabe',
    'edcccbbbbde',
    '.edcdcbcde.',
    '.eddcdcdde.',
    '..eeeeeee..',
]
ODILE_61 = [
    '...TSST....',
    '...qqqqq...',
    '...TSSsT...',
    '.TtsSSSStT.',
    'TtsSSWSSstT',
    'eqqqrqqrqqe',
    'edcbaqqabae',
    'edcbbqqbbae',
    'edccbdbbbbe',
    'edcdcbcdcde',
    '.edcdbdcde.',
    '.eddcdcdde.',
    '..eeeeeeee.',
]
ODILE_34 = [
    '...edcbe.',
    '...edcbe.',
    '...edcbe.',
    '...edcbe.',
    '..edcdbe.',
    '..eqqqqqe',
    '.jhgggfgj',
    '.jhgggffj',
    'jhggggffj',
    'jhgggfffj',
    'jhgggffgj',
    'jhgggfggj',
    'jhhgggggj',
    '.jhhgghj.',
    '.jjhhhj..',
    '..jjjjj..',
]
ODILE_38 = [
    '...edcbe...',
    '...edcbe...',
    '...edcbe...',
    '...edcbe...',
    '..edcdcbe..',
    '..eqqqqqqe.',
    '.jhggggffj.',
    '.jhgggfffj.',
    'jhgggggfffj',
    'jhgggggffgj',
    'jhhggghgfgj',
    'jhhgghjhggj',
    'jhhghj.jhgj',
    '.jhgj..jhgj',
    '..jj....jj.',
    '...........',
]
# The tutu, on the hips over the torso's point (23 x 32: torso row r is row r + 8, column c is
# c + 7 in profile, c + 6 turned to us): three tiers of black tulle flaring out from the waist to
# the top of the thighs, each with its teal hem, the underside darker.
TUTU_34 = ['.' * 23] * 14 + [
    '.........oooooo........',
    '........oRrrrrRo.......',
    '.......okxkkkxkko......',
    '......oRrRrRrRrRro.....',
    '.....oRrRrRrRrRrRRo....',
    '....okkxkkkkkxkkkkko...',
    '...oRrRrRrRrRrRrRrRRo..',
    '..oRRRRRRRRRRRRRRRRRRo.',
    '..okkkxkkkkkxkkkkkxkko.',
    '...ooooooooooooooooooo.',
] + ['.' * 23] * 8
TUTU_38 = ['.' * 23] * 14 + [
    '.........ooooo.........',
    '........oRrrrRo........',
    '.......okkxkxkko.......',
    '......oRrRrRrRrRo......',
    '.....oRrRrRrRrRrRo.....',
    '....okkxkkkxkkkxkko....',
    '...oRrRrRrRrRrRrRrRo...',
    '..oRRRRRRRRRRRRRRRRRo..',
    '..okkxkkkxkkkxkkkxkko..',
    '...ooooooooooooooooo...',
] + ['.' * 23] * 8
# Her thigh in black tights, two turns of the teal ribbon round it.
ODILE_53 = [
    '..jhgj.',
    '.jhggfj',
    '.jhgffj',
    '.jkkgfj',
    '.jhgkkj',
    '..jhgfj',
    '..jhgfj',
    '..jhgfj',
    '..jkkfj',
    '..jhgkj',
    '..jhgfj',
    '..jhgj.',
    '..jhgj.',
    '..jjgj.',
]
ODILE_62 = [
    '.jgj.',
    'jggfj',
    'jhgfj',
    'jgkkj',
    '.jgj.',
]
ODILE_30 = [
    '..jfj',
    '.jggj',
    '.jgfj',
    '.jgfj',
    '.jkkj',
    '.jgkj',
    '.jgj.',
    '.jgj.',
    '.jkj.',
    'jgkj.',
    'jkfj.',
    'jgkj.',
]
# Black pumps on a slender heel, pointed, the teal ribbon tied round the ankle.
ODILE_39 = [
    '.jgfj........',
    '.jkgj........',
    '.xXxXo.......',
    '.oECBBo......',
    '.oFEECBBo....',
    '.oFooFECBBo..',
    '..o..oooooooo',
    '.............',
    '.............',
]
ODILE_47 = [
    '.jgfj......',
    '.jkgj......',
    '.xXxXo.....',
    '.oECBBo....',
    '.oFEECBBo..',
    '.oFoFECBBBo',
    '..o.ooooooo',
    '...........',
    '...........',
]
ODILE_48 = [
    '.jgfj..',
    '.jkgj..',
    'xXxXxX.',
    'oFECBBo',
    'oFECCBo',
    '.ooooo.',
    '.......',
]

# ================================================================================ Comtesse
# The Comtesse Guillard: the violet frock coat (a..e) with its gold frogging and edges (p P), the
# white lace jabot at the throat (r R), the coat cut away in front over violet breeches (f g h j,
# a gold seam k down the outside), long coat tails behind (ribbons, `COAT_TAIL`); tall brown
# riding boots (B C E F) with a wide folded cuff of tan suede at the knee (x X) and a heel with a
# spur; violet sleeves, the gauntlet in bronze with an amber glow.
COMTESSE_57 = [
    '...epcpe...',
    '...ecbre...',
    '...edcrr...',
    '..edcbrRr..',
    '.edccbprRe.',
    'edcccbbrre.',
    'edccpppbRre',
    'edcccbbbrre',
    'edccpppbbae',
    'edcccbbbbde',
    '.edccccdde.',
    '.eddddddde.',
    '..eeeeeee..',
]
COMTESSE_61 = [
    '...epcpe...',
    '..edcrcbe..',
    '..edrRrbe..',
    '.edcrRrRbe.',
    'edpppRrppae',
    'edcbrRRrbae',
    'edpppRrppae',
    'edcbbrrbbae',
    'edpppRrppae',
    'edccbrrbcde',
    '.edcccccde.',
    '.eddcccdde.',
    '..eeeeeee..',
]
COMTESSE_34 = [
    '...edcbe.',
    '...edcbe.',
    '...epppe.',
    '...edcbe.',
    '..edccbe.',
    '..edccbbe',
    '.edccgffe',
    '.edcdhgfe',
    'edccdhgfe',
    'edcchggfe',
    'edchggffj',
    'edhgggfgj',
    'ejhgggghj',
    '.jhggghj.',
    '.jjhgghj.',
    '..jjjjj..',
]
COMTESSE_38 = [
    '...edcbe...',
    '...edcbe...',
    '...epppe...',
    '...edrbe...',
    '..edcrbbe..',
    '..edcRcbe..',
    '.edccfcbbe.',
    '.edcgffcbe.',
    'edcgffffcbe',
    'edcgfffgcbe',
    'edhgffggcde',
    'ejhgffgghje',
    'ejhggfgghje',
    '.jhgjjgghj.',
    '..jjj.jjj..',
    '...........',
]
# A coat tail, a ribbon from the hips: violet edged in gold, tapering to a point by the knee.
COAT_TAIL = [
    'pcbp',
    'pcbp',
    'pdcp',
    'pdcp',
    'pdcp',
    'pdcp',
    'pdcp',
    'pddp',
    'pddp',
    '.pdp',
    '.pdp',
    '.pdp',
    '.pp.',
    '.p..',
]
# The coat's skirts behind her, cut away in front: on the torso (behind everything) over its point
# (17 x 32: torso row r is row r + 8, column c is c + 4 in profile, c + 3 turned to us): in
# profile the tails hanging from the waist to the back of the knee, gold at their edges; turned to
# us the two tails either side of her hips.
COAT_34 = ['.' * 17] * 14 + [
    '...obbo..........',
    '..obccdo.........',
    '..obccdo.........',
    '.obccddo.........',
    '.obcddo..........',
    '.obcddo..........',
    'obccddo..........',
    'obcddo...........',
    'obcddo...........',
    'opcddo...........',
    'opcdpo...........',
    '.oppo............',
    '..oo.............',
] + ['.' * 17] * 5
COAT_38 = ['.' * 17] * 14 + [
    '..obo.......obo..',
    '.obcdo.....obcdo.',
    '.obcdo.....obcdo.',
    'obccdo.....obcddo',
    'obcddo.....obcddo',
    'obcddo.....obcddo',
    'opcddo.....obcdpo',
    'opcdpo.....opcdpo',
    '.oppo.......oppo.',
    '..oo.........oo..',
] + ['.' * 17] * 8
COMTESSE_53 = [
    '..jhgj.',
    '.jhggfj',
    '.jhgffj',
    '.jkgffj',
    '.jkgffj',
    '.jkgffj',
    '..jkgfj',
    '..jkgfj',
    '..jkgfj',
    '..jkgfj',
    '..jkgfj',
    '..jkgj.',
    '..jkgj.',
    '..jjgj.',
]
# The boot's cuff, folded down over the knee and flaring out round it.
COMTESSE_62 = [
    '.oxXXo.',
    'oxXXXXo',
    'oxxXXXo',
    'oxxxXxo',
    '.ooooo.',
]
COMTESSE_30 = [
    '.oCBo',
    '.oECo',
    '.oECo',
    '.oECo',
    '.oECo',
    '.oECo',
    '.oEo.',
    '.oEo.',
    '.oCo.',
    'oECo.',
    'oECo.',
    'oEBo.',
]
COMTESSE_39 = [
    '.oECo........',
    '.oECo........',
    '.oEECo.......',
    '.oFECBo......',
    '.oFEECBBo....',
    'xoFFoECBBBo..',
    '.oFo.oooooo..',
    '.............',
    '.............',
]
COMTESSE_47 = [
    '.oECo......',
    '.oECo......',
    '.oEECo.....',
    '.oFECBo....',
    '.oFEECBBo..',
    'xoFoECBBBo.',
    '.oo.ooooo..',
    '...........',
    '...........',
]
COMTESSE_48 = [
    '.oECo..',
    '.oECo..',
    '.oECBo.',
    'oFECBBo',
    'oFECCBo',
    '.ooooo.',
    '.......',
]
# Sleeves of the coat over her arms (the skin's tones as the coat's), its cuff at the wrist.
SLEEVE = {'W': 'a', 'S': 'b', 's': 'c', 't': 'd', 'T': 'e', 'z': 'c'}


check_pictures(globals())
