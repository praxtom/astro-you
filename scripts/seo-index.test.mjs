// The app shell routes guides from the tiny slug index; the article text lives
// in seo-content. This keeps the two from drifting apart. Pure, offline.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.endsWith(".js") &&
      specifier.startsWith(".") &&
      context.parentURL
    ) {
      const source = new URL(
        specifier.replace(/\.js$/, ".ts"),
        context.parentURL,
      );
      if (existsSync(source)) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
});
const [seo, index] = await Promise.all(
  ["seo-content", "seo-index"].map((name) => import(`../src/lib/${name}.ts`)),
);

test("the route index lists exactly the standalone guide pages", () => {
  const fromContent = seo.SEO_CONTENT_PAGES.map((page) => page.slug).sort();
  const fromIndex = [...index.SEO_CONTENT_SLUGS].sort();
  assert.deepEqual(fromIndex, fromContent);
  assert.equal(new Set(fromIndex).size, fromIndex.length);
});

test("redirect tables are the same object in both modules", () => {
  assert.equal(seo.SEO_GUIDE_REDIRECTS, index.SEO_GUIDE_REDIRECTS);
  assert.equal(seo.MERGED_SEO_GUIDES, index.MERGED_SEO_GUIDES);
});

test("the app shell does not import the guide content eagerly", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(!/from\s+["']\.\/lib\/seo-content["']/.test(app));
});
