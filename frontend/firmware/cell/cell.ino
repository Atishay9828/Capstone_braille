/*
 * Braillix — muscle cell firmware
 * ------------------------------------------------------------------------------------------
 * One braille character module: a 28BYJ-48 stepper turning a 6-track cam, plus a hall sensor for
 * homing. It listens on I2C and does exactly one thing: go to cam position N.
 *
 * From the hardware handoff §5:
 *   motor              28BYJ-48 via ULN2003
 *   steps/revolution   4096 half-steps  (NOT 2048 — 8 half-steps x 64:1 gearbox)
 *   cam positions      64, so 4096 / 64 = 64 half-steps per position
 *   homing             hall sensor + magnet marks cam position 0
 *   I2C address        0x20..0x27, set by solder jumpers on each board
 *
 * The one piece of cleverness here is deliberate: the cell takes the SHORTER way round the cam.
 * Going from position 60 to position 2 is six positions forward, not fifty-eight backward, and the
 * cell is the only part of the system that knows where it currently is — so this is the only place
 * that decision can honestly be made. The laptop-side scheduler computes the same arithmetic to
 * report what the motion costs (app/src/core/scheduler.ts), but the motor obeys this file.
 *
 * Build: Arduino IDE, board = the muscle-cell board (ATmega328P @ 8/16 MHz) or an Arduino Nano for
 * breadboard work. Requires the AccelStepper library.
 */

#include <Wire.h>
#include <AccelStepper.h>

// ---------------------------------------------------------------------------- configuration

/*
 * I2C address. Set by the solder jumpers on the board; read at boot so one binary flashes every
 * cell in the chain. Jumper pins are pulled up, so a closed jumper reads LOW = 1.
 */
static const uint8_t ADDR_BASE = 0x20;
static const uint8_t PIN_ADDR0 = A0;
static const uint8_t PIN_ADDR1 = A1;
static const uint8_t PIN_ADDR2 = A2;

// ULN2003 inputs. HALF4WIRE order is IN1, IN3, IN2, IN4 — swapping these is the classic reason a
// 28BYJ-48 buzzes instead of turning.
static const uint8_t PIN_IN1 = 8;
static const uint8_t PIN_IN2 = 9;
static const uint8_t PIN_IN3 = 10;
static const uint8_t PIN_IN4 = 11;

static const uint8_t PIN_HALL = 2;  // active LOW when the magnet is over the sensor

static const uint16_t HALF_STEPS_PER_REV = 4096;
static const uint8_t CAM_POSITIONS = 64;
static const uint8_t HALF_STEPS_PER_POSITION = HALF_STEPS_PER_REV / CAM_POSITIONS;  // 64

static const float MAX_SPEED = 900.0f;      // half-steps per second
static const float ACCELERATION = 2500.0f;

static const uint8_t CMD_PREFIX = 0xFF;
static const uint8_t CMD_HOME = 0x01;
static const uint8_t CMD_STATUS = 0x02;

enum CellState : uint8_t { STATE_READY = 0, STATE_MOVING = 1, STATE_HOMING = 2, STATE_FAULT = 3 };

// ---------------------------------------------------------------------------- state

AccelStepper motor(AccelStepper::HALF4WIRE, PIN_IN1, PIN_IN3, PIN_IN2, PIN_IN4);

static volatile uint8_t targetPosition = 0;
static volatile bool haveNewTarget = false;
static volatile bool homeRequested = false;

static uint8_t currentPosition = 0;
static bool homed = false;
static CellState state = STATE_HOMING;

// ---------------------------------------------------------------------------- helpers

static uint8_t readAddress() {
  pinMode(PIN_ADDR0, INPUT_PULLUP);
  pinMode(PIN_ADDR1, INPUT_PULLUP);
  pinMode(PIN_ADDR2, INPUT_PULLUP);
  delay(2);
  uint8_t bits = 0;
  if (digitalRead(PIN_ADDR0) == LOW) bits |= 1;
  if (digitalRead(PIN_ADDR1) == LOW) bits |= 2;
  if (digitalRead(PIN_ADDR2) == LOW) bits |= 4;
  return ADDR_BASE + bits;
}

/*
 * Shortest signed distance around the 64-position cam. Ties (exactly half a turn) resolve forward
 * so the behaviour is deterministic — a cell that sometimes goes left and sometimes right for the
 * same command is impossible to debug on a bench.
 *
 * This is the same function as shortestArc() in app/src/core/scheduler.ts. If one changes, change
 * both: the laptop uses it to predict motion cost, the cell uses it to actually move.
 */
static int8_t shortestArc(uint8_t from, uint8_t to) {
  int16_t forward = ((int16_t)to - (int16_t)from + CAM_POSITIONS) % CAM_POSITIONS;
  int16_t backward = forward - CAM_POSITIONS;
  return (int8_t)(forward <= -backward ? forward : backward);
}

/*
 * Find cam position 0. A stepper has no idea where it is at power-up, so we turn until the hall
 * sensor sees the magnet. Bounded to a little over one revolution: if the magnet never appears the
 * sensor or the magnet is missing, and reporting a fault is far better than spinning forever while
 * the display quietly shows nonsense.
 */
static void home() {
  state = STATE_HOMING;
  motor.setCurrentPosition(0);
  motor.setMaxSpeed(MAX_SPEED * 0.6f);

  const long limit = (long)HALF_STEPS_PER_REV + HALF_STEPS_PER_POSITION;
  motor.moveTo(limit);

  while (motor.distanceToGo() != 0) {
    if (digitalRead(PIN_HALL) == LOW) {
      motor.stop();
      motor.setCurrentPosition(0);
      currentPosition = 0;
      homed = true;
      state = STATE_READY;
      motor.setMaxSpeed(MAX_SPEED);
      return;
    }
    motor.run();
  }

  homed = false;
  state = STATE_FAULT;
  motor.setMaxSpeed(MAX_SPEED);
}

static void goTo(uint8_t position) {
  if (position >= CAM_POSITIONS) return;  // refuse rather than wrap into the wrong character
  if (!homed) {
    home();
    if (!homed) return;
  }
  if (position == currentPosition) {
    state = STATE_READY;
    return;
  }

  int8_t delta = shortestArc(currentPosition, position);
  motor.move((long)delta * HALF_STEPS_PER_POSITION);
  currentPosition = position;
  state = STATE_MOVING;
}

// ---------------------------------------------------------------------------- I2C

/*
 * Kept as short as possible: this runs in an interrupt, so it only records intent. All motion
 * happens in loop(). Driving a stepper from inside an ISR is how I2C buses get wedged.
 */
static void onReceive(int count) {
  if (count <= 0) return;
  uint8_t first = Wire.read();

  if (first == CMD_PREFIX) {
    uint8_t command = count > 1 ? Wire.read() : 0;
    if (command == CMD_HOME) homeRequested = true;
    while (Wire.available()) Wire.read();
    return;
  }

  if (first < CAM_POSITIONS) {
    targetPosition = first;
    haveNewTarget = true;
  }
  while (Wire.available()) Wire.read();
}

static void onRequest() {
  Wire.write((uint8_t)state);
}

// ---------------------------------------------------------------------------- lifecycle

void setup() {
  pinMode(PIN_HALL, INPUT_PULLUP);

  motor.setMaxSpeed(MAX_SPEED);
  motor.setAcceleration(ACCELERATION);

  home();

  uint8_t address = readAddress();
  Wire.begin(address);
  Wire.onReceive(onReceive);
  Wire.onRequest(onRequest);
}

void loop() {
  if (homeRequested) {
    homeRequested = false;
    home();
  }

  if (haveNewTarget) {
    haveNewTarget = false;
    goTo(targetPosition);
  }

  motor.run();

  if (state == STATE_MOVING && motor.distanceToGo() == 0) {
    state = STATE_READY;
    // Cut coil current when idle: a 28BYJ-48 held in position gets hot, and a display spends most
    // of its life not moving.
    motor.disableOutputs();
  }
}
