import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const env = {
  ...loadDotEnv(resolve(root, ".env")),
  ...process.env,
};

execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.functions-test.json", "--pretty", "false"], {
  cwd: root,
  stdio: "ignore",
});

const { buildLaunchReadinessReport } = await import(
  `file://${resolve(root, "node_modules/.tmp/functions-tests/netlify/functions/shared/launch-readiness.js")}`
);
const report = buildLaunchReadinessReport(env);

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
    console.log(`  ${item.status.padEnd(10)} ${required.padEnd(8)} ${item.key}`);
  }
}

if (report.warnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of report.warnings) {
    console.log(`  - ${warning}`);
  }
}

process.exitCode = report.overallStatus === "blocked" ? 1 : 0;

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
