# Braillix — Breadboard Bring-Up (NO SOLDER)

Goal: prove ONE cell's electronics work before any permanent build.
ESP32 drives 28BYJ-48 via ULN2003, reads hall sensor for homing. No buttons this round.

---

## Parts used
- ESP32 DevKit (USB-C, ~30-pin)
- ULN2003 driver module (green) + 28BYJ-48 stepper (plugs in via JST — no solder)
- Hall sensor module (blue PCB) — **TYPE TO BE CONFIRMED** (see warning below)
- 5V/3A adapter + black inline female DC pigtail jack (red/black wires)
- Breadboard + dupont jumper wires
- Resistors (only if hall module is a 5V type — see warning)

---

## ⚠️ READ BEFORE POWERING ON

1. **ESP32 GPIO pins are NOT 5V tolerant.** If the hall module runs on 5V and outputs 5V,
   connecting it straight to a GPIO can damage the ESP32. Confirm the module's voltage first.
2. **Verify pigtail polarity with a multimeter.** Do not trust red/black wire colour alone.
   Reverse polarity will kill the ULN2003 and possibly the ESP32.
3. **Common ground:** ESP32 GND must connect to the adapter GND rail. Without it, nothing works.
4. **Do NOT connect the 5V rail to ESP32 VIN while USB is plugged in** (back-feed). USB powers
   the ESP32; the adapter powers only the motor.

---

## Power wiring (solderless)

```
Wall → 5V/3A adapter → black inline female pigtail
                          │  (two stripped wires)
                  ┌───────┴────────┐
              +5V wire          GND wire
                  │                 │
            breadboard          breadboard
             "+" rail            "-" rail
                  │                 │
        ULN2003 "+"        ULN2003 "-"  ── also to ── ESP32 GND
                                                       │
                                          ESP32 powered by USB-C (laptop)
```

## Signal wiring

| ULN2003 / Hall pin | → ESP32 pin |
|---|---|
| IN1 | GPIO 18 |
| IN2 | GPIO 19 |
| IN3 | GPIO 21 |
| IN4 | GPIO 22 |
| ULN2003 "+" | +5V rail (from adapter) |
| ULN2003 "-" | GND rail |
| Motor | JST plug → ULN2003 socket |
| Hall VCC | 3V3 (preferred) — see warning |
| Hall GND | GND rail |
| Hall OUT/AO | GPIO 34 |

### Hall connection — pick the case that matches your module
- **3.3V analog/digital module** → VCC to ESP32 3V3, OUT direct to GPIO34. No resistor.
- **5V module** → use a divider so GPIO34 never sees >3.3V:
  ```
  Hall OUT ──[ R1 10k ]──┬── GPIO 34
                         │
                      [ R2 20k ]
                         │
                        GND
  ```
- **Open-collector, no onboard pull-up** → run at 3.3V, add 10k pull-up OUT→3V3.

(GPIO34 has no internal pull-up — any pull-up must be external.)

---

## Test sketch (Arduino IDE, ESP32 board package)

Install: Arduino IDE → Boards Manager → "esp32" by Espressif. Library: "CheapStepper" (or
AccelStepper). Select board "ESP32 Dev Module", pick the COM port.

```cpp
// Braillix breadboard test — motor + hall
#include <CheapStepper.h>

// 28BYJ-48 via ULN2003. CheapStepper wants IN1,IN2,IN3,IN4 in board order.
CheapStepper stepper(18, 19, 21, 22);

const int HALL_PIN = 34;
bool analogHall = true;  // set false if your module is digital (DO)

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("Braillix breadboard test");
  stepper.setRpm(12);            // gentle
  pinMode(HALL_PIN, INPUT);      // GPIO34: no pull-up available
}

void loop() {
  // 1) Read hall continuously
  int h = analogHall ? analogRead(HALL_PIN) : digitalRead(HALL_PIN);
  Serial.print("hall="); Serial.print(h);

  // 2) Spin a quarter turn CW (2048 steps = full rev half-step)
  Serial.println("  -> step CW");
  for (int i = 0; i < 512; i++) stepper.step(true);
  delay(500);

  // 3) Quarter turn CCW
  for (int i = 0; i < 512; i++) stepper.step(false);
  delay(500);
}
```

### Milestones
1. Upload blinks/serial OK → board + port confirmed.
2. Motor spins CW then CCW, ULN2003's 4 LEDs cycle.
3. Wave a magnet over the hall → `hall=` value (analog) jumps, or flips 1↔0 (digital).
4. Homing: spin slowly until hall crosses a threshold, set that as step 0.

### If the ESP32 resets when the motor moves
The motor is pulling the rail down. Keep ESP32 on USB only, motor on the adapter, GND shared —
never run ESP32 off the same 5V rail as the motor under load.

---

## Status
**Awaiting cross-agent component ID** (Codex + Antigravity) — see the audit artifact's
"Breadboard Bring-Up Review" section. Confirm the hall module type and resistor values from
close-up photos BEFORE powering on.
