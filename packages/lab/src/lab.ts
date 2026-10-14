/**
 * What the experiments run on: the original's data (the move table, the physics tables, the
 * levels and their missions, the rivals' recordings, the scenes and the atlas) and our fonts,
 * whoever loads them (files in Node for the findings generator, the bundle in the browser for
 * the Lab), plus what is made from them once.
 */
import {
  buildSineTable,
  MoveTable,
  type LevelData,
  type MoveTableData,
  type PhysicsTables,
} from '@parapet/sim';
import type { RivalRecording, RunContent } from '@parapet/sim';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import {
  runContentOf,
  type AnimData,
  type MissionsData,
  type SceneFile,
} from '@parapet/runtime/content/types.ts';
import type { MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import { newImage, type RgbaImage, type RgbaSheet } from '@parapet/runtime/render/Raster.ts';
import { rasterPainter, sizedSheet } from '@parapet/runtime/render/SceneRaster.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { defaultLevelArtFrame } from '@parapet/runtime/render/LevelRenderer.ts';
import type { RasterFont } from '@parapet/runtime/text/RasterText.ts';

export interface LabSources {
  moves: MoveTableData;
  tables: PhysicsTables;
  anims: AnimData;
  scenes: Iterable<SceneFile>;
  /** Level tile maps by level id. */
  levels: LevelData[];
  missions: MissionsData;
  rivals: Map<number, RivalRecording>;
  /** The atlas as bytes, with its frames. */
  atlas: RgbaSheet;
  fonts: { small: RasterFont; text: RasterFont };
  /** The Moves menu's demos: little levels of grey blocks with a move on each. */
  demos: readonly MoveDemoData[];
  /** The levels' names by level id, in the language shown. */
  levelNames: readonly string[];
}

export class Lab {
  readonly src: LabSources;
  readonly moves: MoveTable;
  readonly clips: Int16Array;
  /** Lays scenes out (the atlas' sizes); draws them through `rasterPainter`. */
  readonly scene: SceneRenderer;
  /** The game's sine table (512 entries to a turn, ×1024). */
  readonly sine = buildSineTable(10, true);
  private readonly art = new Map<number, RgbaImage>();

  constructor(src: LabSources) {
    this.src = src;
    this.moves = new MoveTable(src.moves);
    this.clips = buildClipTable(src.anims.clips);
    this.scene = new SceneRenderer(sizedSheet(src.atlas.frames), src.scenes);
  }

  get atlas(): RgbaSheet {
    return this.src.atlas;
  }

  get fonts(): LabSources['fonts'] {
    return this.src.fonts;
  }

  /** What a run of a level is built from (its rival included). */
  run(levelId: number): RunContent {
    const content = runContentOf(this.src, levelId);
    if (!content) throw new Error(`level ${levelId} does not exist`);
    return content;
  }

  /** A level's name (the game numbers them from 1: level id 0 is the first). */
  levelName(levelId: number): string {
    return this.src.levelNames[levelId] ?? `Level ${levelId + 1}`;
  }

  /** A demo of the Moves menu by its move. */
  demo(move: string): MoveDemoData {
    const demo = this.src.demos.find((d) => d.move === move);
    if (!demo) throw new Error(`no demo of ${move}`);
    return demo;
  }

  /**
   * A level's art (its usual frame) drawn whole, its top-left at (0, 0) of the picture and the
   * level's (0, 0) at the object's pivot: made once per level.
   */
  levelArt(levelId: number): { image: RgbaImage; pivotX: number; pivotY: number } {
    const id = this.src.missions.levels[levelId]?.backgroundSceneId ?? -1;
    const obj = this.scene.getObject(id);
    if (!obj) throw new Error(`level ${levelId} has no art`);
    let image = this.art.get(levelId);
    if (!image) {
      image = newImage(obj.width, obj.height);
      const frame = defaultLevelArtFrame(levelId);
      this.scene.withViewport(obj.width, obj.height, () =>
        this.scene.paintObject(
          rasterPainter(image!, this.atlas),
          id,
          frame,
          frame,
          0,
          0,
          0,
          false,
          undefined,
          ANCHOR_TOP_LEFT,
        ),
      );
      this.art.set(levelId, image);
    }
    return { image, pivotX: obj.pivotX, pivotY: obj.pivotY };
  }
}
