// =========================================================
// BRAILLE CELL TOP PLATE — v2.1
// Updated 2026-05-06
//
// Changes from v2.0:
//   - Spring pockets REMOVED for v1 prototype (gravity return is sufficient
//     for desk use; springs add complexity and the pocket/slot overlap
//     created degenerate geometry where 3.5mm pocket met 1.2mm slot).
//     Springs can be added in v2 once linkage flange geometry is finalised.
//   - Slot chamfers kept (aid linkage insertion during assembly).
//   - All other geometry unchanged.
//
// Unchanged from v2.0:
//   - 34×34mm footprint (reaches standoffs at ±15mm)
//   - 4 corner M2.5 screw holes matching base_plate standoffs at ±15mm
//   - 1.2×3mm rectangular linkage slots (constrains 1mm metal linkage to
//     vertical travel only — no rotation possible)
//   - Finger pad recess (ergonomic boundary)
//   - Thumb ridge (orientation reference for blind user)
// =========================================================

// --- 1. PARAMETERS ---

col_spacing     = 4.8;    // Horizontal distance between pin columns
row_spacing     = 2.6;    // Vertical distance between pin rows
slot_width      = 1.2;    // Linkage slot width (1mm metal + 0.2mm clearance)
slot_length     = 3.0;    // Slot length along travel axis (Y)
plate_thickness = 3.0;
plate_size      = 34.0;   // Square — must span standoffs at ±15mm (2mm margin each side)
corner_radius   = 2.0;
finger_pad_depth = 0.8;   // Shallow recess on top face — tactile cell boundary

// Mounting — 4 corner holes at ±15mm matching base_plate standoffs
standoff_offset  = 15.0;
screw_dia        = 2.8;   // M2.5 clearance
counterbore_dia  = 5.0;   // M2.5 button-head
counterbore_depth = 1.5;

$fn = 60;

// --- 2. MODULES ---

module rounded_square(size, r, h) {
    hull() {
        for(sx = [-1,1]) for(sy = [-1,1])
            translate([sx*(size/2 - r), sy*(size/2 - r), 0])
                cylinder(r=r, h=h);
    }
}

// 1.2×3mm rectangular slot, oriented along Y (linkage travel direction)
// Constrains flat laser-cut linkage: can only translate up/down, cannot rotate
module linkage_slot() {
    translate([-slot_width/2, -slot_length/2, -1])
        cube([slot_width, slot_length, plate_thickness + 5]);
}

module braille_slots() {
    // Left column: dots 1 (top), 2 (mid), 3 (bot)
    translate([-col_spacing/2,  row_spacing, 0]) linkage_slot();
    translate([-col_spacing/2,  0,           0]) linkage_slot();
    translate([-col_spacing/2, -row_spacing, 0]) linkage_slot();
    // Right column: dots 4 (top), 5 (mid), 6 (bot)
    translate([ col_spacing/2,  row_spacing, 0]) linkage_slot();
    translate([ col_spacing/2,  0,           0]) linkage_slot();
    translate([ col_spacing/2, -row_spacing, 0]) linkage_slot();
}

module mounting_holes() {
    for(sx = [-1,1]) for(sy = [-1,1]) {
        translate([sx * standoff_offset, sy * standoff_offset, 0]) {
            translate([0, 0, -1])
                cylinder(d=screw_dia, h=plate_thickness + 5);
            translate([0, 0, plate_thickness - counterbore_depth])
                cylinder(d=counterbore_dia, h=counterbore_depth + 1);
        }
    }
}

// --- 3. MAIN ASSEMBLY ---

difference() {
    // A. Main body
    rounded_square(plate_size, corner_radius, plate_thickness);

    // B. Finger pad recess (ergonomic boundary on top face)
    translate([0, 0, plate_thickness - finger_pad_depth])
        rounded_square(plate_size - 6, corner_radius, finger_pad_depth + 1);

    // C. Linkage slots (through holes, rectangular)
    braille_slots();

    // D. Mounting holes (4 corners, M2.5)
    mounting_holes();
}

// --- 4. TACTILE FEATURES ---

// Thumb ridge — left edge, guides blind user to cell orientation by touch
translate([-plate_size/2 + 1.5, 0, plate_thickness])
    hull() {
        translate([0, -3, 0]) sphere(r=0.6);
        translate([0,  3, 0]) sphere(r=0.6);
    }

// Slot chamfers — 0.3mm lead-in on each slot to guide linkage insertion from below
intersection() {
    translate([0, 0, plate_thickness - finger_pad_depth]) {
        for(cx = [-col_spacing/2, col_spacing/2]) {
            for(cy = [-row_spacing, 0, row_spacing]) {
                translate([cx, cy, 0])
                    translate([-slot_width/2 - 0.3, -slot_length/2 - 0.3, 0])
                        cube([slot_width + 0.6, slot_length + 0.6, 0.4]);
            }
        }
    }
    rounded_square(plate_size, corner_radius, plate_thickness);
}
