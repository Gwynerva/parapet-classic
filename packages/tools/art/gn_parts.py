"""Granger's body, drawn upright as text (the look tool turns the pictures): Tracer's cropped
bomber with its fur collar and the chronal accelerator (the glowing disc on the chest, its white
housing and harness, the second ring on the back plate), the white bracers flaring at the elbow,
thin legs in the suit running from yellow at the hip to red-orange at the ankle, white trainers
with a glowing cyan sole line. The other looks redraw what differs (Slipstream's flight suit and
life vest, Punk's studded jacket and ripped tights).

Every picture is text with a legend of semantic characters. The legs use lit levels 1-5
(highlight → dark edge) coloured afterwards by their place down the leg (`gradient`)."""
from heads import Pic

# --------------------------------------------------------------------------------------------
# Colours
# --------------------------------------------------------------------------------------------
CYAN = '#3fd2ff'
GLOW = {'x': '#e8ffff', 'y': '#7fe8ff', 'z': CYAN, 'Z': '#1f8fd8', 'X': '#16578a'}
WHITE = {'W': '#ffffff', 'w': '#e4e2dc', 'q': '#bdb9b1', 'Q': '#88847e'}
HARNESS = {'h': '#76787c', 'H': '#45474b', 'K': '#232427'}
NECK = {'n': '#ffd0a2', 'N': '#f2ac7e', 'M': '#d8845a'}
ORANGE = {'o': '#ff9a2a', 'O': '#c0601a'}


def ramp_legend(chars, colours):
    return dict(zip(chars, colours))


JACKET = ['#c8a072', '#a47c52', '#82603e', '#5f432c', '#3c2a1c']   # a b c d e
FUR = ['#fbf4e4', '#e2d4b6', '#bba684']                             # F f g
GLOVE = ['#5e5c54', '#48463f', '#33322c', '#1e1d1a']                # G g? (hands are recoloured)

# The suit down the leg: ramps (highlight → dark edge) at the hip, the knee and the ankle.
SUIT_STOPS = [
    (0.00, ['#fff7b8', '#ffe46a', '#ffcc34', '#e39a1e', '#a4601a']),
    (0.50, ['#ffe08e', '#ffbc48', '#fd9e2c', '#d9721c', '#9a4614']),
    (1.00, ['#ffbc88', '#ff8c48', '#f06c26', '#c64a1a', '#86300f']),
]
SUIT_BANDS = 4


def _mix(a, b, t):
    a, b = a.lstrip('#'), b.lstrip('#')
    return '#' + ''.join('%02x' % round(int(a[i:i + 2], 16) * (1 - t) + int(b[i:i + 2], 16) * t)
                         for i in (0, 2, 4))


def suit_ramp(t, stops=SUIT_STOPS, bands=SUIT_BANDS):
    """The suit's ramp at place t (0 hip .. 1 ankle), quantised to `bands` steps."""
    t = min(bands - 1, int(t * bands)) / max(1, bands - 1)
    for (t0, r0), (t1, r1) in zip(stops, stops[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            return [_mix(a, b, u) for a, b in zip(r0, r1)]
    return stops[-1][1]


def gradient(rows, legend, t0, t1, stops=SUIT_STOPS, bands=SUIT_BANDS):
    """A leg picture: digits 1-5 coloured from the suit's ramp by row (t0 at the top row, t1 at
    the bottom), other characters from `legend`."""
    h = len(rows)
    g = []
    for j, r in enumerate(rows):
        t = t0 + (t1 - t0) * (j + 0.5) / h
        rp = suit_ramp(t, stops, bands)
        g.append([None if ch == '.' else (rp[int(ch) - 1] if ch in '12345' else legend[ch]) for ch in r])
    return Pic(g)


def pic(rows, legend):
    return Pic.text(rows, legend)


def darker(rows, shift):
    return [''.join(shift.get(c, c) for c in r) for r in rows]


# --------------------------------------------------------------------------------------------
# Classic. Legend: the jacket a-e (light → dark), the fur F f g, the neck n N M, the harness
# h H K, the white W w q Q, the glow x y z Z X, the zip s, the suit's lit levels 1-5.
# --------------------------------------------------------------------------------------------
# The chest in profile (57), 16 × 14: Blaise's chest grown by one, two columns more each side for
# the back plate (left) and the accelerator standing off the breast (right).
CLASSIC_57 = [
    '.......MNn......',
    '......MNnn......',
    '.....gfMNnF.....',
    '....egfFMnFF....',
    '.Q.edgffFFFFf...',
    'qWqedcbgffFFbh..',
    'WyQedcbbgfFbhWw.',
    'qZQdccbbbgfbHwxW',
    '.qedcccbbbbaHqyz',
    '..edccccbbbbHqZz',
    '..eddcccbbbbhKQZ',
    '..eddccccbbbbb..',
    '...edddcccccb...',
    '....eeeeeeee....',
]
# The chest turned to us (61), 13 × 15: the fur lapels, the accelerator under the collar in its
# white ring, the harness to it, the zip below.
CLASSIC_61 = [
    '....MNnn.....',
    '....MNnn.....',
    '..gfMNnnFf...',
    '.egfFMNnFFfc.',
    'edgfFFMnFFfbc',
    'edcgfFFFFgbac',
    'edcHgWWWwgHac',
    'edcbHWxyzWHac',
    'edccWyzZXwbac',
    'edccqzZXZqbac',
    'eddcbqHqbbbac',
    '.eddcbsbbbac.',
    '.edddcsbbbbc.',
    '..edddsdddd..',
    '...eeeeeee...',
]
# The torso in profile (34), 9 × 16: the bomber's hem at the waist, the harness belt, the suit's
# hips with the strap under the seat.
CLASSIC_34 = [
    '...dcbb..',
    '..edcbba.',
    '..edcbba.',
    '..edcbbb.',
    '..edccbb.',
    '..eddcbc.',
    '..eeeeed.',
    '..KHHHhH.',
    '..54322..',
    '.543221..',
    '.H43221..',
    '.5H3222..',
    '.54H32...',
    '..54H....',
    '...5H....',
    '.........',
]
CLASSIC_38 = [
    '...dcbbbc..',
    '..edcsbbbc.',
    '..edcsbbbc.',
    '..edcsbbbc.',
    '..eddsbbcd.',
    '..eddscccd.',
    '..eeeeeeee.',
    '..KHHqHHhH.',
    '..H43212H..',
    '..5H3212H..',
    '..54H22H2..',
    '..543HH23..',
    '..5432123..',
    '..543.423..',
    '...5...4...',
    '...........',
]
# The legs: the near thigh (53; the far one, 49, a level darker), the knee (62), the shin (30).
THIGH = [
    '.543.',
    '54312',
    '54312',
    '54312',
    '54312',
    '54312',
    '5432.',
    '.5421',
    '.5421',
    '.5421',
    '.5421',
    '.5421',
    '.5421',
    '.543.',
]
# Her left thigh: the strap with its white plate, TRACER down the side (a cream dash).
THIGH_LEFT = [
    '.543.',
    '54312',
    '54312',
    '54312',
    'HHHWh',
    '54312',
    '54t2.',
    '.5t21',
    '.5t21',
    '.5421',
    '.5421',
    '.5421',
    '.5421',
    '.543.',
]
KNEE = [
    '.54.',
    '5412',
    '5412',
    '.54.',
]
SHIN = [
    '.5421',
    '.5421',
    '.5421',
    '.5421',
    '.5421',
    '.542.',
    '.5421',
    '.542.',
    '542..',
    '542..',
    '542..',
    '54...',
]
FAR_LEG = {'1': '2', '2': '3', '3': '4', '4': '5'}

# The upper arm (5, and 9 the other way round): the leather sleeve to the elbow, a cream fur cuff.
UPPER = [
    '.dcbba.....',
    'dcbaaabbbFF',
    'dcbbbbbbbfF',
    'ddcccccccfg',
    'eddddddddgg',
    '.eee.......',
]
# On her right shoulder the Union Jack, on the left the squadron's round blue patch.
FLAG = {'B': '#26387e', 'R': '#d42232', 'W': '#ffffff'}
UPPER_RIGHT = [
    '.dcbba.....',
    'dBWRWBbbbFF',
    'dRRRRRbbbfF',
    'dBWRWBcccfg',
    'eddddddddgg',
    '.eee.......',
]
UPPER_LEFT = [
    '.dcbba.....',
    'dcbyZabbbFF',
    'dcbZXbbbbfF',
    'ddcccccccfg',
    'eddddddddgg',
    '.eee.......',
]
# The bracer over the forearm (1), elbow on the left: a white shell wider than the arm flaring
# into an angular fin past the elbow, a grey groove, the glove's dark cuff at the wrist.
BRACER = [
    'WW........',
    'WWWWWWWw..',
    'wWWWWWWWWK',
    'qwwwqqwwqK',
    'QqqqqqqqQK',
    '.QQQQQQQ..',
]
# OW2 trainers, heel left, toe right: a white upper, a black elastic strap over the instep, an
# orange heel, a glowing cyan line along the sole, an orange outsole.
SHOE = {'W': '#ffffff', 'w': '#e6e6e2', 'q': '#bdbcb6', 'Q': '#8a8984', 'k': '#2a2a2e', 'K': '#141416',
        'o': '#ffa236', 'O': '#f5891f', 'R': '#c45e14', 'c': '#bff6ff', 'C': CYAN, 'G': '#1f8fd8'}
SHOE_39 = [
    '.qWWWq.......',
    'oowWWWkkWWWw.',
    'OowWWWkkwWWWq',
    'RCCCCCCCCCCcQ',
    '.OOOOOORRRRR.',
]
SHOE_FAR = {'W': 'w', 'w': 'q', 'q': 'Q', 'o': 'O', 'O': 'R', 'C': 'G', 'c': 'C', 'k': 'K'}
SHOE_47 = [
    '.qWWWq.....',
    'oowWWkkWWw.',
    'OowWWkkwWWq',
    'RCCCCCCCCcQ',
    '.OOOOORRRR.',
]
SHOE_48 = [
    '.wWWWq.',
    'qWkkWwq',
    'qwkKwqQ',
    'cCCCCCG',
    '.ROOOR.',
]


# --------------------------------------------------------------------------------------------
# Slipstream: the test pilot's blue flight suit (a-e), the yellow life vest (Y y u U, its orange
# edge O), the white scarf at the neck (W w q), black straps; blue bracers; black flight boots to
# the knee with a blue inset and a brown sole. No accelerator yet: this is the flight before it.
# --------------------------------------------------------------------------------------------
FLIGHT = ['#7aa6ec', '#4f7ed0', '#335aa8', '#223c78', '#142450']
VEST = {'Y': '#fff3a4', 'y': '#f8d044', 'u': '#dca22a', 'U': '#a86e18', 'O': '#ee8424'}
BOOT = {'J': '#5a5a6a', 'j': '#383846', 'k': '#16161e', 'i': '#3c62b8', 'S': '#6a4a34', 's': '#4a3222'}
FLIGHT_STOPS = [(0.0, ['#8ab2f0', '#5a88d6', '#3a62b0', '#26427e', '#152752']),
                (1.0, ['#7ea6e8', '#4f7ecc', '#3258a6', '#223a74', '#13224a'])]
SLIP_57 = [
    '.......MNn......',
    '......MNnn......',
    '.....qwMNnW.....',
    '....qwWWWWWw....',
    '...edqwWWwwyY...',
    '..edUuqwwyyYYy..',
    '..eUuuyyyyyYYYO.',
    '..eUuuyyyyyYYYO.',
    '..eUuuuyyyyyYYO.',
    '..edUuuuyyyyyO..',
    '..eddOOOOOOOOc..',
    '..eddcccbbbbbb..',
    '...edddcccccb...',
    '....eeeeeeee....',
]
SLIP_61 = [
    '....MNnn.....',
    '....MNnn.....',
    '..qwMNnnWw...',
    '.eqwWWWWWwqc.',
    'eduyYYwWyYYyc',
    'eduyYYYwyYYyc',
    'eduyyYYOyyYyc',
    'edHHHHHOHHHHc',
    'eduyyyYOyyYyc',
    'eduuyyyOyyyuc',
    'edOOOOOOOOOOc',
    '.eddccbbbbbc.',
    '.edddccbbbcd.',
    '..eddddddde..',
    '...eeeeeee...',
]
SLIP_34 = [
    '...dcbb..',
    '..edcbba.',
    '..edcbba.',
    '..edcbbb.',
    '..edccbb.',
    '..eddcbc.',
    '..eddcbc.',
    '..KHHHhH.',
    '..54322..',
    '.543221..',
    '.H43221..',
    '.5H3222..',
    '.54H32...',
    '..54H....',
    '...5H....',
    '.........',
]
SLIP_38 = [
    '...dcbbbc..',
    '..edcbbbbc.',
    '..edcbbbbc.',
    '..edcbbbbc.',
    '..eddcbbcd.',
    '..eddccccd.',
    '..eddccccd.',
    '..KHHqHHhH.',
    '..H43212H..',
    '..5H3212H..',
    '..54H22H2..',
    '..543HH23..',
    '..5432123..',
    '..543.423..',
    '...5...4...',
    '...........',
]
# The flight suit's thigh: a white swoosh with an orange edge down its side.
SLIP_THIGH = [
    '.543.',
    '54312',
    '54W12',
    '54Wo2',
    '543W2',
    '543Wo',
    '5431W',
    '5431W',
    '.541o',
    '.5412',
    '.5412',
    '.5412',
    '.5412',
    '.543.',
]
# The flight boot's leg, up to the knee: black leather, a blue inset, a buckled strap.
SLIP_SHIN = [
    'kjJJk',
    'kjJJk',
    '.kjiJ',
    '.kjiJ',
    '.kjJk',
    '.kqqk',
    '.kjJk',
    '.kjJ.',
    'kjJk.',
    'kjJk.',
    'kjJ..',
    'kj...',
]
SLIP_KNEE = [
    '.54.',
    '5412',
    '5412',
    '.54.',
]
SLIP_UPPER = [
    '.qwwW.....',
    'qwWWWbbbbb',
    'qqwwcbbbba',
    'dccccccbcb',
    'eddddddddd',
    '.eee......',
]
BOOT_39 = [
    '.kjJJk.......',
    'kjjJJjkkk....',
    'kjjjjjjjjkkk.',
    'kKjjjjjjjjJJk',
    'sSSSSSSSSSSSs',
]
BOOT_47 = [
    '.kjJJk.....',
    'kjjJJjkk...',
    'kjjjjjjjkk.',
    'kKjjjjjjJJk',
    'sSSSSSSSSSs',
]
BOOT_48 = [
    '.kjJk.',
    'kjjJJk',
    'kjqqJk',
    'kjjjJk',
    'sSSSSs',
]
BOOT_FAR = {'J': 'j', 'j': 'k', 'S': 's'}
BRACER_BLUE = {'W': '#9cc0f8', 'w': '#6c96e0', 'q': '#466ec0', 'Q': '#2c4a8c', 'K': '#1c1c24'}
SCARF = {'W': '#ffffff', 'w': '#e6ecf2', 'q': '#b8c2cc'}
SCARF_TEX = [
    '.+.',
    'wWw',
    'wWq',
    'WWq',
    'wWq',
    'qWw',
    'wWw',
    'wWq',
    'WWq',
    'wWq',
    'qww',
    'wWq',
    'wWq',
    '.Wq',
    '.Wq',
    '.wq',
    '.W.',
    '.w.',
    '.q.',
]

# --------------------------------------------------------------------------------------------
# Punk: a studded black leather jacket (a-e, studs S) over a white tee (T t), the accelerator in
# a yellow hexagonal housing (V v), black shorts on a studded belt, ripped pink tights (levels 1-5
# coloured pink, the rips n N in her skin, a teal patch p), a black studded garter round the left
# thigh, black high-tops with silver buckles (and a cyan light at the toe).
# --------------------------------------------------------------------------------------------
LEATHER = ['#6a6874', '#46444f', '#302e38', '#1e1c24', '#0e0d12']
PUNK = {'S': '#eef0f6', 'T': '#fbf8f2', 't': '#cfc8c4', 'V': '#ffe24a', 'v': '#d8a420',
        'p': '#3ccdc4', 'R': '#d42232', 'B': '#26387e'}
PINK_STOPS = [(0.0, ['#ffc2dc', '#ff86bc', '#ec5c9e', '#c03c7c', '#7c2050']),
              (1.0, ['#ffb0d0', '#f872ae', '#e04c90', '#b2346e', '#701a46'])]
PUNK_57 = [
    '.......MNn......',
    '......MNnn......',
    '.....edMNnc.....',
    '....edcMNnbc....',
    '...edSbSbTTt....',
    '..edcbbbbTTVv...',
    '..edcbbbbTVxyz..',
    '..edcbbbbTVyzZ..',
    '..edccbbbTvVZ...',
    '..eddcccbTTt....',
    '..eddcccbTTt....',
    '..eddccccbTt....',
    '...edddccTt.....',
    '....eeeeee......',
]
PUNK_61 = [
    '....MNnn.....',
    '....MNnn.....',
    '..edMNnncb...',
    '.edcTMNnTbcd.',
    'edSbTTTTTbSac',
    'edcbTTRTTbbac',
    'edcbTVVVVTbac',
    'edcbVxyzVTbac',
    'edccVyzZVTbac',
    'eddcTVVVTTbac',
    '.eddTTTTTtac.',
    '.edcTTTTttbc.',
    '.eddcTttTccd.',
    '..eddttttde..',
    '...eeeeeee...',
]
PUNK_34 = [
    '...TTTt..',
    '..dTTTta.',
    '..eTTTtb.',
    '..edTTtb.',
    '..edccbb.',
    '..eddcbc.',
    '..SKSKSK.',
    '..eddcbb.',
    '.eddcbbb.',
    '.edccbbba',
    '.eddcbbba',
    '.eddccbb.',
    '..e.d.c..',
    '.........',
    '.........',
    '.........',
]
PUNK_38 = [
    '...tTTTt...',
    '..dtTTTTb..',
    '..etTTTtc..',
    '..etTTTtc..',
    '..edTTtcd..',
    '..eddccccd.',
    '..SKSKSKSK.',
    '..eddcbbbc.',
    '..edccbbbb.',
    '.eddcbbbbbc',
    '.eddcc.bbcc',
    '.edcc..bccd',
    '..e.d...c.d',
    '...........',
    '...........',
    '...........',
]
PUNK_THIGH = [
    '.edc.',
    'edcbb',
    'ecbba',
    '.d.c.',
    '54312',
    '54312',
    '54nN2',
    '54312',
    '.5412',
    '.5412',
    '.5p12',
    '.5412',
    '.5412',
    '.543.',
]
PUNK_THIGH_LEFT = [
    '.edc.',
    'edcbb',
    'ecbba',
    '.d.c.',
    '54312',
    'KSKSK',
    '54312',
    '54nN2',
    '.5412',
    '.5412',
    '.5p12',
    '.5412',
    '.5412',
    '.543.',
]
PUNK_SHIN = [
    '.5412',
    '.5412',
    '.5412',
    '.5nN2',
    '.5412',
    '.542.',
    '.5412',
    '.542.',
    '542..',
    '542..',
    '542..',
    '54...',
]
HIGHTOP = {'k': '#0c0b10', 'K': '#26242e', 'g': '#423f4c', 'G': '#625e6e', 'S': '#e6e8f0', 's': '#9a9eac',
           'w': '#d8d4cc', 'c': CYAN}
HIGHTOP_39 = [
    '.kkkk........',
    'kGgKk........',
    'kgSsgk.......',
    'kKKKgSsk.....',
    'kKKKKKgSsGGk.',
    'kKKKKKKKKKKKc',
    'wwwwwwwwwwwww',
]
HIGHTOP_47 = [
    '.kkkk......',
    'kGgKk......',
    'kgSsgk.....',
    'kKKKgSsk...',
    'kKKKKKKgGGk',
    'kKKKKKKKKKc',
    'wwwwwwwwwww',
]
HIGHTOP_48 = [
    '.kkkk.',
    'kGggKk',
    'kSssSk',
    'kKggKk',
    'kSssSk',
    'kKKKKk',
    'wwwwww',
]
HIGHTOP_FAR = {'G': 'g', 'g': 'K', 'S': 's', 'w': 's', 'c': 'K'}
BRACER_PUNK = {'W': '#ffffff', 'w': '#cdf2f0', 'q': '#62d2cc', 'Q': '#2c9c98', 'K': '#1c1c24'}


def classic_legend():
    return {**ramp_legend('abcde', JACKET), **ramp_legend('Ffg', FUR), **NECK, **HARNESS, **WHITE,
            **GLOW, **ORANGE, 's': '#dde2e6', 't': '#fff8e6'}


def legs(leg, thigh=THIGH, thigh_left=THIGH_LEFT, knee=KNEE, shin=SHIN, stops=SUIT_STOPS):
    """The leg pictures, the suit's colour running down them (hip 0 → ankle 1)."""
    out = {
        '53': gradient(thigh, leg, 0.0, 0.5, stops), '49': gradient(darker(thigh, FAR_LEG), leg, 0.0, 0.5, stops),
        '62': gradient(knee, leg, 0.48, 0.58, stops),
    }
    if shin:
        out['30'] = gradient(shin, leg, 0.58, 1.0, stops)
    if thigh_left:
        out['53:left'] = gradient(thigh_left, leg, 0.0, 0.5, stops)
        out['49:left'] = gradient(darker(thigh_left, FAR_LEG), leg, 0.0, 0.5, stops)
    return out


def pictures(look='classic'):
    """{key: Pic} of every upright picture drawn here for a look."""
    base = classic_legend()
    if look == 'slipstream':
        leg = {**base, **ramp_legend('abcde', FLIGHT), **VEST, **BOOT, **SCARF, 'o': '#ee8424'}
        out = {
            '57': pic(SLIP_57, leg), '61': pic(SLIP_61, leg),
            '34': gradient(SLIP_34, leg, 0.0, 0.05, FLIGHT_STOPS), '38': gradient(SLIP_38, leg, 0.0, 0.05, FLIGHT_STOPS),
            **legs(leg, SLIP_THIGH, None, SLIP_KNEE, None, FLIGHT_STOPS),
            '30': pic(SLIP_SHIN, leg),
            '5:right': pic(SLIP_UPPER, leg), '9:right': pic(SLIP_UPPER, leg),
            '5:left': pic(SLIP_UPPER, leg), '9:left': pic(SLIP_UPPER, leg),
            '1': pic(BRACER, {**leg, **BRACER_BLUE}),
            '39': pic(BOOT_39, BOOT), '43': pic(darker(BOOT_39, BOOT_FAR), BOOT),
            '47': pic(BOOT_47, BOOT), '48': pic(BOOT_48, BOOT),
        }
        return out
    if look == 'punk':
        leg = {**base, **ramp_legend('abcde', LEATHER), **PUNK, 'n': '#f4b68e', 'N': '#d88a66', 'K': '#0e0d12'}
        flag = {**leg, 'W': '#ffffff'}
        upper = [r.replace('F', 'S').replace('f', 'b').replace('g', 'c') for r in UPPER]
        out = {
            '57': pic(PUNK_57, leg), '61': pic(PUNK_61, leg),
            '34': pic(PUNK_34, leg), '38': pic(PUNK_38, leg),
            **legs(leg, PUNK_THIGH, PUNK_THIGH_LEFT, KNEE, PUNK_SHIN, PINK_STOPS),
            '5:right': pic(upper, leg), '9:right': pic(upper, leg),
            '5:left': pic(upper, leg), '9:left': pic(upper, leg),
            '1': pic(BRACER, {**leg, **BRACER_PUNK}),
            '39': pic(HIGHTOP_39, HIGHTOP), '43': pic(darker(HIGHTOP_39, HIGHTOP_FAR), HIGHTOP),
            '47': pic(HIGHTOP_47, HIGHTOP), '48': pic(HIGHTOP_48, HIGHTOP),
        }
        return out
    leg = base
    flag = {**leg, **FLAG}
    return {
        '57': pic(CLASSIC_57, leg), '61': pic(CLASSIC_61, leg),
        '34': gradient(CLASSIC_34, leg, 0.0, 0.05), '38': gradient(CLASSIC_38, leg, 0.0, 0.05),
        **legs(leg),
        '5:right': pic(UPPER_RIGHT, flag), '9:right': pic(UPPER_RIGHT, flag),
        '5:left': pic(UPPER_LEFT, leg), '9:left': pic(UPPER_LEFT, leg),
        '1': pic(BRACER, leg),
        '39': pic(SHOE_39, SHOE), '43': pic(darker(SHOE_39, SHOE_FAR), SHOE),
        '47': pic(SHOE_47, SHOE), '48': pic(SHOE_48, SHOE),
    }
