"""Shahzada's heads on the pompadour man's (9): tanned, hair grown to the shoulders; wrapped in a
scarf; half of it turned to dark sand."""
from heads import Pic, Palette, skin_tones, beard
from gridpng import sheet

TAN = ['#f8dcae', '#ecbf88', '#d8a26c', '#bf8450', '#9c6438', '#744424', '#4e2a14']
EYE_WHITE = '#fff3bd'
HAIR = {'h': '#5e4433', 'H': '#3b2a20', 'D': '#22170f', 'k': '#0e0906'}
HAIR_MAP = {'#42495a': '#5e4433', '#292c39': '#3b2a20', '#000400': '#170f0a', '#391808': '#2a1c12'}


def tanned(front=False):
    p = Pic.orig(9, front)
    skin_tones(p, TAN, keep=[EYE_WHITE])
    return p.recolor(HAIR_MAP)


def long_hair(front=False):
    """Hair down to the shoulders behind the jaw."""
    p = tanned(front).pad(bottom=3)
    p.paint([
        '.HHH....',
        'kHhHH...',
        'kHhHHH..',
        'kHhHHH..',
        'kHHhHH..',
        '.kHhHH..',
        '.kHHhH..',
        '..kHHHk.',
        '..kHHk..',
        '...kk...',
    ], HAIR, 0, 9)
    return p


def bearded(front=False):
    """The warrior: grim, stubble over the jaw."""
    p = long_hair(front)
    return beard(p, 12, 16, 6, ['#6a4a34', '#4e3424', '#3a2618'], keep=[EYE_WHITE, '#fff3bd'])


SCARF = {'B': '#2f5fb0', 'L': '#4f86d8', 'n': '#1f3f80', 'O': '#d8642a', 'o': '#f08a40', 'k': '#0e0906'}


def wrapped(front=False):
    """The wanderer: a blue scarf over the hair and an orange one over the mouth and nose."""
    p = tanned(front).pad(bottom=2)
    if not front:
        p.paint([
            '...kkkkkkkk.....',
            '..kBBLLLBBBk....',
            '.kBBLBBBBBBBk...',
            '.kBLBBBBBBBBBk..',
            'kOoOoOoOoOoOoOk.',
            'kBBBBBBBBk......',
            'kBBnBBBBk.......',
            'kBBnBBBk........',
            'kBBnBBk.........',
            'kBBBBBkOOOOOOOOk',
            'kBBBBkOoOoOoOoOk',
            '.kBBBkOOOOOOOOk.',
            '.kBBBBkOoOoOok..',
            '..kBBBBkOOOOk...',
            '..kBBBBkkkkk....',
            '...kBBk.........',
            '....kk..........',
        ], SCARF)
    else:
        p.paint([
            '...kkkkkkkk.....',
            '..kBBLLLBBBk....',
            '.kBBLBBBBBBBk...',
            '.kBLBBBBBBBBBk..',
            '.kOoOoOoOoOoOok.',
            '.kBBk...........',
            '.kBBk...........',
            '.kBnk...........',
            '.kBnBk..........',
            '.kBBBkOOOOOOOOk.',
            '..kBkOoOoOoOoOk.',
            '..kBBkOOOOOOOOk.',
            '...kBkOoOoOoOk..',
            '...kBBkOOOOOk...',
            '....kBkkkkkk....',
            '....kBk.........',
            '.....k..........',
        ], SCARF)
    return p


DARK = ['#5a5266', '#3a3446', '#262230', '#1a1722', '#110e18', '#0a0810', '#06050a']
GLOW = {'g': '#ff9a2a', 'G': '#ffd060', 'e': '#ffe08a'}


def dark_half(front=False):
    """His left side: the skin gone to dark sand, cracks and an eye glowing."""
    p = long_hair(front)
    skin_tones(p, DARK, keep=[EYE_WHITE])
    for (x, y) in p.where([EYE_WHITE]):
        p.set(x, y, GLOW['e'])
    p.paint([
        '........g.......',
        '.......g........',
        '.........g......',
        '........g.g.....',
        '.......g...g....',
        '..........g.....',
    ], GLOW, 0, 9)
    return p


if __name__ == '__main__':
    pics = [Pic.orig(9), long_hair(), bearded(), bearded(True), wrapped(), dark_half(), Pic.orig(9, True), long_hair(True), wrapped(True)]
    pal = Palette()
    sheet('sh-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=9, per_row=7)
    print('ok')
