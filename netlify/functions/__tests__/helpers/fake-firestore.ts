/**
 * Tiny in-memory Firestore stand-in for transaction-level billing tests.
 * Enforces the real SDK's "all reads before writes" rule, applies writes only
 * when the transaction callback resolves, and supports increment / delete /
 * serverTimestamp sentinels plus merge-sets.
 */

type Data = Record<string, any>;

const INC = Symbol("increment");
const DEL = Symbol("delete");

export interface FakeRef {
  id: string;
  path: string;
  collection(name: string): { doc(id?: string): FakeRef };
}

function makeCollection(path: string) {
  let auto = 0;
  return {
    doc(id?: string): FakeRef {
      const docId = id ?? `auto_${++auto}`;
      const docPath = `${path}/${docId}`;
      return {
        id: docId,
        path: docPath,
        collection(name: string) {
          return makeCollection(`${docPath}/${name}`);
        },
      };
    },
  };
}

function isPlainObject(value: unknown): value is Data {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(INC in (value as object)) &&
    !(DEL in (value as object))
  );
}

function resolveValue(current: unknown, next: unknown): unknown {
  if (next && typeof next === "object" && INC in (next as object)) {
    return (typeof current === "number" ? current : 0) + (next as any)[INC];
  }
  return next;
}

function mergeInto(target: Data, patch: Data): Data {
  const out: Data = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && DEL in (value as object)) {
      delete out[key];
    } else if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeInto(out[key], value);
    } else if (isPlainObject(value)) {
      out[key] = mergeInto({}, value);
    } else {
      out[key] = resolveValue(out[key], value);
    }
  }
  return out;
}

export function createFakeFirestore(initial: Record<string, Data> = {}) {
  const store = new Map<string, Data>(
    Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]),
  );

  const FieldValue = {
    increment(value: number) {
      return { [INC]: value };
    },
    serverTimestamp() {
      return "server-timestamp";
    },
    delete() {
      return { [DEL]: true };
    },
  };

  let transactionQueue = Promise.resolve();
  const db = {
    collection(name: string) {
      return makeCollection(name);
    },
    async runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>(resolve => { release = resolve; });
      await previous;
      try {
      const writes: Array<() => void> = [];
      const tx = {
        async get(ref: FakeRef) {
          if (writes.length > 0) {
            throw new Error(
              "Firestore transactions require all reads to be executed before all writes.",
            );
          }
          const data = store.get(ref.path);
          return {
            exists: data !== undefined,
            data: () =>
              data === undefined ? undefined : structuredClone(data),
          };
        },
        set(ref: FakeRef, data: Data, options?: { merge?: boolean }) {
          writes.push(() => {
            const current = store.get(ref.path) ?? {};
            store.set(
              ref.path,
              options?.merge ? mergeInto(current, data) : mergeInto({}, data),
            );
          });
        },
        update(ref: FakeRef, data: Data) {
          writes.push(() => {
            const current = store.get(ref.path);
            if (current === undefined)
              throw new Error(`No document: ${ref.path}`);
            const next: Data = { ...current };
            for (const [key, value] of Object.entries(data)) {
              if (
                value &&
                typeof value === "object" &&
                DEL in (value as object)
              ) {
                delete next[key];
              } else {
                next[key] = resolveValue(current[key], value);
              }
            }
            store.set(ref.path, next);
          });
        },
      };
      const result = await callback(tx);
      writes.forEach((apply) => apply());
      return result;
      } finally { release(); }
    },
  };

  return {
    db,
    FieldValue,
    store,
    get(path: string): Data | undefined {
      return store.get(path);
    },
  };
}
