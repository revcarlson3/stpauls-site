import { unlink } from "fs/promises";
import path from "path";

export async function removeMembershipPhoto(value: string | null) {
  if (!value) return;
  if (value.startsWith("/uploads/membership/")) {
    await unlink(path.join(process.cwd(), "public", value)).catch(() => undefined);
    return;
  }
  try {
    const filename = new URL(value, "http://localhost").searchParams.get("file");
    if (filename && /^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
      await unlink(path.join(process.cwd(), "storage", "membership", filename)).catch(() => undefined);
    }
  } catch {
    // Ignore malformed legacy paths while removing the database reference.
  }
}
