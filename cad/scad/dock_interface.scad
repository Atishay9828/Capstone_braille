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
// IT MOUNTS FROM THE INSIDE. 2026-09-04, Mridul's call, and it is the right one.
//
// The connector is a top hat: a 2mm ear plate carrying the two mounting holes,
// with a 2mm raised boss standing proud of it that holds the pins and the two
// magnets. It goes in from INSIDE the box - the boss pushes out through the wall
// and the ear plate stays behind, flat against the inside face.
//
// WHY THAT IS BETTER, and it is not just preference. Undocking pulls the
// connector OUTWARD. Mounted outside, the only thing resisting that is two M1.6
// screws in plastic. Mounted inside, the ear plate bears on the inner face and
// THE WALL takes the load - the screws only stop it falling inward, which
// nothing is pulling it to do. The joint gets stronger every time you pull it.
//
// THE WALL HAS TO THIN TO LET THE BOSS REACH THE SURFACE. The boss is 2mm and
// the wall is 4mm, so a plain through-window would leave the connector face
// recessed 2mm - and with one on each box, the two faces would sit 4mm apart
// with the shells already touching. Pogo pins travel about 1mm. They would never
// meet. So the ear plate sits in a 2.1mm-deep pocket in the INNER face, and the
// boss crosses the 1.9mm that remains and finishes flush outside.
//
//     inner face  x=0.0  ------------------.
//                        |  ear plate 2mm  |   <- pocket, bears here
//     pocket floor x=2.1 |-----.     .-----|
//                        | boss 2mm  |         <- window, 1.9mm of wall
//     outer face  x=4.0  '-----'     '-----'   <- boss face, flush
//
// PRINTING. Both openings are in a vertical wall, so both have a bridge across
// the top: 27.5mm over the pocket and 20.4mm over the window. That is a normal
// FDM bridge, not a support case, but it does sag - so the window is cut 0.8mm
// taller than the boss instead of the usual 0.2, and the sag is spent on that
// clearance rather than on the fit. The gap it leaves is a cosmetic line at the
// top of the window, and the ear plate is behind it, not in front.
//
// THE FLANGE FIGURES ARE SPEC. Hole pitch, body and boss come off the drawing;
// the ear-plate outline was not dimensioned, so pogo_flange_l is inferred from
// the 23mm pitch plus room for the 1.5mm holes. MEASURE IT before printing.
pogo_hole_pitch  = 23.0;   // mounting hole centres, from the drawing
pogo_screw_pilot =  1.3;   // M1.6 self-tapper into PETG
pogo_screw_depth =  1.5;   // from the POCKET FLOOR - only 1.9mm of wall under it
pogo_pin_pitch   =  2.54;
pogo_pins        =  5;
pogo_mag_pitch   = 16.0;   // the connector's OWN magnets, inside the boss

pogo_boss_l      = 20.0;   // SPEC   raised section, along the wall
pogo_boss_w      =  4.0;   // SPEC   raised section, up the wall
pogo_boss_t      =  2.0;   // SPEC   how far it stands proud of the ear plate
pogo_flange_l    = 27.0;   // SPEC   MEASURE - inferred from the 23mm hole pitch
pogo_flange_w    =  4.0;   // SPEC   MEASURE
pogo_flange_t    =  2.0;   // SPEC   ear plate thickness

pogo_fit_side    = 0.4;    // 0.2 per side, snug in Y
pogo_fit_top     = 0.8;    // deliberate headroom for bridge sag, see above

pogo_win_l       = pogo_boss_l + pogo_fit_side;      // 20.4
pogo_win_w       = pogo_boss_w + pogo_fit_top;       //  4.8
pogo_pocket_l    = pogo_flange_l + pogo_fit_side;    // 27.4
pogo_pocket_w    = pogo_flange_w + pogo_fit_top;     //  4.8
pogo_pocket_d    = pogo_flange_t + 0.1;              //  2.1

pogo_tail_span   = (pogo_pins - 1) * pogo_pin_pitch;   // 10.16 across the tails

// Kept for anything still asking the old question.
dock_receiver_w  = pogo_win_l;
dock_receiver_h  = pogo_win_w;

// Cut into one wall. X through the wall, Y along it, Z up.
// face_x = -1 for the -X wall, +1 for the +X wall.
// Cut into one wall. The CALLER places this at the wall's OUTER face.
// Canonical frame: local x=0 is that outer surface and the wall runs to -wall_t,
// so every number below reads as a depth from outside. face_x = +1 for the +X
// wall, -1 for the -X wall, which just mirrors it.
//
// Built from min-corners rather than centred cubes on purpose: the first version
// of this used center=true and put the ear pocket on the OUTER face, which is
// the exact thing this change was meant to stop. Measured, not assumed.
module dock_pogo_cutout(wall_t, face_x = 1) {
    mirror([face_x < 0 ? 1 : 0, 0, 0]) union() {
        // 1. boss window - right through the wall
        translate([-wall_t - 1, -pogo_win_l / 2, -pogo_win_w / 2])
            cube([wall_t + 2, pogo_win_l, pogo_win_w]);

        // 2. ear-plate pocket - from the INNER face, going outward
        translate([-wall_t - 0.01, -pogo_pocket_l / 2, -pogo_pocket_w / 2])
            cube([pogo_pocket_d + 0.01, pogo_pocket_l, pogo_pocket_w]);

        // 3. screw pilots - start at the pocket floor, blind toward outside
        for (sy = [-1, 1])
            translate([-wall_t + pogo_pocket_d, sy * pogo_hole_pitch / 2, 0])
                rotate([0, 90, 0])
                    cylinder(d = pogo_screw_pilot, h = pogo_screw_depth, $fn = 20);
    }
}


// The ear plate rests on the pocket floor, so the boss face lands at
// (pocket depth + boss height) from the inner face. That has to REACH the outer
// face at 4.0 - short of it and the two connectors never touch - without
// standing so proud that the shells cannot close up.
pogo_face_x = pogo_pocket_d + pogo_boss_t;   // 4.1, i.e. 0.1mm proud
assert(pogo_face_x >= 4.0,
       str("connector face lands at ", pogo_face_x, " inside a 4.0mm wall - it is ",
           4.0 - pogo_face_x, "mm recessed and the pins will never meet"));
assert(pogo_face_x <= 4.0 + 0.5,
       str("connector face stands ", pogo_face_x - 4.0, "mm proud - the shells will not close"));
assert(pogo_screw_depth <= 4.0 - pogo_pocket_d - 0.3,
       str("screw pilot would break through the ",
           4.0 - pogo_pocket_d, "mm of wall left under the pocket"));
assert(pogo_pocket_l > pogo_win_l,
       "ear pocket must be wider than the window or there is no ledge to bear on");
assert(pogo_hole_pitch / 2 + 2 < 68 / 2,
       "pogo mounting holes fall outside the 68mm wall");
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
