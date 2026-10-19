#!/usr/bin/env python3
"""Living Lattice logo animation, rendered from the real logo geometry.

  1. The logo appears, its six triangles fill in indigo and the lifted tile clicks into place.
  2. Solid indigo triangles unfold outward, one ring at a time, each folding open over its parent's edge.
  3. A second wave flips every tile to one of the 10 stocked filament colors; the lattice lines draw in.
  4. The tiles fold back in, from the edges to the center, and the logo + wordmark settle and hold.

Usage: python3 animate.py OUT.mp4 [WIDTH HEIGHT]   (default 1920 1080; 1080 1920 for vertical)
Needs Pillow and ffmpeg. Font: ShipporiMincho-500.ttf next to this script (falls back to a system serif).
"""
import math, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "living-lattice-unfold.mp4"
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
SS, FPS, DUR = 2, 24, 10.5                     # supersample, frames/s, seconds
PAPER, IND, WOOD = (241, 236, 221), (46, 63, 99), (138, 94, 46)
LINE = (241, 236, 221)                          # lattice lines over the colored tiles
PALETTE = {  # the 10 stocked filament colors, weighted toward the brand colors
    (46, 63, 99): 3, (241, 236, 221): 2, (127, 167, 201): 2, (231, 180, 190): 2, (110, 121, 85): 1,
    (200, 68, 46): 1, (230, 168, 58): 1, (111, 75, 62): 1, (142, 142, 142): 1, (43, 43, 43): 1}

S = SS
R = (min(W, H) * 0.115) * S                    # hexagon radius = triangle side
CX, CY = W * S / 2, (H * 0.44 if W > H else H * 0.42) * S
u = (R * math.cos(math.radians(30)), R * math.sin(math.radians(30)))   # lattice basis (math coords)
v = (0.0, R)
def P(i, j): return (CX + i * u[0] + j * v[0], CY - (i * u[1] + j * v[1]))

# ---- triangle grid covering the frame ----
tris = {}
N = int(max(W, H) * S / R) + 4
for i in range(-N, N + 1):
    for j in range(-2 * N, 2 * N + 1):
        for k, t in ((0, ((i, j), (i + 1, j), (i, j + 1))), (1, ((i + 1, j), (i + 1, j + 1), (i, j + 1)))):
            pts = [P(*q) for q in t]
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            if max(xs) < -R or min(xs) > W * S + R or max(ys) < -R or min(ys) > H * S + R: continue
            tris[(i, j, k)] = {"v": t, "pts": pts}
edge_map = {}
for key, t in tris.items():
    for a in range(3):
        e = tuple(sorted((t["v"][a], t["v"][(a + 1) % 3]))); edge_map.setdefault(e, []).append(key)
# the six logo triangles share the center vertex (0,0)
logo = [k for k, t in tris.items() if (0, 0) in t["v"]]
lifted = (0, 0, 0)                               # between the 30 and 90 degree spokes: top right
dist, parent, queue = {k: 0 for k in logo}, {}, list(logo)
while queue:
    cur = queue.pop(0)
    t = tris[cur]
    for a in range(3):
        e = tuple(sorted((t["v"][a], t["v"][(a + 1) % 3])))
        for nb in edge_map[e]:
            if nb not in dist: dist[nb] = dist[cur] + 1; parent[nb] = (cur, e); queue.append(nb)
DMAX = max(dist.values())
rng = random.Random(7)
cols, wts = list(PALETTE), list(PALETTE.values())
color = {k: rng.choices(cols, wts)[0] for k in tris}
for k in logo: color[k] = IND
color[lifted] = WOOD

def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def mix(c1, c2, a): return tuple(int(c1[i] + (c2[i] - c1[i]) * a) for i in range(3))
def shade(c, f): return tuple(int(x * f) for x in c)
def centroid(pts): return (sum(p[0] for p in pts) / 3, sum(p[1] for p in pts) / 3)

def folded(key, p):
    """Triangle unfolding over its parent edge: p=0 lies folded onto the parent, 0.5 edge-on, 1 open."""
    if key not in parent: return tris[key]["pts"], 1.0
    e = parent[key][1]; A = [q for q in tris[key]["v"] if q not in e][0]
    a, b, A = P(*e[0]), P(*e[1]), P(*A)
    M = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); f = -math.cos(math.pi * p)
    return [a, b, (M[0] + (A[0] - M[0]) * f, M[1] + (A[1] - M[1]) * f)], f

def flipped(pts, p):
    """Card flip in place, across the triangle's own median: returns squeezed points and which face shows."""
    c = centroid(pts); f = math.cos(math.pi * p)
    a = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]); L = math.hypot(*a); a = (a[0] / L, a[1] / L)
    out = []
    for q in pts:  # squeeze along the direction of the first edge
        d = (q[0] - c[0]) * a[0] + (q[1] - c[1]) * a[1]
        out.append((q[0] - a[0] * d * (1 - abs(f)), q[1] - a[1] * d * (1 - abs(f))))
    return out, f

def asanoha(dr, pts, col, w):
    c = centroid(pts)
    for q in pts: dr.line([c, q], fill=col, width=w)
    dr.line(pts + [pts[0]], fill=col, width=int(w * 1.6), joint="curve")

font_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ShipporiMincho-500.ttf")
try: FONT = ImageFont.truetype(font_path, int(R * 0.5))
except OSError: FONT = ImageFont.truetype("DejaVuSerif.ttf", int(R * 0.38))
WORD, TRACK = "LIVING LATTICE", R * 0.12

def draw_logo(dr, alpha, lift, fill_alpha):
    """The vector mark: asanoha lines in each of the six triangles, top-right one lifted in wood."""
    sc = R / 100
    for k in logo:
        pts = tris[k]["pts"]
        if k == lifted:
            d = 16 * sc * lift; pts = [(x + d * math.cos(math.radians(60)), y - d * math.sin(math.radians(60))) for x, y in pts]
        col = WOOD if k == lifted else IND
        if fill_alpha > 0: dr.polygon(pts, fill=mix(PAPER, col, fill_alpha))
        # lines: the mark's color on paper; paper-colored once the tile is filled solid
        line_col = mix(PAPER, mix(col, PAPER, fill_alpha * 0.92), alpha)
        if alpha > 0: asanoha(dr, pts, line_col, max(1, int(4.2 * sc)))

def draw_word(dr, alpha):
    if alpha <= 0: return
    widths = [dr.textlength(ch, font=FONT) for ch in WORD]; total = sum(widths) + TRACK * (len(WORD) - 1)
    x, y = CX - total / 2, CY + R * 1.38
    for ch, w in zip(WORD, widths): dr.text((x, y), ch, font=FONT, fill=mix(PAPER, IND, alpha)); x += w + TRACK

def frame(t):
    img = Image.new("RGB", (W * S, H * S), PAPER); dr = ImageDraw.Draw(img)
    order = sorted(tris, key=lambda k: dist[k])
    if t < 1.3:                                    # 1. logo in, fills, the lifted tile clicks home
        a = ease(t / 0.6); fill = ease((t - 0.7) / 0.4); lift = 1 - ease((t - 0.9) / 0.35)
        draw_logo(dr, a, lift, fill)
        return img
    lines_a = ease((t - 5.3) / 0.9) * (1 - ease((t - 6.9) / 0.5))
    for k in order:
        d = dist[k]
        if d == 0: continue
        # 2. unfold outward (solid indigo), 4. fold back inward at the end
        p_open = ease((t - (1.3 + (d - 1) * 0.15)) / 0.45)
        p_close = ease((t - (7.0 + (DMAX - d) * 0.045)) / 0.35)
        p = p_open * (1 - p_close)
        if p <= 0.001: continue
        pts, f = folded(k, p)
        # 3. color wave: card-flip from indigo to the tile's filament color
        q = ease((t - (4.2 + d * 0.07)) / 0.4)
        if 0 < q < 1:
            pts, g = flipped(pts, q); face = IND if g > 0 else color[k]
        else: face = color[k] if q >= 1 else IND
        if f < 0: face = shade(face, 0.72)         # the back of the fold reads darker
        dr.polygon(pts, fill=shade(face, 0.82 + 0.18 * abs(f)))
        if lines_a > 0 and p > 0.98: asanoha(dr, pts, mix(face, LINE, lines_a * 0.9), max(1, int(R / 60)))
    # the logo stays solid in the middle until the end, then turns back into the line mark
    back = ease((t - 8.15) / 0.5)
    draw_logo(dr, 1.0, ease((t - 8.4) / 0.35), 1 - back)
    draw_word(dr, ease((t - 8.5) / 0.6))
    return img

if OUT == "--stills":
    for tt in map(float, sys.argv[4:]): frame(tt).resize((W, H), Image.LANCZOS).save(f"still_{tt:.1f}.png")
    sys.exit()
tmp = OUT + ".frames"; os.makedirs(tmp, exist_ok=True)
n = int(DUR * FPS)
for i in range(n):
    frame(i / FPS).resize((W, H), Image.LANCZOS).save(f"{tmp}/{i:04d}.png")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", f"{tmp}/%04d.png", "-c:v", "libx264", "-crf", "17",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], check=True)
for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
os.rmdir(tmp)
print("wrote", OUT, n, "frames")
