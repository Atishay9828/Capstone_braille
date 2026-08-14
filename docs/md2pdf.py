#!/usr/bin/env python
"""
md2pdf.py — convert Braillix markdown docs to PDF.

    python docs/md2pdf.py docs/MASTER_BOM.md docs/ASSEMBLY_BIBLE.md ...
    python docs/md2pdf.py --all          # every .md in docs/ that has no newer .pdf

Handles headings, tables, fenced code, blockquotes, bullet/numbered lists and
inline bold/code. Deliberately sanitises emoji and box-drawing characters:
ReportLab's built-in fonts have no glyphs for them and render solid black
boxes, which looks broken in a document you hand to an evaluator.
"""
import re
import sys
import os
import glob

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, Preformatted, HRFlowable,
                                ListFlowable, ListItem)

# --- glyph sanitising -------------------------------------------------------
SUBS = {
    "⚠️": "[!]", "⚠": "[!]", "✅": "[OK]", "❌": "[X]", "⭐": "*",
    "🔴": "[!!]", "🟠": "[!]", "🟡": "[~]", "🔵": "[i]", "🟢": "[OK]",
    "💡": "[idea]", "📱": "", "💰": "", "🎯": "", "🔧": "", "🐛": "[bug]",
    "→": "->", "←": "<-", "↑": "^", "↓": "v", "►": ">", "◄": "<",
    "—": "-", "–": "-", "’": "'", "‘": "'", "“": '"', "”": '"',
    "×": "x", "²": "2", "³": "3", "°": "deg", "…": "...", "≈": "~",
    "≤": "<=", "≥": ">=", "±": "+/-", "·": "-", "⌀": "dia ", "Ø": "dia ",
    "◁": "<|", "▷": "|>", "○": "()", "⠿": "[braille]",
}
for ch in "┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬":
    SUBS[ch] = "+"
for ch in "─═":
    SUBS[ch] = "-"
for ch in "│║":
    SUBS[ch] = "|"


def sanitize(t):
    for k, v in SUBS.items():
        t = t.replace(k, v)
    return "".join(c if ord(c) < 256 else "?" for c in t)


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# Wire colours written as `RED`, `BLACK` etc. print in that colour. A bench doc
# that says "connect the red wire" in black ink is the one place ambiguity costs
# hardware, so the code span carries the colour through to the PDF.
WIRE_COLOURS = {
    "RED": "#cc0000", "BLACK": "#000000", "BLUE": "#0044cc",
    "YELLOW": "#a07800", "ORANGE": "#d2691e", "PINK": "#cc0088",
    "GREEN": "#0a7d33", "BROWN": "#7a4a1e", "PURPLE": "#6f42c1",
    "WHITE": "#8a8a8a", "GREY": "#666666", "GRAY": "#666666",
}


def inline(t):
    t = esc(sanitize(t))
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)

    def code_span(m):
        s = m.group(1)
        c = WIRE_COLOURS.get(s.strip().upper())
        if c:
            return f'<font face="Courier-Bold" color="{c}">{s}</font>'
        return f'<font face="Courier">{s}</font>'

    t = re.sub(r"`(.+?)`", code_span, t)
    return t


# --- styles -----------------------------------------------------------------
S = getSampleStyleSheet()
NAVY = colors.HexColor("#1a3c5e")
body = ParagraphStyle("body", parent=S["Normal"], fontSize=9.5, leading=13)
h1 = ParagraphStyle("h1", parent=S["Heading1"], fontSize=17, spaceBefore=10,
                    spaceAfter=6, textColor=NAVY)
h2 = ParagraphStyle("h2", parent=S["Heading2"], fontSize=13, spaceBefore=12,
                    spaceAfter=5, textColor=NAVY)
h3 = ParagraphStyle("h3", parent=S["Heading3"], fontSize=10.5, spaceBefore=8,
                    spaceAfter=3, textColor=colors.HexColor("#33495e"))
quote = ParagraphStyle("quote", parent=body, leftIndent=8, fontSize=9,
                       leading=12, textColor=colors.HexColor("#555555"))
code = ParagraphStyle("code", parent=S["Code"], fontSize=7.4, leading=9,
                      textColor=colors.HexColor("#202020"))
cell = ParagraphStyle("cell", parent=body, fontSize=8, leading=9.8)
cellh = ParagraphStyle("cellh", parent=cell, textColor=colors.white,
                       fontName="Helvetica-Bold")


def convert(src, dst):
    lines = open(src, encoding="utf-8").read().split("\n")
    flow, para = [], []
    i, n = 0, len(lines)

    def flush():
        if para:
            flow.append(Paragraph(inline(" ".join(para)), body))
            flow.append(Spacer(1, 3))
            para.clear()

    while i < n:
        ln, s = lines[i], lines[i].strip()

        if s.startswith("```"):                       # fenced code
            flush(); i += 1; buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(sanitize(lines[i])); i += 1
            i += 1
            flow.append(Preformatted("\n".join(buf), code))
            flow.append(Spacer(1, 5)); continue

        if ("|" in ln and i + 1 < n and "|" in lines[i + 1]
                and re.match(r"^\s*\|?[\s:|-]*-{2,}[\s:|-]*", lines[i + 1])):
            flush()

            def cells(row):
                row = row.strip().strip("|")
                return [c.strip() for c in row.split("|")]

            head = cells(lines[i]); i += 2
            data = [[Paragraph(inline(c), cellh) for c in head]]
            while i < n and "|" in lines[i] and lines[i].strip():
                r = cells(lines[i])
                r = (r + [""] * len(head))[:len(head)]
                data.append([Paragraph(inline(c), cell) for c in r]); i += 1
            avail = A4[0] - 30 * mm
            t = Table(data, colWidths=[avail / len(head)] * len(head), repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#999999")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                 [colors.white, colors.HexColor("#f2f5f8")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            flow.append(t); flow.append(Spacer(1, 6)); continue

        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", s):    # rule
            flush(); flow.append(Spacer(1, 2))
            flow.append(HRFlowable(width="100%", thickness=0.6,
                                   color=colors.HexColor("#bbbbbb")))
            flow.append(Spacer(1, 4)); i += 1; continue

        m = re.match(r"^(#{1,6})\s+(.*)", s)          # heading
        if m:
            flush()
            flow.append(Paragraph(inline(m.group(2)),
                                  {1: h1, 2: h2}.get(len(m.group(1)), h3)))
            i += 1; continue

        if s.startswith(">"):                          # blockquote
            flush(); buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip()[1:].strip()); i += 1
            flow.append(Paragraph(inline(" ".join(buf)), quote))
            flow.append(Spacer(1, 4)); continue

        bm = re.match(r"^[-*+]\s+(.*)", s)
        nm = re.match(r"^(\d+)[.)]\s+(.*)", s)
        if bm or nm:                                   # list
            flush(); items = []; numbered = bool(nm)
            while i < n:
                ss = lines[i].strip()
                b2 = re.match(r"^[-*+]\s+(.*)", ss)
                n2 = re.match(r"^(\d+)[.)]\s+(.*)", ss)
                if b2 and not numbered:
                    items.append(ListItem(Paragraph(inline(b2.group(1)), body),
                                          leftIndent=14))
                elif n2 and numbered:
                    items.append(ListItem(Paragraph(inline(n2.group(2)), body),
                                          leftIndent=16))
                else:
                    break
                i += 1
            flow.append(ListFlowable(
                items, bulletType="1" if numbered else "bullet",
                start="1" if numbered else None, leftIndent=14))
            flow.append(Spacer(1, 4)); continue

        if not s:
            flush(); i += 1; continue
        para.append(s); i += 1

    flush()
    SimpleDocTemplate(dst, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                      topMargin=14 * mm, bottomMargin=14 * mm,
                      title=os.path.basename(src)).build(flow)
    return dst


if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["--all"]:
        args = [f for f in glob.glob("docs/*.md")]
    if not args:
        print(__doc__); sys.exit(1)
    for src in args:
        dst = os.path.splitext(src)[0] + ".pdf"
        try:
            convert(src, dst)
            print(f"  OK   {dst}")
        except Exception as e:
            print(f"  FAIL {src}: {e}")
