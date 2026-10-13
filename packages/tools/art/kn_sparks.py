"""Sir Nobody's steel sparks: where his armour strikes or scrapes stone on a trick, a short jet of
hot sparks, and nowhere else (never while he just runs).

* the boot's toe on the wall: every kick of a wall run (33, 36, 37), the kick off the wall of a
  wall flip (48), sliding down a wall (13): a jet off the wall, back and down; the tic-tac's kick
  (20), where he has already turned his back to the wall: the same jet, mirrored;
* the sabatons on the roof: a touchdown (24 hard, 25 soft): a spray hopping back off the trailing
  heel and a little one off the toe; after a wall flip (51), where he comes down backwards, one
  thrown the wall's way; the roll (21): the greaves skid, a scrape thrown back behind him;
* the sabatons on the block of a monkey vault (62); the gauntlets on the roof as a tiger jump comes
  down (60), on the block (66-69 spider jump, monkey flip) and on a steel pole (123, 125, 127);
* the flip's whip (63, 65 front, 64 back): a few flung down off the heels as they swing round.

A spark is born as a glint (the glints of a burst together are the flash where the steel struck),
then streaks along its flight, 6 pixels white-hot at the head through yellow to an orange tail,
cooling and shortening (5, 4, 3, 2 pixels) as it slows, then dies as one orange pixel, a deep
orange one, a dim ember: under half a second. `face` mirrors the streaks with the runner;
drawn added (`blend: add`), in front of him, so it burns over the dark Hollow steel as over the
sky. It leaves fast (150-320 px/s) and stops short (drag 5), then droops (gravity), so a jet opens
into a fan 15-25 px across and is gone.

Each jet is a handful of sparks (4-11), on every contact of the steel with stone (most landings
and some flips only, `chance`): clear and crisp, like steel on stone, never a stream. With reduced motion one or two sparks are left (none on the flips)."""

# The heat of a spark: white-hot head, pale and deep yellow, orange, deep orange, the dying ember.
PALETTE = {
    'S': '#ffffff', 'K': '#fff1a8', 'k': '#ffc83a', 'O': '#ff8a1e', 'o': '#d9481a',
    'r': '#8a2410',
}

# Directions of flight on screen with the runner facing right (behind is left), x right, y down.
DIRS = {
    'l': (-1, 0), 'r': (1, 0), 'u': (0, -1), 'd': (0, 1),
    'ul': (-1, -1), 'ur': (1, -1), 'dl': (-1, 1), 'dr': (1, 1),
}
# A spark's life: the glint where the steel struck (the burst's glints together are the flash),
# then a streak, head first, cooling and shortening (white, yellows, orange), then single pixels.
GLINT = ['...k...', '...K...', '..kSk..', 'kKSSSKk', '..kSk..', '...K...', '...k...']
HEAT = ['SSSKkO', 'SSKkO', 'SKkO', 'KkO', 'kO']
DOTS = ['O', 'o', 'r']


def streak(d, chars):
    """A streak flying along `d`, head (the first character) ahead; drawn centred."""
    dx, dy = DIRS[d]
    n = len(chars)
    w, h = (n if dx else 1), (n if dy else 1)
    grid = [['.'] * w for _ in range(h)]
    for i, ch in enumerate(chars):
        x = 0 if not dx else (n - 1 - i if dx > 0 else i)
        y = 0 if not dy else (n - 1 - i if dy > 0 else i)
        grid[y][x] = ch
    return [''.join(r) for r in grid]


SPRITES = {'glint': GLINT}
for _d in DIRS:
    for _i, _chars in enumerate(HEAT):
        SPRITES[f'spark-{_d}{_i + 1}'] = streak(_d, _chars)
for _i, _ch in enumerate(DOTS):
    SPRITES[f'ember{_i + 1}'] = [_ch]


def frames(d):
    return ['glint'] + [f'spark-{d}{i + 1}' for i in range(len(HEAT))] + \
        [f'ember{i + 1}' for i in range(len(DOTS))]


def jet(d, angle, *, burst, chance, anchor, offset=(0, 0), jitter=None, speed=(150, 320),
        inherit=0.0, gravity=600, drag=5.0, life=(260, 420), fps=22, reduced=0.35, moves=None,
        enter=None):
    """A jet of sparks streaking along `d`, `angle` (0 behind, 90 up) round it."""
    e = {}
    if enter:
        e['enter'] = enter
    if moves:
        e['moves'] = moves
    e.update({
        'chance': chance, 'burst': burst, 'anchor': anchor, 'offset': list(offset),
    })
    if jitter:
        e['jitter'] = list(jitter)
    e.update({
        'speed': list(speed), 'angle': list(angle), 'inherit': inherit, 'gravity': gravity,
        'drag': drag, 'life': list(life), 'fadeOut': 110,
        'sprite': {'frames': frames(d), 'fps': fps, 'loop': False}, 'face': True,
        'blend': 'add', 'layer': 'front', 'max': 24, 'reduced': reduced,
    })
    return e


# Moves (see reference/notes/02-moves.md): the instant of the contact is the move's start.
WALL = [13, 33, 36, 37, 48]  # facing the wall: a wall slide, the wall run's kicks, a wall flip
KICK = [20]  # a tic-tac's kick: he has turned his back to the wall by then
LAND = [24, 25]  # touchdowns: hard (then a roll), soft
FLIP_LAND = [51]  # the wall flip's touchdown: still facing the wall, going away from it
VAULT_FEET = [62]  # the monkey vault: the sabatons on the block
PALMS = [60]  # the tiger jump: the gauntlets on the roof, his body rolling on over them
HANDS = [66, 67, 68, 69, 123, 125, 127]  # gauntlets on the block, a pole
# Sparks off the roof are thrown back and up from where he touched (with little of his speed, so
# they stay there as he goes on, clear of his boots), hop and come down; they start a little over
# the roof and are about gone when they are back (nothing stops them at the roof).
GROUND = {'gravity': 520, 'speed': (120, 260)}

EMITTERS = {
    # The boot's toe on the wall (5 px ahead of the near ankle): off the wall, back and down.
    'spark-wall': jet('dl', [-75, 5], moves=WALL, chance=1, burst=[8, 11], anchor='foot.near',
                      offset=(-5, 0), jitter=(1, 2)),
    'spark-kick': jet('dr', [175, 255], moves=KICK, chance=1, burst=[8, 11], anchor='foot.near',
                      offset=(4, 0), jitter=(1, 2)),
    # Sabatons on the roof: a spray hopping back off the trailing heel, a little one off the toe.
    'spark-land': jet('ul', [25, 80], moves=LAND, chance=0.75, burst=[6, 8], anchor='feet',
                      offset=(4, -3), jitter=(2, 0), inherit=0.1, **GROUND),
    'spark-land-ahead': jet('ur', [100, 150], moves=LAND, chance=0.6, burst=[3, 4], anchor='feet',
                            offset=(-4, -3), jitter=(2, 0), inherit=0.2, **GROUND),
    # After a wall flip he comes down backwards: the spray is thrown off his toes, the wall's way.
    'spark-flip-land': jet('ur', [100, 155], moves=FLIP_LAND, chance=1, burst=[7, 9],
                           anchor='feet', offset=(-4, -3), jitter=(2, 0), inherit=0.1, **GROUND),
    # The roll: the greaves skid on the roof, a scrape thrown back behind him.
    'spark-roll': jet('ul', [18, 70], enter=['roll'], chance=1, burst=[8, 11], anchor='feet',
                      offset=(1, -3), jitter=(4, 0), inherit=0.15, **GROUND),
    # Vaults: the sabatons on the block (thrown back as he dives on); the gauntlets on the roof
    # (back, his body rolls on over them), on the block or a pole (out ahead, away from him).
    'spark-vault': jet('ul', [25, 80], moves=VAULT_FEET, chance=1, burst=[7, 9], anchor='feet',
                       offset=(0, -3), jitter=(2, 0), inherit=0.1, **GROUND),
    'spark-palms': jet('ul', [10, 55], moves=PALMS, chance=1, burst=[7, 9], anchor='hands',
                       offset=(1, -2), jitter=(1, 1), inherit=0.1, **GROUND),
    'spark-hands': jet('ur', [105, 165], moves=HANDS, chance=1, burst=[7, 9], anchor='hands',
                       offset=(-1, -1), jitter=(1, 1), inherit=0.1, **GROUND),
    # The flip's whip: flung off the heels as they swing round, back and down on a front flip,
    # ahead and down on a back flip.
    'spark-flip': jet('dl', [-65, -5], moves=[63, 65], chance=0.6, burst=[4, 6], anchor='feet',
                      offset=(0, -3), inherit=0.4, reduced=0),
    'spark-backflip': jet('dr', [185, 245], moves=[64], chance=0.6, burst=[4, 6], anchor='feet',
                          offset=(0, -3), inherit=0.4, reduced=0),
}
