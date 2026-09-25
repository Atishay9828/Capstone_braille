// =========================================================
// BRAILLE CELL TOP PLATE — v3.0
// Updated 2026-05-06
//
// Changes from v2.1 (Full Audit Redesign):
//   - plate_size 34x34mm -> plate_length=52mm x plate_width=60mm (rectangular)
//     Now fully covers outer_box internal cavity (52x60mm). No gaps. (Audit 3.2)
//   - Rectangular 1.2x3mm slots -> round 2mm holes (Audit Fix 5)
//     Round holes prevent dust funnelling into cam mechanism
//     Holes sized for braille_cap pin shaft (1.9mm dia + 0.1mm clearance)
//   - Spring pockets RE-INTRODUCED on underside (Audit 4.2)
//     3.5mm dia x 3mm deep concentric pockets around each braille hole
//     Retains 3mm compression springs that push linkages DOWN (gravity alone
//     is insufficient for 1mm sheet metal in tight slots)
//   - plate_thickness 3mm -> 4mm (need 3mm pocket + 1mm floor above)
//   - Slots replaced by round holes — slot chamfers removed
//   - Thumb ridge kept for blind user orientation
// =========================================================

// =========================================================
// v7.2 (2026-07-29) — THIS PART IS NOW PLAIN FDM/PETG
//
// The precision features (six 1.7mm dot holes, six 2.2mm spring bores with
// 0.4mm dividing walls) moved OUT of this plate and into dot_insert.scad,
// a small resin tile that glues into a pocket in the middle. Reason: this
// plate is 68x70mm and was ~80% of the resin bill, but only that tiny
// central area actually needs resin precision. Resin drops ~20 -> ~5 cm3
// and this becomes an ordinary PETG print.
//
// What is left here is all FDM-friendly: an 11.2mm square opening and a
// 15.2mm rebate whose floor is the glue shelf for the insert.
// =========================================================

// =========================================================
// v7.1 (2026-07-26) — RETURN SPRING IS COAXIAL WITH EACH DOT
//
// History, so nobody re-treads it:
//   pre-v7  4.5mm pockets concentric with each dot. Never worked — braille
//           rows are 2.6mm apart, so the three pockets in a column merged
//           into one slot. There were never six pockets, only two blobs.
//   v7.0    moved the spring OFF the dot onto a pad mid-arm. Geometrically
//           fine, but physically wrong: the return force belongs on the dot.
//   v7.1    back on the dot axis, and made to actually fit by shrinking the
//           spring to a 2mm OD micro spring and the nub to 1.0mm. The dot
//           drops to 1.5mm, which is the REAL braille standard (1.44-1.6mm).
//
// The spring sits in a counterbore here in the plate underside, wraps around
// the dot, and pushes down on a flange on the linkage's upper riser. The dot
// travels up and down through the middle of it.
// =========================================================

include <mech_layout.scad>   // dot positions, arm geometry, spring seat positions

// --- 1. PARAMETERS ---

// Braille dot positions and arm geometry now come from mech_layout.scad
// (col_spacing, row_spacing, dot_pos(), spring_seat_pos()).

// Dot holes and spring bores now live in dot_insert.scad (resin).
// This plate only carries the pocket that tile glues into.

// Plate body — v6.2: now an OVER-CAP covering the full box footprint (was an inset plate).
// Underside at z=0, top at z=4.
//
// v8.1: FLUSH ON ALL FOUR SIDES (was 68 x 70 with a 1mm ±Y overhang + skirt).
// ±X had to stay flush because cells dock there on the pogo pins, so the lip only
// ever ran front/back — and its skirt stopped at x=±30, leaving a bare 1mm lip with
// a hard step at each corner. The skirt's only job was locating the cap, which the
// four M2.5 screws already do, so it was redundant as well as ugly. Square it off.
plate_length    = 68.0;   // X — flush with box outer (±34)
plate_width     = 68.0;   // Y — flush with box outer (±34)
plate_thickness = 4.0;    // Z — cap thickness (3mm spring pocket + 1mm floor)
corner_radius   = 3.0;    // matches box outer fillet
// finger_pad_depth comes from mech_layout.scad (the linkage height depends on it)

// v8.1: the ±Y over-cap skirt and its four parameters are gone. See the note on
// plate_width. The cap now sits flush on the box rim on all four sides.

// Mounting — 4 corner holes at ±26,±21 matching base_plate standoffs
// standoff_x / standoff_y come from mech_layout.scad - shared with the base
// plate and the comb, which all four corners have to agree on.
assert(!is_undef(standoff_x) && !is_undef(standoff_y),
       "top_plate needs standoff_x/standoff_y from mech_layout.scad");
screw_dia        = 3.2;   // v6.2: 2.8→3.2 M2.5 clearance for print tolerance
counterbore_dia  = 5.6;   // v6.2: 5.0→5.6 M2.5 button-head
counterbore_depth = 1.5 + finger_pad_depth; // 1.5mm below the recessed reading surface

$fn = 60;

// --- 2. MODULES ---

module rounded_rect(lx, ly, r, h) {
    hull() {
        translate([-lx/2 + r, -ly/2 + r, 0]) cylinder(r=r, h=h);
        translate([ lx/2 - r, -ly/2 + r, 0]) cylinder(r=r, h=h);
        translate([-lx/2 + r,  ly/2 - r, 0]) cylinder(r=r, h=h);
        translate([ lx/2 - r,  ly/2 - r, 0]) cylinder(r=r, h=h);
    }
}

// --- DOT INSERT POCKET (v7.2) ---
// A top-hat pocket for the resin dot tile:
//   * an 11.2mm square opening straight through the plate (the tile's body)
//   * a 15.2mm rebate in the recessed reading surface (the tile's flange)
// The rebate FLOOR is the GLUE SHELF: a 2mm-wide ledge all round, ~106mm2 of
// contact. Both features are easy on a 0.4mm nozzle, which is the whole point.
module insert_pocket() {
    body_op  = insert_body + insert_fit;      // 11.2
    flange_op = insert_flange + insert_fit;   // 15.2
    // through opening for the tile body
    translate([0, 0, -1])
        linear_extrude(plate_thickness + 2)
            square([body_op, body_op], center = true);
    // rebate for the flange — cut down from the recessed reading surface
    translate([0, 0, plate_thickness - finger_pad_depth - insert_flange_h])
        linear_extrude(insert_flange_h + finger_pad_depth + 1)
            square([flange_op, flange_op], center = true);
}

module mounting_holes() {
    for(sx = [-1,1]) for(sy = [-1,1]) {
        translate([sx * standoff_x, sy * standoff_y, 0]) {
            // Through hole
            translate([0, 0, -1])
                cylinder(d=screw_dia, h=plate_thickness + 5);
            // Counterbore on top face
            translate([0, 0, plate_thickness - counterbore_depth])
                cylinder(d=counterbore_dia, h=counterbore_depth + 1);
        }
    }
}

// --- 3. MAIN ASSEMBLY ---

difference() {
    union() {
        // A. Over-cap body — full box footprint (68×68), underside z=0, top z=4
        rounded_rect(plate_length, plate_width, corner_radius, plate_thickness);
    }

    // B. Finger pad recess (ergonomic boundary on top face)
    translate([0, 0, plate_thickness - finger_pad_depth])
        rounded_rect(plate_length - 6, plate_width - 6, corner_radius, finger_pad_depth + 1);

    // C. Pocket for the resin dot insert (dot_insert.scad)
    insert_pocket();

    // D. Mounting holes (4 corners, M2.5)
    mounting_holes();
}

// --- 4. TACTILE FEATURES ---

// Thumb ridge — bottom edge (closest to user's body, audit 5)
// Relocated from left edge: ergonomic resting position for standard orientation
translate([0, -plate_width/2 + 1.5, plate_thickness])
    hull() {
        translate([-4, 0, 0]) sphere(r=0.6, $fn=20);
        translate([ 4, 0, 0]) sphere(r=0.6, $fn=20);
    }

// --- 5. SPRING SPEC (for BOM / sourcing) ---
// OD:  2.0mm micro compression spring, 0.3mm stainless wire (STOCK SIZE)
// Free length: ~4mm (~5 coils; 1.5mm solid height, so it never bottoms out)
// A 4mm ballpoint-pen spring CANNOT be used — it needs ~4.2mm of row pitch
// and braille rows are 2.6mm apart. Buy an assortment kit so several sizes
// are on hand. See docs/SOURCING.md.
// OLD SPEC (do not use): 4.0mm pen spring on a mid-arm pad
// Spring constant: as soft as possible (<= 0.1 N/mm) — the 28BYJ-48 has to
//   compress all six at once, so stiff springs risk stalling the motor
// Working length: 3.0mm with the dot DOWN and 2.2mm with it UP. A 3.5-4.0mm
// free spring with <=1.5mm solid height stays preloaded without bottoming out.
// Fitting: twist the spring over the 1.5mm dome onto the linkage's coaxial
// 2.2mm flange, then place that assembly into the resin dot insert. The spring
// seats in the insert counterbore and pushes DOWN on the flange. Do not glue a
// spring to the PETG plate and do not use the rejected mid-arm pad arrangement.

// --- 6. MODULE WRAPPER (used by print_small_parts.scad) ---
module top_plate() {
    difference() {
        union() {
            rounded_rect(plate_length, plate_width, corner_radius, plate_thickness);
        }
        translate([0, 0, plate_thickness - finger_pad_depth])
            rounded_rect(plate_length - 6, plate_width - 6, corner_radius, finger_pad_depth + 1);
        insert_pocket();
        mounting_holes();
    }
    // Thumb ridge — bottom edge
    translate([0, -plate_width/2 + 1.5, plate_thickness])
        hull() {
            translate([-4, 0, 0]) sphere(r=0.6, $fn=20);
            translate([ 4, 0, 0]) sphere(r=0.6, $fn=20);
        }
}
