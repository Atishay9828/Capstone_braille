// =========================================================
// COMPONENT: NAVIGATION BUTTON CAPS — PS-Style Tactile
// Revision 2.0
// Created 2026-05-08
//
// Redesigned from v1.0:
//   - Symbols now RAISED (union, not engraved) — tactile for blind users
//   - Left cap  : ◁ filled triangle (Previous)
//   - Middle cap : ○ ring           (Select)
//   - Right cap  : ▷ filled triangle (Next)
//
// Assembly (unchanged from v1.0):
//   1. Insert the rear-facing cap stem through the Ø4.2mm hole in pod front wall (-Y)
//   2. Flange (Ø8mm) sits flush against the outside of the pod wall
//   3. Stem projects 0.5mm inside the 4mm wall — rests on 6x6x5mm tactile switch
//   4. Press cap → compresses switch → electrical signal
//   5. Switch spring returns cap to rest position
//
// Tactile switch: 6×6×5mm DIP
//
// Print: PETG or resin. Print flat (dome up). No supports needed.
// Post: sand dome smooth if desired. No glue — flange + switch spring retain the cap.
// =========================================================

include <esp32_pod_params.scad>

raise_h = 1.2;   // symbol height raised above dome top (was 0.8 — increased for easier tactile ID)
$fn = 60;

// --- MODULES ---

module cap_body() {
    union() {
        // A. Rear-facing stem — starts at the flange's inner face (z=0) and reaches
        // through the 4mm wall, 0.5mm into the pod. It must be negative Z so it
        // actually protrudes behind the flange rather than being buried in the dome.
        translate([0, 0, -nav_shaft_len])
            cylinder(d=nav_shaft_dia, h=nav_shaft_len);

        // B. Retention flange — sits on pod outer face, prevents cap falling through
        cylinder(d=nav_flange_dia, h=nav_flange_h);

        // C. PS-style tapered dome body — sits above flange on outside of pod
        translate([0, 0, nav_flange_h])
            cylinder(d1=nav_cap_body_dia, d2=nav_cap_body_dia * 0.7,
                     h=nav_cap_body_h);
    }
}

// Symbol: ◁ left-pointing filled triangle (Previous)
// Tip at left (-X), base at right (+X), centred on dome top
module symbol_triangle_left() {
    top_z = nav_flange_h + nav_cap_body_h;
    translate([0, 0, top_z])
        linear_extrude(height=raise_h)
            polygon([[-1.6,  0.0],
                     [ 0.9,  1.3],
                     [ 0.9, -1.3]]);
}

// Symbol: ○ ring (Select)
// Raised annular ring — finger can trace the circle outline
module symbol_circle_ring() {
    top_z = nav_flange_h + nav_cap_body_h;
    translate([0, 0, top_z])
        difference() {
            cylinder(d=3.0, h=raise_h, $fn=48);
            translate([0, 0, -0.1])
                cylinder(d=1.6, h=raise_h + 0.2, $fn=48);
        }
}

// Symbol: ▷ right-pointing filled triangle (Next)
// Mirror of left triangle: tip at right (+X), base at left (-X)
module symbol_triangle_right() {
    top_z = nav_flange_h + nav_cap_body_h;
    translate([0, 0, top_z])
        linear_extrude(height=raise_h)
            polygon([[ 1.6,  0.0],
                     [-0.9,  1.3],
                     [-0.9, -1.3]]);
}

// --- FULL CAPS: symbols RAISED (union) for tactile feel ---

module nav_cap_prev() {
    union() {
        cap_body();
        symbol_triangle_left();
    }
}

module nav_cap_select() {
    union() {
        cap_body();
        symbol_circle_ring();
    }
}

module nav_cap_next() {
    union() {
        cap_body();
        symbol_triangle_right();
    }
}

// --- GENERATE ALL 3 CAPS laid out for printing (12mm pitch) ---
// Stem faces DOWN on build plate — dome + raised symbol face up — no supports needed
translate([-12, 0, 0]) nav_cap_prev();
translate([  0, 0, 0]) nav_cap_select();
translate([ 12, 0, 0]) nav_cap_next();
