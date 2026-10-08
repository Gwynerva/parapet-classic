"""Signature flourishes on tricks: on some flips, vaults, wall moves and rolls (not all: a chance)
each boss throws its own thing every way: Vera breaks glass, Pierre gets an idea, Rewind's
photos fly, the knight's armour sparks... Applied to an effects file before it is written."""
import json
import sys

TRICKS = ['flip', 'vault', 'wall', 'roll']


def every_way(e, chance, burst=None, speed=None):
    e = dict(e)
    e['enter'] = TRICKS + (['land'] if 'land' in e.get('enter', []) else [])
    e['chance'] = chance
    e['angle'] = [0, 360]
    if burst:
        e['burst'] = burst
    if speed:
        e['speed'] = speed
    for k in ('while', 'every', 'perSecond', 'minSpeed'):
        e.pop(k, None)
    return e


def tricks(fx, boss):
    em = fx['emitters']
    v = fx['variants']
    if boss == 'vera':
        em['rare-glass'] = every_way(em['rare-glass'], 0.3, [5, 8], [40, 90])
    elif boss == 'pierre':
        em['bulb']['perSecond'] = 0.08
        em['idea-trick'] = {**em['idea'], 'enter': TRICKS, 'chance': 0.4, 'layer': 'front'}
        if 'idea-trick' not in v['code']['emitters']:
            v['code']['emitters'].append('idea-trick')
    elif boss == 'rewind':
        em['photos'] = every_way(em['photos'], 0.45, [2, 4], [30, 70])
        em['photos']['anchor'] = 'body'
        em['photos']['max'] = 10
    elif boss == 'shahzada':
        em['swirl'] = every_way(em['swirl'], 0.5)
    elif boss == 'grove':
        em['cash'] = every_way(em['cash'], 0.5)
    elif boss == 'b2':
        em['shatter'] = every_way(em['shatter'], 0.5)
    elif boss == 'five':
        em['tear']['chance'] = 0.5
    elif boss == 'flittermouse':
        em['swarm'] = every_way(em['swarm'], 0.45)
    elif boss == 'granger':
        em['blink']['chance'] = 0.6
    elif boss == 'rush-b':
        em['spray'] = every_way(em['spray'], 0.5)
        em['grenade']['chance'] = 0.3
        em['flash']['chance'] = 0.4
    elif boss == 'sir-nobody':
        em['clang']['chance'] = 0.6
    return fx


if __name__ == '__main__':
    # Applies to the written files: python tricks.py <boss> ...
    from lookgen import BOSSES
    for boss in sys.argv[1:]:
        path = f'{BOSSES}/{boss}/fx.json'
        fx = tricks(json.load(open(path, encoding='utf-8')), boss)
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(fx, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(boss, 'tricks')
