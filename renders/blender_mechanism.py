# =========================================================
# BRAILLIX — presentation render of the mechanism
#
# Builds a Cycles scene from the STLs that readme_mechanism.scad exports, gives
# each part a real material, lights it, and renders on the GPU.
#
#   blender -b -P renders/blender_mechanism.py -- <stl_dir> <out.png> [samples]
#
# Why this exists next to the OpenSCAD render: OpenSCAD's preview has no shadows,
# no ambient occlusion and no materials, so the cam's track grooves read flat.
# Cycles gives contact shadows and occlusion, which is what makes a machined part
# look machined.
#
# UNITS. The STLs are in millimetres, and Blender treats one unit as one metre.
# Imported raw, the cell would be a 68 METRE object and every sane light power
# would be wrong. Everything is scaled to MM_TO_M below, so the cell is a
# palm-sized object and lights behave the way the numbers suggest. An earlier
# attempt on this project skipped that and ended up at 220 W from 0.2 m, which
# blew the whole frame to white.
# =========================================================

import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
STL_DIR = argv[0] if argv else "."
OUT     = argv[1] if len(argv) > 1 else "mechanism_blender.png"
SAMPLES = int(argv[2]) if len(argv) > 2 else 192
# The enclosure lid is OFF by default. Even at transmission 0.92 a 4mm slab of
# rough PETG scatters enough to bury the mechanism, and the mechanism is the
# subject. Pass 1 to include it.
WITH_PLATE = bool(int(argv[3])) if len(argv) > 3 else False

MM_TO_M = 0.01          # 68mm cell -> 0.68m object

# --- clean slate ---------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def import_stl(path):
    """Blender renamed the STL operator between versions. Try the current one first."""
    before = set(bpy.data.objects)
    if hasattr(bpy.ops.wm, "stl_import"):
        bpy.ops.wm.stl_import(filepath=path)
    else:
        bpy.ops.import_mesh.stl(filepath=path)
    new = list(set(bpy.data.objects) - before)
    if not new:
        raise RuntimeError("nothing imported from " + path)
    return new


def material(name, base, metallic, roughness, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    # "Transmission Weight" in 4.x+, "Transmission" before that
    for key in ("Transmission Weight", "Transmission"):
        if key in b.inputs:
            b.inputs[key].default_value = transmission
            break
    if transmission:
        m.blend_method = 'BLEND' if hasattr(m, "blend_method") else m.blend_method
    return m


PARTS = [
    # file             material name    base colour             metal rough transmit
    # The real cam is printed in dark resin, not metal. Metallic 0.85 made it
    # mirror the area lights and come out white, which is the opposite of the part.
    ("cam.stl",           "cam",     (0.022, 0.024, 0.030), 0.00, 0.45, 0.0),
    ("linkages_down.stl", "steel",   (0.560, 0.590, 0.640), 0.95, 0.22, 0.0),
    ("linkage_up.stl",    "brass",   (0.780, 0.480, 0.130), 0.95, 0.20, 0.0),
    ("insert.stl",        "resin",   (0.760, 0.765, 0.780), 0.00, 0.45, 0.0),
    ("plate.stl",         "petg",    (0.700, 0.760, 0.820), 0.00, 0.10, 0.92),
]

objs = []
for fname, mname, colour, metal, rough, transmit in PARTS:
    if fname == "plate.stl" and not WITH_PLATE:
        continue
    path = os.path.join(STL_DIR, fname)
    if not os.path.exists(path):
        print("skip (missing):", fname)
        continue
    mat = material(mname, colour, metal, rough, transmit)
    for o in import_stl(path):
        o.scale = (MM_TO_M,) * 3
        o.data.materials.clear()
        o.data.materials.append(mat)
        # STL carries no normals worth trusting; shade smooth but keep hard edges
        for p in o.data.polygons:
            p.use_smooth = True
        mod = o.modifiers.new("sharp", 'EDGE_SPLIT')
        mod.split_angle = math.radians(30)
        objs.append(o)

bpy.context.view_layer.update()

# --- frame the parts -----------------------------------------------------
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for o in objs:
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
mid = (lo + hi) / 2
size = max(hi - lo)
print(f"scene spans {size:.3f} m, centred on {tuple(round(v,3) for v in mid)}")

# --- lighting ------------------------------------------------------------
# Three soft area lights plus a dark world. Powers are chosen for an object of
# roughly `size` metres at roughly `size * 2` metres away.
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.020, 0.024, 0.032, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = world

def area_light(name, loc, power, radius, target):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = power
    d.size = radius
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = mid + Vector(loc) * size
    direction = (mid - o.location).normalized()
    o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return o

# Cut to roughly a third of the first attempt. With AgX below, the earlier powers
# rolled every surface into the top of the curve and the dark cam came out white.
area_light("key",  ( 1.5, -1.8,  1.9), 70, size * 1.6, mid)
area_light("fill", (-2.0, -1.1,  0.7), 18, size * 2.2, mid)
area_light("rim",  (-0.7,  1.9,  1.4), 38, size * 1.4, mid)

# --- camera --------------------------------------------------------------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 70                       # mild telephoto keeps the parts undistorted
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# Looking down at about 35 degrees: high enough to see the cam face and the six
# arms fanning out, low enough that the raised dome still breaks the skyline.
eye = mid + Vector((0.90, -1.25, 1.00)) * size
cam.location = eye
cam.rotation_euler = (mid - eye).to_track_quat('-Z', 'Y').to_euler()

cam_data.dof.use_dof = True
cam_data.dof.focus_distance = (mid - eye).length
cam_data.dof.aperture_fstop = 9.0     # f/4 blurred the far arms into mush

# --- render settings -----------------------------------------------------
scene.render.engine = 'CYCLES'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.film_transparent = False
scene.render.filepath = OUT
scene.view_settings.look = 'AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in \
    [i.name for i in scene.view_settings.bl_rna.properties['look'].enum_items] else 'None'

# --- GPU -----------------------------------------------------------------
prefs = bpy.context.preferences.addons['cycles'].preferences
chosen = None
for backend in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
    try:
        prefs.compute_device_type = backend
    except TypeError:
        continue
    prefs.get_devices()
    gpus = [d for d in prefs.devices if d.type == backend]
    if gpus:
        for d in prefs.devices:
            d.use = (d.type == backend)
        chosen = backend
        print(f"GPU backend {backend}: " + ", ".join(d.name for d in gpus))
        break

if chosen:
    scene.cycles.device = 'GPU'
else:
    scene.cycles.device = 'CPU'
    print("NO GPU FOUND - falling back to CPU")

print(f"rendering {SAMPLES} samples on {scene.cycles.device} -> {OUT}")
bpy.ops.render.render(write_still=True)
print("done")
