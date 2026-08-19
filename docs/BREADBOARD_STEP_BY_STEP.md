# Braillix — Breadboard Wiring: EVERY SINGLE WIRE

**No soldering. No guessing. Follow this exactly.**

---

## Your parts (confirmed from photos)

```
A. ESP32 DevKit (30-pin, USB-C, CH340C)
B. ULN2003 driver module (green PCB, white JST socket, 4 LEDs)
C. 28BYJ-48 stepper motor (silver, 5-wire white JST plug)
D. Hall sensor module (blue, "MH-Sensor-Series", 4 pins: AO DO GND VCC)
E. Barrel jack pigtail (black female socket, red wire = +5V, black wire = GND)
F. 5V/3A adapter (yellow barrel plug)
G. 4x 4.7k resistors (NOT NEEDED for this test — save for later)
H. Breadboard + dupont jumper wires
```

---

## STEP 0: Prep (power OFF, nothing plugged in yet)

```
[ ] Adapter NOT plugged into wall
[ ] ESP32 NOT plugged into laptop USB
[ ] Have 8+ male-to-male dupont jumper wires ready
[ ] Have 2+ male-to-female dupont jumpers (for hall module)
[ ] Breadboard on desk, nothing in it
```

---

## STEP 1: Place ESP32 on breadboard

```
Breadboard layout (top view):

     LEFT RAIL          BREADBOARD HOLES           RIGHT RAIL
     (+) (-)     1  2  3  4  5 | 6  7  8  9 10    (+) (-)
                 ←  ESP32 straddles the gap  →

ESP32 is WIDE. Push it so:
  - Left row of pins go into column 1 (or 2)
  - Right row of pins go into column 9 (or 10)
  - You should have at least 1 column free on each side for jumpers

USB-C port faces toward you (bottom of breadboard).
```

**Pin layout on YOUR board (read from the silkscreen):**

```
LEFT SIDE (USB at bottom):          RIGHT SIDE (USB at bottom):
  VIN  ←── do NOT connect             3V3  ←── hall VCC goes here
  GND  ←── CONNECT TO GND RAIL        GND  ←── also GND
  D13                                 D15
  D12                                 D2
  D14                                 D4
  D27                                 D16
  D26                                 D17
  D25                                 D5
  D33                                 D18  ←── ULN2003 IN1
  D32                                 D19  ←── ULN2003 IN2
  D35                                 D21  ←── ULN2003 IN3
  D34  ←── hall AO goes here          RX0
  VN                                  TX0
  VP                                  D22  ←── ULN2003 IN4
  EN                                  D23
```

---

## STEP 2: Power rails

```
                    BREADBOARD
          (+) RED rail ─────────────── (+)
          (-) BLUE rail ────────────── (-)

Wire 1: ESP32 "GND" pin (left side) → jumper → (-) BLUE rail
         (THIS IS THE MOST IMPORTANT WIRE — common ground)

Wire 2: Strip barrel jack RED wire → poke into (+) RED rail
Wire 3: Strip barrel jack BLACK wire → poke into (-) BLUE rail
         (same rail as ESP32 GND — they SHARE ground)
```

**DO NOT connect the (+) RED rail to ESP32 VIN.** Ever. While USB is plugged in.

---

## STEP 3: ULN2003 driver module

The green module has these pins along one edge:

```
ULN2003 module pin header:
  IN1  IN2  IN3  IN4  (-)  (+)

And on the other side: white JST socket for motor
```

```
Wire 4: ULN2003 "IN1" → jumper → ESP32 D18  (GPIO 18)
Wire 5: ULN2003 "IN2" → jumper → ESP32 D19  (GPIO 19)
Wire 6: ULN2003 "IN3" → jumper → ESP32 D21  (GPIO 21)
Wire 7: ULN2003 "IN4" → jumper → ESP32 D22  (GPIO 22)
Wire 8: ULN2003 "(+)" → jumper → breadboard (+) RED rail  (5V from adapter)
Wire 9: ULN2003 "(-)" → jumper → breadboard (-) BLUE rail (GND)
```

**Motor:** Just push the 28BYJ-48's white JST plug into the ULN2003's white socket.
It only fits one way. No wires to connect — it's a plug.

---

## STEP 4: Hall sensor module

Your module is **MH-Sensor-Series (KY-024 type)**. Pins (reading from the silkscreen):

```
  AO   DO   GND   VCC
  │    │     │     │
  ↓    ↓     ↓     ↓
```

**Use male-to-female dupont jumpers** (female end plugs onto the module pins):

```
Wire 10: Hall "VCC" → ESP32 "3V3" pin (right side of board)
Wire 11: Hall "GND" → breadboard (-) BLUE rail
Wire 12: Hall "AO"  → ESP32 D34  (GPIO 34, left side of board)
```

**DO NOT connect Hall VCC to 5V.** It must be 3V3. At 3.3V the analog output (AO) stays
within 0–3.3V which is safe for ESP32. At 5V, AO could hit 5V and fry GPIO34.

**Hall "DO" pin:** leave unconnected (we use AO for analog reading — more useful for homing).

---

## STEP 5: Summary — all 12 wires

| Wire # | FROM | TO | Color suggestion |
|---|---|---|---|
| 1 | ESP32 GND (left) | (-) blue rail | BLACK |
| 2 | Barrel jack RED wire | (+) red rail | RED (it already is) |
| 3 | Barrel jack BLACK wire | (-) blue rail | BLACK (it already is) |
| 4 | ULN2003 IN1 | ESP32 D18 | any color |
| 5 | ULN2003 IN2 | ESP32 D19 | any color |
| 6 | ULN2003 IN3 | ESP32 D21 | any color |
| 7 | ULN2003 IN4 | ESP32 D22 | any color |
| 8 | ULN2003 (+) | (+) red rail | RED |
| 9 | ULN2003 (-) | (-) blue rail | BLACK |
| 10 | Hall VCC | ESP32 3V3 | RED or ORANGE |
| 11 | Hall GND | (-) blue rail | BLACK |
| 12 | Hall AO | ESP32 D34 | GREEN or YELLOW |

**Motor: JST plug into ULN2003 socket. No wires.**

---

## STEP 6: Pre-power checklist

```
[ ] ESP32 GND connected to (-) rail? (Wire 1)
[ ] Barrel jack black wire in (-) rail? (Wire 3 — same rail as wire 1)
[ ] Barrel jack red wire in (+) rail? (Wire 2)
[ ] (+) rail is NOT connected to ESP32 VIN? (must be empty!)
[ ] ULN2003 (+) goes to (+) rail? (Wire 8)
[ ] ULN2003 (-) goes to (-) rail? (Wire 9)
[ ] Hall VCC goes to ESP32 3V3, NOT to (+) rail? (Wire 10)
[ ] Hall AO goes to D34? (Wire 12)
[ ] Motor JST plugged into ULN2003?
[ ] No loose wires touching each other?
```

---

## STEP 7: Power on + upload code

**Order matters:**
1. Plug ESP32 into laptop via USB-C cable
2. Open Arduino IDE
3. Select board: **ESP32 Dev Module**
4. Select port: the COM port that appeared (e.g. COM3, COM5)
5. Open `firmware/breadboard_test/breadboard_test.ino`
6. Click Upload (→ arrow)
7. Wait for "Done uploading"
8. Open Serial Monitor (magnifying glass icon), set baud to **115200**
9. Press the **EN** button on ESP32 (tiny button near USB) to restart
10. You should see: `=== Braillix Breadboard Test ===`
11. NOW plug the 5V adapter into the wall (motor gets power)

---

## STEP 8: What to expect

```
[TEST 1] Hall sensor baseline (no magnet):
  hall = 1850    ← some mid-range value (varies by module)
  hall = 1847
  ...

[TEST 2] Spinning CW (512 steps = quarter turn)...
  → Motor shaft should visibly turn ~90 degrees
  → ULN2003 LEDs should flicker in sequence
  Done.

[TEST 3] Spinning CCW (512 steps = quarter turn)...
  → Motor should turn back to where it started
  Done.

[TEST 4] Full CW revolution, printing hall every 64 steps:
  step=0    hall=1850
  step=64   hall=1852
  ...
  → Wave a magnet over the hall sensor while this runs
  → You should see: hall=1850 suddenly jump to hall=3200+ (or drop to 200)
  → That change = the sensor detected the magnet = homing will work!

Entering continuous hall monitor...
  hall=1850
  hall=1849
  (wave magnet)
  hall=3400   ← MAGNET DETECTED
  hall=3380
  (remove magnet)
  hall=1855   ← back to baseline
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens when uploaded | Press EN button. Check Serial Monitor is 115200. |
| "Failed to connect to ESP32" | Hold BOOT button while uploading, release after "Connecting..." |
| Motor buzzes but doesn't spin | Swap pin order in code: try `IN1=18, IN3=19, IN2=21, IN4=22` (swap middle pair). Or check ULN2003 (+) has 5V. |
| Motor doesn't move at all | Check ULN2003 (+) and (-) are connected to adapter rails. Is adapter plugged in? |
| ULN2003 LEDs don't light | Adapter not on, or (+)/(-) reversed. Check polarity! |
| Hall reads 0 always | VCC not connected. Check wire 10 goes to 3V3. |
| Hall reads 4095 always | GND not connected. Check wire 11. |
| Hall doesn't change with magnet | Wrong side of sensor facing magnet. Flip it. Also try getting VERY close (<5mm). |
| ESP32 resets when motor moves | The adapter 5V rail is drooping. Make sure ESP32 is on USB ONLY, not sharing VIN with motor. |

---

## What's next after this works?
1. Keep the motor, cam, magnet, and Hall sensor loose on the bench.
2. Run the fit coupons and mechanism bench test in `PRINT_RELEASE_2026-08-19.md` and
   `MECHANISM_BENCH_TEST.md`; the current production cam/socket and Hall pocket are on HOLD.
3. Write homing firmware: spin until Hall crosses the threshold → that is position 0.
4. Index to any of the 64 cam positions on command.

Do **not** trim the shaft, press or glue the current cam, or glue the Hall sensor into the
production base. Final mechanical assembly waits for the measured stack repair and coupon results.
