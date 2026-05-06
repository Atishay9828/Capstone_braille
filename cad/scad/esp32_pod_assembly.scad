// =========================================================
// ESP32 BRAIN POD — Assembly Preview
// Revision 2.0
// Created 2026-05-06
//
// Visual verification file — NOT for printing.
// Shows shell + lid in assembled position.
//
// To preview individual parts, open:
//   esp32_pod_shell.scad  (Part 1 — open-top body)
//   esp32_pod_lid.scad    (Part 2 — top cover with barrel jack)
//
// To export STLs, open each part file individually and render.
// =========================================================

use <esp32_pod_shell.scad>
use <esp32_pod_lid.scad>
include <esp32_pod_params.scad>

shell_h = pod_height - lid_h;   // Must match both part files

// --- ASSEMBLY ---

// Part 1: Shell at ground level
color("SteelBlue", 0.9)
    esp32_pod_shell();

// Part 2: Lid positioned on top of shell
color("LightSteelBlue", 0.85)
    translate([0, 0, shell_h])
        esp32_pod_lid();

// --- GHOST: ESP32 NodeMCU PCB (visual reference, not printed) ---
// 51×29mm PCB at boss height (z=pod_floor + pcb_boss_h)
color("ForestGreen", 0.4)
    translate([0, 0, pod_floor + pcb_boss_h])
        cube([51, 29, 1.6], center=true);

// Ghost: pogo alignment line (shows z=30.5mm target)
// %translate([pod_length/2, 0, pogo_z_from_bot])
//     rotate([0, 90, 0]) cylinder(d=1, h=8, center=true, $fn=12);
