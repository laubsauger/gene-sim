// Biome collision detection module
// Handles efficient traversability checks for entity movement

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct BiomeCollisionMap {
    traversability: Vec<u8>,
    grid_width: usize,
    grid_height: usize,
    cell_size: f32,
    world_width: f32,
    world_height: f32,
    // Cache for faster lookups
    cache: Vec<Option<bool>>,
    cache_generation: u32,
}

#[wasm_bindgen]
impl BiomeCollisionMap {
    #[wasm_bindgen(constructor)]
    pub fn new(
        traversability_data: &[u8],
        grid_width: usize,
        grid_height: usize,
        cell_size: f32,
        world_width: f32,
        world_height: f32,
    ) -> BiomeCollisionMap {
        let mut traversability = vec![0u8; grid_width * grid_height];
        traversability.copy_from_slice(traversability_data);
        
        // Pre-allocate cache
        let cache_size = (grid_width * grid_height).min(10000);
        let cache = vec![None; cache_size];
        
        BiomeCollisionMap {
            traversability,
            grid_width,
            grid_height,
            cell_size,
            world_width,
            world_height,
            cache,
            cache_generation: 0,
        }
    }
    
    #[inline]
    pub fn is_traversable(&mut self, world_x: f32, world_y: f32) -> bool {
        // Wrap coordinates
        let wrapped_x = ((world_x % self.world_width) + self.world_width) % self.world_width;
        let wrapped_y = ((world_y % self.world_height) + self.world_height) % self.world_height;
        
        // Convert to grid coordinates
        let grid_x = (wrapped_x / self.cell_size) as usize;
        let grid_y = (wrapped_y / self.cell_size) as usize;
        
        // Bounds check
        if grid_x >= self.grid_width || grid_y >= self.grid_height {
            return false;
        }
        
        // Calculate index
        let idx = grid_y * self.grid_width + grid_x;
        
        // Check cache first
        let cache_idx = idx % self.cache.len();
        if let Some(cached) = self.cache[cache_idx] {
            return cached;
        }
        
        // Look up traversability
        let is_traversable = self.traversability[idx] == 1;
        
        // Update cache
        self.cache[cache_idx] = Some(is_traversable);
        
        is_traversable
    }
    
    // Batch check for multiple positions - more efficient for movement updates
    pub fn check_positions(&mut self, positions: &[f32]) -> Vec<u8> {
        let count = positions.len() / 2;
        let mut results = vec![0u8; count];
        
        for i in 0..count {
            let x = positions[i * 2];
            let y = positions[i * 2 + 1];
            results[i] = if self.is_traversable(x, y) { 1 } else { 0 };
        }
        
        results
    }
    
    // Clear cache when biome data changes
    pub fn clear_cache(&mut self) {
        self.cache.fill(None);
        self.cache_generation += 1;
    }
    
    // Update biome data
    pub fn update_traversability(&mut self, new_data: &[u8]) {
        if new_data.len() == self.traversability.len() {
            self.traversability.copy_from_slice(new_data);
            self.clear_cache();
        }
    }
}

// Apply collision detection and boundary avoidance
pub fn apply_collision_constraints(
    pos_x: &mut [f32],
    pos_y: &mut [f32],
    vel_x: &mut [f32],
    vel_y: &mut [f32],
    collision_map: &mut BiomeCollisionMap,
    dt: f32,
) {
    for i in 0..pos_x.len() {
        let current_x = pos_x[i];
        let current_y = pos_y[i];
        let vx = vel_x[i];
        let vy = vel_y[i];
        
        // Calculate next position
        let next_x = current_x + vx * dt;
        let next_y = current_y + vy * dt;
        
        // Flip Y for texture coordinate system
        let flipped_y = collision_map.world_height - next_y;
        
        // Check if next position is valid
        if collision_map.is_traversable(next_x, flipped_y) {
            // Move is valid
            pos_x[i] = next_x;
            pos_y[i] = next_y;
        } else {
            // Collision detected - try sliding along axes
            let flipped_current_y = collision_map.world_height - current_y;
            
            // Try horizontal movement only
            if collision_map.is_traversable(next_x, flipped_current_y) {
                pos_x[i] = next_x;
                vel_y[i] *= -0.5; // Bounce vertically
            }
            // Try vertical movement only
            else if collision_map.is_traversable(current_x, flipped_y) {
                pos_y[i] = next_y;
                vel_x[i] *= -0.5; // Bounce horizontally
            }
            // Both blocked - reverse direction
            else {
                vel_x[i] *= -0.8;
                vel_y[i] *= -0.8;
                
                // Try to find escape direction
                let angles = [0.0, 45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0];
                let escape_dist = collision_map.cell_size * 2.0;
                
                for angle_deg in &angles {
                    let angle = angle_deg * std::f32::consts::PI / 180.0;
                    let test_x = current_x + angle.cos() * escape_dist;
                    let test_y = current_y + angle.sin() * escape_dist;
                    let test_flipped_y = collision_map.world_height - test_y;
                    
                    if collision_map.is_traversable(test_x, test_flipped_y) {
                        vel_x[i] = angle.cos() * 30.0;
                        vel_y[i] = angle.sin() * 30.0;
                        break;
                    }
                }
            }
        }
    }
}