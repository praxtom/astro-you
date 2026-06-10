import test from "node:test";
import assert from "node:assert/strict";
import {
  SupportTicketError,
  buildSupportTicketRecord,
} from "../shared/support-tickets.js";

test("buildSupportTicketRecord creates a server-owned support ticket", () => {
  const record = buildSupportTicketRecord(
    {
      uid: "user_123",
      email: " KAVAN@example.com ",
      category: "refund",
      priority: "urgent",
      subject: "  Duplicate payment  ",
      message: " Razorpay charged twice for one credit pack. ",
      referenceId: " pay_123 ",
    },
    "server-timestamp",
  );

  assert.equal(record.uid, "user_123");
  assert.equal(record.email, "kavan@example.com");
  assert.equal(record.category, "refund");
  assert.equal(record.priority, "urgent");
  assert.equal(record.subject, "Duplicate payment");
  assert.equal(record.message, "Razorpay charged twice for one credit pack.");
  assert.equal(record.referenceId, "pay_123");
  assert.equal(record.status, "open");
  assert.equal(record.source, "web");
  assert.equal(record.createdAt, "server-timestamp");
  assert.equal(record.updatedAt, "server-timestamp");
});

test("buildSupportTicketRecord rejects incomplete support tickets", () => {
  assert.throws(
    () =>
      buildSupportTicketRecord(
        {
          uid: "user_123",
          email: "kavan@example.com",
          category: "unsupported",
          subject: "Hi",
          message: "short",
        },
        "server-timestamp",
      ),
    (error: unknown) => {
      const err = error as SupportTicketError;
      return (
        error instanceof SupportTicketError &&
        err.status === 400 &&
        /category/i.test(err.message)
      );
    },
  );
});
