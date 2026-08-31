// =========================================================
// 28BYJ-48 — THE OWNED MOTOR, MEASURED
//
// Shared because three parts now need the same numbers: the outer box (which
// holds the motor), the base plate (which the cam sits in above it), and the
// fit coupons. Copying a motor dimension into a second file is how this project
// has repeatedly shipped parts that did not fit.
//
// Values marked MEASURED came off Mridul's own motor with calipers. Values
// marked SPEC are catalogue figures still to be confirmed on the real part.
// =========================================================

motor_can_dia    = 28.1;   // MEASURED  body diameter
motor_can_h      = 19.0;   // MEASURED  body height (M2)
motor_shaft_off  = 7.5;    // MEASURED  shaft offset from the can's centre (M3)
motor_ear_span   = 34.7;   // MEASURED  centre-to-centre of the two mounting ears
motor_shaft_len  = 9.5;    // MEASURED  mounting face to shaft tip (M6)
motor_boss_dia   = 9.0;    // MEASURED  raised ring around the shaft
motor_boss_h     = 2.0;    // MEASURED  its height above the mounting face

// --- THE SHAFT IS CUT DOWN. 2026-09-01 ---
//
// The cam disc sits at a FIXED height: its underside is the cam-pocket floor of
// the base plate, and the base plate is located by the motor can beneath it. So
// the shaft tip lands wherever the motor puts it, and on this motor that is
// 1.5mm ABOVE the cam's working face.
//
// Three ways out, and only one of them costs nothing:
//   (a) drop the motor          - it already sits on the box floor. No room.
//   (b) raise the whole stack   - undoes 2mm of the 14mm the cell just lost, and
//                                 reprints the box AND the pod to keep them level.
//   (c) shorten the shaft       - 2.5mm off a soft steel stub. Nothing else moves.
//
// (c). The requirement is that the shaft ends BELOW the cam face with solid
// material over it - not sheathed in a boss standing proud of the face, which is
// what v8.6 did and which is not the same thing.
//
//   HOW TO CUT: mask the gearbox so swarf cannot enter it, hold the shaft (not
//   the can) and use a rotary cutoff wheel. Do not push down the axis - the
//   output gear is plastic. Deburr, and check it still enters a Ø5.2 hole.
motor_shaft_cut = 2.5;                                  // remove this much
motor_shaft_len_cut = motor_shaft_len - motor_shaft_cut;   // 7.0mm remains

// The cam hub can only reach down to the TOP of that boss, never to the face.
motor_shaft_usable = motor_shaft_len_cut - motor_boss_h;   // 5.0mm of grabbable shaft

// 5.0mm of Double-D in resin carries this motor with room to spare: 0.3Nm over a
// 2.6mm radius is ~115N, spread over two 3.2 x 5.0mm flats = 3.6MPa against a
// resin yield near 50MPa.
assert(motor_shaft_usable >= 4.0,
       str("only ", motor_shaft_usable, "mm of shaft left to drive the cam"));

// --- THE WIRE BLOCK ---
// The blue plastic housing the five leads come out of. It sits on the can's
// exterior OPPOSITE the shaft. The shaft is offset to +X of the can centre, so
// the block points -X. The old mid-plate collar cut its escape notch on +Y,
// which is 90 degrees wrong, and the motor would not have dropped in.
motor_wire_block_w = 16.0;  // SPEC   width across the block, to be confirmed
motor_wire_block_h = 8.0;   // SPEC   height of the block
motor_wire_side    = "-X";  // documentation only; the notch is cut on -X below
