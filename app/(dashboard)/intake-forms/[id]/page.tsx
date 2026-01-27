"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IntakeForm, IntakeFormResponse } from "@/types";
import { IntakeFormFiller } from "@/components/dashboard/IntakeFormFiller";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PatientIntakeFormFillPage() {
  const params = useParams();
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [response, setResponse] = useState<IntakeFormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchForm(params.id as string);
      fetchResponse(params.id as string);
    }
  }, [params.id]);

  const fetchForm = async (id: string) => {
    try {
      const response = await fetch(`/api/intake-forms/${id}`);
      const data = await response.json();
      if (response.ok) {
        setForm(data.form);
      } else {
        setError(data.error || "Failed to fetch form");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchResponse = async (formId: string) => {
    try {
      const response = await fetch(`/api/intake-forms/responses?form_id=${formId}`);
      const data = await response.json();
      if (response.ok && data.responses && data.responses.length > 0) {
        // Get the most recent response
        const sorted = data.responses.sort(
          (a: IntakeFormResponse, b: IntakeFormResponse) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setResponse(sorted[0]);
      }
    } catch (err) {
      console.error("Failed to fetch response:", err);
    }
  };

  const handleSave = async (formData: Record<string, any>) => {
    if (!form) return;

    try {
      const responseId = response?.id;
      const url = `/api/intake-forms/${form.id}/responses`;
      const method = responseId ? "PUT" : "POST";

      const saveRes = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: responseId,
          response_data: formData,
          status: "draft",
        }),
      });

      if (saveRes.ok) {
        await fetchResponse(form.id);
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  };

  const handleSubmit = async (formData: Record<string, any>) => {
    if (!form) return;

    try {
      const responseId = response?.id;
      const url = `/api/intake-forms/${form.id}/responses`;
      const method = responseId ? "PUT" : "POST";

      const submitRes = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: responseId,
          response_data: formData,
          status: "submitted",
        }),
      });

      const data = await submitRes.json();

      if (submitRes.ok) {
        alert("Form submitted successfully!");
        window.location.href = "/intake-forms";
      } else {
        alert(data.error || "Failed to submit form");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading form...</div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || "Form not found"}
        </div>
        <Link
          href="/intake-forms"
          className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Intake Forms
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/intake-forms"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Intake Forms
      </Link>

      <IntakeFormFiller
        form={form}
        responseData={response?.response_data}
        onSave={handleSave}
        onSubmit={handleSubmit}
        autoSave={true}
      />
    </div>
  );
}
