"""Five's body, drawn upright as text (the look tool turns the pictures): the Samurai jacket of
V, a short leather bomber with the tall stand-up collar glowing in cyan stripes, two leather pucks
on each shoulder, the sleeves pushed to three quarters and closed by black ribbed cuffs (the
forearms bare), the black ribbed hem at the waist, a red light on the back of the shoulder, the
front open on a dark top with a yellow print. Her: black leather moto trousers with quilted knees,
black knee-high wedge boots with a silver trim at the knee. Him: dark jeans, black high-tops with
white laces, a grey toe and an orange glowing line along the sole.

Every picture is text with a legend of semantic characters, drawn round the original part's
centre with a margin each way (its centre stays the part's point; `fit` pads it to the part's
parity, so that it mirrors round the same point)."""
from heads import Pic
from lookgen import shift
from body import part
import fv_heads

# --------------------------------------------------------------------------------------------
# Colours.
# --------------------------------------------------------------------------------------------
JACKET = {'a': '#bca693', 'b': '#99836f', 'c': '#786352', 'd': '#57463b', 'e': '#33271f'}
RIB = {'R': '#45464e', 'r': '#26272d', 'K': '#141418'}
GLOW = {'W': '#eafdff', 'Y': '#90e4fc', 'y': '#53cef7', 'Z': '#1db7ed', 'X': '#15668e'}
TEE = {'T': '#45434e', 't': '#2b2a32'}
PUCK = {'P': '#2c2326', 'p': '#c4b2a2'}
ACCENT = {'!': '#ff3b3b', '*': '#fcee0a', 'v': '#e6eaf2', 'V': '#858a96'}

# Their skins as on the heads (the neck, the arms), without the lit edge `s` of the faces.
HER_SKIN = {k: v for k, v in fv_heads.HER_SKIN.items() if k != 's'}
HIM_SKIN = {k: v for k, v in fv_heads.HIM_SKIN.items() if k != 's'}

# Her black leather trousers and boots (a gloss highlight, cool blacks), the silver trim.
LEATHER = {'L': '#80849a', 'l': '#555869', 'm': '#3b3d4b', 'n': '#272934', 'k': '#0d0d12'}
BOOT = {'G': '#a6aab8', 'g': '#45474f', 'h': '#25262d', 'j': '#16171c'}
SOLE = {'u': '#73747e', 'U': '#3f4048'}
SILVER = {'S': '#f2f4f8', 's': '#b0b5c0', 'q': '#6e7380'}


def pic(rows, legend):
    """A picture from text rows, every character in the legend ('.' clear)."""
    missing = {ch for r in rows for ch in r if ch != '.' and ch not in legend}
    assert not missing, f'characters not in the legend: {missing}'
    return Pic.text(rows, legend)


def fit(pic_, w, h):
    """A picture padded to the parity of the original part's size (w x h), its centre kept: a
    picture odd where the part is even gets a clear column (row) before it, one even where the
    part is odd a clear column (row) after it, so it mirrors round the part's own point."""
    if pic_.w % 2 != w % 2:
        pic_.pad(left=1) if pic_.w % 2 else pic_.pad(right=1)
    if pic_.h % 2 != h % 2:
        pic_.pad(top=1) if pic_.h % 2 else pic_.pad(bottom=1)
    return pic_


# --------------------------------------------------------------------------------------------
# The jacket (both of them wear it; his is drawn a pixel broader).
# --------------------------------------------------------------------------------------------
# The chest in profile (57): the original's 10 x 12 with 2 pixels round it. The collar stands
# behind the neck in stripes of light, low at the throat; the red light on the shoulder's back;
# the front open on the dark top.
HER_57 = [
    '.eY...........',
    'eWYY..........',
    'eZZZr.........',
    'eYWYr.........',
    'eZZZr3223.....',
    'eYWYr3222.....',
    'eZZZr4322ZY...',
    'edYYrr443ZWYe.',
    'eK!KKKrrr3TXbe',
    'edKKcbbbcrTtae',
    'eddccbbbacTtae',
    'eddcccbbbcTtbe',
    'eddcccbbbc*tbe',
    '.eddcccbbcTtbe',
    '.edddccbbcTtce',
    '..eddddcccddd.',
    '...eeeeeeeee..',
    '..............',
    '..............',
    '..............',
]
# The chest turned to us (61): 11 x 13 with 2 pixels each side and 1 above and below. The collar
# glows on both sides of the neck; the jacket open on the dark top and its yellow print.
HER_61 = [
    'eWYZ.......ZYWe',
    'eYZYr1HH2rrYZYe',
    'eZYZr2112rrZYZe',
    'eYWYr3223rrYWYe',
    'edZYrr44rrrYZde',
    'KKdcrrTTTrrcdKK',
    'eKbacvTTTVcbcKe',
    'ebbacVTtTvcbcde',
    'ebbbcvT*tVcbcde',
    'ebbbcVtTtvccdde',
    'ebbccvtttVccdde',
    '.ebccVtttvccde.',
    '.ebcccvtVcccde.',
    '..edddddddddd..',
    '...eeeeeeeee...',
]
# The torso in profile (34) and turned to us (38): the jacket's lower part, its black ribbed hem,
# the belt; her hips in black leather.
HER_34 = [
    '...edccbb..',
    '..eddccbbT.',
    '..eddccbbT.',
    '..eddccbbt.',
    '..eddcccbt.',
    '..KrRrRrRrK',
    '..KrRrRrRrK',
    '..kmmmmmvk.',
    '.knmllLLlk.',
    '.knsllSLlk.',
    'knnmsSlLlk.',
    'knnmmllLlk.',
    'kknnmmlllk.',
    '.kknnmmmk..',
    '..kkknnk...',
    '....kkk....',
]
HER_38 = [
    #0123456789abc
    '...ddcTTtbb..',
    '..eddcTTtbba.',
    '..eddcTtTbba.',
    '..eddcTttbbb.',
    '..eddctttcbb.',
    '..KrRrTttrRrK',
    '..KrRrRtrRrRK',
    '..kmmmmvvmmmk',
    '.knnmlLlmlLlk',
    '.knnmlLlmlLlk',
    'knnmmlLmmlLlk',
    'knnmmllnmmllk',
    'kknnmmlnnmmlk',
    '.kknnmmknnmmk',
    '..kkknnkknnk.',
    '....kkk.kkk..',
]
# The near thigh (53; the far one, 49, a shade darker): slim, black leather, a seam down it.
HER_THIGH = [
    '..kmLk..',
    '.knmLk..',
    '.knmlLk.',
    '.knmlLk.',
    '..knmLk.',
    '..knmLk.',
    '..knmLk.',
    '..knmLk.',
    '..knmLk.',
    '..kmLLk.',
    '..knnmk.',
    '..kmLLk.',
    '..knnmk.',
    '..kknk..',
]
FAR_LEG = {'L': 'l', 'l': 'm', 'm': 'n', 'S': 's', 's': 'q', 'G': 'g', 'g': 'h', 'h': 'j'}
# The quilted moto knee (62).
HER_KNEE = [
    '..qsSq.',
    '.qShhSk',
    '.kjhgGk',
    '.kjhgGk',
    '..kjhk.',
]
# The knee-high boot's leg (30): the silver trim at the knee, two buckled straps at the ankle.
HER_SHIN = [
    '..kjgGk',
    '.kjhgGk',
    '.kjhgGk',
    '.kjhgGk',
    '.kjhhgk',
    '.kjhgGk',
    '.kjhgGk',
    '.ksqSsk',
    'kjhhgk.',
    'ksqSsk.',
    'kjhgGk.',
    'kjhGk..',
]
# The wedge boot's foot (39; 43 the far one; 47 and 48 turned): black, the wedge thick under the
# heel and thin at the toe.
HER_SHOE_39 = [
    '.kjhgGk......',
    '.kjhhgGkkk...',
    'kkjjhhgGGGkk.',
    'UukjjhhhhgGGk',
    'uUUUUUUUUUUUk',
]
HER_SHOE_47 = [
    '.kjhgGk....',
    '.kjhhgGkk..',
    'kkjjhhgGGk.',
    'UukjjhhhgGk',
    'uUUUUUUUUUk',
]
HER_SHOE_48 = [
    '.khGGk.',
    'kjhgGGk',
    'kjhhgGk',
    'UkjjjkU',
    'uUUUUUu',
]
# The upper arm (5; 9 the far one, a shade darker), shoulder on the left: the puffed leather
# sleeve with its two round pucks at the shoulder.
HER_UPPER = [
    '.eeeeeeeeee.',
    'ebabbabbbaae',
    'ePPbPPbbbbae',
    'ePpcPpcbbbbe',
    'edccccccbcce',
    'eddddcccccde',
    '.eeeeeeeeee.',
]
FAR_ARM = {'a': 'b', 'b': 'c', 'c': 'd', 'd': 'e'}
# The forearm (1), elbow on the left: the black ribbed cuff of the sleeve pushed up, the bare arm.
HER_FOREARM = [
    #01234567
    'kRRk....',
    'krRk1HH1',
    'kRrk2112',
    'krRk332.',
    'kRRk....',
]


# --------------------------------------------------------------------------------------------
# Him: the same jacket a pixel broader all round (`broader`), a black tee with the yellow print,
# dark jeans, black high-tops: white laces, a grey toe cap, the sole a line of orange light.
# --------------------------------------------------------------------------------------------
HIM_TEE = {'T': '#2c2c34', 't': '#1a1a20'}
JEANS = {'L': '#7a84a0', 'l': '#555d78', 'm': '#3e4560', 'n': '#2c3146', 'k': '#0f1018'}
HIGHTOP = {'G': '#6a6c78', 'g': '#40414a', 'h': '#27282f', 'j': '#16161b'}
HIGHTOP_TRIM = {'w': '#eeece6', 'Q': '#b4b2b6', 'x': '#6a686e', 'O': '#ffbe52', 'z': '#f08c10', 'f': '#a6572a'}


def broader(rows, cols):
    """Rows with the given columns doubled (a pixel broader there, outline and all)."""
    out = []
    for r in rows:
        s = ''
        for i, ch in enumerate(r):
            s += ch * (2 if i in cols else 1)
        out.append(s)
    return out


HIM_34 = [
    #0123456789ab
    '...eddccbb..',
    '..edddccbbT.',
    '..edddccbbT.',
    '..edddccbbt.',
    '..edddcccbt.',
    '..KrRrRrRrRK',
    '..KrRrRrRrRK',
    '..kkmmmmmvk.',
    '.knmmllLLlk.',
    '.knmmllLLlk.',
    'knnmmmllLlk.',
    'knnmmmllLlk.',
    'kknnmmmlllk.',
    '.kknnmmmmk..',
    '..kkknnnk...',
    '....kkkk....',
]
HIM_38 = [
    #0123456789abcd
    '...dddcTTtbb..',
    '..edddcTTtbba.',
    '..edddcTtTbba.',
    '..edddcTttbbb.',
    '..edddctttcbb.',
    '..KrRrRTttrRrK',
    '..KrRrRrtrRrRK',
    '..kmmmmmvvmmmk',
    '.knnmlLlnmlLlk',
    '.knnmlLlnmlLlk',
    'knnmmlLmnmmlLk',
    'knnmmllnnmmllk',
    'kknnmmlnknnmlk',
    '.kknnmmkknnmmk',
    '..kkknnkkknnk.',
    '....kkk..kkk..',
]
HIM_THIGH = [
    #01234567
    '.knmlLk.',
    '.knmlLLk',
    'knnmlLLk',
    'knnmlLLk',
    '.knmmlLk',
    '.knmmlLk',
    '.knmmlLk',
    '..knmlLk',
    '..knmlLk',
    '..knmlLk',
    '..knmlLk',
    '..knmlLk',
    '..knmlLk',
    '..kknnk.',
]
HIM_KNEE = [
    '.kmLk.',
    'knmlLk',
    'knmlLk',
    'knmlLk',
    '.knmk.',
]
HIM_SHIN = [
    #0123456
    '..knmLk',
    '.knmlLk',
    '.knmlLk',
    '.knmlLk',
    '.knmlLk',
    '.knmlLk',
    '.knmlLk',
    'knmlLk.',
    'knmlLk.',
    'knmlLk.',
    'knmlLLk',
    'kknnmLk',
]
# The high-top (39; 43 the far one; 47 and 48 turned): heel on the left.
HIM_SHOE_39 = [
    #0123456789abc
    '.kjhk........',
    '.kjhhkwk.....',
    'kjjhhgwhwkk..',
    'kjjjhhhhgxQQk',
    'kfzOOOOOOOOzk',
]
HIM_SHOE_47 = [
    '.kjhk......',
    '.kjhhkwk...',
    'kjjhhgwhwk.',
    'kjjjhhhgxQk',
    'kfzOOOOOOzk',
]
HIM_SHOE_48 = [
    '.khwhk.',
    'kjhwhgk',
    'kjwhwgk',
    'kxQQQxk',
    'zOOOOOz',
]
HIM_FAR_SHOE = {'G': 'g', 'g': 'h', 'h': 'j', 'w': 'Q', 'Q': 'x', 'O': 'z', 'z': 'f'}
HIM_UPPER = [
    '.eeeeeeeeee.',
    'ebabbabbbaae',
    'ePPPbPPPbbae',
    'ePPpbPPpcbae',
    'ebccbcccbbae',
    'edccccccbcce',
    'eddccccccdde',
    'edddddcccdde',
    '.eeeeeeeeee.',
]
HIM_FOREARM = [
    #01234567
    'kRRk....',
    'krRk1HH1',
    'kRrk2112',
    'kRrk2212',
    'krRk332.',
    'kRRk....',
    '........',
]


def merged(*legends):
    """One legend from several, none of them reusing another's characters."""
    out = {}
    for lg in legends:
        clash = set(out) & set(lg)
        assert not clash, f'legend characters used twice: {clash}'
        out.update(lg)
    return out


def legend(who):
    if who == 'her':
        return merged(JACKET, RIB, GLOW, TEE, PUCK, ACCENT, HER_SKIN, LEATHER, BOOT, SOLE, SILVER)
    return merged(JACKET, RIB, GLOW, HIM_TEE, PUCK, ACCENT, HIM_SKIN, JEANS, HIGHTOP, HIGHTOP_TRIM)


def pictures(who='her'):
    """{key: Pic} of every upright picture drawn here for her or him, each of the parity of the
    original part's size."""
    return fitted(1 if who == 'him' else 0, _pictures(who))


def fitted(base, pics):
    """The pictures, each padded to the parity of the original part's size."""
    return {k: fit(p, *_size(base, int(k))) for k, p in pics.items()}


def _size(base, id_):
    p = part(base, id_)
    return p.w, p.h


def _pictures(who):
    leg = legend(who)
    if who == 'him':
        # A pixel broader than her: the chest at the back and the front, the hips.
        return {
            '57': pic(broader(HER_57, {6, 8}), leg), '61': pic(broader(HER_61, {2, 12}), leg),
            '34': pic(HIM_34, leg), '38': pic(HIM_38, leg),
            '53': pic(HIM_THIGH, leg), '49': pic(shift(HIM_THIGH, FAR_LEG), leg), '62': pic(HIM_KNEE, leg),
            '30': pic(HIM_SHIN, leg),
            '39': pic(HIM_SHOE_39, leg), '43': pic(shift(HIM_SHOE_39, HIM_FAR_SHOE), leg),
            '47': pic(HIM_SHOE_47, leg), '48': pic(HIM_SHOE_48, leg),
            '5': pic(HIM_UPPER, leg), '9': pic(shift(HIM_UPPER, FAR_ARM), leg),
            '1': pic(HIM_FOREARM, leg),
        }
    return {
        '57': pic(HER_57, leg), '61': pic(HER_61, leg), '34': pic(HER_34, leg), '38': pic(HER_38, leg),
        '53': pic(HER_THIGH, leg), '49': pic(shift(HER_THIGH, FAR_LEG), leg), '62': pic(HER_KNEE, leg),
        '30': pic(HER_SHIN, leg),
        '39': pic(HER_SHOE_39, leg), '43': pic(shift(HER_SHOE_39, FAR_LEG), leg),
        '47': pic(HER_SHOE_47, leg), '48': pic(HER_SHOE_48, leg),
        '5': pic(HER_UPPER, leg), '9': pic(shift(HER_UPPER, FAR_ARM), leg),
        '1': pic(HER_FOREARM, leg),
    }
