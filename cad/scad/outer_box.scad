// outer_box_v4.scad
shell_length      = 68;     
shell_width       = 68;     
shell_height      = 57;     
wall_thickness    = 4;
floor_thickness   = 4;
internal_length   = 60;     
internal_width    = 60;     
elec_pocket_h     = 16;     
base_plate_z      = 41; // 4(floor) + 16(elec) + 2(midplate) + 19(motor)
boss_height       = 37; // base_plate_z - floor_thickness

$fn = 60;

module rounded_box(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}

union() {
    difference() {
        // Main Shell
        rounded_box(shell_length, shell_width, shell_height, 2.0);

        // Internal Cavity
        translate([0, 0, floor_thickness])
            rounded_box(internal_length, internal_width, shell_height, 1.0);

        // 16mm Deep Electronics Pocket
        translate([0, 0, floor_thickness + elec_pocket_h/2])
            cube([36, 46, elec_pocket_h + 1], center=true);
            
        // Wire exit back wall
        translate([0, shell_width/2, floor_thickness + 3])
            cube([15, wall_thickness + 2, 6], center=true);
            
        // Pogo / Magnet Slots (Simplified for brevity)
        translate([-shell_length/2, 0, 30.5]) cube([6, 10, 8], center=true);
        translate([shell_length/2, 0, 30.5]) cube([6, 10, 8], center=true);
    }

    // NEW: 2mm Ledge at Z=20 for the Mid-Plate to rest on!
    translate([0, 0, floor_thickness + elec_pocket_h]) difference() {
        rounded_box(internal_length, internal_width, 2, 1.0);
        translate([0,0,-1]) rounded_box(internal_length - 4, internal_width - 4, 4, 1.0);
    }

    // Corner Bosses (Go from floor through mid-plate to top)
    for(sx = [-1, 1]) for(sy = [-1, 1]) {
        translate([sx * 15, sy * 15, floor_thickness]) difference() {
            cylinder(d=8, h=boss_height);
            translate([0, 0, 3]) cylinder(d=3.2, h=boss_height);
        }
    }
}