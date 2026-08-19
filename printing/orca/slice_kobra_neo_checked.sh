#!/usr/bin/env bash
# Generate Kobra Neo-safe PETG G-code. Output stays separate from the legacy files.
# The Kobra Neo's stock Marlin firmware has ARC_SUPPORT disabled, so this profile
# explicitly disables Orca's G2/G3 arc fitting.
set -euo pipefail

ORCA="/c/Program Files/OrcaSlicer/orca-slicer.exe"
SYS="C:/Program Files/OrcaSlicer/resources/profiles"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WREPO="$(cygpath -m "$REPO")"
MACHINE="$SYS/Anycubic/machine/Anycubic Kobra Neo 0.4 nozzle.json"
PROCESS="$WREPO/printing/orca/braillix_0.16mm_petg_kobra_neo_release.json"
FILAMENT="$WREPO/printing/orca/numakers_petg_hs.json"
OUTDIR="$REPO/printing/gcode_kobra_neo_checked"
# Default is deliberately limited to geometry that survives either mechanism-stack decision.
PARTS=(hardware_fit_coupon motor_cam_socket_coupon base_interface_coupon pigtail_slot_coupon top_interface_coupon pogo_receiver_coupon cam_linkage_test_fixture mid_plate)
[ $# -gt 0 ] && PARTS=("$@")

mkdir -p "$OUTDIR"
for part in "${PARTS[@]}"; do
  stl="$REPO/cad/stl/$part.stl"
  [ -f "$stl" ] || { echo "Missing: $stl" >&2; exit 1; }
  tmp=$(mktemp -d)
  "$ORCA" --load-settings "$MACHINE;$PROCESS" --load-filaments "$FILAMENT" \
    --slice 0 --outputdir "$(cygpath -w "$tmp")" "$(cygpath -w "$stl")" >/dev/null
  mv "$tmp/plate_1.gcode" "$OUTDIR/$part.gcode"
  rm -rf "$tmp"
  g="$OUTDIR/$part.gcode"
  grep -q '^; filament_type = PETG$' "$g"
  grep -q '^; first_layer_bed_temperature = 80$' "$g"
  grep -q '^; wall_loops = 5$' "$g"
  grep -q '^; layer_height = 0.16$' "$g"
  grep -q '^; sparse_infill_density = 40%$' "$g"
  ! grep -qE '^[Gg][23]( |$)' "$g"
  echo "OK  $part  (PETG, 0.16mm, 5 walls, 40% infill, 80C bed, no arcs)"
done
