/*
  Braillix inline-power-pigtail slot coupon

  Uses the real 4 mm pod-lid thickness and three rounded cable-only slots.
  The barrel connector body stays outside; pass only the red/black leads.

  Slot widths/heights left->right:
    5.0 x 3.0
    6.0 x 4.0  (current CAD nominal)
    7.0 x 5.0
*/

$fn = 40;
plate_x = 64;
plate_y = 22;
plate_z = 4.0;
slot_widths = [5.0, 6.0, 7.0];
slot_heights = [3.0, 4.0, 5.0];

module rounded_slot(w, h) {
    dx = (w - h) / 2;
    hull()
        for (sx = [-1, 1])
            translate([sx * dx, 0, -1])
                cylinder(d=h, h=plate_z + 2);
}

difference() {
    translate([-plate_x/2, -plate_y/2, 0])
        cube([plate_x, plate_y, plate_z]);

    for (i = [0:2])
        translate([-20 + i*20, 0, 0])
            rounded_slot(slot_widths[i], slot_heights[i]);

    // Clipped upper-left corner identifies the 5 x 3 end without tiny text.
    translate([-plate_x/2 - 1, plate_y/2 - 5, -1])
        rotate([0, 0, 45]) cube([8, 8, plate_z + 2]);
}