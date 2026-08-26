// =========================================================
// SUPERSEDED 2026-08-26 - THIS PART IS NO LONGER IN THE ASSEMBLY
//
// The mid-plate was a 2mm shelf resting on a 2mm ledge in the outer box, and the
// motor stood on it. Together those 4mm were exactly what stopped the cam seating:
// the cam hub is a 4mm tube that can only reach the TOP of the motor's own 2mm
// shaft boss, never the mounting face, so the hub finished 4mm short.
//
// Both are gone. The motor now sits directly on a cup moulded into the outer box
// floor - see motor_cup in outer_box.scad. The can rests at z=18 exactly as it
// would have on this plate, so nothing above it moved.
//
// Kept only for reference. Two things in here were wrong and should NOT be copied:
//   * the wire-block notch was cut on +Y. The shaft is offset to +X of the can
//     centre, so the block points -X. The motor would not have dropped in.
//   * the collar ID was a guess (29.5 for an assumed 28mm can). The real can is
//     28.1mm - see motor_spec.scad, which now owns every motor dimension.
//
// It is still in the release G-code manifest and in tools/validate_print_assets.py.
// Removing it from there is a release-tooling change and belongs in one
// coordinated pass, not here.
// =========================================================

// mid_plate_v1.scad
plate_l = 59.0;  // 0.5mm clearance per side in the 60mm cavity
plate_w = 59.0;
plate_h = 2.0;
motor_x_offset = -7.5;  // MEASURED M3

$fn = 60;

module rounded_rect(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}

union() {
    difference() {
        // Base plate body
        rounded_rect(plate_l, plate_w, plate_h, 1.0);

        // Holes to allow the 4 corner bosses to pass through
        for(sx = [-1, 1]) for(sy = [-1, 1]) {
            translate([sx * 26, sy * 21, -1])
                cylinder(d=9.0, h=plate_h + 2);
        }

        // Central hole for motor shaft to pass up to the cam
        translate([0, 0, -1]) cylinder(d=10, h=plate_h + 2);

        // Slot for motor wires to drop down into the electronics bay
        translate([motor_x_offset, 20, plate_h/2])
            cube([18, 16, plate_h + 2], center=true);

        // v6.1: ULN2003 connector relief slot. The off-the-shelf driver module measured
        // ~20mm tall as wired vs the 16mm pocket. With wires soldered flat the stack is
        // ~12mm, but the JST socket + plug needs headroom — this through-slot lets the
        // connector corner poke past the plate. Positioned at (+X,-Y) clear of the motor
        // collar (collar max x at y=-15 is x=0.5) and the boss hole at (26,-21).
        // → Orient the ULN2003 with its JST/header edge toward this corner.
        translate([3, -23, -1]) cube([17, 8, plate_h + 2]);

        // Wire pass-through notches: pogo wires drop from z31 into pocket
        // -X edge notch (pogo spring side)
        translate([-plate_l/2, -3, -1]) cube([6, 6, plate_h + 2]);
        // +X edge notch (pogo pad side)
        translate([plate_l/2 - 6, -3, -1]) cube([6, 6, plate_h + 2]);
        // +Y edge notch (hall sensor wires from base plate)
        translate([-3, plate_w/2 - 6, -1]) cube([6, 6, plate_h + 2]);
    }
    
    // Motor Retaining Collar (Centered at measured X=-7.5)
    // Audit 2 fix (2026-05-15): added boss relief notches — collar at x=-7.5 with r=17.25mm
    // was crashing into corner bosses at (-15, +-15), distance=16.55mm < 17.25mm
    // >>> collar ID is BLOCKED ON MEASUREMENT (M1) — 29.5 assumes a Ø28 can. <<<
    // If the real can is bigger the motor will not drop into this collar at all.
    translate([motor_x_offset, 0, plate_h]) difference() {
        cylinder(d=34.5, h=8); // 8mm tall collar
        translate([0,0,-1]) cylinder(d=29.5, h=10); // MEASURE (M1): can Ø + 1.5mm
        // Open the +Y side for the owned motor's blue lead housing and five wires.
        // The old plate slot was cut before this annulus was unioned, so the ring
        // silently sealed the intended escape path.
        translate([-9, 12, -1]) cube([18, 20, 10]);
        // Boss relief notches for the two -X corner bosses
        for(sy = [-1, 1])
            translate([-26 - motor_x_offset, sy * 21, -1])
                cylinder(d=9, h=10, $fn=40);  // 9mm clears 8mm boss + 0.5mm/side
    }
}
