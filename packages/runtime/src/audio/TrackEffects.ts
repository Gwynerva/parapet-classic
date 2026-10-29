/**
 * The tracks' own effects of a live score (`LiveScore.ts`) as Web Audio nodes, the real-time
 * counterpart of the video's renderer, which applied them to a track's samples. In order: mutes,
 * drive, filter (with sweeps across modules), delay, reverb, and last the duck, a sidechain-like
 * dip on the beat that pumps the whole track, its tails included.
 *
 * The delay and the reverb are linear and do not change in time, so they come out the same:
 * the delay is a feedback loop of delay nodes, the reverb a convolution with the impulse
 * response of the video's Freeverb (computed once per room). Tracks with the same room share
 * one convolver unless they duck. Mutes, sweeps and ducks follow the pass of the loop: the
 * player calls `schedule` with each pass's start.
 */
import type { PassSection, SongEffects, TrackFx } from './LiveScore.ts';

export interface SongEffectsGraph {
  /** The node a channel's notes go into (its track's effects), or null for none. */
  input(channel: number): AudioNode | null;
  /** Mutes, filter sweeps and ducks of a pass starting at audio time `start`. */
  schedule(start: number): void;
  /** Disconnects every node (the song is over). */
  dispose(): void;
}

/** Mutes fade in and out over this long, so they never click. */
const EDGE_S = 0.003;
/** The duck goes down in this long. */
const DUCK_DOWN_S = 0.004;
/** Points of the duck's recovery curve. */
const DUCK_POINTS = 16;
/** A drive's input range: a soft clipper's curve covers ±DRIVE_RANGE. */
const DRIVE_RANGE = 4;
/** Freeverb's comb and all-pass lengths at 44.1 kHz; the right channel's are 23 samples longer. */
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
/** The video's reverb took (left + right) × 0.015; a mono send takes (left + right) / 2. */
const REVERB_IN = 0.03;

const impulses = new Map<string, Float32Array[]>();

/** Freeverb's response to one sample of REVERB_IN, left and right, `seconds` long. */
export function reverbImpulse(
  size: number,
  damp: number,
  rate: number,
  seconds: number,
): Float32Array[] {
  const key = `${size}|${damp}|${rate}|${seconds}`;
  const known = impulses.get(key);
  if (known) return known;
  const scale = rate / 44100;
  const room = 0.7 + 0.28 * size;
  const d = 0.4 * damp;
  const len = Math.max(1, Math.round(seconds * rate));
  const out: Float32Array[] = [];
  for (let k = 0; k < 2; k++) {
    const wet = new Float32Array(len);
    for (const tuning of COMBS) {
      const n = Math.round((tuning + k * 23) * scale);
      const buf = new Float32Array(n);
      let pos = 0;
      let store = 0;
      for (let i = 0; i < len; i++) {
        const o = buf[pos]!;
        store = o * (1 - d) + store * d;
        buf[pos] = (i === 0 ? REVERB_IN : 0) + store * room;
        wet[i] = wet[i]! + o;
        if (++pos >= n) pos = 0;
      }
    }
    for (const tuning of ALLPASSES) {
      const n = Math.round((tuning + k * 23) * scale);
      const buf = new Float32Array(n);
      let pos = 0;
      for (let i = 0; i < len; i++) {
        const b = buf[pos]!;
        const x = wet[i]!;
        buf[pos] = x + b * 0.5;
        wet[i] = b - x;
        if (++pos >= n) pos = 0;
      }
    }
    // The tail is cut where the video's would have died away anyway: a short fade, no click.
    const fade = Math.round(len * 0.2);
    for (let i = 0; i < fade; i++) wet[len - 1 - i] = wet[len - 1 - i]! * (i / fade);
    out.push(wet);
  }
  impulses.set(key, out);
  return out;
}

/** tanh(x·a)/a: quiet passages keep their level, loud ones round off. */
function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2049;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * DRIVE_RANGE;
    curve[i] = Math.tanh(x * amount) / amount / DRIVE_RANGE;
  }
  return curve;
}

/** A gain that takes the average of left and right (a mono send). */
function monoGain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.channelCount = 1;
  g.channelCountMode = 'explicit';
  g.channelInterpretation = 'speakers';
  g.gain.value = value;
  return g;
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** Seconds the reverb rings (as the video reckoned its tails). */
function reverbSeconds(size: number): number {
  return 1 + 3 * size;
}

export function buildSongEffects(
  ctx: BaseAudioContext,
  effects: SongEffects,
  output: AudioNode,
): SongEffectsGraph {
  const nodes: AudioNode[] = [];
  const keep = <T extends AudioNode>(n: T): T => {
    nodes.push(n);
    return n;
  };
  const inputs = new Map<number, AudioNode>();
  const schedulers: ((start: number) => void)[] = [];
  const shared = new Map<string, AudioNode>();
  const { stepS, sections } = effects;
  const passS = sections.reduce((s, x) => Math.max(s, x.start + x.steps * stepS), 0);

  const reverbInput = (size: number, damp: number, to: AudioNode, own: boolean): AudioNode => {
    const key = `${size}|${damp}`;
    if (!own && shared.has(key)) return shared.get(key)!;
    const ir = reverbImpulse(size, damp, ctx.sampleRate, reverbSeconds(size));
    const buffer = ctx.createBuffer(2, ir[0]!.length, ctx.sampleRate);
    buffer.copyToChannel(ir[0]! as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(ir[1]! as Float32Array<ArrayBuffer>, 1);
    const conv = keep(ctx.createConvolver());
    conv.normalize = false;
    conv.buffer = buffer;
    const send = keep(monoGain(ctx, 1));
    send.connect(conv);
    conv.connect(to);
    if (!own) shared.set(key, send);
    return send;
  };

  for (const { channel, fx } of effects.tracks) {
    const input = keep(gain(ctx, 1));
    inputs.set(channel, input);
    let node: AudioNode = input;
    if (fx.drive) {
      const pre = keep(gain(ctx, 1 / DRIVE_RANGE));
      const shaper = keep(ctx.createWaveShaper());
      shaper.curve = driveCurve(fx.drive);
      node.connect(pre);
      pre.connect(shaper);
      node = shaper;
    }
    let filter: BiquadFilterNode | null = null;
    if (fx.filter) {
      filter = keep(ctx.createBiquadFilter());
      filter.type = fx.filter.type ?? 'lowpass';
      filter.Q.value = fx.filter.q ?? 0.707;
      filter.frequency.value = fx.filter.hz;
      node.connect(filter);
      node = filter;
    }
    const sum = keep(gain(ctx, 1));
    node.connect(sum);
    if (fx.delay) delay(ctx, keep, fx.delay, stepS, node, sum);
    const duck = keep(gain(ctx, 1));
    sum.connect(duck);
    duck.connect(output);
    if (fx.reverb) {
      const send = keep(gain(ctx, fx.reverb.mix * 3));
      sum.connect(send);
      const own = !!fx.duck;
      send.connect(
        reverbInput(fx.reverb.size ?? 0.7, fx.reverb.damp ?? 0.5, own ? duck : output, own),
      );
    }
    schedulers.push((start) => {
      mutes(input.gain, fx, sections, stepS, start);
      if (filter && fx.filter) sweeps(filter.frequency, fx.filter, sections, stepS, start);
      if (fx.duck) ducks(ctx, duck.gain, fx.duck, stepS, start, passS);
    });
  }

  return {
    input: (channel) => inputs.get(channel) ?? null,
    schedule: (start) => {
      for (const s of schedulers) s(start);
    },
    dispose: () => {
      for (const n of nodes) n.disconnect();
    },
  };
}

function delay(
  ctx: BaseAudioContext,
  keep: <T extends AudioNode>(n: T) => T,
  d: NonNullable<TrackFx['delay']>,
  stepS: number,
  from: AudioNode,
  to: AudioNode,
): void {
  const seconds = d.steps * stepS;
  const line = (): DelayNode => {
    const node = keep(ctx.createDelay(Math.max(1, seconds + 0.1)));
    node.delayTime.value = seconds;
    return node;
  };
  if (!d.pingpong) {
    const l = line();
    const fb = keep(gain(ctx, d.feedback));
    const mix = keep(gain(ctx, d.mix));
    from.connect(l);
    l.connect(fb);
    fb.connect(l);
    l.connect(mix);
    mix.connect(to);
    return;
  }
  // The left repeat feeds the right one and back: the echo crosses the stereo field.
  const mono = keep(monoGain(ctx, 1 - d.feedback));
  const left = line();
  const right = line();
  const toRight = keep(gain(ctx, d.feedback));
  const toLeft = keep(gain(ctx, d.feedback));
  const merge = keep(ctx.createChannelMerger(2));
  const mix = keep(gain(ctx, d.mix * 2));
  from.connect(mono);
  mono.connect(left);
  left.connect(toRight);
  toRight.connect(right);
  right.connect(toLeft);
  toLeft.connect(left);
  left.connect(merge, 0, 0);
  right.connect(merge, 0, 1);
  merge.connect(mix);
  mix.connect(to);
}

/** Each place in a module where the track falls silent. */
function mutes(
  g: AudioParam,
  fx: TrackFx,
  sections: PassSection[],
  stepS: number,
  start: number,
): void {
  const events = (fx.events ?? []).filter((e) => e.kind === 'mute');
  if (events.length === 0) return;
  g.cancelScheduledValues(start);
  g.setValueAtTime(1, start);
  const spans: [number, number][] = [];
  for (const e of events) {
    for (const s of sections) {
      if (s.name !== e.section) continue;
      const a = start + s.start + e.at * stepS;
      spans.push([a, a + e.steps * stepS]);
    }
  }
  spans.sort((x, y) => x[0] - y[0]);
  for (const [a, b] of spans) {
    g.setValueAtTime(1, a);
    g.linearRampToValueAtTime(0, a + EDGE_S);
    g.setValueAtTime(0, b);
    g.linearRampToValueAtTime(1, b + EDGE_S);
  }
}

/** The filter's cut-off: its own, or a module's sweep from one value to another. */
function sweeps(
  f: AudioParam,
  filter: NonNullable<TrackFx['filter']>,
  sections: PassSection[],
  stepS: number,
  start: number,
): void {
  f.cancelScheduledValues(start);
  for (const s of sections) {
    const a = start + s.start;
    const range = filter.sweep?.[s.name];
    if (range) {
      f.setValueAtTime(range[0], a);
      f.exponentialRampToValueAtTime(range[1], a + s.steps * stepS);
    } else {
      f.setValueAtTime(filter.hz, a);
    }
  }
}

/** Down in 4 ms every `every` steps, back up along a curve over `release`. */
function ducks(
  ctx: BaseAudioContext,
  g: AudioParam,
  duck: NonNullable<TrackFx['duck']>,
  stepS: number,
  start: number,
  passS: number,
): void {
  const period = duck.every * stepS;
  const release = Math.min(duck.release, period - DUCK_DOWN_S - 0.002);
  const curve = new Float32Array(DUCK_POINTS);
  for (let i = 0; i < DUCK_POINTS; i++) {
    curve[i] = 1 - duck.depth * (1 - i / (DUCK_POINTS - 1)) ** 2;
  }
  g.cancelScheduledValues(start);
  g.setValueAtTime(1, start);
  const now = ctx.currentTime;
  for (let at = start + (duck.offset ?? 0) * stepS; at < start + passS; at += period) {
    // A dip already over is left out (a pass resumed in its middle).
    if (at + DUCK_DOWN_S + release < now) continue;
    try {
      g.setValueAtTime(1, at);
      g.linearRampToValueAtTime(1 - duck.depth, at + DUCK_DOWN_S);
      g.setValueCurveAtTime(curve, at + DUCK_DOWN_S, release);
    } catch {
      // a curve over a moment already passed
    }
  }
}
