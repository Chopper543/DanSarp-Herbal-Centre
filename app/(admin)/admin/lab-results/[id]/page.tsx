"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LabResult } from "@/types";
import { LabResultForm } from "@/components/admin/LabResultForm";
import { LabResultViewer } from "@/components/admin/LabResultViewer";
import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";

export default function AdminLabResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [labResult, setLabResult] = useState<LabResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchLabResult(params.id as string);
    }
  }, [params.id]);

  const fetchLabResult = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/lab-results/${id}`);
      const data = await response.json();

      if (response.ok) {
        setLabResult(data.lab_result);
      } else {
        setError(data.error || "Failed to fetch lab result");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      setError(null);
      const response = await fetch("/api/lab-results", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: labResult?.id, ...formData }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchLabResult(params.id as string);
        setEditing(false);
      } else {
        setError(data.error || "Failed to update lab result");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading lab result...</div>
      </div>
    );
  }

  if (error || !labResult) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || "Lab result not found"}
        </div>
        <Link
          href="/admin/lab-results"
          className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lab Results
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Link
          href="/admin/lab-results"
          className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Lab Results
        </Link>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {editing ? (
        <LabResultForm
          labResult={labResult}
          patientId={labResult.patient_id}
          appointmentId={labResult.appointment_id || undefined}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <LabResultViewer
          labResult={labResult}
          onEdit={() => setEditing(true)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  );
}
