"use client";

import { useEffect, useState } from "react";
import { ClinicalNote } from "@/types";
import { SOAPNoteEditor } from "@/components/admin/SOAPNoteEditor";
import { ClinicalNotesList } from "@/components/admin/ClinicalNotesList";
import { Plus } from "lucide-react";

export default function AdminClinicalNotesPage() {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async (search?: string, filters?: any) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filters?.patient_id) params.append("patient_id", filters.patient_id);
      if (filters?.doctor_id) params.append("doctor_id", filters.doctor_id);
      if (filters?.note_type) params.append("note_type", filters.note_type);
      if (filters?.date_from) params.append("date_from", filters.date_from);
      if (filters?.date_to) params.append("date_to", filters.date_to);

      const url = `/api/clinical-notes${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setNotes(data.notes || []);
      } else {
        setError(data.error || "Failed to fetch clinical notes");
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
      const url = "/api/clinical-notes";
      const method = editingNote ? "PUT" : "POST";
      const body = editingNote ? { id: editingNote.id, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchNotes();
        setShowForm(false);
        setEditingNote(null);
      } else {
        setError(data.error || "Failed to save clinical note");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this clinical note?")) {
      return;
    }

    try {
      const response = await fetch(`/api/clinical-notes/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchNotes();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete clinical note");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    fetchNotes(query);
  };

  const handleFilter = (filters: any) => {
    fetchNotes(searchQuery, filters);
  };

  if (loading && notes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading clinical notes...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clinical Notes Management</h1>
        <button
          onClick={() => {
            setEditingNote(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Clinical Note
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <SOAPNoteEditor
            note={editingNote || undefined}
            patientId={editingNote?.patient_id}
            appointmentId={editingNote?.appointment_id || undefined}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingNote(null);
            }}
          />
        </div>
      )}

      <ClinicalNotesList
        notes={notes}
        onEdit={(note) => {
          setEditingNote(note);
          setShowForm(true);
        }}
        onDelete={handleDelete}
        onSearch={handleSearch}
        onFilter={handleFilter}
        loading={loading}
      />
    </div>
  );
}
