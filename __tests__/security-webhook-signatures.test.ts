/**
 * @jest-environment node
 */
import crypto from "crypto";
import { verifyPaystackSignature } from "../lib/payments/webhook-signature";
import {
  safeBearerEqual,
  verifyGhanaRailsSignature,
} from "../lib/payments/ghana-rails-signature";

describe("verifyPaystackSignature", () => {
  const secret = "sk_test_paystack_secret_value_for_tests";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
  const validSig = crypto.createHmac("sha512", secret).update(body).digest("hex");

  it("accepts a correct HMAC-SHA512 signature", () => {
    expect(verifyPaystackSignature(body, validSig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = body.replace("ref_1", "ref_2");
    expect(verifyPaystackSignature(tampered, validSig, secret)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
  });

  it("throws if secret is not configured", () => {
    expect(() => verifyPaystackSignature(body, validSig, undefined)).toThrow();
  });
});

describe("safeBearerEqual", () => {
  it("accepts an exact Bearer match", () => {
    expect(safeBearerEqual("Bearer s3cret", "s3cret")).toBe(true);
  });
  it("rejects a missing header", () => {
    expect(safeBearerEqual(null, "s3cret")).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(safeBearerEqual("Bearer wrong", "s3cret")).toBe(false);
  });
  it("rejects a missing Bearer prefix", () => {
    expect(safeBearerEqual("s3cret", "s3cret")).toBe(false);
  });
});

describe("verifyGhanaRailsSignature", () => {
  const secret = "ghana-rails-shared-secret-32-characters";
  const rawBody = JSON.stringify({ provider_transaction_id: "tx_1", status: "completed" });
  const now = 1_700_000_000;
  const ts = now.toString();
  const validSig = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");

  it("accepts a valid signature within the replay window", () => {
    const result = verifyGhanaRailsSignature({
      rawBody,
      timestamp: ts,
      signature: validSig,
      secret,
      now,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects when timestamp is missing", () => {
    const result = verifyGhanaRailsSignature({
      rawBody,
      timestamp: null,
      signature: validSig,
      secret,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_timestamp");
  });

  it("rejects when timestamp is older than the replay window", () => {
    const result = verifyGhanaRailsSignature({
      rawBody,
      timestamp: (now - 10 * 60).toString(),
      signature: validSig,
      secret,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("stale");
  });

  it("rejects when timestamp is too far in the future", () => {
    const result = verifyGhanaRailsSignature({
      rawBody,
      timestamp: (now + 10 * 60).toString(),
      signature: validSig,
      secret,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("stale");
  });

  it("rejects when signature is missing", () => {
    const result = verifyGhanaRailsSignature({
      rawBody,
      timestamp: ts,
      signature: null,
      secret,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_signature");
  });

  it("rejects when body is tampered", () => {
    const tampered = rawBody.replace("completed", "failed");
    const result = verifyGhanaRailsSignature({
      rawBody: tampered,
      timestamp: ts,
      signature: validSig,
      secret,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("bad_signature");
  });
});
