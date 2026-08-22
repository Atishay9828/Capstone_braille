/*
  Braillix pogo/end-cap receiver coupon

  Reproduces the outer_box vertical 4 mm wall and its support-free bridged
  service window. Print upright in PETG with the checked enclosure profile.

  Slot widths/heights left->right:
    10.0 x 8.0
    10.2 x 8.2
    10.4 x 8.4

  The TPU cap is tested separately. No TPU G-code is released until the exact
  spool is known and a spool-specific slow profile can be validated.
*/

include <dock_interface.scad>

$fn = 40;
base_x = 76;
base_y = 18;
base_z = 3.0;
wall_t = dock_wall_t;
wall_h = 25.0;
wall_y = 0;
slot_z = base_z + 12.0;
slot_widths = [for (delta=[0, 0.2, 0.4]) dock_receiver_w + delta];
slot_heights = [for (delta=[0, 0.2, 0.4]) dock_receiver_h + delta];

module engrave(label, x) {
    translate([x, -6.0, base_z-0.28])
        linear_extrude(0.4)
            text(label, size=3.0, halign="center", valign="center");
}

difference() {
    union() {
        translate([-base_x/2, -base_y/2, 0]) cube([base_x, base_y, base_z]);
        translate([-base_x/2, wall_y-wall_t/2, base_z-0.2])
            cube([base_x, wall_t, wall_h+0.2]);
    }
    for (i=[0:2]) {
        w = slot_widths[i];
        h = slot_heights[i];
        x = -24 + i*24;
        translate([x-w/2, wall_y-wall_t/2-1, slot_z-h/2])
            cube([w, wall_t+2, h]);
        engrave(str(w), x);
    }
}
