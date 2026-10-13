"""Widow: Widowmaker of Overwatch, level 7's femme fatale. Her head and body are drawn anew
(wd_heads.py, wd_parts.py); her looks (wd_looks.py): the classic magenta bodysuit with the raised
Infra-Sight visor, Noire in black and blood red, Odile the black swan in her tutu, the Comtesse in
her violet riding coat. Writes the looks and the `looks` list in boss.json; the looks no longer
drawn go (the folder holds only this boss's outfits). Then her effect (fx.json, `effect` in
boss.json: wd_fx.py, which can also run alone). Her world (stage.json) is drawn in stages2.py."""
import json
import os
from lookgen import BOSSES, write_json
import wd_looks

LOOK_DIR = os.path.join(BOSSES, 'widow', 'looks')
if not os.environ.get('WIDOW_ONLY'):
    for name in os.listdir(LOOK_DIR):
        if name.endswith('.json') and name[:-5] not in wd_looks.LOOKS:
            os.remove(os.path.join(LOOK_DIR, name))

path = os.path.join(BOSSES, 'widow', 'boss.json')
boss = json.load(open(path, encoding='utf-8'))
boss['looks'] = wd_looks.LOOKS
write_json(path, boss)

import wd_fx  # noqa: E402  (the effect; it writes `effect` in boss.json)

wd_fx.write()
print('widow written')
