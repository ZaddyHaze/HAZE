#!/usr/bin/env python3
"""Writes the Living Lattice logo files with the wordmark converted to outlines (no font needed to view them).
Mark: a hexagon of six asanoha triangles; the top-right triangle is lifted out in wood. Run: python3 make_logos.py"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
HERE = os.path.dirname(os.path.abspath(__file__))
IND, WOOD, PAPER = "#2E3F63", "#8A5E2E", "#F1ECDD"
R = 100
P = lambda a, r=R: (r * math.cos(math.radians(a)), -r * math.sin(math.radians(a)))
V = [P(90 - 60 * k) for k in range(6)]

def tri(A, B, C, dx, dy, col, grid, inf):
    A, B, C = [(p[0] + dx, p[1] + dy) for p in (A, B, C)]
    c = ((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3)
    s = f'<g stroke="{col}" stroke-linecap="round" stroke-linejoin="round" fill="none">'
    for p in (A, B, C): s += f'<line x1="{c[0]:.2f}" y1="{c[1]:.2f}" x2="{p[0]:.2f}" y2="{p[1]:.2f}" stroke-width="{inf}"/>'
    return s + f'<polygon points="{A[0]:.2f},{A[1]:.2f} {B[0]:.2f},{B[1]:.2f} {C[0]:.2f},{C[1]:.2f}" stroke-width="{grid}"/></g>'

def mark(main=IND, accent=WOOD, grid=7, inf=4.2, lift=16):
    out = ""
    for k in range(6):
        A, B = V[k], V[(k + 1) % 6]
        if k == 0: out += tri((0, 0), A, B, lift * math.cos(math.radians(60)), -lift * math.sin(math.radians(60)), accent, grid, inf)
        else: out += tri((0, 0), A, B, 0, 0, main, grid, inf)
    return out

font = TTFont(os.path.join(HERE, "ShipporiMincho-500.ttf"))
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
def text_path(txt, size, track, cx, baseline, anchor="middle"):
    """Outlines for txt at font size `size` (px), letter spacing `track` (px)."""
    sc = size / upm; names = [cmap[ord(ch)] for ch in txt]
    widths = [gs[n].width * sc for n in names]
    total = sum(widths) + track * (len(txt) - 1)
    x = cx - total / 2 if anchor == "middle" else cx
    pen = SVGPathPen(gs)
    for n, w in zip(names, widths):
        gs[n].draw(TransformPen(pen, (sc, 0, 0, -sc, x, baseline))); x += w + track
    return pen.getCommands(), total

def svg(vb, body, title="Living Lattice"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'

def write(name, s): open(os.path.join(HERE, name), "w").write(s); print("wrote", name)

MV = "-122 -128 246 236"
write("mark.svg", svg(MV, mark()))
write("mark-reversed.svg", svg(MV, mark(main=PAPER, accent="#C9925A")))
write("mark-indigo-one-color.svg", svg(MV, mark(main=IND, accent=IND)))
write("mark-white-one-color.svg", svg(MV, mark(main="#FFFFFF", accent="#FFFFFF")))
write("favicon.svg", svg(MV, mark(grid=12, inf=9)))
for name, main, acc, ink in (("logo-stacked.svg", IND, WOOD, IND), ("logo-stacked-reversed.svg", PAPER, "#C9925A", PAPER)):
    d, w = text_path("LIVING LATTICE", 40, 8, 0, 200)
    write(name, svg("-260 -128 520 350", mark(main, acc) + f'<path d="{d}" fill="{ink}"/>'))
for name, main, acc, ink in (("logo-horizontal.svg", IND, WOOD, IND), ("logo-horizontal-reversed.svg", PAPER, "#C9925A", PAPER)):
    d, w = text_path("Living Lattice", 52, 3, 92, 18, anchor="start")
    write(name, svg(f"-80 -82 {int(92 + w + 100)} 164", f'<g transform="scale(0.62)">{mark(main, acc)}</g><path d="{d}" fill="{ink}"/>'))
