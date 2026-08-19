# Braillix - Assembly Bible & Wiring Guide

> [!IMPORTANT]
> **CURRENT RELEASE GATE - 2026-08-19:** Do not assemble the full printed mechanism from this guide
> yet. The production cam has an invalid 3.5mm socket for the measured 7.5mm shaft, and the complete
> stack remains on HOLD. Print only the files in `printing/gcode_kobra_neo_checked` and follow
> `PRINT_RELEASE_2026-08-19.md` plus `MECHANISM_BENCH_TEST.md`. Resume final assembly only after a
> later release explicitly removes this gate.

Follow this guide sequentially to build your first single-cell prototype.

---

## SECTION 1: CRITICAL SAFETY CHECKS (DO THIS FIRST)

> [!CAUTION]
> **BARREL JACK POLARITY CHECK**
> The photographed inline female pigtail has red/black wires, but colour is not proof. If you wire 5V backwards, the ULN2003 chip can burn out.
> 1. Plug the 5V adapter into the wall.
> 2. Plug the adapter's round male plug into the black inline female pigtail. Keep both stripped wires disconnected from the circuit.
> 3. Turn on your Multimeter and set it to **DC Voltage (V DC)**.
> 4. Touch the RED probe to the exposed red wire and the BLACK probe to the exposed black wire.
> 5. If the screen reads approximately **`+5.0V`**, red is **POSITIVE (+)** and black is **GND (-)**.
> 6. If it reads approximately **`-5.0V`**, the pigtail colours are reversed. Do not connect it until the wires are relabelled.
> 7. Disconnect wall power before attaching either wire to the breadboard.

---

## SECTION 2: WIRING DIAGRAM

We are wiring the **ESP32**, **ULN2003**, and **Hall Sensor** together.

```text
[5V/3A Adapter] 
      |
      +---> (+) ---> [BREADBOARD 5V RAIL] ---> ULN2003 (+) power pin
      |
      +---> (-) ---> [BREADBOARD GND RAIL] ---> ULN2003 (-) power pin

[ESP32 (Powered by USB)]
   GND  -------------------------> [BREADBOARD GND RAIL] (Crucial: Common Ground!)
   3V3  -------------------------> Hall Sensor VCC
   GND  -------------------------> Hall Sensor GND
   D34  <------------------------- Hall Sensor AO (Analog Out)
   D18  -------------------------> ULN2003 IN1
   D19  -------------------------> ULN2003 IN2
   D21  -------------------------> ULN2003 IN3
   D22  -------------------------> ULN2003 IN4

[ULN2003 Output]
   White JST Socket -------------> 28BYJ-48 Stepper Motor
```

### Kill-Shots to Avoid:
1. **Never** connect the 5V rail to the Hall Sensor VCC. ESP32 pins are not 5V tolerant. Use `3V3`.
2. **Never** connect the 5V adapter rail to the ESP32 `VIN` pin while the USB cable is plugged into your laptop. Power the motor from the adapter, and the ESP32 from USB. Only link their grounds.

---

## SECTION 3: CURRENT PRE-ASSEMBLY VALIDATION SEQUENCE

### Phase A: PETG fit evidence

1. Print `motor_cam_socket_coupon.gcode`; test the unpowered shaft from 3.1 to 3.3mm and record the
   smallest removable fit. Never hammer, heat, power, glue, or cut the shaft during this test.
2. Print `base_interface_coupon.gcode`. Inspect the Ø29 motor-seat roof for sag, test the actual M4
   screw in the 3.3/3.4/3.5mm through pilots, and test the M2.5 bolt in the 2.9/3.0/3.1mm Ø6x12
   standoffs. Do not force a bore that whitens or splits.
3. Print the remaining required coupons in `PRINT_RELEASE_2026-08-19.md` and record every selected
   fit before changing a production dimension.

### Phase B: electronics bring-up outside the enclosure

1. Keep the ESP32 on USB and the motor on the 5V adapter; connect grounds.
2. Power the bare Hall sensor/module from ESP32 `3V3`, not 5V, and use `AO` for the initial test.
3. Verify motor direction, homing response, and the already measured red-positive pigtail polarity
   on the breadboard. Do not install electronics in an unreleased enclosure.

### Phase C: cam/linkage/spring bench evidence

1. Print `cam_linkage_test_fixture.gcode` in PETG.
2. Obtain the four-part `cad/stl/cam_linkage_test_resin_set.stl` in resin plus the actual 2mm OD
   spring. Do not use PETG linkages or a pen spring.
3. Follow `MECHANISM_BENCH_TEST.md` for dot-5 and dot-6 dry travel, 50-cycle return, dwell, damage,
   height, and torque tests. The fixture is evidence equipment, not the final enclosure.

### Phase D: final assembly - intentionally blocked

Do not press the current production cam onto the motor, trim the shaft, glue the Hall sensor, glue
magnets, install heat-set inserts, or glue the resin dot insert yet. Those actions either hide a
failed fit or are difficult to reverse. A later validated release must provide the corrected cam,
base/Hall stack, enclosure height, selected coupon dimensions, and final assembly sequence.
## SECTION 4: BEGINNER SOLDERING MISTAKES
If you are doing the flat-soldering for the ULN2003:
- **Cold Joint:** Looks like a dull, grey blob that doesn't stick to the pad. *Fix: Apply a tiny bit of flux, heat the pin and wire simultaneously for 2 seconds, and reapply a dab of solder.*
- **Bridging:** Solder spills over and connects two pins (e.g., IN1 and IN2). This will break the motor steps. *Fix: Heat the bridge and swipe your iron away quickly, or use desoldering wick to soak up the excess.*
- **Melted Insulation:** Holding the iron on the wire too long melts the plastic jacket. *Fix: Tin the wire and pin separately first (apply solder to them individually), then just touch them together with the iron for 1 second to fuse them.*
