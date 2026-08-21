const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle
} = require('docx');

const HEADBG = "1B3A6B";
const SECTBG = "DCE3EC";
const ALTROW = "F4F6F9";
const TOTBG  = "C9D4E2";

const CW = [780, 4820, 1700, 1700];          // sum 9000
const TABLE_WIDTH = CW.reduce((a, b) => a + b, 0);

const B = () => ({
  top:    { style: BorderStyle.SINGLE, size: 4, color: "8A98A8" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "8A98A8" },
  left:   { style: BorderStyle.SINGLE, size: 4, color: "8A98A8" },
  right:  { style: BorderStyle.SINGLE, size: 4, color: "8A98A8" },
});

const P = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.LEFT,
  spacing: { before: 0, after: 0 },
  children: [new TextRun({
    text: String(text), bold: !!o.bold, italics: !!o.italics,
    color: o.color || "000000", size: o.size || 19,
  })],
});

const cellOf = (text, w, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  columnSpan: o.span,
  shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill } : undefined,
  borders: B(),
  margins: { top: o.pad || 65, bottom: o.pad || 65, left: 100, right: 100 },
  children: [P(text, o)],
});

// ---- data: ["S", section] or ["I", item, qty, cost] ----
const DATA = [
  ["S", "A.  BRAIN POD ELECTRONICS  (2 units)"],
  ["I", "ESP32 DevKit V1 (USB-C, 30-pin)", "2", 700],
  ["I", "5 V / 3 A Power Adapter with DC Barrel Jack", "2 sets  (+1 spare jack)", 440],
  ["I", "USB-C Data Cable", "2", 250],
  ["I", "Pod Interface Parts - tactile navigation buttons, female header strips", "1 set", 120],

  ["S", "B.  BRAILLE CELL ELECTRONICS  (2 cells + spares)"],
  ["I", "28BYJ-48 Stepper Motor with ULN2003 Driver Board", "3  (2 + 1 spare)", 480],
  ["I", "Hall Effect Sensor Module (MH-Sensor-Series)", "3  (2 + 1 spare)", 150],
  ["I", "Neodymium Magnets - homing (3 x 1 mm) and docking (8 x 1 mm)", "20", 255],

  ["S", "C.  PROTOTYPING HARDWARE"],
  ["I", "Breadboard, 830 tie-point", "2", 200],
  ["I", "Wiring Set - Dupont jumpers, hookup wire, screw terminal blocks", "1 set", 260],

  ["S", "D.  FASTENERS AND SPRINGS"],
  ["I", "Machine Screws - M2.5 x 25 mm, M4 x 10 mm, M2.5 x 8 mm", "26  (8 used)", 220],
  ["I", "Brass Heat-Set Insert Kit (M2 / M2.5 / M3)", "1 kit", 300],
  ["I", "Micro Compression Springs, 2 mm OD (assortment kit)", "1 kit  (12 used)", 450],

  ["S", "E.  3D PRINTING MATERIALS"],
  ["I", "PETG Filament, 1 kg Spool (enclosure and plates)", "1", 850],
  ["I", "Resin Parts - outsourced SLA print order", "1 order", 900],
  ["I", "Failed Print / Reprint Material Allowance", "-", 600],

  ["S", "F.  TOOLS AND CONSUMABLES"],
  ["I", "Soldering Station, 60 W, Temperature-Controlled", "1", 600],
  ["I", "Soldering Accessories - solder wire, flux, spare tips, tip cleaner, desoldering pump", "1 set", 510],
  ["I", "Digital Multimeter", "1", 450],
  ["I", "Digital Vernier Calipers, 150 mm", "1", 450],
  ["I", "Hand Tools - wire stripper, precision tweezers, drill bits", "1 set", 360],
  ["I", "Hot Glue Gun with Glue Sticks", "1", 200],
  ["I", "Assembly Consumables - super glue, heat-shrink tubing, insulation tape, silicone grease", "1 set", 300],

  ["S", "G.  CONTINGENCY AND LOGISTICS"],
  ["I", "Component Failure Replacement Reserve", "-", 500],
  ["I", "Shipping and Delivery Charges (online orders)", "-", 350],
];

const rows = [];
rows.push(new TableRow({
  tableHeader: true,
  children: [
    cellOf("S. No.",        CW[0], { fill: HEADBG, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, pad: 80, size: 20 }),
    cellOf("Item",          CW[1], { fill: HEADBG, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, pad: 80, size: 20 }),
    cellOf("Quantity",      CW[2], { fill: HEADBG, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, pad: 80, size: 20 }),
    cellOf("Cost (Rupees)", CW[3], { fill: HEADBG, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, pad: 80, size: 20 }),
  ],
}));

let n = 0, alt = false;
const sectionTotals = [];
let curSection = null, curSum = 0;

for (const d of DATA) {
  if (d[0] === "S") {
    if (curSection) sectionTotals.push([curSection, curSum]);
    curSection = d[1]; curSum = 0; alt = false;
    rows.push(new TableRow({
      children: [cellOf(d[1], TABLE_WIDTH, { span: 4, fill: SECTBG, bold: true, size: 19, pad: 70, color: "13294B" })],
    }));
  } else {
    n++; curSum += d[3];
    const f = alt ? ALTROW : undefined; alt = !alt;
    rows.push(new TableRow({
      children: [
        cellOf(n,    CW[0], { fill: f, align: AlignmentType.CENTER }),
        cellOf(d[1], CW[1], { fill: f }),
        cellOf(d[2], CW[2], { fill: f, align: AlignmentType.CENTER }),
        cellOf(d[3].toLocaleString('en-IN'), CW[3], { fill: f, align: AlignmentType.CENTER }),
      ],
    }));
  }
}
if (curSection) sectionTotals.push([curSection, curSum]);

const TOTAL = sectionTotals.reduce((s, x) => s + x[1], 0);
const BUDGET = 10000;
const RESERVE = sectionTotals[sectionTotals.length - 1][1];

rows.push(new TableRow({
  children: [
    cellOf("TOTAL", CW[0] + CW[1] + CW[2], { span: 3, fill: TOTBG, bold: true, align: AlignmentType.RIGHT, pad: 80, size: 20 }),
    cellOf(TOTAL.toLocaleString('en-IN'), CW[3], { fill: TOTBG, bold: true, align: AlignmentType.CENTER, pad: 80, size: 20 }),
  ],
}));

const mainTable = new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: CW, rows });

// ---- summary table ----
const SW = [5600, 3400];
const sumRows = [new TableRow({
  tableHeader: true,
  children: [
    cellOf("Category", SW[0], { fill: HEADBG, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, pad: 80, size: 20 }),
    cellOf("Amount (Rupees)", SW[1], { fill: HEADBG, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, pad: 80, size: 20 }),
  ],
})];
sectionTotals.forEach(([name, amt], i) => {
  const f = i % 2 ? ALTROW : undefined;
  sumRows.push(new TableRow({
    children: [
      cellOf(name.replace(/\s+/g, ' '), SW[0], { fill: f }),
      cellOf(amt.toLocaleString('en-IN'), SW[1], { fill: f, align: AlignmentType.CENTER }),
    ],
  }));
});
sumRows.push(new TableRow({
  children: [
    cellOf("Total Project Cost", SW[0], { fill: TOTBG, bold: true }),
    cellOf(TOTAL.toLocaleString('en-IN'), SW[1], { fill: TOTBG, bold: true, align: AlignmentType.CENTER }),
  ],
}));
sumRows.push(new TableRow({
  children: [
    cellOf("Sanctioned Budget", SW[0], { bold: true }),
    cellOf(BUDGET.toLocaleString('en-IN'), SW[1], { bold: true, align: AlignmentType.CENTER }),
  ],
}));
sumRows.push(new TableRow({
  children: [
    cellOf("Balance Remaining", SW[0], { bold: true, color: "1B7F4B" }),
    cellOf((BUDGET - TOTAL).toLocaleString('en-IN'), SW[1], { bold: true, color: "1B7F4B", align: AlignmentType.CENTER }),
  ],
}));

const sumTable = new Table({ width: { size: 9000, type: WidthType.DXA }, columnWidths: SW, rows: sumRows });

const note = (t) => new Paragraph({
  spacing: { before: 90, after: 0 },
  children: [new TextRun({ text: t, size: 17, color: "444444" })],
});

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 220 },
        children: [new TextRun({ text: "Table 1: Cost Analysis", bold: true, italics: true, size: 22 })],
      }),
      mainTable,
      new Paragraph({
        spacing: { before: 420, after: 200 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Table 2: Cost Summary by Category", bold: true, italics: true, size: 22 })],
      }),
      sumTable,
      new Paragraph({ spacing: { before: 340 }, children: [new TextRun({ text: "Notes", bold: true, size: 19 })] }),
      note("1.  Costs are realistic Indian-market estimates (Amazon.in, Robu.in, and the local electronics market). Actual invoiced amounts may vary by supplier."),
      note("2.  The configuration priced is two Brain Pods and two Braille Cells. The system architecture uses one Brain Pod as the master controller; the second unit is held as a spare, so that a failure of the controller does not stop the demonstration. Quantities in Sections A and B follow from that configuration."),
      note("3.  Spare units are included for the components most likely to fail in a prototype: the stepper motor with its driver board, the Hall effect sensor, and the DC barrel jack. Fasteners and springs are purchased as kits, so surplus is inherent."),
      note("4.  Section E covers 3D printing consumables. The reprint allowance reflects material lost to failed prints, which were observed during the first PETG enclosure trials."),
      note("5.  Section G reserves funds for components damaged during assembly and for delivery charges on online orders. This reserve is included within the total, not additional to it."),
      note("6.  Committed expenditure, excluding the Section G reserve, is Rs. " + (TOTAL - RESERVE).toLocaleString('en-IN') + "."),
    ],
  }],
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync("Braillix_Cost_Analysis.docx", b);
  console.log("items:", n, "TOTAL:", TOTAL, "balance:", BUDGET - TOTAL, "committed:", TOTAL - RESERVE);
  sectionTotals.forEach(([s, a]) => console.log("   ", String(a).padStart(5), s));
});
