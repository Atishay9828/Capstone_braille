// =========================================================
// BRAILLE DOT INSERT — the only RESIN part of the top plate
// v7.2 — 2026-07-29
//
// WHY THIS EXISTS
// The top plate is 68x70mm and was about 80% of the whole resin bill
// (19.85 of 23.8 cm3). But almost all of it is plain flat structure that
// an FDM printer handles perfectly well. Only two features actually need
// resin precision:
//
//   * the six 1.7mm dot holes — the printed dome has to SLIDE freely
//     through these thousands of times. On a 0.4mm nozzle they come out
//     ~1.4-1.5mm and furry, and the dome would bind.
//   * the six 2.2mm spring bores — at 2.6mm braille row pitch only 0.4mm
//     of wall separates them, which is exactly ONE nozzle width on FDM.
//
// So those move into this small tile. The big plate becomes an ordinary
// PETG print and the resin order drops from ~20cm3 to ~5cm3.
//
// FORM: a top-hat. The 11mm body drops through the plate; the 15mm flange
// lands on a rebate machined into the plate's top face. That rebate floor
// is the GLUE SHELF — a 2mm-wide ledge all the way round, ~106mm2 of
// contact area, far more than a butt joint would give.
//
// FITTING
//   1. Run a thin bead of CA/epoxy around the rebate shelf in the plate.
//   2. Drop the insert in flange-down-onto-shelf; it self-locates.
//   3. Wipe squeeze-out from the top face BEFORE it cures — the dot holes
//      must stay clear or the domes will jam.
//   4. Insert top ends up flush with the plate's recessed reading surface.
//
// Material: TOUGH or ABS-like resin, same batch as the cam and linkages.
// Print flat, holes vertical. No supports needed.
// =========================================================

include <mech_layout.scad>

$fn = 60;

insert_body_h = insert_h - insert_flange_h;   // 2.0mm

// --- BODY + FLANGE (the top-hat blank) ---
module insert_blank() {
    // body: drops through the plate opening
    translate([-insert_body/2, -insert_body/2, 0])
        cube([insert_body, insert_body, insert_body_h]);
    // flange: lands on the plate's glue shelf
    translate([-insert_flange/2, -insert_flange/2, insert_body_h])
        cube([insert_flange, insert_flange, insert_flange_h]);
}

// --- 6 BRAILLE DOT HOLES (through) ---
// The printed dome on each linkage nub rises through these.
module dot_holes() {
    for (d = [1 : 6]) {
        p = dot_pos(d);
        translate([p[0], p[1], -1])
            cylinder(d = plate_hole_dia, h = insert_h + 2);
    }
}

// --- 6 RETURN-SPRING COUNTERBORES (from the underside) ---
// Coaxial with each dot. The 2mm spring is glued in here, wraps the dot,
// and pushes down on the flange on the linkage's upper riser.
// Only 0.4mm of wall survives between the three bores in a column — that is
// the unavoidable price of a spring on the dot axis at 2.6mm braille pitch,
// and precisely why this tile is resin and not FDM.
module spring_bores() {
    for (d = [1 : 6]) {
        p = dot_pos(d);
        translate([p[0], p[1], -0.01])
            cylinder(d = spring_od + 0.2, h = spring_recess_depth + 0.01);
    }
}

// --- CHAMFER on the top edge ---
// Softens the joint line so a reading finger sweeping across the plate does
// not catch the seam between insert and plate.
module top_chamfer() {
    translate([0, 0, insert_h - 0.3])
        difference() {
            translate([-insert_flange/2 - 1, -insert_flange/2 - 1, 0])
                cube([insert_flange + 2, insert_flange + 2, 0.31]);
            hull() {
                translate([0, 0, -0.01])
                    linear_extrude(0.01)
                        square([insert_flange - 0.6, insert_flange - 0.6], center = true);
                translate([0, 0, 0.3])
                    linear_extrude(0.01)
                        square([insert_flange, insert_flange], center = true);
            }
        }
}

module dot_insert() {
    difference() {
        insert_blank();
        dot_holes();
        spring_bores();
        top_chamfer();
    }
}

// --- RENDER ---
dot_insert();
