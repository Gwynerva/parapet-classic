"""Signature flourishes on tricks: on some flips, vaults, wall moves and rolls (not all: a chance)
each boss throws its own thing every way: Vera breaks glass, Petra gets an idea, Rewind's
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
    if boss == 'vera':
        # Glass breaks off the wall on one kick-off in five. (Her gusts of wind come on a clock of
        # their own, about one flip in two: vr_fx.py.)
        em['kick-glass']['chance'] = 0.2
    elif boss == 'petra':
        # An idea lights up over her head on one wall move or roll in five; her blade's cut sweeps
        # over her on one flip in five. (Her quick change comes with its snapshot's own chance,
        # chain and burst: pr_fx.py.)
        em['idea']['chance'] = 0.2
        em['cut']['chance'] = 0.2
    elif boss == 'rewind':
        # A Polaroid (with its flash) on about a third of the tricks, now and then two: never more.
        em['photo'] = {**em['photo'], 'enter': TRICKS, 'chance': 0.33}
    elif boss == 'shahzada':
        # His statue of sand (the afterimage, with its chance) brings its grains; sand runs off his
        # boots on a third of the wall moves.
        em['wall-sand'] = {**em['wall-sand'], 'enter': ['wall'], 'chance': 0.3}
    elif boss == 'grove':
        # RESPECT + over his head on one flip or vault in five, a bill or two off him on some of
        # them (each rolls its own chance).
        em['respect'] = {**em['respect'], 'enter': ['flip', 'vault'], 'chance': 0.2}
        em['bills'] = {**em['bills'], 'enter': ['flip', 'vault'], 'chance': 0.2}
    elif boss == 'b2':
        # Her Perfect Evade comes on three in ten of the rolls, dashes and flips, its flash, slices
        # and cubes with it (the snapshot's own chance, chain and burst, in b2_fx.py): nothing to
        # add.
        pass
    elif boss == 'five':
        # V's Sandevistan comes on about one flip or vault in four, its stepped smear with it (the
        # snapshot's own chance and burst, in fv_fx.py); the Relic glitch is no trick's: nothing
        # to add.
        pass
    elif boss == 'flittermouse':
        # A batarang on about a third of the flips and vaults, ahead from the near hand; a colony of
        # bats scattering every way on about one trick in six.
        em['batarang'] = {**em['batarang'], 'enter': ['flip', 'vault'], 'chance': 0.35}
        em['swarm'] = {**em['swarm'], 'enter': TRICKS, 'chance': 0.18}
    elif boss == 'widow':
        # Her grappling hook on about half of her runs up a wall (move 33: only there has it a wall
        # to bite); a kiss blown on one landing in ten; her venom let out along her way on about two
        # rolls or hard landings (moves 24 and 25) in five. (Her spectral shot comes on a third of
        # the flips and vaults with its snapshot's own chance: wd_fx.py.)
        em['grapple']['chance'] = 0.45
        em['kiss-land']['chance'] = 0.1
        em['venom']['chance'] = 0.4
    elif boss == 'rush-b':
        # A smoke grenade on about one hard landing (moves 24 and 25, the landings that need DOWN)
        # or roll in five; its cloud stays where it fell.
        em['smoke-nade'] = {**em['smoke-nade'], 'enter': ['roll'], 'moves': [24, 25], 'chance': 0.22}
        # A spray of casings and rounds on about a third of the flips and vaults.
        em['spray'] = {**em['spray'], 'enter': ['flip', 'vault'], 'chance': 0.3}
    elif boss == 'sir-nobody':
        # His summon sign stays on the roof where he touches down, about one time in three; the
        # soul is shaken out of his slit on some flips and vaults. (His steel sparks on most of
        # his contacts with a wall, a roof or a pole bring their own chances: kn_sparks.py.)
        em['sign']['chance'] = 0.3
        em['soul-trick']['chance'] = 0.3
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
