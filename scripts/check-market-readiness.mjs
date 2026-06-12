import { spawnSync } from "node:child_process";

const includeLiveServices = process.argv.includes("--live");

const checks = [
  {
    key: "tests",
    label: "TypeScript and function tests",
    command: ["pnpm", ["test"]],
  },
  {
    key: "build",
    label: "Production build and SEO prerender",
    command: ["pnpm", ["run", "build"]],
  },
  {
    key: "launch",
    label: "Production environment readiness",
    command: ["pnpm", ["run", "check:launch"]],
  },
  ...(includeLiveServices
    ? [
        {
          key: "services",
          label: "Live Firebase service access",
          command: ["pnpm", ["run", "check:services"]],
        },
      ]
    : []),
];

const results = [];

console.log("Market readiness checks\n");

for (const check of checks) {
  console.log(`▶ ${check.label}`);
  const [command, args] = check.command;
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  results.push({
    key: check.key,
    label: check.label,
    ok: result.status === 0,
  });
  console.log("");
}

const failed = results.filter((result) => !result.ok);

console.log("Market readiness summary");
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}\t${result.label}`);
}

if (!includeLiveServices) {
  console.log("\nLive services were skipped. Run `pnpm run check:market:live` before launch.");
}

console.log(`\nMarket readiness: ${failed.length > 0 ? "BLOCKED" : "READY"}`);
process.exitCode = failed.length > 0 ? 1 : 0;
