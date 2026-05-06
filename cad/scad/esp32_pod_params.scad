// =========================================================
// ESP32 BRAIN POD — Shared Parameters & Base Modules
// Include this file in all pod part files.
//
// include <esp32_pod_params.scad>
// =========================================================

// --- POD SHELL DIMENSIONS ---
pod_length       = 74;     // X — long axis (USB end to pogo/dock end)
pod_width        = 38;     // Y — wide enough for magnet pockets at ±12mm
pod_height       = 58;     // Z — pogo centroid at z=30.5mm from bottom ✓
pod_wall         = 4;      // Wall thickness (floor, sides)
pod_floor        = 3;      // Floor thickness (thinner than walls — bosses add rigidity)
pod_fillet       = 2.0;    // Outer corner radius

// Lid thickness matches wall thickness for visual symmetry
lid_h            = pod_wall;   // = 4mm

// Internal cavity dimensions (used by shell AND referenced by lid lip)
pod_int_length   = pod_length - 2 * pod_wall;  // 66mm
pod_int_width    = pod_width  - 2 * pod_wall;  // 30mm (PCB=29mm, 0.5mm clearance/side)

// --- PCB MOUNTING (esp32_pod_shell.scad) ---
// ESP32 NodeMCU 30-pin: 51×29mm body, 12mm component height
pcb_boss_x_off   = 23;    // ±23mm → 46mm span (51mm PCB, 2.5mm inset each end)
pcb_boss_y_off   = 11;    // ±11mm → 22mm span (29mm PCB, 3.5mm inset each side)
pcb_boss_dia     = 4;     // Boss OD
pcb_boss_h       = 4;     // Boss height (PCB sits 4mm above floor)
pcb_boss_hole    = 2.2;   // M2 self-tap

// --- BARREL JACK (esp32_pod_lid.scad) ---
barrel_jack_dia  = 11.5;  // Standard 5.5/2.1mm panel-mount jack
barrel_jack_x    = -10;   // Offset toward USB end (-X), centred in Y

// --- USB CUTOUT (esp32_pod_shell.scad) ---
// Micro-USB programming port on LEFT face (-X end)
usb_w            = 9;
usb_h            = 5;
usb_z            = pod_floor + pcb_boss_h + 1;  // Aligns with PCB USB port

// --- POGO INTERFACE (esp32_pod_shell.scad) ---
// RIGHT face (+X), matches outer_box left-wall pogo slot
// cell pogo_z = floor(4) + (57-4)/2 = 30.5mm — must match pogo_z_from_bot
pogo_pad_w       = 10;    // = outer_box pogo_slot_w
pogo_pad_h       = 8;     // = outer_box pogo_slot_h
pogo_pad_recess  = 1;     // 1mm deep recess (audit 6.2 — prevents shorting)
pogo_z_from_bot  = 30.5;  // Must match cell pogo_z exactly ✓

// --- DOCKING SLOT (esp32_pod_shell.scad) ---
// RIGHT face — receives cell 1's tongue
dock_slot_w      = 3.3;
dock_slot_h      = 12.2;
dock_slot_depth  = 8.2;

// --- MAGNET POCKETS (esp32_pod_shell.scad) ---
// RIGHT face — 3× NeFeB disc press-fit, same ±12,0 pattern as outer_box (audit 6.3)
mag_dia          = 3.2;   // Press-fit for 3mm NeFeB
mag_depth        = 2.1;   // 2mm disc + 0.1mm
mag_y_positions  = [-12, 0, 12];
mag_z            = pod_height / 2;   // Centred vertically on RIGHT face

// --- WIFI ANTENNA GRILLE (esp32_pod_shell.scad) ---
// RIGHT end wall thinned to antenna_wall, slots cut for radiation
antenna_wall     = 1.5;
antenna_slot_w   = 2;
antenna_slot_h   = 8;
antenna_slot_count = 3;

// --- WIRE TIE POST (esp32_pod_shell.scad) ---
tie_post_dia     = 4;
tie_post_h       = 10;
tie_post_hole    = 2;

$fn = 60;

// --- SHARED BASE MODULE ---

module pod_rounded_box(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}
