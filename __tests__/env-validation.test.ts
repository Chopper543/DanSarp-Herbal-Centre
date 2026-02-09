import { validateEnv } from "../lib/config/env-validation";

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("produces warnings when Ghana rails settings are missing", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://dansarpherbal.com";
    process.env.CSRF_SECRET = "12345678901234567890123456789012";
    process.env.TWO_FA_ENC_KEY = "12345678901234567890123456789012";
    process.env.PAYSTACK_SECRET_KEY = "paystack-key";
    process.env.FLUTTERWAVE_SECRET_KEY = "flw-key";

    delete process.env.GHANA_RAILS_WEBHOOK_SECRET;
    delete process.env.GHANA_RAILS_MERCHANT_MOMO;
    delete process.env.GHANA_RAILS_BANK_ACCOUNT;
    delete process.env.GHANA_RAILS_BANK_NAME;
    delete process.env.GHANA_RAILS_BANK_ACCOUNT_NAME;

    const result = validateEnv(true);

    expect(result.valid).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("GHANA_RAILS_WEBHOOK_SECRET"))
    ).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("Bank transfer details for Ghana rails"))
    ).toBe(true);
  });
});
