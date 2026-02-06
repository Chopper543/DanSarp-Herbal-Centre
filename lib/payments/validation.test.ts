import { validateGhanaPhoneNumber } from "./validation";

describe("validateGhanaPhoneNumber", () => {
  const validLocal = [
    "0241234567",
    "0251234567",
    "0531234567",
    "0541234567",
    "0551234567",
    "0591234567",
    "0201234567",
    "0501234567",
    "0271234567",
    "0571234567",
    "0261234567",
    "0561234567",
    "0231234567",
    "0544808098",
  ];

  const validInternational = [
    "+233241234567",
    "+233201234567",
    "+233271234567",
    "+233231234567",
    "+233544808098",
  ];

  it("accepts valid local format (0 + NDC + 7 digits) for all major networks", () => {
    validLocal.forEach((phone) => {
      expect(validateGhanaPhoneNumber(phone)).toBe(true);
    });
  });

  it("accepts valid international format (+233 + NDC + 7 digits)", () => {
    validInternational.forEach((phone) => {
      expect(validateGhanaPhoneNumber(phone)).toBe(true);
    });
  });

  it("rejects invalid prefixes", () => {
    expect(validateGhanaPhoneNumber("0121234567")).toBe(false);
    expect(validateGhanaPhoneNumber("0991234567")).toBe(false);
    expect(validateGhanaPhoneNumber("0301234567")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(validateGhanaPhoneNumber("024123456")).toBe(false);
    expect(validateGhanaPhoneNumber("02412345678")).toBe(false);
    expect(validateGhanaPhoneNumber("+23324123456")).toBe(false);
  });

  it("rejects empty or whitespace-only", () => {
    expect(validateGhanaPhoneNumber("")).toBe(false);
    expect(validateGhanaPhoneNumber("   ")).toBe(false);
  });

  it("accepts input with spaces stripped", () => {
    expect(validateGhanaPhoneNumber(" 054 480 8098 ")).toBe(true);
    expect(validateGhanaPhoneNumber("+233 24 123 4567")).toBe(true);
  });
});
