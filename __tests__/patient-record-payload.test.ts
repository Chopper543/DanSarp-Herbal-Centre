import {
  PatientRecordPayloadSchema,
  normalizePatientRecordPayload,
  normalizePatientRecordUpdatePayload,
} from "@/lib/patient-records/payload";

describe("Patient record payload contract", () => {
  it("accepts form-compatible patient record payload", () => {
    const parsed = PatientRecordPayloadSchema.safeParse({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      home_address: "Koforidua",
      city: "Koforidua",
      region: "Eastern",
      postal_code: "00233",
      allergies: ["ginger", "pepper"],
      current_medications: ["herbal tea"],
      medical_history: [
        { condition: "Hypertension", started: "2024-01-01", notes: "Monitored monthly" },
      ],
      doctor_notes: [
        {
          date: "2025-01-15",
          doctor: "Dr. Mensah",
          report: "Stable",
          attachments: ["https://example.com/report.pdf"],
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("normalizes and sanitizes create payload to DB-friendly shape", () => {
    const normalized = normalizePatientRecordPayload({
      address: "<b>Gyamfikrom</b>",
      allergies: ["  Peanut ", "<script>alert(1)</script>Dust"],
      current_medications: ["Capsule A", ""],
      medical_history: [
        {
          condition: "<i>Asthma</i>",
          started: "2024-02-01",
          ended: null,
          notes: "<img src=x onerror=alert(1)>Mild",
        },
      ],
      doctor_notes: [
        {
          date: "2025-01-01",
          doctor: "<b>Dr. A</b>",
          report: "<p>Patient improving</p>",
          attachments: ["https://example.com/a.pdf", ""],
        },
      ],
      preferred_language: null,
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        home_address: "Gyamfikrom",
        preferred_language: "en",
        allergies: ["Peanut", "Dust"],
        current_medications: ["Capsule A"],
      })
    );
    expect(normalized.medical_history).toEqual([
      {
        condition: "Asthma",
        started: "2024-02-01",
        notes: "Mild",
      },
    ]);
  });

  it("normalizes update payload without overwriting unspecified fields", () => {
    const normalized = normalizePatientRecordUpdatePayload({
      city: "Accra",
      notes: "<p>Follow-up in 2 weeks</p>",
    });

    expect(normalized).toEqual({
      city: "Accra",
      notes: "Follow-up in 2 weeks",
    });
    expect("allergies" in normalized).toBe(false);
    expect("medical_history" in normalized).toBe(false);
  });
});
