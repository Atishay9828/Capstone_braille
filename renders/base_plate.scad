// =========================================================
// COMPONENT 03: BASE PLATE (28BYJ-48 OPTIMIZED)
// =========================================================

// --- 1. PARAMETERS (Section 12) ---
base_length = 60;
base_width = 50;
base_thickness = 5;

// Motor Interface (28BYJ-48)
shaft_clearance = 8;
motor_body_diameter = 28.3; // +0.3mm tolerance
motor_seat_depth = 1.5;
motor_mount_spacing = 31;
motor_mount_hole = 3.4;

// Cam Interface
cam_pocket_diameter = 37; // 36.4mm cam + 0.3mm clearance each side
cam_pocket_depth = 3;

// Pin Plate Standoffs
standoff_diameter = 6;
standoff_height = 3.5; // Above base surface
standoff_offset = 15;  // 15mm from center (symmetrical)

// Spring Cavity
spring_cavity_width = 22;
spring_cavity_depth = 16;
spring_cavity_height = 10; // Making it a through-hole for service access

// Hall Effect Sensor (homing)
hall_pocket_x = 19;     // Just outside cam track area (cam radius 18.2mm + 0.8mm)
hall_pocket_y = 0;
hall_pocket_w = 5;      // SS49E / A3144 footprint
hall_pocket_d = 4;
hall_pocket_h = 3;      // Leaves 2mm floor under sensor
hall_wire_w   = 2;      // Wire channel width
hall_wire_d   = 1;      // Wire channel depth

// Ribbing
rib_thickness = 3;
rib_height = 3;

// Smoothness
$fn = 80;

// --- 2. MODULES ---

module main_body() {
    translate([-base_length/2, -base_width/2, 0])
        cube([base_length, base_width, base_thickness]);
}

module motor_features() {
    // 1. Shaft Clearance (Through Hole)
    cylinder(d=shaft_clearance, h=20, center=true);
    
    // 2. Motor Seating Pocket (From Bottom)
    translate([0,0, -0.1])
        cylinder(d=motor_body_diameter, h=motor_seat_depth + 0.1);
        
    // 3. Mounting Ears (Cutout for ears + Screw Holes)
    for(i = [-1, 1]) {
        translate([i * (motor_mount_spacing/2), 0, 0]) {
            // Screw Hole
            cylinder(d=motor_mount_hole, h=20, center=true);
            // Ear Recess (Optional, to let ears sit flush if needed, usually just screw hole is enough)
            // We keep it simple per spec: just holes.
        }
    }
}

module cam_features() {
    // Cam Pocket (From Top)
    translate([0,0, base_thickness - cam_pocket_depth])
        cylinder(d=cam_pocket_diameter, h=cam_pocket_depth + 1);
}

module hall_sensor_pocket() {
    // Rectangular recess for Hall effect sensor body
    translate([hall_pocket_x - hall_pocket_w/2,
               hall_pocket_y - hall_pocket_d/2,
               base_thickness - hall_pocket_h])
        cube([hall_pocket_w, hall_pocket_d, hall_pocket_h + 1]);
    // Wire channel running to edge of plate
    translate([hall_pocket_x + hall_pocket_w/2,
               hall_pocket_y - hall_wire_w/2,
               base_thickness - hall_wire_d])
        cube([base_length/2 - hall_pocket_x - hall_pocket_w/2 + 1,
              hall_wire_w, hall_wire_d + 1]);
}

module spring_cavity() {
    // Centered rectangular cutout (Section 10)
    // We make it a through-hole window for easier assembly
    cube([spring_cavity_width, spring_cavity_depth, 20], center=true);
}

module standoffs() {
    // 4 Corner Posts (Section 9)
    for(x = [-1, 1]) for(y = [-1, 1]) {
        translate([x * standoff_offset, y * standoff_offset, base_thickness]) {
            difference() {
                // Post Body
                cylinder(d=standoff_diameter, h=standoff_height);
                // Screw Hole (M2.5)
                translate([0,0,-1])
                    cylinder(d=2.6, h=standoff_height + 2);
            }
        }
    }
}

module ribs() {
    // Underside Structural Ribs (Section 11)
    // Must avoid the Motor Seat (approx R=15)
    
    safe_radius = motor_body_diameter/2 + 2;
    
    // X-Axis Ribs (Top and Bottom edges approx)
    for(y_pos = [-base_width/2 + 2, base_width/2 - 2 - rib_thickness]) {
        translate([-base_length/2, y_pos, -rib_height])
            cube([base_length, rib_thickness, rib_height]);
    }
    
    // Y-Axis Ribs (Left and Right edges approx)
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
    intersection() {
        translate([0,0, -rib_height]) main_body();
        ribs();
    }
}