#!/usr/bin/env bash
# Slice Braillix STLs to G-code with OrcaSlicer's CLI. No GUI needed.
#
#   ./printing/orca/slice.sh                 # slice every PETG part
#   ./printing/orca/slice.sh outer_box        # slice one part
#
# Output: printing/gcode/<part>.gcode
#
# WHY CUSTOM PROFILES EXIST (do not "simplify" this back to stock):
# Anycubic ships NO PETG profile for the Kobra Neo. Its machine profile pins
# default_filament_profile = "Anycubic Generic PLA", and if you hand the CLI a
# filament profile it doesn't accept it does NOT error — it silently falls back
# to PLA and writes G-code at 200C nozzle / 45C bed. That will not stick, and any
# layer that does stick will peel. Verified: passing Anycubic's own Generic PETG
# produced filament_type=PLA, because Kobra Neo is missing from its
# compatible_printers list. The profiles here are fully flattened so nothing has
# to resolve against the system database.
#
# ALWAYS check the printed summary after slicing. It must report PETG and the actual emitted bed temperature must be 80C.
set -euo pipefail

ORCA="/c/Program Files/OrcaSlicer/orca-slicer.exe"
SYS="C:/Program Files/OrcaSlicer/resources/profiles"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Orca is a native Windows binary: every path handed to it must be a WINDOWS path.
# A POSIX path like /d/TIET/... is not resolved, and Orca does not complain — it
# just produces no G-code. cygpath -m gives D:/TIET/... which it accepts.
WREPO="$(cygpath -m "$REPO")"
MACHINE="$SYS/Anycubic/machine/Anycubic Kobra Neo 0.4 nozzle.json"
PROCESS="$WREPO/printing/orca/braillix_0.20mm_petg.json"
FILAMENT="$WREPO/printing/orca/numakers_petg_hs.json"
OUTDIR="$REPO/printing/gcode"

PARTS=(outer_box mid_plate base_plate top_plate esp32_pod_shell esp32_pod_lid)
[ $# -gt 0 ] && PARTS=("$@")

mkdir -p "$OUTDIR"
[ -x "$ORCA" ] || { echo "OrcaSlicer not found at $ORCA"; exit 1; }

failed=0

for part in "${PARTS[@]}"; do
    stl="$REPO/cad/stl/$part.stl"
    [ -f "$stl" ] || { echo "!! missing $stl — skipped"; failed=1; continue; }
    tmp=$(mktemp -d)
    "$ORCA" --load-settings "$MACHINE;$PROCESS" \
            --load-filaments "$FILAMENT" \
            --slice 0 --outputdir "$(cygpath -w "$tmp")" \
            "$(cygpath -w "$stl")" >/dev/null 2>&1 || true

    if [ ! -f "$tmp/plate_1.gcode" ]; then
        echo "FAILED  $part — no G-code produced"; rm -rf "$tmp"; failed=1; continue
    fi
    mv "$tmp/plate_1.gcode" "$OUTDIR/$part.gcode"; rm -rf "$tmp"

    g="$OUTDIR/$part.gcode"
    ft=$(grep -am1 '^; filament_type = ' "$g" | cut -d= -f2- | tr -d ' ')
    nt=$(grep -am1 '^; nozzle_temperature = ' "$g" | cut -d= -f2- | tr -d ' ')
    bt=$(grep -am1 '^; first_layer_bed_temperature = ' "$g" | cut -d= -f2- | tr -d ' ')
    et=$(grep -am1 'estimated printing time (normal mode)' "$g" | sed 's/.*= //')
    vol=$(grep -am1 '^; filament used \[cm3\]' "$g" | cut -d= -f2- | tr -d ' ')

    if [ "$ft" != "PETG" ] || [ "$bt" != "80" ]; then
        echo "*** $part: filament_type=$ft actual_bed=${bt}C — PROFILE DID NOT LOAD CORRECTLY. DO NOT PRINT. ***"
        failed=1
    else
        printf "OK  %-18s %s/%sC  %scm3  %s\n" "$part" "$nt" "$bt" "$vol" "$et"
    fi
done

exit "$failed"
