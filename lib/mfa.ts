import crypto from "node:crypto";
import { decryptConfig, encryptConfig } from "@/lib/app-config";
import { db } from "@/lib/db";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_RESEND_INTERVAL_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function createTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function createOtpAuthUri(secret: string, account: string, issuer: string) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 1000 / 30);
  return [-1, 0, 1].some((offset) => timingSafeEqual(generateTotp(secret, counter + offset), normalized));
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${bytes.slice(0, 5)}-${bytes.slice(5)}`;
  });
}

export function encryptRecoveryCodes(codes: string[]) {
  return encryptConfig(JSON.stringify(codes.map(hashRecoveryCode)));
}

export function consumeRecoveryCode(encrypted: string | null, code: string) {
  if (!encrypted) return { valid: false, remaining: encrypted };
  let hashes: string[];
  try {
    hashes = JSON.parse(decryptConfig(encrypted)) as string[];
  } catch {
    return { valid: false, remaining: encrypted };
  }
  const hash = hashRecoveryCode(code);
  const index = hashes.findIndex((candidate) => timingSafeEqual(candidate, hash));
  if (index < 0) return { valid: false, remaining: encrypted };
  hashes.splice(index, 1);
  return { valid: true, remaining: encryptRecoveryCodesFromHashes(hashes) };
}

export function hashRecoveryCode(code: string) {
  return crypto.createHash("sha256").update(code.replace(/\s/g, "").toUpperCase()).digest("hex");
}

export function normalizePhoneNumber(value: string) {
  const phone = value.trim().replace(/[()\s-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function createOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code: string) {
  return crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "development-only-config-key")
    .update(code.replace(/\s/g, ""))
    .digest("hex");
}

export async function createOtpChallenge(input: {
  userId: string;
  channel: "email" | "sms";
  purpose: "login" | "enrollment";
  recipient: string;
}) {
  const now = new Date();
  const recent = await db.mfaChallenge.findFirst({
    where: { userId: input.userId, channel: input.channel, purpose: input.purpose, consumedAt: null, createdAt: { gt: new Date(now.getTime() - OTP_RESEND_INTERVAL_MS) } },
    select: { id: true }
  });
  if (recent) throw new Error("A verification code was already sent. Please wait before requesting another.");
  const code = createOtpCode();
  const challenge = await db.mfaChallenge.create({
    data: {
      userId: input.userId,
      channel: input.channel,
      purpose: input.purpose,
      recipient: input.recipient,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS)
    },
    select: { id: true, expiresAt: true, recipient: true }
  });
  return { ...challenge, code };
}

export async function verifyOtpChallenge(input: { userId: string; channel: "email" | "sms"; purpose: "login" | "enrollment"; code: string }) {
  const challenge = await db.mfaChallenge.findFirst({
    where: { userId: input.userId, channel: input.channel, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });
  if (!challenge || challenge.expiresAt <= new Date()) return { valid: false, reason: "expired" as const };
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { valid: false, reason: "locked" as const };
  const claimed = await db.mfaChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } }
  });
  if (claimed.count !== 1) return { valid: false, reason: "locked" as const };
  if (!timingSafeEqual(challenge.codeHash, hashOtpCode(input.code))) return { valid: false, reason: "invalid" as const };
  await db.mfaChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return { valid: true, recipient: challenge.recipient };
}

function encodeBase32(value: Buffer) {
  let bits = 0;
  let bitCount = 0;
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const byte = value[index];
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      output += BASE32_ALPHABET[(bits >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
  }
  if (bitCount > 0) output += BASE32_ALPHABET[(bits << (5 - bitCount)) & 31];
  return output;
}

function decodeBase32(value: string) {
  let bits = 0;
  let bitCount = 0;
  const output: number[] = [];
  for (const character of value.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP secret.");
    bits = (bits << 5) | index;
    bitCount += 5;
    if (bitCount >= 8) {
      output.push((bits >>> (bitCount - 8)) & 255);
      bitCount -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTotp(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encryptRecoveryCodesFromHashes(hashes: string[]) {
  return encryptConfig(JSON.stringify(hashes));
}
