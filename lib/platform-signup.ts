import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { validatePassword } from "@/lib/password-policy";

export async function createPendingPlatformSignup(input: Record<string, unknown>) {
  const contactName = typeof input.contactName === "string" ? input.contactName.trim() : "";
  const churchName = typeof input.churchName === "string" ? input.churchName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const promoCode = typeof input.promoCode === "string" && input.promoCode.trim() ? input.promoCode.trim().toUpperCase() : null;
  if (!contactName || contactName.length > 120 || !churchName || churchName.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid contact name, church name, and email.");
  const passwordError = await validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  if (promoCode && !/^[A-Z0-9_-]{3,64}$/.test(promoCode)) throw new Error("Promo code is invalid.");
  const verification = randomBytes(32).toString("hex");
  const record = await db.accountSignup.create({ data: { email, contactName, churchName, passwordHash: await bcrypt.hash(password, 12), promoCode, verificationHash: createHash("sha256").update(verification).digest("hex"), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, select: { id: true, email: true, churchName: true, verificationExpiresAt: true } });
  return { id: record.id, status: "PENDING_VERIFICATION", verificationExpiresAt: record.verificationExpiresAt };
}
