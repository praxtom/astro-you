import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("production CSP permits consented Firebase Analytics delivery", () => {
  const netlifyConfig = readFileSync("netlify.toml", "utf8");
  const csp = netlifyConfig.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(csp, "Content-Security-Policy header must be configured");

  const directives = Object.fromEntries(
    csp.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );

  assert.ok(
    directives["script-src"].includes("https://www.googletagmanager.com"),
    "Firebase Analytics must be allowed to load gtag.js",
  );
  assert.ok(
    directives["connect-src"].includes("https://www.google-analytics.com"),
    "Firebase Analytics must be allowed to send consented events",
  );
});
