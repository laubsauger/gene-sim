import type { SimInit, WorkerMsg, MainMsg } from '../sim/types';

export type SimClient = ReturnType<typeof setupSimClient>;

export function setupSimClient(worker: Worker) {
  let pos: Float32Array | null = null;
  let color: Uint8Array | null = null;
  let alive: Uint8Array | null = null;
  let count = 0;
  const listeners = new Set<(m: MainMsg) => void>();

  worker.onmessage = (e: MessageEvent<MainMsg>) => {
    const msg = e.data;
    if (msg.type === 'ready') {
      const { sab, meta } = msg.payload;
      pos = new Float32Array(sab.pos);
      color = new Uint8Array(sab.color);
      alive = new Uint8Array(sab.alive);
      count = meta.count;
    }
    listeners.forEach(l => l(msg));
  };

  return {
    init(payload: SimInit) {
      worker.postMessage({ type: 'init', payload } as WorkerMsg);
    },
    setSpeed(speedMul: number) {
      worker.postMessage({ type: 'setSpeed', payload: { speedMul } } as WorkerMsg);
    },
    pause(paused: boolean) {
      worker.postMessage({ type: 'pause', payload: { paused } } as WorkerMsg);
    },
    onMessage(cb: (m: MainMsg) => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    get buffers() {
      return { pos, color, alive, count };
    },
  };
}