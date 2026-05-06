// =========================================================
// COMPONENT: ESP32 BRAIN POD — Shell Body
// Revision 2.0 — Split Architecture
// Created 2026-05-06
//
// PRINTABLE PART 1 of 2. Pair with esp32_pod_lid.scad.
// Use esp32_pod_assembly.scad for visual verification.
//
// This is the open-top shell: floor + 4 walls, all interface
// cutouts, PCB mounting bosses, and wire tie post.
//
// Print orientation: upright (open top facing up).
// Material: PETG (better layer adhesion for snap features).
//
// --- RIGHT FACE (+X) INTERFACE ---
//   - Pogo pad recess (1mm deep, centred at z=30.5mm)
//   - Docking slot (receives cell tongue)
//   - 3× NeFeB magnet pockets (±12, 0 on Y)
//   - Antenna grille slots (thinned inner wall)
//
// --- LEFT FACE (-X) ---
//   - Micro-USB cutout (programming port)
//
// --- INSIDE ---
//   - 4× M2 PCB mounting bosses on floor
//   - Wire tie-down post (pogo wire bundle)
// =========================================================

include <esp32_pod_params.scad>

// Shell body height — leaves space for lid on top
shell_h = pod_height - lid_h;

// --- CUTOUT MODULES ---

module shell_internal_cavity() {
    translate([0, 0, pod_floor])
        pod_rounded_box(pod_int_length, pod_int_width, shell_h, pod_fillet - 1);
}

module usb_cutout() {
    // Micro-USB port — left face (-X), centred in Y, at PCB USB port height
    translate([-pod_length/2 - 1, -usb_w/2, usb_z])
        cube([pod_wall + 2, usb_w, usb_h]);
}

module pogo_pad_recess_cutout() {
    // 1mm-deep recess on right face for pogo pad targets (audit 6.2)
    translate([pod_length/2 - pogo_pad_recess, -pogo_pad_w/2,
               pogo_z_from_bot - pogo_pad_h/2])
        cube([pogo_pad_recess + 1, pogo_pad_w, pogo_pad_h]);
}

module docking_slot() {
    // Tongue receiver slot on right face — cell 1 tongue slides in
    translate([pod_length/2 - dock_slot_depth,
               -dock_slot_w/2,
               shell_h/2 - dock_slot_h/2])
        cube([dock_slot_depth + 1, dock_slot_w, dock_slot_h]);
}

module magnet_pockets() {
    // 3× NeFeB disc pockets — right face (+X), blind holes along X axis
    // Polarity: alternating N/S to match cell tongue magnets (snap alignment)
    for(my = mag_y_positions) {
        translate([pod_length/2 - mag_depth + 0.01, my, mag_z])
        rotate([0, 90, 0])
            cylinder(d=mag_dia, h=mag_depth + 1, $fn=30);
    }
}

module antenna_grille() {
    // 3 slots cut into right end wall — thins wall to antenna_wall for WiFi radiation
    // ESP32 antenna points toward +X face
    for(i = [0 : antenna_slot_count - 1]) {
        y_pos = -((antenna_slot_count - 1) * (antenna_slot_w + 2)) / 2
                + i * (antenna_slot_w + 2);
        translate([pod_length/2 - pod_wall - 1,
                   y_pos - antenna_slot_w/2,
                   shell_h/2 - antenna_slot_h/2])
            cube([pod_wall - antenna_wall + 1, antenna_slot_w, antenna_slot_h]);
    }
}

// --- INTERIOR FEATURE MODULES ---

module pcb_bosses() {
    // 4× M2 mounting posts on floor for ESP32 NodeMCU 30-pin PCB
    // PCB is 51×29mm; bosses at ±23mm(X) × ±11mm(Y)
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * pcb_boss_x_off, sy * pcb_boss_y_off, pod_floor]) {
            difference() {
                cylinder(d=pcb_boss_dia, h=pcb_boss_h);
                // M2 tap hole (drill from top after print, or self-tap with M2 screw)
                translate([0, 0, 1])
                    cylinder(d=pcb_boss_hole, h=pcb_boss_h);
            }
        }
    }
}

module wire_tie_post() {
    // Vertical post near pogo end (+X interior corner)
    // Cable tie wraps around post to hold pogo wire bundle flat
    translate([pod_length/2 - pod_wall - 8, pod_int_width/2 - 4, pod_floor]) {
        difference() {
            cylinder(d=tie_post_dia, h=tie_post_h, $fn=30);
            // Rectangular slot for cable tie (cleaner than round hole)
            translate([-tie_post_dia/2 - 1, -tie_post_hole/2,
                       tie_post_h/2 - tie_post_hole/2])
                cube([tie_post_dia + 2, tie_post_hole, tie_post_hole]);
        }
    }
}

// --- LOCATING LIP for lid ---
// 1mm-tall rim on top edge — lid inner recess drops over this for alignment
module lid_locating_lip() {
    translate([0, 0, shell_h])
        difference() {
            pod_rounded_box(pod_int_length + 2 * 1.0,
                            pod_int_width  + 2 * 1.0, 1.0, pod_fillet - 1);
            translate([0, 0, -0.01])
                pod_rounded_box(pod_int_length - 0.4,
                                pod_int_width  - 0.4, 1.1, pod_fillet - 1.5);
        }
}

// --- MAIN SHELL MODULE ---

module esp32_pod_shell() {
    union() {
        difference() {
            // Outer shell walls + floor
            pod_rounded_box(pod_length, pod_width, shell_h, pod_fillet);

            // Hollow interior
            shell_internal_cavity();

            // Left face: USB port
            usb_cutout();

            // Right face: pogo recess
            pogo_pad_recess_cutout();

            // Right face: tongue docking slot
            docking_slot();

            // Right face: 3× magnet pockets
            magnet_pockets();

            // Right end wall: antenna grille slots
            antenna_grille();
        }

        // PCB mounting bosses on floor
        pcb_bosses();

        // Wire tie-down post (pogo wire bundle)
        wire_tie_post();

        // Lid locating lip on top rim
        lid_locating_lip();
    }
}

// --- RENDER ---
esp32_pod_shell();
