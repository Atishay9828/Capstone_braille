STOP — STALE v6.1 ARCHIVE — DO NOT PRINT OR SEND THIS FOLDER

This pack contains old geometry, an old ZIP, 3-wall instructions, a resin top plate that is now PETG,
and no dot insert. Use docs/PRINT_RELEASE_2026-08-19.md and printing/gcode_kobra_neo_checked instead.
The remaining text is retained only as historical context.
BRAILLIX — 3D Print Job Instructions
=====================================
Project: Refreshable Braille Display (Capstone)
Material: Numakers PETG-HS (Lemon Yellow), 1.75mm
Nozzle Temp: 230-240C (rated 220-250C)
Bed Temp: 80C (rated 70-90C)
Nozzle: 0.4mm
NO SUPPORTS needed for any part.

BATCH 1 — Shells (2 files)
  Orientation: Open-top facing UP
  Layer height: 0.2mm
  Infill: 20%
  Walls: 3 perimeters
  Est. time: ~3h each = ~6h total


BATCH 2 — Plates (5 files)
  Orientation: ALL flat on bed
  Layer height: 0.2mm
  Infill: 40%
  Walls: 3 perimeters
  Est. time: ~3h total (can print together if bed fits)


BATCH 3 — Small Parts (3 files)
  Folder: Batch3_Small_Parts/
  Files:  braille_cam.stl  — print with hub/cylinder DOWN, tracks UP
          nav_cap.stl
          pogo_end_cap.stl  — TPU 95A ONLY; never PETG; no checked G-code until spool is known
  Layer height: 0.16mm (finer for small details)
  Infill: 30%
  Est. time: ~2h total (can print together)

BATCH 4 — RESIN / SLA ONLY (4 files) — do NOT print these in PETG
  Folder: Batch4_Resin/
  Files:  braille_cam.stl   (precision tracks)
          top_plate.stl     (precision holes)
          nav_cap.stl       (tactile symbols)
          linkage.stl       — print x8 plies on one plate (6 needed + 2 spares)
  Material: TOUGH or ABS-like resin (NOT standard brittle resin)
  Orientation: linkages FLAT on plate; cam hub down
  Note: the PETG copies of cam/top_plate/nav_cap in Batches 2-3 are fit-test
        only; resin versions are the functional ones.

TOTAL: 10 PETG files (~11h) + 4 resin files
v6.1 (2026-06-12): updated outer_box, esp32_pod_shell, esp32_pod_lid, base_plate,
mid_plate, pogo_end_cap — magnet pockets resized for 8x1mm magnets (teardrop),
bold tactile markers replacing braille on PETG, thicker bridges, bigger pilots.

