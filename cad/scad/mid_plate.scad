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
