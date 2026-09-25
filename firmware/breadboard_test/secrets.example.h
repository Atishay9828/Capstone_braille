// =========================================================
// SECRETS TEMPLATE — copy this file to `secrets.h` and fill it in.
//
//   cp secrets.example.h secrets.h      (then edit secrets.h)
//
// `secrets.h` is gitignored and must NEVER be committed.
// This template is committed so anyone cloning the repo knows what to create.
// =========================================================

#ifndef SECRETS_H
#define SECRETS_H

// Your 2.4GHz WiFi network (the ESP32 cannot join 5GHz networks)
#define WIFI_SSID_VALUE  "YOUR_WIFI_NAME"
#define WIFI_PASS_VALUE  "YOUR_WIFI_PASSWORD"

// Password required to push firmware over-the-air (Arduino IDE will prompt).
// Pick anything; it cannot be left blank.
#define OTA_PASSWORD     "CHANGE_ME"

#endif
