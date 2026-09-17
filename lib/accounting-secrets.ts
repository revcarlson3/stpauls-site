import crypto from "crypto";

const algorithm = "aes-256-gcm";

function key() {
  const secret = process.env.ACCOUNTING_ACCOUNT_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("An accounting account encryption key is required.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptAccountingAccountNumber(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
