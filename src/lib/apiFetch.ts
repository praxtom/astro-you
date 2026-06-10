import { auth } from "./firebase";

/**
 * POST JSON to an internal API endpoint, automatically attaching the current
 * user's Firebase ID token as `idToken` in the body. Server endpoints verify
 * this token and derive the uid from it (never trusting a client-supplied uid).
 *
 * If the user is not signed in, the request is sent without a token — the
 * server decides whether the endpoint allows anonymous access.
 */
export async function postJson(
  url: string,
  body: Record<string, unknown> = {},
  init?: RequestInit,
): Promise<Response> {
  let idToken: string | undefined;
  try {
    idToken = await auth.currentUser?.getIdToken();
  } catch {
    idToken = undefined;
  }

  return fetch(url, {
    method: "POST",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: JSON.stringify(idToken ? { ...body, idToken } : body),
  });
}
