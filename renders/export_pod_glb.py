"""Export the ESP32 brain pod's REAL printed geometry to sim/3d/pod.glb.

The simulator used to draw the pod as five slabs, which was close enough for a
silhouette but showed none of the features that matter: the USB service opening,
the pogo recess, the antenna grille, the magnet pockets, the screw bosses. Those
are the parts a viewer actually wants to look at, and they already exist in the
CAD, so approximating them was pointless.

Object names shipped: pod_shell, pod_lid. sim/3d/app.js depends on both.
Placement matches esp32_pod_assembly.scad — the lid sits at pod_height - lid_h.

    blender --background --factory-startup --python renders/export_pod_glb.py
"""
import bpy
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STL = os.path.join(ROOT, "cad", "stl")
OUT = os.path.join(ROOT, "sim", "3d", "pod.glb")

# from cad/scad/esp32_pod_params.scad
POD_HEIGHT, LID_H = 58.0, 4.0

PARTS = {                      # name: (z offset, hex colour, metal, rough)
    "esp32_pod_shell": (0.0, "5A6B7C", 0.05, 0.75),
    "esp32_pod_lid": (POD_HEIGHT - LID_H, "6E7A88", 0.05, 0.72),
}
RENAME = {"esp32_pod_shell": "pod_shell", "esp32_pod_lid": "pod_lid"}


def rgba(hx, a=1.0):
    return (*(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)), a)


def material(name, hx, metal, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba(hx)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    built = []
    for name, (z, hx, metal, rough) in PARTS.items():
        path = os.path.join(STL, name + ".stl")
        if not os.path.exists(path):
            sys.exit(f"missing {path}\n  regenerate with:\n"
                     f"  openscad -o cad/stl/{name}.stl cad/scad/{name}.scad")
        bpy.ops.wm.stl_import(filepath=path, global_scale=1.0)   # millimetres
        o = bpy.context.selected_objects[0]
        o.name = RENAME[name]
        o.location.z += z
        o.data.materials.clear()
        o.data.materials.append(material("mat_" + o.name, hx, metal, rough))
        # left flat-shaded on purpose: this is a printed box, and smoothing the
        # normals smears the 3mm corner fillets into the walls so it stops reading
        # as plastic. (Blender 4.1 removed use_auto_smooth, so there is no cheap
        # angle-based middle ground here anyway.)
        built.append(o.name)

    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB',
        export_apply=True, export_yup=False,      # keep Z-up, matching the CAD
    )

    tris = sum(len(bpy.data.objects[n].data.loop_triangles) or
               len(bpy.data.objects[n].data.polygons) for n in built)
    print(f"\nwrote {OUT}")
    print(f"  objects: {built}")
    print(f"  size   : {os.path.getsize(OUT) / 1024:.0f} KB")


main()
