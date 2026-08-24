// =========================================================
// BRAILLIX LINKAGE COMB — anti-rotation guide (foot-end)
//
// WHY THIS EXISTS. A comb was deleted on 2026-06-04 with the note "linkages are
// constrained at BOTH ends ... a separate comb guide is unnecessary". That was
// wrong and it was disproved by hand on 2026-08-24: the foot only RESTS on the
// cam, so nothing resists tangential force. Put a linkage on a ramp and the cam
// drags it round the disc instead of lifting it — at the current 72deg pressure
// angle the ramp pushes sideways 3.1x harder than it pushes up.
//
// WHERE IT GRIPS. Not the arm — the FOOT and LOWER RISER, at the outer end.
//   * the upper riser is already located by the nub in the resin dot insert
//   * gripping at track radius (12.8..21.3) is the longest available lever, so
//     slot clearance costs the least angular error
//   * out here the six feet are 60deg apart, instead of converging on the dot
//     cluster where slots would nearly touch
// Two well-separated constraints — nub above, foot below — fully control the
// part. One constraint in the middle does not.
//
// The foot is a roll of radius foot_roll_r = link_thickness/2, so across the
// track it measures exactly link_thickness, the same as the lower riser. One
// constant slot width therefore fits both, with no step for the part to rock in.
// If the foot is ever narrowed independently of the arm, foot_tang must follow
// the FOOT, not the arm.
// =========================================================

include <mech_layout.scad>

assert(!is_undef(foot_len) && !is_undef(plate_under_y) && !is_undef(link_thickness)
       && !is_undef(arm_y) && !is_undef(foot_w),
       "linkage_comb needs foot_len, arm_y, foot_w, plate_under_y and link_thickness from mech_layout.scad");

// --- what the slot has to hold -------------------------------------------
// Foot and lower riser share one width. Declared separately so a future thin
// foot / thick arm split does not silently widen this slot.
foot_tang  = link_thickness;
slot_fit   = 0.30;                    // 0.15/side sliding fit in resin
slot_w     = foot_tang + slot_fit;

// --- vertical placement, linkage-local Y (0 = cam flat surface) ----------
// Bottom must clear the cam bumps, which stand pin_lift proud of the flat.
// Top must stay under the arm, which starts at arm_y.
comb_bot   = pin_lift + 0.4;                 // 1.2 with a 0.8 lift
// Ceiling is the arm's underside at its LOWEST, since the whole linkage rises
// by pin_lift. That leaves comb_bot..arm_y to work in — 2.3mm today, and more
// once pin_lift drops to 0.5. Engagement stays constant through the stroke
// because the part slides through the slot rather than out of it.
comb_top   = arm_y - 0.2;
comb_h     = comb_top - comb_bot;

// --- ring ----------------------------------------------------------------
// Spans every track, and its outer rim lands on the base-plate face outside
// the Ø46 cam pocket, so the part is supported without touching the cam.
track_min  = min([for (d = [1:6]) norm(foot_pos(d))]);
track_max  = max([for (d = [1:6]) norm(foot_pos(d))]);
ring_in    = track_min - 1.5;
rim_width  = 2.0;
ring_out   = track_max + (foot_w + slot_fit) / 2 + rim_width;

$fn = 90;

// A CLOSED pocket, walls on all four sides, centred on that dot's foot.
//
// An open radial channel holds the foot tangentially but lets it slide in and
// out along the arm, so the linkage can still yaw about the dot. Closing the
// radial ends locates the foot completely; together with the nub in the dot
// insert the part is then fully determined and cannot rotate at all.
//
// Assembly is still straightforward: the arm sits at arm_y and the comb tops
// out below it, so a linkage lowers straight down into its pocket from above.
module foot_slot(d) {
    rotate([0, 0, dot_phase_of(d)])
        translate([track_r(dot_track_of(d)) - (foot_w + slot_fit) / 2,
                   -slot_w / 2, comb_bot - 0.1])
            cube([foot_w + slot_fit, slot_w, comb_h + 0.2]);
}

module linkage_comb() {
    difference() {
        translate([0, 0, comb_bot])
            difference() {
                cylinder(r = ring_out, h = comb_h);
                translate([0, 0, -0.1]) cylinder(r = ring_in, h = comb_h + 0.2);
            }
        for (d = [1:6]) foot_slot(d);
    }
}

// --- CHECKS ---------------------------------------------------------------
assert(comb_h > 2, str("comb only ", comb_h, "mm tall — a constant is undef"));
assert(comb_top < arm_y, str("comb top ", comb_top, " fouls the arm at ", arm_y));
// slots must not meet: arc between neighbouring feet at the innermost track
gap_at_inner = 2 * PI * track_min * 60 / 360 - slot_w;
assert(gap_at_inner > 1.0,
       str("only ", gap_at_inner, "mm between neighbouring slots at r=", track_min));

linkage_comb();
