// =========================================================
// BRAILLE CELL TOP PLATE — v2.0
// Changes from v1: 34x34mm footprint, 4-corner M2.5 holes
// matching base_plate standoffs at ±15mm, rectangular
// 1.2x3mm linkage slots replacing round pin bores.
// =========================================================

// --- 1. PARAMETERS ---
col_spacing       = 4.8;   // Horizontal distance between pin columns (mm)
row_spacing       = 2.6;   // Vertical distance between pin rows (mm)
slot_width        = 1.2;   // Linkage slot width (matches 1mm metal + 0.2mm clearance)
slot_length       = 3.0;   // Slot length along travel axis
plate_thickness   = 3.0;
plate_size        = 34.0;  // Square plate — must reach standoffs at ±15mm
corner_radius     = 2.0;
finger_pad_depth  = 0.8;

// Spring pockets (underside — round, for compression springs)
spring_pocket_depth = 1.5;
spring_pocket_dia   = 3.5;

// Mounting — 4 corner holes matching base_plate standoffs at ±15mm
standoff_offset = 15.0;
screw_dia       = 2.8;   // M2.5 clearance
counterbore_dia = 5.0;   // For M2.5 button-head
counterbore_depth = 1.5;

$fn = 60;

// --- 2. MODULES ---

module rounded_square(size, r, h) {
    hull() {
        for(x = [-1,1]) for(y = [-1,1])
            translate([x*(size/2 - r), y*(size/2 - r), 0])
                cylinder(r=r, h=h);
    }
}

// 1.2x3mm rectangular slot, centred at origin, oriented along Y (linkage travel)
module linkage_slot() {
    translate([-slot_width/2, -slot_length/2, -1])
        cube([slot_width, slot_length, plate_thickness + 5]);
}

module braille_slots() {
    // Left column (dots 1-2-3)
    translate([-col_spacing/2,  row_spacing, 0]) linkage_slot();
    translate([-col_spacing/2,  0,           0]) linkage_slot();
    translate([-col_spacing/2, -row_spacing, 0]) linkage_slot();
    // Right column (dots 4-5-6)
    translate([ col_spacing/2,  row_spacing, 0]) linkage_slot();
    translate([ col_spacing/2,  0,           0]) linkage_slot();
    translate([ col_spacing/2, -row_spacing, 0]) linkage_slot();
}

module spring_pockets() {
    // Round pockets on the underside for return springs
    translate([-col_spacing/2,  row_spacing, -1]) cylinder(d=spring_pocket_dia, h=spring_pocket_depth + 1);
    translate([-col_spacing/2,  0,           -1]) cylinder(d=spring_pocket_dia, h=spring_pocket_depth + 1);
    translate([-col_spacing/2, -row_spacing, -1]) cylinder(d=spring_pocket_dia, h=spring_pocket_depth + 1);
    translate([ col_spacing/2,  row_spacing, -1]) cylinder(d=spring_pocket_dia, h=spring_pocket_depth + 1);
    translate([ col_spacing/2,  0,           -1]) cylinder(d=spring_pocket_dia, h=spring_pocket_depth + 1);
    translate([ col_spacing/2, -row_spacing, -1]) cylinder(d=spring_pocket_dia, h=spring_pocket_depth + 1);
}

module mounting_holes() {
    // 4 corner holes aligned with base_plate standoffs at ±15mm
    for(x = [-1,1]) for(y = [-1,1]) {
        translate([x * standoff_offset, y * standoff_offset, 0]) {
            // Screw clearance through-hole
            translate([0, 0, -1]) cylinder(d=screw_dia, h=plate_thickness + 5);
            // Counterbore on top
            translate([0, 0, plate_thickness - counterbore_depth])
                cylinder(d=counterbore_dia, h=counterbore_depth + 1);
        }
    }
}

// --- 3. MAIN ASSEMBLY ---

difference() {
    // A. Main body
    rounded_square(plate_size, corner_radius, plate_thickness);

    // B. Finger pad recess (ergonomic — subtracted from top face)
    translate([0, 0, plate_thickness - finger_pad_depth])
        rounded_square(plate_size - 6, corner_radius, finger_pad_depth + 1);

    // C. Linkage slots (rectangular, through holes)
    braille_slots();

    // D. Spring pockets (round, from bottom — stops before breaking through)
    spring_pockets();

    // E. Mounting holes (4 corners)
    mounting_holes();
}

// --- 4. TACTILE FEATURES ---

// Thumb ridge on left edge — guides blind user to left side of cell
translate([-plate_size/2 + 1.5, 0, plate_thickness])
    hull() {
        translate([0, -3, 0]) sphere(r=0.6);
        translate([0,  3, 0]) sphere(r=0.6);
    }

// Slot chamfers (help guide linkage insertion from below)
intersection() {
    translate([0, 0, plate_thickness - finger_pad_depth]) {
        translate([-col_spacing/2,  row_spacing, 0])
            translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
        translate([-col_spacing/2,  0, 0])
            translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
        translate([-col_spacing/2, -row_spacing, 0])
            translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
        translate([ col_spacing/2,  row_spacing, 0])
            translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
        translate([ col_spacing/2,  0, 0])
            translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
        translate([ col_spacing/2, -row_spacing, 0])
            translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
    }
    rounded_square(plate_size, corner_radius, plate_thickness);
}
