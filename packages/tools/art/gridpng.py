"""Pictures as text grids → a magnified PNG (pure Python), to look at heads side by side."""
import os
import struct
import zlib

# Where the sheets go (git ignores it); a relative path given to `sheet` is taken from here.
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')


def hex_rgba(c):
    c = c.lstrip('#')
    if len(c) == 6:
        c += 'ff'
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4, 6))


def save_png(path, w, h, rgba_rows):
    raw = b''.join(b'\x00' + bytes(row) for row in rgba_rows)
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    path = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)


def sheet(path, pictures, scale=8, bg=(160, 176, 196), gap=2, per_row=8):
    """pictures: list of (rows, palette). Lays them out left to right, wrapping."""
    cells = []
    for rows, pal in pictures:
        w = max(len(r) for r in rows)
        cells.append((rows, pal, w, len(rows)))
    cw = max(c[2] for c in cells) + gap
    ch = max(c[3] for c in cells) + gap
    cols = min(per_row, len(cells))
    nrows = (len(cells) + per_row - 1) // per_row
    W, H = cols * cw * scale, nrows * ch * scale
    img = [[bg[0], bg[1], bg[2], 255] * W for _ in range(H)]
    for i, (rows, pal, w, h) in enumerate(cells):
        ox = (i % per_row) * cw * scale
        oy = (i // per_row) * ch * scale
        # A checker behind each cell shows its box.
        for y in range(h * scale):
            for x in range(w * scale):
                v = 150 if ((x // scale + y // scale) % 2) else 170
                o = (ox + x) * 4
                img[oy + y][o:o + 4] = [v, v + 10, v + 25, 255]
        for y, row in enumerate(rows):
            for x, chh in enumerate(row):
                if chh in '. +' or chh not in pal:
                    continue
                r, g, b, a = hex_rgba(pal[chh])
                if a == 0:
                    continue
                for yy in range(scale):
                    line = img[oy + y * scale + yy]
                    for xx in range(scale):
                        o = (ox + x * scale + xx) * 4
                        line[o:o + 4] = [r, g, b, 255]
    save_png(path, W, H, img)
