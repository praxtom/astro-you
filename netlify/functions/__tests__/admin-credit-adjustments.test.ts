import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminCreditAdjustmentError,
  resolveAdminCreditAdjustmentType,
} from "../shared/admin-credit-adjustments.js";

test("resolveAdminCreditAdjustmentType respects explicit admin adjustment", () => {
  assert.equal(resolveAdminCreditAdjustmentType(25, "admin_adjustment"), "admin_adjustment");
  assert.equal(resolveAdminCreditAdjustmentType(-10, "admin_adjustment"), "admin_adjustment");
});

test("resolveAdminCreditAdjustmentType keeps refunds positive only", () => {
  assert.equal(resolveAdminCreditAdjustmentType(50, "refund"), "refund");
  assert.throws(
    () => resolveAdminCreditAdjustmentType(-5, "refund"),
    (error: unknown) =>
      error instanceof AdminCreditAdjustmentError &&
      /positive/i.test(error.message),
  );
});

test("resolveAdminCreditAdjustmentType defaults by amount when type is missing", () => {
  assert.equal(resolveAdminCreditAdjustmentType(15, undefined), "refund");
  assert.equal(resolveAdminCreditAdjustmentType(-3, undefined), "admin_adjustment");
});
