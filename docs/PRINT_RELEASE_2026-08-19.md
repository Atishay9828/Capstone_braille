# Braillix print release - 2026-08-19

## Verdict

**Do not print the complete product set yet.** The current production cam cannot install on the
measured 7.5 mm motor shaft, and its ramp/linkage/spring behavior still needs the physical bench
test below.

The checked PETG folder contains exactly eight files. They are either small fit tests, a mechanism
test fixture, or the stack-independent mid plate. No enclosure, production cam, base plate, pod,
or final top plate is released.

## Tomorrow's print order

### Required fit tests

1. `motor_cam_socket_coupon.gcode` - about 29 min / 2.62 g
2. `base_interface_coupon.gcode` - about 1 h 10 min / 7.97 g
3. `pigtail_slot_coupon.gcode` - about 42 min / 5.77 g
4. `pogo_receiver_coupon.gcode` - about 1 h 10 min / 12.79 g
5. `top_interface_coupon.gcode` - about 1 h 24 min / 10.70 g
6. `hardware_fit_coupon.gcode` - about 2 h 10 min / 20.03 g

Stop after any print with poor first-layer adhesion, separated walls, closed holes, heavy stringing,
or visible warping. A bad coupon means the larger part is not safe.

### Mechanism test fixture

7. `cam_linkage_test_fixture.gcode` - about 2 h 10 min / 18.80 g

This fixture is useful only with
`cad/stl/cam_linkage_test_resin_set.stl`, one real 2 mm OD spring, and the procedure in
[`MECHANISM_BENCH_TEST.md`](MECHANISM_BENCH_TEST.md). The resin set contains the real cam,
dot-5 linkage, dot-6 linkage, and dot insert. It is intentionally STL-only because the resin
printer, resin, and service settings are not specified.

### Stack-independent production part

8. `mid_plate.gcode` - about 1 h 16 min / 10.07 g

Print the mid plate only after the first coupon proves the PETG/profile is behaving normally.
Its geometry already uses the measured 28.1 mm motor body, -7.5 mm body offset, and 34.7 mm ear
spacing, and it survives the pending +4 mm upper-stack option.

## Checked PETG contract

All eight checked G-code files were freshly sliced from the current STLs with:

- NuMaker PETG HS: 235 C first layer / 230 C normal
- bed 80 C
- layer height 0.16 mm
- 5 wall loops
- 40% infill
- 6 bottom + 6 top shell layers
- 8 mm brim
- top-surface ironing
- supports disabled
- no G2/G3 arc commands

`tools/validate_print_assets.py` verifies the exact checked manifest, embedded settings,
Kobra Neo motion envelope, closed/manifold topology, expected component count, and committed
STL equality with independent fresh OpenSCAD renders.

## Coupon maps and acceptance

### Motor/cam socket coupon

The one-, two-, and three-hole tabs are 3.1, 3.2, and 3.3 mm double-flat sockets.

Use the smallest socket that:

- slides fully over the unpowered motor shaft;
- reaches and sits flat on the measured 9 mm collar;
- does not split, whiten, or require hammering;
- can still be removed using the tab.

Do not heat, glue, hammer, or power the motor during this test.

### Base-interface coupon

This has three disconnected pieces, left to right:

- Ø34 puck: real Ø29 x 1.5 mm underside motor seat around the Ø10 shaft opening. Reject it if the
  bridged locating roof sags enough that the motor cannot sit flat without rocking.
- 2 mm bar: M4 pilot holes 3.3 / 3.4 / 3.5 mm. This selects diameter/engagement only, not length.
  Use the smallest that accepts an M4x5/x6 thread-forming candidate with
  controlled thread formation and no whitening, splitting, or stripped PETG. Never use M4x10;
  after Option A approval, measure the ear/point and keep the installed tip >=0.5 mm below the cam.
- three Ø6 x 12 mm posts: M2.5 clearance bores 2.9 / 3.0 / 3.1 mm. Use the smallest free-sliding
  hole that does not split the slender post. These reproduce the proposed taller Option-A posts;
  testing them does not authorize the production stack change.

### Pigtail cable-slot coupon

The clipped corner marks the 5 x 3 mm end. The middle slot is the current 6 x 4 mm CAD value; the
other end is 7 x 5 mm. Pass only the loose red/black leads, never the barrel body. Select the
smallest opening that accepts both leads without scraping, pinching, whitening, or cutting their
insulation. Record the selected width x height before regenerating the pod lid.

### Pogo receiver coupon

Left to right, the upright bridged slots are:

- 10.0 x 8.0 mm - current production CAD;
- 10.2 x 8.2 mm;
- 10.4 x 8.4 mm.

All reproduce the real 4 mm enclosure wall. Accept a slot only if its roof prints open without
cutting structural material and the measured opening is usable. The end cap itself remains TPU
95A only. No TPU G-code is released until the exact spool is known.

### Top-interface coupon

The large keyed piece tests the actual M2.5 x 25 screw.

- clipped corner = top-left;
- columns left to right = counterbore diameters 5.4 / 5.6 / 5.8 mm;
- rows top to bottom = effective depths 1.3 / 1.5 / 1.7 mm;
- bottom plain holes left to right = 3.0 / 3.2 / 3.4 mm shank clearance.

Select the smallest/shallowest station where the real screw drops through, the head seats flat,
and a finger/straightedge does not catch it.

The separate notched strip tests the real resin dot insert:

- notched end is left;
- left to right total clearance = 0.2 / 0.4 / 0.6 mm;
- production CAD currently uses 0.2 mm total, only 0.1 mm per side.

Select the smallest pocket where the insert seats without forcing or cracking and can be removed
before gluing. The held top plate must be updated/re-sliced if the selected station is not the
current 5.6 x 1.5 mm screw seat and 0.2 mm insert clearance.

### Hardware-fit coupon

- top-left row 3.1 / 3.3 / 3.5 / 3.7: heat-set insert bores;
- bottom-left row 3.1 / 3.2 / 3.3: shaft double-flat clearances;
- top-right row 8.2 / 8.4 / 8.6: 8 x 1 mm magnet pockets;
- bottom-right row 1.7 / 1.8 / 1.9: Hall-body pocket depths.

Do not melt an insert or glue a magnet into a production shell before choosing the coupon fit.

## HOLD - do not manufacture as final parts

| Part | Blocking reason |
|---|---|
| `top_plate` | G-code moved to `printing/gcode_HOLD_fit_unproven`; real screw head and resin insert must pass the top-interface coupon |
| `braille_cam` | accidental 3.5 mm blind socket cannot install on the 7.5 mm shaft; current 64-state ramps still need the real dot-5/dot-6 test |
| `base_plate` | stack/Hall height depends on the selected repair; motor-seat bridge, M4 pilot, and slender post fits must pass the base-interface coupon |
| `outer_box` | final height depends on the stack decision; pogo carrier is unmeasured/unretained and the ULN2003 has no positive board retainer |
| `esp32_pod_shell` | must match final cell height; header tails have no floor/wire exit, dock pads have no retainer/lead route, and exact contact/header hardware is not owned |
| `esp32_pod_lid` | inline-pigtail geometry is corrected, but matching shell height is pending |
| `linkage` | final release needs resin dot-5/dot-6 ramp, spring-return, binding, and torque evidence |
| `dot_insert` | final release needs real resin fit, dome sliding, spring insertion, and 50-cycle evidence |
| `nav_cap` | supported/angled resin only; not a support-free PETG part |
| `pogo_end_cap` | TPU 95A only; receiver size and barb retention require a real insertion/removal test |

Old 3-wall G-code is quarantined under `printing/gcode_HOLD_unvalidated`. The old
`print_batch` folder is historical and marked DO NOT USE.

## Confirmed corrections already applied

- motor body offset changed from -8.0 to measured -7.5 mm;
- motor ear spacing changed from 35.0 to measured 34.7 mm;
- top counterbores now provide 1.5 mm below the recessed reading surface;
- outer-box pogo windows are symmetric and fully through;
- pod dock-wall antenna subtraction that left 0.5 mm skin was removed;
- guessed unsupported panel-jack cradle was removed;
- pod lid now uses the owned inline pigtail with a 6 x 4 mm cable slot and tie post;
- pogo end cap now has a hollow TPU tongue and real barb geometry;
- stale 3-wall outputs were quarantined;
- stack-independent motor, base, top, hardware, pogo, pigtail, and mechanism test assets were added.

## Pending production-stack decision

Recommended non-destructive repair:

- keep the motor shaft intact;
- seat the cam hub on the measured 9 x 2 mm collar;
- raise the upper mechanism and matching enclosures by exactly 4 mm;
- rebuild the cam with a true 7.7 mm blind double-flat socket and central roof;
- raise the Hall sensor on an island to preserve the 0.4 mm magnet gap.

This coordinated change is not applied without AJ's explicit approval because it changes every
upper datum. The alternative keeps the current 58 mm enclosure only by cutting and deburring the
motor shaft to about 5 mm above the mounting face.

After the chosen stack repair, regenerate every dependent STL, repeat the real mechanism bench
test, verify Hall switching at the real gap, select coupon dimensions, and only then create the
final production G-code manifest.
