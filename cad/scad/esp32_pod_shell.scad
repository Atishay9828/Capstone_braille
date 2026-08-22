// =========================================================
// COMPONENT: ESP32 BRAIN POD — Shell Body
// Revision 3.0 — Matching Brick + Horizontal Socket Mount
// Updated 2026-05-31
//
// PRINTABLE PART 1 of 2. Pair with esp32_pod_lid.scad.
//
// Pod is now 64×68×58mm — docking face (68×58) matches the cell
// so the chain looks like a uniform row of bricks.
//
// ESP32 DevKit V1 mounts horizontally on two raised 1×15 female-header
// strips. Pre-solder the used socket tails; the ESP32 itself remains removable.
//
// Print orientation: upright (open top facing up).
// Material: PETG.
// =========================================================

include <esp32_pod_params.scad>

shell_h = pod_height - lid_h;
assert(pod_wall == dock_wall_t,
       "Pod wall and shared dock receiver wall thickness have drifted");

// --- CUTOUT MODULES ---

module shell_internal_cavity() {
    translate([0, 0, pod_floor])
        pod_rounded_box(pod_int_length, pod_int_width, shell_h, pod_fillet - 1);
}

module usb_cutout() {
    translate([-pod_length/2 - 1, -usb_w/2, usb_z])
        cube([pod_wall + 2, usb_w, usb_h]);
}

module nav_button_holes() {
    for(nx = nav_x_positions) {
        translate([nx, -pod_width/2 - 1, nav_z])
            rotate([-90, 0, 0])
            cylinder(d=nav_hole_dia, h=pod_wall + 2, $fn=30);
    }
}

module dock_receiver_cutout() {
    // Through service receiver. It is deliberately contact-agnostic until a
    // measured, current-rated flush cartridge is selected.
    translate([pod_length/2, 0, pogo_z_from_bot])
        cube([pod_wall * 2 + 2, pogo_pad_w, pogo_pad_h], center=true);
}

module magnet_pockets() {
    // Cell -X face = N/S; pod +X face = S/N → attract when docked
    // v6.1: 8.4×1.2mm teardrop pockets for the real 8×1mm magnets (see params)
    for(my = mag_y_positions) {
        translate([pod_length/2 + 0.01, my, mag_z])
        rotate([0, -90, 0])
            teardrop_magnet_pocket();
    }
}

module antenna_grille() {
    for(i = [0 : antenna_slot_count - 1]) {
        y_pos = -((antenna_slot_count - 1) * (antenna_slot_w + 2)) / 2
                + i * (antenna_slot_w + 2);
        translate([pod_length/2 - pod_wall - 1,
                   y_pos - antenna_slot_w/2,
                   shell_h/2 - antenna_slot_h/2])
            cube([pod_wall - antenna_wall + 1, antenna_slot_w, antenna_slot_h]);
    }
}

// --- INTERIOR FEATURE MODULES ---

module header_socket_channels() {
    // Retired: the 1mm blind floor recess left nowhere for 30 socket tails,
    // solder joints, or wires. Raised prewired decks below replace it.
}

module header_socket_decks() {
    // Cross-ribs land between the 2.54mm pin positions, supporting each socket
    // body at z=8 while leaving 5mm beneath it for pre-soldered tails and wires.
    rib_x = [-6.5, -2.5, 2.5, 6.5];
    rib_w = 0.8;
    end_t = 1.5;
    for(sy = [-1, 1]) {
        for(rx = rib_x)
            translate([devkit_x_offset + rx*2.54 - rib_w/2,
                       sy*hdr_row_pitch/2 - hdr_cradle_w/2,
                       pod_floor - 0.1])
                cube([rib_w, hdr_cradle_w, hdr_tail_space + 0.1]);

        // Connected end posts stop longitudinal movement and rise 3mm above
        // the socket-body seat. Glue only the socket plastic after a dry fit.
        for(sx = [-1, 1]) {
            translate([devkit_x_offset + sx*(hdr_cradle_len/2 + end_t/2) - end_t/2,
                       sy*hdr_row_pitch/2 - hdr_cradle_w/2,
                       pod_floor - 0.1])
                cube([end_t, hdr_cradle_w, hdr_tail_space + 3.1]);
        }
    }
}

module rear_harness_cutout() {
    // Temporary one-/two-cell direct-GPIO harness route. A directly driven cell
    // needs eight conductors, so the four-contact dock cannot carry this build.
    translate([0, pod_width/2, 7])
        cube([15, pod_wall + 2, 6], center=true);
}

// v6.1b: REAL switch retention. The old "pockets + snap nibs" were geometry errors —
// the pocket cut into open interior air and the nibs floated 5mm off the wall
// (disconnected blobs in the STL). Nothing took the button press force: pressing a
// nav cap would simply shove the switch backwards into the pod.
// New: one cage per switch — two side fins + a solid BACK wall, all rising from the
// pod floor (zero overhang in the upright print). Press force path:
// front wall → switch body → back wall → floor. Switch drops in from the top,
// rests on two corner tabs, leads pointing UP/DOWN (legs vertical — side-leg
// orientation would foul the fins). Secure with a dab of hot glue after testing.
module switch_cages() {
    y_in   = -pod_width/2 + pod_wall;  // inner face of front wall
    depth  = 7.2;   // wall face → back wall: 5mm body + 1.5mm plunger + play
    bw_t   = 2;     // back wall thickness
    fin_t  = 2;     // side fin thickness
    slot_w = sw_body;            // 6.4 (6mm switch + clearance)
    z_bot  = pod_floor;          // start at floor — printable upright
    z_top  = nav_z + 6;          // ~6mm above switch top for finger access
    tab    = 1.6;   // shelf tabs under the switch body corners (set its height;
                    // minor FDM sag on their underside is fine)
    sw_bot = nav_z - 3;          // bottom of the 6mm switch body
    for(nx = nav_x_positions) {
        // Side fins
        for(sx = [-1, 1])
            translate([nx + sx * slot_w/2 + (sx < 0 ? -fin_t : 0), y_in - 0.01, z_bot])
                cube([fin_t, depth + 0.01, z_top - z_bot]);
        // Back wall (takes the press force)
        translate([nx - slot_w/2 - fin_t, y_in + depth, z_bot])
            cube([slot_w + 2 * fin_t, bw_t, z_top - z_bot]);
        // Corner shelf tabs — switch body rests here, bottom legs hang in the
        // 3.2mm gap between the tabs
        for(sx = [-1, 1])
            translate([nx + sx * slot_w/2 + (sx < 0 ? 0 : -tab), y_in - 0.01, sw_bot - 1.6])
                cube([tab, depth + 0.01, 1.6]);
    }
}

module wire_tie_post(px, py) {
    translate([px, py, pod_floor]) {
        difference() {
            cylinder(d=tie_post_dia, h=tie_post_h, $fn=30);
            translate([-tie_post_dia/2 - 1, -tie_slot_w/2,
                       tie_post_h/2 - tie_slot_h/2])
                cube([tie_post_dia + 2, tie_slot_w, tie_slot_h]);
        }
    }
}

module lid_locating_lip() {
    translate([0, 0, shell_h])
        difference() {
            pod_rounded_box(pod_int_length + 2 * 1.0,
                            pod_int_width  + 2 * 1.0, 1.0, pod_fillet - 1);
            translate([0, 0, -0.01])
                pod_rounded_box(pod_int_length - 0.4,
                                pod_int_width  - 0.4, 1.1, pod_fillet - 1.5);
        }
}

// v6.1: the P/S/N braille labels (1.4mm dots) were REMOVED — they printed as mush on
// FDM (raised features <2.5mm fail on a 0.4mm nozzle). Replaced by count-coded grooves
// below: 1 groove = Prev, 2 = Select, 3 = Next. Real braille lives on the resin nav caps.
module nav_count_grooves() {
    // Vertical grooves engraved into the front wall ~9mm below each nav hole.
    // Each groove: 1.2mm wide × 1mm deep × 6mm tall, 3mm apart — bold enough to
    // print cleanly and feel distinctly even through PETG layer texture.
    groove_z = nav_z - 12;   // groove bottom; clears the 8mm cap flange above
    counts = [1, 2, 3];      // Prev / Select / Next
    for(i = [0 : 2]) {
        n = counts[i];
        for(g = [0 : n - 1]) {
            gx = nav_x_positions[i] + (g - (n - 1) / 2) * 3;
            translate([gx - 0.6, -pod_width/2 - 0.01, groove_z])
                cube([1.2, 1.01, 6]);
        }
    }
}

// USB-cutout sacrificial bridge REMOVED (v7.4) — the cutout is a 10mm span, which any
// slicer bridges unaided. See the note in outer_box.scad. Do not add it back.

module lid_screw_bosses() {
    // 2× bosses on shell top rim for M2 lid screws (F14 fix)
    for(sx = [-1, 1]) {
        translate([sx * lid_screw_x, 0, shell_h - 8])
            difference() {
                cylinder(d=lid_boss_d, h=8, $fn=30);
                translate([0, 0, -1])
                    cylinder(d=lid_boss_tap, h=10, $fn=20);
                // brass insert bore at the TOP, where the lid screw enters
                translate([0, 0, 8 - insert_m2_depth])
                    cylinder(d=insert_m2_dia, h=insert_m2_depth + 1, $fn=30);
            }
    }
}

// --- MAIN SHELL MODULE ---

module esp32_pod_shell() {
    union() {
        difference() {
            pod_rounded_box(pod_length, pod_width, shell_h, pod_fillet);

            shell_internal_cavity();
            usb_cutout();
            rear_harness_cutout();
            nav_button_holes();
            dock_receiver_cutout();
            magnet_pockets();
            // antenna_grille(); // removed: overlapped pogo recess, leaving 0.5mm skin
            nav_count_grooves();  // 1/2/3 grooves under Prev/Select/Next (v6.1)
        }

        // Positive interior features
        header_socket_decks();
        switch_cages();       // v6.1b: real switch retention (old nibs were floating)
        wire_tie_post(power_tie_x, power_tie_y);
        wire_tie_post(0, 26);  // direct-GPIO rear harness strain relief
        // v6.2: lid_locating_lip() REMOVED — the new over-cap lid locates with an outer
        // ±Y skirt, so the inner lip is redundant and would foul the skirt. Module kept
        // below (unused) for reference.
        lid_screw_bosses();
    }
}

// --- RENDER ---
esp32_pod_shell();
