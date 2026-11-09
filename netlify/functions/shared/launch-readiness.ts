export type ReadinessStatus = "ready" | "warning" | "blocked";
export type ReadinessItemStatus = "configured" | "missing" | "warning";

export interface ReadinessEnv {
  [key: string]: string | undefined;
}

export interface ReadinessItem {
  key: string;
  label: string;
  status: ReadinessItemStatus;
  required: boolean;
  description: string;
}

export interface ReadinessGroup {
  key: string;
  label: string;
  status: ReadinessStatus;
  items: ReadinessItem[];
}

export interface LaunchReadinessReport {
  overallStatus: ReadinessStatus;
  summary: {
    requiredTotal: number;
    configuredRequired: number;
    missingRequired: number;
    warnings: number;
  };
  warnings: string[];
  groups: ReadinessGroup[];
}

interface EnvCheck {
  key: string;
  label: string;
  required: boolean;
  description: string;
  anyOf?: string[];
  validate?: (value: string, env: ReadinessEnv) => string | null;
}

const CHECK_GROUPS: Array<{ key: string; label: string; checks: EnvCheck[] }> =
  [
    {
      key: "firebase",
      label: "Firebase",
      checks: [
        {
          key: "FIREBASE_SERVICE_ACCOUNT",
          label: "Firebase Admin service account",
          required: true,
          validate: validateFirebaseServiceAccount,
          description:
            "Required for server-side auth, Firestore, credits, reports, and admin APIs.",
        },
        {
          key: "FIREBASE_STORAGE_BUCKET",
          label: "Firebase Storage bucket",
          required: true,
          anyOf: ["FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"],
          description: "Required for report exports and user file storage.",
        },
      ],
    },
    {
      key: "ai_astrology",
      label: "AI and Astrology",
      checks: [
        {
          key: "GEMINI_API_KEY",
          label: "Gemini API key",
          required: true,
          anyOf: ["GEMINI_API_KEY", "ASTROYOU_API_KEY"],
          description:
            "Required for Synthesis, consults, reports, brain nudges, and digest generation.",
        },
        {
          key: "ASTROLOGY_API_KEY",
          label: "Astrology API key",
          required: true,
          anyOf: ["ASTROLOGY_API_KEY", "ASTROYOU_API_KEY"],
          description:
            "Required for kundali, panchang, dasha, compatibility, transit, and SEO tools.",
        },
      ],
    },
    {
      key: "payments",
      label: "Payments",
      checks: [
        {
          key: "RAZORPAY_KEY_ID",
          label: "Razorpay key id",
          required: true,
          validate: makeRazorpayModeValidator("Razorpay key id"),
          description:
            "Required to create paid checkout orders and subscriptions.",
        },
        {
          key: "RAZORPAY_KEY_SECRET",
          label: "Razorpay key secret",
          required: true,
          description:
            "Required for order creation and payment signature verification.",
        },
        {
          key: "RAZORPAY_WEBHOOK_SECRET",
          label: "Razorpay webhook secret",
          required: true,
          description: "Required so subscription webhooks cannot be spoofed.",
        },
        {
          key: "RAZORPAY_PREMIUM_PLAN_ID",
          label: "Premium plan id",
          required: true,
          description:
            "Required for Premium subscription checkout and webhook mapping.",
        },
        {
          key: "RAZORPAY_PRO_PLAN_ID",
          label: "Pro plan id",
          required: true,
          description:
            "Required for Pro subscription checkout and webhook mapping.",
        },
      ],
    },
    {
      key: "operations",
      label: "Operations",
      checks: [
        {
          key: "ASTROYOU_ADMIN_EMAILS",
          label: "Admin emails",
          required: true,
          validate: validateAdminEmails,
          description:
            "Required to access admin dashboards and moderation queues.",
        },
        {
          key: "APP_BASE_URL",
          label: "App base URL",
          required: true,
          anyOf: ["APP_BASE_URL", "URL"],
          validate: validateUrl,
          description:
            "Required for notification links and production callbacks.",
        },
        {
          key: "OTP_HASH_SECRET",
          label: "OTP hash secret",
          required: true,
          validate: makeLongSecretValidator("OTP hash secret"),
          description: "Required to HMAC one-time login codes at rest.",
        },
        {
          key: "EMAIL_UNSUB_SECRET",
          label: "Email unsubscribe secret",
          required: true,
          validate: makeLongSecretValidator("Email unsubscribe secret"),
          description:
            "Required to HMAC one-click email unsubscribe (List-Unsubscribe) tokens.",
        },
        {
          key: "RESEND_API_KEY",
          label: "Resend email key",
          required: true,
          description:
            "Required: email OTP sign-in hard-fails without it; also sends the daily digest and support-ticket alerts.",
        },
        {
          key: "DIGEST_FROM_EMAIL",
          label: "Email sender address",
          required: true,
          validate: validateSenderAddress,
          description:
            "Required sender for OTP, digest, and admin emails (e.g. `AstroYou <noreply@astroyou.app>`). Its domain must be verified in Resend.",
        },
        {
          key: "INTERNAL_FUNCTION_SECRET",
          label: "Internal function secret",
          required: false,
          validate: makeLongSecretValidator("Internal function secret"),
          description:
            "Recommended: dedicated secret for background-function dispatch (daily digest, memory analysis). Falls back to a value derived from OTP_HASH_SECRET.",
        },
        {
          key: "OPS_ALERT_WEBHOOK_URL",
          label: "Ops alert webhook",
          required: false,
          validate: validateHttpsUrl,
          description:
            "Recommended: Slack/Discord incoming webhook paged for payment, job, and email failures. Events are always stored in opsEvents.",
        },
        {
          key: "WHATSAPP_ACCESS_TOKEN",
          label: "WhatsApp access token",
          required: false,
          description:
            "Optional, only needed after WhatsApp nudges are enabled.",
        },
        {
          key: "WHATSAPP_PHONE_NUMBER_ID",
          label: "WhatsApp phone number id",
          required: false,
          description:
            "Optional, only needed after WhatsApp nudges are enabled.",
        },
      ],
    },
    {
      key: "client",
      label: "Client App",
      checks: [
        {
          key: "VITE_FIREBASE_API_KEY",
          label: "Firebase client API key",
          required: true,
          description: "Required for browser auth and Firestore access.",
        },
        {
          key: "VITE_FIREBASE_AUTH_DOMAIN",
          label: "Firebase auth domain",
          required: true,
          description: "Required for Firebase Auth redirects.",
        },
        {
          key: "VITE_FIREBASE_PROJECT_ID",
          label: "Firebase project id",
          required: true,
          description: "Required for client Firebase initialization.",
        },
        {
          key: "VITE_FIREBASE_STORAGE_BUCKET",
          label: "Firebase client storage bucket",
          required: true,
          description: "Required for client-side storage integrations.",
        },
        {
          key: "VITE_FIREBASE_MESSAGING_SENDER_ID",
          label: "Firebase messaging sender id",
          required: true,
          description:
            "Required for Firebase app configuration and browser push.",
        },
        {
          key: "VITE_FIREBASE_APP_ID",
          label: "Firebase app id",
          required: true,
          description: "Required for Firebase app initialization.",
        },
        {
          key: "VITE_RAZORPAY_KEY_ID",
          label: "Razorpay browser key id",
          required: true,
          validate: makeRazorpayModeValidator("Razorpay browser key id"),
          description: "Required to open Razorpay checkout in the browser.",
        },
        {
          key: "VITE_FIREBASE_VAPID_KEY",
          label: "Firebase VAPID key",
          required: false,
          description: "Recommended for browser push notifications.",
        },
        {
          key: "VITE_SENTRY_DSN",
          label: "Sentry DSN",
          required: false,
          description:
            "Recommended so client crashes are reported instead of only logged to the user's console.",
        },
      ],
    },
  ];

export function buildLaunchReadinessReport(
  env: ReadinessEnv,
): LaunchReadinessReport {
  const warnings: string[] = [];
  const groups = CHECK_GROUPS.map((group) => {
    const items = group.checks.map((check) => buildItem(check, env, warnings));
    return {
      key: group.key,
      label: group.label,
      status: getGroupStatus(items),
      items,
    };
  });
  addCrossWarnings(env, warnings);

  const allItems = groups.flatMap((group) => group.items);
  const requiredItems = allItems.filter((item) => item.required);
  const missingRequired = requiredItems.filter(
    (item) => item.status === "missing",
  ).length;
  const warningCount = warnings.length;

  return {
    overallStatus:
      missingRequired > 0 ? "blocked" : warningCount > 0 ? "warning" : "ready",
    summary: {
      requiredTotal: requiredItems.length,
      configuredRequired: requiredItems.length - missingRequired,
      missingRequired,
      warnings: warningCount,
    },
    warnings,
    groups,
  };
}

function buildItem(
  check: EnvCheck,
  env: ReadinessEnv,
  warnings: string[],
): ReadinessItem {
  const configuredKeys = (check.anyOf || [check.key]).filter((key) =>
    hasEnv(env, key),
  );
  const configured = configuredKeys.length > 0;
  let status: ReadinessItemStatus = configured ? "configured" : "missing";
  const configuredValue =
    configuredKeys.length > 0 ? env[configuredKeys[0]]! : "";

  if (configured && looksLikePlaceholder(configuredValue)) {
    status = check.required ? "missing" : "warning";
    const warning = `${check.label} is still a placeholder value.`;
    if (!warnings.includes(warning)) warnings.push(warning);
  }

  if (
    configured &&
    check.anyOf?.includes("ASTROYOU_API_KEY") &&
    configuredKeys.includes("ASTROYOU_API_KEY") &&
    !hasEnv(env, check.key)
  ) {
    if (status !== "missing") status = "warning";
    const warning = `${check.label} is using ASTROYOU_API_KEY as a shared fallback. Use a dedicated ${check.key} before launch.`;
    if (!warnings.includes(warning)) warnings.push(warning);
  }

  if (configured && check.validate) {
    const validationWarning = check.validate(configuredValue, env);
    if (validationWarning) {
      status = check.required ? "missing" : "warning";
      if (!warnings.includes(validationWarning))
        warnings.push(validationWarning);
    }
  }

  return {
    key: check.key,
    label: check.label,
    status,
    required: check.required,
    description: check.description,
  };
}

function getGroupStatus(items: ReadinessItem[]): ReadinessStatus {
  if (items.some((item) => item.required && item.status === "missing"))
    return "blocked";
  if (items.some((item) => item.status === "warning")) return "warning";
  return "ready";
}

function hasEnv(env: ReadinessEnv, key: string) {
  return typeof env[key] === "string" && env[key]!.trim().length > 0;
}

function validateFirebaseServiceAccount(value: string) {
  try {
    const parsed = JSON.parse(value);
    const hasProject =
      typeof parsed.project_id === "string" && parsed.project_id.trim();
    const hasClientEmail =
      typeof parsed.client_email === "string" &&
      parsed.client_email.includes("@");
    const hasPrivateKey =
      typeof parsed.private_key === "string" &&
      parsed.private_key.includes("BEGIN PRIVATE KEY") &&
      !looksLikePlaceholder(parsed.private_key);
    const hasRealClientEmail =
      hasClientEmail && !looksLikePlaceholder(parsed.client_email);
    return hasProject && hasRealClientEmail && hasPrivateKey
      ? null
      : hasRealClientEmail && hasPrivateKey
        ? null
        : "Firebase Admin service account is present but missing real project_id, client_email, or private_key.";
  } catch {
    return "Firebase Admin service account must be valid JSON.";
  }
}

function validateAdminEmails(value: string) {
  const emails = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return "Admin emails are required.";
  if (emails.some((email) => looksLikePlaceholder(email))) {
    return "Admin emails are still placeholder values.";
  }
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return "Admin emails must be valid comma-separated email addresses.";
  }
  return null;
}

function validateUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost"
      ? null
      : "App base URL should use https for production.";
  } catch {
    return "App base URL must be a valid URL.";
  }
}

function makeLongSecretValidator(label: string) {
  return function validateLongSecret(value: string) {
    return value.trim().length >= 32
      ? null
      : `${label} must be at least 32 characters.`;
  };
}

function validateSenderAddress(value: string) {
  const trimmed = value.trim();
  const match = /^(?:[^<>]*<([^<>\s]+)>|([^<>\s]+))$/.exec(trimmed);
  const address = match?.[1] || match?.[2] || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    ? null
    : "Email sender must be an address or `Name <address>`.";
}

function validateHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:"
      ? null
      : "Ops alert webhook must be an https URL.";
  } catch {
    return "Ops alert webhook must be a valid URL.";
  }
}

/** Netlify sets CONTEXT to production / deploy-preview / branch-deploy / dev. */
function deployContext(env: ReadinessEnv) {
  return env.CONTEXT?.trim().toLowerCase() || "";
}

function makeRazorpayModeValidator(label: string) {
  return function validateRazorpayMode(value: string, env: ReadinessEnv) {
    return deployContext(env) === "production" &&
      value.trim().startsWith("rzp_test")
      ? `${label} is a test key (rzp_test) in the production deploy context.`
      : null;
  };
}

function addCrossWarnings(env: ReadinessEnv, warnings: string[]) {
  const context = deployContext(env);
  if (context && context !== "production") {
    const liveKeys = ["RAZORPAY_KEY_ID", "VITE_RAZORPAY_KEY_ID"].filter((key) =>
      env[key]?.trim().startsWith("rzp_live"),
    );
    if (liveKeys.length > 0) {
      warnings.push(
        `Live Razorpay keys (${liveKeys.join(", ")}) are configured in the "${context}" deploy context; use rzp_test keys outside production.`,
      );
    }
  }

  const serverRazorpay = env.RAZORPAY_KEY_ID?.trim();
  const clientRazorpay = env.VITE_RAZORPAY_KEY_ID?.trim();
  if (serverRazorpay && clientRazorpay && serverRazorpay !== clientRazorpay) {
    warnings.push("Razorpay server and browser key ids do not match.");
  }

  const serviceAccountProject = readFirebaseProjectId(
    env.FIREBASE_SERVICE_ACCOUNT,
  );
  const clientProject = env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (
    serviceAccountProject &&
    clientProject &&
    serviceAccountProject !== clientProject
  ) {
    warnings.push(
      "Firebase Admin project_id does not match VITE_FIREBASE_PROJECT_ID.",
    );
  }
}

function readFirebaseProjectId(value: string | undefined) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return typeof parsed.project_id === "string"
      ? parsed.project_id.trim()
      : "";
  } catch {
    return "";
  }
}

function looksLikePlaceholder(value: string | undefined) {
  if (!value) return false;
  return /replace[_-]?me|example\.com|example\.iam\.gserviceaccount\.com/i.test(
    value,
  );
}
