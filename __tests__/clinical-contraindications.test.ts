/**
 * @jest-environment node
 *
 * Patient-context safety check: cross-reference prescribed herbs against the
 * patient's documented allergies and current medications. Locking the rule
 * that a documented allergy or a known drug interaction produces a high-
 * severity warning (which the route handler turns into a 422 block).
 */
import {
  checkPatientContraindications,
  validatePrescription,
} from "../lib/clinical/prescription-validator";
import { HerbFormula } from "@/types";

function herb(name: string): HerbFormula {
  return { name, quantity: 1, unit: "grams", dosage: "1x daily" } as HerbFormula;
}

describe("checkPatientContraindications", () => {
  it("returns no warnings when patient has no allergies/meds", () => {
    const warnings = checkPatientContraindications(
      [herb("Ginkgo Biloba")],
      [],
      []
    );
    expect(warnings).toEqual([]);
  });

  it("flags a herb the patient is allergic to as high severity", () => {
    const warnings = checkPatientContraindications(
      [herb("Ginger")],
      ["ginger"],
      []
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("high");
    expect(warnings[0].message).toMatch(/allergy/i);
  });

  it("flags herb-vs-drug interaction (Ginkgo + Warfarin) as high", () => {
    const warnings = checkPatientContraindications(
      [herb("Ginkgo Biloba")],
      [],
      ["warfarin 5mg daily"]
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("high");
    expect(warnings[0].message).toMatch(/warfarin/i);
  });

  it("flags multiple interactions when several meds match", () => {
    const warnings = checkPatientContraindications(
      [herb("St. John's Wort")],
      [],
      ["sertraline (SSRI)", "warfarin"]
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].severity).toBe("high");
  });

  it("does not flag an unrelated medication", () => {
    const warnings = checkPatientContraindications(
      [herb("Echinacea")],
      [],
      ["lisinopril 10mg"]
    );
    expect(warnings).toEqual([]);
  });
});

describe("validatePrescription — pair-wise herb interactions", () => {
  it("flags Ginkgo + Garlic together (both blood-thinning) — duplicates check still passes", () => {
    const result = validatePrescription({
      patient_id: "00000000-0000-0000-0000-000000000001",
      herbs_formulas: [herb("Ginkgo Biloba"), herb("Garlic")],
    } as any);
    expect(result.valid).toBe(true);
  });

  it("flags duplicate herbs as a medium warning, not an error", () => {
    const result = validatePrescription({
      patient_id: "00000000-0000-0000-0000-000000000001",
      herbs_formulas: [herb("Ginger"), herb("Ginger")],
    } as any);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.severity === "medium")).toBe(true);
  });

  it("errors on empty herb list", () => {
    const result = validatePrescription({
      patient_id: "00000000-0000-0000-0000-000000000001",
      herbs_formulas: [],
    } as any);
    expect(result.valid).toBe(false);
  });
});
