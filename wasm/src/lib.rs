mod spatial_hash;
mod movement;
mod physics;
mod types;
mod collision;

use wasm_bindgen::prelude::*;
use web_sys::console;

// Re-export collision detection
pub use collision::BiomeCollisionMap;

// Performance logging macro
macro_rules! log {
    ($($t:tt)*) => (console::log_1(&format!($($t)*).into()))
}

// Main simulation core exposed to JavaScript
#[wasm_bindgen]
pub struct SimCore {
    // Entity data (Structure of Arrays for SIMD)
    pos_x: Vec<f32>,
    pos_y: Vec<f32>,
    vel_x: Vec<f32>,
    vel_y: Vec<f32>,
    energy: Vec<f32>,
    age: Vec<f32>,
    alive: Vec<u8>,
    tribe_id: Vec<u16>,
    
    // Genes (9 components per entity)
    genes: Vec<f32>,
    
    // Spatial acceleration structure
    spatial_hash: spatial_hash::SpatialHash,
    
    // World parameters
    world_width: f32,
    world_height: f32,
    
    // Capacity
    capacity: usize,
    count: usize,
}

#[wasm_bindgen]
impl SimCore {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize, world_width: f32, world_height: f32, cell_size: f32) -> Self {
        log!("Initializing SimCore with capacity: {}", capacity);
        
        SimCore {
            pos_x: vec![0.0; capacity],
            pos_y: vec![0.0; capacity],
            vel_x: vec![0.0; capacity],
            vel_y: vec![0.0; capacity],
            energy: vec![50.0; capacity],
            age: vec![0.0; capacity],
            alive: vec![0; capacity],
            tribe_id: vec![0; capacity],
            genes: vec![0.0; capacity * 9],
            spatial_hash: spatial_hash::SpatialHash::new(world_width, world_height, cell_size, capacity),
            world_width,
            world_height,
            capacity,
            count: 0,
        }
    }
    
    // Set entity count
    pub fn set_count(&mut self, count: usize) {
        self.count = count.min(self.capacity);
    }
    
    // Get pointers for zero-copy SharedArrayBuffer access
    pub fn get_pos_x_ptr(&self) -> *const f32 {
        self.pos_x.as_ptr()
    }
    
    pub fn get_pos_y_ptr(&self) -> *const f32 {
        self.pos_y.as_ptr()
    }
    
    pub fn get_vel_x_ptr(&self) -> *const f32 {
        self.vel_x.as_ptr()
    }
    
    pub fn get_vel_y_ptr(&self) -> *const f32 {
        self.vel_y.as_ptr()
    }
    
    // Rebuild spatial hash for current entities
    pub fn rebuild_spatial_hash(&mut self) {
        self.spatial_hash.rebuild(&self.pos_x, &self.pos_y, &self.alive, self.count);
    }
    
    // Process movement for a range of entities (can be called in parallel by different workers)
    pub fn process_movement_batch(&mut self, start_idx: usize, end_idx: usize, dt: f32) -> f32 {
        let start = web_sys::window()
            .unwrap()
            .performance()
            .unwrap()
            .now();
        
        let end = end_idx.min(self.count);
        
        for i in start_idx..end {
            if self.alive[i] == 0 {
                continue;
            }
            
            movement::process_entity_movement(
                i,
                &mut self.pos_x,
                &mut self.pos_y,
                &mut self.vel_x,
                &mut self.vel_y,
                &self.energy,
                &self.tribe_id,
                &self.genes,
                &self.spatial_hash,
                self.world_width,
                self.world_height,
                dt,
            );
        }
        
        let elapsed = web_sys::window()
            .unwrap()
            .performance()
            .unwrap()
            .now() - start;
        
        elapsed as f32
    }
    
    // Integrate physics for a range of entities
    pub fn integrate_physics_batch(&mut self, start_idx: usize, end_idx: usize, dt: f32) {
        let end = end_idx.min(self.count);
        
        physics::integrate_batch(
            &mut self.pos_x[start_idx..end],
            &mut self.pos_y[start_idx..end],
            &mut self.vel_x[start_idx..end],
            &mut self.vel_y[start_idx..end],
            &self.genes,
            start_idx,
            self.world_width,
            self.world_height,
            dt,
        );
    }
    
    // Load data from SharedArrayBuffers (for initialization)
    pub fn load_from_buffers(
        &mut self,
        pos_x: &[f32],
        pos_y: &[f32],
        vel_x: &[f32],
        vel_y: &[f32],
        energy: &[f32],
        alive: &[u8],
        tribe_id: &[u16],
        genes: &[f32],
    ) {
        let count = pos_x.len().min(self.capacity);
        
        self.pos_x[..count].copy_from_slice(&pos_x[..count]);
        self.pos_y[..count].copy_from_slice(&pos_y[..count]);
        self.vel_x[..count].copy_from_slice(&vel_x[..count]);
        self.vel_y[..count].copy_from_slice(&vel_y[..count]);
        self.energy[..count].copy_from_slice(&energy[..count]);
        self.alive[..count].copy_from_slice(&alive[..count]);
        self.tribe_id[..count].copy_from_slice(&tribe_id[..count]);
        
        let gene_count = (count * 9).min(self.genes.len());
        self.genes[..gene_count].copy_from_slice(&genes[..gene_count]);
        
        self.count = count;
    }
    
    // Write data back to SharedArrayBuffers
    pub fn write_to_buffers(
        &self,
        pos_x: &mut [f32],
        pos_y: &mut [f32],
        vel_x: &mut [f32],
        vel_y: &mut [f32],
    ) {
        let count = self.count.min(pos_x.len());
        
        pos_x[..count].copy_from_slice(&self.pos_x[..count]);
        pos_y[..count].copy_from_slice(&self.pos_y[..count]);
        vel_x[..count].copy_from_slice(&self.vel_x[..count]);
        vel_y[..count].copy_from_slice(&self.vel_y[..count]);
    }
}

// Initialize WASM module
#[wasm_bindgen(start)]
pub fn init() {
    console::log_1(&"WASM module initialized".into());
}