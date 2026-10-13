"""Granger: the looks (gn_looks.py), the effect (gn_fx.py: blink, recall) and the outfits in
boss.json."""
from lookgen import *
from tricks import tricks
import json

import gn_looks  # (importing the looks writes them)
import gn_fx

write_json(BOSSES + '/granger/fx.json', tricks(gn_fx.fx(), 'granger'))

# Its outfits and effect in boss.json (its world, stage.json, is drawn in stages2.py).
b = json.load(open(BOSSES + '/granger/boss.json', encoding='utf-8'))
b['looks'] = gn_looks.LOOKS
b['effect'] = ['blink', 'recall']
write_json(BOSSES + '/granger/boss.json', b)
print('granger written')
