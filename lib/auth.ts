export type Role = "viewer" | "editor" | "admin";

export type User = {
  id: string;
  name: string;
  role: Role;
};

const roleRank: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

/**
 * Integration seam for a real server-side session provider.
 * Deliberately returns null until authentication is implemented.
 */
export async function getCurrentUser(): Promise<User | null> {
  return null;
}

export async function requireRole(requiredRole: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user || roleRank[user.role] < roleRank[requiredRole]) {
    throw new Error("Unauthorized: a server-side authenticated session is required.");
  }
  return user;
}

