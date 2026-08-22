/*
  Braillix single-dot cam/linkage test fixture

  Stack-independent bench rig for the real cam, dot insert, spring and one
  linkage at a time. Test dot 5 (inner track/worst pressure angle) and dot 6
  (outer track/longest arm/fastest bit) before releasing the full mechanism.

  Printed layout contains two PETG components:
    1. base with cam locating well and four shouldered posts
    2. removable X-frame holder reproducing the production dot-insert pocket

  Assembly datum:
    cam underside seats at z=4.7
    flat cam surface is z=6.7
    holder underside is z=15.7
    cam-flat to holder underside = exactly 9.0 mm
*/

$fn = 60;

base_size = 56.0;
base_h = 5.0;
base_r = 3.0;

cam_d = 44.4;
cam_well_d = 45.0;
cam_well_depth = 0.3;
cam_seat_z = base_h - cam_well_depth;
hub_clearance_d = 12.0;

holder_h = 3.2;
holder_under_z = cam_seat_z + 11.0;  // 2 mm floor + 9 mm mechanism gap

post_xy = 24.0;
post_d = 6.0;
peg_d = 3.0;
peg_h = 3.0;
peg_hole_d = 3.4;

insert_body_opening = 11.2;
insert_flange_opening = 15.2;
insert_flange_h = 1.2;

module rounded_plate(w, h, z, r) {
    hull()
        for (sx=[-1,1], sy=[-1,1])
            translate([sx*(w/2-r), sy*(h/2-r), 0]) cylinder(r=r, h=z);
}

module fixture_base() {
    difference() {
        union() {
            rounded_plate(base_size, base_size, base_h, base_r);

            for (sx=[-1,1], sy=[-1,1]) {
                // Wide shoulder fixes holder height; narrow peg only locates XY.
                translate([sx*post_xy, sy*post_xy, base_h-0.2])
                    cylinder(d=post_d, h=holder_under_z-(base_h-0.2));
                translate([sx*post_xy, sy*post_xy, holder_under_z])
                    cylinder(d=peg_d, h=peg_h);
            }
        }

        // Shallow OD locator: 0.3 mm radial clearance around the real cam.
        translate([0, 0, cam_seat_z])
            cylinder(d=cam_well_d, h=cam_well_depth+0.6);

        // Current 9 mm hub hangs through this opening with 1.5 mm/side room.
        translate([0, 0, -0.5])
            cylinder(d=hub_clearance_d, h=base_h+1);
    }
}

module holder_blank() {
    union() {
        rounded_plate(22, 22, holder_h, 2.0);

        for (sx=[-1,1], sy=[-1,1]) {
            translate([sx*post_xy, sy*post_xy, 0])
                cylinder(d=9.0, h=holder_h);

            hull() {
                translate([sx*7.5, sy*7.5, 0]) cylinder(d=5.0, h=holder_h);
                translate([sx*post_xy, sy*post_xy, 0]) cylinder(d=5.0, h=holder_h);
            }
        }
    }
}

module insert_holder() {
    difference() {
        holder_blank();

        // Real 11.2 mm body opening through the holder.
        translate([0, 0, -0.5])
            linear_extrude(holder_h+1)
                square([insert_body_opening, insert_body_opening], center=true);

        // Real 15.2 mm flange rebate, 1.2 mm deep from the reading surface.
        translate([0, 0, holder_h-insert_flange_h])
            linear_extrude(insert_flange_h+0.5)
                square([insert_flange_opening, insert_flange_opening], center=true);

        for (sx=[-1,1], sy=[-1,1])
            translate([sx*post_xy, sy*post_xy, -0.5])
                cylinder(d=peg_hole_d, h=holder_h+1);
    }
}

// Print both flat in one checked PETG job; assemble concentrically afterward.
translate([-33, 0, 0]) fixture_base();
translate([ 33, 0, 0]) insert_holder();
