// =========================================================
// COMPONENT: BRAILLE DOT CAPS — Bearing Ball Cup Design
// Revision 1.0
// Created 2026-05-06
//
// 3D-printed cap with 2mm stainless steel bearing ball glued into
// hemispherical cup on top. Provides cold, smooth, indestructible
// tactile Braille dot surface (Audit 4.3 + 6.5).
//
// Assembly:
//   1. Pin shaft passes DOWN through top_plate 2mm round hole
//   2. Flange sits on underside of top plate (retention — prevents
//      cap from falling through hole)
//   3. Spring pushes flange downward (cap follows linkage travel)
//   4. Linkage nub keys into slot on pin shaft bottom
//   5. Bearing ball glued into cup on top — user touches this
//
// Material: PETG or PLA (rigid body, cup retains ball mechanically)
// Ball: 2mm stainless steel bearing ball (CA glue into cup)
// =========================================================

// --- 1. PARAMETERS ---

// Reference: top_plate.scad plate_thickness
plate_thickness  = 4.0;

// Pin shaft — passes through top plate hole
cap_pin_dia      = 1.9;    // Slides through 2.0mm hole (0.1mm clearance)
cap_pin_len      = 3.5;    // 3mm through plate + 0.5mm keyed into linkage nub slot

// Retention flange — sits on underside of top plate
cap_flange_dia   = 3.0;    // Wider than 2mm hole — prevents cap falling through
cap_flange_h     = 1.0;    // Flange height

// Body — sits above top plate surface when dot is UP
cap_body_dia     = 3.5;    // Visible cap body diameter
cap_body_h       = 1.5;    // Body height above plate surface

// Bearing ball cup — hemispherical recess on top
ball_dia         = 2.0;    // Standard 2mm stainless steel bearing ball
cup_depth        = 0.8;    // Depth of hemispherical cup
cup_r            = ball_dia / 2 + 0.1; // 1.1mm radius — slight interference fit

$fn = 60;

// --- 2. MODULES ---

module braille_cap() {
    // Build upward from pin bottom (z=0) to cup top

    // A. Pin shaft (through top plate hole + into linkage nub)
    cylinder(d=cap_pin_dia, h=cap_pin_len);

    // B. Retention flange on underside of top plate
    // Position: pin goes through plate_thickness of plate, flange sits
    // at the bottom face of the plate
    flange_z = cap_pin_len - plate_thickness - cap_flange_h;
    translate([0, 0, flange_z])
        cylinder(d=cap_flange_dia, h=cap_flange_h);

    // C. Body + bearing ball cup (above plate surface)
    translate([0, 0, cap_pin_len])
    difference() {
        // Cylindrical body
        cylinder(d=cap_body_dia, h=cap_body_h);

        // Hemispherical cup — centred on top face
        // Sphere centre is at z = cap_body_h - cup_depth + cup_r
        // (sphere extends cup_depth below the top surface)
        translate([0, 0, cap_body_h - cup_depth + cup_r])
            sphere(r=cup_r);
    }
}

// Preview: bearing ball in cup (for visual check only)
module bearing_ball_preview() {
    translate([0, 0, cap_pin_len + cap_body_h - cup_depth + cup_r])
        color("silver") sphere(d=ball_dia);
}

// --- 3. GENERATE ALL 6 CAPS ---
// Laid out in a row for 3D printing (8mm spacing)

for(i = [0:5]) {
    translate([i * 8, 0, 0]) {
        braille_cap();
        // Uncomment to preview bearing ball position:
        // bearing_ball_preview();
    }
}

// --- 4. SOURCING ---
// Ball: 2mm Grade 100 stainless steel bearing balls
//       Available in 100-packs (~$2-5)
// Glue: CA (cyanoacrylate / super glue) — one drop in cup, press ball in
