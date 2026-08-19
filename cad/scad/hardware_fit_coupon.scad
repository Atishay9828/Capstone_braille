// Braillix hardware fit coupon — print before any large enclosure part.
// PETG, 0.16mm, 5 walls, 40% infill, no supports.
// Tests printer/material compensation for the unpurchased heat inserts and
// measured motor shaft, Hall body and 8x1mm docking magnets.

$fn = 48;
plate_x = 110;
plate_y = 34;
plate_z = 6;

module rounded_plate() {
    hull()
        for (sx=[-1,1], sy=[-1,1])
            translate([sx*(plate_x/2-3), sy*(plate_y/2-3), 0])
                cylinder(r=3, h=plate_z);
}

module double_d_hole(d, flats, h) {
    intersection() {
        cylinder(d=d, h=h);
        translate([-d, -flats/2, 0]) cube([2*d, flats, h]);
    }
}

module shallow_label(label, x, y) {
    translate([x, y, plate_z-0.35])
        linear_extrude(0.5)
            text(label, size=3.2, halign="center", valign="center");
}

difference() {
    rounded_plate();

    // Heat-set insert bores: 1mm floor remains. Pick the best melt-in fit.
    for (i=[0:3]) {
        d = [3.1, 3.3, 3.5, 3.7][i];
        x = -45 + i*15;
        translate([x, 8, 1]) cylinder(d=d, h=plate_z);
        shallow_label(str(d), x, 14);
    }

    // 28BYJ-48 double-D shaft: Ø5.2, three across-flat clearances.
    for (i=[0:2]) {
        flats = [3.1, 3.2, 3.3][i];
        x = -45 + i*15;
        translate([x, -10, -0.5]) double_d_hole(5.2, flats, plate_z+1);
        shallow_label(str(flats), x, -3.5);
    }

    // 8x1mm docking magnet glue pockets, 1.2mm deep.
    for (i=[0:2]) {
        d = [8.2, 8.4, 8.6][i];
        x = 12 + i*17;
        translate([x, 8, plate_z-1.2]) cylinder(d=d, h=2);
        shallow_label(str(d), x, 14);
    }

    // Bare Hall-body pockets: measured 1.6mm thick plus 0.1/0.2/0.3mm Z margin.
    for (i=[0:2]) {
        depth = [1.7, 1.8, 1.9][i];
        x = 12 + i*17;
        translate([x-2.25, -11.75, plate_z-depth]) cube([4.5, 3.5, depth+0.5]);
        shallow_label(str(depth), x, -4.5);
    }
}