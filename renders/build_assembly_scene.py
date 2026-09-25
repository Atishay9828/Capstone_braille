"""
Braillix v5.0 — Full Assembly Scene Builder
============================================
Open Blender → Scripting tab → Open this file → Run Script (Alt+P)

Creates two collections:
  1. Final_Assembly   — all parts at correct v5.0 z-stack positions
  2. Exploded_Assembly — same parts Z-separated for inspection

Features visible:
  - Wire gutters, wire hooks, pogo carrier pockets (outer box)
  - Button holes + switch pockets (pod)
  - Magnet pockets (both cell + pod)
  - Header socket channels (pod)
  - Through-bolt bosses, muscle-board bosses
  - Mid-plate wire pass-throughs
  - Linkage comb diagonal slits

Does NOT render — just sets up the scene.  Press F12 yourself when ready.
"""

import bpy
import os
import math

# ─── CONFIG ───────────────────────────────────────────────────────────
STL_DIR = r"D:\TIET\Capstone\cad\stl"

# v5.0 z-stack positions (mm) — from plan Part A
PARTS = {
    # (filename,          z_final,  z_exploded, color_hex,   alpha, label)
    "outer_box":         (0,        0,          "404040",    0.35,  "Outer Box (cell)"),
    "mid_plate":         (20,       70,         "7A7A7A",    0.9,   "Mid-Plate"),
    "base_plate":        (41,       140,        "5C5C5C",    0.9,   "Base Plate"),
    "braille_cam2":      (43,       200,        "3399FF",    0.85,  "Cam Disc"),
    "linkage_comb":      (48,       240,        "33AA66",    0.8,   "Linkage Comb"),
    "linkage":           (45,       270,        "C0C0C0",    0.9,   "Linkages x6"),
    "top_plate":         (54,       320,        "F5F5DC",    0.9,   "Top Plate"),
    "esp32_pod_shell":   (0,        0,          "4682B4",    0.35,  "ESP32 Pod Shell"),
    "esp32_pod_lid":     (54,       360,        "B0C4DE",    0.85,  "ESP32 Pod Lid"),
    "nav_cap":           (0,        390,        "E8E8E8",    0.9,   "Nav Caps x3"),
    "pogo_end_cap":      (0,        410,        "90EE90",    0.9,   "Pogo End Cap"),
}

# Pod offset from cell (docked on -X side)
POD_X_OFFSET = -68  # pod docking face flush against cell -X wall

# Exploded view X offset
EXPLODE_X = 150


# ─── HELPERS ──────────────────────────────────────────────────────────
def hex_to_rgba(hex_str, alpha=1.0):
    r = int(hex_str[0:2], 16) / 255
    g = int(hex_str[2:4], 16) / 255
    b = int(hex_str[4:6], 16) / 255
    return (r, g, b, alpha)


def create_material(name, hex_color, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        rgba = hex_to_rgba(hex_color, alpha)
        bsdf.inputs["Base Color"].default_value = rgba
        if alpha < 1.0:
            mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
            bsdf.inputs["Alpha"].default_value = alpha
    mat.use_backface_culling = True
    return mat


def import_stl(filepath, name):
    """Import STL and return the object."""
    bpy.ops.wm.stl_import(filepath=filepath)
    obj = bpy.context.selected_objects[0]
    obj.name = name
    obj.data.name = name + "_mesh"
    return obj


def link_to_collection(obj, collection):
    """Move object to a specific collection."""
    # Remove from all current collections
    for col in obj.users_collection:
        col.objects.unlink(obj)
    collection.objects.link(obj)


# ─── MAIN ─────────────────────────────────────────────────────────────
def build_scene():
    # 1. Clean slate
    bpy.ops.wm.read_factory_settings(use_empty=True)

    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 0.001  # mm

    # 2. Create collections
    final_col = bpy.data.collections.new("Final_Assembly")
    scene.collection.children.link(final_col)

    exploded_col = bpy.data.collections.new("Exploded_Assembly")
    scene.collection.children.link(exploded_col)

    # 3. Import and place each part
    for part_name, (z_final, z_explode, color, alpha, label) in PARTS.items():
        stl_path = os.path.join(STL_DIR, part_name + ".stl")
        if not os.path.exists(stl_path):
            print(f"  SKIP (not found): {stl_path}")
            continue

        print(f"  Importing: {part_name}...")
        mat = create_material(f"mat_{part_name}", color, alpha)

        # --- FINAL ASSEMBLY copy ---
        obj_final = import_stl(stl_path, f"{label}")

        # Position
        is_pod = "pod" in part_name or "nav_cap" in part_name
        is_pogo_cap = "pogo" in part_name

        if is_pod and "lid" in part_name:
            obj_final.location = (POD_X_OFFSET, 0, z_final / 1000)
        elif is_pod:
            obj_final.location = (POD_X_OFFSET, 0, 0)
        elif is_pogo_cap:
            obj_final.location = (0.034, 0, 0.031)  # right wall pogo slot
        else:
            obj_final.location = (0, 0, z_final / 1000)

        # Material
        obj_final.data.materials.clear()
        obj_final.data.materials.append(mat)

        # Shade flat (FDM look)
        for poly in obj_final.data.polygons:
            poly.use_smooth = False

        link_to_collection(obj_final, final_col)

        # --- EXPLODED ASSEMBLY copy ---
        obj_exploded = obj_final.copy()
        obj_exploded.data = obj_final.data.copy()
        obj_exploded.name = f"{label} (exploded)"

        if is_pod:
            obj_exploded.location = (POD_X_OFFSET + EXPLODE_X / 1000, 0, z_explode / 1000)
        elif is_pogo_cap:
            obj_exploded.location = (EXPLODE_X / 1000, 0, 410 / 1000)
        else:
            obj_exploded.location = (EXPLODE_X / 1000, 0, z_explode / 1000)

        link_to_collection(obj_exploded, exploded_col)

    # 4. Ghost objects — motor, ESP32 PCB, muscle board
    print("  Adding ghost objects (motor, PCBs)...")

    # 28BYJ-48 motor body (cylinder Ø28×19mm at x=-8, z=22 in cell)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.014, depth=0.019,
        location=(-.008, 0, 0.0315)  # z = 22 + 19/2 = 31.5mm
    )
    motor = bpy.context.active_object
    motor.name = "Ghost_Motor_28BYJ48"
    motor_mat = create_material("mat_motor", "444444", 0.3)
    motor.data.materials.append(motor_mat)
    link_to_collection(motor, final_col)

    # Motor shaft (cylinder Ø5×10mm above motor)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.0025, depth=0.010,
        location=(0, 0, 0.046)  # z=41+5=46mm centre
    )
    shaft = bpy.context.active_object
    shaft.name = "Ghost_Motor_Shaft"
    shaft.data.materials.append(motor_mat)
    link_to_collection(shaft, final_col)

    # Muscle board PCB (34×44mm in electronics pocket, z=8mm on bosses)
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(0, 0, 0.010)  # z = 4(floor) + 4(boss) + 1.6/2
    )
    pcb = bpy.context.active_object
    pcb.name = "Ghost_Muscle_Board"
    pcb.scale = (0.034/2, 0.044/2, 0.0016/2)
    pcb_mat = create_material("mat_pcb", "228B22", 0.4)
    pcb.data.materials.append(pcb_mat)
    link_to_collection(pcb, final_col)

    # ESP32 DevKit V1 PCB (51.5×28mm in pod, on headers at z=8.5+3=11.5mm)
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(POD_X_OFFSET + 0.004, 0, 0.0125)  # floor(3) + header(8.5) + pcb/2
    )
    esp_pcb = bpy.context.active_object
    esp_pcb.name = "Ghost_ESP32_DevKit"
    esp_pcb.scale = (0.0515/2, 0.028/2, 0.0016/2)
    esp_mat = create_material("mat_esp32", "006400", 0.4)
    esp_pcb.data.materials.append(esp_mat)
    link_to_collection(esp_pcb, final_col)

    # 5. Camera
    print("  Setting up camera + lights...")
    bpy.ops.object.camera_add(
        location=(0.25, -0.25, 0.20),
        rotation=(math.radians(60), 0, math.radians(45))
    )
    cam = bpy.context.active_object
    cam.name = "Assembly_Camera"
    cam.data.lens = 50
    cam.data.clip_end = 10
    scene.camera = cam
    link_to_collection(cam, scene.collection)

    # 6. Lights — 4× SUN for even illumination (distance-independent, good for mm-scale)
    sun_configs = [
        ("Key",     (math.radians(45), 0, math.radians(-45)),  5.0),
        ("Fill",    (math.radians(60), 0, math.radians(135)),  2.0),
        ("Rim",     (math.radians(30), 0, math.radians(210)),  3.0),
        ("Top",     (0, 0, 0),                                 3.0),
    ]
    for name, rot, energy in sun_configs:
        bpy.ops.object.light_add(type='SUN', location=(0, 0, 0.5), rotation=rot)
        light = bpy.context.active_object
        light.name = f"Sun_{name}"
        light.data.energy = energy
        link_to_collection(light, scene.collection)

    # 7. Render settings (don't render — just configure)
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'ShaderNodeEeveeSpecular') else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.filepath = r"D:\TIET\Capstone\renders\assembly_v5.png"

    # 8. World background
    world = bpy.data.worlds.new("Assembly_World")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.15, 0.15, 0.18, 1.0)
        bg.inputs["Strength"].default_value = 0.5
    scene.world = world

    # 9. Hide exploded collection by default (toggle in outliner)
    exploded_col.hide_viewport = True

    print("\n=== DONE ===")
    print("Final_Assembly: all parts at v5.0 z-stack positions")
    print("Exploded_Assembly: Z-separated (hidden — unhide in Outliner)")
    print("")
    print("The outer box and pod shell are semi-transparent so you can")
    print("see wire gutters, bosses, magnet pockets, and switch pockets inside.")
    print("")
    print("To render: press F12 (or ask me first!)")
    print(f"Output path: {scene.render.filepath}")


# ─── RUN ──────────────────────────────────────────────────────────────
build_scene()
