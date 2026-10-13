"""Rush B's eight heads, drawn from scratch as pixel art: one soldier per Counter-Strike 1.6
player model, each his own head, headgear and face.

Terrorists: Phoenix Connexion (a black knit balaclava, a lilac sheen on its crown, a wide band
cut over both eyes and the bridge of the nose and a hole for the mouth), the Elite Crew's L337
(the only open face: long and narrow, olive, a dark flat-top with the sides clipped short,
mirrored silver-blue shades), the Arctic Avengers (a smooth black ski mask with three round
holes: two eyes and a mouth; his parka's white hood bunched at the nape), the Guerrilla (a
smooth red bandana to the brows, knotted at the back, a heavy brow, a square jaw, stubble, a
moustache joined to a goatee).
Counter-terrorists: SEAL Team 6 (a wide, low, dark olive-brown PASGT helmet down over the ears,
a band of eyes under its lip, a black mask from the nose down), GSG-9 (a smaller round helmet in
tan desert camouflage, white ski goggles pushed up on its brow, a black lower mask), SAS (a
black hood and a gas mask: two big round dark lenses, a filter snout), GIGN (a black hood with a
flat top and a light seam over it, a separate lower mask, light grey-blue eyes).

One light for the whole cast, from the upper front. In profile (25, facing right) the crown,
the brow and the front of the face are lit, the back of the head, the nape and under the jaw in
shade; on the 3/4 face (29) the light comes from the near (left) side, so the far side is
narrower and darker and the nose's shadow falls toward it. Skin has five tones (highlight,
light, mid, shadow, deep shadow), its shadows redder and more saturated, its highlights lighter
and yellower; a dark outline in shade and a lighter edge where the light hits (sel-out). Black
cloth keeps a coloured sheen where the light hits the crown and a little light bounced back
onto its shaded side, so it reads as a ball, not a hole; the rim of a mask's hole shades the
skin under its upper edge and catches the light on its lower one. Metal and lenses: a sharp
glint and a reflected light on the shadow side. (The first drafts were lit by rb_kit.light, a
dome raised from the silhouette; then every pixel was placed by hand.)

Boxes are the man's (17 x 17, the neck at the bottom a little left of the middle) so the heads
sit on his neck; helmets and the gas mask's snout grow past it by a pixel each way (19 x 19,
centred the same). The look tool turns 25 into 26-28; 76 / 77 are the blinks and 78 the pain
face of the faces with eyes, as edits of the profile."""
from heads import Pic


def legend(*parts):
    out = {}
    for p in parts:
        for k, v in p.items():
            assert k not in out or out[k] == v, f'legend: {k!r} twice'
            out[k] = v
    return out


def check(name, rows, leg):
    w = len(rows[0])
    for y, r in enumerate(rows):
        assert len(r) == w, f'{name} row {y}: {len(r)} wide, not {w}'
        for ch in r:
            assert ch == '.' or ch in leg, f'{name} row {y}: {ch!r} not in the legend'


def edit(rows, changes):
    """A copy of `rows` with {(x, y): char} changed."""
    out = [list(r) for r in rows]
    for (x, y), ch in changes.items():
        out[y][x] = ch
    return [''.join(r) for r in out]


class Head:
    """A soldier's head: the profile (25), the 3/4 face (29) and, where it has eyes, the blinks
    (76, 77) and the pain face (78) as edits of the profile ({(x, y): legend character})."""

    def __init__(self, name, leg, profile, front, blink=None, squint=None, pain=None):
        self.name = name
        self.leg = leg
        self.rows = {'25': profile, '29': front}
        for key, ch in (('76', blink), ('77', squint), ('78', pain)):
            if ch:
                self.rows[key] = edit(profile, ch)
        for k, r in self.rows.items():
            check(f'{name} {k}', r, leg)
        assert len(profile[0]) % 2 == len(front[0]) % 2 and len(profile) % 2 == len(front) % 2

    def pic(self, key='25'):
        return Pic.text(self.rows[key], self.leg)

    def pics(self):
        return {k: Pic.text(r, self.leg) for k, r in self.rows.items()}


# ------------------------------------------------------------------------------------ palettes
def skin(X, W, M, S, D, o, O, r):
    """X highlight, W light, M mid, S shadow (redder), D deep shadow; o the outline in shade, O the
    lit edge; r creases (a nostril, the mouth's corner, inside the ear)."""
    return {'X': X, 'W': W, 'M': M, 'S': S, 'D': D, 'o': o, 'O': O, 'r': r}


TAN = skin('#f3c58f', '#dda06e', '#bf7d53', '#975438', '#6b3323', '#2a110b', '#b06a44', '#4a1e14')
RUDDY = skin('#f0bf8e', '#d4966a', '#b47452', '#8c4e36', '#5f2f22', '#2a110b', '#ad6a46', '#45180f')
COOL = skin('#f0c8a4', '#dcaa86', '#c08a6a', '#98634c', '#6a3e30', '#2a140e', '#b07a5c', '#4a2218')
DUSK = skin('#e2b292', '#c89270', '#a87058', '#86503e', '#5e3428', '#24100a', '#9a5e44', '#40180e')
SAND = skin('#ecbe9a', '#d09e7a', '#b08060', '#8a5c44', '#5e3c2e', '#26120a', '#a06c50', '#40200e')
FAIR = skin('#f4e0ca', '#dcc2a8', '#c4a890', '#a08672', '#6a5246', '#24160f', '#b89c84', '#46302a')
# Eyes: w white (warm, never pure white), i iris, b brows. Lips: u upper (darker), l lower, p its
# highlight.
EYES = {'w': '#e6d8c6', 'i': '#2a1810', 'b': '#22150f'}
LIPS = {'u': '#7e3e30', 'l': '#a65e4a', 'p': '#c8836a'}
# Black cloth (a knit, a hood): A sheen, B light, C mid, E shade, F deep shade; k the outline in
# shade, K the lit edge.


def cloth(A, B, C, E, F, k, K):
    return {'A': A, 'B': B, 'C': C, 'E': E, 'F': F, 'k': k, 'K': K}


# ===================================================================================== Phoenix
# A black knit balaclava with a lilac sheen on the crown, gathered to a blunt point on top; a
# wide band cut over both eyes and the bridge of the nose, its upper rim shading the frowning
# brows, its lower rim lit; a separate hole for the mouth. Tanned skin. The knit runs down the
# neck into the collar.
KNIT = cloth('#5a5266', '#3c3646', '#29252f', '#1c1a21', '#131217', '#060509', '#363140')
PHOENIX_LEG = legend(TAN, EYES, LIPS, KNIT)
# fmt: off
PHOENIX_25 = [
    #0123456789ABCDEFG
    '.......kKK.......',  # 0  the knit gathered on top
    '.....kKBBAKk.....',  # 1
    '....kCCBBAAAK....',  # 2  the sheen on the crown
    '...kCCCBBAAAAK...',  # 3
    '..kECCCCBBAAABK..',  # 4
    '..kEECCCCBBBBBBK.',  # 5
    '.kFEECCCCCkDbbWO.',  # 6  the band: frowning brow under the rim
    '.kFEECCCCCkSSwio.',  # 7  the eye in its socket
    '.kFFEECCCCkMWXWXO',  # 8  cheekbone, the bridge of the nose
    '.kFFEECCCCBAAABBK',  # 9  the lower rim, lit; the nose under the knit
    '.kEFFEECCCCBBBBK.',  # 10
    '..kFFEECCCCBkruO.',  # 11 the mouth hole
    '..kEFFEECCCCkSlp.',  # 12
    '...kEFFEECCCBBK..',  # 13 the chin
    '....kkFFEEEEkk...',  # 14 under the jaw
    '.....kFFEECk.....',  # 15 the knit down the neck
    '.....kFFEECk.....',  # 16
]
PHOENIX_29 = [
    #0123456789ABCDEFG
    '.......KKKk......',  # 0
    '.....KKAABBkk....',  # 1
    '....KAAABBCCCk...',  # 2
    '...KAAABBCCCCEk..',  # 3
    '..KAAABBBCCCEEFk.',  # 4
    '..KBABBBBCCCEEFk.',  # 5
    '..kDbbSWSbbSDEFk.',  # 6  the band over both eyes: brows
    '..kSwiMXMwiSDEFk.',  # 7  the eyes, the bridge lit between them
    '..kMWXWXWMSSDEFk.',  # 8  the cheeks, the far one in shade
    '..KBAAAAAABBCEFk.',  # 9  the lower rim, lit
    '..KBBBBABBBCCEFk.',  # 10 the nose under the knit
    '..kCBBruurCCEEFk.',  # 11 the mouth hole
    '...kCBSplSCEEFk..',  # 12
    '...kCCCCCCEEEFk..',  # 13 the chin
    '....kEECCCEEFk...',  # 14
    '.....kECCEEFk....',  # 15
    '.....kECCEEFk....',  # 16
]
# fmt: on
PHOENIX = Head('phoenix', PHOENIX_LEG, PHOENIX_25, PHOENIX_29,
               blink={(13, 7): 'M', (14, 7): 'r'}, squint={(13, 7): 'r', (14, 7): 'i'},
               pain={(12, 6): 'b', (13, 6): 'b', (13, 7): 'r', (14, 7): 'r', (13, 11): 'r', (14, 11): 'r',
                     (14, 12): 'u'})

# ========================================================================================= L337
# The Elite Crew: the only open face, long and narrow (Gordon Freeman's head, recoloured
# olive in 1.6), a small chin, a straight nose; a dark flat-top, its top flat and lit, its front
# brushed up over the forehead, the sides and back clipped short (the scalp shows through, a
# sideburn in front of the ear); mirrored silver-blue rectangular shades in a thin black frame,
# the arm back over the ear. In the 3/4 view the near (lit) side shows the clipped side and the
# ear, the far lens is narrower and the far cheek in shade.
OLIVE = skin('#f2dca4', '#d9ba7c', '#ba965c', '#8d6838', '#5f4020', '#261808', '#a8844c', '#4a2a10')
FLAT = {'J': '#0e0905', 'H': '#22180e', 'h': '#3a2c1c', 'f': '#5e4a30', 'F': '#7a6444', 'y': '#8a7048',
        'q': '#5a4630'}
SHADES = {'Q': '#121216', 'g': '#f4fcff', 'G': '#a8c8d4', 'n': '#587886', 'N': '#34505c'}
LEET_LEG = legend(OLIVE, {'b': '#2a1c10'}, {'u': '#7a4632', 'l': '#a8664c', 'p': '#c88a6c'}, FLAT, SHADES)
# fmt: off
LEET_25 = [
    #0123456789ABCDEFG
    '......JJJJJJJ....',  # 0  the flat top
    '....JJFFfFFfFJ...',  # 1  its top, lit, bristly
    '...JhhffhffhffJ..',  # 2
    '...JHhhhhhhhhhfJ.',  # 3  the front stands up over the forehead
    '...qyyyHhhhHhHhJ.',  # 4  the sides and back clipped short
    '...qyyyyyHHMWXXO.',  # 5  the sideburn; the forehead
    '...qyyyyyHHMbbbO.',  # 6  the brow
    '...qyyyyyHHQQQQQQ',  # 7  the shades' frame
    '...qyyMWSQQQQgGGQ',  # 8  the ear under the arm; the mirrored lens
    '...qyyMrSMWWQnNNQ',  # 9
    '...qyySrMMMWWXWXO',  # 10 the straight nose
    '....qySSMMMWWWrO.',  # 11 the nostril
    '....oDSSSMMMWWuu.',  # 12 the mouth
    '.....oDSSSMMWWlp.',  # 13
    '.....oDDSSSMMWO..',  # 14 the small chin
    '......oDDDSSoo...',  # 15 the jaw's shadow on the neck
    '......oDSMo......',  # 16
]
LEET_29 = [
    #0123456789ABCDEFG
    '....JJJJJJJJJ....',  # 0
    '...JFFfFFfFFhJ...',  # 1  the flat top, lit on the near side
    '...JffhffhfhhJ...',  # 2
    '...JhhhhhhhHHJ...',  # 3  its front
    '...JyHhhHhhHHJ...',  # 4
    '...oyXXWWWMMSo...',  # 5  the forehead
    '...oybbbWMbbSo...',  # 6  the brows
    '...QQQQQQQQQQo...',  # 7  the frame
    '...SQgGGQGnQSo...',  # 8  the near lens, the far one narrower
    '...MQGnNQnNQDo...',  # 9
    '...oMWXWWXSSDo...',  # 10 the nose, its shadow to the far side
    '....oMWWXrSSDo...',  # 11
    '....oMWuuuSDDo...',  # 12 the mouth
    '.....oWMlpSDo....',  # 13
    '.....oMWWMSDo....',  # 14 the small chin
    '......oDDDDo.....',  # 15
    '......oMMSDo.....',  # 16
]
# fmt: on
LEET = Head('leet', LEET_LEG, LEET_25, LEET_29)

# ======================================================================================= Arctic
# A smooth black ski mask, round on top, a cool grey sheen; three round holes: the eyes and the
# mouth, each with the skin's shade under its upper edge and a lit lower rim. The parka's white
# hood bunched at the nape is drawn with the head (the chest's own lump of it hides behind the
# head), so it shows under the mask's back in profile and either side of the neck from the front.
SKI = cloth('#5a5f64', '#3c4044', '#282b2e', '#1b1d1f', '#121314', '#050606', '#33373b')
# The parka's hood: snow white, a grey blotch, shaded toward its back and underside.
PARKA = {'1': '#ffffff', '2': '#e4eae6', '3': '#c2cac6', '4': '#98a09c', '5': '#6e7672', '6': '#363c38',
         '7': '#7e8682'}
ARCTIC_LEG = legend(COOL, EYES, LIPS, SKI, PARKA)
# fmt: off
ARCTIC_25 = [
    #0123456789ABCDEFG
    '......kKKK.......',  # 0
    '....kKBBAAKk.....',  # 1
    '...kCCCBBAAAK....',  # 2
    '..kCCCCBBAAAAK...',  # 3
    '..kECCCCBBAAABK..',  # 4
    '.kEECCCCCBBBBBK..',  # 5
    '.kEEECCCCCBBSWBK.',  # 6  the eye's hole
    '.kFEECCCCCCBwiAK.',  # 7
    '.kFFEECCCCCCBAABK',  # 8  its lit lower rim; the nose
    '.kFFEECCCCCCBBBK.',  # 9
    '.kEFFEECCCCCCBBK.',  # 10
    '..kFFEECCCCCBulK.',  # 11 the mouth's hole
    '62kEFFEECCCCCBAk.',  # 12 the parka's hood bunched at the nape
    '621kEFFEECCCBBK..',  # 13
    '6321kEFFEECCk....',  # 14
    '64372kFFEECk.....',  # 15 a fold, a blotch of the camouflage
    '65443kFFEECk.....',  # 16
]
ARCTIC_29 = [
    #0123456789ABCDEFG
    '.......KKKk......',  # 0
    '.....KKABBBKk....',  # 1
    '....KAAABBCCCk...',  # 2
    '...KAAABBCCCCEk..',  # 3
    '...KAABBBCCCEEk..',  # 4
    '..KBABBBCCCCEEFk.',  # 5
    '..KBSWBBCCSWCEFk.',  # 6  two round eye holes
    '..KBwiBBCCwiCEFk.',  # 7
    '..KCAABBBCAACEFk.',  # 8  their lit lower rims
    '..KCBBBAABBCCEFk.',  # 9  the nose under the mask
    '..kCBBBSuBCCEEFk.',  # 10 the mouth's hole
    '...kCBBlpBCEEFk..',  # 11
    '...kCCBAABCEEFk..',  # 12
    '....kCCCCCEEFk...',  # 13
    '...21kECCEEFk45..',  # 14 the hood behind the neck
    '..632kECCEFk456..',  # 15
    '..643kECCEFk556..',  # 16
]
# fmt: on
ARCTIC = Head('arctic', ARCTIC_LEG, ARCTIC_25, ARCTIC_29,
              blink={(12, 7): 'S', (13, 7): 'r'}, squint={(12, 7): 'r', (13, 7): 'i'},
              pain={(12, 6): 'r', (12, 7): 'r', (13, 7): 'r', (13, 11): 'r', (14, 11): 'r'})

# ==================================================================================== Guerrilla
# A smooth red bandana pulled over the crown to the brows and down the back of the head, knotted
# at the back (its two tails are a ribbon of the look); a heavy brow ridge over deep-set scowling
# eyes, a broad nose, a heavy square jaw; dark stubble over the jaw and the cheeks, a moustache
# joined to a goatee. Ruddy, sunburnt skin.
RED = {'R': '#ff8466', 'Y': '#ee4430', 'n': '#c82a20', 'N': '#981a14', 'v': '#62100c', 'V': '#2e0606'}
BEARD = {'s': '#7a5844', 'z': '#4e3628', 'Z': '#2e1f16', 'm': '#1e130c'}
GUERRILLA_LEG = legend(RUDDY, EYES, LIPS, RED, BEARD)
# fmt: off
GUERRILLA_25 = [
    #0123456789ABCDEFG
    '......VNNNN......',  # 0
    '....VNnYYRRNN....',  # 1
    '...VNnnYYRRRRN...',  # 2  the bandana, smooth, lit on the crown
    '..VNnnnYYRRRRYN..',  # 3
    '..VNnnnnYYYYYYYN.',  # 4
    '.VNnnnnnnYYYYYnN.',  # 5  its edge low on the forehead
    'VvNNnnnnNNDbbbWO.',  # 6  the knot; the heavy brow ridge
    'VNvNNnnoSSSSwiS..',  # 7  the deep-set eye; the ear's top
    '.VvNNNorSMWWXWWO.',  # 8  the ear; the cheekbone
    '..VvNNorSMWWWWXWO',  # 9  the broad nose
    '..oSNNoSMMWWWWrXo',  # 10 the nostril
    '..oSsoSMMWWWWmmm.',  # 11 the moustache
    '...oSsSMMWWWmulO.',  # 12 the mouth
    '...oSssSMMWsmmmo.',  # 13 the goatee on the square chin
    '....oSsssssszmo..',  # 14 stubble along the jaw
    '.....oDDSSo......',  # 15 the thick neck
    '.....oDSSMo......',  # 16
]
GUERRILLA_29 = [
    #0123456789ABCDEFG
    '.......NNNV......',  # 0
    '.....NNRRYYNV....',  # 1
    '....NRRRRYnnnV...',  # 2
    '...NRRRRYYnnnnV..',  # 3
    '..NRRRRRYYnnNNNV.',  # 4
    '..NnnnnnnnnNNNvV.',  # 5  its edge on the forehead
    '..ObbbSWSbbbDDo..',  # 6  heavy scowling brows
    '..OwiSWMSwiSDDo..',  # 7  deep-set eyes
    '..OMWXWWMMSSDDo..',  # 8  the cheekbones
    '..OsWWWXrSSDDzo..',  # 9  the broad nose, its shadow to the far side
    '..ozsWzmmmzDzzo..',  # 10 the moustache
    '...zsmulumzDzz...',  # 11 the mouth
    '...zsWmmmzDDzz...',  # 12 the goatee
    '...ozzsWmzDzzo...',  # 13 the square chin
    '....ozzzzzzzo....',  # 14
    '.....oWMSDDo.....',  # 15
    '.....oWMSDDo.....',  # 16
]
# fmt: on
GUERRILLA = Head('guerrilla', GUERRILLA_LEG, GUERRILLA_25, GUERRILLA_29,
                 blink={(12, 7): 'S', (13, 7): 'b'}, squint={(12, 7): 'b', (13, 7): 'i'},
                 pain={(11, 6): 'b', (12, 7): 'b', (13, 7): 'b', (14, 12): 'r', (15, 12): 'u'})

# ========================================================================================= SEAL
# A PASGT helmet, wide and low, very dark olive-brown, its skirt down over the ears to the jaw
# and flaring at the back, a lip over the brow, light velcro patches on the crown and the side;
# under the lip a band of eyes in its shadow, heavy-lidded; a black mask from the nose down,
# round the neck.
PASGT = {'A': '#7a7460', 'B': '#5a5546', 'C': '#423d32', 'E': '#2d2922', 'F': '#1c1915', 'k': '#0a0907',
         'K': '#4a4436', 'P': '#9c9680', 'Q': '#6a6656'}
MASK = {'1': '#4a4a52', '2': '#333338', '3': '#232327', '4': '#17171a', '5': '#0f0f11', '6': '#050506',
        '7': '#2c2c32'}
SEAL_LEG = legend(DUSK, EYES, PASGT, MASK)
# fmt: off
SEAL_25 = [
    #0123456789ABCDEFGHI
    '.......kKKKKK......',  # 0
    '.....kKBPPAAAKK....',  # 1  the velcro on the crown
    '...kKCCBQQBAAAAKK..',  # 2
    '..kCCCCCBBBAAAAABK.',  # 3
    '.kECCCCCCBBBBAAABK.',  # 4
    '.kEECCPPCCBBBBBBBKK',  # 5  the side's velcro; the lip over the brow
    'kFEECCQQCCEkkkkkkk.',  # 6  the lip's shadow
    'kFEECCCCCCEkDbbbSO.',  # 7  heavy-lidded eyes in its shade
    'kFFEECCCCCEkSSwiSO.',  # 8
    '.kFFEECCCCEk3222227',  # 9  the black mask from the nose down
    '.kEFFEECCCEk3222227',  # 10
    '..kEFFEECEk3222227.',  # 11 the skirt's edge at the jaw
    '...kkkkkkk43322227.',  # 12
    '....643332233226...',  # 13
    '.....6433223326....',  # 14
    '......64432226.....',  # 15
    '.......643226......',  # 16
    '.......643226......',  # 17
    '...................',  # 18
]
SEAL_29 = [
    #0123456789ABCDEFGHI
    '.......KKKKk.......',  # 0
    '.....KKAPPPBKk.....',  # 1
    '...KKAAAQQQBCCKk...',  # 2
    '..KAAAAAABBCCCCCk..',  # 3
    '.KAAAAAABBBCCCCCEk.',  # 4
    '.KBAAAABBBCCCCCEEk.',  # 5
    'KBPPkkkkkkkkkkkEFFk',  # 6  the lip's shadow over the eyes
    'KBQQDbbbMDbbbSkEFFk',  # 7  the ear covers either side
    'KCBBSwiSMSwiSDkEFFk',  # 8
    'KCBBk222223334kEFk.',  # 9  the mask from the nose down
    '.KCEk222223344kEFk.',  # 10
    '.kCEk122223344kFk..',  # 11
    '..kkk122223344kk...',  # 12
    '....71222233446....',  # 13
    '.....722233446.....',  # 14
    '......7223346......',  # 15
    '......7223346......',  # 16
    '......7223346......',  # 17
    '...................',  # 18
]
# fmt: on
SEAL = Head('seal', SEAL_LEG, SEAL_25, SEAL_29,
            blink={(14, 8): 'S', (15, 8): 'b'}, squint={(14, 8): 'b', (15, 8): 'i'},
            pain={(14, 8): 'b', (15, 8): 'b', (13, 7): 'b'})

# ======================================================================================== GSG-9
# A smaller, rounder helmet in tan desert camouflage (pale sand with tan and brown blotches),
# white ski goggles pushed up on its brow on a black strap; a band of eyes; a black lower mask.
DESERT = {'A': '#efe8d8', 'B': '#d8ccb4', 'C': '#bcac90', 'E': '#9a886c', 'F': '#74624c', 'k': '#2e241a',
          'K': '#aa9a7c', 'd': '#9a7e5c', 'D': '#6e5640', 'c': '#c4a880'}
GOGGLE = {'g': '#ffffff', 'G': '#dcdee2', 'q': '#9ea0a6', 'Q': '#141414', 'x': '#5a5c60'}
GSG9_SKIN = {k: v for k, v in SAND.items() if k != 'D'}
GSG9_LEG = legend(GSG9_SKIN, {'b': EYES['b'], 'w': EYES['w'], 'i': EYES['i']}, DESERT, GOGGLE, MASK)
# fmt: off
GSG9_25 = [
    #0123456789ABCDEFGHI
    '...................',  # 0
    '.......kKKKK.......',  # 1
    '.....kKdDBAAKK.....',  # 2  the round helmet, blotched
    '....kCCcBddAcAK....',  # 3
    '...kDDCCBBAAAdAK...',  # 4
    '..kEcCQQQQQQQQQgGK.',  # 5  the goggles' strap; the goggles on the brow
    '..kEEdCCCBBQqGggGq.',  # 6
    '..kFFEEdCCBkQQQQQ..',  # 7
    '..kEFFEECCkSbbbWO..',  # 8  the eyes under them
    '...kFFFEEkSSSwiO...',  # 9
    '...kEFFEk322222227.',  # 10 the black mask from the nose down
    '....kkkk4322222227.',  # 11
    '....6433322222226..',  # 12
    '.....643322222336..',  # 13
    '......6433222336...',  # 14
    '.......64332226....',  # 15
    '.......6433226.....',  # 16
    '.......6433226.....',  # 17
    '...................',  # 18
]
GSG9_29 = [
    #0123456789ABCDEFGHI
    '...................',  # 0
    '.......KKKKk.......',  # 1
    '.....KKdDBBBDk.....',  # 2
    '....KDAAABddCCk....',  # 3
    '...KAAcBBBCCdEEk...',  # 4
    '..KQQQQQQQQQQQQQk..',  # 5  the goggles across the brow
    '..KQgggGQxQGggqQk..',  # 6
    '..KQGGGqQQQqGGqQk..',  # 7
    '..KBEkSbbMSbbkEFk..',  # 8  the eyes
    '..kCEkSwiSSwiSkFk..',  # 9
    '...kEk22222333kk...',  # 10 the black mask from the nose down
    '...kkk12222334kk...',  # 11
    '....7122223344.....',  # 12
    '....7122223346.....',  # 13
    '.....71222346......',  # 14
    '......7223346......',  # 15
    '......7223346......',  # 16
    '......7223346......',  # 17
    '...................',  # 18
]
# fmt: on
GSG9 = Head('gsg9', GSG9_LEG, GSG9_25, GSG9_29,
            blink={(13, 9): 'S', (14, 9): 'b'}, squint={(13, 9): 'b', (14, 9): 'i'},
            pain={(13, 9): 'b', (14, 9): 'b', (12, 8): 'b'})

# ========================================================================================== SAS
# A black hood and a gas mask: the rubber face piece from the brow to the chin, two big round
# dark lenses in grey rims with a glint, a filter snout jutting forward at the mouth with a round
# canister; the mask's strap over the hood.
HOOD = cloth('#54575b', '#393b3e', '#28292b', '#1a1b1c', '#111112', '#040404', '#2e3033')
RUBBER = {'1': '#4c5452', '2': '#363c3b', '3': '#26292a', '4': '#191b1c', '5': '#0f1011', '6': '#050606',
          '7': '#303634'}
LENS = {'L': '#06080a', 'l': '#26303a', 'g': '#d8e0e8', 'y': '#8c9298', 's': '#202326'}
SAS_LEG = legend(HOOD, RUBBER, LENS)
# fmt: off
SAS_25 = [
    #0123456789ABCDEFGHI
    '...................',  # 0
    '.......kKKKK.......',  # 1
    '.....kKBBBAAKK.....',  # 2
    '....kCCCBBAAAAK....',  # 3
    '...kCCCBBBAAAAAK...',  # 4
    '...kECCsssBB11117..',  # 5  the strap; the rubber face piece
    '..kEECCCCBs1yyyy7..',  # 6  the lens in its grey rim
    '..kEEECCCCs1yLgLy..',  # 7
    '..kFEEECCCs1yLLly..',  # 8
    '..kFFEEECCs22yyy7..',  # 9
    '..kEFFEEECs2222217.',  # 10 the snout
    '...kFFEEECs2233yyy.',  # 11 the filter canister
    '...kEFFFEs42233ygyy',  # 12
    '....kEFFEs44333yyy.',  # 13
    '.....kkEEEs44336...',  # 14
    '.......kFFEEk......',  # 15
    '.......kFFEEk......',  # 16
    '.......kFFEEk......',  # 17
    '...................',  # 18
]
SAS_29 = [
    #0123456789ABCDEFGHI
    '...................',  # 0
    '.......KKKKk.......',  # 1
    '.....KKAABBBKk.....',  # 2
    '....KAAAABBCCCk....',  # 3
    '...KAAAABBCCCCEk...',  # 4
    '...Ks1yy11yy234sk..',  # 5  the face piece, the strap at its sides
    '..KBsyLgy1yLgy34Ek.',  # 6  two big round lenses in grey rims
    '..KBsyLLy2yLLy44Ek.',  # 7
    '..KBs1yy222yy345Ek.',  # 8
    '..kCs122yyy33445Fk.',  # 9  the filter canister under them
    '..kCs12ygy333455Fk.',  # 10
    '...kEs12yyy3345k...',  # 11
    '...kEs12223334k....',  # 12
    '....kEs122334k.....',  # 13
    '.....kEECCEFFk.....',  # 14
    '......kECCEFk......',  # 15
    '......kECCEFk......',  # 16
    '......kECCEFk......',  # 17
    '...................',  # 18
]
# fmt: on
SAS = Head('sas', SAS_LEG, SAS_25, SAS_29)

# ========================================================================================= GIGN
# A black hood with a flat top and a light seam running over it from the brow to the nape; a
# slot for the eyes (light grey-blue eyes under thick drawn brows, fairer skin); a separate lower
# mask from the bridge of the nose down round the neck, a shade lighter, its upper edge a lighter
# line under the eyes, its roll at the neck.
GHOOD = cloth('#5a5650', '#403c37', '#2c2a27', '#1e1c1a', '#131211', '#060505', '#36332e')
SEAM = {'e': '#8c867c', 'a': '#6a655c'}
LOWER = {'1': '#55585c', '2': '#3d3f43', '3': '#2b2d30', '4': '#1d1f21', '5': '#131415', '6': '#060606',
         '7': '#34373a', '8': '#74777c'}
GIGN_EYES = {'w': '#e8e6e0', 'i': '#8aa2bc', 'b': '#1e1612'}
GIGN_LEG = legend(FAIR, GIGN_EYES, GHOOD, SEAM, LOWER)
# fmt: off
GIGN_25 = [
    #0123456789ABCDEFG
    '....kaeeeeeeK....',  # 0  the flat top, the seam along it
    '...kCBBBBBAAAK...',  # 1
    '..kECCBBBBAAAAK..',  # 2
    '..kEECBBBBAAAABK.',  # 3
    '.kEEECCBBBBAAABK.',  # 4
    '.kEEECCCBBBBBBBK.',  # 5
    '.kFFEECCCBBkbbbO.',  # 6  the slot: thick brows
    '.kFFEECCCCBkSwiO.',  # 7  the light eye
    '.kFFFEECCCk888817',  # 8  the lower mask's lit edge
    '.kFFFEEECk3222227',  # 9  the bridge of the nose under it
    '.kEFFFEECk322222.',  # 10
    '..kFFFFEk3332227.',  # 11
    '..kEFFFk4433226..',  # 12
    '...kEFk44433326..',  # 13
    '....kk744444436..',  # 14
    '.....71111117....',  # 15 the roll at the neck
    '.....6433226.....',  # 16
]
GIGN_29 = [
    #0123456789ABCDEFG
    '....KKKKeKKKk....',  # 0
    '...KAAABeBBBCk...',  # 1  the seam down the middle of the top
    '..KAAAABeBBCCEk..',  # 2
    '..KBAAABeBBCEEk..',  # 3
    '..KBBBBBaBCEEEk..',  # 4
    '..KBBBBBCCCEFFk..',  # 5
    '..KkbbbSSbbbkFk..',  # 6  the slot: thick brows
    '..KkwiSWSwiSkFk..',  # 7  light grey-blue eyes
    '..KC88888888kFk..',  # 8  the lower mask's lit edge
    '..KC12222333kFk..',  # 9
    '..kC12222334kEk..',  # 10
    '...k1222334kk....',  # 11
    '...k12222345k....',  # 12
    '....712223346....',  # 13
    '....711111117....',  # 14 the roll at the neck
    '....643333346....',  # 15
    '.....6666666.....',  # 16
]
# fmt: on
GIGN = Head('gign', GIGN_LEG, GIGN_25, GIGN_29,
            blink={(13, 7): 'S', (14, 7): 'b'}, squint={(13, 7): 'b', (14, 7): 'i'},
            pain={(13, 7): 'b', (14, 7): 'b', (12, 6): 'b'})

HEADS = [PHOENIX, LEET, ARCTIC, GUERRILLA, SEAL, GSG9, SAS, GIGN]
