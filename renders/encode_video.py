#!/usr/bin/env python
"""
encode_video.py — turn a Blender PNG sequence into an MP4.

    python renders/encode_video.py                       # every sequence found
    python renders/encode_video.py BRAILLE_final         # just one

WHY THIS EXISTS
The Blender 5.1 build on this machine has no FFMPEG output — its file_format enum
offers still images only. There is also no ffmpeg binary on PATH and none bundled
with Blender. OpenCV (cv2 4.11) is installed system-wide and can write H.264/MP4,
so renders/braillix_anim.py writes a PNG sequence and this encodes it.

Blender's own Python does not have cv2, which is why this is a separate step run
with the system interpreter rather than folded into the render script.
"""
import os
import sys

try:
    import cv2
except ImportError:
    sys.exit("cv2 not available. Install with:  pip install opencv-python")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "renders", "out")
FPS = 30


def encode(seq_dir, fps=FPS):
    name = os.path.basename(seq_dir)
    pngs = sorted(f for f in os.listdir(seq_dir) if f.lower().endswith(".png"))
    if not pngs:
        print(f"  {name}: no PNGs, skipped")
        return None

    first = cv2.imread(os.path.join(seq_dir, pngs[0]))
    if first is None:
        print(f"  {name}: could not read {pngs[0]}, skipped")
        return None
    h, w = first.shape[:2]

    mp4 = os.path.join(OUT, f"braillix_{name}.mp4")
    # mp4v is the codec that ships with the pip opencv wheels; avc1 usually needs a
    # system H.264 encoder that is not present here. mp4v plays in VLC, PowerPoint
    # and Windows Media Player, which is what this video is for.
    writer = cv2.VideoWriter(mp4, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    if not writer.isOpened():
        print(f"  {name}: VideoWriter would not open")
        return None

    for i, f in enumerate(pngs):
        img = cv2.imread(os.path.join(seq_dir, f))
        if img is None:
            continue
        if img.shape[:2] != (h, w):
            img = cv2.resize(img, (w, h))
        writer.write(img)
        if i % 60 == 0:
            print(f"    {i}/{len(pngs)}", end="\r")
    writer.release()

    size = os.path.getsize(mp4) / 1e6
    print(f"  {name}: {len(pngs)} frames  {w}x{h}  {len(pngs)/fps:.1f}s  "
          f"{size:.1f} MB -> {os.path.relpath(mp4, ROOT)}")
    return mp4


def main():
    if not os.path.isdir(OUT):
        sys.exit(f"No render output at {OUT} — run braillix_anim.py first.")
    wanted = sys.argv[1:] or None
    seqs = [os.path.join(OUT, d) for d in sorted(os.listdir(OUT))
            if os.path.isdir(os.path.join(OUT, d)) and (not wanted or d in wanted)]
    if not seqs:
        sys.exit("No PNG sequence directories found in renders/out/")
    print(f"Encoding {len(seqs)} sequence(s) at {FPS} fps:")
    for s in seqs:
        encode(s)


if __name__ == "__main__":
    main()
