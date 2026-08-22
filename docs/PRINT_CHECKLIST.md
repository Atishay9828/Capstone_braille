# Braillix print checklist - current release

**Use:** [`PRINT_RELEASE_2026-08-19.md`](PRINT_RELEASE_2026-08-19.md)

This replaces the historical v5 prototype checklist. Do not print obsolete files such as
`braille_cam2.stl`, `linkage_comb.stl`, the old panel-jack pod, or the old `print_batch` ZIP.

## Checked PETG files

- [ ] `motor_cam_socket_coupon.gcode`
- [ ] `motor_collar_wire_coupon.gcode`
- [ ] `hall_island_coupon.gcode`
- [ ] `base_interface_coupon.gcode`
- [ ] `pod_header_usb_coupon.gcode`
- [ ] `pigtail_slot_coupon.gcode`
- [ ] `pogo_receiver_coupon.gcode`
- [ ] `top_interface_coupon.gcode`
- [ ] `hardware_fit_coupon.gcode`
- [ ] `cam_linkage_test_fixture.gcode` if the resin test set and spring are available
- [ ] `mid_plate.gcode` after the first coupon prints cleanly

All are under `printing/gcode_kobra_neo_checked` and validated for the stock Kobra Neo:
0.16 mm, 5 walls, 40% infill, PETG 235/230 C, bed 80 C, supports off, no arcs.
Speeds are 30/45/60/20/150 mm/s (outer/inner/infill/first/travel) with effective
1 mm retraction at 35 mm/s.

## Required fit results

- [ ] motor double-flat socket selected without force
- [ ] motor sits flat on the bridged seat coupon without rocking
- [ ] motor can sits flat in collar and the blue lead housing exits without pinching
- [ ] exact Hall island roof does not sag and switches through the intended magnet gap
- [ ] actual M4 screw pilot selected without splitting/stripping
- [ ] actual M2.5 bolt bore selected in a Ø6 x 12 mm post without splitting
- [ ] pigtail passes the smallest selected cable-only slot without insulation damage
- [ ] M2.5 shank/head diameter/depth selected
- [ ] real resin dot insert fits selected pocket
- [ ] real female headers, pre-soldered tails, ESP32, and USB-C plug pass the pod coupon
- [ ] heat-set insert bore selected using purchased insert
- [ ] 8 x 1 mm magnet pocket selected
- [ ] Hall-body depth selected
- [ ] printed pogo receiver size measured
- [ ] exact TPU 95A spool identified before any end-cap G-code

## Mechanism evidence

Use [`MECHANISM_BENCH_TEST.md`](MECHANISM_BENCH_TEST.md).

- [ ] dot-5 dry travel passes in both directions
- [ ] dot-6 dry travel passes in both directions
- [ ] down height is flush within +/-0.10 mm
- [ ] up travel is 0.80 +/-0.10 mm for the current cam
- [ ] each linkage completes 50 spring cycles in both directions
- [ ] no scoring, cracking, whitening, dust, or coil damage
- [ ] high/low dwell is stable
- [ ] worst simultaneous transition has at least 2x motor torque reserve

## Production parts on HOLD

- [ ] top plate - wait for actual screw and insert coupon
- [ ] Option-A production cam - candidate socket valid in CAD; pending resin/ramp/spring/torque proof
- [ ] Option-A base plate - pending Hall, motor, M4, and standoff coupon results
- [ ] Option-A outer box and pod - pending hardware/electrical fit despite corrected height
- [ ] linkage/dot insert - pending real resin motion test
- [ ] nav caps - supported/angled resin only
- [ ] pogo end cap - TPU 95A receiver/retention test only

Do not mark the product print-ready merely because the STL is manifold or the slicer succeeds.
