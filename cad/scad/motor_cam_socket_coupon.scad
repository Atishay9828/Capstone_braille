/*
  Braillix motor/cam socket fit coupon

  Purpose: select a printable D-flat clearance for the measured 28BYJ-48
  output shaft before rebuilding the production cam stack.

  The three specimens reproduce the proposed non-destructive cam socket:
  - 9.0 mm lower collar seat and 7.2 mm upper roof boss
  - 8.2 mm total height
  - 7.7 mm blind socket depth, leaving a 0.5 mm roof
  - 3.1 / 3.2 / 3.3 mm across-flat D clearances

  Print orientation is already correct: pull tab on the bed, socket opening up.
  PETG, 0.16 mm layers, 5 walls, no supports.
*/

$fn = 72;

hub_d = 9.0;
hub_h = 8.2;
lower_h = 4.0;
upper_d = 7.2;
socket_d = 5.2;
socket_depth = 7.7;
tab_w = 16;
tab_d = 12;
tab_h = 2.0;
specimen_pitch = 22;

module d_socket(flat, depth) {
    intersection() {
        cylinder(d=socket_d, h=depth + 0.02);
        translate([-socket_d/2, -flat/2, -0.01])
            cube([socket_d, flat, depth + 0.04]);
    }
}

module specimen(flat, dots) {
    difference() {
        union() {
            cylinder(d=hub_d, h=lower_h);
            cylinder(d=upper_d, h=hub_h);
            translate([-tab_w/2, -tab_d/2, 0])
                cube([tab_w, tab_d, tab_h]);
        }

        // The opening is at the top in print orientation.
        translate([0, 0, hub_h - socket_depth])
            d_socket(flat, socket_depth + 0.02);

        // One, two, or three through-holes identify 3.1, 3.2, or 3.3 mm.
        for (i = [0:dots-1])
            translate([(i - (dots-1)/2) * 2.2, -5.3, -0.01])
                cylinder(d=1.2, h=tab_h + 0.02);
    }
}

for (i = [0:2])
    translate([(i-1) * specimen_pitch, 0, 0])
        specimen(3.1 + i*0.1, i+1);
