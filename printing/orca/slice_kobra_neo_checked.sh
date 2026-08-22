#!/usr/bin/env bash
# Generate Kobra Neo-safe PETG G-code. Output stays separate from the legacy files.
# The Kobra Neo's stock Marlin firmware has ARC_SUPPORT disabled, so this profile
# explicitly disables Orca's G2/G3 arc fitting.
set -euo pipefail

ORCA="/c/Program Files/OrcaSlicer/orca-slicer.exe"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WREPO="$(cygpath -m "$REPO")"
MACHINE_OVERLAY="$WREPO/printing/orca/braillix_kobra_neo_machine.json"
PROCESS="$WREPO/printing/orca/braillix_0.16mm_petg_kobra_neo_release.json"
FILAMENT="$WREPO/printing/orca/numakers_petg_hs.json"
OUTDIR="$REPO/printing/gcode_kobra_neo_checked"
# Default is deliberately limited to geometry that survives either mechanism-stack decision.
PARTS=(hardware_fit_coupon motor_cam_socket_coupon motor_collar_wire_coupon pod_header_usb_coupon hall_island_coupon base_interface_coupon pigtail_slot_coupon top_interface_coupon pogo_receiver_coupon cam_linkage_test_fixture mid_plate)
[ $# -gt 0 ] && PARTS=("$@")

mkdir -p "$OUTDIR"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
for part in "${PARTS[@]}"; do
  stl="$REPO/cad/stl/$part.stl"
  [ -f "$stl" ] || { echo "Missing: $stl" >&2; exit 1; }
  tmp=$(mktemp -d)
  "$ORCA" --load-settings "$MACHINE_OVERLAY;$PROCESS" --load-filaments "$FILAMENT" \
    --slice 0 --outputdir "$(cygpath -w "$tmp")" "$(cygpath -w "$stl")" >/dev/null
  mv "$tmp/plate_1.gcode" "$STAGE/$part.gcode"
  rm -rf "$tmp"
  g="$STAGE/$part.gcode"
  sha=$(sha256sum "$stl" | awk '{print $1}')
  printf '\n; braillix_source_stl_sha256 = %s\n' "$sha" >> "$g"
  grep -q '^; filament_type = PETG$' "$g"
  grep -q '^; first_layer_bed_temperature = 80$' "$g"
  grep -q '^; wall_loops = 5$' "$g"
  grep -q '^; layer_height = 0.16$' "$g"
  grep -q '^; sparse_infill_density = 40%$' "$g"
  grep -q '^; outer_wall_speed = 30$' "$g"
  grep -q '^; inner_wall_speed = 45$' "$g"
  grep -q '^; sparse_infill_speed = 60$' "$g"
  grep -q '^; initial_layer_speed = 20$' "$g"
  grep -q '^; travel_speed = 150$' "$g"
  grep -q '^; retraction_length = 1$' "$g"
  grep -q '^; retraction_speed = 35$' "$g"
  grep -q '^; deretraction_speed = 35$' "$g"
  grep -q '^; braillix_source_stl_sha256 = [0-9a-f]\{64\}$' "$g"
  [ "$(grep -c '^G1 E-1 F2100 ; controlled direct-drive retract$' "$g")" -eq 2 ]
  ! grep -qE '^[Gg][23]( |$)' "$g"
  echo "OK  $part  (PETG, 0.16mm, 5 walls, conservative speeds, 1mm retraction, no arcs)"
done

# Publish only after the entire batch passes, so an interrupted slice cannot
# leave a mixed-generation checked folder.
rm -f "$OUTDIR"/*.gcode
cp "$STAGE"/*.gcode "$OUTDIR"/
