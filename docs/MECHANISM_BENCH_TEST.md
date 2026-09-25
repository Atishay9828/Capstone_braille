# Braillix mechanism bench test

## Purpose

This fixture tests the real cam facets, 1.6 mm tracks, 1.4 mm linkage foot, resin dot holes,
2 mm return spring, and linkage geometry without depending on the invalid motor socket or the
pending enclosure-height decision.

A generic inclined strip is not an adequate substitute: it would miss radial clearance, adjacent
track edges, phase alignment, real STL faceting, linkage pitching, and dot-hole binding.

## Required parts

- PETG: `printing/gcode_kobra_neo_checked/cam_linkage_test_fixture.gcode`
- tough/ABS-like resin: `cad/stl/cam_linkage_test_resin_set.stl`
- one real spring: OD 2.0 mm, ID about 1.4 mm, 0.3 mm wire, about 4 mm free length
- digital caliper or depth gauge
- thin thread and a small spring scale for the torque check

The resin set has four components: current full cam, dot-5 linkage, dot-6 linkage, and dot insert.
The current cam is test-only. Its motor socket is still invalid.

## Fixture datums

- cam OD: 44.4 mm
- locating well: 45.0 mm diameter, 0.3 mm deep
- hub clearance: 12 mm through-hole
- cam underside seating plane to holder underside: 11.0 mm
- flat cam surface to holder underside: 9.0 mm
- insert body opening: 11.2 x 11.2 mm
- insert flange rebate: 15.2 x 15.2 x 1.2 mm
- holder locating pegs: 3.0 mm into 3.4 mm holes

## Assembly

1. Print the two-piece PETG fixture with its checked G-code.
2. Put the base on a flat table.
3. Place the resin cam tracks upward, with its hub hanging through the 12 mm center hole.
4. Dry-fit the resin insert into the removable X-frame. Do not glue it.
5. Install only one linkage and one spring at a time.
6. Lower the X-frame over all four pegs until it sits on the wide post shoulders.
7. Hold the frame down by hand during testing if the loose locating fit allows lift.

Start with dot 5:

- dot 5 drives track 0 at 12.8 mm radius;
- its foot sits at 0 degrees;
- it is the worst inner-track pressure-angle case.

Then repeat with dot 6:

- dot 6 drives track 5 at 21.3 mm radius;
- its foot sits at 300 degrees;
- it is the longest arm and fastest-changing outer track.

## Test A - dry travel without spring

Rotate the cam slowly through several low-to-high and high-to-low transitions in both directions.

Pass only if:

- the dome moves through the insert hole without visible lateral scraping;
- the linkage does not pitch or wedge;
- the 1.4 mm foot stays within its 1.6 mm track;
- the foot never catches an adjacent track edge;
- the dome needs no finger assistance.

Any skate, snap, jam, or direction-dependent position rejects the current cam/linkage geometry.

## Test B - measured dot height

Reference the caliper/depth gauge to the insert top.

Current source acceptance:

- down: dome top flush within +/-0.10 mm;
- up: 0.80 +/-0.10 mm above the surface;
- readings must agree in both rotation directions.

Reject if the down dot is more than 0.1 mm proud, up travel is below 0.4 mm, or backlash changes the
reading based on rotation direction.

## Test C - real spring return

Twist the actual spring over the 1.5 mm dome and into the 2.2 mm insert bore.

Cycle each linkage 50 times in each rotation direction.

Pass only if:

- the dot returns fully and immediately every time;
- the spring retains visible coil clearance at full lift;
- the 2.2 mm flange does not hit the insert underside;
- the spring never slips past the flange;
- no crack, whitening, scoring, resin dust, or permanent spring deformation appears;
- force does not noticeably increase over the cycles.

The nominal flange-to-insert clearance at full lift is only 0.2 mm. Any contact rejects the design.

## Test D - ramp and dwell

For dot 5, reject any visible side loading, skate, or snap while climbing the inner-track ramp.

For dot 6, stop at the center of high and low dwells and gently rock the cam. Reject if the dot
immediately becomes half-raised or changes height with tiny angular movement. The current outer
flat is only about 1.046 mm against a 1.0 mm tangential foot, leaving about 0.023 mm per side.

## Test E - torque reserve

Wrap thin thread around the cam rim. Pull tangentially with a spring scale while the linkage crosses
a ramp.

Compute:

`test torque = pull force x 0.0222 m`

Measure dot 5 and dot 6 separately. Later sum the measured transition torques for all dots that
change at the same state boundary; transition 31 to 32 flips all six.

Final requirement:

`worst simultaneous-transition torque < 50% of measured motor stall/holding torque`

The 2x reserve covers gearbox loss, backlash, resin variation, dust, and ageing. "It moves by hand"
is not enough.

## Release decision

The mechanism remains HOLD unless both dot-5 and dot-6 tests pass:

- dry travel;
- measured height;
- 50 spring cycles in both directions;
- stable high/low dwell;
- no damage or scoring;
- at least 2x motor torque reserve.

An FDM version may expose a failure, but an FDM pass does not validate the intended resin friction
pair or 1.7 mm resin dot holes.
