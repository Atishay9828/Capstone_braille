// =========================================================
// *** DEPRECATED — 2026-05-15 ***
// Replaced by ball-on-nub approach: 2mm bearing ball glued directly
// into a laser-cut cup on the metal linkage nub tip. This eliminates
// the braille cap entirely — fewer parts, more reliable, no socket
// alignment issues. See linkage.scad nub_w=2.2mm.
// =========================================================
//
// =========================================================
// COMPONENT: BRAILLE DOT CAPS — Bearing Ball Cup Design (DEPRECATED)
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

// braille_cap_v2.scad
plate_thickness  = 4.0;
cap_pin_dia      = 1.9;    
cap_pin_len      = 5.5;  // FIXED: Was 3.5mm. Now 4.0mm (plate) + 1.5mm (nub overlap)
cap_flange_dia   = 3.0;    
cap_flange_h     = 1.0;    
cap_body_dia     = 3.5;    
cap_body_h       = 1.5;    
ball_dia         = 2.0;    
cup_depth        = 0.8;    
cup_r            = ball_dia / 2 + 0.1; 

$fn = 60;

module braille_cap() {
    // A. Pin shaft with RECTANGULAR SOCKET for metal linkage nub (audit 4)
    //    Socket: 1.3mm x 1.1mm x ~1mm deep (0.1mm tolerance over 1.2mm x 1.0mm nub)
    //    Metal nub slides in from below, secured with CA glue (cyanoacrylate)
    difference() {
        cylinder(d=cap_pin_dia, h=cap_pin_len);
        // Rectangular blind socket at pin bottom — receives linkage nub
        translate([0, 0, -0.01])
            cube([1.3, 1.1, 2.0], center=true);
    }

    // B. Retention flange (sits below 4mm plate underside)
    flange_z = cap_pin_len - plate_thickness - cap_flange_h;
    translate([0, 0, flange_z]) cylinder(d=cap_flange_dia, h=cap_flange_h);

    // C. Body + bearing ball cup
    translate([0, 0, cap_pin_len]) difference() {
        cylinder(d=cap_body_dia, h=cap_body_h);
        translate([0, 0, cap_body_h - cup_depth + cup_r]) sphere(r=cup_r);
    }
}
braille_cap();

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
