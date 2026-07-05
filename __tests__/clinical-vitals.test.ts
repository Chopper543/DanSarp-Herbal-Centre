/**
 * @jest-environment node
 *
 * Zod-level rejection bounds + soft-warning band tests for vitals. The point
 * is to lock the two layers separately: schema parsing rejects the
 * physiologically impossible (data-entry typos), warnings flag the genuinely
 * abnormal but real (clinical heads-up, never blocking).
 */
import { VitalSignsSchema, findVitalSignWarnings } from "../lib/clinical/vitals";

describe("VitalSignsSchema — rejection bounds", () => {
  it("accepts physiologically reasonable vitals", () => {
    const result = VitalSignsSchema.safeParse({
      blood_pressure_systolic: 120,
      blood_pressure_diastolic: 80,
      heart_rate: 72,
      respiratory_rate: 16,
      spo2: 98,
      temperature: 36.7,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an impossible systolic BP (1000 mmHg → data-entry typo)", () => {
    const result = VitalSignsSchema.safeParse({ blood_pressure_systolic: 1000 });
    expect(result.success).toBe(false);
  });

  it("rejects a temperature below 30°C (incompatible with life)", () => {
    const result = VitalSignsSchema.safeParse({ temperature: 12 });
    expect(result.success).toBe(false);
  });

  it("rejects an spo2 above 100%", () => {
    const result = VitalSignsSchema.safeParse({ spo2: 105 });
    expect(result.success).toBe(false);
  });

  it("accepts a critical-but-real fever (41.5°C) without rejection", () => {
    const result = VitalSignsSchema.safeParse({ temperature: 41.5 });
    expect(result.success).toBe(true);
  });

  it("accepts a hypertensive-crisis reading (220/130) without rejection", () => {
    const result = VitalSignsSchema.safeParse({
      blood_pressure_systolic: 220,
      blood_pressure_diastolic: 130,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    const result = VitalSignsSchema.safeParse({ pancreas_size: 12 });
    expect(result.success).toBe(false);
  });

  it("requires blood_pressure string to look like '120/80'", () => {
    const ok = VitalSignsSchema.safeParse({ blood_pressure: "120/80" });
    expect(ok.success).toBe(true);
    const bad = VitalSignsSchema.safeParse({ blood_pressure: "very high" });
    expect(bad.success).toBe(false);
  });
});

describe("findVitalSignWarnings — soft warnings", () => {
  it("returns empty for null/undefined", () => {
    expect(findVitalSignWarnings(null)).toEqual([]);
    expect(findVitalSignWarnings(undefined)).toEqual([]);
  });

  it("returns no warnings for normal adult vitals", () => {
    const warnings = findVitalSignWarnings({
      blood_pressure_systolic: 120,
      blood_pressure_diastolic: 80,
      heart_rate: 72,
      respiratory_rate: 16,
      spo2: 98,
      temperature: 36.7,
    });
    expect(warnings).toEqual([]);
  });

  it("flags critically high BP (>=180/120) as critical", () => {
    const warnings = findVitalSignWarnings({
      blood_pressure_systolic: 200,
      blood_pressure_diastolic: 130,
    });
    const sysCritical = warnings.find((w) => w.field === "blood_pressure_systolic");
    expect(sysCritical?.severity).toBe("critical");
  });

  it("flags an out-of-range-but-not-critical heart rate as warning", () => {
    const warnings = findVitalSignWarnings({ heart_rate: 110 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("warning");
  });

  it("flags spo2 <=88% as critical (hypoxia)", () => {
    const warnings = findVitalSignWarnings({ spo2: 85 });
    expect(warnings[0].severity).toBe("critical");
  });

  it("flags low body temperature (35°C) as warning, not critical", () => {
    const warnings = findVitalSignWarnings({ temperature: 35 });
    expect(warnings[0].severity).toBe("warning");
  });
});
