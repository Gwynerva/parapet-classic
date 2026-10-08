"""The author's room (from the photos), as the props of Pierre's world (stages.py)."""
from lookgen import Canvas

ROOM_PALETTE = {
    # wallpaper
    'w': '#e7dcb8', 'W': '#d9cda6', 'x': '#cfc29a',
    'o': '#c8a463', 'O': '#a88445', 'i': '#e9d6a6',
    # wood floor, skirting
    'f': '#c47a3e', 'F': '#a8622c', 'G': '#8c4f22', 's': '#d8b88a',
    # black furniture
    'k': '#1b1c20', 'K': '#2c2e34', 'q': '#3b3e46', 'Q': '#5a5e68',
    # screens
    'r': '#3a0f14', 'R': '#7a1f2a', 'v': '#f0e6e8', 'b': '#3b4f8a', 'B': '#7a8fd0', 'n': '#c7b8f0',
    # bed and textiles
    'p': '#f28a74', 'P': '#d96c58', 'g': '#dfe8d8', 'h': '#a9c09a', 'H': '#7f9c74', 'u': '#efe6d8',
    # light wood
    'l': '#d9a865', 'L': '#bf8c4a', 'm': '#9c6b33',
    # dark wood
    'd': '#7a4a2a', 'D': '#5c3420', 'e': '#a06a3c',
    # window, blinds
    'c': '#f4f7f8', 'C': '#bcd7e6', 'z': '#3a2c2a', 'Z': '#f0ecdf',
    # frames, art
    'a': '#e8c27a', 'A': '#f6f0e2', 't': '#5a4a3a', 'y': '#e7b6c8', 'Y': '#c63a54', 'j': '#b8a6e6', 'J': '#7a64c8',
    'M': '#e8a0c8', 'E': '#7aa0d8',
    # misc
    'T': '#9aa0aa', 'U': '#cfd4dc', 'V': '#e8b450', 'N': '#40c060', 'I': '#ffd884',
}


def wallpaper(h=170):
    """One repeat of the wallpaper: stripes and chains of golden rings."""
    c = Canvas(48, h, 'w')
    for x in range(0, 48, 12):
        c.rect(x, 0, 1, h, 'W')
        c.rect(x + 6, 0, 1, h, 'x')
    def ring(cx, cy, r):
        c.disc(cx, cy, r, 'o')
        if r >= 2:
            c.disc(cx, cy, r - 1, 'i')
            c.disc(cx, cy, max(0.6, r - 2), 'O')
    # Two chains of rings hanging from the top at different phases.
    y = 4
    k = 0
    while y < h - 30:
        r = [3, 1.5, 2, 1, 3, 2][k % 6]
        ring(18, y, r)
        y += int(r * 2 + 3)
        k += 1
    y = 30
    k = 3
    while y < h - 20:
        r = [3, 1.5, 2, 1, 3, 2][k % 6]
        ring(38, y, r)
        y += int(r * 2 + 3)
        k += 1
    return c.rows()


def floor():
    c = Canvas(40, 12, 'f')
    c.rect(0, 0, 40, 2, 'G')
    for y in range(3, 12, 3):
        c.rect(0, y, 40, 1, 'F')
    for x, y in ((7, 2), (23, 5), (33, 8), (14, 8), (30, 2)):
        c.rect(x, y, 1, 3, 'F')
    return c.rows()


def skirting():
    c = Canvas(40, 3, 's')
    c.rect(0, 2, 40, 1, 'O')
    return c.rows()


def window():
    c = Canvas(26, 40)
    c.rect(0, 0, 26, 40, 'U')
    c.rect(2, 2, 22, 34, 'C')
    c.rect(2, 2, 22, 34, 'c')
    c.rect(12, 2, 2, 34, 'U')
    # Zebra blinds pulled half down.
    for y in range(0, 22, 3):
        c.rect(0, y, 26, 2, 'z')
        c.rect(0, y + 2, 26, 1, 'Z')
    c.rect(0, 36, 26, 4, 'u')
    return c.rows()


def radiator():
    c = Canvas(22, 12)
    for x in range(0, 22, 4):
        c.rect(x, 0, 3, 12, 'U')
        c.rect(x + 2, 0, 1, 12, 'T')
    c.rect(0, 10, 22, 2, 'T')
    return c.rows()


def cat_frame():
    c = Canvas(16, 18)
    c.rect(0, 0, 16, 18, 'a')
    c.rect(2, 2, 12, 14, 'A')
    # The cat drawn in a few lines.
    for x, y in ((6, 7), (7, 6), (8, 7), (6, 8), (6, 9), (7, 10), (8, 10), (9, 11), (10, 11), (11, 10), (7, 12), (11, 12)):
        c.set(x, y, 't')
    c.set(10, 4, 't')
    return c.rows()


def poster():
    c = Canvas(10, 13)
    c.rect(0, 0, 10, 13, 'y')
    c.rect(2, 1, 6, 4, 'M')
    c.rect(3, 3, 4, 3, 'u')
    c.rect(2, 6, 6, 7, 'Y')
    c.rect(1, 0, 2, 9, 'M')
    return c.rows()


def painting():
    c = Canvas(18, 22)
    c.rect(0, 0, 18, 22, 'n')
    c.rect(0, 0, 18, 8, 'B')
    c.rect(0, 4, 18, 4, 'n')
    for x in range(18):
        top = 7 + abs((x % 9) - 4)
        c.rect(x, top, 1, 6, 'j')
        c.rect(x, top + 6, 1, 2, 'J')
    c.rect(0, 15, 18, 3, 'E')
    c.rect(4, 14, 3, 1, 'u')
    c.rect(0, 19, 18, 3, 'J')
    return c.rows()


def desk():
    """The black desk with two screens, the lamp bar, a keyboard and the computer under it."""
    c = Canvas(60, 46)
    # Lamp bar.
    c.rect(14, 0, 22, 1, 'k')
    c.rect(24, 1, 1, 8, 'k')
    c.rect(14, 1, 3, 1, 'I')
    # Big screen.
    c.rect(14, 5, 22, 14, 'k')
    c.rect(15, 6, 20, 12, 'r')
    c.rect(22, 8, 6, 8, 'R')
    c.rect(24, 9, 2, 5, 'v')
    c.rect(24, 19, 2, 3, 'K')
    # Side screen, turned.
    c.rect(40, 9, 7, 13, 'k')
    c.rect(41, 10, 5, 11, 'b')
    c.rect(42, 12, 3, 6, 'B')
    c.rect(43, 22, 1, 2, 'K')
    # Speakers.
    c.rect(48, 13, 6, 11, 'K')
    c.rect(49, 15, 4, 3, 'q')
    c.rect(8, 15, 4, 9, 'K')
    # Keyboard (yellow keys) and the mat.
    c.rect(14, 23, 14, 2, 'Q')
    c.rect(15, 23, 2, 1, 'V')
    c.rect(20, 23, 2, 1, 'V')
    c.rect(28, 24, 20, 1, 'b')
    # The top and the legs.
    c.rect(4, 25, 56, 3, 'k')
    c.rect(4, 25, 56, 1, 'q')
    c.rect(6, 28, 3, 18, 'k')
    c.rect(55, 28, 3, 18, 'k')
    c.rect(6, 44, 52, 2, 'k')
    # The computer tower with its blue light.
    c.rect(38, 30, 12, 16, 'K')
    c.rect(40, 32, 8, 12, 'k')
    c.rect(48, 34, 1, 6, 'E')
    return c.rows()


def chair():
    c = Canvas(22, 40)
    c.rect(4, 0, 12, 20, 'k')
    c.rect(5, 1, 10, 18, 'K')
    c.rect(6, 3, 8, 1, 'q')
    c.rect(2, 20, 18, 5, 'k')
    c.rect(1, 18, 3, 3, 'k')
    c.rect(18, 18, 3, 3, 'k')
    c.rect(10, 25, 2, 9, 'K')
    c.line(2, 37, 20, 37, 'k')
    c.line(4, 35, 18, 35, 'k')
    for x in (2, 11, 20):
        c.rect(x - 1, 37, 2, 3, 'k')
    return c.rows()


def bed():
    c = Canvas(52, 18)
    c.rect(0, 2, 6, 16, 'e')
    c.rect(4, 4, 12, 6, 'p')
    c.rect(4, 8, 12, 2, 'P')
    c.rect(4, 8, 48, 8, 'g')
    for x in range(8, 52, 6):
        c.set(x, 10, 'h').set(x + 1, 11, 'h').set(x + 2, 12, 'H').set(x - 1, 13, 'h')
    c.rect(4, 16, 48, 2, 'L')
    return c.rows()


def shelf():
    """The open wardrobe of light wood with clothes on the rail and on the shelves."""
    c = Canvas(44, 56)
    c.rect(0, 2, 44, 54, 'l')
    c.rect(2, 4, 22, 40, 'L')
    c.rect(26, 4, 16, 50, 'L')
    for y in (16, 30, 42):
        c.rect(26, y, 16, 2, 'l')
    c.rect(2, 44, 22, 2, 'l')
    c.rect(2, 7, 22, 1, 'U')
    # Clothes on hangers: dark, grey, white.
    c.rect(4, 8, 5, 22, 'K')
    c.rect(9, 8, 8, 24, 'T')
    c.rect(11, 12, 3, 3, 'V')
    c.rect(18, 8, 4, 26, 'A')
    # Folded clothes.
    c.rect(28, 12, 12, 4, 'q')
    c.rect(28, 26, 12, 4, 'E')
    c.rect(28, 38, 10, 4, 'b')
    c.rect(4, 47, 8, 4, 'E')
    c.rect(13, 47, 9, 4, 'u')
    # A grey jumper on top and a black backpack.
    c.rect(2, 0, 16, 3, 'T')
    c.rect(30, -6 if False else 0, 0, 0, 'k')
    return c.rows()


def backpack():
    c = Canvas(14, 12)
    c.rect(1, 2, 12, 10, 'k')
    c.rect(3, 0, 8, 3, 'k')
    c.rect(4, 5, 6, 4, 'K')
    return c.rows()


def mirror():
    """The three-leaf mirror on the dark chest of drawers."""
    c = Canvas(34, 56)
    c.rect(1, 0, 32, 30, 'U')
    c.rect(2, 1, 9, 28, 'C')
    c.rect(12, 1, 10, 28, 'c')
    c.rect(23, 1, 9, 28, 'C')
    c.line(14, 26, 20, 4, 'U')
    c.rect(0, 30, 34, 26, 'd')
    for y in (34, 42, 50):
        c.rect(2, y, 30, 6, 'D')
        c.rect(3, y + 1, 28, 1, 'e')
        c.rect(15, y + 3, 4, 1, 'a')
    c.rect(8, 27, 4, 3, 'V')
    c.rect(22, 26, 3, 4, 'A')
    return c.rows()


def door():
    c = Canvas(26, 62)
    c.rect(0, 0, 26, 62, 'e')
    c.rect(2, 2, 22, 60, 'l')
    c.rect(4, 2, 1, 60, 'L')
    # The peach towel over the top.
    c.rect(8, 1, 16, 26, 'p')
    c.rect(8, 22, 16, 1, 'P')
    c.rect(8, 24, 16, 1, 'P')
    c.rect(4, 32, 4, 2, 'a')
    c.rect(4, 36, 2, 2, 'a')
    return c.rows()


def swords():
    c = Canvas(12, 46)
    c.line(2, 2, 4, 45, 'T')
    c.line(3, 2, 5, 45, 'U')
    c.rect(0, 6, 7, 1, 'k')
    c.rect(2, 0, 2, 6, 'k')
    c.line(8, 4, 9, 45, 'V')
    c.line(9, 4, 10, 45, 'k')
    c.rect(6, 9, 6, 1, 'V')
    c.rect(8, 2, 2, 7, 'k')
    return c.rows()


def glass_shelf():
    c = Canvas(20, 26)
    for y in (0, 12, 24):
        c.rect(0, y, 20, 2, 'q')
    c.rect(1, 0, 1, 26, 'k')
    c.rect(18, 0, 1, 26, 'k')
    c.rect(4, 9, 6, 3, 'k')
    c.rect(12, 20, 4, 4, 'u')
    c.rect(13, 18, 2, 2, 'E')
    return c.rows()


def dust_emitter():
    return {
        'perSecond': 5, 'anchor': 'body', 'speed': [2, 6], 'angle': [60, 120], 'gravity': -2,
        'life': [1500, 2600], 'fadeIn': 400, 'fadeOut': 700,
        'rect': {'size': 1, 'colors': ['#fff6d8', '#f2e2b0']},
    }
