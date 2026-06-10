import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminOperationsError,
  buildAdminOperationUpdate,
  buildOperationsQueueItem,
} from "../shared/admin-operations.js";

test("buildOperationsQueueItem normalizes support tickets for staff review", () => {
  const item = buildOperationsQueueItem(
    "support",
    "ticket_123",
    {
      uid: "user_123",
      email: "kavan@example.com",
      category: "refund",
      priority: "urgent",
      subject: "Duplicate payment",
      message: "Razorpay charged twice for one pack.",
      referenceId: "pay_123",
      status: "open",
      createdAt: "server-timestamp",
      updatedAt: "server-timestamp",
    },
  );

  assert.equal(item.id, "ticket_123");
  assert.equal(item.kind, "support");
  assert.equal(item.uid, "user_123");
  assert.equal(item.title, "Duplicate payment");
  assert.equal(item.subtitle, "refund · urgent");
  assert.equal(item.detail, "Razorpay charged twice for one pack.");
  assert.equal(item.referenceId, "pay_123");
  assert.equal(item.status, "open");
  assert.equal(item.priorityScore, 100);
});

test("buildOperationsQueueItem normalizes remedy requests for staff review", () => {
  const item = buildOperationsQueueItem(
    "remedy",
    "request_123",
    {
      uid: "user_123",
      product: {
        title: "Gemstone Suitability Review",
        category: "gemstone",
        fulfillment: "review",
        priceInRupees: 199,
      },
      notes: "Please check Saturn timing.",
      status: "requested",
      createdAt: "server-timestamp",
      updatedAt: "server-timestamp",
    },
  );

  assert.equal(item.id, "request_123");
  assert.equal(item.kind, "remedy");
  assert.equal(item.title, "Gemstone Suitability Review");
  assert.equal(item.subtitle, "gemstone · review · ₹199");
  assert.equal(item.detail, "Please check Saturn timing.");
  assert.equal(item.status, "requested");
  assert.equal(item.priorityScore, 60);
});

test("buildAdminOperationUpdate validates support status transitions", () => {
  const update = buildAdminOperationUpdate(
    {
      kind: "support",
      itemId: "ticket_123",
      status: "resolved",
      note: "Refund verified and processed.",
    },
    { uid: "admin_1", email: "admin@example.com" },
    "server-timestamp",
  );

  assert.equal(update.kind, "support");
  assert.equal(update.itemId, "ticket_123");
  assert.equal(update.patch.status, "resolved");
  assert.equal(update.patch.adminNote, "Refund verified and processed.");
  assert.equal(update.patch.resolvedAt, "server-timestamp");
  assert.equal(update.patch.assignedAdmin.uid, "admin_1");
});

test("buildAdminOperationUpdate rejects invalid remedy status", () => {
  assert.throws(
    () =>
      buildAdminOperationUpdate(
        {
          kind: "remedy",
          itemId: "request_123",
          status: "resolved",
        },
        { uid: "admin_1", email: "admin@example.com" },
        "server-timestamp",
      ),
    (error: unknown) => {
      const err = error as AdminOperationsError;
      return (
        error instanceof AdminOperationsError &&
        err.status === 400 &&
        /status/i.test(err.message)
      );
    },
  );
});
