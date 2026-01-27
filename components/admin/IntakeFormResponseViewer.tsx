"use client";

import { IntakeFormResponse, IntakeForm } from "@/types";
import { Calendar, User, CheckCircle, XCircle, Clock, Download, FileText } from "lucide-react";
import { useState } from "react";

interface IntakeFormResponseViewerProps {
  response: IntakeFormResponse;
  form: IntakeForm;
  onReview?: (responseId: string, status: "approved" | "rejected", notes: string) => Promise<void>;
  onExport?: (response: IntakeFormResponse) => void;
}

export function IntakeFormResponseViewer({
  response,
  form,
  onReview,
  onExport,
}: IntakeFormResponseViewerProps) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "reviewed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "submitted":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
      case "submitted":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!onReview) return;
    setReviewing(true);
    try {
      await onReview(response.id, status, reviewNotes);
      setReviewNotes("");
    } catch (error) {
      console.error("Review failed:", error);
    } finally {
      setReviewing(false);
    }
  };

  const exportToPDF = () => {
    if (onExport) {
      onExport(response);
    } else {
      // Fallback: Create a simple text representation
      const content = `
Intake Form Response
Form: ${form.name}
Patient ID: ${response.patient_id}
Status: ${response.status}
Submitted: ${response.submitted_at ? new Date(response.submitted_at).toLocaleString() : "Not submitted"}

Responses:
${Object.entries(response.response_data)
  .map(([key, value]) => {
    const field = form.form_schema.fields.find((f) => f.name === key);
    return `${field?.label || key}: ${Array.isArray(value) ? value.join(", ") : value}`;
  })
  .join("\n")}
      `.trim();

      const blob = new Blob([content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `intake-form-response-${response.id}.txt`;
      a.click();
    }
  };

  const renderFieldValue = (fieldName: string, value: any) => {
    const field = form.form_schema.fields.find((f) => f.name === fieldName);
    if (!field) return String(value);

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (field.type === "file" && typeof value === "string") {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
        >
          <FileText className="w-4 h-4" />
          View File
        </a>
      );
    }

    return String(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            {form.name} - Response
          </h2>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Patient: {response.patient_id}
            </span>
            {response.submitted_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Submitted: {new Date(response.submitted_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(
              response.status
            )}`}
          >
            {getStatusIcon(response.status)}
            {response.status.toUpperCase()}
          </span>
          {onExport && (
            <button
              onClick={exportToPDF}
              className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Export"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {form.description && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300">{form.description}</p>
        </div>
      )}

      <div className="space-y-6 mb-6">
        {form.form_schema.fields.map((field) => {
          const value = response.response_data[field.name];
          return (
            <div key={field.id || field.name} className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="text-gray-900 dark:text-white">
                {value !== undefined && value !== null && value !== "" ? (
                  renderFieldValue(field.name, value)
                ) : (
                  <span className="text-gray-400 italic">Not answered</span>
                )}
              </div>
              {field.help_text && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{field.help_text}</p>
              )}
            </div>
          );
        })}
      </div>

      {response.review_notes && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Review Notes</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">{response.review_notes}</p>
          {response.reviewed_at && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Reviewed on: {new Date(response.reviewed_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {onReview && response.status === "submitted" && (
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review Response</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Review Notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Add review notes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleReview("approved")}
                disabled={reviewing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => handleReview("rejected")}
                disabled={reviewing}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
