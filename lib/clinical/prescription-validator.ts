/**
 * Prescription Validation Utilities
 * Checks for herb interactions, dosage validation, and prescription safety
 */

import { HerbFormula, Prescription } from "@/types";

export interface InteractionWarning {
  severity: "low" | "medium" | "high";
  message: string;
  herbs: string[];
}

// Known herb interactions database (simplified - in production, use a comprehensive database)
const HERB_INTERACTIONS: Record<string, string[]> = {
  "Ginkgo Biloba": ["Blood Thinners", "Aspirin", "Warfarin"],
  "St. John's Wort": ["Antidepressants", "Birth Control", "Blood Thinners"],
  "Ginseng": ["Blood Thinners", "Diabetes Medications", "Stimulants"],
  "Garlic": ["Blood Thinners", "Antiplatelet Drugs"],
  "Turmeric": ["Blood Thinners", "Diabetes Medications"],
  "Echinacea": ["Immunosuppressants"],
  "Kava": ["Alcohol", "Sedatives", "Liver Medications"],
};

/**
 * Check for potential herb interactions
 */
export function checkHerbInteractions(herbs: HerbFormula[]): InteractionWarning[] {
  const warnings: InteractionWarning[] = [];
  const herbNames = herbs.map((h) => h.name);

  // Check each herb against known interactions
  for (const herb of herbs) {
    const interactions = HERB_INTERACTIONS[herb.name];
    if (interactions) {
      // Check if any interacting herbs are also in the prescription
      const conflictingHerbs = herbNames.filter(
        (name) => name !== herb.name && interactions.includes(name)
      );

      if (conflictingHerbs.length > 0) {
        warnings.push({
          severity: "high",
          message: `${herb.name} may interact with ${conflictingHerbs.join(", ")}`,
          herbs: [herb.name, ...conflictingHerbs],
        });
      }
    }
  }

  // Check for duplicate herbs
  const herbCounts: Record<string, number> = {};
  herbNames.forEach((name) => {
    herbCounts[name] = (herbCounts[name] || 0) + 1;
  });

  const duplicates = Object.entries(herbCounts)
    .filter(([_, count]) => count > 1)
    .map(([name]) => name);

  if (duplicates.length > 0) {
    warnings.push({
      severity: "medium",
      message: `Duplicate herbs detected: ${duplicates.join(", ")}. Please verify dosages.`,
      herbs: duplicates,
    });
  }

  return warnings;
}

/**
 * Validate dosage information
 */
export function validateDosage(herb: HerbFormula): string[] {
  const errors: string[] = [];

  if (!herb.name || herb.name.trim() === "") {
    errors.push("Herb name is required");
  }

  if (!herb.quantity || herb.quantity <= 0) {
    errors.push("Quantity must be greater than 0");
  }

  if (!herb.unit || herb.unit.trim() === "") {
    errors.push("Unit is required (e.g., grams, ml, tablets)");
  }

  if (!herb.dosage || herb.dosage.trim() === "") {
    errors.push("Dosage instructions are required");
  }

  // Validate unit format
  const validUnits = ["grams", "g", "ml", "milliliters", "tablets", "capsules", "drops", "teaspoons", "tablespoons"];
  if (herb.unit && !validUnits.some((u) => herb.unit.toLowerCase().includes(u.toLowerCase()))) {
    errors.push(`Unit "${herb.unit}" may not be standard. Please verify.`);
  }

  return errors;
}

/**
 * Validate entire prescription
 */
export function validatePrescription(prescription: Partial<Prescription>): {
  valid: boolean;
  errors: string[];
  warnings: InteractionWarning[];
} {
  const errors: string[] = [];
  const warnings: InteractionWarning[] = [];

  // Basic validation
  if (!prescription.patient_id) {
    errors.push("Patient ID is required");
  }

  if (!prescription.herbs_formulas || prescription.herbs_formulas.length === 0) {
    errors.push("At least one herb/formula is required");
  } else {
    // Validate each herb
    prescription.herbs_formulas.forEach((herb, index) => {
      const herbErrors = validateDosage(herb);
      herbErrors.forEach((error) => {
        errors.push(`Herb ${index + 1}: ${error}`);
      });
    });

    // Check for interactions
    const interactionWarnings = checkHerbInteractions(prescription.herbs_formulas);
    warnings.push(...interactionWarnings);
  }

  // Validate dates
  if (prescription.start_date && prescription.expiry_date) {
    const start = new Date(prescription.start_date);
    const expiry = new Date(prescription.expiry_date);
    if (expiry <= start) {
      errors.push("Expiry date must be after start date");
    }
  }

  // Validate refills
  if (prescription.refills_original !== undefined && prescription.refills_original < 0) {
    errors.push("Refills cannot be negative");
  }

  if (prescription.duration_days !== undefined && prescription.duration_days <= 0) {
    errors.push("Duration must be greater than 0");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if prescription is expired
 */
export function isPrescriptionExpired(prescription: Prescription): boolean {
  if (!prescription.expiry_date) {
    return false;
  }
  const expiry = new Date(prescription.expiry_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

/**
 * Check if prescription can be refilled
 */
export function canRefillPrescription(prescription: Prescription): {
  canRefill: boolean;
  reason?: string;
} {
  if (prescription.status !== "active") {
    return {
      canRefill: false,
      reason: `Prescription is ${prescription.status}`,
    };
  }

  if (isPrescriptionExpired(prescription)) {
    return {
      canRefill: false,
      reason: "Prescription has expired",
    };
  }

  if (prescription.refills_remaining <= 0) {
    return {
      canRefill: false,
      reason: "No refills remaining",
    };
  }

  return { canRefill: true };
}
