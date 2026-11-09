import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const env = {
  ...loadDotEnv(resolve(root, ".env")),
  ...process.env,
};
const compiledRoot = resolve(root, "node_modules/.tmp/functions-tests");

// Run the project's own tsc through node: independent of npm/pnpm/npx.
execFileSync(
  process.execPath,
  [
    resolve(root, "node_modules/typescript/bin/tsc"),
    "-p",
    "tsconfig.functions-test.json",
    "--pretty",
    "false",
  ],
  { cwd: root, stdio: "ignore" },
);

const { buildLaunchReadinessReport } = await import(
  `file://${resolve(compiledRoot, "netlify/functions/shared/launch-readiness.js")}`
);
const report = buildLaunchReadinessReport(env);
const legalCheckFailed = runLegalPlaceholderCheck();

console.log(`Launch readiness: ${report.overallStatus.toUpperCase()}`);
console.log(
  `Required configured: ${report.summary.configuredRequired}/${report.summary.requiredTotal}`,
);
console.log(`Missing required: ${report.summary.missingRequired}`);
console.log(`Warnings: ${report.summary.warnings}`);

for (const group of report.groups) {
  console.log(`\n${group.label}: ${group.status}`);
  for (const item of group.items) {
    const required = item.required ? "required" : "optional";
    console.log(
      `  ${item.status.padEnd(10)} ${required.padEnd(8)} ${item.key}`,
    );
  }
}

if (report.warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of report.warnings) {
    console.log(`  - ${warning}`);
  }
}

process.exitCode =
  report.overallStatus === "blocked" || legalCheckFailed ? 1 : 0;

/**
 * Optional (LEGAL_PLACEHOLDER_CHECK=1): run the legal-placeholder test suite,
 * which fails while the legal pages still carry template placeholders
 * (operator name, address, grievance officer…). Looks for any compiled
 * function test or scripts/*.test.mjs whose name mentions legal + placeholder,
 * so it keeps working whatever the suite is called. Returns true on failure.
 */
function runLegalPlaceholderCheck() {
  if (env.LEGAL_PLACEHOLDER_CHECK !== "1") return false;
  const pattern = /legal.*placeholder|placeholder.*legal/i;
  const candidates = [
    ...listTests(
      resolve(compiledRoot, "netlify/functions/__tests__"),
      ".test.js",
    ),
    ...listTests(resolve(root, "scripts"), ".test.mjs"),
  ].filter((file) => pattern.test(file));
  if (candidates.length === 0) {
    console.log(
      "\nLegal placeholder check: no legal placeholder test found; skipped.",
    );
    return false;
  }
  const result = spawnSync(process.execPath, ["--test", ...candidates], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  const failed = result.status !== 0;
  console.log(`\nLegal placeholder check: ${failed ? "FAILED" : "passed"}`);
  return failed;
}

function listTests(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => resolve(dir, name));
}

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((env, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return env;
      const separator = line.indexOf("=");
      if (separator === -1) return env;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return env;
      env[key] = stripQuotes(value);
      return env;
    }, {});
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
