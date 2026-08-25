// =========================================================
// RENDER SCENE — the mechanism, for the README
//
// Not a printable part. This assembles the real geometry so the README can show
// a photograph of the mechanism instead of an ASCII sketch: the cam disc, the six
// linkages standing in their true positions, the comb that guides them, and the
// top plate above.
//
// One dot is RAISED and the other five are DOWN, which is the whole point of the
// picture: the raised linkage's foot sits on a high section of its track, and its
// dome stands proud of the reading surface.
//
// Render with PREVIEW, not --render. Transparency is an OpenCSG feature; CGAL
// discards alpha and the enclosure comes out solid.
//
//   openscad --camera=... -o ../docs/img/mechanism.png readme_mechanism.scad
//
// Everything is placed in LINKAGE-LOCAL Z: z=0 is the flat cam surface, which is
// the datum linkage_3d_v4() is built against. World z is not used here.
// =========================================================

include <../cad/scad/mech_layout.scad>
use <../cad/scad/linkage.scad>        // linkage_3d_v4(dot)
use <../cad/scad/braille_cam.scad>    // braille_cam()
use <../cad/scad/linkage_comb.scad>   // linkage_comb()
use <../cad/scad/top_plate.scad>      // top_plate()
use <../cad/scad/dot_insert.scad>     // dot_insert()

// Which dot is shown raised. 5 sits at phase 0 on the innermost track, so its
// arm runs straight along +X and reads clearly from the side.
raised_dot = 5;

show_comb      = true;
show_top_plate = true;
show_insert    = true;

// braille_cam() puts the hub bottom at z=0, so the flat cam surface lands at
// hub_h + disk_base_thickness. Drop the disc by that much to put the flat at z=0.
cam_drop = 4 + 2;

$fn = 64;

// Same transform as export_linkage_assembly.scad. The -link_thickness/2 shift is
// load bearing: linkage_3d_v4() is extruded from local z=0, but its dome sits at
// local z=thickness/2, so without it every dot lands half a thickness off its hole.
module linkage_at(d, lift) {
    p = dot_pos(d);
    translate([p[0], p[1], lift])
        rotate([0, 0, asm_ang(d)])
            rotate([90, 0, 0])
                translate([0, 0, -link_thickness / 2])
                    linkage_3d_v4(d);
}

// --- the cam disc ---------------------------------------------------------
color([0.20, 0.22, 0.26])
    translate([0, 0, -cam_drop])
        braille_cam();

// --- the six linkages -----------------------------------------------------
// The raised one is warm and bright; the rest are cool grey and sit down.
for (d = [1:6])
    color(d == raised_dot ? [0.95, 0.62, 0.25] : [0.72, 0.75, 0.80])
        linkage_at(d, d == raised_dot ? pin_lift : 0);

// --- the guide ------------------------------------------------------------
if (show_comb)
    color([0.35, 0.55, 0.75, 0.30])
        linkage_comb();

// --- the reading surface --------------------------------------------------
// Ghosted, so the raised dome is visible through it rather than hidden by it.
if (show_top_plate)
    color([0.85, 0.87, 0.90, 0.13])
        translate([0, 0, plate_under_y])
            top_plate();

if (show_insert)
    color([0.90, 0.90, 0.95, 0.22])
        translate([0, 0, plate_under_y + (4 - 3.2)])
            dot_insert();
