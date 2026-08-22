/*
  ESP32 pod header + USB service coupon

  Tests the real raised female-header support geometry, pre-soldered tail space,
  DevKit seating, and USB-C cable access before committing to the full pod shell.
  The female headers and cable are not yet measured, so the full pod stays HOLD.

  Print upright in PETG exactly as exported. Dry-fit both 1x15 headers, the owned
  ESP32, the intended pre-soldered wires, and the actual USB-C plug.
*/

include <esp32_pod_params.scad>

$fn = 40;
coupon_y = 34;
coupon_wall_h = 28;
rib_x = [-6.5, -2.5, 2.5, 6.5];
rib_w = 0.8;
end_t = 1.5;

module coupon_header_decks() {
    for (sy=[-1, 1]) {
        for (rx=rib_x)
            translate([devkit_x_offset + rx*2.54 - rib_w/2,
                       sy*hdr_row_pitch/2 - hdr_cradle_w/2,
                       pod_floor - 0.1])
                cube([rib_w, hdr_cradle_w, hdr_tail_space + 0.1]);

        for (sx=[-1, 1])
            translate([devkit_x_offset + sx*(hdr_cradle_len/2 + end_t/2) - end_t/2,
                       sy*hdr_row_pitch/2 - hdr_cradle_w/2,
                       pod_floor - 0.1])
                cube([end_t, hdr_cradle_w, hdr_tail_space + 3.1]);
    }
}

difference() {
    union() {
        translate([-pod_length/2, -coupon_y/2, 0])
            cube([pod_length, coupon_y, pod_floor]);
        translate([-pod_length/2, -coupon_y/2, 0])
            cube([pod_wall, coupon_y, coupon_wall_h]);
        coupon_header_decks();
    }

    translate([-pod_length/2 - 1, -usb_w/2, usb_z])
        cube([pod_wall + 2, usb_w, usb_h]);
}
