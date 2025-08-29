use crate::spatial_hash::SpatialHash;

const GENES_PER_ENTITY: usize = 9;
const MAX_NEIGHBORS: usize = 20;

// Cached neighbor data to avoid repeated calculations
struct Neighbor {
    index: usize,
    dx: f32,
    dy: f32,
    dist_sq: f32,
    is_ally: bool,
    energy: f32,
}

#[inline]
fn get_gene(genes: &[f32], entity_idx: usize, gene_idx: usize) -> f32 {
    genes[entity_idx * GENES_PER_ENTITY + gene_idx]
}

pub fn process_entity_movement(
    i: usize,
    pos_x: &mut [f32],
    pos_y: &mut [f32],
    vel_x: &mut [f32],
    vel_y: &mut [f32],
    energy: &[f32],
    tribe_id: &[u16],
    genes: &[f32],
    spatial_hash: &SpatialHash,
    world_width: f32,
    world_height: f32,
    dt: f32,
) {
    let px = pos_x[i];
    let py = pos_y[i];
    let my_tribe = tribe_id[i];
    let my_energy = energy[i];
    
    // Extract genes
    let speed = get_gene(genes, i, 0);
    let vision = get_gene(genes, i, 1);
    let metabolism = get_gene(genes, i, 2);
    let aggression = get_gene(genes, i, 4);
    let cohesion = get_gene(genes, i, 5);
    let food_standards = get_gene(genes, i, 6);
    let diet = get_gene(genes, i, 7);
    let view_angle = get_gene(genes, i, 8) * std::f32::consts::PI / 180.0;
    
    // Calculate effective speed based on metabolism
    let metabolism_efficiency = (metabolism / 0.15).min(1.0);
    let effective_speed = speed * metabolism_efficiency;
    
    // Carnivore/herbivore traits
    let carnivore_level = diet.max(0.0);
    let is_hunter = carnivore_level > 0.2;
    let hunting_threshold = 95.0 - (carnivore_level * 35.0);
    let should_hunt = is_hunter && my_energy < hunting_threshold;
    
    // View direction for cone checks
    let my_orientation = vel_y[i].atan2(vel_x[i]);
    let view_dir_x = my_orientation.cos();
    let view_dir_y = my_orientation.sin();
    let view_cos_threshold = (view_angle / 2.0).cos();
    
    // Determine search radius
    let hunt_vision = if should_hunt {
        vision * 1.5
    } else {
        vision
    };
    let max_vision = vision.max(hunt_vision);
    let vision_sq = vision * vision;
    let hunt_vision_sq = hunt_vision * hunt_vision;
    
    // Collect neighbors
    let mut neighbors = Vec::with_capacity(MAX_NEIGHBORS);
    let mut align_x = 0.0;
    let mut align_y = 0.0;
    let mut separate_x = 0.0;
    let mut separate_y = 0.0;
    let mut cohesion_x = 0.0;
    let mut cohesion_y = 0.0;
    let mut nearby_allies = 0;
    let mut best_prey: Option<usize> = None;
    let mut best_prey_score = f32::MAX;
    
    spatial_hash.for_each_neighbor_limited(px, py, max_vision, MAX_NEIGHBORS * 2, |j| {
        if j == i {
            return false;
        }
        
        let dx = pos_x[j] - px;
        let dy = pos_y[j] - py;
        let dist_sq = dx * dx + dy * dy;
        
        // Early exit if too far
        if dist_sq > hunt_vision_sq {
            return false;
        }
        
        // Check if in view cone
        let dot = (dx * view_dir_x + dy * view_dir_y) / dist_sq.sqrt();
        let in_view = dot > view_cos_threshold;
        
        if !in_view && dist_sq > vision_sq * 0.25 {
            return false;
        }
        
        let is_ally = tribe_id[j] == my_tribe;
        
        // Store neighbor if within normal vision
        if dist_sq < vision_sq && neighbors.len() < MAX_NEIGHBORS {
            neighbors.push(Neighbor {
                index: j,
                dx,
                dy,
                dist_sq,
                is_ally,
                energy: energy[j],
            });
        }
        
        // Flocking calculations for allies
        if is_ally && dist_sq < vision_sq {
            nearby_allies += 1;
            
            // Alignment
            align_x += vel_x[j];
            align_y += vel_y[j];
            
            // Cohesion
            cohesion_x += pos_x[j];
            cohesion_y += pos_y[j];
            
            // Separation (stronger for closer entities)
            if dist_sq < 400.0 && dist_sq > 0.0001 {
                let sep_force = 1.0 / dist_sq.sqrt();
                separate_x -= dx * sep_force;
                separate_y -= dy * sep_force;
            }
        }
        
        // Hunting logic
        if should_hunt && !is_ally && in_view {
            let their_energy = energy[j];
            let their_speed = get_gene(genes, j, 0);
            
            // Score based on distance and prey value
            let catch_probability = if their_speed > 0.0 {
                (effective_speed / their_speed).min(1.0)
            } else {
                1.0
            };
            
            let score = dist_sq / (their_energy * catch_probability + 1.0);
            
            if score < best_prey_score {
                best_prey_score = score;
                best_prey = Some(j);
            }
        }
        
        true
    });
    
    // Calculate steering forces
    let mut steer_x = 0.0;
    let mut steer_y = 0.0;
    
    // Flocking behaviors for allies
    if nearby_allies > 0 {
        // Alignment
        if nearby_allies > 1 {
            align_x /= nearby_allies as f32;
            align_y /= nearby_allies as f32;
            let align_mag = (align_x * align_x + align_y * align_y).sqrt();
            if align_mag > 0.001 {
                steer_x += (align_x / align_mag) * cohesion * 0.5;
                steer_y += (align_y / align_mag) * cohesion * 0.5;
            }
        }
        
        // Cohesion
        cohesion_x = (cohesion_x / nearby_allies as f32) - px;
        cohesion_y = (cohesion_y / nearby_allies as f32) - py;
        let cohesion_mag = (cohesion_x * cohesion_x + cohesion_y * cohesion_y).sqrt();
        if cohesion_mag > 0.001 {
            steer_x += (cohesion_x / cohesion_mag) * cohesion * 0.3;
            steer_y += (cohesion_y / cohesion_mag) * cohesion * 0.3;
        }
    }
    
    // Separation (always active)
    let sep_mag = (separate_x * separate_x + separate_y * separate_y).sqrt();
    if sep_mag > 0.001 {
        steer_x += (separate_x / sep_mag) * 2.0;
        steer_y += (separate_y / sep_mag) * 2.0;
    }
    
    // Hunting behavior
    if let Some(prey_idx) = best_prey {
        let prey_dx = pos_x[prey_idx] - px;
        let prey_dy = pos_y[prey_idx] - py;
        let prey_dist = (prey_dx * prey_dx + prey_dy * prey_dy).sqrt();
        
        if prey_dist > 0.001 {
            // Strong pursuit force
            let hunger_desperation = ((hunting_threshold - my_energy) / hunting_threshold).max(0.0);
            let hunt_force = 3.0 + hunger_desperation * 2.0;
            steer_x += (prey_dx / prey_dist) * hunt_force;
            steer_y += (prey_dy / prey_dist) * hunt_force;
        }
    }
    
    // Add some random wandering
    let wander_angle = ((i as f32 * 12.34 + px * 56.78) % 1.0) * std::f32::consts::TAU;
    steer_x += wander_angle.cos() * 0.1;
    steer_y += wander_angle.sin() * 0.1;
    
    // Apply steering to velocity
    vel_x[i] += steer_x * dt * 10.0;
    vel_y[i] += steer_y * dt * 10.0;
    
    // Clamp velocity to max speed
    let vel_mag = (vel_x[i] * vel_x[i] + vel_y[i] * vel_y[i]).sqrt();
    if vel_mag > effective_speed {
        vel_x[i] = (vel_x[i] / vel_mag) * effective_speed;
        vel_y[i] = (vel_y[i] / vel_mag) * effective_speed;
    }
}