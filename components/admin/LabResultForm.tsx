"use client";

import { useState, useEffect } from "react";
import { LabResult, TestResult, Appointment } from "@/types";
import { Save, X, Plus, Trash2, Upload, FileText } from "lucide-react";

interface LabResultFormProps {
  labResult?: LabResult;
  patientId?: string;
  appointmentId?: string;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function LabResultForm({
  labResult,
  patientId,
  appointmentId,
  onSave,
  onCancel,
  loading = false,
}: LabResultFormProps) {
  const [formData, setFormData] = useState({
    patient_id: patientId || labResult?.patient_id || "",
    appointment_id: appointmentId || labResult?.appointment_id || "",
    test_name: labResult?.test_name || "",
    test_type: labResult?.test_type || "",
    ordered_date: labResult?.ordered_date || new Date().toISOString().split("T")[0],
    completed_date: labResult?.completed_date || "",
    results: (labResult?.results || {}) as TestResult,
    normal_range: labResult?.normal_range || "",
    units: labResult?.units || "",
    file_urls: labResult?.file_urls || [] as string[],
    status: labResult?.status || "pending",
    notes: labResult?.notes || "",
    doctor_notes: labResult?.doctor_notes || "",
  });

  const [newResultKey, setNewResultKey] = useState("");
  const [newResultValue, setNewResultValue] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (patientId) {
      fetch(`/api/appointments?patient_id=${patientId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.appointments) {
            setAppointments(data.appointments);
          }
        })
        .catch(console.error);
    }
  }, [patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const addResult = () => {
    if (newResultKey.trim() && newResultValue.trim()) {
      setFormData({
        ...formData,
        results: {
          ...formData.results,
          [newResultKey.trim()]: newResultValue.trim(),
        },
      });
      setNewResultKey("");
      setNewResultValue("");
    }
  };

  const removeResult = (key: string) => {
    const updated = { ...formData.results };
    delete updated[key];
    setFormData({ ...formData, results: updated });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("bucket", "lab-results");
        if (formData.patient_id) {
          uploadFormData.append("folder", formData.patient_id);
        }

        const response = await fetch("/api/storage/upload", {
          method: "POST",
          body: uploadFormData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const data = await response.json();
        return { url: data.url, path: data.path };
      });

      const uploadResults = await Promise.all(uploadPromises);
      const newUrls = uploadResults.map((result) => result.url);
      
      setFormData({
        ...formData,
        file_urls: [...formData.file_urls, ...newUrls],
      });
    } catch (error: any) {
      console.error("File upload error:", error);
      alert(error.message || "Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (index: number) => {
    const urlToRemove = formData.file_urls[index];
    
    // Extract path from URL for deletion
    // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
    try {
      const urlParts = urlToRemove.split("/");
      const bucketIndex = urlParts.findIndex((part) => 
        ["lab-results", "clinical-notes", "intake-forms"].includes(part)
      );
      
      if (bucketIndex !== -1) {
        const bucket = urlParts[bucketIndex];
        const path = urlParts.slice(bucketIndex + 1).join("/");
        
        // Delete from storage
        const response = await fetch(`/api/storage/upload?bucket=${bucket}&path=${encodeURIComponent(path)}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          console.error("Failed to delete file from storage");
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
    
    // Remove from form data
    setFormData({
      ...formData,
      file_urls: formData.file_urls.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {labResult ? "Edit Lab Result" : "Create Lab Result"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Patient ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Appointment (Optional)
            </label>
            <select
              value={formData.appointment_id || ""}
              onChange={(e) => setFormData({ ...formData, appointment_id: e.target.value || "" })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select appointment...</option>
              {appointments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {new Date(apt.appointment_date).toLocaleString()} - {apt.treatment_type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Test Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.test_name}
              onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Test Type
            </label>
            <select
              value={formData.test_type}
              onChange={(e) => setFormData({ ...formData, test_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select type...</option>
              <option value="blood">Blood Test</option>
              <option value="urine">Urine Test</option>
              <option value="imaging">Imaging</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ordered Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.ordered_date}
              onChange={(e) => setFormData({ ...formData, ordered_date: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Completed Date
            </label>
            <input
              type="date"
              value={formData.completed_date}
              onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Test Results
          </label>
          <div className="space-y-3">
            {Object.entries(formData.results).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">{key}:</span>
                  <span className="ml-2 text-gray-700 dark:text-gray-300">{String(value)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeResult(key)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <input
                type="text"
                value={newResultKey}
                onChange={(e) => setNewResultKey(e.target.value)}
                placeholder="Result name (e.g., Hemoglobin)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <input
                type="text"
                value={newResultValue}
                onChange={(e) => setNewResultValue(e.target.value)}
                placeholder="Value (e.g., 14.5)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={addResult}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Normal Range
            </label>
            <input
              type="text"
              value={formData.normal_range}
              onChange={(e) => setFormData({ ...formData, normal_range: e.target.value })}
              placeholder="e.g., 12.0-16.0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Units
            </label>
            <input
              type="text"
              value={formData.units}
              onChange={(e) => setFormData({ ...formData, units: e.target.value })}
              placeholder="e.g., g/dL, mmol/L"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="reviewed">Reviewed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Attachments
          </label>
          <div className="space-y-2">
            {formData.file_urls.map((url, index) => {
              const fileName = url.split("/").pop() || `File ${index + 1}`;
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
                      if (confirm("Are you sure you want to remove this file?")) {
                        removeFile(index);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-500">
              <Upload className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {uploading ? "Uploading..." : "Upload Files"}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="General notes about this lab result..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Doctor Notes (Internal)
          </label>
          <textarea
            value={formData.doctor_notes}
            onChange={(e) => setFormData({ ...formData, doctor_notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Internal notes for doctors only..."
          />
        </div>

        <div className="flex justify-end gap-3">
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
                Save
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
