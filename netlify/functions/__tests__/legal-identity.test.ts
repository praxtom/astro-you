import test from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_IDENTITY,
  OPERATOR_STATEMENT,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  findLegalPlaceholders,
} from "../../../src/lib/legal-policies.js";

const copy = (sections: { title: string; content: string[] }[]) =>
  sections.flatMap((s) => [s.title, ...s.content]).join(" ");

/**
 * Launch gate. Normal test runs pass while the owner hasn't filled the
 * business identity yet; the launch checker runs with
 * LEGAL_PLACEHOLDER_CHECK=1, which fails while any [[placeholder]] remains.
 */
test(
  "business identity has no placeholders (LEGAL_PLACEHOLDER_CHECK=1 only)",
  { skip: process.env.LEGAL_PLACEHOLDER_CHECK !== "1" },
  () => {
    const remaining = findLegalPlaceholders();
    assert.deepEqual(
      remaining,
      [],
      `Fill BUSINESS_IDENTITY in src/lib/legal-policies.ts: ${remaining.join(", ")}`,
    );
  },
);

test("placeholder detector finds [[...]] values in the identity config", () => {
  const found = findLegalPlaceholders();
  for (const path of found) {
    const value = path
      .split(".")
      .reduce<any>((obj, key) => obj?.[key], BUSINESS_IDENTITY);
    assert.match(String(value), /\[\[.*\]\]/);
  }
});

test("contact emails are real addresses, never [[placeholders]]", () => {
  // These feed mailto: links on Help and Support.
  for (const email of [
    BUSINESS_IDENTITY.supportEmail,
    BUSINESS_IDENTITY.grievanceOfficer.email,
  ]) {
    assert.doesNotMatch(email, /\[\[|\]\]/);
    assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  }
  assert.ok(!findLegalPlaceholders().includes("supportEmail"));
  assert.ok(!findLegalPlaceholders().includes("grievanceOfficer.email"));
});

test("identity renders consistently on Terms and Privacy", () => {
  assert.ok(copy(TERMS_SECTIONS).includes(OPERATOR_STATEMENT));
  assert.ok(copy(PRIVACY_SECTIONS).includes(OPERATOR_STATEMENT));
  const privacy = copy(PRIVACY_SECTIONS);
  assert.ok(privacy.includes(BUSINESS_IDENTITY.grievanceOfficer.name));
  assert.ok(privacy.includes(BUSINESS_IDENTITY.grievanceOfficer.email));
  assert.ok(privacy.includes(BUSINESS_IDENTITY.supportEmail));
});

test("privacy policy discloses every client-side processor and audit retention", () => {
  const privacy = copy(PRIVACY_SECTIONS);
  for (const processor of ["Nominatim", "Sentry", "jsDelivr", "Netlify"]) {
    assert.match(privacy, new RegExp(processor));
  }
  assert.doesNotMatch(privacy, /Google Fonts/);
  assert.match(privacy, /Audit logs[^.]*\./);
  assert.match(
    privacy,
    /kept after your account is deleted, for up to 8 years/,
  );
  assert.match(privacy, /opt in/i);
});
