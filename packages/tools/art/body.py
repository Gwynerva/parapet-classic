"""Bodies of the bosses: the original body parts (every turn of every part, both sides) recoloured
like the look's rules would, thickened keeping their outline and shading, painted over, and
written as the look's own parts. A knight in heavy plate, a thin girl with a full skirt."""
import json
import os

from heads import Pic

HERE = os.path.dirname(os.path.abspath(__file__))
_BODY = json.load(open(os.path.join(HERE, 'base_body.json'), encoding='utf-8'))

FAMILIES = {
    'forearm': list(range(1, 5)),
    'upper-arm': list(range(5, 13)),
    'hand': list(range(17, 25)),
    'shin': list(range(30, 34)),
    'torso': list(range(34, 39)),
    'shoe': list(range(39, 49)),
    'thigh': list(range(49, 57)),
    'chest': list(range(57, 62)),
    'knee': list(range(62, 66)),
}
MALE = {1, 2, 4, 7, 9}


def source_id(base, id_):
    """The atlas sprite a body part is for an original character (men have their own top)."""
    if base in MALE:
        if 34 <= id_ <= 38:
            return 127 + id_ - 34
        if 57 <= id_ <= 61:
            return 132 + id_ - 57
    return id_


def part(base, id_):
    v = _BODY[str(source_id(base, id_))]
    pal = v['palette']
    return Pic([[pal[ch] if ch != '.' else None for ch in row] for row in v['rows']])


def apply_rules(pic, id_, rules):
    """The look's recolour rules for sprite `id_`, in order (one-sided ones left out)."""
    for r in rules:
        if 'on' in r or id_ not in r['sprites']:
            continue
        pic.recolor(r['map'])
    return pic


def inflate(pic, n=1, axis=None):
    """Grows a picture by `n` pixels all round (or across `axis` 'x' / 'y' only), keeping its
    outline: the outline moves out and the colour just inside it fills the gap."""
    for _ in range(n):
        dx = 0 if axis == 'y' else 1
        dy = 0 if axis == 'x' else 1
        pic.pad(dx, dy, dx, dy)
        old = [r[:] for r in pic.g]
        h, w = pic.h, pic.w
        dirs = [d for d in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (d[0] and dx) or (d[1] and dy)]

        def at(x, y):
            return old[y][x] if 0 <= x < w and 0 <= y < h else None

        for y in range(h):
            for x in range(w):
                c = old[y][x]
                if c is None:
                    # Out of the edge: the outline steps here.
                    for ex, ey in dirs:
                        n_ = at(x + ex, y + ey)
                        if n_ is not None:
                            pic.g[y][x] = n_
                            break
                    continue
                # On the edge: take the colour from inside.
                for ex, ey in dirs:
                    if at(x + ex, y + ey) is None:
                        inner = at(x - ex, y - ey)
                        if inner is not None and at(x - 2 * ex, y - 2 * ey) is not None:
                            pic.g[y][x] = inner
                        break
    return pic


def body_parts(base, rules, plan, paint=None, keys=None):
    """Parts for a look: `plan` maps a family to how much it grows (an int, or (n, axis)); every
    sprite of those families comes out recoloured and grown; `paint(id, pic)` may draw on it.
    Returns {key: Pic}."""
    out = {}
    for fam, how in plan.items():
        n, axis = (how, None) if isinstance(how, int) else how
        for id_ in FAMILIES[fam]:
            p = apply_rules(part(base, id_), id_, rules)
            if n > 0:
                inflate(p, n, axis if axis is None else _axis_for(id_, axis))
            elif n < 0:
                shrink(p, -n, 'x' if fam in ('thigh', 'shin', 'knee') and id_ in (30, 49, 53, 62) else None)
            if paint:
                p = paint(id_, p) or p
            out[str(id_)] = p
    return out


def _axis_for(id_, axis):
    """Across a limb: its upright picture lies along x (arms) or y (legs); turned ones grow
    every way."""
    from_k0 = {1: 'y', 5: 'y', 9: 'y', 30: 'x', 49: 'x', 53: 'x', 34: 'x', 57: 'x'}
    return from_k0.get(id_, None) if axis == 'across' else axis


def mask_of(pic):
    return [''.join('#' if c else '.' for c in row) for row in pic.g]


def metal(pic, ramp, outline, segment=0, light=(0.45, -0.65, 0.62), shine=True):
    """Re-lights a part's silhouette as a plate of metal: a cylinder along its longest axis
    (found from its pixels), outlined, with lames across every `segment` pixels."""
    pts = [(x + 0.5, y + 0.5) for y, row in enumerate(pic.g) for x, c in enumerate(row) if c]
    if not pts:
        return pic
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - cx) ** 2 for p in pts) / n
    syy = sum((p[1] - cy) ** 2 for p in pts) / n
    sxy = sum((p[0] - cx) * (p[1] - cy) for p in pts) / n
    import math
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    radius = max(abs((p[0] - cx) * vx + (p[1] - cy) * vy) for p in pts) or 1
    lx, ly, lz = light
    ln = (lx * lx + ly * ly + lz * lz) ** 0.5
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    h, w = pic.h, pic.w
    filled = [[c is not None for c in row] for row in pic.g]
    out = [[None] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not filled[y][x]:
                continue
            edge = any(not (0 <= x + dx < w and 0 <= y + dy < h and filled[y + dy][x + dx])
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                out[y][x] = outline
                continue
            px, py = x + 0.5 - cx, y + 0.5 - cy
            t = (px * vx + py * vy) / radius
            t = max(-1.0, min(1.0, t))
            nz = (1 - t * t) ** 0.5
            b = t * vx * lx + t * vy * ly + nz * lz
            b = max(0.0, min(1.0, (b + 0.2) / 1.2))
            i = round((1 - b) * (len(ramp) - 1))
            if segment:
                s = px * ux + py * uy
                if int(math.floor(s)) % segment == 0:
                    i = min(len(ramp) - 1, i + 2)
            if shine and b > 0.93:
                i = 0
            out[y][x] = ramp[i]
    return Pic(out)


def dome(pic, ramp, outline, light=(0.45, -0.6, 0.65)):
    """Re-lights a silhouette as a rounded body (a breastplate, a gauntlet)."""
    from heads import shaded
    return shaded(mask_of(pic), ramp, outline, light=light)


def keep_from(relit, original, colours, n):
    """Puts back an original's pixels of `colours` (a belt, a strap) onto a relit picture grown
    by `n` (its pixels moved by n each way)."""
    cs = {c.lower() for c in colours}
    for y, row in enumerate(original.g):
        for x, c in enumerate(row):
            if c and c.lower() in cs:
                relit.set(x + n, y + n, c)
    return relit


def outfit_parts(base, rules, plan, paint=None):
    """Like `body_parts`, plus a picture for one side (`<id>:left`, `<id>:right`) wherever a
    one-sided recolour rule (`on`) touches a grown sprite."""
    out = body_parts(base, rules, plan, paint)
    sided = [r for r in rules if 'on' in r]
    for side in ('left', 'right'):
        side_rules = [r for r in sided if r['on'] == side]
        if not side_rules:
            continue
        flat = [{k: v for k, v in r.items() if k != 'on'} for r in rules if r.get('on', side) == side]
        touched = {i for r in side_rules for i in r['sprites']}
        for fam, how in plan.items():
            n, axis = (how, None) if isinstance(how, int) else how
            for id_ in FAMILIES[fam]:
                if id_ not in touched:
                    continue
                p = apply_rules(part(base, id_), id_, flat)
                if n > 0:
                    inflate(p, n, axis if axis is None else _axis_for(id_, axis))
                elif n < 0:
                    shrink(p, -n, 'x' if id_ in (30, 49, 53, 62) else None)
                if paint:
                    p = paint(id_, p) or p
                out[f'{id_}:{side}'] = p
    return out


def write_parts(look, parts, pal):
    """Puts grown parts into a look (and their colours into its palette builder)."""
    look.setdefault('parts', {})
    for k, p in parts.items():
        look['parts'][k] = pal.rows(p)
    return look


def shrink(pic, n=1, axis=None):
    """Thins a picture by `n` pixels all round (or across `axis`), keeping its outline: the
    outer ring goes and the pixels just inside take its colours."""
    for _ in range(n):
        old = [r[:] for r in pic.g]
        h, w = pic.h, pic.w
        dirs = [d for d in ((1, 0), (-1, 0), (0, 1), (0, -1))
                if (d[0] and axis != 'y') or (d[1] and axis != 'x')]

        def at(x, y):
            return old[y][x] if 0 <= x < w and 0 <= y < h else None

        for y in range(h):
            for x in range(w):
                c = old[y][x]
                if c is None:
                    continue
                for ex, ey in dirs:
                    if at(x + ex, y + ey) is None:
                        # An edge pixel: gone, unless it is all there is across.
                        if at(x - ex, y - ey) is not None:
                            pic.g[y][x] = None
                            inner = (x - ex, y - ey)
                            pic.g[inner[1]][inner[0]] = c
                        break
    return pic


def suit(pic, ramp, outline, stripes=(), gloss=0.0, light=(0.45, -0.6, 0.65)):
    """Re-lights a part's silhouette as a fitted suit: a smooth cylinder along its longest axis,
    outlined; `stripes` are (t0, t1, light colour, dark colour) bands along the axis, t across it
    from -1 (the part's one edge) to 1 (the other); `gloss` adds a thin highlight (leather)."""
    import math
    pts = [(x + 0.5, y + 0.5) for y, row in enumerate(pic.g) for x, c in enumerate(row) if c]
    if not pts:
        return pic
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - cx) ** 2 for p in pts) / n
    syy = sum((p[1] - cy) ** 2 for p in pts) / n
    sxy = sum((p[0] - cx) * (p[1] - cy) for p in pts) / n
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    # Across the part, from its own edge to edge at each point along it.
    lx, ly, lz = light
    ln = (lx * lx + ly * ly + lz * lz) ** 0.5
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    spans = {}
    for px, py in pts:
        s = round((px - cx) * ux + (py - cy) * uy)
        t = (px - cx) * vx + (py - cy) * vy
        lo, hi = spans.get(s, (t, t))
        spans[s] = (min(lo, t), max(hi, t))
    h, w = pic.h, pic.w
    filled = [[c is not None for c in row] for row in pic.g]
    out = [[None] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not filled[y][x]:
                continue
            edge = any(not (0 <= x + dx < w and 0 <= y + dy < h and filled[y + dy][x + dx])
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                out[y][x] = outline
                continue
            px, py = x + 0.5 - cx, y + 0.5 - cy
            s = round(px * ux + py * uy)
            lo, hi = spans.get(s, (-1, 1))
            t = (px * vx + py * vy - (lo + hi) / 2) / max(0.5, (hi - lo) / 2)
            t = max(-1.0, min(1.0, t))
            nz = (1 - t * t) ** 0.5
            b = t * vx * lx + t * vy * ly + nz * lz
            b = max(0.0, min(1.0, (b + 0.25) / 1.25))
            colour = ramp[round((1 - b) * (len(ramp) - 1))]
            for t0, t1, cl, cd in stripes:
                if t0 <= t <= t1:
                    colour = cl if b > 0.45 else cd
            if gloss and abs(b - 0.95) < gloss:
                colour = ramp[0]
            out[y][x] = colour
    return Pic(out)
