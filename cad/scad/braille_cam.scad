// =========================================================
// ADVANCED PARAMETRIC BRAILLE CAM GENERATOR (Production Spec)
// Revision 3 — Track/Bit Reorder (v6.3, 2026-06-14)
// (Rev 2 — Hub Inverted, 2026-05-06)
//
// v6.3 FIX — INNER TRACK GEOMETRY WAS PHYSICALLY IMPOSSIBLE:
//   Each cam position is a 5.625deg slice. At the OLD bit order (bit t
//   drove track t, i.e. innermost track = LSB = toggles every single
//   state), the innermost track's single-slice flat "dwell" zone was
//   only ~0.88mm wide (0.7 * slice-arc-at-r12.8, with 0.7 = 1 -
//   angular_ramp_fraction). The linkage foot is 1.0mm thick (=
//   `thickness` in linkage.scad — the sheet extrudes to a 1mm-thick
//   tangential contact edge). A 1.0mm foot cannot rest inside a 0.88mm
//   dwell zone — it was ALWAYS straddling a ramp. Every dot on that
//   track would sit half-up, all the time.
//
//   FIX: reverse which bit drives which track. get_pattern_bit() below
//   now assigns the SLOWEST-changing bit (MSB, flips only twice per
//   revolution -> its flat zone is dozens of slices wide, radius
//   doesn't matter) to the INNERMOST track, and the FASTEST-changing
//   bit (LSB, toggles every single state -> needs the widest possible
//   single-slice dwell) to the OUTERMOST track, where the arc is
//   biggest. This is a pure logic change — no geometry/size/cost
//   change to the disc. Linkage.scad is UNAFFECTED (arm_span/asm_ang
//   depend only on physical track radius, never on which bit lights
//   a track — see the note in linkage.scad).
//
//   Worst-case (LSB) dwell after the fix, at the outermost track
//   (r=21.3mm, arc=2.09mm/slice): 0.7*2.09 = 1.46mm dwell vs 1.0mm
//   foot -> ~0.23mm clearance per side. Tight but workable on resin.
//   Also dropped angular_ramp_fraction 0.3->0.2 (free — pure curve
//   tuning, doesn't change disc size) for a bit more margin: dwell
//   becomes 0.8*2.09 = 1.67mm -> ~0.335mm clearance per side.
//
//   >>> SOFTWARE TEAM: this changes which bit sets which dot. See
//   >>> docs/SOFTWARE_TEAM_README.md Step 2 (cell_to_cam) — updated
//   >>> to match. <<<
//
// Older history (Rev 2, 2026-05-06):
//   - D-shaft hub now extends DOWNWARD from disc underside
//     (was protruding upward above tracks — blocked linkage feet)
//   - Hub height = 4mm below z=0 (drops over motor shaft from above)
//   - Top surface of disc is now completely flat/clear for linkage
//     contact across all 6 tracks
//   - Magnet pocket unchanged (still on underside, flush)
// =========================================================

// =========================================================
// v7.0 (2026-07-26) — PER-TRACK PHASE, for the spread feet
//
// The six linkage feet no longer sit on one radial line; they are 60deg
// apart (see mech_layout.scad for why). A foot 60deg round the disc is
// looking at a DIFFERENT part of the disc, so if every track were still
// carved with state 0 starting at 0deg, the six feet would each read a
// different state and the output would be garbage:
//
//   foot at    reads disc angle    which is state
//     0deg          0.00deg              0     correct
//    60deg         60.00deg             10     WRONG
//   120deg        120.00deg             21     WRONG   ...etc
//
// Fix: carve each track's pattern pre-rotated by ITS OWN foot angle,
// via track_phase(t) from mech_layout.scad. Then:
//
//   foot at    reads angle   minus its phase    state
//     0deg        0.00deg        0.00deg          0
//    60deg       60.00deg        0.00deg          0
//   120deg      120.00deg        0.00deg          0    ...all six agree
//
// Analogy: six people round a table, each with the same book. To get
// them all on page 24 at once you pre-turn each book so page 24 faces
// that person. Same disc, same diameter, same print cost — the bumps
// just sit at different places around it.
// =========================================================

include <mech_layout.scad>   // track geometry + track_phase(t) — SHARED, do not duplicate
include <motor_spec.scad>    // motor_shaft_usable - the bore has to swallow it

// --- 1. CONFIGURATION PARAMETERS ---
states = 64;                // Total positions (6-bit binary)
dots = 6;                   // Number of tracks
disk_base_thickness = 2.0;  // Base thickness (mm)
// pin_lift, track_width, track_gap and inner_radius now come from
// mech_layout.scad so the cam, linkages and top plate cannot drift apart.
// =========================================================
// R-07, 2026-09-01: THE RAMP IS NOW SIZED PER TRACK, NOT GUESSED.
//
// angular_ramp_fraction was 0.2, meaning each ramp got 20% of a state's arc and
// the other 80% sat flat. On the outer track that is 0.42mm of run for 0.8mm of
// rise - a 62 degree face. On the inner track, 72 degrees. The follower does not
// climb a face like that, it wedges into it, and the motor loses steps instead
// of lifting the dot. 30 degrees is the textbook limit for a translating
// follower.
//
// 0.2 was chosen to maximise dwell, which is a real concern - the dot must sit
// still when the motor stops. But the flat actually needed is small, and it is
// NOT foot_w. foot_w (1.4mm) is the width ACROSS the track. The follower is a
// roll of radius foot_roll_r lying across the track, so in the DIRECTION OF
// TRAVEL it is a point contact. A roller of radius rho leaves a flat only
// rho*tan(alpha/2) wide as it rolls onto a ramp of angle alpha. At the 30 degree
// limit that is 0.13mm, plus positioning tolerance for step error and backlash.
//
// So each track now gets the widest ramp its own arc allows. The inner tracks
// have less arc per state and therefore steeper ramps; sizing them all from one
// global fraction meant the outer tracks wasted room the inner ones needed.
//
// WHAT THIS DOES NOT DO, and what Mridul asked about: it does not let a ramp
// borrow angle from its neighbour. Gray order means exactly one bit changes per
// step, so ALL 64 state boundaries carry a ramp - every neighbour is busy. Long
// flat plateaus exist (Gray cut total ramps on the disc from 126 to 64) but they
// sit on the far side of a stop, and a stop must be flat. One state's arc is the
// hard ceiling for one ramp, whatever the ordering.
// =========================================================
use_auto_ramp = true;

dwell_tol = 0.15;   // arc left flat each side of a stop for step error/backlash

// Flat consumed at each end of a ramp, evaluated at the 30 degree design limit.
foot_flat_arc = 2 * (foot_roll_r * tan(15) + dwell_tol);

function slice_arc(t) = 2 * PI * track_r(t) / states;
function ramp_fraction_of(t) =
    use_auto_ramp
        ? max(0.05, min(0.98, (slice_arc(t) - foot_flat_arc) / slice_arc(t)))
        : angular_ramp_fraction;
function ramp_angle_of(t) = slice_angle * ramp_fraction_of(t);

// Kept only as the manual fallback when use_auto_ramp is false.
angular_ramp_fraction = 0.2;// v6.3: 0.3->0.2 — more flat dwell per slice, free (no size/cost change)
subdivisions_per_slice = 4; // Smoothness (Higher = smoother, slower)
preview_mode = false;       // Set FALSE for final high-quality render!

// Homing magnet pocket (on disc underside, triggers Hall sensor on base plate)
// v7.5: all four numbers now come from mech_layout.scad — see the long note there.
// The old local copies had magnet_depth = 2.0 into a 2.0mm floor, i.e. a THROUGH
// HOLE that cratered tracks 2, 3 and 4. Blind pocket now: 1.2 deep, 0.8mm floor left.
magnet_dia    = homing_mag_dia;
magnet_depth  = homing_mag_thk + homing_mag_fit;   // 1.2
magnet_radius = homing_mag_r;
magnet_angle  = homing_mag_angle;

// Guard: the pocket must never eat the whole disc floor again.
assert(magnet_depth < disk_base_thickness - 0.5,
       "Homing magnet pocket leaves <0.5mm of disc floor — it will crater the cam tracks.");

// Hub extends below disc; Double-D bore continues into disc floor.
//
// >>> OWNED MOTOR MEASUREMENTS RECEIVED — vertical stack redesign still pending <<<
// The old comment here claimed "hub 4 + bore 4 into disc floor = 8mm engagement".
// That was stale: the disc floor is 2mm, not 4mm, so real engagement is
// hub_h(4) + disk_base_thickness(2) = 6mm, and the bore is a THROUGH hole with
// no axial stop — nothing decides how far the cam pushes onto the shaft.
//
// Worse, the z-stack does not close. In outer-box world coordinates:
//     motor bracket face / base-plate underside   z = 41   (base_plate_z, ASSUMED)
//     cam pocket floor (base_thickness-cam_pocket_depth = 5-3 = 2 above that)  z = 43
//     so the space beneath the disc for the hub is only  43 - 41 = 2mm
//     but hub_h = 4  ->  the hub bottoms out on the motor and the disc sits 2mm
//     proud, which puts ALL SIX DOTS permanently 2mm above the reading surface.
// The owned motor readings are now M2=19.0, M5=3.0, M6=9.5 and M7b=2.0mm.
// The 41mm assembly datum is still a CAD assumption and must be re-derived with
// the whole motor/base/cam/linkage stack rather than patched here in isolation.
//
// DO NOT guess a new hub_h. Once the motor is measured, set:
//     hub_h = (cam pocket floor z) - (measured shaft-boss top z)  - 0.3 clearance
// and re-derive cam_flat_z in mech_layout.scad in the SAME pass, because
// link_total_h is computed from it.
// 2026-09-01: 4 -> 6.5. THIS IS THE 2.5mm STACK RAISE.
// The hub is the only thing between the motor's shaft boss and the disc, so its
// length sets how much shaft the bore can swallow. At 4mm the bore reached 5.5mm
// against a 7.5mm shaft and the tip came out through the cam face. At 6.5mm the
// bore reaches 8.0mm: the tip sits 0.5mm short of the bore top and 0.5mm of solid
// disc covers it.
//
//   hub bottom ........ -6.5   on the motor's shaft boss
//   shaft tip ......... +1.0   7.5mm of shaft from the hub bottom
//   bore top .......... +1.5
//   cam face .......... +2.0   <- nothing above this
//
// Everything above the disc moves up 2.5mm with it: cam_flat_z, the base plate,
// the standoffs, the top plate, the shell, and the pod that has to stay level
// with it. Nothing above the disc changes SIZE - the tower just translates.
hub_h = 6.5;
shaft_bore_depth = 8;  // total Double-D bore depth from hub bottom through disc floor

// Option A shaft socket. The hub bottom sits on the measured Ø9 x 2mm collar;
// the owned shaft then projects 7.5mm into the cam. A 7.7mm socket gives 0.2mm
// axial tolerance, and a 0.5mm roof closes it instead of leaving a through-hole.
// The resulting central cap is 4.2mm above the disc underside, only 2.2mm above
// the flat cam surface. Linkage arms start 3.5mm above that surface, leaving
// 1.3mm nominal clearance over the cap.
option_a_socket_depth = 7.7;
option_a_socket_roof  = 0.5;
option_a_cap_h        = option_a_socket_depth - hub_h + option_a_socket_roof; // 4.2
option_a_cap_r        = 3.6;  // 1mm radial wall around the Ø5.2 socket

assert(!stack_option_a || option_a_socket_depth >= 7.5 + 0.2,
       "Option A socket lacks the required shaft-tip clearance");

module option_a_central_cap() {
    if (stack_option_a)
        cylinder(h=option_a_cap_h, r=option_a_cap_r, $fn=50);
}

module option_a_socket_cut() {
    // Extruding a 2D intersection avoids the legacy center=true Z-overlap bug.
    translate([0, 0, -hub_h - 0.01])
        linear_extrude(height=option_a_socket_depth + 0.01)
            intersection() {
                circle(r=2.6, $fn=50);
                square([10, 3.2], center=true);
            }
}

// THE BORE BUG, FIXED (2026-08-25). The old cut was
//     translate([0,0,-hub_h-1])
//     intersection() {
//         cylinder(h = shaft_bore_depth + 1, r = 2.6);
//         cube([10, 3.2, shaft_bore_depth + 1], center = true);
//     }
// cube(center=true) centres on the TRANSLATED origin, so it spanned z=-4.5..+4.5
// while the cylinder spanned 0..9. Their intersection ended at z=-0.5: a BLIND
// hole 3.5mm deep from the hub bottom that never reached the disc floor, against
// the 8mm shaft_bore_depth claims.
//
// The shaft is 9.5mm from the mounting face (M6) and the collar takes the first
// 2.0mm, leaving 7.5mm to swallow. A 3.5mm hole leaves the cam standing 4mm
// proud — exactly what the printed resin part does.
//
// Extruding the 2D profile has no centring to get wrong.
//
// v8.8: the bore is BLIND and stops cam_bore_roof below the CAM FACE itself.
// The hub is 2.5mm longer to make that fit, with the shaft at full length.
// Nothing stands proud of the face - no boss, no shaft tip.
module legacy_shaft_bore() {
    translate([0, 0, -hub_h - 0.01])
        linear_extrude(height = legacy_bore_depth + 0.01)
            intersection() {
                circle(r = 2.6, $fn = 50);
                square([10, 3.2], center = true);
            }
}

// --- BLIND BORE (v8.7) - THE SHAFT ENDS BELOW THE CAM FACE ---
//
// v8.6 got this wrong. It made the bore blind by adding a 2.6mm boss ON TOP of
// the disc and running the bore up into it, so the shaft tip finished 1.5mm
// ABOVE the cam's working face - hidden, but still above it, with a tower in the
// middle of the face for the linkages to clear. That is not what was asked for
// and it is not what the mechanism wants.
//
// The hub is lengthened 4 -> 6.5mm instead (v8.8), raising the whole stack 2.5mm,
// and the bore is a plain blind socket that stops inside the disc:
//
//     hub bottom .............. -6.5    sits on the motor's shaft boss
//     disc underside ........... 0.0
//     shaft tip ................ 1.0    7.5mm of uncut shaft from the hub bottom
//     bore top ................. 1.5
//     cam face ................. 2.0    <- 0.5mm of solid resin over the shaft
//
// Nothing stands proud of the cam face. The 0.5mm roof carries no load: the
// tracks start at inner_radius and the centre is bare.
cam_bore_roof = 0.5;    // solid disc material left over the shaft tip
shaft_air_gap = 0.5;    // slack above the tip so the hub seats on the boss,
                        // not on the shaft end, whatever the length tolerance

legacy_bore_depth = hub_h + disk_base_thickness - cam_bore_roof;

assert(legacy_bore_depth >= motor_shaft_usable + shaft_air_gap,
       str("bore is ", legacy_bore_depth, "mm for a ", motor_shaft_usable,
           "mm shaft - under ", shaft_air_gap, "mm of slack, the cam can hang on ",
           "the shaft tip instead of seating on the boss"));
assert(legacy_bore_depth >= motor_shaft_usable,
       str("blind bore is ", legacy_bore_depth, "mm but the cut shaft presents ",
           motor_shaft_usable, "mm - it would bottom out and lift the cam"));
assert(cam_bore_roof >= 0.4, "roof over the shaft is thinner than one layer");

// Calculated Variables
slice_angle = 360 / states;
ramp_angle = slice_angle * angular_ramp_fraction;

// --- 2. LOGIC FUNCTIONS ---

// Binary Mapping (Index -> Binary Pattern) — v6.3 REORDERED
// Returns 1 if the dot is UP, 0 if DOWN
// track_idx 0 = innermost (smallest arc/slice -> gets the SLOWEST bit, MSB)
// track_idx dots-1 = outermost (biggest arc/slice -> gets the FASTEST bit, LSB)
// i.e. bit_for_track = (dots-1-track_idx). See the v6.3 header note above for why.
// v8.2 GRAY ORDER. Slice i now carries the pattern gray(i) = i XOR (i >> 1),
// instead of the pattern i. Consecutive slices then differ in exactly ONE bit,
// so exactly one dot moves per step instead of up to six.
//
// What that buys: crossing several slices to reach a letter no longer flickers
// every dot on the way (measured 359 -> 171 dot movements typing "hello world"),
// and peak torque drops ~6x because the motor lifts one dot at a time rather
// than six together. That matters a lot with one motor.
//
// What it does NOT buy, despite my earlier claim: ramp room. A state's angle is
// the CENTRE of its slice and the foot must be flat there, so a ramp always has
// one slice minus the foot to complete in, however long the track then holds its
// value. Ramp room comes from radius, foot width, lift and ramp fraction.
//
// FIRMWARE MUST MATCH. To show pattern P, rotate to slice gray_to_binary(P),
// not to slice P. See firmware/braille_cell/braille_cell.ino.
use_gray_order = true;

function bit_of(v, b) = floor(v / pow(2, b)) % 2;
function gray_bit(i, b) = (bit_of(i, b) + bit_of(i, b + 1)) % 2;

function get_pattern_bit(state_idx, track_idx) =
    let(b = dots - 1 - track_idx)
    use_gray_order ? gray_bit(state_idx, b) : bit_of(state_idx, b);

// Linear Interpolation (Lerp)
function lerp(start, end, bias) = (1 - bias) * start + bias * end;

// S-Curve Smoothing (Optional, for smoother ramps)
function s_curve(t) = (1 - cos(t * 180)) / 2;

// Height Calculation Logic (The Core Algorithm)
function get_height_at_angle(angle, track) =
    let(
        // v7.0: rotate this track's whole pattern to its own foot angle, so
        // that a foot sitting at track_phase(track) reads the same state as
        // every other foot. This is the ONE line that makes spread feet work.
        a_eff = (angle - track_phase(track) + 720) % 360,

        // Identify which "Slice" (Letter) we are in
        k = floor(a_eff / slice_angle),
        angle_in_slice = a_eff - (k * slice_angle),
        
        // Identify Neighbors for blending
        prev_k = (k - 1 + states) % states,
        next_k = (k + 1) % states,
        
        // Get Binary States (0 or 1)
        val_curr = get_pattern_bit(k, track),
        val_prev = get_pattern_bit(prev_k, track),
        val_next = get_pattern_bit(next_k, track),
        
        // Ramp Logic
        this_ramp = ramp_angle_of(track),
        half_ramp = this_ramp / 2,
        is_left_ramp = (angle_in_slice < half_ramp),
        is_right_ramp = (angle_in_slice > (slice_angle - half_ramp)),
        
        // Calculate Height Factor (0.0 to 1.0)
        h_factor = 
            is_left_ramp ? 
                lerp(val_prev, val_curr, s_curve((angle_in_slice + half_ramp) / this_ramp)) :
            is_right_ramp ? 
                lerp(val_curr, val_next, s_curve((angle_in_slice - (slice_angle - half_ramp)) / this_ramp)) :
            val_curr // Stable Center Zone
    )
    disk_base_thickness + (h_factor * pin_lift);

// --- 3. GEOMETRY MODULES ---

// Optimized Polyhedron Builder (Much faster than linear_extrude loop)
module build_track_polyhedron(t_idx) {
    r_in = inner_radius + t_idx * (track_width + track_gap);
    r_out = r_in + track_width;
    
    // Resolution logic
    res = preview_mode ? 1 : subdivisions_per_slice;
    step = slice_angle / res;
    total_steps = states * res;
    
    // Generate Points
    points = [
        for(i = [0 : total_steps - 1]) 
        let(
            a = i * step,
            h = get_height_at_angle(a, t_idx)
        )
        each [
            [r_in * cos(a), r_in * sin(a), h],  // Inner Top
            [r_out * cos(a), r_out * sin(a), h], // Outer Top
            [r_in * cos(a), r_in * sin(a), 0],   // Inner Bottom
            [r_out * cos(a), r_out * sin(a), 0]  // Outer Bottom
        ]
    ];
    
    // Connect the dots (Faces)
    faces = [
        for(i = [0 : total_steps - 1]) 
        let(
            n = total_steps * 4,
            i0 = (i * 4),      i1 = (i * 4) + 1,
            i2 = (i * 4) + 2,  i3 = (i * 4) + 3,
            next_i0 = (i0 + 4) % n, next_i1 = (i1 + 4) % n,
            next_i2 = (i2 + 4) % n, next_i3 = (i3 + 4) % n
        )
        // TRIANGLES, not quads. The top face spans two radial edges at
        // DIFFERENT heights wherever the track is on a ramp, so as a quad it is
        // non-planar - invalid polyhedron input. OpenSCAD 2021 silently picked a
        // diagonal; 2026 CGAL throws "assertion violation" on every one of them.
        // Splitting it explicitly makes the mesh valid and the choice ours.
        each [
            [i0, i1, next_i1], [i0, next_i1, next_i0],   // Top
            [i2, next_i2, next_i3], [i2, next_i3, i3],   // Bottom
            [i0, next_i0, next_i2], [i0, next_i2, i2],   // Inner wall
            [i1, i3, next_i3], [i1, next_i3, next_i1]    // Outer wall
        ]
    ];

    polyhedron(points=points, faces=faces, convexity=10);
}

// --- 4. MAIN ASSEMBLY ---

difference() {
union() {
    // 0. THE SOLID FLOOR (Fuses all tracks together!)
    outermost_r = inner_radius + (dots * (track_width + track_gap));
    color("darkgray") 
        cylinder(h=disk_base_thickness, r=outermost_r, $fn=100);

    // 1. Central Hub — INVERTED (drops BELOW disc, clears top surface for linkage feet)
    //    Hub extends hub_h=4mm below disc bottom (z=0 → z=−4)
    //    28BYJ-48 Double-D Shaft: 5mm dia with two opposite flats
    //    Shaft length: 10mm above motor body
    //    Bore: Ø5.2 clearance cylinder intersected with 3.2mm-wide slab
    //          on BOTH sides (double-D, not single-D)
    color("gray")
    translate([0, 0, -hub_h])
        // NO BORE HERE. v8.7: this used to subtract its own inline Double-D,
        // built with cube(center=true) - the exact construction that shipped a
        // 3.5mm bore for a week. It was redundant anyway: legacy_shaft_bore()
        // in the outer difference cuts the same hole, correctly, once. The file
        // now has exactly ONE definition of the shaft bore. Do not inline it.
        cylinder(h=hub_h, r=4.5, $fn=50);

    // Option A only: material above the measured shaft tip creates a real roof.
    option_a_central_cap();
    // v8.7: no central cap on the default path. The roof is the disc itself.

    // 2. Generate Tracks
    for(t = [0 : dots-1]) {
        color( (t%2==0) ? [0.2, 0.6, 1] : [0.3, 0.7, 1] )
        build_track_polyhedron(t);
    }
    
    // 3. Debug: Visual Markers for Pin Alignment (Preview Only)
    if(preview_mode) {
        color("red")
        for(t = [0 : dots-1]) {
            translate([inner_radius + t*(track_width+track_gap) + track_width/2, 0, 5])
            cube([0.5, 0.5, 5], center=true);
        }
    }
} // end union

// v8.6: this used to carry its own copy of the bore, and an earlier repair only
// reached the copy inside module braille_cam() below - so the file rendered the
// fixed bore from the module and the BROKEN 3.5mm one from here, which is what the
// exported STL had. Both paths now call the same module. Do not inline it again.
if (stack_option_a) {
    option_a_socket_cut();
} else {
    legacy_shaft_bore();
}

// Homing magnet pocket (subtracted from disc underside)
translate([magnet_radius * cos(magnet_angle),
           magnet_radius * sin(magnet_angle),
           -1])
    cylinder(d=magnet_dia + 0.2, h=magnet_depth + 1, $fn=30);

} // end difference

// --- MODULE WRAPPER (used by print_small_parts.scad) ---
// Print orientation: hub DOWN on build plate, cam tracks face UP — no supports needed.
// Entire assembly shifted up by hub_h=4mm so hub bottom sits at z=0.
module braille_cam() {
    translate([0, 0, hub_h])
    difference() {
        union() {
            // Disc floor
            cylinder(h=disk_base_thickness,
                     r=inner_radius + (dots*(track_width+track_gap)), $fn=100);
            // Hub — hangs below disc, now resting on build plate
            translate([0, 0, -hub_h])
        // NO BORE HERE. v8.7: this used to subtract its own inline Double-D,
        // built with cube(center=true) - the exact construction that shipped a
        // 3.5mm bore for a week. It was redundant anyway: legacy_shaft_bore()
        // in the outer difference cuts the same hole, correctly, once. The file
        // now has exactly ONE definition of the shaft bore. Do not inline it.
                cylinder(h=hub_h, r=4.5, $fn=50);
            option_a_central_cap();
            // v8.7: no central cap on the default path. The roof is the disc.
            // All 6 cam tracks
            for(t=[0:dots-1]) build_track_polyhedron(t);
        }
        if (stack_option_a) {
            option_a_socket_cut();
        } else {
            legacy_shaft_bore();
        }
        // Homing magnet pocket
        translate([magnet_radius*cos(magnet_angle),
                   magnet_radius*sin(magnet_angle), -1])
            cylinder(d=magnet_dia+0.2, h=magnet_depth+1, $fn=30);
    }
}
