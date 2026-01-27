"use client";

import { useEffect, useState } from "react";
import { Prescription } from "@/types";
import { PrescriptionBuilder } from "@/components/admin/PrescriptionBuilder";
import { Plus, Search, Edit, Trash2 } from "lucide-react";

export default function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrescriptions();
  }, [filterStatus]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const url = filterStatus
        ? `/api/prescriptions?status=${filterStatus}`
        : "/api/prescriptions";
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setPrescriptions(data.prescriptions || []);
      } else {
        setError(data.error || "Failed to fetch prescriptions");
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
      const url = "/api/prescriptions";
      const method = editingPrescription ? "PUT" : "POST";
      const body = editingPrescription
        ? { id: editingPrescription.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchPrescriptions();
        setShowForm(false);
        setEditingPrescription(null);
      } else {
        setError(data.error || "Failed to save prescription");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this prescription?")) {
      return;
    }

    try {
      const response = await fetch(`/api/prescriptions?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPrescriptions();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete prescription");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const filteredPrescriptions = prescriptions.filter((prescription) => {
    const matchesSearch =
      searchTerm === "" ||
      prescription.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.herbs_formulas.some((herb) =>
        herb.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  if (loading && prescriptions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading prescriptions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Prescription Management
        </h1>
        <button
          onClick={() => {
            setEditingPrescription(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Prescription
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <PrescriptionBuilder
            prescription={editingPrescription || undefined}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingPrescription(null);
            }}
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
                  placeholder="Search by patient ID or herb name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Patient ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Herbs/Formulas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Prescribed Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Refills
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
              {filteredPrescriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No prescriptions found
                  </td>
                </tr>
              ) : (
                filteredPrescriptions.map((prescription) => (
                  <tr key={prescription.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {prescription.patient_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="max-w-xs truncate">
                        {prescription.herbs_formulas.map((herb, idx) => (
                          <span key={idx} className="mr-2">
                            {herb.name}
                            {idx < prescription.herbs_formulas.length - 1 && ", "}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(prescription.prescribed_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {prescription.refills_remaining} / {prescription.refills_original}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                          prescription.status
                        )}`}
                      >
                        {prescription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingPrescription(prescription);
                            setShowForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(prescription.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                          title="Cancel"
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
