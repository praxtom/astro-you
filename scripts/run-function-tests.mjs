import { readdir } from "node:fs/promises";
import path from "node:path";
import { run } from "node:test";
import { spec } from "node:test/reporters";

const testDir = path.resolve("node_modules/.tmp/functions-tests/netlify/functions/__tests__");

const entries = await readdir(testDir);
const files = entries
  .filter((entry) => entry.endsWith(".test.js"))
  .map((entry) => path.join(testDir, entry))
  .sort();

if (!files.length) {
  console.error(`No compiled function tests found in ${testDir}`);
  process.exit(1);
}

let failed = false;
const stream = run({ files, concurrency: false });
stream.on("test:fail", () => {
  failed = true;
});
stream.on("end", () => {
  if (failed) process.exitCode = 1;
});
stream.compose(spec).pipe(process.stdout);
