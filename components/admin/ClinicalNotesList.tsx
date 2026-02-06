"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ClinicalNote, NoteType } from "@/types";
import { Search, Eye, Edit, Trash2, Filter } from "lucide-react";

interface ClinicalNotesListProps {
  notes: ClinicalNote[];
  loading?: boolean;
  onEdit: (note: ClinicalNote) => void;
  onDelete: (id: string) => void;
  onSearch: (query: string) => void;
  onFilter: (filters: {
    patient_id?: string;
    doctor_id?: string;
    note_type?: NoteType | "";
    date_from?: string;
    date_to?: string;
  }) => void;
}

function noteTypeLabel(type: ClinicalNote["note_type"]) {
  switch (type) {
    case "soap":
      return "SOAP";
    case "progress":
      return "Progress";
    case "general":
      return "General";
    default:
      return type;
  }
}

export function ClinicalNotesList({
  notes,
  loading,
  onEdit,
  onDelete,
  onSearch,
  onFilter,
}: ClinicalNotesListProps) {
  const [query, setQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [noteType, setNoteType] = useState<NoteType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const isInitialMount = useRef(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      // Skip redundant fetch on initial mount when query is empty (parent already fetches)
      if (isInitialMount.current && query === "") {
        isInitialMount.current = false;
        return;
      }
      if (query !== "") isInitialMount.current = false;
      onSearchRef.current?.(query.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const displayedNotes = useMemo(() => notes, [notes]);

  const applyFilters = () => {
    onFilter({
      patient_id: patientId.trim() || undefined,
      doctor_id: doctorId.trim() || undefined,
      note_type: noteType || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search notes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Patient ID..."
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as NoteType | "")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="soap">SOAP</option>
              <option value="progress">Progress</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-end justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <input
              type="text"
              placeholder="Doctor ID..."
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={applyFilters}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Note
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Doctor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading && displayedNotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
                  Loading clinical notes...
                </td>
              </tr>
            ) : displayedNotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
                  No clinical notes found
                </td>
              </tr>
            ) : (
              displayedNotes.map((note) => (
                <tr key={note.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {noteTypeLabel(note.note_type)} #{note.id.substring(0, 8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {note.patient_id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {note.doctor_id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(note.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/clinical-notes/${note.id}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(note)}
                        className="text-green-600 hover:text-green-800 dark:text-green-400"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(note.id)}
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
  );
}

