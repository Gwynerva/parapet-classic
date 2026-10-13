"""Flittermouse: the looks (asylum, armored, future: heads in fm_heads.py, the body in
fm_body.py), the effect (bats, batarang; fm_fx.py) and his outfits in boss.json."""
import json
import sys

from lookgen import BOSSES, write_look, write_json, rotate, preview
from heads import Palette, Pic
import fm_heads
import fm_body as B
from fm_body import grown, lit, materials

LOOKS = ['asylum', 'armored', 'future']

# Light from the upper front: in profile from the right (the way he runs), turned to us from a
# little left of the front (the near cheek lit, the far side in shade).
FRONT_LIGHT = (-0.25, -0.6, 0.75)


def far(ramp):
    """The far side of the body, a step darker."""
    return ramp[1:] + [ramp[-1]]


def tones(ramp, outline, extra=None):
    """A drawing's tone letters (o D A M L H) on a ramp of five, light → dark."""
    t = {'o': outline, 'D': ramp[4], 'A': ramp[3], 'M': ramp[2], 'L': ramp[1], 'H': ramp[0]}
    return {**t, **(extra or {})}


class Suit:
    """One outfit's colours and drawings."""

    def __init__(self, **kw):
        self.__dict__.update(kw)

    def mats(self, darker=False):
        f = far if darker else (lambda r: r)
        return {
            'g': (f(self.suit), self.suit_out, self.suit_sel) + self.suit_gloss,
            'k': (f(self.black), self.black_out, self.black_sel, self.black[0], 0.55),
            'b': (f(self.black[2:] + [self.black[-1]] * 2), self.black_out, self.black_out),
            't': (f(self.black[1:]), self.black_out, self.black_sel),
            'd': (f(self.under), self.black_out, self.black_sel),
            'n': (f(self.suit[3:] + [self.suit[-1]] * 2), self.suit_out, self.suit_out),
            'r': (f([self.suit[0]] * 2 + self.suit[1:3]), self.suit_out, self.suit[1]),
            'y': (f(self.belt), self.belt_out, self.belt[2]),
            'Y': (f([self.buckle[0]] * 2 + self.buckle[1:3]), self.belt_out, self.buckle[1]),
            'p': (f(self.belt[1:]), self.belt_out, self.belt[3]),
            'q': (f(self.belt[3:] + [self.belt_out] * 3), self.belt_out, self.belt_out),
            'c': (f(self.black[:3]), self.black_out, self.black[1]),
            'R': (f(self.red), self.red_out, self.red[1]),
            'w': (f(self.belt), self.belt_out, self.belt[1]),
        }


ASYLUM = Suit(
    suit=['#b4b4bc', '#94949e', '#74747e', '#585862', '#42424b'], suit_out='#1c1b22', suit_sel='#4c4c56',
    suit_gloss=(),
    black=['#5b5c7e', '#403f57', '#2e2d3e', '#21202d', '#15141e'], black_out='#09080e', black_sel='#2a2938',
    under=['#403f57', '#2e2d3e', '#21202d', '#15141e', '#15141e'],
    belt=['#f4dea0', '#d8b870', '#ab8c54', '#78633e', '#4c3e27'], belt_out='#2a2014',
    buckle=['#fff2c8', '#f4dea0', '#d8b870', '#ab8c54'],
    red=['#e8505a', '#d0313a', '#9d292d', '#6a1c20', '#45121a'], red_out='#2a0a0e',
    sole='#3c3b44', tread='#0c0b10', fins=('#9aa4c0', '#3e4458'), fins_far=('#565e76', '#2a2e40'),
    chest=B.CHEST, chest_front=B.CHEST_FRONT, torso=B.TORSO, torso_front=B.TORSO_FRONT,
    knee=[r.replace('#', 'g') for r in B.KNEE], shin=B.SHIN, gauntlet=B.GAUNTLET,
    boot=B.BOOT, boot_short=B.BOOT_SHORT, boot_front=B.BOOT_FRONT, arm='g', grow_arm=2, grow_thigh=2,
    pauldron=None,
)

KNIGHT = Suit(
    suit=['#8a8a9a', '#62626e', '#4a4a54', '#35353d', '#232329'], suit_out='#0b0b0e', suit_sel='#3a3a44',
    suit_gloss=('#b4b4c4', 0.7),
    black=['#5c5c6c', '#41414c', '#2f2f37', '#222228', '#16161a'], black_out='#0b0b0e', black_sel='#2c2c34',
    under=['#4c4b52', '#3c3b42', '#2e2d33', '#222126', '#18171b'],
    belt=['#b8a676', '#95855e', '#6c5c3f', '#534a23', '#3d3528'], belt_out='#1e1a12',
    buckle=['#d8cca0', '#b8a676', '#95855e', '#6c5c3f'],
    red=['#e8505a', '#d0313a', '#9d292d', '#6a1c20', '#45121a'], red_out='#2a0a0e',
    sole='#34343c', tread='#0b0b0e', fins=('#a8b0c4', '#4c5266'), fins_far=('#5a6070', '#33363f'),
    chest=B.rim(B.KNIGHT_CHEST), chest_front=B.rim(B.KNIGHT_CHEST_FRONT), torso=B.KNIGHT_TORSO,
    torso_front=B.KNIGHT_TORSO_FRONT, knee=B.KNIGHT_KNEE, shin=B.KNIGHT_SHIN, gauntlet=B.KNIGHT_GAUNTLET,
    boot=B.KNIGHT_BOOT, boot_short=B.KNIGHT_BOOT_SHORT, boot_front=B.KNIGHT_BOOT_FRONT, arm='g', grow_arm=2,
    grow_thigh=2, pauldron=B.KNIGHT_PAULDRON,
)

BEYOND = Suit(
    suit=['#4c4c56', '#36363d', '#26262b', '#1a1a1e', '#111114'], suit_out='#060608', suit_sel='#26262b',
    suit_gloss=(),
    black=['#6a6c80', '#45465a', '#2e2f3a', '#1e1e26', '#131317'], black_out='#060608', black_sel='#2e2f3a',
    under=['#45465a', '#2e2f3a', '#1e1e26', '#131317', '#131317'],
    belt=['#f6f9fa', '#dfe5e8', '#c3b8ae', '#8e8780', '#5c5650'], belt_out='#2a2826',
    buckle=['#ff6a64', '#e8404a', '#b02a32', '#7a1c22'],
    red=['#f0545c', '#d0313a', '#a8282e', '#7a1c22', '#4c1016'], red_out='#2a080c',
    sole='#1a1a1e', tread='#060608', fins=('#9aa2b8', '#40444f'), fins_far=('#50545f', '#2a2c33'),
    chest=B.BEYOND_CHEST, chest_front=B.BEYOND_CHEST_FRONT, torso=B.BEYOND_TORSO,
    torso_front=B.BEYOND_TORSO_FRONT, knee=[r.replace('#', 'k') for r in B.KNEE], shin=B.BEYOND_SHIN,
    gauntlet=B.GAUNTLET, boot=B.BEYOND_BOOT, boot_short=B.BEYOND_BOOT_SHORT, boot_front=B.BEYOND_BOOT_FRONT,
    arm='k', grow_arm=2, grow_thigh=2, pauldron=None,
)


def parts_of(s):
    m = s.mats()
    mf = s.mats(darker=True)
    arm = s.suit if s.arm == 'g' else s.black
    arm_out, arm_sel = (s.suit_out, s.suit_sel) if s.arm == 'g' else (s.black_out, s.black_sel)
    t = tones(s.black, s.black_out, {'s': s.sole, 'S': s.tread, 'f': s.fins[0], 'F': s.fins[1]})
    tf = tones(far(s.black), s.black_out, {'s': s.sole, 'S': s.tread, 'f': s.fins_far[0], 'F': s.fins_far[1]})
    return {
        '57': materials(s.chest, m),
        '61': materials(s.chest_front, m, light=FRONT_LIGHT),
        '34': materials(s.torso, m),
        '38': materials(s.torso_front, m, light=FRONT_LIGHT),
        '5': lit(grown(5, s.grow_arm), arm, arm_out, arm_sel, along='x'),
        '9': lit(grown(9, s.grow_arm), far(arm), arm_out, arm_sel, along='x'),
        '1': Pic.text(s.gauntlet, t),
        '1:far': Pic.text(s.gauntlet, tf),
        '17': lit(grown(17, 1), s.black, s.black_out, s.black_sel, spec=s.black[0], gloss=0.4),
        '21': lit(grown(21, 1), far(s.black), s.black_out, s.black_sel),
        '53': lit(grown(53, s.grow_thigh), arm, arm_out, arm_sel, along='y'),
        '49': lit(grown(49, s.grow_thigh), far(arm), arm_out, arm_sel, along='y'),
        '62': materials(s.knee, m),
        '62:far': materials(s.knee, mf),
        '30': materials(s.shin, m, along='y'),
        '30:far': materials(s.shin, mf, along='y'),
        '39': Pic.text(s.boot, t),
        '43': Pic.text(s.boot, tf),
        '47': Pic.text(s.boot_short, t),
        '48': Pic.text(s.boot_front, t),
    }


def cape(look, pal, tones_):
    """The cape: a ribbon from the upper back, and over the shoulders an attachment on the chest
    (what the body shows of the cape where the ribbon hangs behind it)."""
    rows = B.CAPE
    col = rows[0].index('+')
    pic = Pic.text([r.replace('+', 'A') for r in rows], tones_)
    tex = pal.rows(pic)
    tex[0] = tex[0][:col] + '+' + tex[0][col + 1:]
    look['ribbons'] = {'cape': {'anchor': 'back', 'offset': [1, 0], 'texture': tex, 'segments': 7,
                                'stiffness': 0.35, 'gravity': 280, 'drag': 2.0}}
    look.setdefault('attachments', {})['mantle'] = {'layer': 'back', 'sprites': {
        '57': pal.rows(Pic.text(B.MANTLE, tones_)),
        '61': pal.rows(Pic.text(B.MANTLE_FRONT, tones_)),
    }}
    return ['mantle@57']


UPRIGHT = ('57', '34', '5', '9', '1', '17', '21', '49', '53', '62', '30', '39', '43')


def build(id_, s, heads, accent, cape_tones=None, effect=None):
    pal = Palette({})
    look = {'id': id_, 'base': 1, 'accent': accent, 'parts': {}}
    for k, p in heads.items():
        look['parts'][k] = pal.rows(p)
    parts = parts_of(s)
    for k, p in parts.items():
        look['parts'][k] = pal.rows(p)
    turns = []
    if s.pauldron:
        look.setdefault('attachments', {})['pauldron'] = {'layer': 'over', 'sprites': {
            '5': pal.rows(Pic.text(s.pauldron, tones(s.suit, s.suit_out))),
            '9': pal.rows(Pic.text(s.pauldron, tones(far(s.suit), s.suit_out))),
        }}
        turns += ['pauldron@5', 'pauldron@9']
    if cape_tones:
        turns += cape(look, pal, cape_tones)
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('flittermouse', look)
    keys = [k for k in parts if k.split(':')[0] in UPRIGHT]
    rotate(path, ['25'] + keys + turns)
    preview(id_)
    return path


# The heads are 24 rows (7 of ears over a skull of 17): padded below so the skull sits where the
# original's does, the profile a little lower (no neck: the cowl runs into the shoulders), the
# face turned to us a little higher (the chest is drawn over the chin in those poses).
PAD_PROFILE = 4
PAD_FRONT = 10


def heads(profile, front):
    return {'25': profile.pad(bottom=PAD_PROFILE), '29': front.pad(bottom=PAD_FRONT)}


ASYLUM_CAPE = {'o': '#09080e', 'D': '#16151f', 'A': '#211f2d', 'M': '#2e2c40', 'L': '#403e58', 'H': '#57557a'}
KNIGHT_CAPE = {'o': '#0b0b0e', 'D': '#141418', 'A': '#1e1e24', 'M': '#2b2b33', 'L': '#3e3e4a', 'H': '#555564'}


def looks(only=()):
    if not only or 'asylum' in only:
        build('asylum', ASYLUM, heads(fm_heads.cowl(), fm_heads.cowl_front()),
              '#d8b870', ASYLUM_CAPE)
    if not only or 'armored' in only:
        build('armored', KNIGHT, heads(fm_heads.knight(), fm_heads.knight_front()),
              '#95855e', KNIGHT_CAPE)
    if not only or 'future' in only:
        build('future', BEYOND, heads(fm_heads.beyond(), fm_heads.beyond_front()),
              '#d0313a')


if __name__ == '__main__':
    only = sys.argv[1:]
    looks([a for a in only if a in LOOKS])
    if not only or 'fx' in only:
        import fm_fx
        fm_fx.write()
    # Its outfits in boss.json (its world, stage.json, is drawn in stages2.py).
    b = json.load(open(BOSSES + '/flittermouse/boss.json', encoding='utf-8'))
    b['looks'] = LOOKS
    write_json(BOSSES + '/flittermouse/boss.json', b)
    print('flittermouse written')
