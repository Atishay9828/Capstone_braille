// =========================================================
// BRAILLIX LINKAGE SET — Laser-Cut Metal Cranks
// Revision 2.0 — Staggered arm heights, corrected total height
// Updated 2026-05-06
//
// NOT 3D-printed. Export as DXF for laser cutting.
// Material: 1mm stainless steel or 1mm aluminium sheet.
// Post-process: sand foot tip smooth, lubricate with silicone grease.
//
// --- KEY DESIGN CHANGE FROM v1.0 ---
// v1.0: all 6 linkages had the same riser_h = 9.0mm — WRONG.
//   The available gap (base plate top to top plate bottom) is only 8mm.
//   All linkages had identical arm positions — arms in same column overlap.
//
// v2.0 fixes:
//   1. total_h = 12.0mm (foot bottom to nub top) — matches corrected stack.
//   2. Arm heights are STAGGERED per column row to prevent collision:
//        Top row (dots 1,4): arm at 3.5mm from foot
//        Mid row (dots 2,5): arm at 6.5mm from foot
//        Bot row (dots 3,6): arm at 9.5mm from foot
//      Minimum inter-arm gap at worst case (adjacent arms, one +0.8mm travel):
//        3.0mm stagger - 1.0mm arm_h - 0.8mm travel = 1.2mm clearance ✓
//   3. arm_h reduced from 1.5mm to 1.0mm to accommodate stagger within total_h.
//
// --- VERIFIED STACK (z from outer box bottom) ---
//   z=27.0  cam flat surface  → foot bottom (nub flush with top plate = dot DOWN)
//   z=27.8  cam bump top      → foot bottom (nub 0.8mm above top plate = dot UP)
//   z=39.0  top plate top surface
//   total_h = 39.0 - 27.0 = 12.0mm ✓
// =========================================================

// --- 1. PARAMETERS ---

thickness     = 1.0;    // Sheet metal thickness (extrusion depth for DXF)
foot_w        = 2.0;    // Foot width — straddles cam track (1.6mm wide), 0.2mm overhang each side
foot_len      = 2.5;    // Foot contact patch length
foot_radius   = 0.8;    // Rounded foot tip (reduces cam surface wear)
nub_w         = 1.2;    // Nub width — matches top_plate slot_width (1.2mm) exactly
nub_len       = 2.0;    // Nub length (radial extent)
nub_h         = 1.5;    // Nub protrusion above arm/upper-riser top
arm_h         = 1.0;    // Horizontal arm thickness (was 1.5 — reduced for stagger fit)
total_h       = 12.0;   // Total height: foot bottom → nub top (matches corrected stack)

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

// Arm Y position from foot bottom — STAGGERED per row to prevent collision
// Dots 0,3 = top row (innermost tracks)  → lowest arm
// Dots 1,4 = mid row                     → middle arm
// Dots 2,5 = bottom row (outermost)      → highest arm
function arm_y(dot) = (dot == 0 || dot == 3) ? 3.5 :
                      (dot == 1 || dot == 4) ? 6.5 :
                                               9.5;

// Derived heights
function lower_riser_h(dot) = arm_y(dot) - foot_len;
//   dot 0,3: 3.5 - 2.5 = 1.0mm
//   dot 1,4: 6.5 - 2.5 = 4.0mm
//   dot 2,5: 9.5 - 2.5 = 7.0mm

function upper_riser_h(dot) = total_h - arm_y(dot) - arm_h - nub_h;
//   dot 0,3: 12.0 - 3.5 - 1.0 - 1.5 = 6.0mm
//   dot 1,4: 12.0 - 6.5 - 1.0 - 1.5 = 3.0mm
//   dot 2,5: 12.0 - 9.5 - 1.0 - 1.5 = 0.0mm  (nub sits directly on arm top)

$fn = 40;

// --- 2. MODULES ---

// 2D profile of one linkage in the radial plane.
// Local axes: X = radial (larger = outer/track side), Y = vertical (up).
// Extruded to 'thickness' in Z for laser-cut preview.
//
// Parameters:
//   tr  — cam track centre radius (where foot sits)
//   dx  — Braille dot X column position (absolute, ±2.4mm)
//   dot — dot index 0..5 (determines arm height stagger)

module linkage_2d(tr, dx, dot) {
    ay  = arm_y(dot);
    lr  = lower_riser_h(dot);
    ur  = upper_riser_h(dot);

    // Arm goes from track radius (outer end) to dot radius (inner end)
    // dot_r = radial distance from cam centre to dot position
    dot_r = sqrt(dx*dx + dot_y(dot)*dot_y(dot));

    union() {
        // A. Foot — rounded rectangle, centred at x=tr
        translate([tr - foot_w/2, 0])
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

        // B. Lower riser — from foot top up to arm bottom
        if(lr > 0.01)
            translate([tr - thickness/2, foot_len])
                square([thickness, lr]);

        // C. Horizontal arm — spans from dot_r (inner) to tr (outer)
        translate([dot_r, ay])
            square([tr - dot_r, arm_h]);

        // D. Upper riser — from arm top up to nub bottom (zero on outermost row)
        if(ur > 0.01)
            translate([dot_r - thickness/2, ay + arm_h])
                square([thickness, ur]);

        // E. Nub — rectangular tab, fits top_plate slot (1.2mm wide × 2.0mm long)
        //    Centred on dot_r in X, at the very top
        translate([dot_r - nub_w/2, total_h - nub_h])
            square([nub_w, nub_h]);
    }
}

module linkage_3d(tr, dx, dot) {
    linear_extrude(height=thickness)
        linkage_2d(tr, dx, dot);
}

// --- 3. GENERATE ALL 6 LINKAGES ---
// Laid flat side-by-side for DXF export. 3mm gap between each.
// For assembly preview: use the commented section below instead.

spacing = 30; // mm between linkage origins on DXF sheet

for(dot = [0:5]) {
    tr = track_r(dot);
    dx = dot_x(dot);
    translate([dot * spacing, 0, 0])
        linkage_3d(tr, dx, dot);
}

// --- ASSEMBLY PREVIEW (comment out flat layout above, uncomment here) ---
// for(dot = [0:5]) {
//     tr  = track_r(dot);
//     dx  = dot_x(dot);
//     dy  = dot_y(dot);
//     ang = atan2(dy, dx);  // angle from cam centre to dot position
//     color((dot < 3) ? "silver" : "lightgray")
//     rotate([0, 0, ang])
//         linkage_3d(tr, dx, dot);
// }

// --- 4. REFERENCE TABLE ---
// Dot | Track | Track r (mm) | Dot X  | Dot Y  | Arm Y | Lower R | Upper R
//  0  |   0   |   8.85       | -2.4   | +2.6   |  3.5  |  1.0    |  6.0
//  1  |   1   |  10.55       | -2.4   |  0.0   |  6.5  |  4.0    |  3.0
//  2  |   2   |  12.25       | -2.4   | -2.6   |  9.5  |  7.0    |  0.0
//  3  |   3   |  13.95       | +2.4   | +2.6   |  3.5  |  1.0    |  6.0
//  4  |   4   |  15.65       | +2.4   |  0.0   |  6.5  |  4.0    |  3.0
//  5  |   5   |  17.35       | +2.4   | -2.6   |  9.5  |  7.0    |  0.0
//
// Collision clearance check (adjacent arms in same column, worst case):
//   Stagger = 3.0mm, arm_h = 1.0mm, cam travel = 0.8mm
//   Minimum gap = 3.0 - 1.0 - 0.8 = 1.2mm  ✓
