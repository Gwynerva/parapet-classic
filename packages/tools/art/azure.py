"""Azure, the last boss: Liara T'Soni of Mass Effect, an asari archaeologist of 106 who deals in
secrets. Her head and body are drawn anew (az_heads.py, az_parts.py); four looks (az_looks.py):
the scholar of the first game in her sage-green coat, the Shadow Broker in white and indigo, the
black leather with pink-red inserts, the information broker of Illium in dark green over ivory.
Her effect is her biotics (az_fx.py): a Singularity left hanging after some tricks, pebbles lifted
on some landings, a shimmer at her hands in the air, the Prothean stasis bubble while she waits,
and with the broker look her drone Glyph. Writes the looks, fx.json and the whole boss.json."""
import os
from lookgen import BOSSES, write_json
from tricks import tricks
import az_looks
import az_fx

# Looks no longer drawn go (the folder holds only this boss's outfits).
LOOK_DIR = os.path.join(BOSSES, 'azure', 'looks')
for name in os.listdir(LOOK_DIR):
    if name.endswith('.json') and name[:-5] not in az_looks.LOOKS:
        os.remove(os.path.join(LOOK_DIR, name))

write_json(BOSSES + '/azure/fx.json', tricks(az_fx.fx(), 'azure'))
write_json(BOSSES + '/azure/boss.json', {'id': 'azure', 'color': '#4a8cff', 'gender': 'female',
                                         'looks': az_looks.LOOKS, 'effect': ['biotics']})
print('azure written')
