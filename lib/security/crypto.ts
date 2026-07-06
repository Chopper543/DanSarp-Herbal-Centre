import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

function readKey(envName: "TWO_FA_ENC_KEY" | "PHI_FIELD_KEY"): Buffer {
  const value = process.env[envName];
  if (!value) {
    throw new Error(
      `${envName} env var is not set. Generate with: openssl rand -base64 48`
    );
  }
  if (value.length < 32) {
    throw new Error(`${envName} must be at least 32 characters long`);
  }
  return Buffer.from(value).subarray(0, 32);
}

function getKey(): Buffer {
  return readKey("TWO_FA_ENC_KEY");
}

function getPhiKey(): Buffer {
  return readKey("PHI_FIELD_KEY");
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const buffer = Buffer.from(ciphertext, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const data = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

export function hashBackupCode(code: string): string {
  const key = getKey();
  const hmac = createHmac("sha256", key);
  hmac.update(code.toUpperCase());
  return hmac.digest("hex");
}

/**
 * Encrypt/decrypt PHI fields (clinical notes, lab results, patient records).
 * Note: caller is responsible for role-based access checks before decrypting.
 */
export function encryptPhiField(value: string): string {
  const key = getPhiKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptPhiField(ciphertext: string): string {
  const key = getPhiKey();
  const buffer = Buffer.from(ciphertext, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const data = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
