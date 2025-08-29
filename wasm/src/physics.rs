use std::f32;

const GENES_PER_ENTITY: usize = 9;

// Batch integrate physics for a slice of entities
pub fn integrate_batch(
    pos_x: &mut [f32],
    pos_y: &mut [f32],
    vel_x: &mut [f32],
    vel_y: &mut [f32],
    genes: &[f32],
    start_idx: usize,
    world_width: f32,
    world_height: f32,
    dt: f32,
) {
    let count = pos_x.len();
    
    for i in 0..count {
        let entity_idx = start_idx + i;
        
        // Get max speed from genes
        let speed = genes[entity_idx * GENES_PER_ENTITY];
        let metabolism = genes[entity_idx * GENES_PER_ENTITY + 2];
        
        // Calculate effective speed based on metabolism
        let metabolism_efficiency = (metabolism / 0.15).min(1.0);
        let max_speed = speed * metabolism_efficiency;
        
        // Clamp velocity to max speed
        let vx = vel_x[i];
        let vy = vel_y[i];
        let vel_mag = (vx * vx + vy * vy).sqrt();
        
        if vel_mag > max_speed && vel_mag > 0.0001 {
            let scale = max_speed / vel_mag;
            vel_x[i] = vx * scale;
            vel_y[i] = vy * scale;
        }
        
        // Integrate position
        pos_x[i] += vel_x[i] * dt;
        pos_y[i] += vel_y[i] * dt;
        
        // Toroidal world wrapping
        if pos_x[i] < 0.0 {
            pos_x[i] += world_width;
        } else if pos_x[i] >= world_width {
            pos_x[i] -= world_width;
        }
        
        if pos_y[i] < 0.0 {
            pos_y[i] += world_height;
        } else if pos_y[i] >= world_height {
            pos_y[i] -= world_height;
        }
    }
}

// SIMD-optimized version (when available)
#[cfg(feature = "simd")]
pub fn integrate_batch_simd(
    pos_x: &mut [f32],
    pos_y: &mut [f32],
    vel_x: &[f32],
    vel_y: &[f32],
    world_width: f32,
    world_height: f32,
    dt: f32,
) {
    use packed_simd_2::f32x4;
    
    let count = pos_x.len();
    let simd_count = count / 4;
    let remainder = count % 4;
    
    let dt_vec = f32x4::splat(dt);
    let width_vec = f32x4::splat(world_width);
    let height_vec = f32x4::splat(world_height);
    let zero_vec = f32x4::splat(0.0);
    
    // Process 4 entities at a time
    for i in 0..simd_count {
        let idx = i * 4;
        
        // Load positions and velocities
        let mut px = f32x4::from_slice_unaligned(&pos_x[idx..idx+4]);
        let mut py = f32x4::from_slice_unaligned(&pos_y[idx..idx+4]);
        let vx = f32x4::from_slice_unaligned(&vel_x[idx..idx+4]);
        let vy = f32x4::from_slice_unaligned(&vel_y[idx..idx+4]);
        
        // Integrate position
        px += vx * dt_vec;
        py += vy * dt_vec;
        
        // Toroidal wrapping using SIMD
        // If px < 0, add world_width
        let mask_x_neg = px.lt(zero_vec);
        px = mask_x_neg.select(px + width_vec, px);
        
        // If px >= world_width, subtract world_width
        let mask_x_pos = px.ge(width_vec);
        px = mask_x_pos.select(px - width_vec, px);
        
        // Same for y
        let mask_y_neg = py.lt(zero_vec);
        py = mask_y_neg.select(py + height_vec, py);
        
        let mask_y_pos = py.ge(height_vec);
        py = mask_y_pos.select(py - height_vec, py);
        
        // Store results
        px.write_to_slice_unaligned(&mut pos_x[idx..idx+4]);
        py.write_to_slice_unaligned(&mut pos_y[idx..idx+4]);
    }
    
    // Handle remainder with scalar code
    let remainder_start = simd_count * 4;
    for i in remainder_start..count {
        pos_x[i] += vel_x[i] * dt;
        pos_y[i] += vel_y[i] * dt;
        
        if pos_x[i] < 0.0 {
            pos_x[i] += world_width;
        } else if pos_x[i] >= world_width {
            pos_x[i] -= world_width;
        }
        
        if pos_y[i] < 0.0 {
            pos_y[i] += world_height;
        } else if pos_y[i] >= world_height {
            pos_y[i] -= world_height;
        }
    }
}