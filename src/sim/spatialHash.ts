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
}