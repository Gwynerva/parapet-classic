# The TAS reel

`/dev/reel.html` on the dev server plays a boss's record the way a tool-assisted search finds
it: the boss runs its record through the real level while hundreds of pale attempts run with
it, branch off and go wrong. It is made for footage (a video about the bosses' records) and
records itself in 4K.

It reads the records' inputs from `packages/tools/tas-out/`, which stay on the machine that
searched them (git ignores the folder), so it works on the dev server only and never ships.

## What it shows

- **The record.** The boss of the level, in an outfit with its effect, plays the stored run of
  the level's Sprint (or Flag hunt) step by step through the game's own renderers: the level,
  its background, the flags, the camera.
- **The attempts.** Every pale runner is a real run of the simulation: the record's presses
  with one or two of them moved by up to 8 steps, dropped, turned into another key, or a press
  added. Only attempts that do worse than the record are kept: they crash, fall into a pit,
  take the next flag late, or have not taken it by the time the next wave sets off; and they
  stray from the record far enough to be seen. They are drawn as holograms in the boss's
  colour, see-through.
- **Waves.** At the start and at every flag a wave of attempts sets off from the record's very
  position and pose; the attempts run inside the record until their changed press, then peel
  away. A flag's wave sends the attempts before it away, fading one after another over about
  1.5 s. Between flags a smaller wave (half as many) sets off every 3 s, so a long stretch never
  runs out of attempts. One that crashes or falls lies there for a second, then fades.
- **Timing.** The record waits 1.2 s at the start, the scene fades in from black, and after the
  finish it stays 2.5 s before fading out.

The same parameters always give the same attempts (they are found from seeded random numbers).
Working them out takes a fraction of a second per level before it plays.

## Starting it

The level data must be extracted and the records searched (`npm run tas -- run`, see
[`packages/content/bosses`](../packages/content/bosses/README.md)). Then:

```bash
npm run dev
```

Open `http://localhost:5173/dev/reel.html`, which plays every level's Sprint one after another.
The canvas is 3840 × 2160 and fits the window, letterboxed. Some useful addresses:

| Address                                     | What it does                                       |
| ------------------------------------------- | -------------------------------------------------- |
| `/dev/reel.html?level=0`                    | Mill Brook only                                    |
| `/dev/reel.html?level=all&render=1`         | renders every level into a video, frame by frame   |
| `/dev/reel.html?run=style-15&render=1`      | the same with the stylish runs (`run --style 15`)  |
| `/dev/reel.html?level=all&record=1`         | records every level in real time, one video each   |
| `/dev/reel.html?level=4&hud=1`              | with the attempt count and the clock               |
| `/dev/reel.html?level=2&size=1920x1080`     | a Full HD canvas (scale 3)                         |
| `/dev/reel.html?level=7&mode=flags&plain=1` | Sand Cape's Flag hunt, the boss without its effect |

### Parameters

| Parameter | Default     | Meaning                                                                   |
| --------- | ----------- | ------------------------------------------------------------------------- |
| `level`   | `all`       | levels, 0-based as in the file names: `3`, `0,4,7` or `all`               |
| `mode`    | `sprint`    | `sprint` or `flags`                                                       |
| `run`     | `optimal`   | which stored run: the optimal one, or a stylish one (`style-05`, …)       |
| `size`    | `3840x2160` | the canvas in screen pixels, and of the videos                            |
| `scale`   | height/360  | screen pixels per game pixel (6 in 4K: the view is 640 × 360 game pixels) |
| `n`       | `80`        | attempts in a flag's wave (half as many between flags)                    |
| `hud`     | off         | `1` shows the attempt count and the record's clock                        |
| `render`  | off         | `1` renders every level into a video, frame by frame (below)              |
| `record`  | off         | `1` records every level in real time and saves it when it ends            |
| `mbps`    | 100 / 60    | bit rate of a render / of a real-time recording, in Mbit/s                |
| `outfit`  | `0`         | the boss's outfit                                                         |
| `plain`   | off         | `1` shows the boss without its effect                                     |

### Keys

| Key     | Action                                       |
| ------- | -------------------------------------------- |
| `Space` | pause                                        |
| `Enter` | the level again from its start               |
| `N`     | the next level of the list                   |
| `H`     | show or hide the attempt count and the clock |
| `R`     | start or stop recording                      |
| `F`     | full screen                                  |

A line at the bottom left says what the page is doing (the record's time and how many attempts
were found, recording, saving); it is not part of the canvas and fades after a few seconds.

## Recording

**Frame by frame (the best).** `render=1` does not play in real time: it moves the reel on by
exactly 1/60 s a frame and hands every frame to the browser's video encoder (WebCodecs), so no
frame is ever dropped, whatever else the computer does and whether the page is shown or not.
The encoder is the GPU's H.264 or HEVC where the browser offers it in that size, else the
browser's own H.264 (the desktop app's browser offers its GPU encoder up to 1080p only; its own
does 4K at about 30 frames a second, so a level renders in about twice its length). The stream
goes to the dev server in parts and ffmpeg muxes it into
`packages/tools/tas-out/reel/L01-sprint.mp4` (`L01-sprint-style-15.mp4` for a stylish run):
H.264 High, 60 frames a second, from the fade-in to the end of the fade-out. ffmpeg must be on
the dev server's `PATH`, or named by the `FFMPEG` environment variable. With `level=all` the
page renders the levels one after another and says when it is done.

**Built in, in real time.** `R`, or `record=1` for every level, records the canvas itself with the browser's
MediaRecorder: exactly the canvas size whatever the screen, 60 frames a second, H.264 in MP4
where the browser can (Chrome can), otherwise VP9 in WebM. A video ends with its level, after
the fade to black, and goes to the dev server, which writes it to
`packages/tools/tas-out/reel/L01-sprint.mp4` (`L12-flags.webm`…): with the runs, out of git.

**Screen recorder.** `F` makes the page full screen; record the screen with OBS or the like. For
4K this needs a 4K screen, or a canvas the size of the screen (`size=2560x1440`).

Either way the page plays in real time, so record with the computer otherwise idle: a TAS
search running in the background takes every core and makes frames drop. On a desktop a 4K
frame takes about 6 ms to draw.

### Sizes

The twelve Sprints play for about 8 minutes in all: each record (22 to 66 s) plus 3.7 s around
it.

| Recording                         | Twelve levels | One level     |
| --------------------------------- | ------------- | ------------- |
| rendered, 4K60 at 100 Mbit/s      | up to 6 GB    | up to 870 MB  |
| built in, 4K60 at 60 Mbit/s       | about 3.6 GB  | 190 to 520 MB |
| built in, 4K60 at 30 Mbit/s       | about 1.8 GB  | 100 to 260 MB |
| OBS, 4K60, high quality (CQP ~18) | 5 to 9 GB     | —             |

Pixel art with hundreds of moving holograms compresses poorly; below about 30 Mbit/s in 4K the
scanlines of the holograms start to smear.

## Keep in mind

- The reel shows the whole route of a record. The game ships only two seconds of it around each
  flag (the glimpses) and keeps the rest secret, so think before publishing footage of a record
  the players race against.
- It plays the records stored now: record the footage after the records are final (searched and
  published), or the video shows a route the game no longer races.
- The attempts are made up from the record, not taken from the search's history: the search
  tries routes from many places at once and never keeps whole failed runs. They are runs the
  record could have been, played honestly by the same simulation.
