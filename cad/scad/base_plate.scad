// =========================================================
// COMPONENT 03: BASE PLATE (28BYJ-48 OPTIMIZED)
// Revision 2.3 — Owned motor axes applied (M3=7.5, M8=34.7)
// Updated 2026-05-06
//
// Changes from v2.1:
//   - CRITICAL FIX (Audit 3.1): 28BYJ-48 shaft is offset 7.5mm from
//     motor body centre. Shaft stays at x=0 (cam centred). Motor body
//     pocket and ear holes now translated to x=-7.5mm.
//   - base_length widened from 50→56mm to accommodate left ear at
//     x=-24.85mm (ear centre = -7.5 - 34.7/2). Plate edge at
//     -28mm gives 0.35mm clearance past hole edge.
//   - Plate fits in new outer_box v4.0 internal_length (60mm):
//     56mm plate + 2mm clearance each side. ✓
// =========================================================

include <hall_interface.scad> // shared Hall geometry also includes mech_layout.scad
                             // MUST sit under the cam magnet, so both come from
                             // the one shared file. They used to be declared in
                             // two places and had drifted (cam r=17.35 vs plate y=20).

// --- 1. PARAMETERS ---

// Plate body — centred over motor shaft (box centre x=0)
// v7.5: 56 -> 58. Two defects, one change:
//   1. The left motor ear hole (x=-25.5, dia 4.3) reached x=-27.65 against a plate
//      edge at -28. A 0.35mm wall on a 0.4mm nozzle is not a wall — the screw
//      breaks out. At base_length 58 the edge is -29, giving a 1.35mm wall.
//   2. The corner standoffs (x=+/-26, dia 6) spanned to x=29 and hung 1mm off a
//      plate that ended at 28. Now flush.
// 58 still clears the box: internal_length is 60, so 1.0mm per side.
// base_length, base_width, cam_pocket_* , standoff_* and comb_peg_xy now come
// from mech_layout.scad. They are shared with the comb and the top plate, and
// keeping private copies here is what let the comb drift.
assert(!is_undef(base_length) && !is_undef(base_width)
       && !is_undef(cam_pocket_diameter) && !is_undef(standoff_x),
       "base_plate needs the shared footprint from mech_layout.scad");
base_thickness  = 5;       // Z

// Cam Interface (matches braille_cam.scad). Declared before the motor pilot
// calculation because OpenSCAD `use` callers evaluate these bindings eagerly.
// (cam_pocket_diameter and cam_pocket_depth come from mech_layout.scad)

// Motor Interface — CORRECTED for actual 28BYJ-48 measurements
// Owned values: can Ø28.1, shaft offset 7.5, ear spacing 34.7; seat Ø29 retains 0.45mm/side
shaft_clearance      = 10;     // Ø9mm cam hub + 0.5mm clearance each side
motor_body_diameter  = 29;     // 28mm + 1mm tolerance (was 28.3mm — wrong)
motor_seat_depth     = 1.5;    // Shallow pocket to locate motor body centrally
motor_mount_spacing  = 34.7;   // MEASURED M8: owned motor ear spacing

// v7.5: was a 4.3mm CLEARANCE hole, which needs a nut on the far side. There is
// nowhere to put that nut. The right-hand ear is at x = -7.5 + 34.7/2 = +9.85, which is
// inside the cam pocket (r=23), so a nut or bolt head there sits directly under the
// spinning cam disc. Changed to a thread-forming PILOT: the M4 screw goes UP from
// below, through the motor's own ear, and forms its own thread in the plate. No nut,
// nothing protruding above the plate at all.
// Thread depth available: left ear (x=-24.85) is outside the cam pocket -> full 5mm.
//                         right ear (x=+9.85) is inside it -> 2mm (plate below pocket).
// 2mm of formed M4 thread in PETG holds far more than a 35g motor needs.
// FASTENER GATE: never use the previously documented M4x10. Under Option A the
// raised cam underside is z=47; with the ~0.8mm ear, M4x5 or M4x6 is the safe
// candidate range. Measure the real ear and screw point, then use the shortest
// coupon-proven screw that fully engages the through pilot and stays >=0.5mm below
// the cam. The current production stack remains HOLD.
motor_mount_pilot    = 3.3;    // M4 thread-forming pilot (drill to 3.4 if it binds)
// 2026-08-26: THESE NO LONGER LINE UP WITH THE MOTOR.
// The motor dropped 4mm when the mid-plate went, so its ears are now at z=37 while
// this plate's underside is at z=41. The pilots below are 4mm away from the ears.
//
// That is deliberate and not yet a defect, because the mount no longer relies on
// them: every force in the mechanism points DOWN, so the cup's seat carries the
// load and the wire block in its notch carries the torque. Screws were retention,
// not structure.
//
// If retention screws are wanted back, they need 4mm-tall bosses on this plate's
// underside - which print in mid-air unless the plate is run upside down. Decide
// that with the R-07 pass, not before.
motor_mount_pilot_depth = stack_option_a ? base_thickness + 0.1
                                         : base_thickness - cam_pocket_depth;

// Standoffs — CRITICAL FIX: was 3.5mm, now 8mm
// Stack above plate: 8mm standoff + 3mm top plate = 11mm
// Linkage total height = 12mm, foot on cam bump (0.2mm below plate top) → nub at +0.8mm
// (standoff_diameter comes from mech_layout.scad)
standoff_height   = 8 + stack_repair_raise;
// Option A raises the cam/linkage/top datums together by 4mm while the motor and
// base underside stay fixed. The top plate underside therefore moves from local
// z=13 to z=17, requiring 12mm posts instead of 8mm.
// (standoff_x, standoff_y come from mech_layout.scad)

// --- SPRING CAVITY: DELETED IN v7.5. DO NOT ADD IT BACK. ---
// It was a 22 x 16mm through-window at the plate centre, left over from the v6.x
// design where the return springs pushed on the middle of each linkage arm.
// Since v7.1 the springs live coaxially with each dot, in the TOP PLATE. Nothing
// passes through the centre of the base plate any more.
// Meanwhile the window was actively harmful: it spanned x = -11..+11, and the right
// motor mounting hole is at x = +9.5. The screw opened into thin air, so the motor
// could only ever be held by ONE ear. A single-screw stepper rocks and loses steps.
// Deleting the window restores that material, stiffens the plate, and costs nothing.

// --- HALL EFFECT SENSOR — REBUILT FROM SCRATCH IN v7.5 ---
// The old pocket DID NOT EXIST on the printed part. It was cut from
// z = base_thickness - 3 = 2 upward, at (0, 20). The cam pocket is also cut from
// z = 2 upward, with radius 23 — and the hall pocket's farthest corner was at
// radius 22.31. It sat entirely inside the cam pocket, at exactly the same depth,
// so subtracting it removed nothing at all. There was also zero vertical space
// above it: the cam disc's underside rests on that same floor.
//
// NEW DESIGN: the pocket is cut into the plate's UNDERSIDE instead, directly
// beneath the magnet path, leaving a thin membrane between sensor and cam.
//   - sensor sits at (0, homing_mag_r) = directly under the magnet, not 2.65mm
//     off to one side as before. Better coupling, not worse.
//   - clear of the motor: the can (dia 29 at x=-8) reaches only y = +/-12.1 at x=0.
//   - clear of the plate edge: y max ~19 against a 25mm edge.
//   - the leads route out through an underside channel to the +Y edge, and drop
//     through the mid_plate's existing +Y notch. That notch is already there and
//     already labelled "hall sensor wires from base plate".
//
// >>> THIS IS FOR THE BARE TO-92 SENSOR, NOT THE BLUE MH-SERIES MODULE. <<<
// The module's PCB is ~15 x 11mm plus an 8-11mm header. Nothing that size fits in
// a 5mm plate underneath a cam. Desolder the 3-legged black sensor off the module
// and run three wires back to it (or straight to the ESP32). See docs.
// Legacy: sensor face sits 0.4mm below the cam-pocket floor.
// Option A: the cam underside is local z=6.0. A 0.5mm island reaches z=5.5,
// leaving 0.5mm mechanical running clearance; its 0.4mm roof puts the sensor
// face 0.9mm from the flush magnet. This is still a physical Hall-test gate.
option_a_cam_under_local = 2 + stack_repair_raise;
hall_island_h = hall_island_height(stack_repair_raise, base_thickness);
hall_pocket_h = hall_pocket_height(stack_repair_raise, base_thickness);

// v6.1b: underside ribs REMOVED. Two reasons (both confirmed on the fit-test print):
//  1. Printing flat put the ribs on the bed and BRIDGED the whole plate body over
//     3mm of air → exposed-waffle underside, weak part.
//  2. The ribs crossed the box corner-boss positions (±26,±21), so the plate sat on
//     its ribs 3mm too high — the whole motor/cam/top-plate stack would rise 3mm and
//     the top plate would poke above the box rim. A solid 5mm plate is stiff enough.

$fn = 80;

// --- 2. MODULES ---

module main_body() {
    translate([-base_length/2, -base_width/2, 0])
        cube([base_length, base_width, base_thickness]);
}

// Motor body offset: shaft is NOT at body centre on the 28BYJ-48
// Shaft stays at x=0 (cam must be centred). Body centre at measured x=-7.5mm.
motor_body_x_offset = -7.5;   // MEASURED M3: shaft-to-can centre offset

module motor_features() {
    // 1. Shaft clearance through-hole — STAYS at x=0 (cam disc centred here)
    cylinder(d=shaft_clearance, h=20, center=true);

    // 2. Motor body seating pocket — measured offset -7.5mm (body centre ≠ shaft centre)
    translate([motor_body_x_offset, 0, -0.1])
        cylinder(d=motor_body_diameter, h=motor_seat_depth + 0.1);

    // 3. Motor mounting ear pilots — same measured offset (ears fixed to body)
    //    Left ear:  x = -7.5 - 34.7/2 = -24.85mm  (outside cam pocket → 5mm of thread)
    //    Right ear: x = -7.5 + 34.7/2 = +9.85mm   (inside cam pocket  → 2mm of thread)
    // Blind from BELOW so nothing breaks the cam-pocket floor at the left ear and
    // nothing protrudes above the plate at the right ear. The right pilot does open
    // into the cam pocket (only 2mm of material there) — harmless, because the
    // tracks start at r=12 and no linkage foot ever travels over r=9.5.
    for(sx = [-1, 1]) {
        translate([sx * (motor_mount_spacing / 2) + motor_body_x_offset, 0, -0.1])
            cylinder(d=motor_mount_pilot, h=motor_mount_pilot_depth + 0.1);
    }
}

module cam_features() {
    if (!stack_option_a) {
        // Legacy cam disc pocket (from top face, 3mm deep).
        translate([0, 0, base_thickness - cam_pocket_depth])
            cylinder(d=cam_pocket_diameter, h=cam_pocket_depth + 1);
    }
}

// M11b equals the available 1.6mm recess exactly. This passes the geometric guard,
// but leaves zero print tolerance: dry-fit and lightly clean/sand the pocket before
// gluing. Do not deepen it without re-checking the remaining hall_floor_t.
assert(hall_pocket_h >= hall_body_t,
       "Hall sensor is thicker than the base plate can recess it. Either reduce \
hall_floor_t, or move the sensor outboard of the cam pocket and re-site the magnet.");

assert(!stack_option_a || hall_island_h >= 0.5,
       "Option A Hall island is too low to preserve a printable roof and cam gap");

// --- COMB LOCATING PEGS (v8.2) ---
// linkage_comb.scad drops over these four pegs. They stop it turning; the
// spigot on its underside, which sits in the cam pocket, centres it.
//
// Position: comb_peg_xy from mech_layout.scad. At (+/-19, +/-19) they are at
// r=26.9, clear of the Ø50 cam pocket and 7.3mm from the corner standoffs at
// (26, 21). They rise from the
// plate's top face into a 2.2mm hole in a comb 2.3mm thick, so 2.0mm of peg
// is full engagement without bottoming out.
// (comb_peg_xy comes from mech_layout.scad)
comb_peg_d      = 2.0;      // 0.2mm clearance in the comb's 2.2mm hole
comb_peg_h      = 2.0;

assert(comb_peg_xy * sqrt(2) > cam_pocket_diameter / 2 + 1,
       "comb pegs fall inside the cam pocket");
assert(norm([standoff_x - comb_peg_xy, standoff_y - comb_peg_xy])
       > (standoff_diameter + comb_peg_d) / 2 + 0.5,
       "comb pegs clash with the corner standoffs");

module comb_pegs() {
    for (sx = [-1, 1], sy = [-1, 1])
        translate([sx * comb_peg_xy, sy * comb_peg_xy, base_thickness - 0.01])
            cylinder(d = comb_peg_d, h = comb_peg_h + 0.01, $fn = 24);
}

module standoffs() {
    // 4 corner posts — support top plate 8mm above base plate top
    // M2.5 clearance thru-bore (Ø2.9) through standoff AND plate body
    // Bolt goes: top-plate counterbore → standoff → plate → into box boss tap
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * standoff_x, sy * standoff_y, base_thickness]) {
            difference() {
                cylinder(d=standoff_diameter, h=standoff_height);
                translate([0, 0, -base_thickness - 1])
                    cylinder(d=2.9, h=standoff_height + base_thickness + 2);
            }
        }
    }
}

// --- 3. ASSEMBLY ---

module base_plate() {
    union() {
        difference() {
            union() {
                main_body();
                hall_sensor_island(stack_repair_raise, base_thickness);
            }
            motor_features();
            cam_features();
            hall_sensor_pocket(stack_repair_raise, base_thickness, base_width);
        }
        standoffs();
        comb_pegs();
    }
}

base_plate();
