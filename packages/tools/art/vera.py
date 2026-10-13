"""Vera: the looks (vr_looks.py, vr_heads.py), the effect (vr_fx.py: gusts of wind round her and
the glass she breaks off walls) and her outfits in boss.json."""
from lookgen import *
import json

import vr_looks  # noqa: F401  (the looks)
import vr_fx

# ------------------------------------------------------------------ effects
# Gusts of wind round her body (vr_fx.py): air rushing past a free-runner at speed, a stroke
# behind her and one in front so it goes round her, now and then while she runs fast and on some
# of her tricks. The second variant is the glass of the city: shards off the wall on some of her
# kick-offs. Waiting for a contest she stands in a Time Trial checkpoint.
vr_fx.write()

# Her outfits in boss.json (its world, stage.json, is drawn in stages2.py).
b = json.load(open(BOSSES + '/vera/boss.json', encoding='utf-8'))
b['looks'] = ['vera-tank', 'vera-vest', 'vera-street']
write_json(BOSSES + '/vera/boss.json', b)
print('vera written')
