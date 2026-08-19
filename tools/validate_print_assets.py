#!/usr/bin/env python3
"""Validate Braillix STL and Kobra Neo G-code release assets.

Uses only the Python standard library so the audit can run on a clean checkout.
It intentionally checks observable mesh/G-code properties rather than trusting
file names, comments, or a slicer's successful exit code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
import sys
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


Point = tuple[float, float, float]
Triangle = tuple[Point, Point, Point]


RELEASE_COUPON_COMPONENTS = {
    "hardware_fit_coupon": 1,
    "motor_cam_socket_coupon": 3,
    "motor_collar_wire_coupon": 1,
    "pod_header_usb_coupon": 1,
    "hall_island_coupon": 1,
    "top_interface_coupon": 2,
    "pogo_receiver_coupon": 1,
    "cam_linkage_test_fixture": 2,
    "pigtail_slot_coupon": 1,
    "base_interface_coupon": 3,
}

PROVISIONAL_COMPONENTS = {
    "mid_plate": 1,
}

HOLD_COMPONENTS = {
    "outer_box": 1,
    "base_plate": 1,
    "top_plate": 1,
    "esp32_pod_shell": 1,
    "esp32_pod_lid": 1,
    "braille_cam": 1,
    "linkage": 6,
    "dot_insert": 1,
    "nav_cap": 3,
    "pogo_end_cap": 1,
    "cam_linkage_test_resin_set": 4,
}

EXPECTED_COMPONENTS = {
    **RELEASE_COUPON_COMPONENTS,
    **PROVISIONAL_COMPONENTS,
    **HOLD_COMPONENTS,
}

EXPECTED_GCODE = {
    "hardware_fit_coupon.gcode",
    "motor_cam_socket_coupon.gcode",
    "top_interface_coupon.gcode",
    "pogo_receiver_coupon.gcode",
    "cam_linkage_test_fixture.gcode",
    "mid_plate.gcode",
    "pigtail_slot_coupon.gcode",
    "base_interface_coupon.gcode",
    "motor_collar_wire_coupon.gcode",
    "pod_header_usb_coupon.gcode",
    "hall_island_coupon.gcode",
}
GCODE_RELEASE_SETTINGS = {
    "filament_type": "PETG",
    "enable_support": "0",
    "wall_loops": "5",
    "layer_height": "0.16",
    "sparse_infill_density": "40%",
    "bottom_shell_layers": "6",
    "top_shell_layers": "6",
    "brim_width": "8",
    "ironing_type": "top",
    "first_layer_bed_temperature": "80",
    "hot_plate_temp": "80",
    "nozzle_temperature": "230",
    "nozzle_temperature_initial_layer": "235",
    "outer_wall_speed": "30",
    "inner_wall_speed": "45",
    "sparse_infill_speed": "60",
    "initial_layer_speed": "20",
    "travel_speed": "150",
    "retraction_length": "1",
    "retraction_speed": "35",
    "deretraction_speed": "35",
    "filament_flow_ratio": "0.95",
    "fan_min_speed": "40",
    "fan_max_speed": "70",
    "printer_model": "Anycubic Kobra Neo",
    "printer_variant": "0.4",
    "nozzle_diameter": "0.4",
    "default_acceleration": "1000",
}

PROCESS_PROFILE_SETTINGS = {
    key: value
    for key, value in GCODE_RELEASE_SETTINGS.items()
    if key
    not in {
        "filament_type",
        "first_layer_bed_temperature",
        "hot_plate_temp",
        "nozzle_temperature",
        "nozzle_temperature_initial_layer",
        "retraction_length",
        "retraction_speed",
        "deretraction_speed",
        "filament_flow_ratio",
        "fan_min_speed",
        "fan_max_speed",
        "printer_model",
        "printer_variant",
        "nozzle_diameter",
    }
}

FILAMENT_PROFILE_SETTINGS = {
    "filament_type": ["PETG"],
    "hot_plate_temp": ["80"],
    "hot_plate_temp_initial_layer": ["80"],
    "nozzle_temperature": ["230"],
    "nozzle_temperature_initial_layer": ["235"],
    "filament_retraction_length": ["1"],
    "filament_retraction_speed": ["35"],
    "filament_deretraction_speed": ["35"],
    "filament_flow_ratio": ["0.95"],
    "fan_min_speed": ["40"],
    "fan_max_speed": ["70"],
}

MACHINE_PROFILE_SETTINGS = {
    "retraction_length": ["1"],
    "retraction_speed": ["35"],
    "deretraction_speed": ["35"],
}



@dataclass(frozen=True)
class MeshStats:
    triangles: int
    vertices: int
    components: int
    boundary_edges: int
    nonmanifold_edges: int
    duplicate_triangles: int
    bounds_min: Point
    bounds_max: Point
    volume_mm3: float


def _point(values: Iterable[float], digits: int = 6) -> Point:
    rounded = tuple(0.0 if abs(v) < 0.5 * 10 ** -digits else round(v, digits) for v in values)
    return rounded  # type: ignore[return-value]


def read_stl(path: Path) -> list[Triangle]:
    data = path.read_bytes()
    if len(data) >= 84:
        count = struct.unpack_from("<I", data, 80)[0]
        if 84 + count * 50 == len(data):
            triangles: list[Triangle] = []
            offset = 84
            for _ in range(count):
                values = struct.unpack_from("<12fH", data, offset)
                triangles.append(
                    (
                        _point(values[3:6]),
                        _point(values[6:9]),
                        _point(values[9:12]),
                    )
                )
                offset += 50
            return triangles

    triangles = []
    current: list[Point] = []
    for raw_line in data.decode("ascii", errors="strict").splitlines():
        line = raw_line.strip()
        if not line.startswith("vertex "):
            continue
        current.append(_point(float(value) for value in line.split()[1:4]))
        if len(current) == 3:
            triangles.append((current[0], current[1], current[2]))
            current.clear()
    if current or not triangles:
        raise ValueError(f"Could not parse a complete STL mesh: {path}")
    return triangles


def _edge(a: Point, b: Point) -> tuple[Point, Point]:
    return (a, b) if a <= b else (b, a)


def _triangle_key(triangle: Triangle) -> tuple[Point, Point, Point]:
    return tuple(sorted(triangle))  # type: ignore[return-value]


def mesh_stats(triangles: list[Triangle]) -> MeshStats:
    edge_to_triangles: dict[tuple[Point, Point], list[int]] = defaultdict(list)
    vertices: set[Point] = set()
    triangle_keys: Counter[tuple[Point, Point, Point]] = Counter()
    volume = 0.0

    for index, triangle in enumerate(triangles):
        a, b, c = triangle
        vertices.update(triangle)
        triangle_keys[_triangle_key(triangle)] += 1
        edge_to_triangles[_edge(a, b)].append(index)
        edge_to_triangles[_edge(b, c)].append(index)
        edge_to_triangles[_edge(c, a)].append(index)
        volume += (
            a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])
        ) / 6.0

    adjacency: list[set[int]] = [set() for _ in triangles]
    for owners in edge_to_triangles.values():
        if len(owners) < 2:
            continue
        for left in owners:
            adjacency[left].update(right for right in owners if right != left)

    remaining = set(range(len(triangles)))
    components = 0
    while remaining:
        components += 1
        start = remaining.pop()
        queue = deque([start])
        while queue:
            node = queue.popleft()
            for neighbour in adjacency[node]:
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    queue.append(neighbour)

    xs = [point[0] for point in vertices]
    ys = [point[1] for point in vertices]
    zs = [point[2] for point in vertices]
    edge_counts = Counter(len(owners) for owners in edge_to_triangles.values())

    return MeshStats(
        triangles=len(triangles),
        vertices=len(vertices),
        components=components,
        boundary_edges=edge_counts[1],
        nonmanifold_edges=sum(count for owners, count in edge_counts.items() if owners > 2),
        duplicate_triangles=sum(count - 1 for count in triangle_keys.values() if count > 1),
        bounds_min=(min(xs), min(ys), min(zs)),
        bounds_max=(max(xs), max(ys), max(zs)),
        volume_mm3=abs(volume),
    )


def geometry_counter(triangles: list[Triangle]) -> Counter[tuple[Point, Point, Point]]:
    return Counter(_triangle_key(triangle) for triangle in triangles)


def check_stls(repo: Path, fresh_dir: Path | None) -> list[str]:
    failures: list[str] = []
    stl_dir = repo / "cad" / "stl"
    for name, expected_components in EXPECTED_COMPONENTS.items():
        path = stl_dir / f"{name}.stl"
        if not path.exists():
            failures.append(f"{name}: missing {path}")
            continue
        triangles = read_stl(path)
        stats = mesh_stats(triangles)
        size = tuple(round(stats.bounds_max[i] - stats.bounds_min[i], 3) for i in range(3))
        print(
            f"STL {name:18} tris={stats.triangles:7} comps={stats.components:2} "
            f"boundary={stats.boundary_edges:4} nonmanifold={stats.nonmanifold_edges:4} "
            f"size={size} volume={stats.volume_mm3:.2f}mm3"
        )
        if stats.components != expected_components:
            failures.append(
                f"{name}: expected {expected_components} component(s), got {stats.components}"
            )
        if stats.boundary_edges or stats.nonmanifold_edges or stats.duplicate_triangles:
            failures.append(
                f"{name}: boundary={stats.boundary_edges}, nonmanifold={stats.nonmanifold_edges}, "
                f"duplicates={stats.duplicate_triangles}"
            )
        if not math.isfinite(stats.volume_mm3) or stats.volume_mm3 <= 0:
            failures.append(f"{name}: invalid enclosed volume {stats.volume_mm3}")

        if fresh_dir is not None:
            fresh = fresh_dir / f"{name}.stl"
            if not fresh.exists():
                failures.append(f"{name}: missing fresh render {fresh}")
            elif geometry_counter(triangles) != geometry_counter(read_stl(fresh)):
                failures.append(f"{name}: committed STL geometry differs from fresh render")

    return failures


HEADER_PATTERN = re.compile(r"^; ([^=]+?) = (.*)$")


def gcode_header(path: Path) -> dict[str, str]:
    """Collect OrcaSlicer settings from the whole file.

    Orca emits only a short summary at the top; the authoritative process and
    filament settings are written after the executable block near EOF.
    """
    header: dict[str, str] = {}
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            match = HEADER_PATTERN.match(line.rstrip("\r\n"))
            if match:
                header[match.group(1).strip()] = match.group(2).strip()
    return header


def check_gcode(repo: Path) -> list[str]:
    failures: list[str] = []
    gcode_dir = repo / "printing" / "gcode_kobra_neo_checked"
    actual_gcode = {path.name for path in gcode_dir.glob("*.gcode")}
    if actual_gcode != EXPECTED_GCODE:
        failures.append(
            f"checked G-code manifest mismatch: expected {sorted(EXPECTED_GCODE)}, "
            f"got {sorted(actual_gcode)}"
        )
    for path in sorted(gcode_dir.glob("*.gcode")):
        header = gcode_header(path)
        source_stl = repo / "cad" / "stl" / f"{path.stem}.stl"
        expected_stl_hash = hashlib.sha256(source_stl.read_bytes()).hexdigest()
        actual_stl_hash = header.get("braillix_source_stl_sha256")
        if actual_stl_hash != expected_stl_hash:
            failures.append(
                f"{path.name}: source STL SHA-256 expected {expected_stl_hash}, "
                f"got {actual_stl_hash!r}"
            )
        arcs = 0
        min_xyz = [math.inf, math.inf, math.inf]
        max_xyz = [-math.inf, -math.inf, -math.inf]
        absolute = True
        position = [0.0, 0.0, 0.0]
        unsafe_retracts: list[str] = []
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for raw_line in handle:
                retract = re.match(
                    r"^G1\s+E(-?\d+(?:\.\d+)?)\s+F(\d+(?:\.\d+)?)\s*(?:;.*)?$",
                    raw_line.strip(),
                    re.IGNORECASE,
                )
                if retract and float(retract.group(1)) < 0:
                    length = abs(float(retract.group(1)))
                    feed = float(retract.group(2))
                    if length > 1.001 or feed > 2100.1:
                        unsafe_retracts.append(raw_line.strip())
                command = raw_line.split(";", 1)[0].strip().upper()
                if not command:
                    continue
                opcode = command.split()[0]
                if opcode in {"G2", "G3"}:
                    arcs += 1
                elif opcode == "G90":
                    absolute = True
                elif opcode == "G91":
                    absolute = False
                elif opcode in {"G0", "G1"}:
                    for axis, axis_index in zip("XYZ", range(3)):
                        match = re.search(rf"(?:^|\s){axis}(-?\d+(?:\.\d+)?)", command)
                        if not match:
                            continue
                        value = float(match.group(1))
                        position[axis_index] = value if absolute else position[axis_index] + value
                        min_xyz[axis_index] = min(min_xyz[axis_index], position[axis_index])
                        max_xyz[axis_index] = max(max_xyz[axis_index], position[axis_index])

        print(
            f"GCODE {path.stem:16} PETG={header.get('filament_type')} "
            f"walls={header.get('wall_loops')} support={header.get('enable_support')} "
            f"nozzle={header.get('nozzle_temperature_initial_layer')}/{header.get('nozzle_temperature')} "
            f"bed={header.get('first_layer_bed_temperature')} arcs={arcs} "
            f"xyz=({tuple(round(v, 2) for v in min_xyz)}..{tuple(round(v, 2) for v in max_xyz)})"
        )
        for key, expected in GCODE_RELEASE_SETTINGS.items():
            actual = header.get(key)
            if actual != expected:
                failures.append(
                    f"{path.name}: {key} expected {expected!r}, got {actual!r}"
                )
        if arcs:
            failures.append(f"{path.name}: contains {arcs} G2/G3 arc commands")
        if unsafe_retracts:
            failures.append(
                f"{path.name}: unsafe explicit retract(s): {unsafe_retracts[:3]}"
            )
        if min_xyz[0] < 0 or min_xyz[1] < 0 or min_xyz[2] < 0:
            failures.append(f"{path.name}: commanded a negative XYZ position")
        if max_xyz[0] > 220 or max_xyz[1] > 220 or max_xyz[2] > 250:
            failures.append(f"{path.name}: exceeds Kobra Neo build volume")

    profile_path = repo / "printing" / "orca" / "braillix_0.16mm_petg_kobra_neo_release.json"
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    if profile.get("enable_arc_fitting") != "0":
        failures.append("safe Orca profile: enable_arc_fitting must be 0")
    if profile.get("enable_support") != "0":
        failures.append("safe Orca profile: enable_support must be 0")
    for key, expected in PROCESS_PROFILE_SETTINGS.items():
        actual = profile.get(key)
        if actual != expected:
            failures.append(
                f"release Orca profile: {key} expected {expected!r}, got {actual!r}"
            )

    filament_path = repo / "printing" / "orca" / "numakers_petg_hs.json"
    filament = json.loads(filament_path.read_text(encoding="utf-8"))
    for key, expected in FILAMENT_PROFILE_SETTINGS.items():
        actual = filament.get(key)
        if actual != expected:
            failures.append(
                f"release filament profile: {key} expected {expected!r}, got {actual!r}"
            )

    machine_path = repo / "printing" / "orca" / "braillix_kobra_neo_machine.json"
    machine = json.loads(machine_path.read_text(encoding="utf-8"))
    for key, expected in MACHINE_PROFILE_SETTINGS.items():
        actual = machine.get(key)
        if actual != expected:
            failures.append(
                f"release machine profile: {key} expected {expected!r}, got {actual!r}"
            )
    for label, gcode in {
        "start": machine.get("machine_start_gcode", ""),
        "end": machine.get("machine_end_gcode", ""),
    }.items():
        if "G1 E-1 F2100 ; controlled direct-drive retract" not in gcode:
            failures.append(f"release machine profile: unsafe or missing {label} retract")
    return failures


def check_option_a(repo: Path, option_a_dir: Path | None) -> list[str]:
    if option_a_dir is None:
        return []
    failures: list[str] = []
    expected_sizes = {
        "base_plate": (58.0, 50.0, 17.0),
        "braille_cam": (44.4, 44.4, 8.2),
        "outer_box": (68.0, 69.414, 58.0),
        "top_plate": (68.0, 68.0, 4.593),
        "esp32_pod_shell": (68.0, 68.0, 58.0),
        "esp32_pod_lid": (68.0, 68.0, 5.39),
    }
    manifest_path = option_a_dir / "manifest.json"
    if not manifest_path.exists():
        return [f"Option A: missing manifest {manifest_path}"]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    if manifest.get("variant") != "option_a" or manifest.get("stack_repair_raise_mm") != 4:
        failures.append("Option A: manifest does not record stack_repair_raise=4")
    hashes = manifest.get("sha256", {})
    for name, expected_size in expected_sizes.items():
        path = option_a_dir / f"{name}.stl"
        if not path.exists():
            failures.append(f"Option A: missing {path}")
            continue
        stats = mesh_stats(read_stl(path))
        size = tuple(round(stats.bounds_max[i] - stats.bounds_min[i], 3) for i in range(3))
        if stats.components != 1 or stats.boundary_edges or stats.nonmanifold_edges:
            failures.append(f"Option A {name}: mesh topology is not one closed component")
        if any(abs(size[i] - expected_size[i]) > 0.01 for i in range(3)):
            failures.append(f"Option A {name}: expected bounds {expected_size}, got {size}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if hashes.get(name) != digest:
            failures.append(f"Option A {name}: manifest SHA-256 mismatch")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--fresh-dir", type=Path)
    parser.add_argument("--option-a-dir", type=Path)
    parser.add_argument("--skip-gcode", action="store_true")
    parser.add_argument("--release-check", action="store_true")
    args = parser.parse_args()

    repo = args.repo.resolve()
    if args.release_check and (args.fresh_dir is None or args.option_a_dir is None or args.skip_gcode):
        parser.error("--release-check requires --fresh-dir and --option-a-dir and cannot use --skip-gcode")
    failures = check_stls(repo, args.fresh_dir.resolve() if args.fresh_dir else None)
    if not args.skip_gcode:
        failures.extend(check_gcode(repo))
    failures.extend(
        check_option_a(repo, args.option_a_dir.resolve() if args.option_a_dir else None)
    )

    if failures:
        print("\nFAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    checks = ["committed STL topology"]
    if args.fresh_dir:
        checks.append("fresh-source equality")
    if not args.skip_gcode:
        checks.append("G-code/profile/STL-hash")
    if args.option_a_dir:
        checks.append("Option-A variant provenance")
    print(f"\nPASS: {', '.join(checks)} checks passed. Physical fit, strength, "
          "motion, electrical integration, and usability remain separate gates.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
