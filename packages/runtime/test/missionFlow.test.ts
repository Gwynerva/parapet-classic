import { describe, expect, it } from 'vitest';
import { MissionFlow } from '../src/app/MissionFlow.ts';

describe('MissionFlow', () => {
  it('runs a warm-up through its tutorial pages, then ready and play', () => {
    const flow = new MissionFlow({
      tutorialPages: 3,
      briefing: false,
      flyover: false,
      readyMs: 500,
    });
    expect(flow.phase).toBe('tutorial');
    expect(flow.advance()).toBe('tutorial');
    expect(flow.tutorialPage).toBe(1);
    flow.advance();
    expect(flow.advance()).toBe('ready');
    expect(flow.tickReady(200)).toBe(false);
    expect(flow.tickReady(300)).toBe(true);
    expect(flow.playing).toBe(true);
    flow.finish();
    expect(flow.phase).toBe('done');
  });

  it('runs a sprint through briefing, flyover and ready', () => {
    const flow = new MissionFlow({ tutorialPages: 0, briefing: true, flyover: true, readyMs: 100 });
    expect(flow.phase).toBe('briefing');
    expect(flow.advance()).toBe('flyover');
    expect(flow.advance()).toBe('ready');
    expect(flow.advance()).toBe('play');
    expect(flow.frozen).toBe(false);
  });

  it('starts a free run at ready and claims hints once per attempt', () => {
    const flow = new MissionFlow({
      tutorialPages: 0,
      briefing: false,
      flyover: false,
      readyMs: 100,
    });
    expect(flow.phase).toBe('ready');
    expect(flow.claimHint(2)).toBe(true);
    expect(flow.claimHint(2)).toBe(false);
    flow.reset();
    expect(flow.claimHint(2)).toBe(true);
  });
});
