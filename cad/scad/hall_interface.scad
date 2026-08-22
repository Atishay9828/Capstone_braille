// Shared bare-Hall geometry for the production base and its exact coupon.
// Keep every sensor/roof/gap value here so the physical test cannot drift.

include <mech_layout.scad>

hall_body_w  = 4.1;
hall_body_d  = 3.1;
hall_body_t  = 1.6;
hall_fit     = 0.4;
hall_floor_t = 0.4;
hall_air_gap = 0.5;
hall_wire_w  = 4;
hall_wire_d  = 1;

hall_pocket_x = homing_mag_r * cos(homing_mag_angle);
hall_pocket_y = homing_mag_r * sin(homing_mag_angle);

function hall_island_height(repair_raise, plate_thickness) =
    repair_raise == 4 ? (2 + repair_raise) - plate_thickness - hall_air_gap : 0;

function hall_pocket_height(repair_raise, plate_thickness) =
    plate_thickness + hall_island_height(repair_raise, plate_thickness) - hall_floor_t;

module hall_sensor_island(repair_raise, plate_thickness) {
    island_h = hall_island_height(repair_raise, plate_thickness);
    if (repair_raise == 4) {
        pw = hall_body_w + hall_fit + 4;
        pd = hall_body_d + hall_fit + 4;
        translate([hall_pocket_x - pw/2, hall_pocket_y - pd/2, plate_thickness - 0.1])
            cube([pw, pd, island_h + 0.1]);
    }
}

module hall_sensor_pocket(repair_raise, plate_thickness, plate_width) {
    pocket_h = hall_pocket_height(repair_raise, plate_thickness);
    pw = hall_body_w + hall_fit;
    pd = hall_body_d + hall_fit;
    translate([hall_pocket_x - pw/2, hall_pocket_y - pd/2, -0.1])
        cube([pw, pd, pocket_h + 0.1]);

    translate([hall_pocket_x - hall_wire_w/2, hall_pocket_y - pd/2, -0.1])
        cube([hall_wire_w,
              plate_width/2 - hall_pocket_y + pd/2 + 1,
              hall_wire_d + 0.1]);
}
