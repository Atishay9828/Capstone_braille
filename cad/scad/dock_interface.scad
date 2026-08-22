// Shared mechanical receiver envelope for every Braillix dock face.
// Electrical contact hardware is deliberately NOT defined here: the current
// direct-GPIO cell needs an 8-conductor harness, while a future four-contact dock
// requires a local expander and contacts rated for aggregate downstream current.
dock_receiver_w = 10.0;
dock_receiver_h = 8.0;
dock_center_z   = 31.0;
dock_wall_t     = 4.0;
