import test from "node:test";
import assert from "node:assert/strict";
import {
  createReportFilename,
  getReportProduct,
  isReportType,
} from "../shared/reports.js";
import { createReportStoragePath } from "../shared/report-storage.js";

test("getReportProduct returns paid report products", () => {
  assert.equal(getReportProduct("natal").creditCost, 75);
  assert.equal(getReportProduct("compatibility").creditCost, 99);
  assert.equal(getReportProduct("yearly").creditCost, 199);
});

test("isReportType accepts only supported report types", () => {
  assert.equal(isReportType("natal"), true);
  assert.equal(isReportType("unknown"), false);
});

test("createReportFilename is stable and safe", () => {
  assert.equal(
    createReportFilename("compatibility", "2026-05-29"),
    "astroyou-compatibility-report-2026-05-29.pdf",
  );
});

test("createReportStoragePath stores reports under the user boundary", () => {
  assert.equal(
    createReportStoragePath({
      uid: "user/123",
      reportId: "report 456",
      filename: "my report.pdf",
    }),
    "users/user_123/reports/report_456/my_report.pdf",
  );
});
