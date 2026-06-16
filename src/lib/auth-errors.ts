/** Maps auth error codes to user-friendly messages (shared by callback + login). */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "exchange_failed":
      return "That sign-in link could not be verified. It may have expired or already been used — request a new link below.";
    case "missing_code":
      return "This sign-in link is incomplete. Please request a new one below.";
    case "no_user":
      return "We couldn't load your account from that link. Please request a new one.";
    case "not_member":
      return "This email isn't on the STEM member allowlist. Ask an admin to add you, then try again.";
    case "otp_expired":
    case "access_denied":
      return "That sign-in link has expired. Request a fresh one below.";
    default:
      return "Something went wrong signing you in. Please request a new link below.";
  }
}
