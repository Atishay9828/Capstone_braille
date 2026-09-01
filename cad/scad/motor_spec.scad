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

// --- THE SHAFT IS NOT CUT. THE STACK GOES UP INSTEAD. 2026-09-01 ---
//
// The cam disc used to sit at a height that put the shaft tip 1.5mm ABOVE the
// cam's working face. Three ways out:
//   (a) drop the motor       - already on the box floor. No room.
//   (b) cut the shaft        - 2.5mm off a soft steel stub, nothing else moves.
//   (c) raise the whole stack - hub_h 4 -> 6.5, and every part above follows.
//
// (c), on Mridul's call. Cutting a motor is irreversible and has to be repeated
// perfectly for every unit ever built; a taller hub is a number in a file. The
// cell and the pod both go 44 -> 46.5mm, which is still 11.5mm shorter than the
// 58mm they were before the motor moved onto the floor.
//
// The shaft is therefore used at its full length.
motor_shaft_usable = motor_shaft_len - motor_boss_h;   // 7.5mm of grabbable shaft

// 7.5mm of Double-D in resin carries this motor with enormous margin: 0.3Nm over
// a 2.6mm radius is ~115N, spread over two 3.2 x 7.5mm flats = 2.4MPa against a
// resin yield near 50MPa.

// --- THE WIRE BLOCK ---
// The blue plastic housing the five leads come out of. It sits on the can's
// exterior OPPOSITE the shaft. The shaft is offset to +X of the can centre, so
// the block points -X. The old mid-plate collar cut its escape notch on +Y,
// which is 90 degrees wrong, and the motor would not have dropped in.
motor_wire_block_w = 16.0;  // SPEC   width across the block, to be confirmed
motor_wire_block_h = 8.0;   // SPEC   height of the block
motor_wire_side    = "-X";  // documentation only; the notch is cut on -X below
