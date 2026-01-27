"use client";

import Link from "next/link";
import { ClinicalNote } from "@/types";
import { Calendar, FileText, ArrowRight } from "lucide-react";

interface ClinicalNoteSummaryProps {
  note: ClinicalNote;
}

function noteTypeLabel(type: ClinicalNote["note_type"]) {
  switch (type) {
    case "soap":
      return "SOAP Note";
    case "progress":
      return "Progress Note";
    case "general":
      return "General Note";
    default:
      return "Clinical Note";
  }
}

export function ClinicalNoteSummary({ note }: ClinicalNoteSummaryProps) {
  const preview =
    note.subjective?.trim() ||
    note.assessment?.trim() ||
    note.plan?.trim() ||
    note.objective?.trim() ||
    "";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {noteTypeLabel(note.note_type)}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(note.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Note #{note.id.substring(0, 8)}
            </span>
          </div>
        </div>

        <Link
          href={`/clinical-notes/${note.id}`}
          className="shrink-0 inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
        >
          View
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {preview && (
        <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap line-clamp-3">
          {preview}
        </p>
      )}

      {note.attachments && note.attachments.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Attachments: {note.attachments.length}
        </div>
      )}
    </div>
  );
}

