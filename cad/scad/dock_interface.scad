// Shared mechanical receiver envelope for every Braillix dock face.
// Electrical contact hardware is deliberately NOT defined here: the current
// direct-GPIO cell needs an 8-conductor harness, while a future four-contact dock
// requires a local expander and contacts rated for aggregate downstream current.
dock_receiver_w = 10.0;
dock_receiver_h = 8.0;
// v8.5: was 31 in a 58mm shell. The shell is now 44 and the usable wall runs from
// the floor at 4 to the base plate at 27, so the window is centred in that: 15.5,
// spanning 11.5..19.5 with 7.5mm clear above and below.
// The pod uses this same number, which is what keeps the two dock faces aligned.
dock_center_z   = 15.5;
dock_wall_t     = 4.0;
