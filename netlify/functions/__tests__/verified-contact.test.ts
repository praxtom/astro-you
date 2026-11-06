import test from "node:test";
import assert from "node:assert/strict";
import {
  lookupVerifiedAuthEmail,
  selectVerifiedAuthEmail,
  selectVerifiedWhatsAppNumber,
} from "../shared/verified-contact.js";

test("digest/nudge email comes only from a verified Auth record", () => {
  // Email-OTP accounts are created with emailVerified: true.
  assert.equal(
    selectVerifiedAuthEmail({
      email: "Seeker@Example.com",
      emailVerified: true,
    }),
    "seeker@example.com",
  );
  // Unverified (e.g. an unverified password account) — never mailed.
  assert.equal(
    selectVerifiedAuthEmail({
      email: "seeker@example.com",
      emailVerified: false,
    }),
    null,
  );
  // Google vouches for the address on its provider entry.
  assert.equal(
    selectVerifiedAuthEmail({
      email: "seeker@gmail.com",
      emailVerified: false,
      providerData: [{ providerId: "google.com", email: "seeker@gmail.com" }],
    }),
    "seeker@gmail.com",
  );
  // A provider entry for a different address does not vouch for this one.
  assert.equal(
    selectVerifiedAuthEmail({
      email: "victim@example.com",
      providerData: [{ providerId: "google.com", email: "me@gmail.com" }],
    }),
    null,
  );
  assert.equal(
    selectVerifiedAuthEmail({
      email: "x@example.com",
      emailVerified: true,
      disabled: true,
    }),
    null,
  );
  assert.equal(selectVerifiedAuthEmail({ emailVerified: true }), null);
  assert.equal(selectVerifiedAuthEmail(null), null);
});

test("lookupVerifiedAuthEmail never throws and ignores the user doc", async () => {
  assert.equal(
    await lookupVerifiedAuthEmail("uid_1", async (uid) => {
      assert.equal(uid, "uid_1");
      return { email: "me@example.com", emailVerified: true };
    }),
    "me@example.com",
  );
  assert.equal(
    await lookupVerifiedAuthEmail("uid_1", async () => {
      throw new Error("auth/user-not-found");
    }),
    null,
  );
});

test("WhatsApp number only from the server-written verified field", () => {
  // Owner-writable fields are ignored.
  assert.equal(
    selectVerifiedWhatsAppNumber({
      whatsappNumber: "+919999999999",
      phoneE164: "+919999999999",
      profile: { whatsappNumber: "+919999999999" },
    }),
    null,
  );
  // No verification marker → ignored.
  assert.equal(
    selectVerifiedWhatsAppNumber({
      verifiedContacts: { whatsappE164: "+919999999999" },
    }),
    null,
  );
  assert.equal(
    selectVerifiedWhatsAppNumber({
      verifiedContacts: {
        whatsappE164: "+919999999999",
        whatsappVerifiedAt: new Date(),
      },
    }),
    "+919999999999",
  );
  assert.equal(
    selectVerifiedWhatsAppNumber({
      verifiedContacts: { whatsappE164: "not-a-number", whatsappVerifiedAt: 1 },
    }),
    null,
  );
});
