import test from "node:test";
import assert from "node:assert/strict";
import {
  SEO_CONTENT_PAGES,
  getSeoClusterPages,
  getSeoContentFaqs,
} from "../../../src/lib/seo-content.js";

test("SEO content includes programmatic astrology clusters", () => {
  const nakshatraPages = SEO_CONTENT_PAGES.filter((page) =>
    page.path.startsWith("/nakshatra/"),
  );
  const planetPages = SEO_CONTENT_PAGES.filter((page) => page.path.startsWith("/planet/"));
  const housePages = SEO_CONTENT_PAGES.filter((page) => page.path.startsWith("/house/"));
  const planetHousePages = SEO_CONTENT_PAGES.filter((page) =>
    page.path.startsWith("/planet-in-house/"),
  );

  assert.equal(nakshatraPages.length, 27);
  assert.equal(planetPages.length, 9);
  assert.equal(housePages.length, 12);
  assert.equal(planetHousePages.length, 108);
});

test("SEO content includes index pages for every programmatic cluster", () => {
  const paths = new Set(SEO_CONTENT_PAGES.map((page) => page.path));

  assert.equal(paths.has("/nakshatra"), true);
  assert.equal(paths.has("/planet"), true);
  assert.equal(paths.has("/house"), true);
  assert.equal(paths.has("/planet-in-house"), true);
});

test("SEO content paths and slugs stay unique", () => {
  const paths = SEO_CONTENT_PAGES.map((page) => page.path);
  const slugs = SEO_CONTENT_PAGES.map((page) => page.slug);

  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("SEO content exposes full internal-link clusters", () => {
  assert.equal(getSeoClusterPages("nakshatra").length, 27);
  assert.equal(getSeoClusterPages("nakshatra/ashwini").length, 27);
  assert.equal(getSeoClusterPages("planet").length, 9);
  assert.equal(getSeoClusterPages("planet/saturn").length, 9);
  assert.equal(getSeoClusterPages("house").length, 12);
  assert.equal(getSeoClusterPages("house/seventh-house").length, 12);
  assert.equal(getSeoClusterPages("planet-in-house/sun/first-house").length, 12);
  assert.ok(
    getSeoClusterPages("planet-in-house/sun/first-house").every((page) =>
      page.slug.startsWith("planet-in-house/sun/"),
    ),
  );
  assert.deepEqual(getSeoClusterPages("kundali"), []);
});

test("SEO content exposes FAQ entries for every programmatic guide", () => {
  for (const page of SEO_CONTENT_PAGES) {
    const faqs = getSeoContentFaqs(page);

    assert.ok(faqs.length >= 3, `${page.path} should have at least three FAQs`);
    assert.ok(
      faqs.some((faq) => faq.question.includes(page.heading)),
      `${page.path} should include a page-specific FAQ`,
    );
    assert.ok(
      faqs.every((faq) => faq.answer.length >= 40),
      `${page.path} should avoid thin FAQ answers`,
    );
  }
});
