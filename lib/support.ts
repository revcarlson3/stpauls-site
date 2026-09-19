import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const SUPPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SUPPORT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const SUPPORT_FILE_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
  ["text/csv", ".csv"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

const storageDirectory = path.resolve(process.cwd(), "storage", "support");

export async function requireSupportUser(requireCreate = false) {
  const user = await getCurrentUser();
  if (!user || (!user.churchId && !user.isPlatformAdmin)) throw new Error("Unauthorized: a tenant account is required.");
  if (requireCreate && !user.isPlatformAdmin && !user.permissions.includes("CREATE_SUPPORT_TICKETS")) {
    throw new Error("Forbidden: Create Support Tickets permission is required.");
  }
  return user;
}

export function validateSupportFiles(files: File[]) {
  let total = 0;
  for (const file of files) {
    const extension = SUPPORT_FILE_TYPES.get(file.type);
    const originalExtension = path.extname(file.name).toLowerCase();
    const extensionMatches = originalExtension === extension || (file.type === "image/jpeg" && originalExtension === ".jpeg");
    if (!extension || !extensionMatches || file.size < 1 || file.size > SUPPORT_MAX_FILE_BYTES) {
      throw new Error("Attachments must be approved file types under 10 MB each.");
    }
    total += file.size;
  }
  if (total > SUPPORT_MAX_TOTAL_BYTES) throw new Error("Attachments must total 20 MB or less.");
}

export async function saveSupportFiles(files: File[]) {
  await mkdir(storageDirectory, { recursive: true });
  const saved: { originalName: string; storedName: string; mimeType: string; sizeBytes: number }[] = [];
  try {
    for (const file of files) {
      const storedName = `${randomUUID()}${SUPPORT_FILE_TYPES.get(file.type)}`;
      await writeFile(path.join(storageDirectory, storedName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
      saved.push({ originalName: file.name.slice(0, 200), storedName, mimeType: file.type, sizeBytes: file.size });
    }

    return saved;
  } catch (error) {
    await Promise.all(saved.map((file) => unlink(path.join(storageDirectory, file.storedName)).catch(() => undefined)));
    throw error;
  }

}

export async function removeSupportFiles(files: { storedName: string }[]) {
  await Promise.all(files.map((file) => unlink(path.join(storageDirectory, file.storedName)).catch(() => undefined)));
}

export async function readSupportFile(storedName: string) {
  if (!/^[a-f0-9-]+\.(pdf|txt|csv|png|jpg|webp)$/.test(storedName)) throw new Error("Invalid attachment.");
  return readFile(path.join(storageDirectory, storedName));
}

export function ticketWhere(user: Awaited<ReturnType<typeof requireSupportUser>>, requestedChurchId?: string) {
  if (user.isPlatformAdmin && requestedChurchId) return { churchId: requestedChurchId };
  return user.isPlatformAdmin ? {} : { churchId: user.churchId as string };
}

export async function serializeTicket(id: string, user: Awaited<ReturnType<typeof requireSupportUser>>) {
  const ticket = await db.supportTicket.findFirst({
    where: { id, ...ticketWhere(user) },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } }, attachments: true } },
      attachments: true,
    },
  });
  if (!ticket) throw new Error("Not found: Support ticket not found.");
  return ticket;
}
