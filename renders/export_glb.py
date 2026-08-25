#!/usr/bin/env python
"""
export_glb.py — turn the Braillix STLs into one web-ready model for the 3D simulator.

    "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" ^
        --background --factory-startup --python renders/export_glb.py

Output: sim/3d/braillix.glb

WHY BLENDER IS ONLY THE ASSET PIPELINE HERE
The simulator needs orbit/pan/zoom, an X-ray toggle and a kinematics toggle. Blender
renders a fixed video and cannot do any of that, so the interactive part is a Three.js
app. Blender's job is just to assemble the STLs onto the real z-stack, name the parts,
and emit a single GLB the browser can load.

UNITS ARE MILLIMETRES. 1 Blender unit = 1 mm, deliberately: every number in
sim/braillix_params.json is in mm, so the web app can use them directly with no
conversion. Nothing is rendered here, so the usual "work in metres" advice does not
apply.

OBJECT NAMES ARE AN API. The web app looks parts up by name — outer_box, top_plate,
dot_insert, mid_plate, base_plate, cam, linkage_1..6, motor_body, motor_shaft,
motor_ear_l, motor_ear_r. Renaming anything here breaks sim/3d/app.js.
"""
import bpy
import json
import math
import os
import sys

ROOT = r"D:\TIET\Capstone"
STL = os.path.join(ROOT, "cad", "stl")
OUT_DIR = os.path.join(ROOT, "sim", "3d")
OUT = os.path.join(OUT_DIR, "braillix.glb")

P = json.load(open(os.path.join(ROOT, "sim", "braillix_params.json")))
CAM_FLAT = P["stack"]["cam_flat_z"]          # 45.0
BASE_PLATE_Z = 41.0                          # base-plate underside == motor face

# name -> (z offset, hex colour, alpha, metallic, roughness)
# Z values are the NOMINAL INTENDED stack. Two 2mm errors in the real stack are still
# being re-derived (see .ai-sync/handoff.md); this model shows design intent and the
# narration says so.
PARTS = {
    "outer_box":   (0.0,          "5A6B7C", 1.00, 0.05, 0.75),
    "mid_plate":   (20.0,         "8A8A8A", 1.00, 0.10, 0.85),
    "base_plate":  (BASE_PLATE_Z, "6E6E6E", 1.00, 0.10, 0.85),
    "braille_cam": (43.0,         "E94560", 1.00, 0.35, 0.35),  # local z=2 -> flat at 45
    "top_plate":   (54.0,         "EDE6D6", 1.00, 0.05, 0.70),
    "dot_insert":  (54.0,         "FAFAFA", 1.00, 0.05, 0.35),
    # v8.2: linkage_comb.scad measures rest_z RELATIVE to cam flat, so the STL
    # exports flat for printing and has to be lifted by cam_flat_z here. Its base
    # then lands on the base-plate top at 46, which is what it rests on.
    # It closes a pocket round every linkage foot, which is what stops the feet
    # sliding tangentially now that they only REST on the cam.
    "linkage_comb": (45.0,        "9AA3B2", 1.00, 0.05, 0.60),
}
RENAME = {"braille_cam": "cam", "linkage_comb": "comb"}
LINKAGE_MAT = ("C8CDD4", 1.00, 0.90, 0.25)   # shiny metal, as specified

# 28BYJ-48. M1/M2/M6 are Codex's researched values (docs/MEASUREMENT_RESEARCH.md);
# M5 and the ear envelope are still unverified, so the motor is indicative only.
MOTOR = dict(dia=28.0, height=19.0, x_offset=-8.0,
             shaft_dia=5.0, shaft_len=9.5, ear_span=35.0, ear_w=7.0, ear_t=1.0)


def rgba(hx, a=1.0):
    return (*(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)), a)


def material(name, hx, alpha=1.0, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba(hx)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = 'BLEND'
    return m


def import_stl(path, name):
    """Import and FAIL LOUDLY if missing.

    renders/build_assembly_scene.py silently skipped absent STLs, which is how it kept
    'working' long after braille_cam2.stl and linkage_comb.stl ceased to exist.
    """
    if not os.path.exists(path):
        sys.exit(f"MISSING STL: {path}\n"
                 f"  For linkage_asm_*.stl run:\n"
                 f"  for d in 1..6: openscad -D dot=$d -o cad/stl/linkage_asm_$d.stl "
                 f"cad/scad/export_linkage_assembly.scad")
    before = set(bpy.data.objects)
    bpy.ops.wm.stl_import(filepath=path, global_scale=1.0)   # keep millimetres
    new = set(bpy.data.objects) - before
    if len(new) != 1:
        sys.exit(f"expected 1 object from {path}, got {len(new)}")
    obj = new.pop()
    obj.name = name
    obj.data.name = name + "_mesh"
    return obj


def add_motor():
    """Indicative 28BYJ-48 so the X-ray view shows what drives the cam.

    There is no motor STL in the repo. renders/add_hardware_models.py builds one, but
    against the stale v5 z-stack, so the geometry idea is reused and the heights are
    re-derived from BASE_PLATE_Z here.
    """
    made = []
    body_mat = material("mat_motor", "9BA3AA", 1.0, 0.85, 0.30)
    shaft_mat = material("mat_shaft", "D8DDE2", 1.0, 0.95, 0.15)
    cx, z_top = MOTOR["x_offset"], BASE_PLATE_Z

    bpy.ops.mesh.primitive_cylinder_add(
        radius=MOTOR["dia"] / 2, depth=MOTOR["height"], vertices=48,
        location=(cx, 0, z_top - MOTOR["height"] / 2))
    b = bpy.context.object
    b.name = "motor_body"
    b.data.materials.append(body_mat)
    made.append(b)

    # shaft rises from the motor face into the cam bore (x=0 — NOT the body centre;
    # the 28BYJ-48 shaft is offset ~8mm, which is why the body sits at x=-8)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=MOTOR["shaft_dia"] / 2, depth=MOTOR["shaft_len"], vertices=24,
        location=(0, 0, z_top + MOTOR["shaft_len"] / 2))
    s = bpy.context.object
    s.name = "motor_shaft"
    s.data.materials.append(shaft_mat)
    made.append(s)

    for sign, nm in ((-1, "motor_ear_l"), (1, "motor_ear_r")):
        bpy.ops.mesh.primitive_cube_add(
            size=1, location=(cx + sign * MOTOR["ear_span"] / 2, 0,
                              z_top - MOTOR["ear_t"] / 2))
        e = bpy.context.object
        e.name = nm
        e.scale = (MOTOR["ear_w"], MOTOR["ear_w"], MOTOR["ear_t"])
        e.data.materials.append(body_mat)
        made.append(e)
    return made


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    built = []

    for name, (z, hx, alpha, metal, rough) in PARTS.items():
        o = import_stl(os.path.join(STL, name + ".stl"), RENAME.get(name, name))
        o.location = (0, 0, z)
        o.data.materials.append(material(f"mat_{o.name}", hx, alpha, metal, rough))
        built.append(o)

    hx, alpha, metal, rough = LINKAGE_MAT
    link_mat = material("mat_linkage", hx, alpha, metal, rough)
    for d in range(1, 7):
        o = import_stl(os.path.join(STL, f"linkage_asm_{d}.stl"), f"linkage_{d}")
        # the STL already carries its assembly XY; Z=0 in it is the cam surface, so
        # parking it at cam_flat_z puts every dot in its DOWN state
        o.location = (0, 0, CAM_FLAT)
        o.data.materials.append(link_mat)
        built.append(o)

    built += add_motor()

    for o in built:
        o.select_set(True)
    bpy.context.view_layer.objects.active = built[0]

    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=False,   # keep Z-up; the app matches the CAD
        export_materials='EXPORT', export_cameras=False, export_lights=False)

    names = sorted(o.name for o in built)
    tris = sum(len(o.data.polygons) for o in built if o.type == 'MESH')
    print("\n=== GLB export ===")
    print(f"  objects  {len(built)}")
    print(f"  names    {names}")
    print(f"  polys    {tris}")
    print(f"  size     {os.path.getsize(OUT)/1e6:.2f} MB")
    print(f"  output   {OUT}\n")

    required = {"outer_box", "top_plate", "dot_insert", "mid_plate", "base_plate",
                "cam", "motor_body", "motor_shaft"} | {f"linkage_{d}" for d in range(1, 7)}
    missing = required - set(names)
    if missing:
        sys.exit(f"FAIL: GLB is missing required objects: {sorted(missing)}")
    print("  all required object names present   OK")


if __name__ == "__main__":
    main()
