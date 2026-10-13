"""Azure's body, drawn upright as text (the look tool turns the pictures): Liara's slender scholar's
build on Blaise's body, a teardrop silhouette: a light top over knee-length coat skirts split in
front, thin dark legs in knee boots.

Every picture is text with a legend of semantic characters, shared by the looks:

  o        the clothes' outline
  a b c d e  the coat, light → dark
  w v u    the light material (the yoke, the white coat), light → dark
  k q      black piping and straps, its lit edge
  r R      the look's accent (indigo straps, pink-red inserts, teal piping), light, dark
  x X y    the leggings: main, lit, edge
  K H J    the boots: main, lit, edge; P p their panel or plate (light, dark); g G the sole
  S s t T  her blue skin (the hands, the neck), light → dark

Pictures face right (the toe, the bust); upright limbs lie along y (legs) or x (arms: the
shoulder or the elbow on the left)."""

# --------------------------------------------------------------------------------------------
# Scholar (Mass Effect 1): the sage-green dress-coat, the asymmetric light yoke edged with thick
# black piping, the ribbed standing collar, a white stripe down the sleeves and the dark X-05
# armbands, black cuffs; knee-length skirts split in front over black leggings; smooth black knee
# boots on a ridged sole.
# --------------------------------------------------------------------------------------------

# The chest in profile (57), 10 x 12 like Blaise's: the collar round the neck, the yoke over the
# shoulder and the upper chest, its piping crossing under it, the green bust.
SCHOLAR_57 = [
    '..kvwwk...',
    '..kuvwk...',
    '..kvwwk...',
    '..kkkkk...',
    '..ouvvvk..',
    '.ouvvwwvk.',
    '.ouvvvwwko',
    'oduuvvkkbo',
    'oddkkbbbao',
    'odccbbbbao',
    'odcccbbbbo',
    '.oddccbbo.',
    '.ooooooo..',
    '..........',
]
# The chest turned to us (61), 11 x 13: the collar, the yoke from her right shoulder across the
# chest, the piping from the collar down to under the bust and across, the green below.
SCHOLAR_61 = [
    '..kvwwvk...',
    '..kuvwwk...',
    '..kvwwvk...',
    '..kkkqkk...',
    'ouvwwwkwwvo',
    'ouvwwkwwwvo',
    'ouvwkwwwwvo',
    'ouvkvwwqwvo',
    'oukvvvwwvbo',
    'okkkkkkkkbo',
    'odcbbabbbco',
    '.odcbbbbcdo',
    '.oddccccddo',
    '.oooooooooo',
    '...........',
]
# The torso in profile (34), 9 x 16: the fitted green coat to the hips, a seam down the side,
# the black leggings at the crotch under the skirts.
SCHOLAR_34 = [
    '...obbo..',
    '..obbbbo.',
    '..ocbbbo.',
    '..ocbbao.',
    '..odcbao.',
    '..odcbbo.',
    '..odcbbo.',
    '.odccbbbo',
    '.oddcbbbo',
    'odddcbbbo',
    'odddccbbo',
    'oddddcbbo',
    'oyxxxxxxo',
    'oyyxxxXo.',
    '.oyyyyyo.',
    '...oooo..',
]
# The torso turned to us (38), 11 x 16: two seams down the front, the V of the skirts' split
# opening over the black leggings.
SCHOLAR_38 = [
    '...obbbbo..',
    '..obbbbbbo.',
    '..obcbbcbo.',
    '..obcbbcbo.',
    '..odcbbcdo.',
    '..odcbbcdo.',
    '..ocdbbdco.',
    '.ocdcbbcdco',
    '.odccbbccdo',
    '.oddcbbcddo',
    'oddcoxxocdo',
    'oddoxXxxodo',
    'odoyxXxxyoo',
    'oyyxxXxxxyo',
    '.oyyxxxyyo.',
    '...ooooo...',
]
# The knee-length skirts, a hips attachment of the torso (over both legs): in profile (on 34,
# turned with it) the coat flaring from the hips, its front cut away up the thigh where it opens,
# the back hanging to the knee; turned to us (on 38) two panels and the inverted V between them.
# 13 x 36, centred like the torso: torso row r is row r + 10 here, column c is c + 2.
SCHOLAR_SKIRT_34 = ['.' * 13] * 20 + [
    '...obbbbbbo..',
    '..ocbbaabbbo.',
    '..ocbbbaabbbo',
    '..occbbbaabao',
    '.ocdccbbbaao.',
    '.ocdcccbbbo..',
    '.oddcdccbo...',
    '.oddcddcbo...',
    'oddddcdco....',
    'oedddcdo.....',
    'oeedddco.....',
    'oeedddo......',
    'oeeeddo......',
    'ooeeeo.......',
    '..ooo........',
] + ['.' * 13]
SCHOLAR_SKIRT_38 = ['.' * 13] * 20 + [
    '..obbbbbbbo..',
    '..ocbbobbcdo.',
    '.ocbbo.obbdo.',
    '.ocbo...obcdo',
    '.ocbo...obcdo',
    'ocdo.....obdo',
    'ocdo.....obdo',
    'ocdo.....oddo',
    'oddo.....oddo',
    'oddo.....oddo',
    'odeo.....odeo',
    'oeeo.....oeeo',
    'oeeo.....oeo.',
    '.oo......oo..',
    '.............',
] + ['.' * 13]

# Black leggings: the near thigh (53; the far one, 49, a tone darker), the knee.
LEG_53 = [
    '.yxxxy.',
    'yxxxXxy',
    'yxxxXxy',
    'yxxxXxy',
    'yxxxXxy',
    '.yxxXxy',
    '.yxxXxy',
    '.yxxXy.',
    '.yxxXy.',
    '..yxXy.',
    '..yxXy.',
    '..yxXy.',
    '..yxXy.',
    '..yxxy.',
]
LEG_62 = [
    '.yxy.',
    'yxxXy',
    'yxxXy',
    'yxXxy',
    '.yxy.',
]
LEG_FAR = {'X': 'x', 'x': 'y'}

# Smooth black knee boots: the shaft (30) with a line of light down its front, the foot (39, the
# far one 43 darker; 47 and 48 the foot turned) with a round, slightly flat toe, a strap round the
# ankle, a thick ridged sole. Two rows over the original sneakers (the shaft) and as many padding
# rows under them, so they stand where those stood.
ME1_30 = [
    '..JJ.',
    '.JKHJ',
    '.JKHJ',
    '.JKHJ',
    '.JKHJ',
    '.JKHJ',
    '.JKJ.',
    '.JKJ.',
    '.JHJ.',
    'JKHJ.',
    'JKHJ.',
    'JKKJ.',
]
ME1_39 = [
    '.JKHJ........',
    '.JKHJ........',
    '.JKKKHJ......',
    'JKKKKKKHHJ...',
    'JKKKKKKKKKHJ.',
    'JqqqqqqqqqqJ.',
    '.gGgGgGgGgG..',
    '.............',
    '.............',
]
ME1_47 = [
    '.JKHJ......',
    '.JKHJ......',
    '.JKKKHJ....',
    'JKKKKKKHHJ.',
    'JKKKKKKKKHJ',
    'JqqqqqqqqqJ',
    '.gGgGgGgGg.',
    '...........',
    '...........',
]
ME1_48 = [
    '.JKHJ..',
    '.JKHJ..',
    '.JKHKJ.',
    'JKKHKKJ',
    'JKKHKKJ',
    'JqqqqqJ',
    '.gGgGg.',
    '.......',
    '.......',
]
SHOE_FAR = {'H': 'K', 'K': 'J', 'G': 'g', 'P': 'p', 'q': 'k'}

# The sleeves: the upper arm (5; the far one, 9, darker), shoulder on the left, the white stripe
# down its outer side and the dark X-05 armband round it; the forearm (1), elbow on the left, the
# stripe and the black cuff to the wrist.
SCHOLAR_5 = [
    '.bab......',
    'awwwkkwwww',
    'abbbkkbbbb',
    'cccckkcccc',
    '.cdd......',
]
SCHOLAR_1 = [
    '.wwwkqqk',
    'bbbbkkkk',
    '.cccqkkq',
]
ARM_FAR = {'a': 'b', 'b': 'c', 'c': 'd', 'd': 'e', 'w': 'v', 'v': 'u', 'q': 'k'}


# --------------------------------------------------------------------------------------------
# Broker (Lair of the Shadow Broker, Mass Effect 3): the white coat with light grey grid panels on
# the shoulders and the sides, white segmented plates down the middle, indigo piping on its edges,
# the high indigo collar with white edges and tabs, the indigo strap under the bust and the belt,
# the skirts open in front to the knee over dark leggings with indigo piping and a strap round each
# thigh; white sleeves with a grey ribbed ring at the shoulder, grey ribbed bracers, black gloves;
# grey ribbed armoured knee boots with a white side panel, an angular knee guard, a grey toe cap.
# --------------------------------------------------------------------------------------------
BROKER_57 = [
    '..oaaao...',
    '..orrro...',
    '..oRrRo...',
    '..oaaao...',
    '..ovaabo..',
    '.ovvaaabo.',
    '.ovvaaaabo',
    'ovvbaaaaao',
    'ovrrrrrrro',
    'ovbbaacaao',
    'ovbbbacbbo',
    '.ovbbbcbo.',
    '.ooooooo..',
    '..........',
]
BROKER_61 = [
    '..oaaaao...',
    '..orrrro...',
    '..oRrrRo...',
    '..aoaaoa...',
    '.ovvrbbrvvo',
    'ovvvrabrvvo',
    'ovvraaabrvo',
    'ovvraaaarvo',
    'orrrrrrrrro',
    'ovvraccarvo',
    'ovvraaaarvo',
    '.ovracarvo.',
    '.ovraaarvo.',
    '.ooooooooo.',
    '...........',
]
BROKER_34 = [
    '...oabo..',
    '..ovaabo.',
    '..ovacbo.',
    '..ovaabo.',
    '..ovacbo.',
    '..ovaabo.',
    '..ovaabo.',
    '.orrrrrro',
    '.ovbaabro',
    'ovvbbabro',
    'ovvbbbbro',
    'ovvbbbbro',
    'oyxxxxxxo',
    'oyyxxxXo.',
    '.oyyyyyo.',
    '...oooo..',
]
BROKER_38 = [
    '...oaaaao..',
    '..ovraarvo.',
    '..ovracrvo.',
    '..ovraarvo.',
    '..ovracrvo.',
    '..ovraarvo.',
    '..ovracrvo.',
    '.orrrrrrrro',
    '.ovbrxxrbvo',
    '.ovbrxxrbvo',
    'ovbrxXxxrbo',
    'ovbrxXxxrbo',
    'ovrxxXxxxro',
    'oyxxxXxxxyo',
    '.oyyxxxyyo.',
    '...ooooo...',
]
BROKER_SKIRT_34 = ['.' * 13] * 20 + [
    '...obbbbbro..',
    '..ocbbaabbro.',
    '..ocbbbaabbro',
    '..occbbbaabro',
    '.ocdccbbbaro.',
    '.ocdcccbbro..',
    '.oddcdccro...',
    '.oddcddcro...',
    'oddddcdro....',
    'oedddcro.....',
    'oeeddcro.....',
    'oeeddro......',
    'orrrrro......',
    '.ooooo.......',
] + ['.' * 13] * 2
BROKER_SKIRT_38 = ['.' * 13] * 18 + [
    '..ovbrrrbvo..',
    '..ovbr.rbvo..',
    '.ovbbr.rbbvo.',
    '.ovbbr.rbbvo.',
    '.ovbr...rbvo.',
    'ovbbr...rbbvo',
    'ovbbr...rbbvo',
    'ovbr.....rbvo',
    'ovbr.....rbvo',
    'ovbr.....rbvo',
    'ovbr.....rbvo',
    'orrr.....rrro',
    '.ooo.....ooo.',
] + ['.' * 13] * 5
# Dark leggings, an indigo line down the outside, a strap round the thigh.
BROKER_53 = [
    '.yxxxy.',
    'yxxxXry',
    'yxxxXry',
    'yxxxXry',
    'yxxxXry',
    '.yxxXry',
    '.yxxXry',
    '.yxxXry',
    '.RrrrRy',
    '..yxXry',
    '..yxXry',
    '..yxXry',
    '..yxXry',
    '..yxxy.',
]
BROKER_62 = [
    '.yxy.',
    'yxxXy',
    'yxxXy',
    'yxXry',
    '.yry.',
]
# The boot's shaft: the angular grey knee guard over the knee, the ribbed grey front, the white
# panel down the outside, dark grey behind; the foot: a white instep, dark grey sides, the grey
# metal toe cap, a flat dark sole.
BROKER_30 = [
    'JHHHJ',
    'JKHHJ',
    '.JPHJ',
    '.JPKJ',
    '.JPHJ',
    '.JPKJ',
    '.JPHJ',
    '.JPKJ',
    '.JPHJ',
    'JpPKJ',
    'JpPHJ',
    'JpPKJ',
]
BROKER_39 = [
    '.JpPHJ.......',
    '.JpPKJ.......',
    '.JpPPPJ......',
    'JppPPPPPJ....',
    'JpppPPPPHHJ..',
    'JpppppppHHHJ.',
    '.gggggggggg..',
    '.............',
    '.............',
]
BROKER_47 = [
    '.JpPHJ.....',
    '.JpPKJ.....',
    '.JpPPPJ....',
    'JppPPPPPJ..',
    'JpppPPPPHHJ',
    'JppppppHHHJ',
    '.ggggggggg.',
    '...........',
    '...........',
]
BROKER_48 = [
    '.JPHJ..',
    '.JPKJ..',
    '.JPPPJ.',
    'JpPPPpJ',
    'JpPPPpJ',
    'JpHHHpJ',
    '.ggggg.',
    '.......',
    '.......',
]
# White sleeves with indigo piping below, the grey ribbed ring at the shoulder; the forearm in a
# grey ribbed bracer to the black glove.
BROKER_5 = [
    '.vuv......',
    'uvuaaaaaaa',
    'uvubbbbbbb',
    'uvurrrrrrr',
    '.uuu......',
]
BROKER_1 = [
    '.vuvuvkk',
    'vuvuvukk',
    '.uvuvukq',
]

# --------------------------------------------------------------------------------------------
# Leather (Mass Effect 3, alternate outfit 3): glossy black leather, a pink-red panel down the
# middle from the collar to the hips and down the front of the legs, the high black collar, a
# silver ribbed bracer on her right forearm, a belt with a silver buckle; long coat tails behind,
# pink-red inside (ribbons); black knee boots with a grey knee plate and a grey toe.
# --------------------------------------------------------------------------------------------
LEATHER_57 = [
    '..ocbbo...',
    '..ocabo...',
    '..ocbbo...',
    '..ooooo...',
    '..ocbarr..',
    '.ocbbarzr.',
    '.ocbbbrzro',
    'ocdbbbrzRo',
    'ocdbbbrrRo',
    'odcbbbrrRo',
    'oddcbbrRRo',
    '.oddcbrRo.',
    '.ooooooo..',
    '..........',
]
LEATHER_61 = [
    '..ocbbbo...',
    '..ocabbo...',
    '..ocbbbo...',
    '..oorroo...',
    '.odbrzrbco.',
    'odcbrzrRabo',
    'odcbrzrRabo',
    'odcbrzrRabo',
    'odcbrrrRbco',
    'oddcrrrRbco',
    'oddcrrRRcco',
    '.oddrrRcdco',
    '.oddrRRcdo.',
    '.ooooooooo.',
    '...........',
]
LEATHER_34 = [
    '...obro..',
    '..ocbrzo.',
    '..ocarzo.',
    '..ocbrzo.',
    '..ocarzo.',
    '..ocbrzo.',
    '..ocbrro.',
    '.okkkkWko',
    '.ocbrzrro',
    'ocdbrzrro',
    'ocdbrzrRo',
    'odcbrrrRo',
    'odcrrrRRo',
    'oddrrRRo.',
    '.oddRRro.',
    '...oooo..',
]
LEATHER_38 = [
    '...odrrbo..',
    '..odcrzbbo.',
    '..odcrzrbo.',
    '..odcrzrao.',
    '..odcrzrao.',
    '..odcrzrbo.',
    '..odcrrrbo.',
    '.okkkWWkkko',
    '.odcrzzrbbo',
    '.odcrzzrbao',
    'oddcrzzrbbo',
    'oddrrzzrrbo',
    'odrrRooRrro',
    'odrRRooRRro',
    '.odRRooRRo.',
    '...oo..oo..',
]
# The legs: pink-red down the front, black leather behind; the knee black.
LEATHER_53 = [
    '.obrro.',
    'ocbrzro',
    'ocbrzRo',
    'ocbrzRo',
    'ocbrzRo',
    '.ocrzRo',
    '.ocrzRo',
    '.ocrzRo',
    '.ocrzRo',
    '..orzRo',
    '..orzRo',
    '..ocrRo',
    '..ocrRo',
    '..ocRRo',
]
LEATHER_62 = [
    '.obo.',
    'ocbao',
    'ocbao',
    'ocbbo',
    '.obo.',
]
LEG_FAR_LEATHER = {'a': 'b', 'b': 'c', 'c': 'd', 'z': 'r', 'r': 'R'}
# Glossy black knee boots: the grey knee plate, a line of gloss down the front, the grey toe.
LEATHER_30 = [
    'JHHHJ',
    'JKHKJ',
    '.JKHJ',
    '.JKHJ',
    '.JKHJ',
    '.JKHJ',
    '.JKJ.',
    '.JKJ.',
    '.JHJ.',
    'JKHJ.',
    'JKHJ.',
    'JKKJ.',
]
LEATHER_39 = [
    '.JKHJ........',
    '.JKHJ........',
    '.JKKHJ.......',
    'JKKKKHJ......',
    'JKKKKKKKHPPJ.',
    'JKKKKKKKKPPPJ',
    '.gggggggggg..',
    '.............',
    '.............',
]
LEATHER_47 = [
    '.JKHJ......',
    '.JKHJ......',
    '.JKKHJ.....',
    'JKKKKHJ....',
    'JKKKKKKHPPJ',
    'JKKKKKKKPPJ',
    '.ggggggggg.',
    '...........',
    '...........',
]
LEATHER_48 = [
    '.JKHJ..',
    '.JKHJ..',
    '.JKHKJ.',
    'JKKHKKJ',
    'JKPPPKJ',
    'JPPPPPJ',
    '.ggggg.',
    '.......',
    '.......',
]
# Black leather sleeves with a line of gloss; her right forearm in the silver ribbed bracer, the
# left plain to the glove.
LEATHER_5 = [
    '.bab......',
    'aaaaaaaaaa',
    'bbbbbbbbbb',
    'cccccccccc',
    '.cdd......',
]
LEATHER_1 = [
    '.aaaabbk',
    'bbbbbbkk',
    '.ccccdkk',
]
LEATHER_1_RIGHT = [
    '.wvwvwvk',
    'vuvuvuvk',
    '.uuuuukk',
]
# The coat tails, two ribbons from the hips behind her: black leather, the pink-red lining at the
# edge, tapering to a point.
LEATHER_TAIL = [
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    'obcRo',
    '.obRo',
    '.obRo',
    '.oRo.',
    '..o..',
]

# --------------------------------------------------------------------------------------------
# Illium (Mass Effect 2, the information broker on Illium): the sleeveless dark green leather
# coat to the knee with its high collar, open over the ivory mesh bodysuit (a deep white V down the
# chest), white sleeves and gloves, ivory legs; dark green heeled knee boots with a buckle.
# --------------------------------------------------------------------------------------------
ILLIUM_57 = [
    '..obbbo...',
    '..ocabo...',
    '..ocbbo...',
    '..ocbbow..',
    '..ocbbwv..',
    '.ocbbbwvo.',
    '.ocbbbwvvo',
    'ocdbbbawvo',
    'ocdbbbbwvo',
    'odcbbbbwvo',
    'oddcbbbavo',
    '.oddcbbbo.',
    '.ooooooo..',
    '..........',
]
ILLIUM_61 = [
    '..obbbbo...',
    '..ocabbo...',
    '..ocbbbo...',
    '..obowvbo..',
    '.ocbwwvbco.',
    'ocbawwvabco',
    'ocbbwvvbbdo',
    'ocbbawvbbdo',
    'ocbbawvbcdo',
    'odcbbwvbcdo',
    'odcbbavbddo',
    '.odcbavcddo',
    '.oddcbbddo.',
    '.ooooooooo.',
    '...........',
]
ILLIUM_34 = [
    '...obwo..',
    '..ocbwvo.',
    '..ocbavo.',
    '..ocbbwo.',
    '..ocbbao.',
    '..ocbbbo.',
    '..ocbbbo.',
    '.ocdbbbbo',
    '.ocdbbbbo',
    'ocddbbbbo',
    'ocddcbbbo',
    'oddcbbbbo',
    'oyxxxxXwo',
    'oyyxxXwo.',
    '.oyyxxwo.',
    '...oooo..',
]
ILLIUM_38 = [
    '...obwvbo..',
    '..ocbwvbco.',
    '..ocbavbco.',
    '..ocbwvbco.',
    '..ocbavbco.',
    '..ocbbbbco.',
    '..ocbbbbco.',
    '.ocdbbbbdco',
    '.ocdbbbbdco',
    '.ocdbobbdco',
    'ocdbowwobdo',
    'ocdowXwwodo',
    'odowxXwwxoo',
    'oyxxxXwxxyo',
    '.oyyxxxyyo.',
    '...ooooo...',
]
ILLIUM_SKIRT_34 = ['.' * 13] * 20 + [
    '...obbbbbbo..',
    '..ocbbbbbbbo.',
    '..ocbbbbbbbo.',
    '..ocbbbbbbbo.',
    '.ocdcbbbbbo..',
    '.ocdcbbbbbo..',
    '.ocddcbbbo...',
    '.oddccbbbo...',
    'ocddccbbo....',
    'ocdddcbbo....',
    'odddccbo.....',
    'oeddcco......',
    'oeedddo......',
    'oeeddo.......',
    'ooooo........',
] + ['.' * 13]
ILLIUM_SKIRT_38 = ['.' * 13] * 20 + [
    '..obbo.obbo..',
    '..ocbo.obco..',
    '.ocbbo.obcdo.',
    '.ocbo...obdo.',
    '.ocbo...obdo.',
    'ocdbo...obddo',
    'ocdbo...obddo',
    'ocdo.....odde',
    'oddo.....oddo',
    'oddo.....oddo',
    'oddo.....odeo',
    'oedo.....oeeo',
    'oeeo.....oeo.',
    '.ooo.....oo..',
    '.............',
] + ['.' * 13]
# Ivory mesh legs, the thigh's light down the front.
ILLIUM_53 = [
    '.yxxxy.',
    'yxxxXwy',
    'yxxxXwy',
    'yxxXxwy',
    'yxxxXwy',
    '.yxxXwy',
    '.yxXxwy',
    '.yxxXwy',
    '.yxxXy.',
    '..yxXy.',
    '..yXxy.',
    '..yxXy.',
    '..yxXy.',
    '..yxxy.',
]
ILLIUM_62 = [
    '.yxy.',
    'yxXwy',
    'yxXwy',
    'yxXxy',
    '.yxy.',
]
LEG_FAR_ILLIUM = {'w': 'X', 'X': 'x', 'x': 'y'}
# Dark green leather knee boots: a buckled strap below the knee, a line of light down the front,
# a raised heel and a thin sole.
ILLIUM_30 = [
    '.JKJ.',
    'JKKHJ',
    'JqqqJ',
    '.JKHJ',
    '.JKHJ',
    '.JKHJ',
    '.JKJ.',
    '.JKJ.',
    '.JHJ.',
    'JKHJ.',
    'JKHJ.',
    'JKKJ.',
]
ILLIUM_39 = [
    '.JKHJ........',
    '.JKHJ........',
    '.JKKHJ.......',
    '.JKKKHHJ.....',
    '.JKKKKKKHHJ..',
    'JKKKKKKKKKKHJ',
    'JgJ...JgggggJ',
    '.............',
    '.............',
]
ILLIUM_47 = [
    '.JKHJ......',
    '.JKHJ......',
    '.JKKHJ.....',
    '.JKKKHHJ...',
    '.JKKKKKKHHJ',
    'JKKKKKKKKKJ',
    'JgJ..JggggJ',
    '...........',
    '...........',
]
ILLIUM_48 = [
    '.JKHJ..',
    '.JKHJ..',
    '.JKHKJ.',
    'JKKHKKJ',
    'JKKHKKJ',
    'JKKKKKJ',
    '.JgggJ.',
    '.......',
    '.......',
]
# Bare of the coat, her arms in the white mesh sleeves; the forearm white to the white glove.
ILLIUM_5 = [
    '.vwv......',
    'vwwwwwwwwv',
    'wvwvvwvvwv',
    'uvuyuvuyuv',
    '.yyy......',
]
ILLIUM_1 = [
    '.vwwwwvw',
    'wvwvvwvv',
    '.yuyuyuy',
]

def check(name, rows):
    w = len(rows[0])
    bad = [(i, len(r)) for i, r in enumerate(rows) if len(r) != w]
    if bad:
        raise ValueError(f'{name}: rows {bad} not {w} wide')
    return rows


def shift(rows, mapping):
    """A picture with its characters shifted (the far limb a tone darker)."""
    return [''.join(mapping.get(c, c) for c in r) for r in rows]


for _n, _v in list(globals().items()):
    if _n.isupper() and isinstance(_v, list) and _v and isinstance(_v[0], str):
        check(_n, _v)
