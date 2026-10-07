import { describe, expect, it } from 'vitest';
import { jar } from './helpers.ts';

describe('zip reader', () => {
  it('lists the game resources', () => {
    const names = jar().names();
    for (const name of ['i', 'p', 'l', 's', 'b0', 'b1', 'b2', 'g0', 'g8', 'k0', 'k13', 'd.class']) {
      expect(names).toContain(name);
    }
  });

  it('inflates entries to their declared sizes', () => {
    expect(jar().read('i').length).toBe(1866);
    expect(jar().read('p').length).toBe(5474);
    expect(jar().read('s').length).toBe(212962);
    expect(jar().read('k0').length).toBe(52874);
    expect(jar().read('l').length).toBe(20984);
  });

  it('rejects unknown names', () => {
    expect(() => jar().read('does-not-exist')).toThrow(/no entry/);
  });
});
