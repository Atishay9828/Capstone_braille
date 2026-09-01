// =========================================================
// ESP32 BRAIN POD — Shared Parameters & Base Modules
// Revision 3.0 — Matching Brick + Horizontal Socket Mount
// Updated 2026-05-31
//
// Pod now shares the cell's docking face (68 wide × 58 tall)
// so the chain looks like a uniform row of bricks.
//
// Owned ESP32 USB-C DevKit (30-pin, ~51.5×28mm family) mounts HORIZONTALLY
// on two 1×15 female header strips — plug-and-play, no soldering.
//
// include <esp32_pod_params.scad>
// =========================================================

include <stack_options.scad>
include <dock_interface.scad>

// --- POD SHELL DIMENSIONS ---
// v7.5: 64 -> 68. The 51.5mm board offset +4mm in X spanned x = -21.75..+29.75
// inside a cavity that ended at +28 — a 1.75mm interference, so the DevKit
// physically would not go in. 68 makes the internal cavity 60 (+/-30) and, as a
// bonus, makes the pod a 68x68x58 cube exactly matching a cell, so the docked
// chain really is a uniform row of bricks. The +X dock face is unchanged.
pod_length       = 68;     // X — depth (USB end to dock end)
pod_width        = 68;     // Y — matches cell shell_width for uniform chain look
// v8.5: 58 -> 44, following the cell. The pod was never full - floor 3, wire tail
// 5, header 8.5, board 1.6, tallest component ~4, clearance 3 and a 4mm lid come to
// about 29mm. At 44 there is still 15mm spare.
pod_height       = 46.5 + stack_repair_raise; // Z — matches cell shell_height
pod_wall         = 4;      // Wall thickness
pod_floor        = 3;      // Floor thickness
pod_fillet       = 3.0;    // Outer corner radius — matches cell (was 2.0)

lid_h            = pod_wall;   // 4mm lid

// Internal cavity
pod_int_length   = pod_length - 2 * pod_wall;  // 56mm
pod_int_width    = pod_width  - 2 * pod_wall;  // 60mm

// --- ESP32 DEVKIT V1 MOUNTING (horizontal on female header sockets) ---
// Board: ~51.5 × 28mm, 15 pins/side, measured pin-row pitch 25.6mm (M21)
// Two 1×15 female header strips sit in printed channels on the floor.
// DevKit's male pins plug straight down — zero soldering, fully removable.
devkit_length    = 51.5;   // LIKELY (M19) — matching USB-C CH340C 30-pin listings
devkit_width     = 28.0;   // LIKELY (M20) — matching board family; listings reach 28.5

// M18: 15 pins per side / 30 total. M21: 25.6mm centre-to-centre on the owned
// USB-C board. This is close to the nominal 1.0" (25.4mm) family, but the owned
// reading controls the printed socket-channel locations.
hdr_row_pitch    = 25.6;   // MEASURED (M21) — pin-row centre-to-centre
hdr_strip_w      = 2.7;    // Female header strip body width
hdr_strip_h      = 8.5;    // Female header strip body height (board sits at floor+8.5)
hdr_strip_len    = 40.0;   // 15-pin strip length (~15×2.54=38.1, round up)
hdr_tail_space   = 5.0;    // prewired lower-tail/solder/wire service space
hdr_body_bottom_z = pod_floor + hdr_tail_space; // raised socket-body seat at z=8
hdr_cradle_w     = 3.2;    // 2.7mm body + 0.5mm lateral clearance
hdr_cradle_len   = 40.4;   // 40.0mm body + 0.4mm end clearance

// Board position: centred in Y, biased toward the -X/USB wall.
// v7.5: +4 -> -2. Pushing the board TOWARD the USB wall shortens how far the plug
// has to reach inboard to seat (was 6.25mm, now 2.25mm), and still leaves 6.25mm
// at the +X end for the pogo/dock wiring.
//   board spans x = -2 +/- 25.75 = -27.75 .. +23.75, inside a +/-30 cavity.
devkit_x_offset  = -2;

// --- OWNED INLINE POWER PIGTAIL (through the LID) ---
// The photographed connector is a female inline lead, not a threaded panel jack.
// Keep its body outside the pod and pass only the red/black cable pair through this
// rounded slot. Secure the cable to the existing internal tie post before soldering;
// plug-in force then loads the tie, not the ESP32 or lid.
power_cable_slot_w = 6.0;  // generous for the pictured two-wire pair
power_cable_slot_h = 4.0;
power_cable_x      = -20;
power_cable_y      = 24;   // 8mm nominal clearance beyond board/slot edge
// --- USB CUTOUT (-X end wall) ---
// v7.5: the old usb_z had an arithmetic bug — it ignored hdr_channel_depth. The
// header strips are RECESSED 1mm into the floor, so the board underside sits at
// pod_floor + hdr_strip_h - hdr_channel_depth = 10.5, not 11.5. The cutout was
// therefore ~2mm too high and only ~0.5mm of it overlapped the actual socket;
// the port was effectively behind solid wall.
// Service opening is intentionally larger than the USB-C shell so common cable
// overmoulds can reach the socket 2.25mm inboard. Keep the existing 9mm height:
// reducing it to 7mm would regress the cable-body clearance fixed in v7.5.
usb_w            = 14;     // Fixed service envelope; measure only unusually large cables
usb_h            = 12;     // conservative service envelope, z=14..26
board_under_z    = hdr_body_bottom_z + hdr_strip_h; // nominal 16.5
usb_z            = 14;

// --- POGO INTERFACE (+X dock wall) ---
// Matches cell ±X pogo window exactly
pogo_pad_w       = dock_receiver_w;
pogo_pad_h       = dock_receiver_h;
pogo_z_from_bot  = dock_center_z;

// --- MAGNET POCKETS (+X dock wall) ---
// v6.1: real magnets are 8mm dia × 1mm thick (was 3×2). 2 per face at y=±14,
// matching the cell exactly so docked magnets align. Teardrop tops (FDM).
// Cell -X face = N/S; pod +X face = S/N → attract, repel reversed
mag_dia          = dock_mag_dia;  // v8.6: shared, see dock_interface.scad
mag_depth        = 1.2;   // 1mm magnet + glue gap (4mm wall keeps 2.8mm)
mag_y_positions  = [-14, 14];
// Dock features stay at the same absolute height when Option A adds headroom.
// v8.6: WAS 29 AND WRONG. The comment said "matches cell" and stopped being true
// the moment the cell dropped 14mm; the two magnet rings were 15.5mm apart.
mag_z            = dock_mag_z;    // 13.5, derived - do not hand-copy this

// --- WIFI ANTENNA GRILLE (+X end, near dock) ---
antenna_wall     = 1.5;
antenna_slot_w   = 3;      // v6.1: 2→3mm (2mm slots fused on the fit-test printer)
antenna_slot_h   = 8;
antenna_slot_count = 3;

// --- WIRE TIE POST ---
tie_post_dia     = 4;
tie_post_h       = 10;
tie_slot_w       = 1.6;   // normal mini zip-tie thickness + print clearance
tie_slot_h       = 3.2;   // normal mini zip-tie width + print clearance
power_tie_x      = power_cable_x;
power_tie_y      = pod_int_width/2 - 4;

// --- NAVIGATION BUTTONS (front face, -Y wall) ---
// 3× PS-style flanged caps: Previous (<), Select (O), Next (>)
// 6×6×5mm tactile switches held in printed snap pockets behind wall
nav_shaft_dia    = 3.8;    // resin stem; 0.4mm diametral clearance in the Ø4.2 PETG hole
nav_hole_dia     = 4.2;    // 0.2mm sliding clearance
nav_flange_dia   = 8.0;
nav_flange_h     = 1.5;
nav_cap_body_dia = 7.5;
nav_cap_body_h   = 3.5;
nav_shaft_len    = 4.5;    // measured from flange INNER face: 4mm wall + 0.5mm to switch plunger
nav_z            = 58 * 0.42;  // ~24.4mm; keep switch/USB wiring geometry stable
nav_x_positions  = [-20, 0, 20];

// --- TACTILE SWITCH POCKET (behind each nav hole, inside front wall) ---
sw_body          = 6.4;    // 6mm switch + 0.4mm clearance
sw_depth         = 5.5;    // switch is 5mm + 0.5mm clearance behind
sw_snap_nib      = 0.8;    // retention nib overhang (v6.1: 0.4→0.8, was sub-layer thin)

// --- LID SCREW BOSSES ---
// v6.1b: 25→27.5. At x=25 the Ø5 bosses FLOATED 0.5mm off the inner wall (x=28) —
// disconnected bodies in the STL, printed as loose/spaghetti towers. At 27.5 the
// boss embeds 2mm into the wall. Lid holes follow automatically (same param).
// v7.5: HARD-CODED 27.5 IS NOW A FORMULA — and that is not cosmetic.
// 27.5 was correct only while pod_int_length was 56 (inner wall at x=28, so a Ø5
// boss at 27.5 spanned 25..30 and embedded 2mm into the wall). Lengthening the pod
// moved the inner wall to x=30, which would have left the boss exactly TOUCHING it
// — the precise floating-boss bug this comment block was written about the first
// time. Tie it to the wall so it can never drift again.
lid_screw_x      = pod_int_length/2 - 0.5;   // 29.5 — boss still embeds 2mm
lid_screw_d      = 2.9;    // v8.3: M2 -> M2.5 clearance in lid (was 2.8 for M2)

// v8.0: BRASS HEAT-SET INSERTS here too, so the lid can be opened repeatedly
// without stripping the plastic thread.
// Boss GREW 5.0 -> 6.5: an M2 insert needs a Ø3.2 bore, and Ø3.2 inside a Ø5.0 boss
// leaves only 0.9mm of wall — it would split when the hot brass goes in. Ø6.5 gives
// 1.65mm. The boss still embeds ~2.7mm into the pod wall at lid_screw_x, so it is
// not floating (see the note above about that exact failure).
lid_boss_d       = 6.5;    // Boss OD in shell
lid_boss_tap     = 2.5;    // narrow pilot BELOW the insert, catches the screw tip
// v8.3 STANDARDISED ON M2.5. Requested in .ai-sync/handoff.md ("CAD REQUESTS FROM
// THE ELECTRONICS FORK", item 4) and in docs/BUILD_PACK.md 7.3, so the project buys
// ONE structural insert size instead of two. The pod is not printed yet, which is
// the condition that request attached to.
//
// Post wall goes 1.65 -> 1.50mm around the hot brass. Still fine: the cell box uses
// the same 3.5mm insert in a 7.8mm boss, which is 2.15mm, and 1.5mm is the figure
// the request itself checked.
//
// NOT everything becomes M2.5. The motor keeps M4, because the 28BYJ-48's own ears
// are drilled 4.2mm and an M2.5 would leave 1.7mm of slop that walks the cam off
// centre. Two sizes is the answer, not one.
insert_m2_dia    = 3.5;    // MEASURE the inserts you buy (typical M2.5: 3.5-3.6)
insert_m2_depth  = 5.5;    // insert length + 0.5mm

$fn = 60;

// --- SHARED BASE MODULE ---

module teardrop_magnet_pocket() {
    // Horizontal-axis magnet pocket with a 45° "roof" — round side-wall holes fused
    // closed on the fit-test print; the teardrop top is self-supporting on FDM.
    // Drawn with axis along +Z, mouth at z=0; caller rotates it into the wall.
    r = mag_dia / 2;
    linear_extrude(mag_depth + 0.01) union() {
        circle(r=r, $fn=40);
        polygon([[-r * sin(45), r * cos(45)],
                 [0, r * sqrt(2)],
                 [ r * sin(45), r * cos(45)]]);
    }
}

module pod_rounded_box(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}
