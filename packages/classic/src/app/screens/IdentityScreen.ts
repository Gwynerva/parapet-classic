/**
 * The public name of this device: claim one (the server hands out a token and a one-time
 * recovery code), recover one on a new device with the code, or forget it. Publishing a run
 * needs a claimed name; local records never do.
 */
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Menu, type MenuItem } from '@parapet/runtime/ui/Menu.ts';
import {
  clear,
  heading,
  panel,
  drawBackButton,
  hitBackButton,
  headingCenterY,
} from '@parapet/runtime/ui/draw.ts';
import { fitWidth, inset, rowHeight, safeRect, type Rect } from '@parapet/runtime/ui/layout.ts';
import { MessageBox } from '@parapet/runtime/ui/MessageBox.ts';
import { TextInputOverlay } from '@parapet/runtime/ui/TextInputOverlay.ts';
import {
  clearIdentity,
  loadIdentity,
  saveIdentity,
  type StoredIdentity,
} from '@parapet/runtime/storage/profile.ts';
import { ApiError, claimName, recoverName } from '@parapet/runtime/net/api.ts';
import { MAX_PUBLIC_NAME_LENGTH } from '@parapet/protocol';

const NAME_CHARS = /[\p{L}\p{N}_.-]/u;
const CODE_CHARS = /[A-Za-z0-9]/;

type Step = 'idle' | 'name' | 'code' | 'busy';

export class IdentityScreen implements Screen {
  private readonly ctx: GameContext;
  private readonly menu: Menu;
  private readonly onDone: ((identity: StoredIdentity | null) => void) | null;
  private identity: StoredIdentity | null;
  private step: Step = 'idle';
  private recovering = false;
  private pendingName = '';
  private status = '';
  private input: TextInputOverlay | null = null;
  private inputRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(ctx: GameContext, onDone: ((identity: StoredIdentity | null) => void) | null = null) {
    this.ctx = ctx;
    this.onDone = onDone;
    this.menu = new Menu(ctx.fonts.text, ctx.fonts.small);
    this.identity = loadIdentity();
    this.rebuild();
  }

  private rebuild(): void {
    const { i18n } = this.ctx;
    const items: MenuItem[] = [];
    if (!this.identity) {
      items.push({ label: i18n.t('identity.claim'), onSelect: () => this.beginClaim() });
    }
    items.push({ label: i18n.t('identity.recover'), onSelect: () => this.beginRecover() });
    if (this.identity) {
      items.push({ label: i18n.t('identity.signOut'), onSelect: () => this.signOut() });
    }
    const cursor = this.menu.cursor;
    this.menu.setItems(items);
    this.menu.cursor = Math.min(cursor, items.length - 1);
    this.onResize();
  }

  private leave(): void {
    this.closeInput();
    this.ctx.screens.pop();
    this.onDone?.(this.identity);
  }

  private signOut(): void {
    clearIdentity();
    this.identity = null;
    this.status = '';
    this.rebuild();
  }

  private beginClaim(): void {
    this.recovering = false;
    this.askName();
  }

  private beginRecover(): void {
    this.recovering = true;
    this.askName();
  }

  private askName(): void {
    this.step = 'name';
    this.status = this.ctx.i18n.t('identity.enterName');
    this.openInput({
      maxLength: MAX_PUBLIC_NAME_LENGTH,
      allowed: NAME_CHARS,
      initial: this.identity?.name ?? this.ctx.player.name,
      onCommit: (value) => {
        this.pendingName = value.trim();
        if (!this.pendingName) {
          this.step = 'idle';
          this.status = '';
          return;
        }
        if (this.recovering) this.askCode();
        else void this.claim(this.pendingName);
      },
    });
  }

  private askCode(): void {
    this.step = 'code';
    this.status = this.ctx.i18n.t('identity.enterCode');
    this.openInput({
      maxLength: 12,
      allowed: CODE_CHARS,
      initial: '',
      onCommit: (value) => void this.recover(this.pendingName, value.trim()),
    });
  }

  private openInput(opts: {
    maxLength: number;
    allowed: RegExp;
    initial: string;
    onCommit: (value: string) => void;
  }): void {
    this.closeInput();
    this.input = new TextInputOverlay(this.ctx.viewport, {
      maxLength: opts.maxLength,
      allowed: opts.allowed,
      initial: opts.initial,
      fontFamily: 'Terminus',
      onCommit: (value) => {
        this.input = null;
        opts.onCommit(value);
      },
      onCancel: () => {
        this.input = null;
        this.step = 'idle';
        this.status = '';
      },
    });
    this.input.open(this.inputRect);
  }

  private closeInput(): void {
    this.input?.close();
    this.input = null;
  }

  private async claim(name: string): Promise<void> {
    const { i18n } = this.ctx;
    this.step = 'busy';
    this.status = i18n.t('identity.checking');
    try {
      const claimed = await claimName(name, { timeoutMs: 8000 });
      this.identity = {
        name: claimed.name,
        token: claimed.token,
        recoveryCode: claimed.recoveryCode,
      };
      saveIdentity(this.identity);
      this.ctx.player.name = claimed.name;
      this.status = '';
      this.step = 'idle';
      this.rebuild();
      this.showCode(claimed.name, claimed.recoveryCode);
    } catch (err) {
      this.step = 'idle';
      this.status = this.describeError(err);
    }
  }

  private async recover(name: string, code: string): Promise<void> {
    const { i18n } = this.ctx;
    this.step = 'busy';
    this.status = i18n.t('identity.checking');
    try {
      const fresh = await recoverName(name, code, { timeoutMs: 8000 });
      this.identity = { name: fresh.name, token: fresh.token, recoveryCode: fresh.recoveryCode };
      saveIdentity(this.identity);
      this.ctx.player.name = fresh.name;
      this.status = '';
      this.step = 'idle';
      this.rebuild();
      this.showCode(fresh.name, fresh.recoveryCode);
    } catch (err) {
      this.step = 'idle';
      this.status = this.describeError(err);
    }
  }

  private showCode(name: string, code: string): void {
    const { i18n, screens } = this.ctx;
    screens.push(
      new MessageBox(
        { viewport: this.ctx.viewport, fonts: this.ctx.fonts },
        {
          title: i18n.t('identity.title'),
          tone: 'success',
          pages: [i18n.t('identity.claimed', { name, code })],
          labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
          onClose: () => screens.pop(),
        },
      ),
    );
  }

  private describeError(err: unknown): string {
    const { i18n } = this.ctx;
    if (!(err instanceof ApiError)) return i18n.t('net.error');
    switch (err.code) {
      case 'name-taken':
        return i18n.t('identity.taken');
      case 'name-invalid':
        return i18n.t('identity.invalid');
      case 'unauthorized':
        return i18n.t('identity.wrongCode');
      case 'rate-limited':
        return i18n.t('net.rateLimited');
      case 'network':
      case 'timeout':
        return i18n.t('net.offline');
      default:
        return i18n.t('net.error');
    }
  }

  exit(): void {
    this.closeInput();
  }

  onResize(): void {
    const { viewport, fonts } = this.ctx;
    const safe = safeRect(viewport);
    const col = fitWidth(inset(safe, 8, 0), 360);
    const row = rowHeight(22, viewport.isCoarsePointer);
    this.menu.layout.x = col.x;
    this.menu.layout.width = col.w;
    this.menu.layout.rowHeight = row;
    this.menu.layout.y = safe.y + 120;
    this.inputRect = { x: col.x + 8, y: safe.y + 84, w: col.w - 16, h: fonts.text.lineHeight + 6 };
    this.input?.reposition(this.inputRect);
  }

  update(): void {}

  onKey(key: UiKey): void {
    if (this.input?.isOpen || this.step === 'busy') return;
    if (key.action === 'back') {
      this.leave();
      return;
    }
    this.menu.onKey(key);
  }

  onPointer(p: UiPointer): void {
    if (this.step === 'busy') return;
    if (p.type === 'down' && hitBackButton(this.ctx.viewport, p.x, p.y)) {
      this.leave();
      return;
    }
    this.menu.onPointer(p);
  }

  render(c: CanvasRenderingContext2D): void {
    const { viewport, fonts, i18n } = this.ctx;
    clear(c, viewport.width, viewport.height);
    drawBackButton(c, fonts.text, viewport, headingCenterY(fonts.display, viewport.safeArea.top));
    const safe = safeRect(viewport);
    const cx = safe.x + (safe.w >> 1);
    heading(c, fonts.display, i18n.t('identity.title'), cx, safe.y + 8);
    const { x, width } = this.menu.layout;
    panel(c, x - 8, safe.y + 34, width + 16, 76);
    const lines: string[] = [];
    if (this.identity) {
      lines.push(i18n.t('identity.current', { name: this.identity.name }));
      if (this.identity.recoveryCode)
        lines.push(i18n.t('identity.recoveryCode', { code: this.identity.recoveryCode }));
    } else {
      lines.push(...fonts.small.wrap(i18n.t('identity.none'), width - 16).slice(0, 2));
    }
    fonts.small.draw(c, lines.join('\n'), x, safe.y + 40, { color: Theme.text });
    if (this.status) {
      fonts.small.draw(c, this.status, x, safe.y + 66, { color: Theme.accent });
    }
    if (this.input?.isOpen) {
      // The HTML field covers this rectangle; draw its frame so the panel reads as a form.
      c.fillStyle = Theme.panelBorder;
      c.fillRect(
        this.inputRect.x - 1,
        this.inputRect.y - 1,
        this.inputRect.w + 2,
        this.inputRect.h + 2,
      );
    }
    this.menu.draw(c);
  }
}
