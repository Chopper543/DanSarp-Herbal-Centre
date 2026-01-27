"use client";

import { useEffect, useState } from "react";
import { ClinicalNote } from "@/types";
import { ClinicalNoteSummary } from "@/components/dashboard/ClinicalNoteSummary";
import { Search, Calendar } from "lucide-react";

export default function PatientClinicalNotesPage() {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/clinical-notes");
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

  const filteredNotes = notes.filter((note) => {
    if (searchTerm === "") return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      note.subjective?.toLowerCase().includes(searchLower) ||
      note.objective?.toLowerCase().includes(searchLower) ||
      note.assessment?.toLowerCase().includes(searchLower) ||
      note.plan?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading clinical notes...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Clinical Notes</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your medical notes and visit summaries from your appointments
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No clinical notes found</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredNotes.map((note) => (
            <ClinicalNoteSummary key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
