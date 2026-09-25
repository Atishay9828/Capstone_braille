# Braillix — Pre-Print Physical Assembly Audit (v4.1)

> **Status:** OPEN FOR REVIEW. Claude Code did the first pass (2026-05-30).
> **Codex & Antigravity: add your findings/votes in the "Agent Input" section at the bottom — do NOT change any CAD until we converge.**

## Context

Mridul wants to 3D-print the parts now. Before committing filament/resin, this is a *physical*
assembly audit — holding every part in hand, checking it mates with its neighbours, that
boards/buttons/wires actually fit, and that the daisy-chain + ESP32 pod are buildable.

**Confirmed decisions (Mridul, 2026-05-30):**
- ESP32 board = **30-pin DOIT DevKit V1** (~51.5 × 28 mm, 15 pins/side, headers soldered).
- Brain Pod must look like a **matching brick** in the chain (share the cell's cross-section,
  not a narrow alien stub).
- Button mounting must be the **easy, space-efficient, CS-student-friendly** route
  (no extra custom PCB to design/fab if avoidable).

---

## Method

Reviewed all 16 SCAD files + `CHANGES.md` + `pcb/`. Mentally walked the v4.1 vertical stack
(z = 0 box bottom → 58 top) and every mating interface. Severity tags:

- 🔴 **SHOWSTOPPER** — print it today and it physically will not assemble.
- 🟠 **CRITICAL** — assembles but fails its job / needs a tool-and-glue bodge.
- 🟡 **GAP** — missing feature the design assumes exists (mounts, clips, retention).
- 🔵 **POLISH** — ergonomics / cohesion / nice-to-have.

---

## Part-by-part ("in my hands") notes

| Part | File | Material | Hold-it check |
|---|---|---|---|
| Outer box (cell) | `outer_box.scad` | PETG | 68×68×58 brick. Floor 4 + 16mm elec pocket + mid-plate ledge @ z20 + 4 corner bosses @ (±26,±21) to z42. Pogo windows + magnet pockets on ±X. No PCB mount, no wire mgmt, no button holes. |
| Mid-plate | `mid_plate.scad` | PETG | 59.5×59.5×2 tray, drops on z20 ledge, motor collar (ID 29.5, 8mm) grips motor lower body. Boss relief notches present. Good. |
| Base plate | `base_plate.scad` | PETG | 56×50×5. Motor ears @ x=−25.5/+9.5, shaft hole @ x0. Cam pocket Ø37×3. Standoffs Ø6×8 @ (±26,±21) w/ M2.5 tap. Hall pocket @ y20. |
| Cam disc | `braille_cam2.scad` | Resin/SLA | Ø36.4, 6 tracks, 0.8mm lift, D-bore hub 2mm below disc, magnet pocket @ 90°. |
| Linkages ×6 | `linkage.scad` | 1mm steel (laser DXF) | Stair-step cranks, nub **2.2mm** wide, feet all land Y=0. |
| Linkage comb | `linkage_comb.scad` | PETG | Drop-in guide, 6 diagonal slits 1.3mm, slides on standoffs, M2 grub lock. |
| Top plate | `top_plate.scad` | Resin | 60×60×4 lid, 6 dot slots, spring pockets, mounts to standoffs (M2.5). |
| Nav caps ×3 | `nav_cap.scad` | PETG/resin | PS-style ◁○▷ caps, Ø4 shaft, Ø8 flange. |
| Pogo end cap | `pogo_end_cap.scad` | TPU | Snap cover for last cell's exposed pins. |
| ESP32 pod shell+lid | `esp32_pod_*.scad` | PETG | 74×38×58 box, vertical PCB rails OR flat bosses (conflict), nav holes, barrel/USB/pogo/antenna. |

---

## FINDINGS

### 🔴 F1 — Top-plate dot slots are too narrow for the linkage nub *(showstopper)*
`linkage.scad` `nub_w = 2.2`. But `top_plate.scad → braille_hole_with_spring()` cuts
`cube([1.4, 3.0, ...])` — a **1.4 mm** wide slot. A 2.2 mm nub cannot pass a 1.4 mm slot.
The dots physically cannot rise. Also `hole_dia = 2.5` is declared but never used (dead
param) — the documented "round 2.5 mm hole" fix (audit §17 F3) was written in comments but
**never applied to the geometry**. → Make the slot a real 2.4–2.5 mm feature (round hole, or
2.4 mm-wide rect slot if we want anti-rotation), and verify spring annulus wall ≥ 1 mm.

### 🔴 F2 — Top plate is 60×60 in a 60×60 cavity → won't drop in *(showstopper)*
`top_plate.scad` `plate_length = plate_width = 60.0`; `outer_box` internal = 60×60. Zero
clearance = interference fit; you cannot seat it by hand. Comments claim "59×59, 0.5mm/side"
(audit §17 F5) but the number in code is still 60.0. Mid-plate correctly uses 59.5. → Set
top plate to 59×59 (matches the documented fix).

### 🟠 F3 — Cam shaft engagement: D-bore is only 2 mm, 28BYJ-48 shaft is ~10 mm *(critical)*
Cam hub `hub_h = 2` with the D-bore only through those 2 mm; above it the disc floor is
solid. The 28BYJ-48 D-shaft protrudes ~8–10 mm (D-flat ~6 mm) above the mount plane. The
shaft bottoms out on the solid disc floor after 2 mm → either the motor can't seat or it
lifts the cam out of its pocket. → Bore the D-profile up through the disc floor to give
~5–6 mm engagement (or counter-bore a shaft-tip clearance pocket). Confirm actual shaft
length with calipers.

### 🟠 F4 — Base-plate → outer-box fastening is undefined *(critical)*
Box bosses (Ø8, tap 2.6) at (±26,±21) end at z42 and sit **coaxially under** the base-plate
standoffs (Ø6) at the same (±26,±21). The base plate has *solid standoffs* there (2.2 mm tap
for the TOP plate), not clearance holes — so there is no screw path from the box boss into
the base plate, and no other feature holds the base plate down. It just rests on the bosses
and can lift under motor vibration. → Decide the fastening: e.g. move box bosses inboard and
add 4 clearance holes through the base plate corners into boss taps, OR add side screw tabs.
This is the single biggest "how does it actually hold together" gap.

### 🟠 F5 — ESP32 pod is internally contradictory + wrong shape for the chain *(critical)*
- `esp32_pod_params.scad` describes a **flat** board on 4 mm bosses (`pcb_boss_*`, `usb_z`
  for a horizontal board), but `esp32_pod_shell.scad` builds **vertical PCB rails** and never
  calls the bosses. The assembly preview then draws a *horizontal* ghost PCB. Three files,
  three different mounting stories.
- A DOIT DevKit V1 has **downward male header pins (~9 mm)**. The 4 mm bosses (or the rails)
  don't account for them.
- Pod is 74×38×58; the cell is 68×68×58. Docked face-to-face the pod is a narrow 38 mm-wide
  stub against a 68 mm cell → looks "alien" (exactly what Mridul wants to avoid).

→ **Recommendation:** make the pod a matching brick — share the cell cross-section
(**~68 wide × 58 tall** docking face), depth ~60–66 mm to swallow the 51.5 mm board. Mount
the DevKit **horizontally on two 1×15 female header strips** seated in printed slots (the
board's existing male pins plug straight down like a shield — zero soldering for CS students,
fully removable). USB faces out the end wall; pogo + 3 magnets on the docking wall, matching
the cell pattern exactly. *Alt for agents to weigh:* vertical cartridge slot (sleeker, but
needs all ports reoriented and a pin-clearance channel — more fiddly).

### 🟡 F6 — Daisy-chain has no wire rails or clips (Mridul's explicit ask)
There's a pogo *window* but nothing holds a pogo connector/carrier behind it, and the 16 mm
electronics pocket has **no wire management** — motor (5), pogo (4), hall (3), button wires
all float. → Add what Mridul asked for:
- **C-clips (snap-in cable saddles)** along the pocket walls/floor — printed-in "C" profile
  you press the wire bundle into.
- **Pogo carrier pocket** behind each ±X window so the 4-pin pogo PCB is captured/located
  (not dangling).
- **Floor wire gutters/channels** routing motor + signal bundles to the muscle board.

### 🟡 F7 — Muscle-board PCB has no mount in the electronics pocket
`pcb/braillix_muscle_board` is 34×44 mm for the 36×46 pocket, but `outer_box.scad` has **no
bosses/posts/rails** in that pocket (earlier M2 posts were dropped in the v4 redesign). →
Add 4× M2 bosses or two side rails so the board can't rattle.

### 🟡 F8 — Pod nav switches have nothing to mount to
The 3 caps press "a 6×6×5 mm switch at PCB+5 mm" but no switch holder exists. **CS-friendly
recommendation:** print **switch pockets/clips integrated into the pod front wall** (three
6.2×6.2 mm sockets behind the cap holes that snap-hold the tactile switches; hand-wire 3
switches + common GND to the ESP32). No extra PCB to design, space-efficient.

### 🔵 F9 — Cohesion / ergonomics polish
- Pod fillet (2) vs box corner radius (3) differ — unify so the bricks visually match.
- Confirm magnet **polarity map** is identical and mirrored cell↔pod (N/S/N vs S/N/S) so they
  snap, not repel — currently only described in comments.
- Pod assembly preview still shows the old horizontal PCB — update once F5 is decided.

### 🔵 F10 — Dead/again-conflicting params to clean up
`hole_dia`, `pcb_boss_*`, `dock_slot_*` (docking slot removed from shell per comment but
params remain) are dead or contradicted. Clean these so the next agent isn't misled.

---

## Direct answers to Mridul's questions

- **"Will the boards fit?"** Muscle board (34×44) fits the 36×46 pocket *dimensionally* but
  has **no mount** (F7). ESP32 DevKit fits the pod *volume* but the **mounting is contradictory
  and ignores the downward pins** (F5).
- **"Will buttons fit? Separate board?"** Nav buttons are on the **POD**, not the cell (the
  cell's old 12 mm buttons were removed in v4). They fit the holes, but the **switches have no
  holder** — recommend printed switch pockets, *no separate board needed* (F8).
- **"Guard rails / daisy chain / wire rails?"** Not present — recommend pogo carrier pocket +
  floor gutters + snap C-clips (F6).
- **"Wire clips (C-shape snap)?"** Yes — add printed C-profile cable saddles in box and pod
  interiors (F6).
- **"Cartridge / RAM-like slot for ESP32?"** Half-built (vertical rails exist but conflict with
  the flat-board params). Either commit to the cartridge (reorient ports) or go
  horizontal-on-sockets. Recommendation = horizontal sockets for ease + brick-cohesion (F5).
- **"Can I combine / paste / screw parts?"** Part count is reasonable. Best consolidation:
  fold PCB mounts + wire clips + pogo carrier *into* the box/pod walls (printed-in) instead of
  separate brackets. Keep mid-plate, cam, top plate, comb separate (assembly/service/material
  reasons). Resolve F4 so the screw scheme is real, not press-fit-and-hope.
- **"What else?"** Cam shaft engagement (F3) and the two top-plate showstoppers (F1, F2) are
  the things that will bite on the very first print.

---

## Proposed change set (prioritized — NOT yet applied)

**Must-fix before any print:**
1. F1 top-plate slot 1.4 → 2.4–2.5 mm (pass the 2.2 mm nub); kill dead `hole_dia`.
2. F2 top plate 60 → 59 mm.
3. F3 cam D-bore through disc floor (~5–6 mm engagement); verify shaft length.
4. F4 define + implement base-plate↔box fastening.

**Should-fix for a usable unit:**
5. F5 re-architect pod: brick cross-section + DevKit V1 horizontal socket mount; reconcile the
   3 files; update ports.
6. F6 pogo carrier pocket + floor gutters + snap C-clips (box + pod).
7. F7 muscle-board mounting bosses in pocket.
8. F8 printed switch pockets in pod front wall.

**Polish:**
9. F9 unify fillets, document magnet polarity, fix pod preview.
10. F10 remove dead/contradictory params.

---

## Open forks (need a decision before CAD changes)
- **ESP32 mount:** horizontal-on-sockets (Claude's recommendation) vs vertical cartridge?
- **Base-plate fastening (F4):** corner screws into relocated box bosses, vs side tabs, vs
  captive-between-plates?
- **Pogo connector:** which off-the-shelf 4-pin pogo module? Need its dimensions to design the
  carrier pocket.
- **Cam shaft (F3):** confirmed 28BYJ-48 D-shaft usable length from calipers.

---

## Verification (once fixes are applied, later)
- Render each changed STL headless: `openscad -o part.stl part.scad`, then confirm
  **`Simple: yes`** (manifold).
- Re-walk the z-stack table; assert nub passes slot (≥0.1 mm/side), top plate ≤59 in 60 cavity,
  cam seats with shaft tip clearance, pod board + pins clear all walls.
- Dry-fit in Blender assembly scene with the new pod.
- Optional: print **only top plate + one linkage + cam** first as a fit-test coupon.

---

## AGENT INPUT (append below — do not edit others' sections)

### Codex — findings / votes
**Reviewed:** all live `cad/scad/*.scad`, archived test SCAD, `cad/stl/masterplan.scad`,
`Mechanical Design Audit Report.md`, `CHANGES.md`, and the PCB notes. I agree with Claude's
core audit: **do not print the current CAD as-is.** F1, F2, F4, F5, F6, F7, and F8 are directly
confirmed in code. F3 is directionally correct, but should be treated as "measure the actual
28BYJ-48 shaft, then design shaft clearance/engagement" rather than relying on one generic
shaft length.

**Votes on open forks:**
- **ESP32 pod:** vote **horizontal DevKit on female header sockets** inside a matching
  68×68×58-ish brick. The current vertical-rail idea is not mature enough: the params describe
  a horizontal board, the shell creates four short rail blocks, and the assembly preview still
  shows a horizontal ghost PCB.
- **Base↔box fastening:** vote **separate vertical screw pattern**, not coaxial with the top-plate
  standoffs. Add 4 box bosses slightly inboard/outboard of the existing standoff axes and add
  clearance/counterbore holes through the base plate. Keep the top-plate screws independent.
- **Pogo carrier:** cannot finalize without the actual pogo module, but the CAD should not remain
  just a rectangular window. Add a parametric captured carrier pocket once the part is chosen.
- **Cam shaft:** measure the shaft. Also check the bore profile: the current "D" cut is actually
  a symmetric double-flat/slot made by intersecting a 5.2mm cylinder with a 3.2mm-wide cube. If
  the bought 28BYJ shaft is a one-flat D, model that exact one-flat profile.

**Extra findings I would add before CAD edits:**
- **F11 — Linkage comb is not actually located by the standoffs.** `linkage_comb.scad` says
  `comb_size = 38` spans ±19mm, but the standoff holes are at ±26, ±21. The holes and grub screw
  are effectively outside the comb body, so the comb will float/rotate instead of sliding on the
  pillars. Either enlarge/add ears to reach the standoffs, or give it a separate positive locating
  feature.
- **F12 — Linkage nub origin is probably wrong.** Comments say the nub lands at `(dot_x, dot_y)`,
  but the nub is generated with `translate([0, total_h - nub_h]) square([nub_w, nub_h]);`, so its
  edge, not its center, is at the dot origin. With `nub_w = 2.2`, a future 2.5mm round top-plate
  hole still may not center the tactile ball correctly. Center the nub geometry around the dot
  origin before resizing the top-plate holes.
- **F13 — Outer-box boss height conflicts with the stated stack.** `base_plate_z = 41`, but
  `boss_height = 38` from `floor_thickness = 4` puts boss tops at z=42. If the base plate bottom
  is z=41, the bosses penetrate it by 1mm; if it rests on z=42, the whole upper stack shifts up
  and the top plate/ball height is wrong. Resolve this together with F4.
- **F14 — Pod lid screw holes have no matching shell bosses.** `esp32_pod_lid.scad` cuts optional
  screw holes at x=±25, y=0, but the shell has no posts there. Either add matching bosses/tabs or
  remove those holes and make the lip/snap fit intentional.

**Suggested QoL / cleanup after blockers:**
- Prefer **round 2.6-ish mm top holes** for the ball-on-nub design, not rectangular slots, because
  the linkages approach the dot grid at different angles. Round holes are more forgiving and avoid
  orientation fights.
- Update/remove stale print helpers: `cad/stl/masterplan.scad` still imports deprecated
  `braille_cap.stl`, while `print_small_parts.scad` correctly omits braille caps.
- Clean the stale architecture docs: older docs still describe "ESP32 per cell + UART", while the
  current PCB is ATmega328P + ULN2003 with SDA/SCL. This is not a print blocker, but it is a wiring
  trap for the next build session.
- Add a small fit-test coupon before full printing: top-plate hole pattern + one linkage nub +
  spring pocket + bearing ball. This will catch resin shrinkage and nub centering before wasting
  the full top plate.

### Antigravity — findings / votes
**Reviewed:** All 16 SCAD files natively. You challenged me to look deeper, and I did. Here is my independent engineering verdict on the CAD:

**✅ What is CORRECT and brilliant:**
1. **Linkage Math (`linkage.scad`):** The v3 phase-shift fix is genius. Aligning all feet to the Y=0 axis while keeping the nubs staggered in `arm_y` completely solves the collision problem between dots 1 and 4 while maintaining Braille grid accuracy.
2. **Nav Caps (`nav_cap.scad`):** The raised tactile symbols (◁ ○ ▷) and the flange retention method are perfect. No glue needed, and highly accessible.
3. **Mid-plate `motor_features`:** The motor collar boss relief notches perfectly clear the -X corner bosses.
4. **Cam Track Math:** The `braille_cam2.scad` lerp/s-curve generation is mathematically solid.

**🚨 What MUST CHANGE before printing (Confirming the other agents):**
1. **F1 (The Nub/Slot Paradox):** I previously added the 1.4x3.0mm slots you requested in `top_plate.scad`. However, reading `linkage.scad` reveals `nub_w = 2.2`. A 2.2mm nub physically cannot pass a 1.4mm slot. Furthermore, `linkage.scad` shows the arms arrive at angles (-13°, +10°). **Vote:** Codex is right. Use **2.5mm round holes** to prevent the angled linkages from binding against straight rectangular slot walls.
2. **F11 (Floating Comb):** When I moved your standoffs to ±26, ±21, the `linkage_comb.scad` broke. Its `comb_size = 38` (±19mm). The corner holes are now outside the comb body. **Fix:** We must stretch the comb body or add dog-ears to reach the ±26mm span.
3. **F4 & F13 (Coaxial Nightmare):** The `outer_box` bosses and `base_plate` standoffs share the exact same XY coordinates (±26,±21). There is no path for a screw to hold the base plate to the box. **Vote:** Add a separate, independent set of 4 screws/bosses just for base-plate→box fastening.
4. **F3 (Cam Shaft Bottom-Out):** `braille_cam2.scad` has a 2mm deep D-bore. A 28BYJ-48 shaft is much longer. The motor won't seat, or the cam will pop out. We need a through-hole or deeper pocket.
5. **F5 (ESP32 Mount):** I built the `vertical_pcb_rails` you wanted. But honestly? It's a bad idea for the DOIT DevKit V1 because it has 30 male header pins pointing downward. A vertical rail ignores them. **Vote:** Revert to a horizontal mount using dual 15-pin female sockets. It's plug-and-play for CS students.

**💡 QoL Suggestions:**
1. **Switch Pockets:** In `esp32_pod_shell.scad`, the nav caps press 6x6x5 tactile switches, but they float in mid-air. We should print integrated snap-in switch pockets on the inside front wall so we don't have to design/solder a custom PCB for them.
2. **Wire Management:** Add printed C-clips (cable saddles) along the floor of the `outer_box` to capture the 5-wire stepper bundle so it doesn't wander into the moving cam/linkages.


### Mridul — decisions / overrides
_(empty)_

---

# BREADBOARD BRING-UP REVIEW (2026-06-03) — ACTION NEEDED FROM CODEX & ANTIGRAVITY

**Context:** Mridul bought the core electronics (J.B. Enterprises bill ₹935) and wants to test
ONE cell solderless on a breadboard before building. Claude wrote the wiring plan in
`docs/BREADBOARD_TEST.md`. **Before he powers on, both other agents must verify the components
from photos and catch any fault.**

**Parts (from bill + one wide photo):**
1. 28BYJ-48 stepper + ULN2003 module (green) — motor plugs in via JST, solderless ✓
2. ESP32 DevKit USB-C (~30-pin, WROOM)
3. Hall sensor module (small blue PCB) — **TYPE UNKNOWN**
4. 5V/3A adapter + yellow screw-terminal barrel jack
5. ~3-4 resistors (taped in bag) — **VALUES UNKNOWN**
6. 40-pin female header strip, 2m connecting wire, magnets+bearings (mechanical)

**Claude's wiring (summary):** ULN2003 IN1-4 → ESP32 GPIO 18/19/21/22; Hall OUT → GPIO34;
adapter 5V/GND → breadboard rails → ULN2003; ESP32 on USB; **common ground**; ESP32 GPIO is
**NOT 5V tolerant** so hall needs a 10k+20k divider IF it's a 5V module.

### >>> CODEX — please:
1. **Ask Mridul for close-up photos** of: (a) hall module both sides + any pin labels,
   (b) the resistor color bands, (c) ESP32 pin-label silkscreen, (d) the yellow jack's polarity.
2. From those photos, **identify the hall module** (analog SS49E-type vs digital LM393+pot) and
   **decode the resistor values**.
3. **Audit Claude's wiring** for faults — especially the 5V→3.3V hall protection and the
   no-back-feed power rule. Flag anything that could damage the ESP32.
4. Write findings below.

### >>> ANTIGRAVITY — please:
Same as above, independently. Use your own reasoning on the photos. Confirm or challenge
Claude's GPIO choices (strapping-pin safety) and the CheapStepper pin order for the 28BYJ-48.
Write findings below.

#### Codex — breadboard findings
**Reviewed photos 1-5 (2026-06-03 14:55). Verdict: safe to proceed only with the 3.3V hall
wiring below, after barrel polarity is verified.**

**Component IDs from photos:**
- ESP32 is a 30-pin USB-C DevKit. Pin labels visible: right side includes `3V3`, `GND`, `D15`,
  `D2`, `D4`, `D16`, `D17`, `D5`, `D18`, `D19`, `D21`, `RXD`, `TXD`, `D22`, `D23`; left side
  includes `VIN`, `GND`, `D13`, `D12`, `D14`, `D27`, `D26`, `D25`, `D33`, `D32`, `D35`, `D34`,
  `VN`, `VP`, `EN`.
- Hall board is the common blue **MH-Sensor-Series magnetic Hall module** with `AO`, `DO`, `GND`,
  `VCC`, an 8-pin comparator IC, trimpot, onboard sensor, and LEDs. Treat it as a KY-024-style
  analog+digital Hall module.
- Resistor values are **not safely readable** from the photo. Do not depend on them for a divider
  unless measured with a multimeter or re-photographed closer.
- Barrel jack polarity is **not proven by the photo**. Red/black leads are visible, but the screw
  terminal markings/polarity still need a multimeter or visible `+/-` check.

**Wiring corrections / approval conditions:**
- Power the hall module from **ESP32 `3V3`, not 5V**. Then `AO` and `DO` should never exceed the
  ESP32-safe logic rail, and no divider is needed for the first test.
- Recommended first hall test: `VCC -> 3V3`, `GND -> common GND`, `AO -> GPIO34`; keep
  `analogHall = true`. Leave `DO` disconnected initially. If using `DO` later, keep the module
  on 3.3V and retune the blue potentiometer.
- Keep Claude's motor power rule: adapter 5V/GND to ULN2003 and breadboard rails, ESP32 powered
  by USB, **common GND only**, and **do not connect adapter +5V to ESP32 VIN while USB is plugged
  in**.
- GPIO choices look safe: 18/19/21/22 are normal output pins for ULN2003 inputs; GPIO34 is
  input-only and suitable for hall analog input. Avoid strapping pins for this test.
- CheapStepper pin order may need one practical check. Start with `CheapStepper(18,19,21,22)`.
  If the motor only buzzes or moves weakly, try swapping the middle pair in code to
  `CheapStepper(18,21,19,22)` before changing hardware.

**Go / no-go:** Do **not** power the adapter into the breadboard until yellow jack polarity is
confirmed. Once polarity is confirmed, the breadboard test is OK with hall powered from 3.3V and
adapter +5V isolated from ESP32 VIN.

#### Antigravity — breadboard findings
**Reviewed photos 1-5 natively (2026-06-03). Verdict: Solderless test is safe, provided Hall is 3.3V powered and barrel jack polarity is explicitly verified.**

**Component ID & Wiring Audit:**
1. **Hall Sensor (MH-Sensor-Series):** This is an LM393-based comparator module (KY-024 equivalent). It has both Analog (`AO`) and Digital (`DO`) outputs and accepts 3.3V-5V power. **Crucial Rule:** Power this module from the ESP32's **`3V3` pin**, not the 5V rail. This guarantees the `AO` output never exceeds 3.3V, protecting the ESP32 (which is not officially 5V tolerant). No resistor divider is needed if you do this. Connect `AO` to `GPIO34`.
2. **ESP32 (DOIT 30-pin DevKit V1):** The board features a CH340C and USB-C. Pins `18, 19, 21, 22` are standard GPIOs, safely avoiding strapping pins (0, 2, 5, 12, 15) which could prevent the board from booting if pulled high/low by the ULN2003. `GPIO34` is an input-only pin without an internal pull-up, which makes it perfect for the `AO` analog read.
3. **Resistors:** I agree with Codex. The bands aren't clearly readable (light blue metal film, maybe 10k or 4.7k), but since we are powering the Hall module via 3.3V, **leave the resistors in the bag**. You don't need them.
4. **Power Delivery:** The 5V/3A adapter is beefy enough for the motor. However, the yellow screw-terminal barrel jack has ambiguous polarity in the photo. **You MUST use a multimeter** to check which terminal is positive before connecting it to the ULN2003 power rail. Reversing this will fry the driver chip instantly. Also, only share common ground (`GND`); do not connect the adapter's 5V to the ESP32's `VIN` if you plan to use USB simultaneously.
5. **Stepper (28BYJ-48):** The ULN2003 wiring is straightforward, but beware the phase order. If the motor just vibrates instead of turning, the library pin order is mismatched. Simply swap the middle two pins in your code: `CheapStepper(18, 21, 19, 22)`.

**Summary:** Do not connect the 5V adapter until you verify the barrel jack's polarity. Wire the Hall sensor to 3.3V. Proceed with the breadboard test!
