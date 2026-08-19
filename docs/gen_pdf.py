from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

doc = SimpleDocTemplate("D:/TIET/Capstone/docs/SHOPPING_LIST.pdf", pagesize=A4,
                        topMargin=20*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)

styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=16, spaceAfter=4*mm)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=13, spaceAfter=3*mm, spaceBefore=5*mm)
normal = ParagraphStyle("Norm", parent=styles["Normal"], fontSize=9, leading=12)
small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, leading=10)
bold_style = ParagraphStyle("Bold", parent=styles["Normal"], fontSize=9, leading=12, fontName="Helvetica-Bold")

def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), HexColor("#2c3e50")),
        ("TEXTCOLOR", (0,0), (-1,0), HexColor("#ffffff")),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,0), 8),
        ("FONTSIZE", (0,1), (-1,-1), 7.5),
        ("ALIGN", (0,0), (-1,-1), "LEFT"),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [HexColor("#f8f9fa"), HexColor("#ffffff")]),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
    ]))
    return t

story = []
W = [15, 120, 110, 22, 40, 55]

story.append(Paragraph("Braillix v5.1 - Electronics &amp; Hardware Shopping List", title_style))
story.append(Paragraph("1 Brain Pod + 1 Cell prototype. Multiply cell items by N for more cells.", normal))
story.append(Spacer(1, 4*mm))

# A
story.append(Paragraph("A. ESP32 Brain Pod", h1))
story.append(make_table(
    ["#", "Item", "Specs", "Qty", "Price", "Source"],
    [
        ["1", "ESP32 DevKit-compatible (30-pin)", "WiFi+BT, USB-C; owned board", "1", "Owned", "-"],
        ["2", "Female header strip 1x15", "2.54mm pitch", "2", "Rs 10 ea", "Local"],
        ["3", "Inline female barrel pigtail", "5.5x2.1mm; owned cable", "1", "Owned", "-"],
        ["4", "5V 3A DC adapter", "5.5x2.1mm barrel plug", "1", "Rs 200", "Local/Amazon"],
        ["5", "6x6x5mm tactile switch", "4-pin DIP, momentary", "3", "Rs 5 ea", "Robocraze"],
        ["6", "4.7k ohm resistor", "1/4W through-hole", "2", "Rs 1 ea", "Local"],
        ["7", "Piezo buzzer (optional)", "5V, 12mm", "1", "Rs 15", "Local"],
    ], col_widths=W))
story.append(Paragraph("<b>Pod subtotal: ~Rs 420</b>", bold_style))

# B
story.append(Paragraph("B. Per Cell - Motor + Mechanical", h1))
story.append(make_table(
    ["#", "Item", "Specs", "Qty", "Price", "Source"],
    [
        ["8", "28BYJ-48 stepper motor", "5V DC, 4-phase, 64:1", "1", "Rs 80", "Robocraze"],
        ["9", "SS49E Hall effect sensor", "Linear, SIP-3, 3-6V", "1", "Rs 25", "Robocraze"],
        ["10", "3x1mm NeFeB disc magnet", "Neodymium, homing", "1", "Rs 5", "Local"],
        ["11", "2mm SS bearing balls", "For braille dot caps", "6", "Rs 2 ea", "Amazon"],
        ["12", "Micro compression spring", "OD 4-4.5mm, L 5-6mm", "6", "Rs 3 ea", "Local hw"],
    ], col_widths=W))
story.append(Paragraph("<b>Per-cell mechanical subtotal: ~Rs 140</b>", bold_style))

# C
story.append(Paragraph("C. Per Cell - Electronics (Prototype Route)", h1))
story.append(make_table(
    ["#", "Item", "Specs", "Qty", "Price", "Source"],
    [
        ["13", "Arduino Pro Mini 5V/16MHz", "ATmega328P, 33x18mm", "1", "Rs 120", "Robocraze"],
        ["14", "ULN2003 driver board", "28x35mm module", "1", "Rs 40", "Robocraze"],
    ], col_widths=W))
story.append(Paragraph("<b>Per-cell electronics subtotal: ~Rs 160</b>", bold_style))

# D
story.append(Paragraph("D. Daisy-Chain Connectors", h1))
story.append(make_table(
    ["#", "Item", "Specs", "Qty", "Price", "Source"],
    [
        ["15", "4-pin pogo connector pair", "2mm pitch, spring+pad", "2 pairs", "Rs 40/pr", "LCSC/AliExpr"],
        ["16", "8x1mm NeFeB magnets (docking)", "2 per face; pod + two cells", "10", "Owned", "-"],
    ], col_widths=W))

# E
story.append(Paragraph("E. Hardware / Fasteners", h1))
story.append(make_table(
    ["#", "Item", "Specs", "Qty", "Price", "Source"],
    [
        ["17", "M2.5 x 25mm bolts", "Pan/socket head", "4", "Rs 2 ea", "Local hw"],
        ["18", "M2 x 6mm screws", "Pan head", "6", "Rs 1 ea", "Local hw"],
        ["19", "M4 bolts + nuts", "~10mm, motor mount", "2", "Rs 2 ea", "Local hw"],
        ["20", "M2 grub/set screw", "3-4mm (comb, optional)", "1", "Rs 2", "Local hw"],
    ], col_widths=W))

# F
story.append(Paragraph("F. Wire / Solder Supplies", h1))
story.append(make_table(
    ["#", "Item", "Specs", "Qty", "Price", "Source"],
    [
        ["21", "Hookup wire (stranded)", "22-26 AWG, 6 colors", "6 rolls", "Rs 30/rl", "Local"],
        ["22", "Heat shrink tubing", "Assorted 1-3mm", "1 pack", "Rs 30", "Local"],
        ["23", "Solder wire", "60/40, 0.5-0.8mm", "1 roll", "Rs 80", "Local"],
        ["24", "Flux paste", "For SMD soldering", "1", "Rs 50", "Local"],
        ["25", "Superglue (CA)", "Balls onto nubs", "1 tube", "Rs 20", "Local"],
        ["26", "Silicone grease", "Linkage feet on cam", "1 tube", "Rs 40", "Local"],
    ], col_widths=W))

story.append(Spacer(1, 6*mm))

# COST SUMMARY
story.append(Paragraph("Cost Summary (1 Pod + 1 Cell)", h1))
story.append(make_table(
    ["Category", "Cost"],
    [
        ["Brain Pod electronics", "Rs 420"],
        ["Cell mechanical", "Rs 140"],
        ["Cell electronics (Pro Mini)", "Rs 160"],
        ["Connectors + magnets", "Rs 125"],
        ["Hardware/fasteners", "Rs 30"],
        ["Wire/solder/glue", "Rs 250"],
        ["TOTAL (excl. tools + printing)", "Rs ~1,125"],
    ], col_widths=[220, 80]))

story.append(PageBreak())

# QUICK COUNTER LIST
story.append(Paragraph("Quick Counter List (show at shop)", h1))
story.append(Spacer(1, 3*mm))
items = [
    "ESP32 DevKit V1 (30-pin) x1",
    "28BYJ-48 stepper motor x1",
    "Arduino Pro Mini 5V/16MHz x1",
    "ULN2003 driver board x1",
    "SS49E Hall sensor x1",
    "5V/3A adapter + owned inline female barrel pigtail x1",
    "6x6x5mm tactile switch x3",
    "4-pin pogo connector pair x2",
    "3x1mm homing magnet x1; 8x1mm docking magnets x10 owned",
    "2mm stainless steel bearing balls x6",
    "Micro springs (OD 4mm, length 5mm) x6",
    "Female header 1x15 x2",
    "Male header 40-pin strip x2 (cut to size)",
    "JST XH 5-pin connector x1",
    "Resistors: 4.7k x4, 10k x2",
    "Capacitors: 22pF x2, 100nF x2, 100uF/10V x1",
    "16MHz crystal x1",
    "M2.5x25 bolts x4",
    "M2x8 screws x2 (pod lid); M2x6 x4 only for deferred board",
    "M4x5 thread-forming screws x2; no nuts/x6/x10",
    "Hookup wire (Red, Black, Blue, Yellow, Green, White)",
    "Heat shrink tubing assorted",
    "Solder wire + flux paste",
    "Superglue + silicone grease",
]
for item in items:
    story.append(Paragraph("[ ]  " + item, normal))
    story.append(Spacer(1, 1.5*mm))

story.append(Spacer(1, 8*mm))
story.append(Paragraph("<b>Tip:</b> Take calipers to measure the 28BYJ-48 shaft at the shop!", bold_style))
story.append(Spacer(1, 2*mm))
story.append(Paragraph("Pogo connectors + bearing balls may need online order (Amazon/Robocraze).", small))

doc.build(story)
print("PDF saved to D:/TIET/Capstone/docs/SHOPPING_LIST.pdf")
