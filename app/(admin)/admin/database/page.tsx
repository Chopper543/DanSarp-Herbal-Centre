"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isSuperAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { Database, Table, Eye, AlertCircle } from "lucide-react";

export default function DatabaseToolsPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const role = await getUserRole();
      setUserRole(role);

      if (!isSuperAdmin(role)) {
        router.push("/admin");
        return;
      }

      fetchTables();
    }

    checkAuth();
  }, []);

  async function fetchTables() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/database?action=tables");
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTableData(tableName: string, offset = 0) {
    setDataLoading(true);
    try {
      const response = await fetch(
        `/api/admin/database?action=data&table=${tableName}&limit=100&offset=${offset}`
      );
      if (response.ok) {
        const data = await response.json();
        setTableData(data.data || []);
        setTotalRows(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch table data:", error);
    } finally {
      setDataLoading(false);
    }
  }

  function handleTableSelect(tableName: string) {
    setSelectedTable(tableName);
    fetchTableData(tableName);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!userRole || !isSuperAdmin(userRole)) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Database className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Database Tools
        </h1>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Read-Only Access
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              This tool provides read-only access to database tables. Direct SQL
              queries are not available for security reasons.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Table className="w-5 h-5" />
              Tables
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => handleTableSelect(table.name)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedTable === table.name
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                      : "bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{table.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {table.rowCount !== null
                        ? table.rowCount.toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Data */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {selectedTable || "Select a table"}
              </h2>
              {selectedTable && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {totalRows} total rows
                </span>
              )}
            </div>
          </div>
          <div className="p-6">
            {!selectedTable ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  Select a table from the list to view its data
                </p>
              </div>
            ) : dataLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : tableData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No data found in this table
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {Object.keys(tableData[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {tableData.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-4 py-3 text-sm text-gray-900 dark:text-white"
                          >
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value || "N/A")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalRows > 100 && (
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Showing first 100 rows of {totalRows} total rows
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
