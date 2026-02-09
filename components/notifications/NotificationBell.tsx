"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";
import Link from "next/link";

type NotificationItem = {
  id: string;
  subject: string;
  preview: string;
  created_at?: string;
  is_read?: boolean;
  appointment_id?: string | null;
};

export function NotificationBell() {
  const supabase = createClient();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // Load latest inbox messages (as notifications)
      const res = await fetch("/api/messages?type=inbox&limit=10");
      if (res.ok) {
        const data = await res.json();
        const mapped =
          data.messages?.map((m: any) => ({
            id: m.id,
            subject: m.subject,
            preview: m.content?.slice(0, 80) || "",
            created_at: m.created_at,
            is_read: m.is_read,
            appointment_id: m.appointment_id,
          })) || [];
        setNotifications(mapped);
      }

      // Subscribe to new messages for this user
      supabase
        .channel("messages-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as any;
            if (row.recipient_id === user.id) {
              const newItem: NotificationItem = {
                id: row.id,
                subject: row.subject,
                preview: row.content?.slice(0, 80) || "",
                created_at: row.created_at,
                is_read: row.is_read,
                appointment_id: row.appointment_id,
              };

              setNotifications((prev) => [newItem, ...prev].slice(0, 15));

              toast({
                title: "New message",
                description: row.subject || "You have a new message.",
                variant: "success",
              });
            }
          }
        )
        .subscribe();

      setLoading(false);
    }

    bootstrap();

    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  if (loading) {
    return (
      <div className="p-2 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!userId) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Notifications
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Messages directed to you
              </p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.length === 0 && (
              <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                No notifications yet.
              </div>
            )}

            {notifications.map((item) => (
              <Link
                key={item.id}
                href={item.appointment_id ? `/appointments/${item.appointment_id}` : "/messages"}
                className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {item.subject || "New message"}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  {item.preview || "You have a new message."}
                </p>
                {item.created_at && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
