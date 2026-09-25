"""Convert the downloaded 28BYJ-48 into sim/3d/motor.glb.

Source: "28BYJ-48 5V Stepper Motor" by NandouTech, Sketchfab, CC-BY.
Downloaded manually (Sketchfab requires an account) to cad/models/.

Three things are wrong with it as shipped:

  1. a stray 2x2x2 'Cube' primitive sits in the file
  2. the leads are five straight 2x2x20 sticks poking out of the back — fine for a
     product thumbnail, useless here, and they collide with the box wall
  3. it is modelled with the motor axis along -Y, origin in a corner

So: drop the cube, drop the five sticks, and re-land it with the OUTPUT SHAFT on
the origin and the can bottom at z=0, which is what sim/3d/app.js expects. The
real loom is drawn in electronics.js instead.

    blender --background --factory-startup --python renders/export_motor_glb.py
"""
import bpy
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "cad", "models", "kicad", "28byj-48__5v_stepper_motor.glb")
OUT = os.path.join(ROOT, "sim", "3d", "motor.glb")

# measured off the source file (see the inspection in renders/, or re-derive):
# body spans y -19..0 with the output face at y=-19; shaft axis at x=21, z=6.
SHAFT_X, SHAFT_Z = 21.0, 6.0


def is_fake_wire(o):
    """Anything living entirely above the can.

    Matching on the 2x2x20 shape missed each lead's two end-cap discs, which are
    separate loose parts and survived — so the leads vanished but their caps kept
    the bounding box 52.5 tall. The can tops out at z=28 in source coordinates, so
    'above 30' is unambiguous and catches every piece of every lead.
    """
    return min((o.matrix_world @ v.co).z for v in o.data.vertices) > 30.0


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)

    for o in list(bpy.data.objects):
        if o.type != 'MESH' or o.name == 'Cube':
            bpy.data.objects.remove(o, do_unlink=True)

    o = [x for x in bpy.data.objects if x.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')

    pieces = [x for x in bpy.data.objects if x.type == 'MESH']
    killed = 0
    for p in list(pieces):
        if is_fake_wire(p):
            bpy.data.objects.remove(p, do_unlink=True)
            killed += 1
    print(f"  lead pieces removed: {killed}")

    keep = [x for x in bpy.data.objects if x.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for p in keep:
        p.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.join()
    m = bpy.context.active_object
    m.name = "motor_28byj48"

    # -Y (the output direction) -> +Z, then drop the shaft onto the origin and
    # swing the body's 8mm offset onto -X so it matches MOTOR.xOffset in the CAD.
    # Transform the mesh data directly. bpy.ops.object.transform_apply kept
    # reporting success while applying only the translation — the rotations were
    # silently dropped after the join. A matrix on the mesh has no such ambiguity.
    from mathutils import Matrix
    rx = Matrix.Rotation(math.radians(-90), 4, 'X')   # -Y (output) -> +Z
    tr = Matrix.Translation((-SHAFT_X, -SHAFT_Z, 0))  # shaft axis -> origin
    rz = Matrix.Rotation(math.radians(90), 4, 'Z')    # body offset -> -X
    m.data.transform(rz @ tr @ rx)
    m.matrix_world = Matrix.Identity(4)
    m.data.update()

    vs = [m.matrix_world @ v.co for v in m.data.vertices]
    print(f"  tris   : {len(m.data.polygons)}")
    print(f"  x=[{min(v.x for v in vs):.1f},{max(v.x for v in vs):.1f}] "
          f"y=[{min(v.y for v in vs):.1f},{max(v.y for v in vs):.1f}] "
          f"z=[{min(v.z for v in vs):.1f},{max(v.z for v in vs):.1f}]")

    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB',
                              export_apply=True, export_yup=False)
    print(f"wrote {OUT}  ({os.path.getsize(OUT) / 1024:.0f} KB), leads removed: {killed}")


main()
