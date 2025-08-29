use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

#[wasm_bindgen]
impl Vec2 {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32) -> Self {
        Vec2 { x, y }
    }
    
    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
    
    pub fn normalize(&mut self) {
        let len = self.length();
        if len > 0.0001 {
            self.x /= len;
            self.y /= len;
        }
    }
    
    pub fn dot(&self, other: &Vec2) -> f32 {
        self.x * other.x + self.y * other.y
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub struct EntityGenes {
    pub speed: f32,
    pub vision: f32,
    pub metabolism: f32,
    pub repro_chance: f32,
    pub aggression: f32,
    pub cohesion: f32,
    pub food_standards: f32,
    pub diet: f32,
    pub view_angle: f32,
}

#[wasm_bindgen]
impl EntityGenes {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        EntityGenes {
            speed: 20.0,
            vision: 50.0,
            metabolism: 0.15,
            repro_chance: 0.02,
            aggression: 0.5,
            cohesion: 0.5,
            food_standards: 0.3,
            diet: -0.5,
            view_angle: 120.0,
        }
    }
}

// Performance metrics
#[wasm_bindgen]
pub struct PerfMetrics {
    pub movement_ms: f32,
    pub spatial_hash_ms: f32,
    pub physics_ms: f32,
    pub total_ms: f32,
    pub entities_processed: u32,
}

#[wasm_bindgen]
impl PerfMetrics {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        PerfMetrics {
            movement_ms: 0.0,
            spatial_hash_ms: 0.0,
            physics_ms: 0.0,
            total_ms: 0.0,
            entities_processed: 0,
        }
    }
}