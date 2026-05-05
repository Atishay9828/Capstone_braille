// Minimal reproduction of original outer_box WITHOUT any button changes
// to check whether Simple:no pre-existed my edits
shell_length = 78; shell_width = 68; shell_height = 28;
wall_thickness = 4; floor_thickness = 4;
internal_length = 64; internal_width = 54; internal_depth = 22;
dock_screw_diameter = 3.4;
dock_nut_flat = 5.6;
dock_nut_pocket_depth = 2.6;
fillet_outer = 2.0; fillet_inner = 1.0;
$fn = 60;

module rounded_box(l, w, h, r) {
    hull() {
        translate([-l/2+r,-w/2+r,0]) cylinder(r=r,h=h);
        translate([ l/2-r,-w/2+r,0]) cylinder(r=r,h=h);
        translate([-l/2+r, w/2-r,0]) cylinder(r=r,h=h);
        translate([ l/2-r, w/2-r,0]) cylinder(r=r,h=h);
    }
}

module docking_screw_holes() {
    for(y_offset = [-15, 15]) {
        translate([0, y_offset, shell_height/2])
        rotate([0, 90, 0]) {
            cylinder(d=dock_screw_diameter, h=shell_length + 20, center=true);
            translate([0, 0, shell_length/2 - 5])
                cylinder(d=dock_nut_flat/cos(30), h=dock_nut_pocket_depth+5, $fn=6);
        }
    }
}

difference() {
    rounded_box(shell_length, shell_width, shell_height, fillet_outer);
    translate([0,0,floor_thickness])
        rounded_box(internal_length, internal_width, shell_height, fillet_inner);
    docking_screw_holes();
}
