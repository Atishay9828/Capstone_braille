# Component measurement research

**Updated:** 2026-07-31
**Purpose:** prefill catalogue-standard dimensions before asking for physical measurements.

## Evidence labels

- **MEASURED** — reported from the owned part by AJ.
- **PHOTO-ID** — form factor confirmed from AJ's owned-part photograph.
- **DERIVED** — calculated from reported measurements.
- **SPEC** — published nominal for the identified component family.
- **LIKELY** — strong description match, but the exact clone is not identified.
- **VERIFY** — still needs the owned part, a purchase link, or an exact model number.

The 28BYJ-48 and generic ESP32/ULN2003 boards are made by many factories. A catalogue value is
good evidence for clearance and identification, but not a substitute for a physical reading where
the CAD depends on a press fit or exact header alignment.

## Researched values

| ID | Value to use | Evidence | Decision |
|---|---:|---|---|
| M1 | 28.1 mm | **MEASURED**; 28 mm typical | Use 28.1 |
| M2 | 19.0 mm | **MEASURED**; 19–20 mm variants published | Use 19.0 |
| M3 | 7.5 mm | **MEASURED**; approximately 8 mm typical | Use 7.5 |
| M4 | 5.0 mm | **MEASURED + SPEC** | Use 5.0 |
| M5 | 3.0 mm | **MEASURED + SPEC** | Use 3.0; current 3.2 mm cam bore gives 0.2 mm total clearance |
| M6 | 9.5 mm from mounting face to tip | **MEASURED**; approximately 10 mm typical | Use 9.5 |
| M7a | approximately 9.0 mm | **SPEC** from common dimensional drawings | Verify only if the collar binds |
| M7b | 2.0 mm | **DERIVED**: 9.5 face-to-tip minus 7.5 collar-top-to-tip | Use 2.0 |
| M8 | 34.7 mm | **MEASURED**; 35 mm typical | Use 34.7 |
| M9 | 4.0 mm | **MEASURED**; published variants are about 3.5–4.2 mm | Use 4.0 |
| M10a | approximately 7.0 mm | **SPEC** from common dimensional drawings | Clearance value, not a press fit |
| M10b | approximately 0.8 mm | **SPEC** from common dimensional drawings | Clearance value, not a press fit |
| M11a | 4.1 mm nominal, 4.2 mm max | **SPEC**, 49E/SS49E TO-92S family | Design to max envelope |
| M11b | 1.6 mm | **MEASURED**; 1.6 mm nominal / 1.68 mm family max | Current 1.6 mm pocket is exact-fit; dry-fit because there is no print margin |
| M11c | 3.1–3.2 mm | **SPEC**, 49E/SS49E TO-92S family | Design to 3.3 mm envelope |
| M11d | 1.27–1.30 mm straight-lead pitch | **SPEC**; formed-lead SS49E-F is 2.54 mm | Verify sensor marking/lead form before desoldering |
| M12–M14 | Body dimensions not needed; cable-slot fit remains | **PHOTO-ID** inline female DC pigtail jack | Current pod choice: body outside, cable through coupon-selected slot, internal tie-post strain relief |
| M15 | likely 5.5 mm barrel / 2.1 mm centre pin | **PHOTO-ID + PROJECT SPEC** | Confirm by mating plug or purchase record; photo alone cannot distinguish 2.1 from 2.5 mm |
| M16 | No thread or ring nut | **PHOTO-ID** | Cannot clamp directly into a lid hole |
| M17 | Centre pin maps to red / positive | **MEASURED 2026-08-01** | Verified for the owned pigtail; re-test only if the connector is replaced |
| M18 | 15 pins per row / 30 total | **MEASURED** | Resolved |
| M19 | approximately 51.5–52.0 mm | **LIKELY**, matching 30-pin USB-C CH340C listings | Safe for pod length envelope |
| M20 | approximately 28.0–28.5 mm | **LIKELY**, matching board listings | Safe for pod width envelope |
| M21 | 25.6 mm | **MEASURED** on the owned 30-pin USB-C board | Use 25.6 for printed header channels |
| M22a | approximately 8.3 mm interface; approximately 9 mm shell | **SPEC/LIKELY**, USB Type-C interface and common receptacle | 14 mm opening clears it |
| M22b | approximately 2.5 mm interface; approximately 3.2 mm shell | **SPEC/LIKELY** | 9 mm opening clears it |
| M22c | approximately 3.2 mm above PCB | **LIKELY**, common on-board receptacle | Existing service opening has generous margin |
| M23 | No measurement needed unless cable overmould exceeds 14×9 mm | CAD service envelope | Closed provisionally |
| M24 | approximately 35×32 mm | **LIKELY**, common blue four-LED ULN2003 module | Variants such as 40×21 mm exist |
| M25 | approximately 10 mm bare module; approximately 12 mm with cable bent flat | **SPEC + project fit estimate** | Verify after final solder/cable dressing |
| M26 | JST-XH motor connector/mated plug, approximately 10–12 mm installed | **SPEC/LIKELY** | Same assembly check as M25 |
| M27 | 8×1 mm | **MEASURED/OWNED**, already recorded in live CAD and BOM | Resolved |
| M28 | 6×6×5 mm | **PURCHASE SPEC**, already recorded in BOM and live CAD | Resolved |

## What the online pass proves

1. The red `2601213328` on the motor is a production/traceability code, not a separate motor
   model. The printed model is still **28BYJ-48, 5 V**.
2. The user-reported motor values agree with the common 28BYJ-48 envelope closely enough to use
   for non-press-fit clearances.
3. The blue `MH-Sensor-Series` board is in the KY-024 family and normally uses a 49E linear Hall
   sensor. The bare sensor package is documented; the complete module still cannot fit in the
   base plate.
4. A 30-pin ESP32 designation did **not** prove M21, but the owned board is now measured at
   **25.6 mm**. The live socket-channel pitch now uses that reading.
5. The 2026-07-31 photo confirms an inline female DC pigtail jack with red/black wires. The current
   lid intentionally keeps its connector body outside, passes only the cable pair through a rounded
   slot, and transfers pull load to an internal tie post. A panel-mount jack is not required for
   this revision; the remaining evidence is the physical 5x3 / 6x4 / 7x5 cable-slot coupon.

## Recommended power-connector decision

Use the owned **inline female pigtail** for the current pod. Keep the barrel body outside, pass only
the two insulated leads through the lid, and secure them to the internal tie post before soldering.
Print `pigtail_slot_coupon.gcode` and choose the smallest slot that passes both leads without
scraping or pinching insulation. The middle 6 x 4 mm slot is the current CAD nominal. A threaded
panel jack is only a future redesign option, not a current purchase requirement.

## Sources

- 28BYJ-48 compiled mechanical datasheet and variant warning:
  https://www.gentiam.com/wp-content/uploads/2022/09/GentiamElectronics-28BYJ-48-Stepper-Motor-Datasheet-Rev20220925-final.pdf
- 28BYJ-48 measured dimensional drawing and lot-code explanation:
  https://cookierobotics.com/042/
- Honeywell SS49E product sheet and package drawing:
  https://prod-edam.honeywell.com/content/dam/honeywell-edam/sps/siot/en-us/products/sensors/magnetic-sensors/linear-and-angle-sensor-ics/common/documents/sps-siot-ss39et-ss49e-ss59et-product-sheet-005850-3-en-ciid-50359.pdf
- Diodes Incorporated AH49E package limits:
  https://www.digikey.in/en/htmldatasheets/production/1364519/0/0/1/ah49e.html
- Joy-IT KY-024 identification (49E + LM393) and module envelope:
  https://www.joy-it.net/en/products/SEN-KY024LM
- Typical inline adapter dimensions (36.7×14×12 mm):
  https://www.taydaelectronics.com/dc-power-female-plug-5-5-x-2-1mm.html
- Adafruit caliper reading for the same adapter family (37.29×14.2 mm):
  https://forums.adafruit.com/viewtopic.php?t=201119
- Pololu adapter polarity mapping:
  https://www.pololu.com/product/2449
- USB-IF Type-C connector interface dimensions:
  https://www.usb.org/sites/default/files/D1T1-2%20-%20USB%20Type-C%20System%20Overview.pdf
- Matching 30-pin USB-C CH340C ESP32 listing (51.5×28.5 mm):
  https://www.mercadolibre.com.mx/esp32-devkit-v1-wifi-bluetooth-ch340c-usb-tipo-c-30-pines/up/MLMU3429721061
- 30-pin ESP carrier row-spacing variants (0.9/1.0/1.1 inch):
  https://osoyoo.com/it/2025/02/07/osoyoo-breakout-board-for-30p-esp32-esp8266/
- Common blue ULN2003 module dimensions (35×32 mm):
  https://www.tinytronics.nl/en/mechanics-and-actuators/motor-controllers-and-drivers/stepper-motor-controllers-and-drivers/uln2003-stepper-motor-driver-module
- ULN2003 kit module envelope (35×32×10 mm):
  https://d3mk240zzrnosz.cloudfront.net/assets/XC4458_datasheetMain_67866.pdf
- JST XH connector mechanical drawing:
  https://www.jst.com/wp-content/uploads/2025/06/eXH.pdf
- 6×6×5 mm tactile-switch specification:
  https://www.handsontec.com/dataspecs/switches/Tact%20Switch%206x6.pdf
