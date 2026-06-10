import type { CreditChangeType } from "./credits.js";

export class AdminCreditAdjustmentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminCreditAdjustmentError";
    this.status = status;
  }
}

export function resolveAdminCreditAdjustmentType(
  amount: number,
  requestedType: unknown,
): CreditChangeType {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new AdminCreditAdjustmentError("Credit amount must be non-zero");
  }

  if (requestedType === "refund") {
    if (amount <= 0) {
      throw new AdminCreditAdjustmentError("Refund credits must be positive");
    }
    return "refund";
  }

  if (requestedType === "admin_adjustment") {
    return "admin_adjustment";
  }

  return amount > 0 ? "refund" : "admin_adjustment";
}
