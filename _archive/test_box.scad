// MINIMUM TEST — original box + button holes only (no guards)
shell_length = 78; shell_width = 68; shell_height = 28;
wall_thickness = 4; floor_thickness = 4;
internal_length = 64; internal_width = 54; internal_depth = 22;
fillet_outer = 2.0; fillet_inner = 1.0;
btn_hole_dia = 12.5; btn_recess_dia = 16.0; btn_recess_depth = 1.5;
btn_z = 10; btn_x_back = -22; btn_x_next = 22;
$fn = 60;
module rounded_box(l,w,h,r) { hull() { translate([-l/2+r,-w/2+r,0]) cylinder(r=r,h=h); translate([l/2-r,-w/2+r,0]) cylinder(r=r,h=h); translate([-l/2+r,w/2-r,0]) cylinder(r=r,h=h); translate([l/2-r,w/2-r,0]) cylinder(r=r,h=h); } }
module one_hole(bx) { translate([bx,-shell_width/2-btn_recess_depth,btn_z]) rotate([-90,0,0]) { cylinder(d=btn_hole_dia,h=wall_thickness+btn_recess_depth+2); cylinder(d=btn_recess_dia,h=btn_recess_depth+1); } }
difference() {
  rounded_box(shell_length,shell_width,shell_height,fillet_outer);
  translate([0,0,floor_thickness]) rounded_box(internal_length,internal_width,shell_height,fillet_inner);
  one_hole(btn_x_back); one_hole(btn_x_next);
}
