# Braillix print release - 2026-08-19

Updated 2026-08-20 after the measured-stack and print-profile repair pass.

## Verdict

**Do not print the complete product set yet.** Option A now closes the measured motor/cam stack in
source, but the socket, Hall island, ramps, springs, headers, and enclosure hardware still need the
small physical gates below. The old default stack remains intentionally unreleased.

The checked PETG folder contains exactly eleven files. They are either small fit tests, a mechanism
test fixture, or the stack-independent mid plate. No enclosure, production cam, base plate, pod,
or final top plate is released.

## Tomorrow's print order

### Required fit tests

1. `motor_cam_socket_coupon.gcode` - 32m 26s / 2.36 g
2. `hall_island_coupon.gcode` - 21m 06s / 1.90 g
3. `motor_collar_wire_coupon.gcode` - 1h 08m 48s / 7.46 g
4. `base_interface_coupon.gcode` - 1h 32m 42s / 9.05 g
5. `pigtail_slot_coupon.gcode` - 53m 03s / 5.77 g
6. `pod_header_usb_coupon.gcode` - 1h 42m 55s / 11.37 g
7. `pogo_receiver_coupon.gcode` - 1h 35m 30s / 12.79 g
8. `top_interface_coupon.gcode` - 1h 44m 59s / 10.70 g
9. `hardware_fit_coupon.gcode` - 2h 48m 16s / 20.03 g

Stop after any print with poor first-layer adhesion, separated walls, closed holes, heavy stringing,
or visible warping. A bad coupon means the larger part is not safe.

### Mechanism test fixture

10. `cam_linkage_test_fixture.gcode` - 2h 45m 34s / 18.80 g

This fixture is useful only with
`cad/stl/cam_linkage_test_resin_set.stl`, one real 2 mm OD spring, and the procedure in
[`MECHANISM_BENCH_TEST.md`](MECHANISM_BENCH_TEST.md). The resin set contains the real cam,
dot-5 linkage, dot-6 linkage, and dot insert. It is intentionally STL-only because the resin
printer, resin, and service settings are not specified.

### Stack-independent production part

11. `mid_plate.gcode` - 1h 25m 35s / 8.96 g

Print the mid plate only after the first coupon proves the PETG/profile is behaving normally.
Its geometry already uses the measured 28.1 mm motor body, -7.5 mm body offset, and 34.7 mm ear
spacing, and it survives the pending +4 mm upper-stack option.

## Checked PETG contract

All eleven checked G-code files were freshly sliced from the current STLs with:

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
- outer / inner / infill / first-layer / travel speeds = 30 / 45 / 60 / 20 / 150 mm/s
- effective direct-drive retraction = 1 mm at 35 mm/s; startup and shutdown retracts use the same limit

`tools/validate_print_assets.py` verifies the exact checked manifest, embedded settings,
Kobra Neo motion envelope, closed/manifold topology, expected component count, each G-code's
source-STL SHA-256, independent fresh OpenSCAD equality, and explicit Option-A provenance. The
release command requires both the fresh-render directory and Option-A candidate directory.

## Coupon maps and acceptance

### Motor/cam socket coupon

The one-, two-, and three-hole tabs are 3.1, 3.2, and 3.3 mm double-flat sockets.

Use the smallest socket that:

- slides fully over the unpowered motor shaft;
- reaches and sits flat on the measured 9 mm collar;
- does not split, whiten, or require hammering;
- can still be removed using the tab.

Do not heat, glue, hammer, or power the motor during this test.

### Motor collar/wire coupon

Seat the owned motor can in the Ø29.5 collar with its blue wire housing aimed through the +Y notch.
The can must sit flat without forcing, rocking, pinching the leads, or lifting the collar. This test
also selects whether the collar needs additional radial clearance before the full mid plate is used.

### Hall-island coupon

This is an exact section of the Option-A base: 4.5 x 3.5 mm underside tunnel, 1 mm lead channel,
0.4 mm PETG roof, and 0.5 mm raised island. Reject it if the roof sags, the bare Hall body cannot
reach the roof, or its leads force it downward. Power the Hall from ESP32 3V3 and prove switching
through the intended 3 x 1 mm magnet before releasing the full base.

### Base-interface coupon

This has three disconnected pieces, left to right:

- Ø34 puck: real Ø29 x 1.5 mm underside motor seat around the Ø10 shaft opening. Reject it if the
  bridged locating roof sags enough that the motor cannot sit flat without rocking.
- 5 mm bar: through M4 pilot holes 3.3 / 3.4 / 3.5 mm. Use the smallest that accepts an M4x5
  thread-forming screw with controlled thread formation and no whitening, splitting, or stripped
  PETG. Do not use M4x6/x10 without a measured ear/point stack proving >=0.5 mm cam clearance.
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

### Pod header/USB coupon

Dry-fit both actual 1x15 female headers, the owned 30-pin USB-C ESP32, the intended pre-soldered
tails, and the actual USB-C plug. The board must insert/remove without bending pins, tails must fit
in the 5 mm under-deck space, and the cable must mate without pushing the board. This coupon does
not release the full pod until it passes.

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
| `braille_cam` | Option-A socket/cap is statically valid, but resin socket fit, real ramps, springs, Hall homing, and torque remain unproven; legacy default is invalid |
| `base_plate` | Option-A stack is statically valid; Hall island, motor seat, M4 pilot, and slender post fits still require coupons |
| `outer_box` | Option-A height is available only in the candidate export; active dock carrier and ULN2003 retention remain hardware-gated |
| `esp32_pod_shell` | raised header deck and 8-wire service route exist, but actual headers/USB and final electronics retention are unmeasured; four-contact pogo architecture is not electrically defined |
| `esp32_pod_lid` | inline-pigtail geometry is corrected, but cable-slot pull/fit and complete pod assembly are pending |
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
- Option A adds a measured 7.7 mm double-flat socket, 0.5 mm roof, collision-cleared central boss,
  +4 mm upper stack, through M4 pilots, and a 0.5 mm Hall running gap;
- mid-plate clearance and motor-wire notch were enlarged and reproduced in a collar coupon;
- pod headers now sit on raised prewired decks with a separate header/USB coupon;
- cell/pod service windows are shared 10 x 8 mm geometry, while the direct demo uses an 8-wire rear harness;
- stale 3-wall outputs were quarantined;
- stack-independent motor, base, top, hardware, pogo, pigtail, and mechanism test assets were added.

## Option A candidate status

The non-destructive Option A repair is implemented behind `stack_repair_raise=4`:

- keep the motor shaft intact;
- seat the cam hub on the measured 9 x 2 mm collar;
- raise the upper mechanism and matching enclosures by exactly 4 mm;
- rebuild the cam with a true 7.7 mm blind double-flat socket and central roof;
- raise the Hall sensor on an island with 0.5 mm mechanical and 0.9 mm magnetic separation.

Authoritative candidate STLs live only in `cad/stl_option_a_candidate` with a manifest that records
the +4 mm variant and hashes. Plain/default OpenSCAD exports remain legacy and are not printable
production parts. Do not cut the owned shaft.

After the chosen stack repair, regenerate every dependent STL, repeat the real mechanism bench
test, verify Hall switching at the real gap, select coupon dimensions, and only then create the
final production G-code manifest.

The current 0.80 +/- 0.10 mm dot lift is an intentionally oversized teaching-prototype target,
not a standards-compliant Braille claim. Standard tactile-height redesign is a separate gate.
