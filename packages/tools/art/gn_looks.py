"""Granger's looks: Tracer, "a heavy top on two orange matchsticks". Her head (gn_heads.py) and
her body (gn_parts.py) are drawn anew, upright, and the look tool turns them:

* `classic` (Overwatch): the cropped brown bomber with its cream fur collar, the Union Jack on
  her right shoulder and the squadron's patch on the left, the chronal accelerator glowing on her
  chest in its white ring (and its second ring on the back plate), big white bracers flaring at
  the elbow, dark gloves; thin legs in the suit from yellow at the hip to red-orange at the
  ankle, a strap and TRACER on the left thigh only; white OW2 trainers with a glowing cyan sole
  line and an orange heel; the orange single-lens goggles.
* `slipstream`: the test pilot of the Slipstream: a blue flight suit with a white swoosh, the
  yellow life vest, a white silk scarf streaming, aviator sunglasses, black flight boots.
* `punk`: magenta spikes, round black goggles, a studded black leather jacket over a white tee,
  black shorts with a studded belt, ripped pink tights, black buckled high-tops.

A petite build on Blaise's body: legs two pixels thinner, a heavy compact top (the bomber, the
bracers, the disc)."""
from lookgen import *
from heads import Pic, Palette
from body import part, apply_rules, FAMILIES
from gridpng import sheet
import gn_heads as H
import gn_parts as P

CYAN = P.CYAN
GLOVE = ['#6a685e', '#504e46', '#3a3933', '#26251f', '#161512']  # light → dark


def glove_rules(glove):
    """The hands in gloves (Blaise's hand tones by lightness onto the glove's ramp)."""
    tones = ['#fff3bd', '#ffd794', '#ffcb84', '#e7aa6b', '#bd7942', '#a56531', '#734521']
    m = {c: glove[min(len(glove) - 1, round(i * (len(glove) - 1) / (len(tones) - 1)))] for i, c in enumerate(tones)}
    return [recolor(HAND, m)]


def write(look_id, accent, pics, glove, head, front, faces, ribbons=None, attachments=None, effect=None,
          turn=()):
    """Writes a look: the pictures drawn (key → Pic), the gloved hands, the heads (25, 29 and their
    `:left` sides, the faces 76-78 shown while she blinks or winces); turns the upright ones."""
    pal = Palette()
    look = {'id': look_id, 'base': 0, 'accent': accent, 'parts': dict(no_ponytail())}
    rules = glove_rules(glove)
    for id_ in FAMILIES['hand']:
        look['parts'][str(id_)] = pal.rows(apply_rules(part(0, id_), id_, rules))
    for k, p in pics.items():
        look['parts'][k] = pal.rows(p)
    for k, p in head.items():
        look['parts'][k] = pal.rows(p)
    for k, p in front.items():
        look['parts'][k] = pal.rows(p)
    for k, p in faces.items():
        look['parts'][k] = pal.rows(p)
    if ribbons:
        look['ribbons'] = ribbons(pal)
    if attachments:
        look['attachments'] = attachments(pal)
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('granger', look)
    upright = ['25', '25:left', '57', '34', '49', '53', '49:left', '53:left', '62', '30', '1',
               '5:right', '5:left', '9:right', '9:left', '39', '43', *turn]
    rotate(path, [k for k in upright if k in look['parts'] or '@' in k])
    preview(look_id)
    return pal, look


def heads(look):
    """The profile and the 3/4 face of a look, each side, and the profile's faces."""
    head = {'25': H.head(False, look), '25:left': H.head(False, look, side='left')}
    front = {'29': H.head(True, look), '29:left': H.head(True, look, side='left')}
    faces = {str(f): H.head(False, look, face=f) for f in (76, 77, 78)}
    return head, front, faces


def classic():
    head, front, faces = heads('classic')
    return write('classic', '#ff9a2a', P.pictures('classic'), GLOVE, head, front, faces)


def scarf(pal):
    """Slipstream's white silk scarf, streaming from the neck."""
    rows = [''.join(c if c in '.+' else pal.char(P.SCARF[c]) for c in r) for r in P.SCARF_TEX]
    return {'scarf': {'anchor': 'neck', 'offset': [1, 1], 'texture': rows, 'segments': 6, 'gravity': 70,
                      'drag': 4, 'stiffness': 0.1}}


def slipstream():
    head, front, faces = heads('slipstream')
    return write('slipstream', '#f8d044', P.pictures('slipstream'), GLOVE, head, front, faces, ribbons=scarf)


def punk():
    head, front, faces = heads('punk')
    return write('punk', '#ff5cb8', P.pictures('punk'), GLOVE, head, front, faces)


LOOKS = ['classic', 'slipstream', 'punk']
pals = [classic()[0], slipstream()[0], punk()[0]]
sheet('gn-heads.png', [(pal.rows(H.head(f, lk)), pal.pal) for pal, lk in zip(pals, LOOKS) for f in (False, True)],
      scale=10)
print('granger looks written')
