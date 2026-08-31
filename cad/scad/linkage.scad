// =========================================================
// BRAILLIX LINKAGE SET — Resin-Printed Cranks
// Revision 4.1 — Coaxial dot spring (v7.1, 2026-07-26)
//
// Print 8 (6 required + 2 spares) in TOUGH or ABS-like resin, flat on
// the plate. Post-process: nothing. No bearing balls, no glue, no
// machined cup — the braille dot is printed as part of the linkage.
//
// ---------------------------------------------------------
// WHAT CHANGED IN v4.1
// ---------------------------------------------------------
// v4.0 put the return-spring seat on a 5mm pad HALFWAY ALONG THE ARM.
// Wrong: physically the return force belongs on the dot axis, where the
// dot is. v4.1 moves it there —
//
//   * mid-arm pad DELETED
//   * SPRING FLANGE added on the upper riser, below the dome. The spring
//     lives in a counterbore in the top plate, wraps around the dot, and
//     pushes down on this flange to hold the dot down when no cam bump is
//     under the foot.
//   * NUB SLIMMED 2.2 -> 1.0mm so it slides inside the 1.4mm spring bore,
//     and the DOT DOME 2.2 -> 1.5mm, which is the real braille standard
//     (1.44-1.6mm). The old 2.2mm dome was oversized.
//   * count-dots moved back onto the arm (there is room again now the pad
//     is gone; on the pad rim was only ever a workaround).
//
// Everything from v4.0 stays: feet spread 60deg, ONE common arm height,
// total_h 13.0, rolled foot, fillets. See mech_layout.scad for the why.
// =========================================================

include <mech_layout.scad>

// --- 1. PARAMETERS ---

thickness   = link_thickness;  // 1.0, from mech_layout.scad — the assembly
                     // transform needs the same number, so it lives there.
                     // sheet thickness. Once assembled this is the foot's
                     // TANGENTIAL contact width — it must fit inside the cam's
                     // flat dwell zone (see braille_cam.scad v6.3 header).
// foot_w comes from mech_layout.scad — the comb pocket is sized from it
// foot_len comes from mech_layout.scad — the comb needs the same number
// R-07: now declared in mech_layout.scad, because braille_cam.scad has to size
// its ramps from it. Do not re-declare it here.
assert(!is_undef(foot_roll_r), "linkage needs foot_roll_r from mech_layout.scad");

arm_h       = 1.0;   // horizontal arm thickness
// arm_y comes from mech_layout.scad — the comb needs the same number.
             // COMMON to all six (v7.0). Arm top when a dot is raised =
                     // 3.5+1.0+0.8 = 5.3mm, vs plate underside at 9.0mm -> 3.7mm clear.

// Dot end — all from mech_layout.scad so the plate cannot disagree
nub_w       = nub_width;      // 1.0mm, slides inside the 1.4mm spring bore
dot_r       = dot_dome_dia/2; // 0.75 -> 1.5mm dome = braille standard
total_h     = link_total_h;   // 13.0

fillet_in   = 0.6;   // internal corner fillets (strength)
fillet_out  = 0.25;  // outer corner softening (feel/looks)

$fn = 48;

// --- 2. 2D BODY PROFILE ---
// Local frame: X = arm direction (0 = nub end, span = foot end), Y = vertical.
// Foot, flange and dome are built in 3D below, so this profile covers only the
// risers + arm and overlaps them slightly.

module body_profile_raw(dot) {
    span = arm_span(dot);
    union() {
        // lower riser: foot top up to arm bottom, at the foot end
        translate([span - thickness/2, foot_len - 0.1])
            square([thickness, arm_y - foot_len + 0.1]);
        // horizontal arm
        translate([0, arm_y])
            square([span, arm_h]);
        // upper riser: arm top all the way up into the dome
        translate([-nub_w/2, arm_y + arm_h])
            square([nub_w, (total_h - dot_r) - (arm_y + arm_h) + 0.1]);
    }
}

// Fillet pass.
//   CLOSING (dilate then erode) fills concave corners = the strength fillets.
//   OPENING (erode then dilate) softens convex corners = the "less blocky" look.
// Both restore the original member thickness exactly.
//
// CAREFUL — OpenSCAD applies offset() INSIDE-OUT: the innermost offset runs
// first. Writing the pair the natural-reading way round erodes by fillet_in
// FIRST, which deletes every thin member (1.0 - 2*0.6 < 0) and leaves a hollow
// shell. Keep this nesting order.
module body_profile(dot) {
    offset(r = fillet_out) offset(r = -fillet_out)      // ...then opening
        offset(r = -fillet_in) offset(r = fillet_in)    // closing runs first...
            body_profile_raw(dot);
}

// --- 3. 3D FEATURES ---

// Rounded cam-follower foot: a roll lying ACROSS the track, so it is
// curved in the direction of travel and flat across the track width.
module foot_3d(dot) {
    span = arm_span(dot);
    hull() {
        translate([span - foot_w/2, foot_roll_r, thickness/2])
            rotate([0, 90, 0])
                cylinder(r = foot_roll_r, h = foot_w);
        translate([span - thickness/2, foot_len, 0])
            cube([thickness, 0.01, thickness]);
    }
}

// Braille dot: printed dome on top of the nub, 1.5mm = braille standard.
module nub_dome_3d() {
    hull() {
        translate([-nub_w/2, total_h - dot_r - 0.2, 0])
            cube([nub_w, 0.01, thickness]);
        translate([0, total_h - dot_r, thickness/2])
            sphere(r = dot_r);
    }
}

// Return-spring flange: the disc the spring presses down on. Chamfered
// underside so it prints without a sharp shelf hanging off the riser.
module spring_flange_3d() {
    translate([0, flange_bot_y, thickness/2])
        rotate([-90, 0, 0])
            cylinder(d1 = flange_dia - 0.6, d2 = flange_dia, h = flange_h);
}

// --- 4. COUNT-DOTS: which linkage is which ---
// 1..6 small bumps = the braille dot number this linkage drives.
//
// They matter because the six arms differ by as little as 0.67mm in length
// (dot 5 = 10.40 vs dot 4 = 11.08), so by eye they are indistinguishable —
// and fitting the wrong one puts its foot on the wrong cam track, which
// makes that dot read the wrong bit and garbles the letter.
//
// v7.2: moved to the arm's UNDERSIDE and shrunk (0.9 -> 0.6mm dia, 0.5 ->
// 0.35mm proud) so they are invisible in normal view but still countable
// with a fingernail. The underside faces the cam, with ~2.4mm of clearance
// above the bump, so nothing touches. Sunk 0.3mm INTO the arm — sitting
// flush on the surface leaves them as separate touching bodies that resin
// prints as loose specks.
module count_dots_3d(dot) {
    for (i = [0 : dot - 1])
        translate([1.8 + i * 1.0, arm_y + 0.3, thickness/2])
            rotate([90, 0, 0])            // +Z -> -Y, i.e. downward
                cylinder(d = 0.6, h = 0.65, $fn = 16);
}

// --- 5. COMPLETE LINKAGE ---

module linkage_3d_v4(dot) {
    union() {
        linear_extrude(height = thickness) body_profile(dot);
        foot_3d(dot);
        nub_dome_3d();
        spring_flange_3d();
        count_dots_3d(dot);
    }
}

// Backwards-compatible alias (older files call linkage_3d_v3)
module linkage_3d_v3(dot) { linkage_3d_v4(dot); }

// --- 6. FLAT LAYOUT FOR PRINTING ---
// Print files use linkage_3d_v4() directly — see print_resin_*.scad.

spacing = 22;
for (d = [1 : 6])
    translate([(d - 1) * spacing, 0, 0])
        linkage_3d_v4(d);

// --- 7. REFERENCE (computed live by mech_layout.scad — documentation only) ---
// dot | track |  r    | foot@ | arm span | nub at
//  1  |   2   | 18.20 | 120deg|  14.77   | (-2.4, +2.6)
//  2  |   3   | 19.90 | 180deg|  17.50   | (-2.4,  0.0)
//  3  |   4   | 21.60 | 240deg|  18.17   | (-2.4, -2.6)
//  4  |   1   | 16.50 |  60deg|  13.07   | (+2.4, +2.6)
//  5  |   0   | 14.80 |   0deg|  12.40   | (+2.4,  0.0)
//  6  |   5   | 23.30 | 300deg|  19.86   | (+2.4, -2.6)
//
// R-07 (2026-09-01) moved inner_radius 12 -> 14, so every radius above is 2.0mm
// larger and every arm 2.0-2.4mm longer than it was. The arms are now 12.4-19.9mm
// on a 1.0 x 1.0mm section, which is the LONGEST they have ever been - see the
// stiffness note in .ai-sync/handoff.md, still unresolved.
//
// Closest approach between any two arms: 2.60mm vs 1.0mm arm thickness,
// so all six share arm_y = 3.5mm with margin to spare.
