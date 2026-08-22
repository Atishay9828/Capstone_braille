# Braillix — Slice It Yourself (Anycubic Kobra Neo)

> **CURRENT RELEASE GATE - 2026-08-19:** Do not manually slice production parts from this historical
> guide for tomorrow's run. Use only `printing/gcode_kobra_neo_checked/` and the exact contract in
> `PRINT_RELEASE_2026-08-19.md`. The checked profile is 0.16mm, 5 walls, 40% infill, 6/6 shells,
> 8mm brim, PETG 235/230C, bed 80C, supports off, and arc fitting off.
> A complete guide to producing your own G-code on your PC, so the lab just loads the file.
> Written 2026-07-30 for: **Anycubic Kobra Neo · 0.4mm nozzle · PETG · lab accepts G-code.**

---

## Why your first print failed — the three real causes

| What you saw | Actual cause |
|---|---|
| Supports welded in, couldn't pluck them out | Supports were switched **on** with PLA-tuned settings. PETG bonds across a gap that PLA snaps at. **These parts need no supports at all.** |
| Screw columns snapped | Not enough **walls**. On a Ø7.8mm column, walls are almost the whole part — infill barely matters. |
| Filament strings between travel moves | **Stringing.** Wet PETG + too-hot nozzle + wrong retraction. The Kobra Neo is **direct drive**, so most online retraction advice (5–6mm, meant for Bowden) is wrong and makes it worse. |

None of these are your fault, and only one is the teacher's — they're the default settings.

---

# PART 1 — Software

## Install OrcaSlicer (recommended)

**Download:** <https://github.com/SoftFever/OrcaSlicer/releases> → the `.exe` for Windows.

**Why OrcaSlicer over Cura, for your situation:**
- Anycubic Kobra profiles are **built in** — far fewer ways to get the machine setup wrong
- Has **built-in calibration tests** (retraction, temperature) that directly fix your stringing
- Per-object settings are much easier — which you need for the screw columns

> Cura also works and your teacher may know it better. Cura equivalents for every setting are
> in **Appendix A** at the end.

## First-run setup

1. Launch OrcaSlicer → the setup wizard appears
2. **Printer** → search `Anycubic` → pick **Kobra Neo** (or **Kobra 2 Neo** — check the machine's
   boot screen for which one). If it is genuinely absent, use **Appendix B** to add it manually.
3. **Filament** → tick **Generic PETG**
4. Finish

**Verify the machine settings** (top-right printer dropdown → the pencil/edit icon):

| Setting | Value |
|---|---|
| Bed size | 220 × 220 mm |
| Max height | 250 mm |
| Nozzle diameter | **0.4 mm** |
| Extruder type | **Direct Drive** ← this one matters most |

---

# PART 2 — The settings that fix your problems

Switch OrcaSlicer to **Advanced** mode (top-right dropdown: Simple / Advanced / Expert →
choose **Advanced**), or you won't see half of these.

## 2.1 Quality tab

| Setting | Value | Why |
|---|---|---|
| Layer height | **0.16 mm** | Current checked coupon profile. |
| First layer height | **0.24 mm** | Current checked coupon profile. |
| **Wall loops** | **5** | 🔴 **THE FIX FOR YOUR BROKEN SCREW COLUMNS.** Default is 2. At 0.4mm each, 5 walls = 2mm of solid shell — on a Ø7.8mm boss that is nearly the entire column. |
| Top shell layers | **6** | Current checked coupon profile. |
| Bottom shell layers | **6** | Current checked coupon profile. |
| Seam position | **Aligned** | Puts the layer-change blob in a consistent line instead of scattering it |

## 2.2 Strength tab

| Setting | Value | Why |
|---|---|---|
| Sparse infill density | **40 %** | Current checked coupon profile; do not reduce before fit tests pass. |
| Sparse infill pattern | **Gyroid** | Strong in all directions, no sharp direction changes to shake the printer |

## 2.3 Support tab — 🔴 TURN IT ALL OFF

| Setting | Value |
|---|---|
| **Enable support** | **OFF (unchecked)** |

**Nothing in these parts needs support, for two separate reasons:**

**1. The overhangs that could be solved by shape, are.** Magnet pockets are **teardrop-shaped**
(a 45° peak instead of a round top) so they hold themselves up. Corner bosses have **gusset
cones** widening toward the floor. Neither leaves anything to remove.

**2. Everything else is just a normal bridge.** Every hole in a wall is a 10–15mm span, and a
well-cooled printer bridges **20–30mm** unaided:

| Opening | Span | |
|---|---|---|
| Pogo slots (×2) | 10mm | routine bridge |
| Wire exit | 15mm | routine bridge |
| USB cutout (pod) | 10mm | routine bridge |
| Nav holes (×3) | 4.2mm | trivial |

> **Note (v7.4):** earlier versions modelled thin sacrificial bridges into these holes. They
> have been **removed** — they were redundant at these spans, and if you forgot to snap them
> out the pogo pins and wires could not pass through. **There is now nothing to remove from
> any hole.** The STL is exactly the finished part.

**If you print with supports ON, the slicer fills the whole 60×60×50mm cavity with lattice
that you cannot reach.** That is exactly what happened to you.

## 2.4 Speed tab

| Setting | Value | Why |
|---|---|---|
| Outer wall | **30 mm/s** | Slower = better surface |
| Inner wall | 45 mm/s | |
| Sparse infill | 60 mm/s | |
| **Travel** | **150 mm/s** | Fast travel = less time to ooze = less stringing |
| First layer | **20 mm/s** | Adhesion |

## 2.5 Filament tab — 🔴 THE STRINGING FIX

| Setting | Value | Why |
|---|---|---|
| Nozzle temperature | **230 °C normal / 235 °C first layer** | Matches the checked NuMaker PETG profile. |
| Bed temperature | **80 °C** | |
| **Retraction length** | **1.0 mm** | 🔴 **Kobra Neo is DIRECT DRIVE.** Most guides say 5–6mm — that is for Bowden printers and will jam yours. |
| Retraction speed | **35 mm/s** | |
| Z-hop when retracting | **OFF / 0 mm** | Matches the checked machine profile; change only after a calibration test. |
| Wipe on retract | **ON** | |

### 🔴 The thing that actually causes stringing: wet filament

**PETG absorbs moisture from the air, and Patiala is humid.** Wet filament strings no matter
how perfect your settings are — the water boils out of the nozzle as steam.

**Dry it before printing:**
- Oven at **60–65 °C for 4–6 hours** (door slightly ajar). Do **not** exceed 70 °C or the spool warps.
- Or a food dehydrator at 65 °C
- Store it afterwards in a sealed box with silica gel

If the filament crackles or pops as it extrudes, it is wet. That is your problem, not settings.

---

# PART 3 — Making JUST the screw columns solid

You asked exactly the right question: you want the screw columns denser without making the
whole part 100 % infill. This is a **modifier**.

**Honest answer first:** with **Wall Loops = 5** the columns are already nearly solid, and that
alone will probably fix the breakage. Try that before bothering with modifiers.

If you still want them fully solid:

1. Load `outer_box.stl`, **right-click** the model
2. **Add modifier** → **Box**
3. A translucent box appears. In the right-hand **Object list**, select it.
4. Set its **size and position** so it encloses one corner boss:
   - Size: `12 × 12 × 40` mm
   - Position: `X = 26`, `Y = 21`, `Z = 20` (that is one boss; the four are at X ±26, Y ±21)
5. With the modifier still selected, in the parameter panel below, click **+ Add setting** →
   **Strength** → **Sparse infill density** → set it to **100 %**
6. **Repeat for the other three corners** (or select the modifier, Ctrl+C / Ctrl+V, and change
   the position)

Anything inside that box prints at 100 % infill; everything else stays at the checked 40 %.

> The same trick works for the mid-plate ledge or any other feature you want beefed up.

---

# PART 4 — Orientation, part by part

🔴 **`outer_box` must be printed OPEN SIDE UP.** The rim sits on the bed, cavity facing the
ceiling.

> A previous version of our own notes said to flip it rim-down. **That was wrong and I've
> corrected it.** Nothing can bridge a 60mm cavity, and flipping it hangs the four Ø7.8 × 37mm
> bosses tip-first in mid-air — which is very likely why yours snapped.

| Part | Orientation | Supports | Layer | Infill | Walls |
|---|---|---|---|---|---|
| **outer_box** | **Open side UP**, solid floor on bed | ❌ OFF | 0.16 | 40 % | **5** |
| **base_plate** | Flat, standoffs UP | ❌ OFF | 0.16 | 40 % | 5 |
| **mid_plate** | Flat, collar UP | ❌ OFF | 0.16 | 40 % | 5 |
| **top_plate** | HOLD pending top-interface coupon | ❌ OFF | 0.16 | 40 % | 5 |
| **esp32_pod_shell** | HOLD; open side UP, solid floor on bed | ❌ OFF | 0.16 | 40 % | **5** |
| **esp32_pod_lid** | HOLD; flat, ridges UP | ❌ OFF | 0.16 | 40 % | 5 |
| **pogo_end_cap** | HOLD; TPU 95A only, spool-specific profile required | ❌ OFF | — | — | — |

---

# PART 5 — Producing the G-code

1. **Load** the STL: `File → Import → Import STL`, pick e.g. `cad/stl/outer_box.stl`
2. **Orient it** per Part 4. `Rotate` tool on the left toolbar; hold the mouse on a face and
   use **Place on face** to drop a chosen face onto the bed.
3. **Check the settings** from Parts 2–3
4. **Slice** — the `Slice plate` button, bottom right
5. **Inspect the preview.** This is the step that would have saved your first print:
   - Drag the **vertical layer slider** on the right up and down
   - Look for **blue/teal support material** — if you see any, supports are still on. Turn them off.
   - Check the bridges over the pogo slots and wire exit actually appear as thin flat spans
   - Confirm the corner bosses look solid, not hollow
6. **Export G-code** → save to an SD card as e.g. `outer_box.gcode`
7. Hand the SD card to the lab. They just load and print.

> **Print ONE released coupon first** — `motor_cam_socket_coupon` is the shortest useful gate. Do not print
> `pogo_end_cap` from the PETG profile; it remains TPU-only and spool-gated. A coupon tells you
> whether your settings are right before you commit 3 hours to the box.

---

# PART 6 — After the print

| Job | How |
|---|---|
| Clean the screw holes | The M2.5 pilots print ~0.2–0.3mm undersize. Run a **2.5mm drill bit** through by hand — do not power-drill, you'll melt it. |
| Magnet pockets | Should be clear (teardrop shape). If tight, a **8mm** bit turned by hand. |
| Stringing wisps | Snip with flush cutters, or wave a heat gun / lighter **quickly** past them (do not hold it there) |
| Layer lines | 400 → 800 grit wet sandpaper if you care cosmetically |

---

# PART 7 — How to close the Brain Pod

The pod is two printed parts: **shell** (the open box) and **lid**.

```
                    ┌─────────────────────┐
                    │   POD LID           │  ← 3 ridges on top (tactile ID)
                    │  o               o  │  ← 2 screw holes at X = ±27.5
                    └──┬───────────────┬──┘
                       │               │      the lid's front/back SKIRT
   ┌───────────────────┴───────────────┴───┐  drops over the shell and
   │  POD SHELL                            │  self-locates it
   │    [ESP32 sits on header strips]      │
   │  ●                                 ●  │  ← 2 screw BOSSES, also at X = ±27.5
   └───────────────────────────────────────┘
```

**Steps:**
1. ESP32 plugged into its header strips inside the shell, wires routed
2. Lower the lid straight down — the **skirt on the front and back edges** slides over the
   shell walls and centres it. The left/right ends stay flush (those are the docking faces).
3. The two holes line up over the two bosses
4. Drive **2 × M2 × 8mm self-tapping screws** down through the lid into the bosses

**Screw length matters:** the lid is 4mm thick and the boss is 8mm deep. An **M2×8** leaves
4mm of thread biting into the boss. An M2×6 only gives 2mm and will strip out — do not use it.

**No glue.** The pod is meant to open so you can swap the ESP32.

---

# Appendix A — Cura equivalents

| OrcaSlicer | Cura |
|---|---|
| Wall loops | **Wall Line Count** |
| Sparse infill density | **Infill Density** |
| Enable support | **Generate Support** |
| Retraction length | **Retraction Distance** |
| Top shell layers | **Top Layers** |
| Modifier box | **Per Model Settings** → *Modify settings for overlaps* |
| Slice plate | **Slice** |

In Cura you must also set the cog icon → **Setting Visibility → Expert** or most of these stay hidden.

# Appendix B — Manual Kobra Neo profile (only if it's not built in)

Add Printer → Custom / Add local printer:

| | |
|---|---|
| Build volume | 220 × 220 × 250 mm |
| Nozzle | 0.4 mm |
| Filament | 1.75 mm |
| Extruder | **Direct drive** |
| Bed shape | Rectangular, origin front-left |
| Firmware / G-code flavour | **Marlin** |
| Start G-code | leave the default Marlin one |

---

# The five-line version

1. **Supports OFF** — every overhang is already handled in the CAD
2. **Wall loops = 5** — this is what fixes the broken screw columns
3. **Retraction 1.0mm** — Kobra Neo is direct drive, not Bowden
4. **Dry the PETG** — 60–65 °C for 4–6 h; wet filament strings regardless of settings
5. **outer_box prints OPEN SIDE UP** — never rim-down
