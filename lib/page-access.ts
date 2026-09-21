import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const ACCESS_SECONDS = 12 * 60 * 60;

export function pageAccessCookieName(pageId: string) {
  return `page-access-${pageId}`;
}

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
}

function signature(payload: string) {
  const key = secret();
  return key ? createHmac("sha256", key).update(payload).digest("hex") : "";
}

export function createPageAccessToken(pageId: string, passwordHash: string) {
  if (!secret()) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_SECONDS;
  const fingerprint = createHmac("sha256", passwordHash).update(pageId).digest("hex").slice(0, 16);
  const payload = `${expiresAt}.${fingerprint}`;
  return { value: `${payload}.${signature(`${pageId}.${payload}`)}`, maxAge: ACCESS_SECONDS };
}

export function hasPageAccess(pageId: string, passwordHash: string | null) {
  if (!passwordHash) return true;
  const value = cookies().get(pageAccessCookieName(pageId))?.value;
  if (!value) return false;
  const [expiresAt, fingerprint, providedSignature] = value.split(".");
  if (!expiresAt || !fingerprint || !providedSignature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expectedFingerprint = createHmac("sha256", passwordHash).update(pageId).digest("hex").slice(0, 16);
  const expectedSignature = signature(`${pageId}.${expiresAt}.${fingerprint}`);
  if (!expectedSignature || fingerprint !== expectedFingerprint || providedSignature.length !== expectedSignature.length) return false;
  return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
}
