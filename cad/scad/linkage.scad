// =========================================================
// BRAILLIX LINKAGE SET — Laser-Cut Metal Cranks
// Revision 3.0 — Inline Feet (Phase-Shift Fix)
// Updated 2026-05-06
//
// NOT 3D-printed. Export as DXF for laser cutting.
// Material: 1mm stainless steel or 1mm aluminium sheet.
// Post-process: sand foot tip smooth, lubricate with silicone grease.
//
// --- CRITICAL FIX FROM v2.0 (Audit 4.1) ---
// v2.0 BUG: linkages were rotated by atan2(dot_y, dot_x) — each foot
//   hit the cam at a DIFFERENT angle (dot 0 at 137deg, dot 4 at 0deg, etc).
//   At 5.625deg/character, this scrambled the Braille output completely.
//
// v3.0 FIX: All 6 feet now land at Y=0 on the cam disc (same angular
//   position). This is achieved by computing arm_span and assembly angle
//   so that:
//     - Nub lands at (dot_x, dot_y) — correct Braille position
//     - Foot lands at (track_r, 0)  — all feet aligned on Y=0 axis
//
// Key equations:
//   arm_span(d) = sqrt((track_r(d) - dot_x(d))^2 + dot_y(d)^2)
//   asm_ang(d)  = atan2(-dot_y(d), track_r(d) - dot_x(d))
//
// Arm heights re-staggered for collision safety (dots 1 & 4 critical pair):
//   dot 1 arm_y = 4.0mm, dot 4 arm_y = 7.8mm
//   Gap = 7.8 - 4.0 - 1.0(arm_h) = 2.8mm static
//   Worst case (cam bump): 2.8 - 0.8 = 2.0mm free — safe, no collision
//
// --- VERIFIED STACK (z from outer box bottom, v4.0) ---
//   z=45.0  cam flat surface  -> foot bottom (nub flush = dot DOWN)
//   z=45.8  cam bump top      -> foot bottom (nub 0.8mm proud = dot UP)
//   z=57.0  top plate top surface
//   total_h = 57.0 - 45.0 = 12.0mm (unchanged)
// =========================================================

// --- 1. PARAMETERS ---

thickness     = 1.0;    // Sheet metal thickness (extrusion depth for DXF)
foot_w        = 2.0;    // Foot width — straddles cam track (1.6mm wide), 0.2mm overhang each side
foot_len      = 2.5;    // Foot contact patch length
foot_radius   = 0.8;    // Rounded foot tip (reduces cam surface wear)
nub_w         = 1.2;    // Nub width — matches top_plate hole_dia clearance
nub_len       = 2.0;    // Nub length (radial extent)
nub_h         = 1.5;    // Nub protrusion above arm/upper-riser top
arm_h         = 1.0;    // Horizontal arm thickness
total_h       = 12.0;   // Total height: foot bottom to nub top (matches corrected stack)

// Cam geometry (must match braille_cam2.scad exactly)
track_width   = 1.6;
track_gap     = 0.1;
inner_radius  = 8.0;

// Braille dot positions (must match top_plate.scad)
col_spacing   = 4.8;    // Left column at x=-2.4, right at x=+2.4
row_spacing   = 2.6;    // Rows at y=+2.6, 0, -2.6

// Track centre radius for track index t
function track_r(t) = inner_radius + t * (track_width + track_gap) + track_width / 2;
//  t=0: 8.85mm   t=1: 10.55mm   t=2: 12.25mm
//  t=3: 13.95mm  t=4: 15.65mm   t=5: 17.35mm

function dot_x(dot) = (dot < 3) ? -col_spacing/2 : col_spacing/2;
function dot_y(dot) = (dot == 0 || dot == 3) ?  row_spacing :
                      (dot == 1 || dot == 4) ?  0 :
                                                -row_spacing;

// --- INLINE FEET GEOMETRY ---
// arm_span: horizontal distance from nub (at dot position) to foot (at cam track)
// After assembly transform, foot lands at world (track_r, 0) and nub at (dot_x, dot_y)
function arm_span(d) = sqrt(pow(track_r(d) - dot_x(d), 2) + pow(dot_y(d), 2));

// Assembly angle: rotate linkage so foot points from nub toward (track_r, 0)
function asm_ang(d) = atan2(-dot_y(d), track_r(d) - dot_x(d));

// Arm Y position from foot bottom — per-dot stagger for collision safety
// Critical pair: dots 1 and 4 (both at world Y=0, arms overlap in X)
//   dot 1: arm_y=4.0, dot 4: arm_y=7.8 -> gap=2.8mm static, 2.0mm with bump
function arm_y(d) = (d == 0) ? 3.5 :
                    (d == 1) ? 4.0 :
                    (d == 2) ? 9.5 :
                    (d == 3) ? 3.5 :
                    (d == 4) ? 7.8 :
                               9.5;

// Derived heights
function lower_riser_h(d) = arm_y(d) - foot_len;
function upper_riser_h(d) = total_h - arm_y(d) - arm_h - nub_h;

$fn = 40;

// --- 2. MODULES ---

// 2D profile of one linkage in its LOCAL coordinate frame.
// Local axes: X = arm direction (0=nub end, span=foot end), Y = vertical (up).
// Extruded to 'thickness' in Z for laser-cut preview.
//
// In assembly, each linkage is:
//   1. Extruded to thickness
//   2. Rotated by asm_ang(d) around Z
//   3. Translated to (dot_x(d), dot_y(d), 0)
// Result: nub at world (dot_x, dot_y), foot at world (track_r, 0)

module linkage_2d_v3(dot) {
    span = arm_span(dot);
    ay   = arm_y(dot);
    lr   = lower_riser_h(dot);
    ur   = upper_riser_h(dot);

    union() {
        // A. Foot — rounded rectangle at span end (cam/outer side)
        translate([span - foot_w/2, 0])
            hull() {
                translate([foot_radius, foot_radius])
                    circle(r=foot_radius);
                translate([foot_w - foot_radius, foot_radius])
                    circle(r=foot_radius);
                translate([foot_radius, foot_len])
                    square([foot_w - 2*foot_radius, 0.01]);
                translate([foot_w - foot_radius, foot_len])
                    square([0.01, 0.01]);
            }

        // B. Lower riser — from foot top up to arm bottom (at span end)
        if(lr > 0.01)
            translate([span - thickness/2, foot_len])
                square([thickness, lr]);

        // C. Horizontal arm — spans from X=0 (nub end) to X=span (foot end)
        translate([0, ay])
            square([span, arm_h]);

        // D. Upper riser — from arm top up to nub bottom (at X=0, nub end)
        if(ur > 0.01)
            translate([-thickness/2 + nub_w/2, ay + arm_h])
                square([thickness, ur]);

        // E. Nub — rectangular tab at top, centred at X=0
        //    This passes through top_plate hole and connects to braille_cap
        translate([0, total_h - nub_h])
            square([nub_w, nub_h]);
    }
}

module linkage_3d_v3(dot) {
    linear_extrude(height=thickness)
        linkage_2d_v3(dot);
}

// --- 3. GENERATE ALL 6 LINKAGES ---
// Laid flat side-by-side for DXF export. 30mm gap between each.
// For assembly preview: use the commented section below instead.

spacing = 30; // mm between linkage origins on DXF sheet

for(dot = [0:5]) {
    translate([dot * spacing, 0, 0])
        linkage_3d_v3(dot);
}

// --- ASSEMBLY PREVIEW (comment out flat layout above, uncomment here) ---
// All 6 feet should cluster at Y=0 on the cam. Nubs at their Braille dot positions.
// for(dot = [0:5]) {
//     ang = asm_ang(dot);
//     color((dot < 3) ? "silver" : "lightgray")
//     translate([dot_x(dot), dot_y(dot), 0])
//     rotate([0, 0, ang])
//         linkage_3d_v3(dot);
// }

// --- 4. REFERENCE TABLE ---
// Dot | Track | Track r | Dot pos      | arm_y | arm_span | asm_ang  | lr   | ur
//  0  |   0   |  8.85   | (-2.4, +2.6) |  3.5  |  11.55   | -13.0deg |  1.0 |  6.0
//  1  |   1   | 10.55   | (-2.4,  0.0) |  4.0  |  12.95   | 180.0deg |  1.5 |  5.5
//  2  |   2   | 12.25   | (-2.4, -2.6) |  9.5  |  14.88   | +10.1deg |  7.0 |  0.0
//  3  |   3   | 13.95   | (+2.4, +2.6) |  3.5  |  11.84   | -12.7deg |  1.0 |  6.0
//  4  |   4   | 15.65   | (+2.4,  0.0) |  7.8  |  13.25   |   0.0deg |  5.3 |  1.7
//  5  |   5   | 17.35   | (+2.4, -2.6) |  9.5  |  15.18   |  +9.9deg |  7.0 |  0.0
//
// Collision clearance (dots 1 & 4 — critical pair, both at world Y=0):
//   Static gap:  7.8 - 4.0 - 1.0 = 2.8mm
//   With bump:   2.8 - 0.8 = 2.0mm free  -- SAFE
