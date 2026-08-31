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

// --- 1. CONFIGURATION PARAMETERS ---
states = 64;                // Total positions (6-bit binary)
dots = 6;                   // Number of tracks
disk_base_thickness = 2.0;  // Base thickness (mm)
// pin_lift, track_width, track_gap and inner_radius now come from
// mech_layout.scad so the cam, linkages and top plate cannot drift apart.
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
hub_h = 4;             // <-- MEASURE (M6/M7). Provisional.
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
// v8.6: the bore is now BLIND. It stops cam_cap_roof below the top of the central
// cap, so the shaft is fully swallowed and nothing projects through the face the
// linkages run on.
module legacy_shaft_bore() {
    translate([0, 0, -hub_h - 0.01])
        linear_extrude(height = legacy_bore_depth + 0.01)
            intersection() {
                circle(r = 2.6, $fn = 50);
                square([10, 3.2], center = true);
            }
}

// --- BLIND BORE (v8.6) - the shaft must NOT break through the cam face ---
//
// The through-bore left the shaft standing 1.5mm proud of the cam surface. It
// cleared the arms by 2mm so it was not a clash, but a shaft sticking up through
// the working face is something for a linkage to catch on during assembly, and it
// gave only 6mm of Double-D engagement to carry the motor's torque through resin.
//
// The fix is a small boss on the disc's CENTRE, below the arms, that the bore
// reaches up into. No stack change, no box change.
//
//   shaft above its boss ......... 7.5mm   (9.5 from the face, first 2 is the boss)
//   hub 4 + disc floor 2 ......... 6.0mm   not enough on its own
//   + cap 2.6 less a 0.5 roof .... 8.1mm   enough, with 0.6mm to spare
//
// Cap height is bounded on both sides. It must be tall enough to swallow the
// shaft, and short enough to stay under the linkage arms, which start at
// arm_y = 3.5mm above the cam face:
//     2.2mm <= cam_cap_h <= 3.0mm      2.6 sits in the middle
cam_cap_h    = 2.6;    // above the cam face
cam_cap_r    = 3.6;    // 1.0mm of wall around the Ø5.2 bore
cam_cap_roof = 0.5;    // solid material left over the shaft tip

legacy_bore_depth = hub_h + disk_base_thickness + cam_cap_h - cam_cap_roof;

assert(legacy_bore_depth >= 7.5 + 0.2,
       str("blind bore is only ", legacy_bore_depth,
           "mm; the shaft presents 7.5mm above its boss"));
assert(cam_cap_h <= 3.5 - 0.5,
       str("cam cap is ", cam_cap_h, "mm tall and would foul the arms at 3.5mm"));
assert(cam_cap_r > 2.6 + 0.8,
       "cam cap wall is thinner than 0.8mm around the bore");

// Sits on the disc's top face, at the centre. The arms converge no closer than
// r=2.4 and start 3.5mm up, so this is under them, not through them.
module cam_central_cap() {
    if (!stack_option_a)
        translate([0, 0, disk_base_thickness - 0.01])
            cylinder(h = cam_cap_h + 0.01, r = cam_cap_r, $fn = 50);
}

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
        half_ramp = ramp_angle / 2,
        is_left_ramp = (angle_in_slice < half_ramp),
        is_right_ramp = (angle_in_slice > (slice_angle - half_ramp)),
        
        // Calculate Height Factor (0.0 to 1.0)
        h_factor = 
            is_left_ramp ? 
                lerp(val_prev, val_curr, s_curve((angle_in_slice + half_ramp) / ramp_angle)) :
            is_right_ramp ? 
                lerp(val_curr, val_next, s_curve((angle_in_slice - (slice_angle - half_ramp)) / ramp_angle)) :
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
        each [
            [i0, i1, next_i1, next_i0], // Top Surface
            [i2, next_i2, next_i3, i3], // Bottom Surface
            [i0, next_i0, next_i2, i2], // Inner Wall
            [i1, i3, next_i3, next_i1]  // Outer Wall
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
    difference() {
        // Hub body cylinder (below disc underside)
        cylinder(h=hub_h, r=4.5, $fn=50);

        // Double-D shaft hole — through entire hub height
        // M5 measured 3.0mm across flats; 3.2mm gives 0.2mm total resin clearance.
        translate([0, 0, -1])
        intersection() {
            cylinder(h=hub_h + 2, r=2.6, $fn=50);     // 5.2mm clearance hole
            cube([10, 3.2, hub_h + 2], center=true);   // 3.0mm measured + 0.2mm clearance
        }
    }

    // Option A only: material above the measured shaft tip creates a real roof.
    option_a_central_cap();

    // Default path: the boss the blind bore reaches up into.
    cam_central_cap();

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
            difference() {
                cylinder(h=hub_h, r=4.5, $fn=50);
                translate([0, 0, -1])
                intersection() {
                    cylinder(h=hub_h+2, r=2.6, $fn=50);
                    cube([10, 3.2, hub_h+2], center=true);  // Double-D
                }
            }
            option_a_central_cap();
            cam_central_cap();
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
