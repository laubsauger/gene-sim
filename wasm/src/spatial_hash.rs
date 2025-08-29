use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SpatialHash {
    cell_size: f32,
    cols: usize,
    rows: usize,
    width: f32,
    height: f32,
    buckets: Vec<i32>,  // head index per bucket (-1 if empty)
    next: Vec<i32>,     // next pointer per entity
}

impl SpatialHash {
    pub fn new(width: f32, height: f32, cell_size: f32, capacity: usize) -> Self {
        let cols = ((width / cell_size).ceil() as usize).max(1);
        let rows = ((height / cell_size).ceil() as usize).max(1);
        
        SpatialHash {
            cell_size,
            cols,
            rows,
            width,
            height,
            buckets: vec![-1; cols * rows],
            next: vec![-1; capacity],
        }
    }
    
    #[inline]
    fn get_key(&self, x: f32, y: f32) -> usize {
        let cx = ((x / self.cell_size) as usize).min(self.cols - 1);
        let cy = ((y / self.cell_size) as usize).min(self.rows - 1);
        cy * self.cols + cx
    }
    
    pub fn rebuild(&mut self, pos_x: &[f32], pos_y: &[f32], alive: &[u8], count: usize) {
        // Clear buckets
        self.buckets.fill(-1);
        self.next.fill(-1);
        
        // Insert all alive entities
        for i in 0..count {
            if alive[i] == 0 {
                continue;
            }
            
            let key = self.get_key(pos_x[i], pos_y[i]);
            self.next[i] = self.buckets[key];
            self.buckets[key] = i as i32;
        }
    }
    
    // Query neighbors within radius, returning indices
    pub fn query_neighbors(&self, x: f32, y: f32, radius: f32) -> Vec<usize> {
        let mut results = Vec::with_capacity(50);
        
        let r = radius + self.cell_size;
        let x0 = ((x - r) / self.cell_size).max(0.0) as usize;
        let y0 = ((y - r) / self.cell_size).max(0.0) as usize;
        let x1 = ((x + r) / self.cell_size).min(self.cols as f32 - 1.0) as usize;
        let y1 = ((y + r) / self.cell_size).min(self.rows as f32 - 1.0) as usize;
        
        for cy in y0..=y1 {
            for cx in x0..=x1 {
                let mut idx = self.buckets[cy * self.cols + cx];
                while idx != -1 {
                    results.push(idx as usize);
                    idx = self.next[idx as usize];
                }
            }
        }
        
        results
    }
    
    // Optimized version with callback to avoid allocations
    pub fn for_each_neighbor<F>(&self, x: f32, y: f32, radius: f32, mut callback: F)
    where
        F: FnMut(usize),
    {
        let r = radius;
        let x0 = ((x - r) / self.cell_size).max(0.0) as usize;
        let y0 = ((y - r) / self.cell_size).max(0.0) as usize;
        let x1 = ((x + r) / self.cell_size).min(self.cols as f32 - 1.0) as usize;
        let y1 = ((y + r) / self.cell_size).min(self.rows as f32 - 1.0) as usize;
        
        for cy in y0..=y1 {
            for cx in x0..=x1 {
                let mut idx = self.buckets[cy * self.cols + cx];
                while idx != -1 {
                    callback(idx as usize);
                    idx = self.next[idx as usize];
                }
            }
        }
    }
    
    // Query with early exit when limit reached
    pub fn for_each_neighbor_limited<F>(&self, x: f32, y: f32, radius: f32, limit: usize, mut callback: F) -> usize
    where
        F: FnMut(usize) -> bool,
    {
        let r = radius;
        let x0 = ((x - r) / self.cell_size).max(0.0) as usize;
        let y0 = ((y - r) / self.cell_size).max(0.0) as usize;
        let x1 = ((x + r) / self.cell_size).min(self.cols as f32 - 1.0) as usize;
        let y1 = ((y + r) / self.cell_size).min(self.rows as f32 - 1.0) as usize;
        
        let mut checked = 0;
        
        // Check cells in expanding rings for better spatial locality
        let center_cx = (x / self.cell_size) as usize;
        let center_cy = (y / self.cell_size) as usize;
        let max_ring = ((x1 - x0).max(y1 - y0) / 2) as i32;
        
        for ring in 0..=max_ring {
            for cy in y0..=y1 {
                for cx in x0..=x1 {
                    // Only process cells on the current ring
                    let dx = (cx as i32 - center_cx as i32).abs();
                    let dy = (cy as i32 - center_cy as i32).abs();
                    if dx.max(dy) != ring {
                        continue;
                    }
                    
                    let mut idx = self.buckets[cy * self.cols + cx];
                    while idx != -1 && checked < limit {
                        if callback(idx as usize) {
                            checked += 1;
                        }
                        idx = self.next[idx as usize];
                    }
                    
                    if checked >= limit {
                        return checked;
                    }
                }
            }
        }
        
        checked
    }
}