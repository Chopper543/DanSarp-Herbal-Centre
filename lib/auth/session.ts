/**
 * Extracts the Supabase session id from the access-token JWT. The 2FA proof
 * cookie is bound to this so it dies on logout/rotation and can't be replayed
 * into a different session.
 */

interface SupabaseLike {
  auth: {
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
  };
}

/** Decode the `session_id` claim from a JWT without verifying it (the token was
 * already validated by `getUser()` upstream; we only need the claim). */
export function decodeSessionId(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return typeof payload?.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

export async function getSessionId(supabase: SupabaseLike): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? decodeSessionId(token) : null;
}
