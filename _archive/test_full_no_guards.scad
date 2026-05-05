// Full outer_box with buttons but WITHOUT guards — isolating which causes non-manifold
shell_length=78; shell_width=68; shell_height=28;
wall_thickness=4; floor_thickness=4;
internal_length=64; internal_width=54; internal_depth=22;
tongue_length=8; tongue_thickness=3; tongue_height=12;
slot_width=3.3; slot_height=12.2; slot_depth=8.2;
dock_screw_diameter=3.4; dock_nut_flat=5.6; dock_nut_pocket_depth=2.6;
boss_outer_diameter=8; boss_hole_diameter=3.2;
wire_slot_width=10; wire_slot_height=6;
vent_slot_width=1.5; vent_slot_length=12; vent_slot_count=5;
motor_clearance_diameter=34; motor_clearance_depth=20;
ledge_height=1.5; ledge_width=2.0;
has_right_pogo=true;
pogo_slot_w=10; pogo_slot_h=8; pogo_slot_depth=wall_thickness+2;
pogo_z=floor_thickness+(shell_height-floor_thickness)/2;
btn_hole_dia=12.5; btn_recess_dia=16.0; btn_recess_depth=1.5;
btn_z=10; btn_x_back=-22; btn_x_next=22;
has_select_btn=false; btn_x_select=0;
fillet_outer=2.0; fillet_inner=1.0;
$fn=60;

module rounded_box(l,w,h,r) { hull() { translate([-l/2+r,-w/2+r,0]) cylinder(r=r,h=h); translate([l/2-r,-w/2+r,0]) cylinder(r=r,h=h); translate([-l/2+r,w/2-r,0]) cylinder(r=r,h=h); translate([l/2-r,w/2-r,0]) cylinder(r=r,h=h); } }
module docking_tongue() { translate([-shell_length/2-tongue_length/2+0.1,0,shell_height/2]) cube([tongue_length,tongue_thickness,tongue_height],center=true); }
module docking_slot_cutout() { translate([shell_length/2,0,shell_height/2]) cube([slot_depth*2,slot_width,slot_height],center=true); }
module docking_screw_holes() { for(y_offset=[-15,15]) { translate([0,y_offset,shell_height/2]) rotate([0,90,0]) { cylinder(d=dock_screw_diameter,h=shell_length+20,center=true); translate([0,0,shell_length/2-5]) cylinder(d=dock_nut_flat/cos(30),h=dock_nut_pocket_depth+5,$fn=6); } } }
module ventilation_slots() { for(y=[-shell_width/2+wall_thickness/2,shell_width/2-wall_thickness/2]) { for(i=[0:vent_slot_count-1]) { x_pos=-15+(i*(vent_slot_width+4)); translate([x_pos,y,shell_height/2]) cube([vent_slot_width,wall_thickness+2,vent_slot_length],center=true); } } }
module pogo_connector_slots() { translate([-shell_length/2,0,pogo_z]) cube([pogo_slot_depth,pogo_slot_w,pogo_slot_h],center=true); if(has_right_pogo) translate([shell_length/2,0,pogo_z]) cube([pogo_slot_depth,pogo_slot_w,pogo_slot_h],center=true); }
module wire_exit() { translate([-shell_length/2+10,shell_width/2,floor_thickness+wire_slot_height/2]) cube([15,wall_thickness+2,wire_slot_height],center=true); }
module corner_bosses() { base_l=60; base_w=50; for(x=[-1,1]) for(y=[-1,1]) { translate([x*(base_l/2-6),y*(base_w/2-6),floor_thickness]) { difference() { cylinder(d=boss_outer_diameter,h=internal_depth); translate([0,0,5]) cylinder(d=boss_hole_diameter,h=internal_depth); } } } }
module one_button_hole(bx) { translate([bx,-shell_width/2,btn_z]) rotate([90,0,0]) { cylinder(d=btn_recess_dia,h=btn_recess_depth+1); cylinder(d=btn_hole_dia,h=wall_thickness+btn_recess_depth+2); } }
module nav_button_holes() { one_button_hole(btn_x_back); one_button_hole(btn_x_next); if(has_select_btn) one_button_hole(btn_x_select); }

union() {
    difference() {
        rounded_box(shell_length,shell_width,shell_height,fillet_outer);
        translate([0,0,floor_thickness]) rounded_box(internal_length,internal_width,shell_height,fillet_inner);
        translate([0,0,floor_thickness]) cylinder(d=motor_clearance_diameter,h=motor_clearance_depth+1,center=true);
        docking_slot_cutout();
        docking_screw_holes();
        ventilation_slots();
        wire_exit();
        pogo_connector_slots();
        translate([0,-shell_width/2,shell_height-5]) cube([24,2,8],center=true);
        nav_button_holes();
    }
    docking_tongue();
    corner_bosses();
    translate([0,0,floor_thickness]) difference() {
        rounded_box(internal_length,internal_width,ledge_height,fillet_inner);
        translate([0,0,-1]) rounded_box(60+0.5,50+0.5,ledge_height+2,fillet_inner);
    }
}
