/*
  Exact Option-A Hall-island section coupon

  This is cut directly from the production base_plate() module so the underside
  sensor tunnel, 0.4 mm roof, 0.7 mm island, wire channel, and print orientation
  cannot drift. Print flat in PETG with no supports. Fit the bare Hall body, route
  its three leads, and verify switching with the intended 3x1 mm magnet before
  releasing the full base.
*/

include <hall_interface.scad>

coupon_w = 20;
coupon_y0 = 9;
coupon_depth = 16;
plate_t = 5;

intersection() {
    difference() {
        union() {
            translate([-coupon_w/2, coupon_y0, 0])
                cube([coupon_w, coupon_depth, plate_t]);
            hall_sensor_island(4, plate_t);
        }
        hall_sensor_pocket(4, plate_t, 50);
    }
    translate([-coupon_w/2, coupon_y0, -0.01])
        cube([coupon_w, coupon_depth + 0.1, 6.01]);
}
