import type { EditOperation } from '../types/operations';

let _counter = 0;

/** Returns a monotonically increasing timestamp with sub-millisecond disambiguation. */
function nextTs(): number {
  return Date.now() * 1000 + (_counter++ % 1000);
}

/** Generates a simple unique id prefixed by type. */
function newId(type: string): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates an EditOperation with a unique id and timestamp.
 * The `type`, `pageIndex`, and operation-specific payload must be supplied.
 */
export function createOperation<T extends EditOperation>(
  payload: Omit<T, 'id' | 'ts'>,
): T {
  return {
    id: newId(payload.type),
    ts: nextTs(),
    ...payload,
  } as T;
}
