// =========================================================
// EXPORT: one linkage, in ASSEMBLY position (not print layout)
// Created 2026-07-31 for the Blender animation.
//
//   openscad -D dot=1 -o ../stl/linkage_asm_1.stl export_linkage_assembly.scad
//
// WHY THIS FILE EXISTS
// cad/stl/linkage.stl is the PRINT layout — six linkages in a row, 22mm apart,
// all flat on the bed. Useless for animation: each linkage has to be its own
// object, standing in its real place, so it can be moved independently by the
// cam profile.
//
// NOTE THE `include`, NOT `use`.
// linkage.scad is pulled in with `use` (we only want its module). But asm_ang(),
// arm_span() and dot_pos() are VARIABLES/functions from mech_layout.scad, and
// OpenSCAD's `use` imports modules ONLY — never variables. Referencing them
// across a `use` boundary fails SILENTLY as undef and the geometry vanishes
// without an error. That exact bug already cost this project a print
// (print_resin_1_all.scad, 2026-07-30: all three nav caps disappeared).
// So mech_layout is `include`d directly.
include <mech_layout.scad>
use <linkage.scad>       // linkage_3d_v4(dot)

// AND `use` DOES NOT CARRY $fn EITHER — the same trap the note above describes.
// linkage.scad sets $fn = 48 at its top level, which is a VARIABLE, so it stops
// at the `use` boundary exactly like asm_ang() would. Without it OpenSCAD falls
// back to $fa=12/$fs=2, and on a 0.75mm dot dome that is about six facets: the
// exported braille dots came out visibly polygonal while linkage.stl, compiled
// directly, was smooth. 400 facets per assembled linkage against 20328 for the
// print layout of six.
$fn = 48;                // keep in step with linkage.scad

dot = 1;   // override on the command line with -D dot=N

// --- LOCAL FRAME OF linkage_3d_v4() ---
//   X = along the arm, 0 at the nub (dot) end, arm_span(dot) at the foot end
//   Y = vertical, 0 at the foot bottom = the cam surface
//   Z = part thickness (1.0mm), extruded
//
// To assemble:
//   1. rotate([90,0,0])      stand it up:  local Y (vertical) -> world Z
//   2. rotate([0,0,asm_ang]) swing the arm out to its own foot angle
//   3. translate(dot_pos)    put the nub on the braille dot it drives
//
// Z=0 in the exported STL is the CAM SURFACE with the dot DOWN. Blender then
// animates Z from 0 (down) to pin_lift (up), which is exactly what the real
// linkage does — it rides the cam and translates vertically, nothing else.
// v2 FIX — every dot used to land 0.500mm off its hole, measured on all six.
// linkage_3d_v4() is extruded from local z=0 to z=link_thickness, and the dome is
// built at translate([0, total_h - dot_r, thickness/2]). So the DOT AXIS in the
// part's own frame is x=0, z=link_thickness/2 — NOT z=0. Placing local z=0 on the
// dot centre therefore pushed the whole linkage half a thickness sideways once
// rotate([90,0,0]) mapped local +Z onto world -Y.
// Centre the part on its own thickness first, and the dome lands exactly on
// dot_pos(d) for all six.
module linkage_assembled(d) {
    p = dot_pos(d);
    translate([p[0], p[1], 0])
        rotate([0, 0, asm_ang(d)])
            rotate([90, 0, 0])
                translate([0, 0, -link_thickness / 2])
                    linkage_3d_v4(d);
}

linkage_assembled(dot);

// --- REFERENCE (computed live, documentation only) ---
// dot | track |  foot@ | arm span | asm_ang | nub at
//  1  |   2   | 120deg |  12.77   |  ~101d  | (-2.4, +2.6)
//  2  |   3   | 180deg |  15.50   |   180d  | (-2.4,  0.0)
//  3  |   4   | 240deg |  16.17   |  ~259d  | (-2.4, -2.6)
//  4  |   1   |  60deg |  11.08   |   ~52d  | (+2.4, +2.6)
//  5  |   0   |   0deg |  10.40   |     0d  | (+2.4,  0.0)
//  6  |   5   | 300deg |  17.87   |  ~308d  | (+2.4, -2.6)
