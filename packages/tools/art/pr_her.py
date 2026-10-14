"""Petra's own looks (base 0, Blaise's body), after the owner's photos: `kate`, `mechanic`,
`birthday`, `evening`. Her face is drawn anew in pr_her_heads.py, her body pictures in
pr_her_parts.py. Run: python3 pr_her.py (then prettier on the four looks)."""
from lookgen import *
from heads import Palette
from body import outfit_parts, write_parts
from gridpng import sheet
import pr_her_heads as HH
import pr_her_parts as HP

SKIN5 = HP.SKIN5


def arm_rules(sleeve, cuff=None, wrist_right=None, wrist_left=None, sleeve_parts=None):
    """Her skin on the hands and arms, the sleeves over the arms (`sleeve`: 5 tones over
    `sleeve_parts`, the whole arm by default; None for bare arms), the original's wrist bands as a
    cuff, or a band on one wrist (`wrist_right` / `wrist_left`: 2 tones)."""
    rules = [recolor(ARMS + HAND, {**ramp(SKIN, SKIN5), '#ffcb84': SKIN5[1], '#a56531': SKIN5[3]})]
    if sleeve:
        rules.append(recolor(sleeve_parts or (UPPER_ARM + FOREARM), ramp(SKIN5, sleeve)))
    cuff = cuff or (sleeve[3] if sleeve and not sleeve_parts else SKIN5[2])
    for side, band in (('right', wrist_right), ('left', wrist_left)):
        band = band or [cuff, SKIN5[3] if cuff == SKIN5[2] else cuff]
        rules.append({**recolor(FOREARM, {WRIST[0]: cuff, WRIST[2]: band[0], WRIST[1]: band[1]}), 'on': side})
    return rules


def make(look_id, pics, rules, accent, attachments=None, ribbons=None, turn=(), plan=None):
    """Writes a look: the arms and hands recoloured by `rules` (`plan`: how the arm families grow),
    the pictures drawn in pr_her_parts (`pics`: key -> (rows, legend)), her head for the look and
    its blinking faces, the attachments ({name: (layer, {key: (rows, legend)})}) and ribbons
    ({name: function(palette) -> ribbon}); turns the upright pictures."""
    pal = Palette()
    look = {'id': look_id, 'base': 0, 'accent': accent, 'recolor': rules, 'parts': dict(no_ponytail())}
    write_parts(look, outfit_parts(0, rules, plan or {'upper-arm': 0, 'forearm': 0, 'hand': 0}), pal)
    for k, (rows, leg) in pics.items():
        look['parts'][k] = enc(rows, leg, pal)
    look['parts']['25'] = pal.rows(HH.profile(look_id))
    look['parts']['29'] = pal.rows(HH.front(look_id))
    for f in HH.BLINK:
        look['parts'][str(f)] = pal.rows(HH.profile(look_id, f))
    if attachments:
        look['attachments'] = {name: {'layer': layer, 'sprites': {k: enc(rows, leg, pal) for k, (rows, leg) in sp.items()}}
                               for name, (layer, sp) in attachments.items()}
    if ribbons:
        look['ribbons'] = {k: f(pal) for k, f in ribbons.items()}
    look['palette'] = pal.pal
    path = write_look('petra', look)
    upright = [k for k in ('25', '57', '34', '49', '53', '62', '30', '39', '43') if k in look['parts']]
    rotate(path, upright + list(turn))
    preview(look_id)
    return pal


def body(leg, top, thigh, knee, shin, far, shoe, s39, s47, s48, shoe_far):
    """The pictures of a look: the chest and the torso (profile 57 / 34, turned to us 61 / 38) in
    `leg`, the near thigh (the far one a tone darker), the knee, the shin, the shoes in `shoe`."""
    out = {k: (rows, leg) for k, rows in zip(('57', '61', '34', '38'), top)}
    out.update({'53': (thigh, leg), '49': (shift(thigh, far), leg), '62': (knee, leg), '30': (shin, leg)})
    out.update({'39': (s39, shoe), '43': (shift(s39, shoe_far), shoe), '47': (s47, shoe), '48': (s48, shoe)})
    return out


# ------------------------------------------------------------------------------------- kate
def kate():
    leg = HP.KATE
    sleeve = ['#4a4c66', '#3c3e56', '#2e3046', '#1e1f2e', '#121219']
    pics = body(leg, (HP.KATE_57, HP.KATE_61, HP.KATE_34, HP.KATE_38), HP.LEG_THIGH, HP.LEG_KNEE, HP.KATE_SHIN,
                HP.LEG_FAR, HP.SNEAKER, HP.SNEAKER_39, HP.SNEAKER_47, HP.SNEAKER_48, HP.SNEAKER_FAR)
    make('kate', pics, arm_rules(sleeve, wrist_right=['#3ad26a', '#1f9a48']), '#2fbf5b',
         attachments={'skirt': ('hips', {'34': (HP.KATE_SKIRT_34, leg), '38': (HP.KATE_SKIRT_38, leg)}),
                      'sword': ('back', {'57': (HP.LONGSWORD, HP.SWORDS)})},
         turn=['skirt@34', 'sword@57'])


# --------------------------------------------------------------------------------- mechanic
def mechanic():
    leg = HP.MECH
    jacket = ['#8a847e', '#706a65', '#5a5450', '#45403d', '#2e2a28']
    pics = body(leg, (HP.MECH_57, HP.MECH_61, HP.MECH_34, HP.MECH_38), HP.MECH_THIGH, HP.MECH_KNEE, HP.MECH_SHIN,
                HP.MECH_FAR, HP.BOOT, HP.BOOT_39, HP.BOOT_47, HP.BOOT_48, HP.BOOT_FAR)
    red = ['#f04634', '#b42c22']
    make('mechanic', pics, arm_rules(jacket, cuff='#d83a2c', wrist_right=red, wrist_left=red), '#e0402e')


# --------------------------------------------------------------------------------- birthday
def birthday():
    leg = HP.BDAY
    dress = ['#4c4c58', '#36363f', '#26262d', '#19191f', '#0c0c10']
    pics = body(leg, (HP.BDAY_57, HP.BDAY_61, HP.BDAY_34, HP.BDAY_38), HP.BDAY_THIGH, HP.BDAY_KNEE, HP.BDAY_SHIN,
                HP.BDAY_FAR, HP.LOAFER, HP.LOAFER_39, HP.LOAFER_47, HP.LOAFER_48, HP.LOAFER_FAR)
    make('birthday', pics, arm_rules(dress, wrist_left=['#4a4a5a', '#101014']), '#9b6bd6',
         attachments={'skirt': ('hips', {'34': (HP.BDAY_SKIRT_34, leg), '38': (HP.BDAY_SKIRT_38, leg)})},
         turn=['skirt@34'])


# ---------------------------------------------------------------------------------- evening
def evening():
    leg = HP.EVE
    dress = ['#c85466', '#a03246', '#7e2034', '#5a1424', '#380a14']
    pics = body(leg, (HP.EVE_57, HP.EVE_61, HP.EVE_34, HP.EVE_38), HP.LEG_THIGH, HP.LEG_KNEE, HP.EVE_SHIN,
                HP.LEG_FAR, HP.PUMP, HP.PUMP_39, HP.PUMP_47, HP.PUMP_48, HP.PUMP_FAR)
    sash = {'anchor': 'hips', 'offset': [4, -6], 'segments': 4, 'gravity': 260, 'drag': 2.6, 'stiffness': 0.1}
    make('evening', pics, arm_rules(dress, sleeve_parts=UPPER_ARM, wrist_right=['#f6d27a', '#c89432']), '#e8b84a',
         attachments={'skirt': ('hips', {'34': (HP.EVE_SKIRT_34, leg), '38': (HP.EVE_SKIRT_38, leg)})},
         ribbons={'sash': lambda pal: {**sash, 'texture': enc(HP.EVE_SASH, leg, pal)},
                  'sash-end': lambda pal: {**sash, 'offset': [4, -5], 'segments': 3, 'gravity': 300, 'drag': 3.0,
                                           'texture': enc(HP.EVE_SASH_END, leg, pal)}},
         turn=['skirt@34'])


LOOKS = {'kate': kate, 'mechanic': mechanic, 'birthday': birthday, 'evening': evening}

if __name__ == '__main__':
    import sys
    for name in sys.argv[1:] or LOOKS:
        LOOKS[name]()
    pal = Palette()
    sheet('pr-her-heads.png', [(pal.rows(p), pal.pal) for k in HH.LOOKS for p in (HH.profile(k), HH.front(k))],
          scale=9)
    print('her looks written')
