"""The twin brother's gear, drawn on the back (attachments, turned with the part they hang on):

- the swordsman's ornate longsword in a black scabbard: a round silver pommel, a carved silver
  guard with flared ends, the scabbard's silver chape; the hilt over the shoulder behind his head;
- the fencer's two synthetic feders: yellow blades with black bands, a wide flared schilt under
  the black-and-yellow guard, black grips, yellow pommels; fanned behind the shoulders;
- the undercover cosplayer's white katana: a white braided grip with black diamonds, a round
  black guard rimmed in white, a bright blade, a white tassel from the pommel; resting over the
  shoulder as in the photo (over the chest, so the grip shows on his back and the blade rises
  behind his head), over a slim black backpack whose straps cross his chest.

Pictures are text grids; '+' marks the pixel on the part's point."""
SILVER = {'X': '#f2f5fa', 'x': '#bcc4d0', 'y': '#808a9a', 'Y': '#4c5462'}
SCABBARD = {'Z': '#16161c', 'z': '#3a3a46'}
FEDER = {'a': '#f6dc4a', 'A': '#c09a1c', 'n': '#16140e', 'N': '#3a3628'}
KATANA = {'w': '#ffffff', 'W': '#cfd3dc', 'k': '#121216', 'b': '#e8eef6', 'B': '#9aa4b4'}
PACK = {'q': '#1e1f26', 'Q': '#3c3e4a', 'p': '#0e0e12', 'P': '#8a8e9a'}
PROPS = {**SILVER, **SCABBARD, **FEDER, **KATANA, **PACK}

# fmt: off
# On the chest (57; the front to the right, '+' the chest's point): the round pommel and the
# carved guard over the back shoulder behind the head; the scabbard down the back, its silver
# chape showing past the hips.
LONGSWORD = [
    #0123456789ABCDEF
    '................',  # 0
    '................',  # 1
    '..xX............',  # 2  the round pommel
    '..Yx............',  # 3
    '...yx...........',  # 4  the grip, wound in silver
    '...Yy...........',  # 5
    '...yx...........',  # 6
    'x...Yy.x........',  # 7  the guard's flared, carved ends
    'yxXxXxXy........',  # 8
    '.Y..Xx..Y.......',  # 9  the scabbard's silver throat
    '....Zz..........',  # 10
    '....Zz..........',  # 11
    '....Zz..........',  # 12
    '....Zz..........',  # 13
    '.....Zz.......+.',  # 14
    '.....Zz.........',  # 15
    '.....Zz.........',  # 16
    '.....Zz.........',  # 17
    '.....Zz.........',  # 18
    '.....Zz.........',  # 19
    '.....Zz.........',  # 20
    '.....Zz.........',  # 21
    '......Zz........',  # 22
    '......Zz........',  # 23
    '......Zz........',  # 24
    '......Zz........',  # 25
    '......Zz........',  # 26
    '......Zz........',  # 27
    '......Zz........',  # 28
    '......Zz........',  # 29
    '......Zz........',  # 30
    '......xX........',  # 31 the silver chape
    '......yx........',  # 32
    '.......Y........',  # 33
]
# Two feders fanned on the back, hilts behind the head and the shoulder.
FEDERS = [
    #0123456789ABCDEF
    '.....a..........',  # 0  the pommels
    '.....n..........',  # 1  the black grips
    '..a..n..........',  # 2
    '..n..n..........',  # 3
    '..n.aNnNa.......',  # 4  a guard
    '..n..aAa........',  # 5  the schilt, flared
    'aNnNa.aA........',  # 6  the other guard
    '.aAa..aA........',  # 7
    '..aA..nn........',  # 8  black bands down the yellow blades
    '..aA..aA........',  # 9
    '..nn..aA........',  # 10
    '..aA..aA........',  # 11
    '..aA..nn........',  # 12
    '..aA...aA.......',  # 13
    '...nn..aA.....+.',  # 14
    '...aA..aA.......',  # 15
    '...aA..nn.......',  # 16
    '...aA..aA.......',  # 17
    '...nn..aA.......',  # 18
    '...aA..aA.......',  # 19
    '...aA...nn......',  # 20
    '....aA..aA......',  # 21
    '....nn..aA......',  # 22
    '....aA..aA......',  # 23
    '....aA..nn......',  # 24
    '....aA..aA......',  # 25
    '....nn..aA......',  # 26
    '....aA...a......',  # 27
    '.....a..........',  # 28
]
# Over the chest: the grip behind the shoulder, the blade rising behind the head.
KATANA_SHOULDER = [
    #0123456789ABCDEFGHIJK
    'b....................',  # 0  the tip, high behind the head
    'bB...................',  # 1
    '.bB..................',  # 2
    '..bB.................',  # 3
    '...bB................',  # 4
    '....bB...............',  # 5
    '.....bB..............',  # 6
    '......bB.............',  # 7
    '.......bB............',  # 8  (behind the head)
    '........bB...........',  # 9
    '.........bB..........',  # 10
    '..........bB.........',  # 11 over the shoulder
    '...........kk........',  # 12 the round guard, black rimmed white
    '..........kwwk.......',  # 13
    '............wW.......',  # 14 the white braided grip, black diamonds
    '............Wk.......',  # 15
    '.............wW......',  # 16
    '.............Wk...+..',  # 17
    '..............wW.....',  # 18
    '..............kk.....',  # 19 the pommel
    '..............wW.....',  # 20 the white tassel hanging from it
    '..............Ww.....',  # 21
    '.............w.W.....',  # 22
]
# The black backpack on his back (the photo shows its straps), slim, under the katana.
BACKPACK = [
    #0123456789ABCDEF
    '................',  # 0
    '................',  # 1
    '................',  # 2
    '................',  # 3
    '................',  # 4
    '................',  # 5
    '................',  # 6
    '................',  # 7
    '..pqqqp.........',  # 8
    '.pqQQqqp........',  # 9  its top, a grab loop's sheen
    '.qQqqqqp........',  # 10
    '.qqqqqqp........',  # 11
    '.qQqqqqp........',  # 12
    '.qqqqqqp......+.',  # 13
    '.qqPqqqp........',  # 14 a zip pull
    '.qqqqqqp........',  # 15
    '.qqqqqqp........',  # 16
    '..qqqqp.........',  # 17
    '...ppp..........',  # 18
]
# fmt: on


def check():
    for name, rows in (('longsword', LONGSWORD), ('feders', FEDERS), ('katana', KATANA_SHOULDER), ('pack', BACKPACK)):
        for y, r in enumerate(rows):
            assert len(r) == len(rows[0]), f'{name} row {y}: {len(r)} wide'
            for ch in r:
                assert ch in '.+' or ch in PROPS, f'{name} row {y}: {ch!r}'


check()
