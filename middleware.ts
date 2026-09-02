import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/admin/login" },
  callbacks: {
    authorized: ({ token, req }) => req.nextUrl.pathname === "/admin/login" || Boolean(token?.canAccessAdmin && !token.mfaPending)
  }
});

export const config = {
  matcher: ["/admin/:path*"]
};
