# Our scores

Ten chiptune scores, one per episode of the videos about the game ([the OST](https://youtu.be/Lg_kdO6bmiw)),
played live by the game's
synthesiser (`packages/runtime/src/audio/LiveScore.ts`): the main menus play a random score's
opening and middle sections, softly; a run with a boss (a contest, or a boss played or watched)
loops another's energetic sections, every layer. The director picks a score at random, never
the same one twice in a row (`MusicDirector.ts`); a run started over keeps its score.

| File            | Title             |
| --------------- | ----------------- |
| `teaser.json`   | Teaser            |
| `idea.json`     | Idea              |
| `day1.json`     | MVP               |
| `day2.json`     | Improved Original |
| `day3.json`     | 12 Bosses         |
| `day4.json`     | Polish Pass       |
| `day5.json`     | They're Back      |
| `day6.json`     | Ship It!          |
| `speedrun.json` | Speedruns         |
| `finale.json`   | Finale            |

## The format

A score is the text format of `packages/runtime/src/audio/Score.ts` (patterns of notes and
drum lanes, sections that play patterns per track for a number of bars, `bpm`, `stepsPerBar`,
`drumKit`), with fields of its own:

- `patches`: GM program number → patch (`Instruments.ts`'s `Patch`: waves, envelope, and the
  fields the scores were written with: `lowpass`/`lowpassFrom`/`filterTime`/`q`, a pitch
  slide `pitchFrom`/`pitchTime`, `vibrato`, `noise`/`noiseOnly`). A program without a patch
  here gets the synthesiser's own.
- `layers`: every track's name in one of `base` (the motif alone), `more` and `max`; a plan
  that plays some layers only leaves the other tracks out. The game plays every layer.
- a track's `echo`: `{ delay, repeats, feedback, pingpong? }`, every note again `delay` steps
  later, `repeats` times, each `feedback` times softer (a repeat past the end of the pass is
  left out);
- a track's `fx` (`TrackEffects.ts`): `drive`, `filter` (with a `sweep` per section), `delay`
  (feedback or `pingpong`), `reverb`, `duck`, and `events` at places in sections: `tape`
  (slows to a stop), `flip` (the slice backwards), `stutter`, `fast` (double speed, an octave
  up) become notes; `mute` is a gain of the effects.

The sections are the modules a plan strings together: `intro`, `mid`, `build`, `peak` and
`fall`, each in variants `1` and `2` (`intro1`, `peak2`, …). A score with one variant of a
module names it without a number (`intro`), and the plans take it once. The menus play
`intro1 intro2 mid1 mid2`; a run with a boss loops `build1 peak1 fall1 build2 peak2 fall2`,
leaving out what a score lacks (`planFor` in `LiveScore.ts`).

## Adding or changing a score

1. Put the file here and its name into `LIVE_SCORES` (`MusicDirector.ts`); the test
   `packages/runtime/test/liveScore.test.ts` checks every score with `scoreProblems` and
   `liveScoreProblems` (every track in a layer, no two tracks on one channel, every plan
   non-empty, English only).
2. Measure its loudness: `npm run dev`, open `/dev/live.html`, **Measure all**, then **Save**
   writes `packages/content/audio/live-loudness.json` (one row per score and plan, and the
   synthesiser's fingerprint). The test `loudness.test.ts` fails until the table is current:
   any change to a score's patches, or to the synthesiser, needs a new measurement.
3. Listen on the same page (a button per score and plan): what it renders is what the game
   plays, one pass.
