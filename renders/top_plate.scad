// =========================================================
// BRAILLE CELL TOP PLATE GENERATOR (Spec v1.0)
// =========================================================

// --- 1. PARAMETERS (From Section 3) ---
col_spacing = 4.8;          // Horizontal distance between columns (mm)
row_spacing = 2.6;          // Vertical distance between rows (mm)
pin_diameter = 1.6;         // Nominal pin diameter
pin_bore_clearance = 0.15;  // Extra gap for 3D printing (0.15 recommended)
plate_thickness = 3.0;      // Plate thickness (2mm acrylic, 3mm CNC)
plate_width = 20.0;         // Overall width
plate_height = 28.0;        // Overall height
corner_radius = 2.0;        // Smooth corners
finger_pad_depth = 0.8;     // How deep the finger recess is
spring_pocket_depth = 1.5;  // Depth of spring recess from bottom
spring_pocket_dia = 3.5;    // Diameter of spring hole
mounting_radius = 12.0;     // Radius of the 3 screw holes
screw_dia = 2.8;            // Clearance for M2.5 screw
dowel_dia = 1.6;            // Alignment pin diameter

// Calculated Values
bore_dia = pin_diameter + pin_bore_clearance;
$fn = 60; // Smoothness

// --- 2. MODULES ---

module rounded_rect(w, h, r, height) {
    hull() {
        translate([-w/2 + r, -h/2 + r, 0]) cylinder(r=r, h=height);
        translate([ w/2 - r, -h/2 + r, 0]) cylinder(r=r, h=height);
        translate([-w/2 + r,  h/2 - r, 0]) cylinder(r=r, h=height);
        translate([ w/2 - r,  h/2 - r, 0]) cylinder(r=r, h=height);
    }
}

module braille_holes() {
    // Generates the 6 holes based on Section 4 coordinates
    // We loop through columns (x) and rows (y)
    
    // Left Column (-x)
    translate([-col_spacing/2,  row_spacing, -1]) children(); // Dot 1
    translate([-col_spacing/2,  0,           -1]) children(); // Dot 2
    translate([-col_spacing/2, -row_spacing, -1]) children(); // Dot 3
    
    // Right Column (+x)
    translate([ col_spacing/2,  row_spacing, -1]) children(); // Dot 4
    translate([ col_spacing/2,  0,           -1]) children(); // Dot 5
    translate([ col_spacing/2, -row_spacing, -1]) children(); // Dot 6
}

// --- 3. MAIN ASSEMBLY ---

difference() {
    // A. Main Body
    rounded_rect(plate_width, plate_height, corner_radius, plate_thickness);

    // B. Finger Pad Recess (Ergonomics)
    // A slightly smaller rounded rect subtracted from the top
    translate([0, 0, plate_thickness - finger_pad_depth])
        rounded_rect(plate_width - 4, plate_height - 4, corner_radius, finger_pad_depth + 1);

    // C. Pin Bores (Through Holes)
    braille_holes() {
        cylinder(r=bore_dia/2, h=plate_thickness + 5);
    }
    
    // D. Spring Pockets (From Bottom)
    // Wider holes on the underside to hold the springs
    braille_holes() {
        cylinder(r=spring_pocket_dia/2, h=spring_pocket_depth + 1);
    }
    
    // E. Mounting Holes (3x M2.5 at 120 degrees)
    for(i = [0 : 2]) {
        rotate([0, 0, i * 120])
        translate([0, mounting_radius, -1]) {
            // Screw Hole
            cylinder(r=screw_dia/2, h=plate_thickness + 5);
            // Counterbore (Head recess)
            translate([0,0, plate_thickness - 1.5])
                cylinder(r=screw_dia, h=5); 
        }
    }
    
    // F. Alignment Dowel (As per Section 7)
    translate([6, 0, -1])
        cylinder(r=dowel_dia/2, h=5);
}

// --- 4. ADDITIONS (Tactile Features) ---

// G. Tactile Reference Ridge (Thumb Guide)
translate([-plate_width/2 + 1.5, 0, plate_thickness])
    hull() {
        translate([0, -3, 0]) sphere(r=0.6);
        translate([0,  3, 0]) sphere(r=0.6);
    }

// H. Chamfering the Top Holes (Cosmetic)
// Note: In 3D printing, explicit chamfers print better than fillets
intersection() {
    translate([0,0, plate_thickness - finger_pad_depth])
    braille_holes() {
        cylinder(r1=bore_dia/2, r2=bore_dia/2 + 0.5, h=0.5); // 45 deg chamfer
    }
}