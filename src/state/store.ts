import { useEffect, useReducer } from 'preact/hooks';

export interface Store<T> {
  get(): T;
  set(updater: (state: T) => T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => state,
    set(updater) {
      const next = updater(state);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/**
 * Subscribes a component to the whole store. There is one store and a handful
 * of views, so re-rendering the tree on every change is cheaper than the
 * bookkeeping a selector-level subscription would need.
 */
export function useStoreState<T>(store: Store<T>): T {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => store.subscribe(() => force(undefined)), [store]);
  return store.get();
}
