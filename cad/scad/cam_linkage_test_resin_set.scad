/*
  Braillix minimal resin mechanism test set

  Four components only:
    - current full cam
    - dot-5 linkage (inner track / worst pressure angle)
    - dot-6 linkage (outer track / longest arm / fastest-changing bit)
    - real dot insert

  Material: tough or ABS-like resin. This is a TEST SET, not a production
  release: the current cam hub bore/stack remains invalid for motor assembly.
*/

// Reuse the authoritative cam STL; validate_print_assets.py separately proves
// that braille_cam.stl is an exact fresh render of braille_cam.scad.
use <linkage.scad>
use <dot_insert.scad>

$fn = 60;

import("../stl/braille_cam.stl");

translate([28, -14, 0.6]) linkage_3d_v4(5);
translate([28,   2, 0.6]) linkage_3d_v4(6);
translate([55,   0, 0.0]) dot_insert();
