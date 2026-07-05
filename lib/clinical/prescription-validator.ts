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

/**
 * Herb → known interacting drug-classes / drugs (case-insensitive substring match).
 * NOT exhaustive; this is a first-line safety net to surface obvious conflicts at
 * prescribing time. The clinician remains the authority. Entries are matched
 * against the patient's `current_medications` list using lowercased substring
 * comparison so "Warfarin" matches "warfarin 5mg daily".
 */
const HERB_INTERACTIONS: Record<string, string[]> = {
  "Ginkgo Biloba": ["blood thinner", "aspirin", "warfarin", "clopidogrel", "heparin"],
  "St. John's Wort": ["antidepressant", "ssri", "maoi", "birth control", "oral contraceptive", "warfarin", "cyclosporine", "digoxin"],
  "Ginseng": ["warfarin", "insulin", "metformin", "stimulant", "mao inhibitor"],
  "Garlic": ["warfarin", "aspirin", "clopidogrel", "saquinavir"],
  "Turmeric": ["warfarin", "aspirin", "metformin", "insulin"],
  "Echinacea": ["immunosuppressant", "cyclosporine", "methotrexate"],
  "Kava": ["alcohol", "benzodiazepine", "sedative", "levodopa"],
  "Licorice": ["digoxin", "diuretic", "corticosteroid", "ace inhibitor"],
  "Ginger": ["warfarin", "aspirin", "clopidogrel"],
  "Hawthorn": ["digoxin", "beta blocker", "calcium channel blocker"],
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
 * Patient-context check: cross-reference prescribed herbs against the patient's
 * documented allergies and current medications. Returns warnings whose severity
 * the caller uses to decide whether to block:
 *   - "high" → block (allergy match, or known drug-class interaction)
 *   - "medium" → surface to clinician, do not block
 */
export function checkPatientContraindications(
  herbs: HerbFormula[],
  allergies: string[] | null | undefined,
  currentMedications: string[] | null | undefined
): InteractionWarning[] {
  const warnings: InteractionWarning[] = [];
  const allergyList = (allergies || []).map((a) => a.toLowerCase()).filter(Boolean);
  const medList = (currentMedications || []).map((m) => m.toLowerCase()).filter(Boolean);

  for (const herb of herbs) {
    const herbName = herb.name?.trim();
    if (!herbName) continue;
    const herbLower = herbName.toLowerCase();

    if (allergyList.some((a) => a.includes(herbLower) || herbLower.includes(a))) {
      warnings.push({
        severity: "high",
        message: `Patient has a documented allergy matching "${herbName}". Prescribing blocked.`,
        herbs: [herbName],
      });
    }

    const interactionKeywords = HERB_INTERACTIONS[herbName];
    if (interactionKeywords && medList.length > 0) {
      const conflicting = medList.filter((m) =>
        interactionKeywords.some((kw) => m.includes(kw.toLowerCase()))
      );
      if (conflicting.length > 0) {
        warnings.push({
          severity: "high",
          message: `${herbName} interacts with patient's current medication(s): ${conflicting.join(", ")}`,
          herbs: [herbName],
        });
      }
    }
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

  if (prescription.duration_days != null && prescription.duration_days <= 0) {
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
