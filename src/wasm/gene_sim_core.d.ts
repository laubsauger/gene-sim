/* tslint:disable */
/* eslint-disable */
export function init(): void;
export class BiomeCollisionMap {
  free(): void;
  constructor(traversability_data: Uint8Array, grid_width: number, grid_height: number, cell_size: number, world_width: number, world_height: number);
  is_traversable(world_x: number, world_y: number): boolean;
  check_positions(positions: Float32Array): Uint8Array;
  clear_cache(): void;
  update_traversability(new_data: Uint8Array): void;
}
export class EntityGenes {
  free(): void;
  constructor();
  speed: number;
  vision: number;
  metabolism: number;
  repro_chance: number;
  aggression: number;
  cohesion: number;
  food_standards: number;
  diet: number;
  view_angle: number;
}
export class PerfMetrics {
  free(): void;
  constructor();
  movement_ms: number;
  spatial_hash_ms: number;
  physics_ms: number;
  total_ms: number;
  entities_processed: number;
}
export class SimCore {
  free(): void;
  constructor(capacity: number, world_width: number, world_height: number, cell_size: number);
  set_count(count: number): void;
  get_pos_x_ptr(): number;
  get_pos_y_ptr(): number;
  get_vel_x_ptr(): number;
  get_vel_y_ptr(): number;
  rebuild_spatial_hash(): void;
  process_movement_batch(start_idx: number, end_idx: number, dt: number): number;
  integrate_physics_batch(start_idx: number, end_idx: number, dt: number): void;
  load_from_buffers(pos_x: Float32Array, pos_y: Float32Array, vel_x: Float32Array, vel_y: Float32Array, energy: Float32Array, alive: Uint8Array, tribe_id: Uint16Array, genes: Float32Array): void;
  write_to_buffers(pos_x: Float32Array, pos_y: Float32Array, vel_x: Float32Array, vel_y: Float32Array): void;
}
export class SpatialHash {
  private constructor();
  free(): void;
}
export class Vec2 {
  free(): void;
  constructor(x: number, y: number);
  length(): number;
  normalize(): void;
  dot(other: Vec2): number;
  x: number;
  y: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_spatialhash_free: (a: number, b: number) => void;
  readonly __wbg_vec2_free: (a: number, b: number) => void;
  readonly vec2_new: (a: number, b: number) => number;
  readonly vec2_length: (a: number) => number;
  readonly vec2_normalize: (a: number) => void;
  readonly vec2_dot: (a: number, b: number) => number;
  readonly __wbg_entitygenes_free: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_speed: (a: number) => number;
  readonly __wbg_set_entitygenes_speed: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_vision: (a: number) => number;
  readonly __wbg_set_entitygenes_vision: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_metabolism: (a: number) => number;
  readonly __wbg_set_entitygenes_metabolism: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_repro_chance: (a: number) => number;
  readonly __wbg_set_entitygenes_repro_chance: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_aggression: (a: number) => number;
  readonly __wbg_set_entitygenes_aggression: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_cohesion: (a: number) => number;
  readonly __wbg_set_entitygenes_cohesion: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_food_standards: (a: number) => number;
  readonly __wbg_set_entitygenes_food_standards: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_diet: (a: number) => number;
  readonly __wbg_set_entitygenes_diet: (a: number, b: number) => void;
  readonly __wbg_get_entitygenes_view_angle: (a: number) => number;
  readonly __wbg_set_entitygenes_view_angle: (a: number, b: number) => void;
  readonly entitygenes_new: () => number;
  readonly __wbg_perfmetrics_free: (a: number, b: number) => void;
  readonly __wbg_get_perfmetrics_entities_processed: (a: number) => number;
  readonly __wbg_set_perfmetrics_entities_processed: (a: number, b: number) => void;
  readonly perfmetrics_new: () => number;
  readonly __wbg_biomecollisionmap_free: (a: number, b: number) => void;
  readonly biomecollisionmap_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly biomecollisionmap_is_traversable: (a: number, b: number, c: number) => number;
  readonly biomecollisionmap_check_positions: (a: number, b: number, c: number, d: number) => void;
  readonly biomecollisionmap_clear_cache: (a: number) => void;
  readonly biomecollisionmap_update_traversability: (a: number, b: number, c: number) => void;
  readonly __wbg_simcore_free: (a: number, b: number) => void;
  readonly simcore_new: (a: number, b: number, c: number, d: number) => number;
  readonly simcore_set_count: (a: number, b: number) => void;
  readonly simcore_get_pos_x_ptr: (a: number) => number;
  readonly simcore_get_pos_y_ptr: (a: number) => number;
  readonly simcore_get_vel_x_ptr: (a: number) => number;
  readonly simcore_get_vel_y_ptr: (a: number) => number;
  readonly simcore_rebuild_spatial_hash: (a: number) => void;
  readonly simcore_process_movement_batch: (a: number, b: number, c: number, d: number) => number;
  readonly simcore_integrate_physics_batch: (a: number, b: number, c: number, d: number) => void;
  readonly simcore_load_from_buffers: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number) => void;
  readonly simcore_write_to_buffers: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
  readonly init: () => void;
  readonly __wbg_set_vec2_x: (a: number, b: number) => void;
  readonly __wbg_set_vec2_y: (a: number, b: number) => void;
  readonly __wbg_set_perfmetrics_movement_ms: (a: number, b: number) => void;
  readonly __wbg_set_perfmetrics_spatial_hash_ms: (a: number, b: number) => void;
  readonly __wbg_set_perfmetrics_physics_ms: (a: number, b: number) => void;
  readonly __wbg_set_perfmetrics_total_ms: (a: number, b: number) => void;
  readonly __wbg_get_vec2_x: (a: number) => number;
  readonly __wbg_get_vec2_y: (a: number) => number;
  readonly __wbg_get_perfmetrics_movement_ms: (a: number) => number;
  readonly __wbg_get_perfmetrics_spatial_hash_ms: (a: number) => number;
  readonly __wbg_get_perfmetrics_physics_ms: (a: number) => number;
  readonly __wbg_get_perfmetrics_total_ms: (a: number) => number;
  readonly __wbindgen_export_0: (a: number) => void;
  readonly __wbindgen_export_1: (a: number, b: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export_2: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
