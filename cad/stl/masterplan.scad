// =========================================================
// RESIN PRINT MASTER PLATE (SLA ASSEMBLY)
// =========================================================
// This script combines your 3 high-precision resin parts,
// lifts them 5mm (for support material generation), and 
// tilts them at exactly 45 degrees for optimal SLA printing.
//
// PREREQUISITES:
// Make sure you have pressed F6 and exported these 3 files 
// as STLs into the SAME FOLDER as this script:
//   1. braille_cam2.stl
//   2. braille_cap.stl (This already contains all 6 caps)
//   3. nav_cap.stl     (This already contains all 3 buttons)
// =========================================================

$fn = 60;
print_angle = 45;
support_lift = 5.0;

// 1. The Cam Disc (Centered)
translate([0, 0, support_lift]) 
    rotate([print_angle, 0, 0]) 
        import("braille_cam2.stl");

// 2. The 6 Braille Caps (Spaced safely to the right)
// The caps are laid out along the X axis, tilting them on X puts them at an angle
translate([35, 0, support_lift]) 
    rotate([print_angle, 0, 0]) 
        import("braille_cap.stl");

// 3. The 3 Nav Buttons (Spaced safely to the left)
translate([-35, 0, support_lift]) 
    rotate([print_angle, 0, 0]) 
        import("nav_cap.stl");