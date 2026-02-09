"use client";

import { useState, useEffect } from "react";
import { IntakeForm, FormField } from "@/types";
import { Save, CheckCircle, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface IntakeFormFillerProps {
  form: IntakeForm;
  responseData?: Record<string, any>;
  onSave: (data: Record<string, any>) => Promise<void>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  loading?: boolean;
  autoSave?: boolean;
}

export function IntakeFormFiller({
  form,
  responseData = {},
  onSave,
  onSubmit,
  loading = false,
  autoSave = true,
}: IntakeFormFillerProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>(responseData);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (autoSave && Object.keys(formValues).length > 0) {
      const timer = setTimeout(() => {
        handleAutoSave();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [formValues]);

  const handleAutoSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(formValues);
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    await onSubmit(formValues);
  };

  const renderField = (field: FormField) => {
    const value = formValues[field.name] || "";

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
            required={field.required}
            placeholder={field.placeholder}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
          />
        );
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
            required={field.required}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      setFormValues({ ...formValues, [field.name]: [...current, option] });
                    } else {
                      setFormValues({
                        ...formValues,
                        [field.name]: current.filter((v) => v !== option),
                      });
                    }
                  }}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                  required={field.required}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        );
      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
            required={field.required}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
          />
        );
      case "file":
        return (
          <div>
            <input
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploading({ ...uploading, [field.name]: true });
                  try {
                    const uploadFormData = new FormData();
                    uploadFormData.append("file", file);
                    uploadFormData.append("bucket", "intake-forms");

                    const response = await fetch("/api/storage/upload", {
                      method: "POST",
                      body: uploadFormData,
                    });

                    if (response.ok) {
                      const data = await response.json();
                      setFormValues({ ...formValues, [field.name]: data.url });
                    } else {
                      const error = await response.json();
                      toast({
                        title: "Upload failed",
                        description: error.error || "Please try again.",
                        variant: "error",
                      });
                    }
                  } catch (error: any) {
                    console.error("File upload error:", error);
                    toast({
                      title: "Upload failed",
                      description: error.message || "Please try again.",
                      variant: "error",
                    });
                  } finally {
                    setUploading({ ...uploading, [field.name]: false });
                  }
                }
              }}
              required={field.required && !formValues[field.name]}
              disabled={uploading[field.name]}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
            />
            {uploading[field.name] && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Uploading...</p>
            )}
            {formValues[field.name] && !uploading[field.name] && (
              <div className="mt-2">
                <a
                  href={formValues[field.name]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
                >
                  <FileText className="w-4 h-4" />
                  View uploaded file
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove this file?")) {
                      setFormValues({ ...formValues, [field.name]: "" });
                    }
                  }}
                  className="mt-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        );
      default:
        return (
          <input
            type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
            required={field.required}
            placeholder={field.placeholder}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {form.description && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{form.description}</p>
        </div>
      )}

      <div className="space-y-6">
        {form.form_schema.fields.map((field) => (
          <div key={field.id || field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField(field)}
            {field.help_text && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{field.help_text}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          {saving && <span>Auto-saving...</span>}
          {!saving && autoSave && Object.keys(formValues).length > 0 && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleAutoSave}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            type="submit"
            disabled={loading || submitted}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || submitted ? "Submitting..." : "Submit Form"}
          </button>
        </div>
      </div>
    </form>
  );
}
