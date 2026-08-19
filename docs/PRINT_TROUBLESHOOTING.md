> **2026-08-19 release gate:** Use `PRINT_RELEASE_2026-08-19.md` and its checked Orca G-code.
> This document is historical troubleshooting reference. The final top plate waits for its
> interface coupon, and the rebuilt snap end cap is TPU 95A only - never PETG.
# Braillix — FDM Print Troubleshooting & Cura Settings Guide

**Printer:** Anycubic Kobra Neo (0.4mm nozzle, direct-drive extruder, 220×220 bed)
**Slicer:** Ultimaker Cura
**Material:** Numakers PETG-HS — nozzle 230–240 °C, bed 80 °C
**Resin parts** (cam, linkages, nav caps, dot insert) go to an online SLA service and are **not** covered by the Cura settings here — see §2.8.

All Cura setting names below are written **exactly as they appear in the Cura UI**. If you can't find one, set settings visibility to **Expert / All** (gear icon next to the search box in the Print Settings panel), or type the name into the search box.

> ⚠️ **Correction to the previous version of this file.** An earlier draft said to flip `outer_box` 180° and print it rim-down so the printer "bridges across the gap". **That is wrong and will produce a much worse part.** The cavity is 60mm wide — nothing bridges 60mm — and flipping puts the four 37mm corner bosses in the air, tip-first, exactly the bosses that already snapped on the real print. Print `outer_box` **open side UP**. Full reasoning in §2.1.

---

## 0. The one-line answer

> **You should not have had supports on `outer_box` at all.** The current part uses self-supporting teardrop magnet pockets, real open pogo windows, and gusseted bosses. There are no printed-in sacrificial window bridges. Turning on **Generate Support** with **Support Placement = Everywhere** fills the internal cavity and can weld around bosses and ledges.

Sections 1 and 2 cover both halves of the fix: how to make supports removable when you genuinely need them, and how to orient each part so you never need them.

---

## 1. Why the supports were unremovable

Welded supports are almost never bad luck. They are a small set of settings, and one of them dominates.

### 1.1 Support Z Distance — the single biggest cause

**Cura:** *Support* → **Support Z Distance**, which expands into **Support Top Distance** and **Support Bottom Distance**.

This is the deliberate air gap between the top of the support and the underside of the part. If it is **0**, the support is not a support — it is *part of the model*, extruded in the same continuous motion, fully bonded. No tool will get it out cleanly; you will tear the part surface off instead.

Cura's default is `0.2mm`, and a lot of profiles (including several community Kobra Neo profiles) ship it at `0` or `0.1`, because that gives the prettiest overhang surface **on PLA**.

**PETG needs a LARGER Z distance than the PLA defaults every guide assumes.** PETG has much higher interlayer adhesion and stays tacky longer at 235 °C, so it happily bonds across a gap that PLA would have left as a clean break. The gap must also be an exact **multiple of your layer height**, or Cura rounds it and you get something you didn't ask for.

| Setting | PLA default | **Use for PETG @ 0.2mm layers** | Notes |
|---|---|---|---|
| **Support Z Distance** | 0.2 | **0.4** | = 2 layers. Master value; fills in the two below. |
| **Support Top Distance** | 0.2 | **0.4** | The gap *under* the part. This is the one that welds. Never below 0.3 on PETG. |
| **Support Bottom Distance** | 0.2 | **0.2** | Gap where support lands *on* the part. Keep smaller — too big and the tower is unstable. |

At **0.16mm** layers use Top Distance `0.32`; at **0.12mm** use `0.36` (3 layers). Always a whole number of layers.

*Trade-off, stated honestly:* a 0.4mm gap means the first layer bridging over the support droops slightly, so the supported face is visibly rougher than with a 0.2 gap. That is the correct trade. A rough face you can sand beats a welded face you destroy trying to clean.

### 1.2 Support Pattern — grid is the trap

**Cura:** *Support* → **Support Pattern**

- **Grid** (the default in several profiles) prints lines in **both X and Y**, and every intersection is a welded junction. The result is a rigid 3D lattice with the shear strength of a solid block. That is exactly the "rock solid, could not be plucked out" you hit. In a deep pocket like the `outer_box` cavity, grid support is functionally a second solid part inside your part.
- **Zig Zag** prints one continuous line snaking back and forth in **a single direction**, with no cross-bracing. It is weak in shear, so a support wall collapses and comes out as one connected ribbon — grab one end with pliers and unzip it.
- **Lines** is even easier to remove but topples on tall supports.
- **Triangles / Cross / Concentric / Gyroid** — not for removability. Triangles is the worst of the lot: grid plus diagonals.

**Set Support Pattern = Zig Zag.** There is no case in this project where Grid is the right answer.

### 1.3 Support Density

**Cura:** *Support* → **Support Density** (and the derived **Support Line Distance**)

Cura defaults to 15–20 %. That is far denser than needed, and it packs lines close enough that neighbouring lines fuse sideways into solid sheets.

- **Support Density: 8 %** for PETG (≈5mm Support Line Distance at 0.4mm line width). Go to 10 % only if a tower visibly topples.
- **Support Wall Line Count: 0.** Quietly lethal. If it is 1 (a common default), Cura draws a solid perimeter around every support region, turning your loose 8 % lattice into a **rigid closed tube**. At 0, the support has no shell and no hoop strength.
- **Support Infill Layer Thickness: 0.2** (= layer height). Multiples print faster but come out stiffer.
- **Gradual Support Infill Steps: 0.** Gradual infill *densifies* support near the part — the exact opposite of what you want.

### 1.4 Support Interface / Roof

**Cura:** *Support* → **Enable Support Interface**, which reveals **Enable Support Roof**, **Enable Support Floor**, **Support Interface Thickness**, **Support Interface Density**, **Support Interface Pattern**.

The interface (roof) is a dense, near-solid raft at the very top of the support, right under the part. It makes the supported surface much smoother — and much harder to remove, because you replaced a few thin line-contacts with a solid plate pressed against the overhang.

**On PETG, start with Enable Support Interface = OFF.** With 0.4mm Top Distance and Zig Zag, supports then peel by hand.

If a surface genuinely needs the finish (none of the Braillix PETG parts do, in the orientations in §2), enable it but detune it:

| Setting | Value |
|---|---|
| Enable Support Interface | On |
| Enable Support Roof | On |
| Enable Support Floor | **Off** — floors weld to the part's *top* surfaces, pure downside |
| Support Interface Thickness | 0.8 (4 layers) |
| **Support Interface Density** | **40–50 %** (Cura defaults to 100 % = a solid welded plate) |
| Support Interface Pattern | **Zig Zag** (default is Concentric — a nightmare to pick out) |
| Support Top Distance | keep **0.4** — don't let a "quality" profile drop it |

### 1.5 Support X/Y Distance

**Cura:** *Support* → **Support X/Y Distance**, **Support Distance Priority**, **Minimum Support X/Y Distance**.

The horizontal gap between support and part. It governs supports growing *alongside* vertical walls — exactly what happened around your four Ø7.8mm corner bosses and along the cavity walls.

- **Support X/Y Distance: 0.8mm** (2 × nozzle width). Cura's 0.7 default is borderline on PETG; 0.8 is a clean two-line gap. Below ~0.5 the support and the wall extrude into each other and become one object.
- **Support Distance Priority: `Z overrides X/Y`.** This matters more than it sounds. With `X/Y overrides Z` (Cura's default) the horizontal gap wins at the edges of an overhang, which *cancels the Z gap right where support meets the underside of the part* — so the outermost ring of support welds to the part edge even though you set Top Distance correctly.
- **Minimum Support X/Y Distance: 0.4** (used when Z overrides X/Y; keeps support from touching walls at all).
- **Support Horizontal Expansion: 0** — a positive value grows support footprints toward your part.
- **Support Join Distance: 2.0** — merges nearby support islands so you pull out fewer separate chunks.

### 1.6 Support Placement — the setting that created the problem

**Cura:** *Support* → **Support Placement**: `Everywhere` | `Touching Buildplate`

- **`Everywhere`** lets support generate on top of *the model itself*. On `outer_box` printed open-side-up that means Cura fills the whole internal cavity, builds on the electronics-pocket floor, on the mid-plate ledge at z=20, around all four corner bosses, and around the muscle-board bosses, cable hooks and wire guides. Every one of those contacts is a weld point somewhere your fingers and pliers cannot reach. **This is why it was impossible.**
- **`Touching Buildplate`** only allows support rising from the bed. It cannot generate inside a closed pocket. **Use this.**

Also raise **Support Overhang Angle** from `45°` to **`50–55°`** — PETG on this printer holds 50° unsupported, so 45 is over-supporting. And set **Minimum Support Area: 3–5 mm²** to kill the one-line slivers that are impossible to grip.

**Support Structure:** `Normal` is right for these boxy parts. `Tree` touches less surface and reaches awkward spots — only worth trying if you ever print the pod in an unusual orientation.

Finally: **Enable Support Brim = Off** for PETG on a heated bed. A support brim is welded to the bed *and* to the support — a second thing to chisel off.

### 1.7 Complete "removable support" preset (PETG, 0.2mm layers)

Apply only when a part actually needs support (per §2: **none of them do**).

```
Generate Support                    On
Support Structure                   Normal
Support Placement                   Touching Buildplate
Support Overhang Angle              52
Support Pattern                     Zig Zag
Support Wall Line Count             0
Support Density                     8 %
Support Horizontal Expansion        0
Support Infill Layer Thickness      0.2
Gradual Support Infill Steps        0
Enable Support Interface            Off
Support Z Distance                  0.4
  Support Top Distance              0.4
  Support Bottom Distance           0.2
Support X/Y Distance                0.8
Support Distance Priority           Z overrides X/Y
Minimum Support X/Y Distance        0.4
Support Stair Step Height           0.2
Support Join Distance               2.0
Minimum Support Area                3
Enable Support Brim                 Off
```

### 1.8 What is NOT support (do not throw these away)

Two CAD features *look* like support in the slicer preview and must survive printing until you deliberately remove them:

- **Current pogo and USB openings are real open geometry.** No sacrificial bridge module remains. Do not preserve, score, or snap any 0.6 mm ledge; remove loose strings only. The teardrop magnet-pocket roof below is intentional self-supporting geometry.
- **Teardrop magnet pockets.** The 8.4mm horizontal magnet pockets have a 45° peaked roof instead of a round top, because round horizontal holes in vertical walls **fused closed** on the fit-test print. The teardrop is self-supporting — it needs no support and must not be "fixed".

---

## 2. Per-part settings — orientation is the real fix

Every PETG part in this project is designed to print **with zero supports**, in the orientation documented in its SCAD header. If your slice shows support, either the orientation is wrong or Generate Support is simply on.

Common base settings for all PETG parts unless a table below overrides them:

| | |
|---|---|
| Printing Temperature | 235 °C (range 230–240; go toward 230 if stringing) |
| Printing Temperature Initial Layer | 240 °C |
| Build Plate Temperature | 80 °C |
| **Wall Line Count** | **5** — from the v6.1 fit-test: 5 perimeters is what makes the small bosses print solid |
| Top Layers / Bottom Layers | **5 / 5** |
| Top/Bottom Thickness | 1.0mm |
| Infill Pattern | Cubic (or Gyroid) |
| Enable Retraction | On — **Retraction Distance 1.5–2.5mm @ 35 mm/s** (Kobra Neo is **direct drive**; do NOT use the 5–6mm Bowden numbers you'll find online) |
| Print Speed | 45 · Outer Wall 25 · Inner Wall 40 · Top/Bottom 30 · Initial Layer 20 (mm/s) |
| Fan Speed | 40 % · Initial Fan Speed 0 % · Regular Fan Speed at Layer 3 |
| Build Plate Adhesion Type | Brim 8mm for tall parts, Skirt for flat plates |
| **Generate Support** | **Off** |

### 2.1 `outer_box.stl` — open side **UP**

| | |
|---|---|
| **Orientation** | **Floor flat on the bed, open cavity facing UP.** As exported; no rotation. |
| **Supports** | **NO** |
| Layer Height | 0.2mm |
| Infill Density | 25 % |
| Wall Line Count | 5 |
| Adhesion | Brim 8mm (68×68 footprint, 54mm tall, PETG — cheap insurance) |

**Open-side-down vs open-side-up — settled:**

Printed **open-side-DOWN** (rim on the bed), the 4mm floor becomes a **ceiling spanning the full 60×60mm cavity**. Nothing bridges 60mm — Cura *must* fill the whole cavity with support, which is a worse version of the problem you already had. And it gets worse:

- The four **Ø7.8 × 37mm corner bosses** would hang down from that ceiling as free-standing pillars printed tip-first, each needing its own support tower. These bosses **already snapped on the real print**; v6.2 added gusset cones at their **base** precisely because that is where the load is. Printing upside down puts the weak tip on the bed and the gusset in the air — mechanically backwards.
- The **mid-plate ledge at z=20**, the **electronics pocket floor**, the **cable hooks**, the **muscle-board bosses** and the **wire gutters** all invert into overhangs.
- The **rim** — the flat top face at z=54 that the `top_plate` over-cap seats on — would be squashed against the bed with elephant's foot, ruining the seating plane for the entire cam/standoff/top-plate stack.

Printed **open-side-UP** (the shipped design intent), the floor is the bed layer, the walls rise vertically, the bosses grow from their gusseted base upward, the pogo windows are handled by the printed-in 0.6mm bridges, and the magnet pockets are teardrops. **Nothing in the part exceeds a 50° overhang.** The only mild overhangs are the 1.5mm-wide mid-plate ledge and the 1.5mm cable-hook lips — both short enough to bridge cleanly at 40 % fan.

If Cura still wants support with the part open-side-up, the cause is **Support Placement = Everywhere**, not the geometry. Turn Generate Support off and re-preview.

### 2.2 `esp32_pod_shell.stl` — upright, open top **UP**

| | |
|---|---|
| **Orientation** | Upright, **open top facing UP** (per the `esp32_pod_shell.scad` header) |
| **Supports** | **NO** |
| Layer Height | 0.2mm |
| Infill Density | 25 % |
| Wall Line Count | 5 |
| Adhesion | Brim 8mm |

The v6.1b rebuild made the **switch cages** (side fins + a solid back wall rising from the floor) and moved the **lid screw bosses** to x=±27.5 so they embed 2mm into the wall — both changes exist *specifically* so nothing floats and nothing needs support. With support **Everywhere**, Cura packs the pod interior and welds into the switch cages and the header channels, which are the two things you can't clean out afterwards. The USB cutout has its own 0.6mm printed bridge; nav-button holes and magnet pockets are teardropped.

### 2.3 `esp32_pod_lid.stl` — outer face **DOWN**

| | |
|---|---|
| **Orientation** | **Flat, cosmetic/outer top face DOWN on the bed** (per `esp32_pod_lid.scad`: "Print orientation: flat (face down)"). The ±Y skirt and the barrel-jack cradle then point upward and are self-supporting. |
| **Supports** | **NO** |
| Layer Height | 0.2mm |
| Infill Density | 30 % |
| Wall Line Count | 5 |
| **Top Layers / Bottom Layers** | **6 / 6** — see note |

**From the v6.1b fit-test:** the lid's recessed face **printed as exposed infill** on the real part. That is a slicer problem, not a CAD problem — too few solid layers over a shallow recess. Top Layers ≥ 5 (6 is safer at 30 % infill). Face-down also means the ⠿ pod-ID marker and the P/S/N labels form against the glass, giving the sharpest possible edges. Set **Initial Layer Horizontal Expansion = −0.1mm** so elephant's foot doesn't smear them.

### 2.4 `base_plate.stl` — flat, standoffs **UP**

| | |
|---|---|
| **Orientation** | Flat, **motor/cam side and the 8mm standoffs facing UP**, plain underside on the glass |
| **Supports** | **NO** |
| Layer Height | 0.2mm |
| Infill Density | **40 %** — this plate carries the motor and the whole cam/linkage stack |
| Wall Line Count | 5 |

The underside ribs were **deleted in v6.1b**, partly for exactly this reason: printing flat put the ribs on the bed and bridged the plate body over 3mm of air, giving a waffled underside. It is now a solid 5mm plate — put the plain face on the glass and you get a flat, dimensionally-true reference surface for free. The cam pocket (Ø46 × 3mm), motor seat and shaft clearance are all pockets opening **upward**: no support. Ream the four Ø4.3mm motor mount holes (§4.4).

### 2.5 `mid_plate.stl` — flat

| | |
|---|---|
| **Orientation** | Flat on the bed (2mm plate; put the face you care about down) |
| **Supports** | **NO** |
| Layer Height | 0.16mm — at 0.2 a 2mm plate is only 10 layers; 0.16 gives 12–13 and a cleaner edge on the relief slot |
| Infill Density | 40 % (largely academic — at 2mm the skins nearly meet) |
| Wall Line Count | 4 |

Every feature is a through-cut: boss clearance holes, shaft hole, motor wire slot, the ULN2003 relief slot at (+X,−Y), the edge notches. Nothing overhangs. Thin flat plates are the parts most likely to warp in PETG — use a Skirt, keep the part off the bed edges, and add a 5mm Brim if a corner lifts.

### 2.6 `top_plate.stl` — reading face **UP** — *this is now a PETG part*

**HOLD for final use until `top_interface_coupon.gcode` passes with the real M2.5 screw and resin insert.**

| | |
|---|---|
| **Orientation** | Flat, **recessed reading face UP**, plain underside on the bed |
| **Supports** | **NO** |
| Layer Height | **0.16mm** — this is a surface a user touches |
| Infill Density | 40 % |
| Wall Line Count | 5 |
| Special | **Enable Ironing: On** for the finger-pad recess |

**This part changed in v7.2 and the workshop README hasn't caught up.** `top_plate` used to be resin. All the precision features — six 1.7mm dot holes, six 2.2mm spring bores with 0.4mm dividing walls (one nozzle width, genuinely un-FDM-able) — moved out into `dot_insert.scad`, a ~15mm resin tile that glues into a rebate. What remains in `top_plate` is an 11.2mm square opening and a 15.2mm rebate: ordinary FDM geometry. **Print `top_plate` in PETG; order `dot_insert` from the SLA service.**

Reading-face-up means the finger-pad recess, the screw counterbores and the insert rebate are all pockets cut downward from the top — no support anywhere. The rebate floor is the **glue shelf** for the resin insert, so it must be flat and at the right depth; that is what the ironing and 0.16mm layers buy you. **Do not apply Hole Horizontal Expansion to this part** — the rebate is a fit surface with only 0.1mm/side designed clearance.

### 2.7 `pogo_end_cap.stl` — flat, open side **UP**

| | |
|---|---|
| **Orientation** | Flat, open/hollow side facing UP |
| **Supports** | **NO** |
| Material | **TPU 95A ONLY** (the hollow tongue and barbs require controlled flex) |
| Layer Height | 0.16mm |
| Infill Density | 30 % |
| Wall Line Count | 3 |

**TPU profile gate:** Do not reuse the PETG G-code. Wait for the exact TPU 95A spool, then use its manufacturer temperatures with roughly 20-25 mm/s, 0.5-1 mm retraction, 3-4 walls, no support, and no ironing. Validate the cap in `pogo_receiver_coupon` for 20 insertion/removal cycles.

### 2.8 Resin parts — hand these to the SLA service, not to Cura

| Part | Qty | Orientation to request | Material |
|---|---|---|---|
| `braille_cam` | 1 | Hub DOWN, cam tracks UP | Tough / ABS-like |
| `linkage` | 8 (6 + 2 spares) | Flat on the plate, all plies on one plate | Tough / ABS-like |
| `nav_cap` | 3 | Flat, dome UP | Tough / ABS-like |
| `dot_insert` | 1–2 | Flat, holes vertical | Tough / ABS-like |

Explicitly specify **TOUGH or ABS-like resin, not standard brittle resin** — the linkages are load-bearing. Resin handles the 0.1mm gaps and 1.7mm holes that FDM cannot; **do not apply FDM tolerance edits to these files** (no hole reaming, no gap widening).

### 2.9 Quick reference

| Part | Material | Orientation | Support | Layer | Infill | Walls |
|---|---|---|---|---|---|---|
| `outer_box` | PETG | Open side **UP** | **No** | 0.2 | 25 % | 5 |
| `esp32_pod_shell` | PETG | Upright, open top **UP** | **No** | 0.2 | 25 % | 5 |
| `esp32_pod_lid` | PETG | Outer face **DOWN** | **No** | 0.2 | 30 % | 5 |
| `base_plate` | PETG | Flat, standoffs **UP** | **No** | 0.2 | 40 % | 5 |
| `mid_plate` | PETG | Flat | **No** | 0.16 | 40 % | 4 |
| `top_plate` | PETG after interface coupon | Reading face **UP** | **No** | 0.16 | 40 % | 5 |
| `pogo_end_cap` | TPU 95A only | Flange down, hollow tongue **UP** | **No** | 0.16-0.20 | spool-specific | 3-4 |
| `braille_cam`, `linkage`, `nav_cap`, `dot_insert` | Resin (SLA) | see §2.8 | — | — | — | — |

---

## 3. Internal surface roughness

"Rough where components have to mount" has three separate causes on these parts. Fix the right one.

### 3.1 Cause A — torn support scars

If the surface was supported, the roughness **is** the support. Fix it upstream with §1 and §2 (mostly: don't support at all). Nothing in post-processing fully recovers a face that had support welded to it.

### 3.2 Cause B — upward-facing internal floors printed over infill

The `outer_box` electronics-pocket floor, the mid-plate ledge, the lid recess and the muscle-board boss seats are all **top surfaces**. If Cura doesn't put enough solid layers over the infill beneath, you get pillowing — visible infill lines and a dimpled surface. That is precisely what happened to the lid recess on the fit-test print.

| Setting | Value | Why |
|---|---|---|
| **Top Layers** | **5** (6 on the lid) | 5 × 0.2 = 1.0mm of solid skin. Cura's default 4 at 20 % infill isn't enough for PETG. |
| **Bottom Layers** | **5** | |
| Top/Bottom Thickness | 1.0mm | |
| **Infill Density** | **≥ 25 %** | Skin quality is a function of how far the first solid layer must bridge. At 15 % infill, no number of top layers saves you. |
| Infill Pattern | Cubic | Better skin support than Lines/Zig Zag, less stringy than Gyroid on PETG |
| **Enable Ironing** | **On** for `top_plate`, `esp32_pod_lid`, `base_plate` | §3.4 |
| Top/Bottom Speed | 30 mm/s | Slower = flatter skin |
| Skin Overlap Percentage | 10 % | Fuses the skin into the walls |

### 3.3 Cause C — downward-facing internal surfaces (the hard one)

Undersides of ledges (mid-plate ledge, hook lips, pocket ceilings) are printed into air. They will always be the worst surfaces on the part. Improve them with:

| Setting | Value | Why |
|---|---|---|
| **Layer Height** | 0.16 or 0.12 on critical parts | Smaller stair-steps on every sloped surface, shorter unsupported span per layer |
| **Enable Bridge Settings** | **On** | Cura applies dedicated bridging behaviour on detected spans |
| Bridge Wall Speed / Bridge Skin Speed | 15–20 mm/s | Slow bridges droop far less |
| **Bridge Fan Speed** | **100 %** | Full cooling *only* on bridges — freezes the extrusion mid-air without wrecking adhesion elsewhere |
| Bridge Skin Density | 100 % | |
| **Regular Fan Speed** | **40 %** | PETG-specific. 100 % fan everywhere kills interlayer adhesion (that's the brittle, delaminating PETG everyone complains about); 0 % gives sagging overhangs and stringing. 40 % is the working compromise on a Kobra Neo — test 30–50 %. |
| Minimum Layer Time | 6 s | Lets small cross-sections cool before the next layer |
| Lift Head | Off | Leaves blobs on a single-part print |

Also **drop the nozzle to 230 °C** if overhangs droop — the whole 230–240 band works with this filament, and the low end is measurably cleaner on overhangs at some cost in layer strength.

### 3.4 Ironing — where it actually applies

**Cura:** *Shell* → **Enable Ironing**, **Iron Only Highest Layer**, **Ironing Pattern**, **Ironing Flow**, **Ironing Inset**, **Ironing Line Spacing**, **Ironing Speed**.

Ironing re-runs the hot nozzle over finished **top surfaces** with almost no extrusion, melting the ridges flat. Know the limits:

- It works **only on upward-facing flat top surfaces**. It does **nothing** for downward-facing or vertical surfaces — it will not fix §3.3.
- It roughly doubles the time spent on those surfaces.
- On PETG it can drag and leave stringy boogers if the flow is too high. Start low.

| Setting | Value |
|---|---|
| Enable Ironing | On (per-part: `top_plate`, `esp32_pod_lid`, `base_plate`) |
| Iron Only Highest Layer | **Off** — you want the internal pocket floors ironed too, not just the topmost layer |
| Ironing Pattern | Zig Zag |
| **Ironing Flow** | **8 %** (Cura default 10 %; drop to 6 % if it blobs) |
| Ironing Line Spacing | 0.1mm |
| **Ironing Inset** | **0.35mm** — keeps the nozzle from pushing melt over the outer wall edge |
| Ironing Speed | 20 mm/s |

**Do not iron** `outer_box` or `esp32_pod_shell` — their floors are deep inside a box, the nozzle will drag on the walls, and those surfaces are hidden anyway.

### 3.5 Mounting surfaces specifically

For the muscle-board boss tops, the motor seat and the mid-plate ledge, the practical answer is mechanical rather than slicer-based: after printing, run a **flat needle file**, or a **chisel-blade hobby knife held flat**, across the seat and check against a steel rule. Two minutes of filing beats an hour of slicer tuning, and these are non-cosmetic surfaces.

---

## 4. Post-processing

### 4.1 Support removal (and sacrificial-bridge removal)

**Tools worth owning** — all cheap, all easy to source:

- **Flush / side cutters** — the primary tool. Get in at the base of a support wall, snip, then peel.
- **Needle-nose pliers** — grip and roll support ribbons out of pockets.
- **Dental pick set / hook probe** (~₹150 for six) — the only thing that reaches into 6–10mm pockets.
- **Hobby knife** (X-Acto / scalpel #11) plus spare blades.
- **Deburring tool** (swivel blade) — the single best tool for cleaning hole edges and cut lines.
- **Small flat + round needle files.**

**Technique:**

1. **Do it while the part is warm**, straight off the bed (~40–50 °C). PETG is far less brittle warm — supports peel instead of shattering into fragments you then have to pick out.
2. Start at an **edge or corner** of a support region, never the middle. With Zig Zag at 8 % you can usually catch the ribbon end and unzip the whole wall.
3. **Never lever against the part.** Lever against your own pliers or a bench block. Prying off a boss is how bosses snap — and these bosses have already snapped once.
4. The **freezer trick** (20 min at −18 °C; differential contraction pops supports loose) works well on PLA and only somewhat on PETG. Try it before resorting to force — it costs nothing.
5. If a support is genuinely welded, **stop**. Cut it flush with a knife, leave the stub, sand it. Pulling harder takes part material with it.

**No sacrificial bridge material remains in the current outer box or pod.** The windows are real open geometry. Remove only loose strings; do not cut or snap a structural wall. Verify the 10 x 8 mm pogo opening with `pogo_receiver_coupon` before printing the enclosure.

### 4.2 Sanding

PETG **gums up dry paper** and melts under a powered sander. Wet-sand by hand.

| Stage | Grit | Use |
|---|---|---|
| Knock down support scars, blobs, seams | **180–240** | Dry or wet, light pressure, on a sanding block |
| Blend | **400** | **Wet** — water with a drop of dish soap |
| Smooth | **800** | Wet |
| Optional sheen | 1200–2000 | Wet; only for the pod lid / top plate if you care cosmetically |

Rules:
- **Wet sand from 400 up.** Stops the paper clogging and stops heat glazing the surface.
- **Back the paper with a block** on flat surfaces — fingers give you a wavy surface.
- **Do not sand fit surfaces:** the `top_plate` insert rebate, magnet pockets, boss seats, mid-plate ledge, motor seat, cam pocket. All have ≤0.4mm designed clearance and sanding blows the tolerance.
- **No acetone smoothing** — PETG doesn't respond. **No flame or heat-gun polishing** — PETG blisters and deforms long before it polishes.
- Wear a mask. PETG dust is fine and unpleasant.

### 4.3 Stringing

PETG strings. Normal, and mostly fixable. **Work through these in order:**

1. **Dry the filament.** PETG is strongly hygroscopic and this is the #1 cause. 60–65 °C for 4–6 h in a filament dryer or food dehydrator; an oven works if it genuinely holds ≤65 °C. Tell-tale signs of wet filament: popping/crackling at the nozzle, and a foggy, rough surface as well as strings.
2. **Drop the nozzle temperature** 240 → 235 → 230 in 5° steps, printing a two-tower stringing test at each. Stop before layer adhesion suffers.
3. **Retraction — direct-drive numbers.** Retraction Distance **1.5–2.5mm**, Retraction Speed **35 mm/s**, Retraction Minimum Travel **1.0mm**, Maximum Retraction Count **25**, Minimum Extrusion Distance Window **1.0mm**. Ignore any guide quoting 5–6mm — that is Bowden advice and on the Kobra Neo's direct extruder it just grinds a flat into the filament.
4. **Combing Mode = `Within Infill`** (or `Not in Skin`) — keeps travel moves inside the part where strings don't show, and cuts the retraction count.
5. **Travel Speed 150 mm/s** — less time for ooze to form a string.
6. **Enable Coasting** (*Experimental*): **Coasting Volume 0.05–0.08 mm³**, Minimum Volume Before Coasting 0.8. Stops extruding just before the end of each line so nozzle pressure bleeds off.
7. **Z Hop When Retracted: Off** for stringing purposes (it slightly increases ooze). Enable it only if the nozzle is knocking into printed parts.

**Clean up what's left:** a **heat gun on low, held 15–20cm away, moving constantly, 2–3 seconds at a time.** Wispy strings vanish well before the part surface reaches deformation temperature. This works remarkably well on PETG — practise on a failed print first. Do **not** use a lighter: soot and localised melting.

### 4.4 Cleaning small holes and pockets

**Holes on this printer print 0.2–0.3mm undersize** — measured on the fit-test, which is exactly why the CAD pilots were already enlarged (M2: 1.7 → 2.0, M2.5: 2.1 → 2.3).

**Slicer-side compensation (optional):**
*Cura:* **Hole Horizontal Expansion = 0.10–0.15mm**. This offsets hole walls outward — 0.1 here grows a hole's **diameter** by ~0.2mm, which matches the measured error. Also set **Hole Horizontal Expansion Max Diameter = 12mm** so it applies to fastener holes but leaves the large cutouts and the 8.4mm magnet pockets alone (those already carry designed clearance and must not grow).
**Test before you commit:** print a small coupon with 1.7 / 2.0 / 2.3 / 4.3mm holes, measure with calipers, and set the expansion to half the diameter error you measure. Don't discover it on a 3-hour print.

**Drill-side clean-up — do this regardless.** Buy an **HSS micro drill set 0.5–3.0mm** (~₹300) and a **pin vise / hand chuck** (~₹200).

| Feature | As designed | Drill / ream with |
|---|---|---|
| `dot_insert` dot holes | Ø1.7 | **1.7mm** — resin part, shouldn't need it. Only if a dome binds. |
| M2 self-tap pilots (`outer_box` muscle-board bosses 1.7; pod lid bosses 2.0) | Ø1.7–2.0 | **1.6mm** if you want the screw to cut its own thread; **2.05mm** for a clearance hole |
| M2.5 corner-boss pilots (`outer_box`, 2.3) | Ø2.3 | **2.3mm** to true it; **2.6mm** for a clearance pass |
| Motor mount holes (`base_plate`, 4.3) | Ø4.3 | **4.2–4.3mm** |
| Cam shaft clearance / standoff bores | Ø6–10 | Round needle file — not a drill |
| Magnet pockets (8.4 × 1.2, teardrop) | Ø8.4 | **Do not drill.** Test-fit the 8 × 1mm magnet; if tight, a few passes with a round needle file or a rolled strip of 240 grit. Drilling destroys the teardrop roof. |
| Pogo window (10 x 8 through 4 mm wall) | rectangular | Test the receiver coupon; remove loose strings only, never cut structural wall |
| Spring bores (Ø2.2, 0.4mm walls) | Ø2.2 | **Resin insert only.** Never attempt in PETG — that is the entire reason `dot_insert` exists. |

**Drilling technique for PETG:**
- **Turn by hand in a pin vise.** A power drill grabs, melts, pulls the hole oversize and oval, or rips the part out of your hand.
- Enter from **the side that matters** (the fit side) and back the part with scrap so the exit doesn't blow out.
- Clear swarf often — PETG comes off as one long ribbon that jams the flutes.
- Deburr both faces afterwards with the swivel deburring tool, or by spinning a larger bit **by hand** in the hole mouth.

**Pockets** (electronics pocket, header channels, switch cages, wire gutters): dental pick + flat needle file, then blow out with compressed air. Check depth with digital calipers before dropping components in. Don't force a fit — find which surface is proud and remove *that*.

---

## 5. Settings to change RIGHT NOW in Cura

Apply these before your next slice. Ordered by impact.

1. **Generate Support → OFF.** Every Braillix PETG part is designed to print without it. This alone fixes your main problem.
2. **Support Placement → `Touching Buildplate`** (for the rare case you do enable support). Never `Everywhere` on these hollow parts — that is what filled the `outer_box` cavity.
3. **Support Z Distance → 0.4mm** (Top Distance `0.4`, Bottom Distance `0.2`). PETG needs double the PLA default or it welds.
4. **Support Pattern → `Zig Zag`; Support Wall Line Count → `0`; Support Density → `8 %`.** Grid plus a support wall is what made it a solid block.
5. **Support Distance Priority → `Z overrides X/Y`**, Support X/Y Distance `0.8`. Stops the outer ring of support welding to overhang edges.
6. **Top Layers → 5, Bottom Layers → 5, Infill Density → 25 % minimum.** Fixes the exposed-infill / pillowed internal surfaces (the lid recess failure).
7. **Wall Line Count → 5.** Straight from the v6.1 fit-test — 3 perimeters is why the small bosses came out weak.
8. **Fan Speed → 40 %, Initial Fan Speed → 0 %, Enable Bridge Settings ON with Bridge Fan Speed 100 %.** Clean overhangs without destroying PETG layer adhesion.
9. **Retraction Distance → 2.0mm @ 35 mm/s; Combing Mode → `Within Infill`; Travel Speed → 150 mm/s.** Kobra Neo is direct-drive — the 5–6mm advice online is for Bowden and will grind your filament.
10. **Enable Ironing ON** (Flow 8 %, Inset 0.35, Zig Zag) for `top_plate`, `esp32_pod_lid`, `base_plate` only — and **dry the PETG at 60–65 °C for 4–6 h** before the run. Half of "bad settings" is wet filament.

---

## 6. Known documentation drift (fix before the next print run)

- `print_batch/README_FOR_WORKSHOP.txt` is at **v6.1** and predates the **v7.2** change that made `top_plate` a PETG part and created `dot_insert` as the resin part. Its Batch-4 listing and its "the PETG copies are fit-test only" line are stale.
- `print_batch/Batch4_Resin/` still contains a pre-v7.2 `top_plate.stl`, and there is no `dot_insert.stl` in any batch folder. Regenerate the batch folders and the ZIP.
- The README's "Walls: 3 perimeters" contradicts the v6.1 fit-test finding that **5** is needed for the small bosses. Use 5.
- The README's "Layer height 0.2mm" for Batch 2 is fine for `base_plate`, but `mid_plate` and `top_plate` are better at 0.16 (§2.5, §2.6).

---

## Appendix — Braille geometry (carried over, for the presentation)

- **Dot size:** 1.5mm dome — inside the international standard range (1.44–1.60mm).
- **Pitch:** 4.8mm column spacing, 2.6mm row spacing. This is **jumbo braille**, used for learners and readers with reduced tactile sensitivity — a deliberate accessibility choice, not a compromise. (See §4 of the CAD audit for the full rationale.)
- **Travel height:** dots rise 0.8mm — comfortably readable.
- **Why this matters for printing:** the real braille features exist **only on the resin `dot_insert`**. On this printer, raised features under ~2.5mm print as mush — that is why all PETG parts use bold ≥3mm tactile shapes (the ^ chevron on the box front, the ⠿ marker on the pod lid) instead of braille.
