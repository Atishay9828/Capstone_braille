# Braillix — Software Team Brief

> What you need to know about the hardware to write the firmware/software. Skip the mechanical stuff — this is all about interfaces, constraints, and what **you** have to handle in code.

---

## 1. What the Device Is (30 seconds)

A modular refreshable Braille display. Each **cell** displays one Braille character (6 dots). Cells can:

- Run **standalone** (one cell, one ESP32 pod) — e.g. a single-character indicator
- Be **daisy-chained** into a multi-cell row (e.g. 4 cells = 4 Braille characters side by side)

The **ESP32 Brain Pod** is a separate box that plugs into the cell chain. It's the brain — it runs your code, handles WiFi/BLE, reads the nav buttons, and tells each cell what character to show.

---

## 2. System Topology

```
[Power/USB]
     |
[ESP32 Brain Pod]  ←→  WiFi / BLE / USB
     |
  (pogo pins, I2C + 5V)
     |
[Cell 1] ── (pogo pins) ── [Cell 2] ── (pogo pins) ── [Cell 3] ── ...
```

- The pod connects to **Cell 1's left side** via magnetic pogo pins (snap on, snap off)
- Cells chain **right-to-left**: Cell 1 right side → Cell 2 left side → etc.
- Power **and** I2C travel through the whole chain on the same 4-wire pogo connection (5V, GND, SDA, SCL)
- The pod is the **only I2C master**. Each cell is a slave with a unique address.

---

## 3. The Motor Problem — Read This Carefully

Each cell has one **28BYJ-48 stepper motor** driven by a **ULN2003 driver IC**.

### The ULN2003 is dumb.
It is a simple transistor array. It has **no position feedback, no current control, no speed regulation**. It just switches coils on and off based on your GPIO signals. That's it.

**This means software is responsible for:**

| Responsibility | Why |
|---|---|
| Sending the correct coil sequence (IN1–IN4) | Motor won't move or will stutter if sequence is wrong |
| Step timing / speed | Too fast → motor stalls and loses position silently |
| Acceleration ramp | Stepping from 0 to full speed instantly = stall |
| Knowing current position | There is no encoder. You track steps yourself. |
| Homing on startup | Without homing, you don't know where character 0 is |

### Step Sequence (Half-step, recommended)

```
Step | IN1 | IN2 | IN3 | IN4
-----|-----|-----|-----|----
  1  |  1  |  0  |  0  |  0
  2  |  1  |  1  |  0  |  0
  3  |  0  |  1  |  0  |  0
  4  |  0  |  1  |  1  |  0
  5  |  0  |  0  |  1  |  0
  6  |  0  |  0  |  1  |  1
  7  |  0  |  0  |  0  |  1
  8  |  1  |  0  |  0  |  1
```

Repeat this 8-step cycle. Start with a nominal 4096 half-steps per output revolution, then
replace it with the owned motor's measured Hall-midpoint-to-midpoint count before production.

### Speed Guideline

- **Start**: ~2 ms per step (500 steps/sec)
- **Max**: ~1 ms per step (1000 steps/sec) — push past this and it stalls
- **Ramp**: Increase speed over the first 100–200 steps, decelerate before stopping
- **ALWAYS de-energise coils** after positioning (set all IN pins LOW) — holding current heats the motor and wastes power

### Characters → Steps

The cam disc has 64 positions (one per Braille character). One full revolution = 64 characters.

```
nominal_steps_per_character = 4096 / 64 = 64 half-steps
target_steps = character_index × 64
```

Always take the **shortest path** (clockwise or counter-clockwise) to minimise travel time.

---

## 4. Homing (Hall Effect Sensor)

Each cell has one Hall effect sensor on the base plate. The cam disc has a magnet. When they align → **that is character 0 (blank/space)**.

**On every power-up:**

```
1. Rotate motor slowly CW
2. Poll Hall sensor GPIO (active LOW — goes LOW when magnet passes)
3. When LOW detected → stop → this is home (step_count = 0)
4. Now you know where every character is
```

Without homing, the motor has no idea where it is and will display garbage.

**Hall sensor GPIO**: Digital input, active LOW, enable internal pull-up.

---

## 5. I2C Protocol (You Define This)

We haven't locked a protocol — that's your call. Suggested minimum:

```
Write (display a character):
  Master → [cell_address] [char_code_0–63]

Read (get status):
  Master reads [cell_address]
  Cell responds → [current_char] [status]
    status bits: bit0 = homed, bit1 = busy/moving, bit2 = error

Broadcast (all cells at once):
  Address 0x00 → all cells update simultaneously
```

### Cell Addressing

Cells need unique I2C addresses. Options:
- **Hardware jumpers** on cell PCB (e.g. 3 jumper pads = 8 addresses, 0x20–0x27)
- **Sequential assignment at boot**: pod enumerates cells at startup, assigns addresses dynamically

---

## 6. Navigation Buttons (on the Pod)

Three tactile buttons on the front of the ESP32 pod. The symbols are physically raised so a blind user can find them by touch:

| Button | Symbol | Suggested Function |
|---|---|---|
| Left | ◁ triangle | Previous / scroll back |
| Middle | ○ ring | Select / confirm |
| Right | ▷ triangle | Next / scroll forward |

**GPIO**: Active LOW, internal pull-up, debounce 20–50 ms in firmware.

These are just GPIO inputs on the ESP32. Wire them up however suits your UI logic.

---

## 7. Power

- Input: 5V via barrel jack on the pod
- 5V is distributed to all chained cells through the pogo connectors
- Each motor draws ~200 mA while stepping, ~0 when idle (de-energise coils!)
- Size your power supply: **200 mA × number of cells + 200 mA for ESP32**
- Example: 4-cell display → 5V @ 1A minimum, 2A recommended

---

## 8. Standalone vs Chained — What Changes in Software

| Mode | Setup | Notes |
|---|---|---|
| Standalone | 1 pod + 1 cell | Pod drives one cell directly. Simple. |
| Chained | 1 pod + N cells | Pod is I2C master. Each cell is a slave. Pod sends char codes to each address. |

The mechanical connection is the same in all cases — cells snap together magnetically. Software just needs to know how many cells are in the chain and address them accordingly.

**Tip**: On startup, scan the I2C bus to auto-detect how many cells are connected. No hard-coding needed.

---

## 9. What Software Needs to Build

### Per-Cell Firmware (runs on each cell's MCU if standalone, or on pod for simple chains)
- [ ] Hall sensor homing routine
- [ ] Stepper motor driver (half-step sequence, speed ramp, position tracking)
- [ ] Character-to-step-position lookup
- [ ] I2C slave handler (receive char code, update display)
- [ ] Coil de-energise after move

### Pod Firmware (ESP32)
- [ ] I2C master
- [ ] Cell discovery / addressing at boot
- [ ] Nav button GPIO handler with debounce
- [ ] WiFi/BLE interface (receive text to display)
- [ ] Text → Braille character code conversion (Grade 1 lookup table)
- [ ] Send character codes to correct cell addresses

### Nice to Have
- [ ] Speed/acceleration profile tuning per cell
- [ ] Error recovery (stall detection via timeout)
- [ ] Over-I2C firmware update for cells

---

## 10. Braille Encoding (Quick Reference)

6 bits = 1 Braille character. Bit 0 is dot 1 (top-left), bit 5 is dot 6 (bottom-right).

```
Dot layout:    Bit mapping:
  1  4           bit0  bit3
  2  5    →      bit1  bit4
  3  6           bit2  bit5
```

Standard Grade 1 mapping (partial):

| Char | Code | Char | Code | Char | Code |
|---|---|---|---|---|---|
| (space) | 0b000000 | a | 0b000001 | b | 0b000011 |
| c | 0b001001 | d | 0b011001 | e | 0b010001 |
| f | 0b001011 | g | 0b011011 | h | 0b010011 |
| i | 0b001010 | j | 0b011010 | k | 0b000101 |

Full table: [Braille ASCII / Unicode Braille standard](https://www.unicode.org/faq/braille.html)

---

*Questions about the hardware? Ping the mechanical team. Questions about the protocol design? That's on you — we've left it open intentionally so you can optimise for your stack.*
