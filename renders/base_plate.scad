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
cam_pocket_diameter = 35;
cam_pocket_depth = 3;

// Pin Plate Standoffs
standoff_diameter = 6;
standoff_height = 3.5; // Above base surface
standoff_offset = 15;  // 15mm from center (symmetrical)

// Spring Cavity
spring_cavity_width = 22;
spring_cavity_depth = 16;
spring_cavity_height = 10; // Making it a through-hole for service access

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
    }
    standoffs();
    
    // Add Ribs (only where they intersect the base to make a solid object)
    intersection() {
        translate([0,0, -rib_height]) main_body(); // Constrain ribs to body footprint
        ribs();
    }
    // Note: In real print, ribs are added to the bottom. 
    // The intersection above is a trick. Let's just place them explicitly:
    translate([0,0,0]) ribs(); 
}