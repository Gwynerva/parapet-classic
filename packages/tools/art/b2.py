"""B-2: the looks (b2_looks.py), the effect (b2_fx.py: evade) and her outfits in boss.json.

The effect is 2B's own, quiet as an android but sharp when she dodges:
* evade: on some of her rolls, dashes and flips (about one in three) she does a Perfect Evade: a
  small white flash cuts across her and a chain of four holograms of her pose stays behind, one
  every 60 ms, white, pale grey, grey and YoRHa black, with rolling scanlines; as they fade they
  tear into slices and shed black-box cubes, a white one and a gold bit;
* Pod 042: now and then (one every twelve seconds or so of running) her Pod hovers by her
  shoulder for a second, its copper cap glinting, and dissolves into data squares;
* presence: by the start a data square now and then drifts up from her; leaving, her black box
  self-destructs (a short white ring, black cubes with silver circuits and white ones); coming
  back, white data squares gather into her from both sides (uploaded to a new body)."""
from lookgen import *
import json

import b2_looks  # noqa: F401  (the looks)
import b2_fx


b2_fx.write()  # the effect (b2_fx.py)

# Her outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/b2/boss.json', encoding='utf-8'))
b['looks'] = ['android', 'replica', 'kimono']
b['effect'] = ['evade']
write_json(BOSSES + '/b2/boss.json', b)
print('b2 written')
