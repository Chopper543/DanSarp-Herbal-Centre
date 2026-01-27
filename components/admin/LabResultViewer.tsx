"use client";

import { LabResult } from "@/types";
import { Download, FileText, Calendar, User, AlertCircle, CheckCircle } from "lucide-react";

interface LabResultViewerProps {
  labResult: LabResult;
  onEdit?: () => void;
  onPrint?: () => void;
}

export function LabResultViewer({ labResult, onEdit, onPrint }: LabResultViewerProps) {
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
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "reviewed":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            {labResult.test_name}
          </h2>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Ordered: {new Date(labResult.ordered_date).toLocaleDateString()}
            </span>
            {labResult.completed_date && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Completed: {new Date(labResult.completed_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(
              labResult.status
            )}`}
          >
            {getStatusIcon(labResult.status)}
            {labResult.status.replace("_", " ").toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Test Type</h3>
          <p className="text-gray-900 dark:text-white">
            {labResult.test_type || "Not specified"}
          </p>
        </div>
        {labResult.units && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Units</h3>
            <p className="text-gray-900 dark:text-white">{labResult.units}</p>
          </div>
        )}
        {labResult.normal_range && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Normal Range
            </h3>
            <p className="text-gray-900 dark:text-white">{labResult.normal_range}</p>
          </div>
        )}
      </div>

      {Object.keys(labResult.results).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Test Results
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Test Parameter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Result
                  </th>
                  {labResult.normal_range && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Normal Range
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(labResult.results).map(([key, value]) => (
                  <tr key={key}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {key}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {String(value)}
                    </td>
                    {labResult.normal_range && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {labResult.normal_range}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {labResult.file_urls && labResult.file_urls.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attachments</h3>
          <div className="space-y-2">
            {labResult.file_urls.map((url, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{url}</span>
                </div>
                <button
                  onClick={() => window.open(url, "_blank")}
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {labResult.notes && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Notes</h3>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {labResult.notes}
          </p>
        </div>
      )}

      {labResult.doctor_notes && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Doctor Notes (Internal)
          </h3>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {labResult.doctor_notes}
          </p>
        </div>
      )}

      {(onEdit || onPrint) && (
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onPrint && (
            <button
              onClick={onPrint}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Print
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
