"""Five's looks: V of Cyberpunk 2077, "a glowing collar on a short jacket, narrow below", the
woman and the man (two faces: one V each way the game lets you play). The heads (fv_heads.py)
and the bodies (fv_parts.py, fv_extra.py) are drawn anew, upright, and the look tool turns them:

* `five-her`: V the woman on Blaise's body: the raspberry undercut, the Samurai jacket with its
  glowing collar, black leather moto trousers, black knee-high wedge boots.
* `five-him`: V the man on the man's body, a pixel broader: the black crop and the boxed beard,
  the same jacket over a black tee with a yellow print, dark jeans, black high-tops with an
  orange glowing sole.
* `five-kid`: her as the Street Kid of the lifepath: the undercut hot pink, a crop top with pink
  sleeves and an X, gold trousers with straps, white platform slip-ons.
* `five-edgerunner`: him in David's yellow jacket from Edgerunners, olive cargo trousers with a
  green stripe and lilac straps hanging, chunky black sneakers.

The two without the glowing collar wear the glitch without the collar's light (fv_fx.py)."""
from lookgen import *
from heads import Palette
from body import part, apply_rules, FAMILIES
from gridpng import sheet
import fv_heads as H
import fv_parts as P
import fv_extra as X


def skin_rules(ramp):
    """The hands in the look's skin (the base hand tones by lightness onto the ramp)."""
    tones = ['#fff3bd', '#ffd794', '#ffcb84', '#e7aa6b', '#bd7942', '#a56531', '#734521']
    m = {c: ramp[min(len(ramp) - 1, round(i * (len(ramp) - 1) / (len(tones) - 1)))] for i, c in enumerate(tones)}
    return [recolor(HAND, m)]


def write(look_id, base, accent, pics, skin, head, faces=None, ribbons=None, effect=None, turn=()):
    """Writes a look: the pictures drawn (key -> Pic), the hands in her or his skin, the heads;
    turns the upright pictures."""
    pal = Palette()
    look = {'id': look_id, 'base': base, 'accent': accent, '_raw_heads': True,
            'parts': dict(no_ponytail()) if base == 0 else {}}
    rules = skin_rules(skin)
    for id_ in FAMILIES['hand']:
        look['parts'][str(id_)] = pal.rows(apply_rules(part(base, id_), id_, rules))
    for k, p in {**pics, **head, **(faces or {})}.items():
        look['parts'][k] = pal.rows(p)
    if ribbons:
        look['ribbons'] = ribbons
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('five', look)
    upright = ['25', '57', '34', '49', '53', '62', '30', '1', '5', '9', '39', '43', *turn]
    rotate(path, [k for k in upright if k in look['parts']])
    preview(look_id)
    return pal, look


# The outfits without the glowing collar wear the glitch without the collar's light, and their
# effect goes by the name of David's implant.
BARE = ['sandevistan', 'glitch-bare']
# The hands in the heads' skin, light to dark.
HER_RAMP = [H.HER_SKIN[k] for k in 'H1234']
HIM_RAMP = [H.HIM_SKIN[k] for k in 'H1234']


def her():
    head = {'25': H.her_head(), '29': H.her_head(True)}
    faces = {str(f): H.her_head(face=f) for f in (76, 77, 78)}
    return write('five-her', 0, '#53cef7', P.pictures('her'), HER_RAMP, head, faces)


def him():
    head = {'25': H.him_head(), '29': H.him_head(True)}
    faces = {str(f): H.him_head(face=f) for f in (76, 77, 78)}
    return write('five-him', 1, '#ff9a2a', P.pictures('him'), HIM_RAMP, head, faces)


def kid():
    head = {'25': H.her_head(hair=X.KID_HAIR), '29': H.her_head(True, hair=X.KID_HAIR)}
    faces = {str(f): H.her_head(face=f, hair=X.KID_HAIR) for f in (76, 77, 78)}
    return write('five-kid', 0, '#f670b0', X.kid_pictures(), HER_RAMP, head, faces, effect=BARE)


def david():
    head = {'25': H.him_head(), '29': H.him_head(True)}
    faces = {str(f): H.him_head(face=f) for f in (76, 77, 78)}
    return write('five-edgerunner', 1, '#f6df1e', X.david_pictures(), HIM_RAMP, head, faces,
                 ribbons=X.david_ribbons(), effect=BARE)


LOOKS = ['five-her', 'five-him', 'five-kid', 'five-edgerunner']
her_pal, him_pal, kid_pal = her()[0], him()[0], kid()[0]
david()
# Their heads magnified, in out/fv-heads.png: her profile, 3/4, blinks and pain face; the Street
# Kid's; his.
sheet('fv-heads.png', [(her_pal.rows(p), her_pal.pal) for p in
                       (H.her_head(), H.her_head(True), *(H.her_head(face=f) for f in (76, 77, 78)))] +
      [(kid_pal.rows(p), kid_pal.pal) for p in (H.her_head(hair=X.KID_HAIR), H.her_head(True, hair=X.KID_HAIR))] +
      [(him_pal.rows(p), him_pal.pal) for p in
       (H.him_head(), H.him_head(True), *(H.him_head(face=f) for f in (76, 77, 78)))], scale=10, per_row=5)
print('five looks written')
