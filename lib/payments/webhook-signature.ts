import crypto from "crypto";

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

  const hash = crypto.createHmac("sha512", secretHash).update(rawBody).digest("hex");
  return hash === signature;
}
