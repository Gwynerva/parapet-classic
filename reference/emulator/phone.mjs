// A Nokia 6300 (2007, Series 40, a 240 x 320 screen: the phones this game was made for), painted
// procedurally on a canvas at any size: brushed steel, a glossy black front in a chrome rim, a
// mirror-chrome navigation key, satin keys with blue print. Units are the game's screen pixels
// (the screen is exactly 240 x 320 units), so an integer scale keeps the original's pixels sharp;
// at scale 4 the phone is 1340 x 3300 pixels.
//
// RENDERER is the source of the drawing functions, evaluated in a browser page (chrome.mjs):
//   drawPhone(ctx, k)            the phone, transparent around it, the screen left dark
//   drawGlass(ctx, k)            the reflection on the screen's glass, laid over the video
//   drawPressed(ctx, k, key, c)  only the pressed look of one key (pushed in, lit in colour c)

export const PHONE = { w: 335, h: 825 };
export const SCREEN = { x: 48, y: 106, w: 240, h: 320 };

/** The pressable keys (MicroEmulator's names), with aliases a script may use. */
export const KEY_NAMES = [
  'soft1',
  'soft2',
  'select',
  'up',
  'down',
  'left',
  'right',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'star',
  '0',
  'pound',
];
export const KEY_ALIASES = {
  ok: 'select',
  fire: 'select',
  lsoft: 'soft1',
  rsoft: 'soft2',
  '*': 'star',
  '#': 'pound',
};

/** Fonts the page loads before drawing (Google Fonts), with local fallbacks in the code. */
export const FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@500;600&display=block';

export const RENDERER = String.raw`
const W = 335, H = 825;
const SCR = { x: 48, y: 106, w: 240, h: 320 };
const PANEL = { x: 23, y: 13, w: 289, h: 551, rt: 27, rb: 23 };
const NAV = { cx: 167.5, cy: 507, outer: 48, ring: 40, gap: 28, center: 26 };
const SOFT = {
  soft1: { x: 42, y: 463, w: 53, h: 28, dash: '#46b4f0' },
  soft2: { x: 240, y: 463, w: 53, h: 28, dash: '#46b4f0' },
  call: { x: 42, y: 523, w: 53, h: 28, dash: '#33c463' },
  end: { x: 240, y: 523, w: 53, h: 28, dash: '#ee3b30' },
};
const PAD = { x: 30, y: 594, w: 275, h: 186, cols: 3, rows: 4 };
const LABELS = [
  ['1', 'vm', 'L'], ['2', 'abc', 'C'], ['3', 'def', 'R'],
  ['4', 'ghi', 'L'], ['5', 'jkl', 'C'], ['6', 'mno', 'R'],
  ['7', 'pqrs', 'L'], ['8', 'tuv', 'C'], ['9', 'wxyz', 'R'],
  ['*', '+', 'L'], ['0', 'space', 'C'], ['#', 'note', 'R'],
];
const KEYCELL = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, star: 9, 0: 10, pound: 11 };
const INK = '#21469b';
const DIGIT_FONT = '600 18px "Exo 2", "Segoe UI", "Trebuchet MS", sans-serif';
const LETTER_FONT = '500 13px "Exo 2", "Segoe UI", "Trebuchet MS", sans-serif';

function rr(c, x, y, w, h, r) {
  const t = typeof r === 'number' ? [r, r, r, r] : r;
  c.beginPath();
  c.moveTo(x + t[0], y);
  c.lineTo(x + w - t[1], y); c.quadraticCurveTo(x + w, y, x + w, y + t[1]);
  c.lineTo(x + w, y + h - t[2]); c.quadraticCurveTo(x + w, y + h, x + w - t[2], y + h);
  c.lineTo(x + t[3], y + h); c.quadraticCurveTo(x, y + h, x, y + h - t[3]);
  c.lineTo(x, y + t[0]); c.quadraticCurveTo(x, y, x + t[0], y);
  c.closePath();
}

function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

let seed = 1;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

/** Fine vertical brushing: long faint streaks of light and dark, scale-independent. */
function brushed(c, k, x, y, w, h, alpha) {
  const off = document.createElement('canvas');
  off.width = Math.ceil(w * k); off.height = Math.ceil(h * k);
  const o = off.getContext('2d');
  const img = o.createImageData(off.width, off.height);
  seed = 7;
  const cols = new Float32Array(off.width);
  for (let i = 0; i < off.width; i++) cols[i] = rnd() * 2 - 1;
  for (let i = 1; i < off.width; i++) cols[i] = cols[i] * 0.55 + cols[i - 1] * 0.45;
  for (let yy = 0; yy < off.height; yy++) {
    for (let xx = 0; xx < off.width; xx++) {
      const v = cols[xx] * 0.8 + (rnd() * 2 - 1) * 0.35;
      const p = (yy * off.width + xx) * 4;
      const l = v > 0 ? 255 : 0;
      img.data[p] = l; img.data[p + 1] = l; img.data[p + 2] = l;
      img.data[p + 3] = Math.min(255, Math.abs(v) * 255 * alpha);
    }
  }
  o.putImageData(img, 0, 0);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.drawImage(off, Math.round(x * k), Math.round(y * k));
  c.restore();
}

function chrome(c, x0, y0, x1, y1) {
  return lin(c, x0, y0, x1, y1, [[0, '#ffffff'], [0.18, '#a9afb6'], [0.36, '#f4f6f8'], [0.5, '#5f656d'],
    [0.62, '#dfe3e7'], [0.8, '#7d838b'], [1, '#f2f4f6']]);
}

function body(c, k) {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 22 * k; c.shadowOffsetY = 9 * k;
  rr(c, 4, 4, W - 8, H - 8, 46);
  c.fillStyle = '#9ba1a8'; c.fill();
  c.restore();
  // the steel: lit from the upper left, darker towards the sides
  rr(c, 4, 4, W - 8, H - 8, 46);
  c.fillStyle = lin(c, 4, 0, W - 4, 0, [[0, '#7c828a'], [0.035, '#c9cdd2'], [0.12, '#eceef1'], [0.42, '#f6f7f9'],
    [0.6, '#dde1e5'], [0.86, '#e9ecef'], [0.965, '#b4bac1'], [1, '#6d737b']]);
  c.fill();
  rr(c, 4, 4, W - 8, H - 8, 46);
  c.fillStyle = lin(c, 0, 4, 0, H - 4, [[0, 'rgba(255,255,255,0.35)'], [0.08, 'rgba(255,255,255,0)'],
    [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.18)']]);
  c.fill();
  brushed(c, k, 4, 4, W - 8, H - 8, 0.07);
  // the rim: a bright edge and a thin dark line around it
  rr(c, 5, 5, W - 10, H - 10, 45);
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();
  rr(c, 4, 4, W - 8, H - 8, 46);
  c.lineWidth = 1; c.strokeStyle = 'rgba(40,44,50,0.75)'; c.stroke();
  // the raised front plate: a soft step where the frame meets it
  rr(c, 13, 5, W - 26, H - 12, 40);
  c.lineWidth = 1.2; c.strokeStyle = 'rgba(80,86,94,0.35)'; c.stroke();
  rr(c, 14.5, 6.5, W - 29, H - 15, 39);
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
}

function panel(c, k) {
  const p = PANEL, r = [p.rt, p.rt, p.rb, p.rb];
  // the chrome bezel around the black front
  rr(c, p.x - 4.5, p.y - 4.5, p.w + 9, p.h + 9, [p.rt + 4, p.rt + 4, p.rb + 4, p.rb + 4]);
  c.fillStyle = chrome(c, p.x - 5, p.y - 5, p.x + p.w + 5, p.y + p.h + 5); c.fill();
  rr(c, p.x - 1.4, p.y - 1.4, p.w + 2.8, p.h + 2.8, [p.rt + 1, p.rt + 1, p.rb + 1, p.rb + 1]);
  c.fillStyle = '#1c1e22'; c.fill();
  rr(c, p.x, p.y, p.w, p.h, r);
  c.fillStyle = lin(c, 0, p.y, 0, p.y + p.h, [[0, '#17191c'], [0.3, '#0a0b0d'], [0.75, '#060708'], [1, '#121417']]);
  c.fill();
  // gloss: a broad soft reflection from the upper left
  c.save();
  rr(c, p.x, p.y, p.w, p.h, r); c.clip();
  c.fillStyle = lin(c, p.x, p.y, p.x + p.w * 0.9, p.y + p.h * 0.55, [[0, 'rgba(255,255,255,0.13)'], [0.42, 'rgba(255,255,255,0.035)'], [0.43, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
  c.fillRect(p.x, p.y, p.w, p.h);
  c.fillStyle = lin(c, 0, p.y, 0, p.y + 6, [[0, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  c.fillRect(p.x, p.y, p.w, 6);
  c.restore();
}

function earpiece(c, k) {
  const x = 167.5 - 39, y = 36, w = 78, h = 11;
  rr(c, x - 1.5, y - 1.5, w + 3, h + 3, 7);
  c.fillStyle = chrome(c, x, y - 2, x, y + h + 2); c.fill();
  rr(c, x, y, w, h, 5.5); c.fillStyle = '#101113'; c.fill();
  c.save(); rr(c, x, y, w, h, 5.5); c.clip();
  c.fillStyle = '#6b7178';
  for (let yy = y + 1.6; yy < y + h; yy += 2.2) for (let xx = x + 2 + ((yy * 10) % 2 ? 1.1 : 0); xx < x + w - 1; xx += 2.2) {
    c.beginPath(); c.arc(xx, yy, 0.62, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, 'rgba(0,0,0,0.55)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(255,255,255,0.12)']]);
  c.fillRect(x, y, w, h);
  c.restore();
}

function logo(c, k) {
  c.save();
  c.translate(167.5, 89);
  c.scale(1.22, 1);
  c.font = '900 19px "Arial Black", "Arial", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  if (c.letterSpacing !== undefined) c.letterSpacing = '0.6px';
  c.fillStyle = 'rgba(0,0,0,0.9)'; c.fillText('NOKIA', 0, 1.2);
  c.fillStyle = lin(c, 0, -15, 0, 0, [[0, '#ffffff'], [0.45, '#c6ccd2'], [0.55, '#9ca3aa'], [1, '#eef1f4']]);
  c.fillText('NOKIA', 0, 0);
  c.restore();
}

function screen(c, k) {
  rr(c, SCR.x - 4, SCR.y - 4, SCR.w + 8, SCR.h + 8, 3);
  c.fillStyle = '#000'; c.fill();
  c.fillStyle = '#0b0d10'; c.fillRect(SCR.x, SCR.y, SCR.w, SCR.h);
}

function softkey(c, k, s, lit) {
  c.save();
  rr(c, s.x - 1.2, s.y - 1.2, s.w + 2.4, s.h + 2.4, 10.5);
  c.fillStyle = lin(c, 0, s.y, 0, s.y + s.h, [[0, '#4a4f56'], [1, '#202327']]); c.fill();
  rr(c, s.x, s.y, s.w, s.h, 9.5);
  c.fillStyle = lin(c, 0, s.y, 0, s.y + s.h, [[0, '#2b2e33'], [0.5, '#121417'], [1, '#08090a']]); c.fill();
  rr(c, s.x + 2, s.y + 1.2, s.w - 4, s.h * 0.45, [8, 8, 4, 4]);
  c.fillStyle = lin(c, 0, s.y, 0, s.y + s.h * 0.45, [[0, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0.02)']]); c.fill();
  const dw = 13, dh = 3.6, dx = s.x + s.w / 2 - dw / 2, dy = s.y + s.h / 2 - dh / 2;
  c.shadowColor = s.dash; c.shadowBlur = (lit ? 7 : 3) * k;
  rr(c, dx, dy, dw, dh, 1.8); c.fillStyle = s.dash; c.fill();
  c.shadowBlur = 0;
  rr(c, dx + 1, dy + 0.4, dw - 2, 1.2, 0.6); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
  c.restore();
}

function navkey(c, k) {
  const { cx, cy, outer, ring, gap, center } = NAV;
  c.save();
  // the outer chrome bezel, a rounded square, with a dark seat around it
  rr(c, cx - outer - 2, cy - outer - 2, (outer + 2) * 2, (outer + 2) * 2, 25);
  c.fillStyle = '#000'; c.fill();
  rr(c, cx - outer, cy - outer, outer * 2, outer * 2, 23);
  c.fillStyle = lin(c, cx - outer, cy - outer, cx + outer, cy + outer, [[0, '#ffffff'], [0.22, '#c3c8ce'], [0.42, '#5e646c'],
    [0.5, '#f7f8fa'], [0.62, '#9ca2a9'], [0.8, '#41464d'], [1, '#d9dde2']]);
  c.fill();
  // the inner slope of the bezel, lit the other way
  rr(c, cx - ring, cy - ring, ring * 2, ring * 2, 18);
  c.fillStyle = lin(c, cx + ring, cy - ring, cx - ring, cy + ring, [[0, '#f5f7f9'], [0.35, '#8a9097'], [0.55, '#e9ecef'], [1, '#575d65']]);
  c.fill();
  rr(c, cx - outer + 0.6, cy - outer + 0.6, outer * 2 - 1.2, outer * 2 - 1.2, 22.5);
  c.lineWidth = 0.9; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
  // the black centre key in its gap
  rr(c, cx - gap, cy - gap, gap * 2, gap * 2, 13); c.fillStyle = '#000'; c.fill();
  rr(c, cx - center, cy - center, center * 2, center * 2, 11.5);
  c.fillStyle = lin(c, 0, cy - center, 0, cy + center, [[0, '#2c2f34'], [0.45, '#111316'], [1, '#050506']]); c.fill();
  rr(c, cx - center + 3, cy - center + 2, center * 2 - 6, center * 0.8, [9, 9, 4, 4]);
  c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill();
  c.restore();
}

function keyRect(i) {
  const cw = PAD.w / PAD.cols, ch = PAD.h / PAD.rows;
  const col = i % 3, row = Math.floor(i / 3);
  const x = PAD.x + col * cw, y = PAD.y + row * ch;
  const r = [row === 0 && col === 0 ? 9 : 3, row === 0 && col === 2 ? 9 : 3, row === 3 && col === 2 ? 9 : 3, row === 3 && col === 0 ? 9 : 3];
  return { x: x + 1.1, y: y + 1.1, w: cw - 2.2, h: ch - 2.2, r };
}

function icon(c, kind, x, y, s) {
  c.save(); c.translate(x, y); c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 1.5; c.lineCap = 'round';
  if (kind === 'vm') {
    c.beginPath(); c.arc(-4.2, -3.6, 3, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(4.2, -3.6, 3, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-4.2, -0.6); c.lineTo(4.2, -0.6); c.stroke();
  } else if (kind === 'space') {
    c.beginPath(); c.moveTo(-5, -5); c.lineTo(-5, -1.5); c.lineTo(5, -1.5); c.lineTo(5, -5); c.stroke();
    c.lineWidth = 1.3; c.beginPath(); c.arc(0, -9.5, 3.4, 0.2, Math.PI * 1.8); c.stroke();
    c.beginPath(); c.arc(0, -9.5, 1.2, 0, Math.PI * 2); c.fill();
  } else if (kind === 'note') {
    c.font = '600 14px "Segoe UI Symbol", "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText('♪', -7, 0);
    c.beginPath(); c.moveTo(3, -1); c.lineTo(3, -5); c.lineTo(0.5, -5); c.lineTo(5.5, -10); c.lineTo(10.5, -5); c.lineTo(8, -5); c.lineTo(8, -1); c.closePath(); c.lineWidth = 1.2; c.stroke();
  }
  c.restore();
}

function keypad(c, k) {
  rr(c, PAD.x - 2.2, PAD.y - 2.2, PAD.w + 4.4, PAD.h + 4.4, 11);
  c.fillStyle = lin(c, 0, PAD.y, 0, PAD.y + PAD.h, [[0, '#5b6168'], [1, '#3a3f45']]); c.fill();
  LABELS.forEach(([digit, extra, side], i) => {
    const r = keyRect(i);
    c.save();
    rr(c, r.x, r.y, r.w, r.h, r.r);
    c.fillStyle = lin(c, 0, r.y, 0, r.y + r.h, [[0, '#eef0f2'], [0.18, '#dde1e5'], [0.7, '#c9ced3'], [1, '#b6bcc2']]);
    c.fill();
    brushed(c, k, r.x, r.y, r.w, r.h, 0.05);
    rr(c, r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2, r.r);
    c.lineWidth = 0.9; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();
    c.beginPath(); c.moveTo(r.x + 3, r.y + r.h - 0.6); c.lineTo(r.x + r.w - 3, r.y + r.h - 0.6);
    c.lineWidth = 1; c.strokeStyle = 'rgba(70,76,84,0.5)'; c.stroke();
    // print
    c.fillStyle = INK; c.textBaseline = 'alphabetic';
    const base = r.y + r.h / 2 + 6.5;
    c.font = DIGIT_FONT; const dW = c.measureText(digit).width;
    const isText = !['vm', 'space', 'note'].includes(extra);
    c.font = LETTER_FONT; const lW = isText ? c.measureText(extra).width : { vm: 15, space: 12, note: 24 }[extra];
    const gapX = 4, total = dW + gapX + lW;
    let x0 = r.x + r.w / 2 - total / 2;
    const parts = side === 'R' ? [['l', lW], ['d', dW]] : [['d', dW], ['l', lW]];
    for (const [kind, w] of parts) {
      if (kind === 'd') { c.font = DIGIT_FONT; c.textAlign = 'left'; c.fillText(digit === '*' ? '∗' : digit, x0, base); }
      else if (isText) { c.font = LETTER_FONT; c.textAlign = 'left'; c.fillText(extra, x0, base - 0.5); }
      else icon(c, extra, x0 + w / 2, base, 1);
      x0 += w + gapX;
    }
    if (digit === '5') {
      for (const dx of [-37, 37]) {
        rr(c, r.x + r.w / 2 + dx - 1.3, r.y + r.h / 2 - 7, 2.6, 14, 1.3);
        c.fillStyle = lin(c, 0, r.y, 0, r.y + r.h, [[0, '#ffffff'], [1, '#8e949b']]); c.fill();
      }
    }
    c.restore();
  });
}

function drawPhone(c, k) {
  c.save(); c.scale(k, k);
  body(c, k); panel(c, k); earpiece(c, k); logo(c, k); screen(c, k);
  for (const s of Object.values(SOFT)) softkey(c, k, s, false);
  navkey(c, k); keypad(c, k);
  c.beginPath(); c.arc(167.5, 805, 1.6, 0, Math.PI * 2); c.fillStyle = '#4a4f56'; c.fill();
  c.restore();
}

function drawGlass(c, k) {
  c.save(); c.scale(k, k);
  c.beginPath(); c.rect(SCR.x, SCR.y, SCR.w, SCR.h); c.clip();
  c.fillStyle = lin(c, SCR.x, SCR.y, SCR.x + SCR.w, SCR.y + SCR.h * 0.6, [[0, 'rgba(255,255,255,0.10)'], [0.45, 'rgba(255,255,255,0.03)'], [0.46, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
  c.fillRect(SCR.x, SCR.y, SCR.w, SCR.h);
  const edge = (x0, y0, x1, y1) => lin(c, x0, y0, x1, y1, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  c.fillStyle = edge(SCR.x, 0, SCR.x + 5, 0); c.fillRect(SCR.x, SCR.y, 5, SCR.h);
  c.fillStyle = edge(SCR.x + SCR.w, 0, SCR.x + SCR.w - 5, 0); c.fillRect(SCR.x + SCR.w - 5, SCR.y, 5, SCR.h);
  c.fillStyle = edge(0, SCR.y, 0, SCR.y + 5); c.fillRect(SCR.x, SCR.y, SCR.w, 5);
  c.restore();
}

function glowPath(c, k, path, color, inset) {
  c.save();
  path(); c.shadowColor = color; c.shadowBlur = 16 * k; c.lineWidth = 3; c.strokeStyle = color; c.stroke();
  c.shadowBlur = 6 * k; c.lineWidth = 1.6; c.strokeStyle = color; c.stroke();
  c.shadowBlur = 0; path(); c.clip();
  path(); c.fillStyle = 'rgba(0,0,0,' + inset + ')'; c.fill();
  c.restore();
  c.save(); path(); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke(); c.restore();
}

function drawPressed(c, k, key, color) {
  c.save(); c.scale(k, k);
  if (key in KEYCELL) {
    const r = keyRect(KEYCELL[key]);
    glowPath(c, k, () => rr(c, r.x, r.y, r.w, r.h, r.r), color, 0.16);
    // pushed in: the top edge falls into shadow
    c.save(); rr(c, r.x, r.y, r.w, r.h, r.r); c.clip();
    c.fillStyle = lin(c, 0, r.y, 0, r.y + 7, [[0, 'rgba(0,0,0,0.28)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(r.x, r.y, r.w, 7);
    c.restore();
  } else if (key === 'soft1' || key === 'soft2') {
    const s = SOFT[key];
    glowPath(c, k, () => rr(c, s.x, s.y, s.w, s.h, 9.5), color, 0.25);
    softkeyDash(c, k, s);
  } else if (key === 'select') {
    const { cx, cy, center } = NAV;
    glowPath(c, k, () => rr(c, cx - center, cy - center, center * 2, center * 2, 11.5), color, 0.3);
  } else {
    // a side of the navigation key: light along that side of the bezel
    const { cx, cy, outer, gap } = NAV;
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[key];
    c.save();
    const ring = new Path2D();
    ringPath(ring, cx - outer, cy - outer, outer * 2, outer * 2, 23);
    ringPath(ring, cx - gap, cy - gap, gap * 2, gap * 2, 13);
    c.clip(ring, 'evenodd');
    const mx = cx + d[0] * (outer + gap) / 2, my = cy + d[1] * (outer + gap) / 2;
    const g = c.createRadialGradient(mx, my, 0, mx, my, 34);
    g.addColorStop(0, color); g.addColorStop(0.55, color + '99'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
    c.restore();
    c.save();
    c.shadowColor = color; c.shadowBlur = 14 * k;
    c.translate(mx, my); c.rotate(Math.atan2(d[1], d[0]));
    c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -5.5); c.lineTo(-3, 5.5); c.closePath();
    c.fillStyle = '#ffffff'; c.fill();
    c.restore();
  }
  c.restore();
}

function ringPath(p, x, y, w, h, r) {
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); p.closePath();
}

function softkeyDash(c, k, s) {
  const dw = 13, dh = 3.6, dx = s.x + s.w / 2 - dw / 2, dy = s.y + s.h / 2 - dh / 2;
  c.save(); c.shadowColor = s.dash; c.shadowBlur = 10 * k;
  rr(c, dx, dy, dw, dh, 1.8); c.fillStyle = '#ffffff'; c.fill();
  c.restore();
}
`;
