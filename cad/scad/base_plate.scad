// =========================================================
// COMPONENT 03: BASE PLATE (28BYJ-48 OPTIMIZED)
// Revision 2.2 — Motor body offset -8mm (shaft ≠ body centre)
// Updated 2026-05-06
//
// Changes from v2.1:
//   - CRITICAL FIX (Audit 3.1): 28BYJ-48 shaft is offset ~8mm from
//     motor body centre. Shaft stays at x=0 (cam centred). Motor body
//     pocket and ear holes now translated to x=-8mm.
//   - base_length widened from 50→56mm to accommodate left ear at
//     x=-25.5mm (ear centre = -8 - 17.5 = -25.5mm). Plate edge at
//     -28mm gives 0.35mm clearance past hole edge.
//   - Plate fits in new outer_box v4.0 internal_length (60mm):
//     56mm plate + 2mm clearance each side. ✓
// =========================================================

// --- 1. PARAMETERS ---

// Plate body — centred over motor shaft (box centre x=0)
base_length     = 56;      // X — widened from 50 to fit offset motor left ear at x=-25.5mm
base_width      = 50;      // Y — unchanged
base_thickness  = 5;       // Z

// Motor Interface — CORRECTED for actual 28BYJ-48 measurements
// Previous values were wrong (body 28.3→29, mount hole 3.4→4.3, spacing 31→35)
shaft_clearance      = 7;      // 5mm shaft + 1mm clearance each side
motor_body_diameter  = 29;     // 28mm + 1mm tolerance (was 28.3mm — wrong)
motor_seat_depth     = 1.5;    // Shallow pocket to locate motor body centrally
motor_mount_spacing  = 35;     // Hole-to-hole distance (was 31mm — wrong)
motor_mount_hole     = 4.3;    // 4mm hole + 0.3mm clearance (was 3.4mm — wrong)

// Cam Interface (unchanged — matches braille_cam2.scad)
cam_pocket_diameter = 37;   // 36.4mm cam OD + 0.3mm clearance each side
cam_pocket_depth    = 3;    // Disc base (2mm) sits in pocket; bumps 0.2mm below plate top

// Standoffs — CRITICAL FIX: was 3.5mm, now 8mm
// Stack above plate: 8mm standoff + 3mm top plate = 11mm
// Linkage total height = 12mm, foot on cam bump (0.2mm below plate top) → nub at +0.8mm
standoff_diameter = 6;
standoff_height   = 8;     // Was 3.5mm — FAR too short for cam + linkage + top plate stack
standoff_offset   = 15;    // ±15mm from plate centre (must match outer_box boss_x/y_off)

// Spring Cavity — through-hole window for service access (unchanged)
spring_cavity_width  = 22;
spring_cavity_depth  = 16;

// Hall Effect Sensor pocket — REPOSITIONED
// Previous: x=19mm → pocket exceeded 42mm plate width (21.5mm > 21mm edge)
// New: at x=0, y=+20mm (along +Y axis, well within 25mm plate edge)
// Magnet angle in braille_cam2.scad changed from 0° to 90° to match
hall_pocket_x   = 0;
hall_pocket_y   = 20;      // +Y axis, outside cam OD (18.2mm) by 1.8mm
hall_pocket_w   = 5;       // SS49E / A3144 body footprint
hall_pocket_d   = 4;
hall_pocket_h   = 3;       // 2mm floor remaining below sensor
// Wire channel runs from sensor pocket to +Y plate edge (25mm)
hall_wire_w     = 2;
hall_wire_d     = 1;

// Ribbing (underside structural ribs)
rib_thickness   = 3;
rib_height      = 3;

$fn = 80;

// --- 2. MODULES ---

module main_body() {
    translate([-base_length/2, -base_width/2, 0])
        cube([base_length, base_width, base_thickness]);
}

// Motor body offset: shaft is NOT at body centre on the 28BYJ-48
// Shaft stays at x=0 (cam must be centred). Body centre at x=-8mm.
motor_body_x_offset = -8;

module motor_features() {
    // 1. Shaft clearance through-hole — STAYS at x=0 (cam disc centred here)
    cylinder(d=shaft_clearance, h=20, center=true);

    // 2. Motor body seating pocket — OFFSET -8mm (body centre ≠ shaft centre)
    translate([motor_body_x_offset, 0, -0.1])
        cylinder(d=motor_body_diameter, h=motor_seat_depth + 0.1);

    // 3. Motor mounting ear screw holes — SAME -8mm offset (ears fixed to body)
    //    Left ear:  x = -8 - 17.5 = -25.5mm
    //    Right ear: x = -8 + 17.5 = +9.5mm
    for(sx = [-1, 1]) {
        translate([sx * (motor_mount_spacing / 2) + motor_body_x_offset, 0, 0])
            cylinder(d=motor_mount_hole, h=20, center=true);
    }
}

module cam_features() {
    // Cam disc pocket (from top face, 3mm deep)
    // Disc base (2mm) sits here; bump tops end up 0.2mm below plate top
    translate([0, 0, base_thickness - cam_pocket_depth])
        cylinder(d=cam_pocket_diameter, h=cam_pocket_depth + 1);
}

module hall_sensor_pocket() {
    // Rectangular recess on top face for Hall effect sensor (SS49E / A3144)
    // Sensor detects magnet on cam disc underside as it passes at r=17.35mm
    // Sensor at y=20mm is 1.8mm outside cam OD (18.2mm) — detects at 1.8mm radial gap
    translate([hall_pocket_x - hall_pocket_w/2,
               hall_pocket_y - hall_pocket_d/2,
               base_thickness - hall_pocket_h])
        cube([hall_pocket_w, hall_pocket_d, hall_pocket_h + 1]);

    // Wire channel from pocket to +Y plate edge (for routing hall sensor wires)
    translate([hall_pocket_x - hall_wire_w/2,
               hall_pocket_y + hall_pocket_d/2,
               base_thickness - hall_wire_d])
        cube([hall_wire_w,
              base_width/2 - hall_pocket_y - hall_pocket_d/2 + 1,
              hall_wire_d + 1]);
}

module spring_cavity() {
    // Through-hole window — service access and weight reduction
    cube([spring_cavity_width, spring_cavity_depth, 20], center=true);
}

module standoffs() {
    // 4 corner posts — support top plate 8mm above base plate top
    // M2.5 tap holes for top plate mounting screws
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * standoff_offset, sy * standoff_offset, base_thickness]) {
            difference() {
                cylinder(d=standoff_diameter, h=standoff_height);
                translate([0, 0, -1])
                    cylinder(d=2.6, h=standoff_height + 2); // M2.5 clearance
            }
        }
    }
}

module ribs() {
    // Underside structural ribs — avoid motor body area
    // X-axis ribs (along plate edges in Y)
    for(y_pos = [-base_width/2 + 2, base_width/2 - 2 - rib_thickness]) {
        translate([-base_length/2, y_pos, -rib_height])
            cube([base_length, rib_thickness, rib_height]);
    }
    // Y-axis ribs (along plate edges in X)
    for(x_pos = [-base_length/2 + 2, base_length/2 - 2 - rib_thickness]) {
        translate([x_pos, -base_width/2, -rib_height])
            cube([rib_thickness, base_width, rib_height]);
    }
}

// --- 3. ASSEMBLY ---

union() {
    difference() {
        main_body();
        motor_features();
        cam_features();
        spring_cavity();
        hall_sensor_pocket();
    }
    standoffs();
    // Ribs clipped to plate footprint (no floating geometry)
    intersection() {
        translate([0, 0, -rib_height]) main_body();
        ribs();
    }
}
