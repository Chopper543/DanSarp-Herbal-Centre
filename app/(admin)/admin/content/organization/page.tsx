"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin } from "@/lib/auth/rbac-client";
import { UserRole, OrganizationProfile } from "@/types";
import { Save, Plus, Trash2, Building2 } from "lucide-react";

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image_url: string;
}

interface Certification {
  name: string;
  issuer: string;
  issue_date: string;
  image_url: string;
}

export default function AdminOrganizationPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    mission: "",
    vision: "",
    values: "",
    team_members: [] as TeamMember[],
    certifications: [] as Certification[],
  });
  const [newTeamMember, setNewTeamMember] = useState<TeamMember>({
    name: "",
    role: "",
    bio: "",
    image_url: "",
  });
  const [newCertification, setNewCertification] = useState<Certification>({
    name: "",
    issuer: "",
    issue_date: "",
    image_url: "",
  });
  const [showTeamMemberForm, setShowTeamMemberForm] = useState(false);
  const [showCertificationForm, setShowCertificationForm] = useState(false);
  const [editingTeamMemberIndex, setEditingTeamMemberIndex] = useState<number | null>(null);
  const [editingCertificationIndex, setEditingCertificationIndex] = useState<number | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const role = await getUserRole();
      setUserRole(role);

      if (!isAdmin(role)) {
        router.push("/admin");
        return;
      }

      fetchProfile();
    }

    checkAuth();
  }, [router]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const response = await fetch("/api/organization");
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          setProfile(data.profile);
          setFormData({
            mission: data.profile.mission || "",
            vision: data.profile.vision || "",
            values: data.profile.values || "",
            team_members: (data.profile.team_members || []) as TeamMember[],
            certifications: (data.profile.certifications || []) as Certification[],
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch organization profile:", error);
    } finally {
      setLoading(false);
    }
  }

  function addTeamMember() {
    if (editingTeamMemberIndex !== null) {
      const updated = [...formData.team_members];
      updated[editingTeamMemberIndex] = newTeamMember;
      setFormData({ ...formData, team_members: updated });
      setEditingTeamMemberIndex(null);
    } else {
      setFormData({
        ...formData,
        team_members: [...formData.team_members, newTeamMember],
      });
    }
    setNewTeamMember({ name: "", role: "", bio: "", image_url: "" });
    setShowTeamMemberForm(false);
  }

  function editTeamMember(index: number) {
    setNewTeamMember(formData.team_members[index]);
    setEditingTeamMemberIndex(index);
    setShowTeamMemberForm(true);
  }

  function removeTeamMember(index: number) {
    setFormData({
      ...formData,
      team_members: formData.team_members.filter((_, i) => i !== index),
    });
  }

  function addCertification() {
    if (editingCertificationIndex !== null) {
      const updated = [...formData.certifications];
      updated[editingCertificationIndex] = newCertification;
      setFormData({ ...formData, certifications: updated });
      setEditingCertificationIndex(null);
    } else {
      setFormData({
        ...formData,
        certifications: [...formData.certifications, newCertification],
      });
    }
    setNewCertification({ name: "", issuer: "", issue_date: "", image_url: "" });
    setShowCertificationForm(false);
  }

  function editCertification(index: number) {
    setNewCertification(formData.certifications[index]);
    setEditingCertificationIndex(index);
    setShowCertificationForm(true);
  }

  function removeCertification(index: number) {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter((_, i) => i !== index),
    });
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const method = profile ? "PATCH" : "POST";
      const response = await fetch("/api/organization", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchProfile();
        alert("Organization profile saved successfully!");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to save profile");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Organization Profile
        </h1>
        <button
          onClick={saveProfile}
          disabled={saving || !formData.mission || !formData.vision || !formData.values}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Mission</h2>
          <textarea
            value={formData.mission}
            onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter organization mission..."
            required
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Vision</h2>
          <textarea
            value={formData.vision}
            onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter organization vision..."
            required
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Values</h2>
          <textarea
            value={formData.values}
            onChange={(e) => setFormData({ ...formData, values: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter organization values..."
            required
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Team Members</h2>
            <button
              onClick={() => {
                setNewTeamMember({ name: "", role: "", bio: "", image_url: "" });
                setEditingTeamMemberIndex(null);
                setShowTeamMemberForm(!showTeamMemberForm);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Member
            </button>
          </div>

          {showTeamMemberForm && (
            <div className="mb-6 p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                {editingTeamMemberIndex !== null ? "Edit Team Member" : "New Team Member"}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={newTeamMember.name}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, name: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Role"
                  value={newTeamMember.role}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={newTeamMember.image_url}
                  onChange={(e) =>
                    setNewTeamMember({ ...newTeamMember, image_url: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <textarea
                  placeholder="Bio"
                  value={newTeamMember.bio}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, bio: e.target.value })}
                  rows={2}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={addTeamMember}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingTeamMemberIndex !== null ? "Update" : "Add"}
                </button>
                <button
                  onClick={() => {
                    setShowTeamMemberForm(false);
                    setEditingTeamMemberIndex(null);
                    setNewTeamMember({ name: "", role: "", bio: "", image_url: "" });
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formData.team_members.map((member, index) => (
              <div
                key={index}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
              >
                {member.image_url && (
                  <img
                    src={member.image_url}
                    alt={member.name}
                    className="w-full h-32 object-cover rounded-lg mb-2"
                  />
                )}
                <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{member.role}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                  {member.bio}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => editTeamMember(index)}
                    className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeTeamMember(index)}
                    className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Certifications
            </h2>
            <button
              onClick={() => {
                setNewCertification({ name: "", issuer: "", issue_date: "", image_url: "" });
                setEditingCertificationIndex(null);
                setShowCertificationForm(!showCertificationForm);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Certification
            </button>
          </div>

          {showCertificationForm && (
            <div className="mb-6 p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                {editingCertificationIndex !== null ? "Edit Certification" : "New Certification"}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={newCertification.name}
                  onChange={(e) =>
                    setNewCertification({ ...newCertification, name: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Issuer"
                  value={newCertification.issuer}
                  onChange={(e) =>
                    setNewCertification({ ...newCertification, issuer: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="date"
                  placeholder="Issue Date"
                  value={newCertification.issue_date}
                  onChange={(e) =>
                    setNewCertification({ ...newCertification, issue_date: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={newCertification.image_url}
                  onChange={(e) =>
                    setNewCertification({ ...newCertification, image_url: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={addCertification}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingCertificationIndex !== null ? "Update" : "Add"}
                </button>
                <button
                  onClick={() => {
                    setShowCertificationForm(false);
                    setEditingCertificationIndex(null);
                    setNewCertification({ name: "", issuer: "", issue_date: "", image_url: "" });
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formData.certifications.map((cert, index) => (
              <div
                key={index}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
              >
                {cert.image_url && (
                  <img
                    src={cert.image_url}
                    alt={cert.name}
                    className="w-full h-32 object-cover rounded-lg mb-2"
                  />
                )}
                <h3 className="font-semibold text-gray-900 dark:text-white">{cert.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{cert.issuer}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(cert.issue_date).toLocaleDateString()}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => editCertification(index)}
                    className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeCertification(index)}
                    className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
