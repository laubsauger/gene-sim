let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export_0(addHeapObject(e));
    }
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedUint16ArrayMemory0 = null;

function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

function passArray16ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 2, 2) >>> 0;
    getUint16ArrayMemory0().set(arg, ptr / 2);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

export function init() {
    wasm.init();
}

const EntityGenesFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_entitygenes_free(ptr >>> 0, 1));

export class EntityGenes {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EntityGenesFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_entitygenes_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get speed() {
        const ret = wasm.__wbg_get_entitygenes_speed(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set speed(arg0) {
        wasm.__wbg_set_entitygenes_speed(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get vision() {
        const ret = wasm.__wbg_get_entitygenes_vision(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set vision(arg0) {
        wasm.__wbg_set_entitygenes_vision(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get metabolism() {
        const ret = wasm.__wbg_get_entitygenes_metabolism(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set metabolism(arg0) {
        wasm.__wbg_set_entitygenes_metabolism(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get repro_chance() {
        const ret = wasm.__wbg_get_entitygenes_repro_chance(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set repro_chance(arg0) {
        wasm.__wbg_set_entitygenes_repro_chance(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get aggression() {
        const ret = wasm.__wbg_get_entitygenes_aggression(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set aggression(arg0) {
        wasm.__wbg_set_entitygenes_aggression(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get cohesion() {
        const ret = wasm.__wbg_get_entitygenes_cohesion(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set cohesion(arg0) {
        wasm.__wbg_set_entitygenes_cohesion(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get food_standards() {
        const ret = wasm.__wbg_get_entitygenes_food_standards(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set food_standards(arg0) {
        wasm.__wbg_set_entitygenes_food_standards(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get diet() {
        const ret = wasm.__wbg_get_entitygenes_diet(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set diet(arg0) {
        wasm.__wbg_set_entitygenes_diet(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get view_angle() {
        const ret = wasm.__wbg_get_entitygenes_view_angle(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set view_angle(arg0) {
        wasm.__wbg_set_entitygenes_view_angle(this.__wbg_ptr, arg0);
    }
    constructor() {
        const ret = wasm.entitygenes_new();
        this.__wbg_ptr = ret >>> 0;
        EntityGenesFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const PerfMetricsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_perfmetrics_free(ptr >>> 0, 1));

export class PerfMetrics {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PerfMetricsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_perfmetrics_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get movement_ms() {
        const ret = wasm.__wbg_get_entitygenes_speed(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set movement_ms(arg0) {
        wasm.__wbg_set_entitygenes_speed(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get spatial_hash_ms() {
        const ret = wasm.__wbg_get_entitygenes_vision(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set spatial_hash_ms(arg0) {
        wasm.__wbg_set_entitygenes_vision(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get physics_ms() {
        const ret = wasm.__wbg_get_entitygenes_metabolism(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set physics_ms(arg0) {
        wasm.__wbg_set_entitygenes_metabolism(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get total_ms() {
        const ret = wasm.__wbg_get_entitygenes_repro_chance(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set total_ms(arg0) {
        wasm.__wbg_set_entitygenes_repro_chance(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get entities_processed() {
        const ret = wasm.__wbg_get_perfmetrics_entities_processed(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set entities_processed(arg0) {
        wasm.__wbg_set_perfmetrics_entities_processed(this.__wbg_ptr, arg0);
    }
    constructor() {
        const ret = wasm.perfmetrics_new();
        this.__wbg_ptr = ret >>> 0;
        PerfMetricsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const SimCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_simcore_free(ptr >>> 0, 1));

export class SimCore {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SimCoreFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_simcore_free(ptr, 0);
    }
    /**
     * @param {number} capacity
     * @param {number} world_width
     * @param {number} world_height
     * @param {number} cell_size
     */
    constructor(capacity, world_width, world_height, cell_size) {
        const ret = wasm.simcore_new(capacity, world_width, world_height, cell_size);
        this.__wbg_ptr = ret >>> 0;
        SimCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} count
     */
    set_count(count) {
        wasm.simcore_set_count(this.__wbg_ptr, count);
    }
    /**
     * @returns {number}
     */
    get_pos_x_ptr() {
        const ret = wasm.simcore_get_pos_x_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_pos_y_ptr() {
        const ret = wasm.simcore_get_pos_y_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_vel_x_ptr() {
        const ret = wasm.simcore_get_vel_x_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_vel_y_ptr() {
        const ret = wasm.simcore_get_vel_y_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    rebuild_spatial_hash() {
        wasm.simcore_rebuild_spatial_hash(this.__wbg_ptr);
    }
    /**
     * @param {number} start_idx
     * @param {number} end_idx
     * @param {number} dt
     * @returns {number}
     */
    process_movement_batch(start_idx, end_idx, dt) {
        const ret = wasm.simcore_process_movement_batch(this.__wbg_ptr, start_idx, end_idx, dt);
        return ret;
    }
    /**
     * @param {number} start_idx
     * @param {number} end_idx
     * @param {number} dt
     */
    integrate_physics_batch(start_idx, end_idx, dt) {
        wasm.simcore_integrate_physics_batch(this.__wbg_ptr, start_idx, end_idx, dt);
    }
    /**
     * @param {Float32Array} pos_x
     * @param {Float32Array} pos_y
     * @param {Float32Array} vel_x
     * @param {Float32Array} vel_y
     * @param {Float32Array} energy
     * @param {Uint8Array} alive
     * @param {Uint16Array} tribe_id
     * @param {Float32Array} genes
     */
    load_from_buffers(pos_x, pos_y, vel_x, vel_y, energy, alive, tribe_id, genes) {
        const ptr0 = passArrayF32ToWasm0(pos_x, wasm.__wbindgen_export_1);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(pos_y, wasm.__wbindgen_export_1);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(vel_x, wasm.__wbindgen_export_1);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF32ToWasm0(vel_y, wasm.__wbindgen_export_1);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArrayF32ToWasm0(energy, wasm.__wbindgen_export_1);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passArray8ToWasm0(alive, wasm.__wbindgen_export_1);
        const len5 = WASM_VECTOR_LEN;
        const ptr6 = passArray16ToWasm0(tribe_id, wasm.__wbindgen_export_1);
        const len6 = WASM_VECTOR_LEN;
        const ptr7 = passArrayF32ToWasm0(genes, wasm.__wbindgen_export_1);
        const len7 = WASM_VECTOR_LEN;
        wasm.simcore_load_from_buffers(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, ptr7, len7);
    }
    /**
     * @param {Float32Array} pos_x
     * @param {Float32Array} pos_y
     * @param {Float32Array} vel_x
     * @param {Float32Array} vel_y
     */
    write_to_buffers(pos_x, pos_y, vel_x, vel_y) {
        var ptr0 = passArrayF32ToWasm0(pos_x, wasm.__wbindgen_export_1);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = passArrayF32ToWasm0(pos_y, wasm.__wbindgen_export_1);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = passArrayF32ToWasm0(vel_x, wasm.__wbindgen_export_1);
        var len2 = WASM_VECTOR_LEN;
        var ptr3 = passArrayF32ToWasm0(vel_y, wasm.__wbindgen_export_1);
        var len3 = WASM_VECTOR_LEN;
        wasm.simcore_write_to_buffers(this.__wbg_ptr, ptr0, len0, addHeapObject(pos_x), ptr1, len1, addHeapObject(pos_y), ptr2, len2, addHeapObject(vel_x), ptr3, len3, addHeapObject(vel_y));
    }
}

const SpatialHashFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_spatialhash_free(ptr >>> 0, 1));

export class SpatialHash {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SpatialHashFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_spatialhash_free(ptr, 0);
    }
}

const Vec2Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_vec2_free(ptr >>> 0, 1));

export class Vec2 {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Vec2Finalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_vec2_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_entitygenes_speed(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_entitygenes_speed(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_entitygenes_vision(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_entitygenes_vision(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
        const ret = wasm.vec2_new(x, y);
        this.__wbg_ptr = ret >>> 0;
        Vec2Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    length() {
        const ret = wasm.vec2_length(this.__wbg_ptr);
        return ret;
    }
    normalize() {
        wasm.vec2_normalize(this.__wbg_ptr);
    }
    /**
     * @param {Vec2} other
     * @returns {number}
     */
    dot(other) {
        _assertClass(other, Vec2);
        const ret = wasm.vec2_dot(this.__wbg_ptr, other.__wbg_ptr);
        return ret;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = getObject(arg0).call(getObject(arg1));
        return addHeapObject(ret);
    }, arguments) };
    imports.wbg.__wbg_instanceof_Window_def73ea0955fc569 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Window;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_log_c222819a41e063d3 = function(arg0) {
        console.log(getObject(arg0));
    };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_now_d18023d54d4e5500 = function(arg0) {
        const ret = getObject(arg0).now();
        return ret;
    };
    imports.wbg.__wbg_performance_c185c0cdc2766575 = function(arg0) {
        const ret = getObject(arg0).performance;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addHeapObject(ret);
    };
    imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
        new Uint8Array(getObject(arg2).buffer, getObject(arg2).byteOffset, getObject(arg2).byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = getObject(arg0) === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
        const ret = getObject(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('gene_sim_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
