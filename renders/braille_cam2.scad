// =========================================================
// ADVANCED PARAMETRIC BRAILLE CAM GENERATOR (Production Spec)
// FINAL FIXED VERSION: D-Shaft + Solid Floor
// =========================================================

// --- 1. CONFIGURATION PARAMETERS ---
states = 64;                // Total positions (6-bit binary)
dots = 6;                   // Number of tracks
disk_base_thickness = 2.0;  // Base thickness (mm)
pin_lift = 0.8;             // Height of the bump (mm)
track_width = 1.6;          // Width of each track (mm)
track_gap = 0.1;            // Gap between tracks (Drop to 0.1 for Resin/SLA)
inner_radius = 8.0;         // Radius of innermost track
angular_ramp_fraction = 0.3;// % of slice used for ramping (0.0-1.0)
subdivisions_per_slice = 4; // Smoothness (Higher = smoother, slower)
preview_mode = false;       // Set FALSE for final high-quality render!

// Calculated Variables
slice_angle = 360 / states;
ramp_angle = slice_angle * angular_ramp_fraction;

// --- 2. LOGIC FUNCTIONS ---

// Default Binary Mapping (Index -> Binary Pattern)
// Returns 1 if the dot is UP, 0 if DOWN
function get_pattern_bit(state_idx, track_idx) = 
    floor(state_idx / pow(2, track_idx)) % 2;

// Linear Interpolation (Lerp)
function lerp(start, end, bias) = (1 - bias) * start + bias * end;

// S-Curve Smoothing (Optional, for smoother ramps)
function s_curve(t) = (1 - cos(t * 180)) / 2;

// Height Calculation Logic (The Core Algorithm)
function get_height_at_angle(angle, track) = 
    let(
        // Identify which "Slice" (Letter) we are in
        k = floor(angle / slice_angle),
        angle_in_slice = angle - (k * slice_angle),
        
        // Identify Neighbors for blending
        prev_k = (k - 1 + states) % states,
        next_k = (k + 1) % states,
        
        // Get Binary States (0 or 1)
        val_curr = get_pattern_bit(k, track),
        val_prev = get_pattern_bit(prev_k, track),
        val_next = get_pattern_bit(next_k, track),
        
        // Ramp Logic
        half_ramp = ramp_angle / 2,
        is_left_ramp = (angle_in_slice < half_ramp),
        is_right_ramp = (angle_in_slice > (slice_angle - half_ramp)),
        
        // Calculate Height Factor (0.0 to 1.0)
        h_factor = 
            is_left_ramp ? 
                lerp(val_prev, val_curr, s_curve((angle_in_slice + half_ramp) / ramp_angle)) :
            is_right_ramp ? 
                lerp(val_curr, val_next, s_curve((angle_in_slice - (slice_angle - half_ramp)) / ramp_angle)) :
            val_curr // Stable Center Zone
    )
    disk_base_thickness + (h_factor * pin_lift);

// --- 3. GEOMETRY MODULES ---

// Optimized Polyhedron Builder (Much faster than linear_extrude loop)
module build_track_polyhedron(t_idx) {
    r_in = inner_radius + t_idx * (track_width + track_gap);
    r_out = r_in + track_width;
    
    // Resolution logic
    res = preview_mode ? 1 : subdivisions_per_slice;
    step = slice_angle / res;
    total_steps = states * res;
    
    // Generate Points
    points = [
        for(i = [0 : total_steps - 1]) 
        let(
            a = i * step,
            h = get_height_at_angle(a, t_idx)
        )
        each [
            [r_in * cos(a), r_in * sin(a), h],  // Inner Top
            [r_out * cos(a), r_out * sin(a), h], // Outer Top
            [r_in * cos(a), r_in * sin(a), 0],   // Inner Bottom
            [r_out * cos(a), r_out * sin(a), 0]  // Outer Bottom
        ]
    ];
    
    // Connect the dots (Faces)
    faces = [
        for(i = [0 : total_steps - 1]) 
        let(
            n = total_steps * 4,
            i0 = (i * 4),      i1 = (i * 4) + 1,
            i2 = (i * 4) + 2,  i3 = (i * 4) + 3,
            next_i0 = (i0 + 4) % n, next_i1 = (i1 + 4) % n,
            next_i2 = (i2 + 4) % n, next_i3 = (i3 + 4) % n
        )
        each [
            [i0, i1, next_i1, next_i0], // Top Surface
            [i2, next_i2, next_i3, i3], // Bottom Surface
            [i0, next_i0, next_i2, i2], // Inner Wall
            [i1, i3, next_i3, next_i1]  // Outer Wall
        ]
    ];

    polyhedron(points=points, faces=faces, convexity=10);
}

// --- 4. MAIN ASSEMBLY ---

union() {
    // 0. THE SOLID FLOOR (Fuses all tracks together!)
    outermost_r = inner_radius + (dots * (track_width + track_gap));
    color("darkgray") 
        cylinder(h=disk_base_thickness, r=outermost_r, $fn=100);

    // 1. Central Hub (28BYJ-48 D-Shaft Edition)
    color("gray") 
    difference() {
        // The Hub Body (Slightly thicker for strength)
        cylinder(h=disk_base_thickness + 2, r=4.5, $fn=50); 
        
        // The "Double-Flat" Shaft Hole (5mm dia, flattened to 3.2mm)
        intersection() {
            translate([0,0,-1]) cylinder(h=20, r=2.6, $fn=50); // 5.2mm clearance hole
            translate([0,0,-1]) cube([3.2, 10, 20], center=true); // Flatten sides
        }
    }

    // 2. Generate Tracks
    for(t = [0 : dots-1]) {
        color( (t%2==0) ? [0.2, 0.6, 1] : [0.3, 0.7, 1] )
        build_track_polyhedron(t);
    }
    
    // 3. Debug: Visual Markers for Pin Alignment (Preview Only)
    if(preview_mode) {
        color("red")
        for(t = [0 : dots-1]) {
            translate([inner_radius + t*(track_width+track_gap) + track_width/2, 0, 5])
            cube([0.5, 0.5, 5], center=true);
        }
    }
}