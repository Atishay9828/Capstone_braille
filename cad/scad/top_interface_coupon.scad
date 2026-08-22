/*
  Braillix top-interface fit coupon

  Print in the same PETG/profile/orientation as top_plate.scad.
  The clipped corner marks TOP-LEFT for the screw-grid map.

  Screw grid:
    columns left->right: counterbore diameter 5.4 / 5.6 / 5.8 mm
    rows top->bottom:    effective depth 1.3 / 1.5 / 1.7 mm
    bottom row of three plain holes: 3.0 / 3.2 / 3.4 mm shank clearance

  Separate insert strip (notched end is LEFT):
    left->right total fit allowance 0.2 / 0.4 / 0.6 mm.
    The production top plate currently uses 0.2 mm total.
*/

$fn = 48;
local_surface_h = 3.2;
screw_d = 3.2;
counterbore_diameters = [5.4, 5.6, 5.8];
counterbore_depths = [1.3, 1.5, 1.7];
clearance_diameters = [3.0, 3.2, 3.4];
insert_fits = [0.2, 0.4, 0.6];

module rounded_plate(w, h, z, r=2.5) {
    hull()
        for (sx=[-1,1], sy=[-1,1])
            translate([sx*(w/2-r), sy*(h/2-r), 0]) cylinder(r=r, h=z);
}

module screw_coupon() {
    difference() {
        rounded_plate(44, 52, local_surface_h);

        for (col=[0:2], row=[0:2]) {
            cb_d = counterbore_diameters[col];
            cb_depth = counterbore_depths[row];
            x = -12 + col*12;
            y = 13 - row*12;
            translate([x, y, -0.5]) cylinder(d=screw_d, h=local_surface_h+1);
            translate([x, y, local_surface_h-cb_depth])
                cylinder(d=cb_d, h=cb_depth+0.5);
        }

        for (col=[0:2])
            translate([-12+col*12, -20, -0.5])
                cylinder(d=clearance_diameters[col], h=local_surface_h+1);

        // Quarter-circle key at the grid's top-left corner.
        translate([-22, 26, -0.5]) cylinder(d=5, h=local_surface_h+1);
    }
}

module insert_coupon() {
    insert_body = 11.0;
    insert_flange = 15.0;
    insert_flange_h = 1.2;

    difference() {
        rounded_plate(58, 20, local_surface_h);

        for (i=[0:2]) {
            fit = insert_fits[i];
            x = -19 + i*19;
            translate([x, 0, -0.5])
                linear_extrude(local_surface_h+1)
                    square([insert_body+fit, insert_body+fit], center=true);
            translate([x, 0, local_surface_h-insert_flange_h])
                linear_extrude(insert_flange_h+0.5)
                    square([insert_flange+fit, insert_flange+fit], center=true);
        }

        // Quarter-circle key marks the 0.2 mm (left) end.
        translate([-29, 10, -0.5]) cylinder(d=5, h=local_surface_h+1);
    }
}

translate([0, -13, 0]) screw_coupon();
translate([0, 29, 0]) insert_coupon();
