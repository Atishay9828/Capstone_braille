// =========================================================
// COMPONENT: ESP32 BRAIN POD — Top Lid
// Revision 2.0 — Split Architecture
// Created 2026-05-06
//
// PRINTABLE PART 2 of 2. Pair with esp32_pod_shell.scad.
//
// Flat lid that drops onto the shell's locating lip.
// Contains the barrel jack hole (5.5/2.1mm, panel-mount).
//
// Print orientation: flat (face down).
// Material: PETG — same as shell.
//
// Assembly:
//   1. Insert ESP32 NodeMCU onto PCB bosses, fasten M2 screws
//   2. Route pogo wires, secure with cable tie on wire post
//   3. Drop lid onto shell — inner recess locates on shell lip
//   4. Fix with 2× M2×6 screws through lid corners (optional) OR press-fit
//
// Lid thickness = pod_wall = 4mm
// =========================================================

include <esp32_pod_params.scad>

// Shell body height (same derived value as in shell file — must match)
shell_h = pod_height - lid_h;

// --- MODULES ---

module barrel_jack_cutout() {
    // Standard 11mm panel-mount barrel jack — 5.5mm outer / 2.1mm inner
    // Centred at barrel_jack_x (offset toward USB end, away from pogo face)
    translate([barrel_jack_x, 0, -1])
        cylinder(d=barrel_jack_dia, h=lid_h + 2);
}

module lid_inner_recess() {
    // Underside recess that drops over shell's locating lip (1mm tall lip, 0.2mm gap)
    // Recess is 1.2mm deep, matching lip OD + 0.2mm clearance
    translate([0, 0, -0.01])
        pod_rounded_box(pod_int_length + 2 * 1.0 + 0.4,
                        pod_int_width  + 2 * 1.0 + 0.4, 1.2, pod_fillet - 1);
}

module lid_screw_holes() {
    // Optional: 2× M2 clearance holes at ±25mm X (near short ends, centred Y)
    // Screw into shell top wall (tap M2 into PETG after assembly)
    for(sx = [-1, 1]) {
        translate([sx * 25, 0, -1])
            cylinder(d=2.4, h=lid_h + 2);
    }
}

// --- MAIN LID MODULE ---

module esp32_pod_lid() {
    difference() {
        // Flat plate — same footprint as shell outer wall
        pod_rounded_box(pod_length, pod_width, lid_h, pod_fillet);

        // Barrel jack hole through top face
        barrel_jack_cutout();

        // Inner locating recess on underside (seats over shell lip)
        lid_inner_recess();

        // Optional screw holes
        lid_screw_holes();
    }
}

// --- RENDER ---
// Printed flat (upside-down relative to assembly).
// Flip in slicer so barrel jack recess faces up on build plate.
esp32_pod_lid();
