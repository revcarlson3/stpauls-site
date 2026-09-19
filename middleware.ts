import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login" || pathname === "/global-admin/login") return NextResponse.next();
  const token = await getToken({ req: request });
  if (pathname.startsWith("/global-admin")) {
    if (token?.authBoundary === "global-admin" && !token.mfaPending) return NextResponse.next();
    return NextResponse.redirect(new URL("/global-admin/login", request.url));
  }
  if (pathname.startsWith("/admin")) {
    if (token?.authBoundary !== "global-admin" && token?.canAccessAdmin && !token.mfaPending) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/global-admin/:path*"]
};
