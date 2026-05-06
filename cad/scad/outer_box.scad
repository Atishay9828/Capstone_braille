// =========================================================
// COMPONENT 05: MODULAR ENCLOSURE SHELL
// Revision 4.0 — Full Audit Redesign
// Updated 2026-05-06
//
// Changes from v3.0:
//   - elec_pocket_h: 9mm → 16mm (ULN2003 JST connectors 12-14mm tall)
//   - shell_height: 50mm → 57mm (new stack)
//   - shell_length: 60mm → 68mm (motor body offset -8mm needs wider cavity)
//   - internal_length: 52mm → 60mm
//   - base_plate_z: 32mm → 41mm (floor 4 + elec 16 + midplate 2 + motor 19)
//   - boss_height: 28mm → 37mm
//   - NEW: 2mm solid mid-plate sealing electronics from motor cavity
//   - NEW: Motor retaining collar on mid-plate (Ø29.5mm inner, 8mm tall)
//         Collar centred at x=-8 (motor body offset from shaft)
//   - NEW: Wire gutters along floor edges for pogo/I2C wire routing
//   - NEW: Pogo pad recess (1mm deep) on left wall — audit 6.2
//   - NEW: Magnetic snap alignment — replaces dock screws (audit 6.3)
//         3 × Ø3.2mm × 2.1mm NeFeB pockets on tongue + slot faces
//   - REMOVED: docking_screw_holes() — replaced by magnets
//   - REMOVED: dock_screw_dia, dock_nut_flat, dock_nut_depth params
//
// Verified stack (z from outer box bottom):
//   z= 0      outer box bottom
//   z= 4      inner floor top
//   z= 4–20   electronics sub-pocket (16 mm)
//   z= 20–22  2 mm mid-plate (seals electronics)
//   z= 22     motor body bottom (sits in collar on mid-plate)
//   z= 30     motor collar top (22 + 8mm collar height)
//   z= 41     motor ears / base plate bottom
//   z= 46     base plate top (plate = 5 mm)
//   z= 43     cam disc bottom (in 3mm pocket from plate top)
//   z= 45     cam disc flat top surface
//   z= 45.8   cam bump top (0.8 mm lift)
//   z= 54     standoffs top / top plate bottom (8 mm standoffs)
//   z= 57     top plate top = box top (4mm plate)
//   z= 57     linkage nub flush (dot DOWN)  ✓
//   z= 57.8   linkage nub 0.8mm proud (dot UP) ✓
// =========================================================

// --- 1. PARAMETERS ---

// Outer shell
shell_length      = 68;     // X: widened for motor body offset (was 60)
shell_width       = 68;     // Y: unchanged
shell_height      = 57;     // Z: increased for deeper elec pocket + mid-plate (was 50)
wall_thickness    = 4;
floor_thickness   = 4;

// Internal cavity
internal_length   = 60;     // = shell_length − 2×wall_thickness (was 52)
internal_width    = 60;     // = shell_width  − 2×wall_thickness

// Motor — shaft centred in box, BODY offset -8mm
motor_x_offset    = -8;     // Body centre is 8mm left of shaft/box centre
motor_body_dia    = 29;     // 28 mm + 1 mm tolerance
motor_height      = 19;     // Body height (not including shaft)

// Stack heights
elec_pocket_h     = 16;     // Gap between inner floor and mid-plate (was 9)
mid_plate_h       = 2;      // Solid plate sealing electronics from motor
base_plate_z      = floor_thickness + elec_pocket_h + mid_plate_h + motor_height;
                            // = 4 + 16 + 2 + 19 = 41 mm

// Motor retaining collar (sits on mid-plate, grips lower half of motor body)
motor_collar_h    = 8;      // Grips lower 40% of motor
motor_collar_wall = 2.5;    // Wall thickness
motor_collar_id   = motor_body_dia + 0.5;  // 29.5mm — 0.5mm clearance
motor_collar_od   = motor_collar_id + 2 * motor_collar_wall; // 34.5mm

// Corner bosses — support base plate from floor
boss_height       = base_plate_z - floor_thickness; // = 37 mm (was 28)
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

// Docking system — tongue left, slot right (screws REMOVED — magnets replace)
tongue_length     = 8;
tongue_thickness  = 3;
tongue_height     = 12;
slot_width        = 3.3;
slot_height       = 12.2;
slot_depth        = 8.2;

// Magnetic snap alignment (replaces dock screws — audit 6.3)
magnet_pocket_dia   = 3.2;   // Press-fit for 3mm NeFeB disc
magnet_pocket_depth = 2.1;   // 2mm magnet + 0.1mm clearance
magnet_y_positions  = [-12, 0, 12]; // 3 magnets per face
magnet_z            = shell_height / 2;  // Centred vertically

// Wire routing — back wall slot (motor + hall wires)
wire_slot_w       = 15;
wire_slot_h       = 6;

// Wire gutters along floor edges (internal routing for pogo/I2C wires)
gutter_w          = 4;
gutter_h          = 4;

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
pogo_pad_recess   = 1;      // Extra 1mm recess on LEFT wall for pad targets (audit 6.2)

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

// Magnet pockets on tongue face (left wall, -X)
module tongue_magnet_pockets() {
    for(my = magnet_y_positions) {
        translate([-shell_length/2 - tongue_length + 1, my, magnet_z])
        rotate([0, 90, 0])
            cylinder(d=magnet_pocket_dia, h=magnet_pocket_depth, $fn=30);
    }
}

// Magnet pockets on slot face (right wall, +X)
module slot_magnet_pockets() {
    for(my = magnet_y_positions) {
        translate([shell_length/2 - 1, my, magnet_z])
        rotate([0, -90, 0])
            cylinder(d=magnet_pocket_dia, h=magnet_pocket_depth, $fn=30);
    }
}

module ventilation_slots() {
    for(y = [-shell_width/2 + wall_thickness/2, shell_width/2 - wall_thickness/2]) {
        for(i = [0 : vent_slot_count - 1]) {
            x_pos = -8 + i * (vent_slot_w + 4);
            translate([x_pos, y, shell_height/2])
                cube([vent_slot_w, wall_thickness + 2, vent_slot_len], center=true);
        }
    }
}

module pogo_connector_slots() {
    // Left wall slot — 1mm deeper recess for pad targets (audit 6.2)
    translate([-shell_length/2, 0, pogo_z])
        cube([pogo_slot_depth + pogo_pad_recess, pogo_slot_w, pogo_slot_h], center=true);
    // Right wall slot (for daisy-chain to next cell — spring pins)
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
    // Four tall pillars from floor top (z=4) to base plate bottom (z=41)
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
    // Recessed sub-floor area below motor body — 16mm deep (was 9mm)
    // Fits ULN2003 + MCP23017 custom Muscle PCB with JST connectors (12-14mm tall)
    translate([0, 0, floor_thickness + elec_pocket_h/2])
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

// --- NEW v4.0 MODULES ---

module mid_plate() {
    // 2mm solid plate at z=20-22 — seals electronics from motor cavity
    translate([0, 0, floor_thickness + elec_pocket_h])
        cube([internal_length, internal_width, mid_plate_h], center=true);
}

module motor_collar() {
    // Raised collar on mid-plate — grips lower 8mm of motor body
    // Absorbs rotational torque so plastic mounting ears don't warp
    // Centred at motor body x=-8 (offset from shaft)
    translate([motor_x_offset, 0, floor_thickness + elec_pocket_h + mid_plate_h])
    difference() {
        cylinder(d=motor_collar_od, h=motor_collar_h, $fn=60);
        translate([0, 0, -0.5])
            cylinder(d=motor_collar_id, h=motor_collar_h + 1, $fn=60);
    }
}

module wire_gutters() {
    // Channels along ±Y floor edges — route pogo/I2C wires cleanly
    // Prevents pinched wires when base plate is installed (audit 6.8)
    for(sy = [-1, 1]) {
        translate([0, sy * (internal_width/2 - gutter_w/2), floor_thickness + gutter_h/2])
            cube([internal_length - 10, gutter_w, gutter_h], center=true);
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

        // E. Magnet pockets — tongue face (left) + slot face (right)
        tongue_magnet_pockets();
        slot_magnet_pockets();

        // F. Ventilation slots (front + back walls)
        ventilation_slots();

        // G. Wire exit (back wall, motor zone level)
        wire_exit();

        // H. Pogo connector slots (left with extra recess, right for daisy-chain)
        pogo_connector_slots();

        // I. Navigation button holes (front face)
        nav_button_holes();

        // J. Nameplate recess (top front edge, centred)
        translate([0, -shell_width/2, shell_height - 5])
            cube([24, 2, 8], center=true);

        // K. Wire gutters (subtracted from floor edges)
        wire_gutters();
    }

    // L. Docking tongue (left side — mates with next cell's slot)
    docking_tongue();

    // M. Corner bosses (support base plate at z=41mm)
    corner_bosses();

    // N. PCB mount posts in electronics sub-pocket
    elec_pcb_bosses();

    // O. 2mm mid-plate (seals electronics from motor cavity)
    mid_plate();

    // P. Motor retaining collar (on mid-plate)
    motor_collar();
}
