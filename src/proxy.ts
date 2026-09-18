import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: real auth happens in each page/action via auth().
export function proxy(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token");
  if (!hasSession) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/planner/:path*", "/mocks/:path*", "/settings/:path*", "/onboarding/:path*", "/friends/:path*", "/u/:path*"],
};
