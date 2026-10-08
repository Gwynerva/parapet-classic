import { describe, expect, it } from 'vitest';
import { counterOrigin } from '../src/app/analytics.ts';

describe('counterOrigin', () => {
  it('takes a goatcounter.com code or an https address of our own', () => {
    expect(counterOrigin('parapet-classic')).toBe('https://parapet-classic.goatcounter.com');
    expect(counterOrigin(' https://stats.example.org/ ')).toBe('https://stats.example.org');
    expect(counterOrigin('https://stats.example.org:8443/count')).toBe(
      'https://stats.example.org:8443',
    );
  });

  it('counts nowhere for nothing, plain http or a mistyped code', () => {
    expect(counterOrigin('')).toBe('');
    expect(counterOrigin('http://stats.example.org')).toBe('');
    expect(counterOrigin('Parapet Classic')).toBe('');
  });
});
