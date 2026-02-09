import { proxy } from "@/lib/proxy";

// Keep matcher/config local so Next.js can statically analyze middleware config.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export const middleware = proxy;
