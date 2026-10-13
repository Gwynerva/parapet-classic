"""Her body pictures (Petra's four looks), drawn as text pixel art, upright; the look tool turns them.

Slender on Blaise's body. In profile the front is on the right and lit; turned to us the near
side (left) is lit; the legs' upright pictures are lit on their left, like the originals'.
Shared characters: her skin n N M q Q (highlight -> deep shade) on the neck and the legs; each
look adds its own (cloth a..e light -> dark, trims, metals)."""

# Her skin (the head's tones): highlight, light, mid, shade, deep shade.
SKIN5 = ['#fbe6d6', '#f3cdb4', '#e2aa8e', '#bf7f68', '#8e5446']
SKIN_LEG = dict(zip('nNMqQ', SKIN5))


def shift(rows, mapping):
    """The same picture with characters swapped (a far limb a tone darker)."""
    return [''.join(mapping.get(c, c) for c in r) for r in rows]


def pad(rows, top=0, bottom=0, left=0, right=0):
    w = len(rows[0]) + left + right
    return ['.' * w] * top + ['.' * left + r + '.' * right for r in rows] + ['.' * w] * bottom


def check(rows, w=None):
    w = w or len(rows[0])
    assert all(len(r) == w for r in rows), [(i, len(r), r) for i, r in enumerate(rows) if len(r) != w]
    return rows


# =========================================================================================
# kate: the white shirt buttoned to the top under a long thin black-navy cardigan, open; the
# silver cross on its chain; the light grey pencil skirt above the knee; bare legs, white ankle
# socks, white mid-top sneakers on a thick sole; the green wristband.
# =========================================================================================
KATE = {
    **dict(zip('abcde', ['#4a4c66', '#34364e', '#25273a', '#1a1b2a', '#0f0f18'])),
    'o': '#f8f8fa', 'O': '#dcdee6', 'u': '#b0b4c4',
    'x': '#eef0f6', 'X': '#9096a8',
    **dict(zip('GJjHZ', ['#d2d4da', '#b8bac2', '#9c9ea8', '#7e808a', '#5e606a'])),
    **SKIN_LEG,
}

KATE_57 = check([
    '....MNN.....',
    '...MNnnN....',
    '..bcMNnNoO..',
    '.bbcoMNooOo.',
    'abbbcooXoOu.',
    'abbbbcooXoo.',
    'abbbbbcoxXxo',
    'abbbbbcooXoo',
    'bbbbbbbcooOO',
    'bbbbbbbcooOu',
    'cbbbbbbcoOOu',
    '.cbbbbbcoOuu',
    '.cccbbbcOuu.',
    '..dddddddd..',
])
KATE_61 = check([
    '....MNNM.....',
    '...MNnnNM....',
    '..bcoNnNocb..',
    '.bbcooNoocbb.',
    'abbcoXoXocbbc',
    'abbcooXoocbcc',
    'abbcoxXxocbcc',
    'abbcooXoocccd',
    'bbbcoooOOccdd',
    'bbbcooOOOccdd',
    'bbbcoooOucddd',
    '.bbcooOOuccd.',
    '.bbcoOOuuccd.',
    '.cccOOuuucdd.',
    '..ddddddddd..',
])
KATE_34 = check([
    '...bbbbbco.',
    '..cbbbbbcoo',
    '..cbbbbbcoO',
    '..cbbbbbcoO',
    '..cbbbbbcOu',
    '..ccbbbbcOu',
    '..ccbbbbcuu',
    '..ccbbbbcGJ',
    '..ccbbbbcGJ',
    '.cccbbbbcGJ',
    '.dcccbbbcGJ',
    '.ddddddcJGJ',
    '..HjjjJJJGJ',
    '..HjjjJJJJ.',
    '...HjjjJJ..',
    '....HHHH...',
])
KATE_38 = check([
    '...bbcoOcbb..',
    '..bbbcoOcbbc.',
    '..bbbcoOOcbc.',
    '..bbbcoOucbc.',
    '..bbbcOOucccc',
    '..bbbcOuucccc',
    '..bbbcuuucccd',
    '..bbbcGJJcccd',
    '..bbbcGJjcccd',
    '.bbbbcGJjccdd',
    '.bbbbcGJjjcdd',
    '.ccccGGJjjddd',
    '..GGGJJJjjH..',
    '..GGJJJjjjH..',
    '..GJJJjjHH...',
    '...HHHHHH....',
])
# The pencil skirt over the thighs (hips layer), 13 x 32 centred like the torso: torso row r is row
# r + 8 here, column c is c + 1. To just above the knee, the cardigan's hem over it at the hips.
KATE_SKIRT_34 = check(['.' * 13] * 17 + [
    '..dcccbbbcGJ.',
    '..dddddddJGJ.',
    '..HjjjJJJJGJ.',
    '..HjjjJJJJGJ.',
    '.HjjjjJJJJGJ.',
    '.HjjjjJJJJGJ.',
    '.HjjjjJJJGGJ.',
    '.HjjjJJJJGJ..',
    '.HjjjJJJJGJ..',
    '..HjjJJJJGJ..',
    '..HjjjJJJJJ..',
    '..ZHHHjjjJH..',
    '...ZZZZZZZ...',
] + ['.' * 13] * 2)
KATE_SKIRT_38 = check(['.' * 15] * 17 + [
    '..dcccGJjjcdd..',
    '..dddGGJjjjdd..',
    '...GGGJJjjjH...',
    '..GGGJJJjjjjH..',
    '..GGGJJJjjjjH..',
    '..GGJJJJjjjjH..',
    '..GGJJJjjjjHH..',
    '..GGJJJjjjjH...',
    '..GJJJJjjjjH...',
    '..GJJJjjjjHH...',
    '..GJJJjjjjHH...',
    '..HJJjjjjHHZ...',
    '...ZZZZZZZZ....',
] + ['.' * 15] * 2)

# Bare legs (light on the picture's left), the white ankle sock at the bottom of the shin.
LEG_THIGH = check([
    '.NNNNM.',
    'nNNNMMq',
    'nNNNMMq',
    'nNNNMMq',
    'nNNNMqq',
    '.nNNMMq',
    '.nNNMMq',
    '.nNNMq.',
    '.nNNMq.',
    '..nNMq.',
    '..nNMq.',
    '..nNMq.',
    '..nNMq.',
    '..NMMq.',
])
LEG_KNEE = check([
    '.nNM.',
    'nNNMq',
    'nNnMq',
    'NNMMq',
    '.MMq.',
])
KATE_SHIN = check([
    '..NN.',
    '.nNMq',
    '.nNMq',
    '.nNMq',
    '.nNMq',
    '.nNM.',
    '.nNM.',
    '.nMq.',
    '.NMq.',
    'xxxX.',
    'xxXX.',
    'xXX..',
])
LEG_FAR = {'n': 'N', 'N': 'M', 'M': 'q', 'q': 'Q', 'G': 'J', 'J': 'j', 'j': 'H', 'H': 'Z'}

# White mid-top sneakers: the toe to the right, the collar up over the ankle, a thick white sole
# with a grey line, light grey laces; a soft dark grey outline. Two rows taller than the
# original sneakers, two padding rows under them.
SNEAKER = {'k': '#4a4c58', 'W': '#ffffff', 'w': '#e8e8ec', 'v': '#c8cad2', 'V': '#a2a6b2',
           'l': '#b4b8c4', 's': '#f0eee8', 'S': '#cfccc4'}
SNEAKER_39 = check([
    '.kkkk........',
    'kWwwvk.......',
    'kWwwvlk......',
    'kwWwvllkk....',
    'kwWWwlllWWk..',
    'kvwWWWWWWWWk.',
    'ksssssssssssk',
    'kSSSSSSSSSSSk',
    '.kkkkkkkkkkk.',
    '.............',
    '.............',
])
SNEAKER_47 = check([
    '.kkkk......',
    'kWwwvk.....',
    'kwWwvlkk...',
    'kvwWwllWWk.',
    'ksssssssssk',
    'kSSSSSSSSSk',
    '.kkkkkkkkk.',
    '...........',
    '...........',
])
SNEAKER_48 = check([
    '.kkkkk.',
    'kWwlwvk',
    'kWlllvk',
    'kwWWWvk',
    'ksssssk',
    'kSSSSSk',
    '.kkkkk.',
    '.......',
    '.......',
])
SNEAKER_FAR = {'W': 'w', 'w': 'v', 'v': 'V', 's': 'S'}

# The ornate longsword, the same as her brother's (the swordsman's, pr_him_props.py, copied): on
# the back (on the chest 57, '+' the chest's point), the round silver pommel and the carved guard
# over the shoulder behind the head, the black scabbard down the back, its silver chape past the hips.
SWORDS = {'X': '#f2f5fa', 'x': '#bcc4d0', 'y': '#808a9a', 'Y': '#4c5462', 'Z': '#16161c', 'z': '#3a3a46'}
LONGSWORD = check([
    '................',
    '................',
    '..xX............',
    '..Yx............',
    '...yx...........',
    '...Yy...........',
    '...yx...........',
    'x...Yy.x........',
    'yxXxXxXy........',
    '.Y..Xx..Y.......',
    '....Zz..........',
    '....Zz..........',
    '....Zz..........',
    '....Zz..........',
    '.....Zz.......+.',
    '.....Zz.........',
    '.....Zz.........',
    '.....Zz.........',
    '.....Zz.........',
    '.....Zz.........',
    '.....Zz.........',
    '.....Zz.........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......Zz........',
    '......xX........',
    '......yx........',
    '.......Y........',
])


# =========================================================================================
# mechanic: the workwear suit. A taupe-grey jacket with a light grey yoke over the shoulders, a
# grey-green reflective band across the chest over a thin red piping, a flapped chest pocket with
# a small blue label, a zip, red tabs at the cuffs and the waist, the beige tee in the neck;
# roomy trousers of the same cloth with worn light knee-pad pockets and their red tabs, a
# reflective band at the shin; heavy black work boots on thick lugged soles, dusty.
# =========================================================================================
MECH = {
    **dict(zip('abcde', ['#8a847e', '#706a65', '#5a5450', '#45403d', '#2e2a28'])),
    'f': '#c8c4bc', 'F': '#aaa59e', 'g': '#8a8580',
    'v': '#c4d4bc', 'V': '#98aa94',
    'r': '#f04634', 'R': '#b42c22',
    'B': '#2e66c8', 'z': '#c8c4bc',
    't': '#d2be9a', 'T': '#ac9874',
    'p': '#b4ada2', 'P': '#958e84', 'o': '#d6d8d2', 'O': '#b0b4ac',
    **SKIN_LEG,
}
MECH_57 = check([
    '....MNN.....',
    '...MNnnN....',
    '..fFcNnNc...',
    '.fFFFcttTc..',
    'fFFFFFctTcb.',
    'ffFFFFFccbbb',
    'gggFFbbbbaab',
    'vvvvvvvvvvvv',
    'VVVVVVVVVVVV',
    'rrrrrrrrrrrr',
    'cbbbbbbcBczb',
    'ccbbbbbbbbzb',
    '.cccbbbbbbzc',
    '..ddddddddd.',
])
MECH_61 = check([
    '....MNNM.....',
    '...MNnnNM....',
    '..ffcNnNcff..',
    '.fffFctTcFfg.',
    'ffFFFcTTcFFgg',
    'fFFFFcczcFFFg',
    'ffFFgbczbgFgg',
    'vvvvvvczvvvVV',
    'VVVVVVczVVVVV',
    'rrrrrrczrrrRR',
    'bbBbbbczbbbcc',
    'bbbbbbczbbbcd',
    '.bbbbbczbbccd',
    '.cbbbbczbcccd',
    '..dddddzdddd.',
])
MECH_34 = check([
    '...bbbbbbzb',
    '..cbbbbbbzb',
    '..cbbbbbbzb',
    '..cbbbbbbzb',
    '..ccbbbbbzb',
    '..ccbbbbbzb',
    '..ccbbbbbzb',
    '..cccbbbbzb',
    '..dccccccrd',
    '..edddddRrd',
    '.dcbbbbbbbb',
    '.dcbbbbbbbb',
    'ddccbbbbbbb',
    'ddcccbbbbbc',
    '.dddcccccd.',
    '..ddddddd..',
])
MECH_38 = check([
    '...bbbbzbbb..',
    '..bbbbbzbbbc.',
    '..bbbbbzbbbc.',
    '..bbbbbzbbcc.',
    '..bbbbbzbbcc.',
    '..bbbbbzbccc.',
    '..bbbbbzbccc.',
    '..cbbbbzbccd.',
    '..ddcccccddd.',
    '..eddrRdddde.',
    '.bbbbbcbbbccc',
    '.bbbbbcbbbccc',
    'bbbbbbcbbbccd',
    'bbbbbccbbbccd',
    '.cccc..ccccd.',
    '..ddd...ddd..',
])
# Roomy work trousers: the thigh a pixel wider than her bare one, the worn knee-pad pocket over
# the bottom of it with its red tab, the knee in the pad, the shin to the boot with the
# reflective band.
MECH_THIGH = check([
    '.abbbbc.',
    'aabbbbcc',
    'aabbbbcc',
    'aabbbbcc',
    'aabbbbcd',
    '.abbbbcd',
    '.abbbbcd',
    '.abbbccd',
    '.rpppPPd',
    '.ppppPPd',
    '.ppppPPd',
    '..pppPPd',
    '..pppPP.',
    '..pPPPP.',
])
MECH_KNEE = check([
    '.ppP..',
    'ppppP.',
    'ppppPP',
    'pppPPd',
    '.PPPd.',
])
MECH_SHIN = check([
    '..bbc.',
    '.abbcd',
    '.abbcd',
    '.abbcd',
    '.ooOOd',
    '.abbcd',
    '.abbcd',
    '.abbc.',
    'aabbcc',
    'abbccd',
    'ddddd.',
    '......',
])
MECH_FAR = {'a': 'b', 'b': 'c', 'c': 'd', 'd': 'e', 'p': 'P', 'P': 'c', 'o': 'O', 'O': 'c', 'r': 'R'}

# Heavy black work boots: high over the ankle, a padded collar, a rounded toe cap, laces, a thick
# lugged sole; dust on the toe and the sole's edge.
BOOT = {'k': '#0e0e10', 'K': '#1e1e22', 'g': '#2c2c32', 'G': '#44444c', 'u': '#6a665e', 'U': '#4e4b46',
        'l': '#3a3a42', 's': '#1a1a1c', 'S': '#36363a'}
BOOT_39 = check([
    '.kkkkk.......',
    'kGgKKk.......',
    'kgKlKk.......',
    'kgKKlkk......',
    'kgKlKlKkk....',
    'kgKKKKKgGGk..',
    'kKKKKKKKKgGk.',
    'kuSSSSSSSSuuk',
    'ksSsSsSsSsSsk',
    '.kkkkkkkkkkk.',
    '.............',
])
BOOT_47 = check([
    '.kkkkk.....',
    'kGgKlkk....',
    'kgKlKlkkk..',
    'kKKKKKgGGk.',
    'kuSSSSSSuuk',
    'ksSsSsSsSsk',
    '.kkkkkkkkk.',
    '...........',
    '...........',
])
BOOT_48 = check([
    '.kkkkk.',
    'kKlllKk',
    'kKgGgKk',
    'kgGGGgk',
    'kuSSSuk',
    'ksSsSsk',
    '.kkkkk.',
    '.......',
    '.......',
])
BOOT_FAR = {'G': 'g', 'g': 'K', 'u': 'U', 'l': 'K'}


# =========================================================================================
# birthday: the black fitted long-sleeved mock-neck mini dress, black opaque over-the-knee
# stockings with three thin sheer stripes in their top band over thin black tights, black
# patent loafers with a silver bit on a chunky sole.
# =========================================================================================
BDAY = {
    **dict(zip('abcde', ['#4c4c58', '#36363f', '#26262d', '#19191f', '#0c0c10'])),
    # the sheer tights over her skin, the opaque stocking, its stripes
    **dict(zip('nNMqQ', ['#6e5652', '#57423f', '#42322f', '#2e2222', '#1e1616'])),
    **dict(zip('GJjHZ', ['#34343c', '#24242a', '#18181d', '#101014', '#08080a'])),
}
BDAY_57 = check([
    '....dccd....',
    '....dbcd....',
    '....dbcd....',
    '...dcbbcd...',
    '..dccbbbad..',
    '.dccccbbbad.',
    'dcccccbbaabd',
    'dccccccbaaad',
    'dccccccbbabd',
    'dcccccccbbbd',
    '.dcccccccbd.',
    '.ddcccccccd.',
    '..ddddddddd.',
    '...eeeeeee..',
])
BDAY_61 = check([
    '....dccd.....',
    '....dbcd.....',
    '....dbcd.....',
    '..ddcbbcdd...',
    '.dccbbbbccd..',
    'dcbbaabbbccd.',
    'dcbaaabbaacd.',
    'dcbbabbaaacd.',
    'dccbbbbbabcdd',
    'dcccbbbbbccdd',
    '.dccccbbcccd.',
    '.dccccccccdd.',
    '..ddddddddd..',
    '...eeeeeee...',
    '.............',
])
BDAY_34 = check([
    '...dcbb..',
    '..dccbba.',
    '..dccbba.',
    '..dcccbb.',
    '...dccbd.',
    '...dccbd.',
    '..dcccbd.',
    '..dcccbbd',
    '.dccccbbd',
    '.dcccccbb',
    'dccccccbb',
    'dcccccccb',
    'ddccccccd',
    'ddddcccdd',
    '.eedddde.',
    '...eeee..',
])
BDAY_38 = check([
    '...dcbbbb..',
    '..dccbbbba.',
    '..dcccbbba.',
    '..ddccbbbd.',
    '...dccbbbd.',
    '...dccbbbd.',
    '..dcccbbbd.',
    '..dcccbbbbd',
    '.dccccbbbbd',
    '.dcccccbbbd',
    'dccccccbbbd',
    'dcccccccbbd',
    'ddccccccccd',
    'dddcccccddd',
    '.eedddddde.',
    '...eeeeee..',
])
# The dress's short skirt (hips layer): fitted, to mid-thigh, a soft sheen on the hip.
BDAY_SKIRT_34 = check(['.' * 13] * 17 + [
    '..dccccccbbd.',
    '.dccccccccbd.',
    '.dcccccccbbd.',
    '.dccccccccbd.',
    '.dcccccccbbd.',
    '.dccccccccbd.',
    '..dccccccbd..',
    '..edddddddd..',
    '...eeeeeee...',
] + ['.' * 13] * 6)
BDAY_SKIRT_38 = check(['.' * 15] * 17 + [
    '...dcccccbbd...',
    '..dcccccccbbd..',
    '..dccccccbbbd..',
    '..dcccccccbbd..',
    '..dccccccbbbd..',
    '..dcccccccbbd..',
    '..dccccccccbd..',
    '..edddddddddd..',
    '...eeeeeeeee...',
] + ['.' * 15] * 6)
# Thin black tights over the thigh, then the stocking's top band (three sheer stripes) and the
# opaque stocking down over the knee and the shin.
BDAY_THIGH = check([
    '.NNNNM.',
    'nNNNMMq',
    'nNNNMMq',
    'nNNNMMq',
    'nNNNMqq',
    '.nNNMMq',
    '.nNNMMq',
    '.JJJjjH',
    '.nNNMq.',
    '.JJJjH.',
    '..NNMq.',
    '..JJjH.',
    '..GJjH.',
    '..GJjH.',
])
BDAY_KNEE = check([
    '.GJj.',
    'GJJjH',
    'GJGjH',
    'JJjjH',
    '.jjH.',
])
BDAY_SHIN = check([
    '..JJ.',
    '.GJjH',
    '.GJjH',
    '.GJjH',
    '.GJjH',
    '.GJj.',
    '.GJj.',
    '.GJj.',
    '.GJH.',
    'GJjH.',
    'GJjH.',
    'JjH..',
])
BDAY_FAR = {'n': 'N', 'N': 'M', 'M': 'q', 'q': 'Q', 'G': 'J', 'J': 'j', 'j': 'H', 'H': 'Z'}

# Black patent loafers: low over the instep, the silver bit across it, a chunky sole; patent
# shine on the toe.
LOAFER = {'k': '#060608', 'K': '#18181c', 'g': '#2a2a32', 'G': '#5a5a68', 'W': '#c8ccd8', 'i': '#e4e8f0',
          'I': '#9aa0ae', 's': '#26262a', 'S': '#3c3c42', 'J': '#24242a', 'j': '#18181d', 'H': '#101014'}
LOAFER_39 = check([
    '.............',
    '.............',
    '.JJjH........',
    '.JJjjH.......',
    'kkJjjkkk.....',
    'kgKKKiIKkk...',
    'kgKKKKKKgGWk.',
    'kSSSSSSSSSSSk',
    '.kkkkkkkkkkk.',
    '.............',
    '.............',
])
LOAFER_47 = check([
    '...........',
    '.JjH.......',
    'kkJkkkk....',
    'kgKiIKgWk..',
    'kSSSSSSSSk.',
    '.kkkkkkkk..',
    '...........',
])
LOAFER_48 = check([
    '.......',
    '.JJjH..',
    'kkJjkk.',
    'kKiIKk.',
    'kgGWgk.',
    'kSSSSk.',
    '.kkkk..',
])
LOAFER_FAR = {'G': 'g', 'g': 'K', 'W': 'G', 'i': 'I', 'J': 'j', 'j': 'H'}


# =========================================================================================
# evening: a burgundy satin dress, its V neckline edged with gold, a gold belt, cap sleeves, a
# knee-length A-line skirt with a slit; dark sheer tights; burgundy suede pumps with a gold heel
# and an ankle strap; a gold bangle and a pendant.
# =========================================================================================
EVE = {
    **dict(zip('abcde', ['#c85466', '#a03246', '#7e2034', '#5a1424', '#380a14'])),
    'y': '#f6d27a', 'Y': '#c89432',
    **dict(zip('nNMqQ', ['#7a5450', '#5e403e', '#48302f', '#342222', '#241616'])),
    **dict(zip('GJjHZ', ['#7a5450', '#5e403e', '#48302f', '#342222', '#241616'])),
    **{k: v for k, v in zip('WSstT', ['#fbe6d6', '#f3cdb4', '#e2aa8e', '#bf7f68', '#8e5446'])},
}
EVE_57 = check([
    '....tsS.....',
    '...tsSSs....',
    '..bbtsSSb...',
    '.bbbbtSSyb..',
    'cbbbbbysSya.',
    'cbbbbbbysya.',
    'cbbbbbbbyaab',
    'cbbbbbbbaaab',
    'ccbbbbbbbaab',
    'ccbbbbbbbbab',
    '.ccbbbbbbbbb',
    '.cccbbbbbbbc',
    '.ccccbbbbbc.',
    '..ddddddddd.',
])
EVE_61 = check([
    '....tsSs.....',
    '...tsSSSs....',
    '..bbtSSsbb...',
    '.bbbySSSybb..',
    'abbbbySsybbbc',
    'abbbbyYybbbcc',
    'abbbbbyabbbcc',
    'aabbbbbbbbccd',
    'abbbbbbbbbccd',
    'bbbbbbbbbbcdd',
    '.bbbbbbbbccd.',
    '.bbbbbbbbccd.',
    '.cbbbbbbcccd.',
    '..cccccccdd..',
    '...ddddddd...',
])
EVE_34 = check([
    '...bbbbbba.',
    '..cbbbbbbab',
    '..cbbbbbbab',
    '..ccbbbbbbb',
    '..ccbbbbbbb',
    '..cccbbbbbb',
    '..yyyyyyyyy',
    '..YYYYYYYYy',
    '.ccbbbbbbab',
    '.ccbbbbbbab',
    'cccbbbbbbbb',
    'cccbbbbbbbb',
    'ccccbbbbbbb',
    'dcccbbbbbbc',
    '.ddcccccccd',
    '..ddddddd..',
])
EVE_38 = check([
    '...bbbbbbb...',
    '..bbbbbbbbc..',
    '..bbbbbbbbc..',
    '..abbbbbbcc..',
    '..abbbbbbcc..',
    '..abbbbbccc..',
    '..yyyyYyyyy..',
    '..YYYYyYYYY..',
    '.abbbbbbbbcc.',
    '.abbbbbbbbcc.',
    'aabbbbbbbbccd',
    'abbbbbbbbbccd',
    'abbbbbbbbcccd',
    'bbbbbbbbbccdd',
    '.bccccccccdd.',
    '..ddddddddd..',
])
# The skirt (hips layer): A-line to the knee, flaring, the slit at the front, a satin sheen, a
# gold-edged hem; 13 x 40 / 17 x 40, centred like the torso (torso row r is row r + 12 here).
EVE_SKIRT_34 = check(['.' * 15] * 21 + [
    '...ccbbbbbbab..',
    '..cccbbbbbbab..',
    '..cccbbbbbbbab.',
    '.ccccbbbbbbbab.',
    '.ccccbbbbbbbbab',
    '.ccccbbbbbbbbab',
    'cccccbbbbbbbbab',
    'ccccbbbbbbbbb.b',
    'ccccbbbbbbbbb.b',
    'dccccbbbbbbbb.b',
    'dcccccbbbbbbbd.',
    'dddcccccbbbbd..',
    'dYYYYYYYYYYYd..',
    '.ddddddddddd...',
] + ['.' * 15] * 5)
EVE_SKIRT_38 = check(['.' * 17] * 21 + [
    '...abbbbbbbbcc...',
    '...abbbbcbbbccc..',
    '..aabbbbcbbbccc..',
    '..abbbbbcbbbcccd.',
    '..abbbbcbbbbcccd.',
    '.aabbbbcbbbbccccd',
    '.abbbbbcbbbcbcccd',
    '.abbbbcbbbbcbcccd',
    'aabbbbcbbbbcbcccd',
    'abbbbbcbbbbcbccdd',
    'abbbbcbbbbbcbccdd',
    'abbbbcbbbbbcbcddd',
    'YYYYYYYYYYYYYYYYd',
    '.ddddddddddddddd.',
] + ['.' * 17] * 5)
# Dark sheer tights on her legs (the skin's shape in the tights' tones).
EVE_SHIN = check([
    '..NN.',
    '.nNMq',
    '.nNMq',
    '.nNMq',
    '.nNMq',
    '.nNM.',
    '.nNM.',
    '.nMq.',
    '.NMq.',
    'nNMq.',
    'nNMq.',
    'NMq..',
])
# Burgundy suede pumps: a pointed toe, the gold heel, the thin strap round the ankle in gold.
PUMP = {'k': '#24060c', 'r': '#a8344a', 'R': '#7e1e30', 'q': '#5a1020', 'y': '#f6d27a', 'Y': '#b88a2a',
        'n': '#5e403e', 'N': '#48302f', 'M': '#342222'}
PUMP_39 = check([
    '.............',
    '.............',
    '.nNM.........',
    '.yYyY........',
    '.nNMq........',
    'kRrrRk.......',
    'kqRrrrRkk....',
    'y.kqRrrrrRk..',
    'Y...kkkkkkkk.',
    '.............',
    '.............',
])
PUMP_47 = check([
    '...........',
    '.nNM.......',
    '.yYyY......',
    'kRrrRkk....',
    'kqRrrrrRk..',
    'y.kkkkkkkk.',
    'Y..........',
])
PUMP_48 = check([
    '.......',
    '.nNMq..',
    '.yYyY..',
    'kRrrRk.',
    'kRrrRk.',
    '.kqqk..',
    '.......',
])
PUMP_FAR = {'r': 'R', 'R': 'q', 'y': 'Y', 'n': 'N', 'N': 'M'}

# The belt's bow at the back and its two satin tails (ribbons from the hips): burgundy, gold-edged.
EVE_SASH = ['+.', 'yb', 'ab', 'ab', 'ab', 'bc', 'bc', 'bc', 'bc', 'cd', 'cd', 'cd', 'yY']
EVE_SASH_END = ['+', 'a', 'b', 'b', 'b', 'c', 'c', 'c', 'd', 'y']
