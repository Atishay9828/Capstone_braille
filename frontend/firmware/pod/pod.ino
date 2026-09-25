/*
 * Braillix — brain pod firmware (ESP32)
 * ------------------------------------------------------------------------------------------
 * Implements docs/PROTOCOL.md over BOTH links, from one command handler:
 *
 *   · USB serial, 115200 baud, newline-delimited JSON  ← use this for demos, no network needed
 *   · Wi-Fi HTTP, the endpoints in handoff §7          ← use this when the network cooperates
 *
 * The pod stays deliberately stupid, exactly as the hardware team asked in §2 of the handoff: it
 * receives cam numbers 0..63 and relays them over I2C. It contains no braille, no maths and no
 * language, so the entire translation layer can change without anyone reflashing a board.
 *
 * Pins and values are from the handoff §5:
 *   I2C          SDA = GPIO21, SCL = GPIO22, master
 *   muscle cells 0x20..0x27, set by solder jumpers, discovered by scanning
 *   buttons      Prev = GPIO32, Select = GPIO33, Next = GPIO25, INPUT_PULLUP, active LOW
 *   power        5V/3A into the pod, feeding the whole chain
 *
 * Build: Arduino IDE or arduino-cli, board "ESP32 Dev Module". No external libraries beyond the
 * ESP32 core (WiFi, WebServer, Wire) — deliberately, so a teammate can flash this without setting
 * up a library manager.
 */

#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>

// ---------------------------------------------------------------------------- configuration

static const char *FIRMWARE = "braillix-pod/1.0";

// Wi-Fi is OPTIONAL. Leave these blank and the pod runs happily as a USB device, which is the
// recommended way to demo. Set them to also serve the HTTP endpoints.
static const char *WIFI_SSID = "";
static const char *WIFI_PASSWORD = "";

static const uint8_t PIN_SDA = 21;
static const uint8_t PIN_SCL = 22;
static const uint8_t PIN_PREV = 32;
static const uint8_t PIN_SELECT = 33;
static const uint8_t PIN_NEXT = 25;

static const uint8_t CELL_ADDR_FIRST = 0x20;
static const uint8_t CELL_ADDR_LAST = 0x27;
static const uint8_t MAX_CELLS = CELL_ADDR_LAST - CELL_ADDR_FIRST + 1;

static const uint8_t CAM_POSITIONS = 64;
static const uint8_t CMD_PREFIX = 0xFF;  // next byte is a command, not a position
static const uint8_t CMD_HOME = 0x01;
static const uint8_t CMD_STATUS = 0x02;

static const uint16_t LONG_PRESS_MS = 600;
static const uint16_t DEBOUNCE_MS = 25;
static const uint8_t POD_INDEX = 0;  // change per pod when several are chained

// ---------------------------------------------------------------------------- state

static uint8_t cellAddrs[MAX_CELLS];
static uint8_t cellCount = 0;

// What we last told each cell to show. Lets the pod skip a cell that is already correct — the
// cheapest possible motor command is the one that is never sent.
static uint8_t lastPosition[MAX_CELLS];

static WebServer server(80);
static bool wifiUp = false;

static uint32_t buttonSeq = 0;
static uint8_t buttonState = 0;  // bit0 prev, bit1 select, bit2 next

// ---------------------------------------------------------------------------- I2C chain

/*
 * Scan the bus and record which cells answered, in address order — which is physical left-to-right
 * order, because the jumpers are set that way along the dock. This runs on boot and on demand: the
 * laptop is never allowed to assume a cell count, and neither is the pod.
 */
static void scanChain() {
  cellCount = 0;
  for (uint8_t addr = CELL_ADDR_FIRST; addr <= CELL_ADDR_LAST; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      cellAddrs[cellCount] = addr;
      lastPosition[cellCount] = 0xFF;  // unknown until we have commanded it
      cellCount++;
    }
  }
}

static bool sendPosition(uint8_t index, uint8_t position) {
  if (index >= cellCount) return false;
  Wire.beginTransmission(cellAddrs[index]);
  Wire.write(position);
  return Wire.endTransmission() == 0;
}

static bool sendCommand(uint8_t index, uint8_t command) {
  if (index >= cellCount) return false;
  Wire.beginTransmission(cellAddrs[index]);
  Wire.write(CMD_PREFIX);
  Wire.write(command);
  return Wire.endTransmission() == 0;
}

static void homeAll() {
  for (uint8_t i = 0; i < cellCount; i++) {
    sendCommand(i, CMD_HOME);
    lastPosition[i] = 0;
  }
}

// ---------------------------------------------------------------------------- tiny JSON

/*
 * A hand-rolled reader for exactly the messages in docs/PROTOCOL.md. ArduinoJson would be nicer,
 * but requiring a library install is a real obstacle for a teammate flashing this at 2am, and the
 * grammar we need is three shapes wide.
 */

static const char *findKey(const char *json, const char *key) {
  static char pattern[24];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char *at = strstr(json, pattern);
  if (!at) return nullptr;
  at = strchr(at + strlen(pattern), ':');
  return at ? at + 1 : nullptr;
}

static bool readString(const char *json, const char *key, char *out, size_t outSize) {
  const char *at = findKey(json, key);
  if (!at) return false;
  while (*at == ' ') at++;
  if (*at != '"') return false;
  at++;
  size_t i = 0;
  while (*at && *at != '"' && i + 1 < outSize) out[i++] = *at++;
  out[i] = '\0';
  return true;
}

static bool readInt(const char *json, const char *key, long *out) {
  const char *at = findKey(json, key);
  if (!at) return false;
  *out = strtol(at, nullptr, 10);
  return true;
}

/* Read an array of integers, e.g. "positions":[19,5,12,60]. Returns how many were read. */
static uint8_t readIntArray(const char *json, const char *key, uint8_t *out, uint8_t maxItems) {
  const char *at = findKey(json, key);
  if (!at) return 0;
  at = strchr(at, '[');
  if (!at) return 0;
  at++;

  uint8_t count = 0;
  while (*at && *at != ']' && count < maxItems) {
    while (*at == ' ' || *at == ',') at++;
    if (*at == ']' || !*at) break;
    out[count++] = (uint8_t)strtol(at, (char **)&at, 10);
  }
  return count;
}

// ---------------------------------------------------------------------------- commands

struct ShowResult {
  bool ok;
  uint8_t moved;
  uint8_t skipped;
  const char *error;
};

static ShowResult applyPositions(const uint8_t *positions, uint8_t count) {
  ShowResult result = {false, 0, 0, nullptr};

  if (count != cellCount) {
    result.error = "wrong number of positions";
    return result;
  }
  for (uint8_t i = 0; i < count; i++) {
    if (positions[i] >= CAM_POSITIONS) {
      result.error = "cam position out of range";
      return result;
    }
  }

  for (uint8_t i = 0; i < count; i++) {
    if (lastPosition[i] == positions[i]) {
      result.skipped++;
      continue;  // already there — do not wake the motor
    }
    if (sendPosition(i, positions[i])) {
      lastPosition[i] = positions[i];
      result.moved++;
    } else {
      result.error = "a cell did not acknowledge on I2C";
      return result;
    }
  }

  result.ok = true;
  return result;
}

static void printChainJson(Print &out) {
  out.print("{\"ok\":true,\"cmd\":\"chain\",\"cells\":[");
  for (uint8_t i = 0; i < cellCount; i++) {
    if (i) out.print(',');
    out.print(cellAddrs[i]);
  }
  out.print("],\"count\":");
  out.print(cellCount);
  out.print(",\"pod\":");
  out.print(POD_INDEX);
  out.print(",\"firmware\":\"");
  out.print(FIRMWARE);
  out.println("\"}");
}

// ---------------------------------------------------------------------------- serial link

static char serialLine[512];
static size_t serialLen = 0;

static void handleSerialCommand(const char *json) {
  char cmd[16] = {0};
  if (!readString(json, "cmd", cmd, sizeof(cmd))) {
    Serial.println("{\"ok\":false,\"error\":\"missing cmd\"}");
    return;
  }

  if (strcmp(cmd, "ping") == 0) {
    Serial.print("{\"ok\":true,\"cmd\":\"ping\",\"firmware\":\"");
    Serial.print(FIRMWARE);
    Serial.println("\"}");
    return;
  }

  if (strcmp(cmd, "chain") == 0) {
    scanChain();
    printChainJson(Serial);
    return;
  }

  if (strcmp(cmd, "home") == 0) {
    homeAll();
    Serial.print("{\"ok\":true,\"cmd\":\"home\",\"homed\":");
    Serial.print(cellCount);
    Serial.println("}");
    return;
  }

  if (strcmp(cmd, "show") == 0) {
    uint8_t positions[MAX_CELLS];

    if (strstr(json, "\"updates\"")) {
      // Sparse form: start from what the cells already show, then patch it.
      for (uint8_t i = 0; i < cellCount; i++) {
        positions[i] = (lastPosition[i] == 0xFF) ? 0 : lastPosition[i];
      }
      const char *at = json;
      while ((at = strstr(at, "\"cell\"")) != nullptr) {
        long cellIndex = 0, position = 0;
        if (readInt(at, "cell", &cellIndex) && readInt(at, "position", &position)) {
          if (cellIndex >= 0 && cellIndex < cellCount && position >= 0 && position < CAM_POSITIONS) {
            positions[cellIndex] = (uint8_t)position;
          }
        }
        at += 6;
      }
      ShowResult result = applyPositions(positions, cellCount);
      if (!result.ok) {
        Serial.print("{\"ok\":false,\"cmd\":\"show\",\"error\":\"");
        Serial.print(result.error);
        Serial.println("\"}");
        return;
      }
      Serial.print("{\"ok\":true,\"cmd\":\"show\",\"moved\":");
      Serial.print(result.moved);
      Serial.print(",\"skipped\":");
      Serial.print(result.skipped);
      Serial.println("}");
      return;
    }

    uint8_t count = readIntArray(json, "positions", positions, MAX_CELLS);
    ShowResult result = applyPositions(positions, count);
    if (!result.ok) {
      Serial.print("{\"ok\":false,\"cmd\":\"show\",\"error\":\"");
      Serial.print(result.error ? result.error : "rejected");
      Serial.println("\"}");
      return;
    }
    Serial.print("{\"ok\":true,\"cmd\":\"show\",\"moved\":");
    Serial.print(result.moved);
    Serial.print(",\"skipped\":");
    Serial.print(result.skipped);
    Serial.println("}");
    return;
  }

  if (strcmp(cmd, "layout") == 0) {
    long index = -1;
    readInt(json, "this_pod_index", &index);
    if (index != POD_INDEX) {
      Serial.println("{\"ok\":true,\"cmd\":\"layout\",\"ignored\":true}");
      return;
    }
    uint8_t slice[MAX_CELLS];
    uint8_t count = readIntArray(json, "my_slice", slice, MAX_CELLS);
    ShowResult result = applyPositions(slice, count);
    Serial.print(result.ok ? "{\"ok\":true,\"cmd\":\"layout\",\"moved\":" : "{\"ok\":false,\"cmd\":\"layout\",\"moved\":");
    Serial.print(result.moved);
    Serial.println("}");
    return;
  }

  Serial.println("{\"ok\":false,\"error\":\"unknown cmd\"}");
}

static void pumpSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialLen > 0) {
        serialLine[serialLen] = '\0';
        handleSerialCommand(serialLine);
        serialLen = 0;
      }
    } else if (serialLen + 1 < sizeof(serialLine)) {
      serialLine[serialLen++] = c;
    } else {
      serialLen = 0;  // overlong line: drop it rather than half-execute it
    }
  }
}

// ---------------------------------------------------------------------------- HTTP link

static void sendCors() {
  // The app is a page served from localhost talking to a device on the LAN, so the pod has to say
  // yes explicitly or the browser refuses. Same headers as tools/virtual-pod.
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Headers", "content-type");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

static void httpChain() {
  scanChain();
  String out = "{\"ok\":true,\"cmd\":\"chain\",\"cells\":[";
  for (uint8_t i = 0; i < cellCount; i++) {
    if (i) out += ',';
    out += String(cellAddrs[i]);
  }
  out += "],\"count\":" + String(cellCount) + ",\"pod\":" + String(POD_INDEX) + ",\"firmware\":\"" + FIRMWARE + "\"}";
  sendCors();
  server.send(200, "application/json", out);
}

static void httpShow() {
  String body = server.arg("plain");
  uint8_t positions[MAX_CELLS];
  uint8_t count = readIntArray(body.c_str(), "positions", positions, MAX_CELLS);

  if (count == 0 && body.indexOf("updates") >= 0) {
    for (uint8_t i = 0; i < cellCount; i++) positions[i] = (lastPosition[i] == 0xFF) ? 0 : lastPosition[i];
    const char *at = body.c_str();
    while ((at = strstr(at, "\"cell\"")) != nullptr) {
      long cellIndex = 0, position = 0;
      if (readInt(at, "cell", &cellIndex) && readInt(at, "position", &position)) {
        if (cellIndex >= 0 && cellIndex < cellCount && position >= 0 && position < CAM_POSITIONS) {
          positions[cellIndex] = (uint8_t)position;
        }
      }
      at += 6;
    }
    count = cellCount;
  }

  ShowResult result = applyPositions(positions, count);
  sendCors();
  if (!result.ok) {
    server.send(400, "application/json",
                String("{\"ok\":false,\"error\":\"") + (result.error ? result.error : "rejected") + "\"}");
    return;
  }
  server.send(200, "application/json",
              String("{\"ok\":true,\"moved\":") + result.moved + ",\"skipped\":" + result.skipped + "}");
}

static void httpLayout() {
  String body = server.arg("plain");
  long index = -1;
  readInt(body.c_str(), "this_pod_index", &index);
  sendCors();
  if (index != POD_INDEX) {
    server.send(200, "application/json", "{\"ok\":true,\"ignored\":true}");
    return;
  }
  uint8_t slice[MAX_CELLS];
  uint8_t count = readIntArray(body.c_str(), "my_slice", slice, MAX_CELLS);
  ShowResult result = applyPositions(slice, count);
  server.send(result.ok ? 200 : 400, "application/json", String("{\"ok\":") + (result.ok ? "true" : "false") +
                                                             ",\"moved\":" + result.moved + "}");
}

static void httpHome() {
  homeAll();
  sendCors();
  server.send(200, "application/json", String("{\"ok\":true,\"homed\":") + cellCount + "}");
}

static void httpButtons() {
  sendCors();
  server.send(200, "application/json",
              String("{\"prev\":") + ((buttonState & 1) ? 1 : 0) + ",\"select\":" + ((buttonState & 2) ? 1 : 0) +
                  ",\"next\":" + ((buttonState & 4) ? 1 : 0) + ",\"seq\":" + String(buttonSeq) + "}");
}

static void startWifi() {
  if (strlen(WIFI_SSID) == 0) return;  // USB-only build; that is a legitimate configuration

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("{\"event\":\"wifi\",\"ok\":false}");
    return;
  }
  wifiUp = true;
  Serial.print("{\"event\":\"wifi\",\"ok\":true,\"ip\":\"");
  Serial.print(WiFi.localIP());
  Serial.println("\"}");

  server.on("/chain", HTTP_GET, httpChain);
  server.on("/show", HTTP_POST, httpShow);
  server.on("/layout", HTTP_POST, httpLayout);
  server.on("/home", HTTP_POST, httpHome);
  server.on("/buttons", HTTP_GET, httpButtons);
  server.onNotFound([]() {
    sendCors();
    server.send(server.method() == HTTP_OPTIONS ? 204 : 404, "application/json", "{}");
  });
  server.begin();
}

// ---------------------------------------------------------------------------- buttons

/*
 * Prev / Select / Next, debounced, with long-press detection on Select.
 *
 * These three map exactly onto how Braillix reads an expression: Prev and Next move between
 * sibling parts, Select steps into the part you are on, and holding Select steps back out. The
 * hardware team wired three buttons; the software found that three is precisely enough to walk a
 * tree.
 */
static void pumpButtons() {
  static uint8_t stable = 0;
  static uint8_t previous = 0;
  static uint32_t changedAt = 0;
  static uint32_t pressedAt[3] = {0, 0, 0};
  static bool longSent[3] = {false, false, false};

  const uint8_t pins[3] = {PIN_PREV, PIN_SELECT, PIN_NEXT};
  const char *names[3] = {"prev", "select", "next"};

  uint8_t raw = 0;
  for (uint8_t i = 0; i < 3; i++) {
    if (digitalRead(pins[i]) == LOW) raw |= (1 << i);  // active LOW
  }

  uint32_t now = millis();
  if (raw != previous) {
    previous = raw;
    changedAt = now;
  } else if (now - changedAt > DEBOUNCE_MS && raw != stable) {
    for (uint8_t i = 0; i < 3; i++) {
      bool wasDown = stable & (1 << i);
      bool isDown = raw & (1 << i);

      if (isDown && !wasDown) {
        pressedAt[i] = now;
        longSent[i] = false;
      } else if (!isDown && wasDown && !longSent[i]) {
        buttonSeq++;
        Serial.print("{\"event\":\"button\",\"button\":\"");
        Serial.print(names[i]);
        Serial.print("\",\"long\":false,\"seq\":");
        Serial.print(buttonSeq);
        Serial.println("}");
      }
    }
    stable = raw;
    buttonState = raw;
  }

  // A held button reports as soon as it crosses the threshold, so the response feels immediate
  // rather than arriving on release.
  for (uint8_t i = 0; i < 3; i++) {
    if ((stable & (1 << i)) && !longSent[i] && now - pressedAt[i] >= LONG_PRESS_MS) {
      longSent[i] = true;
      buttonSeq++;
      Serial.print("{\"event\":\"button\",\"button\":\"");
      Serial.print(names[i]);
      Serial.print("\",\"long\":true,\"seq\":");
      Serial.print(buttonSeq);
      Serial.println("}");
    }
  }
}

// ---------------------------------------------------------------------------- lifecycle

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_PREV, INPUT_PULLUP);
  pinMode(PIN_SELECT, INPUT_PULLUP);
  pinMode(PIN_NEXT, INPUT_PULLUP);

  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(100000);

  scanChain();
  homeAll();  // a stepper has no idea where it is at power-up (handoff §5)

  startWifi();

  Serial.print("{\"event\":\"ready\",\"firmware\":\"");
  Serial.print(FIRMWARE);
  Serial.print("\",\"cells\":");
  Serial.print(cellCount);
  Serial.println("}");
}

void loop() {
  pumpSerial();
  pumpButtons();
  if (wifiUp) server.handleClient();
}
