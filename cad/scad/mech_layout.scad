// =========================================================

include <stack_options.scad>
// BRAILLIX MECHANISM LAYOUT — SHARED SINGLE SOURCE OF TRUTH
// Created 2026-07-26 (v7.0 "spread feet")
//
// INCLUDED BY: braille_cam.scad, linkage.scad, top_plate.scad
// Everything that has to agree between the cam disc, the linkages and
// the top plate lives HERE and nowhere else. Do not re-declare these
// numbers in the individual part files — that is exactly how the v6.x
// stale-comment/stale-STL bugs happened.
//
// ---------------------------------------------------------
// WHY THE FEET ARE SPREAD AROUND THE DISC (v7.0)
// ---------------------------------------------------------
// Until v6.3 all six linkage feet sat on ONE radial line. Because all
// six arms then had to run from the tiny braille cluster out to that
// same line, they overlapped each other in plan view (14 clashing
// pairs), so each arm needed its own height. Six stacked arm levels
// need ~11.5mm; only 6.5mm exists between the cam surface and the top
// plate. The mechanism was unbuildable.
//
// v7.0 spreads the six feet 60 degrees apart AND assigns each braille
// dot the foot that points the way that dot already sits (dot 4, upper
// right, gets the 60deg foot; dot 3, lower left, gets the 240deg foot;
// and so on). The arms then fan outwards and never cross:
//     closest pair of arms = 2.60mm apart  (need 1.0mm)
// so ALL SIX ARMS SIT AT ONE COMMON HEIGHT. That single change also
// frees ~8mm of space between neighbouring arms out at r=8mm, which is
// where the return springs now live (at the dot cluster there is only
// 0.4mm of room — a spring there is geometrically impossible).
//
// A happy side effect: pointing each dot at its nearest foot SHORTENED
// every arm (10.4-17.9mm, was 15.4-19.1mm) = stiffer, less fragile.
// ---------------------------------------------------------

// --- CAM TRACK GEOMETRY ---
inner_radius = 12.0;   // inner edge of track 0
track_width  = 1.6;    // radial width of one track
track_gap    = 0.1;    // gap between adjacent tracks

// Centre radius of track t (t = 0 innermost .. 5 outermost)
function track_r(t) = inner_radius + t * (track_width + track_gap) + track_width / 2;
//  t0=12.80  t1=14.50  t2=16.20  t3=17.90  t4=19.60  t5=21.30

// --- BRAILLE CELL GEOMETRY ---
// Standard dot numbering:   1 4
//                           2 5
//                           3 6
col_spacing = 4.8;     // left column x=-2.4, right column x=+2.4
row_spacing = 2.6;     // rows at y=+2.6, 0, -2.6

function dot_pos(d) = [ (d <= 3) ? -col_spacing/2 : col_spacing/2,
                        (d == 1 || d == 4) ?  row_spacing :
                        (d == 2 || d == 5) ?  0 : -row_spacing ];

// --- THE ASSIGNMENT (dot -> track, dot -> foot angle) ---
// Chosen so each dot's arm points outward the way the dot already sits,
// which is what makes the arms non-overlapping. Index = dot number - 1.
dot_track = [ 2,   3,   4,   1,   0,   5  ];   // which cam track drives this dot
dot_phase = [120, 180, 240,  60,   0, 300 ];   // where that dot's foot sits, degrees

function dot_track_of(d) = dot_track[d - 1];
function dot_phase_of(d) = dot_phase[d - 1];

// Foot landing point for dot d, in cam coordinates
function foot_pos(d) =
    let(r = track_r(dot_track_of(d)), a = dot_phase_of(d))
    [ r * cos(a), r * sin(a) ];

// Nub-to-foot geometry (used by linkage.scad AND top_plate.scad)
function arm_vec(d)  = foot_pos(d) - dot_pos(d);
function arm_span(d) = norm(arm_vec(d));
function arm_dir(d)  = arm_vec(d) / arm_span(d);
function asm_ang(d)  = atan2(arm_vec(d)[1], arm_vec(d)[0]);

// --- PER-TRACK CAM PHASE ---
// track_phase[t] = the angle at which track t's foot sits, so the cam
// generator can rotate that track's bump pattern to match. Derived from
// the assignment above so the two can never disagree.
function track_phase(t) =
    t == dot_track[0] ? dot_phase[0] :
    t == dot_track[1] ? dot_phase[1] :
    t == dot_track[2] ? dot_phase[2] :
    t == dot_track[3] ? dot_phase[3] :
    t == dot_track[4] ? dot_phase[4] :
                        dot_phase[5];
//  track 0->0deg  1->60  2->120  3->180  4->240  5->300

// --- HOMING MAGNET + HALL SENSOR (v7.5) ---
// SHARED by braille_cam.scad (cuts the pocket) and base_plate.scad (places the
// sensor under it). These used to be declared twice, in two files, and drifted:
// the cam had the magnet at r=17.35 while the base plate had the sensor at y=20.
//
// WHY THE MAGNET IS 1mm THICK, NOT 2mm:
// the disc floor is only disk_base_thickness = 2.0mm. A 2mm-deep pocket removed
// the ENTIRE floor — a through-hole, not a pocket. At r=17.35 +/-1.6 it spanned
// r = 15.75..18.95, cratering tracks 2, 3 AND 4. A linkage foot crossing that
// hole once per revolution drops in and jams the mechanism.
// A 1mm magnet in a 1.2mm pocket leaves 0.8mm of floor under the track. The
// magnet still sits flush with the disc underside, so coupling is unchanged.
//
// WHY IT CANNOT SIMPLY MOVE INBOARD (the other obvious fix):
// the sensor has to sit under the magnet, in the base plate. The motor can
// (dia 29 at x=-8) occupies y = +/-12.1 at x=0, so the sensor must be at
// r > ~14 to clear it. Tracks start at r=12 and the disc ends at r=22.1 with
// only 0.1mm gaps between tracks. There is nowhere outside a track to put it.
// Keeping the floor intact is the only fix. Do not "tidy" this back to 2mm.
homing_mag_dia   = 3.0;    // MEASURE the magnet you buy
homing_mag_thk   = 1.0;    // BUY 3x1mm — NOT the 3x2mm in the old BOM
homing_mag_fit   = 0.2;    // glue/print clearance, added to dia and thickness
homing_mag_r     = 17.35;  // radius of the magnet centre on the disc
homing_mag_angle = 90;     // +Y axis

// --- SHARED VERTICAL STACK (world z, mm from outer-box floor) ---
cam_flat_z    = 45.0 + stack_repair_raise;  // cam surface, dot DOWN
pin_lift      = 0.8;   // cam bump height = how far a dot rises
plate_under_z = 54.0 + stack_repair_raise;  // top plate underside
plate_top_z   = 58.0 + stack_repair_raise;  // top plate OUTER top surface

// The plate has a shallow finger-pad recess over its middle, so the surface the
// dots actually emerge through is 0.8mm BELOW the rim. v7.2 bug fix: link_total_h
// used to be measured to plate_top_z, which put every dot 0.8mm proud even when
// DOWN (and 1.6mm when up) — i.e. all six dots permanently readable, which is
// not braille. Measure to the recessed READING SURFACE instead.
finger_pad_depth = 0.8;
reading_surface_z = plate_top_z - finger_pad_depth;   // 57.2

// Linkage foot bottom sits on cam_flat_z; dome top must reach the reading surface
link_total_h  = reading_surface_z - cam_flat_z;   // 12.2mm
//   dot DOWN: dome top 57.2 = flush with the reading surface
//   dot UP  : dome top 58.0 = 0.8mm proud

// --- RETURN SPRING: COAXIAL WITH EACH DOT (v7.1) ---
// The spring sits in a counterbore in the top plate's underside, wrapped
// around the dot, and pushes DOWN on a flange on the linkage's upper riser.
// The dot travels up and down THROUGH the middle of the spring.
//
// v7.0 put this pad mid-arm instead. Rejected: physically the return force
// belongs on the dot axis, where the dot actually is.
//
// SIZE IS FORCED BY THE BRAILLE PITCH. Rows are 2.6mm apart, so a spring
// around one dot must be under ~2.4mm OD or it fouls the spring above and
// below it. A 4mm ballpoint-pen spring cannot fit at ANY nub size:
//    nub 2.2 -> ID 2.6, OD 3.1  COLLIDES (-0.5mm)
//    nub 1.8 -> ID 2.2, OD 2.7  COLLIDES (-0.1mm)
//    nub 1.0 -> ID 1.4, OD 2.0  FITS, 0.6mm gap
// Hence a 2mm OD micro spring (stock size, 0.3mm stainless wire) and a
// slimmed-down nub. Happy side effect: the dot drops to 1.5mm, which is
// the REAL braille standard (1.44-1.6mm) instead of the oversized 2.2mm.
spring_od     = 2.0;   // 2mm OD micro compression spring (stock size)
spring_wire   = 0.3;   // stainless wire diameter
spring_id     = spring_od - 2 * spring_wire;   // 1.4mm bore
spring_free_l = 4.0;   // free length to order (~5 coils; 1.5mm solid)

// --- DOT / NUB / FLANGE (shared by linkage.scad and top_plate.scad) ---
// Linkage sheet thickness. Lives here because the ASSEMBLY transform needs it:
// linkage_3d_v4() is extruded from local z=0 to z=link_thickness, so the dot dome
// sits on the plane z = link_thickness/2. Anything placing a linkage in its real
// position must shift by -link_thickness/2 first or every dot lands half a
// thickness off its hole. (That is exactly what happened in the first version of
// export_linkage_assembly.scad — all six dots were 0.500mm out.)
link_thickness = 1.0;

// Foot height, cam surface up to the underside of the arm. Lives here rather than
// in linkage.scad because linkage_comb.scad needs it too: the comb has to start
// ABOVE the foot. When it was private to linkage.scad the comb read it as undef
// and silently rendered 1mm tall instead of 6mm.
foot_len = 2.5;

// Height of the arm's underside above the cam. Shared for the same reason as
// foot_len: linkage_comb.scad has to stop BELOW the arm, and reading this as
// undef is how the first comb silently rendered 1mm tall.
arm_y = 3.5;

// Radial length of the foot. Shared because linkage_comb.scad sizes its pocket
// from it. NOTE this is the FOOT's dimension: if the foot is ever narrowed
// independently of the arm, the comb must follow the foot, not the arm.
foot_w = 1.4;

dot_dome_dia  = 1.5;   // the braille dot itself = braille standard size
nub_width     = 1.0;   // slides inside spring_id (1.4) with 0.2mm/side
plate_hole_dia = 1.7;  // passes the 1.5mm dome with 0.1mm/side
flange_dia    = 2.2;   // MUST be > spring_id (or the spring slips past) and
                       // < row_spacing 2.6 (or it hits the neighbour flange)
flange_h      = 0.8;   // flange thickness

// Vertical placement, in linkage-local Y (0 = foot bottom = cam surface)
plate_under_y = plate_under_z - cam_flat_z;      // 9.0
flange_top_y  = 8.0;   // 0.8mm lift still leaves 0.2mm clear of the plate
flange_bot_y  = flange_top_y - flange_h;         // 7.2
spring_recess_depth = 2.0;                       // counterbore into the dot insert
// spring works between flange_top_y and the recess ceiling:
//   dot DOWN 8.0 -> 11.0 = 3.0mm ;  dot UP 8.8 -> 11.0 = 2.2mm
// so a ~3.5mm free length compresses comfortably and never goes solid (1.5mm).

// --- DOT INSERT (v7.2) — the only part that still has to be resin ---
// The top plate is 68x70mm and was ~80% of the resin bill (19.85 of 23.8 cm3),
// yet the only features that genuinely need resin are the six 1.7mm dot holes
// (the dome has to slide freely) and the 2.2mm spring bores whose 0.4mm dividing
// walls are one nozzle width on FDM. So those move into a small resin tile and
// the big plate becomes an ordinary PETG print. Resin drops ~20 -> ~5 cm3.
//
// The tile is a top-hat: a body that drops through the plate, and a flange that
// lands on a rebate. The rebate FLOOR is the glue shelf (~106mm2 of contact).
insert_body   = 11.0;  // square body, passes through the plate
insert_flange = 15.0;  // square flange, sits on the glue shelf
insert_flange_h = 1.2; // flange thickness
insert_fit    = 0.2;   // total clearance (0.1mm/side) for glue
insert_h      = 3.2;   // = reading surface height above the plate underside
// body 0 -> 2.0, flange 2.0 -> 3.2; top is flush with the reading surface.

// ASSEMBLY NOTE: the 1.5mm dome is 0.1mm wider than the 1.4mm spring bore,
// so the spring is THREADED over the dome by twisting it on (Mridul's own
// "turn and turn" idea) — trivial interference for a steel coil, and it lets
// the dot stay full braille size instead of being shrunk to clear the bore.
