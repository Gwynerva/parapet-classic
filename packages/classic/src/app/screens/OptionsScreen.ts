/**
 * Options: language, scale, music volume (a slider), full screen, vibration, the touch
 * buttons and clearing the records. Every change is saved at once.
 */
import type { GameContext } from '../Context.ts';
import type { Screen, UiGesture, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import { MessageBox } from '@parapet/runtime/ui/MessageBox.ts';
import { fitWidth, rowHeight } from '@parapet/runtime/ui/layout.ts';
import { AVAILABLE_LOCALES, localeName } from '../../i18n/locales.ts';
import {
  clearRecords,
  saveOptions,
  type Options,
  type TouchControlsSetting,
} from '@parapet/runtime/storage/profile.ts';
import { isScaleMode, type ScaleMode } from '@parapet/runtime/render/Viewport.ts';
import { isVibrationSupported, setVibrationEnabled } from '@parapet/runtime/input/InputManager.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';

const SCALE_MODES: ScaleMode[] = ['auto', 1, 2, 3, 4, 5, 6, 7, 8];
const TOUCH_SETTINGS: TouchControlsSetting[] = ['auto', 'on', 'off'];
const VOLUME_STEP = 5;

export class OptionsScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private readonly ctx: GameContext;
  private readonly frame: ScreenFrame;
  private readonly menu: Menu;
  private confirmClear = false;
  private cleared = false;
  private unsubscribe: (() => void) | null = null;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.frame = new ScreenFrame(ctx);
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
  }

  private cycle<T>(list: readonly T[], current: T, delta: number): T {
    const i = Math.max(0, list.indexOf(current));
    return list[(i + delta + list.length) % list.length]!;
  }

  enter(): void {
    // The full-screen row follows the real state (F, the corner button, the browser's Esc).
    this.unsubscribe = this.ctx.platform.fullscreen.onChange(() => this.rebuild());
    this.rebuild();
  }

  exit(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private rebuild(): void {
    const { i18n, options, viewport, touch, platform } = this.ctx;
    const onOff = (on: boolean): string => i18n.t(on ? 'options.on' : 'options.off');
    const items: MenuItem[] = [
      {
        label: i18n.t('options.language'),
        value: localeName(i18n.locale),
        onAdjust: (d) => {
          const next = this.cycle(AVAILABLE_LOCALES, i18n.locale, d);
          // Switch the dictionary first so the rebuilt rows already use the new language.
          i18n.setLocale(next);
          this.apply({ locale: next });
        },
      },
      {
        label: i18n.t('options.scale'),
        value:
          options.scaleMode === 'auto'
            ? `${i18n.t('options.scale.auto')} (${viewport.scale}x)`
            : `${options.scaleMode}x`,
        onAdjust: (d) => {
          const next = this.cycle(SCALE_MODES, options.scaleMode, d);
          if (isScaleMode(next)) {
            this.apply({ scaleMode: next });
            viewport.scaleMode = next;
          }
        },
      },
      {
        label: i18n.t('options.music'),
        slider: {
          value: options.musicLevel,
          min: 0,
          max: 100,
          step: VOLUME_STEP,
          format: (v) => (v === 0 ? i18n.t('options.off') : i18n.t('options.percent', { n: v })),
        },
        onChange: (value, final) => {
          // The music follows the drag; the choice is saved when the finger lets go.
          options.musicLevel = value;
          this.ctx.music.setVolume(value);
          if (final) this.apply({ musicLevel: value });
          else this.rebuild();
        },
      },
    ];
    if (!platform.installed) {
      if (platform.canFullscreen) {
        items.push({
          label: i18n.t('options.fullscreen'),
          value: onOff(platform.fullscreen.active),
          // Full screen needs the key press or tap itself: the row works from `onGesture`.
          gesture: true,
          onAdjust: () => platform.toggleFullscreen(),
        });
      } else if (platform.ios) {
        items.push({
          label: i18n.t('options.fullscreen'),
          value: i18n.t('options.fullscreen.homeScreen'),
          onSelect: () => this.showHomeScreenHint(),
        });
      }
    }
    if (isVibrationSupported()) {
      items.push({
        label: i18n.t('options.vibration'),
        value: onOff(options.vibration),
        onAdjust: () => {
          this.apply({ vibration: !options.vibration });
          setVibrationEnabled(options.vibration);
        },
      });
    }
    items.push(
      {
        label: i18n.t('options.touchControls'),
        value:
          options.touchControls === 'auto'
            ? i18n.t('options.touchControls.auto')
            : i18n.t(`options.${options.touchControls}`),
        onAdjust: (d) => {
          this.apply({ touchControls: this.cycle(TOUCH_SETTINGS, options.touchControls, d) });
          touch.enabled =
            options.touchControls === 'auto'
              ? viewport.isCoarsePointer
              : options.touchControls === 'on';
        },
      },
      {
        label: i18n.t('options.touchLayout'),
        value: i18n.t(
          options.touchLayout === 'move-left'
            ? 'options.touchLayout.moveLeft'
            : 'options.touchLayout.moveRight',
        ),
        onAdjust: () => {
          this.apply({
            touchLayout: options.touchLayout === 'move-left' ? 'move-right' : 'move-left',
          });
          touch.layout = options.touchLayout;
        },
      },
      {
        label: this.cleared
          ? i18n.t('options.clearRecords.done')
          : this.confirmClear
            ? i18n.t('options.clearRecords.confirm')
            : i18n.t('options.clearRecords'),
        onSelect: () => {
          if (this.cleared) return;
          if (!this.confirmClear) {
            this.confirmClear = true;
          } else {
            clearRecords();
            this.cleared = true;
          }
          this.rebuild();
        },
      },
    );
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.setCursor(Math.min(cursor, items.length - 1));
    this.onResize();
  }

  private showHomeScreenHint(): void {
    const { i18n, screens } = this.ctx;
    screens.push(
      new MessageBox(this.ctx, {
        title: i18n.t('options.fullscreen'),
        pages: [i18n.t('options.fullscreen.iosHint')],
        labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
        onClose: () => screens.pop(),
      }),
    );
  }

  private apply(patch: Partial<Options>): void {
    Object.assign(this.ctx.options, saveOptions(patch));
    this.rebuild();
  }

  onResize(): void {
    const { viewport } = this.ctx;
    this.frame.layout();
    const body = this.frame.body;
    const col = fitWidth(body, 400);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = rowHeight(22, viewport.isCoarsePointer);
    this.menu.fit(body.h);
    // A short list sits a little above the middle; a long one starts under the heading.
    this.menu.layout.y = body.y + Math.floor(Math.max(0, body.h - this.menu.height) * 0.4);
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (key.action === 'back') {
      this.ctx.screens.pop();
      return;
    }
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    if (this.frame.onPointer(p)) return;
    this.menu.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    this.menu.onWheel(w);
  }

  onGesture(g: UiGesture): boolean {
    return this.menu.onGesture(g);
  }

  render(c: CanvasRenderingContext2D): void {
    this.frame.draw(c, this.ctx.i18n.t('options.title'));
    this.menu.draw(c);
  }
}
