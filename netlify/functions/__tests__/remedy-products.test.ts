import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRemedyRequestRecord,
  getRemedyProduct,
  remedyProducts,
} from "../shared/remedy-products.js";

test("remedy catalog exposes requestable commerce products", () => {
  assert.ok(remedyProducts.length >= 5);

  const gemstoneReview = getRemedyProduct("gemstone-suitability-review");
  assert.equal(gemstoneReview.title, "Gemstone Suitability Review");
  assert.equal(gemstoneReview.fulfillment, "review");
  assert.equal(gemstoneReview.priceInRupees, 199);
});

test("remedy catalog rejects unsupported product ids", () => {
  assert.throws(() => getRemedyProduct("unknown-product"), /Unsupported remedy product/);
});

test("buildRemedyRequestRecord stores safe server-owned request data", () => {
  const record = buildRemedyRequestRecord({
    uid: "user_123",
    productId: "navagraha-remedy-kit",
    notes: "Career timing and Saturn discipline",
    createdAt: "server-timestamp",
  });

  assert.equal(record.uid, "user_123");
  assert.equal(record.productId, "navagraha-remedy-kit");
  assert.equal(record.status, "requested");
  assert.equal(record.notes, "Career timing and Saturn discipline");
  assert.equal(record.product.title, "Navagraha Remedy Kit");
  assert.equal(record.product.priceInRupees, 799);
  assert.equal(record.createdAt, "server-timestamp");
  assert.equal(record.updatedAt, "server-timestamp");
});
