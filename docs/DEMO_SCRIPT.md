# 🎤 Braillix — Presentation & Demo Script

This script is designed for your PPT presentation to showcase the breadboard prototype working flawlessly.

## Prep Work (Before the Presentation)
1. Ensure your ESP32 is flashed with `firmware/breadboard_test/breadboard_test.ino` via USB.
2. Wire up the breadboard exactly as shown in the `ASSEMBLY_BIBLE.md`.
3. Provide power to the motor via the 5V adapter and power the ESP32 via USB to your laptop.
4. On your laptop or phone, open the Web Dashboard by typing the ESP32's IP address (shown in the Arduino Serial Monitor) into your browser.

---

## 🎬 The Demo Script

### Slide / Topic: "Building an Affordable Refreshable Braille Cell"
**You say:** 
> "For this capstone, the goal was to build a low-cost refreshable Braille display. Commercial displays cost thousands of dollars because they use piezoelectric bimorphs for every single dot. We wanted to drop that cost drastically."

**Action:** 
Hold up the 3D-printed cam mechanism or show a picture of it.
> "Instead of expensive piezo elements, we use a single 5V stepper motor driving a 3D-printed cam disc. The cam tracks mechanically lift the braille dots into position."

### Slide / Topic: "Live Mechanism Demo"
**You say:**
> "Let me show you the electronics driving this mechanism live."

**Action:**
1. Switch your projector to mirror your laptop screen, showing the Braillix Web Dashboard.
2. Click the **CW 90°** button on the dashboard.
**You say:**
> "Here, a single ESP32 microcontroller commands the stepper driver. When I hit turn, the motor rotates exactly 90 degrees."
*(The motor spins)*

**Action:** 
3. Click the **Home** button on the dashboard.
**You say:**
> "To know what letter is being displayed, the system must know its absolute position. We use a Hall effect magnetic sensor for homing."
*(The motor spins until the hall sensor detects the magnet and stops).*
> "As you can see on the dashboard, the Hall sensor detected the magnet, registered 'HOME', and reset the position to zero."

### Slide / Topic: "Accessibility & Design Choices"
**You say:**
> "We didn't just build this from an engineering perspective; we designed it with the end user in mind."
> 
> "First, the braille dots themselves are 1.5mm domes. This perfectly matches the international braille standard of 1.44mm to 1.60mm."
> 
> "Second, we are using a 'Jumbo Braille' pitch—4.8mm column spacing and 2.6mm row spacing. Jumbo braille is specifically used for early learners and users with reduced tactile sensitivity, which perfectly aligns with our goal of making an accessible educational tool."

### Slide / Topic: "Future Work"
**You say:**
> "Currently, this prototype proves the single-cell mechanics and electronics. The next phase involves fully assembling the 3D-printed components, installing the micro-return springs for the dots, and expanding to a daisy-chained multi-cell display using I2C communication."

---

## What Can Go Wrong During the Demo?
- **Motor only vibrates:** The stepper phase wiring is crossed. If this happens live, calmly explain: *"Ah, a quick phase inversion on the breadboard,"* and swap the middle two pins in your `CheapStepper` initialization in code, or swap IN2 and IN3 jumper wires.
- **Web Dashboard won't load:** Your laptop and the ESP32 must be on the EXACT SAME WiFi network. If your university blocks device-to-device communication on the student WiFi, use your phone as a Mobile Hotspot for both the ESP32 and your laptop.
