import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function verifyFlutterwaveSignature(
  rawBody: string,
  signature: string | null,
  secretHash?: string
): boolean {
  if (!secretHash) {
    throw new Error("Webhook secret not configured");
  }

  if (!signature) {
    return false;
  }

  const candidate = signature.trim();

  // Current docs: `flutterwave-signature` header with HMAC-SHA256 (base64)
  const sha256Base64 = crypto
    .createHmac("sha256", secretHash)
    .update(rawBody)
    .digest("base64");

  // Legacy compatibility for existing integrations that used hex signatures.
  const sha512Hex = crypto
    .createHmac("sha512", secretHash)
    .update(rawBody)
    .digest("hex");

  // Some legacy setups configured signature as plain secret-hash equality.
  const legacyPlainHash = secretHash;

  return (
    safeEqual(candidate, sha256Base64) ||
    safeEqual(candidate, sha512Hex) ||
    safeEqual(candidate, legacyPlainHash)
  );
}
