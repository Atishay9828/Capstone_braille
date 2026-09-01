# Active Handoff
> Last updated by: Claude Code (Mridul's fork)
> Timestamp: 2026-08-26

---

## SPRING: 0.30 -> 0.20mm WIRE, ACCEPTED BY THE CAD FORK (2026-09-01)

The electronics fork (commit 69d109f) found the return spring is ~6x too stiff:
six of them load the cam with ~17N, about 87 mN*m of friction against a 30 mN*m
motor, so the cam cannot turn before a single dot is lifted. Rate goes as wire
diameter^4, so 0.20mm wire cuts it ~5x. **Applied in `mech_layout.scad`.**

**It is not only a BOM number, and the CAD fork owes them one back.** `spring_id`
is derived from the wire diameter, and `spring_id` is the bore the linkage nub
travels through:

```
  0.30 wire -> spring_id 1.40    nub 1.0 x 1.0 diagonal 1.414   INTERFERES by 0.014
  0.20 wire -> spring_id 1.60    0.19mm clearance               fits
```

**So the old spring was also, quietly, too tight for its own nub.** Nobody had
noticed because 0.014mm reads as a rounding error. The thinner wire fixes the
friction and the fit at once.

No printed geometry changed - verified, `dot_insert`, `top_plate` and `linkage`
all export the same facet counts. The 1.4mm figure was the bought spring's inner
diameter, never a printed feature. The nub assert in `linkage.scad` now derives
from `spring_id` instead of a hard-coded 1.42.

**R-07 AND THE SPRING ARE PAIRED. Neither works alone** - the ramp fix removes
the wedging, the spring fix removes the preload. Both are now in.

---

## CURRENT STATE - 2026-09-01 EVENING (latest, read this first)

### 1. THE BRAILLE CELL WAS TWICE AS WIDE AS A REAL ONE. Fixed, and it was free.

`col_spacing` was **4.8mm** against a 2.34mm standard - 105% over - while rows
were 2.6mm, 11% over. So the cell measured 4.8 x 2.6 and a trained reader's
finger would not have read it as a cell at all. Braille dot pitch is SQUARE
(2.34 both axes); what makes a cell look tall is 2 columns x 3 rows, not an
uneven pitch.

```
  REAL BRAILLE          WAS                   NOW
  pitch 2.34 x 2.34     pitch 4.80 x 2.60     pitch 2.60 x 2.60
  cell  2.34 x 4.68     cell  4.80 x 5.20     cell  2.60 x 5.20
  ratio 1 : 2           ratio 1 : 1.08        ratio 1 : 2
  scale    -            2.05x / 1.11x         1.111x / 1.111x
```

**Narrowing the columns cost nothing.** Every clearance in the dot cluster is set
by the ROWS, which are closer, so bringing the columns in to match changed none
of them:

```
  col   row   nub-nub   spring wall   arm gap   dome gap
  4.8   2.6     2.60        0.40       1.60      1.10
  2.6   2.6     2.60        0.40       1.60      1.10    <- identical
```

The arms do not crowd either - each already points outward the way its dot sits,
so the two columns diverge rather than cross. Re-verified by rendering all 15
linkage pairs and intersecting them: **zero clashes**. Longest arm 19.86 ->
20.40mm, deflection still 0.063mm at 0.1N against a 0.50mm dot.

**WHY NOT THE TRUE 2.34 STANDARD - and this is the one thing blocking it.** The
return spring sits on the dot axis and its bore is 2.2mm. A 0.4mm wall between
bores forces `pitch >= 2.60mm`. Reaching 2.34 needs a spring under **1.74mm OD**,
and 2.0mm was already hard to source. If sub-2mm springs ever turn up,
`col_spacing` and `row_spacing` both drop to 2.34 together and the cell becomes
exactly standard - nothing else in the design has to move.

The other route is taking the spring off the dot axis entirely: a captured cam
groove would pull the dot down instead of a spring pushing it. That is a real
mechanism change, not a parameter.

### 2. THE ARM THICKENING WAS WRONG. Corrected.

Earlier today the arm went to 2.0 x 3.0mm. **`link_thickness` is the extrusion
depth, so it is also the depth of the NUB** - and the nub has to slide inside the
1.4mm bore in the resin dot insert. At 2.0 the nub was 1.0 x 2.0mm and could not
enter the hole at all. Mridul spotted it in the render before it was printed.

It was also unnecessary. Stiffness goes as height CUBED and only linearly with
width, so the free axis does nearly all the work:

```
  1.0 x 1.0   I=0.083   0.1N -> 1.567mm    original
  1.0 x 3.0   I=2.250   0.1N -> 0.058mm    27x, NOTHING gets wider   <- chosen
  2.0 x 3.0   I=4.500   0.1N -> 0.029mm    54x, but breaks the nub
```

`link_thickness` is back to 1.0 and only `arm_h` grows. There is now an assert on
the nub diagonal so this cannot be repeated:

```
  assert(sqrt(nub_w^2 + thickness^2) <= 1.42)
```

### 3. THE CAM POLYHEDRON WAS INVALID. Latent for the whole project.

`build_track_polyhedron` built each top face as a QUAD:

```
  [i0, i1, next_i1, next_i0]   inner@a, outer@a, outer@a', inner@a'
```

At angle `a` both points sit at height h; at `a'` both sit at h'. Wherever the
track is on a ramp, h != h', so those two radial edges are non-parallel lines at
different heights and **the quad is non-planar** - invalid polyhedron input.

OpenSCAD 2021 silently picked a diagonal. **OpenSCAD 2026 throws
"CGAL ERROR: assertion violation" on every one of them.** All four faces are now
split into explicit triangles, and the assertions are gone.

### 4. TOOLCHAIN: use the nightly, keep the CGAL backend

Mridul installed OpenSCAD 2026.08.31 as a separate "OpenSCAD (Nightly)" app.
Measured on this project:

```
                        print_resin_1_all      braille_cam volume
  2021 CGAL             7m 39s                 4190.042 mm3
  2026 CGAL             (clean, strict)        4190.042 mm3   <- exact match
  2026 Manifold         2s                     3615.565 mm3   <- 574mm3 short
```

**Use `--backend=CGAL` on the nightly.** Same exact arithmetic as 2021, verified
identical to three decimals, plus it catches invalid input that 2021 swallowed.

**DO NOT switch to Manifold yet, despite it being 230x faster.** Manifold's
guarantee is that output is a valid closed 2-manifold - which it is; both meshes
passed the edge check. But valid is not the same as correct, and its answer here
is *smaller than the disc floor by itself* (3677.8mm3), which is impossible for a
union containing that floor. CGAL's figure matches hand arithmetic: floor 3678 -
magnet 63 - bore 26 + hub 303 + track bumps 300 = 4192.

**A LIKELY CAUSE, worth fixing.** Every track polyhedron is built from `z=0`
while the disc floor spans 0..2.0, so about 2mm of every track is buried inside
the floor. That is a huge coincident-face overlap, the worst case for a
float-based booleaner. Starting the tracks at `z=disk_base_thickness` would
probably make Manifold agree AND unlock the 230x speedup. Not attempted.

### 5. THE DOT DOES NOT REACH THE PLATE RIM - and that is correct

Reported from the simulator as a possible Z-stack bug. It is not a bug:

```
  reading surface (resin insert top) .... 45.7
  dot DOWN ............................. 45.7    exactly flush
  dot UP ............................... 46.2    exactly +0.50
  plate RIM ............................ 46.5    0.3mm above the dot
```

The plate has a 0.8mm finger-pad recess. The dot rises 0.5mm above the RECESSED
surface, which is what the fingertip actually touches - textbook braille. The rim
is a 3mm border at the plate edge, ~30mm from the nearest dot, and plays no part
in reading. Before R-07 `pin_lift` was 0.8 = exactly the recess depth, so the dot
came up flush with the rim; dropping it to 0.5 is what changed the appearance.

Raising the linkage does NOT fix it: the linkage is rigid, so it moves the down
dot and the up dot together, and the 0.5mm separation is set by the cam. Raising
by 0.3 would leave every OFF dot standing 0.3mm proud - readable, since a real
dot is 0.46-0.50 - and the cell would turn to mush. If the rim flush look is
wanted, the only clean change is `finger_pad_depth` 0.8 -> 0.5.

### 6. Dot dimensions against the standard

```
  dome diameter   1.50mm    standard 1.44-1.60    OK
  dot height      0.50mm    standard 0.46-0.50    OK
  pitch           2.60mm    standard 2.34         +11%, uniform
```

Feel: a resin dome is the RIGHT feel. Commercial refreshable displays use hard
plastic or metal pins; only paper braille feels soft.

---

## CURRENT STATE - 2026-09-01 LATE (latest, read this first)

### The stack went UP 2.5mm instead of cutting the motor, and the arms got thick

Two decisions since the R-07 commit, both Mridul's:

**1. NO ONE CUTS THE MOTOR.** The shaft ending above the cam face needed either a
2.5mm cut or a taller hub. A cut is irreversible and has to be repeated perfectly
on every unit ever built; a hub is a number in a file. `hub_h` 4 -> 6.5 and the
whole tower above the disc translates up with it.

```
  floor        0.0 ..  4.0
  motor can    4.0 .. 23.0
  shaft boss  23.0 .. 25.0
  cam hub     25.0 .. 31.5     hub_h 6.5, was 4
  cam disc    31.5 .. 33.5     cam_flat_z = 33.5, was 31
  base plate  29.5 .. 34.5     base_plate_z = 29.5, was 27
  standoffs   34.5 .. 42.5
  top plate   42.5 .. 46.5     shell_height = 46.5, was 44
```

Cell and pod are both **46.5mm**. Still 11.5mm shorter than the 58mm they were
before the motor moved onto the floor.

**IT IS 2.5mm, NOT 2.0.** 2.0 puts the bore at exactly 7.5mm against a 7.5mm
shaft - zero slack, so any plus tolerance on shaft length and the cam hangs on
the shaft tip instead of seating on the boss, which tilts the disc. 2.5 buys
0.5mm of air over the tip and keeps the 0.5mm roof. There is a
`shaft_air_gap` assert now so this cannot be quietly tuned away.

```
  bore depth 8.0   shaft 7.5   air 0.5   roof 0.5
  hub bottom lands on the boss top at z=25 exactly
```

Bonus: the electronics bay grew with it, 23 -> **25.5mm** of clear height. The
11mm driver assembly now has 14.5mm spare instead of 12.

> **CORRECTED same day: the arms are 1.0 x 3.0, NOT 2.0 x 3.0.** Widening to 2.0
> broke the nub, which has to pass a 1.4mm bore. Only `arm_h` grows. See the
> CURRENT STATE section at the top.

**2. THE ARMS ARE 2.0 x 3.0mm, WAS 1.0 x 1.0.** This was the real blocker and it
had been open since the linkage was drawn:

```
  section     I(mm4)     0.1N      0.3N      0.5N    tip deflection, 19.86mm arm
  1.0 x 1.0    0.083    1.57mm    4.70mm    7.83mm   <- as designed
  2.0 x 2.0    1.333    0.10mm    0.29mm    0.49mm
  2.0 x 3.0    4.500    0.03mm    0.09mm    0.15mm   <- chosen
```

The dot is 0.50mm tall. **The old arm bent three times the entire dot height
under the lightest touch a reader would use** - a finger would fold it flat and
feel nothing back. 54x stiffer now, and deflection stays under a third of the
dot even at a heavy 0.5N press.

Two couplings had to be broken first, and both would have quietly undone R-07:

- **`riser_w` is new.** The lower riser used to take its RADIAL width from
  `link_thickness`, which is a TANGENTIAL dimension. Thickening the arm to 2.0
  would have put a 2.0mm-wide foot on a 1.6mm track, straddling the neighbour.
  The riser and foot are now sized by the track at 1.4mm, independently.
- **`foot_roll_r` no longer equals `link_thickness/2`.** It would have gone to
  1.0, which feeds straight into `foot_flat_arc` and the ramp sizing, and would
  have handed back about a third of the ramp room R-07 just won. Pinned at 0.5,
  centred in the arm's width.

Pressure angles are unchanged by the thickening - verified, still 29.5 / 25.4 /
22.3 / 19.8 / 17.9 / 16.2 degrees.

### Verified, not assumed

- All 37 files evaluate clean **through geometry export**, not `--export-format
  echo`, which does not run top-level asserts.
- `braille_cam.stl` bbox Z **-6.50 to 2.50** - a 6.5mm hub, and nothing above the
  cam face except the 0.5mm dot lift. No boss, no shaft tip.
- Cell and pod shells both export Z 0..42.5 (46.5 less the 4mm cap recess), so
  the two dock faces are still level.
- **All 15 linkage pairs tested for interference by rendering the actual
  intersection. Zero clashes.** 2.0mm arms on 2.60mm centres leave 0.60mm.
- Every mesh manifold, zero non-manifold edges.
- `arm top when raised 7.0 vs plate underside 9.0` - 2.0mm clear.
- `comb pocket radial 1.7 vs riser 1.4` - fits, with an assert.

### What has to be reprinted

Everything in the mechanism, and both enclosures:

```
  PETG   outer_box, base_plate, top_plate, esp32_pod_shell, esp32_pod_lid
  resin  braille_cam, linkage x6, linkage_comb, dot_insert
```

The resin linkages that were already ordered are dead twice over - the arms grew
2.0-2.4mm with the disc, and the section changed.

### Still open

- **Every G-code file is stale.** Re-slice now; the design should be still for a
  while.
- **`braille_cell.ino` has no edge-latching homing** - the 8mm magnet spans 4.7
  states so the field centre is meaningless. Home in a fixed direction, latch the
  first edge, budget about +/-9 steps.
- **`braille_cam.scad` still holds its disc and track geometry twice.** The bore
  duplication is gone; this is not.
- **Nothing has ever been physically assembled.**
- Waiting on Mridul: the blue wire block dimensions, and a ULN2003AN + DIP-16
  socket + perfboard.

---

## CURRENT STATE - 2026-09-01 (latest, read this first)

### R-07 IS APPLIED. The disc grew, the dot shrank, the shaft got cut.

```
  inner_radius            12.0 -> 14.0      disc Ø44.4 -> Ø48.4
  pin_lift                 0.8 -> 0.5       braille standard dot height
  angular_ramp_fraction    0.2 -> per-track, geometric max
  base_plate Y              50 -> 56
  cam pocket                46 -> 50
  comb_side                 48 -> 54
  comb_peg_xy             17.5 -> 19.0
  motor shaft              9.5 -> 7.0       CUT 2.5mm OFF THE MOTOR
  homing magnet            3mm -> 8mm dia
```

Pressure angle, which is the whole point - **every track is now under the
30 degree limit**, from 62-73 degrees as built:

```
  track   r       was      now
    0   14.80   72.6     29.5
    1   16.50   70.4     25.4
    2   18.20   68.3     22.3
    3   19.90   66.3     19.8
    4   21.60   64.3     17.9
    5   23.30   62.4     16.2
```

Verified from the exported meshes, not from the source: cam bbox is
X/Y +/-24.20 (Ø48.4), Z -4.00 to **2.50** - the disc face at 2.0 plus the 0.5
lift, and **nothing above it**. Comb +/-27.0. Base plate 58 x 56. All three
manifold, zero non-manifold edges.

### THE SHAFT. v8.6 was wrong and is now actually fixed.

> **SUPERSEDED 2026-09-01. THE SHAFT IS NOT CUT.** Mridul chose to raise the
> stack instead. `hub_h` 4 -> 6.5, everything above the disc moves up 2.5mm, and
> the shaft is used at full length. See the CURRENT STATE section at the top.
> The reasoning below still explains why one of the two had to happen.


v8.6 claimed to make the bore blind. It did not do what was asked. It added a
2.6mm boss ON TOP of the disc and ran the bore up into it, so the shaft tip
finished 1.5mm **above** the cam's working face - concealed, but still above it,
and with a tower standing in the middle of the face.

The requirement was the shaft ending BELOW the cam. That is now what happens:

```
  hub bottom .......... -4.0     sits on the motor's shaft boss
  disc underside ....... 0.0
  shaft tip ............ 1.0     5.0mm of cut shaft above the boss
  bore top ............. 1.5
  cam face ............. 2.0     0.5mm of solid resin over the tip
```

**This requires cutting 2.5mm off the motor shaft** and there was no alternative
that did not move something: the motor is already on the box floor, and the disc
height is set by the base plate above it. Raising the stack instead would have
cost 2mm back out of the 14mm the cell just lost, and reprinted the pod too to
keep the two level. Cutting a soft steel stub was cheaper. `motor_spec.scad`
carries `motor_shaft_cut = 2.5` and the method.

Engagement drops 7.5mm -> 5.0mm of Double-D, which is still ~14x margin: 0.3Nm
over a 2.6mm radius is 115N across two 3.2 x 5.0mm flats = 3.6MPa into a resin
that yields near 50.

### THE DUPLICATED CAM GEOMETRY IS PARTLY COLLAPSED

`braille_cam.scad` held its hub bore inline TWICE - once at top level, once in
`module braille_cam()` - both built with the `cube(center=true)` construction
that shipped a 3.5mm bore for a week. Both inline copies are deleted. There is
now exactly ONE definition of the shaft bore, `legacy_shaft_bore()`, called from
both paths. The disc/track duplication between the two paths still exists.

### THE FOOTPRINT HAS ONE OWNER NOW

`standoff_x`/`standoff_y` were declared independently in base_plate.scad,
linkage_comb.scad AND top_plate.scad; the comb also kept its own copy of the cam
pocket diameter under a comment reading "from base_plate.scad", which is a
comment, not a link. Growing the disc moves all of them at once. They now live
in `mech_layout.scad` with asserts, and the three consumers assert they got them.

Same treatment for `cam_pocket_diameter`, `cam_pocket_depth`, `base_length`,
`base_width`, `comb_side`, `comb_peg_xy`, `standoff_diameter`, `foot_roll_r`.

### A METHOD NOTE WORTH KEEPING

`openscad --export-format echo` does NOT evaluate top-level asserts. A sweep of
all 37 files "passed" while `braille_cam.scad` was missing an include and would
not render at all. **Sweep by exporting geometry (`-o x.csg`), not echo.**

### TWO THINGS THAT ARE NOW WORSE, AND ONE IS SERIOUS

**1. THE RESIN LINKAGES ARE INVALIDATED.** Growing the disc lengthened every arm:

```
  dot | track |   r   | arm span was | now
   1  |   2   | 18.20 |    12.77     | 14.77
   2  |   3   | 19.90 |    15.50     | 17.50
   3  |   4   | 21.60 |    16.17     | 18.17
   4  |   1   | 16.50 |    11.08     | 13.07
   5  |   0   | 14.80 |    10.40     | 12.40
   6  |   5   | 23.30 |    17.87     | 19.86
```

`linkage.stl` changed. The set that was already ordered no longer reaches. They
have to be reprinted with the cam, the plate and the comb.

**2. AND THAT MAKES THE STIFFNESS PROBLEM URGENT.** The arm is 1.0 x 1.0mm and
is now up to 19.86mm long - the longest it has ever been. Tip deflection under a
fingertip, E=2000MPa:

```
  section        I(mm4)     0.1N      0.3N      0.5N
  1.0 x 1.0       0.083    1.57mm    4.70mm    7.83mm    <- as designed
  2.0 x 2.0       1.333    0.10mm    0.29mm    0.49mm
  2.0 x 3.0       4.500    0.03mm    0.09mm    0.15mm
```

**The dot is 0.50mm tall. The current arm deflects three times that under the
lightest touch a reader would use.** As drawn, a finger folds the linkage flat
and feels nothing. This is not a tolerance issue, it is a section that is too
small by a factor of ~50 in second moment.

Arm-to-arm clearance is 2.60mm, so a 2.0mm-wide arm leaves 0.6mm between
neighbours - tight but real. `foot_roll_r` must be DECOUPLED from
`link_thickness` if the thickness grows, because the ramp sizing reads it and a
1.0mm roll would take back some of the ramp room R-07 just won.

**NOT APPLIED. This is the next decision and it should ride the same reprint.**

### Unchanged and still true

The bare ULN2003AN driver and its position (section below), the 44mm stack, the
motor on the box floor, the unified dock magnets, Gray order in all three places.
**Every G-code file is stale** - re-slice now that R-07 has landed. **Nothing has
ever been physically assembled.**

### Homing, which changed and needs firmware work

The magnet is 8mm because that is what Mridul owns and 3mm is not sourceable. At
r=17.35 it subtends 26.7 degrees = 4.7 states, so **homing on the centre of the
field is meaningless**. Home by always rotating the SAME direction and latching
the FIRST edge.

The budget: one state is 64 steps of 4096, and the flat dwell is 27-45% of a
state, so **homing must land within about +/-9 steps** of a state centre on the
outermost track. A hall edge approached from a fixed direction at a fixed speed
is repeatable well inside that, but it is worth measuring rather than assuming.
`braille_cell.ino` has NOT been updated for this.

Watch item: the magnet pocket leaves 0.8mm of disc floor under the tracks. If it
proves fragile, the magnet can move to r=9 - now clear of the tracks entirely
since inner_radius went to 14 - at the cost of moving the Hall sensor with it.

---

## CURRENT STATE - 2026-08-31 (latest, read this first)

### 1. THE DRIVER IS NOW A BARE IC. Everything about it is in a new spec file.

Mridul's call: the off-the-shelf ULN2003 breakout is DROPPED. The cell carries a
bare **ULN2003AN in DIP-16 on cut perfboard**. All numbers now live in
**`cad/scad/electronics_spec.scad`** - read them from there, do not re-copy them.

Why the module had to go: it is 35 x 32mm, and almost all of that is the JST
socket, four indicator LEDs and the header. Flat it needs 32mm of width and there
is 12.35mm. On edge it needs 32mm of height and there is 23mm. Neither fits.

**HEIGHTS** (this is what the simulator asked for):

```
                          socketed    soldered direct
  trimmed pin tails          1.5           1.5
  perfboard (FR4)            1.6           1.6
  DIP-16 socket              3.4            -
  ULN2003AN body             4.5           4.5
                          --------      --------
  OVERALL                   11.0           7.6      <- elec_overall_h
```

A DIP socket is assumed and recommended: a ULN2003 dies shorted on coil kickback,
and desoldering 16 pins inside a glued box is not a repair.

**BOARD**: 28 (Y) x 18 (Z) x 1.6mm FR4, 11 x 7 holes off a 10x4cm protoboard.
**CHIP**: body 19.5 x 6.4mm, 2.54 pitch, 7.62mm between pin rows, 4.5mm tall.

**POSITION** - it STANDS ON EDGE against the +X wall, it does not lie flat:

```
    y=+30 +-------------------------------------------+
          |          (26,21) corner boss O            |
          |     ___________                  +--+     |
          |    /           \                 |  |     |
    y=0   |   (  motor cup  )                |PCB|    |  x=+30
          |    \___________/                 |  |     |
          |          ^ can centre (-7.5, 0)  +--+     |
          |          (26,-21) corner boss O           |
    y=-30 +-------------------------------------------+
                                             ^ x=+16
```

```
  elec_pcb_x = 16.0      board mid-plane
  elec_pcb_y =  0.0
  elec_pcb_z =  4.0      stands on the box floor
  orientation: 28mm along Y, 18mm along Z, 11mm along X
```

The gap it lives in, and why it is the ONLY one: the can is offset to -X because
the SHAFT has to land on the cavity centreline and the shaft is 7.5mm off the
can's own centre.

```
  motor cup outer edge ..... x = +9.75    (centre -7.5, od 34.5)
  corner boss inner edge ... x = +22.10   (bosses at x=26, dia 7.8)
  USABLE GAP ............... 12.35mm wide, y = -17.1 .. +17.1, 23mm tall
  driver assembly .......... 11.0mm       -> 1.35mm spare
```

Flat does not fit anywhere: flat needs 18mm of width and the widest clear strip
beside the cup is 12.35mm.

Not modelled yet: any retainer. The board is held by wire stiffness and hot glue.
If it needs a real one, the cheap version is two 1.8mm slots in the box floor at
x = 16 +/- 5.5, which print vertically with no supports. `elec_retainer_modelled`
is the flag.

Wiring unchanged and still binding: the pigtail leaves the can on -X and the board
is on +X, so the five leads route round the can (the pigtail is ~200mm, fine).
Six conductors cross the dock - IN1..IN4, 5V, GND - which is exactly the 10 x 8mm
dock window's limit. **The Hall sensor has no spare conductor and must be read in
the CELL, not the pod.**

### 2. A DEFECT THE 14mm DROP CREATED, NOW FIXED

**The pod and cell dock magnets were 15.5mm apart in Z.** `outer_box.scad` was
updated to `mag_z = 13.5` when the stack dropped; `esp32_pod_params.scad` still
said `mag_z = 29` under a comment reading "matches cell", which had quietly
stopped being true. The pogo pins would have mated and the magnets would have
fought them.

Both now derive from one declaration in `dock_interface.scad`:

```
  dock_mag_z     = dock_center_z - 2.0;   // 13.5
  dock_mag_dia   = 8.4;
  dock_mag_depth = 1.2;
```

This is the same duplicated-constant bug the project keeps shipping. Anything that
hand-copies a shared dimension should be treated as a defect waiting to happen.

### 3. R-07 IS SOLVED ON PAPER. The numbers changed, because I had one wrong.

Mridul proposed widening the ramp and exploiting the flat plateaus that Gray order
creates. Both halves of that were checked properly. Result:

**His premise is correct and is already realised in the geometry.** Gray order cut
the total ramps on the disc from **126 to 64**, and the outermost track from 64 to
32 - exactly the "the dip between two highs is gone" he described. The cam code
already merges plateaus automatically, because the profile lerps `val_prev` to
`val_curr` and that is flat when they are equal.

**But it does not buy ramp room, and one number settles it: all 64 boundaries
carry at least one ramp, under BOTH orderings.** Gray guarantees exactly one bit
changes per step, so every single boundary is busy and no ramp can borrow angle
from its neighbour. Equal slice widths are already optimal. A ramp gets one slice
minus the follower footprint, always.

**Variable speed does not help either** - pressure angle is geometric. And fast
through the ramp is backwards: steppers lose torque with speed and the ramp is
exactly where torque is needed. If the motion profile is ever shaped, go SLOW on
the ramp and fast on the dwell.

**MY ERROR, which made the problem look worse than it is.** Earlier R-07 notes
computed ramp room using `foot_w = 1.4`. That is the width ACROSS the track. The
follower is a roll of radius `foot_roll_r = 0.5` lying across the track, so in the
DIRECTION OF TRAVEL the contact is a point, not a 1.4mm flat. The flat actually
needed each side is rho*tan(alpha/2) plus positioning tolerance - about 0.28mm,
not 0.7mm. Every earlier pressure-angle figure was pessimistic.

Corrected, with the disc exactly as it is today (`inner_radius` 12, dia 44.4):

```
  track   r      as built (fraction 0.2)    ramp widened to max
    0   12.80          72.6 deg              impossible at lift 0.8
    1   14.50          70.4                   51.1
    2   16.20          68.3                   41.2
    3   17.90          66.3                   35.0
    4   19.60          64.3                   30.6
    5   21.30          62.4                   27.3
```

So **widening `angular_ramp_fraction` from 0.2 to its geometric maximum is free
and fixes most of the disc.** That is Mridul's "make the ramp big", and it was
always available - it was just never taken. 0.2 was chosen to maximise dwell.

The innermost track is the only real problem and ramp fraction cannot fix it: at
r=12.8 one slice of arc is 1.26mm and it has to contain the whole 0.8mm lift.

**The lever that actually works is `pin_lift`, not the disc diameter.** Innermost
track, pressure angle vs the two variables:

```
  inner_r   disc      plate wall*   lift .8   .6    .5    .4
     12    44.4mm        2.3mm        --    52.0  40.3  30.2
     13    46.4           1.3        57.9   41.7  33.6  25.9
     14    48.4           0.3        48.9   35.9  29.3  22.8
     15    50.4          -0.7        43.0   31.8  26.1  20.5

  * spare material each side in Y on the 58 x 50 base plate, after 1mm clearance
```

**The disc can barely grow** - the base plate is only 50mm wide in Y, so dia 48.4
already leaves 0.3mm of plate. Growing the disc means widening the base plate too
(the cavity is 60, so 54 is available and the standoffs at y=+/-21 stay inside).

**`pin_lift` 0.8 is above the braille standard anyway.** The standard dot height
is 0.46-0.50mm. **The linkage is a rigid slider, not a lever** - foot on the cam,
dot on top, `link_total_h` 12.2 - so cam lift translates 1:1 into dot rise. 0.8mm
was simply generous. Dropping it to 0.5 is standards-correct on its own merits.

**RECOMMENDED R-07, still NOT APPLIED:**

```
  angular_ramp_fraction   0.2  -> geometric max (whole slice less the footprint)
  pin_lift                0.8  -> 0.5      (braille standard, and 1:1 to the dot)
  inner_radius           12.0  -> 14.0
  base_plate Y             50  -> 54       (REQUIRED by the above, cavity is 60)
  -> 29.3 deg on the worst track, 14.4 deg on the best. Under 30 everywhere.
```

The cheap alternative, if reprinting the base plate is unwelcome: widen the ramp
fraction and take `pin_lift` to 0.5, change nothing else. Five tracks pass, the
innermost sits at 40 deg. Zero size change, zero new parts.

### 4. Still true from the previous session

The 14mm drop, the mid-plate removal, the blind cam bore, the restored comb and
Gray order in all three places are all unchanged - see the 2026-08-26 section
below. **Every G-code file is still stale** and the release validator will fail
its STL hash check, correctly. Re-slice AFTER R-07 so it happens once.
`braille_cam.scad` still carries its geometry TWICE and that duplication is still
the real defect behind the bore bug.

**Nothing has been physically assembled. No dot has moved.**

### 5. Waiting on Mridul

- **The blue wire block** on the motor - width and height. The cup notch is a
  guessed 16 x 8mm, flagged SPEC in `motor_spec.scad`.
- **A DIP-16 socket and a ULN2003AN**, plus a scrap of perfboard.

---

## CURRENT STATE - 2026-08-26 (latest, read this first)

### Where the design is

**The stack dropped 14mm. Cell and pod are both 44mm, were 58.** The motor was the
only thing setting the height, and the 14mm electronics bay beneath it existed only
because the driver board lay flat. The board moves to standing on edge, the motor
goes onto the box floor, and the whole tower above it translates down.

```
floor        0.0 ..  4.0
motor can    4.0 .. 23.0
shaft boss  23.0 .. 25.0
cam hub     25.0 .. 29.0
cam disc    29.0 .. 31.0     cam_flat_z, was 45
base plate  27.0 .. 32.0
standoffs   32.0 .. 40.0
top plate   40.0 .. 44.0     shell_height, was 58
```

Every gap above the motor is unchanged, so `link_total_h` is still 12.2mm and the
already-ordered resin linkages stay valid. Re-rendered and confirmed: only the two
enclosures changed size. Cam, linkages, comb, dot insert, top plate and base plate
are identical.

**The mid-plate and its ledge are gone.** A cup moulded into the box floor locates
the motor instead, with its wire-block notch on -X (the old collar had it on +Y,
which is 90 degrees wrong and the motor would not have dropped in). No screws are
needed: every force here points down, so the seat carries it and the wire block in
its notch carries the torque reaction.

**The cam bore is BLIND again.** A 2.6mm boss on the disc centre takes the bore to
8.1mm with a 0.5mm roof over the shaft tip. Nothing projects through the cam face.
Bounded by the arms at 3.5mm above and the 7.5mm of shaft to swallow below.

**Also landed:** the comb is restored and has corner scallops for the standoffs;
Gray order is live in the cam, the firmware and the simulator; the pod is
standardised on M2.5; `motor_spec.scad` now owns every 28BYJ-48 dimension.

### Two defects found this session, both mine

1. **The earlier cam bore fix only reached half the file.** `braille_cam.scad`
   carries its geometry TWICE, at top level and in `module braille_cam()`. Commit
   e762b7e repaired the `cube(center=true)` bore in the module and left the top
   level alone, so `cad/stl/braille_cam.stl` carried the original 3.5mm bug for a
   week while the commit said it was fixed. Both paths now call the same modules.
   **The duplication itself is still there and is the real defect.**

2. **I claimed slice ORDERING buys ramp room. It does not.** A state's angle is the
   CENTRE of its slice, so a ramp always has one slice minus the foot to finish in.
   Gray order is still worth having for chatter and torque, but it does not touch
   R-07.

### In progress / not started

- **R-07 is still open and is the next CAD job.** Not applied. The numbers:

> **SUPERSEDED 2026-08-31. The numbers in this bullet are wrong** - they were
> computed using `foot_w` (1.4mm, the width ACROSS the track) as the flat the
> follower needs, but the follower is a 0.5mm roll and along the direction of
> travel it is a point contact. See section 3 at the top of this file for the
> corrected figures and the recommended change. R-07 is still not applied.

  `angular_ramp_fraction` 0.2 was deliberately narrowed to maximise dwell, and that
  is what made the ramp a 72.6 degree wall. Widen it to the whole slice, move
  `inner_radius` 12 -> 14.4 and `pin_lift` 0.8 -> 0.5, and it reaches **30 degrees
  with all 64 states on a 44.9mm disc** - the current disc is 44.4mm.
- **Every G-code file is stale** and `tools/validate_print_assets.py` will fail its
  STL hash check, correctly. Re-slice AFTER R-07 so it happens once.
- **Nothing has been physically assembled.** No dot has moved. The breadboard
  circuit still has not been built.

### Next steps, in order

1. Push. Several commits are local only, and the other forks read this file.
2. Apply R-07 in one pass: ramp fraction, `inner_radius`, `pin_lift`, foot width.
3. Re-slice everything and re-run the validator.
4. Reprint: box, base plate and comb in PETG; cam and linkages in resin.
5. Assemble and run the hand-turn test that has been outstanding since 4 Aug.

### Waiting on Mridul (both five-minute jobs with the calipers)

- **The blue wire block** on the motor - width and height. The cup notch is sized
  16 x 8mm as a guess and is flagged SPEC in `motor_spec.scad`.
- **The driver board** once cut down - it has to clear 23mm standing on edge.

### Key files this session

`cad/scad/` - NEW `motor_spec.scad`, NEW `linkage_comb.scad`; `outer_box.scad`,
`mech_layout.scad`, `braille_cam.scad`, `base_plate.scad`, `dock_interface.scad`,
`esp32_pod_params.scad`, `mid_plate.scad` (superseded), `linkage.scad`,
`top_plate.scad`, `esp32_pod_lid.scad`.
`firmware/braille_cell/braille_cell.ino`, `sim/3d/app.js`,
`sim/braillix_params.json`, NEW `README.md`, NEW `renders/blender_mechanism.py`,
NEW `renders/readme_mechanism.scad`.

---

## 2026-08-26 - CAM/COMB PASS, AND ONE DECISION NEEDED

### Done and committed

**The comb is back.** It was deleted 2026-06-04 with the note "linkages are
constrained at BOTH ends ... a separate comb guide is unnecessary". That is wrong,
and Mridul disproved it by hand on 2026-08-24: the foot only RESTS on the cam, so
nothing resists tangential load, and on a ramp the cam drags the whole linkage
round the disc instead of lifting it. `cad/scad/linkage_comb.scad` is rebuilt -
square 48x48, a closed pocket per foot at track radius, corner scallops for the
four standoffs, four locating pegs (matching pegs added to `base_plate.scad`), and
a raised dot marking the top-left corner.

**Cam is now GRAY ORDER.** Slice i carries pattern gray(i), so exactly one dot
moves per step instead of up to six. "hello world" drops from 359 to 171 dot
movements and peak torque falls about 6x, which matters with one motor.
`use_gray_order` in `braille_cam.scad`, `USE_GRAY_ORDER` in the sketch,
`GRAY_ORDER` in `app.js` - **all three must agree, or every letter shows the wrong
pattern.** Round trip verified for all 64 states.

**Cam bore fixed.** The Double-D cut used cube(center=true) inside a translate, so
it was centred on the translated origin: the intersection ended at z=-0.5, a BLIND
hole 3.5mm deep that never reached the disc floor, against the 8mm
`shaft_bore_depth` claims. Rebuilt as an extruded 2D profile. This confirms Codex's
2026-08-19 finding independently.

**Pod standardised on M2.5** (handoff item 4). The pod is not printed, which was
the condition attached to that request. The motor stays M4 - the 28BYJ-48 ears are
drilled 4.2mm.

**`foot_len`, `arm_y` and `foot_w` moved into `mech_layout.scad`.** They were
private to `linkage.scad`, so the comb read them as undef and OpenSCAD silently
rendered a 1mm-tall ring instead of 6mm. The rebuilt `linkage.stl` is
vertex-identical, so the move changed no geometry.

### Corrected - an error of mine

I claimed slice ORDERING buys ramp room. **It does not.** A state's angle is the
CENTRE of its slice and the foot must be flat there, so a ramp always has one slice
minus the foot to finish in, however long the track then holds its value. Gray
order is still worth having for chatter and torque, but it does not touch R-07.

Ramp room comes from radius, foot width, lift and ramp fraction. Measured at the
current inner track with a 0.6mm foot:

```
angular_ramp_fraction 0.2 (today)     72.6 deg   sideways push 3.19x lift
ramp widened to the whole slice       50.6 deg
  + inner_radius 12 -> 14.4           42.8 deg
  + pin_lift 0.8 -> 0.5               30.1 deg   sideways push 0.58x
```

**30 degrees is reachable with all 64 states on a 44.9mm disc. The current disc is
44.4mm.** The ramp was deliberately narrowed to maximise dwell, and that is what
made it a wall. This pass is NOT yet applied.

### DECISION NEEDED - the motor sits 4mm too high, and there are two ways out

> **RESOLVED 2026-08-26, and then some.** Mridul chose Option B, and went further:
> the motor now sits on the box FLOOR, not on a cup seat. See the CURRENT STATE
> section at the top of this file. Everything below in this section is the analysis
> that led there, kept for the reasoning.


Verified from source, not from comments:

```
floor            0.0 ..  4.0
elec pocket      4.0 .. 18.0
mid-plate ledge 18.0 .. 20.0
mid-plate       20.0 .. 22.0
motor can       22.0 .. 41.0    -> motor face 41.0 = base_plate_z
collar (9x2)    41.0 .. 43.0    <- the cam hub must land HERE
cam disc        43.0 .. 45.0
cam HUB bottom  39.0            (hub_h = 4)

INTERFERENCE 4.0mm
```

**Option A (Codex, 2026-08-19):** raise the upper stack +4mm. Already implemented
behind `stack_repair_raise` in `stack_options.scad`, default off. Cost: the box
gets 4mm taller. Mridul does not want this.

**Option B (Mridul, 2026-08-26):** drop the MOTOR 4mm instead. The mid-plate is
2mm and its ledge is 2mm, so removing both is exactly the 4mm needed, with no
change to box height and no change to the 14mm electronics pocket.

```
floor            0.0 ..  4.0
elec pocket      4.0 .. 18.0
motor can       18.0 .. 37.0    -> motor face 37.0
collar          37.0 .. 39.0    = hub bottom 39.0   MATCHES, hub_h stays 4
shaft tip       46.5            = 1.5mm above the cam flat, clear of arms at 48.5
```

**What Option B costs:** the motor currently bolts UP into `base_plate` at z=41 and
is located laterally by the mid-plate's 29.5mm x 8mm collar. Drop it 4mm and
neither works. It needs a new seat - most likely a collar plus two ear bosses on
the base plate's UNDERSIDE, spanning the new 4mm gap. That is a real base-plate
change, not a parameter tweak.

**Not yet applied. Mridul is choosing. Do not implement either half of this.**

### On screwing the motor ears

The spring load is DOWNWARD, through the linkages into the cam and onto the shaft,
so nothing lifts the motor in service. A seat plus a collar that captures the can
carries the torque reaction and is sufficient for the mechanism. Screws earn their
place for handling, for transport, and for the moment the cam is pulled off the
shaft. Recommendation: keep the collar as the anti-rotation feature and treat the
two M4 ear screws as retention, not as the primary mount.

---

---

## 2026-08-26 - TWO NOTES FOR THE OTHER FORKS

### FOR THE ELECTRONICS FORK - the driver board no longer fits, and the fix is a cut

> **RESOLVED 2026-08-31. Mridul chose the bare IC (option 2), not the cut (option 1).**
> The cell now carries a bare ULN2003AN in DIP-16 on a 28 x 18mm scrap of perfboard,
> 11mm overall with a socket. Dimensions, position and clearances are in
> `cad/scad/electronics_spec.scad`; the summary is in section 1 at the top of this
> file. The analysis below is kept for the reasoning, but the numbers for the
> off-the-shelf module no longer describe what is being built.


The stack dropped 14mm (cell and pod are both 44mm now, see the section above), and
that removed the flat electronics bay under the motor. The board was going to stand
on edge against the +X wall instead. It does not fit:

```
cavity floor top ............. 4.0
base plate ................... 27.0 .. 32.0    <- cuts across
clear height for a board ..... 23.0 mm

ULN2003 module ............... 35 x 32 mm
standing on its long edge .... 32 mm
                               needs 32, has 23
```

It cannot poke past the plate either: the base plate is 58 x 50 in a 60 x 60
cavity, leaving 5mm of gap in Y and 1mm in X. Lying flat does not work either -
beside the motor can there is only 23.4mm of width against a 32mm board.

**The module is 35 x 32 almost entirely because of the white JST socket, the four
LEDs and the header.** The driver itself is a ULN2003AN in DIP-16: 20 x 7 x 4mm.

Options, best first:

1. **Cut the board.** Remove the LED strip and trim past it. That gets roughly
   35 x 22, which stands in the 23mm with 1mm to spare. The LEDs are indicators in
   series with the outputs, so losing them costs nothing electrically.
2. **Bare ULN2003AN on a scrap of perfboard**, about 25 x 15mm. Fits anywhere,
   roughly Rs 20. Preferred if the cut goes wrong.
3. Do NOT desolder the DIP-16 off the module without hot air - it lifts pads.

**Measure the real board first.** Some of these are 42 x 31 rather than 35 x 32,
and if one edge already clears 23mm none of this matters.

Also still true and unchanged: the driver cannot move into the pod. The dock window
is 10 x 8mm, which caps the interface at six conductors, and four coils plus 5V and
GND already uses all six with nothing left for the Hall sensor.

### FOR THE SIMULATION FORK - one stale warning, one cosmetic point

**`sim/3d/electronics.js:529` is out of date and should be deleted.** It reads:

> "the shaft is 10mm long but only 4.8mm of it fits inside the cam hub, so 5.2mm
> currently stands proud of the base plate and into the linkage space. That is a
> real unresolved clash, not a drawing error."

Neither the numbers nor the conclusion hold any more. The shaft is 9.5mm, not 10,
and the first 2mm is the shaft boss. The bore is now a BLIND 8.1mm socket reaching
up into a boss on the disc centre, so the shaft is fully swallowed with 0.5mm of
roof over its tip and nothing projects through the cam face at all. Leaving that
text in reports a fixed defect as live.

**`sim/3d/electronics.js:231`** draws the output shaft as a plain 5mm cylinder for
its whole 9.5mm. The real first 2mm is the 9mm shaft boss. The tip lands in the
right place so nothing downstream is wrong; the base just looks thinner than the
part. Worth fixing when that file is next open.

Worth knowing while you are in there: `braille_cam.scad` carries its geometry
TWICE, once at top level and once in `module braille_cam()`. They had silently
diverged - the top level kept the original broken 3.5mm bore while the module had
the repaired one. Both are correct as of 2026-08-26, but anything reading that file
should be aware the duplication exists until it is collapsed.


## 2026-08-19 PRINT RELEASE AUDIT - CURRENT SOURCE OF TRUTH

**Full product remains NO-GO.** Use `docs/PRINT_RELEASE_2026-08-19.md` and
`docs/MECHANISM_BENCH_TEST.md`.

The checked PETG folder contains exactly eight files:

1. `motor_cam_socket_coupon.gcode`
2. `base_interface_coupon.gcode`
3. `pigtail_slot_coupon.gcode`
4. `pogo_receiver_coupon.gcode`
5. `top_interface_coupon.gcode`
6. `hardware_fit_coupon.gcode`
7. `cam_linkage_test_fixture.gcode`
8. `mid_plate.gcode`

The final top plate is no longer in the checked folder. Its settings-valid G-code is held at
`printing/gcode_HOLD_fit_unproven/top_plate_WAIT_FOR_INTERFACE_COUPON.gcode` until the real
M2.5 screw and resin dot insert pass the top-interface coupon.

Fresh validator result: PASS for 19 authoritative STL assets and the exact eight-file G-code
manifest. Every checked mesh is closed/manifold, has its expected component count, and matches an
independent fresh OpenSCAD render. Every checked G-code uses PETG 235/230 C, bed 80 C, 0.16 mm,
5 walls, 40% infill, 6/6 shells, 8 mm brim, ironing, supports off, no arcs, and the Kobra Neo
motion envelope.

New stack-independent evidence assets:

- top screw/head plus 0.2/0.4/0.6 mm resin-insert fit coupon;
- base motor-seat bridge, 2mm M4 pilot, and Ø6x12 standoff-bore coupon;
- 5x3 / 6x4 / 7x5 mm pigtail cable-slot coupon in the real 4 mm lid thickness;
- 10.0x8.0 / 10.2x8.2 / 10.4x8.4 pogo receiver coupon in a real 4 mm upright wall;
- two-piece PETG cam/linkage fixture with the exact 9.0 mm cam-flat-to-insert datum;
- minimal four-component resin set: real cam, dot-5 linkage, dot-6 linkage, and dot insert.

The pogo cap is TPU 95A only; no TPU G-code exists because the exact spool is not owned/specified.
Stale PETG-cap and sacrificial-bridge instructions were corrected.

Additional fastener blocker: the old M4x10 motor screw reaches about 3mm into the proposed raised cam. Candidate is M4x5 or M4x6 only after measuring the real ear/point and passing the base coupon.

Critical production blocker remains unchanged: the current cam bore is only 3.5 mm deep and cannot
install on the measured 7.5 mm shaft. Preferred repair keeps the shaft intact, seats the hub on the
9x2 mm collar, raises the upper mechanism/enclosures +4 mm, creates a true 7.7 mm blind socket, and
raises the Hall sensor to retain its 0.4 mm gap. This coordinated cascade still requires explicit
AJ approval. The current 64-state ramp also remains HOLD until the real dot-5/dot-6 spring and
torque procedure passes.

---
## ⚡ ELECTRONICS TRACK — separate workstream, separate fork

**Electronics work is now tracked separately from CAD.** The electronics fork flags mechanical
issues but never changes `cad/scad/*`. Source of truth: **`docs/ELECTRONICS_PLAN.md`**.

**Decisions taken 2026-08-01:**

- **No custom PCB. No custom ICs. The ATmega328P "muscle board" is CANCELLED.** It is TQFP-32 at
  0.8mm pitch — not hand-solderable — which contradicts the project's own "build it ourselves"
  aim, and it solves a multi-cell problem that does not exist yet with one cell.
- **Seven docs still reference it and are STALE:** `DEMO_VS_PRODUCT.md`, `ELECTRONICS_BOM.md`,
  `MASTER_BOM.md`, `PRINT_CHECKLIST.md`, `SHOPPING_LIST.md`, `SOFTWARE_TEAM_README.md`,
  `WIRING_AND_ASSEMBLY.md`. `ELECTRONICS_PLAN.md` supersedes them.
- **Multi-cell uses an MCP23017 I²C expander — one PER BRICK** (revised 2026-08-02; was
  "3 cells share one"). DIP-28, hand-solderable, ~₹80. One-per-brick wastes 11 of 16 I/O but
  makes every cell an **identical, self-contained, addressable module**: adding a cell means
  plugging in and setting 3 address jumpers, never rewiring a neighbour. Ceiling: 8 cells/bus
  → 16 on the ESP32's second I²C controller → 64 via a TCA9548A mux. **Explicitly NOT the
  PCF8574**: quasi-bidirectional outputs with a weak high side cannot reliably source the few
  mA a ULN2003 input needs. Zero custom silicon, zero SMD at every tier.
- **Inter-brick cable is a FIXED 4 wires (5V, GND, SDA, SCL) regardless of cell count.** This
  is the whole scaling argument — 5 wires per cell is the dead end.
- **First limit hit is POWER, ~11 cells** on the 3A supply, and only if all motors move
  simultaneously. Sequential refresh removes it. This makes *"de-energise coils when idle"* an
  architectural rule, not a nicety.
- 🔴 **I²C pull-ups: 2× 4.7kΩ at the BRAIN end ONLY, once, ever.** Repeating them per brick is
  the classic failure — 8 × 4.7k parallel = 590Ω, beyond what an I²C device can sink.
- **Multi-cell forces hall sensors from AO to DO** (expanders have no ADC). ⚠️ **Superseded
  2026-08-21:** rather than calibrate a trimmer per cell, the sensor changes to a bare **A3144
  unipolar digital switch (TO-92)** — threshold and hysteresis are inside the chip, so there is
  **nothing to calibrate at all**, and it fits the existing 4.5×3.5×1.6mm pocket unchanged.
- **Plan: build both muscle boards WITH the expander** even though 2 cells don't need it — that
  makes the N-cell claim demonstrable to the panel rather than theoretical. Breadboard bring-up
  stays direct-GPIO.

**🔴 New electronics defect found 2026-08-01 — GPIO PIN CONFLICT:**

```
ASSEMBLY_BIBLE / breadboard_test.ino   GPIO21 -> ULN2003 IN3 , GPIO22 -> ULN2003 IN4
SOFTWARE_TEAM_README                   GPIO21 = I2C SDA      , GPIO22 = I2C SCL
```

The motor and the I²C bus are assigned the same two pins. Harmless with one cell; breaks the
instant a second cell is added. Fix is **IN3 -> GPIO23 and IN4 -> GPIO27**. **Do not change
before the demo.**

⚠️ **Corrected 2026-08-02:** an earlier revision of this handoff and of `ELECTRONICS_PLAN.md`
Part 3 said `IN4 -> GPIO5`. **GPIO5 is a strapping pin** sampled at boot; a motor coil on it
can stop the ESP32 starting. **27** is correct and matches Part 10's pin map.

**Joint durability (added 2026-08-02, `ELECTRONICS_PLAN.md` Part 12):** solder joints fail
because the *wire* flexes at the joint edge, not because the solder breaks — so the fix is
heat-shrink plus **anchoring the wire 5–10mm away**, not adhesive on the joint. Use **hot glue,
not epoxy**, until the pin map is frozen (it isn't — see the conflict above and the expander
migration). 🔴 Never use acetic-cure (vinegar-smelling) silicone: it corrodes copper. Never
glue the inter-brick connection — modularity depends on it separating.

**Electronics status:** nothing is blocked by electronics. Every part for one working cell is
owned. The blocker is that **the breadboard circuit has never been built** — no soldering
required, Dupont only. The single soldering job available today is putting header pins on the
DC pigtail's bare wires so it plugs into a breadboard.

**Corrections logged 2026-08-01 (earlier docs were WRONG):**
- ✅ **Multimeter is OWNED** and **jack polarity has been MEASURED CORRECT** (red = positive).
  The single biggest risk to the ESP32 is retired.
- ❌ **NO soldering iron is owned.** `ELECTRONICS_BOM.md` and `MASTER_BOM.md` both claimed one
  was — both corrected. Buy a **60W temperature-controlled "936" station, ceramic heater,
  2.4mm chisel tip, ~₹1,300**. NOT a plain ₹200 pencil iron: uncontrolled heat burns the flux
  off before it can wet the joint, which makes soldering feel impossible and is blamed on
  technique. `ELECTRONICS_PLAN.md` Part 9 has the full reasoning.

**TWO-CELL DESIGN DECIDED (Part 10):** two cells need **NO expander and NO I²C** — the ESP32 has
15 safe output pins and two cells plus nav need 11. Direct drive both. The pin map is chosen so
**adding cell 2 never touches cell 1's wiring**: cell 1 on GPIO 18/19/23/27 + hall 34, cell 2 on
13/14/26/33 + hall 35, nav on 32/25/17, and 21/22 left free for I²C if a 3rd cell ever appears.
Avoid GPIO 0/2/5/12/15 entirely — they are strapping pins read at boot and a motor coil on one
can stop the ESP32 booting. An expander only earns its place at roughly 4 cells.

**Still open (electronics):** buy the soldering station + solder + breadboard + strippers
(~₹1,900); build the breadboard circuit (no soldering needed); the `+32` mid-dwell firmware fix
is deferred because it is tied to the mechanical re-derivation.

---

## 🔴 ELECTRONICS/BOM FORK - THE RETURN SPRING IS ~6x TOO STIFF (2026-09-01)

`mech_layout.scad:212  spring_wire = 0.3` is wrong by a wide margin, and it is a
bigger torque problem than R-07. Found while sizing Mridul's purchased springs
(2mm OD, 40mm free, 50 coils, 0.3mm wire - confirmed, cuts into ten 4mm pieces
at exactly the specified 5 coils).

Using your own installed geometry (`mech_layout.scad:293-295`, 3.0mm gap dot-down,
2.2mm dot-up, 4.0mm free length) and G = 69 GPa for 304 stainless:

```
wire    rate        F dot-down   F dot-up
0.30mm  2.844 N/mm    2.84 N       5.12 N     <- as specified today
0.20mm  0.473 N/mm    0.47 N       0.85 N
0.18mm  0.300 N/mm    0.30 N       0.54 N
```

A braille dot only resists a fingertip: 0.05-0.15 N. The current spec is ~20x that,
and all six load the cam simultaneously:

```
six springs on the cam ........ 17.1 N
friction torque, mu=0.3, r=17    87 mN*m
28BYJ-48 output .................~30 mN*m     -> 2.9x SHORT ON FRICTION ALONE
```

That is before lifting anything. Rate goes as wire diameter^4, so this is entirely
a wire-gauge error, not a geometry error - **no CAD dimension needs to move except
the constant itself.** The 1.4mm bore only gains clearance with thinner wire, the
spring still never goes solid, and `flange_dia` 2.2 still exceeds the ID.

**Requested change:**
```
mech_layout.scad
  spring_wire   0.3  ->  0.2      (0.18 is optimal; 0.2 is what is sourceable)
  spring_id     recomputes 1.4 -> 1.6, still > nub_width 1.0
```

⚠️ **This does not stand alone - it needs R-07 in the same pass.** With 0.2mm springs
at today's 72 degree pressure angle, lifting one dot still needs ~44 mN*m. At the
30 degrees your R-07 numbers reach, it falls to ~9 mN*m and the full cycle lands
near 24 of the motor's 30 mN*m. Fixing either one alone leaves the mechanism
immobile; fixing both gives roughly 20% margin.

**Assumptions stated so they can be challenged:** G = 69 GPa (conservative - music
wire would be worse), resin-on-resin mu = 0.3 (never measured), motor 30 mN*m.
Mridul is putting a cut spring on a kitchen scale to measure the real rate; if it
does not read ~290g at 3mm compression, this whole entry is wrong and I will redo it.

---

## ⚡ ELECTRONICS FORK - VERIFICATION PASS 2026-08-31

Re-checked all eight of my 2026-08-21 requests against source after your v8.5 pass.
**Four are closed, one is still open and blocks a purchase, one is still yours.**

| # | Request | Status verified from source |
|---|---|---|
| 1 | Homing magnet 3.0 -> 8.0 | 🔴 **STILL OPEN.** `mech_layout.scad:109` is 3.0, and line 110 still says "BUY 3x1mm". |
| 2 | Motor screws must be brass | ✅ **MOOT - withdrawn.** No screws exist any more. |
| 3 | Left ear pilot 2mm -> 5mm | ✅ **MOOT.** Same reason. |
| 4 | Pod lid M2 -> M2.5 | ✅ **DONE.** `insert_m2_dia` 3.5, `insert_m2_depth` 5.5, `lid_boss_tap` 2.5. |
| 5 | Dock window caps at 6 conductors | ✅ Unchanged, 10.0 x 8.0. `dock_center_z` moved 31 -> 15.5, no effect. |
| 6 | 4 magnets per face (idea only) | Unchanged, `mag_y_pos [-14,14]`. Still an idea. |
| 7 | A3144 fits the pocket | ✅ **CONFIRMED, no action.** Pocket 4.5 x 3.5 (`hall_interface.scad`), A3144 4.1 x 3.0. |
| 8 | `BUILD_PACK.md` Part 0 contradiction | 🔴 **STILL OPEN.** Table says Actuation HOLD, prose says "Three of four layers are real hardware." |

### On #2 and #3 - I was wrong twice and your file caught it

`base_plate.scad:63` says the ear pilots are now 4mm from the ears and that screws
were retention, not structure. **So there are no M4 motor screws to buy at all.**
`MASTER_BOM.md` line 49 is now `DO NOT BUY`; the M4x5-brass line I put there on
2026-08-21 is withdrawn. The brass argument dies with it - there is no steel screw
near the magnet orbit any more.

### Reply to your driver-board note - your arithmetic is right, your fix is riskier than stated

23mm clear is confirmed independently: `base_plate_z` 27 minus `floor_thickness` 4.
The 23.4mm of width beside the can also reproduces: the can spans x -21.55..+6.55
against a +30 cavity wall.

⚠️ **But option 1 - "cut the board" - has a failure mode your note does not mention.**
On the standard module the LED row sits **between the ULN2003 and the white JST
socket**, so a cut that removes the LEDs very likely removes the JST with it, or
severs the four output traces feeding it. Also, the LEDs are **parallel** indicators
(5V through a resistor onto each output pin), not in series with the coils - your
conclusion that losing them is electrically free is correct, but the reason given
is not, and the wrong reason is what hides the trace risk.

**Take option 2, and take it as first choice, not fallback.** A bare ULN2003AN in
DIP-16 is 20 x 7 x 4mm, and this fork is already building a per-cell perfboard for
the MCP23017. **Put the ULN2003, the MCP23017 and the A3144 pull-up on that one
board** - roughly 40 x 25mm - and the fit problem disappears instead of being
trimmed down to 1mm of margin. Electronics fork owns this; no CAD change requested.

---

## 🔧 CAD REQUESTS FROM THE ELECTRONICS FORK - 2026-08-21

Raised while sourcing parts. **Electronics fork does not touch `cad/scad/*`** - these are
requests, not changes. Ordered by how much they block a purchase.

### 1. 🔴 DECIDE NOW - homing magnet goes to 8mm

Mridul **cannot source 3x1mm magnets**. The only 3mm stock available is **3x3mm**, which is
disqualified by the cam's own assert:

```
disk_base_thickness      2.0mm
assert magnet_depth  <   1.5mm
3x3mm magnet needs       3.2mm   -> cuts clean through the floor
8x1mm magnet needs       1.2mm   -> fits, 0.8mm floor remains
```

3x3mm is the same failure the old 3x2mm BOM entry caused. He already owns 8x1mm.

**Requested change:**
```
mech_layout.scad
  homing_mag_dia   3.0  ->  8.0
  homing_mag_thk   1.0      unchanged
```

Pocket becomes 8.4 x 1.2mm at r=17.35, spanning r 13.15..21.55 inside a 22.2mm disc. Fits
radially, still passes the depth assert. Flex was checked and is a non-issue - 0.8mm of resin
over an 8.4mm span deflects ~0.003mm under 1N, before the bonded magnet stiffens it.

### 2. 🔴 CONSEQUENCE OF #1 - motor screws must be non-magnetic

An 8mm magnet orbiting at r=17.35 passes **~8mm from the steel M4 screw at x=+9.85**, once per
revolution. Estimated 0.2-0.5N attraction, about **5 mN*m of torque ripple - roughly 10% of the
28BYJ-48's output**. With R-07 open, that margin is not available.

**Fix is a purchase, not a CAD change: the M4 motor screws must be BRASS.** Recorded here so
nobody later "helpfully" substitutes steel.

**Length: following your `MASTER_BOM.md` line - M4 x 5mm thread-forming, and NOT x6 or x10 until
the coupon proves >=0.5mm cam clearance.** The electronics fork had been quoting the stale M4x10
from an older doc; your row is correct and this fork now defers to it.

**The only thing this fork adds is the material: BRASS, not steel.** That is new information from
the 8mm magnet decision above and is not yet reflected in `MASTER_BOM.md`. Please carry it across
when the coupon fixes the length.

### 3. Motor ear pilot depth - free thread engagement being discarded

`base_plate.scad` gives both ears `motor_mount_pilot_depth = base_thickness - cam_pocket_depth`
= **2mm**. But the two ears do not have the same material above them:

| Ear | x | Material available | Pilot given |
|---|---|---|---|
| Left | -24.85 | **5mm** (clear of the cam pocket) | 2mm |
| Right | +9.85 | 2mm (cam pocket floor above) | 2mm |

The right ear is genuinely capped at 2mm. **The left one is not, and is the ear worth deepening**
- M4 at 2mm engagement is 0.5x diameter and will strip under repeated reassembly. Load is fine
(~2N); reassembly life is the concern.

### 4. Pod lid fastener - M2 or M2.5? Still undecided, and it gates a print

`BUILD_PACK.md` 7.3 proposed standardising the pod lid **M2 -> M2.5** so the whole project buys
one insert size. It was flagged for this fork and never actioned. CAD is still M2
(`insert_m2_dia = 3.2`, `lid_boss_tap = 2.0`).

```
esp32_pod_params.scad   (only if the pod is NOT yet printed)
  insert_m2_dia    3.2  ->  3.5
  insert_m2_depth  4.5  ->  5.5
  lid clearance    2.2  ->  2.9
```

Post wall goes 1.65 -> 1.5mm, still fine for hot brass. **If the pod is already printed, do
nothing** - two M2 screws beat a reprint. Mridul is buying an assorted M2/M2.5/M3 insert kit so
he is covered either way. Confirmed pod lid is **2 screws**, not 4.

### 5. Dock window 10 x 8mm caps the architecture at 6 conductors

Worth knowing because it constrains more than the connector:

```
2x3 header (2.54mm)  =  7.62 x 5.08mm  ->  fits, 6 conductors
2x4 header           = 10.16 x 5.08mm  ->  0.16mm too wide
```

**Direct-GPIO two-cell needs 7 conductors** (5V, GND, IN1-4, hall) - it does not fit through the
existing window with *any* connector, pogo included. The MCP23017-per-brick plan drops it to 4
(5V, GND, SDA, SCL), which is what makes the dock viable at all. A 5-pin pogo has been sourced
and fits that budget with one spare.

For 24 Aug the inter-cell link is a **loose wire bundle through the window** - no connector, no
CAD change needed.

### 6. Idea, not a request: 4 magnets per dock face

If the dock is ever revisited - **4 magnets per face = 4 conductors = exactly the I2C bus**, using
the magnets themselves as contacts (nickel plating conducts; wire clamped under the magnet, never
soldered - neodymium degrades above ~80C).

Geometry allows it: the centre is blocked (an 8.4mm pocket at y=0 collides with the 10mm window,
which is why the 5th was dropped) but `y=+/-24` clears both the window and the corner bosses.

⚠️ If you do this, **pockets to 1.5mm deep, not 1.2**. That recesses the magnet 0.5mm so a flat
metal surface cannot bridge 5V to GND across an undocked cell face. At 1.2mm they sit 0.2mm proud
of shorting.

### 7. Hall sensor is changing to a bare A3144 - pocket is already correct

Moving off the analog MH module (trimmer calibration per cell, and expanders have no ADC) to a
bare **A3144 unipolar digital switch in TO-92**.

```
CAD pocket   4.5 x 3.5 x 1.6mm
A3144 TO-92  4.1 x 3.0 x 1.5mm   -> fits, no change needed
```

**No action required** - recorded so the pocket is not "optimised" for the old module later.

### 8. ⚠️ Contradiction inside `BUILD_PACK.md` Part 0

The release-gate header now marks **Actuation as HOLD** (cam socket cannot install), but the prose
two lines below still reads *"Three of four layers are real hardware."* Those disagree, and it is
the section aimed at the 24 Aug panel. **Yours to resolve - it is a status claim about the
mechanism, not about electronics.**

---

## 📩 MESSAGE FOR ATISHAY'S CODEX — please read before touching the CAD

Thanks for the measurement pass. M5, M11b and M21 all landed cleanly, and the rebase was
conflict-free — we touched completely separate files. Three things you should know before the
next CAD session, one of which changes what you should work on.

**1. Do NOT re-derive the vertical stack yet. This is the important one.**
Your handoff lists the stack redesign as the next CAD task. Please hold it. There is a newer and
more serious finding — **R-07, the cam pressure angle** (detailed below). It is 71–79° against a
30° guideline for a translating follower, and the ramp run is *shorter than the follower's own
0.5mm roll radius on every track*. No measurement fixes it; it is architectural. If R-07 is real,
the disc gets bigger or splits into two cams — and a vertical stack re-derived for the current
disc would be thrown away.

**The resin plate lands ~4 Aug and it IS the test coupon.** Rest one linkage foot on a cam track,
turn it by hand, watch a ramp transition. Two minutes, no motor, no electronics. That decides
whether this is a parameter fix or an architecture change. Please let that happen first.

**2. There is a firmware bug neither of us had spotted.**
`firmware/breadboard_test/breadboard_test.ino` targets `pos * STEPS_PER_REV / 64`. The cam's ramps
are centred on slice boundaries, so that lands **mid-ramp**, not mid-dwell. Verified numerically:
at state 0 all six dots sit at factor 0.5 — half-raised, unreadable. The fix is `+ 32` (half a
slice). Not applied yet because it belongs with the stack pass, but worth knowing it is not a
mechanical fault when it shows up on the bench.

**3. There is now a simulator, and it can check your work in one command.**
`sim/3d/` is a Three.js app (orbit, X-ray, kinematics) built from the real STLs. More useful to
you: `python sim/extract_params.py` **parses every mechanism constant out of the CAD** rather than
duplicating it, and asserts the encoding before writing — `DOT_TO_BIT == 5 - dot_track`, the
worked examples, and that all 64 states round-trip uniquely.

When I pulled your commit I ran it and diffed the output: **identical**, so your change provably
did not disturb the mechanism. Please run it after any edit to `mech_layout.scad` or
`braille_cam.scad`. If it errors, the CAD and the docs have disagreed and something is wrong.

**One correction to your handoff wording:** it says *"v7.5 through v7.7 repaired the geometry
defects"*. True for the fit defects, but R-07 is open and is a bigger problem than any of them.
Worth not reading that line as "the mechanism is sound".

Also still open and unowned: **change the exposed WiFi password**, and **nothing has ever been
physically assembled** — no dot has moved. The breadboard circuit needs no resin and no CAD.

**4. One shared-CAD change:** `link_thickness = 1.0` moved into `mech_layout.scad`, and
`linkage.scad` now reads `thickness = link_thickness`. Geometrically a no-op — the rebuilt
`linkage.stl` is vertex-identical (62,352 verts) — but the assembly transform needs that number,
and duplicating it is how the simulator put all six dots 0.5mm off their holes.

**5. ⚠️ RETRACTION — I was wrong about a "2mm stack error". Please ignore it.**
On 2026-07-31 I annotated `outer_box.scad:base_plate_z` claiming the tower was 2mm out because
the mid-plate rests on top of its ledge rather than level with it. **The seating observation is
right; the conclusion was wrong.** That 2mm had already been absorbed by cutting
`elec_pocket_h` 16 → 14 (commit a53594c, written up in `docs/PRINT_DAY_MONDAY.md`). Read from
source, the stack closes exactly: 4 floor + 14 pocket + 2 ledge + 2 mid-plate + 19 motor = 41.

Cause: my analysis script **hard-coded `elec_pocket_h = 16` instead of reading the file** — the
exact duplicated-constant failure this project keeps hitting, and which I have been lecturing
about all week. The annotation is now retracted in-source. **`base_plate_z = 41` is correct.**

Still genuinely open on the vertical stack: the **cam hub** (`hub_h = 4` into a 2mm gap, worse
with the Ø9 shaft boss). That one is real and unchanged.

— Claude Code, on Mridul's side

---

## 🔴 CURRENT BLOCKER: VERTICAL-STACK REDESIGN + PHYSICAL FIT EVIDENCE

The fit-critical owned readings are now received:

- M5 motor shaft across-flats = **3.0mm**. The existing 3.2mm cam bore gives 0.2mm total clearance.
- M11b bare Hall body thickness = **1.6mm**. The recess is also 1.6mm, so it requires a dry-fit
  because there is zero print margin.
- M21 ESP32 header-row centre spacing = **25.6mm**. `hdr_row_pitch` now uses the owned reading.

The 2026-07-31 photo identifies the owned power connector as an **inline female DC pigtail jack**.
The current design keeps its body outside, passes only the red/black leads through the lid, and ties
them to the shell's internal strain-relief post. The guessed panel-jack cradle was removed.

**Current connector decision:** use the owned pigtail. Print `pigtail_slot_coupon.gcode` and select
the smallest 5x3 / 6x4 / 7x5 opening that passes both insulated leads without damage. A threaded
panel-mount jack is not required for this revision.

The motor measurements now allow the vertical stack to be re-derived, but it must be repaired in
one coordinated motor/base/cam/linkage pass. Do not patch individual heights independently. M25
remains a later assembly check after ULN2003 cable dressing.

---

## 🔴🔴 NEW AND MORE SERIOUS: THE CAM RAMP MAY BE UNCLIMBABLE (R-07)

Source: `docs/BRAILLIX_MECHANICAL_FINDINGS_REPORT.docx` (Codex, web session, rev 4788e44).
Claude Code independently re-verified every number in that report from source on 2026-07-31.

**Codex's arithmetic is correct throughout** — hub interference, spring solid-height shortfall,
dot proud error, `max(dh/dtheta) = 64 mm/rad`, ramp slopes, 6mm engagement. All reproduce exactly.

**But F-01 through F-03 are NOT new.** They are the same vertical-stack defects already in the
v7.3 audit and already documented in-source at `outer_box.scad:base_plate_z`. Re-derived, not
discovered.

**R-07 IS new, and it is the real problem:**

```
track   radius   ramp run   pressure angle      foot roll radius = 0.5mm
  0      12.8     0.251mm       78.7 deg        RAMP RUN SHORTER THAN THE FOOT
  5      21.3     0.418mm       71.6 deg        RAMP RUN SHORTER THAN THE FOOT
```

- Standard limit for a translating cam follower is a **30 degree** pressure angle. Every track
  here is **71-79 degrees**. Side load is **5x** the lift force at the inner track.
- The ramp run (0.25-0.42mm) is **shorter than the foot's own 0.5mm roll radius on every track**.
  The follower cannot trace the profile; it meets a step, not a ramp.
- **It cannot be tuned away.** `ramp_fraction` is stuck at 0.20 because the 1.0mm-wide foot needs
  1.0mm of flat dwell to rest on, which at r=12.8 consumes 4.5 of the 5.625 degree slice. Even at
  `ramp_fraction = 1.0` (no dwell at all) the inner track is still 45 degrees.
- Reaching 30 degrees needs inner track r >= 24mm at 0.5mm lift -> disc OD ~68mm, or a
  two-cam split (8 states x 3 tracks each, 8x8 = 64) which gives **9-12 degrees** on ~34mm discs
  at the cost of a second motor per cell.

**Where Codex UNDERSTATES it:** its own research derives M7b = 2.0mm shaft boss, Ø9. A Ø9 boss
cannot enter the Ø5.2 cam bore, so the hub sits on the boss, not the motor face. Interference is
**4.0mm, not 2.0mm**, and spring room goes to **-1.0mm** — the top plate cannot be fitted at all.

### DECISION TAKEN 2026-07-31 — DO NOT REDESIGN YET

The resin plate (`print_resin_1_all`: cam + 12 linkages + dot insert + 3 nav caps) was **already
ordered** and arrives ~4 Aug. That plate **is** the coupon.

**First physical test when it lands, before anything else:** rest one linkage foot on a cam track,
turn the cam slowly BY HAND, watch a ramp transition.
- Climbs smoothly -> the 30-degree rule is overstated here; keep the architecture, fix only the
  vertical stack.
- Jams / skates sideways / needs force -> R-07 is real; choose bigger disc vs two-cam split.

30 degrees is a design guideline, not a law. Resin-on-resin friction has never been measured.
**Do not spend an architecture redesign on an unverified rule of thumb** — that is the same
mistake this project has made repeatedly.

**`pin_lift` 0.8 -> 0.5 is DELIBERATELY NOT APPLIED YET.** It is correct (the standard is
0.46-0.50mm and `docs/BRAILLE_READABILITY.md` already flags 0.8 as 1.6x too tall), but changing
it now would make the source disagree with the physical cam about to be tested. Apply it in the
same pass as the vertical stack.

**Of the ordered plate:** linkages and dot insert stay usable (`link_total_h` derives from the
reading surface, not the lift). The cam will be reprinted. The nav caps are the known pre-fix version.

---
## Current State: measurements resolved; coordinated CAD work remains

v7.5 through v7.7 repaired the geometry defects that did not require owned-part measurements. Every part
re-rendered as one connected solid in those verified passes. v7.9 updates the ESP32 socket pitch
from 25.4 to the measured 25.6mm; affected output artifacts have been regenerated and verified.

| Fixed | Was |
|---|---|
| Hall pocket rebuilt on the plate **underside** at (0, 17.35) | Lay entirely inside the cam pocket at the same depth — **it did not exist on the printed part** |
| Homing magnet pocket now blind, 0.8mm floor left | A through-hole cratering cam tracks **2, 3 AND 4** (the audit said two). Needs a **3×1mm** magnet, NOT 3×2 |
| Spring cavity **deleted** | Swallowed the right motor screw hole at x=+9.5 → one-eared motor, rocks and loses steps |
| `base_length` 56→58 | Left ear screw had a **0.35mm** wall on a 0.4mm nozzle |
| Motor holes → Ø3.3 thread-forming pilots | Ø4.3 clearance holes need a nut, and there is nowhere to put one under the spinning cam |
| `pod_length` 64→68 | ESP32 overran the cavity by 1.75mm. Pod is now a 68×68×58 cube matching a cell |
| `usb_z` formula | Ignored `hdr_channel_depth`; hole sat ~2mm above the port |
| Muscle-board bosses default **off** | Sat inside the ULN2003 footprint, propping it 4mm up in a 16mm pocket |
| `vertical_wire_guides()` **deleted** | A lone 2×1.5×27mm blade (18:1 slender). A wire needs capture on 2+ sides; this captured none |

---

## ⚠️ TWO HARD-WON LESSONS — do not relearn these

**1. `Volumes: 2` proves geometry is CONNECTED, not ATTACHED.**
The -X wire guide passed every automated check while dangling off a **0.1mm sliver over 3mm²**.
Three of this session's defects were found by *opening the STL and looking*, not by any check.
The volume count catches floating geometry; it cannot catch fragile, pointless, or
arithmetically inconsistent geometry.

**2. OrcaSlicer's CLI SILENTLY FALLS BACK TO PLA.**
Anycubic ships **no PETG profile for the Kobra Neo**. The machine profile pins
`default_filament_profile = "Anycubic Generic PLA"`, and Anycubic's own Generic PETG omits the
Kobra Neo from `compatible_printers`. Passing either to `--load-filaments` produces **no error**
— it emits G-code at **200°C nozzle / 45°C bed**, which will not stick and will delaminate.
Always grep the emitted header for `filament_type = PETG`. `slice.sh` does this and refuses to
report OK otherwise. **Never remove that check.**

---

## In Progress
The seven-file stack-independent PETG release is prepared for physical fit evidence. The complete
product remains NO-GO: the current cam socket cannot install on the measured shaft, the steep cam
ramps have not passed the real spring/linkage test, and the coordinated +4 mm stack repair is not
authorized yet.

## Next Steps
1. Print the fit coupons in `docs/PRINT_RELEASE_2026-08-19.md`, including the pigtail slot coupon.
2. Record selected motor socket, pigtail slot, M2.5/top-insert, hardware, Hall, magnet, and pogo sizes.
3. Run the real dot-5/dot-6 cam/linkage/spring test in `docs/MECHANISM_BENCH_TEST.md`.
4. Obtain AJ's explicit approval for the coordinated no-shaft-cut +4 mm production-stack repair.
5. Apply that repair in one base/cam/Hall/enclosure pass, regenerate, slice, and re-validate.
6. Change the exposed WiFi password and verify M25 after final ULN2003 cable dressing.

## Current print / slice pipeline

The historical six-production-part pipeline and 3-wall profile below are retired. Do not use their
G-code, time estimates, or profile names. Current authority is:

- `docs/PRINT_RELEASE_2026-08-19.md`
- `printing/gcode_kobra_neo_checked/` (exactly eight files)
- `printing/orca/braillix_0.16mm_petg_kobra_neo_release.json`
- `bash printing/orca/slice_kobra_neo_checked.sh`
- `python tools/validate_print_assets.py --fresh-dir <independent-render-directory>`

All current checked G-code is PETG 235/230 C, bed 80 C, 0.16 mm layers, 5 walls, 40% infill,
6 top/6 bottom shells, 8 mm brim, ironing, supports off, and no G2/G3 arcs. Full production parts
remain quarantined until their physical and stack gates pass.
## Do NOT regress these
- **`vertical_wire_guides()` is deleted on purpose.** A single blade cannot guide a wire. If pogo
  wiring ever needs managing, copy `cable_hook()` — an L with a 1.5mm overhang that actually
  traps a bundle. `floor_wire_gutters()` is DIFFERENT and is KEPT: a recess with two side walls
  and a base genuinely does retain a wire.
- **The homing magnet is 3×1mm, not 3×2mm.** 2mm removes the entire disc floor.
- **Feet are spread 60° apart.** `braille_cam.scad` pre-rotates each track by its own foot angle
  via `track_phase(t)`. Without that one line every foot reads a different letter.
- **All six arms share `arm_y = 3.5`.** The old per-arm stagger needed 6 height levels; only 3 fit.
- **`link_total_h` = 12.2, measured to the RECESSED reading surface (57.2), not `plate_top_z`
  (58.0).** The plate has a 0.8mm finger-pad recess.
- **Spring is coaxial with the dot**, 2mm OD, in a counterbore in the dot insert. NOT a mid-arm pad.
- **Braille dot is a printed 1.5mm dome.** No bearing balls.
- **Software dot→bit is a LOOKUP:** `DOT_TO_BIT = {1:3, 2:2, 3:1, 4:4, 5:5, 6:0}`. Not a formula.
- **In OpenSCAD, `use` imports modules ONLY; `include` imports modules AND variables.**
  Referencing a variable across a `use` boundary fails SILENTLY as `undef` and geometry vanishes.
- **`cube()` is NOT centred** — it grows in +X. That is exactly how the -X wire guide ended up
  floating. Mirror-symmetric features need an explicit per-side span.
- **Credentials live in `firmware/breadboard_test/secrets.h` (gitignored).** Never inline them.

## Key Files Modified (this session)
| File | What |
|---|---|
| `cad/scad/base_plate.scad` | hall pocket rebuilt underside; spring cavity deleted; pilots; 56→58 |
| `cad/scad/braille_cam.scad` | magnet pocket blind (1.2mm); z-stack failure documented |
| `cad/scad/mech_layout.scad` | **NEW** shared `homing_mag_*` block (was declared twice, had drifted) |
| `cad/scad/outer_box.scad` | wire guides deleted; muscle bosses off; false "2mm ledge error" note RETRACTED |
| `cad/scad/esp32_pod_params.scad` | pod 64→68; usb_z fix; `lid_screw_x` made a formula |
| `cad/scad/esp32_pod_lid.scad` | dims derived from pod; cradle assert |
| `cad/scad/mid_plate.scad` | comment only — collar ID tagged MEASURE (M1) |
| `printing/orca/*` | **NEW** — filament + process profiles, slice.sh |
| `printing/gcode/*` | **NEW** — six sliced parts |
| `docs/MEASUREMENTS_NEEDED.md/.pdf` | **NEW** — plain-English + technical, answer sheet |
| `docs/CAD_CHANGELOG_v7.5.md/.pdf` | **NEW** — side-by-side record of all changes |
| `docs/CAD_FIT_CHECK.md` | header table marking which findings are now fixed |
| `docs/ELECTRONICS_BOM.md` | magnet 3×2 → 3×1; motor screws no longer need nuts |
