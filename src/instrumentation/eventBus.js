import { EventEmitter } from 'events';

// Simple EventEmitter-based bus for instrumentation events
export const bus = new EventEmitter();

export function emit(event, payload) {
  bus.emit(event, payload);
}

export function on(event, handler) {
  bus.on(event, handler);
}

export function off(event, handler) {
  bus.off(event, handler);
}

