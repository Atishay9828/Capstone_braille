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

// The cam hub can only reach down to the TOP of that boss, never to the face.
motor_shaft_usable = motor_shaft_len - motor_boss_h;   // 7.5mm of grabbable shaft

// --- THE WIRE BLOCK ---
// The blue plastic housing the five leads come out of. It sits on the can's
// exterior OPPOSITE the shaft. The shaft is offset to +X of the can centre, so
// the block points -X. The old mid-plate collar cut its escape notch on +Y,
// which is 90 degrees wrong, and the motor would not have dropped in.
motor_wire_block_w = 16.0;  // SPEC   width across the block, to be confirmed
motor_wire_block_h = 8.0;   // SPEC   height of the block
motor_wire_side    = "-X";  // documentation only; the notch is cut on -X below
