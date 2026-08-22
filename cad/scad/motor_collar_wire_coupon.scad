/*
  Owned-motor collar and lead-exit coupon.

  Reproduces the mid-plate's Ø34.5 / Ø29.5 x 8mm locating collar, 2mm
  supporting floor, Ø10 rear-bearing/shaft relief, and the enlarged +Y wire
  notch. Place the motor can on the coupon with its blue lead housing toward
  the notch. It must sit flat without pinching the five wires or forcing the
  housing against the ring.
*/

$fn = 60;
plate_h = 2.0;
motor_x_offset = -7.5;

module coupon() {
    difference() {
        union() {
            translate([-32, -24, 0]) cube([50, 48, plate_h]);
            translate([motor_x_offset, 0, plate_h])
                difference() {
                    cylinder(d=34.5, h=8);
                    translate([0,0,-1]) cylinder(d=29.5, h=10);
                }
        }

        translate([0, 0, -1]) cylinder(d=10, h=plate_h + 2);
        translate([motor_x_offset - 9, 12, -1]) cube([18, 20, 12]);
    }
}

coupon();
