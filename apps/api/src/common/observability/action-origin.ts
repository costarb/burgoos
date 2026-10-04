import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Origin of a write performed outside the screens (e.g. "MCP · Claude"). Services that audit
 * writes read it so callers do not have to thread it through every signature; screens leave it
 * empty (null).
 */
const storage = new AsyncLocalStorage<{ channel: string }>();

export function runWithActionOrigin<T>(channel: string, callback: () => Promise<T>): Promise<T> {
  return storage.run({ channel }, callback);
}

export function currentActionOrigin(): string | null {
  return storage.getStore()?.channel ?? null;
}
