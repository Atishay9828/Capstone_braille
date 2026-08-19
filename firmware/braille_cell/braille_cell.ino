/*
 * Braillix — bare-motor letter test
 *
 * Type a letter (or a word) in the Serial Monitor and the cam turns to that
 * character's state. No linkages, no cell, no disc required: this proves the
 * ESP32, the ULN2003, the motor, the encoding and the homing path all work
 * before any of it is bolted to a mechanism.
 *
 * Board:     ESP32 Dev Module (30-pin, USB-C)
 * Library:   AccelStepper (Mike McCauley) — Library Manager
 * Serial:    115200 baud, "Newline" line ending
 *
 * Deliberately no WiFi and no OTA. secrets.h is not needed. The point of this
 * sketch is the shortest possible path to a turning motor.
 *
 * Wiring (identical to docs/BREADBOARD_STEP_BY_STEP.md):
 *   ULN2003 IN1 -> GPIO 18       ULN2003 (+) -> 5V rail (adapter)
 *   ULN2003 IN2 -> GPIO 19       ULN2003 (-) -> GND rail
 *   ULN2003 IN3 -> GPIO 21       Hall AO     -> GPIO 34
 *   ULN2003 IN4 -> GPIO 22       Hall VCC    -> 3V3, Hall GND -> GND
 *   ESP32 GND   -> GND rail  <-- the one wire that must not be missed
 */

#include <AccelStepper.h>

#define IN1 18
#define IN2 19
#define IN3 21          // NOTE: GPIO21/22 are the default I2C pins. Fine now;
#define IN4 22          // must move before the MCP23017 goes in (multi-cell).
#define HALL_PIN 34

AccelStepper stepper(AccelStepper::HALF4WIRE, IN1, IN3, IN2, IN4);

// --- from sim/3d/braillix_params.json — keep these in step with the simulator ---
const int STEPS_PER_REV = 4096;   // 28BYJ-48 half-steps, 64:1 gearbox
const int STEPS_PER_POS = 64;     // one of 64 cam states
const int DWELL_OFFSET  = 32;     // land MID-dwell, not on a ramp edge

// bit = DOT_TO_BIT[dot]; dot 1->3, 2->2, 3->1, 4->4, 5->5, 6->0
const uint8_t DOT_TO_BIT[7] = {0, 3, 2, 1, 4, 5, 0};

// Grade-1 braille a-z, as dot lists. Same table as sim/3d/app.js:23.
const uint8_t LETTER_DOTS[26][6] PROGMEM = {
  {1,0,0,0,0,0}, {1,2,0,0,0,0}, {1,4,0,0,0,0}, {1,4,5,0,0,0}, {1,5,0,0,0,0},
  {1,2,4,0,0,0}, {1,2,4,5,0,0}, {1,2,5,0,0,0}, {2,4,0,0,0,0}, {2,4,5,0,0,0},
  {1,3,0,0,0,0}, {1,2,3,0,0,0}, {1,3,4,0,0,0}, {1,3,4,5,0,0}, {1,3,5,0,0,0},
  {1,2,3,4,0,0}, {1,2,3,4,5,0}, {1,2,3,5,0,0}, {2,3,4,0,0,0}, {2,3,4,5,0,0},
  {1,3,6,0,0,0}, {1,2,3,6,0,0}, {2,4,5,6,0,0}, {1,3,4,6,0,0}, {1,3,4,5,6,0},
  {1,3,5,6,0,0}
};

const int HALL_THRESHOLD = 500;   // analogRead below this = magnet present
bool homed = false;

// --- encoding -------------------------------------------------------------

int cellToState(char c) {
  if (c == ' ') return 0;
  if (c < 'a' || c > 'z') return -1;
  int state = 0;
  for (int i = 0; i < 6; i++) {
    uint8_t dot = pgm_read_byte(&LETTER_DOTS[c - 'a'][i]);
    if (dot == 0) break;
    state |= (1 << DOT_TO_BIT[dot]);
  }
  return state;
}

int stateToStep(int state) {
  return state * STEPS_PER_POS + DWELL_OFFSET;
}

// Shortest path: wrap the target to the nearest equivalent of where we are.
// Matches the simulator's gotoIndex(). Without this, 63 -> 0 spins 354 degrees
// the wrong way instead of stepping 5.6 degrees back.
long shortestTarget(long current, int wantStep) {
  long diff = ((wantStep - current) % STEPS_PER_REV + STEPS_PER_REV * 3 / 2)
              % STEPS_PER_REV - STEPS_PER_REV / 2;
  return current + diff;
}

// --- motion ---------------------------------------------------------------

void runToTarget() {
  while (stepper.distanceToGo() != 0) stepper.run();
}

void releaseCoils() {                 // stop cooking the motor while idle
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void showChar(char c) {
  int state = cellToState(c);
  if (state < 0) { Serial.printf("  skip '%c' (a-z and space only)\n", c); return; }

  long from   = stepper.currentPosition();
  long target = shortestTarget(from, stateToStep(state));
  long delta  = target - from;

  Serial.printf("  '%c'  dots ", c == ' ' ? '_' : c);
  if (c == ' ') Serial.print("(none)  ");
  else {
    for (int i = 0; i < 6; i++) {
      uint8_t d = pgm_read_byte(&LETTER_DOTS[c - 'a'][i]);
      if (d == 0) break;
      Serial.printf("%d", d);
    }
    Serial.print("  ");
  }
  Serial.printf("state %2d  step %4d  move %+5ld (%s)  %.1f deg\n",
                state, stateToStep(state), delta,
                delta >= 0 ? "CW " : "CCW", delta * 360.0 / STEPS_PER_REV);

  stepper.moveTo(target);
  runToTarget();
  stepper.setCurrentPosition(((target % STEPS_PER_REV) + STEPS_PER_REV) % STEPS_PER_REV);
  releaseCoils();
}

// Look for the homing magnet. There is no cam disc yet, so this MUST NOT hang.
void tryHome() {
  Serial.println("Homing: looking for the magnet (one revolution max)...");
  stepper.setCurrentPosition(0);
  stepper.moveTo(STEPS_PER_REV);
  int best = 4095; long bestAt = 0;
  while (stepper.distanceToGo() != 0) {
    stepper.run();
    int v = analogRead(HALL_PIN);
    if (v < best) { best = v; bestAt = stepper.currentPosition(); }
  }
  releaseCoils();
  if (best < HALL_THRESHOLD) {
    Serial.printf("  magnet found at step %ld (reading %d). Zero set there.\n", bestAt, best);
    stepper.setCurrentPosition(((stepper.currentPosition() - bestAt) % STEPS_PER_REV
                                + STEPS_PER_REV) % STEPS_PER_REV);
    homed = true;
  } else {
    Serial.printf("  no magnet (best reading %d, need < %d).\n", best, HALL_THRESHOLD);
    Serial.println("  EXPECTED right now — there is no disc on the shaft yet.");
    Serial.println("  Treating the current position as zero. Motion still works.");
    stepper.setCurrentPosition(0);
    homed = false;
  }
}

void help() {
  Serial.println();
  Serial.println("Type a letter or a word, then Enter.  Examples:  a    hello    cab");
  Serial.println("Commands:  !home   re-run homing");
  Serial.println("           !zero   call this position step 0");
  Serial.println("           !hall   print the hall reading");
  Serial.println("           !spin   one full revolution, to eyeball direction");
  Serial.println("           !help   this list");
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  delay(600);
  Serial.println("\n=== Braillix bare-motor letter test ===");
  Serial.printf("%d steps/rev, %d steps/state, +%d mid-dwell offset\n",
                STEPS_PER_REV, STEPS_PER_POS, DWELL_OFFSET);

  pinMode(HALL_PIN, INPUT);
  stepper.setMaxSpeed(700);      // 28BYJ-48 loses torque past ~1000 half-steps/s
  stepper.setAcceleration(500);  // must ramp; commanding full speed cold = stall

  tryHome();
  help();
  Serial.print("> ");
}

void loop() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  line.toLowerCase();
  if (line.length() == 0) { Serial.print("> "); return; }

  if (line.startsWith("!")) {
    if      (line == "!home") tryHome();
    else if (line == "!zero") { stepper.setCurrentPosition(0); Serial.println("  zero set."); }
    else if (line == "!hall") Serial.printf("  hall = %d\n", analogRead(HALL_PIN));
    else if (line == "!spin") {
      Serial.println("  one revolution...");
      stepper.moveTo(stepper.currentPosition() + STEPS_PER_REV);
      runToTarget(); releaseCoils();
      stepper.setCurrentPosition(stepper.currentPosition() % STEPS_PER_REV);
      Serial.println("  done.");
    }
    else help();
  } else {
    for (unsigned i = 0; i < line.length(); i++) {
      showChar(line[i]);
      delay(500);                 // hold each letter long enough to see it
    }
  }
  Serial.print("> ");
}
