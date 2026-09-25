> # [!] SUPERSEDED — DO NOT BUY FROM THIS LIST
>
> **Use `docs/MASTER_BOM.md` instead.** This file is kept only for history.
>
> At least two entries here are now WRONG and would waste money:
> * **4mm pen-style springs** — ruled out permanently in v7.1. Braille rows are 2.6mm apart,
>   so a 4mm spring fouls its neighbour. You need **2mm OD micro springs**.
> * **2mm bearing balls** — no longer needed at all since v7.1. The braille dot is printed
>   as a dome on the linkage itself; there is nothing to glue a ball onto.

# Braillix v5.1 — Complete Electronics & Hardware Shopping List

**Assuming: 1 Brain Pod + 1 Cell (prototype). Multiply cell items by N for more cells.**

---

## A. ESP32 BRAIN POD

| # | Item | Specs | Qty | Est. Price | Source |
|---|---|---|---|---|---|
| 1 | ESP32 DevKit V1-compatible (30-pin) | WiFi+BT, **USB-C; use the owned board** | 1 | Already owned | — |
| 2 | Female header strip 1x15 | 2.54mm pitch, through-hole | 2 | Rs 10 each | Local / Robocraze |
| 3 | 5.5x2.1mm inline female barrel pigtail | Use the owned cable; not a panel-mount jack | 1 | Already owned | — |
| 4 | 5V 3A DC adapter | 5.5x2.1mm barrel plug, regulated | 1 | Rs 200 | Local / Amazon |
| 5 | 6x6x5mm tactile push switch | 4-pin DIP, momentary | 3 | Rs 5 each | Robocraze / LCSC |
| 6 | 4.7k ohm resistor (1/4W) | Through-hole or 0805 SMD | 2 | Rs 1 each | Local |
| 7 | Piezo buzzer (optional) | 5V, 12mm | 1 | Rs 15 | Local |

**Pod subtotal: ~Rs 420**

---

## B. PER CELL — Motor + Mechanical

| # | Item | Specs | Qty/cell | Est. Price | Source |
|---|---|---|---|---|---|
| 8 | 28BYJ-48 stepper motor | 5V DC, 4-phase, 64:1 gearbox | 1 | Rs 80 | Robocraze |
| 9 | SS49E Hall effect sensor | Linear, SIP-3, 3-6V | 1 | Rs 25 | Robocraze / LCSC |
| 10 | 3x1mm NeFeB disc magnet | Neodymium, for cam homing | 1 | Rs 5 | Local / AliExpress |
| 11 | 2mm stainless steel bearing balls | For braille dot caps | 6 | Rs 2 each | Local hardware / Amazon |
| 12 | Micro compression spring | OD 4-4.5mm, length 5-6mm | 6 | Rs 3 each | Local hardware |

**Per-cell mechanical subtotal: ~Rs 140**

---

## C. PER CELL — Muscle Board PCB Components

**Option A: Get PCBs fabricated (recommended)**
| # | Item | Qty/cell | Est. Price |
|---|---|---|---|
| 13 | Muscle board PCB (34x44mm, 2-layer) | 1 | Rs 35 (JLCPCB, 5pc MOQ) |

**Option B: Use breadboard/perfboard for prototype**
| # | Item | Qty/cell | Est. Price |
|---|---|---|---|
| 13b | Arduino Pro Mini 5V/16MHz | 1 | Rs 120 |
| 13c | ULN2003 driver board (module) | 1 | Rs 40 |
*Skip to section D if using Option B*

**If fabricating PCBs, you need these SMD components per board:**
| # | Item | Package | Qty/board | Est. Price | LCSC Part |
|---|---|---|---|---|---|
| 14 | ATmega328P-AU | TQFP-32 | 1 | Rs 210 | C14877 |
| 15 | ULN2003A | SOIC-16 | 1 | Rs 25 | C7386 |
| 16 | 16MHz crystal | HC49-4H | 1 | Rs 12 | C32346 |
| 17 | 22pF capacitor | 0402 | 2 | Rs 1 each | Generic |
| 18 | 100nF capacitor | 0402 | 2 | Rs 1 each | Generic |
| 19 | 100uF/10V electrolytic | SMD 5x5.3mm | 1 | Rs 12 | C131307 |
| 20 | 10k ohm resistor | 0402 | 2 | Rs 1 each | Generic |
| 21 | 4.7k ohm resistor | 0402 | 2 | Rs 1 each | Generic |
| 22 | SS14 Schottky diode | SMA | 1 | Rs 4 | C2480 |
| 23 | 1x04 pin header | 2.54mm | 1 | Rs 3 | Cut from strip |
| 24 | JST XH 5-pin connector | B5B-XH-A | 1 | Rs 8 | C2316 |
| 25 | 1x03 pin header | 2.54mm | 1 | Rs 2 | Cut from strip |
| 26 | 2x03 pin header (ISP) | 2.54mm | 1 | Rs 3 | Cut from strip |

**Per-cell PCB subtotal: ~Rs 320 (custom) or Rs 160 (Pro Mini + ULN2003 module)**

---

## D. DAISY-CHAIN / CONNECTORS

| # | Item | Specs | Qty | Est. Price | Source |
|---|---|---|---|---|---|
| 27 | 4-pin pogo connector (spring+pad pair) | 2mm pitch, spring-loaded | N+1 pairs | Rs 40/pair | LCSC / AliExpress |
| 28 | 8x1mm NeFeB disc magnets (docking) | 2 per docking face; 10 owned covers pod + two cells | 10 | Already owned | — |

**Count your magnets carefully:**
- Each cell: 3 on -X face + 3 on +X face = **6 per cell**
- Pod: 3 on +X dock face = **3 for pod**
- Total for 1 pod + N cells: **3 + 6N magnets**
- For 1 pod + 1 cell prototype: **9 magnets**

---

## E. HARDWARE / FASTENERS

| # | Item | Specs | Qty | Est. Price | Source |
|---|---|---|---|---|---|
| 29 | M2.5 x 25mm bolts | Pan head or socket head | 4 per cell | Rs 2 each | Local hardware |
| 30 | M2 x 6mm screws | Pan head | 4/cell (board) + 2 (pod lid) | Rs 1 each | Local hardware |
| 31 | M4 bolts + nuts | ~10mm, for motor mounting | 2 per cell | Rs 2 each | Local hardware |
| 32 | M2 grub/set screw | 3-4mm long (if using comb later) | 1 per cell | Rs 2 | Local hardware |

---

## F. WIRE / SOLDER SUPPLIES

| # | Item | Specs | Qty | Est. Price | Source |
|---|---|---|---|---|---|
| 33 | Hookup wire (stranded) | 22-26 AWG, multiple colors | 1 roll each: Red, Black, Blue, Yellow, Green, White | Rs 30/roll | Local |
| 34 | Heat shrink tubing | Assorted 1-3mm | 1 pack | Rs 30 | Local |
| 35 | Solder wire | 60/40 or lead-free, 0.5-0.8mm | 1 roll | Rs 80 | Local |
| 36 | Flux paste | For SMD soldering | 1 syringe | Rs 50 | Local |
| 37 | Superglue (CA) | For bearing balls onto linkage nubs | 1 tube | Rs 20 | Local |
| 38 | Silicone grease | For linkage feet on cam tracks | 1 small tube | Rs 40 | Local |

---

## G. TOOLS (if you don't have them)

| # | Item | Why | Est. Price |
|---|---|---|---|
| 39 | Soldering iron (temp-controlled) | SMD + through-hole | Rs 500+ |
| 40 | AVR ISP programmer (USBasp) | To flash ATmega328P bootloader | Rs 150 |
| 41 | Multimeter | Continuity, voltage checks | Rs 200+ |
| 42 | Wire stripper | 22-26 AWG | Rs 100 |
| 43 | Small file set | Trim motor shaft to 4mm | Rs 80 |
| 44 | Tweezers (fine tip) | SMD placement + spring insertion | Rs 50 |
| 45 | Calipers (digital) | Measure shaft, pin pitch, etc. | Rs 300 |

---

## COST SUMMARY (1 Pod + 1 Cell prototype)

| Category | Cost |
|---|---|
| Brain Pod electronics | Rs 420 |
| Cell mechanical | Rs 140 |
| Cell electronics (Pro Mini route) | Rs 160 |
| Connectors + magnets | Rs 85 |
| Hardware/fasteners | Rs 30 |
| Wire/solder/glue | Rs 250 |
| **TOTAL (excluding tools + 3D printing)** | **~Rs 1,085** |

For 5 cells + 1 pod: ~Rs 2,500 (well under 15,000 INR budget)

---

## QUICK SHOP LIST (just the names, for the counter)

```
ESP32 DevKit V1 (30-pin) x1
28BYJ-48 stepper motor x1
Arduino Pro Mini 5V/16MHz x1 (or ATmega328P-AU if doing custom PCB)
ULN2003 driver board x1 (or ULN2003A SOIC-16 if custom PCB)
SS49E Hall sensor x1
5V 3A DC adapter with barrel jack x1
Panel-mount barrel jack 5.5x2.1mm x1
6x6x5mm tactile switch x3
4-pin pogo connector pair x2
3x1mm homing magnet x1; 8x1mm docking magnets x10 already owned
2mm bearing balls x6
Micro compression springs (OD 4mm, 5mm long) x6
Female header strip 1x15 x2
Male header strip 40-pin x2 (cut to size)
JST XH 5-pin connector x1
Resistors: 4.7k x4, 10k x2
22pF capacitor x2, 100nF x2, 100uF/10V x1
SS14 Schottky diode x1
16MHz crystal x1
M2.5x25 bolts x4
M2x8 screws x2 (pod lid); M2x6 x4 only if the deferred muscle board is built
M4x5 thread-forming screws x2; no nuts, no M4x6/x10
Hookup wire (Red, Black, Blue, Yellow, Green, White)
Heat shrink assorted
Solder wire
Superglue
Silicone grease
```
