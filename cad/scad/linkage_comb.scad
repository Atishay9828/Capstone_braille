// =========================================================
// BRAILLIX LINKAGE COMB — anti-rotation guide
//
// WHY THIS EXISTS. A comb was deleted on 2026-06-04 with the note "linkages are
// constrained at BOTH ends ... a separate comb guide is unnecessary". They are
// not: the foot only RESTS on the cam, so nothing resists tangential load.
// Disproved by hand on 2026-08-24 — on a ramp the cam drags the linkage round
// the disc instead of lifting it.
//
// WHERE IT GRIPS. The FOOT and lower riser, at track radius. The upper riser is
// already located by the nub in the resin dot insert, so a second constraint out
// at r=12.8..21.3 is the longest lever available, and out there the six feet are
// 60deg apart rather than converging on the dot cluster.
//
// CLOSED POCKETS, not open channels. An open radial slot holds the foot
// tangentially but lets it slide along the arm, so the linkage can still yaw.
// Four walls locate the foot completely. Assembly is unaffected: the arm sits at
// arm_y and the comb tops out below it, so a linkage lowers straight in.
//
// HOW IT IS HELD. The square skirt rests on the base-plate top face, outside the
// cam pocket. A spigot under the middle drops into that pocket and centres the
// part; four pegs stop it turning. The middle is relieved so nothing touches the
// rotating cam.
//
// ORIENTATION. One small raised dot near the top-left corner (-X, +Y). Nothing
// else on the part is proud, so it reads by eye or by fingertip in one touch.
// =========================================================

include <mech_layout.scad>

assert(!is_undef(foot_len) && !is_undef(arm_y) && !is_undef(foot_w)
       && !is_undef(link_thickness) && !is_undef(pin_lift),
       "linkage_comb needs foot_len, arm_y, foot_w, link_thickness, pin_lift from mech_layout.scad");

// --- what the pockets hold -----------------------------------------------
// Foot and lower riser share one width across the track, so one pocket fits
// both with no step to rock in. Sized from the FOOT: if the foot is ever
// narrowed independently of the arm, these must follow the foot.
slot_fit  = 0.30;                       // 0.15/side sliding fit in resin
pocket_w  = link_thickness + slot_fit;  // across the track
pocket_l  = foot_w + slot_fit;          // along the arm

// --- vertical ------------------------------------------------------------
// Rests on the base-plate face, which stands 1.0mm proud of the cam surface.
// Over the cam the underside is relieved so it clears the bumps.
rest_z     = 1.0;                       // base_plate top, relative to cam flat
clear_z    = pin_lift + 0.35;           // underside of the part over the cam
comb_top   = arm_y - 0.2;               // stop below the arm at its lowest
comb_h     = comb_top - rest_z;

// --- plan ----------------------------------------------------------------
// Square, so it drops into the box one way up and reads unambiguously by hand.
// Sized in mech_layout.scad: 54mm sits inside the 58 x 56 base plate and still
// lands 2mm outside the Ø50 cam pocket on all four edges.
// comb_side, cam_pocket_diameter, standoff_* and comb_peg_xy are shared - see
// mech_layout.scad. This file used to keep its own copies "from base_plate.scad",
// which is a comment, not a link.
assert(!is_undef(comb_side) && !is_undef(cam_pocket_diameter)
       && !is_undef(standoff_x) && !is_undef(comb_peg_xy),
       "linkage_comb needs the shared footprint from mech_layout.scad");
corner_r     = 2.0;
cam_pocket_d = cam_pocket_diameter;
spigot_r     = cam_pocket_d / 2 - 0.35; // centres the comb in that pocket
bore_r       = min([for (d = [1:6]) norm(foot_pos(d))]) - 1.6;

// Pegs sit on the diagonal, so what matters is their RADIUS, not their x/y.
// At 19.0 they are r=26.9, clear of the Ø50 cam pocket, and far enough from the
// chamfered corner that the mark does not cut into one.
// The base-plate corner standoffs pass THROUGH the comb. At (26, 21) with Ø6 the
// standoff spans x 23..29 and y 18..24; the comb now runs to 27 in both, so the
// clearance is a bite out of each corner rather than a nick. Scallop them.
standoff_d   = standoff_diameter;
standoff_fit = 0.8;     // 0.4/side, generous - this is clearance, not a fit

peg_xy = comb_peg_xy;
peg_d  = 2.2;

mark_d   = 1.6;    // orientation dot
mark_h   = 0.5;
mark_pos = 5.0;    // in from the top-left corner, on both axes

$fn = 60;

module rounded_square(side, r, h) {
    hull() for (sx = [-1, 1], sy = [-1, 1])
        translate([sx * (side/2 - r), sy * (side/2 - r), 0]) cylinder(r = r, h = h);
}

// Closed pocket around one foot.
module foot_pocket(d) {
    rotate([0, 0, dot_phase_of(d)])
        translate([track_r(dot_track_of(d)) - pocket_l/2, -pocket_w/2, clear_z - 0.1])
            cube([pocket_l, pocket_w, comb_h + 0.2]);
}

module orientation_dot() {
    translate([-comb_side/2 + mark_pos, comb_side/2 - mark_pos, comb_top - 0.01])
        cylinder(d = mark_d, h = mark_h);
}

module linkage_comb() {
    difference() {
        union() {
            translate([0, 0, rest_z]) rounded_square(comb_side, corner_r, comb_h);
            orientation_dot();
        }
        // relieve the underside over the cam so nothing touches the bumps
        translate([0, 0, rest_z - 0.1])
            cylinder(r = spigot_r, h = clear_z - rest_z + 0.1);
        // central bore — the six arms converge here
        translate([0, 0, rest_z - 0.1]) cylinder(r = bore_r, h = comb_h + 0.2);
        for (d = [1:6]) foot_pocket(d);
        for (sx = [-1, 1], sy = [-1, 1])
            translate([sx * peg_xy, sy * peg_xy, rest_z - 0.1])
                cylinder(d = peg_d, h = comb_h + 0.2);
        // clearance for the four corner standoffs
        for (sx = [-1, 1], sy = [-1, 1])
            translate([sx * standoff_x, sy * standoff_y, rest_z - 0.1])
                cylinder(d = standoff_d + standoff_fit, h = comb_h + 0.2);
    }
}

// --- CHECKS ---------------------------------------------------------------
assert(comb_h > 1.5, str("comb only ", comb_h, "mm tall — a constant is undef"));
assert(clear_z > pin_lift, "comb underside would strike the cam bumps");
assert(comb_side/2 > cam_pocket_d/2, "comb does not reach past the cam pocket to rest on");
assert(peg_xy * sqrt(2) > cam_pocket_d/2 + 1,
       str("peg holes at r=", peg_xy*sqrt(2), " fall inside the Ø", cam_pocket_d, " cam pocket"));
assert(norm([comb_side/2 - mark_pos - peg_xy, comb_side/2 - mark_pos - peg_xy])
       > (mark_d + peg_d) / 2, "orientation dot overlaps the top-left peg hole");
assert(comb_side <= base_width - 1,
       str("comb ", comb_side, " overhangs a ", base_width, "mm plate"));
// The scallop must not eat so far in that it meets a foot pocket.
scallop_gap = min([for (d = [1:6])
    norm([standoff_x, standoff_y] - foot_pos(d))]) - (standoff_d + standoff_fit)/2 - pocket_l/2;
assert(scallop_gap > 1.0,
       str("standoff scallop comes within ", scallop_gap, "mm of a foot pocket"));
bore_ok = bore_r < min([for (d = [1:6]) norm(foot_pos(d))]) - pocket_l/2;
assert(bore_ok, "central bore eats into the innermost pocket");

linkage_comb();
