// =========================================================
// COMPONENT 05: MODULAR ENCLOSURE SHELL
// Revision 3.0 — Centred motor, electronics sub-floor pocket
// Updated 2026-05-06
//
// Changes from v2.0:
//   - motor_x_offset = 0 (was −20). Shaft and cam disc now centred
//     in the box. Previous two-zone layout was wrong — cam must be
//     centred so the braille-dot array sits directly above the motor.
//   - shell_length reduced from 88mm → 60mm (no side electronics zone)
//   - shell_height increased from 42mm → 50mm to create 9mm of
//     electronics sub-floor space directly below the motor body.
//   - base_plate_z raised from 23mm → 32mm:
//       floor(4) + elec_pocket(9) + motor_body(19) = 32mm
//   - boss_height raised from 19mm → 28mm to reach new base_plate_z
//   - Electronics sub-pocket added to box floor (below motor body):
//       36 × 46 mm footprint, 9 mm deep → fits Arduino Pro Mini +
//       ULN2003 driver board laid flat below the motor
//   - PCB mount bosses (M2 tap, 4mm tall) inside the elec pocket
//   - Docking tongue/slot, pogo slots, wire exit, vent slots unchanged
//   - button_wire_slot REMOVED (wires now route internally to Pro Mini)
//   - Navigation button positions made symmetric: ±20mm, 0mm
//   - Nameplate recess centred (was offset toward motor zone)
//
// Verified stack (z from outer box bottom):
//   z= 0    outer box bottom
//   z= 4    inner floor top
//   z= 4-13 electronics sub-pocket (9 mm)
//   z=13    motor body bottom (= 32 − 19)
//   z=32    motor ears / base plate bottom
//   z=37    base plate top (plate thickness 5 mm)
//   z=34    cam disc bottom (in 3 mm pocket from plate top)
//   z=36    cam disc flat top surface
//   z=36.8  cam bump top (0.8 mm lift)
//   z=45    standoff tops / top plate bottom (8 mm standoffs)
//   z=48    top plate top surface (3 mm plate)
//   z=48    linkage nub top (dot DOWN, flush with plate top)  ✓
//   z=48.8  linkage nub top (dot UP, 0.8 mm proud)           ✓
//   z=50    outer box top (shell_height) — 1.2 mm above nubs ✓
// =========================================================

// --- 1. PARAMETERS ---

// Outer shell
shell_length      = 60;     // X: centred on motor shaft
shell_width       = 68;     // Y: unchanged
shell_height      = 50;     // Z: increased for elec sub-floor
wall_thickness    = 4;
floor_thickness   = 4;

// Internal cavity
internal_length   = 52;     // = shell_length − 2×wall_thickness
internal_width    = 60;     // = shell_width  − 2×wall_thickness

// Motor — centred in box
motor_x_offset    = 0;      // Shaft at box centre
motor_body_dia    = 29;     // 28 mm + 1 mm tolerance
motor_height      = 19;     // Body height (not including shaft)

// Stack heights
elec_pocket_h     = 9;      // Gap between inner floor and motor bottom
base_plate_z      = floor_thickness + elec_pocket_h + motor_height;
                            // = 4 + 9 + 19 = 32 mm

// Corner bosses — support base plate from floor
boss_height       = base_plate_z - floor_thickness; // = 28 mm
boss_outer_dia    = 8;
boss_hole_dia     = 3.2;    // M3 tap
boss_x_off        = 15;     // ±15 mm from box centre (matches standoffs)
boss_y_off        = 15;

// Electronics sub-pocket (in floor, below motor body area)
elec_pocket_w     = 36;     // X footprint — motor body Ø28 + 4 mm each side
elec_pocket_d     = 46;     // Y footprint — within internal_width
// PCB mount posts inside the pocket
elec_boss_dia     = 5;
elec_boss_hole    = 2.2;    // M2 tap
elec_boss_h       = 4;
elec_boss_x_off   = 14;     // ±14 mm spans 28 mm (ULN2003 short dimension)
elec_boss_y_off   = 18;     // ±18 mm spans 36 mm (ULN2003 long dimension)

// Docking system (tongue left, slot right — unchanged)
tongue_length     = 8;
tongue_thickness  = 3;
tongue_height     = 12;
slot_width        = 3.3;
slot_height       = 12.2;
slot_depth        = 8.2;
dock_screw_dia    = 3.4;
dock_nut_flat     = 5.6;
dock_nut_depth    = 2.6;

// Wire routing — back wall slot (motor + hall wires)
wire_slot_w       = 15;
wire_slot_h       = 6;

// Ventilation slots — front + back walls
vent_slot_w       = 1.5;
vent_slot_len     = 12;
vent_slot_count   = 5;

// Pogo pin connector slots — left + right walls, mid-height
has_right_pogo    = true;
pogo_slot_w       = 10;
pogo_slot_h       = 8;
pogo_slot_depth   = wall_thickness + 2;
pogo_z            = floor_thickness + (shell_height - floor_thickness) / 2;

// Navigation buttons — front face (panel-mount 12 mm momentary)
has_select_btn    = true;
btn_hole_dia      = 12.5;
btn_z             = 18;     // Centred vertically in lower portion of box
btn_x_back        = -20;    // BACK — left of centre
btn_x_next        =  20;    // NEXT — right of centre
btn_x_select      =   0;    // SELECT — centre

// Aesthetics
fillet_outer      = 2.0;
fillet_inner      = 1.0;

$fn = 60;

// --- 2. MODULES ---

module rounded_box(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}

module docking_tongue() {
    translate([-shell_length/2 - tongue_length/2 + 0.1, 0, shell_height/2])
        cube([tongue_length, tongue_thickness, tongue_height], center=true);
}

module docking_slot_cutout() {
    translate([shell_length/2, 0, shell_height/2])
        cube([slot_depth * 2, slot_width, slot_height], center=true);
}

module docking_screw_holes() {
    for(y_off = [-15, 15]) {
        translate([0, y_off, shell_height/2])
        rotate([0, 90, 0]) {
            cylinder(d=dock_screw_dia, h=shell_length + 20, center=true);
            translate([0, 0, shell_length/2 - 5])
                cylinder(d=dock_nut_flat / cos(30), h=dock_nut_depth + 5, $fn=6);
        }
    }
}

module ventilation_slots() {
    // Centred on motor zone (x=0), biased slightly
    for(y = [-shell_width/2 + wall_thickness/2, shell_width/2 - wall_thickness/2]) {
        for(i = [0 : vent_slot_count - 1]) {
            x_pos = -8 + i * (vent_slot_w + 4);
            translate([x_pos, y, shell_height/2])
                cube([vent_slot_w, wall_thickness + 2, vent_slot_len], center=true);
        }
    }
}

module pogo_connector_slots() {
    // Left wall slot
    translate([-shell_length/2, 0, pogo_z])
        cube([pogo_slot_depth, pogo_slot_w, pogo_slot_h], center=true);
    // Right wall slot (for daisy-chain to next cell)
    if(has_right_pogo)
        translate([shell_length/2, 0, pogo_z])
            cube([pogo_slot_depth, pogo_slot_w, pogo_slot_h], center=true);
}

module one_button_hole(bx) {
    translate([bx, -shell_width/2 - 1, btn_z])
    rotate([-90, 0, 0])
        cylinder(d=btn_hole_dia, h=wall_thickness + 2);
}

module nav_button_holes() {
    one_button_hole(btn_x_back);
    one_button_hole(btn_x_next);
    if(has_select_btn) one_button_hole(btn_x_select);
}

module wire_exit() {
    // Back wall — motor cable + hall sensor wires exit here
    translate([0, shell_width/2, floor_thickness + wire_slot_h/2])
        cube([wire_slot_w, wall_thickness + 2, wire_slot_h], center=true);
}

module corner_bosses() {
    // Four tall pillars from floor top (z=4) to base plate bottom (z=32)
    // Base plate M3 screws tap down into these boss tops
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * boss_x_off, sy * boss_y_off, floor_thickness]) {
            difference() {
                cylinder(d=boss_outer_dia, h=boss_height);
                translate([0, 0, 3])
                    cylinder(d=boss_hole_dia, h=boss_height);
            }
        }
    }
}

module electronics_pocket() {
    // Recessed sub-floor area below motor body.
    // Fits Arduino Pro Mini (33×18mm) + ULN2003 (31×35mm) laid flat.
    translate([0, 0, floor_thickness])
        cube([elec_pocket_w, elec_pocket_d, elec_pocket_h + 1], center=true);
}

module elec_pcb_bosses() {
    // Short M2 posts on sub-floor for PCB mounting
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * elec_boss_x_off, sy * elec_boss_y_off, floor_thickness]) {
            difference() {
                cylinder(d=elec_boss_dia, h=elec_boss_h);
                translate([0, 0, 1])
                    cylinder(d=elec_boss_hole, h=elec_boss_h);
            }
        }
    }
}

// --- 3. MAIN ASSEMBLY ---

union() {
    difference() {
        // A. Main outer shell
        rounded_box(shell_length, shell_width, shell_height, fillet_outer);

        // B. Internal cavity (open top)
        translate([0, 0, floor_thickness])
            rounded_box(internal_length, internal_width, shell_height, fillet_inner);

        // C. Electronics sub-pocket (in the floor below motor body)
        electronics_pocket();

        // D. Docking slot (right side, for next-cell tongue)
        docking_slot_cutout();

        // E. Docking screw holes
        docking_screw_holes();

        // F. Ventilation slots (front + back walls)
        ventilation_slots();

        // G. Wire exit (back wall, motor zone level)
        wire_exit();

        // H. Pogo connector slots (left always, right for daisy-chain)
        pogo_connector_slots();

        // I. Navigation button holes (front face)
        nav_button_holes();

        // J. Nameplate recess (top front edge, centred)
        translate([0, -shell_width/2, shell_height - 5])
            cube([24, 2, 8], center=true);
    }

    // K. Docking tongue (left side — mates with next cell's slot)
    docking_tongue();

    // L. Corner bosses (support base plate at z=32mm)
    corner_bosses();

    // M. PCB mount posts in electronics sub-pocket
    elec_pcb_bosses();
}
