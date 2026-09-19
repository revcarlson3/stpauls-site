import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "viewer" | "editor" | "admin";
    rememberMe?: boolean;
    canAccessAdmin?: boolean;
    authBoundary?: "tenant-admin" | "global-admin";
    reauthenticatedAt?: number;
    mfaPending?: boolean;
    mfaPendingUserId?: string;
    mfaPendingChannel?: "authenticator" | "email" | "sms";
    mfaAvailableChannels?: Array<"authenticator" | "email" | "sms">;
    globalAdminMfaSetupRequired?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "viewer" | "editor" | "admin";
      canAccessAdmin: boolean;
      authBoundary?: "tenant-admin" | "global-admin";
      reauthenticatedAt?: number;
      mfaPending?: boolean;
      mfaPendingUserId?: string;
      mfaPendingChannel?: "authenticator" | "email" | "sms";
      mfaAvailableChannels?: Array<"authenticator" | "email" | "sms">;
      globalAdminMfaSetupRequired?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "viewer" | "editor" | "admin";
    canAccessAdmin: boolean;
    authBoundary?: "tenant-admin" | "global-admin";
    reauthenticatedAt?: number;
    mfaPending?: boolean;
    mfaPendingUserId?: string;
    mfaPendingChannel?: "authenticator" | "email" | "sms";
    mfaAvailableChannels?: Array<"authenticator" | "email" | "sms">;
    globalAdminMfaSetupRequired?: boolean;
  }
}
