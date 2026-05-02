"""
Braillix — Hardware Models v2 (dimension-accurate)
===================================================
All dimensions pulled directly from the .scad files.

Key fixes vs v1:
  - Hall sensor floated 15mm above base plate layer (was buried inside it)
  - Pogo pins now EXTRUDE out of the box wall faces (not inside them)
  - pogo_z = floor_thickness + (shell_height - floor_thickness)/2 = 16mm (correct)
  - Motor placed BELOW base plate (hangs down from floor pocket)
  - Springs at exact dot grid positions from top_plate.scad
  - All sizes from .scad parameters, not guesses

Run: Blender → Scripting tab → Open this file → Run Script
"""

import bpy
import math

# ── CLEANUP: delete ALL objects from any previous run of this script ─────────
# Matches every name prefix used by v1 AND v2.
CLEANUP_PREFIXES = (
    # v1 prefixes
    "Motor_28BYJ48", "Motor_Ear", "Motor_Shaft", "Motor_Wire",
    "ULN2003", "HallSensor", "Homing_Magnet", "Return_Spring",
    "ESP32", "Pogo_", "Label_",
    # v2 prefixes
    "Motor_Body", "Motor_Wires",
    "HallSensor_Body", "HallSensor_Leg", "HallSensor_Wire",
    "Homing_Magnet_NdFeB",
    "ReturnSpring_",
    "Pogo_SpringSide", "Pogo_PadSide",
    "ESP32_XIAO", "ESP32_Module", "ESP32_Antenna", "ESP32_USB_C",
    "LBL_",
)

def _is_hw_obj(name):
    return any(name.startswith(p) for p in CLEANUP_PREFIXES)

# Delete objects
for obj in list(bpy.data.objects):
    if _is_hw_obj(obj.name):
        bpy.data.objects.remove(obj, do_unlink=True)

# Delete the old collection (will be recreated fresh below)
COL_NAME = "Hardware_Components"
if COL_NAME in bpy.data.collections:
    old_col = bpy.data.collections[COL_NAME]
    bpy.data.collections.remove(old_col)

# Purge orphaned meshes/curves left over
for block in list(bpy.data.meshes):
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in list(bpy.data.curves):
    if block.users == 0:
        bpy.data.curves.remove(block)

# Remove default cube if present
for obj in list(bpy.data.objects):
    if obj.name == "Cube":
        bpy.data.objects.remove(obj, do_unlink=True)

print("Cleanup done — previous hardware objects removed.")

# ── Helpers ──────────────────────────────────────────────────────────────────
def mat(name, rgb, metallic=0.0, rough=0.5, alpha=1.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value   = metallic
    b.inputs["Roughness"].default_value  = rough
    if alpha < 1:
        m.blend_method = "BLEND"
        b.inputs["Alpha"].default_value = alpha
    return m

def link(obj, col):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)

def cyl(name, r, h, loc, material, segs=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=segs, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return o

def box(name, sx, sy, sz, loc, material):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx/2, sy/2, sz/2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material)
    return o

def label(text, loc, size=2.0):
    bpy.ops.object.text_add(location=loc)
    o = bpy.context.active_object
    o.data.body = text
    o.data.size = size
    o.name = "LBL_" + text[:24]
    o.data.materials.append(mat("M_Label", (1, 0.9, 0.1)))
    return o

# ── True dimensions (from .scad) ─────────────────────────────────────────────
# outer_box.scad
SHELL_L, SHELL_W, SHELL_H = 78, 68, 28
WALL_T, FLOOR_T            = 4, 4
POGO_SLOT_W, POGO_SLOT_H   = 10, 8
POGO_Z = FLOOR_T + (SHELL_H - FLOOR_T) / 2   # = 16 mm above box bottom

# base_plate.scad
BASE_L, BASE_W, BASE_T     = 60, 50, 5
MOTOR_DIA                  = 28.3
MOTOR_H                    = 19.0        # 28BYJ-48 body height
MOTOR_MOUNT_SPACING        = 31          # ear-to-ear centre distance
STANDOFF_OFFSET            = 15          # ±15mm from plate centre
STANDOFF_H                 = 3.5
HALL_X, HALL_Y             = 19, 0
HALL_W, HALL_D, HALL_H     = 5, 4, 3    # pocket dimensions

# top_plate.scad
COL_SPACING = 4.8      # ±2.4mm columns
ROW_SPACING = 2.6      # ±2.6, 0
SPRING_OD   = 3.5
SPRING_D    = 1.5      # pocket depth

# braille_cam2.scad
INNER_R   = 8.0
TRACK_W   = 1.6
TRACK_GAP = 0.1
MAGNET_R  = 17.35
DISK_BASE_T = 2.0
PIN_LIFT    = 0.8

# ── Exploded view Z layers (from CHANGES.md, matching existing .blend) ────────
Z_BOX   = 0
Z_BASE  = 86
Z_CAM   = 149.5
Z_LINK  = 214.5
Z_TOP   = 275.5

# ── Collection ───────────────────────────────────────────────────────────────
COL_NAME = "Hardware_Components"
if COL_NAME not in bpy.data.collections:
    hw = bpy.data.collections.new(COL_NAME)
    bpy.context.scene.collection.children.link(hw)
else:
    hw = bpy.data.collections[COL_NAME]

objs = []  # track everything added

# ── Materials ────────────────────────────────────────────────────────────────
M_MOTOR    = mat("M_Motor",    (0.15, 0.15, 0.15), metallic=0.3, rough=0.7)
M_SHAFT    = mat("M_Shaft",    (0.55, 0.55, 0.55), metallic=0.85, rough=0.2)
M_COPPER   = mat("M_Copper",   (0.8,  0.45, 0.1 ), metallic=0.9, rough=0.3)
M_PCB      = mat("M_PCB",      (0.03, 0.22, 0.04), rough=0.9)
M_IC       = mat("M_IC",       (0.08, 0.08, 0.08), rough=1.0)
M_SENSOR   = mat("M_Sensor",   (0.1,  0.1,  0.1 ), rough=0.95)
M_LEG      = mat("M_Leg",      (0.7,  0.7,  0.7 ), metallic=0.8, rough=0.2)
M_MAGNET   = mat("M_Magnet",   (0.75, 0.1,  0.1 ), metallic=0.7, rough=0.3)
M_SPRING   = mat("M_Spring",   (0.65, 0.65, 0.65), metallic=0.9, rough=0.2)
M_POGO     = mat("M_Pogo",     (0.9,  0.8,  0.1 ), metallic=0.8, rough=0.2)
M_ESP_PCB  = mat("M_ESP_PCB",  (0.03, 0.18, 0.04), rough=0.9)
M_ESP_MOD  = mat("M_ESP_Mod",  (0.12, 0.12, 0.12), metallic=0.2, rough=0.7)

# ─────────────────────────────────────────────────────────────────────────────
# 1. 28BYJ-48 STEPPER MOTOR
#    Body: Ø28.3mm, 19mm tall.
#    Motor is seated from BELOW into base plate floor pocket.
#    In exploded view base plate is at Z_BASE=86.
#    Base plate bottom = Z_BASE, floor pocket = 1.5mm deep on BOTTOM face,
#    so motor TOP is at Z_BASE (flush with base bottom), body extends DOWN.
#    Motor bottom = Z_BASE - MOTOR_H = 86 - 19 = 67 → centre Z = 86 - 9.5 = 76.5
# ─────────────────────────────────────────────────────────────────────────────
motor_cz = Z_BASE - MOTOR_H/2       # = 76.5
objs += [cyl("Motor_Body", MOTOR_DIA/2, MOTOR_H, (0, 0, motor_cz), M_MOTOR)]

# Mounting ears: 4mm wide, 3mm thick tabs at ±motor_mount_spacing/2 = ±15.5mm
for s in (-1, 1):
    objs += [box(f"Motor_Ear_{'L' if s<0 else 'R'}", 8, 5, 3,
                 (s * MOTOR_MOUNT_SPACING/2, 0, Z_BASE - 3), M_MOTOR)]

# D-shaft: Ø5mm, sticks 10mm UP from motor top (through base plate, into cam)
objs += [cyl("Motor_Shaft", 2.5, 10, (0, 0, Z_BASE + 5), M_SHAFT)]

# Wire harness stub (5 wires exit side)
objs += [box("Motor_Wires", 4, 2, 18, (-16, 0, motor_cz + 3), M_COPPER)]

objs += [label("28BYJ-48 Stepper Motor", (18, 10, motor_cz + 5), size=2)]

# ─────────────────────────────────────────────────────────────────────────────
# 2. ULN2003 DRIVER BOARD  (28×35mm PCB, beside motor below base plate)
#    Positioned at X=-50 (offset so it's clearly visible, not inside box walls)
# ─────────────────────────────────────────────────────────────────────────────
ULN_X = -50
objs += [box("ULN2003_PCB", 28, 35, 1.6, (ULN_X, 0, motor_cz), M_PCB)]
objs += [box("ULN2003_IC",   7, 14, 3.5, (ULN_X, 0, motor_cz + 2.5), M_IC)]

LED_COLS = [(1,0.1,0.1), (0.1,1,0.1), (1,0.5,0), (0.1,0.1,1)]
for i, c in enumerate(LED_COLS):
    bpy.ops.mesh.primitive_cube_add(location=(ULN_X - 8 + i*4, -14, motor_cz + 2))
    led = bpy.context.active_object
    led.name = f"ULN2003_LED_{i}"
    led.scale = (1, 0.8, 1.5)
    bpy.ops.object.transform_apply(scale=True)
    led.data.materials.append(mat(f"M_LED{i}", c, rough=0.1))
    objs.append(led)

objs += [label("ULN2003 Driver Board", (ULN_X - 20, 20, motor_cz + 8), size=2)]

# ─────────────────────────────────────────────────────────────────────────────
# 3. HALL EFFECT SENSOR (SS49E / A3144)
#    Sits in pocket on BASE PLATE TOP at X=19, Y=0.
#    Pocket: 5×4×3mm deep. Sensor body: ~4×3×1.5mm.
#    In exploded view: base plate bottom = Z_BASE=86, plate is 5mm thick,
#    so plate TOP = Z_BASE + BASE_T = 91.
#    Pocket starts at Z = 91 - 3 = 88, sensor top = 91.
#    Float it 12mm ABOVE plate top so it's clearly visible → Z_centre = 91 + 12 + 1.5 = 104.5
# ─────────────────────────────────────────────────────────────────────────────
HALL_FLOAT_Z = Z_BASE + BASE_T + 15   # = 106
objs += [box("HallSensor_Body", HALL_W, HALL_D, HALL_H,
             (HALL_X, HALL_Y, HALL_FLOAT_Z + HALL_H/2), M_SENSOR)]

# 3 legs (0.5mm dia, 6mm long, pointing DOWN)
for i, yo in enumerate([-1, 0, 1]):
    objs += [cyl(f"HallSensor_Leg{i}", 0.4, 7,
                 (HALL_X, yo, HALL_FLOAT_Z - 3.5), M_LEG, segs=8)]

# Dashed line from sensor down to pocket position (thin box = wire)
objs += [box("HallSensor_Wire", 0.5, 0.5, 12,
             (HALL_X, HALL_Y, Z_BASE + BASE_T + 6), M_LEG)]

objs += [label("Hall Sensor SS49E\n(homing — X=19mm)", (HALL_X + 6, 6, HALL_FLOAT_Z + 5), size=1.8)]

# ─────────────────────────────────────────────────────────────────────────────
# 4. NEODYMIUM HOMING MAGNET (3mm dia × 2mm thick)
#    On cam disc UNDERSIDE at radius 17.35mm, angle 0° → (17.35, 0)
#    Cam disc bottom = Z_CAM, so magnet centre = Z_CAM - 1
# ─────────────────────────────────────────────────────────────────────────────
objs += [cyl("Homing_Magnet_NdFeB", 1.5, 2, (MAGNET_R, 0, Z_CAM - 1), M_MAGNET)]
objs += [label("NdFeB Magnet (3mm)\nhoming ref", (MAGNET_R + 5, 5, Z_CAM + 3), size=1.8)]

# ─────────────────────────────────────────────────────────────────────────────
# 5. RETURN SPRINGS ×6 (compression, Ø3.5mm OD, ~8mm free length)
#    Sit in 3.5mm dia × 1.5mm pockets on top plate UNDERSIDE.
#    Top plate bottom = Z_TOP, springs hang DOWN from it.
#    Spring centre Z = Z_TOP - 4 (midpoint of 8mm spring)
#    X/Y = dot positions: (±col_spacing/2, ±row_spacing, 0)
# ─────────────────────────────────────────────────────────────────────────────
dot_xy = [
    (-COL_SPACING/2,  ROW_SPACING),
    (-COL_SPACING/2,  0),
    (-COL_SPACING/2, -ROW_SPACING),
    ( COL_SPACING/2,  ROW_SPACING),
    ( COL_SPACING/2,  0),
    ( COL_SPACING/2, -ROW_SPACING),
]

SPRING_FREE_LEN = 8.0
SPRING_COILS    = 10
WIRE_R          = 0.25

for i, (dx, dy) in enumerate(dot_xy):
    verts = []
    for step in range(SPRING_COILS * 16):
        frac = step / (SPRING_COILS * 16)
        angle = frac * SPRING_COILS * 2 * math.pi
        r = SPRING_OD / 2 - WIRE_R
        vx = dx + r * math.cos(angle)
        vy = dy + r * math.sin(angle)
        vz = (Z_TOP - SPRING_FREE_LEN) + frac * SPRING_FREE_LEN
        verts.append((vx, vy, vz))

    mesh = bpy.data.meshes.new(f"Spring_dot{i+1}_mesh")
    edges = [(j, j+1) for j in range(len(verts)-1)]
    mesh.from_pydata(verts, edges, [])
    mesh.update()
    spr = bpy.data.objects.new(f"ReturnSpring_dot{i+1}", mesh)
    bpy.context.collection.objects.link(spr)
    spr.data.materials.append(M_SPRING)
    objs.append(spr)

objs += [label("Return Springs ×6\n(Ø3.5mm compression)", (12, 12, Z_TOP - 5), size=1.8)]

# ─────────────────────────────────────────────────────────────────────────────
# 6. POGO PIN CONNECTORS
#    outer_box.scad: pogo_z = floor_thickness + (shell_height - floor_thickness)/2
#                           = 4 + (28-4)/2 = 4 + 12 = 16mm above BOX BOTTOM (Z_BOX)
#    Left wall at X = -shell_length/2 = -39mm (spring pins face LEFT, extrude OUT)
#    Right wall at X = +shell_length/2 = +39mm (pad side, extrude OUT)
#    Slot cutout: pogo_slot_w=10mm (Y), pogo_slot_h=8mm (Z), wall_thickness=4mm (X)
#    The CONNECTOR PCB/body sits inside the slot, pins extrude OUTWARD.
# ─────────────────────────────────────────────────────────────────────────────
POGO_Z_ABS = Z_BOX + POGO_Z           # = 16mm
WALL_X_L   = -SHELL_L/2              # = -39mm
WALL_X_R   =  SHELL_L/2              # = +39mm

for side, name, x_wall in [(-1, "Pogo_SpringSide", WALL_X_L),
                             (1,  "Pogo_PadSide",   WALL_X_R)]:
    # Connector body flush with inner wall face, 4mm deep into the slot
    body_x = x_wall + side * (WALL_T / 2)    # centre of connector in wall
    objs += [box(f"{name}_Body", WALL_T + 2, POGO_SLOT_W, POGO_SLOT_H,
                 (body_x, 0, POGO_Z_ABS), M_POGO)]

    # 4 individual pins extruding OUTWARD (2mm pitch, Y-axis)
    PIN_PROTRUDE = 5  # mm sticking out from wall face
    pin_start_x  = x_wall + side * (WALL_T/2 + 1)   # starts at outer wall face
    for p in range(4):
        py = -3 + p * 2   # 2mm pitch, centred
        pin_tip_x = pin_start_x + side * PIN_PROTRUDE
        pin_mid_x = (pin_start_x + pin_tip_x) / 2
        objs += [cyl(f"{name}_Pin{p}", 0.5, PIN_PROTRUDE,
                     (pin_mid_x, py, POGO_Z_ABS),
                     mat(f"M_PinMetal_{side}_{p}", (0.9, 0.9, 0.9), metallic=0.95, rough=0.1),
                     segs=8)]
        # Rotate pin to horizontal (X-axis)
        pin = objs[-1]
        pin.rotation_euler = (0, math.radians(90), 0)
        bpy.ops.object.transform_apply(rotation=True)

    side_label = "Spring Pins →" if side == -1 else "← Contact Pads"
    objs += [label(f"Pogo Connector\n{side_label}\n(5V GND TX RX)",
                   (x_wall + side * 15, 12, POGO_Z_ABS + 8), size=1.8)]

# ─────────────────────────────────────────────────────────────────────────────
# 7. ESP32 (Seeed XIAO ESP32-C3: 21×17.5×3.7mm)
#    Marked as TBD — shown floating above the stack
# ─────────────────────────────────────────────────────────────────────────────
ESP_Z = Z_TOP + 60
objs += [box("ESP32_XIAO_PCB",    21,   17.5, 1.6, (0, 0, ESP_Z),         M_ESP_PCB)]
objs += [box("ESP32_Module",      13.5, 15,   2.5, (0, 0, ESP_Z + 2),     M_ESP_MOD)]
objs += [box("ESP32_Antenna",     2,    5,    1,   (0, 9.5, ESP_Z + 2),   M_SHAFT)]
objs += [box("ESP32_USB_C",       5,    1.8,  2.5, (0, -10, ESP_Z + 1),   M_SHAFT)]
objs += [label("ESP32 XIAO C3\n⚠ Placement TBD\n(see CHANGES.md)",
               (-30, 12, ESP_Z + 6), size=1.8)]

# ─────────────────────────────────────────────────────────────────────────────
# 8. Assign everything to Hardware_Components collection
# ─────────────────────────────────────────────────────────────────────────────
for obj in objs:
    if obj is None:
        continue
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    hw.objects.link(obj)

# ── Scene units → mm ─────────────────────────────────────────────────────────
bpy.context.scene.unit_settings.system       = "METRIC"
bpy.context.scene.unit_settings.scale_length = 0.001
bpy.context.scene.unit_settings.length_unit  = "MILLIMETERS"

# ── Summary ──────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("Braillix Hardware Models v2 — added successfully")
print("="*60)
print(f"  Motor body centre    Z = {motor_cz:.1f} mm  (below base plate)")
print(f"  Motor shaft tip      Z = {Z_BASE + 10:.1f} mm  (into cam)")
print(f"  ULN2003 board        X = {ULN_X}, Z = {motor_cz:.1f}")
print(f"  Hall sensor (float)  X = {HALL_X}, Z = {HALL_FLOAT_Z:.1f} mm")
print(f"  Homing magnet        X = {MAGNET_R}, Z = {Z_CAM - 1:.1f} mm")
print(f"  Return springs ×6    Z = {Z_TOP - SPRING_FREE_LEN:.1f}–{Z_TOP:.1f} mm")
print(f"  Pogo L-wall          X = {WALL_X_L:.1f}, Z = {POGO_Z_ABS:.1f} mm")
print(f"  Pogo R-wall          X = {WALL_X_R:.1f}, Z = {POGO_Z_ABS:.1f} mm")
print(f"  ESP32 XIAO           Z = {ESP_Z:.1f} mm (TBD placeholder)")
print("="*60)
print("Collection 'Hardware_Components' created.")
print("Press NUMPAD-1 + NUMPAD-5 for front ortho view of the stack.")
