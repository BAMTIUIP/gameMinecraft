/**
 * Single storage facade for the whole game.
 *
 * Why it exists (https://yandex.ru/dev/games/doc/ru/sdk/sdk-player#progress-loss):
 *  - when the game is uploaded as an archive, the SDK wraps `localStorage` itself and keeps it
 *    reliable, so the native one is fine;
 *  - on a custom domain (own hosting, itch) iOS Safari can clear `localStorage` at any moment and
 *    players lose progress. The SDK's `ysdk.getStorage()` returns a `safeStorage` with the same
 *    interface, and the docs suggest overriding `localStorage` globally with it.
 *
 * Every read/write in the game goes through this module, so the swap happens in one place no
 * matter which entry point (engine save, high scores, language, mode) touches storage.
 */

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** in-memory fallback: private mode, blocked cookies, quota 0 — the game must still boot */
const memory = new Map<string, string>();
const memoryStore: Store = {
  getItem: (key) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key, value) => {
    memory.set(key, String(value));
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

function nativeStore(): Store | null {
  try {
    const ls = typeof localStorage === 'undefined' ? null : localStorage;
    if (!ls || typeof ls.getItem !== 'function') return null;
    ls.getItem('orerush.storageProbe'); // touch it: throws when storage is blocked
    return ls;
  } catch {
    return null;
  }
}

let backend: Store = nativeStore() ?? memoryStore;
let sdkStorageInstalled = false;

/** true when the SDK's safeStorage (or another injected store) is in use */
export function hasSafeStorage() {
  return sdkStorageInstalled;
}

export function storageGet(key: string): string | null {
  try {
    return backend.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): boolean {
  try {
    backend.setItem(key, value);
    return true;
  } catch {
    // quota exceeded / storage disabled: keep the session alive, the caller decides what to report
    return false;
  }
}

export function storageRemove(key: string) {
  try {
    backend.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function storageHas(key: string): boolean {
  return storageGet(key) !== null;
}

/**
 * `safeStorage` from the SDK (docs recommend overriding the global as well, so any library —
 * Three.js, React devtools — sees the same reliable store). Call as early as possible, before
 * the first game write; reads that already happened keep their native values.
 */
export function installSafeStorage(storage: Store) {
  backend = storage;
  sdkStorageInstalled = true;
  try {
    Object.defineProperty(window, 'localStorage', { get: () => storage, configurable: true });
  } catch {
    // some browsers make the property non-configurable: the facade still uses safeStorage,
    // only third-party code keeps the native one
  }
}
