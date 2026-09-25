# Braillix v6.1 — Wiring & Assembly Guide

> **CURRENT RELEASE GATE - 2026-08-19:** The wiring tables remain useful, but the historical full
> assembly sequence is retired. Do not trim the shaft, press the current cam, use bearing balls,
> drop springs into the PETG top plate, or install unretained pogo/header hardware. Use
> `PRINT_RELEASE_2026-08-19.md`, `ASSEMBLY_BIBLE.md`, and `MECHANISM_BENCH_TEST.md` as the current
> authority.

## Prototype Cell Electronics (no muscle board yet) — ULN2003 module fit

The off-the-shelf ULN2003 driver module DOES fit the 36×46×14mm electronics pocket,
**but only with low-profile wiring** (measured: ~20mm tall with vertical Dupont jumpers
plugged in — too tall; ~12mm with wires soldered flat):

1. Cut the female Dupont housings off 6 jumper wires (IN1–IN4, +5V, GND); strip ~3mm.
2. Solder each wire **flat against its header pin, lying parallel to the board** (bend the
   wire 90° at the pin base, then solder). Beginner-level joint — tin pin, tin wire, touch.
3. Press the ULN2003 DIP chip fully down into its socket (it often sits raised).
4. Lay the board **flat on the pocket floor** (NOT on the 4mm muscle-board bosses), with the
   JST/header edge toward the **front-right (+X, −Y) corner** — the mid-plate has a relief
   slot there (v6.1) giving the JST plug extra headroom.
5. The white JST motor plug inserts before the mid-plate goes in.

When the custom muscle board is fabricated later, it mounts on the 4 M2 bosses as designed.


## Pogo Daisy-Chain Pinout (4-pin, same everywhere)
```
Pin 1 = +5V    Pin 2 = GND    Pin 3 = SDA    Pin 4 = SCL
```
```
[5V/3A adapter]
      |
      v
+-----------+   pogo    +--------+   pogo    +--------+
| BRAIN POD |<--------->| CELL 1 |<--------->| CELL 2 |-->...-->[end cap]
| (ESP32)   | 4 wires   |        | 4 wires   |        |
| I2C master| 5V/GND/   | I2C    |           | I2C    |
| + buttons | SDA/SCL   | slave  |           | slave  |
+-----------+           | 0x20   |           | 0x21   |
                        +--------+           +--------+
```

## Per-Cell Wiring (Muscle Board Connectors)

| Connector | Pins | From | Color | Routing |
|---|---|---|---|---|
| J1 (pogo) | 4: 5V,GND,SDA,SCL | Both pogo connectors (bridged) | Red,Black,Blue,Yellow | Down wall guides -> mid-plate notches -> pocket |
| J2 (motor) | 5: coils A-D + COM | 28BYJ-48 (JST-XH plug) | White 5-pin | Motor slot (x=-8,y=20) -> pocket |
| J3 (hall) | 3: VCC,GND,SIG | SS49E hall sensor | Red,Black,Green | Base plate +Y channel -> mid-plate +Y notch -> pocket |
| J4 (ISP) | 6 | AVR programmer | 2x3 ribbon | Temporary - remove after flashing |

Wire count per cell: **12 permanent** (4 pogo + 5 motor + 3 hall)

### Pogo Bridge (inside each cell)
Each cell has -X springs and +X pads. Bridge both to J1 (3-way splice per net):
```
-X pogo spring --+-- J1 pin --+-- +X pogo pad
                 (same for all 4 nets)
```

## ESP32 Brain Pod Wiring

| Net | ESP32 Pin | Notes |
|---|---|---|
| I2C SDA | GPIO21 | -> dock pogo pin 3 |
| I2C SCL | GPIO22 | -> dock pogo pin 4 |
| 5V in | VIN | from barrel jack (+) |
| GND | GND | barrel(-), dock pin2, button common |
| BACK | GPIO32 | tactile switch, INPUT_PULLUP, active-LOW |
| SELECT | GPIO33 | tactile switch, INPUT_PULLUP, active-LOW |
| NEXT | GPIO25 | tactile switch, INPUT_PULLUP, active-LOW |
| Buzzer | GPIO26 | optional piezo |
| SDA pull-up | 3V3 -> 4.7k -> SDA | master end only |
| SCL pull-up | 3V3 -> 4.7k -> SCL | master end only |

Pod wire count: **10 wires** (2 barrel, 4 pogo, 3 buttons+GND, 1 buzzer)

No level shifter needed: ESP32 3.3V open-drain I2C works with 5V ATmega (reads >2.0V as HIGH).

## Power Budget
```
Per cell:  motor 240mA + ATmega 20mA + hall 5mA = ~265mA
5 cells:   1.325A
ESP32:     ~80mA
Total:     ~1.4A    5V/3A adapter = 2x headroom
```

## Mechanical assembly status - HOLD

### Cell

The cell cannot be assembled as a final product from the current source:

- the cam socket is only 3.5mm deep for the measured 7.5mm shaft;
- the cam/linkage/spring motion and torque have not passed the real bench test;
- the cell pogo windows have no measured carrier or retention geometry;
- the ULN2003 has no positive board retainer in its pocket;
- insert, motor-pilot, Hall, magnet, and standoff fits are coupon-gated.

For now, keep electronics on the breadboard and print only the checked coupons/fixture. Never trim
the shaft. The resin design integrates each 1.5mm dome into its linkage; there are no bearing balls.
The 2mm OD spring twists over the dome, seats on the linkage flange, and enters the resin dot-insert
counterbore; it is not dropped or glued into the PETG top plate.

### Pod

The pod shell also remains on HOLD. Standard 1x15 female headers have downward solder tails, but the
current shell provides only 1mm-deep blind body channels and no tail/wire exits. The dock pad recess
also has no measured pad retainer or lead route. Do not print the full pod until the exact headers
and dock contacts are selected and those paths are designed/tested.

The owned inline power pigtail is the current connector choice: its body remains outside, only the
two insulated leads pass through the coupon-selected lid slot, and the cable ties to the internal
post before termination. The red lead was measured centre-positive on 2026-08-01.
## Quick Reference
```
POGO:     1=5V  2=GND  3=SDA  4=SCL
CELL J1:  Red=5V  Black=GND  Blue=SDA  Yellow=SCL
CELL J2:  White 5-pin JST (plug in)
CELL J3:  Red=VCC  Black=GND  Green=SIG
BUTTONS:  GPIO32=BACK  GPIO33=SELECT  GPIO25=NEXT
I2C:      GPIO21=SDA  GPIO22=SCL  (4.7k to 3V3)
ADDRESSES: 0x20..0x27 (solder jumpers PB0-PB2)
BOLT:     M2.5x25 x4 per cell (top->standoff->base->boss)
```
