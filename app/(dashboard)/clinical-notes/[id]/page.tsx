"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ClinicalNote } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PatientClinicalNoteDetailPage() {
  const params = useParams();
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchNote(params.id as string);
    }
  }, [params.id]);

  const fetchNote = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clinical-notes/${id}`);
      const data = await response.json();

      if (response.ok) {
        setNote(data.note);
      } else {
        setError(data.error || "Failed to fetch clinical note");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getNoteTypeLabel = (type: string) => {
    switch (type) {
      case "soap":
        return "SOAP Note";
      case "progress":
        return "Progress Note";
      case "general":
        return "General Note";
      default:
        return "Clinical Note";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading clinical note...</div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || "Clinical note not found"}
        </div>
        <Link
          href="/clinical-notes"
          className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clinical Notes
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/clinical-notes"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Clinical Notes
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            {getNoteTypeLabel(note.note_type)}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Created: {new Date(note.created_at).toLocaleString()}
          </p>
        </div>

        {note.subjective && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Subjective (S)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.subjective}</p>
          </div>
        )}

        {note.objective && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Objective (O)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.objective}</p>
            {note.vital_signs && Object.keys(note.vital_signs).length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Vital Signs</h3>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  {note.vital_signs.blood_pressure && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Blood Pressure: </span>
                      <span className="text-gray-900 dark:text-white">
                        {note.vital_signs.blood_pressure}
                      </span>
                    </div>
                  )}
                  {note.vital_signs.pulse && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Pulse: </span>
                      <span className="text-gray-900 dark:text-white">
                        {note.vital_signs.pulse} bpm
                      </span>
                    </div>
                  )}
                  {note.vital_signs.temperature && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Temperature: </span>
                      <span className="text-gray-900 dark:text-white">
                        {note.vital_signs.temperature}
                        {note.vital_signs.temperature_unit === "fahrenheit" ? "°F" : "°C"}
                      </span>
                    </div>
                  )}
                  {note.vital_signs.weight && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Weight: </span>
                      <span className="text-gray-900 dark:text-white">
                        {note.vital_signs.weight} {note.vital_signs.weight_unit || "kg"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {note.assessment && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Assessment (A)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.assessment}</p>
            {note.diagnosis_codes && note.diagnosis_codes.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Diagnosis Codes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {note.diagnosis_codes.map((code, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {note.plan && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Plan (P)</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.plan}</p>
          </div>
        )}
      </div>
    </div>
  );
}
