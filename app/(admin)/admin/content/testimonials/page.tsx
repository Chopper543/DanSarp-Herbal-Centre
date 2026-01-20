"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { Plus, Edit, Trash2, MessageSquare, Search, Filter, CheckCircle, XCircle, Image as ImageIcon, Video, Music } from "lucide-react";

interface Testimonial {
  id: string;
  patient_name: string | null;
  content: string;
  media_type: "image" | "audio" | "video";
  media_url: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminTestimonialsPage() {
  const router = useRouter();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [formData, setFormData] = useState({
    patient_name: "",
    content: "",
    media_type: "image" as "image" | "audio" | "video",
    media_url: "",
    is_approved: false,
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

      fetchTestimonials();
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (userRole && isAdmin(userRole)) {
      fetchTestimonials();
    }
  }, [filter]);

  async function fetchTestimonials() {
    setLoading(true);
    try {
      const url = filter === "approved" ? "/api/testimonials?approved=true" : "/api/testimonials?approved=false";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        let fetchedTestimonials = data.testimonials || [];
        if (filter === "pending") {
          fetchedTestimonials = fetchedTestimonials.filter((t: Testimonial) => !t.is_approved);
        } else if (filter === "approved") {
          fetchedTestimonials = fetchedTestimonials.filter((t: Testimonial) => t.is_approved);
        }
        setTestimonials(fetchedTestimonials);
      }
    } catch (error) {
      console.error("Failed to fetch testimonials:", error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(testimonial?: Testimonial) {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setFormData({
        patient_name: testimonial.patient_name || "",
        content: testimonial.content,
        media_type: testimonial.media_type,
        media_url: testimonial.media_url,
        is_approved: testimonial.is_approved,
      });
    } else {
      setEditingTestimonial(null);
      setFormData({
        patient_name: "",
        content: "",
        media_type: "image",
        media_url: "",
        is_approved: false,
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTestimonial(null);
  }

  async function saveTestimonial() {
    setSaving(true);
    try {
      const url = "/api/testimonials";
      const method = editingTestimonial ? "PATCH" : "POST";
      const body = editingTestimonial
        ? {
            id: editingTestimonial.id,
            ...formData,
            patient_name: formData.patient_name || null,
          }
        : {
            ...formData,
            patient_name: formData.patient_name || null,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchTestimonials();
        closeModal();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save testimonial");
      }
    } catch (error) {
      console.error("Failed to save testimonial:", error);
      alert("Failed to save testimonial");
    } finally {
      setSaving(false);
    }
  }

  async function updateApprovalStatus(id: string, isApproved: boolean) {
    try {
      const response = await fetch("/api/testimonials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          is_approved: isApproved,
        }),
      });

      if (response.ok) {
        await fetchTestimonials();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update approval status");
      }
    } catch (error) {
      console.error("Failed to update approval status:", error);
      alert("Failed to update approval status");
    }
  }

  async function deleteTestimonial(id: string) {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;

    try {
      const response = await fetch(`/api/testimonials?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTestimonials();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete testimonial");
      }
    } catch (error) {
      console.error("Failed to delete testimonial:", error);
      alert("Failed to delete testimonial");
    }
  }

  function getMediaIcon(type: "image" | "audio" | "video") {
    switch (type) {
      case "image":
        return <ImageIcon className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
      case "audio":
        return <Music className="w-5 h-5" />;
    }
  }

  const filteredTestimonials = testimonials.filter((testimonial) => {
    const matchesSearch =
      testimonial.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (testimonial.patient_name &&
        testimonial.patient_name.toLowerCase().includes(searchTerm.toLowerCase()));
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Testimonials</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Testimonial
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search testimonials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "approved" | "pending")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Testimonials</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTestimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
          >
            {testimonial.media_type === "image" && testimonial.media_url && (
              <img
                src={testimonial.media_url}
                alt={testimonial.patient_name || "Testimonial"}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getMediaIcon(testimonial.media_type)}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {testimonial.patient_name || "Anonymous"}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {testimonial.media_type}
                    </span>
                  </div>
                </div>
                {testimonial.is_approved ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                {testimonial.content}
              </p>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => updateApprovalStatus(testimonial.id, !testimonial.is_approved)}
                  className={`flex-1 px-3 py-1.5 rounded text-sm flex items-center justify-center gap-1 ${
                    testimonial.is_approved
                      ? "bg-yellow-600 text-white hover:bg-yellow-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {testimonial.is_approved ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      Unapprove
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </>
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal(testimonial)}
                  className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => deleteTestimonial(testimonial.id)}
                  className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {editingTestimonial ? "Edit Testimonial" : "Add Testimonial"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={formData.patient_name}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Media Type *
                  </label>
                  <select
                    value={formData.media_type}
                    onChange={(e) =>
                      setFormData({ ...formData, media_type: e.target.value as "image" | "audio" | "video" })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Media URL *
                  </label>
                  <input
                    type="text"
                    value={formData.media_url}
                    onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_approved"
                    checked={formData.is_approved}
                    onChange={(e) => setFormData({ ...formData, is_approved: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_approved" className="text-sm text-gray-700 dark:text-gray-300">
                    Approved
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={saveTestimonial}
                  disabled={saving || !formData.content || !formData.media_url}
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
