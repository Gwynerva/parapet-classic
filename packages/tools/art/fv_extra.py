"""Five's other two outfits, drawn upright as text like fv_parts.py (the look tool turns them):

* Street Kid (her, the lifepath's V): the hot pink undercut, a cream crop top with pink sleeves and
  a dark X across it, the bare midriff, a maroon belt, metallic gold trousers with black snakeskin
  panels and maroon straps over the thighs, chunky white platform slip-ons on ribbed lilac soles.
* Edgerunner (him in David's jacket): the yellow paramedic bomber with white reflective bands and
  its stand-up collar lined in blue, a black tee and a gold chain, olive cargo trousers with a
  green stripe down the side and lilac straps hanging from the belt, chunky black sneakers with
  green panels.

Every picture is drawn at the original part's size plus a margin, so its centre stays the part's;
`fv_parts.pictures` pads them to the part's parity."""
from lookgen import shift
from fv_parts import pic, merged, fitted, HER_SKIN, HIM_SKIN

# --------------------------------------------------------------------------------------------
# Street Kid.
# --------------------------------------------------------------------------------------------
KID_TOP = {'C': '#fcf4e4', 'c': '#e8dac0', 'D': '#c2ad92', 'd': '#6a5644', 'x': '#3c3a44', 'X': '#24222a'}
KID_SLEEVE = {'P': '#f6a2c6', 'p': '#e47ea6', 'Q': '#b85682', 'q': '#7a3056'}
GOLD = {'G': '#fff6c6', 'g': '#f3c95e', 'h': '#d39a38', 'j': '#9c6420', 'J': '#5e3912', 'K': '#2a1608'}
STRAP = {'M': '#8a3e4a', 'm': '#56242e', 'S': '#2c2c34', 's': '#4c4c58', 'v': '#e6eaf2'}
SLIPON = {'W': '#ffffff', 'w': '#deddd8', 'u': '#b2b0ac', 'O': '#5a586a', 'q': '#8c8a98',
          'L': '#c8c6d4', 'l': '#958ea8', 'n': '#6c6682'}
INK = {'T': '#3a2a34', 't': '#7a5a5e'}


def kid_legend():
    return merged(KID_TOP, KID_SLEEVE, GOLD, STRAP, HER_SKIN, INK)


# The crop top in profile (57): the original's 10 x 12 with a pixel round it; the X's strap at the
# front, the frayed hem over the bare midriff.
KID_57 = [
    #0123456789ab
    '............',
    '....3221....',
    '....32221...',
    '....43221...',
    '...dDc332...',
    '..dDCCcc3...',
    '.dDCCCCCcd..',
    'dDCCCCCxCCd.',
    'dDCCCCxCCCCd',
    'dDDCCxCCCcCd',
    'dDDCxCCCccDd',
    '.dDDcccccDd.',
    '.d.d.d.dd.d.',
    '............',
]
# Turned to us (61): the X across the front, the pink sleeves' caps on the shoulders.
KID_61 = [
    #0123456789abc
    '.............',
    '....1HH2.....',
    '....2112.....',
    '..do3223od...',
    '.pPdcCCCcdPp.',
    'pPPxCCCCCxPPq',
    'pPQCxCCCxCQPq',
    '.dDCCxCxCCCd.',
    '.dDCCCXCCCCd.',
    '.dDCCxCxCCcd.',
    '.dDCxCCCxCcd.',
    '.dDxCCCCCxcd.',
    '.d.d.d.d.d.d.',
    '.............',
    '.............',
]
# The bare midriff, the maroon belt with its silver buckle, the gold hips (34 in profile, 38
# turned to us).
KID_34 = [
    #0123456789a
    '...3222....',
    '..o32221...',
    '..o322211..',
    '..o322211..',
    '..o332221..',
    '..o332221..',
    '..mMMMMMvm.',
    '...KjhgggK.',
    '..KjhggGgK.',
    '..KjhhgGgK.',
    '.KJjhhgGgK.',
    '.KJjhhggGK.',
    '.KJjjhhggK.',
    '..KJjjhhK..',
    '...KJJjK...',
    '....KKK....',
]
KID_38 = [
    #0123456789abc
    '...32111123..',
    '..o32111123o.',
    '..o3211H123o.',
    '..o32114123o.',
    '..o33211233o.',
    '..o33222333o.',
    '..mMMMvvMMMm.',
    '..KjhggGgggK.',
    '.KJjhgGghgGK.',
    '.KJjhgGjhgGK.',
    'KJjhhgGjhhgGK',
    'KJjjhggjjhggK',
    'KKJjhhgKJjhgK',
    '.KJjjhKKJjjhK',
    '..KKJJKKKJJK.',
    '....KKK.KKK..',
]
# The near thigh (53; 49 a shade darker): gold, a black snakeskin panel, two maroon straps.
KID_THIGH = [
    #01234567
    '..KjhgK.',
    '.KjhSsSK',
    '.KjhsSsK',
    '.KMMmMMK',
    '.KjhSsSK',
    '..KhsSsK',
    '..KjSsSK',
    '..KMmMMK',
    '..KjhSsK',
    '..KjhgSK',
    '..KjhgGK',
    '..KjhgGK',
    '..KjhgGK',
    '..KKjhK.',
]
KID_FAR_LEG = {'G': 'g', 'g': 'h', 'h': 'j', 'j': 'J', 'M': 'm'}
KID_KNEE = [
    '.KgGK.',
    'KjhgGK',
    'KjhgGK',
    '.KjhK.',
]
KID_SHIN = [
    #0123456
    '..KhgGK',
    '.KjhgGK',
    '.KjhgGK',
    '.KjhgGK',
    '.KjhgGK',
    '.KjhggK',
    '.KjhgGK',
    'KjhgGK.',
    'KjhgGK.',
    'KJjhgGK',
    'KJjhgGK',
    'KKJjhK.',
]
# The platform slip-on (39; 43 the far one; 47 and 48 turned): a white upper with a grey strap, a
# thick ribbed lilac sole.
KID_SHOE_39 = [
    #0123456789abc
    '.OWwO........',
    'OwWWwOqqO....',
    'OuwWWWWwWWwO.',
    'LlLlLlLlLlLlL',
    'lnlnlnlnlnlnl',
]
KID_SHOE_47 = [
    '.OWwO......',
    'OwWWwOqqO..',
    'OuwWWWwWwO.',
    'LlLlLlLlLlL',
    'lnlnlnlnlnl',
]
KID_SHOE_48 = [
    '.OWWWO.',
    'OwWqWwO',
    'OuwWwuO',
    'LlLlLlL',
    'lnlnlnl',
]
KID_FAR_SHOE = {'W': 'w', 'w': 'u', 'L': 'l', 'l': 'n'}
# The upper arm (5; 9 the far one): the pink sleeve frayed above the elbow, the bare arm.
KID_UPPER = [
    #0123456789ab
    '.qqqq.......',
    'qPPPPq.1111.',
    'qPpPpQ1HHH1.',
    'qpPpPQ22222o',
    'qQpQpq3333o.',
    '.qq.q.oooo..',
    '............',
]
KID_FAR_ARM = {'P': 'p', 'p': 'Q', 'H': '1', '1': '2', '2': '3', '3': '4'}
# The forearm (1): bare, the star tattoo.
KID_FOREARM = [
    #01234567
    '.1111HH.',
    '1HTt1112',
    '.322223.',
]

# The hot pink hair of the lifepath (the head of fv_heads.py with another hair legend).
KID_HAIR = {'P': '#ffb2d6', 'p': '#f670b0', 'q': '#d6408a', 'r': '#a02866', 'R': '#681646', 'k': '#300a22'}


def kid_pictures():
    leg = kid_legend()
    leg_shoe = merged(SLIPON)
    return fitted(0, {
        '57': pic(KID_57, leg), '61': pic(KID_61, leg), '34': pic(KID_34, leg), '38': pic(KID_38, leg),
        '53': pic(KID_THIGH, leg), '49': pic(shift(KID_THIGH, KID_FAR_LEG), leg), '62': pic(KID_KNEE, leg),
        '30': pic(KID_SHIN, leg),
        '39': pic(KID_SHOE_39, leg_shoe), '43': pic(shift(KID_SHOE_39, KID_FAR_SHOE), leg_shoe),
        '47': pic(KID_SHOE_47, leg_shoe), '48': pic(KID_SHOE_48, leg_shoe),
        '5': pic(KID_UPPER, leg), '9': pic(shift(KID_UPPER, KID_FAR_ARM), leg),
        '1': pic(KID_FOREARM, leg),
    })


# --------------------------------------------------------------------------------------------
# Edgerunner: him in David's jacket. The chest and the torso are his Samurai pictures recoloured
# (the leather turned yellow, the collar's light a blue lining, the shoulder straps and the hem
# white reflective bands, no red light, a gold pendant for the print); the sleeves, the cargo
# trousers and the sneakers are drawn here.
# --------------------------------------------------------------------------------------------
YELLOW = {'a': '#fff69c', 'b': '#f6df1e', 'c': '#d5b210', 'd': '#9a7a0c', 'e': '#463206'}
LINING = {'W': '#d6f2ff', 'Y': '#8fd6f8', 'y': '#5fbfee', 'Z': '#3f9fd6', 'X': '#25628e'}
REFLECT = {'K': '#f4f6f2', 'R': '#d8dcd8', 'r': '#a8aca8'}
TEE_BLACK = {'T': '#2a2a30', 't': '#18181c'}
CHAIN = {'*': '#f0c040', '!': '#9a7a0c', 'v': '#d4d8dc', 'V': '#8a8e94'}
CARGO = {'L': '#8a8a5c', 'l': '#6a6a44', 'm': '#4e4e32', 'n': '#383824', 'k': '#16160c'}
STRIPE = {'g': '#6edc5c', 'G': '#349a34'}
PATCH = {'x': '#e0402c'}
SNEAKER = {'h': '#3a3b42', 'j': '#1e1f24', 'f': '#5c5e68', 'w': '#d4d6dc', 'u': '#9c9ea8', 'O': '#0c0c10'}


def david_legend():
    return merged(YELLOW, LINING, REFLECT, TEE_BLACK, CHAIN, HIM_SKIN, CARGO, STRIPE, PATCH)


# The sleeve (5; 9 the far one): the yellow sleeve, a white reflective band, the red patch.
DAVID_UPPER = [
    #0123456789ab
    '.eeeeeeeeee.',
    'ebaabbKbbaae',
    'ebaabbKbbbae',
    'exxxcbKcbbae',
    'ebcccbRcbbce',
    'edcccdRccbce',
    'eddccdrccdde',
    'edddddrccdde',
    '.eeeeeeeeee.',
]
DAVID_FAR_ARM = {'a': 'b', 'b': 'c', 'c': 'd', 'd': 'e', 'K': 'R', 'R': 'r', 'x': 'd'}
# The forearm (1): the sleeve to the wrist, a reflective band at the cuff.
DAVID_FOREARM = [
    #01234567
    'eeeeeee.',
    'ebbbaKae',
    'ebbbbKbe',
    'ecccbRce',
    'edcccrde',
    'eeeeeee.',
    '........',
]
# The cargo trousers: the green stripe down the outer seam, a pocket on the thigh.
DAVID_THIGH = [
    #01234567
    '.knmlLk.',
    '.kngmlLk',
    'knngmlLk',
    'knngmlLk',
    '.kngkkLk',
    '.kngmllk',
    '.kngmlLk',
    '..kgmlLk',
    '..kgmlLk',
    '..kgmlLk',
    '..kgmlLk',
    '..kgmlLk',
    '..kgmlLk',
    '..kkgnk.',
]
DAVID_FAR_LEG = {'L': 'l', 'l': 'm', 'm': 'n', 'g': 'G'}
DAVID_KNEE = [
    '.kmLk.',
    'kgmlLk',
    'kgmlLk',
    'kgmlLk',
    '.kgmk.',
]
DAVID_SHIN = [
    #0123456
    '..kmlLk',
    '.kgmlLk',
    '.kgmlLk',
    '.kgmlLk',
    '.kgmlLk',
    '.kgmlLk',
    '.kgmlk.',
    'kgmlLk.',
    'kgmlLk.',
    'kgmlLk.',
    'knnmmlk',
    'kkkkkkk',
]
# The chunky sneakers (39; 43 the far one; 47, 48): black, a green collar and strap, a thick sole
# with a grey band.
DAVID_SHOE_39 = [
    #0123456789abc
    'OgGhO........',
    'OhjjhOgGO....',
    'OhjjjhhgGhhO.',
    'OwwwwwwwwwwwO',
    'OuuuuOOOuuuuO',
]
DAVID_SHOE_47 = [
    'OgGhO......',
    'OhjjhOgGO..',
    'OhjjjhhgGhO',
    'OwwwwwwwwwO',
    'OuuuOOOuuuO',
]
DAVID_SHOE_48 = [
    'OgfGO..',
    'OhgGhO.',
    'OhjjjhO',
    'OwwwwwO',
    'OuuuuuO',
]
DAVID_FAR_SHOE = {'h': 'j', 'f': 'h', 'w': 'u', 'g': 'G'}
# The lilac straps hanging from the belt (ribbons: a narrow band swinging as he runs).
STRAP_COLOURS = ['#d4b8f0', '#a888d0']

def david_pictures():
    import fv_parts as P
    leg = david_legend()
    shoe = merged(SNEAKER, STRIPE)
    # The Samurai jacket's chest (his, broader) in the yellow jacket's colours.
    chest57 = P.broader(P.HER_57, {6, 8})
    chest61 = P.broader(P.HER_61, {2, 12})
    return fitted(1, {
        '57': pic(chest57, leg), '61': pic(chest61, leg),
        '34': pic(P.HIM_34, leg), '38': pic(P.HIM_38, leg),
        '53': pic(DAVID_THIGH, leg), '49': pic(shift(DAVID_THIGH, DAVID_FAR_LEG), leg), '62': pic(DAVID_KNEE, leg),
        '30': pic(DAVID_SHIN, leg),
        '39': pic(DAVID_SHOE_39, shoe), '43': pic(shift(DAVID_SHOE_39, DAVID_FAR_SHOE), shoe),
        '47': pic(DAVID_SHOE_47, shoe), '48': pic(DAVID_SHOE_48, shoe),
        '5': pic(DAVID_UPPER, leg), '9': pic(shift(DAVID_UPPER, DAVID_FAR_ARM), leg),
        '1': pic(DAVID_FOREARM, leg),
    })


def david_ribbons():
    """Two lilac straps hanging from the belt."""
    cols = STRAP_COLOURS
    return {
        'strap-a': {'anchor': 'hips', 'offset': [1, 3], 'segments': 3, 'length': 3, 'width': 1, 'colors': cols,
                    'gravity': 160, 'drag': 3, 'stiffness': 0.2},
        'strap-b': {'anchor': 'hips', 'offset': [-2, 3], 'segments': 3, 'length': 2.5, 'width': 1,
                    'colors': list(reversed(cols)), 'gravity': 160, 'drag': 3, 'stiffness': 0.2},
    }
