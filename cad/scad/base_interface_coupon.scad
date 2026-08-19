/*
  Braillix base-plate interface coupon (PETG, support-free)

  Three disconnected test pieces reproduce the base plate's riskier interfaces:
    1. Real Ø29 x 1.5 mm underside motor seat around the Ø10 shaft opening.
    2. Three 2 mm-deep M4 thread-forming pilots: Ø3.3 / 3.4 / 3.5 mm.
    3. Three Ø6 x 12 mm future-stack standoffs: Ø2.9 / 3.0 / 3.1 mm bores.

  Print exactly as modelled. Do not enable supports: the point is to test the
  motor-seat roof in the same orientation as the production base plate.
*/

$fn = 60;

module motor_seat_piece() {
    translate([-40, 0, 0])
        difference() {
            cylinder(d=34, h=5);
            translate([0, 0, -0.1]) cylinder(d=29, h=1.6);
            translate([0, 0, -1]) cylinder(d=10, h=7);
        }
}

module m4_pilot_piece() {
    difference() {
        translate([-18, -5, 0]) cube([36, 10, 2]);
        for (i = [0:2])
            translate([-12 + i*12, 0, -1])
                cylinder(d=3.3 + i*0.1, h=4);
    }
}

module standoff_piece() {
    translate([24, -7, 0])
        difference() {
            union() {
                cube([48, 14, 3]);
                for (i = [0:2])
                    translate([8 + i*16, 7, 3]) cylinder(d=6, h=12);
            }
            for (i = [0:2])
                translate([8 + i*16, 7, -1])
                    cylinder(d=2.9 + i*0.1, h=17);
        }
}

motor_seat_piece();
m4_pilot_piece();
standoff_piece();