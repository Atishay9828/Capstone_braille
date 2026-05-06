// mid_plate_v1.scad
plate_l = 59.5;
plate_w = 59.5;
plate_h = 2.0;
motor_x_offset = -8;

$fn = 60;

module rounded_rect(l, w, h, r) {
    hull() {
        translate([-l/2 + r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r, -w/2 + r, 0]) cylinder(r=r, h=h);
        translate([-l/2 + r,  w/2 - r, 0]) cylinder(r=r, h=h);
        translate([ l/2 - r,  w/2 - r, 0]) cylinder(r=r, h=h);
    }
}

union() {
    difference() {
        // Base plate body
        rounded_rect(plate_l, plate_w, plate_h, 1.0);
        
        // Holes to allow the 4 corner bosses to pass through
        for(sx = [-1, 1]) for(sy = [-1, 1]) {
            translate([sx * 15, sy * 15, -1]) 
                cylinder(d=8.5, h=plate_h + 2); // 8.5mm to clear 8mm boss
        }
        
        // Central hole for motor shaft to pass up to the cam
        translate([0, 0, -1]) cylinder(d=10, h=plate_h + 2);
        
        // Slot for motor wires to drop down into the electronics bay
        translate([-8, 20, -1]) cube([15, 8, plate_h + 2], center=true);
    }
    
    // Motor Retaining Collar (Centered at X=-8)
    translate([motor_x_offset, 0, plate_h]) difference() {
        cylinder(d=34.5, h=8); // 8mm tall collar
        translate([0,0,-1]) cylinder(d=29.5, h=10); // 29.5mm ID for motor body
    }
}