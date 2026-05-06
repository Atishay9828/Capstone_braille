// =========================================================
// COMPONENT: ESP32 BRAIN POD — External Controller Enclosure
// Revision 1.0
// Created 2026-05-06
//
// Houses the ESP32 NodeMCU 30-pin board (51x29mm PCB).
// Connects to cell 1's left pogo/docking interface.
// Provides 5V power (barrel jack), USB for programming, BLE/WiFi.
//
// Docking interface on RIGHT face (+X):
//   - Docking slot (receives cell 1's tongue)
//   - Pogo pad recess (1mm deep — audit 6.2)
//   - 3 x magnet pockets (same NeFeB scheme as cell — audit 6.3)
//
// Pogo_z alignment: pod pogo centre must match cell pogo_z.
// Cell: pogo_z = floor(4) + (shell_height(57) - floor(4))/2 = 30.5mm
// Pod: pogo_z_from_bot = pod_floor + (pod_height - pod_floor)/2
//      = 3 + (58-3)/2 = 30.5mm  ✓
// =========================================================

// --- 1. PARAMETERS ---

// Pod shell
pod_length       = 74;     // X — long axis (USB end to pogo end)
pod_width        = 38;     // Y — slimmer than cell, but wide enough for magnet pockets at ±12mm
pod_height       = 58;     // Z — tall enough for pogo_z=30.5mm from bottom
pod_wall         = 4;
pod_floor        = 3;
pod_fillet       = 2.0;

// Internal cavity
pod_int_length   = pod_length - 2 * pod_wall;  // 66mm
pod_int_width    = pod_width  - 2 * pod_wall;   // 26mm
pod_int_height   = pod_height - pod_floor;       // 55mm

// ESP32 NodeMCU 30-pin PCB: 51x29mm body
// PCB mounting bosses (M2 tap, 4mm tall on floor)
pcb_boss_x_off   = 23;    // ±23mm -> 46mm span (51mm PCB, 2.5mm inset each end)
pcb_boss_y_off   = 11;    // ±11mm -> 22mm span (29mm PCB, 3.5mm inset each side)
pcb_boss_dia     = 4;
pcb_boss_h       = 4;
pcb_boss_hole    = 2.2;   // M2 tap

// Barrel jack — standard 11mm panel-mount, on TOP face
barrel_jack_dia  = 11.5;
barrel_jack_x    = -10;   // Offset toward USB end (away from pogo)

// USB cutout — micro-USB on LEFT face (-X), for programming
usb_w            = 9;
usb_h            = 5;
usb_z            = pod_floor + pcb_boss_h + 1;  // PCB bottom + boss + 1mm

// Pogo interface — RIGHT face (+X), matches cell left-wall pogo slot
pogo_pad_w       = 10;    // = outer_box pogo_slot_w
pogo_pad_h       = 8;     // = outer_box pogo_slot_h
pogo_pad_recess  = 1;     // 1mm deep recess for pad targets (audit 6.2)
pogo_z_from_bot  = 30.5;  // Must match cell pogo_z exactly

// Docking slot — RIGHT face, receives cell 1's tongue
dock_slot_w      = 3.3;
dock_slot_h      = 12.2;
dock_slot_depth  = 8.2;

// Magnet pockets — RIGHT face, same NeFeB scheme as cell (audit 6.3)
mag_dia          = 3.2;   // Press-fit for 3mm NeFeB disc
mag_depth        = 2.1;   // 2mm magnet + 0.1mm
mag_y_positions  = [-12, 0, 12];  // Same ±12, 0 pattern as outer_box
mag_z            = pod_height / 2; // Centred vertically

// WiFi antenna — thin end wall on RIGHT side (+X, antenna end of NodeMCU)
antenna_wall     = 1.5;
antenna_slot_w   = 2;
antenna_slot_h   = 8;
antenna_slot_count = 3;

// Wire tie-down post (inside, near pogo end)
tie_post_dia     = 4;
tie_post_h       = 10;
tie_post_hole    = 2;

$fn = 60;

// --- 2. MODULES ---

module rounded_box(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}

module internal_cavity() {
    rounded_box(pod_int_length, pod_int_width, pod_int_height, pod_fillet - 1);
}

module barrel_jack_cutout() {
    // Through top face, centred at barrel_jack_x
    translate([barrel_jack_x, 0, pod_height - pod_wall - 1])
        cylinder(d=barrel_jack_dia, h=pod_wall + 2);
}

module usb_cutout() {
    // Through left face (-X), for micro-USB programming port
    translate([-pod_length/2 - 1, -usb_w/2, usb_z])
        cube([pod_wall + 2, usb_w, usb_h]);
}

module pogo_pad_recess_cutout() {
    // Recessed area on right face for pogo pad targets (audit 6.2)
    translate([pod_length/2 - pogo_pad_recess, -pogo_pad_w/2, pogo_z_from_bot - pogo_pad_h/2])
        cube([pogo_pad_recess + 1, pogo_pad_w, pogo_pad_h]);
}

module docking_slot() {
    // Slot on right face — receives cell 1's tongue
    translate([pod_length/2 - dock_slot_depth, -dock_slot_w/2, pod_height/2 - dock_slot_h/2])
        cube([dock_slot_depth + 1, dock_slot_w, dock_slot_h]);
}

module magnet_pockets() {
    // 3 magnet pockets on right face — press-fit NeFeB discs
    // Cylinders oriented along X axis, blind holes from outer face inward
    for(my = mag_y_positions) {
        translate([pod_length/2 - mag_depth + 0.01, my, mag_z])
        rotate([0, 90, 0])
            cylinder(d=mag_dia, h=mag_depth + 1, $fn=30);
    }
}

module antenna_grille() {
    // Thin slots on right end wall for WiFi antenna radiation
    // The end wall is thinned to antenna_wall thickness
    for(i = [0 : antenna_slot_count - 1]) {
        y_pos = -((antenna_slot_count - 1) * (antenna_slot_w + 2)) / 2 + i * (antenna_slot_w + 2);
        translate([pod_length/2 - pod_wall - 1, y_pos - antenna_slot_w/2,
                   pod_height/2 - antenna_slot_h/2])
            cube([pod_wall - antenna_wall + 1, antenna_slot_w, antenna_slot_h]);
    }
}

module pcb_bosses() {
    // M2 mounting posts on floor for ESP32 NodeMCU PCB
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * pcb_boss_x_off, sy * pcb_boss_y_off, pod_floor]) {
            difference() {
                cylinder(d=pcb_boss_dia, h=pcb_boss_h);
                translate([0, 0, 1])
                    cylinder(d=pcb_boss_hole, h=pcb_boss_h);
            }
        }
    }
}

module wire_tie_post() {
    // Internal post near pogo end — cable tie wraps around post
    translate([pod_length/2 - pod_wall - 8, pod_int_width/2 - 4, pod_floor]) {
        difference() {
            cylinder(d=tie_post_dia, h=tie_post_h, $fn=30);
            // Horizontal slot for cable tie (rectangular, cleaner than cylinder)
            translate([-tie_post_dia/2 - 1, -tie_post_hole/2, tie_post_h/2 - tie_post_hole/2])
                cube([tie_post_dia + 2, tie_post_hole, tie_post_hole]);
        }
    }
}

// --- 3. MAIN ASSEMBLY ---

union() {
    difference() {
        // A. Outer shell
        rounded_box(pod_length, pod_width, pod_height, pod_fillet);

        // B. Internal cavity (open top for assembly, or add lid later)
        translate([0, 0, pod_floor])
            internal_cavity();

        // C. Barrel jack hole (top face)
        barrel_jack_cutout();

        // D. USB cutout (left face)
        usb_cutout();

        // E. Pogo pad recess (right face, 1mm deep)
        pogo_pad_recess_cutout();

        // F. Docking slot (right face — tongue receiver)
        docking_slot();

        // G. Magnet pockets (right face — 3x NeFeB press-fit)
        magnet_pockets();

        // H. WiFi antenna grille (right end wall thinned)
        antenna_grille();
    }

    // I. PCB mounting bosses
    pcb_bosses();

    // J. Wire tie-down post
    wire_tie_post();
}
