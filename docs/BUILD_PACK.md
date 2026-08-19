# Braillix — Build Pack

> **CURRENT RELEASE GATE - 2026-08-19:** This pack predates the full print-readiness audit. Do not
> permanently assemble or print production cam/base/top/enclosure/pod parts from its older status
> claims. Current authority is `PRINT_RELEASE_2026-08-19.md`, `PRINT_DAY_MONDAY.md`, and
> `MECHANISM_BENCH_TEST.md`. Only the checked G-code folder is released; the full product is NO-GO.

**Written 2026-08-15. For the 24 August evaluation.**
Scope: **electronics, assembly and sourcing.** Mechanical/CAD issues are *flagged* here and
fixed in the CAD fork, never here.

This is the single document to work from at the bench. It answers, in order:
what to present on 24 August, what can be permanently assembled now, what goes in which box,
how every wire connects, why each part exists, and exactly what is still to be ordered.

---

# PART 0 — The 24 August plan

## The upper linkages are not on the critical path

The six linkages are the hardest parts in the project and they are giving trouble. **Do not
let them decide whether you have a demo.** Nothing in the electronics or the actuation chain
depends on them existing.

Split the project the way an evaluator will accept:

| Layer | State on 24 Aug | How it is shown |
|---|---|---|
| Encoding — 64 states, 6 dots | ✅ Solved, provable | Simulator + the 64-state table |
| Actuation — motor, cam, homing | 🔴 **HOLD** | Current cam socket cannot install; use the coupon/bench fixture only |
| Control — ESP32, WiFi dashboard | ✅ **Buildable now** | **Phone browser, live** |
| Transmission — linkages to dots | 🟠 In progress | Simulator, plus one linkage held by hand |

**Three of four layers are real hardware.** That is a legitimate mid-project result, and it is
far stronger than a fully-assembled unit that does not move.

## What the demo actually looks like

```
   [ Phone ] --wifi--> [ ESP32 ] --> [ ULN2003 ] --> [ 28BYJ-48 ] --> [ CAM DISC ]
   type "h"            picks state    switches         turns 5.625deg     visibly
                       17 of 64       the coils        per state          rotates
                                          ^
                                     [ HALL SENSOR ] finds home on power-up

   Projected beside it: the 3D simulator, showing the SAME state number
   driving the six dots up and down.
```

**Say this out loud to the panel:** the cam is an absolute 6-bit rotary encoder; the hardware
proves it reaches every one of 64 positions repeatably; the simulator proves each position
lifts the correct dots. **The linkage is the assembly step in progress.** That framing is
honest and it is the actual engineering status.

⚠️ **Do not promise raised dots on 24 August.** If the linkages come good before then, it is a
bonus you add. Building the demo around them is how you end up with nothing.

---

# PART 1 — What is safe to make PERMANENT right now

You have the iron. The question is what you can commit to without regretting it.

| # | Job | Permanent? | Verdict |
|---|---|---|---|
| 1 | Header pins onto the DC jack's bare wires | Yes | ✅ **Do it.** The jack's job never changes. |
| 2 | Wires soldered **flat** to ULN2003 `IN1`–`IN4` + power | Yes | ✅ **Do it.** Required by the 14mm pocket, and the ULN2003 end of those wires is fixed no matter which GPIO the other end lands on. |
| 3 | The power spine (one 5V source, three branches) | Yes | ✅ **Do it.** Wire it with a screw terminal block if you would rather not splice. |
| 4 | Heat-set brass inserts into the printed parts | Yes | ✅ **Do it** — see Part 7. The iron you just bought is the tool for this. |
| 5 | Desoldering the hall TO-92 off its blue module | Yes | 🟠 **Wait.** See the caution below. |
| 6 | Super glue on the `dot_insert` tile | Yes | 🟠 **Wait** until the top plate and the dot alignment are confirmed. |
| 7 | Soldering **anything** directly to ESP32 GPIO pins | Yes | 🔴 **Never.** See below. |

### 🔴 Rule: nothing is soldered to an ESP32 GPIO

**The pin map is not frozen and will change twice more:**

1. The GPIO21/22 conflict fix — `IN3` moves to **23**, `IN4` to **27** (`ELECTRONICS_PLAN.md`
   Part 3).
2. The expander migration when a third cell appears (Part 5 of the same doc).

Every ESP32 connection stays **Dupont jumper into the header**. Solder is for the far end of
the wire, never the board end. This costs nothing and keeps the board reusable.

### 🟠 Caution before desoldering the hall sensor

The blue MH module is what makes the sensor usable today. Taking the sensor off it is
**irreversible and only needed for final assembly in the pod** — not for the demo, where the
module sits on the breadboard.

⚠️ **Read the part number on the black 3-legged sensor first.**

| Marking | Type | If you desolder it |
|---|---|---|
| `49E` / `SS49` | **Analog** | Fine — outputs a voltage directly, works on `AO` with no extra parts |
| `3144` / `A3144` | **Digital, open-collector** | ⚠️ Needs a **10kΩ pull-up** to 3V3 that currently lives on the module. Without it the output reads nothing. |

**Do not desolder before 24 August.** There is no benefit and a real chance of losing your
only sensor.

---

# PART 2 — Which box holds what

```
+============================+     +===============================+
|        BRAIN POD           |     |        MUSCLE CELL            |
|        (one, ever)         |     |        (one per character)    |
+============================+     +===============================+
| ESP32 DevKit    51x28mm    |     | 28BYJ-48 motor      19mm tall |
| 3 nav buttons              |     | Cam disc                      |
| DC power jack              |     | ULN2003 board    [!] 14mm max |
|                            |     | Hall sensor (bare TO-92)      |
| (3+ cells only:            |     |                               |
|  2x 4.7k pull-ups)         |     | (3+ cells only: MCP23017)     |
+============================+     +===============================+
             |                                    ^
             +----- 5V, GND, 4 control, 1 sense --+
                    (fixed 4 wires once expanders arrive)
```

## Vertical stack inside a cell — where the millimetres go

```
  z=58  +--------------------------+  top plate top surface, braille dots
  z=54  +--------------------------+  top plate underside
          |    8mm standoffs
  z=45    ----------------------      cam flat surface  (+0.8 at a bump)
  z=43  +--------------------------+  cam disc, 2mm floor
  z=41  +--------------------------+  base plate top / motor face
          |   19mm  28BYJ-48 body
  z=22  +--------------------------+
  z=20  +--------------------------+  mid plate, 2mm
          |   [!] 14mm ELECTRONICS POCKET  <-- the only tight space
  z=4   +--------------------------+
  z=0   +--------------------------+  box floor, 4mm
```

## Space, honestly

| Location | Space | Occupant | Margin |
|---|---|---|---|
| Electronics pocket | **36 x 46 x 14mm** | ULN2003, wires soldered flat ~12mm | 🔴 **~2mm. Zero slack.** |
| Pod interior | ~38mm headroom | ESP32 + jack + buttons | ✅ Wildly oversized |
| Cam-to-top-plate gap | 8mm standoffs | linkages, 12.2mm total height | 🟠 Set by the CAD fork |

🔴 **The 14mm pocket is why soldering exists in this project at all.** A ULN2003 with Dupont
jumpers plugged in vertically stands ~20mm and will not close the box. Cut the connectors off
and lay the wires flat and it drops to ~12mm.

⚠️ **The pocket lost 2mm** (16 → 14) in the 2026-08-01 CAD fix that corrected the motor stack.
It still clears, but check the fit with real soldered wires before closing the box.

---

# PART 3 — Every connection, colour coded

## 3.1 Power — do this first, and get it right

| From | Wire | To | Note |
|---|---|---|---|
| 5V adapter barrel | — | DC pigtail jack | |
| Jack `RED` (+5V) | `RED` | Breadboard **+ rail** | ✅ Polarity measured correct 2026-08-01 |
| Jack `BLACK` (GND) | `BLACK` | Breadboard **- rail** | |
| Breadboard + rail | `RED` | ULN2003 `+` pin | Motor power — **5V, not 3V3** |
| Breadboard - rail | `BLACK` | ULN2003 `-` pin | |
| ESP32 `GND` | `BLACK` | Breadboard **- rail** | 🔴 **COMMON GROUND — see below** |

### 🔴 The two power rules that protect the hardware

1. **Common ground is mandatory.** The ESP32 runs off USB, the motor off the adapter. If their
   grounds are not joined, the hall sensor reads garbage and the motor behaves randomly. This
   is the single most common cause of "everything worked, now nothing".
2. **Never connect the adapter to ESP32 `VIN` while USB is plugged into the laptop.** Two
   supplies fighting each other back-feeds your laptop's USB port. Motor from the adapter,
   ESP32 from USB, **grounds joined only.**

## 3.2 Control — ESP32 to ULN2003

Use the **corrected** pins. Do not use 21/22.

| ESP32 | Wire | ULN2003 | Why this pin |
|---|---|---|---|
| `GPIO18` | `ORANGE` | `IN1` | Safe output |
| `GPIO19` | `YELLOW` | `IN2` | Safe output |
| `GPIO23` | `GREEN` | `IN3` | ⚠️ Was 21 — frees I2C `SDA` |
| `GPIO27` | `BLUE` | `IN4` | ⚠️ Was 22 — frees I2C `SCL` |

🔴 **Never use GPIO 0, 2, 5, 12, 15 for a motor coil.** They are *strapping pins*, sampled at
boot to decide how the chip starts. A coil pulling one of them low can stop the ESP32 booting,
and it looks like a dead board.

## 3.3 Sense — the hall sensor

| ESP32 | Wire | Hall module | Caution |
|---|---|---|---|
| `3V3` | `RED` | `VCC` | 🔴 **3V3, NEVER 5V.** ESP32 GPIOs are not 5V-tolerant. `AO` would output up to 5V and damage the pin. |
| `GND` | `BLACK` | `GND` | |
| `GPIO34` | `WHITE` | `AO` | Analog. Input-only pin on ADC1 — correct choice. |
| — | — | `DO` | Unused for one cell. Needed from 3 cells up (expanders have no ADC). |

## 3.4 Motor — the 28BYJ-48 plug

The motor's white 5-pin plug goes into the white socket on the ULN2003 board. **It only fits
one way.** Colours are listed for diagnosis only:

| Wire | Role |
|---|---|
| `RED` | Common / centre tap → +5V |
| `ORANGE` | Coil 1 |
| `YELLOW` | Coil 2 |
| `PINK` | Coil 3 |
| `BLUE` | Coil 4 |

⚠️ **If the motor buzzes and vibrates but does not turn,** the coil order is wrong, not the
wiring. Swap `IN2` and `IN3` in firmware before touching any hardware.

## 3.5 Navigation buttons — brain pod

| ESP32 | To | Config |
|---|---|---|
| `GPIO32` | Button "Prev" → `GND` | `INPUT_PULLUP`, active LOW |
| `GPIO25` | Button "Select" → `GND` | `INPUT_PULLUP`, active LOW |
| `GPIO17` | Button "Next" → `GND` | `INPUT_PULLUP`, active LOW |

**No resistors needed.** The ESP32 has internal pull-ups; the button only has to pull the pin
down to ground.

## 3.6 The whole circuit on one page

```
     5V 3A ADAPTER
          |
      [DC JACK]  red=+  black=-       [POLARITY VERIFIED 2026-08-01]
          |
     +----+--------------------+
     |                         |
   (+) rail                 (-) rail ------------------+
     |                         |                       |
     |                         |                    ESP32 GND   <-- COMMON GROUND
     |                         |                       |            (mandatory)
  ULN2003 (+)            ULN2003 (-)                   |
     |                                                 |
  [ULN2003 BOARD]                              [ESP32 DEVKIT]
     IN1 <---------------- orange ---------------- GPIO18   (USB from laptop)
     IN2 <---------------- yellow ---------------- GPIO19
     IN3 <---------------- green  ---------------- GPIO23
     IN4 <---------------- blue   ---------------- GPIO27
     |
   [white 5-pin socket]
     |
  [28BYJ-48 MOTOR] --> cam disc

  [HALL MODULE]  VCC <-- red ---- ESP32 3V3     [!] 3V3 ONLY
                 GND <-- black -- ESP32 GND
                 AO  --- white --> ESP32 GPIO34
```

---

# PART 4 — Why each component exists

Nothing here is decorative. One line each, so you can answer the panel.

| Component | Why it exists | What breaks without it |
|---|---|---|
| **ESP32 DevKit** | Decides *which* of the 64 cam states to show; serves the WiFi dashboard | No control at all |
| **ULN2003 board** | An ESP32 pin gives ~20mA at 3.3V; a motor coil wants ~200mA at 5V. This chip is seven electronic switches that bridge that gap. | Connect the motor direct and you **destroy the ESP32 pin** |
| **28BYJ-48 stepper** | Moves in countable half-steps. 4096/turn is a nominal starting value; the owned gearbox must be Hall-to-Hall calibrated. | No repeatable positioning |
| **Cam disc** | The mechanical decoder: one angle = one 6-dot pattern. Six tracks read simultaneously. | 6 separate actuators instead of 1 |
| **Hall sensor** | Finds absolute zero on power-up. A stepper knows *relative* steps, never where it actually is. | Every character wrong after a power cut |
| **Homing magnet (3x1mm)** | The thing the hall sensor sees | Nothing to home against |
| **Return springs** | Push each linkage back down onto the cam. Gravity alone is too weak at this scale. | Dots stick up and never retract |
| **DC jack + 5V 3A adapter** | USB alone cannot supply motor current safely | Brown-outs, ESP32 resets mid-move |
| **Brass heat-set inserts** | PETG threads strip after a few open/close cycles. Brass does not. | The box becomes single-use |
| **MCP23017** *(future only)* | Could turn five per-cell signals into a shared four-wire bus, but requires a 3.3V regulator/interface and measured carrier | Pin exhaustion at ~4 direct cells |

---

# PART 5 — Cautions and precautions

## Electrical

| # | Rule | Consequence if broken |
|---|---|---|
| 1 | 🔴 Hall `VCC` to **3V3**, never 5V | ESP32 input pin damaged |
| 2 | 🔴 **Common ground** between the two supplies | Random behaviour, garbage sensor readings |
| 3 | 🔴 Never adapter → `VIN` while USB is connected | Back-feeds the laptop USB port |
| 4 | ⚠️ Never a motor coil on GPIO 0, 2, 5, 12, 15 | ESP32 will not boot |
| 5 | ⚠️ De-energise coils when idle | Motor runs hot, wastes ~250mA holding still |
| 6 | ⚠️ Power off before rewiring anything | Shorts happen while probing live |

## Soldering

| # | Rule | Why |
|---|---|---|
| 1 | **Heat the joint; let the joint melt the solder** | Solder dabbed off the iron makes a cold joint — looks fine, fails later |
| 2 | Slide heat-shrink on **before** soldering | Everyone forgets this exactly once |
| 3 | Tug-test every joint | A good joint does not pull off. No glue rescues a bad one. |
| 4 | Practice on scrap first | Do not let the ESP32 be your first ever joint |
| 5 | ⚠️ Keep a **separate tip** for heat-set inserts | Melted plastic and brass ruin a tip for solder work |

## Mechanical / space

| # | Caution |
|---|---|
| 1 | 🔴 **14mm pocket, ULN2003 at ~12mm.** Dry-fit with real soldered wires before closing the box. |
| 2 | ⚠️ Superglue on the `dot_insert` gives you **no repositioning time**. Tape-align it dry first, then wick glue in from the edge. |
| 3 | ⚠️ Keep every adhesive away from the cam, the linkage feet and the dot holes. A drop of glue in the mechanism is worse than a bad solder joint. |
| 4 | ⚠️ FDM holes print 0.2–0.3mm undersize. Expect to drill pilots to size. |

---

# PART 6 — Shopping: what is left

## ✅ Already bought

Soldering iron · solder wire · wire stripper · super glue · multimeter · digital calipers ·
ESP32 · 28BYJ-48 + ULN2003 · hall module · 5V 3A adapter + jack · magnets 8x1mm ·
tactile switches · hookup wire · Dupont jumpers

## 6.1 Electronics still to buy

| # | Item | Spec | Why | Est. ₹ | Where |
|---|---|---|---|---|---|
| 1 | **Breadboard** | 830 tie points | 🔴 The whole demo runs on it. **This is the blocker.** | 100 | Local / online |
| 2 | **USB-C DATA cable** | Must carry data | Charge-only cables look identical and fail silently. **Test yours first.** | 150 | Have one? |
| 3 | **Heat-shrink assortment** | 2–6mm | Every joint. Non-negotiable. | 100 | Local |
| 4 | **Hot glue gun + sticks** | 20–40W | Strain relief. **Reworkable** — this is why it beats epoxy while the pin map can still change. | 250 | Local |
| 5 | Flux paste | Rosin, no-clean | Makes ULN2003 pins far easier | 100 | Local |
| 6 | Spare iron tip | Any, cheap | ⚠️ **Dedicated to heat-set inserts** | 100 | Local |
| 7 | Brass wool tip cleaner | — | Keeps the tip alive | 100 | Local |
| 8 | 2-way screw terminal blocks | 5mm pitch | Power spine without splicing | 40 | Local |

**Electronics subtotal: ~₹940** (~₹790 if your USB-C cable does data)

## 6.2 What NOT to buy yet

| Item | Verdict |
|---|---|
| **MCP23017 expander** | ❌ **Not for 24 August, and not for two cells.** It earns its place at 3+ cells only. Order it when you commit to cell 3 — Robu.in, Element14 India, or Amazon. Local shops are hit-and-miss for DIP-28 logic; that is not a problem you have to solve now. |
| Resistors, capacitors, diodes | ❌ **Zero needed.** Flyback diodes are inside the ULN2003, pull-ups are inside the ESP32, regulators are on the DevKit. |
| ATmega328P / custom PCB | ❌ Cancelled. See `ELECTRONICS_PLAN.md` Part 1. |
| Level shifters | ❌ Hall runs at 3V3, so GPIO34 never sees 5V. |

## 6.3 Mechanism parts (order with the screws)

| # | Item | Spec | Qty | Est. ₹ |
|---|---|---|---|---|
| 1 | **Micro compression springs** | **2.0mm OD**, ~0.3mm wire, ~4mm free length | 6 + spares | 500 |
| 2 | **Homing magnet** | 🔴 **3mm dia x 1mm thick** neodymium | buy 10 | 120 |

🔴 **Not pen springs.** Pen springs are ~4mm OD; braille rows are 2.6mm apart. They physically
cannot fit.
🔴 **Not 3x2mm magnets.** The cam floor is only 2mm — a 2mm-thick magnet's pocket cuts clean
through it and destroys three cam tracks. 1mm thick leaves 0.8mm of floor and holds fine.
Your 8x1mm magnets are too wide in diameter for this job (they are for docking).

---

# PART 7 — Screws and inserts

## 7.1 The change that matters: brass heat-set inserts

The 2026-08-01 CAD update moved the box from *screwing into plastic* to **brass heat-set
inserts**. PETG threads strip after a few open/close cycles, and this box gets opened
constantly.

**You install them with the soldering iron you just bought.** Set ~230°C, press the insert in
slowly and straight, let it cool before removing the iron.

⚠️ **Use a cheap spare tip.** Brass and melted plastic contaminate a tip permanently for
soldering work.

## 7.2 What to order

Sizes taken from the CAD parameters, not guessed:

| # | Part | Size | Qty | CAD source |
|---|---|---|---|---|
| 1 | **Bolt** — top plate → standoffs → box | **M2.5 x 25mm**, socket cap or button head | 4 | `top_plate.scad` `screw_dia=3.2` clearance |
| 2 | **Heat-set insert** — box corner posts | **M2.5**, OD **3.5mm**, length **5.0mm** | 4 (buy 10) | `outer_box.scad` `insert_m25_dia=3.5`, `depth=5.5` |
| 3 | **Screw** — motor ears | **M4 x 5mm**, thread-forming; exact point/ear measurement still required | 2 | `base_plate.scad`; `base_interface_coupon`; **no M4x6/x10** |
| 4 | **Screw** — pod lid | **M2 x 8mm** *(or M2.5 x 8 — see 7.3)* | 2 | `esp32_pod_params.scad` |
| 5 | **Heat-set insert** — pod lid posts | **M2**, OD **3.2mm**, length **4.0mm** *(or M2.5 — see 7.3)* | 2 (buy 10) | `insert_m2_dia=3.2`, `depth=4.5` |

⚠️ **Measure the inserts when they arrive.** The CAD comments say so explicitly — insert OD
varies by brand, and the bore is a parameter precisely so it can be adjusted. If your M2.5
inserts measure 3.6mm rather than 3.5mm, that is a one-line CAD change, not a reprint decision.

**Search terms for onlyscrew.com:** "M2.5 socket cap screw 25mm", "brass threaded insert M2.5",
"M4 thread forming screw 5mm". If inserts are not stocked there, they are reliably available on Robu.in
and Amazon as "brass heat set insert assortment kit M2 M2.5 M3" (~₹350 for a mixed kit, which
also covers you for the measuring surprise above).

⚠️ I cannot check live stock on any of these sites. Treat the list as *what to search for*, and
if a size is genuinely unavailable, Part 7.3 tells you what can move.

## 7.3 Can we use one size for everything?

**Almost — you can get from three sizes to two.** Here is the honest analysis:

| Location | Now | Can it change? | Reasoning |
|---|---|---|---|
| Box corners | M2.5 x 25 | 🔒 **Keep** | Inserts and bores already in the CAD; changing means re-printing the box |
| Pod lid | M2 x 8 | ✅ **→ M2.5 x 8** | An M2.5 insert needs a 3.5mm bore. The post is 6.5mm dia, leaving **1.5mm of wall** — thinner than the 1.65mm it has now, but still enough for hot brass. |
| Motor ears | M4 x 5 only | 🔴 **Keep M4 diameter; coupon first** | Option A uses a through pilot. M4x5 is the only current candidate; do not use x6/x10 without measured ≥0.5mm cam clearance. |

### Recommendation

> **Standardise on M2.5 for everything structural. Keep M4 x 2 for the motor only.**
> Three sizes become two, and you buy **one** insert size instead of two.

**CAD change required — flagged for the CAD fork, NOT applied here:**

```
cad/scad/esp32_pod_params.scad
    insert_m2_dia    3.2  ->  3.5     M2.5 insert bore
    insert_m2_depth  4.5  ->  5.5     M2.5 inserts are longer
    lid clearance hole  2.2 -> 2.9    M2.5 clearance
```

⚠️ **Only worth doing if the pod shell and lid are not yet printed.** If they are printed,
buying two M2 screws is far cheaper than a reprint. **Check before changing anything.**

---

# PART 8 — Build order for the next two weeks

| # | Step | Needs | Blocked by |
|---|---|---|---|
| 1 | **Build the breadboard circuit** | Breadboard, Dupont | 🔴 **Only the breadboard.** No soldering. |
| 2 | Flash `breadboard_test.ino` | Data USB cable | Step 1 |
| 3 | Confirm motor turns + hall homes + dashboard loads | — | Step 2 |
| 4 | Solder header pins to the DC jack | Iron ✅ | Nothing |
| 5 | Solder ULN2003 wires flat | Iron ✅, heat-shrink | Nothing |
| 6 | Install brass inserts | Iron ✅, spare tip, inserts | Ordering |
| 7 | Dry-fit ULN2003 in the 14mm pocket | Printed box | Step 5 |
| 8 | Rehearse the demo script | — | Step 3 |

🔴 **Step 1 is the whole project's blocker and it needs nothing you do not already own except a
breadboard.** Everything else on this list is polish.

---

# PART 9 — Flagged for the CAD fork (do not fix here)

1. **Pod lid fastener standardisation** — M2 → M2.5, three parameters. Only if not yet printed.
   See Part 7.3.
2. **Hall module does not fit** the base plate — needs the bare TO-92 desoldered and a pocket
   that holds it. ⚠️ Check the sensor part number first (Part 1).
3. **DC jack has no thread or nut** — the pod lid cannot clamp it. Needs a retainer or a
   different jack.
4. **Electronics pocket is 14mm** with a ~12mm occupant. Working, zero margin. Verify with real
   soldered wires.
5. **Upper linkages** — the 24 August risk. Electronics does not depend on them.
