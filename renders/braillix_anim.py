#!/usr/bin/env python
"""
braillix_anim.py — Blender animation of the Braillix braille cell.

    "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" ^
        --background --python renders/braillix_anim.py -- --word BRAILLE --quality draft

Renders straight to MP4 (Blender's built-in FFmpeg). There is no ffmpeg binary on
this machine, so do not refactor this into a PNG-sequence + external encode.

WHY NOT renders/build_assembly_scene.py
That script is kept for reference but cannot be reused: it references
braille_cam2.stl and linkage_comb.stl, which no longer exist (the linkage comb was
deleted in v7.0 when the six feet were spread 60 degrees apart), its Z positions are
the v5.0 stack, it never renders, and it imports linkage.stl which is the PRINT
layout - six linkages in a row on the bed, not assembled.

THE LINKAGES ARE DRIVEN BY THE REAL CAM PROFILE.
get_height_factor() below is a direct port of get_height_at_angle() from
cad/scad/braille_cam.scad. Nothing here is hand-animated. If the cam cannot produce
a motion, this video cannot show it - which is the whole point of using it to explain
the mechanism.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

ROOT = r"D:\TIET\Capstone"
STL = os.path.join(ROOT, "cad", "stl")
OUT = os.path.join(ROOT, "renders", "out")
P = json.load(open(os.path.join(ROOT, "sim", "braillix_params.json")))

CAM_P, STACK = P["cam"], P["stack"]
STATES = CAM_P["states"]
SLICE = CAM_P["slice_angle"]          # 5.625
RAMP = CAM_P["ramp_angle"]            # 1.125
PIN_LIFT = CAM_P["pin_lift"]          # 0.8
CAM_FLAT = STACK["cam_flat_z"]        # 45.0
DOT_TO_BIT = {int(k): v for k, v in P["encoding"]["DOT_TO_BIT"].items()}
Z_SIGN = P["motion"]["blender_z_sign"]  # -1 : clockwise advances the state index

# Grade-1 braille, mirrors firmware/braille_mapping.py
LETTERS = {
    'a': (1,), 'b': (1, 2), 'c': (1, 4), 'd': (1, 4, 5), 'e': (1, 5),
    'f': (1, 2, 4), 'g': (1, 2, 4, 5), 'h': (1, 2, 5), 'i': (2, 4),
    'j': (2, 4, 5), 'k': (1, 3), 'l': (1, 2, 3), 'm': (1, 3, 4),
    'n': (1, 3, 4, 5), 'o': (1, 3, 5), 'p': (1, 2, 3, 4), 'q': (1, 2, 3, 4, 5),
    'r': (1, 2, 3, 5), 's': (2, 3, 4), 't': (2, 3, 4, 5), 'u': (1, 3, 6),
    'v': (1, 2, 3, 6), 'w': (2, 4, 5, 6), 'x': (1, 3, 4, 6), 'y': (1, 3, 4, 5, 6),
    'z': (1, 3, 5, 6), ' ': (),
}

# Nominal INTENDED z-stack. The measured stack has two known 2mm errors still being
# re-derived (see .ai-sync/handoff.md); this animation deliberately shows design
# intent, and the narration says so out loud.
PARTS = {
    #  name            z     colour    alpha  role
    "outer_box":     (0.0,  "3A4A5A", 0.20, "housing"),
    "mid_plate":     (20.0, "7A7A7A", 0.85, "housing"),
    "base_plate":    (41.0, "5C5C5C", 0.90, "housing"),
    "braille_cam":   (43.0, "E94560", 1.00, "mech"),     # local z=2 is the flat -> 45
    "top_plate":     (54.0, "F5F0E0", 0.30, "housing"),
    "dot_insert":    (54.0, "FFFFFF", 0.55, "housing"),
}
LINKAGE_COLOR = "4ECCA3"


# ---------------------------------------------------------------- cam profile
def pattern_bit(state, track):
    """braille_cam.scad: floor(state / 2^(5-track)) % 2"""
    return (state >> (CAM_P["dots"] - 1 - track)) & 1


def s_curve(t):
    return (1.0 - math.cos(math.radians(t * 180.0))) / 2.0


def get_height_factor(a_eff, track):
    """Direct port of get_height_at_angle(); returns 0..1, not a z value."""
    a_eff %= 360.0
    k = int(a_eff // SLICE)
    ais = a_eff - k * SLICE
    vc = pattern_bit(k, track)
    vp = pattern_bit((k - 1) % STATES, track)
    vn = pattern_bit((k + 1) % STATES, track)
    hr = RAMP / 2.0
    if ais < hr:
        b = s_curve((ais + hr) / RAMP)
        return (1 - b) * vp + b * vc
    if ais > SLICE - hr:
        b = s_curve((ais - (SLICE - hr)) / RAMP)
        return (1 - b) * vc + b * vn
    return vc


def cam_angle_for_state(pos):
    """Disc rotation that puts a foot in the MIDDLE of state `pos`'s flat dwell.

    TRAP: the ramps are centred on slice boundaries, so aiming at pos*SLICE lands
    mid-ramp and every dot sits halfway up. The firmware has this exact bug
    (breadboard_test.ino: targetStep = pos * 4096/64, no +32). Half a slice further
    is the centre of the dwell.
    """
    return Z_SIGN * (pos + 0.5) * SLICE


def linkage_z(dot, cam_deg):
    """World Z of linkage `dot` when the disc is rotated cam_deg degrees."""
    track = CAM_P["dot_track"][dot - 1]
    # A foot fixed at world angle dot_phase sits over disc-local (phase - rotation).
    # The carving already bakes in track_phase, so a_eff collapses to -rotation.
    a_eff = (CAM_P["dot_phase"][dot - 1] - cam_deg) - CAM_P["track_phase"][track]
    return CAM_FLAT + get_height_factor(a_eff, track) * PIN_LIFT


def cell_to_pos(cell):
    v = 0
    for d in cell:
        v |= 1 << DOT_TO_BIT[d]
    return v


# ---------------------------------------------------------------- scene helpers
def rgba(hex_str, a=1.0):
    return (*(int(hex_str[i:i + 2], 16) / 255 for i in (0, 2, 4)), a)


def material(name, hex_color, alpha=1.0, metal=0.0, rough=0.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba(hex_color, 1.0)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = 'BLEND'
        if hasattr(m, "shadow_method"):
            m.shadow_method = 'NONE'
    return m


def import_stl(path, name):
    if not os.path.exists(path):
        sys.exit(f"MISSING STL: {path}  (run the OpenSCAD exports first)")
    before = set(bpy.data.objects)
    bpy.ops.wm.stl_import(filepath=path)
    obj = (set(bpy.data.objects) - before).pop()
    obj.name = name
    return obj


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def move_to(obj, col):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)


# ---------------------------------------------------------------- build
def build(word):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    housing, mech = collection("Housing"), collection("Mechanism")

    objs = {}
    for name, (z, col, alpha, role) in PARTS.items():
        o = import_stl(os.path.join(STL, name + ".stl"), name)
        o.scale = (0.001, 0.001, 0.001)          # mm -> m
        o.location = (0, 0, z / 1000.0)
        o.data.materials.append(material(f"mat_{name}", col, alpha))
        move_to(o, housing if role == "housing" else mech)
        objs[name] = o

    links = []
    for d in range(1, 7):
        o = import_stl(os.path.join(STL, f"linkage_asm_{d}.stl"), f"linkage_{d}")
        o.scale = (0.001, 0.001, 0.001)
        o.data.materials.append(material(f"mat_link_{d}", LINKAGE_COLOR, 1.0,
                                         metal=0.1, rough=0.35))
        move_to(o, mech)
        links.append(o)

    # ---- lighting: 3-point, soft ----
    # ENERGIES ARE SMALL ON PURPOSE. This object is 68mm across and the lights sit
    # ~200mm away, so irradiance goes as P/(4*pi*r^2): at r=0.2m a 220W lamp puts
    # ~440 W/m2 on the part and every surface blows out to pure white. Around
    # 25-35W is correct at this scale. If you move a light, rescale its power.
    for nm, loc, energy, size in [
        ("key",  (0.16, -0.14, 0.22), 30, 0.18),
        ("fill", (-0.20, -0.10, 0.12), 10, 0.30),
        ("rim",  (0.02, 0.20, 0.20), 16, 0.20),
    ]:
        ld = bpy.data.lights.new(nm, 'AREA')
        ld.energy, ld.size = energy, size
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0.05)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(lo)

    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.02, 0.05, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world

    # ---- camera on a target-tracking rig ----
    target = bpy.data.objects.new("target", None)
    target.location = (0, 0, 0.048)
    scene.collection.objects.link(target)
    cd = bpy.data.cameras.new("cam")
    cd.lens = 55
    camera = bpy.data.objects.new("cam", cd)
    scene.collection.objects.link(camera)
    scene.camera = camera
    con = camera.constraints.new('TRACK_TO')
    con.target, con.track_axis, con.up_axis = target, 'TRACK_NEGATIVE_Z', 'UP_Y'

    return scene, objs, links, camera, target


# ---------------------------------------------------------------- animate
def animate(scene, objs, links, camera, target, word, fps, sec_per_letter):
    cells = [LETTERS.get(c.lower(), ()) for c in word]
    positions = [cell_to_pos(c) for c in cells]
    per = int(fps * sec_per_letter)
    intro = int(fps * 4.0)                       # shot 1: settle in
    total = intro + per * len(positions) + int(fps * 2.5)
    scene.frame_start, scene.frame_end = 1, total

    cam_obj = objs["braille_cam"]
    start_deg = cam_angle_for_state(positions[0])

    # --- shot 1: parts drop into place, cam parked on the first letter ---
    for o in list(objs.values()) + links:
        o.keyframe_insert("location", frame=1)
    for o in objs.values():
        o.location.z += 0.055
        o.keyframe_insert("location", frame=1)
        o.location.z -= 0.055
        o.keyframe_insert("location", frame=intro)
    cam_obj.rotation_euler = (0, 0, math.radians(start_deg))
    cam_obj.keyframe_insert("rotation_euler", frame=1)
    cam_obj.keyframe_insert("rotation_euler", frame=intro)
    for i, o in enumerate(links):
        o.location.z = linkage_z(i + 1, start_deg) / 1000.0
        o.keyframe_insert("location", frame=intro)

    # --- shot 2+3: rotate letter to letter, linkages follow the CAM PROFILE ---
    prev_deg = start_deg
    f = intro
    for pos in positions[1:]:
        tgt = cam_angle_for_state(pos)
        # always advance in the same direction, like a real indexing cam
        while tgt > prev_deg:
            tgt -= 360.0
        travel, settle = int(per * 0.6), per - int(per * 0.6)
        for s in range(1, travel + 1):
            fr = f + s
            deg = prev_deg + (tgt - prev_deg) * (s / travel)
            cam_obj.rotation_euler = (0, 0, math.radians(deg))
            cam_obj.keyframe_insert("rotation_euler", frame=fr)
            for i, o in enumerate(links):
                o.location.z = linkage_z(i + 1, deg) / 1000.0
                o.keyframe_insert("location", frame=fr)
        f += travel
        cam_obj.keyframe_insert("rotation_euler", frame=f + settle)
        for i, o in enumerate(links):
            o.keyframe_insert("location", frame=f + settle)
        f += settle
        prev_deg = tgt

    # --- camera: wide -> cutaway orbit -> close on the dots -> pull back ---
    def key_cam(frame, loc, tz, lens):
        camera.location = loc
        camera.data.lens = lens
        target.location = (0, 0, tz)
        camera.keyframe_insert("location", frame=frame)
        camera.data.keyframe_insert("lens", frame=frame)
        target.keyframe_insert("location", frame=frame)

    key_cam(1,          (0.20, -0.20, 0.15), 0.030, 42)
    key_cam(intro,      (0.13, -0.15, 0.11), 0.045, 50)
    key_cam(intro + per, (0.09, -0.11, 0.095), 0.048, 62)
    key_cam(total - int(fps * 2.5), (0.05, -0.075, 0.088), 0.056, 78)
    key_cam(total,      (0.15, -0.17, 0.13), 0.045, 45)

    # housing fades out for the cutaway, back in at the end
    for o in [objs["outer_box"], objs["top_plate"], objs["dot_insert"]]:
        m = o.data.materials[0]
        b = m.node_tree.nodes["Principled BSDF"]
        for fr, a in [(1, PARTS[o.name][2]), (intro, PARTS[o.name][2]),
                      (intro + per // 2, 0.05),
                      (total - int(fps * 2.5), 0.05), (total, PARTS[o.name][2])]:
            b.inputs["Alpha"].default_value = a
            b.inputs["Alpha"].keyframe_insert("default_value", frame=fr)

    ease_all()
    return total


def iter_fcurves(action):
    """Blender 4.4+ moved fcurves into layered actions:
    action.layers[].strips[].channelbags[].fcurves. `action.fcurves` is gone in 5.x.
    Handle both so this script survives a Blender downgrade."""
    if hasattr(action, "fcurves"):
        yield from action.fcurves
        return
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for cb in getattr(strip, "channelbags", []):
                yield from cb.fcurves


def ease_all():
    """Smooth every animated channel. Keyframes live on objects, on object DATA
    (camera lens) and on material node trees (alpha), so all three are collected."""
    holders = list(bpy.data.objects)
    holders += [o.data for o in bpy.data.objects if getattr(o, "data", None)]
    holders += [m.node_tree for m in bpy.data.materials if m.node_tree]
    n = 0
    for h in holders:
        ad = getattr(h, "animation_data", None)
        if not ad or not ad.action:
            continue
        for fc in iter_fcurves(ad.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            n += 1
    print(f"  eased {n} animation channels")


# ---------------------------------------------------------------- main
def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    word = "BRAILLE"
    quality = "draft"
    for i, a in enumerate(argv):
        if a == "--word" and i + 1 < len(argv):
            word = argv[i + 1]
        if a == "--quality" and i + 1 < len(argv):
            quality = argv[i + 1]

    fps = 30
    if quality == "final":
        res, samples, spl = (1920, 1080), 64, 2.2
    elif quality == "preview":
        res, samples, spl = (1280, 720), 32, 2.0
    else:
        res, samples, spl = (640, 360), 8, 1.2

    scene, objs, links, camera, target = build(word)
    total = animate(scene, objs, links, camera, target, word, fps, spl)

    # Engine enum has moved twice: EEVEE -> BLENDER_EEVEE_NEXT (4.2) -> BLENDER_EEVEE
    # again in 5.x, where EEVEE Next simply became EEVEE. Pick whatever this build has.
    avail = scene.render.bl_rna.properties['engine'].enum_items.keys()
    for want in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        if want in avail:
            scene.render.engine = want
            break
    print(f"  engine   {scene.render.engine}  (available: {list(avail)})")
    try:
        scene.eevee.taa_render_samples = samples
    except AttributeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.fps = fps
    scene.render.film_transparent = False

    # THIS BLENDER BUILD HAS NO FFMPEG OUTPUT. Its file_format enum offers only
    # still images (AVIF/JPEG/PNG/...), no 'FFMPEG'. So we render a PNG sequence and
    # encode it afterwards with OpenCV (cv2 4.11 is installed system-wide):
    #     python renders/encode_video.py
    # Do not "restore" FFMPEG output here - it will raise TypeError on this machine.
    # Probing bl_rna is NOT reliable here: the static RNA enum still advertises
    # 'FFMPEG' even on a build compiled without it, and only the runtime setter
    # rejects it. So attempt the assignment and fall back on TypeError.
    try:
        scene.render.image_settings.file_format = 'FFMPEG'
        scene.render.ffmpeg.format = 'MPEG4'
        scene.render.ffmpeg.codec = 'H264'
        scene.render.filepath = os.path.join(OUT, f"braillix_{word}_{quality}.mp4")
    except TypeError:
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGB'
        frames_dir = os.path.join(OUT, f"{word}_{quality}")
        os.makedirs(frames_dir, exist_ok=True)
        for old in os.listdir(frames_dir):
            os.remove(os.path.join(frames_dir, old))
        scene.render.filepath = os.path.join(frames_dir, "f_")
        print("  NOTE     no FFMPEG in this build -> PNG sequence; "
              "run  python renders/encode_video.py  to make the MP4")
    os.makedirs(OUT, exist_ok=True)

    print(f"\n=== Braillix animation ===")
    print(f"  word     {word}  -> cam positions "
          f"{[cell_to_pos(LETTERS.get(c.lower(), ())) for c in word]}")
    print(f"  frames   {total} @ {fps}fps = {total / fps:.1f}s")
    print(f"  quality  {quality}  {res[0]}x{res[1]}  {samples} samples")
    print(f"  output   {scene.render.filepath}\n")

    bpy.ops.render.render(animation=True)
    print(f"\nDONE -> {scene.render.filepath}")


if __name__ == "__main__":
    main()
