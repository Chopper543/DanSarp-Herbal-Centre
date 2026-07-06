import { z } from "zod";

/**
 * Vital-sign bounds. Two layers:
 *   - "survivable" — Zod schema rejects values that are physiologically
 *     impossible (e.g. SBP 1000). Catches data-entry typos before they
 *     poison clinical decisions.
 *   - "normal" — used for warning flags, not rejection. Lets clinicians
 *     record genuine outliers (febrile patient, hypertensive crisis) but
 *     surfaces them in the response so the UI can highlight.
 *
 * Bounds chosen from clinical references; intentionally generous on the
 * high end to admit critical-but-real values (e.g. fever to 43°C).
 */

const NULLABLE_NUM = z.number().nullable().optional();

export const VitalSignsSchema = z
  .object({
    blood_pressure_systolic: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 50 && v <= 300),
      { message: "blood_pressure_systolic must be between 50 and 300 mmHg" }
    ),
    blood_pressure_diastolic: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 20 && v <= 200),
      { message: "blood_pressure_diastolic must be between 20 and 200 mmHg" }
    ),
    heart_rate: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 20 && v <= 250),
      { message: "heart_rate must be between 20 and 250 bpm" }
    ),
    pulse: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 20 && v <= 250),
      { message: "pulse must be between 20 and 250 bpm" }
    ),
    respiratory_rate: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 5 && v <= 60),
      { message: "respiratory_rate must be between 5 and 60 breaths/min" }
    ),
    spo2: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 50 && v <= 100),
      { message: "spo2 must be between 50 and 100 %" }
    ),
    oxygen_saturation: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 50 && v <= 100),
      { message: "oxygen_saturation must be between 50 and 100 %" }
    ),
    temperature: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 30 && v <= 43),
      { message: "temperature must be between 30 and 43 °C" }
    ),
    temperature_unit: z.enum(["celsius", "fahrenheit"]).optional(),
    weight: NULLABLE_NUM.refine(
      (v) => v == null || (v > 0 && v <= 500),
      { message: "weight must be between 0 and 500 kg" }
    ),
    weight_unit: z.enum(["kg", "lbs"]).optional(),
    height: NULLABLE_NUM.refine(
      (v) => v == null || (v >= 30 && v <= 250),
      { message: "height must be between 30 and 250 cm" }
    ),
    height_unit: z.enum(["cm", "ft"]).optional(),
    blood_pressure: z
      .string()
      .regex(/^\d{2,3}\/\d{2,3}$/, "blood_pressure must look like '120/80'")
      .optional(),
  })
  .strict();

export type VitalSignsInput = z.infer<typeof VitalSignsSchema>;

export interface VitalSignWarning {
  field: string;
  value: number;
  severity: "warning" | "critical";
  reason: string;
}

/**
 * Soft warnings — values inside the survivable bounds but outside the normal
 * adult range. These are returned alongside a successful response so the UI
 * can flag them; they never block a write.
 */
export function findVitalSignWarnings(vitals: VitalSignsInput | null | undefined): VitalSignWarning[] {
  if (!vitals) return [];
  const warnings: VitalSignWarning[] = [];

  const push = (
    field: string,
    value: number | null | undefined,
    band: { normalMin: number; normalMax: number; criticalMin?: number; criticalMax?: number },
    unit: string
  ) => {
    if (value == null) return;
    if (band.criticalMin != null && value <= band.criticalMin) {
      warnings.push({ field, value, severity: "critical", reason: `Critically low (${value} ${unit})` });
      return;
    }
    if (band.criticalMax != null && value >= band.criticalMax) {
      warnings.push({ field, value, severity: "critical", reason: `Critically high (${value} ${unit})` });
      return;
    }
    if (value < band.normalMin) {
      warnings.push({ field, value, severity: "warning", reason: `Below normal (${value} ${unit})` });
    } else if (value > band.normalMax) {
      warnings.push({ field, value, severity: "warning", reason: `Above normal (${value} ${unit})` });
    }
  };

  push("blood_pressure_systolic", vitals.blood_pressure_systolic, { normalMin: 90, normalMax: 140, criticalMin: 70, criticalMax: 180 }, "mmHg");
  push("blood_pressure_diastolic", vitals.blood_pressure_diastolic, { normalMin: 60, normalMax: 90, criticalMin: 40, criticalMax: 120 }, "mmHg");
  push("heart_rate", vitals.heart_rate, { normalMin: 60, normalMax: 100, criticalMin: 40, criticalMax: 150 }, "bpm");
  push("pulse", vitals.pulse, { normalMin: 60, normalMax: 100, criticalMin: 40, criticalMax: 150 }, "bpm");
  push("respiratory_rate", vitals.respiratory_rate, { normalMin: 12, normalMax: 20, criticalMin: 8, criticalMax: 30 }, "breaths/min");
  push("spo2", vitals.spo2, { normalMin: 95, normalMax: 100, criticalMin: 88 }, "%");
  push("oxygen_saturation", vitals.oxygen_saturation, { normalMin: 95, normalMax: 100, criticalMin: 88 }, "%");
  push("temperature", vitals.temperature, { normalMin: 36, normalMax: 37.5, criticalMin: 34, criticalMax: 39.5 }, "°C");

  return warnings;
}
