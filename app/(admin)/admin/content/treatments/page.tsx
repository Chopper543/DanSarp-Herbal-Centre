"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { Plus, Edit, Trash2, Activity, Search, Filter, CheckCircle, XCircle } from "lucide-react";

interface Treatment {
  id: string;
  name: string;
  slug: string;
  description: string;
  condition_type: string;
  pricing: {
    consultation: number;
    monthly_therapy: {
      min: number;
      max: number;
    };
    lifestyle_coaching: number;
    follow_up: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminTreatmentsPage() {
  const router = useRouter();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    condition_type: "",
    pricing: {
      consultation: 0,
      monthly_therapy: { min: 0, max: 0 },
      lifestyle_coaching: 0,
      follow_up: 0,
    },
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const role = await getUserRole();
      setUserRole(role);

      if (!isAdmin(role)) {
        router.push("/admin");
        return;
      }

      fetchTreatments();
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (userRole && isAdmin(userRole)) {
      fetchTreatments();
    }
  }, [filter]);

  async function fetchTreatments() {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/treatments?include_inactive=true" : "/api/treatments";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        let fetchedTreatments = data.treatments || [];
        if (filter === "inactive") {
          fetchedTreatments = fetchedTreatments.filter((t: Treatment) => !t.is_active);
        } else if (filter === "active") {
          fetchedTreatments = fetchedTreatments.filter((t: Treatment) => t.is_active);
        }
        setTreatments(fetchedTreatments);
      }
    } catch (error) {
      console.error("Failed to fetch treatments:", error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(treatment?: Treatment) {
    if (treatment) {
      setEditingTreatment(treatment);
      setFormData({
        name: treatment.name,
        slug: treatment.slug,
        description: treatment.description,
        condition_type: treatment.condition_type,
        pricing: treatment.pricing,
        is_active: treatment.is_active,
      });
    } else {
      setEditingTreatment(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        condition_type: "",
        pricing: {
          consultation: 0,
          monthly_therapy: { min: 0, max: 0 },
          lifestyle_coaching: 0,
          follow_up: 0,
        },
        is_active: true,
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTreatment(null);
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function handleNameChange(name: string) {
    setFormData({
      ...formData,
      name,
      slug: editingTreatment ? formData.slug : generateSlug(name),
    });
  }

  async function saveTreatment() {
    setSaving(true);
    try {
      const url = "/api/treatments";
      const method = editingTreatment ? "PATCH" : "POST";
      const body = editingTreatment
        ? {
            id: editingTreatment.id,
            ...formData,
          }
        : {
            ...formData,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchTreatments();
        closeModal();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save treatment");
      }
    } catch (error) {
      console.error("Failed to save treatment:", error);
      alert("Failed to save treatment");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTreatment(id: string) {
    if (!confirm("Are you sure you want to delete this treatment?")) return;

    try {
      const response = await fetch(`/api/treatments?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTreatments();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete treatment");
      }
    } catch (error) {
      console.error("Failed to delete treatment:", error);
      alert("Failed to delete treatment");
    }
  }

  const filteredTreatments = treatments.filter((treatment) => {
    const matchesSearch =
      treatment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treatments</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Treatment
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search treatments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "active" | "inactive")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Treatments</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTreatments.map((treatment) => (
          <div
            key={treatment.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  {treatment.name}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {treatment.condition_type}
                </span>
              </div>
              {treatment.is_active ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
              {treatment.description}
            </p>
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Consultation:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₵{treatment.pricing.consultation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Monthly Therapy:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₵{treatment.pricing.monthly_therapy.min} - ₵{treatment.pricing.monthly_therapy.max}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openModal(treatment)}
                className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => deleteTreatment(treatment.id)}
                className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 flex items-center justify-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {editingTreatment ? "Edit Treatment" : "Add Treatment"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Condition Type *
                  </label>
                  <input
                    type="text"
                    value={formData.condition_type}
                    onChange={(e) => setFormData({ ...formData, condition_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Pricing *</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Consultation (₵)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.consultation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              consultation: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Lifestyle Coaching (₵)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.lifestyle_coaching}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              lifestyle_coaching: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Monthly Therapy Min (₵)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.monthly_therapy.min}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              monthly_therapy: {
                                ...formData.pricing.monthly_therapy,
                                min: parseFloat(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Monthly Therapy Max (₵)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.monthly_therapy.max}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              monthly_therapy: {
                                ...formData.pricing.monthly_therapy,
                                max: parseFloat(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Follow-up (₵)
                      </label>
                      <input
                        type="number"
                        value={formData.pricing.follow_up}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricing: {
                              ...formData.pricing,
                              follow_up: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={saveTreatment}
                  disabled={
                    saving ||
                    !formData.name ||
                    !formData.slug ||
                    !formData.description ||
                    !formData.condition_type
                  }
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
