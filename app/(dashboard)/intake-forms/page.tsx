"use client";

import { useEffect, useState } from "react";
import { IntakeForm, IntakeFormResponse } from "@/types";
import { IntakeFormFiller } from "@/components/dashboard/IntakeFormFiller";
import { Plus, Search, CheckCircle, Clock, FileText } from "lucide-react";
import Link from "next/link";

export default function PatientIntakeFormsPage() {
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [responses, setResponses] = useState<IntakeFormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fillingForm, setFillingForm] = useState<IntakeForm | null>(null);
  const [existingResponse, setExistingResponse] = useState<IntakeFormResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForms();
    fetchResponses();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await fetch("/api/intake-forms?is_active=true");
      const data = await response.json();
      if (response.ok) {
        setForms(data.forms || []);
      }
    } catch (err) {
      console.error("Failed to fetch forms:", err);
    }
  };

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/intake-forms/responses");
      const data = await response.json();
      if (response.ok) {
        setResponses(data.responses || []);
      } else {
        setError(data.error || "Failed to fetch responses");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStartFilling = async (form: IntakeForm) => {
    // Check if there's an existing draft response
    const existing = responses.find(
      (r) => r.form_id === form.id && (r.status === "draft" || !r.submitted_at)
    );
    if (existing) {
      setExistingResponse(existing);
    } else {
      setExistingResponse(null);
    }
    setFillingForm(form);
  };

  const handleSaveDraft = async (formData: Record<string, any>) => {
    if (!fillingForm) return;

    try {
      const responseId = existingResponse?.id;
      const url = responseId
        ? `/api/intake-forms/${fillingForm.id}/responses`
        : `/api/intake-forms/${fillingForm.id}/responses`;
      const method = responseId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: responseId,
          response_data: formData,
          status: "draft",
        }),
      });

      if (response.ok) {
        await fetchResponses();
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  };

  const handleSubmit = async (formData: Record<string, any>) => {
    if (!fillingForm) return;

    try {
      const responseId = existingResponse?.id;
      const url = `/api/intake-forms/${fillingForm.id}/responses`;
      const method = responseId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: responseId,
          response_data: formData,
          status: "submitted",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchResponses();
        setFillingForm(null);
        setExistingResponse(null);
        alert("Form submitted successfully!");
      } else {
        alert(data.error || "Failed to submit form");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "reviewed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "submitted":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  if (loading && forms.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading intake forms...</div>
      </div>
    );
  }

  if (fillingForm) {
    return (
      <div>
        <button
          onClick={() => {
            setFillingForm(null);
            setExistingResponse(null);
          }}
          className="mb-6 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2"
        >
          ← Back to Forms
        </button>
        <IntakeFormFiller
          form={fillingForm}
          responseData={existingResponse?.response_data}
          onSave={handleSaveDraft}
          onSubmit={handleSubmit}
          autoSave={true}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Intake Forms</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete intake forms before your appointments
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Available Forms</h2>
        {forms.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No intake forms available</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {forms.map((form) => {
              const response = responses.find((r) => r.form_id === form.id);
              const isSubmitted = response && response.status !== "draft";
              return (
                <div
                  key={form.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {form.name}
                      </h3>
                      {form.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{form.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{form.form_schema.fields?.length || 0} fields</span>
                        {response && (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              response.status
                            )}`}
                          >
                            {response.status === "draft" ? "Draft" : response.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartFilling(form)}
                      className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                    >
                      {response && response.status === "draft" ? (
                        <>
                          <Clock className="w-4 h-4" />
                          Continue
                        </>
                      ) : isSubmitted ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          View
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Fill Form
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {responses.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Previously Submitted
          </h2>
          <div className="grid gap-4">
            {responses
              .filter((r) => r.status !== "draft")
              .map((response) => {
                const form = forms.find((f) => f.id === response.form_id);
                return (
                  <div
                    key={response.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {form?.name || "Unknown Form"}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Submitted:{" "}
                          {response.submitted_at
                            ? new Date(response.submitted_at).toLocaleString()
                            : "Not submitted"}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          response.status
                        )}`}
                      >
                        {response.status}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
