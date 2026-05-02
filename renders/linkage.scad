// =========================================================
// BRAILLIX LINKAGE SET — Laser-Cut Metal Cranks
// 6 stair-step flat metal pieces (1mm thick stainless/aluminium)
// that bridge each concentric cam track to its Braille dot slot.
//
// PRINT INTENT: These are NOT 3D-printed.
// Export as DXF from OpenSCAD (File > Export > DXF) for laser cutting.
// Material: 1mm stainless steel or 1mm aluminium sheet.
// Post-processing: sand foot tip smooth, lubricate with silicone grease.
// =========================================================

// --- 1. PARAMETERS ---

thickness     = 1.0;   // Sheet metal thickness (mm)
foot_w        = 2.0;   // Foot width (glides on cam track)
foot_len      = 2.5;   // Foot length (contact patch)
foot_radius   = 0.8;   // Rounded tip radius (minimise wear on resin cam)
riser_h       = 9.0;   // Vertical riser height (clears cam disc + base plate top surface)
nub_w         = 1.2;   // Top nub width — must match top_plate slot_width exactly
nub_len       = 2.0;   // Top nub length
nub_h         = 1.5;   // Top nub height (protrudes above top plate surface)
arm_h         = 1.5;   // Horizontal arm thickness

// Cam track geometry (must match braille_cam2.scad)
track_width   = 1.6;
track_gap     = 0.1;
inner_radius  = 8.0;

// Braille dot positions (must match top_plate.scad col/row spacing)
col_spacing   = 4.8;   // ±2.4mm from centre
row_spacing   = 2.6;   // +2.6, 0, -2.6mm

// Derived: centre radius of each track
function track_r(t) = inner_radius + t * (track_width + track_gap) + track_width / 2;

// Dot x positions: dots 1-3 on left column, dots 4-6 on right
function dot_x(dot) = (dot < 3) ? -col_spacing/2 : col_spacing/2;
function dot_y(dot) = (dot == 0 || dot == 3) ?  row_spacing :
                      (dot == 1 || dot == 4) ?  0 :
                                                -row_spacing;

// Track assignment: dot 0→track 0 (innermost), dot 5→track 5 (outermost)
function dot_track(dot) = dot;

$fn = 40;

// --- 2. MODULES ---

// One complete linkage rendered as a flat 2D profile extruded to thickness.
// origin = foot bottom-centre, x = horizontal, y = vertical (up = towards top plate)
// The foot rests on the cam track; the nub protrudes through the top plate slot.
//
// Parameters:
//   tr   — cam track centre radius (where the foot sits)
//   dx   — Braille dot x position (offset from cell centreline)

module linkage_2d(tr, dx) {
    // Calculate horizontal arm reach: from track centre to dot column
    arm_x = dx - 0;   // dx is already the absolute x of the dot column

    // Foot (centred at x=tr, y=0)
    // Riser bottom to top: y=0 to y=riser_h
    // Horizontal arm: at y=riser_h, spanning from x=tr to x=dx
    // Second riser: x=dx, from y=riser_h up to y=riser_h+nub_h+arm_h
    // Nub: top nub_h at x=dx, width=nub_w

    union() {
        // Foot — rounded rectangle at bottom
        translate([tr - foot_w/2, 0])
            hull() {
                translate([foot_radius, foot_radius])       circle(r=foot_radius);
                translate([foot_w - foot_radius, foot_radius]) circle(r=foot_radius);
                translate([foot_radius, foot_len])           square([foot_w - 2*foot_radius, 0.01]);
                translate([foot_w - foot_radius, foot_len])  square([0.01, 0.01]);
            }

        // Vertical riser (lower) — from foot top to horizontal arm
        translate([tr - thickness/2, foot_len])
            square([thickness, riser_h - foot_len]);

        // Horizontal arm — connects lower riser to upper riser at dx
        x_lo = min(tr, dx) - thickness/2;
        x_hi = max(tr, dx) + thickness/2;
        translate([x_lo, riser_h - arm_h])
            square([x_hi - x_lo, arm_h]);

        // Vertical riser (upper) — from horizontal arm to nub base
        translate([dx - thickness/2, riser_h])
            square([thickness, arm_h]);

        // Nub — fits into top_plate rectangular slot (width = nub_w)
        translate([dx - nub_w/2, riser_h + arm_h])
            square([nub_w, nub_h]);
    }
}

// 3D render (1mm thick extrusion) — for visual preview in OpenSCAD
module linkage_3d(tr, dx) {
    linear_extrude(height=thickness)
        linkage_2d(tr, dx);
}

// --- 3. GENERATE ALL 6 LINKAGES ---
// For DXF export: all 6 laid flat side-by-side with 3mm spacing.
// For assembly preview: comment the flat layout and use the positioned version below.

// ----- FLAT LAYOUT (use this for DXF export) -----
spacing = 30;   // mm between linkages on DXF sheet

for(dot = [0:5]) {
    tr = track_r(dot_track(dot));
    dx = dot_x(dot);
    translate([dot * spacing, 0, 0])
        linkage_3d(tr, dx);
}

// ----- ASSEMBLY PREVIEW (comment out above, uncomment below for visualisation) -----
// Positions each linkage at its correct x offset for assembly check.
// The foot should sit at the correct cam track radius.
//
// for(dot = [0:5]) {
//     tr = track_r(dot_track(dot));
//     dx = dot_x(dot);
//     color( (dot<3) ? "silver" : "lightgray" )
//     translate([0, 0, 0])
//         linkage_3d(tr, dx);
// }

// --- 4. REFERENCE TABLE ---
// Linkage | Track # | Track centre radius | Dot   | Dot X  | Dot Y
//    0    |    0    |     8.85 mm         | dot1  | -2.4mm | +2.6mm
//    1    |    1    |    10.55 mm         | dot2  | -2.4mm |  0 mm
//    2    |    2    |    12.25 mm         | dot3  | -2.4mm | -2.6mm
//    3    |    3    |    13.95 mm         | dot4  | +2.4mm | +2.6mm
//    4    |    4    |    15.65 mm         | dot5  | +2.4mm |  0 mm
//    5    |    5    |    17.35 mm         | dot6  | +2.4mm | -2.6mm
