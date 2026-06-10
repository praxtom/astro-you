import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin";
import { requireAdmin } from "./shared/admin-auth";
import {
  AdminCreditAdjustmentError,
  resolveAdminCreditAdjustmentType,
} from "./shared/admin-credit-adjustments";
import { applyCreditChange, type CreditChangeType } from "./shared/credits";
import { writeAuditLog } from "./shared/audit-log";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { idToken, targetUid, amount, reason, type } = await req.json();
    const admin = await requireAdmin(idToken);
    const creditAmount = Number(amount);
    if (!targetUid || !Number.isFinite(creditAmount) || creditAmount === 0) {
      return json({ error: "targetUid and non-zero amount are required" }, 400);
    }
    if (!reason || String(reason).trim().length < 5) {
      return json({ error: "Adjustment reason is required" }, 400);
    }

    const creditType: CreditChangeType = resolveAdminCreditAdjustmentType(
      creditAmount,
      type,
    );
    const referenceId = `admin_${Date.now()}_${Math.abs(creditAmount)}`;
    const result = await applyCreditChange(
      { db, FieldValue },
      {
        uid: targetUid,
        amount: creditAmount,
        type: creditType,
        source: "admin",
        referenceId,
        ledgerId: `admin_${referenceId}`,
        metadata: {
          adminUid: admin.uid,
          adminEmail: admin.email,
          reason: String(reason).trim(),
        },
      },
    );

    await writeAuditLog({
      uid: targetUid,
      action: "admin_credit_adjustment",
      entityType: "creditLedger",
      entityId: referenceId,
      metadata: {
        adminUid: admin.uid,
        adminEmail: admin.email,
        amount: creditAmount,
        type: creditType,
        balanceAfter: result.balanceAfter,
        reason: String(reason).trim(),
      },
    });

    return json({ status: "success", ...result });
  } catch (err: any) {
    console.error("[AdminCreditAdjustment] Error:", err);
    const status = err instanceof AdminCreditAdjustmentError ? err.status : err.status || 500;
    return json({ error: err.message || "Credit adjustment failed" }, status);
  }
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { path: "/api/admin/credit-adjustment" };
