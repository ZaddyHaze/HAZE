#!/usr/bin/env python3
"""Lattice field for the social / listing stills: the video's peak frame (every tile flipped to its filament color,
lattice lines drawn, logo solid in the middle), cut along tile edges, with one tile pressed out below the edge.
Usage: python3 stills_field.py OUT.png CANVAS_W CANVAS_H FIELD_H CUT_Y [DROP]   (pixels; the logo sits at 0.44 * FIELD_H)"""
import math, os, runpy, sys
from PIL import Image, ImageDraw, ImageFilter
out, CW, CH, FH, CUT = sys.argv[1], *map(int, sys.argv[2:6])
DROP = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0              # how far the loose tile sits below its socket, in R
sys.argv = ["x", "o.mp4", str(CW), str(FH), "24"]           # geometry: R = 0.115 * min(W, FH), logo at 0.44 * FH
m = runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "animate_master.py"), run_name="lib")
S, R, PAPER, LINE, IND = m["S"], m["R"], m["PAPER"], m["LINE"], m["IND"]
tris, dist, color, centroid, asanoha, mix, shade = m["tris"], m["dist"], m["color"], m["centroid"], m["asanoha"], m["mix"], m["shade"]
img = Image.new("RGB", (CW * S, CH * S), PAPER); dr = ImageDraw.Draw(img)
keep = [k for k in tris if dist[k] > 0 and centroid(tris[k]["pts"])[1] < CUT * S]
# the tile that comes out: on the edge row, right of center, pointing down
edge = [k for k in keep if centroid(tris[k]["pts"])[1] > CUT * S - R * 0.9 and centroid(tris[k]["pts"])[0] > CW * S * 0.58]
out_k = min(edge, key=lambda k: abs(centroid(tris[k]["pts"])[0] - CW * S * 0.68)) if edge else None
lw = max(1, int(R / 60))
tone = lambda c: shade(c, 0.93) if c == PAPER else c                # kinari tiles sit a shade under the paper, as in the video
for k in keep:
    if k == out_k: continue
    pts = tris[k]["pts"]; c = tone(color[k]); dr.polygon(pts, fill=c); asanoha(dr, pts, mix(c, LINE, 0.9), lw)
if out_k:
    pts = tris[out_k]["pts"]
    dr.polygon(pts, fill=shade(PAPER, 0.93))                         # the empty socket reads as a shallow recess
    asanoha(dr, pts, shade(PAPER, 0.84), lw)
    dx, dy = R * 0.16, R * DROP                                      # pressed out, down and a little right
    moved = [(x + dx, y + dy) for x, y in pts]
    sh = Image.new("L", img.size, 0); ImageDraw.Draw(sh).polygon([(x + R * 0.05, y + R * 0.09) for x, y in moved], fill=70)
    sh = sh.filter(ImageFilter.GaussianBlur(R * 0.06))
    img.paste(Image.new("RGB", img.size, shade(PAPER, 0.55)), (0, 0), sh); dr = ImageDraw.Draw(img)
    c = tone(color[out_k]); dr.polygon(moved, fill=c); asanoha(dr, moved, mix(c, LINE, 0.9), lw)
m["draw_logo"](dr, 1.0, 1.0, 1.0)                                    # solid logo, wood tile lifted
img.resize((CW, CH), Image.LANCZOS).save(out); print("wrote", out, "R =", R / S)
