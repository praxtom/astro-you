import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const root = resolve(new URL("..", import.meta.url).pathname);
const env = {
  ...loadDotEnv(resolve(root, ".env")),
  ...process.env,
};

const required = [
  "FIREBASE_SERVICE_ACCOUNT",
  "VITE_FIREBASE_PROJECT_ID",
];
const missing = required.filter((key) => !hasEnv(env, key));
const storageBucket = env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET;
if (!storageBucket) {
  missing.push("FIREBASE_STORAGE_BUCKET or VITE_FIREBASE_STORAGE_BUCKET");
}

if (missing.length > 0) {
  console.error(`Live service verification: BLOCKED`);
  console.error(`Missing required env: ${missing.join(", ")}`);
  process.exit(1);
}

const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
if (!serviceAccount) {
  console.error("Live service verification: BLOCKED");
  console.error("FIREBASE_SERVICE_ACCOUNT is not valid service account JSON.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket,
  });
}

const checks = [
  verifyFirestore(),
  verifyAuth(),
  verifyStorage(storageBucket),
];
const results = await Promise.all(checks);
const failed = results.filter((result) => !result.ok);

console.log(
  `Live service verification: ${failed.length > 0 ? "BLOCKED" : "READY"}`,
);
for (const result of results) {
  console.log(
    `${result.ok ? "PASS" : "FAIL"}\t${result.label}${
      result.message ? `\t${result.message}` : ""
    }`,
  );
}

process.exitCode = failed.length > 0 ? 1 : 0;

async function verifyFirestore() {
  try {
    await getFirestore().collection("__astroyou_healthcheck").limit(1).get();
    return { label: "Firebase Admin Firestore read", ok: true };
  } catch (error) {
    return {
      label: "Firebase Admin Firestore read",
      ok: false,
      message: formatError(error),
    };
  }
}

async function verifyAuth() {
  try {
    await getAuth().listUsers(1);
    return { label: "Firebase Admin Auth list", ok: true };
  } catch (error) {
    return {
      label: "Firebase Admin Auth list",
      ok: false,
      message: formatError(error),
    };
  }
}

async function verifyStorage(bucketName) {
  try {
    const [exists] = await getStorage().bucket(bucketName).exists();
    return {
      label: "Firebase Storage bucket access",
      ok: exists,
      message: exists ? "" : "bucket was not found or is not accessible",
    };
  } catch (error) {
    return {
      label: "Firebase Storage bucket access",
      ok: false,
      message: formatError(error),
    };
  }
}

function parseServiceAccount(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (
      typeof parsed.project_id !== "string" ||
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function formatError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid_grant|invalid jwt signature/i.test(message)) {
    return "Firebase service account credentials are invalid (Invalid JWT Signature). Replace FIREBASE_SERVICE_ACCOUNT with a fresh Firebase Admin service account JSON.";
  }
  if (/unauthenticated|invalid authentication credentials/i.test(message)) {
    return "Firebase Admin authentication failed. Check FIREBASE_SERVICE_ACCOUNT project_id, client_email, private_key, and service account status.";
  }
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((loadedEnv, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return loadedEnv;
      const separator = line.indexOf("=");
      if (separator === -1) return loadedEnv;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return loadedEnv;
      loadedEnv[key] = stripQuotes(value);
      return loadedEnv;
    }, {});
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function hasEnv(source, key) {
  return typeof source[key] === "string" && source[key].trim().length > 0;
}
