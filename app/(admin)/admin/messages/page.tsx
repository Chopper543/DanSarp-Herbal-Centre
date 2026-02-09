import MessageListClient from "@/components/admin/messages/MessageListClient";
import { requireAuth } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

async function fetchMessages(page: number, limit: number, unreadOnly: boolean) {
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  let query = supabase
    .from("messages")
    .select(
      `
      id,
      sender_id,
      recipient_id,
      appointment_id,
      subject,
      content,
      is_read,
      created_at,
      sender:users!messages_sender_id_fkey(id, full_name, email),
      recipient:users!messages_recipient_id_fkey(id, full_name, email)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, count } = await query;

  return {
    messages: data || [],
    page,
    totalPages: count ? Math.ceil(count / limit) : 1,
    unreadOnly,
  };
}

async function fetchUsers() {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("users")
    .select("id, email, full_name, role, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, 19);

  return {
    users: data || [],
    page: 1,
    totalPages: count ? Math.ceil(count / 20) : 1,
  };
}

export default async function MessagesManagementPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams =
    (searchParams && (await searchParams)) || undefined;

  await requireAuth(["super_admin", "admin"]);

  const page = Math.max(Number(resolvedSearchParams?.page) || 1, 1);
  const limit = Math.min(Number(resolvedSearchParams?.limit) || 20, 100);
  const unreadOnly = resolvedSearchParams?.unread_only === "true";

  const [messagesData, usersData] = await Promise.all([
    fetchMessages(page, limit, unreadOnly),
    fetchUsers(),
  ]);

  return (
    <MessageListClient
      initialMessages={messagesData.messages}
      initialPage={messagesData.page}
      initialTotalPages={messagesData.totalPages}
      initialUnreadOnly={messagesData.unreadOnly}
      usersPageData={usersData}
    />
  );
}
