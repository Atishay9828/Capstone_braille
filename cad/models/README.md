# Third-party component models

Downloaded 2026-08-04. **Nothing here is our work.** Attribution and licences below.

```
kicad/          KiCad packages3D — CC-BY-SA 4.0
                28byj-48__5v_stepper_motor.glb — see below
```

## 28BYJ-48 stepper — **CC-BY, credit required**

**"28BYJ-48 5V Stepper Motor" by NandouTech**, from Sketchfab, licensed
**CC Attribution**. Downloaded manually by Mridul (Sketchfab requires an account).

Converted to `sim/3d/motor.glb` by `renders/export_motor_glb.py`, which strips a stray
`Cube` primitive and the eighteen mesh pieces making up five straight 2×2×20 fake leads,
then re-lands the model with the output shaft on the origin and the can bottom at z=0.
2,968 triangles.

> **This attribution must ship with the simulator.** CC-BY is otherwise a very easy
> licence to satisfy — no share-alike, commercial use fine.

## What is here and why

| File | Stands in for | Matches our part? |
|---|---|---|
| `TO-92_Inline` | A3144 hall sensor | ✅ exact — this is the package we desolder off the blue module |
| `PinSocket_1x15_P2.54mm_Vertical` | the two female header strips the DevKit plugs into | ✅ exact — 1×15, 2.54mm |
| `DIP-16_W7.62mm` | the ULN2003 chip on the driver board | ✅ exact package |
| `BarrelJack_CUI_PJ-063AH_Horizontal` | DC power inlet | ⚠️ **wrong body style** — this is PCB-mount horizontal, ours is an inline pigtail. Reference only. |

Both `.step` (solid CAD, for OpenSCAD/FreeCAD work) and `.wrl` (mesh, importable into
Blender → GLB for the simulator) are kept.

## Licence — read before shipping any of these

**CC-BY-SA 4.0** (`kicad/LICENSE_KiCad.md`). Two consequences for a public repo:

1. **Attribution required** — credit "KiCad Libraries, CC-BY-SA 4.0" wherever a derived
   asset ships.
2. **Share-alike is viral.** Any GLB derived from these carries CC-BY-SA too. It does not
   infect the rest of the repo, but that one asset file is encumbered forever.

KiCad waives article 3 for *electronic designs*. A Three.js visualisation is probably not
an electronic design, so **assume the waiver does not apply** and treat derived meshes as
plain CC-BY-SA.

## What could NOT be downloaded, and why

| Wanted | Blocker |
|---|---|
| **ESP32 DevKit V1** (Sketchfab, CC-BY, 1.6k tris) | needs a Sketchfab **account** — a human has to log in |
| **28BYJ-48 stepper** (Sketchfab, CC-BY, 3.7k tris) | same |
| ESP32-WROOM-32E module (Espressif's own KiCad repo) | repo has **no licence file** — `NOASSERTION`. Not safe to redistribute publicly. |
| Anything on **GrabCAD** | licence forbids passing files to third parties. A public repo is exactly that. |

To add the two Sketchfab models: log in, download the **glTF/GLB**, drop them in
`cad/models/sketchfab/`, and credit the authors here.

## Current state

The simulator does **not** use any of these yet — `sim/3d/electronics.js` is still fully
procedural. See `sim/3d/MODELS.md` for the reasoning. These are archived as reference and
as raw material if we decide the fidelity is worth the share-alike obligation.
