# AI Agent Context Log
> This file is shared between Claude Code, Codex, and Antigravity.
> Each agent appends entries below when syncing. Read this to understand what other agents did.

---

## [2026-06-04 18:30] — Claude Code
**Task:** Pre-patent CAD forensic audit (all SCAD files) + start polish pass (v6.0)
**Changes:** Created `.ai-sync/artifacts/cad_audit_v6_2026-06-04.md` (single source of truth).
Updated breadboard firmware earlier (AccelStepper + WiFi web monitor + OTA; STEPS_PER_REV→4096;
cam Double-D bore + deeper hub re-rendered).
**Status:** completed (v6.0 polish implemented — all changed PETG STLs Simple: yes, print_batch rebuilt)
**Notes:** ⚠️ TWO FALSE ALARMS confirmed — do NOT re-fix: (1) magnet polarity is CORRECT
(+X S/N/S docks to −X N/S/N = attract; agents wrongly assumed +X meets +X); (2) linkage.scad
reference table is a stale COMMENT only, live geometry is correct. REAL fixes this pass:
delete scrapped `linkage_comb.scad` (stale inner_radius=8); add anti-reversal dock keying;
PETG bridges over side-wall holes; widen wire gutters; pod ⠿ tactile marker + nav-cap braille;
fix stale hall-gap comment (real gap 2.65mm); power-jack guard ring. LOCKED DECISIONS: braille
pitch stays **jumbo 4.8mm** (framed as large-format/learner); RESIN = cam/top_plate/nav_cap (do
NOT make FDM-tolerance edits to these); PETG = box/plates/pod/end-cap; patent doc deferred to end.
Architectural truth for patent: 28BYJ-48 (28mm) can't fit one-motor-per-char at 6.1mm pitch →
Braillix is a modular teaching/single-char display, not a compact reader.

---

## [2026-05-21 22:07] — System
**Task:** Initialized cross-agent sync
**Changes:** Created .ai-sync/ directory structure and bridge files
**Status:** completed
**Notes:** Project is now ready for multi-agent collaboration.

---

## [2026-05-21 22:10] — Claude Code
**Task:** Re-established project context after chat loss; initialized cross-agent sync
**Changes:** Created `.ai-sync/` directory, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` bridge files
**Status:** completed
**Notes:** Previous chat was lost after an update. Project memory (MEMORY.md) retained key context: Braillix is an affordable indexed-cam refreshable Braille display (28BYJ-48 steppers, 3D-printed resin cam discs, laser-cut metal linkages, ESP32 per cell, UART daisy-chain via pogo pins). CAD files are in `renders/` using OpenSCAD. Key fixes from May 2nd session: cam pocket diameter fix (35→37mm), top plate standoff alignment, rectangular linkage slots, Hall sensor pocket, magnet pocket, pogo connector slots, and a new parametric linkage file. There's also a `pcb/` directory that appeared since the last session — not yet explored.

---

## [2026-05-30 23:36] — Antigravity
**Task:** Hardware audit pre-print fixes for CAD files
**Changes:** Fixed standoffs to extreme corners (`26`, `21`) in `base_plate.scad`, `linkage_comb.scad`, `mid_plate.scad`, `outer_box.scad`, `top_plate.scad`. Corrected top plate dimensions to 60x60 and changed braille hole to rectangular slot. Implemented `vertical_pcb_rails()` for ESP32 in `esp32_pod_shell.scad`.
**Status:** completed
**Notes:** Next agent should explore `pcb/` directory or proceed with firmware development as CAD fixes for this audit are completed.

---

## [2026-05-31 00:00] — Claude Code
**Task:** Pre-print physical assembly audit of all CAD parts (Mridul wants to 3D-print now)
**Changes:** Created `.ai-sync/artifacts/assembly_audit_v4.1_2026-05-30.md` — full part-by-part
"in-hand" audit. Found 2 SHOWSTOPPERS (F1: top-plate dot slot is 1.4mm but linkage nub is 2.2mm
→ dots can't rise; F2: top plate 60mm in a 60mm cavity → won't seat), 3 CRITICAL (F3: cam D-bore
only 2mm vs ~10mm shaft; F4: base-plate→box fastening undefined/just rests on bosses; F5: ESP32
pod is internally contradictory across 3 files + is a 38mm stub vs 68mm cell), plus gaps F6–F10
(no wire rails/clips, no pogo carrier, no muscle-board mount, no pod switch holder, dead params).
**Status:** completed — REVIEW ROUND OPEN. No CAD changed yet (by design).
**Notes:** Confirmed w/ Mridul: ESP32 = 30-pin DOIT DevKit V1; pod must look like a matching brick;
buttons must use easy/no-extra-PCB mounting (recommend printed switch pockets). **Codex & Antigravity:
add your findings/votes in the artifact's "AGENT INPUT" section before we edit any SCAD.** Open forks:
ESP32 mount style (horizontal sockets vs vertical cartridge), base-plate fastening method, exact pogo
part dims, measured 28BYJ-48 shaft length.

---

## [2026-05-31 01:00] — Claude Code
**Task:** Implement all pre-print fixes from the 3-agent audit (F1–F14) + wire management + pod redesign
**Changes:**
- B1: `top_plate.scad` — plate 60→59mm, slots→2.5mm round holes (F1+F2)
- B2: `linkage.scad` — nub centred on dot origin (F12)
- B3: `braille_cam2.scad` — D-bore deepened to 4mm through disc floor (F3); `base_plate.scad` shaft clearance 7→10mm
- B4: `outer_box.scad` — boss_height 38→37 (F13); boss tap 2.6→2.1 (M2.5 pilot); `base_plate.scad` standoff tap→2.9mm clearance thru-bore (F4)
- C1: `esp32_pod_*.scad` — complete rewrite: 64×68×58 matching brick, horizontal DevKit V1 on female header sockets, lid screw bosses added (F5+F14), dead params removed (F10)
- C2: Pod switch pockets added in shell front wall (F8)
- C3: `outer_box.scad` — pogo carrier pockets, floor wire gutters, C-clip cable saddles, vertical wire guides, muscle-board M2 bosses (F6+F7); `mid_plate.scad` — ±X and +Y wire pass-through notches
- C5: `linkage_comb.scad` — body enlarged from 38×38 to 56×46 to reach standoffs at (±26,±21) (F11)
- All 11 STLs re-rendered and verified: **all Simple: yes** (manifold).
- Outer box boss diameter reduced 8→7.8mm to avoid coplanar face at cavity boundary (26+4=30=wall).
**Status:** completed
**Notes:** All showstoppers (F1–F4) and structural issues (F5–F14) are resolved in CAD. Pod is now a
matching 64×68×58 brick. DevKit V1 mounts horizontally on female sockets. Wire hooks, gutters,
muscle-board bosses, switch pockets, and pogo carrier pockets added. Ready for print.

---

## [2026-06-03 12:00] — Claude Code
**Task:** Breadboard bring-up plan (solderless) + cam resize (v5.1) + print/shopping docs
**Changes:**
- v5.1: cam `inner_radius` 8→12 (foot-span 2.3→1.6 states, fixes linkage binding);
  renamed braille_cam2→braille_cam, deleted old deprecated v1, removed comb from print pipeline
- Added `docs/WIRING_AND_ASSEMBLY.md`, `docs/PRINT_CHECKLIST.md`, `docs/SHOPPING_LIST.md` (+PDF)
- Added `print_batch/` (3 batch folders + README) for college workshop USB
- Built `renders/braillix_assembly_v5.blend`
- **NEW: `docs/BREADBOARD_TEST.md`** — solderless ESP32+ULN2003+28BYJ-48+hall test plan
**Status:** breadboard test = AWAITING CROSS-AGENT COMPONENT ID
**Notes:** Mridul bought electronics (₹935 bill). Wants to test one cell on breadboard, no solder.
**>>> CODEX + ANTIGRAVITY: see the "BREADBOARD BRING-UP REVIEW" section in
`.ai-sync/artifacts/assembly_audit_v4.1_2026-05-30.md`.** You must ask Mridul for close-up photos
(hall module, resistors, ESP32 pins, jack polarity), ID the parts, and audit the wiring for faults
— especially the ESP32-is-not-5V-tolerant hall protection — BEFORE he powers on. Hall module type
(3.3V analog vs 5V digital) is the critical unknown that decides whether a voltage divider is needed.

---

## [2026-05-31 00:18] — Codex
**Task:** Peer-review Claude's pre-print CAD assembly audit and add Codex findings/votes
**Changes:** Read all live `cad/scad/*.scad`, archived SCAD tests, `cad/stl/masterplan.scad`,
`Mechanical Design Audit Report.md`, `CHANGES.md`, and PCB notes. Updated
`.ai-sync/artifacts/assembly_audit_v4.1_2026-05-30.md` with Codex's AGENT INPUT.
**Status:** completed
**Notes:** Codex agrees the current CAD should not be printed yet. Confirmed F1/F2/F4/F5/F6/F7/F8
and added F11-F14: linkage comb holes/grub screw are outside the body, linkage nub is edge-origin
not centered at the dot, outer-box boss height conflicts with the stated z-stack, and pod lid screw
holes have no matching shell bosses. Votes: horizontal ESP32 DevKit on female sockets in a matching
brick pod; separate base↔box screw pattern; parametric pogo carrier only after real part dimensions;
measure the actual 28BYJ-48 shaft and model the exact D profile.

---

## [2026-06-03 14:55] — Codex
**Task:** Breadboard bring-up photo review and safety verdict
**Changes:** Reviewed photos of ESP32 DevKit, MH-Sensor-Series hall module, resistors, and barrel
adapter/jack. Updated `.ai-sync/artifacts/assembly_audit_v4.1_2026-05-30.md` under
`Codex — breadboard findings`.
**Status:** completed
**Notes:** Hall board identified as KY-024-style analog+digital MH-Sensor-Series module with
`AO/DO/GND/VCC`. Codex recommends powering hall from ESP32 `3V3`, using `AO -> GPIO34` first, and
leaving `DO` disconnected initially. Resistor values are not readable enough to certify; not needed
if hall is powered at 3.3V. Barrel jack polarity is still not proven by photo; verify with markings
or multimeter before applying adapter power. Motor wiring/GPIO choices are otherwise acceptable,
with possible CheapStepper middle-pin swap if motor only buzzes.

---

## [2026-06-03 15:00] — Antigravity
**Task:** Breadboard bring-up photo review and safety verdict
**Changes:** Reviewed hardware photos. Added Antigravity's independent findings to `.ai-sync/artifacts/assembly_audit_v4.1_2026-05-30.md`. Confirmed 3.3V power routing for Hall sensor and flagged the ambiguous barrel jack polarity.
**Status:** completed
**Notes:** The breadboard test is safe to proceed ONLY IF the Hall sensor is powered from the ESP32's 3V3 pin and the yellow barrel jack's polarity is verified with a multimeter first. No resistor divider is needed.

---

## [2026-06-03 17:28] — Codex
**Task:** Live ESP32 + ULN2003 + 28BYJ-48 + Hall breadboard bring-up troubleshooting
**Changes:** No repo code files changed during the live test. Guided Arduino IDE setup and replaced the
`CheapStepper` sketch with a no-library half-step sketch because the installed CheapStepper library
failed to compile on ESP32. Helped debug wiring and test behavior.
**Status:** in-progress
**Notes:** Difficulties/fixes so far:
- Breadboard was too small for the ESP32 DevKit. Fix: do not fully mount ESP32 on breadboard; use
  female-to-male Dupont jumpers directly from ESP32 pins and use breadboard mainly for power rails.
- Arduino board selection confusion. Fix: select `esp32 by Espressif Systems` package and board
  `ESP32 Dev Module`.
- CheapStepper compile error. Fix: use a no-library stepper sketch with manual half-step sequence.
- Hall sensor initially read constant `4095` because hall/ESP32 ground was not connected to common
  ground. Fix: connect Hall GND, ESP32 GND, and adapter/ULN2003 GND together.
- Hall now responds to magnet poles: one pole drives near zero, the other/max/no-magnet behavior
  still needs calibration/interpretation. **Fixing/calibrating hall sensor is still left.**
- Motor initially vibrated only. Tried pin-order/delay changes, but later found IN4 was accidentally
  wired to ESP32 `RX0` instead of GPIO22. Fix: move IN4 to GPIO22.
- After correct wiring (`IN1->18`, `IN2->19`, `IN3->21`, `IN4->22`) the motor rotates properly.
  `STEP_DELAY_MS=3` feels better than 6ms; tradeoff is lower torque / higher skipped-step risk.
  For final use, normal moves can be fast while homing should be slower.

---

## [2026-06-13 12:00] — Claude Code
**Task:** CAD hardening v6.1/v6.2 from physical PETG fit-tests + software-team handoff
**Changes:** Two CAD rounds driven by holding printed PETG parts (Anycubic Kobra Neo, 0.4mm):
- v6.1: magnet pockets resized for REAL 8x1mm magnets (teardrop tops, 2/face at y=+-14);
  all fine braille removed from PETG parts -> bold ridges/grooves; bridges 0.6mm; pilots
  enlarged; pogo_end_cap floating-geometry bug fixed; base_plate ribs deleted (caused
  bridged-waffle underside + 3mm stack error); linkages -> RESIN (Batch4_Resin, x8);
  new docs/SOURCING.md; WIRING_AND_ASSEMBLY.md updated (ULN2003 solder-flat, comb removed).
- v6.2: top_plate + pod_lid -> OVER-CAPS (cover walls, skirt on +-Y only so +-X dock faces
  stay flush); box walls shortened 58->54 (total stays 58); corner bosses reinforced with
  base gussets (+ slicer note: Wall Loops=5); bare-jack cradle added (PLACEHOLDER dims);
  pod switch retention rebuilt as cages (old nibs floated); floating lid bosses fixed;
  barrel jack relocated (was overflowing lid edge as an open notch). Built via
  builder+supervisor agent loop (supervisor visually verified PNG renders).
- Created docs/SOFTWARE_TEAM_README.md (+ .pdf): architecture, text->braille->cam-position
  pipeline (reuses firmware/braille_converter.py), I2C chain auto-detect (count muscle cells
  per pod, total pods, same layout to every pod), pinout, command protocol.
**Status:** completed (CAD verified Simple: yes); NOT committed to git; motor + jack redesign
DEFERRED pending Mridul's caliper measurements.
**Notes:** All work uncommitted since v6.0 (67258a8). Blockers = motor measurements (body dia,
can height, shaft offset, shaft dia, flat width, shaft height, mount spacing+dia) and bare-jack
body WxLxH + barrel dia. print_batch/zip NOT rebuilt for v6.2 (waiting on jack cradle dims).

## [2026-07-26 20:30] — Claude Code
**Task:** v7.0 "spread feet" — make the braille mechanism actually buildable
**Changes:** Investigation of Mridul's question about linkage orientation exposed that the
v6.x mechanism could not be assembled at all: (a) all six feet sat on one radial line so 14
arm pairs overlapped and needed 6 stacked heights, but only 3 fit in the 6.5mm band; three
arms sat inside the top plate; (b) linkage was 1mm too short (top plate had been thickened
3->4mm long ago and linkage.scad never updated) so the dot topped out 0.2mm BELOW the reading
surface; (c) return springs were impossible at the dot axis (2.6mm row pitch, 2.2mm nub =
0.4mm free) and the existing 4.5mm "pockets" in top_plate merged into one slot.
Fix = spread the six feet 60deg apart, assigning each dot the foot pointing the way that dot
already sits. Arms then fan out and never cross (closest 2.60mm vs 1.0mm needed) -> ALL SIX
AT ONE ARM HEIGHT. New cad/scad/mech_layout.scad is now the single source of truth for
track radii / dot positions / dot->track+angle assignment / vertical stack / spring seats,
included by braille_cam, linkage and top_plate. braille_cam gained a per-track phase (one
line) so each track's pattern is carved pre-rotated to its own foot angle. linkage.scad
rev 4.0: one common arm_y, total_h 12->13, proper rolled foot (was a teardrop wedge),
PRINTED DOME braille dot (no bearing ball / glue / cup), spring pad on the arm, fillets
everywhere, count-dots on the pad rim. top_plate spring pockets moved onto the arm pads.
SOFTWARE_TEAM_README dot->bit is now a DOT_TO_BIT lookup.
**Status:** completed — all parts Simple: yes with correct volume counts; 8/8 numeric audit
checks pass; virtual assembly rendered and visually confirmed.
**Notes:** Two bugs were caught by verification rather than by reading: OpenSCAD applies
offset() INSIDE-OUT, so the fillet pair written the natural-reading way eroded 0.6mm first
and deleted every 1.0mm member; and the count-dots initially sat flush on the arm surface
(zero overlap = separate floating bodies). Still NOT built/tested physically — Mridul has no
springs yet. Cheap PETG proving print recommended before spending on resin.

## [2026-07-26 23:59] — Claude Code
**Task:** v7.1 — move the return spring onto the dot axis (Mridul's correction of v7.0)
**Changes:** Mridul rejected v7.0's mid-arm spring pad: physically the return force belongs
around the braille dot, with the dot travelling up/down through the middle of the spring and
a flange on the linkage for the spring to push against. That layout is right, but it only
fits if the spring shrinks: braille rows are 2.6mm apart, so a coaxial spring must be under
~2.4mm OD. With the old 2.2mm nub that was impossible at any wire gauge (ID 2.6 -> OD 3.1,
collides by 0.5mm). Resolution: 2mm OD micro compression spring (stock catalogue size, 0.3mm
stainless), nub slimmed 2.2 -> 1.0mm, dome 2.2 -> 1.5mm (which is the REAL braille standard,
1.44-1.6mm, so the dot got better not worse). BALLPOINT-PEN SPRINGS ARE PERMANENTLY OUT —
4mm OD needs 4.2mm pitch.
linkage.scad rev 4.1: mid-arm pad deleted, 2.2mm spring flange added on the upper riser,
count-dots back on the arm. top_plate.scad: spring counterbores coaxial with each dot hole
(2.2 x 2.5mm deep), dot hole 2.5 -> 1.7mm; documented that only 0.4mm of plate remains
between the three bores in a column, which is the unavoidable price of a spring on the dot
axis at braille pitch. mech_layout.scad now owns the spring/nub/dome/flange dimensions.
SOURCING.md: 2mm micro springs (assortment kit recommended), soft open-cell sponge as the
no-sourcing backup (NOT EVA craft foam, ~20x too stiff), bearing balls marked NO LONGER
NEEDED since the dot is printed.
Three new print plates for price comparison: print_resin_1_all (cam+linkages+plate+buttons),
print_resin_2_no_buttons, print_resin_3_cam_linkages.
**Status:** geometry complete and verified — 15/15 numeric checks pass; flange (2.20mm) and
dome (1.50mm) diameters and total height (13.00mm) confirmed by measuring the rendered STL
directly rather than trusting the source.
**Notes:** Assembly detail worth keeping: the 1.5mm dome is 0.1mm wider than the 1.4mm spring
bore, so the spring is threaded on by twisting — Mridul's own "turn and turn" idea, which
turned out to be exactly the right trick here. Still nothing physically built; no springs in
hand. Cheap PETG proving print before any resin spend.

## [2026-07-29 14:30] — Claude Code
**Task:** v7.2 — pull the top plate out of the resin batch; fix the dot-flush bug
**Changes:** Mridul asked whether the top plate could be FDM. Mostly yes: it is 68x70mm of
plain flat structure, but the six 1.7mm dot holes (the dome must SLIDE through them) and the
six 2.2mm spring bores (0.4mm dividing walls = one nozzle width) cannot be FDM. Split them
out into dot_insert.scad — a 15x15x3.2mm resin tile, top-hat form, that glues into a pocket
in the now-PETG plate. The rebate floor is the glue shelf (2mm wide all round, ~106mm2).
Resin dropped 19.85 -> 4.48 cm3, about 4.5x.
While measuring for the pocket, found a REAL BUG: the plate has a 0.8mm finger-pad recess
over its middle, so the surface the dots emerge through is at 57.2, not the 58.0 that
link_total_h was measured to. Every dot stood 0.8mm proud when DOWN and 1.6mm when UP — all
six permanently readable, i.e. not braille. link_total_h 13.0 -> 12.2; now flush at rest.
Also per Mridul: linkages 8 -> 12 (two full sets; the cam is 94% of the plate so a second set
costs ~2%), and the count-dots moved to the arm UNDERSIDE and shrunk to 0.6mm dia x 0.35mm
proud. Kept rather than deleted because arms differ by as little as 0.67mm and a mis-fitted
linkage puts its foot on the wrong cam track. Removed superseded v7.0 print files.
Earlier in the same session: scrubbed the committed WiFi password + SSID from all git history
with git-filter-repo and force-pushed; credentials now live in a gitignored secrets.h with
secrets.example.h as the template.
**Status:** completed — all parts Simple: yes, plate volume counts 14/15/18 correct, 12/12
fit and clearance checks pass, insert/plate mating surfaces measured off the rendered STLs
(0.0 / 2.0 / 3.2mm) rather than trusted from source.
**Notes:** Mridul MUST still change the actual WiFi password — history scrubbing does not
undo the exposure. Still nothing physically built; no springs in hand.

## [2026-07-29 15:05] — Claude Code
**Task:** Close out v7.2 — push, security cleanup, remote control, comment hygiene
**Changes:** Committed and pushed v7.2 (282fd06) after running the pre-push security gate
(no secrets in the pushed diff, none in local history, secrets.h still ignored, nothing
sensitive newly tracked). Fixed stale comments in the three print_resin_* files left over
from the 8->12 linkage change ("2 columns x 4 rows" -> 3, "+2 spares" -> two full sets,
"~4% more" -> ~2%) — this project has been bitten repeatedly by stale comments drifting
from live values, so they get corrected on sight. Enabled Remote Control for all sessions
(`/config remoteControl=true`) so the local session can be driven from phone/browser.
**Status:** completed — working tree clean, origin/main == local.
**Notes:** Remote Control runs the session ON THIS MACHINE (phone is just a window); it is
NOT the same as Claude Code on the web, which runs in the cloud against the GitHub repo and
therefore cannot reach OpenSCAD or render STLs.

---

## [2026-07-30 00:30] — Codex
**Task:** Geometry review of the ESP32 pod navigation-button caps and their mounting.
**Changes:** No production CAD changed. Verified `nav_cap.scad`, `esp32_pod_params.scad`, and `esp32_pod_shell.scad` directly.
**Status:** review completed; CAD correction required before physical assembly.
**Notes:** The tapered cap is deliberate and has adequate lateral clearance (20 mm pitch, 8 mm flange). But the 4.5 mm shaft includes the 1.5 mm flange, leaving only 3.0 mm past it against a 4.0 mm wall; it cannot enter the pod, let alone reach a switch. The cage also does not locate the switch forward, leaving an approximately 1.7 mm variable dead gap. Retention is intended to be flange + tactile-switch return force, but without contact the caps are loose/removable. Do not print/use these buttons unchanged; measure the actual switch's plunger position and revise cap reach plus a forward switch datum together.

---

## [2026-07-30 00:49] — Codex
**Task:** Repair the nav-button caps, document required outer-box work, and regenerate the all-parts resin STL.
**Changes:** `nav_cap.scad` now places its Ø3.8 mm stem behind the flange (4.5 mm reach), rather than burying it inside the dome. `print_resin_1_all.scad` and the legacy `print_small_parts.scad` lift caps by the stem length so the stems sit on the build plane. Regenerated `cad/stl/nav_cap.stl` and `cad/stl/print_resin_1_all.stl`. Added a measurement-gated outer-box change checklist to `docs/CAD_FIT_CHECK.md` and regenerated its PDF.
**Status:** completed and verified.
**Notes:** The combined STL has 17 disconnected, closed-manifold shells; the three corrected caps occupy x=10..18 / 22..30 / 34..42, y=-36..-28, z=0..10.7, clear of every other plate component. The actual tactile switch should still be bench-tested before ordering resin, but the prior geometry defect is fixed. Do not change the outer box from catalogue measurements: the handout lists the motor/Hall/ULN-dependent changes and their prerequisites.

## [2026-07-30 01:30] — Claude Code
**Task:** Verify Codex's nav-button repair
**Changes:** Codex's `nav_cap.scad` fix is CORRECT and verified: the Ø3.8 stem now starts at
z=-nav_shaft_len so it projects 4.5mm BEHIND the flange (was 3.0mm), reaching 0.5mm past the
4mm pod wall with 0.20mm/side clearance in the Ø4.2 hole. That closes the v7.3 audit defect.
HOWEVER Codex's edit to `print_resin_1_all.scad` was broken: it lifted the caps by
`nav_shaft_len`, but that file uses `use <nav_cap.scad>` and **OpenSCAD's `use` imports modules
only, never variables**. `nav_shaft_len` was undef, the translate became [14,-32,undef], and all
three caps silently vanished — render dropped from 18 volumes to 15. Codex had correctly added
`include <esp32_pod_params.scad>` to `print_small_parts.scad` but missed the same fix here.
Added the include; plate is back to **18 volumes, z 0.00..10.70**, footprint 111.8 x 71.7mm.
Also gitignored Codex's `.tmp_nav_review/` scratch dir, and corrected handoff.md, which claimed
"the core v7.2 mechanism is complete" while four other v7.3 blocking defects remain open.
**Status:** completed — Codex's CAD fix verified good; its print-file regression found and fixed.
**Notes:** LESSON for all agents: in OpenSCAD, `use` gives you modules, `include` gives you
modules AND variables. Referencing a variable across a `use` boundary fails SILENTLY as undef
and geometry disappears without an error. Always check the `Volumes:` count after a layout edit.

## [2026-07-31 00:30] — Claude Code
**Task:** Repair every CAD defect that did not need calipers; build a local OrcaSlicer pipeline; write a plain-English measurement sheet.
**Changes:** v7.5 fixed 8 audit defects — hall pocket rebuilt on the base-plate underside (the old one lay entirely inside the cam pocket at the same depth and removed nothing), homing-magnet pocket made blind (it was a through-hole cratering cam tracks 2/3/4, needs a 3x1mm magnet not 3x2), spring cavity deleted (it swallowed the right motor screw hole, leaving a one-eared motor), base_length 56->58 (left ear had a 0.35mm wall), motor holes changed to thread-forming pilots (no room for a nut under the cam), pod_length 64->68 (board overran the cavity by 1.75mm), usb_z arithmetic fixed (it ignored hdr_channel_depth), jack cradle repositioned, muscle-board bosses defaulted off (they sat inside the ULN2003 footprint). v7.6 deleted `vertical_wire_guides()` — a lone 2x1.5x27mm blade that could not retain a wire and was 18:1 slender. Added `printing/orca/` (flattened numakers PETG-HS + Braillix process profiles + slice.sh); all six PETG parts sliced to `printing/gcode/`.
**Status:** completed for everything unblocked; 4 defects remain blocked on measurement.
**Notes:** TWO LESSONS. (1) `Volumes: 2` proves geometry is CONNECTED, not ATTACHED — the -X wire guide passed the check while hanging off a 0.1mm sliver over 3mm². Three defects this session were found by eyeballing the render, not by any automated check. (2) OrcaSlicer's CLI SILENTLY FALLS BACK TO PLA. Anycubic ships no PETG profile for the Kobra Neo; the machine pins `default_filament_profile = Anycubic Generic PLA`, and Anycubic's own Generic PETG omits the Kobra Neo from `compatible_printers`. Handing either to `--load-filaments` emits G-code at 200C/45C with no error. Always grep the emitted header for `filament_type = PETG`; slice.sh does this and refuses to report OK otherwise.

---
## [2026-07-31 13:45] — Codex
**Task:** Preserve ESP32 USB-C programming/recovery access without requiring a post-assembly enclosure teardown.
**Changes:** Fixed the pod service opening at 14×9mm (13×9 previously), preserving the 9mm cable-overmould height clearance. Updated the CAD source and fit/measurement guidance, regenerated esp32_pod_shell.stl, PETG G-code, and MEASUREMENTS_NEEDED.pdf.
**Status:** completed and verified.
**Notes:** OpenSCAD reported simple geometry and the expected Volumes: 2; an independent STL comparison found exactly 36.0mm³ removed, matching 1mm × 9mm × 4mm of added opening. Orca initially emitted a 60°C bed while reporting the unused 80°C hot-plate field; the custom profile now sets Orca CLI's selected plate to 80°C, and `slice.sh` validates the actual emitted bed temperature and exits nonzero on failure. Final slice verified PETG at 235/80°C first layer and 230°C thereafter (52.23cm³, 4h04m51s). This does not resolve the measurement-gated motor vertical stack, Hall pocket depth, jack geometry/polarity, or ESP32 header pitch.

---

---
## [2026-07-31 13:31] — Codex
**Task:** Fill the M1-M28 component measurements from online sources before requesting more physical readings.
**Changes:** Added `docs/MEASUREMENT_RESEARCH.md` with measured/derived/spec/likely/verify evidence labels and source links; prefilled `docs/MEASUREMENTS_NEEDED.md`; corrected M-number comments in `esp32_pod_params.scad`; updated fit-check and handoff guidance. No production geometry changed.
**Status:** online research pass completed; four owned-part checks remain.
**Notes:** `2601213328` is a motor traceability/lot code, not a different model. A 30-pin ESP32 does not settle M21 because 22.86/25.4/27.94 mm row spacings are sold. The owned yellow/black screw-terminal adapter is inline rather than panel-mount, so it should remain a breadboard part; final CAD should use a specified nut-mounted 5.5 x 2.1 mm jack. Remaining immediate inputs are M5, M11b plus Hall marking, M21, and the final jack identity. M25 is deferred until cable dressing.

## [2026-07-31 15:10] — Claude Code
**Task:** Verify Codex's web-generated mechanical findings report and decide what to change.
**Changes:** Committed `docs/BRAILLIX_MECHANICAL_FINDINGS_REPORT.docx`. Recorded the R-07 pressure-angle finding and the resulting decision in `handoff.md`. No CAD changed.
**Status:** verification complete; action deliberately deferred to a physical test.
**Notes:** Re-derived every figure in the report from source. Codex's arithmetic is correct throughout — hub interference, spring shortfall, 64 mm/rad lift derivative, 71-79 degree ramp slopes, 6mm engagement all reproduce exactly. Two corrections: (1) F-01/02/03 are NOT new, they are the v7.3 vertical-stack defects already documented in-source; (2) Codex UNDERSTATES F-01 — its own derived M7b=2.0mm Ø9 shaft boss cannot enter the Ø5.2 cam bore, so interference is 4.0mm not 2.0mm and spring room is -1.0mm, meaning the top plate cannot be fitted at all. R-07 is the genuinely new and more serious finding and Claude Code had never analysed the cam ramp at any point in this project — pressure angle is 71-79 degrees against a 30 degree standard, and the ramp run is shorter than the follower's own roll radius on every track. It cannot be tuned: ramp_fraction is pinned at 0.20 by the 1.0mm foot needing 1.0mm of dwell. DECISION: do not redesign. The already-ordered resin plate contains a cam and 12 linkages and IS the coupon; hand-turn a foot across a ramp when it arrives and let the physical part settle whether a 30 degree rule of thumb applies to this friction pair. pin_lift 0.8->0.5 is correct but deliberately held so the source keeps matching the cam being tested.

---
## [2026-07-31 16:25] — Codex
**Task:** Record the remaining owned measurements and identify the photographed power connector.
**Changes:** Recorded M5=3.0mm, M11b=1.6mm, and M21=25.6mm. Updated `hdr_row_pitch` from 25.4 to 25.6mm, clarified the cam's 3.2mm across-flats clearance, and marked the Hall recess as an exact-fit dry-fit risk. Photo-identified the owned power part as an inline female DC pigtail with red/black wires; updated sourcing, BOM, breadboard, assembly, fit-check, measurement, and handoff guidance. Regenerated the pod shell STL/G-code and all affected PDFs.
**Status:** completed and verified; final panel-mount jack selection and the coordinated motor/base/cam/linkage vertical-stack redesign remain.
**Notes:** The inline pigtail is suitable for breadboard testing but has no thread/nut and cannot mount securely in the pod wall. Final pod recommendation remains a selected 5.5×2.1mm female panel-mount jack with a retaining nut, rated at least 5V/3A. Verify the pigtail's centre-pin wire with a multimeter; do not trust red/black colour alone. OpenSCAD export succeeded, the regenerated STL is closed-manifold with zero non-manifold edges, and Orca emitted PETG at 230/80C (52.23cm3, 4h04m53s).

## [2026-07-31 21:10] — Claude Code
**Task:** Fix braille dot rendering in the 3D simulator; leave a coordination message for Atishay's Codex.
**Changes:** `sim/3d/app.js` — linkage material metalness 0.92 -> 0.25 (near-white semi-gloss), added a PMREM environment, raised linkages now tint green, and `updateMechanism()` unified so tick() and the debug snapshot share one code path. `.ai-sync/handoff.md` — message to Atishay's Codex at the top.
**Status:** completed and verified in the live scene.
**Notes:** Mridul asked whether the dots looked wrong because of a DESIGN error. They were not — verified in the running scene that the dome top sits at 57.198 against a reading surface of 57.200 (flush when down) and 58.00 when up, exactly 0.8mm proud. It was a rendering fault: the linkages had been given metalness 0.92 per the original "shiny metallic" brief, but the dome at the top of each linkage IS the braille dot, and it is printed resin. At near-1.0 metalness with no environment map it reflected pure black plus the red cam and blue fill light, so every dot rendered as a dark chrome bead with red/blue crescents. Physically honest materials fixed it. Raised dots are now tinted rather than exaggerated in travel — 0.8mm on a 1.5mm dome is nearly invisible on a projector, but faking the travel would misrepresent the mechanism.

---

## [2026-07-31 21:45] — Claude Code
**Task:** Fix braille dot / hole misalignment spotted by Mridul; restore the chrome finish.
**Changes:** `cad/scad/export_linkage_assembly.scad` — centre the linkage on its own thickness before rotating. `mech_layout.scad` — new shared `link_thickness`. `linkage.scad` — `thickness` now reads it. `sim/3d/app.js` — chrome restored (metalness 0.92) with the env map kept. Re-exported all six linkage_asm STLs and the GLB.
**Status:** completed and verified.
**Notes:** Mridul was right and it was a real misalignment — all six dots sat exactly 0.500mm off their holes, measured from the STLs. NOT a design error: production linkage.scad is correct and its rebuilt geometry is vertex-identical. The bug was in the simulator's assembly transform. linkage_3d_v4() extrudes from local z=0 to z=thickness and builds the dome at z=thickness/2, so the DOT AXIS in the part's own frame is z=thickness/2, not z=0. Placing local z=0 on dot_pos pushed every linkage half a thickness sideways once rotate([90,0,0]) mapped local +Z to world -Y. Offset now 0.0000mm on all six. Also worth recording: the earlier "chrome bead" appearance was never the material's fault on its own — metalness 0.92 with no environment map has nothing to reflect. With makeEnvironment() in place the requested chrome finish looks correct, so the material was reverted to 0.92 as originally specified.

---

## [2026-08-01 —] — Claude Code (ELECTRONICS fork)
**Task:** Establish the electronics workstream separately from CAD; answer whether a custom PCB/ICs are needed.
**Changes:** New `docs/ELECTRONICS_PLAN.md` (+PDF) as the electronics source of truth. `.ai-sync/handoff.md` now opens with an ELECTRONICS TRACK section. No CAD touched.
**Status:** completed.
**Notes:** CUSTOM PCB CANCELLED. The ATmega328P muscle board is TQFP-32 at 0.8mm pitch, not hand-solderable, and contradicts the build-it-ourselves aim; it also solves a multi-cell problem that does not exist with one cell. Multi-cell path is an MCP23017 I2C expander module (DIP, hand-solderable, 3 cells each, 8 per bus) — explicitly NOT PCF8574, whose quasi-bidirectional outputs have a weak high side and cannot reliably source the few mA a ULN2003 input needs; that would half-work, the worst failure mode. FOUND A REAL DEFECT: GPIO21/22 are assigned to BOTH ULN2003 IN3/IN4 and I2C SDA/SCL across the wiring docs and the firmware. Harmless on one cell, breaks the moment a second is added; fix is IN3->23, IN4->5, deliberately deferred until after the demo. Seven docs still reference the cancelled PCB and are marked stale. Electronics blocks nothing — every part for one cell is owned and the real gap is that the breadboard circuit has never been built.

---

## [2026-08-02 00:49] — Codex
**Task:** Audit all six existing PETG G-code files for the stock Anycubic Kobra Neo and Numakers PETG-HS, then generate safe replacements without overwriting the legacy files.
**Changes:** Added `printing/orca/braillix_0.20mm_petg_kobra_neo_safe.json` (arc fitting off) and `printing/orca/slice_kobra_neo_checked.sh`. Re-sliced all six current STLs into `printing/gcode_kobra_neo_checked/`.
**Status:** completed.
**Notes:** The old `printing/gcode/*.gcode` set has 45,075 G2/G3 arc commands. The official stock Kobra Neo Marlin source has ARC_SUPPORT disabled, so those arcs are not printable reliably despite rendering normally in Orca. The checked replacements contain zero G2/G3 commands; PETG, 235/230C nozzle, 80C bed, supports off, and all commanded moves were validated inside the 220x220x250mm build volume. Numakers recommends 240C plus/minus 10C, 80-90C bed and 20-50% cooling; the selected 235/230C and 80C are in range, but a small calibration print is still prudent before long enclosure prints.

---

## [2026-08-01] — Claude Code (ELECTRONICS fork)
**Task:** Two-cell electronics design, full beginner soldering guide, soldering-iron buying guide; correct two false facts across the docs.
**Changes:** `docs/ELECTRONICS_PLAN.md` gained Part 9 (buying a soldering iron), Part 10 (the two-cell product + pin map), Part 11 (soldering from zero). Corrected `ELECTRONICS_BOM.md`, `MASTER_BOM.md`, `DEMO_VS_PRODUCT.md`. PDFs regenerated. `.ai-sync/handoff.md` electronics section updated. No CAD touched.
**Status:** completed.
**Notes:** TWO FALSE FACTS CORRECTED. (1) Multiple docs claimed a soldering iron was owned — it is NOT. That claim originated in MASTER_BOM ("You stated basic experience and an iron") and was propagated. (2) Polarity was listed as unverified/MANDATORY-to-check across five docs; Mridul has since bought a multimeter and MEASURED IT CORRECT (red = positive). Both corrected everywhere and the subtotals rebalanced. KEY DESIGN FINDING: two cells need NO I2C expander. Counted the ESP32's genuinely safe output pins (excluding strapping pins 0/2/5/12/15 and UART 1/3) = 15 available vs 11 needed for two cells plus nav. Direct-drive both. The pin map deliberately keeps cell 1 untouched when cell 2 is added, and leaves 21/22 free for I2C at 4+ cells. An expander only earns its place at ~4 cells, which supersedes the earlier MCP23017 recommendation for the 2-cell case (Part 5 now points forward to Part 10). Soldering guide leads with the one idea beginners get wrong — heat the joint, let the joint melt the solder — because cold joints from dabbing solder off the tip are the classic failure and are usually misattributed to bad technique rather than an uncontrolled iron.

---

## [2026-08-02] — Claude Code (ELECTRONICS fork)
**Task:** Make the architecture credibly support many cells (only 2 will be built), and answer how to make soldered joints permanent.
**Changes:** `docs/ELECTRONICS_PLAN.md` — Part 5 rewritten as "Scaling to N cells"; new Part 12 on joint durability (CAD flags renumbered to Part 13); Part 0, Part 2 and Part 3 updated. `docs/ELECTRONICS_BOM.md` — new section 2D (per-additional-cell cost), hot glue + neutral-cure RTV added to optional, totals rebalanced. PDFs regenerated. `.ai-sync/handoff.md` updated. No CAD touched, no firmware touched.
**Status:** completed.
**Notes:** REVISED THE MULTI-CELL ARCHITECTURE: one MCP23017 PER BRICK, not three cells sharing one. Per-brick wastes 11 of 16 I/O and costs ~Rs53 more per cell, but it is what makes a brick self-contained and identical — adding a cell becomes "plug in, set 3 address jumpers" instead of rewiring neighbours. The real scaling argument is that the inter-brick cable is a FIXED 4 wires (5V/GND/SDA/SCL) regardless of cell count; 5 wires per cell is the dead end. Ceiling stated honestly: 1-2 direct GPIO, 3-8 one bus, 9-16 the ESP32's second I2C controller, 17-64 a TCA9548A mux, zero custom parts at every tier. FIRST LIMIT IS POWER, NOT ADDRESSING: ~11 simultaneous motors on the 3A supply, which sequential refresh removes entirely — this is why de-energising idle coils is architectural. Three rules locked in now because they are expensive to retrofit: pull-ups at the brain end ONLY (8 bricks x 4.7k parallel = 590 ohm, kills the bus), halls must move AO->DO since expanders have no ADC (needs a per-cell trimmer calibration pass), and keep the bus short/slow-able. Recommendation: build BOTH muscle boards with the expander even though 2 cells do not need one, so the N-cell claim is demonstrable to the panel. CORRECTED A STALE PIN: Part 3 said IN4 -> GPIO5, but GPIO5 is a strapping pin and Part 10 already used 27; Part 3 now says 27 with the reason. JOINT DURABILITY: the counter-intuitive point is that solder joints fail from wire flex at the joint boundary, not from the solder, so adhesive ON the joint can make it worse — the fix is heat-shrink plus anchoring the wire 5-10mm away. Hot glue over epoxy while the pin map can still change (it can: the GPIO conflict fix and the expander migration are both pending). Two hard warnings recorded: never acetic-cure silicone (releases acetic acid, corrodes copper over months) and never glue the inter-brick connection since modularity depends on it separating.

---

## [2026-07-31 22:30] — Claude Code
**Task:** Analyse the dot-flicker-between-letters problem Mridul raised; retract a false finding of mine.
**Changes:** NEW `docs/CLUTCH_OPTIONS.md` (+PDF). RETRACTED the incorrect "2mm stack error" annotation in `outer_box.scad` and in the handoff.
**Status:** documentation only, by request. No CAD or sim geometry touched.
**Notes:** TWO things worth carrying forward.

(1) The flicker is real and measured: typing "hello world" performs 359 individual dot movements where 66 are needed (5.4x waste); worst single change is a->z at 59 dot movements. But Mridul's proposed fix — drop the motor to free the cam — does NOT disengage anything, because the return springs push each linkage DOWN onto the cam, so the linkages simply follow it down. It still solves his actual goal though: dropping ~1.2mm puts every dot below the reading surface, so the reader feels a clean blank cell while the mechanism churns. That is "blanking" and it needs no down-stop. A true declutch (feet off the cam, fixing wear and torque too) additionally needs a hard down-stop and is roughly twice the mechanism. Best option identified is a passive helical/lost-motion coupling using rotation DIRECTION as the control signal — no second actuator, no space cost, because an SG90 servo will not fit beside the ULN2003 in a 14mm pocket. Also recorded: the two-cam 8-state split already proposed for R-07 cuts chatter 3.9x by itself with no new mechanism.

(2) I WAS WRONG about the "2mm stack error" and have retracted it. I claimed base_plate_z was 2mm out because the mid-plate rests on top of its ledge. The seating observation is correct but the conclusion was not: that 2mm had already been absorbed by cutting elec_pocket_h 16->14 in commit a53594c, documented in docs/PRINT_DAY_MONDAY.md. Read from source the stack closes exactly (4+14+2+2+19 = 41). The cause was an analysis script that HARD-CODED elec_pocket_h = 16 instead of reading the file — the same duplicated-constant failure this project keeps hitting. base_plate_z = 41 is correct. The cam HUB interference (hub_h=4 into a 2mm gap) is unrelated and still genuinely open.

---

## [2026-08-15] — Claude Code (ELECTRONICS fork)
**Task:** Build pack for the 24 Aug evaluation — what to present without the upper linkages, what can be permanently assembled now, colour-coded wiring, remaining shopping, screw sourcing.
**Changes:** New `docs/BUILD_PACK.md` (+PDF), 9 parts. `docs/md2pdf.py` gained wire-colour rendering. PDFs regenerated. No CAD, no firmware touched.
**Status:** completed.
**Notes:** MRIDUL HAS BOUGHT: soldering iron, solder wire, wire stripper, super glue (plus the earlier multimeter and calipers). Remaining electronics spend is ~Rs940 and the ONLY true blocker is a Rs100 breadboard. AUG 24 FRAMING: the upper linkages are giving trouble and are NOT on the critical path — three of the four project layers (encoding, actuation, control) are demonstrable in real hardware without them; the doc explicitly says do not promise raised dots on the day. WHAT IS SAFE TO MAKE PERMANENT: DC jack header pins, ULN2003 wires soldered flat, the power spine, brass heat-set inserts. WHAT IS NOT: anything soldered to an ESP32 GPIO (the pin map still changes twice — the 21/22 conflict fix and the expander migration), and the hall TO-92 desolder. NEW CAUTION FOUND: before desoldering the hall sensor, read its part number — a 49E/SS49 is analog and fine, but an A3144 is open-collector digital and depends on a 10k pull-up that lives ON the blue module, so desoldering it silently kills the output. SCREWS: sizes pulled from the CAD parameters, not guessed (M2.5x25 x4 into 3.5mm/5mm brass inserts, M4x10 x2 into a 3.3 pilot, M2x8 x2 into 3.2mm inserts). Standardisation answer is TWO sizes, not one: M2.5 everywhere structural, M4 kept for the motor because the 28BYJ-48's own ears are drilled 4.2mm and an M2.5 would leave 1.7mm of slop that moves the cam off centre. Pod lid M2 -> M2.5 is a 3-parameter CAD change (post wall drops 1.65 -> 1.5mm, still fine) FLAGGED for the CAD fork and worth doing only if the pod is not yet printed. HEAT-SET INSERTS ARE INSTALLED WITH THE SOLDERING IRON he just bought, at ~230C with a dedicated cheap tip — brass and melted plastic ruin a tip for solder work. MCP23017 deliberately NOT ordered: not needed for the eval or for two cells, and local availability of DIP-28 logic is unreliable; Robu/Element14/Amazon when cell 3 is committed. TOOLING: md2pdf.py now renders `RED`/`BLACK`/`BLUE` etc. code spans in their actual colour, because a bench wiring doc printed entirely in black ink is the one place ambiguity costs hardware.

---

## [2026-08-19 02:40] — Claude Code
**Task:** Architecture study for reaching a readable multi-cell line; four diagrams; PDF image support.
**Changes:** NEW `docs/MULTICELL_ARCHITECTURE.md` + PDF, NEW `docs/img/*.svg` and matching `.png`. `docs/md2pdf.py` now embeds images (prefers a PNG next to the referenced SVG, since ReportLab cannot read SVG).
**Status:** documentation only. No CAD, no sim geometry.
**Notes:** The governing constraint is CELL PITCH, 6.1-6.5mm. Only a piezo reed (~2mm) fits at every cell, and piezo is why commercial displays cost $4,000+. N20 is still ~1.9x too wide and, being DC, needs an encoder. Two motors per cell fails for the same reason: two cam DISCS need ~44mm between centres. So actuator-per-cell cannot reach standard pitch at any price Braillix can afford. The escape is a travelling cam head over a bank of LATCHING pins - actuator count then stops scaling with cell count. A cam can only push, so a reset bar is mandatory (wipe the line, then set it). Honest speed: ~1.5-2s per cell, so 8 cells is ~15s per line; fine for a maths line set once, not for scrolling. A leadscrew is far too slow with a 28BYJ-48 (~16s to traverse 4 cells at 8mm/rev) - it must be a GT2 belt. The single unproven assumption is the latch: ~0.4N hold against a 5-15g reading force; silicone-sleeve friction (~Rs 50) is the cheap candidate and must be tested on a 4-pin coupon before any other part is designed. Also recorded: splitting a cell across two 8-state discs fixes R-07 (7.9 degrees vs 78.5) but does NOT speed refresh - rotation time is angle, not state count - and shrinking a disc does not help the ramp, because at minimum size the pressure angle collapses to atan(lift*pi/2*foot) = 51.5 degrees regardless of radius.

---

---
## [2026-08-19 19:15] — Codex
**Task:** Audit every CAD/print asset before AJ's next-day 3D print and remediate confirmed failures.
**Changes:** Applied measured motor offset/ear spacing; corrected top counterbores; made cell pogo windows symmetric/full-through; removed the pod dock-wall antenna overlap; replaced the guessed unsupported panel-jack cradle with a flat-printing inline-pigtail cable exit; added and rendered a hardware fit coupon; regenerated affected STLs; replaced the slicer profile with a conservative 0.16mm/5-wall/40% release profile; regenerated only coupon/mid/top G-code; moved all stale 3-wall output to `printing/gcode_HOLD_unvalidated`; added `tools/validate_print_assets.py`; added `docs/PRINT_RELEASE_2026-08-19.md`; marked `print_batch` stale.
**Status:** safe subset complete and PASS; full mechanism remains on HOLD pending explicit approval for the coordinated stack repair and physical cam/linkage/Hall/spring gates.
**Evidence:** Every authoritative STL was independently OpenSCAD-rendered and normalized against source; all are closed/manifold with expected component count. Corrected coupon, lid, box and pod shell were pixel-inspected. Exact checked manifest is coupon/mid/top; emitted headers are PETG 235/230C, bed 80C, 0.16mm, 5 walls, 40% infill, 6/6 shells, 8mm brim, ironing, supports off, zero G2/G3. Validator final result: PASS.
**Critical finding:** Current cam D bore is only 3.5mm deep due a centered-cube intersection error, so the 7.5mm shaft cannot install. Preferred no-shaft-cut repair raises the upper stack +4mm and needs a new Hall island. That broad cascade was not applied without explicit approval.
---
## [2026-08-19 - Codex continuation]
**Task:** Complete reversible fit-test work without applying the unapproved +4 mm production-stack cascade.
**Changes:** Rebuilt `pogo_end_cap` as a hollow TPU tongue with a real retaining barb; added `motor_cam_socket_coupon` with 3.1/3.2/3.3 mm double-flat sockets, a measured 9 mm seat, and a 7.7 mm blind depth; regenerated both STLs; added and sliced the motor coupon into the checked release.
**Status:** Four-file safe subset PASS; full mechanism still HOLD pending AJ's explicit stack choice and physical tests.
**Evidence:** Final validator confirmed all 13 authoritative STLs are closed/manifold and match fresh renders. The motor coupon has 3 expected components, 0 boundary/non-manifold edges, and a 60x12x8 mm envelope. Exact checked G-code manifest is hardware coupon, motor-socket coupon, mid plate, and top plate; all retain PETG/0.16 mm/5 walls/40%/80 C/no-support/no-arc invariants. Both new parts were visually inspected.

---
## [2026-08-19 - Codex print-readiness continuation 2]
**Task:** Continue the full tomorrow-print audit without applying the unapproved +4 mm production-stack cascade.
**Changes:** Added and checked `top_interface_coupon`, `base_interface_coupon`, `pigtail_slot_coupon`, `pogo_receiver_coupon`, `cam_linkage_test_fixture`, and the STL-only four-component `cam_linkage_test_resin_set`; moved the full top-plate G-code to `gcode_HOLD_fit_unproven`; added `MECHANISM_BENCH_TEST.md`; rewrote the current print release; corrected stale PETG end-cap, sacrificial-bridge, and old print-day guidance.
**Status:** Eight-file checked PETG subset PASS. Full product remains HOLD pending coupon results, physical dot-5/dot-6 spring/torque evidence, and explicit stack-repair approval.
**Evidence:** Validator freshly proved 19 authoritative closed/manifold STLs against independent renders and the exact eight-file G-code manifest. New coupon and fixture renders were visually inspected. The resin test set has exactly four manifold components and reuses the separately source-verified authoritative cam mesh.

## [2026-08-21] — Claude Code (ELECTRONICS fork)
**Task:** Sourcing pass — homing sensor, homing magnet, fasteners; and write the accumulated CAD requests into the handoff instead of only mentioning them in chat.
**Changes:** `.ai-sync/handoff.md` gained a "CAD REQUESTS FROM THE ELECTRONICS FORK - 2026-08-21" section (8 items) and the stale hall-sensor line was superseded. `docs/MASTER_BOM.md` M4 row now specifies BRASS. No CAD, no firmware touched.
**Status:** completed.
**Notes:** MRIDUL CALLED OUT THAT THE FORKS WERE NOT TALKING — correct, I had been saying "flag it for the CAD fork" without writing anything into handoff.md. Fixed, and reading the handoff immediately caught a live error of mine: I had been quoting M4x10 motor screws from MASTER_BOM, but Codex had ALREADY corrected that row to M4x5 thread-forming with an explicit "do not use M4x6 or M4x10 until the coupon proves >=0.5mm cam clearance". The legacy stack agrees independently — the pilot is only 2mm deep (base_thickness 5 - cam_pocket_depth 3) and the motor ear ~1.5mm, so an M4x10 bottoms out regardless of stack option. Deferred to Codex's row and only added the new material requirement. HOMING MAGNET GOES TO 8x1mm: Mridul cannot source 3x1mm and the only 3mm stock is 3x3mm, which fails the cam's own assert (magnet_depth < disk_base_thickness - 0.5 = 1.5mm; 3x3 needs 3.2mm and cuts through the floor — the same failure the old 3x2mm BOM entry caused). He owns 8x1mm; requested homing_mag_dia 3.0 -> 8.0. I had objected on flex grounds and WITHDREW IT after computing the plate deflection: 0.8mm of resin over an 8.4mm span deflects ~0.003mm under 1N, before the bonded magnet stiffens it. His instinct was right. The real consequence of 8mm is magnetic, not structural: the magnet orbits ~8mm from the steel M4 screw at x=+9.85, giving ~5 mN*m of cogging (~10% of motor output) which R-07 leaves no margin for — hence brass screws. HOMING SENSOR: moving off the analog MH module (per-cell trimmer, and expanders have no ADC) to a bare A3144 unipolar digital switch in TO-92 — threshold and hysteresis are internal so there is nothing to calibrate, and 4.1x3.0x1.5mm fits the existing 4.5x3.5x1.6mm pocket with no CAD change. VCC 5V with a 10k pull-up to 3.3V; open-collector output means the pull-up rail sets the high level, so the ESP32 never sees 5V — free level shifting. DOCK WINDOW FINDING: 10x8mm caps the dock at 6 conductors (2x3 header = 7.62x5.08 fits; 2x4 = 10.16 too wide), so direct-GPIO two-cell at 7 conductors does not fit through it with ANY connector including pogo. That is an independent argument for the MCP23017-per-brick plan, which drops it to 4. A 5-pin pogo has been sourced and fits with one spare. Also flagged: MCP23017-E/SO and MCP23017T-E/SO are the same SMD SOIC-28 part (T = tape-and-reel only) and neither is the DIP I had recommended — /SP is the through-hole one; and MCP23S17 is SPI, needing 6 conductors, which the window cannot carry. CONNECTOR SAFETY: pogo pinout GND-SCL-5V-SDA-GND is mirror-tolerant — a reversed connector swaps SDA/SCL (harmless) while 5V and GND still land correctly. Pod lid confirmed 2 screws, not 4. Pod M2->M2.5 standardisation still undecided and gates a pod print.

---

---

## [2026-08-26] - Claude Code (Mridul's fork)
**Task:** Restore the linkage guide, fix the cam bore, put the cam on Gray order, resolve the comb/standoff clash, standardise the pod fastener, and write a README.
**Changes:** NEW `cad/scad/linkage_comb.scad` (+STL) and comb locating pegs in `base_plate.scad`. `braille_cam.scad` - Gray order plus a rebuilt shaft bore. `braille_cell.ino` and `sim/3d/app.js` - matching Gray mapping. `mech_layout.scad` - `foot_len`, `arm_y`, `foot_w` moved in. `esp32_pod_params.scad` - M2 to M2.5. NEW `README.md`, `renders/readme_mechanism.scad`, `renders/blender_mechanism.py`, `docs/img/mechanism.png`.
**Status:** completed except the vertical stack, which needs Mridul's decision.
**Notes:** THE GUIDE WAS THE MISSING PART. It was deleted 2026-06-04 on the reasoning that the linkages are "constrained at BOTH ends"; they are not, because the foot only rests on the cam. Mridul proved it by hand - on a ramp the cam drags the linkage round the disc rather than lifting it. Two loose contacts do not constrain a rigid body. His placement was better than mine: grip the FOOT at track radius rather than the arm at mid-span, because the upper riser is already located by the nub in the dot insert and r=12.8..21.3 is the longest lever available. His second correction was also right - an open radial channel still lets the foot slide along the arm, so the pockets are closed on all four sides.
GRAY ORDER: slice i carries gray(i), so one dot moves per step instead of six. 359 to 171 dot movements on "hello world", and about 6x less peak torque. The cam, the firmware and the simulator all carry the flag and must agree.
I WAS WRONG ABOUT RAMP ROOM and have corrected it in-source. Slice run length does NOT buy ramp room - a state's angle is its slice CENTRE, so a ramp always has one slice minus the foot to finish in. Ramp room comes from radius, foot width, lift and ramp fraction. The real finding is that angular_ramp_fraction = 0.2 was deliberately narrowed to maximise dwell, and that is what made the ramp a 72.6 degree wall. Widening it to the whole slice, moving inner_radius 12 to 14.4, and taking pin_lift 0.8 to 0.5 reaches 30 degrees with all 64 states on a 44.9mm disc - the current disc is 44.4mm. Not applied yet.
THE CAM BORE BUG IS CONFIRMED independently: cube(center=true) inside a translate centred the cube on the translated origin, so the intersection stopped at z=-0.5 and the bore was a blind 3.5mm, not 8mm. Rebuilt as an extruded 2D profile, which has no centring to get wrong.
THREE MORE UNDEF TRAPS: foot_len, arm_y and foot_w were private to linkage.scad, so the comb read them as undef and rendered a 1mm-tall ring that looked plausible until the bounds were measured. All three moved to mech_layout.scad with asserts. The rebuilt linkage.stl is vertex-identical, so the move changed no geometry.
OPEN AND NEEDING MRIDUL: the motor sits 4mm too high for the cam hub to reach its collar. Option A (+4mm upper stack, Codex) is implemented behind a flag and makes the box taller. Option B (drop the motor 4mm by removing the 2mm mid-plate and its 2mm ledge) keeps the box height and the 14mm electronics pocket, and the arithmetic closes exactly - but the motor then needs a new seat, because it currently bolts up into the base plate and is located by the mid-plate's collar.

---

## [2026-08-26 later] - Claude Code (Mridul's fork)
**Task:** Drop the stack 14mm, make the cam bore blind again, and write findings back to the electronics and simulation forks.
**Changes:** `outer_box.scad` 58 -> 44mm with the motor on the floor; `mech_layout.scad` cam_flat_z 45 -> 31; `dock_interface.scad` dock_center_z 31 -> 15.5; `esp32_pod_params.scad` pod_height 58 -> 44; `braille_cam.scad` blind bore plus a central cap; NEW `motor_spec.scad`. `.ai-sync/handoff.md` gained sections for the other two forks.
**Status:** completed. G-code is all stale by design and the release validator will fail its STL hash check until a re-slice.
**Notes:** THE STACK DROPPED 14mm on Mridul's call. The motor was the only thing setting the height, and the 14mm electronics bay under it existed only because the driver board lay flat. Cell and pod are both 44mm now, a quarter shorter. Every gap above the motor is unchanged, so link_total_h is still 12.2 and the ordered resin linkages stay valid - verified by re-rendering: only the two enclosures changed size, the cam, linkages, comb, dot insert, top plate and base plate are identical.
A CONSEQUENCE I MISSED AND MRIDUL CAUGHT FROM THE SIMULATION: the driver board does not fit standing on edge. I had measured floor to top plate and got 36mm, but the base plate cuts across at 27..32, so a vertical board only has 23mm and a ULN2003 module is 32mm on its short edge. It cannot pass beside the plate either - 58 x 50 in a 60 x 60 cavity leaves 5mm in Y and 1mm in X. Answer is to cut the module down or use the bare DIP-16, written into the handoff for the electronics fork.
THE BORE IS BLIND AGAIN at Mridul's request. A through-bore left the shaft 1.5mm proud of the cam face; it cleared the arms by 2mm so it was not a clash, but it is something to catch on during assembly and it left only 6mm of Double-D to carry torque through resin. A 2.6mm boss on the disc centre takes the bore to 8.1mm with a 0.5mm roof, bounded above by the arms at 3.5mm and below by the 7.5mm of shaft to swallow. No stack change.
AND A REAL MISS OF MINE, worth recording because the pattern will recur: braille_cam.scad carries its geometry TWICE, at top level and in module braille_cam(). Commit e762b7e repaired the cube(center=true) bore in the MODULE and left the top level alone, so the file rendered a fixed bore from one and the broken 3.5mm one from the other. The exported STL comes from the top level, so cad/stl/braille_cam.stl carried the original bug for a week while the commit message said it was fixed. Both paths now call the same modules and both were verified independently. The duplication itself is still there and is the actual defect.

---

## [2026-08-26 23:30] - Claude Code
**Task:** Handoff save at the end of the cam/comb/stack session.
**Changes:** `.ai-sync/handoff.md` gained a CURRENT STATE section at the top and a RESOLVED marker on the motor-height decision. Nothing in that file was overwritten - Codex's print-release audit, the electronics track, the CAD-requests list and the R-07 record are all intact.
**Status:** session complete; R-07 is the next CAD job and is not started.
**Notes:** The design is 14mm shorter than this morning: cell and pod are both 44mm. `link_total_h` is unchanged at 12.2 so the ordered resin linkages are still valid, and only the two enclosures changed size. The cam bore is blind again via a 2.6mm central boss.
TWO DEFECTS OF MINE ARE RECORDED IN THE HANDOFF and both are the same shape - a fix that did not reach everywhere it needed to. `braille_cam.scad` holds its geometry twice and my bore repair only touched the module copy, so the released STL kept the bug for a week under a commit message saying it was fixed. That duplication is still present and is worth collapsing. Separately I claimed slice ordering buys ramp room; it does not, and that is corrected in-source.
NOT PUSHED at time of writing. The other forks read handoff.md from the working tree, so they will see this, but GitHub will not until someone pushes.

---

## [2026-08-31] - Claude Code (Mridul's fork)
**Task:** Commit to the bare ULN2003AN, write its dimensions and position down properly, and evaluate Mridul's proposal to widen the cam ramp using the plateaus Gray order creates.
**Changes:** NEW `cad/scad/electronics_spec.scad` (chip, perfboard, heights, position, clearance asserts). `dock_interface.scad` gained `dock_mag_z/dia/depth`; `outer_box.scad` and `esp32_pod_params.scad` now derive from them. `.ai-sync/handoff.md` gained a CURRENT STATE section, inserted not overwritten.
**Status:** electronics spec complete. R-07 solved on paper, NOT applied.
**Notes:** THE DRIVER IS A BARE DIP-16 NOW. 11mm overall socketed, on a 28 x 18 perfboard, standing on edge at x=+16 in the only clear gap in the box - 12.35mm between the motor cup edge at +9.75 and the corner bosses at +22.1. Flat does not fit anywhere.
A DEFECT THE 14mm DROP CREATED: pod mag_z was still 29 under a comment saying "matches cell" while the cell had moved to 13.5. The dock magnets were 15.5mm apart. Both derive from dock_interface.scad now.
R-07: Mridul's premise was right - Gray order cut disc ramps 126 -> 64 and the code already merges plateaus. But it buys no ramp room, because all 64 boundaries carry a ramp under both orderings, so no ramp can borrow angle from a neighbour. AND I HAD A NUMBER WRONG: earlier notes used foot_w = 1.4 as the flat needed, but that is the width ACROSS the track - the follower is a 0.5mm roll, so along the travel it is a point contact and only ~0.28mm is lost each side. Every earlier pressure-angle figure was pessimistic. Widening angular_ramp_fraction alone fixes five of six tracks for free. The innermost needs pin_lift 0.8 -> 0.5, which is standards-correct anyway since the linkage is a rigid slider (1:1 cam lift to dot rise) and braille wants 0.46-0.50mm. Full fix also needs the base plate widened 50 -> 54mm in Y.

---

## [2026-09-01] - Claude Code (Mridul's fork)
**Task:** Apply R-07 in full (grow the disc, widen the ramps, shrink the dot), fix the cam bore properly, and move the homing magnet to the 8mm parts actually on hand.
**Changes:** mech_layout.scad now owns inner_radius 14, pin_lift 0.5, the plate/comb footprint and foot_roll_r. braille_cam.scad gained per-track ramp sizing and a genuinely blind bore; both inline hub bores deleted. base_plate 58x56, cam pocket 50, comb 54 with pegs at 19. motor_spec.scad carries motor_shaft_cut = 2.5. All STLs re-exported; sim params regenerated.
**Status:** applied and verified. Linkage stiffness NOT addressed and is now the blocking issue.
**Notes:** EVERY TRACK IS NOW UNDER 30 DEGREES (29.5 worst, was 72.6). Verified from exported meshes: cam bbox Z is -4.00 to 2.50, so nothing stands above the cam face, and all three reprinted parts are manifold.
THE v8.6 BORE "FIX" WAS WRONG AND MRIDUL CAUGHT IT. It made the bore blind by adding a boss ON TOP of the disc, so the shaft still ended 1.5mm above the working face - concealed, not below. He asked twice. The real fix needs the shaft 2.5mm shorter, because the motor is already on the floor and the disc height is set from above; there was no no-cost option and I should have said so the first time instead of solving it upward.
METHOD BUG WORTH REMEMBERING: openscad --export-format echo does NOT evaluate top-level asserts. My 37-file sweep reported all-clean while braille_cam.scad was missing an include and could not render. Sweep with -o x.csg.
TWO CONSEQUENCES: the already-ordered resin linkages are invalidated (arms grew 2.0-2.4mm each), and that makes the long-standing stiffness problem urgent - the 1x1mm arm at 19.86mm deflects 1.57mm under a 0.1N fingertip against a 0.50mm dot. It needs roughly 2x2mm or 2x3mm, and foot_roll_r must be decoupled from link_thickness first because the new ramp sizing reads it. Not applied; it should ride the same reprint.

---

## [2026-09-01 late] - Claude Code (Mridul's fork)
**Task:** Raise the stack rather than cut the motor shaft, and thicken the linkage arms.
**Changes:** braille_cam.scad hub_h 4 -> 6.5 with a shaft_air_gap assert; mech_layout.scad cam_flat_z 33.5, plate_under_z 42.5, plate_top_z 46.5, and a new shared arm section (link_thickness 2.0, arm_h 3.0, riser_w 1.4); outer_box.scad shell_height 46.5, base_plate_z 29.5, boss_height 25.5; esp32_pod_params.scad pod_height 46.5; linkage.scad decoupled from link_thickness for its riser; linkage_comb.scad pocket assert; electronics_spec.scad headroom 23 -> 25.5. motor_spec.scad shaft cut removed. All STLs re-exported, sim params regenerated.
**Status:** applied and verified. Firmware homing still not written.
**Notes:** THE SHAFT IS NOT CUT - Mridul's call, and the better one: a cut is irreversible and has to be repeated on every unit, a hub length is a number in a file. Cell and pod are 46.5mm, still 11.5mm below the pre-v8.5 58mm.
IT IS 2.5mm AND NOT THE 2mm ASKED FOR, deliberately. 2.0 leaves the bore exactly as deep as the shaft is long, so any plus tolerance and the cam hangs on the shaft tip instead of seating on the boss, tilting the disc. 2.5 buys 0.5mm of air over the tip and keeps the 0.5mm roof; there is an assert on it now.
ARMS 1x1 -> 2x3mm, 54x stiffer. This was the actual blocker: at 1x1 over a 19.86mm span the arm deflected 1.57mm under a 0.1N fingertip against a 0.50mm dot, so a reader would fold it flat and feel nothing. Two hidden couplings had to be broken first and both would have silently undone R-07 - the lower riser took its RADIAL width from link_thickness which is TANGENTIAL (a 2mm foot on a 1.6mm track), and foot_roll_r was link_thickness/2, which feeds the ramp sizing and would have cost about a third of the ramp room. Both now independent.
VERIFIED BY RENDERING, NOT BY READING: all 15 linkage pairs intersected in OpenSCAD, zero clashes, 0.60mm between 2mm arms on 2.60mm centres. Cam bbox Z -6.50..2.50 confirms the 6.5mm hub and nothing above the cam face. Both shells export to the same Z so the dock faces stay level.
EVERYTHING IN THE MECHANISM AND BOTH ENCLOSURES NEED REPRINTING, and all G-code is stale.
