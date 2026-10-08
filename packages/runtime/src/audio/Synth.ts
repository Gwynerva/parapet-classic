/**
 * A small polyphonic Web Audio synthesiser driven by resolved MIDI notes: every note becomes
 * one or two oscillators (or a noise burst for drums) with an envelope, scheduled at an
 * absolute audio-context time. There is no per-sample processing, so hundreds of short notes
 * cost nothing noticeable. Each MIDI channel ends in a gain of its own that follows the song's
 * channel volume changes, so a held chord swells and fades as written.
 */
import { drumFor, patchFor, type DrumPatch, type Patch } from './Instruments.ts';
import { DEFAULT_CHANNEL_VOLUME, type MidiControl, type MidiNote } from './MidiFile.ts';

export const MAX_VOICES = 32;
const MIN_GAIN = 0.0005;
/** Time constant (s) of a channel volume change: smooth, but as quick as the controller. */
const CONTROL_SMOOTHING = 0.012;
/**
 * Bump when the synthesiser's sound changes (patches, envelopes, channel handling): the
 * measured loudness of the tracks (`content/audio/loudness.json`) must then be measured again.
 */
export const SYNTH_VERSION = 2;

interface Voice {
  /** Audio time the voice is silent again. */
  until: number;
  sources: AudioScheduledSourceNode[];
}

export class Synth {
  private readonly ctx: BaseAudioContext;
  private readonly output: AudioNode;
  private readonly voices: Voice[] = [];
  private noise: AudioBuffer | null = null;
  /** One gain per MIDI channel, made on first use. */
  private readonly channels: (GainNode | null)[] = new Array<GainNode | null>(16).fill(null);
  /**
   * The song drives the channel volumes (`controlAt`): a note's own `volume` is then not
   * applied again. Songs without controller changes play each note at its `volume`.
   */
  channelVolumes = false;

  constructor(ctx: BaseAudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
  }

  private channel(index: number): GainNode {
    let gain = this.channels[index & 15];
    if (!gain) {
      gain = this.ctx.createGain();
      gain.gain.value = this.channelVolumes ? DEFAULT_CHANNEL_VOLUME : 1;
      gain.connect(this.output);
      this.channels[index & 15] = gain;
    }
    return gain;
  }

  /** A channel volume change at audio time `when`. */
  controlAt(control: MidiControl, when: number): void {
    if (!this.channelVolumes) return;
    const gain = this.channel(control.channel).gain;
    gain.setTargetAtTime(control.volume, when, CONTROL_SMOOTHING);
  }

  /** Every channel back to the default volume at audio time `when` (a song starts again). */
  resetChannels(when: number): void {
    if (!this.channelVolumes) return;
    for (const gain of this.channels) gain?.gain.setValueAtTime(DEFAULT_CHANNEL_VOLUME, when);
  }

  /** Number of voices still sounding at audio time `at`. */
  activeVoices(at: number): number {
    this.prune(at);
    return this.voices.length;
  }

  /** Schedule a note at audio time `when` (seconds). Drops the note when the polyphony is full. */
  noteAt(note: MidiNote, when: number): void {
    this.prune(when);
    if (this.voices.length >= MAX_VOICES) return;
    if (note.channel === 9) this.drumAt(note, when, drumFor(note.note));
    else this.toneAt(note, when, patchFor(note.program));
  }

  /** Stop every scheduled voice at audio time `when`. */
  silence(when: number): void {
    for (const v of this.voices) {
      for (const s of v.sources) {
        try {
          s.stop(when);
        } catch {
          // already stopped
        }
      }
    }
    this.voices.length = 0;
  }

  private prune(at: number): void {
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (this.voices[i]!.until <= at) this.voices.splice(i, 1);
    }
  }

  private panned(
    pan: number,
    level: number,
    channel: number,
  ): { input: AudioNode; gain: GainNode } {
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    let tail: AudioNode = gain;
    if (pan !== 0 && 'createStereoPanner' in this.ctx) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      tail = panner;
    }
    tail.connect(this.channel(channel));
    return { input: gain, gain };
  }

  /** The note's own volume, unless the channel gain already carries it. */
  private noteVolume(note: MidiNote): number {
    return this.channelVolumes ? 1 : note.volume;
  }

  private toneAt(note: MidiNote, when: number, patch: Patch): void {
    const level = (note.velocity / 127) * this.noteVolume(note) * patch.gain;
    if (level <= MIN_GAIN) return;
    const { input, gain } = this.panned(note.pan, 1, note.channel);
    const seconds = note.duration / 1000;
    const freq = 440 * Math.pow(2, (note.note - 69) / 12 + (patch.octave ?? 0));
    const env = gain.gain;
    const peak = level;
    const sustain = Math.max(MIN_GAIN, level * patch.sustain);
    const attackEnd = when + patch.attack;
    const decayEnd = attackEnd + patch.decay;
    const noteEnd = when + Math.max(seconds, patch.attack + 0.01);
    env.setValueAtTime(MIN_GAIN, when);
    env.linearRampToValueAtTime(peak, attackEnd);
    env.setTargetAtTime(sustain, attackEnd, Math.max(0.005, patch.decay / 3));
    env.setValueAtTime(decayEnd < noteEnd ? sustain : sustain, noteEnd);
    env.setTargetAtTime(MIN_GAIN, noteEnd, Math.max(0.01, patch.release / 3));
    const stopAt = noteEnd + patch.release + 0.1;

    let target: AudioNode = input;
    if (patch.lowpass) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = patch.lowpass;
      filter.connect(input);
      target = filter;
    }
    const sources: AudioScheduledSourceNode[] = [];
    const osc = this.ctx.createOscillator();
    osc.type = patch.wave;
    osc.frequency.value = freq;
    osc.connect(target);
    osc.start(when);
    osc.stop(stopAt);
    sources.push(osc);
    if (patch.wave2) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = patch.wave2;
      osc2.frequency.value = freq;
      osc2.detune.value = patch.detune ?? 0;
      const mix = this.ctx.createGain();
      mix.gain.value = 0.5;
      osc2.connect(mix);
      mix.connect(target);
      osc2.start(when);
      osc2.stop(stopAt);
      sources.push(osc2);
    }
    this.voices.push({ until: stopAt, sources });
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const length = Math.floor(this.ctx.sampleRate);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x2545f491;
    for (let i = 0; i < length; i++) {
      // xorshift noise: deterministic, no Math.random.
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
    }
    this.noise = buffer;
    return buffer;
  }

  private drumAt(note: MidiNote, when: number, drum: DrumPatch): void {
    const level = (note.velocity / 127) * this.noteVolume(note) * drum.gain;
    if (level <= MIN_GAIN) return;
    const { input, gain } = this.panned(note.pan, 1, note.channel);
    const env = gain.gain;
    env.setValueAtTime(level, when);
    env.setTargetAtTime(MIN_GAIN, when, Math.max(0.01, drum.decay / 4));
    const stopAt = when + drum.decay + 0.1;
    const sources: AudioScheduledSourceNode[] = [];

    if (drum.kind === 'kick' || drum.kind === 'tom') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const base = drum.freq ?? 120;
      osc.frequency.setValueAtTime(base, when);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, base * (drum.kind === 'kick' ? 0.3 : 0.6)),
        when + 0.12,
      );
      osc.connect(input);
      osc.start(when);
      osc.stop(stopAt);
      sources.push(osc);
    }
    if (drum.kind !== 'kick' && drum.kind !== 'tom') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      let target: AudioNode = input;
      if (drum.kind === 'hat' || drum.kind === 'openHat' || drum.kind === 'cymbal') {
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = drum.kind === 'cymbal' ? 3500 : 6500;
        hp.connect(input);
        target = hp;
      } else if (drum.kind === 'snare') {
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        bp.Q.value = 0.7;
        bp.connect(input);
        target = bp;
      }
      src.connect(target);
      src.start(when);
      src.stop(stopAt);
      sources.push(src);
      if (drum.kind === 'snare') {
        const body = this.ctx.createOscillator();
        body.type = 'triangle';
        body.frequency.setValueAtTime(190, when);
        body.frequency.exponentialRampToValueAtTime(120, when + 0.08);
        const bodyGain = this.ctx.createGain();
        bodyGain.gain.value = 0.5;
        body.connect(bodyGain);
        bodyGain.connect(input);
        body.start(when);
        body.stop(when + 0.12);
        sources.push(body);
      }
    }
    this.voices.push({ until: stopAt, sources });
  }
}
