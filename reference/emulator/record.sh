#!/bin/bash
# Runs inside the image built from ./Dockerfile (started by run.mjs). It starts a virtual screen
# and MicroEmulator with the original jar, records the phone's 240 x 320 display (no cursor),
# and plays /work/session/plan.tsv: `wait <us>`, `press <key> <x> <y> <hold us>` and
# `align <frame us> <phase us>` lines, a press being a mouse click on the emulator's own (never
# recorded) keypad. The plan is a
# timeline: every wait and every hold is measured from the recording's start, not from the end
# of the previous command, so the time xdotool takes never adds up. Every press is logged with
# wall-clock times; the recorder logs the wall-clock time of its first frame, so run.mjs can
# light each key up on exactly the frames it was held.
set -u
S=/work/session
FPS=${FPS:-60}
Xvfb :99 -screen 0 320x700x24 -nolisten tcp >/dev/null 2>&1 &
export DISPLAY=:99
for _ in $(seq 100); do xdpyinfo >/dev/null 2>&1 && break; sleep 0.05; done

CP=$(ls /work/jars/*.jar | tr '\n' ':')/game/game.jar
# The agent that gives the game a phone's frame rate (see Pace.java), built against the ASM
# inside MicroEmulator.
mkdir -p /tmp/pace
javac -nowarn --release 8 -cp "$CP" -d /tmp/pace /emu/Pace.java 2> $S/pace.log
printf 'Premain-Class: Pace\n' > /tmp/pace/manifest.txt
(cd /tmp/pace && jar cfm /tmp/pace.jar manifest.txt Pace*.class)
# `S` is the original's MIDlet class: started directly, without the emulator's launcher.
java -javaagent:/tmp/pace.jar="${GAME_FRAME:-35}" -cp "$CP" org.microemu.app.Main --device org/microemu/device/large/device.xml S > $S/emulator.log 2>&1 &
for _ in $(seq 200); do xdotool search --name MicroEmulator >/dev/null 2>&1 && break; sleep 0.05; done
sleep "${BOOT:-2}"
xdotool mousemove 319 699

# The display of the "large" device sits at (26, 51) of its skin, which the window draws 21 px down.
ffmpeg -hide_banner -y -f x11grab -draw_mouse 0 -framerate "$FPS" -video_size 240x320 -i :99+26,72 \
  -c:v libx264 -preset veryfast -crf 6 -pix_fmt yuv444p $S/screen.mp4 2> $S/capture.log &
REC=$!
for _ in $(seq 200); do grep -q "start: " $S/capture.log && break; sleep 0.02; done

# Microseconds of wall-clock time ($EPOCHREALTIME without its point), and a sleep until one.
now() { local t=$EPOCHREALTIME; echo "${t/./}"; }
until_us() {
  local d=$(($1 - $(now)))
  ((d > 0)) && sleep "$((d / 1000000)).$(printf '%06d' $((d % 1000000)))"
}

: > $S/presses.tsv
T=$(now)
while IFS=$'\t' read -r op a b c d; do
  case "$op" in
    wait)
      T=$((T + a))
      until_us $T
      ;;
    align)
      # The next point `b` us past a tick of the game's frame grid (`a` us long, see Pace.java),
      # at least 5 ms ahead: the timeline from here on is in step with the game's frames.
      T=$(( ($(now) + 5000 - b + a - 1) / a * a + b ))
      until_us $T
      ;;
    press)
      xdotool mousemove "$b" "$c"
      until_us $T
      t0=$EPOCHREALTIME
      xdotool mousedown 1
      T=$((T + d))
      until_us $T
      xdotool mouseup 1
      t1=$EPOCHREALTIME
      xdotool mousemove 319 699
      printf '%s\t%s\t%s\n' "$a" "$t0" "$t1" >> $S/presses.tsv
      ;;
  esac
done < $S/plan.tsv

# ffmpeg stops on SIGINT with status 255: that is how a recording ends, not a failure.
kill -INT $REC
wait $REC || true
exit 0
