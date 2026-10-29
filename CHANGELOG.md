# Changelog

Parapet Classic is a preservation project: the original game, playable in a browser, faithful in
every movement, with its workings documented in `reference/`. Improvements are welcome where they
make the game more comfortable to play and never where they would change how it plays.

## 1.2.0 (2026-10-29)

**Music of our own.** The ten chiptune scores written for the videos about the game
([the story of how it was made](https://www.youtube.com/watch?v=UPW5fNUvD14), [the TAS](https://youtu.be/c0hCbcx41Ds),
[the OST](https://youtu.be/Lg_kdO6bmiw)) play live
on the game's synthesiser (`packages/content/music`, `packages/runtime/src/audio/LiveScore.ts`),
the way the videos' music was made: synthesised, not recorded.

- A run with a boss (a contest, a boss played, a boss's replay watched) loops a random score's
  energetic sections (build-up, peak, wind-down, the A variants then the B ones), every layer:
  another score every run, the same one when the run is started over. Every other run keeps the
  original's track, the warm-ups the original's menu track and the Prize its own, as before.
- The main menus play a random score's opening and middle sections, every layer but softer,
  kept while the menus last.
- The tracks' effects run as Web Audio nodes (`TrackEffects.ts`): drive, filter sweeps across
  sections, feedback and ping-pong delays, a plate reverb as a convolution, ducks and mutes; the
  videos' tape stops, reversed slices, stutters and fast-forwards become notes. The synthesiser
  gained the patch fields the scores were written with (filter and pitch sweeps, vibrato,
  noise), a voice pool per channel and a route of a channel into its track's effects.
- `/dev/live.html` renders the scores as the game plays them, measures them and saves
  `packages/content/audio/live-loudness.json`, which a test checks like the original tracks'
  table; [`packages/content/music/README.md`](packages/content/music/README.md) tells how to
  write a score. The 0.x contest theme (`theme.json`) and its track are gone.

**The perfect run.** Is there a run of a contest no player and no machine can beat, and can it
be found? [`reference/notes/10-optimal.md`](reference/notes/10-optimal.md) works it out: one
exists, enumerating every state is out of reach (the distinct situations grow 1.2 times a
step), searching between flags to the end buys frames and not seconds, and the records are
close to the limit of their routes. On the way, three glitches of the original nobody had
found (the air run, the sky lift, through the floor and back), checked on the original classes
and on another build of the jar, and now in the curiosities.

- The tools: [`packages/tools/src/optimal`](packages/tools/src/optimal/README.md) (exact state
  rows, layer search with every state merged, segment search, beam search, a glitch hunt with
  human recipes) and `packages/tools/native`, a bit-exact C port of the step with a differential
  test against the TypeScript engine. The TAS search can be held to a flag order
  (`packages/tools/src/tas/orderSearch.ts`), and the simulation tells the search tools which
  input conditions a step read (`ConditionContext.inputReads`; the physics is unchanged, and so
  is the simulation's version).
- [`docs/tas-records`](docs/tas-records/README.md): the 24 machine records of the game (every
  level, Flag hunt and Sprint, 13:31.74 in all) with their inputs and a link to watch each one
  (and [the TAS video](https://youtu.be/c0hCbcx41Ds), all of them in one run);
  `npm test` re-runs them.
- The emulator plays another build of the jar (`jar`, `frame-method`) and opens every level
  (`unlock`); takes of the glitches, of the Moves menu, and of a record on the records' files.

**Replays.**

- Fixed: seeking back in a replay started the run over and picked the outfits of the runner
  and the boss again, and a boss's cloth (Max's bag, chains, capes) and effects flew far off its
  runner. A replay is the same run however it is started over, so it keeps its outfits, and
  the cloth is hung afresh where its runner is.
- The presses popping up over the timeline rise from where they happened on it instead of
  following the play head.
- A saved replay file carries a key of the run in its name
  (`parapet-l3-sprint-blaise-1k2x9q.parapet-replay`), so saving another run of the same level
  never overwrites an earlier file or gets a browser's "(1)".
- The version reads `Parapet 1.2.0 · sim 0.2.0`: the simulation is the same as in 1.0.0. The
  hint for opening a replay no longer names a key of one system.

**Smaller.** A runner attached in the middle of its run (a Moves demo, a replay restored
mid-run) shows its move instead of sliding along standing. The dev pages were tidied: the pages
left are the ones that make or check something the repository keeps, and the tools made for
the videos (the infographics, the offline music renderer) stay out. On the dev server
`?backdrop=1` shows the menus' backdrop alone, bright, for pictures; the reel takes `n=0` (no
attempts), `pace=live`, a `tag` for the file name and portrait sizes, and `PARAPET_FOOTAGE`
sends its videos elsewhere; the showcase zooms to 15× for 4K.

## 1.1.0 (2026-10-22)

**For speedruns.** What runners and the moderators of the speedrun.com board need, told in
[`docs/SPEEDRUN.md`](docs/SPEEDRUN.md):

- **Reset all data** (Options) replaces "Clear records": records, missions done and bosses
  beaten go, as on a first launch. The language, the controls and the player's name stay.
- **The full-game timer** (Options, hidden by default) adds up the game clock of every attempt,
  restarts and failures included. It stands still in the menus, briefings and pauses, survives
  a reload, splits per level against the best, and stops with the last mission (the credits
  show it). It shows at the top centre during a run.
- **A replay link opens a card**, and so does a replay file dropped onto the window or copied in
  the file manager and pasted (Ctrl+V), or a link or a code pasted: watch the run as its runner
  played it, or race it. Watching shows a bar like a video player's: the run's timeline with
  every press marked on it as a chevron pointing its way, a drag that takes the game along frame
  by frame, presses popping up as they play, speeds from ¼× to 4×, a pause, and steps of one
  frame forward and back.
- **Show pressed keys** (Options): each press flies out to the left of the full-game timer as a
  chevron pointing its way (down from the top centre while the timer is hidden), for run videos;
  the gap at the last split stands to the timer's right.
- The version (`Parapet 1.1.0 · parapet-sim@0.2.0`) stands on the results screen and in
  About → Credits.

**A calmer camera.** It no longer looks ahead of a jump upwards, and it follows the lower of the
runner's feet and hands. The original aimed almost two tiles above a tiger jump on flat ground
and sank back for over a second after the landing; now the same jump lifts it by 0.7 tile, with
no lurch. The camera never touches the run; the original's camera is kept for the traces and
the Lab.

## 1.0.0 (2026-10-14)

**The original, taken apart.** Fifteen findings about how Playman Extreme Running works, each a
page in [`reference/findings`](reference/findings) told for readers who never saw the code, with
animations (GIF, and MP4 at 60 frames a second) and charts, and the measured numbers, the
original's code lines and ours folded away under each: keys are pressed, never held; the wall
run is armed, not timed, and one press gives it two kicks (or one); the parkour is a table of
135 states; landing keeps the horizontal speed; the original's integer maths (a 16-sided
"circle" with steps in it); slow phones slow down, and fast screens a little; the runner and the
levels are vector drawings; the camera wants 98 pixels ahead and gets 60; the rivals are the
developers' own runs; four birds erased by checkpoint stamps; a score that never drops; what is
in the jar; what tricks cost.

- Every picture and number is computed by running the simulation on the original's data, and
  "what if" comparisons change the data, never the code: the new package
  [`packages/lab`](packages/lab) draws the experiments into frames and charts, and
  `npm run findings` measures everything again, redraws what changed (ffmpeg encodes the
  animations) and checks that each page still shows what it says; the tests do the same without
  ffmpeg.
- **The Lab** on the site (`lab/`): seven of the experiments to play with, in English and
  Russian: move the second UP of a vault or a wall run, switch the original's rules off and on,
  drop the runner from any height, try a phone's frame rate, pull the runner apart, follow the
  developers' runs with the camera's workings shown. "About the game" links it.
- The notes in `reference/notes` corrected where the findings proved them wrong (the ponytail is
  hidden for every character but Blaise; the checkpoint stamps hit birds, never a collision
  tile; one press gives two kicks only on contact; the sine table) and linked to the findings.

**The same pace on every screen.** The original cut each frame's game time to whole units and
so ran slower the more frames a second it drew; Parapet, fed the browser's frame times, ran at
95.6 % of the original's own pace on a 60 Hz screen and at 82 % on a 240 Hz one. The fraction is
now carried to the next frame, so the game keeps the original's own pace whatever the screen (the
cap that plays a slow device in slow motion stays). Records, replays and the bosses' times count
steps of the game and are unchanged.

**A new preview for challenge links.** A link to race a ghost now shows Vera vaulting over the
night roofs with her effect, and just ahead of her the hologram of Petra's run in mid-jump,
rimmed in dark so it reads even in a chat's small preview.

**Cleanup**, without changing how the game plays (the oracle's golden traces, the bosses'
records and every replay verify as before):

- Fixed: the multiplier meter's flash now fades and the multiplier bounces or shakes as in the
  original; the touch setting is no longer reset when a mission's options change; the shared
  scene renderer's culling box is always put back; replay codes accept one spelling only; a
  score with an empty drum lane can no longer hang the music; records are shown the same way
  everywhere; and smaller fixes in the dev pages and tools.
- Old compatibility layers removed: replay format 1 (links from before 0.3.0 no longer open),
  the profile migrations of earlier versions, the dev server's `?replay=` input logs, the looks'
  old `near` field and the hot-seat rules.
- Dead code and unused translations removed (`npm run i18n -- check` reports unused keys now),
  duplicated helpers merged into one of each, and the largest files split by concern.

**ROADMAP retired.** Everything it planned is done; its history is below and its architecture in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). The "bring your own jar" idea is dropped.

## 0.5.0 (2026-10-14): Bosses with style

- Every boss races a stylish run: the showiest found within 15 % of the fastest human run, with
  flips, wall flips, monkey vaults and spider jumps, never a stumble. No frame-perfect press in
  any record.
- What tricks cost, measured on every contest (`reference/notes/09-tas.md`).
- `/dev/reel.html`: 4K footage of a boss's record among hundreds of attempts gone wrong.
- Offline play: a service worker keeps every file the game needs.
- The mission menu, the bosses' rows, the level's news in its menu, results side by side on
  short wide screens, softer menu music, signs at the screen's edge for everything off screen.

## 0.4.0 (2026-10-13): Faces of their own

- Every boss redrawn from references of the hero it stands for; two new bosses (Petra Radko and
  her twin, Widow).
- Effects with a meaning for each boss; their briefings and wins checked against who they are.
- Effects as data, further (chances, chains of copies, delays, several animations per emitter).
- The README's banner, the link previews and a collage of the twelve bosses.

## 0.3.0 (2026-10-12): Hints and thumbs

- Glimpses of the bosses' routes by the player's next flag; bosses race 6.5 % slower than their
  found runs; boss rewards; levels open by completion.
- Rivals run as themselves; a pointer to the finish of a score run.
- Touch buttons for two thumbs; the camera keeps the runner above the touch buttons.
- Quieter music by default; race links in the query (`r/?<code>`).

## 0.2.0 (2026-10-08): The first release

- **The original, exactly.** The movement ported step for step, verified against the original
  class files (the Java oracle) and the twelve rival recordings; all twelve levels with every
  mission type, warm-ups with the coach, tutorials and hints, the Sprint flyover, the unlock
  progression, the Prize ending, the Moves menu, the music through a synthesiser of our own.
- **Static site and ghosts.** No server: replays as links or files, re-simulated by whoever
  opens them and raced as holograms ("echoes"). An earlier leaderboard server was retired (tag
  `snapshot/with-server`).
- **Bosses and languages.** Two contests per level against records found by a tool-assisted
  search under human limits; twelve bosses with their looks, effects, worlds and theme; English
  and Russian, one folder per language.
- **At home on phones.** A viewport that follows every change of size, full screen, the Back
  button, menus laid out for sizes from 240×320 to 960×540, every move shown on a little level.
- **Found and smooth.** Smooth movement on big screens; descriptions, link previews and a
  sitemap; anonymous visit counts (opt-in per deployment); challenge links of half the length.
