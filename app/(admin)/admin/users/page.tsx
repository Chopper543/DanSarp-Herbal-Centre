"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserRole } from "@/lib/auth/rbac-client";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { UserRole } from "@/types";
import { Shield } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    async function init() {
      const role = await getUserRole();
      setUserRole(role);
      if (!canAccessSection(role, "users")) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
      setLoading(false);
    }
    init();
  }, []);

  const updateRole = async (id: string, newRole: string) => {
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, newRole }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: data.user.role } : u)));
    } else {
      const err = await res.json();
      alert(err.error || "Failed to update role");
    }
  };

  if (loading) {
    return <div>Loading users...</div>;
  }

  if (!userRole || !canAccessSection(userRole, "users")) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center">
        <Shield className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Access restricted
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You do not have permission to view or manage users. Contact an Admin or Super Admin if you need access.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
        >
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        User Management
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Role
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
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {user.full_name || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="content_manager">Content Manager</option>
                    <option value="appointment_manager">Appointment Manager</option>
                    <option value="finance_manager">Finance Manager</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
