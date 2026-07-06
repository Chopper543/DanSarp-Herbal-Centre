import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export interface UpdateSessionOptions {
  /**
   * Headers to inject onto the *downstream* request before Next.js renders
   * server components. Use this to forward per-request values like the CSP
   * nonce and CSRF token that RootLayout reads via next/headers.
   */
  forwardedHeaders?: Record<string, string>;
}

export async function updateSession(
  request: NextRequest,
  options: UpdateSessionOptions = {}
) {
  const buildResponse = () => {
    if (options.forwardedHeaders) {
      const headers = new Headers(request.headers);
      for (const [k, v] of Object.entries(options.forwardedHeaders)) {
        headers.set(k, v);
      }
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next({ request });
  };

  let supabaseResponse = buildResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options: _opts }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = buildResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  await supabase.auth.getUser();

  return supabaseResponse;
}
