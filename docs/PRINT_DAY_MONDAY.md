# Braillix print day - current plan

**Authority:** [`PRINT_RELEASE_2026-08-19.md`](PRINT_RELEASE_2026-08-19.md)

Do not use the old `print_batch` folder, old 3-wall G-code, or any enclosure/mechanism G-code
outside the current checked folder.

## Before printing

1. Dry NuMaker PETG HS at 60-65 C for 4-6 hours.
2. Clean the bed and nozzle.
3. Confirm the printer is the stock Anycubic Kobra Neo with a 0.4 mm nozzle.
4. Copy only the eight files currently inside `printing/gcode_kobra_neo_checked`.
5. Keep the motor unpowered during all shaft-coupon fitting.

## Print order

1. `motor_cam_socket_coupon.gcode`
2. `base_interface_coupon.gcode`
3. `pigtail_slot_coupon.gcode`
4. `pogo_receiver_coupon.gcode`
5. `top_interface_coupon.gcode`
6. `hardware_fit_coupon.gcode`
7. `cam_linkage_test_fixture.gcode` if the resin test set and real spring are available
8. `mid_plate.gcode` after the first coupon proves the PETG/profile is behaving normally

The full top plate is on HOLD until the real M2.5 screw and real resin dot insert pass the
top-interface coupon. The production cam, base, box, pod, linkage set, dot insert, nav caps, and
TPU end cap are also on HOLD for the reasons in the release document.

## Stop immediately if

- the first layer lifts or separates;
- walls split or warp;
- a required hole/slot prints closed;
- the nozzle hits the part;
- the printer emits unsupported G2/G3 errors;
- the material pops/crackles from moisture;
- any shaft coupon needs force, hammering, heat, or power.

A failed coupon is a successful warning. Do not continue to the larger dependent part.

## Record after printing

Photograph and write down:

- selected motor double-flat size;
- motor-seat roof flat/rock-free result;
- selected M4 pilot and M2.5 standoff bore;
- selected pigtail cable-slot size;
- selected M2.5 shank, head diameter, and head depth;
- selected resin-insert clearance;
- selected heat-insert bore;
- selected magnet pocket;
- selected Hall depth;
- measured pogo receiver opening.

For the real cam/linkage/spring test, follow
[`MECHANISM_BENCH_TEST.md`](MECHANISM_BENCH_TEST.md) and record travel, 50-cycle return behavior,
damage, and peak pull force. Do not release the full mechanism from a visual fit alone.
