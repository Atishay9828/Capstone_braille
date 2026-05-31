# Braillix Demo Day Runbook

For **Aniket and Mridul** (hardware) — plain steps for getting the backend up and
keeping the demo alive. You do not need to read any code to follow this.

---

## 30 minutes before the demo

1. Power on the Raspberry Pi. Wait ~30s for it to boot.
2. Open a terminal (or SSH in): `cd ~/Capstone_braille`
3. Run the health check:
   ```
   bash scripts/health_check.sh
   ```
   - **All `[OK]`** → you're ready. Skip to "Starting the demo".
   - **Any `[FAIL]`** → see **Troubleshooting** below.

If the backend isn't running yet, `health_check.sh` will fail on every line —
that's expected. Start the backend first (next section), then re-run it.

---

## Starting the backend

**Option A — systemd (if installed, recommended):**
```
sudo systemctl start braillix
systemctl status braillix          # should say "active (running)"
```
It also starts automatically on boot if `sudo systemctl enable braillix` was run.

**Option B — manual:**
```
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Leave this terminal open (the server runs in it). Open a second terminal for the
health check.

Then confirm: `bash scripts/health_check.sh` → all `[OK]`.

---

## Starting the demo

The demo runs on **Shaurya's laptop** (not the Pi — the laptop has the OCR model):
```
python scripts/demo_full.py --all --mock-ocr     # fast, reliable (recommended)
python scripts/demo_full.py --all                # real OCR (slower, ~2s/image)
```
Run a single scene with e.g. `--scene 4` (the connected-classroom scene).

---

## If hardware dies mid-demo

The whole software stack works without the physical device — it falls back to the
**SimulatorHAL**, which prints the exact dot patterns the hardware would receive.

1. Don't panic. Keep talking.
2. On the laptop, run the demo with the simulator flag:
   ```
   python scripts/demo_full.py --all --mock-ocr --simulator
   ```
   It prints a `[SimulatorHAL] displayed N cells` line for each translation.
3. Say: *"Let me show you the software layer — this is exactly what the hardware
   receives."* Then point at the SimulatorHAL output. It is still a working demo.

The HMI story still lands: input → Braille dot patterns → (device or simulator).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `health_check.sh` all fail | Backend isn't running. Start it (see above), then re-run. |
| `[FAIL] liblouis NOT available` | Run `sudo apt-get install -y python3-louis liblouis-data`, then re-run `bash scripts/setup_pi.sh`. |
| `[FAIL] Nemeth math translation` | `nemeth.ctb` missing. Re-run `bash scripts/setup_pi.sh` (it copies the wrapper into the liblouis tables dir). |
| `uvicorn: command not found` | The venv isn't active. Run `source venv/bin/activate` first. |
| Port 8000 already in use | Something is already running. `sudo systemctl restart braillix`, or find it: `sudo lsof -i:8000`. |
| Service won't start | Check logs: `journalctl -u braillix -n 50`. Usually a wrong path in the service file — confirm the repo is at `/home/pi/Capstone_braille`. |
| Laptop can't reach the Pi | Confirm both are on the same network; find the Pi's IP with `hostname -I` and use `http://<pi-ip>:8000`. |

---

## One-time setup (only if the Pi is fresh)

```
git clone https://github.com/Atishay9828/Capstone_braille.git
cd Capstone_braille
bash scripts/setup_pi.sh
# (optional) install auto-start service:
sudo cp scripts/braillix.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable braillix
```
`setup_pi.sh` is safe to run again if anything looks off.
