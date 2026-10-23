/**
 * A session signed in before the password or authenticator last changed is no longer valid: changing
 * them is how someone takes an account back, so it has to end the sessions already open. Compared to
 * the second, since a sign-in cannot follow a change within the same second.
 */
export function sessionPredatesCredentials(signedInAt: number | undefined, credentialsChangedAt: Date | null): boolean {
  if (!credentialsChangedAt) return false;
  return Math.floor((signedInAt ?? 0) / 1000) < Math.floor(credentialsChangedAt.getTime() / 1000);
}
