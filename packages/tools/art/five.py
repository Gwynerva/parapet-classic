"""Five: the looks (fv_looks.py), the effect (fv_fx.py: glitch, sandevistan) and the outfits and
effect in boss.json."""
from lookgen import *
from tricks import tricks
import json

import fv_looks  # (importing the looks writes them)
import fv_fx

write_json(BOSSES + '/five/fx.json', tricks(fv_fx.fx(), 'five'))

# Its outfits and effect in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/five/boss.json', encoding='utf-8'))
b['looks'] = fv_looks.LOOKS
b['effect'] = ['glitch', 'sandevistan']
write_json(BOSSES + '/five/boss.json', b)
print('five written')
