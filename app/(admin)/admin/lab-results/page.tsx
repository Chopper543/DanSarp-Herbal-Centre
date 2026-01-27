"use client";

import { useEffect, useState } from "react";
import { LabResult } from "@/types";
import { LabResultForm } from "@/components/admin/LabResultForm";
import { LabResultViewer } from "@/components/admin/LabResultViewer";
import { Plus, Search, Edit, Trash2, Eye, X } from "lucide-react";

export default function AdminLabResultsPage() {
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingResult, setViewingResult] = useState<LabResult | null>(null);
  const [editingResult, setEditingResult] = useState<LabResult | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPatient, setFilterPatient] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLabResults();
  }, [filterStatus, filterPatient]);

  const fetchLabResults = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterPatient) params.append("patient_id", filterPatient);
      const url = `/api/lab-results${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setLabResults(data.lab_results || []);
      } else {
        setError(data.error || "Failed to fetch lab results");
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
      const url = "/api/lab-results";
      const method = editingResult ? "PUT" : "POST";
      const body = editingResult ? { id: editingResult.id, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchLabResults();
        setShowForm(false);
        setEditingResult(null);
      } else {
        setError(data.error || "Failed to save lab result");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lab result?")) {
      return;
    }

    try {
      const response = await fetch(`/api/lab-results/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchLabResults();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete lab result");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const filteredResults = labResults.filter((result) => {
    const matchesSearch =
      searchTerm === "" ||
      result.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.patient_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "reviewed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  if (loading && labResults.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading lab results...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lab Results Management</h1>
        <button
          onClick={() => {
            setEditingResult(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Lab Result
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <LabResultForm
            labResult={editingResult || undefined}
            patientId={editingResult?.patient_id}
            appointmentId={editingResult?.appointment_id || undefined}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingResult(null);
            }}
          />
        </div>
      )}

      {viewingResult && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lab Result Details</h2>
            <button
              onClick={() => setViewingResult(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <LabResultViewer
            labResult={viewingResult}
            onEdit={() => {
              setEditingResult(viewingResult);
              setViewingResult(null);
              setShowForm(true);
            }}
            onPrint={() => window.print()}
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
                  placeholder="Search by test name or patient ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <input
                type="text"
                placeholder="Patient ID..."
                value={filterPatient}
                onChange={(e) => setFilterPatient(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="reviewed">Reviewed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Test Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Patient ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Test Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Ordered Date
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
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No lab results found
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {result.test_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {result.patient_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {result.test_type || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(result.ordered_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(result.status)}`}
                      >
                        {result.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingResult(result)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingResult(result);
                            setShowForm(true);
                          }}
                          className="text-green-600 hover:text-green-800 dark:text-green-400"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(result.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
