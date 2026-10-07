import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { nameKey, validatePublicName } from '@parapet/protocol';
import {
  authenticate,
  claimName,
  createRecoveryCode,
  createToken,
  JsonNameStore,
  MemoryNameStore,
  normaliseRecoveryCode,
  recoverName,
} from '../src/names.ts';

const now = new Date('2026-10-07T10:00:00.000Z');

describe('public names', () => {
  it('validates length and characters', () => {
    expect(validatePublicName('Runner_42')).toMatchObject({
      ok: true,
      name: 'Runner_42',
      key: 'runner42',
    });
    expect(validatePublicName('  Ива.Н  ')).toMatchObject({ ok: true, name: 'Ива.Н' });
    expect(validatePublicName('ab').ok).toBe(false);
    expect(validatePublicName('a'.repeat(17)).ok).toBe(false);
    expect(validatePublicName('_abc').ok).toBe(false);
    expect(validatePublicName('ab c').ok).toBe(false);
    expect(validatePublicName('ab\u0007c').ok).toBe(false);
    expect(validatePublicName(42).ok).toBe(false);
  });

  it('folds confusable Cyrillic letters into the key', () => {
    expect(nameKey('Pаrapet')).toBe(nameKey('Parapet')); // Cyrillic а
    expect(nameKey('Ру-ра')).toBe('pypa');
    expect(nameKey('A_b.c-d')).toBe('abcd');
  });
});

describe('claims', () => {
  it('claims a free name once and authenticates with the token', () => {
    const store = new MemoryNameStore();
    const first = claimName(store, 'Alice', 'alice', now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.token).toHaveLength(43);
    expect(first.recoveryCode).toHaveLength(8);
    expect(claimName(store, 'alice', 'alice', now)).toEqual({ ok: false, code: 'name-taken' });
    expect(authenticate(store, 'alice', first.token)?.name).toBe('Alice');
    expect(authenticate(store, 'alice', 'wrong')).toBeNull();
    expect(authenticate(store, 'bob', first.token)).toBeNull();
    expect(store.count()).toBe(1);
  });

  it('recovers a name with the code and rotates both secrets', () => {
    const store = new MemoryNameStore();
    const first = claimName(store, 'Alice', 'alice', now);
    if (!first.ok) throw new Error('claim failed');
    expect(recoverName(store, 'alice', 'NOPE1234', now)).toEqual({
      ok: false,
      code: 'unauthorized',
    });
    const lower = first.recoveryCode.toLowerCase();
    const recovered = recoverName(store, 'alice', lower, now);
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.token).not.toBe(first.token);
    expect(authenticate(store, 'alice', first.token)).toBeNull();
    expect(authenticate(store, 'alice', recovered.token)).not.toBeNull();
    expect(recoverName(store, 'alice', first.recoveryCode, now).ok).toBe(false);
  });

  it('generates secrets from the unambiguous alphabet', () => {
    for (let i = 0; i < 20; i++) {
      expect(createRecoveryCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
      expect(createToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    expect(normaliseRecoveryCode('ab-cd 0o1l')).toBe('ABCD0011');
  });
});

describe('JsonNameStore', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('persists claims across instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parapet-names-'));
    dirs.push(dir);
    const file = join(dir, 'names.json');
    const store = new JsonNameStore(file);
    const claimed = claimName(store, 'Alice', 'alice', now);
    if (!claimed.ok) throw new Error('claim failed');
    const reloaded = new JsonNameStore(file);
    expect(reloaded.count()).toBe(1);
    expect(authenticate(reloaded, 'alice', claimed.token)?.name).toBe('Alice');
  });
});
