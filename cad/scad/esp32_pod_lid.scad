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

// --- JACK SUPPORT CRADLE (v6.2) ---
// PLACEHOLDER — MEASURE REAL JACK. The user's barrel jack is a BARE socket (no nut),
// so plug-in force would push it down/in. This U-pocket hangs under the lid around the
// jack hole at (-22,18); the bottom shelf takes the downward push. Front (toward -X/USB)
// left open for the wire/solder lugs.
jack_body_w      = 9.5;   // MEASURE (M15) — Y width of the jack body
jack_body_l      = 12;    // MEASURE (M14) — X length of the jack body
jack_body_h      = 11;    // MEASURE (M16) — Z depth hanging below the lid
cradle_t         = 1.5;   // cradle wall thickness

// v7.5 guard: the cradle used to overrun the pod cavity by 1.5mm, so the lid
// simply could not close, and nobody noticed because all three dims are guesses.
// This now fails loudly the moment a measured jack is too big for its position.
assert(barrel_jack_x - jack_body_l/2 - cradle_t > -pod_int_length/2,
       "Jack cradle overruns the -X pod wall. Move barrel_jack_x inboard (toward 0) \
or shrink the cradle.");

// --- MODULES ---

// Over-cap body: X flush (±32), Y overhang (±35), rounded corners match pod fillet.
module lid_cap_body() {
    pod_rounded_box(lid_cap_x, lid_cap_y, lid_h, pod_fillet);
}

// v8.1: yy_skirt() removed — the lid is flush on all four sides now.

// Jack support cradle — open-topped U hanging below the lid underside.
// Two side walls + a back wall (+X side) + a bottom shelf; front (-X) left open.
module jack_cradle() {
    inner_x = jack_body_l;          // X opening for the jack body
    inner_y = jack_body_w;          // Y opening
    x0 = barrel_jack_x - inner_x/2; // inner-X start (front/open side faces -X)
    y0 = barrel_jack_y - inner_y/2;
    z_bot = -jack_body_h;           // bottom shelf top sits jack_body_h below the lid
    wall_h = jack_body_h + 0.5;     // overlap 0.5mm into the lid underside to fuse
    // Side walls (along X) at ±Y of the pocket
    for(sy = [-1, 1]) {
        ywall = (sy < 0) ? y0 - cradle_t : y0 + inner_y;
        translate([x0 - cradle_t, ywall, z_bot])
            cube([inner_x + cradle_t * 2, cradle_t, wall_h]);
    }
    // Back wall (+X side, away from USB) — closes the dock-end of the pocket
    translate([x0 + inner_x, y0 - cradle_t, z_bot])
        cube([cradle_t, inner_y + cradle_t * 2, wall_h]);
    // Bottom shelf — takes the downward insertion force
    translate([x0 - cradle_t, y0 - cradle_t, z_bot])
        cube([inner_x + cradle_t * 2, inner_y + cradle_t * 2, cradle_t]);
}

module barrel_jack_cutout() {
    // v6.1b: now fully inside the lid (was overflowing the edge → open notch)
    translate([barrel_jack_x, barrel_jack_y, -1])
        cylinder(d=barrel_jack_dia, h=lid_h + 2);
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

module jack_guard_ring() {
    // Raised ring around the barrel jack so a finger finds the power inlet without
    // probing the live contact. v6.1b: full ring now that the hole is inside the lid.
    translate([barrel_jack_x, barrel_jack_y, lid_h - 0.01])
        difference() {
            cylinder(d=barrel_jack_dia + 5, h=1.4, $fn=40);
            translate([0, 0, -1]) cylinder(d=barrel_jack_dia + 0.6, h=3.4, $fn=40);
        }
}

// --- MAIN LID MODULE ---

module esp32_pod_lid() {
    union() {
        difference() {
            union() {
                lid_cap_body();   // over-cap: flush ±34 on all four sides
            }
            barrel_jack_cutout();
            lid_screw_holes();
        }
        pod_id_marker();
        jack_guard_ring();
        jack_cradle();             // U-pocket under the jack hole takes plug-in force
    }
}

// --- RENDER ---
esp32_pod_lid();
