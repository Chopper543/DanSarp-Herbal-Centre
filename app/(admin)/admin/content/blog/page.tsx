"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { Plus, Edit, Trash2, FileText, Search, Filter, Eye, EyeOff } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_id: string;
  featured_image_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    featured_image_url: "",
    status: "draft" as "draft" | "published",
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

      fetchPosts();
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (userRole && isAdmin(userRole)) {
      fetchPosts();
    }
  }, [filter]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const url =
        filter !== "all"
          ? `/api/blog?status=${filter}&include_drafts=true`
          : "/api/blog?include_drafts=true";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error("Failed to fetch blog posts:", error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(post?: BlogPost) {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        featured_image_url: post.featured_image_url || "",
        status: post.status,
      });
    } else {
      setEditingPost(null);
      setFormData({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        featured_image_url: "",
        status: "draft",
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingPost(null);
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function handleTitleChange(title: string) {
    setFormData({
      ...formData,
      title,
      slug: editingPost ? formData.slug : generateSlug(title),
    });
  }

  async function savePost() {
    setSaving(true);
    try {
      const url = "/api/blog";
      const method = editingPost ? "PATCH" : "POST";
      const body = editingPost
        ? {
            id: editingPost.id,
            ...formData,
            featured_image_url: formData.featured_image_url || null,
          }
        : {
            ...formData,
            featured_image_url: formData.featured_image_url || null,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchPosts();
        closeModal();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save post");
      }
    } catch (error) {
      console.error("Failed to save post:", error);
      alert("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`/api/blog?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPosts();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete post");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post");
    }
  }

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Blog Posts</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Post
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "draft" | "published")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Posts</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-start gap-4"
          >
            {post.featured_image_url && (
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-32 h-32 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {post.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        post.status === "published"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {post.status}
                    </span>
                    {post.status === "published" ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                {post.excerpt}
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span>Slug: {post.slug}</span>
                {post.published_at && (
                  <span className="ml-4">
                    Published: {new Date(post.published_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal(post)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => deletePost(post.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 flex items-center gap-1"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {editingPost ? "Edit Blog Post" : "New Blog Post"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
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
                    Excerpt *
                  </label>
                  <textarea
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Content * (Markdown supported)
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={10}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Featured Image URL
                  </label>
                  <input
                    type="text"
                    value={formData.featured_image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, featured_image_url: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as "draft" | "published" })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={savePost}
                  disabled={saving || !formData.title || !formData.slug || !formData.excerpt || !formData.content}
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
