"use client";

import { LabResult } from "@/types";
import { Calendar, FileText, Download, Eye } from "lucide-react";
import Link from "next/link";

interface LabResultCardProps {
  labResult: LabResult;
}

export function LabResultCard({ labResult }: LabResultCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "reviewed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "pending":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {labResult.test_name}
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(labResult.ordered_date).toLocaleDateString()}
            </span>
            {labResult.test_type && (
              <span className="capitalize">{labResult.test_type}</span>
            )}
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            labResult.status
          )}`}
        >
          {labResult.status.replace("_", " ").toUpperCase()}
        </span>
      </div>

      {labResult.completed_date && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Completed: {new Date(labResult.completed_date).toLocaleDateString()}
        </div>
      )}

      {Object.keys(labResult.results).length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Key Results:</p>
          <div className="space-y-1">
            {Object.entries(labResult.results)
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{key}:</span> {String(value)}
                  {labResult.units && ` ${labResult.units}`}
                </div>
              ))}
            {Object.keys(labResult.results).length > 3 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                +{Object.keys(labResult.results).length - 3} more results
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          {labResult.file_urls && labResult.file_urls.length > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {labResult.file_urls.length} file{labResult.file_urls.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {labResult.file_urls && labResult.file_urls.length > 0 && (
            <button
              onClick={() => window.open(labResult.file_urls[0], "_blank")}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
          <Link
            href={`/lab-results/${labResult.id}`}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 text-sm"
          >
            <Eye className="w-4 h-4" />
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
