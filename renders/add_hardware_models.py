"""
Braillix — Hardware Models for Blender Assembly Scene
======================================================
Run this inside Blender:  Scripting tab → Paste → Run Script

Adds parametric proxy meshes for every real hardware component
so you can see WHERE each part lives inside the assembly.

All coordinates are in mm (Blender units = mm for this scene).
Z-positions match the exploded-view spacing already in the .blend.

Stack (bottom → top, assembled Z):
  Z = 0     → Outer box floor
  Z = 4     → Motor body top (motor seated from BELOW into base plate)
  Z = 8.5   → Base plate top surface
  Z = 8.5   → Hall sensor (on base plate top, at X=19)
  Z = 10.5  → Cam disc bottom  (2mm floor + sits in 3mm pocket)
  Z = 13.3  → Cam disc top (10.5 + 2.8 disk_base_thickness + 0.8 max bump)
  Z = 22.5  → Top plate bottom (standoffs 3.5mm above base plate top = 12mm)
  Z = 25    → Top plate top
  Z = 25.8  → Braille pin tips (0.8mm lift max)

For the EXPLODED view (matching CHANGES.md offsets ÷ 3.5 scale):
  Use the Z_EXPLODE dict below — matches the existing .blend layers.
"""

import bpy
import math

# ── Purge default cube if it's still there ──────────────────────────────────
for obj in list(bpy.data.objects):
    if obj.name == "Cube":
        bpy.data.objects.remove(obj, do_unlink=True)

# ── Helper utilities ─────────────────────────────────────────────────────────

def make_mat(name, color_rgba, metallic=0.0, roughness=0.5, alpha=1.0):
    """Create or reuse a Principled BSDF material."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value   = color_rgba
    bsdf.inputs["Metallic"].default_value     = metallic
    bsdf.inputs["Roughness"].default_value    = roughness
    if alpha < 1.0:
        mat.blend_method = "BLEND"
        bsdf.inputs["Alpha"].default_value    = alpha
    return mat

def assign_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def add_label(text, location, size=1.5):
    """Add a 3-D text label at location (mm coords)."""
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.active_object
    obj.data.body = text
    obj.data.size = size
    obj.name = f"Label_{text[:20]}"
    mat = make_mat("MAT_Label", (1, 1, 0.2, 1), roughness=1.0)
    assign_mat(obj, mat)
    return obj

def add_cylinder(name, radius, depth, location, mat, segments=32):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, vertices=segments, location=location)
    obj = bpy.context.active_object
    obj.name = name
    assign_mat(obj, mat)
    return obj

def add_box(name, dims_xyz, location, mat):
    """dims_xyz = (x,y,z) half-extents OR full size — we use full size."""
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (dims_xyz[0]/2, dims_xyz[1]/2, dims_xyz[2]/2)
    bpy.ops.object.transform_apply(scale=True)
    assign_mat(obj, mat)
    return obj

# ── Exploded Z offsets (mm) ──────────────────────────────────────────────────
# Matches the CHANGES.md exploded-view table (kept in mm as the .blend uses mm)
Z = {
    "box":      0,
    "motor":    0,        # motor body sits inside/below base plate
    "uln2003":  0,        # board clipped beside motor
    "base":     86,
    "hall":     86,
    "magnet":   86,
    "cam":      149.5,
    "springs":  149.5,    # springs live between cam and top plate
    "linkages": 214.5,
    "top":      275.5,
    "esp32":    340,      # placeholder: mounted externally / above for vis
}

# ─────────────────────────────────────────────────────────────────────────────
# 1.  28BYJ-48 STEPPER MOTOR
#     Real dimensions: body Ø28mm, height 19mm, shaft stub Ø5mm × 10mm
# ─────────────────────────────────────────────────────────────────────────────
mat_motor = make_mat("MAT_Motor", (0.15, 0.15, 0.15, 1), metallic=0.3, roughness=0.7)
mat_motor_blue = make_mat("MAT_Motor_Blue", (0.1, 0.3, 0.8, 1), metallic=0.1, roughness=0.8)
mat_copper = make_mat("MAT_Copper", (0.8, 0.45, 0.15, 1), metallic=0.9, roughness=0.3)

# Body (round can)
motor_body = add_cylinder("Motor_28BYJ48_Body", radius=14.15, depth=19,
                           location=(0, 0, Z["motor"] + 9.5), mat=mat_motor)

# Mounting ears (flat tabs on each side)
for side in (-1, 1):
    ear = add_box(f"Motor_Ear_{'L' if side<0 else 'R'}",
                  (8, 5, 3),
                  (side * 15.5, 0, Z["motor"] + 3.5),
                  mat_motor)

# Shaft stub (D-shaft 5mm dia, 10mm long, sticking UP)
shaft = add_cylinder("Motor_Shaft", radius=2.5, depth=10,
                     location=(0, 0, Z["motor"] + 19 + 5), mat=make_mat(
                         "MAT_Shaft", (0.6, 0.6, 0.6, 1), metallic=0.8, roughness=0.2))

# Coil wires (5-wire harness stub — just a thin rect bundle)
wires = add_box("Motor_Wire_Harness", (4, 2, 15),
                (-16, 0, Z["motor"] + 12), mat_copper)

add_label("28BYJ-48 Stepper", (20, 5, Z["motor"] + 18))

# ─────────────────────────────────────────────────────────────────────────────
# 2.  ULN2003 DRIVER BOARD
#     Real: ~28mm × 35mm PCB, 5mm tall with header pins
# ─────────────────────────────────────────────────────────────────────────────
mat_pcb = make_mat("MAT_PCB", (0.02, 0.25, 0.04, 1), roughness=0.9)
mat_ic = make_mat("MAT_IC", (0.05, 0.05, 0.05, 1), roughness=1.0)

uln_board = add_box("ULN2003_PCB", (28, 35, 2),
                    (-45, 0, Z["uln2003"] + 17), mat_pcb)

# IC chip on board
uln_ic = add_box("ULN2003_IC", (6, 12, 3),
                 (-45, 0, Z["uln2003"] + 19.5), mat_ic)

# LED row (4 tiny boxes)
for i, col in enumerate([(1,0.1,0.1,1),(0.1,1,0.1,1),(1,0.5,0,1),(1,0.1,0.1,1)]):
    led_mat = make_mat(f"MAT_LED_{i}", col, roughness=0.2)
    bpy.ops.mesh.primitive_cube_add(location=(-39 + i*3, -14, Z["uln2003"] + 19))
    led = bpy.context.active_object
    led.name = f"ULN2003_LED_{i}"
    led.scale = (1, 1, 1.5)
    bpy.ops.object.transform_apply(scale=True)
    assign_mat(led, led_mat)

add_label("ULN2003 Driver", (-60, 0, Z["uln2003"] + 25))

# ─────────────────────────────────────────────────────────────────────────────
# 3.  HALL EFFECT SENSOR  (SS49E / A3144)
#     Real: ~4mm × 3mm × 1.5mm package, 3 legs
#     Sits in pocket at X=19, Y=0 on base plate top
# ─────────────────────────────────────────────────────────────────────────────
mat_sensor = make_mat("MAT_HallSensor", (0.1, 0.1, 0.1, 1), roughness=1.0)
mat_leg    = make_mat("MAT_SensorLeg",  (0.7, 0.7, 0.7, 1), metallic=0.8, roughness=0.2)

hall_body = add_box("HallSensor_Body", (4, 3, 3),
                    (19, 0, Z["hall"] + 1.5), mat_sensor)

# 3 legs
for i, yoff in enumerate([-1, 0, 1]):
    leg = add_box(f"HallSensor_Leg_{i}", (0.5, 0.5, 5),
                  (19, yoff, Z["hall"] - 2.5), mat_leg)

add_label("Hall Sensor (SS49E)", (25, 5, Z["hall"] + 6))

# ─────────────────────────────────────────────────────────────────────────────
# 4.  NEODYMIUM HOMING MAGNET  (3mm dia disc, 2mm thick)
#     Sits on cam disc underside at radius 17.35mm, angle 0° → X=17.35, Y=0
#     In exploded view it's with the cam layer
# ─────────────────────────────────────────────────────────────────────────────
mat_magnet = make_mat("MAT_Magnet", (0.7, 0.1, 0.1, 1), metallic=0.6, roughness=0.3)

magnet = add_cylinder("Homing_Magnet", radius=1.5, depth=2,
                      location=(17.35, 0, Z["cam"] - 1), mat=mat_magnet)

add_label("Homing Magnet (3mm NdFeB)", (22, 5, Z["cam"]))

# ─────────────────────────────────────────────────────────────────────────────
# 5.  RETURN SPRINGS  (6× compression springs, one per Braille dot)
#     Real: ~3.5mm OD, ~8mm free length, 0.3mm wire
#     Sit in top-plate underside pockets, push linkages DOWN onto cam
#     X/Y positions match the Braille dot grid (±2.4mm, ±2.6mm)
# ─────────────────────────────────────────────────────────────────────────────
mat_spring = make_mat("MAT_Spring", (0.6, 0.6, 0.6, 1), metallic=0.9, roughness=0.2)

dot_positions = [
    (-2.4,  2.6),   # dot 1
    (-2.4,  0.0),   # dot 2
    (-2.4, -2.6),   # dot 3
    ( 2.4,  2.6),   # dot 4
    ( 2.4,  0.0),   # dot 5
    ( 2.4, -2.6),   # dot 6
]

def add_spring(name, x, y, z_base, coils=8, od=3.5, wire_d=0.3, free_len=8.0):
    """
    Build a helical spring from torus segments stacked along Z.
    Simple approximation: stack flattened tori.
    """
    verts = []
    faces = []
    seg = 16         # segments per ring
    pitch = free_len / coils

    for c in range(coils):
        angle_start = c * 2 * math.pi
        for s in range(seg):
            a = angle_start + s * (2 * math.pi / seg)
            z = (c + s / seg) * pitch
            rx = (od / 2) * math.cos(a)
            ry = (od / 2) * math.sin(a)
            # wire cross-section (simple point, will look like a helix line)
            verts.append((x + rx, y + ry, z_base + z))

    # Connect as a line strip (no faces — just edges for clarity)
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [(i, i+1) for i in range(len(verts)-1)], [])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_mat(obj, mat_spring)
    return obj

for i, (dx, dy) in enumerate(dot_positions):
    add_spring(f"Return_Spring_dot{i+1}", dx, dy,
               z_base=Z["springs"] + 5,   # just below top plate
               coils=8, od=3.2, free_len=8.0)

add_label("Return Springs (×6)", (10, 10, Z["springs"] + 10))

# ─────────────────────────────────────────────────────────────────────────────
# 6.  ESP32 (placeholder — Seeed XIAO form factor 21×17.5mm)
#     Shown above the stack (external mount TBD per CHANGES.md)
# ─────────────────────────────────────────────────────────────────────────────
mat_esp_pcb = make_mat("MAT_ESP_PCB", (0.04, 0.18, 0.04, 1), roughness=0.9)
mat_esp_mod = make_mat("MAT_ESP_Module", (0.15, 0.15, 0.15, 1), metallic=0.2, roughness=0.7)
mat_esp_ant = make_mat("MAT_ESP_Antenna", (0.8, 0.8, 0.8, 1), metallic=0.7, roughness=0.3)

esp_board = add_box("ESP32_PCB", (21, 17.5, 1.6),
                    (0, 0, Z["esp32"]), mat_esp_pcb)

esp_module = add_box("ESP32_Module", (18, 25.5, 3.1),
                     (0, 0, Z["esp32"] + 2.35), mat_esp_mod)

# Antenna bump
esp_ant = add_box("ESP32_Antenna", (2, 6, 1),
                  (0, 14, Z["esp32"] + 2.5), mat_esp_ant)

# USB-C connector stub
usb = add_box("ESP32_USB_C", (5, 2, 3),
              (0, -10, Z["esp32"] + 1.2), make_mat("MAT_USB", (0.5,0.5,0.5,1), metallic=0.8))

add_label("ESP32 (XIAO / ext. mount)", (-30, 10, Z["esp32"] + 8))
add_label("⚠ ESP32 PLACEMENT TBD", (-30, 10, Z["esp32"] + 14), size=2)

# ─────────────────────────────────────────────────────────────────────────────
# 7.  POGO PIN CONNECTORS  (4-pin, 2mm pitch — on left & right walls of box)
#     Shown as small rectangles at mid-height on box side walls
# ─────────────────────────────────────────────────────────────────────────────
mat_pogo = make_mat("MAT_Pogo", (0.85, 0.75, 0.1, 1), metallic=0.7, roughness=0.2)

for side, label in [(-1, "Pogo_Spring_Side"), (1, "Pogo_Pad_Side")]:
    pogo = add_box(label, (4, 10, 8),
                   (side * 32, 0, Z["box"] + 14), mat_pogo)
    # individual pins
    for p in range(4):
        pin = add_cylinder(f"{label}_Pin{p}", radius=0.5, depth=6,
                           location=(side * 34, -3 + p*2, Z["box"] + 14),
                           mat=make_mat(f"MAT_PinMetal_{p}", (0.9,0.9,0.9,1), metallic=0.9))

add_label("Pogo Pins (4-pin UART)", (35, 15, Z["box"] + 20))

# ─────────────────────────────────────────────────────────────────────────────
# 8.  SELECT ALL NEW OBJECTS AND SET SCENE UNITS → mm
# ─────────────────────────────────────────────────────────────────────────────
bpy.context.scene.unit_settings.system       = "METRIC"
bpy.context.scene.unit_settings.scale_length = 0.001   # 1 Blender unit = 1 mm
bpy.context.scene.unit_settings.length_unit  = "MILLIMETERS"

# ─────────────────────────────────────────────────────────────────────────────
# 9.  COLLECTIONS — group hardware into a "Hardware_Components" collection
# ─────────────────────────────────────────────────────────────────────────────
hw_col_name = "Hardware_Components"
if hw_col_name not in bpy.data.collections:
    hw_col = bpy.data.collections.new(hw_col_name)
    bpy.context.scene.collection.children.link(hw_col)
else:
    hw_col = bpy.data.collections[hw_col_name]

hardware_keywords = [
    "Motor_", "ULN2003", "HallSensor", "Homing_Magnet",
    "Return_Spring", "ESP32", "Pogo_", "Label_",
]

for obj in bpy.data.objects:
    for kw in hardware_keywords:
        if obj.name.startswith(kw):
            # unlink from scene root collection if present
            for col in obj.users_collection:
                col.objects.unlink(obj)
            hw_col.objects.link(obj)
            break

print("=" * 60)
print("Braillix hardware models added successfully!")
print("Collection: 'Hardware_Components'")
print()
print("Parts added:")
print("  [1] 28BYJ-48 Stepper Motor   — Z = 0")
print("  [2] ULN2003 Driver Board     — Z = 0 (beside motor)")
print("  [3] Hall Effect Sensor SS49E — Z = 86 (on base plate)")
print("  [4] Homing Magnet 3mm NdFeB  — Z = 149 (cam underside)")
print("  [5] Return Springs ×6        — Z = 149 (below top plate)")
print("  [6] ESP32 XIAO (placeholder) — Z = 340 (ext. mount TBD)")
print("  [7] Pogo Pin Connectors ×2   — Z = 0  (box side walls)")
print()
print("Labels are in yellow — visible in viewport.")
print("Press NUMPAD 5 → NUMPAD 1 to get a front view of the stack.")
print("=" * 60)
