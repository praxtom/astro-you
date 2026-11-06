import test from "node:test";
import assert from "node:assert/strict";
import { forgetAllInteractions } from "../shared/forget-all-interactions.js";
import type { RetentionDb } from "../shared/interaction-retention.js";

function fakeDb(
  logs: Record<string, string[]>,
  deleted: string[],
  paths: string[],
): RetentionDb {
  return {
    collection(name: string) {
      paths.push(name);
      return {
        doc(uid: string) {
          paths.push(uid);
          return {
            collection(sub: string) {
              paths.push(sub);
              return {
                async get() {
                  return {
                    docs: Object.entries(logs).map(([id, ids]) => ({
                      id,
                      data: () => ({ ids }),
                    })),
                  };
                },
                doc(id: string) {
                  return {
                    async get() {
                      return { exists: false, data: () => undefined };
                    },
                    async set() {},
                    async delete() {
                      deleted.push(id);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as RetentionDb;
}

test("forget-all purges every logged interaction and clears the log", async () => {
  const deleted: string[] = [];
  const paths: string[] = [];
  const purged: string[][] = [];
  const result = await forgetAllInteractions(
    {
      db: fakeDb(
        {
          chat_a: ["int_1", "int_2"],
          chat_b: ["int_2", "int_3", "bad id with spaces"],
          _unassigned: ["int_4"],
        },
        deleted,
        paths,
      ),
      async purge(ids) {
        purged.push(ids);
        return { queued: ids.length };
      },
    },
    "uid_1",
  );

  assert.deepEqual(paths, ["users", "uid_1", "interactionLog"]);
  assert.deepEqual(purged, [["int_1", "int_2", "int_3", "int_4"]]);
  assert.deepEqual(deleted.sort(), ["_unassigned", "chat_a", "chat_b"]);
  assert.deepEqual(result, { logs: 3, interactionsQueued: 4 });
});

test("forget-all keeps the log when the purge hand-off fails", async () => {
  const deleted: string[] = [];
  await assert.rejects(
    forgetAllInteractions(
      {
        db: fakeDb({ chat_a: ["int_1"] }, deleted, []),
        async purge() {
          throw new Error("dispatch down");
        },
      },
      "uid_1",
    ),
  );
  assert.deepEqual(deleted, []);
});
