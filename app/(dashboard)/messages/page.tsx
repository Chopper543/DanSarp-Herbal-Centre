"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Plus, Mail, MailOpen, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function MessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [type, setType] = useState<"inbox" | "sent">("inbox");
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const composeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const composeDialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const closeCompose = () => {
    setShowCompose(false);
    setComposeForm({ department: "care_team", subject: "", content: "", appointment_id: "" });
    requestAnimationFrame(() => {
      composeTriggerRef.current?.focus();
    });
  };

  useEffect(() => {
    if (showCompose) {
      firstFieldRef.current?.focus();
    }
  }, [showCompose]);

  const [composeForm, setComposeForm] = useState({
    department: "care_team",
    subject: "",
    content: "",
    appointment_id: "",
  });

  useEffect(() => {
    fetchMessages(page);
  }, [type, page]);

  async function fetchMessages(nextPage = 1) {
    try {
      const response = await fetch(`/api/messages?type=${type}&page=${nextPage}&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setToast(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: composeForm.department,
          subject: composeForm.subject,
          content: composeForm.content,
          appointment_id: composeForm.appointment_id || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setToast({ type: "error", message: data.error || "Failed to send message" });
        setSending(false);
        return;
      }

      setShowCompose(false);
      setComposeForm({ department: "care_team", subject: "", content: "", appointment_id: "" });
      setToast({ type: "success", message: "Message sent successfully" });
      fetchMessages();
      requestAnimationFrame(() => composeTriggerRef.current?.focus());
    } catch (error: any) {
      setToast({ type: "error", message: error.message || "An error occurred while sending the message" });
    } finally {
      setSending(false);
    }
  }

  async function handleMarkAsRead(messageId: string) {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, is_read: true }),
      });
      fetchMessages();
      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, is_read: true });
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8" role="main">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <button
            onClick={() => setShowCompose(true)}
            ref={composeTriggerRef}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>
        </div>

        {/* Compose Modal */}
        {showCompose && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-compose-heading"
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
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6"
            >
              <h2 id="patient-compose-heading" className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Compose Message
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Patients can message staff only. Choose a department to reach the right team.
              </p>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" htmlFor="compose-department">
                    Department
                  </label>
                  <select
                    id="compose-department"
                    ref={firstFieldRef}
                    value={composeForm.department}
                    onChange={(e) =>
                      setComposeForm({ ...composeForm, department: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="care_team">Care Team</option>
                    <option value="billing">Billing</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={composeForm.subject}
                    onChange={(e) =>
                      setComposeForm({ ...composeForm, subject: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    value={composeForm.content}
                    onChange={(e) =>
                      setComposeForm({ ...composeForm, content: e.target.value })
                    }
                    required
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-950 text-white rounded-lg disabled:opacity-50"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={closeCompose}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Cancel
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

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              setType("inbox");
              setPage(1);
              setSelectedMessage(null);
            }}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              type === "inbox"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-600 dark:text-gray-400"
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => {
              setType("sent");
              setPage(1);
              setSelectedMessage(null);
            }}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              type === "sent"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-600 dark:text-gray-400"
            }`}
          >
            Sent
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message List */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {type === "inbox" ? "Inbox" : "Sent Messages"}
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No messages
                </div>
              ) : (
                messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => {
                      setSelectedMessage(message);
                      if (!message.is_read && type === "inbox") {
                        handleMarkAsRead(message.id);
                      }
                    }}
                    className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedMessage?.id === message.id
                        ? "bg-primary-50 dark:bg-primary-900/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {type === "inbox"
                          ? message.sender?.full_name || message.sender?.email || "Unknown"
                          : message.recipient?.full_name || message.recipient?.email || "Unknown"}
                      </p>
                      {!message.is_read && type === "inbox" && (
                        <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {message.subject}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {message.content}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {format(new Date(message.created_at), "MMM d, yyyy")}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
            {selectedMessage ? (
              <div>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedMessage.subject}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(selectedMessage.created_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  {type === "inbox" && !selectedMessage.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(selectedMessage.id)}
                      className="flex items-center gap-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg text-sm"
                    >
                      <MailOpen className="w-4 h-4" />
                      Mark as Read
                    </button>
                  )}
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedMessage.content}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a message to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
