# Braillix — Electronics BOM (HAVE on top, BUY at bottom)
> Written 2026-07-30. Companion to `docs/MASTER_BOM.md` (which also covers mechanical parts).
> Scope: **one working single-cell demo.** Multi-cell/production parts are listed separately
> at the end so they are not confused with what you need now.

---

## The headline: you need NO chips, NO resistors, NO capacitors

Every discrete component the circuit would normally need is **already built into the modules
you own**:

| What you'd normally add | Why you don't need it |
|---|---|
| Motor flyback diodes | **Built into the ULN2003A.** The chip has internal freewheeling diodes on its COM pin — that is what COM is for. |
| Motor driver transistors | **That IS the ULN2003.** Seven Darlington pairs, 500mA each. You need four. |
| Button pull-up resistors | ESP32 has **internal** pull-ups. Firmware uses `INPUT_PULLUP`. |
| Hall sensor pull-up / comparator | **On the blue MH module already** (that's the second IC and the trimmer pot). |
| Voltage regulator + decoupling caps | **On the ESP32 DevKit already** (AMS1117 + caps). |
| Reverse-polarity protection | ⚠️ **NOT present** in the circuit. Mitigated by measurement: the owned jack was tested and is correct. Measure any new connector before trusting it. |

**Total passives to buy for the demo: zero.**

---

# PART 1 — WHAT YOU ALREADY HAVE
*Cross-check each of these physically. The "how to identify it" column is so you can confirm
you actually have the right thing.*

| # | Component | How to identify it | Qty | Status |
|---|---|---|---|---|
| 1 | **ESP32 DevKit (USB-C)** | Black PCB ~51×28mm, silver square shield, USB-C at one end, 15 pins per side, BOOT + EN buttons | 1 | ✅ HAVE (₹350) |
| 2 | **28BYJ-48 stepper motor** | Silver can ~28mm dia, blue plastic base, 5 coloured wires into a white plug | 1 | ✅ HAVE (₹160 w/ driver) |
| 3 | **ULN2003 driver board** | Small **blue** PCB, 4 red LEDs, white 5-pin socket, black 16-pin chip, IN1–IN4 + `+`/`-` pins | 1 | ✅ HAVE — **this is your motor driver, no chip to buy** |
| 4 | **Hall sensor module (MH-Sensor-Series)** | Small **blue** PCB, tiny black 3-pin sensor on one edge, blue trimmer pot, 1–2 LEDs, pins marked **AO DO GND VCC** | 1 | ✅ HAVE (₹50) — ⚠️ **must use AO (analog)**, and the pocket won't fit it (see note) |
| 5 | **5V / 3A power adapter** | Wall plug, barrel connector on the lead, "5V 3A" on the label | 1 | ✅ HAVE (₹160 w/ jack) |
| 6 | **Inline female DC pigtail jack** | Black cylindrical barrel socket with red/black wires; no thread or nut | 1 | ✅ HAVE / CURRENT POD CHOICE; body stays outside, leads pass through the selected lid slot, internal tie post carries pull load. ✅ Polarity measured correct 2026-08-01 (red = +). |
| 6b | **5.5×2.1mm female panel-mount jack** | Threaded neck plus retaining nut | 0 | ⛔ NOT REQUIRED for the current inline-pigtail revision |
| 7 | **Connecting wire (2m)** | Loose hookup wire | 2m | ✅ HAVE (₹20) |
| 8 | **Dupont jumper wires** | Ribbon of coloured wires with plastic pin housings | some | ✅ HAVE — need ~8× M-F and ~5× M-M |
| 9 | **Neodymium magnets 8×1mm** | Small silver discs, strongly attract each other | 10 | ✅ HAVE (₹135) — for docking, **not** for cam homing |
| 10 | **Tactile switches 6×6×5mm** | Tiny square black buttons, 4 legs | 3 | ✅ HAVE — not needed for the demo |
| 11 | **Digital multimeter** | Handheld meter with DC volts | 1 | ✅ HAVE (bought 2026-08-01) — jack polarity measured and CONFIRMED correct |

### Notes on things you already have

**#6 — ✅ polarity is VERIFIED CORRECT (2026-08-01).** Measured with the multimeter: **red = positive.**
This retires the single largest risk to the ESP32. Mark the positive wire physically (nail polish,
marker, tag) so the information cannot be lost at the bench.
There is still no reverse-polarity protection in the circuit, so if this connector is ever replaced, the replacement must be
measured the same way before it is trusted.

**#4 — your whole Hall module does not fit the base plate.** v7.5 rebuilt an underside pocket for
the *bare* TO-92 sensor only; the blue PCB is still far too large. M11b measures 1.6mm and the
current recess is exactly 1.6mm, so dry-fit it before gluing. **For the demo this does not matter**
— the module sits on the breadboard. For final assembly, desolder the bare 3-pin sensor from the
module and run three wires back to it.

---

# PART 2 — WHAT YOU NEED TO BUY

## 2A. For the demo (buy this week)

| # | Component | Spec | Why | Est. ₹ |
|---|---|---|---|---|
| 1 | **Soldering station, 60W, TEMPERATURE-CONTROLLED** | "936" type, ceramic heater, 2.4mm chisel tip | 🔴 **NOT OWNED.** ⚠️ Do NOT buy a plain ₹200 pencil iron — uncontrolled heat burns the flux off and makes soldering feel impossible. See `ELECTRONICS_PLAN.md` Part 9. | ~1,300 |
| 2 | **Breadboard** | Half-size or full-size, 400–830 tie points | The whole Tier-0 demo is breadboard-based, and it's the safe way to bring up wiring before soldering. | ~100 |
| 3 | **USB-C cable (DATA)** | Must carry data, not charge-only | To flash the ESP32. Charge-only cables look identical and fail silently. **Test the one you have first — you may already be fine.** | ~150 |
| 4 | **Solder wire** | **0.8mm, 60/40 rosin core** | For soldering wires flat to the ULN2003. Not plumbing solder. | ~150 |
| 5 | **Wire stripper / cutter** | Small, for 22–26 AWG | Prepping wire ends. | ~200 |

**Demo subtotal: ~₹1,900** (or ~₹1,750 if your existing USB-C cable does data).
The soldering station is the bulk of it and is the one genuinely missing tool.

## 2B. For the mechanism (buy when the resin parts arrive)

| # | Component | Spec | Qty | Est. ₹ |
|---|---|---|---|---|
| 6 | **Micro compression springs** | **2.0mm OD**, ~0.3mm stainless wire, ~4mm free length. Buy an assortment kit. 🔴 Pen springs (4mm) **cannot** work — braille rows are 2.6mm apart. | 6 + spares | ~500 |
| 7 | **Homing magnet** | 🔴 **3mm dia × 1mm thick** neodymium — **CHANGED from 3×2mm in v7.5.** The cam disc floor is only 2mm, so a 2mm magnet's pocket cut clean through it and punched a hole across three cam tracks. 1mm leaves 0.8mm of floor and couples just as well. Your 8×1mm ones are too wide. | 1 (buy 10) | ~120 |
| 8 | **M2.5 × 25mm bolts** | Top plate → standoffs → box bosses | 4 | ~60 |
| 9 | **M4 × 5mm or 6mm thread-forming screws** | Candidate range for the approved raised-stack design. Select the pilot with `base_interface_coupon`; measure the real ear and screw point; require ≥0.5mm clearance below the cam. **Never use M4×10.** No nuts. | 2 | ~30 |
| 10 | **M2 × 8mm self-tap** | Pod lid. **NOT M2×6** — through a 4mm lid that leaves only 2mm of thread. | 2 | ~40 |
| 11 | **Superglue or 5-min epoxy** | Glues the resin dot insert into the PETG plate. Epoxy preferred — you get time to seat it square. | 1 | ~80 |
| 12 | **Digital calipers** | 150mm digital | Already in hand; M5, M11b, and M21 recorded on 2026-07-31. | 1 | already owned |

**Mechanism subtotal: ~₹1,430**

## 2C. Optional / nice to have

| Component | Why | Est. ₹ |
|---|---|---|
| **Hot glue gun + sticks** | ⭐ Strain relief on every joint. **Reworkable** — this is why it beats epoxy while the pin map can still change. See `ELECTRONICS_PLAN.md` Part 12. | ~250 |
| **Neutral-cure RTV silicone** | Optional upgrade over hot glue for vibration. 🔴 Must say **neutral cure** — the vinegar-smelling acetic kind corrodes copper. | ~150 |
| Flux paste | Makes soldering to ULN2003 pins much easier for a beginner | ~100 |
| Helping-hands / third hand | Not really optional — you cannot hold iron, solder and two wires with two hands | ~200 |
| Brass wool tip cleaner | Better than the wet sponge; keeps the tip alive | ~100 |
| Heat-shrink tubing | Insulating soldered joints | ~80 |
| Tweezers | Handling 2mm springs and 1mm linkages — genuinely hard without | ~80 |
| Desoldering pump/wick | Fixing bridges; also for lifting the TO-92 off the hall module | ~120 |
| Small drill bits 1.5/1.7/2.5mm | FDM holes print 0.2–0.3mm undersize | ~150 |
| Electrical tape | — | ~30 |

## 2D. Cost of each ADDITIONAL cell (the scaling claim, priced)

You are building two. This is what a third, fourth or eighth costs — no custom parts at any
point. Full architecture in `ELECTRONICS_PLAN.md` Part 5.

| Per extra cell | Est. ₹ |
|---|---|
| 28BYJ-48 motor + ULN2003 board | ~160 |
| Hall sensor module | ~50 |
| **MCP23017 expander (DIP-28)** + 3 address jumpers | ~90 |
| Wire, connector, heat-shrink | ~50 |
| **Total per cell** | **~₹350** |

**One-off, only when you go past 2 cells:** 2× 4.7kΩ pull-ups (~₹5, brain end only).
**One-off, only past 16 cells:** TCA9548A I²C mux (~₹120).

⚠️ Cells 1 and 2 run **direct-GPIO** and need no expander at all — but building both muscle
boards with the expander anyway is what makes the N-cell claim demonstrable rather than
theoretical.

---

## Totals

| | ₹ |
|---|---|
| Already spent (incl. multimeter) | ~1,435 |
| Demo essentials (2A) | ~1,900 |
| Mechanism (2B) | ~1,430 |
| Optional (2C) | ~960 |
| **Everything** | **~5,725 of ₹15,000** |
| *each cell beyond the 2nd (2D)* | *~350* |

**The breadboard demo needs NO soldering at all** — only the breadboard and a data cable
(~₹250). The soldering station is required to *assemble* a cell, not to demonstrate one.

---

# PART 3 — NOT NEEDED (so you don't buy it by mistake)

| Item | Verdict |
|---|---|
| **Any motor driver IC** | ❌ You own it. The chip on the blue board **is** the ULN2003A. |
| **ATmega328P / custom muscle board** | ❌ Never. Multi-cell is solved by an **MCP23017 per brick** (DIP-28, hand-solderable, ~₹80) — see `ELECTRONICS_PLAN.md` Part 5. TQFP-32 at 0.8mm pitch is beyond basic soldering and would need PCBA ordering. |
| **Resistors** | ❌ None for one or two cells. *(From 3 cells: exactly 2× 4.7kΩ I²C pull-ups, **at the brain end only, once, ever** — repeating them per brick kills the bus.)* |
| **Capacitors** | ❌ None **while the ESP32 runs off USB** with the motor on the adapter — both modules and the DevKit carry their own. ⚠️ **One exception:** if you power the ESP32 from the adapter's `VIN` so it shares the motor's rail, keep a **470µF–1000µF electrolytic** on hand against brown-out resets. See `BUILD_PACK.md` 3.2. |
| **Flyback diodes** | ❌ Built into the ULN2003A (that's what COM does). |
| **Level shifters** | ❌ Not needed — hall runs on 3V3, so GPIO34 never sees 5V. |
| **2mm bearing balls** | ❌ Obsolete since v7.1 — the dot is printed as a dome. |
| **Pogo pin connectors** | ⏸️ Deferred. Do not buy from the CAD window alone. Future contacts need >=1A continuous at working compression (prefer 2-3A for power) and a flush measured carrier; the four-wire bus also needs a per-cell 3.3V expander interface. |
| **Crystal / oscillator** | ❌ ESP32 and the modules have their own. |

---

## If you ever DO build the custom muscle board

Not needed now, but for the record — it's `pcb/braillix_muscle_board.kicad_pcb`, 34×44mm:

| Part | Package | Note |
|---|---|---|
| ATmega328P-AU | **TQFP-32, 7×7mm square** | 0.8mm pitch — **not hand-solderable at your level** |
| ULN2003A | **SOIC-16 rectangle** | Same chip you already own, just SMD |
| 16MHz crystal | HC49 | |
| 2× 22pF, 2× 100nF | 0402 | Tiny — 1.0 × 0.5mm |
| 100µF/10V | SMD electrolytic | |
| 10kΩ ×2, 4.7kΩ ×2 | 0402 | |
| SS14 Schottky | SMA | ⬅️ *this* is the reverse-polarity protection the prototype lacks |

**Recommendation: order it fully assembled (PCBA) or don't build it.** 0402 passives and a
TQFP-32 are not a beginner job, and none of it is needed for a working demo.
