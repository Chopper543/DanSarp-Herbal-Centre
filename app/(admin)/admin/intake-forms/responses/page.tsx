"use client";

import { useEffect, useState } from "react";
import { IntakeFormResponse, IntakeForm } from "@/types";
import { IntakeFormResponseViewer } from "@/components/admin/IntakeFormResponseViewer";
import { Search, Filter, Eye, CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminIntakeFormResponsesPage() {
  const [responses, setResponses] = useState<IntakeFormResponse[]>([]);
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingResponse, setViewingResponse] = useState<IntakeFormResponse | null>(null);
  const [viewingForm, setViewingForm] = useState<IntakeForm | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterForm, setFilterForm] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResponses();
    fetchForms();
  }, [filterStatus, filterForm]);

  const fetchForms = async () => {
    try {
      const response = await fetch("/api/intake-forms");
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
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterForm) params.append("form_id", filterForm);

      const url = `/api/intake-forms/responses${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
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

  const handleReview = async (responseId: string, status: "approved" | "rejected", notes: string) => {
    try {
      const response = await fetch(`/api/intake-forms/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: responseId,
          status,
          review_notes: notes,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchResponses();
        setViewingResponse(null);
        setViewingForm(null);
      } else {
        setError(data.error || "Failed to review response");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const filteredResponses = responses.filter((response) => {
    const matchesSearch =
      searchTerm === "" ||
      response.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

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

  if (loading && responses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading responses...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Intake Form Responses</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {viewingResponse && viewingForm && (
        <div className="mb-6">
          <IntakeFormResponseViewer
            response={viewingResponse}
            form={viewingForm}
            onReview={handleReview}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by patient ID or response ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <select
                value={filterForm}
                onChange={(e) => setFilterForm(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Forms</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Form
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Patient ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredResponses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No responses found
                  </td>
                </tr>
              ) : (
                filteredResponses.map((response) => {
                  const form = forms.find((f) => f.id === response.form_id);
                  return (
                    <tr key={response.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {form?.name || "Unknown Form"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {response.patient_id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {response.submitted_at
                          ? new Date(response.submitted_at).toLocaleDateString()
                          : "Not submitted"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getStatusColor(
                            response.status
                          )}`}
                        >
                          {getStatusIcon(response.status)}
                          {response.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setViewingForm(form || null);
                            setViewingResponse(response);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
