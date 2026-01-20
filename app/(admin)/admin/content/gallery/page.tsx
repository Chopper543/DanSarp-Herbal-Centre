"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/auth/rbac-client";
import { UserRole, GalleryItemType } from "@/types";
import { Plus, Edit, Trash2, Image as ImageIcon, Search, Filter, Star } from "lucide-react";

interface GalleryItem {
  id: string;
  type: GalleryItemType;
  title: string;
  description: string | null;
  image_urls: string[];
  video_url: string | null;
  metadata: Record<string, any>;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminGalleryPage() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filter, setFilter] = useState<"all" | GalleryItemType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [formData, setFormData] = useState({
    type: "doctor" as GalleryItemType,
    title: "",
    description: "",
    image_urls: [] as string[],
    video_url: "",
    is_featured: false,
  });
  const [saving, setSaving] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const role = await getUserRole();
      setUserRole(role);

      if (!isAdmin(role)) {
        router.push("/admin");
        return;
      }

      fetchItems();
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (userRole && isAdmin(userRole)) {
      fetchItems();
    }
  }, [filter]);

  async function fetchItems() {
    setLoading(true);
    try {
      const url = filter !== "all" ? `/api/gallery?type=${filter}` : "/api/gallery";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch gallery items:", error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(item?: GalleryItem) {
    if (item) {
      setEditingItem(item);
      setFormData({
        type: item.type,
        title: item.title,
        description: item.description || "",
        image_urls: item.image_urls || [],
        video_url: item.video_url || "",
        is_featured: item.is_featured,
      });
    } else {
      setEditingItem(null);
      setFormData({
        type: "doctor",
        title: "",
        description: "",
        image_urls: [],
        video_url: "",
        is_featured: false,
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingItem(null);
    setNewImageUrl("");
  }

  function addImageUrl() {
    if (newImageUrl.trim()) {
      setFormData({
        ...formData,
        image_urls: [...formData.image_urls, newImageUrl.trim()],
      });
      setNewImageUrl("");
    }
  }

  function removeImageUrl(index: number) {
    setFormData({
      ...formData,
      image_urls: formData.image_urls.filter((_, i) => i !== index),
    });
  }

  async function saveItem() {
    setSaving(true);
    try {
      const url = editingItem ? "/api/gallery" : "/api/gallery";
      const method = editingItem ? "PATCH" : "POST";
      const body = editingItem
        ? {
            id: editingItem.id,
            ...formData,
            image_urls: formData.image_urls,
            video_url: formData.video_url || null,
            description: formData.description || null,
          }
        : {
            ...formData,
            image_urls: formData.image_urls,
            video_url: formData.video_url || null,
            description: formData.description || null,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchItems();
        closeModal();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save item");
      }
    } catch (error) {
      console.error("Failed to save item:", error);
      alert("Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const response = await fetch(`/api/gallery?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchItems();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete item");
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item");
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gallery Items</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | GalleryItemType)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="doctor">Doctor</option>
              <option value="event">Event</option>
              <option value="clinic">Clinic</option>
              <option value="achievement">Achievement</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
          >
            {item.image_urls && item.image_urls.length > 0 && (
              <img
                src={item.image_urls[0]}
                alt={item.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {item.type}
                  </span>
                </div>
                {item.is_featured && (
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => openModal(item)}
                  className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
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
                {editingItem ? "Edit Gallery Item" : "Add Gallery Item"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as GalleryItemType })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="event">Event</option>
                    <option value="clinic">Clinic</option>
                    <option value="achievement">Achievement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Image URLs
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Enter image URL"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.image_urls.map((url, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={url}
                          readOnly
                          className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeImageUrl(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Video URL
                  </label>
                  <input
                    type="text"
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_featured" className="text-sm text-gray-700 dark:text-gray-300">
                    Featured Item
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={saveItem}
                  disabled={saving || !formData.title}
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
