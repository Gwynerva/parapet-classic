// Composing a take: the phone painted at its scale, the recorded display laid into its screen,
// the pressed keys lit, an enlarged copy of the screen beside it if the layout has one, the
// picture fitted into a frame; then the edit: parts of the take, crossfades, speed and fades.
import { join } from 'node:path';
import { PHONE, SCREEN } from './phone.mjs';

const even = (n) => n + (n % 2); // H.264 wants even sizes (of whole numbers)

/** Where the phone and the enlarged screen go, the canvas, and how it fits into the frame. */
export function layoutOf(s) {
  const k = s.scale;
  const z = s.zoom;
  const b = s.border;
  const phone = s.layout === 'screen' ? null : { x: 0, y: 0, w: PHONE.w * k, h: PHONE.h * k };
  const big =
    s.layout === 'phone' ? null : { x: 0, y: 0, w: SCREEN.w * z + 2 * b, h: SCREEN.h * z + 2 * b };
  let w = (phone ?? big).w;
  let h = (phone ?? big).h;
  if (phone && big) {
    w = phone.w + s.gap + big.w;
    h = Math.max(phone.h, big.h);
    const right = s.screenSide === 'right';
    phone.x = right ? 0 : big.w + s.gap;
    big.x = right ? phone.w + s.gap : 0;
    phone.y = Math.round((h - phone.h) / 2);
    big.y = Math.round((h - big.h) / 2);
  }
  for (const r of [phone, big]) if (r) Object.assign(r, { x: r.x + s.pad, y: r.y + s.pad });
  const canvas = { w: even(w + 2 * s.pad), h: even(h + 2 * s.pad) };
  let place = { s: 1, x: 0, y: 0, w: canvas.w, h: canvas.h, frame: null };
  if (s.frame) {
    const [fw, fh] = s.frame.map(even);
    const fit = Math.min(1, fw / canvas.w, fh / canvas.h);
    const pw = even(Math.floor(canvas.w * fit));
    const ph = even(Math.floor(canvas.h * fit));
    place = { s: pw / canvas.w, x: (fw - pw) / 2, y: (fh - ph) / 2, w: pw, h: ph, frame: [fw, fh] };
  }
  return { phone, big, canvas, place };
}

/** The parts of the take kept, where each starts in the video, and the video's length. */
export function timelineOf(s, duration) {
  const parts = (s.cut ?? [[0, null]])
    .map(([a, b]) => [a, Math.min(b ?? duration, duration)])
    .filter(([a, b]) => b > a);
  if (!parts.length) throw `the cut keeps nothing of the ${duration.toFixed(2)} s take`;
  const xf = parts.length > 1 ? s.xfade : 0;
  let end = 0;
  const segs = parts.map(([from, to], i) => {
    const len = (to - from) / s.speed;
    if (parts.length > 1 && len <= xf) throw `the part ${from}-${to} is shorter than the crossfade`;
    const at = i === 0 ? 0 : end - xf;
    end = at + len;
    return { from, to, at, len };
  });
  return { segs, total: end, xf };
}

/** ffmpeg's arguments and the video's description. */
export function composition({ s, session, skin, presses, duration, out }) {
  const { phone, big, canvas, place } = layoutOf(s);
  const { segs, total, xf } = timelineOf(s, duration);
  const fps = s.fps;
  const args = [
    '-y',
    '-v',
    process.env.EMU_FFMPEG_LOG ?? 'error',
    '-i',
    join(session, 'screen.mp4'),
  ];
  let inputs = 1;
  const still = (file) => {
    args.push('-loop', '1', '-framerate', String(fps), '-i', file);
    return inputs++;
  };
  const f = [];
  let cur = 'c0';
  let n = 0;
  const step = (filter) => {
    const next = `c${++n}`;
    f.push(`[${cur}]${filter}[${next}]`);
    cur = next;
  };
  const over = (input, x, y, extra = '') => {
    const next = `c${++n}`;
    f.push(`[${cur}][${input}]overlay=${x}:${y}${extra}[${next}]`);
    cur = next;
  };

  f.push(`color=c=${s.bg}:s=${canvas.w}x${canvas.h}:r=${fps}[c0]`);
  const feeds = [phone && 'rp', big && 'rb'].filter(Boolean);
  f.push(
    `[0:v]fps=${fps},setsar=1${feeds.length > 1 ? ',split=2' : ''}${feeds.map((l) => `[${l}]`).join('')}`,
  );
  if (phone) {
    const k = s.scale;
    over(`${still(join(skin, 'phone.png'))}:v`, phone.x, phone.y);
    f.push(`[rp]scale=${SCREEN.w * k}:${SCREEN.h * k}:flags=neighbor[ps]`);
    over('ps', phone.x + SCREEN.x * k, phone.y + SCREEN.y * k);
    if (s.glass) over(`${still(join(skin, 'glass.png'))}:v`, phone.x, phone.y);
    if (s.keys && presses.length) {
      const used = [...new Set(presses.map((p) => p.key))];
      const copies = new Map();
      for (const key of used) {
        const count = presses.filter((p) => p.key === key).length;
        const idx = still(join(skin, `key-${key}.png`));
        const labels = Array.from({ length: count }, (_, j) => `k_${key}_${j}`);
        f.push(`[${idx}:v]split=${count}${labels.map((l) => `[${l}]`).join('')}`);
        copies.set(key, labels);
      }
      for (const p of presses) {
        const a = Math.max(0, p.from).toFixed(3);
        const b = (p.to + s.glowTail).toFixed(3);
        over(copies.get(p.key).shift(), phone.x, phone.y, `:enable='between(t,${a},${b})'`);
      }
    }
  }
  if (big) {
    const z = s.zoom;
    if (s.border)
      step(`drawbox=x=${big.x}:y=${big.y}:w=${big.w}:h=${big.h}:color=${s.borderColor}:t=fill`);
    f.push(`[rb]scale=${SCREEN.w * z}:${SCREEN.h * z}:flags=neighbor[bs]`);
    over('bs', big.x + s.border, big.y + s.border);
  }
  if (place.s < 1) step(`scale=${place.w}:${place.h}:flags=lanczos`);
  if (place.frame)
    step(`pad=${place.frame[0]}:${place.frame[1]}:${place.x}:${place.y}:color=${s.bg}`);

  // The edit, on the composed take: each part trimmed and retimed, then joined.
  const whole = segs.length === 1 && segs[0].from === 0 && segs[0].to >= duration && s.speed === 1;
  if (!whole) {
    const labels = segs.map((_, i) => `p${i}`);
    f.push(`[${cur}]split=${segs.length}${labels.map((l) => `[${l}i]`).join('')}`);
    segs.forEach((g, i) =>
      f.push(
        `[${labels[i]}i]trim=start=${g.from}:end=${g.to},setpts=(PTS-STARTPTS)/${s.speed},fps=${fps}[${labels[i]}]`,
      ),
    );
    cur = labels[0];
    for (let i = 1; i < segs.length; i++) {
      const next = `j${i}`;
      f.push(
        xf > 0
          ? `[${cur}][${labels[i]}]xfade=transition=fade:duration=${xf}:offset=${segs[i].at.toFixed(4)}[${next}]`
          : `[${cur}][${labels[i]}]concat=n=2:v=1:a=0[${next}]`,
      );
      cur = next;
    }
  }
  const fades = [];
  if (s.fadeIn) fades.push(`fade=in:st=0:d=${s.fadeIn}:color=${s.bg}`);
  if (s.fadeOut)
    fades.push(
      `fade=out:st=${Math.max(0, total - s.fadeOut).toFixed(4)}:d=${s.fadeOut}:color=${s.bg}`,
    );
  f.push(`[${cur}]${fades.length ? fades.join(',') : 'null'}[out]`);

  args.push(
    '-filter_complex',
    f.join(';'),
    '-map',
    '[out]',
    '-t',
    total.toFixed(3),
    '-r',
    String(fps),
  );
  args.push('-c:v', 'libx264', '-preset', s.preset, '-crf', String(s.crf));
  if (s.tune !== 'none') args.push('-tune', s.tune);
  args.push('-pix_fmt', s.pixFmt, '-movflags', '+faststart', '-an', out);

  // Positions in the video, and each press at the times it shows there (once per part it falls in).
  const rect = (r) =>
    r && {
      x: place.x + r.x * place.s,
      y: place.y + r.y * place.s,
      w: r.w * place.s,
      h: r.h * place.s,
    };
  const toVideo = (t) =>
    segs
      .filter((g) => t >= g.from && t <= g.to)
      .map((g) => +(g.at + (t - g.from) / s.speed).toFixed(3));
  const description = {
    video: {
      width: place.frame?.[0] ?? place.w,
      height: place.frame?.[1] ?? place.h,
      fps,
      duration: +total.toFixed(3),
    },
    layout: s.layout,
    phone: rect(phone),
    screen:
      phone &&
      rect({
        x: phone.x + SCREEN.x * s.scale,
        y: phone.y + SCREEN.y * s.scale,
        w: SCREEN.w * s.scale,
        h: SCREEN.h * s.scale,
      }),
    zoomed:
      big &&
      rect({
        x: big.x + s.border,
        y: big.y + s.border,
        w: SCREEN.w * s.zoom,
        h: SCREEN.h * s.zoom,
      }),
    parts: segs.map((g) => ({ from: g.from, to: +g.to.toFixed(3), at: +g.at.toFixed(3) })),
    speed: s.speed,
    presses: presses.flatMap((p) =>
      toVideo(p.from).map((from) => ({
        key: p.key,
        from,
        to: +(from + (p.to - p.from) / s.speed).toFixed(3),
      })),
    ),
  };
  return { args, description };
}
