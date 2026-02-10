import {
  PaymentRequestSchema,
  AppointmentRequestSchema,
} from "@/lib/validation/api-schemas";
import {
  canAccessSection,
  canAccessPaymentLedger,
  getAdminSectionsForRole,
  canAccessAuditLogs,
} from "@/lib/auth/role-capabilities";
import { getRateLimitIdentifier } from "@/lib/security/rate-limit-identifier";

describe("Critical path: payments", () => {
  it("accepts a valid payment request payload", () => {
    const result = PaymentRequestSchema.safeParse({
      amount: 100,
      currency: "GHS",
      payment_method: "mtn_momo",
      provider: "custom",
      phone_number: "0241234567",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid payment amount and provider", () => {
    const invalidAmount = PaymentRequestSchema.safeParse({
      amount: -5,
      payment_method: "mtn_momo",
    });
    expect(invalidAmount.success).toBe(false);

    const invalidProvider = PaymentRequestSchema.safeParse({
      amount: 100,
      payment_method: "mtn_momo",
      provider: "invalid-provider",
    });
    expect(invalidProvider.success).toBe(false);
  });
});

describe("Critical path: booking", () => {
  it("accepts valid appointment booking payload", () => {
    const result = AppointmentRequestSchema.safeParse({
      branch_id: "123e4567-e89b-12d3-a456-426614174000",
      appointment_date: new Date().toISOString(),
      treatment_type: "Consultation",
      payment_id: "123e4567-e89b-12d3-a456-426614174001",
      notes: "Follow-up visit",
    });

    expect(result.success).toBe(true);
  });

  it("requires payment_id for booking", () => {
    const result = AppointmentRequestSchema.safeParse({
      branch_id: "123e4567-e89b-12d3-a456-426614174000",
      appointment_date: new Date().toISOString(),
      treatment_type: "Consultation",
    });

    expect(result.success).toBe(false);
  });
});

describe("Critical path: RBAC", () => {
  it("enforces section and ledger capabilities", () => {
    expect(canAccessSection("doctor", "clinical_notes")).toBe(true);
    expect(canAccessSection("finance_manager", "clinical_notes")).toBe(false);
    expect(canAccessSection("user", "dashboard")).toBe(false);
    expect(canAccessSection("doctor", "patient_records")).toBe(true);
    expect(canAccessSection("nurse", "lab_results")).toBe(true);
    expect(canAccessSection("content_manager", "prescriptions")).toBe(false);
    expect(canAccessSection("finance_manager", "patient_records")).toBe(false);

    expect(canAccessPaymentLedger("finance_manager")).toBe(true);
    expect(canAccessPaymentLedger("doctor")).toBe(false);
    expect(canAccessAuditLogs("admin")).toBe(true);
    expect(canAccessAuditLogs("doctor")).toBe(false);

    const sections = getAdminSectionsForRole("content_manager");
    expect(sections).toContain("content");
    expect(sections).not.toContain("payments");
  });
});

describe("Critical path: auth and rate-limit security", () => {
  const originalEncKey = process.env.TWO_FA_ENC_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.TWO_FA_ENC_KEY = "12345678901234567890123456789012";
  });

  afterAll(() => {
    if (typeof originalEncKey === "undefined") {
      delete process.env.TWO_FA_ENC_KEY;
    } else {
      process.env.TWO_FA_ENC_KEY = originalEncKey;
    }
  });

  it("encrypts/decrypts 2FA secret and hashes backup code deterministically", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { encryptSecret, decryptSecret, hashBackupCode } = require("../lib/security/crypto");

    const plaintext = "BASE32TOTPSECRET";
    const encrypted = encryptSecret(plaintext);
    const decrypted = decryptSecret(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(hashBackupCode("abcd-1234")).toBe(hashBackupCode("ABCD-1234"));
  });

  it("builds user-bound rate-limit identifier for authenticated requests", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-forwarded-for" ? "203.0.113.10" : null,
      },
    } as unknown as Request;

    const identifier = getRateLimitIdentifier(req, "user-123");
    expect(identifier).toBe("user:user-123:ip:203.0.113.10");
  });
});
