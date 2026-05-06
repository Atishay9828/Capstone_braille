// =========================================================
// COMPONENT: DIAGONAL LINKAGE COMB (V4 Architecture)
// Revision 2.0 — Diagonal Slits for Phase-Shifted Arms
// =========================================================
// 
// This is a drop-in guide block. It slides down the 4 corner
// standoffs and sits freely in the 9mm vertical void between 
// the top of the cam (Z=45.8) and the bottom of the top plate (Z=54).
//
// It features 6 open-top diagonal trenches that perfectly trace 
// the 2D footprint of the phase-shifted metal linkages.
// =========================================================

// --- 1. PARAMETERS ---

comb_size       = 38.0;    // Spans ±19mm to reach standoffs at ±15mm
comb_thickness  = 5.0;     // 5mm vertical guide height
standoff_offset = 15.0;    // Matches base_plate and top_plate
standoff_hole_d = 6.4;     // Clearance for 6.0mm OD standoffs

// Braille Array Geometry (Must match linkage_v4.scad)
col_spacing     = 4.8;
row_spacing     = 2.6;
track_width     = 1.6;
track_gap       = 0.1;
inner_radius    = 8.0;

slit_width      = 1.3;     // 1.0mm sheet metal + 0.3mm sliding clearance

$fn = 60;

// Track and dot position math
function track_r(t) = inner_radius + t * (track_width + track_gap) + track_width / 2;
function dot_x(d) = (d < 3) ? -col_spacing/2 : col_spacing/2;
function dot_y(d) = (d == 0 || d == 3) ?  row_spacing :
                    (d == 1 || d == 4) ?  0 :
                                         -row_spacing;

// --- 2. MODULES ---

module comb_body() {
    // Main plate spanning the standoffs
    hull() {
        for(sx = [-1, 1]) for(sy = [-1, 1]) {
            translate([sx * (comb_size/2 - 2), sy * (comb_size/2 - 2), 0])
                cylinder(r=2, h=comb_thickness);
        }
    }
}

module standoff_holes() {
    // 4 corner holes allowing the comb to slide down the pillars
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * standoff_offset, sy * standoff_offset, -1])
            cylinder(d=standoff_hole_d, h=comb_thickness + 2);
    }
}

module diagonal_slits() {
    // Generates 6 diagonal trenches connecting the Braille dot (nub)
    // to the Y=0 centerline of the cam (foot).
    for(d = [0 : 5]) {
        nx = dot_x(d);        // Nub X (Top of linkage)
        ny = dot_y(d);        // Nub Y
        fx = track_r(d);      // Foot X (Bottom of linkage)
        fy = 0;               // Foot Y (All feet rest on Y=0 axis)
        
        translate([0, 0, -1])
        linear_extrude(height = comb_thickness + 2)
        hull() {
            translate([nx, ny]) circle(d=slit_width);
            translate([fx, fy]) circle(d=slit_width);
        }
    }
}

// --- 3. ASSEMBLY ---

difference() {
    comb_body();
    standoff_holes();
    diagonal_slits();
}