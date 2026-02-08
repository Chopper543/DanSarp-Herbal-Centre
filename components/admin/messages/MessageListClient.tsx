"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Mail,
  Calendar,
  Eye,
  MessageSquare,
  Plus,
  CheckCircle,
  XCircle,
  User,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type UserSummary = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

type MessageItem = {
  id: string;
  sender_id: string;
  recipient_id: string;
  appointment_id: string | null;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: { id: string; email: string; full_name: string | null };
  recipient?: { id: string; email: string; full_name: string | null };
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function MessageListClient({
  initialMessages,
  initialPage,
  initialTotalPages,
  initialUnreadOnly,
  usersPageData,
}: {
  initialMessages: MessageItem[];
  initialPage: number;
  initialTotalPages: number;
  initialUnreadOnly: boolean;
  usersPageData: { users: UserSummary[]; page: number; totalPages: number };
}) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [filterUnread, setFilterUnread] = useState(initialUnreadOnly);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [users, setUsers] = useState<UserSummary[]>(usersPageData.users);
  const [userPage, setUserPage] = useState(usersPageData.page);
  const [userTotalPages, setUserTotalPages] = useState(usersPageData.totalPages);
  const [composeForm, setComposeForm] = useState({
    recipient_id: "",
    subject: "",
    content: "",
  });
  const composeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const composeDialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const closeCompose = () => {
    setShowCompose(false);
    setComposeForm({ recipient_id: "", subject: "", content: "" });
    setRecipientFilter("");
    requestAnimationFrame(() => composeTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (showCompose) {
      firstFieldRef.current?.focus();
    }
  }, [showCompose]);

  const filteredRecipients = useMemo(() => {
    if (!recipientFilter.trim()) return users;
    const q = recipientFilter.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || "no name").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [recipientFilter, users]);

  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery) return filterUnread ? !msg.is_read : true;
    const query = searchQuery.toLowerCase();
    const match =
      msg.subject.toLowerCase().includes(query) ||
      msg.content.toLowerCase().includes(query) ||
      msg.sender?.email.toLowerCase().includes(query) ||
      msg.recipient?.email.toLowerCase().includes(query) ||
      msg.sender?.full_name?.toLowerCase().includes(query) ||
      msg.recipient?.full_name?.toLowerCase().includes(query);
    return filterUnread ? match && !msg.is_read : match;
  });

  const fetchMessagesPage = async (nextPage: number, unread = filterUnread) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("limit", "20");
    if (unread) params.set("unread_only", "true");
    const res = await fetch(`/api/messages?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setPage(nextPage);
    setSelectedMessage(null);
  };

  const toggleUnreadFilter = async () => {
    const next = !filterUnread;
    setFilterUnread(next);
    await fetchMessagesPage(1, next);
  };

  const fetchUsersPage = async (nextPage: number) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?page=${nextPage}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
      setUserTotalPages(data.pagination?.totalPages || 1);
      setUserPage(nextPage);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.recipient_id || !composeForm.subject || !composeForm.content) {
      setToast({ type: "error", message: "Recipient, subject, and message are required." });
      return;
    }
    setSending(true);
    setToast(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: composeForm.recipient_id,
          subject: composeForm.subject,
          content: composeForm.content,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ type: "error", message: data.error || "Failed to send message" });
        return;
      }
      closeCompose();
      setToast({ type: "success", message: "Message sent successfully" });
      await fetchMessagesPage(page, filterUnread);
    } catch (error: any) {
      setToast({ type: "error", message: error.message || "Failed to send message" });
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, is_read: true }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
      );
      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, is_read: true });
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  return (
    <main className="min-h-screen" role="main">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Messages Management</h1>
        <button
          onClick={() => setShowCompose(true)}
          ref={composeTriggerRef}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Messages</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{messages.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Unread (filtered)</h3>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {messages.filter((m) => !m.is_read).length}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by subject, content, sender, or recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={toggleUnreadFilter}
            className={`px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              filterUnread
                ? "bg-yellow-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
            aria-pressed={filterUnread}
          >
            {filterUnread ? "Show All" : "Unread Only"}
          </button>
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" aria-live="polite">
        {filteredMessages.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || filterUnread
                ? "No messages match your search criteria."
                : "No messages found."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    From / To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Content Preview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMessages.map((message) => (
                  <tr key={message.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {message.sender?.full_name || message.sender?.email || "Unknown"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          to {message.recipient?.full_name || message.recipient?.email || "Unknown"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{message.subject}</div>
                      {message.appointment_id && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Related to appointment
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-md">
                        {message.content}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {message.is_read ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1 w-fit">
                          <Eye className="w-3 h-3" />
                          Read
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1 w-fit">
                          <Mail className="w-3 h-3" />
                          Unread
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(message.created_at).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Messages Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <button
          onClick={() => fetchMessagesPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => fetchMessagesPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-compose-heading"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeCompose();
            }
            if (e.key === "Tab" && composeDialogRef.current) {
              const focusable = composeDialogRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              );
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <div
            ref={composeDialogRef}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="admin-compose-heading" className="text-2xl font-bold text-gray-900 dark:text-white">
                Compose Message
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                onClick={closeCompose}
              >
                ✕
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSendMessage}>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Recipient
                </label>
                <input
                  type="text"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  placeholder="Search name, email, or role"
                className="w-full mb-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  ref={firstFieldRef}
                />
                <select
                  value={composeForm.recipient_id}
                  onChange={(e) => setComposeForm({ ...composeForm, recipient_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={loadingUsers}
                >
                  <option value="" disabled>
                    {loadingUsers ? "Loading recipients..." : "Select a recipient"}
                  </option>
                  {filteredRecipients.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || "No name"} — {u.email} ({u.role})
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <button
                    type="button"
                    onClick={() => fetchUsersPage(Math.max(1, userPage - 1))}
                    disabled={userPage === 1}
                    className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Prev
                  </button>
                  <span>
                    Recipients page {userPage} of {userTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchUsersPage(Math.min(userTotalPages, userPage + 1))}
                    disabled={userPage >= userTotalPages}
                    className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  value={composeForm.content}
                  onChange={(e) => setComposeForm({ ...composeForm, content: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={6}
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeCompose}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || loadingUsers}
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-800"
              : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200 border border-red-200 dark:border-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4" aria-hidden />
          ) : (
            <XCircle className="w-4 h-4" aria-hidden />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-xs underline text-current focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
          >
            Dismiss
          </button>
        </div>
      )}
    </main>
  );
}
