/**
 * Shared error classification for personal (birth-chart) dashboard data.
 *
 * Every personal card must end in a definite state — never an endless
 * "refreshing…". A 401/403 means the reading needs an account; anything else
 * (5xx, 429, network, timeout) is a temporary outage the user can retry.
 */
export type PersonalDataErrorKind = "signin" | "unavailable";

export class PersonalDataError extends Error {
  readonly status: number;
  readonly kind: PersonalDataErrorKind;

  constructor(status: number, message?: string) {
    const kind = personalDataErrorKind(status);
    super(
      message ||
        (kind === "signin"
          ? "Sign in required"
          : "Temporarily unavailable"),
    );
    this.name = "PersonalDataError";
    this.status = status;
    this.kind = kind;
  }
}

export function personalDataErrorKind(status: number): PersonalDataErrorKind {
  return status === 401 || status === 403 ? "signin" : "unavailable";
}

/** Kind for any thrown value — non-HTTP failures count as temporary outages. */
export function errorKindOf(err: unknown): PersonalDataErrorKind {
  return err instanceof PersonalDataError ? err.kind : "unavailable";
}

/** Throw a PersonalDataError for a non-OK response. */
export function assertPersonalDataOk(response: Response): void {
  if (!response.ok) throw new PersonalDataError(response.status);
}
