param(
    [string]$OpenScad = "C:\Program Files\OpenSCAD\openscad.com",
    [string]$FreshDir = "",
    [string]$CandidateDir = ""
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $FreshDir) { $FreshDir = Join-Path $repo ".print_audit_tmp\fresh-default" }
if (-not $CandidateDir) { $CandidateDir = Join-Path $repo "cad\stl_option_a_candidate" }

if (-not (Test-Path -LiteralPath $OpenScad)) {
    throw "OpenSCAD CLI not found at $OpenScad"
}

$allParts = @(
    "hardware_fit_coupon", "motor_cam_socket_coupon", "motor_collar_wire_coupon",
    "pod_header_usb_coupon", "hall_island_coupon", "top_interface_coupon",
    "pogo_receiver_coupon", "cam_linkage_test_fixture", "pigtail_slot_coupon",
    "base_interface_coupon", "mid_plate", "outer_box", "base_plate", "top_plate",
    "esp32_pod_shell", "esp32_pod_lid", "braille_cam", "linkage", "dot_insert",
    "nav_cap", "pogo_end_cap", "cam_linkage_test_resin_set"
)
$optionAParts = @(
    "base_plate", "braille_cam", "outer_box", "top_plate",
    "esp32_pod_shell", "esp32_pod_lid"
)

New-Item -ItemType Directory -Force -Path $FreshDir, $CandidateDir | Out-Null

foreach ($part in $allParts) {
    Write-Host "DEFAULT  $part"
    & $OpenScad -o (Join-Path $FreshDir "$part.stl") (Join-Path $repo "cad\scad\$part.scad")
    if ($LASTEXITCODE -ne 0) { throw "OpenSCAD failed for default $part" }
}

foreach ($part in $optionAParts) {
    Write-Host "OPTION_A $part"
    & $OpenScad -D "stack_repair_raise=4" -o (Join-Path $CandidateDir "$part.stl") (Join-Path $repo "cad\scad\$part.scad")
    if ($LASTEXITCODE -ne 0) { throw "OpenSCAD failed for Option A $part" }
}

$hashes = @{}
foreach ($part in $optionAParts) {
    $hashes[$part] = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $CandidateDir "$part.stl")).Hash.ToLowerInvariant()
}
$manifest = [ordered]@{
    variant = "option_a"
    stack_repair_raise_mm = 4
    status = "HOLD_PENDING_PHYSICAL_COUPONS"
    generated_utc = (Get-Date).ToUniversalTime().ToString("o")
    sha256 = $hashes
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $CandidateDir "manifest.json")

Write-Host "Fresh default renders: $FreshDir"
Write-Host "Option A candidate renders: $CandidateDir"
