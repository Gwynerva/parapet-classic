/**
 * Music written as text: a small tracker-like score (`content/bosses/theme.json`) turned into
 * the same `MidiSong` the original's MIDI files become, so it plays through the same
 * synthesiser and loudness normalisation.
 *
 * - The grid is `stepsPerBar` steps per bar (16: sixteenth notes), at `bpm` beats per minute
 *   of four steps.
 * - A melodic pattern is whitespace-separated tokens, one per step: a note (`D5`, `Eb2`,
 *   `C#4`; C4 is middle C), a chord (`D3+F3+A3`), `-` holding the previous note one more step,
 *   or `.` for silence. A note may end in `!` (accent) or `?` (ghost note).
 * - A drum pattern is a list of lanes, one character per step; a character other than `.`
 *   plays the key `drumKit` gives it.
 * - A section plays patterns per track for a number of bars; a track's pattern list repeats
 *   until the section is full. `name@+12` plays a pattern transposed.
 * - `song` lists the sections in order; the song loops at its end.
 */
import type { MidiNote, MidiSong } from './MidiFile.ts';

export interface ScoreTrack {
  /** MIDI channel 0..15; 9 is percussion. */
  channel: number;
  /** General MIDI program (melodic tracks). */
  program?: number;
  /** 0..1. */
  volume?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
  /** Fraction of a note's length that sounds (default 0.9). */
  gate?: number;
}

export interface ScoreSection {
  bars: number;
  /** Track name → pattern names, played one after another and repeated. */
  play: Record<string, string[]>;
}

export interface Score {
  title: string;
  bpm: number;
  stepsPerBar: number;
  tracks: Record<string, ScoreTrack>;
  /** Drum lane character → General MIDI percussion key. */
  drumKit: Record<string, number>;
  /** Melodic patterns are strings, drum patterns arrays of lanes. */
  patterns: Record<string, string | string[]>;
  sections: Record<string, ScoreSection>;
  song: string[];
}

const NOTE = /^([A-G])(#|b)?(-?\d)$/;
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const VELOCITY = 96;
const ACCENT = 120;
const GHOST = 60;

/** MIDI key of a note name (`C4` = 60), or null. */
export function noteNumber(name: string): number | null {
  const m = NOTE.exec(name);
  if (!m) return null;
  const key =
    (Number(m[3]) + 1) * 12 + SEMITONE[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return key >= 0 && key <= 127 ? key : null;
}

interface StepEvent {
  keys: number[];
  velocity: number;
}

type Step = StepEvent | 'hold' | 'rest';

function parseStep(token: string): Step | null {
  if (token === '-') return 'hold';
  if (token === '.') return 'rest';
  let velocity = VELOCITY;
  let body = token;
  if (body.endsWith('!')) {
    velocity = ACCENT;
    body = body.slice(0, -1);
  } else if (body.endsWith('?')) {
    velocity = GHOST;
    body = body.slice(0, -1);
  }
  const keys: number[] = [];
  for (const part of body.split('+')) {
    const key = noteNumber(part);
    if (key === null) return null;
    keys.push(key);
  }
  return { keys, velocity };
}

function splitRef(ref: string): { name: string; transpose: number } {
  const at = ref.indexOf('@');
  if (at < 0) return { name: ref, transpose: 0 };
  return { name: ref.slice(0, at), transpose: Number(ref.slice(at + 1)) || 0 };
}

/** What is wrong with a score, or an empty list. */
export function scoreProblems(score: Score): string[] {
  const out: string[] = [];
  if (!(score.bpm > 0)) out.push('bpm must be positive');
  if (!Number.isInteger(score.stepsPerBar) || score.stepsPerBar < 1)
    out.push('stepsPerBar must be a positive integer');
  for (const [name, pattern] of Object.entries(score.patterns)) {
    if (Array.isArray(pattern)) {
      for (const [i, lane] of pattern.entries()) {
        if (lane.length % score.stepsPerBar !== 0)
          out.push(`${name} lane ${i}: ${lane.length} steps, not whole bars`);
        for (const ch of lane) {
          if (ch !== '.' && score.drumKit[ch] === undefined)
            out.push(`${name} lane ${i}: "${ch}" is not in the drum kit`);
        }
      }
    } else {
      const tokens = pattern.trim().split(/\s+/);
      if (tokens.length % score.stepsPerBar !== 0)
        out.push(`${name}: ${tokens.length} steps, not whole bars`);
      for (const t of tokens) if (parseStep(t) === null) out.push(`${name}: bad step "${t}"`);
    }
  }
  for (const [name, section] of Object.entries(score.sections)) {
    for (const [track, refs] of Object.entries(section.play)) {
      if (!score.tracks[track]) out.push(`section ${name}: unknown track ${track}`);
      for (const ref of refs) {
        const { name: pattern } = splitRef(ref);
        const p = score.patterns[pattern];
        if (p === undefined) out.push(`section ${name}: unknown pattern ${pattern}`);
        else if (Array.isArray(p) !== (score.tracks[track]?.channel === 9)) {
          out.push(`section ${name}: ${pattern} does not suit track ${track}`);
        }
      }
    }
  }
  for (const name of score.song)
    if (!score.sections[name]) out.push(`song: unknown section ${name}`);
  return out;
}

/** Plays the score through once: every note with its start and length in ms. */
export function scoreToSong(score: Score): MidiSong {
  const stepMs = 60000 / score.bpm / 4;
  const notes: MidiNote[] = [];
  let bar = 0;
  for (const sectionName of score.song) {
    const section = score.sections[sectionName];
    if (!section) continue;
    const from = bar * score.stepsPerBar;
    const steps = section.bars * score.stepsPerBar;
    for (const [trackName, refs] of Object.entries(section.play)) {
      const track = score.tracks[trackName];
      if (!track || refs.length === 0) continue;
      const base = {
        channel: track.channel,
        program: track.program ?? 0,
        volume: track.volume ?? 1,
        pan: track.pan ?? 0,
      };
      if (track.channel === 9) {
        let s = 0;
        for (let r = 0; s < steps; r = (r + 1) % refs.length) {
          const lanes = score.patterns[splitRef(refs[r]!).name];
          if (!Array.isArray(lanes) || lanes.length === 0) break;
          const len = lanes[0]!.length;
          for (const lane of lanes) {
            for (let i = 0; i < lane.length && s + i < steps; i++) {
              const key = score.drumKit[lane[i]!];
              if (key === undefined) continue;
              notes.push({
                ...base,
                time: (from + s + i) * stepMs,
                duration: stepMs,
                note: key,
                velocity: VELOCITY,
              });
            }
          }
          s += len;
        }
        continue;
      }
      const gate = track.gate ?? 0.9;
      let open: { notes: MidiNote[]; steps: number } | null = null;
      const close = (): void => {
        if (!open) return;
        for (const n of open.notes) n.duration = open.steps * stepMs * gate;
        open = null;
      };
      let s = 0;
      for (let r = 0; s < steps; r = (r + 1) % refs.length) {
        const { name, transpose } = splitRef(refs[r]!);
        const pattern = score.patterns[name];
        if (typeof pattern !== 'string') break;
        const tokens = pattern.trim().split(/\s+/);
        for (const token of tokens) {
          if (s >= steps) break;
          const step = parseStep(token);
          if (step === 'hold') {
            if (open) open.steps++;
          } else {
            close();
            if (step && step !== 'rest') {
              const started = step.keys.map((key) => ({
                ...base,
                time: (from + s) * stepMs,
                duration: stepMs,
                note: Math.max(0, Math.min(127, key + transpose)),
                velocity: step.velocity,
              }));
              notes.push(...started);
              open = { notes: started, steps: 1 };
            }
          }
          s++;
        }
      }
      close();
    }
    bar += section.bars;
  }
  notes.sort((a, b) => a.time - b.time || a.channel - b.channel);
  return {
    durationMs: bar * score.stepsPerBar * stepMs,
    ticksPerBeat: 4,
    notes,
    unknownEvents: 0,
  };
}
