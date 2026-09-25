// =========================================================
// ESP32 BRAIN POD — Assembly Preview
// Revision 3.0 — Matching Brick + Horizontal Socket Mount
// Updated 2026-05-31
//
// Visual verification file — NOT for printing.
// =========================================================

use <esp32_pod_shell.scad>
use <esp32_pod_lid.scad>
include <esp32_pod_params.scad>

shell_h = pod_height - lid_h;

// Part 1: Shell
color("SteelBlue", 0.9)
    esp32_pod_shell();

// Part 2: Lid on top
color("LightSteelBlue", 0.85)
    translate([0, 0, shell_h])
        esp32_pod_lid();

// Ghost: ESP32 DevKit V1 PCB (horizontal, on header sockets)
color("ForestGreen", 0.4)
    translate([devkit_x_offset, 0, board_under_z + 0.8])
        cube([devkit_length, devkit_width, 1.6], center=true);

// Ghost: two female header strips
color("DarkSlateGray", 0.3)
    for(sy = [-1, 1])
        translate([devkit_x_offset, sy * hdr_row_pitch/2,
                   hdr_body_bottom_z + hdr_strip_h/2])
            cube([hdr_strip_len, hdr_strip_w, hdr_strip_h], center=true);
