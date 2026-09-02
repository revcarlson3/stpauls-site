import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "viewer" | "editor" | "admin";
    rememberMe?: boolean;
    canAccessAdmin?: boolean;
    mfaPending?: boolean;
    mfaPendingUserId?: string;
  }

  interface Session {
    user: {
      id: string;
      role: "viewer" | "editor" | "admin";
      canAccessAdmin: boolean;
      mfaPending?: boolean;
      mfaPendingUserId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "viewer" | "editor" | "admin";
    canAccessAdmin: boolean;
    mfaPending?: boolean;
    mfaPendingUserId?: string;
  }
}
