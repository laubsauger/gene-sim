export class SpatialHash {
  cell: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  buckets: Int32Array;  // head index per bucket (-1 if empty)
  next: Int32Array;     // next pointer per entity

  constructor(width: number, height: number, cell: number, cap: number) {
    this.width = width;
    this.height = height;
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.buckets = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(cap).fill(-1);
  }

  key(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)));
    return cy * this.cols + cx;
  }

  rebuild(pos: Float32Array, alive: Uint8Array, count: number): void {
    this.buckets.fill(-1);
    this.next.fill(-1);
    
    for (let i = 0; i < count; i++) {
      if (alive[i]) {
        const k = this.key(pos[i * 2], pos[i * 2 + 1]);
        this.next[i] = this.buckets[k];
        this.buckets[k] = i;
      }
    }
  }

  forNeighbors(x: number, y: number, radius: number, fn: (i: number) => void): void {
    const r = radius + this.cell;
    const x0 = Math.max(0, Math.floor((x - r) / this.cell));
    const y0 = Math.max(0, Math.floor((y - r) / this.cell));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / this.cell));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / this.cell));
    
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let idx = this.buckets[cy * this.cols + cx];
        while (idx !== -1) {
          fn(idx);
          idx = this.next[idx];
        }
      }
    }
  }
  
  // Optimized version that allows early exit
  forNeighborsWithLimit(x: number, y: number, radius: number, limit: number, fn: (i: number) => boolean): number {
    const r = radius;
    const x0 = Math.max(0, Math.floor((x - r) / this.cell));
    const y0 = Math.max(0, Math.floor((y - r) / this.cell));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / this.cell));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / this.cell));
    
    let checked = 0;
    
    // Check cells in expanding rings for better spatial locality
    const centerCx = Math.floor(x / this.cell);
    const centerCy = Math.floor(y / this.cell);
    const maxRing = Math.max(Math.abs(x1 - centerCx), Math.abs(x0 - centerCx), 
                              Math.abs(y1 - centerCy), Math.abs(y0 - centerCy));
    
    for (let ring = 0; ring <= maxRing && checked < limit; ring++) {
      for (let cy = Math.max(y0, centerCy - ring); cy <= Math.min(y1, centerCy + ring) && checked < limit; cy++) {
        for (let cx = Math.max(x0, centerCx - ring); cx <= Math.min(x1, centerCx + ring) && checked < limit; cx++) {
          // Only process cells on the current ring
          if (ring > 0 && Math.abs(cx - centerCx) < ring && Math.abs(cy - centerCy) < ring) continue;
          
          let idx = this.buckets[cy * this.cols + cx];
          while (idx !== -1 && checked < limit) {
            if (fn(idx)) checked++;
            idx = this.next[idx];
          }
        }
      }
    }
    
    return checked;
  }
}