# TECHNICAL AUDIT REPORT: BRAILLIX MECHANICAL STACK

**Project:** Braillix (CPG 126)
**Author:** Hardware Lead
**Date:** May 6, 2026
**Subject:** Critical Design Flaws in AI-Generated OpenSCAD Models (v2.0/v3.0)
**Status:** 🔴 CRITICAL REVISION REQUIRED PENDING 3D PRINTING

## 1. Executive Summary

An extensive engineering audit was conducted on the latest `.scad` files (`base_plate`, `outer_box`, `top_plate`, `linkage`, `braille_cam2`) designed for the Braillix modular cell. While the code compiles successfully, the models violate fundamental physical constraints, electromechanical clearances, and kinematic logic.

If printed and assembled, the current geometry will result in component collisions, electrical shorting, mechanism binding, and completely illegible Braille output. A mandatory redesign of the mechanical stack is required.

## 2. Electromechanical & Clearance Failures

### 2.1 The Electronics Sub-Floor "Clash"

* **The Design:** `outer_box.scad` defines a 36x46mm floor pocket with a depth of **9mm** to house the electronics. The stepper motor body is suspended directly above this at `z=13`.

* **The Reality:** A standard ULN2003 driver board measures ~31x35mm, but its vertical height (including the white JST XH motor connector and jumper pins) ranges from **12mm to 14mm**.

* **The Failure:** The driver board physically cannot fit in a 9mm pocket. Attempting to force the motor into position will crush the ULN2003 connectors, causing severe physical damage and electrical shorts. Furthermore, trying to cram both the standard ULN2003 breakout (31x35mm) and the MCP23017 "dumb" port expander board into the same cavity requires significantly more footprint than the 36x46mm pocket allows.

### 2.2 Lack of Motor Torque Support (Hanging Motor)

* **The Design:** The 28BYJ-48 motor is mounted exclusively by its two thin plastic mounting "ears" to the underside of `base_plate.scad`. The heavy cylindrical body of the motor hangs in mid-air over the electronics.

* **The Failure:** Without a solid mid-plate or cradle to support the bottom of the motor, the rotational torque generated when turning the cam will cause the plastic mounting ears to flex and warp over time. This will lead to the cam skipping steps and losing its "Zero" calibration.

## 3. Dimensional & Alignment Failures

### 3.1 Uncentered Motor Shaft (The 8mm Offset)

* **The Design:** `base_plate.scad` sets the motor body cutout (`motor_body_diameter`) and the shaft hole (`shaft_clearance`) on the exact same center axis (`x=0`).

* **The Reality:** The 28BYJ-48 stepper motor features an offset internal gearbox. The shaft is offset by approximately **8mm** from the center of the motor body.

* **The Failure:** To keep the Braille dots centered in the cell, the **shaft** must remain perfectly centered at `x=0`. However, because the CAD does not offset the motor body cutout by 8mm, inserting the motor will cause the massive body of the gearbox to crash violently through the side walls of the base plate's seating pocket.

### 3.2 Inadequate Top Plate Coverage

* **The Design:** `top_plate.scad` is dimensioned as a **34x34mm** square.

* **The Reality:** The internal cavity of `outer_box.scad` is **52x60mm**.

* **The Failure:** Mounting this top plate leaves massive 9mm-13mm gaps around the perimeter. This exposes the delicate internal cam mechanism and wiring to dust, debris, and user interference, ruining the encapsulated "Lego-style" design.

## 4. Kinematic & Logical Failures

### 4.1 Linkage Alignment vs. Cam Phase Shift (Critical Showstopper)

* **The Design:** `linkage.scad` spaces the 6 linkages radially so they read the cam tracks at different angles (e.g., Track 1 reads at 30°, Track 2 reads at -30°).

* **The Reality:** The mathematical algorithm in `braille_cam2.scad` assumes all 6 pins are reading the cam in a perfectly synchronized, straight line.

* **The Failure:** Because the linkages hit the cam at different angles, they will read different Braille letters simultaneously. The physical angular spread introduces a severe "phase shift" that the software does not correct for. The Braille output will be completely scrambled.

### 4.2 Friction and Missing Spring Pockets

* **The Design:** The changelog notes inside `top_plate.scad` explicitly state: *"Spring pockets REMOVED for v1 prototype (gravity return is sufficient)."*

* **The Reality:** 1mm sheet metal linkages weigh fractions of a gram. The friction of the 1.2mm plastic slot, combined with the lateral force of the rotating cam, will easily overcome gravity.

* **The Failure:** The AI's decision to delete the spring pockets guarantees mechanism failure. The pins will permanently bind and stick in the "UP" position. The spring pockets must be reintroduced immediately.

### 4.3 Tactile User Experience (UX)

* **The Design:** The linkage tops (the actual Braille dots the user touches) are left as 1.2x3.0mm flat, sharp rectangular tabs.

* **The Reality:** Standard Braille requires smooth, domed round dots (approx. 1.5mm diameter) for legibility and comfort. Rectangular sheet metal tabs will be uncomfortable and illegible to visually impaired users.

## 5. Required Action Plan & Exact CAD Fixes

To salvage the mechanical architecture, the following specific code and parameter updates must be implemented in the OpenSCAD files:

### Fix 1: Deepen the Electronics Box (in `outer_box.scad`)

* **What to change:** Increase `elec_pocket_h` from `9` to **`16`**.

* **What to change:** Increase `shell_height` proportionally from `50` to **`57`** to accommodate the deeper floor.

* **Why:** This provides the absolute minimum clearance required for the ULN2003 JST connectors and the MCP23017 components on your custom "Muscle" PCB.

### Fix 2: Create a Raised Motor Retaining Pocket (in `outer_box.scad`)

* **What to change:** Do not leave the electronics pocket open to the motor. First, introduce a 2mm solid `cube()` floor at `z=16` to seal the electronics from the mechanics. Then, build a raised vertical collar (a circular wall/pocket) extending upward from this floor. The base of the 28BYJ-48 motor body will insert partially into this raised pocket.

* **Why:** This raised cup securely grips the lower half of the motor body. It acts as a retaining wall that locks the motor against lateral shifts and absorbs rotational torque so the fragile plastic mounting ears don't warp over time.

### Fix 3: Offset the Motor Body (in `base_plate.scad`)

* **What to change:** Keep `shaft_clearance` centered at `translate([0, 0, 0])`.

* **What to change:** Inside the `motor_features()` module, translate the `motor_body_diameter` cylinder by `-8mm` on the appropriate axis (e.g., `translate([-8, 0, -0.1])`).

* **What to change:** Translate the `motor_mount_spacing` screw holes by the exact same `-8mm` offset, as the mounting ears are fixed to the motor body, not the shaft.

### Fix 4: Redesign Linkage Architecture (in `linkage.scad`)

* **What to change:** Completely abandon the radial spacing in `linkage_2d`.

* **What to change:** Redesign the linkages so that their contact feet all fall on a single, straight horizontal axis (e.g., `Y=0`). To prevent the arms from colliding, they must be strictly staggered in height (Z-axis) and length, reaching from the Braille dot positions directly to the X-axis of the cam.

### Fix 5: Overhaul the Top Plate & Braille Holes (in `top_plate.scad`)

* **What to change:** Change `plate_size` from `34.0` to a rectangular layout matching `internal_length` (52mm) and `internal_width` (60mm) to fully seal the top.

* **What to change:** Replace the long 1.2x3mm rectangular slots with precise **round holes** (approx. 2mm diameter). The current long slits act as funnels that will allow dust and debris directly into the cam.

* **What to change:** Re-introduce concentric cylinder cuts around the underside of each of these 6 round holes to act as retaining cups for standard 3mm compression springs.

* **What to change:** Design small, 3D-printed domed "caps" with round shafts that pass through these new round holes. These caps will attach to the metal linkages below and provide a proper, smooth Braille reading surface for the user.

## 6. V3 Improvements & Advanced Architecture Changes

To elevate the prototype into a consumer-grade device, the following architectural upgrades will be integrated into the V3 CAD redesign:

### 6.1 Cam Disc Hub Inversion

* **The Flaw:** In `braille_cam2.scad`, the 5mm D-shaft mounting hub is currently modeled on *top* of the cam reading tracks. This obstructs the reading feet of the linkages and forces the motor to sit lower than necessary.

* **The Fix:** The hub must be inverted. The flat side of the cam tracks should be the absolute top surface. The D-shaft mounting collar must extend *downward* from the underside of the disc, dropping over the motor shaft.

### 6.2 Pogo Pin Safety & Exposure (Short-Circuit Prevention)

* **The Flaw:** Exposed Pogo Pins carry 5V. While 5V is completely safe to human touch (it will not cause electrocution), exposed power lines risk short-circuiting if the user accidentally touches them with a metal object (like a ring, keys, or a coin). This will crash the power supply.

* **The Fix:** Recess the flat target pads on the left side of the block 1mm deep into the plastic. For the right side (exposed spring pins), design a simple, magnetic 3D-printed "End Cap" that snaps onto the final cell in the daisy chain to safely cover the exposed contacts.

### 6.3 Magnetic "Snap" Alignment

* **The Flaw:** The current iteration relies on a physical plastic tongue-and-slot and M3 screws to dock the cells.

* **The Fix:** Replace the screw holes in the outer box with 3x2mm cylindrical cutouts. Press-fit neodymium magnets into the side walls (alternating North/South polarities). This guarantees the modular blocks perfectly and effortlessly snap together for optimal Pogo Pin contact.

### 6.4 The Linkage "Comb" (Lateral Stability)

* **The Flaw:** Tall, 1mm-thin sheet metal linkages are prone to wobbling, twisting, and crossing over each other when the cam rotates.

* **The Fix:** Above the motor mid-plate, integrate a vertical slotted "Comb" (a guide block with 6 precise vertical slits). The metal linkages will ride inside these slots, acting as linear bearings that guarantee perfectly vertical travel and zero twisting.

### 6.5 Metal Bearing Braille Dots

* **The Flaw:** FDM 3D printing 1.5mm domed dots is unreliable, fragile, and feels rough to visually impaired readers.

* **The Fix:** Modify the laser-cut linkage design to feature a small top cup. CA glue off-the-shelf **2mm stainless steel bearing balls** into these cups. This provides a cold, smooth, indestructible, professional-feeling Braille dot.

### 6.6 Firmware Thermal Management

* **The Flaw:** Leaving a stepper motor energized to hold its position generates massive amounts of heat, which can soften the PLA plastic over time.

* **The Fix:** Because the cam physically holds the pins UP via mechanical friction, the motor does not need holding torque. The ESP32 firmware will be programmed to set all 4 ULN2003 driver pins to `LOW` immediately after moving, dropping the cell's power consumption and heat generation to near zero.

### 6.7 Acoustic Dampening

* **The Flaw:** The hard plastic shell acts as an acoustic amplifier for motor vibrations and clicking metal pins.

* **The Fix:** Apply a thin layer of double-sided foam tape between the base of the motor and the new retaining pocket to decouple vibrations. Add a strip of Kapton tape to the cam valleys to soften the "click" of the dropping pins.

### 6.8 Daisy-Chain Wire Routing Gutters

* **The Flaw:** Manually routing 4 wires (5V, GND, SDA, SCL) from the left Pogo pins, into the electronics pocket, and out to the right Pogo pins will result in pinched wires when the base plate is screwed on.

* **The Fix:** The V3 `outer_box.scad` floor must include modeled "wire gutters" along the inside edges to safely and cleanly route wires away from the motor body and screw standoffs.

## 7. Risk Mitigation & Tolerances (Pre-Mortem Analysis)

Anticipating physical and electrical edge-cases prior to fabrication to prevent catastrophic failure during integration.

### 7.1 Mechanical Risks

* **The "Spring-Stall" Motor Overload:** Adding 6 compression springs to the top plate pushes back against the cam. If the springs are too stiff, the 28BYJ-48 motor will stall when lifting multiple pins simultaneously. **Mitigation:** Source the absolute lowest spring constant compression springs available. The metal pins only weigh ~1 gram, requiring minimal downward force.

* **3D Printing Shrinkage & Tolerance Stacking:** FDM printing (e.g., PLA on an Ender 3) naturally shrinks by 1-2% upon cooling. 2.0mm CAD holes will print as ~1.8mm, instantly jamming the Braille pins. **Mitigation:** Do not over-adjust the CAD blindly. Print the top plate with 2.0mm holes, then manually ream them out with a physical 2.0mm metal drill bit to clear plastic layer artifacts.

* **Axial Load Motor Failure (The "Heavy Finger" Trap):** When a Braille dot is raised, it rests directly on the plastic cam track. If a user presses down forcefully on the pin, the force transfers straight through the cam into the 28BYJ-48 motor's D-shaft. This motor is not designed for heavy axial (downward) loads; the internal plastic gears will shatter. **Mitigation (The "Thrust Floor"):** The bottom of the cam disc must be designed to sit completely flush against the rigid 2mm plastic mid-plate (using a thin nylon washer or 0.2mm tolerance). This directly transfers any heavy downward force from the cam into the 3D-printed chassis floor, completely bypassing the fragile motor shaft.

### 7.2 Electrical & Power Risks

* **The I2C "Hot-Plug" Death:** I2C (SDA/SCL) was not designed for hot-swapping modular cables. Snapping cells together while powered will cause capacitance spikes that hang the I2C bus and freeze the ESP32. **Mitigation (Hardware):** Add 4.7kΩ Pull-Up Resistors to SDA/SCL lines on the main Brain board. **Mitigation (Software):** Implement a Watchdog Timer in the ESP32 code. If communication fails for >50ms, the ESP32 must execute `Wire.end()` and `Wire.begin()` to reset the bus without a hard reboot.

* **The Daisy-Chain Voltage Drop (Brownout):** Snapping 5 cells together creates cumulative electrical resistance across Pogo pins and traces. By the 5th cell, the 5V line may drop to ~4.1V. When all 5 motors actuate, voltage plummets, causing the LDOs and MCP23017s to reset (amnesia). **Mitigation:** Integrate a Bulk Capacitor (100µF to 470µF electrolytic) across the 5V and GND lines on *every* custom Muscle PCB to provide localized power bursts for the motors.

### 7.3 Firmware & Logic Risks

* **"Blocking" Stepper Code (The Typewriter Effect):** Standard Arduino `<Stepper.h>` uses blocking functions. Commanding 5 cells using this library will cause them to actuate sequentially, taking ~10 seconds to spell a 5-letter word. **Mitigation:** The software team must use the non-blocking `<AccelStepper.h>` library or a custom `millis()` timer. The ESP32 must send single-step commands in a rapid loop to actuate all motors synchronously.

* **Sensor Bounce (False Homing):** As the cam spins backward, analog noise over the SS49E Hall Effect sensor may trigger a false positive ("HIGH-LOW-HIGH" microsecond bounce), causing the motor to stop 5 degrees off-center. **Mitigation:** Implement strict software debouncing. Once the sensor triggers, the motor must stop, back up slightly, and re-approach the zero point at a highly reduced speed to verify absolute center.