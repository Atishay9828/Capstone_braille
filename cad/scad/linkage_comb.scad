// =========================================================
// COMPONENT: LINKAGE COMB GUIDE — Linear Bearing Block
// Revision 1.0
// Created 2026-05-06
//
// Separate clip-in guide block that sits above the motor mid-plate
// inside the outer_box. 6 vertical slits act as linear bearings
// for the sheet metal linkages — prevents wobble, twisting, and
// cross-over during cam rotation. (Audit 6.4)
//
// Print in PETG for tighter dimensional tolerance on slots.
// Clips onto mid-plate via snap tabs on bottom edge.
//
// Slit positions match Braille dot columns:
//   Left column:  x = -2.4mm (dots 0, 1, 2)
//   Right column: x = +2.4mm (dots 3, 4, 5)
//   Row spacing:  y = -2.6, 0, +2.6mm
// =========================================================

// --- 1. PARAMETERS ---

// Braille dot positions (must match linkage.scad, top_plate.scad)
col_spacing   = 4.8;
row_spacing   = 2.6;

// Comb body
comb_w        = 20;       // X — spans ±10mm (covers ±2.4mm dot columns + margin)
comb_d        = 14;       // Y — spans cam reading zone (3 rows + margin)
comb_h        = 10;       // Z — guide height (linkages travel 0.8mm inside)

// Slits — vertical channels for each linkage
slit_w        = 1.25;     // Slightly wider than 1.0mm steel — tight sliding fit
slit_d_extra  = 2;        // Extra depth on each side for entry clearance

// Column X positions
col_x         = [-col_spacing/2, col_spacing/2]; // [-2.4, +2.4]

// Clip tabs — snap into slots on mid-plate top surface
clip_tab_w    = 3;
clip_tab_h    = 1.5;
clip_tab_overhang = 0.5;  // Snap lip depth

$fn = 40;

// --- 2. MODULES ---

module comb_body() {
    // Main rectangular block with rounded vertical edges
    hull() {
        for(sx = [-1, 1]) for(sy = [-1, 1]) {
            translate([sx * (comb_w/2 - 1), sy * (comb_d/2 - 1), 0])
                cylinder(r=1, h=comb_h);
        }
    }
}

module linkage_slits() {
    // 6 slits: 2 columns x 3 rows
    // Each slit is a full-depth vertical channel through the comb
    for(cx = col_x) {
        for(ry = [-row_spacing, 0, row_spacing]) {
            translate([cx, ry, -0.5])
                cube([slit_w, comb_d + slit_d_extra, comb_h + 1], center=true);
        }
    }
}

module clip_tabs() {
    // Snap tabs on ±Y faces at bottom edge — clip into mid-plate slots
    for(sy = [-1, 1]) {
        translate([0, sy * (comb_d/2), 0]) {
            // Tab body
            translate([-comb_w/4, 0, 0])
                cube([comb_w/2, sy * clip_tab_w, clip_tab_h]);
            // Snap lip (small overhang for retention)
            translate([-comb_w/4, sy * clip_tab_w, 0])
                cube([comb_w/2, sy * clip_tab_overhang, clip_tab_overhang]);
        }
    }
}

module linkage_comb() {
    union() {
        difference() {
            comb_body();
            linkage_slits();
        }
        clip_tabs();
    }
}

// --- 3. GENERATE ---

linkage_comb();

// --- 4. NOTES ---
// Material: PETG (better dimensional accuracy than PLA for tight slots)
// Print orientation: upright (Z = comb height) for best slit tolerance
// Post-process: run 1mm steel strip through each slit to verify fit
// If too tight: sand lightly or increase slit_w by 0.05mm increments
