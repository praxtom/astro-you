export type LiveServiceStatus = "ready" | "blocked";
export type LiveServiceCheckStatus = "pass" | "fail";

export interface LiveServiceCheck {
  key: string;
  label: string;
  status: LiveServiceCheckStatus;
  message?: string;
}

export interface LiveServicesReport {
  overallStatus: LiveServiceStatus;
  checks: LiveServiceCheck[];
}

export interface LiveServiceDeps {
  verifyFirestore(): Promise<void>;
  verifyAuth(): Promise<void>;
  verifyStorage(): Promise<void>;
}

export async function verifyLiveServices(
  deps: LiveServiceDeps,
  timeoutMs = 5000,
): Promise<LiveServicesReport> {
  const checks = await Promise.all([
    runCheck("firestore", "Firebase Admin Firestore read", deps.verifyFirestore, timeoutMs),
    runCheck("auth", "Firebase Admin Auth list", deps.verifyAuth, timeoutMs),
    runCheck("storage", "Firebase Storage bucket access", deps.verifyStorage, timeoutMs),
  ]);

  return {
    overallStatus: checks.some((check) => check.status === "fail") ? "blocked" : "ready",
    checks,
  };
}

async function runCheck(
  key: string,
  label: string,
  check: () => Promise<void>,
  timeoutMs: number,
): Promise<LiveServiceCheck> {
  try {
    await withTimeout(check(), timeoutMs);
    return { key, label, status: "pass" };
  } catch (error) {
    return {
      key,
      label,
      status: "fail",
      message: formatError(error),
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }
    }),
  ]);
}

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid_grant|invalid jwt signature/i.test(message)) {
    return "Firebase service account credentials are invalid (Invalid JWT Signature). Replace FIREBASE_SERVICE_ACCOUNT with a fresh Firebase Admin service account JSON.";
  }
  if (/unauthenticated|invalid authentication credentials/i.test(message)) {
    return "Firebase Admin authentication failed. Check FIREBASE_SERVICE_ACCOUNT project_id, client_email, private_key, and service account status.";
  }
  return message.replace(/\s+/g, " ").slice(0, 240);
}
