# CAD v7.5 — defect repair pass

**Date:** 2026-07-30
**Trigger:** the v7.3 pre-assembly audit found 8 blocking defects. None had been fixed.
**Scope:** everything fixable without calipers. Four items remain blocked on measurement and are
now tagged in-source with `MEASURE (Mnn)` pointing at `docs/MEASUREMENTS_NEEDED.md`.

Every part was re-rendered and checked for **`Volumes: 2`** — meaning one connected solid. That
check is what caught the floating cable hooks in v7.4 and the vanished nav caps before that;
`Simple: yes` alone does not catch disconnected geometry.

---

## Side-by-side: what changed

| # | File | Was | Now | Why |
|---|---|---|---|---|
| 1 | `mech_layout.scad` | homing magnet declared **twice**, in two files, already drifted (cam r=17.35 vs plate y=20) | one shared block: `homing_mag_dia/thk/fit/r/angle` | The sensor must sit under the magnet. Two copies guarantee they drift apart. |
| 2 | `braille_cam.scad` | `magnet_depth = 2.0` into a 2.0mm floor | `1.2` (3×**1**mm magnet), + `assert` | Pocket was a **through-hole** cratering tracks 2, 3 **and** 4. A foot crossing it jams. |
| 3 | `braille_cam.scad` | comment claimed "8mm engagement" | corrected to 6mm, full z-stack failure documented | Stale comment hid a real showstopper. |
| 4 | `base_plate.scad` | `base_length = 56` | `58` | Left ear screw had a **0.35mm** wall — breaks out. Also fixed standoffs overhanging by 1mm. |
| 5 | `base_plate.scad` | `spring_cavity()` — 22×16 through-window | **deleted** | Right motor screw (x=+9.5) opened into it → **one-screw motor**. Cavity was v6.x legacy; springs moved to the top plate in v7.1. |
| 6 | `base_plate.scad` | Ø4.3 clearance holes | Ø3.3 thread-forming pilots | A nut at x=+9.5 sits under the spinning cam. Screw now threads straight into the plate from below. |
| 7 | `base_plate.scad` | hall pocket cut **down from the top** at (0,20) | cut **up from the underside** at (0, 17.35) | Old pocket lay entirely inside the cam pocket at the same depth — **it removed nothing; the feature did not exist on the printed part.** |
| 8 | `base_plate.scad` | — | `assert` on sensor thickness | Fails loudly if the measured sensor won't fit, instead of printing a useless pocket. |
| 9 | `esp32_pod_params.scad` | `pod_length = 64` | `68` | Board overran the cavity by **1.75mm** — would not go in. Bonus: pod is now a 68×68×58 cube matching a cell exactly. |
| 10 | `esp32_pod_params.scad` | `devkit_x_offset = 4` | `-2` | Plug reach into the pod cut from 6.25mm to 2.25mm. |
| 11 | `esp32_pod_params.scad` | `usb_z = floor + strip_h + 1` | `board_under_z - 1.0` | **Arithmetic bug** — ignored `hdr_channel_depth`. Hole sat ~2mm high; only 0.5mm overlapped the port. |
| 12 | `esp32_pod_params.scad` | USB cutout 10×7 | 13×9 | A real cable's moulded body doesn't pass 10×7. |
| 13 | `esp32_pod_params.scad` | `barrel_jack_x = -22` | `-20` | Cradle overran the wall; lid couldn't close. |
| 14 | `esp32_pod_params.scad` | `lid_screw_x = 27.5` hard-coded | `pod_int_length/2 - 0.5` | **See below — this one was created by fix #9.** |
| 15 | `esp32_pod_lid.scad` | 4 hard-coded dims matching the old pod | derived from `pod_length`/`pod_width` | Lengthening the pod would have silently desynced the lid. |
| 16 | `esp32_pod_lid.scad` | — | `assert` on cradle vs wall | The overrun was invisible because all three jack dims are invented. |
| 17 | `outer_box.scad` | muscle-board bosses always on | `use_muscle_board_bosses = false` | Ø4×4mm bosses sit **inside** the ULN2003's footprint — board would perch 4mm up in a 16mm pocket. |
| 18 | `outer_box.scad`, `mid_plate.scad` | motor numbers unmarked | tagged `MEASURE (M1)`, `(M2)` | So the assumptions are findable rather than looking like facts. |

---

## The defect that fix #9 *created*

Worth recording, because it's the same bug the codebase has now hit three times.

`lid_screw_x = 27.5` was correct **only** while `pod_int_length` was 56: the inner wall sat at
x=28, so a Ø5 boss at 27.5 spanned 25–30 and embedded 2mm into the wall.

Lengthening the pod moved that wall to x=30. The boss would then have spanned 27–32 and merely
**touched** the wall at exactly one plane — a disconnected body in the STL, printing as a loose
tower. That is precisely the failure the comment block above that line was written to describe
after it happened in v6.1b.

It is now a formula tied to the wall, so it cannot drift again.

**Pattern:** hard-coded numbers that "happen to match" another dimension are the main source of
defects in this project. Fixes #1, #14 and #15 are all the same cure.

---

## Verification

All parts re-rendered from source. `Volumes: 2` = one connected solid:

| Part | Simple | Volumes |
|---|---|---|
| `outer_box` | yes | 2 |
| `mid_plate` | yes | 2 |
| `base_plate` | yes | 2 |
| `top_plate` | yes | 2 |
| `dot_insert` | yes | 2 |
| `linkage` | yes | 2 |
| `nav_cap` | yes | 2 |
| `pogo_end_cap` | yes | 2 |
| `esp32_pod_shell` | yes | 2 |
| `esp32_pod_lid` | yes | 2 |
| `braille_cam` | yes | 2 |

Both new asserts were exercised — the cam and lid render clean, so the magnet pocket leaves
enough floor and the cradle fits inside the wall.

---

## Still open — blocked on measurement

These are **not** fixable by guessing harder. Each depends on a physical number.

| Defect | Needs | Consequence if ignored |
|---|---|---|
| Cam z-stack doesn't close: `hub_h=4` into a 2mm gap | M2, M6, M7 | All six dots permanently ~2mm proud — every dot reads as "on" |
| Hall pocket depth is 1.6mm | M11b | Sensor may not fit; assert will catch it |
| Barrel jack cradle is 100% invented | M12–M16 | Jack unsupported, or lid won't close |
| ESP32 pin-row pitch: CAD says 38-pin, docs say 30-pin | M18, M21 | **ESP32 cannot plug into the pod at all** |

The z-stack must be re-derived in **one pass** once M2/M6/M7 arrive — motor height → base plate →
cam → linkage length are a single chain, and patching them individually just relocates the error.

---

## Bill-of-materials correction

**`ELECTRONICS_BOM.md` item 7 says buy a 3×2mm homing magnet. Buy 3×1mm.**

The cam disc floor is 2.0mm. A 2mm magnet needs a 2mm pocket, which removes the entire floor.
1mm leaves 0.8mm behind and couples just as well, because the magnet still sits flush with the
disc underside.

---

## What did NOT change, deliberately

- **68×68mm cell shell, docking windows, magnet pockets, 4mm walls** — already physically
  fit-tested. Untouched.
- **Teardrop magnet pockets** — correct shape-based self-support. Keep.
- **No sacrificial bridges re-added** — removed in v7.4 for good reasons documented in
  `outer_box.scad`.
- **Nothing in the resin plate-1 batch already ordered.** All of v7.5's changes are in PETG parts
  not yet printed. **Nothing in transit is affected.**
