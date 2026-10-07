/**
 * The synthesiser's instrument set: a small table of oscillator patches that stands in for the
 * 128 General MIDI programs, and a drum table for channel 10. The sound is deliberately
 * chip-like (plain waveforms, envelopes, a little detune) to sit with the pixel graphics; the
 * tables are data so a richer set can replace them without touching the player.
 */

export interface Patch {
  wave: OscillatorType;
  /** Second oscillator, slightly detuned, for width. */
  wave2?: OscillatorType;
  /** Detune of the second oscillator in cents. */
  detune?: number;
  /** Octave shift of the whole patch. */
  octave?: number;
  /** ADSR in seconds (sustain is a level 0..1). */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /** Output level 0..1. */
  gain: number;
  /** Low-pass cut-off in Hz, when the patch is filtered. */
  lowpass?: number;
}

export type DrumKind = 'kick' | 'snare' | 'hat' | 'openHat' | 'tom' | 'cymbal' | 'clap' | 'noise';

export interface DrumPatch {
  kind: DrumKind;
  /** Decay in seconds. */
  decay: number;
  /** Base frequency for pitched drums (kick, tom). */
  freq?: number;
  gain: number;
}

const FAMILIES: Patch[] = [
  // 0 piano
  {
    wave: 'triangle',
    wave2: 'square',
    detune: 4,
    attack: 0.005,
    decay: 0.6,
    sustain: 0.2,
    release: 0.15,
    gain: 0.5,
  },
  // 8 chromatic percussion
  {
    wave: 'sine',
    wave2: 'triangle',
    detune: 6,
    attack: 0.002,
    decay: 0.5,
    sustain: 0.05,
    release: 0.2,
    gain: 0.5,
  },
  // 16 organ
  {
    wave: 'square',
    wave2: 'sine',
    detune: 3,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.8,
    release: 0.08,
    gain: 0.3,
  },
  // 24 guitar
  {
    wave: 'sawtooth',
    attack: 0.004,
    decay: 0.5,
    sustain: 0.15,
    release: 0.12,
    gain: 0.35,
    lowpass: 2600,
  },
  // 32 bass
  {
    wave: 'triangle',
    wave2: 'square',
    detune: 2,
    octave: 0,
    attack: 0.005,
    decay: 0.35,
    sustain: 0.5,
    release: 0.1,
    gain: 0.6,
    lowpass: 1200,
  },
  // 40 strings
  {
    wave: 'sawtooth',
    wave2: 'sawtooth',
    detune: 9,
    attack: 0.12,
    decay: 0.3,
    sustain: 0.8,
    release: 0.3,
    gain: 0.25,
    lowpass: 3200,
  },
  // 48 ensemble
  {
    wave: 'sawtooth',
    wave2: 'sawtooth',
    detune: 12,
    attack: 0.15,
    decay: 0.3,
    sustain: 0.8,
    release: 0.35,
    gain: 0.22,
    lowpass: 3000,
  },
  // 56 brass
  {
    wave: 'sawtooth',
    wave2: 'square',
    detune: 5,
    attack: 0.03,
    decay: 0.2,
    sustain: 0.7,
    release: 0.12,
    gain: 0.3,
    lowpass: 3600,
  },
  // 64 reed
  {
    wave: 'square',
    wave2: 'sawtooth',
    detune: 4,
    attack: 0.02,
    decay: 0.2,
    sustain: 0.7,
    release: 0.1,
    gain: 0.28,
    lowpass: 2800,
  },
  // 72 pipe
  {
    wave: 'sine',
    wave2: 'triangle',
    detune: 3,
    attack: 0.03,
    decay: 0.2,
    sustain: 0.8,
    release: 0.12,
    gain: 0.35,
  },
  // 80 synth lead
  {
    wave: 'square',
    wave2: 'sawtooth',
    detune: 7,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.6,
    release: 0.1,
    gain: 0.3,
  },
  // 88 synth pad
  {
    wave: 'sawtooth',
    wave2: 'triangle',
    detune: 10,
    attack: 0.25,
    decay: 0.5,
    sustain: 0.7,
    release: 0.5,
    gain: 0.2,
    lowpass: 2200,
  },
  // 96 synth effects
  {
    wave: 'sine',
    wave2: 'sine',
    detune: 15,
    attack: 0.1,
    decay: 0.6,
    sustain: 0.3,
    release: 0.4,
    gain: 0.25,
  },
  // 104 ethnic
  {
    wave: 'triangle',
    wave2: 'sawtooth',
    detune: 4,
    attack: 0.004,
    decay: 0.4,
    sustain: 0.1,
    release: 0.15,
    gain: 0.35,
  },
  // 112 percussive
  {
    wave: 'square',
    attack: 0.002,
    decay: 0.15,
    sustain: 0.0,
    release: 0.08,
    gain: 0.3,
    lowpass: 2000,
  },
  // 120 sound effects
  {
    wave: 'sawtooth',
    attack: 0.01,
    decay: 0.3,
    sustain: 0.1,
    release: 0.2,
    gain: 0.15,
    lowpass: 1500,
  },
];

/** The patch of a GM program (0..127). Out-of-range programs get the piano. */
export function patchFor(program: number): Patch {
  const family = Math.floor(Math.max(0, Math.min(127, program)) / 8);
  return FAMILIES[family] ?? FAMILIES[0]!;
}

export const PATCH_COUNT = 128;

/** General MIDI percussion keys (channel 10). */
export function drumFor(note: number): DrumPatch {
  switch (note) {
    case 35:
    case 36:
      return { kind: 'kick', decay: 0.25, freq: 150, gain: 0.9 };
    case 37:
      return { kind: 'noise', decay: 0.06, gain: 0.4 }; // side stick
    case 38:
    case 40:
      return { kind: 'snare', decay: 0.18, gain: 0.6 };
    case 39:
      return { kind: 'clap', decay: 0.15, gain: 0.5 };
    case 41:
    case 43:
      return { kind: 'tom', decay: 0.3, freq: 90, gain: 0.6 };
    case 45:
    case 47:
      return { kind: 'tom', decay: 0.28, freq: 130, gain: 0.6 };
    case 48:
    case 50:
      return { kind: 'tom', decay: 0.25, freq: 180, gain: 0.55 };
    case 42:
    case 44:
      return { kind: 'hat', decay: 0.05, gain: 0.3 };
    case 46:
      return { kind: 'openHat', decay: 0.3, gain: 0.3 };
    case 49:
    case 57:
    case 52:
    case 55:
      return { kind: 'cymbal', decay: 0.8, gain: 0.35 };
    case 51:
    case 53:
    case 59:
      return { kind: 'cymbal', decay: 0.4, gain: 0.25 }; // ride
    case 54:
    case 56:
    case 58:
    case 69:
    case 70:
      return { kind: 'hat', decay: 0.08, gain: 0.3 }; // tambourine, cowbell, shakers
    default:
      return { kind: 'noise', decay: 0.1, gain: 0.3 };
  }
}
