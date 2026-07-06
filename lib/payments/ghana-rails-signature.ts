import crypto from "crypto";

const DEFAULT_REPLAY_WINDOW_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function safeBearerEqual(headerValue: string | null, expectedSecret: string): boolean {
  if (!headerValue) return false;
  const expected = `Bearer ${expectedSecret}`;
  return safeEqual(headerValue, expected);
}

export interface GhanaRailsSignatureCheck {
  valid: boolean;
  reason?: "missing_timestamp" | "missing_signature" | "stale" | "bad_signature";
}

/**
 * Ghana-Rails webhook signature scheme.
 *
 * Sender:
 *   ts        = current Unix epoch (seconds)
 *   signature = HMAC-SHA256(secret, `${ts}.${rawBody}`) as hex
 *   headers   = x-timestamp: <ts>, x-signature: <signature>
 *
 * Receiver verifies:
 *   - x-timestamp is within replayWindowSeconds of now (default 5 min) to
 *     bound replay attacks even if an attacker captures a valid request.
 *   - HMAC over `${ts}.${rawBody}` matches the signature, timing-safe.
 *
 * Until partners deploy the new sender, this can run alongside the bearer
 * token (defense in depth) and be made strict via env flag.
 */
export function verifyGhanaRailsSignature(args: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  replayWindowSeconds?: number;
  now?: number;
}): GhanaRailsSignatureCheck {
  const window = args.replayWindowSeconds ?? DEFAULT_REPLAY_WINDOW_SECONDS;
  const now = args.now ?? Math.floor(Date.now() / 1000);

  if (!args.timestamp) return { valid: false, reason: "missing_timestamp" };
  const ts = Number.parseInt(args.timestamp, 10);
  if (!Number.isFinite(ts)) return { valid: false, reason: "missing_timestamp" };
  if (Math.abs(now - ts) > window) return { valid: false, reason: "stale" };

  if (!args.signature) return { valid: false, reason: "missing_signature" };

  const expected = crypto
    .createHmac("sha256", args.secret)
    .update(`${ts}.${args.rawBody}`)
    .digest("hex");

  return safeEqual(args.signature.trim(), expected)
    ? { valid: true }
    : { valid: false, reason: "bad_signature" };
}
