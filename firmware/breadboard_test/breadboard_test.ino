/*
 * Braillix Breadboard Test v3 — AccelStepper + WiFi + OTA
 *
 * Board:     ESP32 Dev Module (USB-C, 30-pin)
 * Libraries: AccelStepper (by Mike McCauley)
 *            WiFi, WebServer, ArduinoOTA (all built-in)
 *
 * FIRST upload: via USB cable (to get OTA on the board).
 * EVERY upload after that: wireless from Arduino IDE!
 *   Tools -> Port -> pick "Braillix (192.168.x.x)" instead of COMx.
 *
 * After upload, unplug USB. Power ESP32 from 5V adapter via VIN.
 * Open http://<IP shown on serial> in any browser on same WiFi.
 * The page auto-refreshes with live hall + motor data.
 *
 * Wiring:
 *   ULN2003 IN1 -> GPIO 18
 *   ULN2003 IN2 -> GPIO 19
 *   ULN2003 IN3 -> GPIO 21
 *   ULN2003 IN4 -> GPIO 22
 *   Hall AO     -> GPIO 34 (analog read)
 *   Hall VCC    -> 3V3
 *   Hall GND    -> GND
 *   ULN2003 (+) -> 5V rail (from adapter)
 *   ULN2003 (-) -> GND rail (shared with ESP32)
 *   ESP32 VIN   -> 5V rail (from adapter)  <-- powers ESP32 without USB
 *   ESP32 GND   -> GND rail
 */

#include <AccelStepper.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoOTA.h>

// ========== WIFI CREDENTIALS ==========
// Values live in secrets.h, which is GITIGNORED and never committed.
// First time on a new machine: copy secrets.example.h -> secrets.h and edit it.
#include "secrets.h"
const char* WIFI_SSID = WIFI_SSID_VALUE;   // 2.4GHz network (ESP32 can't do 5GHz)
const char* WIFI_PASS = WIFI_PASS_VALUE;
// ======================================

// --- Pin definitions ---
#define IN1 18
#define IN2 19
#define IN3 21
#define IN4 22
#define HALL_PIN 34

// AccelStepper: HALF4WIRE mode, pin order IN1, IN3, IN2, IN4
AccelStepper stepper(AccelStepper::HALF4WIRE, IN1, IN3, IN2, IN4);

// Web server on port 80
WebServer server(80);

// 28BYJ-48 nominal half-steps per output revolution. The real gearbox ratio varies;
// measure Hall-midpoint to Hall-midpoint on the owned motor before final operation.
const int STEPS_PER_REV = 4096;
const int CAM_POSITIONS = 64;
const long CAM_DWELL_OFFSET_STEPS = STEPS_PER_REV / (CAM_POSITIONS * 2);

long camDwellTargetStep(int position) {
  // Each cam state has a ramp followed by a flat dwell. Homing defines the start
  // of state 0; adding half a state pitch stops at the dwell centre, not mid-ramp.
  return (long)position * STEPS_PER_REV / CAM_POSITIONS + CAM_DWELL_OFFSET_STEPS;
}

// Homing thresholds
const int HALL_HOME = 500;
const int HALL_AWAY = 3500;

// --- State ---
String logBuffer = "";        // Stores log messages for web page
int currentHall = 0;
long currentPos = 0;
bool isHomed = false;
long homePosition = 0;
String currentStatus = "Idle";
bool testRunning = false;
int currentTest = 0;

// --- Log helper (stores for web + prints to serial) ---
void log(String msg) {
  Serial.println(msg);
  logBuffer += msg + "\n";
  // Keep buffer from getting too large
  if (logBuffer.length() > 4000) {
    logBuffer = logBuffer.substring(logBuffer.length() - 3000);
  }
}

// ============================================================
// WEB PAGE — auto-refreshing dashboard
// ============================================================
void handleRoot() {
  int hall = analogRead(HALL_PIN);
  long pos = stepper.currentPosition();

  String html = R"rawhtml(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Braillix</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee;
           max-width: 600px; margin: 0 auto; padding: 16px; }
    h1 { color: #e94560; margin-bottom: 4px; }
    .subtitle { color: #888; margin-bottom: 20px; }
    .card { background: #16213e; border-radius: 12px; padding: 16px; margin: 12px 0;
            border: 1px solid #0f3460; }
    .label { color: #888; font-size: 13px; text-transform: uppercase; }
    .value { font-size: 32px; font-weight: bold; color: #e94560; }
    .value.green { color: #4ecca3; }
    .row { display: flex; gap: 12px; }
    .row .card { flex: 1; }
    .log { background: #0d1117; border-radius: 8px; padding: 12px;
           font-family: 'Consolas', monospace; font-size: 12px; color: #8b949e;
           max-height: 300px; overflow-y: auto; white-space: pre-wrap; }
    .btn { background: #e94560; color: white; border: none; border-radius: 8px;
           padding: 12px 24px; font-size: 16px; cursor: pointer; margin: 4px; }
    .btn:hover { background: #c73650; }
    .btn.green { background: #4ecca3; color: #1a1a2e; }
    .btn.blue { background: #0f3460; }
    .controls { text-align: center; margin: 16px 0; }
    .pos-input { background: #0d1117; border: 2px solid #0f3460; border-radius: 8px;
                 color: #eee; padding: 10px; font-size: 16px; width: 80px; text-align: center; }
    .status { color: #4ecca3; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Braillix</h1>
  <div class="subtitle">Breadboard Test v3 — Live Monitor</div>

  <div class="row">
    <div class="card">
      <div class="label">Hall Sensor</div>
      <div class="value" id="hall">)rawhtml";

  html += String(hall);
  html += R"rawhtml(</div>
      <div class="label" id="hallState">)rawhtml";
  html += (hall < HALL_HOME) ? "MAGNET DETECTED" : "No magnet";
  html += R"rawhtml(</div>
    </div>
    <div class="card">
      <div class="label">Motor Position</div>
      <div class="value green" id="pos">)rawhtml";
  html += String(pos);
  html += R"rawhtml(</div>
      <div class="label">step</div>
    </div>
  </div>

  <div class="card">
    <div class="label">Status</div>
    <div class="status" id="status">)rawhtml";
  html += currentStatus;
  html += R"rawhtml(</div>
  </div>

  <div class="controls">
    <button class="btn" onclick="send('/cw')">CW 90&deg;</button>
    <button class="btn" onclick="send('/ccw')">CCW 90&deg;</button>
    <button class="btn green" onclick="send('/fullrev')">Full Rev</button>
    <button class="btn blue" onclick="send('/home')">Home</button>
    <button class="btn blue" onclick="send('/runall')">Run All Tests</button>
    <br><br>
    <label class="label">Go to cam position (0-63): </label>
    <input type="number" id="posInput" class="pos-input" min="0" max="63" value="0">
    <button class="btn" onclick="goTo()">Go</button>
  </div>

  <div class="card">
    <div class="label">Log</div>
    <div class="log" id="log">)rawhtml";
  html += logBuffer;
  html += R"rawhtml(</div>
  </div>

  <script>
    function send(path) { fetch(path).then(()=>update()); }
    function goTo() { send('/goto?pos=' + document.getElementById('posInput').value); }
    function update() {
      fetch('/data').then(r=>r.json()).then(d => {
        document.getElementById('hall').textContent = d.hall;
        document.getElementById('pos').textContent = d.pos;
        document.getElementById('status').textContent = d.status;
        document.getElementById('hallState').textContent = d.hall < 500 ? 'MAGNET DETECTED' : 'No magnet';
        document.getElementById('log').textContent = d.log;
        document.getElementById('log').scrollTop = 99999;
      });
    }
    setInterval(update, 500);
  </script>
</body>
</html>
)rawhtml";

  server.send(200, "text/html", html);
}

// JSON endpoint for live updates
void handleData() {
  int hall = analogRead(HALL_PIN);
  // Escape log for JSON (replace newlines and quotes)
  String escapedLog = logBuffer;
  escapedLog.replace("\\", "\\\\");
  escapedLog.replace("\"", "\\\"");
  escapedLog.replace("\n", "\\n");
  escapedLog.replace("\r", "");

  String json = "{\"hall\":" + String(hall)
    + ",\"pos\":" + String(stepper.currentPosition())
    + ",\"status\":\"" + currentStatus + "\""
    + ",\"log\":\"" + escapedLog + "\""
    + "}";
  server.send(200, "application/json", json);
}

// --- Command handlers ---
void handleCW() {
  log("[CMD] CW nominal 90 degrees");
  currentStatus = "Spinning CW...";
  stepper.move(STEPS_PER_REV / 4);
  server.send(200, "text/plain", "OK");
}

void handleCCW() {
  log("[CMD] CCW nominal 90 degrees");
  currentStatus = "Spinning CCW...";
  stepper.move(-STEPS_PER_REV / 4);
  server.send(200, "text/plain", "OK");
}

void handleFullRev() {
  log("[CMD] Full nominal revolution (" + String(STEPS_PER_REV) + " steps)");
  currentStatus = "Full revolution...";
  stepper.move(STEPS_PER_REV);
  server.send(200, "text/plain", "OK");
}

void handleGoTo() {
  if (server.hasArg("pos")) {
    int pos = server.arg("pos").toInt();
    if (pos >= 0 && pos < 64) {
      long targetStep = camDwellTargetStep(pos);
      log("[CMD] Go to cam position " + String(pos) + " (step " + String(targetStep) + ")");
      currentStatus = "Moving to pos " + String(pos) + "...";
      stepper.moveTo(targetStep);
    }
  }
  server.send(200, "text/plain", "OK");
}

void handleHome() {
  log("[CMD] Homing — looking for magnet...");
  currentStatus = "Homing...";
  server.send(200, "text/plain", "OK");  // Respond first
  doHoming();
}

void handleRunAll() {
  log("=== Running All Tests ===");
  currentStatus = "Running tests...";
  server.send(200, "text/plain", "OK");
  testRunning = true;
  currentTest = 1;
}

// ============================================================
// HOMING: Edge-midpoint algorithm
// ============================================================
void doHoming() {
  stepper.setMaxSpeed(600);
  stepper.setAcceleration(400);
  stepper.setCurrentPosition(0);

  int maxSteps = STEPS_PER_REV * 1.5;
  long leadingEdge = -1;
  long trailingEdge = -1;
  bool inMagnetZone = false;

  int h = analogRead(HALL_PIN);
  if (h < HALL_HOME) {
    // Already on magnet — spin out quickly
    log("  Already in magnet zone, spinning out...");
    stepper.move(STEPS_PER_REV / 2);
    while (stepper.run()) {
      server.handleClient();          // keep the dashboard alive while homing
      if (analogRead(HALL_PIN) > HALL_AWAY) break;
    }
    stepper.stop();
    while (stepper.run()) {}  // decelerate to stop
    h = analogRead(HALL_PIN);
    if (h < HALL_HOME) {
      log("  ERROR: Still in magnet zone. Check setup.");
      currentStatus = "Homing FAILED";
      stepper.setMaxSpeed(800);
      stepper.setAcceleration(400);
      return;
    }
  }

  // Spin continuously and check hall while moving
  stepper.setCurrentPosition(0);
  stepper.move(maxSteps);
  while (stepper.run()) {
    server.handleClient();            // keep the dashboard alive while homing
    h = analogRead(HALL_PIN);
    long pos = stepper.currentPosition();

    if (!inMagnetZone && h < HALL_HOME) {
      leadingEdge = pos;
      inMagnetZone = true;
      log("  Leading edge at step " + String(leadingEdge));
    }

    if (inMagnetZone && h > HALL_AWAY) {
      trailingEdge = pos;
      log("  Trailing edge at step " + String(trailingEdge));
      stepper.stop();
      while (stepper.run()) {}  // decelerate
      break;
    }
  }

  if (leadingEdge < 0 || trailingEdge < 0) {
    log("  No magnet detected — homing skipped.");
    currentStatus = "No magnet found";
    stepper.setMaxSpeed(800);
    stepper.setAcceleration(400);
    return;
  }

  homePosition = (leadingEdge + trailingEdge) / 2;
  long backtrack = stepper.currentPosition() - homePosition;
  log("  Midpoint = step " + String(homePosition) + ", backing up " + String(backtrack));

  stepper.move(-backtrack);
  while (stepper.run()) { server.handleClient(); }

  stepper.setCurrentPosition(0);
  isHomed = true;
  currentStatus = "Homed! Position 0.";
  log("  HOME SET. Motor is now at position 0.");

  stepper.setMaxSpeed(800);
  stepper.setAcceleration(400);
}

// ============================================================
// Run test sequence (non-blocking, called from loop)
// ============================================================
void runTests() {
  if (!testRunning) return;

  switch (currentTest) {
    case 1: {
      log("\n[TEST 1] Hall sensor baseline (10 readings):");
      for (int i = 0; i < 10; i++) {
        log("  hall = " + String(analogRead(HALL_PIN)));
        delay(200);
      }
      currentTest = 2;
      break;
    }
    case 2: {
      log("\n[TEST 2] Smooth CW quarter turn...");
      currentStatus = "Test 2: CW quarter turn";
      stepper.move(STEPS_PER_REV / 4);
      while (stepper.run()) { server.handleClient(); }
      stepper.disableOutputs();
      log("  Done. Motor turned ~90 degrees CW.");
      delay(500);
      currentTest = 3;
      break;
    }
    case 3: {
      log("\n[TEST 3] Smooth CCW quarter turn (back)...");
      currentStatus = "Test 3: CCW quarter turn";
      stepper.move(-STEPS_PER_REV / 4);
      while (stepper.run()) { server.handleClient(); }
      stepper.disableOutputs();
      log("  Done. Motor back at start.");
      delay(500);
      currentTest = 4;
      break;
    }
    case 4: {
      log("\n[TEST 4] Full CW revolution + hall logging:");
      currentStatus = "Test 4: Full revolution";
      stepper.move(STEPS_PER_REV);
      long lastReport = stepper.currentPosition();
      while (stepper.run()) {
        server.handleClient();
        long pos = stepper.currentPosition();
        if (pos - lastReport >= 64) {
          int h = analogRead(HALL_PIN);
          log("  step=" + String(pos) + "  hall=" + String(h));
          lastReport = pos;
        }
      }
      stepper.disableOutputs();
      log("  Revolution complete.");
      delay(500);
      currentTest = 5;
      break;
    }
    case 5: {
      log("\n[TEST 5] Homing (edge-midpoint)...");
      currentStatus = "Test 5: Homing";
      doHoming();
      currentTest = 99;
      break;
    }
    case 99: {
      log("\n=== ALL TESTS COMPLETE ===");
      currentStatus = "All tests done!";
      testRunning = false;
      currentTest = 0;
      break;
    }
  }
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  Braillix Breadboard Test v3");
  Serial.println("  AccelStepper + WiFi Web Monitor");
  Serial.println("========================================");

  // Motor setup
  stepper.setMaxSpeed(800);
  stepper.setAcceleration(400);
  pinMode(HALL_PIN, INPUT);

  // Connect to WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected!");
    Serial.print(">>> Open in browser: http://");
    Serial.println(WiFi.localIP());
    Serial.println();
    log("WiFi connected: " + WiFi.localIP().toString());
    currentStatus = "Ready — WiFi connected";

    // --- OTA (Over-The-Air) updates ---
    // After this first USB upload, you can upload wirelessly!
    // In Arduino IDE: Tools -> Port -> "Braillix (192.168.x.x)"
    ArduinoOTA.setHostname("Braillix");
    ArduinoOTA.setPassword(OTA_PASSWORD);
    ArduinoOTA.onStart([]() {
      // Stop motor during OTA update
      stepper.disableOutputs();
      log("OTA update starting...");
    });
    ArduinoOTA.onEnd([]() {
      log("OTA update done! Rebooting...");
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
      Serial.printf("OTA: %u%%\r", (progress / (total / 100)));
    });
    ArduinoOTA.onError([](ota_error_t error) {
      Serial.printf("OTA Error[%u]\n", error);
    });
    ArduinoOTA.begin();
    Serial.println("OTA enabled — future uploads can be wireless!");
    Serial.println("  Arduino IDE -> Tools -> Port -> 'Braillix'");
  } else {
    Serial.println("WiFi FAILED — running without web interface.");
    Serial.println("(Serial Monitor still works over USB)");
    log("WiFi failed. Serial-only mode.");
    currentStatus = "Ready — no WiFi";
  }

  // Web server routes
  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.on("/cw", handleCW);
  server.on("/ccw", handleCCW);
  server.on("/fullrev", handleFullRev);
  server.on("/goto", handleGoTo);
  server.on("/home", handleHome);
  server.on("/runall", handleRunAll);
  server.begin();

  log("Ready. Use buttons on web page or type commands in Serial.");
  log("Cam positions: 0-63 (type number in Serial Monitor)");
}

// ============================================================
// LOOP
// ============================================================
void loop() {
  // Handle OTA updates
  ArduinoOTA.handle();

  // Handle web requests
  server.handleClient();

  // Run test sequence if active
  runTests();

  // Keep stepper moving
  stepper.run();

  // Update status when motor stops
  if (stepper.distanceToGo() == 0 && currentStatus.endsWith("...")) {
    currentStatus = "Idle — pos " + String(stepper.currentPosition());
    stepper.disableOutputs();  // Save power
  }

  // Hall monitor (update + print to serial every 500ms)
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    currentHall = analogRead(HALL_PIN);
    currentPos = stepper.currentPosition();
    Serial.print("hall=");
    Serial.print(currentHall);
    Serial.print("  pos=");
    Serial.print(currentPos);
    Serial.print("  status=");
    Serial.println(currentStatus);
    lastPrint = millis();
  }

  // Serial commands (still work over USB)
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.length() > 0) {
      int target = input.toInt();
      if (target >= 0 && target < 64) {
        long targetStep = camDwellTargetStep(target);
        log("[Serial] Go to pos " + String(target) + " (step " + String(targetStep) + ")");
        currentStatus = "Moving to pos " + String(target) + "...";
        stepper.moveTo(targetStep);
      }
    }
  }
}
