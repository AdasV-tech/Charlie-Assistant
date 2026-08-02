// One localStorage-backed store factory, reused by every module's saved
// state instead of each feature hand-rolling its own load/save/try-catch
// pair. Corrupted or missing data always falls back to `defaultValue`
// rather than throwing — a bad localStorage entry should never crash boot.
//
// `serialize`/`deserialize` default to JSON, but can be overridden (see the
// Gemini API key store, which is a raw string with no JSON quoting, to stay
// byte-for-byte compatible with what earlier versions of Charlie wrote).
export function createStore(key, defaultValue, options = {}) {
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? JSON.parse;

  // Returns a fresh copy each time so nothing can accidentally mutate the
  // shared default and corrupt every future fallback/reset.
  function freshDefault() {
    return typeof defaultValue === 'object' && defaultValue !== null
      ? structuredClone(defaultValue)
      : defaultValue;
  }

  function read() {
    const raw = localStorage.getItem(key);
    if (raw === null) return freshDefault();
    try {
      return deserialize(raw);
    } catch {
      return freshDefault();
    }
  }

  let value = read();
  const subscribers = new Set();

  return {
    get() {
      return value;
    },
    set(next) {
      value = next;
      localStorage.setItem(key, serialize(value));
      subscribers.forEach((fn) => fn(value));
    },
    update(updater) {
      this.set(updater(value));
    },
    reset() {
      this.set(freshDefault());
    },
    // Returns an unsubscribe function.
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
