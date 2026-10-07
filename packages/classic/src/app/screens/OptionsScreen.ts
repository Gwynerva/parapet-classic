import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import {
  clear,
  heading,
  drawBackButton,
  hitBackButton,
  headingCenterY,
  HEADING_TOP,
} from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect } from '@parapet/runtime/ui/layout.ts';
import { AVAILABLE_LOCALES } from '../../i18n/locales.ts';
import {
  clearRecords,
  loadIdentity,
  saveOptions,
  type TouchControlsSetting,
} from '@parapet/runtime/storage/profile.ts';
import { isScaleMode, type ScaleMode } from '@parapet/runtime/render/Viewport.ts';
import { setVibrationEnabled } from '@parapet/runtime/input/InputManager.ts';
import { VOLUME_STEPS } from '@parapet/runtime/audio/MusicDirector.ts';
import { IdentityScreen } from './IdentityScreen.ts';

const SCALE_MODES: ScaleMode[] = ['auto', 1, 2, 3, 4, 5, 6, 7, 8];
const TOUCH_SETTINGS: TouchControlsSetting[] = ['auto', 'on', 'off'];

export class OptionsScreen implements Screen {
  private readonly menu: Menu;
  private confirmClear = false;
  private cleared = false;

  private readonly ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
  }

  private cycle<T>(list: readonly T[], current: T, delta: number): T {
    const i = Math.max(0, list.indexOf(current));
    return list[(i + delta + list.length) % list.length]!;
  }

  enter(): void {
    this.rebuild();
  }

  private rebuild(): void {
    const { i18n, options, viewport, touch } = this.ctx;
    const locales = ['auto', ...AVAILABLE_LOCALES];
    const items: MenuItem[] = [
      {
        label: i18n.t('options.language'),
        value: options.locale === 'auto' ? i18n.t('options.language.auto') : options.locale,
        onAdjust: (d) => {
          const next = this.cycle(locales, options.locale, d);
          // Switch the dictionary first so the rebuilt rows already use the new language.
          i18n.setLocale(next === 'auto' ? detectBrowserLocale() : next);
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
        value: '#'.repeat(options.musicVolume) + '-'.repeat(VOLUME_STEPS - options.musicVolume),
        onAdjust: (d) => {
          const next = (options.musicVolume + d + VOLUME_STEPS + 1) % (VOLUME_STEPS + 1);
          this.apply({ musicVolume: next });
          this.ctx.music.setVolume(next);
        },
      },
      {
        label: i18n.t('options.vibration'),
        value: options.vibration ? i18n.t('options.on') : i18n.t('options.off'),
        onAdjust: () => {
          this.apply({ vibration: !options.vibration });
          setVibrationEnabled(options.vibration);
        },
      },
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
      {
        label: i18n.t('options.identity'),
        value: loadIdentity()?.name ?? '-',
        onSelect: () => this.ctx.screens.push(new IdentityScreen(this.ctx)),
      },
    ];
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.cursor = Math.min(cursor, items.length - 1);
    this.onResize();
  }

  private apply(patch: Partial<typeof this.ctx.options>): void {
    Object.assign(this.ctx.options, saveOptions(patch));
    this.rebuild();
  }

  onResize(): void {
    const { viewport } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 400);
    const row = rowHeight(22, viewport.isCoarsePointer);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = safe.y + 44;
    this.menu.maxVisible = Math.max(3, Math.floor((safe.h - 84) / row));
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
    if (p.type === 'down' && hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.ctx.screens.pop();
      return;
    }
    this.menu.onPointer(p);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    heading(
      c,
      fonts.display,
      i18n.t('options.title'),
      viewport.width >> 1,
      viewport.safeArea.top + HEADING_TOP,
    );
    this.menu.draw(c);
    void Theme;
  }
}

function detectBrowserLocale(): string {
  const tag = (navigator.language || 'en').toLowerCase();
  return AVAILABLE_LOCALES.find((l) => tag.startsWith(l)) ?? 'en';
}
