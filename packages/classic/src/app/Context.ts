/**
 * Everything a screen needs: platform objects, fonts, dictionaries, content, renderers and the
 * player's profile. Created once in `main.ts` and passed to every screen.
 */
import type { MoveTable } from '@parapet/sim';
import type { Viewport } from '@parapet/runtime/render/Viewport.ts';
import type { BitmapFont } from '@parapet/runtime/text/BitmapFont.ts';
import type { I18n } from '@parapet/runtime/i18n/i18n.ts';
import type { InputManager } from '@parapet/runtime/input/InputManager.ts';
import type { TouchControls } from '@parapet/runtime/input/TouchControls.ts';
import type { Options, PlayerInfo } from '@parapet/runtime/storage/profile.ts';
import type { GameContent } from '../assets/content.ts';
import type { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import type { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import type { LevelRenderer } from '@parapet/runtime/render/LevelRenderer.ts';
import type { ScreenStack } from '@parapet/runtime/app/Screen.ts';
import type { MusicDirector } from '@parapet/runtime/audio/MusicDirector.ts';

export interface Fonts {
  /** Terminus 12 px: HUD labels and small text. */
  small: BitmapFont;
  /** Terminus 16 px: body text and menus. */
  text: BitmapFont;
  /** Russo One 16 px: headings. */
  display: BitmapFont;
  /** Russo One 24 px: titles and the score. */
  title: BitmapFont;
}

export interface Skin {
  id: string;
  name: string;
  /** Original character index used by the body-part swap rules. */
  character: number;
}

/** Shared rendering objects (one atlas, one scene interpreter, one level renderer). */
export interface Renderers {
  sheet: SpriteSheet;
  scene: SceneRenderer;
  level: LevelRenderer;
  moves: MoveTable;
  clips: Int16Array;
  sine: Int16Array;
}

export interface GameContext {
  viewport: Viewport;
  input: InputManager;
  touch: TouchControls;
  i18n: I18n;
  fonts: Fonts;
  content: GameContent;
  skins: Skin[];
  render: Renderers;
  screens: ScreenStack;
  music: MusicDirector;
  options: Options;
  player: PlayerInfo;
  /** Facing of the player at press time; the play screen points it at the live runner. */
  facingRight: () => boolean;
}

export { Theme, formatTime } from '@parapet/runtime/ui/theme.ts';
