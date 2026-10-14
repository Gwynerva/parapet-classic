/**
 * One vector runner: every runner of the original, Blaise and the nine others, is the same
 * object of 19 layers of sprites posed by 463 keyframes; a character is a swap of a few sprites,
 * and the ghost of an earlier hot-seat player is the same skeleton drawn as dots.
 */
import {
  characterObject,
  explodedScene,
  partSprites,
  partsSheet,
  skinsScene,
  tweenScene,
} from '../experiments/vectorRunner.ts';
import type { Facts, Finding } from '../finding.ts';
import type { Lab } from '../lab.ts';

interface RunnerFacts extends Facts {
  keyframes: number;
  /** Layers (primitives) of the runner's object. */
  parts: number;
  sprites: number;
  pivot: readonly number[];
  size: readonly number[];
  clips: number;
  /** Keyframes no clip uses. */
  unused: number;
}

export const oneVectorRunner: Finding<RunnerFacts> = {
  slug: '08-one-vector-runner',
  title: 'One vector runner',
  claim:
    'The runner is no sprite sheet: 19 layers of small sprites placed anew in each of 463 keyframes and tweened between them; a character is a swap of a few sprites.',

  facts(lab: Lab): RunnerFacts {
    const obj = characterObject(lab);
    const used = new Set(Object.values(lab.src.anims.clips).flat());
    return {
      keyframes: obj.frames,
      parts: obj.primitives.length,
      sprites: new Set(partSprites(obj).flat()).size,
      pivot: [obj.pivotX, obj.pivotY],
      size: [obj.width, obj.height],
      clips: Object.keys(lab.src.anims.clips).length,
      unused: obj.frames - [...used].filter((k) => k >= 0 && k < obj.frames).length,
    };
  },

  measured(f: RunnerFacts): [string, string][] {
    return [
      ['Keyframes of the runner', String(f.keyframes)],
      ['Layers, and the sprites they show', `${f.parts}, ${f.sprites}`],
      ['Its box, and the pivot on the feet', `${f.size.join(' × ')}, (${f.pivot.join(', ')})`],
      ['Animation clips', String(f.clips)],
      ['Keyframes no clip uses', String(f.unused)],
    ];
  },

  checks(f: RunnerFacts): string[] {
    const out: string[] = [];
    if (f.keyframes !== 463) out.push(`${f.keyframes} keyframes`);
    if (f.parts !== 19) out.push(`${f.parts} layers`);
    if (f.sprites < 40) out.push(`only ${f.sprites} sprites`);
    return out;
  },

  clips(lab: Lab) {
    const parts = explodedScene(lab);
    const skins = skinsScene(lab);
    const tween = tweenScene(lab);
    return [
      {
        name: 'parts',
        alt: 'Blaise runs while the body’s parts drift apart and come back together: head, ponytail, torso, arms and legs are separate small sprites.',
        scene: parts,
        script: [
          { from: parts.from, to: parts.to, speed: 0.7 },
          { at: parts.to, holdMs: 300 },
        ],
      },
      {
        name: 'skins',
        alt: 'The ten characters of the original and the dotted ghost of an earlier hot-seat player run in step: the same skeleton with other parts.',
        scene: skins,
        script: [{ from: skins.from, to: skins.to }],
      },
      {
        name: 'tween',
        alt: 'The run slowed down four times: left, the keyframes alone, jumping from one to the next; right, as the game draws it, tweened from the previous keyframe to the current one.',
        scene: tween,
        script: [{ from: tween.from, to: tween.to, speed: 0.25 }],
      },
    ];
  },

  charts() {
    return [];
  },

  pictures(lab: Lab) {
    return [
      {
        name: 'wardrobe',
        alt: 'The sprites each of the 19 layers of the runner shows over its 463 keyframes, a row per layer: one layer holds a forearm in one pose and the head in another.',
        image: partsSheet(lab).img,
        scale: 2,
      },
    ];
  },
};
