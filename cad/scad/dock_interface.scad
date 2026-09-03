// Shared mechanical receiver envelope for every Braillix dock face.
// Electrical contact hardware is deliberately NOT defined here: the current
// direct-GPIO cell needs an 8-conductor harness, while a future four-contact dock
// requires a local expander and contacts rated for aggregate downstream current.
// =========================================================
// THE POGO CONNECTOR IS A REAL, OWNED PART NOW. 2026-09-04.
//
// 5P magnetic spring-loaded pogo connector, male/female pair, bought. The old
// 10 x 8mm "receiver envelope" was a guess made before any part existed, and it
// was wrong in both axes - far too tall and only half wide enough.
//
// FROM THE MANUFACTURER DRAWING (all mm):
//   mounting hole centres ... 23.00        two holes, dia 1.50
//   body length ............. 20.00
//   integrated magnet pitch .. 16.00       the two white discs in the photo
//   pin pitch ................ 2.54 +/-0.05,  5 pins -> 10.16mm across
//   body width ............... 4.00 +/-0.06
//   body thickness ........... 4.00, with a 2.00 flange step carrying the ears
//   pin ...................... dia 0.90 head, dia 0.70 tail, 5.00 long
//
// The window is cut to the BODY and the flange bears on the outer face. There is
// deliberately no flange recess: recessing 2mm into a 4mm wall would leave only
// 1.8mm for the screws to bite, and 4mm of thread in PETG is worth more than a
// flush look. The connectors mate body-to-body, so the standoff is by design.
// =========================================================
pogo_body_l     = 20.0;   // along the wall (Y)
pogo_body_w     =  4.0;   // up the wall (Z)
pogo_fit        =  0.4;   // 0.2 per side
pogo_hole_pitch = 23.0;   // mounting hole centres
pogo_screw_pilot = 1.3;   // M1.6 self-tapper into PETG; NOT a 1.7 clearance hole
pogo_screw_depth = 3.5;   // of a 4.0mm wall - stops short of breaking through
pogo_pin_pitch  = 2.54;
pogo_pins       = 5;
pogo_mag_pitch  = 16.0;   // the connector's OWN magnets

dock_receiver_w = pogo_body_l + pogo_fit;   // 20.4, was a guessed 10.0
dock_receiver_h = pogo_body_w + pogo_fit;   //  4.4, was a guessed  8.0

// Cut through one wall face. Caller places it at the wall and rotates.
// Drawn in the wall's local frame: X through the wall, Y along it, Z up.
module dock_pogo_cutout(wall_t) {
    // body window, straight through
    cube([wall_t * 2 + 2, dock_receiver_w, dock_receiver_h], center = true);
    // two screw pilots, blind from the outside face
    for (sy = [-1, 1])
        translate([wall_t / 2 + 0.01, sy * pogo_hole_pitch / 2, 0])
            rotate([0, -90, 0])
                cylinder(d = pogo_screw_pilot, h = pogo_screw_depth + 0.01, $fn = 20);
}

assert(pogo_hole_pitch / 2 + 2 < 68 / 2,
       "pogo mounting holes fall outside the 68mm wall");
assert(pogo_screw_depth < 4.0,
       "pogo screw pilot would break through the 4mm wall");
// v8.5: was 31 in a 58mm shell. The shell is now 44 and the usable wall runs from
// the floor at 4 to the base plate at 27, so the window is centred in that: 15.5,
// spanning 11.5..19.5 with 7.5mm clear above and below.
// The pod uses this same number, which is what keeps the two dock faces aligned.
dock_center_z   = 15.5;

// =========================================================
// THE SHELL MAGNETS STAY. 2026-09-04, Mridul's call, and he is right.
//
// The connector does carry its own magnets, but they are tiny - two discs a few
// mm across inside a 4mm-thick body, sized to hold a charging cable on a watch,
// not to hold two 68mm boxes in line. The 8mm shell magnets do the holding; the
// connector's do the last millimetre of alignment. Keep both.
//
// TWO THINGS THIS FORCES, both handled below:
//
//  1. THE MAGNETS HAD TO MOVE OUTBOARD. The pogo window went from a guessed
//     10mm wide to the real 20.4mm, and at y=+/-14 the pockets now run into it:
//
//        window edge ......... +/-10.20
//        magnet circle from ... 9.80    overlaps by 0.40
//        teardrop apex from ... 8.06    overlaps by 2.14
//
//     At y=+/-17.5 the circle clears by 3.10mm and the apex by 1.36mm, and the
//     outer edge sits at 23.44 against a 34mm half-wall. See mag_y_pos.
//
//  2. POLARITY IS AN ASSEMBLY TRAP AND NEEDS A RULE. Six magnets per joint now
//     have to agree. The existing convention is the right one and must be kept:
//     the -X face reads N/S top-to-bottom and the +X face reads S/N, so any
//     unit's left face mates with any other unit's right face, either way round.
//     Mark the discs before gluing. A reversed one turns a dock into a repel and
//     there is no visual cue once it is in.
dock_use_separate_magnets = true;

// v8.6: THE DOCK MAGNETS NOW LIVE HERE TOO.
// They used to be declared separately in outer_box.scad and esp32_pod_params.scad,
// both commented "matches cell". When the stack dropped 14mm the cell was updated
// to 13.5 and the pod was not, so the two faces sat 15.5mm apart in Z - the pogo
// pins would have mated and the magnets would have fought them. Same duplicated-
// constant bug this project keeps shipping. One declaration now, derived.
dock_mag_dia    = 8.4;                  // 8mm magnet + 0.4mm FDM clearance
dock_mag_z      = dock_center_z - 2.0;  // 13.5 - magnets sit just under the pogos
dock_mag_depth  = 1.2;                  // 1mm magnet + glue gap
dock_wall_t     = 4.0;

// =========================================================
// THE MAGNET POCKET LIVES HERE NOW - ONE COPY. 2026-09-04.
//
// outer_box.scad and esp32_pod_params.scad each carried their own
// teardrop_magnet_pocket(). Same duplicated-definition bug as the cam bore and
// standoff_x before it: fixing the orientation in the box left the pod still
// cutting the broken shape.
//
// WHY A TEARDROP AT ALL: these are horizontal holes in a vertical wall, so the
// top of each is an unsupported arc. Plain round pockets fused closed on the
// fit-test print. A 45-degree apex is self-supporting - but ONLY if it points
// UP, and until v8.9 it pointed sideways along the wall and did nothing.
//
// face_x = +1 cuts into the -X wall, -1 into the +X wall. Both put the apex on
// world +Z. VERIFY BY MEASURING THE BOUNDING BOX, not by reading the rotations.
module teardrop_magnet_pocket(face_x) {
    r = dock_mag_dia / 2;
    rotate([0, face_x * 90, 0])
        rotate([0, 0, face_x * 90])
            linear_extrude(dock_mag_depth + 0.01) union() {
                circle(r = r, $fn = 40);
                polygon([[-r * sin(45), r * cos(45)],
                         [0, r * sqrt(2)],
                         [ r * sin(45), r * cos(45)]]);
            }
}

// Magnets must clear the pogo window they sit beside.
dock_mag_y = 17.5;
assert(dock_mag_y - dock_mag_dia / 2 * sqrt(2) > dock_receiver_w / 2 + 0.5,
       str("magnet teardrop at y=", dock_mag_y,
           " runs into the ", dock_receiver_w, "mm pogo window"));
