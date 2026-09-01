// =========================================================
// ELECTRONICS — WHAT GOES IN THE CELL, HOW BIG IT IS, WHERE IT SITS
//
// Written because the ULN2003 breakout does not fit any more and the answer was
// a decision, not a measurement. Every number a CAD file, a simulator or a
// firmware note needs about the driver now comes from here.
//
// THE DECISION (2026-08-31): the off-the-shelf ULN2003 module is DROPPED.
// The cell carries a bare ULN2003AN in DIP-16 on a cut piece of perfboard.
//
// Why the module cannot stay:
//   the module is 35 x 32mm. Lying flat it needs 32mm of width, and beside the
//   motor cup there is 12.35mm. Standing on edge it needs 32mm of height, and
//   between the box floor and the base plate there is 23mm. Neither fits.
//   Almost all of that 35 x 32 is the JST socket, four indicator LEDs and the
//   header — none of which the cell uses.
//
// The driver itself is a 20 x 6.4mm DIP-16. On perfboard it is 28 x 18 x 11mm
// and the problem disappears.
// =========================================================

// --- THE CHIP: ULN2003AN, PDIP-16 (JEDEC MS-001) ---
// Seven Darlington sinks; the cell uses four, one per motor coil.
ic_body_len      = 19.5;   // SPEC  along the pin rows (TI "N" package, 19.3 nom)
ic_body_w        =  6.4;   // SPEC  across the body
ic_row_pitch     =  7.62;  // SPEC  0.3in, centre-to-centre of the two pin rows
ic_pin_pitch     =  2.54;  // SPEC
ic_seated_h      =  4.5;   // SPEC  body top above the board surface, max
ic_pin_tail      =  1.5;   // trimmed lead length below the board

// A DIP-16 SOCKET IS RECOMMENDED. A ULN2003 dies shorted when a coil kicks back,
// and desoldering 16 pins inside a glued box is not a repair. The socket costs
// 3.4mm of height, which this build can afford.
use_dip_socket   = true;
dip_socket_h     =  3.4;   // SPEC  seated height of the socket itself

// --- THE PERFBOARD ---
// 11 x 7 holes cut from a 10x4cm FR4 protoboard. The DIP needs 8 x 2.54 = 20.3mm
// along and 7.62mm across; the rest is two spare hole rows each side for the
// motor pigtail, the flyback commons and the 5V/GND pads.
pcb_len          = 28.0;   // Y  (11 holes)
pcb_w            = 18.0;   // X  (7 holes)
pcb_t            =  1.6;   // standard FR4

// --- HEIGHTS, WHICH IS WHAT EVERYTHING DOWNSTREAM ACTUALLY ASKS FOR ---
//
//                              socketed     soldered direct
//   trimmed pin tails             1.5              1.5
//   board                         1.6              1.6
//   socket                        3.4                -
//   chip body                     4.5              4.5
//                              --------         --------
//   overall                      11.0              7.6
//
elec_pcb_stack_h = pcb_t + (use_dip_socket ? dip_socket_h : 0) + ic_seated_h;
elec_overall_h   = ic_pin_tail + elec_pcb_stack_h;      // 11.0 socketed
// v8.8: the stack rose 2.5mm, so the clear height went 23 -> 25.5mm.
assert(elec_overall_h < 25.5,
       str("driver assembly is ", elec_overall_h,
           "mm; only 25.5mm between the box floor and the base plate"));

// --- WHERE IT SITS ---
//
// Plan view of the cell cavity, 60 x 60, looking down:
//
//     y=+30 +-------------------------------------------+
//           |          (26,21) corner boss O            |
//           |     ___________                  +--+     |
//           |    /           \                 |  |     |
//     y=0   |   (  motor cup  )                |PCB|    |   x=+30
//           |    \___________/                 |  |     |
//           |          ^ centre (-7.5, 0)      +--+     |
//           |          (26,-21) corner boss O           |
//     y=-30 +-------------------------------------------+
//                                             ^ x=+16
//
// The motor can is offset to -X because the SHAFT must land on the cavity
// centreline, and the shaft is 7.5mm off the can's own centre. That pushes the
// can away from +X and opens the only usable gap in the box:
//
//   motor cup outer edge .... x = +9.75   (centre -7.5, od 34.5)
//   corner boss inner edge .. x = +22.1   (bosses at x=26, dia 7.8)
//   USABLE GAP .............. 12.35mm wide, y = -17.1 .. +17.1, 25.5mm tall
//
// The board therefore STANDS ON EDGE against the +X wall, 28mm along Y, 18mm
// tall in Z, 11mm thick in X. It does not lie flat: flat needs 18mm of width and
// the gap is 12.35mm.
elec_pcb_x       = 16.0;   // X of the board's mid-plane
elec_pcb_y       =  0.0;
elec_pcb_z       =  4.0;   // stands on the box floor (floor_thickness)
elec_pcb_upright = true;   // 28 along Y, 18 along Z, elec_overall_h along X

// Clearances, stated so a future change is caught rather than discovered:
elec_gap_inner   =  9.75;  // motor cup outer edge
elec_gap_outer   = 22.10;  // corner boss inner edge
assert(elec_overall_h <= (elec_gap_outer - elec_gap_inner),
       "driver assembly is wider than the gap beside the motor cup");
assert(pcb_len <= 34.0, "board is longer than the clear band between the bosses");
assert(elec_pcb_z + pcb_w <= 29.5, "board top fouls the base plate at z=29.5");

// NOT MODELLED YET. The board is currently held by its own wire stiffness and a
// blob of hot glue. If it needs a real retainer, the cheap version is two 1.8mm
// slots in the box floor at x = 16 +/- 5.5 - printable vertically, no supports.
elec_retainer_modelled = false;

// --- WIRING, WHICH IS WHY THE MOTOR NOTCH IS ON -X ---
// The motor pigtail leaves the can on -X and the board is on +X, so the five
// leads route around the can. The 28BYJ-48 pigtail is ~200mm; there is plenty.
// Six conductors cross the dock to the pod, which is exactly the dock window's
// limit (10 x 8mm): IN1..IN4, 5V, GND. The Hall sensor has no spare conductor,
// so it must be read in the CELL, not the pod, or share the bus.
elec_dock_conductors = 6;
