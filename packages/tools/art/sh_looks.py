"""Shahzada's looks: an athletic prince (arms and chest a pixel stronger), baggy trousers (legs
two pixels fuller), long hair, and cloth that tells them apart: the blue sash of the sands, the
red one of the warrior, the long scarf of the wanderer, the dark prince's chain."""
from lookgen import *
from heads import Palette
from body import outfit_parts, write_parts
from sh_heads import long_hair, wrapped, dark_half, bearded

TAN = ['#f2c48a', '#d9a066', '#b97e48', '#8c5a30', '#5a3418']
BOOTS = ['#7a4a26', '#5a3418', '#3a2010']
LEATHER_BAND = {WRIST[0]: '#8c5a30', WRIST[1]: '#5a3418', WRIST[2]: '#3a2010'}
SOT_PANTS = ['#f4efe2', '#e2d9c4', '#c4b89c', '#a39478', '#7a6c54']
WW_LEATHER = ['#3a2e2a', '#2a201c', '#1a1210']
WW_PANTS = ['#4a4446', '#3a3436', '#2c2628', '#201c1e', '#141012']
RUST = ['#e08a4a', '#c46a30', '#a0521f', '#7a3c14', '#58280a']
VEST = ['#6a5848', '#4e4034', '#342a22']
DARK_RAMP = ['#4a4656', '#2e2a36', '#1c1a22', '#121018', '#08060c']

KIT_RULES = [
    *skin(TAN, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(FOREARM, LEATHER_BAND),
    recolor(SHOES, {**ramp(SHOE['main'], BOOTS), '#d64908': BOOTS[1], '#fffbe7': '#a87a4a',
                    '#d6cbb5': '#5a3418', '#8c8273': '#3a2010'}),
]
# Strong arms and chest, full trousers.
PLAN = {'chest': 1, 'upper-arm': 1, 'forearm': 1, 'torso': 1, 'thigh': 2, 'knee': 2, 'shin': 1}


def sash(colours, length=16, width=4):
    """A cloth band hanging from the belt: its two tones in stripes, a fringe at the end."""
    a, b, fringe = colours
    rows = []
    for y in range(length):
        if y >= length - 2:
            rows.append(''.join(fringe if x % 2 == 0 else '.' for x in range(width)))
        else:
            rows.append(a + b * (width - 2) + a)
    return rows


def scarf(length=26):
    """The wanderer's scarf: blue with an orange band near its end, frayed."""
    rows = []
    for y in range(length):
        if length - 8 <= y < length - 5:
            rows.append('OooO')
        elif y >= length - 2:
            rows.append('B.B.' if y % 2 else '.n.n')
        else:
            rows.append('nBLB' if y % 6 < 3 else 'nBBL')
    return rows


def make(look_id, rules, head, front, ribbons, extra=None, head_left=None, effect=None, accent='#e8b84a'):
    pal = Palette({'k': '#0e0906', 'B': '#2f5fb0', 'L': '#4f86d8', 'n': '#1f3f80', 'O': '#d8642a', 'o': '#f08a40',
                   'q': '#5a3418', 'g': '#e8b84a', 'G': '#c9963a', 'r': '#c0392b', 'R': '#801818', 's': '#9aa2ae'})
    all_rules = KIT_RULES + rules
    look = {'id': look_id, 'base': 1, 'accent': accent, '_raw_heads': True, 'recolor': all_rules}
    if effect:
        look['effect'] = effect
    write_parts(look, outfit_parts(1, all_rules, PLAN), pal)
    look['parts']['25'] = pal.rows(head)
    look['parts']['29'] = pal.rows(front)
    if head_left is not None:
        look['parts']['25:left'] = pal.rows(head_left)
    if extra:
        extra(look, pal)
    look['ribbons'] = ribbons
    look['palette'] = pal.pal
    path = write_look('shahzada', look)
    rotate(path, [25] + (['25:left'] if head_left is not None else []))
    preview(look_id)


def strap(look, pal):
    """A leather strap across the bare chest of the sands (on the grown chest: one pixel in)."""
    rows = look['parts']['57']
    h = len(rows)
    for i in range(min(h - 3, 9)):
        y = 4 + i
        x = 2 + i
        r = rows[y]
        if x + 1 < len(r) and r[x] != '.':
            rows[y] = r[:x] + 'qq' + r[x + 2:]


make('sands', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, TAN[1:4])),
    recolor(TORSO, {BELT[0]: '#4f86d8', BELT[1]: '#2f5fb0'}),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, SOT_PANTS)),
    recolor(SHIN, ramp(SHIN_SKIN, SOT_PANTS[1:4])),
], long_hair(), long_hair(True), {
    'sash': {'anchor': 'hips', 'offset': [3, 1], 'texture': sash(('n', 'B', 'g')), 'segments': 4,
             'gravity': 260, 'drag': 2.4},
}, extra=strap)

make('warrior', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, WW_LEATHER)),
    recolor(TORSO, {BELT[0]: '#c0392b', BELT[1]: '#801818'}),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, WW_PANTS)),
    recolor(SHIN, ramp(SHIN_SKIN, WW_PANTS[1:4])),
    recolor(FOREARM, {**LEATHER_BAND, WRIST[0]: '#6a6e76'}),
], bearded(), bearded(True), {
    'sash': {'anchor': 'hips', 'offset': [3, 1], 'texture': sash(('R', 'r', 'R'), length=20), 'segments': 5,
             'gravity': 240, 'drag': 2.6},
}, accent='#c0392b')

make('wanderer', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, VEST)),
    recolor(TORSO, {BELT[0]: '#a87a4a', BELT[1]: '#5a3418'}),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, RUST)),
    recolor(SHIN, ramp(SHIN_SKIN, ['#c9a878', '#a8865a', '#86663e'])),
    # A plated gauntlet on his left arm only.
    recolor(FOREARM + HAND, {**ramp(TAN, ['#c9ced6', '#9aa2ae', '#727a86', '#4e5560', '#2e333a']),
                             '#ffcb84': '#9aa2ae', '#a56531': '#4e5560', **{c: '#3a3f48' for c in WRIST}}) | {'on': 'left'},
], wrapped(), wrapped(True), {
    'scarf': {'anchor': 'neck', 'offset': [2, 0], 'texture': scarf(), 'segments': 7, 'gravity': 170, 'drag': 2.8},
}, accent='#d8642a')

make('dark-prince', [
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, ['#f0ece2', '#d0c8b8', '#a89e8c'])),
    recolor(TORSO, {BELT[0]: '#c0392b', BELT[1]: '#801818'}),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, ['#5a3a2a', '#4a2e20', '#3a2418', '#2c1a10', '#1e1008'])),
    recolor(SHIN, ramp(SHIN_SKIN, ['#4a2e20', '#3a2418', '#2c1a10'])),
    # His left side: black skin with glowing cracks of sand.
    recolor(ARMS + HAND, {**ramp(TAN, DARK_RAMP), '#ffcb84': '#ff9a2a', '#a56531': '#121018'}) | {'on': 'left'},
    recolor(CHEST + TORSO, ramp(TAN, ['#ffb000', '#2e2a36', '#1c1a22', '#121018', '#08060c'])) | {'on': 'left'},
], long_hair(), long_hair(True), {
    'chain': {'anchor': 'hand.far', 'offset': [0, 0], 'segments': 5, 'length': 3, 'width': 1,
              'colors': ['#9aa2ae', '#c9ced6'], 'gravity': 300, 'drag': 2, 'layer': 'behind'},
}, head_left=dark_half(), effect=['dark-sands'], accent='#ff9a2a')
print('shahzada looks written')
