import {
  AppointmentRequestSchema,
  SubscribeRequestSchema,
  UpdateSubscriberSchema,
  MessageRequestSchema,
} from "@/lib/validation/api-schemas";
import { verifyFlutterwaveSignature } from "@/lib/payments/webhook-signature";

describe("API validation schemas", () => {
  it("accepts a valid appointment request", () => {
    const result = AppointmentRequestSchema.safeParse({
      branch_id: "123e4567-e89b-12d3-a456-426614174000",
      appointment_date: new Date().toISOString(),
      treatment_type: "Consultation",
      payment_id: "123e4567-e89b-12d3-a456-426614174111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects appointment request with invalid uuid", () => {
    const result = AppointmentRequestSchema.safeParse({
      branch_id: "not-a-uuid",
      appointment_date: new Date().toISOString(),
      treatment_type: "Consultation",
      payment_id: "123e4567-e89b-12d3-a456-426614174111",
    });
    expect(result.success).toBe(false);
  });

  it("validates newsletter subscribe email", () => {
    expect(
      SubscribeRequestSchema.safeParse({ email: "user@example.com" }).success
    ).toBe(true);
    expect(
      SubscribeRequestSchema.safeParse({ email: "bad-email" }).success
    ).toBe(false);
  });

  it("validates newsletter update payload", () => {
    const result = UpdateSubscriberSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174222",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires recipient or department for messages", () => {
    const missingRecipient = MessageRequestSchema.safeParse({
      subject: "Hello",
      content: "World",
    });
    expect(missingRecipient.success).toBe(false);

    const withDepartment = MessageRequestSchema.safeParse({
      department: "admin",
      subject: "Hello",
      content: "World",
    });
    expect(withDepartment.success).toBe(true);
  });
});

describe("Webhook signature verification", () => {
  const body = JSON.stringify({ data: { id: 123 } });
  const secret = "test-secret";

  it("returns true for valid Flutterwave signature", () => {
    const crypto = require("crypto");
    const signature = crypto.createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyFlutterwaveSignature(body, signature, secret)).toBe(true);
  });

  it("returns false for invalid Flutterwave signature", () => {
    expect(verifyFlutterwaveSignature(body, "bad-signature", secret)).toBe(false);
  });

  it("throws when secret is missing", () => {
    expect(() => verifyFlutterwaveSignature(body, "signature")).toThrow(
      "Webhook secret not configured"
    );
  });
});
