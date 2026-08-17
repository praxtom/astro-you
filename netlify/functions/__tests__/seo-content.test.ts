import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  SEO_CONTENT_PAGES,
  getSeoClusterPages,
  getSeoContentFaqs,
} from "../../../src/lib/seo-content.js";

const KNOWN_PUBLIC_ROUTES = new Set([
  "/",
  "/consult/arjun-sharma/profile",
  "/free-kundali",
  "/free-kundali-matching",
  "/horoscope/aries/daily",
  "/muhurat",
  "/numerology",
  "/remedies",
  "/synthesis",
  "/trust",
  "/consult/meera-devi/profile",
  "/consult/nanda-ji/profile",
  "/consult/pandit-raghunath/profile",
  "/panchang",
  "/pricing",
]);

const REQUIRED_SEO_TOOL_PATHS = [
  "/moon-sign-calculator",
  "/nakshatra-finder",
  "/sade-sati-calculator",
  "/manglik-dosha-checker",
  "/dasha-calculator",
  "/panchang-today",
];

test("SEO content includes programmatic astrology clusters", () => {
  const nakshatraPages = SEO_CONTENT_PAGES.filter((page) =>
    page.path.startsWith("/nakshatra/"),
  );
  const planetPages = SEO_CONTENT_PAGES.filter((page) =>
    page.path.startsWith("/planet/"),
  );
  const housePages = SEO_CONTENT_PAGES.filter((page) =>
    page.path.startsWith("/house/"),
  );
  const planetHousePages = SEO_CONTENT_PAGES.filter((page) =>
    page.path.startsWith("/planet-in-house/"),
  );

  assert.equal(nakshatraPages.length, 27);
  assert.equal(planetPages.length, 9);
  assert.equal(housePages.length, 12);
  assert.equal(planetHousePages.length, 108);
});

test("SEO default social image asset exists", () => {
  assert.equal(
    existsSync(path.resolve("public/og-image.svg")),
    true,
    "public/og-image.svg should exist for share previews",
  );
});

test("SEO includes priority free-tool landing pages", () => {
  const paths = new Set(SEO_CONTENT_PAGES.map((page) => page.path));

  for (const requiredPath of REQUIRED_SEO_TOOL_PATHS) {
    assert.equal(
      paths.has(requiredPath),
      true,
      `${requiredPath} should be indexable`,
    );
  }
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

test("SEO content has useful depth and valid conversion paths", () => {
  const seoPaths = new Set(SEO_CONTENT_PAGES.map((page) => page.path));
  for (const page of SEO_CONTENT_PAGES) {
    const sectionWordCount = page.sections
      .map((section) => section.body.split(/\s+/).filter(Boolean).length)
      .reduce((total, count) => total + count, 0);

    assert.ok(
      page.title.length >= 20,
      `${page.path} should have a useful title`,
    );
    assert.ok(
      page.description.length >= 90,
      `${page.path} should have a specific meta description`,
    );
    assert.ok(
      sectionWordCount >= 60,
      `${page.path} should avoid thin section content`,
    );

    for (const cta of [page.primaryCta, page.secondaryCta]) {
      assert.ok(
        KNOWN_PUBLIC_ROUTES.has(cta.to) || seoPaths.has(cta.to),
        `${page.path} CTA ${cta.to} should point to a known route`,
      );
    }
  }
});

test("SEO content exposes full internal-link clusters", () => {
  assert.equal(getSeoClusterPages("nakshatra").length, 27);
  assert.equal(getSeoClusterPages("nakshatra/ashwini").length, 27);
  assert.equal(getSeoClusterPages("planet").length, 9);
  assert.equal(getSeoClusterPages("planet/saturn").length, 9);
  assert.equal(getSeoClusterPages("house").length, 12);
  assert.equal(getSeoClusterPages("house/seventh-house").length, 12);
  assert.equal(
    getSeoClusterPages("planet-in-house/sun/first-house").length,
    12,
  );
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
      faqs.every((faq) => faq.answer.length >= 40),
      `${page.path} should avoid thin FAQ answers`,
    );
  }
});

/**
 * The failure this guards against: every page used to receive the same three
 * generated FAQs with only the heading interpolated, so two of three answers
 * were byte-identical across the whole site. Identical text on hundreds of
 * URLs is worth nothing as extractable content and reads as doorway pages.
 * Assert distinctness directly rather than proxying it through "does the
 * question mention the heading", which the old generated phrasing satisfied
 * while being entirely generic.
 */
test("SEO content answers are not duplicated across pages", () => {
  const answerOwners = new Map<string, string[]>();
  for (const page of SEO_CONTENT_PAGES) {
    for (const faq of getSeoContentFaqs(page)) {
      const owners = answerOwners.get(faq.answer) ?? [];
      owners.push(page.path);
      answerOwners.set(faq.answer, owners);
    }
  }

  const shared = [...answerOwners.entries()].filter(
    ([, owners]) => owners.length > 1,
  );

  assert.deepEqual(
    shared.map(
      ([answer, owners]) => `${owners.length}× ${answer.slice(0, 60)}`,
    ),
    [],
    "no FAQ answer should appear on more than one page",
  );
});

test("SEO content section prose is not duplicated across pages", () => {
  const bodyOwners = new Map<string, string[]>();
  for (const page of SEO_CONTENT_PAGES) {
    for (const section of page.sections) {
      const owners = bodyOwners.get(section.body) ?? [];
      owners.push(page.path);
      bodyOwners.set(section.body, owners);
    }
  }

  const shared = [...bodyOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([body, owners]) => `${owners.length}× ${body.slice(0, 60)}`);

  assert.deepEqual(
    shared,
    [],
    "no section body should appear on more than one page",
  );
});

/**
 * Concrete, checkable numbers are the difference between a page an answer
 * engine will cite and one it will skip. Every guide carries at least three.
 */
test("SEO content carries verifiable facts", () => {
  for (const page of SEO_CONTENT_PAGES) {
    assert.ok(
      (page.facts?.length ?? 0) >= 3,
      `${page.path} should carry at least three key facts`,
    );
    assert.ok(
      page.facts?.every((fact) => fact.label && fact.value),
      `${page.path} has a fact missing a label or value`,
    );
  }
});

test("SEO content carries an editorial review date", () => {
  for (const page of SEO_CONTENT_PAGES) {
    assert.match(
      page.updated ?? "",
      /^\d{4}-\d{2}-\d{2}$/,
      `${page.path} should carry an ISO review date for schema.org dateModified`,
    );
  }
});
