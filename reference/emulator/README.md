# reference/emulator: the original on a phone, as footage

Records the **original** Playman Extreme Running jar running in a J2ME emulator and lays the
recording into a painted Nokia 6300, the kind of phone the game was made for (Series 40, a
240 × 320 screen). A short script of key presses drives the game; every key lights up on the
phone exactly while it is held, so the footage shows what was pressed and what it did. A script
can also play a route of the remake's TAS (`packages/tools/tas-out/`) on the jar, step for step.

It is for videos about the remake (the "this is how you had to play it" shots), not part of the
game or its tests.

## Requirements

- **Docker**: the emulator runs in a container with a virtual screen (`Dockerfile`: a JDK,
  Xvfb, xdotool, ffmpeg). The image is built on the first run, once.
- **Chrome or Edge**: paints the phone (`phone.mjs`, a canvas). Set `CHROME` if it is not in
  the usual place.
- **ffmpeg** on `PATH`: composes the video.
- **Network** on the first run: MicroEmulator 2.0.4 (LGPL) comes from Maven Central and is
  checked against Maven's SHA-1 files; the keypad's font (Exo 2) from Google Fonts. Both are
  cached in `build/` (ignored by git).

## Running

```bash
npm run emulator -- reference/emulator/scripts/mill-brook-sprint.txt
```

records a **take** of the script and composes it into `reference/emulator/out/mill-brook-sprint.mp4`,
with `mill-brook-sprint.json` beside it: the video's size and length, where the phone and the
screens are in the frame, the parts of the take it shows and when each key is held, in seconds
of the video (handy for cutting or for a voice-over). The example goes from the sound prompt
through the menus to the sprint on Mill Brook and plays the fastest route the remake's TAS
search found for it to the results screen: "Выполнено!", 0:28.02 (the route's 27.99 s plus one
frame, see Routes).

A take is kept per script in `build/sessions/<script>/`. `--reuse` composes it again with
other settings (another layout, size, cut, colour) without recording; it refuses when the
script or a take option changed since.

```bash
npm run emulator -- --help
```

prints every option with its default.

## Settings

Every option can be given in three places, each overriding the one before:

1. a JSON file passed with `--config <file>`: an object of options, names in kebab-case or
   camelCase (`{ "layout": "side", "fade-in": 0.5 }`); paths in it are relative to the file;
2. `set <option> <value>` lines in the script (paths relative to the repository), so a script
   can carry the look of its shot;
3. the command line: `--<option> <value>`, `--<option>=<value>`; booleans also as `--keys`
   and `--no-keys`.

| Option          | Default     | Meaning                                                                                                    |
| --------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| **The take**    |             | _changing these needs a new recording_                                                                     |
| `fps`           | `60`        | frames a second of the recording and of the video                                                          |
| `game-frame`    | `35`        | how long the game's frames last, ms (35 ≈ 28.6 a second, one physics step a frame; routes need 35)         |
| `boot`          | `2`         | seconds the emulator gets to start before recording (also the script command `boot <s>`)                   |
| `tail`          | `1.5`       | seconds recorded after the last command (also `tail <s>`)                                                  |
| **The picture** |             |                                                                                                            |
| `layout`        | `phone`     | `phone`: the phone alone; `side`: the phone with its screen enlarged beside it; `screen`: the screen alone |
| `scale`         | `3`         | pixels per pixel of the phone and of the game on its screen (1: a 335 × 825 phone)                         |
| `zoom`          | `3`         | pixels per game pixel of the enlarged screen (layouts `side` and `screen`)                                 |
| `screen-side`   | `right`     | where the enlarged screen stands in layout `side`: `right` or `left`                                       |
| `gap`           | `120`       | space between the phone and the enlarged screen                                                            |
| `border`        | `6`         | width of the frame around the enlarged screen (0: none)                                                    |
| `border-color`  | `#2a313b`   | colour of that frame                                                                                       |
| `pad`           | `48`        | space around the picture                                                                                   |
| `bg`            | `#0b0e13`   | the background                                                                                             |
| `frame`         | `none`      | put the picture in the middle of a frame of that size (`1920x1080`), made smaller only if it does not fit  |
| `glow`          | `#8fd3ff`   | the colour a pressed key lights up in                                                                      |
| `glow-tail`     | `0.08`      | seconds a key stays lit after its release, so that a tap shows                                             |
| `keys`          | `true`      | light up the pressed keys                                                                                  |
| `glass`         | `true`      | the reflection on the phone's glass                                                                        |
| **The edit**    |             |                                                                                                            |
| `cut`           | `none`      | the parts of the take to keep, in seconds of the take: `1.2-9.6,14.6-31,52.8-` (the last may stay open)    |
| `xfade`         | `0.4`       | crossfade between the parts, seconds (0: hard cuts)                                                        |
| `fade-in`       | `0`         | fade in from the background at the start, seconds                                                          |
| `fade-out`      | `0`         | fade out to the background at the end, seconds                                                             |
| `speed`         | `1`         | playback speed; `1.0254` (35 / 34.133) runs the game at the remake's pace, for side-by-side shots          |
| **The file**    |             |                                                                                                            |
| `out`           | `out/…mp4`  | the video; the `.json` goes beside it                                                                      |
| `crf`           | `14`        | x264 quality: lower is better and bigger, 0 is lossless                                                    |
| `preset`        | `slow`      | x264 speed against size, `ultrafast` … `veryslow`                                                          |
| `tune`          | `animation` | x264 tuning (`none`, `animation`, `film`, `grain`, `stillimage`); `animation` suits pixel art              |
| `pix-fmt`       | `yuv420p`   | `yuv420p` plays everywhere; `yuv444p` keeps colour edges sharp, for masters to edit                        |
| `reuse`         | `false`     | compose the script's last take again instead of recording anew                                             |

Screens are scaled by whole pixels without smoothing, so the original's pixels stay sharp; the
phone is painted at its `scale`, not stretched. With `frame`, pick a `scale` (and `zoom`) at
which the picture fits (`scale 1` for a 1080-pixel-high frame) to keep them sharp there too.

A shot for a FullHD page, the phone and its screen three times larger, cut and faded:

```json
{
  "layout": "side",
  "scale": 1,
  "zoom": 3,
  "pad": 0,
  "frame": "1920x1080",
  "glow": "#ffb000",
  "cut": "1.2-9.6,14.6-31,52.8-59",
  "fade-in": 0.5,
  "fade-out": 0.6
}
```

## Scripts

A text file, one command a line. A comment starts with `#` at the start of a line, or with
`# ` after a command (so that colours such as `#ffb000` are values, not comments).

| Command                           | Meaning                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `set <option> <value>`            | an option for this script (see Settings)                   |
| `boot <s>`                        | seconds the emulator gets to start before recording (2)    |
| `wait <s>`                        | do nothing for `s` seconds                                 |
| `press <key> [<hold>]`            | press a key, holding it `hold` seconds (0.15)              |
| `repeat <n> <every> <key>`        | `n` presses of `key`, one every `every` seconds            |
| `route <file> [arrows] [<shift>]` | the presses of a TAS route, timed from the press before it |
| `tail <s>`                        | keep recording `s` seconds after the last command (1.5)    |

Keys: `soft1`, `soft2` (the left and right soft keys), `select`, `up`, `down`, `left`,
`right`, `0`–`9`, `star`, `pound`. Aliases: `ok` and `fire` for `select`, `lsoft` and `rsoft`
for the soft keys.

A script is a timeline: each `wait` and each hold is counted from the start of the recording,
not from the end of the command before it, so the time the clicks take never adds up.

The game itself is the jar in `packages/content/playman/original/`, started directly as its
MIDlet (`S`), without the emulator's launcher; it is the Russian release, so the menus are in
Russian. Leave the game a moment for each screen to come up. The game reacts to presses only
(holding a key does nothing), and the runner runs by itself: keys start moves. It takes the
digits and the joystick alike: 2 8 4 6 are up, down, left and right, and 5, the joystick's
centre or the left soft key confirm (notes/08, key groups).

**Routes.** `route packages/tools/tas-out/0-sprint.json` plays that route's `presses`
(`step:key`, `U` `D` `L` `R` for up, down, left, right) on the jar, on the digits 2 8 4 6, the
way phones were mostly played (`arrows` plays them on the joystick). The press before the
`route` line is the one that starts the race (`5` on the flyover); the route's press for step
n goes n + 1 game frames after it, since the original reads that press one frame before the
race's step 0 (found by trying: started one frame earlier, the Mill Brook route runs into a
wall halfway). `shift` moves all the presses by that many more steps, for experiments. Routes
need `game-frame 35`: one physics step a frame.

The routes in `packages/tools/tas-out/` stay on the author's computer (the folder is ignored by
git, like the input of the bosses' records), so elsewhere the example stops at the `route` line:
give it a route file of your own, or write the race's presses by hand.

## How it works

1. `run.mjs` reads the settings (`options.mjs`) and the script (`script.mjs`), turns the script
   into a plan of waits and clicks and, unless a matching take is reused, starts the container
   with `record.sh`, `Pace.java`, the jars, the game and the session folder.
2. `record.sh` builds `Pace.java` into a Java agent and starts Xvfb and MicroEmulator (its
   "large" device, a 240 × 320 screen) with it. It records only the phone's display with ffmpeg
   (no cursor), and performs each press as a mouse click on the emulator's own keypad, which is
   never in the picture. It logs the wall-clock time of every press and release; ffmpeg logs
   the wall-clock time of its first frame.
3. **The agent** (`Pace.java`) gives the game a phone's pace. The game's loop never sleeps and
   counts time by the length of its frames (`frame ms × 900 >> 10`); on a virtual screen a
   frame takes under a millisecond, which rounds to nothing, and the race would never start
   ticking. The agent rewrites the game's class `d` as it loads (with the ASM that comes with
   MicroEmulator; the jar itself is not changed): once a frame the game waits for the next tick
   of a grid of `game-frame` milliseconds on the wall clock, and its clock reads the time of
   that tick. So every frame is exactly one frame long to the game, and `record.sh` knows when
   the frames begin: a route's presses are sent a quarter of a frame past a tick, each read by
   the frame it was meant for.
4. `phone.mjs` paints the phone, the reflection on its glass and the pressed look of every key
   at the chosen scale and glow, once (cached in `build/skin/`).
5. `compose.mjs` builds one ffmpeg pass: the display laid into the phone's screen, the glass
   over it, each pressed key over the phone from its press to its release (plus `glow-tail`),
   the enlarged screen beside it, the picture fitted into the frame; then the edit: the parts of
   the take trimmed, retimed by `speed`, joined with crossfades, faded in and out.
