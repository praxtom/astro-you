import { Config, Context } from "@netlify/functions";
import { AggregateField } from "firebase-admin/firestore";
import { db } from "./shared/firebase-admin.js";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import {
  buildAdminSummary,
  buildAdminSummaryFromAggregates,
} from "./shared/admin-summary.js";
import { ENTITLEMENTS } from "./shared/entitlements.js";
import { describeError } from "./shared/error-summary.js";

interface FirestoreUserDoc {
  id: string;
  data(): Record<string, unknown>;
}

// Field mask: fetch only what the summary needs. Avoids loading heavy PII
// (atman emotional state, kundaliData, parsedChart, chats) into memory.
const SUMMARY_FIELDS = [
  "email",
  "credits",
  "creditsUsed",
  "subscription",
  "tier",
  "usage",
  "updatedAt",
  "profile",
] as const;

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    await requireAdmin(body.idToken);

    try {
      return json(await loadAggregateSummary());
    } catch (aggregateError) {
      // Aggregations unavailable (emulator, missing permission): fall back to
      // a capped sample and say so, rather than show nothing.
      console.error(
        "[AdminSummary] Aggregation failed, using sample:",
        describeError(aggregateError),
      );
    }

    const limit = Math.min(Math.max(Number(body.limit) || 1000, 1), 5000);
    const usersSnapshot = await db
      .collection("users")
      .select(...SUMMARY_FIELDS)
      .limit(limit)
      .get();
    const users = usersSnapshot.docs.map((doc: FirestoreUserDoc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return json({
      ...buildAdminSummary(users),
      source: "sample",
      sampleSize: users.length,
    });
  } catch (error: any) {
    console.error("[AdminSummary] Error:", describeError(error));
    const status = error instanceof AdminAuthError ? error.status : 500;
    return json(
      {
        error:
          error instanceof AdminAuthError
            ? error.message
            : "Could not load admin summary",
      },
      status,
    );
  }
};

/**
 * Exact metrics over the whole users collection via count()/sum()/average()
 * aggregation queries (billed per 1000 index entries, not per document).
 * Tier comes from `subscription.tier`, the field the Razorpay webhook writes.
 */
async function loadAggregateSummary() {
  const users = db.collection("users");
  const tierStats = (tier: "premium" | "pro") =>
    users
      .where("subscription.tier", "==", tier)
      .aggregate({
        count: AggregateField.count(),
        priceSum: AggregateField.sum("subscription.priceInr"),
        // average() ignores docs without a numeric price, so sum/avg gives
        // how many subscribers carry an explicit price.
        priceAvg: AggregateField.average("subscription.priceInr"),
      })
      .get()
      .then((snap) => {
        const d = snap.data();
        const sum = Number(d.priceSum) || 0;
        const avg = Number(d.priceAvg) || 0;
        return {
          count: d.count,
          priceSum: sum,
          priced: avg > 0 ? Math.round(sum / avg) : 0,
        };
      });

  const [totals, premium, pro, recentSnap] = await Promise.all([
    users
      .aggregate({
        totalUsers: AggregateField.count(),
        creditsOutstanding: AggregateField.sum("credits"),
        creditsUsedTop: AggregateField.sum("creditsUsed"),
        creditsUsedNested: AggregateField.sum("usage.creditsUsed"),
      })
      .get()
      .then((snap) => snap.data()),
    tierStats("premium"),
    tierStats("pro"),
    users
      .orderBy("updatedAt", "desc")
      .select(...SUMMARY_FIELDS)
      .limit(10)
      .get(),
  ]);

  return buildAdminSummaryFromAggregates(
    {
      totalUsers: totals.totalUsers,
      premiumUsers: premium.count,
      proUsers: pro.count,
      premiumPriceSum: premium.priceSum,
      premiumPricedUsers: premium.priced,
      proPriceSum: pro.priceSum,
      proPricedUsers: pro.priced,
      creditsOutstanding: Number(totals.creditsOutstanding) || 0,
      creditsUsed:
        (Number(totals.creditsUsedTop) || 0) +
        (Number(totals.creditsUsedNested) || 0),
      recentUsers: recentSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
    },
    {
      premium: ENTITLEMENTS.premium.monthlyPriceInr,
      pro: ENTITLEMENTS.pro.monthlyPriceInr,
    },
  );
}

export const config: Config = { path: "/api/admin/summary" };

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
