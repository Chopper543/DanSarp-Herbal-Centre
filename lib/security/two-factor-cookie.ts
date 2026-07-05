import crypto from "crypto";

/**
 * Server-signed, session-bound proof that a session has completed the 2FA
 * challenge. Replaces the previous forgeable `twofa_verified=true` cookie.
 *
 * The value is `"<exp>.<hmac>"` where `hmac = HMAC-SHA256(secret, userId.sessionId.exp)`.
 * The middleware recomputes the HMAC from the CURRENT session's user id and
 * Supabase session id, so:
 *   - a client cannot forge it (no secret),
 *   - a token minted for one session cannot be replayed into another (binding),
 *   - it expires (`exp`), and dies naturally when the session is rotated/revoked.
 *
 * Only issued server-side, after a real OTP verification.
 */

export const TWO_FA_COOKIE_NAME = "twofa_verified";

// Matches the previous cookie lifetime (1 day). The signed `exp` is the real
// gate; `maxAge` just tells the browser when to drop it.
const TTL_SECONDS = 60 * 60 * 24;

/**
 * Fail closed: the secret must come from the environment. No hardcoded value
 * and no default fallback — if it is unset (or too short) issuing/verifying
 * throws, so 2FA can never be silently satisfied. Mirrors `lib/security/crypto.ts`.
 */
function getSecret(): Buffer {
  const secret = process.env.TWO_FA_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "TWO_FA_SESSION_SECRET env var is not set. Generate with: openssl rand -base64 48"
    );
  }
  if (secret.length < 32) {
    throw new Error("TWO_FA_SESSION_SECRET must be at least 32 characters long");
  }
  return Buffer.from(secret);
}

function sign(userId: string, sessionId: string, exp: number): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${userId}.${sessionId}.${exp}`)
    .digest("hex");
}

export interface TwoFactorCookieDescriptor {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: true;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}

function descriptor(value: string, maxAge: number): TwoFactorCookieDescriptor {
  return {
    name: TWO_FA_COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    },
  };
}

/** Mint a proof cookie for the given user + Supabase session. Server-side only. */
export function issueTwoFactorCookie(
  userId: string,
  sessionId: string
): TwoFactorCookieDescriptor {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return descriptor(`${exp}.${sign(userId, sessionId, exp)}`, TTL_SECONDS);
}

/** Expire the proof cookie (logout / disable). */
export function clearTwoFactorCookie(): TwoFactorCookieDescriptor {
  return descriptor("", 0);
}

/**
 * True only if `cookieValue` is a currently-valid HMAC bound to exactly this
 * `userId` + `sessionId`. Any forged/replayed/expired/missing value → false.
 * Constant-time signature comparison.
 */
export function verifyTwoFactorCookie(
  cookieValue: string | null | undefined,
  userId: string,
  sessionId: string | null | undefined
): boolean {
  if (!cookieValue || !userId || !sessionId) return false;

  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return false;

  const exp = Number(cookieValue.slice(0, dot));
  const sig = cookieValue.slice(dot + 1);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;

  let expected: string;
  try {
    expected = sign(userId, sessionId, exp);
  } catch {
    // Secret unset/invalid → fail closed rather than granting access.
    return false;
  }

  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
