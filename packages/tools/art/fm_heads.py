"""Flittermouse's heads: the pompadour man's face (9) under a cowl with ears."""
from heads import Pic, skin_tones
from gridpng import sheet

COWL = {'k': '#0b0b0f', 'D': '#17181d', 'A': '#262830', 'L': '#3a3d48', 'H': '#545866',
        'w': '#f2f6ff', 'W': '#aeb8cc', 'r': '#ff2a2a', 'R': '#ff9a9a'}


def cowl(eyes='w'):
    """Profile: ears up top, the cowl to the nose, the mouth and chin left bare."""
    p = Pic.orig(9).pad(top=4)
    lens = 'wW' if eyes == 'w' else 'rR'
    p.paint([
        '.....k.....k....',
        '.....kk...kHk...',
        '....kHk..kHLk...',
        '....kLAk.kHLAk..',
        '...kHLAAkkLAAk..',
        '..kHLLAAAAAAAAk.',
        '.kHLAAAAAAAAALHk',
        '.kLAAAAAAAAAALHk',
        'kHLAAAAAAAAAALHk',
        'kLAAAAAAAAAAAAHk',
        'kDAAAAAAAAAAAALk',
        'kDAAAAAAAAAkkkkk',
        f'kDDAAAAAAAk{lens}kLk',
        'kDDAAAAAAAAkkALk',
        'kDDDAAAAAAAAAAAk',
        'kDDDAAAAAk....kk',
        'kDDDDAAAk.......',
        'kDDDDAAk........',
        '.kDDDAk.........',
        '.kDDDk..........',
        '..kkk...........',
    ], COWL)
    return p


def cowl_front(eyes='w'):
    p = Pic.orig(9, front=True).pad(top=4)
    l = 'wW' if eyes == 'w' else 'rR'
    p.paint([
        '..k..........k..',
        '..kk........kk..',
        '..kHk......kHk..',
        '.kHLAkkkkkkALHk.',
        '.kLAAAHHHHAAALk.',
        'kDLAAHLLLLHAALDk',
        'kDAAAALLLLAAAADk',
        'kDAAAAAAAAAAAADk',
        'kDAAAAAAAAAAAADk',
        'kDAAAAAHHAAAAADk',
        'kDAkkkkAAkkkkADk',
        f'kDAk{l}kAAk{l}kADk',
        'kDAAkkAHHAkkAADk',
        'kDDAAAAHHAAAADDk',
        'kDDDAAALLAAADDDk',
        '.kDDDk.....kDDDk',
        '.kDDk.......kDk.',
        '..kDk.......kk..',
        '...k............',
    ], COWL)
    return p


if __name__ == '__main__':
    o = Pic.orig(9)
    pics = [o, cowl(), cowl('r'), Pic.orig(9, True), cowl_front(), cowl_front('r')]
    from heads import Palette
    pal = Palette()
    sheet('fm-heads.png', [(pal.rows(p), pal.pal) for p in pics], scale=9, per_row=6)
    print('ok')
