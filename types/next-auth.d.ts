import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "viewer" | "editor" | "admin";
    rememberMe?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "viewer" | "editor" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "viewer" | "editor" | "admin";
  }
}
