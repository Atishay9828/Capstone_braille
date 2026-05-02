// =========================================================
// COMPONENT 05: MODULAR ENCLOSURE SHELL
// =========================================================

// --- 1. PARAMETERS (From Section 22) ---
shell_length = 78;          // X dimension
shell_width = 68;           // Y dimension
shell_height = 28;          // Z dimension
wall_thickness = 4;
floor_thickness = 4;

// Internal Cavity
internal_length = 64;       // Fits the 60mm Base Plate + 4mm clearance
internal_width = 54;        // Fits the 50mm Base Plate + 4mm clearance
internal_depth = 22;

// Docking System (Tongue and Slot)
tongue_length = 8;
tongue_thickness = 3;
tongue_height = 12;
slot_width = 3.3;           // 0.3mm clearance over tongue_thickness
slot_height = 12.2;
slot_depth = 8.2;

// Fasteners
dock_screw_diameter = 3.4;
dock_nut_flat = 5.6;
dock_nut_pocket_depth = 2.6;
boss_outer_diameter = 8;
boss_hole_diameter = 3.2;

// Utilities
wire_slot_width = 10;
wire_slot_height = 6;
vent_slot_width = 1.5;
vent_slot_length = 12;
vent_slot_count = 5;

// Motor Clearance (For 28BYJ-48 hanging below base plate)
motor_clearance_diameter = 34;
motor_clearance_depth = 20;

// Base Plate Seating Ledge
ledge_height = 1.5;
ledge_width = 2.0;

// Pogo Pin Connectors (4-pin, 2mm pitch, daisy-chain UART)
// Set has_right_pogo = false for the last cell in a chain (right wall stays solid)
has_right_pogo  = true;
pogo_slot_w     = 10;   // Wide enough for a 4-pin 2mm-pitch PCB connector
pogo_slot_h     = 8;    // Height of the rectangular window
pogo_slot_depth = wall_thickness + 2; // Through-wall cutout
pogo_z          = floor_thickness + (shell_height - floor_thickness)/2; // Mid-height of side wall

// Aesthetics
fillet_outer = 2.0;
fillet_inner = 1.0;

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

module docking_tongue() {
    // Left side male connector
    translate([-shell_length/2 - tongue_length/2 + 0.1, 0, shell_height/2])
        cube([tongue_length, tongue_thickness, tongue_height], center=true);
}

module docking_slot_cutout() {
    // Right side female receiver
    translate([shell_length/2, 0, shell_height/2])
        cube([slot_depth * 2, slot_width, slot_height], center=true);
}

module docking_screw_holes() {
    // Holes passing horizontally through the docking joints
    for(y_offset = [-15, 15]) { // Two screws per side
        translate([0, y_offset, shell_height/2])
        rotate([0, 90, 0]) {
            // Through Hole
            cylinder(d=dock_screw_diameter, h=shell_length + 20, center=true);
            
            // Nut Trap Pocket (Right side, inside the slot area)
            translate([0, 0, shell_length/2 - 5])
                cylinder(d=dock_nut_flat / cos(30), h=dock_nut_pocket_depth + 5, $fn=6); // Hex nut
        }
    }
}

module ventilation_slots() {
    // Front and Back wall vents
    for(y = [-shell_width/2 + wall_thickness/2, shell_width/2 - wall_thickness/2]) {
        for(i = [0 : vent_slot_count - 1]) {
            x_pos = -15 + (i * (vent_slot_width + 4));
            translate([x_pos, y, shell_height/2])
                cube([vent_slot_width, wall_thickness + 2, vent_slot_length], center=true);
        }
    }
}

module pogo_connector_slots() {
    // Left wall slot — spring-loaded pins face outward to contact the previous cell
    translate([-shell_length/2, 0, pogo_z])
        cube([pogo_slot_depth, pogo_slot_w, pogo_slot_h], center=true);
    // Right wall slot — contact pads / PCB receiver side
    if(has_right_pogo)
        translate([shell_length/2, 0, pogo_z])
            cube([pogo_slot_depth, pogo_slot_w, pogo_slot_h], center=true);
}

module wire_exit() {
    // Back lower corner slot for motor cables
    translate([-shell_length/2 + 10, shell_width/2, floor_thickness + wire_slot_height/2])
        cube([15, wall_thickness + 2, wire_slot_height], center=true);
}

module corner_bosses() {
    // Internal pillars to screw the Base Plate down into the shell
    // These align with the 60x50mm Base Plate corners
    base_l = 60;
    base_w = 50;
    
    for(x = [-1, 1]) for(y = [-1, 1]) {
        translate([x * (base_l/2 - 6), y * (base_w/2 - 6), floor_thickness]) {
            difference() {
                cylinder(d=boss_outer_diameter, h=internal_depth);
                translate([0,0,5]) cylinder(d=boss_hole_diameter, h=internal_depth); // M3 tap hole
            }
        }
    }
}

// --- 3. MAIN ASSEMBLY ---

union() {
    difference() {
        // A. Main Outer Shell
        rounded_box(shell_length, shell_width, shell_height, fillet_outer);
        
        // B. Main Internal Cavity (Leaves Floor and Walls)
        translate([0, 0, floor_thickness])
            rounded_box(internal_length, internal_width, shell_height, fillet_inner);
            
        // C. Motor Clearance Pocket (Into the floor)
        // Drops down 20mm from the floor surface to clear the 28BYJ body
        translate([0, 0, floor_thickness])
            cylinder(d=motor_clearance_diameter, h=motor_clearance_depth + 1, center=true);
            
        // D. Docking Slot (Right Side)
        docking_slot_cutout();
        
        // E. Docking Screw Holes
        docking_screw_holes();
        
        // F. Ventilation & Wiring
        ventilation_slots();
        wire_exit();

        // K. Pogo Pin Connector Slots (Left always, Right conditional)
        pogo_connector_slots();
        
        // G. Nameplate Recess (Top Front Edge)
        translate([0, -shell_width/2, shell_height - 5])
            cube([30, 2, 10], center=true);
    }
    
    // H. Add Modular Tongue (Left Side)
    docking_tongue();
    
    // I. Add Internal Screw Bosses
    corner_bosses();
    
    // J. Base Plate Seating Ledge (Supports the 60x50 plate)
    translate([0,0, floor_thickness])
    difference() {
        rounded_box(internal_length, internal_width, ledge_height, fillet_inner);
        translate([0,0,-1])
            rounded_box(60 + 0.5, 50 + 0.5, ledge_height + 2, fillet_inner); // 0.5 clearance
    }
}