// =========================================================
// BRAILLIX POGO END CAP — functional TPU snap plug
// Revision 2.0 — 2026-08-19
//
// The old part used a 12x10 insertion body for a 10x8 slot and its
// "snap lips" were buried inside that same envelope, so no snap existed.
// This revision separates the exposed flange from a clearance tongue and
// places real flexible barbs just beyond the 4mm enclosure wall.
// =========================================================

include <dock_interface.scad>

pogo_slot_w    = dock_receiver_w;
pogo_slot_h    = dock_receiver_h;
wall_thickness = dock_wall_t;

face_w = pogo_slot_w + 2.0;
face_h = pogo_slot_h + 2.0;
face_t = 1.8;
face_r = 1.2;

tongue_w     = pogo_slot_w - 0.6;   // 0.3mm clearance per slot side
tongue_h     = pogo_slot_h - 0.6;
tongue_depth = 6.0;   // 2mm beyond the inner wall
shell_t      = 1.2;   // hollow tongue flexes during insertion

barb_out     = 0.45;  // TPU interference beyond tongue envelope
barb_depth   = 0.9;
barb_z       = face_t + wall_thickness + 0.35;

$fn = 40;

module rounded_prism(w, h, r, z) {
    hull()
        for (sx=[-1,1], sy=[-1,1])
            translate([sx*(w/2-r), sy*(h/2-r), 0]) cylinder(r=r, h=z);
}

module face_flange() {
    rounded_prism(face_w, face_h, face_r, face_t);
}

module flexible_tongue() {
    difference() {
        translate([0,0,face_t-0.2])
            rounded_prism(tongue_w, tongue_h, 0.7, tongue_depth+0.2);
        // Open at the insertion end; leave the flange as the sealed front face.
        translate([0,0,face_t+shell_t])
            rounded_prism(tongue_w-2*shell_t,
                          tongue_h-2*shell_t,
                          0.35,
                          tongue_depth+1);
    }
}

module snap_barbs() {
    // Two shallow TPU ramps. Their tips sit behind the 4mm wall when installed.
    for (sy=[-1,1]) {
        y0 = sy*(tongue_h/2-0.05);
        y1 = sy*(tongue_h/2+barb_out);
        hull() {
            translate([-tongue_w/2+0.8, y0, barb_z-barb_depth/2])
                cube([tongue_w-1.6, 0.10, 0.10]);
            translate([-tongue_w/2+0.8, y1, barb_z+barb_depth/2])
                cube([tongue_w-1.6, 0.10, 0.10]);
        }
    }
}

module pogo_end_cap() {
    difference() {
        union() {
            face_flange();
            flexible_tongue();
            snap_barbs();
        }
        // Recessed tactile end-of-chain bar on the exposed face.
        translate([-3.5,-0.8,-0.05]) cube([7.0,1.6,0.65]);
    }
}

// Print as exported: flange on bed, tongue upward. TPU 95A, 0.16-0.20mm,
// 3-4 walls, no supports. The 0.45mm barbs are intentionally TPU-only.
pogo_end_cap();
