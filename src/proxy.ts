import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: sends cookie-less visitors to the login page without rendering anything.
// Real authorization happens in every admin page, Server Action and route handler.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("admin_sid")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
