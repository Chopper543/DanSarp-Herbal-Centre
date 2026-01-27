"use client";

import { useState } from "react";
import { ClinicalNote, VitalSigns } from "@/types";
import { Save, X, FileText, Upload, Trash2 } from "lucide-react";

interface SOAPNoteEditorProps {
  note?: ClinicalNote;
  patientId?: string;
  appointmentId?: string;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function SOAPNoteEditor({
  note,
  patientId,
  appointmentId,
  onSave,
  onCancel,
  loading = false,
}: SOAPNoteEditorProps) {
  const [activeTab, setActiveTab] = useState<"subjective" | "objective" | "assessment" | "plan">(
    "subjective"
  );
  const [formData, setFormData] = useState({
    patient_id: patientId || note?.patient_id || "",
    appointment_id: appointmentId || note?.appointment_id || "",
    note_type: note?.note_type || "soap",
    subjective: note?.subjective || "",
    objective: note?.objective || "",
    assessment: note?.assessment || "",
    plan: note?.plan || "",
    vital_signs: (note?.vital_signs || {}) as VitalSigns,
    diagnosis_codes: note?.diagnosis_codes || [] as string[],
    attachments: note?.attachments || [] as string[],
  });

  const [newDiagnosisCode, setNewDiagnosisCode] = useState("");
  const [uploading, setUploading] = useState(false);

  const tabs = [
    { id: "subjective" as const, label: "Subjective (S)" },
    { id: "objective" as const, label: "Objective (O)" },
    { id: "assessment" as const, label: "Assessment (A)" },
    { id: "plan" as const, label: "Plan (P)" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const addDiagnosisCode = () => {
    if (newDiagnosisCode.trim()) {
      setFormData({
        ...formData,
        diagnosis_codes: [...formData.diagnosis_codes, newDiagnosisCode.trim()],
      });
      setNewDiagnosisCode("");
    }
  };

  const removeDiagnosisCode = (index: number) => {
    setFormData({
      ...formData,
      diagnosis_codes: formData.diagnosis_codes.filter((_, i) => i !== index),
    });
  };

  const updateVitalSign = (key: keyof VitalSigns, value: any) => {
    setFormData({
      ...formData,
      vital_signs: {
        ...formData.vital_signs,
        [key]: value,
      },
    });
  };

  const extractStoragePathFromPublicUrl = (url: string) => {
    // Expected shape: .../storage/v1/object/public/<bucket>/<path>
    const marker = "/storage/v1/object/public/clinical-notes/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("bucket", "clinical-notes");
        fd.append("folder", formData.patient_id || "unknown");
        fd.append("file", file);

        const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Upload failed");
        }
        if (json?.url) uploadedUrls.push(String(json.url));
      }

      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, ...uploadedUrls],
        }));
      }
    } catch (err: any) {
      alert(err?.message || "Failed to upload attachment(s)");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = async (index: number) => {
    const url = formData.attachments[index];
    if (!url) return;

    // Optimistically remove from UI
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));

    const path = extractStoragePathFromPublicUrl(url);
    if (!path) return;

    try {
      const res = await fetch(
        `/api/storage/upload?bucket=clinical-notes&path=${encodeURIComponent(path)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        // Don’t block UI; just log/alert
        const json = await res.json().catch(() => ({}));
        console.error("Failed to delete attachment:", json);
      }
    } catch (err) {
      console.error("Failed to delete attachment:", err);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {note ? "Edit SOAP Note" : "Create SOAP Note"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "subjective" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subjective - Patient's Description
              </label>
              <textarea
                value={formData.subjective}
                onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                placeholder="Patient's chief complaint, history of present illness, review of systems..."
              />
            </div>
          )}

          {activeTab === "objective" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Objective - Observable Findings
                </label>
                <textarea
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                  placeholder="Physical examination findings, vital signs, test results..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Vital Signs
                </label>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Blood Pressure
                    </label>
                    <input
                      type="text"
                      value={formData.vital_signs.blood_pressure || ""}
                      onChange={(e) => updateVitalSign("blood_pressure", e.target.value)}
                      placeholder="120/80"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Pulse (bpm)
                    </label>
                    <input
                      type="number"
                      value={formData.vital_signs.pulse || ""}
                      onChange={(e) => updateVitalSign("pulse", parseInt(e.target.value) || null)}
                      placeholder="72"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Temperature
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.vital_signs.temperature || ""}
                        onChange={(e) =>
                          updateVitalSign("temperature", parseFloat(e.target.value) || null)
                        }
                        placeholder="37.0"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                      />
                      <select
                        value={formData.vital_signs.temperature_unit || "celsius"}
                        onChange={(e) => updateVitalSign("temperature_unit", e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="celsius">°C</option>
                        <option value="fahrenheit">°F</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Weight
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.vital_signs.weight || ""}
                        onChange={(e) =>
                          updateVitalSign("weight", parseFloat(e.target.value) || null)
                        }
                        placeholder="70"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                      <select
                        value={formData.vital_signs.weight_unit || "kg"}
                        onChange={(e) => updateVitalSign("weight_unit", e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="kg">kg</option>
                        <option value="lbs">lbs</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Height
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.vital_signs.height || ""}
                        onChange={(e) =>
                          updateVitalSign("height", parseFloat(e.target.value) || null)
                        }
                        placeholder="170"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                      <select
                        value={formData.vital_signs.height_unit || "cm"}
                        onChange={(e) => updateVitalSign("height_unit", e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="cm">cm</option>
                        <option value="ft">ft</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Respiratory Rate
                    </label>
                    <input
                      type="number"
                      value={formData.vital_signs.respiratory_rate || ""}
                      onChange={(e) =>
                        updateVitalSign("respiratory_rate", parseInt(e.target.value) || null)
                      }
                      placeholder="16"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "assessment" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assessment - Clinical Assessment & Diagnosis
              </label>
              <textarea
                value={formData.assessment}
                onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Clinical assessment, differential diagnosis, working diagnosis..."
              />

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Diagnosis Codes (ICD-10, etc.)
                </label>
                <div className="space-y-2">
                  {formData.diagnosis_codes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">{code}</span>
                      <button
                        type="button"
                        onClick={() => removeDiagnosisCode(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDiagnosisCode}
                      onChange={(e) => setNewDiagnosisCode(e.target.value)}
                      placeholder="Enter diagnosis code"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={addDiagnosisCode}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "plan" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Plan - Treatment Plan & Next Steps
              </label>
              <textarea
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Treatment plan, medications, follow-up instructions, patient education..."
              />
            </div>
          )}
        </div>

        {/* Attachments Section */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Attachments
          </label>
          <div className="space-y-2">
            {formData.attachments.map((url, index) => {
              const fileName = url.split("/").pop() || `Attachment ${index + 1}`;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 truncate"
                    >
                      {fileName}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to remove this attachment?")) {
                        removeAttachment(index);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-500">
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {uploading ? "Uploading..." : "Upload Attachments"}
              </span>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Note
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
