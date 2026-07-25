import { EventEmitter } from "node:events";

// In-process pub/sub so SSE connections learn when the board changes.
// Reused across hot-reloads in dev.
const g = globalThis as unknown as { __bus?: EventEmitter };

export const bus: EventEmitter =
  g.__bus ?? (g.__bus = new EventEmitter().setMaxListeners(0));

export function emitChange() {
  bus.emit("change");
}
