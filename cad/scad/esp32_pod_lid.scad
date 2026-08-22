// =========================================================
// COMPONENT: ESP32 BRAIN POD — Top Lid
// Revision 3.0 — Matching Brick
// Updated 2026-05-31
//
// PRINTABLE PART 2 of 2. Pair with esp32_pod_shell.scad.
//
// Lid screws into shell bosses at x=±25 (F14 fix).
// Barrel jack hole on the lid near -X end.
//
// Print orientation: flat (face down).
// Material: PETG.
// =========================================================

include <esp32_pod_params.scad>

shell_h = pod_height - lid_h;

// --- OVER-CAP DIMENSIONS (v6.2) ---
// Lid is now an over-cap: X flush with pod outer (64, ±32 — NO skirt on ±X so the
// +X dock face stays flat), Y 70 (±35 = 1mm overhang each side) with a downward
// skirt on ±Y only. Underside at z=0, top at z=lid_h(4).
// v7.5: every one of these was a hard-coded number that happened to match
// pod_length=64 / pod_width=68. Lengthening the pod to 68 would have left them
// silently wrong. They are now derived, so the lid tracks the shell automatically.
lid_cap_x        = pod_length;            // 68 — flush, no overhang on dock faces
// v8.1: flush on all four sides (was pod_width + 2 with a ±Y skirt). Same reasoning
// as top_plate.scad — ±X had to stay flush for the dock face, so the lip only ran
// front/back and its skirt stopped short of the corners, leaving a stepped 1mm
// ledge. The two M2 screws locate the lid, so the skirt earned nothing.
lid_cap_y        = pod_width;             // 68 — flush, no overhang

// The old 11mm-deep guessed panel-jack cradle was removed. It made the slicer
// print the lid in mid-air with supports off and could not retain the owned pigtail.
// --- MODULES ---

// Over-cap body: X flush (±32), Y overhang (±35), rounded corners match pod fillet.
module lid_cap_body() {
    pod_rounded_box(lid_cap_x, lid_cap_y, lid_h, pod_fillet);
}

// v8.1: yy_skirt() removed — the lid is flush on all four sides now.

module power_cable_cutout(extra = 0, z0 = -1, cut_h = lid_h + 2) {
    // Rounded 6x4 slot. Only the cable passes through; the connector stays outside.
    dx = (power_cable_slot_w - power_cable_slot_h) / 2;
    hull()
        for(sx = [-1, 1])
            translate([power_cable_x + sx * dx, power_cable_y, z0])
                cylinder(d=power_cable_slot_h + extra, h=cut_h, $fn=30);
}
module lid_screw_holes() {
    // 2× M2 clearance holes — align with shell bosses at x=±25
    for(sx = [-1, 1]) {
        translate([sx * lid_screw_x, 0, -1])
            cylinder(d=lid_screw_d, h=lid_h + 2);
    }
}

// --- RAISED TACTILE FEATURES (v6.0) ---

module pod_id_marker() {
    // v6.1: was a braille ⠿ with 1.4mm dots — printed as mush on FDM (raised features
    // <2.5mm fail on a 0.4mm nozzle). Now 3 bold parallel ridges so a blind user can
    // tell the BRAIN POD apart from the identical-looking cells by touch.
    // Each ridge: 3mm wide × 1.2mm proud × 15mm long, rounded top, 6mm apart.
    for(ry = [-6, 0, 6])
        translate([0, ry, lid_h - 0.01])
            hull() {
                translate([-7.5, -1.5, 0]) cube([15, 3, 0.6]);
                translate([-6.5, -0.5, 0]) cube([13, 1, 1.2]);
            }
}

module power_cable_marker() {
    // 1.4mm-proud tactile oval; connector body remains outside the pod.
    difference() {
        power_cable_cutout(5.0, lid_h - 0.01, 1.4);
        power_cable_cutout(0.8, lid_h - 1, 3.4);
    }
}

// --- MAIN LID MODULE ---

module esp32_pod_lid() {
    union() {
        difference() {
            union() {
                lid_cap_body();   // over-cap: flush ±34 on all four sides
            }
            power_cable_cutout();
            lid_screw_holes();
        }
        pod_id_marker();
        power_cable_marker();
        // Tie the pigtail to the shell tie post; no unsupported cradle is required.
    }
}

// --- RENDER ---
esp32_pod_lid();
