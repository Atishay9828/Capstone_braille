# Where the electronics geometry comes from

Everything in `electronics.js` is **built procedurally** from dimensions in
`cad/scad/esp32_pod_params.scad` and `docs/ELECTRONICS_BOM.md`. Nothing is downloaded.

## Why not sourced CAD

Surveyed GrabCAD, Sketchfab, Printables, Thingiverse, SnapEDA, TraceParts and KiCad's
`packages3D` on 2026-08-04. Two findings decided it:

**1. Licensing.** This repo is public, so anything committed here is *redistributed*.

| Source | Verdict |
|---|---|
| **GrabCAD** | ❌ licence is non-commercial **internal** use and forbids passing files to third parties. Rules out the best ULN2003, 28BYJ-48 and hall-module hits. |
| **KiCad packages3D** | ✅ usable, but CC-BY-SA — share-alike would attach to the derived asset |
| **Sketchfab CC-BY** | ✅ clean licence, ⚠️ account required to download |
| **SnapEDA / TraceParts** | ⚠️ account + restrictive terms |
| **Printables / Thingiverse** | per-model; many are CC-BY-**NC** |

**2. Most of these parts are trivial.** A TO-92 is three cylinders. A pogo pin is two.
Carrying a share-alike obligation forever for sixty triangles is a bad trade.

There is also a correctness argument, and it is the stronger one: a downloaded model is
someone else's part. Our jack is an **inline pigtail**, not the PCB-mount horizontal jack
every library ships. Our DevKit is **USB-C**, while nearly every DevKit V1 model online is
the older micro-USB board. Sourcing would have produced a prettier picture of the wrong
hardware.

## The two worth sourcing later

If fidelity ever matters more than convenience, only these two earn it — both CC-BY, both
cheap, and both need a Sketchfab login (a human step, not an automated one):

| Part | Tris | Why it beats procedural |
|---|---|---|
| [28BYJ-48 stepper](https://sketchfab.com/3d-models/28byj-48-5v-stepper-motor-18b50e87e1cd46089e17ade1b1703d72) | 3.7k | genuinely awkward silhouette — stamped can, crimped rim, mounting ears, offset gearbox boss |
| [ESP32 DevKit V1](https://sketchfab.com/3d-models/esp32-78c2b5a932a1463bbc6e8ada630a0545) | 1.6k | the WROOM shield and the 30-pin header forest read better as a mesh ⚠️ micro-USB, not USB-C |

If either is ever added, drop it in `sim/3d/models/` and credit both authors here.

## Current cost

The whole electronics set is **~2,000 triangles**, against 45,660 for the mechanism GLB.
